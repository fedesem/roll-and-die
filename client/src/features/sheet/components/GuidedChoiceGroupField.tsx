import type { CompendiumChoiceGroup, CompendiumChoiceOption } from "@shared/types";
import { Check, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { HoverPreviewTrigger, SheetButton } from "./sheetPrimitives";

interface GuidedChoiceGroupFieldProps {
  group: CompendiumChoiceGroup;
  selectedIds: string[];
  onChange: (optionIds: string[]) => void;
  onChooseSpells?: () => void;
  renderOptionPreview?: (option: CompendiumChoiceOption) => ReactNode;
}

export function GuidedChoiceGroupField({
  group,
  selectedIds = [],
  onChange,
  onChooseSpells,
  renderOptionPreview
}: GuidedChoiceGroupFieldProps) {
  const safeSelectedIds = selectedIds ?? [];
  const options = group.options ?? [];
  const maxCount = group.count || 1;
  const isSpellChoice = group.selectionKind === "spells";
  const selectedOptions = options.filter((option) => safeSelectedIds.includes(option.id));

  if (isSpellChoice) {
    return (
      <fieldset
        className={`space-y-3 rounded-lg border border-amber-500/20 bg-slate-900/60 p-4 ${group.parentOption ? "ml-4 border-l-amber-500/60" : ""}`}
      >
        <legend className="px-2 text-xs font-bold uppercase tracking-wider text-amber-400">{group.label}</legend>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-zinc-300">
            <span className="font-semibold text-amber-300">{safeSelectedIds.length}</span> / {maxCount} selected
            {group.hint ? <span className="text-zinc-400"> • {group.hint}</span> : ""}
          </p>
          <SheetButton variant="secondary" size="sm" icon={<Sparkles size={13} />} onClick={onChooseSpells}>
            Choose Spells
          </SheetButton>
        </div>
        {selectedOptions.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {selectedOptions.map((option) => (
              <span
                key={option.id}
                className="rounded border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-200"
              >
                {option.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500 italic">No spells selected yet.</p>
        )}
      </fieldset>
    );
  }

  const toggle = (option: CompendiumChoiceOption) => {
    if (safeSelectedIds.includes(option.id)) {
      onChange(maxCount === 1 ? safeSelectedIds : safeSelectedIds.filter((id) => id !== option.id));
      return;
    }
    if (maxCount === 1) {
      onChange([option.id]);
      return;
    }
    if (safeSelectedIds.length < maxCount) onChange([...safeSelectedIds, option.id]);
  };

  return (
    <fieldset
      className={`space-y-3 rounded-lg border border-amber-500/20 bg-slate-900/60 p-4 ${group.parentOption ? "ml-4 border-l-amber-500/60" : ""}`}
    >
      <legend className="px-2 text-xs font-bold uppercase tracking-wider text-amber-400">{group.label}</legend>
      <p className="text-xs text-zinc-300">
        <span className="font-semibold text-amber-300">{safeSelectedIds.length}</span> / {maxCount} selected
        {group.hint ? <span className="text-zinc-400"> • {group.hint}</span> : ""}
      </p>
      <div className="space-y-2" role={maxCount === 1 ? "radiogroup" : "group"} aria-label={group.label}>
        {options.map((option) => {
          const checked = safeSelectedIds.includes(option.id);
          const preview = renderOptionPreview?.(option);
          return (
            <div
              key={option.id}
              className={`flex items-center gap-3 rounded-md border p-3 transition ${
                option.disabledReason
                  ? "border-rose-500/20 bg-rose-950/10 text-zinc-500 opacity-60"
                  : checked
                    ? "border-amber-500 bg-amber-500/15 text-amber-50 shadow-[0_0_12px_rgba(245,158,11,0.12)]"
                    : "border-white/8 bg-slate-950/60 text-zinc-300 hover:border-white/20 hover:bg-slate-900/80"
              }`}
            >
              <label
                className={`relative flex min-w-0 flex-1 items-center gap-3 ${option.disabledReason ? "cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                    checked ? "border-amber-400 bg-amber-500 text-slate-950 font-bold" : "border-white/20 bg-slate-900"
                  }`}
                >
                  {checked ? <Check size={12} strokeWidth={3} /> : null}
                </div>
                <input
                  type={maxCount === 1 ? "radio" : "checkbox"}
                  name={maxCount === 1 ? group.id : undefined}
                  checked={checked}
                  disabled={Boolean(option.disabledReason) || (maxCount > 1 && !checked && safeSelectedIds.length >= maxCount)}
                  onChange={() => toggle(option)}
                  className="sr-only"
                />
                <span className="min-w-0 text-xs font-semibold">{option.label}</span>
              </label>
              {preview ? (
                <HoverPreviewTrigger label="View Rules" caption={option.label} emptyMessage="No rules text available." preview={preview} />
              ) : null}
              {option.disabledReason ? <span className="text-xs text-rose-300">{option.disabledReason}</span> : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
