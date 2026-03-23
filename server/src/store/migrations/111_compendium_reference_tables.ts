import { addColumnIfMissing, readAll, readCount, tableExists } from "../helpers.js";
import type { Migration } from "../types.js";
interface LegacyClassFeatureEntry {
    level?: number;
    name?: string;
    description?: string;
    source?: string;
    reference?: string;
}
interface LegacyClassTableEntry {
    name?: string;
    columns?: string[];
    rows?: string[][];
}
export const compendiumReferenceTablesMigration: Migration = {
    version: 111,
    name: "compendium_reference_tables",
    async up(database) {
        if (await tableExists(database, "compendium_spells")) {
            await addColumnIfMissing(database, "compendium_spells", "higher_level_description", "TEXT NOT NULL DEFAULT ''");
        }
        if (await tableExists(database, "compendium_classes")) {
            await addColumnIfMissing(database, "compendium_classes", "hit_die_faces", "INTEGER NOT NULL DEFAULT 0");
            await addColumnIfMissing(database, "compendium_classes", "primary_abilities_json", "TEXT NOT NULL DEFAULT '[]'");
            await addColumnIfMissing(database, "compendium_classes", "saving_throw_proficiencies_json", "TEXT NOT NULL DEFAULT '[]'");
            await addColumnIfMissing(database, "compendium_classes", "starting_armor_json", "TEXT NOT NULL DEFAULT '[]'");
            await addColumnIfMissing(database, "compendium_classes", "starting_weapons_json", "TEXT NOT NULL DEFAULT '[]'");
            await addColumnIfMissing(database, "compendium_classes", "starting_tools_json", "TEXT NOT NULL DEFAULT '[]'");
        }
        await database.exec(`
      CREATE TABLE IF NOT EXISTS compendium_spell_classes (
        spell_id TEXT NOT NULL REFERENCES compendium_spells(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL,
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        kind TEXT NOT NULL,
        class_name TEXT NOT NULL,
        class_source TEXT NOT NULL,
        defined_in_sources_json TEXT NOT NULL DEFAULT '[]',
        PRIMARY KEY (spell_id, sort_order)
      );

      CREATE TABLE IF NOT EXISTS compendium_class_features (
        class_id TEXT NOT NULL REFERENCES compendium_classes(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL,
        level INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        source TEXT NOT NULL,
        reference TEXT NOT NULL,
        PRIMARY KEY (class_id, sort_order)
      );

      CREATE TABLE IF NOT EXISTS compendium_class_tables (
        class_id TEXT NOT NULL REFERENCES compendium_classes(id) ON DELETE CASCADE,
        table_index INTEGER NOT NULL,
        name TEXT NOT NULL,
        PRIMARY KEY (class_id, table_index)
      );

      CREATE TABLE IF NOT EXISTS compendium_class_table_columns (
        class_id TEXT NOT NULL,
        table_index INTEGER NOT NULL,
        column_index INTEGER NOT NULL,
        label TEXT NOT NULL,
        PRIMARY KEY (class_id, table_index, column_index),
        FOREIGN KEY (class_id, table_index) REFERENCES compendium_class_tables(class_id, table_index) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS compendium_class_table_cells (
        class_id TEXT NOT NULL,
        table_index INTEGER NOT NULL,
        row_index INTEGER NOT NULL,
        cell_index INTEGER NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (class_id, table_index, row_index, cell_index),
        FOREIGN KEY (class_id, table_index) REFERENCES compendium_class_tables(class_id, table_index) ON DELETE CASCADE
      );
    `);
        if (await tableExists(database, "compendium_spells") && (await readCount(database, "compendium_spell_classes")) === 0) {
            const spellRows = await readAll<{
                id: string;
                classesJson: string;
            }>(database, `
          SELECT
            id,
            classes_json as classesJson
          FROM compendium_spells
          ORDER BY sort_order, name, id
        `);
            const insertSpellClass = database.prepare(`
        INSERT INTO compendium_spell_classes (
          spell_id, sort_order, name, source, kind, class_name, class_source, defined_in_sources_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
            spellRows.forEach((row) => {
                parseJsonArray<string>(row.classesJson).forEach((className, index) => {
                    insertSpellClass.run(row.id, index, className, "", "class", className, "", "[]");
                });
            });
        }
        if (await tableExists(database, "compendium_classes") && (await readCount(database, "compendium_class_features")) === 0) {
            const classRows = await readAll<{
                id: string;
                source: string;
                featuresJson: string;
            }>(database, `
          SELECT
            id,
            source,
            features_json as featuresJson
          FROM compendium_classes
          ORDER BY sort_order, name, id
        `);
            const insertFeature = database.prepare(`
        INSERT INTO compendium_class_features (
          class_id, sort_order, level, name, description, source, reference
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
            classRows.forEach((row) => {
                parseJsonArray<LegacyClassFeatureEntry>(row.featuresJson).forEach((feature, index) => {
                    const name = String(feature.name ?? "").trim();
                    if (!name) {
                        return;
                    }
                    insertFeature.run(row.id, index, typeof feature.level === "number" && Number.isFinite(feature.level) ? feature.level : 1, name, String(feature.description ?? "").trim(), String(feature.source ?? "").trim(), String(feature.reference ?? "").trim());
                });
            });
        }
        if ((await tableExists(database, "compendium_classes")) &&
            (await readCount(database, "compendium_class_tables")) === 0 &&
            (await readCount(database, "compendium_class_table_columns")) === 0 &&
            (await readCount(database, "compendium_class_table_cells")) === 0) {
            const classRows = await readAll<{
                id: string;
                tablesJson: string;
            }>(database, `
          SELECT
            id,
            tables_json as tablesJson
          FROM compendium_classes
          ORDER BY sort_order, name, id
        `);
            const insertTable = database.prepare(`
        INSERT INTO compendium_class_tables (
          class_id, table_index, name
        ) VALUES (?, ?, ?)
      `);
            const insertColumn = database.prepare(`
        INSERT INTO compendium_class_table_columns (
          class_id, table_index, column_index, label
        ) VALUES (?, ?, ?, ?)
      `);
            const insertCell = database.prepare(`
        INSERT INTO compendium_class_table_cells (
          class_id, table_index, row_index, cell_index, value
        ) VALUES (?, ?, ?, ?, ?)
      `);
            classRows.forEach((row) => {
                parseJsonArray<LegacyClassTableEntry>(row.tablesJson).forEach((table, tableIndex) => {
                    insertTable.run(row.id, tableIndex, String(table.name ?? "").trim() || "Class Table");
                    (Array.isArray(table.columns) ? table.columns : []).forEach((column, columnIndex) => {
                        insertColumn.run(row.id, tableIndex, columnIndex, String(column ?? ""));
                    });
                    (Array.isArray(table.rows) ? table.rows : []).forEach((cells, rowIndex) => {
                        (Array.isArray(cells) ? cells : []).forEach((cell, cellIndex) => {
                            insertCell.run(row.id, tableIndex, rowIndex, cellIndex, String(cell ?? ""));
                        });
                    });
                });
            });
        }
    }
};
function parseJsonArray<T>(raw: string) {
    try {
        const parsed = JSON.parse(raw) as unknown;
        return Array.isArray(parsed) ? (parsed as T[]) : [];
    }
    catch {
        return [];
    }
}
