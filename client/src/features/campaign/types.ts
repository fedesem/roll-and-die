import type {
  ActorKind,
  ActorSheet,
  BoardToken,
  CampaignMap,
  MapActorAssignment,
  MeasurePreview,
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
  token: BoardToken | null;
}

export interface AvailableActorEntry {
  actor: ActorSheet;
  activeMaps: CampaignMap[];
  onCurrentMap: boolean;
}
