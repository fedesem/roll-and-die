import type { Request, Response } from "express";
import { acceptInviteBodySchema, createActorBodySchema, createCampaignBodySchema, createInviteBodySchema, createMonsterActorBodySchema, saveActorBodySchema } from "../../../shared/contracts/campaigns.js";
import type { CampaignInvite } from "../../../shared/types.js";
import { HttpError } from "../http/errors.js";
import { parseWithSchema, requireRouteParam } from "../http/validation.js";
import { broadcastActorRemovedToRoom, broadcastActorUpdatedToRoom, broadcastActorUpsertToRoom, broadcastChatAppendedToRoom, broadcastCampaignMembershipToRoom } from "../realtime/roomGateway.js";
import { runStoreQuery } from "../store.js";
import { requireUser } from "../services/authService.js";
import { buildCampaignSnapshot, toCampaignSummary } from "../services/campaignDomain.js";
import { listCampaignSummariesForUser, readCampaignMembersAndInvites, readCampaignSnapshotById } from "../store/models/campaigns.js";
import { readCompendiumSourceBooks } from "../store/models/compendium.js";
import { acceptInviteCommand, createActorCommand, createCampaignCommand, createInviteCommand, createMonsterActorCommand, deleteActorCommand, deleteInviteCommand, updateActorCommand } from "../services/campaignCommandService.js";
import { readRoomCompendiumCache } from "../services/roomCompendiumCache.js";
export const campaignController = {
    async list(request: Request, response: Response) {
        const user = requireUser(request);
        const summaries = await runStoreQuery(async (database) => await listCampaignSummariesForUser(database, user.id));
        response.json(summaries);
    },
    async sourceBooks(request: Request, response: Response) {
        requireUser(request);
        response.json(await runStoreQuery(async (database) => await readCompendiumSourceBooks(database)));
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
        const { campaignId, summary, joinMessage } = await acceptInviteCommand({
            user,
            code: body.code
        });
        const membership = await runStoreQuery(async (database) => await readCampaignMembersAndInvites(database, campaignId), { queueKey: `campaign:${campaignId}` });
        broadcastCampaignMembershipToRoom(campaignId, membership.members, membership.invites);
        if (joinMessage) {
            broadcastChatAppendedToRoom(campaignId, joinMessage);
        }
        response.json(summary);
    },
    async snapshot(request: Request, response: Response) {
        const user = requireUser(request);
        const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
        const [campaign, compendium] = await Promise.all([
            runStoreQuery(async (database) => await readCampaignSnapshotById(database, campaignId), {
                queueKey: `campaign:${campaignId}`
            }),
            readRoomCompendiumCache()
        ]);
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
        const membership = await runStoreQuery(async (database) => await readCampaignMembersAndInvites(database, campaignId), { queueKey: `campaign:${campaignId}` });
        broadcastCampaignMembershipToRoom(campaignId, membership.members, membership.invites);
        response.status(201).json(invite);
    },
    async deleteInvite(request: Request, response: Response) {
        const user = requireUser(request);
        const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
        const inviteId = requireRouteParam(request.params.inviteId, "inviteId");
        await deleteInviteCommand({
            campaignId,
            userId: user.id,
            inviteId
        });
        const membership = await runStoreQuery(async (database) => await readCampaignMembersAndInvites(database, campaignId), { queueKey: `campaign:${campaignId}` });
        broadcastCampaignMembershipToRoom(campaignId, membership.members, membership.invites);
        response.status(204).send();
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
        broadcastActorUpsertToRoom(campaignId, actor);
        response.status(201).json(actor);
    },
    async updateActor(request: Request, response: Response) {
        const user = requireUser(request);
        const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
        const actorId = requireRouteParam(request.params.actorId, "actorId");
        const patch = parseWithSchema(saveActorBodySchema, request.body);
        const { actor, tokens } = await updateActorCommand({
            campaignId,
            actorId,
            userId: user.id,
            patch
        });
        broadcastActorUpdatedToRoom(campaignId, actor, tokens);
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
        broadcastActorUpsertToRoom(campaignId, actor);
        response.status(201).json(actor);
    },
    async deleteActor(request: Request, response: Response) {
        const user = requireUser(request);
        const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
        const actorId = requireRouteParam(request.params.actorId, "actorId");
        const removed = await deleteActorCommand({
            campaignId,
            actorId,
            userId: user.id
        });
        broadcastActorRemovedToRoom(campaignId, removed.actorId, {
            mapAssignmentsRemoved: removed.assignmentKeys,
            tokenIdsRemoved: removed.tokenIds
        });
        response.status(204).send();
    }
};
