import { addColumnIfMissing, tableExists } from "../helpers.js";
import type { Migration } from "../types.js";

export const actorTokenImagesMigration: Migration = {
  version: 108,
  name: "actor_token_images",
  up(database) {
    addColumnIfMissing(database, "actors", "image_url", "TEXT NOT NULL DEFAULT ''");
    addColumnIfMissing(database, "tokens", "image_url", "TEXT NOT NULL DEFAULT ''");

    if (tableExists(database, "compendium_monsters")) {
      database.exec(`
        UPDATE actors
        SET image_url = COALESCE(
          (
            SELECT compendium_monsters.image_url
            FROM compendium_monsters
            WHERE compendium_monsters.id = actors.template_id
          ),
          image_url
        )
        WHERE kind = 'monster'
          AND template_id IS NOT NULL
          AND image_url = '';
      `);
    }

    database.exec(`
      UPDATE tokens
      SET image_url = COALESCE(
        (
          SELECT actors.image_url
          FROM actors
          WHERE actors.id = tokens.actor_id
        ),
        image_url
      )
      WHERE image_url = '';
    `);
  }
};
