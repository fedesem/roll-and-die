import { useCallback, useEffect, useMemo, useState } from "react";

import type { CampaignMap, DrawingStroke, Point } from "@shared/types";

import { getDrawingRenderPoints, normalizeSelectionRect, pathBoundsIntersectsRect } from "./boardUtils";
import { selectionDragThreshold } from "./constants";
import type { SelectedMapItem, SelectionState } from "./types";

interface UseBoardSelectionOptions {
  map?: CampaignMap;
  selectableDrawings: DrawingStroke[];
  worldToScreen: (point: Point) => Point;
  onSelectedMapItemCountChange: (count: number) => void;
  onDeleteDrawings: (mapId: string, drawingIds: string[]) => Promise<void>;
}

export function useBoardSelection({
  map,
  selectableDrawings,
  worldToScreen,
  onSelectedMapItemCountChange,
  onDeleteDrawings
}: UseBoardSelectionOptions) {
  const [selectedMapItems, setSelectedMapItems] = useState<SelectedMapItem[]>([]);
  const [selectionBox, setSelectionBox] = useState<SelectionState | null>(null);

  const selectedDrawings = useMemo(() => {
    const selectedIds = new Set(selectedMapItems.map((entry) => entry.slice("drawing:".length)));
    return selectableDrawings.filter((drawing) => selectedIds.has(drawing.id));
  }, [selectableDrawings, selectedMapItems]);

  const selectedDrawing = selectedDrawings.length === 1 ? selectedDrawings[0] : null;
  const normalizedSelectionBox = selectionBox ? normalizeSelectionRect(selectionBox) : null;

  useEffect(() => {
    onSelectedMapItemCountChange(selectedMapItems.length);
  }, [onSelectedMapItemCountChange, selectedMapItems.length]);

  useEffect(() => {
    const currentMap = map;

    if (selectedMapItems.length === 0 || !currentMap) {
      return;
    }

    const currentMapId = currentMap.id;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;

      if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target?.isContentEditable) {
        return;
      }

      event.preventDefault();
      const drawingIds = selectedMapItems.map((entry) => entry.slice("drawing:".length));

      void onDeleteDrawings(currentMapId, drawingIds);
      setSelectedMapItems([]);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [map, onDeleteDrawings, selectedMapItems]);

  const updateMapItemSelection = useCallback((key: SelectedMapItem, additive: boolean) => {
    setSelectedMapItems((current) => {
      if (!additive) {
        return [key];
      }

      return current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key];
    });
  }, []);

  const selectDrawingsInBox = useCallback(
    (selection: SelectionState) => {
      if (!map) {
        return false;
      }

      const rect = normalizeSelectionRect(selection);
      const dragged = rect.width >= selectionDragThreshold || rect.height >= selectionDragThreshold;

      if (!dragged) {
        return false;
      }

      const nextSelected = selectableDrawings
        .filter((drawing) => pathBoundsIntersectsRect(getDrawingRenderPoints(drawing).map(worldToScreen), rect))
        .map((drawing) => `drawing:${drawing.id}` satisfies SelectedMapItem);

      setSelectedMapItems((current) => (selection.additive ? Array.from(new Set([...current, ...nextSelected])) : nextSelected));

      return true;
    },
    [map, selectableDrawings, worldToScreen]
  );

  const resetSelection = useCallback(() => {
    setSelectedMapItems([]);
    setSelectionBox(null);
  }, []);

  return {
    selectedMapItems,
    setSelectedMapItems,
    selectionBox,
    setSelectionBox,
    normalizedSelectionBox,
    selectedDrawings,
    selectedDrawing,
    updateMapItemSelection,
    selectDrawingsInBox,
    resetSelection
  };
}
