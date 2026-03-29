import type { ActorKind, ActorSheet } from "../../../../shared/types.js";
import { deriveCreatureSizeFromTokenSize } from "../../../../shared/tokenGeometry.js";
import { addColumnIfMissing, readAll } from "../helpers.js";
import type { Migration } from "../types.js";

const creatureSizeColumnDefinition =
  "TEXT NOT NULL DEFAULT 'medium' CHECK (creature_size IN ('tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'))";

export const actorCreatureSizeMigration: Migration = {
  version: 126,
  name: "actor_creature_size",
  async up(database) {
    await addColumnIfMissing(database, "actors", "creature_size", creatureSizeColumnDefinition);

    const tokenSizeByActorId = new Map<string, number>();

    for (const row of await readAll<{ actorId: string; size: number | null }>(
      database,
      `
        SELECT actor_id as actorId, MAX(size) as size
        FROM tokens
        GROUP BY actor_id
      `
    )) {
      if (typeof row.size === "number" && Number.isFinite(row.size)) {
        tokenSizeByActorId.set(row.actorId, row.size);
      }
    }

    const updateActor = database.prepare(`
      UPDATE actors
      SET creature_size = ?
      WHERE id = ?
    `);

    for (const actor of await readAll<{ id: string; kind: ActorKind }>(
      database,
      `
        SELECT id, kind
        FROM actors
      `
    )) {
      const creatureSize: ActorSheet["creatureSize"] =
        actor.kind === "static" ? "medium" : deriveCreatureSizeFromTokenSize(tokenSizeByActorId.get(actor.id) ?? 1);

      await updateActor.run(creatureSize, actor.id);
    }
  }
};
