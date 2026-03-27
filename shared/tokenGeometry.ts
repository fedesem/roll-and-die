import type {
  ActorCreatureSize,
  ActorSheet,
  BoardToken,
  CampaignMap,
  CellKey,
  Point,
  TokenFootprint,
  TokenRotation
} from "./types.js";

const creatureTokenSizes = [0.5, 1, 2, 3, 4] as const;
const maxStaticTokenDimension = 12;

export const CREATURE_SIZE_OPTIONS = [
  { value: "tiny", label: "Tiny", squares: 0.5 },
  { value: "small", label: "Small", squares: 1 },
  { value: "medium", label: "Medium", squares: 1 },
  { value: "large", label: "Large", squares: 2 },
  { value: "huge", label: "Huge", squares: 3 },
  { value: "gargantuan", label: "Gargantuan", squares: 4 }
] as const;

export function clampCreatureTokenSize(value: number) {
  return creatureTokenSizes.reduce((closest, current) =>
    Math.abs(current - value) < Math.abs(closest - value) ? current : closest
  );
}

export function clampStaticTokenDimension(value: number) {
  const rounded = Math.round(Number.isFinite(value) ? value : 1);
  return Math.max(1, Math.min(maxStaticTokenDimension, rounded));
}

export function normalizeCreatureSize(
  value: unknown,
  fallback: ActorCreatureSize = "medium"
): ActorCreatureSize {
  switch (value) {
    case "tiny":
    case "small":
    case "medium":
    case "large":
    case "huge":
    case "gargantuan":
      return value;
    default:
      return fallback;
  }
}

export function getCreatureSizeSquares(size: ActorCreatureSize) {
  return CREATURE_SIZE_OPTIONS.find((option) => option.value === size)?.squares ?? 1;
}

export function deriveCreatureSizeFromTokenSize(
  value: number,
  fallback: ActorCreatureSize = "medium"
): ActorCreatureSize {
  const clamped = clampCreatureTokenSize(value);

  switch (clamped) {
    case 0.5:
      return "tiny";
    case 2:
      return "large";
    case 3:
      return "huge";
    case 4:
      return "gargantuan";
    default:
      return fallback;
  }
}

export function normalizeTokenRotation(value: number): TokenRotation {
  const normalized = ((Math.round(value / 90) * 90) % 360 + 360) % 360;

  switch (normalized) {
    case 90:
    case 180:
    case 270:
      return normalized;
    default:
      return 0;
  }
}

export function getTokenFootprint(token: Pick<BoardToken, "size" | "widthSquares" | "heightSquares">): TokenFootprint {
  const size = clampCreatureTokenSize(typeof token.size === "number" ? token.size : 1);
  const widthSquares =
    typeof token.widthSquares === "number" && token.widthSquares > 0 ? token.widthSquares : size;
  const heightSquares =
    typeof token.heightSquares === "number" && token.heightSquares > 0 ? token.heightSquares : size;

  return {
    widthSquares,
    heightSquares
  };
}

export function getActorTokenFootprint(
  actor: Pick<ActorSheet, "kind" | "creatureSize" | "tokenWidthSquares" | "tokenLengthSquares">,
  rotationDegrees: TokenRotation = 0
) {
  if (actor.kind !== "static") {
    const size = getCreatureSizeSquares(normalizeCreatureSize(actor.creatureSize));

    return {
      size,
      widthSquares: size,
      heightSquares: size
    };
  }

  const widthSquares = clampStaticTokenDimension(actor.tokenWidthSquares);
  const lengthSquares = clampStaticTokenDimension(actor.tokenLengthSquares);
  const rotated = rotationDegrees === 90 || rotationDegrees === 270;

  return {
    size: Math.max(widthSquares, lengthSquares),
    widthSquares: rotated ? lengthSquares : widthSquares,
    heightSquares: rotated ? widthSquares : lengthSquares
  };
}

export function snapTokenToGrid(map: CampaignMap, point: Point, footprint: TokenFootprint): Point {
  const { x: xOffset, y: yOffset } = getTokenSnapOffsets(map, footprint);

  return {
    x: xOffset + Math.round((point.x - xOffset) / map.grid.cellSize) * map.grid.cellSize,
    y: yOffset + Math.round((point.y - yOffset) / map.grid.cellSize) * map.grid.cellSize
  };
}

export function getTokenGridPosition(map: CampaignMap, point: Point, footprint: TokenFootprint) {
  const { x: xOffset, y: yOffset } = getTokenSnapOffsets(map, footprint);

  return {
    column: Math.round((point.x - xOffset) / map.grid.cellSize),
    row: Math.round((point.y - yOffset) / map.grid.cellSize)
  };
}

export function getTokenGridCenter(
  map: CampaignMap,
  column: number,
  row: number,
  footprint: TokenFootprint
) {
  const { x: xOffset, y: yOffset } = getTokenSnapOffsets(map, footprint);

  return {
    x: xOffset + column * map.grid.cellSize,
    y: yOffset + row * map.grid.cellSize
  };
}

export function getFootprintSamplePoints(
  map: CampaignMap,
  center: Point,
  footprint: TokenFootprint
): Point[] {
  if (
    footprint.widthSquares < 1 ||
    footprint.heightSquares < 1 ||
    !Number.isInteger(footprint.widthSquares) ||
    !Number.isInteger(footprint.heightSquares)
  ) {
    return [{ x: center.x, y: center.y }];
  }

  const points: Point[] = [];
  const halfWidthOffset = (footprint.widthSquares - 1) / 2;
  const halfHeightOffset = (footprint.heightSquares - 1) / 2;

  for (let rowIndex = 0; rowIndex < footprint.heightSquares; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < footprint.widthSquares; columnIndex += 1) {
      points.push({
        x: center.x + (columnIndex - halfWidthOffset) * map.grid.cellSize,
        y: center.y + (rowIndex - halfHeightOffset) * map.grid.cellSize
      });
    }
  }

  return points;
}

export function getTokenOccupiedCellKeys(
  map: CampaignMap,
  token: Pick<BoardToken, "x" | "y" | "size" | "widthSquares" | "heightSquares">
) {
  return getFootprintOccupiedCellKeys(map, { x: token.x, y: token.y }, getTokenFootprint(token));
}

export function getFootprintOccupiedCellKeys(map: CampaignMap, center: Point, footprint: TokenFootprint) {
  const keys = new Set<CellKey>();

  for (const point of getFootprintSamplePoints(map, center, footprint)) {
    const column = Math.round((point.x - map.grid.offsetX - map.grid.cellSize / 2) / map.grid.cellSize);
    const row = Math.round((point.y - map.grid.offsetY - map.grid.cellSize / 2) / map.grid.cellSize);
    keys.add(`${column}:${row}`);
  }

  return Array.from(keys);
}

function getTokenSnapOffsets(map: CampaignMap, footprint: TokenFootprint) {
  return {
    x: map.grid.offsetX + (usesIntersectionAlignment(footprint.widthSquares) ? 0 : map.grid.cellSize / 2),
    y: map.grid.offsetY + (usesIntersectionAlignment(footprint.heightSquares) ? 0 : map.grid.cellSize / 2)
  };
}

function usesIntersectionAlignment(sizeSquares: number) {
  return Number.isInteger(sizeSquares) && sizeSquares >= 2 && sizeSquares % 2 === 0;
}
