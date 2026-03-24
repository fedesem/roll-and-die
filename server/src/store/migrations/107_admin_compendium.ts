import { addColumnIfMissing, tableExists } from "../helpers.js";
import type { Migration } from "../types.js";
export const adminCompendiumMigration: Migration = {
    version: 107,
    name: "admin_compendium",
    async up(database) {
        await addColumnIfMissing(database, "users", "is_admin", "INTEGER NOT NULL DEFAULT 0");
        await database.exec(`
      CREATE TABLE IF NOT EXISTS compendium_spells (
        id TEXT PRIMARY KEY,
        sort_order INTEGER NOT NULL,
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        level TEXT NOT NULL,
        school TEXT NOT NULL,
        casting_time_unit TEXT NOT NULL,
        casting_time_value INTEGER NOT NULL,
        range_type TEXT NOT NULL,
        range_value INTEGER NOT NULL,
        description TEXT NOT NULL,
        components_verbal INTEGER NOT NULL,
        components_somatic INTEGER NOT NULL,
        components_material INTEGER NOT NULL,
        components_material_text TEXT NOT NULL,
        components_material_value REAL NOT NULL,
        components_material_consumed INTEGER NOT NULL,
        duration_unit TEXT NOT NULL,
        duration_value INTEGER NOT NULL,
        concentration INTEGER NOT NULL,
        damage_notation TEXT NOT NULL,
        damage_ability TEXT,
        full_description TEXT NOT NULL,
        classes_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS compendium_monsters (
        id TEXT PRIMARY KEY,
        sort_order INTEGER NOT NULL,
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        challenge_rating TEXT NOT NULL,
        armor_class INTEGER NOT NULL,
        hit_points INTEGER NOT NULL,
        initiative INTEGER NOT NULL DEFAULT 0,
        speed_walk INTEGER NOT NULL,
        speed_fly INTEGER NOT NULL DEFAULT 0,
        speed_burrow INTEGER NOT NULL DEFAULT 0,
        speed_swim INTEGER NOT NULL DEFAULT 0,
        speed_climb INTEGER NOT NULL DEFAULT 0,
        ability_str INTEGER NOT NULL,
        ability_dex INTEGER NOT NULL,
        ability_con INTEGER NOT NULL,
        ability_int INTEGER NOT NULL,
        ability_wis INTEGER NOT NULL,
        ability_cha INTEGER NOT NULL,
        skills_json TEXT NOT NULL,
        senses_json TEXT NOT NULL,
        passive_perception INTEGER NOT NULL,
        languages_json TEXT NOT NULL,
        xp INTEGER NOT NULL,
        proficiency_bonus INTEGER NOT NULL,
        gear_json TEXT NOT NULL,
        resistances_json TEXT NOT NULL,
        vulnerabilities_json TEXT NOT NULL,
        immunities_json TEXT NOT NULL,
        traits_json TEXT NOT NULL,
        actions_json TEXT NOT NULL,
        bonus_actions_json TEXT NOT NULL,
        reactions_json TEXT NOT NULL,
        legendary_actions_json TEXT NOT NULL,
        legendary_actions_use INTEGER NOT NULL,
        lair_actions_json TEXT NOT NULL,
        regional_effects_json TEXT NOT NULL,
        spells_json TEXT NOT NULL,
        spellcasting_json TEXT NOT NULL DEFAULT '[]',
        habitat TEXT NOT NULL,
        treasure TEXT NOT NULL,
        image_url TEXT NOT NULL,
        color TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS compendium_feats (
        id TEXT PRIMARY KEY,
        sort_order INTEGER NOT NULL,
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        category TEXT NOT NULL,
        ability_score_increase TEXT NOT NULL,
        prerequisites TEXT NOT NULL,
        description TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS compendium_classes (
        id TEXT PRIMARY KEY,
        sort_order INTEGER NOT NULL,
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        description TEXT NOT NULL,
        features_json TEXT NOT NULL,
        tables_json TEXT NOT NULL
      );
    `);
        if (await tableExists(database, "users")) {
            const adminCount = await database.prepare("SELECT COUNT(*) as count FROM users WHERE is_admin = 1").get<{ count: number }>();
            if ((adminCount?.count ?? 0) === 0) {
                await database.prepare("UPDATE users SET is_admin = 1 WHERE id = (SELECT id FROM users ORDER BY rowid LIMIT 1)").run();
            }
        }
    }
};
