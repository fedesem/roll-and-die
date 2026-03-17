import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { DatabaseSync } from "node:sqlite";

import type { Campaign } from "../../../shared/types.js";
import { defaultDatabase, legacyJsonPath, type Database } from "./types.js";
import { readCount, tableExists } from "./helpers.js";

export function normalizeDatabase(database: Database): Database {
  return {
    users: Array.isArray(database.users) ? database.users : [],
    sessions: Array.isArray(database.sessions) ? database.sessions : [],
    campaigns: Array.isArray(database.campaigns) ? database.campaigns.map(normalizeCampaign) : []
  };
}

export function hasRelationalData(database: DatabaseSync) {
  return (
    readCount(database, "users") > 0 || readCount(database, "sessions") > 0 || readCount(database, "campaigns") > 0
  );
}

export async function loadLegacyDatabase(database: DatabaseSync) {
  const fromBlob = loadLegacyBlob(database);

  if (fromBlob) {
    return fromBlob;
  }

  if (!existsSync(legacyJsonPath)) {
    return defaultDatabase;
  }

  try {
    const raw = await readFile(legacyJsonPath, "utf8");
    return normalizeDatabase(JSON.parse(raw) as Database);
  } catch {
    return defaultDatabase;
  }
}

function loadLegacyBlob(database: DatabaseSync) {
  if (!tableExists(database, "app_state")) {
    return null;
  }

  const row = database.prepare("SELECT data FROM app_state WHERE id = 1").get() as { data: string } | undefined;

  if (!row?.data) {
    return null;
  }

  try {
    return normalizeDatabase(JSON.parse(row.data) as Database);
  } catch {
    return null;
  }
}

function normalizeCampaign(campaign: Campaign): Campaign {
  const maps = Array.isArray(campaign.maps)
    ? campaign.maps.map((map) => ({
        ...map,
        backgroundOffsetX: map.backgroundOffsetX ?? 0,
        backgroundOffsetY: map.backgroundOffsetY ?? 0,
        backgroundScale: map.backgroundScale ?? 1,
        drawings: Array.isArray(map.drawings)
          ? map.drawings.map((drawing) => ({
              ...drawing,
              kind: drawing.kind ?? "freehand",
              strokeOpacity: typeof drawing.strokeOpacity === "number" ? drawing.strokeOpacity : 1,
              fillColor: drawing.fillColor ?? "",
              fillOpacity: typeof drawing.fillOpacity === "number" ? drawing.fillOpacity : 0.22,
              rotation: typeof drawing.rotation === "number" ? drawing.rotation : 0
            }))
          : [],
        fog: [],
        visibilityVersion: map.visibilityVersion ?? 1,
        walls: Array.isArray(map.walls)
          ? map.walls.map((wall) => ({
              ...wall,
              kind: wall.kind ?? "wall",
              isOpen: wall.kind === "door" ? Boolean(wall.isOpen) : false
            }))
          : []
      }))
    : [];
  const activeMapId = campaign.activeMapId || maps[0]?.id || "";
  const derivedAssignments = Array.isArray(campaign.tokens)
    ? Array.from(
        new Map(
          campaign.tokens.map((token) => [`${token.mapId}:${token.actorId}`, { mapId: token.mapId, actorId: token.actorId }])
        ).values()
      )
    : [];
  const normalizedAssignments = Array.isArray((campaign as Partial<Campaign>).mapAssignments)
    ? ((campaign as Partial<Campaign>).mapAssignments ?? [])
        .filter(
          (assignment): assignment is Campaign["mapAssignments"][number] =>
            Boolean(assignment) &&
            typeof assignment?.actorId === "string" &&
            typeof assignment?.mapId === "string"
        )
    : derivedAssignments;

  return {
    ...campaign,
    activeMapId,
    exploration: campaign.exploration ?? {},
    actors: Array.isArray(campaign.actors)
      ? campaign.actors.map((actor) => ({
          ...actor,
          visionRange: actor.visionRange ?? 6
        }))
      : [],
    maps,
    mapAssignments: Array.from(
      new Map(
        normalizedAssignments.map((assignment) => [`${assignment.mapId}:${assignment.actorId}`, assignment])
      ).values()
    ),
    tokens: Array.isArray(campaign.tokens) ? campaign.tokens : [],
    chat: Array.isArray(campaign.chat) ? campaign.chat : [],
    invites: Array.isArray(campaign.invites) ? campaign.invites : [],
    members: Array.isArray(campaign.members) ? campaign.members : []
  };
}
