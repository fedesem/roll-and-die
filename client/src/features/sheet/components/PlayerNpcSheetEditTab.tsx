import { findSubclassesForClass } from "@shared/data/progression";
import { CREATURE_SIZE_OPTIONS } from "@shared/tokenGeometry";
import { type AbilityKey, type ActorBonusEntry, type ActorSheet, type ArmorEntry, TOKEN_STATUS_MARKERS } from "@shared/types";
import { BookOpen, Brain, Heart, ImagePlus, Plus, Shield, Sparkles, Swords, Trash2, Wand2 } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { SubclassPreviewCard } from "../../../components/compendium";
import { NumericInput } from "../../../components/NumericInput";
import type { GuidedSheetFlowState } from "../hooks/useGuidedSheetFlow";
import type { PlayerNpcSheetActions, PlayerNpcSheetMutators } from "../hooks/usePlayerNpcSheetController";
import type { PlayerNpcSheetDerivedState, PlayerNpcSheetPermissions } from "../hooks/usePlayerNpcSheetDerived";
import type { SheetCompendium } from "../playerNpcSheet2024Types";
import {
  createArmorEntry,
  createAttackEntry,
  createInventoryEntry,
  createResourceEntry,
  updateHitPoints
} from "../selectors/playerNpcSheet2024Mutations";
import { collectSpellRows, createReferenceRow, splitCommaValues } from "../selectors/playerNpcSheet2024Selectors";
import { abilityOrder, findCompendiumClass, formatModifier, normalizeKey, skillTotal } from "../sheetUtils";
import {
  CalloutBanner,
  DetailCollection,
  Field,
  HoverPreviewTrigger,
  inputClass,
  LazyDetails,
  SectionCard,
  SheetButton,
  SourceBadge,
  TagRow,
  textareaClass
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
  const [featureToAdd, setFeatureToAdd] = useState("");
  const [talentToAdd, setTalentToAdd] = useState("");

  const spellDetailEntries = useMemo(
    () => ({
      known: collectSpellRows(draft.spells, draft.preparedSpells, compendium.spells, derived.preparedSpellLimit).map((entry) => ({
        ...entry,
        onRemove: permissions.editReadOnly
          ? undefined
          : () =>
              mutators.updateField(
                "spells",
                draft.spells.filter((value) => value !== entry.title)
              )
      })),
      prepared: derived.spellRows
        .filter((entry) => draft.preparedSpells.includes(entry.title) || derived.spellCollections.alwaysPrepared.includes(entry.title))
        .map((entry) => ({
          ...entry,
          onRemove:
            permissions.editReadOnly || derived.spellCollections.alwaysPrepared.includes(entry.title)
              ? undefined
              : () =>
                  mutators.updateField(
                    "preparedSpells",
                    draft.preparedSpells.filter((value) => value !== entry.title)
                  )
        })),
      spellbook: collectSpellRows(draft.spellState.spellbook, draft.preparedSpells, compendium.spells, derived.preparedSpellLimit).map(
        (entry) => ({
          ...entry,
          onRemove: permissions.editReadOnly
            ? undefined
            : () =>
                mutators.updateField("spellState", {
                  ...draft.spellState,
                  spellbook: draft.spellState.spellbook.filter((value) => value !== entry.title)
                })
        })
      ),
      alwaysPrepared: collectSpellRows(
        draft.spellState.alwaysPrepared,
        draft.preparedSpells,
        compendium.spells,
        derived.preparedSpellLimit
      ).map((entry) => ({
        ...entry,
        onRemove: permissions.editReadOnly
          ? undefined
          : () =>
              mutators.updateField("spellState", {
                ...draft.spellState,
                alwaysPrepared: draft.spellState.alwaysPrepared.filter((value) => value !== entry.title)
              })
      })),
      atWill: collectSpellRows(draft.spellState.atWill, draft.preparedSpells, compendium.spells, derived.preparedSpellLimit).map(
        (entry) => ({
          ...entry,
          onRemove: permissions.editReadOnly
            ? undefined
            : () =>
                mutators.updateField("spellState", {
                  ...draft.spellState,
                  atWill: draft.spellState.atWill.filter((value) => value !== entry.title)
                })
        })
      ),
      perShortRest: collectSpellRows(
        draft.spellState.perShortRest,
        draft.preparedSpells,
        compendium.spells,
        derived.preparedSpellLimit
      ).map((entry) => ({
        ...entry,
        onRemove: permissions.editReadOnly
          ? undefined
          : () =>
              mutators.updateField("spellState", {
                ...draft.spellState,
                perShortRest: draft.spellState.perShortRest.filter((value) => value !== entry.title)
              })
      })),
      perLongRest: collectSpellRows(draft.spellState.perLongRest, draft.preparedSpells, compendium.spells, derived.preparedSpellLimit).map(
        (entry) => ({
          ...entry,
          onRemove: permissions.editReadOnly
            ? undefined
            : () =>
                mutators.updateField("spellState", {
                  ...draft.spellState,
                  perLongRest: draft.spellState.perLongRest.filter((value) => value !== entry.title)
                })
        })
      ),
      feats: derived.featRows.map((entry) => ({
        ...entry,
        onRemove: permissions.editReadOnly
          ? undefined
          : () =>
              mutators.updateField(
                "feats",
                draft.feats.filter((value) => value !== entry.title)
              )
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

  function addTextEntry(key: "features" | "talents", value: string, clear: () => void) {
    const normalized = value.trim();
    if (!normalized) return;
    mutators.updateField(key, Array.from(new Set([...draft[key], normalized])));
    clear();
  }

  function removeAwardedText(kind: "feature" | "feat" | "talent", value: string) {
    mutators.updateDraft((current) => {
      const targetEffect = current.build?.awards
        ?.flatMap((award) => award.effects)
        .find((effect) => effect.kind === kind && normalizeKey(effect.ref.split("|")[0] ?? effect.ref) === normalizeKey(value));
      const build = current.build;
      return {
        ...current,
        [kind === "feat" ? "feats" : kind === "talent" ? "talents" : "features"]: current[
          kind === "feat" ? "feats" : kind === "talent" ? "talents" : "features"
        ].filter((entry) => normalizeKey(entry) !== normalizeKey(value)),
        build:
          build && targetEffect && !(build.overrides ?? []).some((entry) => entry.targetEffectId === targetEffect.id)
            ? {
                ...build,
                schemaVersion: 2,
                overrides: [
                  ...(build.overrides ?? []),
                  {
                    id: crypto.randomUUID(),
                    operation: "suppress",
                    targetEffectId: targetEffect.id,
                    notes: `Suppressed ${value} in the sheet editor.`
                  }
                ]
              }
            : build
      };
    });
  }

  function addBonus() {
    const bonus: ActorBonusEntry = {
      id: crypto.randomUUID(),
      name: "",
      sourceType: "buff",
      targetType: "armorClass",
      targetKey: "",
      value: 0,
      enabled: true
    };
    mutators.updateField("bonuses", [...draft.bonuses, bonus]);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr,1fr]">
      <div className="space-y-4">
        {/* EDIT CONTROLS */}
        <SectionCard title="Edit Controls" icon={<Sparkles size={16} />}>
          <div className="flex flex-wrap items-center gap-3">
            {permissions.needsInitialGuidedSetup ? (
              <SheetButton variant="magical" size="md" icon={<Wand2 size={15} />} onClick={() => guided.openGuidedFlow("setup")}>
                Open Setup Guide
              </SheetButton>
            ) : null}
            <SheetButton
              variant="magical"
              size="md"
              icon={<Sparkles size={15} />}
              disabled={draft.classes.length === 0}
              onClick={() => guided.openGuidedFlow("levelup")}
            >
              Level Up
            </SheetButton>
            {permissions.canEdit ? (
              <SheetButton variant="primary" size="md" disabled={derived.saving} onClick={() => void actions.saveCurrent()}>
                {derived.saving ? "Saving…" : "Save Changes"}
              </SheetButton>
            ) : null}
          </div>
          <CalloutBanner variant="amber" icon={<Sparkles size={16} />}>
            The edit tab stays fully editable. The setup and level-up guides add structured species, background, class, spell, feat, and
            feature choices on top of manual edits.
          </CalloutBanner>
        </SectionCard>

        {/* BUILD SUMMARY */}
        <SectionCard title="Build Summary" icon={<Sparkles size={16} />}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Species">
              <select
                className={inputClass}
                disabled={permissions.editReadOnly}
                value={draft.build?.speciesId ?? ""}
                onChange={(event) => guided.applySpecies(event.target.value)}
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
                disabled={permissions.editReadOnly}
                value={draft.build?.backgroundId ?? ""}
                onChange={(event) => guided.applyBackground(event.target.value)}
              >
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
                  entries={[
                    createReferenceRow("Species", derived.selectedSpecies, [
                      { label: "Speed", value: `${derived.selectedSpecies.speed} ft` }
                    ])
                  ]}
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">Classes & Levels</p>
            {draft.classes.map((actorClass, index) => {
              const classEntry = findCompendiumClass(actorClass, compendium.classes);

              return (
                <div key={actorClass.id} className="space-y-3 rounded-md border border-white/10 bg-slate-900/70 p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                        {classEntry?.name || "Custom Class"}
                      </span>
                      {classEntry?.hitDieFaces ? (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/20">
                          d{classEntry.hitDieFaces} Hit Die
                        </span>
                      ) : null}
                      {classEntry?.source ? <SourceBadge source={classEntry.source} /> : null}
                    </div>
                    {draft.classes.length > 1 ? (
                      <SheetButton
                        variant="danger"
                        size="sm"
                        icon={<Trash2 size={12} />}
                        disabled={permissions.editReadOnly}
                        onClick={() => mutators.removeFromArray("classes", index)}
                      >
                        Remove
                      </SheetButton>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Class">
                      <select
                        className={inputClass}
                        disabled={permissions.editReadOnly}
                        value={actorClass.compendiumId}
                        onChange={(event) => guided.applyClass(event.target.value, actorClass.id)}
                      >
                        <option value="">Select a class</option>
                        {compendium.classes.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Level">
                      <NumericInput
                        className={inputClass}
                        min={1}
                        value={actorClass.level}
                        disabled={permissions.editReadOnly}
                        onValueChange={(value) => mutators.updateClass(index, { level: value ?? 1 })}
                      />
                    </Field>
                  </div>

                  {(() => {
                    if (!classEntry) return null;
                    const fromCompendium = classEntry.subclasses ?? [];
                    const fromProgression = findSubclassesForClass(classEntry.name).map((sub) => ({
                      id: sub.id,
                      name: sub.name,
                      shortName: sub.name,
                      source: sub.source,
                      className: classEntry.name,
                      classSource: classEntry.source,
                      description: "",
                      features: []
                    }));
                    const combined = [...fromCompendium];
                    for (const sub of fromProgression) {
                      if (!combined.some((existing) => existing.id === sub.id || existing.name.toLowerCase() === sub.name.toLowerCase())) {
                        combined.push(sub);
                      }
                    }
                    const threshold = classEntry.subclassLevel ?? 3;
                    if (combined.length === 0 || actorClass.level < threshold) return null;

                    const selectedSub = combined.find(
                      (s) =>
                        s.id.toLowerCase() === (actorClass.subclassId ?? "").toLowerCase() ||
                        s.name.toLowerCase() === (actorClass.subclassId ?? "").toLowerCase()
                    );
                    const compDef = classEntry.subclasses.find(
                      (s) =>
                        s.id.toLowerCase() === (actorClass.subclassId ?? "").toLowerCase() ||
                        s.name.toLowerCase() === (actorClass.subclassId ?? "").toLowerCase()
                    );
                    const progDef = findSubclassesForClass(classEntry.name).find(
                      (s) =>
                        s.id.toLowerCase() === (actorClass.subclassId ?? "").toLowerCase() ||
                        s.name.toLowerCase() === (actorClass.subclassId ?? "").toLowerCase()
                    );
                    const combinedFeatures = [...(compDef?.features ?? [])];
                    const fullSubclassModel = selectedSub
                      ? {
                          id: selectedSub.id,
                          name: selectedSub.name,
                          source: selectedSub.source || compDef?.source || classEntry.source,
                          className: classEntry.name,
                          classSource: classEntry.source,
                          description: compDef?.description || selectedSub.description || "",
                          features: combinedFeatures,
                          levels: progDef?.levels
                        }
                      : null;

                    return (
                      <Field label={`Subclass (Level ${threshold}+)`}>
                        <div className="space-y-2">
                          <select
                            className={inputClass}
                            disabled={permissions.editReadOnly}
                            value={actorClass.subclassId ?? ""}
                            onChange={(event) => guided.applySubclass(actorClass.id, event.target.value)}
                          >
                            <option value="">Select a subclass</option>
                            {combined.map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.name} ({entry.source || "2024 PHB"})
                              </option>
                            ))}
                          </select>
                          {fullSubclassModel ? (
                            <HoverPreviewTrigger
                              label="Subclass Details"
                              caption={fullSubclassModel.name}
                              emptyMessage=""
                              preview={
                                <SubclassPreviewCard
                                  subclass={fullSubclassModel}
                                  className={classEntry.name}
                                  spellEntries={compendium.spells}
                                  featEntries={compendium.feats}
                                  classEntries={compendium.classes}
                                  variantRuleEntries={compendium.variantRules}
                                  conditionEntries={compendium.conditions}
                                  itemEntries={compendium.items}
                                  optionalFeatureEntries={compendium.optionalFeatures}
                                  skillEntries={compendium.skills}
                                  languageEntries={compendium.languages}
                                  raceEntries={compendium.races}
                                  backgroundEntries={compendium.backgrounds}
                                />
                              }
                            />
                          ) : null}
                        </div>
                      </Field>
                    );
                  })()}

                  {classEntry ? (
                    <DetailCollection
                      entries={[
                        {
                          id: classEntry.id,
                          eyebrow: "Class Reference",
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

            <SheetButton
              variant="secondary"
              size="sm"
              icon={<Plus size={14} />}
              disabled={permissions.editReadOnly}
              onClick={() => {
                const firstClass = compendium.classes[0];
                if (!firstClass) return;
                guided.applyClass(firstClass.id);
              }}
            >
              Add Class
            </SheetButton>
          </div>
        </SectionCard>

        {/* IDENTITY & STATS */}
        <SectionCard title="Identity & Stats" icon={<Brain size={16} />}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Name">
              <input
                className={inputClass}
                disabled={permissions.editReadOnly}
                value={draft.name}
                onChange={(event) => mutators.updateField("name", event.target.value)}
              />
            </Field>
            <Field label="Alignment">
              <input
                className={inputClass}
                disabled={permissions.editReadOnly}
                value={draft.alignment}
                onChange={(event) => mutators.updateField("alignment", event.target.value)}
              />
            </Field>
            <Field label="Experience">
              <NumericInput
                className={inputClass}
                min={0}
                disabled={permissions.editReadOnly}
                value={draft.experience}
                onValueChange={(value) => mutators.updateField("experience", value ?? 0)}
              />
            </Field>
            <Field label="Spellcasting Ability">
              <select
                className={inputClass}
                disabled={permissions.editReadOnly}
                value={draft.spellcastingAbility}
                onChange={(event) => mutators.updateField("spellcastingAbility", event.target.value as AbilityKey)}
              >
                {abilityOrder.map((ability) => (
                  <option key={ability.key} value={ability.key}>
                    {ability.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Armor Class">
              <NumericInput
                className={inputClass}
                min={0}
                disabled={permissions.editReadOnly}
                value={draft.armorClass}
                onValueChange={(value) => mutators.updateField("armorClass", value ?? 0)}
              />
            </Field>
            <Field label="Proficiency Bonus">
              <NumericInput
                className={inputClass}
                min={0}
                disabled={permissions.editReadOnly}
                value={draft.proficiencyBonus}
                onValueChange={(value) => mutators.updateField("proficiencyBonus", value ?? 0)}
              />
            </Field>
            <Field label="Vision Range (Squares)">
              <NumericInput
                className={inputClass}
                disabled={permissions.editReadOnly}
                value={draft.visionRange}
                onValueChange={(value) => mutators.updateField("visionRange", value ?? 0)}
              />
            </Field>
            <Field label="Creature Size">
              <select
                className={inputClass}
                disabled={permissions.editReadOnly}
                value={draft.creatureSize}
                onChange={(event) => mutators.updateField("creatureSize", event.target.value as ActorSheet["creatureSize"])}
              >
                {CREATURE_SIZE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Portrait Image">
              <label
                className={`flex items-center justify-center gap-2 rounded-md border border-dashed border-white/15 bg-slate-900/60 px-3 py-2.5 text-xs text-zinc-300 transition ${
                  permissions.editReadOnly
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer hover:border-amber-500/70 hover:bg-slate-850 hover:text-amber-50"
                }`}
              >
                <ImagePlus size={15} />
                Upload Portrait
                <input
                  className="hidden"
                  disabled={permissions.editReadOnly}
                  type="file"
                  accept="image/*"
                  onChange={(event) => void actions.handleImageUpload(event)}
                />
              </label>
            </Field>
            <Field label="Token Color">
              <div className="flex items-center gap-2">
                <input
                  className="h-9 w-12 cursor-pointer rounded border border-white/10 bg-transparent p-0.5"
                  disabled={permissions.editReadOnly}
                  type="color"
                  value={draft.color}
                  onChange={(event) => mutators.updateField("color", event.target.value)}
                />
                <input
                  className={inputClass}
                  disabled={permissions.editReadOnly}
                  value={draft.color}
                  onChange={(event) => mutators.updateField("color", event.target.value)}
                />
              </div>
            </Field>
          </div>

          {derived.imageError ? <p className="text-xs font-semibold text-rose-300">{derived.imageError}</p> : null}

          {/* COMBAT QUICK NUMBERS */}
          <div className="space-y-1.5 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">Hit Points & Movement</p>
            <div className="grid gap-2.5 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              <Field label="Current HP">
                <NumericInput
                  className={inputClass}
                  value={draft.hitPoints.current}
                  disabled={permissions.editReadOnly}
                  onValueChange={(value) => updateHitPoints("current", String(value ?? 0), mutators.updateDraft, draft.hitPoints.max)}
                />
              </Field>
              <Field label="Temp HP">
                <NumericInput
                  className={inputClass}
                  value={draft.hitPoints.temp}
                  disabled={permissions.editReadOnly}
                  onValueChange={(value) => updateHitPoints("temp", String(value ?? 0), mutators.updateDraft, draft.hitPoints.max)}
                />
              </Field>
              <Field label="Max HP">
                <NumericInput
                  className={inputClass}
                  value={draft.hitPoints.max}
                  disabled={permissions.editReadOnly}
                  onValueChange={(value) => mutators.updateHitPointMax(value ?? 0)}
                />
              </Field>
              <Field label="Reduced Max HP">
                <NumericInput
                  className={inputClass}
                  value={draft.hitPoints.reducedMax}
                  disabled={permissions.editReadOnly}
                  onValueChange={(value) => updateHitPoints("reducedMax", String(value ?? 0), mutators.updateDraft, draft.hitPoints.max)}
                />
              </Field>
              <Field label="Speed (ft)">
                <NumericInput
                  className={inputClass}
                  value={draft.speed}
                  disabled={permissions.editReadOnly}
                  onValueChange={(value) => mutators.updateField("speed", value ?? 0)}
                />
              </Field>
              <Field label="Initiative Bonus">
                <NumericInput
                  className={inputClass}
                  disabled={permissions.editReadOnly}
                  value={draft.initiative}
                  onValueChange={(value) => mutators.updateField("initiative", value ?? 0)}
                />
              </Field>
            </div>
          </div>

          {/* ABILITY SCORES GRID */}
          <div className="space-y-1.5 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">Ability Scores</p>
            <div className="grid gap-2.5 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              {abilityOrder.map((ability) => (
                <Field key={ability.key} label={ability.label}>
                  <NumericInput
                    className={inputClass}
                    disabled={permissions.editReadOnly}
                    value={draft.abilities[ability.key]}
                    onValueChange={(value) => mutators.updateAbility(ability.key, value ?? 0)}
                  />
                </Field>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* PROFICIENCIES */}
        <SectionCard title="Proficiencies" icon={<Shield size={16} />}>
          <div className="space-y-3">
            <Field label="Saving Throws">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-md border border-white/10 bg-slate-900/60 p-3">
                {abilityOrder.map((ability) => {
                  const isChecked = draft.savingThrowProficiencies.includes(ability.key);
                  return (
                    <label
                      key={ability.key}
                      className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-xs transition cursor-pointer ${
                        isChecked
                          ? "border border-amber-500/40 bg-amber-500/15 text-amber-100 font-semibold"
                          : "border border-white/5 bg-slate-950/40 text-zinc-300 hover:border-white/20"
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={permissions.editReadOnly}
                        checked={isChecked}
                        onChange={(event) =>
                          mutators.updateField(
                            "savingThrowProficiencies",
                            event.target.checked
                              ? Array.from(new Set([...draft.savingThrowProficiencies, ability.key]))
                              : draft.savingThrowProficiencies.filter((entry) => entry !== ability.key)
                          )
                        }
                        className="accent-amber-500 rounded"
                      />
                      {ability.label}
                    </label>
                  );
                })}
              </div>
            </Field>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Languages">
                <textarea
                  className={textareaClass}
                  rows={3}
                  disabled={permissions.editReadOnly}
                  value={draft.languageProficiencies.join(", ")}
                  onChange={(event) => mutators.updateField("languageProficiencies", splitCommaValues(event.target.value))}
                />
              </Field>
              <Field label="Tools">
                <textarea
                  className={textareaClass}
                  rows={3}
                  disabled={permissions.editReadOnly}
                  value={draft.toolProficiencies.join(", ")}
                  onChange={(event) => mutators.updateField("toolProficiencies", splitCommaValues(event.target.value))}
                />
              </Field>
              <Field label="Armor Training">
                <textarea
                  className={textareaClass}
                  rows={3}
                  disabled={permissions.editReadOnly}
                  value={draft.armorProficiencies.join(", ")}
                  onChange={(event) => mutators.updateField("armorProficiencies", splitCommaValues(event.target.value))}
                />
              </Field>
              <Field label="Weapon Proficiencies">
                <textarea
                  className={textareaClass}
                  rows={3}
                  disabled={permissions.editReadOnly}
                  value={draft.weaponProficiencies.join(", ")}
                  onChange={(event) => mutators.updateField("weaponProficiencies", splitCommaValues(event.target.value))}
                />
              </Field>
            </div>
          </div>
        </SectionCard>

        {/* SKILLS */}
        <SectionCard title="Skills" icon={<Sparkles size={16} />}>
          <div className="grid gap-2 md:grid-cols-2">
            {draft.skills.map((skill, index) => {
              const skillReference = derived.skillLookup.get(normalizeKey(skill.name));

              return (
                <LazyDetails
                  key={skill.id}
                  className="group rounded-md border border-white/8 bg-slate-900/60 transition hover:border-white/15"
                  summaryClassName="list-none cursor-pointer px-3.5 py-2.5"
                  summary={
                    <div className="flex items-center justify-between gap-3 select-none">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-zinc-100 group-hover:text-amber-50">{skill.name}</p>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">{skill.ability.toUpperCase()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {skill.expertise ? (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                            EXP
                          </span>
                        ) : skill.proficient ? (
                          <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-300">
                            PROF
                          </span>
                        ) : null}
                        <span className="text-sm font-bold text-amber-50">
                          {formatModifier(skillTotal(derived.actorWithDerivedNumbers, skill))}
                        </span>
                      </div>
                    </div>
                  }
                >
                  <div className="space-y-3 border-t border-white/8 px-3.5 py-3 bg-black/20">
                    <div className="text-xs leading-relaxed text-zinc-300">
                      {skillReference?.description
                        ? renderRulesText(skillReference.description)
                        : "No imported compendium description for this skill yet."}
                    </div>
                    {skillReference?.tags.length ? <TagRow tags={skillReference.tags} /> : null}
                    <div className="flex items-center gap-4 pt-1">
                      <label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-300 cursor-pointer">
                        <input
                          disabled={permissions.editReadOnly}
                          type="checkbox"
                          checked={skill.proficient}
                          onChange={(event) => mutators.updateSkill(index, { proficient: event.target.checked })}
                          className="accent-amber-500 rounded"
                        />
                        Proficient
                      </label>
                      <label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-300 cursor-pointer">
                        <input
                          disabled={permissions.editReadOnly}
                          type="checkbox"
                          checked={skill.expertise}
                          onChange={(event) => mutators.updateSkill(index, { expertise: event.target.checked })}
                          className="accent-amber-500 rounded"
                        />
                        Expertise
                      </label>
                    </div>
                  </div>
                </LazyDetails>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* RIGHT COLUMN */}
      <div className="space-y-4">
        {/* SPELLS & FEATS */}
        <SectionCard title="Spells & Feats" icon={<BookOpen size={16} />}>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Field label="Add Feat">
              <select
                className={inputClass}
                disabled={permissions.editReadOnly}
                value={featToAdd}
                onChange={(event) => setFeatToAdd(event.target.value)}
              >
                <option value="">Select a feat</option>
                {derived.filteredFeats.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <SheetButton
                variant="secondary"
                size="md"
                disabled={permissions.editReadOnly || !featToAdd}
                onClick={() => addFeatById(featToAdd)}
              >
                Add Feat
              </SheetButton>
            </div>
          </div>

          <DetailCollection
            title="Known Spells"
            headerAction={
              <SheetButton
                variant="secondary"
                size="sm"
                icon={<Plus size={13} />}
                disabled={permissions.editReadOnly}
                onClick={() => actions.setSpellSelectionTarget("editKnown")}
              >
                Add Spells
              </SheetButton>
            }
            entries={spellDetailEntries.known}
            emptyMessage="No spells added."
            renderText={renderRulesText}
          />
          <DetailCollection
            title="Prepared Spells"
            headerAction={
              <SheetButton
                variant="secondary"
                size="sm"
                icon={<Plus size={13} />}
                disabled={permissions.editReadOnly || !derived.canPrepareSpells}
                onClick={() => actions.setSpellSelectionTarget("editPrepared")}
              >
                Manage
              </SheetButton>
            }
            entries={spellDetailEntries.prepared}
            emptyMessage="No prepared spells selected."
            renderText={renderRulesText}
          />
          <DetailCollection
            title="Spellbook"
            headerAction={
              <SheetButton
                variant="secondary"
                size="sm"
                icon={<Plus size={13} />}
                disabled={permissions.editReadOnly}
                onClick={() => actions.setSpellSelectionTarget("editSpellbook")}
              >
                Add Spells
              </SheetButton>
            }
            entries={spellDetailEntries.spellbook}
            emptyMessage="No spellbook spells."
            renderText={renderRulesText}
          />
          <DetailCollection
            title="Always Prepared"
            headerAction={
              <SheetButton
                variant="secondary"
                size="sm"
                icon={<Plus size={13} />}
                disabled={permissions.editReadOnly}
                onClick={() => actions.setSpellSelectionTarget("editAlwaysPrepared")}
              >
                Add Spells
              </SheetButton>
            }
            entries={spellDetailEntries.alwaysPrepared}
            emptyMessage="No always-prepared spells."
            renderText={renderRulesText}
          />
          <DetailCollection
            title="At Will"
            headerAction={
              <SheetButton
                variant="secondary"
                size="sm"
                icon={<Plus size={13} />}
                disabled={permissions.editReadOnly}
                onClick={() => actions.setSpellSelectionTarget("editAtWill")}
              >
                Add Spells
              </SheetButton>
            }
            entries={spellDetailEntries.atWill}
            emptyMessage="No at-will spells."
            renderText={renderRulesText}
          />
          <DetailCollection
            title="Short Rest Spells"
            headerAction={
              <SheetButton
                variant="secondary"
                size="sm"
                icon={<Plus size={13} />}
                disabled={permissions.editReadOnly}
                onClick={() => actions.setSpellSelectionTarget("editPerShortRest")}
              >
                Add Spells
              </SheetButton>
            }
            entries={spellDetailEntries.perShortRest}
            emptyMessage="No short-rest spells."
            renderText={renderRulesText}
          />
          <DetailCollection
            title="Long Rest Spells"
            headerAction={
              <SheetButton
                variant="secondary"
                size="sm"
                icon={<Plus size={13} />}
                disabled={permissions.editReadOnly}
                onClick={() => actions.setSpellSelectionTarget("editPerLongRest")}
              >
                Add Spells
              </SheetButton>
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

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Field label="Add Custom Feature">
              <input
                className={inputClass}
                disabled={permissions.editReadOnly}
                value={featureToAdd}
                onChange={(event) => setFeatureToAdd(event.target.value)}
              />
            </Field>
            <div className="flex items-end">
              <SheetButton
                variant="secondary"
                size="md"
                disabled={permissions.editReadOnly || !featureToAdd.trim()}
                onClick={() => addTextEntry("features", featureToAdd, () => setFeatureToAdd(""))}
              >
                <Plus size={13} /> Add
              </SheetButton>
            </div>
          </div>
          <DetailCollection
            title="Features"
            entries={derived.featureRows.map((entry) => ({
              ...entry,
              onRemove: permissions.editReadOnly
                ? undefined
                : () => removeAwardedText(entry.eyebrow === "Feat" ? "feat" : "feature", entry.title)
            }))}
            emptyMessage="No features available yet."
            renderText={renderRulesText}
          />

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Field label="Add Talent">
              <input
                className={inputClass}
                disabled={permissions.editReadOnly}
                value={talentToAdd}
                onChange={(event) => setTalentToAdd(event.target.value)}
              />
            </Field>
            <div className="flex items-end">
              <SheetButton
                variant="secondary"
                size="md"
                disabled={permissions.editReadOnly || !talentToAdd.trim()}
                onClick={() => addTextEntry("talents", talentToAdd, () => setTalentToAdd(""))}
              >
                <Plus size={13} /> Add
              </SheetButton>
            </div>
          </div>
          <DetailCollection
            title="Talents"
            entries={draft.talents.map((talent) => ({
              id: `talent:${talent}`,
              eyebrow: "Talent",
              title: talent,
              onRemove: permissions.editReadOnly ? undefined : () => removeAwardedText("talent", talent)
            }))}
            emptyMessage="No talents added."
            renderText={renderRulesText}
          />
        </SectionCard>

        {/* COMBAT & GEAR */}
        <SectionCard title="Combat & Gear" icon={<Swords size={16} />}>
          <DetailCollection
            title="Auto Attacks"
            entries={derived.derivedEquipment.attacks.map((attack) => ({
              id: attack.id,
              eyebrow: "Equipped Item",
              title: attack.name,
              subtitle: `${formatModifier(attack.attackBonus)} to hit`,
              description: [
                attack.damage ? `Damage: ${attack.damage}${attack.damageType ? ` ${attack.damageType}` : ""}` : "",
                attack.notes
              ]
                .filter(Boolean)
                .join("\n")
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">Custom Attacks</p>
            {draft.attacks.map((attack, index) => (
              <div key={attack.id} className="space-y-2.5 rounded-md border border-white/10 bg-slate-900/70 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">{attack.name || `Attack ${index + 1}`}</span>
                  <SheetButton
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={12} />}
                    disabled={permissions.editReadOnly}
                    onClick={() => mutators.removeFromArray("attacks", index)}
                  >
                    Remove
                  </SheetButton>
                </div>
                <div className="grid gap-2.5 md:grid-cols-2">
                  <Field label="Attack Name">
                    <input
                      className={inputClass}
                      disabled={permissions.editReadOnly}
                      value={attack.name}
                      onChange={(event) => mutators.updateAttack(index, { name: event.target.value })}
                    />
                  </Field>
                  <Field label="Attack Bonus">
                    <NumericInput
                      className={inputClass}
                      disabled={permissions.editReadOnly}
                      value={attack.attackBonus}
                      onValueChange={(value) => mutators.updateAttack(index, { attackBonus: value ?? 0 })}
                    />
                  </Field>
                  <Field label="Damage Formula">
                    <input
                      className={inputClass}
                      disabled={permissions.editReadOnly}
                      value={attack.damage}
                      onChange={(event) => mutators.updateAttack(index, { damage: event.target.value })}
                    />
                  </Field>
                  <Field label="Damage Type">
                    <input
                      className={inputClass}
                      disabled={permissions.editReadOnly}
                      value={attack.damageType}
                      onChange={(event) => mutators.updateAttack(index, { damageType: event.target.value })}
                    />
                  </Field>
                </div>
              </div>
            ))}
            <SheetButton
              variant="secondary"
              size="sm"
              icon={<Plus size={14} />}
              disabled={permissions.editReadOnly}
              onClick={() =>
                mutators.updateDraft((current) => ({
                  ...current,
                  attacks: [...current.attacks, createAttackEntry()]
                }))
              }
            >
              Add Attack
            </SheetButton>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">Custom Armor</p>
            {draft.armorItems.map((item, index) => (
              <div key={item.id} className="space-y-2.5 rounded-md border border-white/10 bg-slate-900/70 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">{item.name || `Armor ${index + 1}`}</span>
                  <SheetButton
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={12} />}
                    disabled={permissions.editReadOnly}
                    onClick={() => mutators.removeFromArray("armorItems", index)}
                  >
                    Remove
                  </SheetButton>
                </div>
                <div className="grid gap-2.5 md:grid-cols-2">
                  <Field label="Armor Name">
                    <input
                      className={inputClass}
                      disabled={permissions.editReadOnly}
                      value={item.name}
                      onChange={(event) => mutators.updateArmor(index, { name: event.target.value })}
                    />
                  </Field>
                  <Field label="Base AC">
                    <NumericInput
                      className={inputClass}
                      disabled={permissions.editReadOnly}
                      value={item.armorClass}
                      onValueChange={(value) => mutators.updateArmor(index, { armorClass: value ?? 0 })}
                    />
                  </Field>
                  <Field label="Armor Kind">
                    <select
                      className={inputClass}
                      disabled={permissions.editReadOnly}
                      value={item.kind}
                      onChange={(event) => mutators.updateArmor(index, { kind: event.target.value as ArmorEntry["kind"] })}
                    >
                      <option value="armor">Armor</option>
                      <option value="shield">Shield</option>
                    </select>
                  </Field>
                  <label className="flex items-center gap-2 pt-6 text-xs text-zinc-300 cursor-pointer">
                    <input
                      disabled={permissions.editReadOnly}
                      type="checkbox"
                      checked={item.equipped}
                      onChange={(event) => mutators.updateArmor(index, { equipped: event.target.checked })}
                      className="accent-amber-500 rounded"
                    />
                    Equipped on actor
                  </label>
                </div>
              </div>
            ))}
            <SheetButton
              variant="secondary"
              size="sm"
              icon={<Plus size={14} />}
              disabled={permissions.editReadOnly}
              onClick={() =>
                mutators.updateDraft((current) => ({
                  ...current,
                  armorItems: [...current.armorItems, createArmorEntry()]
                }))
              }
            >
              Add Armor
            </SheetButton>
          </div>
        </SectionCard>

        {/* INVENTORY, BONUSES & STATUS */}
        <SectionCard title="Inventory, Bonuses & Status" icon={<Sparkles size={16} />}>
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">Inventory Items</p>
            {draft.inventory.map((item, index) => (
              <div key={item.id} className="space-y-2.5 rounded-md border border-white/10 bg-slate-900/70 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">{item.name || `Item ${index + 1}`}</span>
                  <SheetButton
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={12} />}
                    disabled={permissions.editReadOnly}
                    onClick={() => mutators.removeFromArray("inventory", index)}
                  >
                    Remove
                  </SheetButton>
                </div>
                <div className="grid gap-2.5 md:grid-cols-2">
                  <Field label="Item Name">
                    <input
                      className={inputClass}
                      disabled={permissions.editReadOnly}
                      value={item.name}
                      onChange={(event) => mutators.updateInventory(index, { name: event.target.value })}
                    />
                  </Field>
                  <Field label="Quantity">
                    <NumericInput
                      className={inputClass}
                      min={0}
                      disabled={permissions.editReadOnly}
                      value={item.quantity}
                      onValueChange={(value) => mutators.updateInventory(index, { quantity: value ?? 0 })}
                    />
                  </Field>
                  <Field label="Weight (lbs)">
                    <NumericInput
                      className={inputClass}
                      min={0}
                      disabled={permissions.editReadOnly}
                      value={item.weight ?? 0}
                      onValueChange={(value) => mutators.updateInventory(index, { weight: value ?? 0 })}
                    />
                  </Field>
                  <Field label="Type">
                    <select
                      className={inputClass}
                      disabled={permissions.editReadOnly}
                      value={item.type}
                      onChange={(event) => mutators.updateInventory(index, { type: event.target.value as typeof item.type })}
                    >
                      <option value="gear">Gear</option>
                      <option value="consumable">Consumable</option>
                      <option value="reagent">Reagent</option>
                      <option value="loot">Loot</option>
                    </select>
                  </Field>
                  <Field label="Notes">
                    <input
                      className={inputClass}
                      disabled={permissions.editReadOnly}
                      value={item.notes}
                      onChange={(event) => mutators.updateInventory(index, { notes: event.target.value })}
                    />
                  </Field>
                  <div className="flex items-center gap-4 pt-6 text-xs text-zinc-300">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={permissions.editReadOnly}
                        checked={item.equipped}
                        onChange={(event) => mutators.updateInventory(index, { equipped: event.target.checked })}
                        className="accent-amber-500 rounded"
                      />
                      Equipped
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={permissions.editReadOnly}
                        checked={item.attuned ?? false}
                        onChange={(event) => mutators.updateInventory(index, { attuned: event.target.checked })}
                        className="accent-amber-500 rounded"
                      />
                      Attuned
                    </label>
                  </div>
                </div>
              </div>
            ))}
            <SheetButton
              variant="secondary"
              size="sm"
              icon={<Plus size={14} />}
              disabled={permissions.editReadOnly}
              onClick={() => mutators.updateField("inventory", [...draft.inventory, createInventoryEntry()])}
            >
              Add Item
            </SheetButton>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">Active Bonuses</p>
            {draft.bonuses.map((bonus, index) => (
              <div key={bonus.id} className="space-y-2.5 rounded-md border border-white/10 bg-slate-900/70 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">{bonus.name || `Bonus ${index + 1}`}</span>
                  <SheetButton
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={12} />}
                    disabled={permissions.editReadOnly}
                    onClick={() =>
                      mutators.updateField(
                        "bonuses",
                        draft.bonuses.filter((_, entryIndex) => entryIndex !== index)
                      )
                    }
                  >
                    Remove
                  </SheetButton>
                </div>
                <div className="grid gap-2.5 md:grid-cols-2">
                  <Field label="Bonus Name">
                    <input
                      className={inputClass}
                      disabled={permissions.editReadOnly}
                      value={bonus.name}
                      onChange={(event) =>
                        mutators.updateDraft((current) => ({
                          ...current,
                          bonuses: current.bonuses.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, name: event.target.value } : entry
                          )
                        }))
                      }
                    />
                  </Field>
                  <Field label="Target Type">
                    <select
                      className={inputClass}
                      disabled={permissions.editReadOnly}
                      value={bonus.targetType}
                      onChange={(event) =>
                        mutators.updateDraft((current) => ({
                          ...current,
                          bonuses: current.bonuses.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, targetType: event.target.value as ActorBonusEntry["targetType"] } : entry
                          )
                        }))
                      }
                    >
                      <option value="armorClass">Armor Class</option>
                      <option value="speed">Speed</option>
                      <option value="ability">Ability</option>
                      <option value="skill">Skill</option>
                      <option value="savingThrow">Saving Throw</option>
                    </select>
                  </Field>
                  <Field label="Target Key">
                    <input
                      className={inputClass}
                      disabled={permissions.editReadOnly}
                      value={bonus.targetKey}
                      onChange={(event) =>
                        mutators.updateDraft((current) => ({
                          ...current,
                          bonuses: current.bonuses.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, targetKey: event.target.value } : entry
                          )
                        }))
                      }
                    />
                  </Field>
                  <Field label="Value">
                    <NumericInput
                      className={inputClass}
                      disabled={permissions.editReadOnly}
                      value={bonus.value}
                      onValueChange={(value) =>
                        mutators.updateDraft((current) => ({
                          ...current,
                          bonuses: current.bonuses.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, value: value ?? 0 } : entry
                          )
                        }))
                      }
                    />
                  </Field>
                </div>
                <label className="flex items-center gap-2 pt-1 text-xs text-zinc-300 cursor-pointer">
                  <input
                    className="accent-amber-500 rounded"
                    type="checkbox"
                    disabled={permissions.editReadOnly}
                    checked={bonus.enabled}
                    onChange={(event) =>
                      mutators.updateDraft((current) => ({
                        ...current,
                        bonuses: current.bonuses.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, enabled: event.target.checked } : entry
                        )
                      }))
                    }
                  />
                  Bonus is enabled and applied to stats
                </label>
              </div>
            ))}
            <SheetButton variant="secondary" size="sm" icon={<Plus size={14} />} disabled={permissions.editReadOnly} onClick={addBonus}>
              Add Bonus
            </SheetButton>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">Conditions</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {TOKEN_STATUS_MARKERS.map((condition) => {
                const isChecked = draft.conditions.includes(condition);
                return (
                  <label
                    key={condition}
                    className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-xs capitalize transition cursor-pointer ${
                      isChecked
                        ? "border border-amber-500/40 bg-amber-500/15 text-amber-100 font-semibold"
                        : "border border-white/5 bg-slate-950/40 text-zinc-300 hover:border-white/20"
                    }`}
                  >
                    <input
                      className="accent-amber-500 rounded"
                      type="checkbox"
                      disabled={permissions.editReadOnly}
                      checked={isChecked}
                      onChange={(event) =>
                        mutators.updateField(
                          "conditions",
                          event.target.checked ? [...draft.conditions, condition] : draft.conditions.filter((entry) => entry !== condition)
                        )
                      }
                    />
                    {condition}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Exhaustion Level (0 - 6)">
              <NumericInput
                className={inputClass}
                min={0}
                max={6}
                disabled={permissions.editReadOnly}
                value={draft.exhaustionLevel}
                onValueChange={(value) => mutators.updateField("exhaustionLevel", value ?? 0)}
              />
            </Field>
            <div className="flex items-end">
              <label className="flex items-center gap-2 rounded-md border border-white/10 bg-slate-900/60 p-2.5 text-xs text-zinc-300 cursor-pointer w-full">
                <input
                  className="accent-amber-500 rounded"
                  type="checkbox"
                  disabled={permissions.editReadOnly}
                  checked={draft.concentration}
                  onChange={(event) => mutators.updateField("concentration", event.target.checked)}
                />
                Maintaining Concentration
              </label>
            </div>
          </div>

          <Field label="Character Notes">
            <textarea
              className={textareaClass}
              rows={4}
              disabled={permissions.editReadOnly}
              value={draft.notes}
              onChange={(event) => mutators.updateField("notes", event.target.value)}
              placeholder="Background notes, physical descriptions, campaign reminders..."
            />
          </Field>
        </SectionCard>

        {/* RESOURCES */}
        <SectionCard title="Resources" icon={<Heart size={16} />}>
          <div className="space-y-3">
            {derived.displayedResources.map((resource) => {
              const resourceDefinition = derived.resourceDefinitionLookup.get(normalizeKey(resource.name));
              const resourceManagedByClassTable = resource.id.startsWith("derived:") && Boolean(resourceDefinition);

              return (
                <div key={resource.id} className="space-y-2.5 rounded-md border border-white/10 bg-slate-900/70 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-200">{resource.name || "Resource"}</span>
                    {!resourceManagedByClassTable ? (
                      <SheetButton
                        variant="danger"
                        size="sm"
                        icon={<Trash2 size={12} />}
                        disabled={permissions.editReadOnly}
                        onClick={() =>
                          mutators.updateDraft((current) => ({
                            ...current,
                            resources: current.resources.filter((entry) => entry.id !== resource.id)
                          }))
                        }
                      >
                        Remove
                      </SheetButton>
                    ) : null}
                  </div>
                  <div className="grid gap-2.5 md:grid-cols-2">
                    <Field label="Resource Name">
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
                    <Field label="Current Charges">
                      <NumericInput
                        className={inputClass}
                        disabled={permissions.editReadOnly}
                        value={resource.current}
                        onValueChange={(value) => mutators.updateResourceById(resource.id, { current: value ?? 0 })}
                      />
                    </Field>
                    <Field label="Maximum Charges">
                      <NumericInput
                        className={inputClass}
                        disabled={permissions.editReadOnly || resourceManagedByClassTable}
                        value={resource.max}
                        onValueChange={(value) => mutators.updateResourceById(resource.id, { max: value ?? 0 })}
                      />
                    </Field>
                  </div>
                  {resourceDefinition ? (
                    <div className="space-y-1 rounded bg-slate-950/60 p-2.5 text-xs text-zinc-400">
                      <p>{resourceDefinition.description}</p>
                      {resourceDefinition.source ? (
                        <p className="text-[10px] uppercase tracking-wider text-amber-400/80">{resourceDefinition.source}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <SheetButton
              variant="secondary"
              size="sm"
              icon={<Plus size={14} />}
              disabled={permissions.editReadOnly}
              onClick={() =>
                mutators.updateDraft((current) => ({
                  ...current,
                  resources: [...current.resources, createResourceEntry()]
                }))
              }
            >
              Add Resource
            </SheetButton>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
