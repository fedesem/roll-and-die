import { Minus, Plus, ScrollText } from "lucide-react";

import type { ActorSheet, CampaignMap, MemberRole } from "@shared/types";

import type {
  ActorTypeFilter,
  AvailableActorEntry,
  CurrentMapRosterEntry
} from "../features/campaign/types";

interface CampaignMapAssignmentsProps {
  role: MemberRole;
  currentUserId: string;
  activeMap?: CampaignMap;
  selectedActor: ActorSheet | null;
  filteredCurrentMapRoster: CurrentMapRosterEntry[];
  availableActors: AvailableActorEntry[];
  actorSearch: string;
  mapActorSearch: string;
  actorTypeFilter: ActorTypeFilter;
  mapActorTypeFilter: ActorTypeFilter;
  onOpenSheet: (actorId: string) => void;
  onActorSearchChange: (value: string) => void;
  onMapActorSearchChange: (value: string) => void;
  onActorTypeFilterChange: (value: ActorTypeFilter) => void;
  onMapActorTypeFilterChange: (value: ActorTypeFilter) => void;
  onAssignActorToCurrentMap: (actorId: string) => void;
  onRemoveActorFromCurrentMap: (actorId: string) => void;
}

export function CampaignMapAssignments({
  role,
  currentUserId,
  activeMap,
  selectedActor,
  filteredCurrentMapRoster,
  availableActors,
  actorSearch,
  mapActorSearch,
  actorTypeFilter,
  mapActorTypeFilter,
  onOpenSheet,
  onActorSearchChange,
  onMapActorSearchChange,
  onActorTypeFilterChange,
  onMapActorTypeFilterChange,
  onAssignActorToCurrentMap,
  onRemoveActorFromCurrentMap
}: CampaignMapAssignmentsProps) {
  const canManageActor = (actor: ActorSheet) => role === "dm" || actor.ownerId === currentUserId;
  const canOpenSheet = (actor: ActorSheet) => role === "dm" || actor.sheetAccess === "full" || actor.ownerId === currentUserId;

  return (
    <div className="popup-grid campaign-map-assignment-grid">
      <section className="dark-card popup-card actor-list-card">
        <div className="panel-head">
          <div>
            <p className="panel-label">Selection</p>
            <h2>Actors</h2>
          </div>
          <span className="badge subtle">{availableActors.length}</span>
        </div>
        <div className="actor-filter-row">
          <input
            placeholder="Search actors for the active board"
            value={actorSearch}
            onChange={(event) => onActorSearchChange(event.target.value)}
          />
          <select
            value={actorTypeFilter}
            onChange={(event) => onActorTypeFilterChange(event.target.value as ActorTypeFilter)}
          >
            <option value="all">All types</option>
            <option value="character">Characters</option>
            <option value="npc">NPCs</option>
            <option value="monster">Monsters</option>
            <option value="static">Static</option>
          </select>
        </div>
        <div className="actor-list-scroll">
          <div className="list-stack">
            {availableActors.map(({ actor, activeMaps, onCurrentMap }) => {
              const canManage = canManageActor(actor);

              return (
                <div key={actor.id} className="popup-row actor-popup-row">
                  <div className={`list-row actor-list-row-static ${selectedActor?.id === actor.id ? "is-selected" : ""}`}>
                    <div className="actor-row-main">
                      <span className="actor-row-name">{actor.name}</span>
                      <div className="actor-row-meta">
                        <span className="badge subtle">{actor.kind}</span>
                        {onCurrentMap && <span className="badge subtle">On active board</span>}
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
                      disabled={!canOpenSheet(actor)}
                      onClick={() => onOpenSheet(actor.id)}
                    >
                      <ScrollText size={15} />
                    </button>
                    {canManage && (
                      <button
                        className="icon-action-button"
                        type="button"
                        title={onCurrentMap ? "Already on the active board" : "Add actor to active board"}
                        disabled={onCurrentMap || !activeMap}
                        onClick={() => onAssignActorToCurrentMap(actor.id)}
                      >
                        <Plus size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {availableActors.length === 0 && <p className="empty-state">No actors match that search.</p>}
          </div>
        </div>
      </section>

      <section className="dark-card popup-card actor-list-card">
        <div className="panel-head">
          <div>
            <p className="panel-label">Active Board</p>
            <h2>{activeMap ? `${activeMap.name} roster` : "Actors on map"}</h2>
          </div>
          <span className="badge subtle">{filteredCurrentMapRoster.length}</span>
        </div>
        <div className="actor-filter-row">
          <input
            placeholder="Search current map actors"
            value={mapActorSearch}
            onChange={(event) => onMapActorSearchChange(event.target.value)}
          />
          <select
            value={mapActorTypeFilter}
            onChange={(event) => onMapActorTypeFilterChange(event.target.value as ActorTypeFilter)}
          >
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
              const canRemoveFromMap = Boolean(actor && canManageActor(actor));

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
                        disabled={!canOpenSheet(actor)}
                        onClick={() => onOpenSheet(actor.id)}
                      >
                        <ScrollText size={15} />
                      </button>
                    )}
                    {canRemoveFromMap && actor && (
                      <button
                        className="icon-action-button"
                        type="button"
                        title="Remove actor from active board"
                        onClick={() => onRemoveActorFromCurrentMap(actor.id)}
                      >
                        <Minus size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {!activeMap ? (
              <p className="empty-state">Choose an active board before assigning actors.</p>
            ) : filteredCurrentMapRoster.length === 0 ? (
              <p className="empty-state">No actors are assigned to the active board.</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
