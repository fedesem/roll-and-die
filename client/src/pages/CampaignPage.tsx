import { useState } from "react";

import { Home, Map as MapIcon, ScrollText } from "lucide-react";

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
import { CampaignMapActorCreator } from "../components/CampaignMapActorCreator";
import { CampaignMapEditor } from "../components/CampaignMapEditor";
import { CampaignMapManager } from "../components/CampaignMapManager";
import { CampaignMapRoster } from "../components/CampaignMapRoster";
import { CharacterSheet } from "../components/CharacterSheet";
import { ChatPanel } from "../components/ChatPanel";
import { WorkspaceModal, type WorkspaceModalView } from "../components/WorkspaceModal";
import type { AvailableActorEntry, CurrentMapRosterEntry, TokenUpdatePatch } from "../features/campaign/types";
import { resolveAssetUrl } from "../lib/assets";

type ActivePopup = "sheet" | null;

export interface CampaignPageProps {
  token: string;
  campaign: CampaignSnapshot["campaign"];
  compendium: CampaignSnapshot["compendium"];
  role: MemberRole;
  currentUserId: string;
  activeMap?: CampaignMap;
  selectedMap?: CampaignMap;
  selectedActor: ActorSheet | null;
  activePopup: ActivePopup;
  boardSeenCells: string[];
  fogPreviewUserId?: string;
  playerMembers: CampaignMember[];
  dmFogEnabled: boolean;
  dmFogUserId: string | null;
  selectedMapAvailableActors: AvailableActorEntry[];
  actorCreatorKind: ActorKind;
  filteredCatalog: MonsterTemplate[];
  selectedMonsterTemplate: MonsterTemplate | null;
  movementPreviews: Array<{ actorId: string; mapId: string; preview: TokenMovementPreview }>;
  measurePreviews: Array<{ userId: string; mapId: string; preview: MeasurePreview }>;
  mapPings: MapPing[];
  viewRecall: MapViewportRecall | null;
  filteredCurrentMapRoster: CurrentMapRosterEntry[];
  filteredSelectedMapRoster: CurrentMapRosterEntry[];
  editingMap: CampaignMap | null;
  mapEditorMode: "create" | "edit" | null;
  canUndoEditingMap: boolean;
  canRedoEditingMap: boolean;
  canPersistEditingMap: boolean;
  onSetActivePopup: (popup: ActivePopup) => void;
  onOpenCampaignHome: () => void;
  onSelectMap: (mapId: string | null) => void;
  onSelectActor: (actorId: string | null) => void;
  onSetDmFogEnabled: (enabled: boolean) => void;
  onSetDmFogUserId: (userId: string | null) => void;
  onActorCreatorKindChange: (value: ActorKind) => void;
  onMonsterQueryChange: (value: string) => void;
  onSelectMonster: (monsterId: string) => void;
  onResetFog: () => Promise<void>;
  onClearFog: () => Promise<void>;
  onSelectedMapItemCountChange: (count: number) => void;
  onAssignActorToMap: (actorId: string, mapId: string) => void;
  onRemoveActorFromMap: (actorId: string, mapId: string) => void;
  onShowMap: (mapId: string) => void;
  onStartCreateMap: () => void;
  onStartEditMap: (map: CampaignMap) => void;
  onChangeEditingMap: (map: CampaignMap) => void;
  onSaveEditingMap: () => void;
  onReloadEditingMap: () => void;
  onUndoEditingMap: () => void;
  onRedoEditingMap: () => void;
  onSetEditingMapActive: () => void;
  onBackToMapsList: () => void;
  onMapUploadError: (message: string) => void;
  onCreateMapActor: (draft: ActorSheet, mapId: string) => Promise<void>;
  onCreateMapMonsterActor: (monster: MonsterTemplate, mapId: string) => Promise<void>;
  onMoveActor: (actorId: string, x: number, y: number) => Promise<void>;
  onBroadcastMovePreview: (actorId: string, target: Point | null) => Promise<void>;
  onBroadcastMeasurePreview: (preview: MeasurePreview | null) => Promise<void>;
  onToggleDoor: (doorId: string) => Promise<void>;
  onToggleDoorLock: (doorId: string) => Promise<void>;
  onCreateDrawing: (mapId: string, stroke: DrawingStroke) => Promise<void>;
  onUpdateDrawings: (mapId: string, drawings: Array<{ id: string; points: Point[]; rotation: number }>) => Promise<void>;
  onDeleteDrawings: (mapId: string, drawingIds: string[]) => Promise<void>;
  onClearDrawings: (mapId: string) => Promise<void>;
  onPing: (point: Point) => Promise<void>;
  onPingAndRecall: (point: Point, center: Point, zoom: number) => Promise<void>;
  onSendChat: (text: string) => Promise<void>;
  onSaveActor: (actor: ActorSheet) => Promise<void>;
  onRoll: (notation: string, label: string, actor?: ActorSheet | null) => Promise<void>;
  onUpdateToken: (tokenId: string, patch: TokenUpdatePatch) => Promise<void>;
}

export function CampaignPage({
  token,
  campaign,
  compendium,
  role,
  currentUserId,
  activeMap,
  selectedMap,
  selectedActor,
  activePopup,
  boardSeenCells,
  fogPreviewUserId,
  playerMembers,
  dmFogEnabled,
  dmFogUserId,
  selectedMapAvailableActors,
  actorCreatorKind,
  filteredCatalog,
  selectedMonsterTemplate,
  movementPreviews,
  measurePreviews,
  mapPings,
  viewRecall,
  filteredCurrentMapRoster,
  filteredSelectedMapRoster,
  editingMap,
  mapEditorMode,
  canUndoEditingMap,
  canRedoEditingMap,
  canPersistEditingMap,
  onSetActivePopup,
  onOpenCampaignHome,
  onSelectMap,
  onSelectActor,
  onSetDmFogEnabled,
  onSetDmFogUserId,
  onActorCreatorKindChange,
  onMonsterQueryChange,
  onSelectMonster,
  onResetFog,
  onClearFog,
  onSelectedMapItemCountChange,
  onAssignActorToMap,
  onRemoveActorFromMap,
  onShowMap,
  onStartCreateMap,
  onStartEditMap,
  onChangeEditingMap,
  onSaveEditingMap,
  onReloadEditingMap,
  onUndoEditingMap,
  onRedoEditingMap,
  onSetEditingMapActive,
  onBackToMapsList,
  onMapUploadError,
  onCreateMapActor,
  onCreateMapMonsterActor,
  onMoveActor,
  onBroadcastMovePreview,
  onBroadcastMeasurePreview,
  onToggleDoor,
  onToggleDoorLock,
  onCreateDrawing,
  onUpdateDrawings,
  onDeleteDrawings,
  onClearDrawings,
  onPing,
  onPingAndRecall,
  onSendChat,
  onSaveActor,
  onRoll,
  onUpdateToken
}: CampaignPageProps) {
  const [isMapPopupOpen, setIsMapPopupOpen] = useState(false);
  const [rollingInitiative, setRollingInitiative] = useState(false);

  function closeBoardMapModal() {
    setIsMapPopupOpen(false);
    onBackToMapsList();
  }

  function resolveDialogMap(mapId?: string) {
    if (!mapId) {
      return undefined;
    }

    const map = campaign.maps.find((entry) => entry.id === mapId);
    return map && selectedMap?.id === map.id ? selectedMap : map;
  }

  function resolveDialogRoster(mapId?: string) {
    return selectedMap?.id === mapId ? filteredSelectedMapRoster : [];
  }

  function resolveDialogAvailableActors(mapId?: string) {
    return selectedMap?.id === mapId ? selectedMapAvailableActors : [];
  }

  async function rollInitiativeForActor(actor: ActorSheet) {
    await onRoll(buildInitiativeNotation(actor.initiative), `${actor.name} initiative`, actor);
  }

  async function rollInitiativeForCurrentMap() {
    const actors = filteredCurrentMapRoster.flatMap((entry) => (entry.actor ? [entry.actor] : []));

    if (actors.length === 0) {
      return;
    }

    setRollingInitiative(true);

    try {
      for (const actor of actors) {
        await rollInitiativeForActor(actor);
      }
    } finally {
      setRollingInitiative(false);
    }
  }

  function buildCreateActorView(mapId: string): WorkspaceModalView {
    const map = resolveDialogMap(mapId);

    return {
      id: "board-map-actor-create",
      title: map ? `Create actor for ${map.name}` : "Create actor",
      size: "wide",
      data: { mapId }
    };
  }

  const boardMapView: WorkspaceModalView = {
    id: "board-maps",
    title: "Board maps",
    size: "full"
  };

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
            onClearFog={onClearFog}
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
            onToggleDoorLock={onToggleDoorLock}
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
              <button type="button" className="overlay-menu-button" onClick={onOpenCampaignHome}>
                <Home size={15} />
                <span>Back to campaign</span>
              </button>
              {role === "dm" ? (
                <button type="button" className="overlay-menu-button" onClick={() => setIsMapPopupOpen(true)}>
                  <MapIcon size={15} />
                  <span>Maps</span>
                </button>
              ) : null}
            </section>

            <section className="overlay-card overlay-active-actors">
              <div className="panel-head">
                <div>
                  <p className="panel-label">Map</p>
                  <h3>Actors</h3>
                </div>
                <div className="flex items-center gap-2">
                  {role === "dm" ? (
                    <button
                      type="button"
                      className="overlay-menu-button"
                      disabled={rollingInitiative || filteredCurrentMapRoster.length === 0}
                      onClick={() => void rollInitiativeForCurrentMap()}
                    >
                      <span>{rollingInitiative ? "Rolling…" : "Roll Init"}</span>
                    </button>
                  ) : null}
                  <span className="badge subtle">{filteredCurrentMapRoster.length}</span>
                </div>
              </div>
              <div className="list-stack compact-list">
                {filteredCurrentMapRoster.map(({ actor, assignment, color, label, imageUrl }) => {
                  const canSelect = Boolean(actor);
                  const canDrag = Boolean(actor && (role === "dm" || actor.ownerId === currentUserId));
                  const canOpenSheet = Boolean(actor && (role === "dm" || actor.sheetAccess === "full" || actor.ownerId === currentUserId));

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
                            if (!actor || !canDrag) {
                              event.preventDefault();
                              return;
                            }

                            event.dataTransfer.setData("application/x-dnd-actor-id", actor.id);
                            event.dataTransfer.effectAllowed = "move";
                            onSelectActor(actor.id);
                          }}
                        >
                          <span
                            className={`overlay-token-dot ${imageUrl ? "has-image" : ""}`}
                            style={{ background: imageUrl ? "transparent" : color }}
                          >
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
                          {actor ? (
                            <span className="ml-2 text-[10px] uppercase tracking-[0.2em] text-amber-300/80">
                              Init {actor.initiativeRoll ?? formatSigned(actor.initiative)}
                            </span>
                          ) : null}
                        </button>
                      </div>
                      {actor ? (
                        <button
                          className="icon-action-button overlay-token-sheet-button"
                          type="button"
                          title="Open sheet"
                          disabled={!canOpenSheet}
                          onClick={() => {
                            if (!canOpenSheet) {
                              return;
                            }

                            onSelectActor(actor.id);
                            onSetActivePopup("sheet");
                          }}
                        >
                          <ScrollText size={13} />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
                {filteredCurrentMapRoster.length === 0 ? <p className="empty-state">No actors are assigned to this map.</p> : null}
              </div>
            </section>
          </aside>

          <aside className="table-overlay table-chat">
            <ChatPanel messages={campaign.chat} currentUserId={currentUserId} onSend={onSendChat} />
          </aside>
        </section>
      </main>

      {activePopup === "sheet" && (
        <WorkspaceModal
          title={selectedActor ? `${selectedActor.name} Sheet` : "Interactive Sheet"}
          size="wide"
          backdropClassName="bg-transparent"
          onClose={() => onSetActivePopup(null)}
        >
          <CharacterSheet
            token={token}
            actor={selectedActor ?? undefined}
            compendium={compendium}
            allowedSourceBooks={campaign.allowedSourceBooks}
            role={role}
            currentUserId={currentUserId}
            onSave={onSaveActor}
            onRoll={onRoll}
          />
        </WorkspaceModal>
      )}

      {role === "dm" && isMapPopupOpen ? (
        <WorkspaceModal initialView={boardMapView} onClose={closeBoardMapModal}>
          {({ currentView, pushView }) => {
            const currentMapId = (currentView.data as { mapId?: string } | undefined)?.mapId;
            const currentMap = resolveDialogMap(currentMapId);

            if (currentView.id === "board-maps") {
              return (
                <CampaignMapManager
                  campaignMaps={campaign.maps}
                  role={role}
                  activeMap={activeMap}
                  onShowMap={onShowMap}
                  onStartCreateMap={() => {
                    onStartCreateMap();
                    pushView({
                      id: "board-map-create",
                      title: "New map",
                      size: "full"
                    });
                  }}
                  onStartEditMap={(map) => {
                    onSelectMap(map.id);
                    onStartEditMap(map);
                    pushView({
                      id: "board-map-edit",
                      title: `Edit ${map.name}`,
                      size: "full",
                      data: { mapId: map.id }
                    });
                  }}
                  onOpenActors={(map) => {
                    onSelectMap(map.id);
                    pushView({
                      id: "board-map-actors",
                      title: `${map.name} actors`,
                      size: "wide",
                      data: { mapId: map.id }
                    });
                  }}
                />
              );
            }

            if (currentView.id === "board-map-create" || currentView.id === "board-map-edit") {
              return (
                <CampaignMapEditor
                  token={token}
                  role={role}
                  activeMap={activeMap}
                  editingMap={editingMap}
                  mapEditorMode={mapEditorMode}
                  canUndoEditingMap={canUndoEditingMap}
                  canRedoEditingMap={canRedoEditingMap}
                  canPersistEditingMap={canPersistEditingMap}
                  onChangeEditingMap={onChangeEditingMap}
                  onSaveEditingMap={onSaveEditingMap}
                  onReloadEditingMap={onReloadEditingMap}
                  onUndoEditingMap={onUndoEditingMap}
                  onRedoEditingMap={onRedoEditingMap}
                  onSetEditingMapActive={onSetEditingMapActive}
                  onMapUploadError={onMapUploadError}
                />
              );
            }

            if (currentView.id === "board-map-actors") {
              return (
                <CampaignMapRoster
                  role={role}
                  currentUserId={currentUserId}
                  selectedMap={currentMap}
                  selectedActor={selectedActor}
                  roster={resolveDialogRoster(currentMapId)}
                  onOpenSheet={(actorId) => {
                    setIsMapPopupOpen(false);
                    onSelectActor(actorId);
                    onSetActivePopup("sheet");
                  }}
                  onRemoveActorFromCurrentMap={onRemoveActorFromMap}
                  onOpenAddFlow={currentMap ? () => pushView(buildCreateActorView(currentMap.id)) : undefined}
                />
              );
            }

            if (currentView.id === "board-map-actor-create") {
              return (
                <CampaignMapActorCreator
                  currentUserId={currentUserId}
                  selectedMap={currentMap}
                  compendium={compendium}
                  actorCreatorKind={actorCreatorKind}
                  availableActors={resolveDialogAvailableActors(currentMapId)}
                  filteredCatalog={filteredCatalog}
                  selectedMonsterTemplate={selectedMonsterTemplate}
                  onActorCreatorKindChange={onActorCreatorKindChange}
                  onCreateActor={onCreateMapActor}
                  onMonsterQueryChange={onMonsterQueryChange}
                  onSelectMonster={onSelectMonster}
                  onCreateMonsterActor={onCreateMapMonsterActor}
                  onAssignActorToCurrentMap={onAssignActorToMap}
                  onOpenSheet={(actorId) => {
                    setIsMapPopupOpen(false);
                    onSelectActor(actorId);
                    onSetActivePopup("sheet");
                  }}
                />
              );
            }

            return null;
          }}
        </WorkspaceModal>
      ) : null}
    </>
  );
}

function buildInitiativeNotation(modifier: number) {
  return modifier >= 0 ? `1d20+${modifier}` : `1d20${modifier}`;
}

function formatSigned(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}
