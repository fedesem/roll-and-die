import type { Request, Response } from "express";

import {
  acceptInviteBodySchema,
  createActorBodySchema,
  createCampaignBodySchema,
  createInviteBodySchema,
  createMonsterActorBodySchema,
  saveActorBodySchema
} from "../../../shared/contracts/campaigns.js";
import type { Campaign, CampaignMember, CampaignInvite } from "../../../shared/types.js";
import { parseWithSchema, requireRouteParam } from "../http/validation.js";
import { HttpError } from "../http/errors.js";
import { broadcastCampaignToRoom } from "../realtime/roomGateway.js";
import { mutateDatabase, readDatabase } from "../store.js";
import { createId, now, requireUser } from "../services/authService.js";
import {
  applyActorPatch,
  buildCampaignSnapshot,
  canManageActor,
  createDefaultActor,
  createDefaultMap,
  createMonsterActor,
  createSystemMessage,
  randomInviteCode,
  requireCampaignMember,
  requireDungeonMaster,
  syncActorTokens,
  toCampaignSummary,
  updateExplorationForCampaign
} from "../services/campaignDomain.js";

export const campaignController = {
  async list(request: Request, response: Response) {
    const user = requireUser(request);
    const database = await readDatabase();
    const summaries = database.campaigns
      .filter((campaign) => campaign.members.some((member) => member.userId === user.id))
      .map((campaign) => toCampaignSummary(campaign, user.id));

    response.json(summaries);
  },

  async create(request: Request, response: Response) {
    const user = requireUser(request);
    const body = parseWithSchema(createCampaignBodySchema, request.body);

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
        name: body.name,
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
          createSystemMessage(
            createId("msg"),
            user,
            campaignId,
            `${user.name} founded the campaign.`
          )
        ]
      };

      database.campaigns.push(campaign);
      return campaign;
    });

    response.status(201).json(toCampaignSummary(campaign, user.id));
  },

  async acceptInvite(request: Request, response: Response) {
    const user = requireUser(request);
    const body = parseWithSchema(acceptInviteBodySchema, request.body);

    const campaign = await mutateDatabase((database) => {
      const target = database.campaigns.find((entry) =>
        entry.invites.some((invite) => invite.code === body.code.toUpperCase())
      );

      if (!target) {
        throw new HttpError(404, "Invite code not found.");
      }

      const invite = target.invites.find((entry) => entry.code === body.code.toUpperCase());

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
        target.invites = target.invites.filter((entry) => entry.code !== body.code.toUpperCase());
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
  },

  async snapshot(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const database = await readDatabase();
    const campaign = requireCampaignMember(database, campaignId, user.id).campaign;

    response.json(buildCampaignSnapshot(campaign, user, database.compendium.monsters));
  },

  async createInvite(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const body = parseWithSchema(createInviteBodySchema, request.body);

    const invite = await mutateDatabase((database) => {
      const { campaign } = requireCampaignMember(database, campaignId, user.id);
      requireDungeonMaster(campaign, user.id);

      const createdInvite: CampaignInvite = {
        id: createId("inv"),
        code: randomInviteCode(),
        label: body.label,
        role: body.role,
        createdAt: now(),
        createdBy: user.id
      };

      campaign.invites.unshift(createdInvite);
      return createdInvite;
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(201).json(invite);
  },

  async createActor(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const body = parseWithSchema(createActorBodySchema, request.body);

    const actor = await mutateDatabase((database) => {
      const { campaign, role } = requireCampaignMember(database, campaignId, user.id);

      if (role !== "dm" && body.kind !== "character") {
        throw new HttpError(403, "Players can only create characters.");
      }

      const actor = createDefaultActor(campaignId, user.id, body.name, body.kind, role);
      campaign.actors.unshift(actor);
      return actor;
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(201).json(actor);
  },

  async updateActor(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const actorId = requireRouteParam(request.params.actorId, "actorId");
    const patch = parseWithSchema(saveActorBodySchema, request.body);

    const actor = await mutateDatabase((database) => {
      const { campaign, role } = requireCampaignMember(database, campaignId, user.id);
      const actor = campaign.actors.find((entry) => entry.id === actorId);

      if (!actor) {
        throw new HttpError(404, "Actor not found.");
      }

      if (!canManageActor(role, user.id, actor)) {
        throw new HttpError(403, "You cannot edit that actor.");
      }

      applyActorPatch(actor, patch);
      syncActorTokens(campaign, actor);
      updateExplorationForCampaign(campaign);
      return actor;
    });

    await broadcastCampaignToRoom(campaignId);
    response.json(actor);
  },

  async createMonsterActor(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const body = parseWithSchema(createMonsterActorBodySchema, request.body);

    const actor = await mutateDatabase((database) => {
      const { campaign } = requireCampaignMember(database, campaignId, user.id);
      requireDungeonMaster(campaign, user.id);

      const template = database.compendium.monsters.find((entry) => entry.id === body.templateId);

      if (!template) {
        throw new HttpError(404, "Monster template not found.");
      }

      const actor = createMonsterActor(campaignId, user.id, template);
      campaign.actors.unshift(actor);
      return actor;
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(201).json(actor);
  },

  async deleteActor(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const actorId = requireRouteParam(request.params.actorId, "actorId");

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
      campaign.mapAssignments = campaign.mapAssignments.filter(
        (assignment) => assignment.actorId !== actorId
      );
      campaign.tokens = campaign.tokens.filter((token) => token.actorId !== actorId);
      updateExplorationForCampaign(campaign);
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(204).send();
  }
};
