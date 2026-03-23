import type { DatabaseSync } from "../types.js";
import type { AbilityKey, CampaignSourceBook, ClassEntry, ClassFeatureEntry, ClassSubclassEntry, CompendiumData, CompendiumReferenceEntry, FeatEntry, MonsterActionEntry, MonsterSense, MonsterSkillBonus, MonsterSpellcastingEntry, MonsterTemplate, SpellClassReference, SpellEntry, SpellLevel } from "../../../../shared/types.js";
import { readAll, toIntegerBoolean } from "../helpers.js";
export type CompendiumCollectionKind = keyof CompendiumData;
type ReferenceCompendiumKind = Extract<CompendiumCollectionKind, "optionalFeatures" | "actions" | "backgrounds" | "items" | "languages" | "races" | "skills">;
export async function readCampaignCompendium(database: DatabaseSync): Promise<Pick<CompendiumData, "spells" | "monsters" | "feats" | "classes">> {
    return {
        spells: await readSpellEntries(database),
        monsters: await readMonsterEntries(database),
        feats: await readFeatEntries(database),
        classes: await readClassEntries(database)
    };
}
export async function readCompendiumCollection<K extends CompendiumCollectionKind>(database: DatabaseSync, kind: K): Promise<CompendiumData[K]> {
    switch (kind) {
        case "spells":
            return (await readSpellEntries(database)) as CompendiumData[K];
        case "monsters":
            return (await readMonsterEntries(database)) as CompendiumData[K];
        case "feats":
            return (await readFeatEntries(database)) as CompendiumData[K];
        case "classes":
            return (await readClassEntries(database)) as CompendiumData[K];
        case "books":
            return (await readBookEntries(database)) as CompendiumData[K];
        case "optionalFeatures":
        case "actions":
        case "backgrounds":
        case "items":
        case "languages":
        case "races":
        case "skills":
            return (await readReferenceEntries(database, kind)) as CompendiumData[K];
    }
}
export async function readCompendiumSourceBooks(database: DatabaseSync) {
    return await readBookEntries(database);
}
export async function readMonsterTemplateById(database: DatabaseSync, monsterId: string): Promise<MonsterTemplate | null> {
    const entries = await readMonsterEntries(database, monsterId);
    return entries[0] ?? null;
}
export async function compendiumEntryExists(database: DatabaseSync, kind: CompendiumCollectionKind, entryId: string) {
    switch (kind) {
        case "spells":
            return Boolean(await database.prepare("SELECT 1 FROM compendium_spells WHERE id = ? LIMIT 1").get(entryId));
        case "monsters":
            return Boolean(await database.prepare("SELECT 1 FROM compendium_monsters WHERE id = ? LIMIT 1").get(entryId));
        case "feats":
            return Boolean(await database.prepare("SELECT 1 FROM compendium_feats WHERE id = ? LIMIT 1").get(entryId));
        case "classes":
            return Boolean(await database.prepare("SELECT 1 FROM compendium_classes WHERE id = ? LIMIT 1").get(entryId));
        case "books":
            return Boolean(await database.prepare("SELECT 1 FROM compendium_books WHERE source = ? LIMIT 1").get(entryId));
        case "optionalFeatures":
        case "actions":
        case "backgrounds":
        case "items":
        case "languages":
        case "races":
        case "skills":
            return Boolean(await database
                .prepare("SELECT 1 FROM compendium_references WHERE kind = ? AND id = ? LIMIT 1")
                .get(kind, entryId));
    }
}
async function readSpellEntries(database: DatabaseSync): Promise<SpellEntry[]> {
    const spellClassReferencesBySpellId = new Map<string, SpellClassReference[]>();
    (await readAll<{
        spellId: string;
        name: string;
        source: string;
        kind: SpellClassReference["kind"];
        className: string;
        classSource: string;
        definedInSourcesJson: string;
    }>(database, `
      SELECT
        spell_id as spellId,
        name,
        source,
        kind,
        class_name as className,
        class_source as classSource,
        defined_in_sources_json as definedInSourcesJson
      FROM compendium_spell_classes
      ORDER BY spell_id, sort_order
    `)).forEach((row) => {
        const current = spellClassReferencesBySpellId.get(row.spellId) ?? [];
        current.push({
            name: row.name,
            source: row.source,
            kind: row.kind,
            className: row.className,
            classSource: row.classSource,
            definedInSources: parseJsonArray<string>(row.definedInSourcesJson)
        });
        spellClassReferencesBySpellId.set(row.spellId, current);
    });
    return (await readAll<{
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
    }>(database, `
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
    `)).map((row) => {
        const classReferences = spellClassReferencesBySpellId.get(row.id) ?? [];
        const classes = classReferences.length > 0
            ? uniqueStrings(classReferences.map(formatSpellClassReferenceDisplay))
            : parseJsonArray<string>(row.classesJson);
        return {
            id: row.id,
            name: row.name,
            source: row.source,
            level: row.level === "cantrip" ? "cantrip" : (Number(row.level) as SpellLevel),
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
}
async function readMonsterEntries(database: DatabaseSync, monsterId?: string): Promise<MonsterTemplate[]> {
    return (await readAll<{
        id: string;
        name: string;
        source: string;
        challengeRating: string;
        creatureType: string;
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
    }>(database, `
      SELECT
        id,
        name,
        source,
        challenge_rating as challengeRating,
        creature_type as creatureType,
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
      ${monsterId ? "WHERE id = ?" : ""}
      ORDER BY sort_order, name, id
    `, ...(monsterId ? [monsterId] : []))).map((row) => ({
        id: row.id,
        name: row.name,
        source: row.source,
        challengeRating: row.challengeRating,
        creatureType: row.creatureType,
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
}
async function readFeatEntries(database: DatabaseSync): Promise<FeatEntry[]> {
    return (await readAll<{
        id: string;
        name: string;
        source: string;
        category: string;
        abilityScoreIncrease: string;
        prerequisites: string;
        description: string;
    }>(database, `
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
    `)) as FeatEntry[];
}
async function readClassEntries(database: DatabaseSync): Promise<ClassEntry[]> {
    const classFeaturesByClassId = new Map<string, ClassFeatureEntry[]>();
    (await readAll<{
        classId: string;
        level: number;
        name: string;
        description: string;
        source: string;
        reference: string;
    }>(database, `
      SELECT
        class_id as classId,
        level,
        name,
        description,
        source,
        reference
      FROM compendium_class_features
      ORDER BY class_id, sort_order
    `)).forEach((row) => {
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
    (await readAll<{
        classId: string;
        tableIndex: number;
        label: string;
    }>(database, `
      SELECT
        class_id as classId,
        table_index as tableIndex,
        label
      FROM compendium_class_table_columns
      ORDER BY class_id, table_index, column_index
    `)).forEach((row) => {
        const key = createClassTableKey(row.classId, row.tableIndex);
        const current = classTableColumnsByKey.get(key) ?? [];
        current.push(row.label);
        classTableColumnsByKey.set(key, current);
    });
    const classTableCellsByKey = new Map<string, Map<number, string[]>>();
    (await readAll<{
        classId: string;
        tableIndex: number;
        rowIndex: number;
        value: string;
    }>(database, `
      SELECT
        class_id as classId,
        table_index as tableIndex,
        row_index as rowIndex,
        value
      FROM compendium_class_table_cells
      ORDER BY class_id, table_index, row_index, cell_index
    `)).forEach((row) => {
        const key = createClassTableKey(row.classId, row.tableIndex);
        const rows = classTableCellsByKey.get(key) ?? new Map<number, string[]>();
        const current = rows.get(row.rowIndex) ?? [];
        current.push(row.value);
        rows.set(row.rowIndex, current);
        classTableCellsByKey.set(key, rows);
    });
    const classTablesByClassId = new Map<string, ClassEntry["tables"]>();
    (await readAll<{
        classId: string;
        tableIndex: number;
        name: string;
    }>(database, `
      SELECT
        class_id as classId,
        table_index as tableIndex,
        name
      FROM compendium_class_tables
      ORDER BY class_id, table_index
    `)).forEach((row) => {
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
    return (await readAll<{
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
        subclassesJson: string;
        tablesJson: string;
    }>(database, `
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
        subclasses_json as subclassesJson,
        tables_json as tablesJson
      FROM compendium_classes
      ORDER BY sort_order, name, id
    `)).map((row) => ({
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
        subclasses: parseJsonArray<ClassSubclassEntry>(row.subclassesJson),
        tables: classTablesByClassId.get(row.id) ?? parseJsonArray<ClassEntry["tables"][number]>(row.tablesJson)
    }));
}
async function readReferenceEntries(database: DatabaseSync, kind: ReferenceCompendiumKind): Promise<CompendiumReferenceEntry[]> {
    return (await readAll<{
        id: string;
        name: string;
        source: string;
        category: string;
        description: string;
        tagsJson: string;
    }>(database, `
      SELECT
        id,
        name,
        source,
        category,
        description,
        tags_json as tagsJson
      FROM compendium_references
      WHERE kind = ?
      ORDER BY sort_order, name, id
    `, kind)).map((row) => ({
        id: row.id,
        name: row.name,
        source: row.source,
        category: row.category,
        description: row.description,
        tags: parseJsonArray<string>(row.tagsJson)
    }));
}
async function readBookEntries(database: DatabaseSync): Promise<CampaignSourceBook[]> {
    return (await readAll<{
        source: string;
        name: string;
        groupName: string;
        published: string;
        author: string;
    }>(database, `
      SELECT
        source,
        name,
        group_name as groupName,
        published,
        author
      FROM compendium_books
      ORDER BY sort_order, name, source
    `)).map((row) => ({
        source: row.source,
        name: row.name,
        group: row.groupName,
        published: row.published,
        author: row.author
    }));
}
export async function insertCompendiumEntriesAtStart<K extends CompendiumCollectionKind>(database: DatabaseSync, kind: K, entries: CompendiumData[K]) {
    const nextEntries = [...entries] as CompendiumData[K];
    if (nextEntries.length === 0) {
        return;
    }
    await shiftCompendiumSortOrders(database, kind, nextEntries.length);
    nextEntries.forEach((entry, index) => {
        writeCompendiumEntry(database, kind, entry, index);
    });
}
export async function insertCompendiumEntryAtStart(database: DatabaseSync, kind: CompendiumCollectionKind, entry: CompendiumData[CompendiumCollectionKind][number]) {
    await insertCompendiumEntriesAtStart(database, kind, [entry] as never);
}
export async function upsertCompendiumEntry<K extends CompendiumCollectionKind>(database: DatabaseSync, kind: K, entry: CompendiumData[K][number]) {
    const sortOrder = (await readExistingCompendiumSortOrder(database, kind, getCompendiumEntryKey(entry))) ??
        (await readNextCompendiumSortOrder(database, kind));
    writeCompendiumEntry(database, kind, entry, sortOrder);
}
export function deleteCompendiumEntryRecord(database: DatabaseSync, kind: CompendiumCollectionKind, entryId: string) {
    switch (kind) {
        case "spells":
            database.prepare("DELETE FROM compendium_spells WHERE id = ?").run(entryId);
            return;
        case "monsters":
            database.prepare("DELETE FROM compendium_monsters WHERE id = ?").run(entryId);
            return;
        case "feats":
            database.prepare("DELETE FROM compendium_feats WHERE id = ?").run(entryId);
            return;
        case "classes":
            database.prepare("DELETE FROM compendium_classes WHERE id = ?").run(entryId);
            return;
        case "books":
            database.prepare("DELETE FROM compendium_books WHERE source = ?").run(entryId);
            return;
        case "optionalFeatures":
        case "actions":
        case "backgrounds":
        case "items":
        case "languages":
        case "races":
        case "skills":
            database
                .prepare("DELETE FROM compendium_references WHERE kind = ? AND id = ?")
                .run(kind, entryId);
            return;
    }
}
export function clearCompendiumCollection(database: DatabaseSync, kind: CompendiumCollectionKind) {
    switch (kind) {
        case "spells":
            database.prepare("DELETE FROM compendium_spells").run();
            return;
        case "monsters":
            database.prepare("DELETE FROM compendium_monsters").run();
            return;
        case "feats":
            database.prepare("DELETE FROM compendium_feats").run();
            return;
        case "classes":
            database.prepare("DELETE FROM compendium_classes").run();
            return;
        case "books":
            database.prepare("DELETE FROM compendium_books").run();
            return;
        case "optionalFeatures":
        case "actions":
        case "backgrounds":
        case "items":
        case "languages":
        case "races":
        case "skills":
            database.prepare("DELETE FROM compendium_references WHERE kind = ?").run(kind);
            return;
    }
}
async function shiftCompendiumSortOrders(database: DatabaseSync, kind: CompendiumCollectionKind, amount: number) {
    if (amount <= 0) {
        return;
    }
    switch (kind) {
        case "spells":
            await database.prepare("UPDATE compendium_spells SET sort_order = sort_order + ?").run(amount);
            return;
        case "monsters":
            await database.prepare("UPDATE compendium_monsters SET sort_order = sort_order + ?").run(amount);
            return;
        case "feats":
            await database.prepare("UPDATE compendium_feats SET sort_order = sort_order + ?").run(amount);
            return;
        case "classes":
            await database.prepare("UPDATE compendium_classes SET sort_order = sort_order + ?").run(amount);
            return;
        case "books":
            await database.prepare("UPDATE compendium_books SET sort_order = sort_order + ?").run(amount);
            return;
        case "optionalFeatures":
        case "actions":
        case "backgrounds":
        case "items":
        case "languages":
        case "races":
        case "skills":
            await database
                .prepare("UPDATE compendium_references SET sort_order = sort_order + ? WHERE kind = ?")
                .run(amount, kind);
            return;
    }
}
async function readExistingCompendiumSortOrder(database: DatabaseSync, kind: CompendiumCollectionKind, entryId: string) {
    switch (kind) {
        case "spells": {
            const row = await database
                .prepare("SELECT sort_order as sortOrder FROM compendium_spells WHERE id = ? LIMIT 1")
                .get<{
                sortOrder: number;
            }>(entryId);
            return row?.sortOrder ?? null;
        }
        case "monsters": {
            const row = await database
                .prepare("SELECT sort_order as sortOrder FROM compendium_monsters WHERE id = ? LIMIT 1")
                .get<{
                sortOrder: number;
            }>(entryId);
            return row?.sortOrder ?? null;
        }
        case "feats": {
            const row = await database
                .prepare("SELECT sort_order as sortOrder FROM compendium_feats WHERE id = ? LIMIT 1")
                .get<{
                sortOrder: number;
            }>(entryId);
            return row?.sortOrder ?? null;
        }
        case "classes": {
            const row = await database
                .prepare("SELECT sort_order as sortOrder FROM compendium_classes WHERE id = ? LIMIT 1")
                .get<{
                sortOrder: number;
            }>(entryId);
            return row?.sortOrder ?? null;
        }
        case "books": {
            const row = await database
                .prepare("SELECT sort_order as sortOrder FROM compendium_books WHERE source = ? LIMIT 1")
                .get<{
                sortOrder: number;
            }>(entryId);
            return row?.sortOrder ?? null;
        }
        case "optionalFeatures":
        case "actions":
        case "backgrounds":
        case "items":
        case "languages":
        case "races":
        case "skills": {
            const row = await database
                .prepare("SELECT sort_order as sortOrder FROM compendium_references WHERE kind = ? AND id = ? LIMIT 1")
                .get<{
                sortOrder: number;
            }>(kind, entryId);
            return row?.sortOrder ?? null;
        }
    }
}
async function readNextCompendiumSortOrder(database: DatabaseSync, kind: CompendiumCollectionKind) {
    switch (kind) {
        case "spells": {
            const row = await database
                .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 as nextSortOrder FROM compendium_spells")
                .get<{
                nextSortOrder: number;
            }>();
            return row?.nextSortOrder ?? 0;
        }
        case "monsters": {
            const row = await database
                .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 as nextSortOrder FROM compendium_monsters")
                .get<{
                nextSortOrder: number;
            }>();
            return row?.nextSortOrder ?? 0;
        }
        case "feats": {
            const row = await database
                .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 as nextSortOrder FROM compendium_feats")
                .get<{
                nextSortOrder: number;
            }>();
            return row?.nextSortOrder ?? 0;
        }
        case "classes": {
            const row = await database
                .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 as nextSortOrder FROM compendium_classes")
                .get<{
                nextSortOrder: number;
            }>();
            return row?.nextSortOrder ?? 0;
        }
        case "books": {
            const row = await database
                .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 as nextSortOrder FROM compendium_books")
                .get<{
                nextSortOrder: number;
            }>();
            return row?.nextSortOrder ?? 0;
        }
        case "optionalFeatures":
        case "actions":
        case "backgrounds":
        case "items":
        case "languages":
        case "races":
        case "skills": {
            const row = await database
                .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 as nextSortOrder FROM compendium_references WHERE kind = ?")
                .get<{
                nextSortOrder: number;
            }>(kind);
            return row?.nextSortOrder ?? 0;
        }
    }
}
function writeCompendiumEntry<K extends CompendiumCollectionKind>(database: DatabaseSync, kind: K, entry: CompendiumData[K][number], sortOrder: number) {
    switch (kind) {
        case "spells":
            upsertSpellEntry(database, entry as SpellEntry, sortOrder);
            return;
        case "monsters":
            upsertMonsterEntry(database, entry as MonsterTemplate, sortOrder);
            return;
        case "feats":
            upsertFeatEntry(database, entry as FeatEntry, sortOrder);
            return;
        case "classes":
            upsertClassEntry(database, entry as ClassEntry, sortOrder);
            return;
        case "books":
            upsertBookEntry(database, entry as CampaignSourceBook, sortOrder);
            return;
        case "optionalFeatures":
        case "actions":
        case "backgrounds":
        case "items":
        case "languages":
        case "races":
        case "skills":
            upsertReferenceEntry(database, kind, entry as CompendiumReferenceEntry, sortOrder);
            return;
    }
}
function upsertSpellEntry(database: DatabaseSync, spell: SpellEntry, sortOrder: number) {
    database
        .prepare(`
        INSERT INTO compendium_spells (
          id, sort_order, name, source, level, school,
          casting_time_unit, casting_time_value, range_type, range_value,
          description, components_verbal, components_somatic, components_material,
          components_material_text, components_material_value, components_material_consumed,
          duration_unit, duration_value, concentration, damage_notation, damage_ability,
          higher_level_description, full_description, classes_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          sort_order = excluded.sort_order,
          name = excluded.name,
          source = excluded.source,
          level = excluded.level,
          school = excluded.school,
          casting_time_unit = excluded.casting_time_unit,
          casting_time_value = excluded.casting_time_value,
          range_type = excluded.range_type,
          range_value = excluded.range_value,
          description = excluded.description,
          components_verbal = excluded.components_verbal,
          components_somatic = excluded.components_somatic,
          components_material = excluded.components_material,
          components_material_text = excluded.components_material_text,
          components_material_value = excluded.components_material_value,
          components_material_consumed = excluded.components_material_consumed,
          duration_unit = excluded.duration_unit,
          duration_value = excluded.duration_value,
          concentration = excluded.concentration,
          damage_notation = excluded.damage_notation,
          damage_ability = excluded.damage_ability,
          higher_level_description = excluded.higher_level_description,
          full_description = excluded.full_description,
          classes_json = excluded.classes_json
      `)
        .run(spell.id, sortOrder, spell.name, spell.source, String(spell.level), spell.school, spell.castingTimeUnit, spell.castingTimeValue, spell.rangeType, spell.rangeValue, spell.description, toIntegerBoolean(spell.components.verbal), toIntegerBoolean(spell.components.somatic), toIntegerBoolean(spell.components.material), spell.components.materialText, spell.components.materialValue, toIntegerBoolean(spell.components.materialConsumed), spell.durationUnit, spell.durationValue, toIntegerBoolean(spell.concentration), spell.damageNotation, spell.damageAbility, spell.higherLevelDescription, spell.fullDescription, JSON.stringify(spell.classes));
    database.prepare("DELETE FROM compendium_spell_classes WHERE spell_id = ?").run(spell.id);
    ensureSpellClassReferences(spell).forEach((reference, referenceIndex) => {
        database
            .prepare(`
          INSERT INTO compendium_spell_classes (
            spell_id, sort_order, name, source, kind, class_name, class_source, defined_in_sources_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
            .run(spell.id, referenceIndex, reference.name, reference.source, reference.kind, reference.className, reference.classSource, JSON.stringify(reference.definedInSources));
    });
}
function upsertMonsterEntry(database: DatabaseSync, monster: MonsterTemplate, sortOrder: number) {
    database
        .prepare(`
        INSERT INTO compendium_monsters (
          id, sort_order, name, source, challenge_rating, creature_type, armor_class, hit_points,
          initiative,
          speed_walk, speed_fly, speed_burrow, speed_swim, speed_climb,
          ability_str, ability_dex, ability_con, ability_int, ability_wis, ability_cha,
          skills_json, senses_json, passive_perception, languages_json, xp, proficiency_bonus,
          gear_json, resistances_json, vulnerabilities_json, immunities_json,
          traits_json, actions_json, bonus_actions_json, reactions_json, legendary_actions_json,
          legendary_actions_use, lair_actions_json, regional_effects_json, spells_json, spellcasting_json,
          habitat, treasure, image_url, color
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          sort_order = excluded.sort_order,
          name = excluded.name,
          source = excluded.source,
          challenge_rating = excluded.challenge_rating,
          creature_type = excluded.creature_type,
          armor_class = excluded.armor_class,
          hit_points = excluded.hit_points,
          initiative = excluded.initiative,
          speed_walk = excluded.speed_walk,
          speed_fly = excluded.speed_fly,
          speed_burrow = excluded.speed_burrow,
          speed_swim = excluded.speed_swim,
          speed_climb = excluded.speed_climb,
          ability_str = excluded.ability_str,
          ability_dex = excluded.ability_dex,
          ability_con = excluded.ability_con,
          ability_int = excluded.ability_int,
          ability_wis = excluded.ability_wis,
          ability_cha = excluded.ability_cha,
          skills_json = excluded.skills_json,
          senses_json = excluded.senses_json,
          passive_perception = excluded.passive_perception,
          languages_json = excluded.languages_json,
          xp = excluded.xp,
          proficiency_bonus = excluded.proficiency_bonus,
          gear_json = excluded.gear_json,
          resistances_json = excluded.resistances_json,
          vulnerabilities_json = excluded.vulnerabilities_json,
          immunities_json = excluded.immunities_json,
          traits_json = excluded.traits_json,
          actions_json = excluded.actions_json,
          bonus_actions_json = excluded.bonus_actions_json,
          reactions_json = excluded.reactions_json,
          legendary_actions_json = excluded.legendary_actions_json,
          legendary_actions_use = excluded.legendary_actions_use,
          lair_actions_json = excluded.lair_actions_json,
          regional_effects_json = excluded.regional_effects_json,
          spells_json = excluded.spells_json,
          spellcasting_json = excluded.spellcasting_json,
          habitat = excluded.habitat,
          treasure = excluded.treasure,
          image_url = excluded.image_url,
          color = excluded.color
      `)
        .run(monster.id, sortOrder, monster.name, monster.source, monster.challengeRating, monster.creatureType, monster.armorClass, monster.hitPoints, monster.initiative, monster.speedModes.walk, monster.speedModes.fly, monster.speedModes.burrow, monster.speedModes.swim, monster.speedModes.climb, monster.abilities.str, monster.abilities.dex, monster.abilities.con, monster.abilities.int, monster.abilities.wis, monster.abilities.cha, JSON.stringify(monster.skills), JSON.stringify(monster.senses), monster.passivePerception, JSON.stringify(monster.languages), monster.xp, monster.proficiencyBonus, JSON.stringify(monster.gear), JSON.stringify(monster.resistances), JSON.stringify(monster.vulnerabilities), JSON.stringify(monster.immunities), JSON.stringify(monster.traits), JSON.stringify(monster.actions), JSON.stringify(monster.bonusActions), JSON.stringify(monster.reactions), JSON.stringify(monster.legendaryActions), monster.legendaryActionsUse, JSON.stringify(monster.lairActions), JSON.stringify(monster.regionalEffects), JSON.stringify(monster.spells), JSON.stringify(monster.spellcasting), monster.habitat, monster.treasure, monster.imageUrl, monster.color);
}
function upsertFeatEntry(database: DatabaseSync, feat: FeatEntry, sortOrder: number) {
    database
        .prepare(`
        INSERT INTO compendium_feats (
          id, sort_order, name, source, category, ability_score_increase, prerequisites, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          sort_order = excluded.sort_order,
          name = excluded.name,
          source = excluded.source,
          category = excluded.category,
          ability_score_increase = excluded.ability_score_increase,
          prerequisites = excluded.prerequisites,
          description = excluded.description
      `)
        .run(feat.id, sortOrder, feat.name, feat.source, feat.category, feat.abilityScoreIncrease, feat.prerequisites, feat.description);
}
function upsertClassEntry(database: DatabaseSync, entry: ClassEntry, sortOrder: number) {
    database
        .prepare(`
        INSERT INTO compendium_classes (
          id, sort_order, name, source, description,
          hit_die_faces, primary_abilities_json, saving_throw_proficiencies_json,
          starting_armor_json, starting_weapons_json, starting_tools_json,
          features_json, subclasses_json, tables_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          sort_order = excluded.sort_order,
          name = excluded.name,
          source = excluded.source,
          description = excluded.description,
          hit_die_faces = excluded.hit_die_faces,
          primary_abilities_json = excluded.primary_abilities_json,
          saving_throw_proficiencies_json = excluded.saving_throw_proficiencies_json,
          starting_armor_json = excluded.starting_armor_json,
          starting_weapons_json = excluded.starting_weapons_json,
          starting_tools_json = excluded.starting_tools_json,
          features_json = excluded.features_json,
          subclasses_json = excluded.subclasses_json,
          tables_json = excluded.tables_json
      `)
        .run(entry.id, sortOrder, entry.name, entry.source, entry.description, entry.hitDieFaces, JSON.stringify(entry.primaryAbilities), JSON.stringify(entry.savingThrowProficiencies), JSON.stringify(entry.startingProficiencies.armor), JSON.stringify(entry.startingProficiencies.weapons), JSON.stringify(entry.startingProficiencies.tools), JSON.stringify(entry.features), JSON.stringify(entry.subclasses), JSON.stringify(entry.tables));
    database.prepare("DELETE FROM compendium_class_features WHERE class_id = ?").run(entry.id);
    database.prepare("DELETE FROM compendium_class_tables WHERE class_id = ?").run(entry.id);
    entry.features.forEach((feature, featureIndex) => {
        database
            .prepare(`
          INSERT INTO compendium_class_features (
            class_id, sort_order, level, name, description, source, reference
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
            .run(entry.id, featureIndex, feature.level, feature.name, feature.description, feature.source, feature.reference);
    });
    entry.tables.forEach((table, tableIndex) => {
        database
            .prepare(`
          INSERT INTO compendium_class_tables (class_id, table_index, name)
          VALUES (?, ?, ?)
        `)
            .run(entry.id, tableIndex, table.name);
        table.columns.forEach((column, columnIndex) => {
            database
                .prepare(`
            INSERT INTO compendium_class_table_columns (class_id, table_index, column_index, label)
            VALUES (?, ?, ?, ?)
          `)
                .run(entry.id, tableIndex, columnIndex, column);
        });
        table.rows.forEach((row, rowIndex) => {
            row.forEach((cell, cellIndex) => {
                database
                    .prepare(`
              INSERT INTO compendium_class_table_cells (class_id, table_index, row_index, cell_index, value)
              VALUES (?, ?, ?, ?, ?)
            `)
                    .run(entry.id, tableIndex, rowIndex, cellIndex, cell);
            });
        });
    });
}
function upsertReferenceEntry(database: DatabaseSync, kind: ReferenceCompendiumKind, entry: CompendiumReferenceEntry, sortOrder: number) {
    database
        .prepare(`
        INSERT INTO compendium_references (
          kind, id, sort_order, name, source, category, description, tags_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(kind, id) DO UPDATE SET
          sort_order = excluded.sort_order,
          name = excluded.name,
          source = excluded.source,
          category = excluded.category,
          description = excluded.description,
          tags_json = excluded.tags_json
      `)
        .run(kind, entry.id, sortOrder, entry.name, entry.source, entry.category, entry.description, JSON.stringify(entry.tags));
}
function upsertBookEntry(database: DatabaseSync, entry: CampaignSourceBook, sortOrder: number) {
    database
        .prepare(`
        INSERT INTO compendium_books (
          source, sort_order, name, group_name, published, author
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(source) DO UPDATE SET
          sort_order = excluded.sort_order,
          name = excluded.name,
          group_name = excluded.group_name,
          published = excluded.published,
          author = excluded.author
      `)
        .run(entry.source, sortOrder, entry.name, entry.group, entry.published, entry.author);
}
function getCompendiumEntryKey(entry: CompendiumData[CompendiumCollectionKind][number]) {
    return "id" in entry ? entry.id : entry.source;
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
        classSource: "",
        definedInSources: []
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
    }
    catch {
        return [];
    }
}
