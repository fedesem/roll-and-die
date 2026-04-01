import { Backpack, BookOpen, Brain, Coins, Heart, Shield, Sparkles, Swords, WandSparkles } from "lucide-react";
import type { ReactNode } from "react";

import type { ActorSheet, InventoryEntry } from "@shared/types";

import { CircleToggle } from "../../../components/CircleToggle";
import { NumericInput } from "../../../components/NumericInput";
import type { PlayerNpcSheetActions, PlayerNpcSheetMutators } from "../hooks/usePlayerNpcSheetController";
import type { PlayerNpcSheetDerivedState, PlayerNpcSheetPermissions } from "../hooks/usePlayerNpcSheetDerived";
import { createInventoryEntry, updateHitPoints } from "../selectors/playerNpcSheet2024Mutations";
import { abilityModifier, abilityOrder, abilityScoreTotal, currencyOrder, formatModifier, savingThrowTotal, skillTotal } from "../sheetUtils";
import {
  AbilityMiniCard,
  CompactStatChip,
  DeathSaveTracker,
  DetailCollection,
  ExhaustionTrack,
  Field,
  HitPointBar,
  PortraitCard,
  SectionCard,
  UsableTrack,
  inputClassCompact,
  miniButtonClass,
  secondaryButtonClass,
  textareaClassCompact
} from "./sheetPrimitives";

interface PlayerNpcSheetMainTabProps {
  draft: ActorSheet;
  derived: PlayerNpcSheetDerivedState;
  permissions: PlayerNpcSheetPermissions;
  mutators: PlayerNpcSheetMutators;
  actions: PlayerNpcSheetActions;
  renderRulesText: (text: string) => ReactNode;
}

export function PlayerNpcSheetMainTab({
  draft,
  derived,
  permissions,
  mutators,
  actions,
  renderRulesText
}: PlayerNpcSheetMainTabProps) {
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
                <p className="truncate text-xs text-zinc-400">{[draft.species || "No species", draft.className || "No class", draft.background || "No background"].join(" • ")}</p>
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
              value={draft.initiativeRoll !== null && draft.initiativeRoll !== undefined ? String(draft.initiativeRoll) : formatModifier(draft.initiative)}
              onClick={() => void actions.handleInitiativeRoll()}
            />
            <CompactStatChip label="Spell DC" value={String(derived.spellSave)} />
            <CompactStatChip label="Spell Attack" value={formatModifier(derived.spellAttack)} onClick={() => void actions.handleRoll(derived.spellAttack, "spell attack")} />
          </div>
          <div className="min-w-0">
            <ExhaustionTrack
              level={draft.exhaustionLevel}
              onChange={(level) => mutators.updateField("exhaustionLevel", level)}
              condition={derived.exhaustionCondition}
              renderText={renderRulesText}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="XP" hint="Experience points earned by this actor.">
              <NumericInput className={inputClassCompact} min={0} value={draft.experience} title="Experience points earned by this actor." onValueChange={(value) => mutators.updateField("experience", value ?? 0)} />
            </Field>
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
                      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                        {skill.ability.toUpperCase()}
                        {proficiencyLabel ? ` • ${proficiencyLabel}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-amber-50">{formatModifier(total)}</span>
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
              <NumericInput className={inputClassCompact} min={0} max={derived.hitPointDisplay.effectiveMax} value={draft.hitPoints.current} title="Current hit points after damage is applied." onValueChange={(value) => updateHitPoints("current", String(value ?? 0), mutators.updateDraft, derived.derivedHitPointMax)} />
            </Field>
            <Field label="THP" hint="Temporary hit points are lost before normal hit points.">
              <NumericInput className={inputClassCompact} min={0} value={draft.hitPoints.temp} title="Temporary hit points are lost before normal hit points." onValueChange={(value) => updateHitPoints("temp", String(value ?? 0), mutators.updateDraft, derived.derivedHitPointMax)} />
            </Field>
            <Field label="Red Max" hint="This reduces the actor's maximum hit points.">
              <NumericInput className={inputClassCompact} min={0} value={draft.hitPoints.reducedMax} title="This reduces the actor's maximum hit points." onValueChange={(value) => updateHitPoints("reducedMax", String(value ?? 0), mutators.updateDraft, derived.derivedHitPointMax)} />
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

        <SectionCard title="Attacks & Armor" icon={<Swords size={14} />}>
          <div className="space-y-2">
            {derived.displayedAttacks.length > 0 ? (
              derived.displayedAttacks.map((attack) => (
                <div key={attack.id} className="border border-white/8 bg-black/20 p-2">
                  <p className="text-xs text-zinc-100">{attack.name || "Unnamed Attack"}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                    <span className="cursor-pointer hover:text-amber-50" onClick={() => void actions.handleRoll(attack.attackBonus, `${attack.name} attack`)}>
                      {formatModifier(attack.attackBonus)} to hit
                    </span>
                    {attack.damage ? (
                      <span className="cursor-pointer hover:text-amber-50" onClick={() => void actions.handleNotationRoll(attack.damage, `${attack.name} damage`)}>
                        {attack.damage} {attack.damageType}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-500">No attacks are available yet.</p>
            )}
          </div>
          {derived.displayedArmorItems.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {derived.displayedArmorItems.filter((entry) => entry.equipped).map((entry) => (
                <span key={entry.id} className="border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-300">
                  {entry.name} • AC {entry.armorClass + entry.bonus}
                </span>
              ))}
            </div>
          ) : null}
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
            <CompactStatChip label="Spell Attack" value={formatModifier(derived.spellAttack)} onClick={() => void actions.handleRoll(derived.spellAttack, "spell attack")} />
          </div>
          <div className="space-y-2">
            {derived.derivedSpellSlots.filter((entry) => entry.total > 0).length === 0 ? (
              <p className="text-xs text-zinc-500">No spell slots on this sheet yet.</p>
            ) : (
              derived.derivedSpellSlots.filter((entry) => entry.total > 0).map((slot) => (
                <div key={slot.level} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-200">Level {slot.level}</span>
                    <span className="text-zinc-500">
                      {slot.total - slot.used}/{slot.total}
                    </span>
                  </div>
                  <UsableTrack total={slot.total} available={slot.total - slot.used} onChange={(available) => mutators.updateSpellSlotLevel(slot.level, { used: Math.max(0, slot.total - available) })} />
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
                <UsableTrack total={Math.max(resource.max, 0)} available={resource.current} onChange={(available) => mutators.updateResourceById(resource.id, { current: available })} />
              </div>
            ))}
            {derived.displayedResources.length === 0 ? <p className="text-xs text-zinc-500">No resources tracked yet.</p> : null}
          </div>
        </SectionCard>
      </div>

      <div className="space-y-3">
        <SectionCard title="Features" icon={<Sparkles size={16} />}>
          <DetailCollection entries={derived.featureRows} emptyMessage="No species, background, class, feat, or feature data is available yet." renderText={renderRulesText} />
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

        <SectionCard title="Inventory & Currency" icon={<Backpack size={16} />}>
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
              <div key={item.id} className="grid gap-2 border border-white/8 bg-black/20 p-2 md:grid-cols-[1.6fr,0.7fr,0.9fr,1fr]">
                <Field label="Item">
                  <input className={inputClassCompact} value={item.name} onChange={(event) => mutators.updateInventory(index, { name: event.target.value })} />
                </Field>
                <Field label="Qty">
                  <NumericInput className={inputClassCompact} value={item.quantity} onValueChange={(value) => mutators.updateInventory(index, { quantity: value ?? 0 })} />
                </Field>
                <Field label="Type">
                  <select className={inputClassCompact} value={item.type} onChange={(event) => mutators.updateInventory(index, { type: event.target.value as InventoryEntry["type"] })}>
                    <option value="gear">Gear</option>
                    <option value="reagent">Reagent</option>
                    <option value="loot">Loot</option>
                    <option value="consumable">Consumable</option>
                  </select>
                </Field>
                <label className="flex items-center gap-2 pt-7 text-sm text-zinc-300">
                  <input type="checkbox" checked={item.equipped} onChange={(event) => mutators.updateInventory(index, { equipped: event.target.checked })} />
                  Equipped
                </label>
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
          <textarea className={textareaClassCompact} rows={4} value={draft.notes} onChange={(event) => mutators.updateField("notes", event.target.value)} />
        </SectionCard>
      </div>
    </div>
  );
}
