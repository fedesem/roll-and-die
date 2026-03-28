import { addColumnIfMissing, tableExists } from "../helpers.js";
import type { Migration } from "../types.js";

export const mapDoorLockMigration: Migration = {
  version: 128,
  name: "map_door_lock",
  async up(database) {
    if (!(await tableExists(database, "map_walls"))) {
      return;
    }

    await addColumnIfMissing(database, "map_walls", "is_locked", "INTEGER NOT NULL DEFAULT 0");
  }
};
