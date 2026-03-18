import type { ReactNode } from "react";

import type { ClassEntry, FeatEntry, MonsterActionEntry, MonsterTemplate, SpellEntry, UserProfile } from "@shared/types";

interface RulesLookupData {
  spellEntries?: Array<SpellEntry | Omit<SpellEntry, "id">>;
  featEntries?: Array<FeatEntry | Omit<FeatEntry, "id">>;
  classEntries?: Array<ClassEntry | Omit<ClassEntry, "id">>;
}

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

export function SpellPreviewCard({
  spell,
  featEntries = [],
  classEntries = []
}: {
  spell: SpellEntry | Omit<SpellEntry, "id">;
  featEntries?: FeatEntry[];
  classEntries?: ClassEntry[];
}) {
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
        <p className="admin-preview-body"><RulesText text={spell.description} spellEntries={[spell]} featEntries={featEntries} classEntries={classEntries} /></p>
        {spell.damageNotation && (
          <p className="admin-preview-body">
            <strong>Damage:</strong> {spell.damageNotation}
            {spell.damageAbility ? ` + ${spell.damageAbility.toUpperCase()}` : ""}
          </p>
        )}
        {spell.fullDescription && <p className="admin-preview-body"><RulesText text={spell.fullDescription} spellEntries={[spell]} featEntries={featEntries} classEntries={classEntries} /></p>}
        {spell.classes.length > 0 && (
          <p className="admin-preview-footnote">
            <strong>Classes:</strong> {spell.classes.join(", ")}
          </p>
        )}
      </div>
    </PreviewFrame>
  );
}

export function FeatPreviewCard({
  feat,
  spellEntries = [],
  classEntries = []
}: {
  feat: FeatEntry | Omit<FeatEntry, "id">;
  spellEntries?: SpellEntry[];
  classEntries?: ClassEntry[];
}) {
  const subtitle = feat.prerequisites
    ? `${feat.category} (Prerequisites: ${feat.prerequisites})`
    : feat.category;

  return (
    <PreviewFrame eyebrow="Feat" title={feat.name} source={feat.source} subtitle={subtitle}>
      <div className="admin-preview-stack">
        {feat.abilityScoreIncrease && (
          <p className="admin-preview-body">
            <strong>Ability Score Increase.</strong> <RulesText text={feat.abilityScoreIncrease} spellEntries={spellEntries} classEntries={classEntries} />
          </p>
        )}
        <p className="admin-preview-body"><RulesText text={feat.description} spellEntries={spellEntries} classEntries={classEntries} /></p>
      </div>
    </PreviewFrame>
  );
}

export function MonsterPreviewCard({
  monster,
  spellEntries = [],
  featEntries = [],
  classEntries = []
}: {
  monster: MonsterTemplate | Omit<MonsterTemplate, "id">;
  spellEntries?: SpellEntry[];
  featEntries?: FeatEntry[];
  classEntries?: ClassEntry[];
}) {
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
    <PreviewFrame
      eyebrow="Monster"
      title={monster.name}
      source={monster.source}
      subtitle={`CR ${monster.challengeRating}${monster.xp ? ` (${monster.xp.toLocaleString()} XP)` : ""}`}
    >
      <div className="admin-monster-preview-head">
        <div className="admin-preview-stack">
          <div className="admin-preview-rules">
            <div><strong>AC</strong> {monster.armorClass}</div>
            <div><strong>HP</strong> {monster.hitPoints}</div>
            <div><strong>Initiative</strong> {formatSigned(monster.initiative)}</div>
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
          <strong>CR</strong> {monster.challengeRating}{monster.xp ? ` (${monster.xp.toLocaleString()} XP)` : ""} (PB {formatSigned(monster.proficiencyBonus)})
        </p>
        {monster.spellcasting.length > 0 && (
          <Section title="Spellcasting">
            {monster.spellcasting.map((entry) => (
              <p key={`${entry.label}-${entry.spells.join("|")}`} className="admin-preview-body">
                <strong>{entry.label}.</strong>{" "}
                <RulesText text={entry.spells.join(", ")} spellEntries={spellEntries} />
              </p>
            ))}
          </Section>
        )}
        {monster.traits.length > 0 && (
          <Section title="Traits">
            {monster.traits.map((trait) => (
              <p key={trait} className="admin-preview-body">
                <RulesText text={trait} spellEntries={spellEntries} featEntries={featEntries} classEntries={classEntries} />
              </p>
            ))}
          </Section>
        )}
        <ActionSection title="Actions" items={monster.actions} spellEntries={spellEntries} featEntries={featEntries} classEntries={classEntries} />
        <ActionSection title="Bonus Actions" items={monster.bonusActions} spellEntries={spellEntries} featEntries={featEntries} classEntries={classEntries} />
        <ActionSection title="Reactions" items={monster.reactions} spellEntries={spellEntries} featEntries={featEntries} classEntries={classEntries} />
        <ActionSection title={`Legendary Actions${monster.legendaryActionsUse ? ` (${monster.legendaryActionsUse})` : ""}`} items={monster.legendaryActions} spellEntries={spellEntries} featEntries={featEntries} classEntries={classEntries} />
        <ActionSection title="Lair Actions" items={monster.lairActions} spellEntries={spellEntries} featEntries={featEntries} classEntries={classEntries} />
        <ActionSection title="Regional Effects" items={monster.regionalEffects} spellEntries={spellEntries} featEntries={featEntries} classEntries={classEntries} />
        {monster.habitat && <p className="admin-preview-body"><strong>Habitat</strong> {monster.habitat}</p>}
        {monster.treasure && <p className="admin-preview-body"><strong>Treasure</strong> {monster.treasure}</p>}
      </div>
    </PreviewFrame>
  );
}

export function ClassPreviewCard({
  entry,
  spellEntries = [],
  featEntries = []
}: {
  entry: ClassEntry | Omit<ClassEntry, "id">;
  spellEntries?: SpellEntry[];
  featEntries?: FeatEntry[];
}) {
  return (
    <PreviewFrame eyebrow="Class" title={entry.name} source={entry.source}>
      <div className="admin-preview-stack">
        <p className="admin-preview-body"><RulesText text={entry.description} spellEntries={spellEntries} featEntries={featEntries} classEntries={[entry]} /></p>
        {entry.features.length > 0 && (
          <Section title="Features">
            {entry.features.map((feature) => (
              <p key={`${feature.level}-${feature.name}`} className="admin-preview-body">
                <strong>Level {feature.level}: {feature.name}.</strong> <RulesText text={feature.description} spellEntries={spellEntries} featEntries={featEntries} classEntries={[entry]} />
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

function ActionSection({
  title,
  items,
  spellEntries = [],
  featEntries = [],
  classEntries = []
}: {
  title: string;
  items: MonsterActionEntry[];
  spellEntries?: SpellEntry[];
  featEntries?: FeatEntry[];
  classEntries?: ClassEntry[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Section title={title}>
      {items.map((item) => (
        <p key={`${title}-${item.name}`} className="admin-preview-body">
          <strong>{item.name}.</strong> <RulesText text={item.description} spellEntries={spellEntries} featEntries={featEntries} classEntries={classEntries} />
          {item.attackBonus ? ` ${formatAttack(item)}` : ""}
          {item.damage ? ` ${item.damage}${item.damageType ? ` ${item.damageType}` : ""}` : ""}
        </p>
      ))}
    </Section>
  );
}

function RulesText({ text, spellEntries = [], featEntries = [], classEntries = [] }: { text: string } & RulesLookupData) {
  return <RulesTextInner text={text} spellEntries={spellEntries} featEntries={featEntries} classEntries={classEntries} disableHover={false} />;
}

function RulesTextInner({
  text,
  spellEntries = [],
  featEntries = [],
  classEntries = [],
  disableHover
}: { text: string; disableHover: boolean } & RulesLookupData) {
  const normalized = text.replace(/\n+/g, "\n");
  const parts = normalized.split(/(\{@[^}]+})/g).filter(Boolean);
  const spellLookup = new Map(spellEntries.map((entry) => [entry.name.toLowerCase(), entry]));
  const featLookup = new Map(featEntries.map((entry) => [entry.name.toLowerCase(), entry]));
  const classLookup = new Map(classEntries.map((entry) => [entry.name.toLowerCase(), entry]));

  return (
    <>
      {parts.map((part, index) => {
        if (!part.startsWith("{@")) {
          return <TextWithLineBreaks key={`${part}-${index}`} text={part} />;
        }

        const spellMatch = part.match(/^\{@spell ([^}|]+)(?:\|[^}]+)?}/i);

        if (spellMatch) {
          const spellName = spellMatch[1].trim();
          const spell = spellLookup.get(spellName.toLowerCase()) ?? null;
          return renderLinkedTag(
            part,
            index,
            spellName,
            spell ? (
              <RulesTooltip title={spell.name} subtitle={spell.level === "cantrip" ? `${spell.school} Cantrip` : `${spell.school} Level ${spell.level}`}>
                <div className="rules-tooltip-meta">
                  <span>{formatSpellTime(spell)}</span>
                  <span>{formatSpellRange(spell)}</span>
                  <span>{formatSpellDuration(spell)}</span>
                </div>
                <div className="rules-tooltip-body">
                  <RulesTextInner text={spell.description} spellEntries={spellEntries} featEntries={featEntries} classEntries={classEntries} disableHover />
                </div>
                {spell.fullDescription && spell.fullDescription !== spell.description ? (
                  <div className="rules-tooltip-body rules-tooltip-body-secondary">
                    <RulesTextInner text={spell.fullDescription} spellEntries={spellEntries} featEntries={featEntries} classEntries={classEntries} disableHover />
                  </div>
                ) : null}
              </RulesTooltip>
            ) : null,
            disableHover
          );
        }

        const featMatch = part.match(/^\{@feat ([^}|]+)(?:\|[^}]+)?}/i);

        if (featMatch) {
          const featName = featMatch[1].trim();
          const feat = featLookup.get(featName.toLowerCase()) ?? null;
          return renderLinkedTag(part, index, featName, feat ? (
            <RulesTooltip title={feat.name} subtitle={feat.category}>
              {feat.prerequisites ? <div className="rules-tooltip-meta"><span>{feat.prerequisites}</span></div> : null}
              {feat.abilityScoreIncrease ? (
                <div className="rules-tooltip-body rules-tooltip-body-secondary">
                  <strong>Ability Score Increase.</strong>{" "}
                  <RulesTextInner text={feat.abilityScoreIncrease} spellEntries={spellEntries} featEntries={featEntries} classEntries={classEntries} disableHover />
                </div>
              ) : null}
              <div className="rules-tooltip-body">
                <RulesTextInner text={feat.description} spellEntries={spellEntries} featEntries={featEntries} classEntries={classEntries} disableHover />
              </div>
            </RulesTooltip>
          ) : null, disableHover);
        }

        const classMatch = part.match(/^\{@class ([^}|]+)(?:\|[^}]+)?}/i);

        if (classMatch) {
          const className = classMatch[1].trim();
          const classEntry = classLookup.get(className.toLowerCase()) ?? null;
          return renderLinkedTag(part, index, className, classEntry ? (
            <RulesTooltip title={classEntry.name} subtitle={classEntry.source}>
              <div className="rules-tooltip-body">
                <RulesTextInner text={classEntry.description} spellEntries={spellEntries} featEntries={featEntries} classEntries={classEntries} disableHover />
              </div>
              {classEntry.features.slice(0, 3).map((feature) => (
                <div key={`${classEntry.name}-${feature.level}-${feature.name}`} className="rules-tooltip-body rules-tooltip-body-secondary">
                  <strong>Level {feature.level}: {feature.name}.</strong>{" "}
                  <RulesTextInner text={feature.description} spellEntries={spellEntries} featEntries={featEntries} classEntries={classEntries} disableHover />
                </div>
              ))}
            </RulesTooltip>
          ) : null, disableHover);
        }

        const dcMatch = part.match(/^\{@dc ([^}]+)}/i);

        if (dcMatch) {
          return <span key={`${part}-${index}`}>DC {dcMatch[1]}</span>;
        }

        const hitMatch = part.match(/^\{@hit ([^}]+)}/i);

        if (hitMatch) {
          return <span key={`${part}-${index}`}>{hitMatch[1]}</span>;
        }

        const damageMatch = part.match(/^\{@damage ([^}]+)}/i);

        if (damageMatch) {
          return <span key={`${part}-${index}`}>{damageMatch[1]}</span>;
        }

        const diceMatch = part.match(/^\{@dice ([^}]+)}/i);

        if (diceMatch) {
          return <span key={`${part}-${index}`}>{diceMatch[1]}</span>;
        }

        const attackMatch = part.match(/^\{@atkr ([^}]+)}/i);

        if (attackMatch) {
          return <span key={`${part}-${index}`}>{formatAttackTag(attackMatch[1])}</span>;
        }

        const rechargeMatch = part.match(/^\{@recharge ([^}]+)}/i);

        if (rechargeMatch) {
          return <span key={`${part}-${index}`}>(Recharge {rechargeMatch[1]})</span>;
        }

        if (/^\{@actSave\b/i.test(part)) {
          return <span key={`${part}-${index}`}>{formatActionTag(part, "Saving Throw:")}</span>;
        }

        if (/^\{@actSaveFailBy\b/i.test(part)) {
          return <span key={`${part}-${index}`}>{formatActionTag(part, "Fail by")}</span>;
        }

        if (/^\{@actSaveFail\b/i.test(part)) {
          return <span key={`${part}-${index}`}>Failure:</span>;
        }

        if (/^\{@actSaveSuccessOrFail\b/i.test(part)) {
          return <span key={`${part}-${index}`}>Success or Failure:</span>;
        }

        if (/^\{@actSaveSuccess\b/i.test(part)) {
          return <span key={`${part}-${index}`}>Success:</span>;
        }

        if (/^\{@actTrigger\b/i.test(part)) {
          return <span key={`${part}-${index}`}>Trigger:</span>;
        }

        if (/^\{@actResponse\b/i.test(part)) {
          return <span key={`${part}-${index}`}>Response:</span>;
        }

        if (/^\{@h}/i.test(part)) {
          return <span key={`${part}-${index}`}>Hit:</span>;
        }

        const genericMatch = part.match(/^\{@[^ ]+ ([^}|]+)(?:\|[^}]+)?}/i);
        return renderLinkedTag(part, index, genericMatch?.[1] ?? part, genericMatch ? (
          <RulesTooltip title={genericMatch[1]} subtitle={part.match(/^\{@([^ }]+)/)?.[1] ?? "Reference"}>
            <div className="rules-tooltip-body rules-tooltip-body-secondary">
              <TextWithLineBreaks text={genericMatch[1]} />
            </div>
          </RulesTooltip>
        ) : null, disableHover, "rules-tag");
      })}
    </>
  );
}

function TextWithLineBreaks({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <>
      {lines.map((line, index) => (
        <span key={`${line}-${index}`}>
          {index > 0 ? <br /> : null}
          {line}
        </span>
      ))}
    </>
  );
}

function formatSpellTime(spell: SpellEntry | Omit<SpellEntry, "id">) {
  if (spell.castingTimeUnit === "action" || spell.castingTimeUnit === "bonus action" || spell.castingTimeUnit === "reaction") {
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

  if (spell.rangeType === "sight") {
    return "Sight";
  }

  if (spell.rangeType === "unlimited") {
    return "Unlimited";
  }

  if (spell.rangeType === "special") {
    return "Special";
  }

  return `${spell.rangeValue} feet`;
}

function formatSpellDuration(spell: SpellEntry | Omit<SpellEntry, "id">) {
  const prefix = spell.concentration ? "Concentration, up to " : "";

  if (spell.durationUnit === "instant") {
    return "Instantaneous";
  }

  if (spell.durationUnit === "permanent") {
    return "Permanent";
  }

  if (spell.durationUnit === "special") {
    return "Special";
  }

  return `${prefix}${spell.durationValue} ${spell.durationUnit}${spell.durationValue === 1 ? "" : "s"}`;
}

function formatActionTag(value: string, fallback: string) {
  const inner = value.replace(/^\{@[^ ]+\s*|\}$/g, "").trim();
  if (!inner) {
    return fallback;
  }

  return `${fallback} ${inner.replace(/\|.*$/, "").trim()}`;
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

function formatAttackTag(value: string) {
  const normalized = value.toLowerCase();

  if (normalized === "m") {
    return "Melee Attack:";
  }

  if (normalized === "r") {
    return "Ranged Attack:";
  }

  if (normalized.includes("m") && normalized.includes("r")) {
    return "Melee or Ranged Attack:";
  }

  return "";
}

function renderLinkedTag(
  part: string,
  index: number,
  label: string,
  tooltip: ReactNode | null,
  disableHover = false,
  className = "rules-tag rules-tag-link"
) {
  return (
    <span key={`${part}-${index}`} className={disableHover ? "rules-tag" : className}>
      {label}
      {!disableHover && tooltip ? <span className="rules-tag-tooltip">{tooltip}</span> : null}
    </span>
  );
}

function RulesTooltip({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <span className="rules-tooltip-card">
      <strong>{title}</strong>
      {subtitle ? <small>{subtitle}</small> : null}
      {children}
    </span>
  );
}
