import type { Migration } from "../types.js";

export const tokenStatusMarkerMigration: Migration = {
  version: 120,
  name: "token_status_marker",
  up(database) {
    const hasStatusMarker = (
      database.prepare("PRAGMA table_info(tokens)").all() as Array<{ name: string }>
    ).some((column) => column.name === "status_marker");

    if (!hasStatusMarker) {
      database.exec(`
        ALTER TABLE tokens ADD COLUMN status_marker TEXT;
      `);
    }
  }
};
