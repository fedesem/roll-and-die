import { type ReactNode, useEffect, useRef, useState } from "react";

import type {
  CampaignSourceBook,
  ClassEntry,
  CompendiumItemEntry,
  CompendiumOptionalFeatureEntry,
  CompendiumReferenceEntry,
  FeatEntry,
  MonsterTemplate,
  SpellEntry,
  UserProfile
} from "@shared/types";
import { FloatingLayer, anchorFromRect } from "../FloatingLayer";
import { MonsterStatBlock } from "../monster/MonsterStatBlock";

interface RulesLookupData {
  spellEntries?: Array<SpellEntry | Omit<SpellEntry, "id">>;
  featEntries?: Array<FeatEntry | Omit<FeatEntry, "id">>;
  classEntries?: Array<ClassEntry | Omit<ClassEntry, "id">>;
  variantRuleEntries?: Array<CompendiumReferenceEntry | Omit<CompendiumReferenceEntry, "id">>;
  conditionEntries?: Array<CompendiumReferenceEntry | Omit<CompendiumReferenceEntry, "id">>;
  actionEntries?: Array<CompendiumReferenceEntry | Omit<CompendiumReferenceEntry, "id">>;
  itemEntries?: Array<CompendiumItemEntry | Omit<CompendiumItemEntry, "id">>;
  optionalFeatureEntries?: Array<CompendiumOptionalFeatureEntry | Omit<CompendiumOptionalFeatureEntry, "id">>;
  languageEntries?: Array<CompendiumReferenceEntry | Omit<CompendiumReferenceEntry, "id">>;
  skillEntries?: Array<CompendiumReferenceEntry | Omit<CompendiumReferenceEntry, "id">>;
}

interface PreviewFrameProps {
  eyebrow: string;
  title: string;
  source?: string;
  sourceTitle?: string;
  subtitle?: string;
  children: ReactNode;
}

export function PreviewPlaceholder({ title, message }: { title: string; message: string }) {
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

export function PreviewError({ title, message }: { title: string; message: string }) {
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
  classEntries = [],
  variantRuleEntries = [],
  conditionEntries = [],
  actionEntries = [],
  sourceTitle
}: {
  spell: SpellEntry | Omit<SpellEntry, "id">;
  featEntries?: FeatEntry[];
  classEntries?: ClassEntry[];
  variantRuleEntries?: CompendiumReferenceEntry[];
  conditionEntries?: CompendiumReferenceEntry[];
  actionEntries?: CompendiumReferenceEntry[];
  sourceTitle?: string;
}) {
  const subtitle = spell.level === "cantrip" ? `${spell.school} Cantrip` : `${spell.school} Level ${spell.level}`;
  const components = [spell.components.verbal ? "V" : null, spell.components.somatic ? "S" : null, spell.components.material ? "M" : null]
    .filter(Boolean)
    .join(", ");
  const displayedClasses = formatSpellClassList(spell);
  const referencingClasses = getReferencingClassesForSpell(spell.name, classEntries);

  return (
    <PreviewFrame eyebrow="Spell" title={spell.name} source={spell.source} sourceTitle={sourceTitle} subtitle={subtitle}>
      <div className="admin-preview-stack">
        <div className="admin-preview-rules">
          <div>
            <strong>Casting Time:</strong> {formatSpellTime(spell)}
          </div>
          <div>
            <strong>Range:</strong> {formatSpellRange(spell)}
          </div>
          <div>
            <strong>Components:</strong> {components || "None"}
            {spell.components.materialText ? ` (${spell.components.materialText})` : ""}
          </div>
          <div>
            <strong>Duration:</strong> {formatSpellDuration(spell)}
          </div>
        </div>
        <p className="admin-preview-body">
          <RulesText
            text={spell.description}
            spellEntries={[spell]}
            featEntries={featEntries}
            classEntries={classEntries}
            variantRuleEntries={variantRuleEntries}
            conditionEntries={conditionEntries}
            actionEntries={actionEntries}
          />
        </p>
        {spell.damageNotation && (
          <p className="admin-preview-body">
            <strong>Damage:</strong> {spell.damageNotation}
            {spell.damageAbility ? ` + ${spell.damageAbility.toUpperCase()}` : ""}
          </p>
        )}
        {spell.higherLevelDescription && (
          <p className="admin-preview-body">
            <strong>Higher Levels.</strong>{" "}
            <RulesText
              text={spell.higherLevelDescription}
              spellEntries={[spell]}
              featEntries={featEntries}
              classEntries={classEntries}
              variantRuleEntries={variantRuleEntries}
              conditionEntries={conditionEntries}
              actionEntries={actionEntries}
            />
          </p>
        )}
        {spell.fullDescription && spell.fullDescription !== spell.description && (
          <p className="admin-preview-body">
            <RulesText
              text={spell.fullDescription}
              spellEntries={[spell]}
              featEntries={featEntries}
              classEntries={classEntries}
              variantRuleEntries={variantRuleEntries}
              conditionEntries={conditionEntries}
              actionEntries={actionEntries}
            />
          </p>
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
  classEntries = [],
  variantRuleEntries = [],
  conditionEntries = [],
  actionEntries = [],
  sourceTitle
}: {
  feat: FeatEntry | Omit<FeatEntry, "id">;
  spellEntries?: SpellEntry[];
  classEntries?: ClassEntry[];
  variantRuleEntries?: CompendiumReferenceEntry[];
  conditionEntries?: CompendiumReferenceEntry[];
  actionEntries?: CompendiumReferenceEntry[];
  sourceTitle?: string;
}) {
  const subtitle = feat.prerequisites ? `${feat.category} (Prerequisites: ${feat.prerequisites})` : feat.category;

  return (
    <PreviewFrame eyebrow="Feat" title={feat.name} source={feat.source} sourceTitle={sourceTitle} subtitle={subtitle}>
      <div className="admin-preview-stack">
        {feat.abilityScoreIncrease && (
          <p className="admin-preview-body">
            <strong>Ability Score Increase.</strong>{" "}
            <RulesText
              text={feat.abilityScoreIncrease}
              spellEntries={spellEntries}
              classEntries={classEntries}
              variantRuleEntries={variantRuleEntries}
              conditionEntries={conditionEntries}
              actionEntries={actionEntries}
            />
          </p>
        )}
        <p className="admin-preview-body">
          <RulesText
            text={feat.description}
            spellEntries={spellEntries}
            classEntries={classEntries}
            variantRuleEntries={variantRuleEntries}
            conditionEntries={conditionEntries}
            actionEntries={actionEntries}
          />
        </p>
      </div>
    </PreviewFrame>
  );
}

export function MonsterPreviewCard({
  monster,
  spellEntries = [],
  featEntries = [],
  classEntries = [],
  variantRuleEntries = [],
  conditionEntries = [],
  actionEntries = [],
  sourceTitle
}: {
  monster: MonsterTemplate | Omit<MonsterTemplate, "id">;
  spellEntries?: SpellEntry[];
  featEntries?: FeatEntry[];
  classEntries?: ClassEntry[];
  variantRuleEntries?: CompendiumReferenceEntry[];
  conditionEntries?: CompendiumReferenceEntry[];
  actionEntries?: CompendiumReferenceEntry[];
  sourceTitle?: string;
}) {
  return (
    <MonsterStatBlock
      monster={monster}
      eyebrow="Monster"
      sourceTitle={sourceTitle}
      className="admin-preview-card"
      renderText={(text) => (
        <RulesText
          text={text}
          spellEntries={spellEntries}
          featEntries={featEntries}
          classEntries={classEntries}
          variantRuleEntries={variantRuleEntries}
          conditionEntries={conditionEntries}
          actionEntries={actionEntries}
        />
      )}
    />
  );
}

export function ClassPreviewCard({
  entry,
  spellEntries = [],
  featEntries = [],
  variantRuleEntries = [],
  conditionEntries = [],
  actionEntries = [],
  sourceTitle
}: {
  entry: ClassEntry | Omit<ClassEntry, "id">;
  spellEntries?: SpellEntry[];
  featEntries?: FeatEntry[];
  variantRuleEntries?: CompendiumReferenceEntry[];
  conditionEntries?: CompendiumReferenceEntry[];
  actionEntries?: CompendiumReferenceEntry[];
  sourceTitle?: string;
}) {
  const normalizedDescription = normalizeClassPreviewDescription(entry);
  const referencedSpells = getReferencedSpellsForClass(entry, spellEntries);

  return (
    <PreviewFrame eyebrow="Class" title={entry.name} source={entry.source} sourceTitle={sourceTitle}>
      <div className="admin-preview-stack">
        <div className="admin-preview-rules">
          {entry.hitDieFaces > 0 && (
            <div>
              <strong>Hit Die:</strong> d{entry.hitDieFaces}
            </div>
          )}
          {entry.primaryAbilities.length > 0 && (
            <div>
              <strong>Primary Ability:</strong> {entry.primaryAbilities.join(" or ")}
            </div>
          )}
          {entry.savingThrowProficiencies.length > 0 && (
            <div>
              <strong>Saving Throws:</strong> {entry.savingThrowProficiencies.join(", ")}
            </div>
          )}
          {hasStartingProficiencies(entry) && (
            <div>
              <strong>Starting Proficiencies:</strong> {formatStartingProficiencies(entry)}
            </div>
          )}
        </div>
        {normalizedDescription ? (
          <p className="admin-preview-body">
            <RulesText
              text={normalizedDescription}
              spellEntries={spellEntries}
              featEntries={featEntries}
              classEntries={[entry]}
              variantRuleEntries={variantRuleEntries}
              conditionEntries={conditionEntries}
              actionEntries={actionEntries}
            />
          </p>
        ) : null}
        {referencedSpells.length > 0 && (
          <Section title="Referenced Spells">
            <p className="admin-preview-body">
              {referencedSpells.map((spellName, index) => (
                <span key={spellName}>
                  {index > 0 ? ", " : null}
                  <RulesText
                    text={`{@spell ${spellName}}`}
                    spellEntries={spellEntries}
                    featEntries={featEntries}
                    classEntries={[entry]}
                    variantRuleEntries={variantRuleEntries}
                    conditionEntries={conditionEntries}
                    actionEntries={actionEntries}
                  />
                </span>
              ))}
            </p>
          </Section>
        )}
        {entry.features.length > 0 && (
          <Section title="Features">
            {entry.features.map((feature) => (
              <p key={feature.reference || `${feature.level}-${feature.name}`} className="admin-preview-body">
                <strong>
                  Level {feature.level}: {feature.name}.
                </strong>{" "}
                <RulesText
                  text={feature.description}
                  spellEntries={spellEntries}
                  featEntries={featEntries}
                  classEntries={[entry]}
                  variantRuleEntries={variantRuleEntries}
                  conditionEntries={conditionEntries}
                  actionEntries={actionEntries}
                />
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
                    <RulesText
                      text={subclass.description}
                      spellEntries={spellEntries}
                      featEntries={featEntries}
                      classEntries={[entry]}
                      variantRuleEntries={variantRuleEntries}
                      conditionEntries={conditionEntries}
                      actionEntries={actionEntries}
                    />
                  </>
                ) : null}
                {subclass.features.length > 0 ? (
                  <div>
                    {subclass.features.map((feature) => (
                      <p key={`${subclass.id}-${feature.reference || `${feature.level}-${feature.name}`}`} className="admin-preview-body">
                        <strong>
                          Level {feature.level}: {feature.name}.
                        </strong>{" "}
                        <RulesText
                          text={feature.description}
                          spellEntries={spellEntries}
                          featEntries={featEntries}
                          classEntries={[entry]}
                          variantRuleEntries={variantRuleEntries}
                          conditionEntries={conditionEntries}
                          actionEntries={actionEntries}
                        />
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
            <h4>
              <RulesText
                text={table.name}
                spellEntries={spellEntries}
                featEntries={featEntries}
                classEntries={[entry]}
                conditionEntries={conditionEntries}
              />
            </h4>
            <div className="admin-class-table-wrap">
              <table className="admin-class-table">
                <thead>
                  <tr>
                    <th>Level</th>
                    {table.columns.map((column) => (
                      <th key={column}>
                        <RulesText
                          text={column}
                          spellEntries={spellEntries}
                          featEntries={featEntries}
                          classEntries={[entry]}
                          variantRuleEntries={variantRuleEntries}
                          conditionEntries={conditionEntries}
                          actionEntries={actionEntries}
                        />
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
                          <RulesText
                            text={cell}
                            spellEntries={spellEntries}
                            featEntries={featEntries}
                            classEntries={[entry]}
                            variantRuleEntries={variantRuleEntries}
                            conditionEntries={conditionEntries}
                            actionEntries={actionEntries}
                          />
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
  entry,
  spellEntries = [],
  featEntries = [],
  classEntries = [],
  variantRuleEntries = [],
  conditionEntries = [],
  actionEntries = [],
  sourceTitle
}: {
  title: string;
  eyebrow: string;
  entry: CompendiumReferenceEntry;
  spellEntries?: SpellEntry[];
  featEntries?: FeatEntry[];
  classEntries?: ClassEntry[];
  variantRuleEntries?: CompendiumReferenceEntry[];
  conditionEntries?: CompendiumReferenceEntry[];
  actionEntries?: CompendiumReferenceEntry[];
  sourceTitle?: string;
}) {
  return (
    <PreviewFrame eyebrow={eyebrow} title={entry.name} source={entry.source} sourceTitle={sourceTitle} subtitle={entry.category}>
      <div className="admin-preview-stack">
        <p className="admin-preview-body">
          <RulesText
            text={entry.entries || entry.description}
            spellEntries={spellEntries}
            featEntries={featEntries}
            classEntries={classEntries}
            variantRuleEntries={variantRuleEntries}
            conditionEntries={conditionEntries}
            actionEntries={actionEntries}
          />
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

export function BookPreviewCard({ entry }: { entry: CampaignSourceBook }) {
  return (
    <PreviewFrame eyebrow="Book" title={entry.name} source={entry.source} sourceTitle={entry.name} subtitle={entry.group}>
      <div className="admin-preview-stack">
        <div className="admin-preview-keyvalue">
          <span>Published</span>
          <strong>{entry.published || "Unknown"}</strong>
        </div>
        <div className="admin-preview-keyvalue">
          <span>Author</span>
          <strong>{entry.author || "Unknown"}</strong>
        </div>
      </div>
    </PreviewFrame>
  );
}

function PreviewFrame({ eyebrow, title, source, sourceTitle, subtitle, children }: PreviewFrameProps) {
  return (
    <section className="admin-preview-card">
      <header className="admin-preview-header">
        <div>
          <p className="panel-label">{eyebrow}</p>
          <h3 className="admin-preview-title">{title}</h3>
          {subtitle ? <p className="admin-preview-subtitle">{subtitle}</p> : null}
        </div>
        {source ? (
          <span className="admin-preview-source" title={sourceTitle ?? source}>
            {source}
          </span>
        ) : null}
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

export function RulesText({
  text,
  spellEntries = [],
  featEntries = [],
  classEntries = [],
  variantRuleEntries = [],
  conditionEntries = [],
  actionEntries = [],
  itemEntries = [],
  optionalFeatureEntries = [],
  languageEntries = [],
  skillEntries = []
}: { text: string } & RulesLookupData) {
  return (
    <RulesTextInner
      text={text}
      spellEntries={spellEntries}
      featEntries={featEntries}
      classEntries={classEntries}
      variantRuleEntries={variantRuleEntries}
      conditionEntries={conditionEntries}
      actionEntries={actionEntries}
      itemEntries={itemEntries}
      optionalFeatureEntries={optionalFeatureEntries}
      languageEntries={languageEntries}
      skillEntries={skillEntries}
      disableHover={false}
    />
  );
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

function getReferencingClassesForSpell(spellName: string, classEntries: Array<ClassEntry | Omit<ClassEntry, "id">>) {
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

function getReferencedSpellsForClass(entry: ClassEntry | Omit<ClassEntry, "id">, spellEntries: Array<SpellEntry | Omit<SpellEntry, "id">>) {
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

function getFilteredSpellEntries(spellEntries: Array<SpellEntry | Omit<SpellEntry, "id">>, filters: Record<string, string>) {
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
        <div className="rules-tooltip-body rules-tooltip-body-secondary">+{spells.length - limitedSpells.length} more</div>
      ) : null}
    </>
  );
}

function RulesTextInner({
  text,
  spellEntries = [],
  featEntries = [],
  classEntries = [],
  variantRuleEntries = [],
  conditionEntries = [],
  actionEntries = [],
  itemEntries = [],
  optionalFeatureEntries = [],
  languageEntries = [],
  skillEntries = [],
  disableHover
}: { text: string; disableHover: boolean } & RulesLookupData) {
  const normalized = text.replace(/\n+/g, "\n");
  const parts = normalized.split(/(\{@[^}]+})/g).filter(Boolean);
  const spellLookup = new Map(spellEntries.map((entry) => [entry.name.toLowerCase(), entry]));
  const featLookup = new Map(featEntries.map((entry) => [entry.name.toLowerCase(), entry]));
  const classLookup = new Map(classEntries.map((entry) => [entry.name.toLowerCase(), entry]));
  const variantRuleLookup = new Map(variantRuleEntries.map((entry) => [entry.name.toLowerCase(), entry]));
  const conditionLookup = new Map(conditionEntries.map((entry) => [entry.name.toLowerCase(), entry]));
  const actionLookup = new Map(actionEntries.map((entry) => [entry.name.toLowerCase(), entry]));
  const itemLookup = new Map(itemEntries.map((entry) => [entry.name.toLowerCase(), entry]));
  const optionalFeatureLookup = new Map(optionalFeatureEntries.map((entry) => [entry.name.toLowerCase(), entry]));
  const languageLookup = new Map(languageEntries.map((entry) => [entry.name.toLowerCase(), entry]));
  const skillLookup = new Map(skillEntries.map((entry) => [entry.name.toLowerCase(), entry]));
  const renderNestedText = (nextText: string) => (
    <RulesTextInner
      text={nextText}
      spellEntries={spellEntries}
      featEntries={featEntries}
      classEntries={classEntries}
      variantRuleEntries={variantRuleEntries}
      conditionEntries={conditionEntries}
      actionEntries={actionEntries}
      itemEntries={itemEntries}
      optionalFeatureEntries={optionalFeatureEntries}
      languageEntries={languageEntries}
      skillEntries={skillEntries}
      disableHover={disableHover}
    />
  );

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
            spell
              ? renderSpellTooltip(spell, spellEntries, featEntries, classEntries, variantRuleEntries, conditionEntries, actionEntries)
              : null,
            disableHover
          );
        }

        const variantRuleMatch = part.match(/^\{@variantrule ([^}|]+)(?:\|([^}|]+))?(?:\|([^}]+))?}/i);

        if (variantRuleMatch) {
          const referenceName = variantRuleMatch[1].trim();
          const referenceSource = variantRuleMatch[2]?.trim() || "";
          const label = variantRuleMatch[3]?.trim() || referenceName;
          const variantRule = findReferenceEntryByTag(variantRuleEntries, variantRuleLookup, referenceName, referenceSource, label);

          return renderLinkedTag(
            part,
            index,
            label,
            variantRule ? (
              <RulesTooltip title={variantRule.name} subtitle={variantRule.source || referenceSource || "Variant Rule"}>
                <div className="rules-tooltip-body rules-tooltip-body-full">{renderNestedText(variantRule.entries || variantRule.description)}</div>
              </RulesTooltip>
            ) : (
              <RulesTooltip title={referenceName} subtitle={referenceSource || "Variant Rule"}>
                <div className="rules-tooltip-body rules-tooltip-body-secondary">
                  <TextWithLineBreaks text={referenceName} />
                </div>
              </RulesTooltip>
            ),
            disableHover
          );
        }

        const conditionMatch = part.match(/^\{@condition ([^}|]+)(?:\|([^}|]+))?(?:\|([^}]+))?}/i);

        if (conditionMatch) {
          const conditionName = conditionMatch[1].trim();
          const conditionSource = conditionMatch[2]?.trim() || "";
          const label = conditionMatch[3]?.trim() || conditionName;
          const condition = findReferenceEntryByTag(conditionEntries, conditionLookup, conditionName, conditionSource, label);

          return renderLinkedTag(
            part,
            index,
            label,
            condition ? (
              <RulesTooltip title={condition.name} subtitle={condition.source || conditionSource || condition.category || "Condition"}>
                <div className="rules-tooltip-body rules-tooltip-body-full">{renderNestedText(condition.entries || condition.description)}</div>
              </RulesTooltip>
            ) : (
              <RulesTooltip title={conditionName} subtitle={conditionSource || "Condition"}>
                <div className="rules-tooltip-body rules-tooltip-body-secondary">
                  <TextWithLineBreaks text={conditionName} />
                </div>
              </RulesTooltip>
            ),
            disableHover
          );
        }

        const featMatch = part.match(/^\{@feat ([^}|]+)(?:\|[^}]+)?}/i);

        if (featMatch) {
          const featName = featMatch[1].trim();
          const feat = featLookup.get(featName.toLowerCase()) ?? null;
          return renderLinkedTag(
            part,
            index,
            featName,
            feat ? (
              <RulesTooltip title={feat.name} subtitle={feat.category}>
                {feat.prerequisites ? (
                  <div className="rules-tooltip-meta">
                    <span>{feat.prerequisites}</span>
                  </div>
                ) : null}
                {feat.abilityScoreIncrease ? (
                  <div className="rules-tooltip-body rules-tooltip-body-secondary">
                    <strong>Ability Score Increase.</strong> {renderNestedText(feat.abilityScoreIncrease)}
                  </div>
                ) : null}
                <div className="rules-tooltip-body">{renderNestedText(feat.description)}</div>
              </RulesTooltip>
            ) : null,
            disableHover
          );
        }

        const classMatch = part.match(/^\{@class ([^}|]+)(?:\|[^}]+)?}/i);

        if (classMatch) {
          const className = classMatch[1].trim();
          const classEntry = classLookup.get(className.toLowerCase()) ?? null;
          return renderLinkedTag(
            part,
            index,
            className,
            classEntry ? (
              <RulesTooltip title={classEntry.name} subtitle={classEntry.source}>
                <div className="rules-tooltip-body">{renderNestedText(classEntry.description)}</div>
                {classEntry.features.slice(0, 3).map((feature) => (
                  <div
                    key={`${classEntry.name}-${feature.level}-${feature.name}`}
                    className="rules-tooltip-body rules-tooltip-body-secondary"
                  >
                    <strong>
                      Level {feature.level}: {feature.name}.
                    </strong> {renderNestedText(feature.description)}
                  </div>
                ))}
              </RulesTooltip>
            ) : null,
            disableHover
          );
        }

        const actionMatch = part.match(/^\{@action ([^}|]+)(?:\|([^}|]+))?(?:\|([^}]+))?}/i);

        if (actionMatch) {
          const actionName = actionMatch[1].trim();
          const actionSource = actionMatch[2]?.trim() || "";
          const label = actionMatch[3]?.trim() || actionName;
          const action = findReferenceEntryByTag(actionEntries, actionLookup, actionName, actionSource, label);

          return renderLinkedTag(
            part,
            index,
            label,
            action ? (
              <RulesTooltip title={action.name} subtitle={action.source || actionSource || action.category || "Action"}>
                <div className="rules-tooltip-body rules-tooltip-body-full">{renderNestedText(action.entries || action.description)}</div>
              </RulesTooltip>
            ) : (
              <RulesTooltip title={actionName} subtitle={actionSource || "Action"}>
                <div className="rules-tooltip-body rules-tooltip-body-secondary">
                  <TextWithLineBreaks text={actionName} />
                </div>
              </RulesTooltip>
            ),
            disableHover
          );
        }

        const itemMatch = part.match(/^\{@item ([^}|]+)(?:\|([^}|]+))?(?:\|([^}]+))?}/i);

        if (itemMatch) {
          const itemName = itemMatch[1].trim();
          const itemSource = itemMatch[2]?.trim() || "";
          const label = itemMatch[3]?.trim() || itemName;
          const item = findReferenceEntryByTag(itemEntries, itemLookup, itemName, itemSource, label);

          return renderLinkedTag(
            part,
            index,
            label,
            item ? (
              <RulesTooltip title={item.name} subtitle={item.source || itemSource || item.itemType || "Item"}>
                <div className="rules-tooltip-meta">
                  {item.itemType ? <span>{item.itemType}</span> : null}
                  {item.armorClass > 0 ? <span>AC {item.armorClass}</span> : null}
                  {item.damage ? <span>{item.damage}{item.damageType ? ` ${item.damageType}` : ""}</span> : null}
                  {item.range ? <span>{item.range}</span> : null}
                </div>
                {item.properties.length > 0 ? <div className="rules-tooltip-body rules-tooltip-body-secondary">{item.properties.join(", ")}</div> : null}
                <div className="rules-tooltip-body">{renderNestedText(item.entries || item.description)}</div>
              </RulesTooltip>
            ) : null,
            disableHover
          );
        }

        const optionalFeatureMatch = part.match(/^\{@optfeature ([^}|]+)(?:\|([^}|]+))?(?:\|([^}]+))?}/i);

        if (optionalFeatureMatch) {
          const featureName = optionalFeatureMatch[1].trim();
          const featureSource = optionalFeatureMatch[2]?.trim() || "";
          const label = optionalFeatureMatch[3]?.trim() || featureName;
          const feature = findReferenceEntryByTag(optionalFeatureEntries, optionalFeatureLookup, featureName, featureSource, label);

          return renderLinkedTag(
            part,
            index,
            label,
            feature ? (
              <RulesTooltip title={feature.name} subtitle={feature.source || featureSource || feature.category || "Optional Feature"}>
                {feature.prerequisites ? (
                  <div className="rules-tooltip-meta">
                    <span>{feature.prerequisites}</span>
                  </div>
                ) : null}
                <div className="rules-tooltip-body">{renderNestedText(feature.entries || feature.description)}</div>
              </RulesTooltip>
            ) : null,
            disableHover
          );
        }

        const languageMatch = part.match(/^\{@language ([^}|]+)(?:\|([^}|]+))?(?:\|([^}]+))?}/i);

        if (languageMatch) {
          const languageName = languageMatch[1].trim();
          const languageSource = languageMatch[2]?.trim() || "";
          const label = languageMatch[3]?.trim() || languageName;
          const language = findReferenceEntryByTag(languageEntries, languageLookup, languageName, languageSource, label);

          return renderLinkedTag(
            part,
            index,
            label,
            language ? (
              <RulesTooltip title={language.name} subtitle={language.source || languageSource || language.category || "Language"}>
                <div className="rules-tooltip-body">{renderNestedText(language.entries || language.description)}</div>
              </RulesTooltip>
            ) : null,
            disableHover
          );
        }

        const skillMatch = part.match(/^\{@skill ([^}|]+)(?:\|([^}|]+))?(?:\|([^}]+))?}/i);

        if (skillMatch) {
          const skillName = skillMatch[1].trim();
          const skillSource = skillMatch[2]?.trim() || "";
          const label = skillMatch[3]?.trim() || skillName;
          const skill = findReferenceEntryByTag(skillEntries, skillLookup, skillName, skillSource, label);

          return renderLinkedTag(
            part,
            index,
            label,
            skill ? (
              <RulesTooltip title={skill.name} subtitle={skill.source || skillSource || skill.category || "Skill"}>
                <div className="rules-tooltip-body">{renderNestedText(skill.entries || skill.description)}</div>
              </RulesTooltip>
            ) : null,
            disableHover
          );
        }

        const filterTag = parseFilterTag(part);

        if (filterTag) {
          const filteredSpells = filterTag.target === "spells" ? getFilteredSpellEntries(spellEntries, filterTag.filters) : [];

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
                    No imported spells matched this filter. 5etools spell source files often omit class-list metadata, so spell-list hovers
                    need spells imported with class references.
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
        return renderLinkedTag(
          part,
          index,
          genericMatch?.[1] ?? part,
          genericMatch ? (
            <RulesTooltip title={genericMatch[1]} subtitle={part.match(/^\{@([^ }]+)/)?.[1] ?? "Reference"}>
              <div className="rules-tooltip-body rules-tooltip-body-secondary">
                <TextWithLineBreaks text={genericMatch[1]} />
              </div>
            </RulesTooltip>
          ) : null,
          disableHover,
          "rules-tag"
        );
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

function renderSpellTooltip(
  spell: SpellEntry | Omit<SpellEntry, "id">,
  spellEntries: Array<SpellEntry | Omit<SpellEntry, "id">>,
  featEntries: Array<FeatEntry | Omit<FeatEntry, "id">>,
  classEntries: Array<ClassEntry | Omit<ClassEntry, "id">>,
  variantRuleEntries: Array<CompendiumReferenceEntry | Omit<CompendiumReferenceEntry, "id">>,
  conditionEntries: Array<CompendiumReferenceEntry | Omit<CompendiumReferenceEntry, "id">>,
  actionEntries: Array<CompendiumReferenceEntry | Omit<CompendiumReferenceEntry, "id">>
) {
  return (
    <RulesTooltip
      title={spell.name}
      subtitle={spell.level === "cantrip" ? `${spell.school} Cantrip` : `${spell.school} Level ${spell.level}`}
    >
      <div className="rules-tooltip-meta">
        <span>{formatSpellTime(spell)}</span>
        <span>{formatSpellRange(spell)}</span>
        <span>{formatSpellDuration(spell)}</span>
      </div>
      <div className="rules-tooltip-body">
        <RulesTextInner
          text={spell.description}
          spellEntries={spellEntries}
          featEntries={featEntries}
          classEntries={classEntries}
          variantRuleEntries={variantRuleEntries}
          conditionEntries={conditionEntries}
          actionEntries={actionEntries}
          disableHover
        />
      </div>
      {spell.fullDescription && spell.fullDescription !== spell.description ? (
        <div className="rules-tooltip-body rules-tooltip-body-secondary">
          <RulesTextInner
            text={spell.fullDescription}
            spellEntries={spellEntries}
            featEntries={featEntries}
            classEntries={classEntries}
            variantRuleEntries={variantRuleEntries}
            conditionEntries={conditionEntries}
            actionEntries={actionEntries}
            disableHover
          />
        </div>
      ) : null}
    </RulesTooltip>
  );
}

function formatActionTag(value: string, fallback: string) {
  const inner = value.replace(/^\{@[^ ]+\s*|\}$/g, "").trim();
  if (!inner) {
    return fallback;
  }

  return `${fallback} ${inner.replace(/\|.*$/, "").trim()}`;
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

function findReferenceEntryByTag<T extends CompendiumReferenceEntry | Omit<CompendiumReferenceEntry, "id">>(
  entries: T[],
  lookup: Map<string, T>,
  name: string,
  source: string,
  label: string
) {
  const normalizedName = name.toLowerCase();
  const normalizedLabel = label.toLowerCase();
  const normalizedSource = normalizeCompendiumSourceKey(source);

  if (normalizedSource) {
    const sourcedEntry = entries.find((entry) => {
      const entryName = entry.name.toLowerCase();
      return (
        (entryName === normalizedName || entryName === normalizedLabel) && normalizeCompendiumSourceKey(entry.source) === normalizedSource
      );
    });

    if (sourcedEntry) {
      return sourcedEntry;
    }
  }

  return lookup.get(normalizedName) ?? lookup.get(normalizedLabel) ?? null;
}

function normalizeCompendiumSourceKey(value: string) {
  return (
    value
      .trim()
      .split(/\s+p\./i)[0]
      ?.trim()
      .toLowerCase() ?? ""
  );
}

function renderLinkedTag(
  part: string,
  index: number,
  label: string,
  tooltip: ReactNode | null,
  disableHover = false,
  className = "rules-tag rules-tag-link"
) {
  return <FloatingRulesTag key={`${part}-${index}`} label={label} tooltip={tooltip} disableHover={disableHover} className={className} />;
}

function FloatingRulesTag({
  label,
  tooltip,
  disableHover,
  className
}: {
  label: string;
  tooltip: ReactNode | null;
  disableHover: boolean;
  className: string;
}) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<ReturnType<typeof anchorFromRect> | null>(null);

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

  const openTooltip = () => {
    if (disableHover || !tooltip) {
      return;
    }

    clearCloseTimeout();
    updateAnchor();
    setIsOpen(true);
  };

  const closeTooltipSoon = () => {
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 90);
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

  if (disableHover || !tooltip) {
    return <span className="rules-tag">{label}</span>;
  }

  return (
    <>
      <span
        ref={triggerRef}
        className={className}
        tabIndex={0}
        onPointerEnter={openTooltip}
        onPointerLeave={closeTooltipSoon}
        onFocus={openTooltip}
        onBlur={closeTooltipSoon}
      >
        {label}
      </span>
      {isOpen ? (
        <FloatingLayer
          anchor={anchor}
          className="rules-tag-tooltip"
          placement="top-start"
          offset={12}
          zIndex={2147483000}
          onPointerEnter={openTooltip}
          onPointerLeave={closeTooltipSoon}
        >
          {tooltip}
        </FloatingLayer>
      ) : null}
    </>
  );
}

function RulesTooltip({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <span className="rules-tooltip-card">
      <strong>{title}</strong>
      {subtitle ? <small>{subtitle}</small> : null}
      {children}
    </span>
  );
}
