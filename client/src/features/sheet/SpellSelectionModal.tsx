import type { CampaignSnapshot, SpellEntry, SpellLevel, SpellSchool } from "@shared/types";
import { Eye, Sparkles, X } from "lucide-react";
import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { SpellPreviewCard } from "../../components/admin/AdminPreview";
import { anchorFromRect, type FloatingAnchor, FloatingLayer } from "../../components/FloatingLayer";
import { ModalFrame } from "../../components/ModalFrame";
import { inputClass, SheetButton } from "./components/sheetPrimitives";
import { spellMatchesSingleClassFilter } from "./selectors/playerNpcSheet2024Selectors";
import { normalizeKey } from "./sheetUtils";

interface SpellSelectionModalProps {
  title: string;
  subtitle: string;
  spells: SpellEntry[];
  selectedSpellIds: string[];
  compendium: CampaignSnapshot["compendium"];
  allowedSourceBooks: string[];
  maxSelections?: number;
  lockEligibilityFilters?: boolean;
  emptyMessage?: string;
  applyLabel?: string;
  onApply: (spellIds: string[]) => void;
  onClose: () => void;
}

type SpellLevelFilter = "all" | `${SpellLevel}`;

interface SpellAccessFilterOption {
  key: string;
  label: string;
  kind: "class" | "subclass";
  classLabel?: string;
}

export function SpellSelectionModal({
  title,
  subtitle,
  spells,
  selectedSpellIds,
  compendium,
  allowedSourceBooks,
  maxSelections,
  lockEligibilityFilters = false,
  emptyMessage = "No spells match these filters.",
  applyLabel = "Apply Spells",
  onApply,
  onClose
}: SpellSelectionModalProps) {
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedSpellIds);
  const [nameFilter, setNameFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState<SpellLevelFilter>("all");
  const [schoolFilter, setSchoolFilter] = useState<SpellSchool | "all">("all");
  const [classFilter, setClassFilter] = useState("all");
  const [previewAnchor, setPreviewAnchor] = useState<FloatingAnchor | null>(null);
  const [previewSpell, setPreviewSpell] = useState<SpellEntry | null>(null);
  const closePreviewTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setLocalSelectedIds(selectedSpellIds.filter((entry) => spells.some((spell) => spell.id === entry)));
    setNameFilter("");
    setLevelFilter("all");
    setSchoolFilter("all");
    setClassFilter("all");
    setPreviewAnchor(null);
    setPreviewSpell(null);
  }, [selectedSpellIds, spells, title]);

  useEffect(
    () => () => {
      if (closePreviewTimerRef.current !== null) {
        window.clearTimeout(closePreviewTimerRef.current);
      }
    },
    []
  );
  const spellLookup = useMemo(() => new Map(spells.map((spell) => [spell.id, spell])), [spells]);
  const selectedSpellIdSet = useMemo(() => new Set(localSelectedIds), [localSelectedIds]);
  const sortedSpells = useMemo(
    () =>
      [...spells].sort((left, right) => {
        const leftLevel = left.level === "cantrip" ? 0 : left.level;
        const rightLevel = right.level === "cantrip" ? 0 : right.level;

        if (leftLevel !== rightLevel) {
          return leftLevel - rightLevel;
        }

        return left.name.localeCompare(right.name);
      }),
    [spells]
  );
  const normalizedAllowedBooks = useMemo(() => new Set(allowedSourceBooks.map((entry) => normalizeKey(entry))), [allowedSourceBooks]);
  const classOptions = useMemo(() => {
    const byKey = new Map<string, SpellAccessFilterOption>();
    const availableSubclasses = new Map<string, { label: string; classLabel: string }>();

    compendium.classes.forEach((classEntry) => {
      classEntry.subclasses.forEach((subclassEntry) => {
        if (normalizedAllowedBooks.size > 0 && !normalizedAllowedBooks.has(normalizeKey(subclassEntry.source))) {
          return;
        }

        availableSubclasses.set(`${normalizeKey(classEntry.name)}:${normalizeKey(subclassEntry.name)}`, {
          label: subclassEntry.name,
          classLabel: classEntry.name
        });
      });
    });

    sortedSpells.forEach((spell) => {
      spell.classes.forEach((entry) => {
        const normalized = normalizeKey(entry);
        if (!normalized || byKey.has(`class:${normalized}`)) {
          return;
        }

        byKey.set(`class:${normalized}`, {
          key: `class:${normalized}`,
          label: entry,
          kind: "class"
        });
      });

      spell.classReferences.forEach((entry) => {
        const referenceKind = entry.kind === "subclass" || entry.kind === "subclassVariant" ? "subclass" : "class";
        const label = referenceKind === "subclass" ? entry.name : entry.source ? `${entry.name} (${entry.source})` : entry.name;
        const normalized = normalizeKey(label);
        const normalizedClassName = normalizeKey(entry.className || "");
        const subclassKey = `${normalizedClassName}:${normalized}`;
        const optionKey = referenceKind === "subclass" ? `subclass:${subclassKey}` : `${referenceKind}:${normalized}`;

        if (!normalized || (referenceKind === "subclass" && !availableSubclasses.has(subclassKey)) || byKey.has(optionKey)) {
          return;
        }

        const subclassMeta = referenceKind === "subclass" ? availableSubclasses.get(subclassKey) : null;
        byKey.set(optionKey, {
          key: optionKey,
          label: subclassMeta?.label ?? label,
          kind: referenceKind,
          classLabel: subclassMeta?.classLabel
        });
      });
    });

    return Array.from(byKey.values()).sort((left, right) => left.label.localeCompare(right.label));
  }, [compendium.classes, normalizedAllowedBooks, sortedSpells]);

  const baseClassOptions = useMemo(() => classOptions.filter((entry) => entry.kind === "class"), [classOptions]);
  const subclassOptionsByClass = useMemo(() => {
    const grouped = new Map<string, SpellAccessFilterOption[]>();

    classOptions
      .filter((entry) => entry.kind === "subclass")
      .forEach((entry) => {
        const classLabel = entry.classLabel ?? "Other";
        const existing = grouped.get(classLabel) ?? [];
        existing.push(entry);
        grouped.set(classLabel, existing);
      });

    return Array.from(grouped.entries()).sort(([left], [right]) => left.localeCompare(right));
  }, [classOptions]);

  const filteredSpells = useMemo(() => {
    const normalizedQuery = normalizeKey(nameFilter);

    return sortedSpells.filter((spell) => {
      if (normalizedQuery && !normalizeKey(spell.name).includes(normalizedQuery)) {
        return false;
      }

      if (levelFilter !== "all" && String(spell.level) !== levelFilter) {
        return false;
      }

      if (schoolFilter !== "all" && spell.school !== schoolFilter) {
        return false;
      }

      if (classFilter !== "all") {
        const option = classOptions.find((entry) => entry.key === classFilter);

        if (!option) {
          return false;
        }

        const matchesClassFilter = spellMatchesSingleClassFilter(spell, option.label);

        if (!matchesClassFilter) {
          return false;
        }
      }

      return true;
    });
  }, [classFilter, classOptions, levelFilter, nameFilter, schoolFilter, sortedSpells]);

  const selectionLimitReached = typeof maxSelections === "number" && maxSelections > 0 && localSelectedIds.length >= maxSelections;

  function toggleSpell(spellId: string) {
    setLocalSelectedIds((current) => {
      if (current.includes(spellId)) {
        return current.filter((entry) => entry !== spellId);
      }

      if (typeof maxSelections === "number" && maxSelections > 0 && current.length >= maxSelections) {
        return current;
      }

      return [...current, spellId];
    });
  }

  function queuePreviewClose() {
    if (closePreviewTimerRef.current !== null) {
      window.clearTimeout(closePreviewTimerRef.current);
    }

    closePreviewTimerRef.current = window.setTimeout(() => {
      setPreviewAnchor(null);
      setPreviewSpell(null);
    }, 120);
  }

  function showPreview(spell: SpellEntry, event: ReactPointerEvent<HTMLDivElement>) {
    if (closePreviewTimerRef.current !== null) {
      window.clearTimeout(closePreviewTimerRef.current);
      closePreviewTimerRef.current = null;
    }

    setPreviewSpell(spell);
    setPreviewAnchor(anchorFromRect(event.currentTarget.getBoundingClientRect()));
  }

  return (
    <ModalFrame
      onClose={onClose}
      backdropClassName="bg-black/70 backdrop-blur-sm"
      panelClassName="max-w-6xl rounded-xl border border-amber-500/30 bg-slate-950/98 text-zinc-100 shadow-[0_24px_80px_rgba(0,0,0,0.8)]"
    >
      <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5 bg-gradient-to-r from-amber-500/[0.08] to-transparent">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-400">Compendium</p>
          </div>
          <h3 className="mt-1 font-serif text-2xl font-bold text-amber-50">{title}</h3>
          <p className="mt-1 text-xs text-zinc-400">{subtitle}</p>
        </div>
        <SheetButton variant="ghost" size="sm" icon={<X size={16} />} onClick={onClose}>
          Close
        </SheetButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-4">
        <div
          className={`grid gap-3 rounded-lg border border-white/10 bg-slate-900/60 p-4 ${
            lockEligibilityFilters ? "md:grid-cols-[minmax(0,1fr)_auto]" : "md:grid-cols-4"
          }`}
        >
          <label className="space-y-1 text-xs text-zinc-300">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">Search Spell</span>
            <input
              className={inputClass}
              value={nameFilter}
              onChange={(event) => setNameFilter(event.target.value)}
              placeholder="Search spell name..."
            />
          </label>
          {lockEligibilityFilters ? (
            <p className="self-end rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Class, spell type, and spell level are fixed by this step.
            </p>
          ) : (
            <>
              <label className="space-y-1 text-xs text-zinc-300">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">Level</span>
                <select
                  className={inputClass}
                  value={levelFilter}
                  onChange={(event) => setLevelFilter(event.target.value as SpellLevelFilter)}
                >
                  <option value="all">All Levels</option>
                  <option value="cantrip">Cantrip</option>
                  {Array.from({ length: 9 }, (_, index) => index + 1).map((level) => (
                    <option key={level} value={String(level)}>
                      Level {level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-zinc-300">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">School</span>
                <select
                  className={inputClass}
                  value={schoolFilter}
                  onChange={(event) => setSchoolFilter(event.target.value as SpellSchool | "all")}
                >
                  <option value="all">All Schools</option>
                  {SPELL_SCHOOLS.map((school) => (
                    <option key={school} value={school}>
                      {school}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-zinc-300">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">Class</span>
                <select className={inputClass} value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
                  <option value="all">All Class Access</option>
                  {baseClassOptions.length > 0 ? (
                    <optgroup label="Classes">
                      {baseClassOptions.map((entry) => (
                        <option key={entry.key} value={entry.key}>
                          {entry.label}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {subclassOptionsByClass.map(([classLabel, entries]) => (
                    <optgroup key={classLabel} label={`Subclasses · ${classLabel}`}>
                      {entries.map((entry) => (
                        <option key={entry.key} value={entry.key}>
                          {entry.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border border-white/8 bg-slate-900/60 px-4 py-2.5 text-xs">
          <p className="text-zinc-300">
            Showing <span className="font-semibold text-amber-300">{filteredSpells.length}</span> of{" "}
            <span className="font-semibold text-zinc-200">{spells.length}</span> spells
          </p>
          <p className="text-zinc-300">
            Selected: <span className="font-semibold text-amber-300">{localSelectedIds.length}</span>
            {typeof maxSelections === "number" && maxSelections > 0 ? ` / ${maxSelections}` : ""}
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-white/10 bg-slate-900/40">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-[minmax(0,1.8fr)_6.5rem_7rem_7.5rem_5rem_7rem_3.5rem_4rem] gap-2 border-b border-white/8 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400 bg-slate-950/80">
              <span>Name</span>
              <span>Level</span>
              <span>Time</span>
              <span>School</span>
              <span>Conc.</span>
              <span>Range</span>
              <span className="text-center">View</span>
              <span className="text-right">Select</span>
            </div>
            {filteredSpells.length === 0 ? <p className="px-4 py-6 text-xs text-zinc-500 italic">{emptyMessage}</p> : null}
            {filteredSpells.map((spell) => {
              const selected = selectedSpellIdSet.has(spell.id);
              const actionDisabled = !selected && selectionLimitReached;

              return (
                <div
                  key={spell.id}
                  className={`grid grid-cols-[minmax(0,1.8fr)_6.5rem_7rem_7.5rem_5rem_7rem_3.5rem_4rem] items-center gap-2 border-b border-white/5 px-4 py-2 text-xs text-zinc-200 transition last:border-b-0 ${
                    selected ? "bg-amber-500/[0.08]" : "hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-100">{spell.name}</p>
                    <p className="truncate text-[10px] text-zinc-500">{spell.source}</p>
                  </div>
                  <span>{formatSpellLevel(spell.level)}</span>
                  <span>{formatSpellTime(spell)}</span>
                  <span>{spell.school}</span>
                  <span>{spell.concentration ? "Yes" : "No"}</span>
                  <span>{formatSpellRange(spell)}</span>
                  <div
                    className="flex items-center justify-center text-zinc-400 hover:text-amber-300 cursor-pointer"
                    onPointerEnter={(event) => showPreview(spell, event)}
                    onPointerMove={(event) => showPreview(spell, event)}
                    onPointerLeave={queuePreviewClose}
                  >
                    <Eye size={16} strokeWidth={2} />
                  </div>
                  <div className="flex justify-end">
                    <SheetButton
                      variant={selected ? "danger" : "secondary"}
                      size="sm"
                      disabled={actionDisabled}
                      onClick={() => toggleSpell(spell.id)}
                    >
                      {selected ? "Remove" : "Pick"}
                    </SheetButton>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {previewSpell && previewAnchor ? (
          <FloatingLayer
            anchor={previewAnchor}
            placement="left-start"
            offset={14}
            className="pointer-events-auto z-[2147483000] w-[min(54rem,calc(100vw-3rem))] max-w-[54rem]"
            onPointerEnter={() => {
              if (closePreviewTimerRef.current !== null) {
                window.clearTimeout(closePreviewTimerRef.current);
                closePreviewTimerRef.current = null;
              }
            }}
            onPointerLeave={() => {
              setPreviewAnchor(null);
              setPreviewSpell(null);
            }}
          >
            <div className="max-h-[calc(100vh-3rem)] overflow-y-auto overscroll-contain rounded-lg border border-amber-500/40 bg-slate-950 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.8)]">
              <SpellPreviewCard
                spell={previewSpell}
                featEntries={compendium.feats}
                classEntries={compendium.classes}
                variantRuleEntries={compendium.variantRules}
                conditionEntries={compendium.conditions}
              />
            </div>
          </FloatingLayer>
        ) : null}
      </div>

      <div className="flex justify-end gap-3 border-t border-white/8 px-6 py-4">
        <SheetButton variant="secondary" size="md" onClick={onClose}>
          Cancel
        </SheetButton>
        <SheetButton variant="primary" size="md" onClick={() => onApply(localSelectedIds.filter((entry) => spellLookup.has(entry)))}>
          {applyLabel}
        </SheetButton>
      </div>
    </ModalFrame>
  );
}

const SPELL_SCHOOLS: SpellSchool[] = [
  "Abjuration",
  "Conjuration",
  "Divination",
  "Enchantment",
  "Evocation",
  "Illusion",
  "Necromancy",
  "Transmutation"
];

function formatSpellLevel(level: SpellEntry["level"]) {
  return level === "cantrip" ? "Cantrip" : `Level ${level}`;
}

function formatSpellTime(spell: SpellEntry) {
  return spell.castingTimeValue === 1 ? spell.castingTimeUnit : `${spell.castingTimeValue} ${spell.castingTimeUnit}s`;
}

function formatSpellRange(spell: SpellEntry) {
  if (spell.rangeType === "feet") {
    return `${spell.rangeValue} ft`;
  }

  if (spell.rangeType === "self emanation") {
    return spell.rangeValue > 0 ? `Self (${spell.rangeValue} ft)` : "Self";
  }

  return spell.rangeType === "self" ? "Self" : spell.rangeType;
}
