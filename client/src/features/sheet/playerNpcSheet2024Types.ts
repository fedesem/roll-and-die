import type {
  AbilityKey,
  ActorSheet,
  CampaignSnapshot,
  ClassSubclassEntry,
  CompendiumOptionalFeatureEntry,
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
}

export type SheetCompendium = CampaignSnapshot["compendium"];
export type SheetTab = "main" | "edit";
export type RollMode = "normal" | "advantage" | "disadvantage";
export type GuidedFlowMode = "setup" | "levelup";
export type SpellSelectionTarget =
  | "mainPrepared"
  | "longRestPrepared"
  | "editKnown"
  | "editPrepared"
  | "editSpellbook"
  | "editAlwaysPrepared"
  | "editAtWill"
  | "editPerShortRest"
  | "editPerLongRest"
  | "guideCantrips"
  | "guideKnown"
  | "guideSpellbook";

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

export interface GuidedSetupState {
  speciesId: string;
  backgroundId: string;
  classId: string;
  subclassId: string;
  baseAbilities: ActorSheet["abilities"];
  backgroundAbilityModeId: string;
  classFeatIds: string[];
  optionalFeatureIds: string[];
  cantripIds: string[];
  knownSpellIds: string[];
  spellbookSpellIds: string[];
  expertiseSkillChoices: string[];
  asiMode: "feat" | "ability";
  asiFeatId: string;
  asiAbilityChoices: AbilityKey[];
  speciesSkillChoices: string[];
  backgroundSkillChoices: string[];
  classSkillChoices: string[];
  speciesOriginFeatId: string;
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
  cantripOptions: SpellEntry[];
  cantripCount: number;
  knownSpellOptions: SpellEntry[];
  knownSpellCount: number;
  spellbookOptions: SpellEntry[];
  spellbookCount: number;
  expertiseSkillOptions: SkillEntry[];
  expertiseCount: number;
  abilityImprovementCount: number;
}

export interface SpellSelectionConfig {
  title: string;
  subtitle: string;
  spells: SpellEntry[];
  selectedSpellIds: string[];
  maxSelections?: number;
  applyLabel: string;
  onApply: (spellIds: string[]) => void;
}
