import type { DatabaseSync } from "node:sqlite";

import type { Campaign, CampaignInvite, ChatMessage, DrawingStroke } from "../../../shared/types.js";
import { snapPointToGrid, traceMovementPath } from "../../../shared/vision.js";
import { parseRollCommand, rollDice } from "../dice.js";
import { HttpError } from "../http/errors.js";
import { runStoreTransaction } from "../store.js";
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
  readCampaignById,
  readCampaignByInviteCode,
  replaceCampaignExploration,
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
  hasMapAssignment,
  randomInviteCode,
  requireActiveMap,
  requireCampaignRole,
  requireDungeonMaster,
  resetFogForMap,
  resolveChatActorContext,
  sanitizeDrawings,
  syncActorTokens,
  updateExplorationForCampaign,
  updateExplorationForMap
} from "./campaignDomain.js";

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
    const campaign = readCampaignByInviteCode(database, normalizedCode);

    if (!campaign) {
      throw new HttpError(404, "Invite code not found.");
    }

    const invite = campaign.invites.find((entry) => entry.code === normalizedCode);

    if (!invite) {
      throw new HttpError(404, "Invite code not found.");
    }

    if (!campaign.members.some((member) => member.userId === params.user.id)) {
      insertCampaignMemberRecord(database, campaign.id, {
        userId: params.user.id,
        name: params.user.name,
        email: params.user.email,
        role: invite.role
      });
      deleteCampaignInviteByCode(database, normalizedCode);
      insertChatMessageRecord(
        database,
        createSystemMessage(
          createId("msg"),
          { ...params.user, isAdmin: false },
          campaign.id,
          `${params.user.name} joined as ${invite.role.toUpperCase()}.`
        )
      );

      campaign.members.push({
        userId: params.user.id,
        name: params.user.name,
        email: params.user.email,
        role: invite.role
      });
    }

    return campaign;
  });
}

export async function createInviteCommand(params: {
  campaignId: string;
  userId: string;
  label: string;
  role: CampaignInvite["role"];
}) {
  return runStoreTransaction((database) => {
    const campaign = requireStoredCampaign(database, params.campaignId);
    requireDungeonMaster(campaign, params.userId);

    const invite: CampaignInvite = {
      id: createId("inv"),
      code: randomInviteCode(),
      label: params.label,
      role: params.role,
      createdAt: now(),
      createdBy: params.userId
    };

    insertCampaignInviteRecord(database, campaign.id, invite);
    return invite;
  });
}

export async function createActorCommand(params: {
  campaignId: string;
  user: { id: string };
  name: string;
  kind: "character" | "npc" | "monster" | "static";
}) {
  return runStoreTransaction((database) => {
    const campaign = requireStoredCampaign(database, params.campaignId);
    const role = requireCampaignRole(campaign, params.user.id);

    if (role !== "dm" && params.kind !== "character") {
      throw new HttpError(403, "Players can only create characters.");
    }

    const actor = createDefaultActor(params.campaignId, params.user.id, params.name, params.kind, role);
    upsertActorRecord(database, campaign.id, actor);
    return actor;
  });
}

export async function updateActorCommand(params: {
  campaignId: string;
  actorId: string;
  userId: string;
  patch: unknown;
}) {
  return runStoreTransaction((database) => {
    const campaign = requireStoredCampaign(database, params.campaignId);
    const role = requireCampaignRole(campaign, params.userId);
    const actor = campaign.actors.find((entry) => entry.id === params.actorId);

    if (!actor) {
      throw new HttpError(404, "Actor not found.");
    }

    if (!canManageActor(role, params.userId, actor)) {
      throw new HttpError(403, "You cannot edit that actor.");
    }

    applyActorPatch(actor, params.patch as Record<string, unknown>);
    syncActorTokens(campaign, actor);
    updateExplorationForCampaign(campaign);

    upsertActorRecord(database, campaign.id, actor);

    for (const token of campaign.tokens.filter((entry) => entry.actorId === actor.id)) {
      upsertCampaignToken(database, campaign.id, token);
    }

    replaceCampaignExploration(database, campaign.id, campaign.exploration);
    return actor;
  });
}

export async function createMonsterActorCommand(params: {
  campaignId: string;
  userId: string;
  templateId: string;
}) {
  return runStoreTransaction((database) => {
    const campaign = requireStoredCampaign(database, params.campaignId);
    requireDungeonMaster(campaign, params.userId);

    const template = readMonsterTemplateById(database, params.templateId);

    if (!template) {
      throw new HttpError(404, "Monster template not found.");
    }

    const actor = createMonsterActor(params.campaignId, params.userId, template);
    upsertActorRecord(database, campaign.id, actor);
    return actor;
  });
}

export async function deleteActorCommand(params: {
  campaignId: string;
  actorId: string;
  userId: string;
}) {
  return runStoreTransaction((database) => {
    const campaign = requireStoredCampaign(database, params.campaignId);
    const role = requireCampaignRole(campaign, params.userId);

    if (role !== "dm") {
      throw new HttpError(403, "Only the DM can delete actors.");
    }

    const actor = campaign.actors.find((entry) => entry.id === params.actorId);

    if (!actor) {
      throw new HttpError(404, "Actor not found.");
    }

    if (actor.ownerId !== params.userId) {
      throw new HttpError(403, "You can only delete actors you own.");
    }

    campaign.actors = campaign.actors.filter((entry) => entry.id !== params.actorId);
    campaign.mapAssignments = campaign.mapAssignments.filter((entry) => entry.actorId !== params.actorId);
    campaign.tokens = campaign.tokens.filter((entry) => entry.actorId !== params.actorId);
    updateExplorationForCampaign(campaign);

    deleteActorRecord(database, params.actorId);
    replaceCampaignExploration(database, campaign.id, campaign.exploration);
  });
}

export async function createMapCommand(params: {
  campaignId: string;
  userId: string;
  body: unknown;
}) {
  return runStoreTransaction((database) => {
    const campaign = requireStoredCampaign(database, params.campaignId);
    requireDungeonMaster(campaign, params.userId);

    const body = params.body as Record<string, unknown>;
    const map = createDefaultMap(typeof body.name === "string" ? body.name : "Map");
    applyMapPatch(map, body);
    upsertMapRecord(database, campaign.id, map);
    return map;
  });
}

export async function updateMapCommand(params: {
  campaignId: string;
  mapId: string;
  userId: string;
  patch: unknown;
}) {
  return runStoreTransaction((database) => {
    const campaign = requireStoredCampaign(database, params.campaignId);
    requireDungeonMaster(campaign, params.userId);
    const map = campaign.maps.find((entry) => entry.id === params.mapId);

    if (!map) {
      throw new HttpError(404, "Map not found.");
    }

    applyMapPatch(map, params.patch as Record<string, unknown>);
    updateExplorationForCampaign(campaign);
    upsertMapRecord(database, campaign.id, map);
    replaceCampaignExploration(database, campaign.id, campaign.exploration);
    return map;
  });
}

export async function assignActorToMapCommand(params: {
  campaignId: string;
  mapId: string;
  actorId: string;
  userId: string;
}) {
  return runStoreTransaction((database) => {
    const campaign = requireStoredCampaign(database, params.campaignId);
    requireDungeonMaster(campaign, params.userId);

    if (!campaign.maps.some((entry) => entry.id === params.mapId)) {
      throw new HttpError(404, "Map not found.");
    }

    if (!campaign.actors.some((entry) => entry.id === params.actorId)) {
      throw new HttpError(404, "Actor not found.");
    }

    if (!hasMapAssignment(campaign, params.actorId, params.mapId)) {
      insertMapAssignmentRecord(database, campaign.id, {
        actorId: params.actorId,
        mapId: params.mapId
      });
    }
  });
}

export async function removeActorFromMapCommand(params: {
  campaignId: string;
  mapId: string;
  actorId: string;
  userId: string;
}) {
  return runStoreTransaction((database) => {
    const campaign = requireStoredCampaign(database, params.campaignId);
    requireDungeonMaster(campaign, params.userId);

    if (!campaign.maps.some((entry) => entry.id === params.mapId)) {
      throw new HttpError(404, "Map not found.");
    }

    if (!campaign.actors.some((entry) => entry.id === params.actorId)) {
      throw new HttpError(404, "Actor not found.");
    }

    if (!hasMapAssignment(campaign, params.actorId, params.mapId)) {
      throw new HttpError(404, "Actor is not assigned to that map.");
    }

    campaign.mapAssignments = campaign.mapAssignments.filter(
      (assignment) => !(assignment.actorId === params.actorId && assignment.mapId === params.mapId)
    );
    campaign.tokens = campaign.tokens.filter(
      (token) => !(token.actorId === params.actorId && token.mapId === params.mapId)
    );
    updateExplorationForCampaign(campaign);

    deleteMapAssignmentRecord(database, campaign.id, params.mapId, params.actorId);
    deleteTokensForActorOnMap(database, params.mapId, params.actorId);
    replaceCampaignExploration(database, campaign.id, campaign.exploration);
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
  return runStoreTransaction((database) => {
    const campaign = requireStoredCampaign(database, params.campaignId);
    const role = requireCampaignRole(campaign, params.userId);
    const actor = campaign.actors.find((entry) => entry.id === params.actorId);
    const map = campaign.maps.find((entry) => entry.id === params.mapId);

    if (!actor) {
      throw new HttpError(404, "Actor not found.");
    }

    if (!map) {
      throw new HttpError(404, "Map not found.");
    }

    if (map.id !== campaign.activeMapId) {
      throw new HttpError(403, "Tokens can only be placed on the active map.");
    }

    if (!canManageActor(role, params.userId, actor)) {
      throw new HttpError(403, "You cannot place that actor.");
    }

    if (!hasMapAssignment(campaign, params.actorId, params.mapId)) {
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

    updateExplorationForCampaign(campaign);
    upsertCampaignToken(database, campaign.id, existing ?? token);
    replaceCampaignExploration(database, campaign.id, campaign.exploration);
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
  return runStoreTransaction((database) => {
    const campaign = requireStoredCampaign(database, params.campaignId);
    const role = requireCampaignRole(campaign, params.userId);
    const token = campaign.tokens.find((entry) => entry.id === params.tokenId);

    if (!token) {
      throw new HttpError(404, "Token not found.");
    }

    const actor = campaign.actors.find((entry) => entry.id === token.actorId);

    if (!actor || !canManageActor(role, params.userId, actor)) {
      throw new HttpError(403, "You cannot move that token.");
    }

    const nextMapId = params.patch.mapId ?? token.mapId;

    if (!campaign.maps.some((entry) => entry.id === nextMapId)) {
      throw new HttpError(404, "Map not found.");
    }

    if (nextMapId !== campaign.activeMapId) {
      throw new HttpError(403, "Tokens can only move on the active map.");
    }

    const targetMap = campaign.maps.find((entry) => entry.id === nextMapId);

    if (!targetMap) {
      throw new HttpError(404, "Map not found.");
    }

    if (!hasMapAssignment(campaign, token.actorId, nextMapId)) {
      throw new HttpError(403, "Assign the actor to that map first.");
    }

    const snapped = snapPointToGrid(targetMap, {
      x: params.patch.x ?? token.x,
      y: params.patch.y ?? token.y
    });
    const trace =
      token.mapId === nextMapId
        ? traceMovementPath(targetMap, { x: token.x, y: token.y }, snapped, {
            ignoreWalls: role === "dm"
          })
        : { end: snapped };

    token.x = trace.end.x;
    token.y = trace.end.y;
    token.size = params.patch.size ?? token.size;
    token.mapId = nextMapId;
    token.color = params.patch.color ?? token.color;
    token.label = params.patch.label ?? token.label;
    token.visible = params.patch.visible ?? token.visible;

    updateExplorationForCampaign(campaign);
    upsertCampaignToken(database, campaign.id, token);
    replaceCampaignExploration(database, campaign.id, campaign.exploration);
    return token;
  });
}

export async function removeTokenCommand(params: {
  campaignId: string;
  tokenId: string;
  userId: string;
}) {
  return runStoreTransaction((database) => {
    const campaign = requireStoredCampaign(database, params.campaignId);
    const role = requireCampaignRole(campaign, params.userId);

    if (role !== "dm") {
      throw new HttpError(403, "Only the DM can remove tokens.");
    }

    const token = campaign.tokens.find((entry) => entry.id === params.tokenId);

    if (!token) {
      throw new HttpError(404, "Token not found.");
    }

    campaign.tokens = campaign.tokens.filter((entry) => entry.id !== params.tokenId);
    updateExplorationForCampaign(campaign);

    deleteTokenRecord(database, params.tokenId);
    replaceCampaignExploration(database, campaign.id, campaign.exploration);
  });
}

export async function appendChatMessageCommand(params: {
  campaignId: string;
  user: { id: string; name: string };
  text: string;
}) {
  return runStoreTransaction((database) => {
    const campaign = requireStoredCampaign(database, params.campaignId);
    requireCampaignRole(campaign, params.user.id);

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
  return runStoreTransaction((database) => {
    const campaign = requireStoredCampaign(database, params.campaignId);
    requireCampaignRole(campaign, params.user.id);
    const roll = rollDice(params.notation, params.label);
    const actor = params.actorId
      ? resolveChatActorContext(campaign, params.actorId) ?? undefined
      : undefined;
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
  return runStoreTransaction((database) => {
    const campaign = requireStoredCampaign(database, params.campaignId);
    const activeMap = requireActiveMap(campaign);

    if (params.mapId !== activeMap.id) {
      throw new HttpError(403, "Drawings can only be added to the active map.");
    }

    const strokes = sanitizeDrawings([{ ...params.stroke, ownerId: params.userId }], []);

    if (strokes.length === 0) {
      throw new HttpError(400, "Drawing stroke is empty.");
    }

    for (const stroke of strokes) {
      insertDrawingRecord(database, activeMap.id, stroke);
    }
  });
}

export async function updateDrawingsCommand(params: {
  campaignId: string;
  userId: string;
  mapId: string;
  drawings: Array<{ id: string; points: DrawingStroke["points"]; rotation: number }>;
}) {
  return runStoreTransaction((database) => {
    const campaign = requireStoredCampaign(database, params.campaignId);
    const role = requireCampaignRole(campaign, params.userId);
    const activeMap = requireActiveMap(campaign);

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
  return runStoreTransaction((database) => {
    const campaign = requireStoredCampaign(database, params.campaignId);
    const role = requireCampaignRole(campaign, params.userId);
    const activeMap = requireActiveMap(campaign);

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
  return runStoreTransaction((database) => {
    const campaign = requireStoredCampaign(database, params.campaignId);
    requireDungeonMaster(campaign, params.userId);
    const activeMap = requireActiveMap(campaign);

    if (params.mapId !== activeMap.id) {
      throw new HttpError(403, "Drawings can only be cleared from the active map.");
    }

    clearMapDrawingRecords(database, activeMap.id);
  });
}

export async function setActiveMapCommand(params: {
  campaignId: string;
  userId: string;
  mapId: string;
}) {
  return runStoreTransaction((database) => {
    const campaign = requireStoredCampaign(database, params.campaignId);
    requireDungeonMaster(campaign, params.userId);

    if (!campaign.maps.some((entry) => entry.id === params.mapId)) {
      throw new HttpError(404, "Map not found.");
    }

    campaign.activeMapId = params.mapId;
    updateExplorationForMap(campaign, params.mapId);
    updateCampaignActiveMap(database, campaign.id, params.mapId);
    replaceMapExploration(database, campaign.id, params.mapId, campaign.exploration);
  });
}

export async function resetFogCommand(params: {
  campaignId: string;
  userId: string;
  mapId: string;
}) {
  return runStoreTransaction((database) => {
    const campaign = requireStoredCampaign(database, params.campaignId);
    requireDungeonMaster(campaign, params.userId);

    resetFogForMap(campaign, params.mapId);
    clearMapExploration(database, campaign.id, params.mapId);
    incrementMapVisibilityVersion(database, params.mapId);
  });
}

function requireStoredCampaign(database: DatabaseSync, campaignId: string) {
  const campaign = readCampaignById(database, campaignId);

  if (!campaign) {
    throw new HttpError(404, "Campaign not found.");
  }

  return campaign;
}
