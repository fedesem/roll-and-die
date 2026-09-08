import type { ProgressionChoiceGroupDef } from "@shared/data/progression";
import {
  activateProgressionChoiceConfiguration,
  evaluateActorActivationChoices,
  progressionConfigurationSelections
} from "@shared/rules/progressionEngine";
import type { ActorSheet } from "@shared/types";
import { useCallback, useState } from "react";

export function useProgressionActivationChoice(params: { draft: ActorSheet; saveCurrent: (nextDraft?: ActorSheet) => Promise<void> }) {
  const [group, setGroup] = useState<ProgressionChoiceGroupDef | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);

  const open = useCallback(
    (groupId: string) => {
      const nextGroup = evaluateActorActivationChoices(params.draft, groupId)[0] ?? null;
      setGroup(nextGroup);
      setSelectedOptionIds(nextGroup ? (progressionConfigurationSelections(params.draft, [nextGroup])[nextGroup.id] ?? []) : []);
      return Boolean(nextGroup);
    },
    [params.draft]
  );

  const close = useCallback(() => {
    setGroup(null);
    setSelectedOptionIds([]);
  }, []);

  const confirm = useCallback(async () => {
    if (!group || selectedOptionIds.length !== group.choose) return;
    const next = activateProgressionChoiceConfiguration(params.draft, group, selectedOptionIds);
    await params.saveCurrent(next);
    close();
  }, [close, group, params, selectedOptionIds]);

  return { group, selectedOptionIds, setSelectedOptionIds, open, close, confirm };
}
