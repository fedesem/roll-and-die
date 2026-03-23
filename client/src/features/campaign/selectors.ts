import type {
  ActorSheet,
  Campaign,
  CampaignMap,
  CampaignMember,
  CampaignSnapshot,
  MapActorAssignment,
  MonsterTemplate
} from "@shared/types";
import { computeVisibleCellsForUser, tokenCellKey } from "@shared/vision";

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

  if (role === "dm") {
    return fogPreviewUserId ? campaign?.exploration[fogPreviewUserId]?.[activeMap.id] ?? [] : [];
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
  activeMapTokens,
  visibleCells,
  seenCells
}: {
  activeMap: CampaignMap | undefined;
  role: "dm" | "player";
  activeMapTokens: Campaign["tokens"];
  visibleCells: Set<string>;
  seenCells: Set<string>;
}) {
  if (!activeMap) {
    return [];
  }

  if (role === "dm") {
    return activeMapTokens;
  }

  return activeMapTokens.filter((token) => {
    const cell = tokenCellKey(activeMap, token);
    return visibleCells.has(cell) || seenCells.has(cell);
  });
}

export function selectActiveMapAssignments(campaign: Campaign | null, activeMap: CampaignMap | undefined) {
  return campaign?.mapAssignments.filter((assignment) => assignment.mapId === activeMap?.id) ?? [];
}

export function buildCurrentMapRoster({
  assignments,
  actors,
  allTokens,
  visibleTokens,
  role,
  currentUserId
}: {
  assignments: MapActorAssignment[];
  actors: ActorSheet[];
  allTokens: Campaign["tokens"];
  visibleTokens: Campaign["tokens"];
  role: "dm" | "player";
  currentUserId?: string;
}): CurrentMapRosterEntry[] {
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
  const tokenByActorId = new Map(allTokens.map((token) => [token.actorId, token]));
  const visibleTokenByActorId = new Map(visibleTokens.map((token) => [token.actorId, token]));

  return assignments.flatMap<CurrentMapRosterEntry>((assignment) => {
    const actor = actorById.get(assignment.actorId) ?? null;
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
        color: visibleToken.color,
        label: visibleToken.label,
        imageUrl: visibleToken.imageUrl,
        token: visibleToken
      }
    ];
  });
}

export function filterCurrentMapRoster(
  roster: CurrentMapRosterEntry[],
  typeFilter: ActorTypeFilter,
  query: string
) {
  const normalizedQuery = query.trim().toLowerCase();

  return roster.filter(({ actor, actorKind, label }) => {
    if (typeFilter !== "all" && actorKind !== typeFilter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [label, actorKind, actor?.name ?? "", actor?.species ?? ""].some((value) =>
      value.toLowerCase().includes(normalizedQuery)
    );
  });
}

export function selectAvailableActors({
  campaign,
  role,
  currentUserId,
  activeMap,
  typeFilter,
  query
}: {
  campaign: Campaign | null;
  role: "dm" | "player";
  currentUserId?: string;
  activeMap: CampaignMap | undefined;
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

      return [actor.name, actor.kind, actor.species, actor.className].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      );
    })
    .map((actor) => ({
      actor,
      activeMaps: campaign.maps.filter((map) =>
        campaign.mapAssignments.some((assignment) => assignment.actorId === actor.id && assignment.mapId === map.id)
      ),
      onCurrentMap: campaign.mapAssignments.some(
        (assignment) => assignment.actorId === actor.id && assignment.mapId === activeMap?.id
      )
    }));
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
    [monster.name, monster.source, monster.challengeRating].some((field) =>
      field.toLowerCase().includes(normalizedQuery)
    )
  );
}

export function selectMonsterTemplate(filteredCatalog: MonsterTemplate[], selectedMonsterId: string | null) {
  return filteredCatalog.find((monster) => monster.id === selectedMonsterId) ?? filteredCatalog[0] ?? null;
}
