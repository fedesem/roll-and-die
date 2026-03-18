import type {
  AbilityKey,
  ClassEntry,
  CompendiumData,
  FeatEntry,
  MonsterActionEntry,
  MonsterAttackType,
  MonsterSense,
  MonsterSkillBonus,
  MonsterTemplate,
  SpellCastingTimeUnit,
  SpellDurationUnit,
  SpellEntry,
  SpellLevel,
  SpellRangeType,
  SpellSchool
} from "../../../shared/types.js";
import { HttpError } from "../http/errors.js";
import { createId } from "./authService.js";

export type CompendiumKind = keyof CompendiumData;

export function sanitizeCompendiumEntry(kind: CompendiumKind, input: unknown) {
  switch (kind) {
    case "spells":
      return sanitizeSpellEntry(input);
    case "monsters":
      return sanitizeMonsterEntry(input);
    case "feats":
      return sanitizeFeatEntry(input);
    case "classes":
      return sanitizeClassEntry(input);
  }
}

function sanitizeSpellEntry(input: unknown): SpellEntry {
  const object = asObject(input, "Spell");
  const components = asObject(object.components ?? {}, "Spell components");
  return {
    id: readString(object.id) || createId("spl"),
    name: requireString(object.name, "Spell name"),
    source: requireString(object.source, "Spell source"),
    level: parseSpellLevel(object.level),
    school: parseSpellSchool(object.school),
    castingTimeUnit: parseCastingTimeUnit(object.castingTimeUnit),
    castingTimeValue: clampNumber(object.castingTimeValue, 1, 1440, 1),
    rangeType: parseRangeType(object.rangeType),
    rangeValue: clampNumber(object.rangeValue, 0, 5000, 0),
    description: requireString(object.description, "Spell description"),
    components: {
      verbal: readBoolean(components.verbal),
      somatic: readBoolean(components.somatic),
      material: readBoolean(components.material),
      materialText: readString(components.materialText),
      materialValue: clampNumber(components.materialValue, 0, 100000, 0),
      materialConsumed: readBoolean(components.materialConsumed)
    },
    durationUnit: parseDurationUnit(object.durationUnit),
    durationValue: clampNumber(object.durationValue, 0, 100000, 0),
    concentration: readBoolean(object.concentration),
    damageNotation: readString(object.damageNotation),
    damageAbility: parseAbilityOrNull(object.damageAbility),
    fullDescription: requireString(object.fullDescription, "Spell full description"),
    classes: readStringArray(object.classes)
  };
}

function sanitizeMonsterEntry(input: unknown): MonsterTemplate {
  const object = asObject(input, "Monster");
  const speeds = asObject(object.speedModes ?? {}, "Monster speed modes");
  const abilities = asObject(object.abilities ?? {}, "Monster abilities");
  return {
    id: readString(object.id) || createId("mon"),
    name: requireString(object.name, "Monster name"),
    source: requireString(object.source, "Monster source"),
    challengeRating: requireString(object.challengeRating, "Monster CR"),
    armorClass: clampNumber(object.armorClass, 0, 50, 10),
    hitPoints: clampNumber(object.hitPoints, 1, 5000, 1),
    speed: clampNumber(object.speed ?? speeds.walk, 0, 1000, 30),
    speedModes: {
      walk: clampNumber(speeds.walk ?? object.speed, 0, 1000, 30),
      fly: clampNumber(speeds.fly, 0, 1000, 0),
      burrow: clampNumber(speeds.burrow, 0, 1000, 0),
      swim: clampNumber(speeds.swim, 0, 1000, 0),
      climb: clampNumber(speeds.climb, 0, 1000, 0)
    },
    abilities: {
      str: clampNumber(abilities.str, 1, 30, 10),
      dex: clampNumber(abilities.dex, 1, 30, 10),
      con: clampNumber(abilities.con, 1, 30, 10),
      int: clampNumber(abilities.int, 1, 30, 10),
      wis: clampNumber(abilities.wis, 1, 30, 10),
      cha: clampNumber(abilities.cha, 1, 30, 10)
    },
    skills: readObjectArray(object.skills).map((entry) => ({
      name: requireString(entry.name, "Monster skill name"),
      bonus: clampNumber(entry.bonus, -20, 50, 0)
    })) satisfies MonsterSkillBonus[],
    senses: readObjectArray(object.senses).map((entry) => ({
      name: requireString(entry.name, "Monster sense name"),
      range: clampNumber(entry.range, 0, 10000, 0),
      notes: readString(entry.notes)
    })) satisfies MonsterSense[],
    passivePerception: clampNumber(object.passivePerception, 0, 50, 10),
    languages: readStringArray(object.languages),
    xp: clampNumber(object.xp, 0, 1000000, 0),
    proficiencyBonus: clampNumber(object.proficiencyBonus, 0, 20, 2),
    gear: readStringArray(object.gear),
    resistances: readStringArray(object.resistances),
    vulnerabilities: readStringArray(object.vulnerabilities),
    immunities: readStringArray(object.immunities),
    traits: readStringArray(object.traits),
    actions: readObjectArray(object.actions).map(sanitizeMonsterAction),
    bonusActions: readObjectArray(object.bonusActions).map(sanitizeMonsterAction),
    reactions: readObjectArray(object.reactions).map(sanitizeMonsterAction),
    legendaryActions: readObjectArray(object.legendaryActions).map(sanitizeMonsterAction),
    legendaryActionsUse: clampNumber(object.legendaryActionsUse, 0, 10, 0),
    lairActions: readObjectArray(object.lairActions).map(sanitizeMonsterAction),
    regionalEffects: readObjectArray(object.regionalEffects).map(sanitizeMonsterAction),
    spells: readStringArray(object.spells),
    habitat: readString(object.habitat),
    treasure: readString(object.treasure),
    imageUrl: readString(object.imageUrl),
    color: readString(object.color) || "#9a5546"
  };
}

function sanitizeFeatEntry(input: unknown): FeatEntry {
  const object = asObject(input, "Feat");
  return {
    id: readString(object.id) || createId("fet"),
    name: requireString(object.name, "Feat name"),
    source: requireString(object.source, "Feat source"),
    category: requireString(object.category, "Feat category"),
    abilityScoreIncrease: readString(object.abilityScoreIncrease),
    prerequisites: readString(object.prerequisites),
    description: requireString(object.description, "Feat description")
  };
}

function sanitizeClassEntry(input: unknown): ClassEntry {
  const object = asObject(input, "Class");
  return {
    id: readString(object.id) || createId("cls"),
    name: requireString(object.name, "Class name"),
    source: requireString(object.source, "Class source"),
    description: requireString(object.description, "Class description"),
    features: readObjectArray(object.features).map((entry) => ({
      level: clampNumber(entry.level, 1, 20, 1),
      name: requireString(entry.name, "Class feature name"),
      description: requireString(entry.description, "Class feature description")
    })),
    tables: readObjectArray(object.tables).map((entry) => ({
      name: requireString(entry.name, "Class table name"),
      columns: readStringArray(entry.columns),
      rows: Array.isArray(entry.rows)
        ? entry.rows.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : []))
        : []
    }))
  };
}

function sanitizeMonsterAction(input: Record<string, unknown>): MonsterActionEntry {
  return {
    name: requireString(input.name, "Monster action name"),
    description: requireString(input.description, "Monster action description"),
    damage: readString(input.damage),
    attackType: parseMonsterAttackType(input.attackType),
    attackBonus: clampNumber(input.attackBonus, -20, 50, 0),
    reachOrRange: readString(input.reachOrRange),
    damageType: readString(input.damageType)
  };
}

function asObject(value: unknown, label: string) {
  if (typeof value !== "object" || value === null) {
    throw new HttpError(400, `${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `${label} is required.`);
  }

  return value.trim();
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(value: unknown) {
  return value === true;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => String(entry ?? "").trim()).filter(Boolean) : [];
}

function readObjectArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    : [];
}

function parseAbilityOrNull(value: unknown): AbilityKey | null {
  return value === "str" ||
    value === "dex" ||
    value === "con" ||
    value === "int" ||
    value === "wis" ||
    value === "cha"
    ? value
    : null;
}

function parseSpellLevel(value: unknown): SpellLevel {
  if (value === "cantrip") {
    return value;
  }

  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 9) {
    return value as SpellLevel;
  }

  throw new HttpError(400, "Spell level must be cantrip or 1-9.");
}

function parseSpellSchool(value: unknown): SpellSchool {
  if (
    value === "Abjuration" ||
    value === "Conjuration" ||
    value === "Divination" ||
    value === "Enchantment" ||
    value === "Evocation" ||
    value === "Illusion" ||
    value === "Necromancy" ||
    value === "Transmutation"
  ) {
    return value;
  }

  throw new HttpError(400, "Invalid spell school.");
}

function parseCastingTimeUnit(value: unknown): SpellCastingTimeUnit {
  if (value === "action" || value === "bonus action" || value === "minute" || value === "hour") {
    return value;
  }

  throw new HttpError(400, "Invalid casting time unit.");
}

function parseRangeType(value: unknown): SpellRangeType {
  if (value === "feet" || value === "self" || value === "self emanation" || value === "touch") {
    return value;
  }

  throw new HttpError(400, "Invalid spell range type.");
}

function parseDurationUnit(value: unknown): SpellDurationUnit {
  if (value === "instant" || value === "minute" || value === "hour") {
    return value;
  }

  throw new HttpError(400, "Invalid spell duration unit.");
}

function parseMonsterAttackType(value: unknown): MonsterAttackType {
  if (value === "melee" || value === "ranged" || value === "melee or ranged" || value === "other") {
    return value;
  }

  return "other";
}
