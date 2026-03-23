import type {
  ActorKind,
  ActorSheet,
  BoardToken,
  CampaignMap,
  MapActorAssignment,
  MeasurePreview,
  TokenStatusMarker,
  TokenMovementPreview
} from "@shared/types";

export type ActorTypeFilter = "all" | ActorKind;

export interface BannerState {
  tone: "info" | "error";
  text: string;
}

export interface SharedMovementPreviewState {
  actorId: string;
  mapId: string;
  preview: TokenMovementPreview;
}

export interface SharedMeasurePreviewState {
  userId: string;
  mapId: string;
  preview: MeasurePreview;
}

export interface CurrentMapRosterEntry {
  actor: ActorSheet | null;
  actorKind: ActorKind;
  assignment: MapActorAssignment;
  color: string;
  label: string;
  imageUrl: string;
  token: BoardToken | null;
}

export interface AvailableActorEntry {
  actor: ActorSheet;
  activeMaps: CampaignMap[];
  onCurrentMap: boolean;
}

export interface TokenUpdatePatch {
  mapId?: string;
  x?: number;
  y?: number;
  size?: number;
  color?: string;
  label?: string;
  visible?: boolean;
  statusMarkers?: TokenStatusMarker[];
}
