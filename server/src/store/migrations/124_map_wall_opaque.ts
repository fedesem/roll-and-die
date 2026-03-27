import type { Migration } from "../types.js";

export const mapWallOpaqueMigration: Migration = {
  version: 124,
  name: "map_wall_opaque",
  async up(database) {
    await database.exec(`
      ALTER TABLE map_walls RENAME TO map_walls_old;

      CREATE TABLE map_walls (
        id TEXT PRIMARY KEY,
        map_id TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL,
        start_x REAL NOT NULL,
        start_y REAL NOT NULL,
        end_x REAL NOT NULL,
        end_y REAL NOT NULL,
        kind TEXT NOT NULL DEFAULT 'wall' CHECK (kind IN ('wall', 'transparent', 'opaque', 'door')),
        is_open INTEGER NOT NULL DEFAULT 0
      );

      INSERT INTO map_walls (id, map_id, sort_order, start_x, start_y, end_x, end_y, kind, is_open)
      SELECT id, map_id, sort_order, start_x, start_y, end_x, end_y, kind, is_open
      FROM map_walls_old;

      DROP TABLE map_walls_old;

      CREATE INDEX IF NOT EXISTS idx_map_walls_map_sort_order
        ON map_walls(map_id, sort_order);
    `);
  }
};
