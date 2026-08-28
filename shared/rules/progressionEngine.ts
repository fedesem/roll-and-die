import type {
  AbilityKey,
  ActorClassEntry,
  ActorManualOverride,
  ActorSheet,
  ProgressionAward,
  ProgressionAwardChoice,
  ProgressionEffect,
  ResourceEntry,
  SpellEntry,
  SpellSlotTrack
} from "../types.js";
import { createCompendiumRef, parseCompendiumRef } from "./compendiumRefs.js";
import {
  findClassProgression,
  findBackgroundProgression,
  findFeatProgression,
  findProgressionChoiceDomain,
  findSpeciesProgression,
  type ClassProgressionDef,
  type LevelProgressionConfig,
  type ProgressionChoiceGroupDef,
  type ProgressionChoiceOption,
  type ProgressionResourceDef
} from "../data/progression/index.js";

export interface ProgressionChoiceEligibilityContext {
  actor?: ActorSheet;
  classDefinition?: ClassProgressionDef;
  classLevel: number;
  characterLevel: number;
  subclassId?: string;
  selectedFeatureNames?: string[];
  spells?: SpellEntry[];
  selectedSpellIds?: string[];
}

export function progressionChoiceOptionIneligibilityReason(
  option: ProgressionChoiceOption,
  context: ProgressionChoiceEligibilityContext
): string | null {
  const requirements = option.requires;
  if (!requirements) return null;

  if (requirements.level && context.classLevel < requirements.level) {
    return context.classDefinition
      ? `Requires ${context.classDefinition.name} level ${requirements.level}.`
      : `Requires class level ${requirements.level}.`;
  }
  if (requirements.characterLevel && context.characterLevel < requirements.characterLevel) {
    return `Requires character level ${requirements.characterLevel}.`;
  }
  if (requirements.subclassId && normalizeProgressionKey(requirements.subclassId) !== normalizeProgressionKey(context.subclassId ?? "")) {
    return `Requires the ${requirements.subclassId} subclass.`;
  }

  const ownedFeatures = [
    ...(context.actor?.features ?? []),
    ...(context.actor?.feats ?? []),
    ...(context.actor?.talents ?? []),
    ...(context.selectedFeatureNames ?? [])
  ];
  if (requirements.feature && !ownedFeatures.some((entry) => progressionRequirementMatches(entry, requirements.feature!))) {
    return `Requires ${requirements.feature}.`;
  }
  if (requirements.notFeature && ownedFeatures.some((entry) => progressionRequirementMatches(entry, requirements.notFeature!))) {
    return `Unavailable while ${requirements.notFeature} is known.`;
  }
  if (
    context.actor &&
    requirements.minAbility &&
    Object.entries(requirements.minAbility).some(([ability, minimum]) => context.actor!.abilities[ability as AbilityKey] < (minimum ?? 0))
  ) {
    return "Ability score prerequisite not met.";
  }

  if (requirements.knownSpell && context.spells) {
    const knownSpellNames = new Set(
      [
        ...(context.actor?.spells ?? []),
        ...(context.actor?.preparedSpells ?? []),
        ...(context.actor?.spellState.spellbook ?? []),
        ...(context.actor?.spellState.alwaysPrepared ?? []),
        ...(context.actor?.spellState.atWill ?? []),
        ...(context.actor?.spellState.perShortRest ?? []),
        ...(context.actor?.spellState.perLongRest ?? [])
      ].map(normalizeProgressionKey)
    );
    const selectedSpellIds = new Set(context.selectedSpellIds ?? []);
    const hasEligibleSpell = context.spells.some((spell) => {
      if (!knownSpellNames.has(normalizeProgressionKey(spell.name)) && !selectedSpellIds.has(spell.id)) return false;
      if (requirements.knownSpell?.level !== undefined && spell.level !== requirements.knownSpell.level) return false;
      if (requirements.knownSpell?.dealsDamage && !spell.damageNotation.trim()) return false;
      if (requirements.knownSpell?.spellListId && !spellMatchesProgressionList(spell, requirements.knownSpell.spellListId)) {
        return false;
      }
      return true;
    });
    if (!hasEligibleSpell) return "Requires an eligible known spell.";
  }

  return null;
}

export function progressionChoiceOptionIsEligible(option: ProgressionChoiceOption, context: ProgressionChoiceEligibilityContext): boolean {
  return progressionChoiceOptionIneligibilityReason(option, context) === null;
}

function normalizeProgressionKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function progressionRequirementMatches(owned: string, required: string) {
  const normalizedOwned = normalizeProgressionKey(owned);
  const normalizedRequired = normalizeProgressionKey(required);
  return normalizedOwned === normalizedRequired || normalizedOwned.startsWith(normalizedRequired);
}

function spellMatchesProgressionList(spell: SpellEntry, spellListId: string) {
  const normalizedList = normalizeProgressionKey(spellListId);
  return (
    spell.classes.some((entry) => normalizeProgressionKey(entry) === normalizedList) ||
    spell.classReferences.some(
      (entry) => normalizeProgressionKey(entry.className) === normalizedList || normalizeProgressionKey(entry.name) === normalizedList
    )
  );
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export interface ProgressionAwardMetadata {
  id: string;
  characterLevel: number;
  classLevel: number;
  className: string;
  classSource: string;
  subclassName?: string;
  subclassSource?: string;
  speciesName?: string;
  speciesSource?: string;
  backgroundName?: string;
  backgroundSource?: string;
  choices?: ProgressionAwardChoice[];
  references?: Array<{ name: string; source: string }>;
  committedAt: string;
}

export function createProgressionAwardFromActorDelta(
  before: ActorSheet,
  after: ActorSheet,
  metadata: ProgressionAwardMetadata
): ProgressionAward {
  const classRef = createCompendiumRef(metadata.className, metadata.classSource);
  const effects: ProgressionEffect[] = [];
  let effectIndex = 0;
  const nextId = () => `${metadata.id}:${effectIndex++}`;
  const added = (previous: string[], next: string[]) => next.filter((value) => !previous.includes(value));
  const refFor = (value: string) => {
    if (parseCompendiumRef(value)) return value;
    const source = metadata.references?.find((entry) => entry.name.toLowerCase() === value.toLowerCase())?.source ?? metadata.classSource;
    return createCompendiumRef(value, source);
  };

  added(before.features, after.features).forEach((value) => effects.push({ id: nextId(), kind: "feature", ref: refFor(value) }));
  added(before.feats, after.feats).forEach((value) => effects.push({ id: nextId(), kind: "feat", ref: refFor(value) }));
  added(before.talents, after.talents).forEach((value) => effects.push({ id: nextId(), kind: "talent", ref: refFor(value) }));
  added(before.spells, after.spells).forEach((value) => effects.push({ id: nextId(), kind: "spell", ref: refFor(value), bucket: "known" }));
  added(before.preparedSpells, after.preparedSpells).forEach((value) =>
    effects.push({ id: nextId(), kind: "spell", ref: refFor(value), bucket: "prepared" })
  );
  const spellBuckets = ["spellbook", "alwaysPrepared", "atWill", "perShortRest", "perLongRest"] as const;
  spellBuckets.forEach((bucket) => {
    added(before.spellState[bucket], after.spellState[bucket]).forEach((value) =>
      effects.push({ id: nextId(), kind: "spell", ref: refFor(value), bucket })
    );
  });

  added(before.armorProficiencies, after.armorProficiencies).forEach((value) =>
    effects.push({ id: nextId(), kind: "proficiency", proficiency: "armor", value })
  );
  added(before.weaponProficiencies, after.weaponProficiencies).forEach((value) =>
    effects.push({ id: nextId(), kind: "proficiency", proficiency: "weapon", value })
  );
  added(before.toolProficiencies, after.toolProficiencies).forEach((value) =>
    effects.push({ id: nextId(), kind: "proficiency", proficiency: "tool", value })
  );
  added(before.languageProficiencies, after.languageProficiencies).forEach((value) =>
    effects.push({ id: nextId(), kind: "proficiency", proficiency: "language", value })
  );
  added(before.savingThrowProficiencies, after.savingThrowProficiencies).forEach((value) =>
    effects.push({ id: nextId(), kind: "proficiency", proficiency: "savingThrow", value })
  );
  after.skills.forEach((skill) => {
    const previous = before.skills.find((entry) => entry.id === skill.id || entry.name === skill.name);
    if (skill.expertise && !previous?.expertise) {
      effects.push({ id: nextId(), kind: "proficiency", proficiency: "expertise", value: skill.name });
    } else if (skill.proficient && !previous?.proficient) {
      effects.push({ id: nextId(), kind: "proficiency", proficiency: "skill", value: skill.name });
    }
  });
  (Object.keys(after.abilities) as AbilityKey[]).forEach((ability) => {
    const amount = after.abilities[ability] - before.abilities[ability];
    if (amount !== 0) effects.push({ id: nextId(), kind: "ability", ability, amount });
  });
  after.resources
    .filter((entry) => !before.resources.some((old) => old.id === entry.id))
    .forEach((value) => effects.push({ id: nextId(), kind: "resource", value }));
  after.attacks
    .filter((entry) => !before.attacks.some((old) => old.id === entry.id))
    .forEach((value) => effects.push({ id: nextId(), kind: "action", value }));
  after.bonuses
    .filter((entry) => !before.bonuses.some((old) => old.id === entry.id))
    .forEach((value) => effects.push({ id: nextId(), kind: "bonus", value }));
  after.inventory
    .filter((entry) => !before.inventory.some((old) => old.id === entry.id))
    .forEach((value) => effects.push({ id: nextId(), kind: "inventory", ref: refFor(value.name), quantity: value.quantity }));

  const definition = findClassProgression(metadata.className) ?? findClassProgression(classRef);
  return {
    id: metadata.id,
    characterLevel: metadata.characterLevel,
    classRef,
    classLevel: metadata.classLevel,
    speciesRef: metadata.speciesName
      ? createCompendiumRef(metadata.speciesName, metadata.speciesSource ?? metadata.classSource)
      : undefined,
    backgroundRef: metadata.backgroundName
      ? createCompendiumRef(metadata.backgroundName, metadata.backgroundSource ?? metadata.classSource)
      : undefined,
    subclassRef: metadata.subclassName
      ? createCompendiumRef(metadata.subclassName, metadata.subclassSource ?? metadata.classSource)
      : undefined,
    definitionFingerprint: fingerprintProgressionDefinition(definition?.levels[metadata.classLevel] ?? {}),
    choices: metadata.choices ?? [],
    effects,
    committedAt: metadata.committedAt
  };
}

export function fingerprintProgressionDefinition(value: unknown): string {
  const serialized = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function resolveProgressionEffects(awards: ProgressionAward[], overrides: ActorManualOverride[]): ProgressionEffect[] {
  const suppressed = new Set(
    overrides.filter((entry) => entry.operation === "suppress" || entry.operation === "replace").map((entry) => entry.targetEffectId)
  );
  const effective = awards.flatMap((award) => award.effects).filter((effect) => !suppressed.has(effect.id));
  overrides.forEach((override) => {
    if ((override.operation === "add" || override.operation === "replace") && override.effect) effective.push(override.effect);
  });
  return effective;
}

export function hasProgressionFieldOverride(actor: ActorSheet, field: NonNullable<ActorManualOverride["targetField"]>) {
  return (actor.build?.overrides ?? []).some((entry) => entry.operation === "field" && entry.targetField === field);
}

export function validateProgressionAwardAgainstCurrentRules(award: ProgressionAward, actorBeforeAward?: ActorSheet): string[] {
  const errors: string[] = [];
  const parsedClass = parseCompendiumRef(award.classRef);
  const classDefinition = parsedClass ? findClassProgression(parsedClass.name) : null;
  if (!parsedClass || !classDefinition) return ["The awarded class reference is not available in the progression catalog."];
  const levelDefinition = classDefinition.levels[award.classLevel];
  if (!levelDefinition) errors.push(`Class level ${award.classLevel} is not defined for ${parsedClass.name}.`);
  if (levelDefinition && award.definitionFingerprint !== fingerprintProgressionDefinition(levelDefinition)) {
    errors.push("The progression definition changed after this wizard preview. Reopen the wizard and review the level.");
  }

  const subclassName = award.subclassRef ? parseCompendiumRef(award.subclassRef)?.name : undefined;
  const requiredGroups = evaluateClassChoicesForLevel(classDefinition, award.classLevel, subclassName);
  const selectedClassOptions = requiredGroups.flatMap((group) => {
    const selectedIds = award.choices.find((choice) => choice.groupId === group.id)?.optionIds ?? [];
    return group.options.filter((option) => selectedIds.includes(option.id));
  });
  const selectedFeatureNames = selectedClassOptions.flatMap((option) => option.grants?.features ?? []);
  requiredGroups
    .filter((group) => group.cadence === undefined || group.cadence === "onLevelUp" || group.cadence === "permanent")
    .forEach((group) => {
      const selected = award.choices.find((choice) => choice.groupId === group.id)?.optionIds ?? [];
      if (selected.length !== group.choose || new Set(selected).size !== selected.length) {
        errors.push(`${group.id} requires exactly ${group.choose} unique selection(s).`);
        return;
      }
      if (selected.some((optionId) => !group.options.some((option) => option.id === optionId))) {
        errors.push(`${group.id} contains an unavailable option.`);
      }
      selected.forEach((optionId) => {
        const option = group.options.find((entry) => entry.id === optionId);
        if (!option) return;
        const prerequisiteError = progressionChoiceOptionIneligibilityReason(option, {
          actor: actorBeforeAward,
          classDefinition,
          classLevel: award.classLevel,
          characterLevel: award.characterLevel,
          subclassId: subclassName,
          selectedFeatureNames
        });
        if (prerequisiteError) errors.push(`${group.id}: ${prerequisiteError}`);
        const dependentChoices = [
          { suffix: "cantrips", count: option.grants?.cantripsCount ?? 0 },
          { suffix: "spells", count: option.grants?.spellsCount ?? 0 }
        ];
        dependentChoices.forEach((dependent) => {
          if (dependent.count <= 0) return;
          const dependentGroupId = `${group.id}:${option.id}:${dependent.suffix}`;
          const dependentSelected = award.choices.find((choice) => choice.groupId === dependentGroupId)?.optionIds ?? [];
          if (dependentSelected.length !== dependent.count || new Set(dependentSelected).size !== dependentSelected.length) {
            errors.push(`${dependentGroupId} requires exactly ${dependent.count} unique selection(s).`);
          }
        });
      });
    });

  if (award.speciesRef) {
    const speciesName = parseCompendiumRef(award.speciesRef)?.name;
    const species = speciesName ? findSpeciesProgression(speciesName) : null;
    if (!species) {
      errors.push("The awarded species reference is not available in the progression catalog.");
    } else {
      (species.choices ?? []).forEach((group) => {
        const selected =
          award.choices.find((choice) => choice.groupId === group.id)?.optionIds ??
          (group.id.includes("origin-feat")
            ? award.choices.find((choice) => choice.groupId === "setup:species-origin-feat")?.optionIds
            : undefined) ??
          [];
        if (selected.length !== group.choose || new Set(selected).size !== selected.length) {
          errors.push(`${group.id} requires exactly ${group.choose} unique selection(s).`);
        } else if (
          selected.some((optionId) => {
            const selectedFeat = findFeatProgression(optionId);
            return !group.options.some(
              (option) =>
                option.id === optionId ||
                (selectedFeat &&
                  option.name.toLowerCase().replace(/[^a-z0-9]+/g, "") === selectedFeat.name.toLowerCase().replace(/[^a-z0-9]+/g, ""))
            );
          })
        ) {
          errors.push(`${group.id} contains an unavailable option.`);
        }
      });
      const selectedSkills = award.choices.find((choice) => choice.groupId === "setup:species-skills")?.optionIds ?? [];
      if (species.skillChoices && selectedSkills.length !== species.skillChoices.choose) {
        errors.push(`The species requires exactly ${species.skillChoices.choose} skill selection(s).`);
      }
    }
  }

  if (award.backgroundRef) {
    const backgroundName = parseCompendiumRef(award.backgroundRef)?.name;
    const background = backgroundName ? findBackgroundProgression(backgroundName) : null;
    if (!background) {
      errors.push("The awarded background reference is not available in the progression catalog.");
    } else {
      background.equipmentChoices.forEach((group) => {
        const selected = award.choices.find((choice) => choice.groupId.endsWith(`:${group.id}`))?.optionIds ?? [];
        if (selected.length !== 1 || !group.options.some((option) => option.id === selected[0])) {
          errors.push(`${group.id} requires one available equipment package.`);
        }
      });
      const originFeatId = award.choices.find((choice) => choice.groupId === "setup:origin-feat")?.optionIds[0];
      const originFeat = originFeatId ? findFeatProgression(originFeatId) : null;
      const hasOriginFeatEffect = award.effects.some(
        (effect) =>
          effect.kind === "feat" &&
          parseCompendiumRef(effect.ref)
            ?.name.toLowerCase()
            .replace(/[^a-z0-9]+/g, "") === background.originFeatName.toLowerCase().replace(/[^a-z0-9]+/g, "")
      );
      if (
        !hasOriginFeatEffect &&
        (!originFeat ||
          (originFeat.id !== background.originFeatId &&
            originFeat.name.toLowerCase().replace(/[^a-z0-9]+/g, "") !==
              background.originFeatName.toLowerCase().replace(/[^a-z0-9]+/g, "")))
      ) {
        errors.push(`The background requires ${background.originFeatName}.`);
      }
      const abilityChoices = award.choices.find((choice) => choice.groupId === "setup:background-abilities")?.optionIds ?? [];
      if (
        ![2, 3].includes(abilityChoices.length) ||
        new Set(abilityChoices).size !== abilityChoices.length ||
        abilityChoices.some((ability) => !background.abilityScores.options.includes(ability as AbilityKey))
      ) {
        errors.push("The background ability score choices are invalid.");
      }
    }
  }

  const featNames = Array.from(
    new Set(
      award.effects
        .filter((effect): effect is ProgressionEffect & { kind: "feat"; ref: string } => effect.kind === "feat")
        .map((effect) => parseCompendiumRef(effect.ref)?.name)
        .filter((name): name is string => Boolean(name))
    )
  );
  featNames.forEach((featName) => {
    const feat = findFeatProgression(featName);
    if (!feat) {
      errors.push(`The awarded feat reference ${featName} is not available in the progression catalog.`);
      return;
    }
    const prerequisites = feat.prerequisites;
    if (prerequisites?.minLevel && award.characterLevel < prerequisites.minLevel) {
      errors.push(`${feat.name} requires character level ${prerequisites.minLevel}.`);
    }
    if (
      actorBeforeAward &&
      prerequisites?.abilities &&
      Object.entries(prerequisites.abilities).some(
        ([ability, minimum]) => actorBeforeAward.abilities[ability as AbilityKey] < (minimum ?? 0)
      )
    ) {
      errors.push(`${feat.name}'s ability prerequisite is not met.`);
    }
    if (
      actorBeforeAward &&
      prerequisites?.armorProficiencies?.some(
        (required) => !actorBeforeAward.armorProficiencies.some((owned) => owned.toLowerCase() === required.toLowerCase())
      )
    ) {
      errors.push(`${feat.name}'s armor proficiency prerequisite is not met.`);
    }
    if (
      actorBeforeAward &&
      prerequisites?.weaponProficiencies?.some(
        (required) => !actorBeforeAward.weaponProficiencies.some((owned) => owned.toLowerCase() === required.toLowerCase())
      )
    ) {
      errors.push(`${feat.name}'s weapon proficiency prerequisite is not met.`);
    }
    if (actorBeforeAward && prerequisites?.spellcasting) {
      const canCast = actorBeforeAward.classes.some((entry) => {
        const actorClass = findClassProgression(entry.compendiumId) ?? findClassProgression(entry.name);
        return actorClass?.multiclassing.casterType !== "none";
      });
      if (!canCast) errors.push(`${feat.name} requires spellcasting.`);
    }
    (feat.choices ?? []).forEach((group) => {
      const selected = award.choices.find((choice) => choice.groupId === group.id)?.optionIds ?? [];
      const options = [
        ...group.options,
        ...(group.optionSetIds ?? (group.optionSetId ? [group.optionSetId] : [])).flatMap(
          (domainId) => findProgressionChoiceDomain(domainId)?.options ?? []
        )
      ];
      if (selected.length !== group.choose || new Set(selected).size !== selected.length) {
        errors.push(`${group.id} requires exactly ${group.choose} unique selection(s).`);
      } else if (selected.some((optionId) => !options.some((option) => option.id === optionId))) {
        errors.push(`${group.id} contains an unavailable option.`);
      } else {
        selected.forEach((optionId) => {
          const option = options.find((entry) => entry.id === optionId);
          if (!option) return;
          const prerequisiteError = progressionChoiceOptionIneligibilityReason(option, {
            actor: actorBeforeAward,
            classDefinition,
            classLevel: award.classLevel,
            characterLevel: award.characterLevel,
            subclassId: subclassName,
            selectedFeatureNames
          });
          if (prerequisiteError) errors.push(`${group.id}: ${prerequisiteError}`);
        });
      }
    });
    if (feat.abilityIncrease) {
      const groupId = `${feat.id}:ability-increase`;
      const selected = award.choices.find((choice) => choice.groupId === groupId)?.optionIds ?? [];
      if (selected.length !== feat.abilityIncrease.choose || new Set(selected).size !== selected.length) {
        errors.push(`${groupId} requires exactly ${feat.abilityIncrease.choose} unique selection(s).`);
      } else if (selected.some((ability) => !feat.abilityIncrease?.options.includes(ability as AbilityKey))) {
        errors.push(`${groupId} contains an unavailable ability.`);
      }
    }
    [
      { suffix: "cantrips", count: feat.grants?.cantripsCount ?? 0 },
      { suffix: "spells", count: feat.grants?.spellsCount ?? 0 }
    ].forEach((spellGroup) => {
      if (spellGroup.count <= 0) return;
      const groupId = `${feat.id}:${spellGroup.suffix}`;
      const selected = award.choices.find((choice) => choice.groupId === groupId)?.optionIds ?? [];
      if (selected.length !== spellGroup.count || new Set(selected).size !== selected.length) {
        errors.push(`${groupId} requires exactly ${spellGroup.count} unique selection(s).`);
      }
    });
  });

  const effectIds = award.effects.map((effect) => effect.id);
  if (new Set(effectIds).size !== effectIds.length) errors.push("Award effect IDs must be unique.");
  award.effects.forEach((effect) => {
    if (
      (effect.kind === "feature" || effect.kind === "feat" || effect.kind === "talent" || effect.kind === "spell") &&
      !parseCompendiumRef(effect.ref)
    ) {
      errors.push(`Effect ${effect.id} does not use a canonical compendium reference.`);
    }
  });
  return errors;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function actorAbilityModifier(actor: ActorSheet, ability: AbilityKey): number {
  const base = actor.abilities[ability] ?? 10;
  return abilityModifier(base);
}

const MULTICLASS_FULL_CASTER_SLOTS: number[][] = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0], // 1
  [3, 0, 0, 0, 0, 0, 0, 0, 0], // 2
  [4, 2, 0, 0, 0, 0, 0, 0, 0], // 3
  [4, 3, 0, 0, 0, 0, 0, 0, 0], // 4
  [4, 3, 2, 0, 0, 0, 0, 0, 0], // 5
  [4, 3, 3, 0, 0, 0, 0, 0, 0], // 6
  [4, 3, 3, 1, 0, 0, 0, 0, 0], // 7
  [4, 3, 3, 2, 0, 0, 0, 0, 0], // 8
  [4, 3, 3, 3, 1, 0, 0, 0, 0], // 9
  [4, 3, 3, 3, 2, 0, 0, 0, 0], // 10
  [4, 3, 3, 3, 2, 1, 0, 0, 0], // 11
  [4, 3, 3, 3, 2, 1, 0, 0, 0], // 12
  [4, 3, 3, 3, 2, 1, 1, 0, 0], // 13
  [4, 3, 3, 3, 2, 1, 1, 0, 0], // 14
  [4, 3, 3, 3, 2, 1, 1, 1, 0], // 15
  [4, 3, 3, 3, 2, 1, 1, 1, 0], // 16
  [4, 3, 3, 3, 2, 1, 1, 1, 1], // 17
  [4, 3, 3, 3, 3, 1, 1, 1, 1], // 18
  [4, 3, 3, 3, 3, 2, 1, 1, 1], // 19
  [4, 3, 3, 3, 3, 2, 2, 1, 1] // 20
];

export function evaluateActorSpellSlots(actor: ActorSheet): Array<{ level: number; total: number; used: number }> {
  const totals = Array.from({ length: 9 }, (_, i: number) => ({
    level: i + 1,
    total: 0,
    used: actor.spellSlots.find((entry: SpellSlotTrack) => entry.level === i + 1)?.used ?? 0
  }));

  if (actor.classes.length === 0) {
    return totals;
  }

  // Check if single class with direct slot table defined in progression
  if (actor.classes.length === 1) {
    const singleClass = actor.classes[0];
    const def = findClassProgression(singleClass.name) || findClassProgression(singleClass.id);
    if (def) {
      const levelConfig: LevelProgressionConfig | undefined = def.levels[singleClass.level];
      if (levelConfig?.spellcasting?.slots) {
        levelConfig.spellcasting.slots.forEach((count: number, idx: number) => {
          if (idx < totals.length) {
            totals[idx].total = count;
          }
        });
        return totals.map((entry) => ({ ...entry, used: Math.min(entry.used, entry.total) }));
      }
    }
  }

  // Multiclass spell slot evaluation
  let fullCasterLevels = 0;
  let halfCasterLevels = 0;
  let thirdCasterLevels = 0;

  actor.classes.forEach((actorClass: ActorClassEntry) => {
    const def = findClassProgression(actorClass.name) || findClassProgression(actorClass.id);
    if (!def) return;

    if (def.multiclassing.casterType === "full") {
      fullCasterLevels += actorClass.level;
    } else if (def.multiclassing.casterType === "half") {
      halfCasterLevels += actorClass.level;
    } else if (def.multiclassing.casterType === "third") {
      thirdCasterLevels += actorClass.level;
    } else if (def.multiclassing.casterType === "pact") {
      const levelConfig: LevelProgressionConfig | undefined = def.levels[actorClass.level];
      if (levelConfig?.spellcasting?.slots) {
        levelConfig.spellcasting.slots.forEach((count: number, idx: number) => {
          if (idx < totals.length) {
            totals[idx].total += count;
          }
        });
      }
    }
  });

  const effectiveLevel = fullCasterLevels + Math.floor(halfCasterLevels / 2) + Math.floor(thirdCasterLevels / 3);
  if (effectiveLevel > 0) {
    const clampedLevel = Math.min(20, effectiveLevel);
    const row = MULTICLASS_FULL_CASTER_SLOTS[clampedLevel - 1];
    if (row) {
      row.forEach((count: number, idx: number) => {
        if (idx < totals.length) {
          totals[idx].total += count;
        }
      });
    }
  }

  return totals.map((entry) => ({
    ...entry,
    used: Math.min(entry.used, entry.total)
  }));
}

export function evaluateActorPreparedSpellsLimit(actor: ActorSheet): number {
  let totalPrepared = 0;

  actor.classes.forEach((actorClass: ActorClassEntry) => {
    const def = findClassProgression(actorClass.name) || findClassProgression(actorClass.id);
    if (!def) return;

    let formula = def.levels[actorClass.level]?.spellcasting?.preparedSpellsFormula;
    let spellcastingAbility = def.levels[actorClass.level]?.spellcasting?.spellcastingAbility;
    if (!formula) {
      for (let l = 1; l <= actorClass.level; l++) {
        if (def.levels[l]?.spellcasting?.preparedSpellsFormula) {
          formula = def.levels[l]?.spellcasting?.preparedSpellsFormula;
        }
        if (def.levels[l]?.spellcasting?.spellcastingAbility) {
          spellcastingAbility = def.levels[l]?.spellcasting?.spellcastingAbility;
        }
      }
    }
    if (!formula) return;

    if (formula.type === "fixed" || formula.type === "table") {
      totalPrepared += formula.count ?? 0;
    } else if (formula.type === "abilityPlusLevel") {
      const ability = formula.ability ?? actorClass.spellcastingAbility ?? spellcastingAbility ?? "wis";
      const mod = actorAbilityModifier(actor, ability);
      totalPrepared += Math.max(1, actorClass.level + mod);
    }
  });

  return totalPrepared;
}

export function evaluateResourceMax(resourceDef: ProgressionResourceDef, actor: ActorSheet, classLevel: number): number {
  const formula = resourceDef.maxFormula;
  switch (formula.type) {
    case "fixed":
      return formula.value ?? 1;
    case "level":
      return classLevel;
    case "levelMultiplier":
      return classLevel * (formula.multiplier ?? 1);
    case "statModifier": {
      const mod = formula.stat ? actorAbilityModifier(actor, formula.stat) : 0;
      return Math.max(formula.min ?? 1, mod);
    }
    default:
      return 1;
  }
}

export function evaluateActorDerivedResources(actor: ActorSheet): Array<{
  id: string;
  name: string;
  max: number;
  current: number;
  resetOn: "shortRest" | "longRest";
  restoreAmount: number;
  dice?: string;
}> {
  const resourcesMap = new Map<
    string,
    {
      id: string;
      name: string;
      max: number;
      current: number;
      resetOn: "shortRest" | "longRest";
      restoreAmount: number;
      dice?: string;
    }
  >();

  actor.classes.forEach((actorClass: ActorClassEntry) => {
    const def = findClassProgression(actorClass.name) || findClassProgression(actorClass.id);
    if (!def) return;

    for (let lvl = 1; lvl <= actorClass.level; lvl++) {
      const levelConfig: LevelProgressionConfig | undefined = def.levels[lvl];
      if (levelConfig?.resources) {
        levelConfig.resources.forEach((res: ProgressionResourceDef) => {
          const max = evaluateResourceMax(res, actor, actorClass.level);
          const existing = actor.resources.find((r: ResourceEntry) => r.name.toLowerCase() === res.name.toLowerCase());
          const restoreAmount = typeof res.shortRestRestore === "number" ? res.shortRestRestore : max;
          resourcesMap.set(res.name.toLowerCase(), {
            id: existing?.id || `prog-res-${res.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
            name: res.name,
            max,
            current: existing ? Math.min(max, existing.current) : max,
            resetOn: res.resetOn,
            restoreAmount,
            dice: res.dice
          });
        });
      }

      // Check active subclass resources
      const subclassId = actorClass.subclassId;
      if (subclassId) {
        const subDef = def.subclasses.find((s) => s.id === subclassId || s.name.toLowerCase() === subclassId.toLowerCase());
        const subLvlConfig = subDef?.levels[lvl];
        if (subLvlConfig?.resources) {
          subLvlConfig.resources.forEach((res: ProgressionResourceDef) => {
            const max = evaluateResourceMax(res, actor, actorClass.level);
            const existing = actor.resources.find((r: ResourceEntry) => r.name.toLowerCase() === res.name.toLowerCase());
            const restoreAmount = typeof res.shortRestRestore === "number" ? res.shortRestRestore : max;
            resourcesMap.set(res.name.toLowerCase(), {
              id: existing?.id || `prog-res-${res.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
              name: res.name,
              max,
              current: existing ? Math.min(max, existing.current) : max,
              resetOn: res.resetOn,
              restoreAmount,
              dice: res.dice
            });
          });
        }
      }
    }
  });

  return Array.from(resourcesMap.values());
}

export function evaluateActorPassiveSkillBonuses(actor: ActorSheet, skillName: string): number {
  const normSkill = skillName.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return actor.bonuses.reduce((total, entry) => {
    if (!entry.enabled || entry.targetType !== "skill" || entry.targetKey.toLowerCase().replace(/[^a-z0-9]+/g, "") !== normSkill) {
      return total;
    }
    const statValue = entry.statBonus ? actorAbilityModifier(actor, entry.statBonus) : 0;
    return total + entry.value + (entry.statBonus ? Math.max(entry.minimum ?? Number.NEGATIVE_INFINITY, statValue) : 0);
  }, 0);
}

export function evaluateClassChoicesForLevel(
  classDef: ClassProgressionDef,
  level: number,
  subclassId?: string
): ProgressionChoiceGroupDef[] {
  const levelConfig: LevelProgressionConfig | undefined = classDef.levels[level];
  const groups: ProgressionChoiceGroupDef[] = [];

  if (levelConfig?.choices) {
    groups.push(...levelConfig.choices);
  }

  if (subclassId) {
    const subDef = classDef.subclasses.find((s) => s.id === subclassId || s.name.toLowerCase() === subclassId.toLowerCase());
    const subConfig = subDef?.levels[level];
    if (subConfig?.choices) {
      groups.push(...subConfig.choices);
    }
  }

  return groups;
}

export function evaluateActorSubclassAlwaysPreparedSpells(actor: ActorSheet): string[] {
  const spells = new Set<string>();

  actor.classes.forEach((actorClass) => {
    const classDef = findClassProgression(actorClass.name) || findClassProgression(actorClass.id);
    const subclassId = actorClass.subclassId;
    if (!classDef || !subclassId) return;

    const subDef = classDef.subclasses.find((s) => s.id === subclassId || s.name.toLowerCase() === subclassId.toLowerCase());
    if (!subDef) return;

    for (let lvl = 1; lvl <= actorClass.level; lvl++) {
      const lvlConfig = subDef.levels[lvl];
      if (lvlConfig?.alwaysPreparedSpells) {
        lvlConfig.alwaysPreparedSpells.forEach((sp) => spells.add(sp));
      }
    }
  });

  return Array.from(spells);
}

export function evaluateRestRecovery(actor: ActorSheet, restType: "short" | "long"): ActorSheet {
  const next: ActorSheet = JSON.parse(JSON.stringify(actor));

  if (restType === "long") {
    // 1. Restore all HP
    next.hitPoints.current = next.hitPoints.max;
    next.hitPoints.temp = 0;

    // 2. Restore all spell slots
    const maxSlots = evaluateActorSpellSlots(next);
    next.spellSlots = maxSlots.map((s) => ({ ...s, used: 0 }));

    // 3. Restore all resources to max
    const maxResources = evaluateActorDerivedResources(next);
    next.resources = maxResources.map((r) => ({
      ...r,
      current: r.max,
      restoreAmount: r.restoreAmount
    }));

    return next;
  }

  // Short Rest:
  // 1. Restore Warlock Pact Magic slots
  const pactClass = next.classes.find((c) => {
    const def = findClassProgression(c.name) || findClassProgression(c.id);
    return def?.multiclassing.casterType === "pact";
  });
  if (pactClass) {
    const def = findClassProgression(pactClass.name) || findClassProgression(pactClass.id);
    const pactSlots = def?.levels[pactClass.level]?.spellcasting?.slots;
    if (pactSlots) {
      pactSlots.forEach((count: number, idx: number) => {
        if (count > 0 && next.spellSlots[idx]) {
          next.spellSlots[idx].used = Math.max(0, next.spellSlots[idx].used - count);
        }
      });
    }
  }

  // 2. Restore resources based on declarative shortRestRestore
  const currentDerived = evaluateActorDerivedResources(next);
  next.resources = currentDerived.map((resDef) => {
    const existing = next.resources.find((r) => r.name.toLowerCase() === resDef.name.toLowerCase());
    const currentVal = existing ? existing.current : resDef.max;

    // Find class resource definition for shortRestRestore
    let shortRestRestore: "all" | number | undefined = undefined;
    let resetOn: "shortRest" | "longRest" = resDef.resetOn;

    for (const actorClass of next.classes) {
      const def = findClassProgression(actorClass.name) || findClassProgression(actorClass.id);
      if (!def) continue;
      for (let l = 1; l <= actorClass.level; l++) {
        const lvlRes = def.levels[l]?.resources?.find((r) => r.name.toLowerCase() === resDef.name.toLowerCase());
        if (lvlRes) {
          resetOn = lvlRes.resetOn;
          shortRestRestore = lvlRes.shortRestRestore;
        }
      }
    }

    if (resetOn !== "shortRest" && (shortRestRestore === undefined || shortRestRestore === 0)) {
      // Long rest only resource -> no recovery on short rest
      return {
        ...resDef,
        restoreAmount: resDef.restoreAmount,
        current: currentVal
      };
    }

    if (shortRestRestore === "all" || (shortRestRestore === undefined && resetOn === "shortRest")) {
      return {
        ...resDef,
        restoreAmount: resDef.restoreAmount,
        current: resDef.max
      };
    }

    if (typeof shortRestRestore === "number") {
      return {
        ...resDef,
        restoreAmount: resDef.restoreAmount,
        current: Math.min(resDef.max, currentVal + shortRestRestore)
      };
    }

    return {
      ...resDef,
      restoreAmount: resDef.restoreAmount,
      current: currentVal
    };
  });

  return next;
}

export function evaluateActorRestChoices(actor: ActorSheet, restType: "short" | "long"): ProgressionChoiceGroupDef[] {
  const groups: ProgressionChoiceGroupDef[] = [];
  const seenIds = new Set<string>();

  actor.classes.forEach((actorClass) => {
    const classDef = findClassProgression(actorClass.name) || findClassProgression(actorClass.id);
    if (!classDef) return;

    for (let lvl = 1; lvl <= actorClass.level; lvl++) {
      const lvlConfig = classDef.levels[lvl];
      (lvlConfig?.choices ?? []).forEach((c) => {
        if (
          !seenIds.has(c.id) &&
          ((restType === "long" && (c.cadence === "onLongRest" || c.cadence === "onShortRest")) ||
            (restType === "short" && c.cadence === "onShortRest"))
        ) {
          seenIds.add(c.id);
          groups.push(c);
        }
      });
    }

    const subclassId = actorClass.subclassId;
    if (subclassId) {
      const subDef = classDef.subclasses.find((s) => s.id === subclassId || s.name.toLowerCase() === subclassId.toLowerCase());
      if (subDef) {
        for (let lvl = 1; lvl <= actorClass.level; lvl++) {
          const subLvlConfig = subDef.levels[lvl];
          (subLvlConfig?.choices ?? []).forEach((c) => {
            if (
              !seenIds.has(c.id) &&
              ((restType === "long" && (c.cadence === "onLongRest" || c.cadence === "onShortRest")) ||
                (restType === "short" && c.cadence === "onShortRest"))
            ) {
              seenIds.add(c.id);
              groups.push(c);
            }
          });
        }
      }
    }
  });

  return groups;
}

export function applyRestChoiceSelections(actor: ActorSheet, selections: Record<string, string[]>): ActorSheet {
  const next: ActorSheet = JSON.parse(JSON.stringify(actor));
  const availableGroups = evaluateActorRestChoices(actor, "long");

  availableGroups.forEach((group) => {
    const selectedOptionIds = selections[group.id] ?? [];
    selectedOptionIds.forEach((optId) => {
      const option = group.options.find((o) => o.id === optId);
      if (!option || !option.grants) return;

      // 1. Grant features
      if (option.grants.features) {
        next.features = Array.from(new Set([...(next.features ?? []), ...option.grants.features]));
      }

      // 2. Grant tool proficiencies
      if (option.grants.toolProficiencies) {
        next.toolProficiencies = Array.from(new Set([...(next.toolProficiencies ?? []), ...option.grants.toolProficiencies]));
      }

      // 3. Grant always prepared spells
      if (option.grants.alwaysPreparedSpells) {
        next.spells = Array.from(new Set([...(next.spells ?? []), ...option.grants.alwaysPreparedSpells]));
        next.preparedSpells = Array.from(new Set([...(next.preparedSpells ?? []), ...option.grants.alwaysPreparedSpells]));
      }
    });
  });

  return next;
}
