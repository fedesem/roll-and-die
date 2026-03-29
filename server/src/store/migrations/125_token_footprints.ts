import type { ActorKind } from "../../../../shared/types.js";
import { clampCreatureTokenSize, clampStaticTokenDimension, normalizeTokenRotation } from "../../../../shared/tokenGeometry.js";
import { addColumnIfMissing, readAll } from "../helpers.js";
import type { Migration } from "../types.js";

export const tokenFootprintsMigration: Migration = {
  version: 125,
  name: "token_footprints",
  async up(database) {
    await addColumnIfMissing(database, "actors", "token_width_squares", "INTEGER NOT NULL DEFAULT 1");
    await addColumnIfMissing(database, "actors", "token_length_squares", "INTEGER NOT NULL DEFAULT 1");
    await addColumnIfMissing(database, "tokens", "width_squares", "REAL NOT NULL DEFAULT 1");
    await addColumnIfMissing(database, "tokens", "height_squares", "REAL NOT NULL DEFAULT 1");
    await addColumnIfMissing(
      database,
      "tokens",
      "rotation_degrees",
      "INTEGER NOT NULL DEFAULT 0 CHECK (rotation_degrees IN (0, 90, 180, 270))"
    );

    const actorDimensionsById = new Map<string, { widthSquares: number; lengthSquares: number }>();
    const updateActor = database.prepare(`
      UPDATE actors
      SET token_width_squares = ?, token_length_squares = ?
      WHERE id = ?
    `);

    for (const actor of await readAll<{ id: string; kind: ActorKind; className: string }>(
      database,
      `
        SELECT id, kind, class_name as className
        FROM actors
      `
    )) {
      const parsed = parseStaticDimensions(actor.className);
      const widthSquares = actor.kind === "static" ? clampStaticTokenDimension(parsed?.widthSquares ?? 2) : 1;
      const lengthSquares = actor.kind === "static" ? clampStaticTokenDimension(parsed?.lengthSquares ?? 4) : 1;

      actorDimensionsById.set(actor.id, { widthSquares, lengthSquares });
      await updateActor.run(widthSquares, lengthSquares, actor.id);
    }

    const updateToken = database.prepare(`
      UPDATE tokens
      SET size = ?, width_squares = ?, height_squares = ?, rotation_degrees = ?
      WHERE id = ?
    `);

    for (const token of await readAll<{
      id: string;
      actorId: string;
      actorKind: ActorKind;
      size: number;
      rotationDegrees: number | null;
    }>(
      database,
      `
        SELECT
          id,
          actor_id as actorId,
          actor_kind as actorKind,
          size,
          rotation_degrees as rotationDegrees
        FROM tokens
      `
    )) {
      if (token.actorKind === "static") {
        const dimensions = actorDimensionsById.get(token.actorId) ?? {
          widthSquares: 2,
          lengthSquares: 4
        };
        const rotationDegrees = normalizeTokenRotation(token.rotationDegrees ?? 0);
        const rotated = rotationDegrees === 90 || rotationDegrees === 270;
        const widthSquares = rotated ? dimensions.lengthSquares : dimensions.widthSquares;
        const heightSquares = rotated ? dimensions.widthSquares : dimensions.lengthSquares;

        await updateToken.run(Math.max(widthSquares, heightSquares), widthSquares, heightSquares, rotationDegrees, token.id);
        continue;
      }

      const size = clampCreatureTokenSize(token.size ?? 1);
      await updateToken.run(size, size, size, 0, token.id);
    }
  }
};

function parseStaticDimensions(value: string) {
  const match = value.match(/(\d+)\s*[xX]\s*(\d+)/);

  if (!match) {
    return null;
  }

  return {
    widthSquares: Number(match[1]),
    lengthSquares: Number(match[2])
  };
}
