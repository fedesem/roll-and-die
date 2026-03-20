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
import { spellClassReferenceMetadataMigration } from "./112_spell_class_reference_metadata.js";
import { actorSheet2024Migration } from "./113_actor_sheet_2024.js";
import { compendiumExpansionMigration } from "./114_compendium_expansion.js";
import { campaignSourceBooksMigration } from "./115_campaign_source_books.js";

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
  compendiumReferenceTablesMigration,
  spellClassReferenceMetadataMigration,
  actorSheet2024Migration,
  compendiumExpansionMigration,
  campaignSourceBooksMigration
];
