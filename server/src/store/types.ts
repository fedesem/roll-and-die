import { basename, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";

import type {
  Campaign,
  CompendiumData,
  UserProfile
} from "../../../shared/types.js";

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
    optionalFeatures: [],
    actions: [],
    backgrounds: [],
    items: [],
    languages: [],
    races: [],
    skills: []
  }
};
