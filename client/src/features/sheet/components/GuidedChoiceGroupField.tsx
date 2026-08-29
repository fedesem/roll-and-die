import type { ReactNode } from "react";

import type { CompendiumChoiceGroup, CompendiumChoiceOption } from "@shared/types";

import { HoverPreviewTrigger, secondaryButtonClass } from "./sheetPrimitives";

interface GuidedChoiceGroupFieldProps {
  group: CompendiumChoiceGroup;
  selectedIds: string[];
  onChange: (optionIds: string[]) => void;
  onChooseSpells?: () => void;
  renderOptionPreview?: (option: CompendiumChoiceOption) => ReactNode;
}

export function GuidedChoiceGroupField({ group, selectedIds, onChange, onChooseSpells, renderOptionPreview }: GuidedChoiceGroupFieldProps) {
  const maxCount = group.count || 1;
  const isSpellChoice = group.selectionKind === "spells";
  const selectedOptions = group.options.filter((option) => selectedIds.includes(option.id));

  if (isSpellChoice) {
    return (
      <fieldset className={`space-y-3 border border-white/5 bg-slate-900/40 p-3 ${group.parentOption ? "ml-5 border-l-amber-500/40" : ""}`}>
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-amber-300">{group.label}</legend>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-zinc-400">
            {selectedIds.length}/{maxCount} selected{group.hint ? ` • ${group.hint}` : ""}
          </p>
          <button type="button" className={secondaryButtonClass} onClick={onChooseSpells}>
            Choose Spells
          </button>
        </div>
        {selectedOptions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedOptions.map((option) => (
              <span key={option.id} className="border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-100">
                {option.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">No spells selected yet.</p>
        )}
      </fieldset>
    );
  }

  const toggle = (option: CompendiumChoiceOption) => {
    if (selectedIds.includes(option.id)) {
      onChange(maxCount === 1 ? selectedIds : selectedIds.filter((id) => id !== option.id));
      return;
    }
    if (maxCount === 1) {
      onChange([option.id]);
      return;
    }
    onChange(selectedIds.length < maxCount ? [...selectedIds, option.id] : [...selectedIds.slice(1), option.id]);
  };

  return (
    <fieldset className={`space-y-3 border border-white/5 bg-slate-900/40 p-3 ${group.parentOption ? "ml-5 border-l-amber-500/40" : ""}`}>
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-amber-300">{group.label}</legend>
      <p className="text-[11px] text-zinc-400">
        {selectedIds.length}/{maxCount} selected{group.hint ? ` • ${group.hint}` : ""}
      </p>
      <div className="space-y-2" role={maxCount === 1 ? "radiogroup" : "group"} aria-label={group.label}>
        {group.options.map((option) => {
          const checked = selectedIds.includes(option.id);
          const preview = renderOptionPreview?.(option);
          return (
            <div
              key={option.id}
              className={`flex items-center gap-3 border px-3 py-2 transition ${
                option.disabledReason
                  ? "border-red-500/20 bg-red-950/10 text-zinc-500"
                  : checked
                    ? "border-amber-500/80 bg-amber-500/10 text-amber-50"
                    : "border-white/8 bg-black/20 text-zinc-300 hover:border-white/20"
              }`}
            >
              <label
                className={`flex min-w-0 flex-1 items-center gap-3 ${option.disabledReason ? "cursor-not-allowed" : "cursor-pointer"}`}
              >
                <input
                  type={maxCount === 1 ? "radio" : "checkbox"}
                  name={maxCount === 1 ? group.id : undefined}
                  checked={checked}
                  disabled={Boolean(option.disabledReason)}
                  onChange={() => toggle(option)}
                  className="h-4 w-4 accent-amber-500"
                />
                <span className="min-w-0 text-sm font-medium">{option.label}</span>
              </label>
              {preview ? (
                <HoverPreviewTrigger
                  label={`${option.label} rules`}
                  caption="Rules"
                  emptyMessage="No rules text available."
                  preview={preview}
                />
              ) : null}
              {option.disabledReason ? <span className="text-[11px] text-red-300">{option.disabledReason}</span> : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
