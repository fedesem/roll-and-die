import { Backpack, BookOpen, Brain, Footprints, ImagePlus, Plus, ScrollText, Shield, Sparkles, Sword, WandSparkles, X } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";

import type {
  AbilityKey,
  ActorBonusEntry,
  ActorCreatureSize,
  ActorClassEntry,
  ActorSheet,
  ArmorEntry,
  AttackEntry,
  ClassEntry,
  CompendiumData,
  FeatEntry,
  InventoryEntry,
  MemberRole,
  ResourceEntry,
  SkillEntry,
  SpellEntry,
  SpellSlotTrack
} from "@shared/types";
import { CREATURE_SIZE_OPTIONS } from "@shared/tokenGeometry";

import { ModalFrame } from "../../components/ModalFrame";
import { NumericInput } from "../../components/NumericInput";
import { resolveAssetUrl } from "../../lib/assets";
import { uploadImageAsset } from "../../services/assetService";
import { RestDialog } from "./RestDialog";
import {
  abilityModifier,
  abilityModifierTotal,
  abilityOrder,
  abilityScoreTotal,
  actorInitials,
  availableClassFeatures,
  buildNotation,
  cloneActor,
  currencyOrder,
  derivedArmorClass,
  derivedSpeed,
  featMatchesClassFilter,
  findCompendiumClass,
  formatModifier,
  groupedSpellNames,
  hitDiceAvailable,
  moveLayoutSection,
  normalizeKey,
  proficiencyBonusForLevel,
  savingThrowTotal,
  skillTotal,
  spellAttackBonus,
  spellMatchesClassFilter,
  spellSaveDc,
  totalLevel,
  type SheetSectionId
} from "./sheetUtils";

interface PlayerNpcSheetProps {
  token: string;
  actor: ActorSheet;
  compendium: Pick<CompendiumData, "spells" | "feats" | "classes">;
  role: MemberRole;
  currentUserId: string;
  onSave: (actor: ActorSheet) => Promise<void>;
  onRoll: (notation: string, label: string) => Promise<void>;
}

type PickerState = { kind: "class" | "learn-spell" | "prepare-spell" | "feat" | "trait"; query: string } | null;

const sectionDefaults: Record<SheetSectionId, { column: number; order: number }> = {
  info: { column: 1, order: 0 },
  abilities: { column: 1, order: 1 },
  skills: { column: 1, order: 2 },
  combat: { column: 2, order: 3 },
  attacks: { column: 2, order: 4 },
  armor: { column: 2, order: 5 },
  resources: { column: 2, order: 6 },
  items: { column: 2, order: 7 },
  bonuses: { column: 2, order: 8 },
  spellSlots: { column: 3, order: 9 },
  spells: { column: 3, order: 10 },
  feats: { column: 3, order: 11 },
  traits: { column: 3, order: 12 },
  notes: { column: 3, order: 13 }
};

const resetOptions = ["", "Short Rest", "Long Rest"] as const;

export function PlayerNpcSheet({ token, actor, compendium, role, currentUserId, onSave, onRoll }: PlayerNpcSheetProps) {
  const [draft, setDraft] = useState<ActorSheet>(() => cloneActor(actor));
  const [picker, setPicker] = useState<PickerState>(null);
  const [layoutEditing, setLayoutEditing] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [shortRestOpen, setShortRestOpen] = useState(false);
  const [hitDiceSelections, setHitDiceSelections] = useState<Record<string, number>>({});

  useEffect(() => {
    setDraft(cloneActor(actor));
    setLayoutEditing(false);
    setPicker(null);
    setShortRestOpen(false);
    setHitDiceSelections({});
    setImageError(null);
  }, [actor]);

  const canEdit = role === "dm" || actor.ownerId === currentUserId;
  const canRoll = role === "dm" || actor.ownerId === currentUserId;

  const normalizedLayout = useMemo(() => ensureLayout(draft.layout), [draft.layout]);
  const totalActorLevel = useMemo(() => totalLevel(draft), [draft]);
  const proficiencyBonus = useMemo(() => proficiencyBonusForLevel(totalActorLevel), [totalActorLevel]);
  const armorClass = useMemo(() => derivedArmorClass(draft), [draft]);
  const speed = useMemo(() => derivedSpeed(draft), [draft]);
  const spellSave = useMemo(() => spellSaveDc({ ...draft, proficiencyBonus }), [draft, proficiencyBonus]);
  const spellAttack = useMemo(() => spellAttackBonus({ ...draft, proficiencyBonus }), [draft, proficiencyBonus]);
  const classFeatures = useMemo(() => availableClassFeatures(draft, compendium.classes), [compendium.classes, draft]);
  const filteredSpells = useMemo(() => {
    const query = normalizeKey(picker?.query ?? "");

    return compendium.spells
      .filter((entry) => spellMatchesClassFilter(entry, draft.classes))
      .filter((entry) =>
        !query
          ? true
          : [entry.name, entry.school, entry.level === "cantrip" ? "cantrip" : `${entry.level}`].some((value) =>
              value.toLowerCase().includes(query)
            )
      );
  }, [compendium.spells, draft.classes, picker?.query]);
  const filteredFeats = useMemo(() => {
    const query = normalizeKey(picker?.query ?? "");

    return compendium.feats
      .filter((entry) => featMatchesClassFilter(entry, draft.classes))
      .filter((entry) =>
        !query ? true : [entry.name, entry.category, entry.prerequisites].some((value) => value.toLowerCase().includes(query))
      );
  }, [compendium.feats, draft.classes, picker?.query]);
  const filteredClasses = useMemo(() => {
    const query = normalizeKey(picker?.query ?? "");

    return compendium.classes.filter((entry) =>
      !query ? true : [entry.name, entry.source].some((value) => value.toLowerCase().includes(query))
    );
  }, [compendium.classes, picker?.query]);
  const filteredTraits = useMemo(() => {
    const query = normalizeKey(picker?.query ?? "");

    return classFeatures.filter((entry) =>
      !query ? true : [entry.name, entry.className, entry.description].some((value) => value.toLowerCase().includes(query))
    );
  }, [classFeatures, picker?.query]);

  const sections = useMemo<Record<SheetSectionId, ReactNode>>(
    () => ({
      info: renderInfoSection(),
      abilities: renderAbilitiesSection(),
      skills: renderSkillsSection(),
      combat: renderCombatSection(),
      attacks: renderAttacksSection(),
      armor: renderArmorSection(),
      resources: renderResourcesSection(),
      items: renderItemsSection(),
      bonuses: renderBonusesSection(),
      spellSlots: renderSpellSlotsSection(),
      spells: renderSpellsSection(),
      feats: renderFeatsSection(),
      traits: renderTraitsSection(),
      notes: renderNotesSection()
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, proficiencyBonus, armorClass, speed, spellAttack, spellSave, layoutEditing]
  );

  async function saveCurrent(nextDraft = draft) {
    setSaving(true);

    try {
      await onSave(finalizeDraftForSave(nextDraft, proficiencyBonus));
    } finally {
      setSaving(false);
    }
  }

  function updateDraft(recipe: (current: ActorSheet) => ActorSheet) {
    setDraft((current) => recipe(current));
  }

  function updateField<K extends keyof ActorSheet>(key: K, value: ActorSheet[K]) {
    updateDraft((current) => ({ ...current, [key]: value }));
  }

  function updateAbility(key: AbilityKey, value: number) {
    updateDraft((current) => ({
      ...current,
      abilities: {
        ...current.abilities,
        [key]: value
      }
    }));
  }

  function updateSkill(index: number, patch: Partial<SkillEntry>) {
    updateDraft((current) => ({
      ...current,
      skills: current.skills.map((entry, currentIndex) => (currentIndex === index ? { ...entry, ...patch } : entry))
    }));
  }

  function updateClass(index: number, patch: Partial<ActorClassEntry>) {
    updateDraft((current) => ({
      ...current,
      classes: current.classes.map((entry, currentIndex) => (currentIndex === index ? { ...entry, ...patch } : entry))
    }));
  }

  function updateSpellSlot(index: number, patch: Partial<SpellSlotTrack>) {
    updateDraft((current) => ({
      ...current,
      spellSlots: current.spellSlots.map((entry, currentIndex) => (currentIndex === index ? { ...entry, ...patch } : entry))
    }));
  }

  function updateAttack(index: number, patch: Partial<AttackEntry>) {
    updateDraft((current) => ({
      ...current,
      attacks: current.attacks.map((entry, currentIndex) => (currentIndex === index ? { ...entry, ...patch } : entry))
    }));
  }

  function updateArmor(index: number, patch: Partial<ArmorEntry>) {
    updateDraft((current) => ({
      ...current,
      armorItems: current.armorItems.map((entry, currentIndex) => (currentIndex === index ? { ...entry, ...patch } : entry))
    }));
  }

  function updateResource(index: number, patch: Partial<ResourceEntry>) {
    updateDraft((current) => ({
      ...current,
      resources: current.resources.map((entry, currentIndex) => (currentIndex === index ? { ...entry, ...patch } : entry))
    }));
  }

  function updateInventory(index: number, patch: Partial<InventoryEntry>) {
    updateDraft((current) => ({
      ...current,
      inventory: current.inventory.map((entry, currentIndex) => (currentIndex === index ? { ...entry, ...patch } : entry))
    }));
  }

  function updateBonus(index: number, patch: Partial<ActorBonusEntry>) {
    updateDraft((current) => ({
      ...current,
      bonuses: current.bonuses.map((entry, currentIndex) => (currentIndex === index ? { ...entry, ...patch } : entry))
    }));
  }

  function removeArrayItem<K extends "classes" | "attacks" | "armorItems" | "resources" | "inventory" | "bonuses">(key: K, index: number) {
    updateDraft((current) => ({
      ...current,
      [key]: current[key].filter((_, currentIndex) => currentIndex !== index)
    }));
  }

  function toggleTextSelection(key: "spells" | "preparedSpells" | "feats" | "features", value: string) {
    updateDraft((current) => {
      const values = new Set(current[key]);

      if (values.has(value)) {
        values.delete(value);
      } else {
        values.add(value);
      }

      return {
        ...current,
        [key]: Array.from(values)
      };
    });
  }

  function updateCurrency(key: (typeof currencyOrder)[number], value: number) {
    updateDraft((current) => ({
      ...current,
      currency: {
        ...current.currency,
        [key]: value
      }
    }));
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const { url: imageUrl } = await uploadImageAsset(token, "actors", file);
      setImageError(null);
      updateField("imageUrl", imageUrl);
    } catch (error) {
      console.error(error);
      setImageError("Unable to read the selected image.");
    }
  }

  function addClassEntry(entry: ClassEntry) {
    const spellcastingAbility = guessSpellcastingAbility(entry);

    updateDraft((current) => ({
      ...current,
      classes: [
        ...current.classes,
        {
          id: crypto.randomUUID(),
          compendiumId: entry.id,
          name: entry.name,
          source: entry.source,
          level: 1,
          hitDieFaces: entry.hitDieFaces,
          usedHitDice: 0,
          spellcastingAbility
        }
      ]
    }));
    setPicker(null);
  }

  function learnSpell(spell: SpellEntry) {
    updateDraft((current) => ({
      ...current,
      spells: current.spells.includes(spell.name) ? current.spells : [...current.spells, spell.name]
    }));
    setPicker(null);
  }

  function prepareSpell(spell: SpellEntry) {
    updateDraft((current) => ({
      ...current,
      spells: current.spells.includes(spell.name) ? current.spells : [...current.spells, spell.name],
      preparedSpells: current.preparedSpells.includes(spell.name) ? current.preparedSpells : [...current.preparedSpells, spell.name]
    }));
    setPicker(null);
  }

  function addFeat(feat: FeatEntry) {
    updateDraft((current) => ({
      ...current,
      feats: current.feats.includes(feat.name) ? current.feats : [...current.feats, feat.name]
    }));
    setPicker(null);
  }

  function addTrait(name: string) {
    updateDraft((current) => ({
      ...current,
      features: current.features.includes(name) ? current.features : [...current.features, name]
    }));
    setPicker(null);
  }

  function startShortRest() {
    setHitDiceSelections(Object.fromEntries(draft.classes.map((entry) => [entry.id, 0])));
    setShortRestOpen(true);
  }

  async function confirmShortRest() {
    const constitutionModifier = abilityModifierTotal(draft, "con");
    let healing = 0;

    const nextDraft = cloneActor(draft);
    nextDraft.classes = nextDraft.classes.map((entry) => {
      const spend = Math.min(hitDiceSelections[entry.id] ?? 0, hitDiceAvailable(entry));

      for (let index = 0; index < spend; index += 1) {
        healing += Math.max(1, rollDie(entry.hitDieFaces) + constitutionModifier);
      }

      return {
        ...entry,
        usedHitDice: entry.usedHitDice + spend
      };
    });

    nextDraft.hitPoints.current = Math.min(nextDraft.hitPoints.max, nextDraft.hitPoints.current + healing);
    nextDraft.resources = nextDraft.resources.map((resource) =>
      /short rest/i.test(resource.resetOn)
        ? {
            ...resource,
            current: Math.min(resource.max, resource.current + Math.max(1, resource.restoreAmount))
          }
        : resource
    );

    setDraft(nextDraft);
    setShortRestOpen(false);
    setHitDiceSelections({});
    await saveCurrent(nextDraft);
  }

  async function handleLongRest() {
    const nextDraft = cloneActor(draft);
    nextDraft.hitPoints.current = nextDraft.hitPoints.max;
    nextDraft.hitPoints.temp = 0;
    nextDraft.spellSlots = nextDraft.spellSlots.map((entry) => ({ ...entry, used: 0 }));
    nextDraft.resources = nextDraft.resources.map((entry) => ({ ...entry, current: entry.max }));
    nextDraft.classes = nextDraft.classes.map((entry) => ({ ...entry, usedHitDice: 0 }));

    setDraft(nextDraft);
    await saveCurrent(nextDraft);
  }

  function renderSection(sectionId: SheetSectionId, title: string, icon: ReactNode, children: ReactNode, action?: ReactNode) {
    return (
      <article className="border border-amber-800/50 bg-zinc-950/90 shadow-[0_0_0_1px_rgba(0,0,0,0.18)]">
        <header className="flex items-start justify-between border-b border-amber-800/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">{icon}</span>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-amber-400/80">{title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {action}
            {layoutEditing && (
              <div className="flex items-center gap-1">
                {(["left", "up", "down", "right"] as const).map((direction) => (
                  <button
                    key={direction}
                    type="button"
                    className="border border-zinc-800 px-2 py-1 text-[10px] uppercase tracking-[0.22em] text-zinc-300 transition hover:border-amber-700/70 hover:text-amber-50"
                    onClick={() => updateField("layout", moveLayoutSection(normalizedLayout, sectionId, direction))}
                  >
                    {direction[0]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>
        <div className="space-y-4 p-4">{children}</div>
      </article>
    );
  }

  function renderInfoSection() {
    return renderSection(
      "info",
      "Character Info",
      <ScrollText size={16} />,
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Name">
            <input
              className={inputClass}
              value={draft.name}
              disabled={!canEdit}
              onChange={(event) => updateField("name", event.target.value)}
            />
          </Field>
          <Field label="Race / Type">
            <input
              className={inputClass}
              value={draft.species}
              disabled={!canEdit}
              onChange={(event) => updateField("species", event.target.value)}
            />
          </Field>
          <Field label="Size">
            <select
              className={inputClass}
              value={draft.creatureSize}
              disabled={!canEdit}
              onChange={(event) => updateField("creatureSize", event.target.value as ActorCreatureSize)}
            >
              {CREATURE_SIZE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Background">
            <input
              className={inputClass}
              value={draft.background}
              disabled={!canEdit}
              onChange={(event) => updateField("background", event.target.value)}
            />
          </Field>
          <Field label="Alignment">
            <input
              className={inputClass}
              value={draft.alignment}
              disabled={!canEdit}
              onChange={(event) => updateField("alignment", event.target.value)}
            />
          </Field>
          <Field label="Experience">
            <NumericInput
              className={inputClass}
              value={draft.experience}
              disabled={!canEdit}
              onValueChange={(value) => updateField("experience", value ?? 0)}
            />
          </Field>
          <Field label="Spellcasting Ability">
            <select
              className={inputClass}
              value={draft.spellcastingAbility}
              disabled={!canEdit}
              onChange={(event) => updateField("spellcastingAbility", event.target.value as AbilityKey)}
            >
              {abilityOrder.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-[110px,1fr]">
          <div className="space-y-3">
            <div className="flex aspect-square items-center justify-center border border-amber-700/50 bg-zinc-900 text-2xl font-semibold text-amber-50">
              {draft.imageUrl ? (
                <img src={resolveAssetUrl(draft.imageUrl)} alt={draft.name} className="h-full w-full object-cover" />
              ) : (
                actorInitials(draft.name)
              )}
            </div>
            <label className="block">
              <span className="sr-only">Upload portrait</span>
              <span className="flex cursor-pointer items-center justify-center gap-2 border border-zinc-800 px-3 py-2 text-xs uppercase tracking-[0.2em] text-zinc-300 transition hover:border-amber-700/70 hover:text-amber-50">
                <ImagePlus size={14} />
                Upload
              </span>
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                disabled={!canEdit}
                onChange={(event) => void handleImageUpload(event)}
              />
            </label>
          </div>

          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Token Image URL">
                <input
                  className={inputClass}
                  value={draft.imageUrl}
                  disabled={!canEdit}
                  onChange={(event) => updateField("imageUrl", event.target.value)}
                />
              </Field>
              <Field label="Accent Color">
                <input
                  className={`${inputClass} h-11 p-1`}
                  type="color"
                  value={draft.color}
                  disabled={!canEdit}
                  onChange={(event) => updateField("color", event.target.value)}
                />
              </Field>
            </div>
            {imageError ? <p className="text-sm text-red-400">{imageError}</p> : null}
            <div className="grid gap-3 md:grid-cols-3">
              <StatBox label="Level" value={String(totalActorLevel)} />
              <StatBox label="Proficiency" value={formatModifier(proficiencyBonus)} />
              <div className="space-y-2 border border-amber-800/40 bg-zinc-900/70 px-3 py-3">
                <div className="flex items-center justify-between text-sm text-zinc-300">
                  <span>Inspiration</span>
                  <DotToggle
                    active={draft.inspiration}
                    disabled={!canEdit}
                    onToggle={() => updateField("inspiration", !draft.inspiration)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 border border-amber-800/30 bg-zinc-900/40 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">Classes</p>
              <p className="mt-1 text-sm text-zinc-400">Multiclass hit dice and spellcasting are derived from these entries.</p>
            </div>
            {canEdit && (
              <button type="button" className={toolbarGhostButton} onClick={() => setPicker({ kind: "class", query: "" })}>
                <Plus size={14} />
                Add Class
              </button>
            )}
          </div>
          <div className="space-y-2">
            {draft.classes.map((entry, index) => {
              const compendiumClass = findCompendiumClass(entry, compendium.classes);

              return (
                <div
                  key={entry.id}
                  className="grid gap-3 border border-amber-800/30 bg-zinc-950/70 p-3 md:grid-cols-[1.8fr,90px,90px,140px,auto]"
                >
                  <div>
                    <p className="text-sm font-medium text-amber-50">{entry.name}</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {compendiumClass?.source || entry.source || "Custom"} • d{entry.hitDieFaces}
                    </p>
                  </div>
                  <Field label="Level">
                    <NumericInput
                      className={inputClass}
                      min="1"
                      max="20"
                      value={entry.level}
                      disabled={!canEdit}
                      onValueChange={(value) =>
                        updateClass(index, {
                          level: Math.max(1, Math.min(20, value ?? 1))
                        })
                      }
                    />
                  </Field>
                  <Field label="Used HD">
                    <NumericInput
                      className={inputClass}
                      min="0"
                      max={entry.level}
                      value={entry.usedHitDice}
                      disabled={!canEdit}
                      onValueChange={(value) =>
                        updateClass(index, {
                          usedHitDice: Math.max(0, Math.min(entry.level, value ?? 0))
                        })
                      }
                    />
                  </Field>
                  <Field label="Spellcasting">
                    <select
                      className={inputClass}
                      value={entry.spellcastingAbility ?? ""}
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateClass(index, {
                          spellcastingAbility: (event.target.value || null) as AbilityKey | null
                        })
                      }
                    >
                      <option value="">None</option>
                      {abilityOrder.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {canEdit && (
                    <div className="flex items-end justify-end">
                      <button type="button" className={iconDeleteButton} onClick={() => removeArrayItem("classes", index)}>
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function renderCombatSection() {
    return renderSection(
      "combat",
      "Combat",
      <Shield size={16} />,
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <StatBox label="Armor Class" value={String(armorClass)} detail="Automatic" />
          <Field label="Initiative">
            <div className="flex items-center gap-2">
              <NumericInput
                className={inputClass}
                value={draft.initiative}
                disabled={!canEdit}
                onValueChange={(value) => updateField("initiative", value ?? 0)}
              />
              {canRoll && (
                <button
                  type="button"
                  className={rollButton}
                  onClick={() => void onRoll(buildNotation(draft.initiative), `${draft.name} initiative`)}
                >
                  Roll
                </button>
              )}
            </div>
          </Field>
          <StatBox label="Speed" value={`${speed} ft`} detail={`${draft.speed} base`} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Max HP">
            <NumericInput
              className={inputClass}
              value={draft.hitPoints.max}
              disabled={!canEdit}
              onValueChange={(value) =>
                updateField("hitPoints", {
                  ...draft.hitPoints,
                  max: value ?? 0
                })
              }
            />
          </Field>
          <Field label="Current HP">
            <NumericInput
              className={inputClass}
              value={draft.hitPoints.current}
              disabled={!canEdit}
              onValueChange={(value) =>
                updateField("hitPoints", {
                  ...draft.hitPoints,
                  current: value ?? 0
                })
              }
            />
          </Field>
          <Field label="Temporary HP">
            <NumericInput
              className={inputClass}
              value={draft.hitPoints.temp}
              disabled={!canEdit}
              onValueChange={(value) =>
                updateField("hitPoints", {
                  ...draft.hitPoints,
                  temp: value ?? 0
                })
              }
            />
          </Field>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <StatBox label="Hit Dice" value={draft.hitDice} />
          <StatBox label="Spell Save DC" value={String(spellSave)} detail={draft.spellcastingAbility.toUpperCase()} />
          <StatBox label="Spell Attack" value={formatModifier(spellAttack)} detail={draft.spellcastingAbility.toUpperCase()} />
        </div>
      </div>
    );
  }

  function renderAbilitiesSection() {
    return renderSection(
      "abilities",
      "Ability Scores",
      <Brain size={16} />,
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {abilityOrder.map((entry) => {
          const totalScore = abilityScoreTotal(draft, entry.key);
          const modifier = abilityModifier(totalScore);
          const saveTotal = savingThrowTotal({ ...draft, proficiencyBonus }, entry.key);

          return (
            <div key={entry.key} className="space-y-3 border border-amber-800/30 bg-zinc-900/70 px-3 py-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium tracking-[0.18em] text-amber-50">{entry.label}</h4>
                <button
                  type="button"
                  className={rollTextButton}
                  disabled={!canRoll}
                  onClick={() => void onRoll(buildNotation(modifier), `${draft.name} ${entry.label} check`)}
                >
                  {formatModifier(modifier)}
                </button>
              </div>
              <Field label="Score">
                <NumericInput
                  className={inputClass}
                  value={draft.abilities[entry.key]}
                  disabled={!canEdit}
                  onValueChange={(value) => updateAbility(entry.key, value ?? 0)}
                />
              </Field>
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Total {totalScore}</span>
                <button
                  type="button"
                  className={rollTextButton}
                  disabled={!canRoll}
                  onClick={() => void onRoll(buildNotation(saveTotal), `${draft.name} ${entry.label} save`)}
                >
                  Save {formatModifier(saveTotal)}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderSkillsSection() {
    return renderSection(
      "skills",
      "Skills",
      <BookOpen size={16} />,
      <div className="space-y-2">
        {draft.skills.map((entry, index) => (
          <div key={entry.id} className="grid gap-3 border-b border-amber-900/20 py-2 md:grid-cols-[80px,1fr,100px,80px]">
            <button
              type="button"
              className="text-left text-sm font-semibold text-amber-300 transition hover:text-amber-200 disabled:text-zinc-500"
              disabled={!canRoll}
              onClick={() => void onRoll(buildNotation(skillTotal({ ...draft, proficiencyBonus }, entry)), `${draft.name} ${entry.name}`)}
            >
              {formatModifier(skillTotal({ ...draft, proficiencyBonus }, entry))}
            </button>
            <div>
              <p className="text-sm text-amber-50">{entry.name}</p>
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">{entry.ability.toUpperCase()}</p>
            </div>
            <div className="flex items-center gap-2">
              <DotToggle
                active={entry.proficient}
                disabled={!canEdit}
                label="Proficient"
                onToggle={() => updateSkill(index, { proficient: !entry.proficient })}
              />
              <span className="text-xs text-zinc-500">Prof</span>
              <DotToggle
                active={entry.expertise}
                disabled={!canEdit}
                label="Expertise"
                onToggle={() => updateSkill(index, { expertise: !entry.expertise })}
              />
              <span className="text-xs text-zinc-500">Exp</span>
            </div>
            <Field label="Ability">
              <select
                className={inputClass}
                value={entry.ability}
                disabled={!canEdit}
                onChange={(event) => updateSkill(index, { ability: event.target.value as AbilityKey })}
              >
                {abilityOrder.map((ability) => (
                  <option key={ability.key} value={ability.key}>
                    {ability.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ))}
      </div>
    );
  }

  function renderAttacksSection() {
    return renderSection(
      "attacks",
      "Attacks & Weapons",
      <Sword size={16} />,
      <div className="space-y-3">
        {draft.attacks.map((entry, index) => (
          <div key={entry.id} className="space-y-3 border border-amber-800/30 bg-zinc-950/70 p-3">
            <div className="grid gap-3 md:grid-cols-[1.3fr,100px,120px,auto]">
              <Field label="Name">
                <input
                  className={inputClass}
                  value={entry.name}
                  disabled={!canEdit}
                  onChange={(event) => updateAttack(index, { name: event.target.value })}
                />
              </Field>
              <Field label="Attack">
                <NumericInput
                  className={inputClass}
                  value={entry.attackBonus}
                  disabled={!canEdit}
                  onValueChange={(value) => updateAttack(index, { attackBonus: value ?? 0 })}
                />
              </Field>
              <Field label="Damage">
                <input
                  className={inputClass}
                  value={entry.damage}
                  disabled={!canEdit}
                  onChange={(event) => updateAttack(index, { damage: event.target.value })}
                />
              </Field>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  className={rollButton}
                  disabled={!canRoll}
                  onClick={() => void onRoll(buildNotation(entry.attackBonus), `${draft.name} ${entry.name}`)}
                >
                  Roll
                </button>
                {canEdit && (
                  <button type="button" className={iconDeleteButton} onClick={() => removeArrayItem("attacks", index)}>
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Damage Type">
                <input
                  className={inputClass}
                  value={entry.damageType}
                  disabled={!canEdit}
                  onChange={(event) => updateAttack(index, { damageType: event.target.value })}
                />
              </Field>
              <Field label="Notes">
                <input
                  className={inputClass}
                  value={entry.notes}
                  disabled={!canEdit}
                  onChange={(event) => updateAttack(index, { notes: event.target.value })}
                />
              </Field>
            </div>
          </div>
        ))}
        {canEdit && (
          <button
            type="button"
            className={toolbarGhostButton}
            onClick={() =>
              updateDraft((current) => ({
                ...current,
                attacks: [
                  ...current.attacks,
                  {
                    id: crypto.randomUUID(),
                    name: "New Attack",
                    attackBonus: 0,
                    damage: "1d6",
                    damageType: "Damage",
                    notes: ""
                  }
                ]
              }))
            }
          >
            <Plus size={14} />
            Add Attack
          </button>
        )}
      </div>
    );
  }

  function renderArmorSection() {
    return renderSection(
      "armor",
      "Armor",
      <Shield size={16} />,
      <div className="space-y-3">
        <p className="text-sm text-zinc-400">
          Armor Class is calculated automatically from equipped armor, shields, and armor-class bonuses.
        </p>
        {draft.armorItems.map((entry, index) => (
          <div key={entry.id} className="space-y-3 border border-amber-800/30 bg-zinc-950/70 p-3">
            <div className="grid gap-3 md:grid-cols-[1.4fr,110px,110px,110px,auto]">
              <Field label="Name">
                <input
                  className={inputClass}
                  value={entry.name}
                  disabled={!canEdit}
                  onChange={(event) => updateArmor(index, { name: event.target.value })}
                />
              </Field>
              <Field label="Type">
                <select
                  className={inputClass}
                  value={entry.kind}
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateArmor(index, {
                      kind: event.target.value as ArmorEntry["kind"]
                    })
                  }
                >
                  <option value="armor">Armor</option>
                  <option value="shield">Shield</option>
                </select>
              </Field>
              <Field label="Base AC">
                <NumericInput
                  className={inputClass}
                  value={entry.armorClass}
                  disabled={!canEdit}
                  onValueChange={(value) => updateArmor(index, { armorClass: value ?? 0 })}
                />
              </Field>
              <Field label="Bonus">
                <NumericInput
                  className={inputClass}
                  value={entry.bonus}
                  disabled={!canEdit}
                  onValueChange={(value) => updateArmor(index, { bonus: value ?? 0 })}
                />
              </Field>
              <div className="flex items-end gap-2">
                <DotToggle
                  active={entry.equipped}
                  disabled={!canEdit}
                  label="Equipped"
                  onToggle={() => updateArmor(index, { equipped: !entry.equipped })}
                />
                {canEdit && (
                  <button type="button" className={iconDeleteButton} onClick={() => removeArrayItem("armorItems", index)}>
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Max Dex Bonus">
                <NumericInput
                  className={inputClass}
                  value={typeof entry.maxDexBonus === "number" ? entry.maxDexBonus : null}
                  disabled={!canEdit}
                  placeholder="No cap"
                  emptyValue={null}
                  onValueChange={(value) =>
                    updateArmor(index, {
                      maxDexBonus: value
                    })
                  }
                />
              </Field>
              <Field label="Notes">
                <input
                  className={inputClass}
                  value={entry.notes}
                  disabled={!canEdit}
                  onChange={(event) => updateArmor(index, { notes: event.target.value })}
                />
              </Field>
            </div>
          </div>
        ))}
        {canEdit && (
          <button
            type="button"
            className={toolbarGhostButton}
            onClick={() =>
              updateDraft((current) => ({
                ...current,
                armorItems: [
                  ...current.armorItems,
                  {
                    id: crypto.randomUUID(),
                    name: "Armor",
                    kind: "armor",
                    armorClass: 10,
                    maxDexBonus: null,
                    bonus: 0,
                    equipped: false,
                    notes: ""
                  }
                ]
              }))
            }
          >
            <Plus size={14} />
            Add Armor
          </button>
        )}
      </div>
    );
  }

  function renderResourcesSection() {
    return renderSection(
      "resources",
      "Resources",
      <Sparkles size={16} />,
      <div className="space-y-3">
        {draft.resources.map((entry, index) => (
          <div key={entry.id} className="space-y-3 border border-amber-800/30 bg-zinc-950/70 p-3">
            <div className="grid gap-3 md:grid-cols-[1.4fr,120px,160px,auto]">
              <Field label="Name">
                <input
                  className={inputClass}
                  value={entry.name}
                  disabled={!canEdit}
                  onChange={(event) => updateResource(index, { name: event.target.value })}
                />
              </Field>
              <Field label="Reset">
                <select
                  className={inputClass}
                  value={entry.resetOn}
                  disabled={!canEdit}
                  onChange={(event) => updateResource(index, { resetOn: event.target.value })}
                >
                  {resetOptions.map((option) => (
                    <option key={option} value={option}>
                      {option || "Manual"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Restore Amount">
                <NumericInput
                  className={inputClass}
                  value={entry.restoreAmount}
                  disabled={!canEdit}
                  onValueChange={(value) =>
                    updateResource(index, {
                      restoreAmount: value ?? 0
                    })
                  }
                />
              </Field>
              <div className="flex items-end justify-end">
                {canEdit && (
                  <button type="button" className={iconDeleteButton} onClick={() => removeArrayItem("resources", index)}>
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-[140px,1fr]">
              <Field label="Current / Max">
                <div className="grid grid-cols-2 gap-2">
                  <NumericInput
                    className={inputClass}
                    value={entry.current}
                    disabled={!canEdit}
                    onValueChange={(value) => updateResource(index, { current: value ?? 0 })}
                  />
                  <NumericInput
                    className={inputClass}
                    value={entry.max}
                    disabled={!canEdit}
                    onValueChange={(value) => updateResource(index, { max: value ?? 0 })}
                  />
                </div>
              </Field>
              <Field label="Dots">
                <DotTrack
                  total={entry.max}
                  active={entry.current}
                  disabled={!canEdit}
                  onChange={(nextValue) => updateResource(index, { current: nextValue })}
                />
              </Field>
            </div>
          </div>
        ))}
        {canEdit && (
          <button
            type="button"
            className={toolbarGhostButton}
            onClick={() =>
              updateDraft((current) => ({
                ...current,
                resources: [
                  ...current.resources,
                  {
                    id: crypto.randomUUID(),
                    name: "Resource",
                    current: 0,
                    max: 1,
                    resetOn: "",
                    restoreAmount: 1
                  }
                ]
              }))
            }
          >
            <Plus size={14} />
            Add Resource
          </button>
        )}
      </div>
    );
  }

  function renderItemsSection() {
    return renderSection(
      "items",
      "Items",
      <Backpack size={16} />,
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-5">
          {currencyOrder.map((entry) => (
            <Field key={entry} label={entry.toUpperCase()}>
              <NumericInput
                className={inputClass}
                value={draft.currency[entry]}
                disabled={!canEdit}
                onValueChange={(value) => updateCurrency(entry, value ?? 0)}
              />
            </Field>
          ))}
        </div>

        <div className="space-y-3">
          {draft.inventory.map((entry, index) => (
            <div key={entry.id} className="space-y-3 border border-amber-800/30 bg-zinc-950/70 p-3">
              <div className="grid gap-3 md:grid-cols-[1.4fr,130px,90px,auto]">
                <Field label="Item">
                  <input
                    className={inputClass}
                    value={entry.name}
                    disabled={!canEdit}
                    onChange={(event) => updateInventory(index, { name: event.target.value })}
                  />
                </Field>
                <Field label="Type">
                  <select
                    className={inputClass}
                    value={entry.type}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateInventory(index, {
                        type: event.target.value as InventoryEntry["type"]
                      })
                    }
                  >
                    <option value="gear">Gear</option>
                    <option value="reagent">Reagent</option>
                    <option value="loot">Loot</option>
                    <option value="consumable">Consumable</option>
                  </select>
                </Field>
                <Field label="Qty">
                  <NumericInput
                    className={inputClass}
                    value={entry.quantity}
                    disabled={!canEdit}
                    onValueChange={(value) => updateInventory(index, { quantity: value ?? 0 })}
                  />
                </Field>
                <div className="flex items-end gap-2">
                  <DotToggle
                    active={entry.equipped}
                    disabled={!canEdit}
                    label="Equipped"
                    onToggle={() => updateInventory(index, { equipped: !entry.equipped })}
                  />
                  {canEdit && (
                    <button type="button" className={iconDeleteButton} onClick={() => removeArrayItem("inventory", index)}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              <Field label="Notes">
                <input
                  className={inputClass}
                  value={entry.notes}
                  disabled={!canEdit}
                  onChange={(event) => updateInventory(index, { notes: event.target.value })}
                />
              </Field>
            </div>
          ))}
        </div>

        {canEdit && (
          <button
            type="button"
            className={toolbarGhostButton}
            onClick={() =>
              updateDraft((current) => ({
                ...current,
                inventory: [
                  ...current.inventory,
                  {
                    id: crypto.randomUUID(),
                    name: "Item",
                    type: "gear",
                    quantity: 1,
                    equipped: false,
                    notes: ""
                  }
                ]
              }))
            }
          >
            <Plus size={14} />
            Add Item
          </button>
        )}
      </div>
    );
  }

  function renderBonusesSection() {
    return renderSection(
      "bonuses",
      "Bonuses",
      <Footprints size={16} />,
      <div className="space-y-3">
        <p className="text-sm text-zinc-400">
          Gear and buff bonuses can be positive or negative and are applied automatically to AC, speed, ability scores, skills, or saving
          throws.
        </p>
        {draft.bonuses.map((entry, index) => (
          <div key={entry.id} className="space-y-3 border border-amber-800/30 bg-zinc-950/70 p-3">
            <div className="grid gap-3 md:grid-cols-[1.2fr,130px,130px,120px,auto]">
              <Field label="Name">
                <input
                  className={inputClass}
                  value={entry.name}
                  disabled={!canEdit}
                  onChange={(event) => updateBonus(index, { name: event.target.value })}
                />
              </Field>
              <Field label="Source">
                <select
                  className={inputClass}
                  value={entry.sourceType}
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateBonus(index, {
                      sourceType: event.target.value as ActorBonusEntry["sourceType"]
                    })
                  }
                >
                  <option value="gear">Gear</option>
                  <option value="buff">Buff</option>
                </select>
              </Field>
              <Field label="Target">
                <select
                  className={inputClass}
                  value={entry.targetType}
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateBonus(index, {
                      targetType: event.target.value as ActorBonusEntry["targetType"],
                      targetKey: ""
                    })
                  }
                >
                  <option value="armorClass">Armor Class</option>
                  <option value="speed">Speed</option>
                  <option value="ability">Ability Score</option>
                  <option value="skill">Skill</option>
                  <option value="savingThrow">Saving Throw</option>
                </select>
              </Field>
              <Field label="Value">
                <NumericInput
                  className={inputClass}
                  value={entry.value}
                  disabled={!canEdit}
                  onValueChange={(value) => updateBonus(index, { value: value ?? 0 })}
                />
              </Field>
              <div className="flex items-end gap-2">
                <DotToggle
                  active={entry.enabled}
                  disabled={!canEdit}
                  label="Enabled"
                  onToggle={() => updateBonus(index, { enabled: !entry.enabled })}
                />
                {canEdit && (
                  <button type="button" className={iconDeleteButton} onClick={() => removeArrayItem("bonuses", index)}>
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {requiresTargetKey(entry.targetType) && (
              <Field label="Target Key">
                <select
                  className={inputClass}
                  value={entry.targetKey}
                  disabled={!canEdit}
                  onChange={(event) => updateBonus(index, { targetKey: event.target.value })}
                >
                  <option value="">Select</option>
                  {renderBonusTargetOptions(entry.targetType, draft.skills)}
                </select>
              </Field>
            )}
          </div>
        ))}

        {canEdit && (
          <button
            type="button"
            className={toolbarGhostButton}
            onClick={() =>
              updateDraft((current) => ({
                ...current,
                bonuses: [
                  ...current.bonuses,
                  {
                    id: crypto.randomUUID(),
                    name: "Bonus",
                    sourceType: "gear",
                    targetType: "armorClass",
                    targetKey: "",
                    value: 0,
                    enabled: true
                  }
                ]
              }))
            }
          >
            <Plus size={14} />
            Add Bonus
          </button>
        )}
      </div>
    );
  }

  function renderSpellSlotsSection() {
    return renderSection(
      "spellSlots",
      "Spell Slots",
      <WandSparkles size={16} />,
      <div className="grid gap-3 md:grid-cols-3">
        {draft.spellSlots.map((entry, index) => (
          <div key={entry.level} className="space-y-3 border border-amber-800/30 bg-zinc-950/70 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-amber-50">Level {entry.level}</span>
              <span className="text-xs text-zinc-500">
                {Math.max(entry.total - entry.used, 0)}/{entry.total}
              </span>
            </div>
            <DotTrack
              total={entry.total}
              active={Math.max(entry.total - entry.used, 0)}
              disabled={!canEdit}
              onChange={(nextValue) =>
                updateSpellSlot(index, {
                  used: Math.max(0, entry.total - nextValue)
                })
              }
            />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Total">
                <NumericInput
                  className={inputClass}
                  value={entry.total}
                  disabled={!canEdit}
                  onValueChange={(value) =>
                    updateSpellSlot(index, {
                      total: Math.max(0, value ?? 0)
                    })
                  }
                />
              </Field>
              <Field label="Used">
                <NumericInput
                  className={inputClass}
                  value={entry.used}
                  disabled={!canEdit}
                  onValueChange={(value) =>
                    updateSpellSlot(index, {
                      used: Math.max(0, value ?? 0)
                    })
                  }
                />
              </Field>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderSpellsSection() {
    return renderSection(
      "spells",
      "Spells",
      <WandSparkles size={16} />,
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <StatBox label="Spell Save DC" value={String(spellSave)} />
          <StatBox label="Spell Attack" value={formatModifier(spellAttack)} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <>
              <button type="button" className={toolbarGhostButton} onClick={() => setPicker({ kind: "learn-spell", query: "" })}>
                <Plus size={14} />
                Learn
              </button>
              <button type="button" className={toolbarGhostButton} onClick={() => setPicker({ kind: "prepare-spell", query: "" })}>
                <Plus size={14} />
                Prepare
              </button>
            </>
          )}
          <button
            type="button"
            className={rollButton}
            disabled={!canRoll}
            onClick={() => void onRoll(buildNotation(spellAttack), `${draft.name} spell attack`)}
          >
            Roll Spell Attack
          </button>
        </div>

        <SpellGroupCard
          title="Known Spells"
          groups={groupedSpellNames(draft.spells, compendium.spells)}
          onRemove={
            canEdit
              ? (name) => {
                  toggleTextSelection("spells", name);
                  updateDraft((current) => ({
                    ...current,
                    preparedSpells: current.preparedSpells.filter((entry) => entry !== name)
                  }));
                }
              : undefined
          }
        />

        <SpellGroupCard
          title="Prepared Spells"
          groups={groupedSpellNames(draft.preparedSpells, compendium.spells)}
          onRemove={canEdit ? (name) => toggleTextSelection("preparedSpells", name) : undefined}
        />
      </div>
    );
  }

  function renderFeatsSection() {
    return renderSection(
      "feats",
      "Feats",
      <Sparkles size={16} />,
      <div className="space-y-3">
        {canEdit && (
          <button type="button" className={toolbarGhostButton} onClick={() => setPicker({ kind: "feat", query: "" })}>
            <Plus size={14} />
            Add Feat
          </button>
        )}

        <div className="space-y-2">
          {draft.feats.map((entry) => (
            <div key={entry} className="flex items-center justify-between border border-amber-800/30 bg-zinc-950/70 px-3 py-3">
              <span className="text-sm text-amber-50">{entry}</span>
              {canEdit && (
                <button type="button" className={iconDeleteButton} onClick={() => toggleTextSelection("feats", entry)}>
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {draft.feats.length === 0 && <p className="text-sm text-zinc-500">No feats selected.</p>}
        </div>
      </div>
    );
  }

  function renderTraitsSection() {
    return renderSection(
      "traits",
      "Features & Traits",
      <BookOpen size={16} />,
      <div className="space-y-3">
        {canEdit && (
          <button type="button" className={toolbarGhostButton} onClick={() => setPicker({ kind: "trait", query: "" })}>
            <Plus size={14} />
            Add Feature
          </button>
        )}

        <div className="space-y-2">
          {draft.features.map((entry) => (
            <div key={entry} className="flex items-center justify-between border border-amber-800/30 bg-zinc-950/70 px-3 py-3">
              <span className="text-sm text-amber-50">{entry}</span>
              {canEdit && (
                <button type="button" className={iconDeleteButton} onClick={() => toggleTextSelection("features", entry)}>
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {draft.features.length === 0 && <p className="text-sm text-zinc-500">No class features selected.</p>}
        </div>
      </div>
    );
  }

  function renderNotesSection() {
    return renderSection(
      "notes",
      "Notes",
      <ScrollText size={16} />,
      <Field label="Notes">
        <textarea
          className={`${inputClass} min-h-48`}
          value={draft.notes}
          disabled={!canEdit}
          onChange={(event) => updateField("notes", event.target.value)}
        />
      </Field>
    );
  }

  function renderPicker() {
    if (!picker) {
      return null;
    }

    let title = "";
    let entries: ReactNode = null;

    if (picker.kind === "class") {
      title = "Add Class";
      entries = filteredClasses.map((entry) => (
        <PickerRow
          key={entry.id}
          title={entry.name}
          subtitle={`${entry.source} • d${entry.hitDieFaces}`}
          onSelect={() => addClassEntry(entry)}
        />
      ));
    } else if (picker.kind === "learn-spell" || picker.kind === "prepare-spell") {
      title = picker.kind === "learn-spell" ? "Learn Spell" : "Prepare Spell";
      entries = filteredSpells.map((entry) => (
        <PickerRow
          key={entry.id}
          title={entry.name}
          subtitle={`${entry.level === "cantrip" ? "Cantrip" : `Level ${entry.level}`} • ${entry.school}`}
          onSelect={() => (picker.kind === "learn-spell" ? learnSpell(entry) : prepareSpell(entry))}
        />
      ));
    } else if (picker.kind === "feat") {
      title = "Add Feat";
      entries = filteredFeats.map((entry) => (
        <PickerRow
          key={entry.id}
          title={entry.name}
          subtitle={`${entry.category || "Feat"}${entry.prerequisites ? ` • ${entry.prerequisites}` : ""}`}
          onSelect={() => addFeat(entry)}
        />
      ));
    } else {
      title = "Add Class Feature";
      entries = filteredTraits.map((entry) => (
        <PickerRow
          key={entry.key}
          title={entry.name}
          subtitle={`${entry.className} • Level ${entry.level}`}
          onSelect={() => addTrait(entry.name)}
        />
      ));
    }

    return (
      <ModalFrame onClose={() => setPicker(null)} backdropClassName="bg-black/70" panelClassName="max-w-3xl border-amber-700/60 bg-zinc-950">
        <>
          <div className="flex items-center justify-between border-b border-amber-800/30 px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-amber-400/80">Compendium</p>
              <h3 className="mt-2 text-xl font-semibold text-amber-50">{title}</h3>
            </div>
            <button type="button" className={iconDeleteButton} onClick={() => setPicker(null)}>
              <X size={14} />
            </button>
          </div>
          <div className="border-b border-amber-800/30 px-5 py-4">
            <Field label="Search">
              <input
                className={inputClass}
                value={picker.query}
                onChange={(event) => setPicker({ ...picker, query: event.target.value })}
              />
            </Field>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            <div className="space-y-2">{entries}</div>
          </div>
        </>
      </ModalFrame>
    );
  }

  return (
    <section className="space-y-4 bg-[#0b0b0d] text-zinc-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-amber-800/40 bg-zinc-950 px-4 py-3">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-amber-400/80">{draft.kind === "npc" ? "NPC Sheet" : "Character Sheet"}</p>
            <h2 className="mt-1 text-2xl font-semibold text-amber-50">{draft.name}</h2>
          </div>
          <span className="border border-amber-800/40 px-2 py-1 text-xs uppercase tracking-[0.22em] text-zinc-300">{draft.kind}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={toolbarGhostButton} disabled={!canEdit || saving} onClick={() => void saveCurrent()}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" className={toolbarGhostButton} disabled={!canEdit || draft.classes.length === 0} onClick={startShortRest}>
            Short Rest
          </button>
          <button type="button" className={toolbarGhostButton} disabled={!canEdit} onClick={() => void handleLongRest()}>
            Long Rest
          </button>
          <button type="button" className={toolbarGhostButton} disabled={!canEdit} onClick={() => setLayoutEditing((current) => !current)}>
            {layoutEditing ? "Finish Layout" : "Edit Layout"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {[1, 2, 3].map((column) => (
          <div key={column} className="space-y-4">
            {normalizedLayout
              .filter((entry) => entry.column === column)
              .sort((left, right) => left.order - right.order)
              .map((entry) => (
                <div key={entry.sectionId}>{sections[entry.sectionId as SheetSectionId]}</div>
              ))}
          </div>
        ))}
      </div>

      {picker && renderPicker()}
      {shortRestOpen && (
        <RestDialog
          classes={draft.classes}
          constitutionModifier={abilityModifierTotal(draft, "con")}
          selections={hitDiceSelections}
          onChange={(classId, nextValue) => setHitDiceSelections((current) => ({ ...current, [classId]: nextValue }))}
          onCancel={() => setShortRestOpen(false)}
          onConfirm={() => void confirmShortRest()}
        />
      )}
    </section>
  );
}

function ensureLayout(layout: ActorSheet["layout"]) {
  const knownEntries = new Map(layout.map((entry) => [entry.sectionId, entry]));

  return (Object.keys(sectionDefaults) as SheetSectionId[])
    .map((sectionId) => knownEntries.get(sectionId) ?? { sectionId, ...sectionDefaults[sectionId] })
    .sort((left, right) => left.order - right.order);
}

function requiresTargetKey(targetType: ActorBonusEntry["targetType"]) {
  return targetType === "ability" || targetType === "skill" || targetType === "savingThrow";
}

function renderBonusTargetOptions(targetType: ActorBonusEntry["targetType"], skills: SkillEntry[]) {
  if (targetType === "ability" || targetType === "savingThrow") {
    return abilityOrder.map((entry) => (
      <option key={entry.key} value={entry.key}>
        {entry.label}
      </option>
    ));
  }

  if (targetType === "skill") {
    return skills.map((entry) => (
      <option key={entry.id} value={entry.name}>
        {entry.name}
      </option>
    ));
  }

  return null;
}

function guessSpellcastingAbility(entry: ClassEntry): AbilityKey | null {
  const featureNames = entry.features.map((feature) => normalizeKey(feature.name));
  const hasSpellcasting = featureNames.some((name) => name.includes("spellcasting"));

  if (!hasSpellcasting) {
    return null;
  }

  const lowerAbilities = entry.primaryAbilities.map((ability) => ability.toLowerCase());

  if (lowerAbilities.some((entry) => entry.includes("int"))) {
    return "int";
  }
  if (lowerAbilities.some((entry) => entry.includes("wis"))) {
    return "wis";
  }
  if (lowerAbilities.some((entry) => entry.includes("cha"))) {
    return "cha";
  }

  return null;
}

function finalizeDraftForSave(actor: ActorSheet, proficiencyBonus: number) {
  const next = cloneActor(actor);
  next.level = totalLevel(next);
  next.proficiencyBonus = proficiencyBonus;
  next.className = next.classes.map((entry) => entry.name).join(" / ") || next.className;
  next.armorClass = derivedArmorClass(next);
  next.speed = next.speed;
  next.hitPoints.current = Math.min(next.hitPoints.current, next.hitPoints.max);
  next.preparedSpells = next.preparedSpells.filter((entry) => next.spells.includes(entry));
  next.layout = ensureLayout(next.layout);
  return next;
}

function rollDie(faces: number) {
  return Math.floor(Math.random() * faces) + 1;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm text-zinc-300">
      <span className="block text-[11px] uppercase tracking-[0.22em] text-amber-400/80">{label}</span>
      {children}
    </label>
  );
}

function StatBox({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="space-y-1 border border-amber-800/30 bg-zinc-900/70 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.22em] text-amber-400/80">{label}</p>
      <p className="text-2xl font-semibold text-amber-50">{value}</p>
      {detail ? <p className="text-xs text-zinc-500">{detail}</p> : null}
    </div>
  );
}

function DotToggle({ active, disabled, onToggle, label }: { active: boolean; disabled?: boolean; onToggle: () => void; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-500/70 transition hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
      onClick={onToggle}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-amber-400" : "bg-transparent"}`} />
    </button>
  );
}

function DotTrack({
  total,
  active,
  disabled,
  onChange
}: {
  total: number;
  active: number;
  disabled?: boolean;
  onChange: (nextValue: number) => void;
}) {
  if (total <= 0) {
    return <p className="text-xs text-zinc-500">No slots</p>;
  }

  if (total > 12) {
      return (
      <NumericInput className={inputClass} min="0" max={total} value={active} disabled={disabled} onValueChange={(value) => onChange(value ?? 0)} />
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: total }, (_, index) => {
        const nextValue = index + 1;
        const isActive = index < active;

        return (
          <button
            key={index}
            type="button"
            disabled={disabled}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-500/70 transition hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onChange(isActive && active === nextValue ? nextValue - 1 : nextValue)}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${isActive ? "bg-amber-400" : "bg-transparent"}`} />
          </button>
        );
      })}
    </div>
  );
}

function PickerRow({ title, subtitle, onSelect }: { title: string; subtitle: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      className="flex w-full items-start justify-between border border-amber-800/30 bg-zinc-950/70 px-4 py-3 text-left transition hover:border-amber-600/70 hover:bg-zinc-900"
      onClick={onSelect}
    >
      <div>
        <p className="text-sm font-medium text-amber-50">{title}</p>
        <p className="mt-1 text-xs text-zinc-400">{subtitle}</p>
      </div>
      <Plus size={14} className="mt-1 text-amber-400" />
    </button>
  );
}

function SpellGroupCard({
  title,
  groups,
  onRemove
}: {
  title: string;
  groups: Array<[string, string[]]>;
  onRemove?: (name: string) => void;
}) {
  return (
    <div className="space-y-3 border border-amber-800/30 bg-zinc-950/70 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium uppercase tracking-[0.22em] text-amber-400/80">{title}</h4>
      </div>
      {groups.length === 0 ? (
        <p className="text-sm text-zinc-500">None selected.</p>
      ) : (
        <div className="space-y-3">
          {groups.map(([group, values]) => (
            <div key={group} className="space-y-2">
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">{group}</p>
              <div className="flex flex-wrap gap-2">
                {values.map((value) => (
                  <span
                    key={value}
                    className="inline-flex items-center gap-2 border border-amber-800/30 bg-zinc-900 px-2.5 py-1 text-xs text-amber-50"
                  >
                    {value}
                    {onRemove && (
                      <button type="button" className="text-zinc-400 hover:text-amber-200" onClick={() => onRemove(value)}>
                        <X size={12} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputClass =
  "w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-600/70";
const toolbarGhostButton =
  "inline-flex items-center gap-2 border border-amber-800/50 px-3 py-2 text-sm text-zinc-200 transition hover:border-amber-600/70 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-40";
const rollButton =
  "inline-flex items-center justify-center border border-amber-700/60 px-3 py-2 text-sm text-amber-50 transition hover:bg-amber-500 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40";
const rollTextButton =
  "text-sm font-medium text-amber-300 transition hover:text-amber-200 disabled:cursor-not-allowed disabled:text-zinc-500";
const iconDeleteButton =
  "inline-flex h-9 w-9 items-center justify-center border border-zinc-800 text-zinc-300 transition hover:border-red-500/60 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40";
