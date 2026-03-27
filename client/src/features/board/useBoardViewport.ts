import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import type { CampaignMap, MapViewportRecall, MemberRole, Point } from "@shared/types";

import { clamp, readBoardView, writeBoardView } from "./boardUtils";
import { maxViewZoom, minViewZoom } from "./constants";

interface ViewportSize {
  width: number;
  height: number;
}

interface UseBoardViewportOptions {
  map?: CampaignMap;
  currentUserId: string;
  gridVisible: boolean;
  role: MemberRole;
  viewRecall: MapViewportRecall | null;
}

export function useBoardViewport({
  map,
  currentUserId,
  gridVisible,
  role,
  viewRecall
}: UseBoardViewportOptions) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const initializedMapIdRef = useRef<string | null>(null);
  const appliedRecallIdRef = useRef<string | null>(null);
  const skipNextPersistRef = useRef(false);
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const [viewZoom, setViewZoom] = useState(1);
  const [viewPan, setViewPan] = useState<Point>({ x: 0, y: 0 });

  const baseScale = map?.grid.scale ?? 1;
  const worldScale = baseScale * viewZoom;

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

    if (appliedRecallIdRef.current === viewRecall.id) {
      return;
    }

    const nextZoom = clamp(viewRecall.zoom, minViewZoom, maxViewZoom);
    const nextWorldScale = baseScale * nextZoom;

    setViewZoom(nextZoom);
    setViewPan({
      x: viewportSize.width / 2 - viewRecall.center.x * nextWorldScale,
      y: viewportSize.height / 2 - viewRecall.center.y * nextWorldScale
    });
    appliedRecallIdRef.current = viewRecall.id;
  }, [baseScale, map, role, viewRecall, viewportSize.height, viewportSize.width]);

  useEffect(() => {
    if (!map?.id) {
      return;
    }

    initializedMapIdRef.current = null;
  }, [map?.id]);

  const gridStyle = useMemo(() => {
    if (!map?.grid.show || !gridVisible) {
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
  }, [gridVisible, map, viewPan.x, viewPan.y, worldScale]);

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

  const tokenLayerStyle = useMemo<CSSProperties>(
    () => ({
      transform: `translate(${viewPan.x}px, ${viewPan.y}px) scale(${worldScale})`
    }),
    [viewPan.x, viewPan.y, worldScale]
  );

  const viewCenter = useMemo(
    () => ({
      x: (viewportSize.width / 2 - viewPan.x) / worldScale,
      y: (viewportSize.height / 2 - viewPan.y) / worldScale
    }),
    [viewportSize.height, viewportSize.width, viewPan.x, viewPan.y, worldScale]
  );

  return {
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
  };
}
