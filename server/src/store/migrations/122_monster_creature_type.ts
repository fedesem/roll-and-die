import { addColumnIfMissing } from "../helpers.js";
import type { Migration } from "../types.js";

export const monsterCreatureTypeMigration: Migration = {
  version: 122,
  name: "monster_creature_type",
  up(database) {
    addColumnIfMissing(database, "compendium_monsters", "creature_type", "TEXT NOT NULL DEFAULT ''");
  }
};
