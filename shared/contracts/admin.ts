import { z } from "zod";

import { adminOverviewSchema, userProfileSchema } from "./domain.js";

export const compendiumKindSchema = z.enum([
  "spells",
  "monsters",
  "feats",
  "classes",
  "books",
  "variantRules",
  "conditions",
  "optionalFeatures",
  "actions",
  "backgrounds",
  "items",
  "languages",
  "races",
  "skills"
]);

export const adminOverviewResponseSchema = adminOverviewSchema;

export const adminUserMutationResponseSchema = z.object({
  user: userProfileSchema,
  promotedBy: z.string().trim().min(1).optional(),
  demotedBy: z.string().trim().min(1).optional()
});

export const createSpellBodySchema = z.unknown();
export const createMonsterBodySchema = z.unknown();
export const createFeatBodySchema = z.unknown();
export const createClassBodySchema = z.unknown();
export const createBookBodySchema = z.unknown();
export const createVariantRuleBodySchema = z.unknown();
export const createConditionBodySchema = z.unknown();
export const createOptionalFeatureBodySchema = z.unknown();
export const createActionBodySchema = z.unknown();
export const createBackgroundBodySchema = z.unknown();
export const createItemBodySchema = z.unknown();
export const createLanguageBodySchema = z.unknown();
export const createRaceBodySchema = z.unknown();
export const createSkillBodySchema = z.unknown();

export const createdCompendiumEntryResponseSchema = z.object({
  id: z.string().trim().min(1)
});

export const emptyAdminResponseSchema = z.null();

export const importCompendiumResultResponseSchema = z.object({
  imported: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative()
});

export const importMonsterTokenArchiveResponseSchema = z.object({
  processedFiles: z.number().int().nonnegative(),
  matchedFiles: z.number().int().nonnegative(),
  updatedMonsters: z.number().int().nonnegative(),
  ignoredEntries: z.number().int().nonnegative(),
  unmatchedFiles: z.array(z.string())
});

export const importSpellsBodySchema = z.object({
  entries: z.union([z.unknown(), z.array(z.unknown())])
});
export const importMonstersBodySchema = z.object({
  entries: z.union([z.unknown(), z.array(z.unknown())])
});
export const importFeatsBodySchema = z.object({
  entries: z.union([z.unknown(), z.array(z.unknown())])
});
export const importClassesBodySchema = z.object({
  entries: z.union([z.unknown(), z.array(z.unknown())])
});
export const importBooksBodySchema = z.object({
  entries: z.union([z.unknown(), z.array(z.unknown())])
});
export const importVariantRulesBodySchema = z.object({
  entries: z.union([z.unknown(), z.array(z.unknown())])
});
export const importConditionsBodySchema = z.object({
  entries: z.union([z.unknown(), z.array(z.unknown())])
});
export const importOptionalFeaturesBodySchema = z.object({
  entries: z.union([z.unknown(), z.array(z.unknown())])
});
export const importActionsBodySchema = z.object({
  entries: z.union([z.unknown(), z.array(z.unknown())])
});
export const importBackgroundsBodySchema = z.object({
  entries: z.union([z.unknown(), z.array(z.unknown())])
});
export const importItemsBodySchema = z.object({
  entries: z.union([z.unknown(), z.array(z.unknown())])
});
export const importLanguagesBodySchema = z.object({
  entries: z.union([z.unknown(), z.array(z.unknown())])
});
export const importRacesBodySchema = z.object({
  entries: z.union([z.unknown(), z.array(z.unknown())])
});
export const importSkillsBodySchema = z.object({
  entries: z.union([z.unknown(), z.array(z.unknown())])
});
