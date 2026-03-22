import { useCallback, useEffect, useState } from "react";

import type {
  CampaignSnapshot,
  MapPing,
  MapViewportRecall,
  MeasurePreview,
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
                          isOpen: update.isOpen
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
    handleTokenMoved,
    handleDoorToggled,
    handleMovementPreview,
    handleMeasurePreview,
    handleRoomRecall,
    handleRoomError
  };
}
