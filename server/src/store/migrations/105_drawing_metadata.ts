import type { Migration } from "../types.js";

export const drawingMetadataMigration: Migration = {
  version: 105,
  name: "drawing_metadata",
  async up(database) {
    const columns = new Set(
      (await database.prepare("PRAGMA table_info(map_drawings)").all<{ name: string }>()).map((row) => row.name)
    );

    if (!columns.has("owner_id")) {
      await database.exec("ALTER TABLE map_drawings ADD COLUMN owner_id TEXT;");
    }

    if (!columns.has("kind")) {
      await database.exec(
        "ALTER TABLE map_drawings ADD COLUMN kind TEXT NOT NULL DEFAULT 'freehand' CHECK (kind IN ('freehand', 'circle', 'square', 'star'));"
      );
    }

    if (!columns.has("fill_color")) {
      await database.exec("ALTER TABLE map_drawings ADD COLUMN fill_color TEXT NOT NULL DEFAULT '';");
    }

    if (!columns.has("rotation")) {
      await database.exec("ALTER TABLE map_drawings ADD COLUMN rotation REAL NOT NULL DEFAULT 0;");
    }
  }
};
