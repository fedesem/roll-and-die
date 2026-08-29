import type { ActorSheet, InventoryEntry } from "@shared/types";
import { Backpack, BookOpen, Brain, Coins, Heart, Shield, Sparkles, WandSparkles, Zap } from "lucide-react";
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
  miniButtonClass,
  PortraitCard,
  SectionCard,
  secondaryButtonClass,
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
    <div className={`grid gap-3 xl:grid-cols-3 ${permissions.mainTabInteractive ? "" : "pointer-events-none opacity-75 select-none"}`}>
      <div className="space-y-3">
        <SectionCard title="Main" icon={<Shield size={14} />}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <PortraitCard actor={draft} compact />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-serif text-xl text-amber-50">{draft.name || "Unnamed Actor"}</h3>
                  <div className="flex items-center gap-1">
                    <CircleToggle
                      checked={draft.inspiration}
                      label={draft.inspiration ? "Inspiration active" : "Inspiration inactive"}
                      onClick={() => mutators.updateField("inspiration", !draft.inspiration)}
                    />
                    <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-400">INS</span>
                  </div>
                </div>
                <p className="truncate text-xs text-zinc-400">
                  {[draft.species || "No species", draft.className || "No class", draft.background || "No background"].join(" • ")}
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
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
          <div className="min-w-0">
            <ExhaustionTrack
              level={draft.exhaustionLevel}
              onChange={(level) => mutators.updateField("exhaustionLevel", level)}
              condition={derived.exhaustionCondition}
              renderText={renderRulesText}
            />
          </div>
        </SectionCard>

        <SectionCard title="Abilities" icon={<Brain size={14} />}>
          <div className="grid grid-cols-2 gap-2">
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

        <SectionCard title="Skills" icon={<Sparkles size={14} />}>
          <div className="grid gap-1.5">
            {draft.skills.map((skill) => {
              const total = skillTotal(derived.actorWithDerivedNumbers, skill);
              const proficiencyLabel = skill.expertise ? "Exp" : skill.proficient ? "Prof" : "";
              return (
                <div
                  key={skill.id}
                  className="cursor-pointer border border-white/8 bg-black/20 px-2 py-1.5 transition hover:border-amber-500/60"
                  onClick={() => void actions.handleRoll(total, `${skill.name} check`)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs text-zinc-100">{skill.name}</p>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{skill.ability}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {proficiencyLabel ? (
                        <span className="text-[10px] uppercase tracking-[0.14em] text-amber-400">{proficiencyLabel}</span>
                      ) : null}
                      <span className="font-mono text-xs text-amber-200">{formatModifier(total)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <div className="space-y-3">
        <SectionCard title="Vitals" icon={<Heart size={14} />}>
          <HitPointBar
            current={derived.hitPointDisplay.current}
            damage={derived.hitPointDisplay.damage}
            temp={derived.hitPointDisplay.temp}
            effectiveMax={derived.hitPointDisplay.effectiveMax}
            baseMax={derived.hitPointDisplay.baseMax}
            reducedMax={derived.hitPointDisplay.reducedMax}
          />
          <div className="grid gap-1.5 sm:grid-cols-3">
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

        <SectionCard title="Action Economy & Masteries" icon={<Zap size={14} />}>
          <div className="flex flex-wrap gap-1 border-b border-white/5 pb-2">
            {(["all", "action", "bonus", "reaction", "mastery"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider transition ${
                  actionTab === tab ? "bg-amber-500 text-zinc-950" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                }`}
                onClick={() => setActionTab(tab)}
              >
                {tab === "bonus" ? "Bonus Action" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="space-y-1.5 pt-1">
            {displayedActionItems.length > 0 ? (
              displayedActionItems.map((item) => (
                <div
                  key={item.id}
                  className={`border border-white/8 bg-black/20 p-2 transition ${
                    item.rollPayload ? "cursor-pointer hover:border-amber-500/60" : ""
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
                    <p className="text-xs font-medium text-zinc-100">{item.name}</p>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90">{item.actionCost}</span>
                  </div>
                  {item.subtitle ? <p className="mt-0.5 text-[10px] text-zinc-400">{item.subtitle}</p> : null}
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-500">No {actionTab} items available.</p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Spellcasting" icon={<WandSparkles size={14} />}>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="border border-white/8 bg-black/20 px-2 py-2 text-zinc-100">
              <p className="text-[9px] uppercase tracking-[0.18em] text-amber-400/80">Concentration</p>
              <div className="mt-1 flex items-center gap-2">
                <CircleToggle
                  checked={draft.concentration}
                  label={draft.concentration ? "Concentration active" : "Concentration inactive"}
                  onClick={() => mutators.updateField("concentration", !draft.concentration)}
                  size="xs"
                />
                <span className="text-sm font-medium text-amber-50">{draft.concentration ? "Active" : "Off"}</span>
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
            <div className="flex items-center justify-between border border-white/5 bg-black/10 px-2.5 py-1.5 text-xs">
              <span className="text-zinc-400">Prepared Spells:</span>
              <span className="font-mono text-amber-300">
                {draft.preparedSpells.length} prepared • wizard target {derived.preparedSpellLimit}
              </span>
            </div>
          ) : null}

          <div className="space-y-2">
            {derived.derivedSpellSlots.filter((entry) => entry.total > 0).length === 0 ? (
              <p className="text-xs text-zinc-500">No spell slots on this sheet yet.</p>
            ) : (
              derived.derivedSpellSlots
                .filter((entry) => entry.total > 0)
                .map((slot) => (
                  <div key={slot.level} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-200">Level {slot.level}</span>
                      <span className="text-zinc-500">
                        {slot.total - slot.used}/{slot.total}
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

        <SectionCard title="Resources" icon={<Heart size={14} />}>
          <div className="space-y-2">
            {derived.displayedResources.map((resource) => (
              <div key={resource.id} className="space-y-1 border border-white/8 bg-black/20 p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-zinc-100">{resource.name}</p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                    {resource.current}/{resource.max}
                  </p>
                </div>
                <UsableTrack
                  total={Math.max(resource.max, 0)}
                  available={resource.current}
                  onChange={(available) => mutators.updateResourceById(resource.id, { current: available })}
                />
              </div>
            ))}
            {derived.displayedResources.length === 0 ? <p className="text-xs text-zinc-500">No resources tracked yet.</p> : null}
          </div>
        </SectionCard>
      </div>

      <div className="space-y-3">
        <SectionCard title="Features" icon={<Sparkles size={16} />}>
          <DetailCollection
            entries={derived.featureRows}
            emptyMessage="No species, background, class, feat, or feature data is available yet."
            renderText={renderRulesText}
          />
        </SectionCard>

        <SectionCard title="Spells" icon={<BookOpen size={16} />}>
          <DetailCollection
            title="Spell List"
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
            headerAction={
              derived.canPrepareSpells ? (
                <button type="button" className={secondaryButtonClass} onClick={() => actions.setSpellSelectionTarget("mainPrepared")}>
                  Prepare Spells
                </button>
              ) : null
            }
            renderText={renderRulesText}
          />
        </SectionCard>

        <SectionCard title="Inventory & Encumbrance" icon={<Backpack size={16} />}>
          <div className="space-y-2 border border-white/8 bg-black/20 p-2.5 text-xs">
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
            <div className="h-1.5 w-full overflow-hidden bg-white/10">
              <div
                className={`h-full transition-all ${
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
                Items: {carryingCapacity.itemWeight} lbs • Coins: {carryingCapacity.coinWeight} lbs
              </span>
              <span className="font-medium text-amber-300">Attuned: {attunement.count} / 3</span>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-5">
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
          <div className="space-y-3">
            {draft.inventory.map((item, index) => (
              <div key={item.id} className="grid gap-2 border border-white/8 bg-black/20 p-2 md:grid-cols-[1.6fr,0.6fr,0.6fr,0.8fr,1fr]">
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
                <div className="flex items-center gap-3 pt-6 text-xs text-zinc-300">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={item.equipped}
                      onChange={(event) => mutators.updateInventory(index, { equipped: event.target.checked })}
                    />
                    Equipped
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={Boolean(item.attuned)}
                      onChange={(event) => mutators.updateInventory(index, { attuned: event.target.checked })}
                    />
                    Attuned
                  </label>
                </div>
              </div>
            ))}
            <button
              type="button"
              className={miniButtonClass}
              onClick={() =>
                mutators.updateDraft((current) => ({
                  ...current,
                  inventory: [...current.inventory, createInventoryEntry()]
                }))
              }
            >
              Add Item
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Notes" icon={<Coins size={16} />}>
          <textarea
            className={textareaClassCompact}
            rows={4}
            value={draft.notes}
            onChange={(event) => mutators.updateField("notes", event.target.value)}
          />
        </SectionCard>
      </div>
    </div>
  );
}
