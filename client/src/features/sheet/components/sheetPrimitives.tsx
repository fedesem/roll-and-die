import { Dice6, Plus, RotateCcw, Skull, ThumbsDown, ThumbsUp } from "lucide-react";
import { memo, useState, type ReactNode } from "react";

import type { ActorSheet, CompendiumReferenceEntry } from "@shared/types";

import { CircleToggle } from "../../../components/CircleToggle";
import { FloatingLayer, anchorFromRect, type FloatingAnchor } from "../../../components/FloatingLayer";
import { IconButton } from "../../../components/IconButton";
import { resolveAssetUrl } from "../../../lib/assets";
import styles from "../PlayerNpcSheet2024.module.css";
import type { DetailRowEntry } from "../playerNpcSheet2024Types";
import { formatModifier } from "../sheetUtils";

export const inputClass =
  "w-full border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-amber-500/70";
export const textareaClass =
  "w-full border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-amber-500/70";
export const inputClassCompact =
  "w-full border border-white/10 bg-black/20 px-1.5 py-1 text-[11px] text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-amber-500/70";
export const textareaClassCompact =
  "w-full border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-amber-500/70";
export const actionButtonClass =
  "border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 transition hover:border-amber-500/70 hover:text-amber-50";
export const secondaryButtonClass =
  "inline-flex items-center gap-2 border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 transition hover:border-amber-500/70 hover:text-amber-50";
export const headerRestButtonClass =
  "inline-flex h-7 w-[36px] shrink-0 appearance-none items-center justify-center border border-white/10 bg-transparent p-0 text-zinc-300 transition hover:border-amber-500/70 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-40";
export const headerRestButtonInnerClass =
  "inline-flex items-center justify-center gap-[2px] px-[1px] text-[10px] font-medium uppercase leading-none tracking-normal";
export const miniButtonClass =
  "inline-flex items-center justify-center gap-1 border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-zinc-300 transition hover:border-amber-500/70 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-40";

export function PortraitCard({ actor, compact = false }: { actor: ActorSheet; compact?: boolean }) {
  const initials =
    actor.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((entry) => entry[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <div className={`flex items-start justify-center ${compact ? "" : "pt-1"}`}>
      <div
        className={`${compact ? "h-12 w-12 text-sm" : "h-24 w-24 text-xl"} overflow-hidden rounded-full border border-amber-400/40 shadow-[0_0_0_4px_rgba(15,23,42,0.9)]`}
        style={{ backgroundColor: actor.imageUrl ? undefined : actor.color || "#334155" }}
      >
        {actor.imageUrl ? (
          <img className="h-full w-full object-cover" src={resolveAssetUrl(actor.imageUrl)} alt={actor.name || "Actor token"} />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-semibold uppercase text-slate-950">{initials}</div>
        )}
      </div>
    </div>
  );
}

export function DetailCollection({
  title,
  entries,
  emptyMessage,
  headerAction,
  actions,
  renderText
}: {
  title?: string;
  entries: DetailRowEntry[];
  emptyMessage: string;
  headerAction?: ReactNode;
  actions?: (entry: DetailRowEntry) => ReactNode;
  renderText?: (text: string) => ReactNode;
}) {
  return (
    <div className="space-y-2">
      {title || headerAction ? (
        <div className="flex items-center justify-between gap-3">
          {title ? <p className="text-xs uppercase tracking-[0.24em] text-amber-400/80">{title}</p> : <span />}
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </div>
      ) : null}
      {entries.length === 0 ? <p className="text-sm text-zinc-500">{emptyMessage}</p> : null}
      {entries.map((entry) => (
        <DetailCollectionItem key={entry.id} entry={entry} actions={actions} renderText={renderText} />
      ))}
    </div>
  );
}

export function LazyDetails({
  className,
  summaryClassName,
  summary,
  children
}: {
  className: string;
  summaryClassName: string;
  summary: ReactNode;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details className={className} open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary className={summaryClassName}>{summary}</summary>
      {isOpen ? children : null}
    </details>
  );
}

const DetailCollectionItem = memo(function DetailCollectionItem({
  entry,
  actions,
  renderText
}: {
  entry: DetailRowEntry;
  actions?: (entry: DetailRowEntry) => ReactNode;
  renderText?: (text: string) => ReactNode;
}) {
  return (
    <LazyDetails
      className="group border border-white/8 bg-black/20"
      summaryClassName="list-none cursor-pointer px-3 py-3"
      summary={
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.24em] text-amber-400/80">{entry.eyebrow}</p>
            <p className="mt-1 truncate text-sm text-zinc-100">{entry.title}</p>
            <p className="text-xs text-zinc-500">{[entry.subtitle, entry.source].filter(Boolean).join(" • ")}</p>
          </div>
          {actions ? <div className="shrink-0">{actions(entry)}</div> : null}
        </div>
      }
    >
      <div className="space-y-3 border-t border-white/8 px-3 py-3">
        {entry.meta?.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {entry.meta.map((item) => (
              <div key={`${entry.id}:${item.label}`} className="border border-white/8 bg-black/20 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{item.label}</p>
                <p className="mt-1 text-sm text-zinc-200">{item.value}</p>
              </div>
            ))}
          </div>
        ) : null}
        {entry.description ? (
          <div className="text-sm leading-6 text-zinc-300">{renderText ? renderText(entry.description) : <p className="whitespace-pre-wrap">{entry.description}</p>}</div>
        ) : null}
        {entry.tags?.length ? <TagRow tags={entry.tags} /> : null}
        {entry.onRemove ? (
          <div className="flex justify-end">
            <button type="button" className={secondaryButtonClass} onClick={entry.onRemove}>
              Remove
            </button>
          </div>
        ) : null}
      </div>
    </LazyDetails>
  );
});

export function TagRow({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span key={tag} className="border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-300">
          {tag}
        </span>
      ))}
    </div>
  );
}

export function SectionCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <article className="border border-white/10 bg-slate-950/80">
      <header className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
        <span className="text-amber-400">{icon}</span>
        <p className="text-[10px] uppercase tracking-[0.24em] text-amber-400/80">{title}</p>
      </header>
      <div className="space-y-3 p-3">{children}</div>
    </article>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-xs text-zinc-300">
      <span className="block text-[9px] uppercase tracking-[0.16em] text-amber-400/80" title={hint}>
        {label}
      </span>
      {children}
    </label>
  );
}

export function CompactStatChip({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  return (
    <div className={`border border-white/8 bg-black/20 px-2 py-2 ${onClick ? "cursor-pointer transition hover:border-amber-500/60" : ""}`} onClick={onClick}>
      <p className="text-[9px] uppercase tracking-[0.18em] text-amber-400/80">{label}</p>
      <p className="mt-1 text-lg font-semibold text-amber-50">{value}</p>
    </div>
  );
}

export function HitPointBar({
  current,
  damage,
  temp,
  effectiveMax,
  baseMax,
  reducedMax
}: {
  current: number;
  damage: number;
  temp: number;
  effectiveMax: number;
  baseMax: number;
  reducedMax: number;
}) {
  const total = current + damage + temp;
  const currentWidth = total > 0 ? (current / total) * 100 : 0;
  const damageWidth = total > 0 ? (damage / total) * 100 : 0;
  const tempWidth = total > 0 ? (temp / total) * 100 : 0;

  return (
    <div className="space-y-2 border border-white/8 bg-black/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] uppercase tracking-[0.16em] text-amber-400/80" title="Current and effective maximum hit points.">
            Hit Points
          </p>
          <p className="mt-1 text-base font-semibold text-amber-50">
            {current}
            <span className="ml-1 text-sm text-zinc-400">/ {effectiveMax}</span>
          </p>
        </div>
        <div className="text-right text-[10px] uppercase tracking-[0.14em] text-zinc-400">
          <p className="text-emerald-300" title="Current hit points.">
            HP {current}
          </p>
          <p className="text-sky-300" title="Temporary hit points that are lost first.">
            THP {temp}
          </p>
          <p className="text-rose-300" title="Damage taken against effective maximum hit points.">
            DMG {damage}
          </p>
          {reducedMax > 0 ? (
            <p className="text-amber-300" title="Maximum hit points reduced by an effect.">
              RED {-reducedMax}
            </p>
          ) : (
            <p title="Base maximum hit points before reductions.">BASE {baseMax}</p>
          )}
        </div>
      </div>
      <div className="h-3 overflow-hidden rounded-full border border-white/8 bg-black/40">
        <div className="flex h-full w-full">
          <div className="bg-emerald-500" style={{ width: `${currentWidth}%` }} />
          <div className="bg-sky-500" style={{ width: `${tempWidth}%` }} />
          <div className="bg-rose-500" style={{ width: `${damageWidth}%` }} />
        </div>
      </div>
    </div>
  );
}

export function ExhaustionTrack({
  level,
  onChange,
  condition,
  renderText
}: {
  level: number;
  onChange: (level: number) => void;
  condition: CompendiumReferenceEntry | null;
  renderText: (text: string) => ReactNode;
}) {
  const [anchor, setAnchor] = useState<FloatingAnchor | null>(null);

  return (
    <div className="space-y-1" onMouseEnter={(event) => setAnchor(anchorFromRect(event.currentTarget.getBoundingClientRect()))} onMouseLeave={() => setAnchor(null)}>
      <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.16em] text-zinc-300">
        <span>Exhaustion</span>
        <span>{level}/6</span>
      </div>
      <input
        className={styles.rangeInput}
        type="range"
        min={0}
        max={6}
        step={1}
        value={level}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        style={{ ["--range-progress" as string]: `${(level / 6) * 100}%` }}
        title="Set exhaustion level from 0 to 6."
      />
      <div className="flex items-center justify-between text-[9px] text-zinc-500">
        {Array.from({ length: 7 }, (_, index) => (
          <span key={`exhaustion-label:${index}`} className="w-3 text-center">
            {index}
          </span>
        ))}
      </div>
      {condition ? (
        <FloatingLayer anchor={anchor} placement="right-start" className="max-w-sm border border-white/10 bg-slate-950/98 p-3 text-zinc-100 shadow-[0_18px_70px_rgba(0,0,0,0.45)]">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-amber-400/80">Condition</p>
            <div>
              <p className="text-sm font-medium text-amber-50">{condition.name}</p>
              <p className="text-[11px] text-zinc-500">{[condition.category, condition.source].filter(Boolean).join(" • ")}</p>
            </div>
            <div className="text-sm leading-6 text-zinc-300">{renderText(condition.entries || condition.description)}</div>
          </div>
        </FloatingLayer>
      ) : null}
    </div>
  );
}

export function UsableTrack({
  total,
  available,
  onChange
}: {
  total: number;
  available: number;
  onChange: (available: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: Math.max(total, 0) }, (_, index) => {
        const isAvailable = index < available;

        return (
          <CircleToggle
            key={index}
            checked={isAvailable}
            label={isAvailable ? `Use charge ${index + 1}` : `Restore charge ${index + 1}`}
            onClick={() => onChange(isAvailable ? index : index + 1)}
            className="h-5 w-5"
          />
        );
      })}
    </div>
  );
}

export function AbilityMiniCard({
  label,
  score,
  modifier,
  save,
  onCheck,
  onSave
}: {
  label: string;
  score: number;
  modifier: number;
  save: number;
  onCheck: () => void;
  onSave: () => void;
}) {
  return (
    <div className="border border-white/8 bg-black/20 px-2 py-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] text-amber-400/80">{label}</p>
          <p className="mt-1 text-lg font-semibold text-amber-50">{score}</p>
        </div>
        <div className="space-y-1 text-right">
          <p className="cursor-pointer text-xs font-medium text-zinc-100 transition hover:text-amber-50" onClick={onCheck}>
            {formatModifier(modifier)}
          </p>
          <p className="cursor-pointer text-[10px] uppercase tracking-[0.14em] text-zinc-500 transition hover:text-amber-50" onClick={onSave}>
            Save {formatModifier(save)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function DeathSaveTracker({
  deathSaves,
  onSuccess,
  onFailure,
  onReset,
  onRoll
}: {
  deathSaves: ActorSheet["deathSaves"];
  onSuccess: () => void;
  onFailure: () => void;
  onReset: () => void;
  onRoll: () => void;
}) {
  const history = deathSaves.history ?? [];
  const allFilled = history.length === 3;
  const allSuccess = allFilled && history.every((entry) => entry === "success");
  const allFailure = allFilled && history.every((entry) => entry === "failure");

  return (
    <div className="space-y-2 border border-white/8 bg-black/20 p-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Death Saving Throws</p>
        {allSuccess ? <span className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">Stable</span> : null}
        {allFailure ? <span className="text-[10px] uppercase tracking-[0.16em] text-rose-300">Dead</span> : null}
      </div>
      <div className="flex items-center gap-2">
        {Array.from({ length: 3 }, (_, index) => {
          const entry = history[index];
          const success = entry === "success";
          const failure = entry === "failure";

          return (
            <span
              key={`death:${index}`}
              className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                success ? "border-emerald-400 bg-emerald-400 text-zinc-950" : failure ? "border-rose-500 bg-rose-500 text-zinc-950" : "border-white/15 bg-transparent text-transparent"
              }`}
            >
              {success ? <Plus size={12} /> : failure ? <Skull size={12} /> : <span className="h-3 w-3" />}
            </span>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <IconButton icon={<ThumbsUp size={12} />} label="Mark death save success" onClick={onSuccess} className="h-8 w-8" />
        <IconButton icon={<ThumbsDown size={12} />} label="Mark death save failure" onClick={onFailure} className="h-8 w-8" />
        <IconButton icon={<Dice6 size={12} />} label="Roll death save" onClick={onRoll} className="h-8 w-8" />
        <IconButton icon={<RotateCcw size={12} />} label="Reset death saves" onClick={onReset} className="h-8 w-8" />
      </div>
    </div>
  );
}

export function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/8 bg-black/20 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.24em] text-amber-400/80">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-amber-50">{value}</p>
    </div>
  );
}
