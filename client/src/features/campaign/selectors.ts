import type {
  ActorSheet,
  Campaign,
  CampaignMap,
  CampaignMember,
  CampaignSnapshot,
  MapActorAssignment,
  MonsterTemplate
} from "@shared/types";
import { getActorAssignedMaps, isActorAssignedToMap, isPlayerOwnedActor } from "@shared/campaignActors";
import { getTokenOccupiedCellKeys } from "@shared/tokenGeometry";
import { allMapCells, computeVisibleCellsForUser } from "@shared/vision";

import type { ActorTypeFilter, AvailableActorEntry, CurrentMapRosterEntry } from "./types";

export function selectActiveMap(campaign: Campaign | null) {
  return campaign?.maps.find((entry) => entry.id === campaign.activeMapId) ?? campaign?.maps[0];
}

export function selectSelectedMap(campaign: Campaign | null, activeMap: CampaignMap | undefined, selectedMapId: string | null) {
  return campaign?.maps.find((entry) => entry.id === selectedMapId) ?? activeMap;
}

export function selectSelectedActor(campaign: Campaign | null, selectedActorId: string | null) {
  return campaign?.actors.find((entry) => entry.id === selectedActorId) ?? null;
}

export function selectActiveMapTokens(campaign: Campaign | null, activeMap: CampaignMap | undefined) {
  return campaign?.tokens.filter((token) => token.mapId === activeMap?.id && token.visible) ?? [];
}

export function selectMapTokens(campaign: Campaign | null, map: CampaignMap | undefined) {
  return campaign?.tokens.filter((token) => token.mapId === map?.id && token.visible) ?? [];
}

export function selectBoardSeenCells({
  activeMap,
  role,
  fogPreviewUserId,
  campaign,
  snapshot
}: {
  activeMap: CampaignMap | undefined;
  role: "dm" | "player";
  fogPreviewUserId?: string;
  campaign: Campaign | null;
  snapshot: CampaignSnapshot | null;
}) {
  if (!activeMap) {
    return [];
  }

  if (!activeMap.fogEnabled) {
    return allMapCells(activeMap);
  }

  if (role === "dm") {
    return fogPreviewUserId ? (campaign?.exploration[fogPreviewUserId]?.[activeMap.id] ?? []) : [];
  }

  return snapshot?.playerVision[activeMap.id] ?? [];
}

export function selectBoardVisibleCells({
  activeMap,
  campaign,
  activeMapTokens,
  userId,
  role,
  fogPreviewUserId
}: {
  activeMap: CampaignMap | undefined;
  campaign: Campaign | null;
  activeMapTokens: Campaign["tokens"];
  userId?: string;
  role: "dm" | "player";
  fogPreviewUserId?: string;
}) {
  if (!activeMap || !campaign || !userId) {
    return new Set<string>();
  }

  if (!activeMap.fogEnabled) {
    return new Set(allMapCells(activeMap));
  }

  return computeVisibleCellsForUser({
    map: activeMap,
    actors: campaign.actors,
    tokens: activeMapTokens,
    userId: fogPreviewUserId ?? userId,
    role: role === "dm" && !fogPreviewUserId ? "dm" : "player"
  });
}

export function selectVisibleMapTokens({
  activeMap,
  role,
  fogPreviewUserId,
  activeMapTokens,
  visibleCells,
  seenCells
}: {
  activeMap: CampaignMap | undefined;
  role: "dm" | "player";
  fogPreviewUserId?: string;
  activeMapTokens: Campaign["tokens"];
  visibleCells: Set<string>;
  seenCells: Set<string>;
}) {
  if (!activeMap) {
    return [];
  }

  if (!activeMap.fogEnabled) {
    return activeMapTokens;
  }

  if (role === "dm" && !fogPreviewUserId) {
    return activeMapTokens;
  }

  return activeMapTokens.filter((token) => {
    return getTokenOccupiedCellKeys(activeMap, token).some((cellKey) => visibleCells.has(cellKey) || seenCells.has(cellKey));
  });
}

export function selectMapAssignments(campaign: Campaign | null, map: CampaignMap | undefined) {
  if (!campaign || !map) {
    return [];
  }

  const explicitAssignments = campaign.mapAssignments.filter((assignment) => assignment.mapId === map.id);
  const assignedActorIdSet = new Set(explicitAssignments.map((assignment) => assignment.actorId));
  const implicitAssignments = campaign.actors
    .filter((actor) => isPlayerOwnedActor(campaign, actor) && !assignedActorIdSet.has(actor.id))
    .map<MapActorAssignment>((actor) => ({
      actorId: actor.id,
      mapId: map.id
    }));

  return [...explicitAssignments, ...implicitAssignments];
}

export function buildCurrentMapRoster({
  assignments,
  actors,
  members,
  allTokens,
  visibleTokens,
  role,
  currentUserId
}: {
  assignments: MapActorAssignment[];
  actors: ActorSheet[];
  members: CampaignMember[];
  allTokens: Campaign["tokens"];
  visibleTokens: Campaign["tokens"];
  role: "dm" | "player";
  currentUserId?: string;
}): CurrentMapRosterEntry[] {
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
  const playerOwnerIdSet = new Set(members.filter((member) => member.role === "player").map((member) => member.userId));
  const memberByUserId = new Map(members.map((member) => [member.userId, member]));
  const tokenByActorId = new Map(allTokens.map((token) => [token.actorId, token]));
  const visibleTokenByActorId = new Map(visibleTokens.map((token) => [token.actorId, token]));

  return assignments.flatMap<CurrentMapRosterEntry>((assignment) => {
    const actor = actorById.get(assignment.actorId) ?? null;
    const isImplicitAssignment = Boolean(actor?.ownerId && playerOwnerIdSet.has(actor.ownerId));
    const token = tokenByActorId.get(assignment.actorId) ?? null;
    const visibleToken = visibleTokenByActorId.get(assignment.actorId) ?? null;

    if (role === "dm") {
      if (!actor) {
        return [];
      }

      return [
        {
          actor,
          actorKind: actor.kind,
          assignment,
          isImplicitAssignment,
          ownerName: resolveActorOwnerName(actor, memberByUserId),
          color: token?.color ?? actor.color,
          label: token?.label ?? actor.name,
          imageUrl: token?.imageUrl ?? actor.imageUrl,
          token
        }
      ];
    }

    if (actor && actor.ownerId === currentUserId) {
      return [
        {
          actor,
          actorKind: actor.kind,
          assignment,
          isImplicitAssignment,
          ownerName: resolveActorOwnerName(actor, memberByUserId),
          color: token?.color ?? actor.color,
          label: token?.label ?? actor.name,
          imageUrl: token?.imageUrl ?? actor.imageUrl,
          token
        }
      ];
    }

    if (!visibleToken) {
      return [];
    }

    return [
      {
        actor: null,
        actorKind: visibleToken.actorKind,
        assignment,
        isImplicitAssignment: false,
        ownerName: null,
        color: visibleToken.color,
        label: visibleToken.label,
        imageUrl: visibleToken.imageUrl,
        token: visibleToken
      }
    ];
  });
}

export function filterCurrentMapRoster(roster: CurrentMapRosterEntry[], typeFilter: ActorTypeFilter, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  return roster.filter(({ actor, actorKind, label }) => {
    if (typeFilter !== "all" && actorKind !== typeFilter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [label, actorKind, actor?.name ?? "", actor?.species ?? ""].some((value) => value.toLowerCase().includes(normalizedQuery));
  });
}

export function selectAvailableActors({
  campaign,
  role,
  currentUserId,
  map,
  typeFilter,
  query
}: {
  campaign: Campaign | null;
  role: "dm" | "player";
  currentUserId?: string;
  map: CampaignMap | undefined;
  typeFilter: ActorTypeFilter;
  query: string;
}): AvailableActorEntry[] {
  if (!campaign) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();

  return campaign.actors
    .filter((actor) => role === "dm" || actor.ownerId === currentUserId)
    .filter((actor) => {
      if (typeFilter !== "all" && actor.kind !== typeFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [actor.name, actor.kind, actor.species, actor.className].some((value) => value.toLowerCase().includes(normalizedQuery));
    })
    .map((actor) => {
      const owner = actor.ownerId ? (campaign.members.find((member) => member.userId === actor.ownerId) ?? null) : null;
      const activeMaps = getActorAssignedMaps(campaign, actor);

      return {
        actor,
        activeMaps,
        onCurrentMap: map ? isActorAssignedToMap(campaign, actor, map.id) : false,
        isOnAllMaps: campaign.maps.length > 0 && activeMaps.length === campaign.maps.length,
        ownerName: owner?.name ?? (actor.ownerId ? "Former member" : "Unowned"),
        ownerRole: owner?.role ?? null
      };
    });
}

export function selectPlayerMembers(campaign: Campaign | null): CampaignMember[] {
  return campaign?.members.filter((member) => member.role === "player") ?? [];
}

export function filterMonsterCatalog(snapshot: CampaignSnapshot | null, query: string): MonsterTemplate[] {
  if (!snapshot) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return snapshot.catalog;
  }

  return snapshot.catalog.filter((monster) =>
    [monster.name, monster.source, monster.challengeRating].some((field) => field.toLowerCase().includes(normalizedQuery))
  );
}

export function selectMonsterTemplate(filteredCatalog: MonsterTemplate[], selectedMonsterId: string | null) {
  return filteredCatalog.find((monster) => monster.id === selectedMonsterId) ?? filteredCatalog[0] ?? null;
}

function resolveActorOwnerName(actor: ActorSheet, memberByUserId: Map<string, CampaignMember>) {
  if (!actor.ownerId) {
    return "Unowned";
  }

  return memberByUserId.get(actor.ownerId)?.name ?? "Former member";
}
