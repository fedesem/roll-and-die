import { z } from "zod";

import type {
  AbilityKey,
  AbilityScores,
  ActorBonusEntry,
  ActorBonusSourceType,
  ActorBonusTargetType,
  ActorClassEntry,
  ActorKind,
  ActorLayoutEntry,
  ActorSheet,
  AdminOverview,
  ArmorEntry,
  AttackEntry,
  AuthPayload,
  BoardToken,
  Campaign,
  CampaignInvite,
  CampaignMap,
  CampaignMember,
  CampaignSnapshot,
  CampaignSummary,
  ChatMessage,
  ChatMessageKind,
  ClassEntry,
  ClassFeatureEntry,
  ClassStartingProficiencies,
  ClassTableEntry,
  CompendiumData,
  CurrencyPouch,
  DiceRoll,
  DrawingKind,
  DrawingStroke,
  FeatEntry,
  FogRect,
  GridConfig,
  HitPoints,
  InventoryEntry,
  InventoryItemType,
  MapActorAssignment,
  MapPing,
  MapViewportRecall,
  MapWall,
  MapWallKind,
  MeasureKind,
  MeasurePreview,
  MeasureSnapMode,
  MemberRole,
  MonsterActionEntry,
  MonsterAttackType,
  MonsterSense,
  MonsterSkillBonus,
  MonsterSpellcastingEntry,
  MonsterSpeedModes,
  MonsterTemplate,
  Point,
  ResourceEntry,
  SkillEntry,
  SpellCastingTimeUnit,
  SpellClassReference,
  SpellClassReferenceKind,
  SpellComponents,
  SpellDurationUnit,
  SpellEntry,
  SpellLevel,
  SpellRangeType,
  SpellSchool,
  SpellSlotTrack,
  TokenMovementPreview,
  UserProfile
} from "../types.js";

const finiteNumber = z.number().finite();
const trimmedString = z.string();

export const abilityKeySchema: z.ZodType<AbilityKey> = z.enum([
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "cha"
]);

export const memberRoleSchema: z.ZodType<MemberRole> = z.enum(["dm", "player"]);
export const actorKindSchema: z.ZodType<ActorKind> = z.enum([
  "character",
  "npc",
  "monster",
  "static"
]);
export const chatMessageKindSchema: z.ZodType<ChatMessageKind> = z.enum([
  "message",
  "roll",
  "system"
]);

export const abilityScoresSchema: z.ZodType<AbilityScores> = z.object({
  str: finiteNumber,
  dex: finiteNumber,
  con: finiteNumber,
  int: finiteNumber,
  wis: finiteNumber,
  cha: finiteNumber
});

export const hitPointsSchema: z.ZodType<HitPoints> = z.object({
  current: finiteNumber,
  max: finiteNumber,
  temp: finiteNumber
});

export const skillEntrySchema: z.ZodType<SkillEntry> = z.object({
  id: trimmedString,
  name: trimmedString,
  ability: abilityKeySchema,
  proficient: z.boolean(),
  expertise: z.boolean()
});

export const spellSlotTrackSchema: z.ZodType<SpellSlotTrack> = z.object({
  level: finiteNumber,
  total: finiteNumber,
  used: finiteNumber
});

export const attackEntrySchema: z.ZodType<AttackEntry> = z.object({
  id: trimmedString,
  name: trimmedString,
  attackBonus: finiteNumber,
  damage: trimmedString,
  damageType: trimmedString,
  notes: trimmedString
});

export const armorEntrySchema: z.ZodType<ArmorEntry> = z.object({
  id: trimmedString,
  name: trimmedString,
  kind: z.enum(["armor", "shield"]),
  armorClass: finiteNumber,
  maxDexBonus: finiteNumber.nullable(),
  bonus: finiteNumber,
  equipped: z.boolean(),
  notes: trimmedString
});

export const resourceEntrySchema: z.ZodType<ResourceEntry> = z.object({
  id: trimmedString,
  name: trimmedString,
  current: finiteNumber,
  max: finiteNumber,
  resetOn: trimmedString,
  restoreAmount: finiteNumber
});

export const inventoryItemTypeSchema: z.ZodType<InventoryItemType> = z.enum([
  "gear",
  "reagent",
  "loot",
  "consumable"
]);

export const inventoryEntrySchema: z.ZodType<InventoryEntry> = z.object({
  id: trimmedString,
  name: trimmedString,
  type: inventoryItemTypeSchema,
  quantity: finiteNumber,
  equipped: z.boolean(),
  notes: trimmedString
});

export const currencyPouchSchema: z.ZodType<CurrencyPouch> = z.object({
  pp: finiteNumber,
  gp: finiteNumber,
  ep: finiteNumber,
  sp: finiteNumber,
  cp: finiteNumber
});

export const actorClassEntrySchema: z.ZodType<ActorClassEntry> = z.object({
  id: trimmedString,
  compendiumId: trimmedString,
  name: trimmedString,
  source: trimmedString,
  level: finiteNumber,
  hitDieFaces: finiteNumber,
  usedHitDice: finiteNumber,
  spellcastingAbility: abilityKeySchema.nullable()
});

export const actorBonusSourceTypeSchema: z.ZodType<ActorBonusSourceType> = z.enum(["gear", "buff"]);
export const actorBonusTargetTypeSchema: z.ZodType<ActorBonusTargetType> = z.enum([
  "armorClass",
  "speed",
  "ability",
  "skill",
  "savingThrow"
]);

export const actorBonusEntrySchema: z.ZodType<ActorBonusEntry> = z.object({
  id: trimmedString,
  name: trimmedString,
  sourceType: actorBonusSourceTypeSchema,
  targetType: actorBonusTargetTypeSchema,
  targetKey: trimmedString,
  value: finiteNumber,
  enabled: z.boolean()
});

export const actorLayoutEntrySchema: z.ZodType<ActorLayoutEntry> = z.object({
  sectionId: trimmedString,
  column: finiteNumber,
  order: finiteNumber
});

export const actorSheetSchema: z.ZodType<ActorSheet> = z.object({
  id: trimmedString,
  campaignId: trimmedString,
  ownerId: trimmedString.optional(),
  templateId: trimmedString.optional(),
  sheetAccess: z.enum(["full", "restricted"]).optional(),
  name: trimmedString,
  kind: actorKindSchema,
  imageUrl: trimmedString,
  className: trimmedString,
  species: trimmedString,
  background: trimmedString,
  alignment: trimmedString,
  level: finiteNumber,
  challengeRating: trimmedString,
  experience: finiteNumber,
  spellcastingAbility: abilityKeySchema,
  armorClass: finiteNumber,
  initiative: finiteNumber,
  speed: finiteNumber,
  proficiencyBonus: finiteNumber,
  inspiration: z.boolean(),
  visionRange: finiteNumber,
  hitPoints: hitPointsSchema,
  hitDice: trimmedString,
  abilities: abilityScoresSchema,
  skills: z.array(skillEntrySchema),
  classes: z.array(actorClassEntrySchema),
  spellSlots: z.array(spellSlotTrackSchema),
  features: z.array(trimmedString),
  spells: z.array(trimmedString),
  preparedSpells: z.array(trimmedString),
  talents: z.array(trimmedString),
  feats: z.array(trimmedString),
  bonuses: z.array(actorBonusEntrySchema),
  layout: z.array(actorLayoutEntrySchema),
  attacks: z.array(attackEntrySchema),
  armorItems: z.array(armorEntrySchema),
  resources: z.array(resourceEntrySchema),
  inventory: z.array(inventoryEntrySchema),
  currency: currencyPouchSchema,
  notes: trimmedString,
  color: trimmedString
});

export const monsterSpeedModesSchema: z.ZodType<MonsterSpeedModes> = z.object({
  walk: finiteNumber,
  fly: finiteNumber,
  burrow: finiteNumber,
  swim: finiteNumber,
  climb: finiteNumber
});

export const monsterSkillBonusSchema: z.ZodType<MonsterSkillBonus> = z.object({
  name: trimmedString,
  bonus: finiteNumber
});

export const monsterSenseSchema: z.ZodType<MonsterSense> = z.object({
  name: trimmedString,
  range: finiteNumber,
  notes: trimmedString
});

export const monsterAttackTypeSchema: z.ZodType<MonsterAttackType> = z.enum([
  "melee",
  "ranged",
  "melee or ranged",
  "other"
]);

export const monsterActionEntrySchema: z.ZodType<MonsterActionEntry> = z.object({
  name: trimmedString,
  description: trimmedString,
  damage: trimmedString,
  attackType: monsterAttackTypeSchema,
  attackBonus: finiteNumber,
  reachOrRange: trimmedString,
  damageType: trimmedString
});

export const monsterSpellcastingEntrySchema: z.ZodType<MonsterSpellcastingEntry> = z.object({
  label: trimmedString,
  spells: z.array(trimmedString)
});

export const monsterTemplateSchema: z.ZodType<MonsterTemplate> = z.object({
  id: trimmedString,
  name: trimmedString,
  source: trimmedString,
  challengeRating: trimmedString,
  armorClass: finiteNumber,
  hitPoints: finiteNumber,
  initiative: finiteNumber,
  speed: finiteNumber,
  speedModes: monsterSpeedModesSchema,
  abilities: abilityScoresSchema,
  skills: z.array(monsterSkillBonusSchema),
  senses: z.array(monsterSenseSchema),
  passivePerception: finiteNumber,
  languages: z.array(trimmedString),
  xp: finiteNumber,
  proficiencyBonus: finiteNumber,
  gear: z.array(trimmedString),
  resistances: z.array(trimmedString),
  vulnerabilities: z.array(trimmedString),
  immunities: z.array(trimmedString),
  traits: z.array(trimmedString),
  actions: z.array(monsterActionEntrySchema),
  bonusActions: z.array(monsterActionEntrySchema),
  reactions: z.array(monsterActionEntrySchema),
  legendaryActions: z.array(monsterActionEntrySchema),
  legendaryActionsUse: finiteNumber,
  lairActions: z.array(monsterActionEntrySchema),
  regionalEffects: z.array(monsterActionEntrySchema),
  spells: z.array(trimmedString),
  spellcasting: z.array(monsterSpellcastingEntrySchema),
  habitat: trimmedString,
  treasure: trimmedString,
  imageUrl: trimmedString,
  color: trimmedString
});

export const spellLevelSchema: z.ZodType<SpellLevel> = z.union([
  z.literal("cantrip"),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
  z.literal(9)
]);

export const spellSchoolSchema: z.ZodType<SpellSchool> = z.enum([
  "Abjuration",
  "Conjuration",
  "Divination",
  "Enchantment",
  "Evocation",
  "Illusion",
  "Necromancy",
  "Transmutation"
]);

export const spellCastingTimeUnitSchema: z.ZodType<SpellCastingTimeUnit> = z.enum([
  "action",
  "bonus action",
  "reaction",
  "minute",
  "hour"
]);

export const spellRangeTypeSchema: z.ZodType<SpellRangeType> = z.enum([
  "feet",
  "self",
  "self emanation",
  "touch",
  "sight",
  "unlimited",
  "special"
]);

export const spellDurationUnitSchema: z.ZodType<SpellDurationUnit> = z.enum([
  "instant",
  "minute",
  "hour",
  "day",
  "permanent",
  "special"
]);

export const spellClassReferenceKindSchema: z.ZodType<SpellClassReferenceKind> = z.enum([
  "class",
  "classVariant",
  "subclass",
  "subclassVariant"
]);

export const spellComponentsSchema: z.ZodType<SpellComponents> = z.object({
  verbal: z.boolean(),
  somatic: z.boolean(),
  material: z.boolean(),
  materialText: trimmedString,
  materialValue: finiteNumber,
  materialConsumed: z.boolean()
});

export const spellClassReferenceSchema: z.ZodType<SpellClassReference> = z.object({
  name: trimmedString,
  source: trimmedString,
  kind: spellClassReferenceKindSchema,
  className: trimmedString,
  classSource: trimmedString,
  definedInSources: z.array(trimmedString)
});

export const spellEntrySchema: z.ZodType<SpellEntry> = z.object({
  id: trimmedString,
  name: trimmedString,
  source: trimmedString,
  level: spellLevelSchema,
  school: spellSchoolSchema,
  castingTimeUnit: spellCastingTimeUnitSchema,
  castingTimeValue: finiteNumber,
  rangeType: spellRangeTypeSchema,
  rangeValue: finiteNumber,
  description: trimmedString,
  components: spellComponentsSchema,
  durationUnit: spellDurationUnitSchema,
  durationValue: finiteNumber,
  concentration: z.boolean(),
  damageNotation: trimmedString,
  damageAbility: abilityKeySchema.nullable(),
  higherLevelDescription: trimmedString,
  fullDescription: trimmedString,
  classes: z.array(trimmedString),
  classReferences: z.array(spellClassReferenceSchema)
});

export const featEntrySchema: z.ZodType<FeatEntry> = z.object({
  id: trimmedString,
  name: trimmedString,
  source: trimmedString,
  category: trimmedString,
  abilityScoreIncrease: trimmedString,
  prerequisites: trimmedString,
  description: trimmedString
});

export const classFeatureEntrySchema: z.ZodType<ClassFeatureEntry> = z.object({
  level: finiteNumber,
  name: trimmedString,
  description: trimmedString,
  source: trimmedString,
  reference: trimmedString
});

export const classTableEntrySchema: z.ZodType<ClassTableEntry> = z.object({
  name: trimmedString,
  columns: z.array(trimmedString),
  rows: z.array(z.array(trimmedString))
});

export const classStartingProficienciesSchema: z.ZodType<ClassStartingProficiencies> = z.object({
  armor: z.array(trimmedString),
  weapons: z.array(trimmedString),
  tools: z.array(trimmedString)
});

export const classEntrySchema: z.ZodType<ClassEntry> = z.object({
  id: trimmedString,
  name: trimmedString,
  source: trimmedString,
  description: trimmedString,
  hitDieFaces: finiteNumber,
  primaryAbilities: z.array(trimmedString),
  savingThrowProficiencies: z.array(trimmedString),
  startingProficiencies: classStartingProficienciesSchema,
  features: z.array(classFeatureEntrySchema),
  tables: z.array(classTableEntrySchema)
});

export const compendiumDataSchema: z.ZodType<CompendiumData> = z.object({
  spells: z.array(spellEntrySchema),
  monsters: z.array(monsterTemplateSchema),
  feats: z.array(featEntrySchema),
  classes: z.array(classEntrySchema)
});

export const campaignMemberSchema: z.ZodType<CampaignMember> = z.object({
  userId: trimmedString,
  name: trimmedString,
  email: trimmedString,
  role: memberRoleSchema
});

export const campaignInviteSchema: z.ZodType<CampaignInvite> = z.object({
  id: trimmedString,
  code: trimmedString,
  label: trimmedString,
  role: memberRoleSchema,
  createdAt: trimmedString,
  createdBy: trimmedString
});

export const pointSchema: z.ZodType<Point> = z.object({
  x: finiteNumber,
  y: finiteNumber
});

export const drawingKindSchema: z.ZodType<DrawingKind> = z.enum([
  "freehand",
  "circle",
  "square",
  "star"
]);

export const drawingStrokeSchema: z.ZodType<DrawingStroke> = z.object({
  id: trimmedString,
  ownerId: trimmedString.optional(),
  kind: drawingKindSchema,
  color: trimmedString,
  strokeOpacity: finiteNumber,
  fillColor: trimmedString,
  fillOpacity: finiteNumber,
  size: finiteNumber,
  rotation: finiteNumber,
  points: z.array(pointSchema)
});

export const mapWallKindSchema: z.ZodType<MapWallKind> = z.enum([
  "wall",
  "transparent",
  "door"
]);

export const mapWallSchema: z.ZodType<MapWall> = z.object({
  id: trimmedString,
  start: pointSchema,
  end: pointSchema,
  kind: mapWallKindSchema,
  isOpen: z.boolean()
});

export const fogRectSchema: z.ZodType<FogRect> = z.object({
  id: trimmedString,
  x: finiteNumber,
  y: finiteNumber,
  width: finiteNumber,
  height: finiteNumber
});

export const gridConfigSchema: z.ZodType<GridConfig> = z.object({
  show: z.boolean(),
  cellSize: finiteNumber,
  scale: finiteNumber,
  offsetX: finiteNumber,
  offsetY: finiteNumber,
  color: trimmedString
});

export const campaignMapSchema: z.ZodType<CampaignMap> = z.object({
  id: trimmedString,
  name: trimmedString,
  backgroundUrl: trimmedString,
  backgroundOffsetX: finiteNumber,
  backgroundOffsetY: finiteNumber,
  backgroundScale: finiteNumber,
  width: finiteNumber,
  height: finiteNumber,
  grid: gridConfigSchema,
  walls: z.array(mapWallSchema),
  drawings: z.array(drawingStrokeSchema),
  fog: z.array(fogRectSchema),
  visibilityVersion: finiteNumber
});

export const boardTokenSchema: z.ZodType<BoardToken> = z.object({
  id: trimmedString,
  actorId: trimmedString,
  actorKind: actorKindSchema,
  mapId: trimmedString,
  x: finiteNumber,
  y: finiteNumber,
  size: finiteNumber,
  color: trimmedString,
  label: trimmedString,
  imageUrl: trimmedString,
  visible: z.boolean()
});

export const mapActorAssignmentSchema: z.ZodType<MapActorAssignment> = z.object({
  actorId: trimmedString,
  mapId: trimmedString
});

export const diceRollSchema: z.ZodType<DiceRoll> = z.object({
  id: trimmedString,
  label: trimmedString,
  notation: trimmedString,
  rolls: z.array(finiteNumber),
  modifier: finiteNumber,
  total: finiteNumber,
  createdAt: trimmedString
});

export const chatMessageSchema: z.ZodType<ChatMessage> = z.object({
  id: trimmedString,
  campaignId: trimmedString,
  userId: trimmedString,
  userName: trimmedString,
  text: trimmedString,
  createdAt: trimmedString,
  kind: chatMessageKindSchema,
  roll: diceRollSchema.optional()
});

export const campaignSchema: z.ZodType<Campaign> = z.object({
  id: trimmedString,
  name: trimmedString,
  createdAt: trimmedString,
  createdBy: trimmedString,
  activeMapId: trimmedString,
  members: z.array(campaignMemberSchema),
  invites: z.array(campaignInviteSchema),
  actors: z.array(actorSheetSchema),
  maps: z.array(campaignMapSchema),
  mapAssignments: z.array(mapActorAssignmentSchema),
  tokens: z.array(boardTokenSchema),
  chat: z.array(chatMessageSchema),
  exploration: z.record(z.string(), z.record(z.string(), z.array(trimmedString)))
});

export const userProfileSchema: z.ZodType<UserProfile> = z.object({
  id: trimmedString,
  name: trimmedString,
  email: trimmedString,
  isAdmin: z.boolean()
});

export const authPayloadSchema: z.ZodType<AuthPayload> = z.object({
  token: trimmedString,
  user: userProfileSchema
});

export const campaignSummarySchema: z.ZodType<CampaignSummary> = z.object({
  id: trimmedString,
  name: trimmedString,
  role: memberRoleSchema,
  memberCount: finiteNumber,
  actorCount: finiteNumber,
  mapCount: finiteNumber,
  createdAt: trimmedString
});

export const campaignSnapshotSchema: z.ZodType<CampaignSnapshot> = z.object({
  campaign: campaignSchema,
  currentUser: userProfileSchema,
  role: memberRoleSchema,
  catalog: z.array(monsterTemplateSchema),
  compendium: z.object({
    spells: z.array(spellEntrySchema),
    feats: z.array(featEntrySchema),
    classes: z.array(classEntrySchema)
  }),
  playerVision: z.record(z.string(), z.array(trimmedString))
});

export const adminOverviewSchema: z.ZodType<AdminOverview> = z.object({
  users: z.array(userProfileSchema),
  compendium: compendiumDataSchema
});

export const tokenMovementPreviewSchema: z.ZodType<TokenMovementPreview> = z.object({
  blocked: z.boolean(),
  end: pointSchema,
  points: z.array(pointSchema),
  steps: finiteNumber
});

export const measureKindSchema: z.ZodType<MeasureKind> = z.enum([
  "line",
  "cone",
  "beam",
  "emanation",
  "square"
]);

export const measureSnapModeSchema: z.ZodType<MeasureSnapMode> = z.enum([
  "center",
  "corner",
  "none"
]);

export const measurePreviewSchema: z.ZodType<MeasurePreview> = z.object({
  kind: measureKindSchema,
  start: pointSchema,
  end: pointSchema,
  snapMode: measureSnapModeSchema,
  coneAngle: z.union([z.literal(45), z.literal(60), z.literal(90)]),
  beamWidthSquares: finiteNumber
});

export const mapPingSchema: z.ZodType<MapPing> = z.object({
  id: trimmedString,
  mapId: trimmedString,
  point: pointSchema,
  userId: trimmedString,
  userName: trimmedString,
  createdAt: trimmedString
});

export const mapViewportRecallSchema: z.ZodType<MapViewportRecall> = z.object({
  id: trimmedString,
  mapId: trimmedString,
  center: pointSchema,
  zoom: finiteNumber
});
