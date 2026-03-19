import type {
  AbilityKey,
  ClassEntry,
  FeatEntry,
  MonsterActionEntry,
  MonsterAttackType,
  MonsterSense,
  MonsterSkillBonus,
  MonsterSpellcastingEntry,
  MonsterTemplate,
  SpellEntry
} from "@shared/types";

export interface SpellFormState {
  name: string;
  source: string;
  level: string;
  school: SpellEntry["school"];
  castingTimeUnit: SpellEntry["castingTimeUnit"];
  castingTimeValue: string;
  rangeType: SpellEntry["rangeType"];
  rangeValue: string;
  description: string;
  verbal: boolean;
  somatic: boolean;
  material: boolean;
  materialText: string;
  materialValue: string;
  materialConsumed: boolean;
  durationUnit: SpellEntry["durationUnit"];
  durationValue: string;
  concentration: boolean;
  damageNotation: string;
  damageAbility: "" | AbilityKey;
  fullDescription: string;
  classesText: string;
}

export interface MonsterFormState {
  name: string;
  source: string;
  challengeRating: string;
  armorClass: string;
  hitPoints: string;
  initiative: string;
  walk: string;
  fly: string;
  burrow: string;
  swim: string;
  climb: string;
  str: string;
  dex: string;
  con: string;
  int: string;
  wis: string;
  cha: string;
  passivePerception: string;
  xp: string;
  proficiencyBonus: string;
  skillsText: string;
  sensesText: string;
  languagesText: string;
  gearText: string;
  resistancesText: string;
  vulnerabilitiesText: string;
  immunitiesText: string;
  traitsText: string;
  spellsText: string;
  spellcastingJson: string;
  actionsJson: string;
  bonusActionsJson: string;
  reactionsJson: string;
  legendaryActionsJson: string;
  legendaryActionsUse: string;
  lairActionsJson: string;
  regionalEffectsJson: string;
  habitat: string;
  treasure: string;
  imageUrl: string;
  color: string;
}

export interface FeatFormState {
  name: string;
  source: string;
  category: string;
  abilityScoreIncrease: string;
  prerequisites: string;
  description: string;
}

export interface ClassFormState {
  name: string;
  source: string;
  description: string;
  featuresJson: string;
  tablesJson: string;
}

export function createSpellForm(): SpellFormState {
  return {
    name: "",
    source: "",
    level: "cantrip",
    school: "Evocation",
    castingTimeUnit: "action",
    castingTimeValue: "1",
    rangeType: "feet",
    rangeValue: "30",
    description: "",
    verbal: true,
    somatic: true,
    material: false,
    materialText: "",
    materialValue: "0",
    materialConsumed: false,
    durationUnit: "instant",
    durationValue: "0",
    concentration: false,
    damageNotation: "",
    damageAbility: "",
    fullDescription: "",
    classesText: ""
  };
}

export function createMonsterForm(): MonsterFormState {
  return {
    name: "",
    source: "",
    challengeRating: "1",
    armorClass: "10",
    hitPoints: "1",
    initiative: "0",
    walk: "30",
    fly: "0",
    burrow: "0",
    swim: "0",
    climb: "0",
    str: "10",
    dex: "10",
    con: "10",
    int: "10",
    wis: "10",
    cha: "10",
    passivePerception: "10",
    xp: "0",
    proficiencyBonus: "2",
    skillsText: "",
    sensesText: "",
    languagesText: "",
    gearText: "",
    resistancesText: "",
    vulnerabilitiesText: "",
    immunitiesText: "",
    traitsText: "",
    spellsText: "",
    spellcastingJson: "[]",
    actionsJson: "[]",
    bonusActionsJson: "[]",
    reactionsJson: "[]",
    legendaryActionsJson: "[]",
    legendaryActionsUse: "0",
    lairActionsJson: "[]",
    regionalEffectsJson: "[]",
    habitat: "",
    treasure: "",
    imageUrl: "",
    color: "#9a5546"
  };
}

export function createFeatForm(): FeatFormState {
  return {
    name: "",
    source: "",
    category: "",
    abilityScoreIncrease: "",
    prerequisites: "",
    description: ""
  };
}

export function createClassForm(): ClassFormState {
  return {
    name: "",
    source: "",
    description: "",
    featuresJson: "[]",
    tablesJson: "[]"
  };
}

export function spellFormToEntry(form: SpellFormState): Omit<SpellEntry, "id"> {
  return {
    name: form.name.trim(),
    source: form.source.trim(),
    level: form.level === "cantrip" ? "cantrip" : Number(form.level) as SpellEntry["level"],
    school: form.school,
    castingTimeUnit: form.castingTimeUnit,
    castingTimeValue: Number(form.castingTimeValue) || 1,
    rangeType: form.rangeType,
    rangeValue: Number(form.rangeValue) || 0,
    description: form.description.trim(),
    components: {
      verbal: form.verbal,
      somatic: form.somatic,
      material: form.material,
      materialText: form.materialText.trim(),
      materialValue: Number(form.materialValue) || 0,
      materialConsumed: form.materialConsumed
    },
    durationUnit: form.durationUnit,
    durationValue: Number(form.durationValue) || 0,
    concentration: form.concentration,
    damageNotation: form.damageNotation.trim(),
    damageAbility: form.damageAbility || null,
    higherLevelDescription: "",
    fullDescription: form.fullDescription.trim() || form.description.trim(),
    classes: splitList(form.classesText),
    classReferences: splitList(form.classesText).map((name) => ({
      name,
      source: "",
      kind: "class" as const,
      className: name,
      classSource: "",
      definedInSources: []
    }))
  };
}

export function monsterFormToEntry(form: MonsterFormState): Omit<MonsterTemplate, "id"> {
  return {
    name: form.name.trim(),
    source: form.source.trim(),
    challengeRating: form.challengeRating.trim(),
    armorClass: Number(form.armorClass) || 10,
    hitPoints: Number(form.hitPoints) || 1,
    initiative: Number(form.initiative) || 0,
    speed: Number(form.walk) || 30,
    speedModes: {
      walk: Number(form.walk) || 30,
      fly: Number(form.fly) || 0,
      burrow: Number(form.burrow) || 0,
      swim: Number(form.swim) || 0,
      climb: Number(form.climb) || 0
    },
    abilities: {
      str: Number(form.str) || 10,
      dex: Number(form.dex) || 10,
      con: Number(form.con) || 10,
      int: Number(form.int) || 10,
      wis: Number(form.wis) || 10,
      cha: Number(form.cha) || 10
    },
    skills: parseSkillList(form.skillsText),
    senses: parseSenseList(form.sensesText),
    passivePerception: Number(form.passivePerception) || 10,
    languages: splitList(form.languagesText),
    xp: Number(form.xp) || 0,
    proficiencyBonus: Number(form.proficiencyBonus) || 2,
    gear: splitList(form.gearText),
    resistances: splitList(form.resistancesText),
    vulnerabilities: splitList(form.vulnerabilitiesText),
    immunities: splitList(form.immunitiesText),
    traits: splitLines(form.traitsText),
    actions: parseJsonArray<MonsterActionEntry>(form.actionsJson),
    bonusActions: parseJsonArray<MonsterActionEntry>(form.bonusActionsJson),
    reactions: parseJsonArray<MonsterActionEntry>(form.reactionsJson),
    legendaryActions: parseJsonArray<MonsterActionEntry>(form.legendaryActionsJson),
    legendaryActionsUse: Number(form.legendaryActionsUse) || 0,
    lairActions: parseJsonArray<MonsterActionEntry>(form.lairActionsJson),
    regionalEffects: parseJsonArray<MonsterActionEntry>(form.regionalEffectsJson),
    spells: splitList(form.spellsText),
    spellcasting: parseJsonArray<MonsterSpellcastingEntry>(form.spellcastingJson),
    habitat: form.habitat.trim(),
    treasure: form.treasure.trim(),
    imageUrl: form.imageUrl.trim(),
    color: form.color
  };
}

export function featFormToEntry(form: FeatFormState): Omit<FeatEntry, "id"> {
  return {
    name: form.name.trim(),
    source: form.source.trim(),
    category: form.category.trim(),
    abilityScoreIncrease: form.abilityScoreIncrease.trim(),
    prerequisites: form.prerequisites.trim(),
    description: form.description.trim()
  };
}

export function classFormToEntry(form: ClassFormState): Omit<ClassEntry, "id"> {
  return {
    name: form.name.trim(),
    source: form.source.trim(),
    description: form.description.trim(),
    hitDieFaces: 0,
    primaryAbilities: [],
    savingThrowProficiencies: [],
    startingProficiencies: {
      armor: [],
      weapons: [],
      tools: []
    },
    features: parseJsonArray<ClassEntry["features"][number]>(form.featuresJson).map((feature) => ({
      level: feature.level,
      name: feature.name,
      description: feature.description,
      source: feature.source ?? "",
      reference: feature.reference ?? ""
    })),
    tables: parseJsonArray<ClassEntry["tables"][number]>(form.tablesJson)
  };
}

function splitList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseSkillList(value: string): MonsterSkillBonus[] {
  return splitList(value).map((entry) => {
    const [name, bonusText] = entry.split(":");
    return {
      name: name?.trim() ?? "",
      bonus: Number(bonusText?.trim()) || 0
    };
  }).filter((entry) => entry.name);
}

function parseSenseList(value: string): MonsterSense[] {
  return splitList(value).map((entry) => {
    const [name, rangeText, notes] = entry.split(":");
    return {
      name: name?.trim() ?? "",
      range: Number(rangeText?.trim()) || 0,
      notes: notes?.trim() ?? ""
    };
  }).filter((entry) => entry.name);
}

function parseJsonArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export const monsterActionTemplate: MonsterActionEntry = {
  name: "Bite",
  description: "Melee Weapon Attack.",
  damage: "1d8+3",
  attackType: "melee",
  attackBonus: 5,
  reachOrRange: "5 ft",
  damageType: "piercing"
};

export const monsterAttackTypes: MonsterAttackType[] = ["melee", "ranged", "melee or ranged", "other"];
