import type {
  ClassEntry,
  ClassSubclassEntry,
  CompendiumBackgroundEntry,
  CompendiumReferenceEntry,
  CompendiumSpeciesEntry,
  FeatEntry,
  SpellEntry
} from "@shared/types";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { anchorFromRect, FloatingLayer } from "../FloatingLayer";
import {
  findReferenceEntryByTag,
  formatActionTag,
  formatAttackTag,
  formatSpellDuration,
  formatSpellRange,
  formatSpellTime,
  getFilteredSpellEntries,
  parseFilterTag
} from "./formatters";
import type { RulesLookupData } from "./types";

export function RulesText({
  text = "",
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
  raceEntries = [],
  backgroundEntries = [],
  monsterEntries = []
}: { text?: string } & RulesLookupData) {
  return (
    <RulesTextInner
      text={text || ""}
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
      raceEntries={raceEntries}
      backgroundEntries={backgroundEntries}
      monsterEntries={monsterEntries}
      disableHover={false}
    />
  );
}

function RulesTextInner({
  text = "",
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
  raceEntries = [],
  backgroundEntries = [],
  monsterEntries = [],
  disableHover
}: { text?: string; disableHover: boolean } & RulesLookupData) {
  const normalized = (text || "").replace(/\n+/g, "\n");
  const parts = normalized.split(/(\{@[^}]+})/g).filter(Boolean);
  const spellLookup = new Map(spellEntries.filter((entry) => entry?.name).map((entry) => [entry.name.toLowerCase(), entry]));
  const featLookup = new Map(featEntries.filter((entry) => entry?.name).map((entry) => [entry.name.toLowerCase(), entry]));
  const classLookup = new Map(classEntries.filter((entry) => entry?.name).map((entry) => [entry.name.toLowerCase(), entry]));
  const variantRuleLookup = new Map(variantRuleEntries.filter((entry) => entry?.name).map((entry) => [entry.name.toLowerCase(), entry]));
  const conditionLookup = new Map(conditionEntries.filter((entry) => entry?.name).map((entry) => [entry.name.toLowerCase(), entry]));
  const actionLookup = new Map(actionEntries.filter((entry) => entry?.name).map((entry) => [entry.name.toLowerCase(), entry]));
  const itemLookup = new Map(itemEntries.filter((entry) => entry?.name).map((entry) => [entry.name.toLowerCase(), entry]));
  const optionalFeatureLookup = new Map(
    optionalFeatureEntries.filter((entry) => entry?.name).map((entry) => [entry.name.toLowerCase(), entry])
  );
  const languageLookup = new Map(languageEntries.filter((entry) => entry?.name).map((entry) => [entry.name.toLowerCase(), entry]));
  const skillLookup = new Map(skillEntries.filter((entry) => entry?.name).map((entry) => [entry.name.toLowerCase(), entry]));
  const raceLookup = new Map(raceEntries.filter((entry) => entry?.name).map((entry) => [entry.name.toLowerCase(), entry]));
  const backgroundLookup = new Map(backgroundEntries.filter((entry) => entry?.name).map((entry) => [entry.name.toLowerCase(), entry]));
  const monsterLookup = new Map(monsterEntries.filter((entry) => entry?.name).map((entry) => [entry.name.toLowerCase(), entry]));

  const subclassLookup = new Map<string, { subclass: ClassSubclassEntry; parentClass: ClassEntry | Omit<ClassEntry, "id"> }>();
  const classFeatureLookup = new Map<
    string,
    { feature: { name: string; description: string; level: number; source?: string }; parentClass: ClassEntry | Omit<ClassEntry, "id"> }
  >();
  const subclassFeatureLookup = new Map<
    string,
    {
      feature: { name: string; description: string; level: number; source?: string };
      subclass: ClassSubclassEntry;
      parentClass: ClassEntry | Omit<ClassEntry, "id">;
    }
  >();

  classEntries.forEach((classEntry) => {
    if (!classEntry?.name) return;
    (classEntry.features || []).forEach((feature) => {
      if (!feature?.name) return;
      classFeatureLookup.set(`${classEntry.name.toLowerCase()}:${feature.name.toLowerCase()}`, { feature, parentClass: classEntry });
      if (!classFeatureLookup.has(feature.name.toLowerCase())) {
        classFeatureLookup.set(feature.name.toLowerCase(), { feature, parentClass: classEntry });
      }
    });

    (classEntry.subclasses || []).forEach((subclass) => {
      if (!subclass?.name) return;
      subclassLookup.set(subclass.name.toLowerCase(), { subclass, parentClass: classEntry });
      subclassLookup.set(`${classEntry.name.toLowerCase()}:${subclass.name.toLowerCase()}`, { subclass, parentClass: classEntry });
      if (subclass.shortName) {
        subclassLookup.set(subclass.shortName.toLowerCase(), { subclass, parentClass: classEntry });
        subclassLookup.set(`${classEntry.name.toLowerCase()}:${subclass.shortName.toLowerCase()}`, { subclass, parentClass: classEntry });
      }

      (subclass.features || []).forEach((feature) => {
        if (!feature?.name) return;
        subclassFeatureLookup.set(`${subclass.name.toLowerCase()}:${feature.name.toLowerCase()}`, {
          feature,
          subclass,
          parentClass: classEntry
        });
        if (subclass.shortName) {
          subclassFeatureLookup.set(`${subclass.shortName.toLowerCase()}:${feature.name.toLowerCase()}`, {
            feature,
            subclass,
            parentClass: classEntry
          });
        }
        if (!subclassFeatureLookup.has(feature.name.toLowerCase())) {
          subclassFeatureLookup.set(feature.name.toLowerCase(), { feature, subclass, parentClass: classEntry });
        }
      });
    });
  });

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
      raceEntries={raceEntries}
      backgroundEntries={backgroundEntries}
      monsterEntries={monsterEntries}
      disableHover={disableHover}
    />
  );

  return (
    <>
      {parts.map((part, index) => {
        if (!part.startsWith("{@")) {
          return <TextWithLineBreaks key={`${part}-${index}`} text={part} />;
        }

        const boldMatch = part.match(/^\{@(b|bold) ([^}]+)}/i);
        if (boldMatch) {
          return <strong key={`${part}-${index}`}>{renderNestedText(boldMatch[2])}</strong>;
        }

        const italicMatch = part.match(/^\{@(i|italic) ([^}]+)}/i);
        if (italicMatch) {
          return <em key={`${part}-${index}`}>{renderNestedText(italicMatch[2])}</em>;
        }

        const strikeMatch = part.match(/^\{@(s|strike) ([^}]+)}/i);
        if (strikeMatch) {
          return <del key={`${part}-${index}`}>{renderNestedText(strikeMatch[2])}</del>;
        }

        const underlineMatch = part.match(/^\{@(u|underline) ([^}]+)}/i);
        if (underlineMatch) {
          return <u key={`${part}-${index}`}>{renderNestedText(underlineMatch[2])}</u>;
        }

        const codeMatch = part.match(/^\{@(code|kbd) ([^}]+)}/i);
        if (codeMatch) {
          return (
            <code key={`${part}-${index}`} className="rounded bg-black/40 px-1 py-0.5 font-mono text-[0.85em] text-amber-200">
              {codeMatch[2]}
            </code>
          );
        }

        const noteMatch = part.match(/^\{@note ([^}]+)}/i);
        if (noteMatch) {
          return (
            <span key={`${part}-${index}`} className="text-xs italic text-zinc-400">
              Note: {renderNestedText(noteMatch[1])}
            </span>
          );
        }

        const linkMatch = part.match(/^\{@(link|5etools|quickref|area|book|card|deity|disease) ([^}|]+)(?:\|[^}|]+)*(?:\|([^}]+))?}/i);
        if (
          linkMatch &&
          !/^\{@(spell|feat|class|subclass|classFeature|subclassFeature|item|race|background|monster|creature|optfeature|condition|variantrule|action|language|skill)\b/i.test(
            part
          )
        ) {
          const label = linkMatch[3]?.trim() || linkMatch[2].trim();
          return <span key={`${part}-${index}`}>{label}</span>;
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

        const subclassMatch = part.match(/^\{@subclass ([^}|]+)(?:\|([^}|]+))?(?:\|([^}|]+))?(?:\|([^}]+))?}/i);
        if (subclassMatch) {
          const subclassName = subclassMatch[1].trim();
          const className = subclassMatch[2]?.trim() || "";
          const label = subclassMatch[4]?.trim() || subclassName;
          const found =
            (className ? subclassLookup.get(`${className.toLowerCase()}:${subclassName.toLowerCase()}`) : null) ??
            subclassLookup.get(subclassName.toLowerCase()) ??
            null;

          return renderLinkedTag(
            part,
            index,
            label,
            found ? (
              <RulesTooltip title={found.subclass.name} subtitle={`${found.parentClass.name} Subclass • ${found.subclass.source}`}>
                <div className="rules-tooltip-body">{renderNestedText(found.subclass.description || found.parentClass.description)}</div>
                {found.subclass.features.slice(0, 4).map((feature) => (
                  <div
                    key={`${found.subclass.name}-${feature.level}-${feature.name}`}
                    className="rules-tooltip-body rules-tooltip-body-secondary"
                  >
                    <strong>
                      Level {feature.level}: {feature.name}.
                    </strong>{" "}
                    {renderNestedText(feature.description)}
                  </div>
                ))}
              </RulesTooltip>
            ) : null,
            disableHover
          );
        }

        const classFeatureMatch = part.match(/^\{@classFeature ([^}|]+)\|([^}|]+)(?:\|[^}|]+)?(?:\|\d+)?(?:\|[^}|]+)?(?:\|([^}]+))?}/i);
        if (classFeatureMatch) {
          const featureName = classFeatureMatch[1].trim();
          const className = classFeatureMatch[2].trim();
          const label = classFeatureMatch[3]?.trim() || featureName;
          const found =
            classFeatureLookup.get(`${className.toLowerCase()}:${featureName.toLowerCase()}`) ??
            classFeatureLookup.get(featureName.toLowerCase()) ??
            null;

          return renderLinkedTag(
            part,
            index,
            label,
            found ? (
              <RulesTooltip title={found.feature.name} subtitle={`${found.parentClass.name} Level ${found.feature.level} Feature`}>
                <div className="rules-tooltip-body">{renderNestedText(found.feature.description)}</div>
              </RulesTooltip>
            ) : null,
            disableHover
          );
        }

        const subclassFeatureMatch = part.match(
          /^\{@subclassFeature ([^}|]+)\|([^}|]+)\|[^}|]+\|([^}|]+)(?:\|[^}|]+)?(?:\|\d+)?(?:\|[^}|]+)?(?:\|([^}]+))?}/i
        );
        if (subclassFeatureMatch) {
          const featureName = subclassFeatureMatch[1].trim();
          const subclassName = subclassFeatureMatch[3].trim();
          const label = subclassFeatureMatch[4]?.trim() || featureName;
          const found =
            subclassFeatureLookup.get(`${subclassName.toLowerCase()}:${featureName.toLowerCase()}`) ??
            subclassFeatureLookup.get(featureName.toLowerCase()) ??
            null;

          return renderLinkedTag(
            part,
            index,
            label,
            found ? (
              <RulesTooltip title={found.feature.name} subtitle={`${found.subclass.name} Level ${found.feature.level} Feature`}>
                <div className="rules-tooltip-body">{renderNestedText(found.feature.description)}</div>
              </RulesTooltip>
            ) : null,
            disableHover
          );
        }

        const raceMatch = part.match(/^\{@race ([^}|]+)(?:\|([^}|]+))?(?:\|([^}]+))?}/i);
        if (raceMatch) {
          const raceName = raceMatch[1].trim();
          const source = raceMatch[2]?.trim() || "";
          const label = raceMatch[3]?.trim() || raceName;
          const species = findReferenceEntryByTag(raceEntries, raceLookup, raceName, source, label) as
            | (CompendiumSpeciesEntry & CompendiumReferenceEntry)
            | null;

          return renderLinkedTag(
            part,
            index,
            label,
            species ? (
              <RulesTooltip title={species.name} subtitle={species.source || source || "Species"}>
                {species.speed ? (
                  <div className="rules-tooltip-meta">
                    <span>Speed {species.speed} ft</span>
                    {species.darkvision > 0 ? <span>Darkvision {species.darkvision} ft</span> : null}
                  </div>
                ) : null}
                <div className="rules-tooltip-body rules-tooltip-body-full">{renderNestedText(species.entries || species.description)}</div>
              </RulesTooltip>
            ) : null,
            disableHover
          );
        }

        const backgroundMatch = part.match(/^\{@background ([^}|]+)(?:\|([^}|]+))?(?:\|([^}]+))?}/i);
        if (backgroundMatch) {
          const backgroundName = backgroundMatch[1].trim();
          const source = backgroundMatch[2]?.trim() || "";
          const label = backgroundMatch[3]?.trim() || backgroundName;
          const background = findReferenceEntryByTag(backgroundEntries, backgroundLookup, backgroundName, source, label) as
            | (CompendiumBackgroundEntry & CompendiumReferenceEntry)
            | null;

          return renderLinkedTag(
            part,
            index,
            label,
            background ? (
              <RulesTooltip title={background.name} subtitle={background.source || source || "Background"}>
                <div className="rules-tooltip-body rules-tooltip-body-full">
                  {renderNestedText(background.entries || background.description)}
                </div>
              </RulesTooltip>
            ) : null,
            disableHover
          );
        }

        const monsterMatch = part.match(/^\{@(creature|monster) ([^}|]+)(?:\|([^}|]+))?(?:\|([^}]+))?}/i);
        if (monsterMatch) {
          const monsterName = monsterMatch[2].trim();
          const label = monsterMatch[4]?.trim() || monsterName;
          const monster = monsterLookup.get(monsterName.toLowerCase()) ?? null;

          return renderLinkedTag(
            part,
            index,
            label,
            monster ? (
              <RulesTooltip
                title={monster.name}
                subtitle={`CR ${monster.challengeRating} ${monster.creatureType} • AC ${monster.armorClass} • HP ${monster.hitPoints}`}
              >
                {monster.traits && monster.traits.length > 0 ? (
                  <div className="rules-tooltip-body">{renderNestedText(monster.traits.join("\n"))}</div>
                ) : null}
                {monster.actions && monster.actions.length > 0 ? (
                  <div className="rules-tooltip-body rules-tooltip-body-secondary">
                    <strong>Actions:</strong> {monster.actions.map((a) => a.name).join(", ")}
                  </div>
                ) : null}
              </RulesTooltip>
            ) : null,
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
                <div className="rules-tooltip-body rules-tooltip-body-full">
                  {renderNestedText(variantRule.entries || variantRule.description)}
                </div>
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

        const conditionMatch = part.match(/^\{@(condition|status) ([^}|]+)(?:\|([^}|]+))?(?:\|([^}]+))?}/i);
        if (conditionMatch) {
          const conditionName = conditionMatch[2].trim();
          const conditionSource = conditionMatch[3]?.trim() || "";
          const label = conditionMatch[4]?.trim() || conditionName;
          const condition = findReferenceEntryByTag(conditionEntries, conditionLookup, conditionName, conditionSource, label);

          return renderLinkedTag(
            part,
            index,
            label,
            condition ? (
              <RulesTooltip title={condition.name} subtitle={condition.source || conditionSource || condition.category || "Condition"}>
                <div className="rules-tooltip-body rules-tooltip-body-full">
                  {renderNestedText(condition.entries || condition.description)}
                </div>
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
                    </strong>{" "}
                    {renderNestedText(feature.description)}
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
                  {item.damage ? (
                    <span>
                      {item.damage}
                      {item.damageType ? ` ${item.damageType}` : ""}
                    </span>
                  ) : null}
                  {item.range ? <span>{item.range}</span> : null}
                </div>
                {item.properties.length > 0 ? (
                  <div className="rules-tooltip-body rules-tooltip-body-secondary">{item.properties.join(", ")}</div>
                ) : null}
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

        const hazardMatch = part.match(/^\{@hazard ([^}|]+)(?:\|([^}|]+))?(?:\|([^}]+))?}/i);
        if (hazardMatch) {
          const hazardName = hazardMatch[1].trim();
          const hazardSource = hazardMatch[2]?.trim() || "";
          const label = hazardMatch[3]?.trim() || hazardName;
          const hazard = findReferenceEntryByTag(variantRuleEntries, variantRuleLookup, hazardName, hazardSource, label);

          return renderLinkedTag(
            part,
            index,
            label,
            hazard ? (
              <RulesTooltip title={hazard.name} subtitle={hazard.source || hazardSource || "Hazard"}>
                <div className="rules-tooltip-body">{renderNestedText(hazard.entries || hazard.description)}</div>
              </RulesTooltip>
            ) : null,
            disableHover
          );
        }

        const senseMatch = part.match(/^\{@sense ([^}|]+)(?:\|([^}|]+))?(?:\|([^}]+))?}/i);
        if (senseMatch) {
          const senseName = senseMatch[1].trim();
          const label = senseMatch[3]?.trim() || senseName;
          return <span key={`${part}-${index}`}>{label}</span>;
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
                  <div className="rules-tooltip-body rules-tooltip-body-secondary">No imported spells matched this filter.</div>
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

        const diceMatch = part.match(/^\{@(dice|scaledice|scaledamage) ([^}|]+)(?:\|[^}]+)?}/i);
        if (diceMatch) {
          return <span key={`${part}-${index}`}>{diceMatch[2]}</span>;
        }

        const chanceMatch = part.match(/^\{@chance ([^}]+)}/i);
        if (chanceMatch) {
          return <span key={`${part}-${index}`}>{chanceMatch[1]}%</span>;
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

function TextWithLineBreaks({ text }: { text?: string }) {
  const lines = (text || "").split("\n");

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
