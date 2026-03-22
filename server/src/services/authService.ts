import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import type { UserProfile } from "../../../shared/types.js";
import { runStoreQuery, type StoredUser } from "../store.js";
import { HttpError } from "../http/errors.js";
import { readSession, readUserById } from "../store/models/users.js";

export function createId(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

export function now() {
  return new Date().toISOString();
}

export function createToken() {
  return `${createId("session")}_${randomBytes(10).toString("hex")}`;
}

export function createPassword(password: string) {
  const salt = randomBytes(16).toString("hex");

  return {
    salt,
    passwordHash: hashPassword(password, salt)
  };
}

export function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

export function hasPasswordCredentials(candidate: Partial<Pick<StoredUser, "passwordHash" | "salt">>) {
  return typeof candidate.passwordHash === "string" && typeof candidate.salt === "string";
}

export function passwordMatches(password: string, candidate: Pick<StoredUser, "passwordHash" | "salt">) {
  if (!hasPasswordCredentials(candidate)) {
    return false;
  }

  try {
    return candidate.passwordHash === hashPassword(password, candidate.salt);
  } catch {
    return false;
  }
}

export function toUserProfile(user: StoredUser): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin
  };
}

export function requireUser(request: Request) {
  if (!request.user) {
    throw new HttpError(401, "Authentication required.");
  }

  return request.user;
}

export function requireAdmin(request: Request) {
  const user = requireUser(request);

  if (!user.isAdmin) {
    throw new HttpError(403, "Administrator access required.");
  }

  return user;
}

export function createAuthMiddleware() {
  return async (request: Request, _response: Response, next: NextFunction) => {
    const authorization = request.header("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      next();
      return;
    }

    const token = authorization.slice("Bearer ".length);
    const user = await runStoreQuery((database) => {
      const session = readSession(database, token);
      return session ? readUserById(database, session.userId) : null;
    });

    if (user) {
      request.user = toUserProfile(user);
    }

    next();
  };
}
