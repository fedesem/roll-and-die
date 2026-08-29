import type { ActorSheet, CampaignSnapshot, MemberRole } from "@shared/types";
import { ArrowLeft, Check, RotateCcw, Save, Sparkles } from "lucide-react";
import { memo, useDeferredValue, useMemo } from "react";

import { RulesText } from "../components/admin/AdminPreview";
import { PlayerNpcSheetEditTab } from "../features/sheet/components/PlayerNpcSheetEditTab";
import { SheetButton } from "../features/sheet/components/sheetPrimitives";
import { useGuidedSheetFlow } from "../features/sheet/hooks/useGuidedSheetFlow";
import { usePlayerNpcSheetController } from "../features/sheet/hooks/usePlayerNpcSheetController";
import { usePlayerNpcSheetDerived } from "../features/sheet/hooks/usePlayerNpcSheetDerived";
import { cloneActor } from "../features/sheet/sheetUtils";

export interface CharacterEditPageProps {
  token: string;
  actor: ActorSheet;
  compendium: CampaignSnapshot["compendium"];
  allowedSourceBooks: string[];
  role: MemberRole;
  currentUserId: string;
  onBack: () => void;
  onOpenLevelUp: (actorId: string) => void;
  onSave: (actor: ActorSheet) => Promise<void>;
  onRoll: (notation: string, label: string) => Promise<void>;
}

export function CharacterEditPageComponent({
  token,
  actor,
  compendium,
  allowedSourceBooks,
  role,
  currentUserId,
  onBack,
  onOpenLevelUp,
  onSave,
  onRoll
}: CharacterEditPageProps) {
  const controller = usePlayerNpcSheetController({
    token,
    actor,
    compendium,
    allowedSourceBooks,
    role,
    currentUserId,
    sheetContext: "campaign",
    onSave,
    onRoll
  });

  const { state, mutators, actions } = controller;
  const deferredDraft = useDeferredValue(state.draft);
  const deferredLongRestPreparedSpells = useDeferredValue(state.longRestPreparedSpells);

  const { permissions, derived } = usePlayerNpcSheetDerived({
    draft: deferredDraft,
    compendium,
    role,
    currentUserId,
    sheetContext: "campaign",
    longRestPreparedSpells: deferredLongRestPreparedSpells
  });

  const guided = useGuidedSheetFlow({
    actor,
    draft: state.draft,
    compendium,
    filteredFeats: derived.filteredFeats,
    updateDraft: mutators.updateDraft,
    setActiveTab: actions.setActiveTab
  });

  const isDirty = useMemo(() => {
    return JSON.stringify(state.draft) !== JSON.stringify(actor);
  }, [actor, state.draft]);

  const renderRulesText = useMemo(
    () => (text: string) => (
      <RulesText
        text={text}
        spellEntries={compendium.spells}
        featEntries={compendium.feats}
        classEntries={compendium.classes}
        variantRuleEntries={compendium.variantRules}
        conditionEntries={compendium.conditions}
        itemEntries={compendium.items}
        optionalFeatureEntries={compendium.optionalFeatures}
        languageEntries={compendium.languages}
        skillEntries={compendium.skills}
        raceEntries={compendium.races}
        backgroundEntries={compendium.backgrounds}
        monsterEntries={[]}
      />
    ),
    [compendium]
  );

  const totalLevel = state.draft.classes?.reduce((acc, c) => acc + (c.level || 0), 0) || 1;

  return (
    <div className="min-h-screen bg-slate-950 text-zinc-100 pb-16">
      {/* STICKY TOP ACTION BAR */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-amber-500/20 bg-slate-950/90 px-4 py-3.5 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-amber-500/40 hover:bg-slate-800 hover:text-amber-100"
          >
            <ArrowLeft size={14} />
            <span>Characters</span>
          </button>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-center gap-2">
            <h1 className="font-serif text-lg font-bold text-amber-50 truncate max-w-[200px] sm:max-w-xs">{state.draft.name}</h1>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              Level {totalLevel}
            </span>
          </div>

          {isDirty ? (
            <span className="hidden sm:inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30">
              Unsaved Changes
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500">
              <Check size={12} className="text-emerald-400" />
              All saved
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <SheetButton variant="magical" size="sm" icon={<Sparkles size={14} />} onClick={() => onOpenLevelUp(actor.id)}>
            Level Up Wizard
          </SheetButton>

          {isDirty ? (
            <SheetButton
              variant="secondary"
              size="sm"
              icon={<RotateCcw size={14} />}
              onClick={() => mutators.updateDraft(() => cloneActor(actor))}
            >
              Reset
            </SheetButton>
          ) : null}

          <SheetButton
            variant="primary"
            size="sm"
            icon={<Save size={14} />}
            disabled={state.saving || !isDirty}
            onClick={() => void actions.saveCurrent()}
          >
            {state.saving ? "Saving…" : "Save Changes"}
          </SheetButton>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <PlayerNpcSheetEditTab
          draft={state.draft}
          compendium={compendium}
          derived={{ ...derived, saving: state.saving, imageError: state.imageError }}
          permissions={permissions}
          mutators={mutators}
          actions={actions}
          guided={guided}
          renderRulesText={renderRulesText}
        />
      </main>
    </div>
  );
}

export const CharacterEditPage = memo(CharacterEditPageComponent);
