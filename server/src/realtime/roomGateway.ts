import type { Server } from "node:http";

import { WebSocket, WebSocketServer, type RawData } from "ws";

import { clientRoomMessageSchema, serverRoomMessageSchema } from "../../../shared/contracts/realtime.js";
import type {
  BoardToken,
  MapPing,
  MapViewportRecall,
  ServerRoomMessage,
  TokenMovementPreview,
  UserProfile
} from "../../../shared/types.js";
import { snapPointToGrid, traceMovementPath } from "../../../shared/vision.js";
import { HttpError } from "../http/errors.js";
import { parseWithSchema } from "../http/validation.js";
import { rollDice } from "../dice.js";
import { mutateDatabase, readDatabase } from "../store.js";
import { createId, now, toUserProfile } from "../services/authService.js";
import {
  buildCampaignSnapshot,
  canManageActor,
  canManageDrawing,
  canToggleDoor,
  hasMapAssignment,
  requireActiveMap,
  requireCampaignMember,
  requireDungeonMaster,
  resetFogForMap,
  sanitizeDrawings,
  sanitizeMeasurePreview,
  trimChat,
  updateExplorationForCampaign
} from "../services/campaignDomain.js";

interface RoomConnection {
  socket: WebSocket;
  user?: UserProfile;
  campaignId?: string;
}

const roomConnections = new Set<RoomConnection>();

export function createRoomGateway(httpServer: Server) {
  const websocketServer = new WebSocketServer({ server: httpServer, path: "/ws" });

  websocketServer.on("connection", (socket: WebSocket) => {
    const connection: RoomConnection = { socket };
    roomConnections.add(connection);

    socket.on("message", (payload: RawData) => {
      void handleSocketMessage(connection, String(payload));
    });

    socket.on("close", () => {
      if (connection.user && connection.campaignId) {
        void readDatabase()
          .then((database) => {
            const campaign = database.campaigns.find((entry) => entry.id === connection.campaignId);

            if (!campaign) {
              return;
            }

            broadcastSocketMessageToRoom(connection.campaignId!, {
              type: "room:measure-preview",
              userId: connection.user!.id,
              mapId: campaign.activeMapId,
              preview: null
            });
          })
          .catch(() => undefined);
      }

      roomConnections.delete(connection);
    });
  });

  return websocketServer;
}

export async function broadcastCampaignToRoom(campaignId: string) {
  const database = await readDatabase();
  const campaign = database.campaigns.find((entry) => entry.id === campaignId);

  if (!campaign) {
    return;
  }

  for (const connection of roomConnections) {
    if (!connection.user || connection.campaignId !== campaignId) {
      continue;
    }

    const member = campaign.members.find((entry) => entry.userId === connection.user?.id);

    if (!member) {
      continue;
    }

    sendSocketMessage(connection, {
      type: "room:snapshot",
      snapshot: buildCampaignSnapshot(campaign, connection.user, database.compendium.monsters)
    });
  }
}

function sendSocketMessage(connection: RoomConnection, message: ServerRoomMessage) {
  if (connection.socket.readyState !== WebSocket.OPEN) {
    return;
  }

  const parsedMessage = serverRoomMessageSchema.parse(message);
  connection.socket.send(JSON.stringify(parsedMessage));
}

function broadcastSocketMessageToRoom(campaignId: string, message: ServerRoomMessage) {
  for (const connection of roomConnections) {
    if (!connection.user || connection.campaignId !== campaignId) {
      continue;
    }

    sendSocketMessage(connection, message);
  }
}

function requireJoinedConnection(connection: RoomConnection) {
  if (!connection.user || !connection.campaignId) {
    throw new HttpError(401, "Join a room before sending realtime events.");
  }

  return {
    user: connection.user,
    campaignId: connection.campaignId
  };
}

async function handleSocketMessage(connection: RoomConnection, raw: string) {
  try {
    const payload = parseWithSchema(clientRoomMessageSchema, JSON.parse(raw), "Invalid websocket payload.");

    if (payload.type === "room:join") {
      const database = await readDatabase();
      const session = database.sessions.find((entry) => entry.token === payload.token);
      const userRecord = session ? database.users.find((entry) => entry.id === session.userId) : undefined;

      if (!userRecord) {
        throw new HttpError(401, "Authentication required.");
      }

      const user = toUserProfile(userRecord);
      const { campaign } = requireCampaignMember(database, payload.campaignId, user.id);

      connection.user = user;
      connection.campaignId = campaign.id;

      sendSocketMessage(connection, {
        type: "room:joined",
        campaignId: campaign.id
      });
      sendSocketMessage(connection, {
        type: "room:snapshot",
        snapshot: buildCampaignSnapshot(campaign, user, database.compendium.monsters)
      });
      return;
    }

    const { user, campaignId } = requireJoinedConnection(connection);

    if (payload.type === "chat:send") {
      await mutateDatabase((database) => {
        const { campaign } = requireCampaignMember(database, campaignId, user.id);
        const text = payload.text.slice(0, 500);

        if (/^\/roll\s+/i.test(text)) {
          const roll = rollDice(text, `${user.name} rolled`);
          campaign.chat.push({
            id: createId("msg"),
            campaignId,
            userId: user.id,
            userName: user.name,
            text: `${roll.label}: ${roll.notation}`,
            createdAt: now(),
            kind: "roll",
            roll
          });
        } else {
          campaign.chat.push({
            id: createId("msg"),
            campaignId,
            userId: user.id,
            userName: user.name,
            text,
            createdAt: now(),
            kind: "message"
          });
        }

        trimChat(campaign);
      });

      await broadcastCampaignToRoom(campaignId);
      return;
    }

    if (payload.type === "roll:send") {
      await mutateDatabase((database) => {
        const { campaign } = requireCampaignMember(database, campaignId, user.id);
        const roll = rollDice(payload.notation, payload.label);

        campaign.chat.push({
          id: createId("msg"),
          campaignId,
          userId: user.id,
          userName: user.name,
          text: `${payload.label}: ${roll.notation}`,
          createdAt: now(),
          kind: "roll",
          roll
        });
        trimChat(campaign);
      });

      await broadcastCampaignToRoom(campaignId);
      return;
    }

    if (payload.type === "token:move") {
      let activeMapId = "";

      await mutateDatabase((database) => {
        const { campaign, role } = requireCampaignMember(database, campaignId, user.id);
        const activeMap = requireActiveMap(campaign);
        activeMapId = activeMap.id;
        const actor = campaign.actors.find((entry) => entry.id === payload.actorId);

        if (!actor) {
          throw new HttpError(404, "Actor not found.");
        }

        if (!canManageActor(role, user.id, actor)) {
          throw new HttpError(403, "You cannot move that token.");
        }

        if (!hasMapAssignment(campaign, actor.id, activeMap.id)) {
          throw new HttpError(403, "Assign the actor to the active map first.");
        }

        const snapped = snapPointToGrid(activeMap, {
          x: payload.x,
          y: payload.y
        });
        const existing = campaign.tokens.find(
          (entry) => entry.actorId === actor.id && entry.mapId === activeMap.id
        );

        if (existing) {
          const trace = traceMovementPath(activeMap, { x: existing.x, y: existing.y }, snapped, {
            ignoreWalls: role === "dm"
          });
          existing.x = trace.end.x;
          existing.y = trace.end.y;
        } else {
          const token: BoardToken = {
            id: createId("tok"),
            actorId: actor.id,
            actorKind: actor.kind,
            mapId: activeMap.id,
            x: snapped.x,
            y: snapped.y,
            size: 1,
            color: actor.color,
            label: actor.name,
            visible: true
          };

          campaign.tokens.push(token);
        }

        updateExplorationForCampaign(campaign);
      });

      broadcastSocketMessageToRoom(campaignId, {
        type: "room:token-preview",
        actorId: payload.actorId,
        mapId: activeMapId,
        preview: null
      });
      await broadcastCampaignToRoom(campaignId);
      return;
    }

    if (payload.type === "token:preview") {
      const database = await readDatabase();
      const { campaign, role } = requireCampaignMember(database, campaignId, user.id);
      const activeMap = requireActiveMap(campaign);
      const actor = campaign.actors.find((entry) => entry.id === payload.actorId);

      if (!actor) {
        throw new HttpError(404, "Actor not found.");
      }

      if (!canManageActor(role, user.id, actor)) {
        throw new HttpError(403, "You cannot move that token.");
      }

      const existing = campaign.tokens.find(
        (entry) => entry.actorId === actor.id && entry.mapId === activeMap.id
      );

      if (!existing || !payload.target) {
        broadcastSocketMessageToRoom(campaignId, {
          type: "room:token-preview",
          actorId: actor.id,
          mapId: activeMap.id,
          preview: null
        });
        return;
      }

      const snapped = snapPointToGrid(activeMap, {
        x: payload.target.x,
        y: payload.target.y
      });
      const trace = traceMovementPath(activeMap, { x: existing.x, y: existing.y }, snapped, {
        ignoreWalls: role === "dm"
      });
      const preview: TokenMovementPreview = {
        blocked: trace.blocked,
        end: trace.end,
        points: trace.points,
        steps: trace.steps
      };

      broadcastSocketMessageToRoom(campaignId, {
        type: "room:token-preview",
        actorId: actor.id,
        mapId: activeMap.id,
        preview
      });
      return;
    }

    if (payload.type === "measure:preview") {
      const database = await readDatabase();
      const { campaign } = requireCampaignMember(database, campaignId, user.id);
      const activeMap = requireActiveMap(campaign);
      const preview = payload.preview ? sanitizeMeasurePreview(payload.preview, activeMap) : null;

      broadcastSocketMessageToRoom(campaignId, {
        type: "room:measure-preview",
        userId: user.id,
        mapId: activeMap.id,
        preview
      });
      return;
    }

    if (payload.type === "drawing:create") {
      await mutateDatabase((database) => {
        const { campaign } = requireCampaignMember(database, campaignId, user.id);
        const activeMap = requireActiveMap(campaign);

        if (payload.mapId !== activeMap.id) {
          throw new HttpError(403, "Drawings can only be added to the active map.");
        }

        const strokes = sanitizeDrawings(
          [
            {
              ...payload.stroke,
              ownerId: user.id
            }
          ],
          []
        );

        if (strokes.length === 0) {
          throw new HttpError(400, "Drawing stroke is empty.");
        }

        activeMap.drawings = sanitizeDrawings(
          [...activeMap.drawings, ...strokes],
          activeMap.drawings
        );
      });

      await broadcastCampaignToRoom(campaignId);
      return;
    }

    if (payload.type === "drawing:update") {
      await mutateDatabase((database) => {
        const { campaign, role } = requireCampaignMember(database, campaignId, user.id);
        const activeMap = requireActiveMap(campaign);

        if (payload.mapId !== activeMap.id) {
          throw new HttpError(403, "Drawings can only be edited on the active map.");
        }

        const nextDrawings = [...activeMap.drawings];

        for (const update of payload.drawings.slice(0, 100)) {
          const drawingIndex = nextDrawings.findIndex((entry) => entry.id === update.id);

          if (drawingIndex < 0) {
            continue;
          }

          const existing = nextDrawings[drawingIndex];

          if (!canManageDrawing(role, user.id, existing)) {
            throw new HttpError(403, "You can only edit your own drawings.");
          }

          const [sanitized] = sanitizeDrawings(
            [
              {
                ...existing,
                points: update.points,
                rotation: update.rotation
              }
            ],
            [existing]
          );

          if (!sanitized) {
            throw new HttpError(400, "Drawing update is invalid.");
          }

          nextDrawings[drawingIndex] = {
            ...sanitized,
            ownerId: existing.ownerId
          };
        }

        activeMap.drawings = nextDrawings;
      });

      await broadcastCampaignToRoom(campaignId);
      return;
    }

    if (payload.type === "drawing:delete") {
      await mutateDatabase((database) => {
        const { campaign, role } = requireCampaignMember(database, campaignId, user.id);
        const activeMap = requireActiveMap(campaign);

        if (payload.mapId !== activeMap.id) {
          throw new HttpError(403, "Drawings can only be removed from the active map.");
        }

        const drawingIds = new Set(payload.drawingIds.slice(0, 300));

        for (const drawing of activeMap.drawings) {
          if (!drawingIds.has(drawing.id)) {
            continue;
          }

          if (!canManageDrawing(role, user.id, drawing)) {
            throw new HttpError(403, "You can only delete your own drawings.");
          }
        }

        activeMap.drawings = activeMap.drawings.filter((drawing) => !drawingIds.has(drawing.id));
      });

      await broadcastCampaignToRoom(campaignId);
      return;
    }

    if (payload.type === "drawing:clear") {
      await mutateDatabase((database) => {
        const { campaign } = requireCampaignMember(database, campaignId, user.id);
        requireDungeonMaster(campaign, user.id);
        const activeMap = requireActiveMap(campaign);

        if (payload.mapId !== activeMap.id) {
          throw new HttpError(403, "Drawings can only be cleared from the active map.");
        }

        activeMap.drawings = [];
      });

      await broadcastCampaignToRoom(campaignId);
      return;
    }

    if (payload.type === "map:set-active") {
      await mutateDatabase((database) => {
        const { campaign } = requireCampaignMember(database, campaignId, user.id);
        requireDungeonMaster(campaign, user.id);

        if (!campaign.maps.some((entry) => entry.id === payload.mapId)) {
          throw new HttpError(404, "Map not found.");
        }

        campaign.activeMapId = payload.mapId;
        updateExplorationForCampaign(campaign);
      });

      await broadcastCampaignToRoom(campaignId);
      return;
    }

    if (payload.type === "map:ping") {
      const database = await readDatabase();
      const { campaign } = requireCampaignMember(database, campaignId, user.id);
      const activeMap = requireActiveMap(campaign);

      if (payload.mapId !== activeMap.id) {
        throw new HttpError(403, "Pinging is only available on the active map.");
      }

      const ping: MapPing = {
        id: payload.pingId ?? createId("png"),
        mapId: activeMap.id,
        point: payload.point,
        userId: user.id,
        userName: user.name,
        createdAt: now()
      };

      broadcastSocketMessageToRoom(campaignId, {
        type: "room:ping",
        ping
      });
      return;
    }

    if (payload.type === "map:ping-recall") {
      const database = await readDatabase();
      const { campaign } = requireCampaignMember(database, campaignId, user.id);
      requireDungeonMaster(campaign, user.id);
      const activeMap = requireActiveMap(campaign);

      if (payload.mapId !== activeMap.id) {
        throw new HttpError(403, "Pinging is only available on the active map.");
      }

      const recall: MapViewportRecall = {
        id: createId("rec"),
        mapId: activeMap.id,
        center: payload.center,
        zoom: payload.zoom
      };
      const ping: MapPing = {
        id: payload.pingId ?? createId("png"),
        mapId: activeMap.id,
        point: payload.point,
        userId: user.id,
        userName: user.name,
        createdAt: now()
      };

      broadcastSocketMessageToRoom(campaignId, {
        type: "room:view-recall",
        recall
      });
      broadcastSocketMessageToRoom(campaignId, {
        type: "room:ping",
        ping
      });
      return;
    }

    if (payload.type === "fog:reset") {
      await mutateDatabase((database) => {
        const { campaign } = requireCampaignMember(database, campaignId, user.id);
        requireDungeonMaster(campaign, user.id);
        resetFogForMap(campaign, payload.mapId);
      });

      await broadcastCampaignToRoom(campaignId);
      return;
    }

    if (payload.type === "door:toggle") {
      await mutateDatabase((database) => {
        const { campaign, role } = requireCampaignMember(database, campaignId, user.id);
        const activeMap = requireActiveMap(campaign);
        const door = activeMap.walls.find(
          (entry) => entry.id === payload.doorId && entry.kind === "door"
        );

        if (!door) {
          throw new HttpError(404, "Door not found.");
        }

        if (!canToggleDoor(role, user.id, campaign, activeMap, door)) {
          throw new HttpError(403, "Move a controlled character next to the door first.");
        }

        door.isOpen = !door.isOpen;
        updateExplorationForCampaign(campaign);
      });

      await broadcastCampaignToRoom(campaignId);
      return;
    }

    throw new HttpError(400, "Unsupported websocket message.");
  } catch (error) {
    sendSocketMessage(connection, {
      type: "room:error",
      message: error instanceof Error ? error.message : "Unexpected websocket error."
    });
  }
}
