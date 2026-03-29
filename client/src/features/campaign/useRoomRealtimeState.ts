import { useCallback, useEffect, useState } from "react";

import type {
  CampaignSnapshot,
  MapPing,
  MapViewportRecall,
  MeasurePreview,
  RoomCampaignPatch,
  RoomDoorToggled,
  RoomTokenMoved,
  TokenMovementPreview
} from "@shared/types";

import type { SharedMeasurePreviewState, SharedMovementPreviewState } from "./types";
import type { RoomStatus } from "../../services/roomConnection";

interface UseRoomRealtimeStateOptions {
  isCampaignRoute: boolean;
  selectedCampaignId: string | null;
  onError: (message: string) => void;
}

export function useRoomRealtimeState({ isCampaignRoute, selectedCampaignId, onError }: UseRoomRealtimeStateOptions) {
  const [snapshot, setSnapshot] = useState<CampaignSnapshot | null>(null);
  const [roomStatus, setRoomStatus] = useState<RoomStatus>("offline");
  const [mapPings, setMapPings] = useState<MapPing[]>([]);
  const [viewportRecall, setViewportRecall] = useState<MapViewportRecall | null>(null);
  const [sharedMovementPreviews, setSharedMovementPreviews] = useState<Record<string, SharedMovementPreviewState>>({});
  const [sharedMeasurePreviews, setSharedMeasurePreviews] = useState<Record<string, SharedMeasurePreviewState>>({});

  const clearEphemeralState = useCallback(() => {
    setMapPings([]);
    setViewportRecall(null);
    setSharedMovementPreviews({});
    setSharedMeasurePreviews({});
  }, []);

  const handleRoomDisconnect = useCallback(() => {
    setSnapshot(null);
    clearEphemeralState();
  }, [clearEphemeralState]);

  const handleRoomStatusChange = useCallback((status: RoomStatus) => {
    setRoomStatus(status);
  }, []);

  const handleRoomSnapshot = useCallback((nextSnapshot: CampaignSnapshot) => {
    setSnapshot(nextSnapshot);
  }, []);

  const handleCampaignPatch = useCallback((patch: RoomCampaignPatch) => {
    setSnapshot((current) => applyCampaignPatch(current, patch));
  }, []);

  const handleTokenMoved = useCallback((update: RoomTokenMoved) => {
    setSnapshot((current) => {
      if (!current) {
        return current;
      }

      const tokenIndex = current.campaign.tokens.findIndex((entry) => entry.id === update.token.id);
      const nextTokens =
        tokenIndex >= 0
          ? current.campaign.tokens.map((entry, index) => (index === tokenIndex ? update.token : entry))
          : [...current.campaign.tokens, update.token];

      return {
        ...current,
        campaign: {
          ...current.campaign,
          tokens: nextTokens
        },
        playerVision: {
          ...current.playerVision,
          [update.playerVision.mapId]: update.playerVision.cells
        }
      };
    });
  }, []);

  const handleDoorToggled = useCallback((update: RoomDoorToggled) => {
    setSnapshot((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        campaign: {
          ...current.campaign,
          maps: current.campaign.maps.map((map) =>
            map.id !== update.mapId
              ? map
              : {
                  ...map,
                  walls: map.walls.map((wall) =>
                    wall.id === update.doorId && wall.kind === "door"
                      ? {
                          ...wall,
                          isOpen: update.isOpen,
                          isLocked: update.isLocked
                        }
                      : wall
                  )
                }
          )
        },
        playerVision: {
          ...current.playerVision,
          [update.playerVision.mapId]: update.playerVision.cells
        }
      };
    });
  }, []);

  const handleMovementPreview = useCallback((actorId: string, mapId: string, preview: TokenMovementPreview | null) => {
    setSharedMovementPreviews((current) => {
      if (!preview) {
        if (!current[actorId]) {
          return current;
        }

        const next = { ...current };
        delete next[actorId];
        return next;
      }

      return {
        ...current,
        [actorId]: {
          actorId,
          mapId,
          preview
        }
      };
    });
  }, []);

  const handleMeasurePreview = useCallback((userId: string, mapId: string, preview: MeasurePreview | null) => {
    setSharedMeasurePreviews((current) => {
      if (!preview) {
        if (!current[userId]) {
          return current;
        }

        const next = { ...current };
        delete next[userId];
        return next;
      }

      return {
        ...current,
        [userId]: {
          userId,
          mapId,
          preview
        }
      };
    });
  }, []);

  const removePing = useCallback((pingId: string) => {
    setMapPings((current) => current.filter((entry) => entry.id !== pingId));
  }, []);

  const enqueuePing = useCallback(
    (ping: MapPing) => {
      setMapPings((current) => (current.some((entry) => entry.id === ping.id) ? current : [...current, ping]));
      window.setTimeout(() => {
        removePing(ping.id);
      }, 2200);
    },
    [removePing]
  );

  const handleRoomRecall = useCallback((recall: MapViewportRecall) => {
    setViewportRecall(recall);
  }, []);

  const handleRoomError = useCallback(
    (message: string) => {
      onError(message);
    },
    [onError]
  );

  useEffect(() => {
    if (!isCampaignRoute) {
      setSnapshot(null);
    }
  }, [isCampaignRoute]);

  useEffect(() => {
    clearEphemeralState();
  }, [clearEphemeralState, selectedCampaignId]);

  return {
    snapshot,
    setSnapshot,
    roomStatus,
    mapPings,
    viewportRecall,
    movementPreviews: Object.values(sharedMovementPreviews),
    measurePreviews: Object.values(sharedMeasurePreviews),
    enqueuePing,
    removePing,
    handleRoomDisconnect,
    handleRoomStatusChange,
    handleRoomSnapshot,
    handleCampaignPatch,
    handleTokenMoved,
    handleDoorToggled,
    handleMovementPreview,
    handleMeasurePreview,
    handleRoomRecall,
    handleRoomError
  };
}

function applyCampaignPatch(current: CampaignSnapshot | null, patch: RoomCampaignPatch) {
  if (!current) {
    return current;
  }

  const nextCampaign = { ...current.campaign };

  if (patch.activeMapId) {
    nextCampaign.activeMapId = patch.activeMapId;
  }

  if (patch.members) {
    nextCampaign.members = patch.members;
  }

  if (patch.invites) {
    nextCampaign.invites = patch.invites;
  }

  if (patch.actorsUpsert?.length) {
    nextCampaign.actors = upsertById(nextCampaign.actors, patch.actorsUpsert);
  }

  if (patch.actorIdsRemoved?.length) {
    const removedActorIds = new Set(patch.actorIdsRemoved);
    nextCampaign.actors = nextCampaign.actors.filter((actor) => !removedActorIds.has(actor.id));
  }

  if (patch.mapsUpsert?.length) {
    nextCampaign.maps = upsertById(nextCampaign.maps, patch.mapsUpsert);
  }

  if (patch.mapIdsRemoved?.length) {
    const removedMapIds = new Set(patch.mapIdsRemoved);
    nextCampaign.maps = nextCampaign.maps.filter((map) => !removedMapIds.has(map.id));
  }

  if (patch.mapAssignmentsUpsert?.length) {
    nextCampaign.mapAssignments = upsertByCompositeKey(nextCampaign.mapAssignments, patch.mapAssignmentsUpsert);
  }

  if (patch.mapAssignmentsRemoved?.length) {
    const removedAssignmentKeys = new Set(patch.mapAssignmentsRemoved.map((entry) => `${entry.mapId}:${entry.actorId}`));
    nextCampaign.mapAssignments = nextCampaign.mapAssignments.filter(
      (assignment) => !removedAssignmentKeys.has(`${assignment.mapId}:${assignment.actorId}`)
    );
  }

  if (patch.tokensUpsert?.length) {
    nextCampaign.tokens = upsertById(nextCampaign.tokens, patch.tokensUpsert);
  }

  if (patch.tokenIdsRemoved?.length) {
    const removedTokenIds = new Set(patch.tokenIdsRemoved);
    nextCampaign.tokens = nextCampaign.tokens.filter((token) => !removedTokenIds.has(token.id));
  }

  if (patch.chatAppended?.length) {
    const knownIds = new Set(nextCampaign.chat.map((message) => message.id));
    const appended = patch.chatAppended.filter((message) => !knownIds.has(message.id));

    if (appended.length > 0) {
      nextCampaign.chat = [...nextCampaign.chat, ...appended].slice(-200);
    }
  }

  return {
    ...current,
    campaign: nextCampaign,
    playerVision: patch.playerVision
      ? {
          ...current.playerVision,
          [patch.playerVision.mapId]: patch.playerVision.cells
        }
      : current.playerVision
  };
}

function upsertById<T extends { id: string }>(current: T[], updates: T[]) {
  const updatesById = new Map(updates.map((entry) => [entry.id, entry]));
  const next = current.map((entry) => updatesById.get(entry.id) ?? entry);

  for (const update of updates) {
    if (!current.some((entry) => entry.id === update.id)) {
      next.push(update);
    }
  }

  return next;
}

function upsertByCompositeKey<T extends { mapId: string; actorId: string }>(current: T[], updates: T[]) {
  const updatesByKey = new Map(updates.map((entry) => [`${entry.mapId}:${entry.actorId}`, entry]));
  const next = current.map((entry) => updatesByKey.get(`${entry.mapId}:${entry.actorId}`) ?? entry);

  for (const update of updates) {
    if (!current.some((entry) => entry.mapId === update.mapId && entry.actorId === update.actorId)) {
      next.push(update);
    }
  }

  return next;
}
