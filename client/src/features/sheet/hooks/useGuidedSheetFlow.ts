import { findBaseClassProgression } from "@shared/data/progression";
import { createProgressionAwardFromActorDelta } from "@shared/rules/progressionEngine";
import type { AbilityKey, ActorSheet } from "@shared/types";
import { useEffect, useMemo, useState } from "react";

import type {
  GuidedAbilityChoiceConfig,
  GuidedAbilityChoiceMode,
  GuidedAbilityChoiceSlot,
  GuidedChoiceSpec,
  GuidedEquipmentGroup,
  GuidedFlowMode,
  GuidedSetupState,
  GuidedSkillChoiceConfig,
  GuidedSpeciesChoiceGroup,
  PlayerNpcSheet2024Props
} from "../playerNpcSheet2024Types";
import { NEW_GUIDED_CLASS_ID } from "../playerNpcSheet2024Types";
import {
  applyBackgroundToActor,
  applyClassSkillChoicesToActor,
  applyClassToActor,
  applyEquipmentSelectionsToActor,
  applyGuideBaseAbilities,
  applyGuideSelectionsToActor,
  applySpeciesChoiceGroupSelections,
  applySpeciesChoiceSelections,
  applySpeciesToActor,
  assignSubclassToActor,
  rollDie
} from "../selectors/playerNpcSheet2024Mutations";
import {
  backgroundForId,
  collectGuidedFeatures,
  deriveBackgroundAbilityConfig,
  deriveBackgroundEquipmentGroups,
  deriveBackgroundSkillChoiceConfig,
  deriveClassEquipmentGroups,
  deriveClassResources,
  deriveClassSkillChoiceConfig,
  deriveGuidedAbilityChoiceSlots,
  deriveGuidedChoiceSpec,
  deriveOriginFeatOptions,
  deriveSpeciesChoiceGroups,
  deriveSpeciesOriginFeatOptions,
  deriveSpeciesSkillChoiceConfig,
  deriveSpellSlots,
  effectiveHitPointMax,
  featMeetsProgressionPrerequisites,
  mergeDerivedResources,
  mergeTextValues,
  padGuideSelections,
  selectGuidedAbilityChoiceMode,
  syncBuildClasses,
  validateGuideSelections
} from "../selectors/playerNpcSheet2024Selectors";
import { abilityModifierTotal, cloneActor, findCompendiumClass, normalizeKey, totalLevel } from "../sheetUtils";

const emptyGuidedSetup: GuidedSetupState = {
  speciesId: "",
  backgroundId: "",
  classId: "",
  subclassId: "",
  baseAbilities: {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10
  },
  backgroundAbilityModeId: "",
  hpMode: "average",
  rolledHp: null,
  classFeatIds: [],
  optionalFeatureIds: [],
  classChoiceIds: {},
  featChoiceMap: {},
  cantripIds: [],
  knownSpellIds: [],
  spellbookSpellIds: [],
  preparedSpellIds: [],
  expertiseSkillChoices: [],
  weaponMasteryChoices: [],
  asiMode: "feat",
  asiAbilityMode: "+2",
  asiFeatId: "",
  asiAbilityChoices: [],
  speciesSkillChoices: [],
  backgroundSkillChoices: [],
  classSkillChoices: [],
  languageChoices: ["Common"],
  speciesSizeChoice: "Medium",
  speciesOriginFeatId: "",
  speciesChoiceIds: {},
  originFeatId: "",
  equipmentChoiceIds: {},
  abilityChoices: []
};

function collectAwardChoices(setup: GuidedSetupState, spec: GuidedChoiceSpec) {
  const activeClassGroupIds = new Set(
    spec.classChoiceGroups
      .filter(
        (group) => !group.parentOption || (setup.classChoiceIds[group.parentOption.groupId] ?? []).includes(group.parentOption.optionId)
      )
      .map((group) => group.id)
  );
  const choices = Object.entries(setup.classChoiceIds)
    .filter(([groupId]) => activeClassGroupIds.has(groupId))
    .map(([groupId, optionIds]) => ({ groupId, optionIds }));
  Object.values(setup.featChoiceMap).forEach((groups) => {
    Object.entries(groups).forEach(([groupId, optionIds]) => choices.push({ groupId, optionIds }));
  });
  Object.entries(setup.speciesChoiceIds).forEach(([groupId, optionId]) => choices.push({ groupId, optionIds: [optionId] }));
  Object.entries(setup.equipmentChoiceIds).forEach(([groupId, optionId]) => choices.push({ groupId, optionIds: [optionId] }));
  const append = (groupId: string, optionIds: string[]) => {
    const normalized = optionIds.filter(Boolean);
    if (normalized.length > 0) choices.push({ groupId, optionIds: normalized });
  };
  append("setup:species", [setup.speciesId]);
  append("setup:background", [setup.backgroundId]);
  append("setup:class", [setup.classId]);
  append("setup:subclass", [setup.subclassId]);
  append("setup:species-skills", setup.speciesSkillChoices);
  append("setup:background-skills", setup.backgroundSkillChoices);
  append("setup:background-ability-mode", [setup.backgroundAbilityModeId]);
  append("setup:background-abilities", setup.abilityChoices);
  append(
    "setup:base-abilities",
    (Object.entries(setup.baseAbilities) as Array<[AbilityKey, number]>).map(([ability, score]) => `${ability}:${score}`)
  );
  append("setup:class-skills", setup.classSkillChoices);
  append("setup:expertise", setup.expertiseSkillChoices);
  append("setup:languages", setup.languageChoices);
  append("setup:weapon-masteries", setup.weaponMasteryChoices);
  append("setup:class-feats", setup.classFeatIds);
  append("setup:optional-features", setup.optionalFeatureIds);
  append("setup:cantrips", setup.cantripIds);
  append("setup:known-spells", setup.knownSpellIds);
  append("setup:spellbook", setup.spellbookSpellIds);
  append("setup:prepared-spells", setup.preparedSpellIds);
  append("setup:origin-feat", [setup.originFeatId]);
  append("setup:species-origin-feat", [setup.speciesOriginFeatId]);
  append("setup:asi-feat", setup.asiMode === "feat" ? [setup.asiFeatId] : []);
  append("setup:asi-abilities", setup.asiMode === "ability" ? setup.asiAbilityChoices : []);
  return choices;
}

function collectAwardReferences(compendium: PlayerNpcSheet2024Props["compendium"]) {
  return [
    ...compendium.feats,
    ...compendium.spells,
    ...compendium.optionalFeatures,
    ...compendium.items,
    ...compendium.classes.flatMap((entry) => [...entry.features, ...entry.subclasses.flatMap((subclass) => subclass.features)])
  ].map((entry) => ({ name: entry.name, source: entry.source }));
}

const defaultGuideAbilityCycle: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

function normalizeGuideBaseAbilities(current: ActorSheet["abilities"]) {
  const normalizeScore = (value: number) => (Number.isFinite(value) ? Math.max(1, Math.min(20, Math.round(value))) : 10);

  return {
    str: normalizeScore(current.str),
    dex: normalizeScore(current.dex),
    con: normalizeScore(current.con),
    int: normalizeScore(current.int),
    wis: normalizeScore(current.wis),
    cha: normalizeScore(current.cha)
  };
}

function normalizeGuideSelections(current: string[], count: number, options: string[]) {
  const filtered = current.filter((entry, index) => options.includes(entry) && current.indexOf(entry) === index);
  return padGuideSelections(filtered, count, options);
}

function normalizeGuideAbilityChoices(current: AbilityKey[], slots: GuidedAbilityChoiceSlot[]) {
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

function normalizeGuideEquipmentChoiceIds(current: Record<string, string>, groups: GuidedEquipmentGroup[]) {
  return Object.fromEntries(
    groups.map((group) => {
      const currentChoice = current[group.id];
      const selectedChoice = group.options.some((option) => option.id === currentChoice) ? currentChoice : (group.options[0]?.id ?? "");
      return [group.id, selectedChoice];
    })
  );
}

function normalizeGuideSpeciesChoiceIds(current: Record<string, string>, groups: GuidedSpeciesChoiceGroup[]) {
  return Object.fromEntries(
    groups.map((group) => {
      const currentChoice = current[group.id];
      const selectedChoice = group.options.some((option) => option.id === currentChoice) ? currentChoice : (group.options[0]?.id ?? "");
      return [group.id, selectedChoice];
    })
  );
}

function shallowEqualArray<T>(left: T[], right: T[]) {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function shallowEqualRecord(left: Record<string, string>, right: Record<string, string>) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  return leftKeys.length === rightKeys.length && leftKeys.every((key) => left[key] === right[key]);
}

function shallowEqualAbilities(left: ActorSheet["abilities"], right: ActorSheet["abilities"]) {
  return (
    left.str === right.str &&
    left.dex === right.dex &&
    left.con === right.con &&
    left.int === right.int &&
    left.wis === right.wis &&
    left.cha === right.cha
  );
}

export interface GuidedSheetFlowState {
  guidedFlowOpen: boolean;
  guidedFlowMode: GuidedFlowMode;
  guidedClassId: string;
  guideError: string | null;
  guidedSetup: GuidedSetupState;
  guidedSelectedSpecies: PlayerNpcSheet2024Props["compendium"]["races"][number] | null;
  guidedSelectedBackground: PlayerNpcSheet2024Props["compendium"]["backgrounds"][number] | null;
  guidedSelectedClass: PlayerNpcSheet2024Props["compendium"]["classes"][number] | null;
  guidedChoiceSpec: GuidedChoiceSpec;
  guidedSpeciesSkillChoiceConfig: GuidedSkillChoiceConfig;
  guidedBackgroundSkillChoiceConfig: GuidedSkillChoiceConfig;
  guidedClassSkillChoiceConfig: GuidedSkillChoiceConfig;
  guidedSpeciesOriginFeatOptions: PlayerNpcSheet2024Props["compendium"]["feats"];
  guidedSpeciesChoiceGroups: GuidedSpeciesChoiceGroup[];
  guidedAbilityChoiceConfig: GuidedAbilityChoiceConfig;
  guidedAbilityChoiceMode: GuidedAbilityChoiceMode | null;
  guidedAbilityChoiceSlots: GuidedAbilityChoiceSlot[];
  guidedOriginFeatOptions: PlayerNpcSheet2024Props["compendium"]["feats"];
  guidedFeatOptions: PlayerNpcSheet2024Props["compendium"]["feats"];
  guidedEquipmentGroups: GuidedEquipmentGroup[];
  selectedGuideFeats: PlayerNpcSheet2024Props["compendium"]["feats"];
  selectedGuideOptionalFeatures: PlayerNpcSheet2024Props["compendium"]["optionalFeatures"];
  selectedGuideSpells: PlayerNpcSheet2024Props["compendium"]["spells"];
  setGuidedSetup: React.Dispatch<React.SetStateAction<GuidedSetupState>>;
  setGuidedClassId: (value: string) => void;
  openGuidedFlow: (mode: GuidedFlowMode) => void;
  closeGuidedFlow: () => void;
  applySpecies: (speciesId: string) => void;
  applyBackground: (
    backgroundId: string,
    options?: {
      featId?: string;
      abilityChoices?: AbilityKey[];
      abilityChoiceModeId?: string;
      equipmentChoiceIds?: Record<string, string>;
    }
  ) => void;
  applyClass: (classId: string, existingActorClassId?: string) => void;
  applySubclass: (actorClassId: string, subclassId: string) => void;
  confirmGuidedSetup: () => ActorSheet | null;
  confirmGuidedLevelUp: () => ActorSheet | null;
}

interface UseGuidedSheetFlowParams {
  actor: ActorSheet;
  draft: ActorSheet;
  compendium: PlayerNpcSheet2024Props["compendium"];
  filteredFeats: PlayerNpcSheet2024Props["compendium"]["feats"];
  updateDraft: (recipe: (current: ActorSheet) => ActorSheet) => void;
  setActiveTab: (tab: "main" | "edit") => void;
}

export function useGuidedSheetFlow({
  actor,
  draft,
  compendium,
  filteredFeats,
  updateDraft,
  setActiveTab
}: UseGuidedSheetFlowParams): GuidedSheetFlowState {
  const [guidedFlowOpen, setGuidedFlowOpen] = useState(false);
  const [guidedFlowMode, setGuidedFlowMode] = useState<GuidedFlowMode>("setup");
  const [guidedClassId, setGuidedClassId] = useState("");
  const [guideError, setGuideError] = useState<string | null>(null);
  const [guidedSetup, setGuidedSetup] = useState<GuidedSetupState>(emptyGuidedSetup);

  useEffect(() => {
    setGuidedFlowOpen(false);
    setGuidedFlowMode("setup");
    setGuidedClassId("");
    setGuideError(null);
    setGuidedSetup(emptyGuidedSetup);
  }, [actor.id]);

  const guidedSelectedSpecies = useMemo(
    () => compendium.races.find((entry) => entry.id === guidedSetup.speciesId) ?? null,
    [compendium.races, guidedSetup.speciesId]
  );
  const guidedSelectedBackground = useMemo(
    () => compendium.backgrounds.find((entry) => entry.id === guidedSetup.backgroundId) ?? null,
    [compendium.backgrounds, guidedSetup.backgroundId]
  );
  const guidedSelectedClass = useMemo(
    () => compendium.classes.find((entry) => entry.id === guidedSetup.classId) ?? null,
    [compendium.classes, guidedSetup.classId]
  );
  const guidedSpeciesSkillChoiceConfig = useMemo(
    () => deriveSpeciesSkillChoiceConfig(guidedSelectedSpecies, compendium.skills),
    [compendium.skills, guidedSelectedSpecies]
  );
  const guidedSpeciesOriginFeatOptions = useMemo(
    () => deriveSpeciesOriginFeatOptions(guidedSelectedSpecies, compendium.feats).filter((feat) => feat.id !== guidedSetup.originFeatId),
    [compendium.feats, guidedSelectedSpecies, guidedSetup.originFeatId]
  );
  const guidedSpeciesChoiceGroups = useMemo(() => deriveSpeciesChoiceGroups(guidedSelectedSpecies), [guidedSelectedSpecies]);
  const guidedAbilityChoiceConfig = useMemo(() => deriveBackgroundAbilityConfig(guidedSelectedBackground), [guidedSelectedBackground]);
  const guidedAbilityChoiceMode = useMemo(
    () => selectGuidedAbilityChoiceMode(guidedAbilityChoiceConfig, guidedSetup.backgroundAbilityModeId),
    [guidedAbilityChoiceConfig, guidedSetup.backgroundAbilityModeId]
  );
  const guidedAbilityChoiceSlots = useMemo(() => deriveGuidedAbilityChoiceSlots(guidedAbilityChoiceMode), [guidedAbilityChoiceMode]);
  const guidedOriginFeatOptions = useMemo(
    () => deriveOriginFeatOptions(guidedSelectedBackground, compendium.feats),
    [compendium.feats, guidedSelectedBackground]
  );
  const guidedClassEquipmentGroups = useMemo(() => deriveClassEquipmentGroups(guidedSelectedClass), [guidedSelectedClass]);
  const guidedEquipmentGroups = useMemo(
    () => [...deriveBackgroundEquipmentGroups(guidedSelectedBackground), ...guidedClassEquipmentGroups],
    [guidedClassEquipmentGroups, guidedSelectedBackground]
  );
  const guidedSpeciesPreviewActor = useMemo(() => {
    if (guidedFlowMode !== "setup") {
      return draft;
    }

    let next = applyGuideBaseAbilities(draft, guidedSetup.baseAbilities);

    if (guidedSelectedSpecies) {
      next = applySpeciesToActor(next, guidedSelectedSpecies);
      next = applySpeciesChoiceSelections(
        next,
        guidedSelectedSpecies,
        compendium.feats,
        guidedSetup.speciesSkillChoices,
        guidedSetup.speciesOriginFeatId
      );
    }

    return next;
  }, [
    compendium.feats,
    draft,
    guidedFlowMode,
    guidedSelectedSpecies,
    guidedSetup.baseAbilities,
    guidedSetup.speciesOriginFeatId,
    guidedSetup.speciesSkillChoices
  ]);
  const guidedBackgroundSkillChoiceConfig = useMemo(
    () => deriveBackgroundSkillChoiceConfig(guidedSelectedBackground, compendium.skills, guidedSpeciesPreviewActor),
    [compendium.skills, guidedSelectedBackground, guidedSpeciesPreviewActor]
  );
  const guidedBackgroundPreviewActor = useMemo(() => {
    if (guidedFlowMode !== "setup") {
      return draft;
    }

    if (!guidedSelectedBackground) {
      return guidedSpeciesPreviewActor;
    }

    return applyBackgroundToActor(guidedSpeciesPreviewActor, guidedSelectedBackground, compendium.feats, {
      featId: guidedSetup.originFeatId,
      abilityChoices: guidedSetup.abilityChoices,
      abilityChoiceModeId: guidedSetup.backgroundAbilityModeId,
      equipmentChoiceIds: guidedSetup.equipmentChoiceIds,
      skillChoices: guidedSetup.backgroundSkillChoices
    });
  }, [
    compendium.feats,
    draft,
    guidedFlowMode,
    guidedSetup.backgroundAbilityModeId,
    guidedSelectedBackground,
    guidedSetup.abilityChoices,
    guidedSetup.backgroundSkillChoices,
    guidedSetup.equipmentChoiceIds,
    guidedSetup.originFeatId,
    guidedSpeciesPreviewActor
  ]);
  const guidedClassPreviewActor = useMemo(() => {
    if (guidedFlowMode !== "setup" || !guidedSelectedClass) {
      return guidedBackgroundPreviewActor;
    }

    return applyClassToActor(guidedBackgroundPreviewActor, guidedSelectedClass, compendium.classes);
  }, [compendium.classes, guidedBackgroundPreviewActor, guidedFlowMode, guidedSelectedClass]);
  const guidedClassSkillChoiceConfig = useMemo(
    () =>
      guidedFlowMode === "setup"
        ? deriveClassSkillChoiceConfig(guidedSelectedClass, compendium.skills, guidedClassPreviewActor)
        : { count: 0, options: [] },
    [compendium.skills, guidedClassPreviewActor, guidedFlowMode, guidedSelectedClass]
  );
  const guidedSetupActorForGuideChoices = useMemo(() => {
    if (guidedFlowMode !== "setup") {
      return draft;
    }

    return applyClassSkillChoicesToActor(guidedClassPreviewActor, guidedSetup.classSkillChoices);
  }, [draft, guidedClassPreviewActor, guidedFlowMode, guidedSetup.classSkillChoices]);
  const guidedChoiceSpec = useMemo(
    () =>
      deriveGuidedChoiceSpec({
        actor: guidedFlowMode === "setup" ? guidedSetupActorForGuideChoices : draft,
        classes: compendium.classes,
        spells: compendium.spells,
        feats: compendium.feats,
        optionalFeatures: compendium.optionalFeatures,
        targetClassId: guidedSetup.classId,
        targetActorClassId: guidedClassId,
        targetSubclassId: guidedSetup.subclassId,
        mode: guidedFlowMode,
        selectedClassChoiceIds: guidedSetup.classChoiceIds,
        selectedSpellIds: [
          ...guidedSetup.cantripIds,
          ...guidedSetup.knownSpellIds,
          ...guidedSetup.spellbookSpellIds,
          ...guidedSetup.preparedSpellIds
        ],
        selectedSpellbookSpellIds: guidedSetup.spellbookSpellIds
      }),
    [
      compendium.classes,
      compendium.feats,
      compendium.optionalFeatures,
      compendium.spells,
      draft,
      guidedClassId,
      guidedFlowMode,
      guidedSetup.classId,
      guidedSetup.classChoiceIds,
      guidedSetup.cantripIds,
      guidedSetup.knownSpellIds,
      guidedSetup.preparedSpellIds,
      guidedSetup.spellbookSpellIds,
      guidedSetup.subclassId,
      guidedSetupActorForGuideChoices
    ]
  );
  const guidedFeatOptions = useMemo(() => {
    const targetCharacterLevel =
      guidedFlowMode === "levelup" ? totalLevel(guidedSetupActorForGuideChoices) + 1 : totalLevel(guidedSetupActorForGuideChoices);
    return filteredFeats.filter((feat) => featMeetsProgressionPrerequisites(feat, guidedSetupActorForGuideChoices, targetCharacterLevel));
  }, [filteredFeats, guidedFlowMode, guidedSetupActorForGuideChoices]);

  useEffect(() => {
    if (!guidedFlowOpen) {
      return;
    }

    setGuidedSetup((current) => {
      const nextBaseAbilities = normalizeGuideBaseAbilities(current.baseAbilities);
      const nextBackgroundAbilityModeId = guidedAbilityChoiceConfig.modes.some((entry) => entry.id === current.backgroundAbilityModeId)
        ? current.backgroundAbilityModeId
        : guidedAbilityChoiceConfig.defaultModeId;
      const nextAbilityChoiceSlots = deriveGuidedAbilityChoiceSlots(
        selectGuidedAbilityChoiceMode(guidedAbilityChoiceConfig, nextBackgroundAbilityModeId)
      );
      const nextSpeciesSkillChoices = normalizeGuideSelections(
        current.speciesSkillChoices,
        guidedSpeciesSkillChoiceConfig.count,
        guidedSpeciesSkillChoiceConfig.options.map((entry) => entry.name)
      );
      const nextBackgroundSkillChoices = normalizeGuideSelections(
        current.backgroundSkillChoices,
        guidedBackgroundSkillChoiceConfig.count,
        guidedBackgroundSkillChoiceConfig.options.map((entry) => entry.name)
      );
      const nextSpeciesChoiceIds = normalizeGuideSpeciesChoiceIds(current.speciesChoiceIds, guidedSpeciesChoiceGroups);
      const nextClassSkillChoices = normalizeGuideSelections(
        current.classSkillChoices,
        guidedClassSkillChoiceConfig.count,
        guidedClassSkillChoiceConfig.options.map((entry) => entry.name)
      );
      const nextAbilityChoices = normalizeGuideAbilityChoices(current.abilityChoices, nextAbilityChoiceSlots);
      const nextEquipmentChoiceIds = normalizeGuideEquipmentChoiceIds(current.equipmentChoiceIds, guidedEquipmentGroups);
      const nextClassFeatIds = padGuideSelections(
        current.classFeatIds,
        guidedChoiceSpec.classFeatCount,
        guidedChoiceSpec.classFeatOptions.map((entry) => entry.id)
      );
      const nextOptionalFeatureIds = padGuideSelections(
        current.optionalFeatureIds,
        guidedChoiceSpec.optionalFeatureCount,
        guidedChoiceSpec.optionalFeatureOptions.map((entry) => entry.id)
      );
      const nextCantripIds = current.cantripIds
        .filter((entry) => guidedChoiceSpec.cantripOptions.some((spell) => spell.id === entry))
        .slice(0, guidedChoiceSpec.cantripCount);
      const nextKnownSpellIds = current.knownSpellIds
        .filter((entry) => guidedChoiceSpec.knownSpellOptions.some((spell) => spell.id === entry))
        .slice(0, guidedChoiceSpec.knownSpellCount);
      const nextSpellbookSpellIds = current.spellbookSpellIds
        .filter((entry) => guidedChoiceSpec.spellbookOptions.some((spell) => spell.id === entry))
        .slice(0, guidedChoiceSpec.spellbookCount);
      const nextPreparedSpellIds = current.preparedSpellIds
        .filter((entry) => guidedChoiceSpec.preparedSpellOptions.some((spell) => spell.id === entry))
        .slice(0, guidedChoiceSpec.preparedSpellCount);
      const nextExpertiseSkillChoices = normalizeGuideSelections(
        current.expertiseSkillChoices,
        guidedChoiceSpec.expertiseCount,
        guidedChoiceSpec.expertiseSkillOptions.map((entry) => entry.name)
      );
      const nextAsiFeatId = guidedFeatOptions.some((entry) => entry.id === current.asiFeatId)
        ? current.asiFeatId
        : (guidedFeatOptions[0]?.id ?? "");
      const nextAsiAbilityChoices = padGuideSelections(
        current.asiAbilityChoices.filter((entry) => defaultGuideAbilityCycle.includes(entry)),
        guidedChoiceSpec.abilityImprovementCount * 2,
        defaultGuideAbilityCycle
      );
      const nextSpeciesOriginFeatId = guidedSpeciesOriginFeatOptions.some((entry) => entry.id === current.speciesOriginFeatId)
        ? current.speciesOriginFeatId
        : (guidedSpeciesOriginFeatOptions[0]?.id ?? "");
      const nextOriginFeatId = guidedOriginFeatOptions.some((entry) => entry.id === current.originFeatId)
        ? current.originFeatId
        : (guidedOriginFeatOptions[0]?.id ?? "");

      if (
        shallowEqualAbilities(current.baseAbilities, nextBaseAbilities) &&
        current.backgroundAbilityModeId === nextBackgroundAbilityModeId &&
        shallowEqualArray(current.speciesSkillChoices, nextSpeciesSkillChoices) &&
        shallowEqualArray(current.backgroundSkillChoices, nextBackgroundSkillChoices) &&
        shallowEqualRecord(current.speciesChoiceIds, nextSpeciesChoiceIds) &&
        shallowEqualArray(current.classSkillChoices, nextClassSkillChoices) &&
        shallowEqualArray(current.abilityChoices, nextAbilityChoices) &&
        shallowEqualRecord(current.equipmentChoiceIds, nextEquipmentChoiceIds) &&
        shallowEqualArray(current.classFeatIds, nextClassFeatIds) &&
        shallowEqualArray(current.optionalFeatureIds, nextOptionalFeatureIds) &&
        shallowEqualArray(current.cantripIds, nextCantripIds) &&
        shallowEqualArray(current.knownSpellIds, nextKnownSpellIds) &&
        shallowEqualArray(current.spellbookSpellIds, nextSpellbookSpellIds) &&
        shallowEqualArray(current.preparedSpellIds, nextPreparedSpellIds) &&
        shallowEqualArray(current.expertiseSkillChoices, nextExpertiseSkillChoices) &&
        current.asiFeatId === nextAsiFeatId &&
        shallowEqualArray(current.asiAbilityChoices, nextAsiAbilityChoices) &&
        current.speciesOriginFeatId === nextSpeciesOriginFeatId &&
        current.originFeatId === nextOriginFeatId
      ) {
        return current;
      }

      return {
        ...current,
        baseAbilities: nextBaseAbilities,
        backgroundAbilityModeId: nextBackgroundAbilityModeId,
        speciesSkillChoices: nextSpeciesSkillChoices,
        backgroundSkillChoices: nextBackgroundSkillChoices,
        speciesChoiceIds: nextSpeciesChoiceIds,
        classSkillChoices: nextClassSkillChoices,
        speciesOriginFeatId: nextSpeciesOriginFeatId,
        originFeatId: nextOriginFeatId,
        equipmentChoiceIds: nextEquipmentChoiceIds,
        abilityChoices: nextAbilityChoices,
        classFeatIds: nextClassFeatIds,
        optionalFeatureIds: nextOptionalFeatureIds,
        cantripIds: nextCantripIds,
        knownSpellIds: nextKnownSpellIds,
        spellbookSpellIds: nextSpellbookSpellIds,
        preparedSpellIds: nextPreparedSpellIds,
        expertiseSkillChoices: nextExpertiseSkillChoices,
        asiFeatId: nextAsiFeatId,
        asiAbilityChoices: nextAsiAbilityChoices
      };
    });
  }, [
    guidedFeatOptions,
    guidedAbilityChoiceConfig,
    guidedBackgroundSkillChoiceConfig,
    guidedChoiceSpec,
    guidedClassSkillChoiceConfig,
    guidedEquipmentGroups,
    guidedFlowOpen,
    guidedOriginFeatOptions,
    guidedSpeciesChoiceGroups,
    guidedSpeciesOriginFeatOptions,
    guidedSpeciesSkillChoiceConfig
  ]);

  const selectedGuideFeats = useMemo(
    () =>
      mergeTextValues(
        [],
        [
          ...guidedSetup.classFeatIds,
          guidedChoiceSpec.abilityImprovementCount > 0 && guidedSetup.asiMode === "feat" ? guidedSetup.asiFeatId : ""
        ]
      )
        .map((entry) => compendium.feats.find((feat) => feat.id === entry) ?? null)
        .filter((entry): entry is (typeof compendium.feats)[number] => Boolean(entry)),
    [compendium, guidedChoiceSpec.abilityImprovementCount, guidedSetup.asiFeatId, guidedSetup.asiMode, guidedSetup.classFeatIds]
  );
  const selectedGuideOptionalFeatures = useMemo(
    () =>
      guidedSetup.optionalFeatureIds
        .map((entry) => compendium.optionalFeatures.find((feature) => feature.id === entry) ?? null)
        .filter((entry): entry is (typeof compendium.optionalFeatures)[number] => Boolean(entry)),
    [compendium, guidedSetup.optionalFeatureIds]
  );
  const selectedGuideSpells = useMemo(() => {
    const selectedSpeciesSpellNames = guidedSpeciesChoiceGroups.flatMap((group) => {
      const selectedOption = group.options.find((option) => option.id === guidedSetup.speciesChoiceIds[group.id]);
      return [...(selectedOption?.spellNames ?? []), ...(selectedOption?.alwaysPreparedSpellNames ?? [])];
    });

    return mergeTextValues(
      [],
      [
        ...guidedSetup.cantripIds,
        ...guidedSetup.knownSpellIds,
        ...guidedSetup.spellbookSpellIds,
        ...(guidedSelectedSpecies?.spellNames ?? []),
        ...(guidedSelectedSpecies?.alwaysPreparedSpellNames ?? []),
        ...selectedSpeciesSpellNames
      ]
    )
      .map(
        (entry) =>
          compendium.spells.find((spell) => spell.id === entry) ??
          compendium.spells.find((spell) => normalizeKey(spell.name) === normalizeKey(entry)) ??
          null
      )
      .filter((entry): entry is (typeof compendium.spells)[number] => Boolean(entry));
  }, [
    compendium,
    guidedSelectedSpecies,
    guidedSetup.cantripIds,
    guidedSetup.knownSpellIds,
    guidedSetup.speciesChoiceIds,
    guidedSetup.spellbookSpellIds,
    guidedSpeciesChoiceGroups
  ]);

  function closeGuidedFlow() {
    setGuidedFlowOpen(false);
  }

  function openGuidedFlow(mode: GuidedFlowMode) {
    if (mode === "setup" && draft.classes.length > 0) {
      return;
    }

    setGuidedFlowMode(mode);
    setGuidedClassId(mode === "levelup" ? (draft.classes[0]?.id ?? NEW_GUIDED_CLASS_ID) : "");
    setGuideError(null);

    const nextSpeciesId = draft.build?.speciesId ?? compendium.races[0]?.id ?? "";
    const nextBackgroundId = draft.build?.backgroundId ?? compendium.backgrounds[0]?.id ?? "";
    const firstBaseClass = compendium.classes.find((entry) => findBaseClassProgression(entry.id) || findBaseClassProgression(entry.name));
    const nextClassId = draft.classes[0]?.compendiumId ?? firstBaseClass?.id ?? "";
    const backgroundEntry = compendium.backgrounds.find((entry) => entry.id === nextBackgroundId) ?? null;
    const classEntry = compendium.classes.find((entry) => entry.id === nextClassId) ?? null;
    const equipmentGroups = [...deriveBackgroundEquipmentGroups(backgroundEntry), ...deriveClassEquipmentGroups(classEntry)];
    const originFeatOptions = deriveOriginFeatOptions(backgroundEntry, compendium.feats);
    const abilityConfig = deriveBackgroundAbilityConfig(backgroundEntry);
    const abilitySlots = deriveGuidedAbilityChoiceSlots(selectGuidedAbilityChoiceMode(abilityConfig, abilityConfig.defaultModeId));
    const speciesEntry = compendium.races.find((entry) => entry.id === nextSpeciesId) ?? null;
    const speciesFeatOptions = deriveSpeciesOriginFeatOptions(speciesEntry, compendium.feats);
    const speciesChoiceGroups = deriveSpeciesChoiceGroups(speciesEntry);

    setGuidedSetup({
      speciesId: nextSpeciesId,
      backgroundId: nextBackgroundId,
      classId: nextClassId,
      subclassId: "",
      baseAbilities: normalizeGuideBaseAbilities(draft.abilities),
      backgroundAbilityModeId: abilityConfig.defaultModeId,
      hpMode: "average",
      rolledHp: null,
      classFeatIds: [],
      optionalFeatureIds: [],
      classChoiceIds: {},
      featChoiceMap: {},
      cantripIds: [],
      knownSpellIds: [],
      spellbookSpellIds: [],
      preparedSpellIds:
        mode === "levelup"
          ? compendium.spells
              .filter((spell) => draft.preparedSpells.some((name) => normalizeKey(name) === normalizeKey(spell.name)))
              .map((spell) => spell.id)
          : [],
      expertiseSkillChoices: [],
      weaponMasteryChoices: [],
      asiMode: "feat",
      asiAbilityMode: "+2",
      asiFeatId: "",
      asiAbilityChoices: [],
      speciesSkillChoices: [],
      backgroundSkillChoices: [],
      classSkillChoices: [],
      languageChoices: ["Common"],
      speciesSizeChoice: (speciesEntry?.sizes[0] as "Medium" | "Small") || "Medium",
      speciesOriginFeatId: speciesFeatOptions[0]?.id ?? "",
      speciesChoiceIds: Object.fromEntries(speciesChoiceGroups.map((group) => [group.id, group.options[0]?.id ?? ""])),
      originFeatId: originFeatOptions[0]?.id ?? "",
      equipmentChoiceIds: Object.fromEntries(equipmentGroups.map((group) => [group.id, group.options[0]?.id ?? ""])),
      abilityChoices: normalizeGuideAbilityChoices([], abilitySlots)
    });
    setGuidedFlowOpen(true);
  }

  function applySpecies(speciesId: string) {
    const species = compendium.races.find((entry) => entry.id === speciesId);

    if (!species) {
      return;
    }

    updateDraft((current) => applySpeciesToActor(current, species));
  }

  function applyBackground(
    backgroundId: string,
    options?: {
      featId?: string;
      abilityChoices?: AbilityKey[];
      abilityChoiceModeId?: string;
      equipmentChoiceIds?: Record<string, string>;
    }
  ) {
    const background = compendium.backgrounds.find((entry) => entry.id === backgroundId);

    if (!background) {
      return;
    }

    updateDraft((current) => applyBackgroundToActor(current, background, compendium.feats, options));
  }

  function applyClass(classId: string, existingActorClassId?: string) {
    const classEntry = compendium.classes.find((entry) => entry.id === classId);

    if (!classEntry) {
      return;
    }

    updateDraft((current) => applyClassToActor(current, classEntry, compendium.classes, existingActorClassId));
  }

  function applySubclass(actorClassId: string, subclassId: string) {
    updateDraft((current) => assignSubclassToActor(current, compendium.classes, actorClassId, subclassId));
  }

  function confirmGuidedSetup(): ActorSheet | null {
    if (!guidedSetup.speciesId || !guidedSetup.backgroundId || !guidedSetup.classId) {
      setGuideError("Choose a species, background, and class before applying setup.");
      return null;
    }

    const classEntry = compendium.classes.find((entry) => entry.id === guidedSetup.classId);

    if (!classEntry) {
      setGuideError("The selected class is no longer available in the campaign compendium.");
      return null;
    }

    const guideValidation = validateGuideSelections({
      actor: draft,
      spec: guidedChoiceSpec,
      setup: guidedSetup,
      mode: "setup",
      targetClass: classEntry,
      currentSubclassId: "",
      speciesChoiceGroups: guidedSpeciesChoiceGroups,
      speciesSkillChoiceCount: guidedSpeciesSkillChoiceConfig.count,
      backgroundSkillChoiceCount: guidedBackgroundSkillChoiceConfig.count,
      backgroundAbilityChoiceCount: guidedAbilityChoiceSlots.length,
      classSkillChoiceCount: guidedClassSkillChoiceConfig.count
    });

    if (guideValidation) {
      setGuideError(guideValidation);
      return null;
    }

    let nextActor: ActorSheet | null = null;
    updateDraft((current) => {
      const before = cloneActor(current);
      let next = cloneActor(current);
      next.classes = [];
      next.className = "";
      next.build = {
        ruleset: "dnd-2024",
        schemaVersion: 2,
        mode: current.build?.mode ?? "guided",
        classes: [],
        selections: current.build?.selections ?? [],
        awards: current.build?.awards ?? [],
        overrides: current.build?.overrides ?? []
      };
      next.features = [];
      next.feats = [];
      next.spells = [];
      next.preparedSpells = [];
      next.inventory = [];
      next.resources = [];
      next.hitPoints.max = 0;
      next.hitPoints.current = 0;
      next.hitPoints.temp = 0;
      next.hitPoints.reducedMax = 0;

      next = applyGuideBaseAbilities(next, guidedSetup.baseAbilities);
      next = applySpeciesToActor(next, compendium.races.find((entry) => entry.id === guidedSetup.speciesId) ?? null);
      next = applySpeciesChoiceSelections(
        next,
        guidedSelectedSpecies,
        compendium.feats,
        guidedSetup.speciesSkillChoices,
        guidedSetup.speciesOriginFeatId
      );
      next = applySpeciesChoiceGroupSelections(
        next,
        guidedSelectedSpecies,
        guidedSpeciesChoiceGroups,
        guidedSetup.speciesChoiceIds,
        compendium.spells
      );
      next = applyBackgroundToActor(next, backgroundForId(compendium.backgrounds, guidedSetup.backgroundId), compendium.feats, {
        featId: guidedSetup.originFeatId,
        abilityChoices: guidedSetup.abilityChoices,
        abilityChoiceModeId: guidedSetup.backgroundAbilityModeId,
        equipmentChoiceIds: guidedSetup.equipmentChoiceIds,
        skillChoices: guidedSetup.backgroundSkillChoices
      });
      next = applyClassToActor(next, classEntry, compendium.classes);
      next = applyClassSkillChoicesToActor(next, guidedSetup.classSkillChoices);
      next = applyEquipmentSelectionsToActor(next, guidedClassEquipmentGroups, guidedSetup.equipmentChoiceIds);
      if (guidedSetup.subclassId) {
        const actorClassId = next.classes.find((entry) => entry.compendiumId === classEntry.id)?.id ?? "";
        next = assignSubclassToActor(next, compendium.classes, actorClassId, guidedSetup.subclassId);
      }
      next = applyGuideSelectionsToActor(next, {
        compendium,
        setup: guidedSetup,
        spec: guidedChoiceSpec,
        level: 1,
        targetClass: classEntry,
        targetActorClassId: next.classes.find((entry) => entry.compendiumId === classEntry.id)?.id ?? null,
        mode: "setup"
      });
      const actorClass = next.classes.find((entry) => entry.compendiumId === classEntry.id) ?? next.classes[0];
      const award = createProgressionAwardFromActorDelta(before, next, {
        id: crypto.randomUUID(),
        characterLevel: 1,
        classLevel: actorClass?.level ?? 1,
        className: classEntry.name,
        classSource: classEntry.source,
        subclassName: classEntry.subclasses.find((entry) => entry.id === guidedSetup.subclassId)?.name,
        subclassSource: classEntry.subclasses.find((entry) => entry.id === guidedSetup.subclassId)?.source,
        speciesName: guidedSelectedSpecies?.name,
        speciesSource: guidedSelectedSpecies?.source,
        backgroundName: guidedSelectedBackground?.name,
        backgroundSource: guidedSelectedBackground?.source,
        choices: collectAwardChoices(guidedSetup, guidedChoiceSpec),
        references: collectAwardReferences(compendium),
        committedAt: new Date().toISOString()
      });
      next.build = {
        ...(next.build ?? { ruleset: "dnd-2024", mode: "guided", classes: [], selections: [] }),
        schemaVersion: 2,
        awards: [...(next.build?.awards ?? []), award],
        overrides: next.build?.overrides ?? []
      };
      nextActor = next;
      return next;
    });

    setGuideError(null);
    setGuidedFlowOpen(false);
    setActiveTab("edit");
    return nextActor;
  }

  function confirmGuidedLevelUp() {
    const addingNewClass = guidedClassId === NEW_GUIDED_CLASS_ID;
    const targetActorClass = addingNewClass ? null : (draft.classes.find((entry) => entry.id === guidedClassId) ?? draft.classes[0]);
    const classEntry = addingNewClass
      ? (compendium.classes.find((entry) => entry.id === guidedSetup.classId) ?? null)
      : targetActorClass
        ? (findCompendiumClass(targetActorClass, compendium.classes) ?? null)
        : null;

    if (!classEntry) {
      setGuideError("Choose a class to level before applying the guide.");
      return null;
    }

    const currentSubclassId = targetActorClass
      ? (targetActorClass.subclassId ?? draft.build?.classes.find((entry) => entry.id === targetActorClass.id)?.subclassId ?? "")
      : "";
    const guideValidation = validateGuideSelections({
      actor: draft,
      spec: guidedChoiceSpec,
      setup: guidedSetup,
      mode: "levelup",
      targetClass: classEntry,
      currentSubclassId
    });

    if (guideValidation) {
      setGuideError(guideValidation);
      return null;
    }

    const constitutionModifier = abilityModifierTotal(draft, "con");
    const rolledValue =
      guidedSetup.hpMode === "roll" && typeof guidedSetup.rolledHp === "number" && guidedSetup.rolledHp > 0
        ? guidedSetup.rolledHp
        : guidedSetup.hpMode === "roll"
          ? rollDie(classEntry.hitDieFaces || 8)
          : Math.floor((classEntry.hitDieFaces || 8) / 2) + 1;
    const hpGain = Math.max(1, rolledValue + constitutionModifier);

    let nextActor: ActorSheet | null = null;
    updateDraft((current) => {
      const before = cloneActor(current);
      let next = cloneActor(current);
      if (addingNewClass) {
        next = applyClassToActor(next, classEntry, compendium.classes);
      } else if (targetActorClass) {
        next.classes = next.classes.map((entry) =>
          entry.id === targetActorClass.id
            ? {
                ...entry,
                level: entry.level + 1
              }
            : entry
        );
      }
      if (guidedSetup.subclassId) {
        const targetClassId = addingNewClass
          ? (next.classes.find((entry) => entry.compendiumId === classEntry.id)?.id ?? "")
          : (targetActorClass?.id ?? "");
        next = assignSubclassToActor(next, compendium.classes, targetClassId, guidedSetup.subclassId);
      }
      next.level = totalLevel(next);
      next.hitPoints.max += hpGain;
      next.hitPoints.current = Math.min(
        effectiveHitPointMax(next.hitPoints.max, next.hitPoints.reducedMax),
        next.hitPoints.current + hpGain
      );
      next.className = next.classes.map((entry) => entry.name).join(" / ");
      next.features = mergeTextValues(next.features, collectGuidedFeatures(next, compendium.classes));
      next.spellSlots = deriveSpellSlots(next, compendium.classes);
      next.resources = mergeDerivedResources(next.resources, deriveClassResources(next, compendium.classes));
      next.hitDice = next.classes.map((entry) => `${entry.level}d${entry.hitDieFaces}`).join(" + ");
      next.build = {
        ruleset: "dnd-2024",
        schemaVersion: 2,
        mode: current.build?.mode ?? "guided",
        speciesId: current.build?.speciesId,
        speciesName: current.build?.speciesName,
        speciesSource: current.build?.speciesSource,
        backgroundId: current.build?.backgroundId,
        backgroundName: current.build?.backgroundName,
        backgroundSource: current.build?.backgroundSource,
        selections: [
          ...(current.build?.selections ?? []),
          {
            id: crypto.randomUUID(),
            kind: "custom",
            level: totalLevel(next),
            name: addingNewClass ? `Multiclass: ${classEntry.name}` : `Level Up: ${classEntry.name}`,
            source: classEntry.source,
            notes: `+${hpGain} HP`
          }
        ],
        awards: current.build?.awards ?? [],
        overrides: current.build?.overrides ?? [],
        classes: syncBuildClasses(next.classes, current.build?.classes ?? [])
      };
      next = applyGuideSelectionsToActor(next, {
        compendium,
        setup: guidedSetup,
        spec: guidedChoiceSpec,
        level: totalLevel(next),
        targetClass: classEntry,
        targetActorClassId: addingNewClass
          ? (next.classes.find((entry) => entry.compendiumId === classEntry.id)?.id ?? null)
          : (targetActorClass?.id ?? null),
        mode: "levelup"
      });
      const awardedClass = next.classes.find((entry) =>
        addingNewClass ? entry.compendiumId === classEntry.id : entry.id === targetActorClass?.id
      );
      const awardedSubclass = classEntry.subclasses.find((entry) => entry.id === awardedClass?.subclassId);
      const award = createProgressionAwardFromActorDelta(before, next, {
        id: crypto.randomUUID(),
        characterLevel: totalLevel(next),
        classLevel: awardedClass?.level ?? 1,
        className: classEntry.name,
        classSource: classEntry.source,
        subclassName: awardedSubclass?.name,
        subclassSource: awardedSubclass?.source,
        choices: collectAwardChoices(guidedSetup, guidedChoiceSpec),
        references: collectAwardReferences(compendium),
        committedAt: new Date().toISOString()
      });
      next.build = {
        ...(next.build ?? { ruleset: "dnd-2024", mode: "guided", classes: [], selections: [] }),
        schemaVersion: 2,
        awards: [...(next.build?.awards ?? []), award],
        overrides: next.build?.overrides ?? []
      };
      nextActor = next;
      return next;
    });

    setGuideError(null);
    setGuidedFlowOpen(false);
    return nextActor;
  }

  return {
    guidedFlowOpen,
    guidedFlowMode,
    guidedClassId,
    guideError,
    guidedSetup,
    guidedSelectedSpecies,
    guidedSelectedBackground,
    guidedSelectedClass,
    guidedChoiceSpec,
    guidedSpeciesSkillChoiceConfig,
    guidedBackgroundSkillChoiceConfig,
    guidedClassSkillChoiceConfig,
    guidedSpeciesOriginFeatOptions,
    guidedSpeciesChoiceGroups,
    guidedAbilityChoiceConfig,
    guidedAbilityChoiceMode,
    guidedAbilityChoiceSlots,
    guidedOriginFeatOptions,
    guidedFeatOptions,
    guidedEquipmentGroups,
    selectedGuideFeats,
    selectedGuideOptionalFeatures,
    selectedGuideSpells,
    setGuidedSetup,
    setGuidedClassId,
    openGuidedFlow,
    closeGuidedFlow,
    applySpecies,
    applyBackground,
    applyClass,
    applySubclass,
    confirmGuidedSetup,
    confirmGuidedLevelUp
  };
}
