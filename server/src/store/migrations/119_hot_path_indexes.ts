import type { Migration } from "../types.js";

export const hotPathIndexesMigration: Migration = {
  version: 119,
  name: "hot_path_indexes",
  up(database) {
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_tokens_campaign_map_sort_order
        ON tokens(campaign_id, map_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_map_walls_map_sort_order
        ON map_walls(map_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_map_drawings_map_sort_order
        ON map_drawings(map_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_campaign_sort_order
        ON chat_messages(campaign_id, sort_order);
    `);
  }
};
