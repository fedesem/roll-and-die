import type { CSSProperties } from "react";

interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface GridStyleOptions {
  cellSize: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  color: string;
  alphaMultiplier?: number;
  blendWeight?: number;
  minAlpha?: number;
  maxAlpha?: number;
}

const woodGridBlendTarget: RgbaColor = {
  r: 110,
  g: 90,
  b: 66,
  a: 1
};

const fallbackGridLineColor = "rgba(110, 90, 66, 0.2)";

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampAlpha(value: number) {
  return Math.max(0, Math.min(1, value));
}

function parseCssColor(value: string): RgbaColor | null {
  const normalized = value.trim();
  const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

  if (hexMatch) {
    const hex = hexMatch[1];
    const expanded = hex.length === 3 ? hex.split("").map((entry) => `${entry}${entry}`).join("") : hex;

    return {
      r: Number.parseInt(expanded.slice(0, 2), 16),
      g: Number.parseInt(expanded.slice(2, 4), 16),
      b: Number.parseInt(expanded.slice(4, 6), 16),
      a: 1
    };
  }

  const rgbaMatch = normalized.match(
    /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})(?:\s*(?:[,/])\s*(\d*\.?\d+))?\s*\)$/i
  );

  if (rgbaMatch) {
    return {
      r: clampByte(Number(rgbaMatch[1])),
      g: clampByte(Number(rgbaMatch[2])),
      b: clampByte(Number(rgbaMatch[3])),
      a: clampAlpha(rgbaMatch[4] ? Number(rgbaMatch[4]) : 1)
    };
  }

  return null;
}

function mixChannel(source: number, target: number, blendWeight: number) {
  return clampByte(source * (1 - blendWeight) + target * blendWeight);
}

function getMutedGridLineColor(
  color: string,
  {
    alphaMultiplier = 1,
    blendWeight = 0.68,
    minAlpha = 0.1,
    maxAlpha = 0.24
  }: Pick<GridStyleOptions, "alphaMultiplier" | "blendWeight" | "minAlpha" | "maxAlpha">
) {
  const parsed = parseCssColor(color);

  if (!parsed) {
    return fallbackGridLineColor;
  }

  const alpha = clampAlpha(Math.min(maxAlpha, Math.max(minAlpha, parsed.a * 0.42 * alphaMultiplier)));

  return `rgba(${mixChannel(parsed.r, woodGridBlendTarget.r, blendWeight)}, ${mixChannel(parsed.g, woodGridBlendTarget.g, blendWeight)}, ${mixChannel(parsed.b, woodGridBlendTarget.b, blendWeight)}, ${alpha})`;
}

export function createGridStyle({
  cellSize,
  scale,
  offsetX,
  offsetY,
  color,
  alphaMultiplier,
  blendWeight,
  minAlpha,
  maxAlpha
}: GridStyleOptions): CSSProperties {
  const cell = cellSize * scale;
  const lineColor = getMutedGridLineColor(color, {
    alphaMultiplier,
    blendWeight,
    minAlpha,
    maxAlpha
  });

  return {
    backgroundImage: `linear-gradient(to right, ${lineColor} 1px, transparent 1px), linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)`,
    backgroundSize: `${cell}px ${cell}px`,
    backgroundPosition: `${offsetX}px ${offsetY}px`
  };
}
