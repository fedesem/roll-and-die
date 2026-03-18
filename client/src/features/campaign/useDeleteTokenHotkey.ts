import { useEffect } from "react";

import type { ActorSheet, BoardToken, CampaignMap } from "@shared/types";

interface UseDeleteTokenHotkeyOptions {
  role: "dm" | "player";
  activeMap: CampaignMap | undefined;
  selectedActor: ActorSheet | null;
  tokens: BoardToken[];
  selectedBoardItemCount: number;
  onDeleteToken: (tokenId: string, label: string, skipPrompt?: boolean) => void;
}

export function useDeleteTokenHotkey({
  role,
  activeMap,
  selectedActor,
  tokens,
  selectedBoardItemCount,
  onDeleteToken
}: UseDeleteTokenHotkeyOptions) {
  useEffect(() => {
    if (role !== "dm" || !activeMap || !selectedActor) {
      return;
    }

    const token = tokens.find((entry) => entry.actorId === selectedActor.id && entry.mapId === activeMap.id);

    if (!token) {
      return;
    }

    const selectedToken = token;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;

      if (event.defaultPrevented || selectedBoardItemCount > 0) {
        return;
      }

      if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target?.isContentEditable) {
        return;
      }

      event.preventDefault();
      onDeleteToken(selectedToken.id, selectedToken.label, true);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMap, onDeleteToken, role, selectedActor, selectedBoardItemCount, tokens]);
}
