import { Check, Plus, X } from "lucide-react";

import type { ProgressionChoiceGroupDef } from "@shared/data/progression";
import { ModalFrame } from "../../../components/ModalFrame";
import type { PlayerNpcSheetDerivedState } from "../hooks/usePlayerNpcSheetDerived";
import type { DetailRowEntry } from "../playerNpcSheet2024Types";
import { DetailCollection, StatChip, secondaryButtonClass } from "./sheetPrimitives";

interface LongRestDialogProps {
  canPrepareSpells: boolean;
  preparedSpellLimit: number;
  preparableSpellCount: number;
  longRestPreparedSpells: string[];
  hitPointDisplay: PlayerNpcSheetDerivedState["hitPointDisplay"];
  longRestPreparedSpellRows: DetailRowEntry[];
  longRestChoices?: ProgressionChoiceGroupDef[];
  longRestChoiceSelections?: Record<string, string[]>;
  onChangeChoice?: (groupId: string, optionIds: string[]) => void;
  onChooseSpells: () => void;
  onClose: () => void;
  onConfirm: () => void;
  renderText: (text: string) => React.ReactNode;
}

export function LongRestDialog({
  canPrepareSpells,
  preparedSpellLimit,
  preparableSpellCount,
  longRestPreparedSpells,
  hitPointDisplay,
  longRestPreparedSpellRows,
  longRestChoices = [],
  longRestChoiceSelections = {},
  onChangeChoice,
  onChooseSpells,
  onClose,
  onConfirm,
  renderText
}: LongRestDialogProps) {
  return (
    <ModalFrame onClose={onClose} backdropClassName="bg-black/70" panelClassName="max-w-3xl border-white/10 bg-slate-950 text-zinc-100">
      <>
        <div className="flex items-start justify-between gap-3 border-b border-white/8 px-6 py-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-amber-400/80">Long Rest</p>
            <h3 className="mt-2 font-serif text-2xl text-amber-50">Recover and Prepare</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Confirm hit point recovery, spell slot recovery, hit dice recovery, long-rest choices, and spell preparation.
            </p>
          </div>
          <button type="button" className={secondaryButtonClass} onClick={onClose}>
            <X size={14} />
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <StatChip label="HP" value={`${hitPointDisplay.current}/${hitPointDisplay.effectiveMax}`} />
            <StatChip label="Spell Slots" value="Reset" />
            <StatChip label="Hit Dice" value="Recover Half" />
          </div>

          {longRestChoices.length > 0 ? (
            <div className="space-y-4 rounded border border-amber-500/20 bg-amber-950/10 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">Long Rest Selections</p>
                <span className="text-xs text-zinc-400">Swappable on Long Rest</span>
              </div>
              {longRestChoices.map((group) => {
                const selected = longRestChoiceSelections[group.id] ?? [];
                return (
                  <div key={group.id} className="space-y-2 border-t border-amber-500/10 pt-3">
                    <p className="text-sm font-medium text-amber-100">{group.title}</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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

          {canPrepareSpells ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase tracking-[0.2em] text-amber-300/80">Prepared Spells</p>
                <p className="text-sm text-zinc-400">
                  {longRestPreparedSpells.length}/{preparedSpellLimit || preparableSpellCount}
                </p>
              </div>
              <div className="flex justify-end">
                <button type="button" className={secondaryButtonClass} onClick={onChooseSpells}>
                  <Plus size={14} />
                  Choose Spells
                </button>
              </div>
              <div className="border border-white/8 bg-black/20 p-3">
                <DetailCollection
                  entries={longRestPreparedSpellRows}
                  emptyMessage="No spells selected for the long rest yet."
                  renderText={renderText}
                />
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex justify-end gap-3 border-t border-white/8 px-6 py-4">
          <button type="button" className={secondaryButtonClass} onClick={onClose}>
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
      </>
    </ModalFrame>
  );
}
