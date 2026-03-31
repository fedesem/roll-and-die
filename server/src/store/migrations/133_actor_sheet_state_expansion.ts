import { addColumnIfMissing, tableExists } from "../helpers.js";
import type { Migration } from "../types.js";

export const actorSheetStateExpansionMigration: Migration = {
  version: 133,
  name: "actor_sheet_state_expansion",
  async up(database) {
    if (!(await tableExists(database, "actors"))) {
      return;
    }

    await addColumnIfMissing(database, "actors", "proficiencies_json", "TEXT NOT NULL DEFAULT '{}'");
    await addColumnIfMissing(database, "actors", "spell_state_json", "TEXT NOT NULL DEFAULT '{}'");
    await addColumnIfMissing(database, "actors", "status_json", "TEXT NOT NULL DEFAULT '{}'");
  }
};
