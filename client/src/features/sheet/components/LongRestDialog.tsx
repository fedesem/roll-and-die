import type { ProgressionChoiceGroupDef } from "@shared/data/progression";
import { Check, Plus, Sparkles, X } from "lucide-react";
import { ModalFrame } from "../../../components/ModalFrame";
import type { PlayerNpcSheetDerivedState } from "../hooks/usePlayerNpcSheetDerived";
import type { DetailRowEntry } from "../playerNpcSheet2024Types";
import { DetailCollection, SheetButton, StatChip } from "./sheetPrimitives";

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
    <ModalFrame
      onClose={onClose}
      backdropClassName="bg-black/70 backdrop-blur-sm"
      panelClassName="max-w-3xl rounded-xl border border-amber-500/30 bg-slate-950/98 text-zinc-100 shadow-[0_24px_80px_rgba(0,0,0,0.8)]"
    >
      <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5 bg-gradient-to-r from-amber-500/[0.08] to-transparent">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-400">Long Rest</p>
          </div>
          <h3 className="mt-1 font-serif text-2xl font-bold text-amber-50">Recover and Prepare</h3>
          <p className="mt-1 text-xs text-zinc-400">
            Confirm hit point recovery, spell slot recovery, hit dice recovery, long-rest choices, and spell preparation.
          </p>
        </div>
        <SheetButton variant="ghost" size="sm" icon={<X size={16} />} onClick={onClose}>
          Close
        </SheetButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <StatChip label="HP Restored" value={`${hitPointDisplay.current}/${hitPointDisplay.effectiveMax}`} />
          <StatChip label="Spell Slots" value="Fully Reset" />
          <StatChip label="Hit Dice" value="Recover Half" />
        </div>

        {longRestChoices.length > 0 ? (
          <div className="space-y-3 rounded-lg border border-amber-500/20 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Long Rest Selections</p>
              <span className="text-[11px] text-zinc-400">Swappable on Long Rest</span>
            </div>
            {longRestChoices.map((group) => {
              const selected = longRestChoiceSelections[group.id] ?? [];
              return (
                <div key={group.id} className="space-y-2 border-t border-white/8 pt-3">
                  <p className="text-xs font-semibold text-amber-100">{group.title}</p>
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

        {canPrepareSpells ? (
          <div className="space-y-3 rounded-lg border border-white/10 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Prepared Spells</p>
                <p className="text-xs text-zinc-400">
                  <span className="font-semibold text-amber-300">{longRestPreparedSpells.length}</span> /{" "}
                  {preparedSpellLimit || preparableSpellCount} prepared
                </p>
              </div>
              <SheetButton variant="secondary" size="sm" icon={<Plus size={13} />} onClick={onChooseSpells}>
                Choose Spells
              </SheetButton>
            </div>
            <div className="rounded-md border border-white/8 bg-slate-950/60 p-3">
              <DetailCollection
                entries={longRestPreparedSpellRows}
                emptyMessage="No spells selected for the long rest yet."
                renderText={renderText}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex justify-end gap-2.5 border-t border-white/8 px-6 py-4">
        <SheetButton variant="secondary" size="md" onClick={onClose}>
          Cancel
        </SheetButton>
        <SheetButton variant="primary" size="md" onClick={onConfirm}>
          Complete Long Rest
        </SheetButton>
      </div>
    </ModalFrame>
  );
}
