import type { ReactNode } from "react";

import type { ClassEntry, CompendiumReferenceEntry, FeatEntry, MonsterActionEntry, MonsterTemplate, SpellEntry, UserProfile } from "@shared/types";
import { resolveAssetUrl } from "../../lib/assets";

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
  const displayedClasses = formatSpellClassList(spell);
  const referencingClasses = getReferencingClassesForSpell(spell.name, classEntries);

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
        {spell.higherLevelDescription && (
          <p className="admin-preview-body">
            <strong>Higher Levels.</strong>{" "}
            <RulesText text={spell.higherLevelDescription} spellEntries={[spell]} featEntries={featEntries} classEntries={classEntries} />
          </p>
        )}
        {spell.fullDescription && spell.fullDescription !== spell.description && (
          <p className="admin-preview-body"><RulesText text={spell.fullDescription} spellEntries={[spell]} featEntries={featEntries} classEntries={classEntries} /></p>
        )}
        <p className="admin-preview-footnote">
          <strong>Classes:</strong> {displayedClasses || "Unavailable in imported source data"}
        </p>
        {referencingClasses.length > 0 ? (
          <p className="admin-preview-footnote">
            <strong>Referenced by classes:</strong> {referencingClasses.join(", ")}
          </p>
        ) : null}
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
            <img src={resolveAssetUrl(monster.imageUrl)} alt={monster.name} />
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
  const normalizedDescription = normalizeClassPreviewDescription(entry);
  const referencedSpells = getReferencedSpellsForClass(entry, spellEntries);

  return (
    <PreviewFrame eyebrow="Class" title={entry.name} source={entry.source}>
      <div className="admin-preview-stack">
        <div className="admin-preview-rules">
          {entry.hitDieFaces > 0 && <div><strong>Hit Die:</strong> d{entry.hitDieFaces}</div>}
          {entry.primaryAbilities.length > 0 && <div><strong>Primary Ability:</strong> {entry.primaryAbilities.join(" or ")}</div>}
          {entry.savingThrowProficiencies.length > 0 && <div><strong>Saving Throws:</strong> {entry.savingThrowProficiencies.join(", ")}</div>}
          {hasStartingProficiencies(entry) && <div><strong>Starting Proficiencies:</strong> {formatStartingProficiencies(entry)}</div>}
        </div>
        {normalizedDescription ? (
          <p className="admin-preview-body"><RulesText text={normalizedDescription} spellEntries={spellEntries} featEntries={featEntries} classEntries={[entry]} /></p>
        ) : null}
        {referencedSpells.length > 0 && (
          <Section title="Referenced Spells">
            <p className="admin-preview-body">
              {referencedSpells.map((spellName, index) => (
                <span key={spellName}>
                  {index > 0 ? ", " : null}
                  <RulesText text={`{@spell ${spellName}}`} spellEntries={spellEntries} featEntries={featEntries} classEntries={[entry]} />
                </span>
              ))}
            </p>
          </Section>
        )}
        {entry.features.length > 0 && (
          <Section title="Features">
            {entry.features.map((feature) => (
              <p key={feature.reference || `${feature.level}-${feature.name}`} className="admin-preview-body">
                <strong>Level {feature.level}: {feature.name}.</strong> <RulesText text={feature.description} spellEntries={spellEntries} featEntries={featEntries} classEntries={[entry]} />
              </p>
            ))}
          </Section>
        )}
        {entry.subclasses.length > 0 && (
          <Section title="Subclasses">
            {entry.subclasses.map((subclass) => (
              <div key={subclass.id} className="admin-preview-body">
                <strong>{subclass.name}</strong> {subclass.source ? `(${subclass.source})` : ""}
                {subclass.description ? (
                  <>
                    {" "}
                    <RulesText text={subclass.description} spellEntries={spellEntries} featEntries={featEntries} classEntries={[entry]} />
                  </>
                ) : null}
                {subclass.features.length > 0 ? (
                  <div>
                    {subclass.features.map((feature) => (
                      <p key={`${subclass.id}-${feature.reference || `${feature.level}-${feature.name}`}`} className="admin-preview-body">
                        <strong>Level {feature.level}: {feature.name}.</strong>{" "}
                        <RulesText text={feature.description} spellEntries={spellEntries} featEntries={featEntries} classEntries={[entry]} />
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </Section>
        )}
        {entry.tables.map((table) => (
          <section key={table.name} className="admin-preview-section">
            <h4><RulesText text={table.name} spellEntries={spellEntries} featEntries={featEntries} classEntries={[entry]} /></h4>
            <div className="admin-class-table-wrap">
              <table className="admin-class-table">
                <thead>
                  <tr>
                    <th>Level</th>
                    {table.columns.map((column) => (
                      <th key={column}>
                        <RulesText text={column} spellEntries={spellEntries} featEntries={featEntries} classEntries={[entry]} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, rowIndex) => (
                    <tr key={`${table.name}-${rowIndex}`}>
                      <td>{rowIndex + 1}</td>
                      {row.map((cell, cellIndex) => (
                        <td key={`${table.name}-${rowIndex}-${cellIndex}`}>
                          <RulesText text={cell} spellEntries={spellEntries} featEntries={featEntries} classEntries={[entry]} />
                        </td>
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

export function ReferencePreviewCard({
  title,
  eyebrow,
  entry
}: {
  title: string;
  eyebrow: string;
  entry: CompendiumReferenceEntry;
}) {
  return (
    <PreviewFrame eyebrow={eyebrow} title={entry.name} source={entry.source} subtitle={entry.category}>
      <div className="admin-preview-stack">
        <p className="admin-preview-body">
          <RulesText text={entry.description} />
        </p>
        {entry.tags.length > 0 ? (
          <p className="admin-preview-footnote">
            <strong>{title} tags:</strong> {entry.tags.join(", ")}
          </p>
        ) : null}
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

function formatSpellClassList(spell: SpellEntry | Omit<SpellEntry, "id">) {
  if (spell.classReferences.length > 0) {
    return Array.from(
      new Set(
        spell.classReferences.map((reference) =>
          reference.kind === "subclass" || reference.kind === "subclassVariant"
            ? `${reference.name} (${reference.className})`
            : reference.name
        )
      )
    ).join(", ");
  }

  return spell.classes.join(", ");
}

function getReferencingClassesForSpell(
  spellName: string,
  classEntries: Array<ClassEntry | Omit<ClassEntry, "id">>
) {
  const pattern = new RegExp(`\\{@spell\\s+${escapeRegExp(spellName)}(?:\\|[^}]*)?}`, "i");

  return classEntries
    .filter((entry) => {
      const texts = [
        entry.description,
        ...entry.features.map((feature) => feature.description),
        ...entry.tables.flatMap((table) => [table.name, ...table.columns, ...table.rows.flat()])
      ];

      return texts.some((text) => pattern.test(text));
    })
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function hasStartingProficiencies(entry: ClassEntry | Omit<ClassEntry, "id">) {
  return (
    entry.startingProficiencies.armor.length > 0 ||
    entry.startingProficiencies.weapons.length > 0 ||
    entry.startingProficiencies.tools.length > 0
  );
}

function formatStartingProficiencies(entry: ClassEntry | Omit<ClassEntry, "id">) {
  const parts = [
    entry.startingProficiencies.armor.length > 0 ? `Armor: ${entry.startingProficiencies.armor.join(", ")}` : "",
    entry.startingProficiencies.weapons.length > 0 ? `Weapons: ${entry.startingProficiencies.weapons.join(", ")}` : "",
    entry.startingProficiencies.tools.length > 0 ? `Tools: ${entry.startingProficiencies.tools.join(", ")}` : ""
  ].filter(Boolean);

  return parts.join(" • ");
}

function normalizeClassPreviewDescription(entry: ClassEntry | Omit<ClassEntry, "id">) {
  const duplicatePrefixes = [
    "Primary Ability:",
    "Hit Die:",
    "Saving Throw Proficiencies:",
    "Armor Training:",
    "Starting Proficiencies:",
    "Weapon Proficiencies:",
    "Tool Proficiencies:"
  ];

  return entry.description
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !duplicatePrefixes.some((prefix) => line.startsWith(prefix)))
    .join("\n");
}

function getReferencedSpellsForClass(
  entry: ClassEntry | Omit<ClassEntry, "id">,
  spellEntries: Array<SpellEntry | Omit<SpellEntry, "id">>
) {
  const availableSpellNames = new Set(spellEntries.map((spell) => spell.name.toLowerCase()));
  const rawTexts = [
    entry.description,
    ...entry.features.map((feature) => feature.description),
    ...entry.tables.flatMap((table) => [table.name, ...table.columns, ...table.rows.flat()])
  ];
  const matches = rawTexts
    .flatMap((text) => Array.from(text.matchAll(/\{@spell ([^}|]+)(?:\|[^}]+)?}/gi), (match) => match[1].trim()))
    .filter((spellName) => availableSpellNames.has(spellName.toLowerCase()));

  return Array.from(new Set(matches)).sort((left, right) => left.localeCompare(right));
}

function parseFilterTag(text: string) {
  const match = text.match(/^\{@filter ([^|}]+)\|([^|}]+)(?:\|([^}]+))?}/i);

  if (!match) {
    return null;
  }

  const filters = (match[3] ?? "")
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, entry) => {
      const [key, ...rest] = entry.split("=");

      if (!key || rest.length === 0) {
        return accumulator;
      }

      accumulator[key.trim().toLowerCase()] = rest.join("=").trim();
      return accumulator;
    }, {});

  return {
    label: match[1].trim(),
    target: match[2].trim().toLowerCase(),
    filters
  };
}

function getFilteredSpellEntries(
  spellEntries: Array<SpellEntry | Omit<SpellEntry, "id">>,
  filters: Record<string, string>
) {
  const classFilters = splitFilterValues(filters.class).map((value) => value.toLowerCase());
  const levelFilters = splitFilterValues(filters.level);
  const schoolFilters = splitFilterValues(filters.school).map(normalizeSpellSchoolFilter).filter(Boolean);

  return [...spellEntries]
    .filter((spell) => {
      if (classFilters.length > 0) {
        const spellClassNames = new Set(
          [
            ...spell.classes,
            ...spell.classReferences.flatMap((reference) => [
              reference.name,
              reference.className,
              `${reference.name} (${reference.className})`
            ])
          ]
            .filter(Boolean)
            .map((entry) => entry.toLowerCase())
        );

        if (!classFilters.some((classFilter) => spellClassNames.has(classFilter))) {
          return false;
        }
      }

      if (levelFilters.length > 0) {
        const spellLevel = spell.level === "cantrip" ? "0" : String(spell.level);
        const excludedLevels = levelFilters.filter((value) => value.startsWith("!")).map((value) => value.slice(1));
        const includedLevels = levelFilters.filter((value) => !value.startsWith("!"));

        if (excludedLevels.includes(spellLevel)) {
          return false;
        }

        if (includedLevels.length > 0 && !includedLevels.includes(spellLevel)) {
          return false;
        }
      }

      if (schoolFilters.length > 0 && !schoolFilters.includes(spell.school)) {
        return false;
      }

      return true;
    })
    .sort((left, right) => {
      const leftLevel = left.level === "cantrip" ? 0 : left.level;
      const rightLevel = right.level === "cantrip" ? 0 : right.level;

      if (leftLevel !== rightLevel) {
        return leftLevel - rightLevel;
      }

      return left.name.localeCompare(right.name);
    });
}

function splitFilterValues(value = "") {
  return value
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeSpellSchoolFilter(value: string) {
  const mapping: Record<string, SpellEntry["school"]> = {
    A: "Abjuration",
    C: "Conjuration",
    D: "Divination",
    E: "Enchantment",
    V: "Evocation",
    I: "Illusion",
    N: "Necromancy",
    T: "Transmutation"
  };

  const normalized = value.trim().toUpperCase();
  return mapping[normalized] ?? "";
}

function SpellFilterTooltip({ spells }: { spells: Array<SpellEntry | Omit<SpellEntry, "id">> }) {
  const limitedSpells = spells.slice(0, 24);
  const groups = limitedSpells.reduce<Array<{ label: string; spells: string[] }>>((accumulator, spell) => {
    const label = spell.level === "cantrip" ? "Cantrips" : `Level ${spell.level}`;
    const currentGroup = accumulator.at(-1);

    if (!currentGroup || currentGroup.label !== label) {
      accumulator.push({ label, spells: [spell.name] });
      return accumulator;
    }

    currentGroup.spells.push(spell.name);
    return accumulator;
  }, []);

  return (
    <>
      {groups.map((group) => (
        <div key={group.label} className="rules-tooltip-body rules-tooltip-body-secondary">
          <strong>{group.label}.</strong> {group.spells.join(", ")}
        </div>
      ))}
      {spells.length > limitedSpells.length ? (
        <div className="rules-tooltip-body rules-tooltip-body-secondary">
          +{spells.length - limitedSpells.length} more
        </div>
      ) : null}
    </>
  );
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

        const filterTag = parseFilterTag(part);

        if (filterTag) {
          const filteredSpells =
            filterTag.target === "spells"
              ? getFilteredSpellEntries(spellEntries, filterTag.filters)
              : [];

          return renderLinkedTag(
            part,
            index,
            filterTag.label,
            filterTag.target === "spells" ? (
              <RulesTooltip
                title={filterTag.label}
                subtitle={
                  filteredSpells.length > 0
                    ? `${filteredSpells.length} imported spell${filteredSpells.length === 1 ? "" : "s"}`
                    : "No imported spells matched"
                }
              >
                {filteredSpells.length > 0 ? (
                  <SpellFilterTooltip spells={filteredSpells} />
                ) : (
                  <div className="rules-tooltip-body rules-tooltip-body-secondary">
                    No imported spells matched this filter. 5etools spell source files often omit class-list metadata, so
                    spell-list hovers need spells imported with class references.
                  </div>
                )}
              </RulesTooltip>
            ) : null,
            disableHover
          );
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
