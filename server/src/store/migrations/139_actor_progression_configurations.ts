import { addColumnIfMissing, tableExists } from "../helpers.js";
import type { Migration } from "../types.js";

export const actorProgressionConfigurationsMigration: Migration = {
  version: 139,
  name: "actor_progression_configurations",
  async up(database) {
    if (!(await tableExists(database, "actor_attacks"))) return;
    await addColumnIfMissing(database, "actor_attacks", "metadata_json", "TEXT NOT NULL DEFAULT '{}'");
  }
};
