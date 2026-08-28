import { findSpeciesProgression } from "@shared/data/progression";
import { compendiumRefMatches, createCompendiumRef, parseCompendiumRef } from "@shared/rules/compendiumRefs";
import type {
  AbilityKey,
  ActorClassEntry,
  ActorSheet,
  ArmorEntry,
  AttackEntry,
  CampaignSnapshot,
  ClassEntry,
  CompendiumBackgroundEntry,
  CompendiumChoiceGroup,
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
  GuidedEquipmentGroup,
  GuidedFlowMode,
  GuidedSkillChoiceConfig,
  GuidedSpeciesChoiceGroup,
  GuidedSetupState,
  SheetTab
} from "../playerNpcSheet2024Types";
import { NEW_GUIDED_CLASS_ID } from "../playerNpcSheet2024Types";
import { abilityModifierTotal, availableClassFeatures, findCompendiumClass, formatModifier, normalizeKey, totalLevel } from "../sheetUtils";
import {
  evaluateActorPreparedSpellsLimit,
  evaluateActorSpellSlots,
  evaluateActorDerivedResources,
  evaluateClassChoicesForLevel,
  progressionChoiceOptionIsEligible,
  resolveProgressionEffects
} from "../../../../../shared/rules/progressionEngine";
import {
  findBackgroundProgression,
  findClassProgression,
  findFeatProgression,
  findProgressionChoiceDomain,
  findSubclassesForClass
} from "../../../../../shared/data/progression";

export function defaultTabForActor(actor: ActorSheet): SheetTab {
  return actor.build?.speciesId || actor.build?.backgroundId || actor.classes.length > 0 ? "main" : "edit";
}

function actorSpeciesProgression(actor: ActorSheet) {
  return actor.build?.speciesId
    ? (findSpeciesProgression(actor.build.speciesId) ?? findSpeciesProgression(actor.build.speciesName ?? actor.species))
    : findSpeciesProgression(actor.species);
}

export function backgroundForId(backgrounds: CompendiumBackgroundEntry[], backgroundId: string) {
  return backgrounds.find((entry) => entry.id === backgroundId) ?? null;
}

export function deriveBackgroundAbilityConfig(background: CompendiumBackgroundEntry | null) {
  const progression = background ? (findBackgroundProgression(background.id) ?? findBackgroundProgression(background.name)) : null;
  const allowedAbilities = progression?.abilityScores.options ?? [];
  const modes: GuidedAbilityChoiceMode[] = [];

  if (allowedAbilities.length > 0) {
    buildFallbackBackgroundAbilityModes(allowedAbilities).forEach((mode, index) => {
      modes.push({
        id: index === 0 ? "primary" : index === 1 ? "three-plus-one" : `fallback-${index}`,
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

  const progression = findBackgroundProgression(background.id) ?? findBackgroundProgression(background.name);
  return progression?.skillProficiencies ?? [];
}

export function deriveOriginFeatOptions(background: CompendiumBackgroundEntry | null, feats: FeatEntry[]) {
  if (!background) {
    return [];
  }

  const progression = findBackgroundProgression(background.id) ?? findBackgroundProgression(background.name);
  const featIds = progression ? [progression.originFeatId] : [];

  const matched = featIds
    .map((entry) => feats.find((feat) => feat.id === entry) ?? feats.find((feat) => normalizeKey(feat.name) === normalizeKey(entry)))
    .filter((entry): entry is FeatEntry => Boolean(entry));

  return matched;
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

  void skillEntries;
  void actor;
  return { count: 0, options: [] };
}

const ORIGIN_FEAT_NAMES = new Set([
  "alert",
  "crafter",
  "healer",
  "lucky",
  "magic initiate",
  "magic initiate (cleric)",
  "magic initiate (druid)",
  "magic initiate (wizard)",
  "musician",
  "savage attacker",
  "skilled",
  "tavern brawler",
  "tough"
]);

export function isOriginFeatEntry(feat: FeatEntry): boolean {
  const normCategory = normalizeKey(feat.category || "");
  const normName = normalizeKey(feat.name);
  if (normCategory.includes("origin") || normCategory === "o") return true;
  if (ORIGIN_FEAT_NAMES.has(normName) || ORIGIN_FEAT_NAMES.has(feat.name.toLowerCase())) return true;
  return false;
}

export function featMeetsProgressionPrerequisites(feat: FeatEntry, actor: ActorSheet, characterLevel = totalLevel(actor)): boolean {
  return (
    featProgressionIdMeetsPrerequisites(feat.id, actor, characterLevel) &&
    featProgressionIdMeetsPrerequisites(feat.name, actor, characterLevel)
  );
}

export function featProgressionIdMeetsPrerequisites(featNameOrId: string, actor: ActorSheet, characterLevel = totalLevel(actor)): boolean {
  const definition = findFeatProgression(featNameOrId);
  const prerequisites = definition?.prerequisites;
  if (!prerequisites) return true;
  if (prerequisites.minLevel && characterLevel < prerequisites.minLevel) return false;
  if (
    prerequisites.abilities &&
    Object.entries(prerequisites.abilities).some(([ability, minimum]) => actor.abilities[ability as AbilityKey] < (minimum ?? 0))
  ) {
    return false;
  }
  if (
    prerequisites.armorProficiencies?.some(
      (entry) => !actor.armorProficiencies.some((owned) => normalizeKey(owned) === normalizeKey(entry))
    )
  ) {
    return false;
  }
  if (
    prerequisites.weaponProficiencies?.some(
      (entry) => !actor.weaponProficiencies.some((owned) => normalizeKey(owned) === normalizeKey(entry))
    )
  ) {
    return false;
  }
  if (prerequisites.spellcasting) {
    const hasSpellcasting = actor.classes.some((entry) => {
      const classDefinition = findClassProgression(entry.compendiumId) ?? findClassProgression(entry.name);
      return classDefinition?.multiclassing.casterType !== "none";
    });
    if (!hasSpellcasting) return false;
  }
  return true;
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

  const progression = findSpeciesProgression(species.id) ?? findSpeciesProgression(species.name);
  const rule = progression?.skillChoices;
  if (!rule) return { count: 0, options: [] };
  const sourceOptions = rule.options === "all" ? skillEntries : mapSkillNamesToEntries(rule.options, skillEntries);
  const options = filterSelectableSkillEntries(sourceOptions, actor);

  return {
    count: Math.min(rule.choose, options.length),
    options
  };
}

export function deriveSpeciesSkillProficiencies(species: CompendiumSpeciesEntry | null) {
  if (!species) {
    return [];
  }

  const progression = findSpeciesProgression(species.id) ?? findSpeciesProgression(species.name);
  return progression?.skillProficiencies ?? [];
}

export function deriveSpeciesOriginFeatOptions(species: CompendiumSpeciesEntry | null, feats: FeatEntry[]) {
  if (!species) {
    return [];
  }

  const progDef = findSpeciesProgression(species.id) ?? findSpeciesProgression(species.name);
  const featChoice = progDef?.choices?.find((choice) => choice.source === "species" && choice.id.includes("feat"));

  if (featChoice) {
    return featChoice.options
      .map((option) => feats.find((feat) => feat.id === option.id || normalizeKey(feat.name) === normalizeKey(option.name)))
      .filter((entry): entry is FeatEntry => Boolean(entry));
  }
  return [];
}

export function deriveSpeciesChoiceGroups(species: CompendiumSpeciesEntry | null): GuidedSpeciesChoiceGroup[] {
  if (!species) {
    return [];
  }
  const progDef = findSpeciesProgression(species.id) ?? findSpeciesProgression(species.name);
  if (!progDef || !progDef.choices) {
    return [];
  }
  return progDef.choices
    .filter((c) => !c.id.includes("origin-feat") && !c.id.includes("skill"))
    .map((c) => ({
      id: c.id,
      label: c.title,
      hint: `Choose ${c.choose}`,
      options: c.options.map((opt) => ({
        id: opt.id,
        label: opt.name,
        description: species.entries || species.description,
        featureName: opt.grants?.features?.[0] ?? opt.name,
        spellNames: opt.grants?.spellOptions ?? [],
        alwaysPreparedSpellNames: opt.grants?.alwaysPreparedSpells ?? [],
        speedOverride: opt.grants?.passiveBonuses?.find((b) => b.target === "speed")?.bonus
          ? progDef.speed + (opt.grants.passiveBonuses.find((b) => b.target === "speed")?.bonus ?? 0)
          : undefined,
        visionRangeOverride: opt.grants?.visionRange
      }))
    }));
}

export function deriveBackgroundEquipmentGroups(background: CompendiumBackgroundEntry | null): GuidedEquipmentGroup[] {
  if (!background) {
    return [];
  }

  const progression = findBackgroundProgression(background.id) ?? findBackgroundProgression(background.name);
  return (progression?.equipmentChoices ?? []).map((group) => ({
    id: `background:${background.id}:${group.id}`,
    label: group.label,
    source: "background",
    choose: 1,
    options: group.options.map((option) => ({
      id: option.id,
      label: option.label,
      items: option.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        notes: "",
        equipped: false,
        type: item.currency ? "loot" : "gear",
        currency: item.currency
      }))
    }))
  }));
}

export function deriveClassEquipmentGroups(classEntry: ClassEntry | null): GuidedEquipmentGroup[] {
  if (!classEntry) {
    return [];
  }

  const progression = findClassProgression(classEntry.id) ?? findClassProgression(classEntry.name);
  return (progression?.equipmentChoices ?? []).map((group) => ({
    id: `class:${classEntry.id}:${group.id}`,
    label: group.label,
    source: "class",
    choose: 1,
    options: group.options.map((option) => ({
      id: option.id,
      label: option.label,
      items: option.items.map((item) => ({
        itemId: item.referenceId,
        name: item.name,
        quantity: item.quantity,
        notes: "",
        equipped: false,
        type: item.currency ? "loot" : "gear",
        currency: item.currency
      }))
    }))
  }));
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

  const rule = (findClassProgression(classEntry.name) ?? findClassProgression(classEntry.id))?.startingSkillChoices;

  if (!rule) {
    return {
      count: 0,
      options: []
    };
  }

  const options = filterSelectableSkillEntries(mapSkillNamesToEntries(rule.options, skillEntries), actor);

  return {
    count: Math.min(rule.choose, options.length),
    options
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

function _normalizeBackgroundAbilityGrants(grants: CompendiumBackgroundEntry["abilityChoices"]): GuidedAbilityChoiceGrant[] {
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
  return grants.flatMap((grant) => Array.from({ length: grant.count }, () => `${grant.amount >= 0 ? "+" : ""}${grant.amount}`)).join(" / ");
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
  void classes;
  const progressionFeatureNames = actor.classes.flatMap((actorClass) => {
    const definition = findClassProgression(actorClass.compendiumId) ?? findClassProgression(actorClass.name);
    if (!definition) return [];
    const features: string[] = [];
    for (let level = 1; level <= actorClass.level; level += 1) {
      features.push(...(definition.levels[level]?.features ?? []));
    }
    const subclassId =
      subclassOverrides?.[actorClass.id] ??
      actorClass.subclassId ??
      actor.build?.classes.find((entry) => entry.id === actorClass.id)?.subclassId;
    const subclass = definition.subclasses.find(
      (entry) => entry.id === subclassId || normalizeKey(entry.name) === normalizeKey(subclassId ?? "")
    );
    if (subclass) {
      for (let level = 1; level <= actorClass.level; level += 1) {
        features.push(...(subclass.levels[level]?.features ?? []));
      }
    }
    return features;
  });

  const suppressedNames = new Set(
    (actor.build?.overrides ?? [])
      .filter((override) => override.operation !== "add" && override.targetEffectId)
      .flatMap((override) =>
        (actor.build?.awards ?? []).flatMap((award) =>
          award.effects.flatMap((effect) =>
            effect.id === override.targetEffectId && effect.kind === "feature" ? [normalizeKey(effect.ref.split("|")[0] ?? effect.ref)] : []
          )
        )
      )
  );
  return mergeTextValues(actor.features, progressionFeatureNames).filter((feature) => !suppressedNames.has(normalizeKey(feature)));
}

export function deriveActorSpellCollections(actor: ActorSheet, compendium: CampaignSnapshot["compendium"], spellSlots: SpellSlotTrack[]) {
  const spells = compendium.spells;
  const grantedSpells = deriveGrantedSpellState(actor, compendium);
  const maxPreparedLevel = Math.max(0, ...spellSlots.filter((entry) => entry.total > 0).map((entry) => entry.level));
  const preparedFromClassList = spells
    .filter((entry) => {
      if (entry.level === "cantrip" || typeof entry.level !== "number" || entry.level > maxPreparedLevel) {
        return false;
      }

      return actor.classes.some((actorClass) => {
        const definition = findClassProgression(actorClass.compendiumId) ?? findClassProgression(actorClass.name);
        if (!definition?.spellListId) return false;
        const spellListId = definition.spellListId;
        const spellcastingConfigs = Object.values(definition.levels).map((level) => level.spellcasting);
        if (
          !spellcastingConfigs.some((config) => config?.preparedSpellsFormula) ||
          spellcastingConfigs.some((config) => config?.spellbookAdditions)
        )
          return false;
        return (
          spellMatchesSingleClassFilter(entry, spellListId) ||
          entry.classReferences.some((reference) => normalizeKey(reference.className) === normalizeKey(spellListId))
        );
      });
    })
    .map((entry) => entry.name);

  const all = mergeTextValues(
    [],
    [
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
    ]
  );

  const preparable = mergeTextValues(
    [],
    [...actor.spells, ...grantedSpells.known, ...actor.spellState.spellbook, ...grantedSpells.spellbook, ...preparedFromClassList]
  );

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
  void compendium;
  const granted = {
    known: [] as string[],
    spellbook: [] as string[],
    alwaysPrepared: [] as string[],
    atWill: [] as string[],
    perShortRest: [] as string[],
    perLongRest: [] as string[]
  };
  resolveProgressionEffects(actor.build?.awards ?? [], actor.build?.overrides ?? []).forEach((effect) => {
    if (effect.kind !== "spell") return;
    const name = parseCompendiumRef(effect.ref)?.name ?? effect.ref;
    const bucket = effect.bucket === "prepared" ? "known" : effect.bucket;
    granted[bucket] = mergeTextValues(granted[bucket], [name]);
  });

  return granted;
}

export function validateGuideSelections(params: {
  actor: ActorSheet;
  spec: GuidedChoiceSpec;
  setup: GuidedSetupState;
  mode: GuidedFlowMode;
  targetClass: ClassEntry;
  currentSubclassId: string;
  speciesChoiceGroups?: GuidedSpeciesChoiceGroup[];
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

  if ((params.speciesChoiceGroups ?? []).some((group) => !params.setup.speciesChoiceIds[group.id]?.trim())) {
    return "Choose every required species option.";
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

  const targetDefinition = findClassProgression(params.targetClass.name) ?? findClassProgression(params.targetClass.id);
  if (!targetDefinition) return `Rules metadata is unavailable for ${params.targetClass.name}.`;
  const isNewMulticlass =
    params.mode === "levelup" &&
    params.actor.classes.length > 0 &&
    !params.actor.classes.some(
      (entry) => entry.compendiumId === params.targetClass.id || normalizeKey(entry.name) === normalizeKey(params.targetClass.name)
    );
  if (isNewMulticlass) {
    const definitions = [
      ...params.actor.classes.map((entry) => findClassProgression(entry.name) ?? findClassProgression(entry.compendiumId)),
      targetDefinition
    ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    const failed = definitions.find((definition) => {
      const requirements = Object.entries(definition.multiclassing.prerequisites ?? {}) as Array<[AbilityKey, number]>;
      if (requirements.length === 0) return false;
      const checks = requirements.map(([ability, minimum]) => params.actor.abilities[ability] >= minimum);
      return definition.multiclassing.prerequisiteMode === "any" ? !checks.some(Boolean) : !checks.every(Boolean);
    });
    if (failed) return `The actor does not meet the multiclass prerequisites for ${failed.name}.`;
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

  if (params.setup.asiMode === "feat" && params.setup.asiFeatId) {
    const awardedCharacterLevel = params.mode === "levelup" ? totalLevel(params.actor) + 1 : Math.max(1, totalLevel(params.actor));
    if (!featProgressionIdMeetsPrerequisites(params.setup.asiFeatId, params.actor, awardedCharacterLevel)) {
      return "The actor does not meet the prerequisites for the selected feat.";
    }
  }

  for (const group of params.spec.classChoiceGroups) {
    if (group.parentOption && !(params.setup.classChoiceIds[group.parentOption.groupId] ?? []).includes(group.parentOption.optionId)) {
      continue;
    }
    const selected = params.setup.classChoiceIds[group.id] ?? [];
    if (new Set(selected).size !== group.count || selected.length !== group.count) {
      return `Choose exactly ${group.count} option${group.count === 1 ? "" : "s"} for ${group.label}.`;
    }
    for (const optionId of selected) {
      const option = group.options.find((entry) => entry.id === optionId);
      if (!option) return `A selected option for ${group.label} is no longer available.`;
      if (option.disabledReason) return option.disabledReason;
    }
  }

  for (const [featId, groups] of Object.entries(params.spec.featChoiceGroups)) {
    if (
      ![...params.setup.classFeatIds, params.setup.asiFeatId, params.setup.originFeatId, params.setup.speciesOriginFeatId].includes(featId)
    )
      continue;
    for (const group of groups) {
      const selected = params.setup.featChoiceMap[featId]?.[group.id] ?? [];
      if (new Set(selected).size !== group.count || selected.length !== group.count) {
        return `Choose exactly ${group.count} option${group.count === 1 ? "" : "s"} for ${group.label}.`;
      }
    }
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

  if (params.setup.preparedSpellIds.length > params.spec.preparedSpellCount) {
    return `Prepare no more than ${params.spec.preparedSpellCount} spells.`;
  }

  if (!hasEnoughGuideSelections(params.setup.expertiseSkillChoices, params.spec.expertiseCount)) {
    return "Choose every required expertise skill.";
  }

  if (params.spec.abilityImprovementCount > 0 && params.setup.asiMode === "feat" && !params.setup.asiFeatId.trim()) {
    return "Choose a feat or switch the guide to ability score increases.";
  }

  if (params.spec.abilityImprovementCount > 0 && params.setup.asiMode === "ability") {
    const requiredAbilityCount = params.setup.asiAbilityMode === "+2" ? 1 : 2;
    if (params.setup.asiAbilityChoices.filter(Boolean).length < requiredAbilityCount) {
      return `Choose ${requiredAbilityCount === 1 ? "1 ability score to increase by +2" : "2 ability scores to increase by +1"}.`;
    }
  }

  if (params.spec.weaponMasteryCount > 0 && params.setup.weaponMasteryChoices.filter(Boolean).length < params.spec.weaponMasteryCount) {
    return "Choose every required weapon mastery.";
  }

  return null;
}

export function hasEnoughGuideSelections(values: string[], requiredCount: number) {
  if (requiredCount <= 0) {
    return true;
  }

  const selected = values.slice(0, requiredCount).filter((entry) => entry.trim().length > 0);
  return selected.length === requiredCount && new Set(selected).size === selected.length;
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
  selectedClassChoiceIds?: Record<string, string[]>;
  selectedSpellIds?: string[];
}): GuidedChoiceSpec {
  const actorClassForGuide =
    params.targetActorClassId && params.targetActorClassId !== NEW_GUIDED_CLASS_ID
      ? (params.actor.classes.find((entry) => entry.id === params.targetActorClassId) ?? null)
      : null;
  const classEntry =
    (actorClassForGuide ? (findCompendiumClass(actorClassForGuide, params.classes) ?? null) : null) ??
    params.classes.find((entry) => entry.id === params.targetClassId) ??
    null;

  const standardWeaponMasteries = findProgressionChoiceDomain("weapon-masteries")?.options.map((entry) => entry.name) ?? [];
  const standardLanguages = findProgressionChoiceDomain("standard-languages")?.options.map((entry) => entry.name) ?? [];
  const speciesDefinition = actorSpeciesProgression(params.actor);
  const standardSizes = speciesDefinition?.sizes ?? [];
  const languageCount = speciesDefinition?.bonusLanguageCount ?? 0;

  if (!classEntry) {
    return {
      subclassOptions: [],
      classFeatOptions: [],
      classFeatCount: 0,
      optionalFeatureOptions: [],
      optionalFeatureCount: 0,
      classChoiceGroups: [],
      featChoiceGroups: {},
      cantripOptions: [],
      cantripCount: 0,
      knownSpellOptions: [],
      knownSpellCount: 0,
      spellbookOptions: [],
      spellbookCount: 0,
      preparedSpellOptions: [],
      preparedSpellCount: 0,
      languageOptions: standardLanguages,
      languageCount,
      sizeOptions: standardSizes,
      expertiseSkillOptions: [],
      expertiseCount: 0,
      weaponMasteryOptions: standardWeaponMasteries,
      weaponMasteryCount: 0,
      abilityImprovementCount: 0,
      hitDieFaces: 8,
      conModifier: 0,
      averageHpGain: 5
    };
  }

  const currentActorClass =
    params.mode === "levelup" && params.targetActorClassId && params.targetActorClassId !== NEW_GUIDED_CLASS_ID
      ? (params.actor.classes.find((entry) => entry.id === params.targetActorClassId) ?? null)
      : null;
  const currentLevel = params.mode === "setup" ? 0 : (currentActorClass?.level ?? 0);
  const targetLevel = Math.max(1, currentLevel + 1);
  const currentSubclassId = currentActorClass
    ? (currentActorClass.subclassId ?? params.actor.build?.classes.find((entry) => entry.id === currentActorClass.id)?.subclassId ?? "")
    : "";
  const activeSubclassId = params.targetSubclassId || currentSubclassId;
  const classDef = findClassProgression(classEntry.name) || findClassProgression(classEntry.id);
  const configAt = (level: number) => classDef?.levels[level];
  const latestNumber = (level: number, read: (config: NonNullable<ReturnType<typeof configAt>>) => number | undefined) => {
    for (let candidate = level; candidate >= 1; candidate -= 1) {
      const config = configAt(candidate);
      const value = config ? read(config) : undefined;
      if (typeof value === "number") return value;
    }
    return 0;
  };
  const weaponMasteryCount = Math.max(
    0,
    latestNumber(targetLevel, (config) => config.weaponMasteriesCount) - latestNumber(currentLevel, (config) => config.weaponMasteriesCount)
  );
  const cantripCount = Math.max(
    0,
    latestNumber(targetLevel, (config) => config.spellcasting?.cantripsKnown) -
      latestNumber(currentLevel, (config) => config.spellcasting?.cantripsKnown)
  );
  const knownSpellCount = Math.max(
    0,
    latestNumber(targetLevel, (config) => config.spellcasting?.spellsKnown) -
      latestNumber(currentLevel, (config) => config.spellcasting?.spellsKnown)
  );
  const spellbookCount = configAt(targetLevel)?.spellcasting?.spellbookAdditions ?? 0;
  const fightingStyleCount = 0;
  const expertiseCount = configAt(targetLevel)?.expertiseChoices ?? 0;
  const optionalFeatureCount = 0;
  const abilityImprovementCount = configAt(targetLevel)?.asiChoice ? 1 : 0;
  const existingFeatNames = new Set(params.actor.feats.map((entry) => normalizeKey(entry)));
  const targetCharacterLevel = params.mode === "levelup" ? totalLevel(params.actor) + 1 : totalLevel(params.actor);
  const classFeatOptions = params.feats.filter(
    (entry) =>
      normalizeKey(entry.category).includes("fs") &&
      !existingFeatNames.has(normalizeKey(entry.name)) &&
      featMeetsProgressionPrerequisites(entry, params.actor, targetCharacterLevel)
  );
  const optionalFeatureOptions: CompendiumOptionalFeatureEntry[] = [];
  const maxSpellLevel = deriveMaximumSpellLevelForProgression(classDef, targetLevel);
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
  const spellListId = classDef?.spellListId;
  const classSpellOptions = spellListId ? params.spells.filter((entry) => spellMatchesSingleClassFilter(entry, spellListId)) : [];
  const cantripOptions = classSpellOptions.filter(
    (entry) => entry.level === "cantrip" && !existingSpellNames.has(normalizeKey(entry.name))
  );
  const leveledSpellOptions = classSpellOptions.filter(
    (entry) => typeof entry.level === "number" && entry.level <= maxSpellLevel && !existingSpellNames.has(normalizeKey(entry.name))
  );

  const isPreparedCaster = Object.values(classDef?.levels ?? {}).some((level) => level.spellcasting?.preparedSpellsFormula);
  const preparedSpellCount = isPreparedCaster
    ? derivePreparedSpellLimit(
        {
          ...params.actor,
          classes: [
            {
              id: classEntry.id,
              compendiumId: classEntry.id,
              name: classEntry.name,
              source: classEntry.source,
              level: targetLevel,
              hitDieFaces: classEntry.hitDieFaces || 8,
              usedHitDice: 0,
              subclassId: activeSubclassId,
              spellcastingAbility: classEntry.spellcastingAbility
            }
          ]
        },
        [classEntry]
      )
    : 0;
  const preparedSpellOptions = classSpellOptions.filter((entry) => typeof entry.level === "number" && entry.level <= maxSpellLevel);

  const hitDieFaces = classEntry.hitDieFaces || 8;
  const conModifier = abilityModifierTotal(params.actor, "con");
  const averageHpGain = Math.max(1, Math.floor(hitDieFaces / 2) + 1 + conModifier);

  const classChoiceGroups = deriveClassChoiceGroups(classEntry, currentLevel, targetLevel, {
    ...params,
    activeSubclassId,
    characterLevel: targetCharacterLevel
  });
  const featChoiceGroups: Record<string, CompendiumChoiceGroup[]> = {};
  params.feats.forEach((feat) => {
    featChoiceGroups[feat.id] = deriveFeatChoiceGroups(feat, params.spells, params.actor);
  });

  const extraSubclasses: ClassEntry["subclasses"] = findSubclassesForClass(classEntry.name).map((sub) => ({
    id: sub.id,
    name: sub.name,
    shortName: sub.name,
    source: sub.source,
    className: classEntry.name,
    classSource: classEntry.source,
    description: "",
    features: []
  }));
  const combinedSubclasses = [...classEntry.subclasses];
  extraSubclasses.forEach((sub) => {
    if (!combinedSubclasses.some((existing) => existing.id === sub.id || normalizeKey(existing.name) === normalizeKey(sub.name))) {
      combinedSubclasses.push(sub);
    }
  });

  return {
    subclassOptions: configAt(targetLevel)?.subclassChoice ? combinedSubclasses : [],
    classFeatOptions,
    classFeatCount: fightingStyleCount,
    optionalFeatureOptions,
    optionalFeatureCount,
    classChoiceGroups,
    featChoiceGroups,
    cantripOptions,
    cantripCount,
    knownSpellOptions: leveledSpellOptions,
    knownSpellCount,
    spellbookOptions: leveledSpellOptions,
    spellbookCount,
    preparedSpellOptions,
    preparedSpellCount,
    languageOptions: standardLanguages,
    languageCount,
    sizeOptions: standardSizes,
    expertiseSkillOptions: params.actor.skills.filter((entry) => entry.proficient && !entry.expertise),
    expertiseCount,
    weaponMasteryOptions: standardWeaponMasteries,
    weaponMasteryCount,
    abilityImprovementCount,
    hitDieFaces,
    conModifier,
    averageHpGain
  };
}

export function deriveClassChoiceGroups(
  classEntry: ClassEntry,
  currentLevel: number,
  targetLevel: number,
  params: {
    spells: SpellEntry[];
    optionalFeatures: CompendiumOptionalFeatureEntry[];
    actor: ActorSheet;
    activeSubclassId?: string;
    characterLevel?: number;
    selectedClassChoiceIds?: Record<string, string[]>;
    selectedSpellIds?: string[];
  }
): CompendiumChoiceGroup[] {
  const groups: CompendiumChoiceGroup[] = [];
  const referencedEntries = [
    ...params.spells,
    ...params.optionalFeatures,
    ...classEntry.features,
    ...classEntry.subclasses.flatMap((subclass) => subclass.features)
  ];

  const classDef = findClassProgression(classEntry.name) || findClassProgression(classEntry.id);
  if (classDef) {
    const selectedOptionIds = new Set(Object.values(params.selectedClassChoiceIds ?? {}).flat());
    const selectedFeatureNames = [
      ...Object.values(classDef.levels).flatMap((level) =>
        (level.choices ?? []).flatMap((group) =>
          group.options.filter((option) => selectedOptionIds.has(option.id)).flatMap((option) => option.grants?.features ?? [])
        )
      ),
      ...classDef.subclasses.flatMap((subclass) =>
        Object.values(subclass.levels).flatMap((level) =>
          (level.choices ?? []).flatMap((group) =>
            group.options.filter((option) => selectedOptionIds.has(option.id)).flatMap((option) => option.grants?.features ?? [])
          )
        )
      )
    ];
    for (let lvl = currentLevel + 1; lvl <= targetLevel; lvl++) {
      const rawGroups = evaluateClassChoicesForLevel(classDef, lvl, params.activeSubclassId);
      rawGroups
        .filter((g) => g.cadence === undefined || g.cadence === "onLevelUp" || g.cadence === "permanent")
        .forEach((g) => {
          if (!groups.some((existing) => existing.id === g.id)) {
            const eligibleOptions = g.options.filter((option) =>
              progressionChoiceOptionIsEligible(option, {
                actor: params.actor,
                classDefinition: classDef,
                classLevel: lvl,
                characterLevel: params.characterLevel ?? totalLevel(params.actor),
                subclassId: params.activeSubclassId,
                selectedFeatureNames,
                spells: params.spells,
                selectedSpellIds: params.selectedSpellIds
              })
            );
            const subclassDefinition = classDef.subclasses.find(
              (entry) => entry.id === params.activeSubclassId || normalizeKey(entry.name) === normalizeKey(params.activeSubclassId ?? "")
            );
            const groupSource = subclassDefinition?.levels[lvl]?.choices?.some((choice) => choice.id === g.id)
              ? subclassDefinition.source
              : classDef.source;
            const groupReferenceId = g.referenceId ?? createCompendiumRef(g.title, groupSource);
            const referencedGroupEntry = referencedEntries.find((entry) => compendiumRefMatches(groupReferenceId, entry));
            const mappedGroup: CompendiumChoiceGroup = {
              id: g.id,
              label: g.title,
              hint: `Level ${lvl} choice`,
              count: g.choose,
              level: lvl,
              options: eligibleOptions.map((opt) => {
                const referencedEntry = opt.referenceId
                  ? referencedEntries.find((entry) => compendiumRefMatches(opt.referenceId!, entry))
                  : referencedGroupEntry;
                return {
                  id: opt.id,
                  label: referencedEntry?.name ?? opt.name,
                  compendiumRef: opt.referenceId ?? groupReferenceId,
                  disabledReason: !referencedEntry ? `Unavailable compendium reference: ${opt.referenceId ?? groupReferenceId}` : undefined,
                  description: referencedEntry && "description" in referencedEntry ? referencedEntry.description : "",
                  grants: {
                    features: opt.grants?.features || [],
                    skills: opt.grants?.skills || [],
                    expertise: opt.grants?.expertise || [],
                    tools: opt.grants?.toolProficiencies || [],
                    languages: opt.grants?.languages || [],
                    weaponProficiencies: opt.grants?.weaponProficiencies || [],
                    armorProficiencies: opt.grants?.armorProficiencies || [],
                    savingThrows: opt.grants?.savingThrows || [],
                    spells: opt.grants?.spellsCount || opt.grants?.cantripsCount ? [] : opt.grants?.spellOptions || [],
                    alwaysPreparedSpells: opt.grants?.alwaysPreparedSpells || [],
                    attacks: [],
                    passiveBonuses: opt.grants?.passiveBonuses ?? []
                  }
                };
              })
            };
            groups.push(mappedGroup);

            mappedGroup.options.forEach((mappedOption, optionIndex) => {
              const rawOption = eligibleOptions[optionIndex];
              const spellChoices = [
                {
                  suffix: "cantrips",
                  label: `${mappedOption.label}: choose cantrips`,
                  count: rawOption.grants?.cantripsCount ?? 0,
                  candidates: rawOption.grants?.cantripOptions,
                  cantrip: true
                },
                {
                  suffix: "spells",
                  label: `${mappedOption.label}: choose spells`,
                  count: rawOption.grants?.spellsCount ?? 0,
                  candidates: rawOption.grants?.spellOptions,
                  cantrip: false
                }
              ];

              spellChoices.forEach((choice) => {
                if (choice.count <= 0) return;
                const availableSpells = params.spells.filter((spell) => {
                  const correctLevel = choice.cantrip ? spell.level === "cantrip" : typeof spell.level === "number";
                  if (!correctLevel) return false;
                  if (
                    !choice.cantrip &&
                    typeof spell.level === "number" &&
                    spell.level > deriveMaximumSpellLevelForProgression(classDef, lvl)
                  ) {
                    return false;
                  }
                  if (!choice.candidates?.length) {
                    return spellMatchesSingleClassFilter(spell, rawOption.grants?.spellList ?? classDef.spellListId ?? "");
                  }
                  return choice.candidates.some(
                    (candidate) => normalizeKey(candidate) === normalizeKey(spell.name) || compendiumRefMatches(candidate, spell)
                  );
                });
                groups.push({
                  id: `${g.id}:${rawOption.id}:${choice.suffix}`,
                  label: choice.label,
                  hint: `Required by ${mappedOption.label}`,
                  count: choice.count,
                  level: lvl,
                  parentOption: { groupId: g.id, optionId: rawOption.id },
                  options: availableSpells.map((spell) => ({
                    id: spell.id,
                    label: spell.name,
                    compendiumRef: createCompendiumRef(spell.name, spell.source),
                    description: spell.fullDescription || spell.description,
                    grants: { spells: [spell.name] }
                  }))
                });
              });
            });
          }
        });
    }
  }

  return groups;
}

export function deriveFeatChoiceGroups(feat: FeatEntry, spells: SpellEntry[], actor: ActorSheet): CompendiumChoiceGroup[] {
  const definition = findFeatProgression(feat.name) ?? findFeatProgression(feat.id);
  if (!definition) return [];
  const highestClassLevel = Math.max(0, ...actor.classes.map((entry) => entry.level));
  const activeClassDefinition = actor.classes
    .map((entry) => findClassProgression(entry.compendiumId) ?? findClassProgression(entry.name))
    .find((entry) => entry !== null);
  const groups: CompendiumChoiceGroup[] = (definition.choices ?? []).map((group) => ({
    id: group.id,
    label: group.title,
    count: group.choose,
    options: [
      ...group.options,
      ...(group.optionSetIds ?? (group.optionSetId ? [group.optionSetId] : [])).flatMap(
        (domainId) => findProgressionChoiceDomain(domainId)?.options ?? []
      )
    ]
      .filter((option) =>
        progressionChoiceOptionIsEligible(option, {
          actor,
          classDefinition: activeClassDefinition ?? undefined,
          classLevel: highestClassLevel,
          characterLevel: totalLevel(actor),
          spells
        })
      )
      .map((option) => ({
        id: option.id,
        label: option.name,
        description: "",
        grants: {
          features: option.grants?.features ?? [],
          spells: option.grants?.spellOptions ?? [],
          alwaysPreparedSpells: option.grants?.alwaysPreparedSpells ?? [],
          skills: option.grants?.skills ?? [],
          expertise: option.grants?.expertise ?? [],
          tools: option.grants?.toolProficiencies ?? [],
          languages: option.grants?.languages ?? [],
          armorProficiencies: option.grants?.armorProficiencies ?? [],
          weaponProficiencies: option.grants?.weaponProficiencies ?? [],
          passiveBonuses: option.grants?.passiveBonuses ?? [],
          savingThrows: option.grants?.savingThrows ?? [],
          abilities: option.grants?.abilities ?? {}
        }
      }))
  }));

  if (definition.abilityIncrease) {
    groups.push({
      id: `${definition.id}:ability-increase`,
      label: "Ability Score Increase",
      hint: `Increase ${definition.abilityIncrease.choose} listed ability score${definition.abilityIncrease.choose === 1 ? "" : "s"}`,
      count: definition.abilityIncrease.choose,
      options: definition.abilityIncrease.options.map((ability) => ({
        id: ability,
        label: ability.toUpperCase(),
        grants: { abilities: { [ability]: definition.abilityIncrease?.amount ?? 1 } }
      }))
    });
  }

  const spellList = definition.grants?.spellList;
  if (spellList) {
    const listSpells = spells.filter((spell) => spellMatchesSingleClassFilter(spell, spellList));
    const spellGroups = [
      { suffix: "cantrips", label: "Cantrips", count: definition.grants?.cantripsCount ?? 0, cantrip: true },
      { suffix: "spells", label: "1st-Level Spell", count: definition.grants?.spellsCount ?? 0, cantrip: false }
    ];
    spellGroups.forEach((spellGroup) => {
      if (spellGroup.count <= 0) return;
      groups.push({
        id: `${definition.id}:${spellGroup.suffix}`,
        label: `${feat.name}: ${spellGroup.label}`,
        count: spellGroup.count,
        options: listSpells
          .filter((spell) => (spellGroup.cantrip ? spell.level === "cantrip" : spell.level === 1))
          .map((spell) => ({
            id: spell.id,
            label: spell.name,
            compendiumRef: createCompendiumRef(spell.name, spell.source),
            description: spell.fullDescription || spell.description,
            grants: { spells: [spell.name] }
          }))
      });
    });
  }

  return groups;
}

export interface CarryingCapacityInfo {
  carryingCapacity: number;
  pushDragLift: number;
  encumberedThreshold: number;
  heavilyEncumberedThreshold: number;
  totalCarriedWeight: number;
  itemWeight: number;
  coinWeight: number;
  encumbranceStatus: "normal" | "encumbered" | "heavily_encumbered" | "overburdened";
}

export function deriveCarryingCapacity(actor: ActorSheet): CarryingCapacityInfo {
  const strScore = Math.max(1, actor.abilities.str || 10);
  const carryingCapacity = strScore * 15;
  const pushDragLift = strScore * 30;
  const encumberedThreshold = strScore * 5;
  const heavilyEncumberedThreshold = strScore * 10;

  const itemWeight = (actor.inventory ?? []).reduce((sum, item) => {
    const qty = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
    const w = typeof item.weight === "number" && item.weight > 0 ? item.weight : 0;
    return sum + w * qty;
  }, 0);

  const totalCoins =
    (actor.currency.pp || 0) + (actor.currency.gp || 0) + (actor.currency.ep || 0) + (actor.currency.sp || 0) + (actor.currency.cp || 0);
  const coinWeight = Math.round((totalCoins / 50) * 10) / 10;
  const totalCarriedWeight = Math.round((itemWeight + coinWeight) * 10) / 10;

  let encumbranceStatus: CarryingCapacityInfo["encumbranceStatus"] = "normal";
  if (totalCarriedWeight > carryingCapacity) {
    encumbranceStatus = "overburdened";
  } else if (totalCarriedWeight > heavilyEncumberedThreshold) {
    encumbranceStatus = "heavily_encumbered";
  } else if (totalCarriedWeight > encumberedThreshold) {
    encumbranceStatus = "encumbered";
  }

  return {
    carryingCapacity,
    pushDragLift,
    encumberedThreshold,
    heavilyEncumberedThreshold,
    totalCarriedWeight,
    itemWeight,
    coinWeight,
    encumbranceStatus
  };
}

export function deriveAttunementCount(actor: ActorSheet) {
  const attunedItems = (actor.inventory ?? []).filter((item) => item.attuned);
  return {
    count: attunedItems.length,
    max: 3,
    items: attunedItems
  };
}

export function deriveScaledSpellDice(spell: SpellEntry, castLevel: number): string {
  if (typeof spell.level !== "number" || castLevel <= spell.level || !spell.damageNotation) {
    return spell.damageNotation || "";
  }

  const levelDiff = castLevel - spell.level;
  if (levelDiff <= 0) {
    return spell.damageNotation;
  }

  const higherDesc = (spell.higherLevelDescription || "").toLowerCase();
  const dieMatch = higherDesc.match(/(\d+)d(\d+)/i) || spell.damageNotation.match(/(\d+)d(\d+)/i);
  if (dieMatch) {
    const dicePerLevel = Number(dieMatch[1]) || 1;
    const dieFaces = dieMatch[2];
    const baseMatch = spell.damageNotation.match(/^(\d+)d(\d+)(.*)$/);
    if (baseMatch && baseMatch[2] === dieFaces) {
      const baseDiceCount = Number(baseMatch[1]);
      const extraDice = dicePerLevel * levelDiff;
      const totalDice = baseDiceCount + extraDice;
      return `${totalDice}d${dieFaces}${baseMatch[3] ?? ""}`;
    }
  }

  return spell.damageNotation;
}

export interface ActionEconomyItem {
  id: string;
  name: string;
  kind: "attack" | "spell" | "feature" | "mastery" | "standard";
  actionCost: "action" | "bonus" | "reaction" | "mastery" | "free";
  subtitle?: string;
  detail?: string;
  rollPayload?: { type: "attack" | "damage" | "check"; notation?: string; bonus?: number; label: string };
}

export function deriveActionEconomyGroups(
  actor: ActorSheet,
  compendium: { spells: SpellEntry[] }
): Record<"action" | "bonus" | "reaction" | "mastery" | "free", ActionEconomyItem[]> {
  const groups: Record<"action" | "bonus" | "reaction" | "mastery" | "free", ActionEconomyItem[]> = {
    action: [],
    bonus: [],
    reaction: [],
    mastery: [],
    free: []
  };

  actor.attacks.forEach((attack) => {
    groups.action.push({
      id: `attack-${attack.id}`,
      name: attack.name || "Attack",
      kind: "attack",
      actionCost: "action",
      subtitle: `${formatModifier(attack.attackBonus)} to hit • ${attack.damage} ${attack.damageType}`,
      detail: attack.notes,
      rollPayload: { type: "attack", bonus: attack.attackBonus, label: `${attack.name} attack` }
    });
  });

  actor.features
    .filter((f) => f.startsWith("Weapon Mastery: "))
    .forEach((feat, index) => {
      const masteryName = feat.replace("Weapon Mastery: ", "");
      groups.mastery.push({
        id: `mastery-${index}`,
        name: masteryName,
        kind: "mastery",
        actionCost: "mastery",
        subtitle: "Weapon Mastery Property",
        detail: `Applies mastery effect when attacking with ${masteryName}`
      });
    });

  const allActorSpellNames = new Set([
    ...actor.spells,
    ...actor.preparedSpells,
    ...actor.spellState.alwaysPrepared,
    ...actor.spellState.atWill
  ]);
  compendium.spells
    .filter((s) => allActorSpellNames.has(s.name))
    .forEach((spell) => {
      const timeNorm = (spell.castingTimeUnit || "").toLowerCase();
      let cost: "action" | "bonus" | "reaction" | "free" = "action";
      if (timeNorm.includes("bonus")) cost = "bonus";
      else if (timeNorm.includes("reaction")) cost = "reaction";
      else if (timeNorm.includes("action")) cost = "action";
      else cost = "free";

      const timeLabel = spell.castingTimeValue > 1 ? `${spell.castingTimeValue} ${spell.castingTimeUnit}` : spell.castingTimeUnit;

      groups[cost].push({
        id: `spell-${spell.id}`,
        name: spell.name,
        kind: "spell",
        actionCost: cost,
        subtitle: `${typeof spell.level === "number" ? `Level ${spell.level}` : "Cantrip"} • ${spell.school} • ${timeLabel}`,
        detail: spell.damageNotation ? spell.damageNotation : spell.description,
        rollPayload: spell.damageNotation ? { type: "damage", notation: spell.damageNotation, label: `${spell.name} damage` } : undefined
      });
    });

  actor.features
    .filter((f) => !f.startsWith("Weapon Mastery: "))
    .forEach((feature, idx) => {
      const fLower = feature.toLowerCase();
      let cost: "action" | "bonus" | "reaction" | "free" = "free";
      if (/\bbonus action\b/.test(fLower)) cost = "bonus";
      else if (/\breaction\b/.test(fLower)) cost = "reaction";
      else if (/\baction\b/.test(fLower)) cost = "action";

      groups[cost].push({
        id: `feat-${idx}`,
        name: feature.split(/[:\n]/)[0] || feature,
        kind: "feature",
        actionCost: cost,
        subtitle: "Feature / Trait",
        detail: feature
      });
    });

  return groups;
}

export function deriveMaximumSpellLevelForProgression(classDefinition: ReturnType<typeof findClassProgression>, level: number) {
  const slots = classDefinition?.levels[level]?.spellcasting?.slots ?? [];
  for (let index = slots.length - 1; index >= 0; index -= 1) {
    if ((slots[index] ?? 0) > 0) return index + 1;
  }
  return 0;
}

export function deriveSpellSlots(actor: ActorSheet, classes: ClassEntry[]) {
  void classes;
  return evaluateActorSpellSlots(actor);
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
  void classes;
  return evaluateActorPreparedSpellsLimit(actor);
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
  void classes;
  return evaluateActorDerivedResources(actor).map((resource) => ({
    id: `derived:${normalizeKey(resource.name)}`,
    name: resource.name,
    max: resource.max,
    resetOn: resource.resetOn === "shortRest" ? "Short Rest" : "Long Rest",
    restoreAmount: resource.restoreAmount ?? resource.max,
    description: `${resource.name} granted by class progression.`,
    source: "Progression JSON"
  }));
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
      name: existingDerived ? entry.name : (existing?.name ?? entry.name),
      current,
      max,
      resetOn: existingDerived ? entry.resetOn : existing?.resetOn || entry.resetOn,
      restoreAmount: existingDerived
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
  const suppressedNames = new Set(
    (actor.build?.overrides ?? [])
      .filter((override) => override.operation !== "add" && override.targetEffectId)
      .flatMap((override) =>
        (actor.build?.awards ?? []).flatMap((award) =>
          award.effects.flatMap((effect) =>
            effect.id === override.targetEffectId && (effect.kind === "feature" || effect.kind === "feat" || effect.kind === "talent")
              ? [normalizeKey(effect.ref.split("|")[0] ?? effect.ref)]
              : []
          )
        )
      )
  );

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
    if (suppressedNames.has(normalizeKey(entry.name))) return;
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
        if (suppressedNames.has(normalizeKey(entry.name))) return;
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
    if (suppressedNames.has(normalizeKey(featName))) return;
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
    if (suppressedNames.has(normalizeKey(featureName))) return;
    const alreadyIncluded = rows.some((entry) => normalizeKey(entry.title) === normalizeKey(featureName));

    if (alreadyIncluded) {
      return;
    }

    const optionalFeature = findByName(compendium.optionalFeatures, featureName);

    rows.push(
      optionalFeature
        ? createReferenceRow("Optional Feature", optionalFeature, [
            { label: "Prerequisites", value: optionalFeature.prerequisites || "None" }
          ])
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

const IGNORED_FEATURE_HEADINGS = new Set(["creature type", "size", "speed", "languages", "ability scores", "ability score increase"]);

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

      const title = inlineMatch[1].trim();
      if (IGNORED_FEATURE_HEADINGS.has(normalizeKey(title))) {
        return [];
      }

      return [
        {
          id: `${entry.id}:inline:${index}`,
          eyebrow,
          title,
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
    if (!currentTitle || IGNORED_FEATURE_HEADINGS.has(normalizeKey(currentTitle))) {
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

    if (currentTitle) {
      currentBody.push(line);
      return;
    }

    currentTitle = entry.name;
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
  return spellNames.map((name) => findByName(spells, name)?.id ?? "").filter((entry) => entry.length > 0);
}

export function findSpellNamesByIds(spellIds: string[], spells: SpellEntry[]) {
  return spellIds.map((spellId) => spells.find((entry) => entry.id === spellId)?.name ?? "").filter((entry) => entry.length > 0);
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
