import type { DatabaseSync } from "node:sqlite";

import type { Database } from "../types.js";
import { readAll } from "../helpers.js";

export function readUsersAndSessions(database: DatabaseSync): Pick<Database, "users" | "sessions"> {
  const users = readAll<{
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

  const sessions = readAll<{
    token: string;
    userId: string;
    createdAt: string;
  }>(
    database,
    `
      SELECT token, user_id as userId, created_at as createdAt
      FROM sessions
      ORDER BY created_at, token
    `
  );

  return { users, sessions };
}

export function writeUsersAndSessions(database: DatabaseSync, state: Database) {
  const insertUser = database.prepare(`
    INSERT INTO users (id, name, email, is_admin, password_hash, salt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertSession = database.prepare(`
    INSERT INTO sessions (token, user_id, created_at)
    VALUES (?, ?, ?)
  `);

  for (const user of state.users) {
    insertUser.run(user.id, user.name, user.email, user.isAdmin ? 1 : 0, user.passwordHash, user.salt);
  }

  for (const session of state.sessions) {
    insertSession.run(session.token, session.userId, session.createdAt);
  }
}
