import { useCallback, useEffect, useState } from "react";

import type { CampaignMap, CampaignSourceBook } from "@shared/types";

import { AppRouteContent } from "./app/AppRouteContent";
import { useAppRoute } from "./appRouteState";
import { AppTopbar } from "./components/AppTopbar";
import { useBannerState } from "./features/app/useBannerState";
import { useAuthSession } from "./features/auth/useAuthSession";
import { useCampaignManagementActions } from "./features/campaign/useCampaignManagementActions";
import { useCampaignDerivedState } from "./features/campaign/useCampaignDerivedState";
import { useDeleteTokenHotkey } from "./features/campaign/useDeleteTokenHotkey";
import { useCampaignWorkspaceState } from "./features/campaign/useCampaignWorkspaceState";
import { useMapEditorState } from "./features/campaign/useMapEditorState";
import { useRoomActions } from "./features/campaign/useRoomActions";
import { useCampaignSummariesQuery } from "./features/campaign/useCampaignSummariesQuery";
import { useRoomRealtimeState } from "./features/campaign/useRoomRealtimeState";
import { useCampaignUiEffects } from "./features/campaign/useCampaignUiEffects";
import { readJson, writeJson } from "./lib/storage";
import { AuthPage } from "./pages/AuthPage";
import { useRoomConnection } from "./services/roomConnection";

const selectedCampaignStorageKey = "dnd-board-selected-campaign";

export default function App() {
  const { route, navigate } = useAppRoute();
  const isCampaignRoute = route.name === "campaign" || route.name === "campaignBoard";
  const isCampaignBoardRoute = route.name === "campaignBoard";
  const [selectedCampaignId, setSelectedCampaignIdState] = useState<string | null>(() =>
    isCampaignRoute ? route.campaignId : readJson<string>(selectedCampaignStorageKey)
  );
  const [createCampaignName, setCreateCampaignName] = useState("");
  const [createCampaignAllowedSourceBooks, setCreateCampaignAllowedSourceBooks] = useState<string[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const { banner, setBanner, setBannerStatus } = useBannerState();
  const { authMode, authForm, authError, session, setSession, handleAuthFormChange, handleAuthModeChange, handleAuthSubmit } =
    useAuthSession({
      route,
      setJoinCode,
      onBanner: setBannerStatus
    });
  const {
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
  } = useCampaignWorkspaceState({
    currentUserId: session?.user.id
  });
  const {
    mapDraft,
    setMapDraft,
    newMapDraft,
    setNewMapDraft,
    mapEditorMode,
    setMapEditorMode,
    editingMap,
    canUndoEditingMap,
    canRedoEditingMap,
    canPersistEditingMap,
    resetMapEditorHistory,
    openMapEditorForCreate,
    openMapEditorForEdit,
    changeEditingMap,
    reloadEditingMap,
    undoEditingMap,
    redoEditingMap
  } = useMapEditorState();

  useEffect(() => {
    writeJson(selectedCampaignStorageKey, selectedCampaignId);
  }, [selectedCampaignId]);

  useEffect(() => {
    if (route.name === "campaign" || route.name === "campaignBoard") {
      setSelectedCampaignIdState((current) => (current === route.campaignId ? current : route.campaignId));
    }
  }, [route]);

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
      void navigate(nextCampaignId ? { name: "campaign", campaignId: nextCampaignId } : { name: "campaigns" }, options);
    },
    [navigate]
  );

  const openCampaignHome = useCallback(() => {
    if (!selectedCampaignId) {
      return;
    }

    setActivePopup(null);
    void navigate({ name: "campaign", campaignId: selectedCampaignId });
  }, [navigate, selectedCampaignId, setActivePopup]);

  const openCampaignBoard = useCallback(() => {
    if (!selectedCampaignId) {
      return;
    }

    setActivePopup(null);
    void navigate({ name: "campaignBoard", campaignId: selectedCampaignId });
  }, [navigate, selectedCampaignId, setActivePopup]);

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
    if (route.name === "admin" && session && !session.user.isAdmin) {
      void navigate({ name: "campaigns" }, { replace: true });
    }
  }, [navigate, route.name, session]);

  useEffect(() => {
    if (!session?.token || route.name !== "campaignJoin" || !route.code || inviteLinkConsumed === route.code) {
      return;
    }

    setInviteLinkConsumed(route.code);
    setJoinCode(route.code);
    void acceptInvite(route.code);
  }, [acceptInvite, inviteLinkConsumed, route, session?.token, setInviteLinkConsumed]);

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

  const handleLogout = useCallback(() => {
    setSession(null);
    setSnapshot(null);
    setSelectedCampaignId(null);
    setActivePopup(null);
    setBanner(null);
  }, [setActivePopup, setBanner, setSelectedCampaignId, setSession, setSnapshot]);

  const handleOpenMapEditorForEdit = useCallback(
    (map: CampaignMap) => {
      openMapEditorForEdit(map, (mapId) => setSelectedMapId(mapId));
    },
    [openMapEditorForEdit, setSelectedMapId]
  );

  const saveEditingMap = useCallback(() => {
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
  }, [canPersistEditingMap, createMap, editingMap, mapDraft, mapEditorMode, newMapDraft, resetMapEditorHistory, saveMap]);

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
        onOpenAdmin={() => void navigate({ name: "admin" })}
        onOpenCampaigns={() => void navigate({ name: "campaigns" })}
        onLogout={handleLogout}
      />

      <AppRouteContent
        route={route}
        selectedCampaignId={selectedCampaignId}
        snapshot={snapshot}
        roomStatus={roomStatus}
        session={session}
        campaignSourceBooks={campaignSourceBooks}
        createCampaignName={createCampaignName}
        createCampaignAllowedSourceBooks={createCampaignAllowedSourceBooks}
        joinCode={joinCode}
        campaigns={campaigns}
        role={role}
        activeMap={activeMap}
        selectedMap={selectedMap ?? undefined}
        selectedActor={selectedActor}
        activePopup={activePopup}
        editingMap={editingMap}
        mapEditorMode={mapEditorMode}
        filteredSelectedMapRoster={filteredSelectedMapRoster}
        availableActors={availableActors}
        selectedMapReusableActors={selectedMapReusableActors}
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
        navigate={navigate}
        refreshCampaignSourceBooks={refreshCampaignSourceBooks}
        setCreateCampaignName={setCreateCampaignName}
        setCreateCampaignAllowedSourceBooks={setCreateCampaignAllowedSourceBooks}
        setJoinCode={setJoinCode}
        setSelectedCampaignId={setSelectedCampaignId}
        setActivePopup={setActivePopup}
        setSelectedMapId={setSelectedMapId}
        setSelectedActorId={setSelectedActorId}
        setActorSearch={setActorSearch}
        setActorTypeFilter={setActorTypeFilter}
        setActorCreatorOpen={setActorCreatorOpen}
        setActorCreatorKind={setActorCreatorKind}
        setMonsterQuery={setMonsterQuery}
        setSelectedMonsterId={(value) => setSelectedMonsterId(value)}
        setMapEditorMode={setMapEditorMode}
        setInviteDraft={setInviteDraft}
        setBanner={setBanner}
        setSelectedBoardItemCount={setSelectedBoardItemCount}
        setDmFogEnabled={setDmFogEnabled}
        setDmFogUserId={setDmFogUserId}
        openCampaignBoard={openCampaignBoard}
        openCampaignHome={openCampaignHome}
        createCampaign={createCampaign}
        acceptInvite={acceptInvite}
        createActor={createActor}
        createInvite={createInvite}
        removeInvite={removeInvite}
        createMonsterActor={createMonsterActor}
        assignActorToMap={assignActorToMap}
        removeActorFromMap={removeActorFromMap}
        deleteActor={deleteActor}
        saveActor={saveActor}
        showMap={showMap}
        openMapEditorForCreate={openMapEditorForCreate}
        openMapEditorForEdit={handleOpenMapEditorForEdit}
        changeEditingMap={changeEditingMap}
        saveEditingMap={saveEditingMap}
        reloadEditingMap={reloadEditingMap}
        undoEditingMap={undoEditingMap}
        redoEditingMap={redoEditingMap}
        setEditingMapActive={setEditingMapActive}
        resetFog={resetFog}
        clearFog={clearFog}
        moveActor={moveActor}
        broadcastMovePreview={broadcastMovePreview}
        broadcastMeasurePreview={broadcastMeasurePreview}
        toggleDoor={toggleDoor}
        toggleDoorLock={toggleDoorLock}
        createDrawing={createDrawing}
        updateDrawings={updateDrawings}
        deleteDrawings={deleteDrawings}
        clearDrawings={clearDrawings}
        pingMap={pingMap}
        pingAndRecallMap={pingAndRecallMap}
        sendChat={sendChat}
        rollFromSheet={rollFromSheet}
        updateToken={updateToken}
      />

      {banner && (
        <button type="button" className={`toast ${banner.tone}`} onClick={() => setBanner(null)} aria-label="Dismiss notification">
          {banner.text}
        </button>
      )}
    </div>
  );
}

function syncSelectedCampaignSourceBooks(current: string[], availableBooks: CampaignSourceBook[]) {
  const availableSources = availableBooks.map((entry) => entry.source);

  if (availableSources.length === 0) {
    return [];
  }

  const normalizedCurrent = current.filter((entry) => availableSources.includes(entry));
  return normalizedCurrent.length > 0 ? normalizedCurrent : availableSources;
}
