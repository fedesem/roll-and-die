import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent
} from "react";

import type {
  ActorSheet,
  BoardToken,
  CampaignMap,
  DrawingStroke,
  MemberRole,
  Point
} from "@shared/types";
import {
  cellKey,
  computeVisibleCellsForUser,
  obstacleMidpoint,
  pointToCell,
  snapPointToGrid,
  tokenCellKey,
  traceMovementPath,
  type MovementTrace
} from "@shared/vision";

type Tool = "select" | "draw";
type SelectedMapItem = `drawing:${string}`;

interface BoardCanvasProps {
  map?: CampaignMap;
  tokens: BoardToken[];
  actors: ActorSheet[];
  selectedActor?: ActorSheet;
  role: MemberRole;
  currentUserId: string;
  playerSeenCells: string[];
  fogPreviewUserId?: string;
  onSelectActor: (actorId: string) => void;
  onMoveActor: (actorId: string, x: number, y: number) => Promise<void>;
  onToggleDoor: (doorId: string) => Promise<void>;
  onUpdateMap: (map: CampaignMap) => Promise<void>;
}

interface DragState {
  actorId: string;
  start: Point;
}

interface PanState {
  clientX: number;
  clientY: number;
  originX: number;
  originY: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

interface SelectionState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const minViewZoom = 0.35;
const maxViewZoom = 4;
const discoveredDrawingsStorageKey = "dnd-board-discovered-drawings";
const selectionDragThreshold = 4;

export function BoardCanvas({
  map,
  tokens,
  actors,
  selectedActor,
  role,
  currentUserId,
  playerSeenCells,
  fogPreviewUserId,
  onSelectActor,
  onMoveActor,
  onToggleDoor,
  onUpdateMap
}: BoardCanvasProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const initializedMapIdRef = useRef<string | null>(null);
  const suppressSurfaceClickRef = useRef(false);
  const [tool, setTool] = useState<Tool>("select");
  const [strokeColor, setStrokeColor] = useState("#d3a232");
  const [strokeSize, setStrokeSize] = useState(4);
  const [draftPoints, setDraftPoints] = useState<Point[]>([]);
  const [movePreview, setMovePreview] = useState<MovementTrace | null>(null);
  const [draggingToken, setDraggingToken] = useState<DragState | null>(null);
  const [selectedMapItems, setSelectedMapItems] = useState<SelectedMapItem[]>([]);
  const [panning, setPanning] = useState<PanState | null>(null);
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const [viewZoom, setViewZoom] = useState(1);
  const [viewPan, setViewPan] = useState<Point>({ x: 0, y: 0 });
  const [selectionBox, setSelectionBox] = useState<SelectionState | null>(null);
  const [discoveredDrawingsByViewer, setDiscoveredDrawingsByViewer] = useState<Record<string, Record<string, string[]>>>(() =>
    readDiscoveredDrawingsMemory()
  );

  const baseScale = map?.grid.scale ?? 1;
  const worldScale = baseScale * viewZoom;
  const isDungeonMaster = role === "dm";
  const fogPreviewActive = isDungeonMaster && typeof fogPreviewUserId === "string" && fogPreviewUserId.length > 0;
  const usesRestrictedVision = role !== "dm" || fogPreviewActive;
  const visionUserId = fogPreviewUserId ?? currentUserId;
  const discoveryViewerKey = usesRestrictedVision ? visionUserId : "__dm_full__";

  const actorById = useMemo(() => new Map(actors.map((actor) => [actor.id, actor])), [actors]);
  const visibleTokens = useMemo(
    () => tokens.filter((token) => token.visible && token.mapId === map?.id),
    [map?.id, tokens]
  );
  const selectedToken = useMemo(
    () => visibleTokens.find((token) => token.actorId === selectedActor?.id),
    [selectedActor?.id, visibleTokens]
  );

  const currentVisibleCells = useMemo(() => {
    if (!map) {
      return new Set<string>();
    }

    return computeVisibleCellsForUser({
      map,
      actors,
      tokens: visibleTokens,
      userId: visionUserId,
      role: usesRestrictedVision ? "player" : "dm"
    });
  }, [actors, map, usesRestrictedVision, visionUserId, visibleTokens]);

  const seenCells = useMemo(() => new Set(playerSeenCells), [playerSeenCells]);

  const filteredTokens = useMemo(() => {
    if (!map || !usesRestrictedVision) {
      return visibleTokens;
    }

    return visibleTokens.filter((token) => currentVisibleCells.has(tokenCellKey(map, token)));
  }, [currentVisibleCells, map, usesRestrictedVision, visibleTokens]);

  const discoveredDrawingIds = useMemo(() => {
    if (!map) {
      return new Set<string>();
    }

    const memoryKey = `${map.id}:${map.visibilityVersion}`;
    return new Set(discoveredDrawingsByViewer[discoveryViewerKey]?.[memoryKey] ?? []);
  }, [discoveredDrawingsByViewer, discoveryViewerKey, map]);

  const drawingBuckets = useMemo(() => {
    if (!map) {
      return { current: [] as DrawingStroke[], memory: [] as DrawingStroke[] };
    }

    if (!usesRestrictedVision) {
      return {
        current: map.drawings,
        memory: [] as DrawingStroke[]
      };
    }

    const current: DrawingStroke[] = [];
    const memory: DrawingStroke[] = [];

    for (const stroke of map.drawings) {
      const visible = stroke.points.some((point) => isPointCurrentlyVisible(map, currentVisibleCells, point));

      if (visible) {
        current.push(stroke);
        continue;
      }

      if (discoveredDrawingIds.has(stroke.id)) {
        memory.push(stroke);
      }
    }

    return { current, memory };
  }, [currentVisibleCells, discoveredDrawingIds, map, usesRestrictedVision]);

  const visibleObstacles = useMemo(() => {
    if (!map) {
      return [];
    }

    if (!usesRestrictedVision) {
      return map.walls;
    }

    return map.walls.filter((wall) => {
      if (wall.kind !== "door") {
        return false;
      }

      return isDoorCurrentlyVisible(map, currentVisibleCells, wall);
    });
  }, [currentVisibleCells, map, usesRestrictedVision]);

  const visibleViewportCells = useMemo(() => {
    if (!map || !usesRestrictedVision || viewportSize.width <= 0 || viewportSize.height <= 0) {
      return [];
    }

    const left = (-viewPan.x) / worldScale;
    const top = (-viewPan.y) / worldScale;
    const right = (viewportSize.width - viewPan.x) / worldScale;
    const bottom = (viewportSize.height - viewPan.y) / worldScale;
    const minColumn = Math.floor((left - map.grid.offsetX) / map.grid.cellSize) - 2;
    const maxColumn = Math.ceil((right - map.grid.offsetX) / map.grid.cellSize) + 2;
    const minRow = Math.floor((top - map.grid.offsetY) / map.grid.cellSize) - 2;
    const maxRow = Math.ceil((bottom - map.grid.offsetY) / map.grid.cellSize) + 2;
    const cells: Array<{ key: string; column: number; row: number; tone: "memory" | "hidden" }> = [];

    for (let row = minRow; row <= maxRow; row += 1) {
      for (let column = minColumn; column <= maxColumn; column += 1) {
        const key = cellKey(column, row);

        if (currentVisibleCells.has(key)) {
          continue;
        }

        cells.push({
          key,
          column,
          row,
          tone: seenCells.has(key) ? "memory" : "hidden"
        });
      }
    }

    return cells;
  }, [currentVisibleCells, map, seenCells, usesRestrictedVision, viewPan.x, viewPan.y, viewportSize.height, viewportSize.width, worldScale]);

  const gridStyle = useMemo(() => {
    if (!map?.grid.show) {
      return undefined;
    }

    const cell = map.grid.cellSize * worldScale;
    const offsetX = viewPan.x + map.grid.offsetX * worldScale;
    const offsetY = viewPan.y + map.grid.offsetY * worldScale;

    return {
      backgroundImage: `
        linear-gradient(to right, ${map.grid.color} 1px, transparent 1px),
        linear-gradient(to bottom, ${map.grid.color} 1px, transparent 1px)
      `,
      backgroundSize: `${cell}px ${cell}px`,
      backgroundPosition: `${offsetX}px ${offsetY}px`
    };
  }, [map, viewPan.x, viewPan.y, worldScale]);

  const backgroundRect = useMemo(() => {
    if (!map?.backgroundUrl) {
      return null;
    }

    return {
      left: viewPan.x + map.backgroundOffsetX * worldScale,
      top: viewPan.y + map.backgroundOffsetY * worldScale,
      width: map.width * map.backgroundScale * worldScale,
      height: map.height * map.backgroundScale * worldScale
    };
  }, [map, viewPan.x, viewPan.y, worldScale]);

  const tokenLayerStyle = useMemo(
    () => ({
      transform: `translate(${viewPan.x}px, ${viewPan.y}px) scale(${worldScale})`
    }),
    [viewPan.x, viewPan.y, worldScale]
  );

  const previewLabelPoint = useMemo(() => {
    if (!movePreview || movePreview.points.length < 2) {
      return null;
    }

    return movePreview.points[Math.floor((movePreview.points.length - 1) / 2)] ?? movePreview.end;
  }, [movePreview]);

  const moveArrowStrokeWidth = clamp(4 * worldScale, 2.5, 12);
  const moveArrowHeadSize = clamp(12 * worldScale, 8, 28);
  const moveLabelFontSize = clamp(14 * worldScale, 12, 28);
  const moveLabelOffset = clamp(12 * worldScale, 10, 24);
  const normalizedSelectionBox = selectionBox ? normalizeSelectionRect(selectionBox) : null;

  useEffect(() => {
    if (!boardRef.current) {
      return;
    }

    const node = boardRef.current;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      setViewportSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height
      });
    });

    resizeObserver.observe(node);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    writeDiscoveredDrawingsMemory(discoveredDrawingsByViewer);
  }, [discoveredDrawingsByViewer]);

  useEffect(() => {
    if (!boardRef.current) {
      return;
    }

    const node = boardRef.current;
    const handleNativeWheel = (event: WheelEvent) => {
      event.preventDefault();
    };

    node.addEventListener("wheel", handleNativeWheel, { passive: false });

    return () => {
      node.removeEventListener("wheel", handleNativeWheel);
    };
  }, [map?.id]);

  useEffect(() => {
    if (!map || viewportSize.width <= 0 || viewportSize.height <= 0) {
      return;
    }

    if (initializedMapIdRef.current === map.id) {
      return;
    }

    const imageWidth = map.width * map.backgroundScale;
    const imageHeight = map.height * map.backgroundScale;

    setViewZoom(1);
    setViewPan({
      x: viewportSize.width / 2 - (map.backgroundOffsetX + imageWidth / 2) * baseScale,
      y: viewportSize.height / 2 - (map.backgroundOffsetY + imageHeight / 2) * baseScale
    });
    initializedMapIdRef.current = map.id;
  }, [baseScale, map, viewportSize.height, viewportSize.width]);

  useEffect(() => {
    setSelectedMapItems([]);
    setMovePreview(null);
    setDraggingToken(null);
    setDraftPoints([]);
    setSelectionBox(null);
  }, [map?.id]);

  useEffect(() => {
    if (!map || !usesRestrictedVision) {
      return;
    }

    setDiscoveredDrawingsByViewer((current) => {
      const viewerMemory = current[discoveryViewerKey] ?? {};
      const memoryKey = `${map.id}:${map.visibilityVersion}`;
      const currentMapEntries = viewerMemory[memoryKey] ?? [];
      const nextIds = new Set(currentMapEntries.filter((id) => map.drawings.some((stroke) => stroke.id === id)));
      let changed = nextIds.size !== currentMapEntries.length;

      for (const stroke of map.drawings) {
        if (!stroke.points.some((point) => isPointCurrentlyVisible(map, currentVisibleCells, point))) {
          continue;
        }

        if (!nextIds.has(stroke.id)) {
          nextIds.add(stroke.id);
          changed = true;
        }
      }

      if (!changed) {
        return current;
      }

      return {
        ...current,
        [discoveryViewerKey]: {
          ...viewerMemory,
          [memoryKey]: Array.from(nextIds)
        }
      };
    });
  }, [currentVisibleCells, discoveryViewerKey, map, usesRestrictedVision]);

  useEffect(() => {
    if (!draggingToken || !map) {
      return;
    }

    function handleWindowPointerMove(event: PointerEvent) {
      const point = toWorldPoint(event.clientX, event.clientY);

      if (!point) {
        return;
      }

      setMovePreview(
        traceMovementPath(map, draggingToken.start, point, {
          ignoreWalls: isDungeonMaster
        })
      );
    }

    function handleWindowPointerUp(event: PointerEvent) {
      const point = toWorldPoint(event.clientX, event.clientY);
      const trace =
        point
          ? traceMovementPath(map, draggingToken.start, point, {
              ignoreWalls: isDungeonMaster
            })
          : null;

      setDraggingToken(null);
      setMovePreview(null);

      if (!trace || trace.steps === 0) {
        return;
      }

      void onMoveActor(draggingToken.actorId, trace.end.x, trace.end.y);
    }

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
    };
  }, [draggingToken, isDungeonMaster, map, onMoveActor]);

  useEffect(() => {
    if (!panning) {
      return;
    }

    function handleWindowPointerMove(event: PointerEvent) {
      setViewPan({
        x: panning.originX + (event.clientX - panning.clientX),
        y: panning.originY + (event.clientY - panning.clientY)
      });
    }

    function handleWindowPointerUp() {
      setPanning(null);
    }

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
    };
  }, [panning]);

  useEffect(() => {
    if (!isDungeonMaster || selectedMapItems.length === 0 || !map) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;

      if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target?.isContentEditable) {
        return;
      }

      event.preventDefault();
      const selected = new Set(selectedMapItems);

      void commitMapUpdate((draft) => {
        draft.drawings = draft.drawings.filter((drawing) => !selected.has(`drawing:${drawing.id}`));
      });
      setSelectedMapItems([]);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDungeonMaster, map, selectedMapItems]);

  function cloneMap(source: CampaignMap) {
    return JSON.parse(JSON.stringify(source)) as CampaignMap;
  }

  function canControlActor(actor: ActorSheet) {
    return role === "dm" || (actor.kind === "character" && actor.ownerId === currentUserId);
  }

  function worldToScreen(point: Point) {
    return {
      x: point.x * worldScale + viewPan.x,
      y: point.y * worldScale + viewPan.y
    };
  }

  function toWorldPoint(clientX: number, clientY: number): Point | null {
    if (!boardRef.current) {
      return null;
    }

    const rect = boardRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - viewPan.x) / worldScale,
      y: (clientY - rect.top - viewPan.y) / worldScale
    };
  }

  function toLocalPoint(clientX: number, clientY: number) {
    if (!boardRef.current) {
      return null;
    }

    const rect = boardRef.current.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  async function commitMapUpdate(mutator: (draft: CampaignMap) => void) {
    if (!map) {
      return;
    }

    const draft = cloneMap(map);
    mutator(draft);
    await onUpdateMap(draft);
  }

  function updateMapItemSelection(key: SelectedMapItem) {
    setSelectedMapItems((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]
    );
  }

  function selectDrawingsInBox(selection: SelectionState) {
    if (!map) {
      return;
    }

    const rect = normalizeSelectionRect(selection);
    const dragged = rect.width >= selectionDragThreshold || rect.height >= selectionDragThreshold;

    if (!dragged) {
      return;
    }

    const nextSelected = map.drawings
      .filter((drawing) => pathBoundsIntersectsRect(drawing.points.map(worldToScreen), rect))
      .map((drawing) => `drawing:${drawing.id}` satisfies SelectedMapItem);

    setSelectedMapItems(nextSelected);
    suppressSurfaceClickRef.current = true;
  }

  function handleEmptyBoardClick() {
    if (tool === "select") {
      setSelectedMapItems([]);
    }
  }

  async function handleBoardClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (suppressSurfaceClickRef.current) {
      suppressSurfaceClickRef.current = false;
      return;
    }

    if (!map || panning) {
      return;
    }

    const point = toWorldPoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    if (tool === "select" && !selectedToken && selectedActor && canControlActor(selectedActor)) {
      const snapped = snapPointToGrid(map, point);
      await onMoveActor(selectedActor.id, snapped.x, snapped.y);
    }
  }

  function handleBoardPointerDownCapture(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 1 && event.button !== 2) {
      return;
    }

    event.preventDefault();
    setPanning({
      clientX: event.clientX,
      clientY: event.clientY,
      originX: viewPan.x,
      originY: viewPan.y
    });
  }

  function handleBoardPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!map || event.button !== 0 || event.target !== event.currentTarget) {
      return;
    }

    if (isDungeonMaster && tool === "select" && (!selectedActor || selectedToken)) {
      const localPoint = toLocalPoint(event.clientX, event.clientY);

      if (!localPoint) {
        return;
      }

      setSelectionBox({
        startX: localPoint.x,
        startY: localPoint.y,
        currentX: localPoint.x,
        currentY: localPoint.y
      });
      return;
    }

    if (!isDungeonMaster || tool !== "draw") {
      return;
    }

    const point = toWorldPoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    setDraftPoints([point]);
  }

  function handleBoardPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!map) {
      return;
    }

    if (selectionBox) {
      const localPoint = toLocalPoint(event.clientX, event.clientY);

      if (!localPoint) {
        return;
      }

      setSelectionBox((current) =>
        current
          ? {
              ...current,
              currentX: localPoint.x,
              currentY: localPoint.y
            }
          : current
      );
      return;
    }

    const point = toWorldPoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    if (tool === "draw" && draftPoints.length > 0) {
      setDraftPoints((current) => {
        const previous = current[current.length - 1];

        if (!previous) {
          return [point];
        }

        return Math.hypot(point.x - previous.x, point.y - previous.y) < 4 ? current : [...current, point];
      });
    }
  }

  async function handleBoardPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (selectionBox) {
      selectDrawingsInBox(selectionBox);
      setSelectionBox(null);
      return;
    }

    if (!map || !isDungeonMaster || tool !== "draw") {
      return;
    }

    const point = toWorldPoint(event.clientX, event.clientY);

    if (draftPoints.length > 1) {
      const points =
        point && draftPoints[draftPoints.length - 1] !== point ? [...draftPoints, point] : draftPoints;

      await commitMapUpdate((draft) => {
        const stroke: DrawingStroke = {
          id: `drw_${crypto.randomUUID().slice(0, 8)}`,
          color: strokeColor,
          size: strokeSize,
          points
        };

        draft.drawings.push(stroke);
      });
    }

    setDraftPoints([]);
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!map || !boardRef.current) {
      return;
    }

    event.preventDefault();
    const nextZoom = clamp(viewZoom * (event.deltaY < 0 ? 1.1 : 0.9), minViewZoom, maxViewZoom);

    if (nextZoom === viewZoom) {
      return;
    }

    const rect = boardRef.current.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const worldPoint = {
      x: (cursorX - viewPan.x) / worldScale,
      y: (cursorY - viewPan.y) / worldScale
    };
    const nextWorldScale = baseScale * nextZoom;

    setViewZoom(nextZoom);
    setViewPan({
      x: cursorX - worldPoint.x * nextWorldScale,
      y: cursorY - worldPoint.y * nextWorldScale
    });
  }

  async function clearInk() {
    if (!window.confirm("Clear all drawings from this map?")) {
      return;
    }

    await commitMapUpdate((draft) => {
      draft.drawings = [];
    });
  }

  function handleTokenPointerDown(token: BoardToken, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    setSelectedMapItems([]);

    const actor = actorById.get(token.actorId);

    if (!actor) {
      return;
    }

    onSelectActor(token.actorId);

    if (tool !== "select" || !canControlActor(actor)) {
      return;
    }

    setDraggingToken({
      actorId: token.actorId,
      start: { x: token.x, y: token.y }
    });
  }

  function handleMapItemClick(key: SelectedMapItem, event: ReactMouseEvent<SVGElement>) {
    event.stopPropagation();

    if (!isDungeonMaster || tool !== "select") {
      return;
    }

    updateMapItemSelection(key);
  }

  function handleDoorClick(doorId: string, event: ReactMouseEvent<SVGLineElement>) {
    event.stopPropagation();

    if (tool !== "select") {
      return;
    }

    void onToggleDoor(doorId);
  }

  function toSvgPathWorld(points: Point[]) {
    return points
      .map((point, index) => {
        const screen = worldToScreen(point);
        return `${index === 0 ? "M" : "L"} ${screen.x} ${screen.y}`;
      })
      .join(" ");
  }

  if (!map) {
    return (
      <section className="board-panel empty-panel">
        <h2>Board</h2>
        <p>Create a map to start staging characters, monsters, and line of sight.</p>
      </section>
    );
  }

  return (
    <section className="board-panel">
      <div className="board-toolbar">
        <div className="segmented">
          <button className={tool === "select" ? "is-active" : ""} type="button" onClick={() => setTool("select")}>
            Select
          </button>
          {isDungeonMaster && (
            <button className={tool === "draw" ? "is-active" : ""} type="button" onClick={() => setTool("draw")}>
              Draw
            </button>
          )}
        </div>
        <div className="tool-meta">
          <span className="board-zoom-chip">Zoom {Math.round(viewZoom * 100)}%</span>
          {isDungeonMaster && (
            <>
              <label>
                Ink
                <input type="color" value={strokeColor} onChange={(event) => setStrokeColor(event.target.value)} />
              </label>
              <label>
                Size
                <input
                  type="range"
                  min="1"
                  max="16"
                  value={strokeSize}
                  onChange={(event) => setStrokeSize(Number(event.target.value))}
                />
              </label>
              <button type="button" onClick={() => void clearInk()}>
                Clear Ink
              </button>
            </>
          )}
        </div>
      </div>

      <div className="board-scroll">
        <div
          ref={boardRef}
          className="board-surface"
          onClick={(event) => {
            handleEmptyBoardClick();
            void handleBoardClick(event);
          }}
          onPointerDownCapture={handleBoardPointerDownCapture}
          onPointerDown={handleBoardPointerDown}
          onPointerMove={handleBoardPointerMove}
          onPointerUp={(event) => void handleBoardPointerUp(event)}
          onPointerLeave={(event) => {
            if (selectionBox) {
              selectDrawingsInBox(selectionBox);
              setSelectionBox(null);
            }
            if (tool === "draw") {
              void handleBoardPointerUp(event);
            }
          }}
          onWheel={handleWheel}
          onContextMenu={(event) => event.preventDefault()}
        >
          {backgroundRect && (
            <div
              className="board-background"
              style={{
                left: backgroundRect.left,
                top: backgroundRect.top,
                width: backgroundRect.width,
                height: backgroundRect.height,
                backgroundImage: `linear-gradient(rgba(8, 8, 8, 0.12), rgba(8, 8, 8, 0.38)), url(${map.backgroundUrl})`
              }}
            />
          )}
          {gridStyle && <div className="board-grid" style={gridStyle} />}

          <svg className="board-overlay" width={viewportSize.width} height={viewportSize.height} viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}>
            <defs>
              <marker
                id="move-arrowhead"
                viewBox="0 0 10 10"
                markerUnits="userSpaceOnUse"
                refX="8"
                refY="5"
                markerWidth={moveArrowHeadSize}
                markerHeight={moveArrowHeadSize}
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#f2bb3f" />
              </marker>
            </defs>

            {drawingBuckets.current.map((stroke) => (
              <path
                key={stroke.id}
                d={toSvgPathWorld(stroke.points)}
                fill="none"
                stroke={stroke.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={stroke.size * worldScale}
                className={selectedMapItems.includes(`drawing:${stroke.id}`) ? "board-drawing-selected" : undefined}
              />
            ))}
            {draftPoints.length > 1 && (
              <path
                d={toSvgPathWorld(draftPoints)}
                fill="none"
                stroke={strokeColor}
                strokeDasharray="10 8"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={strokeSize * worldScale}
              />
            )}
            {visibleObstacles.map((wall) => {
              const start = worldToScreen(wall.start);
              const end = worldToScreen(wall.end);
              return (
                <line
                  key={wall.id}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  className={`board-wall kind-${wall.kind} ${wall.isOpen ? "is-open" : ""}`}
                />
              );
            })}
            {visibleViewportCells.map((entry) => {
              const screen = worldToScreen({
                x: map.grid.offsetX + entry.column * map.grid.cellSize,
                y: map.grid.offsetY + entry.row * map.grid.cellSize
              });

              return (
                <rect
                  key={entry.key}
                  x={screen.x}
                  y={screen.y}
                  width={map.grid.cellSize * worldScale + 1}
                  height={map.grid.cellSize * worldScale + 1}
                  className={entry.tone === "hidden" ? "board-vision-hidden" : "board-vision-memory"}
                />
              );
            })}
            {drawingBuckets.memory.map((stroke) => (
              <path
                key={stroke.id}
                d={toSvgPathWorld(stroke.points)}
                fill="none"
                stroke={stroke.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={stroke.size * worldScale}
                opacity={0.82}
                className={selectedMapItems.includes(`drawing:${stroke.id}`) ? "board-drawing-selected" : undefined}
              />
            ))}
            {normalizedSelectionBox && (
              <rect
                x={normalizedSelectionBox.x}
                y={normalizedSelectionBox.y}
                width={normalizedSelectionBox.width}
                height={normalizedSelectionBox.height}
                className="selection-rect"
              />
            )}
            {movePreview && movePreview.steps > 0 && (
              <>
                <path
                  d={toSvgPathWorld(movePreview.points)}
                  className={`board-move-path ${movePreview.blocked ? "is-blocked" : ""}`}
                  markerEnd="url(#move-arrowhead)"
                  style={{ strokeWidth: moveArrowStrokeWidth }}
                />
                {(() => {
                  const end = worldToScreen(movePreview.end);
                  return (
                    <circle
                      cx={end.x}
                      cy={end.y}
                      r={Math.max(8, map.grid.cellSize * worldScale * 0.12)}
                      className="board-target-ring"
                    />
                  );
                })()}
                {previewLabelPoint && (() => {
                  const labelPoint = worldToScreen(previewLabelPoint);
                  return (
                    <text
                      x={labelPoint.x + moveLabelOffset}
                      y={labelPoint.y - moveLabelOffset}
                      className="board-move-label"
                      style={{ fontSize: `${moveLabelFontSize}px` }}
                    >
                      {movePreview.steps} sq
                    </text>
                  );
                })()}
              </>
            )}
          </svg>

          {((isDungeonMaster && tool === "select") || visibleObstacles.some((wall) => wall.kind === "door")) && (
            <svg className="board-interaction-layer" width={viewportSize.width} height={viewportSize.height} viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}>
              {isDungeonMaster && tool === "select" && map.drawings.map((stroke) => (
                <path
                  key={stroke.id}
                  d={toSvgPathWorld(stroke.points)}
                  className="board-select-hit"
                  strokeWidth={Math.max(14, stroke.size * worldScale + 10)}
                  onClick={(event) => handleMapItemClick(`drawing:${stroke.id}`, event)}
                />
              ))}
              {visibleObstacles
                .filter((wall) => wall.kind === "door")
                .map((wall) => {
                const start = worldToScreen(wall.start);
                const end = worldToScreen(wall.end);
                return (
                  <line
                    key={wall.id}
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    className="board-door-hit"
                    strokeWidth={18}
                    onClick={(event) => handleDoorClick(wall.id, event)}
                  />
                );
              })}
            </svg>
          )}

          <div className="board-token-layer" style={tokenLayerStyle}>
            {filteredTokens.map((token) => {
              const size = map.grid.cellSize * token.size * 0.72;

              return (
                <button
                  key={token.id}
                  type="button"
                  title={token.label}
                  className={`board-token ${selectedActor?.id === token.actorId ? "is-selected" : ""}`}
                  style={{
                    left: token.x,
                    top: token.y,
                    width: size,
                    height: size,
                    fontSize: Math.max(12, size * 0.34),
                    background: token.color
                  }}
                  onPointerDown={(event) => handleTokenPointerDown(token, event)}
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <span>{initials(token.label)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="panel-hint">
        {tool === "select" &&
          (selectedActor
            ? selectedToken
              ? `Selected: ${selectedActor.name}. Drag the token to preview movement and release to move${movePreview ? ` (${movePreview.steps} squares)` : ""}.`
              : `Selected: ${selectedActor.name}. Click the board to place the token on the grid.`
            : selectedMapItems.length > 0
              ? `${selectedMapItems.length} map item${selectedMapItems.length === 1 ? "" : "s"} selected. Press Delete to remove them.`
              : "Click a token to select a character, drag a token to move it, click a nearby visible door to open or close it, use middle or right drag to pan, and use the mouse wheel to zoom.")}
        {tool === "draw" && "Drag to sketch temporary markings over the battlefield. Middle or right drag still pans the infinite board."}
      </p>
    </section>
  );
}

function isPointCurrentlyVisible(map: CampaignMap, visibleCells: Set<string>, point: Point) {
  const cell = pointToCell(map, point);
  return visibleCells.has(cellKey(cell.column, cell.row));
}

function isDoorCurrentlyVisible(map: CampaignMap, visibleCells: Set<string>, door: CampaignMap["walls"][number]) {
  const adjacentCells = getAdjacentDoorCellKeys(map, door);

  if (adjacentCells.some((key) => visibleCells.has(key))) {
    return true;
  }

  const midpoint = obstacleMidpoint(door);
  return (
    isPointCurrentlyVisible(map, visibleCells, door.start) ||
    isPointCurrentlyVisible(map, visibleCells, door.end) ||
    isPointCurrentlyVisible(map, visibleCells, midpoint)
  );
}

function getAdjacentDoorCellKeys(map: CampaignMap, door: CampaignMap["walls"][number]) {
  const epsilon = 0.001;
  const keys = new Set<string>();
  const startX = (door.start.x - map.grid.offsetX) / map.grid.cellSize;
  const endX = (door.end.x - map.grid.offsetX) / map.grid.cellSize;
  const startY = (door.start.y - map.grid.offsetY) / map.grid.cellSize;
  const endY = (door.end.y - map.grid.offsetY) / map.grid.cellSize;

  if (Math.abs(startX - endX) < epsilon) {
    const column = Math.round(startX);
    const minRow = Math.min(startY, endY);
    const maxRow = Math.max(startY, endY);

    for (let row = Math.floor(minRow); row < Math.ceil(maxRow) - epsilon; row += 1) {
      keys.add(cellKey(column - 1, row));
      keys.add(cellKey(column, row));
    }
  } else if (Math.abs(startY - endY) < epsilon) {
    const row = Math.round(startY);
    const minColumn = Math.min(startX, endX);
    const maxColumn = Math.max(startX, endX);

    for (let column = Math.floor(minColumn); column < Math.ceil(maxColumn) - epsilon; column += 1) {
      keys.add(cellKey(column, row - 1));
      keys.add(cellKey(column, row));
    }
  }

  return Array.from(keys);
}

function initials(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function readDiscoveredDrawingsMemory() {
  const raw = window.localStorage.getItem(discoveredDrawingsStorageKey);

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    return Object.fromEntries(
      Object.entries(parsed).map(([viewerId, maps]) => [
        viewerId,
        typeof maps === "object" && maps !== null
          ? Object.fromEntries(
              Object.entries(maps as Record<string, unknown>).map(([mapId, value]) => [
                mapId,
                Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []
              ])
            )
          : {}
      ])
    );
  } catch {
    return {};
  }
}

function writeDiscoveredDrawingsMemory(value: Record<string, Record<string, string[]>>) {
  window.localStorage.setItem(discoveredDrawingsStorageKey, JSON.stringify(value));
}

function normalizeSelectionRect(rect: SelectionState) {
  return {
    x: Math.min(rect.startX, rect.currentX),
    y: Math.min(rect.startY, rect.currentY),
    width: Math.abs(rect.currentX - rect.startX),
    height: Math.abs(rect.currentY - rect.startY)
  };
}

function pathBoundsIntersectsRect(points: Point[], rect: { x: number; y: number; width: number; height: number }) {
  if (points.length === 0) {
    return false;
  }

  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  return !(maxX < rect.x || minX > rect.x + rect.width || maxY < rect.y || minY > rect.y + rect.height);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
