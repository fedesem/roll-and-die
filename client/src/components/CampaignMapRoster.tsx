import { FilePlus2, MapPinned, Minus, ScrollText, Skull, Square, User, Users } from "lucide-react";

import type { ActorKind, ActorSheet, CampaignMap, MemberRole } from "@shared/types";

import type { CurrentMapRosterEntry } from "../features/campaign/types";
import { CampaignActionButton } from "./CampaignActionButton";

interface CampaignMapRosterProps {
  role: MemberRole;
  currentUserId: string;
  selectedMap?: CampaignMap;
  selectedActor: ActorSheet | null;
  roster: CurrentMapRosterEntry[];
  onOpenSheet: (actorId: string) => void;
  onRemoveActorFromCurrentMap: (actorId: string, mapId: string) => void;
  onOpenAddFlow?: () => void;
}

export function CampaignMapRoster({
  role,
  currentUserId,
  selectedMap,
  selectedActor,
  roster,
  onOpenSheet,
  onRemoveActorFromCurrentMap,
  onOpenAddFlow
}: CampaignMapRosterProps) {
  const canManageActor = (actor: ActorSheet) => role === "dm" || actor.ownerId === currentUserId;
  const canOpenSheet = (actor: ActorSheet) => role === "dm" || actor.sheetAccess === "full" || actor.ownerId === currentUserId;

  return (
    <section className="popup-card actor-list-card">
      <div className="panel-head">
        <div>
          <p className="panel-label">{selectedMap?.id ? "Selected Map" : "Map"}</p>
          <h2>{selectedMap ? `${selectedMap.name} roster` : "Actors on map"}</h2>
        </div>
        <div className="actor-selection-actions">
          <span className="badge subtle">{roster.length}</span>
          {role === "dm" && onOpenAddFlow ? (
            <CampaignActionButton onClick={onOpenAddFlow} icon={FilePlus2} tone="accent">
              Add actor
            </CampaignActionButton>
          ) : null}
        </div>
      </div>

      <div className="actor-list-scroll">
        <div className="list-stack">
          {roster.map(({ actor, token, actorKind, assignment, label, isImplicitAssignment, ownerName }) => {
            const canRemoveFromMap = Boolean(actor && canManageActor(actor) && !isImplicitAssignment);

            return (
              <div key={`${assignment.mapId}:${assignment.actorId}`} className="popup-row actor-popup-row">
                <div className={`list-row actor-list-row-static ${actor && selectedActor?.id === actor.id ? "is-selected" : ""}`}>
                  <div className="actor-row-main">
                    <span className="actor-row-name">{label}</span>
                    <div className="actor-row-meta">
                      <MetaIconBadge icon={iconForActorKind(actorKind)} label={actorKind} />
                      {ownerName ? <ActorOwnerBadge ownerName={ownerName} /> : null}
                      {token ? <MetaIconBadge icon={MapPinned} label="On board" /> : null}
                      {!actor ? <MetaIconBadge icon={Users} label="Seen" /> : null}
                    </div>
                  </div>
                </div>
                <div className="actor-list-actions">
                  {actor ? (
                    <CampaignActionButton
                      title="Open sheet"
                      aria-label="Open sheet"
                      disabled={!canOpenSheet(actor)}
                      onClick={() => onOpenSheet(actor.id)}
                      icon={ScrollText}
                    />
                  ) : null}
                  {canRemoveFromMap && actor && selectedMap ? (
                    <CampaignActionButton
                      title="Remove actor from selected map"
                      aria-label="Remove actor from selected map"
                      onClick={() => onRemoveActorFromCurrentMap(actor.id, selectedMap.id)}
                      icon={Minus}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
          {!selectedMap ? <p className="empty-state">Choose a map before assigning actors.</p> : null}
          {selectedMap && roster.length === 0 ? <p className="empty-state">No actors are assigned to this map.</p> : null}
        </div>
      </div>
    </section>
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

function MetaIconBadge({
  icon: Icon,
  label
}: {
  icon: typeof User;
  label: string;
}) {
  return (
    <span className="badge subtle actor-meta-icon-badge" title={label} aria-label={label}>
      <Icon />
    </span>
  );
}
