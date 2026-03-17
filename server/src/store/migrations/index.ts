import { currentSchemaMigration } from "./100_current_schema.js";
import { importLegacyMigration } from "./101_import_legacy.js";
import { dropLegacyBlobMigration } from "./102_drop_legacy_blob.js";
import { repairActorChildForeignKeysMigration } from "./103_repair_actor_child_fks.js";

export const migrations = [
  currentSchemaMigration,
  importLegacyMigration,
  dropLegacyBlobMigration,
  repairActorChildForeignKeysMigration
];
