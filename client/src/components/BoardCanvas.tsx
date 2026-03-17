import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent
} from "react";
import { Eye, EyeOff, MousePointer2, PencilLine, RotateCcw, Trash2 } from "lucide-react";

import type {
  ActorSheet,
  BoardToken,
  CampaignMap,
  DrawingStroke,
  MapPing,
  MapViewportRecall,
  MemberRole,
  Point,
  TokenMovementPreview
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
import { readJson, writeJson } from "../lib/storage";

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
  fogPlayers: Array<{ userId: string; name: string }>;
  dmFogEnabled: boolean;
  dmFogUserId: string | null;
  onSetDmFogEnabled: (value: boolean) => void;
  onSetDmFogUserId: (value: string | null) => void;
  onResetFog: () => Promise<void>;
  onSelectActor: (actorId: string | null) => void;
  onSelectedMapItemCountChange: (count: number) => void;
  movementPreviews: Array<{ actorId: string; mapId: string; preview: TokenMovementPreview }>;
  pings: MapPing[];
  viewRecall: MapViewportRecall | null;
  onMoveActor: (actorId: string, x: number, y: number) => Promise<void>;
  onBroadcastMovePreview: (actorId: string, target: Point | null) => Promise<void>;
  onToggleDoor: (doorId: string) => Promise<void>;
  onCreateDrawing: (mapId: string, stroke: DrawingStroke) => Promise<void>;
  onDeleteDrawings: (mapId: string, drawingIds: string[]) => Promise<void>;
  onClearDrawings: (mapId: string) => Promise<void>;
  onPing: (point: Point) => Promise<void>;
  onPingAndRecall: (point: Point, center: Point, zoom: number) => Promise<void>;
}

interface DragState {
  actorId: string;
  start: Point;
}

interface PanState {
  button: number;
  clientX: number;
  clientY: number;
  originX: number;
  originY: number;
  menuPoint?: Point;
  menuX?: number;
  menuY?: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

interface SelectionState {
  additive: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  point: Point;
}

const minViewZoom = 0.35;
const maxViewZoom = 4;
const discoveredDrawingsStorageKey = "dnd-board-discovered-drawings";
const boardViewStorageKeyPrefix = "dnd-board-view";
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
  fogPlayers,
  dmFogEnabled,
  dmFogUserId,
  onSetDmFogEnabled,
  onSetDmFogUserId,
  onResetFog,
  onSelectActor,
  onSelectedMapItemCountChange,
  movementPreviews,
  pings,
  viewRecall,
  onMoveActor,
  onBroadcastMovePreview,
  onToggleDoor,
  onCreateDrawing,
  onDeleteDrawings,
  onClearDrawings,
  onPing,
  onPingAndRecall
}: BoardCanvasProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const initializedMapIdRef = useRef<string | null>(null);
  const skipNextPersistRef = useRef(false);
  const suppressSurfaceClickRef = useRef(false);
  const suppressContextMenuRef = useRef(false);
  const lastPreviewTargetKeyRef = useRef<string | null>(null);
  const moveActorRef = useRef(onMoveActor);
  const broadcastMovePreviewRef = useRef(onBroadcastMovePreview);
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
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
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
  const filteredTokenByActorId = useMemo(
    () => new Map(filteredTokens.map((token) => [token.actorId, token])),
    [filteredTokens]
  );

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
  const viewCenter = useMemo(
    () => ({
      x: (viewportSize.width / 2 - viewPan.x) / worldScale,
      y: (viewportSize.height / 2 - viewPan.y) / worldScale
    }),
    [viewportSize.height, viewportSize.width, viewPan.x, viewPan.y, worldScale]
  );
  const normalizedSelectionBox = selectionBox ? normalizeSelectionRect(selectionBox) : null;
  const visibleMovementPreviews = useMemo(
    () =>
      movementPreviews.filter((entry) => {
        if (!map || entry.mapId !== map.id || entry.actorId === draggingToken?.actorId) {
          return false;
        }

        return filteredTokenByActorId.has(entry.actorId);
      }),
    [draggingToken?.actorId, filteredTokenByActorId, map, movementPreviews]
  );
  const visiblePings = useMemo(
    () => pings.filter((entry) => entry.mapId === map?.id),
    [map?.id, pings]
  );

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
    moveActorRef.current = onMoveActor;
    broadcastMovePreviewRef.current = onBroadcastMovePreview;
  }, [onBroadcastMovePreview, onMoveActor]);

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

    const savedView = readBoardView(currentUserId, map.id);

    if (savedView) {
      const nextZoom = clamp(savedView.zoom, minViewZoom, maxViewZoom);
      const nextWorldScale = baseScale * nextZoom;

      setViewZoom(nextZoom);
      setViewPan(
        savedView.center
          ? {
              x: viewportSize.width / 2 - savedView.center.x * nextWorldScale,
              y: viewportSize.height / 2 - savedView.center.y * nextWorldScale
            }
          : savedView.pan
      );
    } else {
      const imageWidth = map.width * map.backgroundScale;
      const imageHeight = map.height * map.backgroundScale;

      setViewZoom(1);
      setViewPan({
        x: viewportSize.width / 2 - (map.backgroundOffsetX + imageWidth / 2) * baseScale,
        y: viewportSize.height / 2 - (map.backgroundOffsetY + imageHeight / 2) * baseScale
      });
    }

    skipNextPersistRef.current = true;
    initializedMapIdRef.current = map.id;
  }, [baseScale, currentUserId, map, viewportSize.height, viewportSize.width]);

  useEffect(() => {
    if (!map) {
      return;
    }

    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }

    if (viewportSize.width <= 0 || viewportSize.height <= 0) {
      return;
    }

    writeBoardView(currentUserId, map.id, {
      zoom: viewZoom,
      center: {
        x: (viewportSize.width / 2 - viewPan.x) / worldScale,
        y: (viewportSize.height / 2 - viewPan.y) / worldScale
      },
      pan: viewPan
    });
  }, [currentUserId, map, viewPan, viewZoom, viewportSize.height, viewportSize.width, worldScale]);

  useEffect(() => {
    if (!map || !viewRecall || role === "dm" || viewportSize.width <= 0 || viewportSize.height <= 0) {
      return;
    }

    if (viewRecall.mapId !== map.id) {
      return;
    }

    const nextZoom = clamp(viewRecall.zoom, minViewZoom, maxViewZoom);
    const nextWorldScale = baseScale * nextZoom;

    setViewZoom(nextZoom);
    setViewPan({
      x: viewportSize.width / 2 - viewRecall.center.x * nextWorldScale,
      y: viewportSize.height / 2 - viewRecall.center.y * nextWorldScale
    });
    setContextMenu(null);
  }, [baseScale, map, role, viewRecall, viewportSize.height, viewportSize.width]);

  useEffect(() => {
    setSelectedMapItems([]);
    setMovePreview(null);
    setDraggingToken(null);
    setDraftPoints([]);
    setSelectionBox(null);
    setContextMenu(null);
    lastPreviewTargetKeyRef.current = null;
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

      const trace = traceMovementPath(map, draggingToken.start, point, {
        ignoreWalls: isDungeonMaster
      });
      setMovePreview(trace);

      if (trace.steps === 0) {
        if (lastPreviewTargetKeyRef.current !== null) {
          lastPreviewTargetKeyRef.current = null;
          void broadcastMovePreviewRef.current(draggingToken.actorId, null);
        }
        return;
      }

      const snappedTarget = snapPointToGrid(map, point);
      const previewKey = `${snappedTarget.x}:${snappedTarget.y}`;

      if (lastPreviewTargetKeyRef.current === previewKey) {
        return;
      }

      lastPreviewTargetKeyRef.current = previewKey;
      void broadcastMovePreviewRef.current(draggingToken.actorId, snappedTarget);
    }

    function handleWindowPointerUp(event: PointerEvent) {
      const point = toWorldPoint(event.clientX, event.clientY);
      const trace =
        point
          ? traceMovementPath(map, draggingToken.start, point, {
              ignoreWalls: isDungeonMaster
            })
          : null;

      suppressSurfaceClickRef.current = true;
      setDraggingToken(null);
      setMovePreview(null);
      setContextMenu(null);

      if (lastPreviewTargetKeyRef.current !== null) {
        lastPreviewTargetKeyRef.current = null;
        void broadcastMovePreviewRef.current(draggingToken.actorId, null);
      }

      if (!trace || trace.steps === 0) {
        return;
      }

      void moveActorRef.current(draggingToken.actorId, trace.end.x, trace.end.y);
    }

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);

      if (lastPreviewTargetKeyRef.current !== null) {
        lastPreviewTargetKeyRef.current = null;
        void broadcastMovePreviewRef.current(draggingToken.actorId, null);
      }
    };
  }, [draggingToken, isDungeonMaster, map]);

  useEffect(() => {
    if (!panning) {
      return;
    }

    function handleWindowPointerMove(event: PointerEvent) {
      const deltaX = event.clientX - panning.clientX;
      const deltaY = event.clientY - panning.clientY;
      const movedEnough = Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3;

      if (panning.button === 2) {
        if (!movedEnough) {
          return;
        }

        suppressContextMenuRef.current = true;
      }

      setViewPan({
        x: panning.originX + deltaX,
        y: panning.originY + deltaY
      });
    }

    function handleWindowPointerUp() {
      if (
        panning.button === 2 &&
        !suppressContextMenuRef.current &&
        typeof panning.menuX === "number" &&
        typeof panning.menuY === "number" &&
        panning.menuPoint
      ) {
        setContextMenu({
          x: panning.menuX,
          y: panning.menuY,
          point: panning.menuPoint
        });
      }

      suppressContextMenuRef.current = false;
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
    onSelectedMapItemCountChange(selectedMapItems.length);
  }, [onSelectedMapItemCountChange, selectedMapItems.length]);

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
      const drawingIds = selectedMapItems.map((entry) => entry.slice("drawing:".length));

      void onDeleteDrawings(map.id, drawingIds);
      setSelectedMapItems([]);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDungeonMaster, map, onDeleteDrawings, selectedMapItems]);

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

  function updateMapItemSelection(key: SelectedMapItem, additive: boolean) {
    setSelectedMapItems((current) => {
      if (!additive) {
        return [key];
      }

      return current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key];
    });
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

    setSelectedMapItems((current) =>
      selection.additive ? Array.from(new Set([...current, ...nextSelected])) : nextSelected
    );
    suppressSurfaceClickRef.current = true;
  }

  function handleEmptyBoardClick() {
    setContextMenu(null);

    if (tool === "select") {
      setSelectedMapItems([]);
      onSelectActor(null);
    }
  }

  async function handleBoardClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (suppressSurfaceClickRef.current) {
      suppressSurfaceClickRef.current = false;
      return;
    }

    setContextMenu(null);

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

  async function handleBoardDrop(event: ReactDragEvent<HTMLDivElement>) {
    if (!map) {
      return;
    }

    event.preventDefault();
    setContextMenu(null);
    const actorId = event.dataTransfer.getData("application/x-dnd-actor-id");

    if (!actorId) {
      return;
    }

    const point = toWorldPoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    onSelectActor(actorId);
    const snapped = snapPointToGrid(map, point);
    await onMoveActor(actorId, snapped.x, snapped.y);
  }

  function handleBoardPointerDownCapture(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 1 && event.button !== 2) {
      return;
    }

    event.preventDefault();
    setContextMenu(null);
    suppressContextMenuRef.current = false;
    const menuLocalPoint = event.button === 2 ? toLocalPoint(event.clientX, event.clientY) : null;
    const menuWorldPoint = event.button === 2 ? toWorldPoint(event.clientX, event.clientY) : null;
    setPanning({
      button: event.button,
      clientX: event.clientX,
      clientY: event.clientY,
      originX: viewPan.x,
      originY: viewPan.y,
      menuX: menuLocalPoint?.x,
      menuY: menuLocalPoint?.y,
      menuPoint: menuWorldPoint ?? undefined
    });
  }

  function handleBoardPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!map || event.button !== 0) {
      return;
    }

    setContextMenu(null);

    if (isDungeonMaster && tool === "select") {
      const localPoint = toLocalPoint(event.clientX, event.clientY);

      if (!localPoint) {
        return;
      }

      setSelectionBox({
        additive: event.metaKey || event.ctrlKey || event.shiftKey,
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
      const stroke: DrawingStroke = {
        id: `drw_${crypto.randomUUID().slice(0, 8)}`,
        color: strokeColor,
        size: strokeSize,
        points
      };

      await onCreateDrawing(map.id, stroke);
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
    if (!map) {
      return;
    }

    if (!window.confirm("Clear all drawings from this map?")) {
      return;
    }

    await onClearDrawings(map.id);
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

    setContextMenu(null);
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
    setContextMenu(null);

    if (!isDungeonMaster || tool !== "select") {
      return;
    }

    updateMapItemSelection(key, event.metaKey || event.ctrlKey || event.shiftKey);
  }

  function handleDoorClick(doorId: string, event: ReactMouseEvent<SVGLineElement>) {
    event.stopPropagation();
    setContextMenu(null);

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

  function handleContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
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
          <button
            className={tool === "select" ? "is-active" : ""}
            type="button"
            title="Select"
            aria-label="Select"
            onClick={() => setTool("select")}
          >
            <MousePointer2 size={15} />
          </button>
          {isDungeonMaster && (
            <button
              className={tool === "draw" ? "is-active" : ""}
              type="button"
              title="Draw"
              aria-label="Draw"
              onClick={() => setTool("draw")}
            >
              <PencilLine size={15} />
            </button>
          )}
        </div>
        <div className="tool-meta">
          <span className="board-zoom-chip">Zoom {Math.round(viewZoom * 100)}%</span>
          {isDungeonMaster && fogPlayers.length > 0 && (
            <>
              <select value={dmFogUserId ?? ""} onChange={(event) => onSetDmFogUserId(event.target.value || null)}>
                {fogPlayers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={`icon-action-button ${dmFogEnabled ? "is-active" : ""}`}
                title={dmFogEnabled ? "Hide player fog" : "View player fog"}
                disabled={!dmFogUserId}
                onClick={() => onSetDmFogEnabled(!dmFogEnabled)}
              >
                {dmFogEnabled ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <button type="button" className="icon-action-button" title="Reset fog" onClick={() => void onResetFog()}>
                <RotateCcw size={15} />
              </button>
            </>
          )}
        </div>
      </div>
      {isDungeonMaster && tool === "draw" && (
        <div className="board-draw-controls">
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
          <button type="button" className="icon-action-button" title="Clear ink" onClick={() => void clearInk()}>
            <Trash2 size={15} />
          </button>
        </div>
      )}

      <div className="board-scroll">
        <div
          ref={boardRef}
          className="board-surface"
          onClick={(event) => {
            if (suppressSurfaceClickRef.current) {
              suppressSurfaceClickRef.current = false;
              return;
            }

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
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => void handleBoardDrop(event)}
          onContextMenu={handleContextMenu}
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
            {visibleMovementPreviews.map((entry) => {
              const token = filteredTokenByActorId.get(entry.actorId);
              const stroke = token?.color ?? "rgba(242, 187, 63, 0.82)";
              const end = worldToScreen(entry.preview.end);

              return (
                <g key={`preview:${entry.actorId}`} opacity={0.92}>
                  <path
                    d={toSvgPathWorld(entry.preview.points)}
                    className={`board-move-path board-shared-move-path ${entry.preview.blocked ? "is-blocked" : ""}`}
                    markerEnd="url(#move-arrowhead)"
                    style={{ stroke, strokeWidth: moveArrowStrokeWidth }}
                  />
                  <circle
                    cx={end.x}
                    cy={end.y}
                    r={Math.max(8, map.grid.cellSize * worldScale * 0.12)}
                    className="board-target-ring"
                    style={{ stroke }}
                  />
                </g>
              );
            })}
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
          <div className="board-ping-layer">
            {visiblePings.map((ping) => {
              const center = worldToScreen(ping.point);
              const coreSize = Math.max(20, map.grid.cellSize * worldScale * 0.28);
              const ringSize = coreSize * 4.8;
              const pingStyle = {
                left: center.x,
                top: center.y,
                "--ping-core-size": `${coreSize}px`,
                "--ping-ring-size": `${ringSize}px`
              } as CSSProperties;

              return (
                <div key={ping.id} className="board-ping" style={pingStyle}>
                  <span className="board-ping-core" />
                  <span className="board-ping-ring" />
                  <span className="board-ping-ring board-ping-ring-delay" />
                </div>
              );
            })}
          </div>
          {contextMenu && (
            <div
              className="board-context-menu"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  void onPing(contextMenu.point);
                  setContextMenu(null);
                }}
              >
                Ping here
              </button>
              {isDungeonMaster && (
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => {
                    void onPingAndRecall(contextMenu.point, viewCenter, viewZoom);
                    setContextMenu(null);
                  }}
                >
                  Ping and recall here
                </button>
              )}
            </div>
          )}
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

function boardViewStorageKey(userId: string, mapId: string) {
  return `${boardViewStorageKeyPrefix}:${userId}:${mapId}`;
}

function readBoardView(userId: string, mapId: string) {
  const value = readJson<{
    zoom?: unknown;
    center?: { x?: unknown; y?: unknown };
    pan?: { x?: unknown; y?: unknown };
  }>(boardViewStorageKey(userId, mapId));

  const hasCenter =
    value &&
    value.center &&
    typeof value.center.x === "number" &&
    typeof value.center.y === "number";
  const hasPan = value && value.pan && typeof value.pan.x === "number" && typeof value.pan.y === "number";

  if (!value || typeof value.zoom !== "number" || (!hasCenter && !hasPan)) {
    return null;
  }

  return {
    zoom: value.zoom,
    center: hasCenter
      ? {
          x: value.center!.x as number,
          y: value.center!.y as number
        }
      : undefined,
    pan: hasPan
      ? {
          x: value.pan!.x as number,
          y: value.pan!.y as number
        }
      : { x: 0, y: 0 }
  };
}

function writeBoardView(userId: string, mapId: string, value: { zoom: number; center: Point; pan: Point }) {
  writeJson(boardViewStorageKey(userId, mapId), value);
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
