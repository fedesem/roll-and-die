export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type MemberRole = "dm" | "player";
export type ActorKind = "character" | "npc" | "monster";
export type ChatMessageKind = "message" | "roll" | "system";
export type CellKey = string;

export interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface HitPoints {
  current: number;
  max: number;
  temp: number;
}

export interface SkillEntry {
  id: string;
  name: string;
  ability: AbilityKey;
  proficient: boolean;
  expertise: boolean;
}

export interface SpellSlotTrack {
  level: number;
  total: number;
  used: number;
}

export interface AttackEntry {
  id: string;
  name: string;
  attackBonus: number;
  damage: string;
  damageType: string;
  notes: string;
}

export interface ArmorEntry {
  id: string;
  name: string;
  armorClass: number;
  notes: string;
}

export interface ResourceEntry {
  id: string;
  name: string;
  current: number;
  max: number;
  resetOn: string;
}

export interface InventoryEntry {
  id: string;
  name: string;
  quantity: number;
}

export interface CurrencyPouch {
  pp: number;
  gp: number;
  ep: number;
  sp: number;
  cp: number;
}

export interface ActorSheet {
  id: string;
  campaignId: string;
  ownerId?: string;
  templateId?: string;
  name: string;
  kind: ActorKind;
  className: string;
  species: string;
  background: string;
  alignment: string;
  level: number;
  challengeRating: string;
  experience: number;
  spellcastingAbility: AbilityKey;
  armorClass: number;
  initiative: number;
  speed: number;
  proficiencyBonus: number;
  inspiration: boolean;
  visionRange: number;
  hitPoints: HitPoints;
  hitDice: string;
  abilities: AbilityScores;
  skills: SkillEntry[];
  spellSlots: SpellSlotTrack[];
  features: string[];
  spells: string[];
  talents: string[];
  feats: string[];
  attacks: AttackEntry[];
  armorItems: ArmorEntry[];
  resources: ResourceEntry[];
  inventory: InventoryEntry[];
  currency: CurrencyPouch;
  notes: string;
  color: string;
}

export interface MonsterTemplate {
  id: string;
  name: string;
  source: string;
  challengeRating: string;
  armorClass: number;
  hitPoints: number;
  speed: number;
  abilities: AbilityScores;
  traits: string[];
  actions: string[];
  spells: string[];
  color: string;
}

export interface CampaignMember {
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
}

export interface CampaignInvite {
  id: string;
  code: string;
  label: string;
  role: MemberRole;
  createdAt: string;
  createdBy: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface DrawingStroke {
  id: string;
  color: string;
  size: number;
  points: Point[];
}

export type MapWallKind = "wall" | "transparent" | "door";

export interface MapWall {
  id: string;
  start: Point;
  end: Point;
  kind: MapWallKind;
  isOpen: boolean;
}

export interface FogRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridConfig {
  show: boolean;
  cellSize: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  color: string;
}

export interface CampaignMap {
  id: string;
  name: string;
  backgroundUrl: string;
  backgroundOffsetX: number;
  backgroundOffsetY: number;
  backgroundScale: number;
  width: number;
  height: number;
  grid: GridConfig;
  walls: MapWall[];
  drawings: DrawingStroke[];
  fog: FogRect[];
  visibilityVersion: number;
}

export interface BoardToken {
  id: string;
  actorId: string;
  actorKind: ActorKind;
  mapId: string;
  x: number;
  y: number;
  size: number;
  color: string;
  label: string;
  visible: boolean;
}

export interface DiceRoll {
  id: string;
  label: string;
  notation: string;
  rolls: number[];
  modifier: number;
  total: number;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  campaignId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
  kind: ChatMessageKind;
  roll?: DiceRoll;
}

export interface Campaign {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  activeMapId: string;
  members: CampaignMember[];
  invites: CampaignInvite[];
  actors: ActorSheet[];
  maps: CampaignMap[];
  tokens: BoardToken[];
  chat: ChatMessage[];
  exploration: Record<string, Record<string, CellKey[]>>;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export interface AuthPayload {
  token: string;
  user: UserProfile;
}

export interface CampaignSummary {
  id: string;
  name: string;
  role: MemberRole;
  memberCount: number;
  actorCount: number;
  mapCount: number;
  createdAt: string;
}

export interface CampaignSnapshot {
  campaign: Campaign;
  currentUser: UserProfile;
  role: MemberRole;
  catalog: MonsterTemplate[];
  playerVision: Record<string, CellKey[]>;
}

export type ClientRoomMessage =
  | {
      type: "room:join";
      token: string;
      campaignId: string;
    }
  | {
      type: "chat:send";
      text: string;
    }
  | {
      type: "roll:send";
      notation: string;
      label: string;
    }
  | {
      type: "token:move";
      actorId: string;
      x: number;
      y: number;
    }
  | {
      type: "map:set-active";
      mapId: string;
    }
  | {
      type: "fog:reset";
      mapId: string;
    }
  | {
      type: "door:toggle";
      doorId: string;
    };

export type ServerRoomMessage =
  | {
      type: "room:snapshot";
      snapshot: CampaignSnapshot;
    }
  | {
      type: "room:error";
      message: string;
    }
  | {
      type: "room:joined";
      campaignId: string;
    };
