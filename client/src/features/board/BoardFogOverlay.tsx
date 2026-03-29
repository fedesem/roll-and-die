import { useEffect, useRef } from "react";
import { cellKey } from "@shared/vision";
import type { CampaignMap } from "@shared/types";

interface BoardFogOverlayProps {
  map?: CampaignMap;
  visibleCells: Set<string>;
  seenCells: Set<string>;
  usesRestrictedVision: boolean;
  viewportSize: {
    width: number;
    height: number;
  };
  viewPan: {
    x: number;
    y: number;
  };
  worldScale: number;
}

const hiddenFill = "#000000";
const memoryFill = "rgba(2, 3, 7, 0.58)";

export function BoardFogOverlay({
  map,
  visibleCells,
  seenCells,
  usesRestrictedVision,
  viewportSize,
  viewPan,
  worldScale
}: BoardFogOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const width = Math.max(0, Math.floor(viewportSize.width));
    const height = Math.max(0, Math.floor(viewportSize.height));
    const devicePixelRatio = window.devicePixelRatio || 1;

    canvas.width = Math.max(1, Math.floor(width * devicePixelRatio));
    canvas.height = Math.max(1, Math.floor(height * devicePixelRatio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    if (!map || !usesRestrictedVision || width <= 0 || height <= 0 || worldScale <= 0) {
      return;
    }

    const cellSize = map.grid.cellSize;
    const left = -viewPan.x / worldScale;
    const top = -viewPan.y / worldScale;
    const right = (width - viewPan.x) / worldScale;
    const bottom = (height - viewPan.y) / worldScale;
    const minColumn = Math.floor((left - map.grid.offsetX) / cellSize) - 2;
    const maxColumn = Math.ceil((right - map.grid.offsetX) / cellSize) + 2;
    const minRow = Math.floor((top - map.grid.offsetY) / cellSize) - 2;
    const maxRow = Math.ceil((bottom - map.grid.offsetY) / cellSize) + 2;

    for (let row = minRow; row <= maxRow; row += 1) {
      let activeTone: "hidden" | "memory" | null = null;
      let runStartColumn = minColumn;

      const flushRun = (endColumn: number) => {
        if (!activeTone || endColumn < runStartColumn) {
          return;
        }

        const startX = (map.grid.offsetX + runStartColumn * cellSize) * worldScale + viewPan.x;
        const endX = (map.grid.offsetX + (endColumn + 1) * cellSize) * worldScale + viewPan.x;
        const startY = (map.grid.offsetY + row * cellSize) * worldScale + viewPan.y;
        const endY = (map.grid.offsetY + (row + 1) * cellSize) * worldScale + viewPan.y;

        context.fillStyle = activeTone === "hidden" ? hiddenFill : memoryFill;
        context.fillRect(startX, startY, endX - startX + 0.5, endY - startY + 0.5);
      };

      for (let column = minColumn; column <= maxColumn; column += 1) {
        const key = cellKey(column, row);
        const tone = visibleCells.has(key) ? null : seenCells.has(key) ? "memory" : "hidden";

        if (tone === activeTone) {
          continue;
        }

        flushRun(column - 1);
        activeTone = tone;
        runStartColumn = column;
      }

      flushRun(maxColumn);
    }
  }, [map, seenCells, usesRestrictedVision, viewPan.x, viewPan.y, viewportSize.height, viewportSize.width, visibleCells, worldScale]);

  return <canvas ref={canvasRef} className="board-fog-layer" aria-hidden="true" />;
}
