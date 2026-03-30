import { useCallback } from "react";

import type { CampaignHubPageProps } from "../pages/CampaignHubPage";
import type { CampaignPageProps } from "../pages/CampaignPage";
import type { CampaignRouteContextValue, AppNavigation } from "./routeContentTypes";
import type { ActorKind, ActorSheet, CampaignMap, CampaignSnapshot, MeasurePreview, MonsterTemplate, Point } from "@shared/types";
import type { ActorTypeFilter, AvailableActorEntry, CurrentMapRosterEntry, TokenUpdatePatch } from "../features/campaign/types";
import type { RoomStatus } from "../services/roomConnection";

interface UseCampaignRouteModelOptions {
  session: {
    token: string;
    user: {
      id: string;
    };
  } | null;
  snapshot: CampaignSnapshot | null;
  roomStatus: RoomStatus;
  selectedCampaignId: string | null;
  navigation: AppNavigation;
  routeState: {
    role: CampaignHubPageProps["role"];
    activeMap?: CampaignMap;
    selectedMap?: CampaignMap | null;
    selectedActor: ActorSheet | null;
    activePopup: "sheet" | null;
    boardSeenCells: string[];
    fogPreviewUserId?: string;
    playerMembers: CampaignSnapshot["campaign"]["members"];
    dmFogEnabled: boolean;
    dmFogUserId: string | null;
    movementPreviews: Array<{ actorId: string; mapId: string; preview: CampaignPageProps["movementPreviews"][number]["preview"] }>;
    measurePreviews: Array<{ userId: string; mapId: string; preview: MeasurePreview }>;
    mapPings: CampaignPageProps["mapPings"];
    viewRecall: CampaignPageProps["viewRecall"];
    filteredCurrentMapRoster: CurrentMapRosterEntry[];
    filteredSelectedMapRoster: CurrentMapRosterEntry[];
    availableActors: AvailableActorEntry[];
    selectedMapReusableActors: AvailableActorEntry[];
    actorSearch: string;
    actorTypeFilter: ActorTypeFilter;
    actorCreatorKind: ActorKind;
    actorCreatorOpen: boolean;
    actorDraft: ActorSheet | null;
    monsterQuery: string;
    filteredCatalog: MonsterTemplate[];
    selectedMonsterTemplate: MonsterTemplate | null;
    inviteDraft: { role: CampaignHubPageProps["inviteDraft"]["role"] };
    editingMap: CampaignMap | null;
    mapEditorMode: "create" | "edit" | null;
    canUndoEditingMap: boolean;
    canRedoEditingMap: boolean;
    canPersistEditingMap: boolean;
  };
  setters: {
    setBanner: (value: { tone: "info" | "error"; text: string } | null) => void;
    setActivePopup: (popup: "sheet" | null) => void;
    setSelectedMapId: (value: string | null) => void;
    setSelectedActorId: (value: string | null) => void;
    setActorSearch: (value: string) => void;
    setActorTypeFilter: (value: ActorTypeFilter) => void;
    setActorCreatorOpen: (open: boolean) => void;
    setActorCreatorKind: (kind: ActorKind) => void;
    setMonsterQuery: (value: string) => void;
    setSelectedMonsterId: (value: string | null) => void;
    setInviteDraft: (value: { role: CampaignHubPageProps["inviteDraft"]["role"] }) => void;
    setSelectedBoardItemCount: (count: number) => void;
    setDmFogEnabled: (enabled: boolean) => void;
    setDmFogUserId: (userId: string | null) => void;
    setMapEditorMode: (value: "create" | "edit" | null) => void;
  };
  actions: {
    createActor: (draft: ActorSheet, options?: { mapId?: string }) => Promise<void>;
    createMonsterActor: (monster: MonsterTemplate, options?: { mapId?: string }) => Promise<void>;
    assignActorToMap: (actorId: string, mapId: string) => Promise<void>;
    removeActorFromMap: (actorId: string, mapId: string) => Promise<void>;
    deleteActor: (actor: ActorSheet) => Promise<void>;
    createInvite: () => Promise<void>;
    removeInvite: (inviteId: string) => Promise<void>;
    saveActor: (actor: ActorSheet) => Promise<void>;
    saveEditingMap: () => void;
    openMapEditorForCreate: () => void;
    openMapEditorForEdit: (map: CampaignMap) => void;
    changeEditingMap: (map: CampaignMap) => void;
    reloadEditingMap: () => void;
    undoEditingMap: () => void;
    redoEditingMap: () => void;
    setEditingMapActive: () => void;
    showMap: (mapId: string) => void;
    resetFog: () => Promise<void>;
    clearFog: () => Promise<void>;
    moveActor: (actorId: string, x: number, y: number) => Promise<void>;
    broadcastMovePreview: (actorId: string, target: Point | null) => Promise<void>;
    broadcastMeasurePreview: (preview: MeasurePreview | null) => Promise<void>;
    toggleDoor: (doorId: string) => Promise<void>;
    toggleDoorLock: (doorId: string) => Promise<void>;
    createDrawing: CampaignPageProps["onCreateDrawing"];
    updateDrawings: CampaignPageProps["onUpdateDrawings"];
    deleteDrawings: CampaignPageProps["onDeleteDrawings"];
    clearDrawings: (mapId: string) => Promise<void>;
    pingMap: (point: Point) => Promise<void>;
    pingAndRecallMap: (point: Point, center: Point, zoom: number) => Promise<void>;
    sendChat: (text: string) => Promise<void>;
    rollFromSheet: (notation: string, label: string, actor?: ActorSheet | null) => Promise<void>;
    updateToken: (tokenId: string, patch: TokenUpdatePatch) => Promise<void>;
  };
}

export function useCampaignRouteModel({
  session,
  snapshot,
  roomStatus,
  selectedCampaignId,
  navigation,
  routeState,
  setters,
  actions
}: UseCampaignRouteModelOptions): CampaignRouteContextValue | null {
  const handleSelectMonster = useCallback((monsterId: string) => setters.setSelectedMonsterId(monsterId), [setters]);
  const handleBackToMapsList = useCallback(() => setters.setMapEditorMode(null), [setters]);
  const handleMapUploadError = useCallback(
    (message: string) => {
      setters.setBanner({ tone: "error", text: message });
    },
    [setters]
  );
  const handleCreateMapActor = useCallback<CampaignHubPageProps["onCreateMapActor"]>(
    async (draft, mapId) => {
      await actions.createActor(draft, { mapId });
    },
    [actions]
  );
  const handleCreateMapMonsterActor = useCallback<CampaignHubPageProps["onCreateMapMonsterActor"]>(
    async (monster, mapId) => {
      await actions.createMonsterActor(monster, { mapId });
    },
    [actions]
  );
  const handleAssignActorToMap = useCallback<CampaignHubPageProps["onAssignActorToMap"]>(
    (actorId, mapId) => {
      void actions.assignActorToMap(actorId, mapId);
    },
    [actions]
  );
  const handleRemoveActorFromMap = useCallback<CampaignHubPageProps["onRemoveActorFromMap"]>(
    (actorId, mapId) => {
      void actions.removeActorFromMap(actorId, mapId);
    },
    [actions]
  );
  const handleDeleteActor = useCallback<CampaignHubPageProps["onDeleteActor"]>(
    (actor) => {
      void actions.deleteActor(actor);
    },
    [actions]
  );
  const handleCreateInvite = useCallback(() => {
    void actions.createInvite();
  }, [actions]);
  const handleRemoveInvite = useCallback<CampaignHubPageProps["onRemoveInvite"]>(
    (inviteId) => {
      void actions.removeInvite(inviteId);
    },
    [actions]
  );

  if (!session || !snapshot || !selectedCampaignId) {
    return null;
  }

  const hubPageProps: CampaignHubPageProps = {
    token: session.token,
    campaign: snapshot.campaign,
    compendium: snapshot.compendium,
    role: routeState.role,
    currentUserId: session.user.id,
    activeMap: routeState.activeMap,
    selectedMap: routeState.selectedMap ?? undefined,
    selectedActor: routeState.selectedActor,
    activePopup: routeState.activePopup,
    editingMap: routeState.editingMap,
    mapEditorMode: routeState.mapEditorMode,
    filteredSelectedMapRoster: routeState.filteredSelectedMapRoster,
    availableActors: routeState.availableActors,
    selectedMapAvailableActors: routeState.selectedMapReusableActors,
    actorSearch: routeState.actorSearch,
    actorTypeFilter: routeState.actorTypeFilter,
    actorCreatorKind: routeState.actorCreatorKind,
    actorCreatorOpen: routeState.actorCreatorOpen,
    actorDraft: routeState.actorDraft,
    monsterQuery: routeState.monsterQuery,
    filteredCatalog: routeState.filteredCatalog,
    selectedMonsterTemplate: routeState.selectedMonsterTemplate,
    inviteDraft: routeState.inviteDraft,
    canUndoEditingMap: routeState.canUndoEditingMap,
    canRedoEditingMap: routeState.canRedoEditingMap,
    canPersistEditingMap: routeState.canPersistEditingMap,
    onOpenBoard: navigation.openCampaignBoard,
    onSetActivePopup: setters.setActivePopup,
    onSelectMap: setters.setSelectedMapId,
    onSelectActor: setters.setSelectedActorId,
    onRoll: actions.rollFromSheet,
    onSaveActor: actions.saveActor,
    onActorSearchChange: setters.setActorSearch,
    onActorTypeFilterChange: setters.setActorTypeFilter,
    onActorCreatorOpenChange: setters.setActorCreatorOpen,
    onActorCreatorKindChange: setters.setActorCreatorKind,
    onCreateActor: actions.createActor,
    onMonsterQueryChange: setters.setMonsterQuery,
    onSelectMonster: handleSelectMonster,
    onCreateMonsterActor: (monster) => {
      void actions.createMonsterActor(monster);
    },
    onCreateMapActor: handleCreateMapActor,
    onCreateMapMonsterActor: handleCreateMapMonsterActor,
    onAssignActorToMap: handleAssignActorToMap,
    onRemoveActorFromMap: handleRemoveActorFromMap,
    onDeleteActor: handleDeleteActor,
    onInviteDraftChange: setters.setInviteDraft,
    onCreateInvite: handleCreateInvite,
    onRemoveInvite: handleRemoveInvite,
    onShowMap: actions.showMap,
    onStartCreateMap: actions.openMapEditorForCreate,
    onStartEditMap: actions.openMapEditorForEdit,
    onChangeEditingMap: actions.changeEditingMap,
    onSaveEditingMap: actions.saveEditingMap,
    onReloadEditingMap: actions.reloadEditingMap,
    onUndoEditingMap: actions.undoEditingMap,
    onRedoEditingMap: actions.redoEditingMap,
    onSetEditingMapActive: actions.setEditingMapActive,
    onBackToMapsList: handleBackToMapsList,
    onMapUploadError: handleMapUploadError
  };

  const boardPageProps: CampaignPageProps = {
    token: session.token,
    campaign: snapshot.campaign,
    compendium: snapshot.compendium,
    role: routeState.role,
    currentUserId: session.user.id,
    activeMap: routeState.activeMap,
    selectedMap: routeState.selectedMap ?? undefined,
    selectedActor: routeState.selectedActor,
    activePopup: routeState.activePopup,
    boardSeenCells: routeState.boardSeenCells,
    fogPreviewUserId: routeState.fogPreviewUserId,
    playerMembers: routeState.playerMembers,
    dmFogEnabled: routeState.dmFogEnabled,
    dmFogUserId: routeState.dmFogUserId,
    selectedMapAvailableActors: routeState.selectedMapReusableActors,
    actorCreatorKind: routeState.actorCreatorKind,
    filteredCatalog: routeState.filteredCatalog,
    selectedMonsterTemplate: routeState.selectedMonsterTemplate,
    movementPreviews: routeState.movementPreviews,
    measurePreviews: routeState.measurePreviews,
    mapPings: routeState.mapPings,
    viewRecall: routeState.viewRecall,
    filteredCurrentMapRoster: routeState.filteredCurrentMapRoster,
    filteredSelectedMapRoster: routeState.filteredSelectedMapRoster,
    editingMap: routeState.editingMap,
    mapEditorMode: routeState.mapEditorMode,
    canUndoEditingMap: routeState.canUndoEditingMap,
    canRedoEditingMap: routeState.canRedoEditingMap,
    canPersistEditingMap: routeState.canPersistEditingMap,
    onSetActivePopup: setters.setActivePopup,
    onOpenCampaignHome: navigation.openCampaignHome,
    onSelectMap: setters.setSelectedMapId,
    onSelectActor: setters.setSelectedActorId,
    onSetDmFogEnabled: setters.setDmFogEnabled,
    onSetDmFogUserId: setters.setDmFogUserId,
    onActorCreatorKindChange: setters.setActorCreatorKind,
    onMonsterQueryChange: setters.setMonsterQuery,
    onSelectMonster: handleSelectMonster,
    onResetFog: actions.resetFog,
    onClearFog: actions.clearFog,
    onSelectedMapItemCountChange: setters.setSelectedBoardItemCount,
    onAssignActorToMap: handleAssignActorToMap,
    onRemoveActorFromMap: handleRemoveActorFromMap,
    onShowMap: actions.showMap,
    onStartCreateMap: actions.openMapEditorForCreate,
    onStartEditMap: actions.openMapEditorForEdit,
    onChangeEditingMap: actions.changeEditingMap,
    onSaveEditingMap: actions.saveEditingMap,
    onReloadEditingMap: actions.reloadEditingMap,
    onUndoEditingMap: actions.undoEditingMap,
    onRedoEditingMap: actions.redoEditingMap,
    onSetEditingMapActive: actions.setEditingMapActive,
    onBackToMapsList: handleBackToMapsList,
    onMapUploadError: handleMapUploadError,
    onCreateMapActor: handleCreateMapActor,
    onCreateMapMonsterActor: handleCreateMapMonsterActor,
    onMoveActor: actions.moveActor,
    onBroadcastMovePreview: actions.broadcastMovePreview,
    onBroadcastMeasurePreview: actions.broadcastMeasurePreview,
    onToggleDoor: actions.toggleDoor,
    onToggleDoorLock: actions.toggleDoorLock,
    onCreateDrawing: actions.createDrawing,
    onUpdateDrawings: actions.updateDrawings,
    onDeleteDrawings: actions.deleteDrawings,
    onClearDrawings: actions.clearDrawings,
    onPing: actions.pingMap,
    onPingAndRecall: actions.pingAndRecallMap,
    onSendChat: actions.sendChat,
    onSaveActor: actions.saveActor,
    onRoll: actions.rollFromSheet,
    onUpdateToken: actions.updateToken
  };

  return {
    selectedCampaignId,
    snapshot,
    roomStatus,
    hubPageProps,
    boardPageProps
  };
}
