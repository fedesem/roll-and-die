import { useCallback, useEffect, useState, type FormEvent } from "react";

import type {
  ActorKind,
  ActorSheet,
  AuthPayload,
  CampaignMap,
  MemberRole
} from "@shared/types";

import { AdminPanel } from "./components/AdminPanel";
import { AppTopbar } from "./components/AppTopbar";
import { fetchCurrentUser, login, register } from "./features/auth/authService";
import { useCampaignManagementActions } from "./features/campaign/useCampaignManagementActions";
import { useCampaignDerivedState } from "./features/campaign/useCampaignDerivedState";
import { useDeleteTokenHotkey } from "./features/campaign/useDeleteTokenHotkey";
import { useRoomActions } from "./features/campaign/useRoomActions";
import { useCampaignSummariesQuery } from "./features/campaign/useCampaignSummariesQuery";
import { useRoomRealtimeState } from "./features/campaign/useRoomRealtimeState";
import { useCampaignUiEffects } from "./features/campaign/useCampaignUiEffects";
import type { ActorTypeFilter, BannerState } from "./features/campaign/types";
import { usePersistentState } from "./hooks/usePersistentState";
import { createClientActorDraft, createClientMapDraft, cloneMap } from "./lib/drafts";
import { toErrorMessage } from "./lib/errors";
import { readJson, writeJson } from "./lib/storage";
import { AuthPage, type AuthMode } from "./pages/AuthPage";
import { CampaignLoadingPage } from "./pages/CampaignLoadingPage";
import { CampaignPage } from "./pages/CampaignPage";
import { CampaignsPage } from "./pages/CampaignsPage";
import { useAppRouter } from "./router";
import { useRoomConnection } from "./services/roomConnection";

const sessionStorageKey = "dnd-board-session";
const selectedCampaignStorageKey = "dnd-board-selected-campaign";

export default function App() {
  const { route, navigate } = useAppRouter();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [session, setSession] = usePersistentState<AuthPayload | null>(sessionStorageKey, null);
  const [selectedCampaignId, setSelectedCampaignIdState] = useState<string | null>(() =>
    route.name === "campaign" ? route.campaignId : readJson<string>(selectedCampaignStorageKey)
  );
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

  const setBannerStatus = useCallback((tone: BannerState["tone"], text: string) => {
    setBanner({ tone, text });
  }, []);

  const handleRealtimeError = useCallback(
    (message: string) => {
      setBannerStatus("error", message);
    },
    [setBannerStatus]
  );

  const {
    snapshot,
    setSnapshot,
    roomStatus,
    mapPings,
    viewportRecall,
    movementPreviews,
    measurePreviews,
    enqueuePing,
    removePing,
    handleRoomDisconnect,
    handleRoomStatusChange,
    handleRoomSnapshot,
    handleMovementPreview,
    handleMeasurePreview,
    handleRoomRecall,
    handleRoomError
  } = useRoomRealtimeState({
    isCampaignRoute: route.name === "campaign",
    selectedCampaignId,
    onError: handleRealtimeError
  });

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

  const setSelectedCampaignId = useCallback(
    (nextCampaignId: string | null, options?: { replace?: boolean }) => {
      setSelectedCampaignIdState(nextCampaignId);
      navigate(nextCampaignId ? { name: "campaign", campaignId: nextCampaignId } : { name: "home" }, options);
    },
    [navigate]
  );

  const {
    campaigns,
    isLoading: isCampaignsLoading,
    refreshCampaigns
  } = useCampaignSummariesQuery({
    token: session?.token,
    onError: (message) => setBannerStatus("error", message)
  });

  useEffect(() => {
    if (!session || !selectedCampaignId || isCampaignsLoading) {
      return;
    }

    if (!campaigns.some((entry) => entry.id === selectedCampaignId)) {
      setSelectedCampaignId(null);
      setSnapshot(null);
    }
  }, [campaigns, isCampaignsLoading, selectedCampaignId, session, setSelectedCampaignId, setSnapshot]);

  const {
    campaign,
    role,
    activeMap,
    selectedMap,
    selectedActor,
    fogPreviewUserId,
    boardSeenCells,
    filteredCurrentMapRoster,
    availableActors,
    playerMembers,
    filteredCatalog,
    selectedMonsterTemplate
  } = useCampaignDerivedState({
    snapshot,
    selectedMapId,
    selectedActorId,
    selectedMonsterId,
    dmFogEnabled,
    dmFogUserId,
    currentUserId: session?.user.id,
    actorSearch,
    mapActorSearch,
    actorTypeFilter,
    mapActorTypeFilter,
    monsterQuery
  });

  const {
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
  } = useCampaignManagementActions({
    token: session?.token,
    currentUserId: session?.user.id,
    selectedCampaignId,
    selectedActorId,
    activeMap: activeMap ?? null,
    createCampaignName,
    joinCode,
    inviteDraft,
    actorCreatorKind,
    refreshCampaigns,
    setSelectedCampaignId,
    setSelectedActorId,
    setActorDraft,
    setActorCreatorOpen,
    setCreateCampaignName,
    setJoinCode,
    setNewMapDraft,
    setSelectedMapId,
    setMapDraft,
    setMapEditorMode,
    onStatus: setBannerStatus
  });

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    void fetchCurrentUser(session.token)
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
  }, [session?.token, setSession]);

  useEffect(() => {
    if (route.name === "admin" && session && !session.user.isAdmin) {
      navigate({ name: "home" }, { replace: true });
    }
  }, [navigate, route.name, session]);

  useCampaignUiEffects({
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
    currentUserId: session?.user.id,
    activePopup,
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
  });

  const editingMap = mapEditorMode === "create" ? newMapDraft : mapEditorMode === "edit" ? mapDraft : null;

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const payload = await (authMode === "login" ? login(authForm) : register(authForm));

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

  useDeleteTokenHotkey({
    role,
    activeMap,
    selectedActor,
    tokens: campaign?.tokens ?? [],
    selectedBoardItemCount,
    onDeleteToken: (tokenId, label, skipPrompt) => {
      void removeToken(tokenId, label, skipPrompt);
    }
  });

  const {
    sendChat,
    rollFromSheet,
    moveActor,
    broadcastMovePreview,
    broadcastMeasurePreview,
    createDrawing,
    updateDrawings,
    deleteDrawings,
    clearDrawings,
    pingMap,
    pingAndRecallMap,
    toggleDoor,
    resetFog,
    setEditingMapActive,
    showMap
  } = useRoomActions({
    session,
    selectedCampaignId,
    activeMap: activeMap ?? null,
    editingMap,
    sendRoomMessage,
    enqueuePing,
    removePing,
    onStatus: setBannerStatus
  });

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
          onStatus={setBannerStatus}
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
          campaign={snapshot.campaign}
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
          movementPreviews={movementPreviews}
          measurePreviews={measurePreviews}
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
          onResetFog={resetFog}
          onSelectedMapItemCountChange={setSelectedBoardItemCount}
          onMoveActor={moveActor}
          onBroadcastMovePreview={broadcastMovePreview}
          onBroadcastMeasurePreview={broadcastMeasurePreview}
          onToggleDoor={toggleDoor}
          onCreateDrawing={createDrawing}
          onUpdateDrawings={updateDrawings}
          onDeleteDrawings={deleteDrawings}
          onClearDrawings={clearDrawings}
          onPing={pingMap}
          onPingAndRecall={pingAndRecallMap}
          onSendChat={sendChat}
          onSaveActor={saveActor}
          onRoll={rollFromSheet}
          onActorSearchChange={setActorSearch}
          onMapActorSearchChange={setMapActorSearch}
          onActorTypeFilterChange={setActorTypeFilter}
          onMapActorTypeFilterChange={setMapActorTypeFilter}
          onActorCreatorOpenChange={setActorCreatorOpen}
          onActorCreatorKindChange={setActorCreatorKind}
          onCreateActor={createActor}
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
