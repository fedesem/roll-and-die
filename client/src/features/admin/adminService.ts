import type { AdminOverview, CompendiumData } from "@shared/types";
import {
  adminOverviewResponseSchema,
  adminUserMutationResponseSchema,
  compendiumKindSchema,
  createActionBodySchema,
  createBackgroundBodySchema,
  createBookBodySchema,
  createClassBodySchema,
  createConditionBodySchema,
  createFeatBodySchema,
  createItemBodySchema,
  createLanguageBodySchema,
  createMonsterBodySchema,
  createOptionalFeatureBodySchema,
  createRaceBodySchema,
  createSkillBodySchema,
  createSpellBodySchema,
  createVariantRuleBodySchema,
  createdCompendiumEntryResponseSchema,
  emptyAdminResponseSchema,
  importActionsBodySchema,
  importBackgroundsBodySchema,
  importBooksBodySchema,
  importClassesBodySchema,
  importConditionsBodySchema,
  importCompendiumResultResponseSchema,
  importFeatsBodySchema,
  importItemsBodySchema,
  importLanguagesBodySchema,
  importMonstersBodySchema,
  importMonsterTokenArchiveResponseSchema,
  importOptionalFeaturesBodySchema,
  importRacesBodySchema,
  importSkillsBodySchema,
  importSpellsBodySchema,
  importVariantRulesBodySchema
} from "@shared/contracts/admin";

import { apiRequest } from "../../api";

type CompendiumTab = keyof CompendiumData;

const createBodySchemaByKind = {
  spells: createSpellBodySchema,
  monsters: createMonsterBodySchema,
  feats: createFeatBodySchema,
  classes: createClassBodySchema,
  books: createBookBodySchema,
  variantRules: createVariantRuleBodySchema,
  conditions: createConditionBodySchema,
  optionalFeatures: createOptionalFeatureBodySchema,
  actions: createActionBodySchema,
  backgrounds: createBackgroundBodySchema,
  items: createItemBodySchema,
  languages: createLanguageBodySchema,
  races: createRaceBodySchema,
  skills: createSkillBodySchema
} as const;

const importBodySchemaByKind = {
  spells: importSpellsBodySchema,
  monsters: importMonstersBodySchema,
  feats: importFeatsBodySchema,
  classes: importClassesBodySchema,
  books: importBooksBodySchema,
  variantRules: importVariantRulesBodySchema,
  conditions: importConditionsBodySchema,
  optionalFeatures: importOptionalFeaturesBodySchema,
  actions: importActionsBodySchema,
  backgrounds: importBackgroundsBodySchema,
  items: importItemsBodySchema,
  languages: importLanguagesBodySchema,
  races: importRacesBodySchema,
  skills: importSkillsBodySchema
} as const;

export function fetchAdminOverview(token: string) {
  return apiRequest<AdminOverview>("/admin/overview", {
    token,
    responseSchema: adminOverviewResponseSchema
  });
}

export function promoteAdminUser(token: string, userId: string) {
  return apiRequest(`/admin/users/${userId}/promote`, {
    method: "POST",
    token,
    responseSchema: adminUserMutationResponseSchema
  });
}

export function demoteAdminUser(token: string, userId: string) {
  return apiRequest(`/admin/users/${userId}/demote`, {
    method: "POST",
    token,
    responseSchema: adminUserMutationResponseSchema
  });
}

export function deleteAdminUser(token: string, userId: string) {
  return apiRequest(`/admin/users/${userId}`, {
    method: "DELETE",
    token,
    responseSchema: emptyAdminResponseSchema
  });
}

export function createCompendiumItem(token: string, kind: CompendiumTab, entry: unknown) {
  compendiumKindSchema.parse(kind);
  return apiRequest<{ id: string }>(`/admin/compendium/${kind}`, {
    method: "POST",
    token,
    body: entry,
    bodySchema: createBodySchemaByKind[kind],
    responseSchema: createdCompendiumEntryResponseSchema
  });
}

export function importCompendiumItems(token: string, kind: CompendiumTab, entries: unknown) {
  compendiumKindSchema.parse(kind);
  return apiRequest(`/admin/compendium/${kind}/import`, {
    method: "POST",
    token,
    body: { entries },
    bodySchema: importBodySchemaByKind[kind],
    responseSchema: importCompendiumResultResponseSchema
  });
}

export function importMonsterTokenArchive(token: string, archive: File) {
  return apiRequest(`/admin/compendium/monsters/token-images/import`, {
    method: "POST",
    token,
    body: archive,
    contentType: "application/zip",
    headers: {
      "X-Upload-Filename": encodeURIComponent(archive.name)
    },
    responseSchema: importMonsterTokenArchiveResponseSchema
  });
}

export function deleteCompendiumItem(token: string, kind: CompendiumTab, itemId: string) {
  compendiumKindSchema.parse(kind);
  return apiRequest(`/admin/compendium/${kind}/${itemId}`, {
    method: "DELETE",
    token,
    responseSchema: emptyAdminResponseSchema
  });
}

export function clearCompendiumItems(token: string, kind: CompendiumTab) {
  compendiumKindSchema.parse(kind);
  return apiRequest(`/admin/compendium/${kind}`, {
    method: "DELETE",
    token,
    responseSchema: emptyAdminResponseSchema
  });
}
