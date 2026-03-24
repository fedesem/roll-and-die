import { addColumnIfMissing, tableExists } from "../helpers.js";
import type { Migration } from "../types.js";
const defaultLayoutJson = JSON.stringify([
    { sectionId: "info", column: 1, order: 0 },
    { sectionId: "abilities", column: 1, order: 1 },
    { sectionId: "skills", column: 1, order: 2 },
    { sectionId: "combat", column: 2, order: 3 },
    { sectionId: "attacks", column: 2, order: 4 },
    { sectionId: "armor", column: 2, order: 5 },
    { sectionId: "resources", column: 2, order: 6 },
    { sectionId: "spellSlots", column: 3, order: 7 },
    { sectionId: "spells", column: 3, order: 8 },
    { sectionId: "feats", column: 3, order: 9 },
    { sectionId: "traits", column: 3, order: 10 },
    { sectionId: "items", column: 2, order: 11 },
    { sectionId: "notes", column: 3, order: 12 }
]);
export const actorSheet2024Migration: Migration = {
    version: 113,
    name: "actor_sheet_2024",
    up(database) {
        if (!tableExists(database, "actors")) {
            return;
        }
        addColumnIfMissing(database, "actors", "prepared_spells_json", "TEXT NOT NULL DEFAULT '[]'");
        addColumnIfMissing(database, "actors", "layout_json", "TEXT NOT NULL DEFAULT '[]'");
        addColumnIfMissing(database, "actor_armor_items", "kind", "TEXT NOT NULL DEFAULT 'armor' CHECK (kind IN ('armor', 'shield'))");
        addColumnIfMissing(database, "actor_armor_items", "max_dex_bonus", "INTEGER");
        addColumnIfMissing(database, "actor_armor_items", "bonus", "INTEGER NOT NULL DEFAULT 0");
        addColumnIfMissing(database, "actor_armor_items", "equipped", "INTEGER NOT NULL DEFAULT 0");
        addColumnIfMissing(database, "actor_resources", "restore_amount", "INTEGER NOT NULL DEFAULT 0");
        addColumnIfMissing(database, "actor_inventory", "item_type", "TEXT NOT NULL DEFAULT 'gear' CHECK (item_type IN ('gear', 'reagent', 'loot', 'consumable'))");
        addColumnIfMissing(database, "actor_inventory", "equipped", "INTEGER NOT NULL DEFAULT 0");
        addColumnIfMissing(database, "actor_inventory", "notes", "TEXT NOT NULL DEFAULT ''");
        database.exec(`
      CREATE TABLE IF NOT EXISTS actor_classes (
        actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        compendium_id TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT '',
        level INTEGER NOT NULL,
        hit_die_faces INTEGER NOT NULL,
        used_hit_dice INTEGER NOT NULL DEFAULT 0,
        spellcasting_ability TEXT,
        PRIMARY KEY (actor_id, id)
      );

      CREATE TABLE IF NOT EXISTS actor_bonuses (
        actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        name TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK (source_type IN ('gear', 'buff')),
        target_type TEXT NOT NULL CHECK (target_type IN ('armorClass', 'speed', 'ability', 'skill', 'savingThrow')),
        target_key TEXT NOT NULL DEFAULT '',
        value INTEGER NOT NULL DEFAULT 0,
        enabled INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (actor_id, id)
      );
    `);
        database.exec(`
      UPDATE actors
      SET prepared_spells_json = COALESCE((
        SELECT json_group_array(value)
        FROM actor_text_entries
        WHERE actor_text_entries.actor_id = actors.id
          AND actor_text_entries.kind = 'spells'
      ), '[]')
      WHERE prepared_spells_json = '[]';

      UPDATE actors
      SET layout_json = '${defaultLayoutJson.replace(/'/g, "''")}'
      WHERE layout_json = '[]' OR layout_json = '';

      UPDATE actor_resources
      SET restore_amount = CASE
        WHEN max_value > 0 THEN max_value
        ELSE 1
      END
      WHERE restore_amount = 0;

      UPDATE actor_armor_items
      SET equipped = 1
      WHERE equipped = 0;
    `);
        database.exec(`
      INSERT OR IGNORE INTO actor_classes (
        actor_id, id, sort_order, compendium_id, name, source, level, hit_die_faces, used_hit_dice, spellcasting_ability
      )
      SELECT
        id as actor_id,
        id || ':class:0' as id,
        0 as sort_order,
        '' as compendium_id,
        CASE
          WHEN class_name != '' THEN class_name
          WHEN kind = 'npc' THEN 'Supporting Role'
          ELSE 'Adventurer'
        END as name,
        '' as source,
        CASE WHEN level < 1 THEN 1 ELSE level END as level,
        CASE
          WHEN hit_dice LIKE '%d12%' THEN 12
          WHEN hit_dice LIKE '%d10%' THEN 10
          WHEN hit_dice LIKE '%d6%' THEN 6
          WHEN hit_dice LIKE '%d4%' THEN 4
          ELSE 8
        END as hit_die_faces,
        0 as used_hit_dice,
        spellcasting_ability
      FROM actors
      WHERE kind IN ('character', 'npc');
    `);
    }
};
