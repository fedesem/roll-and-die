import type { ProgressionChoiceGroupDef } from "@shared/data/progression";
import type { ActorClassEntry } from "@shared/types";
import { Check, Heart, Minus, Plus, Sparkles, X } from "lucide-react";

import { ModalFrame } from "../../components/ModalFrame";
import { SheetButton } from "./components/sheetPrimitives";
import { hitDiceAvailable } from "./sheetUtils";

interface RestDialogProps {
  classes: ActorClassEntry[];
  constitutionModifier: number;
  selections: Record<string, number>;
  shortRestChoices?: ProgressionChoiceGroupDef[];
  shortRestChoiceSelections?: Record<string, string[]>;
  onChangeChoice?: (groupId: string, optionIds: string[]) => void;
  onChange: (classId: string, nextValue: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function RestDialog({
  classes,
  constitutionModifier,
  selections,
  shortRestChoices = [],
  shortRestChoiceSelections = {},
  onChangeChoice,
  onChange,
  onCancel,
  onConfirm
}: RestDialogProps) {
  return (
    <ModalFrame
      onClose={onCancel}
      backdropClassName="bg-black/70 backdrop-blur-sm"
      panelClassName="max-w-2xl rounded-xl border border-amber-500/30 bg-slate-950/98 text-zinc-100 shadow-[0_24px_80px_rgba(0,0,0,0.8)]"
    >
      <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5 bg-gradient-to-r from-amber-500/[0.08] to-transparent">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-400">Short Rest</p>
          </div>
          <h3 className="mt-1 font-serif text-2xl font-bold text-amber-50">Spend Hit Dice</h3>
          <p className="mt-1 max-w-xl text-xs text-zinc-400 leading-relaxed">
            Choose how many hit dice to spend. Each die restores rolled hit points + your Constitution modifier (
            {constitutionModifier >= 0 ? `+${constitutionModifier}` : constitutionModifier}).
          </p>
        </div>
        <SheetButton variant="ghost" size="sm" icon={<X size={16} />} onClick={onCancel}>
          Close
        </SheetButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-4">
        <div className="space-y-2.5">
          {classes.map((entry) => {
            const available = hitDiceAvailable(entry);
            const currentValue = selections[entry.id] ?? 0;

            return (
              <div key={entry.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/70 p-3.5">
                <div>
                  <h4 className="text-sm font-semibold text-amber-50">{entry.name}</h4>
                  <p className="text-xs text-zinc-400">
                    <span className="font-semibold text-amber-300">d{entry.hitDieFaces}</span> Hit Die •{" "}
                    <span className="font-semibold text-zinc-200">{available}</span> available
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-white/15 bg-slate-950 text-zinc-200 transition hover:border-amber-500/70 hover:bg-slate-800 hover:text-amber-50 disabled:opacity-40"
                    disabled={currentValue <= 0}
                    onClick={() => onChange(entry.id, currentValue - 1)}
                  >
                    <Minus size={13} />
                  </button>
                  <span className="w-8 text-center text-base font-bold text-amber-300">{currentValue}</span>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-white/15 bg-slate-950 text-zinc-200 transition hover:border-amber-500/70 hover:bg-slate-800 hover:text-amber-50 disabled:opacity-40"
                    disabled={currentValue >= available}
                    onClick={() => onChange(entry.id, currentValue + 1)}
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            );
          })}

          {classes.length === 0 && (
            <div className="rounded-md border border-white/10 bg-slate-900/40 p-4 text-xs text-zinc-400 italic">
              No class hit dice are available for this actor.
            </div>
          )}
        </div>

        {shortRestChoices.length > 0 ? (
          <div className="space-y-3 rounded-lg border border-amber-500/20 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Short Rest Selections</p>
              <span className="text-[11px] text-zinc-400">Swappable on Short Rest</span>
            </div>
            {shortRestChoices.map((group) => {
              const selected = shortRestChoiceSelections[group.id] ?? [];
              return (
                <div key={group.id} className="space-y-2 border-t border-white/8 pt-3">
                  <p className="text-xs font-semibold text-amber-100">{group.title}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {group.options.map((opt) => {
                      const isSelected = selected.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            if (group.choose === 1) {
                              onChangeChoice?.(group.id, [opt.id]);
                            } else {
                              const next = isSelected
                                ? selected.filter((id) => id !== opt.id)
                                : [...selected, opt.id].slice(0, group.choose);
                              onChangeChoice?.(group.id, next);
                            }
                          }}
                          className={`flex items-center justify-between rounded-md border p-2.5 text-xs font-medium transition ${
                            isSelected
                              ? "border-amber-500 bg-amber-500/20 text-amber-100 font-semibold"
                              : "border-white/10 bg-slate-950/60 text-zinc-300 hover:border-white/20 hover:bg-slate-900"
                          }`}
                        >
                          <span>{opt.name}</span>
                          {isSelected ? <Check size={13} className="text-amber-400" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-white/8 px-6 py-4">
        <div className="inline-flex items-center gap-2 text-xs text-zinc-400">
          <Heart size={13} className="text-rose-400" />
          Short-rest resources will be restored on confirm.
        </div>
        <div className="flex items-center gap-2.5">
          <SheetButton variant="secondary" size="md" onClick={onCancel}>
            Cancel
          </SheetButton>
          <SheetButton variant="primary" size="md" onClick={onConfirm}>
            Complete Rest
          </SheetButton>
        </div>
      </div>
    </ModalFrame>
  );
}
