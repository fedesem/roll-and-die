import type {
  AbilityKey,
  ActorBonusEntry,
  ActorClassEntry,
  ActorSheet,
  ClassEntry,
  FeatEntry,
  SkillEntry,
  SpellEntry
} from "@shared/types";

export const abilityOrder: Array<{ key: AbilityKey; label: string }> = [
  { key: "str", label: "STR" },
  { key: "dex", label: "DEX" },
  { key: "con", label: "CON" },
  { key: "int", label: "INT" },
  { key: "wis", label: "WIS" },
  { key: "cha", label: "CHA" }
];

export const currencyOrder = ["pp", "gp", "ep", "sp", "cp"] as const;

export type SheetSectionId =
  | "info"
  | "abilities"
  | "skills"
  | "combat"
  | "attacks"
  | "armor"
  | "resources"
  | "spellSlots"
  | "spells"
  | "feats"
  | "traits"
  | "items"
  | "notes"
  | "bonuses";

export function cloneActor(actor: ActorSheet) {
  return JSON.parse(JSON.stringify(actor)) as ActorSheet;
}

export function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

export function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}

export function totalLevel(actor: ActorSheet) {
  return actor.classes.length > 0 ? actor.classes.reduce((sum, entry) => sum + entry.level, 0) : actor.level;
}

export function proficiencyBonusForLevel(level: number) {
  return Math.min(6, 2 + Math.floor((Math.max(level, 1) - 1) / 4));
}

export function bonusTotal(actor: ActorSheet, targetType: ActorBonusEntry["targetType"], targetKey = "") {
  const normalizedKey = normalizeKey(targetKey);

  return actor.bonuses.reduce((sum, entry) => {
    if (!entry.enabled || entry.targetType !== targetType) {
      return sum;
    }

    if (!normalizedKey) {
      return sum + entry.value;
    }

    return normalizeKey(entry.targetKey) === normalizedKey ? sum + entry.value : sum;
  }, 0);
}

export function abilityScoreTotal(actor: ActorSheet, ability: AbilityKey) {
  return actor.abilities[ability] + bonusTotal(actor, "ability", ability);
}

export function abilityModifierTotal(actor: ActorSheet, ability: AbilityKey) {
  return abilityModifier(abilityScoreTotal(actor, ability));
}

export function savingThrowTotal(actor: ActorSheet, ability: AbilityKey) {
  const proficient = actor.savingThrowProficiencies.includes(ability);
  return abilityModifierTotal(actor, ability) + (proficient ? actor.proficiencyBonus : 0) + bonusTotal(actor, "savingThrow", ability);
}

export function skillTotal(actor: ActorSheet, skill: SkillEntry) {
  const proficiencyMultiplier = skill.expertise ? 2 : skill.proficient ? 1 : 0;
  return (
    abilityModifierTotal(actor, skill.ability) + proficiencyMultiplier * actor.proficiencyBonus + bonusTotal(actor, "skill", skill.name)
  );
}

export function derivedSpeed(actor: ActorSheet) {
  return actor.speed + bonusTotal(actor, "speed");
}

export function derivedArmorClass(actor: ActorSheet) {
  const dexModifier = abilityModifierTotal(actor, "dex");
  const armorItems = actor.armorItems.filter((entry) => entry.equipped && entry.kind === "armor");
  const shieldItems = actor.armorItems.filter((entry) => entry.equipped && entry.kind === "shield");

  const bestArmor =
    armorItems.length > 0
      ? Math.max(
          ...armorItems.map((entry) => {
            const dexContribution = entry.maxDexBonus === null ? dexModifier : Math.min(dexModifier, entry.maxDexBonus);
            return entry.armorClass + dexContribution + entry.bonus;
          })
        )
      : 10 + dexModifier;

  return bestArmor + shieldItems.reduce((sum, entry) => sum + entry.armorClass + entry.bonus, 0) + bonusTotal(actor, "armorClass");
}

export function spellAttackBonus(actor: ActorSheet) {
  return actor.proficiencyBonus + abilityModifierTotal(actor, actor.spellcastingAbility);
}

export function spellSaveDc(actor: ActorSheet) {
  return 8 + actor.proficiencyBonus + abilityModifierTotal(actor, actor.spellcastingAbility);
}

export function spellMatchesClassFilter(spell: SpellEntry, classes: ActorClassEntry[]) {
  if (classes.length === 0) {
    return true;
  }

  const normalizedNames = new Set(classes.map((entry) => normalizeKey(entry.name)));

  return (
    spell.classes.some((entry) => normalizedNames.has(normalizeKey(entry))) ||
    spell.classReferences.some(
      (entry) => normalizedNames.has(normalizeKey(entry.className)) || normalizedNames.has(normalizeKey(entry.name))
    )
  );
}

export function featMatchesClassFilter(feat: FeatEntry, classes: ActorClassEntry[]) {
  if (classes.length === 0) {
    return true;
  }

  if (!feat.prerequisites.trim()) {
    return true;
  }

  const normalizedPrerequisites = normalizeKey(feat.prerequisites);
  return classes.some((entry) => normalizedPrerequisites.includes(normalizeKey(entry.name)));
}

export function findCompendiumClass(actorClass: ActorClassEntry, classes: ClassEntry[]): ClassEntry | undefined {
  return (
    classes.find((entry) => actorClass.compendiumId && entry.id === actorClass.compendiumId) ??
    classes.find(
      (entry) =>
        normalizeKey(entry.name) === normalizeKey(actorClass.name) &&
        (!actorClass.source || normalizeKey(entry.source) === normalizeKey(actorClass.source))
    )
  );
}

export function availableClassFeatures(actor: ActorSheet, classes: ClassEntry[]) {
  const entries = actor.classes.flatMap((actorClass) => {
    const compendiumClass = findCompendiumClass(actorClass, classes);

    if (!compendiumClass) {
      return [];
    }

    return compendiumClass.features
      .filter((feature) => feature.level <= actorClass.level)
      .map((feature) => ({
        key: `${compendiumClass.id}:${feature.level}:${feature.name}`,
        name: feature.name,
        level: feature.level,
        className: compendiumClass.name,
        description: feature.description,
        source: feature.source
      }));
  });

  return Array.from(new Map(entries.map((entry) => [entry.key, entry])).values());
}

export function groupedSpellNames(names: string[], spells: SpellEntry[]) {
  const spellByName = new Map(spells.map((entry) => [normalizeKey(entry.name), entry]));
  const groups = new Map<string, string[]>();

  names.forEach((name) => {
    const spell = spellByName.get(normalizeKey(name));
    const key = spell ? (spell.level === "cantrip" ? "Cantrips" : `Level ${spell.level}`) : "Other";
    const current = groups.get(key) ?? [];
    current.push(name);
    groups.set(key, current);
  });

  return Array.from(groups.entries());
}

export function sortLayout(layout: ActorSheet["layout"]) {
  return [...layout].sort((left, right) => left.order - right.order);
}

export function moveLayoutSection(layout: ActorSheet["layout"], sectionId: string, direction: "up" | "down" | "left" | "right") {
  const sorted = sortLayout(layout);
  const index = sorted.findIndex((entry) => entry.sectionId === sectionId);

  if (index < 0) {
    return layout;
  }

  const next = sorted.map((entry) => ({ ...entry }));
  const target = next[index];

  if (direction === "left" || direction === "right") {
    target.column = Math.max(1, Math.min(3, target.column + (direction === "left" ? -1 : 1)));
    return next.map((entry, order) => ({ ...entry, order }));
  }

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= next.length) {
    return next;
  }

  [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  return next.map((entry, order) => ({ ...entry, order }));
}

export function hitDiceAvailable(actorClass: ActorClassEntry) {
  return Math.max(actorClass.level - actorClass.usedHitDice, 0);
}

export function actorInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function buildNotation(modifier: number) {
  return modifier >= 0 ? `1d20+${modifier}` : `1d20${modifier}`;
}
