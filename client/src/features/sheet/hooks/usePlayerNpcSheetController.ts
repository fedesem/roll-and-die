import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import type {
  AbilityKey,
  ActorClassEntry,
  ActorSheet,
  ArmorEntry,
  AttackEntry,
  InventoryEntry,
  ResourceEntry,
  SkillEntry,
  SpellSlotTrack
} from "@shared/types";

import { uploadImageAsset } from "../../../services/assetService";
import type { PlayerNpcSheet2024Props, RollMode, SheetTab, SpellSelectionTarget } from "../playerNpcSheet2024Types";
import {
  buildD20Notation,
  buildStaticRollNotation,
  finalizeDraftForSave,
  rollDie
} from "../selectors/playerNpcSheet2024Mutations";
import {
  deriveActorSpellCollections,
  deriveClassResources,
  deriveGuidedHitPointMax,
  deriveInventoryEquipment,
  derivePreparedSpellLimit,
  deriveSpellSlots,
  effectiveHitPointMax,
  healHitPoints,
  collectFeatureRows,
  mergeDerivedArmorItems,
  mergeDerivedAttacks,
  mergeDerivedResources,
  normalizeHitPoints
} from "../selectors/playerNpcSheet2024Selectors";
import {
  abilityModifierTotal,
  cloneActor,
  derivedArmorClass,
  derivedSpeed,
  findCompendiumClass,
  proficiencyBonusForLevel,
  totalLevel
} from "../sheetUtils";
import { usePlayerNpcSheetSync } from "./usePlayerNpcSheetSync";

export interface PlayerNpcSheetControllerState {
  draft: ActorSheet;
  activeTab: SheetTab;
  saving: boolean;
  imageError: string | null;
  rollMode: RollMode;
  shortRestOpen: boolean;
  longRestOpen: boolean;
  hitDiceSelections: Record<string, number>;
  spellSelectionTarget: SpellSelectionTarget | null;
  longRestPreparedSpells: string[];
  autosavePaused: boolean;
}

export interface PlayerNpcSheetMutators {
  updateDraft: (recipe: (current: ActorSheet) => ActorSheet) => void;
  updateField: <K extends keyof ActorSheet>(key: K, value: ActorSheet[K]) => void;
  updateAbility: (key: AbilityKey, value: number) => void;
  updateClass: (index: number, patch: Partial<ActorClassEntry>) => void;
  updateSkill: (index: number, patch: Partial<SkillEntry>) => void;
  updateAttack: (index: number, patch: Partial<AttackEntry>) => void;
  updateArmor: (index: number, patch: Partial<ArmorEntry>) => void;
  updateInventory: (index: number, patch: Partial<InventoryEntry>) => void;
  removeFromArray: (key: "attacks" | "armorItems" | "resources" | "inventory" | "classes", index: number) => void;
  updateSpellSlotLevel: (level: number, patch: Partial<SpellSlotTrack>) => void;
  updateResourceById: (resourceId: string, patch: Partial<ResourceEntry>) => void;
  updateDeathSaves: (
    next: ActorSheet["deathSaves"] | ((current: ActorSheet["deathSaves"]) => ActorSheet["deathSaves"])
  ) => void;
  recordDeathSave: (result: "success" | "failure") => void;
  resetDeathSaves: () => void;
}

export interface PlayerNpcSheetActions {
  setActiveTab: (tab: SheetTab) => void;
  setRollMode: (mode: RollMode) => void;
  setSpellSelectionTarget: (target: SpellSelectionTarget | null) => void;
  setLongRestPreparedSpells: (spells: string[]) => void;
  setAutosavePaused: (paused: boolean) => void;
  saveCurrent: (nextDraft?: ActorSheet) => Promise<void>;
  handleImageUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleRoll: (modifier: number, label: string) => Promise<void>;
  handleNotationRoll: (notation: string, label: string, resetsRollMode?: boolean) => Promise<void>;
  handleInitiativeRoll: () => Promise<void>;
  handleAutomaticDeathSave: () => Promise<void>;
  startShortRest: () => void;
  cancelShortRest: () => void;
  confirmShortRest: () => Promise<void>;
  changeHitDiceSelection: (classId: string, nextValue: number) => void;
  startLongRest: () => void;
  cancelLongRest: () => void;
  confirmLongRest: () => Promise<void>;
}

export function usePlayerNpcSheetController({
  token,
  actor,
  compendium,
  role,
  currentUserId,
  sheetContext,
  onSave,
  onRealtimeSave,
  onRoll
}: PlayerNpcSheet2024Props) {
  const [draft, setDraft] = useState<ActorSheet>(() => cloneActor(actor));
  const [activeTab, setActiveTab] = useState<SheetTab>(() =>
    actor.build?.speciesId || actor.build?.backgroundId || actor.classes.length > 0 ? "main" : "edit"
  );
  const [saving, setSaving] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [rollMode, setRollMode] = useState<RollMode>("normal");
  const [shortRestOpen, setShortRestOpen] = useState(false);
  const [longRestOpen, setLongRestOpen] = useState(false);
  const [hitDiceSelections, setHitDiceSelections] = useState<Record<string, number>>({});
  const [spellSelectionTarget, setSpellSelectionTarget] = useState<SpellSelectionTarget | null>(null);
  const [longRestPreparedSpells, setLongRestPreparedSpells] = useState<string[]>([]);
  const [autosavePaused, setAutosavePaused] = useState(false);

  const canEdit = role === "dm" || draft.ownerId === currentUserId;
  const canRoll = role === "dm" || draft.ownerId === currentUserId;
  const mainTabInteractive = sheetContext === "board" && draft.classes.length > 0;
  const saveCurrentRef = useRef<(nextDraft?: ActorSheet) => Promise<void>>(async () => {});

  const resetForActor = useCallback((actorSnapshot: ActorSheet) => {
    setActiveTab(actorSnapshot.build?.speciesId || actorSnapshot.build?.backgroundId || actorSnapshot.classes.length > 0 ? "main" : "edit");
    setSaving(false);
    setImageError(null);
    setRollMode("normal");
    setShortRestOpen(false);
    setLongRestOpen(false);
    setHitDiceSelections({});
    setSpellSelectionTarget(null);
    setLongRestPreparedSpells([]);
    setAutosavePaused(false);
  }, []);

  const { lastMainAutosaveRef } = usePlayerNpcSheetSync({
    actor,
    draft,
    activeTab,
    canEdit,
    mainTabInteractive,
    sheetContext,
    guidedFlowOpen: autosavePaused,
    shortRestOpen,
    longRestOpen,
    saving,
    setDraft,
    resetForActor,
    saveCurrentRef
  });

  useEffect(() => {
    if (draft.classes.length === 0 && activeTab !== "edit") {
      setActiveTab("edit");
    }
  }, [activeTab, draft.classes.length]);

  const saveCurrent = useCallback(
    async (nextDraft = draft) => {
      setSaving(true);

      try {
        const nextProficiencyBonus = proficiencyBonusForLevel(totalLevel(nextDraft));
        const nextSpellSlots = deriveSpellSlots(nextDraft, compendium.classes);
        const nextDerivedEquipment = deriveInventoryEquipment(nextDraft, compendium.items, nextProficiencyBonus);
        const nextDisplayedArmor = mergeDerivedArmorItems(nextDraft.armorItems, nextDerivedEquipment.armorItems);
        const nextDisplayedAttacks = mergeDerivedAttacks(nextDraft.attacks, nextDerivedEquipment.attacks);
        const nextActorWithDerivedNumbers = {
          ...nextDraft,
          proficiencyBonus: nextProficiencyBonus,
          spellSlots: nextSpellSlots,
          armorItems: nextDisplayedArmor,
          attacks: nextDisplayedAttacks
        };
        const nextResources = mergeDerivedResources(nextDraft.resources, deriveClassResources(nextDraft, compendium.classes));
        const nextPreparedSpellLimit = derivePreparedSpellLimit(nextDraft, compendium.classes);
        const nextSpellCollections = deriveActorSpellCollections(nextDraft, compendium, nextSpellSlots);
        const nextFeatures = collectFeatureRows(
          nextDraft,
          compendium,
          compendium.races.find((entry) => entry.id === nextDraft.build?.speciesId) ?? null,
          compendium.backgrounds.find((entry) => entry.id === nextDraft.build?.backgroundId) ?? null
        ).map((entry) => entry.title);

        const finalizedActor = finalizeDraftForSave(nextDraft, {
          armorClass: derivedArmorClass(nextActorWithDerivedNumbers),
          proficiencyBonus: nextProficiencyBonus,
          speed: derivedSpeed(nextActorWithDerivedNumbers),
          hitPointMax: deriveGuidedHitPointMax(nextDraft),
          spellSlots: nextSpellSlots,
          resources: nextResources,
          featureNames: nextFeatures,
          preparedSpellLimit: nextPreparedSpellLimit,
          preparableSpellNames: nextSpellCollections.preparable
        });

        lastMainAutosaveRef.current = JSON.stringify({
          hitPoints: finalizedActor.hitPoints,
          experience: finalizedActor.experience,
          inspiration: finalizedActor.inspiration,
          initiativeRoll: finalizedActor.initiativeRoll ?? null,
          spellSlots: finalizedActor.spellSlots,
          preparedSpells: finalizedActor.preparedSpells,
          resources: finalizedActor.resources,
          inventory: finalizedActor.inventory,
          currency: finalizedActor.currency,
          notes: finalizedActor.notes,
          conditions: finalizedActor.conditions,
          exhaustionLevel: finalizedActor.exhaustionLevel,
          concentration: finalizedActor.concentration,
          deathSaves: finalizedActor.deathSaves,
          classes: finalizedActor.classes.map((entry) => ({ id: entry.id, usedHitDice: entry.usedHitDice }))
        });
        setDraft(finalizedActor);

        if (sheetContext === "board" && activeTab === "main" && onRealtimeSave) {
          await onRealtimeSave(finalizedActor);
        } else {
          await onSave(finalizedActor);
        }
      } finally {
        setSaving(false);
      }
    },
    [activeTab, compendium, draft, lastMainAutosaveRef, onRealtimeSave, onSave, sheetContext]
  );

  useEffect(() => {
    saveCurrentRef.current = saveCurrent;
  }, [saveCurrent]);

  const updateDraft = useCallback((recipe: (current: ActorSheet) => ActorSheet) => {
    setDraft((current) => recipe(current));
  }, []);

  const updateField = useCallback(<K extends keyof ActorSheet>(key: K, value: ActorSheet[K]) => {
    updateDraft((current) => ({ ...current, [key]: value }));
  }, [updateDraft]);

  const updateAbility = useCallback((key: AbilityKey, value: number) => {
    updateDraft((current) => ({
      ...current,
      abilities: {
        ...current.abilities,
        [key]: value
      }
    }));
  }, [updateDraft]);

  const updateClass = useCallback((index: number, patch: Partial<ActorClassEntry>) => {
    updateDraft((current) => ({
      ...current,
      classes: current.classes.map((entry, currentIndex) => (currentIndex === index ? { ...entry, ...patch } : entry))
    }));
  }, [updateDraft]);

  const updateSkill = useCallback((index: number, patch: Partial<SkillEntry>) => {
    updateDraft((current) => ({
      ...current,
      skills: current.skills.map((entry, currentIndex) => (currentIndex === index ? { ...entry, ...patch } : entry))
    }));
  }, [updateDraft]);

  const updateAttack = useCallback((index: number, patch: Partial<AttackEntry>) => {
    updateDraft((current) => ({
      ...current,
      attacks: current.attacks.map((entry, currentIndex) => (currentIndex === index ? { ...entry, ...patch } : entry))
    }));
  }, [updateDraft]);

  const updateArmor = useCallback((index: number, patch: Partial<ArmorEntry>) => {
    updateDraft((current) => ({
      ...current,
      armorItems: current.armorItems.map((entry, currentIndex) => (currentIndex === index ? { ...entry, ...patch } : entry))
    }));
  }, [updateDraft]);

  const updateInventory = useCallback((index: number, patch: Partial<InventoryEntry>) => {
    updateDraft((current) => ({
      ...current,
      inventory: current.inventory.map((entry, currentIndex) => (currentIndex === index ? { ...entry, ...patch } : entry))
    }));
  }, [updateDraft]);

  const removeFromArray = useCallback((key: "attacks" | "armorItems" | "resources" | "inventory" | "classes", index: number) => {
    updateDraft((current) => ({
      ...current,
      [key]: current[key].filter((_, currentIndex) => currentIndex !== index)
    }));
  }, [updateDraft]);

  const updateSpellSlotLevel = useCallback((level: number, patch: Partial<SpellSlotTrack>) => {
    updateDraft((current) => {
      const slotIndex = current.spellSlots.findIndex((entry) => entry.level === level);

      if (slotIndex >= 0) {
        return {
          ...current,
          spellSlots: current.spellSlots.map((entry, currentIndex) => (currentIndex === slotIndex ? { ...entry, ...patch } : entry))
        };
      }

      const derivedSlot = deriveSpellSlots(current, compendium.classes).find((entry) => entry.level === level);

      if (!derivedSlot) {
        return current;
      }

      return {
        ...current,
        spellSlots: [...current.spellSlots, { ...derivedSlot, ...patch }]
      };
    });
  }, [compendium.classes, updateDraft]);

  const updateResourceById = useCallback((resourceId: string, patch: Partial<ResourceEntry>) => {
    updateDraft((current) => {
      const resourceIndex = current.resources.findIndex((entry) => entry.id === resourceId);

      if (resourceIndex >= 0) {
        return {
          ...current,
          resources: current.resources.map((entry, currentIndex) => (currentIndex === resourceIndex ? { ...entry, ...patch } : entry))
        };
      }

      const derivedResource = mergeDerivedResources(current.resources, deriveClassResources(current, compendium.classes)).find(
        (entry) => entry.id === resourceId
      );

      if (!derivedResource) {
        return current;
      }

      return {
        ...current,
        resources: [...current.resources, { ...derivedResource, ...patch }]
      };
    });
  }, [compendium.classes, updateDraft]);

  const updateDeathSaves = useCallback((
    next: ActorSheet["deathSaves"] | ((current: ActorSheet["deathSaves"]) => ActorSheet["deathSaves"])
  ) => {
    updateDraft((current) => {
      const resolved = typeof next === "function" ? next(current.deathSaves) : next;

      return {
        ...current,
        deathSaves: {
          successes: Math.max(0, Math.min(3, resolved.successes)),
          failures: Math.max(0, Math.min(3, resolved.failures)),
          history: (resolved.history ?? []).slice(-3)
        }
      };
    });
  }, [updateDraft]);

  const recordDeathSave = useCallback((result: "success" | "failure") => {
    updateDeathSaves((current) => {
      const history = [...(current.history ?? []), result].slice(-3);

      return {
        successes: history.filter((entry) => entry === "success").length,
        failures: history.filter((entry) => entry === "failure").length,
        history
      };
    });
  }, [updateDeathSaves]);

  const resetDeathSaves = useCallback(() => {
    updateDeathSaves({
      successes: 0,
      failures: 0,
      history: []
    });
  }, [updateDeathSaves]);

  const handleImageUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const { url } = await uploadImageAsset(token, "actors", file);
      setImageError(null);
      updateField("imageUrl", url);
    } catch (error) {
      console.error(error);
      setImageError("Unable to upload that image.");
    }
  }, [token, updateField]);

  const handleRoll = useCallback(async (modifier: number, label: string) => {
    if (!canRoll || sheetContext !== "board") {
      return;
    }

    const notation = buildD20Notation(modifier, rollMode);
    setRollMode("normal");
    await onRoll(notation, `${draft.name} ${label}`);
  }, [canRoll, draft.name, onRoll, rollMode, sheetContext]);

  const handleNotationRoll = useCallback(async (notation: string, label: string, resetsRollMode = false) => {
    if (!canRoll || sheetContext !== "board") {
      return;
    }

    if (resetsRollMode) {
      setRollMode("normal");
    }

    await onRoll(notation.replace(/\s+/g, ""), `${draft.name} ${label}`);
  }, [canRoll, draft.name, onRoll, sheetContext]);

  const handleInitiativeRoll = useCallback(async () => {
    if (!canRoll || sheetContext !== "board") {
      return;
    }

    const notation = buildD20Notation(draft.initiative, rollMode);
    setRollMode("normal");
    await onRoll(notation, `${draft.name} initiative`);
  }, [canRoll, draft.initiative, draft.name, onRoll, rollMode, sheetContext]);

  const handleAutomaticDeathSave = useCallback(async () => {
    if (!canRoll || sheetContext !== "board") {
      return;
    }

    const roll = rollDie(20);
    const result = roll >= 10 ? "success" : "failure";
    recordDeathSave(result);
    await onRoll(buildStaticRollNotation(roll), `${draft.name} death save (${roll})`);
  }, [canRoll, draft.name, onRoll, recordDeathSave, sheetContext]);

  const startShortRest = useCallback(() => {
    setHitDiceSelections(Object.fromEntries(draft.classes.map((entry) => [entry.id, 0])));
    setShortRestOpen(true);
  }, [draft.classes]);

  const cancelShortRest = useCallback(() => {
    setShortRestOpen(false);
  }, []);

  const changeHitDiceSelection = useCallback((classId: string, nextValue: number) => {
    setHitDiceSelections((current) => ({ ...current, [classId]: nextValue }));
  }, []);

  const confirmShortRest = useCallback(async () => {
    const constitutionModifier = abilityModifierTotal(draft, "con");
    let healing = 0;
    const nextDraft = cloneActor(draft);

    nextDraft.classes = nextDraft.classes.map((entry) => {
      const available = Math.max(entry.level - entry.usedHitDice, 0);
      const spend = Math.min(hitDiceSelections[entry.id] ?? 0, available);

      for (let index = 0; index < spend; index += 1) {
        healing += Math.max(1, rollDie(entry.hitDieFaces) + constitutionModifier);
      }

      return {
        ...entry,
        usedHitDice: entry.usedHitDice + spend
      };
    });

    nextDraft.hitPoints = healHitPoints(nextDraft.hitPoints, healing, deriveGuidedHitPointMax(nextDraft));
    nextDraft.resources = mergeDerivedResources(nextDraft.resources, deriveClassResources(nextDraft, compendium.classes)).map((resource) =>
      /short rest/i.test(resource.resetOn)
        ? {
            ...resource,
            current: Math.min(resource.max, resource.current + Math.max(1, resource.restoreAmount))
          }
        : resource
    );

    setDraft(nextDraft);
    setShortRestOpen(false);
    setHitDiceSelections({});
    await saveCurrent(nextDraft);
  }, [compendium.classes, draft, hitDiceSelections, saveCurrent]);

  const startLongRest = useCallback(() => {
    setLongRestPreparedSpells([...draft.preparedSpells]);
    setLongRestOpen(true);
  }, [draft.preparedSpells]);

  const cancelLongRest = useCallback(() => {
    setLongRestOpen(false);
    setLongRestPreparedSpells([]);
  }, []);

  const confirmLongRest = useCallback(async () => {
    const nextDraft = cloneActor(draft);
    const derivedHitPointMax = deriveGuidedHitPointMax(nextDraft);
    const canPrepareSpells = nextDraft.classes.some((actorClass) => {
      const classEntry = findCompendiumClass(actorClass, compendium.classes);
      return classEntry?.spellPreparation === "prepared" || classEntry?.spellPreparation === "spellbook";
    });

    nextDraft.hitPoints.max = derivedHitPointMax || nextDraft.hitPoints.max;
    nextDraft.hitPoints.temp = 0;
    nextDraft.hitPoints = normalizeHitPoints(nextDraft.hitPoints, nextDraft.hitPoints.max);
    nextDraft.hitPoints.current = effectiveHitPointMax(nextDraft.hitPoints.max, nextDraft.hitPoints.reducedMax);
    nextDraft.spellSlots = deriveSpellSlots(nextDraft, compendium.classes).map((entry) => ({ ...entry, used: 0 }));
    nextDraft.resources = mergeDerivedResources(nextDraft.resources, deriveClassResources(nextDraft, compendium.classes)).map((entry) => ({
      ...entry,
      current: entry.max
    }));
    nextDraft.classes = nextDraft.classes.map((entry) => ({
      ...entry,
      usedHitDice: Math.max(0, entry.usedHitDice - Math.floor(entry.level / 2))
    }));
    nextDraft.preparedSpells = canPrepareSpells ? [...longRestPreparedSpells] : nextDraft.preparedSpells;

    setDraft(nextDraft);
    setLongRestOpen(false);
    setLongRestPreparedSpells([]);
    await saveCurrent(nextDraft);
  }, [compendium.classes, draft, longRestPreparedSpells, saveCurrent]);

  const state = useMemo<PlayerNpcSheetControllerState>(() => ({
    draft,
    activeTab,
    saving,
    imageError,
    rollMode,
    shortRestOpen,
    longRestOpen,
    hitDiceSelections,
    spellSelectionTarget,
    longRestPreparedSpells,
    autosavePaused
  }), [activeTab, autosavePaused, draft, hitDiceSelections, imageError, longRestOpen, longRestPreparedSpells, rollMode, saving, shortRestOpen, spellSelectionTarget]);

  const mutators = useMemo<PlayerNpcSheetMutators>(() => ({
    updateDraft,
    updateField,
    updateAbility,
    updateClass,
    updateSkill,
    updateAttack,
    updateArmor,
    updateInventory,
    removeFromArray,
    updateSpellSlotLevel,
    updateResourceById,
    updateDeathSaves,
    recordDeathSave,
    resetDeathSaves
  }), [
    recordDeathSave,
    removeFromArray,
    resetDeathSaves,
    updateAbility,
    updateArmor,
    updateAttack,
    updateClass,
    updateDeathSaves,
    updateDraft,
    updateField,
    updateInventory,
    updateResourceById,
    updateSkill,
    updateSpellSlotLevel
  ]);

  const actions = useMemo<PlayerNpcSheetActions>(() => ({
    setActiveTab,
    setRollMode,
    setSpellSelectionTarget,
    setLongRestPreparedSpells,
    setAutosavePaused,
    saveCurrent,
    handleImageUpload,
    handleRoll,
    handleNotationRoll,
    handleInitiativeRoll,
    handleAutomaticDeathSave,
    startShortRest,
    cancelShortRest,
    confirmShortRest,
    changeHitDiceSelection,
    startLongRest,
    cancelLongRest,
    confirmLongRest
  }), [
    cancelLongRest,
    cancelShortRest,
    changeHitDiceSelection,
    confirmLongRest,
    confirmShortRest,
    handleAutomaticDeathSave,
    handleImageUpload,
    handleInitiativeRoll,
    handleNotationRoll,
    handleRoll,
    saveCurrent,
    startLongRest,
    startShortRest
  ]);

  return {
    state,
    mutators,
    actions
  };
}
