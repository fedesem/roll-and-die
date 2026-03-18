import type {
  ActorKind,
  ActorSheet,
  CampaignMap,
  CampaignSummary,
  MemberRole,
  MonsterTemplate
} from "@shared/types";

import { apiRequest } from "../../api";

export function fetchCampaigns(token: string) {
  return apiRequest<CampaignSummary[]>("/campaigns", { token });
}

export function createCampaignRecord(token: string, name: string) {
  return apiRequest<CampaignSummary>("/campaigns", {
    method: "POST",
    token,
    body: { name }
  });
}

export function acceptCampaignInvite(token: string, code: string) {
  return apiRequest<CampaignSummary>("/invites/accept", {
    method: "POST",
    token,
    body: { code }
  });
}

export function createActorRecord(token: string, campaignId: string, input: { name: string; kind: ActorKind }) {
  return apiRequest<ActorSheet>(`/campaigns/${campaignId}/actors`, {
    method: "POST",
    token,
    body: input
  });
}

export function saveActorRecord(token: string, campaignId: string, actor: ActorSheet) {
  return apiRequest<ActorSheet>(`/campaigns/${campaignId}/actors/${actor.id}`, {
    method: "PUT",
    token,
    body: actor
  });
}

export function createInviteRecord(
  token: string,
  campaignId: string,
  invite: {
    label: string;
    role: MemberRole;
  }
) {
  return apiRequest(`/campaigns/${campaignId}/invites`, {
    method: "POST",
    token,
    body: invite
  });
}

export function createMonsterActorRecord(token: string, campaignId: string, templateId: string) {
  return apiRequest<ActorSheet>(`/campaigns/${campaignId}/monsters`, {
    method: "POST",
    token,
    body: { templateId }
  });
}

export function assignActorToMapRecord(token: string, campaignId: string, mapId: string, actorId: string) {
  return apiRequest(`/campaigns/${campaignId}/maps/${mapId}/actors`, {
    method: "POST",
    token,
    body: { actorId }
  });
}

export function removeActorFromMapRecord(token: string, campaignId: string, mapId: string, actorId: string) {
  return apiRequest(`/campaigns/${campaignId}/maps/${mapId}/actors/${actorId}`, {
    method: "DELETE",
    token
  });
}

export function removeTokenRecord(token: string, campaignId: string, tokenId: string) {
  return apiRequest(`/campaigns/${campaignId}/tokens/${tokenId}`, {
    method: "DELETE",
    token
  });
}

export function deleteActorRecord(token: string, campaignId: string, actorId: string) {
  return apiRequest(`/campaigns/${campaignId}/actors/${actorId}`, {
    method: "DELETE",
    token
  });
}

export function createMapRecord(token: string, campaignId: string, map: CampaignMap) {
  return apiRequest<CampaignMap>(`/campaigns/${campaignId}/maps`, {
    method: "POST",
    token,
    body: map
  });
}

export function saveMapRecord(token: string, campaignId: string, map: CampaignMap) {
  return apiRequest<CampaignMap>(`/campaigns/${campaignId}/maps/${map.id}`, {
    method: "PUT",
    token,
    body: map
  });
}
