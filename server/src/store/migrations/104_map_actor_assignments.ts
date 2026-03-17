import type { Migration } from "../types.js";

export const mapActorAssignmentsMigration: Migration = {
  version: 104,
  name: "map_actor_assignments",
  up(database) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS map_actor_assignments (
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        map_id TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
        actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
        PRIMARY KEY (campaign_id, map_id, actor_id)
      );

      INSERT OR IGNORE INTO map_actor_assignments (campaign_id, map_id, actor_id)
      SELECT DISTINCT campaign_id, map_id, actor_id
      FROM tokens;
    `);
  }
};
