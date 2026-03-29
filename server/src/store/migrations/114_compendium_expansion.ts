import { addColumnIfMissing } from "../helpers.js";
import type { Migration } from "../types.js";
export const compendiumExpansionMigration: Migration = {
  version: 114,
  name: "compendium_expansion",
  async up(database) {
    if (await database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'compendium_classes' LIMIT 1").get()) {
      await addColumnIfMissing(database, "compendium_classes", "subclasses_json", "TEXT NOT NULL DEFAULT '[]'");
    }
    await database.exec(`
      CREATE TABLE IF NOT EXISTS compendium_references (
        kind TEXT NOT NULL,
        id TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        PRIMARY KEY (kind, id)
      );
    `);
  }
};
