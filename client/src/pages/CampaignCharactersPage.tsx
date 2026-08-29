import type { ActorSheet, CampaignSnapshot, MemberRole } from "@shared/types";
import { ArrowLeft, Edit3, Plus, ScrollText, Search, Sparkles, Swords, Trash2, Users } from "lucide-react";
import { memo, useMemo, useState } from "react";

import { CharacterSheet } from "../components/CharacterSheet";
import { WorkspaceModal } from "../components/WorkspaceModal";
import { inputClass, SheetButton } from "../features/sheet/components/sheetPrimitives";
import { abilityModifier, abilityOrder, formatModifier } from "../features/sheet/sheetUtils";
import { resolveAssetUrl } from "../lib/assets";
import { createClientActorDraft } from "../lib/drafts";

export interface CampaignCharactersPageProps {
  token: string;
  campaign: CampaignSnapshot["campaign"];
  compendium: CampaignSnapshot["compendium"];
  role: MemberRole;
  currentUserId: string;
  onOpenBoard: () => void;
  onOpenEdit: (actorId: string) => void;
  onOpenLevelUp: (actorId: string) => void;
  onCreateCharacter: (draft: ActorSheet) => Promise<void>;
  onDeleteCharacter: (actor: ActorSheet) => void;
  onRoll: (notation: string, label: string, actor?: ActorSheet | null) => Promise<void>;
  onSaveActor: (actor: ActorSheet) => Promise<void>;
}

export function CampaignCharactersPageComponent({
  token,
  campaign,
  compendium,
  role,
  currentUserId,
  onOpenBoard,
  onOpenEdit,
  onOpenLevelUp,
  onCreateCharacter,
  onDeleteCharacter,
  onRoll,
  onSaveActor
}: CampaignCharactersPageProps) {
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<"all" | "mine">("all");
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState("");
  const [previewActor, setPreviewActor] = useState<ActorSheet | null>(null);

  const characterActors = useMemo(
    () => campaign.actors.filter((actor) => actor.kind === "character" || actor.kind === "npc"),
    [campaign.actors]
  );

  const visibleCharacters = useMemo(() => {
    return characterActors.filter((actor) => {
      const isOwner = actor.ownerId === currentUserId;
      const canView = role === "dm" || isOwner || actor.sheetAccess === "full";

      if (!canView) {
        return false;
      }

      if (ownerFilter === "mine" && !isOwner) {
        return false;
      }

      if (!search.trim()) {
        return true;
      }

      const query = search.toLowerCase();
      const matchName = actor.name.toLowerCase().includes(query);
      const matchClass = (actor.classes?.map((c) => c.name).join(" ") || actor.className || "").toLowerCase().includes(query);
      const matchSpecies = (actor.species || "").toLowerCase().includes(query);

      return matchName || matchClass || matchSpecies;
    });
  }, [characterActors, currentUserId, ownerFilter, role, search]);

  const userCharacterCount = useMemo(
    () => characterActors.filter((actor) => actor.ownerId === currentUserId).length,
    [characterActors, currentUserId]
  );

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-950 px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
              <button
                type="button"
                onClick={onOpenBoard}
                className="inline-flex items-center gap-1 text-zinc-400 transition hover:text-amber-300"
              >
                <ArrowLeft size={14} />
                <span>Battle Map</span>
              </button>
              <span>•</span>
              <span>{campaign.name}</span>
            </div>
            <h1 className="font-serif text-3xl font-bold tracking-tight text-amber-50 sm:text-4xl">Campaign Characters</h1>
            <p className="text-sm text-zinc-400">
              {role === "dm"
                ? `Managing ${characterActors.length} total character${characterActors.length === 1 ? "" : "s"} in this campaign.`
                : `You own ${userCharacterCount} character${userCharacterCount === 1 ? "" : "s"} in this campaign.`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <SheetButton variant="secondary" size="md" icon={<Swords size={16} />} onClick={onOpenBoard}>
              Enter Board
            </SheetButton>
            <SheetButton variant="primary" size="md" icon={<Plus size={16} />} onClick={() => setCreatorOpen(true)}>
              New Character
            </SheetButton>
          </div>
        </header>

        {/* SEARCH & FILTERS */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative min-w-[280px] flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              className={`${inputClass} pl-9`}
              placeholder="Search by name, species, or class…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {role === "dm" ? (
            <div className="inline-flex items-center rounded-lg border border-white/10 bg-slate-900/90 p-0.5">
              <button
                type="button"
                onClick={() => setOwnerFilter("all")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  ownerFilter === "all"
                    ? "border border-amber-500/40 bg-amber-500/20 text-amber-300 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                All Characters ({characterActors.length})
              </button>
              <button
                type="button"
                onClick={() => setOwnerFilter("mine")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  ownerFilter === "mine"
                    ? "border border-amber-500/40 bg-amber-500/20 text-amber-300 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                My Characters ({userCharacterCount})
              </button>
            </div>
          ) : null}
        </div>

        {/* CHARACTER LIST */}
        {visibleCharacters.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-slate-900/40 p-12 text-center">
            <Users size={32} className="mx-auto text-zinc-500" />
            <h3 className="mt-3 font-serif text-lg font-bold text-amber-100">No Characters Found</h3>
            <p className="mt-1 text-sm text-zinc-400">
              {search ? "No characters match your search filters." : "Create your first character to begin playing."}
            </p>
            <div className="mt-4">
              <SheetButton variant="primary" size="md" icon={<Plus size={16} />} onClick={() => setCreatorOpen(true)}>
                Create Character
              </SheetButton>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCharacters.map((actor) => {
              const isOwner = actor.ownerId === currentUserId;
              const canEdit = role === "dm" || isOwner;
              const classSummary = actor.classes?.map((c) => `${c.name} ${c.level}`).join(" / ") || actor.className || "Level 1 Adventurer";
              const totalLevel = actor.classes?.reduce((acc, c) => acc + (c.level || 0), 0) || 1;

              return (
                <article
                  key={actor.id}
                  className="group flex flex-col justify-between overflow-hidden rounded-xl border border-amber-500/20 bg-slate-950/90 shadow-[0_12px_40px_rgba(0,0,0,0.5)] transition hover:border-amber-500/50 hover:shadow-[0_16px_50px_rgba(245,158,11,0.08)]"
                >
                  {/* CARD HEADER */}
                  <div className="p-5 space-y-4">
                    <div className="flex items-start gap-3.5">
                      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-amber-500/40 bg-slate-900 shadow-md">
                        {actor.imageUrl ? (
                          <img src={resolveAssetUrl(actor.imageUrl)} alt={actor.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="font-serif text-lg font-bold text-amber-200">{actor.name.slice(0, 2).toUpperCase()}</span>
                        )}
                        <span className="absolute bottom-0 right-0 rounded-tl-md bg-amber-500 px-1 text-[9px] font-bold text-slate-950">
                          {totalLevel}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="truncate font-serif text-xl font-bold text-amber-50 group-hover:text-amber-200 transition">
                            {actor.name}
                          </h2>
                          {canEdit ? (
                            <button
                              type="button"
                              className="text-zinc-500 hover:text-rose-400 transition"
                              title="Delete Character"
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete ${actor.name}?`)) {
                                  onDeleteCharacter(actor);
                                }
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          ) : null}
                        </div>
                        <p className="truncate text-xs font-semibold text-amber-400/90">{classSummary}</p>
                        <p className="truncate text-[11px] text-zinc-400">
                          {actor.species ?? "Unknown Species"} • {actor.background ?? "No Background"}
                        </p>
                      </div>
                    </div>

                    {/* VITALS RIBBON */}
                    <div className="grid grid-cols-4 gap-1.5 rounded-lg border border-white/8 bg-slate-900/60 p-2 text-center">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">HP</p>
                        <p className="mt-0.5 text-xs font-bold text-emerald-300">
                          {actor.hitPoints?.current ?? 0}/{actor.hitPoints?.max ?? 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">AC</p>
                        <p className="mt-0.5 text-xs font-bold text-amber-200">{actor.armorClass ?? 10}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Speed</p>
                        <p className="mt-0.5 text-xs font-bold text-zinc-200">{actor.speed ?? 30}ft</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Init</p>
                        <p className="mt-0.5 text-xs font-bold text-zinc-200">
                          {actor.initiative >= 0 ? `+${actor.initiative}` : actor.initiative}
                        </p>
                      </div>
                    </div>

                    {/* ABILITIES CHIPS */}
                    <div className="grid grid-cols-6 gap-1 text-center">
                      {abilityOrder.map((entry) => {
                        const score = actor.abilities[entry.key] ?? 10;
                        const mod = abilityModifier(score);
                        return (
                          <div key={entry.key} className="rounded border border-white/6 bg-slate-900/40 py-1">
                            <p className="text-[8px] font-semibold uppercase text-zinc-400">{entry.label}</p>
                            <p className="text-[10px] font-bold text-amber-100">{formatModifier(mod)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* CARD ACTIONS */}
                  <div className="flex items-center justify-between gap-2 border-t border-white/8 bg-slate-950/80 p-3.5">
                    <SheetButton variant="secondary" size="sm" icon={<ScrollText size={14} />} onClick={() => setPreviewActor(actor)}>
                      Play Sheet
                    </SheetButton>

                    {canEdit ? (
                      <div className="flex items-center gap-2">
                        <SheetButton variant="magical" size="sm" icon={<Sparkles size={14} />} onClick={() => onOpenLevelUp(actor.id)}>
                          Level Up
                        </SheetButton>
                        <SheetButton variant="primary" size="sm" icon={<Edit3 size={14} />} onClick={() => onOpenEdit(actor.id)}>
                          Edit
                        </SheetButton>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* TACTICAL PLAY SHEET POPUP */}
      {previewActor ? (
        <WorkspaceModal title={`${previewActor.name} Sheet`} size="wide" onClose={() => setPreviewActor(null)}>
          <CharacterSheet
            token={token}
            actor={previewActor}
            compendium={compendium}
            allowedSourceBooks={campaign.allowedSourceBooks}
            role={role}
            currentUserId={currentUserId}
            sheetContext="board"
            onSave={onSaveActor}
            onRoll={onRoll}
            onNavigateToEdit={() => {
              const actorId = previewActor.id;
              setPreviewActor(null);
              onOpenEdit(actorId);
            }}
            onNavigateToLevelUp={() => {
              const actorId = previewActor.id;
              setPreviewActor(null);
              onOpenLevelUp(actorId);
            }}
          />
        </WorkspaceModal>
      ) : null}

      {/* CREATE CHARACTER MODAL */}
      {creatorOpen ? (
        <WorkspaceModal title="Create New Character" size="compact" onClose={() => setCreatorOpen(false)}>
          <form
            className="space-y-4 p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newCharacterName.trim()) return;
              const draft = createClientActorDraft("character", currentUserId);
              draft.name = newCharacterName.trim();
              await onCreateCharacter(draft);
              setCreatorOpen(false);
              setNewCharacterName("");
            }}
          >
            <div>
              <label htmlFor="char-name-input" className="block text-xs font-semibold uppercase tracking-wider text-amber-300">
                Character Name
              </label>
              <input
                id="char-name-input"
                type="text"
                className={`mt-1.5 ${inputClass}`}
                placeholder="e.g. Valerius the Bold"
                value={newCharacterName}
                onChange={(e) => setNewCharacterName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/8">
              <SheetButton variant="secondary" size="md" onClick={() => setCreatorOpen(false)}>
                Cancel
              </SheetButton>
              <SheetButton variant="primary" size="md" type="submit" disabled={!newCharacterName.trim()}>
                Create Character
              </SheetButton>
            </div>
          </form>
        </WorkspaceModal>
      ) : null}
    </main>
  );
}

export const CampaignCharactersPage = memo(CampaignCharactersPageComponent);
