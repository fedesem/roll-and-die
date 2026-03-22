import type { Request, Response } from "express";

import {
  assignActorToMapBodySchema,
  createMapBodySchema,
  saveMapBodySchema
} from "../../../shared/contracts/campaigns.js";
import { parseWithSchema, requireRouteParam } from "../http/validation.js";
import { broadcastCampaignToRoom } from "../realtime/roomGateway.js";
import { requireUser } from "../services/authService.js";
import {
} from "../services/campaignDomain.js";
import {
  assignActorToMapCommand,
  createMapCommand,
  removeActorFromMapCommand,
  updateMapCommand
} from "../services/campaignCommandService.js";

export const mapController = {
  async create(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const body = parseWithSchema(createMapBodySchema, request.body);

    const map = await createMapCommand({
      campaignId,
      userId: user.id,
      body
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(201).json(map);
  },

  async update(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const mapId = requireRouteParam(request.params.mapId, "mapId");
    const patch = parseWithSchema(saveMapBodySchema, request.body);

    const map = await updateMapCommand({
      campaignId,
      mapId,
      userId: user.id,
      patch
    });

    await broadcastCampaignToRoom(campaignId);
    response.json(map);
  },

  async assignActor(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const mapId = requireRouteParam(request.params.mapId, "mapId");
    const body = parseWithSchema(assignActorToMapBodySchema, request.body);

    await assignActorToMapCommand({
      campaignId,
      mapId,
      actorId: body.actorId,
      userId: user.id
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(204).send();
  },

  async removeActor(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const mapId = requireRouteParam(request.params.mapId, "mapId");
    const actorId = requireRouteParam(request.params.actorId, "actorId");

    await removeActorFromMapCommand({
      campaignId,
      mapId,
      actorId,
      userId: user.id
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(204).send();
  }
};
