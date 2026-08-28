import type { Migration } from "../types.js";

export const actorDynamicBonusesMigration: Migration = {
  version: 138,
  name: "actor_dynamic_bonuses",
  async up(database) {
    database.exec(`
      ALTER TABLE actor_bonuses RENAME TO actor_bonuses_legacy_138;

      CREATE TABLE actor_bonuses (
        actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        name TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK (source_type IN ('gear', 'buff')),
        target_type TEXT NOT NULL CHECK (target_type IN ('armorClass', 'speed', 'initiative', 'ability', 'skill', 'savingThrow')),
        target_key TEXT NOT NULL DEFAULT '',
        value INTEGER NOT NULL DEFAULT 0,
        stat_bonus TEXT CHECK (stat_bonus IS NULL OR stat_bonus IN ('str', 'dex', 'con', 'int', 'wis', 'cha')),
        minimum INTEGER,
        enabled INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (actor_id, id)
      );

      INSERT INTO actor_bonuses (
        actor_id, id, sort_order, name, source_type, target_type, target_key, value, stat_bonus, minimum, enabled
      )
      SELECT actor_id, id, sort_order, name, source_type, target_type, target_key, value, NULL, NULL, enabled
      FROM actor_bonuses_legacy_138;

      DROP TABLE actor_bonuses_legacy_138;
    `);
  }
};
