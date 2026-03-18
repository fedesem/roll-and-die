import { useCallback, useEffect, useState } from "react";

import type { CampaignSnapshot, MapPing, MapViewportRecall, MeasurePreview, TokenMovementPreview } from "@shared/types";

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
    handleMovementPreview,
    handleMeasurePreview,
    handleRoomRecall,
    handleRoomError
  };
}
