import { addColumnIfMissing, tableExists } from "../helpers.js";
import type { Migration } from "../types.js";

export const actorHitPointReductionMigration: Migration = {
  version: 134,
  name: "actor_hit_point_reduction",
  async up(database) {
    if (!(await tableExists(database, "actors"))) {
      return;
    }

    await addColumnIfMissing(database, "actors", "hit_points_reduced_max", "REAL NOT NULL DEFAULT 0");
  }
};
