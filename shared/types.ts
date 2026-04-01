export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type MemberRole = "dm" | "player";
export type ActorKind = "character" | "npc" | "monster" | "static";
export type ActorCreatureSize = "tiny" | "small" | "medium" | "large" | "huge" | "gargantuan";
export type ChatMessageKind = "message" | "roll" | "system";
export type CellKey = string;
export type TokenRotation = 0 | 90 | 180 | 270;

export interface TokenFootprint {
  widthSquares: number;
  heightSquares: number;
}

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
  reducedMax: number;
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
  kind: "armor" | "shield";
  armorClass: number;
  maxDexBonus: number | null;
  bonus: number;
  equipped: boolean;
  notes: string;
}

export interface ResourceEntry {
  id: string;
  name: string;
  current: number;
  max: number;
  resetOn: string;
  restoreAmount: number;
}

export type InventoryItemType = "gear" | "reagent" | "loot" | "consumable";

export interface InventoryEntry {
  id: string;
  name: string;
  type: InventoryItemType;
  quantity: number;
  equipped: boolean;
  notes: string;
}

export interface CurrencyPouch {
  pp: number;
  gp: number;
  ep: number;
  sp: number;
  cp: number;
}

export interface ActorClassEntry {
  id: string;
  compendiumId: string;
  name: string;
  source: string;
  level: number;
  hitDieFaces: number;
  usedHitDice: number;
  spellcastingAbility: AbilityKey | null;
}

export interface ActorSpellState {
  spellbook: string[];
  alwaysPrepared: string[];
  atWill: string[];
  perShortRest: string[];
  perLongRest: string[];
}

export interface ActorDeathSaveState {
  successes: number;
  failures: number;
  history?: Array<"success" | "failure">;
}

export type ActorBonusSourceType = "gear" | "buff";
export type ActorBonusTargetType = "armorClass" | "speed" | "ability" | "skill" | "savingThrow";

export interface ActorBonusEntry {
  id: string;
  name: string;
  sourceType: ActorBonusSourceType;
  targetType: ActorBonusTargetType;
  targetKey: string;
  value: number;
  enabled: boolean;
}

export interface ActorLayoutEntry {
  sectionId: string;
  column: number;
  order: number;
}

export type PlayerNpcBuildMode = "guided" | "manual";

export interface PlayerNpcBuildClassEntry {
  id: string;
  classId: string;
  className: string;
  classSource: string;
  subclassId?: string;
  subclassName?: string;
  subclassSource?: string;
  level: number;
}

export interface PlayerNpcBuildSelection {
  id: string;
  kind: "feat" | "optionalFeature" | "spell" | "itemPackage" | "backgroundFeature" | "custom";
  level: number;
  compendiumId?: string;
  name: string;
  source: string;
  notes: string;
}

export interface PlayerNpcBuild {
  ruleset: "dnd-2024";
  mode: PlayerNpcBuildMode;
  speciesId?: string;
  speciesName?: string;
  speciesSource?: string;
  backgroundId?: string;
  backgroundName?: string;
  backgroundSource?: string;
  classes: PlayerNpcBuildClassEntry[];
  selections: PlayerNpcBuildSelection[];
}

export interface ActorSheet {
  id: string;
  campaignId: string;
  ownerId?: string;
  templateId?: string;
  sheetAccess?: "full" | "restricted";
  name: string;
  kind: ActorKind;
  creatureSize: ActorCreatureSize;
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
  initiativeRoll?: number | null;
  speed: number;
  proficiencyBonus: number;
  inspiration: boolean;
  visionRange: number;
  tokenWidthSquares: number;
  tokenLengthSquares: number;
  hitPoints: HitPoints;
  hitDice: string;
  abilities: AbilityScores;
  skills: SkillEntry[];
  classes: ActorClassEntry[];
  savingThrowProficiencies: AbilityKey[];
  toolProficiencies: string[];
  languageProficiencies: string[];
  spellSlots: SpellSlotTrack[];
  features: string[];
  spells: string[];
  preparedSpells: string[];
  spellState: ActorSpellState;
  talents: string[];
  feats: string[];
  bonuses: ActorBonusEntry[];
  layout: ActorLayoutEntry[];
  attacks: AttackEntry[];
  armorItems: ArmorEntry[];
  resources: ResourceEntry[];
  inventory: InventoryEntry[];
  conditions: TokenStatusMarker[];
  exhaustionLevel: number;
  concentration: boolean;
  deathSaves: ActorDeathSaveState;
  currency: CurrencyPouch;
  notes: string;
  color: string;
  build?: PlayerNpcBuild;
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
  creatureType: string;
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
  definedInSources: string[];
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

export interface ClassSubclassEntry {
  id: string;
  name: string;
  shortName: string;
  source: string;
  className: string;
  classSource: string;
  description: string;
  features: ClassFeatureEntry[];
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
  spellcastingAbility: AbilityKey | null;
  spellPreparation: "none" | "prepared" | "known" | "spellbook";
  subclassLevel: number | null;
  features: ClassFeatureEntry[];
  subclasses: ClassSubclassEntry[];
  tables: ClassTableEntry[];
}

export interface CompendiumReferenceEntry {
  id: string;
  name: string;
  source: string;
  category: string;
  description: string;
  entries: string;
  tags: string[];
}

export interface CompendiumItemGrant {
  itemId?: string;
  name: string;
  quantity: number;
  notes: string;
  equipped: boolean;
  type?: InventoryItemType;
  containsValueCp?: number;
}

export interface CompendiumEquipmentOption {
  id: string;
  label: string;
  items: CompendiumItemGrant[];
}

export interface CompendiumEquipmentGroup {
  id: string;
  label: string;
  choose: number;
  options: CompendiumEquipmentOption[];
}

export interface CompendiumAbilityChoice {
  abilities: AbilityKey[];
  amount: number;
  count: number;
}

export interface CompendiumBackgroundEntry extends CompendiumReferenceEntry {
  abilityChoices: CompendiumAbilityChoice[];
  skillProficiencies: string[];
  toolProficiencies: string[];
  languageProficiencies: string[];
  featIds: string[];
  startingEquipment: CompendiumEquipmentGroup[];
}

export interface CompendiumSpeciesEntry extends CompendiumReferenceEntry {
  creatureTypes: string[];
  sizes: string[];
  speed: number;
  darkvision: number;
  languages: string[];
  traitTags: string[];
}

export interface CompendiumItemEntry extends CompendiumReferenceEntry {
  itemType: string;
  rarity: string;
  armorType: string;
  armorClass: number;
  maxDexBonus: number | null;
  damage: string;
  damageType: string;
  range: string;
  properties: string[];
  weight: number;
  valueCp: number;
  attunement: string;
}

export interface CompendiumOptionalFeatureEntry extends CompendiumReferenceEntry {
  featureTypes: string[];
  prerequisites: string;
}

export interface CompendiumData {
  spells: SpellEntry[];
  monsters: MonsterTemplate[];
  feats: FeatEntry[];
  classes: ClassEntry[];
  books: CampaignSourceBook[];
  variantRules: CompendiumReferenceEntry[];
  conditions: CompendiumReferenceEntry[];
  optionalFeatures: CompendiumOptionalFeatureEntry[];
  actions: CompendiumReferenceEntry[];
  backgrounds: CompendiumBackgroundEntry[];
  items: CompendiumItemEntry[];
  languages: CompendiumReferenceEntry[];
  races: CompendiumSpeciesEntry[];
  skills: CompendiumReferenceEntry[];
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

export interface CampaignSourceBook {
  source: string;
  name: string;
  group: string;
  published: string;
  author: string;
}

export interface Point {
  x: number;
  y: number;
}

export type DrawingTextFont = "serif" | "sans" | "mono" | "script";

export type DrawingKind = "freehand" | "circle" | "square" | "star" | "text";

export interface DrawingStroke {
  id: string;
  ownerId?: string;
  kind: DrawingKind;
  text: string;
  fontFamily: DrawingTextFont;
  bold: boolean;
  italic: boolean;
  color: string;
  strokeOpacity: number;
  fillColor: string;
  fillOpacity: number;
  size: number;
  rotation: number;
  points: Point[];
}

export type MapWallKind = "wall" | "transparent" | "opaque" | "door";

export interface MapWall {
  id: string;
  start: Point;
  end: Point;
  kind: MapWallKind;
  isOpen: boolean;
  isLocked: boolean;
}

export interface MapTeleporter {
  id: string;
  pairNumber: number;
  pointA: Point;
  pointB: Point;
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
  teleporters: MapTeleporter[];
  drawings: DrawingStroke[];
  fogEnabled: boolean;
  fog: FogRect[];
  visibilityVersion: number;
}

export const TOKEN_STATUS_MARKERS = [
  "skull",
  "slow",
  "bloodied",
  "blinded",
  "charmed",
  "deafened",
  "drunkenness",
  "exhaustion",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
  "cross"
] as const;

export type TokenStatusMarker = (typeof TOKEN_STATUS_MARKERS)[number];

export interface BoardToken {
  id: string;
  actorId: string;
  actorKind: ActorKind;
  mapId: string;
  x: number;
  y: number;
  size: number;
  widthSquares: number;
  heightSquares: number;
  rotationDegrees: TokenRotation;
  color: string;
  label: string;
  imageUrl: string;
  visible: boolean;
  statusMarkers: TokenStatusMarker[];
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
  breakdown?: string;
  createdAt: string;
}

export interface ChatActorContext {
  actorId: string;
  actorName: string;
  actorImageUrl: string;
  actorColor: string;
}

export interface ChatMessage {
  id: string;
  campaignId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
  kind: ChatMessageKind;
  actor?: ChatActorContext;
  roll?: DiceRoll;
}

export interface Campaign {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  activeMapId: string;
  allowedSourceBooks: string[];
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
  compendium: Pick<
    CompendiumData,
    "spells" | "feats" | "classes" | "variantRules" | "conditions" | "optionalFeatures" | "backgrounds" | "items" | "languages" | "races" | "skills"
  >;
  playerVision: Record<string, CellKey[]>;
}

export interface RoomPlayerVisionUpdate {
  mapId: string;
  cells: CellKey[];
}

export interface RoomTokenMoved {
  token: BoardToken;
  playerVision: RoomPlayerVisionUpdate;
}

export interface RoomDoorToggled {
  mapId: string;
  doorId: string;
  isOpen: boolean;
  isLocked: boolean;
  playerVision: RoomPlayerVisionUpdate;
}

export interface RoomCampaignPatch {
  activeMapId?: string;
  members?: CampaignMember[];
  invites?: CampaignInvite[];
  actorsUpsert?: ActorSheet[];
  actorIdsRemoved?: string[];
  mapsUpsert?: CampaignMap[];
  mapIdsRemoved?: string[];
  mapAssignmentsUpsert?: MapActorAssignment[];
  mapAssignmentsRemoved?: Array<{ mapId: string; actorId: string }>;
  tokensUpsert?: BoardToken[];
  tokenIdsRemoved?: string[];
  chatAppended?: ChatMessage[];
  playerVision?: RoomPlayerVisionUpdate;
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
  teleported?: boolean;
  teleportEntry?: Point;
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
      actorId?: string;
    }
  | {
      type: "actor:update";
      actor: ActorSheet;
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
      type: "fog:clear";
      mapId: string;
    }
  | {
      type: "door:toggle";
      doorId: string;
    }
  | {
      type: "door:lock-toggle";
      doorId: string;
    };

export type ServerRoomMessage =
  | {
      type: "room:snapshot";
      snapshot: CampaignSnapshot;
    }
  | {
      type: "room:campaign-patch";
      patch: RoomCampaignPatch;
    }
  | {
      type: "room:token-moved";
      update: RoomTokenMoved;
    }
  | {
      type: "room:door-toggled";
      update: RoomDoorToggled;
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
