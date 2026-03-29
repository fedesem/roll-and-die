import { basename, resolve } from "node:path";

import type { Campaign, CompendiumData, UserProfile } from "../../../shared/types.js";

export type SQLInputValue = Buffer | Uint8Array | string | number | bigint | null;

export interface StatementSync {
  all<T>(...params: SQLInputValue[]): Promise<T[]>;
  get<T>(...params: SQLInputValue[]): Promise<T | undefined>;
  run(...params: SQLInputValue[]): Promise<void>;
}

export interface DatabaseSync {
  drain(): Promise<void>;
  exec(sql: string): Promise<void>;
  prepare(sql: string): StatementSync;
}

export interface StoredUser extends UserProfile {
  passwordHash: string;
  salt: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
}

export interface Database {
  users: StoredUser[];
  sessions: SessionRecord[];
  campaigns: Campaign[];
  compendium: CompendiumData;
}

export interface Migration {
  version: number;
  name: string;
  up(database: DatabaseSync): Promise<void> | void;
}

function resolveProjectRoot() {
  return basename(process.cwd()) === "server" ? resolve(process.cwd(), "..") : process.cwd();
}

export const sqlitePath = resolve(resolveProjectRoot(), "data", "app.sqlite");

export const defaultDatabase: Database = {
  users: [],
  sessions: [],
  campaigns: [],
  compendium: {
    spells: [],
    monsters: [],
    feats: [],
    classes: [],
    books: [],
    variantRules: [],
    conditions: [],
    optionalFeatures: [],
    actions: [],
    backgrounds: [],
    items: [],
    languages: [],
    races: [],
    skills: []
  }
};
