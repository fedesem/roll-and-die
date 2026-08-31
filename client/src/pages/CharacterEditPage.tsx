import type { ActorSheet, CampaignSnapshot, MemberRole } from "@shared/types";
import { ArrowLeft, Check, RotateCcw, Save, Sparkles } from "lucide-react";
import { memo, useDeferredValue, useEffect, useMemo } from "react";

import { RulesText } from "../components/admin/AdminPreview";
import { GuidedSheetModal } from "../features/sheet/components/GuidedSheetModal";
import { PlayerNpcSheetEditTab } from "../features/sheet/components/PlayerNpcSheetEditTab";
import { SheetButton } from "../features/sheet/components/sheetPrimitives";
import { useGuidedSheetFlow } from "../features/sheet/hooks/useGuidedSheetFlow";
import { usePlayerNpcSheetController } from "../features/sheet/hooks/usePlayerNpcSheetController";
import { usePlayerNpcSheetDerived } from "../features/sheet/hooks/usePlayerNpcSheetDerived";
import type { SpellSelectionConfig } from "../features/sheet/playerNpcSheet2024Types";
import { SpellSelectionModal } from "../features/sheet/SpellSelectionModal";
import { findSpellIdsByNames, findSpellNamesByIds } from "../features/sheet/selectors/playerNpcSheet2024Selectors";
import { cloneActor } from "../features/sheet/sheetUtils";

export interface CharacterEditPageProps {
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

export function CharacterEditPageComponent({
  token,
  actor,
  compendium,
  allowedSourceBooks,
  role,
  currentUserId,
  onBack,
  onSave,
  onRoll
}: CharacterEditPageProps) {
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
  const deferredLongRestPreparedSpells = useDeferredValue(state.longRestPreparedSpells);

  const { permissions, derived } = usePlayerNpcSheetDerived({
    draft: deferredDraft,
    compendium,
    role,
    currentUserId,
    sheetContext: "campaign",
    longRestPreparedSpells: deferredLongRestPreparedSpells
  });

  const guided = useGuidedSheetFlow({
    actor,
    draft: state.draft,
    compendium,
    filteredFeats: derived.filteredFeats,
    updateDraft: mutators.updateDraft,
    setActiveTab: actions.setActiveTab
  });

  useEffect(() => {
    actions.setAutosavePaused(guided.guidedFlowOpen);
  }, [actions, guided.guidedFlowOpen]);

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
                  classChoiceIds: { ...current.classChoiceIds, [target.groupId]: spellIds.slice(0, group.count) }
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
      case "mainPrepared":
        return {
          title: "Prepare Spells",
          subtitle: "Choose the spells currently prepared on this sheet.",
          spells: derived.preparableSpellEntries,
          selectedSpellIds: findSpellIdsByNames(state.draft.preparedSpells, compendium.spells),
          maxSelections: derived.preparedSpellLimit > 0 ? derived.preparedSpellLimit : undefined,
          applyLabel: "Apply Prepared Spells",
          onApply: (spellIds) => mutators.updateField("preparedSpells", findSpellNamesByIds(spellIds, compendium.spells))
        };
      case "longRestPrepared":
        return {
          title: "Long Rest Preparation",
          subtitle: "Choose the spells this actor will prepare when the long rest completes.",
          spells: derived.preparableSpellEntries,
          selectedSpellIds: findSpellIdsByNames(state.longRestPreparedSpells, compendium.spells),
          maxSelections: derived.preparedSpellLimit > 0 ? derived.preparedSpellLimit : undefined,
          applyLabel: "Apply Rest Preparation",
          onApply: (spellIds) => actions.setLongRestPreparedSpells(findSpellNamesByIds(spellIds, compendium.spells))
        };
      case "editKnown":
        return {
          title: "Known Spells",
          subtitle: "Add or remove spells from the actor spell list.",
          spells: compendium.spells,
          selectedSpellIds: findSpellIdsByNames(state.draft.spells, compendium.spells),
          applyLabel: "Apply Known Spells",
          onApply: (spellIds) => mutators.updateField("spells", findSpellNamesByIds(spellIds, compendium.spells))
        };
      case "editPrepared":
        return {
          title: "Prepared Spells",
          subtitle: "Manage the actor's prepared spells directly from the edit tab.",
          spells: derived.preparableSpellEntries,
          selectedSpellIds: findSpellIdsByNames(state.draft.preparedSpells, compendium.spells),
          maxSelections: derived.preparedSpellLimit > 0 ? derived.preparedSpellLimit : undefined,
          applyLabel: "Apply Prepared Spells",
          onApply: (spellIds) => mutators.updateField("preparedSpells", findSpellNamesByIds(spellIds, compendium.spells))
        };
      case "editSpellbook":
        return {
          title: "Spellbook Spells",
          subtitle: "Manage the spellbook entries stored on this actor.",
          spells: compendium.spells,
          selectedSpellIds: findSpellIdsByNames(state.draft.spellState.spellbook, compendium.spells),
          applyLabel: "Apply Spellbook",
          onApply: (spellIds) =>
            mutators.updateField("spellState", { ...state.draft.spellState, spellbook: findSpellNamesByIds(spellIds, compendium.spells) })
        };
      case "editAlwaysPrepared":
        return {
          title: "Always Prepared Spells",
          subtitle: "Manage always-prepared spells granted directly on this actor.",
          spells: compendium.spells,
          selectedSpellIds: findSpellIdsByNames(state.draft.spellState.alwaysPrepared, compendium.spells),
          applyLabel: "Apply Always Prepared",
          onApply: (spellIds) =>
            mutators.updateField("spellState", {
              ...state.draft.spellState,
              alwaysPrepared: findSpellNamesByIds(spellIds, compendium.spells)
            })
        };
      case "editAtWill":
        return {
          title: "At-Will Spells",
          subtitle: "Manage spells that can be cast at will.",
          spells: compendium.spells,
          selectedSpellIds: findSpellIdsByNames(state.draft.spellState.atWill, compendium.spells),
          applyLabel: "Apply At-Will Spells",
          onApply: (spellIds) =>
            mutators.updateField("spellState", { ...state.draft.spellState, atWill: findSpellNamesByIds(spellIds, compendium.spells) })
        };
      case "editPerShortRest":
        return {
          title: "Short Rest Spells",
          subtitle: "Manage spells that refresh on a short rest.",
          spells: compendium.spells,
          selectedSpellIds: findSpellIdsByNames(state.draft.spellState.perShortRest, compendium.spells),
          applyLabel: "Apply Short Rest Spells",
          onApply: (spellIds) =>
            mutators.updateField("spellState", {
              ...state.draft.spellState,
              perShortRest: findSpellNamesByIds(spellIds, compendium.spells)
            })
        };
      case "editPerLongRest":
        return {
          title: "Long Rest Spells",
          subtitle: "Manage spells that refresh on a long rest.",
          spells: compendium.spells,
          selectedSpellIds: findSpellIdsByNames(state.draft.spellState.perLongRest, compendium.spells),
          applyLabel: "Apply Long Rest Spells",
          onApply: (spellIds) =>
            mutators.updateField("spellState", { ...state.draft.spellState, perLongRest: findSpellNamesByIds(spellIds, compendium.spells) })
        };
      case "guideCantrips":
        return {
          title: "Guide Cantrips",
          subtitle: "Choose the cantrips granted by this guide step.",
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
          subtitle: "Choose the class spells prepared by this guide step.",
          spells: guided.guidedChoiceSpec.knownSpellOptions,
          selectedSpellIds: guided.guidedSetup.knownSpellIds.filter((entry) =>
            guided.guidedChoiceSpec.knownSpellOptions.some((spell) => spell.id === entry)
          ),
          maxSelections: guided.guidedChoiceSpec.knownSpellCount > 0 ? guided.guidedChoiceSpec.knownSpellCount : undefined,
          lockEligibilityFilters: true,
          applyLabel: "Apply Known Spells",
          onApply: (spellIds) =>
            guided.setGuidedSetup((current) => ({
              ...current,
              knownSpellIds: spellIds.slice(0, guided.guidedChoiceSpec.knownSpellCount)
            }))
        };
      case "guideSpellbook":
        return {
          title: "Guide Spellbook",
          subtitle: "Choose the spellbook spells granted by this guide step.",
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
  }, [
    actions,
    compendium.spells,
    derived.preparableSpellEntries,
    derived.preparedSpellLimit,
    guided,
    mutators,
    state.draft,
    state.longRestPreparedSpells,
    state.spellSelectionTarget
  ]);

  const isDirty = useMemo(() => {
    return JSON.stringify(state.draft) !== JSON.stringify(actor);
  }, [actor, state.draft]);

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

  const totalLevel = state.draft.classes?.reduce((acc, c) => acc + (c.level || 0), 0) || 1;

  return (
    <div className="min-h-screen bg-slate-950 text-zinc-100 pb-16">
      {/* STICKY TOP ACTION BAR */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-amber-500/20 bg-slate-950/90 px-4 py-3.5 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-amber-500/40 hover:bg-slate-800 hover:text-amber-100"
          >
            <ArrowLeft size={14} />
            <span>Campaign</span>
          </button>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-center gap-2">
            <h1 className="font-serif text-lg font-bold text-amber-50 truncate max-w-[200px] sm:max-w-xs">{state.draft.name}</h1>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              Level {totalLevel}
            </span>
          </div>

          {isDirty ? (
            <span className="hidden sm:inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30">
              Unsaved Changes
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500">
              <Check size={12} className="text-emerald-400" />
              All saved
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {actor.kind === "character" ? (
            <SheetButton variant="magical" size="sm" icon={<Sparkles size={14} />} onClick={() => guided.openGuidedFlow("levelup")}>
              Level Up Wizard
            </SheetButton>
          ) : null}

          {isDirty ? (
            <SheetButton
              variant="secondary"
              size="sm"
              icon={<RotateCcw size={14} />}
              onClick={() => mutators.updateDraft(() => cloneActor(actor))}
            >
              Reset
            </SheetButton>
          ) : null}

          <SheetButton
            variant="primary"
            size="sm"
            icon={<Save size={14} />}
            disabled={state.saving || !isDirty}
            onClick={() => void actions.saveCurrent()}
          >
            {state.saving ? "Saving…" : "Save Changes"}
          </SheetButton>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <PlayerNpcSheetEditTab
          draft={state.draft}
          compendium={compendium}
          derived={{ ...derived, saving: state.saving, imageError: state.imageError }}
          permissions={permissions}
          mutators={mutators}
          actions={actions}
          guided={guided}
          renderRulesText={renderRulesText}
        />
      </main>

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
          onClose={() => actions.setSpellSelectionTarget(null)}
          onApply={(spellIds) => {
            spellSelectionConfig.onApply(spellIds);
            actions.setSpellSelectionTarget(null);
          }}
        />
      ) : null}

      <GuidedSheetModal
        draft={state.draft}
        compendium={compendium}
        guided={guided}
        onOpenSpellSelection={actions.setSpellSelectionTarget}
        renderRulesText={renderRulesText}
      />
    </div>
  );
}

export const CharacterEditPage = memo(CharacterEditPageComponent);
