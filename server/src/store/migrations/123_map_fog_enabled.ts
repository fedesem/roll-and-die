import { addColumnIfMissing } from "../helpers.js";
import type { Migration } from "../types.js";

export const mapFogEnabledMigration: Migration = {
  version: 123,
  name: "map_fog_enabled",
  async up(database) {
    await addColumnIfMissing(database, "maps", "fog_enabled", "INTEGER NOT NULL DEFAULT 1");
  }
};
