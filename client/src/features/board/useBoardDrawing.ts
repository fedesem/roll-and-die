import { useEffect, useMemo, useRef, useState } from "react";

import type { CampaignMap, DrawingKind, DrawingStroke, DrawingTextFont, Point } from "@shared/types";

import {
  drawingHasRenderableSpan,
  drawingMatchesOverride,
  getDrawingVisibilityPoints,
  isPointCurrentlyVisible,
  readDiscoveredDrawingsMemory,
  shouldFillDrawing,
  toDegrees,
  writeDiscoveredDrawingsMemory
} from "./boardUtils";
import { buildTextDrawingPoints, normalizeDrawingText } from "./drawingText";
import type { DrawingDraftState, DrawingMoveState, DrawingRotationState, TextDraftState, Tool } from "./types";

interface UseBoardDrawingOptions {
  map?: CampaignMap;
  tool: Tool;
  currentUserId: string;
  currentVisibleCells: Set<string>;
  discoveryViewerKey: string;
  playerUserIdSet: Set<string>;
  usesRestrictedVision: boolean;
  canEditDrawing: (drawing: DrawingStroke) => boolean;
  toWorldPoint: (clientX: number, clientY: number) => Point | null;
  onCreateDrawing: (mapId: string, stroke: DrawingStroke) => Promise<void>;
  onUpdateDrawings: (
    mapId: string,
    drawings: Array<{
      id: string;
      points: Point[];
      rotation: number;
    }>
  ) => Promise<void>;
  onClearDrawings: (mapId: string) => Promise<void>;
}

export function useBoardDrawing({
  map,
  tool,
  currentUserId,
  currentVisibleCells,
  discoveryViewerKey,
  playerUserIdSet,
  usesRestrictedVision,
  canEditDrawing,
  toWorldPoint,
  onCreateDrawing,
  onUpdateDrawings,
  onClearDrawings
}: UseBoardDrawingOptions) {
  const updateDrawingsRef = useRef(onUpdateDrawings);
  const drawingOverridesRef = useRef<Record<string, { points: Point[]; rotation: number }>>({});
  const [drawKind, setDrawKind] = useState<DrawingKind>("freehand");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeOpacity, setStrokeOpacity] = useState(1);
  const [fillColor, setFillColor] = useState("#000000");
  const [fillOpacity, setFillOpacity] = useState(0);
  const [shapeStrokeSize, setShapeStrokeSize] = useState(4);
  const [textFontSize, setTextFontSize] = useState(28);
  const [textFontFamily, setTextFontFamily] = useState<DrawingTextFont>("serif");
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [draftDrawing, setDraftDrawing] = useState<DrawingDraftState | null>(null);
  const [textDraft, setTextDraft] = useState<TextDraftState | null>(null);
  const [movingDrawings, setMovingDrawings] = useState<DrawingMoveState | null>(null);
  const [rotatingDrawing, setRotatingDrawing] = useState<DrawingRotationState | null>(null);
  const [drawingOverrides, setDrawingOverrides] = useState<Record<string, { points: Point[]; rotation: number }>>({});
  const [discoveredDrawingsByViewer, setDiscoveredDrawingsByViewer] = useState<Record<string, Record<string, string[]>>>(() =>
    readDiscoveredDrawingsMemory()
  );
  const activeDrawSize = drawKind === "text" ? textFontSize : shapeStrokeSize;

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

  const discoveredDrawingIds = useMemo(() => {
    if (!map) {
      return new Set<string>();
    }

    const memoryKey = `${map.id}:${map.visibilityVersion}`;
    return new Set(discoveredDrawingsByViewer[discoveryViewerKey]?.[memoryKey] ?? []);
  }, [discoveredDrawingsByViewer, discoveryViewerKey, map]);

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
  }, [canEditDrawing, drawingBuckets.memory, drawingBuckets.overFog, drawingBuckets.underFog]);

  useEffect(() => {
    updateDrawingsRef.current = onUpdateDrawings;
  }, [onUpdateDrawings]);

  useEffect(() => {
    drawingOverridesRef.current = drawingOverrides;
  }, [drawingOverrides]);

  useEffect(() => {
    writeDiscoveredDrawingsMemory(discoveredDrawingsByViewer);
  }, [discoveredDrawingsByViewer]);

  useEffect(() => {
    if (tool !== "draw" || drawKind !== "text") {
      setTextDraft(null);
    }

    if (drawKind === "text") {
      setDraftDrawing(null);
    }
  }, [drawKind, tool]);

  useEffect(() => {
    setDraftDrawing(null);
    setTextDraft(null);
    setMovingDrawings(null);
    setRotatingDrawing(null);
    setDrawingOverrides({});
  }, [map?.id]);

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
  }, [map, movingDrawings, toWorldPoint]);

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
          rotation: ((nextRotation % 360) + 360) % 360
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
  }, [map, rotatingDrawing, toWorldPoint]);

  function handleDrawKindChange(kind: DrawingKind) {
    setDrawKind(kind);

    if (kind !== "text") {
      setTextDraft(null);
    }
  }

  function handleDrawSizeChange(value: number) {
    if (drawKind === "text") {
      setTextFontSize(value);
      return;
    }

    setShapeStrokeSize(value);
  }

  function beginDrawing(point: Point) {
    if (drawKind === "text") {
      return;
    }

    setDraftDrawing({
      id: "draft-shape",
      color: strokeColor,
      strokeOpacity,
      fillColor,
      fillOpacity,
      kind: drawKind,
      text: "",
      fontFamily: textFontFamily,
      bold: textBold,
      italic: textItalic,
      points: [point],
      rotation: 0,
      size: activeDrawSize
    });
  }

  function beginTextDraft(point: Point, screenX: number, screenY: number) {
    setDraftDrawing(null);
    setTextDraft((current) => ({
      point,
      screenX,
      screenY,
      text: current?.text ?? ""
    }));
  }

  function updateDraftDrawing(point: Point) {
    if (tool !== "draw" || !draftDrawing) {
      return;
    }

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

  async function commitDraftDrawing(point: Point | null) {
    if (!map || !draftDrawing) {
      return;
    }

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
      text: draftDrawing.text,
      fontFamily: draftDrawing.fontFamily,
      bold: draftDrawing.bold,
      italic: draftDrawing.italic,
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

  async function placeTextDrawing() {
    if (!map || !textDraft) {
      return;
    }

    const text = normalizeDrawingText(textDraft.text);

    if (!text.trim()) {
      return;
    }

    const stroke: DrawingStroke = {
      id: `drw_${crypto.randomUUID().slice(0, 8)}`,
      ownerId: currentUserId,
      kind: "text",
      text,
      fontFamily: textFontFamily,
      bold: textBold,
      italic: textItalic,
      color: strokeColor,
      strokeOpacity,
      fillColor,
      fillOpacity,
      size: textFontSize,
      rotation: 0,
      points: buildTextDrawingPoints(textDraft.point, text, textFontSize, textFontFamily, textBold, textItalic)
    };

    await onCreateDrawing(map.id, stroke);
    setTextDraft(null);
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

  return {
    drawKind,
    setDrawKind,
    strokeColor,
    setStrokeColor,
    strokeOpacity,
    setStrokeOpacity,
    fillColor,
    setFillColor,
    fillOpacity,
    setFillOpacity,
    shapeStrokeSize,
    textFontSize,
    textFontFamily,
    setTextFontFamily,
    textBold,
    setTextBold,
    textItalic,
    setTextItalic,
    draftDrawing,
    setDraftDrawing,
    textDraft,
    setTextDraft,
    movingDrawings,
    setMovingDrawings,
    rotatingDrawing,
    setRotatingDrawing,
    drawingOverrides,
    setDrawingOverrides,
    activeDrawSize,
    displayDrawings,
    drawingBuckets,
    selectableDrawings,
    handleDrawKindChange,
    handleDrawSizeChange,
    beginDrawing,
    beginTextDraft,
    updateDraftDrawing,
    commitDraftDrawing,
    placeTextDrawing,
    clearInk,
    shouldFillDrawing
  };
}
