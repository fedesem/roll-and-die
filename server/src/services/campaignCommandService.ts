import type { DatabaseSync } from "node:sqlite";

import type { Campaign, CampaignInvite, ChatMessage, DrawingStroke } from "../../../shared/types.js";
import { snapPointToGrid, traceMovementPath } from "../../../shared/vision.js";
import { parseRollCommand, rollDice } from "../dice.js";
import { HttpError } from "../http/errors.js";
import { runStoreQuery, runStoreTransaction } from "../store.js";
import { externalizeImageUrl } from "./assetStorage.js";
import {
  clearMapDrawingRecords,
  clearMapExploration,
  deleteActorRecord,
  deleteCampaignInviteByCode,
  deleteDrawingRecords,
  deleteMapAssignmentRecord,
  deleteTokenRecord,
  deleteTokensForActorOnMap,
  incrementMapVisibilityVersion,
  insertCampaignInviteRecord,
  insertCampaignMemberRecord,
  insertCampaignRecord,
  insertChatMessageRecord,
  insertDrawingRecord,
  insertMapAssignmentRecord,
  readActorById,
  readCampaignBoardState,
  readCampaignCoreById,
  readCampaignInviteByCodeRecord,
  readCampaignRoleForUser,
  readCampaignSummaryForUser,
  readChatActorContextById,
  readMapAssignment,
  readMapAssignmentsForActor,
  readMapEditorMap,
  readMapExists,
  readTokenById,
  readTokensForActor,
  replaceMapExploration,
  trimCampaignChatRecords,
  updateCampaignActiveMap,
  upsertActorRecord,
  upsertCampaignToken,
  upsertMapRecord,
  updateDrawingRecord
} from "../store/models/campaigns.js";
import { readCompendiumSourceBooks, readMonsterTemplateById } from "../store/models/compendium.js";
import { createId, now } from "./authService.js";
import {
  applyActorPatch,
  applyMapPatch,
  canManageActor,
  canManageDrawing,
  createDefaultActor,
  createDefaultMap,
  createMonsterActor,
  createSystemMessage,
  randomInviteCode,
  sanitizeDrawings,
  syncActorTokens,
  updateExplorationForMap
} from "./campaignDomain.js";

function runCampaignTransaction<T>(campaignId: string, task: (database: DatabaseSync) => Promise<T> | T) {
  return runStoreTransaction(task, { queueKey: `campaign:${campaignId}` });
}

function requireCampaignCore(database: DatabaseSync, campaignId: string) {
  const campaign = readCampaignCoreById(database, campaignId);

  if (!campaign) {
    throw new HttpError(404, "Campaign not found.");
  }

  return campaign;
}

function requireCampaignMemberRole(database: DatabaseSync, campaignId: string, userId: string) {
  const role = readCampaignRoleForUser(database, campaignId, userId);

  if (role) {
    return role;
  }

  requireCampaignCore(database, campaignId);
  throw new HttpError(403, "You do not have access to that campaign.");
}

function requireDungeonMasterForCampaign(database: DatabaseSync, campaignId: string, userId: string) {
  const role = requireCampaignMemberRole(database, campaignId, userId);

  if (role !== "dm") {
    throw new HttpError(403, "Only the DM can perform that action.");
  }

  return role;
}

function readBoardStateForMapIds(database: DatabaseSync, campaignId: string, mapIds: string[]) {
  const campaign = readCampaignBoardState(database, campaignId, mapIds);

  if (!campaign) {
    throw new HttpError(404, "Campaign not found.");
  }

  return campaign;
}

function persistExplorationForMapIds(database: DatabaseSync, campaign: Campaign, mapIds: string[]) {
  const uniqueMapIds = Array.from(new Set(mapIds.filter((entry) => typeof entry === "string" && entry.length > 0)));

  for (const mapId of uniqueMapIds) {
    replaceMapExploration(database, campaign.id, mapId, campaign.exploration);
  }
}

export async function createCampaignCommand(params: {
  user: { id: string; name: string; email: string };
  name: string;
  allowedSourceBooks: string[];
}) {
  return runStoreTransaction((database) => {
    const availableBooks = new Set(readCompendiumSourceBooks(database).map((entry) => entry.source));
    const campaignId = createId("cmp");
    const initialMap = createDefaultMap("Main Map");
    const campaign: Campaign = {
      id: campaignId,
      name: params.name,
      createdAt: now(),
      createdBy: params.user.id,
      activeMapId: initialMap.id,
      allowedSourceBooks: params.allowedSourceBooks.filter((entry) => availableBooks.has(entry)),
      members: [
        {
          userId: params.user.id,
          name: params.user.name,
          email: params.user.email,
          role: "dm"
        }
      ],
      invites: [],
      actors: [],
      maps: [initialMap],
      mapAssignments: [],
      tokens: [],
      exploration: {},
      chat: [
        createSystemMessage(
          createId("msg"),
          { ...params.user, isAdmin: false },
          campaignId,
          `${params.user.name} founded the campaign.`
        )
      ]
    };

    insertCampaignRecord(database, campaign);
    return campaign;
  });
}

export async function acceptInviteCommand(params: {
  user: { id: string; name: string; email: string };
  code: string;
}) {
  return runStoreTransaction((database) => {
    const normalizedCode = params.code.toUpperCase();
    const invite = readCampaignInviteByCodeRecord(database, normalizedCode);

    if (!invite) {
      throw new HttpError(404, "Invite code not found.");
    }

    let joinMessage: ChatMessage | null = null;

    if (!readCampaignRoleForUser(database, invite.campaignId, params.user.id)) {
      insertCampaignMemberRecord(database, invite.campaignId, {
        userId: params.user.id,
        name: params.user.name,
        email: params.user.email,
        role: invite.role
      });
      deleteCampaignInviteByCode(database, normalizedCode);
      joinMessage = createSystemMessage(
        createId("msg"),
        { ...params.user, isAdmin: false },
        invite.campaignId,
        `${params.user.name} joined as ${invite.role.toUpperCase()}.`
      );
      insertChatMessageRecord(database, joinMessage);
    }

    const summary = readCampaignSummaryForUser(database, invite.campaignId, params.user.id);

    if (!summary) {
      throw new HttpError(404, "Campaign not found.");
    }

    return {
      campaignId: invite.campaignId,
      summary,
      joinMessage
    };
  });
}

export async function createInviteCommand(params: {
  campaignId: string;
  userId: string;
  label: string;
  role: CampaignInvite["role"];
}) {
  return runCampaignTransaction(params.campaignId, (database) => {
    requireDungeonMasterForCampaign(database, params.campaignId, params.userId);

    const invite: CampaignInvite = {
      id: createId("inv"),
      code: randomInviteCode(),
      label: params.label,
      role: params.role,
      createdAt: now(),
      createdBy: params.userId
    };

    insertCampaignInviteRecord(database, params.campaignId, invite);
    return invite;
  });
}

export async function createActorCommand(params: {
  campaignId: string;
  user: { id: string };
  name: string;
  kind: "character" | "npc" | "monster" | "static";
}) {
  return runCampaignTransaction(params.campaignId, (database) => {
    const role = requireCampaignMemberRole(database, params.campaignId, params.user.id);

    if (role !== "dm" && params.kind !== "character") {
      throw new HttpError(403, "Players can only create characters.");
    }

    const actor = createDefaultActor(params.campaignId, params.user.id, params.name, params.kind, role);
    upsertActorRecord(database, params.campaignId, actor);
    return actor;
  });
}

export async function updateActorCommand(params: {
  campaignId: string;
  actorId: string;
  userId: string;
  patch: unknown;
}) {
  const patch =
    params.patch && typeof params.patch === "object"
      ? {
          ...(params.patch as Record<string, unknown>),
          imageUrl:
            typeof (params.patch as { imageUrl?: unknown }).imageUrl === "string"
              ? await externalizeImageUrl((params.patch as { imageUrl: string }).imageUrl, "actors")
              : (params.patch as { imageUrl?: unknown }).imageUrl
        }
      : params.patch;

  return runCampaignTransaction(params.campaignId, (database) => {
    const role = requireCampaignMemberRole(database, params.campaignId, params.userId);
    const actor = readActorById(database, params.campaignId, params.actorId);

    if (!actor) {
      throw new HttpError(404, "Actor not found.");
    }

    if (!canManageActor(role, params.userId, actor)) {
      throw new HttpError(403, "You cannot edit that actor.");
    }

    applyActorPatch(actor, patch as Record<string, unknown>);
    upsertActorRecord(database, params.campaignId, actor);

    const affectedMapIds = Array.from(new Set(readTokensForActor(database, params.campaignId, actor.id).map((entry) => entry.mapId)));
    let syncedTokens = readTokensForActor(database, params.campaignId, actor.id);

    if (affectedMapIds.length > 0) {
      const campaign = readBoardStateForMapIds(database, params.campaignId, affectedMapIds);
      const actorIndex = campaign.actors.findIndex((entry) => entry.id === actor.id);

      if (actorIndex >= 0) {
        campaign.actors[actorIndex] = actor;
      } else {
        campaign.actors.push(actor);
      }

      syncActorTokens(campaign, actor);

      for (const mapId of affectedMapIds) {
        updateExplorationForMap(campaign, mapId);
      }

      syncedTokens = campaign.tokens.filter((entry) => entry.actorId === actor.id).map((entry) => ({ ...entry }));
      persistExplorationForMapIds(database, campaign, affectedMapIds);
    }

    for (const token of syncedTokens) {
      upsertCampaignToken(database, params.campaignId, token);
    }
    return {
      actor,
      tokens: syncedTokens
    };
  });
}

export async function createMonsterActorCommand(params: {
  campaignId: string;
  userId: string;
  templateId: string;
}) {
  const template = await runStoreQuery((database) => {
    const nextTemplate = readMonsterTemplateById(database, params.templateId);

    if (!nextTemplate) {
      throw new HttpError(404, "Monster template not found.");
    }

    return nextTemplate;
  });
  const imageUrl = await externalizeImageUrl(template.imageUrl, "actors");

  return runCampaignTransaction(params.campaignId, (database) => {
    requireDungeonMasterForCampaign(database, params.campaignId, params.userId);

    const actor = createMonsterActor(params.campaignId, params.userId, template);
    actor.imageUrl = imageUrl;
    upsertActorRecord(database, params.campaignId, actor);
    return actor;
  });
}

export async function deleteActorCommand(params: {
  campaignId: string;
  actorId: string;
  userId: string;
}) {
  return runCampaignTransaction(params.campaignId, (database) => {
    requireDungeonMasterForCampaign(database, params.campaignId, params.userId);
    const actor = readActorById(database, params.campaignId, params.actorId);

    if (!actor) {
      throw new HttpError(404, "Actor not found.");
    }

    if (actor.ownerId !== params.userId) {
      throw new HttpError(403, "You can only delete actors you own.");
    }

    const removedAssignments = readMapAssignmentsForActor(database, params.campaignId, params.actorId);
    const removedTokens = readTokensForActor(database, params.campaignId, params.actorId);
    const affectedMapIds = Array.from(new Set(removedTokens.map((entry) => entry.mapId)));

    deleteActorRecord(database, params.actorId);

    if (affectedMapIds.length > 0) {
      const campaign = readBoardStateForMapIds(database, params.campaignId, affectedMapIds);
      campaign.actors = campaign.actors.filter((entry) => entry.id !== params.actorId);
      campaign.mapAssignments = campaign.mapAssignments.filter((entry) => entry.actorId !== params.actorId);
      campaign.tokens = campaign.tokens.filter((entry) => entry.actorId !== params.actorId);

      for (const mapId of affectedMapIds) {
        updateExplorationForMap(campaign, mapId);
      }

      persistExplorationForMapIds(database, campaign, affectedMapIds);
    }

    return {
      actorId: params.actorId,
      assignmentKeys: removedAssignments.map((entry) => ({ mapId: entry.mapId, actorId: entry.actorId })),
      tokenIds: removedTokens.map((entry) => entry.id)
    };
  });
}

export async function createMapCommand(params: {
  campaignId: string;
  userId: string;
  body: unknown;
}) {
  const body =
    params.body && typeof params.body === "object"
      ? {
          ...(params.body as Record<string, unknown>),
          backgroundUrl:
            typeof (params.body as { backgroundUrl?: unknown }).backgroundUrl === "string"
              ? await externalizeImageUrl((params.body as { backgroundUrl: string }).backgroundUrl, "maps")
              : (params.body as { backgroundUrl?: unknown }).backgroundUrl
        }
      : params.body;

  return runCampaignTransaction(params.campaignId, (database) => {
    requireDungeonMasterForCampaign(database, params.campaignId, params.userId);

    const patchBody = body as Record<string, unknown>;
    const map = createDefaultMap(typeof patchBody.name === "string" ? patchBody.name : "Map");
    applyMapPatch(map, patchBody);
    upsertMapRecord(database, params.campaignId, map);
    return map;
  });
}

export async function updateMapCommand(params: {
  campaignId: string;
  mapId: string;
  userId: string;
  patch: unknown;
}) {
  const patch =
    params.patch && typeof params.patch === "object"
      ? {
          ...(params.patch as Record<string, unknown>),
          backgroundUrl:
            typeof (params.patch as { backgroundUrl?: unknown }).backgroundUrl === "string"
              ? await externalizeImageUrl((params.patch as { backgroundUrl: string }).backgroundUrl, "maps")
              : (params.patch as { backgroundUrl?: unknown }).backgroundUrl
        }
      : params.patch;

  return runCampaignTransaction(params.campaignId, (database) => {
    requireDungeonMasterForCampaign(database, params.campaignId, params.userId);
    const map = readMapEditorMap(database, params.campaignId, params.mapId);

    if (!map) {
      throw new HttpError(404, "Map not found.");
    }

    applyMapPatch(map, patch as Record<string, unknown>);
    upsertMapRecord(database, params.campaignId, map);

    const campaign = readBoardStateForMapIds(database, params.campaignId, [params.mapId]);
    const mapIndex = campaign.maps.findIndex((entry) => entry.id === map.id);

    if (mapIndex >= 0) {
      campaign.maps[mapIndex] = map;
      updateExplorationForMap(campaign, map.id);
      persistExplorationForMapIds(database, campaign, [map.id]);
    }

    return map;
  });
}

export async function assignActorToMapCommand(params: {
  campaignId: string;
  mapId: string;
  actorId: string;
  userId: string;
}) {
  return runCampaignTransaction(params.campaignId, (database) => {
    requireDungeonMasterForCampaign(database, params.campaignId, params.userId);

    if (!readMapExists(database, params.campaignId, params.mapId)) {
      throw new HttpError(404, "Map not found.");
    }

    if (!readChatActorContextById(database, params.campaignId, params.actorId)) {
      throw new HttpError(404, "Actor not found.");
    }

    if (!readMapAssignment(database, params.campaignId, params.mapId, params.actorId)) {
      insertMapAssignmentRecord(database, params.campaignId, {
        actorId: params.actorId,
        mapId: params.mapId
      });

      return {
        assigned: true,
        mapId: params.mapId,
        actorId: params.actorId
      };
    }

    return {
      assigned: false,
      mapId: params.mapId,
      actorId: params.actorId
    };
  });
}

export async function removeActorFromMapCommand(params: {
  campaignId: string;
  mapId: string;
  actorId: string;
  userId: string;
}) {
  return runCampaignTransaction(params.campaignId, (database) => {
    requireDungeonMasterForCampaign(database, params.campaignId, params.userId);

    if (!readMapExists(database, params.campaignId, params.mapId)) {
      throw new HttpError(404, "Map not found.");
    }

    if (!readChatActorContextById(database, params.campaignId, params.actorId)) {
      throw new HttpError(404, "Actor not found.");
    }

    if (!readMapAssignment(database, params.campaignId, params.mapId, params.actorId)) {
      throw new HttpError(404, "Actor is not assigned to that map.");
    }

    const removedTokens = readTokensForActor(database, params.campaignId, params.actorId).filter(
      (token) => token.actorId === params.actorId && token.mapId === params.mapId
    );

    deleteMapAssignmentRecord(database, params.campaignId, params.mapId, params.actorId);
    deleteTokensForActorOnMap(database, params.mapId, params.actorId);

    if (removedTokens.length > 0) {
      const campaign = readBoardStateForMapIds(database, params.campaignId, [params.mapId]);
      campaign.mapAssignments = campaign.mapAssignments.filter(
        (assignment) => !(assignment.actorId === params.actorId && assignment.mapId === params.mapId)
      );
      campaign.tokens = campaign.tokens.filter(
        (token) => !(token.actorId === params.actorId && token.mapId === params.mapId)
      );
      updateExplorationForMap(campaign, params.mapId);
      persistExplorationForMapIds(database, campaign, [params.mapId]);
    }

    return {
      mapId: params.mapId,
      actorId: params.actorId,
      tokenIds: removedTokens.map((entry) => entry.id)
    };
  });
}

export async function createTokenCommand(params: {
  campaignId: string;
  userId: string;
  actorId: string;
  mapId: string;
  x: number;
  y: number;
}) {
  return runCampaignTransaction(params.campaignId, (database) => {
    const campaignCore = requireCampaignCore(database, params.campaignId);
    const role = requireCampaignMemberRole(database, params.campaignId, params.userId);
    const campaign = readBoardStateForMapIds(database, params.campaignId, [params.mapId]);
    const actor = campaign.actors.find((entry) => entry.id === params.actorId);
    const map = campaign.maps.find((entry) => entry.id === params.mapId);

    if (!actor) {
      throw new HttpError(404, "Actor not found.");
    }

    if (!map) {
      throw new HttpError(404, "Map not found.");
    }

    if (map.id !== campaignCore.activeMapId) {
      throw new HttpError(403, "Tokens can only be placed on the active map.");
    }

    if (!canManageActor(role, params.userId, actor)) {
      throw new HttpError(403, "You cannot place that actor.");
    }

    if (!readMapAssignment(database, params.campaignId, params.mapId, params.actorId)) {
      throw new HttpError(403, "Assign the actor to that map first.");
    }

    const snapped = snapPointToGrid(map, { x: params.x, y: params.y });
    const existing = campaign.tokens.find(
      (entry) => entry.actorId === params.actorId && entry.mapId === params.mapId
    );
    const token =
      existing ??
      {
        id: createId("tok"),
        actorId: params.actorId,
        actorKind: actor.kind,
        mapId: params.mapId,
        x: snapped.x,
        y: snapped.y,
        size: 1,
        color: actor.color,
        label: actor.name,
        imageUrl: actor.imageUrl,
        visible: true
      };

    if (existing) {
      const trace = traceMovementPath(map, { x: existing.x, y: existing.y }, snapped, {
        ignoreWalls: role === "dm"
      });
      existing.x = trace.end.x;
      existing.y = trace.end.y;
    } else {
      campaign.tokens.push(token);
    }

    updateExplorationForMap(campaign, map.id);
    upsertCampaignToken(database, params.campaignId, existing ?? token);
    persistExplorationForMapIds(database, campaign, [map.id]);
    return existing ?? token;
  });
}

export async function updateTokenCommand(params: {
  campaignId: string;
  tokenId: string;
  userId: string;
  patch: {
    mapId?: string;
    x?: number;
    y?: number;
    size?: number;
    color?: string;
    label?: string;
    visible?: boolean;
  };
}) {
  return runCampaignTransaction(params.campaignId, (database) => {
    const campaignCore = requireCampaignCore(database, params.campaignId);
    const role = requireCampaignMemberRole(database, params.campaignId, params.userId);
    const token = readTokenById(database, params.campaignId, params.tokenId);

    if (!token) {
      throw new HttpError(404, "Token not found.");
    }

    const nextMapId = params.patch.mapId ?? token.mapId;
    const campaign = readBoardStateForMapIds(database, params.campaignId, [token.mapId, nextMapId]);
    const storedToken = campaign.tokens.find((entry) => entry.id === params.tokenId);
    const actor = campaign.actors.find((entry) => entry.id === token.actorId);

    if (!storedToken) {
      throw new HttpError(404, "Token not found.");
    }

    if (!actor) {
      throw new HttpError(404, "Actor not found.");
    }

    if (!canManageActor(role, params.userId, actor)) {
      throw new HttpError(403, "You cannot move that token.");
    }

    if (!readMapExists(database, params.campaignId, nextMapId)) {
      throw new HttpError(404, "Map not found.");
    }

    if (nextMapId !== campaignCore.activeMapId) {
      throw new HttpError(403, "Tokens can only move on the active map.");
    }

    const targetMap = campaign.maps.find((entry) => entry.id === nextMapId);

    if (!targetMap) {
      throw new HttpError(404, "Map not found.");
    }

    if (!readMapAssignment(database, params.campaignId, nextMapId, token.actorId)) {
      throw new HttpError(403, "Assign the actor to that map first.");
    }

    const previousMapId = storedToken.mapId;
    const snapped = snapPointToGrid(targetMap, {
      x: params.patch.x ?? storedToken.x,
      y: params.patch.y ?? storedToken.y
    });
    const trace =
      previousMapId === nextMapId
        ? traceMovementPath(targetMap, { x: storedToken.x, y: storedToken.y }, snapped, {
            ignoreWalls: role === "dm"
          })
        : { end: snapped };

    storedToken.x = trace.end.x;
    storedToken.y = trace.end.y;
    storedToken.size = params.patch.size ?? storedToken.size;
    storedToken.mapId = nextMapId;
    storedToken.color = params.patch.color ?? storedToken.color;
    storedToken.label = params.patch.label ?? storedToken.label;
    storedToken.visible = params.patch.visible ?? storedToken.visible;

    updateExplorationForMap(campaign, previousMapId);

    if (nextMapId !== previousMapId) {
      updateExplorationForMap(campaign, nextMapId);
    }

    upsertCampaignToken(database, params.campaignId, storedToken);
    persistExplorationForMapIds(database, campaign, [previousMapId, nextMapId]);
    return storedToken;
  });
}

export async function removeTokenCommand(params: {
  campaignId: string;
  tokenId: string;
  userId: string;
}) {
  return runCampaignTransaction(params.campaignId, (database) => {
    requireDungeonMasterForCampaign(database, params.campaignId, params.userId);
    const token = readTokenById(database, params.campaignId, params.tokenId);

    if (!token) {
      throw new HttpError(404, "Token not found.");
    }

    deleteTokenRecord(database, params.tokenId);

    const campaign = readBoardStateForMapIds(database, params.campaignId, [token.mapId]);
    campaign.tokens = campaign.tokens.filter((entry) => entry.id !== params.tokenId);
    updateExplorationForMap(campaign, token.mapId);
    persistExplorationForMapIds(database, campaign, [token.mapId]);

    return {
      tokenId: token.id,
      mapId: token.mapId
    };
  });
}

export async function appendChatMessageCommand(params: {
  campaignId: string;
  user: { id: string; name: string };
  text: string;
}) {
  return runCampaignTransaction(params.campaignId, (database) => {
    requireCampaignMemberRole(database, params.campaignId, params.user.id);

    const text = params.text.slice(0, 500);
    const rollCommand = parseRollCommand(text);
    const message: ChatMessage = rollCommand
      ? (() => {
          const roll = rollDice(rollCommand.expression, `${params.user.name} rolled`);

          return {
            id: createId("msg"),
            campaignId: params.campaignId,
            userId: params.user.id,
            userName: params.user.name,
            text: `${roll.label}: ${roll.notation}`,
            createdAt: now(),
            kind: "roll" as const,
            roll
          };
        })()
      : {
          id: createId("msg"),
          campaignId: params.campaignId,
          userId: params.user.id,
          userName: params.user.name,
          text,
          createdAt: now(),
          kind: "message"
        };

    insertChatMessageRecord(database, message);
    trimCampaignChatRecords(database, params.campaignId);
    return message;
  });
}

export async function appendRollMessageCommand(params: {
  campaignId: string;
  user: { id: string; name: string };
  notation: string;
  label: string;
  actorId?: string;
}) {
  return runCampaignTransaction(params.campaignId, (database) => {
    requireCampaignMemberRole(database, params.campaignId, params.user.id);
    const roll = rollDice(params.notation, params.label);
    const actor = params.actorId ? readChatActorContextById(database, params.campaignId, params.actorId) ?? undefined : undefined;
    const message: ChatMessage = {
      id: createId("msg"),
      campaignId: params.campaignId,
      userId: params.user.id,
      userName: params.user.name,
      text: `${params.label}: ${roll.notation}`,
      createdAt: now(),
      kind: "roll",
      actor,
      roll
    };

    insertChatMessageRecord(database, message);
    trimCampaignChatRecords(database, params.campaignId);
    return message;
  });
}

export async function createDrawingCommand(params: {
  campaignId: string;
  userId: string;
  mapId: string;
  stroke: DrawingStroke;
}) {
  return runCampaignTransaction(params.campaignId, (database) => {
    requireCampaignMemberRole(database, params.campaignId, params.userId);
    const activeMapId = requireCampaignCore(database, params.campaignId).activeMapId;

    if (params.mapId !== activeMapId) {
      throw new HttpError(403, "Drawings can only be added to the active map.");
    }

    const strokes = sanitizeDrawings([{ ...params.stroke, ownerId: params.userId }], []);

    if (strokes.length === 0) {
      throw new HttpError(400, "Drawing stroke is empty.");
    }

    for (const stroke of strokes) {
      insertDrawingRecord(database, activeMapId, stroke);
    }
  });
}

export async function updateDrawingsCommand(params: {
  campaignId: string;
  userId: string;
  mapId: string;
  drawings: Array<{ id: string; points: DrawingStroke["points"]; rotation: number }>;
}) {
  return runCampaignTransaction(params.campaignId, (database) => {
    const role = requireCampaignMemberRole(database, params.campaignId, params.userId);
    const activeMapId = requireCampaignCore(database, params.campaignId).activeMapId;
    const activeMap = readMapEditorMap(database, params.campaignId, activeMapId);

    if (!activeMap) {
      throw new HttpError(404, "Map not found.");
    }

    if (params.mapId !== activeMap.id) {
      throw new HttpError(403, "Drawings can only be edited on the active map.");
    }

    for (const update of params.drawings.slice(0, 100)) {
      const existing = activeMap.drawings.find((entry) => entry.id === update.id);

      if (!existing) {
        continue;
      }

      if (!canManageDrawing(role, params.userId, existing)) {
        throw new HttpError(403, "You can only edit your own drawings.");
      }

      const [sanitized] = sanitizeDrawings(
        [{ ...existing, points: update.points, rotation: update.rotation }],
        [existing]
      );

      if (!sanitized) {
        throw new HttpError(400, "Drawing update is invalid.");
      }

      updateDrawingRecord(database, { ...sanitized, ownerId: existing.ownerId });
    }
  });
}

export async function deleteDrawingsCommand(params: {
  campaignId: string;
  userId: string;
  mapId: string;
  drawingIds: string[];
}) {
  return runCampaignTransaction(params.campaignId, (database) => {
    const role = requireCampaignMemberRole(database, params.campaignId, params.userId);
    const activeMapId = requireCampaignCore(database, params.campaignId).activeMapId;
    const activeMap = readMapEditorMap(database, params.campaignId, activeMapId);

    if (!activeMap) {
      throw new HttpError(404, "Map not found.");
    }

    if (params.mapId !== activeMap.id) {
      throw new HttpError(403, "Drawings can only be removed from the active map.");
    }

    const drawingIds = new Set(params.drawingIds.slice(0, 300));

    for (const drawing of activeMap.drawings) {
      if (!drawingIds.has(drawing.id)) {
        continue;
      }

      if (!canManageDrawing(role, params.userId, drawing)) {
        throw new HttpError(403, "You can only delete your own drawings.");
      }
    }

    deleteDrawingRecords(database, Array.from(drawingIds));
  });
}

export async function clearDrawingsCommand(params: {
  campaignId: string;
  userId: string;
  mapId: string;
}) {
  return runCampaignTransaction(params.campaignId, (database) => {
    requireDungeonMasterForCampaign(database, params.campaignId, params.userId);
    const activeMapId = requireCampaignCore(database, params.campaignId).activeMapId;

    if (params.mapId !== activeMapId) {
      throw new HttpError(403, "Drawings can only be cleared from the active map.");
    }

    clearMapDrawingRecords(database, activeMapId);
  });
}

export async function setActiveMapCommand(params: {
  campaignId: string;
  userId: string;
  mapId: string;
}) {
  return runCampaignTransaction(params.campaignId, (database) => {
    requireDungeonMasterForCampaign(database, params.campaignId, params.userId);

    if (!readMapExists(database, params.campaignId, params.mapId)) {
      throw new HttpError(404, "Map not found.");
    }

    const campaign = readBoardStateForMapIds(database, params.campaignId, [params.mapId]);
    campaign.activeMapId = params.mapId;
    updateExplorationForMap(campaign, params.mapId);
    updateCampaignActiveMap(database, params.campaignId, params.mapId);
    persistExplorationForMapIds(database, campaign, [params.mapId]);
  });
}

export async function resetFogCommand(params: {
  campaignId: string;
  userId: string;
  mapId: string;
}) {
  return runCampaignTransaction(params.campaignId, (database) => {
    requireDungeonMasterForCampaign(database, params.campaignId, params.userId);

    if (!readMapExists(database, params.campaignId, params.mapId)) {
      throw new HttpError(404, "Map not found.");
    }

    clearMapExploration(database, params.campaignId, params.mapId);
    incrementMapVisibilityVersion(database, params.mapId);
  });
}
