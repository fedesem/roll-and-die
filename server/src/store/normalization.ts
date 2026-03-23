import { TOKEN_STATUS_MARKERS, type Campaign, type CampaignMap, type MapTeleporter } from "../../../shared/types.js";
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
            classes: Array.isArray(database.compendium.classes) ? database.compendium.classes : [],
            books: Array.isArray(database.compendium.books) ? database.compendium.books : [],
            optionalFeatures: Array.isArray(database.compendium.optionalFeatures) ? database.compendium.optionalFeatures : [],
            actions: Array.isArray(database.compendium.actions) ? database.compendium.actions : [],
            backgrounds: Array.isArray(database.compendium.backgrounds) ? database.compendium.backgrounds : [],
            items: Array.isArray(database.compendium.items) ? database.compendium.items : [],
            languages: Array.isArray(database.compendium.languages) ? database.compendium.languages : [],
            races: Array.isArray(database.compendium.races) ? database.compendium.races : [],
            skills: Array.isArray(database.compendium.skills) ? database.compendium.skills : []
          }
        : defaultDatabase.compendium
  };
}

function normalizeCampaign(campaign: Campaign): Campaign {
  const tokenStatusMarkerSet = new Set<string>(TOKEN_STATUS_MARKERS);
  const normalizeStatusMarkers = (value: unknown) => {
    if (Array.isArray(value)) {
      return Array.from(
        new Set(
          value.filter(
            (entry): entry is (typeof TOKEN_STATUS_MARKERS)[number] =>
              typeof entry === "string" && tokenStatusMarkerSet.has(entry)
          )
        )
      );
    }

    return typeof value === "string" && tokenStatusMarkerSet.has(value) ? [value as (typeof TOKEN_STATUS_MARKERS)[number]] : [];
  };

  const maps: CampaignMap[] = Array.isArray(campaign.maps)
    ? campaign.maps.map((map) => ({
        ...map,
        backgroundOffsetX: map.backgroundOffsetX ?? 0,
        backgroundOffsetY: map.backgroundOffsetY ?? 0,
        backgroundScale: map.backgroundScale ?? 1,
        teleporters: Array.isArray((map as Partial<CampaignMap>).teleporters)
          ? (map as Partial<CampaignMap>).teleporters!.filter(
              (teleporter): teleporter is MapTeleporter =>
                Boolean(teleporter) &&
                typeof teleporter?.id === "string" &&
                typeof teleporter?.pairNumber === "number" &&
                typeof teleporter?.pointA?.x === "number" &&
                typeof teleporter?.pointA?.y === "number" &&
                typeof teleporter?.pointB?.x === "number" &&
                typeof teleporter?.pointB?.y === "number"
            )
          : [],
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
        fogEnabled: map.fogEnabled ?? true,
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
    allowedSourceBooks: Array.isArray((campaign as Partial<Campaign>).allowedSourceBooks)
      ? (campaign as Partial<Campaign>).allowedSourceBooks!.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [],
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
              : campaign.actors.find((actor) => actor.id === token.actorId)?.imageUrl ?? "",
          statusMarkers: normalizeStatusMarkers((token as Campaign["tokens"][number] & { statusMarker?: unknown }).statusMarkers ?? (token as Campaign["tokens"][number] & { statusMarker?: unknown }).statusMarker)
        }))
      : [],
    chat: Array.isArray(campaign.chat) ? campaign.chat : [],
    invites: Array.isArray(campaign.invites) ? campaign.invites : [],
    members: Array.isArray(campaign.members) ? campaign.members : []
  };
}
