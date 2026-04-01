import { Plus, X } from "lucide-react";

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
  onChooseSpells,
  onClose,
  onConfirm,
  renderText
}: LongRestDialogProps) {
  return (
    <ModalFrame onClose={onClose} backdropClassName="bg-black/70" panelClassName="max-w-3xl border-white/10 bg-slate-950 text-zinc-100">
      <>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-amber-400/80">Long Rest</p>
            <h3 className="mt-2 font-serif text-2xl text-amber-50">Recover and Prepare</h3>
            <p className="mt-2 text-sm text-zinc-400">Confirm hit point recovery, spell slot recovery, hit dice recovery, and any long-rest spell preparation changes.</p>
          </div>
          <button type="button" className={secondaryButtonClass} onClick={onClose}>
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
                <p className="text-sm text-zinc-400">{longRestPreparedSpells.length}/{preparedSpellLimit || preparableSpellCount}</p>
              </div>
              <div className="flex justify-end">
                <button type="button" className={secondaryButtonClass} onClick={onChooseSpells}>
                  <Plus size={14} />
                  Choose Spells
                </button>
              </div>
              <div className="border border-white/8 bg-black/20 p-3">
                <DetailCollection entries={longRestPreparedSpellRows} emptyMessage="No spells selected for the long rest yet." renderText={renderText} />
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex justify-end gap-3 border-t border-white/8 px-5 py-4">
          <button type="button" className={secondaryButtonClass} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="border border-amber-500 bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400" onClick={onConfirm}>
            Complete Rest
          </button>
        </div>
      </>
    </ModalFrame>
  );
}
