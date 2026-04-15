import type {
  AbilityKey,
  ActorClassEntry,
  ActorSheet,
  ArmorEntry,
  AttackEntry,
  CampaignSnapshot,
  ClassEntry,
  CompendiumBackgroundEntry,
  CompendiumSpeciesEntry,
  FeatEntry,
  InventoryEntry,
  PlayerNpcBuildSelection,
  ResourceEntry,
  SpellSlotTrack
} from "@shared/types";

import type { GuidedChoiceSpec, GuidedFlowMode, GuidedSetupState } from "../playerNpcSheet2024Types";
import {
  abilityModifierTotal,
  cloneActor,
  findCompendiumClass,
  normalizeKey,
  totalLevel
} from "../sheetUtils";
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
  syncBuildClasses,
  toAbilityKey
} from "./playerNpcSheet2024Selectors";

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
  next.proficiencyBonus = derived.proficiencyBonus;
  next.armorClass = derived.armorClass;
  next.speed = derived.speed;
  next.hitPoints = normalizeHitPoints(
    {
      ...next.hitPoints,
      max: derived.hitPointMax || next.hitPoints.max
    },
    derived.hitPointMax || next.hitPoints.max
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
  next.species = species.name;
  next.speed = species.speed || next.speed;
  next.creatureSize = normalizeSpeciesSize(species.sizes[0]) ?? next.creatureSize;
  next.visionRange = species.darkvision > 0 ? Math.max(next.visionRange, Math.round(species.darkvision / 5)) : next.visionRange;
  next.languageProficiencies = mergeTextValues(next.languageProficiencies, species.languages);
  next.build = {
    ruleset: "dnd-2024",
    mode: next.build?.mode ?? "guided",
    classes: next.build?.classes ?? [],
    selections: next.build?.selections ?? [],
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
    const featEntry = feats.find((entry) => entry.id === featId) ?? feats.find((entry) => normalizeKey(entry.name) === normalizeKey(featId));

    if (featEntry && !next.feats.includes(featEntry.name)) {
      next.feats.push(featEntry.name);
    }
  }

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
  next.background = background.name;
  next.build = {
    ruleset: "dnd-2024",
    mode: next.build?.mode ?? "guided",
    classes: next.build?.classes ?? [],
    selections: next.build?.selections ?? [],
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
  next.toolProficiencies = mergeTextValues(next.toolProficiencies, background.toolProficiencies);
  next.languageProficiencies = mergeTextValues(next.languageProficiencies, background.languageProficiencies);

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
    const featEntry = feats.find((entry) => entry.id === featId) ?? feats.find((entry) => normalizeKey(entry.name) === normalizeKey(featId));
    const featName = featEntry?.name ?? featId;

    if (!next.feats.includes(featName)) {
      next.feats.push(featName);
    }
  });

  deriveBackgroundEquipmentGroups(background).forEach((group) => {
    const selectedOptionId = options?.equipmentChoiceIds?.[group.id];
    const selectedOption = group.options.find((entry) => entry.id === selectedOptionId) ?? group.options[0];

    selectedOption?.items.forEach((item) => {
      if (next.inventory.some((entry) => normalizeKey(entry.name) === normalizeKey(item.name))) {
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
  const next = cloneActor(actor);
  const existingActorClass = existingActorClassId ? next.classes.find((entry) => entry.id === existingActorClassId) ?? null : null;
  const preserveSubclass = existingActorClass?.compendiumId === classEntry.id ? existingActorClass : null;
  const nextActorClass: ActorClassEntry = {
    id: existingActorClassId ?? crypto.randomUUID(),
    compendiumId: classEntry.id,
    name: classEntry.name,
    source: classEntry.source,
    subclassId: preserveSubclass?.subclassId ?? "",
    subclassName: preserveSubclass?.subclassName ?? "",
    subclassSource: preserveSubclass?.subclassSource ?? "",
    level: existingActorClass?.level ?? 1,
    hitDieFaces: classEntry.hitDieFaces,
    usedHitDice: existingActorClass?.usedHitDice ?? 0,
    spellcastingAbility: classEntry.spellcastingAbility
  };
  const existingIndex = existingActorClassId ? next.classes.findIndex((entry) => entry.id === existingActorClassId) : -1;

  if (existingIndex >= 0) {
    next.classes[existingIndex] = nextActorClass;
  } else {
    next.classes.push(nextActorClass);
  }

  next.className = next.classes.map((entry) => entry.name).join(" / ");
  if (classEntry.spellcastingAbility) {
    next.spellcastingAbility = classEntry.spellcastingAbility;
  }
  next.savingThrowProficiencies = mergeAbilityKeys(
    next.savingThrowProficiencies,
    classEntry.savingThrowProficiencies.map(toAbilityKey).filter((entry): entry is AbilityKey => Boolean(entry))
  );
  next.toolProficiencies = mergeTextValues(next.toolProficiencies, classEntry.startingProficiencies.tools);

  next.features = mergeTextValues(next.features, collectGuidedFeatures(next, classes));
  next.spellSlots = deriveSpellSlots(next, classes);
  next.hitDice = next.classes.map((entry) => `${entry.level}d${entry.hitDieFaces}`).join(" + ");
  next.resources = mergeDerivedResources(next.resources, deriveClassResources(next, classes));
  if (totalLevel(next) === 1) {
    const startingHp = Math.max(1, classEntry.hitDieFaces + abilityModifierTotal(next, "con"));
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
    mode: next.build?.mode ?? "guided",
    speciesId: next.build?.speciesId,
    speciesName: next.build?.speciesName,
    speciesSource: next.build?.speciesSource,
    backgroundId: next.build?.backgroundId,
    backgroundName: next.build?.backgroundName,
    backgroundSource: next.build?.backgroundSource,
    selections: next.build?.selections ?? [],
    classes: syncBuildClasses(next.classes, next.build?.classes ?? [])
  };

  return next;
}

export function assignSubclassToActor(actor: ActorSheet, classes: ClassEntry[], actorClassId: string, subclassId: string) {
  const actorClass = actor.classes.find((entry) => entry.id === actorClassId);
  const classEntry = actorClass ? findCompendiumClass(actorClass, classes) : null;
  const subclass = classEntry?.subclasses.find((entry) => entry.id === subclassId);

  if (!actorClass || !classEntry || !subclass) {
    return actor;
  }

  const next = cloneActor(actor);
  next.classes = next.classes.map((entry) =>
    entry.id === actorClassId
      ? {
          ...entry,
          subclassId: subclass.id,
          subclassName: subclass.name,
          subclassSource: subclass.source
        }
      : entry
  );
  next.features = mergeTextValues(next.features, collectGuidedFeatures(next, classes, { [actorClassId]: subclassId }));
  next.build = {
    ruleset: "dnd-2024",
    mode: next.build?.mode ?? "guided",
    speciesId: next.build?.speciesId,
    speciesName: next.build?.speciesName,
    speciesSource: next.build?.speciesSource,
    backgroundId: next.build?.backgroundId,
    backgroundName: next.build?.backgroundName,
    backgroundSource: next.build?.backgroundSource,
    selections: next.build?.selections ?? [],
    classes: (next.build?.classes ?? syncBuildClasses(next.classes, [])).map((entry) =>
      entry.id === actorClassId
        ? {
            ...entry,
            subclassId: subclass.id,
            subclassName: subclass.name,
            subclassSource: subclass.source
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

  params.setup.classFeatIds
    .slice(0, params.spec.classFeatCount)
    .forEach((featId) => {
      const feat = params.compendium.feats.find((entry) => entry.id === featId);
      if (!feat) {
        return;
      }

      next.feats = mergeTextValues(next.feats, [feat.name]);
      selections.push(createBuildSelection("feat", params.level, feat.id, feat.name, feat.source, `${params.targetClass.name} guide choice`));
    });

  params.setup.optionalFeatureIds
    .slice(0, params.spec.optionalFeatureCount)
    .forEach((featureId) => {
      const feature = params.compendium.optionalFeatures.find((entry) => entry.id === featureId);
      if (!feature) {
        return;
      }

      next.features = mergeTextValues(next.features, [feature.name]);
      selections.push(createBuildSelection("optionalFeature", params.level, feature.id, feature.name, feature.source, `${params.targetClass.name} guide choice`));
    });

  params.setup.cantripIds
    .slice(0, params.spec.cantripCount)
    .forEach((spellId) => {
      const spell = params.compendium.spells.find((entry) => entry.id === spellId);
      if (!spell) {
        return;
      }

      next.spells = mergeTextValues(next.spells, [spell.name]);
      selections.push(createBuildSelection("spell", params.level, spell.id, spell.name, spell.source, "Guide cantrip"));
    });

  params.setup.knownSpellIds
    .slice(0, params.spec.knownSpellCount)
    .forEach((spellId) => {
      const spell = params.compendium.spells.find((entry) => entry.id === spellId);
      if (!spell) {
        return;
      }

      next.spells = mergeTextValues(next.spells, [spell.name]);
      selections.push(createBuildSelection("spell", params.level, spell.id, spell.name, spell.source, "Guide spell"));
    });

  params.setup.spellbookSpellIds
    .slice(0, params.spec.spellbookCount)
    .forEach((spellId) => {
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

  params.setup.expertiseSkillChoices
    .slice(0, params.spec.expertiseCount)
    .forEach((skillName) => {
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
        selections.push(createBuildSelection("feat", params.level, feat.id, feat.name, feat.source, "Ability Score Improvement"));
      }
    } else if (params.setup.asiMode === "ability") {
      params.setup.asiAbilityChoices.slice(0, params.spec.abilityImprovementCount * 2).forEach((abilityKey) => {
        next.abilities[abilityKey] += 1;
      });
      selections.push(
        createBuildSelection(
          "custom",
          params.level,
          undefined,
          "Ability Score Improvement",
          params.targetClass.source,
          params.setup.asiAbilityChoices.slice(0, params.spec.abilityImprovementCount * 2).map((entry) => entry.toUpperCase()).join(", ")
        )
      );
    }
  }

  next.build = {
    ruleset: "dnd-2024",
    mode: next.build?.mode ?? "guided",
    speciesId: next.build?.speciesId,
    speciesName: next.build?.speciesName,
    speciesSource: next.build?.speciesSource,
    backgroundId: next.build?.backgroundId,
    backgroundName: next.build?.backgroundName,
    backgroundSource: next.build?.backgroundSource,
    classes: syncBuildClasses(next.classes, next.build?.classes ?? []),
    selections: [...(next.build?.selections ?? []), ...selections]
  };

  return next;
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
