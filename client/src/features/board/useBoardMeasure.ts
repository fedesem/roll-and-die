import { useEffect, useMemo, useRef, useState } from "react";

import type { CampaignMap, MeasureKind, MeasurePreview, MeasureSnapMode, Point } from "@shared/types";

import { buildMeasurePreview, getSharedMeasurePalette, serializeMeasurePreview } from "./boardUtils";
import type { BoardMeasurePreviewEntry, MeasuringState, Tool } from "./types";

interface UseBoardMeasureOptions {
  map?: CampaignMap;
  tool: Tool;
  currentUserId: string;
  measurePreviews: BoardMeasurePreviewEntry[];
  onBroadcastMeasurePreview: (preview: MeasurePreview | null) => Promise<void>;
  toWorldPoint: (clientX: number, clientY: number) => Point | null;
}

export function useBoardMeasure({
  map,
  tool,
  currentUserId,
  measurePreviews,
  onBroadcastMeasurePreview,
  toWorldPoint
}: UseBoardMeasureOptions) {
  const [measureKind, setMeasureKind] = useState<MeasureKind>("line");
  const [measureSnapMode, setMeasureSnapMode] = useState<MeasureSnapMode>("center");
  const [measureBroadcast, setMeasureBroadcast] = useState(true);
  const [coneAngle, setConeAngle] = useState<45 | 60 | 90>(60);
  const [beamWidthSquares, setBeamWidthSquares] = useState(1);
  const [measuring, setMeasuring] = useState<MeasuringState | null>(null);
  const lastMeasurePreviewKeyRef = useRef<string | null>(null);

  const localMeasurePreview = useMemo(() => {
    if (!map || !measuring) {
      return null;
    }

    return buildMeasurePreview(map, measuring.rawStart, measuring.rawEnd, measureKind, measureSnapMode, coneAngle, beamWidthSquares);
  }, [beamWidthSquares, coneAngle, map, measureKind, measureSnapMode, measuring]);

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

  useEffect(() => {
    if (tool !== "measure") {
      setMeasuring(null);
    }
  }, [tool]);

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
  }, [map, measuring, toWorldPoint]);

  useEffect(() => {
    const nextPreview = measureBroadcast ? localMeasurePreview : null;
    const nextKey = nextPreview ? serializeMeasurePreview(nextPreview) : null;

    if (nextKey === lastMeasurePreviewKeyRef.current) {
      return;
    }

    lastMeasurePreviewKeyRef.current = nextKey;
    void onBroadcastMeasurePreview(nextPreview);
  }, [localMeasurePreview, measureBroadcast, onBroadcastMeasurePreview]);

  useEffect(
    () => () => {
      if (lastMeasurePreviewKeyRef.current !== null) {
        void onBroadcastMeasurePreview(null);
      }
    },
    [onBroadcastMeasurePreview]
  );

  function beginMeasure(point: Point) {
    setMeasuring({
      rawStart: point,
      rawEnd: point
    });
  }

  return {
    measureKind,
    setMeasureKind,
    measureSnapMode,
    setMeasureSnapMode,
    measureBroadcast,
    setMeasureBroadcast,
    coneAngle,
    setConeAngle,
    beamWidthSquares,
    setBeamWidthSquares,
    measuring,
    setMeasuring,
    localMeasurePreview,
    visibleMeasurePreviews,
    beginMeasure,
    getSharedMeasurePalette
  };
}
