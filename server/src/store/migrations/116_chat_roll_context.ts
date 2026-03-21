import type { Migration } from "../types.js";

export const chatRollContextMigration: Migration = {
  version: 116,
  name: "chat_roll_context",
  up(database) {
    database.exec(`
      ALTER TABLE chat_messages ADD COLUMN actor_id TEXT;
      ALTER TABLE chat_messages ADD COLUMN actor_name TEXT;
      ALTER TABLE chat_messages ADD COLUMN actor_image_url TEXT;
      ALTER TABLE chat_messages ADD COLUMN actor_color TEXT;
      ALTER TABLE chat_rolls ADD COLUMN breakdown TEXT;
    `);
  }
};
