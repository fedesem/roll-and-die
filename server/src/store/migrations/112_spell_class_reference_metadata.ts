import { addColumnIfMissing, tableExists } from "../helpers.js";
import type { Migration } from "../types.js";

export const spellClassReferenceMetadataMigration: Migration = {
  version: 112,
  name: "spell_class_reference_metadata",
  up(database) {
    if (!tableExists(database, "compendium_spell_classes")) {
      return;
    }

    addColumnIfMissing(
      database,
      "compendium_spell_classes",
      "defined_in_sources_json",
      "TEXT NOT NULL DEFAULT '[]'"
    );
  }
};
