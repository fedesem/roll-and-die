import type { DrawingKind, DrawingStroke, DrawingTextFont, MeasurePreview, MemberRole, Point, TokenMovementPreview } from "@shared/types";

export type Tool = "select" | "draw" | "measure";
export type SelectedMapItem = `drawing:${string}`;

export interface DragState {
  actorId: string;
  start: Point;
}

export interface DrawingDraftState {
  id: string;
  color: string;
  fillColor: string;
  fillOpacity: number;
  kind: DrawingKind;
  text: string;
  fontFamily: DrawingTextFont;
  bold: boolean;
  italic: boolean;
  points: Point[];
  rotation: number;
  size: number;
  strokeOpacity: number;
}

export interface TextDraftState {
  point: Point;
  screenX: number;
  screenY: number;
  text: string;
}

export type RenderableDrawing = Pick<
  DrawingStroke,
  | "id"
  | "kind"
  | "text"
  | "fontFamily"
  | "bold"
  | "italic"
  | "color"
  | "strokeOpacity"
  | "fillColor"
  | "fillOpacity"
  | "size"
  | "rotation"
  | "points"
>;

export interface DrawingMoveState {
  drawingIds: string[];
  moved: boolean;
  origin: Point;
  snapshots: Record<string, { points: Point[]; rotation: number }>;
}

export interface DrawingRotationState {
  drawingId: string;
  baseRotation: number;
  center: Point;
  moved: boolean;
  points: Point[];
  startAngle: number;
}

export interface MeasuringState {
  rawStart: Point;
  rawEnd: Point;
}

export interface PanState {
  button: number;
  clientX: number;
  clientY: number;
  originX: number;
  originY: number;
  menu?:
    | {
        kind: "board";
        point: Point;
      }
    | {
        kind: "token";
        tokenId: string;
        actorId: string;
      };
  menuX?: number;
  menuY?: number;
}

export interface SelectionState {
  additive: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export type ContextMenuState =
  | {
      kind: "board";
      x: number;
      y: number;
      point: Point;
    }
  | {
      kind: "token";
      x: number;
      y: number;
      tokenId: string;
    };

export interface BoardMovementPreviewEntry {
  actorId: string;
  mapId: string;
  preview: TokenMovementPreview;
}

export interface BoardMeasurePreviewEntry {
  userId: string;
  mapId: string;
  preview: MeasurePreview;
}

export interface BoardFogPlayer {
  userId: string;
  name: string;
}

export type BoardRole = MemberRole;
