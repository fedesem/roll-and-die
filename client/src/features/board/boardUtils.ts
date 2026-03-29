import type {
  CampaignMap,
  DrawingStroke,
  MapWall,
  MeasurePreview,
  MeasureSnapMode,
  Point
} from "@shared/types";
import {
  cellKey,
  obstacleMidpoint,
  pointToCell,
  snapPointToGrid,
  snapPointToGridIntersection
} from "@shared/vision";

import { readJson, writeJson } from "../../lib/storage";
import {
  boardViewStorageKeyPrefix,
  discoveredDrawingsStorageKey
} from "./constants";
import { getTextDrawingBounds } from "./drawingText";

export interface MeasurePalette {
  stroke: string;
  fill: string;
  endFill: string;
}

export function buildMeasurePreview(
  map: CampaignMap,
  rawStart: Point,
  rawEnd: Point,
  kind: MeasurePreview["kind"],
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
    beamWidthSquares
  };
}

export function serializeMeasurePreview(preview: MeasurePreview) {
  return [
    preview.kind,
    preview.start.x.toFixed(2),
    preview.start.y.toFixed(2),
    preview.end.x.toFixed(2),
    preview.end.y.toFixed(2),
    preview.snapMode,
    preview.coneAngle,
    preview.beamWidthSquares
  ].join(":");
}

export function getSharedMeasurePalette(userId: string): MeasurePalette {
  const hue = hashString(userId) % 360;

  return {
    stroke: `hsl(${hue} 88% 64%)`,
    fill: `hsl(${hue} 88% 58% / 0.16)`,
    endFill: "rgba(18, 18, 20, 0.82)"
  };
}

export function getMeasureGeometry(map: CampaignMap, preview: MeasurePreview) {
  if (preview.kind === "line") {
    const labelPoint = midpoint(preview.start, preview.end);
    const label = formatSquares(getMeasureDistanceSquares(map, preview));

    return {
      points: [preview.start, preview.end],
      closed: false,
      label,
      labelPoint
    };
  }

  if (preview.kind === "beam") {
    const width = preview.beamWidthSquares * map.grid.cellSize;
    const polygon = getBeamPolygon(preview.start, preview.end, width);
    return {
      points: polygon,
      closed: true,
      label: `${formatSquares(getMeasureDistanceSquares(map, preview))} x ${preview.beamWidthSquares} sq`,
      labelPoint: midpoint(preview.start, preview.end)
    };
  }

  if (preview.kind === "cone") {
    const polygon = getConePolygon(preview.start, preview.end, preview.coneAngle);
    return {
      points: polygon,
      closed: true,
      label: `${preview.coneAngle}° • ${formatSquares(getMeasureDistanceSquares(map, preview))}`,
      labelPoint: midpoint(preview.start, preview.end)
    };
  }

  if (preview.kind === "square") {
    const dx = preview.end.x - preview.start.x;
    const dy = preview.end.y - preview.start.y;
    const halfSide = Math.max(Math.abs(dx), Math.abs(dy));
    const polygon = getCenteredSquarePolygon(preview.start, halfSide);
    return {
      points: polygon,
      closed: true,
      label: `${formatSquares((halfSide * 2) / map.grid.cellSize)} sq`,
      labelPoint: preview.start
    };
  }

  const radius = Math.max(
    Math.hypot(preview.end.x - preview.start.x, preview.end.y - preview.start.y),
    map.grid.cellSize * 0.25
  );
  return {
    points: getCirclePolygon(preview.start, radius),
    closed: true,
    label: `${formatSquares((radius * 2) / map.grid.cellSize)} dia`,
    labelPoint: preview.start
  };
}

export function drawingHasRenderableSpan(drawing: Pick<DrawingStroke, "kind" | "points" | "text">) {
  if (drawing.kind === "freehand") {
    return drawing.points.length >= 2;
  }

  if (drawing.kind === "text") {
    if (!drawing.text.trim()) {
      return false;
    }

    const { width, height } = getTextDrawingBounds(drawing);
    return width >= 2 && height >= 2;
  }

  const [start, end] = drawing.points;
  return Boolean(start && end && Math.hypot(end.x - start.x, end.y - start.y) >= 2);
}

export function shouldFillDrawing(
  drawing: Pick<DrawingStroke, "fillColor" | "fillOpacity" | "kind" | "points" | "text">
) {
  return drawing.fillOpacity > 0 && drawing.fillColor && drawingHasRenderableSpan(drawing);
}

export function getDrawingStrokePath(
  drawing: Pick<DrawingStroke, "kind" | "points" | "rotation">,
  worldToScreen: (point: Point) => Point
) {
  return pointsToSvgPath(getDrawingRenderPoints(drawing).map(worldToScreen), drawing.kind !== "freehand");
}

export function getDrawingFillPath(
  drawing: Pick<DrawingStroke, "kind" | "points" | "rotation">,
  worldToScreen: (point: Point) => Point
) {
  return pointsToSvgPath(getDrawingRenderPoints(drawing).map(worldToScreen), true);
}

export function getDrawingHitPath(
  drawing: Pick<DrawingStroke, "kind" | "points" | "rotation">,
  worldToScreen: (point: Point) => Point
) {
  return pointsToSvgPath(getDrawingRenderPoints(drawing).map(worldToScreen), drawing.kind !== "freehand");
}

export function getDrawingRenderPoints(
  drawing: Pick<DrawingStroke, "kind" | "points" | "rotation">
) {
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
    return getSquarePoints(drawing.points, center).map((point) =>
      rotatePoint(point, center, drawing.rotation)
    );
  }

  if (drawing.kind === "text") {
    const { x, y, width, height } = getTextDrawingBounds(drawing);
    return [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height }
    ].map((point) => rotatePoint(point, center, drawing.rotation));
  }

  return getStarPoints(drawing.points, center, drawing.rotation);
}

export function getDrawingVisibilityPoints(
  drawing: Pick<DrawingStroke, "kind" | "points" | "rotation">
) {
  const points = getDrawingRenderPoints(drawing);

  if (points.length <= 12) {
    return points;
  }

  const step = Math.max(1, Math.floor(points.length / 12));
  return points.filter((_, index) => index % step === 0);
}

export function getDrawingCenter(drawing: Pick<DrawingStroke, "points">) {
  const { minX, maxX, minY, maxY } = getBounds(drawing.points);
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2
  };
}

export function getDrawingRotationHandlePoint(
  drawing: Pick<DrawingStroke, "kind" | "points" | "rotation">
) {
  const center = getDrawingCenter(drawing);
  const renderPoints = getDrawingRenderPoints(drawing);
  const outerRadius = renderPoints.reduce(
    (max, point) => Math.max(max, Math.hypot(point.x - center.x, point.y - center.y)),
    0
  );
  const anchor = {
    x: center.x,
    y: center.y - (outerRadius + Math.max(18, outerRadius * 0.18))
  };

  return {
    x: rotatePoint(anchor, center, drawing.rotation).x,
    y: rotatePoint(anchor, center, drawing.rotation).y
  };
}

export function drawingMatchesOverride(
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

export function isPointCurrentlyVisible(
  map: CampaignMap,
  visibleCells: Set<string>,
  point: Point
) {
  const cell = pointToCell(map, point);
  return visibleCells.has(cellKey(cell.column, cell.row));
}

export function isDoorCurrentlyVisible(
  map: CampaignMap,
  visibleCells: Set<string>,
  door: MapWall
) {
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

export function initials(label: string) {
  const parts = label
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return parts
    .slice(0, 2)
    .map((entry) => entry[0]?.toUpperCase() ?? "")
    .join("");
}

export function boardViewStorageKey(userId: string, mapId: string) {
  return `${boardViewStorageKeyPrefix}:${userId}:${mapId}`;
}

export function readBoardView(userId: string, mapId: string) {
  const saved = readJson<{
    zoom?: number;
    center?: Point;
    pan?: Point;
  }>(boardViewStorageKey(userId, mapId));

  if (!saved || typeof saved !== "object") {
    return null;
  }

  const zoom = typeof saved.zoom === "number" ? saved.zoom : null;
  const center =
    saved.center &&
    typeof saved.center.x === "number" &&
    typeof saved.center.y === "number"
      ? saved.center
      : null;
  const pan =
    saved.pan && typeof saved.pan.x === "number" && typeof saved.pan.y === "number"
      ? saved.pan
      : null;

  if (zoom === null || (!center && !pan)) {
    return null;
  }

  return {
    zoom,
    center: center ?? undefined,
    pan: pan ?? { x: 0, y: 0 }
  };
}

export function writeBoardView(
  userId: string,
  mapId: string,
  value: { zoom: number; center: Point; pan: Point }
) {
  writeJson(boardViewStorageKey(userId, mapId), value);
}

export function readDiscoveredDrawingsMemory() {
  const saved = readJson<Record<string, Record<string, string[]>>>(discoveredDrawingsStorageKey);

  if (!saved || typeof saved !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(saved).map(([viewerId, maps]) => [
      viewerId,
      Object.fromEntries(
        Object.entries(maps ?? {})
          .filter(([, drawingIds]) => Array.isArray(drawingIds))
          .map(([mapId, drawingIds]) => [
            mapId,
            drawingIds.filter((drawingId): drawingId is string => typeof drawingId === "string")
          ])
      )
    ])
  );
}

export function writeDiscoveredDrawingsMemory(value: Record<string, Record<string, string[]>>) {
  writeJson(discoveredDrawingsStorageKey, value);
}

export function normalizeSelectionRect(rect: {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}) {
  return {
    x: Math.min(rect.startX, rect.currentX),
    y: Math.min(rect.startY, rect.currentY),
    width: Math.abs(rect.currentX - rect.startX),
    height: Math.abs(rect.currentY - rect.startY)
  };
}

export function pathBoundsIntersectsRect(
  points: Point[],
  rect: { x: number; y: number; width: number; height: number }
) {
  if (points.length === 0) {
    return false;
  }

  const bounds = getBounds(points);

  return !(
    bounds.maxX < rect.x ||
    bounds.minX > rect.x + rect.width ||
    bounds.maxY < rect.y ||
    bounds.minY > rect.y + rect.height
  );
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

function midpoint(start: Point, end: Point) {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2
  };
}

function getBeamPolygon(start: Point, end: Point, width: number) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const offsetX = Math.sin(angle) * (width / 2);
  const offsetY = -Math.cos(angle) * (width / 2);

  return [
    { x: start.x - offsetX, y: start.y - offsetY },
    { x: end.x - offsetX, y: end.y - offsetY },
    { x: end.x + offsetX, y: end.y + offsetY },
    { x: start.x + offsetX, y: start.y + offsetY }
  ];
}

function getConePolygon(start: Point, end: Point, angleDegrees: 45 | 60 | 90) {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
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
  const steps = Math.max(18, Math.min(64, Math.round(radius / 10)));

  return Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2;
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    };
  });
}

function formatSquares(value: number) {
  if (Math.abs(value - Math.round(value)) < 0.05) {
    return `${Math.round(value)} sq`;
  }

  return `${value.toFixed(1)} sq`;
}

function getMeasureDistanceSquares(map: CampaignMap, preview: MeasurePreview) {
  const distance = Math.hypot(preview.end.x - preview.start.x, preview.end.y - preview.start.y);
  return distance / map.grid.cellSize;
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

export function pointsToSvgPath(points: Point[], closed: boolean) {
  if (points.length === 0) {
    return "";
  }

  return `${points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ")}${closed ? " Z" : ""}`;
}

export function normalizeDegrees(value: number) {
  let next = value % 360;

  if (next <= -180) {
    next += 360;
  }

  if (next > 180) {
    next -= 360;
  }

  return next;
}

export function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
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
