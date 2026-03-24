import { useEffect } from "react";

import type { ActorKind, ActorSheet, Campaign, CampaignMap, CampaignMember, MonsterTemplate } from "@shared/types";

import { cloneMap, createClientActorDraft, createClientMapDraft } from "../../lib/drafts";

interface UseCampaignUiEffectsOptions {
  campaign: Campaign | null;
  selectedActorId: string | null;
  selectedMapId: string | null;
  role: "dm" | "player";
  playerMembers: CampaignMember[];
  dmFogUserId: string | null;
  selectedMap: CampaignMap | undefined;
  selectedMonsterTemplate: MonsterTemplate | null;
  filteredCatalog: MonsterTemplate[];
  actorCreatorKind: ActorKind;
  currentUserId?: string;
  setSelectedMapId: (value: string | null) => void;
  setSelectedActorId: (value: string | null) => void;
  setSelectedMonsterId: (value: string | null) => void;
  setActorSearch: (value: string) => void;
  setMapActorSearch: (value: string) => void;
  setActorTypeFilter: (value: "all" | ActorKind) => void;
  setMapActorTypeFilter: (value: "all" | ActorKind) => void;
  setActorCreatorOpen: (value: boolean) => void;
  setActorCreatorKind: (value: ActorKind) => void;
  setActorDraft: (value: ActorSheet | null) => void;
  setMapDraft: (value: CampaignMap | null) => void;
  setNewMapDraft: (value: CampaignMap) => void;
  setMapEditorMode: (value: "create" | "edit" | null) => void;
  setDmFogEnabled: (value: boolean) => void;
  setDmFogUserId: (value: string | null) => void;
  setActivePopup: (value: "sheet" | null) => void;
}

export function useCampaignUiEffects({
  campaign,
  selectedActorId,
  selectedMapId,
  role,
  playerMembers,
  dmFogUserId,
  selectedMap,
  selectedMonsterTemplate,
  filteredCatalog,
  actorCreatorKind,
  currentUserId,
  setSelectedMapId,
  setSelectedActorId,
  setSelectedMonsterId,
  setActorSearch,
  setMapActorSearch,
  setActorTypeFilter,
  setMapActorTypeFilter,
  setActorCreatorOpen,
  setActorCreatorKind,
  setActorDraft,
  setMapDraft,
  setNewMapDraft,
  setMapEditorMode,
  setDmFogEnabled,
  setDmFogUserId,
  setActivePopup
}: UseCampaignUiEffectsOptions) {
  useEffect(() => {
    if (!campaign) {
      setSelectedMapId(null);
      setSelectedActorId(null);
      setSelectedMonsterId(null);
      setActorSearch("");
      setMapActorSearch("");
      setActorTypeFilter("all");
      setMapActorTypeFilter("all");
      setActorCreatorOpen(false);
      setActorCreatorKind("character");
      setActorDraft(createClientActorDraft("character", currentUserId));
      setMapDraft(null);
      setNewMapDraft(createClientMapDraft("New Map"));
      setMapEditorMode(null);
      setDmFogEnabled(false);
      setDmFogUserId(null);
      setActivePopup(null);
      return;
    }

    if (!selectedMapId || !campaign.maps.some((entry) => entry.id === selectedMapId)) {
      setSelectedMapId(campaign.activeMapId || campaign.maps[0]?.id || null);
    }

    if (selectedActorId && !campaign.actors.some((entry) => entry.id === selectedActorId)) {
      setSelectedActorId(null);
    }
  }, [
    campaign,
    currentUserId,
    selectedActorId,
    selectedMapId,
    setActivePopup,
    setActorCreatorKind,
    setActorCreatorOpen,
    setActorDraft,
    setActorSearch,
    setActorTypeFilter,
    setDmFogEnabled,
    setDmFogUserId,
    setMapActorSearch,
    setMapActorTypeFilter,
    setMapDraft,
    setMapEditorMode,
    setNewMapDraft,
    setSelectedActorId,
    setSelectedMapId,
    setSelectedMonsterId
  ]);

  useEffect(() => {
    if (role !== "dm") {
      setDmFogEnabled(false);
      setDmFogUserId(null);
      return;
    }

    if (playerMembers.length === 0) {
      setDmFogEnabled(false);
      setDmFogUserId(null);
      return;
    }

    if (!dmFogUserId || !playerMembers.some((member) => member.userId === dmFogUserId)) {
      setDmFogUserId(playerMembers[0]?.userId ?? null);
    }
  }, [dmFogUserId, playerMembers, role, setDmFogEnabled, setDmFogUserId]);

  useEffect(() => {
    setMapDraft(selectedMap ? cloneMap(selectedMap) : null);
  }, [selectedMap, setMapDraft]);

  useEffect(() => {
    if (!selectedMonsterTemplate) {
      setSelectedMonsterId(filteredCatalog[0]?.id ?? null);
      return;
    }

    if (!filteredCatalog.some((monster) => monster.id === selectedMonsterTemplate.id)) {
      setSelectedMonsterId(filteredCatalog[0]?.id ?? null);
    }
  }, [filteredCatalog, selectedMonsterTemplate, setSelectedMonsterId]);

  useEffect(() => {
    setActorDraft(createClientActorDraft(actorCreatorKind, currentUserId));
  }, [actorCreatorKind, currentUserId, setActorDraft]);
}
