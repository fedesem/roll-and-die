import type { DatabaseSync } from "node:sqlite";

import type { Database } from "../types.js";
import { readAll } from "../helpers.js";

export function countUsers(database: DatabaseSync) {
  const row = database.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  return row.count;
}

export function listUsers(database: DatabaseSync) {
  return readAll<{
    id: string;
    name: string;
    email: string;
    isAdmin: number;
    passwordHash: string;
    salt: string;
  }>(
    database,
    `
      SELECT id, name, email, is_admin as isAdmin, password_hash as passwordHash, salt
      FROM users
      ORDER BY id
    `
  ).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    isAdmin: Boolean(row.isAdmin),
    passwordHash: row.passwordHash,
    salt: row.salt
  }));
}

export function readUserByEmail(database: DatabaseSync, email: string) {
  const row = database
    .prepare(
      `
        SELECT id, name, email, is_admin as isAdmin, password_hash as passwordHash, salt
        FROM users
        WHERE email = ?
        LIMIT 1
      `
    )
    .get(email) as
    | {
        id: string;
        name: string;
        email: string;
        isAdmin: number;
        passwordHash: string;
        salt: string;
      }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    isAdmin: Boolean(row.isAdmin),
    passwordHash: row.passwordHash,
    salt: row.salt
  };
}

export function readUserById(database: DatabaseSync, userId: string) {
  const row = database
    .prepare(
      `
        SELECT id, name, email, is_admin as isAdmin, password_hash as passwordHash, salt
        FROM users
        WHERE id = ?
        LIMIT 1
      `
    )
    .get(userId) as
    | {
        id: string;
        name: string;
        email: string;
        isAdmin: number;
        passwordHash: string;
        salt: string;
      }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    isAdmin: Boolean(row.isAdmin),
    passwordHash: row.passwordHash,
    salt: row.salt
  };
}

export function readSession(database: DatabaseSync, token: string) {
  const row = database
    .prepare(
      `
        SELECT token, user_id as userId, created_at as createdAt
        FROM sessions
        WHERE token = ?
        LIMIT 1
      `
    )
    .get(token) as { token: string; userId: string; createdAt: string } | undefined;

  return row ?? null;
}

export function insertUser(database: DatabaseSync, user: Database["users"][number]) {
  database
    .prepare(
      `
        INSERT INTO users (id, name, email, is_admin, password_hash, salt)
        VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .run(user.id, user.name, user.email, user.isAdmin ? 1 : 0, user.passwordHash, user.salt);
}

export function insertSession(database: DatabaseSync, session: Database["sessions"][number]) {
  database
    .prepare(
      `
        INSERT INTO sessions (token, user_id, created_at)
        VALUES (?, ?, ?)
      `
    )
    .run(session.token, session.userId, session.createdAt);
}

export function setUserAdminFlag(database: DatabaseSync, userId: string, isAdmin: boolean) {
  database
    .prepare(
      `
        UPDATE users
        SET is_admin = ?
        WHERE id = ?
      `
    )
    .run(isAdmin ? 1 : 0, userId);
}

export function deleteUserSessions(database: DatabaseSync, userId: string) {
  database
    .prepare(
      `
        DELETE FROM sessions
        WHERE user_id = ?
      `
    )
    .run(userId);
}

export function deleteUser(database: DatabaseSync, userId: string) {
  database
    .prepare(
      `
        DELETE FROM users
        WHERE id = ?
      `
    )
    .run(userId);
}
