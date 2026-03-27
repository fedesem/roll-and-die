import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent
} from "react";
import { DoorOpen, EyeOff, MousePointer2, Move, Radio, RotateCcw, Square, Trash2, Waves, ZoomIn, ZoomOut } from "lucide-react";

import type { CampaignMap, MapTeleporter, MapWall, MapWallKind, Point } from "@shared/types";
import { snapPointToGrid, snapPointToGridIntersection } from "@shared/vision";
import { resolveAssetUrl } from "../lib/assets";
import { readImageDimensionsFromFile } from "../lib/media";
import { uploadImageAsset } from "../services/assetService";

interface MapConfiguratorProps {
  token: string;
  map: CampaignMap;
  disabled?: boolean;
  onChange: (nextMap: CampaignMap) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUploadError?: (message: string) => void;
}

interface DragState {
  clientX: number;
  clientY: number;
  offsetX: number;
  offsetY: number;
}

interface PanState {
  clientX: number;
  clientY: number;
  originX: number;
  originY: number;
}

interface SelectionState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

type EditorMode = "select" | "align" | "teleporter" | MapWallKind;

const minBackgroundScale = 0.05;
const maxBackgroundScale = 8;
const defaultPreviewZoom = 1.8;
const minPreviewZoom = 0.35;
const maxPreviewZoom = 4;
const defaultAlignScaleStep = 1;
const minAlignScaleStep = 0.1;
const maxAlignScaleStep = 10;
const selectionDragThreshold = 4;

export function MapConfigurator({
  token,
  map,
  disabled = false,
  onChange,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onUploadError
}: MapConfiguratorProps) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [panning, setPanning] = useState<PanState | null>(null);
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const [previewZoom, setPreviewZoom] = useState(defaultPreviewZoom);
  const [alignScaleStep, setAlignScaleStep] = useState(defaultAlignScaleStep);
  const [editorMode, setEditorMode] = useState<EditorMode>("select");
  const [obstacleAnchor, setObstacleAnchor] = useState<Point | null>(null);
  const [teleporterAnchor, setTeleporterAnchor] = useState<Point | null>(null);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [hoveredTeleporterId, setHoveredTeleporterId] = useState<string | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionState | null>(null);
  const [viewPan, setViewPan] = useState<Point>({ x: 0, y: 0 });

  const previewScale = useMemo(() => resolvePreviewScale(map, viewportSize), [map, viewportSize]);
  const renderScale = previewScale * previewZoom;
  const normalizedSelectionBox = selectionBox ? normalizeSelectionRect(selectionBox) : null;

  const gridStyle = useMemo(() => {
    if (!map.grid.show) {
      return undefined;
    }

    const cell = map.grid.cellSize * renderScale;

    return {
      backgroundImage: `
        linear-gradient(to right, ${map.grid.color} 1px, transparent 1px),
        linear-gradient(to bottom, ${map.grid.color} 1px, transparent 1px)
      `,
      backgroundSize: `${cell}px ${cell}px`,
      backgroundPosition: `${viewportSize.width / 2 + viewPan.x + map.grid.offsetX * renderScale}px ${viewportSize.height / 2 + viewPan.y + map.grid.offsetY * renderScale}px`
    };
  }, [map.grid.cellSize, map.grid.color, map.grid.offsetX, map.grid.offsetY, map.grid.show, renderScale, viewPan.x, viewPan.y, viewportSize.height, viewportSize.width]);

  const backgroundRect = useMemo(
    () => ({
      left: viewportSize.width / 2 + viewPan.x + map.backgroundOffsetX * renderScale,
      top: viewportSize.height / 2 + viewPan.y + map.backgroundOffsetY * renderScale,
      width: map.width * map.backgroundScale * renderScale,
      height: map.height * map.backgroundScale * renderScale
    }),
    [
      map.backgroundOffsetX,
      map.backgroundOffsetY,
      map.backgroundScale,
      map.height,
      map.width,
      renderScale,
      viewPan.x,
      viewPan.y,
      viewportSize.height,
      viewportSize.width
    ]
  );
  const backgroundImageUrl = resolveAssetUrl(map.backgroundUrl);

  useEffect(() => {
    if (!previewRef.current) {
      return;
    }

    const node = previewRef.current;
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
    const activeDrag = dragging;

    if (!activeDrag || disabled || editorMode !== "align") {
      return;
    }

    const currentDrag = activeDrag;

    function handleWindowPointerMove(event: PointerEvent) {
      onChange({
        ...map,
        backgroundOffsetX: currentDrag.offsetX + (event.clientX - currentDrag.clientX) / renderScale,
        backgroundOffsetY: currentDrag.offsetY + (event.clientY - currentDrag.clientY) / renderScale
      });
    }

    function handleWindowPointerUp() {
      setDragging(null);
    }

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
    };
  }, [disabled, dragging, editorMode, map, onChange, renderScale]);

  useEffect(() => {
    const activePan = panning;

    if (!activePan) {
      return;
    }

    const currentPan = activePan;

    function handleWindowPointerMove(event: PointerEvent) {
      setViewPan({
        x: currentPan.originX + (event.clientX - currentPan.clientX),
        y: currentPan.originY + (event.clientY - currentPan.clientY)
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
    setPreviewZoom(defaultPreviewZoom);
    setAlignScaleStep(defaultAlignScaleStep);
    setEditorMode("select");
    setObstacleAnchor(null);
    setTeleporterAnchor(null);
    setHoverPoint(null);
    setHoveredTeleporterId(null);
    setSelectedItemIds([]);
    setSelectionBox(null);
    setViewPan({ x: 0, y: 0 });
  }, [map.id]);

  useEffect(() => {
    setSelectedItemIds((current) =>
      current.filter((id) => {
        if (id.startsWith("wall:")) {
          return map.walls.some((wall) => wall.id === id.slice("wall:".length));
        }

        if (id.startsWith("teleporter:")) {
          return map.teleporters.some((teleporter) => teleporter.id === id.slice("teleporter:".length));
        }

        return false;
      })
    );
  }, [map.teleporters, map.walls]);

  useEffect(() => {
    if (disabled || selectedItemIds.length === 0) {
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
      const selectedWalls = new Set(
        selectedItemIds.filter((id) => id.startsWith("wall:")).map((id) => id.slice("wall:".length))
      );
      const selectedTeleporters = new Set(
        selectedItemIds
          .filter((id) => id.startsWith("teleporter:"))
          .map((id) => id.slice("teleporter:".length))
      );
      const nextWalls =
        selectedWalls.size > 0 ? mergeAdjacentWalls(map.walls.filter((wall) => !selectedWalls.has(wall.id)), map.grid.cellSize) : map.walls;
      const nextTeleporters =
        selectedTeleporters.size > 0 ? map.teleporters.filter((teleporter) => !selectedTeleporters.has(teleporter.id)) : map.teleporters;

      onChange({
        ...map,
        walls: nextWalls,
        teleporters: nextTeleporters
      });

      setSelectedItemIds([]);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [disabled, map, onChange, selectedItemIds]);

  useEffect(() => {
    if (disabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "z") {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;

      if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target?.isContentEditable) {
        return;
      }

      if (event.shiftKey) {
        if (!canRedo || !onRedo) {
          return;
        }

        event.preventDefault();
        onRedo();
        return;
      }

      if (!canUndo || !onUndo) {
        return;
      }

      event.preventDefault();
      onUndo();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [canRedo, canUndo, disabled, onRedo, onUndo]);

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const [uploadedAsset, dimensions] = await Promise.all([
        uploadImageAsset(token, "maps", file),
        readImageDimensionsFromFile(file)
      ]);

      onChange({
        ...map,
        backgroundUrl: uploadedAsset.url,
        width: dimensions.width,
        height: dimensions.height,
        backgroundScale: 1
      });
    } catch {
      onUploadError?.("Unable to read the selected image.");
    } finally {
      event.target.value = "";
    }
  }

  function updateGrid<K extends keyof CampaignMap["grid"]>(key: K, value: CampaignMap["grid"][K]) {
    onChange({
      ...map,
      grid: {
        ...map.grid,
        [key]: value
      }
    });
  }

  function worldToScreen(point: Point) {
    return {
      x: viewportSize.width / 2 + viewPan.x + point.x * renderScale,
      y: viewportSize.height / 2 + viewPan.y + point.y * renderScale
    };
  }

  function toLocalPoint(clientX: number, clientY: number) {
    if (!previewRef.current) {
      return null;
    }

    const rect = previewRef.current.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function toWorldPoint(clientX: number, clientY: number): Point | null {
    const localPoint = toLocalPoint(clientX, clientY);

    if (!localPoint) {
      return null;
    }

    return {
      x: (localPoint.x - viewportSize.width / 2 - viewPan.x) / renderScale,
      y: (localPoint.y - viewportSize.height / 2 - viewPan.y) / renderScale
    };
  }

  function updateWalls(nextWalls: MapWall[]) {
    onChange({
      ...map,
      walls: mergeAdjacentWalls(nextWalls, map.grid.cellSize)
    });
  }

  function updateTeleporters(nextTeleporters: MapTeleporter[]) {
    onChange({
      ...map,
      teleporters: nextTeleporters
    });
  }

  function toggleItemSelection(itemId: string) {
    setSelectedItemIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
    );
  }

  function handlePreviewPointerDownCapture(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button === 2 && editorMode !== "align" && editorMode !== "select") {
      event.preventDefault();
      setObstacleAnchor(null);
      setTeleporterAnchor(null);
      setHoverPoint(null);
      return;
    }

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

  function handlePreviewPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0 || event.target !== event.currentTarget) {
      return;
    }

    if (editorMode === "align") {
      if (!map.backgroundUrl) {
        return;
      }

      setDragging({
        clientX: event.clientX,
        clientY: event.clientY,
        offsetX: map.backgroundOffsetX,
        offsetY: map.backgroundOffsetY
      });
      return;
    }

    if (editorMode === "select") {
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
    }
  }

  function handlePreviewPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
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

    if (editorMode === "align") {
      return;
    }

    const point = toWorldPoint(event.clientX, event.clientY);
    setHoverPoint(
      point
        ? editorMode === "teleporter"
          ? snapPointToGrid(map, point)
          : snapPointToGridIntersection(map, point)
        : null
    );
  }

  function handlePreviewPointerUp() {
    if (!selectionBox) {
      return;
    }

    const box = normalizeSelectionRect(selectionBox);
    const dragged = box.width >= selectionDragThreshold || box.height >= selectionDragThreshold;

    if (dragged) {
      suppressClickRef.current = true;
      setSelectedItemIds(
        [
          ...map.walls
            .filter((wall) => segmentBoundsIntersectsRect(worldToScreen(wall.start), worldToScreen(wall.end), box))
            .map((wall) => `wall:${wall.id}`),
          ...map.teleporters
            .filter((teleporter) => pointIntersectsRect(worldToScreen(teleporter.pointA), box) || pointIntersectsRect(worldToScreen(teleporter.pointB), box))
            .map((teleporter) => `teleporter:${teleporter.id}`)
        ]
      );
    }

    setSelectionBox(null);
  }

  function handlePreviewClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (disabled) {
      return;
    }

    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    if (event.target !== event.currentTarget) {
      return;
    }

    if (editorMode === "select") {
      setSelectedItemIds([]);
      return;
    }

    if (editorMode === "align") {
      return;
    }

    const point = toWorldPoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    const snappedPoint = editorMode === "teleporter" ? snapPointToGrid(map, point) : snapPointToGridIntersection(map, point);

    if (editorMode === "teleporter") {
      if (!teleporterAnchor) {
        setTeleporterAnchor(snappedPoint);
        return;
      }

      if (samePoint(teleporterAnchor, snappedPoint)) {
        return;
      }

      const teleporter: MapTeleporter = {
        id: `teleporter_${crypto.randomUUID().slice(0, 8)}`,
        pairNumber: nextTeleporterPairNumber(map.teleporters),
        pointA: teleporterAnchor,
        pointB: snappedPoint
      };

      updateTeleporters([...map.teleporters, teleporter]);
      setTeleporterAnchor(null);
      setSelectedItemIds([`teleporter:${teleporter.id}`]);
      return;
    }

    if (!obstacleAnchor) {
      setObstacleAnchor(snappedPoint);
      return;
    }

    if (samePoint(obstacleAnchor, snappedPoint)) {
      return;
    }

    const obstacle: MapWall = {
      id: `wall_${crypto.randomUUID().slice(0, 8)}`,
      start: obstacleAnchor,
      end: snappedPoint,
      kind: editorMode,
      isOpen: false
    };

    updateWalls([...map.walls, obstacle]);
    setObstacleAnchor(snappedPoint);
    setSelectedItemIds([`wall:${obstacle.id}`]);
  }

  function handlePreviewWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();

    if (editorMode === "align" && !disabled && previewRef.current && map.backgroundUrl) {
      const scaleFactor = 1 + alignScaleStep / 100;
      const nextScale = clamp(
        map.backgroundScale * (event.deltaY < 0 ? scaleFactor : 1 / scaleFactor),
        minBackgroundScale,
        maxBackgroundScale
      );

      if (nextScale === map.backgroundScale) {
        return;
      }

      const rect = previewRef.current.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const worldX = (localX - viewportSize.width / 2 - viewPan.x) / renderScale;
      const worldY = (localY - viewportSize.height / 2 - viewPan.y) / renderScale;
      const relativeX = (worldX - map.backgroundOffsetX) / map.backgroundScale;
      const relativeY = (worldY - map.backgroundOffsetY) / map.backgroundScale;

      onChange({
        ...map,
        backgroundScale: nextScale,
        backgroundOffsetX: worldX - relativeX * nextScale,
        backgroundOffsetY: worldY - relativeY * nextScale
      });
      return;
    }

    adjustPreviewZoom(event.deltaY < 0 ? 1 : -1);
  }

  function adjustPreviewZoom(direction: 1 | -1) {
    setPreviewZoom((current) => clamp(current * (direction > 0 ? 1.15 : 0.87), minPreviewZoom, maxPreviewZoom));
  }

  function removeSelectedItems(itemIds: string[]) {
    if (itemIds.length === 0) {
      return;
    }

    const selectedWalls = new Set(
      itemIds.filter((id) => id.startsWith("wall:")).map((id) => id.slice("wall:".length))
    );
    const selectedTeleporters = new Set(
      itemIds
        .filter((id) => id.startsWith("teleporter:"))
        .map((id) => id.slice("teleporter:".length))
    );

    if (selectedWalls.size > 0) {
      updateWalls(map.walls.filter((wall) => !selectedWalls.has(wall.id)));
    }

    if (selectedTeleporters.size > 0) {
      updateTeleporters(map.teleporters.filter((teleporter) => !selectedTeleporters.has(teleporter.id)));
    }

    setSelectedItemIds((current) =>
      current.filter((id) => !selectedWalls.has(id.slice("wall:".length)) && !selectedTeleporters.has(id.slice("teleporter:".length)))
    );
  }

  function clearMapItems() {
    if (!window.confirm("Clear all walls, transparent walls, opaque walls, doors, and teleporters from this map?")) {
      return;
    }

    updateWalls([]);
    updateTeleporters([]);
    setSelectedItemIds([]);
    setObstacleAnchor(null);
    setTeleporterAnchor(null);
  }

  const helperText =
    editorMode === "align"
      ? "Drag the image to line up the cells. Use right or middle drag to pan the viewport, the mouse wheel to scale the image by the alignment step, and the view controls to zoom the workspace."
      : editorMode === "select"
        ? selectedItemIds.length > 0
          ? `${selectedItemIds.length} map item${selectedItemIds.length === 1 ? "" : "s"} selected. Press Delete to remove them.`
          : "Click walls or teleporters to toggle selection or drag a box to select multiple. Use right or middle drag to pan."
        : editorMode === "teleporter"
          ? teleporterAnchor
            ? "Click the destination cell to finish the teleporter pair. Right click ends the current pair without leaving the teleporter tool."
            : "Click one cell, then another, to create a numbered teleporter pair. Right click ends the current pair without leaving the teleporter tool."
        : obstacleAnchor
          ? `Click the next snapped border point to continue the ${obstacleLabel(editorMode).toLowerCase()}. Right click ends the chain and keeps the tool active.`
          : editorMode === "door" || editorMode === "transparent" || editorMode === "opaque"
            ? `Click two snapped border points to place a ${obstacleLabel(editorMode).toLowerCase()}, or click a wall section to replace one square with it. Right click keeps the tool active.`
            : `Click two snapped border points to place a ${obstacleLabel(editorMode).toLowerCase()}. Right click keeps the tool active.`;

  return (
    <div className="map-editor">
      <div className="map-editor-grid">
        <div className="map-preview-shell">
          <div className="panel-head">
            <div>
              <p className="panel-label">Preview</p>
              <h3>Grid alignment and obstacles</h3>
            </div>
            <div className="map-preview-actions">
              <span className="board-zoom-chip">View {Math.round(previewZoom * 100)}%</span>
              <button type="button" className="icon-action-button" onClick={() => adjustPreviewZoom(-1)} title="Zoom out">
                <ZoomOut size={15} />
              </button>
              <button type="button" className="icon-action-button" onClick={() => adjustPreviewZoom(1)} title="Zoom in">
                <ZoomIn size={15} />
              </button>
              <button
                type="button"
                className="icon-action-button"
                title="Reset view"
                onClick={() => {
                  setPreviewZoom(defaultPreviewZoom);
                  setViewPan({ x: 0, y: 0 });
                }}
              >
                <RotateCcw size={15} />
              </button>
              <label className="map-inline-setting">
                Align Step %
                <input
                  type="number"
                  min={minAlignScaleStep}
                  max={maxAlignScaleStep}
                  step="0.1"
                  value={alignScaleStep}
                  onChange={(event) => setAlignScaleStep(clamp(Number(event.target.value || 0), minAlignScaleStep, maxAlignScaleStep))}
                />
              </label>
            </div>
          </div>

          <div
            ref={previewRef}
            className={`map-preview-stage ${dragging || panning ? "is-dragging" : ""} ${editorMode !== "align" ? "is-editing" : ""} mode-${editorMode}`}
            onClick={handlePreviewClick}
            onContextMenu={(event) => {
              event.preventDefault();

              if (editorMode !== "align" && editorMode !== "select") {
                setObstacleAnchor(null);
                setTeleporterAnchor(null);
                setHoverPoint(null);
              }
            }}
            onPointerDownCapture={handlePreviewPointerDownCapture}
            onPointerDown={handlePreviewPointerDown}
            onPointerMove={handlePreviewPointerMove}
            onPointerUp={handlePreviewPointerUp}
            onPointerLeave={() => {
              if (selectionBox) {
                const box = normalizeSelectionRect(selectionBox);

                if (box.width >= selectionDragThreshold || box.height >= selectionDragThreshold) {
                  setSelectedItemIds(
                    map.walls
                      .filter((wall) => segmentBoundsIntersectsRect(worldToScreen(wall.start), worldToScreen(wall.end), box))
                      .map((wall) => `wall:${wall.id}`)
                  );
                  suppressClickRef.current = true;
                }

                setSelectionBox(null);
              }
              setHoverPoint(null);
            }}
            onWheel={handlePreviewWheel}
          >
            <div className="map-preview-overlay-tools">
              <button
                className={`icon-action-button ${editorMode === "select" ? "is-active" : ""}`}
                type="button"
                disabled={disabled}
                title="Select"
                onClick={() => {
                  setEditorMode("select");
                  setObstacleAnchor(null);
                  setHoverPoint(null);
                }}
              >
                <MousePointer2 size={15} />
              </button>
              <button
                className={`icon-action-button ${editorMode === "align" ? "is-active" : ""}`}
                type="button"
                title="Align image"
                onClick={() => {
                  setEditorMode("align");
                  setObstacleAnchor(null);
                  setTeleporterAnchor(null);
                  setHoverPoint(null);
                }}
              >
                <Move size={15} />
              </button>
              <button
                className={`icon-action-button ${editorMode === "wall" ? "is-active" : ""}`}
                type="button"
                disabled={disabled}
                title="Wall"
                onClick={() => {
                  setEditorMode("wall");
                  setObstacleAnchor(null);
                  setTeleporterAnchor(null);
                }}
              >
                <Square size={15} />
              </button>
              <button
                className={`icon-action-button ${editorMode === "transparent" ? "is-active" : ""}`}
                type="button"
                disabled={disabled}
                title="Transparent wall"
                onClick={() => {
                  setEditorMode("transparent");
                  setObstacleAnchor(null);
                  setTeleporterAnchor(null);
                }}
              >
                <Waves size={15} />
              </button>
              <button
                className={`icon-action-button ${editorMode === "opaque" ? "is-active" : ""}`}
                type="button"
                disabled={disabled}
                title="Opaque wall"
                onClick={() => {
                  setEditorMode("opaque");
                  setObstacleAnchor(null);
                  setTeleporterAnchor(null);
                }}
              >
                <EyeOff size={15} />
              </button>
              <button
                className={`icon-action-button ${editorMode === "door" ? "is-active" : ""}`}
                type="button"
                disabled={disabled}
                title="Door"
                onClick={() => {
                  setEditorMode("door");
                  setObstacleAnchor(null);
                  setTeleporterAnchor(null);
                }}
              >
                <DoorOpen size={15} />
              </button>
              <button
                className={`icon-action-button ${editorMode === "teleporter" ? "is-active" : ""}`}
                type="button"
                disabled={disabled}
                title="Teleporter"
                onClick={() => {
                  setEditorMode("teleporter");
                  setObstacleAnchor(null);
                  setTeleporterAnchor(null);
                }}
              >
                <Radio size={15} />
              </button>
              <button
                className="icon-action-button danger-button"
                type="button"
                disabled={disabled || (selectedItemIds.length === 0 && map.walls.length === 0 && map.teleporters.length === 0)}
                title={selectedItemIds.length > 0 ? "Delete selected" : "Clear all map items"}
                onClick={() => {
                  if (selectedItemIds.length > 0) {
                    removeSelectedItems(selectedItemIds);
                    return;
                  }
                  clearMapItems();
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
            {map.backgroundUrl && (
              <div
                className="map-preview-image"
                style={{
                  left: backgroundRect.left,
                  top: backgroundRect.top,
                  width: backgroundRect.width,
                  height: backgroundRect.height,
                  backgroundImage: `url(${backgroundImageUrl})`
                }}
              />
            )}
            {gridStyle && <div className="map-preview-grid" style={gridStyle} />}

            <svg className="map-preview-overlay" width={viewportSize.width} height={viewportSize.height} viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}>
              {map.walls.map((wall) => {
                const start = worldToScreen(wall.start);
                const end = worldToScreen(wall.end);
                return (
                  <line
                    key={wall.id}
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    className={`map-preview-wall kind-${wall.kind} ${wall.isOpen ? "is-open" : ""} ${selectedItemIds.includes(`wall:${wall.id}`) ? "is-selected" : ""}`}
                  />
                  );
              })}
              {map.teleporters.map((teleporter) => {
                const pointA = worldToScreen(teleporter.pointA);
                const pointB = worldToScreen(teleporter.pointB);
                const selected = selectedItemIds.includes(`teleporter:${teleporter.id}`);

                return (
                  <g key={teleporter.id} className={selected ? "is-selected" : undefined}>
                    {hoveredTeleporterId === teleporter.id && (
                      <line
                        x1={pointA.x}
                        y1={pointA.y}
                        x2={pointB.x}
                        y2={pointB.y}
                        className="map-preview-teleporter-link"
                        stroke="rgba(200, 119, 255, 0.76)"
                      />
                    )}
                    {[pointA, pointB].map((point, index) => (
                      <g key={`${teleporter.id}:${index}`}>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={12}
                          className="map-preview-teleporter-node"
                          fill="rgba(148, 73, 214, 0.92)"
                          stroke="rgba(245, 229, 255, 0.92)"
                        />
                        <text
                          x={point.x}
                          y={point.y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="map-preview-teleporter-label"
                          fill="rgba(255, 248, 252, 0.96)"
                        >
                          {teleporter.pairNumber}
                        </text>
                      </g>
                    ))}
                  </g>
                );
              })}
              {obstacleAnchor && hoverPoint && editorMode !== "select" && editorMode !== "align" && editorMode !== "teleporter" && (
                <line
                  x1={worldToScreen(obstacleAnchor).x}
                  y1={worldToScreen(obstacleAnchor).y}
                  x2={worldToScreen(hoverPoint).x}
                  y2={worldToScreen(hoverPoint).y}
                  className={`map-preview-wall is-preview kind-${editorMode}`}
                />
              )}
              {teleporterAnchor && hoverPoint && editorMode === "teleporter" && (
                <g>
                  <line
                    x1={worldToScreen(teleporterAnchor).x}
                    y1={worldToScreen(teleporterAnchor).y}
                    x2={worldToScreen(hoverPoint).x}
                    y2={worldToScreen(hoverPoint).y}
                    className="map-preview-teleporter-link is-preview"
                    stroke="rgba(200, 119, 255, 0.76)"
                  />
                  {[teleporterAnchor, hoverPoint].map((point, index) => {
                    const screen = worldToScreen(point);
                    return (
                      <circle
                        key={`preview-teleporter:${index}`}
                        cx={screen.x}
                        cy={screen.y}
                        r={10}
                        className="map-preview-teleporter-node is-preview"
                        fill="rgba(148, 73, 214, 0.42)"
                        stroke="rgba(245, 229, 255, 0.92)"
                      />
                    );
                  })}
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
            </svg>

            <svg className="map-preview-hit-layer" width={viewportSize.width} height={viewportSize.height} viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}>
              {(editorMode === "select" || editorMode === "door" || editorMode === "transparent" || editorMode === "opaque") &&
                map.walls.map((wall) => {
                const start = worldToScreen(wall.start);
                const end = worldToScreen(wall.end);
                return (
                  <line
                    key={wall.id}
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    className="map-preview-hit"
                    strokeWidth={18}
                    onClick={(event) => {
                      event.stopPropagation();

                      if (editorMode === "select") {
                        toggleItemSelection(`wall:${wall.id}`);
                        return;
                      }

                      if (editorMode === "door" || editorMode === "transparent" || editorMode === "opaque") {
                        const point = toWorldPoint(event.clientX, event.clientY);

                        if (!point) {
                          return;
                        }

                        updateWalls(replaceWallSection(map.walls, wall.id, point, editorMode, map.grid.cellSize));
                        setSelectedItemIds([`wall:${wall.id}`]);
                      }
                    }}
                  />
                );
              })}
              {map.teleporters.flatMap((teleporter) =>
                [teleporter.pointA, teleporter.pointB].map((point, index) => {
                  const screen = worldToScreen(point);
                  return (
                    <circle
                      key={`${teleporter.id}:${index}`}
                      cx={screen.x}
                      cy={screen.y}
                      r={14}
                      className="map-preview-hit-node"
                      onClick={(event) => {
                        event.stopPropagation();

                        if (editorMode === "select") {
                          toggleItemSelection(`teleporter:${teleporter.id}`);
                        }
                      }}
                      onPointerEnter={() => setHoveredTeleporterId(teleporter.id)}
                      onPointerLeave={() =>
                        setHoveredTeleporterId((current) => (current === teleporter.id ? null : current))
                      }
                    />
                  );
                })
              )}
            </svg>

            <div className="map-preview-crosshair" />
          </div>

          <p className="panel-hint">{helperText}</p>
        </div>

        <div className="map-form-stack">
          <div className="map-form-section">
            <div className="panel-head">
              <div>
                <p className="panel-label">Image</p>
                <h3>
                  {map.width}x{map.height}
                </h3>
              </div>
            </div>
            <div className="map-form-grid">
              <label>
                Name
                <input value={map.name} disabled={disabled} onChange={(event) => onChange({ ...map, name: event.target.value })} />
              </label>
              <label>
                Background Image
                <input type="file" accept="image/*" disabled={disabled} onChange={handleImageUpload} />
              </label>
              <label className="span-two">
                Background URL
                <input value={map.backgroundUrl} disabled={disabled} onChange={(event) => onChange({ ...map, backgroundUrl: event.target.value })} />
              </label>
              <label>
                Image Width
                <input type="number" value={map.width} disabled={disabled} onChange={(event) => onChange({ ...map, width: Number(event.target.value || 0) })} />
              </label>
              <label>
                Image Height
                <input type="number" value={map.height} disabled={disabled} onChange={(event) => onChange({ ...map, height: Number(event.target.value || 0) })} />
              </label>
              <label>
                Image Offset X
                <input type="number" value={map.backgroundOffsetX} disabled={disabled} onChange={(event) => onChange({ ...map, backgroundOffsetX: Number(event.target.value || 0) })} />
              </label>
              <label>
                Image Offset Y
                <input type="number" value={map.backgroundOffsetY} disabled={disabled} onChange={(event) => onChange({ ...map, backgroundOffsetY: Number(event.target.value || 0) })} />
              </label>
              <label>
                Image Scale
                <input type="number" step="0.01" value={map.backgroundScale} disabled={disabled} onChange={(event) => onChange({ ...map, backgroundScale: Number(event.target.value || 0) })} />
              </label>
              <label>
                Grid Cell
                <input type="number" value={map.grid.cellSize} disabled={disabled} onChange={(event) => updateGrid("cellSize", Number(event.target.value || 0))} />
              </label>
              <label>
                Board Scale
                <input type="number" step="0.1" value={map.grid.scale} disabled={disabled} onChange={(event) => updateGrid("scale", Number(event.target.value || 0))} />
              </label>
              <label>
                Grid Offset X
                <input type="number" value={map.grid.offsetX} disabled={disabled} onChange={(event) => updateGrid("offsetX", Number(event.target.value || 0))} />
              </label>
              <label>
                Grid Offset Y
                <input type="number" value={map.grid.offsetY} disabled={disabled} onChange={(event) => updateGrid("offsetY", Number(event.target.value || 0))} />
              </label>
              <label>
                Grid Color
                <div className="color-input-row">
                  <input
                    type="color"
                    value={toColorInputValue(map.grid.color)}
                    disabled={disabled}
                    onChange={(event) => updateGrid("color", event.target.value)}
                  />
                  <input value={map.grid.color} disabled={disabled} onChange={(event) => updateGrid("color", event.target.value)} />
                </div>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={map.grid.show} disabled={disabled} onChange={(event) => updateGrid("show", event.target.checked)} />
                Show grid
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={map.fogEnabled}
                  disabled={disabled}
                  onChange={(event) => onChange({ ...map, fogEnabled: event.target.checked })}
                />
                Enable fog
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function resolvePreviewScale(map: CampaignMap, viewportSize: ViewportSize) {
  if (viewportSize.width <= 0 || viewportSize.height <= 0) {
    return Math.max(0.28, map.grid.scale);
  }

  const basisWidth = Math.max(map.width, map.grid.cellSize * 14);
  const basisHeight = Math.max(map.height, map.grid.cellSize * 10);

  return clamp(
    Math.max(
      Math.min((viewportSize.width - 40) / basisWidth, (viewportSize.height - 40) / basisHeight) * 1.45,
      map.grid.scale
    ),
    0.18,
    2.6
  );
}

function obstacleLabel(kind: EditorMode) {
  switch (kind) {
    case "door":
      return "Door";
    case "teleporter":
      return "Teleporter";
    case "opaque":
      return "Opaque Wall";
    case "transparent":
      return "Transparent Wall";
    case "wall":
      return "Wall";
    case "select":
      return "Select";
    default:
      return "Alignment";
  }
}

function samePoint(a: Point, b: Point) {
  return Math.abs(a.x - b.x) < 0.0001 && Math.abs(a.y - b.y) < 0.0001;
}

function toColorInputValue(value: string) {
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return value;
  }

  const rgbaMatch = value.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i);

  if (rgbaMatch) {
    return `#${[rgbaMatch[1], rgbaMatch[2], rgbaMatch[3]]
      .map((entry) => Math.max(0, Math.min(255, Number(entry))).toString(16).padStart(2, "0"))
      .join("")}`;
  }

  return "#dcb65c";
}

function normalizeSelectionRect(rect: SelectionState) {
  return {
    x: Math.min(rect.startX, rect.currentX),
    y: Math.min(rect.startY, rect.currentY),
    width: Math.abs(rect.currentX - rect.startX),
    height: Math.abs(rect.currentY - rect.startY)
  };
}

function segmentBoundsIntersectsRect(start: Point, end: Point, rect: { x: number; y: number; width: number; height: number }) {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);

  return !(maxX < rect.x || minX > rect.x + rect.width || maxY < rect.y || minY > rect.y + rect.height);
}

function pointIntersectsRect(point: Point, rect: { x: number; y: number; width: number; height: number }) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function nextTeleporterPairNumber(teleporters: MapTeleporter[]) {
  return teleporters.reduce((maxPairNumber, teleporter) => Math.max(maxPairNumber, teleporter.pairNumber), 0) + 1;
}

function replaceWallSection(
  walls: MapWall[],
  wallId: string,
  point: Point,
  kind: Extract<MapWallKind, "door" | "transparent" | "opaque">,
  cellSize: number
) {
  const nextWalls: MapWall[] = [];

  for (const wall of walls) {
    if (wall.id !== wallId) {
      nextWalls.push(wall);
      continue;
    }

    const replacement = splitWallSection(wall, point, kind, cellSize);

    if (!replacement) {
      nextWalls.push(wall);
      continue;
    }

    nextWalls.push(...replacement);
  }

  return mergeAdjacentWalls(nextWalls, cellSize);
}

function splitWallSection(
  wall: MapWall,
  point: Point,
  kind: Extract<MapWallKind, "door" | "transparent" | "opaque">,
  cellSize: number
) {
  const horizontal = Math.abs(wall.start.y - wall.end.y) < 0.0001;
  const vertical = Math.abs(wall.start.x - wall.end.x) < 0.0001;

  if (!horizontal && !vertical) {
    return null;
  }

  if (horizontal) {
    const minX = Math.min(wall.start.x, wall.end.x);
    const maxX = Math.max(wall.start.x, wall.end.x);
    const segmentCount = Math.round((maxX - minX) / cellSize);

    if (segmentCount <= 0) {
      return null;
    }

    const rawIndex = Math.floor((Math.max(minX, Math.min(maxX - 0.0001, point.x)) - minX) / cellSize);
    const index = Math.max(0, Math.min(segmentCount - 1, rawIndex));
    const sectionStartX = minX + index * cellSize;
    const sectionEndX = sectionStartX + cellSize;
    const y = wall.start.y;

    return buildSplitWallParts(wall, kind, { x: sectionStartX, y }, { x: sectionEndX, y });
  }

  const minY = Math.min(wall.start.y, wall.end.y);
  const maxY = Math.max(wall.start.y, wall.end.y);
  const segmentCount = Math.round((maxY - minY) / cellSize);

  if (segmentCount <= 0) {
    return null;
  }

  const rawIndex = Math.floor((Math.max(minY, Math.min(maxY - 0.0001, point.y)) - minY) / cellSize);
  const index = Math.max(0, Math.min(segmentCount - 1, rawIndex));
  const sectionStartY = minY + index * cellSize;
  const sectionEndY = sectionStartY + cellSize;
  const x = wall.start.x;

  return buildSplitWallParts(wall, kind, { x, y: sectionStartY }, { x, y: sectionEndY });
}

function buildSplitWallParts(
  wall: MapWall,
  kind: Extract<MapWallKind, "door" | "transparent" | "opaque">,
  sectionStart: Point,
  sectionEnd: Point
) {
  const ordered = orderWallEndpoints(wall.start, wall.end);
  const orderedSection = orderWallEndpoints(sectionStart, sectionEnd);
  const nextWalls: MapWall[] = [];

  if (!samePoint(ordered.start, orderedSection.start)) {
    nextWalls.push({
      ...wall,
      id: `wall_${crypto.randomUUID().slice(0, 8)}`,
      start: ordered.start,
      end: orderedSection.start,
      kind: wall.kind,
      isOpen: wall.kind === "door" ? wall.isOpen : false
    });
  }

  nextWalls.push({
    ...wall,
    id: `wall_${crypto.randomUUID().slice(0, 8)}`,
    start: orderedSection.start,
    end: orderedSection.end,
    kind,
    isOpen: false
  });

  if (!samePoint(ordered.end, orderedSection.end)) {
    nextWalls.push({
      ...wall,
      id: `wall_${crypto.randomUUID().slice(0, 8)}`,
      start: orderedSection.end,
      end: ordered.end,
      kind: wall.kind,
      isOpen: wall.kind === "door" ? wall.isOpen : false
    });
  }

  return nextWalls;
}

function mergeAdjacentWalls(walls: MapWall[], cellSize: number) {
  const sortedWalls = [...walls].filter((wall) => !samePoint(wall.start, wall.end)).sort(compareWallsForMerge);
  const merged: MapWall[] = [];

  for (const wall of sortedWalls) {
    const previous = merged[merged.length - 1];

    if (previous && canMergeWalls(previous, wall, cellSize)) {
      previous.start = orderWallEndpoints(previous.start, previous.end).start;
      previous.end = orderWallEndpoints(previous.start, wall.end).end;
      continue;
    }

    merged.push({ ...wall });
  }

  return merged;
}

function canMergeWalls(left: MapWall, right: MapWall, cellSize: number) {
  if (left.kind !== right.kind || left.isOpen !== right.isOpen) {
    return false;
  }

  const orderedLeft = orderWallEndpoints(left.start, left.end);
  const orderedRight = orderWallEndpoints(right.start, right.end);
  const leftHorizontal = Math.abs(orderedLeft.start.y - orderedLeft.end.y) < 0.0001;
  const rightHorizontal = Math.abs(orderedRight.start.y - orderedRight.end.y) < 0.0001;
  const leftVertical = Math.abs(orderedLeft.start.x - orderedLeft.end.x) < 0.0001;
  const rightVertical = Math.abs(orderedRight.start.x - orderedRight.end.x) < 0.0001;

  if (leftHorizontal && rightHorizontal && Math.abs(orderedLeft.start.y - orderedRight.start.y) < 0.0001) {
    return samePoint(orderedLeft.end, orderedRight.start) && Math.abs(orderedLeft.end.x - orderedRight.start.x) <= cellSize + 0.0001;
  }

  if (leftVertical && rightVertical && Math.abs(orderedLeft.start.x - orderedRight.start.x) < 0.0001) {
    return samePoint(orderedLeft.end, orderedRight.start) && Math.abs(orderedLeft.end.y - orderedRight.start.y) <= cellSize + 0.0001;
  }

  return false;
}

function orderWallEndpoints(start: Point, end: Point) {
  if (start.x < end.x || (Math.abs(start.x - end.x) < 0.0001 && start.y <= end.y)) {
    return { start, end };
  }

  return {
    start: end,
    end: start
  };
}

function compareWallsForMerge(left: MapWall, right: MapWall) {
  const orderedLeft = orderWallEndpoints(left.start, left.end);
  const orderedRight = orderWallEndpoints(right.start, right.end);

  if (Math.abs(orderedLeft.start.y - orderedRight.start.y) > 0.0001) {
    return orderedLeft.start.y - orderedRight.start.y;
  }

  if (Math.abs(orderedLeft.start.x - orderedRight.start.x) > 0.0001) {
    return orderedLeft.start.x - orderedRight.start.x;
  }

  return orderedLeft.end.x - orderedRight.end.x || orderedLeft.end.y - orderedRight.end.y;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
