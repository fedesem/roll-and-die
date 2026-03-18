import { z } from "zod";

import {
  adminOverviewSchema,
  classEntrySchema,
  featEntrySchema,
  monsterTemplateSchema,
  spellEntrySchema,
  userProfileSchema
} from "./domain.js";

export const compendiumKindSchema = z.enum(["spells", "monsters", "feats", "classes"]);

export const adminOverviewResponseSchema = adminOverviewSchema;

export const adminUserMutationResponseSchema = z.object({
  user: userProfileSchema,
  promotedBy: z.string().trim().min(1).optional(),
  demotedBy: z.string().trim().min(1).optional()
});

export const createSpellBodySchema = spellEntrySchema;
export const createMonsterBodySchema = monsterTemplateSchema;
export const createFeatBodySchema = featEntrySchema;
export const createClassBodySchema = classEntrySchema;

export const createdCompendiumEntryResponseSchema = z.object({
  id: z.string().trim().min(1)
});

export const importCompendiumResultResponseSchema = z.object({
  imported: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative()
});

export const importSpellsBodySchema = z.object({
  entries: z.union([spellEntrySchema, z.array(spellEntrySchema)])
});
export const importMonstersBodySchema = z.object({
  entries: z.union([monsterTemplateSchema, z.array(monsterTemplateSchema)])
});
export const importFeatsBodySchema = z.object({
  entries: z.union([featEntrySchema, z.array(featEntrySchema)])
});
export const importClassesBodySchema = z.object({
  entries: z.union([classEntrySchema, z.array(classEntrySchema)])
});
