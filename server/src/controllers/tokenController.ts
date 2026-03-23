import type { Request, Response } from "express";
import { createTokenBodySchema, updateTokenBodySchema } from "../../../shared/contracts/campaigns.js";
import { parseWithSchema, requireRouteParam } from "../http/validation.js";
import { broadcastTokenPatchToRoom } from "../realtime/roomGateway.js";
import { runStoreQuery } from "../store.js";
import { requireUser } from "../services/authService.js";
import { normalizeExplorationMemoryForMap } from "../services/campaignDomain.js";
import { createTokenCommand, removeTokenCommand, updateTokenCommand } from "../services/campaignCommandService.js";
import { readActiveBoardCampaign } from "../store/models/campaigns.js";
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
        const campaign = await runStoreQuery(async (database) => await readActiveBoardCampaign(database, campaignId), {
            queueKey: `campaign:${campaignId}`
        });
        broadcastTokenPatchToRoom(campaignId, {
            tokensUpsert: [token],
            playerVision: (connection) => connection.user && campaign
                ? {
                    mapId: token.mapId,
                    cells: connection.role === "dm" ? [] : normalizeExplorationMemoryForMap(campaign, connection.user.id, token.mapId)
                }
                : undefined
        });
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
        const campaign = await runStoreQuery(async (database) => await readActiveBoardCampaign(database, campaignId), {
            queueKey: `campaign:${campaignId}`
        });
        broadcastTokenPatchToRoom(campaignId, {
            tokensUpsert: [token],
            playerVision: (connection) => connection.user && campaign
                ? {
                    mapId: token.mapId,
                    cells: connection.role === "dm" ? [] : normalizeExplorationMemoryForMap(campaign, connection.user.id, token.mapId)
                }
                : undefined
        });
        response.json(token);
    },
    async remove(request: Request, response: Response) {
        const user = requireUser(request);
        const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
        const tokenId = requireRouteParam(request.params.tokenId, "tokenId");
        const removed = await removeTokenCommand({
            campaignId,
            tokenId,
            userId: user.id
        });
        const campaign = await runStoreQuery(async (database) => await readActiveBoardCampaign(database, campaignId), {
            queueKey: `campaign:${campaignId}`
        });
        broadcastTokenPatchToRoom(campaignId, {
            tokenIdsRemoved: [removed.tokenId],
            playerVision: (connection) => connection.user && campaign
                ? {
                    mapId: removed.mapId,
                    cells: connection.role === "dm" ? [] : normalizeExplorationMemoryForMap(campaign, connection.user.id, removed.mapId)
                }
                : undefined
        });
        response.status(204).send();
    }
};
