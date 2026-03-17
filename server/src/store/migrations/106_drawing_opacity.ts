import type { Migration } from "../types.js";

export const drawingOpacityMigration: Migration = {
  version: 106,
  name: "drawing_opacity",
  up(database) {
    const columns = new Set(
      (database.prepare("PRAGMA table_info(map_drawings)").all() as Array<{ name: string }>).map((row) => row.name)
    );

    if (!columns.has("stroke_opacity")) {
      database.exec("ALTER TABLE map_drawings ADD COLUMN stroke_opacity REAL NOT NULL DEFAULT 1;");
    }

    if (!columns.has("fill_opacity")) {
      database.exec("ALTER TABLE map_drawings ADD COLUMN fill_opacity REAL NOT NULL DEFAULT 0.22;");
    }
  }
};
