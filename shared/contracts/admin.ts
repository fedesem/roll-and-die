import { z } from "zod";

import {
  adminOverviewSchema,
  userProfileSchema
} from "./domain.js";

export const compendiumKindSchema = z.enum(["spells", "monsters", "feats", "classes"]);

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

export const createdCompendiumEntryResponseSchema = z.object({
  id: z.string().trim().min(1)
});

export const emptyAdminResponseSchema = z.null();

export const importCompendiumResultResponseSchema = z.object({
  imported: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative()
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
