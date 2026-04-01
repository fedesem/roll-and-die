import { useEffect, useMemo, useState } from "react";

import type { AbilityKey, ActorSheet } from "@shared/types";

import type {
  GuidedChoiceSpec,
  GuidedFlowMode,
  GuidedSetupState,
  PlayerNpcSheet2024Props
} from "../playerNpcSheet2024Types";
import { NEW_GUIDED_CLASS_ID } from "../playerNpcSheet2024Types";
import {
  applyBackgroundToActor,
  applyClassToActor,
  applyGuideSelectionsToActor,
  applySpeciesChoiceSelections,
  applySpeciesToActor,
  assignSubclassToActor,
  rollDie
} from "../selectors/playerNpcSheet2024Mutations";
import {
  backgroundForId,
  collectGuidedFeatures,
  deriveClassResources,
  deriveBackgroundAbilityConfig,
  deriveBackgroundEquipmentGroups,
  deriveGuidedChoiceSpec,
  deriveOriginFeatOptions,
  deriveSpellSlots,
  deriveSpeciesOriginFeatOptions,
  deriveSpeciesSkillOptions,
  effectiveHitPointMax,
  mergeDerivedResources,
  mergeTextValues,
  padGuideSelections,
  syncBuildClasses,
  validateGuideSelections
} from "../selectors/playerNpcSheet2024Selectors";
import { abilityModifierTotal, cloneActor, findCompendiumClass, totalLevel } from "../sheetUtils";

const emptyGuidedSetup: GuidedSetupState = {
  speciesId: "",
  backgroundId: "",
  classId: "",
  subclassId: "",
  classFeatIds: [],
  optionalFeatureIds: [],
  cantripIds: [],
  knownSpellIds: [],
  spellbookSpellIds: [],
  expertiseSkillChoices: [],
  asiMode: "feat",
  asiFeatId: "",
  asiAbilityChoices: [],
  speciesSkillChoice: "",
  speciesOriginFeatId: "",
  originFeatId: "",
  equipmentChoiceIds: {},
  abilityChoices: []
};

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
  guidedSpeciesSkillChoices: PlayerNpcSheet2024Props["compendium"]["skills"];
  guidedSpeciesOriginFeatOptions: PlayerNpcSheet2024Props["compendium"]["feats"];
  guidedAbilityChoiceConfig: ReturnType<typeof deriveBackgroundAbilityConfig>;
  guidedOriginFeatOptions: PlayerNpcSheet2024Props["compendium"]["feats"];
  guidedEquipmentGroups: ReturnType<typeof deriveBackgroundEquipmentGroups>;
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
      equipmentChoiceIds?: Record<string, string>;
    }
  ) => void;
  applyClass: (classId: string, existingActorClassId?: string) => void;
  applySubclass: (actorClassId: string, subclassId: string) => void;
  confirmGuidedSetup: () => void;
  confirmGuidedLevelUp: () => void;
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
  const guidedChoiceSpec = useMemo(
    () =>
      deriveGuidedChoiceSpec({
        actor: draft,
        classes: compendium.classes,
        spells: compendium.spells,
        feats: compendium.feats,
        optionalFeatures: compendium.optionalFeatures,
        targetClassId: guidedSetup.classId,
        targetActorClassId: guidedClassId,
        targetSubclassId: guidedSetup.subclassId,
        mode: guidedFlowMode
      }),
    [compendium.classes, compendium.feats, compendium.optionalFeatures, compendium.spells, draft, guidedClassId, guidedFlowMode, guidedSetup.classId, guidedSetup.subclassId]
  );
  const guidedSpeciesSkillChoices = useMemo(
    () => deriveSpeciesSkillOptions(guidedSelectedSpecies, compendium.skills),
    [compendium.skills, guidedSelectedSpecies]
  );
  const guidedSpeciesOriginFeatOptions = useMemo(
    () => deriveSpeciesOriginFeatOptions(guidedSelectedSpecies, compendium.feats),
    [compendium.feats, guidedSelectedSpecies]
  );
  const guidedAbilityChoiceConfig = useMemo(
    () => deriveBackgroundAbilityConfig(guidedSelectedBackground),
    [guidedSelectedBackground]
  );
  const guidedOriginFeatOptions = useMemo(
    () => deriveOriginFeatOptions(guidedSelectedBackground, compendium.feats),
    [compendium.feats, guidedSelectedBackground]
  );
  const guidedEquipmentGroups = useMemo(
    () => deriveBackgroundEquipmentGroups(guidedSelectedBackground),
    [guidedSelectedBackground]
  );

  useEffect(() => {
    if (!guidedFlowOpen) {
      return;
    }

    setGuidedSetup((current) => ({
      ...current,
      classFeatIds: padGuideSelections(current.classFeatIds, guidedChoiceSpec.classFeatCount, guidedChoiceSpec.classFeatOptions.map((entry) => entry.id)),
      optionalFeatureIds: padGuideSelections(
        current.optionalFeatureIds,
        guidedChoiceSpec.optionalFeatureCount,
        guidedChoiceSpec.optionalFeatureOptions.map((entry) => entry.id)
      ),
      cantripIds: current.cantripIds
        .filter((entry) => guidedChoiceSpec.cantripOptions.some((spell) => spell.id === entry))
        .slice(0, guidedChoiceSpec.cantripCount),
      knownSpellIds: current.knownSpellIds
        .filter((entry) => guidedChoiceSpec.knownSpellOptions.some((spell) => spell.id === entry))
        .slice(0, guidedChoiceSpec.knownSpellCount),
      spellbookSpellIds: current.spellbookSpellIds
        .filter((entry) => guidedChoiceSpec.spellbookOptions.some((spell) => spell.id === entry))
        .slice(0, guidedChoiceSpec.spellbookCount),
      expertiseSkillChoices: padGuideSelections(
        current.expertiseSkillChoices,
        guidedChoiceSpec.expertiseCount,
        guidedChoiceSpec.expertiseSkillOptions.map((entry) => entry.name)
      ),
      asiFeatId: current.asiFeatId || filteredFeats[0]?.id || "",
      asiAbilityChoices:
        current.asiAbilityChoices.length === guidedChoiceSpec.abilityImprovementCount * 2
          ? current.asiAbilityChoices
          : Array.from({ length: guidedChoiceSpec.abilityImprovementCount * 2 }, (_, index) => (["str", "dex", "con", "int", "wis", "cha"][index % 6] as AbilityKey))
    }));
  }, [filteredFeats, guidedChoiceSpec, guidedFlowOpen]);

  const selectedGuideFeats = useMemo(
    () =>
      mergeTextValues([], [
        ...guidedSetup.classFeatIds,
        guidedChoiceSpec.abilityImprovementCount > 0 && guidedSetup.asiMode === "feat" ? guidedSetup.asiFeatId : ""
      ])
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
  const selectedGuideSpells = useMemo(
    () =>
      mergeTextValues([], [...guidedSetup.cantripIds, ...guidedSetup.knownSpellIds, ...guidedSetup.spellbookSpellIds])
        .map((entry) => compendium.spells.find((spell) => spell.id === entry) ?? null)
        .filter((entry): entry is (typeof compendium.spells)[number] => Boolean(entry)),
    [compendium, guidedSetup.cantripIds, guidedSetup.knownSpellIds, guidedSetup.spellbookSpellIds]
  );

  function closeGuidedFlow() {
    setGuidedFlowOpen(false);
  }

  function openGuidedFlow(mode: GuidedFlowMode) {
    if (mode === "setup" && draft.classes.length > 0) {
      return;
    }

    setGuidedFlowMode(mode);
    setGuidedClassId(draft.classes[0]?.id ?? "");
    setGuideError(null);

    const nextSpeciesId = draft.build?.speciesId ?? compendium.races[0]?.id ?? "";
    const nextBackgroundId = draft.build?.backgroundId ?? compendium.backgrounds[0]?.id ?? "";
    const backgroundEntry = compendium.backgrounds.find((entry) => entry.id === nextBackgroundId) ?? null;
    const equipmentGroups = deriveBackgroundEquipmentGroups(backgroundEntry);
    const originFeatOptions = deriveOriginFeatOptions(backgroundEntry, compendium.feats);
    const abilityConfig = deriveBackgroundAbilityConfig(backgroundEntry);
    const speciesEntry = compendium.races.find((entry) => entry.id === nextSpeciesId) ?? null;
    const speciesSkillOptions = deriveSpeciesSkillOptions(speciesEntry, compendium.skills);
    const speciesFeatOptions = deriveSpeciesOriginFeatOptions(speciesEntry, compendium.feats);

    setGuidedSetup({
      speciesId: nextSpeciesId,
      backgroundId: nextBackgroundId,
      classId: draft.classes[0]?.compendiumId ?? compendium.classes[0]?.id ?? "",
      subclassId: "",
      classFeatIds: [],
      optionalFeatureIds: [],
      cantripIds: [],
      knownSpellIds: [],
      spellbookSpellIds: [],
      expertiseSkillChoices: [],
      asiMode: "feat",
      asiFeatId: "",
      asiAbilityChoices: [],
      speciesSkillChoice: speciesSkillOptions[0]?.name ?? "",
      speciesOriginFeatId: speciesFeatOptions[0]?.id ?? "",
      originFeatId: originFeatOptions[0]?.id ?? "",
      equipmentChoiceIds: Object.fromEntries(equipmentGroups.map((group) => [group.id, group.options[0]?.id ?? ""])),
      abilityChoices: abilityConfig.abilities.slice(0, abilityConfig.count)
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

  function confirmGuidedSetup() {
    if (!guidedSetup.speciesId || !guidedSetup.backgroundId || !guidedSetup.classId) {
      setGuideError("Choose a species, background, and class before applying setup.");
      return;
    }

    const classEntry = compendium.classes.find((entry) => entry.id === guidedSetup.classId);

    if (!classEntry) {
      setGuideError("The selected class is no longer available in the campaign compendium.");
      return;
    }

    const guideValidation = validateGuideSelections({
      actor: draft,
      spec: guidedChoiceSpec,
      setup: guidedSetup,
      mode: "setup",
      targetClass: classEntry,
      currentSubclassId: ""
    });

    if (guideValidation) {
      setGuideError(guideValidation);
      return;
    }

    updateDraft((current) => {
      let next = cloneActor(current);
      next.classes = [];
      next.className = "";
      next.build = {
        ruleset: "dnd-2024",
        mode: current.build?.mode ?? "guided",
        classes: [],
        selections: current.build?.selections ?? []
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

      next = applySpeciesToActor(next, compendium.races.find((entry) => entry.id === guidedSetup.speciesId) ?? null);
      next = applySpeciesChoiceSelections(next, guidedSelectedSpecies, compendium.feats, guidedSetup.speciesSkillChoice, guidedSetup.speciesOriginFeatId);
      next = applyBackgroundToActor(next, backgroundForId(compendium.backgrounds, guidedSetup.backgroundId), compendium.feats, {
        featId: guidedSetup.originFeatId,
        abilityChoices: guidedSetup.abilityChoices,
        equipmentChoiceIds: guidedSetup.equipmentChoiceIds
      });
      next = applyClassToActor(next, classEntry, compendium.classes);
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
      return next;
    });

    setGuideError(null);
    setGuidedFlowOpen(false);
    setActiveTab("edit");
  }

  function confirmGuidedLevelUp() {
    const addingNewClass = guidedClassId === NEW_GUIDED_CLASS_ID;
    const targetActorClass = addingNewClass ? null : draft.classes.find((entry) => entry.id === guidedClassId) ?? draft.classes[0];
    const classEntry = addingNewClass
      ? compendium.classes.find((entry) => entry.id === guidedSetup.classId) ?? null
      : targetActorClass
        ? findCompendiumClass(targetActorClass, compendium.classes) ?? null
        : null;

    if (!classEntry) {
      setGuideError("Choose a class to level before applying the guide.");
      return;
    }

    const currentSubclassId = targetActorClass ? draft.build?.classes.find((entry) => entry.id === targetActorClass.id)?.subclassId ?? "" : "";
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
      return;
    }

    const constitutionModifier = abilityModifierTotal(draft, "con");
    const hpGain = Math.max(1, rollDie(classEntry.hitDieFaces) + constitutionModifier);

    updateDraft((current) => {
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
        const targetClassId = addingNewClass ? next.classes.find((entry) => entry.compendiumId === classEntry.id)?.id ?? "" : targetActorClass?.id ?? "";
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
        classes: syncBuildClasses(next.classes, current.build?.classes ?? [])
      };
      next = applyGuideSelectionsToActor(next, {
        compendium,
        setup: guidedSetup,
        spec: guidedChoiceSpec,
        level: totalLevel(next),
        targetClass: classEntry,
        targetActorClassId: addingNewClass ? next.classes.find((entry) => entry.compendiumId === classEntry.id)?.id ?? null : targetActorClass?.id ?? null,
        mode: "levelup"
      });
      return next;
    });

    setGuideError(null);
    setGuidedFlowOpen(false);
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
    guidedSpeciesSkillChoices,
    guidedSpeciesOriginFeatOptions,
    guidedAbilityChoiceConfig,
    guidedOriginFeatOptions,
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
