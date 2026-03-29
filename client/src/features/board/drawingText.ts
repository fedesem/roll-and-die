import type { DrawingTextFont, DrawingStroke, Point } from "@shared/types";

export const drawingTextFontOptions: Array<{ value: DrawingTextFont; label: string }> = [
  { value: "sans", label: "Arial" },
  { value: "serif", label: "Times" },
  { value: "mono", label: "Courier New" },
  { value: "script", label: "Georgia" }
];

export const drawingTextSizeOptions = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 72, 96];

let textMeasureContext: CanvasRenderingContext2D | null = null;

export function getDrawingTextFontStack(fontFamily: DrawingTextFont) {
  if (fontFamily === "sans") {
    return "Arial, Helvetica, sans-serif";
  }

  if (fontFamily === "mono") {
    return "\"Courier New\", Courier, monospace";
  }

  if (fontFamily === "script") {
    return "Georgia, \"Palatino Linotype\", \"Book Antiqua\", serif";
  }

  return "\"Times New Roman\", Times, serif";
}

export function normalizeDrawingText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function getDrawingTextMetrics(
  text: string,
  size: number,
  fontFamily: DrawingTextFont,
  bold = false,
  italic = false
) {
  const normalizedText = normalizeDrawingText(text);
  const normalizedSize = clamp(size, 12, 96);
  const lines = normalizedText.length > 0 ? normalizedText.split("\n") : [""];
  const paddingX = Math.max(10, normalizedSize * 0.45);
  const paddingY = Math.max(8, normalizedSize * 0.32);
  const lineHeight = normalizedSize * 1.24;
  const fontStack = getDrawingTextFontStack(fontFamily);
  const context = getTextMeasureContext();

  if (context) {
    context.font = `${italic ? "italic " : ""}${bold ? "700" : "400"} ${normalizedSize}px ${fontStack}`;
  }

  const widestLine = lines.reduce((max, line) => {
    const measuredWidth = context ? context.measureText(line || "M").width : Math.max(normalizedSize * 0.66, line.length * normalizedSize * 0.58);
    return Math.max(max, measuredWidth);
  }, normalizedSize * 0.66);

  return {
    fontStack,
    lines,
    lineHeight,
    paddingX,
    paddingY,
    width: widestLine + paddingX * 2,
    height: lines.length * lineHeight + paddingY * 2
  };
}

export function buildTextDrawingPoints(
  origin: Point,
  text: string,
  size: number,
  fontFamily: DrawingTextFont,
  bold = false,
  italic = false
): Point[] {
  const metrics = getDrawingTextMetrics(text, size, fontFamily, bold, italic);

  return [
    origin,
    {
      x: origin.x + metrics.width,
      y: origin.y + metrics.height
    }
  ];
}

export function getTextDrawingBounds(drawing: Pick<DrawingStroke, "points">) {
  const [start, end] = drawing.points;

  if (!start || !end) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0
    };
  }

  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTextMeasureContext() {
  if (textMeasureContext) {
    return textMeasureContext;
  }

  if (typeof document === "undefined") {
    return null;
  }

  textMeasureContext = document.createElement("canvas").getContext("2d");
  return textMeasureContext;
}
