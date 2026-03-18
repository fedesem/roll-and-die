export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type MemberRole = "dm" | "player";
export type ActorKind = "character" | "npc" | "monster" | "static";
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
  sheetAccess?: "full" | "restricted";
  name: string;
  kind: ActorKind;
  imageUrl: string;
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

export interface MonsterSpeedModes {
  walk: number;
  fly: number;
  burrow: number;
  swim: number;
  climb: number;
}

export interface MonsterSkillBonus {
  name: string;
  bonus: number;
}

export interface MonsterSense {
  name: string;
  range: number;
  notes: string;
}

export type MonsterAttackType = "melee" | "ranged" | "melee or ranged" | "other";

export interface MonsterActionEntry {
  name: string;
  description: string;
  damage: string;
  attackType: MonsterAttackType;
  attackBonus: number;
  reachOrRange: string;
  damageType: string;
}

export interface MonsterSpellcastingEntry {
  label: string;
  spells: string[];
}

export interface MonsterTemplate {
  id: string;
  name: string;
  source: string;
  challengeRating: string;
  armorClass: number;
  hitPoints: number;
  initiative: number;
  speed: number;
  speedModes: MonsterSpeedModes;
  abilities: AbilityScores;
  skills: MonsterSkillBonus[];
  senses: MonsterSense[];
  passivePerception: number;
  languages: string[];
  xp: number;
  proficiencyBonus: number;
  gear: string[];
  resistances: string[];
  vulnerabilities: string[];
  immunities: string[];
  traits: string[];
  actions: MonsterActionEntry[];
  bonusActions: MonsterActionEntry[];
  reactions: MonsterActionEntry[];
  legendaryActions: MonsterActionEntry[];
  legendaryActionsUse: number;
  lairActions: MonsterActionEntry[];
  regionalEffects: MonsterActionEntry[];
  spells: string[];
  spellcasting: MonsterSpellcastingEntry[];
  habitat: string;
  treasure: string;
  imageUrl: string;
  color: string;
}

export type SpellLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | "cantrip";
export type SpellSchool =
  | "Abjuration"
  | "Conjuration"
  | "Divination"
  | "Enchantment"
  | "Evocation"
  | "Illusion"
  | "Necromancy"
  | "Transmutation";
export type SpellCastingTimeUnit = "action" | "bonus action" | "reaction" | "minute" | "hour";
export type SpellRangeType = "feet" | "self" | "self emanation" | "touch" | "sight" | "unlimited" | "special";
export type SpellDurationUnit = "instant" | "minute" | "hour" | "day" | "permanent" | "special";
export type SpellClassReferenceKind = "class" | "classVariant" | "subclass" | "subclassVariant";

export interface SpellComponents {
  verbal: boolean;
  somatic: boolean;
  material: boolean;
  materialText: string;
  materialValue: number;
  materialConsumed: boolean;
}

export interface SpellClassReference {
  name: string;
  source: string;
  kind: SpellClassReferenceKind;
  className: string;
  classSource: string;
}

export interface SpellEntry {
  id: string;
  name: string;
  source: string;
  level: SpellLevel;
  school: SpellSchool;
  castingTimeUnit: SpellCastingTimeUnit;
  castingTimeValue: number;
  rangeType: SpellRangeType;
  rangeValue: number;
  description: string;
  components: SpellComponents;
  durationUnit: SpellDurationUnit;
  durationValue: number;
  concentration: boolean;
  damageNotation: string;
  damageAbility: AbilityKey | null;
  higherLevelDescription: string;
  fullDescription: string;
  classes: string[];
  classReferences: SpellClassReference[];
}

export interface FeatEntry {
  id: string;
  name: string;
  source: string;
  category: string;
  abilityScoreIncrease: string;
  prerequisites: string;
  description: string;
}

export interface ClassFeatureEntry {
  level: number;
  name: string;
  description: string;
  source: string;
  reference: string;
}

export interface ClassTableEntry {
  name: string;
  columns: string[];
  rows: string[][];
}

export interface ClassStartingProficiencies {
  armor: string[];
  weapons: string[];
  tools: string[];
}

export interface ClassEntry {
  id: string;
  name: string;
  source: string;
  description: string;
  hitDieFaces: number;
  primaryAbilities: string[];
  savingThrowProficiencies: string[];
  startingProficiencies: ClassStartingProficiencies;
  features: ClassFeatureEntry[];
  tables: ClassTableEntry[];
}

export interface CompendiumData {
  spells: SpellEntry[];
  monsters: MonsterTemplate[];
  feats: FeatEntry[];
  classes: ClassEntry[];
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

export type DrawingKind = "freehand" | "circle" | "square" | "star";

export interface DrawingStroke {
  id: string;
  ownerId?: string;
  kind: DrawingKind;
  color: string;
  strokeOpacity: number;
  fillColor: string;
  fillOpacity: number;
  size: number;
  rotation: number;
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
  imageUrl: string;
  visible: boolean;
}

export interface MapActorAssignment {
  actorId: string;
  mapId: string;
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
  mapAssignments: MapActorAssignment[];
  tokens: BoardToken[];
  chat: ChatMessage[];
  exploration: Record<string, Record<string, CellKey[]>>;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
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

export interface AdminOverview {
  users: UserProfile[];
  compendium: CompendiumData;
}

export interface TokenMovementPreview {
  blocked: boolean;
  end: Point;
  points: Point[];
  steps: number;
}

export type MeasureKind = "line" | "cone" | "beam" | "emanation" | "square";
export type MeasureSnapMode = "center" | "corner" | "none";

export interface MeasurePreview {
  kind: MeasureKind;
  start: Point;
  end: Point;
  snapMode: MeasureSnapMode;
  coneAngle: 45 | 60 | 90;
  beamWidthSquares: number;
}

export interface MapPing {
  id: string;
  mapId: string;
  point: Point;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface MapViewportRecall {
  id: string;
  mapId: string;
  center: Point;
  zoom: number;
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
      type: "token:preview";
      actorId: string;
      target: Point | null;
    }
  | {
      type: "measure:preview";
      preview: MeasurePreview | null;
    }
  | {
      type: "drawing:create";
      mapId: string;
      stroke: DrawingStroke;
    }
  | {
      type: "drawing:update";
      mapId: string;
      drawings: Array<{
        id: string;
        points: Point[];
        rotation: number;
      }>;
    }
  | {
      type: "drawing:delete";
      mapId: string;
      drawingIds: string[];
    }
  | {
      type: "drawing:clear";
      mapId: string;
    }
  | {
      type: "map:set-active";
      mapId: string;
    }
  | {
      type: "map:ping";
      mapId: string;
      pingId?: string;
      point: Point;
    }
  | {
      type: "map:ping-recall";
      mapId: string;
      pingId?: string;
      point: Point;
      center: Point;
      zoom: number;
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
      type: "room:token-preview";
      actorId: string;
      mapId: string;
      preview: TokenMovementPreview | null;
    }
  | {
      type: "room:measure-preview";
      userId: string;
      mapId: string;
      preview: MeasurePreview | null;
    }
  | {
      type: "room:ping";
      ping: MapPing;
    }
  | {
      type: "room:view-recall";
      recall: MapViewportRecall;
    }
  | {
      type: "room:error";
      message: string;
    }
  | {
      type: "room:joined";
      campaignId: string;
    };
