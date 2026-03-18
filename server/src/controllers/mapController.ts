import type { Request, Response } from "express";

import {
  assignActorToMapBodySchema,
  createMapBodySchema,
  saveMapBodySchema
} from "../../../shared/contracts/campaigns.js";
import { parseWithSchema, requireRouteParam } from "../http/validation.js";
import { HttpError } from "../http/errors.js";
import { broadcastCampaignToRoom } from "../realtime/roomGateway.js";
import { mutateDatabase } from "../store.js";
import { requireUser } from "../services/authService.js";
import {
  applyMapPatch,
  createDefaultMap,
  hasMapAssignment,
  requireCampaignMember,
  requireDungeonMaster,
  updateExplorationForCampaign
} from "../services/campaignDomain.js";

export const mapController = {
  async create(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const body = parseWithSchema(createMapBodySchema, request.body);

    const map = await mutateDatabase((database) => {
      const { campaign } = requireCampaignMember(database, campaignId, user.id);
      requireDungeonMaster(campaign, user.id);

      const map = createDefaultMap(body.name);
      applyMapPatch(map, body);
      campaign.maps.unshift(map);
      updateExplorationForCampaign(campaign);
      return map;
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(201).json(map);
  },

  async update(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const mapId = requireRouteParam(request.params.mapId, "mapId");
    const patch = parseWithSchema(saveMapBodySchema, request.body);

    const map = await mutateDatabase((database) => {
      const { campaign } = requireCampaignMember(database, campaignId, user.id);
      requireDungeonMaster(campaign, user.id);
      const map = campaign.maps.find((entry) => entry.id === mapId);

      if (!map) {
        throw new HttpError(404, "Map not found.");
      }

      applyMapPatch(map, patch);
      updateExplorationForCampaign(campaign);
      return map;
    });

    await broadcastCampaignToRoom(campaignId);
    response.json(map);
  },

  async assignActor(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const mapId = requireRouteParam(request.params.mapId, "mapId");
    const body = parseWithSchema(assignActorToMapBodySchema, request.body);

    await mutateDatabase((database) => {
      const { campaign } = requireCampaignMember(database, campaignId, user.id);
      requireDungeonMaster(campaign, user.id);

      if (!campaign.maps.some((entry) => entry.id === mapId)) {
        throw new HttpError(404, "Map not found.");
      }

      if (!campaign.actors.some((entry) => entry.id === body.actorId)) {
        throw new HttpError(404, "Actor not found.");
      }

      if (!hasMapAssignment(campaign, body.actorId, mapId)) {
        campaign.mapAssignments.push({ actorId: body.actorId, mapId });
      }
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(204).send();
  },

  async removeActor(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const mapId = requireRouteParam(request.params.mapId, "mapId");
    const actorId = requireRouteParam(request.params.actorId, "actorId");

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

      campaign.tokens = campaign.tokens.filter(
        (token) => !(token.actorId === actorId && token.mapId === mapId)
      );
      updateExplorationForCampaign(campaign);
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(204).send();
  }
};
