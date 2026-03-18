import type { ReactNode } from "react";

import type { ClassEntry, FeatEntry, MonsterActionEntry, MonsterTemplate, SpellEntry, UserProfile } from "@shared/types";

interface PreviewFrameProps {
  eyebrow: string;
  title: string;
  source?: string;
  subtitle?: string;
  children: ReactNode;
}

export function PreviewPlaceholder({
  title,
  message
}: {
  title: string;
  message: string;
}) {
  return (
    <section className="admin-preview-card admin-preview-card-empty">
      <div className="admin-preview-header">
        <div>
          <p className="panel-label">{title}</p>
          <h3>Preview</h3>
        </div>
      </div>
      <p className="panel-caption">{message}</p>
    </section>
  );
}

export function PreviewError({
  title,
  message
}: {
  title: string;
  message: string;
}) {
  return (
    <section className="admin-preview-card admin-preview-card-empty">
      <div className="admin-preview-header">
        <div>
          <p className="panel-label">{title}</p>
          <h3>Preview unavailable</h3>
        </div>
      </div>
      <p className="admin-preview-error">{message}</p>
    </section>
  );
}

export function UserPreviewCard({ user }: { user: UserProfile }) {
  return (
    <PreviewFrame eyebrow="User" title={user.name} source={user.isAdmin ? "Administrator" : "Member"} subtitle={user.email}>
      <div className="admin-preview-stack">
        <div className="admin-preview-keyvalue">
          <span>Access</span>
          <strong>{user.isAdmin ? "System administrator" : "Standard user"}</strong>
        </div>
        <div className="admin-preview-keyvalue">
          <span>User id</span>
          <strong>{user.id}</strong>
        </div>
      </div>
    </PreviewFrame>
  );
}

export function SpellPreviewCard({ spell }: { spell: SpellEntry | Omit<SpellEntry, "id"> }) {
  const subtitle =
    spell.level === "cantrip" ? `${spell.school} Cantrip` : `${spell.school} Level ${spell.level}`;
  const components = [
    spell.components.verbal ? "V" : null,
    spell.components.somatic ? "S" : null,
    spell.components.material ? "M" : null
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <PreviewFrame eyebrow="Spell" title={spell.name} source={spell.source} subtitle={subtitle}>
      <div className="admin-preview-stack">
        <div className="admin-preview-rules">
          <div><strong>Casting Time:</strong> {formatSpellTime(spell)}</div>
          <div><strong>Range:</strong> {formatSpellRange(spell)}</div>
          <div><strong>Components:</strong> {components || "None"}{spell.components.materialText ? ` (${spell.components.materialText})` : ""}</div>
          <div><strong>Duration:</strong> {formatSpellDuration(spell)}</div>
        </div>
        <p className="admin-preview-body">{spell.description}</p>
        {spell.damageNotation && (
          <p className="admin-preview-body">
            <strong>Damage:</strong> {spell.damageNotation}
            {spell.damageAbility ? ` + ${spell.damageAbility.toUpperCase()}` : ""}
          </p>
        )}
        {spell.fullDescription && <p className="admin-preview-body">{spell.fullDescription}</p>}
        {spell.classes.length > 0 && (
          <p className="admin-preview-footnote">
            <strong>Classes:</strong> {spell.classes.join(", ")}
          </p>
        )}
      </div>
    </PreviewFrame>
  );
}

export function FeatPreviewCard({ feat }: { feat: FeatEntry | Omit<FeatEntry, "id"> }) {
  const subtitle = feat.prerequisites
    ? `${feat.category} (Prerequisites: ${feat.prerequisites})`
    : feat.category;

  return (
    <PreviewFrame eyebrow="Feat" title={feat.name} source={feat.source} subtitle={subtitle}>
      <div className="admin-preview-stack">
        {feat.abilityScoreIncrease && (
          <p className="admin-preview-body">
            <strong>Ability Score Increase.</strong> {feat.abilityScoreIncrease}
          </p>
        )}
        <p className="admin-preview-body">{feat.description}</p>
      </div>
    </PreviewFrame>
  );
}

export function MonsterPreviewCard({ monster }: { monster: MonsterTemplate | Omit<MonsterTemplate, "id"> }) {
  const speedModes = [
    monster.speedModes.walk ? `${monster.speedModes.walk} ft.` : null,
    monster.speedModes.climb ? `Climb ${monster.speedModes.climb} ft.` : null,
    monster.speedModes.fly ? `Fly ${monster.speedModes.fly} ft.` : null,
    monster.speedModes.swim ? `Swim ${monster.speedModes.swim} ft.` : null,
    monster.speedModes.burrow ? `Burrow ${monster.speedModes.burrow} ft.` : null
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <PreviewFrame eyebrow="Monster" title={monster.name} source={monster.source} subtitle={`CR ${monster.challengeRating}`}>
      <div className="admin-monster-preview-head">
        <div className="admin-preview-stack">
          <div className="admin-preview-rules">
            <div><strong>AC</strong> {monster.armorClass}</div>
            <div><strong>HP</strong> {monster.hitPoints}</div>
            <div><strong>Speed</strong> {speedModes || `${monster.speed} ft.`}</div>
          </div>
        </div>
        {monster.imageUrl ? (
          <div className="admin-monster-portrait">
            <img src={monster.imageUrl} alt={monster.name} />
          </div>
        ) : null}
      </div>

      <div className="admin-monster-ability-grid">
        {(["str", "dex", "con", "int", "wis", "cha"] as const).map((ability) => (
          <div key={ability} className="admin-monster-ability-cell">
            <span>{ability.toUpperCase()}</span>
            <strong>{monster.abilities[ability]}</strong>
            <small>{formatModifier(monster.abilities[ability])}</small>
          </div>
        ))}
      </div>

      <div className="admin-preview-stack">
        {monster.skills.length > 0 && (
          <p className="admin-preview-body"><strong>Skills</strong> {monster.skills.map((skill) => `${skill.name} ${formatSigned(skill.bonus)}`).join(", ")}</p>
        )}
        {monster.resistances.length > 0 && (
          <p className="admin-preview-body"><strong>Resistances</strong> {monster.resistances.join(", ")}</p>
        )}
        {monster.vulnerabilities.length > 0 && (
          <p className="admin-preview-body"><strong>Vulnerabilities</strong> {monster.vulnerabilities.join(", ")}</p>
        )}
        {monster.immunities.length > 0 && (
          <p className="admin-preview-body"><strong>Immunities</strong> {monster.immunities.join(", ")}</p>
        )}
        {monster.senses.length > 0 && (
          <p className="admin-preview-body">
            <strong>Senses</strong> {monster.senses.map((sense) => `${sense.name} ${sense.range} ft.${sense.notes ? ` (${sense.notes})` : ""}`).join(", ")}, Passive Perception {monster.passivePerception}
          </p>
        )}
        {monster.languages.length > 0 && (
          <p className="admin-preview-body"><strong>Languages</strong> {monster.languages.join(", ")}</p>
        )}
        <p className="admin-preview-body">
          <strong>CR</strong> {monster.challengeRating} ({monster.xp} XP, PB {formatSigned(monster.proficiencyBonus)})
        </p>
        {monster.traits.length > 0 && (
          <Section title="Traits">
            {monster.traits.map((trait) => (
              <p key={trait} className="admin-preview-body">{trait}</p>
            ))}
          </Section>
        )}
        <ActionSection title="Actions" items={monster.actions} />
        <ActionSection title="Bonus Actions" items={monster.bonusActions} />
        <ActionSection title="Reactions" items={monster.reactions} />
        <ActionSection title={`Legendary Actions${monster.legendaryActionsUse ? ` (${monster.legendaryActionsUse})` : ""}`} items={monster.legendaryActions} />
        <ActionSection title="Lair Actions" items={monster.lairActions} />
        <ActionSection title="Regional Effects" items={monster.regionalEffects} />
        {monster.habitat && <p className="admin-preview-body"><strong>Habitat</strong> {monster.habitat}</p>}
        {monster.treasure && <p className="admin-preview-body"><strong>Treasure</strong> {monster.treasure}</p>}
      </div>
    </PreviewFrame>
  );
}

export function ClassPreviewCard({ entry }: { entry: ClassEntry | Omit<ClassEntry, "id"> }) {
  return (
    <PreviewFrame eyebrow="Class" title={entry.name} source={entry.source}>
      <div className="admin-preview-stack">
        <p className="admin-preview-body">{entry.description}</p>
        {entry.features.length > 0 && (
          <Section title="Features">
            {entry.features.map((feature) => (
              <p key={`${feature.level}-${feature.name}`} className="admin-preview-body">
                <strong>Level {feature.level}: {feature.name}.</strong> {feature.description}
              </p>
            ))}
          </Section>
        )}
        {entry.tables.map((table) => (
          <section key={table.name} className="admin-preview-section">
            <h4>{table.name}</h4>
            <div className="admin-class-table-wrap">
              <table className="admin-class-table">
                <thead>
                  <tr>
                    {table.columns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, rowIndex) => (
                    <tr key={`${table.name}-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${table.name}-${rowIndex}-${cellIndex}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </PreviewFrame>
  );
}

function PreviewFrame({ eyebrow, title, source, subtitle, children }: PreviewFrameProps) {
  return (
    <section className="admin-preview-card">
      <header className="admin-preview-header">
        <div>
          <p className="panel-label">{eyebrow}</p>
          <h3 className="admin-preview-title">{title}</h3>
          {subtitle ? <p className="admin-preview-subtitle">{subtitle}</p> : null}
        </div>
        {source ? <span className="admin-preview-source">{source}</span> : null}
      </header>
      <div className="admin-preview-divider" />
      {children}
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="admin-preview-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function ActionSection({ title, items }: { title: string; items: MonsterActionEntry[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Section title={title}>
      {items.map((item) => (
        <p key={`${title}-${item.name}`} className="admin-preview-body">
          <strong>{item.name}.</strong> {item.description}
          {item.attackBonus ? ` ${formatAttack(item)}` : ""}
          {item.damage ? ` ${item.damage}${item.damageType ? ` ${item.damageType}` : ""}` : ""}
        </p>
      ))}
    </Section>
  );
}

function formatSpellTime(spell: SpellEntry | Omit<SpellEntry, "id">) {
  if (spell.castingTimeUnit === "action" || spell.castingTimeUnit === "bonus action") {
    return spell.castingTimeUnit;
  }

  return `${spell.castingTimeValue} ${spell.castingTimeUnit}${spell.castingTimeValue === 1 ? "" : "s"}`;
}

function formatSpellRange(spell: SpellEntry | Omit<SpellEntry, "id">) {
  if (spell.rangeType === "touch" || spell.rangeType === "self") {
    return spell.rangeType;
  }

  if (spell.rangeType === "self emanation") {
    return `Self (${spell.rangeValue}-foot emanation)`;
  }

  return `${spell.rangeValue} feet`;
}

function formatSpellDuration(spell: SpellEntry | Omit<SpellEntry, "id">) {
  const prefix = spell.concentration ? "Concentration, up to " : "";

  if (spell.durationUnit === "instant") {
    return "Instantaneous";
  }

  return `${prefix}${spell.durationValue} ${spell.durationUnit}${spell.durationValue === 1 ? "" : "s"}`;
}

function formatModifier(score: number) {
  return formatSigned(Math.floor((score - 10) / 2));
}

function formatSigned(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function formatAttack(action: MonsterActionEntry) {
  const attackType = action.attackType === "other" ? "" : `${action.attackType} attack`;
  const reach = action.reachOrRange ? `, ${action.reachOrRange}` : "";
  return `(${attackType} ${formatSigned(action.attackBonus)}${reach})`.trim();
}
