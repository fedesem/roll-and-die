import type { ActorSheet, InventoryEntry } from "@shared/types";
import { Backpack, BookOpen, Brain, Coins, Heart, Plus, Shield, Sparkles, WandSparkles, Zap } from "lucide-react";
import { type ReactNode, useState } from "react";

import { CircleToggle } from "../../../components/CircleToggle";
import { NumericInput } from "../../../components/NumericInput";
import type { PlayerNpcSheetActions, PlayerNpcSheetMutators } from "../hooks/usePlayerNpcSheetController";
import type { PlayerNpcSheetDerivedState, PlayerNpcSheetPermissions } from "../hooks/usePlayerNpcSheetDerived";
import { createInventoryEntry, updateHitPoints } from "../selectors/playerNpcSheet2024Mutations";
import { deriveActionEconomyGroups, deriveAttunementCount, deriveCarryingCapacity } from "../selectors/playerNpcSheet2024Selectors";
import {
  abilityModifier,
  abilityOrder,
  abilityScoreTotal,
  currencyOrder,
  formatModifier,
  savingThrowTotal,
  skillTotal
} from "../sheetUtils";
import {
  AbilityMiniCard,
  CompactStatChip,
  DeathSaveTracker,
  DetailCollection,
  ExhaustionTrack,
  Field,
  HitPointBar,
  inputClassCompact,
  PortraitCard,
  SectionCard,
  SheetButton,
  textareaClassCompact,
  UsableTrack
} from "./sheetPrimitives";

interface PlayerNpcSheetMainTabProps {
  draft: ActorSheet;
  derived: PlayerNpcSheetDerivedState;
  permissions: PlayerNpcSheetPermissions;
  mutators: PlayerNpcSheetMutators;
  actions: PlayerNpcSheetActions;
  renderRulesText: (text: string) => ReactNode;
}

export function PlayerNpcSheetMainTab({ draft, derived, permissions, mutators, actions, renderRulesText }: PlayerNpcSheetMainTabProps) {
  const [actionTab, setActionTab] = useState<"all" | "action" | "bonus" | "reaction" | "mastery">("all");
  const carryingCapacity = deriveCarryingCapacity(draft);
  const attunement = deriveAttunementCount(draft);
  const actionEconomy = deriveActionEconomyGroups(draft, { spells: [] });

  const displayedActionItems =
    actionTab === "all"
      ? [...actionEconomy.action, ...actionEconomy.bonus, ...actionEconomy.reaction, ...actionEconomy.mastery, ...actionEconomy.free]
      : actionEconomy[actionTab];

  return (
    <div className={`grid gap-4 xl:grid-cols-3 ${permissions.mainTabInteractive ? "" : "pointer-events-none opacity-75 select-none"}`}>
      {/* LEFT COLUMN: IDENTITY, ABILITIES, SKILLS */}
      <div className="space-y-4">
        {/* HERO / MAIN CARD */}
        <SectionCard title="Character" icon={<Shield size={16} />}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3.5">
              <PortraitCard actor={draft} compact />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-serif text-xl font-bold text-amber-50">{draft.name || "Unnamed Actor"}</h3>
                  <div
                    className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 border transition cursor-pointer ${
                      draft.inspiration
                        ? "border-amber-400/60 bg-amber-500/20 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                        : "border-white/10 bg-slate-900 text-zinc-400"
                    }`}
                    onClick={() => mutators.updateField("inspiration", !draft.inspiration)}
                    title={draft.inspiration ? "Inspiration active (Click to toggle)" : "Inspiration inactive (Click to grant)"}
                  >
                    <CircleToggle
                      checked={draft.inspiration}
                      label={draft.inspiration ? "Inspiration active" : "Inspiration inactive"}
                      onClick={() => mutators.updateField("inspiration", !draft.inspiration)}
                      size="xs"
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider">INS</span>
                  </div>
                </div>
                <p className="truncate text-xs text-zinc-400 mt-0.5">
                  {[draft.species || "No species", draft.className || "No class", draft.background || "No background"].join(" • ")}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
            <CompactStatChip label="Level" value={String(derived.totalActorLevel)} />
            <CompactStatChip label="AC" value={String(derived.armorClass)} />
            <CompactStatChip label="Speed" value={`${derived.speed} ft`} />
            <CompactStatChip label="PB" value={formatModifier(derived.proficiencyBonus)} />
            <CompactStatChip
              label="Initiative"
              value={
                draft.initiativeRoll !== null && draft.initiativeRoll !== undefined
                  ? String(draft.initiativeRoll)
                  : formatModifier(derived.initiativeBonus)
              }
              onClick={() => void actions.handleInitiativeRoll()}
            />
            <CompactStatChip label="Spell DC" value={String(derived.spellSave)} />
            <CompactStatChip
              label="Spell Attack"
              value={formatModifier(derived.spellAttack)}
              onClick={() => void actions.handleRoll(derived.spellAttack, "spell attack")}
            />
            <CompactStatChip label="XP" value={String(draft.experience)} />
          </div>

          <div className="min-w-0 pt-1">
            <ExhaustionTrack
              level={draft.exhaustionLevel}
              onChange={(level) => mutators.updateField("exhaustionLevel", level)}
              condition={derived.exhaustionCondition}
              renderText={renderRulesText}
            />
          </div>
        </SectionCard>

        {/* ABILITY SCORES */}
        <SectionCard title="Abilities & Saves" icon={<Brain size={16} />}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {abilityOrder.map((ability) => {
              const score = abilityScoreTotal(derived.actorWithDerivedNumbers, ability.key);
              const modifier = abilityModifier(score);
              const save = savingThrowTotal(derived.actorWithDerivedNumbers, ability.key);
              return (
                <AbilityMiniCard
                  key={ability.key}
                  label={ability.label}
                  score={score}
                  modifier={modifier}
                  save={save}
                  onCheck={() => void actions.handleRoll(modifier, `${ability.label} check`)}
                  onSave={() => void actions.handleRoll(save, `${ability.label} save`)}
                />
              );
            })}
          </div>
        </SectionCard>

        {/* SKILLS */}
        <SectionCard title="Skills" icon={<Sparkles size={16} />}>
          <div className="grid gap-1.5">
            {draft.skills.map((skill) => {
              const total = skillTotal(derived.actorWithDerivedNumbers, skill);
              const proficiencyLabel = skill.expertise ? "EXP" : skill.proficient ? "PROF" : "";
              return (
                <div
                  key={skill.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-white/8 bg-slate-900/60 px-3 py-2 transition hover:border-amber-500/60 hover:bg-slate-850 cursor-pointer"
                  onClick={() => void actions.handleRoll(total, `${skill.name} check`)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-zinc-100">{skill.name}</p>
                    <p className="text-[9px] uppercase tracking-wider text-zinc-400">{skill.ability}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {proficiencyLabel ? (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                          skill.expertise ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-slate-800 text-zinc-300"
                        }`}
                      >
                        {proficiencyLabel}
                      </span>
                    ) : null}
                    <span className="font-mono text-xs font-bold text-amber-200">{formatModifier(total)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* CENTER COLUMN: VITALS, ACTIONS, SPELLCASTING, RESOURCES */}
      <div className="space-y-4">
        {/* VITALS */}
        <SectionCard title="Health & Vitals" icon={<Heart size={16} />}>
          <HitPointBar
            current={derived.hitPointDisplay.current}
            damage={derived.hitPointDisplay.damage}
            temp={derived.hitPointDisplay.temp}
            effectiveMax={derived.hitPointDisplay.effectiveMax}
            baseMax={derived.hitPointDisplay.baseMax}
            reducedMax={derived.hitPointDisplay.reducedMax}
          />
          <div className="grid gap-2 grid-cols-3">
            <Field label="HP" hint="Current hit points after damage is applied.">
              <NumericInput
                className={inputClassCompact}
                min={0}
                max={derived.hitPointDisplay.effectiveMax}
                value={draft.hitPoints.current}
                title="Current hit points after damage is applied."
                onValueChange={(value) => updateHitPoints("current", String(value ?? 0), mutators.updateDraft, derived.derivedHitPointMax)}
              />
            </Field>
            <Field label="THP" hint="Temporary hit points are lost before normal hit points.">
              <NumericInput
                className={inputClassCompact}
                min={0}
                value={draft.hitPoints.temp}
                title="Temporary hit points are lost before normal hit points."
                onValueChange={(value) => updateHitPoints("temp", String(value ?? 0), mutators.updateDraft, derived.derivedHitPointMax)}
              />
            </Field>
            <Field label="Red Max" hint="This reduces the actor's maximum hit points.">
              <NumericInput
                className={inputClassCompact}
                min={0}
                value={draft.hitPoints.reducedMax}
                title="This reduces the actor's maximum hit points."
                onValueChange={(value) =>
                  updateHitPoints("reducedMax", String(value ?? 0), mutators.updateDraft, derived.derivedHitPointMax)
                }
              />
            </Field>
          </div>
          <DeathSaveTracker
            deathSaves={draft.deathSaves}
            onSuccess={() => mutators.recordDeathSave("success")}
            onFailure={() => mutators.recordDeathSave("failure")}
            onReset={mutators.resetDeathSaves}
            onRoll={() => void actions.handleAutomaticDeathSave()}
          />
        </SectionCard>

        {/* ACTIONS & MASTERIES */}
        <SectionCard title="Action Economy & Attacks" icon={<Zap size={16} />}>
          <div className="flex flex-wrap gap-1 border-b border-white/8 pb-2">
            {(["all", "action", "bonus", "reaction", "mastery"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`rounded px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition ${
                  actionTab === tab
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "bg-slate-900/80 text-zinc-400 hover:bg-slate-800 hover:text-zinc-200"
                }`}
                onClick={() => setActionTab(tab)}
              >
                {tab === "bonus" ? "Bonus Action" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="space-y-2 pt-1">
            {displayedActionItems.length > 0 ? (
              displayedActionItems.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-md border border-white/8 bg-slate-900/60 p-2.5 transition ${
                    item.rollPayload ? "cursor-pointer hover:border-amber-500/60 hover:bg-slate-850" : ""
                  }`}
                  onClick={() => {
                    if (item.rollPayload) {
                      if (item.rollPayload.type === "attack" && typeof item.rollPayload.bonus === "number") {
                        void actions.handleRoll(item.rollPayload.bonus, item.rollPayload.label);
                      } else if (item.rollPayload.notation) {
                        void actions.handleNotationRoll(item.rollPayload.notation, item.rollPayload.label);
                      }
                    } else if (item.kind === "mastery") {
                      void actions.handleRoll(0, `Weapon Mastery: ${item.name}`);
                    }
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-zinc-100">{item.name}</p>
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300 border border-amber-500/20">
                      {item.actionCost}
                    </span>
                  </div>
                  {item.subtitle ? <p className="mt-0.5 text-[11px] text-zinc-400">{item.subtitle}</p> : null}
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-500 italic p-2">No {actionTab} items available.</p>
            )}
          </div>
        </SectionCard>

        {/* SPELLCASTING SLOTS */}
        <SectionCard title="Spell Slots & Focus" icon={<WandSparkles size={16} />}>
          <div className="grid gap-2 grid-cols-3">
            <label className="rounded-md border border-white/8 bg-slate-900/80 p-2.5 text-zinc-100 cursor-pointer">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-400/90">Concentration</p>
              <div className="mt-1 flex items-center gap-2">
                <CircleToggle
                  checked={draft.concentration}
                  label={draft.concentration ? "Concentration active" : "Concentration inactive"}
                  onClick={() => mutators.updateField("concentration", !draft.concentration)}
                  size="xs"
                />
                <span className="text-xs font-bold text-amber-50">{draft.concentration ? "Active" : "None"}</span>
              </div>
            </label>
            <CompactStatChip label="Spell DC" value={String(derived.spellSave)} />
            <CompactStatChip
              label="Spell Attack"
              value={formatModifier(derived.spellAttack)}
              onClick={() => void actions.handleRoll(derived.spellAttack, "spell attack")}
            />
          </div>

          {derived.canPrepareSpells ? (
            <div className="flex items-center justify-between rounded-md border border-white/8 bg-slate-900/60 px-3 py-2 text-xs">
              <span className="text-zinc-400">Prepared Spells:</span>
              <span className="font-mono font-semibold text-amber-300">
                {draft.preparedSpells.length} / {derived.preparedSpellLimit}
              </span>
            </div>
          ) : null}

          <div className="space-y-2.5 pt-1">
            {derived.derivedSpellSlots.filter((entry) => entry.total > 0).length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No spell slots on this sheet.</p>
            ) : (
              derived.derivedSpellSlots
                .filter((entry) => entry.total > 0)
                .map((slot) => (
                  <div key={slot.level} className="space-y-1 rounded-md border border-white/8 bg-slate-900/50 p-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-200">Level {slot.level} Slots</span>
                      <span className="font-mono text-zinc-400">
                        {slot.total - slot.used} / {slot.total} remaining
                      </span>
                    </div>
                    <UsableTrack
                      total={slot.total}
                      available={slot.total - slot.used}
                      onChange={(available) => mutators.updateSpellSlotLevel(slot.level, { used: Math.max(0, slot.total - available) })}
                    />
                  </div>
                ))
            )}
          </div>
        </SectionCard>

        {/* RESOURCES */}
        <SectionCard title="Class Resources" icon={<Heart size={16} />}>
          <div className="space-y-2.5">
            {derived.displayedResources.map((resource) => (
              <div key={resource.id} className="space-y-1.5 rounded-md border border-white/8 bg-slate-900/60 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-zinc-100">{resource.name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-amber-300">
                    {resource.current} / {resource.max}
                  </p>
                </div>
                <UsableTrack
                  total={Math.max(resource.max, 0)}
                  available={resource.current}
                  onChange={(available) => mutators.updateResourceById(resource.id, { current: available })}
                />
              </div>
            ))}
            {derived.displayedResources.length === 0 ? <p className="text-xs text-zinc-500 italic">No class resources tracked.</p> : null}
          </div>
        </SectionCard>
      </div>

      {/* RIGHT COLUMN: FEATURES, SPELLS, INVENTORY, NOTES */}
      <div className="space-y-4">
        {/* FEATURES */}
        <SectionCard title="Features & Traits" icon={<Sparkles size={16} />}>
          <DetailCollection
            entries={derived.featureRows}
            emptyMessage="No features available on this sheet yet."
            renderText={renderRulesText}
          />
        </SectionCard>

        {/* SPELLS */}
        <SectionCard
          title="Spells"
          icon={<BookOpen size={16} />}
          action={
            derived.canPrepareSpells ? (
              <SheetButton variant="secondary" size="sm" onClick={() => actions.setSpellSelectionTarget("mainPrepared")}>
                Prepare Spells
              </SheetButton>
            ) : null
          }
        >
          <DetailCollection
            entries={derived.spellRows.map((entry) => ({
              ...entry,
              onRemove: undefined,
              meta: derived.canPrepareSpells
                ? [
                    ...(entry.meta ?? []),
                    {
                      label: "Preparation",
                      value: derived.spellCollections.alwaysPrepared.includes(entry.title)
                        ? "Always Prepared"
                        : draft.preparedSpells.includes(entry.title)
                          ? "Prepared"
                          : derived.spellCollections.preparable.includes(entry.title)
                            ? "Available"
                            : "Known"
                    }
                  ]
                : entry.meta
            }))}
            emptyMessage="No spells on this sheet yet."
            renderText={renderRulesText}
          />
        </SectionCard>

        {/* INVENTORY & ENCUMBRANCE */}
        <SectionCard title="Inventory & Encumbrance" icon={<Backpack size={16} />}>
          <div className="space-y-2 rounded-md border border-white/10 bg-slate-900/80 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Weight Carried:</span>
              <span
                className={`font-semibold ${
                  carryingCapacity.encumbranceStatus === "normal"
                    ? "text-emerald-400"
                    : carryingCapacity.encumbranceStatus === "encumbered"
                      ? "text-amber-400"
                      : "text-rose-400"
                }`}
              >
                {carryingCapacity.totalCarriedWeight} / {carryingCapacity.carryingCapacity} lbs
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950">
              <div
                className={`h-full transition-all duration-300 ${
                  carryingCapacity.encumbranceStatus === "normal"
                    ? "bg-emerald-500"
                    : carryingCapacity.encumbranceStatus === "encumbered"
                      ? "bg-amber-500"
                      : "bg-rose-500"
                }`}
                style={{
                  width: `${Math.min(100, Math.round((carryingCapacity.totalCarriedWeight / Math.max(1, carryingCapacity.carryingCapacity)) * 100))}%`
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>
                Gear: {carryingCapacity.itemWeight} lbs • Coins: {carryingCapacity.coinWeight} lbs
              </span>
              <span className="font-semibold text-amber-300">Attuned: {attunement.count} / 3</span>
            </div>
          </div>

          <div className="grid gap-2 grid-cols-5">
            {currencyOrder.map((currencyKey) => (
              <Field key={currencyKey} label={currencyKey.toUpperCase()}>
                <NumericInput
                  className={inputClassCompact}
                  value={draft.currency[currencyKey]}
                  onValueChange={(value) =>
                    mutators.updateField("currency", {
                      ...draft.currency,
                      [currencyKey]: value ?? 0
                    })
                  }
                />
              </Field>
            ))}
          </div>

          <div className="space-y-2.5">
            {draft.inventory.map((item, index) => (
              <div
                key={item.id}
                className="grid gap-2 rounded-md border border-white/8 bg-slate-900/60 p-2.5 md:grid-cols-[1.6fr,0.6fr,0.6fr,0.8fr,1fr]"
              >
                <Field label="Item">
                  <input
                    className={inputClassCompact}
                    value={item.name}
                    onChange={(event) => mutators.updateInventory(index, { name: event.target.value })}
                  />
                </Field>
                <Field label="Qty">
                  <NumericInput
                    className={inputClassCompact}
                    value={item.quantity}
                    onValueChange={(value) => mutators.updateInventory(index, { quantity: value ?? 0 })}
                  />
                </Field>
                <Field label="Lbs">
                  <NumericInput
                    className={inputClassCompact}
                    value={item.weight ?? 0}
                    onValueChange={(value) => mutators.updateInventory(index, { weight: value ?? 0 })}
                  />
                </Field>
                <Field label="Type">
                  <select
                    className={inputClassCompact}
                    value={item.type}
                    onChange={(event) => mutators.updateInventory(index, { type: event.target.value as InventoryEntry["type"] })}
                  >
                    <option value="gear">Gear</option>
                    <option value="reagent">Reagent</option>
                    <option value="loot">Loot</option>
                    <option value="consumable">Consumable</option>
                  </select>
                </Field>
                <div className="flex items-center gap-3 pt-5 text-xs text-zinc-300">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.equipped}
                      onChange={(event) => mutators.updateInventory(index, { equipped: event.target.checked })}
                      className="accent-amber-500 rounded"
                    />
                    Eq
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(item.attuned)}
                      onChange={(event) => mutators.updateInventory(index, { attuned: event.target.checked })}
                      className="accent-amber-500 rounded"
                    />
                    Att
                  </label>
                </div>
              </div>
            ))}
            <SheetButton
              variant="secondary"
              size="sm"
              icon={<Plus size={13} />}
              onClick={() =>
                mutators.updateDraft((current) => ({
                  ...current,
                  inventory: [...current.inventory, createInventoryEntry()]
                }))
              }
            >
              Add Item
            </SheetButton>
          </div>
        </SectionCard>

        {/* NOTES */}
        <SectionCard title="Quick Notes" icon={<Coins size={16} />}>
          <textarea
            className={textareaClassCompact}
            rows={4}
            value={draft.notes}
            onChange={(event) => mutators.updateField("notes", event.target.value)}
            placeholder="Campaign clues, quest reminders, session notes..."
          />
        </SectionCard>
      </div>
    </div>
  );
}
