import type { DatabaseSync } from "node:sqlite";

import type {
  AbilityKey,
  ClassEntry,
  CompendiumData,
  FeatEntry,
  MonsterActionEntry,
  MonsterSense,
  MonsterSkillBonus,
  MonsterSpellcastingEntry,
  SpellEntry,
  SpellLevel
} from "../../../../shared/types.js";
import { readAll, toIntegerBoolean } from "../helpers.js";

export function readCompendium(database: DatabaseSync): CompendiumData {
  const spells = readAll<{
    id: string;
    name: string;
    source: string;
    level: string;
    school: SpellEntry["school"];
    castingTimeUnit: SpellEntry["castingTimeUnit"];
    castingTimeValue: number;
    rangeType: SpellEntry["rangeType"];
    rangeValue: number;
    description: string;
    componentsVerbal: number;
    componentsSomatic: number;
    componentsMaterial: number;
    componentsMaterialText: string;
    componentsMaterialValue: number;
    componentsMaterialConsumed: number;
    durationUnit: SpellEntry["durationUnit"];
    durationValue: number;
    concentration: number;
    damageNotation: string;
    damageAbility: AbilityKey | null;
    fullDescription: string;
    classesJson: string;
  }>(
    database,
    `
      SELECT
        id,
        name,
        source,
        level,
        school,
        casting_time_unit as castingTimeUnit,
        casting_time_value as castingTimeValue,
        range_type as rangeType,
        range_value as rangeValue,
        description,
        components_verbal as componentsVerbal,
        components_somatic as componentsSomatic,
        components_material as componentsMaterial,
        components_material_text as componentsMaterialText,
        components_material_value as componentsMaterialValue,
        components_material_consumed as componentsMaterialConsumed,
        duration_unit as durationUnit,
        duration_value as durationValue,
        concentration,
        damage_notation as damageNotation,
        damage_ability as damageAbility,
        full_description as fullDescription,
        classes_json as classesJson
      FROM compendium_spells
      ORDER BY sort_order, name, id
    `
  ).map((row) => ({
    id: row.id,
    name: row.name,
    source: row.source,
    level: row.level === "cantrip" ? "cantrip" : Number(row.level) as SpellLevel,
    school: row.school,
    castingTimeUnit: row.castingTimeUnit,
    castingTimeValue: row.castingTimeValue,
    rangeType: row.rangeType,
    rangeValue: row.rangeValue,
    description: row.description,
    components: {
      verbal: Boolean(row.componentsVerbal),
      somatic: Boolean(row.componentsSomatic),
      material: Boolean(row.componentsMaterial),
      materialText: row.componentsMaterialText,
      materialValue: row.componentsMaterialValue,
      materialConsumed: Boolean(row.componentsMaterialConsumed)
    },
    durationUnit: row.durationUnit,
    durationValue: row.durationValue,
    concentration: Boolean(row.concentration),
    damageNotation: row.damageNotation,
    damageAbility: row.damageAbility,
    fullDescription: row.fullDescription,
    classes: parseJsonArray<string>(row.classesJson)
  }));

  const monsters = readAll<{
    id: string;
    name: string;
    source: string;
    challengeRating: string;
    armorClass: number;
    hitPoints: number;
    initiative: number;
    speedWalk: number;
    speedFly: number;
    speedBurrow: number;
    speedSwim: number;
    speedClimb: number;
    abilityStr: number;
    abilityDex: number;
    abilityCon: number;
    abilityInt: number;
    abilityWis: number;
    abilityCha: number;
    skillsJson: string;
    sensesJson: string;
    passivePerception: number;
    languagesJson: string;
    xp: number;
    proficiencyBonus: number;
    gearJson: string;
    resistancesJson: string;
    vulnerabilitiesJson: string;
    immunitiesJson: string;
    traitsJson: string;
    actionsJson: string;
    bonusActionsJson: string;
    reactionsJson: string;
    legendaryActionsJson: string;
    legendaryActionsUse: number;
    lairActionsJson: string;
    regionalEffectsJson: string;
    spellsJson: string;
    spellcastingJson: string;
    habitat: string;
    treasure: string;
    imageUrl: string;
    color: string;
  }>(
    database,
    `
      SELECT
        id,
        name,
        source,
        challenge_rating as challengeRating,
        armor_class as armorClass,
        hit_points as hitPoints,
        initiative,
        speed_walk as speedWalk,
        speed_fly as speedFly,
        speed_burrow as speedBurrow,
        speed_swim as speedSwim,
        speed_climb as speedClimb,
        ability_str as abilityStr,
        ability_dex as abilityDex,
        ability_con as abilityCon,
        ability_int as abilityInt,
        ability_wis as abilityWis,
        ability_cha as abilityCha,
        skills_json as skillsJson,
        senses_json as sensesJson,
        passive_perception as passivePerception,
        languages_json as languagesJson,
        xp,
        proficiency_bonus as proficiencyBonus,
        gear_json as gearJson,
        resistances_json as resistancesJson,
        vulnerabilities_json as vulnerabilitiesJson,
        immunities_json as immunitiesJson,
        traits_json as traitsJson,
        actions_json as actionsJson,
        bonus_actions_json as bonusActionsJson,
        reactions_json as reactionsJson,
        legendary_actions_json as legendaryActionsJson,
        legendary_actions_use as legendaryActionsUse,
        lair_actions_json as lairActionsJson,
        regional_effects_json as regionalEffectsJson,
        spells_json as spellsJson,
        spellcasting_json as spellcastingJson,
        habitat,
        treasure,
        image_url as imageUrl,
        color
      FROM compendium_monsters
      ORDER BY sort_order, name, id
    `
  ).map((row) => ({
    id: row.id,
    name: row.name,
    source: row.source,
    challengeRating: row.challengeRating,
    armorClass: row.armorClass,
    hitPoints: row.hitPoints,
    initiative: row.initiative,
    speed: row.speedWalk,
    speedModes: {
      walk: row.speedWalk,
      fly: row.speedFly,
      burrow: row.speedBurrow,
      swim: row.speedSwim,
      climb: row.speedClimb
    },
    abilities: {
      str: row.abilityStr,
      dex: row.abilityDex,
      con: row.abilityCon,
      int: row.abilityInt,
      wis: row.abilityWis,
      cha: row.abilityCha
    },
    skills: parseJsonArray<MonsterSkillBonus>(row.skillsJson),
    senses: parseJsonArray<MonsterSense>(row.sensesJson),
    passivePerception: row.passivePerception,
    languages: parseJsonArray<string>(row.languagesJson),
    xp: row.xp,
    proficiencyBonus: row.proficiencyBonus,
    gear: parseJsonArray<string>(row.gearJson),
    resistances: parseJsonArray<string>(row.resistancesJson),
    vulnerabilities: parseJsonArray<string>(row.vulnerabilitiesJson),
    immunities: parseJsonArray<string>(row.immunitiesJson),
    traits: parseJsonArray<string>(row.traitsJson),
    actions: parseJsonArray<MonsterActionEntry>(row.actionsJson),
    bonusActions: parseJsonArray<MonsterActionEntry>(row.bonusActionsJson),
    reactions: parseJsonArray<MonsterActionEntry>(row.reactionsJson),
    legendaryActions: parseJsonArray<MonsterActionEntry>(row.legendaryActionsJson),
    legendaryActionsUse: row.legendaryActionsUse,
    lairActions: parseJsonArray<MonsterActionEntry>(row.lairActionsJson),
    regionalEffects: parseJsonArray<MonsterActionEntry>(row.regionalEffectsJson),
    spells: parseJsonArray<string>(row.spellsJson),
    spellcasting: parseJsonArray<MonsterSpellcastingEntry>(row.spellcastingJson),
    habitat: row.habitat,
    treasure: row.treasure,
    imageUrl: row.imageUrl,
    color: row.color
  }));

  const feats = readAll<{
    id: string;
    name: string;
    source: string;
    category: string;
    abilityScoreIncrease: string;
    prerequisites: string;
    description: string;
  }>(
    database,
    `
      SELECT
        id,
        name,
        source,
        category,
        ability_score_increase as abilityScoreIncrease,
        prerequisites,
        description
      FROM compendium_feats
      ORDER BY sort_order, name, id
    `
  ) as FeatEntry[];

  const classes = readAll<{
    id: string;
    name: string;
    source: string;
    description: string;
    featuresJson: string;
    tablesJson: string;
  }>(
    database,
    `
      SELECT
        id,
        name,
        source,
        description,
        features_json as featuresJson,
        tables_json as tablesJson
      FROM compendium_classes
      ORDER BY sort_order, name, id
    `
  ).map((row) => ({
    id: row.id,
    name: row.name,
    source: row.source,
    description: row.description,
    features: parseJsonArray<ClassEntry["features"][number]>(row.featuresJson),
    tables: parseJsonArray<ClassEntry["tables"][number]>(row.tablesJson)
  }));

  return {
    spells,
    monsters,
    feats,
    classes
  };
}

export function writeCompendium(database: DatabaseSync, compendium: CompendiumData) {
  const insertSpell = database.prepare(`
    INSERT INTO compendium_spells (
      id, sort_order, name, source, level, school,
      casting_time_unit, casting_time_value, range_type, range_value,
      description, components_verbal, components_somatic, components_material,
      components_material_text, components_material_value, components_material_consumed,
      duration_unit, duration_value, concentration, damage_notation, damage_ability,
      full_description, classes_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMonster = database.prepare(`
    INSERT INTO compendium_monsters (
      id, sort_order, name, source, challenge_rating, armor_class, hit_points,
      initiative,
      speed_walk, speed_fly, speed_burrow, speed_swim, speed_climb,
      ability_str, ability_dex, ability_con, ability_int, ability_wis, ability_cha,
      skills_json, senses_json, passive_perception, languages_json, xp, proficiency_bonus,
      gear_json, resistances_json, vulnerabilities_json, immunities_json,
      traits_json, actions_json, bonus_actions_json, reactions_json, legendary_actions_json,
      legendary_actions_use, lair_actions_json, regional_effects_json, spells_json, spellcasting_json,
      habitat, treasure, image_url, color
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertFeat = database.prepare(`
    INSERT INTO compendium_feats (
      id, sort_order, name, source, category, ability_score_increase, prerequisites, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertClass = database.prepare(`
    INSERT INTO compendium_classes (
      id, sort_order, name, source, description, features_json, tables_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  compendium.spells.forEach((spell, index) => {
    insertSpell.run(
      spell.id,
      index,
      spell.name,
      spell.source,
      String(spell.level),
      spell.school,
      spell.castingTimeUnit,
      spell.castingTimeValue,
      spell.rangeType,
      spell.rangeValue,
      spell.description,
      toIntegerBoolean(spell.components.verbal),
      toIntegerBoolean(spell.components.somatic),
      toIntegerBoolean(spell.components.material),
      spell.components.materialText,
      spell.components.materialValue,
      toIntegerBoolean(spell.components.materialConsumed),
      spell.durationUnit,
      spell.durationValue,
      toIntegerBoolean(spell.concentration),
      spell.damageNotation,
      spell.damageAbility,
      spell.fullDescription,
      JSON.stringify(spell.classes)
    );
  });

  compendium.monsters.forEach((monster, index) => {
    insertMonster.run(
      monster.id,
      index,
      monster.name,
      monster.source,
      monster.challengeRating,
      monster.armorClass,
      monster.hitPoints,
      monster.initiative,
      monster.speedModes.walk,
      monster.speedModes.fly,
      monster.speedModes.burrow,
      monster.speedModes.swim,
      monster.speedModes.climb,
      monster.abilities.str,
      monster.abilities.dex,
      monster.abilities.con,
      monster.abilities.int,
      monster.abilities.wis,
      monster.abilities.cha,
      JSON.stringify(monster.skills),
      JSON.stringify(monster.senses),
      monster.passivePerception,
      JSON.stringify(monster.languages),
      monster.xp,
      monster.proficiencyBonus,
      JSON.stringify(monster.gear),
      JSON.stringify(monster.resistances),
      JSON.stringify(monster.vulnerabilities),
      JSON.stringify(monster.immunities),
      JSON.stringify(monster.traits),
      JSON.stringify(monster.actions),
      JSON.stringify(monster.bonusActions),
      JSON.stringify(monster.reactions),
      JSON.stringify(monster.legendaryActions),
      monster.legendaryActionsUse,
      JSON.stringify(monster.lairActions),
      JSON.stringify(monster.regionalEffects),
      JSON.stringify(monster.spells),
      JSON.stringify(monster.spellcasting),
      monster.habitat,
      monster.treasure,
      monster.imageUrl,
      monster.color
    );
  });

  compendium.feats.forEach((feat, index) => {
    insertFeat.run(
      feat.id,
      index,
      feat.name,
      feat.source,
      feat.category,
      feat.abilityScoreIncrease,
      feat.prerequisites,
      feat.description
    );
  });

  compendium.classes.forEach((entry, index) => {
    insertClass.run(
      entry.id,
      index,
      entry.name,
      entry.source,
      entry.description,
      JSON.stringify(entry.features),
      JSON.stringify(entry.tables)
    );
  });
}

export function clearCompendiumTables(database: DatabaseSync) {
  database.exec(`
    DELETE FROM compendium_classes;
    DELETE FROM compendium_feats;
    DELETE FROM compendium_monsters;
    DELETE FROM compendium_spells;
  `);
}

function parseJsonArray<T>(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
