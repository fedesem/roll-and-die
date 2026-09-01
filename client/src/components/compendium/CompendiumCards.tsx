import type {
  ClassEntry,
  ClassFeatureEntry,
  ClassSubclassEntry,
  CompendiumReferenceEntry,
  FeatEntry,
  MonsterTemplate,
  SpellEntry
} from "@shared/types";
import { useEffect, useState } from "react";
import { MonsterStatBlock } from "../monster/MonsterStatBlock";
import {
  buildClassPreviewFeatureTimeline,
  formatSpellClassList,
  formatSpellDuration,
  formatSpellRange,
  formatSpellTime,
  formatStartingProficiencies,
  getReferencedSpellsForClass,
  getReferencingClassesForSpell,
  groupClassPreviewFeaturesByLevel,
  hasStartingProficiencies,
  normalizeClassPreviewDescription
} from "./formatters";
import { PreviewFrame, Section } from "./PreviewFrame";
import { RulesText } from "./RulesText";
import type { RulesLookupData } from "./types";

export function SpellPreviewCard({
  spell,
  sourceTitle,
  ...lookupProps
}: {
  spell: SpellEntry | Omit<SpellEntry, "id">;
  sourceTitle?: string;
} & RulesLookupData) {
  const subtitle = spell.level === "cantrip" ? `${spell.school} Cantrip` : `${spell.school} Level ${spell.level}`;
  const components = [spell.components.verbal ? "V" : null, spell.components.somatic ? "S" : null, spell.components.material ? "M" : null]
    .filter(Boolean)
    .join(", ");
  const displayedClasses = formatSpellClassList(spell);
  const referencingClasses = getReferencingClassesForSpell(spell.name, lookupProps.classEntries || []);

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
          <RulesText text={spell.description} {...lookupProps} spellEntries={[spell, ...(lookupProps.spellEntries ?? [])]} />
        </p>
        {displayedClasses ? (
          <p className="admin-preview-footnote">
            <strong>Classes:</strong> {displayedClasses}
          </p>
        ) : null}
        {referencingClasses.length > 0 ? (
          <p className="admin-preview-footnote">
            <strong>Referenced by:</strong> {referencingClasses.join(", ")}
          </p>
        ) : null}
        {spell.damageNotation && (
          <p className="admin-preview-body">
            <strong>Damage:</strong> {spell.damageNotation}
            {spell.damageAbility ? ` + ${spell.damageAbility.toUpperCase()}` : ""}
          </p>
        )}
        {spell.higherLevelDescription && (
          <p className="admin-preview-body">
            <strong>Higher Levels.</strong>{" "}
            <RulesText text={spell.higherLevelDescription} {...lookupProps} spellEntries={[spell, ...(lookupProps.spellEntries ?? [])]} />
          </p>
        )}
        {spell.fullDescription && spell.fullDescription !== spell.description && (
          <p className="admin-preview-body">
            <RulesText text={spell.fullDescription} {...lookupProps} spellEntries={[spell, ...(lookupProps.spellEntries ?? [])]} />
          </p>
        )}
      </div>
    </PreviewFrame>
  );
}

export function FeatPreviewCard({
  feat,
  sourceTitle,
  ...lookupProps
}: {
  feat: FeatEntry | Omit<FeatEntry, "id">;
  sourceTitle?: string;
} & RulesLookupData) {
  const subtitle = feat.prerequisites ? `${feat.category} (Prerequisites: ${feat.prerequisites})` : feat.category;

  return (
    <PreviewFrame eyebrow="Feat" title={feat.name} source={feat.source} sourceTitle={sourceTitle} subtitle={subtitle}>
      <div className="admin-preview-stack">
        {feat.abilityScoreIncrease && (
          <p className="admin-preview-body">
            <strong>Ability Score Increase.</strong>{" "}
            <RulesText text={feat.abilityScoreIncrease} {...lookupProps} featEntries={[feat, ...(lookupProps.featEntries ?? [])]} />
          </p>
        )}
        <p className="admin-preview-body">
          <RulesText text={feat.description} {...lookupProps} featEntries={[feat, ...(lookupProps.featEntries ?? [])]} />
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
  const [selectedSubclassId, setSelectedSubclassId] = useState("");

  useEffect(() => {
    setSelectedSubclassId((current) => (current && entry.subclasses.some((subclass) => subclass.id === current) ? current : ""));
  }, [entry.name, entry.source, entry.subclasses]);

  const selectedSubclass = entry.subclasses.find((subclass) => subclass.id === selectedSubclassId) ?? null;
  const referencedSpells = getReferencedSpellsForClass(entry, spellEntries, selectedSubclass ?? undefined);
  const featureTimeline = buildClassPreviewFeatureTimeline(entry, selectedSubclass);
  const showFeaturesSection = featureTimeline.length > 0 || entry.subclasses.length > 0;

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
          {entry.subclassLevel !== null && (
            <div>
              <strong>Subclass Choice:</strong> Level {entry.subclassLevel}
            </div>
          )}
          {hasStartingProficiencies(entry) && (
            <div>
              <strong>Starting Proficiencies:</strong>{" "}
              <RulesText
                text={formatStartingProficiencies(entry)}
                spellEntries={spellEntries}
                featEntries={featEntries}
                classEntries={[entry]}
                variantRuleEntries={variantRuleEntries}
                conditionEntries={conditionEntries}
                actionEntries={actionEntries}
              />
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
        {referencedSpells.length > 0 ? (
          <p className="admin-preview-footnote">
            <strong>Referenced spells:</strong> {referencedSpells.join(", ")}
          </p>
        ) : null}
        {showFeaturesSection && (
          <Section
            title="Features"
            actions={
              entry.subclasses.length > 0 ? (
                <label className="admin-preview-section-control">
                  <span>Subclass</span>
                  <select
                    className="admin-preview-section-select"
                    value={selectedSubclassId}
                    onChange={(event) => setSelectedSubclassId(event.target.value)}
                  >
                    <option value="">None</option>
                    {entry.subclasses.map((subclass) => (
                      <option key={subclass.id} value={subclass.id}>
                        {subclass.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null
            }
          >
            {selectedSubclass ? (
              <SelectedSubclassSummary
                subclass={selectedSubclass}
                classEntry={entry}
                spellEntries={spellEntries}
                featEntries={featEntries}
                variantRuleEntries={variantRuleEntries}
                conditionEntries={conditionEntries}
                actionEntries={actionEntries}
              />
            ) : entry.subclasses.length > 0 ? (
              <p className="admin-preview-footnote">Select a subclass to include its subclass features in the class timeline.</p>
            ) : null}
            {groupClassPreviewFeaturesByLevel(featureTimeline).map((levelGroup, levelGroupIndex) => (
              <div key={`level:${levelGroup.level}`} className="admin-preview-level-group">
                {levelGroupIndex > 0 ? <div className="admin-preview-level-divider" /> : null}
                <p className="admin-preview-level-label">Level {levelGroup.level}</p>
                <div className="admin-preview-feature-list">
                  {levelGroup.features.map((feature) => (
                    <article key={feature.key} className="admin-preview-feature-item">
                      <p className="admin-preview-body">
                        <strong>
                          {feature.name}
                          {feature.kind === "subclass" && feature.subclassName ? ` (${feature.subclassName})` : ""}.
                        </strong>
                      </p>
                      <p className="admin-preview-body">
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
                    </article>
                  ))}
                </div>
              </div>
            ))}
            {selectedSubclass && selectedSubclass.features.length === 0 ? (
              <p className="admin-preview-footnote">No subclass-specific features are stored for this entry yet.</p>
            ) : null}
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

export function SelectedSubclassSummary({
  subclass,
  classEntry,
  spellEntries = [],
  featEntries = [],
  variantRuleEntries = [],
  conditionEntries = [],
  actionEntries = []
}: {
  subclass: ClassSubclassEntry;
  classEntry: ClassEntry | Omit<ClassEntry, "id">;
  spellEntries?: SpellEntry[];
  featEntries?: FeatEntry[];
  variantRuleEntries?: CompendiumReferenceEntry[];
  conditionEntries?: CompendiumReferenceEntry[];
  actionEntries?: CompendiumReferenceEntry[];
}) {
  return (
    <div className="rounded-md border border-white/8 bg-black/20 p-3">
      <p className="text-sm font-semibold text-amber-50">
        {subclass.name} {subclass.source ? <span className="font-normal text-zinc-400">({subclass.source})</span> : null}
      </p>
      {subclass.description ? (
        <p className="admin-preview-body mt-2">
          <RulesText
            text={subclass.description}
            spellEntries={spellEntries}
            featEntries={featEntries}
            classEntries={[classEntry]}
            variantRuleEntries={variantRuleEntries}
            conditionEntries={conditionEntries}
            actionEntries={actionEntries}
          />
        </p>
      ) : null}
    </div>
  );
}

export function SubclassPreviewCard({
  subclass,
  className,
  sourceTitle,
  ...lookupProps
}: {
  subclass:
    | ClassSubclassEntry
    | {
        id: string;
        name: string;
        source?: string;
        className?: string;
        classSource?: string;
        description?: string;
        features?: ClassFeatureEntry[];
        levels?: Record<
          string | number,
          {
            features?: string[];
            alwaysPreparedSpells?: string[];
            choices?: unknown[];
            resources?: unknown[];
          }
        >;
      };
  className?: string;
  sourceTitle?: string;
} & RulesLookupData) {
  const effectiveClassName = className || ("className" in subclass ? subclass.className : "") || "Class";
  const features = ("features" in subclass ? subclass.features : []) || [];

  const levelGroupsMap = new Map<number, ClassFeatureEntry[]>();
  for (const feat of features) {
    const list = levelGroupsMap.get(feat.level) || [];
    list.push(feat);
    levelGroupsMap.set(feat.level, list);
  }
  const sortedLevels = Array.from(levelGroupsMap.keys()).sort((a, b) => a - b);

  const spellLevels: Array<{ level: number; spells: string[] }> = [];
  if ("levels" in subclass && subclass.levels) {
    for (const [lvlKey, lvlConfig] of Object.entries(subclass.levels)) {
      if (lvlConfig.alwaysPreparedSpells && lvlConfig.alwaysPreparedSpells.length > 0) {
        spellLevels.push({
          level: Number(lvlKey),
          spells: lvlConfig.alwaysPreparedSpells
        });
      }
    }
  }
  spellLevels.sort((a, b) => a.level - b.level);

  return (
    <PreviewFrame
      eyebrow="Subclass"
      title={subclass.name}
      source={subclass.source}
      sourceTitle={sourceTitle}
      subtitle={`${effectiveClassName} Subclass`}
    >
      <div className="admin-preview-stack">
        {subclass.description ? (
          <p className="admin-preview-body">
            <RulesText text={subclass.description} {...lookupProps} />
          </p>
        ) : null}

        {spellLevels.length > 0 && (
          <Section title="Subclass Spells">
            <div className="space-y-1 text-xs">
              {spellLevels.map((group) => (
                <div key={group.level}>
                  <strong>Level {group.level}:</strong>{" "}
                  {group.spells.map((spellName, index) => (
                    <span key={spellName}>
                      {index > 0 ? ", " : null}
                      <RulesText text={`{@spell ${spellName}}`} {...lookupProps} />
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </Section>
        )}

        {sortedLevels.length > 0 ? (
          <Section title="Subclass Features">
            {sortedLevels.map((lvl, levelGroupIndex) => {
              const groupFeatures = levelGroupsMap.get(lvl) || [];
              return (
                <div key={`level:${lvl}`} className="admin-preview-level-group">
                  {levelGroupIndex > 0 ? <div className="admin-preview-level-divider" /> : null}
                  <p className="admin-preview-level-label">Level {lvl}</p>
                  <div className="admin-preview-feature-list">
                    {groupFeatures.map((feat) => (
                      <article key={`${feat.level}:${feat.name}`} className="admin-preview-feature-item">
                        <p className="admin-preview-body">
                          <strong>{feat.name}.</strong>
                        </p>
                        <p className="admin-preview-body">
                          <RulesText text={feat.description} {...lookupProps} />
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              );
            })}
          </Section>
        ) : !subclass.description ? (
          <p className="admin-preview-footnote">No subclass-specific features are stored for this entry yet.</p>
        ) : null}
      </div>
    </PreviewFrame>
  );
}

export function ReferencePreviewCard({
  title,
  eyebrow,
  entry,
  sourceTitle,
  ...lookupProps
}: {
  title: string;
  eyebrow: string;
  entry: CompendiumReferenceEntry;
  sourceTitle?: string;
} & RulesLookupData) {
  return (
    <PreviewFrame eyebrow={eyebrow} title={entry.name} source={entry.source} sourceTitle={sourceTitle} subtitle={entry.category}>
      <div className="admin-preview-stack">
        <p className="admin-preview-body">
          <RulesText text={entry.entries || entry.description} {...lookupProps} />
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
