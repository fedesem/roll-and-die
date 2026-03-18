import type { Migration } from "../types.js";

export const monsterInitiativeMigration: Migration = {
  version: 109,
  name: "monster_initiative",
  up(database) {
    database.exec(`
      ALTER TABLE compendium_monsters
      ADD COLUMN initiative INTEGER NOT NULL DEFAULT 0;
    `);

    database.exec(`
      UPDATE compendium_monsters
      SET initiative = CAST(FLOOR((ability_dex - 10) / 2.0) AS INTEGER)
      WHERE initiative = 0;
    `);
  }
};
