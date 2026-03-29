import type { Server } from "node:http";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { clientRoomMessageSchema, serverRoomMessageSchema } from "../../../shared/contracts/realtime.js";
import type {
  ActorSheet,
  BoardToken,
  CampaignInvite,
  CampaignMap,
  CampaignMember,
  ChatMessage,
  MapPing,
  MapViewportRecall,
  MapActorAssignment,
  MemberRole,
  RoomCampaignPatch,
  RoomDoorToggled,
  RoomPlayerVisionUpdate,
  RoomTokenMoved,
  ServerRoomMessage,
  TokenMovementPreview,
  UserProfile
} from "../../../shared/types.js";
import { getActorTokenFootprint, snapTokenToGrid } from "../../../shared/tokenGeometry.js";
import { traceMovementPath } from "../../../shared/vision.js";
import { isPlayerOwnedActor } from "../../../shared/campaignActors.js";
import { HttpError } from "../http/errors.js";
import { parseWithSchema } from "../http/validation.js";
import { runStoreQuery, runStoreTransaction } from "../store.js";
import {
  insertCampaignExplorationCells,
  readActiveBoardCampaign,
  readCampaignActiveMapId,
  readCampaignSnapshotById,
  readMapEditorMap,
  updateCampaignDoorState,
  upsertCampaignToken
} from "../store/models/campaigns.js";
import { readSession, readUserById } from "../store/models/users.js";
import { createId, now, toUserProfile } from "../services/authService.js";
import {
  appendChatMessageCommand,
  appendRollMessageCommand,
  clearDrawingsCommand,
  clearFogCommand,
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
import { readRoomCompendiumCache } from "../services/roomCompendiumCache.js";
interface RoomConnection {
  socket: WebSocket;
  user?: UserProfile;
  campaignId?: string;
  role?: MemberRole;
}
const roomConnections = new Set<RoomConnection>();
export function createRoomGateway(httpServer: Server) {
  const websocketServer = new WebSocketServer({ server: httpServer, path: "/ws" });
  websocketServer.on("connection", (socket: WebSocket) => {
    const connection: RoomConnection = { socket };
    roomConnections.add(connection);
    socket.on("message", async (payload: RawData) => {
      void handleSocketMessage(connection, String(payload));
    });
    socket.on("close", async () => {
      if (connection.user && connection.campaignId) {
        void runStoreQuery(async (database) => await readCampaignActiveMapId(database, connection.campaignId!), {
          queueKey: `campaign:${connection.campaignId!}`
        })
          .then((activeMapId) => {
            if (!activeMapId) {
              return;
            }
            broadcastSocketMessageToRoom(connection.campaignId!, {
              type: "room:measure-preview",
              userId: connection.user!.id,
              mapId: activeMapId,
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
  const [campaign, compendium] = await Promise.all([
    await runStoreQuery(async (database) => await readCampaignSnapshotById(database, campaignId), { queueKey: `campaign:${campaignId}` }),
    await readRoomCompendiumCache()
  ]);
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
function hasCampaignPatchContent(patch: RoomCampaignPatch) {
  return Object.values(patch).some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return value !== undefined;
  });
}
function broadcastCampaignPatchToRoom(campaignId: string, buildPatch: (connection: RoomConnection) => RoomCampaignPatch | null) {
  for (const connection of roomConnections) {
    if (!connection.user || connection.campaignId !== campaignId) {
      continue;
    }
    const patch = buildPatch(connection);
    if (!patch || !hasCampaignPatchContent(patch)) {
      continue;
    }
    sendSocketMessage(connection, {
      type: "room:campaign-patch",
      patch
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
function buildVisibleActorForConnection(connection: RoomConnection, actor: ActorSheet) {
  if (!connection.user || !connection.role) {
    return null;
  }
  if (connection.role === "dm" || actor.ownerId === connection.user.id) {
    return {
      ...actor,
      sheetAccess: "full"
    } satisfies ActorSheet;
  }
  return null;
}
export function broadcastChatAppendedToRoom(campaignId: string, message: ChatMessage) {
  broadcastCampaignPatchToRoom(campaignId, () => ({
    chatAppended: [message]
  }));
}
export function broadcastCampaignMembershipToRoom(campaignId: string, members: CampaignMember[], invites: CampaignInvite[]) {
  broadcastCampaignPatchToRoom(campaignId, () => ({
    members,
    invites
  }));
}
export function broadcastActorUpsertToRoom(campaignId: string, actor: ActorSheet) {
  broadcastCampaignPatchToRoom(campaignId, (connection) => {
    const visibleActor = buildVisibleActorForConnection(connection, actor);
    return visibleActor
      ? {
          actorsUpsert: [visibleActor]
        }
      : null;
  });
}
export function broadcastActorRemovedToRoom(
  campaignId: string,
  actorId: string,
  options?: {
    mapAssignmentsRemoved?: Array<{
      mapId: string;
      actorId: string;
    }>;
    tokenIdsRemoved?: string[];
  }
) {
  broadcastCampaignPatchToRoom(campaignId, () => ({
    actorIdsRemoved: [actorId],
    mapAssignmentsRemoved: options?.mapAssignmentsRemoved,
    tokenIdsRemoved: options?.tokenIdsRemoved
  }));
}
export function broadcastActorUpdatedToRoom(campaignId: string, actor: ActorSheet, tokens: BoardToken[]) {
  broadcastCampaignPatchToRoom(campaignId, (connection) => {
    const visibleActor = buildVisibleActorForConnection(connection, actor);
    return {
      actorsUpsert: visibleActor ? [visibleActor] : undefined,
      tokensUpsert: tokens
    };
  });
}
export function broadcastMapUpsertToRoom(
  campaignId: string,
  map: CampaignMap,
  options?: {
    activeMapId?: string;
    playerVision?: (connection: RoomConnection) => RoomPlayerVisionUpdate | undefined;
  }
) {
  broadcastCampaignPatchToRoom(campaignId, (connection) => ({
    activeMapId: options?.activeMapId,
    mapsUpsert: [map],
    playerVision: options?.playerVision?.(connection)
  }));
}
export function broadcastMapAssignmentsToRoom(
  campaignId: string,
  patch: {
    upsert?: MapActorAssignment[];
    removed?: Array<{
      mapId: string;
      actorId: string;
    }>;
    tokenIdsRemoved?: string[];
  }
) {
  broadcastCampaignPatchToRoom(campaignId, () => ({
    mapAssignmentsUpsert: patch.upsert,
    mapAssignmentsRemoved: patch.removed,
    tokenIdsRemoved: patch.tokenIdsRemoved
  }));
}
export function broadcastTokenPatchToRoom(
  campaignId: string,
  patch: {
    tokensUpsert?: BoardToken[];
    tokenIdsRemoved?: string[];
    playerVision?: (connection: RoomConnection) => RoomPlayerVisionUpdate | undefined;
  }
) {
  broadcastCampaignPatchToRoom(campaignId, (connection) => ({
    tokensUpsert: patch.tokensUpsert,
    tokenIdsRemoved: patch.tokenIdsRemoved,
    playerVision: patch.playerVision?.(connection)
  }));
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
  database: Parameters<typeof readActiveBoardCampaign>[0]
) {
  for (const member of campaign.members) {
    if (member.role !== "player") {
      continue;
    }
    const priorCells = new Set(previous.get(member.userId) ?? []);
    const nextCells = normalizeExplorationMemoryForMap(campaign, member.userId, mapId).filter((cell) => !priorCells.has(cell));
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
function broadcastDoorToggledToRoom(
  campaignId: string,
  campaign: Parameters<typeof buildCampaignSnapshot>[0],
  update: Omit<RoomDoorToggled, "playerVision">
) {
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
      const [{ session, userRecord, campaign }, compendium] = await Promise.all([
        await runStoreQuery(
          async (database) => {
            const session = await readSession(database, payload.token);
            const userRecord = session ? await readUserById(database, session.userId) : null;
            const campaign = await readCampaignSnapshotById(database, payload.campaignId);
            return {
              session,
              userRecord,
              campaign
            };
          },
          { queueKey: `campaign:${payload.campaignId}` }
        ),
        await readRoomCompendiumCache()
      ]);
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
      connection.role = campaign.members.find((entry) => entry.userId === user.id)?.role;
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
      const message = await appendChatMessageCommand({
        campaignId,
        user,
        text: payload.text
      });
      broadcastChatAppendedToRoom(campaignId, message);
      return;
    }
    if (payload.type === "roll:send") {
      const message = await appendRollMessageCommand({
        campaignId,
        user,
        notation: payload.notation,
        label: payload.label,
        actorId: payload.actorId ?? undefined
      });
      broadcastChatAppendedToRoom(campaignId, message);
      return;
    }
    if (payload.type === "token:move") {
      const { campaign, token, activeMapId } = await runStoreTransaction(
        async (database) => {
          const campaign = await readActiveBoardCampaign(database, campaignId);
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
          const previousExploration = captureExplorationForMap(campaign, activeMap.id);
          const existing = campaign.tokens.find((entry) => entry.actorId === actor.id && entry.mapId === activeMap.id);
          const actorFootprint = getActorTokenFootprint(actor);
          const footprint = existing
            ? {
                widthSquares: existing.widthSquares,
                heightSquares: existing.heightSquares
              }
            : actorFootprint;
          const snapped = snapTokenToGrid(
            activeMap,
            {
              x: payload.x,
              y: payload.y
            },
            footprint
          );
          let token: BoardToken;
          if (existing) {
            const trace = traceMovementPath(activeMap, { x: existing.x, y: existing.y }, snapped, {
              ignoreWalls: role === "dm",
              footprint
            });
            existing.x = trace.end.x;
            existing.y = trace.end.y;
            token = existing;
          } else {
            if (role !== "dm" && isPlayerOwnedActor(campaign, actor)) {
              throw new HttpError(403, "The DM must place that actor on the active map first.");
            }
            const placement = traceMovementPath(activeMap, snapped, snapped, {
              ignoreWalls: role === "dm",
              footprint
            });
            if (placement.blocked) {
              throw new HttpError(409, "That token cannot be placed there.");
            }
            token = {
              id: createId("tok"),
              actorId: actor.id,
              actorKind: actor.kind,
              mapId: activeMap.id,
              x: snapped.x,
              y: snapped.y,
              size: actorFootprint.size,
              widthSquares: actorFootprint.widthSquares,
              heightSquares: actorFootprint.heightSquares,
              rotationDegrees: 0,
              color: actor.color,
              label: actor.name,
              imageUrl: actor.imageUrl,
              visible: true,
              statusMarkers: []
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
        },
        { queueKey: `campaign:${campaignId}` }
      );
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
      const campaign = await runStoreQuery(async (database) => await readActiveBoardCampaign(database, campaignId), {
        queueKey: `campaign:${campaignId}`
      });
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
      const existing = campaign.tokens.find((entry) => entry.actorId === actor.id && entry.mapId === activeMap.id);
      if (!existing || !payload.target) {
        broadcastSocketMessageToRoom(campaignId, {
          type: "room:token-preview",
          actorId: actor.id,
          mapId: activeMap.id,
          preview: null
        });
        return;
      }
      const footprint = {
        widthSquares: existing.widthSquares,
        heightSquares: existing.heightSquares
      };
      const snapped = snapTokenToGrid(
        activeMap,
        {
          x: payload.target.x,
          y: payload.target.y
        },
        footprint
      );
      const trace = traceMovementPath(activeMap, { x: existing.x, y: existing.y }, snapped, {
        ignoreWalls: role === "dm",
        footprint
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
      const campaign = await runStoreQuery(async (database) => await readActiveBoardCampaign(database, campaignId), {
        queueKey: `campaign:${campaignId}`
      });
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
      const map = await runStoreQuery(async (database) => await readMapEditorMap(database, campaignId, payload.mapId), {
        queueKey: `campaign:${campaignId}`
      });
      if (map) {
        broadcastMapUpsertToRoom(campaignId, map);
      }
      return;
    }
    if (payload.type === "drawing:update") {
      await updateDrawingsCommand({
        campaignId,
        userId: user.id,
        mapId: payload.mapId,
        drawings: payload.drawings
      });
      const map = await runStoreQuery(async (database) => await readMapEditorMap(database, campaignId, payload.mapId), {
        queueKey: `campaign:${campaignId}`
      });
      if (map) {
        broadcastMapUpsertToRoom(campaignId, map);
      }
      return;
    }
    if (payload.type === "drawing:delete") {
      await deleteDrawingsCommand({
        campaignId,
        userId: user.id,
        mapId: payload.mapId,
        drawingIds: payload.drawingIds
      });
      const map = await runStoreQuery(async (database) => await readMapEditorMap(database, campaignId, payload.mapId), {
        queueKey: `campaign:${campaignId}`
      });
      if (map) {
        broadcastMapUpsertToRoom(campaignId, map);
      }
      return;
    }
    if (payload.type === "drawing:clear") {
      await clearDrawingsCommand({
        campaignId,
        userId: user.id,
        mapId: payload.mapId
      });
      const map = await runStoreQuery(async (database) => await readMapEditorMap(database, campaignId, payload.mapId), {
        queueKey: `campaign:${campaignId}`
      });
      if (map) {
        broadcastMapUpsertToRoom(campaignId, map);
      }
      return;
    }
    if (payload.type === "map:set-active") {
      await setActiveMapCommand({
        campaignId,
        userId: user.id,
        mapId: payload.mapId
      });
      const campaign = await runStoreQuery(async (database) => await readActiveBoardCampaign(database, campaignId), {
        queueKey: `campaign:${campaignId}`
      });
      if (!campaign) {
        throw new HttpError(404, "Campaign not found.");
      }
      const activeMap = requireActiveMap(campaign);
      broadcastCampaignPatchToRoom(campaignId, (connection) => ({
        activeMapId: activeMap.id,
        mapsUpsert: [activeMap],
        playerVision:
          connection.user && connection.role ? buildPlayerVisionUpdateForMap(campaign, connection.user.id, activeMap.id) : undefined
      }));
      return;
    }
    if (payload.type === "map:ping") {
      const campaign = await runStoreQuery(async (database) => await readActiveBoardCampaign(database, campaignId), {
        queueKey: `campaign:${campaignId}`
      });
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
      const campaign = await runStoreQuery(async (database) => await readActiveBoardCampaign(database, campaignId), {
        queueKey: `campaign:${campaignId}`
      });
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
      const campaign = await runStoreQuery(async (database) => await readActiveBoardCampaign(database, campaignId), {
        queueKey: `campaign:${campaignId}`
      });
      if (!campaign) {
        throw new HttpError(404, "Campaign not found.");
      }
      const map = requireActiveMap(campaign);
      broadcastCampaignPatchToRoom(campaignId, (connection) => ({
        mapsUpsert: [map],
        playerVision: connection.user && connection.role ? buildPlayerVisionUpdateForMap(campaign, connection.user.id, map.id) : undefined
      }));
      return;
    }
    if (payload.type === "fog:clear") {
      await clearFogCommand({
        campaignId,
        userId: user.id,
        mapId: payload.mapId
      });
      const campaign = await runStoreQuery(async (database) => await readActiveBoardCampaign(database, campaignId), {
        queueKey: `campaign:${campaignId}`
      });
      if (!campaign) {
        throw new HttpError(404, "Campaign not found.");
      }
      const map = requireActiveMap(campaign);
      broadcastCampaignPatchToRoom(campaignId, (connection) => ({
        mapsUpsert: [map],
        playerVision: connection.user && connection.role ? buildPlayerVisionUpdateForMap(campaign, connection.user.id, map.id) : undefined
      }));
      return;
    }
    if (payload.type === "door:toggle") {
      const { campaign, activeMapId, doorId, isOpen, isLocked } = await runStoreTransaction(
        async (database) => {
          const campaign = await readActiveBoardCampaign(database, campaignId);
          if (!campaign) {
            throw new HttpError(404, "Campaign not found.");
          }
          const role = requireCampaignRole(campaign, user.id);
          const activeMap = requireActiveMap(campaign);
          const door = activeMap.walls.find((entry) => entry.id === payload.doorId && entry.kind === "door");
          if (!door) {
            throw new HttpError(404, "Door not found.");
          }
          if (!canToggleDoor(role, user.id, campaign, activeMap, door)) {
            throw new HttpError(403, door.isLocked ? "Unlock the door first." : "Move a controlled actor next to the door first.");
          }
          const previousExploration = captureExplorationForMap(campaign, activeMap.id);
          door.isOpen = !door.isOpen;
          updateCampaignDoorState(database, door.id, door.isOpen, door.isLocked);
          updateExplorationForMap(campaign, activeMap.id);
          persistExplorationDeltaForMap(campaignId, campaign, activeMap.id, previousExploration, database);
          return {
            campaign,
            activeMapId: activeMap.id,
            doorId: door.id,
            isOpen: door.isOpen,
            isLocked: door.isLocked
          };
        },
        { queueKey: `campaign:${campaignId}` }
      );
      broadcastDoorToggledToRoom(campaignId, campaign, {
        mapId: activeMapId,
        doorId,
        isOpen,
        isLocked
      });
      return;
    }
    if (payload.type === "door:lock-toggle") {
      const { campaign, activeMapId, doorId, isOpen, isLocked } = await runStoreTransaction(
        async (database) => {
          const campaign = await readActiveBoardCampaign(database, campaignId);
          if (!campaign) {
            throw new HttpError(404, "Campaign not found.");
          }
          requireDungeonMaster(campaign, user.id);
          const activeMap = requireActiveMap(campaign);
          const door = activeMap.walls.find((entry) => entry.id === payload.doorId && entry.kind === "door");
          if (!door) {
            throw new HttpError(404, "Door not found.");
          }
          const previousExploration = captureExplorationForMap(campaign, activeMap.id);
          door.isLocked = !door.isLocked;
          if (door.isLocked) {
            door.isOpen = false;
          }
          updateCampaignDoorState(database, door.id, door.isOpen, door.isLocked);
          updateExplorationForMap(campaign, activeMap.id);
          persistExplorationDeltaForMap(campaignId, campaign, activeMap.id, previousExploration, database);
          return {
            campaign,
            activeMapId: activeMap.id,
            doorId: door.id,
            isOpen: door.isOpen,
            isLocked: door.isLocked
          };
        },
        { queueKey: `campaign:${campaignId}` }
      );
      broadcastDoorToggledToRoom(campaignId, campaign, {
        mapId: activeMapId,
        doorId,
        isOpen,
        isLocked
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
