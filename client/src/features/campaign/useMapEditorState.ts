import { useCallback, useMemo, useState } from "react";

import type { CampaignMap } from "@shared/types";

import { cloneMap, createClientMapDraft } from "../../lib/drafts";

export function useMapEditorState() {
  const [mapDraft, setMapDraft] = useState<CampaignMap | null>(null);
  const [newMapDraft, setNewMapDraft] = useState<CampaignMap>(() => createClientMapDraft("New Map"));
  const [mapEditorMode, setMapEditorMode] = useState<"create" | "edit" | null>(null);
  const [mapEditorPast, setMapEditorPast] = useState<CampaignMap[]>([]);
  const [mapEditorFuture, setMapEditorFuture] = useState<CampaignMap[]>([]);
  const [mapEditorBaseline, setMapEditorBaseline] = useState<CampaignMap | null>(null);

  const editingMap = mapEditorMode === "create" ? newMapDraft : mapEditorMode === "edit" ? mapDraft : null;
  const canUndoEditingMap = mapEditorPast.length > 0;
  const canRedoEditingMap = mapEditorFuture.length > 0;
  const canPersistEditingMap = useMemo(
    () => Boolean(editingMap) && Boolean(mapEditorBaseline) && JSON.stringify(editingMap) !== JSON.stringify(mapEditorBaseline),
    [editingMap, mapEditorBaseline]
  );

  const replaceEditingMap = useCallback(
    (nextMap: CampaignMap) => {
      if (mapEditorMode === "create") {
        setNewMapDraft(nextMap);
        return;
      }

      setMapDraft(nextMap);
    },
    [mapEditorMode]
  );

  const resetMapEditorHistory = useCallback((baseMap: CampaignMap) => {
    setMapEditorBaseline(cloneMap(baseMap));
    setMapEditorPast([]);
    setMapEditorFuture([]);
  }, []);

  const openMapEditorForCreate = useCallback(() => {
    const nextMap = createClientMapDraft("New Map");

    setNewMapDraft(nextMap);
    setMapEditorMode("create");
    resetMapEditorHistory(nextMap);
  }, [resetMapEditorHistory]);

  const openMapEditorForEdit = useCallback(
    (map: CampaignMap, onSelectMap: (mapId: string) => void) => {
      onSelectMap(map.id);

      const nextMap = cloneMap(map);
      setMapDraft(nextMap);
      setMapEditorMode("edit");
      resetMapEditorHistory(nextMap);
    },
    [resetMapEditorHistory]
  );

  const changeEditingMap = useCallback(
    (nextMap: CampaignMap) => {
      if (!editingMap) {
        return;
      }

      if (JSON.stringify(editingMap) === JSON.stringify(nextMap)) {
        return;
      }

      setMapEditorPast((current) => [...current, cloneMap(editingMap)]);
      setMapEditorFuture([]);
      replaceEditingMap(nextMap);
    },
    [editingMap, replaceEditingMap]
  );

  const reloadEditingMap = useCallback(() => {
    if (!mapEditorBaseline) {
      return;
    }

    replaceEditingMap(cloneMap(mapEditorBaseline));
    resetMapEditorHistory(mapEditorBaseline);
  }, [mapEditorBaseline, replaceEditingMap, resetMapEditorHistory]);

  const undoEditingMap = useCallback(() => {
    if (!editingMap || mapEditorPast.length === 0) {
      return;
    }

    const previous = mapEditorPast[mapEditorPast.length - 1];

    setMapEditorPast((current) => current.slice(0, -1));
    setMapEditorFuture((current) => [cloneMap(editingMap), ...current]);
    replaceEditingMap(cloneMap(previous));
  }, [editingMap, mapEditorPast, replaceEditingMap]);

  const redoEditingMap = useCallback(() => {
    if (!editingMap || mapEditorFuture.length === 0) {
      return;
    }

    const [next, ...rest] = mapEditorFuture;

    setMapEditorFuture(rest);
    setMapEditorPast((current) => [...current, cloneMap(editingMap)]);
    replaceEditingMap(cloneMap(next));
  }, [editingMap, mapEditorFuture, replaceEditingMap]);

  return {
    mapDraft,
    setMapDraft,
    newMapDraft,
    setNewMapDraft,
    mapEditorMode,
    setMapEditorMode,
    mapEditorBaseline,
    editingMap,
    canUndoEditingMap,
    canRedoEditingMap,
    canPersistEditingMap,
    resetMapEditorHistory,
    openMapEditorForCreate,
    openMapEditorForEdit,
    changeEditingMap,
    reloadEditingMap,
    undoEditingMap,
    redoEditingMap
  };
}
