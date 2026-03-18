import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { ActorKind, ActorSheet, CampaignMap, CampaignSnapshot, CampaignSummary, MemberRole, MonsterTemplate } from "@shared/types";

import {
  acceptCampaignInvite,
  assignActorToMapRecord,
  createActorRecord,
  createCampaignRecord,
  createInviteRecord,
  createMapRecord,
  createMonsterActorRecord,
  deleteActorRecord,
  fetchCampaigns,
  removeActorFromMapRecord,
  removeTokenRecord,
  saveActorRecord,
  saveMapRecord
} from "./campaignService";
import { createClientActorDraft, createClientMapDraft, cloneMap } from "../../lib/drafts";
import { toErrorMessage } from "../../lib/errors";
import type { BannerState } from "./types";

interface InviteDraft {
  label: string;
  role: MemberRole;
}

interface UseCampaignManagementActionsOptions {
  token?: string;
  currentUserId?: string;
  selectedCampaignId: string | null;
  selectedActorId: string | null;
  activeMap: CampaignMap | null;
  createCampaignName: string;
  joinCode: string;
  inviteDraft: InviteDraft;
  actorCreatorKind: ActorKind;
  setCampaigns: Dispatch<SetStateAction<CampaignSummary[]>>;
  setSelectedCampaignId: (campaignId: string | null, options?: { replace?: boolean }) => void;
  setSnapshot: Dispatch<SetStateAction<CampaignSnapshot | null>>;
  setSelectedActorId: Dispatch<SetStateAction<string | null>>;
  setActorDraft: Dispatch<SetStateAction<ActorSheet | null>>;
  setActorCreatorOpen: Dispatch<SetStateAction<boolean>>;
  setCreateCampaignName: Dispatch<SetStateAction<string>>;
  setJoinCode: Dispatch<SetStateAction<string>>;
  setNewMapDraft: Dispatch<SetStateAction<CampaignMap>>;
  setSelectedMapId: Dispatch<SetStateAction<string | null>>;
  setMapDraft: Dispatch<SetStateAction<CampaignMap | null>>;
  setMapEditorMode: Dispatch<SetStateAction<"create" | "edit" | null>>;
  onStatus: (tone: BannerState["tone"], text: string) => void;
}

export function useCampaignManagementActions({
  token,
  currentUserId,
  selectedCampaignId,
  selectedActorId,
  activeMap,
  createCampaignName,
  joinCode,
  inviteDraft,
  actorCreatorKind,
  setCampaigns,
  setSelectedCampaignId,
  setSnapshot,
  setSelectedActorId,
  setActorDraft,
  setActorCreatorOpen,
  setCreateCampaignName,
  setJoinCode,
  setNewMapDraft,
  setSelectedMapId,
  setMapDraft,
  setMapEditorMode,
  onStatus
}: UseCampaignManagementActionsOptions) {
  const refreshCampaigns = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const nextCampaigns = await fetchCampaigns(token);
      setCampaigns(nextCampaigns);

      if (selectedCampaignId && !nextCampaigns.some((entry) => entry.id === selectedCampaignId)) {
        setSelectedCampaignId(null);
        setSnapshot(null);
      }
    } catch (error) {
      onStatus("error", toErrorMessage(error));
    }
  }, [onStatus, selectedCampaignId, setCampaigns, setSelectedCampaignId, setSnapshot, token]);

  const createCampaign = useCallback(async () => {
    if (!token || !createCampaignName.trim()) {
      return;
    }

    try {
      const created = await createCampaignRecord(token, createCampaignName.trim());

      setCreateCampaignName("");
      await refreshCampaigns();
      setSelectedCampaignId(created.id);
      onStatus("info", "Campaign created.");
    } catch (error) {
      onStatus("error", toErrorMessage(error));
    }
  }, [createCampaignName, onStatus, refreshCampaigns, setCreateCampaignName, setSelectedCampaignId, token]);

  const acceptInvite = useCallback(async () => {
    if (!token || !joinCode.trim()) {
      return;
    }

    try {
      const joined = await acceptCampaignInvite(token, joinCode.trim());

      setJoinCode("");
      await refreshCampaigns();
      setSelectedCampaignId(joined.id);
      onStatus("info", "Campaign joined.");
    } catch (error) {
      onStatus("error", toErrorMessage(error));
    }
  }, [joinCode, onStatus, refreshCampaigns, setJoinCode, setSelectedCampaignId, token]);

  const createActor = useCallback(
    async (nextDraft: ActorSheet) => {
      if (!token || !selectedCampaignId || !nextDraft.name.trim()) {
        return;
      }

      try {
        const created = await createActorRecord(token, selectedCampaignId, {
          name: nextDraft.name.trim(),
          kind: nextDraft.kind
        });

        const draftToSave: ActorSheet = {
          ...nextDraft,
          id: created.id,
          campaignId: created.campaignId,
          ownerId: created.ownerId,
          name: nextDraft.name.trim()
        };

        await saveActorRecord(token, selectedCampaignId, draftToSave);

        setSelectedActorId(created.id);
        setActorDraft(createClientActorDraft(actorCreatorKind, currentUserId));
        setActorCreatorOpen(false);
        onStatus("info", `${draftToSave.name} added to the roster.`);
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [actorCreatorKind, currentUserId, onStatus, selectedCampaignId, setActorCreatorOpen, setActorDraft, setSelectedActorId, token]
  );

  const createInvite = useCallback(async () => {
    if (!token || !selectedCampaignId) {
      return;
    }

    try {
      await createInviteRecord(token, selectedCampaignId, inviteDraft);
      onStatus("info", "Invite created.");
    } catch (error) {
      onStatus("error", toErrorMessage(error));
    }
  }, [inviteDraft, onStatus, selectedCampaignId, token]);

  const createMonsterActor = useCallback(
    async (template: MonsterTemplate) => {
      if (!token || !selectedCampaignId) {
        return;
      }

      try {
        const created = await createMonsterActorRecord(token, selectedCampaignId, template.id);

        setSelectedActorId(created.id);
        setActorCreatorOpen(false);
        onStatus("info", `${created.name} added to the roster.`);
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, selectedCampaignId, setActorCreatorOpen, setSelectedActorId, token]
  );

  const assignActorToCurrentMap = useCallback(
    async (actorId: string) => {
      if (!token || !selectedCampaignId || !activeMap) {
        return;
      }

      try {
        await assignActorToMapRecord(token, selectedCampaignId, activeMap.id, actorId);
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [activeMap, onStatus, selectedCampaignId, token]
  );

  const removeActorFromCurrentMap = useCallback(
    async (actorId: string) => {
      if (!token || !selectedCampaignId || !activeMap) {
        return;
      }

      try {
        await removeActorFromMapRecord(token, selectedCampaignId, activeMap.id, actorId);

        if (selectedActorId === actorId) {
          setSelectedActorId(null);
        }
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [activeMap, onStatus, selectedActorId, selectedCampaignId, setSelectedActorId, token]
  );

  const removeToken = useCallback(
    async (tokenId: string, label: string, skipPrompt = false) => {
      if (!token || !selectedCampaignId) {
        return;
      }

      if (!skipPrompt && !window.confirm(`Remove ${label} from the map?`)) {
        return;
      }

      try {
        await removeTokenRecord(token, selectedCampaignId, tokenId);
        onStatus("info", `${label} removed from the map.`);
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, selectedCampaignId, token]
  );

  const deleteActor = useCallback(
    async (actor: ActorSheet) => {
      if (!token || !selectedCampaignId) {
        return;
      }

      if (!window.confirm(`Delete actor ${actor.name}? This also removes its tokens.`)) {
        return;
      }

      try {
        await deleteActorRecord(token, selectedCampaignId, actor.id);

        if (selectedActorId === actor.id) {
          setSelectedActorId(null);
        }

        onStatus("info", `${actor.name} deleted.`);
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, selectedActorId, selectedCampaignId, setSelectedActorId, token]
  );

  const createMap = useCallback(
    async (nextMap: CampaignMap) => {
      if (!token || !selectedCampaignId || !nextMap.name.trim()) {
        return;
      }

      try {
        const created = await createMapRecord(token, selectedCampaignId, {
          ...nextMap,
          name: nextMap.name.trim()
        });

        setNewMapDraft(createClientMapDraft("New Map"));
        setSelectedMapId(created.id);
        setMapDraft(cloneMap(created));
        setMapEditorMode("edit");
        onStatus("info", "Map created.");
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, selectedCampaignId, setMapDraft, setMapEditorMode, setNewMapDraft, setSelectedMapId, token]
  );

  const saveMap = useCallback(
    async (nextMap: CampaignMap) => {
      if (!token || !selectedCampaignId) {
        return;
      }

      try {
        await saveMapRecord(token, selectedCampaignId, nextMap);
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, selectedCampaignId, token]
  );

  const saveActor = useCallback(
    async (nextActor: ActorSheet) => {
      if (!token || !selectedCampaignId) {
        return;
      }

      try {
        await saveActorRecord(token, selectedCampaignId, nextActor);
        onStatus("info", "Sheet saved.");
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, selectedCampaignId, token]
  );

  return {
    refreshCampaigns,
    createCampaign,
    acceptInvite,
    createActor,
    createInvite,
    createMonsterActor,
    assignActorToCurrentMap,
    removeActorFromCurrentMap,
    removeToken,
    deleteActor,
    createMap,
    saveMap,
    saveActor
  };
}
