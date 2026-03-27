import { useState } from "react";

import { Home, Map as MapIcon, ScrollText } from "lucide-react";

import type {
  ActorSheet,
  CampaignMap,
  CampaignMember,
  CampaignSnapshot,
  DrawingStroke,
  MapPing,
  MapViewportRecall,
  MeasurePreview,
  MemberRole,
  Point,
  TokenMovementPreview
} from "@shared/types";

import { BoardCanvas } from "../components/BoardCanvas";
import { BoardMapPopup } from "../components/BoardMapPopup";
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

type ActivePopup = "sheet" | null;

interface CampaignPageProps {
  token: string;
  campaign: CampaignSnapshot["campaign"];
  compendium: CampaignSnapshot["compendium"];
  role: MemberRole;
  currentUserId: string;
  activeMap?: CampaignMap;
  selectedActor: ActorSheet | null;
  activePopup: ActivePopup;
  boardSeenCells: string[];
  fogPreviewUserId?: string;
  playerMembers: CampaignMember[];
  dmFogEnabled: boolean;
  dmFogUserId: string | null;
  availableActors: AvailableActorEntry[];
  actorSearch: string;
  mapActorSearch: string;
  actorTypeFilter: ActorTypeFilter;
  mapActorTypeFilter: ActorTypeFilter;
  movementPreviews: Array<{ actorId: string; mapId: string; preview: TokenMovementPreview }>;
  measurePreviews: Array<{ userId: string; mapId: string; preview: MeasurePreview }>;
  mapPings: MapPing[];
  viewRecall: MapViewportRecall | null;
  filteredCurrentMapRoster: CurrentMapRosterEntry[];
  onSetActivePopup: (popup: ActivePopup) => void;
  onOpenCampaignHome: () => void;
  onSelectActor: (actorId: string | null) => void;
  onSetDmFogEnabled: (enabled: boolean) => void;
  onSetDmFogUserId: (userId: string | null) => void;
  onActorSearchChange: (value: string) => void;
  onMapActorSearchChange: (value: string) => void;
  onActorTypeFilterChange: (value: ActorTypeFilter) => void;
  onMapActorTypeFilterChange: (value: ActorTypeFilter) => void;
  onResetFog: () => Promise<void>;
  onClearFog: () => Promise<void>;
  onSelectedMapItemCountChange: (count: number) => void;
  onAssignActorToCurrentMap: (actorId: string) => void;
  onRemoveActorFromCurrentMap: (actorId: string) => void;
  onShowMap: (mapId: string) => void;
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
  onUpdateToken: (tokenId: string, patch: TokenUpdatePatch) => Promise<void>;
}

export function CampaignPage({
  token,
  campaign,
  compendium,
  role,
  currentUserId,
  activeMap,
  selectedActor,
  activePopup,
  boardSeenCells,
  fogPreviewUserId,
  playerMembers,
  dmFogEnabled,
  dmFogUserId,
  availableActors,
  actorSearch,
  mapActorSearch,
  actorTypeFilter,
  mapActorTypeFilter,
  movementPreviews,
  measurePreviews,
  mapPings,
  viewRecall,
  filteredCurrentMapRoster,
  onSetActivePopup,
  onOpenCampaignHome,
  onSelectActor,
  onSetDmFogEnabled,
  onSetDmFogUserId,
  onActorSearchChange,
  onMapActorSearchChange,
  onActorTypeFilterChange,
  onMapActorTypeFilterChange,
  onResetFog,
  onClearFog,
  onSelectedMapItemCountChange,
  onAssignActorToCurrentMap,
  onRemoveActorFromCurrentMap,
  onShowMap,
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
  onUpdateToken
}: CampaignPageProps) {
  const [isMapPopupOpen, setIsMapPopupOpen] = useState(false);

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
              <button type="button" className="overlay-menu-button" onClick={() => setIsMapPopupOpen(true)}>
                <MapIcon size={15} />
                <span>{role === "dm" ? "Maps" : "Map and actors"}</span>
              </button>
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
            token={token}
            actor={selectedActor ?? undefined}
            compendium={compendium}
            role={role}
            currentUserId={currentUserId}
            onSave={onSaveActor}
            onRoll={onRoll}
          />
        </WorkspaceModal>
      )}

      {isMapPopupOpen && (
        <WorkspaceModal
          title={role === "dm" ? "Board maps" : "Map and actors"}
          size="full"
          onClose={() => setIsMapPopupOpen(false)}
        >
          <BoardMapPopup
            role={role}
            currentUserId={currentUserId}
            campaignMaps={campaign.maps}
            activeMap={activeMap}
            selectedActor={selectedActor}
            filteredCurrentMapRoster={filteredCurrentMapRoster}
            availableActors={availableActors}
            actorSearch={actorSearch}
            mapActorSearch={mapActorSearch}
            actorTypeFilter={actorTypeFilter}
            mapActorTypeFilter={mapActorTypeFilter}
            onOpenSheet={(actorId) => {
              setIsMapPopupOpen(false);
              onSelectActor(actorId);
              onSetActivePopup("sheet");
            }}
            onActorSearchChange={onActorSearchChange}
            onMapActorSearchChange={onMapActorSearchChange}
            onActorTypeFilterChange={onActorTypeFilterChange}
            onMapActorTypeFilterChange={onMapActorTypeFilterChange}
            onAssignActorToCurrentMap={onAssignActorToCurrentMap}
            onRemoveActorFromCurrentMap={onRemoveActorFromCurrentMap}
            onShowMap={onShowMap}
          />
        </WorkspaceModal>
      )}
    </>
  );
}
