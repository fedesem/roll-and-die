import { Eye, FilePlus2, Pencil, Redo2, Undo2 } from "lucide-react";

import type { CampaignMap, MemberRole } from "@shared/types";

import { MapConfigurator } from "./MapConfigurator";

interface CampaignMapManagerProps {
  campaignMaps: CampaignMap[];
  role: MemberRole;
  activeMap?: CampaignMap;
  selectedMap?: CampaignMap;
  editingMap: CampaignMap | null;
  mapEditorMode: "create" | "edit" | null;
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
}

export function CampaignMapManager({
  campaignMaps,
  role,
  activeMap,
  selectedMap,
  editingMap,
  mapEditorMode,
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
  onMapUploadError
}: CampaignMapManagerProps) {
  return (
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
                  {role === "dm" && map.id !== activeMap?.id && (
                    <button
                      className="icon-action-button"
                      type="button"
                      title="Open on board"
                      onClick={() => onShowMap(map.id)}
                    >
                      <Eye size={15} />
                    </button>
                  )}
                  {role === "dm" && (
                    <button
                      className="icon-action-button"
                      type="button"
                      title="Edit map"
                      onClick={() => onStartEditMap(map)}
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          {role === "dm" && (
            <button
              className={mapEditorMode === "create" ? "accent-button" : ""}
              type="button"
              onClick={onStartCreateMap}
            >
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
            <button type="button" onClick={onBackToMapsList}>
              Back
            </button>
          </div>
          {role === "dm" && (
            <div className="inline-form compact map-editor-savebar">
              {mapEditorMode === "edit" && editingMap && (
                <button
                  className="accent-button"
                  type="button"
                  disabled={editingMap.id === activeMap?.id}
                  onClick={onSetEditingMapActive}
                >
                  {editingMap.id === activeMap?.id ? "Current Board" : "Set Active Board"}
                </button>
              )}
              <button type="button" disabled={!canUndoEditingMap} title="Undo (Ctrl+Z)" onClick={onUndoEditingMap}>
                <Undo2 size={15} />
              </button>
              <button type="button" disabled={!canRedoEditingMap} title="Redo (Ctrl+Shift+Z)" onClick={onRedoEditingMap}>
                <Redo2 size={15} />
              </button>
              <button type="button" disabled={!canPersistEditingMap} onClick={onReloadEditingMap}>
                Reload
              </button>
              <button className="accent-button" type="button" disabled={!canPersistEditingMap} onClick={onSaveEditingMap}>
                Save
              </button>
            </div>
          )}
          <MapConfigurator
            map={editingMap}
            disabled={role !== "dm"}
            onChange={onChangeEditingMap}
            onUndo={onUndoEditingMap}
            onRedo={onRedoEditingMap}
            canUndo={canUndoEditingMap}
            canRedo={canRedoEditingMap}
            onUploadError={onMapUploadError}
          />
        </section>
      )}
    </div>
  );
}
