import type { Request, Response } from "express";

import {
  createTokenBodySchema,
  updateTokenBodySchema
} from "../../../shared/contracts/campaigns.js";
import { parseWithSchema, requireRouteParam } from "../http/validation.js";
import { broadcastCampaignToRoom } from "../realtime/roomGateway.js";
import { requireUser } from "../services/authService.js";
import {
  createTokenCommand,
  removeTokenCommand,
  updateTokenCommand
} from "../services/campaignCommandService.js";

export const tokenController = {
  async create(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const body = parseWithSchema(createTokenBodySchema, request.body);

    const token = await createTokenCommand({
      campaignId,
      userId: user.id,
      actorId: body.actorId,
      mapId: body.mapId,
      x: body.x,
      y: body.y
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(201).json(token);
  },

  async update(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const tokenId = requireRouteParam(request.params.tokenId, "tokenId");
    const patch = parseWithSchema(updateTokenBodySchema, request.body);

    const token = await updateTokenCommand({
      campaignId,
      tokenId,
      userId: user.id,
      patch
    });

    await broadcastCampaignToRoom(campaignId);
    response.json(token);
  },

  async remove(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const tokenId = requireRouteParam(request.params.tokenId, "tokenId");

    await removeTokenCommand({
      campaignId,
      tokenId,
      userId: user.id
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(204).send();
  }
};
