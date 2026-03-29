import { Eye, FilePlus2, Pencil, Users } from "lucide-react";

import type { CampaignMap, MemberRole } from "@shared/types";

import { CampaignActionButton } from "./CampaignActionButton";

interface CampaignMapManagerProps {
  campaignMaps: CampaignMap[];
  role: MemberRole;
  activeMap?: CampaignMap;
  onShowMap: (mapId: string) => void;
  onStartCreateMap?: () => void;
  onOpenActors?: (map: CampaignMap) => void;
  onStartEditMap?: (map: CampaignMap) => void;
}

export function CampaignMapManager({
  campaignMaps,
  role,
  activeMap,
  onShowMap,
  onStartCreateMap,
  onOpenActors,
  onStartEditMap
}: CampaignMapManagerProps) {
  return (
    <div className="maps-popup">
      <section className="dark-card popup-card maps-list-card maps-list-card-fill">
        <div className="panel-head">
          <div>
            <p className="panel-label">Maps</p>
            <h2>Board selection</h2>
          </div>
          {role === "dm" && onStartCreateMap ? (
            <CampaignActionButton onClick={onStartCreateMap} icon={FilePlus2} tone="accent">
              New Map
            </CampaignActionButton>
          ) : (
            <span className="badge subtle">{campaignMaps.length}</span>
          )}
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
                <CampaignActionButton
                  title={map.id === activeMap?.id ? "Current board" : "Select map"}
                  aria-label={map.id === activeMap?.id ? "Current board" : "Select map"}
                  disabled={map.id === activeMap?.id}
                  onClick={() => onShowMap(map.id)}
                  icon={Eye}
                />
                {role === "dm" && onStartEditMap ? (
                  <CampaignActionButton title="Edit map" aria-label="Edit map" onClick={() => onStartEditMap(map)} icon={Pencil} />
                ) : null}
                {role === "dm" && onOpenActors ? (
                  <CampaignActionButton
                    title="Manage map actors"
                    aria-label="Manage map actors"
                    onClick={() => onOpenActors(map)}
                    icon={Users}
                  />
                ) : null}
              </div>
            ))}
            {campaignMaps.length === 0 ? <p className="empty-state">No maps are available yet.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
