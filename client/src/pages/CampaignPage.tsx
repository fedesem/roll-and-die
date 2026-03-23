import { Castle, Home, Map as MapIcon, ScrollText, Users } from "lucide-react";

import type {
  ActorKind,
  ActorSheet,
  CampaignMap,
  CampaignMember,
  CampaignSnapshot,
  DrawingStroke,
  MapPing,
  MapViewportRecall,
  MeasurePreview,
  MemberRole,
  MonsterTemplate,
  Point,
  TokenMovementPreview
} from "@shared/types";

import { BoardCanvas } from "../components/BoardCanvas";
import { CampaignActorManager } from "../components/CampaignActorManager";
import { CampaignMapManager } from "../components/CampaignMapManager";
import { CharacterSheet } from "../components/CharacterSheet";
import { ChatPanel } from "../components/ChatPanel";
import { WorkspaceModal } from "../components/WorkspaceModal";
import type {
  ActorTypeFilter,
  AvailableActorEntry,
  CurrentMapRosterEntry,
  TokenUpdatePatch
} from "../features/campaign/types";
import { resolveAssetUrl } from "../lib/assets";

type ActivePopup = "sheet" | "actors" | "maps" | "room" | null;

interface CampaignPageProps {
  campaign: CampaignSnapshot["campaign"];
  compendium: CampaignSnapshot["compendium"];
  role: MemberRole;
  currentUserId: string;
  roomStatus: "offline" | "connecting" | "online";
  activeMap?: CampaignMap;
  boardMap?: CampaignMap;
  selectedMap?: CampaignMap;
  selectedActor: ActorSheet | null;
  activePopup: ActivePopup;
  editingMap: CampaignMap | null;
  mapEditorMode: "create" | "edit" | null;
  boardSeenCells: string[];
  fogPreviewUserId?: string;
  playerMembers: CampaignMember[];
  dmFogEnabled: boolean;
  dmFogUserId: string | null;
  movementPreviews: Array<{ actorId: string; mapId: string; preview: TokenMovementPreview }>;
  measurePreviews: Array<{ userId: string; mapId: string; preview: MeasurePreview }>;
  mapPings: MapPing[];
  viewRecall: MapViewportRecall | null;
  filteredCurrentMapRoster: CurrentMapRosterEntry[];
  availableActors: AvailableActorEntry[];
  actorSearch: string;
  mapActorSearch: string;
  actorTypeFilter: ActorTypeFilter;
  mapActorTypeFilter: ActorTypeFilter;
  actorCreatorKind: ActorKind;
  actorCreatorOpen: boolean;
  actorDraft: ActorSheet | null;
  monsterQuery: string;
  filteredCatalog: MonsterTemplate[];
  selectedMonsterTemplate: MonsterTemplate | null;
  inviteDraft: {
    label: string;
    role: MemberRole;
  };
  onSetActivePopup: (popup: ActivePopup) => void;
  onOpenCampaignHome: () => void;
  onSelectActor: (actorId: string | null) => void;
  onSetDmFogEnabled: (enabled: boolean) => void;
  onSetDmFogUserId: (userId: string | null) => void;
  onResetFog: () => Promise<void>;
  onSelectedMapItemCountChange: (count: number) => void;
  onMoveActor: (actorId: string, x: number, y: number) => Promise<void>;
  onBroadcastMovePreview: (actorId: string, target: Point | null) => Promise<void>;
  onBroadcastMeasurePreview: (preview: MeasurePreview | null) => Promise<void>;
  onToggleDoor: (doorId: string) => Promise<void>;
  onCreateDrawing: (mapId: string, stroke: DrawingStroke) => Promise<void>;
  onUpdateDrawings: (
    mapId: string,
    drawings: Array<{ id: string; points: Point[]; rotation: number }>
  ) => Promise<void>;
  onDeleteDrawings: (mapId: string, drawingIds: string[]) => Promise<void>;
  onClearDrawings: (mapId: string) => Promise<void>;
  onPing: (point: Point) => Promise<void>;
  onPingAndRecall: (point: Point, center: Point, zoom: number) => Promise<void>;
  onSendChat: (text: string) => Promise<void>;
  onSaveActor: (actor: ActorSheet) => Promise<void>;
  onRoll: (notation: string, label: string, actor?: ActorSheet | null) => Promise<void>;
  onActorSearchChange: (value: string) => void;
  onMapActorSearchChange: (value: string) => void;
  onActorTypeFilterChange: (value: ActorTypeFilter) => void;
  onMapActorTypeFilterChange: (value: ActorTypeFilter) => void;
  onActorCreatorOpenChange: (open: boolean) => void;
  onActorCreatorKindChange: (kind: ActorKind) => void;
  onCreateActor: (draft: ActorSheet) => Promise<void>;
  onMonsterQueryChange: (value: string) => void;
  onSelectMonster: (monsterId: string) => void;
  onCreateMonsterActor: (monster: MonsterTemplate) => void;
  onAssignActorToCurrentMap: (actorId: string) => void;
  onRemoveActorFromCurrentMap: (actorId: string) => void;
  onUpdateToken: (tokenId: string, patch: TokenUpdatePatch) => Promise<void>;
  onDeleteActor: (actor: ActorSheet) => void;
  onShowMap: (mapId: string) => void;
  onStartCreateMap: () => void;
  onStartEditMap: (map: CampaignMap) => void;
  onChangeEditingMap: (map: CampaignMap) => void;
  onSaveEditingMap: () => void;
  onReloadEditingMap: () => void;
  onUndoEditingMap: () => void;
  onRedoEditingMap: () => void;
  canUndoEditingMap: boolean;
  canRedoEditingMap: boolean;
  canPersistEditingMap: boolean;
  onSetEditingMapActive: () => void;
  onBackToMapsList: () => void;
  onMapUploadError: (message: string) => void;
  onInviteDraftChange: (draft: { label: string; role: MemberRole }) => void;
  onCreateInvite: () => void;
}

export function CampaignPage({
  campaign,
  compendium,
  role,
  currentUserId,
  activeMap,
  boardMap,
  selectedMap,
  selectedActor,
  activePopup,
  editingMap,
  mapEditorMode,
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
  availableActors,
  actorSearch,
  mapActorSearch,
  actorTypeFilter,
  mapActorTypeFilter,
  actorCreatorKind,
  actorCreatorOpen,
  actorDraft,
  monsterQuery,
  filteredCatalog,
  selectedMonsterTemplate,
  inviteDraft,
  onSetActivePopup,
  onOpenCampaignHome,
  onSelectActor,
  onSetDmFogEnabled,
  onSetDmFogUserId,
  onResetFog,
  onSelectedMapItemCountChange,
  onMoveActor,
  onBroadcastMovePreview,
  onBroadcastMeasurePreview,
  onToggleDoor,
  onCreateDrawing,
  onUpdateDrawings,
  onDeleteDrawings,
  onClearDrawings,
  onPing,
  onPingAndRecall,
  onSendChat,
  onSaveActor,
  onRoll,
  onActorSearchChange,
  onMapActorSearchChange,
  onActorTypeFilterChange,
  onMapActorTypeFilterChange,
  onActorCreatorOpenChange,
  onActorCreatorKindChange,
  onCreateActor,
  onMonsterQueryChange,
  onSelectMonster,
  onCreateMonsterActor,
  onAssignActorToCurrentMap,
  onRemoveActorFromCurrentMap,
  onUpdateToken,
  onDeleteActor,
  onShowMap,
  onStartCreateMap,
  onStartEditMap,
  onChangeEditingMap,
  onSaveEditingMap,
  onReloadEditingMap,
  onUndoEditingMap,
  onRedoEditingMap,
  canUndoEditingMap,
  canRedoEditingMap,
  canPersistEditingMap,
  onSetEditingMapActive,
  onBackToMapsList,
  onMapUploadError,
  onInviteDraftChange,
  onCreateInvite
}: CampaignPageProps) {
  const inviteBaseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <>
      <main className="table-layout">
        <section className="table-map-shell">
          <BoardCanvas
            map={boardMap ?? activeMap}
            tokens={campaign.tokens}
            actors={campaign.actors}
            selectedActor={selectedActor ?? undefined}
            role={role}
            currentUserId={currentUserId}
            playerSeenCells={boardSeenCells}
            fogPreviewUserId={fogPreviewUserId}
            fogPlayers={playerMembers.map((member) => ({ userId: member.userId, name: member.name }))}
            dmFogEnabled={dmFogEnabled}
            dmFogUserId={dmFogUserId}
            onSetDmFogEnabled={onSetDmFogEnabled}
            onSetDmFogUserId={onSetDmFogUserId}
            onResetFog={onResetFog}
            onSelectActor={onSelectActor}
            onSelectedMapItemCountChange={onSelectedMapItemCountChange}
            movementPreviews={movementPreviews}
            measurePreviews={measurePreviews}
            pings={mapPings}
            viewRecall={viewRecall}
            onMoveActor={onMoveActor}
            onBroadcastMovePreview={onBroadcastMovePreview}
            onBroadcastMeasurePreview={onBroadcastMeasurePreview}
            onToggleDoor={onToggleDoor}
            onCreateDrawing={onCreateDrawing}
            onUpdateDrawings={onUpdateDrawings}
            onDeleteDrawings={onDeleteDrawings}
            onClearDrawings={onClearDrawings}
            onPing={onPing}
            onPingAndRecall={onPingAndRecall}
            onUpdateToken={onUpdateToken}
          />

          <aside className="table-overlay table-menu">
            <section className="overlay-card overlay-nav">
              <p className="panel-label">Menu</p>
              <div className="overlay-nav-buttons">
                <button type="button" onClick={() => onSetActivePopup("actors")}>
                  <Users size={15} />
                  <span>Actors</span>
                </button>
                <button type="button" onClick={onOpenCampaignHome}>
                  <Home size={15} />
                  <span>Campaign</span>
                </button>
                {role === "dm" && (
                  <button type="button" onClick={() => onSetActivePopup("maps")}>
                    <MapIcon size={15} />
                    <span>Maps</span>
                  </button>
                )}
                <button type="button" disabled={!selectedActor} onClick={() => onSetActivePopup("sheet")}>
                  <ScrollText size={15} />
                  <span>Sheet</span>
                </button>
                <button type="button" onClick={() => onSetActivePopup("room")}>
                  <Castle size={15} />
                  <span>Room</span>
                </button>
              </div>
            </section>

            <section className="overlay-card overlay-active-actors">
              <div className="panel-head">
                <div>
                  <p className="panel-label">Map</p>
                  <h3>Actors</h3>
                </div>
                <span className="badge subtle">{filteredCurrentMapRoster.length}</span>
              </div>
              <div className="list-stack compact-list">
                {filteredCurrentMapRoster.map(({ actor, assignment, color, label, imageUrl }) => {
                  const canSelect = Boolean(actor);
                  const canDrag = Boolean(actor && (role === "dm" || actor.ownerId === currentUserId));

                  return (
                    <div key={`${assignment.mapId}:${assignment.actorId}`} className="overlay-token-row">
                      <div className={`overlay-token-chip ${actor && selectedActor?.id === actor.id ? "is-selected" : ""}`}>
                        <button
                          type="button"
                          className="overlay-token-drag"
                          disabled={!canDrag}
                          draggable={canDrag}
                          title={canDrag ? `Drag ${label} onto the board` : label}
                          onClick={() => {
                            if (actor) {
                              onSelectActor(actor.id);
                            }
                          }}
                          onDragStart={(event) => {
                            if (!actor) {
                              event.preventDefault();
                              return;
                            }

                            event.dataTransfer.setData("application/x-dnd-actor-id", actor.id);
                            event.dataTransfer.effectAllowed = "move";
                            onSelectActor(actor.id);
                          }}
                        >
                          <span className="overlay-token-dot" style={{ background: color }}>
                            {imageUrl ? (
                              <img src={resolveAssetUrl(imageUrl)} alt={label} />
                            ) : (
                              label
                                .split(/\s+/)
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((part) => part[0]?.toUpperCase() ?? "")
                                .join("")
                            )}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="overlay-token-name-button"
                          disabled={!canSelect}
                          title={label}
                          onClick={() => {
                            if (actor) {
                              onSelectActor(actor.id);
                            }
                          }}
                        >
                          <span className="overlay-token-name">{label}</span>
                        </button>
                      </div>
                      {actor && (
                        <button
                          className="icon-action-button overlay-token-sheet-button"
                          type="button"
                          title="Open sheet"
                          disabled={!(role === "dm" || actor.sheetAccess === "full" || actor.ownerId === currentUserId)}
                          onClick={() => {
                            onSelectActor(actor.id);
                            onSetActivePopup("sheet");
                          }}
                        >
                          <ScrollText size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
                {filteredCurrentMapRoster.length === 0 && <p className="empty-state">No actors are assigned to this map.</p>}
              </div>
            </section>
          </aside>

          <aside className="table-overlay table-chat">
            <ChatPanel messages={campaign.chat} onSend={onSendChat} />
          </aside>
        </section>
      </main>

      {activePopup === "sheet" && (
        <WorkspaceModal
          title={selectedActor ? `${selectedActor.name} Sheet` : "Interactive Sheet"}
          size="wide"
          onClose={() => onSetActivePopup(null)}
        >
          <CharacterSheet
            actor={selectedActor ?? undefined}
            compendium={compendium}
            role={role}
            currentUserId={currentUserId}
            onSave={onSaveActor}
            onRoll={onRoll}
          />
        </WorkspaceModal>
      )}

      {activePopup === "actors" && (
        <WorkspaceModal title="Actors" size="wide" onClose={() => onSetActivePopup(null)}>
          <CampaignActorManager
            role={role}
            currentUserId={currentUserId}
            compendium={compendium}
            selectedActor={selectedActor}
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
            onOpenSheet={(actorId) => {
              onSelectActor(actorId);
              onSetActivePopup("sheet");
            }}
            onRoll={onRoll}
            onActorSearchChange={onActorSearchChange}
            onMapActorSearchChange={onMapActorSearchChange}
            onActorTypeFilterChange={onActorTypeFilterChange}
            onMapActorTypeFilterChange={onMapActorTypeFilterChange}
            onActorCreatorOpenChange={onActorCreatorOpenChange}
            onActorCreatorKindChange={onActorCreatorKindChange}
            onCreateActor={onCreateActor}
            onMonsterQueryChange={onMonsterQueryChange}
            onSelectMonster={onSelectMonster}
            onCreateMonsterActor={onCreateMonsterActor}
            onAssignActorToCurrentMap={onAssignActorToCurrentMap}
            onRemoveActorFromCurrentMap={onRemoveActorFromCurrentMap}
            onDeleteActor={onDeleteActor}
          />
        </WorkspaceModal>
      )}

      {role === "dm" && activePopup === "maps" && (
        <WorkspaceModal
          title="Maps"
          size={editingMap ? "full" : "compact"}
          onClose={() => {
            if (editingMap) {
              onBackToMapsList();
              return;
            }

            onSetActivePopup(null);
          }}
        >
          <CampaignMapManager
            campaignMaps={campaign.maps}
            role={role}
            activeMap={activeMap}
            selectedMap={selectedMap}
            editingMap={editingMap}
            mapEditorMode={mapEditorMode}
            onShowMap={onShowMap}
            onStartCreateMap={onStartCreateMap}
            onStartEditMap={onStartEditMap}
            onChangeEditingMap={onChangeEditingMap}
            onSaveEditingMap={onSaveEditingMap}
            onReloadEditingMap={onReloadEditingMap}
            onUndoEditingMap={onUndoEditingMap}
            onRedoEditingMap={onRedoEditingMap}
            canUndoEditingMap={canUndoEditingMap}
            canRedoEditingMap={canRedoEditingMap}
            canPersistEditingMap={canPersistEditingMap}
            onSetEditingMapActive={onSetEditingMapActive}
            onBackToMapsList={onBackToMapsList}
            onMapUploadError={onMapUploadError}
          />
        </WorkspaceModal>
      )}

      {activePopup === "room" && (
        <WorkspaceModal title="Room" onClose={() => onSetActivePopup(null)}>
          <div className="popup-grid two-columns">
            <section className="dark-card popup-card">
              <div className="panel-head">
                <div>
                  <p className="panel-label">Members</p>
                  <h2>{campaign.name}</h2>
                </div>
                <span className="badge">{role}</span>
              </div>
              <div className="member-list">
                {campaign.members.map((member) => (
                  <div key={member.userId} className="member-row">
                    <span>{member.name}</span>
                    <span className="badge subtle">{member.role}</span>
                  </div>
                ))}
              </div>
            </section>

            {role === "dm" ? (
              <section className="dark-card popup-card">
                <div className="panel-head">
                  <div>
                    <p className="panel-label">Invites</p>
                    <h2>Role-based access</h2>
                  </div>
                </div>
                <div className="stack-form compact">
                  <input
                    value={inviteDraft.label}
                    onChange={(event) => onInviteDraftChange({ ...inviteDraft, label: event.target.value })}
                  />
                  <div className="inline-form compact">
                    <select
                      value={inviteDraft.role}
                      onChange={(event) => onInviteDraftChange({ ...inviteDraft, role: event.target.value as MemberRole })}
                    >
                      <option value="player">Player</option>
                      <option value="dm">Dungeon Master</option>
                    </select>
                    <button type="button" onClick={onCreateInvite}>
                      Create
                    </button>
                  </div>
                </div>
                <div className="invite-list">
                  {campaign.invites.map((invite) => (
                    <div key={invite.id} className="invite-card">
                      <strong>{invite.code}</strong>
                      <span>{invite.label}</span>
                      <a
                        href={`${inviteBaseUrl}/join/${encodeURIComponent(invite.code)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {`${inviteBaseUrl}/join/${encodeURIComponent(invite.code)}`}
                      </a>
                      <small>{invite.role}</small>
                    </div>
                  ))}
                  {campaign.invites.length === 0 && <p className="empty-state">No active invites.</p>}
                </div>
              </section>
            ) : (
              <section className="dark-card popup-card">
                <div className="panel-head">
                  <div>
                    <p className="panel-label">Room Notes</p>
                    <h2>Shared table</h2>
                  </div>
                </div>
                <p className="panel-caption">
                  Players can use the chat on the right and click abilities from the sheet popup to roll dice.
                </p>
              </section>
            )}
          </div>
        </WorkspaceModal>
      )}
    </>
  );
}
