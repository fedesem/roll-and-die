import { useState } from "react";

import type { ActorKind, ActorSheet, MemberRole } from "@shared/types";

import type { ActorTypeFilter } from "./types";
import { createClientActorDraft } from "../../lib/drafts";

interface UseCampaignWorkspaceStateOptions {
  currentUserId?: string;
}

export function useCampaignWorkspaceState({ currentUserId }: UseCampaignWorkspaceStateOptions) {
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [selectedBoardItemCount, setSelectedBoardItemCount] = useState(0);
  const [actorSearch, setActorSearch] = useState("");
  const [mapActorSearch, setMapActorSearch] = useState("");
  const [actorTypeFilter, setActorTypeFilter] = useState<ActorTypeFilter>("all");
  const [mapActorTypeFilter, setMapActorTypeFilter] = useState<ActorTypeFilter>("all");
  const [actorCreatorKind, setActorCreatorKind] = useState<ActorKind>("character");
  const [actorCreatorOpen, setActorCreatorOpen] = useState(false);
  const [actorDraft, setActorDraft] = useState<ActorSheet | null>(() => createClientActorDraft("character", currentUserId));
  const [inviteDraft, setInviteDraft] = useState({ role: "player" as MemberRole });
  const [monsterQuery, setMonsterQuery] = useState("");
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null);
  const [dmFogEnabled, setDmFogEnabled] = useState(false);
  const [dmFogUserId, setDmFogUserId] = useState<string | null>(null);
  const [activePopup, setActivePopup] = useState<"sheet" | null>(null);
  const [inviteLinkConsumed, setInviteLinkConsumed] = useState<string | null>(null);

  return {
    selectedMapId,
    setSelectedMapId,
    selectedActorId,
    setSelectedActorId,
    selectedBoardItemCount,
    setSelectedBoardItemCount,
    actorSearch,
    setActorSearch,
    mapActorSearch,
    setMapActorSearch,
    actorTypeFilter,
    setActorTypeFilter,
    mapActorTypeFilter,
    setMapActorTypeFilter,
    actorCreatorKind,
    setActorCreatorKind,
    actorCreatorOpen,
    setActorCreatorOpen,
    actorDraft,
    setActorDraft,
    inviteDraft,
    setInviteDraft,
    monsterQuery,
    setMonsterQuery,
    selectedMonsterId,
    setSelectedMonsterId,
    dmFogEnabled,
    setDmFogEnabled,
    dmFogUserId,
    setDmFogUserId,
    activePopup,
    setActivePopup,
    inviteLinkConsumed,
    setInviteLinkConsumed
  };
}
