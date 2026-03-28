import type { ActorSheet, Campaign, CampaignMap, CampaignMember } from "./types.js";

function findOwnerMember(campaign: Campaign, actor: ActorSheet): CampaignMember | undefined {
  if (!actor.ownerId) {
    return undefined;
  }

  return campaign.members.find((member) => member.userId === actor.ownerId);
}

export function isPlayerOwnedActor(campaign: Campaign, actor: ActorSheet) {
  return findOwnerMember(campaign, actor)?.role === "player";
}

export function getActorAssignedMaps(campaign: Campaign, actor: ActorSheet): CampaignMap[] {
  if (isPlayerOwnedActor(campaign, actor)) {
    return campaign.maps;
  }

  const assignedMapIdSet = new Set(
    campaign.mapAssignments.filter((assignment) => assignment.actorId === actor.id).map((assignment) => assignment.mapId)
  );

  return campaign.maps.filter((map) => assignedMapIdSet.has(map.id));
}

export function isActorAssignedToMap(campaign: Campaign, actor: ActorSheet, mapId: string) {
  if (isPlayerOwnedActor(campaign, actor)) {
    return campaign.maps.some((map) => map.id === mapId);
  }

  return campaign.mapAssignments.some((assignment) => assignment.actorId === actor.id && assignment.mapId === mapId);
}
