import type { AbilityKey, ActorSheet } from "../../types.js";

export type CasterProgressionType = "full" | "half" | "third" | "pact" | "none";
export type SpellChangeCadence = "onLongRest" | "onLevelUp" | "onShortRest" | "never";
export type ActionEconomyCost = "action" | "bonus" | "reaction" | "free" | "passive" | "special";

export interface StructuredActionDefinition {
  id: string;
  name: string;
  source: string;
  category: "feature" | "feat" | "spell" | "item";
  actionCost: ActionEconomyCost;
  resourceCost?: {
    resourceName: string;
    count: number;
  };
  spellSlotCost?: {
    level: number | "cantrip";
    consumeSlot: boolean;
  };
  roll?: {
    kind: "attack" | "damage" | "heal" | "save" | "check";
    diceFormula?: string;
    damageType?: string;
    savingThrowAbility?: AbilityKey;
    dcAbility?: AbilityKey;
    upcastDiceIncrement?: string;
  };
  range?: string;
  duration?: string;
  concentration?: boolean;
}

export interface ProgressionChoiceOption {
  id: string;
  name: string;
  referenceId?: string;
  requires?: {
    level?: number;
    characterLevel?: number;
    subclassId?: string;
    feature?: string;
    notFeature?: string;
    minAbility?: Partial<Record<AbilityKey, number>>;
    knownSpell?: {
      spellListId?: string;
      level?: number | "cantrip";
      dealsDamage?: boolean;
    };
  };
  grants?: {
    features?: string[];
    skills?: string[];
    expertise?: string[];
    armorProficiencies?: string[];
    weaponProficiencies?: string[];
    toolProficiencies?: string[];
    savingThrows?: AbilityKey[];
    languages?: string[];
    abilities?: Partial<Record<AbilityKey, number>>;
    weaponMasteriesCount?: number;
    visionRange?: number;
    cantripsCount?: number;
    cantripOptions?: string[];
    spellsCount?: number;
    spellOptions?: string[];
    spellList?: string;
    alwaysPreparedSpells?: string[];
    actions?: StructuredActionDefinition[];
    passiveBonuses?: Array<{
      target: "skill" | "savingThrow" | "armorClass" | "speed" | "initiative";
      skillName?: string;
      ability?: AbilityKey;
      statBonus?: AbilityKey;
      bonus?: number;
      minBonus?: number;
    }>;
  };
}

export type ChoiceCadence = "onLevelUp" | "onLongRest" | "onShortRest" | "permanent";

export interface ProgressionChoiceGroupDef {
  id: string;
  title: string;
  referenceId?: string;
  source: "class" | "subclass" | "species" | "background" | "feat";
  choose: number;
  cadence?: ChoiceCadence;
  optionSetId?: string;
  optionSetIds?: string[];
  options: ProgressionChoiceOption[];
}

export interface ProgressionChoiceDomainDef {
  id: string;
  options: ProgressionChoiceOption[];
}

export interface ProgressionResourceDef {
  name: string;
  maxFormula: {
    type: "fixed" | "level" | "statModifier" | "levelMultiplier";
    value?: number;
    stat?: AbilityKey;
    min?: number;
    multiplier?: number;
  };
  resetOn: "shortRest" | "longRest";
  shortRestRestore?: "all" | number; // e.g. 1 for Wild Shape, Channel Divinity, Second Wind
  longRestRestore?: "all" | number; // Default: "all"
  dice?: string;
}

export interface ProgressionEquipmentChoiceGroup {
  id: string;
  label: string;
  options: Array<{
    id: string;
    label: string;
    items: Array<{
      referenceId?: string;
      name: string;
      quantity: number;
      currency?: Partial<ActorSheet["currency"]>;
    }>;
  }>;
}

export interface ProgressionSpellcastingDef {
  slots?: number[];
  cantripsKnown?: number;
  spellbookAdditions?: number;
  ritualCasting?: boolean;
  spellcastingAbility?: AbilityKey;
}

export interface ClassSpellcastingRules {
  /** Fixed 2024 Prepared Spells column, indexed by class level minus one. */
  preparedSpellsProgression: number[];
  preparationSource: "classList" | "spellbook";
  changeCadence: Extract<SpellChangeCadence, "onLongRest" | "onLevelUp">;
  replacementMode: "all" | "one";
}

export interface LevelProgressionConfig {
  features?: string[];
  alwaysPreparedSpells?: string[];
  choices?: ProgressionChoiceGroupDef[];
  spellcasting?: ProgressionSpellcastingDef;
  resources?: ProgressionResourceDef[];
  actions?: StructuredActionDefinition[];
  grants?: ProgressionChoiceOption["grants"];
  weaponMasteriesCount?: number;
  expertiseChoices?: number;
  subclassChoice?: boolean;
  asiChoice?: boolean;
}

export interface SubclassProgressionDef {
  id: string;
  name: string;
  source: string;
  levels: Record<number, LevelProgressionConfig>;
}

export interface ClassProgressionDef {
  id: string;
  name: string;
  source: string;
  hitDieFaces: number;
  primaryAbilities: AbilityKey[];
  savingThrows: AbilityKey[];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  toolProficiencies: string[];
  startingSkillChoices?: { choose: number; options: string[] };
  equipmentChoices: ProgressionEquipmentChoiceGroup[];
  spellListId?: string;
  spellcastingRules?: ClassSpellcastingRules;
  multiclassing: {
    prerequisites: Partial<Record<AbilityKey, number>>;
    prerequisiteMode?: "all" | "any";
    proficienciesGranted: {
      armor?: string[];
      weapons?: string[];
      skills?: { count: number; chooseFrom: string[] };
      tools?: string[];
    };
    casterType: CasterProgressionType;
  };
  levels: Record<number, LevelProgressionConfig>;
  subclasses: SubclassProgressionDef[];
}

export interface SpeciesProgressionDef {
  id: string;
  name: string;
  source: string;
  sizes: Array<"Medium" | "Small" | "Large" | "Tiny">;
  speed: number;
  darkvision: number;
  creatureTypes: string[];
  languages: string[];
  bonusLanguageCount: number;
  skillProficiencies?: string[];
  skillChoices?: { choose: number; options: "all" | string[] };
  features: string[];
  choices?: ProgressionChoiceGroupDef[];
  actions?: StructuredActionDefinition[];
}

export interface BackgroundProgressionDef {
  id: string;
  name: string;
  source: string;
  abilityScores: {
    recommended: AbilityKey[];
    options: AbilityKey[];
  };
  originFeatId: string;
  originFeatName: string;
  skillProficiencies: string[];
  toolProficiencies: string[];
  equipmentChoices: ProgressionEquipmentChoiceGroup[];
}

export interface FeatProgressionDef {
  id: string;
  name: string;
  source: string;
  category: "origin" | "general" | "fightingStyle" | "epicBoon";
  prerequisites?: {
    minLevel?: number;
    abilities?: Partial<Record<AbilityKey, number>>;
    armorProficiencies?: string[];
    weaponProficiencies?: string[];
    spellcasting?: boolean;
  };
  abilityIncrease?: {
    choose: number;
    options: AbilityKey[];
    amount: number;
  };
  features?: string[];
  actions?: StructuredActionDefinition[];
  grants?: ProgressionChoiceOption["grants"];
  choices?: ProgressionChoiceGroupDef[];
}

export interface ProgressionRegistry {
  classes: Record<string, ClassProgressionDef>;
  subclasses: Record<string, SubclassProgressionDef>;
  species: Record<string, SpeciesProgressionDef>;
  backgrounds: Record<string, BackgroundProgressionDef>;
  feats: Record<string, FeatProgressionDef>;
}
