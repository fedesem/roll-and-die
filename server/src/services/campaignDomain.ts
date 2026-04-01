import { randomBytes } from "node:crypto";

import {
  TOKEN_STATUS_MARKERS,
  type AbilityKey,
  type AbilityScores,
  type ActorBonusEntry,
  type ActorClassEntry,
  type ActorKind,
  type ActorLayoutEntry,
  type ActorSheet,
  type ArmorEntry,
  type AttackEntry,
  type Campaign,
  type CampaignMap,
  type CampaignSnapshot,
  type CampaignSourceBook,
  type CampaignSummary,
  type CellKey,
  type ChatActorContext,
  type ChatMessage,
  type CompendiumData,
  type CurrencyPouch,
  type DrawingStroke,
  type HitPoints,
  type InventoryEntry,
  type MapTeleporter,
  type MapWall,
  type MeasurePreview,
  type MeasureSnapMode,
  type MemberRole,
  type MonsterTemplate,
  type Point,
  type PlayerNpcBuild,
  type ResourceEntry,
  type SkillEntry,
  type SpellSlotTrack,
  type UserProfile
} from "../../../shared/types.js";
import {
  clampStaticTokenDimension,
  getActorTokenFootprint,
  getFootprintSamplePoints,
  normalizeCreatureSize
} from "../../../shared/tokenGeometry.js";
import {
  computeVisibleCellsForActorToken,
  computeVisibleCellsForUser,
  snapPointToGrid,
  snapPointToGridIntersection
} from "../../../shared/vision.js";
import { isActorAssignedToMap } from "../../../shared/campaignActors.js";
import type { Database } from "../store.js";
import { HttpError } from "../http/errors.js";
import { createId, now } from "./authService.js";

const skillTemplates: Array<{ name: string; ability: AbilityKey }> = [
  { name: "Acrobatics", ability: "dex" },
  { name: "Animal Handling", ability: "wis" },
  { name: "Arcana", ability: "int" },
  { name: "Athletics", ability: "str" },
  { name: "Deception", ability: "cha" },
  { name: "History", ability: "int" },
  { name: "Insight", ability: "wis" },
  { name: "Intimidation", ability: "cha" },
  { name: "Investigation", ability: "int" },
  { name: "Medicine", ability: "wis" },
  { name: "Nature", ability: "int" },
  { name: "Perception", ability: "wis" },
  { name: "Performance", ability: "cha" },
  { name: "Persuasion", ability: "cha" },
  { name: "Religion", ability: "int" },
  { name: "Sleight of Hand", ability: "dex" },
  { name: "Stealth", ability: "dex" },
  { name: "Survival", ability: "wis" }
];

export function buildCampaignSnapshot(
  campaign: Campaign,
  user: UserProfile,
  compendium: Pick<
    CompendiumData,
    "spells" | "feats" | "classes" | "variantRules" | "conditions" | "optionalFeatures" | "backgrounds" | "items" | "languages" | "races" | "skills" | "monsters"
  >
): CampaignSnapshot {
  const member = campaign.members.find((entry) => entry.userId === user.id);

  if (!member) {
    throw new HttpError(403, "You do not have access to that campaign.");
  }

  const filteredCompendium = filterCampaignCompendium(campaign, compendium);

  return {
    campaign: {
      ...campaign,
      actors: campaign.actors
        .map((actor) => buildActorSnapshot(actor, member.role, user.id))
        .filter((actor): actor is ActorSheet => Boolean(actor))
    },
    currentUser: user,
    role: member.role,
    catalog: filteredCompendium.monsters,
    compendium: {
      spells: filteredCompendium.spells,
      feats: filteredCompendium.feats,
      classes: filteredCompendium.classes,
      variantRules: filteredCompendium.variantRules,
      conditions: filteredCompendium.conditions,
      optionalFeatures: filteredCompendium.optionalFeatures,
      backgrounds: filteredCompendium.backgrounds,
      items: filteredCompendium.items,
      languages: filteredCompendium.languages,
      races: filteredCompendium.races,
      skills: filteredCompendium.skills
    },
    playerVision: member.role === "dm" ? {} : normalizeExplorationMemory(campaign, user.id)
  };
}

export function listCampaignSourceBooks(compendium: CompendiumData): CampaignSourceBook[] {
  return [...compendium.books].sort((left, right) => left.source.localeCompare(right.source));
}

export function normalizeExplorationMemory(campaign: Campaign, userId: string) {
  const stored = campaign.exploration[userId] ?? {};

  return Object.fromEntries(
    campaign.maps.map((map) => {
      const cells = Array.isArray(stored[map.id]) ? stored[map.id] : [];
      return [map.id, Array.from(new Set(cells.filter((entry) => typeof entry === "string")))];
    })
  ) as Record<string, CellKey[]>;
}

export function normalizeExplorationMemoryForMap(campaign: Campaign, userId: string, mapId: string) {
  const stored = campaign.exploration[userId] ?? {};
  const cells = Array.isArray(stored[mapId]) ? stored[mapId] : [];

  return Array.from(new Set(cells.filter((entry) => typeof entry === "string")));
}

export function updateExplorationForCampaign(campaign: Campaign) {
  for (const map of campaign.maps) {
    updateExplorationForMap(campaign, map.id);
  }
}

export function updateExplorationForMap(campaign: Campaign, mapId: string) {
  const map = campaign.maps.find((entry) => entry.id === mapId);

  if (!map) {
    return;
  }

  for (const member of campaign.members) {
    if (member.role !== "player") {
      continue;
    }

    if (!map.fogEnabled) {
      campaign.exploration[member.userId] = {
        ...(campaign.exploration[member.userId] ?? {}),
        [map.id]: []
      };
      continue;
    }

    const normalizedMemory = normalizeExplorationMemory(campaign, member.userId);
    const nextMemory = { ...(campaign.exploration[member.userId] ?? {}) };

    const visible = computeVisibleCellsForUser({
      map,
      actors: campaign.actors,
      tokens: campaign.tokens.filter((token) => token.mapId === map.id && token.visible),
      userId: member.userId,
      role: member.role
    });
    const knownCells = new Set(normalizedMemory[map.id] ?? []);

    for (const entry of visible) {
      knownCells.add(entry);
    }

    nextMemory[map.id] = Array.from(knownCells);
    campaign.exploration[member.userId] = nextMemory;
  }
}

export function updateExplorationForActorMove(campaign: Campaign, mapId: string, actorId: string) {
  const map = campaign.maps.find((entry) => entry.id === mapId);
  const actor = campaign.actors.find((entry) => entry.id === actorId);

  if (!map || !actor || !actor.ownerId) {
    return;
  }

  const member = campaign.members.find((entry) => entry.userId === actor.ownerId);
  const token = campaign.tokens.find((entry) => entry.actorId === actorId && entry.mapId === mapId && entry.visible);

  if (!token || member?.role !== "player") {
    return;
  }

  if (!map.fogEnabled) {
    campaign.exploration[actor.ownerId] = {
      ...(campaign.exploration[actor.ownerId] ?? {}),
      [mapId]: []
    };
    return;
  }

  const nextMemory = { ...(campaign.exploration[actor.ownerId] ?? {}) };
  const knownCells = new Set(normalizeExplorationMemoryForMap(campaign, actor.ownerId, mapId));
  const visible = computeVisibleCellsForActorToken(map, actor, token);

  for (const entry of visible) {
    knownCells.add(entry);
  }

  nextMemory[mapId] = Array.from(knownCells);
  campaign.exploration[actor.ownerId] = nextMemory;
}

export function requireActiveMap(campaign: Campaign) {
  const activeMap = campaign.maps.find((entry) => entry.id === campaign.activeMapId) ?? campaign.maps[0];

  if (!activeMap) {
    throw new HttpError(409, "Campaign has no active map.");
  }

  return activeMap;
}

export function requireCampaignMember(database: Database, campaignId: string, userId: string) {
  const campaign = database.campaigns.find((entry) => entry.id === campaignId);

  if (!campaign) {
    throw new HttpError(404, "Campaign not found.");
  }

  const role = requireCampaignRole(campaign, userId);

  return {
    campaign,
    role
  };
}

export function requireCampaignRole(campaign: Campaign, userId: string) {
  const member = campaign.members.find((entry) => entry.userId === userId);

  if (!member) {
    throw new HttpError(403, "You do not have access to that campaign.");
  }

  return member.role;
}

export function requireDungeonMaster(campaign: Campaign, userId: string) {
  const member = campaign.members.find((entry) => entry.userId === userId);

  if (member?.role !== "dm") {
    throw new HttpError(403, "Dungeon Master access required.");
  }
}

export function toCampaignSummary(campaign: Campaign, userId: string): CampaignSummary {
  const member = campaign.members.find((entry) => entry.userId === userId);

  if (!member) {
    throw new HttpError(403, "You do not have access to that campaign.");
  }

  return {
    id: campaign.id,
    name: campaign.name,
    role: member.role,
    memberCount: campaign.members.length,
    actorCount: campaign.actors.length,
    mapCount: campaign.maps.length,
    createdAt: campaign.createdAt
  };
}

function filterCampaignCompendium(
  campaign: Campaign,
  compendium: Pick<
    CompendiumData,
    "spells" | "feats" | "classes" | "variantRules" | "conditions" | "optionalFeatures" | "backgrounds" | "items" | "languages" | "races" | "skills" | "monsters"
  >
) {
  const allowedBooks = new Set(campaign.allowedSourceBooks.map((entry) => entry.trim()).filter(Boolean));

  if (allowedBooks.size === 0) {
    return compendium;
  }

  return {
    spells: compendium.spells.filter((entry) => allowedBooks.has(getCompendiumBookSource(entry.source))),
    feats: compendium.feats.filter((entry) => allowedBooks.has(getCompendiumBookSource(entry.source))),
    classes: compendium.classes.filter((entry) => allowedBooks.has(getCompendiumBookSource(entry.source))),
    variantRules: compendium.variantRules.filter((entry) => allowedBooks.has(getCompendiumBookSource(entry.source))),
    conditions: compendium.conditions.filter((entry) => allowedBooks.has(getCompendiumBookSource(entry.source))),
    optionalFeatures: compendium.optionalFeatures.filter((entry) => allowedBooks.has(getCompendiumBookSource(entry.source))),
    backgrounds: compendium.backgrounds.filter((entry) => allowedBooks.has(getCompendiumBookSource(entry.source))),
    items: compendium.items.filter((entry) => allowedBooks.has(getCompendiumBookSource(entry.source))),
    languages: compendium.languages.filter((entry) => allowedBooks.has(getCompendiumBookSource(entry.source))),
    races: compendium.races.filter((entry) => allowedBooks.has(getCompendiumBookSource(entry.source))),
    skills: compendium.skills.filter((entry) => allowedBooks.has(getCompendiumBookSource(entry.source))),
    monsters: compendium.monsters.filter((entry) => allowedBooks.has(getCompendiumBookSource(entry.source)))
  };
}

function getCompendiumBookSource(source: string) {
  return source.split(/\s+p\.\d+/i)[0]?.trim() ?? "";
}

export function createDefaultMap(name: string): CampaignMap {
  return {
    id: createId("map"),
    name,
    backgroundUrl: "",
    backgroundOffsetX: 0,
    backgroundOffsetY: 0,
    backgroundScale: 1,
    width: 1600,
    height: 1200,
    grid: {
      show: true,
      cellSize: 70,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      color: "rgba(220, 182, 92, 0.5)"
    },
    walls: [],
    teleporters: [],
    drawings: [],
    fogEnabled: true,
    fog: [],
    visibilityVersion: 1
  };
}

export function createDefaultActor(campaignId: string, userId: string, name: string, kind: ActorKind, role: MemberRole): ActorSheet {
  const abilities = defaultAbilities();

  const actor: ActorSheet = {
    id: createId("act"),
    campaignId,
    ownerId: role === "dm" || kind === "character" || kind === "monster" ? userId : undefined,
    name,
    kind,
    creatureSize: "medium",
    imageUrl: "",
    className: kind === "monster" ? "Monster" : kind === "static" ? "2 x 4" : "",
    species: kind === "monster" ? "Bestiary" : kind === "static" ? "Vehicle" : "",
    background: kind === "static" ? "500 kg" : "",
    alignment: "",
    level: 1,
    challengeRating: kind === "monster" ? "1" : "",
    experience: 0,
    spellcastingAbility: "int",
    armorClass: 10,
    initiative: 0,
    initiativeRoll: null,
    speed: 30,
    proficiencyBonus: 2,
    inspiration: false,
    visionRange: 6,
    tokenWidthSquares: kind === "static" ? 2 : 1,
    tokenLengthSquares: kind === "static" ? 4 : 1,
    hitPoints: { current: 0, max: 0, temp: 0, reducedMax: 0 },
    hitDice: "",
    abilities,
    skills: defaultSkills(),
    classes: [],
    savingThrowProficiencies: [],
    toolProficiencies: [],
    languageProficiencies: [],
    spellSlots: defaultSpellSlots(),
    features: [],
    spells: [],
    preparedSpells: [],
    spellState: {
      spellbook: [],
      alwaysPrepared: [],
      atWill: [],
      perShortRest: [],
      perLongRest: []
    },
    talents: [],
    feats: [],
    bonuses: [],
    layout: defaultActorLayout(),
    attacks: [],
    armorItems: [],
    resources: [],
    inventory: [],
    conditions: [],
    exhaustionLevel: 0,
    concentration: false,
    deathSaves: {
      successes: 0,
      failures: 0,
      history: []
    },
    currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
    notes: "",
    color: kind === "npc" ? "#d98f46" : kind === "monster" ? "#ae4a39" : kind === "static" ? "#6e8897" : "#8cae75",
    build: kind === "character" || kind === "npc" ? createDefaultPlayerNpcBuild() : undefined
  };

  finalizeDerivedActor(actor);
  return actor;
}

export function createMonsterActor(campaignId: string, userId: string, template: MonsterTemplate): ActorSheet {
  const dexModifier = Math.floor((template.abilities.dex - 10) / 2);
  const proficiencyBonus = template.proficiencyBonus;

  const actor: ActorSheet = {
    id: createId("act"),
    campaignId,
    ownerId: userId,
    templateId: template.id,
    name: template.name,
    kind: "monster",
    creatureSize: "medium",
    imageUrl: template.imageUrl,
    className: "Monster",
    species: template.source,
    background: template.habitat,
    alignment: "Unaligned",
    level: 1,
    challengeRating: template.challengeRating,
    experience: 0,
    spellcastingAbility: "cha",
    armorClass: template.armorClass,
    initiative: template.initiative,
    speed: template.speed,
    proficiencyBonus,
    inspiration: false,
    visionRange: 8,
    tokenWidthSquares: 1,
    tokenLengthSquares: 1,
    hitPoints: { current: template.hitPoints, max: template.hitPoints, temp: 0, reducedMax: 0 },
    hitDice: "Monster HD",
    abilities: template.abilities,
    skills: defaultSkills(),
    classes: [],
    savingThrowProficiencies: [],
    toolProficiencies: [],
    languageProficiencies: template.languages,
    spellSlots: defaultSpellSlots(),
    features: template.traits,
    spells: template.spells.length > 0 ? template.spells : template.spellcasting.flatMap((entry) => entry.spells.map(stripTaggedSpellName)),
    preparedSpells: [],
    spellState: {
      spellbook: [],
      alwaysPrepared: [],
      atWill: [],
      perShortRest: [],
      perLongRest: []
    },
    talents: [],
    feats: [],
    bonuses: [],
    layout: defaultActorLayout(),
    attacks: template.actions.map((action) => ({
      id: createId("atk"),
      name: action.name,
      attackBonus: action.attackBonus || proficiencyBonus + dexModifier,
      damage: action.damage || "1d6",
      damageType: action.damageType || "Mixed",
      notes: action.description
    })),
    armorItems: [
      {
        id: createId("arm"),
        name: "Natural Armor",
        kind: "armor",
        armorClass: template.armorClass,
        maxDexBonus: null,
        bonus: 0,
        equipped: true,
        notes: ""
      }
    ],
    resources: [],
    inventory: [],
    conditions: [],
    exhaustionLevel: 0,
    concentration: false,
    deathSaves: {
      successes: 0,
      failures: 0,
      history: []
    },
    currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
    notes: [
      template.traits.length > 0 ? `Traits:\n${template.traits.join("\n")}` : "",
      template.bonusActions.length > 0
        ? `Bonus Actions:\n${template.bonusActions.map((entry) => `${entry.name}: ${entry.description}`).join("\n")}`
        : "",
      template.reactions.length > 0
        ? `Reactions:\n${template.reactions.map((entry) => `${entry.name}: ${entry.description}`).join("\n")}`
        : ""
    ]
      .filter(Boolean)
      .join("\n\n"),
    color: template.color
  };

  finalizeDerivedActor(actor);
  return actor;
}

export function createSystemMessage(id: string, user: UserProfile, campaignId: string, text: string): ChatMessage {
  return {
    id,
    campaignId,
    userId: user.id,
    userName: user.name,
    text,
    createdAt: now(),
    kind: "system"
  };
}

export function canManageActor(role: MemberRole, userId: string, actor: ActorSheet) {
  if (role === "dm") {
    return true;
  }

  return actor.ownerId === userId;
}

export function canManageDrawing(role: MemberRole, userId: string, drawing: DrawingStroke) {
  return role === "dm" || drawing.ownerId === userId;
}

export function hasMapAssignment(campaign: Campaign, actorId: string, mapId: string) {
  const actor = campaign.actors.find((entry) => entry.id === actorId);

  if (!actor) {
    return false;
  }

  return isActorAssignedToMap(campaign, actor, mapId);
}

export function canToggleDoor(role: MemberRole, userId: string, campaign: Campaign, map: CampaignMap, door: MapWall) {
  if (door.isLocked) {
    return false;
  }

  if (role === "dm") {
    return true;
  }

  const actorById = new Map(campaign.actors.map((actor) => [actor.id, actor]));
  const interactionRange = map.grid.cellSize * 1.2;

  return campaign.tokens.some((token) => {
    if (!token.visible || token.mapId !== map.id) {
      return false;
    }

    const actor = actorById.get(token.actorId);

    if (!actor || !canManageActor(role, userId, actor)) {
      return false;
    }

    return getFootprintSamplePoints(
      map,
      { x: token.x, y: token.y },
      {
        widthSquares: token.widthSquares,
        heightSquares: token.heightSquares
      }
    ).some((point) => distancePointToSegment(point, door.start, door.end) <= interactionRange);
  });
}

export function resetFogForMap(campaign: Campaign, mapId: string) {
  const map = campaign.maps.find((entry) => entry.id === mapId);

  if (!map) {
    throw new HttpError(404, "Map not found.");
  }

  for (const member of campaign.members) {
    if (member.role !== "player") {
      continue;
    }

    campaign.exploration[member.userId] = {
      ...(campaign.exploration[member.userId] ?? {}),
      [mapId]: []
    };
  }

  map.visibilityVersion = Math.max(1, (map.visibilityVersion ?? 1) + 1);
}

export function randomInviteCode() {
  return randomBytes(3).toString("hex").toUpperCase();
}

export function trimChat(campaign: Campaign) {
  campaign.chat = campaign.chat.slice(-200);
}

export function resolveChatActorContext(campaign: Campaign, actorId: string): ChatActorContext | null {
  const actor = campaign.actors.find((entry) => entry.id === actorId);

  if (!actor) {
    return null;
  }

  return {
    actorId: actor.id,
    actorName: actor.name,
    actorImageUrl: actor.imageUrl,
    actorColor: actor.color
  };
}

export function sanitizeMeasurePreview(preview: MeasurePreview, map: CampaignMap): MeasurePreview {
  const snapMode = preview.snapMode;

  return {
    kind: preview.kind,
    start: snapMeasurePreviewPoint(
      map,
      {
        x: getRequiredNumber(preview.start?.x, "Measure start X"),
        y: getRequiredNumber(preview.start?.y, "Measure start Y")
      },
      snapMode
    ),
    end: snapMeasurePreviewPoint(
      map,
      {
        x: getRequiredNumber(preview.end?.x, "Measure end X"),
        y: getRequiredNumber(preview.end?.y, "Measure end Y")
      },
      snapMode
    ),
    snapMode,
    coneAngle: preview.coneAngle === 45 || preview.coneAngle === 60 || preview.coneAngle === 90 ? preview.coneAngle : 60,
    beamWidthSquares: getOptionalNumber(preview.beamWidthSquares, 1, 1, 12)
  };
}

export function applyMapPatch(map: CampaignMap, patch: Record<string, unknown> | CampaignMap) {
  map.name = getOptionalString(patch.name, map.name);
  map.backgroundUrl = getOptionalString(patch.backgroundUrl, map.backgroundUrl);
  map.backgroundOffsetX = getOptionalNumber(patch.backgroundOffsetX, map.backgroundOffsetX, -50000, 50000);
  map.backgroundOffsetY = getOptionalNumber(patch.backgroundOffsetY, map.backgroundOffsetY, -50000, 50000);
  map.backgroundScale = getOptionalNumber(patch.backgroundScale, map.backgroundScale, 0.05, 8);
  map.width = getOptionalNumber(patch.width, map.width, 100, 12000);
  map.height = getOptionalNumber(patch.height, map.height, 100, 12000);
  map.fogEnabled = typeof patch.fogEnabled === "boolean" ? patch.fogEnabled : map.fogEnabled;
  map.grid = {
    show:
      typeof patch.grid === "object" && patch.grid !== null && typeof (patch.grid as { show?: unknown }).show === "boolean"
        ? (patch.grid as { show: boolean }).show
        : map.grid.show,
    cellSize: getOptionalNumber(
      typeof patch.grid === "object" && patch.grid !== null ? (patch.grid as { cellSize?: unknown }).cellSize : undefined,
      map.grid.cellSize,
      16,
      512
    ),
    scale: getOptionalNumber(
      typeof patch.grid === "object" && patch.grid !== null ? (patch.grid as { scale?: unknown }).scale : undefined,
      map.grid.scale,
      0.2,
      4
    ),
    offsetX: getOptionalNumber(
      typeof patch.grid === "object" && patch.grid !== null ? (patch.grid as { offsetX?: unknown }).offsetX : undefined,
      map.grid.offsetX,
      -50000,
      50000
    ),
    offsetY: getOptionalNumber(
      typeof patch.grid === "object" && patch.grid !== null ? (patch.grid as { offsetY?: unknown }).offsetY : undefined,
      map.grid.offsetY,
      -50000,
      50000
    ),
    color: getOptionalString(
      typeof patch.grid === "object" && patch.grid !== null ? (patch.grid as { color?: unknown }).color : undefined,
      map.grid.color
    )
  };
  map.walls = sanitizeWalls(patch.walls, map.walls).map((wall) => ({
    ...wall,
    start: snapPointToGridIntersection(map, wall.start),
    end: snapPointToGridIntersection(map, wall.end),
    isOpen: wall.kind === "door" ? wall.isOpen : false,
    isLocked: wall.kind === "door" ? wall.isLocked : false
  }));
  map.teleporters = sanitizeTeleporters(patch.teleporters, map.teleporters).map((teleporter) => ({
    ...teleporter,
    pointA: snapPointToGrid(map, teleporter.pointA),
    pointB: snapPointToGrid(map, teleporter.pointB)
  }));
  map.drawings = sanitizeDrawings(patch.drawings, map.drawings);
  map.fog = [];
}

function buildActorSnapshot(actor: ActorSheet, role: MemberRole, userId: string): ActorSheet | null {
  if (role === "dm" || actor.ownerId === userId) {
    return {
      ...actor,
      sheetAccess: "full"
    };
  }

  return null;
}

function defaultAbilities(): AbilityScores {
  return {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10
  };
}

function defaultSkills(): SkillEntry[] {
  return skillTemplates.map((entry) => ({
    id: createId("skl"),
    name: entry.name,
    ability: entry.ability,
    proficient: false,
    expertise: false
  }));
}

function defaultActorLayout(): ActorLayoutEntry[] {
  const sections = [
    ["info", 1],
    ["abilities", 1],
    ["skills", 1],
    ["combat", 2],
    ["attacks", 2],
    ["armor", 2],
    ["resources", 2],
    ["spellSlots", 3],
    ["spells", 3],
    ["feats", 3],
    ["traits", 3],
    ["items", 2],
    ["notes", 3]
  ] as const;

  return sections.map(([sectionId, column], index) => ({
    sectionId,
    column,
    order: index
  }));
}

function defaultSpellSlots(): SpellSlotTrack[] {
  return Array.from({ length: 9 }, (_, index) => ({
    level: index + 1,
    total: 0,
    used: 0
  }));
}

function createDefaultPlayerNpcBuild(): PlayerNpcBuild {
  return {
    ruleset: "dnd-2024",
    mode: "guided",
    classes: [],
    selections: []
  };
}

function snapMeasurePreviewPoint(map: CampaignMap, point: Point, snapMode: MeasureSnapMode) {
  if (snapMode === "center") {
    return snapPointToGrid(map, point);
  }

  if (snapMode === "corner") {
    return snapPointToGridIntersection(map, point);
  }

  return point;
}

function distancePointToSegment(point: Point, start: Point, end: Point) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;

  if (lengthSquared < 0.0001) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const projection = ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared;
  const t = Math.min(1, Math.max(0, projection));
  const projectedX = start.x + deltaX * t;
  const projectedY = start.y + deltaY * t;

  return Math.hypot(point.x - projectedX, point.y - projectedY);
}

function getOptionalString(value: unknown, fallback: string) {
  return typeof value === "string" ? value.trim() : fallback;
}

function getRequiredNumber(value: unknown, label: string) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new HttpError(400, `${label} must be a number.`);
  }

  return value;
}

function getOptionalNumber(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean)
    .slice(0, 80);
}

function normalizeAbilityKeyArray(value: unknown, fallback: AbilityKey[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return Array.from(
    new Set(
      value
        .map((entry) => parseAbilityKey(entry, null))
        .filter((entry): entry is AbilityKey => entry !== null)
    )
  ).slice(0, 6);
}

function sanitizeActorSpellState(value: unknown, fallback: ActorSheet["spellState"]): ActorSheet["spellState"] {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const input = value as Partial<ActorSheet["spellState"]>;
  return {
    spellbook: normalizeStringArray(input.spellbook, fallback.spellbook),
    alwaysPrepared: normalizeStringArray(input.alwaysPrepared, fallback.alwaysPrepared),
    atWill: normalizeStringArray(input.atWill, fallback.atWill),
    perShortRest: normalizeStringArray(input.perShortRest, fallback.perShortRest),
    perLongRest: normalizeStringArray(input.perLongRest, fallback.perLongRest)
  };
}

function sanitizeConditionMarkers(value: unknown, fallback: ActorSheet["conditions"]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const allowed = new Set<string>(TOKEN_STATUS_MARKERS);
  return Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry): entry is (typeof TOKEN_STATUS_MARKERS)[number] => Boolean(entry) && allowed.has(entry))
    )
  );
}

function sanitizeDeathSaves(value: unknown, fallback: ActorSheet["deathSaves"]): ActorSheet["deathSaves"] {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const input = value as Partial<ActorSheet["deathSaves"]>;
  return {
    successes: getOptionalNumber(input.successes, fallback.successes, 0, 3),
    failures: getOptionalNumber(input.failures, fallback.failures, 0, 3),
    history: Array.isArray(input.history)
      ? input.history.filter((entry): entry is "success" | "failure" => entry === "success" || entry === "failure").slice(-3)
      : fallback.history ?? []
  };
}

function parseAbilityKey(value: unknown, fallback: AbilityKey): AbilityKey;
function parseAbilityKey(value: unknown, fallback: AbilityKey | null): AbilityKey | null;
function parseAbilityKey(value: unknown, fallback: AbilityKey | null) {
  return value === "str" || value === "dex" || value === "con" || value === "int" || value === "wis" || value === "cha" ? value : fallback;
}

function sanitizeAbilities(value: unknown, fallback: AbilityScores): AbilityScores {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const input = value as Partial<AbilityScores>;
  return {
    str: getOptionalNumber(input.str, fallback.str, 1, 30),
    dex: getOptionalNumber(input.dex, fallback.dex, 1, 30),
    con: getOptionalNumber(input.con, fallback.con, 1, 30),
    int: getOptionalNumber(input.int, fallback.int, 1, 30),
    wis: getOptionalNumber(input.wis, fallback.wis, 1, 30),
    cha: getOptionalNumber(input.cha, fallback.cha, 1, 30)
  };
}

function sanitizeHitPoints(value: unknown, fallback: HitPoints): HitPoints {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const input = value as Partial<HitPoints>;
  return {
    current: getOptionalNumber(input.current, fallback.current, 0, 999),
    max: getOptionalNumber(input.max, fallback.max, 1, 999),
    temp: getOptionalNumber(input.temp, fallback.temp, 0, 999),
    reducedMax: getOptionalNumber(input.reducedMax, fallback.reducedMax, 0, 999)
  };
}

function sanitizeSkills(value: unknown, fallback: SkillEntry[]): SkillEntry[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const skill = entry as Partial<SkillEntry>;
      return {
        id: typeof skill.id === "string" ? skill.id : createId("skl"),
        name: typeof skill.name === "string" && skill.name.trim() ? skill.name.trim() : "Skill",
        ability: parseAbilityKey(skill.ability, "wis"),
        proficient: Boolean(skill.proficient),
        expertise: Boolean(skill.expertise)
      };
    })
    .filter((entry): entry is SkillEntry => Boolean(entry))
    .slice(0, 30);
}

function sanitizeSpellSlots(value: unknown, fallback: SpellSlotTrack[]): SpellSlotTrack[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return Array.from({ length: 9 }, (_, index) => {
    const existing = value[index];
    const fallbackSlot = fallback[index] ?? { level: index + 1, total: 0, used: 0 };

    if (!existing || typeof existing !== "object") {
      return fallbackSlot;
    }

    const slot = existing as Partial<SpellSlotTrack>;
    const total = getOptionalNumber(slot.total, fallbackSlot.total, 0, 9);
    const used = getOptionalNumber(slot.used, fallbackSlot.used, 0, 9);

    return {
      level: index + 1,
      total,
      used: Math.min(total, used)
    };
  });
}

function sanitizeAttacks(value: unknown, fallback: AttackEntry[]): AttackEntry[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const attack = entry as Partial<AttackEntry>;
      return {
        id: typeof attack.id === "string" ? attack.id : createId("atk"),
        name: getOptionalString(attack.name, "Attack"),
        attackBonus: getOptionalNumber(attack.attackBonus, 0, -20, 30),
        damage: getOptionalString(attack.damage, ""),
        damageType: getOptionalString(attack.damageType, ""),
        notes: getOptionalString(attack.notes, "")
      };
    })
    .filter((entry): entry is AttackEntry => Boolean(entry))
    .slice(0, 24);
}

function sanitizeArmorItems(value: unknown, fallback: ArmorEntry[]): ArmorEntry[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const armor = entry as Partial<ArmorEntry>;
      return {
        id: typeof armor.id === "string" ? armor.id : createId("arm"),
        name: getOptionalString(armor.name, "Armor"),
        kind: armor.kind === "shield" ? "shield" : "armor",
        armorClass: getOptionalNumber(armor.armorClass, 10, 0, 30),
        maxDexBonus:
          armor.maxDexBonus === null
            ? null
            : typeof armor.maxDexBonus === "number" && Number.isFinite(armor.maxDexBonus)
              ? Math.max(-1, Math.min(10, armor.maxDexBonus))
              : null,
        bonus: getOptionalNumber(armor.bonus, 0, -20, 20),
        equipped: typeof armor.equipped === "boolean" ? armor.equipped : false,
        notes: getOptionalString(armor.notes, "")
      };
    })
    .filter((entry): entry is ArmorEntry => Boolean(entry))
    .slice(0, 12);
}

function sanitizeResources(value: unknown, fallback: ResourceEntry[]): ResourceEntry[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const resource = entry as Partial<ResourceEntry>;
      const max = getOptionalNumber(resource.max, 0, 0, 99);
      return {
        id: typeof resource.id === "string" ? resource.id : createId("res"),
        name: getOptionalString(resource.name, "Resource"),
        current: Math.min(max, getOptionalNumber(resource.current, 0, 0, 99)),
        max,
        resetOn: getOptionalString(resource.resetOn, ""),
        restoreAmount: getOptionalNumber(resource.restoreAmount, max, 0, 99)
      };
    })
    .filter((entry): entry is ResourceEntry => Boolean(entry))
    .slice(0, 24);
}

function sanitizeInventory(value: unknown, fallback: InventoryEntry[]): InventoryEntry[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const item = entry as Partial<InventoryEntry>;
      return {
        id: typeof item.id === "string" ? item.id : createId("inv"),
        name: getOptionalString(item.name, "Item"),
        type: item.type === "reagent" || item.type === "loot" || item.type === "consumable" || item.type === "gear" ? item.type : "gear",
        quantity: getOptionalNumber(item.quantity, 1, 0, 999),
        equipped: typeof item.equipped === "boolean" ? item.equipped : false,
        notes: getOptionalString(item.notes, "")
      };
    })
    .filter((entry): entry is InventoryEntry => Boolean(entry))
    .slice(0, 80);
}

function sanitizeActorClasses(value: unknown, fallback: ActorClassEntry[]): ActorClassEntry[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const actorClass = entry as Partial<ActorClassEntry>;
      const level = getOptionalNumber(actorClass.level, 1, 1, 20);

      return {
        id: typeof actorClass.id === "string" ? actorClass.id : createId("cls"),
        compendiumId: getOptionalString(actorClass.compendiumId, ""),
        name: getOptionalString(actorClass.name, "Class"),
        source: getOptionalString(actorClass.source, ""),
        level,
        hitDieFaces: getOptionalNumber(actorClass.hitDieFaces, 8, 4, 20),
        usedHitDice: getOptionalNumber(actorClass.usedHitDice, 0, 0, level),
        spellcastingAbility: parseAbilityKey(actorClass.spellcastingAbility, null)
      };
    })
    .filter((entry): entry is ActorClassEntry => Boolean(entry))
    .slice(0, 8);
}

function sanitizeActorBonuses(value: unknown, fallback: ActorBonusEntry[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const bonus = entry as Partial<ActorBonusEntry>;
      return {
        id: typeof bonus.id === "string" ? bonus.id : createId("bon"),
        name: getOptionalString(bonus.name, "Bonus"),
        sourceType: bonus.sourceType === "gear" ? "gear" : "buff",
        targetType:
          bonus.targetType === "speed" ||
          bonus.targetType === "ability" ||
          bonus.targetType === "skill" ||
          bonus.targetType === "savingThrow" ||
          bonus.targetType === "armorClass"
            ? bonus.targetType
            : "armorClass",
        targetKey: getOptionalString(bonus.targetKey, ""),
        value: getOptionalNumber(bonus.value, 0, -20, 20),
        enabled: typeof bonus.enabled === "boolean" ? bonus.enabled : true
      };
    })
    .filter((entry): entry is ActorBonusEntry => Boolean(entry))
    .slice(0, 64);
}

function sanitizeActorLayout(value: unknown, fallback: ActorLayoutEntry[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const layout = entry as Partial<ActorLayoutEntry>;
      return {
        sectionId: getOptionalString(layout.sectionId, ""),
        column: getOptionalNumber(layout.column, 1, 1, 3),
        order: getOptionalNumber(layout.order, 0, 0, 99)
      };
    })
    .filter((entry): entry is ActorLayoutEntry => Boolean(entry?.sectionId))
    .sort((left, right) => left.order - right.order);
}

function getAbilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function getBonusTotal(actor: ActorSheet, targetType: ActorBonusEntry["targetType"], targetKey = "") {
  const normalizedKey = targetKey.trim().toLowerCase();

  return actor.bonuses.reduce((total, entry) => {
    if (!entry.enabled || entry.targetType !== targetType) {
      return total;
    }

    if (!normalizedKey) {
      return total + entry.value;
    }

    return entry.targetKey.trim().toLowerCase() === normalizedKey ? total + entry.value : total;
  }, 0);
}

function formatHitDice(actor: ActorSheet) {
  if (actor.classes.length === 0) {
    return actor.hitDice;
  }

  return actor.classes.map((entry) => `d${entry.hitDieFaces} ${Math.max(entry.level - entry.usedHitDice, 0)}/${entry.level}`).join(" • ");
}

function deriveArmorClass(actor: ActorSheet) {
  const dexModifier = getAbilityModifier(actor.abilities.dex);
  const equippedArmor = actor.armorItems.filter((entry) => entry.equipped && entry.kind === "armor");
  const equippedShields = actor.armorItems.filter((entry) => entry.equipped && entry.kind === "shield");
  const bestArmorBase =
    equippedArmor.length > 0
      ? Math.max(
          ...equippedArmor.map((entry) => {
            const dexCap = entry.maxDexBonus === null ? dexModifier : Math.min(dexModifier, entry.maxDexBonus);
            return entry.armorClass + Math.max(dexCap, -10) + entry.bonus;
          })
        )
      : 10 + dexModifier;

  const shieldBonus = equippedShields.reduce((total, entry) => total + entry.armorClass + entry.bonus, 0);

  return bestArmorBase + shieldBonus + getBonusTotal(actor, "armorClass");
}

function finalizeDerivedActor(actor: ActorSheet) {
  actor.creatureSize = normalizeCreatureSize(actor.creatureSize);

  if (actor.kind === "static") {
    actor.tokenWidthSquares = clampStaticTokenDimension(actor.tokenWidthSquares);
    actor.tokenLengthSquares = clampStaticTokenDimension(actor.tokenLengthSquares);
  } else {
    actor.tokenWidthSquares = 1;
    actor.tokenLengthSquares = 1;
  }

  if (actor.kind === "character" || actor.kind === "npc") {
    const totalLevel = actor.classes.reduce((sum, entry) => sum + entry.level, 0);

    if (totalLevel > 0) {
      actor.level = totalLevel;
      actor.proficiencyBonus = Math.min(6, 2 + Math.floor((Math.max(totalLevel, 1) - 1) / 4));
      actor.className = actor.classes.map((entry) => entry.name).join(" / ");

      const firstSpellcastingClass = actor.classes.find((entry) => entry.spellcastingAbility);
      if (firstSpellcastingClass?.spellcastingAbility) {
        actor.spellcastingAbility = firstSpellcastingClass.spellcastingAbility;
      }
    }
  }

  actor.hitDice = formatHitDice(actor);
  actor.armorClass = deriveArmorClass(actor);
  actor.hitPoints.reducedMax = Math.max(0, actor.hitPoints.reducedMax);
  actor.hitPoints.current = Math.min(actor.hitPoints.current, Math.max(0, actor.hitPoints.max - actor.hitPoints.reducedMax));
  actor.hitPoints.temp = Math.max(0, actor.hitPoints.temp);
}

function sanitizeCurrency(value: unknown, fallback: CurrencyPouch): CurrencyPouch {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const input = value as Partial<CurrencyPouch>;
  return {
    pp: getOptionalNumber(input.pp, fallback.pp, 0, 99999),
    gp: getOptionalNumber(input.gp, fallback.gp, 0, 99999),
    ep: getOptionalNumber(input.ep, fallback.ep, 0, 99999),
    sp: getOptionalNumber(input.sp, fallback.sp, 0, 99999),
    cp: getOptionalNumber(input.cp, fallback.cp, 0, 99999)
  };
}

function sanitizeWalls(value: unknown, fallback: MapWall[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry) => {
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof (entry as Partial<MapWall>).start?.x !== "number" ||
        typeof (entry as Partial<MapWall>).start?.y !== "number" ||
        typeof (entry as Partial<MapWall>).end?.x !== "number" ||
        typeof (entry as Partial<MapWall>).end?.y !== "number"
      ) {
        return null;
      }

      const wall = entry as MapWall;
      const kind =
        wall.kind === "transparent" || wall.kind === "opaque" || wall.kind === "door" || wall.kind === "wall" ? wall.kind : "wall";

      return {
        id: typeof wall.id === "string" ? wall.id : createId("wall"),
        start: wall.start,
        end: wall.end,
        kind,
        isOpen: kind === "door" ? Boolean(wall.isOpen) : false,
        isLocked: kind === "door" ? Boolean(wall.isLocked) : false
      };
    })
    .filter((entry): entry is MapWall => Boolean(entry))
    .slice(0, 400);
}

function sanitizeTeleporters(value: unknown, fallback: MapTeleporter[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry) => {
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof (entry as Partial<MapTeleporter>).pointA?.x !== "number" ||
        typeof (entry as Partial<MapTeleporter>).pointA?.y !== "number" ||
        typeof (entry as Partial<MapTeleporter>).pointB?.x !== "number" ||
        typeof (entry as Partial<MapTeleporter>).pointB?.y !== "number"
      ) {
        return null;
      }

      const teleporter = entry as MapTeleporter;

      return {
        id: typeof teleporter.id === "string" ? teleporter.id : createId("tel"),
        pairNumber: getOptionalNumber(teleporter.pairNumber, 1, 1, 999),
        pointA: teleporter.pointA,
        pointB: teleporter.pointB
      };
    })
    .filter((entry): entry is MapTeleporter => Boolean(entry))
    .slice(0, 200);
}

export function sanitizeDrawings(value: unknown, fallback: DrawingStroke[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry): DrawingStroke | null => {
      if (!entry || typeof entry !== "object" || !Array.isArray((entry as Partial<DrawingStroke>).points)) {
        return null;
      }

      const stroke = entry as DrawingStroke;
      const points = stroke.points
        .filter((point) => typeof point?.x === "number" && typeof point?.y === "number")
        .map((point) => ({ x: point.x, y: point.y }))
        .slice(0, 800);

      const kind =
        stroke.kind === "circle" ||
        stroke.kind === "square" ||
        stroke.kind === "star" ||
        stroke.kind === "text" ||
        stroke.kind === "freehand"
          ? stroke.kind
          : "freehand";

      const text = typeof stroke.text === "string" ? stroke.text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").slice(0, 4000) : "";
      const fontFamily =
        stroke.fontFamily === "sans" || stroke.fontFamily === "mono" || stroke.fontFamily === "script" || stroke.fontFamily === "serif"
          ? stroke.fontFamily
          : "serif";
      const bold = Boolean(stroke.bold);
      const italic = Boolean(stroke.italic);

      if (points.length < 2 || (kind === "text" && text.trim().length === 0)) {
        return null;
      }

      return {
        id: typeof stroke.id === "string" ? stroke.id : createId("drw"),
        ownerId: typeof stroke.ownerId === "string" && stroke.ownerId ? stroke.ownerId : undefined,
        kind,
        text,
        fontFamily,
        bold,
        italic,
        color: typeof stroke.color === "string" ? stroke.color : "#d9a641",
        strokeOpacity: typeof stroke.strokeOpacity === "number" ? Math.min(1, Math.max(0, stroke.strokeOpacity)) : 1,
        fillColor: typeof stroke.fillColor === "string" ? stroke.fillColor : "",
        fillOpacity: typeof stroke.fillOpacity === "number" ? Math.min(1, Math.max(0, stroke.fillOpacity)) : 0.22,
        size:
          typeof stroke.size === "number"
            ? kind === "text"
              ? Math.min(96, Math.max(12, stroke.size))
              : Math.min(24, Math.max(1, stroke.size))
            : kind === "text"
              ? 28
              : 4,
        rotation: typeof stroke.rotation === "number" ? Math.min(360, Math.max(-360, stroke.rotation)) : 0,
        points
      };
    })
    .filter((entry): entry is DrawingStroke => entry !== null)
    .slice(0, 300);
}

export function applyActorPatch(actor: ActorSheet, patch: Record<string, unknown> | ActorSheet) {
  actor.name = getOptionalString(patch.name, actor.name);
  actor.imageUrl = getOptionalString(patch.imageUrl, actor.imageUrl);
  actor.className = getOptionalString(patch.className, actor.className);
  actor.species = getOptionalString(patch.species, actor.species);
  actor.creatureSize = actor.kind === "static" ? "medium" : normalizeCreatureSize(patch.creatureSize, actor.creatureSize);
  actor.background = getOptionalString(patch.background, actor.background);
  actor.alignment = getOptionalString(patch.alignment, actor.alignment);
  actor.level = getOptionalNumber(patch.level, actor.level, 1, 20);
  actor.challengeRating = getOptionalString(patch.challengeRating, actor.challengeRating);
  actor.experience = getOptionalNumber(patch.experience, actor.experience, 0, 999999);
  actor.spellcastingAbility = parseAbilityKey(patch.spellcastingAbility, actor.spellcastingAbility);
  actor.armorClass = getOptionalNumber(patch.armorClass, actor.armorClass, 0, 40);
  actor.initiative = getOptionalNumber(patch.initiative, actor.initiative, -10, 20);
  actor.speed = getOptionalNumber(patch.speed, actor.speed, 0, 120);
  actor.proficiencyBonus = getOptionalNumber(patch.proficiencyBonus, actor.proficiencyBonus, 0, 10);
  actor.inspiration = typeof patch.inspiration === "boolean" ? patch.inspiration : actor.inspiration;
  actor.visionRange = getOptionalNumber(patch.visionRange, actor.visionRange, 1, 24);
  actor.tokenWidthSquares =
    actor.kind === "static" ? clampStaticTokenDimension(getOptionalNumber(patch.tokenWidthSquares, actor.tokenWidthSquares, 1, 12)) : 1;
  actor.tokenLengthSquares =
    actor.kind === "static" ? clampStaticTokenDimension(getOptionalNumber(patch.tokenLengthSquares, actor.tokenLengthSquares, 1, 12)) : 1;
  actor.hitPoints = sanitizeHitPoints(patch.hitPoints, actor.hitPoints);
  actor.hitDice = getOptionalString(patch.hitDice, actor.hitDice);
  actor.abilities = sanitizeAbilities(patch.abilities, actor.abilities);
  actor.skills = sanitizeSkills(patch.skills, actor.skills);
  actor.classes = sanitizeActorClasses(patch.classes, actor.classes);
  actor.savingThrowProficiencies = normalizeAbilityKeyArray(patch.savingThrowProficiencies, actor.savingThrowProficiencies);
  actor.toolProficiencies = normalizeStringArray(patch.toolProficiencies, actor.toolProficiencies);
  actor.languageProficiencies = normalizeStringArray(patch.languageProficiencies, actor.languageProficiencies);
  actor.spellSlots = sanitizeSpellSlots(patch.spellSlots, actor.spellSlots);
  actor.features = normalizeStringArray(patch.features, actor.features);
  actor.spells = normalizeStringArray(patch.spells, actor.spells);
  actor.preparedSpells = normalizeStringArray(patch.preparedSpells, actor.preparedSpells);
  actor.spellState = sanitizeActorSpellState(patch.spellState, actor.spellState);
  actor.talents = normalizeStringArray(patch.talents, actor.talents);
  actor.feats = normalizeStringArray(patch.feats, actor.feats);
  actor.bonuses = sanitizeActorBonuses(patch.bonuses, actor.bonuses);
  actor.layout = sanitizeActorLayout(patch.layout, actor.layout);
  actor.attacks = sanitizeAttacks(patch.attacks, actor.attacks);
  actor.armorItems = sanitizeArmorItems(patch.armorItems, actor.armorItems);
  actor.resources = sanitizeResources(patch.resources, actor.resources);
  actor.inventory = sanitizeInventory(patch.inventory, actor.inventory);
  actor.conditions = sanitizeConditionMarkers(patch.conditions, actor.conditions);
  actor.exhaustionLevel = getOptionalNumber(patch.exhaustionLevel, actor.exhaustionLevel, 0, 6);
  actor.concentration = typeof patch.concentration === "boolean" ? patch.concentration : actor.concentration;
  actor.deathSaves = sanitizeDeathSaves(patch.deathSaves, actor.deathSaves);
  actor.currency = sanitizeCurrency(patch.currency, actor.currency);
  actor.notes = getOptionalString(patch.notes, actor.notes);
  actor.color = getOptionalString(patch.color, actor.color);
  finalizeDerivedActor(actor);
}

function stripTaggedSpellName(value: string) {
  const match = value.match(/\{@spell ([^}|]+)(?:\|[^}]+)?}/i);
  return match ? match[1].trim() : value;
}

export function syncActorTokens(campaign: Campaign, actor: ActorSheet) {
  const syncedStatusMarkers = Array.from(
    new Set([
      ...actor.conditions,
      ...(actor.exhaustionLevel > 0 ? (["exhaustion"] as const) : [])
    ])
  );

  for (const token of campaign.tokens) {
    if (token.actorId !== actor.id) {
      continue;
    }

    token.actorKind = actor.kind;
    token.rotationDegrees = actor.kind === "static" ? token.rotationDegrees : 0;
    const footprint = getActorTokenFootprint(actor, token.rotationDegrees);
    token.size = footprint.size;
    token.widthSquares = footprint.widthSquares;
    token.heightSquares = footprint.heightSquares;
    token.rotationDegrees = actor.kind === "static" ? token.rotationDegrees : 0;

    token.color = actor.color;
    token.label = actor.name;
    token.imageUrl = actor.imageUrl;
    token.statusMarkers = syncedStatusMarkers;
  }
}
