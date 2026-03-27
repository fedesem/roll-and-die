import type {
  ActorKind,
  ActorSheet,
  BoardToken,
  CampaignMap,
  CampaignSourceBook,
  CampaignSummary,
  MemberRole
} from "@shared/types";
import {
  acceptInviteBodySchema,
  actorResponseSchema,
  assignActorToMapBodySchema,
  campaignInviteResponseSchema,
  campaignListResponseSchema,
  campaignSourceBooksResponseSchema,
  campaignSummaryResponseSchema,
  createActorBodySchema,
  createCampaignBodySchema,
  createInviteBodySchema,
  createMapBodySchema,
  createMonsterActorBodySchema,
  emptyResponseSchema,
  mapResponseSchema,
  saveActorBodySchema,
  saveMapBodySchema,
  tokenResponseSchema,
  updateTokenBodySchema
} from "@shared/contracts/campaigns";

import { apiRequest } from "../../api";
import type { TokenUpdatePatch } from "./types";

export function fetchCampaigns(token: string) {
  return apiRequest<CampaignSummary[]>("/campaigns", {
    token,
    responseSchema: campaignListResponseSchema
  });
}

export function fetchCampaignSourceBooks(token: string) {
  return apiRequest<CampaignSourceBook[]>("/campaigns/books", {
    token,
    responseSchema: campaignSourceBooksResponseSchema
  });
}

export function createCampaignRecord(token: string, name: string, allowedSourceBooks: string[]) {
  return apiRequest<CampaignSummary>("/campaigns", {
    method: "POST",
    token,
    body: { name, allowedSourceBooks },
    bodySchema: createCampaignBodySchema,
    responseSchema: campaignSummaryResponseSchema
  });
}

export function acceptCampaignInvite(token: string, code: string) {
  return apiRequest<CampaignSummary>("/invites/accept", {
    method: "POST",
    token,
    body: { code },
    bodySchema: acceptInviteBodySchema,
    responseSchema: campaignSummaryResponseSchema
  });
}

export function createActorRecord(token: string, campaignId: string, input: { name: string; kind: ActorKind }) {
  return apiRequest<ActorSheet>(`/campaigns/${campaignId}/actors`, {
    method: "POST",
    token,
    body: input,
    bodySchema: createActorBodySchema,
    responseSchema: actorResponseSchema
  });
}

export function saveActorRecord(token: string, campaignId: string, actor: ActorSheet) {
  return apiRequest<ActorSheet>(`/campaigns/${campaignId}/actors/${actor.id}`, {
    method: "PUT",
    token,
    body: actor,
    bodySchema: saveActorBodySchema,
    responseSchema: actorResponseSchema
  });
}

export function createInviteRecord(
  token: string,
  campaignId: string,
  invite: {
    role: MemberRole;
    label?: string;
  }
) {
  return apiRequest(`/campaigns/${campaignId}/invites`, {
    method: "POST",
    token,
    body: invite,
    bodySchema: createInviteBodySchema,
    responseSchema: campaignInviteResponseSchema
  });
}

export function removeInviteRecord(token: string, campaignId: string, inviteId: string) {
  return apiRequest(`/campaigns/${campaignId}/invites/${inviteId}`, {
    method: "DELETE",
    token,
    responseSchema: emptyResponseSchema
  });
}

export function createMonsterActorRecord(token: string, campaignId: string, templateId: string) {
  return apiRequest<ActorSheet>(`/campaigns/${campaignId}/monsters`, {
    method: "POST",
    token,
    body: { templateId },
    bodySchema: createMonsterActorBodySchema,
    responseSchema: actorResponseSchema
  });
}

export function assignActorToMapRecord(token: string, campaignId: string, mapId: string, actorId: string) {
  return apiRequest(`/campaigns/${campaignId}/maps/${mapId}/actors`, {
    method: "POST",
    token,
    body: { actorId },
    bodySchema: assignActorToMapBodySchema,
    responseSchema: emptyResponseSchema
  });
}

export function removeActorFromMapRecord(token: string, campaignId: string, mapId: string, actorId: string) {
  return apiRequest(`/campaigns/${campaignId}/maps/${mapId}/actors/${actorId}`, {
    method: "DELETE",
    token,
    responseSchema: emptyResponseSchema
  });
}

export function removeTokenRecord(token: string, campaignId: string, tokenId: string) {
  return apiRequest(`/campaigns/${campaignId}/tokens/${tokenId}`, {
    method: "DELETE",
    token,
    responseSchema: emptyResponseSchema
  });
}

export function updateTokenRecord(token: string, campaignId: string, tokenId: string, patch: TokenUpdatePatch) {
  return apiRequest<BoardToken>(`/campaigns/${campaignId}/tokens/${tokenId}`, {
    method: "PUT",
    token,
    body: patch,
    bodySchema: updateTokenBodySchema,
    responseSchema: tokenResponseSchema
  });
}

export function deleteActorRecord(token: string, campaignId: string, actorId: string) {
  return apiRequest(`/campaigns/${campaignId}/actors/${actorId}`, {
    method: "DELETE",
    token,
    responseSchema: emptyResponseSchema
  });
}

export function createMapRecord(token: string, campaignId: string, map: CampaignMap) {
  return apiRequest<CampaignMap>(`/campaigns/${campaignId}/maps`, {
    method: "POST",
    token,
    body: map,
    bodySchema: createMapBodySchema,
    responseSchema: mapResponseSchema
  });
}

export function saveMapRecord(token: string, campaignId: string, map: CampaignMap) {
  return apiRequest<CampaignMap>(`/campaigns/${campaignId}/maps/${map.id}`, {
    method: "PUT",
    token,
    body: map,
    bodySchema: saveMapBodySchema,
    responseSchema: mapResponseSchema
  });
}
