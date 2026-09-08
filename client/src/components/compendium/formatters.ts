import type { ClassEntry, ClassSubclassEntry, CompendiumReferenceEntry, SpellEntry } from "@shared/types";
import type { ClassPreviewFeatureItem } from "./types";

export function formatSpellTime(spell: SpellEntry | Omit<SpellEntry, "id">) {
  if (spell.castingTimeUnit === "action" || spell.castingTimeUnit === "bonus action" || spell.castingTimeUnit === "reaction") {
    return spell.castingTimeUnit;
  }

  return `${spell.castingTimeValue} ${spell.castingTimeUnit}${spell.castingTimeValue === 1 ? "" : "s"}`;
}

export function formatSpellRange(spell: SpellEntry | Omit<SpellEntry, "id">) {
  if (spell.rangeType === "touch" || spell.rangeType === "self") {
    return spell.rangeType;
  }

  if (spell.rangeType === "self emanation") {
    return `Self (${spell.rangeValue}-foot emanation)`;
  }

  if (spell.rangeType === "sight") {
    return "Sight";
  }

  if (spell.rangeType === "unlimited") {
    return "Unlimited";
  }

  if (spell.rangeType === "special") {
    return "Special";
  }

  return `${spell.rangeValue} feet`;
}

export function formatSpellDuration(spell: SpellEntry | Omit<SpellEntry, "id">) {
  const prefix = spell.concentration ? "Concentration, up to " : "";

  if (spell.durationUnit === "instant") {
    return "Instantaneous";
  }

  if (spell.durationUnit === "permanent") {
    return "Permanent";
  }

  if (spell.durationUnit === "special") {
    return "Special";
  }

  return `${prefix}${spell.durationValue} ${spell.durationUnit}${spell.durationValue === 1 ? "" : "s"}`;
}

export function formatSpellClassList(spell: SpellEntry | Omit<SpellEntry, "id">) {
  if (spell.classReferences.length > 0) {
    return Array.from(
      new Set(
        spell.classReferences.map((reference) =>
          reference.kind === "subclass" || reference.kind === "subclassVariant"
            ? `${reference.name} (${reference.className})`
            : reference.name
        )
      )
    ).join(", ");
  }

  return spell.classes.join(", ");
}

export function getReferencingClassesForSpell(spellName: string, classEntries: Array<ClassEntry | Omit<ClassEntry, "id">>) {
  const pattern = new RegExp(`\\{@spell\\s+${escapeRegExp(spellName)}(?:\\|[^}]*)?}`, "i");

  return classEntries
    .filter((entry) => {
      const texts = [
        entry.description,
        ...entry.features.map((feature) => feature.description),
        ...entry.tables.flatMap((table) => [table.name, ...table.columns, ...table.rows.flat()])
      ];

      return texts.some((text) => pattern.test(text));
    })
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

export function hasStartingProficiencies(entry: ClassEntry | Omit<ClassEntry, "id">) {
  return (
    entry.startingProficiencies.armor.length > 0 ||
    entry.startingProficiencies.weapons.length > 0 ||
    entry.startingProficiencies.tools.length > 0
  );
}

export function formatStartingProficiencies(entry: ClassEntry | Omit<ClassEntry, "id">) {
  const parts = [
    entry.startingProficiencies.armor.length > 0 ? `Armor: ${entry.startingProficiencies.armor.join(", ")}` : "",
    entry.startingProficiencies.weapons.length > 0 ? `Weapons: ${entry.startingProficiencies.weapons.join(", ")}` : "",
    entry.startingProficiencies.tools.length > 0 ? `Tools: ${entry.startingProficiencies.tools.join(", ")}` : ""
  ].filter(Boolean);

  return parts.join(" • ");
}

export function normalizeClassPreviewDescription(entry: ClassEntry | Omit<ClassEntry, "id">) {
  const duplicatePrefixes = [
    "Primary Ability:",
    "Hit Die:",
    "Saving Throw Proficiencies:",
    "Armor Training:",
    "Starting Proficiencies:",
    "Weapon Proficiencies:",
    "Tool Proficiencies:"
  ];

  return entry.description
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !duplicatePrefixes.some((prefix) => line.startsWith(prefix)))
    .join("\n");
}

export function buildClassPreviewFeatureTimeline(entry: ClassEntry | Omit<ClassEntry, "id">, selectedSubclass: ClassSubclassEntry | null) {
  const classFeatures: ClassPreviewFeatureItem[] = entry.features.map((feature, index) => ({
    key: feature.reference || `class:${feature.level}:${feature.name}:${index}`,
    kind: "class",
    level: feature.level,
    name: feature.name,
    description: feature.description
  }));

  const subclassFeatures: ClassPreviewFeatureItem[] = selectedSubclass
    ? selectedSubclass.features.map((feature, index) => ({
        key: `${selectedSubclass.id}:${feature.reference || `subclass:${feature.level}:${feature.name}:${index}`}`,
        kind: "subclass",
        level: feature.level,
        name: feature.name,
        description: feature.description,
        subclassName: selectedSubclass.name
      }))
    : [];

  return [...classFeatures, ...subclassFeatures].sort((left, right) => {
    if (left.level !== right.level) {
      return left.level - right.level;
    }

    if (left.kind !== right.kind) {
      return left.kind === "class" ? -1 : 1;
    }

    return left.key.localeCompare(right.key);
  });
}

export function groupClassPreviewFeaturesByLevel(features: ClassPreviewFeatureItem[]) {
  const groups = new Map<number, ClassPreviewFeatureItem[]>();

  features.forEach((feature) => {
    const current = groups.get(feature.level) ?? [];
    current.push(feature);
    groups.set(feature.level, current);
  });

  return Array.from(groups.entries())
    .sort(([leftLevel], [rightLevel]) => leftLevel - rightLevel)
    .map(([level, levelFeatures]) => ({
      level,
      features: levelFeatures
    }));
}

export function getReferencedSpellsForClass(
  entry: ClassEntry | Omit<ClassEntry, "id">,
  spellEntries: Array<SpellEntry | Omit<SpellEntry, "id">>,
  selectedSubclass?: ClassSubclassEntry
) {
  const availableSpellNames = new Set(spellEntries.map((spell) => spell.name.toLowerCase()));
  const rawTexts = [
    entry.description,
    ...entry.features.map((feature) => feature.description),
    ...(selectedSubclass ? [selectedSubclass.description, ...selectedSubclass.features.map((feature) => feature.description)] : []),
    ...entry.tables.flatMap((table) => [table.name, ...table.columns, ...table.rows.flat()])
  ];
  const matches = rawTexts
    .flatMap((text) => Array.from(text.matchAll(/\{@spell ([^}|]+)(?:\|[^}]+)?}/gi), (match) => match[1].trim()))
    .filter((spellName) => availableSpellNames.has(spellName.toLowerCase()));

  return Array.from(new Set(matches)).sort((left, right) => left.localeCompare(right));
}

export function parseFilterTag(text: string) {
  const match = text.match(/^\{@filter ([^|}]+)\|([^|}]+)(?:\|([^}]+))?}/i);

  if (!match) {
    return null;
  }

  const filters = (match[3] ?? "")
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, entry) => {
      const [key, ...rest] = entry.split("=");

      if (!key || rest.length === 0) {
        return accumulator;
      }

      accumulator[key.trim().toLowerCase()] = rest.join("=").trim();
      return accumulator;
    }, {});

  return {
    label: match[1].trim(),
    target: match[2].trim().toLowerCase(),
    filters
  };
}

export function getFilteredSpellEntries(spellEntries: Array<SpellEntry | Omit<SpellEntry, "id">>, filters: Record<string, string>) {
  const classFilters = splitFilterValues(filters.class).map((value) => value.toLowerCase());
  const levelFilters = splitFilterValues(filters.level);
  const schoolFilters = splitFilterValues(filters.school).map(normalizeSpellSchoolFilter).filter(Boolean);

  return [...spellEntries]
    .filter((spell) => {
      if (classFilters.length > 0) {
        const spellClasses = spell.classes ?? [];
        const spellClassReferences = spell.classReferences ?? [];
        const spellClassNames = new Set(
          [
            ...spellClasses,
            ...spellClassReferences.flatMap((reference) => [
              reference.name,
              reference.className,
              `${reference.name} (${reference.className})`
            ])
          ]
            .filter(Boolean)
            .map((entry) => entry.toLowerCase())
        );

        if (!classFilters.some((classFilter) => spellClassNames.has(classFilter))) {
          return false;
        }
      }

      if (levelFilters.length > 0) {
        const spellLevel = spell.level === "cantrip" ? "0" : String(spell.level);
        const excludedLevels = levelFilters.filter((value) => value.startsWith("!")).map((value) => value.slice(1));
        const includedLevels = levelFilters.filter((value) => !value.startsWith("!"));

        if (excludedLevels.includes(spellLevel)) {
          return false;
        }

        if (includedLevels.length > 0 && !includedLevels.includes(spellLevel)) {
          return false;
        }
      }

      if (schoolFilters.length > 0 && !schoolFilters.includes(spell.school)) {
        return false;
      }

      return true;
    })
    .sort((left, right) => {
      const leftLevel = left.level === "cantrip" ? 0 : left.level;
      const rightLevel = right.level === "cantrip" ? 0 : right.level;

      if (leftLevel !== rightLevel) {
        return leftLevel - rightLevel;
      }

      return left.name.localeCompare(right.name);
    });
}

export function splitFilterValues(value = "") {
  return value
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function normalizeSpellSchoolFilter(value: string) {
  const mapping: Record<string, SpellEntry["school"]> = {
    A: "Abjuration",
    C: "Conjuration",
    D: "Divination",
    E: "Enchantment",
    V: "Evocation",
    I: "Illusion",
    N: "Necromancy",
    T: "Transmutation"
  };

  const normalized = value.trim().toUpperCase();
  return mapping[normalized] ?? "";
}

export function formatActionTag(value: string, fallback: string) {
  const inner = value.replace(/^\{@[^ ]+\s*|\}$/g, "").trim();
  if (!inner) {
    return fallback;
  }

  return `${fallback} ${inner.replace(/\|.*$/, "").trim()}`;
}

export function formatAttackTag(value: string) {
  const normalized = value.toLowerCase();

  if (normalized === "m") {
    return "Melee Attack:";
  }

  if (normalized === "r") {
    return "Ranged Attack:";
  }

  if (normalized.includes("m") && normalized.includes("r")) {
    return "Melee or Ranged Attack:";
  }

  return "";
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeCompendiumSourceKey(value: string) {
  return (
    value
      .trim()
      .split(/\s+p\./i)[0]
      ?.trim()
      .toLowerCase() ?? ""
  );
}

export function findReferenceEntryByTag<T extends CompendiumReferenceEntry | Omit<CompendiumReferenceEntry, "id">>(
  entries: T[],
  lookup: Map<string, T>,
  name: string,
  source: string,
  label: string
) {
  const normalizedName = name.toLowerCase();
  const normalizedLabel = label.toLowerCase();
  const normalizedSource = normalizeCompendiumSourceKey(source);

  if (normalizedSource) {
    const sourcedEntry = entries.find((entry) => {
      const entryName = entry.name.toLowerCase();
      return (
        (entryName === normalizedName || entryName === normalizedLabel) && normalizeCompendiumSourceKey(entry.source) === normalizedSource
      );
    });

    if (sourcedEntry) {
      return sourcedEntry;
    }
  }

  return lookup.get(normalizedName) ?? lookup.get(normalizedLabel) ?? null;
}
