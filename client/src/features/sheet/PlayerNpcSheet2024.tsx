import {
  Backpack,
  BookOpen,
  Brain,
  Coins,
  Dice6,
  Edit3,
  Heart,
  ImagePlus,
  Plus,
  RotateCcw,
  Shield,
  Skull,
  Sparkles,
  Swords,
  ThumbsDown,
  ThumbsUp,
  WandSparkles,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";

import type {
  AbilityKey,
  ActorClassEntry,
  ActorSheet,
  ArmorEntry,
  AttackEntry,
  CampaignSnapshot,
  ClassEntry,
  ClassSubclassEntry,
  CompendiumBackgroundEntry,
  CompendiumEquipmentGroup,
  CompendiumItemEntry,
  CompendiumOptionalFeatureEntry,
  CompendiumReferenceEntry,
  CompendiumSpeciesEntry,
  FeatEntry,
  InventoryEntry,
  MemberRole,
  PlayerNpcBuildSelection,
  ResourceEntry,
  SkillEntry,
  SpellEntry,
  SpellSlotTrack
} from "@shared/types";
import { CREATURE_SIZE_OPTIONS } from "@shared/tokenGeometry";

import { RulesText } from "../../components/admin/AdminPreview";
import { FloatingLayer, anchorFromRect, type FloatingAnchor } from "../../components/FloatingLayer";
import { IconButton } from "../../components/IconButton";
import { ModalFrame } from "../../components/ModalFrame";
import { NumericInput } from "../../components/NumericInput";
import { useWorkspaceModalHeader } from "../../components/WorkspaceModal";
import { resolveAssetUrl } from "../../lib/assets";
import { uploadImageAsset } from "../../services/assetService";
import { RestDialog } from "./RestDialog";
import { SpellSelectionModal } from "./SpellSelectionModal";
import styles from "./PlayerNpcSheet2024.module.css";
import {
  abilityModifier,
  abilityModifierTotal,
  abilityOrder,
  abilityScoreTotal,
  availableClassFeatures,
  cloneActor,
  currencyOrder,
  derivedArmorClass,
  derivedSpeed,
  featMatchesClassFilter,
  findCompendiumClass,
  formatModifier,
  hitDiceAvailable,
  normalizeKey,
  proficiencyBonusForLevel,
  savingThrowTotal,
  skillTotal,
  spellAttackBonus,
  spellSaveDc,
  totalLevel
} from "./sheetUtils";

interface PlayerNpcSheet2024Props {
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

type SheetTab = "main" | "edit";
type RollMode = "normal" | "advantage" | "disadvantage";
type GuidedFlowMode = "setup" | "levelup";
type SpellSelectionTarget =
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
const NEW_GUIDED_CLASS_ID = "__new_class__";

interface DetailRowMeta {
  label: string;
  value: string;
}

interface DetailRowEntry {
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

interface DerivedResourceDefinition {
  id: string;
  name: string;
  max: number;
  resetOn: string;
  restoreAmount: number;
  description: string;
  source: string;
}

interface GuidedSetupState {
  speciesId: string;
  backgroundId: string;
  classId: string;
  subclassId: string;
  classFeatIds: string[];
  optionalFeatureIds: string[];
  cantripIds: string[];
  knownSpellIds: string[];
  spellbookSpellIds: string[];
  expertiseSkillChoices: string[];
  asiMode: "feat" | "ability";
  asiFeatId: string;
  asiAbilityChoices: AbilityKey[];
  speciesSkillChoice: string;
  speciesOriginFeatId: string;
  originFeatId: string;
  equipmentChoiceIds: Record<string, string>;
  abilityChoices: AbilityKey[];
}

interface GuidedChoiceSpec {
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

interface SpellSelectionConfig {
  title: string;
  subtitle: string;
  spells: SpellEntry[];
  selectedSpellIds: string[];
  maxSelections?: number;
  applyLabel: string;
  onApply: (spellIds: string[]) => void;
}

export function PlayerNpcSheet2024({
  token,
  actor,
  compendium,
  allowedSourceBooks,
  role,
  currentUserId,
  sheetContext,
  onSave,
  onRealtimeSave,
  onRoll
}: PlayerNpcSheet2024Props) {
  const [draft, setDraft] = useState<ActorSheet>(() => cloneActor(actor));
  const [activeTab, setActiveTab] = useState<SheetTab>(() => defaultTabForActor(actor));
  const [saving, setSaving] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [rollMode, setRollMode] = useState<RollMode>("normal");
  const [shortRestOpen, setShortRestOpen] = useState(false);
  const [longRestOpen, setLongRestOpen] = useState(false);
  const [hitDiceSelections, setHitDiceSelections] = useState<Record<string, number>>({});
  const [guidedFlowOpen, setGuidedFlowOpen] = useState(false);
  const [guidedFlowMode, setGuidedFlowMode] = useState<GuidedFlowMode>("setup");
  const [guidedClassId, setGuidedClassId] = useState("");
  const [guideError, setGuideError] = useState<string | null>(null);
  const [spellSelectionTarget, setSpellSelectionTarget] = useState<SpellSelectionTarget | null>(null);
  const [guidedSetup, setGuidedSetup] = useState<GuidedSetupState>({
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
  });
  const [featToAdd, setFeatToAdd] = useState("");
  const [longRestPreparedSpells, setLongRestPreparedSpells] = useState<string[]>([]);
  const lastMainAutosaveRef = useRef<string>("");

  useEffect(() => {
    setDraft(cloneActor(actor));
    setActiveTab(defaultTabForActor(actor));
    setSaving(false);
    setImageError(null);
    setRollMode("normal");
    setShortRestOpen(false);
    setLongRestOpen(false);
    setHitDiceSelections({});
    setGuidedFlowOpen(false);
    setGuidedFlowMode("setup");
    setGuidedClassId("");
    setGuideError(null);
    setSpellSelectionTarget(null);
    setGuidedSetup({
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
    });
    setFeatToAdd("");
    setLongRestPreparedSpells([]);
    lastMainAutosaveRef.current = JSON.stringify(buildMainAutosaveState(actor));
  }, [actor]);

  const canEdit = role === "dm" || actor.ownerId === currentUserId;
  const canRoll = role === "dm" || actor.ownerId === currentUserId;
  const totalActorLevel = useMemo(() => totalLevel(draft), [draft]);
  const proficiencyBonus = useMemo(() => proficiencyBonusForLevel(totalActorLevel), [totalActorLevel]);
  const skillLookup = useMemo(
    () => new Map(compendium.skills.map((entry) => [normalizeKey(entry.name), entry])),
    [compendium.skills]
  );
  const derivedSpellSlots = useMemo(() => deriveSpellSlots(draft, compendium.classes), [compendium.classes, draft]);
  const derivedResourceDefinitions = useMemo(() => deriveClassResources(draft, compendium.classes), [compendium.classes, draft]);
  const displayedResources = useMemo(() => mergeDerivedResources(draft.resources, derivedResourceDefinitions), [derivedResourceDefinitions, draft.resources]);
  const resourceDefinitionLookup = useMemo(
    () => new Map(derivedResourceDefinitions.map((entry) => [normalizeKey(entry.name), entry])),
    [derivedResourceDefinitions]
  );
  const preparedSpellLimit = useMemo(() => derivePreparedSpellLimit(draft, compendium.classes), [compendium.classes, draft]);
  const derivedHitPointMax = useMemo(() => deriveGuidedHitPointMax(draft), [draft]);
  const hitPointDisplay = useMemo(() => deriveHitPointDisplayState(draft.hitPoints, derivedHitPointMax), [derivedHitPointMax, draft.hitPoints]);
  const selectedSpecies = useMemo(
    () => compendium.races.find((entry) => entry.id === draft.build?.speciesId) ?? null,
    [compendium.races, draft.build?.speciesId]
  );
  const selectedBackground = useMemo(
    () => compendium.backgrounds.find((entry) => entry.id === draft.build?.backgroundId) ?? null,
    [compendium.backgrounds, draft.build?.backgroundId]
  );
  const exhaustionCondition = useMemo(
    () => findByName(compendium.conditions, "Exhaustion") ?? null,
    [compendium.conditions]
  );
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
  const guidedSpeciesSkillChoices = useMemo(() => deriveSpeciesSkillOptions(guidedSelectedSpecies, compendium.skills), [guidedSelectedSpecies, compendium.skills]);
  const guidedSpeciesOriginFeatOptions = useMemo(
    () => deriveSpeciesOriginFeatOptions(guidedSelectedSpecies, compendium.feats),
    [guidedSelectedSpecies, compendium.feats]
  );
  const guidedAbilityChoiceConfig = useMemo(
    () => deriveBackgroundAbilityConfig(guidedSelectedBackground),
    [guidedSelectedBackground]
  );
  const guidedOriginFeatOptions = useMemo(
    () => deriveOriginFeatOptions(guidedSelectedBackground, compendium.feats),
    [guidedSelectedBackground, compendium.feats]
  );
  const guidedEquipmentGroups = useMemo(() => deriveBackgroundEquipmentGroups(guidedSelectedBackground), [guidedSelectedBackground]);
  const derivedEquipment = useMemo(
    () => deriveInventoryEquipment(draft, compendium.items, proficiencyBonus),
    [compendium.items, draft, proficiencyBonus]
  );
  const displayedArmorItems = useMemo(
    () => mergeDerivedArmorItems(draft.armorItems, derivedEquipment.armorItems),
    [derivedEquipment.armorItems, draft.armorItems]
  );
  const displayedAttacks = useMemo(
    () => mergeDerivedAttacks(draft.attacks, derivedEquipment.attacks),
    [derivedEquipment.attacks, draft.attacks]
  );
  const actorWithDerivedNumbers = useMemo(
    () => ({
      ...draft,
      proficiencyBonus,
      spellSlots: derivedSpellSlots,
      armorItems: displayedArmorItems,
      attacks: displayedAttacks
    }),
    [derivedSpellSlots, displayedArmorItems, displayedAttacks, draft, proficiencyBonus]
  );
  const armorClass = useMemo(() => derivedArmorClass(actorWithDerivedNumbers), [actorWithDerivedNumbers]);
  const speed = useMemo(() => derivedSpeed(actorWithDerivedNumbers), [actorWithDerivedNumbers]);
  const spellAttack = useMemo(() => spellAttackBonus(actorWithDerivedNumbers), [actorWithDerivedNumbers]);
  const spellSave = useMemo(() => spellSaveDc(actorWithDerivedNumbers), [actorWithDerivedNumbers]);
  const featureRows = useMemo(() => collectFeatureRows(draft, compendium, selectedSpecies, selectedBackground), [compendium, draft, selectedBackground, selectedSpecies]);
  const spellCollections = useMemo(
    () => deriveActorSpellCollections(draft, compendium, derivedSpellSlots),
    [compendium, derivedSpellSlots, draft]
  );
  const spellRows = useMemo(
    () => collectSpellRows(spellCollections.all, draft.preparedSpells, compendium.spells, preparedSpellLimit),
    [compendium.spells, draft.preparedSpells, preparedSpellLimit, spellCollections.all]
  );
  const featRows = useMemo(() => collectFeatRows(draft.feats, compendium.feats), [compendium.feats, draft.feats]);
  const filteredFeats = useMemo(
    () => compendium.feats.filter((entry) => featMatchesClassFilter(entry, draft.classes)),
    [compendium.feats, draft.classes]
  );
  const canPrepareSpells = useMemo(
    () =>
      draft.classes.some((actorClass) => {
        const entry = findCompendiumClass(actorClass, compendium.classes);
        return entry?.spellPreparation === "prepared" || entry?.spellPreparation === "spellbook";
      }),
    [compendium.classes, draft.classes]
  );
  const preparableSpellEntries = useMemo(
    () => findSpellEntriesByNames(spellCollections.preparable, compendium.spells),
    [compendium.spells, spellCollections.preparable]
  );
  const longRestPreparedSpellRows = useMemo(
    () => collectSpellRows(longRestPreparedSpells, longRestPreparedSpells, compendium.spells, preparedSpellLimit),
    [compendium.spells, longRestPreparedSpells, preparedSpellLimit]
  );
  const editReadOnly = !canEdit;
  const needsInitialGuidedSetup = draft.classes.length === 0;
  const hasMainTab = !needsInitialGuidedSetup;
  const mainTabInteractive = sheetContext === "board" && hasMainTab;
  const showSetupGuideOnly = needsInitialGuidedSetup && guidedFlowOpen && guidedFlowMode === "setup";
  const mainAutosaveSignature = useMemo(() => JSON.stringify(buildMainAutosaveState(draft)), [draft]);
  const actorMainAutosaveSignature = useMemo(() => JSON.stringify(buildMainAutosaveState(actor)), [actor]);

  useEffect(() => {
    if (!guidedFlowOpen) {
      return;
    }

    setGuidedSetup((current) => ({
      ...current,
      classFeatIds: padGuideSelections(current.classFeatIds, guidedChoiceSpec.classFeatCount, guidedChoiceSpec.classFeatOptions.map((entry) => entry.id)),
      optionalFeatureIds: padGuideSelections(current.optionalFeatureIds, guidedChoiceSpec.optionalFeatureCount, guidedChoiceSpec.optionalFeatureOptions.map((entry) => entry.id)),
      cantripIds: current.cantripIds
        .filter((entry) => guidedChoiceSpec.cantripOptions.some((spell) => spell.id === entry))
        .slice(0, guidedChoiceSpec.cantripCount),
      knownSpellIds: current.knownSpellIds
        .filter((entry) => guidedChoiceSpec.knownSpellOptions.some((spell) => spell.id === entry))
        .slice(0, guidedChoiceSpec.knownSpellCount),
      spellbookSpellIds: current.spellbookSpellIds
        .filter((entry) => guidedChoiceSpec.spellbookOptions.some((spell) => spell.id === entry))
        .slice(0, guidedChoiceSpec.spellbookCount),
      expertiseSkillChoices: padGuideSelections(current.expertiseSkillChoices, guidedChoiceSpec.expertiseCount, guidedChoiceSpec.expertiseSkillOptions.map((entry) => entry.name)),
      asiFeatId: current.asiFeatId || filteredFeats[0]?.id || "",
      asiAbilityChoices:
        current.asiAbilityChoices.length === guidedChoiceSpec.abilityImprovementCount * 2
          ? current.asiAbilityChoices
          : Array.from({ length: guidedChoiceSpec.abilityImprovementCount * 2 }, (_, index) => abilityOrder[index % abilityOrder.length]?.key ?? "str")
      }));
  }, [filteredFeats, guidedChoiceSpec, guidedFlowOpen]);

  useEffect(() => {
    if (needsInitialGuidedSetup && activeTab !== "edit") {
      setActiveTab("edit");
    }
  }, [activeTab, needsInitialGuidedSetup]);

  function updateDraft(recipe: (current: ActorSheet) => ActorSheet) {
    setDraft((current) => recipe(current));
  }

  function updateField<K extends keyof ActorSheet>(key: K, value: ActorSheet[K]) {
    updateDraft((current) => ({ ...current, [key]: value }));
  }

  function renderRulesText(text: string) {
    return (
      <RulesText
        text={text}
        spellEntries={compendium.spells}
        featEntries={compendium.feats}
        classEntries={compendium.classes}
        variantRuleEntries={compendium.variantRules}
        conditionEntries={compendium.conditions}
        itemEntries={compendium.items}
        optionalFeatureEntries={compendium.optionalFeatures}
        languageEntries={compendium.languages}
        skillEntries={compendium.skills}
      />
    );
  }

  function getSpellSelectionConfig(target: SpellSelectionTarget): SpellSelectionConfig {
    switch (target) {
      case "mainPrepared":
        return {
          title: "Prepare Spells",
          subtitle: "Choose the spells currently prepared on this sheet.",
          spells: preparableSpellEntries,
          selectedSpellIds: findSpellIdsByNames(draft.preparedSpells, compendium.spells),
          maxSelections: preparedSpellLimit > 0 ? preparedSpellLimit : undefined,
          applyLabel: "Apply Prepared Spells",
          onApply: (spellIds) => updateField("preparedSpells", findSpellNamesByIds(spellIds, compendium.spells))
        };
      case "longRestPrepared":
        return {
          title: "Long Rest Preparation",
          subtitle: "Choose the spells this actor will prepare when the long rest completes.",
          spells: preparableSpellEntries,
          selectedSpellIds: findSpellIdsByNames(longRestPreparedSpells, compendium.spells),
          maxSelections: preparedSpellLimit > 0 ? preparedSpellLimit : undefined,
          applyLabel: "Apply Rest Preparation",
          onApply: (spellIds) => setLongRestPreparedSpells(findSpellNamesByIds(spellIds, compendium.spells))
        };
      case "editKnown":
        return {
          title: "Known Spells",
          subtitle: "Add or remove spells from the actor spell list.",
          spells: compendium.spells,
          selectedSpellIds: findSpellIdsByNames(draft.spells, compendium.spells),
          applyLabel: "Apply Known Spells",
          onApply: (spellIds) => updateField("spells", findSpellNamesByIds(spellIds, compendium.spells))
        };
      case "editPrepared":
        return {
          title: "Prepared Spells",
          subtitle: "Manage the actor's prepared spells directly from the edit tab.",
          spells: preparableSpellEntries,
          selectedSpellIds: findSpellIdsByNames(draft.preparedSpells, compendium.spells),
          maxSelections: preparedSpellLimit > 0 ? preparedSpellLimit : undefined,
          applyLabel: "Apply Prepared Spells",
          onApply: (spellIds) => updateField("preparedSpells", findSpellNamesByIds(spellIds, compendium.spells))
        };
      case "editSpellbook":
        return {
          title: "Spellbook Spells",
          subtitle: "Manage the spellbook entries stored on this actor.",
          spells: compendium.spells,
          selectedSpellIds: findSpellIdsByNames(draft.spellState.spellbook, compendium.spells),
          applyLabel: "Apply Spellbook",
          onApply: (spellIds) =>
            updateField("spellState", { ...draft.spellState, spellbook: findSpellNamesByIds(spellIds, compendium.spells) })
        };
      case "editAlwaysPrepared":
        return {
          title: "Always Prepared Spells",
          subtitle: "Manage always-prepared spells granted directly on this actor.",
          spells: compendium.spells,
          selectedSpellIds: findSpellIdsByNames(draft.spellState.alwaysPrepared, compendium.spells),
          applyLabel: "Apply Always Prepared",
          onApply: (spellIds) =>
            updateField("spellState", { ...draft.spellState, alwaysPrepared: findSpellNamesByIds(spellIds, compendium.spells) })
        };
      case "editAtWill":
        return {
          title: "At-Will Spells",
          subtitle: "Manage spells that can be cast at will.",
          spells: compendium.spells,
          selectedSpellIds: findSpellIdsByNames(draft.spellState.atWill, compendium.spells),
          applyLabel: "Apply At-Will Spells",
          onApply: (spellIds) =>
            updateField("spellState", { ...draft.spellState, atWill: findSpellNamesByIds(spellIds, compendium.spells) })
        };
      case "editPerShortRest":
        return {
          title: "Short Rest Spells",
          subtitle: "Manage spells that refresh on a short rest.",
          spells: compendium.spells,
          selectedSpellIds: findSpellIdsByNames(draft.spellState.perShortRest, compendium.spells),
          applyLabel: "Apply Short Rest Spells",
          onApply: (spellIds) =>
            updateField("spellState", { ...draft.spellState, perShortRest: findSpellNamesByIds(spellIds, compendium.spells) })
        };
      case "editPerLongRest":
        return {
          title: "Long Rest Spells",
          subtitle: "Manage spells that refresh on a long rest.",
          spells: compendium.spells,
          selectedSpellIds: findSpellIdsByNames(draft.spellState.perLongRest, compendium.spells),
          applyLabel: "Apply Long Rest Spells",
          onApply: (spellIds) =>
            updateField("spellState", { ...draft.spellState, perLongRest: findSpellNamesByIds(spellIds, compendium.spells) })
        };
      case "guideCantrips":
        return {
          title: "Guide Cantrips",
          subtitle: "Choose the cantrips granted by this guide step.",
          spells: guidedChoiceSpec.cantripOptions,
          selectedSpellIds: guidedSetup.cantripIds.filter((entry) => guidedChoiceSpec.cantripOptions.some((spell) => spell.id === entry)),
          maxSelections: guidedChoiceSpec.cantripCount > 0 ? guidedChoiceSpec.cantripCount : undefined,
          applyLabel: "Apply Cantrips",
          onApply: (spellIds) =>
            setGuidedSetup((current) => ({
              ...current,
              cantripIds: spellIds.slice(0, guidedChoiceSpec.cantripCount)
            }))
        };
      case "guideKnown":
        return {
          title: "Guide Known Spells",
          subtitle: "Choose the spells learned from this guide step.",
          spells: guidedChoiceSpec.knownSpellOptions,
          selectedSpellIds: guidedSetup.knownSpellIds.filter((entry) => guidedChoiceSpec.knownSpellOptions.some((spell) => spell.id === entry)),
          maxSelections: guidedChoiceSpec.knownSpellCount > 0 ? guidedChoiceSpec.knownSpellCount : undefined,
          applyLabel: "Apply Known Spells",
          onApply: (spellIds) =>
            setGuidedSetup((current) => ({
              ...current,
              knownSpellIds: spellIds.slice(0, guidedChoiceSpec.knownSpellCount)
            }))
        };
      case "guideSpellbook":
        return {
          title: "Guide Spellbook",
          subtitle: "Choose the spellbook spells granted by this guide step.",
          spells: guidedChoiceSpec.spellbookOptions,
          selectedSpellIds: guidedSetup.spellbookSpellIds.filter((entry) => guidedChoiceSpec.spellbookOptions.some((spell) => spell.id === entry)),
          maxSelections: guidedChoiceSpec.spellbookCount > 0 ? guidedChoiceSpec.spellbookCount : undefined,
          applyLabel: "Apply Spellbook Spells",
          onApply: (spellIds) =>
            setGuidedSetup((current) => ({
              ...current,
              spellbookSpellIds: spellIds.slice(0, guidedChoiceSpec.spellbookCount)
            }))
        };
    }
  }

  const spellSelectionConfig = spellSelectionTarget ? getSpellSelectionConfig(spellSelectionTarget) : null;

  function updateAbility(key: AbilityKey, value: number) {
    updateDraft((current) => ({
      ...current,
      abilities: {
        ...current.abilities,
        [key]: value
      }
    }));
  }

  function updateClass(index: number, patch: Partial<ActorClassEntry>) {
    updateDraft((current) => ({
      ...current,
      classes: current.classes.map((entry, currentIndex) => (currentIndex === index ? { ...entry, ...patch } : entry))
    }));
  }

  function updateSkill(index: number, patch: Partial<SkillEntry>) {
    updateDraft((current) => ({
      ...current,
      skills: current.skills.map((entry, currentIndex) => (currentIndex === index ? { ...entry, ...patch } : entry))
    }));
  }

  function updateAttack(index: number, patch: Partial<AttackEntry>) {
    updateDraft((current) => ({
      ...current,
      attacks: current.attacks.map((entry, currentIndex) => (currentIndex === index ? { ...entry, ...patch } : entry))
    }));
  }

  function updateArmor(index: number, patch: Partial<ArmorEntry>) {
    updateDraft((current) => ({
      ...current,
      armorItems: current.armorItems.map((entry, currentIndex) => (currentIndex === index ? { ...entry, ...patch } : entry))
    }));
  }

  function updateInventory(index: number, patch: Partial<InventoryEntry>) {
    updateDraft((current) => ({
      ...current,
      inventory: current.inventory.map((entry, currentIndex) => (currentIndex === index ? { ...entry, ...patch } : entry))
    }));
  }

  function removeFromArray<K extends "attacks" | "armorItems" | "resources" | "inventory" | "classes">(key: K, index: number) {
    updateDraft((current) => ({
      ...current,
      [key]: current[key].filter((_, currentIndex) => currentIndex !== index)
    }));
  }

  function updateSpellSlotLevel(level: number, patch: Partial<SpellSlotTrack>) {
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
  }

  function updateResourceById(resourceId: string, patch: Partial<ResourceEntry>) {
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
  }

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

        if (sheetContext === "board" && activeTab === "main" && onRealtimeSave) {
          await onRealtimeSave(finalizedActor);
        } else {
          await onSave(finalizedActor);
        }
        lastMainAutosaveRef.current = JSON.stringify(buildMainAutosaveState(nextDraft));
      } finally {
        setSaving(false);
      }
    },
    [activeTab, compendium, draft, onRealtimeSave, onSave, sheetContext]
  );

  useEffect(() => {
    if (!canEdit || !mainTabInteractive || activeTab !== "main" || guidedFlowOpen || shortRestOpen || longRestOpen) {
      return;
    }

    if (mainAutosaveSignature === actorMainAutosaveSignature || lastMainAutosaveRef.current === mainAutosaveSignature) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveCurrent(draft);
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    activeTab,
    actorMainAutosaveSignature,
    canEdit,
    draft,
    guidedFlowOpen,
    longRestOpen,
    mainTabInteractive,
    mainAutosaveSignature,
    saveCurrent,
    shortRestOpen
  ]);

  async function handleRoll(modifier: number, label: string) {
    if (!canRoll || sheetContext !== "board") {
      return;
    }

    const notation = buildD20Notation(modifier, rollMode);
    setRollMode("normal");
    await onRoll(notation, `${draft.name} ${label}`);
  }

  async function handleNotationRoll(notation: string, label: string, resetsRollMode = false) {
    if (!canRoll || sheetContext !== "board") {
      return;
    }

    if (resetsRollMode) {
      setRollMode("normal");
    }

    await onRoll(notation.replace(/\s+/g, ""), `${draft.name} ${label}`);
  }

  async function handleInitiativeRoll() {
    if (!canRoll || sheetContext !== "board") {
      return;
    }

    const notation = buildD20Notation(draft.initiative, rollMode);
    setRollMode("normal");
    await onRoll(notation, `${draft.name} initiative`);
  }

  function updateDeathSaves(next: ActorSheet["deathSaves"] | ((current: ActorSheet["deathSaves"]) => ActorSheet["deathSaves"])) {
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
  }

  function recordDeathSave(result: "success" | "failure") {
    updateDeathSaves((current) => {
      const history = [...(current.history ?? []), result].slice(-3);

      return {
        successes: history.filter((entry) => entry === "success").length,
        failures: history.filter((entry) => entry === "failure").length,
        history
      };
    });
  }

  function resetDeathSaves() {
    updateDeathSaves({
      successes: 0,
      failures: 0,
      history: []
    });
  }

  async function handleAutomaticDeathSave() {
    if (!canRoll || sheetContext !== "board") {
      return;
    }

    const roll = rollDie(20);
    const result = roll >= 10 ? "success" : "failure";
    recordDeathSave(result);
    await onRoll(buildStaticRollNotation(roll), `${draft.name} death save (${roll})`);
  }

  useWorkspaceModalHeader(
    hasMainTab ? (
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-900/90 p-1">
          {(["normal", "advantage", "disadvantage"] as const).map((mode) => (
            <label
              key={mode}
              className={`rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] transition ${
                mainTabInteractive ? "cursor-pointer" : "cursor-default opacity-50"
              } ${
                rollMode === mode ? "bg-slate-100 text-slate-950" : "text-slate-200 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <input className="sr-only" type="radio" checked={rollMode === mode} disabled={!mainTabInteractive} onChange={() => setRollMode(mode)} />
              {mode === "normal" ? "Normal" : mode === "advantage" ? "Adv" : "Dis"}
            </label>
          ))}
        </div>
        <IconButton icon={<Edit3 size={14} />} label="Toggle edit mode" active={activeTab === "edit"} onClick={() => setActiveTab(activeTab === "edit" ? "main" : "edit")} />
      </div>
    ) : null
  );

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
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

    const currentSubclassId = "";
    const guideValidation = validateGuideSelections({
      actor: draft,
      spec: guidedChoiceSpec,
      setup: guidedSetup,
      mode: "setup",
      targetClass: classEntry,
      currentSubclassId
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

    const currentSubclassId =
      targetActorClass ? draft.build?.classes.find((entry) => entry.id === targetActorClass.id)?.subclassId ?? "" : "";
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

    const constitutionModifier = abilityModifierTotal(actorWithDerivedNumbers, "con");
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

  function addFeatById(featId: string) {
    const feat = compendium.feats.find((entry) => entry.id === featId);

    if (!feat) {
      return;
    }

    updateDraft((current) => ({
      ...current,
      feats: current.feats.includes(feat.name) ? current.feats : [...current.feats, feat.name]
    }));
    setFeatToAdd("");
  }

  function startShortRest() {
    setHitDiceSelections(Object.fromEntries(draft.classes.map((entry) => [entry.id, 0])));
    setShortRestOpen(true);
  }

  function startLongRest() {
    setLongRestPreparedSpells([...draft.preparedSpells]);
    setLongRestOpen(true);
  }

  async function confirmShortRest() {
    const constitutionModifier = abilityModifierTotal(actorWithDerivedNumbers, "con");
    let healing = 0;
    const nextDraft = cloneActor(draft);

    nextDraft.classes = nextDraft.classes.map((entry) => {
      const spend = Math.min(hitDiceSelections[entry.id] ?? 0, hitDiceAvailable(entry));

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
  }

  async function confirmLongRest() {
    const nextDraft = cloneActor(draft);
    nextDraft.hitPoints.max = derivedHitPointMax || nextDraft.hitPoints.max;
    nextDraft.hitPoints.temp = 0;
    nextDraft.hitPoints = normalizeHitPoints(nextDraft.hitPoints, nextDraft.hitPoints.max);
    nextDraft.hitPoints.current = effectiveHitPointMax(nextDraft.hitPoints.max, nextDraft.hitPoints.reducedMax);
    nextDraft.spellSlots = deriveSpellSlots(nextDraft, compendium.classes).map((entry) => ({ ...entry, used: 0 }));
    nextDraft.resources = mergeDerivedResources(nextDraft.resources, deriveClassResources(nextDraft, compendium.classes)).map((entry) => ({
      ...entry,
      current: entry.max
    }));
    nextDraft.classes = nextDraft.classes.map((entry) => ({ ...entry, usedHitDice: Math.max(0, entry.usedHitDice - Math.floor(entry.level / 2)) }));
    nextDraft.preparedSpells = canPrepareSpells ? [...longRestPreparedSpells] : nextDraft.preparedSpells;
    setDraft(nextDraft);
    setLongRestOpen(false);
    setLongRestPreparedSpells([]);
    await saveCurrent(nextDraft);
  }

  return (
    <section className="space-y-4 text-zinc-100">
      {!showSetupGuideOnly ? (
        <>
          {activeTab === "main" ? (
        <div className={`grid gap-3 xl:grid-cols-3 ${mainTabInteractive ? "" : "pointer-events-none opacity-75 select-none"}`}>
          <div className="space-y-3">
            <SectionCard title="Main" icon={<Shield size={14} />}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <PortraitCard actor={draft} compact />
                  <div className="min-w-0">
                    <h3 className="truncate font-serif text-xl text-amber-50">{draft.name || "Unnamed Actor"}</h3>
                    <p className="truncate text-xs text-zinc-400">{[draft.species || "No species", draft.className || "No class", draft.background || "No background"].join(" • ")}</p>
                  </div>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <CompactStatChip label="Level" value={String(totalActorLevel)} />
                <CompactStatChip label="AC" value={String(armorClass)} />
                <CompactStatChip label="Speed" value={`${speed} ft`} />
                <CompactStatChip label="PB" value={formatModifier(proficiencyBonus)} />
                <CompactStatChip
                  label="Initiative"
                  value={draft.initiativeRoll !== null && draft.initiativeRoll !== undefined ? String(draft.initiativeRoll) : formatModifier(draft.initiative)}
                  onClick={() => void handleInitiativeRoll()}
                />
                <CompactStatChip label="Spell DC" value={String(spellSave)} />
                <CompactStatChip label="Spell Attack" value={formatModifier(spellAttack)} onClick={() => void handleRoll(spellAttack, "spell attack")} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className={miniButtonClass} onClick={() => void startShortRest()}>
                  Short Rest
                </button>
                <button type="button" className={miniButtonClass} onClick={() => startLongRest()}>
                  Long Rest
                </button>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-[auto,minmax(0,1fr)] sm:items-end">
                <button type="button" className={miniButtonClass} onClick={() => updateField("inspiration", !draft.inspiration)}>
                  Inspiration {draft.inspiration ? "On" : "Off"}
                </button>
                <div className="min-w-0 sm:min-w-[200px]">
                  <ExhaustionTrack
                    level={draft.exhaustionLevel}
                    onChange={(level) => updateField("exhaustionLevel", level)}
                    condition={exhaustionCondition}
                    renderText={renderRulesText}
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="XP" hint="Experience points earned by this actor.">
                  <NumericInput className={inputClassCompact} min={0} value={draft.experience} title="Experience points earned by this actor." onValueChange={(value) => updateField("experience", value ?? 0)} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Abilities" icon={<Brain size={14} />}>
              <div className="grid grid-cols-2 gap-2">
                {abilityOrder.map((ability) => {
                  const score = abilityScoreTotal(actorWithDerivedNumbers, ability.key);
                  const modifier = abilityModifier(score);
                  const save = savingThrowTotal(actorWithDerivedNumbers, ability.key);
                  return (
                    <AbilityMiniCard
                      key={ability.key}
                      label={ability.label}
                      score={score}
                      modifier={modifier}
                      save={save}
                      onCheck={() => void handleRoll(modifier, `${ability.label} check`)}
                      onSave={() => void handleRoll(save, `${ability.label} save`)}
                    />
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Skills" icon={<Sparkles size={14} />}>
              <div className="grid gap-1.5">
                {draft.skills.map((skill) => {
                  const total = skillTotal(actorWithDerivedNumbers, skill);
                  const proficiencyLabel = skill.expertise ? "Exp" : skill.proficient ? "Prof" : "";
                  return (
                    <div
                      key={skill.id}
                      className="cursor-pointer border border-white/8 bg-black/20 px-2 py-1.5 transition hover:border-amber-500/60"
                      onClick={() => void handleRoll(total, `${skill.name} check`)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs text-zinc-100">{skill.name}</p>
                          <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                            {skill.ability.toUpperCase()}{proficiencyLabel ? ` • ${proficiencyLabel}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-amber-50">{formatModifier(total)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </div>

          <div className="space-y-3">
            <SectionCard title="Vitals" icon={<Heart size={14} />}>
              <HitPointBar
                current={hitPointDisplay.current}
                damage={hitPointDisplay.damage}
                temp={hitPointDisplay.temp}
                effectiveMax={hitPointDisplay.effectiveMax}
                baseMax={hitPointDisplay.baseMax}
                reducedMax={hitPointDisplay.reducedMax}
              />
              <div className="grid gap-1.5 sm:grid-cols-3">
                <Field label="HP" hint="Current hit points after damage is applied.">
                  <NumericInput className={inputClassCompact} min={0} max={hitPointDisplay.effectiveMax} value={draft.hitPoints.current} title="Current hit points after damage is applied." onValueChange={(value) => updateHitPoints("current", String(value ?? 0), updateDraft, derivedHitPointMax)} />
                </Field>
                <Field label="THP" hint="Temporary hit points are lost before normal hit points.">
                  <NumericInput className={inputClassCompact} min={0} value={draft.hitPoints.temp} title="Temporary hit points are lost before normal hit points." onValueChange={(value) => updateHitPoints("temp", String(value ?? 0), updateDraft, derivedHitPointMax)} />
                </Field>
                <Field label="Red Max" hint="This reduces the actor's maximum hit points.">
                  <NumericInput className={inputClassCompact} min={0} value={draft.hitPoints.reducedMax} title="This reduces the actor's maximum hit points." onValueChange={(value) => updateHitPoints("reducedMax", String(value ?? 0), updateDraft, derivedHitPointMax)} />
                </Field>
              </div>
              <DeathSaveTracker
                deathSaves={draft.deathSaves}
                onSuccess={() => recordDeathSave("success")}
                onFailure={() => recordDeathSave("failure")}
                onReset={resetDeathSaves}
                onRoll={() => void handleAutomaticDeathSave()}
              />
            </SectionCard>

            <SectionCard title="Attacks & Armor" icon={<Swords size={14} />}>
              <div className="space-y-2">
                {displayedAttacks.length > 0 ? (
                  displayedAttacks.map((attack) => (
                    <div key={attack.id} className="border border-white/8 bg-black/20 p-2">
                      <p className="text-xs text-zinc-100">{attack.name || "Unnamed Attack"}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                        <span className="cursor-pointer hover:text-amber-50" onClick={() => void handleRoll(attack.attackBonus, `${attack.name} attack`)}>
                          {formatModifier(attack.attackBonus)} to hit
                        </span>
                        {attack.damage ? (
                          <span className="cursor-pointer hover:text-amber-50" onClick={() => void handleNotationRoll(attack.damage, `${attack.name} damage`)}>
                            {attack.damage} {attack.damageType}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-zinc-500">No attacks are available yet.</p>
                )}
              </div>
              {displayedArmorItems.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {displayedArmorItems.filter((entry) => entry.equipped).map((entry) => (
                    <span key={entry.id} className="border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-300">
                      {entry.name} • AC {entry.armorClass + entry.bonus}
                    </span>
                  ))}
                </div>
              ) : null}
            </SectionCard>

            <SectionCard title="Spellcasting" icon={<WandSparkles size={14} />}>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="border border-white/8 bg-black/20 px-2 py-2 text-zinc-100">
                  <p className="text-[9px] uppercase tracking-[0.18em] text-amber-400/80">Concentration</p>
                  <div className="mt-1 flex items-center gap-2">
                    <input type="checkbox" checked={draft.concentration} onChange={(event) => updateField("concentration", event.target.checked)} />
                    <span className="text-sm font-medium text-amber-50">{draft.concentration ? "Active" : "Off"}</span>
                  </div>
                </label>
                <CompactStatChip label="Spell DC" value={String(spellSave)} />
                <CompactStatChip label="Spell Attack" value={formatModifier(spellAttack)} onClick={() => void handleRoll(spellAttack, "spell attack")} />
              </div>
              <div className="space-y-2">
                {derivedSpellSlots.filter((entry) => entry.total > 0).length === 0 ? (
                  <p className="text-xs text-zinc-500">No spell slots on this sheet yet.</p>
                ) : (
                  derivedSpellSlots.filter((entry) => entry.total > 0).map((slot) => (
                    <div key={slot.level} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-200">Level {slot.level}</span>
                        <span className="text-zinc-500">{slot.total - slot.used}/{slot.total}</span>
                      </div>
                      <UsableTrack
                        total={slot.total}
                        available={slot.total - slot.used}
                        onChange={(available) => updateSpellSlotLevel(slot.level, { used: Math.max(0, slot.total - available) })}
                      />
                    </div>
                  ))
                )}
              </div>
            </SectionCard>

            <SectionCard title="Resources" icon={<Heart size={14} />}>
              <div className="space-y-2">
                {displayedResources.map((resource) => (
                  <div key={resource.id} className="space-y-1 border border-white/8 bg-black/20 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-zinc-100">{resource.name}</p>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{resource.current}/{resource.max}</p>
                    </div>
                    <UsableTrack total={Math.max(resource.max, 0)} available={resource.current} onChange={(available) => updateResourceById(resource.id, { current: available })} />
                  </div>
                ))}
                {displayedResources.length === 0 ? <p className="text-xs text-zinc-500">No resources tracked yet.</p> : null}
              </div>
            </SectionCard>
          </div>

          <div className="space-y-3">
            <SectionCard title="Features" icon={<Sparkles size={16} />}>
              <DetailCollection entries={featureRows} emptyMessage="No species, background, class, feat, or feature data is available yet." renderText={renderRulesText} />
            </SectionCard>

            <SectionCard title="Spells" icon={<BookOpen size={16} />}>
              <DetailCollection
                title="Spell List"
                entries={spellRows.map((entry) => ({
                  ...entry,
                  onRemove: undefined,
                  meta: canPrepareSpells
                    ? [
                        ...(entry.meta ?? []),
                        {
                          label: "Preparation",
                          value: spellCollections.alwaysPrepared.includes(entry.title)
                            ? "Always Prepared"
                            : draft.preparedSpells.includes(entry.title)
                              ? "Prepared"
                              : spellCollections.preparable.includes(entry.title)
                                ? "Available"
                                : "Known"
                        }
                      ]
                    : entry.meta
                }))}
                emptyMessage="No spells on this sheet yet."
                headerAction={
                  canPrepareSpells ? (
                    <button type="button" className={secondaryButtonClass} onClick={() => setSpellSelectionTarget("mainPrepared")}>
                      <Plus size={14} />
                      Prepare Spells
                    </button>
                  ) : null
                }
                renderText={renderRulesText}
              />
            </SectionCard>

            <SectionCard title="Inventory & Currency" icon={<Backpack size={16} />}>
              <div className="grid gap-2 md:grid-cols-5">
                {currencyOrder.map((currencyKey) => (
                  <Field key={currencyKey} label={currencyKey.toUpperCase()}>
                    <NumericInput
                      className={inputClassCompact}
                      value={draft.currency[currencyKey]}
                      onValueChange={(value) =>
                        updateField("currency", {
                          ...draft.currency,
                          [currencyKey]: value ?? 0
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
              <div className="space-y-3">
                {draft.inventory.map((item, index) => (
                  <div key={item.id} className="grid gap-2 border border-white/8 bg-black/20 p-2 md:grid-cols-[1.6fr,0.7fr,0.9fr,1fr]">
                    <Field label="Item">
                      <input className={inputClassCompact} value={item.name} onChange={(event) => updateInventory(index, { name: event.target.value })} />
                    </Field>
                    <Field label="Qty">
                      <NumericInput className={inputClassCompact} value={item.quantity} onValueChange={(value) => updateInventory(index, { quantity: value ?? 0 })} />
                    </Field>
                    <Field label="Type">
                      <select className={inputClassCompact} value={item.type} onChange={(event) => updateInventory(index, { type: event.target.value as InventoryEntry["type"] })}>
                        <option value="gear">Gear</option>
                        <option value="reagent">Reagent</option>
                        <option value="loot">Loot</option>
                        <option value="consumable">Consumable</option>
                      </select>
                    </Field>
                    <label className="flex items-center gap-2 pt-7 text-sm text-zinc-300">
                      <input type="checkbox" checked={item.equipped} onChange={(event) => updateInventory(index, { equipped: event.target.checked })} />
                      Equipped
                    </label>
                  </div>
                ))}
                <button
                  type="button"
                  className={miniButtonClass}
                  onClick={() =>
                    updateDraft((current) => ({
                      ...current,
                      inventory: [...current.inventory, createInventoryEntry()]
                    }))
                  }
                >
                  <Plus size={12} />
                  Add Item
                </button>
              </div>
            </SectionCard>

            <SectionCard title="Notes" icon={<Coins size={16} />}>
              <textarea className={textareaClassCompact} rows={4} value={draft.notes} onChange={(event) => updateField("notes", event.target.value)} />
            </SectionCard>
          </div>
        </div>
          ) : (
        <div className="grid gap-4 xl:grid-cols-[1.1fr,1fr]">
          <div className="space-y-4">
            <SectionCard title="Edit Controls" icon={<Sparkles size={16} />}>
              <div className="flex flex-wrap items-center gap-2">
                {needsInitialGuidedSetup ? (
                  <button type="button" className={actionButtonClass} onClick={() => openGuidedFlow("setup")}>
                    Open Setup Guide
                  </button>
                ) : null}
                <button type="button" className={actionButtonClass} disabled={draft.classes.length === 0} onClick={() => openGuidedFlow("levelup")}>
                  Level Up
                </button>
                {canEdit ? (
                  <button
                    type="button"
                    className="border border-amber-500 bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
                    disabled={saving}
                    onClick={() => void saveCurrent()}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                ) : null}
              </div>
              <p className="text-sm text-zinc-400">The edit tab stays fully editable. The setup and level-up guides add structured species, background, class, spell, feat, and feature choices on top of manual edits.</p>
            </SectionCard>

            <SectionCard title="Build Summary" icon={<Sparkles size={16} />}>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Species">
                  <select className={inputClass} disabled={editReadOnly} value={draft.build?.speciesId ?? ""} onChange={(event) => applySpecies(event.target.value)}>
                    <option value="">Select a species</option>
                    {compendium.races.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Background">
                  <select className={inputClass} disabled={editReadOnly} value={draft.build?.backgroundId ?? ""} onChange={(event) => applyBackground(event.target.value)}>
                    <option value="">Select a background</option>
                    {compendium.backgrounds.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {selectedSpecies || selectedBackground ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {selectedSpecies ? (
                    <DetailCollection
                      entries={[createReferenceRow("Species", selectedSpecies, [{ label: "Speed", value: `${selectedSpecies.speed} ft` }])]}
                      emptyMessage="No species selected."
                      renderText={renderRulesText}
                    />
                  ) : null}
                  {selectedBackground ? (
                    <DetailCollection
                      entries={[
                        createReferenceRow("Background", selectedBackground, [
                          {
                            label: "Skills",
                            value: selectedBackground.skillProficiencies.join(", ") || "None"
                          },
                          {
                            label: "Origin Feats",
                            value: selectedBackground.featIds.join(", ") || "None"
                          }
                        ])
                      ]}
                      emptyMessage="No background selected."
                      renderText={renderRulesText}
                    />
                  ) : null}
                </div>
              ) : null}
              <div className="space-y-3">
                {draft.classes.map((actorClass, index) => {
                  const classEntry = findCompendiumClass(actorClass, compendium.classes);
                  const buildClass = draft.build?.classes.find((entry) => entry.id === actorClass.id);

                  return (
                    <div key={actorClass.id} className="space-y-3 border border-white/8 bg-black/20 p-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Class">
                          <select className={inputClass} disabled={editReadOnly} value={actorClass.compendiumId} onChange={(event) => applyClass(event.target.value, actorClass.id)}>
                            <option value="">Select a class</option>
                            {compendium.classes.map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Level">
                          <NumericInput className={inputClass} min={1} value={actorClass.level} disabled={editReadOnly} onValueChange={(value) => updateClass(index, { level: value ?? 1 })} />
                        </Field>
                      </div>
                      {classEntry && classEntry.subclasses.length > 0 && actorClass.level >= (classEntry.subclassLevel ?? 99) ? (
                        <Field label="Subclass">
                          <select className={inputClass} disabled={editReadOnly} value={buildClass?.subclassId ?? ""} onChange={(event) => applySubclass(actorClass.id, event.target.value)}>
                            <option value="">Select a subclass</option>
                            {classEntry.subclasses.map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={secondaryButtonClass} disabled={editReadOnly} onClick={() => removeFromArray("classes", index)}>
                          Remove Class
                        </button>
                      </div>
                      {classEntry ? (
                        <DetailCollection
                          entries={[
                            {
                              id: classEntry.id,
                              eyebrow: "Class",
                              title: classEntry.name,
                              subtitle: `d${classEntry.hitDieFaces} Hit Die`,
                              source: classEntry.source,
                              description: classEntry.description,
                              meta: [
                                {
                                  label: "Primary Abilities",
                                  value: classEntry.primaryAbilities.join(", ") || "None"
                                },
                                {
                                  label: "Saving Throws",
                                  value: classEntry.savingThrowProficiencies.join(", ") || "None"
                                }
                              ]
                            }
                          ]}
                          emptyMessage="No class selected."
                          renderText={renderRulesText}
                        />
                      ) : null}
                    </div>
                  );
                })}
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={editReadOnly}
                  onClick={() => {
                    const firstClass = compendium.classes[0];

                    if (!firstClass) {
                      return;
                    }

                    applyClass(firstClass.id);
                  }}
                >
                  <Plus size={14} />
                  Add Class
                </button>
              </div>
            </SectionCard>

            <SectionCard title="Identity & Stats" icon={<Brain size={16} />}>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Name">
                  <input className={inputClass} disabled={editReadOnly} value={draft.name} onChange={(event) => updateField("name", event.target.value)} />
                </Field>
                <Field label="Alignment">
                  <input className={inputClass} disabled={editReadOnly} value={draft.alignment} onChange={(event) => updateField("alignment", event.target.value)} />
                </Field>
                <Field label="Vision Range (Squares)">
                  <NumericInput className={inputClass} disabled={editReadOnly} value={draft.visionRange} onValueChange={(value) => updateField("visionRange", value ?? 0)} />
                </Field>
                <Field label="Creature Size">
                  <select className={inputClass} disabled={editReadOnly} value={draft.creatureSize} onChange={(event) => updateField("creatureSize", event.target.value as ActorSheet["creatureSize"])}>
                    {CREATURE_SIZE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Image">
                  <label className={`flex items-center justify-center gap-2 border border-dashed border-white/12 px-3 py-3 text-sm text-zinc-300 transition ${editReadOnly ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-amber-500/70 hover:text-amber-50"}`}>
                    <ImagePlus size={16} />
                    Upload Portrait
                    <input className="hidden" disabled={editReadOnly} type="file" accept="image/*" onChange={(event) => void handleImageUpload(event)} />
                  </label>
                </Field>
                <Field label="Token Color">
                  <input className={inputClass} disabled={editReadOnly} type="color" value={draft.color} onChange={(event) => updateField("color", event.target.value)} />
                </Field>
              </div>
              {imageError ? <p className="text-sm text-red-300">{imageError}</p> : null}
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <Field label="Current HP">
                  <NumericInput
                    className={inputClass}
                    value={draft.hitPoints.current}
                    disabled={editReadOnly}
                    onValueChange={(value) => updateHitPoints("current", String(value ?? 0), updateDraft, draft.hitPoints.max)}
                  />
                </Field>
                <Field label="Temp HP">
                  <NumericInput
                    className={inputClass}
                    value={draft.hitPoints.temp}
                    disabled={editReadOnly}
                    onValueChange={(value) => updateHitPoints("temp", String(value ?? 0), updateDraft, draft.hitPoints.max)}
                  />
                </Field>
                <Field label="Max HP">
                  <NumericInput
                    className={inputClass}
                    value={draft.hitPoints.max}
                    disabled={editReadOnly}
                    onValueChange={(value) => updateHitPoints("max", String(value ?? 0), updateDraft, value ?? 0)}
                  />
                </Field>
                <Field label="Reduced Max HP">
                  <NumericInput
                    className={inputClass}
                    value={draft.hitPoints.reducedMax}
                    disabled={editReadOnly}
                    onValueChange={(value) => updateHitPoints("reducedMax", String(value ?? 0), updateDraft, draft.hitPoints.max)}
                  />
                </Field>
                <Field label="Speed">
                  <NumericInput className={inputClass} value={draft.speed} disabled={editReadOnly} onValueChange={(value) => updateField("speed", value ?? 0)} />
                </Field>
                <Field label="Initiative Bonus">
                  <NumericInput className={inputClass} disabled={editReadOnly} value={draft.initiative} onValueChange={(value) => updateField("initiative", value ?? 0)} />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {abilityOrder.map((ability) => (
                  <Field key={ability.key} label={ability.label}>
                    <NumericInput className={inputClass} disabled={editReadOnly} value={draft.abilities[ability.key]} onValueChange={(value) => updateAbility(ability.key, value ?? 0)} />
                  </Field>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Proficiencies" icon={<Sparkles size={16} />}>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Saving Throws">
                  <div className="grid grid-cols-3 gap-2 border border-white/10 bg-black/20 p-3">
                    {abilityOrder.map((ability) => (
                      <label key={ability.key} className="flex items-center gap-2 text-sm text-zinc-300">
                        <input
                          type="checkbox"
                          disabled={editReadOnly}
                          checked={draft.savingThrowProficiencies.includes(ability.key)}
                          onChange={(event) =>
                            updateField(
                              "savingThrowProficiencies",
                              event.target.checked
                                ? Array.from(new Set([...draft.savingThrowProficiencies, ability.key]))
                                : draft.savingThrowProficiencies.filter((entry) => entry !== ability.key)
                            )
                          }
                        />
                        {ability.label}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Languages">
                  <textarea
                    className={textareaClass}
                    rows={4}
                    disabled={editReadOnly}
                    value={draft.languageProficiencies.join(", ")}
                    onChange={(event) => updateField("languageProficiencies", splitCommaValues(event.target.value))}
                  />
                </Field>
                <Field label="Tools">
                  <textarea
                    className={textareaClass}
                    rows={4}
                    disabled={editReadOnly}
                    value={draft.toolProficiencies.join(", ")}
                    onChange={(event) => updateField("toolProficiencies", splitCommaValues(event.target.value))}
                  />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Skills" icon={<Sparkles size={16} />}>
              <div className="grid gap-2 md:grid-cols-2">
                {draft.skills.map((skill, index) => (
                  <details key={skill.id} className="group border border-white/8 bg-black/20">
                    <summary className="list-none cursor-pointer px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-zinc-100">{skill.name}</p>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{skill.ability.toUpperCase()}</p>
                        </div>
                        <span className="text-sm font-semibold text-amber-50">{formatModifier(skillTotal(actorWithDerivedNumbers, skill))}</span>
                      </div>
                    </summary>
                    <div className="space-y-3 border-t border-white/8 px-3 py-3">
                      <div className="text-sm leading-6 text-zinc-400">
                        {skillLookup.get(normalizeKey(skill.name))?.description
                          ? renderRulesText(skillLookup.get(normalizeKey(skill.name))?.description ?? "")
                          : "No imported compendium description for this skill yet."}
                      </div>
                      {skillLookup.get(normalizeKey(skill.name))?.tags.length ? (
                        <TagRow tags={skillLookup.get(normalizeKey(skill.name))?.tags ?? []} />
                      ) : null}
                      <div className="flex items-center gap-3">
                        <label className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                          <input className="mr-2" disabled={editReadOnly} type="checkbox" checked={skill.proficient} onChange={(event) => updateSkill(index, { proficient: event.target.checked })} />
                          Prof
                        </label>
                        <label className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                          <input className="mr-2" disabled={editReadOnly} type="checkbox" checked={skill.expertise} onChange={(event) => updateSkill(index, { expertise: event.target.checked })} />
                          Exp
                        </label>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </SectionCard>
          </div>

          <div className="space-y-4">
            <SectionCard title="Spells & Feats" icon={<BookOpen size={16} />}>
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <Field label="Add Feat">
                  <select className={inputClass} disabled={editReadOnly} value={featToAdd} onChange={(event) => setFeatToAdd(event.target.value)}>
                    <option value="">Select a feat</option>
                    {filteredFeats.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <button type="button" className={secondaryButtonClass} disabled={editReadOnly || !featToAdd} onClick={() => addFeatById(featToAdd)}>
                  Add Feat
                </button>
              </div>
              <DetailCollection
                title="Known Spells"
                headerAction={
                  <button type="button" className={secondaryButtonClass} disabled={editReadOnly} onClick={() => setSpellSelectionTarget("editKnown")}>
                    <Plus size={14} />
                    Add Spells
                  </button>
                }
                entries={collectSpellRows(draft.spells, draft.preparedSpells, compendium.spells, preparedSpellLimit).map((entry) => ({
                  ...entry,
                  onRemove: editReadOnly ? undefined : () => updateField("spells", draft.spells.filter((value) => value !== entry.title))
                }))}
                emptyMessage="No spells added."
                renderText={renderRulesText}
              />
              <DetailCollection
                title="Prepared Spells"
                headerAction={
                  <button type="button" className={secondaryButtonClass} disabled={editReadOnly || !canPrepareSpells} onClick={() => setSpellSelectionTarget("editPrepared")}>
                    <Plus size={14} />
                    Manage
                  </button>
                }
                entries={spellRows
                  .filter((entry) => draft.preparedSpells.includes(entry.title) || spellCollections.alwaysPrepared.includes(entry.title))
                  .map((entry) => ({
                    ...entry,
                    onRemove:
                      editReadOnly || spellCollections.alwaysPrepared.includes(entry.title)
                        ? undefined
                        : () => updateField("preparedSpells", draft.preparedSpells.filter((value) => value !== entry.title))
                  }))}
                emptyMessage="No prepared spells selected."
                renderText={renderRulesText}
              />
              <DetailCollection
                title="Spellbook"
                headerAction={
                  <button type="button" className={secondaryButtonClass} disabled={editReadOnly} onClick={() => setSpellSelectionTarget("editSpellbook")}>
                    <Plus size={14} />
                    Add Spells
                  </button>
                }
                entries={collectSpellRows(draft.spellState.spellbook, draft.preparedSpells, compendium.spells, preparedSpellLimit).map((entry) => ({
                  ...entry,
                  onRemove: editReadOnly ? undefined : () => updateField("spellState", { ...draft.spellState, spellbook: draft.spellState.spellbook.filter((value) => value !== entry.title) })
                }))}
                emptyMessage="No spellbook spells."
                renderText={renderRulesText}
              />
              <DetailCollection
                title="Always Prepared"
                headerAction={
                  <button type="button" className={secondaryButtonClass} disabled={editReadOnly} onClick={() => setSpellSelectionTarget("editAlwaysPrepared")}>
                    <Plus size={14} />
                    Add Spells
                  </button>
                }
                entries={collectSpellRows(draft.spellState.alwaysPrepared, draft.preparedSpells, compendium.spells, preparedSpellLimit).map((entry) => ({
                  ...entry,
                  onRemove: editReadOnly ? undefined : () => updateField("spellState", { ...draft.spellState, alwaysPrepared: draft.spellState.alwaysPrepared.filter((value) => value !== entry.title) })
                }))}
                emptyMessage="No always-prepared spells."
                renderText={renderRulesText}
              />
              <DetailCollection
                title="At Will"
                headerAction={
                  <button type="button" className={secondaryButtonClass} disabled={editReadOnly} onClick={() => setSpellSelectionTarget("editAtWill")}>
                    <Plus size={14} />
                    Add Spells
                  </button>
                }
                entries={collectSpellRows(draft.spellState.atWill, draft.preparedSpells, compendium.spells, preparedSpellLimit).map((entry) => ({
                  ...entry,
                  onRemove: editReadOnly ? undefined : () => updateField("spellState", { ...draft.spellState, atWill: draft.spellState.atWill.filter((value) => value !== entry.title) })
                }))}
                emptyMessage="No at-will spells."
                renderText={renderRulesText}
              />
              <DetailCollection
                title="Short Rest Spells"
                headerAction={
                  <button type="button" className={secondaryButtonClass} disabled={editReadOnly} onClick={() => setSpellSelectionTarget("editPerShortRest")}>
                    <Plus size={14} />
                    Add Spells
                  </button>
                }
                entries={collectSpellRows(draft.spellState.perShortRest, draft.preparedSpells, compendium.spells, preparedSpellLimit).map((entry) => ({
                  ...entry,
                  onRemove: editReadOnly ? undefined : () => updateField("spellState", { ...draft.spellState, perShortRest: draft.spellState.perShortRest.filter((value) => value !== entry.title) })
                }))}
                emptyMessage="No short-rest spells."
                renderText={renderRulesText}
              />
              <DetailCollection
                title="Long Rest Spells"
                headerAction={
                  <button type="button" className={secondaryButtonClass} disabled={editReadOnly} onClick={() => setSpellSelectionTarget("editPerLongRest")}>
                    <Plus size={14} />
                    Add Spells
                  </button>
                }
                entries={collectSpellRows(draft.spellState.perLongRest, draft.preparedSpells, compendium.spells, preparedSpellLimit).map((entry) => ({
                  ...entry,
                  onRemove: editReadOnly ? undefined : () => updateField("spellState", { ...draft.spellState, perLongRest: draft.spellState.perLongRest.filter((value) => value !== entry.title) })
                }))}
                emptyMessage="No long-rest spells."
                renderText={renderRulesText}
              />
              <DetailCollection
                title="Feats"
                entries={featRows.map((entry) => ({
                  ...entry,
                  onRemove: editReadOnly ? undefined : () => updateField("feats", draft.feats.filter((value) => value !== entry.title))
                }))}
                emptyMessage="No feats selected."
                renderText={renderRulesText}
              />
              <DetailCollection title="Features" entries={featureRows} emptyMessage="No features available yet." renderText={renderRulesText} />
            </SectionCard>

            <SectionCard title="Combat & Gear" icon={<Swords size={16} />}>
              <DetailCollection
                title="Auto Attacks"
                entries={derivedEquipment.attacks.map((attack) => ({
                  id: attack.id,
                  eyebrow: "Equipped Item",
                  title: attack.name,
                  subtitle: `${formatModifier(attack.attackBonus)} to hit`,
                  description: [attack.damage ? `Damage: ${attack.damage}${attack.damageType ? ` ${attack.damageType}` : ""}` : "", attack.notes].filter(Boolean).join("\n")
                }))}
                emptyMessage="No auto-generated attacks from equipped compendium items."
                renderText={renderRulesText}
              />

              <DetailCollection
                title="Auto Armor"
                entries={derivedEquipment.armorItems.map((item) => ({
                  id: item.id,
                  eyebrow: "Equipped Item",
                  title: item.name,
                  subtitle: item.kind === "shield" ? "Shield" : "Armor",
                  description: item.notes,
                  meta: [
                    { label: "Base AC", value: String(item.armorClass) },
                    { label: "Dex Cap", value: item.maxDexBonus === null ? "None" : String(item.maxDexBonus) }
                  ]
                }))}
                emptyMessage="No auto-generated armor from equipped compendium items."
                renderText={renderRulesText}
              />

              <div className="space-y-3">
                {draft.attacks.map((attack, index) => (
                  <div key={attack.id} className="grid gap-3 border border-white/8 bg-black/20 p-3 md:grid-cols-2">
                    <Field label="Attack">
                      <input className={inputClass} disabled={editReadOnly} value={attack.name} onChange={(event) => updateAttack(index, { name: event.target.value })} />
                    </Field>
                    <Field label="Bonus">
                      <NumericInput className={inputClass} disabled={editReadOnly} value={attack.attackBonus} onValueChange={(value) => updateAttack(index, { attackBonus: value ?? 0 })} />
                    </Field>
                    <Field label="Damage">
                      <input className={inputClass} disabled={editReadOnly} value={attack.damage} onChange={(event) => updateAttack(index, { damage: event.target.value })} />
                    </Field>
                    <Field label="Type">
                      <input className={inputClass} disabled={editReadOnly} value={attack.damageType} onChange={(event) => updateAttack(index, { damageType: event.target.value })} />
                    </Field>
                    <button type="button" className={secondaryButtonClass} disabled={editReadOnly} onClick={() => removeFromArray("attacks", index)}>
                      Remove Attack
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={editReadOnly}
                  onClick={() =>
                    updateDraft((current) => ({
                      ...current,
                      attacks: [...current.attacks, createAttackEntry()]
                    }))
                  }
                >
                  <Plus size={14} />
                  Add Attack
                </button>
              </div>

              <div className="space-y-3">
                {draft.armorItems.map((item, index) => (
                  <div key={item.id} className="grid gap-3 border border-white/8 bg-black/20 p-3 md:grid-cols-2">
                    <Field label="Armor">
                      <input className={inputClass} disabled={editReadOnly} value={item.name} onChange={(event) => updateArmor(index, { name: event.target.value })} />
                    </Field>
                    <Field label="Base AC">
                      <NumericInput className={inputClass} disabled={editReadOnly} value={item.armorClass} onValueChange={(value) => updateArmor(index, { armorClass: value ?? 0 })} />
                    </Field>
                    <Field label="Kind">
                      <select className={inputClass} disabled={editReadOnly} value={item.kind} onChange={(event) => updateArmor(index, { kind: event.target.value as ArmorEntry["kind"] })}>
                        <option value="armor">Armor</option>
                        <option value="shield">Shield</option>
                      </select>
                    </Field>
                    <label className="flex items-center gap-2 pt-7 text-sm text-zinc-300">
                      <input disabled={editReadOnly} type="checkbox" checked={item.equipped} onChange={(event) => updateArmor(index, { equipped: event.target.checked })} />
                      Equipped
                    </label>
                    <button type="button" className={secondaryButtonClass} disabled={editReadOnly} onClick={() => removeFromArray("armorItems", index)}>
                      Remove Armor
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={editReadOnly}
                  onClick={() =>
                    updateDraft((current) => ({
                      ...current,
                      armorItems: [...current.armorItems, createArmorEntry()]
                    }))
                  }
                >
                  <Plus size={14} />
                  Add Armor
                </button>
              </div>
            </SectionCard>

            <SectionCard title="Resources" icon={<Heart size={16} />}>
              <div className="space-y-3">
                {displayedResources.map((resource) => {
                  const resourceDefinition = resourceDefinitionLookup.get(normalizeKey(resource.name));

                  return (
                    <div key={resource.id} className="space-y-3 border border-white/8 bg-black/20 p-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Name">
                          <input className={inputClass} disabled={editReadOnly} value={resource.name} onChange={(event) => updateResourceById(resource.id, { name: event.target.value })} />
                        </Field>
                        <Field label="Restore On">
                          <input className={inputClass} disabled={editReadOnly} value={resource.resetOn} onChange={(event) => updateResourceById(resource.id, { resetOn: event.target.value })} />
                        </Field>
                        <Field label="Current">
                          <NumericInput className={inputClass} disabled={editReadOnly} value={resource.current} onValueChange={(value) => updateResourceById(resource.id, { current: value ?? 0 })} />
                        </Field>
                        <Field label="Max">
                          <NumericInput className={inputClass} disabled={editReadOnly} value={resource.max} onValueChange={(value) => updateResourceById(resource.id, { max: value ?? 0 })} />
                        </Field>
                        <button
                          type="button"
                          className={secondaryButtonClass}
                          disabled={editReadOnly}
                          onClick={() =>
                            updateDraft((current) => ({
                              ...current,
                              resources: current.resources.filter((entry) => entry.id !== resource.id)
                            }))
                          }
                        >
                          Remove Resource
                        </button>
                      </div>
                      {resourceDefinition ? (
                        <div className="space-y-2 text-sm text-zinc-400">
                          <p>{resourceDefinition.description}</p>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{resourceDefinition.source}</p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={editReadOnly}
                  onClick={() =>
                    updateDraft((current) => ({
                      ...current,
                      resources: [...current.resources, createResourceEntry()]
                    }))
                  }
                >
                  <Plus size={14} />
                  Add Resource
                </button>
              </div>
            </SectionCard>
          </div>
        </div>
          )}
        </>
      ) : null}

      {shortRestOpen ? (
        <RestDialog
          classes={draft.classes}
          constitutionModifier={abilityModifierTotal(actorWithDerivedNumbers, "con")}
          selections={hitDiceSelections}
          onChange={(classId, nextValue) => setHitDiceSelections((current) => ({ ...current, [classId]: nextValue }))}
          onCancel={() => setShortRestOpen(false)}
          onConfirm={() => void confirmShortRest()}
        />
      ) : null}

      {longRestOpen ? (
        <ModalFrame onClose={() => setLongRestOpen(false)} backdropClassName="bg-black/70" panelClassName="max-w-3xl border-white/10 bg-slate-950 text-zinc-100">
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-amber-400/80">Long Rest</p>
                <h3 className="mt-2 font-serif text-2xl text-amber-50">Recover and Prepare</h3>
                <p className="mt-2 text-sm text-zinc-400">Confirm hit point recovery, spell slot recovery, hit dice recovery, and any long-rest spell preparation changes.</p>
              </div>
              <button type="button" className={secondaryButtonClass} onClick={() => setLongRestOpen(false)}>
                <X size={14} />
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              <div className="grid gap-4 md:grid-cols-3">
                <StatChip label="HP" value={`${hitPointDisplay.current}/${hitPointDisplay.effectiveMax}`} />
                <StatChip label="Spell Slots" value="Reset" />
                <StatChip label="Hit Dice" value="Recover Half" />
              </div>
              {canPrepareSpells ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm uppercase tracking-[0.2em] text-amber-300/80">Prepared Spells</p>
                    <p className="text-sm text-zinc-400">{longRestPreparedSpells.length}/{preparedSpellLimit || spellCollections.preparable.length}</p>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" className={secondaryButtonClass} onClick={() => setSpellSelectionTarget("longRestPrepared")}>
                      <Plus size={14} />
                      Choose Spells
                    </button>
                  </div>
                  <div className="border border-white/8 bg-black/20 p-3">
                    <DetailCollection entries={longRestPreparedSpellRows} emptyMessage="No spells selected for the long rest yet." renderText={renderRulesText} />
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-3 border-t border-white/8 px-5 py-4">
              <button type="button" className={secondaryButtonClass} onClick={() => setLongRestOpen(false)}>
                Cancel
              </button>
              <button type="button" className="border border-amber-500 bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400" onClick={() => void confirmLongRest()}>
                Complete Rest
              </button>
            </div>
          </>
        </ModalFrame>
      ) : null}

      {spellSelectionConfig ? (
        <SpellSelectionModal
          title={spellSelectionConfig.title}
          subtitle={spellSelectionConfig.subtitle}
          spells={spellSelectionConfig.spells}
          selectedSpellIds={spellSelectionConfig.selectedSpellIds}
          compendium={compendium}
          allowedSourceBooks={allowedSourceBooks}
          maxSelections={spellSelectionConfig.maxSelections}
          applyLabel={spellSelectionConfig.applyLabel}
          onClose={() => setSpellSelectionTarget(null)}
          onApply={(spellIds) => {
            spellSelectionConfig.onApply(spellIds);
            setSpellSelectionTarget(null);
          }}
        />
      ) : null}

      {guidedFlowOpen ? (
        <ModalFrame onClose={() => setGuidedFlowOpen(false)} backdropClassName="bg-black/60" panelClassName="max-w-3xl border-white/10 bg-slate-950">
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-amber-400/80">Build Guide</p>
                <h3 className="mt-2 font-serif text-2xl text-amber-50">{guidedFlowMode === "setup" ? "Level 1 Setup" : "Level Up Guide"}</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  {guidedFlowMode === "setup"
                    ? "Choose the species, background, class, and starting choices here. The guide applies all supported build choices from this popup."
                    : "Choose which class gains a level. HP is rolled from the class hit die plus Constitution, and newly unlocked features are added."}
                </p>
              </div>
              <button type="button" className={secondaryButtonClass} onClick={() => setGuidedFlowOpen(false)}>
                <X size={14} />
                Close
              </button>
            </div>
            {guideError ? <p className="mx-5 mt-4 border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{guideError}</p> : null}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
            <div className="space-y-4">
              {guidedFlowMode === "setup" ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Species">
                      <select
                        className={inputClass}
                        value={guidedSetup.speciesId}
                        onChange={(event) => {
                          const nextSpecies = compendium.races.find((entry) => entry.id === event.target.value) ?? null;
                          const nextSpeciesSkillOptions = deriveSpeciesSkillOptions(nextSpecies, compendium.skills);
                          const nextSpeciesFeatOptions = deriveSpeciesOriginFeatOptions(nextSpecies, compendium.feats);
                          setGuidedSetup((current) => ({
                            ...current,
                            speciesId: event.target.value,
                            speciesSkillChoice: nextSpeciesSkillOptions[0]?.name ?? "",
                            speciesOriginFeatId: nextSpeciesFeatOptions[0]?.id ?? ""
                          }));
                        }}
                      >
                        <option value="">Select a species</option>
                        {compendium.races.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Background">
                      <select
                        className={inputClass}
                        value={guidedSetup.backgroundId}
                        onChange={(event) => {
                          const nextBackground = compendium.backgrounds.find((entry) => entry.id === event.target.value) ?? null;
                          const nextAbilityConfig = deriveBackgroundAbilityConfig(nextBackground);
                          const nextFeatOptions = deriveOriginFeatOptions(nextBackground, compendium.feats);
                          const nextEquipmentGroups = deriveBackgroundEquipmentGroups(nextBackground);
                          setGuidedSetup((current) => ({
                            ...current,
                            backgroundId: event.target.value,
                            originFeatId: nextFeatOptions[0]?.id ?? "",
                            equipmentChoiceIds: Object.fromEntries(nextEquipmentGroups.map((group) => [group.id, group.options[0]?.id ?? ""])),
                            abilityChoices: nextAbilityConfig.abilities.slice(0, nextAbilityConfig.count)
                          }));
                        }}
                      >
                        <option value="">Select a background</option>
                        {compendium.backgrounds.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Class">
                      <select
                        className={inputClass}
                        value={guidedSetup.classId}
                        onChange={(event) => setGuidedSetup((current) => ({ ...current, classId: event.target.value }))}
                      >
                        <option value="">Select a class</option>
                        {compendium.classes.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  {guidedSpeciesSkillChoices.length > 0 || guidedSpeciesOriginFeatOptions.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {guidedSpeciesSkillChoices.length > 0 ? (
                        <Field label="Species Skill Choice">
                          <select
                            className={inputClass}
                            value={guidedSetup.speciesSkillChoice}
                            onChange={(event) => setGuidedSetup((current) => ({ ...current, speciesSkillChoice: event.target.value }))}
                          >
                            {guidedSpeciesSkillChoices.map((entry) => (
                              <option key={entry.id} value={entry.name}>
                                {entry.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ) : null}
                      {guidedSpeciesOriginFeatOptions.length > 0 ? (
                        <Field label="Species Feat Choice">
                          <select
                            className={inputClass}
                            value={guidedSetup.speciesOriginFeatId}
                            onChange={(event) => setGuidedSetup((current) => ({ ...current, speciesOriginFeatId: event.target.value }))}
                          >
                            {guidedSpeciesOriginFeatOptions.map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ) : null}
                    </div>
                  ) : null}

                  {guidedAbilityChoiceConfig.count > 0 ? (
                    <div className="space-y-3 border border-white/8 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">
                        Ability Choices
                      </p>
                      <div className="grid gap-3 md:grid-cols-2">
                        {Array.from({ length: guidedAbilityChoiceConfig.count }, (_, index) => (
                          <Field key={index} label={`Choice ${index + 1}`}>
                            <select
                              className={inputClass}
                              value={guidedSetup.abilityChoices[index] ?? ""}
                              onChange={(event) =>
                                setGuidedSetup((current) => ({
                                  ...current,
                                  abilityChoices: current.abilityChoices.map((entry, abilityIndex) =>
                                    abilityIndex === index ? (event.target.value as AbilityKey) : entry
                                  )
                                }))
                              }
                            >
                              <option value="">Select an ability</option>
                              {guidedAbilityChoiceConfig.abilities.map((abilityKey) => (
                                <option key={abilityKey} value={abilityKey}>
                                  {abilityKey.toUpperCase()}
                                </option>
                              ))}
                            </select>
                          </Field>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {guidedOriginFeatOptions.length > 0 ? (
                    <Field label="Origin Feat">
                      <select
                        className={inputClass}
                        value={guidedSetup.originFeatId}
                        onChange={(event) => setGuidedSetup((current) => ({ ...current, originFeatId: event.target.value }))}
                      >
                        {guidedOriginFeatOptions.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : null}

                  {guidedEquipmentGroups.length > 0 ? (
                    <div className="space-y-3">
                      {guidedEquipmentGroups.map((group) => (
                        <Field key={group.id} label={group.label}>
                          <select
                            className={inputClass}
                            value={guidedSetup.equipmentChoiceIds[group.id] ?? ""}
                            onChange={(event) =>
                              setGuidedSetup((current) => ({
                                ...current,
                                equipmentChoiceIds: {
                                  ...current.equipmentChoiceIds,
                                  [group.id]: event.target.value
                                }
                              }))
                            }
                          >
                            {group.options.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-3">
                    {guidedSelectedSpecies ? (
                      <DetailCollection entries={[createReferenceRow("Species", guidedSelectedSpecies)]} emptyMessage="" renderText={renderRulesText} />
                    ) : null}
                    {guidedSelectedBackground ? (
                      <DetailCollection entries={[createReferenceRow("Background", guidedSelectedBackground)]} emptyMessage="" renderText={renderRulesText} />
                    ) : null}
                    {guidedSelectedClass ? (
                      <DetailCollection
                        entries={[
                          {
                            id: guidedSelectedClass.id,
                            eyebrow: "Class",
                            title: guidedSelectedClass.name,
                            subtitle: `d${guidedSelectedClass.hitDieFaces} Hit Die`,
                            source: guidedSelectedClass.source,
                            description: guidedSelectedClass.description
                          }
                        ]}
                        emptyMessage=""
                        renderText={renderRulesText}
                      />
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Level Up Class">
                    <select className={inputClass} value={guidedClassId} onChange={(event) => setGuidedClassId(event.target.value)}>
                      <option value={NEW_GUIDED_CLASS_ID}>Add a new class</option>
                      {draft.classes.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {guidedClassId === NEW_GUIDED_CLASS_ID ? (
                    <Field label="New Class">
                      <select className={inputClass} value={guidedSetup.classId} onChange={(event) => setGuidedSetup((current) => ({ ...current, classId: event.target.value }))}>
                        <option value="">Select a class</option>
                        {compendium.classes.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : null}
                  {(() => {
                    const targetActorClass = guidedClassId === NEW_GUIDED_CLASS_ID ? null : draft.classes.find((entry) => entry.id === guidedClassId) ?? null;
                    const targetClassEntry =
                      guidedClassId === NEW_GUIDED_CLASS_ID
                        ? compendium.classes.find((entry) => entry.id === guidedSetup.classId) ?? null
                        : targetActorClass
                          ? findCompendiumClass(targetActorClass, compendium.classes) ?? null
                          : null;
                    const nextLevel = guidedClassId === NEW_GUIDED_CLASS_ID ? 1 : (targetActorClass?.level ?? 0) + 1;
                    const buildClass = targetActorClass ? draft.build?.classes.find((entry) => entry.id === targetActorClass.id) : null;

                    return targetClassEntry && targetClassEntry.subclasses.length > 0 && nextLevel >= (targetClassEntry.subclassLevel ?? 99) ? (
                      <Field label="Subclass">
                        <select className={inputClass} value={guidedSetup.subclassId} onChange={(event) => setGuidedSetup((current) => ({ ...current, subclassId: event.target.value }))}>
                          <option value="">Select a subclass</option>
                          {targetClassEntry.subclasses.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name}
                            </option>
                          ))}
                        </select>
                        {buildClass?.subclassName ? <p className="mt-2 text-xs text-zinc-500">Current: {buildClass.subclassName}</p> : null}
                      </Field>
                    ) : null;
                  })()}
                </div>
              )}
              {guidedChoiceSpec.classFeatCount > 0 ||
              guidedChoiceSpec.optionalFeatureCount > 0 ||
              guidedChoiceSpec.cantripCount > 0 ||
              guidedChoiceSpec.knownSpellCount > 0 ||
              guidedChoiceSpec.spellbookCount > 0 ||
              guidedChoiceSpec.expertiseCount > 0 ||
              guidedChoiceSpec.abilityImprovementCount > 0 ? (
                <div className="space-y-4 border border-white/8 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">Class Choices</p>

                  {guidedChoiceSpec.classFeatCount > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {Array.from({ length: guidedChoiceSpec.classFeatCount }, (_, index) => (
                        <Field key={`class-feat-${index}`} label={`Class Feat ${index + 1}`}>
                          <select
                            className={inputClass}
                            value={guidedSetup.classFeatIds[index] ?? ""}
                            onChange={(event) =>
                              setGuidedSetup((current) => ({
                                ...current,
                                classFeatIds: replaceGuideSelection(current.classFeatIds, index, event.target.value)
                              }))
                            }
                          >
                            {guidedChoiceSpec.classFeatOptions.map((entry) => (
                              <option key={entry.id} value={entry.id} disabled={guideOptionDisabled(guidedSetup.classFeatIds, index, entry.id)}>
                                {entry.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ))}
                    </div>
                  ) : null}

                  {guidedChoiceSpec.optionalFeatureCount > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {Array.from({ length: guidedChoiceSpec.optionalFeatureCount }, (_, index) => (
                        <Field key={`optional-feature-${index}`} label={`Optional Feature ${index + 1}`}>
                          <select
                            className={inputClass}
                            value={guidedSetup.optionalFeatureIds[index] ?? ""}
                            onChange={(event) =>
                              setGuidedSetup((current) => ({
                                ...current,
                                optionalFeatureIds: replaceGuideSelection(current.optionalFeatureIds, index, event.target.value)
                              }))
                            }
                          >
                            {guidedChoiceSpec.optionalFeatureOptions.map((entry) => (
                              <option key={entry.id} value={entry.id} disabled={guideOptionDisabled(guidedSetup.optionalFeatureIds, index, entry.id)}>
                                {entry.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ))}
                    </div>
                  ) : null}

                  {guidedChoiceSpec.cantripCount > 0 ? (
                    <div className="space-y-3 border border-white/8 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-zinc-100">Cantrips</p>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                            {guidedSetup.cantripIds.filter(Boolean).length}/{guidedChoiceSpec.cantripCount} selected
                          </p>
                        </div>
                        <button type="button" className={secondaryButtonClass} onClick={() => setSpellSelectionTarget("guideCantrips")}>
                          <Plus size={14} />
                          Select
                        </button>
                      </div>
                      <DetailCollection
                        entries={collectSpellRows(
                          findSpellNamesByIds(guidedSetup.cantripIds, guidedChoiceSpec.cantripOptions),
                          [],
                          guidedChoiceSpec.cantripOptions,
                          guidedChoiceSpec.cantripCount
                        )}
                        emptyMessage="No cantrips selected yet."
                        renderText={renderRulesText}
                      />
                    </div>
                  ) : null}

                  {guidedChoiceSpec.knownSpellCount > 0 ? (
                    <div className="space-y-3 border border-white/8 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-zinc-100">Known Spells</p>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                            {guidedSetup.knownSpellIds.filter(Boolean).length}/{guidedChoiceSpec.knownSpellCount} selected
                          </p>
                        </div>
                        <button type="button" className={secondaryButtonClass} onClick={() => setSpellSelectionTarget("guideKnown")}>
                          <Plus size={14} />
                          Select
                        </button>
                      </div>
                      <DetailCollection
                        entries={collectSpellRows(
                          findSpellNamesByIds(guidedSetup.knownSpellIds, guidedChoiceSpec.knownSpellOptions),
                          [],
                          guidedChoiceSpec.knownSpellOptions,
                          guidedChoiceSpec.knownSpellCount
                        )}
                        emptyMessage="No guide spells selected yet."
                        renderText={renderRulesText}
                      />
                    </div>
                  ) : null}

                  {guidedChoiceSpec.spellbookCount > 0 ? (
                    <div className="space-y-3 border border-white/8 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-zinc-100">Spellbook Spells</p>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                            {guidedSetup.spellbookSpellIds.filter(Boolean).length}/{guidedChoiceSpec.spellbookCount} selected
                          </p>
                        </div>
                        <button type="button" className={secondaryButtonClass} onClick={() => setSpellSelectionTarget("guideSpellbook")}>
                          <Plus size={14} />
                          Select
                        </button>
                      </div>
                      <DetailCollection
                        entries={collectSpellRows(
                          findSpellNamesByIds(guidedSetup.spellbookSpellIds, guidedChoiceSpec.spellbookOptions),
                          [],
                          guidedChoiceSpec.spellbookOptions,
                          guidedChoiceSpec.spellbookCount
                        )}
                        emptyMessage="No guide spellbook spells selected yet."
                        renderText={renderRulesText}
                      />
                    </div>
                  ) : null}

                  {guidedChoiceSpec.expertiseCount > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {Array.from({ length: guidedChoiceSpec.expertiseCount }, (_, index) => (
                        <Field key={`expertise-${index}`} label={`Expertise ${index + 1}`}>
                          <select
                            className={inputClass}
                            value={guidedSetup.expertiseSkillChoices[index] ?? ""}
                            onChange={(event) =>
                              setGuidedSetup((current) => ({
                                ...current,
                                expertiseSkillChoices: replaceGuideSelection(current.expertiseSkillChoices, index, event.target.value)
                              }))
                            }
                          >
                            {guidedChoiceSpec.expertiseSkillOptions.map((entry) => (
                              <option key={entry.id} value={entry.name} disabled={guideOptionDisabled(guidedSetup.expertiseSkillChoices, index, entry.name)}>
                                {entry.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ))}
                    </div>
                  ) : null}

                  {guidedChoiceSpec.abilityImprovementCount > 0 ? (
                    <div className="space-y-3">
                      <Field label="Ability Score Improvement">
                        <select
                          className={inputClass}
                          value={guidedSetup.asiMode}
                          onChange={(event) => setGuidedSetup((current) => ({ ...current, asiMode: event.target.value as "feat" | "ability" }))}
                        >
                          <option value="feat">Feat</option>
                          <option value="ability">Ability Scores</option>
                        </select>
                      </Field>
                      {guidedSetup.asiMode === "feat" ? (
                        <Field label="Feat">
                          <select className={inputClass} value={guidedSetup.asiFeatId} onChange={(event) => setGuidedSetup((current) => ({ ...current, asiFeatId: event.target.value }))}>
                            {filteredFeats.map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {Array.from({ length: guidedChoiceSpec.abilityImprovementCount * 2 }, (_, index) => (
                            <Field key={`asi-${index}`} label={`Ability ${index + 1}`}>
                              <select
                                className={inputClass}
                                value={guidedSetup.asiAbilityChoices[index] ?? "str"}
                                onChange={(event) =>
                                  setGuidedSetup((current) => ({
                                    ...current,
                                    asiAbilityChoices: replaceGuideSelection(current.asiAbilityChoices, index, event.target.value as AbilityKey)
                                  }))
                                }
                              >
                                {abilityOrder.map((ability) => (
                                  <option key={ability.key} value={ability.key}>
                                    {ability.label}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {(() => {
                const selectedGuideFeats = mergeTextValues(
                  [],
                  [
                    ...guidedSetup.classFeatIds,
                    guidedChoiceSpec.abilityImprovementCount > 0 && guidedSetup.asiMode === "feat" ? guidedSetup.asiFeatId : ""
                  ]
                )
                  .map((entry) => compendium.feats.find((feat) => feat.id === entry) ?? null)
                  .filter((entry): entry is FeatEntry => Boolean(entry));
                const selectedGuideOptionalFeatures = guidedSetup.optionalFeatureIds
                  .map((entry) => compendium.optionalFeatures.find((feature) => feature.id === entry) ?? null)
                  .filter((entry): entry is CompendiumOptionalFeatureEntry => Boolean(entry));
                const selectedGuideSpells = mergeTextValues([], [
                  ...guidedSetup.cantripIds,
                  ...guidedSetup.knownSpellIds,
                  ...guidedSetup.spellbookSpellIds
                ])
                  .map((entry) => compendium.spells.find((spell) => spell.id === entry) ?? null)
                  .filter((entry): entry is SpellEntry => Boolean(entry));

                if (selectedGuideFeats.length === 0 && selectedGuideOptionalFeatures.length === 0 && selectedGuideSpells.length === 0) {
                  return null;
                }

                return (
                  <div className="grid gap-3 md:grid-cols-3">
                    {selectedGuideFeats.length > 0 ? (
                      <DetailCollection
                        title="Feat Previews"
                        entries={selectedGuideFeats.map((entry) => ({
                          id: entry.id,
                          eyebrow: "Feat",
                          title: entry.name,
                          subtitle: entry.category,
                          source: entry.source,
                          description: [entry.abilityScoreIncrease, entry.description].filter(Boolean).join("\n\n")
                        }))}
                        emptyMessage=""
                        renderText={renderRulesText}
                      />
                    ) : null}
                    {selectedGuideOptionalFeatures.length > 0 ? (
                      <DetailCollection
                        title="Feature Previews"
                        entries={selectedGuideOptionalFeatures.map((entry) =>
                          createReferenceRow("Optional Feature", entry, [{ label: "Prerequisites", value: entry.prerequisites || "None" }])
                        )}
                        emptyMessage=""
                        renderText={renderRulesText}
                      />
                    ) : null}
                    {selectedGuideSpells.length > 0 ? (
                      <DetailCollection
                        title="Spell Previews"
                        entries={collectSpellRows(
                          selectedGuideSpells.map((entry) => entry.name),
                          [],
                          compendium.spells,
                          guidedChoiceSpec.knownSpellCount + guidedChoiceSpec.spellbookCount
                        )}
                        emptyMessage=""
                        renderText={renderRulesText}
                      />
                    ) : null}
                  </div>
                );
              })()}

              <div className="flex justify-end">
                <button
                  type="button"
                  className="border border-amber-500 bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400"
                  onClick={guidedFlowMode === "setup" ? confirmGuidedSetup : confirmGuidedLevelUp}
                >
                  {guidedFlowMode === "setup" ? "Apply Setup" : "Apply Level"}
                </button>
              </div>
            </div>
            </div>
          </>
        </ModalFrame>
      ) : null}
    </section>
  );
}

function defaultTabForActor(actor: ActorSheet): SheetTab {
  return actor.build?.speciesId || actor.build?.backgroundId || actor.classes.length > 0 ? "main" : "edit";
}

function finalizeDraftForSave(
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

function backgroundForId(backgrounds: CompendiumBackgroundEntry[], backgroundId: string) {
  return backgrounds.find((entry) => entry.id === backgroundId) ?? null;
}

function applySpeciesToActor(actor: ActorSheet, species: CompendiumSpeciesEntry | null) {
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

function applySpeciesChoiceSelections(
  actor: ActorSheet,
  species: CompendiumSpeciesEntry | null,
  feats: FeatEntry[],
  skillName: string,
  featId: string
) {
  if (!species) {
    return actor;
  }

  const next = cloneActor(actor);

  if (skillName.trim()) {
    const skillIndex = next.skills.findIndex((entry) => normalizeKey(entry.name) === normalizeKey(skillName));

    if (skillIndex >= 0) {
      next.skills[skillIndex] = {
        ...next.skills[skillIndex],
        proficient: true
      };
    }
  }

  if (featId.trim()) {
    const featEntry = feats.find((entry) => entry.id === featId) ?? feats.find((entry) => normalizeKey(entry.name) === normalizeKey(featId));

    if (featEntry && !next.feats.includes(featEntry.name)) {
      next.feats.push(featEntry.name);
    }
  }

  return next;
}

function applyBackgroundToActor(
  actor: ActorSheet,
  background: CompendiumBackgroundEntry | null,
  feats: FeatEntry[],
  options?: {
    featId?: string;
    abilityChoices?: AbilityKey[];
    equipmentChoiceIds?: Record<string, string>;
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
  next.toolProficiencies = mergeTextValues(next.toolProficiencies, background.toolProficiencies);
  next.languageProficiencies = mergeTextValues(next.languageProficiencies, background.languageProficiencies);

  const abilityConfig = deriveBackgroundAbilityConfig(background);
  const selectedAbilities =
    options?.abilityChoices && options.abilityChoices.length === abilityConfig.count
      ? options.abilityChoices
      : abilityConfig.abilities.slice(0, abilityConfig.count);
  selectedAbilities.forEach((abilityKey) => {
    next.abilities[abilityKey] += abilityConfig.amount;
  });

  const featIds =
    options?.featId && options.featId.trim()
      ? [options.featId]
      : deriveOriginFeatOptions(background, feats).map((entry) => entry.id);
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

function applyClassToActor(actor: ActorSheet, classEntry: ClassEntry, classes: ClassEntry[], existingActorClassId?: string) {
  const next = cloneActor(actor);
  const nextActorClass: ActorClassEntry = {
    id: existingActorClassId ?? crypto.randomUUID(),
    compendiumId: classEntry.id,
    name: classEntry.name,
    source: classEntry.source,
    level: existingActorClassId ? next.classes.find((entry) => entry.id === existingActorClassId)?.level ?? 1 : 1,
    hitDieFaces: classEntry.hitDieFaces,
    usedHitDice: existingActorClassId ? next.classes.find((entry) => entry.id === existingActorClassId)?.usedHitDice ?? 0 : 0,
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
  next.savingThrowProficiencies = mergeAbilityKeys(next.savingThrowProficiencies, classEntry.savingThrowProficiencies.map(toAbilityKey).filter((entry): entry is AbilityKey => Boolean(entry)));
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

function assignSubclassToActor(actor: ActorSheet, classes: ClassEntry[], actorClassId: string, subclassId: string) {
  const actorClass = actor.classes.find((entry) => entry.id === actorClassId);
  const classEntry = actorClass ? findCompendiumClass(actorClass, classes) : null;
  const subclass = classEntry?.subclasses.find((entry) => entry.id === subclassId);

  if (!actorClass || !classEntry || !subclass) {
    return actor;
  }

  const next = cloneActor(actor);
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

function deriveBackgroundAbilityConfig(background: CompendiumBackgroundEntry | null) {
  const structuredChoice = background?.abilityChoices[0];

  if (structuredChoice && structuredChoice.abilities.length > 0) {
    return {
      abilities: structuredChoice.abilities,
      amount: structuredChoice.amount || 1,
      count: structuredChoice.count || 1
    };
  }

  const matches = background ? extractAbilityKeysFromText(background.entries || background.description) : [];

  return {
    abilities: matches,
    amount: 1,
    count: matches.length >= 3 ? 2 : matches.length
  };
}

function deriveBackgroundSkillProficiencies(background: CompendiumBackgroundEntry | null) {
  if (!background) {
    return [];
  }

  const structured = background.skillProficiencies.filter(Boolean);

  if (structured.length > 0) {
    return structured;
  }

  return extractTaggedNames(background.entries || background.description, "skill");
}

function deriveOriginFeatOptions(background: CompendiumBackgroundEntry | null, feats: FeatEntry[]) {
  if (!background) {
    return [];
  }

  const featIds = background.featIds.length > 0 ? background.featIds : extractTaggedNames(background.entries || background.description, "feat");

  return featIds
    .map((entry) => feats.find((feat) => feat.id === entry) ?? feats.find((feat) => normalizeKey(feat.name) === normalizeKey(entry)))
    .filter((entry): entry is FeatEntry => Boolean(entry));
}

function deriveSpeciesSkillOptions(species: CompendiumSpeciesEntry | null, skillEntries: CompendiumReferenceEntry[]) {
  if (!species) {
    return [];
  }

  if (!/\bskill of your choice\b/i.test(species.entries || species.description)) {
    return [];
  }

  return skillEntries;
}

function deriveSpeciesOriginFeatOptions(species: CompendiumSpeciesEntry | null, feats: FeatEntry[]) {
  if (!species) {
    return [];
  }

  if (/\borigin feat\b/i.test(species.entries || species.description)) {
    return feats.filter((entry) => normalizeKey(entry.category).includes("origin") || normalizeKey(entry.category) === "o");
  }

  return extractTaggedNames(species.entries || species.description, "feat")
    .map((entry) => feats.find((feat) => normalizeKey(feat.name) === normalizeKey(entry)))
    .filter((entry): entry is FeatEntry => Boolean(entry));
}

function deriveBackgroundEquipmentGroups(background: CompendiumBackgroundEntry | null): CompendiumEquipmentGroup[] {
  if (!background) {
    return [];
  }

  if (background.startingEquipment.length > 0) {
    return background.startingEquipment;
  }

  const entryText = background.entries || background.description;
  const itemNames = extractTaggedNames(entryText, "item");

  if (itemNames.length === 0) {
    return [];
  }

  return [
    {
      id: `${background.id}:fallback-equipment`,
      label: "Suggested Starting Equipment",
      choose: 1,
      options: [
        {
          id: `${background.id}:fallback-equipment:default`,
          label: "Default package",
          items: itemNames.map((itemName) => ({
            name: itemName,
            quantity: 1,
            equipped: false,
            notes: "",
            type: "gear"
          }))
        }
      ]
    }
  ];
}

function extractTaggedNames(text: string, tag: "feat" | "item" | "skill" | "spell") {
  const matches = Array.from(text.matchAll(new RegExp(`\\{@${tag}\\s+([^|}]+)`, "gi")));
  return Array.from(new Set(matches.map((entry) => entry[1]?.trim()).filter(Boolean)));
}

function extractAbilityKeysFromText(text: string) {
  const normalized = text.toLowerCase();
  const matches: AbilityKey[] = [];

  if (normalized.includes("strength")) matches.push("str");
  if (normalized.includes("dexterity")) matches.push("dex");
  if (normalized.includes("constitution")) matches.push("con");
  if (normalized.includes("intelligence")) matches.push("int");
  if (normalized.includes("wisdom")) matches.push("wis");
  if (normalized.includes("charisma")) matches.push("cha");

  return matches;
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

function collectGuidedFeatures(actor: ActorSheet, classes: ClassEntry[], subclassOverrides?: Record<string, string>) {
  const classFeatureNames = availableClassFeatures(actor, classes).map((entry) => entry.name);
  const subclassFeatureNames = actor.classes.flatMap((actorClass) => {
    const classEntry = findCompendiumClass(actorClass, classes);
    const subclassId =
      subclassOverrides?.[actorClass.id] ?? actor.build?.classes.find((entry) => entry.id === actorClass.id)?.subclassId;
    const subclass = classEntry?.subclasses.find((entry) => entry.id === subclassId);

    if (!subclass) {
      return [];
    }

    return subclass.features.filter((entry) => entry.level <= actorClass.level).map((entry) => entry.name);
  });

  return mergeTextValues(actor.features, [...classFeatureNames, ...subclassFeatureNames]);
}

function deriveActorSpellCollections(actor: ActorSheet, compendium: CampaignSnapshot["compendium"], spellSlots: SpellSlotTrack[]) {
  const spells = compendium.spells;
  const classes = compendium.classes;
  const grantedSpells = deriveGrantedSpellState(actor, compendium);
  const maxPreparedLevel = Math.max(
    0,
    ...spellSlots.filter((entry) => entry.total > 0).map((entry) => entry.level)
  );
  const preparedFromClassList = spells
    .filter((entry) => {
      if (entry.level === "cantrip" || typeof entry.level !== "number" || entry.level > maxPreparedLevel) {
        return false;
      }

      return actor.classes.some((actorClass) => {
        const classEntry = findCompendiumClass(actorClass, classes);
        if (!classEntry || classEntry.spellPreparation === "spellbook" || classEntry.spellPreparation === "none") {
          return false;
        }

        return (
          spellMatchesSingleClassFilter(entry, classEntry.name) ||
          entry.classReferences.some((reference) => normalizeKey(reference.className) === normalizeKey(classEntry.name))
        );
      });
    })
    .map((entry) => entry.name);

  const all = mergeTextValues(
    [],
    [
      ...actor.spells,
      ...grantedSpells.known,
      ...actor.spellState.spellbook,
      ...grantedSpells.spellbook,
      ...actor.spellState.alwaysPrepared,
      ...grantedSpells.alwaysPrepared,
      ...actor.spellState.atWill,
      ...grantedSpells.atWill,
      ...actor.spellState.perShortRest,
      ...grantedSpells.perShortRest,
      ...actor.spellState.perLongRest,
      ...grantedSpells.perLongRest,
      ...actor.preparedSpells,
      ...preparedFromClassList
    ]
  );

  const preparable = mergeTextValues([], [...actor.spells, ...grantedSpells.known, ...actor.spellState.spellbook, ...grantedSpells.spellbook, ...preparedFromClassList]);

  return {
    all,
    preparable,
    alwaysPrepared: mergeTextValues(actor.spellState.alwaysPrepared, grantedSpells.alwaysPrepared),
    spellbook: mergeTextValues(actor.spellState.spellbook, grantedSpells.spellbook),
    atWill: mergeTextValues(actor.spellState.atWill, grantedSpells.atWill),
    perShortRest: mergeTextValues(actor.spellState.perShortRest, grantedSpells.perShortRest),
    perLongRest: mergeTextValues(actor.spellState.perLongRest, grantedSpells.perLongRest)
  };
}

function spellMatchesSingleClassFilter(spell: SpellEntry, className: string) {
  return (
    spell.classes.some((entry) => normalizeKey(entry) === normalizeKey(className)) ||
    spell.classReferences.some(
      (entry) => normalizeKey(entry.className) === normalizeKey(className) || normalizeKey(entry.name) === normalizeKey(className)
    )
  );
}

function deriveGrantedSpellState(actor: ActorSheet, compendium: CampaignSnapshot["compendium"]) {
  const granted = {
    known: [] as string[],
    spellbook: [] as string[],
    alwaysPrepared: [] as string[],
    atWill: [] as string[],
    perShortRest: [] as string[],
    perLongRest: [] as string[]
  };
  const selectedSpecies = compendium.races.find((entry) => entry.id === actor.build?.speciesId) ?? null;
  const selectedBackground = compendium.backgrounds.find((entry) => entry.id === actor.build?.backgroundId) ?? null;
  const texts = [
    selectedSpecies ? selectedSpecies.entries || selectedSpecies.description : "",
    selectedBackground ? selectedBackground.entries || selectedBackground.description : "",
    ...actor.feats.map((entry) => {
      const feat = findByName(compendium.feats, entry);
      return feat ? [feat.abilityScoreIncrease, feat.description].filter(Boolean).join("\n") : "";
    }),
    ...actor.features.map((entry) => {
      const optionalFeature = findByName(compendium.optionalFeatures, entry);
      return optionalFeature ? optionalFeature.entries || optionalFeature.description : "";
    }),
    ...availableClassFeatures(actor, compendium.classes).map((entry) => entry.description),
    ...actor.classes.flatMap((actorClass) => {
      const classEntry = findCompendiumClass(actorClass, compendium.classes);
      const subclassId = actor.build?.classes.find((entry) => entry.id === actorClass.id)?.subclassId;
      const subclass = classEntry?.subclasses.find((entry) => entry.id === subclassId);
      return subclass?.features.filter((entry) => entry.level <= actorClass.level).map((entry) => entry.description) ?? [];
    })
  ].filter(Boolean);

  texts.forEach((text) => {
    const parsed = parseGrantedSpellsFromText(text);
    granted.known = mergeTextValues(granted.known, parsed.known);
    granted.spellbook = mergeTextValues(granted.spellbook, parsed.spellbook);
    granted.alwaysPrepared = mergeTextValues(granted.alwaysPrepared, parsed.alwaysPrepared);
    granted.atWill = mergeTextValues(granted.atWill, parsed.atWill);
    granted.perShortRest = mergeTextValues(granted.perShortRest, parsed.perShortRest);
    granted.perLongRest = mergeTextValues(granted.perLongRest, parsed.perLongRest);
  });

  return granted;
}

function parseGrantedSpellsFromText(text: string) {
  const buckets = {
    known: [] as string[],
    spellbook: [] as string[],
    alwaysPrepared: [] as string[],
    atWill: [] as string[],
    perShortRest: [] as string[],
    perLongRest: [] as string[]
  };

  text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((segment) => {
      const spellNames = extractTaggedNames(segment, "spell");

      if (spellNames.length === 0) {
        return;
      }

      const normalized = normalizeKey(segment);

      if (/always have|always prepared|is always prepared|are always prepared|prepared spell/i.test(normalized)) {
        buckets.alwaysPrepared = mergeTextValues(buckets.alwaysPrepared, spellNames);
        return;
      }

      if (/spellbook|scribe|copied into your spellbook/i.test(normalized)) {
        buckets.spellbook = mergeTextValues(buckets.spellbook, spellNames);
        return;
      }

      if (/at will|without expending a spell slot|without a spell slot/i.test(normalized)) {
        buckets.atWill = mergeTextValues(buckets.atWill, spellNames);
        return;
      }

      if (/short or long rest|once per short rest|once you finish a short rest/i.test(normalized)) {
        buckets.perShortRest = mergeTextValues(buckets.perShortRest, spellNames);
        return;
      }

      if (/long rest|once per long rest|until you finish a long rest/i.test(normalized)) {
        buckets.perLongRest = mergeTextValues(buckets.perLongRest, spellNames);
        return;
      }

      if (/learn|know|gain|cantrip|you can cast/i.test(normalized)) {
        buckets.known = mergeTextValues(buckets.known, spellNames);
      }
    });

  return buckets;
}

function validateGuideSelections(params: {
  actor: ActorSheet;
  spec: GuidedChoiceSpec;
  setup: GuidedSetupState;
  mode: GuidedFlowMode;
  targetClass: ClassEntry;
  currentSubclassId: string;
}) {
  if (params.mode === "setup" && (!params.setup.speciesId || !params.setup.backgroundId || !params.setup.classId)) {
    return "Choose a species, background, and class.";
  }

  if (
    params.spec.subclassOptions.length > 0 &&
    !params.currentSubclassId &&
    !params.setup.subclassId.trim()
  ) {
    return "Choose the subclass unlocked by this guide step.";
  }

  if (!hasEnoughGuideSelections(params.setup.classFeatIds, params.spec.classFeatCount)) {
    return "Choose every required class feat.";
  }

  if (!hasEnoughGuideSelections(params.setup.optionalFeatureIds, params.spec.optionalFeatureCount)) {
    return "Choose every required class feature option.";
  }

  if (!hasEnoughGuideSelections(params.setup.cantripIds, params.spec.cantripCount)) {
    return "Choose every required cantrip.";
  }

  if (!hasEnoughGuideSelections(params.setup.knownSpellIds, params.spec.knownSpellCount)) {
    return "Choose every required spell.";
  }

  if (!hasEnoughGuideSelections(params.setup.spellbookSpellIds, params.spec.spellbookCount)) {
    return "Choose every required spellbook spell.";
  }

  if (!hasEnoughGuideSelections(params.setup.expertiseSkillChoices, params.spec.expertiseCount)) {
    return "Choose every required expertise skill.";
  }

  if (
    params.spec.abilityImprovementCount > 0 &&
    params.setup.asiMode === "feat" &&
    !params.setup.asiFeatId.trim()
  ) {
    return "Choose a feat or switch the guide to ability score increases.";
  }

  if (
    params.spec.abilityImprovementCount > 0 &&
    params.setup.asiMode === "ability" &&
    params.setup.asiAbilityChoices.filter(Boolean).length < params.spec.abilityImprovementCount * 2
  ) {
    return "Choose the ability score increases for this level.";
  }

  return null;
}

function hasEnoughGuideSelections(values: string[], requiredCount: number) {
  if (requiredCount <= 0) {
    return true;
  }

  return values.slice(0, requiredCount).every((entry) => entry.trim().length > 0);
}

function applyGuideSelectionsToActor(
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

function createBuildSelection(
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

function padGuideSelections<T>(current: T[], count: number, fallback: T[]) {
  const next = [...current].slice(0, count);

  while (next.length < count) {
    const candidate = fallback.find((entry) => !next.includes(entry));
    if (candidate === undefined && fallback[0] === undefined) {
      break;
    }

    next.push((candidate ?? fallback[0]) as T);
  }

  return next;
}

function replaceGuideSelection<T>(current: T[], index: number, value: T) {
  return current.map((entry, entryIndex) => (entryIndex === index ? value : entry));
}

function guideOptionDisabled<T>(current: T[], index: number, value: T) {
  return current.some((entry, entryIndex) => entryIndex !== index && entry === value);
}

function deriveInventoryEquipment(actor: ActorSheet, items: CompendiumItemEntry[], proficiencyBonus: number) {
  const armorItems: ArmorEntry[] = [];
  const attacks: AttackEntry[] = [];

  actor.inventory
    .filter((entry) => entry.equipped)
    .forEach((entry) => {
      const item = findByName(items, entry.name);

      if (!item) {
        return;
      }

      const normalizedArmorType = normalizeKey(item.armorType);
      if (item.armorClass > 0 || normalizedArmorType.includes("shield")) {
        armorItems.push({
          id: `derived-armor:${item.id}:${entry.id}`,
          name: item.name,
          kind: normalizedArmorType.includes("shield") ? "shield" : "armor",
          armorClass: item.armorClass || (normalizedArmorType.includes("shield") ? 2 : 10),
          maxDexBonus: item.maxDexBonus,
          bonus: 0,
          equipped: true,
          notes: [item.armorType, item.properties.join(", ")].filter(Boolean).join(" • ")
        });
      }

      if (item.damage.trim()) {
        const attackAbility = deriveAttackAbility(item, actor);
        const attackModifier = abilityModifierTotal(actor, attackAbility);
        const hasProficiency = !normalizeKey(item.properties.join(" ")).includes("improvised");
        attacks.push({
          id: `derived-attack:${item.id}:${entry.id}`,
          name: item.name,
          attackBonus: attackModifier + (hasProficiency ? proficiencyBonus : 0),
          damage: appendDamageModifier(item.damage, attackModifier),
          damageType: item.damageType,
          notes: [item.range, item.properties.join(", ")].filter(Boolean).join(" • ")
        });
      }
    });

  return {
    armorItems,
    attacks
  };
}

function deriveAttackAbility(item: CompendiumItemEntry, actor: ActorSheet): AbilityKey {
  const properties = normalizeKey(item.properties.join(" "));
  const range = normalizeKey(item.range);

  if (properties.includes("finesse")) {
    return abilityModifierTotal(actor, "dex") > abilityModifierTotal(actor, "str") ? "dex" : "str";
  }

  if (range.includes("/") || range.includes("ranged") || normalizeKey(item.itemType).includes("ranged")) {
    return "dex";
  }

  return "str";
}

function appendDamageModifier(damage: string, modifier: number) {
  if (!damage.trim()) {
    return "";
  }

  if (/[+-]\s*\d+\s*$/i.test(damage) || modifier === 0) {
    return damage;
  }

  return modifier > 0 ? `${damage} + ${modifier}` : `${damage} - ${Math.abs(modifier)}`;
}

function mergeDerivedArmorItems(current: ArmorEntry[], derived: ArmorEntry[]) {
  const manual = current.filter((entry) => !entry.id.startsWith("derived-armor:"));
  return [...manual, ...derived];
}

function mergeDerivedAttacks(current: AttackEntry[], derived: AttackEntry[]) {
  const manual = current.filter((entry) => !entry.id.startsWith("derived-attack:"));
  return [...manual, ...derived];
}

function buildMainAutosaveState(actor: ActorSheet) {
  return {
    hitPoints: actor.hitPoints,
    experience: actor.experience,
    inspiration: actor.inspiration,
    initiativeRoll: actor.initiativeRoll ?? null,
    spellSlots: actor.spellSlots,
    preparedSpells: actor.preparedSpells,
    resources: actor.resources,
    inventory: actor.inventory,
    currency: actor.currency,
    notes: actor.notes,
    conditions: actor.conditions,
    exhaustionLevel: actor.exhaustionLevel,
    concentration: actor.concentration,
    deathSaves: actor.deathSaves,
    classes: actor.classes.map((entry) => ({ id: entry.id, usedHitDice: entry.usedHitDice }))
  };
}

function deriveGuidedChoiceSpec(params: {
  actor: ActorSheet;
  classes: ClassEntry[];
  spells: SpellEntry[];
  feats: FeatEntry[];
  optionalFeatures: CompendiumOptionalFeatureEntry[];
  targetClassId: string;
  targetActorClassId: string;
  targetSubclassId: string;
  mode: GuidedFlowMode;
}): GuidedChoiceSpec {
  const actorClassForGuide =
    params.targetActorClassId && params.targetActorClassId !== NEW_GUIDED_CLASS_ID
      ? params.actor.classes.find((entry) => entry.id === params.targetActorClassId) ?? null
      : null;
  const classEntry =
    (actorClassForGuide ? findCompendiumClass(actorClassForGuide, params.classes) ?? null : null) ??
    params.classes.find((entry) => entry.id === params.targetClassId) ??
    null;

  if (!classEntry) {
    return {
      subclassOptions: [],
      classFeatOptions: [],
      classFeatCount: 0,
      optionalFeatureOptions: [],
      optionalFeatureCount: 0,
      cantripOptions: [],
      cantripCount: 0,
      knownSpellOptions: [],
      knownSpellCount: 0,
      spellbookOptions: [],
      spellbookCount: 0,
      expertiseSkillOptions: [],
      expertiseCount: 0,
      abilityImprovementCount: 0
    };
  }

  const currentActorClass =
    params.mode === "levelup" && params.targetActorClassId && params.targetActorClassId !== NEW_GUIDED_CLASS_ID
      ? params.actor.classes.find((entry) => entry.id === params.targetActorClassId) ?? null
      : null;
  const currentLevel = params.mode === "setup" ? 0 : currentActorClass?.level ?? 0;
  const targetLevel = Math.max(1, currentLevel + 1);
  const unlockedClassFeatures = classEntry.features.filter((entry) => entry.level > currentLevel && entry.level <= targetLevel);
  const currentSubclassId = currentActorClass
    ? params.actor.build?.classes.find((entry) => entry.id === currentActorClass.id)?.subclassId ?? ""
    : "";
  const activeSubclassId = params.targetSubclassId || currentSubclassId;
  const activeSubclass =
    activeSubclassId.trim().length > 0 ? classEntry.subclasses.find((entry) => entry.id === activeSubclassId) ?? null : null;
  const unlockedSubclassFeatures = activeSubclass?.features.filter((entry) => entry.level > currentLevel && entry.level <= targetLevel) ?? [];

  const cantripCount = Math.max(0, readClassTableValue(classEntry, targetLevel, ["cantrip"]) - readClassTableValue(classEntry, currentLevel, ["cantrip"]));
  const knownSpellCount =
    classEntry.spellPreparation === "known"
      ? Math.max(0, readClassTableValue(classEntry, targetLevel, ["spells known"]) - readClassTableValue(classEntry, currentLevel, ["spells known"]))
      : 0;
  const spellbookCount =
    classEntry.spellPreparation === "spellbook" && normalizeKey(classEntry.name) === "wizard"
      ? currentLevel === 0
        ? 6
        : 2
      : 0;
  const invocationCount = Math.max(0, readClassTableValue(classEntry, targetLevel, ["invocation"]) - readClassTableValue(classEntry, currentLevel, ["invocation"]));
  const fightingStyleCount = unlockedClassFeatures.some((entry) => normalizeKey(entry.name).includes("fighting style")) ? 1 : 0;
  const expertiseCount = unlockedClassFeatures
    .filter((entry) => normalizeKey(entry.name).includes("expertise"))
    .reduce((sum, entry) => sum + parseChoiceCount(entry.description, 2), 0);
  const metamagicCount = unlockedClassFeatures
    .filter((entry) => normalizeKey(entry.name).includes("metamagic"))
    .reduce((sum, entry) => sum + parseChoiceCount(entry.description, currentLevel === 0 ? 2 : 1), 0);
  const maneuverCount = unlockedSubclassFeatures
    .filter((entry) => /maneuver|combat superiority/i.test(entry.name) || /maneuver/i.test(entry.description))
    .reduce((sum, entry) => sum + parseChoiceCount(entry.description, 3), 0);
  const abilityImprovementCount = unlockedClassFeatures.some((entry) => normalizeKey(entry.name).includes("ability score improvement")) ? 1 : 0;
  const existingFeatNames = new Set(params.actor.feats.map((entry) => normalizeKey(entry)));
  const classFeatOptions = params.feats.filter(
    (entry) => normalizeKey(entry.category).includes("fs") && !existingFeatNames.has(normalizeKey(entry.name))
  );
  const optionalFeatureOptions =
    invocationCount > 0
      ? params.optionalFeatures.filter(
          (entry) =>
            normalizeKey(entry.category).includes("eldritch invocation") &&
            !params.actor.features.some((feature) => normalizeKey(feature) === normalizeKey(entry.name))
        )
      : metamagicCount > 0
        ? params.optionalFeatures.filter(
            (entry) =>
              normalizeKey(entry.category).includes("metamagic") &&
              !params.actor.features.some((feature) => normalizeKey(feature) === normalizeKey(entry.name))
          )
        : maneuverCount > 0
          ? params.optionalFeatures.filter(
              (entry) =>
                normalizeKey(entry.category).includes("maneuver") &&
                !params.actor.features.some((feature) => normalizeKey(feature) === normalizeKey(entry.name))
            )
          : [];
  const optionalFeatureCount = invocationCount + metamagicCount + maneuverCount;
  const maxSpellLevel = deriveMaximumSpellLevelForClass(classEntry, targetLevel);
  const existingSpellNames = new Set(
    [
      ...params.actor.spells,
      ...params.actor.preparedSpells,
      ...params.actor.spellState.spellbook,
      ...params.actor.spellState.alwaysPrepared,
      ...params.actor.spellState.atWill,
      ...params.actor.spellState.perShortRest,
      ...params.actor.spellState.perLongRest
    ].map((entry) => normalizeKey(entry))
  );
  const classSpellOptions = params.spells.filter((entry) => spellMatchesSingleClassFilter(entry, classEntry.name));
  const cantripOptions = classSpellOptions.filter((entry) => entry.level === "cantrip" && !existingSpellNames.has(normalizeKey(entry.name)));
  const leveledSpellOptions = classSpellOptions.filter(
    (entry) => typeof entry.level === "number" && entry.level <= maxSpellLevel && !existingSpellNames.has(normalizeKey(entry.name))
  );

  return {
    subclassOptions: targetLevel >= (classEntry.subclassLevel ?? 99) ? classEntry.subclasses : [],
    classFeatOptions,
    classFeatCount: fightingStyleCount,
    optionalFeatureOptions,
    optionalFeatureCount,
    cantripOptions,
    cantripCount,
    knownSpellOptions: leveledSpellOptions,
    knownSpellCount,
    spellbookOptions: leveledSpellOptions,
    spellbookCount,
    expertiseSkillOptions: params.actor.skills.filter((entry) => (entry.proficient || currentLevel === 0) && !entry.expertise),
    expertiseCount,
    abilityImprovementCount
  };
}

function readClassTableValue(classEntry: ClassEntry, level: number, tokens: string[]) {
  if (level <= 0) {
    return 0;
  }

  for (const table of classEntry.tables) {
    const row = table.rows[level - 1];

    if (!row) {
      continue;
    }

    const index = table.columns.findIndex((label) => tokens.every((token) => normalizeKey(label).includes(token)));
    if (index >= 0) {
      return readTableCounter(row[index]);
    }
  }

  return 0;
}

function deriveMaximumSpellLevelForClass(classEntry: ClassEntry, level: number) {
  let maxLevel = 0;

  for (const table of classEntry.tables) {
    const row = table.rows[level - 1];

    if (!row) {
      continue;
    }

    table.columns.forEach((label, index) => {
      const slotLevel = extractSpellSlotLevel(label);
      if (slotLevel && readTableCounter(row[index]) > 0) {
        maxLevel = Math.max(maxLevel, slotLevel);
      }
    });

    const spellSlotsIndex = table.columns.findIndex((label) => normalizeKey(label) === "spell slots");
    const slotLevelIndex = table.columns.findIndex((label) => normalizeKey(label) === "slot level");
    if (spellSlotsIndex >= 0 && slotLevelIndex >= 0 && readTableCounter(row[spellSlotsIndex]) > 0) {
      maxLevel = Math.max(maxLevel, readTableCounter(row[slotLevelIndex]));
    }
  }

  return maxLevel;
}

function parseChoiceCount(description: string, fallback: number) {
  const normalized = description.toLowerCase();
  if (/\bsix\b/.test(normalized)) return 6;
  if (/\bfive\b/.test(normalized)) return 5;
  if (/\bfour\b/.test(normalized)) return 4;
  if (/\bthree\b/.test(normalized)) return 3;
  if (/\btwo\b/.test(normalized)) return 2;
  if (/\bone\b/.test(normalized)) return 1;
  const numericMatch = normalized.match(/\b(\d+)\b/);
  return numericMatch ? Number(numericMatch[1]) : fallback;
}

function deriveSpellSlots(actor: ActorSheet, classes: ClassEntry[]) {
  const totals = Array.from({ length: 9 }, (_, index) => ({
    level: index + 1,
    total: 0,
    used: actor.spellSlots.find((entry) => entry.level === index + 1)?.used ?? 0
  }));

  actor.classes.forEach((actorClass) => {
    const classEntry = findCompendiumClass(actorClass, classes);
    classEntry?.tables.forEach((table) => {
      const row = table.rows[actorClass.level - 1];

      if (!row) {
        return;
      }

      table.columns.forEach((label, columnIndex) => {
        const slotLevel = extractSpellSlotLevel(label);
        const value = readTableCounter(row[columnIndex]);

        if (!slotLevel || value <= 0) {
          return;
        }

        totals[slotLevel - 1].total += value;
      });

      const spellSlotsIndex = table.columns.findIndex((label) => normalizeKey(label) === "spell slots");
      const slotLevelIndex = table.columns.findIndex((label) => normalizeKey(label) === "slot level");

      if (spellSlotsIndex < 0 || slotLevelIndex < 0) {
        return;
      }

      const pactSlotCount = readTableCounter(row[spellSlotsIndex]);
      const pactSlotLevel = readTableCounter(row[slotLevelIndex]);

      if (pactSlotCount > 0 && pactSlotLevel > 0 && pactSlotLevel <= totals.length) {
        totals[pactSlotLevel - 1].total += pactSlotCount;
      }
    });
  });

  return totals.map((entry) => ({
    ...entry,
    used: Math.min(entry.used, entry.total)
  }));
}

function extractSpellSlotLevel(label: string) {
  const normalized = normalizeKey(label);
  const match = label.match(/\b([1-9])(st|nd|rd|th)\b/i) ?? normalized.match(/^([1-9])(st|nd|rd|th)?$/);
  return match ? Number(match[1]) : null;
}

function readTableCounter(value: string | undefined) {
  if (!value) {
    return 0;
  }

  const normalized = value.trim();
  const leading = normalized.match(/^(\d+)/);

  if (leading) {
    return Number(leading[1]);
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeTextValues(current: string[], next: string[]) {
  return Array.from(new Set([...current, ...next].filter(Boolean)));
}

function splitCommaValues(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

function toAbilityKey(value: string): AbilityKey | null {
  switch (normalizeKey(value)) {
    case "str":
    case "strength":
      return "str";
    case "dex":
    case "dexterity":
      return "dex";
    case "con":
    case "constitution":
      return "con";
    case "int":
    case "intelligence":
      return "int";
    case "wis":
    case "wisdom":
      return "wis";
    case "cha":
    case "charisma":
      return "cha";
    default:
      return null;
  }
}

function mergeAbilityKeys(current: AbilityKey[], next: AbilityKey[]) {
  return Array.from(new Set([...current, ...next]));
}

function derivePreparedSpellLimit(actor: ActorSheet, classes: ClassEntry[]) {
  return actor.classes.reduce((sum, actorClass) => {
    const classEntry = findCompendiumClass(actorClass, classes);

    if (!classEntry || (classEntry.spellPreparation !== "prepared" && classEntry.spellPreparation !== "spellbook")) {
      return sum;
    }

    const fromTable = findPreparedSpellCount(actorClass, classEntry);

    if (fromTable > 0) {
      return sum + fromTable;
    }

    const spellcastingAbility = actorClass.spellcastingAbility ?? classEntry.spellcastingAbility;

    if (!spellcastingAbility) {
      return sum;
    }

    return sum + Math.max(1, actorClass.level + abilityModifierTotal(actor, spellcastingAbility));
  }, 0);
}

function findPreparedSpellCount(actorClass: ActorClassEntry, classEntry: ClassEntry) {
  for (const table of classEntry.tables) {
    const preparedColumnIndex = table.columns.findIndex((label) => normalizeKey(label).includes("prepared spell"));
    const row = table.rows[actorClass.level - 1];

    if (preparedColumnIndex >= 0 && row) {
      const value = readTableCounter(row[preparedColumnIndex]);

      if (value > 0) {
        return value;
      }
    }
  }

  return 0;
}

function deriveGuidedHitPointMax(actor: ActorSheet) {
  if (actor.classes.length === 0) {
    return actor.hitPoints.max;
  }

  const constitutionModifier = abilityModifierTotal(actor, "con");
  const firstClass = actor.classes[0];
  const baseHp = Math.max(1, firstClass.hitDieFaces + constitutionModifier);
  const leveledHp = (actor.build?.selections ?? []).reduce((sum, selection) => sum + extractLevelUpHpGain(selection.notes), 0);

  if (leveledHp > 0) {
    return Math.max(baseHp + leveledHp, baseHp);
  }

  if (totalLevel(actor) > 1 && actor.hitPoints.max > 0) {
    return actor.hitPoints.max;
  }

  return baseHp;
}

function effectiveHitPointMax(baseMax: number, reducedMax: number) {
  return Math.max(0, Math.max(0, baseMax) - Math.max(0, reducedMax));
}

function normalizeHitPoints(hitPoints: ActorSheet["hitPoints"], baseMax: number): ActorSheet["hitPoints"] {
  const max = Math.max(0, Number.isFinite(baseMax) ? baseMax : hitPoints.max);
  const reducedMax = Math.max(0, hitPoints.reducedMax || 0);
  const temp = Math.max(0, hitPoints.temp || 0);
  const current = Math.max(0, Math.min(hitPoints.current || 0, effectiveHitPointMax(max, reducedMax)));

  return {
    current,
    max,
    temp,
    reducedMax
  };
}

function healHitPoints(hitPoints: ActorSheet["hitPoints"], healing: number, baseMax: number) {
  const normalized = normalizeHitPoints(hitPoints, baseMax);

  if (healing <= 0) {
    return normalized;
  }

  return {
    ...normalized,
    current: Math.min(effectiveHitPointMax(normalized.max, normalized.reducedMax), normalized.current + healing)
  };
}

function deriveHitPointDisplayState(hitPoints: ActorSheet["hitPoints"], baseMax: number) {
  const normalized = normalizeHitPoints(hitPoints, baseMax);
  const effectiveMax = effectiveHitPointMax(normalized.max, normalized.reducedMax);

  return {
    current: normalized.current,
    damage: Math.max(0, effectiveMax - normalized.current),
    temp: normalized.temp,
    effectiveMax,
    baseMax: normalized.max,
    reducedMax: normalized.reducedMax
  };
}

function extractLevelUpHpGain(notes: string) {
  const match = notes.match(/([+-]?\d+)\s*hp/i);
  return match ? Number(match[1]) : 0;
}

function deriveClassResources(actor: ActorSheet, classes: ClassEntry[]) {
  const resources: DerivedResourceDefinition[] = [];

  actor.classes.forEach((actorClass) => {
    const classEntry = findCompendiumClass(actorClass, classes);

    if (!classEntry) {
      return;
    }

    classEntry.tables.forEach((table) => {
      const row = table.rows[actorClass.level - 1];

      if (!row) {
        return;
      }

      table.columns.forEach((column, columnIndex) => {
        if (!isResourceColumn(column)) {
          return;
        }

        const max = readTableCounter(row[columnIndex]);

        if (max <= 0) {
          return;
        }

        resources.push({
          id: `derived:${actorClass.id}:${normalizeKey(column)}`,
          name: formatDerivedResourceName(actorClass.name, column),
          max,
          resetOn: inferResourceReset(column),
          restoreAmount: max,
          description: describeDerivedResource(actorClass.name, column, max),
          source: classEntry.source
        });
      });
    });
  });

  return Array.from(new Map(resources.map((entry) => [normalizeKey(entry.name), entry])).values());
}

function isResourceColumn(label: string) {
  const normalized = normalizeKey(label);

  if (extractSpellSlotLevel(label) !== null) {
    return false;
  }

  if (
    normalized === "spell slots" ||
    normalized === "slot level" ||
    normalized.includes("cantrip") ||
    normalized.includes("prepared spell") ||
    normalized.includes("spells known") ||
    normalized.includes("weapon mastery") ||
    normalized.includes("invocations known") ||
    normalized === "features"
  ) {
    return false;
  }

  return [
    "rage",
    "focus",
    "ki",
    "sorcery",
    "superiority",
    "wild shape",
    "channel divinity",
    "lay on hands",
    "bardic inspiration",
    "uses",
    "surges",
    "dice"
  ].some((token) => normalized.includes(token));
}

function formatDerivedResourceName(className: string, label: string) {
  const normalized = normalizeKey(label);

  if (normalized.startsWith(normalizeKey(className))) {
    return label;
  }

  return `${className} ${label}`.trim();
}

function inferResourceReset(label: string) {
  const normalized = normalizeKey(label);

  if (
    normalized.includes("focus") ||
    normalized.includes("ki") ||
    normalized.includes("superiority") ||
    normalized.includes("channel divinity") ||
    normalized.includes("wild shape")
  ) {
    return "Short Rest";
  }

  return "Long Rest";
}

function describeDerivedResource(className: string, label: string, max: number) {
  return `${className} automatically provides ${max} ${label.toLowerCase()} based on the current class table.`;
}

function mergeDerivedResources(resources: ResourceEntry[], derived: DerivedResourceDefinition[]) {
  const manualByKey = new Map(resources.map((entry) => [normalizeKey(entry.name), entry]));
  const merged: ResourceEntry[] = [];

  derived.forEach((entry) => {
    const existing = manualByKey.get(normalizeKey(entry.name));

    merged.push({
      id: existing?.id ?? entry.id,
      name: existing?.name ?? entry.name,
      current: existing?.current ?? entry.max,
      max: existing?.max && existing.max > 0 ? existing.max : entry.max,
      resetOn: existing?.resetOn || entry.resetOn,
      restoreAmount: existing?.restoreAmount && existing.restoreAmount > 0 ? existing.restoreAmount : entry.restoreAmount
    });
  });

  resources.forEach((entry) => {
    if (!derived.some((derivedEntry) => normalizeKey(derivedEntry.name) === normalizeKey(entry.name))) {
      merged.push(entry);
    }
  });

  return merged;
}

function collectFeatureRows(
  actor: ActorSheet,
  compendium: CampaignSnapshot["compendium"],
  selectedSpecies: CampaignSnapshot["compendium"]["races"][number] | null,
  selectedBackground: CampaignSnapshot["compendium"]["backgrounds"][number] | null
) {
  const rows: DetailRowEntry[] = [];

  if (selectedSpecies) {
    rows.push(
      ...parseReferenceFeatureRows("Species", selectedSpecies, [
        { label: "Size", value: selectedSpecies.sizes.join(", ") || "Unknown" },
        { label: "Speed", value: `${selectedSpecies.speed} ft` },
        { label: "Languages", value: selectedSpecies.languages.join(", ") || "None" }
      ])
    );
  }

  if (selectedBackground) {
    rows.push(
      ...parseReferenceFeatureRows("Background", selectedBackground, [
        { label: "Skills", value: deriveBackgroundSkillProficiencies(selectedBackground).join(", ") || "None" },
        { label: "Tools", value: selectedBackground.toolProficiencies.join(", ") || "None" },
        { label: "Languages", value: selectedBackground.languageProficiencies.join(", ") || "None" }
      ])
    );
  }

  availableClassFeatures(actor, compendium.classes).forEach((entry) => {
    rows.push({
      id: entry.key,
      eyebrow: "Class Feature",
      title: entry.name,
      subtitle: `${entry.className} • Level ${entry.level}`,
      source: entry.source,
      description: entry.description
    });
  });

  actor.classes.forEach((actorClass) => {
    const classEntry = findCompendiumClass(actorClass, compendium.classes);
    const subclassId = actor.build?.classes.find((entry) => entry.id === actorClass.id)?.subclassId;
    const subclass = classEntry?.subclasses.find((entry) => entry.id === subclassId);

    subclass?.features
      .filter((entry) => entry.level <= actorClass.level)
      .forEach((entry) => {
        rows.push({
          id: `${subclass.id}:${entry.reference || entry.name}:${entry.level}`,
          eyebrow: "Subclass Feature",
          title: entry.name,
          subtitle: `${subclass.name} • Level ${entry.level}`,
          source: entry.source || subclass.source,
          description: entry.description
        });
      });
  });

  actor.feats.forEach((featName) => {
    const feat = findByName(compendium.feats, featName);

    rows.push(
      feat
        ? {
            id: feat.id,
            eyebrow: "Feat",
            title: feat.name,
            subtitle: feat.prerequisites ? `Prerequisite: ${feat.prerequisites}` : feat.category,
            source: feat.source,
            description: [feat.abilityScoreIncrease, feat.description].filter(Boolean).join("\n\n")
          }
        : {
            id: `feat:${normalizeKey(featName)}`,
            eyebrow: "Feat",
            title: featName
          }
    );
  });

  actor.features.forEach((featureName) => {
    const alreadyIncluded = rows.some((entry) => normalizeKey(entry.title) === normalizeKey(featureName));

    if (alreadyIncluded) {
      return;
    }

    const optionalFeature = findByName(compendium.optionalFeatures, featureName);

    rows.push(
      optionalFeature
        ? createReferenceRow("Optional Feature", optionalFeature, [
            { label: "Prerequisites", value: optionalFeature.prerequisites || "None" }
          ])
        : {
            id: `feature:${normalizeKey(featureName)}`,
            eyebrow: "Feature",
            title: featureName
          }
    );
  });

  return Array.from(new Map(rows.map((entry) => [`${entry.eyebrow}:${normalizeKey(entry.title)}`, entry])).values());
}

function collectSpellRows(spellNames: string[], preparedSpells: string[], spells: SpellEntry[], preparedSpellLimit: number) {
  return spellNames.map((spellName) => {
    const spell = findByName(spells, spellName);

    if (!spell) {
      return {
        id: `spell:${normalizeKey(spellName)}`,
        eyebrow: "Spell",
        title: spellName
      } satisfies DetailRowEntry;
    }

    return {
      id: spell.id,
      eyebrow: spell.level === "cantrip" ? "Cantrip" : `Spell ${spell.level}`,
      title: spell.name,
      subtitle: `${spell.school} • ${preparedSpells.includes(spell.name) ? "Prepared" : "Known"}`,
      source: spell.source,
      description: spell.fullDescription || spell.description,
      meta: [
        { label: "Casting Time", value: `${spell.castingTimeValue} ${spell.castingTimeUnit}` },
        { label: "Range", value: spell.rangeType === "feet" ? `${spell.rangeValue} ft` : spell.rangeType },
        { label: "Duration", value: spell.durationUnit === "instant" ? "Instant" : `${spell.durationValue} ${spell.durationUnit}` },
        { label: "Preparation Limit", value: preparedSpellLimit > 0 ? String(preparedSpellLimit) : "Not prepared" }
      ]
    } satisfies DetailRowEntry;
  });
}

function collectFeatRows(featNames: string[], feats: FeatEntry[]) {
  return featNames.map((featName) => {
    const feat = findByName(feats, featName);

    if (!feat) {
      return {
        id: `feat:${normalizeKey(featName)}`,
        eyebrow: "Feat",
        title: featName
      } satisfies DetailRowEntry;
    }

    return {
      id: feat.id,
      eyebrow: "Feat",
      title: feat.name,
      subtitle: feat.prerequisites ? `Prerequisite: ${feat.prerequisites}` : feat.category,
      source: feat.source,
      description: [feat.abilityScoreIncrease, feat.description].filter(Boolean).join("\n\n")
    } satisfies DetailRowEntry;
  });
}

function createReferenceRow(
  eyebrow: string,
  entry: CompendiumReferenceEntry,
  meta: DetailRowMeta[] = []
): DetailRowEntry {
  return {
    id: entry.id,
    eyebrow,
    title: entry.name,
    subtitle: entry.category,
    source: entry.source,
    description: entry.entries || entry.description,
    tags: entry.tags,
    meta
  };
}

function parseReferenceFeatureRows(eyebrow: string, entry: CompendiumReferenceEntry, meta: DetailRowMeta[] = []) {
  const text = entry.entries || entry.description;
  const inlinePairs = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line, index) => {
      const inlineMatch = line.match(/^([^:]+):\.?\s*(.+)$/);

      if (!inlineMatch) {
        return [];
      }

      return [
        {
          id: `${entry.id}:inline:${index}`,
          eyebrow,
          title: inlineMatch[1].trim(),
          subtitle: entry.category,
          source: entry.source,
          description: inlineMatch[2].trim(),
          tags: entry.tags
        } satisfies DetailRowEntry
      ];
    });

  if (inlinePairs.length > 0) {
    return inlinePairs;
  }

  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const parsed: DetailRowEntry[] = [];
  let currentTitle = "";
  let currentBody: string[] = [];

  function flushCurrent() {
    if (!currentTitle) {
      return;
    }

    parsed.push({
      id: `${entry.id}:${normalizeKey(currentTitle)}`,
      eyebrow,
      title: currentTitle,
      subtitle: entry.category,
      source: entry.source,
      description: currentBody.join("\n"),
      tags: entry.tags,
      meta
    });
  }

  lines.forEach((line) => {
    if (looksLikeFeatureHeading(line)) {
      flushCurrent();
      currentTitle = line.replace(/[:.]+$/, "").trim();
      currentBody = [];
      return;
    }

    currentBody.push(line);
  });
  flushCurrent();

  return parsed.length > 0 ? parsed : [createReferenceRow(eyebrow, entry, meta)];
}

function looksLikeFeatureHeading(value: string) {
  return value.length <= 48 && !value.includes("{@") && !/[.!?]$/.test(value);
}

function findByName<T extends { name: string }>(entries: T[], name: string) {
  return entries.find((entry) => normalizeKey(entry.name) === normalizeKey(name));
}

function findSpellEntriesByNames(spellNames: string[], spells: SpellEntry[]) {
  const namesToFind = new Set(spellNames.map((entry) => normalizeKey(entry)));

  return spells
    .filter((entry) => namesToFind.has(normalizeKey(entry.name)))
    .sort((left, right) => {
      const leftLevel = left.level === "cantrip" ? 0 : left.level;
      const rightLevel = right.level === "cantrip" ? 0 : right.level;

      if (leftLevel !== rightLevel) {
        return leftLevel - rightLevel;
      }

      return left.name.localeCompare(right.name);
    });
}

function findSpellIdsByNames(spellNames: string[], spells: SpellEntry[]) {
  return spellNames
    .map((name) => findByName(spells, name)?.id ?? "")
    .filter((entry) => entry.length > 0);
}

function findSpellNamesByIds(spellIds: string[], spells: SpellEntry[]) {
  return spellIds
    .map((spellId) => spells.find((entry) => entry.id === spellId)?.name ?? "")
    .filter((entry) => entry.length > 0);
}

function syncBuildClasses(actorClasses: ActorClassEntry[], currentBuildClasses: NonNullable<ActorSheet["build"]>["classes"]) {
  return actorClasses.map((entry) => {
    const existing = currentBuildClasses.find((buildClass) => buildClass.id === entry.id);

    return {
      id: entry.id,
      classId: entry.compendiumId,
      className: entry.name,
      classSource: entry.source,
      subclassId: existing?.subclassId,
      subclassName: existing?.subclassName,
      subclassSource: existing?.subclassSource,
      level: entry.level
    };
  });
}

function buildD20Notation(modifier: number, mode: RollMode) {
  const base = mode === "advantage" ? "2d20kh1" : mode === "disadvantage" ? "2d20kl1" : "1d20";
  return modifier >= 0 ? `${base}+${modifier}` : `${base}${modifier}`;
}

function buildStaticRollNotation(total: number) {
  return `1d20*0+${Math.max(0, Math.round(total))}`;
}

function updateHitPoints(
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

function createAttackEntry(): AttackEntry {
  return {
    id: crypto.randomUUID(),
    name: "",
    attackBonus: 0,
    damage: "",
    damageType: "",
    notes: ""
  };
}

function createArmorEntry(): ArmorEntry {
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

function createResourceEntry(): ResourceEntry {
  return {
    id: crypto.randomUUID(),
    name: "",
    current: 0,
    max: 0,
    resetOn: "",
    restoreAmount: 0
  };
}

function createInventoryEntry(): InventoryEntry {
  return {
    id: crypto.randomUUID(),
    name: "",
    type: "gear",
    quantity: 1,
    equipped: false,
    notes: ""
  };
}

function rollDie(faces: number) {
  return Math.floor(Math.random() * faces) + 1;
}

function PortraitCard({ actor, compact = false }: { actor: ActorSheet; compact?: boolean }) {
  const initials =
    actor.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((entry) => entry[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <div className={`flex items-start justify-center ${compact ? "" : "pt-1"}`}>
      <div
        className={`${compact ? "h-12 w-12 text-sm" : "h-24 w-24 text-xl"} overflow-hidden rounded-full border border-amber-400/40 shadow-[0_0_0_4px_rgba(15,23,42,0.9)]`}
        style={{ backgroundColor: actor.imageUrl ? undefined : actor.color || "#334155" }}
      >
        {actor.imageUrl ? (
          <img className="h-full w-full object-cover" src={resolveAssetUrl(actor.imageUrl)} alt={actor.name || "Actor token"} />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-semibold uppercase text-slate-950">
            {initials}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailCollection({
  title,
  entries,
  emptyMessage,
  headerAction,
  actions,
  renderText
}: {
  title?: string;
  entries: DetailRowEntry[];
  emptyMessage: string;
  headerAction?: ReactNode;
  actions?: (entry: DetailRowEntry) => ReactNode;
  renderText?: (text: string) => ReactNode;
}) {
  return (
    <div className="space-y-2">
      {title || headerAction ? (
        <div className="flex items-center justify-between gap-3">
          {title ? <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">{title}</p> : <span />}
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </div>
      ) : null}
      {entries.length === 0 ? <p className="text-sm text-zinc-500">{emptyMessage}</p> : null}
      {entries.map((entry) => (
        <details key={entry.id} className="group border border-white/8 bg-black/20">
          <summary className="list-none cursor-pointer px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.24em] text-amber-400/80">{entry.eyebrow}</p>
                <p className="mt-1 truncate text-sm text-zinc-100">{entry.title}</p>
                <p className="text-xs text-zinc-500">{[entry.subtitle, entry.source].filter(Boolean).join(" • ")}</p>
              </div>
              {actions ? <div className="shrink-0">{actions(entry)}</div> : null}
            </div>
          </summary>
          <div className="space-y-3 border-t border-white/8 px-3 py-3">
            {entry.meta?.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {entry.meta.map((item) => (
                  <div key={`${entry.id}:${item.label}`} className="border border-white/8 bg-black/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{item.label}</p>
                    <p className="mt-1 text-sm text-zinc-200">{item.value}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {entry.description ? (
              <div className="text-sm leading-6 text-zinc-300">{renderText ? renderText(entry.description) : <p className="whitespace-pre-wrap">{entry.description}</p>}</div>
            ) : null}
            {entry.tags?.length ? <TagRow tags={entry.tags} /> : null}
            {entry.onRemove ? (
              <div className="flex justify-end">
                <button type="button" className={secondaryButtonClass} onClick={entry.onRemove}>
                  Remove
                </button>
              </div>
            ) : null}
          </div>
        </details>
      ))}
    </div>
  );
}

function TagRow({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span key={tag} className="border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-300">
          {tag}
        </span>
      ))}
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <article className="border border-white/10 bg-slate-950/80">
      <header className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
        <span className="text-amber-400">{icon}</span>
        <p className="text-[10px] uppercase tracking-[0.24em] text-amber-400/80">{title}</p>
      </header>
      <div className="space-y-3 p-3">{children}</div>
    </article>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-xs text-zinc-300">
      <span className="block text-[9px] uppercase tracking-[0.16em] text-amber-400/80" title={hint}>
        {label}
      </span>
      {children}
    </label>
  );
}

function CompactStatChip({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  return (
    <div
      className={`border border-white/8 bg-black/20 px-2 py-2 ${onClick ? "cursor-pointer transition hover:border-amber-500/60" : ""}`}
      onClick={onClick}
    >
      <p className="text-[9px] uppercase tracking-[0.18em] text-amber-400/80">{label}</p>
      <p className="mt-1 text-lg font-semibold text-amber-50">{value}</p>
    </div>
  );
}

function HitPointBar({
  current,
  damage,
  temp,
  effectiveMax,
  baseMax,
  reducedMax
}: {
  current: number;
  damage: number;
  temp: number;
  effectiveMax: number;
  baseMax: number;
  reducedMax: number;
}) {
  const total = current + damage + temp;
  const currentWidth = total > 0 ? (current / total) * 100 : 0;
  const damageWidth = total > 0 ? (damage / total) * 100 : 0;
  const tempWidth = total > 0 ? (temp / total) * 100 : 0;

  return (
    <div className="space-y-2 border border-white/8 bg-black/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] uppercase tracking-[0.16em] text-amber-400/80" title="Current and effective maximum hit points.">
            Hit Points
          </p>
          <p className="mt-1 text-base font-semibold text-amber-50">
            {current}
            <span className="ml-1 text-sm text-zinc-400">/ {effectiveMax}</span>
          </p>
        </div>
        <div className="text-right text-[10px] uppercase tracking-[0.14em] text-zinc-400">
          <p className="text-emerald-300" title="Current hit points.">HP {current}</p>
          <p className="text-sky-300" title="Temporary hit points that are lost first.">THP {temp}</p>
          <p className="text-rose-300" title="Damage taken against effective maximum hit points.">DMG {damage}</p>
          {reducedMax > 0 ? <p className="text-amber-300" title="Maximum hit points reduced by an effect.">RED {-reducedMax}</p> : <p title="Base maximum hit points before reductions.">BASE {baseMax}</p>}
        </div>
      </div>
      <div className="h-3 overflow-hidden rounded-full border border-white/8 bg-black/40">
        <div className="flex h-full w-full">
          <div className="bg-emerald-500" style={{ width: `${currentWidth}%` }} />
          <div className="bg-sky-500" style={{ width: `${tempWidth}%` }} />
          <div className="bg-rose-500" style={{ width: `${damageWidth}%` }} />
        </div>
      </div>
    </div>
  );
}

function ExhaustionTrack({
  level,
  onChange,
  condition,
  renderText
}: {
  level: number;
  onChange: (level: number) => void;
  condition: CompendiumReferenceEntry | null;
  renderText: (text: string) => ReactNode;
}) {
  const [anchor, setAnchor] = useState<FloatingAnchor | null>(null);

  return (
    <div
      className="space-y-1"
      onMouseEnter={(event) => setAnchor(anchorFromRect(event.currentTarget.getBoundingClientRect()))}
      onMouseLeave={() => setAnchor(null)}
    >
      <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.16em] text-zinc-300">
        <span>Exhaustion</span>
        <span>{level}/6</span>
      </div>
      <input
        className={styles.rangeInput}
        type="range"
        min={0}
        max={6}
        step={1}
        value={level}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        style={{ ["--range-progress" as string]: `${(level / 6) * 100}%` }}
        title="Set exhaustion level from 0 to 6."
      />
      <div className="flex items-center justify-between text-[9px] text-zinc-500">
        {Array.from({ length: 7 }, (_, index) => (
          <span key={`exhaustion-label:${index}`} className="w-3 text-center">
            {index}
          </span>
        ))}
      </div>
      {condition ? (
        <FloatingLayer
          anchor={anchor}
          placement="right-start"
          className="max-w-sm border border-white/10 bg-slate-950/98 p-3 text-zinc-100 shadow-[0_18px_70px_rgba(0,0,0,0.45)]"
        >
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-amber-400/80">Condition</p>
            <div>
              <p className="text-sm font-medium text-amber-50">{condition.name}</p>
              <p className="text-[11px] text-zinc-500">{[condition.category, condition.source].filter(Boolean).join(" • ")}</p>
            </div>
            <div className="text-sm leading-6 text-zinc-300">{renderText(condition.entries || condition.description)}</div>
          </div>
        </FloatingLayer>
      ) : null}
    </div>
  );
}

function UsableTrack({
  total,
  available,
  onChange
}: {
  total: number;
  available: number;
  onChange: (available: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: Math.max(total, 0) }, (_, index) => {
        const isAvailable = index < available;

        return (
          <button
            key={index}
            type="button"
            className={`h-5 w-5 rounded-full border transition ${isAvailable ? "border-amber-500 bg-amber-500" : "border-white/15 bg-transparent"}`}
            onClick={() => onChange(isAvailable ? index : index + 1)}
          />
        );
      })}
    </div>
  );
}

function AbilityMiniCard({
  label,
  score,
  modifier,
  save,
  onCheck,
  onSave
}: {
  label: string;
  score: number;
  modifier: number;
  save: number;
  onCheck: () => void;
  onSave: () => void;
}) {
  return (
    <div className="border border-white/8 bg-black/20 px-2 py-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] text-amber-400/80">{label}</p>
          <p className="mt-1 text-lg font-semibold text-amber-50">{score}</p>
        </div>
        <div className="space-y-1 text-right">
          <p className="cursor-pointer text-xs font-medium text-zinc-100 transition hover:text-amber-50" onClick={onCheck}>
            {formatModifier(modifier)}
          </p>
          <p className="cursor-pointer text-[10px] uppercase tracking-[0.14em] text-zinc-500 transition hover:text-amber-50" onClick={onSave}>
            Save {formatModifier(save)}
          </p>
        </div>
      </div>
    </div>
  );
}

function DeathSaveTracker({
  deathSaves,
  onSuccess,
  onFailure,
  onReset,
  onRoll
}: {
  deathSaves: ActorSheet["deathSaves"];
  onSuccess: () => void;
  onFailure: () => void;
  onReset: () => void;
  onRoll: () => void;
}) {
  const history = deathSaves.history ?? [];
  const allFilled = history.length === 3;
  const allSuccess = allFilled && history.every((entry) => entry === "success");
  const allFailure = allFilled && history.every((entry) => entry === "failure");

  return (
    <div className="space-y-2 border border-white/8 bg-black/20 p-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Death Saving Throws</p>
        {allSuccess ? <span className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">Stable</span> : null}
        {allFailure ? <span className="text-[10px] uppercase tracking-[0.16em] text-rose-300">Dead</span> : null}
      </div>
      <div className="flex items-center gap-2">
        {Array.from({ length: 3 }, (_, index) => {
          const entry = history[index];
          const success = entry === "success";
          const failure = entry === "failure";

          return (
            <span
              key={`death:${index}`}
              className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                success ? "border-emerald-400 bg-emerald-400 text-zinc-950" : failure ? "border-rose-500 bg-rose-500 text-zinc-950" : "border-white/15 bg-transparent text-transparent"
              }`}
            >
              {success ? <Plus size={12} /> : failure ? <Skull size={12} /> : <span className="h-3 w-3" />}
            </span>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <IconButton icon={<ThumbsUp size={12} />} label="Mark death save success" onClick={onSuccess} className="h-8 w-8" />
        <IconButton icon={<ThumbsDown size={12} />} label="Mark death save failure" onClick={onFailure} className="h-8 w-8" />
        <IconButton icon={<Dice6 size={12} />} label="Roll death save" onClick={onRoll} className="h-8 w-8" />
        <IconButton icon={<RotateCcw size={12} />} label="Reset death saves" onClick={onReset} className="h-8 w-8" />
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/8 bg-black/20 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.24em] text-amber-400/80">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-amber-50">{value}</p>
    </div>
  );
}

const inputClass =
  "w-full border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-amber-500/70";
const textareaClass =
  "w-full border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-amber-500/70";
const inputClassCompact =
  "w-full border border-white/10 bg-black/20 px-1.5 py-1 text-[11px] text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-amber-500/70";
const textareaClassCompact =
  "w-full border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-amber-500/70";
const actionButtonClass = "border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 transition hover:border-amber-500/70 hover:text-amber-50";
const secondaryButtonClass = "inline-flex items-center gap-2 border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 transition hover:border-amber-500/70 hover:text-amber-50";
const miniButtonClass =
  "inline-flex items-center justify-center gap-1 border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-zinc-300 transition hover:border-amber-500/70 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-40";
