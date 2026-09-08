import type {
  AbilityKey,
  ActorSheet,
  CampaignSnapshot,
  ClassSubclassEntry,
  CompendiumChoiceGroup,
  CompendiumEquipmentGroup,
  CompendiumItemGrant,
  CompendiumOptionalFeatureEntry,
  CompendiumSpeciesChoiceGroup,
  FeatEntry,
  MemberRole,
  SkillEntry,
  SpellEntry
} from "@shared/types";

export interface PlayerNpcSheet2024Props {
  token: string;
  actor: ActorSheet;
  compendium: CampaignSnapshot["compendium"];
  allowedSourceBooks: string[];
  role: MemberRole;
  currentUserId: string;
  sheetContext: "board" | "campaign";
  onSave: (actor: ActorSheet) => Promise<void>;
  onRealtimeSave?: (actor: ActorSheet) => Promise<void>;
  onRoll: (notation: string, label: string) => Promise<void>;
  onNavigateToLevelUp?: () => void;
}

export type SheetCompendium = CampaignSnapshot["compendium"];
export type SheetTab = "main" | "edit";
export type RollMode = "normal" | "advantage" | "disadvantage";
export type GuidedFlowMode = "setup" | "levelup";
export interface GuidedSpellChoiceTarget {
  kind: "guidedChoice";
  owner: "class" | "feat";
  ownerId: string;
  groupId: string;
}
export interface RestPreparedSpellTarget {
  kind: "restPrepared";
  actorClassId: string;
}
export interface RestSpellChoiceTarget {
  kind: "restSpellChoice";
  actorClassId: string;
  groupId: string;
}
export type SpellSelectionTarget =
  | "mainPrepared"
  | "editKnown"
  | "editPrepared"
  | "editSpellbook"
  | "editAlwaysPrepared"
  | "editAtWill"
  | "editPerShortRest"
  | "editPerLongRest"
  | "guideCantrips"
  | "guideKnown"
  | "guideSpellbook"
  | "guidePrepared"
  | GuidedSpellChoiceTarget
  | RestPreparedSpellTarget
  | RestSpellChoiceTarget;

export const NEW_GUIDED_CLASS_ID = "__new_class__";

export interface DetailRowMeta {
  label: string;
  value: string;
}

export interface DetailRowEntry {
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  source?: string;
  description?: string;
  tags?: string[];
  meta?: DetailRowMeta[];
  onRemove?: () => void;
}

export interface DerivedResourceDefinition {
  id: string;
  name: string;
  max: number;
  resetOn: string;
  restoreAmount: number;
  description: string;
  source: string;
}

export interface GuidedSkillChoiceConfig {
  count: number;
  options: CampaignSnapshot["compendium"]["skills"];
}

export interface GuidedAbilityChoiceGrant {
  abilities: AbilityKey[];
  amount: number;
  count: number;
}

export interface GuidedAbilityChoiceMode {
  id: string;
  label: string;
  grants: GuidedAbilityChoiceGrant[];
}

export interface GuidedAbilityChoiceConfig {
  modes: GuidedAbilityChoiceMode[];
  defaultModeId: string;
}

export interface GuidedAbilityChoiceSlot {
  id: string;
  abilities: AbilityKey[];
  amount: number;
}

export type GuidedEquipmentGrant = CompendiumItemGrant;

export type GuidedSpeciesChoiceGroup = CompendiumSpeciesChoiceGroup;

export interface GuidedEquipmentOption {
  id: string;
  label: string;
  items: GuidedEquipmentGrant[];
}

export type GuidedEquipmentGroup = CompendiumEquipmentGroup & {
  source: "background" | "class";
};

export type HpProgressionMode = "average" | "roll";

export interface GuidedSetupState {
  speciesId: string;
  backgroundId: string;
  classId: string;
  subclassId: string;
  baseAbilities: ActorSheet["abilities"];
  backgroundAbilityModeId: string;
  hpMode: HpProgressionMode;
  rolledHp: number | null;
  classFeatIds: string[];
  optionalFeatureIds: string[];
  classChoiceIds: Record<string, string[]>;
  featChoiceMap: Record<string, Record<string, string[]>>;
  cantripIds: string[];
  knownSpellIds: string[];
  spellbookSpellIds: string[];
  preparedSpellIds: string[];
  expertiseSkillChoices: string[];
  weaponMasteryChoices: string[];
  asiMode: "feat" | "ability";
  asiAbilityMode: "+2" | "+1+1";
  asiFeatId: string;
  asiAbilityChoices: AbilityKey[];
  speciesSkillChoices: string[];
  backgroundSkillChoices: string[];
  classSkillChoices: string[];
  languageChoices: string[];
  speciesSizeChoice: "Medium" | "Small" | "";
  speciesOriginFeatId: string;
  speciesChoiceIds: Record<string, string>;
  originFeatId: string;
  equipmentChoiceIds: Record<string, string>;
  abilityChoices: AbilityKey[];
}

export interface GuidedChoiceSpec {
  subclassOptions: ClassSubclassEntry[];
  classFeatOptions: FeatEntry[];
  classFeatCount: number;
  optionalFeatureOptions: CompendiumOptionalFeatureEntry[];
  optionalFeatureCount: number;
  classChoiceGroups: CompendiumChoiceGroup[];
  featChoiceGroups: Record<string, CompendiumChoiceGroup[]>;
  cantripOptions: SpellEntry[];
  cantripCount: number;
  knownSpellOptions: SpellEntry[];
  knownSpellCount: number;
  knownSpellLabel?: string;
  spellbookOptions: SpellEntry[];
  spellbookCount: number;
  preparedSpellOptions: SpellEntry[];
  preparedSpellCount: number;
  preparedSpellPreviousIds: string[];
  preparedSpellReplacementLimit: number | "all";
  preparedSpellTrigger: "levelUp" | "longRest";
  languageOptions: string[];
  languageCount: number;
  sizeOptions: Array<"Tiny" | "Small" | "Medium" | "Large">;
  expertiseSkillOptions: SkillEntry[];
  expertiseCount: number;
  weaponMasteryOptions: string[];
  weaponMasteryCount: number;
  abilityImprovementCount: number;
  hitDieFaces: number;
  conModifier: number;
  averageHpGain: number;
}

export interface SpellSelectionConfig {
  title: string;
  subtitle: string;
  spells: SpellEntry[];
  selectedSpellIds: string[];
  maxSelections?: number;
  lockEligibilityFilters?: boolean;
  applyLabel: string;
  validateSelection?: (spellIds: string[]) => string | null;
  onApply: (spellIds: string[]) => void;
}
