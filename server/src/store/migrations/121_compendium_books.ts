import type { Migration } from "../types.js";

export const compendiumBooksMigration: Migration = {
  version: 121,
  name: "compendium_books",
  up(database) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS compendium_books (
        source TEXT PRIMARY KEY,
        sort_order INTEGER NOT NULL,
        name TEXT NOT NULL,
        group_name TEXT NOT NULL,
        published TEXT NOT NULL,
        author TEXT NOT NULL
      );
    `);
  }
};
