import { evaluateActorSubclassAlwaysPreparedSpells } from "@shared/rules/progressionEngine";
import {
  findBackgroundProgression,
  findClassProgression,
  findFeatProgression,
  findSpeciesProgression,
  type ProgressionChoiceOption
} from "@shared/data/progression";
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
  CompendiumChoiceOption,
  CompendiumSpeciesEntry,
  FeatEntry,
  InventoryEntry,
  PlayerNpcBuildSelection,
  ResourceEntry,
  SpellEntry,
  SpellSlotTrack
} from "@shared/types";

import type {
  GuidedChoiceSpec,
  GuidedEquipmentGroup,
  GuidedFlowMode,
  GuidedSetupState,
  GuidedSpeciesChoiceGroup
} from "../playerNpcSheet2024Types";
import { abilityModifierTotal, cloneActor, findCompendiumClass, normalizeKey, totalLevel } from "../sheetUtils";
import {
  collectGuidedFeatures,
  deriveBackgroundAbilityConfig,
  deriveBackgroundEquipmentGroups,
  deriveBackgroundSkillProficiencies,
  deriveClassResources,
  deriveGuidedAbilityChoiceSlots,
  deriveOriginFeatOptions,
  deriveSpeciesSkillProficiencies,
  deriveSpellSlots,
  mergeAbilityKeys,
  mergeDerivedResources,
  mergeTextValues,
  normalizeHitPoints,
  selectGuidedAbilityChoiceMode,
  syncBuildClasses
} from "./playerNpcSheet2024Selectors";
import { hasProgressionFieldOverride } from "@shared/rules/progressionEngine";

export function finalizeDraftForSave(
  actor: ActorSheet,
  derived: {
    armorClass: number;
    proficiencyBonus: number;
    speed: number;
    hitPointMax: number;
    spellSlots: SpellSlotTrack[];
    resources: ResourceEntry[];
    featureNames: string[];
    preparedSpellLimit: number;
    preparableSpellNames: string[];
  }
) {
  const next = cloneActor(actor);
  next.className = next.classes.map((entry) => entry.name).join(" / ") || next.className;
  next.level = totalLevel(next);
  if (!hasProgressionFieldOverride(next, "proficiencyBonus")) next.proficiencyBonus = derived.proficiencyBonus;
  if (!hasProgressionFieldOverride(next, "armorClass")) next.armorClass = derived.armorClass;
  if (!hasProgressionFieldOverride(next, "speed")) next.speed = derived.speed;
  next.hitPoints = normalizeHitPoints(
    {
      ...next.hitPoints,
      max: hasProgressionFieldOverride(next, "hitPointMax") ? next.hitPoints.max : derived.hitPointMax || next.hitPoints.max
    },
    hasProgressionFieldOverride(next, "hitPointMax") ? next.hitPoints.max : derived.hitPointMax || next.hitPoints.max
  );
  next.hitDice = next.classes.map((entry) => `${entry.level}d${entry.hitDieFaces}`).join(" + ");
  next.spellSlots = derived.spellSlots;
  next.resources = derived.resources;
  next.features = mergeTextValues([], derived.featureNames);
  next.preparedSpells = next.preparedSpells
    .filter((entry) => derived.preparableSpellNames.some((name) => normalizeKey(name) === normalizeKey(entry)))
    .slice(0, derived.preparedSpellLimit > 0 ? derived.preparedSpellLimit : next.preparedSpells.length);
  return next;
}

export function applySpeciesToActor(actor: ActorSheet, species: CompendiumSpeciesEntry | null) {
  if (!species) {
    return actor;
  }

  const next = cloneActor(actor);
  const progression = findSpeciesProgression(species.id) ?? findSpeciesProgression(species.name);
  next.species = species.name;
  next.speed = progression?.speed ?? next.speed;
  next.creatureSize = normalizeSpeciesSize(progression?.sizes[0]) ?? next.creatureSize;
  next.visionRange =
    progression && progression.darkvision > 0 ? Math.max(next.visionRange, Math.round(progression.darkvision / 5)) : next.visionRange;
  next.languageProficiencies = mergeTextValues(next.languageProficiencies, progression?.languages ?? []);
  next.features = mergeTextValues(next.features, progression?.features ?? []);
  next.build = {
    ruleset: "dnd-2024",
    schemaVersion: 2,
    mode: next.build?.mode ?? "guided",
    classes: next.build?.classes ?? [],
    selections: next.build?.selections ?? [],
    awards: next.build?.awards ?? [],
    overrides: next.build?.overrides ?? [],
    speciesId: species.id,
    speciesName: species.name,
    speciesSource: species.source,
    backgroundId: next.build?.backgroundId,
    backgroundName: next.build?.backgroundName,
    backgroundSource: next.build?.backgroundSource
  };
  return next;
}

export function applyGuideBaseAbilities(actor: ActorSheet, abilities: ActorSheet["abilities"]) {
  const next = cloneActor(actor);
  next.abilities = {
    str: normalizeGuideAbilityScore(abilities.str),
    dex: normalizeGuideAbilityScore(abilities.dex),
    con: normalizeGuideAbilityScore(abilities.con),
    int: normalizeGuideAbilityScore(abilities.int),
    wis: normalizeGuideAbilityScore(abilities.wis),
    cha: normalizeGuideAbilityScore(abilities.cha)
  };
  return next;
}

export function applySpeciesChoiceSelections(
  actor: ActorSheet,
  species: CompendiumSpeciesEntry | null,
  feats: FeatEntry[],
  skillNames: string[],
  featId: string
) {
  if (!species) {
    return actor;
  }

  const next = cloneActor(actor);
  applySkillChoiceSelections(next, [...deriveSpeciesSkillProficiencies(species), ...skillNames]);

  if (featId.trim()) {
    const featEntry =
      feats.find((entry) => entry.id === featId) ?? feats.find((entry) => normalizeKey(entry.name) === normalizeKey(featId));

    if (featEntry && !next.feats.includes(featEntry.name)) {
      next.feats.push(featEntry.name);
    }
  }

  return next;
}

export function applySpeciesChoiceGroupSelections(
  actor: ActorSheet,
  species: CompendiumSpeciesEntry | null,
  groups: GuidedSpeciesChoiceGroup[],
  selectedChoiceIds: Record<string, string>,
  spells: SpellEntry[]
) {
  if (!species || groups.length === 0) {
    return actor;
  }

  const next = cloneActor(actor);
  const selections: PlayerNpcBuildSelection[] = [];

  groups.forEach((group) => {
    const selectedOption = group.options.find((option) => option.id === selectedChoiceIds[group.id]);

    if (!selectedOption) {
      return;
    }

    if (selectedOption.featureName) {
      next.features = mergeTextValues(next.features, [selectedOption.featureName]);
    }

    if (selectedOption.speedOverride) {
      next.speed = Math.max(next.speed, selectedOption.speedOverride);
    }

    if (selectedOption.visionRangeOverride) {
      next.visionRange = Math.max(next.visionRange, selectedOption.visionRangeOverride);
    }

    if (selectedOption.spellNames?.length) {
      next.spells = mergeTextValues(next.spells, resolveSpellNames(selectedOption.spellNames, spells));
    }

    if (selectedOption.alwaysPreparedSpellNames?.length) {
      next.spellState = {
        ...next.spellState,
        alwaysPrepared: mergeTextValues(next.spellState.alwaysPrepared, resolveSpellNames(selectedOption.alwaysPreparedSpellNames, spells))
      };
    }

    selections.push(
      createBuildSelection(
        "custom",
        1,
        undefined,
        `${species.name} ${group.label}`,
        species.source,
        [selectedOption.label, selectedOption.description].filter(Boolean).join(" - ")
      )
    );
  });

  next.build = {
    ruleset: "dnd-2024",
    schemaVersion: 2,
    mode: next.build?.mode ?? "guided",
    classes: next.build?.classes ?? [],
    speciesId: next.build?.speciesId,
    speciesName: next.build?.speciesName,
    speciesSource: next.build?.speciesSource,
    backgroundId: next.build?.backgroundId,
    backgroundName: next.build?.backgroundName,
    backgroundSource: next.build?.backgroundSource,
    selections: [...(next.build?.selections ?? []), ...selections],
    awards: next.build?.awards ?? [],
    overrides: next.build?.overrides ?? []
  };

  return next;
}

export function applyBackgroundToActor(
  actor: ActorSheet,
  background: CompendiumBackgroundEntry | null,
  feats: FeatEntry[],
  options?: {
    featId?: string;
    abilityChoices?: AbilityKey[];
    abilityChoiceModeId?: string;
    equipmentChoiceIds?: Record<string, string>;
    skillChoices?: string[];
  }
) {
  if (!background) {
    return actor;
  }

  const next = cloneActor(actor);
  const backgroundProgression = findBackgroundProgression(background.id) ?? findBackgroundProgression(background.name);
  next.background = background.name;
  next.build = {
    ruleset: "dnd-2024",
    schemaVersion: 2,
    mode: next.build?.mode ?? "guided",
    classes: next.build?.classes ?? [],
    selections: next.build?.selections ?? [],
    awards: next.build?.awards ?? [],
    overrides: next.build?.overrides ?? [],
    speciesId: next.build?.speciesId,
    speciesName: next.build?.speciesName,
    speciesSource: next.build?.speciesSource,
    backgroundId: background.id,
    backgroundName: background.name,
    backgroundSource: background.source
  };

  deriveBackgroundSkillProficiencies(background).forEach((skillName) => {
    const skillIndex = next.skills.findIndex((entry) => normalizeKey(entry.name) === normalizeKey(skillName));

    if (skillIndex >= 0) {
      next.skills[skillIndex] = {
        ...next.skills[skillIndex],
        proficient: true
      };
    }
  });
  applySkillChoiceSelections(next, options?.skillChoices ?? []);
  next.toolProficiencies = mergeTextValues(next.toolProficiencies, backgroundProgression?.toolProficiencies ?? []);

  const abilityConfig = deriveBackgroundAbilityConfig(background);
  const abilityMode = selectGuidedAbilityChoiceMode(abilityConfig, options?.abilityChoiceModeId ?? "");
  const abilitySlots = deriveGuidedAbilityChoiceSlots(abilityMode);
  const selectedAbilities = normalizeBackgroundAbilityChoices(options?.abilityChoices ?? [], abilitySlots);
  selectedAbilities.forEach((abilityKey, index) => {
    next.abilities[abilityKey] += abilitySlots[index]?.amount ?? 0;
  });

  const featIds =
    options?.featId && options.featId.trim() ? [options.featId] : deriveOriginFeatOptions(background, feats).map((entry) => entry.id);
  featIds.forEach((featId) => {
    const featEntry =
      feats.find((entry) => entry.id === featId) ?? feats.find((entry) => normalizeKey(entry.name) === normalizeKey(featId));
    const featName = featEntry?.name ?? featId;

    if (!next.feats.includes(featName)) {
      next.feats.push(featName);
    }
  });

  return applyEquipmentSelectionsToActor(next, deriveBackgroundEquipmentGroups(background), options?.equipmentChoiceIds ?? {});
}

export function applyEquipmentSelectionsToActor(
  actor: ActorSheet,
  groups: GuidedEquipmentGroup[],
  selectedChoiceIds: Record<string, string>
) {
  if (groups.length === 0) {
    return actor;
  }

  const next = cloneActor(actor);

  groups.forEach((group) => {
    const selectedOption = group.options.find((option) => option.id === selectedChoiceIds[group.id]) ?? group.options[0];

    selectedOption?.items.forEach((item) => {
      if (item.currency) {
        next.currency = {
          pp: next.currency.pp + (item.currency.pp ?? 0),
          gp: next.currency.gp + (item.currency.gp ?? 0),
          ep: next.currency.ep + (item.currency.ep ?? 0),
          sp: next.currency.sp + (item.currency.sp ?? 0),
          cp: next.currency.cp + (item.currency.cp ?? 0)
        };
        return;
      }

      const existingItem = next.inventory.find((entry) => normalizeKey(entry.name) === normalizeKey(item.name));

      if (existingItem) {
        existingItem.quantity += item.quantity;
        return;
      }

      next.inventory.push({
        id: crypto.randomUUID(),
        name: item.name,
        quantity: item.quantity,
        type: item.type ?? "gear",
        equipped: item.equipped,
        notes: item.notes
      });
    });
  });

  return next;
}

export function applyClassSkillChoicesToActor(actor: ActorSheet, skillNames: string[]) {
  const next = cloneActor(actor);
  applySkillChoiceSelections(next, skillNames);
  return next;
}

export function applyClassToActor(actor: ActorSheet, classEntry: ClassEntry, classes: ClassEntry[], existingActorClassId?: string) {
  const progressionDefinition = findClassProgression(classEntry.name) ?? findClassProgression(classEntry.id);
  if (!progressionDefinition) return actor;
  const next = cloneActor(actor);
  const addingMulticlass = !existingActorClassId && next.classes.length > 0;
  const existingActorClass = existingActorClassId ? (next.classes.find((entry) => entry.id === existingActorClassId) ?? null) : null;
  const preserveSubclass = existingActorClass?.compendiumId === classEntry.id ? existingActorClass : null;
  const spellcastingAbility = Object.values(progressionDefinition.levels).find((level) => level.spellcasting?.spellcastingAbility)
    ?.spellcasting?.spellcastingAbility;
  const nextActorClass: ActorClassEntry = {
    id: existingActorClassId ?? crypto.randomUUID(),
    compendiumId: classEntry.id,
    name: progressionDefinition.name,
    source: progressionDefinition.source,
    subclassId: preserveSubclass?.subclassId ?? "",
    subclassName: preserveSubclass?.subclassName ?? "",
    subclassSource: preserveSubclass?.subclassSource ?? "",
    level: existingActorClass?.level ?? 1,
    hitDieFaces: progressionDefinition.hitDieFaces,
    usedHitDice: existingActorClass?.usedHitDice ?? 0,
    spellcastingAbility: spellcastingAbility ?? null
  };
  const existingIndex = existingActorClassId ? next.classes.findIndex((entry) => entry.id === existingActorClassId) : -1;

  if (existingIndex >= 0) {
    next.classes[existingIndex] = nextActorClass;
  } else {
    next.classes.push(nextActorClass);
  }

  next.className = next.classes.map((entry) => entry.name).join(" / ");
  if (spellcastingAbility) {
    next.spellcastingAbility = spellcastingAbility;
  }
  if (!addingMulticlass) {
    next.savingThrowProficiencies = mergeAbilityKeys(next.savingThrowProficiencies, progressionDefinition.savingThrows);
    next.armorProficiencies = mergeTextValues(next.armorProficiencies ?? [], progressionDefinition.armorProficiencies);
    next.weaponProficiencies = mergeTextValues(next.weaponProficiencies ?? [], progressionDefinition.weaponProficiencies);
    next.toolProficiencies = mergeTextValues(next.toolProficiencies, progressionDefinition.toolProficiencies);
  } else {
    next.armorProficiencies = mergeTextValues(
      next.armorProficiencies ?? [],
      progressionDefinition.multiclassing.proficienciesGranted.armor ?? []
    );
    next.weaponProficiencies = mergeTextValues(
      next.weaponProficiencies ?? [],
      progressionDefinition.multiclassing.proficienciesGranted.weapons ?? []
    );
    next.toolProficiencies = mergeTextValues(next.toolProficiencies, progressionDefinition.multiclassing.proficienciesGranted.tools ?? []);
  }

  next.features = mergeTextValues(next.features, collectGuidedFeatures(next, classes));
  next.spellSlots = deriveSpellSlots(next, classes);
  next.hitDice = next.classes.map((entry) => `${entry.level}d${entry.hitDieFaces}`).join(" + ");
  next.resources = mergeDerivedResources(next.resources, deriveClassResources(next, classes));
  if (totalLevel(next) === 1) {
    const startingHp = Math.max(1, progressionDefinition.hitDieFaces + abilityModifierTotal(next, "con"));
    next.hitPoints = normalizeHitPoints(
      {
        ...next.hitPoints,
        max: startingHp,
        current: Math.min(Math.max(next.hitPoints.current, startingHp), startingHp)
      },
      startingHp
    );
  }
  next.build = {
    ruleset: "dnd-2024",
    schemaVersion: 2,
    mode: next.build?.mode ?? "guided",
    speciesId: next.build?.speciesId,
    speciesName: next.build?.speciesName,
    speciesSource: next.build?.speciesSource,
    backgroundId: next.build?.backgroundId,
    backgroundName: next.build?.backgroundName,
    backgroundSource: next.build?.backgroundSource,
    selections: next.build?.selections ?? [],
    awards: next.build?.awards ?? [],
    overrides: next.build?.overrides ?? [],
    classes: syncBuildClasses(next.classes, next.build?.classes ?? [])
  };

  return next;
}

export function assignSubclassToActor(actor: ActorSheet, classes: ClassEntry[], actorClassId: string, subclassId: string) {
  const actorClass = actor.classes.find((entry) => entry.id === actorClassId);
  const classEntry = actorClass ? findCompendiumClass(actorClass, classes) : null;
  const subclass = classEntry?.subclasses.find((entry) => entry.id === subclassId);
  const classDefinition = actorClass ? (findClassProgression(actorClass.compendiumId) ?? findClassProgression(actorClass.name)) : null;
  const subclassDefinition = classDefinition?.subclasses.find(
    (entry) => entry.id === subclassId || normalizeKey(entry.name) === normalizeKey(subclass?.name ?? "")
  );

  if (!actorClass || !classEntry || !subclass || !subclassDefinition) {
    return actor;
  }

  const next = cloneActor(actor);
  next.classes = next.classes.map((entry) =>
    entry.id === actorClassId
      ? {
          ...entry,
          subclassId: subclassDefinition.id,
          subclassName: subclassDefinition.name,
          subclassSource: subclassDefinition.source
        }
      : entry
  );
  next.features = mergeTextValues(next.features, collectGuidedFeatures(next, classes, { [actorClassId]: subclassId }));
  next.build = {
    ruleset: "dnd-2024",
    schemaVersion: 2,
    mode: next.build?.mode ?? "guided",
    speciesId: next.build?.speciesId,
    speciesName: next.build?.speciesName,
    speciesSource: next.build?.speciesSource,
    backgroundId: next.build?.backgroundId,
    backgroundName: next.build?.backgroundName,
    backgroundSource: next.build?.backgroundSource,
    selections: next.build?.selections ?? [],
    awards: next.build?.awards ?? [],
    overrides: next.build?.overrides ?? [],
    classes: (next.build?.classes ?? syncBuildClasses(next.classes, [])).map((entry) =>
      entry.id === actorClassId
        ? {
            ...entry,
            subclassId: subclassDefinition.id,
            subclassName: subclassDefinition.name,
            subclassSource: subclassDefinition.source
          }
        : entry
    )
  };
  return next;
}

export function applyGuideSelectionsToActor(
  actor: ActorSheet,
  params: {
    compendium: CampaignSnapshot["compendium"];
    setup: GuidedSetupState;
    spec: GuidedChoiceSpec;
    level: number;
    targetClass: ClassEntry;
    targetActorClassId: string | null;
    mode: GuidedFlowMode;
  }
) {
  const next = cloneActor(actor);
  const selections: PlayerNpcBuildSelection[] = [];

  params.setup.classFeatIds.slice(0, params.spec.classFeatCount).forEach((featId) => {
    const feat = params.compendium.feats.find((entry) => entry.id === featId);
    if (!feat) {
      return;
    }

    next.feats = mergeTextValues(next.feats, [feat.name]);
    selections.push(createBuildSelection("feat", params.level, feat.id, feat.name, feat.source, `${params.targetClass.name} guide choice`));
  });

  params.setup.optionalFeatureIds.slice(0, params.spec.optionalFeatureCount).forEach((featureId) => {
    const feature = params.compendium.optionalFeatures.find((entry) => entry.id === featureId);
    if (!feature) {
      return;
    }

    next.features = mergeTextValues(next.features, [feature.name]);
    selections.push(
      createBuildSelection(
        "optionalFeature",
        params.level,
        feature.id,
        feature.name,
        feature.source,
        `${params.targetClass.name} guide choice`
      )
    );
  });

  params.setup.cantripIds.slice(0, params.spec.cantripCount).forEach((spellId) => {
    const spell = params.compendium.spells.find((entry) => entry.id === spellId);
    if (!spell) {
      return;
    }

    next.spells = mergeTextValues(next.spells, [spell.name]);
    selections.push(createBuildSelection("spell", params.level, spell.id, spell.name, spell.source, "Guide cantrip"));
  });

  params.setup.knownSpellIds.slice(0, params.spec.knownSpellCount).forEach((spellId) => {
    const spell = params.compendium.spells.find((entry) => entry.id === spellId);
    if (!spell) {
      return;
    }

    next.spells = mergeTextValues(next.spells, [spell.name]);
    selections.push(createBuildSelection("spell", params.level, spell.id, spell.name, spell.source, "Guide spell"));
  });

  params.setup.spellbookSpellIds.slice(0, params.spec.spellbookCount).forEach((spellId) => {
    const spell = params.compendium.spells.find((entry) => entry.id === spellId);
    if (!spell) {
      return;
    }

    next.spellState = {
      ...next.spellState,
      spellbook: mergeTextValues(next.spellState.spellbook, [spell.name])
    };
    selections.push(createBuildSelection("spell", params.level, spell.id, spell.name, spell.source, "Guide spellbook"));
  });

  if (params.setup.preparedSpellIds && params.setup.preparedSpellIds.length > 0) {
    const chosenNames = params.setup.preparedSpellIds
      .map((id) => params.compendium.spells.find((s) => s.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    if (chosenNames.length > 0) {
      next.preparedSpells = mergeTextValues(next.preparedSpells, chosenNames);
    }
  }

  if (params.setup.languageChoices && params.setup.languageChoices.length > 0) {
    next.languageProficiencies = mergeTextValues(next.languageProficiencies, params.setup.languageChoices);
  }

  if (params.setup.speciesSizeChoice) {
    next.creatureSize = params.setup.speciesSizeChoice.toLowerCase() as ActorSheet["creatureSize"];
  }

  next.spellSlots = deriveSpellSlots(next, params.compendium.classes);

  params.setup.expertiseSkillChoices.slice(0, params.spec.expertiseCount).forEach((skillName) => {
    const skillIndex = next.skills.findIndex((entry) => normalizeKey(entry.name) === normalizeKey(skillName));
    if (skillIndex < 0) {
      return;
    }

    next.skills[skillIndex] = {
      ...next.skills[skillIndex],
      proficient: true,
      expertise: true
    };
    selections.push(createBuildSelection("custom", params.level, undefined, skillName, params.targetClass.source, "Guide expertise"));
  });

  if (params.spec.abilityImprovementCount > 0) {
    if (params.setup.asiMode === "feat" && params.setup.asiFeatId.trim()) {
      const feat = params.compendium.feats.find((entry) => entry.id === params.setup.asiFeatId);
      if (feat) {
        next.feats = mergeTextValues(next.feats, [feat.name]);
        selections.push(createBuildSelection("feat", params.level, feat.id, feat.name, feat.source, "Ability Score Improvement / Feat"));
      }
    } else if (params.setup.asiMode === "ability") {
      if (params.setup.asiAbilityMode === "+2" && params.setup.asiAbilityChoices[0]) {
        const abilityKey = params.setup.asiAbilityChoices[0];
        next.abilities[abilityKey] = Math.min(20, next.abilities[abilityKey] + 2);
        selections.push(
          createBuildSelection(
            "custom",
            params.level,
            undefined,
            "Ability Score Improvement (+2)",
            params.targetClass.source,
            `+2 ${abilityKey.toUpperCase()}`
          )
        );
      } else if (params.setup.asiAbilityMode === "+1+1") {
        const choices = params.setup.asiAbilityChoices.slice(0, 2).filter(Boolean);
        choices.forEach((abilityKey) => {
          next.abilities[abilityKey] = Math.min(20, next.abilities[abilityKey] + 1);
        });
        selections.push(
          createBuildSelection(
            "custom",
            params.level,
            undefined,
            "Ability Score Improvement (+1/+1)",
            params.targetClass.source,
            choices.map((k) => `+1 ${k.toUpperCase()}`).join(", ")
          )
        );
      }
    }
  }

  if (params.spec.weaponMasteryCount > 0 && params.setup.weaponMasteryChoices.length > 0) {
    const masteries = params.setup.weaponMasteryChoices.slice(0, params.spec.weaponMasteryCount).filter(Boolean);
    if (masteries.length > 0) {
      next.features = mergeTextValues(
        next.features,
        masteries.map((m) => `Weapon Mastery: ${m}`)
      );
      selections.push(
        createBuildSelection("custom", params.level, undefined, "Weapon Mastery", params.targetClass.source, masteries.join(", "))
      );
    }
  }

  // Apply Scripted Class Feature Choices (e.g. Holy Order, Primal Order, Blessed Strikes)
  (params.spec.classChoiceGroups ?? []).forEach((group: CompendiumChoiceGroup) => {
    if (group.parentOption && !(params.setup.classChoiceIds?.[group.parentOption.groupId] ?? []).includes(group.parentOption.optionId)) {
      return;
    }
    const selectedOptionIds = params.setup.classChoiceIds?.[group.id] ?? [];
    selectedOptionIds.forEach((optId: string) => {
      const option = group.options.find((o: CompendiumChoiceOption) => o.id === optId);
      if (!option) return;

      if (option.grants?.features) {
        next.features = mergeTextValues(next.features, option.grants.features);
      }
      if (option.grants?.spells) {
        next.spells = mergeTextValues(next.spells, option.grants.spells);
      }
      if (option.grants?.alwaysPreparedSpells) {
        next.spellState = {
          ...next.spellState,
          alwaysPrepared: mergeTextValues(next.spellState.alwaysPrepared, option.grants.alwaysPreparedSpells)
        };
      }
      if (option.grants?.attacks) {
        next.attacks = [...next.attacks, ...option.grants.attacks];
      }
      if (option.grants?.skills) {
        option.grants.skills.forEach((skName: string) => {
          const sIdx = next.skills.findIndex((s) => normalizeKey(s.name) === normalizeKey(skName));
          if (sIdx >= 0) next.skills[sIdx] = { ...next.skills[sIdx], proficient: true };
        });
      }
      if (option.grants?.expertise) {
        option.grants.expertise.forEach((skName: string) => {
          const sIdx = next.skills.findIndex((s) => normalizeKey(s.name) === normalizeKey(skName));
          if (sIdx >= 0) next.skills[sIdx] = { ...next.skills[sIdx], proficient: true, expertise: true };
        });
      }
      if (option.grants?.tools) {
        next.toolProficiencies = mergeTextValues(next.toolProficiencies, option.grants.tools);
      }
      if (option.grants?.languages) {
        next.languageProficiencies = mergeTextValues(next.languageProficiencies, option.grants.languages);
      }
      if (option.grants?.armorProficiencies) {
        next.armorProficiencies = mergeTextValues(next.armorProficiencies ?? [], option.grants.armorProficiencies);
      }
      if (option.grants?.weaponProficiencies) {
        next.weaponProficiencies = mergeTextValues(next.weaponProficiencies ?? [], option.grants.weaponProficiencies);
      }
      if (option.grants?.savingThrows) {
        next.savingThrowProficiencies = Array.from(new Set([...next.savingThrowProficiencies, ...option.grants.savingThrows]));
      }
      if (option.grants?.abilities) {
        Object.entries(option.grants.abilities).forEach(([k, v]) => {
          if (k in next.abilities && typeof v === "number") {
            next.abilities[k as AbilityKey] = Math.min(20, next.abilities[k as AbilityKey] + v);
          }
        });
      }
      if (option.grants?.masteries) {
        next.features = mergeTextValues(
          next.features,
          option.grants.masteries.map((m: string) => `Weapon Mastery: ${m}`)
        );
      }
      applyPassiveBonuses(next, option.grants?.passiveBonuses, params.targetClass.source);

      selections.push(
        createBuildSelection(
          "custom",
          params.level,
          undefined,
          `${group.label}: ${option.label}`,
          params.targetClass.source,
          option.description || ""
        )
      );
    });
  });

  // Apply Scripted Feat Subchoices (e.g. Magic Initiate, Skill Expert, Resilient)
  Object.entries(params.setup.featChoiceMap ?? {}).forEach(([featId, choiceGroupsMap]) => {
    const feat = params.compendium.feats.find((f) => f.id === featId);
    const groups: CompendiumChoiceGroup[] = params.spec.featChoiceGroups?.[featId] ?? [];
    groups.forEach((group: CompendiumChoiceGroup) => {
      const selectedOptionIds = choiceGroupsMap[group.id] ?? [];
      selectedOptionIds.forEach((optId: string) => {
        const option = group.options.find((o: CompendiumChoiceOption) => o.id === optId);
        if (!option) return;

        if (option.grants?.features) {
          next.features = mergeTextValues(next.features, option.grants.features);
        }
        if (option.grants?.spells) {
          next.spells = mergeTextValues(next.spells, option.grants.spells);
        }
        if (option.grants?.alwaysPreparedSpells) {
          next.spellState.alwaysPrepared = mergeTextValues(next.spellState.alwaysPrepared, option.grants.alwaysPreparedSpells);
        }
        (option.grants?.skills ?? []).forEach((name) => {
          const index = next.skills.findIndex((skill) => normalizeKey(skill.name) === normalizeKey(name));
          if (index >= 0) next.skills[index] = { ...next.skills[index], proficient: true };
        });
        (option.grants?.expertise ?? []).forEach((name) => {
          const index = next.skills.findIndex((skill) => normalizeKey(skill.name) === normalizeKey(name));
          if (index >= 0) next.skills[index] = { ...next.skills[index], proficient: true, expertise: true };
        });
        next.toolProficiencies = mergeTextValues(next.toolProficiencies, option.grants?.tools ?? []);
        next.languageProficiencies = mergeTextValues(next.languageProficiencies, option.grants?.languages ?? []);
        next.armorProficiencies = mergeTextValues(next.armorProficiencies, option.grants?.armorProficiencies ?? []);
        next.weaponProficiencies = mergeTextValues(next.weaponProficiencies, option.grants?.weaponProficiencies ?? []);
        applyPassiveBonuses(next, option.grants?.passiveBonuses, feat?.source ?? "XPHB");
        if (option.grants?.savingThrows) {
          next.savingThrowProficiencies = Array.from(new Set([...next.savingThrowProficiencies, ...option.grants.savingThrows]));
        }
        if (option.grants?.abilities) {
          Object.entries(option.grants.abilities).forEach(([k, v]) => {
            if (k in next.abilities && typeof v === "number") {
              next.abilities[k as AbilityKey] = Math.min(20, next.abilities[k as AbilityKey] + v);
            }
          });
        }
        selections.push(
          createBuildSelection(
            "custom",
            params.level,
            undefined,
            `${feat?.name ?? "Feat"}: ${option.label}`,
            feat?.source ?? "PHB",
            option.description || ""
          )
        );
      });
    });
  });

  const selectedFeatIds = Array.from(
    new Set(
      [
        ...params.setup.classFeatIds,
        params.setup.originFeatId,
        params.setup.speciesOriginFeatId,
        params.setup.asiMode === "feat" ? params.setup.asiFeatId : ""
      ].filter(Boolean)
    )
  );
  selectedFeatIds.forEach((featId) => {
    const feat = params.compendium.feats.find((entry) => entry.id === featId);
    if (!feat) return;
    const definition = findFeatProgression(feat.id) ?? findFeatProgression(feat.name);
    if (!definition) return;
    next.feats = mergeTextValues(next.feats, [feat.name]);
    applyProgressionGrants(
      next,
      {
        ...definition.grants,
        features: mergeTextValues(definition.features ?? [], definition.grants?.features ?? []),
        actions: definition.actions
      },
      definition.source
    );
  });

  const subclassAlwaysPrepared = evaluateActorSubclassAlwaysPreparedSpells(next);
  if (subclassAlwaysPrepared.length > 0) {
    next.spellState = {
      ...next.spellState,
      alwaysPrepared: mergeTextValues(next.spellState.alwaysPrepared, subclassAlwaysPrepared)
    };
    next.spells = mergeTextValues(next.spells, subclassAlwaysPrepared);
  }

  const targetActorClass = params.targetActorClassId
    ? next.classes.find((entry) => entry.id === params.targetActorClassId)
    : next.classes.find((entry) => entry.compendiumId === params.targetClass.id);
  const progressionDefinition = findClassProgression(params.targetClass.name) ?? findClassProgression(params.targetClass.id);
  const progressionLevel = progressionDefinition?.levels[targetActorClass?.level ?? 1];
  applyProgressionGrants(next, progressionLevel?.grants, params.targetClass.source);
  const subclassDefinition = progressionDefinition?.subclasses.find(
    (entry) => entry.id === targetActorClass?.subclassId || normalizeKey(entry.name) === normalizeKey(targetActorClass?.subclassName ?? "")
  );
  applyProgressionGrants(
    next,
    subclassDefinition?.levels[targetActorClass?.level ?? 1]?.grants,
    subclassDefinition?.source ?? params.targetClass.source
  );

  next.build = {
    ruleset: "dnd-2024",
    schemaVersion: 2,
    mode: next.build?.mode ?? "guided",
    speciesId: next.build?.speciesId,
    speciesName: next.build?.speciesName,
    speciesSource: next.build?.speciesSource,
    backgroundId: next.build?.backgroundId,
    backgroundName: next.build?.backgroundName,
    backgroundSource: next.build?.backgroundSource,
    classes: syncBuildClasses(next.classes, next.build?.classes ?? []),
    selections: [...(next.build?.selections ?? []), ...selections],
    awards: next.build?.awards ?? [],
    overrides: next.build?.overrides ?? []
  };

  return next;
}

function applyProgressionGrants(actor: ActorSheet, grants: ProgressionChoiceOption["grants"] | undefined, source: string) {
  if (!grants) return;
  actor.features = mergeTextValues(actor.features, grants.features ?? []);
  actor.armorProficiencies = mergeTextValues(actor.armorProficiencies ?? [], grants.armorProficiencies ?? []);
  actor.weaponProficiencies = mergeTextValues(actor.weaponProficiencies ?? [], grants.weaponProficiencies ?? []);
  actor.toolProficiencies = mergeTextValues(actor.toolProficiencies, grants.toolProficiencies ?? []);
  actor.languageProficiencies = mergeTextValues(actor.languageProficiencies, grants.languages ?? []);
  actor.savingThrowProficiencies = Array.from(new Set([...actor.savingThrowProficiencies, ...(grants.savingThrows ?? [])]));
  actor.spells = mergeTextValues(actor.spells, grants.alwaysPreparedSpells ?? []);
  actor.spellState.alwaysPrepared = mergeTextValues(actor.spellState.alwaysPrepared, grants.alwaysPreparedSpells ?? []);
  (grants.skills ?? []).forEach((name) => {
    const index = actor.skills.findIndex((skill) => normalizeKey(skill.name) === normalizeKey(name));
    if (index >= 0) actor.skills[index] = { ...actor.skills[index], proficient: true };
  });
  (grants.expertise ?? []).forEach((name) => {
    const index = actor.skills.findIndex((skill) => normalizeKey(skill.name) === normalizeKey(name));
    if (index >= 0) actor.skills[index] = { ...actor.skills[index], proficient: true, expertise: true };
  });
  Object.entries(grants.abilities ?? {}).forEach(([ability, amount]) => {
    if (typeof amount === "number") actor.abilities[ability as AbilityKey] = Math.min(20, actor.abilities[ability as AbilityKey] + amount);
  });
  (grants.actions ?? []).forEach((action) => {
    if (actor.attacks.some((entry) => entry.id === action.id)) return;
    actor.attacks.push({
      id: action.id,
      name: action.name,
      attackBonus: 0,
      damage: action.roll?.diceFormula ?? "",
      damageType: action.roll?.damageType ?? "",
      notes: [action.actionCost, action.range, action.duration, source].filter(Boolean).join(" • ")
    });
  });
  applyPassiveBonuses(actor, grants.passiveBonuses, source);
}

function applyPassiveBonuses(actor: ActorSheet, bonuses: NonNullable<ProgressionChoiceOption["grants"]>["passiveBonuses"], source: string) {
  (bonuses ?? []).forEach((bonus) => {
    const id = `progression:${source}:${bonus.target}:${bonus.skillName ?? bonus.ability ?? ""}`;
    if (actor.bonuses.some((entry) => entry.id === id)) return;
    actor.bonuses.push({
      id,
      name: `${source} progression`,
      sourceType: "buff",
      targetType: bonus.target,
      targetKey: bonus.skillName ?? bonus.ability ?? "",
      value: bonus.bonus ?? 0,
      statBonus: bonus.statBonus,
      minimum: bonus.minBonus,
      enabled: true
    });
  });
}

function applySkillChoiceSelections(actor: ActorSheet, skillNames: string[]) {
  mergeTextValues([], skillNames).forEach((skillName) => {
    const skillIndex = actor.skills.findIndex((entry) => normalizeKey(entry.name) === normalizeKey(skillName));

    if (skillIndex >= 0) {
      actor.skills[skillIndex] = {
        ...actor.skills[skillIndex],
        proficient: true
      };
    }
  });
}

function resolveSpellNames(spellNames: string[], spells: SpellEntry[]) {
  return spellNames.map((spellName) => spells.find((entry) => normalizeKey(entry.name) === normalizeKey(spellName))?.name ?? spellName);
}

function normalizeGuideAbilityScore(value: number) {
  if (!Number.isFinite(value)) {
    return 10;
  }

  return Math.max(1, Math.min(20, Math.round(value)));
}

function normalizeBackgroundAbilityChoices(current: AbilityKey[], slots: Array<{ abilities: AbilityKey[] }>) {
  const next: AbilityKey[] = [];

  slots.forEach((slot, index) => {
    const currentChoice = current[index];

    if (currentChoice && slot.abilities.includes(currentChoice) && !next.includes(currentChoice)) {
      next.push(currentChoice);
      return;
    }

    const fallbackChoice = slot.abilities.find((ability) => !next.includes(ability)) ?? slot.abilities[0];

    if (fallbackChoice) {
      next.push(fallbackChoice);
    }
  });

  return next;
}

export function createBuildSelection(
  kind: PlayerNpcBuildSelection["kind"],
  level: number,
  compendiumId: string | undefined,
  name: string,
  source: string,
  notes: string
): PlayerNpcBuildSelection {
  return {
    id: crypto.randomUUID(),
    kind,
    level,
    compendiumId,
    name,
    source,
    notes
  };
}

export function buildD20Notation(modifier: number, mode: "normal" | "advantage" | "disadvantage") {
  const base = mode === "advantage" ? "2d20kh1" : mode === "disadvantage" ? "2d20kl1" : "1d20";
  return modifier >= 0 ? `${base}+${modifier}` : `${base}${modifier}`;
}

export function buildStaticRollNotation(total: number) {
  return `1d20*0+${Math.max(0, Math.round(total))}`;
}

export function updateHitPoints(
  key: keyof ActorSheet["hitPoints"],
  value: string,
  updateDraft: (recipe: (current: ActorSheet) => ActorSheet) => void,
  baseMaxOverride?: number
) {
  updateDraft((current) => {
    const nextHitPoints = normalizeHitPoints(
      {
        ...current.hitPoints,
        [key]: Number(value || 0)
      },
      baseMaxOverride ?? (key === "max" ? Number(value || 0) : current.hitPoints.max)
    );

    return {
      ...current,
      hitPoints: nextHitPoints
    };
  });
}

export function createAttackEntry(): AttackEntry {
  return {
    id: crypto.randomUUID(),
    name: "",
    attackBonus: 0,
    damage: "",
    damageType: "",
    notes: ""
  };
}

export function createArmorEntry(): ArmorEntry {
  return {
    id: crypto.randomUUID(),
    name: "",
    kind: "armor",
    armorClass: 10,
    maxDexBonus: null,
    bonus: 0,
    equipped: false,
    notes: ""
  };
}

export function createResourceEntry(): ResourceEntry {
  return {
    id: crypto.randomUUID(),
    name: "",
    current: 0,
    max: 0,
    resetOn: "",
    restoreAmount: 0
  };
}

export function createInventoryEntry(): InventoryEntry {
  return {
    id: crypto.randomUUID(),
    name: "",
    type: "gear",
    quantity: 1,
    equipped: false,
    notes: ""
  };
}

export function rollDie(faces: number) {
  return Math.floor(Math.random() * faces) + 1;
}

function normalizeSpeciesSize(value: string | undefined): ActorSheet["creatureSize"] | null {
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
