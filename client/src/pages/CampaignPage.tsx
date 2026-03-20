import { Castle, Eye, FilePlus2, Map as MapIcon, Minus, Pencil, Plus, ScrollText, Trash2, Users } from "lucide-react";

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
import { CharacterSheet } from "../components/CharacterSheet";
import { ChatPanel } from "../components/ChatPanel";
import { MapConfigurator } from "../components/MapConfigurator";
import { WorkspaceModal } from "../components/WorkspaceModal";
import type { ActorTypeFilter, AvailableActorEntry, CurrentMapRosterEntry } from "../features/campaign/types";
import { formatMonsterModifier } from "../lib/drafts";

type ActivePopup = "sheet" | "actors" | "maps" | "room" | null;

interface CampaignPageProps {
  campaign: CampaignSnapshot["campaign"];
  compendium: CampaignSnapshot["compendium"];
  role: MemberRole;
  currentUserId: string;
  roomStatus: "offline" | "connecting" | "online";
  activeMap?: CampaignMap;
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
  onUpdateDrawings: (mapId: string, drawings: Array<{ id: string; points: Point[]; rotation: number }>) => Promise<void>;
  onDeleteDrawings: (mapId: string, drawingIds: string[]) => Promise<void>;
  onClearDrawings: (mapId: string) => Promise<void>;
  onPing: (point: Point) => Promise<void>;
  onPingAndRecall: (point: Point, center: Point, zoom: number) => Promise<void>;
  onSendChat: (text: string) => Promise<void>;
  onSaveActor: (actor: ActorSheet) => Promise<void>;
  onRoll: (notation: string, label: string) => Promise<void>;
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
  onDeleteActor: (actor: ActorSheet) => void;
  onShowMap: (mapId: string) => void;
  onStartCreateMap: () => void;
  onStartEditMap: (map: CampaignMap) => void;
  onChangeEditingMap: (map: CampaignMap) => void;
  onSaveEditingMap: () => void;
  onReloadEditingMap: () => void;
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
  onDeleteActor,
  onShowMap,
  onStartCreateMap,
  onStartEditMap,
  onChangeEditingMap,
  onSaveEditingMap,
  onReloadEditingMap,
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
            map={activeMap}
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
          />

          <aside className="table-overlay table-menu">
            <section className="overlay-card overlay-nav">
              <p className="panel-label">Menu</p>
              <div className="overlay-nav-buttons">
                <button type="button" onClick={() => onSetActivePopup("actors")}>
                  <Users size={15} />
                  <span>Actors</span>
                </button>
                <button type="button" onClick={() => onSetActivePopup("maps")}>
                  <MapIcon size={15} />
                  <span>Maps</span>
                </button>
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
                  const canDrag = Boolean(actor && (role === "dm" || (actor.kind === "character" && actor.ownerId === currentUserId)));

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
                              <img src={imageUrl} alt={label} />
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
                          disabled={!(role === "dm" || actor.sheetAccess === "full" || (actor.kind === "character" && actor.ownerId === currentUserId))}
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
        <WorkspaceModal title={selectedActor ? `${selectedActor.name} Sheet` : "Interactive Sheet"} size="wide" onClose={() => onSetActivePopup(null)}>
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
          <div className="popup-grid actor-manager-grid">
            {role === "dm" && (
              <section className="dark-card popup-card actor-list-card">
                <div className="panel-head">
                  <div>
                    <p className="panel-label">Roster</p>
                    <h2>Available actors</h2>
                  </div>
                  <span className="badge subtle">{availableActors.length}</span>
                </div>
                <div className="actor-filter-row">
                  <input placeholder="Search available actors" value={actorSearch} onChange={(event) => onActorSearchChange(event.target.value)} />
                  <select value={actorTypeFilter} onChange={(event) => onActorTypeFilterChange(event.target.value as ActorTypeFilter)}>
                    <option value="all">All types</option>
                    <option value="character">Characters</option>
                    <option value="npc">NPCs</option>
                    <option value="monster">Monsters</option>
                    <option value="static">Static</option>
                  </select>
                </div>
                <div className="actor-list-scroll">
                  <div className="list-stack">
                    {availableActors.map(({ actor, activeMaps, onCurrentMap }) => (
                      <div key={actor.id} className="popup-row actor-popup-row">
                        <div className={`list-row actor-list-row-static ${selectedActor?.id === actor.id ? "is-selected" : ""}`}>
                          <div className="actor-row-main">
                            <span className="actor-row-name">{actor.name}</span>
                            <div className="actor-row-meta">
                              <span className="badge subtle">{actor.kind}</span>
                              {onCurrentMap && <span className="badge subtle">Assigned</span>}
                              {activeMaps.map((map) => (
                                <span key={map.id} className="badge map-badge">
                                  {map.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="actor-list-actions">
                          <button
                            className="icon-action-button"
                            type="button"
                            title="Open sheet"
                            onClick={() => {
                              onSelectActor(actor.id);
                              onSetActivePopup("sheet");
                            }}
                          >
                            <ScrollText size={15} />
                          </button>
                          {!onCurrentMap && (
                            <button className="icon-action-button" type="button" title="Add actor to map" onClick={() => onAssignActorToCurrentMap(actor.id)}>
                              <Plus size={15} />
                            </button>
                          )}
                          {onCurrentMap && (
                            <button className="icon-action-button" type="button" title="Remove actor from map" onClick={() => onRemoveActorFromCurrentMap(actor.id)}>
                              <Minus size={15} />
                            </button>
                          )}
                          {actor.ownerId === currentUserId && (
                            <button type="button" className="icon-action-button danger-button" title="Delete actor" onClick={() => onDeleteActor(actor)}>
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {availableActors.length === 0 && <p className="empty-state">No actors match that search.</p>}
                  </div>
                </div>
              </section>
            )}

            <section className="dark-card popup-card actor-list-card">
              <div className="panel-head">
                <div>
                  <p className="panel-label">Map</p>
                  <h2>Actors on map</h2>
                </div>
                <span className="badge subtle">{filteredCurrentMapRoster.length}</span>
              </div>
              <div className="actor-filter-row">
                <input placeholder="Search current map actors" value={mapActorSearch} onChange={(event) => onMapActorSearchChange(event.target.value)} />
                <select value={mapActorTypeFilter} onChange={(event) => onMapActorTypeFilterChange(event.target.value as ActorTypeFilter)}>
                  <option value="all">All types</option>
                  <option value="character">Characters</option>
                  <option value="npc">NPCs</option>
                  <option value="monster">Monsters</option>
                  <option value="static">Static</option>
                </select>
              </div>
              <div className="actor-list-scroll">
                <div className="list-stack">
                  {filteredCurrentMapRoster.map(({ actor, token, actorKind, assignment, label }) => {
                    const canRemoveFromMap = role === "dm" && Boolean(actor);

                    return (
                      <div key={`${assignment.mapId}:${assignment.actorId}`} className="popup-row actor-popup-row">
                        <div className={`list-row actor-list-row-static ${actor && selectedActor?.id === actor.id ? "is-selected" : ""}`}>
                          <div className="actor-row-main">
                            <span className="actor-row-name">{label}</span>
                            <div className="actor-row-meta">
                              <span className="badge subtle">{actorKind}</span>
                              {token && <span className="badge subtle">On board</span>}
                              {actor ? (
                                <span className="badge subtle">
                                  {role === "dm" ? "Sheet" : actor.ownerId === currentUserId ? "Yours" : "Seen"}
                                </span>
                              ) : (
                                <span className="badge subtle">Seen</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="actor-list-actions">
                          {actor && (
                            <button
                              className="icon-action-button"
                              type="button"
                              title="Open sheet"
                              disabled={!(role === "dm" || actor.sheetAccess === "full" || (actor.kind === "character" && actor.ownerId === currentUserId))}
                              onClick={() => {
                                onSelectActor(actor.id);
                                onSetActivePopup("sheet");
                              }}
                            >
                              <ScrollText size={15} />
                            </button>
                          )}
                          {canRemoveFromMap && actor && (
                            <button className="icon-action-button" type="button" title="Remove actor from map" onClick={() => onRemoveActorFromCurrentMap(actor.id)}>
                              <Minus size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {filteredCurrentMapRoster.length === 0 && <p className="empty-state">No actors are assigned to this map.</p>}
                </div>
              </div>
            </section>

            <section className="dark-card popup-card actor-create-card">
              <div className="panel-head">
                <div>
                  <p className="panel-label">Create</p>
                  <h2>New actor</h2>
                </div>
                <button className={actorCreatorOpen ? "accent-button" : ""} type="button" onClick={() => onActorCreatorOpenChange(!actorCreatorOpen)}>
                  {actorCreatorOpen ? "Close" : "Create actor"}
                </button>
              </div>
              {actorCreatorOpen && (
                <div className="stack-form">
                  <div className="inline-form compact">
                    <select value={actorCreatorKind} onChange={(event) => onActorCreatorKindChange(event.target.value as ActorKind)}>
                      <option value="character">Character</option>
                      {role === "dm" && <option value="npc">NPC</option>}
                      {role === "dm" && <option value="monster">Monster</option>}
                      {role === "dm" && <option value="static">Static</option>}
                    </select>
                  </div>

                  {actorCreatorKind === "monster" ? (
                    <div className="popup-grid monster-browser">
                      <section className="sheet-panel">
                        <input placeholder="Search monsters" value={monsterQuery} onChange={(event) => onMonsterQueryChange(event.target.value)} />
                        <div className="monster-list">
                          {filteredCatalog.map((monster) => (
                            <button
                              key={monster.id}
                              className={`monster-card ${selectedMonsterTemplate?.id === monster.id ? "is-selected" : ""}`}
                              type="button"
                              onClick={() => onSelectMonster(monster.id)}
                            >
                              <span>{monster.name}</span>
                              <small>
                                CR {monster.challengeRating}{monster.xp ? ` (${monster.xp.toLocaleString()} XP)` : ""} • AC {monster.armorClass} • HP {monster.hitPoints}
                              </small>
                            </button>
                          ))}
                          {filteredCatalog.length === 0 && <p className="empty-state">No monsters match that search.</p>}
                        </div>
                      </section>
                      <section className="sheet-panel monster-preview-card">
                        {selectedMonsterTemplate ? (
                          <>
                            <div className="panel-head">
                              <div>
                                <p className="panel-label">Preview</p>
                                <h2>{selectedMonsterTemplate.name}</h2>
                              </div>
                              <button className="accent-button" type="button" onClick={() => onCreateMonsterActor(selectedMonsterTemplate)}>
                                Add to roster
                              </button>
                            </div>
                            <div className="monster-preview-summary">
                              <span className="badge">CR {selectedMonsterTemplate.challengeRating}{selectedMonsterTemplate.xp ? ` (${selectedMonsterTemplate.xp.toLocaleString()} XP)` : ""}</span>
                              <span className="badge subtle">{selectedMonsterTemplate.source}</span>
                              <span className="badge subtle">AC {selectedMonsterTemplate.armorClass}</span>
                              <span className="badge subtle">HP {selectedMonsterTemplate.hitPoints}</span>
                              <span className="badge subtle">Init {selectedMonsterTemplate.initiative >= 0 ? `+${selectedMonsterTemplate.initiative}` : selectedMonsterTemplate.initiative}</span>
                              <span className="badge subtle">Speed {selectedMonsterTemplate.speed}</span>
                            </div>
                            <div className="ability-card-grid">
                              {Object.entries(selectedMonsterTemplate.abilities).map(([key, value]) => (
                                <div key={key} className="ability-card">
                                  <header>
                                    <h4>{key.toUpperCase()}</h4>
                                    <span>{formatMonsterModifier(value)}</span>
                                  </header>
                                  <strong>{value}</strong>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="empty-state">Select a monster to preview its stat block.</p>
                        )}
                      </section>
                    </div>
                  ) : (
                    actorDraft && (
                      <CharacterSheet
                        actor={actorDraft}
                        compendium={compendium}
                        role={role}
                        currentUserId={currentUserId}
                        onSave={onCreateActor}
                        onRoll={onRoll}
                      />
                    )
                  )}
                </div>
              )}
            </section>
          </div>
        </WorkspaceModal>
      )}

      {activePopup === "maps" && (
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
          <div className="maps-popup">
            {!editingMap ? (
              <section className="dark-card popup-card maps-list-card maps-list-card-compact">
                <div className="panel-head">
                  <div>
                    <p className="panel-label">Maps</p>
                    <h2>Board selection</h2>
                  </div>
                </div>
                <div className="maps-list-scroll">
                  <div className="list-stack">
                    {campaign.maps.map((map) => (
                      <div key={map.id} className="popup-row">
                        <div className="list-row map-list-row">
                          <div className="actor-row-main">
                            <span className="actor-row-name">{map.name}</span>
                            <div className="actor-row-meta">
                              <span className="badge subtle">{map.id === activeMap?.id ? "Active" : "Standby"}</span>
                              <span className="badge subtle">
                                {map.width}×{map.height}
                              </span>
                            </div>
                          </div>
                        </div>
                        {role === "dm" && map.id !== activeMap?.id && (
                          <button className="icon-action-button" type="button" title="Show map" onClick={() => onShowMap(map.id)}>
                            <Eye size={15} />
                          </button>
                        )}
                        {role === "dm" && (
                          <button className="icon-action-button" type="button" title="Edit map" onClick={() => onStartEditMap(map)}>
                            <Pencil size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {role === "dm" && (
                  <button className={mapEditorMode === "create" ? "accent-button" : ""} type="button" onClick={onStartCreateMap}>
                    <FilePlus2 size={15} />
                    <span>New Map</span>
                  </button>
                )}
              </section>
            ) : (
              <section className="dark-card popup-card maps-editor-card">
                <div className="panel-head">
                  <div>
                    <p className="panel-label">Editor</p>
                    <h2>{mapEditorMode === "create" ? "New Map" : selectedMap?.name ?? "Map details"}</h2>
                  </div>
                </div>
                {role === "dm" && (
                  <div className="inline-form compact map-editor-savebar">
                    {mapEditorMode === "edit" && editingMap && (
                      <button className="accent-button" type="button" disabled={editingMap.id === activeMap?.id} onClick={onSetEditingMapActive}>
                        {editingMap.id === activeMap?.id ? "Current Board" : "Set Active Board"}
                      </button>
                    )}
                    <button type="button" onClick={onReloadEditingMap}>
                      Reload
                    </button>
                    <button className="accent-button" type="button" onClick={onSaveEditingMap}>
                      Save
                    </button>
                  </div>
                )}
                <MapConfigurator map={editingMap} disabled={role !== "dm"} onChange={onChangeEditingMap} onUploadError={onMapUploadError} />
              </section>
            )}
          </div>
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
                  <input value={inviteDraft.label} onChange={(event) => onInviteDraftChange({ ...inviteDraft, label: event.target.value })} />
                  <div className="inline-form compact">
                    <select value={inviteDraft.role} onChange={(event) => onInviteDraftChange({ ...inviteDraft, role: event.target.value as MemberRole })}>
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
                <p className="panel-caption">Players can use the chat on the right and click abilities from the sheet popup to roll dice.</p>
              </section>
            )}
          </div>
        </WorkspaceModal>
      )}
    </>
  );
}
