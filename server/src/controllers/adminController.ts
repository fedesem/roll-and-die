import type { Request, Response } from "express";

import {
  compendiumKindSchema,
  createClassBodySchema,
  createFeatBodySchema,
  createMonsterBodySchema,
  createSpellBodySchema,
  importClassesBodySchema,
  importFeatsBodySchema,
  importMonstersBodySchema,
  importSpellsBodySchema
} from "../../../shared/contracts/admin.js";
import { HttpError } from "../http/errors.js";
import { parseWithSchema, requireRouteParam } from "../http/validation.js";
import { mutateDatabase, readDatabase } from "../store.js";
import { requireAdmin, toUserProfile } from "../services/authService.js";
import { sanitizeCompendiumEntry, type CompendiumKind } from "../services/compendiumService.js";

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
  }
}

export const adminController = {
  async overview(request: Request, response: Response) {
    requireAdmin(request);
    const database = await readDatabase();

    response.json({
      users: database.users.map((user) => toUserProfile(user)),
      compendium: database.compendium
    });
  },

  async promoteUser(request: Request, response: Response) {
    const admin = requireAdmin(request);
    const targetUserId = requireRouteParam(request.params.userId, "userId");

    const promoted = await mutateDatabase((database) => {
      const actor = database.users.find((entry) => entry.id === targetUserId);

      if (!actor) {
        throw new HttpError(404, "User not found.");
      }

      actor.isAdmin = true;
      return toUserProfile(actor);
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

    const demoted = await mutateDatabase((database) => {
      const target = database.users.find((entry) => entry.id === targetUserId);

      if (!target) {
        throw new HttpError(404, "User not found.");
      }

      target.isAdmin = false;
      return toUserProfile(target);
    });

    response.json({
      user: demoted,
      demotedBy: admin.id
    });
  },

  async createCompendiumEntry(request: Request, response: Response) {
    requireAdmin(request);
    const kind = parseWithSchema(compendiumKindSchema, request.params.kind, "Invalid compendium type.");
    const entry = sanitizeCompendiumEntry(kind, parseCompendiumCreateBody(kind, request.body));

    const created = await mutateDatabase((database) => {
      const collection = database.compendium[kind] as typeof database.compendium[typeof kind];

      if (collection.some((current) => current.id === entry.id)) {
        throw new HttpError(409, "An entry with that id already exists.");
      }

      collection.unshift(entry as never);
      return entry;
    });

    response.status(201).json(created);
  },

  async importCompendiumEntries(request: Request, response: Response) {
    requireAdmin(request);
    const kind = parseWithSchema(compendiumKindSchema, request.params.kind, "Invalid compendium type.");
    const body = parseCompendiumImportBody(kind, request.body);
    const entries = (Array.isArray(body.entries) ? body.entries : [body.entries]).map((entry) =>
      sanitizeCompendiumEntry(kind, entry)
    );

    const result = await mutateDatabase((database) => {
      const collection = database.compendium[kind] as typeof database.compendium[typeof kind];
      const existingIds = new Set(collection.map((entry) => entry.id));
      const next = entries.filter((entry) => !existingIds.has(entry.id));

      collection.unshift(...(next as never[]));
      return {
        imported: next.length,
        skipped: entries.length - next.length
      };
    });

    response.status(201).json(result);
  },
};
