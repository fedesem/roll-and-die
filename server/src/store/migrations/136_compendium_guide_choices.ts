import { addColumnIfMissing, tableExists } from "../helpers.js";
import type { Migration } from "../types.js";

export const compendiumGuideChoicesMigration: Migration = {
  version: 136,
  name: "compendium_guide_choices",
  async up(database) {
    if (await tableExists(database, "compendium_classes")) {
      await addColumnIfMissing(database, "compendium_classes", "starting_equipment_json", "TEXT NOT NULL DEFAULT '[]'");
    }
  }
};
