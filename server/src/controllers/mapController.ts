import type { Request, Response } from "express";
import { assignActorToMapBodySchema, createMapBodySchema, saveMapBodySchema } from "../../../shared/contracts/campaigns.js";
import { HttpError } from "../http/errors.js";
import { parseWithSchema, requireRouteParam } from "../http/validation.js";
import { broadcastMapAssignmentsToRoom, broadcastMapUpsertToRoom } from "../realtime/roomGateway.js";
import { runStoreQuery } from "../store.js";
import { requireUser } from "../services/authService.js";
import { normalizeExplorationMemoryForMap } from "../services/campaignDomain.js";
import { readActiveBoardCampaign, readMapEditorMap } from "../store/models/campaigns.js";
import { assignActorToMapCommand, createMapCommand, removeActorFromMapCommand, updateMapCommand } from "../services/campaignCommandService.js";
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
        broadcastMapUpsertToRoom(campaignId, map);
        response.status(201).json(map);
    },
    async update(request: Request, response: Response) {
        const user = requireUser(request);
        const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
        const mapId = requireRouteParam(request.params.mapId, "mapId");
        const patch = parseWithSchema(saveMapBodySchema, request.body);
        await updateMapCommand({
            campaignId,
            mapId,
            userId: user.id,
            patch
        });
        const map = await runStoreQuery(async (database) => await readMapEditorMap(database, campaignId, mapId), { queueKey: `campaign:${campaignId}` });
        if (!map) {
            throw new HttpError(404, "Map not found.");
        }
        const activeBoardCampaign = await runStoreQuery(async (database) => await readActiveBoardCampaign(database, campaignId), { queueKey: `campaign:${campaignId}` });
        broadcastMapUpsertToRoom(campaignId, map, {
            activeMapId: activeBoardCampaign?.activeMapId,
            playerVision: activeBoardCampaign && activeBoardCampaign.activeMapId === map.id
                ? (connection) => connection.user
                    ? {
                        mapId: map.id,
                        cells: connection.role === "dm"
                            ? []
                            : normalizeExplorationMemoryForMap(activeBoardCampaign, connection.user.id, map.id)
                    }
                    : undefined
                : undefined
        });
        response.json(map);
    },
    async assignActor(request: Request, response: Response) {
        const user = requireUser(request);
        const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
        const mapId = requireRouteParam(request.params.mapId, "mapId");
        const body = parseWithSchema(assignActorToMapBodySchema, request.body);
        const result = await assignActorToMapCommand({
            campaignId,
            mapId,
            actorId: body.actorId,
            userId: user.id
        });
        if (result.assigned) {
            broadcastMapAssignmentsToRoom(campaignId, {
                upsert: [{ mapId: result.mapId, actorId: result.actorId }]
            });
        }
        response.status(204).send();
    },
    async removeActor(request: Request, response: Response) {
        const user = requireUser(request);
        const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
        const mapId = requireRouteParam(request.params.mapId, "mapId");
        const actorId = requireRouteParam(request.params.actorId, "actorId");
        const result = await removeActorFromMapCommand({
            campaignId,
            mapId,
            actorId,
            userId: user.id
        });
        broadcastMapAssignmentsToRoom(campaignId, {
            removed: [{ mapId: result.mapId, actorId: result.actorId }],
            tokenIdsRemoved: result.tokenIds
        });
        response.status(204).send();
    }
};
