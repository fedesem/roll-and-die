import type { Migration } from "../types.js";

export const drawingOpacityMigration: Migration = {
  version: 106,
  name: "drawing_opacity",
  async up(database) {
    const columns = new Set(
      (await database.prepare("PRAGMA table_info(map_drawings)").all<{ name: string }>()).map((row) => row.name)
    );

    if (!columns.has("stroke_opacity")) {
      await database.exec("ALTER TABLE map_drawings ADD COLUMN stroke_opacity REAL NOT NULL DEFAULT 1;");
    }

    if (!columns.has("fill_opacity")) {
      await database.exec("ALTER TABLE map_drawings ADD COLUMN fill_opacity REAL NOT NULL DEFAULT 0.22;");
    }
  }
};
