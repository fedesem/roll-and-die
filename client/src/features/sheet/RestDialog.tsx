import { Check, Heart, Minus, Plus, X } from "lucide-react";

import type { ProgressionChoiceGroupDef } from "@shared/data/progression";
import type { ActorClassEntry } from "@shared/types";

import { ModalFrame } from "../../components/ModalFrame";
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
      backdropClassName="bg-black/70"
      panelClassName="max-w-2xl border-amber-700/60 bg-zinc-950 shadow-[0_0_50px_rgba(0,0,0,0.55)]"
    >
      <>
        <div className="flex items-start justify-between border-b border-amber-800/40 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-amber-400/80">Short Rest</p>
            <h3 className="mt-2 text-2xl font-semibold text-amber-50">Spend Hit Dice & Short Rest Choices</h3>
            <p className="mt-2 max-w-xl text-sm text-zinc-400">
              Choose how many hit dice to spend. Each die restores hit points and adds your Constitution modifier (
              {constitutionModifier >= 0 ? `+${constitutionModifier}` : constitutionModifier}).
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center border border-amber-800/60 text-zinc-300 transition hover:bg-zinc-900 hover:text-amber-50"
            onClick={onCancel}
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6 space-y-6">
          <div className="space-y-3">
            {classes.map((entry) => {
              const available = hitDiceAvailable(entry);
              const currentValue = selections[entry.id] ?? 0;

              return (
                <div key={entry.id} className="flex items-center justify-between border border-amber-800/40 bg-zinc-900/80 px-4 py-4">
                  <div>
                    <h4 className="text-lg font-medium text-amber-50">{entry.name}</h4>
                    <p className="mt-1 text-sm text-zinc-400">
                      d{entry.hitDieFaces} • {available} available
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center border border-zinc-700 text-zinc-200 transition hover:border-amber-700/70 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={currentValue <= 0}
                      onClick={() => onChange(entry.id, currentValue - 1)}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-lg font-semibold text-amber-50">{currentValue}</span>
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center border border-zinc-700 text-zinc-200 transition hover:border-amber-700/70 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={currentValue >= available}
                      onClick={() => onChange(entry.id, currentValue + 1)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            {classes.length === 0 && (
              <div className="border border-amber-800/40 bg-zinc-900/60 px-4 py-6 text-sm text-zinc-400">
                No class hit dice are available for this actor.
              </div>
            )}
          </div>

          {shortRestChoices.length > 0 ? (
            <div className="space-y-4 rounded border border-amber-500/20 bg-amber-950/10 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">Short Rest Selections</p>
                <span className="text-xs text-zinc-400">Swappable on Short Rest</span>
              </div>
              {shortRestChoices.map((group) => {
                const selected = shortRestChoiceSelections[group.id] ?? [];
                return (
                  <div key={group.id} className="space-y-2 border-t border-amber-500/10 pt-3">
                    <p className="text-sm font-medium text-amber-100">{group.title}</p>
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
                            className={`flex items-center justify-between rounded border px-3 py-2 text-xs font-medium transition ${
                              isSelected
                                ? "border-amber-500 bg-amber-500/20 text-amber-200"
                                : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                            }`}
                          >
                            <span>{opt.name}</span>
                            {isSelected ? <Check size={12} className="text-amber-400" /> : null}
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

        <div className="flex items-center justify-between border-t border-amber-800/40 px-6 py-5">
          <div className="inline-flex items-center gap-2 text-sm text-zinc-400">
            <Heart size={14} className="text-red-400" />
            Resources that recover on a short rest will be refreshed on confirm.
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:border-amber-700/70 hover:text-amber-50"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="border border-amber-500 bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400"
              onClick={onConfirm}
            >
              Complete Rest
            </button>
          </div>
        </div>
      </>
    </ModalFrame>
  );
}
