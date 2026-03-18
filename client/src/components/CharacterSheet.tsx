import { useEffect, useMemo, useState } from "react";

import type {
  AbilityKey,
  ActorSheet,
  ArmorEntry,
  AttackEntry,
  CurrencyPouch,
  InventoryEntry,
  MemberRole,
  ResourceEntry,
  SkillEntry,
  SpellSlotTrack
} from "@shared/types";

const abilityOrder: { key: AbilityKey; label: string }[] = [
  { key: "str", label: "STR" },
  { key: "dex", label: "DEX" },
  { key: "con", label: "CON" },
  { key: "int", label: "INT" },
  { key: "wis", label: "WIS" },
  { key: "cha", label: "CHA" }
];

interface CharacterSheetProps {
  actor?: ActorSheet | null;
  role: MemberRole;
  currentUserId: string;
  onSave: (actor: ActorSheet) => Promise<void>;
  onRoll: (notation: string, label: string) => Promise<void>;
}

export function CharacterSheet({ actor, role, currentUserId, onSave, onRoll }: CharacterSheetProps) {
  const [draft, setDraft] = useState<ActorSheet | null>(actor ? cloneActor(actor) : null);

  useEffect(() => {
    setDraft(actor ? cloneActor(actor) : null);
  }, [actor]);

  const canView = useMemo(() => {
    if (!actor) {
      return false;
    }

    return role === "dm" || actor.sheetAccess === "full" || (actor.kind === "character" && actor.ownerId === currentUserId);
  }, [actor, currentUserId, role]);

  const canEdit = useMemo(() => {
    if (!actor) {
      return false;
    }

    return role === "dm" || (actor.kind === "character" && actor.ownerId === currentUserId);
  }, [actor, currentUserId, role]);

  const canRoll = useMemo(() => {
    if (!actor) {
      return false;
    }

    return canView && (role === "dm" || actor.ownerId === currentUserId);
  }, [actor, canView, currentUserId, role]);

  if (!draft || !actor) {
    return (
      <section className="sheet-shell empty-panel">
        <h2>Interactive Sheet</h2>
        <p>Select a character, NPC, or monster to edit the sheet and roll from it.</p>
      </section>
    );
  }

  if (!canView) {
    return (
      <section className="sheet-shell empty-panel">
        <h2>Sheet Locked</h2>
        <p>Players can only open sheets for their own characters. The DM can open every sheet in the campaign.</p>
      </section>
    );
  }

  if (draft.kind === "static") {
    return (
      <section className="sheet-shell monster-sheet-shell">
        <div className="sheet-toolbar">
          <div>
            <p className="panel-label">Static Actor</p>
            <h2>{draft.name}</h2>
            <p className="panel-caption">For vehicles, scenery, siege gear, and other non-character pieces.</p>
          </div>
          {canEdit && (
            <button className="accent-button" type="button" onClick={() => void onSave(draft)}>
              Save
            </button>
          )}
        </div>

        <div className="monster-stat-grid">
          <article className="sheet-panel">
            <div className="sheet-panel-head">
              <h3>Overview</h3>
            </div>
            <div className="sheet-form-grid">
              <label>
                Name
                <input value={draft.name} disabled={!canEdit} onChange={(event) => updateField("name", event.target.value)} />
              </label>
              <label>
                Type
                <input value={draft.species} disabled={!canEdit} onChange={(event) => updateField("species", event.target.value)} />
              </label>
              <label>
                Size
                <input value={draft.className} disabled={!canEdit} onChange={(event) => updateField("className", event.target.value)} />
              </label>
              <label>
                Weight
                <input value={draft.background} disabled={!canEdit} onChange={(event) => updateField("background", event.target.value)} />
              </label>
              <label>
                Accent
                <input type="color" value={draft.color} disabled={!canEdit} onChange={(event) => updateField("color", event.target.value)} />
              </label>
            </div>
          </article>

          <article className="sheet-panel">
            <div className="sheet-panel-head">
              <h3>Description</h3>
            </div>
            <label>
              Description
              <textarea
                rows={12}
                value={draft.notes}
                disabled={!canEdit}
                onChange={(event) => updateField("notes", event.target.value)}
              />
            </label>
          </article>
        </div>
      </section>
    );
  }

  const spellModifier = abilityModifier(draft.abilities[draft.spellcastingAbility]);
  const spellSaveDc = 8 + draft.proficiencyBonus + spellModifier;
  const spellAttack = draft.proficiencyBonus + spellModifier;

  function updateDraft(recipe: (current: ActorSheet) => ActorSheet) {
    setDraft((current) => (current ? recipe(current) : current));
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
      skills: current.skills.map((entry, currentIndex) =>
        currentIndex === index ? { ...entry, ...patch } : entry
      )
    }));
  }

  function updateSpellSlot(index: number, patch: Partial<SpellSlotTrack>) {
    updateDraft((current) => ({
      ...current,
      spellSlots: current.spellSlots.map((entry, currentIndex) =>
        currentIndex === index ? { ...entry, ...patch } : entry
      )
    }));
  }

  function updateAttack(index: number, patch: Partial<AttackEntry>) {
    updateDraft((current) => ({
      ...current,
      attacks: current.attacks.map((entry, currentIndex) =>
        currentIndex === index ? { ...entry, ...patch } : entry
      )
    }));
  }

  function updateArmor(index: number, patch: Partial<ArmorEntry>) {
    updateDraft((current) => ({
      ...current,
      armorItems: current.armorItems.map((entry, currentIndex) =>
        currentIndex === index ? { ...entry, ...patch } : entry
      )
    }));
  }

  function updateResource(index: number, patch: Partial<ResourceEntry>) {
    updateDraft((current) => ({
      ...current,
      resources: current.resources.map((entry, currentIndex) =>
        currentIndex === index ? { ...entry, ...patch } : entry
      )
    }));
  }

  function updateInventory(index: number, patch: Partial<InventoryEntry>) {
    updateDraft((current) => ({
      ...current,
      inventory: current.inventory.map((entry, currentIndex) =>
        currentIndex === index ? { ...entry, ...patch } : entry
      )
    }));
  }

  function updateCurrency(key: keyof CurrencyPouch, value: number) {
    updateDraft((current) => ({
      ...current,
      currency: {
        ...current.currency,
        [key]: value
      }
    }));
  }

  function addAttack() {
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
    }));
  }

  function addArmor() {
    updateDraft((current) => ({
      ...current,
      armorItems: [
        ...current.armorItems,
        {
          id: crypto.randomUUID(),
          name: "Armor Piece",
          armorClass: 10,
          notes: ""
        }
      ]
    }));
  }

  function addResource() {
    updateDraft((current) => ({
      ...current,
      resources: [
        ...current.resources,
        {
          id: crypto.randomUUID(),
          name: "Resource",
          current: 0,
          max: 1,
          resetOn: "Long Rest"
        }
      ]
    }));
  }

  function addInventoryItem() {
    updateDraft((current) => ({
      ...current,
      inventory: [
        ...current.inventory,
        {
          id: crypto.randomUUID(),
          name: "Item",
          quantity: 1
        }
      ]
    }));
  }

  function removeAt<K extends "attacks" | "armorItems" | "resources" | "inventory">(key: K, index: number) {
    updateDraft((current) => ({
      ...current,
      [key]: current[key].filter((_, currentIndex) => currentIndex !== index)
    }));
  }

  if (draft.kind === "monster") {
    return (
      <section className="sheet-shell monster-sheet-shell">
        <div className="sheet-toolbar">
          <div>
            <p className="panel-label">Monster Stat Block</p>
            <h2>{draft.name}</h2>
            <p className="panel-caption">
              CR {draft.challengeRating || "1"} • AC {draft.armorClass} • HP {draft.hitPoints.current}/{draft.hitPoints.max}
            </p>
          </div>
          {canEdit && (
            <button className="accent-button" type="button" onClick={() => void onSave(draft)}>
              Save Stat Block
            </button>
          )}
        </div>

        <div className="monster-stat-grid">
          <article className="sheet-panel">
            <div className="sheet-panel-head">
              <h3>Overview</h3>
              <span className="small-kicker">{draft.species || "Monster"}</span>
            </div>
            <div className="sheet-form-grid">
              <label>
                Name
                <input value={draft.name} disabled={!canEdit} onChange={(event) => updateField("name", event.target.value)} />
              </label>
              <label>
                Source
                <input value={draft.species} disabled={!canEdit} onChange={(event) => updateField("species", event.target.value)} />
              </label>
              <label>
                Challenge
                <input
                  value={draft.challengeRating}
                  disabled={!canEdit}
                  onChange={(event) => updateField("challengeRating", event.target.value)}
                />
              </label>
              <label>
                Speed
                <input
                  type="number"
                  value={draft.speed}
                  disabled={!canEdit}
                  onChange={(event) => updateField("speed", Number(event.target.value || 0))}
                />
              </label>
              <label>
                Vision
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={draft.visionRange}
                  disabled={!canEdit}
                  onChange={(event) => updateField("visionRange", Number(event.target.value || 1))}
                />
              </label>
              <label>
                Accent
                <input type="color" value={draft.color} disabled={!canEdit} onChange={(event) => updateField("color", event.target.value)} />
              </label>
            </div>
            <div className="combat-grid">
              <div className="stat-card">
                <span>Armor Class</span>
                <strong>{draft.armorClass}</strong>
                <input
                  type="number"
                  value={draft.armorClass}
                  disabled={!canEdit}
                  onChange={(event) => updateField("armorClass", Number(event.target.value || 0))}
                />
              </div>
              <div className="stat-card">
                <span>Initiative</span>
                <strong>{formatModifier(draft.initiative)}</strong>
                <input
                  type="number"
                  value={draft.initiative}
                  disabled={!canEdit}
                  onChange={(event) => updateField("initiative", Number(event.target.value || 0))}
                />
              </div>
              <div className="stat-card">
                <span>Proficiency</span>
                <strong>{formatModifier(draft.proficiencyBonus)}</strong>
                <input
                  type="number"
                  value={draft.proficiencyBonus}
                  disabled={!canEdit}
                  onChange={(event) => updateField("proficiencyBonus", Number(event.target.value || 0))}
                />
              </div>
            </div>
            <div className="hp-grid">
              <label>
                Max HP
                <input
                  type="number"
                  value={draft.hitPoints.max}
                  disabled={!canEdit}
                  onChange={(event) => updateField("hitPoints", { ...draft.hitPoints, max: Number(event.target.value || 0) })}
                />
              </label>
              <label>
                Current HP
                <input
                  type="number"
                  value={draft.hitPoints.current}
                  disabled={!canEdit}
                  onChange={(event) => updateField("hitPoints", { ...draft.hitPoints, current: Number(event.target.value || 0) })}
                />
              </label>
              <label>
                Temp HP
                <input
                  type="number"
                  value={draft.hitPoints.temp}
                  disabled={!canEdit}
                  onChange={(event) => updateField("hitPoints", { ...draft.hitPoints, temp: Number(event.target.value || 0) })}
                />
              </label>
            </div>
          </article>

          <article className="sheet-panel">
            <div className="sheet-panel-head">
              <h3>Abilities</h3>
              <span className="small-kicker">Roll checks</span>
            </div>
            <div className="ability-card-grid">
              {abilityOrder.map((ability) => {
                const score = draft.abilities[ability.key];
                const modifier = abilityModifier(score);
                return (
                  <div key={ability.key} className="ability-card">
                    <header>
                      <h4>{ability.label}</h4>
                      <span>{formatModifier(modifier)}</span>
                    </header>
                    <input
                      type="number"
                      value={score}
                      disabled={!canEdit}
                      onChange={(event) => updateAbility(ability.key, Number(event.target.value || 0))}
                    />
                    <button
                      type="button"
                      disabled={!canRoll}
                      onClick={() =>
                        void onRoll(
                          `1d20${modifier >= 0 ? `+${modifier}` : modifier}`,
                          `${draft.name} ${ability.label}`
                        )
                      }
                    >
                      Roll
                    </button>
                  </div>
                );
              })}
            </div>
          </article>
        </div>

        <div className="monster-main-grid">
          <article className="sheet-panel">
            <div className="sheet-panel-head">
              <h3>Traits</h3>
            </div>
            <label>
              Traits
              <textarea
                rows={10}
                value={draft.features.join("\n")}
                disabled={!canEdit}
                onChange={(event) => updateField("features", toLines(event.target.value))}
              />
            </label>
          </article>

          <article className="sheet-panel">
            <div className="sheet-panel-head">
              <h3>Actions</h3>
              {canEdit && (
                <button type="button" onClick={addAttack}>
                  Add
                </button>
              )}
            </div>
            <div className="stack-list">
              {draft.attacks.map((attack, index) => (
                <div key={attack.id} className="editable-card">
                  <div className="editable-card-head">
                    <strong>{attack.name}</strong>
                    <div className="action-line">
                      <button
                        type="button"
                        disabled={!canRoll}
                        onClick={() =>
                          void onRoll(
                            `1d20${attack.attackBonus >= 0 ? `+${attack.attackBonus}` : attack.attackBonus}`,
                            `${draft.name} ${attack.name}`
                          )
                        }
                      >
                        Attack
                      </button>
                      {canEdit && (
                        <button type="button" onClick={() => removeAt("attacks", index)}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="triple-grid">
                    <label>
                      Name
                      <input
                        value={attack.name}
                        disabled={!canEdit}
                        onChange={(event) => updateAttack(index, { name: event.target.value })}
                      />
                    </label>
                    <label>
                      To Hit
                      <input
                        type="number"
                        value={attack.attackBonus}
                        disabled={!canEdit}
                        onChange={(event) => updateAttack(index, { attackBonus: Number(event.target.value || 0) })}
                      />
                    </label>
                    <label>
                      Damage
                      <input
                        value={attack.damage}
                        disabled={!canEdit}
                        onChange={(event) => updateAttack(index, { damage: event.target.value })}
                      />
                    </label>
                  </div>
                  <div className="double-grid">
                    <label>
                      Type
                      <input
                        value={attack.damageType}
                        disabled={!canEdit}
                        onChange={(event) => updateAttack(index, { damageType: event.target.value })}
                      />
                    </label>
                    <label>
                      Text
                      <input
                        value={attack.notes}
                        disabled={!canEdit}
                        onChange={(event) => updateAttack(index, { notes: event.target.value })}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="sheet-panel">
            <div className="sheet-panel-head">
              <h3>Spells</h3>
            </div>
            <label>
              Spells
              <textarea
                rows={10}
                value={draft.spells.join("\n")}
                disabled={!canEdit}
                onChange={(event) => updateField("spells", toLines(event.target.value))}
              />
            </label>
          </article>

          <article className="sheet-panel">
            <div className="sheet-panel-head">
              <h3>Notes</h3>
            </div>
            <label>
              Notes
              <textarea
                rows={10}
                value={draft.notes}
                disabled={!canEdit}
                onChange={(event) => updateField("notes", event.target.value)}
              />
            </label>
          </article>
        </div>
      </section>
    );
  }

  return (
    <section className="sheet-shell">
      <div className="sheet-toolbar">
        <div>
          <p className="panel-label">Character Sheet</p>
          <h2>{draft.name}</h2>
        </div>
        {canEdit && (
          <button className="accent-button" type="button" onClick={() => void onSave(draft)}>
            Save Sheet
          </button>
        )}
      </div>

      <div className="sheet-top-grid">
        <article className="sheet-panel">
          <div className="sheet-panel-head">
            <h3>Character Info</h3>
            <label className="checkbox-pill">
              <input
                type="checkbox"
                checked={draft.inspiration}
                disabled={!canEdit}
                onChange={(event) => updateField("inspiration", event.target.checked)}
              />
              Inspiration
            </label>
          </div>
          <div className="sheet-form-grid">
            <label>
              Name
              <input value={draft.name} disabled={!canEdit} onChange={(event) => updateField("name", event.target.value)} />
            </label>
            <label>
              Level
              <input
                type="number"
                min="1"
                max="20"
                value={draft.level}
                disabled={!canEdit}
                onChange={(event) => updateField("level", Number(event.target.value || 1))}
              />
            </label>
            <label>
              Race / Species
              <input
                value={draft.species}
                disabled={!canEdit}
                onChange={(event) => updateField("species", event.target.value)}
              />
            </label>
            <label>
              Class
              <input
                value={draft.className}
                disabled={!canEdit}
                onChange={(event) => updateField("className", event.target.value)}
              />
            </label>
            <label>
              Background
              <input
                value={draft.background}
                disabled={!canEdit}
                onChange={(event) => updateField("background", event.target.value)}
              />
            </label>
            <label>
              Alignment
              <input
                value={draft.alignment}
                disabled={!canEdit}
                onChange={(event) => updateField("alignment", event.target.value)}
              />
            </label>
            <label>
              Experience
              <input
                type="number"
                value={draft.experience}
                disabled={!canEdit}
                onChange={(event) => updateField("experience", Number(event.target.value || 0))}
              />
            </label>
            <label>
              Proficiency
              <input
                type="number"
                value={draft.proficiencyBonus}
                disabled={!canEdit}
                onChange={(event) => updateField("proficiencyBonus", Number(event.target.value || 0))}
              />
            </label>
            <label>
              Spellcasting
              <select
                value={draft.spellcastingAbility}
                disabled={!canEdit}
                onChange={(event) => updateField("spellcastingAbility", event.target.value as AbilityKey)}
              >
                {abilityOrder.map((ability) => (
                  <option key={ability.key} value={ability.key}>
                    {ability.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Accent
              <input type="color" value={draft.color} disabled={!canEdit} onChange={(event) => updateField("color", event.target.value)} />
            </label>
          </div>
        </article>

        <article className="sheet-panel">
          <div className="sheet-panel-head">
            <h3>Combat</h3>
            <span className="small-kicker">{draft.hitDice}</span>
          </div>
          <div className="combat-grid">
            <div className="stat-card">
              <span>Armor Class</span>
              <strong>{draft.armorClass}</strong>
              <input
                type="number"
                value={draft.armorClass}
                disabled={!canEdit}
                onChange={(event) => updateField("armorClass", Number(event.target.value || 0))}
              />
            </div>
            <div className="stat-card">
              <span>Initiative</span>
              <strong>{formatModifier(draft.initiative)}</strong>
              <input
                type="number"
                value={draft.initiative}
                disabled={!canEdit}
                onChange={(event) => updateField("initiative", Number(event.target.value || 0))}
              />
            </div>
            <div className="stat-card">
              <span>Speed</span>
              <strong>{draft.speed}</strong>
              <input
                type="number"
                value={draft.speed}
                disabled={!canEdit}
                onChange={(event) => updateField("speed", Number(event.target.value || 0))}
              />
            </div>
            <div className="stat-card">
              <span>Vision</span>
              <strong>{draft.visionRange} cells</strong>
              <input
                type="number"
                min="1"
                max="24"
                value={draft.visionRange}
                disabled={!canEdit}
                onChange={(event) => updateField("visionRange", Number(event.target.value || 1))}
              />
            </div>
          </div>
          <div className="hp-grid">
            <label>
              Max HP
              <input
                type="number"
                value={draft.hitPoints.max}
                disabled={!canEdit}
                onChange={(event) =>
                  updateField("hitPoints", { ...draft.hitPoints, max: Number(event.target.value || 0) })
                }
              />
            </label>
            <label>
              Current
              <input
                type="number"
                value={draft.hitPoints.current}
                disabled={!canEdit}
                onChange={(event) =>
                  updateField("hitPoints", { ...draft.hitPoints, current: Number(event.target.value || 0) })
                }
              />
            </label>
            <label>
              Temp
              <input
                type="number"
                value={draft.hitPoints.temp}
                disabled={!canEdit}
                onChange={(event) =>
                  updateField("hitPoints", { ...draft.hitPoints, temp: Number(event.target.value || 0) })
                }
              />
            </label>
          </div>
        </article>

        <article className="sheet-panel">
          <div className="sheet-panel-head">
            <h3>Spell Slots</h3>
            <span className="small-kicker">Save DC {spellSaveDc} • Attack {formatModifier(spellAttack)}</span>
          </div>
          <div className="spell-slot-grid">
            {draft.spellSlots.map((slot, index) => (
              <div key={slot.level} className="slot-card">
                <strong>Level {slot.level}</strong>
                <label>
                  Total
                  <input
                    type="number"
                    min="0"
                    value={slot.total}
                    disabled={!canEdit}
                    onChange={(event) => updateSpellSlot(index, { total: Number(event.target.value || 0) })}
                  />
                </label>
                <label>
                  Used
                  <input
                    type="number"
                    min="0"
                    value={slot.used}
                    disabled={!canEdit}
                    onChange={(event) => updateSpellSlot(index, { used: Number(event.target.value || 0) })}
                  />
                </label>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="sheet-main-grid">
        <article className="sheet-panel">
          <div className="sheet-panel-head">
            <h3>Ability Scores</h3>
            <span className="small-kicker">Click to roll</span>
          </div>
          <div className="ability-card-grid">
            {abilityOrder.map((ability) => {
              const score = draft.abilities[ability.key];
              const modifier = abilityModifier(score);
              return (
                <div key={ability.key} className="ability-card">
                  <header>
                    <h4>{ability.label}</h4>
                    <span>{formatModifier(modifier)}</span>
                  </header>
                  <input
                    type="number"
                    value={score}
                    disabled={!canEdit}
                    onChange={(event) => updateAbility(ability.key, Number(event.target.value || 0))}
                  />
                  <button
                    type="button"
                    disabled={!canRoll}
                    onClick={() =>
                      void onRoll(
                        `1d20${modifier >= 0 ? `+${modifier}` : modifier}`,
                        `${draft.name} ${ability.label}`
                      )
                    }
                  >
                    Roll
                  </button>
                </div>
              );
            })}
          </div>
        </article>

        <article className="sheet-panel">
          <div className="sheet-panel-head">
            <h3>Skills</h3>
            <span className="small-kicker">Proficiency + expertise</span>
          </div>
          <div className="skill-list">
            {draft.skills.map((skill, index) => {
              const bonus = skillBonus(skill, draft);
              return (
                <div key={skill.id} className="skill-row">
                  <div className="skill-main">
                    <strong>{skill.name}</strong>
                    <span>
                      {skill.ability.toUpperCase()} {formatModifier(bonus)}
                    </span>
                  </div>
                  <div className="skill-actions">
                    <label className="toggle-flag">
                      <input
                        type="checkbox"
                        checked={skill.proficient}
                        disabled={!canEdit}
                        onChange={(event) => updateSkill(index, { proficient: event.target.checked })}
                      />
                      Prof
                    </label>
                    <label className="toggle-flag">
                      <input
                        type="checkbox"
                        checked={skill.expertise}
                        disabled={!canEdit}
                        onChange={(event) => updateSkill(index, { expertise: event.target.checked })}
                      />
                      Exp
                    </label>
                    <button
                      type="button"
                      disabled={!canRoll}
                      onClick={() =>
                        void onRoll(
                          `1d20${bonus >= 0 ? `+${bonus}` : bonus}`,
                          `${draft.name} ${skill.name}`
                        )
                      }
                    >
                      Roll
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="sheet-panel">
          <div className="sheet-panel-head">
            <h3>Attacks & Weapons</h3>
            {canEdit && (
              <button type="button" onClick={addAttack}>
                Add
              </button>
            )}
          </div>
          <div className="stack-list">
            {draft.attacks.map((attack, index) => (
              <div key={attack.id} className="editable-card">
                <div className="editable-card-head">
                  <strong>{attack.name}</strong>
                  <div className="action-line">
                    <button
                      type="button"
                      disabled={!canRoll}
                      onClick={() =>
                        void onRoll(
                          `1d20${attack.attackBonus >= 0 ? `+${attack.attackBonus}` : attack.attackBonus}`,
                          `${draft.name} ${attack.name}`
                        )
                      }
                    >
                      Attack
                    </button>
                    {canEdit && (
                      <button type="button" onClick={() => removeAt("attacks", index)}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <div className="triple-grid">
                  <label>
                    Name
                    <input
                      value={attack.name}
                      disabled={!canEdit}
                      onChange={(event) => updateAttack(index, { name: event.target.value })}
                    />
                  </label>
                  <label>
                    To Hit
                    <input
                      type="number"
                      value={attack.attackBonus}
                      disabled={!canEdit}
                      onChange={(event) => updateAttack(index, { attackBonus: Number(event.target.value || 0) })}
                    />
                  </label>
                  <label>
                    Damage
                    <input
                      value={attack.damage}
                      disabled={!canEdit}
                      onChange={(event) => updateAttack(index, { damage: event.target.value })}
                    />
                  </label>
                </div>
                <div className="double-grid">
                  <label>
                    Type
                    <input
                      value={attack.damageType}
                      disabled={!canEdit}
                      onChange={(event) => updateAttack(index, { damageType: event.target.value })}
                    />
                  </label>
                  <label>
                    Notes
                    <input
                      value={attack.notes}
                      disabled={!canEdit}
                      onChange={(event) => updateAttack(index, { notes: event.target.value })}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="sheet-panel">
          <div className="sheet-panel-head">
            <h3>Armor</h3>
            {canEdit && (
              <button type="button" onClick={addArmor}>
                Add
              </button>
            )}
          </div>
          <div className="stack-list">
            {draft.armorItems.map((item, index) => (
              <div key={item.id} className="editable-card">
                <div className="editable-card-head">
                  <strong>{item.name}</strong>
                  {canEdit && (
                    <button type="button" onClick={() => removeAt("armorItems", index)}>
                      Remove
                    </button>
                  )}
                </div>
                <div className="double-grid">
                  <label>
                    Item
                    <input
                      value={item.name}
                      disabled={!canEdit}
                      onChange={(event) => updateArmor(index, { name: event.target.value })}
                    />
                  </label>
                  <label>
                    AC
                    <input
                      type="number"
                      value={item.armorClass}
                      disabled={!canEdit}
                      onChange={(event) => updateArmor(index, { armorClass: Number(event.target.value || 0) })}
                    />
                  </label>
                </div>
                <label>
                  Notes
                  <input
                    value={item.notes}
                    disabled={!canEdit}
                    onChange={(event) => updateArmor(index, { notes: event.target.value })}
                  />
                </label>
              </div>
            ))}
          </div>
        </article>

        <article className="sheet-panel">
          <div className="sheet-panel-head">
            <h3>Resources</h3>
            {canEdit && (
              <button type="button" onClick={addResource}>
                Add
              </button>
            )}
          </div>
          <div className="stack-list">
            {draft.resources.map((resource, index) => (
              <div key={resource.id} className="editable-card">
                <div className="editable-card-head">
                  <strong>{resource.name}</strong>
                  {canEdit && (
                    <button type="button" onClick={() => removeAt("resources", index)}>
                      Remove
                    </button>
                  )}
                </div>
                <div className="triple-grid">
                  <label>
                    Name
                    <input
                      value={resource.name}
                      disabled={!canEdit}
                      onChange={(event) => updateResource(index, { name: event.target.value })}
                    />
                  </label>
                  <label>
                    Current
                    <input
                      type="number"
                      value={resource.current}
                      disabled={!canEdit}
                      onChange={(event) => updateResource(index, { current: Number(event.target.value || 0) })}
                    />
                  </label>
                  <label>
                    Max
                    <input
                      type="number"
                      value={resource.max}
                      disabled={!canEdit}
                      onChange={(event) => updateResource(index, { max: Number(event.target.value || 0) })}
                    />
                  </label>
                </div>
                <label>
                  Reset On
                  <input
                    value={resource.resetOn}
                    disabled={!canEdit}
                    onChange={(event) => updateResource(index, { resetOn: event.target.value })}
                  />
                </label>
              </div>
            ))}
          </div>
        </article>

        <article className="sheet-panel">
          <div className="sheet-panel-head">
            <h3>Spells & Feats</h3>
            <span className="small-kicker">Known or prepared</span>
          </div>
          <div className="sheet-text-grid">
            <label>
              Spells
              <textarea
                rows={8}
                value={draft.spells.join("\n")}
                disabled={!canEdit}
                onChange={(event) => updateField("spells", toLines(event.target.value))}
              />
            </label>
            <label>
              Feats
              <textarea
                rows={8}
                value={draft.feats.join("\n")}
                disabled={!canEdit}
                onChange={(event) => updateField("feats", toLines(event.target.value))}
              />
            </label>
          </div>
        </article>

        <article className="sheet-panel">
          <div className="sheet-panel-head">
            <h3>Features, Traits & Talents</h3>
            <span className="small-kicker">Class, species, and story hooks</span>
          </div>
          <div className="sheet-text-grid">
            <label>
              Features & Traits
              <textarea
                rows={8}
                value={draft.features.join("\n")}
                disabled={!canEdit}
                onChange={(event) => updateField("features", toLines(event.target.value))}
              />
            </label>
            <label>
              Talents
              <textarea
                rows={8}
                value={draft.talents.join("\n")}
                disabled={!canEdit}
                onChange={(event) => updateField("talents", toLines(event.target.value))}
              />
            </label>
          </div>
        </article>

        <article className="sheet-panel">
          <div className="sheet-panel-head">
            <h3>Inventory</h3>
            {canEdit && (
              <button type="button" onClick={addInventoryItem}>
                Add
              </button>
            )}
          </div>
          <div className="stack-list">
            {draft.inventory.map((item, index) => (
              <div key={item.id} className="editable-card compact">
                <div className="triple-grid">
                  <label>
                    Item
                    <input
                      value={item.name}
                      disabled={!canEdit}
                      onChange={(event) => updateInventory(index, { name: event.target.value })}
                    />
                  </label>
                  <label>
                    Qty
                    <input
                      type="number"
                      value={item.quantity}
                      disabled={!canEdit}
                      onChange={(event) => updateInventory(index, { quantity: Number(event.target.value || 0) })}
                    />
                  </label>
                  {canEdit ? (
                    <button type="button" onClick={() => removeAt("inventory", index)}>
                      Remove
                    </button>
                  ) : (
                    <div />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="currency-grid">
            {(["pp", "gp", "ep", "sp", "cp"] as const).map((coin) => (
              <label key={coin}>
                {coin.toUpperCase()}
                <input
                  type="number"
                  value={draft.currency[coin]}
                  disabled={!canEdit}
                  onChange={(event) => updateCurrency(coin, Number(event.target.value || 0))}
                />
              </label>
            ))}
          </div>
        </article>

        <article className="sheet-panel">
          <div className="sheet-panel-head">
            <h3>Notes</h3>
          </div>
          <label>
            Notes
            <textarea
              rows={12}
              value={draft.notes}
              disabled={!canEdit}
              onChange={(event) => updateField("notes", event.target.value)}
            />
          </label>
        </article>
      </div>
    </section>
  );
}

function cloneActor(actor: ActorSheet) {
  return JSON.parse(JSON.stringify(actor)) as ActorSheet;
}

function toLines(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function skillBonus(skill: SkillEntry, actor: ActorSheet) {
  const modifier = abilityModifier(actor.abilities[skill.ability]);
  const proficiency = skill.proficient ? actor.proficiencyBonus : 0;
  const expertise = skill.expertise ? actor.proficiencyBonus : 0;
  return modifier + proficiency + expertise;
}

function formatModifier(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}
