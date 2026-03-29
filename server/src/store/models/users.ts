import type { DatabaseSync } from "../types.js";
import type { Database } from "../types.js";
import { readAll } from "../helpers.js";

export async function countUsers(database: DatabaseSync) {
  const row = await database.prepare("SELECT COUNT(*) as count FROM users").get<{
    count: number;
  }>();
  return row?.count ?? 0;
}

export async function listUsers(database: DatabaseSync) {
  return (
    await readAll<{
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
    )
  ).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    isAdmin: Boolean(row.isAdmin),
    passwordHash: row.passwordHash,
    salt: row.salt
  }));
}

export async function readUserByEmail(database: DatabaseSync, email: string) {
  const row = await database
    .prepare(
      `
        SELECT id, name, email, is_admin as isAdmin, password_hash as passwordHash, salt
        FROM users
        WHERE email = ?
        LIMIT 1
      `
    )
    .get<{
      id: string;
      name: string;
      email: string;
      isAdmin: number;
      passwordHash: string;
      salt: string;
    }>(email);

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

export async function readUserById(database: DatabaseSync, userId: string) {
  const row = await database
    .prepare(
      `
        SELECT id, name, email, is_admin as isAdmin, password_hash as passwordHash, salt
        FROM users
        WHERE id = ?
        LIMIT 1
      `
    )
    .get<{
      id: string;
      name: string;
      email: string;
      isAdmin: number;
      passwordHash: string;
      salt: string;
    }>(userId);

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

export async function readSession(database: DatabaseSync, token: string) {
  const row = await database
    .prepare(
      `
        SELECT token, user_id as userId, created_at as createdAt
        FROM sessions
        WHERE token = ?
        LIMIT 1
      `
    )
    .get<{
      token: string;
      userId: string;
      createdAt: string;
    }>(token);

  return row ?? null;
}

export async function insertUser(database: DatabaseSync, user: Database["users"][number]) {
  await database
    .prepare(
      `
        INSERT INTO users (id, name, email, is_admin, password_hash, salt)
        VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .run(user.id, user.name, user.email, user.isAdmin ? 1 : 0, user.passwordHash, user.salt);
}

export async function insertSession(database: DatabaseSync, session: Database["sessions"][number]) {
  await database
    .prepare(
      `
        INSERT INTO sessions (token, user_id, created_at)
        VALUES (?, ?, ?)
      `
    )
    .run(session.token, session.userId, session.createdAt);
}

export async function setUserAdminFlag(database: DatabaseSync, userId: string, isAdmin: boolean) {
  await database
    .prepare(
      `
        UPDATE users
        SET is_admin = ?
        WHERE id = ?
      `
    )
    .run(isAdmin ? 1 : 0, userId);
}

export async function deleteUserSessions(database: DatabaseSync, userId: string) {
  await database
    .prepare(
      `
        DELETE FROM sessions
        WHERE user_id = ?
      `
    )
    .run(userId);
}

export async function deleteUser(database: DatabaseSync, userId: string) {
  await database
    .prepare(
      `
        DELETE FROM users
        WHERE id = ?
      `
    )
    .run(userId);
}
