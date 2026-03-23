import type { Migration } from "../types.js";
import { addColumnIfMissing } from "../helpers.js";
export const monsterSpellcastingMigration: Migration = {
    version: 110,
    name: "monster_spellcasting",
    up(database) {
        addColumnIfMissing(database, "compendium_monsters", "spellcasting_json", "TEXT NOT NULL DEFAULT '[]'");
    }
};
