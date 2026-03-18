import { currentSchemaMigration } from "./100_current_schema.js";
import { repairActorChildForeignKeysMigration } from "./103_repair_actor_child_fks.js";
import { mapActorAssignmentsMigration } from "./104_map_actor_assignments.js";
import { drawingMetadataMigration } from "./105_drawing_metadata.js";
import { drawingOpacityMigration } from "./106_drawing_opacity.js";
import { adminCompendiumMigration } from "./107_admin_compendium.js";
import { actorTokenImagesMigration } from "./108_actor_token_images.js";
import { monsterInitiativeMigration } from "./109_monster_initiative.js";
import { monsterSpellcastingMigration } from "./110_monster_spellcasting.js";
import { compendiumReferenceTablesMigration } from "./111_compendium_reference_tables.js";

export const migrations = [
  currentSchemaMigration,
  repairActorChildForeignKeysMigration,
  mapActorAssignmentsMigration,
  drawingMetadataMigration,
  drawingOpacityMigration,
  adminCompendiumMigration,
  actorTokenImagesMigration,
  monsterInitiativeMigration,
  monsterSpellcastingMigration,
  compendiumReferenceTablesMigration
];
