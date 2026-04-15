import { useMemo, useState } from "react";
import { Map, MapPinned, ScrollText, Skull, Square, Trash2, User, Users } from "lucide-react";

import type { ActorKind, ActorSheet, CampaignMap, CampaignMember, MemberRole } from "@shared/types";

import type { ActorTypeFilter, AvailableActorEntry } from "../features/campaign/types";
import { CampaignActionButton } from "./CampaignActionButton";
import { ViewportWorkspace, WorkspacePane, WorkspacePaneBody } from "./layout/ViewportWorkspace";

interface CampaignActorManagerProps {
  role: MemberRole;
  currentUserId: string;
  campaignMaps: CampaignMap[];
  campaignMembers: CampaignMember[];
  selectedActor: ActorSheet | null;
  availableActors: AvailableActorEntry[];
  actorSearch: string;
  actorTypeFilter: ActorTypeFilter;
  actorCreatorOpen: boolean;
  onOpenSheet: (actorId: string) => void;
  onActorSearchChange: (value: string) => void;
  onActorTypeFilterChange: (value: ActorTypeFilter) => void;
  onActorCreatorOpenChange: (open: boolean) => void;
  onDeleteActor: (actor: ActorSheet) => void;
}

export function CampaignActorManager({
  role,
  currentUserId,
  campaignMaps,
  campaignMembers,
  selectedActor,
  availableActors,
  actorSearch,
  actorTypeFilter,
  actorCreatorOpen,
  onOpenSheet,
  onActorSearchChange,
  onActorTypeFilterChange,
  onActorCreatorOpenChange,
  onDeleteActor
}: CampaignActorManagerProps) {
  const [ownerFilter, setOwnerFilter] = useState("__all__");
  const [mapFilter, setMapFilter] = useState("__all__");
  const canManageActor = (actor: ActorSheet) => role === "dm" || actor.ownerId === currentUserId;
  const canOpenSheet = (actor: ActorSheet) => role === "dm" || actor.sheetAccess === "full" || actor.ownerId === currentUserId;
  const availableHeading = role === "dm" ? "Available actors" : "Your actors";
  const filteredActors = useMemo(() => {
    if (role !== "dm") {
      return availableActors;
    }

    return availableActors.filter((entry) => {
      if (ownerFilter === "__unowned__") {
        if (entry.actor.ownerId) {
          return false;
        }
      } else if (ownerFilter === "__dm__") {
        if (entry.ownerRole !== "dm") {
          return false;
        }
      } else if (ownerFilter === "__players__") {
        if (entry.ownerRole !== "player") {
          return false;
        }
      } else if (ownerFilter !== "__all__" && entry.actor.ownerId !== ownerFilter) {
        return false;
      }

      if (mapFilter === "__all__") {
        return true;
      }

      if (mapFilter === "__unassigned__") {
        return entry.activeMaps.length === 0;
      }

      return entry.activeMaps.some((map) => map.id === mapFilter);
    });
  }, [availableActors, mapFilter, ownerFilter, role]);

  return (
    <ViewportWorkspace
      columns="repeat(2, minmax(0, 1fr))"
      stackBreakpoint="1100"
      heightMode="fill"
      workspaceMinHeight="32rem"
      className="h-full"
    >
      <WorkspacePane as="section" className="dark-card popup-card actor-list-card">
        <div className="panel-head">
          <div>
            <p className="panel-label">Roster</p>
            <h2>{availableHeading}</h2>
          </div>
          <span className="badge subtle">{filteredActors.length}</span>
        </div>
        {role === "dm" ? (
          <div className="actor-filter-row">
            <input
              placeholder="Search available actors"
              value={actorSearch}
              onChange={(event) => onActorSearchChange(event.target.value)}
            />
            <select value={actorTypeFilter} onChange={(event) => onActorTypeFilterChange(event.target.value as ActorTypeFilter)}>
              <option value="all">All types</option>
              <option value="character">Characters</option>
              <option value="npc">NPCs</option>
              <option value="monster">Monsters</option>
              <option value="static">Static</option>
            </select>
            <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
              <option value="__all__">All owners</option>
              <option value="__players__">Player-owned</option>
              <option value="__dm__">DM-owned</option>
              <option value="__unowned__">Unowned</option>
              {campaignMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
            </select>
            <select value={mapFilter} onChange={(event) => setMapFilter(event.target.value)}>
              <option value="__all__">All maps</option>
              <option value="__unassigned__">No map</option>
              {campaignMaps.map((map) => (
                <option key={map.id} value={map.id}>
                  {map.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="actor-filter-row">
            <input placeholder="Search your actors" value={actorSearch} onChange={(event) => onActorSearchChange(event.target.value)} />
          </div>
        )}
        <WorkspacePaneBody className="actor-list-scroll" contentClassName="list-stack">
          {filteredActors.map(({ actor, activeMaps, onCurrentMap, isOnAllMaps, ownerName }) => {
            const canManage = canManageActor(actor);

            return (
              <div key={actor.id} className="popup-row actor-popup-row">
                <div className={`list-row actor-list-row-static ${selectedActor?.id === actor.id ? "is-selected" : ""}`}>
                  <div className="actor-row-main">
                    <span className="actor-row-name">{actor.name}</span>
                    <div className="actor-row-meta">
                      <ActorMetaIconBadge icon={iconForActorKind(actor.kind)} label={actor.kind} />
                      {role === "dm" ? <ActorOwnerBadge ownerName={ownerName} /> : null}
                      {role === "dm" && onCurrentMap ? <ActorMetaIconBadge icon={MapPinned} label="Assigned" /> : null}
                      {role === "dm" ? (
                        isOnAllMaps ? (
                          <ActorMetaIconBadge icon={Map} label="All maps" />
                        ) : (
                          activeMaps.map((map) => (
                            <span key={map.id} className="badge map-badge">
                              {map.name}
                            </span>
                          ))
                        )
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="actor-list-actions">
                  <CampaignActionButton
                    title="Open sheet"
                    aria-label="Open sheet"
                    disabled={!canOpenSheet(actor)}
                    onClick={() => onOpenSheet(actor.id)}
                    icon={ScrollText}
                  />
                  {canManage && (
                    <CampaignActionButton
                      title="Delete actor"
                      onClick={() => onDeleteActor(actor)}
                      aria-label="Delete actor"
                      icon={Trash2}
                      tone="danger"
                    />
                  )}
                </div>
              </div>
            );
          })}
          {filteredActors.length === 0 && (
            <p className="empty-state">{role === "dm" ? "No actors match that search." : "You do not have any actors yet."}</p>
          )}
        </WorkspacePaneBody>
      </WorkspacePane>

      <WorkspacePane as="section" className="dark-card popup-card actor-create-card">
        <div className="panel-head">
          <div>
            <p className="panel-label">Create</p>
            <h2>{role === "dm" ? "Map-scoped actors" : "New actor"}</h2>
          </div>
          {role !== "dm" && (
            <button
              className={actorCreatorOpen ? "accent-button" : ""}
              type="button"
              onClick={() => onActorCreatorOpenChange(!actorCreatorOpen)}
            >
              {actorCreatorOpen ? "Close" : "Create actor"}
            </button>
          )}
        </div>
        <WorkspacePaneBody scroll="none">
          {role === "dm" ? (
            <p className="empty-state">
              Create DM-owned actors from the Maps tab after selecting the map you want to edit. Player-owned actors still appear here in the
              general roster.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="empty-state">Open the popup to create a new actor. Character and summon creation now use the same modal flow as the board sheet.</p>
              {!actorCreatorOpen ? null : (
                <div className="rounded-none border border-amber-200/15 bg-amber-300/8 px-4 py-3 text-sm text-amber-100">
                  The actor creation popup is already open.
                </div>
              )}
            </div>
          )}
        </WorkspacePaneBody>
      </WorkspacePane>
    </ViewportWorkspace>
  );
}

function iconForActorKind(kind: ActorKind): typeof User {
  switch (kind) {
    case "character":
      return User;
    case "npc":
      return Users;
    case "monster":
      return Skull;
    case "static":
      return Square;
  }
}

function ActorOwnerBadge({ ownerName }: { ownerName: string }) {
  return (
    <span className="badge subtle actor-owner-badge" title={ownerName}>
      {ownerName}
    </span>
  );
}

function ActorMetaIconBadge({ icon: Icon, label }: { icon: typeof User; label: string }) {
  return (
    <span className="badge subtle actor-meta-icon-badge" title={label} aria-label={label}>
      <Icon />
    </span>
  );
}
