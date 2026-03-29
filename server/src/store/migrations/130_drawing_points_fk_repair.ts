import { tableExists } from "../helpers.js";
import type { Migration } from "../types.js";

export const drawingPointsForeignKeyRepairMigration: Migration = {
  version: 130,
  name: "drawing_points_fk_repair",
  async up(database) {
    if (!(await tableExists(database, "map_drawings")) || !(await tableExists(database, "map_drawing_points"))) {
      return;
    }

    await database.exec(`
      ALTER TABLE map_drawing_points RENAME TO map_drawing_points_old;

      CREATE TABLE map_drawing_points (
        stroke_id TEXT NOT NULL REFERENCES map_drawings(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        PRIMARY KEY (stroke_id, sort_order)
      );

      INSERT INTO map_drawing_points (stroke_id, sort_order, x, y)
      SELECT stroke_id, sort_order, x, y
      FROM map_drawing_points_old;

      DROP TABLE map_drawing_points_old;
    `);
  }
};
