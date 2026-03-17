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
import {
  Circle,
  Eye,
  EyeOff,
  MousePointer2,
  PencilLine,
  RectangleHorizontal,
  RotateCcw,
  Ruler,
  Square,
  Star,
  Trash2,
  Triangle
} from "lucide-react";

import type {
  ActorSheet,
  BoardToken,
  CampaignMap,
  DrawingKind,
  DrawingStroke,
  MapPing,
  MapViewportRecall,
  MeasureKind,
  MeasurePreview,
  MeasureSnapMode,
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
  snapPointToGridIntersection,
  tokenCellKey,
  traceMovementPath,
  type MovementTrace
} from "@shared/vision";
import { readJson, writeJson } from "../lib/storage";

type Tool = "select" | "draw" | "measure";
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
  measurePreviews: Array<{ userId: string; mapId: string; preview: MeasurePreview }>;
  pings: MapPing[];
  viewRecall: MapViewportRecall | null;
  onMoveActor: (actorId: string, x: number, y: number) => Promise<void>;
  onBroadcastMovePreview: (actorId: string, target: Point | null) => Promise<void>;
  onBroadcastMeasurePreview: (preview: MeasurePreview | null) => Promise<void>;
  onToggleDoor: (doorId: string) => Promise<void>;
  onCreateDrawing: (mapId: string, stroke: DrawingStroke) => Promise<void>;
  onUpdateDrawings: (
    mapId: string,
    drawings: Array<{
      id: string;
      points: Point[];
      rotation: number;
    }>
  ) => Promise<void>;
  onDeleteDrawings: (mapId: string, drawingIds: string[]) => Promise<void>;
  onClearDrawings: (mapId: string) => Promise<void>;
  onPing: (point: Point) => Promise<void>;
  onPingAndRecall: (point: Point, center: Point, zoom: number) => Promise<void>;
}

interface DragState {
  actorId: string;
  start: Point;
}

interface DrawingDraftState {
  color: string;
  fillColor: string;
  fillOpacity: number;
  kind: DrawingKind;
  points: Point[];
  rotation: number;
  size: number;
  strokeOpacity: number;
}

interface DrawingMoveState {
  drawingIds: string[];
  moved: boolean;
  origin: Point;
  snapshots: Record<string, { points: Point[]; rotation: number }>;
}

interface DrawingRotationState {
  drawingId: string;
  baseRotation: number;
  center: Point;
  moved: boolean;
  points: Point[];
  startAngle: number;
}

interface MeasuringState {
  rawStart: Point;
  rawEnd: Point;
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
  measurePreviews,
  pings,
  viewRecall,
  onMoveActor,
  onBroadcastMovePreview,
  onBroadcastMeasurePreview,
  onToggleDoor,
  onCreateDrawing,
  onUpdateDrawings,
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
  const lastMeasurePreviewKeyRef = useRef<string | null>(null);
  const moveActorRef = useRef(onMoveActor);
  const broadcastMovePreviewRef = useRef(onBroadcastMovePreview);
  const broadcastMeasurePreviewRef = useRef(onBroadcastMeasurePreview);
  const updateDrawingsRef = useRef(onUpdateDrawings);
  const drawingOverridesRef = useRef<Record<string, { points: Point[]; rotation: number }>>({});
  const [tool, setTool] = useState<Tool>("select");
  const [drawKind, setDrawKind] = useState<DrawingKind>("freehand");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeOpacity, setStrokeOpacity] = useState(1);
  const [fillColor, setFillColor] = useState("#000000");
  const [fillOpacity, setFillOpacity] = useState(0);
  const [strokeSize, setStrokeSize] = useState(4);
  const [measureKind, setMeasureKind] = useState<MeasureKind>("line");
  const [measureSnapMode, setMeasureSnapMode] = useState<MeasureSnapMode>("center");
  const [measureBroadcast, setMeasureBroadcast] = useState(true);
  const [coneAngle, setConeAngle] = useState<45 | 60 | 90>(60);
  const [beamWidthSquares, setBeamWidthSquares] = useState(1);
  const [draftDrawing, setDraftDrawing] = useState<DrawingDraftState | null>(null);
  const [measuring, setMeasuring] = useState<MeasuringState | null>(null);
  const [movePreview, setMovePreview] = useState<MovementTrace | null>(null);
  const [draggingToken, setDraggingToken] = useState<DragState | null>(null);
  const [movingDrawings, setMovingDrawings] = useState<DrawingMoveState | null>(null);
  const [rotatingDrawing, setRotatingDrawing] = useState<DrawingRotationState | null>(null);
  const [drawingOverrides, setDrawingOverrides] = useState<Record<string, { points: Point[]; rotation: number }>>({});
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
  const playerUserIdSet = useMemo(() => new Set(fogPlayers.map((member) => member.userId)), [fogPlayers]);
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
  const orderedTokens = useMemo(() => {
    return filteredTokens
      .map((token, index) => ({
        token,
        index,
        priority:
          token.actorId === selectedActor?.id
            ? 2
            : (() => {
                const actor = actorById.get(token.actorId);
                return actor && canControlActor(actor) ? 1 : 0;
              })()
      }))
      .sort((left, right) => (left.priority === right.priority ? left.index - right.index : left.priority - right.priority))
      .map((entry) => entry.token);
  }, [actorById, filteredTokens, selectedActor?.id]);

  const discoveredDrawingIds = useMemo(() => {
    if (!map) {
      return new Set<string>();
    }

    const memoryKey = `${map.id}:${map.visibilityVersion}`;
    return new Set(discoveredDrawingsByViewer[discoveryViewerKey]?.[memoryKey] ?? []);
  }, [discoveredDrawingsByViewer, discoveryViewerKey, map]);

  const displayDrawings = useMemo(() => {
    if (!map) {
      return [] as DrawingStroke[];
    }

    return map.drawings.map((drawing) =>
      drawingOverrides[drawing.id]
        ? {
            ...drawing,
            points: drawingOverrides[drawing.id].points,
            rotation: drawingOverrides[drawing.id].rotation
          }
        : drawing
    );
  }, [drawingOverrides, map]);

  const drawingBuckets = useMemo(() => {
    if (!map) {
      return { underFog: [] as DrawingStroke[], overFog: [] as DrawingStroke[], memory: [] as DrawingStroke[] };
    }

    if (!usesRestrictedVision) {
      return {
        underFog: displayDrawings,
        overFog: [] as DrawingStroke[],
        memory: [] as DrawingStroke[]
      };
    }

    const underFog: DrawingStroke[] = [];
    const overFog: DrawingStroke[] = [];
    const memory: DrawingStroke[] = [];

    for (const stroke of displayDrawings) {
      if (stroke.ownerId && playerUserIdSet.has(stroke.ownerId)) {
        overFog.push(stroke);
        continue;
      }

      const visible = getDrawingVisibilityPoints(stroke).some((point) => isPointCurrentlyVisible(map, currentVisibleCells, point));

      if (visible) {
        underFog.push(stroke);
        continue;
      }

      if (discoveredDrawingIds.has(stroke.id)) {
        memory.push(stroke);
      }
    }

    return { underFog, overFog, memory };
  }, [currentVisibleCells, discoveredDrawingIds, displayDrawings, map, playerUserIdSet, usesRestrictedVision]);

  const selectableDrawings = useMemo(() => {
    const seen = new Set<string>();
    const entries = [...drawingBuckets.underFog, ...drawingBuckets.overFog, ...drawingBuckets.memory];
    return entries.filter((drawing) => {
      if (seen.has(drawing.id)) {
        return false;
      }

      seen.add(drawing.id);
      return canEditDrawing(drawing);
    });
  }, [currentUserId, drawingBuckets.memory, drawingBuckets.overFog, drawingBuckets.underFog, isDungeonMaster]);

  const selectedDrawings = useMemo(() => {
    const selectedIds = new Set(selectedMapItems.map((entry) => entry.slice("drawing:".length)));
    return selectableDrawings.filter((drawing) => selectedIds.has(drawing.id));
  }, [selectableDrawings, selectedMapItems]);

  const selectedDrawing = selectedDrawings.length === 1 ? selectedDrawings[0] : null;

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
  const localMeasurePreview = useMemo(() => {
    if (!map || !measuring) {
      return null;
    }

    return buildMeasurePreview(
      map,
      measuring.rawStart,
      measuring.rawEnd,
      measureKind,
      measureSnapMode,
      coneAngle,
      beamWidthSquares
    );
  }, [beamWidthSquares, coneAngle, map, measureKind, measureSnapMode, measuring]);

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
  const visibleMeasurePreviews = useMemo(
    () =>
      measurePreviews.filter((entry) => {
        if (!map || entry.mapId !== map.id) {
          return false;
        }

        return entry.userId !== currentUserId;
      }),
    [currentUserId, map, measurePreviews]
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
    broadcastMeasurePreviewRef.current = onBroadcastMeasurePreview;
    updateDrawingsRef.current = onUpdateDrawings;
  }, [onBroadcastMeasurePreview, onBroadcastMovePreview, onMoveActor, onUpdateDrawings]);

  useEffect(() => {
    drawingOverridesRef.current = drawingOverrides;
  }, [drawingOverrides]);

  useEffect(() => {
    if (!map || Object.keys(drawingOverrides).length === 0) {
      return;
    }

    setDrawingOverrides((current) => {
      let changed = false;
      const next = { ...current };

      for (const [drawingId, override] of Object.entries(current)) {
        const persisted = map.drawings.find((entry) => entry.id === drawingId);

        if (!persisted || drawingMatchesOverride(persisted, override)) {
          delete next[drawingId];
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [drawingOverrides, map]);

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
    setDraftDrawing(null);
    setMovingDrawings(null);
    setRotatingDrawing(null);
    setDrawingOverrides({});
    setSelectionBox(null);
    setContextMenu(null);
    setMeasuring(null);
    lastPreviewTargetKeyRef.current = null;
  }, [map?.id]);

  useEffect(() => {
    if (tool !== "measure") {
      setMeasuring(null);
    }
  }, [tool]);

  useEffect(() => {
    if (!map || !usesRestrictedVision) {
      return;
    }

    setDiscoveredDrawingsByViewer((current) => {
      const viewerMemory = current[discoveryViewerKey] ?? {};
      const memoryKey = `${map.id}:${map.visibilityVersion}`;
      const currentMapEntries = viewerMemory[memoryKey] ?? [];
      const nextIds = new Set(currentMapEntries.filter((id) => displayDrawings.some((stroke) => stroke.id === id)));
      let changed = nextIds.size !== currentMapEntries.length;

      for (const stroke of displayDrawings) {
        if (!getDrawingVisibilityPoints(stroke).some((point) => isPointCurrentlyVisible(map, currentVisibleCells, point))) {
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
  }, [currentVisibleCells, discoveryViewerKey, displayDrawings, map, usesRestrictedVision]);

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
    if (!measuring || !map) {
      return;
    }

    function handleWindowPointerMove(event: PointerEvent) {
      const point = toWorldPoint(event.clientX, event.clientY);

      if (!point) {
        return;
      }

      setMeasuring((current) => (current ? { ...current, rawEnd: point } : current));
    }

    function handleWindowPointerUp() {
      setMeasuring(null);
    }

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
    };
  }, [map, measuring]);

  useEffect(() => {
    const nextPreview = measureBroadcast ? localMeasurePreview : null;
    const nextKey = nextPreview ? serializeMeasurePreview(nextPreview) : null;

    if (nextKey === lastMeasurePreviewKeyRef.current) {
      return;
    }

    lastMeasurePreviewKeyRef.current = nextKey;
    void broadcastMeasurePreviewRef.current(nextPreview);
  }, [localMeasurePreview, measureBroadcast]);

  useEffect(
    () => () => {
      if (lastMeasurePreviewKeyRef.current !== null) {
        void broadcastMeasurePreviewRef.current(null);
      }
    },
    []
  );

  useEffect(() => {
    if (!movingDrawings || !map) {
      return;
    }

    function handleWindowPointerMove(event: PointerEvent) {
      const point = toWorldPoint(event.clientX, event.clientY);

      if (!point) {
        return;
      }

      const deltaX = point.x - movingDrawings.origin.x;
      const deltaY = point.y - movingDrawings.origin.y;
      const moved = Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5;

      setMovingDrawings((current) => (current ? { ...current, moved: current.moved || moved } : current));
      setDrawingOverrides(
        Object.fromEntries(
          movingDrawings.drawingIds.map((drawingId) => {
            const snapshot = movingDrawings.snapshots[drawingId];
            return [
              drawingId,
              {
                points: snapshot.points.map((entry) => ({ x: entry.x + deltaX, y: entry.y + deltaY })),
                rotation: snapshot.rotation
              }
            ];
          })
        )
      );
    }

    function handleWindowPointerUp() {
      const overrides = Object.entries(drawingOverridesRef.current)
        .filter(([drawingId]) => movingDrawings.drawingIds.includes(drawingId))
        .map(([id, value]) => ({
          id,
          points: value.points,
          rotation: value.rotation
        }));

      const moved = overrides.some((override) => {
        const snapshot = movingDrawings.snapshots[override.id];
        return (
          snapshot &&
          (snapshot.rotation !== override.rotation ||
            snapshot.points.length !== override.points.length ||
            snapshot.points.some((point, index) => {
              const next = override.points[index];
              return !next || Math.abs(point.x - next.x) > 0.001 || Math.abs(point.y - next.y) > 0.001;
            }))
        );
      });

      if (moved && overrides.length > 0) {
        void updateDrawingsRef.current(map.id, overrides);
      } else {
        setDrawingOverrides((current) =>
          Object.fromEntries(Object.entries(current).filter(([drawingId]) => !movingDrawings.drawingIds.includes(drawingId)))
        );
      }
      setMovingDrawings(null);
    }

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
    };
  }, [map, movingDrawings]);

  useEffect(() => {
    if (!rotatingDrawing || !map) {
      return;
    }

    function handleWindowPointerMove(event: PointerEvent) {
      const point = toWorldPoint(event.clientX, event.clientY);

      if (!point) {
        return;
      }

      const angle = Math.atan2(point.y - rotatingDrawing.center.y, point.x - rotatingDrawing.center.x);
      const nextRotation = rotatingDrawing.baseRotation + toDegrees(angle - rotatingDrawing.startAngle);
      const moved = Math.abs(nextRotation - rotatingDrawing.baseRotation) > 0.5;

      setRotatingDrawing((current) => (current ? { ...current, moved: current.moved || moved } : current));
      setDrawingOverrides((current) => ({
        ...current,
        [rotatingDrawing.drawingId]: {
          points: rotatingDrawing.points,
          rotation: normalizeDegrees(nextRotation)
        }
      }));
    }

    function handleWindowPointerUp() {
      const override = drawingOverridesRef.current[rotatingDrawing.drawingId];

      if (override && Math.abs(override.rotation - rotatingDrawing.baseRotation) > 0.5) {
        void updateDrawingsRef.current(map.id, [
          {
            id: rotatingDrawing.drawingId,
            points: override.points,
            rotation: override.rotation
          }
        ]);
      } else {
        setDrawingOverrides((current) => {
          const next = { ...current };
          delete next[rotatingDrawing.drawingId];
          return next;
        });
      }
      setRotatingDrawing(null);
    }

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
    };
  }, [map, rotatingDrawing]);

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
    if (!panning) {
      return;
    }

    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "grabbing";

    return () => {
      document.body.style.cursor = previousCursor;
    };
  }, [panning]);

  useEffect(() => {
    onSelectedMapItemCountChange(selectedMapItems.length);
  }, [onSelectedMapItemCountChange, selectedMapItems.length]);

  useEffect(() => {
    if (selectedMapItems.length === 0 || !map) {
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
  }, [map, onDeleteDrawings, selectedMapItems]);

  function canControlActor(actor: ActorSheet) {
    return role === "dm" || (actor.kind === "character" && actor.ownerId === currentUserId);
  }

  function canEditDrawing(drawing: DrawingStroke) {
    return isDungeonMaster || drawing.ownerId === currentUserId;
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

    const nextSelected = selectableDrawings
      .filter((drawing) => pathBoundsIntersectsRect(getDrawingRenderPoints(drawing).map(worldToScreen), rect))
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

  function beginMeasure(point: Point) {
    setContextMenu(null);
    setMeasuring({
      rawStart: point,
      rawEnd: point
    });
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

    if (tool === "select") {
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

    if (tool === "measure") {
      const point = toWorldPoint(event.clientX, event.clientY);

      if (!point) {
        return;
      }

      beginMeasure(point);
      return;
    }

    if (tool !== "draw") {
      return;
    }

    const point = toWorldPoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    setDraftDrawing({
      color: strokeColor,
      strokeOpacity,
      fillColor,
      fillOpacity,
      kind: drawKind,
      points: [point],
      rotation: 0,
      size: strokeSize
    });
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

    if (tool === "draw" && draftDrawing) {
      setDraftDrawing((current) => {
        if (!current) {
          return current;
        }

        if (current.kind !== "freehand") {
          return {
            ...current,
            points: [current.points[0] ?? point, point]
          };
        }

        const previous = current.points[current.points.length - 1];

        if (!previous) {
          return {
            ...current,
            points: [point]
          };
        }

        return Math.hypot(point.x - previous.x, point.y - previous.y) < 4
          ? current
          : {
              ...current,
              points: [...current.points, point]
            };
      });
    }
  }

  async function handleBoardPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (selectionBox) {
      selectDrawingsInBox(selectionBox);
      setSelectionBox(null);
      return;
    }

    if (!map || tool !== "draw" || !draftDrawing) {
      return;
    }

    const point = toWorldPoint(event.clientX, event.clientY);
    const points =
      draftDrawing.kind === "freehand"
        ? point && draftDrawing.points[draftDrawing.points.length - 1] !== point
          ? [...draftDrawing.points, point]
          : draftDrawing.points
        : draftDrawing.points.length === 1
          ? [draftDrawing.points[0], point ?? draftDrawing.points[0]]
          : draftDrawing.points;

    const stroke: DrawingStroke = {
      id: `drw_${crypto.randomUUID().slice(0, 8)}`,
      ownerId: currentUserId,
      kind: draftDrawing.kind,
      color: draftDrawing.color,
      strokeOpacity: draftDrawing.strokeOpacity,
      fillColor: draftDrawing.fillColor,
      fillOpacity: draftDrawing.fillOpacity,
      size: draftDrawing.size,
      rotation: draftDrawing.rotation,
      points
    };

    if (drawingHasRenderableSpan(stroke)) {
      await onCreateDrawing(map.id, stroke);
    }

    setDraftDrawing(null);
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

  function handleDrawingPointerDown(drawing: DrawingStroke, event: ReactPointerEvent<SVGPathElement>) {
    if (event.button !== 0 || tool !== "select" || !map || !canEditDrawing(drawing)) {
      return;
    }

    event.stopPropagation();
    setContextMenu(null);
    onSelectActor(null);
    const additive = event.metaKey || event.ctrlKey || event.shiftKey;
    const key = `drawing:${drawing.id}` satisfies SelectedMapItem;

    if (additive) {
      updateMapItemSelection(key, true);
      return;
    }

    setSelectedMapItems((current) => (current.includes(key) ? current : [key]));
    const point = toWorldPoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    const ids = selectedMapItems.includes(key)
      ? selectedMapItems.map((entry) => entry.slice("drawing:".length))
      : [drawing.id];
    const snapshots = Object.fromEntries(
      selectableDrawings
        .filter((entry) => ids.includes(entry.id))
        .map((entry) => [entry.id, { points: entry.points.map((pointEntry) => ({ ...pointEntry })), rotation: entry.rotation }])
    );

    setMovingDrawings({
      drawingIds: ids,
      moved: false,
      origin: point,
      snapshots
    });
    suppressSurfaceClickRef.current = true;
  }

  function handleRotateHandlePointerDown(event: ReactPointerEvent<Element>) {
    if (!selectedDrawing || event.button !== 0 || !canEditDrawing(selectedDrawing)) {
      return;
    }

    event.stopPropagation();
    const point = toWorldPoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    const center = getDrawingCenter(selectedDrawing);
    setRotatingDrawing({
      drawingId: selectedDrawing.id,
      baseRotation: selectedDrawing.rotation,
      center,
      moved: false,
      points: selectedDrawing.points.map((entry) => ({ ...entry })),
      startAngle: Math.atan2(point.y - center.y, point.x - center.x)
    });
    suppressSurfaceClickRef.current = true;
  }

  function handleTokenPointerDown(token: BoardToken, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    setContextMenu(null);

    if (tool === "measure") {
      beginMeasure({ x: token.x, y: token.y });
      return;
    }

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

  function renderMeasure(preview: MeasurePreview, key: string, palette: MeasurePalette, shared = false) {
    if (!map) {
      return null;
    }

    const geometry = getMeasureGeometry(map, preview);
    const path = pointsToSvgPath(geometry.points.map(worldToScreen), geometry.closed);
    const labelPoint = worldToScreen(geometry.labelPoint);
    const startPoint = worldToScreen(preview.start);
    const endPoint = worldToScreen(preview.end);
    const anchorRadius = clamp(5 * worldScale, 4, 10);
    const strokeWidth = clamp((preview.kind === "line" ? 3 : 2.5) * worldScale, 2, 8);
    const labelFontSize = clamp(13 * worldScale, 12, 24);

    return (
      <g key={key} opacity={shared ? 0.94 : 1}>
        {geometry.closed && <path d={path} fill={palette.fill} stroke="none" />}
        <path
          d={path}
          fill="none"
          stroke={palette.stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={shared ? "14 10" : "12 8"}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={shared ? "board-shared-measure-path" : "board-measure-path"}
        />
        <circle cx={startPoint.x} cy={startPoint.y} r={anchorRadius} fill={palette.stroke} className="board-measure-anchor" />
        <circle
          cx={endPoint.x}
          cy={endPoint.y}
          r={Math.max(anchorRadius - 1, 3)}
          fill={palette.endFill}
          stroke={palette.stroke}
          strokeWidth={Math.max(1.5, strokeWidth * 0.45)}
        />
        <text
          x={labelPoint.x}
          y={labelPoint.y}
          className="board-measure-label"
          style={{ fill: palette.stroke, fontSize: `${labelFontSize}px` }}
        >
          {geometry.label}
        </text>
      </g>
    );
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
          <button
            className={tool === "draw" ? "is-active" : ""}
            type="button"
            title="Draw"
            aria-label="Draw"
            onClick={() => setTool("draw")}
          >
            <PencilLine size={15} />
          </button>
          <button
            className={tool === "measure" ? "is-active" : ""}
            type="button"
            title="Measure"
            aria-label="Measure"
            onClick={() => setTool("measure")}
          >
            <Ruler size={15} />
          </button>
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
      {tool === "measure" && (
        <div className="board-measure-controls">
          <div className="segmented board-measure-kind-picker">
            <button
              type="button"
              className={measureKind === "line" ? "is-active" : ""}
              title="Line"
              aria-label="Line"
              onClick={() => setMeasureKind("line")}
            >
              <Ruler size={14} />
            </button>
            <button
              type="button"
              className={measureKind === "cone" ? "is-active" : ""}
              title="Cone"
              aria-label="Cone"
              onClick={() => setMeasureKind("cone")}
            >
              <Triangle size={14} />
            </button>
            <button
              type="button"
              className={measureKind === "beam" ? "is-active" : ""}
              title="Beam"
              aria-label="Beam"
              onClick={() => setMeasureKind("beam")}
            >
              <RectangleHorizontal size={14} />
            </button>
            <button
              type="button"
              className={measureKind === "emanation" ? "is-active" : ""}
              title="Emanation"
              aria-label="Emanation"
              onClick={() => setMeasureKind("emanation")}
            >
              <Circle size={14} />
            </button>
            <button
              type="button"
              className={measureKind === "square" ? "is-active" : ""}
              title="Square"
              aria-label="Square"
              onClick={() => setMeasureKind("square")}
            >
              <Square size={14} />
            </button>
          </div>
          <label>
            Snap
            <select value={measureSnapMode} onChange={(event) => setMeasureSnapMode(event.target.value as MeasureSnapMode)}>
              <option value="center">Center</option>
              <option value="corner">Corner</option>
              <option value="none">Free</option>
            </select>
          </label>
          {measureKind === "cone" && (
            <label>
              Angle
              <select
                value={coneAngle}
                onChange={(event) => setConeAngle(Number(event.target.value) as 45 | 60 | 90)}
              >
                <option value="45">45°</option>
                <option value="60">60°</option>
                <option value="90">90°</option>
              </select>
            </label>
          )}
          {measureKind === "beam" && (
            <label>
              Width
              <input
                type="range"
                min="1"
                max="8"
                value={beamWidthSquares}
                onChange={(event) => setBeamWidthSquares(Number(event.target.value))}
              />
              <span>{beamWidthSquares} sq</span>
            </label>
          )}
          <label className="board-inline-toggle">
            <input
              type="checkbox"
              checked={measureBroadcast}
              onChange={(event) => setMeasureBroadcast(event.target.checked)}
            />
            Broadcast
          </label>
        </div>
      )}
      {tool === "draw" && (
        <div className="board-draw-controls">
          <div className="segmented board-shape-picker">
            <button
              type="button"
              className={drawKind === "freehand" ? "is-active" : ""}
              title="Freehand"
              onClick={() => setDrawKind("freehand")}
            >
              <PencilLine size={14} />
            </button>
            <button
              type="button"
              className={drawKind === "circle" ? "is-active" : ""}
              title="Circle"
              onClick={() => setDrawKind("circle")}
            >
              <Circle size={14} />
            </button>
            <button
              type="button"
              className={drawKind === "square" ? "is-active" : ""}
              title="Square"
              onClick={() => setDrawKind("square")}
            >
              <Square size={14} />
            </button>
            <button
              type="button"
              className={drawKind === "star" ? "is-active" : ""}
              title="Star"
              onClick={() => setDrawKind("star")}
            >
              <Star size={14} />
            </button>
          </div>
          <label>
            Stroke
            <input type="color" value={strokeColor} onChange={(event) => setStrokeColor(event.target.value)} />
          </label>
          <label>
            Stroke {Math.round(strokeOpacity * 100)}%
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(strokeOpacity * 100)}
              onChange={(event) => setStrokeOpacity(Number(event.target.value) / 100)}
            />
          </label>
          <label>
            Fill
            <input type="color" value={fillColor} onChange={(event) => setFillColor(event.target.value)} />
          </label>
          <label>
            Fill {Math.round(fillOpacity * 100)}%
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(fillOpacity * 100)}
              onChange={(event) => setFillOpacity(Number(event.target.value) / 100)}
            />
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
          {isDungeonMaster && (
            <button type="button" className="icon-action-button" title="Clear ink" onClick={() => void clearInk()}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )}

      <div className="board-scroll">
        <div
          ref={boardRef}
          className={`board-surface ${panning ? "is-panning" : ""}`}
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

            {drawingBuckets.underFog.map((stroke) => (
              <g key={stroke.id}>
                {shouldFillDrawing(stroke) && (
                  <path
                    d={getDrawingFillPath(stroke, worldToScreen)}
                    fill={stroke.fillColor || "none"}
                    fillOpacity={stroke.fillOpacity}
                  />
                )}
                <path
                  d={getDrawingStrokePath(stroke, worldToScreen)}
                  fill="none"
                  stroke={stroke.color}
                  strokeOpacity={stroke.strokeOpacity}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={stroke.size * worldScale}
                  className={selectedMapItems.includes(`drawing:${stroke.id}`) ? "board-drawing-selected" : undefined}
                />
              </g>
            ))}
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
              <g key={stroke.id}>
                {shouldFillDrawing(stroke) && (
                  <path
                    d={getDrawingFillPath(stroke, worldToScreen)}
                    fill={stroke.fillColor || "none"}
                    fillOpacity={stroke.fillOpacity * 0.72}
                  />
                )}
                <path
                  d={getDrawingStrokePath(stroke, worldToScreen)}
                  fill="none"
                  stroke={stroke.color}
                  strokeOpacity={stroke.strokeOpacity * 0.82}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={stroke.size * worldScale}
                  className={selectedMapItems.includes(`drawing:${stroke.id}`) ? "board-drawing-selected" : undefined}
                />
              </g>
            ))}
            {drawingBuckets.overFog.map((stroke) => (
              <g key={stroke.id}>
                {shouldFillDrawing(stroke) && (
                  <path
                    d={getDrawingFillPath(stroke, worldToScreen)}
                    fill={stroke.fillColor || "none"}
                    fillOpacity={stroke.fillOpacity}
                  />
                )}
                <path
                  d={getDrawingStrokePath(stroke, worldToScreen)}
                  fill="none"
                  stroke={stroke.color}
                  strokeOpacity={stroke.strokeOpacity}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={stroke.size * worldScale}
                  className={selectedMapItems.includes(`drawing:${stroke.id}`) ? "board-drawing-selected" : undefined}
                />
              </g>
            ))}
            {draftDrawing && drawingHasRenderableSpan({ ...draftDrawing, id: "draft" }) && (
              <g>
                {shouldFillDrawing(draftDrawing) && (
                  <path
                    d={getDrawingFillPath({ ...draftDrawing, id: "draft" }, worldToScreen)}
                    fill={draftDrawing.fillColor || "none"}
                    fillOpacity={draftDrawing.fillOpacity}
                  />
                )}
                <path
                  d={getDrawingStrokePath({ ...draftDrawing, id: "draft" }, worldToScreen)}
                  fill="none"
                  stroke={draftDrawing.color}
                  strokeOpacity={draftDrawing.strokeOpacity}
                  strokeDasharray="10 8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={draftDrawing.size * worldScale}
                />
              </g>
            )}
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
            {localMeasurePreview && renderMeasure(localMeasurePreview, "measure:local", localMeasurePalette)}
            {visibleMeasurePreviews.map((entry) =>
              renderMeasure(
                entry.preview,
                `measure:${entry.userId}`,
                getSharedMeasurePalette(entry.userId),
                true
              )
            )}
          </svg>

          {((tool === "select" && selectableDrawings.length > 0) || visibleObstacles.some((wall) => wall.kind === "door")) && (
            <svg className="board-interaction-layer" width={viewportSize.width} height={viewportSize.height} viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}>
              {tool === "select" &&
                selectableDrawings.map((stroke) => (
                  <path
                    key={stroke.id}
                    d={getDrawingHitPath(stroke, worldToScreen)}
                    className={`board-select-hit ${stroke.kind !== "freehand" || shouldFillDrawing(stroke) ? "is-shape" : ""}`}
                    strokeWidth={Math.max(14, stroke.size * worldScale + 10)}
                    onPointerDown={(event) => handleDrawingPointerDown(stroke, event)}
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

          {tool === "select" && selectedDrawing && canEditDrawing(selectedDrawing) && (() => {
            const handlePoint = getDrawingRotationHandlePoint(selectedDrawing);
            const screen = worldToScreen(handlePoint);
            const handleSize = Math.max(16, 16 * worldScale);

            return (
              <button
                type="button"
                className="board-rotate-handle"
                style={{
                  left: screen.x,
                  top: screen.y,
                  width: handleSize,
                  height: handleSize
                }}
                onPointerDown={handleRotateHandlePointerDown}
              />
            );
          })()}

          <div className="board-token-layer" style={tokenLayerStyle}>
            {orderedTokens.map((token) => {
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
              ? `${selectedMapItems.length} drawing${selectedMapItems.length === 1 ? "" : "s"} selected. Drag to move them, or press Delete to remove them.`
              : "Click a token to select a character, drag a token to move it, click a nearby visible door to open or close it, use middle or right drag to pan, and use the mouse wheel to zoom.")}
        {tool === "draw" &&
          "Choose freehand, circle, square, or star, then drag to preview and release to draw. Middle or right drag still pans the infinite board."}
        {tool === "measure" &&
          "Drag to measure line, cone, beam, emanation, or square templates. Change snapping and enable Broadcast to share the live template with everyone else."}
      </p>
    </section>
  );
}

interface MeasurePalette {
  endFill: string;
  fill: string;
  stroke: string;
}

const localMeasurePalette: MeasurePalette = {
  stroke: "rgba(242, 187, 63, 0.96)",
  fill: "rgba(242, 187, 63, 0.16)",
  endFill: "rgba(18, 21, 26, 0.92)"
};

function buildMeasurePreview(
  map: CampaignMap,
  rawStart: Point,
  rawEnd: Point,
  kind: MeasureKind,
  snapMode: MeasureSnapMode,
  coneAngle: 45 | 60 | 90,
  beamWidthSquares: number
): MeasurePreview {
  return {
    kind,
    start: snapMeasurePoint(map, rawStart, snapMode),
    end: snapMeasurePoint(map, rawEnd, snapMode),
    snapMode,
    coneAngle,
    beamWidthSquares: Math.max(1, Math.round(beamWidthSquares))
  };
}

function snapMeasurePoint(map: CampaignMap, point: Point, snapMode: MeasureSnapMode) {
  if (snapMode === "center") {
    return snapPointToGrid(map, point);
  }

  if (snapMode === "corner") {
    return snapPointToGridIntersection(map, point);
  }

  return point;
}

function serializeMeasurePreview(preview: MeasurePreview) {
  return [
    preview.kind,
    preview.snapMode,
    preview.coneAngle,
    preview.beamWidthSquares,
    preview.start.x.toFixed(2),
    preview.start.y.toFixed(2),
    preview.end.x.toFixed(2),
    preview.end.y.toFixed(2)
  ].join(":");
}

function getSharedMeasurePalette(userId: string): MeasurePalette {
  const hue = hashString(userId) % 360;
  return {
    stroke: `hsl(${hue} 88% 72% / 0.96)`,
    fill: `hsl(${hue} 88% 72% / 0.14)`,
    endFill: "rgba(18, 21, 26, 0.9)"
  };
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function getMeasureGeometry(map: CampaignMap, preview: MeasurePreview) {
  const dx = preview.end.x - preview.start.x;
  const dy = preview.end.y - preview.start.y;
  const distance = Math.hypot(dx, dy);
  const distanceSquares = getMeasureDistanceSquares(map, preview);

  if (preview.kind === "line") {
    return {
      points: [preview.start, preview.end],
      closed: false,
      label: `${formatSquares(distanceSquares)} sq`,
      labelPoint: midpoint(preview.start, preview.end)
    };
  }

  if (preview.kind === "beam") {
    return {
      points: getBeamPolygon(preview.start, preview.end, preview.beamWidthSquares * map.grid.cellSize),
      closed: true,
      label: `${formatSquares(distanceSquares)} x ${preview.beamWidthSquares} sq`,
      labelPoint: midpoint(preview.start, preview.end)
    };
  }

  if (preview.kind === "cone") {
    const angle = Math.atan2(dy, dx);
    const labelDistance = distance * 0.66;
    return {
      points: getConePolygon(preview.start, preview.end, preview.coneAngle),
      closed: true,
      label: `${formatSquares(distanceSquares)} sq - ${preview.coneAngle} deg`,
      labelPoint: {
        x: preview.start.x + Math.cos(angle) * labelDistance,
        y: preview.start.y + Math.sin(angle) * labelDistance
      }
    };
  }

  if (preview.kind === "square") {
    const halfSide = Math.max(Math.abs(dx), Math.abs(dy));
    return {
      points: getCenteredSquarePolygon(preview.start, halfSide),
      closed: true,
      label: `${formatSquares((halfSide * 2) / map.grid.cellSize)} sq side`,
      labelPoint: {
        x: preview.start.x,
        y: preview.start.y - halfSide * 0.72
      }
    };
  }

  const radius = distance;
  return {
    points: getCirclePolygon(preview.start, radius),
    closed: true,
    label: `${formatSquares(distanceSquares)} sq rad`,
    labelPoint: {
      x: preview.start.x + Math.cos(-Math.PI / 4) * radius * 0.72,
      y: preview.start.y + Math.sin(-Math.PI / 4) * radius * 0.72
    }
  };
}

function midpoint(start: Point, end: Point) {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2
  };
}

function getBeamPolygon(start: Point, end: Point, width: number) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.max(Math.hypot(deltaX, deltaY), 0.001);
  const offsetX = (-deltaY / length) * (width / 2);
  const offsetY = (deltaX / length) * (width / 2);

  return [
    { x: start.x + offsetX, y: start.y + offsetY },
    { x: end.x + offsetX, y: end.y + offsetY },
    { x: end.x - offsetX, y: end.y - offsetY },
    { x: start.x - offsetX, y: start.y - offsetY }
  ];
}

function getConePolygon(start: Point, end: Point, angleDegrees: 45 | 60 | 90) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.max(Math.hypot(deltaX, deltaY), 0.001);
  const angle = Math.atan2(deltaY, deltaX);
  const halfAngle = toRadians(angleDegrees / 2);

  return [
    start,
    {
      x: start.x + Math.cos(angle - halfAngle) * length,
      y: start.y + Math.sin(angle - halfAngle) * length
    },
    {
      x: start.x + Math.cos(angle + halfAngle) * length,
      y: start.y + Math.sin(angle + halfAngle) * length
    }
  ];
}

function getCenteredSquarePolygon(center: Point, halfSide: number) {
  return [
    { x: center.x - halfSide, y: center.y - halfSide },
    { x: center.x + halfSide, y: center.y - halfSide },
    { x: center.x + halfSide, y: center.y + halfSide },
    { x: center.x - halfSide, y: center.y + halfSide }
  ];
}

function getCirclePolygon(center: Point, radius: number) {
  const steps = 40;

  return Array.from({ length: steps }, (_, index) => {
    const angle = (Math.PI * 2 * index) / steps;
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    };
  });
}

function formatSquares(value: number) {
  if (Math.abs(value - Math.round(value)) < 0.05) {
    return `${Math.round(value)}`;
  }

  return value.toFixed(1);
}

function getMeasureDistanceSquares(map: CampaignMap, preview: MeasurePreview) {
  const dxSquares = Math.abs(preview.end.x - preview.start.x) / map.grid.cellSize;
  const dySquares = Math.abs(preview.end.y - preview.start.y) / map.grid.cellSize;

  if (preview.snapMode === "none") {
    return Math.hypot(dxSquares, dySquares);
  }

  return Math.max(dxSquares, dySquares);
}

function drawingHasRenderableSpan(drawing: Pick<DrawingStroke, "kind" | "points">) {
  if (drawing.points.length < 2) {
    return false;
  }

  const bounds = getBounds(drawing.points);
  return bounds.maxX - bounds.minX > 2 || bounds.maxY - bounds.minY > 2;
}

function shouldFillDrawing(
  drawing:
    | Pick<DrawingStroke, "kind" | "fillColor" | "fillOpacity">
    | Pick<DrawingDraftState, "kind" | "fillColor" | "fillOpacity">
) {
  return Boolean(drawing.fillColor) && drawing.fillOpacity > 0.001;
}

function getDrawingStrokePath(
  drawing: DrawingStroke | DrawingDraftState | (Pick<DrawingStroke, "id"> & DrawingDraftState),
  worldToScreen: (point: Point) => Point
) {
  return pointsToSvgPath(
    getDrawingRenderPoints(drawing as Pick<DrawingStroke, "kind" | "points" | "rotation">).map(worldToScreen),
    drawing.kind !== "freehand"
  );
}

function getDrawingFillPath(
  drawing: DrawingStroke | DrawingDraftState | (Pick<DrawingStroke, "id"> & DrawingDraftState),
  worldToScreen: (point: Point) => Point
) {
  return pointsToSvgPath(
    getDrawingRenderPoints(drawing as Pick<DrawingStroke, "kind" | "points" | "rotation">).map(worldToScreen),
    drawing.kind !== "freehand" || shouldFillDrawing(drawing)
  );
}

function getDrawingHitPath(
  drawing: DrawingStroke | DrawingDraftState | (Pick<DrawingStroke, "id"> & DrawingDraftState),
  worldToScreen: (point: Point) => Point
) {
  return shouldFillDrawing(drawing) ? getDrawingFillPath(drawing, worldToScreen) : getDrawingStrokePath(drawing, worldToScreen);
}

function getDrawingRenderPoints(drawing: Pick<DrawingStroke, "kind" | "points" | "rotation">) {
  if (drawing.points.length < 2) {
    return drawing.points;
  }

  const center = getDrawingCenter(drawing);

  if (drawing.kind === "freehand") {
    return drawing.points.map((point) => rotatePoint(point, center, drawing.rotation));
  }

  if (drawing.kind === "circle") {
    const { minX, maxX, minY, maxY } = getBounds(drawing.points);
    const radiusX = Math.max(1, (maxX - minX) / 2);
    const radiusY = Math.max(1, (maxY - minY) / 2);
    return Array.from({ length: 24 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 24;
      return rotatePoint(
        {
          x: center.x + Math.cos(angle) * radiusX,
          y: center.y + Math.sin(angle) * radiusY
        },
        center,
        drawing.rotation
      );
    });
  }

  if (drawing.kind === "square") {
    return getSquarePoints(drawing.points, center).map((point) => rotatePoint(point, center, drawing.rotation));
  }

  return getStarPoints(drawing.points, center, drawing.rotation);
}

function getDrawingVisibilityPoints(drawing: Pick<DrawingStroke, "kind" | "points" | "rotation">) {
  const points = getDrawingRenderPoints(drawing);

  if (points.length <= 12) {
    return points;
  }

  const step = Math.max(1, Math.floor(points.length / 12));
  return points.filter((_, index) => index % step === 0);
}

function getDrawingCenter(drawing: Pick<DrawingStroke, "points">) {
  const { minX, maxX, minY, maxY } = getBounds(drawing.points);
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2
  };
}

function getDrawingRotationHandlePoint(drawing: Pick<DrawingStroke, "kind" | "points" | "rotation">) {
  const center = getDrawingCenter(drawing);
  const renderPoints = getDrawingRenderPoints(drawing);
  const outerRadius = renderPoints.reduce((max, point) => Math.max(max, Math.hypot(point.x - center.x, point.y - center.y)), 0);
  const anchor = {
    x: center.x,
    y: center.y - (outerRadius + Math.max(18, outerRadius * 0.18))
  };

  return {
    x: rotatePoint(anchor, center, drawing.rotation).x,
    y: rotatePoint(anchor, center, drawing.rotation).y
  };
}

function drawingMatchesOverride(
  drawing: Pick<DrawingStroke, "points" | "rotation">,
  override: { points: Point[]; rotation: number }
) {
  if (Math.abs(normalizeDegrees(drawing.rotation - override.rotation)) > 0.001) {
    return false;
  }

  if (drawing.points.length !== override.points.length) {
    return false;
  }

  return drawing.points.every((point, index) => {
    const next = override.points[index];
    return Boolean(next) && Math.abs(point.x - next.x) <= 0.001 && Math.abs(point.y - next.y) <= 0.001;
  });
}

function getSquarePoints(points: Point[], center: Point) {
  const start = points[0];
  const end = points[points.length - 1];
  const side = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y));
  const width = side * Math.sign(end.x - start.x || 1);
  const height = side * Math.sign(end.y - start.y || 1);
  const squareEnd = {
    x: start.x + width,
    y: start.y + height
  };
  const minX = Math.min(start.x, squareEnd.x);
  const maxX = Math.max(start.x, squareEnd.x);
  const minY = Math.min(start.y, squareEnd.y);
  const maxY = Math.max(start.y, squareEnd.y);

  const base = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY }
  ];

  return base.map((point) => ({
    x: point.x + (center.x - (minX + maxX) / 2),
    y: point.y + (center.y - (minY + maxY) / 2)
  }));
}

function getStarPoints(points: Point[], center: Point, rotation: number) {
  const square = getSquarePoints(points, center);
  const bounds = getBounds(square);
  const outerRadius = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2;
  const innerRadius = outerRadius * 0.46;
  const startAngle = -90 + rotation;

  return Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = toRadians(startAngle + index * 36);
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    };
  });
}

function rotatePoint(point: Point, center: Point, degrees: number) {
  if (Math.abs(degrees) < 0.001) {
    return point;
  }

  const angle = toRadians(degrees);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const deltaX = point.x - center.x;
  const deltaY = point.y - center.y;

  return {
    x: center.x + deltaX * cosine - deltaY * sine,
    y: center.y + deltaX * sine + deltaY * cosine
  };
}

function pointsToSvgPath(points: Point[], closed: boolean) {
  if (points.length === 0) {
    return "";
  }

  return `${points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ")}${closed ? " Z" : ""}`;
}

function getBounds(points: Point[]) {
  const [firstPoint = { x: 0, y: 0 }] = points;
  let minX = firstPoint.x;
  let maxX = firstPoint.x;
  let minY = firstPoint.y;
  let maxY = firstPoint.y;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, maxX, minY, maxY };
}

function normalizeDegrees(value: number) {
  let next = value % 360;

  if (next <= -180) {
    next += 360;
  }

  if (next > 180) {
    next -= 360;
  }

  return next;
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
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
