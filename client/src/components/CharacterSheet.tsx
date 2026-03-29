import { ImagePlus, ScrollText, Shield } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";

import type { ActorCreatureSize, ActorSheet, CompendiumData, MemberRole } from "@shared/types";
import { CREATURE_SIZE_OPTIONS } from "@shared/tokenGeometry";

import { PlayerNpcSheet } from "../features/sheet/PlayerNpcSheet";
import { cloneActor } from "../features/sheet/sheetUtils";
import { resolveAssetUrl } from "../lib/assets";
import { uploadImageAsset } from "../services/assetService";

interface CharacterSheetProps {
  token: string;
  actor?: ActorSheet | null;
  compendium: Pick<CompendiumData, "spells" | "feats" | "classes">;
  role: MemberRole;
  currentUserId: string;
  onSave: (actor: ActorSheet) => Promise<void>;
  onRoll: (notation: string, label: string, actor?: ActorSheet | null) => Promise<void>;
}

export function CharacterSheet({ token, actor, compendium, role, currentUserId, onSave, onRoll }: CharacterSheetProps) {
  const [draft, setDraft] = useState<ActorSheet | null>(actor ? cloneActor(actor) : null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(actor ? cloneActor(actor) : null);
    setImageError(null);
    setSaving(false);
  }, [actor]);

  const canView = useMemo(() => {
    if (!actor) {
      return false;
    }

    return role === "dm" || actor.sheetAccess === "full" || actor.ownerId === currentUserId;
  }, [actor, currentUserId, role]);

  const canEdit = useMemo(() => {
    if (!actor) {
      return false;
    }

    return role === "dm" || actor.ownerId === currentUserId;
  }, [actor, currentUserId, role]);

  if (!actor || !draft) {
    return (
      <section className="border border-amber-800/40 bg-zinc-950 px-6 py-8 text-zinc-200">
        <h2 className="text-2xl font-semibold text-amber-50">Interactive Sheet</h2>
        <p className="mt-3 text-sm text-zinc-400">Select a character, NPC, monster, or static actor to open its sheet.</p>
      </section>
    );
  }

  if (!canView) {
    return (
      <section className="border border-amber-800/40 bg-zinc-950 px-6 py-8 text-zinc-200">
        <h2 className="text-2xl font-semibold text-amber-50">Sheet Locked</h2>
        <p className="mt-3 text-sm text-zinc-400">
          Players can only open sheets for actors they own. The DM can open every sheet in the campaign.
        </p>
      </section>
    );
  }

  if (draft.kind === "character" || draft.kind === "npc") {
    return (
      <PlayerNpcSheet
        token={token}
        actor={draft}
        compendium={compendium}
        role={role}
        currentUserId={currentUserId}
        onSave={onSave}
        onRoll={(notation, label) => onRoll(notation, label, actor)}
      />
    );
  }

  return (
    <SimpleActorSheet
      token={token}
      actor={draft}
      canEdit={canEdit}
      saving={saving}
      imageError={imageError}
      onDraftChange={setDraft}
      onImageError={setImageError}
      onSave={async (nextActor) => {
        setSaving(true);

        try {
          await onSave(nextActor);
        } finally {
          setSaving(false);
        }
      }}
    />
  );
}

interface SimpleActorSheetProps {
  token: string;
  actor: ActorSheet;
  canEdit: boolean;
  saving: boolean;
  imageError: string | null;
  onDraftChange: (actor: ActorSheet) => void;
  onImageError: (message: string | null) => void;
  onSave: (actor: ActorSheet) => Promise<void>;
}

function SimpleActorSheet({ token, actor, canEdit, saving, imageError, onDraftChange, onImageError, onSave }: SimpleActorSheetProps) {
  const isStaticActor = actor.kind === "static";
  const isCreatureActor = !isStaticActor;

  function updateField<K extends keyof ActorSheet>(key: K, value: ActorSheet[K]) {
    onDraftChange({
      ...actor,
      [key]: value
    });
  }

  function updateStaticDimension(key: "tokenWidthSquares" | "tokenLengthSquares", value: string) {
    const nextValue = Math.max(1, Math.min(12, Math.round(Number(value || 1))));
    updateField(key, nextValue);
  }

  function updateCreatureSize(value: string) {
    updateField("creatureSize", value as ActorCreatureSize);
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const { url: imageUrl } = await uploadImageAsset(token, "actors", file);
      onImageError(null);
      updateField("imageUrl", imageUrl);
    } catch (error) {
      console.error(error);
      onImageError("Unable to read the selected image.");
    }
  }

  return (
    <section className="space-y-4 bg-[#0b0b0d] text-zinc-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-amber-800/40 bg-zinc-950 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-amber-400/80">
            {actor.kind === "monster" ? "Monster Sheet" : "Static Actor"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-amber-50">{actor.name}</h2>
        </div>
        {canEdit && (
          <button
            type="button"
            className="inline-flex items-center gap-2 border border-amber-800/50 px-3 py-2 text-sm text-zinc-200 transition hover:border-amber-600/70 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={saving}
            onClick={() => void onSave(actor)}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr,1.4fr]">
        <article className="space-y-4 border border-amber-800/40 bg-zinc-950 p-4">
          <header className="flex items-center gap-2 border-b border-amber-800/30 pb-3">
            <Shield size={16} className="text-amber-400" />
            <p className="text-xs uppercase tracking-[0.28em] text-amber-400/80">Overview</p>
          </header>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Name">
              <input
                className={inputClass}
                value={actor.name}
                disabled={!canEdit}
                onChange={(event) => updateField("name", event.target.value)}
              />
            </Field>
            <Field label="Type">
              <input
                className={inputClass}
                value={actor.species}
                disabled={!canEdit}
                onChange={(event) => updateField("species", event.target.value)}
              />
            </Field>
            {isCreatureActor && (
              <Field label="Size">
                <select
                  className={inputClass}
                  value={actor.creatureSize}
                  disabled={!canEdit}
                  onChange={(event) => updateCreatureSize(event.target.value)}
                >
                  {CREATURE_SIZE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Profile">
              <input
                className={inputClass}
                value={actor.className}
                disabled={!canEdit}
                onChange={(event) => updateField("className", event.target.value)}
              />
            </Field>
            {isStaticActor && (
              <Field label="Width (sq)">
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  max={12}
                  value={actor.tokenWidthSquares}
                  disabled={!canEdit}
                  onChange={(event) => updateStaticDimension("tokenWidthSquares", event.target.value)}
                />
              </Field>
            )}
            {isStaticActor && (
              <Field label="Length (sq)">
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  max={12}
                  value={actor.tokenLengthSquares}
                  disabled={!canEdit}
                  onChange={(event) => updateStaticDimension("tokenLengthSquares", event.target.value)}
                />
              </Field>
            )}
            <Field label="Background / Weight">
              <input
                className={inputClass}
                value={actor.background}
                disabled={!canEdit}
                onChange={(event) => updateField("background", event.target.value)}
              />
            </Field>
            <Field label="Armor Class">
              <input
                className={inputClass}
                type="number"
                value={actor.armorClass}
                disabled={!canEdit}
                onChange={(event) => updateField("armorClass", Number(event.target.value || 0))}
              />
            </Field>
            <Field label="Speed">
              <input
                className={inputClass}
                type="number"
                value={actor.speed}
                disabled={!canEdit}
                onChange={(event) => updateField("speed", Number(event.target.value || 0))}
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-[120px,1fr]">
            <div className="space-y-3">
              <div className="flex aspect-square items-center justify-center border border-amber-700/50 bg-zinc-900 text-2xl font-semibold text-amber-50">
                {actor.imageUrl ? (
                  <img src={resolveAssetUrl(actor.imageUrl)} alt={actor.name} className="h-full w-full object-cover" />
                ) : (
                  <span>{actor.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <label className="block">
                <span className="sr-only">Upload portrait</span>
                <span className="flex cursor-pointer items-center justify-center gap-2 border border-zinc-800 px-3 py-2 text-xs uppercase tracking-[0.2em] text-zinc-300 transition hover:border-amber-700/70 hover:text-amber-50">
                  <ImagePlus size={14} />
                  Upload
                </span>
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  disabled={!canEdit}
                  onChange={(event) => void handleImageUpload(event)}
                />
              </label>
            </div>
            <div className="space-y-3">
              <Field label="Image URL">
                <input
                  className={inputClass}
                  value={actor.imageUrl}
                  disabled={!canEdit}
                  onChange={(event) => updateField("imageUrl", event.target.value)}
                />
              </Field>
              <Field label="Notes">
                <textarea
                  className={`${inputClass} min-h-48`}
                  value={actor.notes}
                  disabled={!canEdit}
                  onChange={(event) => updateField("notes", event.target.value)}
                />
              </Field>
              {imageError ? <p className="text-sm text-red-400">{imageError}</p> : null}
            </div>
          </div>
        </article>

        <article className="space-y-4 border border-amber-800/40 bg-zinc-950 p-4">
          <header className="flex items-center gap-2 border-b border-amber-800/30 pb-3">
            <ScrollText size={16} className="text-amber-400" />
            <p className="text-xs uppercase tracking-[0.28em] text-amber-400/80">Details</p>
          </header>

          <div className="grid gap-3 md:grid-cols-3">
            <StatBox label="HP" value={`${actor.hitPoints.current}/${actor.hitPoints.max}`} />
            <StatBox label="Initiative" value={`${actor.initiative >= 0 ? "+" : ""}${actor.initiative}`} />
            <StatBox label="Vision" value={`${actor.visionRange} sq`} />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(actor.abilities).map(([key, value]) => (
              <StatBox
                key={key}
                label={key.toUpperCase()}
                value={`${value}`}
                detail={`${Math.floor((value - 10) / 2) >= 0 ? "+" : ""}${Math.floor((value - 10) / 2)}`}
              />
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm text-zinc-300">
      <span className="block text-[11px] uppercase tracking-[0.22em] text-amber-400/80">{label}</span>
      {children}
    </label>
  );
}

function StatBox({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="space-y-1 border border-amber-800/30 bg-zinc-900/70 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.22em] text-amber-400/80">{label}</p>
      <p className="text-2xl font-semibold text-amber-50">{value}</p>
      {detail ? <p className="text-xs text-zinc-500">{detail}</p> : null}
    </div>
  );
}

const inputClass =
  "w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-600/70";
