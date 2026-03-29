import type {
  ActorKind,
  ActorSheet,
  CampaignMap,
  CampaignSnapshot,
  CampaignSourceBook,
  CampaignSummary,
  MapPing,
  MapViewportRecall,
  MeasurePreview,
  MemberRole,
  MonsterTemplate,
  Point,
  TokenMovementPreview
} from "@shared/types";

import type { AppRoute } from "../appRouteState";
import { AdminPanel } from "../components/AdminPanel";
import { CampaignCreatePage } from "../pages/CampaignCreatePage";
import { CampaignHubPage } from "../pages/CampaignHubPage";
import { CampaignJoinPage } from "../pages/CampaignJoinPage";
import { CampaignLoadingPage } from "../pages/CampaignLoadingPage";
import { CampaignPage } from "../pages/CampaignPage";
import { CampaignsPage } from "../pages/CampaignsPage";
import type { ActorTypeFilter, AvailableActorEntry, BannerState, CurrentMapRosterEntry } from "../features/campaign/types";
import type { RoomStatus } from "../services/roomConnection";

interface AppRouteContentProps {
  route: AppRoute;
  selectedCampaignId: string | null;
  snapshot: CampaignSnapshot | null;
  roomStatus: RoomStatus;
  session: {
    token: string;
    user: {
      id: string;
      isAdmin: boolean;
    };
  };
  campaignSourceBooks: CampaignSourceBook[];
  createCampaignName: string;
  createCampaignAllowedSourceBooks: string[];
  joinCode: string;
  campaigns: CampaignSummary[];
  role: MemberRole;
  activeMap?: CampaignMap;
  selectedMap?: CampaignMap;
  selectedActor: ActorSheet | null;
  activePopup: "sheet" | null;
  editingMap: CampaignMap | null;
  mapEditorMode: "create" | "edit" | null;
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
  inviteDraft: {
    role: MemberRole;
  };
  canUndoEditingMap: boolean;
  canRedoEditingMap: boolean;
  canPersistEditingMap: boolean;
  boardSeenCells: string[];
  fogPreviewUserId?: string;
  playerMembers: CampaignSnapshot["campaign"]["members"];
  dmFogEnabled: boolean;
  dmFogUserId: string | null;
  movementPreviews: Array<{
    actorId: string;
    mapId: string;
    preview: TokenMovementPreview;
  }>;
  measurePreviews: Array<{ userId: string; mapId: string; preview: MeasurePreview }>;
  mapPings: MapPing[];
  viewRecall: MapViewportRecall | null;
  filteredCurrentMapRoster: CurrentMapRosterEntry[];
  navigate: (route: AppRoute, options?: { replace?: boolean }) => Promise<void>;
  refreshCampaignSourceBooks: () => Promise<CampaignSourceBook[]>;
  setCreateCampaignName: (value: string) => void;
  setCreateCampaignAllowedSourceBooks: (value: string[]) => void;
  setJoinCode: (value: string) => void;
  setSelectedCampaignId: (campaignId: string | null, options?: { replace?: boolean }) => void;
  setActivePopup: (popup: "sheet" | null) => void;
  setSelectedMapId: (value: string | null) => void;
  setSelectedActorId: (value: string | null) => void;
  setActorSearch: (value: string) => void;
  setActorTypeFilter: (value: ActorTypeFilter) => void;
  setActorCreatorOpen: (open: boolean) => void;
  setActorCreatorKind: (kind: ActorKind) => void;
  setMonsterQuery: (value: string) => void;
  setSelectedMonsterId: (value: string | null) => void;
  setMapEditorMode: (value: "create" | "edit" | null) => void;
  setInviteDraft: (value: { role: MemberRole }) => void;
  setBanner: (value: BannerState | null) => void;
  setSelectedBoardItemCount: (count: number) => void;
  setDmFogEnabled: (enabled: boolean) => void;
  setDmFogUserId: (userId: string | null) => void;
  openCampaignBoard: () => void;
  openCampaignHome: () => void;
  createCampaign: () => Promise<void>;
  acceptInvite: (code?: string) => Promise<void>;
  createActor: (draft: ActorSheet, options?: { mapId?: string }) => Promise<void>;
  createInvite: () => Promise<void>;
  removeInvite: (inviteId: string) => Promise<void>;
  createMonsterActor: (monster: MonsterTemplate, options?: { mapId?: string }) => Promise<void>;
  assignActorToMap: (actorId: string, mapId: string) => Promise<void>;
  removeActorFromMap: (actorId: string, mapId: string) => Promise<void>;
  deleteActor: (actor: ActorSheet) => Promise<void>;
  saveActor: (actor: ActorSheet) => Promise<void>;
  showMap: (mapId: string) => void;
  openMapEditorForCreate: () => void;
  openMapEditorForEdit: (map: CampaignMap) => void;
  changeEditingMap: (map: CampaignMap) => void;
  saveEditingMap: () => void;
  reloadEditingMap: () => void;
  undoEditingMap: () => void;
  redoEditingMap: () => void;
  setEditingMapActive: () => void;
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
  updateToken: CampaignPageProps["onUpdateToken"];
}

type CampaignPageProps = Parameters<typeof CampaignPage>[0];

export function AppRouteContent({
  route,
  selectedCampaignId,
  snapshot,
  roomStatus,
  session,
  campaignSourceBooks,
  createCampaignName,
  createCampaignAllowedSourceBooks,
  joinCode,
  campaigns,
  role,
  activeMap,
  selectedMap,
  selectedActor,
  activePopup,
  editingMap,
  mapEditorMode,
  filteredSelectedMapRoster,
  availableActors,
  selectedMapReusableActors,
  actorSearch,
  actorTypeFilter,
  actorCreatorKind,
  actorCreatorOpen,
  actorDraft,
  monsterQuery,
  filteredCatalog,
  selectedMonsterTemplate,
  inviteDraft,
  canUndoEditingMap,
  canRedoEditingMap,
  canPersistEditingMap,
  boardSeenCells,
  fogPreviewUserId,
  playerMembers,
  dmFogEnabled,
  dmFogUserId,
  movementPreviews,
  measurePreviews,
  mapPings,
  viewRecall,
  filteredCurrentMapRoster,
  navigate,
  refreshCampaignSourceBooks,
  setCreateCampaignName,
  setCreateCampaignAllowedSourceBooks,
  setJoinCode,
  setSelectedCampaignId,
  setActivePopup,
  setSelectedMapId,
  setSelectedActorId,
  setActorSearch,
  setActorTypeFilter,
  setActorCreatorOpen,
  setActorCreatorKind,
  setMonsterQuery,
  setSelectedMonsterId,
  setMapEditorMode,
  setInviteDraft,
  setBanner,
  setSelectedBoardItemCount,
  setDmFogEnabled,
  setDmFogUserId,
  openCampaignBoard,
  openCampaignHome,
  createCampaign,
  acceptInvite,
  createActor,
  createInvite,
  removeInvite,
  createMonsterActor,
  assignActorToMap,
  removeActorFromMap,
  deleteActor,
  saveActor,
  showMap,
  openMapEditorForCreate,
  openMapEditorForEdit,
  changeEditingMap,
  saveEditingMap,
  reloadEditingMap,
  undoEditingMap,
  redoEditingMap,
  setEditingMapActive,
  resetFog,
  clearFog,
  moveActor,
  broadcastMovePreview,
  broadcastMeasurePreview,
  toggleDoor,
  toggleDoorLock,
  createDrawing,
  updateDrawings,
  deleteDrawings,
  clearDrawings,
  pingMap,
  pingAndRecallMap,
  sendChat,
  rollFromSheet,
  updateToken
}: AppRouteContentProps) {
  if (route.name === "admin") {
    return (
      <AdminPanel
        token={session.token}
        currentUserId={session.user.id}
        onStatus={(tone, text) => setBanner({ tone, text })}
        onRefreshSourceBooks={() => refreshCampaignSourceBooks().then(() => undefined)}
      />
    );
  }

  if (route.name === "campaignCreate") {
    return (
      <CampaignCreatePage
        campaignSourceBooks={campaignSourceBooks}
        createCampaignName={createCampaignName}
        createCampaignAllowedSourceBooks={createCampaignAllowedSourceBooks}
        onCreateCampaignNameChange={setCreateCampaignName}
        onCreateCampaignAllowedSourceBooksChange={setCreateCampaignAllowedSourceBooks}
        onCreateCampaign={() => void createCampaign()}
        onBack={() => void navigate({ name: "campaigns" })}
      />
    );
  }

  if (route.name === "campaignJoin") {
    return (
      <CampaignJoinPage
        joinCode={joinCode}
        hasInviteLink={Boolean(route.code)}
        onJoinCodeChange={setJoinCode}
        onAcceptInvite={() => void acceptInvite()}
        onBack={() => void navigate({ name: "campaigns" })}
      />
    );
  }

  if (route.name === "campaigns" || !selectedCampaignId) {
    return (
      <CampaignsPage
        campaigns={campaigns}
        onOpenCampaign={(campaignId) => setSelectedCampaignId(campaignId)}
        onOpenCreateCampaign={() => void navigate({ name: "campaignCreate" })}
        onOpenJoinCampaign={() => void navigate({ name: "campaignJoin" })}
      />
    );
  }

  const isCampaignRoute = route.name === "campaign" || route.name === "campaignBoard";

  if (!isCampaignRoute || !snapshot) {
    return <CampaignLoadingPage roomStatus={roomStatus} />;
  }

  if (route.name === "campaign") {
    return (
      <CampaignHubPage
        token={session.token}
        campaign={snapshot.campaign}
        compendium={snapshot.compendium}
        role={role}
        currentUserId={session.user.id}
        activeMap={activeMap}
        selectedMap={selectedMap}
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
        onSelectMonster={(monsterId) => setSelectedMonsterId(monsterId)}
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
    );
  }

  return (
    <CampaignPage
      token={session.token}
      campaign={snapshot.campaign}
      compendium={snapshot.compendium}
      role={role}
      currentUserId={session.user.id}
      activeMap={activeMap}
      selectedMap={selectedMap}
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
      viewRecall={viewRecall}
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
      onSelectMonster={(monsterId) => setSelectedMonsterId(monsterId)}
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
  );
}
