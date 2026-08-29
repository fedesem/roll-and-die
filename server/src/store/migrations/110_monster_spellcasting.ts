import { addColumnIfMissing } from "../helpers.js";
import type { Migration } from "../types.js";
export const monsterSpellcastingMigration: Migration = {
  version: 110,
  name: "monster_spellcasting",
  up(database) {
    addColumnIfMissing(database, "compendium_monsters", "spellcasting_json", "TEXT NOT NULL DEFAULT '[]'");
  }
};
