import type { ReactNode } from "react";

import type { MonsterActionEntry, MonsterTemplate } from "@shared/types";

import { resolveAssetUrl } from "../../lib/assets";

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
const titleFontStyle = { fontFamily: "\"Palatino Linotype\", Georgia, serif" } as const;

type PreviewMonster = MonsterTemplate | Omit<MonsterTemplate, "id">;

interface MonsterStatBlockProps {
  monster: PreviewMonster;
  eyebrow?: string;
  action?: ReactNode;
  sourceTitle?: string;
  className?: string;
  renderText?: (text: string) => ReactNode;
}

interface MonsterCatalogOptionProps {
  monster: MonsterTemplate;
  selected: boolean;
  onSelect: () => void;
}

interface MonsterPreviewDetails {
  metaLine: string;
  savingThrows: string;
  conditionImmunities: string[];
  remainingTraits: string[];
}

export function MonsterCatalogOption({ monster, selected, onSelect }: MonsterCatalogOptionProps) {
  const details = deriveMonsterPreviewDetails(monster);
  const metaLine = details.metaLine || startCase(monster.creatureType);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full rounded-none border px-4 py-3 text-left transition ${
        selected
          ? "border-amber-300/55 bg-amber-200/[0.07] shadow-[inset_0_0_0_1px_rgba(252,211,77,0.34),0_18px_34px_rgba(0,0,0,0.22)]"
          : "border-white/10 bg-slate-950/60 hover:border-amber-200/25 hover:bg-slate-900/80 hover:shadow-[0_18px_34px_rgba(0,0,0,0.24)]"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg text-amber-200" style={titleFontStyle}>
                {monster.name}
              </h3>
              {metaLine ? <p className="mt-1 text-sm italic text-stone-300/85">{metaLine}</p> : null}
            </div>
            <MonsterTokenAvatar monster={monster} size="small" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[0.72rem] uppercase tracking-[0.14em]">
            <MonsterChip tone="accent">CR {monster.challengeRating}</MonsterChip>
            <MonsterChip tone="muted">AC {monster.armorClass}</MonsterChip>
            <MonsterChip tone="muted">HP {monster.hitPoints}</MonsterChip>
            <MonsterChip tone="muted">Init {formatSigned(monster.initiative)}</MonsterChip>
            <MonsterChip tone="muted">{formatMonsterSpeed(monster)}</MonsterChip>
            <MonsterChip tone="source" title={monster.source}>
              {monster.source}
            </MonsterChip>
          </div>
        </div>
      </div>
    </button>
  );
}

export function MonsterStatBlock({
  monster,
  eyebrow = "Monster",
  action,
  sourceTitle,
  className,
  renderText = renderRulesTextPlain
}: MonsterStatBlockProps) {
  const details = deriveMonsterPreviewDetails(monster);
  const combinedImmunities = [...monster.immunities, ...details.conditionImmunities];

  return (
    <section className={className}>
      <div className="grid gap-5">
        <header className="flex flex-col gap-4 border-b border-amber-300/60 pb-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            {eyebrow ? <p className="panel-label">{eyebrow}</p> : null}
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h3 className="text-3xl leading-none text-amber-200 sm:text-[2.15rem]" style={titleFontStyle}>
                {monster.name}
              </h3>
              {monster.source ? (
                <span
                  className="text-sm font-semibold uppercase tracking-[0.14em] text-sky-300"
                  title={sourceTitle ?? monster.source}
                >
                  {monster.source}
                </span>
              ) : null}
            </div>
            {details.metaLine ? <p className="mt-3 text-base italic text-stone-300/90">{details.metaLine}</p> : null}
          </div>

          <div className="flex items-start gap-3 self-start xl:flex-col xl:items-end">
            {action}
            <MonsterTokenAvatar monster={monster} size="large" />
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_210px]">
          <div className="grid gap-1 text-[1.05rem] leading-8 text-stone-100">
            <MonsterSummaryLine label="AC" value={String(monster.armorClass)} />
            <MonsterSummaryLine label="HP" value={String(monster.hitPoints)} />
            <MonsterSummaryLine label="Speed" value={formatMonsterSpeed(monster)} />
          </div>

          <div className="grid gap-3 border border-amber-200/10 bg-white/[0.035] px-4 py-3 text-stone-100">
            <div>
              <p className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-400">Initiative</p>
              <p className="mt-1 text-2xl font-semibold text-sky-300">{formatSigned(monster.initiative)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-400">CR</p>
                <p className="mt-1 font-semibold text-stone-100">{monster.challengeRating}</p>
              </div>
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-400">PB</p>
                <p className="mt-1 font-semibold text-stone-100">{formatSigned(monster.proficiencyBonus)}</p>
              </div>
            </div>
            {monster.xp > 0 ? (
              <p className="text-sm text-stone-300/90">{monster.xp.toLocaleString()} XP</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          {ABILITY_KEYS.map((ability) => (
            <div key={ability} className="border border-white/8 bg-white/[0.04] px-3 py-2 text-center">
              <p className="text-[0.72rem] uppercase tracking-[0.18em] text-slate-400">{ability}</p>
              <div className="mt-1 flex items-center justify-center gap-3">
                <span className="text-xl font-semibold text-stone-100">{monster.abilities[ability]}</span>
                <span className="text-base font-semibold text-sky-300">{formatAbilityModifier(monster.abilities[ability])}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-2 text-[1rem] leading-8 text-stone-100">
          {details.savingThrows ? <MonsterInfoLine label="Saving Throws" value={details.savingThrows} /> : null}
          {monster.skills.length > 0 ? (
            <MonsterInfoLine
              label="Skills"
              value={monster.skills.map((skill) => `${skill.name} ${formatSigned(skill.bonus)}`).join(", ")}
            />
          ) : null}
          {monster.resistances.length > 0 ? (
            <MonsterInfoLine label="Resistances" value={monster.resistances.join(", ")} />
          ) : null}
          {monster.vulnerabilities.length > 0 ? (
            <MonsterInfoLine label="Vulnerabilities" value={monster.vulnerabilities.join(", ")} />
          ) : null}
          {combinedImmunities.length > 0 ? <MonsterInfoLine label="Immunities" value={combinedImmunities.join(", ")} /> : null}
          <MonsterInfoLine label="Senses" value={formatMonsterSenses(monster)} />
          {monster.languages.length > 0 ? <MonsterInfoLine label="Languages" value={monster.languages.join(", ")} /> : null}
          <MonsterInfoLine
            label="CR"
            value={`${monster.challengeRating}${monster.xp ? ` (XP ${monster.xp.toLocaleString()})` : ""}; PB ${formatSigned(monster.proficiencyBonus)}`}
          />
        </div>

        <MonsterTextSection title="Traits" items={details.remainingTraits} renderText={renderText} />
        <MonsterActionSection title="Actions" items={monster.actions} renderText={renderText} />
        <MonsterActionSection title="Bonus Actions" items={monster.bonusActions} renderText={renderText} />
        <MonsterActionSection title="Reactions" items={monster.reactions} renderText={renderText} />
        <MonsterActionSection
          title={monster.legendaryActionsUse > 0 ? `Legendary Actions (${monster.legendaryActionsUse})` : "Legendary Actions"}
          items={monster.legendaryActions}
          renderText={renderText}
        />
        <MonsterActionSection title="Lair Actions" items={monster.lairActions} renderText={renderText} />
        <MonsterActionSection title="Regional Effects" items={monster.regionalEffects} renderText={renderText} />

        {(monster.habitat || monster.treasure || sourceTitle) && (
          <div className="grid gap-2 border-t border-white/10 pt-4 text-[0.98rem] leading-7 text-stone-100">
            {monster.habitat ? <MonsterInfoLine label="Habitat" value={monster.habitat} /> : null}
            {monster.treasure ? <MonsterInfoLine label="Treasure" value={monster.treasure} /> : null}
            {sourceTitle ? <MonsterInfoLine label="Source" value={sourceTitle} /> : null}
          </div>
        )}
      </div>
    </section>
  );
}

function MonsterTokenAvatar({ monster, size }: { monster: PreviewMonster; size: "small" | "large" }) {
  const resolvedImageUrl = monster.imageUrl ? resolveAssetUrl(monster.imageUrl) : "";
  const initials = monster.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className={`overflow-hidden rounded-full shadow-[0_16px_36px_rgba(0,0,0,0.34)] ${
        resolvedImageUrl ? "border-0" : "border-4"
      } ${
        size === "large" ? "h-28 w-28 min-w-[7rem]" : "h-14 w-14 min-w-[3.5rem]"
      }`}
      style={{ borderColor: monster.color || "#d35b49", backgroundColor: "rgba(15, 23, 42, 0.96)" }}
    >
      {resolvedImageUrl ? (
        <img src={resolvedImageUrl} alt={monster.name} className="h-full w-full object-cover" />
      ) : (
        <div
          className="grid h-full w-full place-items-center text-center font-semibold uppercase tracking-[0.18em] text-stone-100"
          style={{
            background: `radial-gradient(circle at 30% 20%, ${withAlpha(monster.color || "#d35b49", "66")}, rgba(15, 23, 42, 0.96))`
          }}
        >
          {initials || "?"}
        </div>
      )}
    </div>
  );
}

function MonsterSummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-semibold text-stone-50">{label}</span> {value}
    </p>
  );
}

function MonsterInfoLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="leading-8">
      <span className="font-semibold text-stone-50">{label}</span> {value}
    </p>
  );
}

function MonsterTextSection({
  title,
  items,
  renderText
}: {
  title: string;
  items: string[];
  renderText: (text: string) => ReactNode;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-3">
      <div className="border-b border-amber-300/70 pb-1">
        <h4 className="text-2xl uppercase tracking-[0.06em] text-amber-300" style={titleFontStyle}>
          {title}
        </h4>
      </div>
      <div className="grid gap-3 text-[1rem] leading-8 text-stone-100">
        {items.map((item, index) => (
          <p key={`${title}-${index}`}>
            {renderText(item)}
          </p>
        ))}
      </div>
    </section>
  );
}

function MonsterActionSection({
  title,
  items,
  renderText
}: {
  title: string;
  items: MonsterActionEntry[];
  renderText: (text: string) => ReactNode;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-3">
      <div className="border-b border-amber-300/70 pb-1">
        <h4 className="text-2xl uppercase tracking-[0.06em] text-amber-300" style={titleFontStyle}>
          {title}
        </h4>
      </div>
      <div className="grid gap-3 text-[1rem] leading-8 text-stone-100">
        {items.map((item) => (
          <p key={`${title}-${item.name}`}>
            <span className="font-semibold italic text-stone-50">{item.name}.</span>{" "}
            {renderText(item.description)}
          </p>
        ))}
      </div>
    </section>
  );
}

function MonsterChip({
  children,
  tone,
  title
}: {
  children: ReactNode;
  tone: "accent" | "muted" | "source";
  title?: string;
}) {
  const toneClass =
    tone === "accent"
      ? "border-amber-300/40 bg-amber-200/10 text-amber-100"
      : tone === "source"
        ? "border-sky-300/35 bg-sky-400/10 text-sky-200"
        : "border-white/12 bg-white/[0.04] text-slate-300";

  return (
    <span title={title} className={`inline-flex items-center border px-2 py-1 ${toneClass}`}>
      {children}
    </span>
  );
}

function deriveMonsterPreviewDetails(monster: PreviewMonster): MonsterPreviewDetails {
  let metaLine = "";
  let savingThrows = "";
  const conditionImmunities: string[] = [];
  const remainingTraits: string[] = [];

  monster.traits.forEach((trait, index) => {
    const normalized = renderRulesTextPlain(trait);

    if (!normalized) {
      return;
    }

    if (!metaLine && index === 0 && looksLikeMetaLine(normalized)) {
      metaLine = normalized;
      return;
    }

    if (!savingThrows && normalized.toLowerCase().startsWith("saving throws:")) {
      savingThrows = normalized.replace(/^saving throws:\s*/i, "");
      return;
    }

    if (normalized.toLowerCase().startsWith("condition immunities:")) {
      const value = normalized.replace(/^condition immunities:\s*/i, "");

      if (value) {
        conditionImmunities.push(value);
      }

      return;
    }

    remainingTraits.push(trait);
  });

  if (!metaLine) {
    metaLine = startCase(monster.creatureType);
  }

  return {
    metaLine,
    savingThrows,
    conditionImmunities,
    remainingTraits
  };
}

function formatMonsterSpeed(monster: PreviewMonster) {
  const parts = [
    monster.speedModes.walk ? `${monster.speedModes.walk} ft.` : null,
    monster.speedModes.climb ? `Climb ${monster.speedModes.climb} ft.` : null,
    monster.speedModes.fly ? `Fly ${monster.speedModes.fly} ft.` : null,
    monster.speedModes.swim ? `Swim ${monster.speedModes.swim} ft.` : null,
    monster.speedModes.burrow ? `Burrow ${monster.speedModes.burrow} ft.` : null
  ].filter(Boolean);

  return parts.join(", ") || `${monster.speed} ft.`;
}

function formatMonsterSenses(monster: PreviewMonster) {
  const senses = monster.senses.map((sense) => `${sense.name} ${sense.range} ft.${sense.notes ? ` (${sense.notes})` : ""}`);
  return [...senses, `Passive Perception ${monster.passivePerception}`].join(", ");
}

function formatAbilityModifier(score: number) {
  return formatSigned(Math.floor((score - 10) / 2));
}

function formatSigned(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function renderRulesTextPlain(value: string) {
  return value
    .replace(/\{@spell ([^}|]+)(?:\|[^}]+)?}/g, "$1")
    .replace(/\{@dc ([^}]+)}/g, "DC $1")
    .replace(/\{@hit ([^}]+)}/g, "$1")
    .replace(/\{@damage ([^}]+)}/g, "$1")
    .replace(/\{@atkr ([^}]+)}/g, "")
    .replace(/\{@h}/g, "Hit:")
    .replace(/\{@[^} ]+ ([^}|]+)(?:\|[^}]+)?}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeMetaLine(value: string) {
  if (!value || value.includes(":") || value.includes(".")) {
    return false;
  }

  return value.includes("•") || value.includes(",");
}

function startCase(value: string) {
  if (!value) {
    return "";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function withAlpha(color: string, alpha: string) {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return `${color}${alpha}`;
  }

  return color;
}
