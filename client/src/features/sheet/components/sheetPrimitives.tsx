import type { ActorSheet, CompendiumReferenceEntry } from "@shared/types";
import { Dice6, Eye, Info, Plus, RotateCcw, Skull, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { type ButtonHTMLAttributes, memo, type ReactNode, useEffect, useRef, useState } from "react";

import { CircleToggle } from "../../../components/CircleToggle";
import { anchorFromRect, type FloatingAnchor, FloatingLayer } from "../../../components/FloatingLayer";
import { IconButton } from "../../../components/IconButton";
import { resolveAssetUrl } from "../../../lib/assets";
import styles from "../PlayerNpcSheet2024.module.css";
import type { DetailRowEntry } from "../playerNpcSheet2024Types";
import { formatModifier } from "../sheetUtils";

export const inputClass =
  "w-full rounded-md border border-white/10 bg-slate-900/90 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 disabled:opacity-50";
export const textareaClass =
  "w-full rounded-md border border-white/10 bg-slate-900/90 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 disabled:opacity-50";
export const inputClassCompact =
  "w-full rounded border border-white/10 bg-slate-900/90 px-2 py-1 text-xs text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 disabled:opacity-50";
export const textareaClassCompact =
  "w-full rounded border border-white/10 bg-slate-900/90 px-2 py-1.5 text-xs text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 disabled:opacity-50";
export const actionButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-zinc-200 transition hover:border-amber-500/60 hover:bg-slate-800/80 hover:text-amber-50 active:scale-[0.98] disabled:opacity-40";
export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-amber-500/60 hover:bg-slate-800/80 hover:text-amber-50 active:scale-[0.98] disabled:opacity-40";
export const headerRestButtonClass =
  "inline-flex h-7 w-[38px] shrink-0 appearance-none items-center justify-center rounded-md border border-white/10 bg-slate-900/70 p-0 text-zinc-300 transition hover:border-amber-500/70 hover:bg-slate-800 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-40";
export const headerRestButtonInnerClass =
  "inline-flex items-center justify-center gap-1 px-1 text-[10px] font-semibold uppercase leading-none tracking-tight";
export const miniButtonClass =
  "inline-flex items-center justify-center gap-1 rounded border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 transition hover:border-amber-500/70 hover:bg-slate-800 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-40";

interface SheetButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "magical" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
}

export function SheetButton({ children, variant = "secondary", size = "md", icon, className = "", disabled, ...props }: SheetButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

  const sizeClasses = {
    sm: "gap-1.5 px-2.5 py-1 text-xs rounded",
    md: "gap-2 px-3.5 py-1.5 text-sm rounded-md",
    lg: "gap-2.5 px-5 py-2.5 text-base font-semibold rounded-lg"
  }[size];

  const variantClasses = {
    primary:
      "bg-gradient-to-b from-amber-400 to-amber-500 text-slate-950 font-semibold shadow-sm hover:from-amber-300 hover:to-amber-400 border border-amber-300/40",
    magical:
      "bg-gradient-to-r from-amber-500/20 via-purple-500/15 to-amber-500/20 border border-amber-500/50 text-amber-200 hover:border-amber-400 hover:bg-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]",
    secondary: "border border-white/12 bg-slate-900/80 text-zinc-200 hover:border-amber-500/60 hover:bg-slate-800 hover:text-amber-50",
    danger: "border border-rose-500/30 bg-rose-950/30 text-rose-300 hover:border-rose-500/60 hover:bg-rose-900/40",
    ghost: "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06]"
  }[variant];

  return (
    <button type="button" className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`} disabled={disabled} {...props}>
      {icon ? <span className="shrink-0">{icon}</span> : null}
      {children}
    </button>
  );
}

export function CalloutBanner({
  title,
  children,
  icon = <Info size={16} />,
  variant = "info"
}: {
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
  variant?: "info" | "amber" | "magic";
}) {
  const borderBg = {
    info: "border-sky-500/20 bg-sky-500/[0.04] text-sky-200",
    amber: "border-amber-500/25 bg-amber-500/[0.04] text-zinc-300",
    magic: "border-purple-500/25 bg-purple-500/[0.04] text-zinc-300"
  }[variant];

  return (
    <div className={`flex items-start gap-3 rounded-md border p-3.5 text-xs leading-relaxed ${borderBg}`}>
      <span className="mt-0.5 shrink-0 text-amber-400">{icon}</span>
      <div className="min-w-0 flex-1">
        {title ? <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-amber-300">{title}</p> : null}
        <div className="text-zinc-300">{children}</div>
      </div>
    </div>
  );
}

export function SourceBadge({ source }: { source?: string | null }) {
  if (!source) return null;
  return (
    <span className="inline-flex items-center rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
      {source}
    </span>
  );
}

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
          {title ? <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/90">{title}</p> : <span />}
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </div>
      ) : null}
      {entries.length === 0 ? <p className="text-xs text-zinc-500 italic px-1">{emptyMessage}</p> : null}
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
      className="group rounded-md border border-white/8 bg-slate-900/60 transition hover:border-white/15"
      summaryClassName="list-none cursor-pointer px-3.5 py-3 select-none"
      summary={
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-400/90">{entry.eyebrow}</p>
              {entry.source ? <SourceBadge source={entry.source} /> : null}
            </div>
            <p className="mt-1 truncate text-sm font-medium text-zinc-100 group-hover:text-amber-50">{entry.title}</p>
            {entry.subtitle ? <p className="text-xs text-zinc-400">{entry.subtitle}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions(entry)}</div> : null}
        </div>
      }
    >
      <div className="space-y-3 border-t border-white/8 px-3.5 py-3 bg-black/20">
        {entry.meta?.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {entry.meta.map((item) => (
              <div key={`${entry.id}:${item.label}`} className="rounded border border-white/8 bg-slate-950/60 px-3 py-2">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-400">{item.label}</p>
                <p className="mt-0.5 text-xs text-zinc-200">{item.value}</p>
              </div>
            ))}
          </div>
        ) : null}
        {entry.description ? (
          <div className="text-xs leading-relaxed text-zinc-300">
            {renderText ? renderText(entry.description) : <p className="whitespace-pre-wrap">{entry.description}</p>}
          </div>
        ) : null}
        {entry.tags?.length ? <TagRow tags={entry.tags} /> : null}
        {entry.onRemove ? (
          <div className="flex justify-end pt-1">
            <SheetButton variant="danger" size="sm" icon={<Trash2 size={12} />} onClick={entry.onRemove}>
              Remove
            </SheetButton>
          </div>
        ) : null}
      </div>
    </LazyDetails>
  );
});

export function TagRow({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

export function SectionCard({
  title,
  icon,
  action,
  children
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="rounded-lg border border-amber-500/20 bg-slate-950/90 backdrop-blur-sm shadow-md transition hover:border-amber-500/30">
      <header className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3 bg-gradient-to-r from-amber-500/[0.07] to-transparent rounded-t-lg">
        <div className="flex items-center gap-2.5">
          <span className="text-amber-400">{icon}</span>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">{title}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className="space-y-4 p-4">{children}</div>
    </article>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-xs text-zinc-300">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90" title={hint}>
        {label}
      </span>
      {children}
    </label>
  );
}

export function HoverPreviewTrigger({
  label,
  caption,
  emptyMessage,
  preview,
  placement = "right-start",
  previewClassName = "w-[min(48rem,calc(100vw-2rem))] max-w-[48rem]"
}: {
  label: string;
  caption?: string;
  emptyMessage: string;
  preview: ReactNode | null;
  placement?: "top-start" | "bottom-start" | "left-start" | "right-start";
  previewClassName?: string;
}) {
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<FloatingAnchor | null>(null);

  const updateAnchor = () => {
    if (!triggerRef.current) {
      return;
    }

    setAnchor(anchorFromRect(triggerRef.current.getBoundingClientRect()));
  };

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const openPreview = () => {
    if (!preview) {
      return;
    }

    clearCloseTimeout();
    updateAnchor();
    setIsOpen(true);
  };

  const closePreviewSoon = () => {
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 110);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const syncAnchor = () => {
      if (!triggerRef.current) {
        return;
      }

      setAnchor(anchorFromRect(triggerRef.current.getBoundingClientRect()));
    };

    window.addEventListener("resize", syncAnchor);
    window.addEventListener("scroll", syncAnchor, true);
    return () => {
      window.removeEventListener("resize", syncAnchor);
      window.removeEventListener("scroll", syncAnchor, true);
    };
  }, [isOpen]);

  useEffect(
    () => () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    },
    []
  );

  if (!preview) {
    return <p className="text-[11px] text-zinc-500 italic">{emptyMessage}</p>;
  }

  return (
    <>
      <div
        ref={triggerRef}
        className="flex items-center justify-between gap-3 rounded-md border border-dashed border-amber-500/30 bg-amber-500/[0.04] px-3 py-2 text-left transition hover:border-amber-500/70 hover:bg-amber-500/[0.08] focus-visible:border-amber-500 focus-visible:outline-none cursor-pointer"
        tabIndex={0}
        onPointerEnter={openPreview}
        onPointerLeave={closePreviewSoon}
        onFocus={openPreview}
        onBlur={closePreviewSoon}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">{label}</p>
          {caption ? <p className="mt-0.5 truncate text-xs text-zinc-400">{caption}</p> : null}
        </div>
        <span className="shrink-0 text-amber-400/70">
          <Eye size={15} strokeWidth={2} />
        </span>
      </div>
      {isOpen ? (
        <FloatingLayer
          anchor={anchor}
          placement={placement}
          offset={12}
          className={`pointer-events-auto z-[2147483000] ${previewClassName}`}
          onPointerEnter={openPreview}
          onPointerLeave={closePreviewSoon}
        >
          <div className="max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain rounded-lg border border-amber-500/40 bg-slate-950 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.7)]">
            {preview}
          </div>
        </FloatingLayer>
      ) : null}
    </>
  );
}

export function CompactStatChip({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  return (
    <div
      className={`rounded-md border border-white/10 bg-slate-900/80 p-2.5 transition ${
        onClick ? "cursor-pointer hover:border-amber-500/70 hover:bg-slate-850 active:scale-[0.98]" : ""
      }`}
      onClick={onClick}
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-400/80">{label}</p>
      <p className="mt-1 text-lg font-bold text-amber-50">{value}</p>
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
    <div className="space-y-2.5 rounded-md border border-white/10 bg-slate-900/80 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400/90"
            title="Current and effective maximum hit points."
          >
            Hit Points
          </p>
          <p className="mt-1 text-lg font-bold text-amber-50">
            {current}
            <span className="ml-1 text-sm font-normal text-zinc-400">/ {effectiveMax}</span>
          </p>
        </div>
        <div className="text-right text-[10px] font-semibold uppercase tracking-[0.14em]">
          <p className="text-emerald-400" title="Current hit points.">
            HP {current}
          </p>
          <p className="text-sky-400" title="Temporary hit points that are lost first.">
            THP {temp}
          </p>
          <p className="text-rose-400" title="Damage taken against effective maximum hit points.">
            DMG {damage}
          </p>
          {reducedMax > 0 ? (
            <p className="text-amber-400" title="Maximum hit points reduced by an effect.">
              RED {-reducedMax}
            </p>
          ) : (
            <p className="text-zinc-400" title="Base maximum hit points before reductions.">
              BASE {baseMax}
            </p>
          )}
        </div>
      </div>
      <div className="h-3 overflow-hidden rounded-full border border-white/10 bg-slate-950">
        <div className="flex h-full w-full">
          <div className="bg-emerald-500 transition-all duration-300" style={{ width: `${currentWidth}%` }} />
          <div className="bg-sky-500 transition-all duration-300" style={{ width: `${tempWidth}%` }} />
          <div className="bg-rose-600 transition-all duration-300" style={{ width: `${damageWidth}%` }} />
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
    <div
      className="space-y-1.5"
      onMouseEnter={(event) => setAnchor(anchorFromRect(event.currentTarget.getBoundingClientRect()))}
      onMouseLeave={() => setAnchor(null)}
    >
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
        <span>Exhaustion</span>
        <span className="text-amber-400">{level}/6</span>
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
      <div className="flex items-center justify-between text-[9px] font-medium text-zinc-500">
        {Array.from({ length: 7 }, (_, index) => (
          <span key={`exhaustion-label:${index}`} className="w-3 text-center">
            {index}
          </span>
        ))}
      </div>
      {condition ? (
        <FloatingLayer
          anchor={anchor}
          placement="right-start"
          className="max-w-sm rounded-lg border border-amber-500/40 bg-slate-950/98 p-3.5 text-zinc-100 shadow-[0_18px_70px_rgba(0,0,0,0.6)]"
        >
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400/80">Condition</p>
            <div>
              <p className="text-sm font-semibold text-amber-50">{condition.name}</p>
              <p className="text-[11px] text-zinc-400">{[condition.category, condition.source].filter(Boolean).join(" • ")}</p>
            </div>
            <div className="text-xs leading-relaxed text-zinc-300">{renderText(condition.entries || condition.description)}</div>
          </div>
        </FloatingLayer>
      ) : null}
    </div>
  );
}

export function UsableTrack({ total, available, onChange }: { total: number; available: number; onChange: (available: number) => void }) {
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
    <div className="rounded-md border border-white/10 bg-slate-900/80 p-2.5 transition hover:border-amber-500/40">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-400/90">{label}</p>
          <p className="mt-1 text-lg font-bold text-amber-50">{score}</p>
        </div>
        <div className="space-y-1 text-right">
          <button
            type="button"
            className="block text-xs font-semibold text-zinc-100 transition hover:text-amber-300"
            onClick={onCheck}
            title={`Roll ${label} check`}
          >
            {formatModifier(modifier)}
          </button>
          <button
            type="button"
            className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 transition hover:text-amber-300"
            onClick={onSave}
            title={`Roll ${label} save`}
          >
            Save {formatModifier(save)}
          </button>
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
    <div className="space-y-2.5 rounded-md border border-white/10 bg-slate-900/80 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Death Saving Throws</p>
        {allSuccess ? (
          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
            Stable
          </span>
        ) : null}
        {allFailure ? (
          <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-300">
            Dead
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {Array.from({ length: 3 }, (_, index) => {
          const entry = history[index];
          const success = entry === "success";
          const failure = entry === "failure";

          return (
            <span
              key={`death:${index}`}
              className={`flex h-7 w-7 items-center justify-center rounded-full border transition-all ${
                success
                  ? "border-emerald-400 bg-emerald-500 text-zinc-950 shadow-sm"
                  : failure
                    ? "border-rose-500 bg-rose-600 text-zinc-950 shadow-sm"
                    : "border-white/15 bg-slate-950/60 text-transparent"
              }`}
            >
              {success ? <Plus size={14} strokeWidth={3} /> : failure ? <Skull size={14} strokeWidth={2.5} /> : null}
            </span>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5 pt-1">
        <IconButton icon={<ThumbsUp size={12} />} label="Mark death save success" onClick={onSuccess} className="h-7 w-7" />
        <IconButton icon={<ThumbsDown size={12} />} label="Mark death save failure" onClick={onFailure} className="h-7 w-7" />
        <IconButton icon={<Dice6 size={12} />} label="Roll death save" onClick={onRoll} className="h-7 w-7" />
        <IconButton icon={<RotateCcw size={12} />} label="Reset death saves" onClick={onReset} className="h-7 w-7" />
      </div>
    </div>
  );
}

export function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-slate-900/80 p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-400/90">{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-amber-50">{value}</p>
    </div>
  );
}
