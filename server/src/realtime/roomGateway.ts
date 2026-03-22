import type { Server } from "node:http";

import { WebSocket, WebSocketServer, type RawData } from "ws";

import { clientRoomMessageSchema, serverRoomMessageSchema } from "../../../shared/contracts/realtime.js";
import type {
  BoardToken,
  MapPing,
  MapViewportRecall,
  RoomDoorToggled,
  RoomPlayerVisionUpdate,
  RoomTokenMoved,
  ServerRoomMessage,
  TokenMovementPreview,
  UserProfile
} from "../../../shared/types.js";
import { snapPointToGrid, traceMovementPath } from "../../../shared/vision.js";
import { HttpError } from "../http/errors.js";
import { parseWithSchema } from "../http/validation.js";
import { runStoreQuery, runStoreTransaction } from "../store.js";
import {
  insertCampaignExplorationCells,
  readCampaignById,
  readRealtimeCampaign,
  updateCampaignDoorState,
  upsertCampaignToken
} from "../store/models/campaigns.js";
import { readCampaignCompendium } from "../store/models/compendium.js";
import { readSession, readUserById } from "../store/models/users.js";
import { createId, now, toUserProfile } from "../services/authService.js";
import {
  appendChatMessageCommand,
  appendRollMessageCommand,
  clearDrawingsCommand,
  createDrawingCommand,
  deleteDrawingsCommand,
  resetFogCommand,
  setActiveMapCommand,
  updateDrawingsCommand
} from "../services/campaignCommandService.js";
import {
  buildCampaignSnapshot,
  canManageActor,
  canToggleDoor,
  hasMapAssignment,
  normalizeExplorationMemoryForMap,
  requireActiveMap,
  requireCampaignRole,
  requireDungeonMaster,
  sanitizeMeasurePreview,
  updateExplorationForActorMove,
  updateExplorationForMap
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
        void runStoreQuery((database) => readCampaignById(database, connection.campaignId!))
          .then((campaign) => {

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
  const { campaign, compendium } = await runStoreQuery((database) => ({
    campaign: readCampaignById(database, campaignId),
    compendium: readCampaignCompendium(database)
  }));

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
      snapshot: buildCampaignSnapshot(campaign, connection.user, compendium)
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

function buildPlayerVisionUpdateForMap(
  campaign: Parameters<typeof buildCampaignSnapshot>[0],
  userId: string,
  mapId: string
): RoomPlayerVisionUpdate {
  const member = campaign.members.find((entry) => entry.userId === userId);

  return {
    mapId,
    cells: member?.role === "dm" ? [] : normalizeExplorationMemoryForMap(campaign, userId, mapId)
  };
}

function captureExplorationForMap(campaign: Parameters<typeof buildCampaignSnapshot>[0], mapId: string) {
  const snapshot = new Map<string, string[]>();

  for (const member of campaign.members) {
    if (member.role !== "player") {
      continue;
    }

    snapshot.set(member.userId, normalizeExplorationMemoryForMap(campaign, member.userId, mapId));
  }

  return snapshot;
}

function persistExplorationDeltaForMap(
  campaignId: string,
  campaign: Parameters<typeof buildCampaignSnapshot>[0],
  mapId: string,
  previous: Map<string, string[]>,
  database: Parameters<typeof readRealtimeCampaign>[0]
) {
  for (const member of campaign.members) {
    if (member.role !== "player") {
      continue;
    }

    const priorCells = new Set(previous.get(member.userId) ?? []);
    const nextCells = normalizeExplorationMemoryForMap(campaign, member.userId, mapId).filter(
      (cell) => !priorCells.has(cell)
    );

    if (nextCells.length === 0) {
      continue;
    }

    insertCampaignExplorationCells(database, campaignId, member.userId, mapId, nextCells);
  }
}

function broadcastTokenMovedToRoom(
  campaignId: string,
  campaign: Parameters<typeof buildCampaignSnapshot>[0],
  token: BoardToken,
  mapId: string
) {
  for (const connection of roomConnections) {
    if (!connection.user || connection.campaignId !== campaignId) {
      continue;
    }

    const update: RoomTokenMoved = {
      token,
      playerVision: buildPlayerVisionUpdateForMap(campaign, connection.user.id, mapId)
    };

    sendSocketMessage(connection, {
      type: "room:token-moved",
      update
    });
  }
}

function broadcastDoorToggledToRoom(campaignId: string, campaign: Parameters<typeof buildCampaignSnapshot>[0], update: Omit<RoomDoorToggled, "playerVision">) {
  for (const connection of roomConnections) {
    if (!connection.user || connection.campaignId !== campaignId) {
      continue;
    }

    sendSocketMessage(connection, {
      type: "room:door-toggled",
      update: {
        ...update,
        playerVision: buildPlayerVisionUpdateForMap(campaign, connection.user.id, update.mapId)
      }
    });
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
      const { session, userRecord, campaign, compendium } = await runStoreQuery((database) => {
        const session = readSession(database, payload.token);
        const userRecord = session ? readUserById(database, session.userId) : null;
        const campaign = readCampaignById(database, payload.campaignId);

        return {
          session,
          userRecord,
          campaign,
          compendium: readCampaignCompendium(database)
        };
      });

      if (!session || !userRecord) {
        throw new HttpError(401, "Authentication required.");
      }

      const user = toUserProfile(userRecord);

      if (!campaign) {
        throw new HttpError(404, "Campaign not found.");
      }

      if (!campaign.members.some((entry) => entry.userId === user.id)) {
        throw new HttpError(403, "You do not have access to that campaign.");
      }

      connection.user = user;
      connection.campaignId = campaign.id;

      sendSocketMessage(connection, {
        type: "room:joined",
        campaignId: campaign.id
      });
      sendSocketMessage(connection, {
        type: "room:snapshot",
        snapshot: buildCampaignSnapshot(campaign, user, compendium)
      });
      return;
    }

    const { user, campaignId } = requireJoinedConnection(connection);

    if (payload.type === "chat:send") {
      await appendChatMessageCommand({
        campaignId,
        user,
        text: payload.text
      });

      await broadcastCampaignToRoom(campaignId);
      return;
    }

    if (payload.type === "roll:send") {
      await appendRollMessageCommand({
        campaignId,
        user,
        notation: payload.notation,
        label: payload.label,
        actorId: payload.actorId ?? undefined
      });

      await broadcastCampaignToRoom(campaignId);
      return;
    }

    if (payload.type === "token:move") {
      const { campaign, token, activeMapId } = await runStoreTransaction((database) => {
        const campaign = readRealtimeCampaign(database, campaignId);

        if (!campaign) {
          throw new HttpError(404, "Campaign not found.");
        }

        const role = requireCampaignRole(campaign, user.id);
        const activeMap = requireActiveMap(campaign);
        const activeMapId = activeMap.id;
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
        const previousExploration = captureExplorationForMap(campaign, activeMap.id);
        const existing = campaign.tokens.find(
          (entry) => entry.actorId === actor.id && entry.mapId === activeMap.id
        );
        let token: BoardToken;

        if (existing) {
          const trace = traceMovementPath(activeMap, { x: existing.x, y: existing.y }, snapped, {
            ignoreWalls: role === "dm"
          });
          existing.x = trace.end.x;
          existing.y = trace.end.y;
          token = existing;
        } else {
          token = {
            id: createId("tok"),
            actorId: actor.id,
            actorKind: actor.kind,
            mapId: activeMap.id,
            x: snapped.x,
            y: snapped.y,
            size: 1,
            color: actor.color,
            label: actor.name,
            imageUrl: actor.imageUrl,
            visible: true
          };

          campaign.tokens.push(token);
        }

        updateExplorationForActorMove(campaign, activeMap.id, actor.id);
        upsertCampaignToken(database, campaignId, token);
        persistExplorationDeltaForMap(campaignId, campaign, activeMap.id, previousExploration, database);
        return {
          campaign,
          token: { ...token },
          activeMapId
        };
      });

      broadcastSocketMessageToRoom(campaignId, {
        type: "room:token-preview",
        actorId: payload.actorId,
        mapId: activeMapId,
        preview: null
      });
      broadcastTokenMovedToRoom(campaignId, campaign, token, activeMapId);
      return;
    }

    if (payload.type === "token:preview") {
      const campaign = await runStoreQuery((database) => readRealtimeCampaign(database, campaignId));

      if (!campaign) {
        throw new HttpError(404, "Campaign not found.");
      }

      const role = requireCampaignRole(campaign, user.id);
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
        steps: trace.steps,
        teleported: trace.teleported,
        teleportEntry: trace.teleportEntry
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
      const campaign = await runStoreQuery((database) => readRealtimeCampaign(database, campaignId));

      if (!campaign) {
        throw new HttpError(404, "Campaign not found.");
      }

      requireCampaignRole(campaign, user.id);
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
      await createDrawingCommand({
        campaignId,
        userId: user.id,
        mapId: payload.mapId,
        stroke: payload.stroke
      });

      await broadcastCampaignToRoom(campaignId);
      return;
    }

    if (payload.type === "drawing:update") {
      await updateDrawingsCommand({
        campaignId,
        userId: user.id,
        mapId: payload.mapId,
        drawings: payload.drawings
      });

      await broadcastCampaignToRoom(campaignId);
      return;
    }

    if (payload.type === "drawing:delete") {
      await deleteDrawingsCommand({
        campaignId,
        userId: user.id,
        mapId: payload.mapId,
        drawingIds: payload.drawingIds
      });

      await broadcastCampaignToRoom(campaignId);
      return;
    }

    if (payload.type === "drawing:clear") {
      await clearDrawingsCommand({
        campaignId,
        userId: user.id,
        mapId: payload.mapId
      });

      await broadcastCampaignToRoom(campaignId);
      return;
    }

    if (payload.type === "map:set-active") {
      await setActiveMapCommand({
        campaignId,
        userId: user.id,
        mapId: payload.mapId
      });

      await broadcastCampaignToRoom(campaignId);
      return;
    }

    if (payload.type === "map:ping") {
      const campaign = await runStoreQuery((database) => readRealtimeCampaign(database, campaignId));

      if (!campaign) {
        throw new HttpError(404, "Campaign not found.");
      }

      requireCampaignRole(campaign, user.id);
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
      const campaign = await runStoreQuery((database) => readRealtimeCampaign(database, campaignId));

      if (!campaign) {
        throw new HttpError(404, "Campaign not found.");
      }

      requireCampaignRole(campaign, user.id);
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
      await resetFogCommand({
        campaignId,
        userId: user.id,
        mapId: payload.mapId
      });

      await broadcastCampaignToRoom(campaignId);
      return;
    }

    if (payload.type === "door:toggle") {
      const { campaign, activeMapId, doorId, isOpen } = await runStoreTransaction((database) => {
        const campaign = readRealtimeCampaign(database, campaignId);

        if (!campaign) {
          throw new HttpError(404, "Campaign not found.");
        }

        const role = requireCampaignRole(campaign, user.id);
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

        const previousExploration = captureExplorationForMap(campaign, activeMap.id);
        door.isOpen = !door.isOpen;
        updateCampaignDoorState(database, door.id, door.isOpen);
        updateExplorationForMap(campaign, activeMap.id);
        persistExplorationDeltaForMap(campaignId, campaign, activeMap.id, previousExploration, database);
        return {
          campaign,
          activeMapId: activeMap.id,
          doorId: door.id,
          isOpen: door.isOpen
        };
      });

      broadcastDoorToggledToRoom(campaignId, campaign, {
        mapId: activeMapId,
        doorId,
        isOpen
      });
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
