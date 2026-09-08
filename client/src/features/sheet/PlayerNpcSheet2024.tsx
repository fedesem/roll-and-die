import { stagePreparedSpellConfiguration, stageSpellChoiceConfiguration } from "@shared/rules/progressionEngine";
import { Clock3, Moon } from "lucide-react";
import { memo, useDeferredValue, useEffect, useMemo } from "react";

import { RulesText } from "../../components/compendium";
import { useWorkspaceModalHeader } from "../../components/WorkspaceModal";
import { ActivationChoiceDialog } from "./components/ActivationChoiceDialog";
import { GuidedSheetModal } from "./components/GuidedSheetModal";
import { LongRestDialog } from "./components/LongRestDialog";
import { PlayerNpcSheetEditTab } from "./components/PlayerNpcSheetEditTab";
import { PlayerNpcSheetMainTab } from "./components/PlayerNpcSheetMainTab";
import { useGuidedSheetFlow } from "./hooks/useGuidedSheetFlow";
import { usePlayerNpcSheetController } from "./hooks/usePlayerNpcSheetController";
import { usePlayerNpcSheetDerived } from "./hooks/usePlayerNpcSheetDerived";
import type { PlayerNpcSheet2024Props, SpellSelectionConfig } from "./playerNpcSheet2024Types";
import { RestDialog } from "./RestDialog";
import { SpellSelectionModal } from "./SpellSelectionModal";
import { findSpellIdsByNames, findSpellNamesByIds } from "./selectors/playerNpcSheet2024Selectors";
import { abilityModifierTotal } from "./sheetUtils";

function PlayerNpcSheet2024Component(props: PlayerNpcSheet2024Props) {
  const { actor, compendium, allowedSourceBooks } = props;
  const controller = usePlayerNpcSheetController(props);
  const { state, mutators, actions } = controller;
  const deferredDraft = useDeferredValue(state.draft);
  const { permissions, derived } = usePlayerNpcSheetDerived({
    draft: deferredDraft,
    compendium,
    role: props.role,
    currentUserId: props.currentUserId,
    sheetContext: props.sheetContext
  });
  const guided = useGuidedSheetFlow({
    actor,
    draft: state.draft,
    compendium,
    filteredFeats: derived.filteredFeats,
    updateDraft: mutators.updateDraft,
    setActiveTab: actions.setActiveTab
  });

  const { setAutosavePaused } = actions;

  useEffect(() => {
    setAutosavePaused(guided.guidedFlowOpen);
  }, [guided.guidedFlowOpen, setAutosavePaused]);

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
      if (target.kind === "restPrepared") {
        const preparation = derived.restPreparedSpellGroups.find((entry) => entry.actorClassId === target.actorClassId);
        if (!preparation) return null;
        return {
          title: `${preparation.className} Rest Preparation`,
          subtitle: "Stage this class's prepared spells. The change takes effect when the next Long Rest completes.",
          spells: preparation.options,
          selectedSpellIds: preparation.selectedIds,
          maxSelections: preparation.limit,
          lockEligibilityFilters: true,
          applyLabel: "Stage Rest Preparation",
          validateSelection: (spellIds) => {
            if (spellIds.length !== preparation.limit) {
              return `Choose exactly ${preparation.limit} spell${preparation.limit === 1 ? "" : "s"} for this class.`;
            }
            if (preparation.replacementLimit === "all" || preparation.activeIds.length === 0) return null;
            const selected = new Set(spellIds);
            const replaced = preparation.activeIds.filter((id) => !selected.has(id)).length;
            return replaced > preparation.replacementLimit
              ? `This class can replace only ${preparation.replacementLimit} prepared spell${preparation.replacementLimit === 1 ? "" : "s"} per Long Rest.`
              : null;
          },
          onApply: (spellIds) =>
            mutators.updateDraft((current) =>
              stagePreparedSpellConfiguration(current, {
                ownerRef: preparation.ownerRef,
                ownerInstanceId: preparation.actorClassId,
                expectedCount: preparation.limit,
                spells: spellIds
                  .slice(0, preparation.limit)
                  .map((id) => compendium.spells.find((spell) => spell.id === id))
                  .filter((spell): spell is (typeof compendium.spells)[number] => Boolean(spell)),
                replacementLimit: preparation.replacementLimit
              })
            )
        };
      }
      if (target.kind === "restSpellChoice") {
        const group = derived.restSpellChoiceGroups.find(
          (entry) => entry.actorClassId === target.actorClassId && entry.groupId === target.groupId
        );
        if (!group) return null;
        return {
          title: group.title,
          subtitle: `Stage this selection. It takes effect after the next ${group.trigger === "shortOrLongRest" ? "Short or Long" : "Long"} Rest.`,
          spells: group.options,
          selectedSpellIds: group.selectedIds,
          maxSelections: group.count,
          lockEligibilityFilters: true,
          applyLabel: "Stage Spell Choice",
          validateSelection: (spellIds) =>
            spellIds.length === group.count ? null : `Choose exactly ${group.count} spell${group.count === 1 ? "" : "s"}.`,
          onApply: (spellIds) =>
            mutators.updateDraft((current) =>
              stageSpellChoiceConfiguration(current, {
                ownerRef: group.ownerRef,
                ownerInstanceId: group.actorClassId,
                groupId: group.groupId,
                trigger: group.trigger,
                expectedCount: group.count,
                bucket: group.bucket,
                spells: spellIds.flatMap((spellId) => {
                  const spell = compendium.spells.find((entry) => entry.id === spellId);
                  return spell ? [{ id: spell.id, name: spell.name, source: spell.source }] : [];
                })
              })
            )
        };
      }
      const group =
        target.owner === "class"
          ? guided.guidedChoiceSpec.classChoiceGroups?.find((entry) => entry.id === target.groupId)
          : guided.guidedChoiceSpec.featChoiceGroups?.[target.ownerId]?.find((entry) => entry.id === target.groupId);
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
    }
  }, [
    actions,
    compendium.spells,
    derived.preparableSpellEntries,
    derived.preparedSpellLimit,
    derived.restPreparedSpellGroups,
    derived.restSpellChoiceGroups,
    guided,
    mutators,
    state.draft,
    state.spellSelectionTarget
  ]);

  useWorkspaceModalHeader(
    permissions.hasMainTab ? (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-slate-900/90 px-2 py-1 text-xs font-semibold text-zinc-300 transition hover:border-amber-500/40 hover:bg-slate-800 hover:text-amber-100 disabled:opacity-50"
          onClick={() => actions.startShortRest()}
          disabled={!permissions.mainTabInteractive}
          title="Short Rest"
          aria-label="Short Rest"
        >
          <Clock3 size={12} className="text-amber-400" />
          <span>SR</span>
        </button>

        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-slate-900/90 px-2 py-1 text-xs font-semibold text-zinc-300 transition hover:border-indigo-400/40 hover:bg-slate-800 hover:text-indigo-200 disabled:opacity-50"
          onClick={() => actions.startLongRest()}
          disabled={!permissions.mainTabInteractive}
          title="Long Rest"
          aria-label="Long Rest"
        >
          <Moon size={12} className="text-indigo-400" />
          <span>LR</span>
        </button>

        <div className="inline-flex items-center gap-0.5 rounded-lg border border-white/10 bg-slate-900/90 p-0.5">
          {(["normal", "advantage", "disadvantage"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition ${
                state.rollMode === mode
                  ? mode === "advantage"
                    ? "border border-emerald-500/40 bg-emerald-500/25 text-emerald-200"
                    : mode === "disadvantage"
                      ? "border border-rose-500/40 bg-rose-500/25 text-rose-200"
                      : "border border-white/15 bg-slate-800 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              disabled={!permissions.mainTabInteractive}
              onClick={() => actions.setRollMode(mode)}
            >
              {mode === "normal" ? "Norm" : mode === "advantage" ? "Adv" : "Dis"}
            </button>
          ))}
        </div>
      </div>
    ) : null
  );

  return (
    <section className="space-y-4 text-zinc-100">
      {!showSetupGuideOnly ? (
        state.activeTab === "main" ? (
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
        )
      ) : null}

      {state.shortRestOpen ? (
        <RestDialog
          classes={state.draft.classes}
          constitutionModifier={abilityModifierTotal(derived.actorWithDerivedNumbers, "con")}
          selections={state.hitDiceSelections}
          shortRestChoices={derived.shortRestChoices}
          shortRestChoiceSelections={state.shortRestChoiceSelections}
          onChangeChoice={actions.changeShortRestChoiceSelection}
          onChange={actions.changeHitDiceSelection}
          onCancel={actions.cancelShortRest}
          onConfirm={() => void actions.confirmShortRest()}
        />
      ) : null}

      {state.longRestOpen ? (
        <LongRestDialog
          longRestChoices={derived.longRestChoices}
          longRestChoiceSelections={state.longRestChoiceSelections}
          onChangeChoice={actions.changeLongRestChoiceSelection}
          hitPointDisplay={derived.hitPointDisplay}
          onClose={actions.cancelLongRest}
          onConfirm={() => void actions.confirmLongRest()}
        />
      ) : null}

      {state.activationChoiceGroup ? (
        <ActivationChoiceDialog
          group={state.activationChoiceGroup}
          selectedOptionIds={state.activationChoiceSelections}
          onChange={actions.changeActivationChoice}
          onCancel={actions.cancelActivationChoice}
          onConfirm={() => void actions.confirmActivationChoice()}
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
          lockEligibilityFilters={spellSelectionConfig.lockEligibilityFilters}
          applyLabel={spellSelectionConfig.applyLabel}
          validateSelection={spellSelectionConfig.validateSelection}
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
    </section>
  );
}

export const PlayerNpcSheet2024 = memo(PlayerNpcSheet2024Component);
