import type {
  AbilityKey,
  ActorClassEntry,
  ActorSheet,
  ArmorEntry,
  AttackEntry,
  CampaignSnapshot,
  ClassEntry,
  CompendiumBackgroundEntry,
  CompendiumEquipmentGroup,
  CompendiumItemEntry,
  CompendiumOptionalFeatureEntry,
  CompendiumReferenceEntry,
  CompendiumSpeciesEntry,
  FeatEntry,
  ResourceEntry,
  SpellEntry,
  SpellSlotTrack
} from "@shared/types";

import type {
  GuidedAbilityChoiceConfig,
  GuidedAbilityChoiceGrant,
  GuidedAbilityChoiceMode,
  GuidedAbilityChoiceSlot,
  DerivedResourceDefinition,
  DetailRowEntry,
  DetailRowMeta,
  GuidedChoiceSpec,
  GuidedFlowMode,
  GuidedSkillChoiceConfig,
  GuidedSetupState,
  SheetTab
} from "../playerNpcSheet2024Types";
import { NEW_GUIDED_CLASS_ID } from "../playerNpcSheet2024Types";
import {
  abilityModifierTotal,
  availableClassFeatures,
  findCompendiumClass,
  normalizeKey,
  totalLevel
} from "../sheetUtils";

const guidedClassSkillChoiceRules: Record<string, { count: number; skillNames: string[] }> = {
  barbarian: {
    count: 2,
    skillNames: ["Animal Handling", "Athletics", "Intimidation", "Nature", "Perception", "Survival"]
  },
  bard: {
    count: 3,
    skillNames: [
      "Acrobatics",
      "Animal Handling",
      "Arcana",
      "Athletics",
      "Deception",
      "History",
      "Insight",
      "Intimidation",
      "Investigation",
      "Medicine",
      "Nature",
      "Perception",
      "Performance",
      "Persuasion",
      "Religion",
      "Sleight of Hand",
      "Stealth",
      "Survival"
    ]
  },
  cleric: {
    count: 2,
    skillNames: ["History", "Insight", "Medicine", "Persuasion", "Religion"]
  },
  druid: {
    count: 2,
    skillNames: ["Arcana", "Animal Handling", "Insight", "Medicine", "Nature", "Perception", "Religion", "Survival"]
  },
  fighter: {
    count: 2,
    skillNames: ["Acrobatics", "Animal Handling", "Athletics", "History", "Insight", "Intimidation", "Perception", "Survival"]
  },
  monk: {
    count: 2,
    skillNames: ["Acrobatics", "Athletics", "History", "Insight", "Religion", "Stealth"]
  },
  paladin: {
    count: 2,
    skillNames: ["Athletics", "Insight", "Intimidation", "Medicine", "Persuasion", "Religion"]
  },
  ranger: {
    count: 3,
    skillNames: ["Animal Handling", "Athletics", "Insight", "Investigation", "Nature", "Perception", "Stealth", "Survival"]
  },
  rogue: {
    count: 4,
    skillNames: [
      "Acrobatics",
      "Athletics",
      "Deception",
      "Insight",
      "Intimidation",
      "Investigation",
      "Perception",
      "Persuasion",
      "Sleight of Hand",
      "Stealth"
    ]
  },
  sorcerer: {
    count: 2,
    skillNames: ["Arcana", "Deception", "Insight", "Intimidation", "Persuasion", "Religion"]
  },
  warlock: {
    count: 2,
    skillNames: ["Arcana", "Deception", "History", "Intimidation", "Investigation", "Nature", "Religion"]
  },
  wizard: {
    count: 2,
    skillNames: ["Arcana", "History", "Insight", "Investigation", "Medicine", "Nature", "Religion"]
  }
};

interface SkillGrantDetails {
  fixedSkillNames: string[];
  choiceCount: number;
  choiceSkillNames: string[];
}

export function defaultTabForActor(actor: ActorSheet): SheetTab {
  return actor.build?.speciesId || actor.build?.backgroundId || actor.classes.length > 0 ? "main" : "edit";
}

export function backgroundForId(backgrounds: CompendiumBackgroundEntry[], backgroundId: string) {
  return backgrounds.find((entry) => entry.id === backgroundId) ?? null;
}

export function deriveBackgroundAbilityConfig(background: CompendiumBackgroundEntry | null) {
  const structuredGrants = normalizeBackgroundAbilityGrants(background?.abilityChoices ?? []);
  const fallbackAbilities = background ? extractAbilityKeysFromText(background.entries || background.description) : [];
  const modes: GuidedAbilityChoiceMode[] = [];

  if (structuredGrants.length > 0) {
    modes.push({
      id: "primary",
      label: formatBackgroundAbilityModeLabel(structuredGrants),
      grants: structuredGrants
    });
  } else if (fallbackAbilities.length > 0) {
    buildFallbackBackgroundAbilityModes(fallbackAbilities).forEach((mode, index) => {
      modes.push({
        id: index === 0 ? "primary" : `fallback-${index}`,
        label: formatBackgroundAbilityModeLabel(mode),
        grants: mode
      });
    });
  }

  appendStandardBackgroundAbilityAlternative(modes);

  return {
    modes,
    defaultModeId: modes[0]?.id ?? ""
  } satisfies GuidedAbilityChoiceConfig;
}

export function selectGuidedAbilityChoiceMode(config: GuidedAbilityChoiceConfig, modeId: string) {
  return config.modes.find((entry) => entry.id === modeId) ?? config.modes[0] ?? null;
}

export function deriveGuidedAbilityChoiceSlots(mode: GuidedAbilityChoiceMode | null): GuidedAbilityChoiceSlot[] {
  if (!mode) {
    return [];
  }

  return mode.grants.flatMap((grant, grantIndex) =>
    Array.from({ length: grant.count }, (_, slotIndex) => ({
      id: `${mode.id}:${grantIndex}:${slotIndex}`,
      abilities: grant.abilities,
      amount: grant.amount
    }))
  );
}

export function deriveBackgroundSkillProficiencies(background: CompendiumBackgroundEntry | null) {
  if (!background) {
    return [];
  }

  const structured = background.skillProficiencies.filter(Boolean);

  if (structured.length > 0) {
    return structured;
  }

  return deriveSkillGrantDetails(background.entries || background.description, []).fixedSkillNames;
}

export function deriveOriginFeatOptions(background: CompendiumBackgroundEntry | null, feats: FeatEntry[]) {
  if (!background) {
    return [];
  }

  const featIds = background.featIds.length > 0 ? background.featIds : extractTaggedNames(background.entries || background.description, "feat");

  return featIds
    .map((entry) => feats.find((feat) => feat.id === entry) ?? feats.find((feat) => normalizeKey(feat.name) === normalizeKey(entry)))
    .filter((entry): entry is FeatEntry => Boolean(entry));
}

export function deriveBackgroundSkillChoiceConfig(
  background: CompendiumBackgroundEntry | null,
  skillEntries: CompendiumReferenceEntry[],
  actor?: ActorSheet | null
): GuidedSkillChoiceConfig {
  if (!background) {
    return {
      count: 0,
      options: []
    };
  }

  const details = deriveSkillGrantDetails(background.entries || background.description, skillEntries);
  const options = filterSelectableSkillEntries(mapSkillNamesToEntries(details.choiceSkillNames, skillEntries), actor);

  return {
    count: Math.min(details.choiceCount, options.length),
    options
  };
}

export function deriveSpeciesSkillChoiceConfig(
  species: CompendiumSpeciesEntry | null,
  skillEntries: CompendiumReferenceEntry[],
  actor?: ActorSheet | null
): GuidedSkillChoiceConfig {
  if (!species) {
    return {
      count: 0,
      options: []
    };
  }

  const details = deriveSkillGrantDetails(species.entries || species.description, skillEntries);
  const options = filterSelectableSkillEntries(mapSkillNamesToEntries(details.choiceSkillNames, skillEntries), actor);

  return {
    count: Math.min(details.choiceCount, options.length),
    options
  };
}

export function deriveSpeciesSkillProficiencies(species: CompendiumSpeciesEntry | null) {
  if (!species) {
    return [];
  }

  return deriveSkillGrantDetails(species.entries || species.description, []).fixedSkillNames;
}

export function deriveSpeciesOriginFeatOptions(species: CompendiumSpeciesEntry | null, feats: FeatEntry[]) {
  if (!species) {
    return [];
  }

  if (/\borigin feat\b/i.test(species.entries || species.description)) {
    return feats.filter((entry) => normalizeKey(entry.category).includes("origin") || normalizeKey(entry.category) === "o");
  }

  return extractTaggedNames(species.entries || species.description, "feat")
    .map((entry) => feats.find((feat) => normalizeKey(feat.name) === normalizeKey(entry)))
    .filter((entry): entry is FeatEntry => Boolean(entry));
}

export function deriveBackgroundEquipmentGroups(background: CompendiumBackgroundEntry | null): CompendiumEquipmentGroup[] {
  if (!background) {
    return [];
  }

  if (background.startingEquipment.length > 0) {
    return background.startingEquipment;
  }

  const entryText = background.entries || background.description;
  const itemNames = extractTaggedNames(entryText, "item");

  if (itemNames.length === 0) {
    return [];
  }

  return [
    {
      id: `${background.id}:fallback-equipment`,
      label: "Suggested Starting Equipment",
      choose: 1,
      options: [
        {
          id: `${background.id}:fallback-equipment:default`,
          label: "Default package",
          items: itemNames.map((itemName) => ({
            name: itemName,
            quantity: 1,
            equipped: false,
            notes: "",
            type: "gear"
          }))
        }
      ]
    }
  ];
}

export function extractTaggedNames(text: string, tag: "feat" | "item" | "skill" | "spell") {
  const matches = Array.from(text.matchAll(new RegExp(`\\{@${tag}\\s+([^|}]+)`, "gi")));
  return Array.from(new Set(matches.map((entry) => entry[1]?.trim()).filter(Boolean)));
}

export function deriveClassSkillChoiceConfig(
  classEntry: ClassEntry | null,
  skillEntries: CompendiumReferenceEntry[],
  actor?: ActorSheet | null
): GuidedSkillChoiceConfig {
  if (!classEntry) {
    return {
      count: 0,
      options: []
    };
  }

  const rule = guidedClassSkillChoiceRules[normalizeKey(classEntry.name)];

  if (!rule) {
    return {
      count: 0,
      options: []
    };
  }

  const options = filterSelectableSkillEntries(mapSkillNamesToEntries(rule.skillNames, skillEntries), actor);

  return {
    count: Math.min(rule.count, options.length),
    options
  };
}

function deriveSkillGrantDetails(text: string, skillEntries: CompendiumReferenceEntry[]): SkillGrantDetails {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const fixedSkillNames = new Set<string>();
  const choiceSkillNames = new Set<string>();
  let choiceCount = 0;

  lines.forEach((line) => {
    const normalized = normalizeKey(line);
    const taggedSkillNames = extractTaggedNames(line, "skill");

    if (!taggedSkillNames.length && !normalized.includes("skill")) {
      return;
    }

    if (normalized.includes("skill or tool")) {
      return;
    }

    const plusFromAmongMatch = line.match(/\bplus\s+((?:\d+)|one|two|three|four|five|six)\s+from among\b/i);
    if (plusFromAmongMatch) {
      const splitIndex = plusFromAmongMatch.index ?? 0;
      extractTaggedNames(line.slice(0, splitIndex), "skill").forEach((skillName) => fixedSkillNames.add(skillName));
      const optionNames = extractTaggedNames(line.slice(splitIndex + plusFromAmongMatch[0].length), "skill");
      choiceCount = Math.max(choiceCount, parseChoiceCount(plusFromAmongMatch[1], 1));
      optionNames.forEach((skillName) => choiceSkillNames.add(skillName));
      return;
    }

    const chooseTaggedMatch =
      line.match(/\b((?:\d+)|one|two|three|four|five|six)\s+(?:of\s+)?(?:the\s+following\s+)?skills?\s+of\s+your\s+choice\b/i) ??
      line.match(/\bchoose\s+((?:\d+)|one|two|three|four|five|six)\s+(?:of\s+)?(?:the\s+following\s+)?skills?\b/i);
    if (chooseTaggedMatch) {
      const optionNames = taggedSkillNames.length > 0 ? taggedSkillNames : skillEntries.map((entry) => entry.name);
      choiceCount = Math.max(choiceCount, parseChoiceCount(chooseTaggedMatch[1], 1));
      optionNames.forEach((skillName) => choiceSkillNames.add(skillName));
      return;
    }

    const chooseAnySkillMatch = line.match(/\b((?:\d+)|one|two|three|four|five|six)\s+skills?\s+of\s+your\s+choice\b/i);
    if (chooseAnySkillMatch) {
      choiceCount = Math.max(choiceCount, parseChoiceCount(chooseAnySkillMatch[1], 1));
      (taggedSkillNames.length > 0 ? taggedSkillNames : skillEntries.map((entry) => entry.name)).forEach((skillName) =>
        choiceSkillNames.add(skillName)
      );
      return;
    }

    if (taggedSkillNames.length > 1 && /\b(?:gain|have)\s+proficiency\s+(?:in|with)\b/i.test(normalized) && /\bor\b/i.test(normalized)) {
      choiceCount = Math.max(choiceCount, 1);
      taggedSkillNames.forEach((skillName) => choiceSkillNames.add(skillName));
      return;
    }

    if (/^skill proficiencies?:/i.test(normalized) || /\b(?:gain|have)\s+proficiency\s+(?:in|with)\b/i.test(normalized)) {
      taggedSkillNames.forEach((skillName) => fixedSkillNames.add(skillName));
    }
  });

  return {
    fixedSkillNames: Array.from(fixedSkillNames),
    choiceCount,
    choiceSkillNames: Array.from(choiceSkillNames)
  };
}

function mapSkillNamesToEntries(skillNames: string[], skillEntries: CompendiumReferenceEntry[]) {
  return skillNames
    .map((skillName) => skillEntries.find((entry) => normalizeKey(entry.name) === normalizeKey(skillName)) ?? null)
    .filter((entry): entry is CompendiumReferenceEntry => Boolean(entry));
}

function filterSelectableSkillEntries(skillEntries: CompendiumReferenceEntry[], actor?: ActorSheet | null) {
  if (!actor) {
    return skillEntries;
  }

  return skillEntries.filter(
    (entry) => !actor.skills.some((skill) => normalizeKey(skill.name) === normalizeKey(entry.name) && skill.proficient)
  );
}

export function extractAbilityKeysFromText(text: string) {
  const normalized = text.toLowerCase();
  const matches: AbilityKey[] = [];

  if (normalized.includes("strength")) matches.push("str");
  if (normalized.includes("dexterity")) matches.push("dex");
  if (normalized.includes("constitution")) matches.push("con");
  if (normalized.includes("intelligence")) matches.push("int");
  if (normalized.includes("wisdom")) matches.push("wis");
  if (normalized.includes("charisma")) matches.push("cha");

  return matches;
}

function normalizeBackgroundAbilityGrants(grants: CompendiumBackgroundEntry["abilityChoices"]): GuidedAbilityChoiceGrant[] {
  return grants
    .map((grant) => ({
      abilities: Array.from(new Set(grant.abilities)),
      amount: Number.isFinite(grant.amount) ? Math.round(grant.amount) : 0,
      count: Number.isFinite(grant.count) ? Math.max(0, Math.round(grant.count)) : 0
    }))
    .filter((grant) => grant.abilities.length > 0 && grant.amount !== 0 && grant.count > 0);
}

function buildFallbackBackgroundAbilityModes(abilities: AbilityKey[]) {
  const uniqueAbilities = Array.from(new Set(abilities));

  if (uniqueAbilities.length >= 3) {
    return [
      [
        { abilities: uniqueAbilities, amount: 2, count: 1 },
        { abilities: uniqueAbilities, amount: 1, count: 1 }
      ],
      [{ abilities: uniqueAbilities, amount: 1, count: 3 }]
    ] satisfies GuidedAbilityChoiceGrant[][];
  }

  if (uniqueAbilities.length > 0) {
    return [
      [
        {
          abilities: uniqueAbilities,
          amount: 1,
          count: uniqueAbilities.length
        }
      ]
    ] satisfies GuidedAbilityChoiceGrant[][];
  }

  return [];
}

function appendStandardBackgroundAbilityAlternative(modes: GuidedAbilityChoiceMode[]) {
  const primaryMode = modes[0];

  if (!primaryMode) {
    return;
  }

  const standardAbilities = getStandardBackgroundAbilityPool(primaryMode.grants);

  if (standardAbilities.length === 0) {
    return;
  }

  const hasPlusTwoPlusOneMode = modes.some((mode) => isStandardPlusTwoPlusOneMode(mode.grants));
  const hasThreePlusOneMode = modes.some((mode) => isStandardThreePlusOneMode(mode.grants));

  if (!hasPlusTwoPlusOneMode) {
    const grants: GuidedAbilityChoiceGrant[] = [
      { abilities: standardAbilities, amount: 2, count: 1 },
      { abilities: standardAbilities, amount: 1, count: 1 }
    ];
    modes.push({
      id: "plus-two-plus-one",
      label: formatBackgroundAbilityModeLabel(grants),
      grants
    });
  }

  if (!hasThreePlusOneMode) {
    const grants: GuidedAbilityChoiceGrant[] = [{ abilities: standardAbilities, amount: 1, count: 3 }];
    modes.push({
      id: "three-plus-one",
      label: formatBackgroundAbilityModeLabel(grants),
      grants
    });
  }
}

function getStandardBackgroundAbilityPool(grants: GuidedAbilityChoiceGrant[]) {
  if (isStandardPlusTwoPlusOneMode(grants) || isStandardThreePlusOneMode(grants)) {
    return grants[0]?.abilities ?? [];
  }

  return [];
}

function isStandardPlusTwoPlusOneMode(grants: GuidedAbilityChoiceGrant[]) {
  if (grants.length !== 2) {
    return false;
  }

  const sorted = [...grants].sort((left, right) => right.amount - left.amount);
  return (
    sorted[0]?.amount === 2 &&
    sorted[0]?.count === 1 &&
    sorted[1]?.amount === 1 &&
    sorted[1]?.count === 1 &&
    sameAbilityPool(sorted[0]?.abilities ?? [], sorted[1]?.abilities ?? []) &&
    sorted[0]!.abilities.length >= 3
  );
}

function isStandardThreePlusOneMode(grants: GuidedAbilityChoiceGrant[]) {
  return grants.length === 1 && grants[0]?.amount === 1 && grants[0]?.count === 3 && grants[0].abilities.length >= 3;
}

function sameAbilityPool(left: AbilityKey[], right: AbilityKey[]) {
  return left.length === right.length && left.every((entry) => right.includes(entry));
}

function formatBackgroundAbilityModeLabel(grants: GuidedAbilityChoiceGrant[]) {
  return grants
    .flatMap((grant) => Array.from({ length: grant.count }, () => `${grant.amount >= 0 ? "+" : ""}${grant.amount}`))
    .join(" / ");
}

export function normalizeSpeciesSize(value: string | undefined): ActorSheet["creatureSize"] | null {
  switch (normalizeKey(value ?? "")) {
    case "tiny":
    case "small":
    case "medium":
    case "large":
    case "huge":
    case "gargantuan":
      return normalizeKey(value ?? "") as ActorSheet["creatureSize"];
    default:
      return null;
  }
}

export function collectGuidedFeatures(actor: ActorSheet, classes: ClassEntry[], subclassOverrides?: Record<string, string>) {
  const classFeatureNames = availableClassFeatures(actor, classes).map((entry) => entry.name);
  const subclassFeatureNames = actor.classes.flatMap((actorClass) => {
    const classEntry = findCompendiumClass(actorClass, classes);
    const subclassId =
      subclassOverrides?.[actorClass.id] ?? actorClass.subclassId ?? actor.build?.classes.find((entry) => entry.id === actorClass.id)?.subclassId;
    const subclass = classEntry?.subclasses.find((entry) => entry.id === subclassId);

    if (!subclass) {
      return [];
    }

    return subclass.features.filter((entry) => entry.level <= actorClass.level).map((entry) => entry.name);
  });

  return mergeTextValues(actor.features, [...classFeatureNames, ...subclassFeatureNames]);
}

export function deriveActorSpellCollections(actor: ActorSheet, compendium: CampaignSnapshot["compendium"], spellSlots: SpellSlotTrack[]) {
  const spells = compendium.spells;
  const classes = compendium.classes;
  const grantedSpells = deriveGrantedSpellState(actor, compendium);
  const maxPreparedLevel = Math.max(0, ...spellSlots.filter((entry) => entry.total > 0).map((entry) => entry.level));
  const preparedFromClassList = spells
    .filter((entry) => {
      if (entry.level === "cantrip" || typeof entry.level !== "number" || entry.level > maxPreparedLevel) {
        return false;
      }

      return actor.classes.some((actorClass) => {
        const classEntry = findCompendiumClass(actorClass, classes);
        if (!classEntry || classEntry.spellPreparation === "spellbook" || classEntry.spellPreparation === "none") {
          return false;
        }

        return (
          spellMatchesSingleClassFilter(entry, classEntry.name) ||
          entry.classReferences.some((reference) => normalizeKey(reference.className) === normalizeKey(classEntry.name))
        );
      });
    })
    .map((entry) => entry.name);

  const all = mergeTextValues([], [
    ...actor.spells,
    ...grantedSpells.known,
    ...actor.spellState.spellbook,
    ...grantedSpells.spellbook,
    ...actor.spellState.alwaysPrepared,
    ...grantedSpells.alwaysPrepared,
    ...actor.spellState.atWill,
    ...grantedSpells.atWill,
    ...actor.spellState.perShortRest,
    ...grantedSpells.perShortRest,
    ...actor.spellState.perLongRest,
    ...grantedSpells.perLongRest,
    ...actor.preparedSpells,
    ...preparedFromClassList
  ]);

  const preparable = mergeTextValues([], [
    ...actor.spells,
    ...grantedSpells.known,
    ...actor.spellState.spellbook,
    ...grantedSpells.spellbook,
    ...preparedFromClassList
  ]);

  return {
    all,
    preparable,
    alwaysPrepared: mergeTextValues(actor.spellState.alwaysPrepared, grantedSpells.alwaysPrepared),
    spellbook: mergeTextValues(actor.spellState.spellbook, grantedSpells.spellbook),
    atWill: mergeTextValues(actor.spellState.atWill, grantedSpells.atWill),
    perShortRest: mergeTextValues(actor.spellState.perShortRest, grantedSpells.perShortRest),
    perLongRest: mergeTextValues(actor.spellState.perLongRest, grantedSpells.perLongRest)
  };
}

export function spellMatchesSingleClassFilter(spell: SpellEntry, className: string) {
  return (
    spell.classes.some((entry) => normalizeKey(entry) === normalizeKey(className)) ||
    spell.classReferences.some(
      (entry) => normalizeKey(entry.className) === normalizeKey(className) || normalizeKey(entry.name) === normalizeKey(className)
    )
  );
}

export function deriveGrantedSpellState(actor: ActorSheet, compendium: CampaignSnapshot["compendium"]) {
  const granted = {
    known: [] as string[],
    spellbook: [] as string[],
    alwaysPrepared: [] as string[],
    atWill: [] as string[],
    perShortRest: [] as string[],
    perLongRest: [] as string[]
  };
  const selectedSpecies = compendium.races.find((entry) => entry.id === actor.build?.speciesId) ?? null;
  const selectedBackground = compendium.backgrounds.find((entry) => entry.id === actor.build?.backgroundId) ?? null;
  const texts = [
    selectedSpecies ? selectedSpecies.entries || selectedSpecies.description : "",
    selectedBackground ? selectedBackground.entries || selectedBackground.description : "",
    ...actor.feats.map((entry) => {
      const feat = findByName(compendium.feats, entry);
      return feat ? [feat.abilityScoreIncrease, feat.description].filter(Boolean).join("\n") : "";
    }),
    ...actor.features.map((entry) => {
      const optionalFeature = findByName(compendium.optionalFeatures, entry);
      return optionalFeature ? optionalFeature.entries || optionalFeature.description : "";
    }),
    ...availableClassFeatures(actor, compendium.classes).map((entry) => entry.description),
    ...actor.classes.flatMap((actorClass) => {
      const classEntry = findCompendiumClass(actorClass, compendium.classes);
      const subclassId = actorClass.subclassId ?? actor.build?.classes.find((entry) => entry.id === actorClass.id)?.subclassId;
      const subclass = classEntry?.subclasses.find((entry) => entry.id === subclassId);
      return subclass?.features.filter((entry) => entry.level <= actorClass.level).map((entry) => entry.description) ?? [];
    })
  ].filter(Boolean);

  texts.forEach((text) => {
    const parsed = parseGrantedSpellsFromText(text);
    granted.known = mergeTextValues(granted.known, parsed.known);
    granted.spellbook = mergeTextValues(granted.spellbook, parsed.spellbook);
    granted.alwaysPrepared = mergeTextValues(granted.alwaysPrepared, parsed.alwaysPrepared);
    granted.atWill = mergeTextValues(granted.atWill, parsed.atWill);
    granted.perShortRest = mergeTextValues(granted.perShortRest, parsed.perShortRest);
    granted.perLongRest = mergeTextValues(granted.perLongRest, parsed.perLongRest);
  });

  return granted;
}

export function parseGrantedSpellsFromText(text: string) {
  const buckets = {
    known: [] as string[],
    spellbook: [] as string[],
    alwaysPrepared: [] as string[],
    atWill: [] as string[],
    perShortRest: [] as string[],
    perLongRest: [] as string[]
  };

  text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((segment) => {
      const spellNames = extractTaggedNames(segment, "spell");

      if (spellNames.length === 0) {
        return;
      }

      const normalized = normalizeKey(segment);

      if (/always have|always prepared|is always prepared|are always prepared|prepared spell/i.test(normalized)) {
        buckets.alwaysPrepared = mergeTextValues(buckets.alwaysPrepared, spellNames);
        return;
      }

      if (/spellbook|scribe|copied into your spellbook/i.test(normalized)) {
        buckets.spellbook = mergeTextValues(buckets.spellbook, spellNames);
        return;
      }

      if (/at will|without expending a spell slot|without a spell slot/i.test(normalized)) {
        buckets.atWill = mergeTextValues(buckets.atWill, spellNames);
        return;
      }

      if (/short or long rest|once per short rest|once you finish a short rest/i.test(normalized)) {
        buckets.perShortRest = mergeTextValues(buckets.perShortRest, spellNames);
        return;
      }

      if (/long rest|once per long rest|until you finish a long rest/i.test(normalized)) {
        buckets.perLongRest = mergeTextValues(buckets.perLongRest, spellNames);
        return;
      }

      if (/learn|know|gain|cantrip|you can cast/i.test(normalized)) {
        buckets.known = mergeTextValues(buckets.known, spellNames);
      }
    });

  return buckets;
}

export function validateGuideSelections(params: {
  actor: ActorSheet;
  spec: GuidedChoiceSpec;
  setup: GuidedSetupState;
  mode: GuidedFlowMode;
  targetClass: ClassEntry;
  currentSubclassId: string;
  speciesSkillChoiceCount?: number;
  backgroundSkillChoiceCount?: number;
  backgroundAbilityChoiceCount?: number;
  classSkillChoiceCount?: number;
}) {
  if (params.mode === "setup" && (!params.setup.speciesId || !params.setup.backgroundId || !params.setup.classId)) {
    return "Choose a species, background, and class.";
  }

  if (!hasEnoughGuideSelections(params.setup.speciesSkillChoices, params.speciesSkillChoiceCount ?? 0)) {
    return "Choose every required species skill.";
  }

  if (!hasEnoughGuideSelections(params.setup.backgroundSkillChoices, params.backgroundSkillChoiceCount ?? 0)) {
    return "Choose every required background skill.";
  }

  if (!hasEnoughGuideSelections(params.setup.abilityChoices, params.backgroundAbilityChoiceCount ?? 0)) {
    return "Choose the background ability score increases.";
  }

  if (!hasEnoughGuideSelections(params.setup.classSkillChoices, params.classSkillChoiceCount ?? 0)) {
    return "Choose every required class skill.";
  }

  if (params.spec.subclassOptions.length > 0 && !params.currentSubclassId && !params.setup.subclassId.trim()) {
    return "Choose the subclass unlocked by this guide step.";
  }

  if (!hasEnoughGuideSelections(params.setup.classFeatIds, params.spec.classFeatCount)) {
    return "Choose every required class feat.";
  }

  if (!hasEnoughGuideSelections(params.setup.optionalFeatureIds, params.spec.optionalFeatureCount)) {
    return "Choose every required class feature option.";
  }

  if (!hasEnoughGuideSelections(params.setup.cantripIds, params.spec.cantripCount)) {
    return "Choose every required cantrip.";
  }

  if (!hasEnoughGuideSelections(params.setup.knownSpellIds, params.spec.knownSpellCount)) {
    return "Choose every required spell.";
  }

  if (!hasEnoughGuideSelections(params.setup.spellbookSpellIds, params.spec.spellbookCount)) {
    return "Choose every required spellbook spell.";
  }

  if (!hasEnoughGuideSelections(params.setup.expertiseSkillChoices, params.spec.expertiseCount)) {
    return "Choose every required expertise skill.";
  }

  if (params.spec.abilityImprovementCount > 0 && params.setup.asiMode === "feat" && !params.setup.asiFeatId.trim()) {
    return "Choose a feat or switch the guide to ability score increases.";
  }

  if (
    params.spec.abilityImprovementCount > 0 &&
    params.setup.asiMode === "ability" &&
    params.setup.asiAbilityChoices.filter(Boolean).length < params.spec.abilityImprovementCount * 2
  ) {
    return "Choose the ability score increases for this level.";
  }

  return null;
}

export function hasEnoughGuideSelections(values: string[], requiredCount: number) {
  if (requiredCount <= 0) {
    return true;
  }

  return values.slice(0, requiredCount).every((entry) => entry.trim().length > 0);
}

export function padGuideSelections<T>(current: T[], count: number, fallback: T[]) {
  const next = [...current].slice(0, count);

  while (next.length < count) {
    const candidate = fallback.find((entry) => !next.includes(entry));
    if (candidate === undefined && fallback[0] === undefined) {
      break;
    }

    next.push((candidate ?? fallback[0]) as T);
  }

  return next;
}

export function replaceGuideSelection<T>(current: T[], index: number, value: T) {
  return current.map((entry, entryIndex) => (entryIndex === index ? value : entry));
}

export function guideOptionDisabled<T>(current: T[], index: number, value: T) {
  return current.some((entry, entryIndex) => entryIndex !== index && entry === value);
}

export function deriveInventoryEquipment(actor: ActorSheet, items: CompendiumItemEntry[], proficiencyBonus: number) {
  const armorItems: ArmorEntry[] = [];
  const attacks: AttackEntry[] = [];

  actor.inventory
    .filter((entry) => entry.equipped)
    .forEach((entry) => {
      const item = findByName(items, entry.name);

      if (!item) {
        return;
      }

      const normalizedArmorType = normalizeKey(item.armorType);
      if (item.armorClass > 0 || normalizedArmorType.includes("shield")) {
        armorItems.push({
          id: `derived-armor:${item.id}:${entry.id}`,
          name: item.name,
          kind: normalizedArmorType.includes("shield") ? "shield" : "armor",
          armorClass: item.armorClass || (normalizedArmorType.includes("shield") ? 2 : 10),
          maxDexBonus: item.maxDexBonus,
          bonus: 0,
          equipped: true,
          notes: [item.armorType, item.properties.join(", ")].filter(Boolean).join(" • ")
        });
      }

      if (item.damage.trim()) {
        const attackAbility = deriveAttackAbility(item, actor);
        const attackModifier = abilityModifierTotal(actor, attackAbility);
        const hasProficiency = !normalizeKey(item.properties.join(" ")).includes("improvised");
        attacks.push({
          id: `derived-attack:${item.id}:${entry.id}`,
          name: item.name,
          attackBonus: attackModifier + (hasProficiency ? proficiencyBonus : 0),
          damage: appendDamageModifier(item.damage, attackModifier),
          damageType: item.damageType,
          notes: [item.range, item.properties.join(", ")].filter(Boolean).join(" • ")
        });
      }
    });

  return {
    armorItems,
    attacks
  };
}

export function deriveAttackAbility(item: CompendiumItemEntry, actor: ActorSheet): AbilityKey {
  const properties = normalizeKey(item.properties.join(" "));
  const range = normalizeKey(item.range);

  if (properties.includes("finesse")) {
    return abilityModifierTotal(actor, "dex") > abilityModifierTotal(actor, "str") ? "dex" : "str";
  }

  if (range.includes("/") || range.includes("ranged") || normalizeKey(item.itemType).includes("ranged")) {
    return "dex";
  }

  return "str";
}

export function appendDamageModifier(damage: string, modifier: number) {
  if (!damage.trim()) {
    return "";
  }

  if (/[+-]\s*\d+\s*$/i.test(damage) || modifier === 0) {
    return damage;
  }

  return modifier > 0 ? `${damage} + ${modifier}` : `${damage} - ${Math.abs(modifier)}`;
}

export function mergeDerivedArmorItems(current: ArmorEntry[], derived: ArmorEntry[]) {
  const manual = current.filter((entry) => !entry.id.startsWith("derived-armor:"));
  return [...manual, ...derived];
}

export function mergeDerivedAttacks(current: AttackEntry[], derived: AttackEntry[]) {
  const manual = current.filter((entry) => !entry.id.startsWith("derived-attack:"));
  return [...manual, ...derived];
}

export function buildMainAutosaveState(actor: ActorSheet) {
  return {
    hitPoints: actor.hitPoints,
    experience: actor.experience,
    inspiration: actor.inspiration,
    initiativeRoll: actor.initiativeRoll ?? null,
    spellSlots: actor.spellSlots,
    preparedSpells: actor.preparedSpells,
    resources: actor.resources,
    inventory: actor.inventory,
    currency: actor.currency,
    notes: actor.notes,
    conditions: actor.conditions,
    exhaustionLevel: actor.exhaustionLevel,
    concentration: actor.concentration,
    deathSaves: actor.deathSaves,
    classes: actor.classes.map((entry) => ({ id: entry.id, usedHitDice: entry.usedHitDice }))
  };
}

export function deriveGuidedChoiceSpec(params: {
  actor: ActorSheet;
  classes: ClassEntry[];
  spells: SpellEntry[];
  feats: FeatEntry[];
  optionalFeatures: CompendiumOptionalFeatureEntry[];
  targetClassId: string;
  targetActorClassId: string;
  targetSubclassId: string;
  mode: GuidedFlowMode;
}): GuidedChoiceSpec {
  const actorClassForGuide =
    params.targetActorClassId && params.targetActorClassId !== NEW_GUIDED_CLASS_ID
      ? params.actor.classes.find((entry) => entry.id === params.targetActorClassId) ?? null
      : null;
  const classEntry =
    (actorClassForGuide ? findCompendiumClass(actorClassForGuide, params.classes) ?? null : null) ??
    params.classes.find((entry) => entry.id === params.targetClassId) ??
    null;

  if (!classEntry) {
    return {
      subclassOptions: [],
      classFeatOptions: [],
      classFeatCount: 0,
      optionalFeatureOptions: [],
      optionalFeatureCount: 0,
      cantripOptions: [],
      cantripCount: 0,
      knownSpellOptions: [],
      knownSpellCount: 0,
      spellbookOptions: [],
      spellbookCount: 0,
      expertiseSkillOptions: [],
      expertiseCount: 0,
      abilityImprovementCount: 0
    };
  }

  const currentActorClass =
    params.mode === "levelup" && params.targetActorClassId && params.targetActorClassId !== NEW_GUIDED_CLASS_ID
      ? params.actor.classes.find((entry) => entry.id === params.targetActorClassId) ?? null
      : null;
  const currentLevel = params.mode === "setup" ? 0 : currentActorClass?.level ?? 0;
  const targetLevel = Math.max(1, currentLevel + 1);
  const unlockedClassFeatures = classEntry.features.filter((entry) => entry.level > currentLevel && entry.level <= targetLevel);
  const currentSubclassId = currentActorClass
    ? currentActorClass.subclassId ?? params.actor.build?.classes.find((entry) => entry.id === currentActorClass.id)?.subclassId ?? ""
    : "";
  const activeSubclassId = params.targetSubclassId || currentSubclassId;
  const activeSubclass =
    activeSubclassId.trim().length > 0 ? classEntry.subclasses.find((entry) => entry.id === activeSubclassId) ?? null : null;
  const unlockedSubclassFeatures = activeSubclass?.features.filter((entry) => entry.level > currentLevel && entry.level <= targetLevel) ?? [];

  const cantripCount = Math.max(0, readClassTableValue(classEntry, targetLevel, ["cantrip"]) - readClassTableValue(classEntry, currentLevel, ["cantrip"]));
  const knownSpellCount =
    classEntry.spellPreparation === "known"
      ? Math.max(0, readClassTableValue(classEntry, targetLevel, ["spells known"]) - readClassTableValue(classEntry, currentLevel, ["spells known"]))
      : 0;
  const spellbookCount =
    classEntry.spellPreparation === "spellbook" && normalizeKey(classEntry.name) === "wizard" ? (currentLevel === 0 ? 6 : 2) : 0;
  const invocationCount = Math.max(
    0,
    readClassTableValue(classEntry, targetLevel, ["invocation"]) - readClassTableValue(classEntry, currentLevel, ["invocation"])
  );
  const fightingStyleCount = unlockedClassFeatures.some((entry) => normalizeKey(entry.name).includes("fighting style")) ? 1 : 0;
  const expertiseCount = unlockedClassFeatures
    .filter((entry) => normalizeKey(entry.name).includes("expertise"))
    .reduce((sum, entry) => sum + parseChoiceCount(entry.description, 2), 0);
  const metamagicCount = unlockedClassFeatures
    .filter((entry) => normalizeKey(entry.name).includes("metamagic"))
    .reduce((sum, entry) => sum + parseChoiceCount(entry.description, currentLevel === 0 ? 2 : 1), 0);
  const maneuverCount = unlockedSubclassFeatures
    .filter((entry) => /maneuver|combat superiority/i.test(entry.name) || /maneuver/i.test(entry.description))
    .reduce((sum, entry) => sum + parseChoiceCount(entry.description, 3), 0);
  const abilityImprovementCount = unlockedClassFeatures.some((entry) => normalizeKey(entry.name).includes("ability score improvement")) ? 1 : 0;
  const existingFeatNames = new Set(params.actor.feats.map((entry) => normalizeKey(entry)));
  const classFeatOptions = params.feats.filter(
    (entry) => normalizeKey(entry.category).includes("fs") && !existingFeatNames.has(normalizeKey(entry.name))
  );
  const optionalFeatureOptions =
    invocationCount > 0
      ? params.optionalFeatures.filter(
          (entry) =>
            normalizeKey(entry.category).includes("eldritch invocation") &&
            !params.actor.features.some((feature) => normalizeKey(feature) === normalizeKey(entry.name))
        )
      : metamagicCount > 0
        ? params.optionalFeatures.filter(
            (entry) =>
              normalizeKey(entry.category).includes("metamagic") &&
              !params.actor.features.some((feature) => normalizeKey(feature) === normalizeKey(entry.name))
          )
        : maneuverCount > 0
          ? params.optionalFeatures.filter(
              (entry) =>
                normalizeKey(entry.category).includes("maneuver") &&
                !params.actor.features.some((feature) => normalizeKey(feature) === normalizeKey(entry.name))
            )
          : [];
  const optionalFeatureCount = invocationCount + metamagicCount + maneuverCount;
  const maxSpellLevel = deriveMaximumSpellLevelForClass(classEntry, targetLevel);
  const existingSpellNames = new Set(
    [
      ...params.actor.spells,
      ...params.actor.preparedSpells,
      ...params.actor.spellState.spellbook,
      ...params.actor.spellState.alwaysPrepared,
      ...params.actor.spellState.atWill,
      ...params.actor.spellState.perShortRest,
      ...params.actor.spellState.perLongRest
    ].map((entry) => normalizeKey(entry))
  );
  const classSpellOptions = params.spells.filter((entry) => spellMatchesSingleClassFilter(entry, classEntry.name));
  const cantripOptions = classSpellOptions.filter((entry) => entry.level === "cantrip" && !existingSpellNames.has(normalizeKey(entry.name)));
  const leveledSpellOptions = classSpellOptions.filter(
    (entry) => typeof entry.level === "number" && entry.level <= maxSpellLevel && !existingSpellNames.has(normalizeKey(entry.name))
  );

  return {
    subclassOptions: targetLevel >= (classEntry.subclassLevel ?? 99) ? classEntry.subclasses : [],
    classFeatOptions,
    classFeatCount: fightingStyleCount,
    optionalFeatureOptions,
    optionalFeatureCount,
    cantripOptions,
    cantripCount,
    knownSpellOptions: leveledSpellOptions,
    knownSpellCount,
    spellbookOptions: leveledSpellOptions,
    spellbookCount,
    expertiseSkillOptions: params.actor.skills.filter((entry) => entry.proficient && !entry.expertise),
    expertiseCount,
    abilityImprovementCount
  };
}

export function readClassTableValue(classEntry: ClassEntry, level: number, tokens: string[]) {
  if (level <= 0) {
    return 0;
  }

  for (const table of classEntry.tables) {
    const row = table.rows[level - 1];

    if (!row) {
      continue;
    }

    const index = table.columns.findIndex((label) => tokens.every((token) => normalizeKey(label).includes(token)));
    if (index >= 0) {
      return readTableCounter(row[index]);
    }
  }

  return 0;
}

export function deriveMaximumSpellLevelForClass(classEntry: ClassEntry, level: number) {
  let maxLevel = 0;

  for (const table of classEntry.tables) {
    const row = table.rows[level - 1];

    if (!row) {
      continue;
    }

    table.columns.forEach((label, index) => {
      const slotLevel = extractSpellSlotLevel(label);
      if (slotLevel && readTableCounter(row[index]) > 0) {
        maxLevel = Math.max(maxLevel, slotLevel);
      }
    });

    const spellSlotsIndex = table.columns.findIndex((label) => normalizeKey(label) === "spell slots");
    const slotLevelIndex = table.columns.findIndex((label) => normalizeKey(label) === "slot level");
    if (spellSlotsIndex >= 0 && slotLevelIndex >= 0 && readTableCounter(row[spellSlotsIndex]) > 0) {
      maxLevel = Math.max(maxLevel, readTableCounter(row[slotLevelIndex]));
    }
  }

  return maxLevel;
}

export function parseChoiceCount(description: string, fallback: number) {
  const normalized = description.toLowerCase();
  if (/\bsix\b/.test(normalized)) return 6;
  if (/\bfive\b/.test(normalized)) return 5;
  if (/\bfour\b/.test(normalized)) return 4;
  if (/\bthree\b/.test(normalized)) return 3;
  if (/\btwo\b/.test(normalized)) return 2;
  if (/\bone\b/.test(normalized)) return 1;
  const numericMatch = normalized.match(/\b(\d+)\b/);
  return numericMatch ? Number(numericMatch[1]) : fallback;
}

export function deriveSpellSlots(actor: ActorSheet, classes: ClassEntry[]) {
  const totals = Array.from({ length: 9 }, (_, index) => ({
    level: index + 1,
    total: 0,
    used: actor.spellSlots.find((entry) => entry.level === index + 1)?.used ?? 0
  }));

  actor.classes.forEach((actorClass) => {
    const classEntry = findCompendiumClass(actorClass, classes);
    classEntry?.tables.forEach((table) => {
      const row = table.rows[actorClass.level - 1];

      if (!row) {
        return;
      }

      table.columns.forEach((label, columnIndex) => {
        const slotLevel = extractSpellSlotLevel(label);
        const value = readTableCounter(row[columnIndex]);

        if (!slotLevel || value <= 0) {
          return;
        }

        totals[slotLevel - 1].total += value;
      });

      const spellSlotsIndex = table.columns.findIndex((label) => normalizeKey(label) === "spell slots");
      const slotLevelIndex = table.columns.findIndex((label) => normalizeKey(label) === "slot level");

      if (spellSlotsIndex < 0 || slotLevelIndex < 0) {
        return;
      }

      const pactSlotCount = readTableCounter(row[spellSlotsIndex]);
      const pactSlotLevel = readTableCounter(row[slotLevelIndex]);

      if (pactSlotCount > 0 && pactSlotLevel > 0 && pactSlotLevel <= totals.length) {
        totals[pactSlotLevel - 1].total += pactSlotCount;
      }
    });
  });

  return totals.map((entry) => ({
    ...entry,
    used: Math.min(entry.used, entry.total)
  }));
}

export function extractSpellSlotLevel(label: string) {
  const normalized = normalizeKey(label);
  const match = label.match(/\b([1-9])(st|nd|rd|th)\b/i) ?? normalized.match(/^([1-9])(st|nd|rd|th)?$/);
  return match ? Number(match[1]) : null;
}

export function readTableCounter(value: string | undefined) {
  if (!value) {
    return 0;
  }

  const normalized = value.trim();
  const leading = normalized.match(/^(\d+)/);

  if (leading) {
    return Number(leading[1]);
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mergeTextValues(current: string[], next: string[]) {
  return Array.from(new Set([...current, ...next].filter(Boolean)));
}

export function splitCommaValues(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

export function toAbilityKey(value: string): AbilityKey | null {
  switch (normalizeKey(value)) {
    case "str":
    case "strength":
      return "str";
    case "dex":
    case "dexterity":
      return "dex";
    case "con":
    case "constitution":
      return "con";
    case "int":
    case "intelligence":
      return "int";
    case "wis":
    case "wisdom":
      return "wis";
    case "cha":
    case "charisma":
      return "cha";
    default:
      return null;
  }
}

export function mergeAbilityKeys(current: AbilityKey[], next: AbilityKey[]) {
  return Array.from(new Set([...current, ...next]));
}

export function derivePreparedSpellLimit(actor: ActorSheet, classes: ClassEntry[]) {
  return actor.classes.reduce((sum, actorClass) => {
    const classEntry = findCompendiumClass(actorClass, classes);

    if (!classEntry || (classEntry.spellPreparation !== "prepared" && classEntry.spellPreparation !== "spellbook")) {
      return sum;
    }

    const fromTable = findPreparedSpellCount(actorClass, classEntry);

    if (fromTable > 0) {
      return sum + fromTable;
    }

    const spellcastingAbility = actorClass.spellcastingAbility ?? classEntry.spellcastingAbility;

    if (!spellcastingAbility) {
      return sum;
    }

    return sum + Math.max(1, actorClass.level + abilityModifierTotal(actor, spellcastingAbility));
  }, 0);
}

export function findPreparedSpellCount(actorClass: ActorClassEntry, classEntry: ClassEntry) {
  for (const table of classEntry.tables) {
    const preparedColumnIndex = table.columns.findIndex((label) => normalizeKey(label).includes("prepared spell"));
    const row = table.rows[actorClass.level - 1];

    if (preparedColumnIndex >= 0 && row) {
      const value = readTableCounter(row[preparedColumnIndex]);

      if (value > 0) {
        return value;
      }
    }
  }

  return 0;
}

export function deriveGuidedHitPointMax(actor: ActorSheet) {
  if (actor.classes.length === 0) {
    return actor.hitPoints.max;
  }

  const constitutionModifier = abilityModifierTotal(actor, "con");
  const firstClass = actor.classes[0];
  const baseHp = Math.max(1, firstClass.hitDieFaces + constitutionModifier);
  const leveledHp = (actor.build?.selections ?? []).reduce((sum, selection) => sum + extractLevelUpHpGain(selection.notes), 0);

  if (leveledHp > 0) {
    return Math.max(baseHp + leveledHp, baseHp);
  }

  if (totalLevel(actor) > 1 && actor.hitPoints.max > 0) {
    return actor.hitPoints.max;
  }

  return baseHp;
}

export function effectiveHitPointMax(baseMax: number, reducedMax: number) {
  return Math.max(0, Math.max(0, baseMax) - Math.max(0, reducedMax));
}

export function normalizeHitPoints(hitPoints: ActorSheet["hitPoints"], baseMax: number): ActorSheet["hitPoints"] {
  const max = Math.max(0, Number.isFinite(baseMax) ? baseMax : hitPoints.max);
  const reducedMax = Math.max(0, hitPoints.reducedMax || 0);
  const temp = Math.max(0, hitPoints.temp || 0);
  const current = Math.max(0, Math.min(hitPoints.current || 0, effectiveHitPointMax(max, reducedMax)));

  return {
    current,
    max,
    temp,
    reducedMax
  };
}

export function healHitPoints(hitPoints: ActorSheet["hitPoints"], healing: number, baseMax: number) {
  const normalized = normalizeHitPoints(hitPoints, baseMax);

  if (healing <= 0) {
    return normalized;
  }

  return {
    ...normalized,
    current: Math.min(effectiveHitPointMax(normalized.max, normalized.reducedMax), normalized.current + healing)
  };
}

export function deriveHitPointDisplayState(hitPoints: ActorSheet["hitPoints"], baseMax: number) {
  const normalized = normalizeHitPoints(hitPoints, baseMax);
  const effectiveMax = effectiveHitPointMax(normalized.max, normalized.reducedMax);

  return {
    current: normalized.current,
    damage: Math.max(0, effectiveMax - normalized.current),
    temp: normalized.temp,
    effectiveMax,
    baseMax: normalized.max,
    reducedMax: normalized.reducedMax
  };
}

export function extractLevelUpHpGain(notes: string) {
  const match = notes.match(/([+-]?\d+)\s*hp/i);
  return match ? Number(match[1]) : 0;
}

export function deriveClassResources(actor: ActorSheet, classes: ClassEntry[]) {
  const resources: DerivedResourceDefinition[] = [];

  actor.classes.forEach((actorClass) => {
    const classEntry = findCompendiumClass(actorClass, classes);

    if (!classEntry) {
      return;
    }

    classEntry.tables.forEach((table) => {
      const row = table.rows[actorClass.level - 1];

      if (!row) {
        return;
      }

      table.columns.forEach((column, columnIndex) => {
        if (!isResourceColumn(column)) {
          return;
        }

        const max = readTableCounter(row[columnIndex]);

        if (max <= 0) {
          return;
        }

        resources.push({
          id: `derived:${actorClass.id}:${normalizeKey(column)}`,
          name: formatDerivedResourceName(actorClass.name, column),
          max,
          resetOn: inferResourceReset(column),
          restoreAmount: max,
          description: describeDerivedResource(actorClass.name, column, max),
          source: classEntry.source
        });
      });
    });
  });

  return Array.from(new Map(resources.map((entry) => [normalizeKey(entry.name), entry])).values());
}

export function isResourceColumn(label: string) {
  const normalized = normalizeKey(label);

  if (extractSpellSlotLevel(label) !== null) {
    return false;
  }

  if (
    normalized === "spell slots" ||
    normalized === "slot level" ||
    normalized.includes("cantrip") ||
    normalized.includes("prepared spell") ||
    normalized.includes("spells known") ||
    normalized.includes("weapon mastery") ||
    normalized.includes("invocations known") ||
    normalized === "features"
  ) {
    return false;
  }

  return [
    "rage",
    "focus",
    "ki",
    "sorcery",
    "superiority",
    "wild shape",
    "channel divinity",
    "lay on hands",
    "bardic inspiration",
    "uses",
    "surges",
    "dice"
  ].some((token) => normalized.includes(token));
}

export function formatDerivedResourceName(className: string, label: string) {
  const normalized = normalizeKey(label);

  if (normalized.startsWith(normalizeKey(className))) {
    return label;
  }

  return `${className} ${label}`.trim();
}

export function inferResourceReset(label: string) {
  const normalized = normalizeKey(label);

  if (
    normalized.includes("focus") ||
    normalized.includes("ki") ||
    normalized.includes("superiority") ||
    normalized.includes("channel divinity") ||
    normalized.includes("wild shape")
  ) {
    return "Short Rest";
  }

  return "Long Rest";
}

export function describeDerivedResource(className: string, label: string, max: number) {
  return `${className} automatically provides ${max} ${label.toLowerCase()} based on the current class table.`;
}

export function mergeDerivedResources(resources: ResourceEntry[], derived: DerivedResourceDefinition[]) {
  const manualByKey = new Map<string, ResourceEntry>();
  const derivedById = new Map<string, ResourceEntry>();
  const derivedByKey = new Map<string, ResourceEntry>();
  const consumedIds = new Set<string>();
  const merged: ResourceEntry[] = [];

  resources.forEach((entry) => {
    if (entry.id.startsWith("derived:")) {
      derivedById.set(entry.id, entry);
      derivedByKey.set(normalizeKey(entry.name), entry);
      return;
    }

    manualByKey.set(normalizeKey(entry.name), entry);
  });

  derived.forEach((entry) => {
    const existingDerived = derivedById.get(entry.id) ?? derivedByKey.get(normalizeKey(entry.name));
    const manualOverride = manualByKey.get(normalizeKey(entry.name));
    const existing = existingDerived ?? manualOverride;
    const max = existingDerived ? entry.max : existing?.max && existing.max > 0 ? existing.max : entry.max;
    const current = Math.min(max, existing?.current ?? entry.max);

    if (existing) {
      consumedIds.add(existing.id);
    }

    merged.push({
      id: existing?.id ?? entry.id,
      name: existingDerived ? entry.name : existing?.name ?? entry.name,
      current,
      max,
      resetOn: existingDerived ? entry.resetOn : existing?.resetOn || entry.resetOn,
      restoreAmount:
        existingDerived
          ? entry.restoreAmount
          : existing?.restoreAmount && existing.restoreAmount > 0
            ? existing.restoreAmount
            : entry.restoreAmount
    });
  });

  resources.forEach((entry) => {
    if (!consumedIds.has(entry.id)) {
      merged.push(entry);
    }
  });

  return merged;
}

export function collectFeatureRows(
  actor: ActorSheet,
  compendium: CampaignSnapshot["compendium"],
  selectedSpecies: CampaignSnapshot["compendium"]["races"][number] | null,
  selectedBackground: CampaignSnapshot["compendium"]["backgrounds"][number] | null
) {
  const rows: DetailRowEntry[] = [];

  if (selectedSpecies) {
    rows.push(
      ...parseReferenceFeatureRows("Species", selectedSpecies, [
        { label: "Size", value: selectedSpecies.sizes.join(", ") || "Unknown" },
        { label: "Speed", value: `${selectedSpecies.speed} ft` },
        { label: "Languages", value: selectedSpecies.languages.join(", ") || "None" }
      ])
    );
  }

  if (selectedBackground) {
    rows.push(
      ...parseReferenceFeatureRows("Background", selectedBackground, [
        { label: "Skills", value: deriveBackgroundSkillProficiencies(selectedBackground).join(", ") || "None" },
        { label: "Tools", value: selectedBackground.toolProficiencies.join(", ") || "None" },
        { label: "Languages", value: selectedBackground.languageProficiencies.join(", ") || "None" }
      ])
    );
  }

  availableClassFeatures(actor, compendium.classes).forEach((entry) => {
    rows.push({
      id: entry.key,
      eyebrow: "Class Feature",
      title: entry.name,
      subtitle: `${entry.className} • Level ${entry.level}`,
      source: entry.source,
      description: entry.description
    });
  });

  actor.classes.forEach((actorClass) => {
    const classEntry = findCompendiumClass(actorClass, compendium.classes);
    const subclassId = actorClass.subclassId ?? actor.build?.classes.find((entry) => entry.id === actorClass.id)?.subclassId;
    const subclass = classEntry?.subclasses.find((entry) => entry.id === subclassId);

    subclass?.features
      .filter((entry) => entry.level <= actorClass.level)
      .forEach((entry) => {
        rows.push({
          id: `${subclass.id}:${entry.reference || entry.name}:${entry.level}`,
          eyebrow: "Subclass Feature",
          title: entry.name,
          subtitle: `${subclass.name} • Level ${entry.level}`,
          source: entry.source || subclass.source,
          description: entry.description
        });
      });
  });

  actor.feats.forEach((featName) => {
    const feat = findByName(compendium.feats, featName);

    rows.push(
      feat
        ? {
            id: feat.id,
            eyebrow: "Feat",
            title: feat.name,
            subtitle: feat.prerequisites ? `Prerequisite: ${feat.prerequisites}` : feat.category,
            source: feat.source,
            description: [feat.abilityScoreIncrease, feat.description].filter(Boolean).join("\n\n")
          }
        : {
            id: `feat:${normalizeKey(featName)}`,
            eyebrow: "Feat",
            title: featName
          }
    );
  });

  actor.features.forEach((featureName) => {
    const alreadyIncluded = rows.some((entry) => normalizeKey(entry.title) === normalizeKey(featureName));

    if (alreadyIncluded) {
      return;
    }

    const optionalFeature = findByName(compendium.optionalFeatures, featureName);

    rows.push(
      optionalFeature
        ? createReferenceRow("Optional Feature", optionalFeature, [{ label: "Prerequisites", value: optionalFeature.prerequisites || "None" }])
        : {
            id: `feature:${normalizeKey(featureName)}`,
            eyebrow: "Feature",
            title: featureName
          }
    );
  });

  return Array.from(new Map(rows.map((entry) => [`${entry.eyebrow}:${normalizeKey(entry.title)}`, entry])).values());
}

export function collectSpellRows(spellNames: string[], preparedSpells: string[], spells: SpellEntry[], preparedSpellLimit: number) {
  return spellNames.map((spellName) => {
    const spell = findByName(spells, spellName);

    if (!spell) {
      return {
        id: `spell:${normalizeKey(spellName)}`,
        eyebrow: "Spell",
        title: spellName
      } satisfies DetailRowEntry;
    }

    return {
      id: spell.id,
      eyebrow: spell.level === "cantrip" ? "Cantrip" : `Spell ${spell.level}`,
      title: spell.name,
      subtitle: `${spell.school} • ${preparedSpells.includes(spell.name) ? "Prepared" : "Known"}`,
      source: spell.source,
      description: spell.fullDescription || spell.description,
      meta: [
        { label: "Casting Time", value: `${spell.castingTimeValue} ${spell.castingTimeUnit}` },
        { label: "Range", value: spell.rangeType === "feet" ? `${spell.rangeValue} ft` : spell.rangeType },
        { label: "Duration", value: spell.durationUnit === "instant" ? "Instant" : `${spell.durationValue} ${spell.durationUnit}` },
        { label: "Preparation Limit", value: preparedSpellLimit > 0 ? String(preparedSpellLimit) : "Not prepared" }
      ]
    } satisfies DetailRowEntry;
  });
}

export function collectFeatRows(featNames: string[], feats: FeatEntry[]) {
  return featNames.map((featName) => {
    const feat = findByName(feats, featName);

    if (!feat) {
      return {
        id: `feat:${normalizeKey(featName)}`,
        eyebrow: "Feat",
        title: featName
      } satisfies DetailRowEntry;
    }

    return {
      id: feat.id,
      eyebrow: "Feat",
      title: feat.name,
      subtitle: feat.prerequisites ? `Prerequisite: ${feat.prerequisites}` : feat.category,
      source: feat.source,
      description: [feat.abilityScoreIncrease, feat.description].filter(Boolean).join("\n\n")
    } satisfies DetailRowEntry;
  });
}

export function createReferenceRow(eyebrow: string, entry: CompendiumReferenceEntry, meta: DetailRowMeta[] = []): DetailRowEntry {
  return {
    id: entry.id,
    eyebrow,
    title: entry.name,
    subtitle: entry.category,
    source: entry.source,
    description: entry.entries || entry.description,
    tags: entry.tags,
    meta
  };
}

export function parseReferenceFeatureRows(eyebrow: string, entry: CompendiumReferenceEntry, meta: DetailRowMeta[] = []) {
  const text = entry.entries || entry.description;
  const inlinePairs = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line, index) => {
      const inlineMatch = line.match(/^([^:]+):\.?\s*(.+)$/);

      if (!inlineMatch) {
        return [];
      }

      return [
        {
          id: `${entry.id}:inline:${index}`,
          eyebrow,
          title: inlineMatch[1].trim(),
          subtitle: entry.category,
          source: entry.source,
          description: inlineMatch[2].trim(),
          tags: entry.tags
        } satisfies DetailRowEntry
      ];
    });

  if (inlinePairs.length > 0) {
    return inlinePairs;
  }

  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const parsed: DetailRowEntry[] = [];
  let currentTitle = "";
  let currentBody: string[] = [];

  function flushCurrent() {
    if (!currentTitle) {
      return;
    }

    parsed.push({
      id: `${entry.id}:${normalizeKey(currentTitle)}`,
      eyebrow,
      title: currentTitle,
      subtitle: entry.category,
      source: entry.source,
      description: currentBody.join("\n"),
      tags: entry.tags,
      meta
    });
  }

  lines.forEach((line) => {
    if (looksLikeFeatureHeading(line)) {
      flushCurrent();
      currentTitle = line.replace(/[:.]+$/, "").trim();
      currentBody = [];
      return;
    }

    currentBody.push(line);
  });
  flushCurrent();

  return parsed.length > 0 ? parsed : [createReferenceRow(eyebrow, entry, meta)];
}

export function looksLikeFeatureHeading(value: string) {
  return value.length <= 48 && !value.includes("{@") && !/[.!?]$/.test(value);
}

export function findByName<T extends { name: string }>(entries: T[], name: string) {
  return entries.find((entry) => normalizeKey(entry.name) === normalizeKey(name));
}

export function findSpellEntriesByNames(spellNames: string[], spells: SpellEntry[]) {
  const namesToFind = new Set(spellNames.map((entry) => normalizeKey(entry)));

  return spells
    .filter((entry) => namesToFind.has(normalizeKey(entry.name)))
    .sort((left, right) => {
      const leftLevel = left.level === "cantrip" ? 0 : left.level;
      const rightLevel = right.level === "cantrip" ? 0 : right.level;

      if (leftLevel !== rightLevel) {
        return leftLevel - rightLevel;
      }

      return left.name.localeCompare(right.name);
    });
}

export function findSpellIdsByNames(spellNames: string[], spells: SpellEntry[]) {
  return spellNames
    .map((name) => findByName(spells, name)?.id ?? "")
    .filter((entry) => entry.length > 0);
}

export function findSpellNamesByIds(spellIds: string[], spells: SpellEntry[]) {
  return spellIds
    .map((spellId) => spells.find((entry) => entry.id === spellId)?.name ?? "")
    .filter((entry) => entry.length > 0);
}

export function syncBuildClasses(actorClasses: ActorClassEntry[], currentBuildClasses: NonNullable<ActorSheet["build"]>["classes"]) {
  return actorClasses.map((entry) => {
    const existing = currentBuildClasses.find((buildClass) => buildClass.id === entry.id);

    return {
      id: entry.id,
      classId: entry.compendiumId,
      className: entry.name,
      classSource: entry.source,
      subclassId: entry.subclassId ?? existing?.subclassId,
      subclassName: entry.subclassName ?? existing?.subclassName,
      subclassSource: entry.subclassSource ?? existing?.subclassSource,
      level: entry.level
    };
  });
}
