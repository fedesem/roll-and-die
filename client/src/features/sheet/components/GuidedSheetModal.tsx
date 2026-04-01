import { Plus, X } from "lucide-react";
import type { ReactNode } from "react";

import type { AbilityKey } from "@shared/types";

import { ModalFrame } from "../../../components/ModalFrame";
import type { ActorSheet } from "@shared/types";
import type { GuidedSheetFlowState } from "../hooks/useGuidedSheetFlow";
import { collectSpellRows, createReferenceRow, findSpellNamesByIds, guideOptionDisabled, replaceGuideSelection } from "../selectors/playerNpcSheet2024Selectors";
import { abilityOrder, findCompendiumClass } from "../sheetUtils";
import { NEW_GUIDED_CLASS_ID, type SheetCompendium } from "../playerNpcSheet2024Types";
import { DetailCollection, Field, inputClass, secondaryButtonClass } from "./sheetPrimitives";

interface GuidedSheetModalProps {
  draft: ActorSheet;
  compendium: SheetCompendium;
  filteredFeats: SheetCompendium["feats"];
  guided: GuidedSheetFlowState;
  onOpenSpellSelection: (target: "guideCantrips" | "guideKnown" | "guideSpellbook") => void;
  renderRulesText: (text: string) => ReactNode;
}

export function GuidedSheetModal({ draft, compendium, filteredFeats, guided, onOpenSpellSelection, renderRulesText }: GuidedSheetModalProps) {
  if (!guided.guidedFlowOpen) {
    return null;
  }

  return (
    <ModalFrame onClose={guided.closeGuidedFlow} backdropClassName="bg-black/60" panelClassName="max-w-3xl border-white/10 bg-slate-950">
      <>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-amber-400/80">Build Guide</p>
            <h3 className="mt-2 font-serif text-2xl text-amber-50">{guided.guidedFlowMode === "setup" ? "Level 1 Setup" : "Level Up Guide"}</h3>
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
        {guided.guideError ? <p className="mx-5 mt-4 border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{guided.guideError}</p> : null}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <div className="space-y-4">
            {guided.guidedFlowMode === "setup" ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Species">
                    <select
                      className={inputClass}
                      value={guided.guidedSetup.speciesId}
                      onChange={(event) => {
                        const nextSpecies = compendium.races.find((entry) => entry.id === event.target.value) ?? null;
                        const nextSpeciesSkillOptions = guided.guidedSpeciesSkillChoices;
                        const nextSpeciesFeatOptions = nextSpecies ? compendium.feats.filter((entry) => guided.guidedSpeciesOriginFeatOptions.some((option) => option.id === entry.id)) : [];
                        guided.setGuidedSetup((current) => ({
                          ...current,
                          speciesId: event.target.value,
                          speciesSkillChoice: nextSpeciesSkillOptions[0]?.name ?? "",
                          speciesOriginFeatId: nextSpeciesFeatOptions[0]?.id ?? ""
                        }));
                      }}
                    >
                      <option value="">Select a species</option>
                      {compendium.races.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Background">
                    <select
                      className={inputClass}
                      value={guided.guidedSetup.backgroundId}
                      onChange={(event) => {
                        const nextBackground = compendium.backgrounds.find((entry) => entry.id === event.target.value) ?? null;
                        const nextAbilityConfig = nextBackground ? guided.guidedAbilityChoiceConfig : guided.guidedAbilityChoiceConfig;
                        const nextFeatOptions = nextBackground ? guided.guidedOriginFeatOptions : [];
                        const nextEquipmentGroups = nextBackground ? guided.guidedEquipmentGroups : [];
                        guided.setGuidedSetup((current) => ({
                          ...current,
                          backgroundId: event.target.value,
                          originFeatId: nextFeatOptions[0]?.id ?? "",
                          equipmentChoiceIds: Object.fromEntries(nextEquipmentGroups.map((group) => [group.id, group.options[0]?.id ?? ""])),
                          abilityChoices: nextAbilityConfig.abilities.slice(0, nextAbilityConfig.count)
                        }));
                      }}
                    >
                      <option value="">Select a background</option>
                      {compendium.backgrounds.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Class">
                    <select className={inputClass} value={guided.guidedSetup.classId} onChange={(event) => guided.setGuidedSetup((current) => ({ ...current, classId: event.target.value }))}>
                      <option value="">Select a class</option>
                      {compendium.classes.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                {guided.guidedSpeciesSkillChoices.length > 0 || guided.guidedSpeciesOriginFeatOptions.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {guided.guidedSpeciesSkillChoices.length > 0 ? (
                      <Field label="Species Skill Choice">
                        <select className={inputClass} value={guided.guidedSetup.speciesSkillChoice} onChange={(event) => guided.setGuidedSetup((current) => ({ ...current, speciesSkillChoice: event.target.value }))}>
                          {guided.guidedSpeciesSkillChoices.map((entry) => (
                            <option key={entry.id} value={entry.name}>
                              {entry.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : null}
                    {guided.guidedSpeciesOriginFeatOptions.length > 0 ? (
                      <Field label="Species Feat Choice">
                        <select className={inputClass} value={guided.guidedSetup.speciesOriginFeatId} onChange={(event) => guided.setGuidedSetup((current) => ({ ...current, speciesOriginFeatId: event.target.value }))}>
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

                {guided.guidedAbilityChoiceConfig.count > 0 ? (
                  <div className="space-y-3 border border-white/8 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">Ability Choices</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {Array.from({ length: guided.guidedAbilityChoiceConfig.count }, (_, index) => (
                        <Field key={index} label={`Choice ${index + 1}`}>
                          <select
                            className={inputClass}
                            value={guided.guidedSetup.abilityChoices[index] ?? ""}
                            onChange={(event) =>
                              guided.setGuidedSetup((current) => ({
                                ...current,
                                abilityChoices: current.abilityChoices.map((entry, abilityIndex) => (abilityIndex === index ? (event.target.value as AbilityKey) : entry))
                              }))
                            }
                          >
                            <option value="">Select an ability</option>
                            {guided.guidedAbilityChoiceConfig.abilities.map((abilityKey) => (
                              <option key={abilityKey} value={abilityKey}>
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
                    <select className={inputClass} value={guided.guidedSetup.originFeatId} onChange={(event) => guided.setGuidedSetup((current) => ({ ...current, originFeatId: event.target.value }))}>
                      {guided.guidedOriginFeatOptions.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}

                {guided.guidedEquipmentGroups.length > 0 ? (
                  <div className="space-y-3">
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

                <div className="grid gap-3 md:grid-cols-3">
                  {guided.guidedSelectedSpecies ? <DetailCollection entries={[createReferenceRow("Species", guided.guidedSelectedSpecies)]} emptyMessage="" renderText={renderRulesText} /> : null}
                  {guided.guidedSelectedBackground ? <DetailCollection entries={[createReferenceRow("Background", guided.guidedSelectedBackground)]} emptyMessage="" renderText={renderRulesText} /> : null}
                  {guided.guidedSelectedClass ? (
                    <DetailCollection
                      entries={[
                        {
                          id: guided.guidedSelectedClass.id,
                          eyebrow: "Class",
                          title: guided.guidedSelectedClass.name,
                          subtitle: `d${guided.guidedSelectedClass.hitDieFaces} Hit Die`,
                          source: guided.guidedSelectedClass.source,
                          description: guided.guidedSelectedClass.description
                        }
                      ]}
                      emptyMessage=""
                      renderText={renderRulesText}
                    />
                  ) : null}
                </div>
              </>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Level Up Class">
                  <select className={inputClass} value={guided.guidedClassId} onChange={(event) => guided.setGuidedClassId(event.target.value)}>
                    <option value={NEW_GUIDED_CLASS_ID}>Add a new class</option>
                    {draft.classes.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {guided.guidedClassId === NEW_GUIDED_CLASS_ID ? (
                  <Field label="New Class">
                    <select className={inputClass} value={guided.guidedSetup.classId} onChange={(event) => guided.setGuidedSetup((current) => ({ ...current, classId: event.target.value }))}>
                      <option value="">Select a class</option>
                      {compendium.classes.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}
                {(() => {
                  const targetActorClass = guided.guidedClassId === NEW_GUIDED_CLASS_ID ? null : draft.classes.find((entry) => entry.id === guided.guidedClassId) ?? null;
                  const targetClassEntry =
                    guided.guidedClassId === NEW_GUIDED_CLASS_ID
                      ? compendium.classes.find((entry) => entry.id === guided.guidedSetup.classId) ?? null
                      : targetActorClass
                        ? findCompendiumClass(targetActorClass, compendium.classes) ?? null
                        : null;
                  const nextLevel = guided.guidedClassId === NEW_GUIDED_CLASS_ID ? 1 : (targetActorClass?.level ?? 0) + 1;
                  const buildClass = targetActorClass ? draft.build?.classes.find((entry) => entry.id === targetActorClass.id) : null;

                  return targetClassEntry && targetClassEntry.subclasses.length > 0 && nextLevel >= (targetClassEntry.subclassLevel ?? 99) ? (
                    <Field label="Subclass">
                      <select className={inputClass} value={guided.guidedSetup.subclassId} onChange={(event) => guided.setGuidedSetup((current) => ({ ...current, subclassId: event.target.value }))}>
                        <option value="">Select a subclass</option>
                        {targetClassEntry.subclasses.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                      {buildClass?.subclassName ? <p className="mt-2 text-xs text-zinc-500">Current: {buildClass.subclassName}</p> : null}
                    </Field>
                  ) : null;
                })()}
              </div>
            )}

            {guided.guidedChoiceSpec.classFeatCount > 0 ||
            guided.guidedChoiceSpec.optionalFeatureCount > 0 ||
            guided.guidedChoiceSpec.cantripCount > 0 ||
            guided.guidedChoiceSpec.knownSpellCount > 0 ||
            guided.guidedChoiceSpec.spellbookCount > 0 ||
            guided.guidedChoiceSpec.expertiseCount > 0 ||
            guided.guidedChoiceSpec.abilityImprovementCount > 0 ? (
              <div className="space-y-4 border border-white/8 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">Class Choices</p>

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
                            <option key={entry.id} value={entry.id} disabled={guideOptionDisabled(guided.guidedSetup.classFeatIds, index, entry.id)}>
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
                            <option key={entry.id} value={entry.id} disabled={guideOptionDisabled(guided.guidedSetup.optionalFeatureIds, index, entry.id)}>
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
                    <DetailCollection entries={collectSpellRows(findSpellNamesByIds(guided.guidedSetup.cantripIds, guided.guidedChoiceSpec.cantripOptions), [], guided.guidedChoiceSpec.cantripOptions, guided.guidedChoiceSpec.cantripCount)} emptyMessage="No cantrips selected yet." renderText={renderRulesText} />
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
                    <DetailCollection entries={collectSpellRows(findSpellNamesByIds(guided.guidedSetup.knownSpellIds, guided.guidedChoiceSpec.knownSpellOptions), [], guided.guidedChoiceSpec.knownSpellOptions, guided.guidedChoiceSpec.knownSpellCount)} emptyMessage="No guide spells selected yet." renderText={renderRulesText} />
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
                    <DetailCollection entries={collectSpellRows(findSpellNamesByIds(guided.guidedSetup.spellbookSpellIds, guided.guidedChoiceSpec.spellbookOptions), [], guided.guidedChoiceSpec.spellbookOptions, guided.guidedChoiceSpec.spellbookCount)} emptyMessage="No guide spellbook spells selected yet." renderText={renderRulesText} />
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
                            <option key={entry.id} value={entry.name} disabled={guideOptionDisabled(guided.guidedSetup.expertiseSkillChoices, index, entry.name)}>
                              {entry.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ))}
                  </div>
                ) : null}

                {guided.guidedChoiceSpec.abilityImprovementCount > 0 ? (
                  <div className="space-y-3">
                    <Field label="Ability Score Improvement">
                      <select className={inputClass} value={guided.guidedSetup.asiMode} onChange={(event) => guided.setGuidedSetup((current) => ({ ...current, asiMode: event.target.value as "feat" | "ability" }))}>
                        <option value="feat">Feat</option>
                        <option value="ability">Ability Scores</option>
                      </select>
                    </Field>
                    {guided.guidedSetup.asiMode === "feat" ? (
                      <Field label="Feat">
                        <select className={inputClass} value={guided.guidedSetup.asiFeatId} onChange={(event) => guided.setGuidedSetup((current) => ({ ...current, asiFeatId: event.target.value }))}>
                          {filteredFeats.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {Array.from({ length: guided.guidedChoiceSpec.abilityImprovementCount * 2 }, (_, index) => (
                          <Field key={`asi-${index}`} label={`Ability ${index + 1}`}>
                            <select
                              className={inputClass}
                              value={guided.guidedSetup.asiAbilityChoices[index] ?? "str"}
                              onChange={(event) =>
                                guided.setGuidedSetup((current) => ({
                                  ...current,
                                  asiAbilityChoices: replaceGuideSelection(current.asiAbilityChoices, index, event.target.value as AbilityKey)
                                }))
                              }
                            >
                              {abilityOrder.map((ability) => (
                                <option key={ability.key} value={ability.key}>
                                  {ability.label}
                                </option>
                              ))}
                            </select>
                          </Field>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {guided.selectedGuideFeats.length > 0 || guided.selectedGuideOptionalFeatures.length > 0 || guided.selectedGuideSpells.length > 0 ? (
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
                    entries={guided.selectedGuideOptionalFeatures.map((entry) => createReferenceRow("Optional Feature", entry, [{ label: "Prerequisites", value: entry.prerequisites || "None" }]))}
                    emptyMessage=""
                    renderText={renderRulesText}
                  />
                ) : null}
                {guided.selectedGuideSpells.length > 0 ? (
                  <DetailCollection
                    title="Spell Previews"
                    entries={collectSpellRows(guided.selectedGuideSpells.map((entry) => entry.name), [], compendium.spells, guided.guidedChoiceSpec.knownSpellCount + guided.guidedChoiceSpec.spellbookCount)}
                    emptyMessage=""
                    renderText={renderRulesText}
                  />
                ) : null}
              </div>
            ) : null}

            <div className="flex justify-end">
              <button type="button" className="border border-amber-500 bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400" onClick={guided.guidedFlowMode === "setup" ? guided.confirmGuidedSetup : guided.confirmGuidedLevelUp}>
                {guided.guidedFlowMode === "setup" ? "Apply Setup" : "Apply Level"}
              </button>
            </div>
          </div>
        </div>
      </>
    </ModalFrame>
  );
}
