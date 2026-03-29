import { Heart, Minus, Plus, X } from "lucide-react";

import type { ActorClassEntry } from "@shared/types";

import { hitDiceAvailable } from "./sheetUtils";

interface RestDialogProps {
  classes: ActorClassEntry[];
  constitutionModifier: number;
  selections: Record<string, number>;
  onChange: (classId: string, nextValue: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function RestDialog({ classes, constitutionModifier, selections, onChange, onCancel, onConfirm }: RestDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl border border-amber-700/60 bg-zinc-950 shadow-[0_0_50px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between border-b border-amber-800/40 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-amber-400/80">Short Rest</p>
            <h3 className="mt-2 text-2xl font-semibold text-amber-50">Spend Hit Dice</h3>
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

        <div className="space-y-3 px-6 py-6">
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
      </div>
    </div>
  );
}
