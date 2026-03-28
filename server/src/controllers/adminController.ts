import type { DatabaseSync } from "../store/types.js";
import type { Request, Response } from "express";
import type { MonsterTemplate } from "../../../shared/types.js";
import {
  compendiumKindSchema,
  createClassBodySchema,
  createActionBodySchema,
  createBackgroundBodySchema,
  createBookBodySchema,
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
  importActionsBodySchema,
  importBackgroundsBodySchema,
  importBooksBodySchema,
  importConditionsBodySchema,
  importClassesBodySchema,
  importFeatsBodySchema,
  importItemsBodySchema,
  importLanguagesBodySchema,
  importMonstersBodySchema,
  importOptionalFeaturesBodySchema,
  importRacesBodySchema,
  importSkillsBodySchema,
  importSpellsBodySchema,
  importVariantRulesBodySchema
} from "../../../shared/contracts/admin.js";
import { HttpError } from "../http/errors.js";
import { parseWithSchema, requireRouteParam } from "../http/validation.js";
import { runStoreQuery, runStoreTransaction } from "../store.js";
import { requireAdmin, toUserProfile } from "../services/authService.js";
import { importMonsterTokenArchive, prepareMonsterTemplateForStorage } from "../services/compendiumAssetService.js";
import { invalidateRoomCompendiumCache } from "../services/roomCompendiumCache.js";
import {
  importGeneratedSpellLookupIntoSpells,
  importGeneratedSubclassLookupIntoClasses,
  isGeneratedSubclassLookupImport,
  isGeneratedSpellLookupImport,
  normalizeCompendiumImportEntries,
  sanitizeCompendiumEntry,
  type CompendiumKind
} from "../services/compendiumService.js";
import {
  deleteActorRecord,
  deleteCampaignChatMessagesByUser,
  deleteCampaignExplorationForUser,
  deleteCampaignInvitesByCreator,
  deleteCampaignMemberRecord,
  deleteCampaignRecord,
  listCampaignIdsForMember,
  readCampaignCoreById,
  readCampaignMembers,
  readOwnedActorIdsForCampaignUser,
  updateCampaignCreatedBy,
  updateCampaignMemberRole
} from "../store/models/campaigns.js";
import {
  clearCompendiumCollection,
  compendiumEntryExists,
  deleteCompendiumEntryRecord,
  insertCompendiumEntryAtStart,
  insertCompendiumEntriesAtStart,
  readCompendiumCollection,
  upsertCompendiumEntry
} from "../store/models/compendium.js";
import { deleteUser, deleteUserSessions, listUsers, readUserById, setUserAdminFlag } from "../store/models/users.js";
function parseCompendiumCreateBody(kind: CompendiumKind, value: unknown) {
  switch (kind) {
    case "spells":
      return parseWithSchema(createSpellBodySchema, value);
    case "monsters":
      return parseWithSchema(createMonsterBodySchema, value);
    case "feats":
      return parseWithSchema(createFeatBodySchema, value);
    case "classes":
      return parseWithSchema(createClassBodySchema, value);
    case "books":
      return parseWithSchema(createBookBodySchema, value);
    case "variantRules":
      return parseWithSchema(createVariantRuleBodySchema, value);
    case "conditions":
      return parseWithSchema(createConditionBodySchema, value);
    case "optionalFeatures":
      return parseWithSchema(createOptionalFeatureBodySchema, value);
    case "actions":
      return parseWithSchema(createActionBodySchema, value);
    case "backgrounds":
      return parseWithSchema(createBackgroundBodySchema, value);
    case "items":
      return parseWithSchema(createItemBodySchema, value);
    case "languages":
      return parseWithSchema(createLanguageBodySchema, value);
    case "races":
      return parseWithSchema(createRaceBodySchema, value);
    case "skills":
      return parseWithSchema(createSkillBodySchema, value);
  }
}
function parseCompendiumImportBody(kind: CompendiumKind, value: unknown) {
  switch (kind) {
    case "spells":
      return parseWithSchema(importSpellsBodySchema, value);
    case "monsters":
      return parseWithSchema(importMonstersBodySchema, value);
    case "feats":
      return parseWithSchema(importFeatsBodySchema, value);
    case "classes":
      return parseWithSchema(importClassesBodySchema, value);
    case "books":
      return parseWithSchema(importBooksBodySchema, value);
    case "variantRules":
      return parseWithSchema(importVariantRulesBodySchema, value);
    case "conditions":
      return parseWithSchema(importConditionsBodySchema, value);
    case "optionalFeatures":
      return parseWithSchema(importOptionalFeaturesBodySchema, value);
    case "actions":
      return parseWithSchema(importActionsBodySchema, value);
    case "backgrounds":
      return parseWithSchema(importBackgroundsBodySchema, value);
    case "items":
      return parseWithSchema(importItemsBodySchema, value);
    case "languages":
      return parseWithSchema(importLanguagesBodySchema, value);
    case "races":
      return parseWithSchema(importRacesBodySchema, value);
    case "skills":
      return parseWithSchema(importSkillsBodySchema, value);
  }
}
async function readAdminCompendium(database: DatabaseSync) {
  return {
    spells: await readCompendiumCollection(database, "spells"),
    monsters: await readCompendiumCollection(database, "monsters"),
    feats: await readCompendiumCollection(database, "feats"),
    classes: await readCompendiumCollection(database, "classes"),
    books: await readCompendiumCollection(database, "books"),
    variantRules: await readCompendiumCollection(database, "variantRules"),
    conditions: await readCompendiumCollection(database, "conditions"),
    optionalFeatures: await readCompendiumCollection(database, "optionalFeatures"),
    actions: await readCompendiumCollection(database, "actions"),
    backgrounds: await readCompendiumCollection(database, "backgrounds"),
    items: await readCompendiumCollection(database, "items"),
    languages: await readCompendiumCollection(database, "languages"),
    races: await readCompendiumCollection(database, "races"),
    skills: await readCompendiumCollection(database, "skills")
  };
}
export const adminController = {
  async overview(request: Request, response: Response) {
    requireAdmin(request);
    const { users, compendium } = await runStoreQuery(async (database) => ({
      users: await listUsers(database),
      compendium: await readAdminCompendium(database)
    }));
    response.json({
      users: users.map((user) => toUserProfile(user)),
      compendium
    });
  },
  async promoteUser(request: Request, response: Response) {
    const admin = requireAdmin(request);
    const targetUserId = requireRouteParam(request.params.userId, "userId");
    const promoted = await runStoreTransaction(async (database) => {
      const user = await readUserById(database, targetUserId);
      if (!user) {
        throw new HttpError(404, "User not found.");
      }
      await setUserAdminFlag(database, targetUserId, true);
      return toUserProfile({
        ...user,
        isAdmin: true
      });
    });
    response.json({
      user: promoted,
      promotedBy: admin.id
    });
  },
  async demoteUser(request: Request, response: Response) {
    const admin = requireAdmin(request);
    const targetUserId = requireRouteParam(request.params.userId, "userId");
    if (targetUserId === admin.id) {
      throw new HttpError(400, "You cannot demote yourself.");
    }
    const demoted = await runStoreTransaction(async (database) => {
      const user = await readUserById(database, targetUserId);
      if (!user) {
        throw new HttpError(404, "User not found.");
      }
      await setUserAdminFlag(database, targetUserId, false);
      return toUserProfile({
        ...user,
        isAdmin: false
      });
    });
    response.json({
      user: demoted,
      demotedBy: admin.id
    });
  },
  async deleteUser(request: Request, response: Response) {
    const admin = requireAdmin(request);
    const targetUserId = requireRouteParam(request.params.userId, "userId");
    if (targetUserId === admin.id) {
      throw new HttpError(400, "You cannot delete yourself.");
    }
    await runStoreTransaction(async (database) => {
      const targetUser = await readUserById(database, targetUserId);
      if (!targetUser) {
        throw new HttpError(404, "User not found.");
      }
      const campaignIds = await listCampaignIdsForMember(database, targetUserId);
      for (const campaignId of campaignIds) {
        const campaign = await readCampaignCoreById(database, campaignId);
        if (!campaign) {
          continue;
        }
        const remainingMembers = (await readCampaignMembers(database, campaignId)).filter((member) => member.userId !== targetUserId);
        deleteCampaignInvitesByCreator(database, campaignId, targetUserId);
        deleteCampaignChatMessagesByUser(database, campaignId, targetUserId);
        deleteCampaignExplorationForUser(database, campaignId, targetUserId);
        for (const actorId of await readOwnedActorIdsForCampaignUser(database, campaignId, targetUserId)) {
          deleteActorRecord(database, actorId);
        }
        deleteCampaignMemberRecord(database, campaignId, targetUserId);
        if (remainingMembers.length === 0) {
          deleteCampaignRecord(database, campaignId);
          continue;
        }
        const existingDm = remainingMembers.find((member) => member.role === "dm");
        const nextDm = existingDm ?? remainingMembers[0];
        if (!existingDm && nextDm) {
          updateCampaignMemberRole(database, campaignId, nextDm.userId, "dm");
        }
        if (campaign.createdBy === targetUserId && nextDm) {
          updateCampaignCreatedBy(database, campaignId, nextDm.userId);
        }
      }
      await deleteUserSessions(database, targetUserId);
      await deleteUser(database, targetUserId);
    });
    response.status(204).send();
  },
  async createCompendiumEntry(request: Request, response: Response) {
    requireAdmin(request);
    const kind = parseWithSchema(compendiumKindSchema, request.params.kind, "Invalid compendium type.");
    const rawEntry = sanitizeCompendiumEntry(kind, parseCompendiumCreateBody(kind, request.body));
    const entry = kind === "monsters" ? await prepareMonsterTemplateForStorage(rawEntry as MonsterTemplate) : rawEntry;
    const entryKey = "id" in entry ? entry.id : entry.source;
    const created = await runStoreTransaction(async (database) => {
      if (await compendiumEntryExists(database, kind, entryKey)) {
        throw new HttpError(409, "An entry with that id already exists.");
      }
      await insertCompendiumEntryAtStart(database, kind, entry);
      return entry;
    });
    invalidateRoomCompendiumCache();
    response.status(201).json(created);
  },
  async importCompendiumEntries(request: Request, response: Response) {
    requireAdmin(request);
    const kind = parseWithSchema(compendiumKindSchema, request.params.kind, "Invalid compendium type.");
    const body = parseCompendiumImportBody(kind, request.body);
    if (kind === "spells" && isGeneratedSpellLookupImport(body.entries)) {
      const result = await runStoreTransaction(async (database) => {
        const spells = await readCompendiumCollection(database, "spells");
        const previousById = new Map(spells.map((entry) => [entry.id, JSON.stringify(entry)]));
        const result = importGeneratedSpellLookupIntoSpells(spells, body.entries);
        for (const spell of spells) {
          if (previousById.get(spell.id) !== JSON.stringify(spell)) {
            await upsertCompendiumEntry(database, "spells", spell);
          }
        }
        return result;
      });
      invalidateRoomCompendiumCache();
      response.status(201).json(result);
      return;
    }
    if (kind === "classes" && isGeneratedSubclassLookupImport(body.entries)) {
      const result = await runStoreTransaction(async (database) => {
        const classes = await readCompendiumCollection(database, "classes");
        const previousById = new Map(classes.map((entry) => [entry.id, JSON.stringify(entry)]));
        const result = importGeneratedSubclassLookupIntoClasses(classes, body.entries);
        for (const entry of classes) {
          if (previousById.get(entry.id) !== JSON.stringify(entry)) {
            await upsertCompendiumEntry(database, "classes", entry);
          }
        }
        return result;
      });
      invalidateRoomCompendiumCache();
      response.status(201).json(result);
      return;
    }
    const rawEntries = normalizeCompendiumImportEntries(kind, body.entries).map((entry) => sanitizeCompendiumEntry(kind, entry));
    const entries =
      kind === "monsters"
        ? await Promise.all(rawEntries.map((entry) => prepareMonsterTemplateForStorage(entry as MonsterTemplate)))
        : rawEntries;
    const result = await runStoreTransaction(async (database) => {
      const collection = await readCompendiumCollection(database, kind);
      const existingIds = new Set(collection.map((entry) => ("id" in entry ? entry.id : entry.source)));
      const insertedIds = new Set<string>();
      const next = entries.filter((entry) => !existingIds.has("id" in entry ? entry.id : entry.source));
      const uniqueNext = next.filter((entry) => {
        const entryKey = "id" in entry ? entry.id : entry.source;
        if (insertedIds.has(entryKey)) {
          return false;
        }
        insertedIds.add(entryKey);
        return true;
      });
      await insertCompendiumEntriesAtStart(database, kind, uniqueNext as typeof collection);
      return {
        imported: uniqueNext.length,
        skipped: entries.length - uniqueNext.length
      };
    });
    invalidateRoomCompendiumCache();
    response.status(201).json(result);
  },
  async importMonsterTokenArchive(request: Request, response: Response) {
    requireAdmin(request);
    if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
      throw new HttpError(400, "Upload a zip archive containing monster token images.");
    }
    const filenameHeader = request.header("X-Upload-Filename");
    const filename = filenameHeader ? decodeUploadFilename(filenameHeader) : "monster-token-images.zip";
    const result = await importMonsterTokenArchive(request.body);
    request.log.info(
      {
        event: "admin.monster_token_archive.imported",
        filename,
        processedFiles: result.processedFiles,
        matchedFiles: result.matchedFiles,
        updatedMonsters: result.updatedMonsters,
        ignoredEntries: result.ignoredEntries,
        unmatchedFiles: result.unmatchedFiles.length
      },
      "monster token archive imported"
    );
    invalidateRoomCompendiumCache();
    response.status(201).json(result);
  },
  async deleteCompendiumEntry(request: Request, response: Response) {
    requireAdmin(request);
    const kind = parseWithSchema(compendiumKindSchema, request.params.kind, "Invalid compendium type.");
    const itemId = requireRouteParam(request.params.itemId, "itemId");
    await runStoreTransaction(async (database) => {
      if (!(await compendiumEntryExists(database, kind, itemId))) {
        throw new HttpError(404, "Compendium entry not found.");
      }
      deleteCompendiumEntryRecord(database, kind, itemId);
    });
    invalidateRoomCompendiumCache();
    response.status(204).send();
  },
  async clearCompendiumEntries(request: Request, response: Response) {
    requireAdmin(request);
    const kind = parseWithSchema(compendiumKindSchema, request.params.kind, "Invalid compendium type.");
    await runStoreTransaction((database) => {
      clearCompendiumCollection(database, kind);
    });
    invalidateRoomCompendiumCache();
    response.status(204).send();
  }
};
function decodeUploadFilename(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
