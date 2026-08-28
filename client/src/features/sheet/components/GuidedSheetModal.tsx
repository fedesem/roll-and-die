import { Plus, X } from "lucide-react";
import type { ReactNode } from "react";

import type { AbilityKey, ActorSheet, CompendiumChoiceGroup, CompendiumChoiceOption } from "@shared/types";
import {
  findBackgroundProgression,
  findClassProgression,
  findFeatProgression,
  findSpeciesProgression,
  findSubclassesForClass
} from "@shared/data/progression";
import { ClassPreviewCard, ReferencePreviewCard } from "../../../components/admin/AdminPreview";
import { ModalFrame } from "../../../components/ModalFrame";
import { NumericInput } from "../../../components/NumericInput";
import type { GuidedSheetFlowState } from "../hooks/useGuidedSheetFlow";
import {
  collectSpellRows,
  createReferenceRow,
  findSpellNamesByIds,
  guideOptionDisabled,
  replaceGuideSelection
} from "../selectors/playerNpcSheet2024Selectors";
import { abilityModifier, abilityOrder, findCompendiumClass, formatModifier } from "../sheetUtils";
import { NEW_GUIDED_CLASS_ID, type SheetCompendium } from "../playerNpcSheet2024Types";
import { DetailCollection, Field, HoverPreviewTrigger, inputClass, secondaryButtonClass } from "./sheetPrimitives";

interface GuidedSheetModalProps {
  draft: ActorSheet;
  compendium: SheetCompendium;
  guided: GuidedSheetFlowState;
  onOpenSpellSelection: (target: "guideCantrips" | "guideKnown" | "guideSpellbook" | "guidePrepared") => void;
  renderRulesText: (text: string) => ReactNode;
}

export function GuidedSheetModal({ draft, compendium, guided, onOpenSpellSelection, renderRulesText }: GuidedSheetModalProps) {
  if (!guided.guidedFlowOpen) {
    return null;
  }

  const previewLookupProps = {
    spellEntries: compendium.spells,
    featEntries: compendium.feats,
    classEntries: compendium.classes,
    variantRuleEntries: compendium.variantRules,
    conditionEntries: compendium.conditions
  };

  return (
    <ModalFrame
      onClose={guided.closeGuidedFlow}
      backdropClassName="bg-black/60"
      panelClassName="max-w-3xl border-white/10 bg-slate-950"
      closeOnBackdrop={false}
    >
      <>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-amber-400/80">Build Guide</p>
            <h3 className="mt-2 font-serif text-2xl text-amber-50">
              {guided.guidedFlowMode === "setup" ? "Level 1 Setup" : "Level Up Guide"}
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              {guided.guidedFlowMode === "setup"
                ? "Choose the species, background, class, and starting choices here. The guide applies all supported build choices from this popup."
                : "Choose which class gains a level. HP is rolled from the class hit die plus Constitution, and newly unlocked features are added."}
            </p>
          </div>
          <button type="button" className={secondaryButtonClass} onClick={guided.closeGuidedFlow}>
            <X size={14} />
            Close
          </button>
        </div>
        {guided.guideError ? (
          <p className="mx-5 mt-4 border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{guided.guideError}</p>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <div className="space-y-4">
            {guided.guidedFlowMode === "setup" ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Species">
                    <div className="space-y-2">
                      <select
                        className={inputClass}
                        value={guided.guidedSetup.speciesId}
                        onChange={(event) => {
                          guided.setGuidedSetup((current) => ({
                            ...current,
                            speciesId: event.target.value,
                            speciesSkillChoices: [],
                            speciesOriginFeatId: "",
                            speciesChoiceIds: {}
                          }));
                        }}
                      >
                        <option value="">Select a species</option>
                        {compendium.races.map((entry) => (
                          <option
                            key={entry.id}
                            value={entry.id}
                            disabled={!findSpeciesProgression(entry.id) && !findSpeciesProgression(entry.name)}
                          >
                            {entry.name}
                            {!findSpeciesProgression(entry.id) && !findSpeciesProgression(entry.name)
                              ? " (rules metadata unavailable)"
                              : ""}
                          </option>
                        ))}
                      </select>
                      <HoverPreviewTrigger
                        label="Species Preview"
                        caption={
                          guided.guidedSelectedSpecies
                            ? [
                                guided.guidedSelectedSpecies.category,
                                `${guided.guidedSelectedSpecies.speed} ft`,
                                guided.guidedSelectedSpecies.darkvision > 0
                                  ? `Darkvision ${guided.guidedSelectedSpecies.darkvision} ft`
                                  : null
                              ]
                                .filter(Boolean)
                                .join(" • ")
                            : undefined
                        }
                        emptyMessage="Select a species to preview it."
                        preview={
                          guided.guidedSelectedSpecies ? (
                            <ReferencePreviewCard
                              title="Species"
                              eyebrow="Species"
                              entry={guided.guidedSelectedSpecies}
                              {...previewLookupProps}
                            />
                          ) : null
                        }
                      />
                    </div>
                  </Field>
                  <Field label="Background">
                    <div className="space-y-2">
                      <select
                        className={inputClass}
                        value={guided.guidedSetup.backgroundId}
                        onChange={(event) => {
                          guided.setGuidedSetup((current) => ({
                            ...current,
                            backgroundId: event.target.value,
                            backgroundAbilityModeId: "",
                            backgroundSkillChoices: [],
                            originFeatId: "",
                            equipmentChoiceIds: {},
                            abilityChoices: []
                          }));
                        }}
                      >
                        <option value="">Select a background</option>
                        {compendium.backgrounds.map((entry) => (
                          <option
                            key={entry.id}
                            value={entry.id}
                            disabled={!findBackgroundProgression(entry.id) && !findBackgroundProgression(entry.name)}
                          >
                            {entry.name}
                            {!findBackgroundProgression(entry.id) && !findBackgroundProgression(entry.name)
                              ? " (rules metadata unavailable)"
                              : ""}
                          </option>
                        ))}
                      </select>
                      <HoverPreviewTrigger
                        label="Background Preview"
                        caption={
                          guided.guidedSelectedBackground
                            ? [
                                guided.guidedSelectedBackground.category,
                                guided.guidedSelectedBackground.skillProficiencies.length > 0
                                  ? `Skills: ${guided.guidedSelectedBackground.skillProficiencies.join(", ")}`
                                  : null,
                                guided.guidedSelectedBackground.featIds.length > 0
                                  ? `Feats: ${guided.guidedSelectedBackground.featIds.join(", ")}`
                                  : null
                              ]
                                .filter(Boolean)
                                .join(" • ")
                            : undefined
                        }
                        emptyMessage="Select a background to preview it."
                        preview={
                          guided.guidedSelectedBackground ? (
                            <ReferencePreviewCard
                              title="Background"
                              eyebrow="Background"
                              entry={guided.guidedSelectedBackground}
                              {...previewLookupProps}
                            />
                          ) : null
                        }
                      />
                    </div>
                  </Field>
                  <Field label="Class">
                    <div className="space-y-2">
                      <select
                        className={inputClass}
                        value={guided.guidedSetup.classId}
                        onChange={(event) =>
                          guided.setGuidedSetup((current) => ({
                            ...current,
                            classId: event.target.value,
                            classSkillChoices: [],
                            expertiseSkillChoices: [],
                            subclassId: ""
                          }))
                        }
                      >
                        <option value="">Select a class</option>
                        {compendium.classes.map((entry) => (
                          <option
                            key={entry.id}
                            value={entry.id}
                            disabled={!findClassProgression(entry.id) && !findClassProgression(entry.name)}
                          >
                            {entry.name}
                            {!findClassProgression(entry.id) && !findClassProgression(entry.name) ? " (rules metadata unavailable)" : ""}
                          </option>
                        ))}
                      </select>
                      <HoverPreviewTrigger
                        label="Class Preview"
                        caption={
                          guided.guidedSelectedClass
                            ? [
                                `d${guided.guidedSelectedClass.hitDieFaces} Hit Die`,
                                guided.guidedSelectedClass.primaryAbilities.length > 0
                                  ? `Primary: ${guided.guidedSelectedClass.primaryAbilities.join(" or ")}`
                                  : null,
                                guided.guidedSelectedClass.savingThrowProficiencies.length > 0
                                  ? `Saves: ${guided.guidedSelectedClass.savingThrowProficiencies.join(", ")}`
                                  : null
                              ]
                                .filter(Boolean)
                                .join(" • ")
                            : undefined
                        }
                        emptyMessage="Select a class to preview it."
                        preview={
                          guided.guidedSelectedClass ? (
                            <ClassPreviewCard entry={guided.guidedSelectedClass} {...previewLookupProps} />
                          ) : null
                        }
                      />
                    </div>
                  </Field>
                </div>

                {guided.guidedSpeciesChoiceGroups.length > 0 ? (
                  <div className="space-y-3 border border-white/8 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">Species Choices</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {guided.guidedSpeciesChoiceGroups.map((group) => {
                        const selectedOption =
                          group.options.find((option) => option.id === guided.guidedSetup.speciesChoiceIds[group.id]) ?? null;

                        return (
                          <Field key={group.id} label={group.label} hint={group.hint}>
                            <div className="space-y-2">
                              <select
                                className={inputClass}
                                value={guided.guidedSetup.speciesChoiceIds[group.id] ?? ""}
                                onChange={(event) =>
                                  guided.setGuidedSetup((current) => ({
                                    ...current,
                                    speciesChoiceIds: {
                                      ...current.speciesChoiceIds,
                                      [group.id]: event.target.value
                                    }
                                  }))
                                }
                              >
                                {group.options.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              {selectedOption?.description ? (
                                <p className="text-xs leading-5 text-zinc-400">{selectedOption.description}</p>
                              ) : null}
                            </div>
                          </Field>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3 border border-white/8 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">Base Ability Scores</p>
                      <p className="mt-1 text-sm text-zinc-400">
                        Set the starting scores here. Background ability choices are added on top of these values.
                      </p>
                    </div>
                    {guided.guidedAbilityChoiceSlots.length > 0 ? (
                      <p className="max-w-[16rem] text-right text-xs text-zinc-500">
                        Background spread: {guided.guidedAbilityChoiceMode?.label ?? "None"}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {abilityOrder.map((ability) => {
                      const baseScore = guided.guidedSetup.baseAbilities[ability.key];
                      const guidedBonus = guided.guidedAbilityChoiceSlots.reduce(
                        (sum, slot, index) => sum + (guided.guidedSetup.abilityChoices[index] === ability.key ? slot.amount : 0),
                        0
                      );
                      const finalScore = baseScore + guidedBonus;

                      return (
                        <div key={ability.key} className="space-y-3 border border-amber-900/20 bg-zinc-900/60 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium tracking-[0.18em] text-amber-50">{ability.label}</p>
                              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                                Final {finalScore} ({formatModifier(abilityModifier(finalScore))})
                              </p>
                            </div>
                            {guidedBonus > 0 ? <p className="text-xs text-amber-300/80">+{guidedBonus} background</p> : null}
                          </div>
                          <Field label="Base Score">
                            <NumericInput
                              className={inputClass}
                              min={1}
                              max={20}
                              value={baseScore}
                              emptyValue={10}
                              onValueChange={(value) =>
                                guided.setGuidedSetup((current) => ({
                                  ...current,
                                  baseAbilities: {
                                    ...current.baseAbilities,
                                    [ability.key]: value ?? 10
                                  }
                                }))
                              }
                            />
                          </Field>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {guided.guidedSpeciesSkillChoiceConfig.count > 0 || guided.guidedSpeciesOriginFeatOptions.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {guided.guidedSpeciesSkillChoiceConfig.count > 0
                      ? Array.from({ length: guided.guidedSpeciesSkillChoiceConfig.count }, (_, index) => (
                          <Field key={`species-skill-${index}`} label={`Species Skill ${index + 1}`}>
                            <select
                              className={inputClass}
                              value={guided.guidedSetup.speciesSkillChoices[index] ?? ""}
                              onChange={(event) =>
                                guided.setGuidedSetup((current) => ({
                                  ...current,
                                  speciesSkillChoices: replaceGuideSelection(current.speciesSkillChoices, index, event.target.value)
                                }))
                              }
                            >
                              {guided.guidedSpeciesSkillChoiceConfig.options.map((entry) => (
                                <option
                                  key={entry.id}
                                  value={entry.name}
                                  disabled={guideOptionDisabled(guided.guidedSetup.speciesSkillChoices, index, entry.name)}
                                >
                                  {entry.name}
                                </option>
                              ))}
                            </select>
                          </Field>
                        ))
                      : null}
                    {guided.guidedSpeciesOriginFeatOptions.length > 0 ? (
                      <Field label="Species Feat Choice">
                        <select
                          className={inputClass}
                          value={guided.guidedSetup.speciesOriginFeatId}
                          onChange={(event) =>
                            guided.setGuidedSetup((current) => ({ ...current, speciesOriginFeatId: event.target.value }))
                          }
                        >
                          {guided.guidedSpeciesOriginFeatOptions.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : null}
                  </div>
                ) : null}

                {guided.guidedChoiceSpec.sizeOptions.length > 1 ? (
                  <Field label="Species Size">
                    <select
                      className={inputClass}
                      value={guided.guidedSetup.speciesSizeChoice || guided.guidedChoiceSpec.sizeOptions[0]}
                      onChange={(event) =>
                        guided.setGuidedSetup((current) => ({
                          ...current,
                          speciesSizeChoice: event.target.value as "Medium" | "Small"
                        }))
                      }
                    >
                      {guided.guidedChoiceSpec.sizeOptions.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}

                <div className="space-y-3 border border-white/8 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">Languages</p>
                  <p className="text-xs text-zinc-400">Common + choose up to 2 additional languages.</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {Array.from({ length: 2 }, (_, index) => (
                      <Field key={`lang-${index}`} label={`Language Choice ${index + 1}`}>
                        <select
                          className={inputClass}
                          value={guided.guidedSetup.languageChoices[index + 1] ?? ""}
                          onChange={(event) =>
                            guided.setGuidedSetup((current) => {
                              const nextLangs = [...(current.languageChoices.length > 0 ? current.languageChoices : ["Common"])];
                              nextLangs[index + 1] = event.target.value;
                              return {
                                ...current,
                                languageChoices: nextLangs.filter(Boolean)
                              };
                            })
                          }
                        >
                          <option value="">Choose a language</option>
                          {guided.guidedChoiceSpec.languageOptions
                            .filter((lang) => lang !== "Common")
                            .map((lang) => (
                              <option key={lang} value={lang}>
                                {lang}
                              </option>
                            ))}
                        </select>
                      </Field>
                    ))}
                  </div>
                </div>

                {guided.guidedBackgroundSkillChoiceConfig.count > 0 ? (
                  <div className="space-y-3 border border-white/8 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">Background Skill Choices</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {Array.from({ length: guided.guidedBackgroundSkillChoiceConfig.count }, (_, index) => (
                        <Field key={`background-skill-${index}`} label={`Background Skill ${index + 1}`}>
                          <select
                            className={inputClass}
                            value={guided.guidedSetup.backgroundSkillChoices[index] ?? ""}
                            onChange={(event) =>
                              guided.setGuidedSetup((current) => ({
                                ...current,
                                backgroundSkillChoices: replaceGuideSelection(current.backgroundSkillChoices, index, event.target.value)
                              }))
                            }
                          >
                            {guided.guidedBackgroundSkillChoiceConfig.options.map((entry) => (
                              <option
                                key={entry.id}
                                value={entry.name}
                                disabled={guideOptionDisabled(guided.guidedSetup.backgroundSkillChoices, index, entry.name)}
                              >
                                {entry.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ))}
                    </div>
                  </div>
                ) : null}

                {guided.guidedAbilityChoiceConfig.modes.length > 0 ? (
                  <div className="space-y-3 border border-white/8 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">Ability Choices</p>
                    {guided.guidedAbilityChoiceConfig.modes.length > 1 ? (
                      <Field label="Background Ability Spread">
                        <select
                          className={inputClass}
                          value={guided.guidedSetup.backgroundAbilityModeId}
                          onChange={(event) =>
                            guided.setGuidedSetup((current) => ({
                              ...current,
                              backgroundAbilityModeId: event.target.value,
                              abilityChoices: []
                            }))
                          }
                        >
                          {guided.guidedAbilityChoiceConfig.modes.map((mode) => (
                            <option key={mode.id} value={mode.id}>
                              {mode.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : null}
                    <div className="grid gap-3 md:grid-cols-2">
                      {guided.guidedAbilityChoiceSlots.map((slot, index) => (
                        <Field key={slot.id} label={`+${slot.amount} Ability ${index + 1}`}>
                          <select
                            className={inputClass}
                            value={guided.guidedSetup.abilityChoices[index] ?? ""}
                            onChange={(event) =>
                              guided.setGuidedSetup((current) => ({
                                ...current,
                                abilityChoices: replaceGuideSelection(current.abilityChoices, index, event.target.value as AbilityKey)
                              }))
                            }
                          >
                            <option value="">Select an ability</option>
                            {slot.abilities.map((abilityKey) => (
                              <option
                                key={abilityKey}
                                value={abilityKey}
                                disabled={guideOptionDisabled(guided.guidedSetup.abilityChoices, index, abilityKey)}
                              >
                                {abilityKey.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ))}
                    </div>
                  </div>
                ) : null}

                {guided.guidedOriginFeatOptions.length > 0 ? (
                  <Field label="Origin Feat">
                    <select
                      className={inputClass}
                      value={guided.guidedSetup.originFeatId}
                      onChange={(event) => guided.setGuidedSetup((current) => ({ ...current, originFeatId: event.target.value }))}
                    >
                      {guided.guidedOriginFeatOptions.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}

                {guided.guidedEquipmentGroups.length > 0 ? (
                  <div className="space-y-3 border border-white/8 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">Starting Equipment</p>
                    {guided.guidedEquipmentGroups.map((group) => (
                      <Field key={group.id} label={group.label}>
                        <select
                          className={inputClass}
                          value={guided.guidedSetup.equipmentChoiceIds[group.id] ?? ""}
                          onChange={(event) =>
                            guided.setGuidedSetup((current) => ({
                              ...current,
                              equipmentChoiceIds: {
                                ...current.equipmentChoiceIds,
                                [group.id]: event.target.value
                              }
                            }))
                          }
                        >
                          {group.options.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ))}
                  </div>
                ) : null}

                {guided.guidedClassSkillChoiceConfig.count > 0 ? (
                  <div className="space-y-3 border border-white/8 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">Class Skill Choices</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {Array.from({ length: guided.guidedClassSkillChoiceConfig.count }, (_, index) => (
                        <Field key={`class-skill-${index}`} label={`Class Skill ${index + 1}`}>
                          <select
                            className={inputClass}
                            value={guided.guidedSetup.classSkillChoices[index] ?? ""}
                            onChange={(event) =>
                              guided.setGuidedSetup((current) => ({
                                ...current,
                                classSkillChoices: replaceGuideSelection(current.classSkillChoices, index, event.target.value)
                              }))
                            }
                          >
                            {guided.guidedClassSkillChoiceConfig.options.map((entry) => (
                              <option
                                key={entry.id}
                                value={entry.name}
                                disabled={guideOptionDisabled(guided.guidedSetup.classSkillChoices, index, entry.name)}
                              >
                                {entry.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Level Up Class">
                    <select
                      className={inputClass}
                      value={guided.guidedClassId}
                      onChange={(event) => guided.setGuidedClassId(event.target.value)}
                    >
                      <option value={NEW_GUIDED_CLASS_ID}>Add a new class</option>
                      {draft.classes.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name} (Level {entry.level} ➔ {entry.level + 1})
                        </option>
                      ))}
                    </select>
                  </Field>
                  {guided.guidedClassId === NEW_GUIDED_CLASS_ID ? (
                    <Field label="New Class">
                      <select
                        className={inputClass}
                        value={guided.guidedSetup.classId}
                        onChange={(event) => guided.setGuidedSetup((current) => ({ ...current, classId: event.target.value }))}
                      >
                        <option value="">Select a class</option>
                        {compendium.classes.map((entry) => (
                          <option
                            key={entry.id}
                            value={entry.id}
                            disabled={!findClassProgression(entry.id) && !findClassProgression(entry.name)}
                          >
                            {entry.name}
                            {!findClassProgression(entry.id) && !findClassProgression(entry.name) ? " (rules metadata unavailable)" : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : null}
                  {(() => {
                    const targetActorClass =
                      guided.guidedClassId === NEW_GUIDED_CLASS_ID
                        ? null
                        : (draft.classes.find((entry) => entry.id === guided.guidedClassId) ?? null);
                    const targetClassEntry =
                      guided.guidedClassId === NEW_GUIDED_CLASS_ID
                        ? (compendium.classes.find((entry) => entry.id === guided.guidedSetup.classId) ?? null)
                        : targetActorClass
                          ? (findCompendiumClass(targetActorClass, compendium.classes) ?? null)
                          : null;
                    const nextLevel = guided.guidedClassId === NEW_GUIDED_CLASS_ID ? 1 : (targetActorClass?.level ?? 0) + 1;

                    return targetClassEntry &&
                      targetClassEntry.subclasses.length > 0 &&
                      nextLevel >= (targetClassEntry.subclassLevel ?? 99) ? (
                      <Field label="Subclass (Level 3+)">
                        <select
                          className={inputClass}
                          value={guided.guidedSetup.subclassId}
                          onChange={(event) => guided.setGuidedSetup((current) => ({ ...current, subclassId: event.target.value }))}
                        >
                          <option value="">Select a subclass</option>
                          {targetClassEntry.subclasses.map((entry) => (
                            <option
                              key={entry.id}
                              value={entry.id}
                              disabled={
                                !findSubclassesForClass(targetClassEntry.name).some(
                                  (definition) => definition.id === entry.id || definition.name === entry.name
                                )
                              }
                            >
                              {entry.name} ({entry.source})
                              {!findSubclassesForClass(targetClassEntry.name).some(
                                (definition) => definition.id === entry.id || definition.name === entry.name
                              )
                                ? " — rules metadata unavailable"
                                : ""}
                            </option>
                          ))}
                        </select>
                        {targetActorClass?.subclassName ? (
                          <p className="mt-2 text-xs text-zinc-500">Current: {targetActorClass.subclassName}</p>
                        ) : null}
                      </Field>
                    ) : null;
                  })()}
                </div>

                {/* Hit Points on Level Up */}
                <div className="space-y-3 border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">Hit Points Progression</p>
                    <span className="text-xs text-zinc-400">
                      Hit Die: d{guided.guidedChoiceSpec.hitDieFaces} • CON Modifier: {formatModifier(guided.guidedChoiceSpec.conModifier)}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      className={`flex flex-col items-start gap-1 border p-3 text-left transition ${
                        guided.guidedSetup.hpMode === "average"
                          ? "border-amber-500/80 bg-amber-500/10 text-amber-50"
                          : "border-white/10 bg-slate-900/60 text-zinc-300 hover:border-white/20"
                      }`}
                      onClick={() => guided.setGuidedSetup((current) => ({ ...current, hpMode: "average" }))}
                    >
                      <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">Fixed Average</span>
                      <span className="text-sm">
                        +{guided.guidedChoiceSpec.averageHpGain} HP ({Math.floor(guided.guidedChoiceSpec.hitDieFaces / 2) + 1} +{" "}
                        {formatModifier(guided.guidedChoiceSpec.conModifier)} CON)
                      </span>
                    </button>

                    <div
                      className={`flex flex-col justify-between border p-3 transition ${
                        guided.guidedSetup.hpMode === "roll"
                          ? "border-amber-500/80 bg-amber-500/10 text-amber-50"
                          : "border-white/10 bg-slate-900/60 text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">Roll Hit Die</span>
                        <button
                          type="button"
                          className={secondaryButtonClass}
                          onClick={() => {
                            const roll = Math.floor(Math.random() * (guided.guidedChoiceSpec.hitDieFaces || 8)) + 1;
                            guided.setGuidedSetup((current) => ({
                              ...current,
                              hpMode: "roll",
                              rolledHp: roll
                            }));
                          }}
                        >
                          Roll 1d{guided.guidedChoiceSpec.hitDieFaces}
                        </button>
                      </div>
                      <span className="mt-2 text-sm">
                        {guided.guidedSetup.rolledHp !== null
                          ? `Rolled: ${guided.guidedSetup.rolledHp} + ${formatModifier(guided.guidedChoiceSpec.conModifier)} CON = +${Math.max(1, guided.guidedSetup.rolledHp + guided.guidedChoiceSpec.conModifier)} HP`
                          : "Click Roll to roll hit die"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {guided.guidedChoiceSpec.weaponMasteryCount > 0 ||
            guided.guidedChoiceSpec.classFeatCount > 0 ||
            guided.guidedChoiceSpec.optionalFeatureCount > 0 ||
            guided.guidedChoiceSpec.cantripCount > 0 ||
            guided.guidedChoiceSpec.knownSpellCount > 0 ||
            guided.guidedChoiceSpec.spellbookCount > 0 ||
            guided.guidedChoiceSpec.expertiseCount > 0 ||
            guided.guidedChoiceSpec.abilityImprovementCount > 0 ? (
              <div className="space-y-4 border border-white/8 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">Class Choices</p>

                {guided.guidedChoiceSpec.weaponMasteryCount > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-300">
                      Weapon Masteries ({guided.guidedChoiceSpec.weaponMasteryCount} choice
                      {guided.guidedChoiceSpec.weaponMasteryCount === 1 ? "" : "s"}):
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {Array.from({ length: guided.guidedChoiceSpec.weaponMasteryCount }, (_, index) => (
                        <Field key={`mastery-${index}`} label={`Weapon Mastery ${index + 1}`}>
                          <select
                            className={inputClass}
                            value={guided.guidedSetup.weaponMasteryChoices[index] ?? ""}
                            onChange={(event) =>
                              guided.setGuidedSetup((current) => ({
                                ...current,
                                weaponMasteryChoices: replaceGuideSelection(current.weaponMasteryChoices, index, event.target.value)
                              }))
                            }
                          >
                            <option value="">Select a weapon mastery</option>
                            {guided.guidedChoiceSpec.weaponMasteryOptions.map((opt) => (
                              <option
                                key={opt}
                                value={opt}
                                disabled={guideOptionDisabled(guided.guidedSetup.weaponMasteryChoices, index, opt)}
                              >
                                {opt}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ))}
                    </div>
                  </div>
                ) : null}

                {guided.guidedChoiceSpec.classFeatCount > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {Array.from({ length: guided.guidedChoiceSpec.classFeatCount }, (_, index) => (
                      <Field key={`class-feat-${index}`} label={`Class Feat ${index + 1}`}>
                        <select
                          className={inputClass}
                          value={guided.guidedSetup.classFeatIds[index] ?? ""}
                          onChange={(event) =>
                            guided.setGuidedSetup((current) => ({
                              ...current,
                              classFeatIds: replaceGuideSelection(current.classFeatIds, index, event.target.value)
                            }))
                          }
                        >
                          {guided.guidedChoiceSpec.classFeatOptions.map((entry) => (
                            <option
                              key={entry.id}
                              value={entry.id}
                              disabled={guideOptionDisabled(guided.guidedSetup.classFeatIds, index, entry.id)}
                            >
                              {entry.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ))}
                  </div>
                ) : null}

                {guided.guidedChoiceSpec.optionalFeatureCount > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {Array.from({ length: guided.guidedChoiceSpec.optionalFeatureCount }, (_, index) => (
                      <Field key={`optional-feature-${index}`} label={`Optional Feature ${index + 1}`}>
                        <select
                          className={inputClass}
                          value={guided.guidedSetup.optionalFeatureIds[index] ?? ""}
                          onChange={(event) =>
                            guided.setGuidedSetup((current) => ({
                              ...current,
                              optionalFeatureIds: replaceGuideSelection(current.optionalFeatureIds, index, event.target.value)
                            }))
                          }
                        >
                          {guided.guidedChoiceSpec.optionalFeatureOptions.map((entry) => (
                            <option
                              key={entry.id}
                              value={entry.id}
                              disabled={guideOptionDisabled(guided.guidedSetup.optionalFeatureIds, index, entry.id)}
                            >
                              {entry.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ))}
                  </div>
                ) : null}

                {guided.guidedChoiceSpec.cantripCount > 0 ? (
                  <div className="space-y-3 border border-white/8 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-zinc-100">Cantrips</p>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                          {guided.guidedSetup.cantripIds.filter(Boolean).length}/{guided.guidedChoiceSpec.cantripCount} selected
                        </p>
                      </div>
                      <button type="button" className={secondaryButtonClass} onClick={() => onOpenSpellSelection("guideCantrips")}>
                        <Plus size={14} />
                        Select
                      </button>
                    </div>
                    <DetailCollection
                      entries={collectSpellRows(
                        findSpellNamesByIds(guided.guidedSetup.cantripIds, guided.guidedChoiceSpec.cantripOptions),
                        [],
                        guided.guidedChoiceSpec.cantripOptions,
                        guided.guidedChoiceSpec.cantripCount
                      )}
                      emptyMessage="No cantrips selected yet."
                      renderText={renderRulesText}
                    />
                  </div>
                ) : null}

                {guided.guidedChoiceSpec.knownSpellCount > 0 ? (
                  <div className="space-y-3 border border-white/8 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-zinc-100">Known Spells</p>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                          {guided.guidedSetup.knownSpellIds.filter(Boolean).length}/{guided.guidedChoiceSpec.knownSpellCount} selected
                        </p>
                      </div>
                      <button type="button" className={secondaryButtonClass} onClick={() => onOpenSpellSelection("guideKnown")}>
                        <Plus size={14} />
                        Select
                      </button>
                    </div>
                    <DetailCollection
                      entries={collectSpellRows(
                        findSpellNamesByIds(guided.guidedSetup.knownSpellIds, guided.guidedChoiceSpec.knownSpellOptions),
                        [],
                        guided.guidedChoiceSpec.knownSpellOptions,
                        guided.guidedChoiceSpec.knownSpellCount
                      )}
                      emptyMessage="No guide spells selected yet."
                      renderText={renderRulesText}
                    />
                  </div>
                ) : null}

                {guided.guidedChoiceSpec.spellbookCount > 0 ? (
                  <div className="space-y-3 border border-white/8 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-zinc-100">Spellbook Spells</p>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                          {guided.guidedSetup.spellbookSpellIds.filter(Boolean).length}/{guided.guidedChoiceSpec.spellbookCount} selected
                        </p>
                      </div>
                      <button type="button" className={secondaryButtonClass} onClick={() => onOpenSpellSelection("guideSpellbook")}>
                        <Plus size={14} />
                        Select
                      </button>
                    </div>
                    <DetailCollection
                      entries={collectSpellRows(
                        findSpellNamesByIds(guided.guidedSetup.spellbookSpellIds, guided.guidedChoiceSpec.spellbookOptions),
                        [],
                        guided.guidedChoiceSpec.spellbookOptions,
                        guided.guidedChoiceSpec.spellbookCount
                      )}
                      emptyMessage="No guide spellbook spells selected yet."
                      renderText={renderRulesText}
                    />
                  </div>
                ) : null}

                {guided.guidedChoiceSpec.preparedSpellCount > 0 ? (
                  <div className="space-y-3 border border-white/8 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-zinc-100">Prepared Spells</p>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                          {guided.guidedSetup.preparedSpellIds.filter(Boolean).length}/{guided.guidedChoiceSpec.preparedSpellCount} selected
                        </p>
                      </div>
                      <button type="button" className={secondaryButtonClass} onClick={() => onOpenSpellSelection("guidePrepared")}>
                        <Plus size={14} />
                        Select
                      </button>
                    </div>
                    <DetailCollection
                      entries={collectSpellRows(
                        findSpellNamesByIds(guided.guidedSetup.preparedSpellIds, guided.guidedChoiceSpec.preparedSpellOptions),
                        findSpellNamesByIds(guided.guidedSetup.preparedSpellIds, guided.guidedChoiceSpec.preparedSpellOptions),
                        guided.guidedChoiceSpec.preparedSpellOptions,
                        guided.guidedChoiceSpec.preparedSpellCount
                      )}
                      emptyMessage="No prepared spells selected yet."
                      renderText={renderRulesText}
                    />
                  </div>
                ) : null}

                {guided.guidedChoiceSpec.expertiseCount > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {Array.from({ length: guided.guidedChoiceSpec.expertiseCount }, (_, index) => (
                      <Field key={`expertise-${index}`} label={`Expertise ${index + 1}`}>
                        <select
                          className={inputClass}
                          value={guided.guidedSetup.expertiseSkillChoices[index] ?? ""}
                          onChange={(event) =>
                            guided.setGuidedSetup((current) => ({
                              ...current,
                              expertiseSkillChoices: replaceGuideSelection(current.expertiseSkillChoices, index, event.target.value)
                            }))
                          }
                        >
                          {guided.guidedChoiceSpec.expertiseSkillOptions.map((entry) => (
                            <option
                              key={entry.id}
                              value={entry.name}
                              disabled={guideOptionDisabled(guided.guidedSetup.expertiseSkillChoices, index, entry.name)}
                            >
                              {entry.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ))}
                  </div>
                ) : null}

                {guided.guidedChoiceSpec.classChoiceGroups && guided.guidedChoiceSpec.classChoiceGroups.length > 0 ? (
                  <div className="space-y-4">
                    {guided.guidedChoiceSpec.classChoiceGroups
                      .filter(
                        (group: CompendiumChoiceGroup) =>
                          !group.parentOption ||
                          (guided.guidedSetup.classChoiceIds?.[group.parentOption.groupId] ?? []).includes(group.parentOption.optionId)
                      )
                      .map((group: CompendiumChoiceGroup) => {
                        const selectedIds = guided.guidedSetup.classChoiceIds?.[group.id] ?? [];
                        const maxCount = group.count || 1;

                        return (
                          <div key={group.id} className="space-y-2 border border-white/5 bg-slate-900/40 p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">{group.label}</p>
                              <span className="text-[11px] text-zinc-400">
                                {selectedIds.length}/{maxCount} selected {group.hint ? `• ${group.hint}` : ""}
                              </span>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {group.options.map((opt: CompendiumChoiceOption) => {
                                const isSelected = selectedIds.includes(opt.id);
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    disabled={Boolean(opt.disabledReason)}
                                    className={`flex flex-col items-start gap-1 border p-2.5 text-left transition ${
                                      opt.disabledReason
                                        ? "cursor-not-allowed border-red-500/20 bg-red-950/10 text-zinc-500"
                                        : isSelected
                                          ? "border-amber-500/80 bg-amber-500/10 text-amber-50"
                                          : "border-white/8 bg-black/20 text-zinc-300 hover:border-white/20"
                                    }`}
                                    onClick={() => {
                                      guided.setGuidedSetup((current) => {
                                        const existing = current.classChoiceIds?.[group.id] ?? [];
                                        let nextChoices: string[];
                                        if (isSelected) {
                                          nextChoices = existing.filter((id) => id !== opt.id);
                                        } else if (maxCount === 1) {
                                          nextChoices = [opt.id];
                                        } else if (existing.length < maxCount) {
                                          nextChoices = [...existing, opt.id];
                                        } else {
                                          nextChoices = [...existing.slice(1), opt.id];
                                        }
                                        return {
                                          ...current,
                                          classChoiceIds: {
                                            ...current.classChoiceIds,
                                            [group.id]: nextChoices
                                          }
                                        };
                                      });
                                    }}
                                  >
                                    <span className="text-xs font-medium text-amber-200">{opt.label}</span>
                                    {opt.description ? (
                                      <span className="text-[11px] leading-relaxed text-zinc-400">{opt.description}</span>
                                    ) : null}
                                    {opt.disabledReason ? (
                                      <span className="text-[11px] leading-relaxed text-red-300">{opt.disabledReason}</span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : null}

                {(() => {
                  const selectedFeatIds = Array.from(
                    new Set(
                      [
                        ...guided.guidedSetup.classFeatIds,
                        guided.guidedSetup.originFeatId,
                        guided.guidedSetup.speciesOriginFeatId,
                        guided.guidedSetup.asiMode === "feat" ? guided.guidedSetup.asiFeatId : ""
                      ].filter(Boolean)
                    )
                  );
                  const selectedGroups = selectedFeatIds.flatMap((featId) =>
                    (guided.guidedChoiceSpec.featChoiceGroups?.[featId] ?? []).map((group) => ({ featId, group }))
                  );
                  if (selectedGroups.length === 0) return null;
                  return (
                    <div className="space-y-3 border border-amber-500/20 bg-amber-500/5 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">Feat Options & Grants</p>
                      {selectedGroups.map(({ featId, group }) => {
                        const selectedIds = guided.guidedSetup.featChoiceMap?.[featId]?.[group.id] ?? [];
                        return (
                          <div key={`${featId}:${group.id}`} className="space-y-2">
                            <p className="text-xs text-zinc-300">
                              {group.label} ({selectedIds.length}/{group.count})
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {group.options.map((option) => {
                                const selected = selectedIds.includes(option.id);
                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    disabled={Boolean(option.disabledReason)}
                                    className={`border p-2 text-left text-xs ${
                                      option.disabledReason
                                        ? "cursor-not-allowed border-red-500/20 text-zinc-500"
                                        : selected
                                          ? "border-amber-500 bg-amber-500/10 text-amber-100"
                                          : "border-white/10 text-zinc-300 hover:border-white/25"
                                    }`}
                                    onClick={() =>
                                      guided.setGuidedSetup((current) => {
                                        const currentIds = current.featChoiceMap?.[featId]?.[group.id] ?? [];
                                        const nextIds = selected
                                          ? currentIds.filter((id) => id !== option.id)
                                          : group.count === 1
                                            ? [option.id]
                                            : currentIds.length < group.count
                                              ? [...currentIds, option.id]
                                              : [...currentIds.slice(1), option.id];
                                        return {
                                          ...current,
                                          featChoiceMap: {
                                            ...current.featChoiceMap,
                                            [featId]: { ...(current.featChoiceMap?.[featId] ?? {}), [group.id]: nextIds }
                                          }
                                        };
                                      })
                                    }
                                  >
                                    <span className="block font-medium">{option.label}</span>
                                    {option.description ? <span className="mt-1 block text-zinc-500">{option.description}</span> : null}
                                    {option.disabledReason ? (
                                      <span className="mt-1 block text-red-300">{option.disabledReason}</span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {guided.guidedChoiceSpec.abilityImprovementCount > 0 ? (
                  <div className="space-y-3">
                    <Field label="Ability Score Improvement / Feat">
                      <select
                        className={inputClass}
                        value={guided.guidedSetup.asiMode}
                        onChange={(event) =>
                          guided.setGuidedSetup((current) => ({ ...current, asiMode: event.target.value as "feat" | "ability" }))
                        }
                      >
                        <option value="feat">Select a Feat</option>
                        <option value="ability">Increase Ability Scores</option>
                      </select>
                    </Field>
                    {guided.guidedSetup.asiMode === "feat" ? (
                      <div className="space-y-3">
                        <Field label="Feat">
                          <select
                            className={inputClass}
                            value={guided.guidedSetup.asiFeatId}
                            onChange={(event) => guided.setGuidedSetup((current) => ({ ...current, asiFeatId: event.target.value }))}
                          >
                            <option value="">Select a feat</option>
                            {guided.guidedFeatOptions.map((entry) => (
                              <option
                                key={entry.id}
                                value={entry.id}
                                disabled={!findFeatProgression(entry.id) && !findFeatProgression(entry.name)}
                              >
                                {entry.name} ({entry.category})
                                {!findFeatProgression(entry.id) && !findFeatProgression(entry.name) ? " — rules metadata unavailable" : ""}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={`px-3 py-1 text-xs font-medium uppercase tracking-wider ${
                              guided.guidedSetup.asiAbilityMode === "+2"
                                ? "bg-amber-500 text-zinc-950"
                                : "bg-white/5 text-zinc-300 hover:bg-white/10"
                            }`}
                            onClick={() => guided.setGuidedSetup((current) => ({ ...current, asiAbilityMode: "+2" }))}
                          >
                            +2 to One Score
                          </button>
                          <button
                            type="button"
                            className={`px-3 py-1 text-xs font-medium uppercase tracking-wider ${
                              guided.guidedSetup.asiAbilityMode === "+1+1"
                                ? "bg-amber-500 text-zinc-950"
                                : "bg-white/5 text-zinc-300 hover:bg-white/10"
                            }`}
                            onClick={() => guided.setGuidedSetup((current) => ({ ...current, asiAbilityMode: "+1+1" }))}
                          >
                            +1 to Two Scores
                          </button>
                        </div>
                        {guided.guidedSetup.asiAbilityMode === "+2" ? (
                          <Field label="+2 Ability Score">
                            <select
                              className={inputClass}
                              value={guided.guidedSetup.asiAbilityChoices[0] ?? "str"}
                              onChange={(event) =>
                                guided.setGuidedSetup((current) => ({
                                  ...current,
                                  asiAbilityChoices: [event.target.value as AbilityKey]
                                }))
                              }
                            >
                              {abilityOrder.map((ability) => (
                                <option key={ability.key} value={ability.key}>
                                  +2 {ability.label}
                                </option>
                              ))}
                            </select>
                          </Field>
                        ) : (
                          <div className="grid gap-3 md:grid-cols-2">
                            <Field label="+1 Ability (First)">
                              <select
                                className={inputClass}
                                value={guided.guidedSetup.asiAbilityChoices[0] ?? "str"}
                                onChange={(event) =>
                                  guided.setGuidedSetup((current) => ({
                                    ...current,
                                    asiAbilityChoices: [event.target.value as AbilityKey, current.asiAbilityChoices[1] ?? "dex"]
                                  }))
                                }
                              >
                                {abilityOrder.map((ability) => (
                                  <option key={ability.key} value={ability.key}>
                                    +1 {ability.label}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="+1 Ability (Second)">
                              <select
                                className={inputClass}
                                value={guided.guidedSetup.asiAbilityChoices[1] ?? "dex"}
                                onChange={(event) =>
                                  guided.setGuidedSetup((current) => ({
                                    ...current,
                                    asiAbilityChoices: [current.asiAbilityChoices[0] ?? "str", event.target.value as AbilityKey]
                                  }))
                                }
                              >
                                {abilityOrder.map((ability) => (
                                  <option key={ability.key} value={ability.key}>
                                    +1 {ability.label}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {guided.selectedGuideFeats.length > 0 ||
            guided.selectedGuideOptionalFeatures.length > 0 ||
            guided.selectedGuideSpells.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-3">
                {guided.selectedGuideFeats.length > 0 ? (
                  <DetailCollection
                    title="Feat Previews"
                    entries={guided.selectedGuideFeats.map((entry) => ({
                      id: entry.id,
                      eyebrow: "Feat",
                      title: entry.name,
                      subtitle: entry.category,
                      source: entry.source,
                      description: [entry.abilityScoreIncrease, entry.description].filter(Boolean).join("\n\n")
                    }))}
                    emptyMessage=""
                    renderText={renderRulesText}
                  />
                ) : null}
                {guided.selectedGuideOptionalFeatures.length > 0 ? (
                  <DetailCollection
                    title="Feature Previews"
                    entries={guided.selectedGuideOptionalFeatures.map((entry) =>
                      createReferenceRow("Optional Feature", entry, [{ label: "Prerequisites", value: entry.prerequisites || "None" }])
                    )}
                    emptyMessage=""
                    renderText={renderRulesText}
                  />
                ) : null}
                {guided.selectedGuideSpells.length > 0 ? (
                  <DetailCollection
                    title="Spell Previews"
                    entries={collectSpellRows(
                      guided.selectedGuideSpells.map((entry) => entry.name),
                      [],
                      compendium.spells,
                      guided.guidedChoiceSpec.knownSpellCount + guided.guidedChoiceSpec.spellbookCount
                    )}
                    emptyMessage=""
                    renderText={renderRulesText}
                  />
                ) : null}
              </div>
            ) : null}

            <div className="flex justify-end">
              <button
                type="button"
                className="border border-amber-500 bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400"
                onClick={guided.guidedFlowMode === "setup" ? guided.confirmGuidedSetup : guided.confirmGuidedLevelUp}
              >
                {guided.guidedFlowMode === "setup" ? "Apply Setup" : "Apply Level"}
              </button>
            </div>
          </div>
        </div>
      </>
    </ModalFrame>
  );
}
