import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";

import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { WebSocketServer, type RawData, type WebSocket } from "ws";

import type {
  AbilityKey,
  AbilityScores,
  ActorKind,
  ActorSheet,
  ArmorEntry,
  AttackEntry,
  BoardToken,
  CellKey,
  Campaign,
  CampaignInvite,
  CampaignMap,
  CampaignMember,
  CampaignSnapshot,
  CampaignSummary,
  CompendiumData,
  ClientRoomMessage,
  ChatMessage,
  CurrencyPouch,
  HitPoints,
  InventoryEntry,
  MapPing,
  MapViewportRecall,
  MapWall,
  MeasureKind,
  MeasurePreview,
  MeasureSnapMode,
  MonsterTemplate,
  DrawingStroke,
  FogRect,
  MemberRole,
  Point,
  ResourceEntry,
  ServerRoomMessage,
  SkillEntry,
  SpellSlotTrack,
  TokenMovementPreview,
  UserProfile
} from "../../shared/types.js";
import {
  computeVisibleCellsForUser,
  snapPointToGrid,
  snapPointToGridIntersection,
  traceMovementPath
} from "../../shared/vision.js";
import { HttpError } from "./http/errors.js";
import { wrap } from "./http/wrap.js";
import { createAuthRouter } from "./routes/authRoutes.js";
import { createAdminRouter } from "./routes/adminRoutes.js";
import { createAuthMiddleware, requireUser, toUserProfile } from "./services/authService.js";
import { rollDice } from "./dice.js";
import { mutateDatabase, readDatabase, type Database } from "./store.js";

declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
    }
  }
}

const skillTemplates: Array<{ name: string; ability: AbilityKey }> = [
  { name: "Acrobatics", ability: "dex" },
  { name: "Animal Handling", ability: "wis" },
  { name: "Arcana", ability: "int" },
  { name: "Athletics", ability: "str" },
  { name: "Deception", ability: "cha" },
  { name: "History", ability: "int" },
  { name: "Insight", ability: "wis" },
  { name: "Intimidation", ability: "cha" },
  { name: "Investigation", ability: "int" },
  { name: "Medicine", ability: "wis" },
  { name: "Nature", ability: "int" },
  { name: "Perception", ability: "wis" },
  { name: "Performance", ability: "cha" },
  { name: "Persuasion", ability: "cha" },
  { name: "Religion", ability: "int" },
  { name: "Sleight of Hand", ability: "dex" },
  { name: "Stealth", ability: "dex" },
  { name: "Survival", ability: "wis" }
];

const app = express();
const httpServer = createServer(app);
const websocketServer = new WebSocketServer({ server: httpServer, path: "/ws" });
const port = Number(process.env.PORT || 4000);

interface RoomConnection {
  socket: WebSocket;
  user?: UserProfile;
  campaignId?: string;
}

const roomConnections = new Set<RoomConnection>();

app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(express.json({ limit: "20mb" }));

app.use(wrap(createAuthMiddleware()));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});
app.use("/api/auth", createAuthRouter());
app.use("/api/admin", createAdminRouter());

app.get(
  "/api/campaigns",
  wrap(async (request, response) => {
    const user = requireUser(request);
    const database = await readDatabase();
    const summaries = database.campaigns
      .filter((campaign) => campaign.members.some((member) => member.userId === user.id))
      .map((campaign) => toCampaignSummary(campaign, user.id));

    response.json(summaries);
  })
);

app.post(
  "/api/campaigns",
  wrap(async (request, response) => {
    const user = requireUser(request);
    const name = getRequiredString(request.body?.name, "Campaign name");

    const campaign = await mutateDatabase((database) => {
      const campaignId = createId("cmp");
      const initialMap = createDefaultMap("Main Map");
      const member: CampaignMember = {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: "dm"
      };

      const campaign: Campaign = {
        id: campaignId,
        name,
        createdAt: now(),
        createdBy: user.id,
        activeMapId: initialMap.id,
        members: [member],
        invites: [],
        actors: [],
        maps: [initialMap],
        mapAssignments: [],
        tokens: [],
        exploration: {},
        chat: [
          createSystemMessage(createId("msg"), user, campaignId, `${user.name} founded the campaign.`)
        ]
      };

      database.campaigns.push(campaign);
      return campaign;
    });

    response.status(201).json(toCampaignSummary(campaign, user.id));
  })
);

app.post(
  "/api/invites/accept",
  wrap(async (request, response) => {
    const user = requireUser(request);
    const code = getRequiredString(request.body?.code, "Invite code").toUpperCase();

    const campaign = await mutateDatabase((database) => {
      const target = database.campaigns.find((entry) => entry.invites.some((invite) => invite.code === code));

      if (!target) {
        throw new HttpError(404, "Invite code not found.");
      }

      const invite = target.invites.find((entry) => entry.code === code);

      if (!invite) {
        throw new HttpError(404, "Invite code not found.");
      }

      if (!target.members.some((member) => member.userId === user.id)) {
        target.members.push({
          userId: user.id,
          name: user.name,
          email: user.email,
          role: invite.role
        });
        target.invites = target.invites.filter((entry) => entry.code !== code);
        target.chat.push(
          createSystemMessage(
            createId("msg"),
            user,
            target.id,
            `${user.name} joined as ${invite.role.toUpperCase()}.`
          )
        );
      }

      return target;
    });

    await broadcastCampaignToRoom(campaign.id);
    response.json(toCampaignSummary(campaign, user.id));
  })
);

app.get(
  "/api/campaigns/:campaignId/snapshot",
  wrap(async (request, response) => {
    const user = requireUser(request);
    const campaignId = routeParam(request.params.campaignId, "campaignId");
    const database = await readDatabase();
    const campaign = requireCampaignMember(database, campaignId, user.id).campaign;

    response.json(buildCampaignSnapshot(campaign, user, database.compendium.monsters));
  })
);

app.post(
  "/api/campaigns/:campaignId/invites",
  wrap(async (request, response) => {
    const user = requireUser(request);
    const campaignId = routeParam(request.params.campaignId, "campaignId");
    const label = getRequiredString(request.body?.label ?? "Open seat", "Invite label");
    const role = parseRole(request.body?.role);

    const invite = await mutateDatabase((database) => {
      const { campaign } = requireCampaignMember(database, campaignId, user.id);
      requireDungeonMaster(campaign, user.id);

      const invite: CampaignInvite = {
        id: createId("inv"),
        code: randomInviteCode(),
        label,
        role,
        createdAt: now(),
        createdBy: user.id
      };

      campaign.invites.unshift(invite);
      return invite;
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(201).json(invite);
  })
);

app.post(
  "/api/campaigns/:campaignId/actors",
  wrap(async (request, response) => {
    const user = requireUser(request);
    const campaignId = routeParam(request.params.campaignId, "campaignId");
    const name = getRequiredString(request.body?.name, "Actor name");
    const kind = parseActorKind(request.body?.kind);

    const actor = await mutateDatabase((database) => {
      const { campaign, role } = requireCampaignMember(database, campaignId, user.id);

      if (role !== "dm" && kind !== "character") {
        throw new HttpError(403, "Players can only create characters.");
      }

      const actor = createDefaultActor(campaignId, user.id, name, kind, role);
      campaign.actors.unshift(actor);
      return actor;
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(201).json(actor);
  })
);

app.put(
  "/api/campaigns/:campaignId/actors/:actorId",
  wrap(async (request, response) => {
    const user = requireUser(request);
    const campaignId = routeParam(request.params.campaignId, "campaignId");
    const actorId = routeParam(request.params.actorId, "actorId");

    const actor = await mutateDatabase((database) => {
      const { campaign, role } = requireCampaignMember(database, campaignId, user.id);
      const actor = campaign.actors.find((entry) => entry.id === actorId);

      if (!actor) {
        throw new HttpError(404, "Actor not found.");
      }

      if (!canManageActor(role, user.id, actor)) {
        throw new HttpError(403, "You cannot edit that actor.");
      }

      const patch = request.body ?? {};
      actor.name = getOptionalString(patch.name, actor.name);
      actor.className = getOptionalString(patch.className, actor.className);
      actor.species = getOptionalString(patch.species, actor.species);
      actor.background = getOptionalString(patch.background, actor.background);
      actor.alignment = getOptionalString(patch.alignment, actor.alignment);
      actor.level = getOptionalNumber(patch.level, actor.level, 1, 20);
      actor.challengeRating = getOptionalString(patch.challengeRating, actor.challengeRating);
      actor.experience = getOptionalNumber(patch.experience, actor.experience, 0, 999999);
      actor.spellcastingAbility = parseAbilityKey(patch.spellcastingAbility, actor.spellcastingAbility);
      actor.armorClass = getOptionalNumber(patch.armorClass, actor.armorClass, 0, 40);
      actor.initiative = getOptionalNumber(patch.initiative, actor.initiative, -10, 20);
      actor.speed = getOptionalNumber(patch.speed, actor.speed, 0, 120);
      actor.proficiencyBonus = getOptionalNumber(patch.proficiencyBonus, actor.proficiencyBonus, 0, 10);
      actor.inspiration = typeof patch.inspiration === "boolean" ? patch.inspiration : actor.inspiration;
      actor.visionRange = getOptionalNumber(patch.visionRange, actor.visionRange, 1, 24);
      actor.hitPoints = sanitizeHitPoints(patch.hitPoints, actor.hitPoints);
      actor.hitDice = getOptionalString(patch.hitDice, actor.hitDice);
      actor.abilities = sanitizeAbilities(patch.abilities, actor.abilities);
      actor.skills = sanitizeSkills(patch.skills, actor.skills);
      actor.spellSlots = sanitizeSpellSlots(patch.spellSlots, actor.spellSlots);
      actor.features = normalizeStringArray(patch.features, actor.features);
      actor.spells = normalizeStringArray(patch.spells, actor.spells);
      actor.talents = normalizeStringArray(patch.talents, actor.talents);
      actor.feats = normalizeStringArray(patch.feats, actor.feats);
      actor.attacks = sanitizeAttacks(patch.attacks, actor.attacks);
      actor.armorItems = sanitizeArmorItems(patch.armorItems, actor.armorItems);
      actor.resources = sanitizeResources(patch.resources, actor.resources);
      actor.inventory = sanitizeInventory(patch.inventory, actor.inventory);
      actor.currency = sanitizeCurrency(patch.currency, actor.currency);
      actor.notes = getOptionalString(patch.notes, actor.notes);
      actor.color = getOptionalString(patch.color, actor.color);
      updateExplorationForCampaign(campaign);

      return actor;
    });

    await broadcastCampaignToRoom(campaignId);
    response.json(actor);
  })
);

app.post(
  "/api/campaigns/:campaignId/monsters",
  wrap(async (request, response) => {
    const user = requireUser(request);
    const campaignId = routeParam(request.params.campaignId, "campaignId");
    const templateId = getRequiredString(request.body?.templateId, "Monster template");

    const actor = await mutateDatabase((database) => {
      const { campaign } = requireCampaignMember(database, campaignId, user.id);
      requireDungeonMaster(campaign, user.id);

      const template = database.compendium.monsters.find((entry) => entry.id === templateId);

      if (!template) {
        throw new HttpError(404, "Monster template not found.");
      }

      const actor = createMonsterActor(campaignId, user.id, template);
      campaign.actors.unshift(actor);
      return actor;
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(201).json(actor);
  })
);

app.post(
  "/api/campaigns/:campaignId/maps",
  wrap(async (request, response) => {
    const user = requireUser(request);
    const campaignId = routeParam(request.params.campaignId, "campaignId");
    const patch = request.body ?? {};
    const name = getRequiredString(patch.name, "Map name");

    const map = await mutateDatabase((database) => {
      const { campaign } = requireCampaignMember(database, campaignId, user.id);
      requireDungeonMaster(campaign, user.id);

      const map = createDefaultMap(name);
      applyMapPatch(map, patch);
      campaign.maps.unshift(map);
      updateExplorationForCampaign(campaign);
      return map;
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(201).json(map);
  })
);

app.put(
  "/api/campaigns/:campaignId/maps/:mapId",
  wrap(async (request, response) => {
    const user = requireUser(request);
    const campaignId = routeParam(request.params.campaignId, "campaignId");
    const mapId = routeParam(request.params.mapId, "mapId");

    const map = await mutateDatabase((database) => {
      const { campaign } = requireCampaignMember(database, campaignId, user.id);
      requireDungeonMaster(campaign, user.id);
      const map = campaign.maps.find((entry) => entry.id === mapId);

      if (!map) {
        throw new HttpError(404, "Map not found.");
      }

      applyMapPatch(map, request.body ?? {});
      updateExplorationForCampaign(campaign);

      return map;
    });

    await broadcastCampaignToRoom(campaignId);
    response.json(map);
  })
);

app.post(
  "/api/campaigns/:campaignId/maps/:mapId/actors",
  wrap(async (request, response) => {
    const user = requireUser(request);
    const campaignId = routeParam(request.params.campaignId, "campaignId");
    const mapId = routeParam(request.params.mapId, "mapId");
    const actorId = getRequiredString(request.body?.actorId, "Actor");

    await mutateDatabase((database) => {
      const { campaign } = requireCampaignMember(database, campaignId, user.id);
      requireDungeonMaster(campaign, user.id);

      if (!campaign.maps.some((entry) => entry.id === mapId)) {
        throw new HttpError(404, "Map not found.");
      }

      if (!campaign.actors.some((entry) => entry.id === actorId)) {
        throw new HttpError(404, "Actor not found.");
      }

      if (!hasMapAssignment(campaign, actorId, mapId)) {
        campaign.mapAssignments.push({ actorId, mapId });
      }
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(204).send();
  })
);

app.delete(
  "/api/campaigns/:campaignId/maps/:mapId/actors/:actorId",
  wrap(async (request, response) => {
    const user = requireUser(request);
    const campaignId = routeParam(request.params.campaignId, "campaignId");
    const mapId = routeParam(request.params.mapId, "mapId");
    const actorId = routeParam(request.params.actorId, "actorId");

    await mutateDatabase((database) => {
      const { campaign } = requireCampaignMember(database, campaignId, user.id);
      requireDungeonMaster(campaign, user.id);

      if (!campaign.maps.some((entry) => entry.id === mapId)) {
        throw new HttpError(404, "Map not found.");
      }

      if (!campaign.actors.some((entry) => entry.id === actorId)) {
        throw new HttpError(404, "Actor not found.");
      }

      const beforeAssignments = campaign.mapAssignments.length;
      campaign.mapAssignments = campaign.mapAssignments.filter(
        (assignment) => !(assignment.actorId === actorId && assignment.mapId === mapId)
      );

      if (campaign.mapAssignments.length === beforeAssignments) {
        throw new HttpError(404, "Actor is not assigned to that map.");
      }

      campaign.tokens = campaign.tokens.filter((token) => !(token.actorId === actorId && token.mapId === mapId));
      updateExplorationForCampaign(campaign);
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(204).send();
  })
);

app.post(
  "/api/campaigns/:campaignId/tokens",
  wrap(async (request, response) => {
    const user = requireUser(request);
    const campaignId = routeParam(request.params.campaignId, "campaignId");
    const actorId = getRequiredString(request.body?.actorId, "Actor");
    const mapId = getRequiredString(request.body?.mapId, "Map");
    const x = getRequiredNumber(request.body?.x, "X");
    const y = getRequiredNumber(request.body?.y, "Y");

    const token = await mutateDatabase((database) => {
      const { campaign, role } = requireCampaignMember(database, campaignId, user.id);
      const actor = campaign.actors.find((entry) => entry.id === actorId);
      const map = campaign.maps.find((entry) => entry.id === mapId);

      if (!actor) {
        throw new HttpError(404, "Actor not found.");
      }

      if (!map) {
        throw new HttpError(404, "Map not found.");
      }

      if (map.id !== campaign.activeMapId) {
        throw new HttpError(403, "Tokens can only be placed on the active map.");
      }

      if (!canManageActor(role, user.id, actor)) {
        throw new HttpError(403, "You cannot place that actor.");
      }

      if (!hasMapAssignment(campaign, actorId, mapId)) {
        throw new HttpError(403, "Assign the actor to that map first.");
      }

      const snapped = snapPointToGrid(map, { x, y });
      const existing = campaign.tokens.find((entry) => entry.actorId === actorId && entry.mapId === mapId);

      if (existing) {
        const trace = traceMovementPath(map, { x: existing.x, y: existing.y }, snapped, {
          ignoreWalls: role === "dm"
        });
        existing.x = trace.end.x;
        existing.y = trace.end.y;
        updateExplorationForCampaign(campaign);
        return existing;
      }

      const token: BoardToken = {
        id: createId("tok"),
        actorId,
        actorKind: actor.kind,
        mapId,
        x: snapped.x,
        y: snapped.y,
        size: 1,
        color: actor.color,
        label: actor.name,
        visible: true
      };

      campaign.tokens.push(token);
      updateExplorationForCampaign(campaign);
      return token;
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(201).json(token);
  })
);

app.put(
  "/api/campaigns/:campaignId/tokens/:tokenId",
  wrap(async (request, response) => {
    const user = requireUser(request);
    const campaignId = routeParam(request.params.campaignId, "campaignId");
    const tokenId = routeParam(request.params.tokenId, "tokenId");

    const token = await mutateDatabase((database) => {
      const { campaign, role } = requireCampaignMember(database, campaignId, user.id);
      const token = campaign.tokens.find((entry) => entry.id === tokenId);

      if (!token) {
        throw new HttpError(404, "Token not found.");
      }

      const actor = campaign.actors.find((entry) => entry.id === token.actorId);

      if (!actor || !canManageActor(role, user.id, actor)) {
        throw new HttpError(403, "You cannot move that token.");
      }

      const patch = request.body ?? {};
      const nextMapId = getOptionalString(patch.mapId, token.mapId);

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
        x: getOptionalNumber(patch.x, token.x, -50000, 50000),
        y: getOptionalNumber(patch.y, token.y, -50000, 50000)
      });
      const trace =
        token.mapId === nextMapId
          ? traceMovementPath(targetMap, { x: token.x, y: token.y }, snapped, {
              ignoreWalls: role === "dm"
            })
          : { end: snapped };

      token.x = trace.end.x;
      token.y = trace.end.y;
      token.size = getOptionalNumber(patch.size, token.size, 0.5, 6);
      token.mapId = nextMapId;
      token.color = getOptionalString(patch.color, token.color);
      token.label = getOptionalString(patch.label, token.label);
      token.visible = typeof patch.visible === "boolean" ? patch.visible : token.visible;
      updateExplorationForCampaign(campaign);

      return token;
    });

    await broadcastCampaignToRoom(campaignId);
    response.json(token);
  })
);

app.delete(
  "/api/campaigns/:campaignId/tokens/:tokenId",
  wrap(async (request, response) => {
    const user = requireUser(request);
    const campaignId = routeParam(request.params.campaignId, "campaignId");
    const tokenId = routeParam(request.params.tokenId, "tokenId");

    await mutateDatabase((database) => {
      const { campaign, role } = requireCampaignMember(database, campaignId, user.id);

      if (role !== "dm") {
        throw new HttpError(403, "Only the DM can remove tokens.");
      }

      const tokenIndex = campaign.tokens.findIndex((entry) => entry.id === tokenId);

      if (tokenIndex < 0) {
        throw new HttpError(404, "Token not found.");
      }

      campaign.tokens.splice(tokenIndex, 1);
      updateExplorationForCampaign(campaign);
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(204).send();
  })
);

app.delete(
  "/api/campaigns/:campaignId/actors/:actorId",
  wrap(async (request, response) => {
    const user = requireUser(request);
    const campaignId = routeParam(request.params.campaignId, "campaignId");
    const actorId = routeParam(request.params.actorId, "actorId");

    await mutateDatabase((database) => {
      const { campaign, role } = requireCampaignMember(database, campaignId, user.id);

      if (role !== "dm") {
        throw new HttpError(403, "Only the DM can delete actors.");
      }

      const actorIndex = campaign.actors.findIndex((entry) => entry.id === actorId);

      if (actorIndex < 0) {
        throw new HttpError(404, "Actor not found.");
      }

      const actor = campaign.actors[actorIndex];

      if (actor.ownerId !== user.id) {
        throw new HttpError(403, "You can only delete actors you own.");
      }

      campaign.actors.splice(actorIndex, 1);
      campaign.mapAssignments = campaign.mapAssignments.filter((assignment) => assignment.actorId !== actorId);
      campaign.tokens = campaign.tokens.filter((token) => token.actorId !== actorId);
      updateExplorationForCampaign(campaign);
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(204).send();
  })
);

app.post(
  "/api/campaigns/:campaignId/chat",
  wrap(async (request, response) => {
    const user = requireUser(request);
    const campaignId = routeParam(request.params.campaignId, "campaignId");
    const text = getRequiredString(request.body?.text, "Message").slice(0, 500);

    const message = await mutateDatabase((database) => {
      const { campaign } = requireCampaignMember(database, campaignId, user.id);

      if (/^\/roll\s+/i.test(text)) {
        const roll = rollDice(text, `${user.name} rolled`);
        const message: ChatMessage = {
          id: createId("msg"),
          campaignId,
          userId: user.id,
          userName: user.name,
          text: `${roll.label}: ${roll.notation}`,
          createdAt: now(),
          kind: "roll",
          roll
        };

        campaign.chat.push(message);
        trimChat(campaign);
        return message;
      }

      const message: ChatMessage = {
        id: createId("msg"),
        campaignId,
        userId: user.id,
        userName: user.name,
        text,
        createdAt: now(),
        kind: "message"
      };

      campaign.chat.push(message);
      trimChat(campaign);
      return message;
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(201).json(message);
  })
);

app.post(
  "/api/campaigns/:campaignId/roll",
  wrap(async (request, response) => {
    const user = requireUser(request);
    const campaignId = routeParam(request.params.campaignId, "campaignId");
    const notation = getRequiredString(request.body?.notation, "Dice notation");
    const label = getRequiredString(request.body?.label ?? `${user.name} rolled`, "Roll label");

    const message = await mutateDatabase((database) => {
      const { campaign } = requireCampaignMember(database, campaignId, user.id);
      const roll = rollDice(notation, label);
      const message: ChatMessage = {
        id: createId("msg"),
        campaignId,
        userId: user.id,
        userName: user.name,
        text: `${label}: ${roll.notation}`,
        createdAt: now(),
        kind: "roll",
        roll
      };

      campaign.chat.push(message);
      trimChat(campaign);
      return message;
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(201).json(message);
  })
);

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

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (error instanceof Error) {
    response.status(500).json({ error: error.message });
    return;
  }

  response.status(500).json({ error: "Unknown server error." });
});

httpServer.listen(port, () => {
  console.log(`DnD board API listening on http://localhost:${port}`);
});

function createId(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

function now() {
  return new Date().toISOString();
}

async function readCampaignForMember(campaignId: string, userId: string) {
  const database = await readDatabase();
  return requireCampaignMember(database, campaignId, userId).campaign;
}

function buildCampaignSnapshot(campaign: Campaign, user: UserProfile, catalog: CompendiumData["monsters"]): CampaignSnapshot {
  const member = campaign.members.find((entry) => entry.userId === user.id);

  if (!member) {
    throw new HttpError(403, "You do not have access to that campaign.");
  }

  return {
    campaign: {
      ...campaign,
      actors: campaign.actors
        .map((actor) => buildActorSnapshot(actor, member.role, user.id))
        .filter((actor): actor is ActorSheet => Boolean(actor))
    },
    currentUser: user,
    role: member.role,
    catalog,
    playerVision:
      member.role === "dm" ? {} : normalizeExplorationMemory(campaign, user.id)
  };
}

function normalizeExplorationMemory(campaign: Campaign, userId: string) {
  const stored = campaign.exploration[userId] ?? {};

  return Object.fromEntries(
    campaign.maps.map((map) => {
      const cells = Array.isArray(stored[map.id]) ? stored[map.id] : [];
      return [map.id, Array.from(new Set(cells.filter((entry) => typeof entry === "string")))];
    })
  ) as Record<string, CellKey[]>;
}

function updateExplorationForCampaign(campaign: Campaign) {
  for (const member of campaign.members) {
    if (member.role !== "player") {
      continue;
    }

    const normalizedMemory = normalizeExplorationMemory(campaign, member.userId);
    const nextMemory = { ...(campaign.exploration[member.userId] ?? {}) };

    for (const map of campaign.maps) {
      const visible = computeVisibleCellsForUser({
        map,
        actors: campaign.actors,
        tokens: campaign.tokens.filter((token) => token.mapId === map.id && token.visible),
        userId: member.userId,
        role: member.role
      });
      const knownCells = new Set(normalizedMemory[map.id] ?? []);

      for (const entry of visible) {
        knownCells.add(entry);
      }

      nextMemory[map.id] = Array.from(knownCells);
    }

    campaign.exploration[member.userId] = nextMemory;
  }
}

function requireActiveMap(campaign: Campaign) {
  const activeMap = campaign.maps.find((entry) => entry.id === campaign.activeMapId) ?? campaign.maps[0];

  if (!activeMap) {
    throw new HttpError(409, "Campaign has no active map.");
  }

  return activeMap;
}

function sendSocketMessage(connection: RoomConnection, message: ServerRoomMessage) {
  if (connection.socket.readyState !== 1) {
    return;
  }

  connection.socket.send(JSON.stringify(message));
}

function broadcastSocketMessageToRoom(campaignId: string, message: ServerRoomMessage) {
  for (const connection of roomConnections) {
    if (!connection.user || connection.campaignId !== campaignId) {
      continue;
    }

    sendSocketMessage(connection, message);
  }
}

async function broadcastCampaignToRoom(campaignId: string) {
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
    const payload = JSON.parse(raw) as ClientRoomMessage;

    if (!payload || typeof payload !== "object" || typeof payload.type !== "string") {
      throw new HttpError(400, "Invalid websocket payload.");
    }

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
      const text = getRequiredString(payload.text, "Message").slice(0, 500);

      await mutateDatabase((database) => {
        const { campaign } = requireCampaignMember(database, campaignId, user.id);

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
      const notation = getRequiredString(payload.notation, "Dice notation");
      const label = getRequiredString(payload.label, "Roll label");

      await mutateDatabase((database) => {
        const { campaign } = requireCampaignMember(database, campaignId, user.id);
        const roll = rollDice(notation, label);

        campaign.chat.push({
          id: createId("msg"),
          campaignId,
          userId: user.id,
          userName: user.name,
          text: `${label}: ${roll.notation}`,
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
          x: getRequiredNumber(payload.x, "X"),
          y: getRequiredNumber(payload.y, "Y")
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
          campaign.tokens.push({
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
          });
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

      const existing = campaign.tokens.find((entry) => entry.actorId === actor.id && entry.mapId === activeMap.id);

      if (!existing) {
        broadcastSocketMessageToRoom(campaignId, {
          type: "room:token-preview",
          actorId: actor.id,
          mapId: activeMap.id,
          preview: null
        });
        return;
      }

      if (!payload.target) {
        broadcastSocketMessageToRoom(campaignId, {
          type: "room:token-preview",
          actorId: actor.id,
          mapId: activeMap.id,
          preview: null
        });
        return;
      }

      const snapped = snapPointToGrid(activeMap, {
        x: getRequiredNumber(payload.target.x, "Preview X"),
        y: getRequiredNumber(payload.target.y, "Preview Y")
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

        activeMap.drawings = sanitizeDrawings([...activeMap.drawings, ...strokes], activeMap.drawings);
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

        if (!Array.isArray(payload.drawings) || payload.drawings.length === 0) {
          throw new HttpError(400, "Drawing updates are required.");
        }

        const nextDrawings = [...activeMap.drawings];

        for (const update of payload.drawings.slice(0, 100)) {
          if (!update || typeof update !== "object" || typeof update.id !== "string") {
            continue;
          }

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
                points: Array.isArray(update.points) ? update.points : existing.points,
                rotation: typeof update.rotation === "number" ? update.rotation : existing.rotation
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

        if (!Array.isArray(payload.drawingIds)) {
          throw new HttpError(400, "Drawing ids are required.");
        }

        const drawingIds = new Set(
          payload.drawingIds.filter((entry): entry is string => typeof entry === "string").slice(0, 300)
        );

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
        id: typeof payload.pingId === "string" && payload.pingId ? payload.pingId : createId("png"),
        mapId: activeMap.id,
        point: {
          x: getRequiredNumber(payload.point?.x, "Ping X"),
          y: getRequiredNumber(payload.point?.y, "Ping Y")
        },
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
        center: {
          x: getRequiredNumber(payload.center?.x, "Recall center X"),
          y: getRequiredNumber(payload.center?.y, "Recall center Y")
        },
        zoom: getRequiredNumber(payload.zoom, "Recall zoom")
      };
      const ping: MapPing = {
        id: typeof payload.pingId === "string" && payload.pingId ? payload.pingId : createId("png"),
        mapId: activeMap.id,
        point: {
          x: getRequiredNumber(payload.point?.x, "Ping X"),
          y: getRequiredNumber(payload.point?.y, "Ping Y")
        },
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
        const map = campaign.maps.find((entry) => entry.id === payload.mapId);

        if (!map) {
          throw new HttpError(404, "Map not found.");
        }

        resetFogForMap(campaign, map.id);
      });

      await broadcastCampaignToRoom(campaignId);
      return;
    }

    if (payload.type === "door:toggle") {
      await mutateDatabase((database) => {
        const { campaign, role } = requireCampaignMember(database, campaignId, user.id);
        const activeMap = requireActiveMap(campaign);
        const door = activeMap.walls.find((entry) => entry.id === payload.doorId && entry.kind === "door");

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

function requireCampaignMember(database: Database, campaignId: string, userId: string) {
  const campaign = database.campaigns.find((entry) => entry.id === campaignId);

  if (!campaign) {
    throw new HttpError(404, "Campaign not found.");
  }

  const member = campaign.members.find((entry) => entry.userId === userId);

  if (!member) {
    throw new HttpError(403, "You do not have access to that campaign.");
  }

  return {
    campaign,
    role: member.role
  };
}

function requireDungeonMaster(campaign: Campaign, userId: string) {
  const member = campaign.members.find((entry) => entry.userId === userId);

  if (member?.role !== "dm") {
    throw new HttpError(403, "Dungeon Master access required.");
  }
}

function toCampaignSummary(campaign: Campaign, userId: string): CampaignSummary {
  const member = campaign.members.find((entry) => entry.userId === userId);

  if (!member) {
    throw new HttpError(403, "You do not have access to that campaign.");
  }

  return {
    id: campaign.id,
    name: campaign.name,
    role: member.role,
    memberCount: campaign.members.length,
    actorCount: campaign.actors.length,
    mapCount: campaign.maps.length,
    createdAt: campaign.createdAt
  };
}

function parseRole(value: unknown): MemberRole {
  if (value === "dm" || value === "player") {
    return value;
  }

  throw new HttpError(400, "Role must be dm or player.");
}

function parseActorKind(value: unknown): ActorKind {
  if (value === "character" || value === "npc" || value === "monster" || value === "static") {
    return value;
  }

  throw new HttpError(400, "Actor kind must be character, npc, monster, or static.");
}

function parseAbilityKey(value: unknown, fallback: AbilityKey): AbilityKey {
  return value === "str" ||
    value === "dex" ||
    value === "con" ||
    value === "int" ||
    value === "wis" ||
    value === "cha"
    ? value
    : fallback;
}

function parseMeasureKind(value: unknown): MeasureKind {
  if (value === "line" || value === "cone" || value === "beam" || value === "emanation" || value === "square") {
    return value;
  }

  throw new HttpError(400, "Measure kind must be line, cone, beam, emanation, or square.");
}

function parseMeasureSnapMode(value: unknown): MeasureSnapMode {
  if (value === "center" || value === "corner" || value === "none") {
    return value;
  }

  throw new HttpError(400, "Measure snap mode must be center, corner, or none.");
}

function sanitizeMeasurePreview(preview: MeasurePreview, map: CampaignMap): MeasurePreview {
  const snapMode = parseMeasureSnapMode(preview.snapMode);

  return {
    kind: parseMeasureKind(preview.kind),
    start: snapMeasurePreviewPoint(
      map,
      {
        x: getRequiredNumber(preview.start?.x, "Measure start X"),
        y: getRequiredNumber(preview.start?.y, "Measure start Y")
      },
      snapMode
    ),
    end: snapMeasurePreviewPoint(
      map,
      {
        x: getRequiredNumber(preview.end?.x, "Measure end X"),
        y: getRequiredNumber(preview.end?.y, "Measure end Y")
      },
      snapMode
    ),
    snapMode,
    coneAngle: preview.coneAngle === 45 || preview.coneAngle === 60 || preview.coneAngle === 90 ? preview.coneAngle : 60,
    beamWidthSquares: getOptionalNumber(preview.beamWidthSquares, 1, 1, 12)
  };
}

function snapMeasurePreviewPoint(map: CampaignMap, point: Point, snapMode: MeasureSnapMode) {
  if (snapMode === "center") {
    return snapPointToGrid(map, point);
  }

  if (snapMode === "corner") {
    return snapPointToGridIntersection(map, point);
  }

  return point;
}

function createDefaultMap(name: string): CampaignMap {
  return {
    id: createId("map"),
    name,
    backgroundUrl: "",
    backgroundOffsetX: 0,
    backgroundOffsetY: 0,
    backgroundScale: 1,
    width: 1600,
    height: 1200,
    grid: {
      show: true,
      cellSize: 70,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      color: "rgba(220, 182, 92, 0.5)"
    },
    walls: [],
    drawings: [],
    fog: [],
    visibilityVersion: 1
  };
}

function createDefaultActor(
  campaignId: string,
  userId: string,
  name: string,
  kind: ActorKind,
  role: MemberRole
): ActorSheet {
  const abilities = defaultAbilities();

  return {
    id: createId("act"),
    campaignId,
    ownerId: kind === "character" ? userId : role === "dm" ? userId : undefined,
    name,
    kind,
    className:
      kind === "npc"
        ? "Supporting Role"
        : kind === "monster"
          ? "Monster"
          : kind === "static"
            ? "2 x 4"
            : "Adventurer",
    species: kind === "monster" ? "Bestiary" : kind === "static" ? "Vehicle" : "Human",
    background: kind === "monster" ? "" : kind === "static" ? "500 kg" : "Wayfarer",
    alignment: "Neutral",
    level: 1,
    challengeRating: kind === "monster" ? "1" : "",
    experience: 0,
    spellcastingAbility: "wis",
    armorClass: 14,
    initiative: 2,
    speed: 30,
    proficiencyBonus: 2,
    inspiration: false,
    visionRange: 6,
    hitPoints: { current: 12, max: 12, temp: 0 },
    hitDice: "1d8",
    abilities,
    skills: defaultSkills(),
    spellSlots: defaultSpellSlots(),
    features: ["Second Wind"],
    spells: ["Guidance"],
    talents: ["Perception"],
    feats: ["Lucky"],
    attacks: [
      {
        id: createId("atk"),
        name: "Quarterstaff",
        attackBonus: 4,
        damage: "1d6+2",
        damageType: "Bludgeoning",
        notes: ""
      }
    ],
    armorItems: [
      {
        id: createId("arm"),
        name: "Leather Armor",
        armorClass: 11,
        notes: ""
      }
    ],
    resources: [
      {
        id: createId("res"),
        name: "Second Wind",
        current: 1,
        max: 1,
        resetOn: "Short Rest"
      }
    ],
    inventory: [
      { id: createId("inv"), name: "Bedroll", quantity: 1 },
      { id: createId("inv"), name: "Torch", quantity: 5 },
      { id: createId("inv"), name: "Rations", quantity: 3 }
    ],
    currency: { pp: 0, gp: 15, ep: 0, sp: 5, cp: 12 },
    notes: "",
    color:
      kind === "npc"
        ? "#d98f46"
        : kind === "monster"
          ? "#ae4a39"
          : kind === "static"
            ? "#6e8897"
            : "#8cae75"
  };
}

function createMonsterActor(campaignId: string, userId: string, template: MonsterTemplate): ActorSheet {
  const dexModifier = abilityModifier(template.abilities.dex);
  const proficiencyBonus = template.proficiencyBonus;

  return {
    id: createId("act"),
    campaignId,
    ownerId: userId,
    templateId: template.id,
    name: template.name,
    kind: "monster",
    className: "Monster",
    species: template.source,
    background: template.habitat,
    alignment: "Unaligned",
    level: 1,
    challengeRating: template.challengeRating,
    experience: 0,
    spellcastingAbility: "cha",
    armorClass: template.armorClass,
    initiative: dexModifier,
    speed: template.speed,
    proficiencyBonus,
    inspiration: false,
    visionRange: 8,
    hitPoints: { current: template.hitPoints, max: template.hitPoints, temp: 0 },
    hitDice: "Monster HD",
    abilities: template.abilities,
    skills: defaultSkills(),
    spellSlots: defaultSpellSlots(),
    features: template.traits,
    spells: template.spells,
    talents: [],
    feats: [],
    attacks: template.actions.map((action) => ({
      id: createId("atk"),
      name: action.name,
      attackBonus: action.attackBonus || proficiencyBonus + dexModifier,
      damage: action.damage || "1d6",
      damageType: action.damageType || "Mixed",
      notes: action.description
    })),
    armorItems: [
      {
        id: createId("arm"),
        name: "Natural Armor",
        armorClass: template.armorClass,
        notes: ""
      }
    ],
    resources: [],
    inventory: [],
    currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
    notes: [
      template.traits.length > 0 ? `Traits:\n${template.traits.join("\n")}` : "",
      template.bonusActions.length > 0 ? `Bonus Actions:\n${template.bonusActions.map((entry) => `${entry.name}: ${entry.description}`).join("\n")}` : "",
      template.reactions.length > 0 ? `Reactions:\n${template.reactions.map((entry) => `${entry.name}: ${entry.description}`).join("\n")}` : ""
    ]
      .filter(Boolean)
      .join("\n\n"),
    color: template.color
  };
}

function buildActorSnapshot(actor: ActorSheet, role: MemberRole, userId: string): ActorSheet | null {
  if (role === "dm" || (actor.kind === "character" && actor.ownerId === userId)) {
    return {
      ...actor,
      sheetAccess: "full"
    };
  }

  return null;
}

function createSystemMessage(id: string, user: UserProfile, campaignId: string, text: string): ChatMessage {
  return {
    id,
    campaignId,
    userId: user.id,
    userName: user.name,
    text,
    createdAt: now(),
    kind: "system"
  };
}

function defaultAbilities(): AbilityScores {
  return {
    str: 10,
    dex: 14,
    con: 14,
    int: 12,
    wis: 16,
    cha: 9
  };
}

function defaultSkills(): SkillEntry[] {
  return skillTemplates.map((entry) => ({
    id: createId("skl"),
    name: entry.name,
    ability: entry.ability,
    proficient: entry.name === "Perception" || entry.name === "Insight",
    expertise: false
  }));
}

function defaultSpellSlots(): SpellSlotTrack[] {
  return Array.from({ length: 9 }, (_, index) => ({
    level: index + 1,
    total: index === 0 ? 2 : 0,
    used: 0
  }));
}

function canManageActor(role: MemberRole, userId: string, actor: ActorSheet) {
  if (role === "dm") {
    return true;
  }

  return actor.kind === "character" && actor.ownerId === userId;
}

function canManageDrawing(role: MemberRole, userId: string, drawing: DrawingStroke) {
  return role === "dm" || drawing.ownerId === userId;
}

function hasMapAssignment(campaign: Campaign, actorId: string, mapId: string) {
  return campaign.mapAssignments.some((assignment) => assignment.actorId === actorId && assignment.mapId === mapId);
}

function canToggleDoor(
  role: MemberRole,
  userId: string,
  campaign: Campaign,
  map: CampaignMap,
  door: MapWall
) {
  if (role === "dm") {
    return true;
  }

  const actorById = new Map(campaign.actors.map((actor) => [actor.id, actor]));
  const interactionRange = map.grid.cellSize * 1.2;

  return campaign.tokens.some((token) => {
    if (!token.visible || token.mapId !== map.id) {
      return false;
    }

    const actor = actorById.get(token.actorId);

    if (!actor || !canManageActor(role, userId, actor)) {
      return false;
    }

    const range = interactionRange * Math.max(1, token.size);
    return distancePointToSegment({ x: token.x, y: token.y }, door.start, door.end) <= range;
  });
}

function resetFogForMap(campaign: Campaign, mapId: string) {
  const map = campaign.maps.find((entry) => entry.id === mapId);

  if (!map) {
    throw new HttpError(404, "Map not found.");
  }

  for (const member of campaign.members) {
    if (member.role !== "player") {
      continue;
    }

    campaign.exploration[member.userId] = {
      ...(campaign.exploration[member.userId] ?? {}),
      [mapId]: []
    };
  }

  map.visibilityVersion = Math.max(1, (map.visibilityVersion ?? 1) + 1);
}

function distancePointToSegment(point: Point, start: Point, end: Point) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;

  if (lengthSquared < 0.0001) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const projection = ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared;
  const t = Math.min(1, Math.max(0, projection));
  const projectedX = start.x + deltaX * t;
  const projectedY = start.y + deltaY * t;

  return Math.hypot(point.x - projectedX, point.y - projectedY);
}

function randomInviteCode() {
  return randomBytes(3).toString("hex").toUpperCase();
}

function trimChat(campaign: Campaign) {
  campaign.chat = campaign.chat.slice(-200);
}

function getRequiredString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `${label} is required.`);
  }

  return value.trim();
}

function routeParam(value: string | string[] | undefined, label: string) {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string" && value[0].length > 0) {
    return value[0];
  }

  throw new HttpError(400, `Route param ${label} is required.`);
}

function getOptionalString(value: unknown, fallback: string) {
  return typeof value === "string" ? value.trim() : fallback;
}

function getRequiredNumber(value: unknown, label: string) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new HttpError(400, `${label} must be a number.`);
  }

  return value;
}

function getOptionalNumber(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function applyMapPatch(map: CampaignMap, patch: Record<string, unknown>) {
  map.name = getOptionalString(patch.name, map.name);
  map.backgroundUrl = getOptionalString(patch.backgroundUrl, map.backgroundUrl);
  map.backgroundOffsetX = getOptionalNumber(patch.backgroundOffsetX, map.backgroundOffsetX, -50000, 50000);
  map.backgroundOffsetY = getOptionalNumber(patch.backgroundOffsetY, map.backgroundOffsetY, -50000, 50000);
  map.backgroundScale = getOptionalNumber(patch.backgroundScale, map.backgroundScale, 0.05, 8);
  map.width = getOptionalNumber(patch.width, map.width, 100, 12000);
  map.height = getOptionalNumber(patch.height, map.height, 100, 12000);
  map.grid = {
    show: typeof patch.grid === "object" && patch.grid !== null && typeof (patch.grid as { show?: unknown }).show === "boolean"
      ? ((patch.grid as { show: boolean }).show)
      : map.grid.show,
    cellSize: getOptionalNumber(
      typeof patch.grid === "object" && patch.grid !== null ? (patch.grid as { cellSize?: unknown }).cellSize : undefined,
      map.grid.cellSize,
      16,
      512
    ),
    scale: getOptionalNumber(
      typeof patch.grid === "object" && patch.grid !== null ? (patch.grid as { scale?: unknown }).scale : undefined,
      map.grid.scale,
      0.2,
      4
    ),
    offsetX: getOptionalNumber(
      typeof patch.grid === "object" && patch.grid !== null ? (patch.grid as { offsetX?: unknown }).offsetX : undefined,
      map.grid.offsetX,
      -50000,
      50000
    ),
    offsetY: getOptionalNumber(
      typeof patch.grid === "object" && patch.grid !== null ? (patch.grid as { offsetY?: unknown }).offsetY : undefined,
      map.grid.offsetY,
      -50000,
      50000
    ),
    color: getOptionalString(
      typeof patch.grid === "object" && patch.grid !== null ? (patch.grid as { color?: unknown }).color : undefined,
      map.grid.color
    )
  };
  map.walls = sanitizeWalls(patch.walls, map.walls).map((wall) => ({
    ...wall,
    start: snapPointToGridIntersection(map, wall.start),
    end: snapPointToGridIntersection(map, wall.end),
    isOpen: wall.kind === "door" ? wall.isOpen : false
  }));
  map.drawings = sanitizeDrawings(patch.drawings, map.drawings);
  map.fog = [];
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean)
    .slice(0, 80);
}

function sanitizeAbilities(value: unknown, fallback: AbilityScores): AbilityScores {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const input = value as Partial<AbilityScores>;
  return {
    str: getOptionalNumber(input.str, fallback.str, 1, 30),
    dex: getOptionalNumber(input.dex, fallback.dex, 1, 30),
    con: getOptionalNumber(input.con, fallback.con, 1, 30),
    int: getOptionalNumber(input.int, fallback.int, 1, 30),
    wis: getOptionalNumber(input.wis, fallback.wis, 1, 30),
    cha: getOptionalNumber(input.cha, fallback.cha, 1, 30)
  };
}

function sanitizeHitPoints(value: unknown, fallback: HitPoints): HitPoints {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const input = value as Partial<HitPoints>;
  return {
    current: getOptionalNumber(input.current, fallback.current, 0, 999),
    max: getOptionalNumber(input.max, fallback.max, 1, 999),
    temp: getOptionalNumber(input.temp, fallback.temp, 0, 999)
  };
}

function sanitizeSkills(value: unknown, fallback: SkillEntry[]): SkillEntry[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const skill = entry as Partial<SkillEntry>;
      return {
        id: typeof skill.id === "string" ? skill.id : createId("skl"),
        name: typeof skill.name === "string" && skill.name.trim() ? skill.name.trim() : "Skill",
        ability: parseAbilityKey(skill.ability, "wis"),
        proficient: Boolean(skill.proficient),
        expertise: Boolean(skill.expertise)
      };
    })
    .filter((entry): entry is SkillEntry => Boolean(entry))
    .slice(0, 30);
}

function sanitizeSpellSlots(value: unknown, fallback: SpellSlotTrack[]): SpellSlotTrack[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return Array.from({ length: 9 }, (_, index) => {
    const existing = value[index];
    const fallbackSlot = fallback[index] ?? { level: index + 1, total: 0, used: 0 };

    if (!existing || typeof existing !== "object") {
      return fallbackSlot;
    }

    const slot = existing as Partial<SpellSlotTrack>;
    const total = getOptionalNumber(slot.total, fallbackSlot.total, 0, 9);
    const used = getOptionalNumber(slot.used, fallbackSlot.used, 0, 9);

    return {
      level: index + 1,
      total,
      used: Math.min(total, used)
    };
  });
}

function sanitizeAttacks(value: unknown, fallback: AttackEntry[]): AttackEntry[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const attack = entry as Partial<AttackEntry>;
      return {
        id: typeof attack.id === "string" ? attack.id : createId("atk"),
        name: getOptionalString(attack.name, "Attack"),
        attackBonus: getOptionalNumber(attack.attackBonus, 0, -20, 30),
        damage: getOptionalString(attack.damage, ""),
        damageType: getOptionalString(attack.damageType, ""),
        notes: getOptionalString(attack.notes, "")
      };
    })
    .filter((entry): entry is AttackEntry => Boolean(entry))
    .slice(0, 24);
}

function sanitizeArmorItems(value: unknown, fallback: ArmorEntry[]): ArmorEntry[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const armor = entry as Partial<ArmorEntry>;
      return {
        id: typeof armor.id === "string" ? armor.id : createId("arm"),
        name: getOptionalString(armor.name, "Armor"),
        armorClass: getOptionalNumber(armor.armorClass, 10, 0, 30),
        notes: getOptionalString(armor.notes, "")
      };
    })
    .filter((entry): entry is ArmorEntry => Boolean(entry))
    .slice(0, 12);
}

function sanitizeResources(value: unknown, fallback: ResourceEntry[]): ResourceEntry[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const resource = entry as Partial<ResourceEntry>;
      const max = getOptionalNumber(resource.max, 0, 0, 99);
      return {
        id: typeof resource.id === "string" ? resource.id : createId("res"),
        name: getOptionalString(resource.name, "Resource"),
        current: Math.min(max, getOptionalNumber(resource.current, 0, 0, 99)),
        max,
        resetOn: getOptionalString(resource.resetOn, "")
      };
    })
    .filter((entry): entry is ResourceEntry => Boolean(entry))
    .slice(0, 24);
}

function sanitizeInventory(value: unknown, fallback: InventoryEntry[]): InventoryEntry[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const item = entry as Partial<InventoryEntry>;
      return {
        id: typeof item.id === "string" ? item.id : createId("inv"),
        name: getOptionalString(item.name, "Item"),
        quantity: getOptionalNumber(item.quantity, 1, 0, 999)
      };
    })
    .filter((entry): entry is InventoryEntry => Boolean(entry))
    .slice(0, 80);
}

function sanitizeCurrency(value: unknown, fallback: CurrencyPouch): CurrencyPouch {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const input = value as Partial<CurrencyPouch>;
  return {
    pp: getOptionalNumber(input.pp, fallback.pp, 0, 99999),
    gp: getOptionalNumber(input.gp, fallback.gp, 0, 99999),
    ep: getOptionalNumber(input.ep, fallback.ep, 0, 99999),
    sp: getOptionalNumber(input.sp, fallback.sp, 0, 99999),
    cp: getOptionalNumber(input.cp, fallback.cp, 0, 99999)
  };
}

function sanitizeWalls(value: unknown, fallback: MapWall[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry) => {
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof (entry as Partial<MapWall>).start?.x !== "number" ||
        typeof (entry as Partial<MapWall>).start?.y !== "number" ||
        typeof (entry as Partial<MapWall>).end?.x !== "number" ||
        typeof (entry as Partial<MapWall>).end?.y !== "number"
      ) {
        return null;
      }

      const wall = entry as MapWall;
      const kind =
        wall.kind === "transparent" || wall.kind === "door" || wall.kind === "wall"
          ? wall.kind
          : "wall";

      return {
        id: typeof wall.id === "string" ? wall.id : createId("wall"),
        start: wall.start,
        end: wall.end,
        kind,
        isOpen: kind === "door" ? Boolean(wall.isOpen) : false
      };
    })
    .filter((entry): entry is MapWall => Boolean(entry))
    .slice(0, 400);
}

function sanitizeDrawings(value: unknown, fallback: DrawingStroke[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry): DrawingStroke | null => {
      if (!entry || typeof entry !== "object" || !Array.isArray((entry as Partial<DrawingStroke>).points)) {
        return null;
      }

      const stroke = entry as DrawingStroke;
      const points = stroke.points
        .filter((point) => typeof point?.x === "number" && typeof point?.y === "number")
        .map((point) => ({ x: point.x, y: point.y }))
        .slice(0, 800);

      const kind =
        stroke.kind === "circle" || stroke.kind === "square" || stroke.kind === "star" || stroke.kind === "freehand"
          ? stroke.kind
          : "freehand";

      if (points.length < 2) {
        return null;
      }

      const sanitized: DrawingStroke = {
        id: typeof stroke.id === "string" ? stroke.id : createId("drw"),
        ownerId: typeof stroke.ownerId === "string" && stroke.ownerId ? stroke.ownerId : undefined,
        kind,
        color: typeof stroke.color === "string" ? stroke.color : "#d9a641",
        strokeOpacity: typeof stroke.strokeOpacity === "number" ? Math.min(1, Math.max(0, stroke.strokeOpacity)) : 1,
        fillColor: typeof stroke.fillColor === "string" ? stroke.fillColor : "",
        fillOpacity: typeof stroke.fillOpacity === "number" ? Math.min(1, Math.max(0, stroke.fillOpacity)) : 0.22,
        size: typeof stroke.size === "number" ? Math.min(24, Math.max(1, stroke.size)) : 4,
        rotation: typeof stroke.rotation === "number" ? Math.min(360, Math.max(-360, stroke.rotation)) : 0,
        points
      };

      return sanitized;
    })
    .filter((entry): entry is DrawingStroke => entry !== null)
    .slice(0, 300);
}

function sanitizeFog(value: unknown, fallback: FogRect[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry) => {
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof (entry as Partial<FogRect>).x !== "number" ||
        typeof (entry as Partial<FogRect>).y !== "number" ||
        typeof (entry as Partial<FogRect>).width !== "number" ||
        typeof (entry as Partial<FogRect>).height !== "number"
      ) {
        return null;
      }

      const fog = entry as FogRect;
      return {
        id: typeof fog.id === "string" ? fog.id : createId("fog"),
        x: fog.x,
        y: fog.y,
        width: Math.max(4, fog.width),
        height: Math.max(4, fog.height)
      };
    })
    .filter((entry): entry is FogRect => Boolean(entry))
    .slice(0, 300);
}

function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}
