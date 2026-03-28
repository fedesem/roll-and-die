import { useCallback, useEffect, useState, type FormEvent } from "react";

import type {
  ActorKind,
  ActorSheet,
  AuthPayload,
  CampaignMap,
  CampaignSourceBook,
  MemberRole
} from "@shared/types";

import { AdminPanel } from "./components/AdminPanel";
import { AppTopbar } from "./components/AppTopbar";
import { toAuthErrorMessage } from "./features/auth/authErrors";
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
import { readJson, writeJson } from "./lib/storage";
import { AuthPage, type AuthMode } from "./pages/AuthPage";
import { CampaignCreatePage } from "./pages/CampaignCreatePage";
import { CampaignHubPage } from "./pages/CampaignHubPage";
import { CampaignJoinPage } from "./pages/CampaignJoinPage";
import { CampaignLoadingPage } from "./pages/CampaignLoadingPage";
import { CampaignPage } from "./pages/CampaignPage";
import { CampaignsPage } from "./pages/CampaignsPage";
import { useAppRouter } from "./router";
import { useRoomConnection } from "./services/roomConnection";

const sessionStorageKey = "dnd-board-session";
const selectedCampaignStorageKey = "dnd-board-selected-campaign";

export default function App() {
  const { route, navigate } = useAppRouter();
  const isCampaignRoute = route.name === "campaign" || route.name === "campaignBoard";
  const isCampaignBoardRoute = route.name === "campaignBoard";
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authError, setAuthError] = useState<string | null>(null);
  const [session, setSession] = usePersistentState<AuthPayload | null>(sessionStorageKey, null);
  const [selectedCampaignId, setSelectedCampaignIdState] = useState<string | null>(() =>
    isCampaignRoute ? route.campaignId : readJson<string>(selectedCampaignStorageKey)
  );
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [selectedBoardItemCount, setSelectedBoardItemCount] = useState(0);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [createCampaignName, setCreateCampaignName] = useState("");
  const [createCampaignAllowedSourceBooks, setCreateCampaignAllowedSourceBooks] = useState<string[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [actorSearch, setActorSearch] = useState("");
  const [mapActorSearch, setMapActorSearch] = useState("");
  const [actorTypeFilter, setActorTypeFilter] = useState<ActorTypeFilter>("all");
  const [mapActorTypeFilter, setMapActorTypeFilter] = useState<ActorTypeFilter>("all");
  const [actorCreatorKind, setActorCreatorKind] = useState<ActorKind>("character");
  const [actorCreatorOpen, setActorCreatorOpen] = useState(false);
  const [actorDraft, setActorDraft] = useState<ActorSheet | null>(() => createClientActorDraft("character", session?.user.id));
  const [inviteDraft, setInviteDraft] = useState({ role: "player" as MemberRole });
  const [monsterQuery, setMonsterQuery] = useState("");
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null);
  const [mapDraft, setMapDraft] = useState<CampaignMap | null>(null);
  const [newMapDraft, setNewMapDraft] = useState<CampaignMap>(() => createClientMapDraft("New Map"));
  const [mapEditorMode, setMapEditorMode] = useState<"create" | "edit" | null>(null);
  const [mapEditorPast, setMapEditorPast] = useState<CampaignMap[]>([]);
  const [mapEditorFuture, setMapEditorFuture] = useState<CampaignMap[]>([]);
  const [mapEditorBaseline, setMapEditorBaseline] = useState<CampaignMap | null>(null);
  const [dmFogEnabled, setDmFogEnabled] = useState(false);
  const [dmFogUserId, setDmFogUserId] = useState<string | null>(null);
  const [activePopup, setActivePopup] = useState<"sheet" | null>(null);
  const [inviteLinkConsumed, setInviteLinkConsumed] = useState<string | null>(null);

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
    if (route.name === "campaign" || route.name === "campaignBoard") {
      setSelectedCampaignIdState((current) => (current === route.campaignId ? current : route.campaignId));
    }
  }, [route]);

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
    handleCampaignPatch,
    handleTokenMoved,
    handleDoorToggled,
    handleMovementPreview,
    handleMeasurePreview,
    handleRoomRecall,
    handleRoomError
  } = useRoomRealtimeState({
    isCampaignRoute,
    selectedCampaignId,
    onError: handleRealtimeError
  });

  const { sendRoomMessage } = useRoomConnection({
    enabled: Boolean(session && selectedCampaignId && isCampaignRoute),
    campaignId: selectedCampaignId,
    token: session?.token,
    onDisconnect: handleRoomDisconnect,
    onStatusChange: handleRoomStatusChange,
    onSnapshot: handleRoomSnapshot,
    onCampaignPatch: handleCampaignPatch,
    onTokenMoved: handleTokenMoved,
    onDoorToggled: handleDoorToggled,
    onMovementPreview: handleMovementPreview,
    onMeasurePreview: handleMeasurePreview,
    onPing: enqueuePing,
    onViewRecall: handleRoomRecall,
    onError: handleRoomError
  });

  const setSelectedCampaignId = useCallback(
    (nextCampaignId: string | null, options?: { replace?: boolean }) => {
      setSelectedCampaignIdState(nextCampaignId);
      navigate(nextCampaignId ? { name: "campaign", campaignId: nextCampaignId } : { name: "campaigns" }, options);
    },
    [navigate]
  );

  const openCampaignHome = useCallback(() => {
    if (!selectedCampaignId) {
      return;
    }

    setActivePopup(null);
    navigate({ name: "campaign", campaignId: selectedCampaignId });
  }, [navigate, selectedCampaignId]);

  const openCampaignBoard = useCallback(() => {
    if (!selectedCampaignId) {
      return;
    }

    setActivePopup(null);
    navigate({ name: "campaignBoard", campaignId: selectedCampaignId });
  }, [navigate, selectedCampaignId]);

  const {
    campaigns,
    campaignSourceBooks,
    isLoading: isCampaignsLoading,
    refreshCampaigns,
    refreshCampaignSourceBooks
  } = useCampaignSummariesQuery({
    token: session?.token,
    onError: (message) => setBannerStatus("error", message)
  });

  useEffect(() => {
    setCreateCampaignAllowedSourceBooks((current) => syncSelectedCampaignSourceBooks(current, campaignSourceBooks));
  }, [campaignSourceBooks]);

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
    filteredSelectedMapRoster,
    selectedMapReusableActors,
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
  } = useCampaignManagementActions({
    token: session?.token,
    currentUserId: session?.user.id,
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
      navigate({ name: "campaigns" }, { replace: true });
    }
  }, [navigate, route.name, session]);

  useEffect(() => {
    if (!session?.token || route.name !== "campaignJoin" || !route.code || inviteLinkConsumed === route.code) {
      return;
    }

    setInviteLinkConsumed(route.code);
    setJoinCode(route.code);
    void acceptInvite(route.code);
  }, [acceptInvite, inviteLinkConsumed, route, session?.token]);

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
  const canUndoEditingMap = mapEditorPast.length > 0;
  const canRedoEditingMap = mapEditorFuture.length > 0;
  const canPersistEditingMap =
    Boolean(editingMap) && Boolean(mapEditorBaseline) && JSON.stringify(editingMap) !== JSON.stringify(mapEditorBaseline);

  function replaceEditingMap(nextMap: CampaignMap) {
    if (mapEditorMode === "create") {
      setNewMapDraft(nextMap);
      return;
    }

    setMapDraft(nextMap);
  }

  function resetMapEditorHistory(baseMap: CampaignMap) {
    setMapEditorBaseline(cloneMap(baseMap));
    setMapEditorPast([]);
    setMapEditorFuture([]);
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const payload = await (authMode === "login" ? login(authForm) : register(authForm));

      setSession(payload);
      setAuthError(null);
      setBanner({ tone: "info", text: authMode === "login" ? "Signed in." : "Account created." });
      setAuthForm({ name: "", email: "", password: "" });
      if (route.name === "campaignJoin" && route.code) {
        setJoinCode(route.code);
      }
    } catch (error) {
      const message = toAuthErrorMessage(authMode, error);
      setAuthError(message);
      setBanner({ tone: "error", text: message });
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
    toggleDoorLock,
    resetFog,
    clearFog,
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
    setAuthError(null);
    setAuthForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleAuthModeChange(mode: AuthMode) {
    setAuthError(null);
    setAuthMode(mode);
  }

  function openMapEditorForCreate() {
    const nextMap = createClientMapDraft("New Map");
    setNewMapDraft(nextMap);
    setMapEditorMode("create");
    resetMapEditorHistory(nextMap);
  }

  function openMapEditorForEdit(map: CampaignMap) {
    setSelectedMapId(map.id);
    const nextMap = cloneMap(map);
    setMapDraft(nextMap);
    setMapEditorMode("edit");
    resetMapEditorHistory(nextMap);
  }

  function changeEditingMap(nextMap: CampaignMap) {
    if (!editingMap) {
      return;
    }

    if (JSON.stringify(editingMap) === JSON.stringify(nextMap)) {
      return;
    }

    setMapEditorPast((current) => [...current, cloneMap(editingMap)]);
    setMapEditorFuture([]);
    replaceEditingMap(nextMap);
  }

  function reloadEditingMap() {
    if (!mapEditorBaseline) {
      return;
    }

    replaceEditingMap(cloneMap(mapEditorBaseline));
    resetMapEditorHistory(mapEditorBaseline);
  }

  function undoEditingMap() {
    if (!editingMap || mapEditorPast.length === 0) {
      return;
    }

    const previous = mapEditorPast[mapEditorPast.length - 1];
    setMapEditorPast((current) => current.slice(0, -1));
    setMapEditorFuture((current) => [cloneMap(editingMap), ...current]);
    replaceEditingMap(cloneMap(previous));
  }

  function redoEditingMap() {
    if (!editingMap || mapEditorFuture.length === 0) {
      return;
    }

    const [next, ...rest] = mapEditorFuture;
    setMapEditorFuture(rest);
    setMapEditorPast((current) => [...current, cloneMap(editingMap)]);
    replaceEditingMap(cloneMap(next));
  }

  function saveEditingMap() {
    if (!canPersistEditingMap || !editingMap) {
      return;
    }

    if (mapEditorMode === "create") {
      resetMapEditorHistory(editingMap);
      void createMap(newMapDraft);
      return;
    }

    if (mapDraft) {
      resetMapEditorHistory(mapDraft);
      void saveMap(mapDraft);
    }
  }

  if (!session) {
    return (
      <AuthPage
        authMode={authMode}
        authForm={authForm}
        authError={authError}
        onAuthModeChange={handleAuthModeChange}
        onAuthFormChange={handleAuthFormChange}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  return (
    <div className={`app-shell workspace-shell${selectedCampaignId && snapshot && isCampaignBoardRoute ? " is-room-active" : ""}`}>
      <AppTopbar
        userName={session.user.name}
        isAdmin={session.user.isAdmin}
        isAdminRoute={route.name === "admin"}
        campaignName={campaign?.name}
        activeMapName={activeMap?.name}
        role={isCampaignRoute ? role : undefined}
        roomStatus={roomStatus}
        showRoomStatus={isCampaignRoute && Boolean(campaign)}
        onOpenAdmin={() => navigate({ name: "admin" })}
        onOpenCampaigns={() => navigate({ name: "campaigns" })}
        onLogout={handleLogout}
      />

      {route.name === "admin" ? (
        <AdminPanel
          token={session.token}
          currentUserId={session.user.id}
          onStatus={setBannerStatus}
          onRefreshSourceBooks={() => refreshCampaignSourceBooks().then(() => undefined)}
        />
      ) : route.name === "campaignCreate" ? (
        <CampaignCreatePage
          campaignSourceBooks={campaignSourceBooks}
          createCampaignName={createCampaignName}
          createCampaignAllowedSourceBooks={createCampaignAllowedSourceBooks}
          onCreateCampaignNameChange={setCreateCampaignName}
          onCreateCampaignAllowedSourceBooksChange={setCreateCampaignAllowedSourceBooks}
          onCreateCampaign={() => void createCampaign()}
          onBack={() => navigate({ name: "campaigns" })}
        />
      ) : route.name === "campaignJoin" ? (
        <CampaignJoinPage
          joinCode={joinCode}
          hasInviteLink={Boolean(route.code)}
          onJoinCodeChange={setJoinCode}
          onAcceptInvite={() => void acceptInvite()}
          onBack={() => navigate({ name: "campaigns" })}
        />
      ) : route.name === "campaigns" || !selectedCampaignId ? (
        <CampaignsPage
          campaigns={campaigns}
          onOpenCampaign={(campaignId) => setSelectedCampaignId(campaignId)}
          onOpenCreateCampaign={() => navigate({ name: "campaignCreate" })}
          onOpenJoinCampaign={() => navigate({ name: "campaignJoin" })}
        />
      ) : !isCampaignRoute || !snapshot ? (
        <CampaignLoadingPage roomStatus={roomStatus} />
      ) : route.name === "campaign" ? (
        <CampaignHubPage
          token={session.token}
          campaign={snapshot.campaign}
          compendium={snapshot.compendium}
          role={role}
          currentUserId={session.user.id}
          activeMap={activeMap}
          selectedMap={selectedMap ?? undefined}
          selectedActor={selectedActor}
          activePopup={activePopup}
          editingMap={editingMap}
          mapEditorMode={mapEditorMode}
          filteredSelectedMapRoster={filteredSelectedMapRoster}
          availableActors={availableActors}
          selectedMapAvailableActors={selectedMapReusableActors}
          actorSearch={actorSearch}
          actorTypeFilter={actorTypeFilter}
          actorCreatorKind={actorCreatorKind}
          actorCreatorOpen={actorCreatorOpen}
          actorDraft={actorDraft}
          monsterQuery={monsterQuery}
          filteredCatalog={filteredCatalog}
          selectedMonsterTemplate={selectedMonsterTemplate}
          inviteDraft={inviteDraft}
          canUndoEditingMap={canUndoEditingMap}
          canRedoEditingMap={canRedoEditingMap}
          canPersistEditingMap={canPersistEditingMap}
          onOpenBoard={openCampaignBoard}
          onSetActivePopup={setActivePopup}
          onSelectMap={setSelectedMapId}
          onSelectActor={setSelectedActorId}
          onRoll={rollFromSheet}
          onSaveActor={saveActor}
          onActorSearchChange={setActorSearch}
          onActorTypeFilterChange={setActorTypeFilter}
          onActorCreatorOpenChange={setActorCreatorOpen}
          onActorCreatorKindChange={setActorCreatorKind}
          onCreateActor={createActor}
          onMonsterQueryChange={setMonsterQuery}
          onSelectMonster={setSelectedMonsterId}
          onCreateMonsterActor={(monster) => void createMonsterActor(monster)}
          onCreateMapActor={async (draft, mapId) => {
            await createActor(draft, { mapId });
          }}
          onCreateMapMonsterActor={async (monster, mapId) => {
            await createMonsterActor(monster, { mapId });
          }}
          onAssignActorToMap={(actorId, mapId) => void assignActorToMap(actorId, mapId)}
          onRemoveActorFromMap={(actorId, mapId) => void removeActorFromMap(actorId, mapId)}
          onDeleteActor={(actor) => void deleteActor(actor)}
          onInviteDraftChange={setInviteDraft}
          onCreateInvite={() => void createInvite()}
          onRemoveInvite={(inviteId) => void removeInvite(inviteId)}
          onShowMap={showMap}
          onStartCreateMap={openMapEditorForCreate}
          onStartEditMap={openMapEditorForEdit}
          onChangeEditingMap={changeEditingMap}
          onSaveEditingMap={saveEditingMap}
          onReloadEditingMap={reloadEditingMap}
          onUndoEditingMap={undoEditingMap}
          onRedoEditingMap={redoEditingMap}
          onSetEditingMapActive={setEditingMapActive}
          onBackToMapsList={() => setMapEditorMode(null)}
          onMapUploadError={(message) => setBanner({ tone: "error", text: message })}
        />
      ) : (
        <CampaignPage
          token={session.token}
          campaign={snapshot.campaign}
          compendium={snapshot.compendium}
          role={role}
          currentUserId={session.user.id}
          activeMap={activeMap}
          selectedMap={selectedMap ?? undefined}
          selectedActor={selectedActor}
          activePopup={activePopup}
          boardSeenCells={boardSeenCells}
          fogPreviewUserId={fogPreviewUserId}
          playerMembers={playerMembers}
          dmFogEnabled={dmFogEnabled}
          dmFogUserId={dmFogUserId}
          selectedMapAvailableActors={selectedMapReusableActors}
          actorCreatorKind={actorCreatorKind}
          filteredCatalog={filteredCatalog}
          selectedMonsterTemplate={selectedMonsterTemplate}
          movementPreviews={movementPreviews}
          measurePreviews={measurePreviews}
          mapPings={mapPings}
          viewRecall={viewportRecall}
          filteredCurrentMapRoster={filteredCurrentMapRoster}
          filteredSelectedMapRoster={filteredSelectedMapRoster}
          editingMap={editingMap}
          mapEditorMode={mapEditorMode}
          canUndoEditingMap={canUndoEditingMap}
          canRedoEditingMap={canRedoEditingMap}
          canPersistEditingMap={canPersistEditingMap}
          onSetActivePopup={setActivePopup}
          onOpenCampaignHome={openCampaignHome}
          onSelectMap={setSelectedMapId}
          onSelectActor={setSelectedActorId}
          onSetDmFogEnabled={setDmFogEnabled}
          onSetDmFogUserId={setDmFogUserId}
          onActorCreatorKindChange={setActorCreatorKind}
          onMonsterQueryChange={setMonsterQuery}
          onSelectMonster={setSelectedMonsterId}
          onResetFog={resetFog}
          onClearFog={clearFog}
          onSelectedMapItemCountChange={setSelectedBoardItemCount}
          onAssignActorToMap={(actorId, mapId) => void assignActorToMap(actorId, mapId)}
          onRemoveActorFromMap={(actorId, mapId) => void removeActorFromMap(actorId, mapId)}
          onShowMap={showMap}
          onStartCreateMap={openMapEditorForCreate}
          onStartEditMap={openMapEditorForEdit}
          onChangeEditingMap={changeEditingMap}
          onSaveEditingMap={saveEditingMap}
          onReloadEditingMap={reloadEditingMap}
          onUndoEditingMap={undoEditingMap}
          onRedoEditingMap={redoEditingMap}
          onSetEditingMapActive={setEditingMapActive}
          onBackToMapsList={() => setMapEditorMode(null)}
          onMapUploadError={(message) => setBanner({ tone: "error", text: message })}
          onCreateMapActor={async (draft, mapId) => {
            await createActor(draft, { mapId });
          }}
          onCreateMapMonsterActor={async (monster, mapId) => {
            await createMonsterActor(monster, { mapId });
          }}
          onMoveActor={moveActor}
          onBroadcastMovePreview={broadcastMovePreview}
          onBroadcastMeasurePreview={broadcastMeasurePreview}
          onToggleDoor={toggleDoor}
          onToggleDoorLock={toggleDoorLock}
          onCreateDrawing={createDrawing}
          onUpdateDrawings={updateDrawings}
          onDeleteDrawings={deleteDrawings}
          onClearDrawings={clearDrawings}
          onPing={pingMap}
          onPingAndRecall={pingAndRecallMap}
          onSendChat={sendChat}
          onSaveActor={saveActor}
          onRoll={rollFromSheet}
          onUpdateToken={updateToken}
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

function syncSelectedCampaignSourceBooks(
  current: string[],
  availableBooks: CampaignSourceBook[]
) {
  const availableSources = availableBooks.map((entry) => entry.source);

  if (availableSources.length === 0) {
    return [];
  }

  const normalizedCurrent = current.filter((entry) => availableSources.includes(entry));
  return normalizedCurrent.length > 0 ? normalizedCurrent : availableSources;
}
