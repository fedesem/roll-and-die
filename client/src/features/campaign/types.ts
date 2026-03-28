import type {
  ActorKind,
  ActorSheet,
  BoardToken,
  CampaignMap,
  MapActorAssignment,
  MemberRole,
  MeasurePreview,
  TokenRotation,
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
  isImplicitAssignment: boolean;
  ownerName: string | null;
  color: string;
  label: string;
  imageUrl: string;
  token: BoardToken | null;
}

export interface AvailableActorEntry {
  actor: ActorSheet;
  activeMaps: CampaignMap[];
  onCurrentMap: boolean;
  isOnAllMaps: boolean;
  ownerName: string;
  ownerRole: MemberRole | null;
}

export interface TokenUpdatePatch {
  mapId?: string;
  x?: number;
  y?: number;
  rotationDegrees?: TokenRotation;
  color?: string;
  label?: string;
  visible?: boolean;
  statusMarkers?: TokenStatusMarker[];
}
