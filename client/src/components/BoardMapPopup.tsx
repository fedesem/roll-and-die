import { Eye, Map as MapIcon } from "lucide-react";

import type { ActorSheet, CampaignMap, MemberRole } from "@shared/types";

import { CampaignMapAssignments } from "./CampaignMapAssignments";
import type {
  ActorTypeFilter,
  AvailableActorEntry,
  CurrentMapRosterEntry
} from "../features/campaign/types";

interface BoardMapPopupProps {
  role: MemberRole;
  currentUserId: string;
  campaignMaps: CampaignMap[];
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
  onShowMap: (mapId: string) => void;
}

export function BoardMapPopup({
  role,
  currentUserId,
  campaignMaps,
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
  onRemoveActorFromCurrentMap,
  onShowMap
}: BoardMapPopupProps) {
  if (role !== "dm") {
    return (
      <CampaignMapAssignments
        role={role}
        currentUserId={currentUserId}
        activeMap={activeMap}
        selectedActor={selectedActor}
        filteredCurrentMapRoster={filteredCurrentMapRoster}
        availableActors={availableActors}
        actorSearch={actorSearch}
        mapActorSearch={mapActorSearch}
        actorTypeFilter={actorTypeFilter}
        mapActorTypeFilter={mapActorTypeFilter}
        onOpenSheet={onOpenSheet}
        onActorSearchChange={onActorSearchChange}
        onMapActorSearchChange={onMapActorSearchChange}
        onActorTypeFilterChange={onActorTypeFilterChange}
        onMapActorTypeFilterChange={onMapActorTypeFilterChange}
        onAssignActorToCurrentMap={onAssignActorToCurrentMap}
        onRemoveActorFromCurrentMap={onRemoveActorFromCurrentMap}
      />
    );
  }

  return (
    <div className="campaign-maps-grid">
      <section className="dark-card popup-card maps-list-card">
        <div className="panel-head">
          <div>
            <p className="panel-label">Maps</p>
            <h2>Board selection</h2>
          </div>
          <span className="badge subtle">{campaignMaps.length}</span>
        </div>
        <div className="maps-list-scroll">
          <div className="list-stack">
            {campaignMaps.map((map) => (
              <div key={map.id} className="popup-row">
                <div className="list-row map-list-row">
                  <div className="actor-row-main">
                    <span className="actor-row-name">{map.name}</span>
                    <div className="actor-row-meta">
                      <span className="badge subtle">{map.id === activeMap?.id ? "Active" : "Standby"}</span>
                      <span className="badge subtle">
                        {map.width}x{map.height}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  className="icon-action-button"
                  type="button"
                  title={map.id === activeMap?.id ? "Current board" : "Open on board"}
                  disabled={map.id === activeMap?.id}
                  onClick={() => onShowMap(map.id)}
                >
                  <Eye size={15} />
                </button>
              </div>
            ))}
            {campaignMaps.length === 0 && (
              <p className="empty-state">
                <MapIcon size={15} />
                <span>No maps are available yet.</span>
              </p>
            )}
          </div>
        </div>
      </section>

      <CampaignMapAssignments
        role={role}
        currentUserId={currentUserId}
        activeMap={activeMap}
        selectedActor={selectedActor}
        filteredCurrentMapRoster={filteredCurrentMapRoster}
        availableActors={availableActors}
        actorSearch={actorSearch}
        mapActorSearch={mapActorSearch}
        actorTypeFilter={actorTypeFilter}
        mapActorTypeFilter={mapActorTypeFilter}
        onOpenSheet={onOpenSheet}
        onActorSearchChange={onActorSearchChange}
        onMapActorSearchChange={onMapActorSearchChange}
        onActorTypeFilterChange={onActorTypeFilterChange}
        onMapActorTypeFilterChange={onMapActorTypeFilterChange}
        onAssignActorToCurrentMap={onAssignActorToCurrentMap}
        onRemoveActorFromCurrentMap={onRemoveActorFromCurrentMap}
      />
    </div>
  );
}
