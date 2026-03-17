import type { Migration } from "../types.js";

export const dropLegacyBlobMigration: Migration = {
  version: 102,
  name: "drop_legacy_blob",
  up(database) {
    database.exec("DROP TABLE IF EXISTS app_state;");
  }
};
