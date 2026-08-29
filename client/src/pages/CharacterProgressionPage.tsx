import type { ActorSheet, CampaignSnapshot, MemberRole } from "@shared/types";
import { ArrowLeft, Sparkles } from "lucide-react";
import { memo, useDeferredValue, useEffect, useMemo } from "react";

import { RulesText } from "../components/admin/AdminPreview";
import { GuidedSheetModal } from "../features/sheet/components/GuidedSheetModal";
import { useGuidedSheetFlow } from "../features/sheet/hooks/useGuidedSheetFlow";
import { usePlayerNpcSheetController } from "../features/sheet/hooks/usePlayerNpcSheetController";
import { usePlayerNpcSheetDerived } from "../features/sheet/hooks/usePlayerNpcSheetDerived";
import type { SpellSelectionConfig } from "../features/sheet/playerNpcSheet2024Types";
import { SpellSelectionModal } from "../features/sheet/SpellSelectionModal";

export interface CharacterProgressionPageProps {
  token: string;
  actor: ActorSheet;
  compendium: CampaignSnapshot["compendium"];
  allowedSourceBooks: string[];
  role: MemberRole;
  currentUserId: string;
  onBack: () => void;
  onSave: (actor: ActorSheet) => Promise<void>;
  onRoll: (notation: string, label: string) => Promise<void>;
}

export function CharacterProgressionPageComponent({
  token,
  actor,
  compendium,
  allowedSourceBooks,
  role,
  currentUserId,
  onBack,
  onSave,
  onRoll
}: CharacterProgressionPageProps) {
  const controller = usePlayerNpcSheetController({
    token,
    actor,
    compendium,
    allowedSourceBooks,
    role,
    currentUserId,
    sheetContext: "campaign",
    onSave,
    onRoll
  });

  const { state, mutators, actions } = controller;
  const deferredDraft = useDeferredValue(state.draft);

  const { permissions, derived } = usePlayerNpcSheetDerived({
    draft: deferredDraft,
    compendium,
    role,
    currentUserId,
    sheetContext: "campaign",
    longRestPreparedSpells: state.longRestPreparedSpells
  });

  const guided = useGuidedSheetFlow({
    actor,
    draft: state.draft,
    compendium,
    filteredFeats: derived.filteredFeats,
    updateDraft: mutators.updateDraft,
    setActiveTab: actions.setActiveTab
  });

  // Ensure guided flow is initialized when page opens
  useEffect(() => {
    if (!guided.guidedFlowOpen) {
      guided.openGuidedFlow(permissions.needsInitialGuidedSetup ? "setup" : "levelup");
    }
  }, [guided, permissions.needsInitialGuidedSetup]);

  const renderRulesText = useMemo(
    () => (text: string) => (
      <RulesText
        text={text}
        spellEntries={compendium.spells}
        featEntries={compendium.feats}
        classEntries={compendium.classes}
        variantRuleEntries={compendium.variantRules}
        conditionEntries={compendium.conditions}
        itemEntries={compendium.items}
        optionalFeatureEntries={compendium.optionalFeatures}
        languageEntries={compendium.languages}
        skillEntries={compendium.skills}
        raceEntries={compendium.races}
        backgroundEntries={compendium.backgrounds}
        monsterEntries={[]}
      />
    ),
    [compendium]
  );

  const spellSelectionConfig = useMemo<SpellSelectionConfig | null>(() => {
    if (!state.spellSelectionTarget) {
      return null;
    }

    if (typeof state.spellSelectionTarget === "object") {
      const target = state.spellSelectionTarget;
      const group =
        target.owner === "class"
          ? guided.guidedChoiceSpec.classChoiceGroups.find((entry) => entry.id === target.groupId)
          : guided.guidedChoiceSpec.featChoiceGroups[target.ownerId]?.find((entry) => entry.id === target.groupId);
      if (!group) return null;
      const spells = compendium.spells.filter((spell) => group.options.some((option) => option.id === spell.id));
      const selectedSpellIds =
        target.owner === "class"
          ? (guided.guidedSetup.classChoiceIds[target.groupId] ?? [])
          : (guided.guidedSetup.featChoiceMap[target.ownerId]?.[target.groupId] ?? []);
      return {
        title: group.label,
        subtitle: `Choose exactly ${group.count} eligible spell${group.count === 1 ? "" : "s"}. Eligibility filters are fixed by the feature's JSON rules.`,
        spells,
        selectedSpellIds: selectedSpellIds.filter((id) => spells.some((spell) => spell.id === id)),
        maxSelections: group.count,
        lockEligibilityFilters: true,
        applyLabel: "Apply Spell Choice",
        onApply: (spellIds) =>
          guided.setGuidedSetup((current) =>
            target.owner === "class"
              ? {
                  ...current,
                  classChoiceIds: {
                    ...current.classChoiceIds,
                    [target.groupId]: spellIds.slice(0, group.count)
                  }
                }
              : {
                  ...current,
                  featChoiceMap: {
                    ...current.featChoiceMap,
                    [target.ownerId]: {
                      ...(current.featChoiceMap[target.ownerId] ?? {}),
                      [target.groupId]: spellIds.slice(0, group.count)
                    }
                  }
                }
          )
      };
    }

    switch (state.spellSelectionTarget) {
      case "guideCantrips":
        return {
          title: "Cantrip Selection",
          subtitle: "Choose the cantrips granted by your class progression.",
          spells: guided.guidedChoiceSpec.cantripOptions,
          selectedSpellIds: guided.guidedSetup.cantripIds.filter((entry) =>
            guided.guidedChoiceSpec.cantripOptions.some((spell) => spell.id === entry)
          ),
          maxSelections: guided.guidedChoiceSpec.cantripCount > 0 ? guided.guidedChoiceSpec.cantripCount : undefined,
          lockEligibilityFilters: true,
          applyLabel: "Apply Cantrips",
          onApply: (spellIds) =>
            guided.setGuidedSetup((current) => ({
              ...current,
              cantripIds: spellIds.slice(0, guided.guidedChoiceSpec.cantripCount)
            }))
        };
      case "guideKnown":
        return {
          title: guided.guidedChoiceSpec.knownSpellLabel ?? "Class Spells",
          subtitle: "Choose the spells known for your class progression.",
          spells: guided.guidedChoiceSpec.knownSpellOptions,
          selectedSpellIds: guided.guidedSetup.knownSpellIds.filter((entry) =>
            guided.guidedChoiceSpec.knownSpellOptions.some((spell) => spell.id === entry)
          ),
          maxSelections: guided.guidedChoiceSpec.knownSpellCount > 0 ? guided.guidedChoiceSpec.knownSpellCount : undefined,
          lockEligibilityFilters: true,
          applyLabel: "Apply Spells",
          onApply: (spellIds) =>
            guided.setGuidedSetup((current) => ({
              ...current,
              knownSpellIds: spellIds.slice(0, guided.guidedChoiceSpec.knownSpellCount)
            }))
        };
      case "guideSpellbook":
        return {
          title: "Spellbook Spells",
          subtitle: "Choose the spells to add to your spellbook upon leveling up.",
          spells: guided.guidedChoiceSpec.spellbookOptions,
          selectedSpellIds: guided.guidedSetup.spellbookSpellIds.filter((entry) =>
            guided.guidedChoiceSpec.spellbookOptions.some((spell) => spell.id === entry)
          ),
          maxSelections: guided.guidedChoiceSpec.spellbookCount > 0 ? guided.guidedChoiceSpec.spellbookCount : undefined,
          lockEligibilityFilters: true,
          applyLabel: "Apply Spellbook Spells",
          onApply: (spellIds) =>
            guided.setGuidedSetup((current) => ({
              ...current,
              spellbookSpellIds: spellIds.slice(0, guided.guidedChoiceSpec.spellbookCount)
            }))
        };
      case "guidePrepared":
        return {
          title: "Prepared Spells",
          subtitle: "Choose the spells you wish to prepare for this class.",
          spells: guided.guidedChoiceSpec.preparedSpellOptions,
          selectedSpellIds: guided.guidedSetup.preparedSpellIds.filter((entry) =>
            guided.guidedChoiceSpec.preparedSpellOptions.some((spell) => spell.id === entry)
          ),
          maxSelections: guided.guidedChoiceSpec.preparedSpellCount > 0 ? guided.guidedChoiceSpec.preparedSpellCount : undefined,
          lockEligibilityFilters: true,
          applyLabel: "Apply Prepared Spells",
          onApply: (spellIds) =>
            guided.setGuidedSetup((current) => ({
              ...current,
              preparedSpellIds: spellIds.slice(0, guided.guidedChoiceSpec.preparedSpellCount)
            }))
        };
      default:
        return null;
    }
  }, [compendium.spells, guided, state.spellSelectionTarget]);

  return (
    <div className="min-h-screen bg-slate-950 text-zinc-100 pb-16">
      {/* PROGRESSION HEADER */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-amber-500/20 bg-slate-950/90 px-4 py-3.5 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-amber-500/40 hover:bg-slate-800 hover:text-amber-100"
          >
            <ArrowLeft size={14} />
            <span>Cancel</span>
          </button>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            <h1 className="font-serif text-lg font-bold text-amber-50 truncate max-w-[200px] sm:max-w-xs">
              {state.draft.name}: {guided.guidedFlowMode === "setup" ? "Level 1 Setup" : "Level Up Guide"}
            </h1>
          </div>
        </div>
      </header>

      {/* EMBEDDED GUIDED PROGRESSION VIEW */}
      <main className="mx-auto max-w-4xl px-4 pt-6 sm:px-6 lg:px-8">
        <GuidedSheetModal
          draft={state.draft}
          compendium={compendium}
          guided={{
            ...guided,
            closeGuidedFlow: onBack,
            confirmGuidedSetup: () => {
              guided.confirmGuidedSetup();
              void actions.saveCurrent();
              onBack();
            },
            confirmGuidedLevelUp: () => {
              guided.confirmGuidedLevelUp();
              void actions.saveCurrent();
              onBack();
            }
          }}
          onOpenSpellSelection={actions.setSpellSelectionTarget}
          renderRulesText={renderRulesText}
          embedded={true}
          onCancel={onBack}
        />
      </main>

      {/* SPELL SELECTION MODAL */}
      {spellSelectionConfig ? (
        <SpellSelectionModal
          title={spellSelectionConfig.title}
          subtitle={spellSelectionConfig.subtitle}
          spells={spellSelectionConfig.spells}
          selectedSpellIds={spellSelectionConfig.selectedSpellIds}
          compendium={compendium}
          allowedSourceBooks={allowedSourceBooks}
          maxSelections={spellSelectionConfig.maxSelections}
          lockEligibilityFilters={spellSelectionConfig.lockEligibilityFilters}
          applyLabel={spellSelectionConfig.applyLabel}
          onApply={(spellIds) => {
            spellSelectionConfig.onApply(spellIds);
            actions.setSpellSelectionTarget(null);
          }}
          onClose={() => actions.setSpellSelectionTarget(null)}
        />
      ) : null}
    </div>
  );
}

export const CharacterProgressionPage = memo(CharacterProgressionPageComponent);
