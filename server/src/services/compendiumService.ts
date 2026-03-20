import type {
  AbilityKey,
  ClassEntry,
  ClassFeatureEntry,
  ClassSubclassEntry,
  CompendiumData,
  CompendiumReferenceEntry,
  FeatEntry,
  MonsterActionEntry,
  MonsterAttackType,
  MonsterSense,
  MonsterSkillBonus,
  MonsterSpellcastingEntry,
  MonsterTemplate,
  SpellClassReference,
  SpellCastingTimeUnit,
  SpellDurationUnit,
  SpellEntry,
  SpellLevel,
  SpellRangeType,
  SpellSchool
} from "../../../shared/types.js";
import { HttpError } from "../http/errors.js";
import { createId } from "./authService.js";

export type CompendiumKind = keyof CompendiumData;

export function sanitizeCompendiumEntry(kind: CompendiumKind, input: unknown) {
  switch (kind) {
    case "spells":
      return sanitizeSpellEntry(input);
    case "monsters":
      return sanitizeMonsterEntry(input);
    case "feats":
      return sanitizeFeatEntry(input);
    case "classes":
      return sanitizeClassEntry(input);
    case "actions":
    case "backgrounds":
    case "items":
    case "languages":
    case "races":
    case "skills":
      return sanitizeReferenceEntry(kind, input);
  }
}

export function normalizeCompendiumImportEntries(kind: CompendiumKind, input: unknown) {
  if (Array.isArray(input)) {
    return input;
  }

  if (typeof input !== "object" || input === null) {
    return [input];
  }

  const object = input as Record<string, unknown>;

  if (kind === "monsters" && Array.isArray(object.monster)) {
    return object.monster;
  }

  if (kind === "spells" && Array.isArray(object.spell)) {
    return object.spell;
  }

  if (kind === "feats" && Array.isArray(object.feat)) {
    return object.feat;
  }

  if (kind === "feats" && Array.isArray(object.optionalfeature)) {
    return object.optionalfeature;
  }

  if (kind === "classes" && Array.isArray(object.class)) {
    const classFeatureLookup = new Map(
      [
        ...readObjectArray(object.classFeature),
        ...readObjectArray(object.subclassFeature)
      ].map((entry) => [getCompendiumEntityKey(entry), entry] as const)
    );

    return object.class.map((entry) => ({
      ...entry,
      __classFeatureLookup: Object.fromEntries(classFeatureLookup),
      __subclassEntries: readObjectArray(object.subclass)
    }));
  }

  if (kind === "actions" && Array.isArray(object.action)) {
    return object.action;
  }

  if (kind === "backgrounds" && Array.isArray(object.background)) {
    return object.background;
  }

  if (kind === "items") {
    return [
      ...readObjectArray(object.item),
      ...readObjectArray(object.baseitem)
    ];
  }

  if (kind === "languages" && Array.isArray(object.language)) {
    return object.language;
  }

  if (kind === "races") {
    return [
      ...readObjectArray(object.race),
      ...readObjectArray(object.subrace)
    ];
  }

  if (kind === "skills" && Array.isArray(object.skill)) {
    return object.skill;
  }

  return [input];
}

export function isGeneratedSpellLookupImport(input: unknown) {
  return readGeneratedSpellLookupData(input).entryCount > 0;
}

export function importGeneratedSpellLookupIntoSpells(spells: SpellEntry[], input: unknown) {
  const lookupData = readGeneratedSpellLookupData(input);

  if (lookupData.entryCount === 0) {
    throw new HttpError(400, "The uploaded JSON is not a supported 5etools spell lookup file.");
  }

  let updated = 0;

  spells.forEach((spell) => {
    const spellLookupKey = createGeneratedSpellLookupKey(getSpellSourceCode(spell.source), spell.name);
    const lookupReferences = lookupData.referencesBySpellKey.get(spellLookupKey);

    if (!lookupReferences || lookupReferences.length === 0) {
      return;
    }

    const mergedReferences = mergeSpellClassReferences(ensureSpellClassReferences(spell), lookupReferences);
    spell.classReferences = mergedReferences;
    spell.classes = uniqueStrings(mergedReferences.map(formatSpellClassReferenceDisplay));
    updated += 1;
  });

  return {
    imported: updated,
    skipped: Math.max(lookupData.entryCount - updated, 0)
  };
}

export function isGeneratedSubclassLookupImport(input: unknown) {
  return readGeneratedSubclassLookupData(input).entryCount > 0;
}

export function importGeneratedSubclassLookupIntoClasses(classes: ClassEntry[], input: unknown) {
  const lookupData = readGeneratedSubclassLookupData(input);

  if (lookupData.entryCount === 0) {
    throw new HttpError(400, "The uploaded JSON is not a supported 5etools subclass lookup file.");
  }

  let imported = 0;

  classes.forEach((entry) => {
    const subclasses = lookupData.subclassesByClassKey.get(
      createGeneratedSubclassLookupKey(getSpellSourceCode(entry.source), entry.name)
    );

    if (!subclasses || subclasses.length === 0) {
      return;
    }

    const existingKeys = new Set(
      entry.subclasses.map((subclass) => `${subclass.source.toLowerCase()}|${subclass.name.toLowerCase()}`)
    );

    subclasses.forEach((subclass) => {
      const key = `${subclass.source.toLowerCase()}|${subclass.name.toLowerCase()}`;

      if (existingKeys.has(key)) {
        return;
      }

      entry.subclasses.push({
        id: createId("subcls"),
        name: subclass.name,
        shortName: subclass.shortName,
        source: subclass.source,
        className: entry.name,
        classSource: entry.source,
        description: "",
        features: []
      });
      existingKeys.add(key);
      imported += 1;
    });
  });

  return {
    imported,
    skipped: Math.max(lookupData.entryCount - imported, 0)
  };
}

function sanitizeSpellEntry(input: unknown): SpellEntry {
  const object = asObject(input, "Spell");

  if ("entries" in object || "time" in object || "range" in object || "duration" in object) {
    return sanitizeExternalSpellEntry(object);
  }

  const components = asObject(object.components ?? {}, "Spell components");
  const classReferences = readObjectArray(object.classReferences).map(sanitizeSpellClassReference);
  const classes = uniqueStrings([
    ...readStringArray(object.classes),
    ...classReferences.map(formatSpellClassReferenceDisplay)
  ]);
  const description = requireString(object.description, "Spell description");
  const higherLevelDescription = readString(object.higherLevelDescription);
  const fullDescription =
    readString(object.fullDescription) || [description, higherLevelDescription].filter(Boolean).join("\n\n") || description;

  return {
    id: readString(object.id) || createId("spl"),
    name: requireString(object.name, "Spell name"),
    source: requireString(object.source, "Spell source"),
    level: parseSpellLevel(object.level),
    school: parseSpellSchool(object.school),
    castingTimeUnit: parseCastingTimeUnit(object.castingTimeUnit),
    castingTimeValue: clampNumber(object.castingTimeValue, 1, 1440, 1),
    rangeType: parseRangeType(object.rangeType),
    rangeValue: clampNumber(object.rangeValue, 0, 5000, 0),
    description: requireString(object.description, "Spell description"),
    components: {
      verbal: readBoolean(components.verbal),
      somatic: readBoolean(components.somatic),
      material: readBoolean(components.material),
      materialText: readString(components.materialText),
      materialValue: clampNumber(components.materialValue, 0, 100000, 0),
      materialConsumed: readBoolean(components.materialConsumed)
    },
    durationUnit: parseDurationUnit(object.durationUnit),
    durationValue: clampNumber(object.durationValue, 0, 100000, 0),
    concentration: readBoolean(object.concentration),
    damageNotation: readString(object.damageNotation),
    damageAbility: parseAbilityOrNull(object.damageAbility),
    higherLevelDescription,
    fullDescription,
    classes,
    classReferences: classReferences.length > 0 ? classReferences : classes.map(createBaseSpellClassReference)
  };
}

function sanitizeMonsterEntry(input: unknown): MonsterTemplate {
  const object = asObject(input, "Monster");

  if ("cr" in object || "action" in object || "spellcasting" in object || "hp" in object) {
    return sanitizeExternalMonsterEntry(object);
  }

  const speeds = asObject(object.speedModes ?? {}, "Monster speed modes");
  const abilities = asObject(object.abilities ?? {}, "Monster abilities");
  return {
    id: readString(object.id) || createId("mon"),
    name: requireString(object.name, "Monster name"),
    source: requireString(object.source, "Monster source"),
    challengeRating: requireString(object.challengeRating, "Monster CR"),
    armorClass: clampNumber(object.armorClass, 0, 50, 10),
    hitPoints: clampNumber(object.hitPoints, 1, 5000, 1),
    initiative: clampNumber(object.initiative, -20, 50, 0),
    speed: clampNumber(object.speed ?? speeds.walk, 0, 1000, 30),
    speedModes: {
      walk: clampNumber(speeds.walk ?? object.speed, 0, 1000, 30),
      fly: clampNumber(speeds.fly, 0, 1000, 0),
      burrow: clampNumber(speeds.burrow, 0, 1000, 0),
      swim: clampNumber(speeds.swim, 0, 1000, 0),
      climb: clampNumber(speeds.climb, 0, 1000, 0)
    },
    abilities: {
      str: clampNumber(abilities.str, 1, 30, 10),
      dex: clampNumber(abilities.dex, 1, 30, 10),
      con: clampNumber(abilities.con, 1, 30, 10),
      int: clampNumber(abilities.int, 1, 30, 10),
      wis: clampNumber(abilities.wis, 1, 30, 10),
      cha: clampNumber(abilities.cha, 1, 30, 10)
    },
    skills: readObjectArray(object.skills).map((entry) => ({
      name: requireString(entry.name, "Monster skill name"),
      bonus: clampNumber(entry.bonus, -20, 50, 0)
    })) satisfies MonsterSkillBonus[],
    senses: readObjectArray(object.senses).map((entry) => ({
      name: requireString(entry.name, "Monster sense name"),
      range: clampNumber(entry.range, 0, 10000, 0),
      notes: readString(entry.notes)
    })) satisfies MonsterSense[],
    passivePerception: clampNumber(object.passivePerception, 0, 50, 10),
    languages: readStringArray(object.languages),
    xp: clampNumber(object.xp, 0, 1000000, 0),
    proficiencyBonus: clampNumber(object.proficiencyBonus, 0, 20, 2),
    gear: readStringArray(object.gear),
    resistances: readStringArray(object.resistances),
    vulnerabilities: readStringArray(object.vulnerabilities),
    immunities: readStringArray(object.immunities),
    traits: readStringArray(object.traits),
    actions: readObjectArray(object.actions).map(sanitizeMonsterAction),
    bonusActions: readObjectArray(object.bonusActions).map(sanitizeMonsterAction),
    reactions: readObjectArray(object.reactions).map(sanitizeMonsterAction),
    legendaryActions: readObjectArray(object.legendaryActions).map(sanitizeMonsterAction),
    legendaryActionsUse: clampNumber(object.legendaryActionsUse, 0, 10, 0),
    lairActions: readObjectArray(object.lairActions).map(sanitizeMonsterAction),
    regionalEffects: readObjectArray(object.regionalEffects).map(sanitizeMonsterAction),
    spells: readStringArray(object.spells),
    spellcasting: readObjectArray(object.spellcasting).map(sanitizeMonsterSpellcastingEntry),
    habitat: readString(object.habitat),
    treasure: readString(object.treasure),
    imageUrl: readString(object.imageUrl),
    color: readString(object.color) || "#9a5546"
  };
}

function sanitizeExternalMonsterEntry(object: Record<string, unknown>): MonsterTemplate {
  const speed = asObject(object.speed ?? {}, "Monster speed");
  const hp = asObject(object.hp ?? {}, "Monster hit points");
  const savingThrows = asObject(object.save ?? {}, "Monster saves");
  const skills = asObject(object.skill ?? {}, "Monster skills");
  const actionEntries = readObjectArray(object.action).map(sanitizeExternalMonsterAction);
  const bonusActionEntries = readObjectArray((object.bonus as unknown) ?? object.bonusActions).map(sanitizeExternalMonsterAction);
  const reactionEntries = readObjectArray((object.reaction as unknown) ?? object.reactions).map(sanitizeExternalMonsterAction);
  const legendaryEntries = readObjectArray((object.legendary as unknown) ?? object.legendaryActions).map(sanitizeExternalMonsterAction);
  const lairEntries = readObjectArray((object.lair as unknown) ?? object.lairActions).map(sanitizeExternalMonsterAction);
  const regionalEntries = readObjectArray((object.regional as unknown) ?? object.regionalEffects).map(sanitizeExternalMonsterAction);
  const spellcastingEntries = readObjectArray(object.spellcasting);
  const parsedSpellcasting = spellcastingEntries.flatMap(readSpellcastingGroups);
  const parsedSpells = parsedSpellcasting.flatMap((entry) => entry.spells.map(extractTaggedName));
  const traitText = [
    buildMonsterMetaLine(object),
    buildSavingThrowLine(savingThrows),
    buildConditionImmunityLine(object.conditionImmune),
    ...spellcastingEntries.map(sanitizeExternalSpellcastingTrait),
    ...readObjectArray(object.trait).map((entry) =>
      `${requireString(entry.name, "Monster trait name")}. ${joinEntries(entry.entries)}`.trim()
    )
  ].filter(Boolean);

  return {
    id: readString(object.id) || createId("mon"),
    name: requireString(object.name, "Monster name"),
    source: formatMonsterSource(object),
    challengeRating: parseExternalChallengeRating(object.cr ?? object.challengeRating),
    armorClass: parseArmorClass(object.ac ?? object.armorClass),
    hitPoints: clampNumber(hp.average ?? object.hitPoints, 1, 5000, 1),
    initiative: parseExternalInitiative(object.initiative, object.dex, object.proficiencyBonus, object.cr),
    speed: clampNumber(speed.walk, 0, 1000, 30),
    speedModes: {
      walk: clampNumber(speed.walk, 0, 1000, 30),
      fly: clampNumber(speed.fly, 0, 1000, 0),
      burrow: clampNumber(speed.burrow, 0, 1000, 0),
      swim: clampNumber(speed.swim, 0, 1000, 0),
      climb: clampNumber(speed.climb, 0, 1000, 0)
    },
    abilities: {
      str: clampNumber(object.str, 1, 30, 10),
      dex: clampNumber(object.dex, 1, 30, 10),
      con: clampNumber(object.con, 1, 30, 10),
      int: clampNumber(object.int, 1, 30, 10),
      wis: clampNumber(object.wis, 1, 30, 10),
      cha: clampNumber(object.cha, 1, 30, 10)
    },
    skills: Object.entries(skills)
      .map(([name, bonus]) => ({
        name: toTitleCase(name),
        bonus: parseSignedNumber(bonus)
      }))
      .filter((entry) => entry.name),
    senses: parseExternalSenses(object.senses),
    passivePerception: clampNumber(object.passive ?? object.passivePerception, 0, 50, 10),
    languages: readStringArray(object.languages),
    xp: parseMonsterXp(object.xp, object.cr),
    proficiencyBonus: parseMonsterProficiencyBonus(object.proficiencyBonus, object.cr),
    gear: readStringArray(object.gear),
    resistances: normalizeExternalDescriptorArray(object.resist ?? object.resistances),
    vulnerabilities: normalizeExternalDescriptorArray(object.vulnerable ?? object.vulnerabilities),
    immunities: normalizeExternalDescriptorArray(object.immune ?? object.immunities),
    traits: traitText,
    actions: actionEntries,
    bonusActions: bonusActionEntries,
    reactions: reactionEntries,
    legendaryActions: legendaryEntries,
    legendaryActionsUse: clampNumber(object.legendaryActionsUse, 0, 10, legendaryEntries.length > 0 ? 3 : 0),
    lairActions: lairEntries,
    regionalEffects: regionalEntries,
    spells: parsedSpells,
    spellcasting: parsedSpellcasting,
    habitat: readStringArray(object.environment).join(", "),
    treasure: readStringArray(object.treasure).join(", "),
    imageUrl: readString(object.imageUrl),
    color: readString(object.color) || "#9a5546"
  };
}

function sanitizeFeatEntry(input: unknown): FeatEntry {
  const object = asObject(input, "Feat");

  if ("entries" in object || "prerequisite" in object || "ability" in object) {
    return sanitizeExternalFeatEntry(object);
  }

  return {
    id: readString(object.id) || createId("fet"),
    name: requireString(object.name, "Feat name"),
    source: requireString(object.source, "Feat source"),
    category: requireString(object.category, "Feat category"),
    abilityScoreIncrease: readString(object.abilityScoreIncrease),
    prerequisites: readString(object.prerequisites),
    description: requireString(object.description, "Feat description")
  };
}

function sanitizeClassEntry(input: unknown): ClassEntry {
  const object = asObject(input, "Class");

  if ("classFeatures" in object || "classTableGroups" in object || "hd" in object) {
    return sanitizeExternalClassEntry(object);
  }

  const hitDieFaces = clampNumber(object.hitDieFaces, 0, 20, 0);
  const primaryAbilities = readStringArray(object.primaryAbilities);
  const savingThrowProficiencies = readStringArray(object.savingThrowProficiencies);
  const startingProficienciesObject = asOptionalObject(object.startingProficiencies);

  return {
    id: readString(object.id) || createId("cls"),
    name: requireString(object.name, "Class name"),
    source: requireString(object.source, "Class source"),
    description: requireString(object.description, "Class description"),
    hitDieFaces,
    primaryAbilities,
    savingThrowProficiencies,
    startingProficiencies: {
      armor: readStringArray(startingProficienciesObject?.armor),
      weapons: readStringArray(startingProficienciesObject?.weapons),
      tools: readStringArray(startingProficienciesObject?.tools)
    },
    features: readObjectArray(object.features).map((entry) => ({
      level: clampNumber(entry.level, 1, 20, 1),
      name: requireString(entry.name, "Class feature name"),
      description: requireString(entry.description, "Class feature description"),
      source: readString(entry.source),
      reference: readString(entry.reference)
    })),
    subclasses: readObjectArray(object.subclasses).map((entry) => sanitizeClassSubclassEntry(entry, readString(object.name), readString(object.source))),
    tables: readObjectArray(object.tables).map((entry) => ({
      name: requireString(entry.name, "Class table name"),
      columns: readStringArray(entry.columns),
      rows: Array.isArray(entry.rows)
        ? entry.rows.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : []))
        : []
    }))
  };
}

function sanitizeReferenceEntry(
  kind: Extract<CompendiumKind, "actions" | "backgrounds" | "items" | "languages" | "races" | "skills">,
  input: unknown
): CompendiumReferenceEntry {
  const object = asObject(input, `${kind} entry`);

  return {
    id: readString(object.id) || createId(kind.slice(0, 3)),
    name: requireString(object.name, `${kind} name`),
    source: formatSourceWithPage(object, kind.slice(0, 1).toUpperCase() + kind.slice(1, -1)),
    category: readReferenceCategory(kind, object),
    description: readReferenceDescription(kind, object),
    tags: readReferenceTags(kind, object)
  };
}

function sanitizeExternalSpellEntry(object: Record<string, unknown>): SpellEntry {
  const components = asObject(object.components ?? {}, "Spell components");
  const range = asObject(object.range ?? {}, "Spell range");
  const timeEntry = readObjectArray(object.time)[0] ?? {};
  const durationEntry = readObjectArray(object.duration)[0] ?? {};
  const higherLevel = joinEntries(object.entriesHigherLevel);
  const description = joinEntries(object.entries);
  const fullDescription = [description, higherLevel].filter(Boolean).join("\n\n");
  const classReferences = parseExternalSpellClassReferences(object.classes);
  const material = components.m;
  const materialObject = typeof material === "object" && material !== null ? material as Record<string, unknown> : null;

  return {
    id: readString(object.id) || createId("spl"),
    name: requireString(object.name, "Spell name"),
    source: formatSourceWithPage(object, "Spell"),
    level: parseSpellLevel(object.level),
    school: parseExternalSpellSchool(object.school),
    castingTimeUnit: parseExternalCastingTimeUnit(timeEntry.unit),
    castingTimeValue: clampNumber(timeEntry.number, 0, 1440, 1),
    rangeType: parseExternalRangeType(range),
    rangeValue: parseExternalRangeValue(range),
    description: description || requireString(object.name, "Spell description"),
    components: {
      verbal: readBoolean(components.v) || readBoolean(components.verbal),
      somatic: readBoolean(components.s) || readBoolean(components.somatic),
      material: Boolean(material),
      materialText: typeof material === "string" ? material : readString(materialObject?.text),
      materialValue: clampNumber(materialObject?.cost, 0, 100000, 0),
      materialConsumed: readBoolean(materialObject?.consume) || readBoolean(components.materialConsumed)
    },
    durationUnit: parseExternalDurationUnit(durationEntry),
    durationValue: parseExternalDurationValue(durationEntry),
    concentration: readBoolean(durationEntry.concentration) || readBoolean(object.concentration),
    damageNotation: readExternalSpellDamageNotation(object),
    damageAbility: parseAbilityOrNull(object.damageAbility),
    higherLevelDescription: higherLevel,
    fullDescription: fullDescription || description || requireString(object.name, "Spell full description"),
    classes: uniqueStrings(classReferences.map(formatSpellClassReferenceDisplay)),
    classReferences
  };
}

function sanitizeExternalFeatEntry(object: Record<string, unknown>): FeatEntry {
  return {
    id: readString(object.id) || createId("fet"),
    name: requireString(object.name, "Feat name"),
    source: formatSourceWithPage(object, "Feat"),
    category: formatExternalFeatCategory(object.category),
    abilityScoreIncrease: formatExternalFeatAbility(object.ability),
    prerequisites: formatExternalFeatPrerequisite(object.prerequisite),
    description: joinEntries(object.entries) || requireString(object.name, "Feat description")
  };
}

function sanitizeExternalClassEntry(object: Record<string, unknown>): ClassEntry {
  const lookupObject =
    typeof object.__classFeatureLookup === "object" && object.__classFeatureLookup !== null
      ? object.__classFeatureLookup as Record<string, unknown>
      : {};

  const lookup = new Map(
    Object.entries(lookupObject)
      .filter(([, value]) => typeof value === "object" && value !== null)
      .map(([key, value]) => [key, value as Record<string, unknown>] as const)
  );

  const primaryAbilities = readPrimaryAbilities(object.primaryAbility);
  const savingThrowProficiencies = readStringArray(object.proficiency).map(toTitleCase);
  const starting = asOptionalObject(object.startingProficiencies);
  const subclassEntries = readObjectArray(object.__subclassEntries);

  return {
    id: readString(object.id) || createId("cls"),
    name: requireString(object.name, "Class name"),
    source: formatSourceWithPage(object, "Class"),
    description: joinEntries(object.entries) || readString(object.description),
    hitDieFaces: clampNumber(asOptionalObject(object.hd)?.faces, 0, 20, 0),
    primaryAbilities,
    savingThrowProficiencies,
    startingProficiencies: {
      armor: readStringArray(starting?.armor),
      weapons: readStringArray(starting?.weapons),
      tools: readStringArray(starting?.tools)
    },
    features: parseExternalClassFeatures(object.classFeatures, lookup, requireString(object.name, "Class name"), readString(object.source)),
    subclasses: subclassEntries.map((entry) =>
      sanitizeExternalClassSubclassEntry(
        entry,
        lookup,
        requireString(object.name, "Class name"),
        readString(object.source)
      )
    ),
    tables: parseExternalClassTables(object.classTableGroups)
  };
}

function sanitizeClassSubclassEntry(input: Record<string, unknown>, className: string, classSource: string): ClassSubclassEntry {
  return {
    id: readString(input.id) || createId("subcls"),
    name: requireString(input.name, "Subclass name"),
    shortName: readString(input.shortName) || requireString(input.name, "Subclass short name"),
    source: requireString(input.source, "Subclass source"),
    className: readString(input.className) || className,
    classSource: readString(input.classSource) || classSource,
    description: readString(input.description),
    features: readObjectArray(input.features).map((feature) => ({
      level: clampNumber(feature.level, 1, 20, 1),
      name: requireString(feature.name, "Subclass feature name"),
      description: requireString(feature.description, "Subclass feature description"),
      source: readString(feature.source),
      reference: readString(feature.reference)
    }))
  };
}

function sanitizeExternalClassSubclassEntry(
  object: Record<string, unknown>,
  lookup: Map<string, Record<string, unknown>>,
  className: string,
  classSource: string
): ClassSubclassEntry {
  const subclassFeatures = readObjectArray(object.subclassFeatures);
  const name = requireString(object.name, "Subclass name");
  const source = readString(object.source);

  return {
    id: readString(object.id) || createId("subcls"),
    name,
    shortName: readString(object.shortName) || name,
    source,
    className: readString(object.className) || className,
    classSource: readString(object.classSource) || classSource,
    description: joinEntries(object.entries) || readString(object.description),
    features: parseExternalClassFeatures(subclassFeatures, lookup, className, source || classSource)
  };
}

function sanitizeSpellClassReference(input: Record<string, unknown>): SpellClassReference {
  const kind = readString(input.kind) as SpellClassReference["kind"];
  const normalizedKind: SpellClassReference["kind"] =
    kind === "classVariant" || kind === "subclass" || kind === "subclassVariant" ? kind : "class";
  const name = requireString(input.name, "Spell class reference name");
  const source = readString(input.source);
  const className = readString(input.className) || name;
  const classSource = readString(input.classSource) || source;

  return {
    name,
    source,
    kind: normalizedKind,
    className,
    classSource,
    definedInSources: readStringArray(input.definedInSources)
  };
}

function buildSubclassSpellClassReference(
  entry: Record<string, unknown>,
  kind: "subclass" | "subclassVariant"
): SpellClassReference | null {
  const subclass = asOptionalObject(entry.subclass);
  const classObject = asOptionalObject(entry.class);
  const name = readString(subclass?.name);

  if (!name) {
    return null;
  }

  return sanitizeSpellClassReference({
    name,
    source: readString(subclass?.source),
    kind,
    className: readString(classObject?.name),
    classSource: readString(classObject?.source)
  });
}

function createBaseSpellClassReference(name: string): SpellClassReference {
  return {
    name,
    source: "",
    kind: "class",
    className: name,
    classSource: "",
    definedInSources: []
  };
}

function ensureSpellClassReferences(spell: SpellEntry): SpellClassReference[] {
  return spell.classReferences.length > 0 ? spell.classReferences : spell.classes.map(createBaseSpellClassReference);
}

function formatSpellClassReferenceDisplay(reference: SpellClassReference) {
  if (reference.kind === "subclass" || reference.kind === "subclassVariant") {
    return reference.className ? `${reference.name} (${reference.className})` : reference.name;
  }

  return reference.name;
}

function sanitizeMonsterAction(input: Record<string, unknown>): MonsterActionEntry {
  return {
    name: requireString(input.name, "Monster action name"),
    description: requireString(input.description, "Monster action description"),
    damage: readString(input.damage),
    attackType: parseMonsterAttackType(input.attackType),
    attackBonus: clampNumber(input.attackBonus, -20, 50, 0),
    reachOrRange: readString(input.reachOrRange),
    damageType: readString(input.damageType)
  };
}

function sanitizeExternalMonsterAction(input: Record<string, unknown>): MonsterActionEntry {
  const description = joinEntries(input.entries);
  const normalized = renderRulesText(description);
  return {
    name: requireString(input.name, "Monster action name"),
    description,
    damage: readFirstDamage(normalized),
    attackType: parseAttackTypeFromText(normalized),
    attackBonus: parseAttackBonusFromText(normalized),
    reachOrRange: readReachOrRange(normalized),
    damageType: readDamageType(normalized)
  };
}

function asObject(value: unknown, label: string) {
  if (typeof value !== "object" || value === null) {
    throw new HttpError(400, `${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `${label} is required.`);
  }

  return value.trim();
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(value: unknown) {
  return value === true;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => String(entry ?? "").trim()).filter(Boolean) : [];
}

function readObjectArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    : [];
}

function parseAbilityOrNull(value: unknown): AbilityKey | null {
  return value === "str" ||
    value === "dex" ||
    value === "con" ||
    value === "int" ||
    value === "wis" ||
    value === "cha"
    ? value
    : null;
}

function parseSpellLevel(value: unknown): SpellLevel {
  if (value === "cantrip" || value === 0) {
    return "cantrip";
  }

  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 9) {
    return value as SpellLevel;
  }

  throw new HttpError(400, "Spell level must be cantrip or 1-9.");
}

function parseSpellSchool(value: unknown): SpellSchool {
  if (
    value === "Abjuration" ||
    value === "Conjuration" ||
    value === "Divination" ||
    value === "Enchantment" ||
    value === "Evocation" ||
    value === "Illusion" ||
    value === "Necromancy" ||
    value === "Transmutation"
  ) {
    return value;
  }

  throw new HttpError(400, "Invalid spell school.");
}

function parseCastingTimeUnit(value: unknown): SpellCastingTimeUnit {
  if (value === "action" || value === "bonus action" || value === "reaction" || value === "minute" || value === "hour") {
    return value;
  }

  throw new HttpError(400, "Invalid casting time unit.");
}

function parseRangeType(value: unknown): SpellRangeType {
  if (value === "feet" || value === "self" || value === "self emanation" || value === "touch" || value === "sight" || value === "unlimited" || value === "special") {
    return value;
  }

  throw new HttpError(400, "Invalid spell range type.");
}

function parseDurationUnit(value: unknown): SpellDurationUnit {
  if (value === "instant" || value === "minute" || value === "hour" || value === "day" || value === "permanent" || value === "special") {
    return value;
  }

  throw new HttpError(400, "Invalid spell duration unit.");
}

function parseMonsterAttackType(value: unknown): MonsterAttackType {
  if (value === "melee" || value === "ranged" || value === "melee or ranged" || value === "other") {
    return value;
  }

  return "other";
}

function formatMonsterSource(object: Record<string, unknown>) {
  const source = requireString(object.source, "Monster source");
  const page = typeof object.page === "number" ? object.page : null;
  return page ? `${source} p.${page}` : source;
}

function formatSourceWithPage(object: Record<string, unknown>, label: string) {
  const source = requireString(object.source, `${label} source`);
  const page = typeof object.page === "number" ? object.page : null;
  return page ? `${source} p.${page}` : source;
}

function parseArmorClass(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampNumber(value, 0, 50, 10);
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === "number" && Number.isFinite(entry)) {
        return clampNumber(entry, 0, 50, 10);
      }

      if (typeof entry === "object" && entry !== null && typeof (entry as { ac?: unknown }).ac === "number") {
        return clampNumber((entry as { ac: number }).ac, 0, 50, 10);
      }
    }
  }

  return 10;
}

function parseExternalSpellSchool(value: unknown): SpellSchool {
  const school = readString(value).toUpperCase();
  const mapping: Record<string, SpellSchool> = {
    A: "Abjuration",
    C: "Conjuration",
    D: "Divination",
    E: "Enchantment",
    V: "Evocation",
    I: "Illusion",
    N: "Necromancy",
    T: "Transmutation",
    ABJURATION: "Abjuration",
    CONJURATION: "Conjuration",
    DIVINATION: "Divination",
    ENCHANTMENT: "Enchantment",
    EVOCATION: "Evocation",
    ILLUSION: "Illusion",
    NECROMANCY: "Necromancy",
    TRANSMUTATION: "Transmutation"
  };

  const mapped = mapping[school];
  if (!mapped) {
    throw new HttpError(400, "Invalid spell school.");
  }
  return mapped;
}

function parseExternalCastingTimeUnit(value: unknown): SpellCastingTimeUnit {
  const normalized = readString(value).toLowerCase();
  if (normalized === "bonus" || normalized === "bonus action") {
    return "bonus action";
  }
  if (normalized === "reaction") {
    return "reaction";
  }
  if (normalized === "minute" || normalized === "minutes") {
    return "minute";
  }
  if (normalized === "hour" || normalized === "hours") {
    return "hour";
  }
  return "action";
}

function parseExternalRangeType(range: Record<string, unknown>): SpellRangeType {
  const type = readString(range.type).toLowerCase();
  const distance = asOptionalObject(range.distance);
  const distanceType = readString(distance?.type).toLowerCase();

  if (type === "special" || distanceType === "special") {
    return "special";
  }
  if (distanceType === "touch" || type === "touch") {
    return "touch";
  }
  if (distanceType === "self" || type === "self") {
    return "self";
  }
  if (distanceType === "sight") {
    return "sight";
  }
  if (distanceType === "unlimited" || distanceType === "plane") {
    return "unlimited";
  }
  if (["cone", "radius", "sphere", "hemisphere", "line", "cube", "cylinder"].includes(type)) {
    return "self emanation";
  }
  return "feet";
}

function parseExternalRangeValue(range: Record<string, unknown>) {
  const distance = asOptionalObject(range.distance);
  return clampNumber(distance?.amount, 0, 5000, 0);
}

function parseExternalDurationUnit(durationEntry: Record<string, unknown>): SpellDurationUnit {
  const type = readString(durationEntry.type).toLowerCase();
  const duration = asOptionalObject(durationEntry.duration);
  const unit = readString(duration?.type).toLowerCase();

  if (type === "instant") {
    return "instant";
  }
  if (type === "permanent") {
    return "permanent";
  }
  if (type === "special") {
    return "special";
  }
  if (unit === "minute" || unit === "minutes") {
    return "minute";
  }
  if (unit === "hour" || unit === "hours") {
    return "hour";
  }
  if (unit === "day" || unit === "days") {
    return "day";
  }
  return "instant";
}

function parseExternalDurationValue(durationEntry: Record<string, unknown>) {
  const duration = asOptionalObject(durationEntry.duration);
  return clampNumber(duration?.amount, 0, 100000, 0);
}

function parseExternalSpellClassReferences(value: unknown): SpellClassReference[] {
  if (Array.isArray(value)) {
    return uniqueBy(
      readStringArray(value).map(createBaseSpellClassReference),
      (entry) => [entry.kind, entry.name.toLowerCase(), entry.className.toLowerCase()].join("|")
    );
  }

  const object = asOptionalObject(value);

  if (!object) {
    return [];
  }

  const references = [
    ...readObjectArray(object.fromClassList).map((entry) => sanitizeSpellClassReference({
      name: readString(entry.name),
      source: readString(entry.source),
      kind: "class",
      className: readString(entry.name),
      classSource: readString(entry.source)
    })),
    ...readObjectArray(object.fromClassListVariant).map((entry) => sanitizeSpellClassReference({
      name: readString(entry.name),
      source: readString(entry.source),
      kind: "classVariant",
      className: readString(entry.name),
      classSource: readString(entry.source)
    })),
    ...readObjectArray(object.fromSubclass).map((entry) => buildSubclassSpellClassReference(entry, "subclass")),
    ...readObjectArray(object.fromSubclassVariant).map((entry) => buildSubclassSpellClassReference(entry, "subclassVariant"))
  ]
    .filter((entry): entry is SpellClassReference => Boolean(entry))
    .filter((entry) => entry.name);

  return uniqueBy(references, (entry) =>
    [entry.kind, entry.name.toLowerCase(), entry.source.toLowerCase(), entry.className.toLowerCase(), entry.classSource.toLowerCase()].join("|")
  );
}

function readGeneratedSpellLookupData(value: unknown) {
  const root = asOptionalObject(value);
  const referencesBySpellKey = new Map<string, SpellClassReference[]>();

  if (!root) {
    return {
      entryCount: 0,
      referencesBySpellKey
    };
  }

  Object.entries(root).forEach(([spellSource, spellBucket]) => {
    const spells = asOptionalObject(spellBucket);

    if (!spells) {
      return;
    }

    Object.entries(spells).forEach(([spellName, lookupEntry]) => {
      const lookupObject = asOptionalObject(lookupEntry);

      if (!lookupObject) {
        return;
      }

      const references = parseGeneratedSpellLookupReferences(lookupObject);

      if (references.length === 0) {
        return;
      }

      referencesBySpellKey.set(createGeneratedSpellLookupKey(spellSource, spellName), references);
    });
  });

  return {
    entryCount: referencesBySpellKey.size,
    referencesBySpellKey
  };
}

function parseGeneratedSpellLookupReferences(lookupObject: Record<string, unknown>) {
  return uniqueBy(
    [
      ...parseGeneratedSpellLookupClassReferences(lookupObject.class, "class"),
      ...parseGeneratedSpellLookupClassReferences(lookupObject.classVariant, "classVariant"),
      ...parseGeneratedSpellLookupSubclassReferences(lookupObject.subclass, "subclass"),
      ...parseGeneratedSpellLookupSubclassReferences(lookupObject.subclassVariant, "subclassVariant")
    ],
    (entry) =>
      [
        entry.kind,
        entry.name.toLowerCase(),
        entry.source.toLowerCase(),
        entry.className.toLowerCase(),
        entry.classSource.toLowerCase()
      ].join("|")
  );
}

function parseGeneratedSpellLookupClassReferences(
  value: unknown,
  kind: "class" | "classVariant"
): SpellClassReference[] {
  const sources = asOptionalObject(value);

  if (!sources) {
    return [];
  }

  return Object.entries(sources).flatMap(([classSource, classEntries]) => {
    const classes = asOptionalObject(classEntries);

    if (!classes) {
      return [];
    }

    return Object.entries(classes).map(([className, classMetadata]) =>
      sanitizeSpellClassReference({
        name: className,
        source: classSource,
        kind,
        className,
        classSource,
        definedInSources: readStringArray(asOptionalObject(classMetadata)?.definedInSources)
      })
    );
  });
}

function parseGeneratedSpellLookupSubclassReferences(
  value: unknown,
  kind: "subclass" | "subclassVariant"
): SpellClassReference[] {
  const classSources = asOptionalObject(value);

  if (!classSources) {
    return [];
  }

  return Object.entries(classSources).flatMap(([classSource, classesValue]) => {
    const classes = asOptionalObject(classesValue);

    if (!classes) {
      return [];
    }

    return Object.entries(classes).flatMap(([className, subclassSourcesValue]) => {
      const subclassSources = asOptionalObject(subclassSourcesValue);

      if (!subclassSources) {
        return [];
      }

      return Object.entries(subclassSources).flatMap(([subclassSource, subclassEntriesValue]) => {
        const subclassEntries = asOptionalObject(subclassEntriesValue);

        if (!subclassEntries) {
          return [];
        }

        return Object.entries(subclassEntries).map(([fallbackName, subclassMetadata]) => {
          const metadata = asOptionalObject(subclassMetadata);

          return sanitizeSpellClassReference({
            name: readString(metadata?.name) || fallbackName,
            source: subclassSource,
            kind,
            className,
            classSource,
            definedInSources: readStringArray(metadata?.definedInSources)
          });
        });
      });
    });
  });
}

function readGeneratedSubclassLookupData(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      entryCount: 0,
      subclassesByClassKey: new Map<string, Array<{ name: string; shortName: string; source: string }>>()
    };
  }

  const subclassesByClassKey = new Map<string, Array<{ name: string; shortName: string; source: string }>>();
  let entryCount = 0;

  Object.entries(value as Record<string, unknown>).forEach(([classSource, classesValue]) => {
    const classes = asOptionalObject(classesValue);

    if (!classes) {
      return;
    }

    Object.entries(classes).forEach(([className, subclassSourcesValue]) => {
      const subclassSources = asOptionalObject(subclassSourcesValue);

      if (!subclassSources) {
        return;
      }

      const classKey = createGeneratedSubclassLookupKey(classSource, className);
      const current = subclassesByClassKey.get(classKey) ?? [];

      Object.entries(subclassSources).forEach(([subclassSource, subclassesValue]) => {
        const subclasses = asOptionalObject(subclassesValue);

        if (!subclasses) {
          return;
        }

        Object.entries(subclasses).forEach(([shortName, subclassValue]) => {
          const metadata = asOptionalObject(subclassValue);
          current.push({
            name: readString(metadata?.name) || shortName,
            shortName,
            source: subclassSource
          });
          entryCount += 1;
        });
      });

      subclassesByClassKey.set(classKey, current);
    });
  });

  return {
    entryCount,
    subclassesByClassKey
  };
}

function mergeSpellClassReferences(existing: SpellClassReference[], incoming: SpellClassReference[]) {
  const exactEntries = uniqueBy(
    [...incoming, ...existing],
    (entry) =>
      [
        entry.kind,
        entry.name.toLowerCase(),
        entry.source.toLowerCase(),
        entry.className.toLowerCase(),
        entry.classSource.toLowerCase()
      ].join("|")
  );
  const richKeys = new Set(
    exactEntries
      .filter((entry) => entry.source || entry.classSource)
      .map((entry) => [entry.kind, entry.name.toLowerCase(), entry.className.toLowerCase()].join("|"))
  );

  return exactEntries.filter((entry) => {
    if (entry.source || entry.classSource) {
      return true;
    }

    return !richKeys.has([entry.kind, entry.name.toLowerCase(), entry.className.toLowerCase()].join("|"));
  });
}

function createGeneratedSpellLookupKey(source: string, spellName: string) {
  return `${normalizeGeneratedSpellLookupPart(source)}|${normalizeGeneratedSpellLookupPart(spellName)}`;
}

function createGeneratedSubclassLookupKey(source: string, className: string) {
  return `${normalizeGeneratedSpellLookupPart(source)}|${normalizeGeneratedSpellLookupPart(className)}`;
}

function normalizeGeneratedSpellLookupPart(value: string) {
  return value.trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");
}

function getSpellSourceCode(source: string) {
  return source.split(/\s+p\.\d+/i)[0]?.trim() || source.trim();
}

function readExternalSpellDamageNotation(object: Record<string, unknown>) {
  const scaling = asOptionalObject(object.scalingLevelDice);
  const label = readString(scaling?.label);
  if (label) {
    return label;
  }

  const damage = asOptionalObject(object.damageInflict);
  if (damage) {
    return readString(damage);
  }

  return "";
}

function formatExternalFeatCategory(value: unknown) {
  const normalized = readString(value).toUpperCase();
  const mapping: Record<string, string> = {
    G: "General Feat",
    O: "Origin Feat",
    E: "Epic Boon",
    D: "Dragonmark Feat",
    F: "Fighting Style Feat"
  };

  return mapping[normalized] || readString(value) || "Feat";
}

function formatExternalFeatAbility(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return "";
      }

      const object = entry as Record<string, unknown>;
      const direct = Object.entries(object)
        .filter(([key]) => ["str", "dex", "con", "int", "wis", "cha"].includes(key))
        .map(([key, amount]) => `${toTitleCase(key)} +${clampNumber(amount, 0, 10, 1)}`);

      if (direct.length > 0) {
        return direct.join(", ");
      }

      const choose = asOptionalObject(object.choose);
      if (choose) {
        const from = readStringArray(choose.from).map(toTitleCase);
        const amount = clampNumber(choose.amount, 0, 10, 1);
        const count = clampNumber(choose.count, 0, 10, 1);
        if (from.length > 0) {
          if (count > 1 && amount <= 1) {
            return `Increase ${count} of ${from.join(", ")} by 1`;
          }
          return `Increase ${from.join(", ")} by ${amount}`;
        }
      }

      return "";
    })
    .filter(Boolean)
    .join("; ");
}

function formatExternalFeatPrerequisite(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return "";
      }

      const object = entry as Record<string, unknown>;
      const parts = [];
      if (typeof object.level === "number") {
        parts.push(`Level ${object.level}+`);
      }
      if (Array.isArray(object.ability)) {
        parts.push(formatExternalFeatAbility(object.ability));
      }
      if (Array.isArray(object.feat)) {
        parts.push(readStringArray(object.feat).map(extractPipeDisplayName).join(", "));
      }
      if (typeof object.other === "string") {
        parts.push(object.other);
      }
      if (Array.isArray(object.campaign)) {
        parts.push(`Campaign: ${readStringArray(object.campaign).join(", ")}`);
      }
      return parts.filter(Boolean).join("; ");
    })
    .filter(Boolean)
    .join(" or ");
}

function parseExternalClassFeatures(
  value: unknown,
  lookup: Map<string, Record<string, unknown>>,
  className: string,
  classSource: string
): ClassFeatureEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const flattened: Array<{ entry: unknown; fallbackLevel: number | null }> = [];

  value.forEach((entryOrEntries, levelIndex) => {
    if (Array.isArray(entryOrEntries)) {
      entryOrEntries.forEach((entry) => {
        flattened.push({
          entry,
          fallbackLevel: levelIndex + 1
        });
      });
      return;
    }

    flattened.push({
      entry: entryOrEntries,
      fallbackLevel: null
    });
  });

  return flattened
    .map(({ entry, fallbackLevel }) => resolveExternalClassFeatureEntry(entry, lookup, className, classSource, fallbackLevel))
    .filter((entry): entry is ClassFeatureEntry => entry !== null);
}

function parseExternalClassTables(value: unknown) {
  return readObjectArray(value).map((entry) => ({
    name: readString(entry.title) || readString(entry.name) || "Class Table",
    columns: readArray(entry.colLabels).map((label) => renderTableCell(label)).filter(Boolean),
    rows: readArray(Array.isArray(entry.rows) && entry.rows.length > 0 ? entry.rows : entry.rowsSpellProgression)
      .map((row) => (Array.isArray(row) ? row.map((cell) => renderTableCell(cell)) : []))
  }));
}

function resolveExternalClassFeatureEntry(
  value: unknown,
  lookup: Map<string, Record<string, unknown>>,
  className: string,
  classSource: string,
  fallbackLevel: number | null
): ClassFeatureEntry | null {
  if (typeof value === "string") {
    return buildExternalClassFeatureFromReference(value, lookup, className, classSource, fallbackLevel);
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  const object = value as Record<string, unknown>;
  const reference =
    readString(object.classFeature) ||
    readString(object.subclassFeature) ||
    readString(object.feature) ||
    readString(object.ref);

  if (reference) {
    return buildExternalClassFeatureFromReference(reference, lookup, className, classSource, fallbackLevel);
  }

  const inlineName = readString(object.name) || `Level ${fallbackLevel ?? 1} Feature`;
  const inlineDescription = renderEntryNode(object.entry) || joinEntries(object.entries) || joinEntries(object.headerEntries);
  const inlineLevel = readExternalClassFeatureLevel(object.level) ?? fallbackLevel ?? 1;

  if (!inlineName && !inlineDescription) {
    return null;
  }

  return {
    level: inlineLevel,
    name: inlineName,
    description: inlineDescription,
    source: readString(object.source) || classSource,
    reference: readString(object.reference)
  };
}

function buildExternalClassFeatureFromReference(
  reference: string,
  lookup: Map<string, Record<string, unknown>>,
  className: string,
  classSource: string,
  fallbackLevel: number | null
): ClassFeatureEntry | null {
  const parsedReference = parseExternalClassFeatureReference(reference, className);
  const feature = findExternalClassFeatureData(parsedReference, lookup);
  const level = feature ? readExternalClassFeatureLevel(feature.level) : null;
  const description = feature ? getExternalClassFeatureDescription(feature) : "";
  const resolvedName = feature ? requireString(feature.name, "Class feature name") : parsedReference.name;

  if (!resolvedName) {
    return null;
  }

  return {
    level: level ?? parsedReference.level ?? fallbackLevel ?? 1,
    name: resolvedName,
    description,
    source: feature ? readString(feature.source) || classSource : parsedReference.source || classSource,
    reference
  };
}

function parseExternalClassFeatureReference(reference: string, fallbackClassName: string) {
  const trimmed = reference.trim();
  const parts = trimmed.split("|").map((part) => part.trim());

  return {
    name: parts[0] || extractPipeDisplayName(trimmed),
    className: parts[1] || fallbackClassName,
    classSource: parts[2] || "",
    level: readExternalClassFeatureLevel(parts[3]),
    source: parts[4] || ""
  };
}

function findExternalClassFeatureData(
  reference: ReturnType<typeof parseExternalClassFeatureReference>,
  lookup: Map<string, Record<string, unknown>>
) {
  const key = [reference.name, reference.className, reference.source, reference.level ?? ""]
    .filter(Boolean)
    .join("|")
    .toLowerCase();

  const directMatch = lookup.get(key);
  if (directMatch) {
    return directMatch;
  }

  const normalizedName = reference.name.toLowerCase();
  const normalizedClassName = reference.className.toLowerCase();
  const normalizedSource = reference.source.toLowerCase();
  const normalizedClassSource = reference.classSource.toLowerCase();

  return Array.from(lookup.values()).find((entry) => {
    const entryName = readString(entry.name).toLowerCase();
    const entryClassName = readString(entry.className).toLowerCase();
    const entrySource = readString(entry.source).toLowerCase();
    const entryClassSource = readString(entry.classSource).toLowerCase();
    const entryLevel = readExternalClassFeatureLevel(entry.level);

    if (entryName !== normalizedName) {
      return false;
    }

    if (normalizedClassName && entryClassName && entryClassName !== normalizedClassName) {
      return false;
    }

    if (reference.level !== null && entryLevel !== null && entryLevel !== reference.level) {
      return false;
    }

    if (normalizedSource && entrySource && entrySource !== normalizedSource) {
      return false;
    }

    if (normalizedClassSource && entryClassSource && entryClassSource !== normalizedClassSource) {
      return false;
    }

    return true;
  }) ?? null;
}

function readExternalClassFeatureLevel(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampNumber(value, 1, 20, 1);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return clampNumber(parsed, 1, 20, 1);
    }
  }

  return null;
}

function getExternalClassFeatureDescription(feature: Record<string, unknown>) {
  return renderEntryNode(feature.entry) || joinEntries(feature.entries) || joinEntries(feature.headerEntries);
}

function renderTableCell(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value !== "object" || value === null) {
    return "";
  }

  return renderEntryNode(value);
}

function readPrimaryAbilities(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (typeof entry === "string") {
      return [toTitleCase(entry)];
    }
    if (typeof entry !== "object" || entry === null) {
      return [];
    }
    const object = entry as Record<string, unknown>;
    if (Array.isArray(object.choose)) {
      return readStringArray(object.choose).map(toTitleCase);
    }
    return Object.keys(object)
      .filter((key) => ["str", "dex", "con", "int", "wis", "cha"].includes(key))
      .map(toTitleCase);
  });
}

function getCompendiumEntityKey(entry: Record<string, unknown>) {
  const level =
    typeof entry.level === "number" && Number.isFinite(entry.level)
      ? String(entry.level)
      : readString(entry.level);

  return [readString(entry.name), readString(entry.className), readString(entry.source), level]
    .filter(Boolean)
    .join("|")
    .toLowerCase();
}

function readReferenceCategory(
  kind: Extract<CompendiumKind, "actions" | "backgrounds" | "items" | "languages" | "races" | "skills">,
  object: Record<string, unknown>
) {
  switch (kind) {
    case "actions":
      return readObjectArray(object.time)
        .map((entry) => {
          const number = clampNumber(entry.number, 0, 24, 0);
          const unit = readString(entry.unit);
          return number > 0 && unit ? `${number} ${unit}` : unit;
        })
        .filter(Boolean)
        .join(", ") || "Action";
    case "backgrounds":
      return "Background";
    case "items":
      return [readString(object.type), readString(object.rarity)].filter(Boolean).join(" • ") || "Item";
    case "languages":
      return readString(object.type) || "Language";
    case "races":
      return readStringArray(object.size).join("/") || "Race";
    case "skills":
      return readString(object.ability).toUpperCase() || "Skill";
  }
}

function readReferenceDescription(
  kind: Extract<CompendiumKind, "actions" | "backgrounds" | "items" | "languages" | "races" | "skills">,
  object: Record<string, unknown>
) {
  const entries = joinEntries(object.entries) || joinEntries(object.additionalEntries);

  switch (kind) {
    case "actions":
    case "backgrounds":
    case "items":
    case "races":
    case "skills":
      return entries || requireString(object.name, `${kind} description`);
    case "languages": {
      const details = [
        entries,
        readString(object.origin) ? `Origin: ${readString(object.origin)}` : "",
        readString(object.script) ? `Script: ${readString(object.script)}` : "",
        readStringArray(object.typicalSpeakers).length > 0
          ? `Typical Speakers: ${readStringArray(object.typicalSpeakers).join(", ")}`
          : ""
      ].filter(Boolean);

      return details.join("\n") || requireString(object.name, "Language description");
    }
  }
}

function readReferenceTags(
  kind: Extract<CompendiumKind, "actions" | "backgrounds" | "items" | "languages" | "races" | "skills">,
  object: Record<string, unknown>
) {
  switch (kind) {
    case "actions":
      return uniqueStrings(readObjectArray(object.time).map((entry) => readString(entry.unit)));
    case "backgrounds":
      return uniqueStrings([
        ...Object.keys(asOptionalObject(readObjectArray(object.skillProficiencies)[0]) ?? {}).map(toTitleCase),
        ...Object.keys(asOptionalObject(readObjectArray(object.toolProficiencies)[0]) ?? {}).map(toTitleCase),
        ...readStringArray(object.feats).map(extractPipeDisplayName)
      ]);
    case "items":
      return uniqueStrings([
        readString(object.type),
        readString(object.rarity),
        readBoolean(object.wondrous) ? "wondrous" : "",
        readString(object.reqAttune)
      ]);
    case "languages":
      return uniqueStrings([
        readString(object.type),
        readString(object.script),
        ...readStringArray(object.typicalSpeakers)
      ]);
    case "races":
      return uniqueStrings([
        ...readStringArray(object.traitTags),
        ...readStringArray(object.creatureTypes),
        ...readStringArray(object.size)
      ]);
    case "skills":
      return uniqueStrings([readString(object.ability).toUpperCase()]);
  }
}

function extractPipeDisplayName(value: string) {
  const cleaned = value.replace(/^\{@[^ ]+\s*|\}$/g, "");
  const [name] = cleaned.split("|");
  return name.trim();
}

function asOptionalObject(value: unknown) {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function buildMonsterMetaLine(object: Record<string, unknown>) {
  const size = formatMonsterSizes(object.size);
  const type = formatMonsterTypeValue(object.type);
  const alignment = formatMonsterAlignment(object.alignment);
  const parts = [size, type, alignment].filter(Boolean);
  return parts.length > 0 ? parts.join(" • ") : "";
}

function buildSavingThrowLine(savingThrows: Record<string, unknown>) {
  const entries = Object.entries(savingThrows)
    .map(([key, value]) => `${key.toUpperCase()} ${String(value ?? "").trim()}`)
    .filter((entry) => !entry.endsWith(" "));

  return entries.length > 0 ? `Saving Throws: ${entries.join(", ")}` : "";
}

function sanitizeExternalSpellcastingTrait(input: Record<string, unknown>) {
  const name = requireString(input.name, "Spellcasting trait name");
  const headers = readStringArray(input.headerEntries);
  const groups = readSpellcastingGroups(input);
  const spellsLine = groups.length > 0
    ? groups.map((group) => `${group.label}: ${group.spells.join(", ")}`).join("\n")
    : "";
  return [name, ...headers, spellsLine].filter(Boolean).join("\n");
}

function sanitizeMonsterSpellcastingEntry(input: Record<string, unknown>): MonsterSpellcastingEntry {
  return {
    label: requireString(input.label, "Monster spellcasting label"),
    spells: readStringArray(input.spells)
  };
}

function readSpellcastingGroups(input: Record<string, unknown>): MonsterSpellcastingEntry[] {
  const groups: MonsterSpellcastingEntry[] = [];

  const pushGroup = (label: string, spells: string[]) => {
    const normalizedSpells = Array.from(new Set(spells.filter(Boolean)));
    if (normalizedSpells.length === 0) {
      return;
    }
    groups.push({ label, spells: normalizedSpells });
  };

  pushGroup("At will", readStringArray(input.will));
  pushGroup("Constant", readStringArray(input.constant));
  pushFrequencyGroups(groups, input.daily, "/day");
  pushFrequencyGroups(groups, input.weekly, "/week");
  pushFrequencyGroups(groups, input.rest, "/rest");

  if (typeof input.spells === "object" && input.spells !== null && !Array.isArray(input.spells)) {
    for (const [label, spells] of Object.entries(input.spells)) {
      pushGroup(label, readStringArray(spells));
    }
  } else {
    pushGroup("Spells", flattenSpellFrequencyBlock(input.spells));
  }

  return groups;
}

function flattenSpellFrequencyBlock(value: unknown): string[] {
  if (Array.isArray(value)) {
    return readStringArray(value);
  }

  if (typeof value !== "object" || value === null) {
    return [];
  }

  return Object.values(value).flatMap((entry) => readStringArray(entry));
}

function pushFrequencyGroups(groups: MonsterSpellcastingEntry[], value: unknown, suffix: string) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return;
  }

  for (const [key, spells] of Object.entries(value)) {
    const normalizedSpells = readStringArray(spells);
    if (normalizedSpells.length === 0) {
      continue;
    }
    groups.push({
      label: `${key}${suffix}`,
      spells: Array.from(new Set(normalizedSpells))
    });
  }
}

function joinEntries(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value.map(renderEntryNode).filter(Boolean).join("\n");
}

function renderRulesText(value: string) {
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

function parseSignedNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = Number(value.replace(/[^0-9+-]/g, ""));
    return Number.isFinite(normalized) ? normalized : 0;
  }

  return 0;
}

function parseAttackTypeFromText(value: string): MonsterAttackType {
  const lower = value.toLowerCase();

  if (lower.includes("melee") && lower.includes("range")) {
    return "melee or ranged";
  }

  if (lower.includes("melee")) {
    return "melee";
  }

  if (lower.includes("range")) {
    return "ranged";
  }

  return "other";
}

function parseAttackBonusFromText(value: string) {
  const match = value.match(/([+-]\d+)(?=,|\s*reach|\s*range|\s*Hit:)/i);
  return match ? parseSignedNumber(match[1]) : 0;
}

function readReachOrRange(value: string) {
  const match = value.match(/(reach [^,.]+(?:,? or range [^,.]+)?|range [^,.]+)/i);
  return match ? match[1].trim() : "";
}

function readFirstDamage(value: string) {
  const match = value.match(/\b(\d+d\d+(?:\s*[+-]\s*\d+)?)\b/i);
  return match ? match[1].replace(/\s+/g, "") : "";
}

function readDamageType(value: string) {
  const match = value.match(/\)\s*([A-Za-z]+)\s+damage/i);
  return match ? match[1].toLowerCase() : "";
}

function extractTaggedName(value: string) {
  const spellMatch = value.match(/\{@spell ([^}|]+)(?:\|[^}]+)?}/i);

  if (spellMatch) {
    return spellMatch[1].trim();
  }

  return renderRulesText(value);
}

function toTitleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMonsterSizes(value: unknown) {
  const sizeLabels: Record<string, string> = {
    T: "Tiny",
    S: "Small",
    M: "Medium",
    L: "Large",
    H: "Huge",
    G: "Gargantuan"
  };

  return readStringArray(value)
    .map((entry) => sizeLabels[entry] ?? entry)
    .join("/");
}

function formatMonsterAlignment(value: unknown) {
  const alignmentLabels: Record<string, string> = {
    L: "Lawful",
    C: "Chaotic",
    N: "Neutral",
    G: "Good",
    E: "Evil",
    U: "Unaligned"
  };

  const parts = readStringArray(value);
  if (parts.length === 1 && parts[0] === "U") {
    return "Unaligned";
  }

  return parts.map((entry) => alignmentLabels[entry] ?? entry).join(" ");
}

function parseExternalChallengeRating(value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "object" && value !== null) {
    const challenge = (value as { cr?: unknown }).cr;
    if (typeof challenge === "string" && challenge.trim().length > 0) {
      return challenge.trim();
    }
    if (typeof challenge === "number" && Number.isFinite(challenge)) {
      return String(challenge);
    }
  }

  throw new HttpError(400, "Monster CR is required.");
}

function readChallengeRatingValue(value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "object" && value !== null) {
    return readChallengeRatingValue((value as { cr?: unknown }).cr);
  }

  return "";
}

function parseMonsterXp(xpValue: unknown, challengeRatingValue: unknown) {
  if (typeof xpValue === "number" && Number.isFinite(xpValue)) {
    return clampNumber(xpValue, 0, 1000000, 0);
  }

  const challengeRating = readChallengeRatingValue(challengeRatingValue);
  const experienceByCr: Record<string, number> = {
    "0": 10,
    "1/8": 25,
    "1/4": 50,
    "1/2": 100,
    "1": 200,
    "2": 450,
    "3": 700,
    "4": 1100,
    "5": 1800,
    "6": 2300,
    "7": 2900,
    "8": 3900,
    "9": 5000,
    "10": 5900,
    "11": 7200,
    "12": 8400,
    "13": 10000,
    "14": 11500,
    "15": 13000,
    "16": 15000,
    "17": 18000,
    "18": 20000,
    "19": 22000,
    "20": 25000,
    "21": 33000,
    "22": 41000,
    "23": 50000,
    "24": 62000,
    "25": 75000,
    "26": 90000,
    "27": 105000,
    "28": 120000,
    "29": 135000,
    "30": 155000
  };

  return experienceByCr[challengeRating] ?? 0;
}

function parseMonsterProficiencyBonus(value: unknown, challengeRatingValue: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampNumber(value, 0, 20, 2);
  }

  const challengeRating = readChallengeRatingValue(challengeRatingValue);
  const asNumber = Number(challengeRating);
  if (!Number.isFinite(asNumber)) {
    return challengeRating === "0" || challengeRating === "1/8" || challengeRating === "1/4" || challengeRating === "1/2" ? 2 : 2;
  }
  if (asNumber >= 29) return 9;
  if (asNumber >= 25) return 8;
  if (asNumber >= 21) return 7;
  if (asNumber >= 17) return 6;
  if (asNumber >= 13) return 5;
  if (asNumber >= 9) return 4;
  if (asNumber >= 5) return 3;
  return 2;
}

function parseExternalInitiative(
  value: unknown,
  dexterity: unknown,
  proficiencyBonusValue: unknown,
  challengeRatingValue: unknown
) {
  const dexModifier = Math.floor((clampNumber(dexterity, 1, 30, 10) - 10) / 2);

  if (typeof value === "number" && Number.isFinite(value)) {
    return clampNumber(value, -20, 50, dexModifier);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return parseSignedNumber(value);
  }

  if (typeof value === "object" && value !== null) {
    const object = value as { bonus?: unknown; proficiency?: unknown };
    if (object.bonus !== undefined) {
      return parseSignedNumber(object.bonus);
    }

    const proficiencyMultiplier =
      typeof object.proficiency === "number" && Number.isFinite(object.proficiency) ? object.proficiency : 0;
    const proficiencyBonus = parseMonsterProficiencyBonus(proficiencyBonusValue, challengeRatingValue);
    return clampNumber(dexModifier + proficiencyMultiplier * proficiencyBonus, -20, 50, dexModifier);
  }

  return dexModifier;
}

function formatMonsterTypeValue(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value !== "object" || value === null) {
    return "";
  }

  const object = value as { type?: unknown; tags?: unknown; swarmSize?: unknown };
  const baseType = readString(object.type);
  const tags = readStringArray(object.tags);
  const swarmSize = readString(object.swarmSize);
  const parts = [baseType];

  if (tags.length > 0) {
    parts.push(`(${tags.join(", ")})`);
  }

  if (swarmSize) {
    parts.push(`[swarm ${swarmSize}]`);
  }

  return parts.filter(Boolean).join(" ");
}

function parseExternalSenses(value: unknown): MonsterSense[] {
  return readStringArray(value).map((entry) => {
    const match = entry.match(/^([^0-9(]+?)\s+(\d+)\s*ft\.?(.*)$/i);
    if (!match) {
      return {
        name: entry,
        range: 0,
        notes: ""
      };
    }

    return {
      name: match[1].trim(),
      range: clampNumber(Number(match[2]), 0, 10000, 0),
      notes: match[3].trim().replace(/^\((.*)\)$/, "$1")
    };
  });
}

function normalizeExternalDescriptorArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return entry.trim();
      }

      if (typeof entry !== "object" || entry === null) {
        return "";
      }

      const object = entry as {
        special?: unknown;
        resist?: unknown;
        vulnerable?: unknown;
        immune?: unknown;
        note?: unknown;
        cond?: unknown;
      };

      const parts = [
        ...readStringArray(object.resist),
        ...readStringArray(object.vulnerable),
        ...readStringArray(object.immune),
        ...readStringArray(object.cond)
      ];
      const note = readString(object.note);
      const special = readString(object.special);
      const text = parts.join(", ");

      if (text && note) {
        return `${text} (${note})`;
      }

      return text || special || note;
    })
    .filter(Boolean);
}

function buildConditionImmunityLine(value: unknown) {
  const conditions = normalizeExternalDescriptorArray(value);
  return conditions.length > 0 ? `Condition Immunities: ${conditions.join(", ")}` : "";
}

function renderEntryNode(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value !== "object" || value === null) {
    return "";
  }

  const object = value as {
    type?: unknown;
    name?: unknown;
    entry?: unknown;
    entries?: unknown;
    items?: unknown;
  };

  if (object.type === "list") {
    return readArray(object.items)
      .map((item) => renderEntryNode(item))
      .filter(Boolean)
      .join("\n");
  }

  if (object.type === "item") {
    const name = readString(object.name);
    const body = renderEntryNode(object.entry) || joinEntries(object.entries);
    return [name ? `${name}.` : "", body].filter(Boolean).join(" ");
  }

  const name = readString(object.name);
  const body = renderEntryNode(object.entry) || joinEntries(object.entries);
  return [name, body].filter(Boolean).join("\n");
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function uniqueBy<T>(values: T[], getKey: (value: T) => string) {
  const seen = new Set<string>();
  const next: T[] = [];

  values.forEach((value) => {
    const key = getKey(value);

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    next.push(value);
  });

  return next;
}
