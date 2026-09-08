import {
  type ClassProgressionDef,
  findBackgroundProgression,
  findClassProgression,
  findFeatProgression,
  findProgressionChoiceDomain,
  findSpeciesProgression,
  type LevelProgressionConfig,
  type ProgressionChoiceGroupDef,
  type ProgressionChoiceOption,
  type ProgressionResourceDef
} from "../data/progression/index.js";
import type {
  AbilityKey,
  ActorClassEntry,
  ActorManualOverride,
  ActorSheet,
  ActorWeaponMastery,
  ProgressionAward,
  ProgressionAwardChoice,
  ProgressionConfiguration,
  ProgressionEffect,
  ResourceEntry,
  SpellEntry,
  SpellSlotTrack
} from "../types.js";
import { createCompendiumRef, parseCompendiumRef } from "./compendiumRefs.js";

export interface ProgressionChoiceEligibilityContext {
  actor?: ActorSheet;
  classDefinition?: ClassProgressionDef;
  classLevel: number;
  characterLevel: number;
  subclassId?: string;
  selectedFeatureNames?: string[];
  spells?: SpellEntry[];
  selectedSpellIds?: string[];
  selectedOptions?: Record<string, string[]>;
}

export function progressionChoiceOptionIneligibilityReason(
  option: ProgressionChoiceOption,
  context: ProgressionChoiceEligibilityContext
): string | null {
  if (
    !option.repeatable &&
    Object.values(context.selectedOptions ?? {})
      .flat()
      .includes(option.id)
  ) {
    return "This option is already selected and isn't repeatable.";
  }
  const requirements = option.requires;
  if (!requirements) return null;

  if (requirements.all) {
    for (const requirement of requirements.all) {
      const reason = progressionChoiceOptionIneligibilityReason({ ...option, requires: requirement }, context);
      if (reason) return reason;
    }
  }
  if (requirements.any) {
    const reasons = requirements.any.map((requirement) =>
      progressionChoiceOptionIneligibilityReason({ ...option, requires: requirement }, context)
    );
    if (reasons.every(Boolean)) return reasons.filter(Boolean).join(" Or ");
  }
  if (requirements.not) {
    const reason = progressionChoiceOptionIneligibilityReason({ ...option, requires: requirements.not }, context);
    if (!reason) return "Excluded by another prerequisite.";
  }
  if (
    requirements.selectedOption &&
    !(context.selectedOptions?.[requirements.selectedOption.groupId] ?? []).includes(requirements.selectedOption.optionId)
  ) {
    return `Requires ${requirements.selectedOption.optionId}.`;
  }

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

function collectActorAwardChoices(actor?: ActorSheet): Record<string, string[]> {
  const choices: Record<string, string[]> = {};
  (actor?.build?.awards ?? [])
    .flatMap((award) => award.choices)
    .forEach((choice) => {
      choices[choice.groupId] = Array.from(new Set([...(choices[choice.groupId] ?? []), ...choice.optionIds]));
    });
  return choices;
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
  const previouslySelectedOptions = collectActorAwardChoices(actorBeforeAward);
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
          selectedFeatureNames,
          selectedOptions: previouslySelectedOptions
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
                  (option.name.toLowerCase().replace(/[^a-z0-9]+/g, "") === selectedFeat.name.toLowerCase().replace(/[^a-z0-9]+/g, "") ||
                    (option.id === "magic-initiate" && selectedFeat.id.startsWith("magic-initiate-"))))
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
      prerequisites?.anyAbility &&
      !prerequisites.anyAbility.abilities.some((ability) => actorBeforeAward.abilities[ability] >= prerequisites.anyAbility!.minimum)
    ) {
      errors.push(`${feat.name}'s alternative ability prerequisite is not met.`);
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
            selectedFeatureNames,
            selectedOptions: previouslySelectedOptions
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
      const subclass = def.subclasses.find(
        (entry) => entry.id === singleClass.subclassId || entry.name.toLowerCase() === singleClass.subclassName?.toLowerCase()
      );
      const slots = levelConfig?.spellcasting?.slots ?? latestSubclassSpellcasting(subclass, singleClass.level)?.slots;
      if (slots) {
        slots.forEach((count: number, idx: number) => {
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

    const subclass = def.subclasses.find(
      (entry) => entry.id === actorClass.subclassId || entry.name.toLowerCase() === actorClass.subclassName?.toLowerCase()
    );
    const casterType =
      def.multiclassing.casterType === "none" && latestSubclassSpellcasting(subclass, actorClass.level)
        ? "third"
        : def.multiclassing.casterType;

    if (casterType === "full") {
      fullCasterLevels += actorClass.level;
    } else if (casterType === "half") {
      halfCasterLevels += actorClass.level;
    } else if (casterType === "third") {
      thirdCasterLevels += actorClass.level;
    } else if (casterType === "pact") {
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
  return actor.classes.reduce((totalPrepared, actorClass: ActorClassEntry) => {
    const def = findClassProgression(actorClass.name) || findClassProgression(actorClass.id);
    if (!def) return totalPrepared;
    const subclass = def.subclasses.find(
      (entry) => entry.id === actorClass.subclassId || entry.name.toLowerCase() === actorClass.subclassName?.toLowerCase()
    );
    const rules = subclass?.spellcastingRules ?? def.spellcastingRules;
    const progression = rules?.preparedSpellsProgression;
    if (progression) return totalPrepared + (progression[Math.max(1, Math.min(20, actorClass.level)) - 1] ?? 0);
    if (rules?.preparedSpellsFormula) {
      return (
        totalPrepared +
        Math.max(
          rules.preparedSpellsFormula.min,
          actorAbilityModifier(actor, rules.preparedSpellsFormula.ability) + Math.ceil(actorClass.level / 2)
        )
      );
    }
    return totalPrepared;
  }, 0);
}

function latestSubclassSpellcasting(subclass: ClassProgressionDef["subclasses"][number] | undefined, level: number) {
  for (let candidate = level; candidate >= 1; candidate -= 1) {
    const spellcasting = subclass?.levels[candidate]?.spellcasting;
    if (spellcasting) return spellcasting;
  }
  return undefined;
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
    case "proficiencyBonus": {
      const characterLevel = actor.classes.length > 0 ? actor.classes.reduce((sum, entry) => sum + entry.level, 0) : actor.level;
      return Math.min(6, 2 + Math.floor((Math.max(characterLevel, 1) - 1) / 4));
    }
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
    return (
      total +
      entry.value +
      (entry.statBonus ? Math.max(entry.minimum ?? Number.NEGATIVE_INFINITY, statValue) : 0) +
      (entry.proficiencyBonusMultiplier ?? 0) * actor.proficiencyBonus
    );
  }, 0);
}

export function evaluateClassChoicesForLevel(
  classDef: ClassProgressionDef,
  level: number,
  subclassId?: string
): ProgressionChoiceGroupDef[] {
  const groupsById = new Map<string, ProgressionChoiceGroupDef>();
  const collectGroups = (levels: Record<number, LevelProgressionConfig>) => {
    for (let candidateLevel = 1; candidateLevel <= level; candidateLevel++) {
      for (const group of levels[candidateLevel]?.choices ?? []) {
        if (candidateLevel === level || group.repeatOnLevelUp) groupsById.set(group.id, group);
      }
    }
  };

  collectGroups(classDef.levels);

  if (subclassId) {
    const subDef = classDef.subclasses.find((s) => s.id === subclassId || s.name.toLowerCase() === subclassId.toLowerCase());
    if (subDef) collectGroups(subDef.levels);
  }

  return Array.from(groupsById.values()).map((group) => ({
    ...group,
    options: [
      ...group.options,
      ...(group.optionSetIds ?? (group.optionSetId ? [group.optionSetId] : [])).flatMap(
        (domainId) => findProgressionChoiceDomain(domainId)?.options ?? []
      )
    ].map((option) => ({
      ...option,
      grants: {
        ...materializeChoiceOptionGrants(option, level),
        ...(group.optionGrantMode === "feature" ? { features: [option.name] } : {})
      }
    }))
  }));
}

export function evaluateActorSubclassAlwaysPreparedSpells(actor: ActorSheet): string[] {
  const spells = new Set<string>();

  actor.classes.forEach((actorClass) => {
    const classDef = findClassProgression(actorClass.name) || findClassProgression(actorClass.id);
    if (!classDef) return;

    for (let lvl = 1; lvl <= actorClass.level; lvl++) {
      classDef.levels[lvl]?.alwaysPreparedSpells?.forEach((spell) => spells.add(spell));
    }

    const subclassId = actorClass.subclassId;
    if (!subclassId) return;

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
    const derivedNames = new Set(maxResources.map((resource) => resource.name.toLowerCase()));
    next.resources = [
      ...maxResources.map((resource) => ({
        ...resource,
        current: resource.max,
        restoreAmount: resource.restoreAmount
      })),
      ...next.resources
        .filter((resource) => !derivedNames.has(resource.name.toLowerCase()))
        .map((resource) => ({ ...resource, current: resource.max }))
    ];

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
  const derivedNames = new Set(currentDerived.map((resource) => resource.name.toLowerCase()));
  const restoredDerived = currentDerived.map((resDef) => {
    const existing = next.resources.find((r) => r.name.toLowerCase() === resDef.name.toLowerCase());
    const currentVal = existing ? existing.current : resDef.max;

    // Find class resource definition for shortRestRestore
    let shortRestRestore: "all" | number | undefined;
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
  next.resources = [
    ...restoredDerived,
    ...next.resources
      .filter((resource) => !derivedNames.has(resource.name.toLowerCase()))
      .map((resource) =>
        /short/i.test(resource.resetOn)
          ? { ...resource, current: Math.min(resource.max, resource.current + Math.max(0, resource.restoreAmount)) }
          : resource
      )
  ];

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
          !c.spellSelection &&
          choiceParentIsActive(actor, actorClass.id, c) &&
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
              !c.spellSelection &&
              choiceParentIsActive(actor, actorClass.id, c) &&
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

function choiceParentIsActive(actor: ActorSheet, ownerInstanceId: string, group: ProgressionChoiceGroupDef) {
  if (!group.parentOption) return true;
  return Boolean(
    actor.build?.configurations
      ?.find((entry) => entry.ownerInstanceId === ownerInstanceId && entry.groupId === group.parentOption?.groupId)
      ?.activeOptionIds.includes(group.parentOption.optionId)
  );
}

export function progressionConfigurationSelections(actor: ActorSheet, groups: ProgressionChoiceGroupDef[]): Record<string, string[]> {
  return Object.fromEntries(
    groups.map((group) => {
      const configuration = actor.build?.configurations?.find((entry) => entry.groupId === group.id);
      return [group.id, configuration?.pendingOptionIds ?? configuration?.activeOptionIds ?? []];
    })
  );
}

export function stageProgressionChoiceConfiguration(actor: ActorSheet, group: ProgressionChoiceGroupDef, optionIds: string[]): ActorSheet {
  if (optionIds.length > group.choose || new Set(optionIds).size !== optionIds.length) return actor;
  const selectedOptions = optionIds
    .map((optionId) => group.options.find((option) => option.id === optionId))
    .filter((option): option is ProgressionChoiceOption => Boolean(option));
  if (selectedOptions.length !== optionIds.length) return actor;
  const next: ActorSheet = JSON.parse(JSON.stringify(actor));
  const owner = findActorChoiceOwner(next, group.id);
  const pendingEffects = selectedOptions.flatMap((option) => compileChoiceOptionEffects(group, option, owner.source, owner.classLevel));
  const configurations = [...(next.build?.configurations ?? [])];
  const existingIndex = configurations.findIndex((entry) => entry.groupId === group.id);
  const existing = existingIndex >= 0 ? configurations[existingIndex] : undefined;
  const configuration: ProgressionConfiguration = {
    id: existing?.id ?? `configuration:${owner.instanceId ?? owner.ref}:${group.id}`,
    ownerRef: owner.ref,
    ownerInstanceId: owner.instanceId,
    groupId: group.id,
    trigger: group.cadence === "onShortRest" ? "shortOrLongRest" : "longRest",
    replacementLimit: group.replacementLimit ?? "all",
    activeOptionIds: existing?.activeOptionIds ?? [],
    activeEffects: existing?.activeEffects ?? [],
    pendingOptionIds: optionIds,
    pendingEffects
  };
  if (existingIndex >= 0) configurations[existingIndex] = configuration;
  else configurations.push(configuration);
  if (next.build) next.build = { ...next.build, schemaVersion: 3, configurations };
  return next;
}

export function stagePreparedSpellConfiguration(
  actor: ActorSheet,
  input: {
    ownerRef: string;
    ownerInstanceId: string;
    expectedCount: number;
    spells: Array<{ id: string; name: string; source: string }>;
    replacementLimit: number | "all";
  }
): ActorSheet {
  if (input.spells.length !== input.expectedCount) return actor;
  const next: ActorSheet = JSON.parse(JSON.stringify(actor));
  const configurations = [...(next.build?.configurations ?? [])];
  const existingIndex = configurations.findIndex(
    (entry) => entry.ownerInstanceId === input.ownerInstanceId && entry.groupId === "prepared-spells"
  );
  const existing = existingIndex >= 0 ? configurations[existingIndex] : undefined;
  if (existing && input.replacementLimit !== "all" && existing.activeOptionIds.length > 0) {
    const selectedIds = new Set(input.spells.map((spell) => spell.id));
    const replacedCount = existing.activeOptionIds.filter((spellId) => !selectedIds.has(spellId)).length;
    if (replacedCount > input.replacementLimit) return actor;
  }
  const id = existing?.id ?? `configuration:${input.ownerInstanceId}:prepared-spells`;
  const configuration: ProgressionConfiguration = {
    id,
    ownerRef: input.ownerRef,
    ownerInstanceId: input.ownerInstanceId,
    groupId: "prepared-spells",
    trigger: "longRest",
    replacementLimit: input.replacementLimit,
    activeOptionIds: existing?.activeOptionIds ?? [],
    activeEffects: existing?.activeEffects ?? [],
    pendingOptionIds: input.spells.map((spell) => spell.id),
    pendingEffects: input.spells.map((spell, index) => ({
      id: `${id}:pending-spell:${index}`,
      kind: "spell",
      ref: createCompendiumRef(spell.name, spell.source),
      bucket: "prepared"
    }))
  };
  if (existingIndex >= 0) configurations[existingIndex] = configuration;
  else configurations.push(configuration);
  if (next.build) next.build = { ...next.build, schemaVersion: 3, configurations };
  return next;
}

export function activatePendingPreparedSpellConfigurations(actor: ActorSheet): ActorSheet {
  const next: ActorSheet = JSON.parse(JSON.stringify(actor));
  const configurations = [...(next.build?.configurations ?? [])];
  configurations.forEach((configuration, index) => {
    if (configuration.groupId !== "prepared-spells" || !configuration.pendingOptionIds || !configuration.pendingEffects) return;
    removeOwnedEffects(next, configuration.activeEffects, configurations, configuration.id);
    configuration.pendingEffects.forEach((effect) => applyProgressionEffect(next, effect));
    configurations[index] = {
      ...configuration,
      activeOptionIds: configuration.pendingOptionIds,
      activeEffects: configuration.pendingEffects.map((effect, effectIndex) => ({
        ...effect,
        id: `${configuration.id}:spell:${effectIndex}`
      })),
      pendingOptionIds: undefined,
      pendingEffects: undefined,
      activatedAt: new Date().toISOString()
    };
  });
  if (next.build) next.build = { ...next.build, schemaVersion: 3, configurations };
  return next;
}

export type ConfigurableSpellBucket =
  | "known"
  | "prepared"
  | "spellbook"
  | "alwaysPrepared"
  | "atWill"
  | "perShortRest"
  | "perLongRest"
  | "available"
  | "alwaysPreparedAtWill"
  | "alwaysPreparedPerLongRest";

function configurableSpellEffects(
  configurationId: string,
  spells: Array<{ name: string; source: string }>,
  bucket: ConfigurableSpellBucket
): ProgressionEffect[] {
  const buckets =
    bucket === "alwaysPreparedAtWill"
      ? (["alwaysPrepared", "atWill"] as const)
      : bucket === "alwaysPreparedPerLongRest"
        ? (["alwaysPrepared", "perLongRest"] as const)
        : [bucket];
  return spells.flatMap((spell, spellIndex) =>
    buckets.map((effectBucket, bucketIndex) => ({
      id: `${configurationId}:spell:${spellIndex}:${bucketIndex}`,
      kind: "spell" as const,
      ref: createCompendiumRef(spell.name, spell.source),
      bucket: effectBucket
    }))
  );
}

export function applySpellChoiceConfiguration(
  actor: ActorSheet,
  input: {
    ownerRef: string;
    ownerInstanceId: string;
    groupId: string;
    trigger: "levelUp" | "longRest" | "shortOrLongRest";
    replacementLimit?: number | "all";
    expectedCount: number;
    bucket: ConfigurableSpellBucket;
    spells: Array<{ id: string; name: string; source: string }>;
  }
): ActorSheet {
  if (input.spells.length !== input.expectedCount) return actor;
  const next: ActorSheet = JSON.parse(JSON.stringify(actor));
  const configurations = [...(next.build?.configurations ?? [])];
  const existingIndex = configurations.findIndex(
    (entry) => entry.ownerInstanceId === input.ownerInstanceId && entry.groupId === input.groupId
  );
  const existing = existingIndex >= 0 ? configurations[existingIndex] : undefined;
  const replacementLimit = input.replacementLimit ?? "all";
  if (existing && replacementLimit !== "all") {
    const selected = new Set(input.spells.map((spell) => spell.id));
    if (existing.activeOptionIds.filter((optionId) => !selected.has(optionId)).length > replacementLimit) return actor;
  }
  const id = existing?.id ?? `configuration:${input.ownerInstanceId}:${input.groupId}`;
  if (existing) removeOwnedEffects(next, existing.activeEffects, configurations, existing.id);
  const activeEffects = configurableSpellEffects(id, input.spells, input.bucket);
  activeEffects.forEach((effect) => applyProgressionEffect(next, effect));
  const configuration: ProgressionConfiguration = {
    id,
    ownerRef: input.ownerRef,
    ownerInstanceId: input.ownerInstanceId,
    groupId: input.groupId,
    trigger: input.trigger,
    replacementLimit,
    requiredCount: input.expectedCount,
    activeOptionIds: input.spells.map((spell) => spell.id),
    activeEffects
  };
  if (existingIndex >= 0) configurations[existingIndex] = configuration;
  else configurations.push(configuration);
  if (next.build) next.build = { ...next.build, schemaVersion: 3, configurations };
  return next;
}

export function stageSpellChoiceConfiguration(
  actor: ActorSheet,
  input: {
    ownerRef: string;
    ownerInstanceId: string;
    groupId: string;
    trigger: "longRest" | "shortOrLongRest";
    expectedCount: number;
    bucket: ConfigurableSpellBucket;
    spells: Array<{ id: string; name: string; source: string }>;
  }
): ActorSheet {
  if (input.spells.length !== input.expectedCount) return actor;
  const next: ActorSheet = JSON.parse(JSON.stringify(actor));
  const configurations = [...(next.build?.configurations ?? [])];
  const existingIndex = configurations.findIndex(
    (entry) => entry.ownerInstanceId === input.ownerInstanceId && entry.groupId === input.groupId
  );
  const existing = existingIndex >= 0 ? configurations[existingIndex] : undefined;
  const id = existing?.id ?? `configuration:${input.ownerInstanceId}:${input.groupId}`;
  const configuration: ProgressionConfiguration = {
    id,
    ownerRef: input.ownerRef,
    ownerInstanceId: input.ownerInstanceId,
    groupId: input.groupId,
    trigger: input.trigger,
    replacementLimit: "all",
    requiredCount: input.expectedCount,
    activeOptionIds: existing?.activeOptionIds ?? [],
    activeEffects: existing?.activeEffects ?? [],
    pendingOptionIds: input.spells.map((spell) => spell.id),
    pendingEffects: configurableSpellEffects(id, input.spells, input.bucket)
  };
  if (existingIndex >= 0) configurations[existingIndex] = configuration;
  else configurations.push(configuration);
  if (next.build) next.build = { ...next.build, schemaVersion: 3, configurations };
  return next;
}

export function activatePendingSpellChoiceConfigurations(actor: ActorSheet, rest: "short" | "long"): ActorSheet {
  const next: ActorSheet = JSON.parse(JSON.stringify(actor));
  const configurations = [...(next.build?.configurations ?? [])];
  configurations.forEach((configuration, index) => {
    const eligibleTrigger = configuration.trigger === "shortOrLongRest" || (rest === "long" && configuration.trigger === "longRest");
    if (
      configuration.groupId === "prepared-spells" ||
      configuration.groupId === "weapon-masteries" ||
      !eligibleTrigger ||
      !configuration.pendingOptionIds ||
      !configuration.pendingEffects ||
      (configuration.requiredCount !== undefined && configuration.pendingOptionIds.length !== configuration.requiredCount)
    )
      return;
    removeOwnedEffects(next, configuration.activeEffects, configurations, configuration.id);
    configuration.pendingEffects.forEach((effect) => applyProgressionEffect(next, effect));
    configurations[index] = {
      ...configuration,
      activeOptionIds: configuration.pendingOptionIds,
      activeEffects: configuration.pendingEffects,
      pendingOptionIds: undefined,
      pendingEffects: undefined,
      activatedAt: new Date().toISOString()
    };
  });
  if (next.build) next.build = { ...next.build, schemaVersion: 3, configurations };
  return next;
}

function weaponMasteryEffects(configurationId: string, choices: ActorWeaponMastery[]): ProgressionEffect[] {
  return choices.map((value, index) => ({
    id: `${configurationId}:weapon-mastery:${index}`,
    kind: "weaponMastery",
    value
  }));
}

export function applyWeaponMasterySelections(
  actor: ActorSheet,
  input: {
    ownerRef: string;
    ownerInstanceId: string;
    expectedCount: number;
    choices: ActorWeaponMastery[];
  }
): ActorSheet {
  const next: ActorSheet = JSON.parse(JSON.stringify(actor));
  const configurations = [...(next.build?.configurations ?? [])];
  const existingIndex = configurations.findIndex(
    (entry) => entry.ownerInstanceId === input.ownerInstanceId && entry.groupId === "weapon-masteries"
  );
  const existing = existingIndex >= 0 ? configurations[existingIndex] : undefined;
  const currentChoices = (next.weaponMasteries ?? []).filter((entry) => entry.ownerInstanceId === input.ownerInstanceId);
  const mergedChoices = [...currentChoices, ...input.choices].filter(
    (entry, index, entries) => entries.findIndex((candidate) => candidate.weaponRef === entry.weaponRef) === index
  );
  if (mergedChoices.length !== input.expectedCount) return actor;
  const id = existing?.id ?? `configuration:${input.ownerInstanceId}:weapon-masteries`;
  if (existing) removeOwnedEffects(next, existing.activeEffects, configurations, existing.id);
  const activeEffects = weaponMasteryEffects(id, mergedChoices);
  activeEffects.forEach((effect) => applyProgressionEffect(next, effect));
  const configuration: ProgressionConfiguration = {
    id,
    ownerRef: input.ownerRef,
    ownerInstanceId: input.ownerInstanceId,
    groupId: "weapon-masteries",
    trigger: "longRest",
    replacementLimit: "all",
    activeOptionIds: mergedChoices.map((entry) => entry.weaponRef),
    activeEffects
  };
  if (existingIndex >= 0) configurations[existingIndex] = configuration;
  else configurations.push(configuration);
  if (next.build) next.build = { ...next.build, schemaVersion: 3, configurations };
  return next;
}

export function stageWeaponMasteryConfiguration(
  actor: ActorSheet,
  input: {
    ownerRef: string;
    ownerInstanceId: string;
    expectedCount: number;
    choices: ActorWeaponMastery[];
  }
): ActorSheet {
  if (input.choices.length > input.expectedCount) return actor;
  const next: ActorSheet = JSON.parse(JSON.stringify(actor));
  const configurations = [...(next.build?.configurations ?? [])];
  const existingIndex = configurations.findIndex(
    (entry) => entry.ownerInstanceId === input.ownerInstanceId && entry.groupId === "weapon-masteries"
  );
  const existing = existingIndex >= 0 ? configurations[existingIndex] : undefined;
  const id = existing?.id ?? `configuration:${input.ownerInstanceId}:weapon-masteries`;
  const configuration: ProgressionConfiguration = {
    id,
    ownerRef: input.ownerRef,
    ownerInstanceId: input.ownerInstanceId,
    groupId: "weapon-masteries",
    trigger: "longRest",
    replacementLimit: "all",
    requiredCount: input.expectedCount,
    activeOptionIds: existing?.activeOptionIds ?? [],
    activeEffects: existing?.activeEffects ?? [],
    pendingOptionIds: input.choices.map((entry) => entry.weaponRef),
    pendingEffects: weaponMasteryEffects(id, input.choices)
  };
  if (existingIndex >= 0) configurations[existingIndex] = configuration;
  else configurations.push(configuration);
  if (next.build) next.build = { ...next.build, schemaVersion: 3, configurations };
  return next;
}

export function activatePendingWeaponMasteryConfigurations(actor: ActorSheet): ActorSheet {
  const next: ActorSheet = JSON.parse(JSON.stringify(actor));
  const configurations = [...(next.build?.configurations ?? [])];
  configurations.forEach((configuration, index) => {
    if (
      configuration.groupId !== "weapon-masteries" ||
      !configuration.pendingOptionIds ||
      !configuration.pendingEffects ||
      (configuration.requiredCount !== undefined && configuration.pendingOptionIds.length !== configuration.requiredCount)
    )
      return;
    removeOwnedEffects(next, configuration.activeEffects, configurations, configuration.id);
    configuration.pendingEffects.forEach((effect) => applyProgressionEffect(next, effect));
    configurations[index] = {
      ...configuration,
      activeOptionIds: configuration.pendingOptionIds,
      activeEffects: configuration.pendingEffects,
      pendingOptionIds: undefined,
      pendingEffects: undefined,
      activatedAt: new Date().toISOString()
    };
  });
  if (next.build) next.build = { ...next.build, schemaVersion: 3, configurations };
  return next;
}

export function evaluateActorActivationChoices(actor: ActorSheet, groupId?: string): ProgressionChoiceGroupDef[] {
  const groups: ProgressionChoiceGroupDef[] = [];
  const seen = new Set<string>();
  actor.classes.forEach((actorClass) => {
    const classDef = findClassProgression(actorClass.compendiumId) ?? findClassProgression(actorClass.name);
    if (!classDef) return;
    const subclass = classDef.subclasses.find(
      (entry) =>
        entry.id === actorClass.subclassId || normalizeProgressionKey(entry.name) === normalizeProgressionKey(actorClass.subclassName ?? "")
    );
    for (let level = 1; level <= actorClass.level; level += 1) {
      const candidates = [...(classDef.levels[level]?.choices ?? []), ...(subclass?.levels[level]?.choices ?? [])];
      candidates.forEach((group) => {
        if (group.cadence !== "onActivation" || seen.has(group.id) || (groupId && group.id !== groupId)) return;
        seen.add(group.id);
        groups.push({
          ...group,
          options: [
            ...group.options,
            ...(group.optionSetIds ?? (group.optionSetId ? [group.optionSetId] : [])).flatMap(
              (domainId) => findProgressionChoiceDomain(domainId)?.options ?? []
            )
          ]
        });
      });
    }
  });
  return groups;
}

export function activateProgressionChoiceConfiguration(
  actor: ActorSheet,
  group: ProgressionChoiceGroupDef,
  optionIds: string[]
): ActorSheet {
  if (optionIds.length !== group.choose || new Set(optionIds).size !== optionIds.length) return actor;
  const next: ActorSheet = JSON.parse(JSON.stringify(actor));
  const owner = findActorChoiceOwner(next, group.id);
  const selectedOptions = optionIds
    .map((optionId) => group.options.find((option) => option.id === optionId))
    .filter((option): option is ProgressionChoiceOption => Boolean(option));
  if (selectedOptions.length !== group.choose) return actor;
  const effects = selectedOptions.flatMap((option) => compileChoiceOptionEffects(group, option, owner.source, owner.classLevel));
  const configurations = [...(next.build?.configurations ?? [])];
  const existingIndex = configurations.findIndex((entry) => entry.ownerInstanceId === owner.instanceId && entry.groupId === group.id);
  const existing = existingIndex >= 0 ? configurations[existingIndex] : undefined;
  if (existing && group.replacementLimit !== undefined && group.replacementLimit !== "all") {
    const selected = new Set(optionIds);
    const replaced = existing.activeOptionIds.filter((optionId) => !selected.has(optionId)).length;
    if (replaced > group.replacementLimit) return actor;
  }
  removeOwnedEffects(next, existing?.activeEffects ?? [], configurations, existing?.id);
  effects.forEach((effect) => applyProgressionEffect(next, effect));
  const configuration = {
    id: existing?.id ?? `configuration:${owner.instanceId ?? owner.ref}:${group.id}`,
    ownerRef: owner.ref,
    ownerInstanceId: owner.instanceId,
    groupId: group.id,
    trigger:
      group.cadence === "onShortRest"
        ? "shortOrLongRest"
        : group.cadence === "onActivation"
          ? "activation"
          : group.cadence === "onLongRest"
            ? "longRest"
            : "levelUp",
    replacementLimit: group.replacementLimit ?? "all",
    activeOptionIds: optionIds,
    activeEffects: effects,
    activatedAt: new Date().toISOString()
  } satisfies ProgressionConfiguration;
  if (existingIndex >= 0) configurations[existingIndex] = configuration;
  else configurations.push(configuration);
  removeInactiveDependentConfigurations(next, configurations, owner.instanceId, group.id, new Set(optionIds));
  if (next.build) next.build = { ...next.build, schemaVersion: 3, configurations };
  return next;
}

export function applyRestChoiceSelections(
  actor: ActorSheet,
  selections: Record<string, string[]>,
  restType: "short" | "long" = "long"
): ActorSheet {
  const next: ActorSheet = JSON.parse(JSON.stringify(actor));
  const availableGroups = evaluateActorRestChoices(actor, restType);
  const configurations = [...(next.build?.configurations ?? [])];

  availableGroups.forEach((group) => {
    const owner = findActorChoiceOwner(next, group.id);
    const existingIndex = configurations.findIndex((entry) => entry.ownerInstanceId === owner.instanceId && entry.groupId === group.id);
    const existing = existingIndex >= 0 ? configurations[existingIndex] : undefined;
    const selectedOptionIds = selections[group.id] ?? existing?.pendingOptionIds ?? existing?.activeOptionIds ?? [];
    if (selectedOptionIds.length !== group.choose || new Set(selectedOptionIds).size !== selectedOptionIds.length) return;
    const selectedOptions = selectedOptionIds
      .map((optionId) => group.options.find((option) => option.id === optionId))
      .filter((option): option is ProgressionChoiceOption => Boolean(option));
    if (selectedOptions.length !== group.choose) return;

    const effects = selectedOptions.flatMap((option) => compileChoiceOptionEffects(group, option, owner.source, owner.classLevel));
    removeOwnedEffects(next, existing?.activeEffects ?? [], configurations, existing?.id);
    effects.forEach((effect) => applyProgressionEffect(next, effect));
    const configuration = {
      id: existing?.id ?? `configuration:${owner.instanceId ?? owner.ref}:${group.id}`,
      ownerRef: owner.ref,
      ownerInstanceId: owner.instanceId,
      groupId: group.id,
      trigger: group.cadence === "onShortRest" ? ("shortOrLongRest" as const) : ("longRest" as const),
      replacementLimit: group.replacementLimit ?? "all",
      activeOptionIds: selectedOptionIds,
      activeEffects: effects,
      activatedAt: new Date().toISOString()
    };
    if (existingIndex >= 0) configurations[existingIndex] = configuration;
    else configurations.push(configuration);
  });

  if (next.build) next.build = { ...next.build, schemaVersion: 3, configurations };

  return next;
}

function findActorChoiceOwner(actor: ActorSheet, groupId: string) {
  for (const actorClass of actor.classes) {
    const classDef = findClassProgression(actorClass.compendiumId) ?? findClassProgression(actorClass.name);
    if (!classDef) continue;
    for (let level = 1; level <= actorClass.level; level += 1) {
      if (classDef.levels[level]?.choices?.some((group) => group.id === groupId)) {
        return {
          ref: createCompendiumRef(classDef.name, classDef.source),
          source: classDef.source,
          instanceId: actorClass.id,
          classLevel: actorClass.level
        };
      }
      const subclass = classDef.subclasses.find(
        (entry) => entry.id === actorClass.subclassId || entry.name.toLowerCase() === actorClass.subclassName?.toLowerCase()
      );
      if (subclass?.levels[level]?.choices?.some((group) => group.id === groupId)) {
        return {
          ref: createCompendiumRef(subclass.name, subclass.source),
          source: subclass.source,
          instanceId: actorClass.id,
          classLevel: actorClass.level
        };
      }
    }
  }
  return { ref: "Progression|XPHB", source: "XPHB", instanceId: undefined, classLevel: actor.level };
}

function removeInactiveDependentConfigurations(
  actor: ActorSheet,
  configurations: NonNullable<NonNullable<ActorSheet["build"]>["configurations"]>,
  ownerInstanceId: string | undefined,
  parentGroupId: string,
  selectedOptionIds: Set<string>
) {
  if (!ownerInstanceId) return;
  const actorClass = actor.classes.find((entry) => entry.id === ownerInstanceId);
  if (!actorClass) return;
  const classDef = findClassProgression(actorClass.compendiumId) ?? findClassProgression(actorClass.name);
  if (!classDef) return;
  const subclass = classDef.subclasses.find(
    (entry) => entry.id === actorClass.subclassId || entry.name.toLowerCase() === actorClass.subclassName?.toLowerCase()
  );
  const inactiveGroupIds = new Set<string>();
  for (let level = 1; level <= actorClass.level; level += 1) {
    const groups = [...(classDef.levels[level]?.choices ?? []), ...(subclass?.levels[level]?.choices ?? [])];
    groups.forEach((candidate) => {
      if (candidate.parentOption?.groupId === parentGroupId && !selectedOptionIds.has(candidate.parentOption.optionId)) {
        inactiveGroupIds.add(candidate.id);
      }
    });
  }
  for (let index = configurations.length - 1; index >= 0; index -= 1) {
    const configuration = configurations[index];
    if (configuration.ownerInstanceId !== ownerInstanceId || !inactiveGroupIds.has(configuration.groupId)) continue;
    removeOwnedEffects(actor, configuration.activeEffects, configurations, configuration.id);
    configurations.splice(index, 1);
  }
}

function compileChoiceOptionEffects(
  group: ProgressionChoiceGroupDef,
  option: ProgressionChoiceOption,
  source: string,
  classLevel: number
): ProgressionEffect[] {
  const grants = {
    ...materializeChoiceOptionGrants(option, classLevel),
    ...(group.optionGrantMode === "feature" ? { features: [option.name] } : {})
  };
  let index = 0;
  const id = () => `configuration:${group.id}:${option.id}:${index++}`;
  const ref = (name: string) => (parseCompendiumRef(name) ? name : createCompendiumRef(name, source));
  const effects: ProgressionEffect[] = [];
  (grants.features ?? []).forEach((name) => effects.push({ id: id(), kind: "feature", ref: ref(name) }));
  (grants.toolProficiencies ?? []).forEach((value) => effects.push({ id: id(), kind: "proficiency", proficiency: "tool", value }));
  (grants.languages ?? []).forEach((value) => effects.push({ id: id(), kind: "proficiency", proficiency: "language", value }));
  (grants.alwaysPreparedSpells ?? []).forEach((name) =>
    effects.push({ id: id(), kind: "spell", ref: ref(name), bucket: "alwaysPrepared" })
  );
  (grants.spellGrants ?? []).forEach((grant) => effects.push({ id: id(), kind: "spell", ref: grant.ref, bucket: grant.bucket }));
  (grants.actions ?? []).forEach((action) =>
    effects.push({
      id: id(),
      kind: "action",
      value: {
        id: action.id,
        name: action.name,
        attackBonus: 0,
        damage: action.roll?.diceFormula ?? "",
        damageType: action.roll?.damageType ?? "",
        notes: [action.range, action.duration, action.source].filter(Boolean).join(" • "),
        actionCost: action.actionCost,
        resourceCost: action.resourceCost,
        sourceRef: ref(action.name),
        range: action.range,
        duration: action.duration,
        activationChoiceGroupId: action.activationChoiceGroupId,
        usesTargetHitDie: action.roll?.usesTargetHitDie,
        addProficiencyBonus: action.roll?.addProficiencyBonus
      }
    })
  );
  return effects;
}

function materializeChoiceOptionGrants(option: ProgressionChoiceOption, classLevel: number) {
  const levelGrants = Object.entries(option.grantsByLevel ?? {})
    .filter(([level]) => Number(level) <= classLevel)
    .sort(([left], [right]) => Number(left) - Number(right));
  const grants: NonNullable<ProgressionChoiceOption["grants"]> = { ...(option.grants ?? {}) };
  levelGrants.forEach(([, additionalGrants]) => Object.assign(grants, additionalGrants));
  return grants;
}

function effectIdentity(effect: ProgressionEffect) {
  if (effect.kind === "spell") return `${effect.kind}:${effect.bucket}:${effect.ref}`;
  if ("ref" in effect) return `${effect.kind}:${effect.ref}`;
  if (effect.kind === "proficiency") return `${effect.kind}:${effect.proficiency}:${effect.value}`;
  if (effect.kind === "action") return `${effect.kind}:${effect.value.id}`;
  if (effect.kind === "weaponMastery") return `${effect.kind}:${effect.value.ownerInstanceId}:${effect.value.weaponRef}`;
  return `${effect.kind}:${effect.id}`;
}

function removeOwnedEffects(
  actor: ActorSheet,
  effects: ProgressionEffect[],
  configurations: NonNullable<ActorSheet["build"]>["configurations"],
  excludedConfigurationId?: string
) {
  const stillOwned = new Set(
    (configurations ?? [])
      .filter((configuration) => configuration.id !== excludedConfigurationId)
      .flatMap((configuration) => configuration.activeEffects)
      .map(effectIdentity)
  );
  const stillOwnedSpellRefs = new Set(
    (configurations ?? [])
      .filter((configuration) => configuration.id !== excludedConfigurationId)
      .flatMap((configuration) => configuration.activeEffects)
      .filter((effect): effect is Extract<ProgressionEffect, { kind: "spell" }> => effect.kind === "spell")
      .map((effect) => effect.ref)
  );
  effects.forEach((effect) => {
    if (stillOwned.has(effectIdentity(effect))) return;
    const name = "ref" in effect ? (parseCompendiumRef(effect.ref)?.name ?? effect.ref) : "";
    if (effect.kind === "feature") actor.features = actor.features.filter((entry) => entry !== name);
    if (effect.kind === "spell") {
      if (!stillOwnedSpellRefs.has(effect.ref)) actor.spells = actor.spells.filter((entry) => entry !== name);
      if (effect.bucket === "prepared") actor.preparedSpells = actor.preparedSpells.filter((entry) => entry !== name);
      else if (effect.bucket === "available") {
        actor.spellState.available = (actor.spellState.available ?? []).filter((entry) => entry !== name);
      } else if (effect.bucket !== "known") {
        actor.spellState[effect.bucket] = actor.spellState[effect.bucket].filter((entry) => entry !== name);
      }
    }
    if (effect.kind === "proficiency" && effect.proficiency === "tool") {
      actor.toolProficiencies = actor.toolProficiencies.filter((entry) => entry !== effect.value);
    }
    if (effect.kind === "proficiency" && effect.proficiency === "language") {
      actor.languageProficiencies = actor.languageProficiencies.filter((entry) => entry !== effect.value);
    }
    if (effect.kind === "action") actor.attacks = actor.attacks.filter((entry) => entry.id !== effect.value.id);
    if (effect.kind === "weaponMastery") {
      actor.weaponMasteries = (actor.weaponMasteries ?? []).filter(
        (entry) => entry.ownerInstanceId !== effect.value.ownerInstanceId || entry.weaponRef !== effect.value.weaponRef
      );
    }
  });
}

function applyProgressionEffect(actor: ActorSheet, effect: ProgressionEffect) {
  const name = "ref" in effect ? (parseCompendiumRef(effect.ref)?.name ?? effect.ref) : "";
  if (effect.kind === "feature") actor.features = Array.from(new Set([...actor.features, name]));
  if (effect.kind === "spell") {
    actor.spells = Array.from(new Set([...actor.spells, name]));
    if (effect.bucket === "prepared") actor.preparedSpells = Array.from(new Set([...actor.preparedSpells, name]));
    else if (effect.bucket === "available") actor.spellState.available = Array.from(new Set([...(actor.spellState.available ?? []), name]));
    else if (effect.bucket !== "known") actor.spellState[effect.bucket] = Array.from(new Set([...actor.spellState[effect.bucket], name]));
  }
  if (effect.kind === "proficiency" && effect.proficiency === "tool") {
    actor.toolProficiencies = Array.from(new Set([...actor.toolProficiencies, effect.value]));
  }
  if (effect.kind === "proficiency" && effect.proficiency === "language") {
    actor.languageProficiencies = Array.from(new Set([...actor.languageProficiencies, effect.value]));
  }
  if (effect.kind === "action" && !actor.attacks.some((entry) => entry.id === effect.value.id)) actor.attacks.push(effect.value);
  if (effect.kind === "weaponMastery") {
    actor.weaponMasteries = [
      ...(actor.weaponMasteries ?? []).filter(
        (entry) => entry.ownerInstanceId !== effect.value.ownerInstanceId || entry.weaponRef !== effect.value.weaponRef
      ),
      effect.value
    ];
  }
}
