import { useCallback, useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";

import type {
  ActorKind,
  ActorSheet,
  AuthPayload,
  CampaignMap,
  CampaignSnapshot,
  CampaignSummary,
  ClientRoomMessage,
  DrawingStroke,
  MapPing,
  MapViewportRecall,
  MeasurePreview,
  MemberRole,
  MonsterTemplate,
  Point,
  ServerRoomMessage,
  TokenMovementPreview
} from "@shared/types";

import { apiRequest } from "./api";
import { AdminPanel } from "./components/AdminPanel";
import { AppTopbar } from "./components/AppTopbar";
import { createClientActorDraft, createClientMapDraft, cloneMap, formatMonsterModifier } from "./lib/drafts";
import { toErrorMessage } from "./lib/errors";
import { readJson, writeJson } from "./lib/storage";
import { AuthPage, type AuthMode } from "./pages/AuthPage";
import { CampaignLoadingPage } from "./pages/CampaignLoadingPage";
import { CampaignPage } from "./pages/CampaignPage";
import { CampaignsPage } from "./pages/CampaignsPage";
import { useAppRouter } from "./router";
import { useRoomConnection } from "./services/roomConnection";
import { computeVisibleCellsForUser, tokenCellKey } from "@shared/vision";

const sessionStorageKey = "dnd-board-session";
const selectedCampaignStorageKey = "dnd-board-selected-campaign";

type ActorTypeFilter = "all" | ActorKind;

interface BannerState {
  tone: "info" | "error";
  text: string;
}

interface SharedMovementPreviewState {
  actorId: string;
  mapId: string;
  preview: TokenMovementPreview;
}

interface SharedMeasurePreviewState {
  userId: string;
  mapId: string;
  preview: MeasurePreview;
}

export default function App() {
  const { route, navigate } = useAppRouter();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [session, setSession] = useState<AuthPayload | null>(() => readJson<AuthPayload>(sessionStorageKey));
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [selectedCampaignId, setSelectedCampaignIdState] = useState<string | null>(() =>
    route.name === "campaign" ? route.campaignId : readJson<string>(selectedCampaignStorageKey)
  );
  const [snapshot, setSnapshot] = useState<CampaignSnapshot | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [selectedBoardItemCount, setSelectedBoardItemCount] = useState(0);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [createCampaignName, setCreateCampaignName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [actorSearch, setActorSearch] = useState("");
  const [mapActorSearch, setMapActorSearch] = useState("");
  const [actorTypeFilter, setActorTypeFilter] = useState<ActorTypeFilter>("all");
  const [mapActorTypeFilter, setMapActorTypeFilter] = useState<ActorTypeFilter>("all");
  const [actorCreatorKind, setActorCreatorKind] = useState<ActorKind>("character");
  const [actorCreatorOpen, setActorCreatorOpen] = useState(false);
  const [actorDraft, setActorDraft] = useState<ActorSheet | null>(() => createClientActorDraft("character", session?.user.id));
  const [inviteDraft, setInviteDraft] = useState({ label: "Open seat", role: "player" as MemberRole });
  const [monsterQuery, setMonsterQuery] = useState("");
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null);
  const [mapDraft, setMapDraft] = useState<CampaignMap | null>(null);
  const [newMapDraft, setNewMapDraft] = useState<CampaignMap>(() => createClientMapDraft("New Map"));
  const [mapEditorMode, setMapEditorMode] = useState<"create" | "edit" | null>(null);
  const [dmFogEnabled, setDmFogEnabled] = useState(false);
  const [dmFogUserId, setDmFogUserId] = useState<string | null>(null);
  const [activePopup, setActivePopup] = useState<"sheet" | "actors" | "maps" | "room" | null>(null);
  const [roomStatus, setRoomStatus] = useState<"offline" | "connecting" | "online">("offline");
  const [mapPings, setMapPings] = useState<MapPing[]>([]);
  const [viewportRecall, setViewportRecall] = useState<MapViewportRecall | null>(null);
  const [sharedMovementPreviews, setSharedMovementPreviews] = useState<Record<string, SharedMovementPreviewState>>({});
  const [sharedMeasurePreviews, setSharedMeasurePreviews] = useState<Record<string, SharedMeasurePreviewState>>({});

  const deferredMonsterQuery = useDeferredValue(monsterQuery);

  useEffect(() => {
    if (!banner) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setBanner((current) => (current === banner ? null : current));
    }, 10000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [banner]);

  useEffect(() => {
    writeJson(sessionStorageKey, session);
  }, [session]);

  useEffect(() => {
    writeJson(selectedCampaignStorageKey, selectedCampaignId);
  }, [selectedCampaignId]);

  useEffect(() => {
    if (route.name === "campaign") {
      setSelectedCampaignIdState((current) => (current === route.campaignId ? current : route.campaignId));
    }
  }, [route]);

  useEffect(() => {
    if (route.name === "home" && selectedCampaignId && session) {
      navigate({ name: "campaign", campaignId: selectedCampaignId }, { replace: true });
    }
  }, [navigate, route.name, selectedCampaignId, session]);

  useEffect(() => {
    if (!session) {
      setCampaigns([]);
      setSnapshot(null);
      return;
    }

    void refreshCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    void apiRequest<AuthPayload["user"]>("/auth/me", { token: session.token })
      .then((user) => {
        setSession((current) =>
          current && current.token === session.token
            ? {
                ...current,
                user
              }
            : current
        );
      })
      .catch(() => undefined);
  }, [session?.token]);

  useEffect(() => {
    if (route.name === "admin" && session && !session.user.isAdmin) {
      navigate({ name: "home" }, { replace: true });
    }
  }, [navigate, route.name, session]);

  const handleRoomDisconnect = useCallback(() => {
    setSnapshot(null);
    setMapPings([]);
    setViewportRecall(null);
    setSharedMovementPreviews({});
    setSharedMeasurePreviews({});
  }, []);

  const handleRoomStatusChange = useCallback((status: "offline" | "connecting" | "online") => {
    setRoomStatus(status);
  }, []);

  const handleRoomSnapshot = useCallback((nextSnapshot: CampaignSnapshot) => {
    setSnapshot(nextSnapshot);
  }, []);

  const handleMovementPreview = useCallback((actorId: string, mapId: string, preview: TokenMovementPreview | null) => {
    setSharedMovementPreviews((current) => {
      if (!preview) {
        if (!current[actorId]) {
          return current;
        }

        const next = { ...current };
        delete next[actorId];
        return next;
      }

      return {
        ...current,
        [actorId]: {
          actorId,
          mapId,
          preview
        }
      };
    });
  }, []);

  const handleMeasurePreview = useCallback((userId: string, mapId: string, preview: MeasurePreview | null) => {
    setSharedMeasurePreviews((current) => {
      if (!preview) {
        if (!current[userId]) {
          return current;
        }

        const next = { ...current };
        delete next[userId];
        return next;
      }

      return {
        ...current,
        [userId]: {
          userId,
          mapId,
          preview
        }
      };
    });
  }, []);

  const enqueuePing = useCallback((ping: MapPing) => {
    setMapPings((current) => (current.some((entry) => entry.id === ping.id) ? current : [...current, ping]));
    window.setTimeout(() => {
      setMapPings((current) => current.filter((entry) => entry.id !== ping.id));
    }, 2200);
  }, []);

  const handleRoomRecall = useCallback((recall: MapViewportRecall) => {
    setViewportRecall(recall);
  }, []);

  const handleRoomError = useCallback((message: string) => {
    setBanner({ tone: "error", text: message });
  }, []);

  const { sendRoomMessage } = useRoomConnection({
    enabled: Boolean(session && selectedCampaignId && route.name === "campaign"),
    campaignId: selectedCampaignId,
    token: session?.token,
    onDisconnect: handleRoomDisconnect,
    onStatusChange: handleRoomStatusChange,
    onSnapshot: handleRoomSnapshot,
    onMovementPreview: handleMovementPreview,
    onMeasurePreview: handleMeasurePreview,
    onPing: enqueuePing,
    onViewRecall: handleRoomRecall,
    onError: handleRoomError
  });

  useEffect(() => {
    if (route.name !== "campaign") {
      setSnapshot(null);
    }
  }, [route.name]);

  useEffect(() => {
    setMapPings([]);
    setViewportRecall(null);
    setSharedMovementPreviews({});
    setSharedMeasurePreviews({});
  }, [selectedCampaignId]);

  function setSelectedCampaignId(nextCampaignId: string | null, options?: { replace?: boolean }) {
    setSelectedCampaignIdState(nextCampaignId);
    navigate(nextCampaignId ? { name: "campaign", campaignId: nextCampaignId } : { name: "home" }, options);
  }

  const campaign = snapshot?.campaign;
  const role = snapshot?.role ?? "player";
  const activeMap = useMemo(
    () => campaign?.maps.find((entry) => entry.id === campaign.activeMapId) ?? campaign?.maps[0],
    [campaign?.activeMapId, campaign?.maps]
  );
  const selectedMap = useMemo(
    () => campaign?.maps.find((entry) => entry.id === selectedMapId) ?? activeMap,
    [activeMap, campaign?.maps, selectedMapId]
  );
  const selectedActor = useMemo(
    () => campaign?.actors.find((entry) => entry.id === selectedActorId) ?? null,
    [campaign?.actors, selectedActorId]
  );
  const activeMapTokens = useMemo(
    () => campaign?.tokens.filter((token) => token.mapId === activeMap?.id && token.visible) ?? [],
    [activeMap?.id, campaign?.tokens]
  );
  const fogPreviewUserId = role === "dm" && dmFogEnabled ? dmFogUserId ?? undefined : undefined;
  const boardSeenCells = activeMap
    ? role === "dm"
      ? fogPreviewUserId
        ? campaign?.exploration[fogPreviewUserId]?.[activeMap.id] ?? []
        : []
      : snapshot?.playerVision[activeMap.id] ?? []
    : [];
  const boardVisibleCells = useMemo(() => {
    if (!activeMap || !campaign || !session) {
      return new Set<string>();
    }

    return computeVisibleCellsForUser({
      map: activeMap,
      actors: campaign.actors,
      tokens: activeMapTokens,
      userId: fogPreviewUserId ?? session.user.id,
      role: role === "dm" && !fogPreviewUserId ? "dm" : "player"
    });
  }, [activeMap, activeMapTokens, campaign, fogPreviewUserId, role, session]);
  const boardSeenCellSet = useMemo(() => new Set(boardSeenCells), [boardSeenCells]);
  const visibleMapTokens = useMemo(() => {
    if (!activeMap) {
      return [];
    }

    if (role === "dm") {
      return activeMapTokens;
    }

    return activeMapTokens.filter((token) => {
      const cell = tokenCellKey(activeMap, token);
      return boardVisibleCells.has(cell) || boardSeenCellSet.has(cell);
    });
  }, [activeMap, activeMapTokens, boardSeenCellSet, boardVisibleCells, role]);
  const activeMapAssignments = useMemo(
    () => campaign?.mapAssignments.filter((assignment) => assignment.mapId === activeMap?.id) ?? [],
    [activeMap?.id, campaign?.mapAssignments]
  );
  const activeMapTokenByActorId = useMemo(
    () => new Map(activeMapTokens.map((token) => [token.actorId, token])),
    [activeMapTokens]
  );
  const visibleMapTokenByActorId = useMemo(
    () => new Map(visibleMapTokens.map((token) => [token.actorId, token])),
    [visibleMapTokens]
  );
  const currentMapRoster = useMemo(
    () =>
      activeMapAssignments.flatMap((assignment) => {
        const actor = campaign?.actors.find((entry) => entry.id === assignment.actorId) ?? null;
        const token = activeMapTokenByActorId.get(assignment.actorId) ?? null;
        const visibleToken = visibleMapTokenByActorId.get(assignment.actorId) ?? null;

        if (role === "dm") {
          if (!actor) {
            return [];
          }

          return [
            {
              actor,
              actorKind: actor.kind,
              assignment,
              color: token?.color ?? actor.color,
              label: token?.label ?? actor.name,
              token
            }
          ];
        }

        if (actor && actor.kind === "character" && actor.ownerId === session?.user.id) {
          return [
            {
              actor,
              actorKind: actor.kind,
              assignment,
              color: token?.color ?? actor.color,
              label: token?.label ?? actor.name,
              token
            }
          ];
        }

        if (!visibleToken) {
          return [];
        }

        return [
          {
            actor: null,
            actorKind: visibleToken.actorKind,
            assignment,
            color: visibleToken.color,
            label: visibleToken.label,
            token: visibleToken
          }
        ];
      }),
    [activeMapAssignments, activeMapTokenByActorId, campaign?.actors, role, session?.user.id, visibleMapTokenByActorId]
  );
  const normalizedActorSearch = actorSearch.trim().toLowerCase();
  const normalizedMapActorSearch = mapActorSearch.trim().toLowerCase();
  const availableActors = useMemo(() => {
    if (role !== "dm" || !campaign) {
      return [];
    }

    return campaign.actors
      .filter((actor) =>
        (actorTypeFilter === "all" || actor.kind === actorTypeFilter) &&
        (normalizedActorSearch
          ? [actor.name, actor.kind, actor.species, actor.className].some((value) =>
              value.toLowerCase().includes(normalizedActorSearch)
            )
          : true)
      )
      .map((actor) => ({
      actor,
      activeMaps: campaign.maps.filter((map) =>
        campaign.mapAssignments.some((assignment) => assignment.actorId === actor.id && assignment.mapId === map.id)
      ),
      onCurrentMap: campaign.mapAssignments.some(
        (assignment) => assignment.actorId === actor.id && assignment.mapId === activeMap?.id
      )
    }));
  }, [activeMap?.id, actorTypeFilter, campaign, normalizedActorSearch, role]);
  const filteredCurrentMapRoster = useMemo(
    () =>
      currentMapRoster.filter(({ actor, actorKind, label }) =>
        (mapActorTypeFilter === "all" || actorKind === mapActorTypeFilter) &&
        (normalizedMapActorSearch
          ? [label, actorKind, actor?.name ?? "", actor?.species ?? ""].some((value) =>
              value.toLowerCase().includes(normalizedMapActorSearch)
            )
          : true)
      ),
    [currentMapRoster, mapActorTypeFilter, normalizedMapActorSearch]
  );
  const playerMembers = useMemo(
    () => campaign?.members.filter((member) => member.role === "player") ?? [],
    [campaign?.members]
  );
  const filteredCatalog = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    const query = deferredMonsterQuery.trim().toLowerCase();

    if (!query) {
      return snapshot.catalog;
    }

    return snapshot.catalog.filter((monster) =>
      [monster.name, monster.source, monster.challengeRating].some((field) =>
        field.toLowerCase().includes(query)
      )
    );
  }, [deferredMonsterQuery, snapshot]);
  const selectedMonsterTemplate = useMemo(
    () => filteredCatalog.find((monster) => monster.id === selectedMonsterId) ?? filteredCatalog[0] ?? null,
    [filteredCatalog, selectedMonsterId]
  );

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
      setActorDraft(createClientActorDraft("character", session?.user.id));
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
  }, [campaign, selectedActorId, selectedMapId]);

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
  }, [dmFogUserId, playerMembers, role]);

  useEffect(() => {
    setMapDraft(selectedMap ? cloneMap(selectedMap) : null);
  }, [selectedMap?.id]);

  useEffect(() => {
    if (!selectedMonsterTemplate) {
      setSelectedMonsterId(filteredCatalog[0]?.id ?? null);
      return;
    }

    if (!filteredCatalog.some((monster) => monster.id === selectedMonsterTemplate.id)) {
      setSelectedMonsterId(filteredCatalog[0]?.id ?? null);
    }
  }, [filteredCatalog, selectedMonsterTemplate]);

  useEffect(() => {
    setActorDraft(createClientActorDraft(actorCreatorKind, session?.user.id));
  }, [actorCreatorKind, session?.user.id]);

  useEffect(() => {
    if (activePopup === "maps") {
      setMapEditorMode(null);
    }
  }, [activePopup]);

  useEffect(() => {
    if (role !== "dm" || !activeMap || !selectedActor) {
      return;
    }

    const token = campaign?.tokens.find((entry) => entry.actorId === selectedActor.id && entry.mapId === activeMap.id);

    if (!token) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;

      if (event.defaultPrevented || selectedBoardItemCount > 0) {
        return;
      }

      if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target?.isContentEditable) {
        return;
      }

      event.preventDefault();
      void removeToken(token.id, token.label, true);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMap, campaign?.tokens, role, selectedActor, selectedBoardItemCount]);

  const editingMap = mapEditorMode === "create" ? newMapDraft : mapEditorMode === "edit" ? mapDraft : null;

  async function refreshCampaigns() {
    if (!session) {
      return;
    }

    try {
      const nextCampaigns = await apiRequest<CampaignSummary[]>("/campaigns", { token: session.token });
      setCampaigns(nextCampaigns);

      if (selectedCampaignId && !nextCampaigns.some((entry) => entry.id === selectedCampaignId)) {
        setSelectedCampaignId(null);
        setSnapshot(null);
      }
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const payload = await apiRequest<AuthPayload>(authMode === "login" ? "/auth/login" : "/auth/register", {
        method: "POST",
        body: authForm
      });

      setSession(payload);
      setBanner({ tone: "info", text: authMode === "login" ? "Signed in." : "Account created." });
      setAuthForm({ name: "", email: "", password: "" });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  function handleLogout() {
    setSession(null);
    setSnapshot(null);
    setSelectedCampaignId(null);
    setActivePopup(null);
    setBanner(null);
  }

  async function createCampaign() {
    if (!session || !createCampaignName.trim()) {
      return;
    }

    try {
      const created = await apiRequest<CampaignSummary>("/campaigns", {
        method: "POST",
        token: session.token,
        body: { name: createCampaignName.trim() }
      });

      setCreateCampaignName("");
      await refreshCampaigns();
      setSelectedCampaignId(created.id);
      setBanner({ tone: "info", text: "Campaign created." });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function acceptInvite() {
    if (!session || !joinCode.trim()) {
      return;
    }

    try {
      const joined = await apiRequest<CampaignSummary>("/invites/accept", {
        method: "POST",
        token: session.token,
        body: { code: joinCode.trim() }
      });

      setJoinCode("");
      await refreshCampaigns();
      setSelectedCampaignId(joined.id);
      setBanner({ tone: "info", text: "Campaign joined." });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function createActor(nextDraft: ActorSheet) {
    if (!session || !selectedCampaignId || !nextDraft.name.trim()) {
      return;
    }

    try {
      const created = await apiRequest<ActorSheet>(`/campaigns/${selectedCampaignId}/actors`, {
        method: "POST",
        token: session.token,
        body: {
          name: nextDraft.name.trim(),
          kind: nextDraft.kind
        }
      });

      const draftToSave: ActorSheet = {
        ...nextDraft,
        id: created.id,
        campaignId: created.campaignId,
        ownerId: created.ownerId,
        name: nextDraft.name.trim()
      };

      await apiRequest<ActorSheet>(`/campaigns/${selectedCampaignId}/actors/${created.id}`, {
        method: "PUT",
        token: session.token,
        body: draftToSave
      });

      setSelectedActorId(created.id);
      setActorDraft(createClientActorDraft(actorCreatorKind, session?.user.id));
      setActorCreatorOpen(false);
      setBanner({ tone: "info", text: `${draftToSave.name} added to the roster.` });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function createInvite() {
    if (!session || !selectedCampaignId) {
      return;
    }

    try {
      await apiRequest(`/campaigns/${selectedCampaignId}/invites`, {
        method: "POST",
        token: session.token,
        body: inviteDraft
      });

      setBanner({ tone: "info", text: "Invite created." });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function createMonsterActor(template: MonsterTemplate) {
    if (!session || !selectedCampaignId) {
      return;
    }

    try {
      const created = await apiRequest<ActorSheet>(`/campaigns/${selectedCampaignId}/monsters`, {
        method: "POST",
        token: session.token,
        body: { templateId: template.id }
      });

      setSelectedActorId(created.id);
      setActorCreatorOpen(false);
      setBanner({ tone: "info", text: `${created.name} added to the roster.` });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function assignActorToCurrentMap(actorId: string) {
    if (!session || !selectedCampaignId || !activeMap) {
      return;
    }

    try {
      await apiRequest(`/campaigns/${selectedCampaignId}/maps/${activeMap.id}/actors`, {
        method: "POST",
        token: session.token,
        body: { actorId }
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function removeActorFromCurrentMap(actorId: string) {
    if (!session || !selectedCampaignId || !activeMap) {
      return;
    }

    try {
      await apiRequest(`/campaigns/${selectedCampaignId}/maps/${activeMap.id}/actors/${actorId}`, {
        method: "DELETE",
        token: session.token
      });

      if (selectedActorId === actorId) {
        setSelectedActorId(null);
      }
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function removeToken(tokenId: string, label: string, skipPrompt = false) {
    if (!session || !selectedCampaignId) {
      return;
    }

    if (!skipPrompt && !window.confirm(`Remove ${label} from the map?`)) {
      return;
    }

    try {
      await apiRequest(`/campaigns/${selectedCampaignId}/tokens/${tokenId}`, {
        method: "DELETE",
        token: session.token
      });
      setBanner({ tone: "info", text: `${label} removed from the map.` });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function deleteActor(actor: ActorSheet) {
    if (!session || !selectedCampaignId) {
      return;
    }

    if (!window.confirm(`Delete actor ${actor.name}? This also removes its tokens.`)) {
      return;
    }

    try {
      await apiRequest(`/campaigns/${selectedCampaignId}/actors/${actor.id}`, {
        method: "DELETE",
        token: session.token
      });

      if (selectedActorId === actor.id) {
        setSelectedActorId(null);
      }

      setBanner({ tone: "info", text: `${actor.name} deleted.` });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function createMap(nextMap: CampaignMap) {
    if (!session || !selectedCampaignId || !nextMap.name.trim()) {
      return;
    }

    try {
      const created = await apiRequest<CampaignMap>(`/campaigns/${selectedCampaignId}/maps`, {
        method: "POST",
        token: session.token,
        body: {
          ...nextMap,
          name: nextMap.name.trim()
        }
      });

      setNewMapDraft(createClientMapDraft("New Map"));
      setSelectedMapId(created.id);
      setMapDraft(cloneMap(created));
      setMapEditorMode("edit");
      setBanner({ tone: "info", text: "Map created." });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function saveMap(nextMap: CampaignMap) {
    if (!session || !selectedCampaignId) {
      return;
    }

    try {
      await apiRequest<CampaignMap>(`/campaigns/${selectedCampaignId}/maps/${nextMap.id}`, {
        method: "PUT",
        token: session.token,
        body: nextMap
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function saveActor(nextActor: ActorSheet) {
    if (!session || !selectedCampaignId) {
      return;
    }

    try {
      await apiRequest<ActorSheet>(`/campaigns/${selectedCampaignId}/actors/${nextActor.id}`, {
        method: "PUT",
        token: session.token,
        body: nextActor
      });

      setBanner({ tone: "info", text: "Sheet saved." });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function sendChat(text: string) {
    if (!selectedCampaignId) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "chat:send",
        text
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function rollFromSheet(notation: string, label: string) {
    if (!selectedCampaignId) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "roll:send",
        notation,
        label
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function moveActor(actorId: string, x: number, y: number) {
    if (!selectedCampaignId) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "token:move",
        actorId,
        x,
        y
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function broadcastMovePreview(actorId: string, target: Point | null) {
    if (!selectedCampaignId) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "token:preview",
        actorId,
        target
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function broadcastMeasurePreview(preview: MeasurePreview | null) {
    if (!selectedCampaignId) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "measure:preview",
        preview
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function createDrawing(mapId: string, stroke: DrawingStroke) {
    if (!selectedCampaignId) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "drawing:create",
        mapId,
        stroke
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function updateDrawings(mapId: string, drawings: Array<{ id: string; points: Point[]; rotation: number }>) {
    if (!selectedCampaignId || drawings.length === 0) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "drawing:update",
        mapId,
        drawings
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function deleteDrawings(mapId: string, drawingIds: string[]) {
    if (!selectedCampaignId || drawingIds.length === 0) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "drawing:delete",
        mapId,
        drawingIds
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function clearDrawings(mapId: string) {
    if (!selectedCampaignId) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "drawing:clear",
        mapId
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function pingMap(point: Point) {
    if (!selectedCampaignId || !activeMap || !session) {
      return;
    }

    const ping: MapPing = {
      id: `png_${crypto.randomUUID().slice(0, 8)}`,
      mapId: activeMap.id,
      point,
      userId: session.user.id,
      userName: session.user.name,
      createdAt: new Date().toISOString()
    };

    enqueuePing(ping);

    try {
      await sendRoomMessage({
        type: "map:ping",
        pingId: ping.id,
        mapId: activeMap.id,
        point
      });
    } catch (error) {
      setMapPings((current) => current.filter((entry) => entry.id !== ping.id));
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function pingAndRecallMap(point: Point, center: Point, zoom: number) {
    if (!selectedCampaignId || !activeMap || !session) {
      return;
    }

    const ping: MapPing = {
      id: `png_${crypto.randomUUID().slice(0, 8)}`,
      mapId: activeMap.id,
      point,
      userId: session.user.id,
      userName: session.user.name,
      createdAt: new Date().toISOString()
    };

    enqueuePing(ping);

    try {
      await sendRoomMessage({
        type: "map:ping-recall",
        pingId: ping.id,
        mapId: activeMap.id,
        point,
        center,
        zoom
      });
    } catch (error) {
      setMapPings((current) => current.filter((entry) => entry.id !== ping.id));
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function toggleDoor(doorId: string) {
    if (!selectedCampaignId) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "door:toggle",
        doorId
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function resetFog() {
    if (!selectedCampaignId || !activeMap) {
      return;
    }

    if (!window.confirm(`Reset remembered fog for all players on ${activeMap.name}?`)) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "fog:reset",
        mapId: activeMap.id
      });
      setBanner({ tone: "info", text: "Fog memory reset for the active map." });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  function handleAuthFormChange(field: "name" | "email" | "password", value: string) {
    setAuthForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function openMapEditorForCreate() {
    setNewMapDraft(createClientMapDraft("New Map"));
    setMapEditorMode("create");
  }

  function openMapEditorForEdit(map: CampaignMap) {
    setSelectedMapId(map.id);
    setMapDraft(cloneMap(map));
    setMapEditorMode("edit");
  }

  function changeEditingMap(nextMap: CampaignMap) {
    if (mapEditorMode === "create") {
      setNewMapDraft(nextMap);
      return;
    }

    setMapDraft(nextMap);
  }

  function reloadEditingMap() {
    if (mapEditorMode === "create") {
      setNewMapDraft(createClientMapDraft("New Map"));
      return;
    }

    if (selectedMap) {
      setMapDraft(cloneMap(selectedMap));
    }
  }

  function saveEditingMap() {
    if (mapEditorMode === "create") {
      void createMap(newMapDraft);
      return;
    }

    if (mapDraft) {
      void saveMap(mapDraft);
    }
  }

  function setEditingMapActive() {
    if (!editingMap) {
      return;
    }

    void sendRoomMessage({ type: "map:set-active", mapId: editingMap.id }).catch((error: unknown) => {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    });
  }

  function showMap(mapId: string) {
    void sendRoomMessage({ type: "map:set-active", mapId }).catch((error: unknown) => {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    });
  }

  if (!session) {
    return (
      <AuthPage
        authMode={authMode}
        authForm={authForm}
        onAuthModeChange={setAuthMode}
        onAuthFormChange={handleAuthFormChange}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  return (
    <div className={`app-shell workspace-shell${selectedCampaignId && snapshot ? " is-room-active" : ""}`}>
      <AppTopbar
        userName={session.user.name}
        isAdmin={session.user.isAdmin}
        isAdminRoute={route.name === "admin"}
        campaignName={campaign?.name}
        activeMapName={activeMap?.name}
        role={route.name === "campaign" ? role : undefined}
        roomStatus={roomStatus}
        showRoomStatus={route.name === "campaign" && Boolean(campaign)}
        onOpenAdmin={() => navigate({ name: "admin" })}
        onOpenCampaigns={() => setSelectedCampaignId(null)}
        onLogout={handleLogout}
      />

      {route.name === "admin" ? (
        <AdminPanel
          token={session.token}
          currentUserId={session.user.id}
          onStatus={(tone, text) => {
            setBanner({ tone, text });
          }}
        />
      ) : !selectedCampaignId ? (
        <CampaignsPage
          campaigns={campaigns}
          createCampaignName={createCampaignName}
          joinCode={joinCode}
          onCreateCampaignNameChange={setCreateCampaignName}
          onJoinCodeChange={setJoinCode}
          onCreateCampaign={() => void createCampaign()}
          onAcceptInvite={() => void acceptInvite()}
          onOpenCampaign={(campaignId) => setSelectedCampaignId(campaignId)}
        />
      ) : route.name !== "campaign" || !snapshot ? (
        <CampaignLoadingPage roomStatus={roomStatus} />
      ) : (
        <CampaignPage
          campaign={campaign}
          role={role}
          currentUserId={session.user.id}
          roomStatus={roomStatus}
          activeMap={activeMap}
          selectedMap={selectedMap ?? undefined}
          selectedActor={selectedActor}
          activePopup={activePopup}
          editingMap={editingMap}
          mapEditorMode={mapEditorMode}
          boardSeenCells={boardSeenCells}
          fogPreviewUserId={fogPreviewUserId}
          playerMembers={playerMembers}
          dmFogEnabled={dmFogEnabled}
          dmFogUserId={dmFogUserId}
          movementPreviews={Object.values(sharedMovementPreviews)}
          measurePreviews={Object.values(sharedMeasurePreviews)}
          mapPings={mapPings}
          viewRecall={viewportRecall}
          filteredCurrentMapRoster={filteredCurrentMapRoster}
          availableActors={availableActors}
          actorSearch={actorSearch}
          mapActorSearch={mapActorSearch}
          actorTypeFilter={actorTypeFilter}
          mapActorTypeFilter={mapActorTypeFilter}
          actorCreatorKind={actorCreatorKind}
          actorCreatorOpen={actorCreatorOpen}
          actorDraft={actorDraft}
          monsterQuery={monsterQuery}
          filteredCatalog={filteredCatalog}
          selectedMonsterTemplate={selectedMonsterTemplate}
          inviteDraft={inviteDraft}
          onSetActivePopup={setActivePopup}
          onSelectActor={setSelectedActorId}
          onSetDmFogEnabled={setDmFogEnabled}
          onSetDmFogUserId={setDmFogUserId}
          onResetFog={() => void resetFog()}
          onSelectedMapItemCountChange={setSelectedBoardItemCount}
          onMoveActor={(actorId, x, y) => void moveActor(actorId, x, y)}
          onBroadcastMovePreview={(actorId, target) => void broadcastMovePreview(actorId, target)}
          onBroadcastMeasurePreview={(preview) => void broadcastMeasurePreview(preview)}
          onToggleDoor={(doorId) => void toggleDoor(doorId)}
          onCreateDrawing={(mapId, stroke) => void createDrawing(mapId, stroke)}
          onUpdateDrawings={(mapId, drawings) => void updateDrawings(mapId, drawings)}
          onDeleteDrawings={(mapId, drawingIds) => void deleteDrawings(mapId, drawingIds)}
          onClearDrawings={(mapId) => void clearDrawings(mapId)}
          onPing={(point) => void pingMap(point)}
          onPingAndRecall={(point, center, zoom) => void pingAndRecallMap(point, center, zoom)}
          onSendChat={(text) => void sendChat(text)}
          onSaveActor={(actor) => void saveActor(actor)}
          onRoll={(notation, label) => void rollFromSheet(notation, label)}
          onActorSearchChange={setActorSearch}
          onMapActorSearchChange={setMapActorSearch}
          onActorTypeFilterChange={setActorTypeFilter}
          onMapActorTypeFilterChange={setMapActorTypeFilter}
          onActorCreatorOpenChange={setActorCreatorOpen}
          onActorCreatorKindChange={setActorCreatorKind}
          onCreateActor={(draft) => void createActor(draft)}
          onMonsterQueryChange={setMonsterQuery}
          onSelectMonster={setSelectedMonsterId}
          onCreateMonsterActor={(monster) => void createMonsterActor(monster)}
          onAssignActorToCurrentMap={(actorId) => void assignActorToCurrentMap(actorId)}
          onRemoveActorFromCurrentMap={(actorId) => void removeActorFromCurrentMap(actorId)}
          onDeleteActor={(actor) => void deleteActor(actor)}
          onShowMap={showMap}
          onStartCreateMap={openMapEditorForCreate}
          onStartEditMap={openMapEditorForEdit}
          onChangeEditingMap={changeEditingMap}
          onSaveEditingMap={saveEditingMap}
          onReloadEditingMap={reloadEditingMap}
          onSetEditingMapActive={setEditingMapActive}
          onBackToMapsList={() => setMapEditorMode(null)}
          onMapUploadError={(message) => setBanner({ tone: "error", text: message })}
          onInviteDraftChange={setInviteDraft}
          onCreateInvite={() => void createInvite()}
        />
      )}

      {banner && (
        <button
          type="button"
          className={`toast ${banner.tone}`}
          onClick={() => setBanner(null)}
          aria-label="Dismiss notification"
        >
          {banner.text}
        </button>
      )}
    </div>
  );
}
