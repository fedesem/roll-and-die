import { startTransition, useCallback, useEffect, useRef } from "react";

import {
  clientRoomMessageSchema,
  serverRoomMessageSchema
} from "@shared/contracts/realtime";
import type {
  CampaignSnapshot,
  ClientRoomMessage,
  MapPing,
  MapViewportRecall,
  MeasurePreview,
  ServerRoomMessage,
  TokenMovementPreview
} from "@shared/types";

export type RoomStatus = "offline" | "connecting" | "online";

interface UseRoomConnectionOptions {
  enabled: boolean;
  campaignId: string | null;
  token?: string;
  onDisconnect: () => void;
  onStatusChange: (status: RoomStatus) => void;
  onSnapshot: (snapshot: CampaignSnapshot) => void;
  onMovementPreview: (actorId: string, mapId: string, preview: TokenMovementPreview | null) => void;
  onMeasurePreview: (userId: string, mapId: string, preview: MeasurePreview | null) => void;
  onPing: (ping: MapPing) => void;
  onViewRecall: (recall: MapViewportRecall) => void;
  onError: (message: string) => void;
}

export function useRoomConnection({
  enabled,
  campaignId,
  token,
  onDisconnect,
  onStatusChange,
  onSnapshot,
  onMovementPreview,
  onMeasurePreview,
  onPing,
  onViewRecall,
  onError
}: UseRoomConnectionOptions) {
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled || !campaignId || !token) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }

      onStatusChange("offline");
      onDisconnect();
      return;
    }

    onStatusChange("connecting");
    let disposed = false;
    let socket: WebSocket | null = null;

    const handleOpen = () => {
      if (!socket) {
        return;
      }

      const joinMessage = clientRoomMessageSchema.parse({
        type: "room:join",
        token,
        campaignId
      } satisfies ClientRoomMessage);

      socket.send(JSON.stringify(joinMessage));
    };

    const handleMessage = (event: MessageEvent<string>) => {
      try {
        const message = serverRoomMessageSchema.parse(JSON.parse(event.data)) as ServerRoomMessage;

        if (message.type === "room:snapshot") {
          onStatusChange("online");
          startTransition(() => {
            onSnapshot(message.snapshot);
          });
          return;
        }

        if (message.type === "room:token-preview") {
          onMovementPreview(message.actorId, message.mapId, message.preview ?? null);
          return;
        }

        if (message.type === "room:measure-preview") {
          onMeasurePreview(message.userId, message.mapId, message.preview ?? null);
          return;
        }

        if (message.type === "room:ping") {
          onPing(message.ping);
          return;
        }

        if (message.type === "room:view-recall") {
          onViewRecall(message.recall);
          return;
        }

        if (message.type === "room:joined") {
          onStatusChange("online");
          return;
        }

        if (message.type === "room:error") {
          onError(message.message);
        }
      } catch {
        onError("Received an invalid realtime payload.");
      }
    };

    const handleClose = () => {
      if (!disposed) {
        onStatusChange("offline");
      }
    };

    const handleSocketError = () => {
      if (!disposed) {
        onError("Room connection interrupted.");
      }
    };

    const connectTimeoutId = window.setTimeout(() => {
      if (disposed) {
        return;
      }

      socket = new WebSocket(buildRoomSocketUrl());
      socketRef.current = socket;
      socket.addEventListener("open", handleOpen);
      socket.addEventListener("message", handleMessage);
      socket.addEventListener("close", handleClose);
      socket.addEventListener("error", handleSocketError);
    }, 0);

    return () => {
      disposed = true;
      window.clearTimeout(connectTimeoutId);

      socket?.removeEventListener("open", handleOpen);
      socket?.removeEventListener("message", handleMessage);
      socket?.removeEventListener("close", handleClose);
      socket?.removeEventListener("error", handleSocketError);

      if (socketRef.current === socket) {
        socketRef.current = null;
      }

      if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
        socket.close();
      }

      onStatusChange("offline");
    };
  }, [
    campaignId,
    enabled,
    onDisconnect,
    onError,
    onMeasurePreview,
    onMovementPreview,
    onPing,
    onSnapshot,
    onStatusChange,
    onViewRecall,
    token
  ]);

  const sendRoomMessage = useCallback(
    async (message: ClientRoomMessage) => {
      const socket = socketRef.current;

      if (!socket || socket.readyState !== WebSocket.OPEN) {
        throw new Error("Room connection is not ready yet.");
      }

      const parsedMessage = clientRoomMessageSchema.parse(message);
      socket.send(JSON.stringify(parsedMessage));
    },
    []
  );

  return { sendRoomMessage };
}

function buildRoomSocketUrl() {
  const configured = import.meta.env.VITE_WS_URL;

  if (typeof configured === "string" && configured.length > 0) {
    return configured;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}
