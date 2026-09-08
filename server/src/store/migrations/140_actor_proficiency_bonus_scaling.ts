import { addColumnIfMissing, tableExists } from "../helpers.js";
import type { Migration } from "../types.js";

export const actorProficiencyBonusScalingMigration: Migration = {
  version: 140,
  name: "actor_proficiency_bonus_scaling",
  async up(database) {
    if (!(await tableExists(database, "actor_bonuses"))) return;
    await addColumnIfMissing(database, "actor_bonuses", "proficiency_bonus_multiplier", "REAL");
  }
};
