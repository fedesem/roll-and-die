import { Eye } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import type { CampaignSnapshot, SpellEntry, SpellLevel, SpellSchool } from "@shared/types";

import { FloatingLayer, type FloatingAnchor } from "../../components/FloatingLayer";
import { ModalFrame } from "../../components/ModalFrame";
import { SpellPreviewCard } from "../../components/admin/AdminPreview";
import { normalizeKey } from "./sheetUtils";

interface SpellSelectionModalProps {
  title: string;
  subtitle: string;
  spells: SpellEntry[];
  selectedSpellIds: string[];
  compendium: CampaignSnapshot["compendium"];
  allowedSourceBooks: string[];
  maxSelections?: number;
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

const inputClass =
  "w-full border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-amber-500/70";
const buttonClass = "inline-flex items-center justify-center border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 transition hover:border-amber-500/70 hover:text-amber-50";

export function SpellSelectionModal({
  title,
  subtitle,
  spells,
  selectedSpellIds,
  compendium,
  allowedSourceBooks,
  maxSelections,
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
  const normalizedClassNames = useMemo(
    () => new Set(compendium.classes.map((entry) => normalizeKey(entry.name))),
    [compendium.classes]
  );
  const normalizedAllowedBooks = useMemo(
    () => new Set(allowedSourceBooks.map((entry) => normalizeKey(entry))),
    [allowedSourceBooks]
  );
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

        if (!normalized || !normalizedClassNames.has(normalized) || byKey.has(`class:${normalized}`)) {
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
        const label = referenceKind === "subclass" ? entry.name : entry.className || entry.name;
        const normalized = normalizeKey(label);
        const normalizedClassName = normalizeKey(entry.className || "");
        const subclassKey = `${normalizedClassName}:${normalized}`;
        const optionKey = referenceKind === "subclass" ? `subclass:${subclassKey}` : `${referenceKind}:${normalized}`;

        if (
          !normalized ||
          (referenceKind === "subclass" && !availableSubclasses.has(subclassKey)) ||
          (referenceKind === "class" && !normalizedClassNames.has(normalizeKey(entry.className || label))) ||
          byKey.has(optionKey)
        ) {
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
  }, [compendium.classes, normalizedAllowedBooks, normalizedClassNames, sortedSpells]);
  const baseClassOptions = useMemo(() => classOptions.filter((entry) => entry.kind === "class"), [classOptions]);
  const subclassOptionsByClass = useMemo(() => {
    const groups = new Map<string, SpellAccessFilterOption[]>();

    classOptions
      .filter((entry) => entry.kind === "subclass" && entry.classLabel)
      .forEach((entry) => {
        const classLabel = entry.classLabel ?? "Other";
        const current = groups.get(classLabel) ?? [];
        current.push(entry);
        groups.set(classLabel, current);
      });

    return Array.from(groups.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([classLabel, entries]) => [classLabel, [...entries].sort((left, right) => left.label.localeCompare(right.label))] as const);
  }, [classOptions]);
  const filteredSpells = useMemo(
    () =>
      sortedSpells.filter((spell) => {
        if (nameFilter.trim() && !normalizeKey(spell.name).includes(normalizeKey(nameFilter))) {
          return false;
        }

        if (levelFilter !== "all" && `${spell.level}` !== levelFilter) {
          return false;
        }

        if (schoolFilter !== "all" && spell.school !== schoolFilter) {
          return false;
        }

        if (classFilter !== "all") {
          const [filterKind, ...filterValueParts] = classFilter.split(":");
          const normalizedClassFilter = normalizeKey(filterValueParts.join(":"));
          const matchesClass =
            filterKind === "subclass"
              ? spell.classReferences.some(
                  (entry) =>
                    (entry.kind === "subclass" || entry.kind === "subclassVariant") &&
                    `${normalizeKey(entry.className || "")}:${normalizeKey(entry.name)}` === normalizedClassFilter
                )
              : spell.classes.some((entry) => normalizeKey(entry) === normalizedClassFilter) ||
                spell.classReferences.some(
                  (entry) =>
                    (entry.kind === "class" || entry.kind === "classVariant") &&
                    (normalizeKey(entry.className) === normalizedClassFilter || normalizeKey(entry.name) === normalizedClassFilter)
                );

          if (!matchesClass) {
            return false;
          }
        }

        return true;
      }),
    [classFilter, levelFilter, nameFilter, schoolFilter, sortedSpells]
  );
  const selectionLimitReached = typeof maxSelections === "number" && maxSelections > 0 && localSelectedIds.length >= maxSelections;

  function queuePreviewClose() {
    if (closePreviewTimerRef.current !== null) {
      window.clearTimeout(closePreviewTimerRef.current);
    }

    closePreviewTimerRef.current = window.setTimeout(() => {
      setPreviewAnchor(null);
      setPreviewSpell(null);
      closePreviewTimerRef.current = null;
    }, 110);
  }

  function showPreview(spell: SpellEntry, event: ReactPointerEvent<HTMLElement>) {
    if (closePreviewTimerRef.current !== null) {
      window.clearTimeout(closePreviewTimerRef.current);
      closePreviewTimerRef.current = null;
    }

    setPreviewAnchor({
      left: event.clientX,
      top: event.clientY,
      width: 0,
      height: 0
    });
    setPreviewSpell(spell);
  }

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

  return (
    <ModalFrame onClose={onClose} backdropClassName="bg-black/70" panelClassName="max-w-7xl border-white/10 bg-slate-950 text-zinc-100">
      <>
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-amber-400/80">Spell Selection</p>
            <h3 className="mt-2 font-serif text-2xl text-amber-50">{title}</h3>
            <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
          </div>
          <button type="button" className={buttonClass} onClick={onClose}>
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          <div className="grid gap-3 border border-white/8 bg-black/20 p-4 md:grid-cols-4">
            <label className="space-y-1.5 text-sm text-zinc-300">
              <span className="block text-[11px] uppercase tracking-[0.22em] text-amber-400/80">Name</span>
              <input className={inputClass} value={nameFilter} onChange={(event) => setNameFilter(event.target.value)} placeholder="Search spell name" />
            </label>
            <label className="space-y-1.5 text-sm text-zinc-300">
              <span className="block text-[11px] uppercase tracking-[0.22em] text-amber-400/80">Level</span>
              <select className={inputClass} value={levelFilter} onChange={(event) => setLevelFilter(event.target.value as SpellLevelFilter)}>
                <option value="all">All Levels</option>
                <option value="cantrip">Cantrip</option>
                {Array.from({ length: 9 }, (_, index) => index + 1).map((level) => (
                  <option key={level} value={String(level)}>
                    Level {level}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm text-zinc-300">
              <span className="block text-[11px] uppercase tracking-[0.22em] text-amber-400/80">School</span>
              <select className={inputClass} value={schoolFilter} onChange={(event) => setSchoolFilter(event.target.value as SpellSchool | "all")}>
                <option value="all">All Schools</option>
                {SPELL_SCHOOLS.map((school) => (
                  <option key={school} value={school}>
                    {school}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm text-zinc-300">
              <span className="block text-[11px] uppercase tracking-[0.22em] text-amber-400/80">Class</span>
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
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border border-white/8 bg-black/20 px-4 py-3 text-sm">
            <p className="text-zinc-300">
              Showing <span className="text-amber-100">{filteredSpells.length}</span> of <span className="text-amber-100">{spells.length}</span> spells
            </p>
            <p className="text-zinc-400">
              Selected <span className="text-amber-100">{localSelectedIds.length}</span>
              {typeof maxSelections === "number" && maxSelections > 0 ? ` / ${maxSelections}` : ""}
            </p>
          </div>

          <div className="mt-4 overflow-x-auto border border-white/8 bg-black/20">
            <div className="min-w-[880px]">
              <div className="grid grid-cols-[minmax(0,1.7fr)_6.5rem_8rem_8rem_6rem_8rem_4rem_4rem] gap-3 border-b border-white/8 px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                <span>Name</span>
                <span>Level</span>
                <span>Time</span>
                <span>School</span>
                <span>Conc.</span>
                <span>Range</span>
                <span className="text-center">View</span>
                <span className="text-right">Pick</span>
              </div>
              {filteredSpells.length === 0 ? (
                <p className="px-4 py-5 text-sm text-zinc-500">{emptyMessage}</p>
              ) : null}
              {filteredSpells.map((spell) => {
                const selected = selectedSpellIdSet.has(spell.id);
                const actionDisabled = !selected && selectionLimitReached;

                return (
                  <div
                    key={spell.id}
                    className="grid grid-cols-[minmax(0,1.7fr)_6.5rem_8rem_8rem_6rem_8rem_4rem_4rem] gap-3 border-b border-white/8 px-4 py-3 text-sm text-zinc-200 last:border-b-0 hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-zinc-100">{spell.name}</p>
                      <p className="truncate text-xs text-zinc-500">{spell.source}</p>
                    </div>
                    <span>{formatSpellLevel(spell.level)}</span>
                    <span>{formatSpellTime(spell)}</span>
                    <span>{spell.school}</span>
                    <span>{spell.concentration ? "Yes" : "No"}</span>
                    <span>{formatSpellRange(spell)}</span>
                    <div
                      className="flex items-center justify-center text-zinc-400"
                      onPointerEnter={(event) => showPreview(spell, event)}
                      onPointerMove={(event) => showPreview(spell, event)}
                      onPointerLeave={queuePreviewClose}
                    >
                      <Eye size={18} strokeWidth={2.1} />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className={`inline-flex h-10 w-10 items-center justify-center border p-0 text-xl font-semibold leading-none transition ${
                          selected
                            ? "border-red-500/70 bg-red-500/15 text-red-100 hover:bg-red-500/20"
                            : actionDisabled
                              ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-zinc-600"
                              : "border-amber-500/70 bg-amber-500/15 text-amber-100 hover:bg-amber-500/20"
                        }`}
                        disabled={actionDisabled}
                        onClick={() => toggleSpell(spell.id)}
                      >
                        {selected ? "X" : "+"}
                      </button>
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
              className="pointer-events-auto z-[2147483000] w-[min(68rem,calc(100vw-3rem))] max-w-[68rem]"
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
              <div className="max-h-[calc(100vh-3rem)] overflow-y-auto overscroll-contain border border-white/10 bg-slate-950 shadow-[0_28px_90px_rgba(0,0,0,0.5)]">
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
        <div className="flex justify-end gap-3 border-t border-white/8 px-5 py-4">
          <button type="button" className={buttonClass} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="border border-amber-500 bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400"
            onClick={() => onApply(localSelectedIds.filter((entry) => spellLookup.has(entry)))}
          >
            {applyLabel}
          </button>
        </div>
      </>
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
