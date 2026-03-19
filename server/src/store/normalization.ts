import type { Campaign } from "../../../shared/types.js";
import { defaultDatabase, type Database } from "./types.js";

export function normalizeStoreState(database: Database): Database {
  return {
    users: Array.isArray(database.users)
      ? database.users.map((user) => ({
          ...user,
          isAdmin: Boolean(user.isAdmin)
        }))
      : [],
    sessions: Array.isArray(database.sessions) ? database.sessions : [],
    campaigns: Array.isArray(database.campaigns) ? database.campaigns.map(normalizeCampaign) : [],
    compendium:
      typeof database.compendium === "object" && database.compendium !== null
        ? {
            spells: Array.isArray(database.compendium.spells) ? database.compendium.spells : [],
            monsters: Array.isArray(database.compendium.monsters) ? database.compendium.monsters : [],
            feats: Array.isArray(database.compendium.feats) ? database.compendium.feats : [],
            classes: Array.isArray(database.compendium.classes) ? database.compendium.classes : []
          }
        : defaultDatabase.compendium
      };
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
          imageUrl: actor.imageUrl ?? "",
          visionRange: actor.visionRange ?? 6,
          classes: Array.isArray(actor.classes) ? actor.classes : [],
          preparedSpells: Array.isArray(actor.preparedSpells) ? actor.preparedSpells : [],
          bonuses: Array.isArray(actor.bonuses) ? actor.bonuses : [],
          layout: Array.isArray(actor.layout) ? actor.layout : [],
          armorItems: Array.isArray(actor.armorItems)
            ? actor.armorItems.map((item) => ({
                ...item,
                kind: item.kind ?? "armor",
                maxDexBonus: item.maxDexBonus ?? null,
                bonus: item.bonus ?? 0,
                equipped: Boolean(item.equipped)
              }))
            : [],
          resources: Array.isArray(actor.resources)
            ? actor.resources.map((resource) => ({
                ...resource,
                restoreAmount: resource.restoreAmount ?? resource.max ?? 1
              }))
            : [],
          inventory: Array.isArray(actor.inventory)
            ? actor.inventory.map((item) => ({
                ...item,
                type: item.type ?? "gear",
                equipped: Boolean(item.equipped),
                notes: item.notes ?? ""
              }))
            : []
        }))
      : [],
    maps,
    mapAssignments: Array.from(
      new Map(
        normalizedAssignments.map((assignment) => [`${assignment.mapId}:${assignment.actorId}`, assignment])
      ).values()
    ),
    tokens: Array.isArray(campaign.tokens)
      ? campaign.tokens.map((token) => ({
          ...token,
          imageUrl:
            typeof token.imageUrl === "string"
              ? token.imageUrl
              : campaign.actors.find((actor) => actor.id === token.actorId)?.imageUrl ?? ""
        }))
      : [],
    chat: Array.isArray(campaign.chat) ? campaign.chat : [],
    invites: Array.isArray(campaign.invites) ? campaign.invites : [],
    members: Array.isArray(campaign.members) ? campaign.members : []
  };
}
