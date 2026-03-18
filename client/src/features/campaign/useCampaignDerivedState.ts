import { useDeferredValue, useMemo } from "react";

import type { CampaignSnapshot } from "@shared/types";

import {
  buildCurrentMapRoster,
  filterCurrentMapRoster,
  filterMonsterCatalog,
  selectActiveMap,
  selectActiveMapAssignments,
  selectActiveMapTokens,
  selectAvailableActors,
  selectBoardSeenCells,
  selectBoardVisibleCells,
  selectMonsterTemplate,
  selectPlayerMembers,
  selectSelectedActor,
  selectSelectedMap,
  selectVisibleMapTokens
} from "./selectors";
import type { ActorTypeFilter } from "./types";

interface UseCampaignDerivedStateOptions {
  snapshot: CampaignSnapshot | null;
  selectedMapId: string | null;
  selectedActorId: string | null;
  selectedMonsterId: string | null;
  dmFogEnabled: boolean;
  dmFogUserId: string | null;
  currentUserId?: string;
  actorSearch: string;
  mapActorSearch: string;
  actorTypeFilter: ActorTypeFilter;
  mapActorTypeFilter: ActorTypeFilter;
  monsterQuery: string;
}

export function useCampaignDerivedState({
  snapshot,
  selectedMapId,
  selectedActorId,
  selectedMonsterId,
  dmFogEnabled,
  dmFogUserId,
  currentUserId,
  actorSearch,
  mapActorSearch,
  actorTypeFilter,
  mapActorTypeFilter,
  monsterQuery
}: UseCampaignDerivedStateOptions) {
  const deferredMonsterQuery = useDeferredValue(monsterQuery);
  const campaign = snapshot?.campaign ?? null;
  const role = snapshot?.role ?? "player";
  const activeMap = useMemo(() => selectActiveMap(campaign), [campaign]);
  const selectedMap = useMemo(() => selectSelectedMap(campaign, activeMap, selectedMapId), [activeMap, campaign, selectedMapId]);
  const selectedActor = useMemo(() => selectSelectedActor(campaign, selectedActorId), [campaign, selectedActorId]);
  const activeMapTokens = useMemo(() => selectActiveMapTokens(campaign, activeMap), [campaign, activeMap]);
  const fogPreviewUserId = role === "dm" && dmFogEnabled ? dmFogUserId ?? undefined : undefined;
  const boardSeenCells = useMemo(
    () => selectBoardSeenCells({ activeMap, role, fogPreviewUserId, campaign, snapshot }),
    [activeMap, campaign, fogPreviewUserId, role, snapshot]
  );
  const boardVisibleCells = useMemo(
    () =>
      selectBoardVisibleCells({
        activeMap,
        campaign,
        activeMapTokens,
        userId: currentUserId,
        role,
        fogPreviewUserId
      }),
    [activeMap, activeMapTokens, campaign, currentUserId, fogPreviewUserId, role]
  );
  const boardSeenCellSet = useMemo(() => new Set(boardSeenCells), [boardSeenCells]);
  const visibleMapTokens = useMemo(
    () =>
      selectVisibleMapTokens({
        activeMap,
        role,
        activeMapTokens,
        visibleCells: boardVisibleCells,
        seenCells: boardSeenCellSet
      }),
    [activeMap, activeMapTokens, boardSeenCellSet, boardVisibleCells, role]
  );
  const activeMapAssignments = useMemo(() => selectActiveMapAssignments(campaign, activeMap), [campaign, activeMap]);
  const currentMapRoster = useMemo(
    () =>
      buildCurrentMapRoster({
        assignments: activeMapAssignments,
        actors: campaign?.actors ?? [],
        allTokens: activeMapTokens,
        visibleTokens: visibleMapTokens,
        role,
        currentUserId
      }),
    [activeMapAssignments, activeMapTokens, campaign?.actors, currentUserId, role, visibleMapTokens]
  );
  const filteredCurrentMapRoster = useMemo(
    () => filterCurrentMapRoster(currentMapRoster, mapActorTypeFilter, mapActorSearch),
    [currentMapRoster, mapActorSearch, mapActorTypeFilter]
  );
  const availableActors = useMemo(
    () =>
      selectAvailableActors({
        campaign,
        role,
        activeMap,
        typeFilter: actorTypeFilter,
        query: actorSearch
      }),
    [activeMap, actorSearch, actorTypeFilter, campaign, role]
  );
  const playerMembers = useMemo(() => selectPlayerMembers(campaign), [campaign]);
  const filteredCatalog = useMemo(() => filterMonsterCatalog(snapshot, deferredMonsterQuery), [deferredMonsterQuery, snapshot]);
  const selectedMonsterTemplate = useMemo(
    () => selectMonsterTemplate(filteredCatalog, selectedMonsterId),
    [filteredCatalog, selectedMonsterId]
  );

  return {
    campaign,
    role,
    activeMap,
    selectedMap,
    selectedActor,
    activeMapTokens,
    fogPreviewUserId,
    boardSeenCells,
    boardVisibleCells,
    visibleMapTokens,
    activeMapAssignments,
    currentMapRoster,
    filteredCurrentMapRoster,
    availableActors,
    playerMembers,
    filteredCatalog,
    selectedMonsterTemplate,
    boardSeenCellSet
  };
}
