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
  allMapCells,
  computeVisibleCellsForUser,
  snapPointToGrid,
  tokenCellKey,
  traceMovementPath,
  type MovementTrace
} from "@shared/vision";
import { BoardToolbar } from "../features/board/BoardToolbar";
import { BoardFogOverlay } from "../features/board/BoardFogOverlay";
import {
  buildMeasurePreview,
  clamp,
  drawingHasRenderableSpan,
  drawingMatchesOverride,
  getDrawingCenter,
  getDrawingFillPath,
  getDrawingHitPath,
  getDrawingRenderPoints,
  getDrawingRotationHandlePoint,
  getDrawingStrokePath,
  getDrawingVisibilityPoints,
  getMeasureGeometry,
  getSharedMeasurePalette,
  initials,
  isDoorCurrentlyVisible,
  isPointCurrentlyVisible,
  type MeasurePalette,
  normalizeSelectionRect,
  normalizeDegrees,
  pathBoundsIntersectsRect,
  pointsToSvgPath,
  readDiscoveredDrawingsMemory,
  serializeMeasurePreview,
  shouldFillDrawing,
  toDegrees,
  writeDiscoveredDrawingsMemory
} from "../features/board/boardUtils";
import {
  boardGridPreferenceStorageKey,
  maxViewZoom,
  minViewZoom,
  selectionDragThreshold
} from "../features/board/constants";
import { getTokenStatusOption, TOKEN_STATUS_OPTIONS } from "../features/board/tokenStatus";
import { useBoardViewport } from "../features/board/useBoardViewport";
import type { TokenUpdatePatch } from "../features/campaign/types";
import { usePersistentState } from "../hooks/usePersistentState";
import { resolveAssetUrl } from "../lib/assets";

type Tool = "select" | "draw" | "measure";
type SelectedMapItem = `drawing:${string}`;

interface BoardCanvasProps {
  map?: CampaignMap;
  tokens: BoardToken[];
  actors: ActorSheet[];
  selectedActor?: ActorSheet | null;
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
  onClearFog: () => Promise<void>;
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
  onUpdateToken: (tokenId: string, patch: TokenUpdatePatch) => Promise<void>;
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
  menu?:
    | {
        kind: "board";
        point: Point;
      }
    | {
        kind: "token";
        tokenId: string;
        actorId: string;
      };
  menuX?: number;
  menuY?: number;
}

interface SelectionState {
  additive: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

type ContextMenuState =
  | {
      kind: "board";
      x: number;
      y: number;
      point: Point;
    }
  | {
      kind: "token";
      x: number;
      y: number;
      tokenId: string;
    };

function getTokenStatusBadgeStyle(index: number, count: number, tokenSize: number, badgeSize: number): CSSProperties {
  const slotCount = Math.max(count, 10);
  const angle = -Math.PI / 2 + index * ((Math.PI * 2) / slotCount);
  const orbitRadius = tokenSize / 2 + badgeSize * 0.58;

  return {
    width: badgeSize,
    height: badgeSize,
    left: "50%",
    top: "50%",
    transform: `translate(calc(-50% + ${Math.cos(angle) * orbitRadius}px), calc(-50% + ${Math.sin(angle) * orbitRadius}px))`
  };
}

const localMeasurePalette = {
  stroke: "rgba(242, 187, 63, 0.96)",
  fill: "rgba(242, 187, 63, 0.16)",
  endFill: "rgba(18, 21, 26, 0.92)"
};
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
  onClearFog,
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
  onPingAndRecall,
  onUpdateToken
}: BoardCanvasProps) {
  const suppressSurfaceClickRef = useRef(false);
  const suppressContextMenuRef = useRef(false);
  const lastPreviewTargetKeyRef = useRef<string | null>(null);
  const lastMeasurePreviewKeyRef = useRef<string | null>(null);
  const lastSelectedTokenPositionRef = useRef<Point | null>(null);
  const pendingTeleportCenterRef = useRef<Point | null>(null);
  const pendingDoorToggleRef = useRef<string | null>(null);
  const moveActorRef = useRef(onMoveActor);
  const broadcastMovePreviewRef = useRef(onBroadcastMovePreview);
  const broadcastMeasurePreviewRef = useRef(onBroadcastMeasurePreview);
  const updateDrawingsRef = useRef(onUpdateDrawings);
  const drawingOverridesRef = useRef<Record<string, { points: Point[]; rotation: number }>>({});
  const [gridVisible, setGridVisible] = usePersistentState(boardGridPreferenceStorageKey, true);
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
  const [selectionBox, setSelectionBox] = useState<SelectionState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [hoveredTeleporterId, setHoveredTeleporterId] = useState<string | null>(null);
  const [optimisticTokenPositions, setOptimisticTokenPositions] = useState<Record<string, Point>>({});
  const [discoveredDrawingsByViewer, setDiscoveredDrawingsByViewer] = useState<Record<string, Record<string, string[]>>>(() =>
    readDiscoveredDrawingsMemory()
  );
  const {
    boardRef,
    baseScale,
    worldScale,
    viewportSize,
    viewZoom,
    setViewZoom,
    viewPan,
    setViewPan,
    gridStyle,
    backgroundRect,
    tokenLayerStyle,
    viewCenter
  } = useBoardViewport({
    map,
    currentUserId,
    gridVisible,
    role,
    viewRecall
  });
  const backgroundImageUrl = map ? resolveAssetUrl(map.backgroundUrl) : "";
  const isDungeonMaster = role === "dm";
  const mapFogEnabled = map?.fogEnabled ?? true;
  const playerUserIdSet = useMemo(() => new Set(fogPlayers.map((member) => member.userId)), [fogPlayers]);
  const fogPreviewActive =
    isDungeonMaster && mapFogEnabled && typeof fogPreviewUserId === "string" && fogPreviewUserId.length > 0;
  const usesRestrictedVision = mapFogEnabled && (role !== "dm" || fogPreviewActive);
  const visionUserId = fogPreviewUserId ?? currentUserId;
  const discoveryViewerKey = usesRestrictedVision ? visionUserId : "__dm_full__";

  const actorById = useMemo(() => new Map(actors.map((actor) => [actor.id, actor])), [actors]);
  const displayTokens = useMemo(
    () =>
      tokens.map((token) =>
        optimisticTokenPositions[token.id]
          ? {
              ...token,
              x: optimisticTokenPositions[token.id].x,
              y: optimisticTokenPositions[token.id].y
            }
          : token
      ),
    [optimisticTokenPositions, tokens]
  );
  const visibleTokens = useMemo(
    () => displayTokens.filter((token) => token.visible && token.mapId === map?.id),
    [displayTokens, map?.id]
  );
  const visibleTokenByActorId = useMemo(
    () => new Map(visibleTokens.map((token) => [token.actorId, token])),
    [visibleTokens]
  );
  const selectedToken = useMemo(
    () => (selectedActor ? visibleTokenByActorId.get(selectedActor.id) : undefined),
    [selectedActor, visibleTokenByActorId]
  );

  const currentVisibleCells = useMemo(() => {
    if (!map) {
      return new Set<string>();
    }

    if (!mapFogEnabled) {
      return new Set(allMapCells(map));
    }

    return computeVisibleCellsForUser({
      map,
      actors,
      tokens: visibleTokens,
      userId: visionUserId,
      role: usesRestrictedVision ? "player" : "dm"
    });
  }, [actors, map, mapFogEnabled, usesRestrictedVision, visionUserId, visibleTokens]);

  const seenCells = useMemo(() => {
    if (!map) {
      return new Set<string>();
    }

    return mapFogEnabled ? new Set(playerSeenCells) : new Set(allMapCells(map));
  }, [map, mapFogEnabled, playerSeenCells]);

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
  const renderedTokenById = useMemo(() => new Map(orderedTokens.map((token) => [token.id, token])), [orderedTokens]);

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

  const visibleTeleporters = useMemo(() => {
    if (!map || !isDungeonMaster) {
      return [];
    }

    return map.teleporters;
  }, [isDungeonMaster, map]);

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
  const displayMovePreview = useMemo(
    () => concealTeleporterTraceForPlayers(movePreview, map, isDungeonMaster),
    [isDungeonMaster, map, movePreview]
  );
  const displayMovementPreviews = useMemo(
    () =>
      visibleMovementPreviews.flatMap((entry) => {
        const preview = concealTeleporterTraceForPlayers(entry.preview, map, isDungeonMaster);

        return preview
          ? [{
              ...entry,
              preview
            }]
          : [];
      }),
    [isDungeonMaster, map, visibleMovementPreviews]
  );
  const previewLabelPoint = useMemo(() => {
    if (!displayMovePreview || displayMovePreview.points.length < 2) {
      return null;
    }

    return displayMovePreview.points[Math.floor((displayMovePreview.points.length - 1) / 2)] ?? displayMovePreview.end;
  }, [displayMovePreview]);

  const moveArrowStrokeWidth = clamp(4 * worldScale, 2.5, 12);
  const moveArrowHeadSize = clamp(12 * worldScale, 8, 28);
  const moveLabelFontSize = clamp(14 * worldScale, 12, 28);
  const moveLabelOffset = clamp(12 * worldScale, 10, 24);
  const normalizedSelectionBox = selectionBox ? normalizeSelectionRect(selectionBox) : null;
  const contextMenuToken = contextMenu?.kind === "token" ? renderedTokenById.get(contextMenu.tokenId) ?? null : null;
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
  const visiblePings = useMemo(() => pings.filter((entry) => entry.mapId === map?.id), [map?.id, pings]);

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
    setOptimisticTokenPositions((current) => {
      const next = { ...current };
      let changed = false;

      for (const [tokenId, point] of Object.entries(current)) {
        const persisted = tokens.find((token) => token.id === tokenId);

        if (!persisted) {
          delete next[tokenId];
          changed = true;
          continue;
        }

        if (Math.abs(persisted.x - point.x) < 0.0001 && Math.abs(persisted.y - point.y) < 0.0001) {
          delete next[tokenId];
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [tokens]);

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
    if (!map || !selectedActor || !selectedToken || !canControlActor(selectedActor)) {
      return;
    }

    const currentMap = map;
    const controlledActor = selectedActor;
    const controlledToken = selectedToken;
    const cellSize = currentMap.grid.cellSize;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;

      if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target?.isContentEditable) {
        return;
      }

      if (selectedMapItems.length > 0 || draggingToken || panning || tool !== "select") {
        return;
      }

      let deltaX = 0;
      let deltaY = 0;

      switch (event.key) {
        case "ArrowUp":
          deltaY = -cellSize;
          break;
        case "ArrowDown":
          deltaY = cellSize;
          break;
        case "ArrowLeft":
          deltaX = -cellSize;
          break;
        case "ArrowRight":
          deltaX = cellSize;
          break;
        default:
          return;
      }

      event.preventDefault();
      const nextTrace = traceMovementPath(
        currentMap,
        { x: controlledToken.x, y: controlledToken.y },
        { x: controlledToken.x + deltaX, y: controlledToken.y + deltaY },
        { ignoreWalls: isDungeonMaster }
      );

      pendingTeleportCenterRef.current = nextTrace.teleported ? nextTrace.end : null;
      setOptimisticTokenPositions((current) => ({
        ...current,
        [controlledToken.id]: { x: nextTrace.end.x, y: nextTrace.end.y }
      }));
      void moveActorRef.current(controlledActor.id, controlledToken.x + deltaX, controlledToken.y + deltaY);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [draggingToken, isDungeonMaster, map, panning, selectedActor, selectedMapItems.length, selectedToken, tool]);

  useEffect(() => {
    if (!boardRef.current) {
      return;
    }

    const node = boardRef.current;
    const handleNativeWheel = (event: WheelEvent) => {
      const eventTarget = event.target instanceof Element ? event.target : null;

      if (eventTarget?.closest(".board-context-menu")) {
        return;
      }

      event.preventDefault();
    };

    node.addEventListener("wheel", handleNativeWheel, { passive: false });

    return () => {
      node.removeEventListener("wheel", handleNativeWheel);
    };
  }, [map?.id]);

  useEffect(() => {
    if (!map || !viewRecall || role === "dm") {
      return;
    }

    if (viewRecall.mapId === map.id) {
      setContextMenu(null);
    }
  }, [map, role, viewRecall]);

  useEffect(() => {
    if (contextMenu?.kind === "token" && !renderedTokenById.has(contextMenu.tokenId)) {
      setContextMenu(null);
    }
  }, [contextMenu, renderedTokenById]);

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
    setHoveredTeleporterId(null);
    setOptimisticTokenPositions({});
    lastPreviewTargetKeyRef.current = null;
    lastSelectedTokenPositionRef.current = null;
    pendingTeleportCenterRef.current = null;
    pendingDoorToggleRef.current = null;
  }, [map?.id]);

  useEffect(() => {
    if (!map || !selectedActor || !selectedToken || draggingToken || !canControlActor(selectedActor)) {
      lastSelectedTokenPositionRef.current = selectedToken ? { x: selectedToken.x, y: selectedToken.y } : null;
      return;
    }

    const previousPoint = lastSelectedTokenPositionRef.current;
    const nextPoint = { x: selectedToken.x, y: selectedToken.y };
    const pendingTeleportCenter = pendingTeleportCenterRef.current;

    if (
      pendingTeleportCenter &&
      Math.abs(pendingTeleportCenter.x - nextPoint.x) < 0.0001 &&
      Math.abs(pendingTeleportCenter.y - nextPoint.y) < 0.0001 &&
      viewportSize.width > 0 &&
      viewportSize.height > 0
    ) {
      setViewPan({
        x: viewportSize.width / 2 - nextPoint.x * worldScale,
        y: viewportSize.height / 2 - nextPoint.y * worldScale
      });
      pendingTeleportCenterRef.current = null;
    } else if (
      pendingTeleportCenter &&
      previousPoint &&
      (Math.abs(previousPoint.x - nextPoint.x) > 0.0001 || Math.abs(previousPoint.y - nextPoint.y) > 0.0001)
    ) {
      pendingTeleportCenterRef.current = null;
    }

    lastSelectedTokenPositionRef.current = nextPoint;
  }, [draggingToken, map, selectedActor, selectedToken, setViewPan, viewportSize.height, viewportSize.width, worldScale]);

  useEffect(() => {
    if (tool !== "measure") {
      setMeasuring(null);
    }
  }, [tool]);

  useEffect(() => {
    const pendingDoorId = pendingDoorToggleRef.current;

    if (!pendingDoorId) {
      return;
    }

    if (draggingToken || Object.keys(optimisticTokenPositions).length > 0) {
      return;
    }

    pendingDoorToggleRef.current = null;
    void onToggleDoor(pendingDoorId);
  }, [draggingToken, onToggleDoor, optimisticTokenPositions]);

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
    const activeMap = map;
    const activeDraggingToken = draggingToken;

    if (!activeDraggingToken || !activeMap) {
      return;
    }

    const currentMap = activeMap;
    const currentDraggingToken = activeDraggingToken;

    function handleWindowPointerMove(event: PointerEvent) {
      const point = toWorldPoint(event.clientX, event.clientY);

      if (!point) {
        return;
      }

      const trace = traceMovementPath(currentMap, currentDraggingToken.start, point, {
        ignoreWalls: isDungeonMaster
      });
      setMovePreview(trace);

      if (trace.steps === 0) {
        if (lastPreviewTargetKeyRef.current !== null) {
          lastPreviewTargetKeyRef.current = null;
          void broadcastMovePreviewRef.current(currentDraggingToken.actorId, null);
        }
        return;
      }

      const snappedTarget = snapPointToGrid(currentMap, point);
      const previewKey = `${snappedTarget.x}:${snappedTarget.y}`;

      if (lastPreviewTargetKeyRef.current === previewKey) {
        return;
      }

      lastPreviewTargetKeyRef.current = previewKey;
      void broadcastMovePreviewRef.current(currentDraggingToken.actorId, snappedTarget);
    }

    function handleWindowPointerUp(event: PointerEvent) {
      const point = toWorldPoint(event.clientX, event.clientY);
      const snappedTarget = point ? snapPointToGrid(currentMap, point) : null;
      const trace =
        point
          ? traceMovementPath(currentMap, currentDraggingToken.start, point, {
              ignoreWalls: isDungeonMaster
            })
          : null;

      suppressSurfaceClickRef.current = true;
      setDraggingToken(null);
      setMovePreview(null);
      setContextMenu(null);

      if (lastPreviewTargetKeyRef.current !== null) {
        lastPreviewTargetKeyRef.current = null;
        void broadcastMovePreviewRef.current(currentDraggingToken.actorId, null);
      }

      if (!trace || trace.steps === 0) {
        return;
      }

      if (!snappedTarget) {
        return;
      }

      pendingTeleportCenterRef.current = trace.teleported ? trace.end : null;
      const draggedToken = visibleTokenByActorId.get(currentDraggingToken.actorId);

      if (draggedToken) {
        setOptimisticTokenPositions((current) => ({
          ...current,
          [draggedToken.id]: { x: trace.end.x, y: trace.end.y }
        }));
      }

      void moveActorRef.current(currentDraggingToken.actorId, snappedTarget.x, snappedTarget.y);
    }

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);

      if (lastPreviewTargetKeyRef.current !== null) {
        lastPreviewTargetKeyRef.current = null;
        void broadcastMovePreviewRef.current(currentDraggingToken.actorId, null);
      }
    };
  }, [draggingToken, isDungeonMaster, map, visibleTokenByActorId]);

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
    const activeMap = map;
    const activeMove = movingDrawings;

    if (!activeMove || !activeMap) {
      return;
    }

    const currentMap = activeMap;
    const currentMove = activeMove;

    function handleWindowPointerMove(event: PointerEvent) {
      const point = toWorldPoint(event.clientX, event.clientY);

      if (!point) {
        return;
      }

      const deltaX = point.x - currentMove.origin.x;
      const deltaY = point.y - currentMove.origin.y;
      const moved = Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5;

      setMovingDrawings((current) => (current ? { ...current, moved: current.moved || moved } : current));
      setDrawingOverrides(
        Object.fromEntries(
          currentMove.drawingIds.map((drawingId) => {
            const snapshot = currentMove.snapshots[drawingId];
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
        .filter(([drawingId]) => currentMove.drawingIds.includes(drawingId))
        .map(([id, value]) => ({
          id,
          points: value.points,
          rotation: value.rotation
        }));

      const moved = overrides.some((override) => {
        const snapshot = currentMove.snapshots[override.id];
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
        void updateDrawingsRef.current(currentMap.id, overrides);
      } else {
        setDrawingOverrides((current) =>
          Object.fromEntries(Object.entries(current).filter(([drawingId]) => !currentMove.drawingIds.includes(drawingId)))
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
    const activeMap = map;
    const activeRotation = rotatingDrawing;

    if (!activeRotation || !activeMap) {
      return;
    }

    const currentMap = activeMap;
    const currentRotation = activeRotation;

    function handleWindowPointerMove(event: PointerEvent) {
      const point = toWorldPoint(event.clientX, event.clientY);

      if (!point) {
        return;
      }

      const angle = Math.atan2(point.y - currentRotation.center.y, point.x - currentRotation.center.x);
      const nextRotation = currentRotation.baseRotation + toDegrees(angle - currentRotation.startAngle);
      const moved = Math.abs(nextRotation - currentRotation.baseRotation) > 0.5;

      setRotatingDrawing((current) => (current ? { ...current, moved: current.moved || moved } : current));
      setDrawingOverrides((current) => ({
        ...current,
        [currentRotation.drawingId]: {
          points: currentRotation.points,
          rotation: normalizeDegrees(nextRotation)
        }
      }));
    }

    function handleWindowPointerUp() {
      const override = drawingOverridesRef.current[currentRotation.drawingId];

      if (override && Math.abs(override.rotation - currentRotation.baseRotation) > 0.5) {
        void updateDrawingsRef.current(currentMap.id, [
          {
            id: currentRotation.drawingId,
            points: override.points,
            rotation: override.rotation
          }
        ]);
      } else {
        setDrawingOverrides((current) => {
          const next = { ...current };
          delete next[currentRotation.drawingId];
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
    const activePan = panning;

    if (!activePan) {
      return;
    }

    const currentPan = activePan;

    function handleWindowPointerMove(event: PointerEvent) {
      const deltaX = event.clientX - currentPan.clientX;
      const deltaY = event.clientY - currentPan.clientY;
      const movedEnough = Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3;

      if (currentPan.button === 2) {
        if (!movedEnough) {
          return;
        }

        suppressContextMenuRef.current = true;
      }

      setViewPan({
        x: currentPan.originX + deltaX,
        y: currentPan.originY + deltaY
      });
    }

    function handleWindowPointerUp() {
      if (
        currentPan.button === 2 &&
        !suppressContextMenuRef.current &&
        typeof currentPan.menuX === "number" &&
        typeof currentPan.menuY === "number" &&
        currentPan.menu
      ) {
        if (currentPan.menu.kind === "token") {
          setSelectedMapItems([]);
          onSelectActor(currentPan.menu.actorId);
          setContextMenu({
            kind: "token",
            x: currentPan.menuX,
            y: currentPan.menuY,
            tokenId: currentPan.menu.tokenId
          });
        } else {
          setContextMenu({
            kind: "board",
            x: currentPan.menuX,
            y: currentPan.menuY,
            point: currentPan.menu.point
          });
        }
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
  }, [onSelectActor, panning]);

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
    const activeMap = map;

    if (selectedMapItems.length === 0 || !activeMap) {
      return;
    }

    const currentMap = activeMap;

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

      void onDeleteDrawings(currentMap.id, drawingIds);
      setSelectedMapItems([]);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [map, onDeleteDrawings, selectedMapItems]);

  function canControlActor(actor: ActorSheet) {
    return role === "dm" || actor.ownerId === currentUserId;
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
    const target = event.target instanceof Element ? event.target : null;
    const tokenButton = target?.closest<HTMLElement>("[data-board-token-id]");
    const menuTokenId = tokenButton?.dataset.boardTokenId;
    const menuToken = menuTokenId ? renderedTokenById.get(menuTokenId) : undefined;
    const menuActor = menuToken ? actorById.get(menuToken.actorId) : undefined;
    const menu =
      event.button === 2 && menuToken && menuActor && canControlActor(menuActor)
        ? {
            kind: "token" as const,
            tokenId: menuToken.id,
            actorId: menuActor.id
          }
        : event.button === 2 && menuWorldPoint
          ? {
              kind: "board" as const,
              point: menuWorldPoint
            }
          : undefined;

    setPanning({
      button: event.button,
      clientX: event.clientX,
      clientY: event.clientY,
      originX: viewPan.x,
      originY: viewPan.y,
      menu,
      menuX: menuLocalPoint?.x,
      menuY: menuLocalPoint?.y
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

    const eventTarget = event.target instanceof Element ? event.target : null;

    if (eventTarget?.closest(".board-context-menu")) {
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

  async function handleTokenStatusChange(tokenId: string, statusMarkers: BoardToken["statusMarkers"]) {
    await onUpdateToken(tokenId, { statusMarkers });
  }

  function toggleTokenStatusMarker(token: BoardToken, statusMarker: BoardToken["statusMarkers"][number]) {
    const statusMarkers = token.statusMarkers.includes(statusMarker)
      ? token.statusMarkers.filter((entry) => entry !== statusMarker)
      : [...token.statusMarkers, statusMarker];

    void handleTokenStatusChange(token.id, statusMarkers);
  }

  function handleDoorClick(doorId: string, event: ReactMouseEvent<SVGLineElement>) {
    event.stopPropagation();
    setContextMenu(null);

    if (tool !== "select") {
      return;
    }

    if (draggingToken || Object.keys(optimisticTokenPositions).length > 0) {
      pendingDoorToggleRef.current = doorId;
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
      <BoardToolbar
        tool={tool}
        onToolChange={setTool}
        viewZoom={viewZoom}
        viewCenter={viewCenter}
        isDungeonMaster={isDungeonMaster}
        fogEnabled={mapFogEnabled}
        gridAvailable={Boolean(map?.grid.show)}
        gridVisible={gridVisible}
        fogPlayers={fogPlayers}
        dmFogEnabled={dmFogEnabled}
        dmFogUserId={dmFogUserId}
        onSetGridVisible={setGridVisible}
        onSetDmFogEnabled={onSetDmFogEnabled}
        onSetDmFogUserId={onSetDmFogUserId}
        onResetFog={() => void onResetFog()}
        onClearFog={() => void onClearFog()}
        measureKind={measureKind}
        onMeasureKindChange={setMeasureKind}
        measureSnapMode={measureSnapMode}
        onMeasureSnapModeChange={setMeasureSnapMode}
        coneAngle={coneAngle}
        onConeAngleChange={setConeAngle}
        beamWidthSquares={beamWidthSquares}
        onBeamWidthSquaresChange={setBeamWidthSquares}
        measureBroadcast={measureBroadcast}
        onMeasureBroadcastChange={setMeasureBroadcast}
        drawKind={drawKind}
        onDrawKindChange={setDrawKind}
        strokeColor={strokeColor}
        onStrokeColorChange={setStrokeColor}
        strokeOpacity={strokeOpacity}
        onStrokeOpacityChange={setStrokeOpacity}
        fillColor={fillColor}
        onFillColorChange={setFillColor}
        fillOpacity={fillOpacity}
        onFillOpacityChange={setFillOpacity}
        strokeSize={strokeSize}
        onStrokeSizeChange={setStrokeSize}
        onClearInk={() => {
          void clearInk();
        }}
      />

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
                backgroundImage: `linear-gradient(rgba(8, 8, 8, 0.12), rgba(8, 8, 8, 0.38)), url(${backgroundImageUrl})`
              }}
            />
          )}
          {gridStyle && <div className="board-grid" style={gridStyle} />}

          <svg className="board-overlay" width={viewportSize.width} height={viewportSize.height} viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}>
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
            {visibleTeleporters.map((teleporter) => {
              const pointA = worldToScreen(teleporter.pointA);
              const pointB = worldToScreen(teleporter.pointB);

              return (
                <g key={teleporter.id}>
                  {hoveredTeleporterId === teleporter.id && (
                    <line
                      x1={pointA.x}
                      y1={pointA.y}
                      x2={pointB.x}
                      y2={pointB.y}
                      className="board-teleporter-link"
                      stroke="rgba(200, 119, 255, 0.74)"
                    />
                  )}
                  {[pointA, pointB].map((point, index) => (
                    <g key={`${teleporter.id}:${index}`}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={Math.max(12, map.grid.cellSize * worldScale * 0.18)}
                        className="board-teleporter-node"
                        fill="rgba(148, 73, 214, 0.9)"
                        stroke="rgba(245, 229, 255, 0.95)"
                      />
                      <text
                        x={point.x}
                        y={point.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="board-teleporter-label"
                        fill="rgba(255, 248, 252, 0.96)"
                      >
                        {teleporter.pairNumber}
                      </text>
                    </g>
                  ))}
                </g>
              );
            })}
          </svg>

          <BoardFogOverlay
            map={map}
            visibleCells={currentVisibleCells}
            seenCells={seenCells}
            usesRestrictedVision={usesRestrictedVision}
            viewportSize={viewportSize}
            viewPan={viewPan}
            worldScale={worldScale}
          />

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
            {draftDrawing && drawingHasRenderableSpan(draftDrawing) && (
              <g>
                {shouldFillDrawing(draftDrawing) && (
                  <path
                    d={getDrawingFillPath(draftDrawing, worldToScreen)}
                    fill={draftDrawing.fillColor || "none"}
                    fillOpacity={draftDrawing.fillOpacity}
                  />
                )}
                <path
                  d={getDrawingStrokePath(draftDrawing, worldToScreen)}
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
            {displayMovePreview && displayMovePreview.steps > 0 && (
              <>
                <path
                  d={toSvgPathWorld(displayMovePreview.points)}
                  className={`board-move-path ${displayMovePreview.blocked ? "is-blocked" : ""}`}
                  markerEnd="url(#move-arrowhead)"
                  style={{ strokeWidth: moveArrowStrokeWidth }}
                />
                {(() => {
                  const end = worldToScreen(displayMovePreview.end);
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
                      {displayMovePreview.steps} sq
                    </text>
                  );
                })()}
              </>
            )}
            {displayMovementPreviews.map((entry) => {
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

          {((tool === "select" && selectableDrawings.length > 0) || visibleObstacles.some((wall) => wall.kind === "door") || visibleTeleporters.length > 0) && (
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
              {visibleTeleporters.flatMap((teleporter) =>
                [teleporter.pointA, teleporter.pointB].map((point, index) => {
                  const screen = worldToScreen(point);
                  return (
                    <circle
                      key={`teleporter-hover:${teleporter.id}:${index}`}
                      cx={screen.x}
                      cy={screen.y}
                      r={18}
                      fill="transparent"
                      pointerEvents="all"
                      onPointerEnter={() => setHoveredTeleporterId(teleporter.id)}
                      onPointerLeave={() =>
                        setHoveredTeleporterId((current) => (current === teleporter.id ? null : current))
                      }
                    />
                  );
                })
              )}
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
              const hasImage = token.imageUrl.length > 0;
              const size = map.grid.cellSize * token.size * (hasImage ? 0.88 : 0.72);
              const statusOptions = token.statusMarkers
                .map((statusMarker) => getTokenStatusOption(statusMarker))
                .filter((option): option is NonNullable<ReturnType<typeof getTokenStatusOption>> => option !== null);
              const badgeSize = Math.max(16, Math.min(24, size * 0.3));

              return (
                <button
                  key={token.id}
                  type="button"
                  title={token.label}
                  className={`board-token ${hasImage ? "has-image" : ""} ${selectedActor?.id === token.actorId ? "is-selected" : ""}`}
                  style={{
                    left: token.x,
                    top: token.y,
                    width: size,
                    height: size,
                    fontSize: Math.max(12, size * 0.34)
                  }}
                  data-board-token-id={token.id}
                  onPointerDown={(event) => handleTokenPointerDown(token, event)}
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <span className="board-token-body" style={{ background: token.color }}>
                    {token.imageUrl ? (
                      <img className="board-token-image" src={resolveAssetUrl(token.imageUrl)} alt={token.label} draggable={false} />
                    ) : (
                      <span className="board-token-initials">{initials(token.label)}</span>
                    )}
                    {token.statusMarkers.includes("cross") && (
                      <span className="board-token-cross-overlay" aria-hidden="true">
                        <span />
                        <span />
                      </span>
                    )}
                  </span>
                  {statusOptions.map((statusOption, index) => (
                    <span
                      key={statusOption.value}
                      className="board-token-status-badge"
                      data-tone={statusOption.tone}
                      style={getTokenStatusBadgeStyle(index, statusOptions.length, size, badgeSize)}
                      title={statusOption.label}
                    >
                      <statusOption.Icon className="board-token-status-icon" strokeWidth={2.2} aria-hidden="true" />
                    </span>
                  ))}
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
              className={`board-context-menu ${contextMenu.kind === "token" ? "is-token-menu" : ""}`}
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onWheel={(event) => event.stopPropagation()}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              {contextMenu.kind === "board" ? (
                <>
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
                </>
              ) : contextMenuToken ? (
                <>
                  <div className="board-context-menu-heading">{contextMenuToken.label}</div>
                  <button
                    type="button"
                    disabled={contextMenuToken.statusMarkers.length === 0}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => {
                      void handleTokenStatusChange(contextMenuToken.id, []);
                    }}
                  >
                    Clear markers
                  </button>
                  <div className="board-token-status-menu">
                    {TOKEN_STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`board-token-status-option ${contextMenuToken.statusMarkers.includes(option.value) ? "is-active" : ""}`}
                        title={option.label}
                        aria-pressed={contextMenuToken.statusMarkers.includes(option.value)}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => {
                          toggleTokenStatusMarker(contextMenuToken, option.value);
                        }}
                      >
                        <span className="board-token-status-swatch" data-tone={option.tone}>
                          <option.Icon className="board-token-status-icon" strokeWidth={2.2} aria-hidden="true" />
                        </span>
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => {
                    setContextMenu(null);
                  }}
                >
                  Close
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
              ? `Selected: ${selectedActor.name}. Drag the token to preview movement and release to move${displayMovePreview ? ` (${displayMovePreview.steps} squares)` : ""}.`
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

function concealTeleporterTraceForPlayers(
  preview: TokenMovementPreview | MovementTrace | null,
  map: CampaignMap | undefined,
  isDungeonMaster: boolean
) {
  if (!preview || !map || isDungeonMaster || !preview.teleported || !preview.teleportEntry) {
    return preview;
  }

  const teleportEntryIndex = preview.points.findIndex(
    (point) =>
      Math.abs(point.x - preview.teleportEntry!.x) < 0.0001 &&
      Math.abs(point.y - preview.teleportEntry!.y) < 0.0001
  );

  if (teleportEntryIndex <= 0) {
    return preview;
  }

  const visiblePoints = preview.points.slice(0, teleportEntryIndex + 1);

  return {
    ...preview,
    end: visiblePoints[visiblePoints.length - 1],
    points: visiblePoints,
    steps: Math.max(0, visiblePoints.length - 1)
  };
}
