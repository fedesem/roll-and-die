import { z } from "zod";

import { isCompendiumRef } from "../../rules/compendiumRefs.js";

const abilitySchema = z.enum(["str", "dex", "con", "int", "wis", "cha"]);
const stringArray = z.array(z.string().min(1));

const grantsSchema = z
  .object({
    features: stringArray.optional(),
    skills: stringArray.optional(),
    expertise: stringArray.optional(),
    armorProficiencies: stringArray.optional(),
    weaponProficiencies: stringArray.optional(),
    toolProficiencies: stringArray.optional(),
    savingThrows: z.array(abilitySchema).optional(),
    languages: stringArray.optional(),
    abilities: z.partialRecord(abilitySchema, z.number().int()).optional(),
    weaponMasteriesCount: z.number().int().nonnegative().optional(),
    visionRange: z.number().nonnegative().optional(),
    cantripsCount: z.number().int().nonnegative().optional(),
    cantripOptions: stringArray.optional(),
    spellsCount: z.number().int().nonnegative().optional(),
    spellOptions: stringArray.optional(),
    spellList: z.string().min(1).optional(),
    alwaysPreparedSpells: stringArray.optional(),
    actions: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), source: z.string().min(1) }).passthrough()).optional(),
    passiveBonuses: z.array(z.object({ target: z.string().min(1) }).passthrough()).optional()
  })
  .strict();

const optionRequirementsSchema = z
  .object({
    level: z.number().int().positive().optional(),
    characterLevel: z.number().int().positive().optional(),
    subclassId: z.string().min(1).optional(),
    feature: z.string().min(1).optional(),
    notFeature: z.string().min(1).optional(),
    minAbility: z.partialRecord(abilitySchema, z.number().int()).optional(),
    knownSpell: z
      .object({
        spellListId: z.string().min(1).optional(),
        level: z.union([z.literal("cantrip"), z.number().int().min(1).max(9)]).optional(),
        dealsDamage: z.boolean().optional()
      })
      .strict()
      .optional()
  })
  .strict();

const optionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    referenceId: z.string().refine(isCompendiumRef, "referenceId must use Name|SOURCE syntax").optional(),
    requires: optionRequirementsSchema.optional(),
    grants: grantsSchema.optional()
  })
  .strict();

const choiceSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    referenceId: z.string().refine(isCompendiumRef, "referenceId must use Name|SOURCE syntax").optional(),
    source: z.enum(["class", "subclass", "species", "background", "feat"]),
    choose: z.number().int().positive(),
    cadence: z.enum(["onLevelUp", "onLongRest", "onShortRest", "permanent"]).optional(),
    optionSetId: z.string().min(1).optional(),
    optionSetIds: z.array(z.string().min(1)).min(1).optional(),
    options: z.array(optionSchema)
  })
  .strict()
  .superRefine((group, context) => {
    if (!group.optionSetId && !group.optionSetIds && group.options.length === 0)
      context.addIssue({ code: "custom", message: "choices require options or an option set" });
    if (!group.optionSetId && !group.optionSetIds && group.choose > group.options.length)
      context.addIssue({ code: "custom", message: "choose exceeds available options" });
    if (new Set(group.options.map((option) => option.id)).size !== group.options.length) {
      context.addIssue({ code: "custom", message: "choice option IDs must be unique" });
    }
  });

const levelSchema = z
  .object({
    features: stringArray.optional(),
    alwaysPreparedSpells: stringArray.optional(),
    choices: z.array(choiceSchema).optional(),
    spellcasting: z.object({}).passthrough().optional(),
    resources: z
      .array(
        z
          .object({ name: z.string().min(1), maxFormula: z.object({ type: z.string().min(1) }).passthrough(), resetOn: z.string().min(1) })
          .passthrough()
      )
      .optional(),
    actions: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), source: z.string().min(1) }).passthrough()).optional(),
    grants: grantsSchema.optional(),
    weaponMasteriesCount: z.number().int().nonnegative().optional(),
    expertiseChoices: z.number().int().nonnegative().optional(),
    subclassChoice: z.boolean().optional(),
    asiChoice: z.boolean().optional()
  })
  .strict();

const levelsSchema = z.record(z.string(), levelSchema).superRefine((levels, context) => {
  Object.keys(levels).forEach((level) => {
    const parsed = Number(level);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20)
      context.addIssue({ code: "custom", path: [level], message: "level must be an integer from 1 to 20" });
  });
});

const equipmentChoicesSchema = z.array(
  z
    .object({
      id: z.string().min(1),
      label: z.string().min(1),
      options: z
        .array(
          z
            .object({
              id: z.string().min(1),
              label: z.string().min(1),
              items: z.array(
                z
                  .object({
                    referenceId: z.string().refine(isCompendiumRef, "referenceId must use Name|SOURCE syntax").optional(),
                    name: z.string().min(1),
                    quantity: z.number().int().positive(),
                    currency: z
                      .object({
                        pp: z.number().optional(),
                        gp: z.number().optional(),
                        ep: z.number().optional(),
                        sp: z.number().optional(),
                        cp: z.number().optional()
                      })
                      .strict()
                      .optional()
                  })
                  .strict()
              )
            })
            .strict()
        )
        .min(1)
    })
    .strict()
);

export const classProgressionDataSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    source: z.string().min(1),
    hitDieFaces: z.number().int().positive(),
    primaryAbilities: z.array(abilitySchema),
    savingThrows: z.array(abilitySchema),
    armorProficiencies: stringArray,
    weaponProficiencies: stringArray,
    toolProficiencies: stringArray,
    startingSkillChoices: z.object({ choose: z.number().int().nonnegative(), options: stringArray }).optional(),
    equipmentChoices: equipmentChoicesSchema,
    spellListId: z.string().min(1).optional(),
    spellcastingRules: z
      .object({
        preparedSpellsProgression: z.array(z.number().int().nonnegative()).length(20),
        preparationSource: z.enum(["classList", "spellbook"]),
        changeCadence: z.enum(["onLongRest", "onLevelUp"]),
        replacementMode: z.enum(["all", "one"])
      })
      .strict()
      .optional(),
    multiclassing: z
      .object({
        prerequisites: z.partialRecord(abilitySchema, z.number().int()).default({}),
        prerequisiteMode: z.enum(["all", "any"]).optional(),
        proficienciesGranted: z.object({}).passthrough(),
        casterType: z.enum(["full", "half", "third", "pact", "none"])
      })
      .strict(),
    levels: levelsSchema,
    subclasses: z.array(z.unknown())
  })
  .strict();

export const subclassProgressionDataSchema = z
  .object({
    id: z.string().min(1),
    classId: z.string().min(1),
    className: z.string().min(1),
    name: z.string().min(1),
    source: z.string().min(1),
    levels: levelsSchema
  })
  .strict();

const namedEntityFields = { id: z.string().min(1), name: z.string().min(1), source: z.string().min(1) } as const;

export const speciesProgressionDataSchema = z
  .object({
    ...namedEntityFields,
    sizes: z.array(z.enum(["Medium", "Small", "Large", "Tiny"])).min(1),
    speed: z.number().nonnegative(),
    darkvision: z.number().nonnegative(),
    creatureTypes: stringArray.min(1),
    languages: stringArray,
    bonusLanguageCount: z.number().int().nonnegative(),
    skillProficiencies: stringArray.optional(),
    skillChoices: z
      .object({ choose: z.number().int().positive(), options: z.union([z.literal("all"), stringArray.min(1)]) })
      .strict()
      .optional(),
    features: stringArray,
    choices: z.array(choiceSchema).optional(),
    actions: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), source: z.string().min(1) }).passthrough()).optional()
  })
  .strict();

export const backgroundProgressionDataSchema = z
  .object({
    ...namedEntityFields,
    abilityScores: z.object({ recommended: z.array(abilitySchema).min(1), options: z.array(abilitySchema).min(1) }).strict(),
    originFeatId: z.string().min(1),
    originFeatName: z.string().min(1),
    skillProficiencies: stringArray,
    toolProficiencies: stringArray,
    equipmentChoices: equipmentChoicesSchema
  })
  .strict();

export const featProgressionDataSchema = z
  .object({
    ...namedEntityFields,
    compendiumRef: z.string().refine(isCompendiumRef, "compendiumRef must use Name|SOURCE syntax").optional(),
    category: z.enum(["origin", "general", "fightingStyle", "epicBoon"]),
    prerequisites: z
      .object({
        minLevel: z.number().int().positive().optional(),
        abilities: z.partialRecord(abilitySchema, z.number().int()).optional(),
        armorProficiencies: stringArray.optional(),
        weaponProficiencies: stringArray.optional(),
        spellcasting: z.boolean().optional()
      })
      .strict()
      .optional(),
    abilityIncrease: z
      .object({ choose: z.number().int().positive(), options: z.array(abilitySchema).min(1), amount: z.number().int().positive() })
      .strict()
      .optional(),
    features: stringArray.optional(),
    actions: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), source: z.string().min(1) }).passthrough()).optional(),
    grants: grantsSchema.optional(),
    choices: z.array(choiceSchema).optional()
  })
  .strict();

const namedEntitySchema = z.object(namedEntityFields).passthrough();

export interface ProgressionCatalogInput {
  classes: unknown[];
  subclasses: unknown[];
  species: unknown[];
  backgrounds: unknown[];
  feats: unknown[];
  choiceDomains?: unknown[];
  manifest?: Array<{ kind: string; ref: string }>;
}

export function validateProgressionCatalog(input: ProgressionCatalogInput): string[] {
  const errors: string[] = [];
  const validate = (kind: string, entries: unknown[], schema: z.ZodType) => {
    const ids = new Set<string>();
    entries.forEach((entry, index) => {
      const result = schema.safeParse(entry);
      if (!result.success) {
        result.error.issues.forEach((issue) =>
          errors.push(`${kind}[${index}]${issue.path.length ? `.${issue.path.join(".")}` : ""}: ${issue.message}`)
        );
        return;
      }
      const id = (result.data as { id: string }).id;
      if (ids.has(id)) errors.push(`${kind}: duplicate id ${id}`);
      ids.add(id);
    });
  };
  validate("classes", input.classes, classProgressionDataSchema);
  validate("subclasses", input.subclasses, subclassProgressionDataSchema);
  validate("species", input.species, speciesProgressionDataSchema);
  validate("backgrounds", input.backgrounds, backgroundProgressionDataSchema);
  validate("feats", input.feats, featProgressionDataSchema);
  if (input.choiceDomains) {
    validate("choiceDomains", input.choiceDomains, z.object({ id: z.string().min(1), options: z.array(optionSchema).min(1) }).strict());
  }
  const domainIds = new Set(
    (input.choiceDomains ?? [])
      .map((entry) => z.object({ id: z.string() }).passthrough().safeParse(entry))
      .filter((result) => result.success)
      .map((result) => result.data.id)
  );
  const validateChoiceDomains = (owner: string, groups: unknown) => {
    if (!Array.isArray(groups)) return;
    groups.forEach((rawGroup, index) => {
      const parsed = choiceSchema.safeParse(rawGroup);
      if (!parsed.success) return;
      const referencedDomains = parsed.data.optionSetIds ?? (parsed.data.optionSetId ? [parsed.data.optionSetId] : []);
      referencedDomains.forEach((domainId) => {
        if (!domainIds.has(domainId)) errors.push(`${owner}.choices[${index}]: unknown optionSet ${domainId}`);
      });
    });
  };
  input.classes.forEach((rawClass, classIndex) => {
    const parsed = classProgressionDataSchema.safeParse(rawClass);
    if (!parsed.success) return;
    for (let level = 1; level <= 20; level += 1) {
      if (!parsed.data.levels[String(level)]) errors.push(`classes[${classIndex}]: missing level ${level}`);
    }
    if (parsed.data.source !== "XPHB") errors.push(`classes[${classIndex}]: 2024 base classes must use source XPHB`);
    if (parsed.data.multiclassing.casterType !== "none" && !parsed.data.spellcastingRules) {
      errors.push(`classes[${classIndex}]: spellcasting base classes require fixed 2024 spellcastingRules`);
    }
    Object.entries(parsed.data.levels).forEach(([level, config]) => {
      const spellcasting = config.spellcasting as Record<string, unknown> | undefined;
      if (
        spellcasting &&
        ("preparedSpellsFormula" in spellcasting || "spellsKnown" in spellcasting || "useSpellsFormula" in spellcasting)
      ) {
        errors.push(`classes[${classIndex}].levels.${level}: legacy prepared-spell fields are not allowed`);
      }
    });
    Object.entries(parsed.data.levels).forEach(([level, config]) =>
      validateChoiceDomains(`classes[${classIndex}].levels.${level}`, config.choices)
    );
  });
  input.subclasses.forEach((rawSubclass, subclassIndex) => {
    const parsed = subclassProgressionDataSchema.safeParse(rawSubclass);
    if (!parsed.success) return;
    const hasClass = input.classes.some((rawClass) => {
      const actorClass = classProgressionDataSchema.safeParse(rawClass);
      return actorClass.success && (actorClass.data.id === parsed.data.classId || actorClass.data.name === parsed.data.className);
    });
    if (!hasClass) errors.push(`subclasses[${subclassIndex}]: unknown class ${parsed.data.classId}`);
    Object.entries(parsed.data.levels).forEach(([level, config]) =>
      validateChoiceDomains(`subclasses[${subclassIndex}].levels.${level}`, config.choices)
    );
  });
  input.species.forEach((rawSpecies, speciesIndex) => {
    const parsed = speciesProgressionDataSchema.safeParse(rawSpecies);
    if (parsed.success) validateChoiceDomains(`species[${speciesIndex}]`, parsed.data.choices);
  });
  input.feats.forEach((rawFeat, featIndex) => {
    const parsed = featProgressionDataSchema.safeParse(rawFeat);
    if (parsed.success) validateChoiceDomains(`feats[${featIndex}]`, parsed.data.choices);
  });
  const featIdentities = new Set<string>();
  input.feats.forEach((rawFeat) => {
    const parsed = featProgressionDataSchema.safeParse(rawFeat);
    if (!parsed.success) return;
    featIdentities.add(parsed.data.id);
    featIdentities.add(parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, ""));
  });
  input.backgrounds.forEach((rawBackground, backgroundIndex) => {
    const parsed = backgroundProgressionDataSchema.safeParse(rawBackground);
    if (!parsed.success) return;
    if (
      !featIdentities.has(parsed.data.originFeatId) &&
      !featIdentities.has(parsed.data.originFeatName.toLowerCase().replace(/[^a-z0-9]+/g, ""))
    ) {
      errors.push(`backgrounds[${backgroundIndex}]: unknown origin feat ${parsed.data.originFeatId}`);
    }
  });
  if (input.manifest) {
    const manifestRefs = new Set<string>();
    input.manifest.forEach((entry, index) => {
      if (!entry.kind || !isCompendiumRef(entry.ref)) errors.push(`manifest[${index}]: invalid kind or reference`);
      if (manifestRefs.has(entry.ref)) errors.push(`manifest: duplicate reference ${entry.ref}`);
      manifestRefs.add(entry.ref);
    });
    const expectedEntries = [...input.classes, ...input.subclasses, ...input.species, ...input.backgrounds];
    expectedEntries.forEach((entry) => {
      const parsed = namedEntitySchema.safeParse(entry);
      if (parsed.success && !manifestRefs.has(`${parsed.data.name}|${parsed.data.source}`)) {
        errors.push(`manifest: missing ${parsed.data.name}|${parsed.data.source}`);
      }
    });
    input.feats.forEach((entry) => {
      const parsed = featProgressionDataSchema.safeParse(entry);
      if (!parsed.success) return;
      const reference = parsed.data.compendiumRef ?? `${parsed.data.name}|${parsed.data.source}`;
      if (!manifestRefs.has(reference)) errors.push(`manifest: missing ${reference}`);
    });
  }
  return errors;
}
