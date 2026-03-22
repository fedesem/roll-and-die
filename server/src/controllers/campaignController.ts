import type { Request, Response } from "express";

import {
  acceptInviteBodySchema,
  createActorBodySchema,
  createCampaignBodySchema,
  createInviteBodySchema,
  createMonsterActorBodySchema,
  saveActorBodySchema
} from "../../../shared/contracts/campaigns.js";
import type { CampaignInvite } from "../../../shared/types.js";
import { HttpError } from "../http/errors.js";
import { parseWithSchema, requireRouteParam } from "../http/validation.js";
import { broadcastCampaignToRoom } from "../realtime/roomGateway.js";
import { runStoreQuery } from "../store.js";
import { requireUser } from "../services/authService.js";
import {
  buildCampaignSnapshot,
  toCampaignSummary
} from "../services/campaignDomain.js";
import { listCampaignSummariesForUser, readCampaignById } from "../store/models/campaigns.js";
import { readCampaignCompendium, readCompendiumSourceBooks } from "../store/models/compendium.js";
import {
  acceptInviteCommand,
  createActorCommand,
  createCampaignCommand,
  createInviteCommand,
  createMonsterActorCommand,
  deleteActorCommand,
  updateActorCommand
} from "../services/campaignCommandService.js";

export const campaignController = {
  async list(request: Request, response: Response) {
    const user = requireUser(request);
    const summaries = await runStoreQuery((database) => listCampaignSummariesForUser(database, user.id));

    response.json(summaries);
  },

  async sourceBooks(request: Request, response: Response) {
    requireUser(request);
    response.json(await runStoreQuery((database) => readCompendiumSourceBooks(database)));
  },

  async create(request: Request, response: Response) {
    const user = requireUser(request);
    const body = parseWithSchema(createCampaignBodySchema, request.body);

    const campaign = await createCampaignCommand({
      user,
      name: body.name,
      allowedSourceBooks: body.allowedSourceBooks
    });

    response.status(201).json(toCampaignSummary(campaign, user.id));
  },

  async acceptInvite(request: Request, response: Response) {
    const user = requireUser(request);
    const body = parseWithSchema(acceptInviteBodySchema, request.body);

    const campaign = await acceptInviteCommand({
      user,
      code: body.code
    });

    await broadcastCampaignToRoom(campaign.id);
    response.json(toCampaignSummary(campaign, user.id));
  },

  async snapshot(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const { campaign, compendium } = await runStoreQuery((database) => {
      const campaign = readCampaignById(database, campaignId);

      return {
        campaign,
        compendium: readCampaignCompendium(database)
      };
    });

    if (!campaign) {
      throw new HttpError(404, "Campaign not found.");
    }

    if (!campaign.members.some((member) => member.userId === user.id)) {
      throw new HttpError(403, "You do not have access to that campaign.");
    }

    response.json(buildCampaignSnapshot(campaign, user, compendium));
  },

  async createInvite(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const body = parseWithSchema(createInviteBodySchema, request.body);

    const invite: CampaignInvite = await createInviteCommand({
      campaignId,
      userId: user.id,
      label: body.label,
      role: body.role
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(201).json(invite);
  },

  async createActor(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const body = parseWithSchema(createActorBodySchema, request.body);

    const actor = await createActorCommand({
      campaignId,
      user,
      name: body.name,
      kind: body.kind
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(201).json(actor);
  },

  async updateActor(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const actorId = requireRouteParam(request.params.actorId, "actorId");
    const patch = parseWithSchema(saveActorBodySchema, request.body);

    const actor = await updateActorCommand({
      campaignId,
      actorId,
      userId: user.id,
      patch
    });

    await broadcastCampaignToRoom(campaignId);
    response.json(actor);
  },

  async createMonsterActor(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const body = parseWithSchema(createMonsterActorBodySchema, request.body);

    const actor = await createMonsterActorCommand({
      campaignId,
      userId: user.id,
      templateId: body.templateId
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(201).json(actor);
  },

  async deleteActor(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const actorId = requireRouteParam(request.params.actorId, "actorId");

    await deleteActorCommand({
      campaignId,
      actorId,
      userId: user.id
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(204).send();
  }
};
