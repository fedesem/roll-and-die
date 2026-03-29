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
  removeInviteRecord,
  removeActorFromMapRecord,
  removeTokenRecord,
  saveActorRecord,
  saveMapRecord,
  updateTokenRecord
} from "./campaignService";
import { createClientActorDraft, createClientMapDraft, cloneMap } from "../../lib/drafts";
import { toErrorMessage } from "../../lib/errors";
import type { BannerState, TokenUpdatePatch } from "./types";

interface InviteDraft {
  role: MemberRole;
}

interface UseCampaignManagementActionsOptions {
  token?: string;
  currentUserId?: string;
  selectedCampaignId: string | null;
  selectedActorId: string | null;
  createCampaignName: string;
  createCampaignAllowedSourceBooks: string[];
  joinCode: string;
  inviteDraft: InviteDraft;
  actorCreatorKind: ActorKind;
  refreshCampaigns: () => Promise<CampaignSummary[]>;
  setSelectedCampaignId: (campaignId: string | null, options?: { replace?: boolean }) => void;
  setSelectedActorId: Dispatch<SetStateAction<string | null>>;
  setSnapshot: Dispatch<SetStateAction<CampaignSnapshot | null>>;
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
  createCampaignName,
  createCampaignAllowedSourceBooks,
  joinCode,
  inviteDraft,
  actorCreatorKind,
  refreshCampaigns,
  setSelectedCampaignId,
  setSelectedActorId,
  setSnapshot,
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
  const patchSnapshotMap = useCallback(
    (nextMap: CampaignMap) => {
      setSnapshot((current) => {
        if (!current || current.campaign.id !== selectedCampaignId) {
          return current;
        }

        const existingMapIndex = current.campaign.maps.findIndex((entry) => entry.id === nextMap.id);
        const nextMaps =
          existingMapIndex >= 0
            ? current.campaign.maps.map((entry, index) => (index === existingMapIndex ? nextMap : entry))
            : [...current.campaign.maps, nextMap];

        return {
          ...current,
          campaign: {
            ...current.campaign,
            maps: nextMaps
          }
        };
      });
    },
    [selectedCampaignId, setSnapshot]
  );

  const patchSnapshotToken = useCallback(
    (nextToken: CampaignSnapshot["campaign"]["tokens"][number]) => {
      setSnapshot((current) => {
        if (!current || current.campaign.id !== selectedCampaignId) {
          return current;
        }

        const existingTokenIndex = current.campaign.tokens.findIndex((entry) => entry.id === nextToken.id);
        const nextTokens =
          existingTokenIndex >= 0
            ? current.campaign.tokens.map((entry, index) => (index === existingTokenIndex ? nextToken : entry))
            : [...current.campaign.tokens, nextToken];

        return {
          ...current,
          campaign: {
            ...current.campaign,
            tokens: nextTokens
          }
        };
      });
    },
    [selectedCampaignId, setSnapshot]
  );

  const createCampaign = useCallback(async () => {
    if (!token || !createCampaignName.trim()) {
      return;
    }

    try {
      const created = await createCampaignRecord(token, createCampaignName.trim(), createCampaignAllowedSourceBooks);

      setCreateCampaignName("");
      await refreshCampaigns();
      setSelectedCampaignId(created.id);
      onStatus("info", "Campaign created.");
    } catch (error) {
      onStatus("error", toErrorMessage(error));
    }
  }, [
    createCampaignAllowedSourceBooks,
    createCampaignName,
    onStatus,
    refreshCampaigns,
    setCreateCampaignName,
    setSelectedCampaignId,
    token
  ]);

  const acceptInvite = useCallback(
    async (overrideCode?: string) => {
      const nextCode = (overrideCode ?? joinCode).trim();

      if (!token || !nextCode) {
        return;
      }

      try {
        const joined = await acceptCampaignInvite(token, nextCode);

        setJoinCode("");
        await refreshCampaigns();
        setSelectedCampaignId(joined.id);
        onStatus("info", "Campaign joined.");
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [joinCode, onStatus, refreshCampaigns, setJoinCode, setSelectedCampaignId, token]
  );

  const createActor = useCallback(
    async (nextDraft: ActorSheet, options?: { mapId?: string }) => {
      if (!token || !selectedCampaignId || !nextDraft.name.trim()) {
        return;
      }

      try {
        const created = await createActorRecord(token, selectedCampaignId, {
          name: nextDraft.name.trim(),
          kind: nextDraft.kind,
          mapId: options?.mapId
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

  const removeInvite = useCallback(
    async (inviteId: string) => {
      if (!token || !selectedCampaignId) {
        return;
      }

      try {
        await removeInviteRecord(token, selectedCampaignId, inviteId);
        onStatus("info", "Invite removed.");
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, selectedCampaignId, token]
  );

  const createMonsterActor = useCallback(
    async (template: MonsterTemplate, options?: { mapId?: string }) => {
      if (!token || !selectedCampaignId) {
        return;
      }

      try {
        const created = await createMonsterActorRecord(token, selectedCampaignId, template.id, options?.mapId);

        setSelectedActorId(created.id);
        setActorCreatorOpen(false);
        onStatus("info", `${created.name} added to the roster.`);
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, selectedCampaignId, setActorCreatorOpen, setSelectedActorId, token]
  );

  const assignActorToMap = useCallback(
    async (actorId: string, mapId: string | undefined) => {
      if (!token || !selectedCampaignId || !mapId) {
        return;
      }

      try {
        await assignActorToMapRecord(token, selectedCampaignId, mapId, actorId);
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, selectedCampaignId, token]
  );

  const removeActorFromMap = useCallback(
    async (actorId: string, mapId: string | undefined) => {
      if (!token || !selectedCampaignId || !mapId) {
        return;
      }

      try {
        await removeActorFromMapRecord(token, selectedCampaignId, mapId, actorId);

        if (selectedActorId === actorId) {
          setSelectedActorId(null);
        }
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, selectedActorId, selectedCampaignId, setSelectedActorId, token]
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

  const updateToken = useCallback(
    async (tokenId: string, patch: TokenUpdatePatch) => {
      if (!token || !selectedCampaignId) {
        return;
      }

      try {
        const updated = await updateTokenRecord(token, selectedCampaignId, tokenId, patch);
        patchSnapshotToken(updated);
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, patchSnapshotToken, selectedCampaignId, token]
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

        patchSnapshotMap(created);
        setNewMapDraft(createClientMapDraft("New Map"));
        setSelectedMapId(created.id);
        setMapDraft(cloneMap(created));
        setMapEditorMode("edit");
        onStatus("info", "Map created.");
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, patchSnapshotMap, selectedCampaignId, setMapDraft, setMapEditorMode, setNewMapDraft, setSelectedMapId, token]
  );

  const saveMap = useCallback(
    async (nextMap: CampaignMap) => {
      if (!token || !selectedCampaignId) {
        return;
      }

      try {
        const savedMap = await saveMapRecord(token, selectedCampaignId, nextMap);
        patchSnapshotMap(savedMap);
      } catch (error) {
        onStatus("error", toErrorMessage(error));
      }
    },
    [onStatus, patchSnapshotMap, selectedCampaignId, token]
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
    createCampaign,
    acceptInvite,
    createActor,
    createInvite,
    removeInvite,
    createMonsterActor,
    assignActorToMap,
    removeActorFromMap,
    removeToken,
    updateToken,
    deleteActor,
    createMap,
    saveMap,
    saveActor
  };
}
