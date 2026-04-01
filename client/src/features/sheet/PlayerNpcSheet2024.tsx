import { Clock3, Edit3, Moon } from "lucide-react";
import { useEffect, useMemo } from "react";

import { RulesText } from "../../components/admin/AdminPreview";
import { IconButton } from "../../components/IconButton";
import { useWorkspaceModalHeader } from "../../components/WorkspaceModal";
import { GuidedSheetModal } from "./components/GuidedSheetModal";
import { LongRestDialog } from "./components/LongRestDialog";
import { PlayerNpcSheetEditTab } from "./components/PlayerNpcSheetEditTab";
import { PlayerNpcSheetMainTab } from "./components/PlayerNpcSheetMainTab";
import { headerRestButtonClass, headerRestButtonInnerClass } from "./components/sheetPrimitives";
import { useGuidedSheetFlow } from "./hooks/useGuidedSheetFlow";
import { usePlayerNpcSheetController } from "./hooks/usePlayerNpcSheetController";
import { usePlayerNpcSheetDerived } from "./hooks/usePlayerNpcSheetDerived";
import type { PlayerNpcSheet2024Props, SpellSelectionConfig } from "./playerNpcSheet2024Types";
import {
  findSpellIdsByNames,
  findSpellNamesByIds
} from "./selectors/playerNpcSheet2024Selectors";
import { RestDialog } from "./RestDialog";
import { SpellSelectionModal } from "./SpellSelectionModal";
import { abilityModifierTotal } from "./sheetUtils";

export function PlayerNpcSheet2024(props: PlayerNpcSheet2024Props) {
  const { actor, compendium, allowedSourceBooks } = props;
  const controller = usePlayerNpcSheetController(props);
  const { state, mutators, actions } = controller;
  const { permissions, derived } = usePlayerNpcSheetDerived({
    draft: state.draft,
    compendium,
    role: props.role,
    currentUserId: props.currentUserId,
    sheetContext: props.sheetContext,
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

  useEffect(() => {
    actions.setAutosavePaused(guided.guidedFlowOpen);
  }, [actions, guided.guidedFlowOpen]);

  const showSetupGuideOnly = permissions.needsInitialGuidedSetup && guided.guidedFlowOpen && guided.guidedFlowMode === "setup";

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
      />
    ),
    [compendium]
  );

  const spellSelectionConfig = useMemo<SpellSelectionConfig | null>(() => {
    if (!state.spellSelectionTarget) {
      return null;
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
            mutators.updateField("spellState", { ...state.draft.spellState, alwaysPrepared: findSpellNamesByIds(spellIds, compendium.spells) })
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
            mutators.updateField("spellState", { ...state.draft.spellState, perShortRest: findSpellNamesByIds(spellIds, compendium.spells) })
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
          selectedSpellIds: guided.guidedSetup.cantripIds.filter((entry) => guided.guidedChoiceSpec.cantripOptions.some((spell) => spell.id === entry)),
          maxSelections: guided.guidedChoiceSpec.cantripCount > 0 ? guided.guidedChoiceSpec.cantripCount : undefined,
          applyLabel: "Apply Cantrips",
          onApply: (spellIds) =>
            guided.setGuidedSetup((current) => ({
              ...current,
              cantripIds: spellIds.slice(0, guided.guidedChoiceSpec.cantripCount)
            }))
        };
      case "guideKnown":
        return {
          title: "Guide Known Spells",
          subtitle: "Choose the spells learned from this guide step.",
          spells: guided.guidedChoiceSpec.knownSpellOptions,
          selectedSpellIds: guided.guidedSetup.knownSpellIds.filter((entry) => guided.guidedChoiceSpec.knownSpellOptions.some((spell) => spell.id === entry)),
          maxSelections: guided.guidedChoiceSpec.knownSpellCount > 0 ? guided.guidedChoiceSpec.knownSpellCount : undefined,
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
          selectedSpellIds: guided.guidedSetup.spellbookSpellIds.filter((entry) => guided.guidedChoiceSpec.spellbookOptions.some((spell) => spell.id === entry)),
          maxSelections: guided.guidedChoiceSpec.spellbookCount > 0 ? guided.guidedChoiceSpec.spellbookCount : undefined,
          applyLabel: "Apply Spellbook Spells",
          onApply: (spellIds) =>
            guided.setGuidedSetup((current) => ({
              ...current,
              spellbookSpellIds: spellIds.slice(0, guided.guidedChoiceSpec.spellbookCount)
            }))
        };
    }
  }, [actions, compendium.spells, derived.preparableSpellEntries, derived.preparedSpellLimit, guided, mutators, state.draft, state.longRestPreparedSpells, state.spellSelectionTarget]);

  useWorkspaceModalHeader(
    permissions.hasMainTab ? (
      <div className="flex flex-wrap items-center gap-1.5">
        <IconButton
          icon={<Edit3 size={12} />}
          label="Toggle edit mode"
          active={state.activeTab === "edit"}
          onClick={() => actions.setActiveTab(state.activeTab === "edit" ? "main" : "edit")}
          size="sm"
        />
        <button type="button" className={headerRestButtonClass} onClick={() => actions.startShortRest()} disabled={!permissions.mainTabInteractive} title="Short Rest" aria-label="Short Rest">
          <span className={headerRestButtonInnerClass}>
            <Clock3 size={10} />
            <span>SR</span>
          </span>
        </button>
        <button type="button" className={headerRestButtonClass} onClick={() => actions.startLongRest()} disabled={!permissions.mainTabInteractive} title="Long Rest" aria-label="Long Rest">
          <span className={headerRestButtonInnerClass}>
            <Moon size={10} />
            <span>LR</span>
          </span>
        </button>
        <div className="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-slate-900/90 p-0.5">
          {(["normal", "advantage", "disadvantage"] as const).map((mode) => (
            <label
              key={mode}
              className={`rounded-full px-2 py-[3px] text-[9px] font-medium uppercase tracking-[0.14em] transition ${
                permissions.mainTabInteractive ? "cursor-pointer" : "cursor-default opacity-50"
              } ${state.rollMode === mode ? "bg-slate-100 text-slate-950" : "text-slate-200 hover:bg-slate-800 hover:text-white"}`}
            >
              <input className="sr-only" type="radio" checked={state.rollMode === mode} disabled={!permissions.mainTabInteractive} onChange={() => actions.setRollMode(mode)} />
              {mode === "normal" ? "Normal" : mode === "advantage" ? "Adv" : "Dis"}
            </label>
          ))}
        </div>
      </div>
    ) : null
  );

  return (
    <section className="space-y-4 text-zinc-100">
      {!showSetupGuideOnly ? (
        <>
          {state.activeTab === "main" ? (
            <PlayerNpcSheetMainTab
              draft={state.draft}
              derived={derived}
              permissions={permissions}
              mutators={mutators}
              actions={actions}
              renderRulesText={renderRulesText}
            />
          ) : (
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
          )}
        </>
      ) : null}

      {state.shortRestOpen ? (
        <RestDialog
          classes={state.draft.classes}
          constitutionModifier={abilityModifierTotal(derived.actorWithDerivedNumbers, "con")}
          selections={state.hitDiceSelections}
          onChange={actions.changeHitDiceSelection}
          onCancel={actions.cancelShortRest}
          onConfirm={() => void actions.confirmShortRest()}
        />
      ) : null}

      {state.longRestOpen ? (
        <LongRestDialog
          canPrepareSpells={derived.canPrepareSpells}
          preparedSpellLimit={derived.preparedSpellLimit}
          preparableSpellCount={derived.spellCollections.preparable.length}
          longRestPreparedSpells={state.longRestPreparedSpells}
          hitPointDisplay={derived.hitPointDisplay}
          longRestPreparedSpellRows={derived.longRestPreparedSpellRows}
          onChooseSpells={() => actions.setSpellSelectionTarget("longRestPrepared")}
          onClose={actions.cancelLongRest}
          onConfirm={() => void actions.confirmLongRest()}
          renderText={renderRulesText}
        />
      ) : null}

      {spellSelectionConfig ? (
        <SpellSelectionModal
          title={spellSelectionConfig.title}
          subtitle={spellSelectionConfig.subtitle}
          spells={spellSelectionConfig.spells}
          selectedSpellIds={spellSelectionConfig.selectedSpellIds}
          compendium={compendium}
          allowedSourceBooks={allowedSourceBooks}
          maxSelections={spellSelectionConfig.maxSelections}
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
        filteredFeats={derived.filteredFeats}
        guided={guided}
        onOpenSpellSelection={actions.setSpellSelectionTarget}
        renderRulesText={renderRulesText}
      />
    </section>
  );
}
