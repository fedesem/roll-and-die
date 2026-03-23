import type { Migration } from "../types.js";

export const tokenStatusMarkerMigration: Migration = {
  version: 120,
  name: "token_status_marker",
  async up(database) {
    const hasStatusMarker = (
      await database.prepare("PRAGMA table_info(tokens)").all<{ name: string }>()
    ).some((column) => column.name === "status_marker");

    if (!hasStatusMarker) {
      await database.exec(`
        ALTER TABLE tokens ADD COLUMN status_marker TEXT;
      `);
    }
  }
};
