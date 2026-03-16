import type {
  ActorSheet,
  BoardToken,
  CampaignMap,
  CellKey,
  MapWall,
  MemberRole,
  Point
} from "./types.js";

const defaultVisionRange = 6;

export interface MovementTrace {
  blocked: boolean;
  cells: CellKey[];
  end: Point;
  points: Point[];
  steps: number;
}

interface MovementOptions {
  ignoreWalls?: boolean;
}

export function gridDimensions(map: CampaignMap) {
  return {
    columns: Math.max(1, Math.floor(map.width / map.grid.cellSize)),
    rows: Math.max(1, Math.floor(map.height / map.grid.cellSize))
  };
}

export function cellKey(column: number, row: number): CellKey {
  return `${column}:${row}`;
}

export function parseCellKey(key: CellKey) {
  const [columnText, rowText] = key.split(":");
  return {
    column: Number(columnText),
    row: Number(rowText)
  };
}

export function cellCenter(map: CampaignMap, column: number, row: number): Point {
  return {
    x: map.grid.offsetX + map.grid.cellSize / 2 + column * map.grid.cellSize,
    y: map.grid.offsetY + map.grid.cellSize / 2 + row * map.grid.cellSize
  };
}

export function pointToCell(map: CampaignMap, point: Point) {
  const column = Math.round((point.x - map.grid.offsetX - map.grid.cellSize / 2) / map.grid.cellSize);
  const row = Math.round((point.y - map.grid.offsetY - map.grid.cellSize / 2) / map.grid.cellSize);

  return {
    column,
    row
  };
}

export function snapPointToGrid(map: CampaignMap, point: Point): Point {
  const cell = pointToCell(map, point);
  return cellCenter(map, cell.column, cell.row);
}

export function snapPointToGridIntersection(map: CampaignMap, point: Point): Point {
  const column = Math.round((point.x - map.grid.offsetX) / map.grid.cellSize);
  const row = Math.round((point.y - map.grid.offsetY) / map.grid.cellSize);

  return {
    x: map.grid.offsetX + column * map.grid.cellSize,
    y: map.grid.offsetY + row * map.grid.cellSize
  };
}

export function tokenCellKey(map: CampaignMap, token: BoardToken) {
  const cell = pointToCell(map, { x: token.x, y: token.y });
  return cellKey(cell.column, cell.row);
}

export function allMapCells(map: CampaignMap) {
  const { columns, rows } = gridDimensions(map);
  const keys: CellKey[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      keys.push(cellKey(column, row));
    }
  }

  return keys;
}

export function computeVisibleCellsForUser({
  map,
  actors,
  tokens,
  userId,
  role
}: {
  map: CampaignMap;
  actors: ActorSheet[];
  tokens: BoardToken[];
  userId: string;
  role: MemberRole;
}) {
  if (role === "dm") {
    return new Set<CellKey>();
  }

  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
  const controlledTokens = tokens.filter((token) => {
    const actor = actorById.get(token.actorId);
    return token.mapId === map.id && actor?.kind === "character" && actor.ownerId === userId;
  });

  const visible = new Set<CellKey>();

  for (const token of controlledTokens) {
    const actor = actorById.get(token.actorId);

    if (!actor) {
      continue;
    }

    const rangeCells = Math.max(1, actor.visionRange || defaultVisionRange);
    const rangePx = rangeCells * map.grid.cellSize;
    const origin = { x: token.x, y: token.y };
    const originCell = pointToCell(map, origin);
    const minColumn = originCell.column - rangeCells;
    const maxColumn = originCell.column + rangeCells;
    const minRow = originCell.row - rangeCells;
    const maxRow = originCell.row + rangeCells;

    for (let row = minRow; row <= maxRow; row += 1) {
      for (let column = minColumn; column <= maxColumn; column += 1) {
        const target = cellCenter(map, column, row);
        const distance = Math.hypot(target.x - origin.x, target.y - origin.y);

        if (distance > rangePx) {
          continue;
        }

        if (hasLineOfSight(origin, target, map.walls)) {
          visible.add(cellKey(column, row));
        }
      }
    }
  }

  return visible;
}

export function hasLineOfSight(start: Point, end: Point, walls: CampaignMap["walls"]) {
  return isSegmentPassable(start, end, walls, "view");
}

export function canTraverseSegment(start: Point, end: Point, walls: CampaignMap["walls"]) {
  return isSegmentPassable(start, end, walls, "movement");
}

function isSegmentPassable(
  start: Point,
  end: Point,
  walls: CampaignMap["walls"],
  mode: "view" | "movement"
) {
  const sharedCornerHits = new Map<string, number>();

  for (const wall of walls) {
    if (!obstacleBlocksMode(wall, mode)) {
      continue;
    }

    const intersection = describeSegmentIntersection(start, end, wall.start, wall.end);

    if (intersection.kind === "cross" || intersection.kind === "overlap") {
      return false;
    }

    if (intersection.kind !== "touch" || !intersection.point) {
      continue;
    }

    if (isSamePoint(intersection.point, start) || isSamePoint(intersection.point, end)) {
      continue;
    }

    if (!isSamePoint(intersection.point, wall.start) && !isSamePoint(intersection.point, wall.end)) {
      return false;
    }

    const key = pointKey(intersection.point);
    sharedCornerHits.set(key, (sharedCornerHits.get(key) ?? 0) + 1);
  }

  for (const count of sharedCornerHits.values()) {
    if (count >= 2) {
      return false;
    }
  }

  return true;
}

export function traceMovementPath(
  map: CampaignMap,
  start: Point,
  target: Point,
  options: MovementOptions = {}
): MovementTrace {
  const startCell = pointToCell(map, start);
  const targetCell = pointToCell(map, target);
  const traversedCells = lineCells(startCell.column, startCell.row, targetCell.column, targetCell.row);
  const points = [cellCenter(map, traversedCells[0].column, traversedCells[0].row)];
  const cells = [cellKey(traversedCells[0].column, traversedCells[0].row)];
  let blocked = false;

  for (let index = 1; index < traversedCells.length; index += 1) {
    const previous = traversedCells[index - 1];
    const next = traversedCells[index];
    const previousPoint = cellCenter(map, previous.column, previous.row);
    const nextPoint = cellCenter(map, next.column, next.row);

    if (!options.ignoreWalls && !canTraverseSegment(previousPoint, nextPoint, map.walls)) {
      blocked = true;
      break;
    }

    points.push(nextPoint);
    cells.push(cellKey(next.column, next.row));
  }

  return {
    blocked,
    cells,
    end: points[points.length - 1],
    points,
    steps: Math.max(0, points.length - 1)
  };
}

export function obstacleBlocksVision(wall: MapWall) {
  return wall.kind === "wall" || (wall.kind === "door" && !wall.isOpen);
}

export function obstacleBlocksMovement(wall: MapWall) {
  return wall.kind === "wall" || wall.kind === "transparent" || (wall.kind === "door" && !wall.isOpen);
}

export function obstacleMidpoint(wall: MapWall): Point {
  return {
    x: (wall.start.x + wall.end.x) / 2,
    y: (wall.start.y + wall.end.y) / 2
  };
}

function obstacleBlocksMode(wall: MapWall, mode: "view" | "movement") {
  return mode === "view" ? obstacleBlocksVision(wall) : obstacleBlocksMovement(wall);
}

type SegmentIntersection =
  | { kind: "none" }
  | { kind: "touch"; point: Point }
  | { kind: "cross"; point: Point }
  | { kind: "overlap" };

function describeSegmentIntersection(a: Point, b: Point, c: Point, d: Point): SegmentIntersection {
  const ab = subtractPoint(b, a);
  const cd = subtractPoint(d, c);
  const ac = subtractPoint(c, a);
  const denominator = crossProduct(ab, cd);
  const epsilon = 0.0001;

  if (Math.abs(denominator) < epsilon) {
    if (Math.abs(crossProduct(ac, ab)) > epsilon) {
      return { kind: "none" };
    }

    if (!boundingBoxesOverlap(a, b, c, d)) {
      return { kind: "none" };
    }

    return { kind: "overlap" };
  }

  const ua = crossProduct(ac, cd) / denominator;
  const ub = crossProduct(ac, ab) / denominator;

  if (ua < -epsilon || ua > 1 + epsilon || ub < -epsilon || ub > 1 + epsilon) {
    return { kind: "none" };
  }

  const point = {
    x: a.x + ab.x * ua,
    y: a.y + ab.y * ua
  };
  const intersectsRayInterior = ua > epsilon && ua < 1 - epsilon;
  const intersectsWallInterior = ub > epsilon && ub < 1 - epsilon;

  return intersectsRayInterior && intersectsWallInterior
    ? { kind: "cross", point }
    : { kind: "touch", point };
}

function subtractPoint(a: Point, b: Point): Point {
  return {
    x: a.x - b.x,
    y: a.y - b.y
  };
}

function crossProduct(a: Point, b: Point) {
  return a.x * b.y - a.y * b.x;
}

function boundingBoxesOverlap(a: Point, b: Point, c: Point, d: Point) {
  const epsilon = 0.0001;
  const overlapX =
    Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) >=
    Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) - epsilon;
  const overlapY =
    Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) >=
    Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) - epsilon;

  return overlapX && overlapY;
}

function isSamePoint(a: Point, b: Point) {
  return Math.abs(a.x - b.x) < 0.0001 && Math.abs(a.y - b.y) < 0.0001;
}

function pointKey(point: Point) {
  return `${point.x.toFixed(4)}:${point.y.toFixed(4)}`;
}

function lineCells(startColumn: number, startRow: number, endColumn: number, endRow: number) {
  const cells: Array<{ column: number; row: number }> = [];
  let column = startColumn;
  let row = startRow;
  const deltaColumn = Math.abs(endColumn - startColumn);
  const deltaRow = Math.abs(endRow - startRow);
  const stepColumn = startColumn < endColumn ? 1 : -1;
  const stepRow = startRow < endRow ? 1 : -1;
  let error = deltaColumn - deltaRow;

  while (true) {
    cells.push({ column, row });

    if (column === endColumn && row === endRow) {
      break;
    }

    const doubledError = error * 2;

    if (doubledError > -deltaRow) {
      error -= deltaRow;
      column += stepColumn;
    }

    if (doubledError < deltaColumn) {
      error += deltaColumn;
      row += stepRow;
    }
  }

  return cells;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
