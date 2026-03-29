import { tableExists } from "../helpers.js";
import type { Migration } from "../types.js";

export const drawingTextMigration: Migration = {
  version: 129,
  name: "drawing_text",
  async up(database) {
    if (!(await tableExists(database, "map_drawings"))) {
      return;
    }

    await database.exec(`
      ALTER TABLE map_drawings RENAME TO map_drawings_old;

      CREATE TABLE map_drawings (
        id TEXT PRIMARY KEY,
        map_id TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL,
        owner_id TEXT,
        kind TEXT NOT NULL DEFAULT 'freehand' CHECK (kind IN ('freehand', 'circle', 'square', 'star', 'text')),
        text_content TEXT NOT NULL DEFAULT '',
        font_family TEXT NOT NULL DEFAULT 'serif' CHECK (font_family IN ('serif', 'sans', 'mono', 'script')),
        color TEXT NOT NULL,
        stroke_opacity REAL NOT NULL DEFAULT 1,
        fill_color TEXT NOT NULL DEFAULT '',
        fill_opacity REAL NOT NULL DEFAULT 0.22,
        size REAL NOT NULL,
        rotation REAL NOT NULL DEFAULT 0
      );

      INSERT INTO map_drawings (
        id,
        map_id,
        sort_order,
        owner_id,
        kind,
        text_content,
        font_family,
        color,
        stroke_opacity,
        fill_color,
        fill_opacity,
        size,
        rotation
      )
      SELECT
        id,
        map_id,
        sort_order,
        owner_id,
        kind,
        '',
        'serif',
        color,
        stroke_opacity,
        fill_color,
        fill_opacity,
        size,
        rotation
      FROM map_drawings_old;

      DROP TABLE map_drawings_old;

      CREATE INDEX IF NOT EXISTS idx_map_drawings_map_sort_order
        ON map_drawings(map_id, sort_order);
    `);
  }
};
