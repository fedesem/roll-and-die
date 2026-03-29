import { addColumnIfMissing, tableExists } from "../helpers.js";
import type { Migration } from "../types.js";

export const drawingTextStyleMigration: Migration = {
  version: 131,
  name: "drawing_text_style",
  async up(database) {
    if (!(await tableExists(database, "map_drawings"))) {
      return;
    }

    await addColumnIfMissing(database, "map_drawings", "is_bold", "INTEGER NOT NULL DEFAULT 0");
    await addColumnIfMissing(database, "map_drawings", "is_italic", "INTEGER NOT NULL DEFAULT 0");
  }
};
