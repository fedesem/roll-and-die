import type { DatabaseSync } from "node:sqlite";

import type {
  AbilityKey,
  ClassEntry,
  ClassFeatureEntry,
  CompendiumData,
  FeatEntry,
  MonsterActionEntry,
  MonsterSense,
  MonsterSkillBonus,
  MonsterSpellcastingEntry,
  SpellClassReference,
  SpellEntry,
  SpellLevel
} from "../../../../shared/types.js";
import { readAll, toIntegerBoolean } from "../helpers.js";

export function readCompendium(database: DatabaseSync): CompendiumData {
  const spellClassReferencesBySpellId = new Map<string, SpellClassReference[]>();

  readAll<{
    spellId: string;
    name: string;
    source: string;
    kind: SpellClassReference["kind"];
    className: string;
    classSource: string;
  }>(
    database,
    `
      SELECT
        spell_id as spellId,
        name,
        source,
        kind,
        class_name as className,
        class_source as classSource
      FROM compendium_spell_classes
      ORDER BY spell_id, sort_order
    `
  ).forEach((row) => {
    const current = spellClassReferencesBySpellId.get(row.spellId) ?? [];

    current.push({
      name: row.name,
      source: row.source,
      kind: row.kind,
      className: row.className,
      classSource: row.classSource
    });

    spellClassReferencesBySpellId.set(row.spellId, current);
  });

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
    higherLevelDescription: string;
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
        higher_level_description as higherLevelDescription,
        full_description as fullDescription,
        classes_json as classesJson
      FROM compendium_spells
      ORDER BY sort_order, name, id
    `
  ).map((row) => {
    const classReferences = spellClassReferencesBySpellId.get(row.id) ?? [];
    const classes =
      classReferences.length > 0
        ? uniqueStrings(classReferences.map(formatSpellClassReferenceDisplay))
        : parseJsonArray<string>(row.classesJson);

    return {
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
      higherLevelDescription: row.higherLevelDescription,
      fullDescription: row.fullDescription,
      classes,
      classReferences
    } satisfies SpellEntry;
  });

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

  const classFeaturesByClassId = new Map<string, ClassFeatureEntry[]>();

  readAll<{
    classId: string;
    level: number;
    name: string;
    description: string;
    source: string;
    reference: string;
  }>(
    database,
    `
      SELECT
        class_id as classId,
        level,
        name,
        description,
        source,
        reference
      FROM compendium_class_features
      ORDER BY class_id, sort_order
    `
  ).forEach((row) => {
    const current = classFeaturesByClassId.get(row.classId) ?? [];

    current.push({
      level: row.level,
      name: row.name,
      description: row.description,
      source: row.source,
      reference: row.reference
    });

    classFeaturesByClassId.set(row.classId, current);
  });

  const classTableColumnsByKey = new Map<string, string[]>();

  readAll<{
    classId: string;
    tableIndex: number;
    label: string;
  }>(
    database,
    `
      SELECT
        class_id as classId,
        table_index as tableIndex,
        label
      FROM compendium_class_table_columns
      ORDER BY class_id, table_index, column_index
    `
  ).forEach((row) => {
    const key = createClassTableKey(row.classId, row.tableIndex);
    const current = classTableColumnsByKey.get(key) ?? [];
    current.push(row.label);
    classTableColumnsByKey.set(key, current);
  });

  const classTableCellsByKey = new Map<string, Map<number, string[]>>();

  readAll<{
    classId: string;
    tableIndex: number;
    rowIndex: number;
    value: string;
  }>(
    database,
    `
      SELECT
        class_id as classId,
        table_index as tableIndex,
        row_index as rowIndex,
        value
      FROM compendium_class_table_cells
      ORDER BY class_id, table_index, row_index, cell_index
    `
  ).forEach((row) => {
    const key = createClassTableKey(row.classId, row.tableIndex);
    const rows = classTableCellsByKey.get(key) ?? new Map<number, string[]>();
    const current = rows.get(row.rowIndex) ?? [];
    current.push(row.value);
    rows.set(row.rowIndex, current);
    classTableCellsByKey.set(key, rows);
  });

  const classTablesByClassId = new Map<string, ClassEntry["tables"]>();

  readAll<{
    classId: string;
    tableIndex: number;
    name: string;
  }>(
    database,
    `
      SELECT
        class_id as classId,
        table_index as tableIndex,
        name
      FROM compendium_class_tables
      ORDER BY class_id, table_index
    `
  ).forEach((row) => {
    const key = createClassTableKey(row.classId, row.tableIndex);
    const rows = classTableCellsByKey.get(key);
    const tableRows = rows
      ? Array.from(rows.entries())
          .sort(([left], [right]) => left - right)
          .map(([, cells]) => cells)
      : [];
    const current = classTablesByClassId.get(row.classId) ?? [];

    current.push({
      name: row.name,
      columns: classTableColumnsByKey.get(key) ?? [],
      rows: tableRows
    });

    classTablesByClassId.set(row.classId, current);
  });

  const classes = readAll<{
    id: string;
    name: string;
    source: string;
    description: string;
    hitDieFaces: number;
    primaryAbilitiesJson: string;
    savingThrowProficienciesJson: string;
    startingArmorJson: string;
    startingWeaponsJson: string;
    startingToolsJson: string;
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
        hit_die_faces as hitDieFaces,
        primary_abilities_json as primaryAbilitiesJson,
        saving_throw_proficiencies_json as savingThrowProficienciesJson,
        starting_armor_json as startingArmorJson,
        starting_weapons_json as startingWeaponsJson,
        starting_tools_json as startingToolsJson,
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
    hitDieFaces: row.hitDieFaces,
    primaryAbilities: parseJsonArray<string>(row.primaryAbilitiesJson),
    savingThrowProficiencies: parseJsonArray<string>(row.savingThrowProficienciesJson),
    startingProficiencies: {
      armor: parseJsonArray<string>(row.startingArmorJson),
      weapons: parseJsonArray<string>(row.startingWeaponsJson),
      tools: parseJsonArray<string>(row.startingToolsJson)
    },
    features: classFeaturesByClassId.get(row.id) ?? parseJsonArray<ClassFeatureEntry>(row.featuresJson),
    tables: classTablesByClassId.get(row.id) ?? parseJsonArray<ClassEntry["tables"][number]>(row.tablesJson)
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
      higher_level_description, full_description, classes_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSpellClass = database.prepare(`
    INSERT INTO compendium_spell_classes (
      spell_id, sort_order, name, source, kind, class_name, class_source
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
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
      id, sort_order, name, source, description,
      hit_die_faces, primary_abilities_json, saving_throw_proficiencies_json,
      starting_armor_json, starting_weapons_json, starting_tools_json,
      features_json, tables_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertClassFeature = database.prepare(`
    INSERT INTO compendium_class_features (
      class_id, sort_order, level, name, description, source, reference
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertClassTable = database.prepare(`
    INSERT INTO compendium_class_tables (
      class_id, table_index, name
    ) VALUES (?, ?, ?)
  `);
  const insertClassTableColumn = database.prepare(`
    INSERT INTO compendium_class_table_columns (
      class_id, table_index, column_index, label
    ) VALUES (?, ?, ?, ?)
  `);
  const insertClassTableCell = database.prepare(`
    INSERT INTO compendium_class_table_cells (
      class_id, table_index, row_index, cell_index, value
    ) VALUES (?, ?, ?, ?, ?)
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
      spell.higherLevelDescription,
      spell.fullDescription,
      JSON.stringify(spell.classes)
    );

    ensureSpellClassReferences(spell).forEach((reference, referenceIndex) => {
      insertSpellClass.run(
        spell.id,
        referenceIndex,
        reference.name,
        reference.source,
        reference.kind,
        reference.className,
        reference.classSource
      );
    });
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
      entry.hitDieFaces,
      JSON.stringify(entry.primaryAbilities),
      JSON.stringify(entry.savingThrowProficiencies),
      JSON.stringify(entry.startingProficiencies.armor),
      JSON.stringify(entry.startingProficiencies.weapons),
      JSON.stringify(entry.startingProficiencies.tools),
      JSON.stringify(entry.features),
      JSON.stringify(entry.tables)
    );

    entry.features.forEach((feature, featureIndex) => {
      insertClassFeature.run(
        entry.id,
        featureIndex,
        feature.level,
        feature.name,
        feature.description,
        feature.source,
        feature.reference
      );
    });

    entry.tables.forEach((table, tableIndex) => {
      insertClassTable.run(entry.id, tableIndex, table.name);

      table.columns.forEach((column, columnIndex) => {
        insertClassTableColumn.run(entry.id, tableIndex, columnIndex, column);
      });

      table.rows.forEach((row, rowIndex) => {
        row.forEach((cell, cellIndex) => {
          insertClassTableCell.run(entry.id, tableIndex, rowIndex, cellIndex, cell);
        });
      });
    });
  });
}

export function clearCompendiumTables(database: DatabaseSync) {
  database.exec(`
    DELETE FROM compendium_class_table_cells;
    DELETE FROM compendium_class_table_columns;
    DELETE FROM compendium_class_tables;
    DELETE FROM compendium_class_features;
    DELETE FROM compendium_spell_classes;
    DELETE FROM compendium_classes;
    DELETE FROM compendium_feats;
    DELETE FROM compendium_monsters;
    DELETE FROM compendium_spells;
  `);
}

function ensureSpellClassReferences(spell: SpellEntry): SpellClassReference[] {
  if (spell.classReferences.length > 0) {
    return spell.classReferences;
  }

  return spell.classes.map((className) => ({
    name: className,
    source: "",
    kind: "class" as const,
    className,
    classSource: ""
  }));
}

function formatSpellClassReferenceDisplay(reference: SpellClassReference) {
  if (reference.kind === "subclass" || reference.kind === "subclassVariant") {
    return reference.className ? `${reference.name} (${reference.className})` : reference.name;
  }

  return reference.name;
}

function createClassTableKey(classId: string, tableIndex: number) {
  return `${classId}:${tableIndex}`;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseJsonArray<T>(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
