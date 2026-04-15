import { Redo2, Undo2 } from "lucide-react";

import type { CampaignMap, MemberRole } from "@shared/types";

import { CampaignActionButton } from "./CampaignActionButton";
import { MapConfigurator } from "./MapConfigurator";

interface CampaignMapEditorProps {
  token: string;
  role: MemberRole;
  activeMap?: CampaignMap;
  editingMap: CampaignMap | null;
  mapEditorMode: "create" | "edit" | null;
  canUndoEditingMap: boolean;
  canRedoEditingMap: boolean;
  canPersistEditingMap: boolean;
  onChangeEditingMap: (map: CampaignMap) => void;
  onSaveEditingMap: () => void;
  onReloadEditingMap: () => void;
  onUndoEditingMap: () => void;
  onRedoEditingMap: () => void;
  onSetEditingMapActive: () => void;
  onMapUploadError: (message: string) => void;
}

export function CampaignMapEditor({
  token,
  role,
  activeMap,
  editingMap,
  mapEditorMode,
  canUndoEditingMap,
  canRedoEditingMap,
  canPersistEditingMap,
  onChangeEditingMap,
  onSaveEditingMap,
  onReloadEditingMap,
  onUndoEditingMap,
  onRedoEditingMap,
  onSetEditingMapActive,
  onMapUploadError
}: CampaignMapEditorProps) {
  if (!editingMap) {
    return <p className="empty-state">Choose a map before opening the editor.</p>;
  }

  return (
    <section className="popup-card maps-editor-card h-full">
      {role === "dm" ? (
        <div className="inline-form compact map-editor-savebar">
          {mapEditorMode === "edit" ? (
            <button className="accent-button" type="button" disabled={editingMap.id === activeMap?.id} onClick={onSetEditingMapActive}>
              {editingMap.id === activeMap?.id ? "Current Board" : "Set Active Board"}
            </button>
          ) : null}
          <CampaignActionButton
            disabled={!canUndoEditingMap}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            onClick={onUndoEditingMap}
            icon={Undo2}
          />
          <CampaignActionButton
            disabled={!canRedoEditingMap}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            onClick={onRedoEditingMap}
            icon={Redo2}
          />
          <button type="button" disabled={!canPersistEditingMap} onClick={onReloadEditingMap}>
            Reload
          </button>
          <button className="accent-button" type="button" disabled={!canPersistEditingMap} onClick={onSaveEditingMap}>
            Save
          </button>
        </div>
      ) : null}
      <MapConfigurator
        token={token}
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
  );
}
