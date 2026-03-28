import { useCallback } from "react";

import type { ActorSheet, AuthPayload, CampaignMap, ClientRoomMessage, DrawingStroke, MapPing, MeasurePreview, Point } from "@shared/types";

import { toErrorMessage } from "../../lib/errors";
import type { BannerState } from "./types";

interface UseRoomActionsOptions {
  session: AuthPayload | null;
  selectedCampaignId: string | null;
  activeMap: CampaignMap | null;
  editingMap: CampaignMap | null;
  sendRoomMessage: (message: ClientRoomMessage) => Promise<void>;
  enqueuePing: (ping: MapPing) => void;
  removePing: (pingId: string) => void;
  onStatus: (tone: BannerState["tone"], text: string) => void;
}

export function useRoomActions({
  session,
  selectedCampaignId,
  activeMap,
  editingMap,
  sendRoomMessage,
  enqueuePing,
  removePing,
  onStatus
}: UseRoomActionsOptions) {
  const sendChat = useCallback(
    async (text: string) => {
      if (!selectedCampaignId) {
        return;
      }

      try {
        await sendRoomMessage({
          type: "chat:send",
          text
        });
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, selectedCampaignId, sendRoomMessage]
  );

  const rollFromSheet = useCallback(
    async (notation: string, label: string, actor?: ActorSheet | null) => {
      if (!selectedCampaignId) {
        return;
      }

      try {
        await sendRoomMessage({
          type: "roll:send",
          notation,
          label,
          actorId: actor?.id
        });
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, selectedCampaignId, sendRoomMessage]
  );

  const moveActor = useCallback(
    async (actorId: string, x: number, y: number) => {
      if (!selectedCampaignId) {
        return;
      }

      try {
        await sendRoomMessage({
          type: "token:move",
          actorId,
          x,
          y
        });
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, selectedCampaignId, sendRoomMessage]
  );

  const broadcastMovePreview = useCallback(
    async (actorId: string, target: Point | null) => {
      if (!selectedCampaignId) {
        return;
      }

      try {
        await sendRoomMessage({
          type: "token:preview",
          actorId,
          target
        });
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, selectedCampaignId, sendRoomMessage]
  );

  const broadcastMeasurePreview = useCallback(
    async (preview: MeasurePreview | null) => {
      if (!selectedCampaignId) {
        return;
      }

      try {
        await sendRoomMessage({
          type: "measure:preview",
          preview
        });
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, selectedCampaignId, sendRoomMessage]
  );

  const createDrawing = useCallback(
    async (mapId: string, stroke: DrawingStroke) => {
      if (!selectedCampaignId) {
        return;
      }

      try {
        await sendRoomMessage({
          type: "drawing:create",
          mapId,
          stroke
        });
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, selectedCampaignId, sendRoomMessage]
  );

  const updateDrawings = useCallback(
    async (mapId: string, drawings: Array<{ id: string; points: Point[]; rotation: number }>) => {
      if (!selectedCampaignId || drawings.length === 0) {
        return;
      }

      try {
        await sendRoomMessage({
          type: "drawing:update",
          mapId,
          drawings
        });
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, selectedCampaignId, sendRoomMessage]
  );

  const deleteDrawings = useCallback(
    async (mapId: string, drawingIds: string[]) => {
      if (!selectedCampaignId || drawingIds.length === 0) {
        return;
      }

      try {
        await sendRoomMessage({
          type: "drawing:delete",
          mapId,
          drawingIds
        });
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, selectedCampaignId, sendRoomMessage]
  );

  const clearDrawings = useCallback(
    async (mapId: string) => {
      if (!selectedCampaignId) {
        return;
      }

      try {
        await sendRoomMessage({
          type: "drawing:clear",
          mapId
        });
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, selectedCampaignId, sendRoomMessage]
  );

  const pingMap = useCallback(
    async (point: Point) => {
      if (!selectedCampaignId || !activeMap || !session) {
        return;
      }

      const ping: MapPing = {
        id: `png_${crypto.randomUUID().slice(0, 8)}`,
        mapId: activeMap.id,
        point,
        userId: session.user.id,
        userName: session.user.name,
        createdAt: new Date().toISOString()
      };

      enqueuePing(ping);

      try {
        await sendRoomMessage({
          type: "map:ping",
          pingId: ping.id,
          mapId: activeMap.id,
          point
        });
      } catch (error) {
        removePing(ping.id);
        onStatus("error", toErrorMessage(error));
      }
    },
    [activeMap, enqueuePing, onStatus, removePing, selectedCampaignId, sendRoomMessage, session]
  );

  const pingAndRecallMap = useCallback(
    async (point: Point, center: Point, zoom: number) => {
      if (!selectedCampaignId || !activeMap || !session) {
        return;
      }

      const ping: MapPing = {
        id: `png_${crypto.randomUUID().slice(0, 8)}`,
        mapId: activeMap.id,
        point,
        userId: session.user.id,
        userName: session.user.name,
        createdAt: new Date().toISOString()
      };

      enqueuePing(ping);

      try {
        await sendRoomMessage({
          type: "map:ping-recall",
          pingId: ping.id,
          mapId: activeMap.id,
          point,
          center,
          zoom
        });
      } catch (error) {
        removePing(ping.id);
        onStatus("error", toErrorMessage(error));
      }
    },
    [activeMap, enqueuePing, onStatus, removePing, selectedCampaignId, sendRoomMessage, session]
  );

  const toggleDoor = useCallback(
    async (doorId: string) => {
      if (!selectedCampaignId) {
        return;
      }

      try {
        await sendRoomMessage({
          type: "door:toggle",
          doorId
        });
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, selectedCampaignId, sendRoomMessage]
  );

  const toggleDoorLock = useCallback(
    async (doorId: string) => {
      if (!selectedCampaignId) {
        return;
      }

      try {
        await sendRoomMessage({
          type: "door:lock-toggle",
          doorId
        });
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, selectedCampaignId, sendRoomMessage]
  );

  const resetFog = useCallback(async () => {
    if (!selectedCampaignId || !activeMap) {
      return;
    }

    if (!window.confirm(`Reset remembered fog for all players on ${activeMap.name}?`)) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "fog:reset",
        mapId: activeMap.id
      });
      onStatus("info", "Fog memory reset for the active map.");
    } catch (error) {
      onStatus("error", toErrorMessage(error));
    }
  }, [activeMap, onStatus, selectedCampaignId, sendRoomMessage]);

  const clearFog = useCallback(async () => {
    if (!selectedCampaignId || !activeMap) {
      return;
    }

    if (!window.confirm(`Clear fog for everyone on ${activeMap.name}?`)) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "fog:clear",
        mapId: activeMap.id
      });
      onStatus("info", "Fog cleared for the active map.");
    } catch (error) {
      onStatus("error", toErrorMessage(error));
    }
  }, [activeMap, onStatus, selectedCampaignId, sendRoomMessage]);

  const setEditingMapActive = useCallback(() => {
    if (!editingMap) {
      return;
    }

    void sendRoomMessage({ type: "map:set-active", mapId: editingMap.id }).catch((error: unknown) => {
      onStatus("error", toErrorMessage(error));
    });
  }, [editingMap, onStatus, sendRoomMessage]);

  const showMap = useCallback(
    (mapId: string) => {
      void sendRoomMessage({ type: "map:set-active", mapId }).catch((error: unknown) => {
        onStatus("error", toErrorMessage(error));
      });
    },
    [onStatus, sendRoomMessage]
  );

  return {
    sendChat,
    rollFromSheet,
    moveActor,
    broadcastMovePreview,
    broadcastMeasurePreview,
    createDrawing,
    updateDrawings,
    deleteDrawings,
    clearDrawings,
    pingMap,
    pingAndRecallMap,
    toggleDoor,
    toggleDoorLock,
    resetFog,
    clearFog,
    setEditingMapActive,
    showMap
  };
}
