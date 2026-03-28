import { addColumnIfMissing, tableExists } from "../helpers.js";
import type { Migration } from "../types.js";

export const compendiumReferenceEntriesMigration: Migration = {
  version: 127,
  name: "compendium_reference_entries",
  async up(database) {
    if (!(await tableExists(database, "compendium_references"))) {
      return;
    }

    await addColumnIfMissing(database, "compendium_references", "entries_text", "TEXT NOT NULL DEFAULT ''");
    await database.exec(`
      UPDATE compendium_references
      SET entries_text = description
      WHERE COALESCE(entries_text, '') = ''
    `);
  }
};
