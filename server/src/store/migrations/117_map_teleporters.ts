import type { Migration } from "../types.js";

export const mapTeleportersMigration: Migration = {
  version: 117,
  name: "map_teleporters",
  up(database) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS map_teleporters (
        id TEXT PRIMARY KEY,
        map_id TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL,
        pair_number INTEGER NOT NULL,
        point_a_x REAL NOT NULL,
        point_a_y REAL NOT NULL,
        point_b_x REAL NOT NULL,
        point_b_y REAL NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_map_teleporters_map ON map_teleporters(map_id);
    `);
  }
};
