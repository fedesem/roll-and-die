import type { Request, Response } from "express";

import {
  createTokenBodySchema,
  updateTokenBodySchema
} from "../../../shared/contracts/campaigns.js";
import { snapPointToGrid, traceMovementPath } from "../../../shared/vision.js";
import { parseWithSchema, requireRouteParam } from "../http/validation.js";
import { HttpError } from "../http/errors.js";
import { broadcastCampaignToRoom } from "../realtime/roomGateway.js";
import { mutateDatabase } from "../store.js";
import { createId, requireUser } from "../services/authService.js";
import {
  canManageActor,
  hasMapAssignment,
  requireCampaignMember,
  updateExplorationForCampaign
} from "../services/campaignDomain.js";

export const tokenController = {
  async create(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const body = parseWithSchema(createTokenBodySchema, request.body);

    const token = await mutateDatabase((database) => {
      const { campaign, role } = requireCampaignMember(database, campaignId, user.id);
      const actor = campaign.actors.find((entry) => entry.id === body.actorId);
      const map = campaign.maps.find((entry) => entry.id === body.mapId);

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

      if (!hasMapAssignment(campaign, body.actorId, body.mapId)) {
        throw new HttpError(403, "Assign the actor to that map first.");
      }

      const snapped = snapPointToGrid(map, { x: body.x, y: body.y });
      const existing = campaign.tokens.find(
        (entry) => entry.actorId === body.actorId && entry.mapId === body.mapId
      );

      if (existing) {
        const trace = traceMovementPath(map, { x: existing.x, y: existing.y }, snapped, {
          ignoreWalls: role === "dm"
        });
        existing.x = trace.end.x;
        existing.y = trace.end.y;
        updateExplorationForCampaign(campaign);
        return existing;
      }

      const token = {
        id: createId("tok"),
        actorId: body.actorId,
        actorKind: actor.kind,
        mapId: body.mapId,
        x: snapped.x,
        y: snapped.y,
        size: 1,
        color: actor.color,
        label: actor.name,
        imageUrl: actor.imageUrl,
        visible: true
      };

      campaign.tokens.push(token);
      updateExplorationForCampaign(campaign);
      return token;
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(201).json(token);
  },

  async update(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const tokenId = requireRouteParam(request.params.tokenId, "tokenId");
    const patch = parseWithSchema(updateTokenBodySchema, request.body);

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

      const nextMapId = patch.mapId ?? token.mapId;

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
        x: patch.x ?? token.x,
        y: patch.y ?? token.y
      });
      const trace =
        token.mapId === nextMapId
          ? traceMovementPath(targetMap, { x: token.x, y: token.y }, snapped, {
              ignoreWalls: role === "dm"
            })
          : { end: snapped };

      token.x = trace.end.x;
      token.y = trace.end.y;
      token.size = patch.size ?? token.size;
      token.mapId = nextMapId;
      token.color = patch.color ?? token.color;
      token.label = patch.label ?? token.label;
      token.visible = patch.visible ?? token.visible;
      updateExplorationForCampaign(campaign);

      return token;
    });

    await broadcastCampaignToRoom(campaignId);
    response.json(token);
  },

  async remove(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const tokenId = requireRouteParam(request.params.tokenId, "tokenId");

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
  }
};
