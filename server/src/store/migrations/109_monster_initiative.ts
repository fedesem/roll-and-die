import type { Migration } from "../types.js";
import { addColumnIfMissing } from "../helpers.js";
export const monsterInitiativeMigration: Migration = {
    version: 109,
    name: "monster_initiative",
    up(database) {
        addColumnIfMissing(database, "compendium_monsters", "initiative", "INTEGER NOT NULL DEFAULT 0");
        database.exec(`
      UPDATE compendium_monsters
      SET initiative = CAST(FLOOR((ability_dex - 10) / 2.0) AS INTEGER)
      WHERE initiative = 0;
    `);
    }
};
