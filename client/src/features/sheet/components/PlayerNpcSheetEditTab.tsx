import { BookOpen, Brain, Heart, ImagePlus, Plus, Sparkles, Swords } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import type { ActorSheet, ArmorEntry } from "@shared/types";
import { CREATURE_SIZE_OPTIONS } from "@shared/tokenGeometry";

import { NumericInput } from "../../../components/NumericInput";
import type { GuidedSheetFlowState } from "../hooks/useGuidedSheetFlow";
import type { PlayerNpcSheetActions, PlayerNpcSheetMutators } from "../hooks/usePlayerNpcSheetController";
import type { PlayerNpcSheetDerivedState, PlayerNpcSheetPermissions } from "../hooks/usePlayerNpcSheetDerived";
import { createArmorEntry, createAttackEntry, createResourceEntry, updateHitPoints } from "../selectors/playerNpcSheet2024Mutations";
import { collectSpellRows, createReferenceRow, splitCommaValues } from "../selectors/playerNpcSheet2024Selectors";
import { abilityOrder, findCompendiumClass, formatModifier, normalizeKey, skillTotal } from "../sheetUtils";
import type { SheetCompendium } from "../playerNpcSheet2024Types";
import {
  actionButtonClass,
  Field,
  inputClass,
  LazyDetails,
  secondaryButtonClass,
  SectionCard,
  TagRow,
  textareaClass,
  DetailCollection
} from "./sheetPrimitives";

interface PlayerNpcSheetEditTabProps {
  draft: ActorSheet;
  compendium: SheetCompendium;
  derived: PlayerNpcSheetDerivedState & { saving: boolean; imageError: string | null };
  permissions: PlayerNpcSheetPermissions;
  mutators: PlayerNpcSheetMutators;
  actions: PlayerNpcSheetActions;
  guided: GuidedSheetFlowState;
  renderRulesText: (text: string) => ReactNode;
}

export function PlayerNpcSheetEditTab({
  draft,
  compendium,
  derived,
  permissions,
  mutators,
  actions,
  guided,
  renderRulesText
}: PlayerNpcSheetEditTabProps) {
  const [featToAdd, setFeatToAdd] = useState("");
  const spellDetailEntries = useMemo(
    () => ({
      known: collectSpellRows(draft.spells, draft.preparedSpells, compendium.spells, derived.preparedSpellLimit).map((entry) => ({
        ...entry,
        onRemove: permissions.editReadOnly ? undefined : () => mutators.updateField("spells", draft.spells.filter((value) => value !== entry.title))
      })),
      prepared: derived.spellRows
        .filter((entry) => draft.preparedSpells.includes(entry.title) || derived.spellCollections.alwaysPrepared.includes(entry.title))
        .map((entry) => ({
          ...entry,
          onRemove:
            permissions.editReadOnly || derived.spellCollections.alwaysPrepared.includes(entry.title)
              ? undefined
              : () => mutators.updateField("preparedSpells", draft.preparedSpells.filter((value) => value !== entry.title))
        })),
      spellbook: collectSpellRows(draft.spellState.spellbook, draft.preparedSpells, compendium.spells, derived.preparedSpellLimit).map((entry) => ({
        ...entry,
        onRemove:
          permissions.editReadOnly
            ? undefined
            : () =>
                mutators.updateField("spellState", {
                  ...draft.spellState,
                  spellbook: draft.spellState.spellbook.filter((value) => value !== entry.title)
                })
      })),
      alwaysPrepared: collectSpellRows(draft.spellState.alwaysPrepared, draft.preparedSpells, compendium.spells, derived.preparedSpellLimit).map((entry) => ({
        ...entry,
        onRemove:
          permissions.editReadOnly
            ? undefined
            : () =>
                mutators.updateField("spellState", {
                  ...draft.spellState,
                  alwaysPrepared: draft.spellState.alwaysPrepared.filter((value) => value !== entry.title)
                })
      })),
      atWill: collectSpellRows(draft.spellState.atWill, draft.preparedSpells, compendium.spells, derived.preparedSpellLimit).map((entry) => ({
        ...entry,
        onRemove:
          permissions.editReadOnly
            ? undefined
            : () =>
                mutators.updateField("spellState", {
                  ...draft.spellState,
                  atWill: draft.spellState.atWill.filter((value) => value !== entry.title)
                })
      })),
      perShortRest: collectSpellRows(draft.spellState.perShortRest, draft.preparedSpells, compendium.spells, derived.preparedSpellLimit).map((entry) => ({
        ...entry,
        onRemove:
          permissions.editReadOnly
            ? undefined
            : () =>
                mutators.updateField("spellState", {
                  ...draft.spellState,
                  perShortRest: draft.spellState.perShortRest.filter((value) => value !== entry.title)
                })
      })),
      perLongRest: collectSpellRows(draft.spellState.perLongRest, draft.preparedSpells, compendium.spells, derived.preparedSpellLimit).map((entry) => ({
        ...entry,
        onRemove:
          permissions.editReadOnly
            ? undefined
            : () =>
                mutators.updateField("spellState", {
                  ...draft.spellState,
                  perLongRest: draft.spellState.perLongRest.filter((value) => value !== entry.title)
                })
      })),
      feats: derived.featRows.map((entry) => ({
        ...entry,
        onRemove: permissions.editReadOnly ? undefined : () => mutators.updateField("feats", draft.feats.filter((value) => value !== entry.title))
      }))
    }),
    [
      compendium.spells,
      derived.featRows,
      derived.preparedSpellLimit,
      derived.spellCollections.alwaysPrepared,
      derived.spellRows,
      draft.feats,
      draft.preparedSpells,
      draft.spellState,
      draft.spells,
      mutators,
      permissions.editReadOnly
    ]
  );

  function addFeatById(featId: string) {
    const feat = compendium.feats.find((entry) => entry.id === featId);

    if (!feat) {
      return;
    }

    mutators.updateDraft((current) => ({
      ...current,
      feats: current.feats.includes(feat.name) ? current.feats : [...current.feats, feat.name]
    }));
    setFeatToAdd("");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr,1fr]">
      <div className="space-y-4">
        <SectionCard title="Edit Controls" icon={<Sparkles size={16} />}>
          <div className="flex flex-wrap items-center gap-2">
            {permissions.needsInitialGuidedSetup ? (
              <button type="button" className={actionButtonClass} onClick={() => guided.openGuidedFlow("setup")}>
                Open Setup Guide
              </button>
            ) : null}
            <button type="button" className={actionButtonClass} disabled={draft.classes.length === 0} onClick={() => guided.openGuidedFlow("levelup")}>
              Level Up
            </button>
            {permissions.canEdit ? (
              <button
                type="button"
                className="border border-amber-500 bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
                disabled={derived.saving}
                onClick={() => void actions.saveCurrent()}
              >
                {derived.saving ? "Saving…" : "Save"}
              </button>
            ) : null}
          </div>
          <p className="text-sm text-zinc-400">The edit tab stays fully editable. The setup and level-up guides add structured species, background, class, spell, feat, and feature choices on top of manual edits.</p>
        </SectionCard>

        <SectionCard title="Build Summary" icon={<Sparkles size={16} />}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Species">
              <select className={inputClass} disabled={permissions.editReadOnly} value={draft.build?.speciesId ?? ""} onChange={(event) => guided.applySpecies(event.target.value)}>
                <option value="">Select a species</option>
                {compendium.races.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Background">
              <select className={inputClass} disabled={permissions.editReadOnly} value={draft.build?.backgroundId ?? ""} onChange={(event) => guided.applyBackground(event.target.value)}>
                <option value="">Select a background</option>
                {compendium.backgrounds.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {derived.selectedSpecies || derived.selectedBackground ? (
            <div className="grid gap-3 md:grid-cols-2">
              {derived.selectedSpecies ? (
                <DetailCollection
                  entries={[createReferenceRow("Species", derived.selectedSpecies, [{ label: "Speed", value: `${derived.selectedSpecies.speed} ft` }])]}
                  emptyMessage="No species selected."
                  renderText={renderRulesText}
                />
              ) : null}
              {derived.selectedBackground ? (
                <DetailCollection
                  entries={[
                    createReferenceRow("Background", derived.selectedBackground, [
                      {
                        label: "Skills",
                        value: derived.selectedBackground.skillProficiencies.join(", ") || "None"
                      },
                      {
                        label: "Origin Feats",
                        value: derived.selectedBackground.featIds.join(", ") || "None"
                      }
                    ])
                  ]}
                  emptyMessage="No background selected."
                  renderText={renderRulesText}
                />
              ) : null}
            </div>
          ) : null}
          <div className="space-y-3">
            {draft.classes.map((actorClass, index) => {
              const classEntry = findCompendiumClass(actorClass, compendium.classes);

              return (
                <div key={actorClass.id} className="space-y-3 border border-white/8 bg-black/20 p-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Class">
                      <select className={inputClass} disabled={permissions.editReadOnly} value={actorClass.compendiumId} onChange={(event) => guided.applyClass(event.target.value, actorClass.id)}>
                        <option value="">Select a class</option>
                        {compendium.classes.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Level">
                      <NumericInput className={inputClass} min={1} value={actorClass.level} disabled={permissions.editReadOnly} onValueChange={(value) => mutators.updateClass(index, { level: value ?? 1 })} />
                    </Field>
                  </div>
                  {classEntry && classEntry.subclasses.length > 0 && actorClass.level >= (classEntry.subclassLevel ?? 99) ? (
                    <Field label="Subclass">
                      <select className={inputClass} disabled={permissions.editReadOnly} value={actorClass.subclassId ?? ""} onChange={(event) => guided.applySubclass(actorClass.id, event.target.value)}>
                        <option value="">Select a subclass</option>
                        {classEntry.subclasses.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={secondaryButtonClass} disabled={permissions.editReadOnly} onClick={() => mutators.removeFromArray("classes", index)}>
                      Remove Class
                    </button>
                  </div>
                  {classEntry ? (
                    <DetailCollection
                      entries={[
                        {
                          id: classEntry.id,
                          eyebrow: "Class",
                          title: classEntry.name,
                          subtitle: `d${classEntry.hitDieFaces} Hit Die`,
                          source: classEntry.source,
                          description: classEntry.description,
                          meta: [
                            {
                              label: "Primary Abilities",
                              value: classEntry.primaryAbilities.join(", ") || "None"
                            },
                            {
                              label: "Saving Throws",
                              value: classEntry.savingThrowProficiencies.join(", ") || "None"
                            }
                          ]
                        }
                      ]}
                      emptyMessage="No class selected."
                      renderText={renderRulesText}
                    />
                  ) : null}
                </div>
              );
            })}
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={permissions.editReadOnly}
              onClick={() => {
                const firstClass = compendium.classes[0];

                if (!firstClass) {
                  return;
                }

                guided.applyClass(firstClass.id);
              }}
            >
              <Plus size={14} />
              Add Class
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Identity & Stats" icon={<Brain size={16} />}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Name">
              <input className={inputClass} disabled={permissions.editReadOnly} value={draft.name} onChange={(event) => mutators.updateField("name", event.target.value)} />
            </Field>
            <Field label="Alignment">
              <input className={inputClass} disabled={permissions.editReadOnly} value={draft.alignment} onChange={(event) => mutators.updateField("alignment", event.target.value)} />
            </Field>
            <Field label="Vision Range (Squares)">
              <NumericInput className={inputClass} disabled={permissions.editReadOnly} value={draft.visionRange} onValueChange={(value) => mutators.updateField("visionRange", value ?? 0)} />
            </Field>
            <Field label="Creature Size">
              <select className={inputClass} disabled={permissions.editReadOnly} value={draft.creatureSize} onChange={(event) => mutators.updateField("creatureSize", event.target.value as ActorSheet["creatureSize"])}>
                {CREATURE_SIZE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Image">
              <label className={`flex items-center justify-center gap-2 border border-dashed border-white/12 px-3 py-3 text-sm text-zinc-300 transition ${permissions.editReadOnly ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-amber-500/70 hover:text-amber-50"}`}>
                <ImagePlus size={16} />
                Upload Portrait
                <input className="hidden" disabled={permissions.editReadOnly} type="file" accept="image/*" onChange={(event) => void actions.handleImageUpload(event)} />
              </label>
            </Field>
            <Field label="Token Color">
              <input className={inputClass} disabled={permissions.editReadOnly} type="color" value={draft.color} onChange={(event) => mutators.updateField("color", event.target.value)} />
            </Field>
          </div>
          {derived.imageError ? <p className="text-sm text-red-300">{derived.imageError}</p> : null}
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Field label="Current HP">
              <NumericInput className={inputClass} value={draft.hitPoints.current} disabled={permissions.editReadOnly} onValueChange={(value) => updateHitPoints("current", String(value ?? 0), mutators.updateDraft, draft.hitPoints.max)} />
            </Field>
            <Field label="Temp HP">
              <NumericInput className={inputClass} value={draft.hitPoints.temp} disabled={permissions.editReadOnly} onValueChange={(value) => updateHitPoints("temp", String(value ?? 0), mutators.updateDraft, draft.hitPoints.max)} />
            </Field>
            <Field label="Max HP">
              <NumericInput className={inputClass} value={draft.hitPoints.max} disabled={permissions.editReadOnly} onValueChange={(value) => updateHitPoints("max", String(value ?? 0), mutators.updateDraft, value ?? 0)} />
            </Field>
            <Field label="Reduced Max HP">
              <NumericInput className={inputClass} value={draft.hitPoints.reducedMax} disabled={permissions.editReadOnly} onValueChange={(value) => updateHitPoints("reducedMax", String(value ?? 0), mutators.updateDraft, draft.hitPoints.max)} />
            </Field>
            <Field label="Speed">
              <NumericInput className={inputClass} value={draft.speed} disabled={permissions.editReadOnly} onValueChange={(value) => mutators.updateField("speed", value ?? 0)} />
            </Field>
            <Field label="Initiative Bonus">
              <NumericInput className={inputClass} disabled={permissions.editReadOnly} value={draft.initiative} onValueChange={(value) => mutators.updateField("initiative", value ?? 0)} />
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {abilityOrder.map((ability) => (
              <Field key={ability.key} label={ability.label}>
                <NumericInput className={inputClass} disabled={permissions.editReadOnly} value={draft.abilities[ability.key]} onValueChange={(value) => mutators.updateAbility(ability.key, value ?? 0)} />
              </Field>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Proficiencies" icon={<Sparkles size={16} />}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Saving Throws">
              <div className="grid grid-cols-3 gap-2 border border-white/10 bg-black/20 p-3">
                {abilityOrder.map((ability) => (
                  <label key={ability.key} className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      disabled={permissions.editReadOnly}
                      checked={draft.savingThrowProficiencies.includes(ability.key)}
                      onChange={(event) =>
                        mutators.updateField(
                          "savingThrowProficiencies",
                          event.target.checked
                            ? Array.from(new Set([...draft.savingThrowProficiencies, ability.key]))
                            : draft.savingThrowProficiencies.filter((entry) => entry !== ability.key)
                        )
                      }
                    />
                    {ability.label}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Languages">
              <textarea className={textareaClass} rows={4} disabled={permissions.editReadOnly} value={draft.languageProficiencies.join(", ")} onChange={(event) => mutators.updateField("languageProficiencies", splitCommaValues(event.target.value))} />
            </Field>
            <Field label="Tools">
              <textarea className={textareaClass} rows={4} disabled={permissions.editReadOnly} value={draft.toolProficiencies.join(", ")} onChange={(event) => mutators.updateField("toolProficiencies", splitCommaValues(event.target.value))} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Skills" icon={<Sparkles size={16} />}>
          <div className="grid gap-2 md:grid-cols-2">
            {draft.skills.map((skill, index) => {
              const skillReference = derived.skillLookup.get(normalizeKey(skill.name));

              return (
                <LazyDetails
                  key={skill.id}
                  className="group border border-white/8 bg-black/20"
                  summaryClassName="list-none cursor-pointer px-3 py-2"
                  summary={
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-zinc-100">{skill.name}</p>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{skill.ability.toUpperCase()}</p>
                      </div>
                      <span className="text-sm font-semibold text-amber-50">{formatModifier(skillTotal(derived.actorWithDerivedNumbers, skill))}</span>
                    </div>
                  }
                >
                  <div className="space-y-3 border-t border-white/8 px-3 py-3">
                    <div className="text-sm leading-6 text-zinc-400">
                      {skillReference?.description ? renderRulesText(skillReference.description) : "No imported compendium description for this skill yet."}
                    </div>
                    {skillReference?.tags.length ? <TagRow tags={skillReference.tags} /> : null}
                    <div className="flex items-center gap-3">
                      <label className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                        <input className="mr-2" disabled={permissions.editReadOnly} type="checkbox" checked={skill.proficient} onChange={(event) => mutators.updateSkill(index, { proficient: event.target.checked })} />
                        Prof
                      </label>
                      <label className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                        <input className="mr-2" disabled={permissions.editReadOnly} type="checkbox" checked={skill.expertise} onChange={(event) => mutators.updateSkill(index, { expertise: event.target.checked })} />
                        Exp
                      </label>
                    </div>
                  </div>
                </LazyDetails>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <div className="space-y-4">
        <SectionCard title="Spells & Feats" icon={<BookOpen size={16} />}>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Field label="Add Feat">
              <select className={inputClass} disabled={permissions.editReadOnly} value={featToAdd} onChange={(event) => setFeatToAdd(event.target.value)}>
                <option value="">Select a feat</option>
                {derived.filteredFeats.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </Field>
            <button type="button" className={secondaryButtonClass} disabled={permissions.editReadOnly || !featToAdd} onClick={() => addFeatById(featToAdd)}>
              Add Feat
            </button>
          </div>
          <DetailCollection
            title="Known Spells"
            headerAction={
              <button type="button" className={secondaryButtonClass} disabled={permissions.editReadOnly} onClick={() => actions.setSpellSelectionTarget("editKnown")}>
                <Plus size={14} />
                Add Spells
              </button>
            }
            entries={spellDetailEntries.known}
            emptyMessage="No spells added."
            renderText={renderRulesText}
          />
          <DetailCollection
            title="Prepared Spells"
            headerAction={
              <button type="button" className={secondaryButtonClass} disabled={permissions.editReadOnly || !derived.canPrepareSpells} onClick={() => actions.setSpellSelectionTarget("editPrepared")}>
                <Plus size={14} />
                Manage
              </button>
            }
            entries={spellDetailEntries.prepared}
            emptyMessage="No prepared spells selected."
            renderText={renderRulesText}
          />
          <DetailCollection
            title="Spellbook"
            headerAction={
              <button type="button" className={secondaryButtonClass} disabled={permissions.editReadOnly} onClick={() => actions.setSpellSelectionTarget("editSpellbook")}>
                <Plus size={14} />
                Add Spells
              </button>
            }
            entries={spellDetailEntries.spellbook}
            emptyMessage="No spellbook spells."
            renderText={renderRulesText}
          />
          <DetailCollection
            title="Always Prepared"
            headerAction={
              <button type="button" className={secondaryButtonClass} disabled={permissions.editReadOnly} onClick={() => actions.setSpellSelectionTarget("editAlwaysPrepared")}>
                <Plus size={14} />
                Add Spells
              </button>
            }
            entries={spellDetailEntries.alwaysPrepared}
            emptyMessage="No always-prepared spells."
            renderText={renderRulesText}
          />
          <DetailCollection
            title="At Will"
            headerAction={
              <button type="button" className={secondaryButtonClass} disabled={permissions.editReadOnly} onClick={() => actions.setSpellSelectionTarget("editAtWill")}>
                <Plus size={14} />
                Add Spells
              </button>
            }
            entries={spellDetailEntries.atWill}
            emptyMessage="No at-will spells."
            renderText={renderRulesText}
          />
          <DetailCollection
            title="Short Rest Spells"
            headerAction={
              <button type="button" className={secondaryButtonClass} disabled={permissions.editReadOnly} onClick={() => actions.setSpellSelectionTarget("editPerShortRest")}>
                <Plus size={14} />
                Add Spells
              </button>
            }
            entries={spellDetailEntries.perShortRest}
            emptyMessage="No short-rest spells."
            renderText={renderRulesText}
          />
          <DetailCollection
            title="Long Rest Spells"
            headerAction={
              <button type="button" className={secondaryButtonClass} disabled={permissions.editReadOnly} onClick={() => actions.setSpellSelectionTarget("editPerLongRest")}>
                <Plus size={14} />
                Add Spells
              </button>
            }
            entries={spellDetailEntries.perLongRest}
            emptyMessage="No long-rest spells."
            renderText={renderRulesText}
          />
          <DetailCollection
            title="Feats"
            entries={spellDetailEntries.feats}
            emptyMessage="No feats selected."
            renderText={renderRulesText}
          />
          <DetailCollection title="Features" entries={derived.featureRows} emptyMessage="No features available yet." renderText={renderRulesText} />
        </SectionCard>

        <SectionCard title="Combat & Gear" icon={<Swords size={16} />}>
          <DetailCollection
            title="Auto Attacks"
            entries={derived.derivedEquipment.attacks.map((attack) => ({
              id: attack.id,
              eyebrow: "Equipped Item",
              title: attack.name,
              subtitle: `${formatModifier(attack.attackBonus)} to hit`,
              description: [attack.damage ? `Damage: ${attack.damage}${attack.damageType ? ` ${attack.damageType}` : ""}` : "", attack.notes].filter(Boolean).join("\n")
            }))}
            emptyMessage="No auto-generated attacks from equipped compendium items."
            renderText={renderRulesText}
          />

          <DetailCollection
            title="Auto Armor"
            entries={derived.derivedEquipment.armorItems.map((item) => ({
              id: item.id,
              eyebrow: "Equipped Item",
              title: item.name,
              subtitle: item.kind === "shield" ? "Shield" : "Armor",
              description: item.notes,
              meta: [
                { label: "Base AC", value: String(item.armorClass) },
                { label: "Dex Cap", value: item.maxDexBonus === null ? "None" : String(item.maxDexBonus) }
              ]
            }))}
            emptyMessage="No auto-generated armor from equipped compendium items."
            renderText={renderRulesText}
          />

          <div className="space-y-3">
            {draft.attacks.map((attack, index) => (
              <div key={attack.id} className="grid gap-3 border border-white/8 bg-black/20 p-3 md:grid-cols-2">
                <Field label="Attack">
                  <input className={inputClass} disabled={permissions.editReadOnly} value={attack.name} onChange={(event) => mutators.updateAttack(index, { name: event.target.value })} />
                </Field>
                <Field label="Bonus">
                  <NumericInput className={inputClass} disabled={permissions.editReadOnly} value={attack.attackBonus} onValueChange={(value) => mutators.updateAttack(index, { attackBonus: value ?? 0 })} />
                </Field>
                <Field label="Damage">
                  <input className={inputClass} disabled={permissions.editReadOnly} value={attack.damage} onChange={(event) => mutators.updateAttack(index, { damage: event.target.value })} />
                </Field>
                <Field label="Type">
                  <input className={inputClass} disabled={permissions.editReadOnly} value={attack.damageType} onChange={(event) => mutators.updateAttack(index, { damageType: event.target.value })} />
                </Field>
                <button type="button" className={secondaryButtonClass} disabled={permissions.editReadOnly} onClick={() => mutators.removeFromArray("attacks", index)}>
                  Remove Attack
                </button>
              </div>
            ))}
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={permissions.editReadOnly}
              onClick={() =>
                mutators.updateDraft((current) => ({
                  ...current,
                  attacks: [...current.attacks, createAttackEntry()]
                }))
              }
            >
              <Plus size={14} />
              Add Attack
            </button>
          </div>

          <div className="space-y-3">
            {draft.armorItems.map((item, index) => (
              <div key={item.id} className="grid gap-3 border border-white/8 bg-black/20 p-3 md:grid-cols-2">
                <Field label="Armor">
                  <input className={inputClass} disabled={permissions.editReadOnly} value={item.name} onChange={(event) => mutators.updateArmor(index, { name: event.target.value })} />
                </Field>
                <Field label="Base AC">
                  <NumericInput className={inputClass} disabled={permissions.editReadOnly} value={item.armorClass} onValueChange={(value) => mutators.updateArmor(index, { armorClass: value ?? 0 })} />
                </Field>
                <Field label="Kind">
                  <select className={inputClass} disabled={permissions.editReadOnly} value={item.kind} onChange={(event) => mutators.updateArmor(index, { kind: event.target.value as ArmorEntry["kind"] })}>
                    <option value="armor">Armor</option>
                    <option value="shield">Shield</option>
                  </select>
                </Field>
                <label className="flex items-center gap-2 pt-7 text-sm text-zinc-300">
                  <input disabled={permissions.editReadOnly} type="checkbox" checked={item.equipped} onChange={(event) => mutators.updateArmor(index, { equipped: event.target.checked })} />
                  Equipped
                </label>
                <button type="button" className={secondaryButtonClass} disabled={permissions.editReadOnly} onClick={() => mutators.removeFromArray("armorItems", index)}>
                  Remove Armor
                </button>
              </div>
            ))}
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={permissions.editReadOnly}
              onClick={() =>
                mutators.updateDraft((current) => ({
                  ...current,
                  armorItems: [...current.armorItems, createArmorEntry()]
                }))
              }
            >
              <Plus size={14} />
              Add Armor
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Resources" icon={<Heart size={16} />}>
          <div className="space-y-3">
            {derived.displayedResources.map((resource) => {
              const resourceDefinition = derived.resourceDefinitionLookup.get(normalizeKey(resource.name));
              const resourceManagedByClassTable = resource.id.startsWith("derived:") && Boolean(resourceDefinition);

              return (
                <div key={resource.id} className="space-y-3 border border-white/8 bg-black/20 p-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Name">
                      <input
                        className={inputClass}
                        disabled={permissions.editReadOnly || resourceManagedByClassTable}
                        value={resource.name}
                        onChange={(event) => mutators.updateResourceById(resource.id, { name: event.target.value })}
                      />
                    </Field>
                    <Field label="Restore On">
                      <input
                        className={inputClass}
                        disabled={permissions.editReadOnly || resourceManagedByClassTable}
                        value={resource.resetOn}
                        onChange={(event) => mutators.updateResourceById(resource.id, { resetOn: event.target.value })}
                      />
                    </Field>
                    <Field label="Current">
                      <NumericInput className={inputClass} disabled={permissions.editReadOnly} value={resource.current} onValueChange={(value) => mutators.updateResourceById(resource.id, { current: value ?? 0 })} />
                    </Field>
                    <Field label="Max">
                      <NumericInput
                        className={inputClass}
                        disabled={permissions.editReadOnly || resourceManagedByClassTable}
                        value={resource.max}
                        onValueChange={(value) => mutators.updateResourceById(resource.id, { max: value ?? 0 })}
                      />
                    </Field>
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      disabled={permissions.editReadOnly || resourceManagedByClassTable}
                      onClick={() =>
                        mutators.updateDraft((current) => ({
                          ...current,
                          resources: current.resources.filter((entry) => entry.id !== resource.id)
                        }))
                      }
                    >
                      Remove Resource
                    </button>
                  </div>
                  {resourceDefinition ? (
                    <div className="space-y-2 text-sm text-zinc-400">
                      <p>{resourceDefinition.description}</p>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{resourceDefinition.source}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={permissions.editReadOnly}
              onClick={() =>
                mutators.updateDraft((current) => ({
                  ...current,
                  resources: [...current.resources, createResourceEntry()]
                }))
              }
            >
              <Plus size={14} />
              Add Resource
            </button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
