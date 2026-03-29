import { describe, expect, it } from "vitest";
import type { CampaignMap, DrawingStroke, MapWall, MeasurePreview } from "@shared/types";

import { createClientMapDraft } from "../src/lib/drafts.ts";
import {
  buildMeasurePreview,
  drawingHasRenderableSpan,
  getMeasureGeometry,
  isDoorCurrentlyVisible,
  isPointCurrentlyVisible,
  serializeMeasurePreview,
  shouldFillDrawing
} from "../src/features/board/boardUtils.ts";

function createBoardMap(): CampaignMap {
  const map = createClientMapDraft("Board Test");
  map.id = "map-board";
  map.width = 250;
  map.height = 250;
  map.grid.cellSize = 50;
  map.grid.offsetX = 0;
  map.grid.offsetY = 0;
  return map;
}

describe("boardUtils measure helpers", () => {
  it("snaps measure previews to the configured grid mode and serializes them", () => {
    const map = createBoardMap();

    const preview = buildMeasurePreview(map, { x: 10, y: 12 }, { x: 88, y: 86 }, "line", "center", 60, 2);

    expect(preview).toEqual<MeasurePreview>({
      kind: "line",
      start: { x: 25, y: 25 },
      end: { x: 75, y: 75 },
      snapMode: "center",
      coneAngle: 60,
      beamWidthSquares: 2
    });
    expect(serializeMeasurePreview(preview)).toBe("line:25.00:25.00:75.00:75.00:center:60:2");
  });

  it("builds beam and line geometries with stable labels and closure rules", () => {
    const map = createBoardMap();

    const beam = getMeasureGeometry(map, {
      kind: "beam",
      start: { x: 25, y: 25 },
      end: { x: 75, y: 25 },
      snapMode: "center",
      coneAngle: 45,
      beamWidthSquares: 2
    });
    const line = getMeasureGeometry(map, {
      kind: "line",
      start: { x: 25, y: 25 },
      end: { x: 75, y: 75 },
      snapMode: "center",
      coneAngle: 45,
      beamWidthSquares: 1
    });

    expect(beam.closed).toBe(true);
    expect(beam.points).toHaveLength(4);
    expect(beam.label).toBe("1 sq x 2 sq");

    expect(line.closed).toBe(false);
    expect(line.points).toEqual([
      { x: 25, y: 25 },
      { x: 75, y: 75 }
    ]);
    expect(line.label).toBe("1.4 sq");
    expect(line.labelPoint).toEqual({ x: 50, y: 50 });
  });
});

describe("boardUtils fog and drawing helpers", () => {
  it("determines point and door visibility from visible cell sets", () => {
    const map = createBoardMap();
    const visibleCells = new Set(["1:1", "0:1"]);
    const verticalDoor: MapWall = {
      id: "door-1",
      start: { x: 50, y: 50 },
      end: { x: 50, y: 100 },
      kind: "door",
      isOpen: false
    };

    expect(isPointCurrentlyVisible(map, visibleCells, { x: 75, y: 75 })).toBe(true);
    expect(isPointCurrentlyVisible(map, visibleCells, { x: 125, y: 125 })).toBe(false);
    expect(isDoorCurrentlyVisible(map, visibleCells, verticalDoor)).toBe(true);
    expect(isDoorCurrentlyVisible(map, new Set(["2:2"]), verticalDoor)).toBe(false);
  });

  it("treats drawings as fillable only when they have visible span and opacity", () => {
    const freehand: DrawingStroke = {
      id: "draw-1",
      kind: "freehand",
      color: "#fff",
      strokeOpacity: 1,
      fillColor: "#0f0",
      fillOpacity: 0.6,
      size: 3,
      rotation: 0,
      points: [
        { x: 0, y: 0 },
        { x: 15, y: 15 }
      ]
    };
    const tinySquare: DrawingStroke = {
      id: "draw-2",
      kind: "square",
      color: "#fff",
      strokeOpacity: 1,
      fillColor: "#0f0",
      fillOpacity: 0.6,
      size: 3,
      rotation: 0,
      points: [
        { x: 10, y: 10 },
        { x: 11, y: 11 }
      ]
    };

    expect(drawingHasRenderableSpan(freehand)).toBe(true);
    expect(shouldFillDrawing(freehand)).toBe(true);
    expect(drawingHasRenderableSpan(tinySquare)).toBe(false);
    expect(shouldFillDrawing(tinySquare)).toBe(false);
  });
});
