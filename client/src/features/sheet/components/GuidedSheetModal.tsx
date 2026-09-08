import {
  findBackgroundProgression,
  findBaseClassProgression,
  findFeatProgression,
  findSpeciesProgression,
  findSubclassesForClass
} from "@shared/data/progression";
import type { AbilityKey, ActorSheet, CompendiumChoiceGroup, CompendiumChoiceOption, CompendiumReferenceEntry } from "@shared/types";
import { Dice6, Plus, Sparkles, X } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import {
  ClassPreviewCard,
  FeatPreviewCard,
  ReferencePreviewCard,
  SpellPreviewCard,
  SubclassPreviewCard
} from "../../../components/compendium";
import { anchorFromRect, type FloatingAnchor, FloatingLayer } from "../../../components/FloatingLayer";
import { ModalFrame } from "../../../components/ModalFrame";
import { NumericInput } from "../../../components/NumericInput";
import type { GuidedSheetFlowState } from "../hooks/useGuidedSheetFlow";
import { NEW_GUIDED_CLASS_ID, type SheetCompendium, type SpellSelectionTarget } from "../playerNpcSheet2024Types";
import {
  collectSpellRows,
  createReferenceRow,
  deriveClassResources,
  deriveSpellSlots,
  findSpellNamesByIds,
  guideOptionDisabled,
  replaceGuideSelection
} from "../selectors/playerNpcSheet2024Selectors";
import { abilityModifier, abilityOrder, cloneActor, findCompendiumClass, formatModifier } from "../sheetUtils";
import { GuidedChoiceGroupField } from "./GuidedChoiceGroupField";
import { DetailCollection, Field, HoverPreviewTrigger, inputClass, SheetButton, secondaryButtonClass } from "./sheetPrimitives";

const SUBCLASS_PLACEHOLDER_FEATURE_NAMES = new Set([
  "subclass",
  "martial archetype",
  "primal path",
  "divine domain",
  "cleric subclass",
  "bard college",
  "bard subclass",
  "wizard subclass",
  "arcane tradition",
  "roguish archetype",
  "rogue subclass",
  "sacred oath",
  "paladin subclass",
  "druid circle",
  "druid subclass",
  "monastic tradition",
  "monk subclass",
  "sorcerous origin",
  "sorcerer subclass",
  "otherworldly patron",
  "warlock subclass",
  "ranger archetype",
  "ranger subclass",
  "artificer specialist"
]);

function isSubclassPlaceholder(featName: string): boolean {
  return SUBCLASS_PLACEHOLDER_FEATURE_NAMES.has(featName.toLowerCase().trim());
}

function HoverBadge({
  label,
  icon,
  className = "",
  preview
}: {
  label: string;
  icon?: ReactNode;
  className?: string;
  preview?: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<FloatingAnchor | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  const openPreview = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (triggerRef.current) {
      setAnchor(anchorFromRect(triggerRef.current.getBoundingClientRect()));
    }
    setIsOpen(true);
  };

  const closePreviewSoon = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
      closeTimeoutRef.current = null;
    }, 150);
  };

  return (
    <>
      <div
        ref={triggerRef}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium cursor-pointer transition hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] select-none ${className}`}
        tabIndex={0}
        onPointerEnter={openPreview}
        onPointerLeave={closePreviewSoon}
        onFocus={openPreview}
        onBlur={closePreviewSoon}
      >
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span>{label}</span>
      </div>
      {isOpen && preview ? (
        <FloatingLayer
          anchor={anchor}
          placement="top-start"
          offset={8}
          className="pointer-events-auto z-[2147483000] max-w-md"
          onPointerEnter={openPreview}
          onPointerLeave={closePreviewSoon}
        >
          <div className="max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain rounded-lg border border-amber-500/40 bg-slate-950 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.8)] text-zinc-100">
            {preview}
          </div>
        </FloatingLayer>
      ) : null}
    </>
  );
}

interface GuidedSheetModalProps {
  draft: ActorSheet;
  compendium: SheetCompendium;
  guided: GuidedSheetFlowState;
  onOpenSpellSelection: (target: SpellSelectionTarget) => void;
  renderRulesText: (text: string) => ReactNode;
  embedded?: boolean;
  onCancel?: () => void;
}

export function GuidedSheetModal({
  draft,
  compendium,
  guided,
  onOpenSpellSelection,
  renderRulesText,
  embedded = false,
  onCancel
}: GuidedSheetModalProps) {
  if (!guided.guidedFlowOpen) {
    return null;
  }

  const previewLookupProps = {
    spellEntries: compendium.spells,
    featEntries: compendium.feats,
    classEntries: compendium.classes,
    variantRuleEntries: compendium.variantRules,
    conditionEntries: compendium.conditions,
    itemEntries: compendium.items,
    optionalFeatureEntries: compendium.optionalFeatures,
    skillEntries: compendium.skills,
    languageEntries: compendium.languages,
    raceEntries: compendium.races,
    backgroundEntries: compendium.backgrounds
  };
  const renderChoiceOptionPreview = (option: CompendiumChoiceOption) => {
    return option.description ? (
      <div className="max-w-md p-3 text-sm leading-6 text-zinc-300">{renderRulesText(option.description)}</div>
    ) : null;
  };

  const isLevelUp = guided.guidedFlowMode === "levelup";
  const targetActorClass =
    guided.guidedClassId === NEW_GUIDED_CLASS_ID ? null : (draft.classes.find((entry) => entry.id === guided.guidedClassId) ?? null);
  const targetClassEntry =
    guided.guidedClassId === NEW_GUIDED_CLASS_ID
      ? (compendium.classes.find((entry) => entry.id === guided.guidedSetup.classId) ?? null)
      : targetActorClass
        ? (findCompendiumClass(targetActorClass, compendium.classes) ?? null)
        : (compendium.classes.find((entry) => entry.id === guided.guidedSetup.classId) ?? null);

  const currentClassLevel = targetActorClass?.level ?? 0;
  const nextClassLevel = guided.guidedClassId === NEW_GUIDED_CLASS_ID ? 1 : currentClassLevel + 1;
  const currentTotalLevel = draft.classes.reduce((acc, c) => acc + (c.level || 0), 0) || 1;
  const nextTotalLevel = isLevelUp ? currentTotalLevel + 1 : 1;

  const classProgression = targetClassEntry
    ? (findBaseClassProgression(targetClassEntry.id) ?? findBaseClassProgression(targetClassEntry.name))
    : null;
  const rawClassFeatures = isLevelUp
    ? (classProgression?.levels[nextClassLevel]?.features ?? [])
    : (classProgression?.levels[1]?.features ?? []);
  const newClassFeatures = rawClassFeatures.filter((featName) => !isSubclassPlaceholder(featName));

  const effectiveSubclassId = guided.guidedSetup.subclassId || targetActorClass?.subclassId || "";
  const subclassProgDef = classProgression?.subclasses.find(
    (s) => s.id.toLowerCase() === effectiveSubclassId.toLowerCase() || s.name.toLowerCase() === effectiveSubclassId.toLowerCase()
  );
  const targetSubclassEntry = targetClassEntry?.subclasses.find(
    (s) => s.id.toLowerCase() === effectiveSubclassId.toLowerCase() || s.name.toLowerCase() === effectiveSubclassId.toLowerCase()
  );

  const isNewSubclassChoice = !targetActorClass?.subclassId && Boolean(effectiveSubclassId);
  const newSubclassFeatures = isLevelUp
    ? (() => {
        if (!effectiveSubclassId) return [];
        const features: string[] = [];
        const minLevel = isNewSubclassChoice ? 1 : nextClassLevel;
        for (let lvl = minLevel; lvl <= nextClassLevel; lvl++) {
          const fromProg = subclassProgDef?.levels[lvl]?.features ?? [];
          const fromComp = targetSubclassEntry?.features.filter((f) => f.level === lvl).map((f) => f.name) ?? [];
          for (const feat of [...fromProg, ...fromComp]) {
            if (!features.includes(feat) && !isSubclassPlaceholder(feat)) {
              features.push(feat);
            }
          }
        }
        return features;
      })()
    : [];

  const newSubclassSpells = isLevelUp
    ? (() => {
        if (!effectiveSubclassId || !subclassProgDef) return [];
        const spells: string[] = [];
        const minLevel = isNewSubclassChoice ? 1 : nextClassLevel;
        for (let lvl = minLevel; lvl <= nextClassLevel; lvl++) {
          const levelSpells = subclassProgDef.levels[lvl]?.alwaysPreparedSpells ?? [];
          for (const spell of levelSpells) {
            if (!spells.includes(spell)) {
              spells.push(spell);
            }
          }
        }
        return spells;
      })()
    : [];

  const hpGain =
    guided.guidedSetup.hpMode === "roll" && typeof guided.guidedSetup.rolledHp === "number" && guided.guidedSetup.rolledHp > 0
      ? Math.max(1, guided.guidedSetup.rolledHp + guided.guidedChoiceSpec.conModifier)
      : guided.guidedChoiceSpec.averageHpGain;

  const modifiedAbilities: { key: AbilityKey; label: string; before: number; after: number; beforeMod: string; afterMod: string }[] = [];
  if (isLevelUp && guided.guidedChoiceSpec.abilityImprovementCount > 0 && guided.guidedSetup.asiMode === "ability") {
    if (guided.guidedSetup.asiAbilityMode === "+2") {
      const key = guided.guidedSetup.asiAbilityChoices[0] ?? "str";
      const before = draft.abilities[key] ?? 10;
      const after = before + 2;
      const label = abilityOrder.find((a) => a.key === key)?.label ?? key.toUpperCase();
      modifiedAbilities.push({
        key,
        label,
        before,
        after,
        beforeMod: formatModifier(abilityModifier(before)),
        afterMod: formatModifier(abilityModifier(after))
      });
    } else {
      const key1 = guided.guidedSetup.asiAbilityChoices[0] ?? "str";
      const key2 = guided.guidedSetup.asiAbilityChoices[1] ?? "dex";
      const keys = key1 === key2 ? [key1] : [key1, key2];
      for (const key of keys) {
        const bonus = key1 === key2 ? 2 : 1;
        const before = draft.abilities[key] ?? 10;
        const after = before + bonus;
        const label = abilityOrder.find((a) => a.key === key)?.label ?? key.toUpperCase();
        modifiedAbilities.push({
          key,
          label,
          before,
          after,
          beforeMod: formatModifier(abilityModifier(before)),
          afterMod: formatModifier(abilityModifier(after))
        });
      }
    }
  }

  // Derive spell slots, proficiency bonus, and class resources changes
  const beforeSlots = deriveSpellSlots(draft, compendium.classes);
  const previewNextActor = cloneActor(draft);
  if (guided.guidedClassId === NEW_GUIDED_CLASS_ID) {
    if (targetClassEntry) {
      previewNextActor.classes = [
        ...previewNextActor.classes,
        {
          id: "preview-new-class",
          name: targetClassEntry.name,
          level: 1,
          hitDieFaces: targetClassEntry.hitDieFaces || 8,
          usedHitDice: 0,
          compendiumId: targetClassEntry.id,
          source: targetClassEntry.source,
          subclassId: "",
          subclassName: "",
          spellcastingAbility: null
        }
      ];
    }
  } else if (targetActorClass) {
    previewNextActor.classes = previewNextActor.classes.map((c) => (c.id === targetActorClass.id ? { ...c, level: c.level + 1 } : c));
  }
  if (effectiveSubclassId) {
    const targetClassId =
      guided.guidedClassId === NEW_GUIDED_CLASS_ID
        ? (previewNextActor.classes.find((c) => c.compendiumId === targetClassEntry?.id)?.id ?? "")
        : (targetActorClass?.id ?? "");
    const subDef =
      subclassProgDef ??
      targetClassEntry?.subclasses.find(
        (s) => s.id.toLowerCase() === effectiveSubclassId.toLowerCase() || s.name.toLowerCase() === effectiveSubclassId.toLowerCase()
      ) ??
      null;
    previewNextActor.classes = previewNextActor.classes.map((c) =>
      c.id === targetClassId
        ? {
            ...c,
            subclassId: subDef?.id ?? effectiveSubclassId,
            subclassName: subDef?.name ?? effectiveSubclassId,
            subclassSource: subDef?.source ?? targetClassEntry?.source
          }
        : c
    );
  }
  previewNextActor.level = previewNextActor.classes.reduce((sum, c) => sum + (c.level || 0), 0);
  const afterSlots = deriveSpellSlots(previewNextActor, compendium.classes);

  const slotChanges: { level: number; before: number; after: number }[] = [];
  const maxSlotLevel = Math.max(...beforeSlots.map((s) => s.level), ...afterSlots.map((s) => s.level), 0);
  for (let lvl = 1; lvl <= maxSlotLevel; lvl += 1) {
    const before = beforeSlots.find((s) => s.level === lvl)?.total ?? 0;
    const after = afterSlots.find((s) => s.level === lvl)?.total ?? 0;
    if (after !== before) {
      slotChanges.push({ level: lvl, before, after });
    }
  }

  const beforePB = Math.floor((Math.max(1, currentTotalLevel) - 1) / 4) + 2;
  const afterPB = Math.floor((Math.max(1, nextTotalLevel) - 1) / 4) + 2;
  const pbChanged = isLevelUp && afterPB > beforePB;

  const beforeResources = deriveClassResources(draft, compendium.classes);
  const afterResources = deriveClassResources(previewNextActor, compendium.classes);
  const resourceChanges: { name: string; before: number; after: number; description?: string }[] = [];
  for (const afterRes of afterResources) {
    const beforeRes = beforeResources.find((r) => r.id === afterRes.id || r.name === afterRes.name);
    if (!beforeRes) {
      resourceChanges.push({ name: afterRes.name, before: 0, after: afterRes.max, description: afterRes.description });
    } else if (afterRes.max !== beforeRes.max) {
      resourceChanges.push({ name: afterRes.name, before: beforeRes.max, after: afterRes.max, description: afterRes.description });
    }
  }

  const getFeaturePreviewEntry = (featName: string, isSubclass = false): CompendiumReferenceEntry => {
    // 1. Search in target subclass features
    if (isSubclass || effectiveSubclassId) {
      const activeSubclasses = targetClassEntry?.subclasses ?? [];
      for (const sub of activeSubclasses) {
        if (!effectiveSubclassId || sub.id === effectiveSubclassId || sub.name === effectiveSubclassId) {
          const match = sub.features.find((f) => f.name.toLowerCase() === featName.toLowerCase());
          if (match && match.description) {
            return {
              id: `${sub.id}:${match.name}`,
              name: match.name,
              category: `${sub.name} (Subclass Feature)`,
              source: match.source || sub.source || targetClassEntry?.source || "2024 Player's Handbook",
              description: match.description,
              entries: match.description,
              tags: [targetClassEntry?.name ?? "", sub.name, `Level ${match.level}`].filter(Boolean)
            };
          }
        }
      }
    }

    // 2. Search in target class features
    if (targetClassEntry) {
      const match = targetClassEntry.features.find((f) => f.name.toLowerCase() === featName.toLowerCase());
      if (match && match.description) {
        return {
          id: `${targetClassEntry.id}:${match.name}`,
          name: match.name,
          category: `${targetClassEntry.name} Feature`,
          source: match.source || targetClassEntry.source || "2024 Player's Handbook",
          description: match.description,
          entries: match.description,
          tags: [targetClassEntry.name, `Level ${match.level}`].filter(Boolean)
        };
      }
    }

    // 3. Search across all classes and subclasses in compendium
    for (const cls of compendium.classes) {
      const match = cls.features.find((f) => f.name.toLowerCase() === featName.toLowerCase());
      if (match && match.description) {
        return {
          id: `${cls.id}:${match.name}`,
          name: match.name,
          category: `${cls.name} Feature`,
          source: match.source || cls.source || "2024 Player's Handbook",
          description: match.description,
          entries: match.description,
          tags: [cls.name, `Level ${match.level}`].filter(Boolean)
        };
      }
      for (const sub of cls.subclasses) {
        const subMatch = sub.features.find((f) => f.name.toLowerCase() === featName.toLowerCase());
        if (subMatch && subMatch.description) {
          return {
            id: `${sub.id}:${subMatch.name}`,
            name: subMatch.name,
            category: `${sub.name} (${cls.name} Subclass Feature)`,
            source: subMatch.source || sub.source || cls.source || "2024 Player's Handbook",
            description: subMatch.description,
            entries: subMatch.description,
            tags: [cls.name, sub.name, `Level ${subMatch.level}`].filter(Boolean)
          };
        }
      }
    }

    // 4. Search in compendium optionalFeatures
    const fromOptional = compendium.optionalFeatures.find((f) => f.name.toLowerCase() === featName.toLowerCase() || f.id === featName);
    if (fromOptional) {
      return fromOptional;
    }

    // 5. Search in compendium feats
    const fromFeats = compendium.feats.find((f) => f.name.toLowerCase() === featName.toLowerCase() || f.id === featName);
    if (fromFeats) {
      return {
        id: fromFeats.id,
        name: fromFeats.name,
        category: fromFeats.category || "Feat",
        source: fromFeats.source,
        description: [fromFeats.abilityScoreIncrease, fromFeats.description].filter(Boolean).join("\n\n"),
        entries: [fromFeats.abilityScoreIncrease, fromFeats.description].filter(Boolean).join("\n\n"),
        tags: [fromFeats.category || "Feat"]
      };
    }

    return {
      id: featName,
      name: featName,
      category: "Class Feature",
      source: targetClassEntry?.source || "2024 Player's Handbook",
      description: `${targetClassEntry?.name || "Class"} level ${nextClassLevel} feature.`,
      entries: `${targetClassEntry?.name || "Class"} level ${nextClassLevel} feature.`,
      tags: [targetClassEntry?.name || "Class", `Level ${nextClassLevel}`].filter(Boolean)
    };
  };

  const modalContent = (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5 bg-gradient-to-r from-amber-500/[0.08] to-transparent">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-400">Progression Guide</p>
          </div>
          <h3 className="mt-1 font-serif text-2xl font-bold text-amber-50">
            {guided.guidedFlowMode === "setup" ? "Level 1 Character Setup" : "Level Up Guide"}
          </h3>
          <p className="mt-1 text-xs text-zinc-400">
            {guided.guidedFlowMode === "setup"
              ? "Choose your starting species, background, class, and build choices. All metadata and features will be configured automatically."
              : "Advance a class level, determine hit points gain, and choose newly unlocked features or spells."}
          </p>
        </div>
        <SheetButton variant="ghost" size="sm" icon={<X size={16} />} onClick={onCancel ?? guided.closeGuidedFlow}>
          Close
        </SheetButton>
      </div>
      {guided.guideError ? (
        <div className="mx-6 mt-4 rounded-md border border-rose-500/40 bg-rose-950/30 px-3.5 py-2.5 text-xs font-medium text-rose-200">
          {guided.guideError}
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
        <div className="space-y-4">
          {guided.guidedFlowMode === "setup" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Species">
                  <div className="space-y-2">
                    <select
                      className={inputClass}
                      value={guided.guidedSetup.speciesId}
                      onChange={(event) => {
                        guided.setGuidedSetup((current) => ({
                          ...current,
                          speciesId: event.target.value,
                          speciesSkillChoices: [],
                          speciesOriginFeatId: "",
                          speciesChoiceIds: {}
                        }));
                      }}
                    >
                      <option value="">Select a species</option>
                      {compendium.races.map((entry) => (
                        <option
                          key={entry.id}
                          value={entry.id}
                          disabled={!findSpeciesProgression(entry.id) && !findSpeciesProgression(entry.name)}
                        >
                          {entry.name}
                          {!findSpeciesProgression(entry.id) && !findSpeciesProgression(entry.name) ? " (rules metadata unavailable)" : ""}
                        </option>
                      ))}
                    </select>
                    <HoverPreviewTrigger
                      label="Species Preview"
                      caption={
                        guided.guidedSelectedSpecies
                          ? [
                              guided.guidedSelectedSpecies.category,
                              `${guided.guidedSelectedSpecies.speed} ft`,
                              guided.guidedSelectedSpecies.darkvision > 0
                                ? `Darkvision ${guided.guidedSelectedSpecies.darkvision} ft`
                                : null
                            ]
                              .filter(Boolean)
                              .join(" • ")
                          : undefined
                      }
                      emptyMessage="Select a species to preview it."
                      preview={
                        guided.guidedSelectedSpecies ? (
                          <ReferencePreviewCard
                            title="Species"
                            eyebrow="Species"
                            entry={guided.guidedSelectedSpecies}
                            {...previewLookupProps}
                          />
                        ) : null
                      }
                    />
                  </div>
                </Field>
                <Field label="Background">
                  <div className="space-y-2">
                    <select
                      className={inputClass}
                      value={guided.guidedSetup.backgroundId}
                      onChange={(event) => {
                        guided.setGuidedSetup((current) => ({
                          ...current,
                          backgroundId: event.target.value,
                          backgroundAbilityModeId: "",
                          backgroundSkillChoices: [],
                          originFeatId: "",
                          equipmentChoiceIds: {},
                          abilityChoices: []
                        }));
                      }}
                    >
                      <option value="">Select a background</option>
                      {compendium.backgrounds.map((entry) => (
                        <option
                          key={entry.id}
                          value={entry.id}
                          disabled={!findBackgroundProgression(entry.id) && !findBackgroundProgression(entry.name)}
                        >
                          {entry.name}
                          {!findBackgroundProgression(entry.id) && !findBackgroundProgression(entry.name)
                            ? " (rules metadata unavailable)"
                            : ""}
                        </option>
                      ))}
                    </select>
                    <HoverPreviewTrigger
                      label="Background Preview"
                      caption={
                        guided.guidedSelectedBackground
                          ? [
                              guided.guidedSelectedBackground.category,
                              guided.guidedSelectedBackground.skillProficiencies.length > 0
                                ? `Skills: ${guided.guidedSelectedBackground.skillProficiencies.join(", ")}`
                                : null,
                              guided.guidedSelectedBackground.featIds.length > 0
                                ? `Feats: ${guided.guidedSelectedBackground.featIds.join(", ")}`
                                : null
                            ]
                              .filter(Boolean)
                              .join(" • ")
                          : undefined
                      }
                      emptyMessage="Select a background to preview it."
                      preview={
                        guided.guidedSelectedBackground ? (
                          <ReferencePreviewCard
                            title="Background"
                            eyebrow="Background"
                            entry={guided.guidedSelectedBackground}
                            {...previewLookupProps}
                          />
                        ) : null
                      }
                    />
                  </div>
                </Field>
                <Field label="Class">
                  <div className="space-y-2">
                    <select
                      className={inputClass}
                      value={guided.guidedSetup.classId}
                      onChange={(event) =>
                        guided.setGuidedSetup((current) => ({
                          ...current,
                          classId: event.target.value,
                          classSkillChoices: [],
                          expertiseSkillChoices: [],
                          subclassId: ""
                        }))
                      }
                    >
                      <option value="">Select a class</option>
                      {compendium.classes
                        .filter((entry) => findBaseClassProgression(entry.id) || findBaseClassProgression(entry.name))
                        .map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                    </select>
                    <HoverPreviewTrigger
                      label="Class Preview"
                      caption={
                        guided.guidedSelectedClass
                          ? [
                              `d${guided.guidedSelectedClass.hitDieFaces} Hit Die`,
                              guided.guidedSelectedClass.primaryAbilities.length > 0
                                ? `Primary: ${guided.guidedSelectedClass.primaryAbilities.join(" or ")}`
                                : null,
                              guided.guidedSelectedClass.savingThrowProficiencies.length > 0
                                ? `Saves: ${guided.guidedSelectedClass.savingThrowProficiencies.join(", ")}`
                                : null
                            ]
                              .filter(Boolean)
                              .join(" • ")
                          : undefined
                      }
                      emptyMessage="Select a class to preview it."
                      preview={
                        guided.guidedSelectedClass ? <ClassPreviewCard entry={guided.guidedSelectedClass} {...previewLookupProps} /> : null
                      }
                    />
                  </div>
                </Field>
              </div>

              {guided.guidedSpeciesChoiceGroups.length > 0 ? (
                <div className="space-y-3 border border-white/8 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">Species Choices</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {guided.guidedSpeciesChoiceGroups.map((group) => {
                      const selectedOption =
                        group.options.find((option) => option.id === guided.guidedSetup.speciesChoiceIds[group.id]) ?? null;

                      return (
                        <Field key={group.id} label={group.label} hint={group.hint}>
                          <div className="space-y-2">
                            <select
                              className={inputClass}
                              value={guided.guidedSetup.speciesChoiceIds[group.id] ?? ""}
                              onChange={(event) =>
                                guided.setGuidedSetup((current) => ({
                                  ...current,
                                  speciesChoiceIds: {
                                    ...current.speciesChoiceIds,
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
                            {selectedOption?.description ? (
                              <p className="text-xs leading-5 text-zinc-400">{selectedOption.description}</p>
                            ) : null}
                          </div>
                        </Field>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="space-y-3 border border-white/8 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">Base Ability Scores</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      Set the starting scores here. Background ability choices are added on top of these values.
                    </p>
                  </div>
                  {guided.guidedAbilityChoiceSlots.length > 0 ? (
                    <p className="max-w-[16rem] text-right text-xs text-zinc-500">
                      Background spread: {guided.guidedAbilityChoiceMode?.label ?? "None"}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {abilityOrder.map((ability) => {
                    const baseScore = guided.guidedSetup.baseAbilities[ability.key];
                    const guidedBonus = guided.guidedAbilityChoiceSlots.reduce(
                      (sum, slot, index) => sum + (guided.guidedSetup.abilityChoices[index] === ability.key ? slot.amount : 0),
                      0
                    );
                    const finalScore = baseScore + guidedBonus;

                    return (
                      <div key={ability.key} className="space-y-3 border border-amber-900/20 bg-zinc-900/60 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium tracking-[0.18em] text-amber-50">{ability.label}</p>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                              Final {finalScore} ({formatModifier(abilityModifier(finalScore))})
                            </p>
                          </div>
                          {guidedBonus > 0 ? <p className="text-xs text-amber-300/80">+{guidedBonus} background</p> : null}
                        </div>
                        <Field label="Base Score">
                          <NumericInput
                            className={inputClass}
                            min={1}
                            max={20}
                            value={baseScore}
                            emptyValue={10}
                            onValueChange={(value) =>
                              guided.setGuidedSetup((current) => ({
                                ...current,
                                baseAbilities: {
                                  ...current.baseAbilities,
                                  [ability.key]: value ?? 10
                                }
                              }))
                            }
                          />
                        </Field>
                      </div>
                    );
                  })}
                </div>
              </div>

              {guided.guidedSpeciesSkillChoiceConfig.count > 0 || guided.guidedSpeciesOriginFeatOptions.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {guided.guidedSpeciesSkillChoiceConfig.count > 0
                    ? Array.from({ length: guided.guidedSpeciesSkillChoiceConfig.count }, (_, index) => (
                        <Field key={`species-skill-${index}`} label={`Species Skill ${index + 1}`}>
                          <select
                            className={inputClass}
                            value={guided.guidedSetup.speciesSkillChoices[index] ?? ""}
                            onChange={(event) =>
                              guided.setGuidedSetup((current) => ({
                                ...current,
                                speciesSkillChoices: replaceGuideSelection(current.speciesSkillChoices, index, event.target.value)
                              }))
                            }
                          >
                            {guided.guidedSpeciesSkillChoiceConfig.options.map((entry) => (
                              <option
                                key={entry.id}
                                value={entry.name}
                                disabled={guideOptionDisabled(guided.guidedSetup.speciesSkillChoices, index, entry.name)}
                              >
                                {entry.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ))
                    : null}
                  {guided.guidedSpeciesOriginFeatOptions.length > 0 ? (
                    <Field label="Species Feat Choice">
                      <select
                        className={inputClass}
                        value={guided.guidedSetup.speciesOriginFeatId}
                        onChange={(event) => guided.setGuidedSetup((current) => ({ ...current, speciesOriginFeatId: event.target.value }))}
                      >
                        {guided.guidedSpeciesOriginFeatOptions.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : null}
                </div>
              ) : null}

              {guided.guidedChoiceSpec.sizeOptions.length > 1 ? (
                <Field label="Species Size">
                  <select
                    className={inputClass}
                    value={guided.guidedSetup.speciesSizeChoice || guided.guidedChoiceSpec.sizeOptions[0]}
                    onChange={(event) =>
                      guided.setGuidedSetup((current) => ({
                        ...current,
                        speciesSizeChoice: event.target.value as "Medium" | "Small"
                      }))
                    }
                  >
                    {guided.guidedChoiceSpec.sizeOptions.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}

              <div className="space-y-3 border border-white/8 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">Languages</p>
                <p className="text-xs text-zinc-400">Common + choose up to 2 additional Standard Languages.</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {Array.from({ length: 2 }, (_, index) => (
                    <Field key={`lang-${index}`} label={`Language Choice ${index + 1}`}>
                      <select
                        className={inputClass}
                        value={guided.guidedSetup.languageChoices[index + 1] ?? ""}
                        onChange={(event) =>
                          guided.setGuidedSetup((current) => {
                            const nextLangs = [...(current.languageChoices.length > 0 ? current.languageChoices : ["Common"])];
                            nextLangs[index + 1] = event.target.value;
                            return {
                              ...current,
                              languageChoices: nextLangs.filter(Boolean)
                            };
                          })
                        }
                      >
                        <option value="">Choose a language</option>
                        {guided.guidedChoiceSpec.languageOptions
                          .filter((lang) => lang !== "Common")
                          .map((lang) => (
                            <option key={lang} value={lang}>
                              {lang}
                            </option>
                          ))}
                      </select>
                    </Field>
                  ))}
                </div>
              </div>

              {guided.guidedBackgroundSkillChoiceConfig.count > 0 ? (
                <div className="space-y-3 border border-white/8 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">Background Skill Choices</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {Array.from({ length: guided.guidedBackgroundSkillChoiceConfig.count }, (_, index) => (
                      <Field key={`background-skill-${index}`} label={`Background Skill ${index + 1}`}>
                        <select
                          className={inputClass}
                          value={guided.guidedSetup.backgroundSkillChoices[index] ?? ""}
                          onChange={(event) =>
                            guided.setGuidedSetup((current) => ({
                              ...current,
                              backgroundSkillChoices: replaceGuideSelection(current.backgroundSkillChoices, index, event.target.value)
                            }))
                          }
                        >
                          {guided.guidedBackgroundSkillChoiceConfig.options.map((entry) => (
                            <option
                              key={entry.id}
                              value={entry.name}
                              disabled={guideOptionDisabled(guided.guidedSetup.backgroundSkillChoices, index, entry.name)}
                            >
                              {entry.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ))}
                  </div>
                </div>
              ) : null}

              {guided.guidedAbilityChoiceConfig.modes.length > 0 ? (
                <div className="space-y-3 border border-white/8 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">Ability Choices</p>
                  {guided.guidedAbilityChoiceConfig.modes.length > 1 ? (
                    <Field label="Background Ability Spread">
                      <select
                        className={inputClass}
                        value={guided.guidedSetup.backgroundAbilityModeId}
                        onChange={(event) =>
                          guided.setGuidedSetup((current) => ({
                            ...current,
                            backgroundAbilityModeId: event.target.value,
                            abilityChoices: []
                          }))
                        }
                      >
                        {guided.guidedAbilityChoiceConfig.modes.map((mode) => (
                          <option key={mode.id} value={mode.id}>
                            {mode.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : null}
                  <div className="grid gap-3 md:grid-cols-2">
                    {guided.guidedAbilityChoiceSlots.map((slot, index) => (
                      <Field key={slot.id} label={`+${slot.amount} Ability ${index + 1}`}>
                        <select
                          className={inputClass}
                          value={guided.guidedSetup.abilityChoices[index] ?? ""}
                          onChange={(event) =>
                            guided.setGuidedSetup((current) => ({
                              ...current,
                              abilityChoices: replaceGuideSelection(current.abilityChoices, index, event.target.value as AbilityKey)
                            }))
                          }
                        >
                          <option value="">Select an ability</option>
                          {slot.abilities.map((abilityKey) => (
                            <option
                              key={abilityKey}
                              value={abilityKey}
                              disabled={guideOptionDisabled(guided.guidedSetup.abilityChoices, index, abilityKey)}
                            >
                              {abilityKey.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ))}
                  </div>
                </div>
              ) : null}

              {guided.guidedOriginFeatOptions.length > 0 ? (
                <Field label="Origin Feat">
                  <select
                    className={inputClass}
                    value={guided.guidedSetup.originFeatId}
                    onChange={(event) => guided.setGuidedSetup((current) => ({ ...current, originFeatId: event.target.value }))}
                  >
                    {guided.guidedOriginFeatOptions.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}

              {guided.guidedEquipmentGroups.length > 0 ? (
                <div className="space-y-3 border border-white/8 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">Starting Equipment</p>
                  {guided.guidedEquipmentGroups.map((group) => (
                    <Field key={group.id} label={group.label}>
                      <select
                        className={inputClass}
                        value={guided.guidedSetup.equipmentChoiceIds[group.id] ?? ""}
                        onChange={(event) =>
                          guided.setGuidedSetup((current) => ({
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

              {guided.guidedClassSkillChoiceConfig.count > 0 ? (
                <div className="space-y-3 border border-white/8 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">Class Skill Choices</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {Array.from({ length: guided.guidedClassSkillChoiceConfig.count }, (_, index) => (
                      <Field key={`class-skill-${index}`} label={`Class Skill ${index + 1}`}>
                        <select
                          className={inputClass}
                          value={guided.guidedSetup.classSkillChoices[index] ?? ""}
                          onChange={(event) =>
                            guided.setGuidedSetup((current) => ({
                              ...current,
                              classSkillChoices: replaceGuideSelection(current.classSkillChoices, index, event.target.value)
                            }))
                          }
                        >
                          {guided.guidedClassSkillChoiceConfig.options.map((entry) => (
                            <option
                              key={entry.id}
                              value={entry.name}
                              disabled={guideOptionDisabled(guided.guidedSetup.classSkillChoices, index, entry.name)}
                            >
                              {entry.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Level Up Class">
                  <select
                    className={inputClass}
                    value={guided.guidedClassId}
                    onChange={(event) => guided.setGuidedClassId(event.target.value)}
                  >
                    <option value={NEW_GUIDED_CLASS_ID}>Add a new class</option>
                    {draft.classes.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name} (Level {entry.level} ➔ {entry.level + 1})
                      </option>
                    ))}
                  </select>
                </Field>
                {guided.guidedClassId === NEW_GUIDED_CLASS_ID ? (
                  <Field label="New Class">
                    <select
                      className={inputClass}
                      value={guided.guidedSetup.classId}
                      onChange={(event) => guided.setGuidedSetup((current) => ({ ...current, classId: event.target.value }))}
                    >
                      <option value="">Select a class</option>
                      {compendium.classes
                        .filter((entry) => findBaseClassProgression(entry.id) || findBaseClassProgression(entry.name))
                        .map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                ) : null}
                {(() => {
                  const targetActorClass =
                    guided.guidedClassId === NEW_GUIDED_CLASS_ID
                      ? null
                      : (draft.classes.find((entry) => entry.id === guided.guidedClassId) ?? null);
                  const targetClassEntry =
                    guided.guidedClassId === NEW_GUIDED_CLASS_ID
                      ? (compendium.classes.find((entry) => entry.id === guided.guidedSetup.classId) ?? null)
                      : targetActorClass
                        ? (findCompendiumClass(targetActorClass, compendium.classes) ?? null)
                        : null;
                  const nextLevel = guided.guidedClassId === NEW_GUIDED_CLASS_ID ? 1 : (targetActorClass?.level ?? 0) + 1;
                  const subclassLevelReq = targetClassEntry?.subclassLevel ?? 3;

                  if (!targetClassEntry) return null;

                  const availableSubclasses = (() => {
                    const fromCompendium = targetClassEntry.subclasses ?? [];
                    const fromProgression = findSubclassesForClass(targetClassEntry.name).map((sub) => ({
                      id: sub.id,
                      name: sub.name,
                      shortName: sub.name,
                      source: sub.source,
                      className: targetClassEntry.name,
                      classSource: targetClassEntry.source,
                      description: "",
                      features: []
                    }));
                    const combined = [...fromCompendium];
                    for (const sub of fromProgression) {
                      if (!combined.some((existing) => existing.id === sub.id || existing.name.toLowerCase() === sub.name.toLowerCase())) {
                        combined.push(sub);
                      }
                    }
                    return combined;
                  })();

                  if (availableSubclasses.length === 0 || nextLevel < subclassLevelReq) {
                    return null;
                  }

                  const selectedSubclassId = guided.guidedSetup.subclassId || targetActorClass?.subclassId || "";
                  const selectedSubclass = availableSubclasses.find(
                    (s) =>
                      s.id.toLowerCase() === selectedSubclassId.toLowerCase() || s.name.toLowerCase() === selectedSubclassId.toLowerCase()
                  );

                  return (
                    <Field label={`Subclass (Level ${subclassLevelReq}+)`}>
                      <div className="space-y-2">
                        <select
                          className={inputClass}
                          value={selectedSubclassId}
                          onChange={(event) => guided.setGuidedSetup((current) => ({ ...current, subclassId: event.target.value }))}
                        >
                          <option value="">Select a subclass</option>
                          {availableSubclasses.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name} ({entry.source || "2024 PHB"})
                            </option>
                          ))}
                        </select>
                        {(() => {
                          if (!selectedSubclass) return null;
                          const compDef = targetClassEntry?.subclasses.find(
                            (s) =>
                              s.id.toLowerCase() === selectedSubclass.id.toLowerCase() ||
                              s.name.toLowerCase() === selectedSubclass.name.toLowerCase()
                          );
                          const progDef = findSubclassesForClass(targetClassEntry.name).find(
                            (s) =>
                              s.id.toLowerCase() === selectedSubclass.id.toLowerCase() ||
                              s.name.toLowerCase() === selectedSubclass.name.toLowerCase()
                          );

                          const combinedFeatures = [...(compDef?.features ?? [])];
                          if (progDef?.levels) {
                            for (const [lvlKey, lvlConfig] of Object.entries(progDef.levels)) {
                              const lvl = Number(lvlKey);
                              for (const featName of lvlConfig.features ?? []) {
                                if (
                                  !combinedFeatures.some((f) => f.name.toLowerCase() === featName.toLowerCase()) &&
                                  !isSubclassPlaceholder(featName)
                                ) {
                                  const previewEntry = getFeaturePreviewEntry(featName, true);
                                  combinedFeatures.push({
                                    level: lvl,
                                    name: featName,
                                    description: previewEntry.description,
                                    source: previewEntry.source || targetClassEntry.source,
                                    reference: ""
                                  });
                                }
                              }
                            }
                          }
                          combinedFeatures.sort((a, b) => a.level - b.level);

                          const fullSubclassModel = {
                            id: selectedSubclass.id,
                            name: selectedSubclass.name,
                            source: selectedSubclass.source || compDef?.source || targetClassEntry.source,
                            className: targetClassEntry.name,
                            classSource: targetClassEntry.source,
                            description: compDef?.description || selectedSubclass.description || "",
                            features: combinedFeatures,
                            levels: progDef?.levels
                          };

                          return (
                            <HoverPreviewTrigger
                              label="Subclass Details"
                              caption={fullSubclassModel.name}
                              emptyMessage=""
                              preview={
                                <SubclassPreviewCard
                                  subclass={fullSubclassModel}
                                  className={targetClassEntry.name}
                                  {...previewLookupProps}
                                />
                              }
                            />
                          );
                        })()}
                        {targetActorClass?.subclassName ? (
                          <p className="text-xs text-zinc-400">
                            Current on Sheet: <span className="text-amber-300 font-medium">{targetActorClass.subclassName}</span>
                          </p>
                        ) : null}
                      </div>
                    </Field>
                  );
                })()}
              </div>

              {/* Hit Points on Level Up */}
              <div className="space-y-3 rounded-lg border border-amber-500/20 bg-slate-900/60 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Hit Points Progression</p>
                  <span className="text-xs text-zinc-300 font-medium">
                    Hit Die: <span className="font-bold text-amber-300">d{guided.guidedChoiceSpec.hitDieFaces}</span> • CON Mod:{" "}
                    <span className="font-bold text-amber-300">{formatModifier(guided.guidedChoiceSpec.conModifier)}</span>
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    className={`flex flex-col items-start gap-1 rounded-md border p-3.5 text-left transition ${
                      guided.guidedSetup.hpMode === "average"
                        ? "border-amber-500 bg-amber-500/15 text-amber-50 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                        : "border-white/10 bg-slate-950/60 text-zinc-300 hover:border-white/20 hover:bg-slate-900"
                    }`}
                    onClick={() => guided.setGuidedSetup((current) => ({ ...current, hpMode: "average" }))}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-300">Fixed Average</span>
                    <span className="text-sm font-semibold">+{guided.guidedChoiceSpec.averageHpGain} HP</span>
                    <span className="text-[11px] text-zinc-400">
                      ({Math.floor(guided.guidedChoiceSpec.hitDieFaces / 2) + 1} die avg +{" "}
                      {formatModifier(guided.guidedChoiceSpec.conModifier)} CON)
                    </span>
                  </button>

                  <div
                    className={`flex flex-col justify-between rounded-md border p-3.5 transition ${
                      guided.guidedSetup.hpMode === "roll"
                        ? "border-amber-500 bg-amber-500/15 text-amber-50 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                        : "border-white/10 bg-slate-950/60 text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-300">Roll Hit Die</span>
                      <SheetButton
                        variant="primary"
                        size="sm"
                        icon={<Dice6 size={14} />}
                        onClick={() => {
                          const roll = Math.floor(Math.random() * (guided.guidedChoiceSpec.hitDieFaces || 8)) + 1;
                          guided.setGuidedSetup((current) => ({
                            ...current,
                            hpMode: "roll",
                            rolledHp: roll
                          }));
                        }}
                      >
                        Roll 1d{guided.guidedChoiceSpec.hitDieFaces}
                      </SheetButton>
                    </div>
                    <span className="mt-2 text-xs font-semibold text-zinc-200">
                      {guided.guidedSetup.rolledHp !== null
                        ? `Rolled ${guided.guidedSetup.rolledHp} + ${formatModifier(guided.guidedChoiceSpec.conModifier)} CON = +${Math.max(1, guided.guidedSetup.rolledHp + guided.guidedChoiceSpec.conModifier)} HP`
                        : "Click Roll to roll hit die"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {guided.guidedChoiceSpec.weaponMasteryCount > 0 ||
          guided.guidedChoiceSpec.classFeatCount > 0 ||
          guided.guidedChoiceSpec.optionalFeatureCount > 0 ||
          guided.guidedChoiceSpec.cantripCount > 0 ||
          guided.guidedChoiceSpec.knownSpellCount > 0 ||
          guided.guidedChoiceSpec.spellbookCount > 0 ||
          guided.guidedChoiceSpec.preparedSpellCount > 0 ||
          guided.guidedChoiceSpec.expertiseCount > 0 ||
          guided.guidedChoiceSpec.abilityImprovementCount > 0 ? (
            <div className="space-y-4 border border-white/8 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">Class Choices</p>

              {guided.guidedChoiceSpec.weaponMasteryCount > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-300">
                    Weapon Masteries ({guided.guidedChoiceSpec.weaponMasteryCount} choice
                    {guided.guidedChoiceSpec.weaponMasteryCount === 1 ? "" : "s"}):
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {Array.from({ length: guided.guidedChoiceSpec.weaponMasteryCount }, (_, index) => (
                      <Field key={`mastery-${index}`} label={`Weapon Mastery ${index + 1}`}>
                        <select
                          className={inputClass}
                          value={guided.guidedSetup.weaponMasteryChoices[index] ?? ""}
                          onChange={(event) =>
                            guided.setGuidedSetup((current) => ({
                              ...current,
                              weaponMasteryChoices: replaceGuideSelection(current.weaponMasteryChoices, index, event.target.value)
                            }))
                          }
                        >
                          <option value="">Select a weapon mastery</option>
                          {guided.guidedChoiceSpec.weaponMasteryOptions.map((opt) => (
                            <option
                              key={opt}
                              value={opt}
                              disabled={guideOptionDisabled(guided.guidedSetup.weaponMasteryChoices, index, opt)}
                            >
                              {opt}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ))}
                  </div>
                </div>
              ) : null}

              {guided.guidedChoiceSpec.classFeatCount > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {Array.from({ length: guided.guidedChoiceSpec.classFeatCount }, (_, index) => (
                    <Field key={`class-feat-${index}`} label={`Class Feat ${index + 1}`}>
                      <select
                        className={inputClass}
                        value={guided.guidedSetup.classFeatIds[index] ?? ""}
                        onChange={(event) =>
                          guided.setGuidedSetup((current) => ({
                            ...current,
                            classFeatIds: replaceGuideSelection(current.classFeatIds, index, event.target.value)
                          }))
                        }
                      >
                        {guided.guidedChoiceSpec.classFeatOptions.map((entry) => (
                          <option
                            key={entry.id}
                            value={entry.id}
                            disabled={guideOptionDisabled(guided.guidedSetup.classFeatIds, index, entry.id)}
                          >
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ))}
                </div>
              ) : null}

              {guided.guidedChoiceSpec.optionalFeatureCount > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {Array.from({ length: guided.guidedChoiceSpec.optionalFeatureCount }, (_, index) => (
                    <Field key={`optional-feature-${index}`} label={`Optional Feature ${index + 1}`}>
                      <select
                        className={inputClass}
                        value={guided.guidedSetup.optionalFeatureIds[index] ?? ""}
                        onChange={(event) =>
                          guided.setGuidedSetup((current) => ({
                            ...current,
                            optionalFeatureIds: replaceGuideSelection(current.optionalFeatureIds, index, event.target.value)
                          }))
                        }
                      >
                        {guided.guidedChoiceSpec.optionalFeatureOptions.map((entry) => (
                          <option
                            key={entry.id}
                            value={entry.id}
                            disabled={guideOptionDisabled(guided.guidedSetup.optionalFeatureIds, index, entry.id)}
                          >
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ))}
                </div>
              ) : null}

              {guided.guidedChoiceSpec.cantripCount > 0 ? (
                <div className="space-y-3 border border-white/8 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-zinc-100">Cantrips</p>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                        {guided.guidedSetup.cantripIds.filter(Boolean).length}/{guided.guidedChoiceSpec.cantripCount} selected
                      </p>
                    </div>
                    <button type="button" className={secondaryButtonClass} onClick={() => onOpenSpellSelection("guideCantrips")}>
                      <Plus size={14} />
                      Select
                    </button>
                  </div>
                  <DetailCollection
                    entries={collectSpellRows(
                      findSpellNamesByIds(guided.guidedSetup.cantripIds, guided.guidedChoiceSpec.cantripOptions),
                      [],
                      guided.guidedChoiceSpec.cantripOptions,
                      guided.guidedChoiceSpec.cantripCount
                    )}
                    emptyMessage="No cantrips selected yet."
                    renderText={renderRulesText}
                  />
                </div>
              ) : null}

              {guided.guidedChoiceSpec.knownSpellCount > 0 ? (
                <div className="space-y-3 border border-white/8 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-zinc-100">{guided.guidedChoiceSpec.knownSpellLabel ?? "Class Spells"}</p>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                        {guided.guidedSetup.knownSpellIds.filter(Boolean).length}/{guided.guidedChoiceSpec.knownSpellCount} selected
                      </p>
                    </div>
                    <button type="button" className={secondaryButtonClass} onClick={() => onOpenSpellSelection("guideKnown")}>
                      <Plus size={14} />
                      Select
                    </button>
                  </div>
                  <DetailCollection
                    entries={collectSpellRows(
                      findSpellNamesByIds(guided.guidedSetup.knownSpellIds, guided.guidedChoiceSpec.knownSpellOptions),
                      [],
                      guided.guidedChoiceSpec.knownSpellOptions,
                      guided.guidedChoiceSpec.knownSpellCount
                    )}
                    emptyMessage="No guide spells selected yet."
                    renderText={renderRulesText}
                  />
                </div>
              ) : null}

              {guided.guidedChoiceSpec.spellbookCount > 0 ? (
                <div className="space-y-3 border border-white/8 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-zinc-100">Spellbook Spells</p>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                        {guided.guidedSetup.spellbookSpellIds.filter(Boolean).length}/{guided.guidedChoiceSpec.spellbookCount} selected
                      </p>
                    </div>
                    <button type="button" className={secondaryButtonClass} onClick={() => onOpenSpellSelection("guideSpellbook")}>
                      <Plus size={14} />
                      Select
                    </button>
                  </div>
                  <DetailCollection
                    entries={collectSpellRows(
                      findSpellNamesByIds(guided.guidedSetup.spellbookSpellIds, guided.guidedChoiceSpec.spellbookOptions),
                      [],
                      guided.guidedChoiceSpec.spellbookOptions,
                      guided.guidedChoiceSpec.spellbookCount
                    )}
                    emptyMessage="No guide spellbook spells selected yet."
                    renderText={renderRulesText}
                  />
                </div>
              ) : null}

              {guided.guidedChoiceSpec.preparedSpellCount > 0 ? (
                <div className="space-y-3 border border-white/8 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-zinc-100">Prepared Spells</p>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                        {guided.guidedSetup.preparedSpellIds.filter(Boolean).length}/{guided.guidedChoiceSpec.preparedSpellCount} selected
                      </p>
                    </div>
                    <button type="button" className={secondaryButtonClass} onClick={() => onOpenSpellSelection("guidePrepared")}>
                      <Plus size={14} />
                      Select
                    </button>
                  </div>
                  <DetailCollection
                    entries={collectSpellRows(
                      findSpellNamesByIds(guided.guidedSetup.preparedSpellIds, guided.guidedChoiceSpec.preparedSpellOptions),
                      findSpellNamesByIds(guided.guidedSetup.preparedSpellIds, guided.guidedChoiceSpec.preparedSpellOptions),
                      guided.guidedChoiceSpec.preparedSpellOptions,
                      guided.guidedChoiceSpec.preparedSpellCount
                    )}
                    emptyMessage="No prepared spells selected yet."
                    renderText={renderRulesText}
                  />
                </div>
              ) : null}

              {guided.guidedChoiceSpec.expertiseCount > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {Array.from({ length: guided.guidedChoiceSpec.expertiseCount }, (_, index) => (
                    <Field key={`expertise-${index}`} label={`Expertise ${index + 1}`}>
                      <select
                        className={inputClass}
                        value={guided.guidedSetup.expertiseSkillChoices[index] ?? ""}
                        onChange={(event) =>
                          guided.setGuidedSetup((current) => ({
                            ...current,
                            expertiseSkillChoices: replaceGuideSelection(current.expertiseSkillChoices, index, event.target.value)
                          }))
                        }
                      >
                        {guided.guidedChoiceSpec.expertiseSkillOptions.map((entry) => (
                          <option
                            key={entry.id}
                            value={entry.name}
                            disabled={guideOptionDisabled(guided.guidedSetup.expertiseSkillChoices, index, entry.name)}
                          >
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ))}
                </div>
              ) : null}

              {guided.guidedChoiceSpec.classChoiceGroups && guided.guidedChoiceSpec.classChoiceGroups.length > 0 ? (
                <div className="space-y-4">
                  {guided.guidedChoiceSpec.classChoiceGroups
                    .filter(
                      (group: CompendiumChoiceGroup) =>
                        !group.parentOption ||
                        (guided.guidedSetup.classChoiceIds?.[group.parentOption.groupId] ?? []).includes(group.parentOption.optionId)
                    )
                    .map((group: CompendiumChoiceGroup) => {
                      const selectedIds = guided.guidedSetup.classChoiceIds?.[group.id] ?? [];
                      return (
                        <GuidedChoiceGroupField
                          key={group.id}
                          group={group}
                          selectedIds={selectedIds}
                          renderOptionPreview={renderChoiceOptionPreview}
                          onChooseSpells={() =>
                            onOpenSpellSelection({
                              kind: "guidedChoice",
                              owner: "class",
                              ownerId: guided.guidedSetup.classId,
                              groupId: group.id
                            })
                          }
                          onChange={(optionIds) =>
                            guided.setGuidedSetup((current) => {
                              const nextClassChoiceIds = { ...current.classChoiceIds, [group.id]: optionIds };
                              if (guided.guidedChoiceSpec.classChoiceGroups) {
                                guided.guidedChoiceSpec.classChoiceGroups.forEach((childGroup) => {
                                  if (
                                    childGroup.parentOption?.groupId === group.id &&
                                    !optionIds.includes(childGroup.parentOption.optionId)
                                  ) {
                                    delete nextClassChoiceIds[childGroup.id];
                                  }
                                });
                              }
                              return {
                                ...current,
                                classChoiceIds: nextClassChoiceIds
                              };
                            })
                          }
                        />
                      );
                    })}
                </div>
              ) : null}

              {(() => {
                const selectedFeatIds = Array.from(
                  new Set(
                    [
                      ...guided.guidedSetup.classFeatIds,
                      guided.guidedSetup.originFeatId,
                      guided.guidedSetup.speciesOriginFeatId,
                      guided.guidedSetup.asiMode === "feat" ? guided.guidedSetup.asiFeatId : ""
                    ].filter(Boolean)
                  )
                );
                const selectedGroups = selectedFeatIds.flatMap((featId) =>
                  (guided.guidedChoiceSpec.featChoiceGroups?.[featId] ?? []).map((group) => ({ featId, group }))
                );
                if (selectedGroups.length === 0) return null;
                return (
                  <div className="space-y-3 border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">Feat Options & Grants</p>
                    {selectedGroups.map(({ featId, group }) => {
                      const selectedIds = guided.guidedSetup.featChoiceMap?.[featId]?.[group.id] ?? [];
                      return (
                        <GuidedChoiceGroupField
                          key={`${featId}:${group.id}`}
                          group={group}
                          selectedIds={selectedIds}
                          renderOptionPreview={renderChoiceOptionPreview}
                          onChooseSpells={() =>
                            onOpenSpellSelection({ kind: "guidedChoice", owner: "feat", ownerId: featId, groupId: group.id })
                          }
                          onChange={(optionIds) =>
                            guided.setGuidedSetup((current) => ({
                              ...current,
                              featChoiceMap: {
                                ...current.featChoiceMap,
                                [featId]: { ...(current.featChoiceMap?.[featId] ?? {}), [group.id]: optionIds }
                              }
                            }))
                          }
                        />
                      );
                    })}
                  </div>
                );
              })()}

              {guided.guidedChoiceSpec.abilityImprovementCount > 0 ? (
                <div className="space-y-3">
                  <Field label="Ability Score Improvement / Feat">
                    <select
                      className={inputClass}
                      value={guided.guidedSetup.asiMode}
                      onChange={(event) =>
                        guided.setGuidedSetup((current) => ({ ...current, asiMode: event.target.value as "feat" | "ability" }))
                      }
                    >
                      <option value="feat">Select a Feat</option>
                      <option value="ability">Increase Ability Scores</option>
                    </select>
                  </Field>
                  {guided.guidedSetup.asiMode === "feat" ? (
                    <div className="space-y-3">
                      <Field label="Feat">
                        <select
                          className={inputClass}
                          value={guided.guidedSetup.asiFeatId}
                          onChange={(event) => guided.setGuidedSetup((current) => ({ ...current, asiFeatId: event.target.value }))}
                        >
                          <option value="">Select a feat</option>
                          {guided.guidedFeatOptions.map((entry) => (
                            <option
                              key={entry.id}
                              value={entry.id}
                              disabled={!findFeatProgression(entry.id) && !findFeatProgression(entry.name)}
                            >
                              {entry.name} ({entry.category})
                              {!findFeatProgression(entry.id) && !findFeatProgression(entry.name) ? " — rules metadata unavailable" : ""}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={`px-3 py-1 text-xs font-medium uppercase tracking-wider ${
                            guided.guidedSetup.asiAbilityMode === "+2"
                              ? "bg-amber-500 text-zinc-950"
                              : "bg-white/5 text-zinc-300 hover:bg-white/10"
                          }`}
                          onClick={() => guided.setGuidedSetup((current) => ({ ...current, asiAbilityMode: "+2" }))}
                        >
                          +2 to One Score
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-1 text-xs font-medium uppercase tracking-wider ${
                            guided.guidedSetup.asiAbilityMode === "+1+1"
                              ? "bg-amber-500 text-zinc-950"
                              : "bg-white/5 text-zinc-300 hover:bg-white/10"
                          }`}
                          onClick={() => guided.setGuidedSetup((current) => ({ ...current, asiAbilityMode: "+1+1" }))}
                        >
                          +1 to Two Scores
                        </button>
                      </div>
                      {guided.guidedSetup.asiAbilityMode === "+2" ? (
                        <Field label="+2 Ability Score">
                          <select
                            className={inputClass}
                            value={guided.guidedSetup.asiAbilityChoices[0] ?? "str"}
                            onChange={(event) =>
                              guided.setGuidedSetup((current) => ({
                                ...current,
                                asiAbilityChoices: [event.target.value as AbilityKey]
                              }))
                            }
                          >
                            {abilityOrder.map((ability) => (
                              <option key={ability.key} value={ability.key}>
                                +2 {ability.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          <Field label="+1 Ability (First)">
                            <select
                              className={inputClass}
                              value={guided.guidedSetup.asiAbilityChoices[0] ?? "str"}
                              onChange={(event) =>
                                guided.setGuidedSetup((current) => ({
                                  ...current,
                                  asiAbilityChoices: [event.target.value as AbilityKey, current.asiAbilityChoices[1] ?? "dex"]
                                }))
                              }
                            >
                              {abilityOrder.map((ability) => (
                                <option key={ability.key} value={ability.key}>
                                  +1 {ability.label}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="+1 Ability (Second)">
                            <select
                              className={inputClass}
                              value={guided.guidedSetup.asiAbilityChoices[1] ?? "dex"}
                              onChange={(event) =>
                                guided.setGuidedSetup((current) => ({
                                  ...current,
                                  asiAbilityChoices: [current.asiAbilityChoices[0] ?? "str", event.target.value as AbilityKey]
                                }))
                              }
                            >
                              {abilityOrder.map((ability) => (
                                <option key={ability.key} value={ability.key}>
                                  +1 {ability.label}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* PLANNED CHANGES & ABILITIES TO APPLY */}
          <div className="rounded-xl border border-amber-500/30 bg-slate-900/80 p-4 shadow-inner space-y-3">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400" />
                <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
                  {isLevelUp ? "Level Up Changes Summary" : "Initial Character Setup Summary"}
                </h4>
              </div>
              <span className="text-[11px] text-zinc-400">
                {isLevelUp ? `Character Level ${currentTotalLevel} ➔ ${nextTotalLevel}` : `Starting at Level 1`}
              </span>
            </div>

            {/* NUMERICAL & STAT MODIFICATIONS */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-white/5 bg-slate-950/60 p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Class & Level</span>
                <p className="text-sm font-semibold text-zinc-100 mt-0.5">
                  {targetClassEntry ? targetClassEntry.name : "Class"}
                  {isLevelUp ? (
                    <span className="text-xs font-normal text-amber-300 ml-1">
                      (Lvl {currentClassLevel} ➔ {nextClassLevel})
                    </span>
                  ) : (
                    <span className="text-xs font-normal text-amber-300 ml-1">(Lvl 1)</span>
                  )}
                </p>
              </div>

              <div className="rounded-lg border border-white/5 bg-slate-950/60 p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Max Hit Points</span>
                <p className="text-sm font-semibold text-emerald-300 mt-0.5">
                  {isLevelUp ? (
                    <>
                      {draft.hitPoints.max} ➔ {draft.hitPoints.max + hpGain}
                      <span className="text-xs font-normal text-emerald-400 ml-1">(+{hpGain} HP)</span>
                    </>
                  ) : (
                    <>
                      {Math.max(1, (guided.guidedChoiceSpec.hitDieFaces || 8) + guided.guidedChoiceSpec.conModifier)} HP
                      <span className="text-xs font-normal text-zinc-400 ml-1">
                        ({guided.guidedChoiceSpec.hitDieFaces || 8} + {formatModifier(guided.guidedChoiceSpec.conModifier)} CON)
                      </span>
                    </>
                  )}
                </p>
              </div>

              <div className="rounded-lg border border-white/5 bg-slate-950/60 p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Hit Die</span>
                <p className="text-sm font-semibold text-zinc-100 mt-0.5">
                  {isLevelUp ? (
                    <>
                      +1d{guided.guidedChoiceSpec.hitDieFaces || 8}
                      <span className="text-xs font-normal text-zinc-400 ml-1">die added</span>
                    </>
                  ) : (
                    `1d${guided.guidedChoiceSpec.hitDieFaces || 8}`
                  )}
                </p>
              </div>

              {pbChanged ? (
                <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Proficiency Bonus</span>
                  <p className="text-sm font-semibold text-indigo-100 mt-0.5">
                    +{beforePB} ➔ <span className="font-bold text-indigo-200">+{afterPB}</span>
                  </p>
                </div>
              ) : modifiedAbilities.length > 0 ? (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Ability Score Boost</span>
                  <div className="text-xs font-semibold text-amber-100 mt-0.5 space-y-0.5">
                    {modifiedAbilities.map((mod) => (
                      <div key={mod.key}>
                        {mod.label}: {mod.before} ({mod.beforeMod}) ➔{" "}
                        <span className="font-bold text-amber-200">
                          {mod.after} ({mod.afterMod})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-white/5 bg-slate-950/60 p-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Level</span>
                  <p className="text-sm font-semibold text-zinc-100 mt-0.5">
                    Level {isLevelUp ? `${currentTotalLevel} ➔ ${nextTotalLevel}` : "1"}
                  </p>
                </div>
              )}
            </div>

            {/* SPELL SLOTS & CLASS RESOURCES GAINED */}
            {slotChanges.length > 0 || resourceChanges.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-white/5">
                {slotChanges.length > 0 ? (
                  <div className="space-y-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">Spell Slots Progression</span>
                    <div className="flex flex-wrap gap-2 text-xs text-blue-100">
                      {slotChanges.map((slot) => (
                        <span
                          key={slot.level}
                          className="inline-flex items-center gap-1 rounded bg-blue-500/15 border border-blue-500/30 px-2 py-0.5"
                        >
                          Level {slot.level}: {slot.before} ➔ <span className="font-bold text-blue-200">{slot.after} slots</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {resourceChanges.length > 0 ? (
                  <div className="space-y-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Class Resources Updated</span>
                    <div className="flex flex-wrap gap-2 text-xs text-amber-100">
                      {resourceChanges.map((res) => (
                        <HoverBadge
                          key={res.name}
                          label={`${res.name}: ${res.before > 0 ? `${res.before} ➔ ` : ""}${res.after} uses`}
                          className="border-amber-500/30 bg-amber-500/15 text-amber-200 hover:border-amber-400"
                          preview={
                            res.description ? (
                              <div className="space-y-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">{res.name}</p>
                                <p className="text-xs text-zinc-300 leading-relaxed">{res.description}</p>
                              </div>
                            ) : null
                          }
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* UNLOCKED & ADDED ABILITIES / FEATURES WITH HOVER PREVIEW */}
            {newClassFeatures.length > 0 ||
            newSubclassFeatures.length > 0 ||
            newSubclassSpells.length > 0 ||
            guided.selectedGuideFeats.length > 0 ||
            guided.selectedGuideOptionalFeatures.length > 0 ||
            guided.selectedGuideSpells.length > 0 ? (
              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Abilities & Features to be Added to Sheet
                  </span>
                  <span className="text-[10px] text-amber-400/80 italic">Hover any item for details</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {newClassFeatures.map((featName) => {
                    const featureEntry = getFeaturePreviewEntry(featName);
                    return (
                      <HoverBadge
                        key={featName}
                        label={featName}
                        icon={<Sparkles size={12} className="text-amber-400" />}
                        className="border-amber-500/30 bg-amber-500/10 text-amber-200 hover:border-amber-400"
                        preview={
                          <ReferencePreviewCard title="Feature" eyebrow="Class Feature" entry={featureEntry} {...previewLookupProps} />
                        }
                      />
                    );
                  })}
                  {newSubclassFeatures.map((featName) => {
                    const featureEntry = getFeaturePreviewEntry(featName, true);
                    const subLabel = targetSubclassEntry?.name || subclassProgDef?.name || "Subclass";
                    return (
                      <HoverBadge
                        key={featName}
                        label={`${featName} (${subLabel})`}
                        icon={<Sparkles size={12} className="text-purple-400" />}
                        className="border-purple-500/30 bg-purple-500/10 text-purple-200 hover:border-purple-400"
                        preview={
                          <ReferencePreviewCard
                            title="Subclass Feature"
                            eyebrow={`${subLabel} Feature`}
                            entry={featureEntry}
                            {...previewLookupProps}
                          />
                        }
                      />
                    );
                  })}
                  {newSubclassSpells.map((spellName) => {
                    const foundSpell = compendium.spells.find(
                      (s) => s.name.toLowerCase() === spellName.toLowerCase() || s.id === spellName
                    );
                    const subLabel = targetSubclassEntry?.name || subclassProgDef?.name || "Subclass";
                    return (
                      <HoverBadge
                        key={`subclass-spell:${spellName}`}
                        label={`Subclass Spell: ${spellName}`}
                        icon={<Sparkles size={12} className="text-blue-400" />}
                        className="border-blue-500/30 bg-blue-500/10 text-blue-200 hover:border-blue-400"
                        preview={
                          foundSpell ? (
                            <SpellPreviewCard spell={foundSpell} {...previewLookupProps} />
                          ) : (
                            <ReferencePreviewCard
                              title="Spell"
                              eyebrow={`${subLabel} Spell`}
                              entry={{
                                id: spellName,
                                name: spellName,
                                category: `${subLabel} Spell`,
                                source: targetClassEntry?.source || "2024 Player's Handbook",
                                description: `${spellName} granted by ${subLabel}.`,
                                entries: `${spellName} granted by ${subLabel}.`,
                                tags: [subLabel, "Spell"]
                              }}
                              {...previewLookupProps}
                            />
                          )
                        }
                      />
                    );
                  })}
                  {guided.selectedGuideFeats.map((feat) => (
                    <HoverBadge
                      key={feat.id}
                      label={`Feat: ${feat.name}`}
                      className="border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:border-cyan-400"
                      preview={<FeatPreviewCard feat={feat} {...previewLookupProps} />}
                    />
                  ))}
                  {guided.selectedGuideOptionalFeatures.map((opt) => (
                    <HoverBadge
                      key={opt.id}
                      label={`Feature: ${opt.name}`}
                      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400"
                      preview={
                        <ReferencePreviewCard
                          title="Optional Feature"
                          eyebrow={opt.category || "Optional Feature"}
                          entry={opt}
                          {...previewLookupProps}
                        />
                      }
                    />
                  ))}
                  {guided.selectedGuideSpells.map((spell) => (
                    <HoverBadge
                      key={spell.id}
                      label={`Spell: ${spell.name}`}
                      className="border-blue-500/30 bg-blue-500/10 text-blue-200 hover:border-blue-400"
                      preview={<SpellPreviewCard spell={spell} {...previewLookupProps} />}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {guided.selectedGuideFeats.length > 0 ||
          guided.selectedGuideOptionalFeatures.length > 0 ||
          guided.selectedGuideSpells.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-3">
              {guided.selectedGuideFeats.length > 0 ? (
                <DetailCollection
                  title="Feat Previews"
                  entries={guided.selectedGuideFeats.map((entry) => ({
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
              {guided.selectedGuideOptionalFeatures.length > 0 ? (
                <DetailCollection
                  title="Feature Previews"
                  entries={guided.selectedGuideOptionalFeatures.map((entry) =>
                    createReferenceRow("Optional Feature", entry, [{ label: "Prerequisites", value: entry.prerequisites || "None" }])
                  )}
                  emptyMessage=""
                  renderText={renderRulesText}
                />
              ) : null}
              {guided.selectedGuideSpells.length > 0 ? (
                <DetailCollection
                  title="Spell Previews"
                  entries={collectSpellRows(
                    guided.selectedGuideSpells.map((entry) => entry.name),
                    [],
                    compendium.spells,
                    guided.guidedChoiceSpec.knownSpellCount + guided.guidedChoiceSpec.spellbookCount
                  )}
                  emptyMessage=""
                  renderText={renderRulesText}
                />
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end pt-3 border-t border-white/8">
            <SheetButton
              variant="primary"
              size="lg"
              onClick={guided.guidedFlowMode === "setup" ? guided.confirmGuidedSetup : guided.confirmGuidedLevelUp}
            >
              {guided.guidedFlowMode === "setup" ? "Apply Character Setup" : "Apply Level Up"}
            </SheetButton>
          </div>
        </div>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-slate-950/98 text-zinc-100 shadow-[0_24px_80px_rgba(0,0,0,0.8)] overflow-hidden">
        {modalContent}
      </div>
    );
  }

  return (
    <ModalFrame
      onClose={onCancel ?? guided.closeGuidedFlow}
      backdropClassName="bg-black/70 backdrop-blur-sm"
      panelClassName="max-w-4xl rounded-xl border border-amber-500/30 bg-slate-950/98 text-zinc-100 shadow-[0_24px_80px_rgba(0,0,0,0.8)]"
      closeOnBackdrop={false}
    >
      {modalContent}
    </ModalFrame>
  );
}
