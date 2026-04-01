import { useMemo } from "react";

import type { ActorSheet, CampaignSnapshot, MemberRole } from "@shared/types";

import type { DerivedResourceDefinition, DetailRowEntry } from "../playerNpcSheet2024Types";
import {
  collectFeatRows,
  collectFeatureRows,
  collectSpellRows,
  deriveActorSpellCollections,
  deriveClassResources,
  deriveGuidedHitPointMax,
  deriveHitPointDisplayState,
  deriveInventoryEquipment,
  derivePreparedSpellLimit,
  deriveSpellSlots,
  findSpellEntriesByNames,
  mergeDerivedArmorItems,
  mergeDerivedAttacks,
  mergeDerivedResources
} from "../selectors/playerNpcSheet2024Selectors";
import {
  derivedArmorClass,
  derivedSpeed,
  featMatchesClassFilter,
  findCompendiumClass,
  normalizeKey,
  proficiencyBonusForLevel,
  spellAttackBonus,
  spellSaveDc,
  totalLevel
} from "../sheetUtils";

export interface PlayerNpcSheetPermissions {
  canEdit: boolean;
  canRoll: boolean;
  editReadOnly: boolean;
  needsInitialGuidedSetup: boolean;
  hasMainTab: boolean;
  mainTabInteractive: boolean;
}

export interface PlayerNpcSheetDerivedState {
  totalActorLevel: number;
  proficiencyBonus: number;
  skillLookup: Map<string, CampaignSnapshot["compendium"]["skills"][number]>;
  derivedSpellSlots: ReturnType<typeof deriveSpellSlots>;
  derivedResourceDefinitions: DerivedResourceDefinition[];
  displayedResources: ActorSheet["resources"];
  resourceDefinitionLookup: Map<string, DerivedResourceDefinition>;
  preparedSpellLimit: number;
  derivedHitPointMax: number;
  hitPointDisplay: ReturnType<typeof deriveHitPointDisplayState>;
  selectedSpecies: CampaignSnapshot["compendium"]["races"][number] | null;
  selectedBackground: CampaignSnapshot["compendium"]["backgrounds"][number] | null;
  exhaustionCondition: CampaignSnapshot["compendium"]["conditions"][number] | null;
  derivedEquipment: ReturnType<typeof deriveInventoryEquipment>;
  displayedArmorItems: ActorSheet["armorItems"];
  displayedAttacks: ActorSheet["attacks"];
  actorWithDerivedNumbers: ActorSheet;
  armorClass: number;
  speed: number;
  spellAttack: number;
  spellSave: number;
  featureRows: DetailRowEntry[];
  spellCollections: ReturnType<typeof deriveActorSpellCollections>;
  spellRows: DetailRowEntry[];
  featRows: DetailRowEntry[];
  filteredFeats: CampaignSnapshot["compendium"]["feats"];
  canPrepareSpells: boolean;
  preparableSpellEntries: CampaignSnapshot["compendium"]["spells"];
  longRestPreparedSpellRows: DetailRowEntry[];
}

interface UsePlayerNpcSheetDerivedParams {
  draft: ActorSheet;
  compendium: CampaignSnapshot["compendium"];
  role: MemberRole;
  currentUserId: string;
  sheetContext: "board" | "campaign";
  longRestPreparedSpells: string[];
}

export function usePlayerNpcSheetDerived({
  draft,
  compendium,
  role,
  currentUserId,
  sheetContext,
  longRestPreparedSpells
}: UsePlayerNpcSheetDerivedParams) {
  const permissions = useMemo<PlayerNpcSheetPermissions>(() => {
    const canEdit = role === "dm" || draft.ownerId === currentUserId;
    const canRoll = role === "dm" || draft.ownerId === currentUserId;
    const needsInitialGuidedSetup = draft.classes.length === 0;
    const hasMainTab = !needsInitialGuidedSetup;

    return {
      canEdit,
      canRoll,
      editReadOnly: !canEdit,
      needsInitialGuidedSetup,
      hasMainTab,
      mainTabInteractive: sheetContext === "board" && hasMainTab
    };
  }, [currentUserId, draft.classes.length, draft.ownerId, role, sheetContext]);

  const derived = useMemo<PlayerNpcSheetDerivedState>(() => {
    const totalActorLevel = totalLevel(draft);
    const proficiencyBonus = proficiencyBonusForLevel(totalActorLevel);
    const skillLookup = new Map(compendium.skills.map((entry) => [normalizeKey(entry.name), entry]));
    const derivedSpellSlots = deriveSpellSlots(draft, compendium.classes);
    const derivedResourceDefinitions = deriveClassResources(draft, compendium.classes);
    const displayedResources = mergeDerivedResources(draft.resources, derivedResourceDefinitions);
    const resourceDefinitionLookup = new Map(derivedResourceDefinitions.map((entry) => [normalizeKey(entry.name), entry]));
    const preparedSpellLimit = derivePreparedSpellLimit(draft, compendium.classes);
    const derivedHitPointMax = deriveGuidedHitPointMax(draft);
    const hitPointDisplay = deriveHitPointDisplayState(draft.hitPoints, derivedHitPointMax);
    const selectedSpecies = compendium.races.find((entry) => entry.id === draft.build?.speciesId) ?? null;
    const selectedBackground = compendium.backgrounds.find((entry) => entry.id === draft.build?.backgroundId) ?? null;
    const exhaustionCondition = compendium.conditions.find((entry) => normalizeKey(entry.name) === "exhaustion") ?? null;
    const derivedEquipment = deriveInventoryEquipment(draft, compendium.items, proficiencyBonus);
    const displayedArmorItems = mergeDerivedArmorItems(draft.armorItems, derivedEquipment.armorItems);
    const displayedAttacks = mergeDerivedAttacks(draft.attacks, derivedEquipment.attacks);
    const actorWithDerivedNumbers = {
      ...draft,
      proficiencyBonus,
      spellSlots: derivedSpellSlots,
      armorItems: displayedArmorItems,
      attacks: displayedAttacks
    };
    const armorClass = derivedArmorClass(actorWithDerivedNumbers);
    const speed = derivedSpeed(actorWithDerivedNumbers);
    const spellAttack = spellAttackBonus(actorWithDerivedNumbers);
    const spellSave = spellSaveDc(actorWithDerivedNumbers);
    const featureRows = collectFeatureRows(draft, compendium, selectedSpecies, selectedBackground);
    const spellCollections = deriveActorSpellCollections(draft, compendium, derivedSpellSlots);
    const spellRows = collectSpellRows(spellCollections.all, draft.preparedSpells, compendium.spells, preparedSpellLimit);
    const featRows = collectFeatRows(draft.feats, compendium.feats);
    const filteredFeats = compendium.feats.filter((entry) => featMatchesClassFilter(entry, draft.classes));
    const canPrepareSpells = draft.classes.some((actorClass) => {
      const entry = findCompendiumClass(actorClass, compendium.classes);
      return entry?.spellPreparation === "prepared" || entry?.spellPreparation === "spellbook";
    });
    const preparableSpellEntries = findSpellEntriesByNames(spellCollections.preparable, compendium.spells);
    const longRestPreparedSpellRows = collectSpellRows(longRestPreparedSpells, longRestPreparedSpells, compendium.spells, preparedSpellLimit);

    return {
      totalActorLevel,
      proficiencyBonus,
      skillLookup,
      derivedSpellSlots,
      derivedResourceDefinitions,
      displayedResources,
      resourceDefinitionLookup,
      preparedSpellLimit,
      derivedHitPointMax,
      hitPointDisplay,
      selectedSpecies,
      selectedBackground,
      exhaustionCondition,
      derivedEquipment,
      displayedArmorItems,
      displayedAttacks,
      actorWithDerivedNumbers,
      armorClass,
      speed,
      spellAttack,
      spellSave,
      featureRows,
      spellCollections,
      spellRows,
      featRows,
      filteredFeats,
      canPrepareSpells,
      preparableSpellEntries,
      longRestPreparedSpellRows
    };
  }, [compendium, draft, longRestPreparedSpells]);

  return { permissions, derived };
}
