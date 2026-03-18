import { currentSchemaMigration } from "./100_current_schema.js";
import { importLegacyMigration } from "./101_import_legacy.js";
import { dropLegacyBlobMigration } from "./102_drop_legacy_blob.js";
import { repairActorChildForeignKeysMigration } from "./103_repair_actor_child_fks.js";
import { mapActorAssignmentsMigration } from "./104_map_actor_assignments.js";
import { drawingMetadataMigration } from "./105_drawing_metadata.js";
import { drawingOpacityMigration } from "./106_drawing_opacity.js";
import { adminCompendiumMigration } from "./107_admin_compendium.js";

export const migrations = [
  currentSchemaMigration,
  importLegacyMigration,
  dropLegacyBlobMigration,
  repairActorChildForeignKeysMigration,
  mapActorAssignmentsMigration,
  drawingMetadataMigration,
  drawingOpacityMigration,
  adminCompendiumMigration
];
