import type { Migration } from "../types.js";

export const monsterSpellcastingMigration: Migration = {
  version: 110,
  name: "monster_spellcasting",
  up(database) {
    database.exec(`
      ALTER TABLE compendium_monsters
      ADD COLUMN spellcasting_json TEXT NOT NULL DEFAULT '[]';
    `);
  }
};
