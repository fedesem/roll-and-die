import { addColumnIfMissing, tableExists } from "../helpers.js";
import type { Migration } from "../types.js";

export const playerNpcSheetRebuildMigration: Migration = {
  version: 132,
  name: "player_npc_sheet_rebuild",
  async up(database) {
    if (await tableExists(database, "actors")) {
      await addColumnIfMissing(database, "actors", "initiative_roll", "INTEGER");
      await addColumnIfMissing(database, "actors", "build_json", "TEXT NOT NULL DEFAULT ''");

      await database.exec(`
        DELETE FROM map_actor_assignments
        WHERE actor_id IN (SELECT id FROM actors WHERE kind IN ('character', 'npc'));

        DELETE FROM tokens
        WHERE actor_id IN (SELECT id FROM actors WHERE kind IN ('character', 'npc'))
           OR actor_kind IN ('character', 'npc');

        DELETE FROM actors
        WHERE kind IN ('character', 'npc');
      `);
    }

    if (await tableExists(database, "compendium_references")) {
      await addColumnIfMissing(database, "compendium_references", "details_json", "TEXT NOT NULL DEFAULT '{}'");
    }

    if (await tableExists(database, "compendium_classes")) {
      await addColumnIfMissing(database, "compendium_classes", "spellcasting_ability", "TEXT");
      await addColumnIfMissing(
        database,
        "compendium_classes",
        "spell_preparation",
        "TEXT NOT NULL DEFAULT 'none' CHECK (spell_preparation IN ('none', 'prepared', 'known', 'spellbook'))"
      );
      await addColumnIfMissing(database, "compendium_classes", "subclass_level", "INTEGER");
    }
  }
};
