import { useEffect, useMemo, useRef, type MutableRefObject } from "react";

import type { ActorSheet } from "@shared/types";

import { buildMainAutosaveState } from "../selectors/playerNpcSheet2024Selectors";

interface UsePlayerNpcSheetSyncParams {
  actor: ActorSheet;
  draft: ActorSheet;
  activeTab: "main" | "edit";
  canEdit: boolean;
  mainTabInteractive: boolean;
  sheetContext: "board" | "campaign";
  guidedFlowOpen: boolean;
  shortRestOpen: boolean;
  longRestOpen: boolean;
  saving: boolean;
  setDraft: (value: ActorSheet) => void;
  resetForActor: (actorSnapshot: ActorSheet) => void;
  saveCurrentRef: MutableRefObject<(nextDraft?: ActorSheet) => Promise<void>>;
}

export function usePlayerNpcSheetSync({
  actor,
  draft,
  activeTab,
  canEdit,
  mainTabInteractive,
  sheetContext,
  guidedFlowOpen,
  shortRestOpen,
  longRestOpen,
  saving,
  setDraft,
  resetForActor,
  saveCurrentRef
}: UsePlayerNpcSheetSyncParams) {
  const draftRef = useRef<ActorSheet>(draft);
  const actorSyncSignature = useMemo(() => JSON.stringify(actor), [actor]);
  const actorSnapshot = useMemo(() => JSON.parse(JSON.stringify(actor)) as ActorSheet, [actor]);
  const actorIdRef = useRef(actor.id);
  const lastActorSyncSignatureRef = useRef(actorSyncSignature);
  const lastMainAutosaveRef = useRef<string>(JSON.stringify(buildMainAutosaveState(actor)));
  const mainAutosaveSignature = useMemo(() => (activeTab === "main" ? JSON.stringify(buildMainAutosaveState(draft)) : ""), [activeTab, draft]);
  const actorMainAutosaveSignature = useMemo(() => (activeTab === "main" ? JSON.stringify(buildMainAutosaveState(actor)) : ""), [activeTab, actor]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const actorChanged = actorIdRef.current !== actorSnapshot.id;
    const actorContentChanged = lastActorSyncSignatureRef.current !== actorSyncSignature;
    actorIdRef.current = actorSnapshot.id;
    lastActorSyncSignatureRef.current = actorSyncSignature;

    if (!actorChanged && !actorContentChanged) {
      return;
    }

    if (actorChanged) {
      setDraft(actorSnapshot);
      draftRef.current = actorSnapshot;
      resetForActor(actorSnapshot);
      lastMainAutosaveRef.current = JSON.stringify(buildMainAutosaveState(actorSnapshot));
      return;
    }

    const incomingMainSignature = JSON.stringify(buildMainAutosaveState(actorSnapshot));
    const localMainSignature = JSON.stringify(buildMainAutosaveState(draftRef.current));

    if (sheetContext === "board" && activeTab === "main" && (incomingMainSignature === lastMainAutosaveRef.current || incomingMainSignature === localMainSignature)) {
      lastMainAutosaveRef.current = incomingMainSignature;
      return;
    }

    setDraft(actorSnapshot);
    draftRef.current = actorSnapshot;
    lastMainAutosaveRef.current = incomingMainSignature;
  }, [activeTab, actorSnapshot, actorSyncSignature, resetForActor, setDraft, sheetContext]);

  useEffect(() => {
    if (!canEdit || !mainTabInteractive || activeTab !== "main" || guidedFlowOpen || shortRestOpen || longRestOpen || saving) {
      return;
    }

    if (mainAutosaveSignature === actorMainAutosaveSignature || lastMainAutosaveRef.current === mainAutosaveSignature) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveCurrentRef.current(draft);
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    activeTab,
    actorMainAutosaveSignature,
    canEdit,
    draft,
    guidedFlowOpen,
    longRestOpen,
    mainAutosaveSignature,
    mainTabInteractive,
    saveCurrentRef,
    saving,
    shortRestOpen
  ]);

  return {
    draftRef,
    lastMainAutosaveRef,
    mainAutosaveSignature,
    actorMainAutosaveSignature
  };
}
