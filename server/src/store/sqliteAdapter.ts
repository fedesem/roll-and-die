import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { migrations } from "./migrations/index.js";
import { normalizeDatabase } from "./legacy.js";
import { clearRelationalTables, readCampaigns, writeCampaigns } from "./models/campaigns.js";
import { clearCompendiumTables, readCompendium, writeCompendium } from "./models/compendium.js";
import { readUsersAndSessions, writeUsersAndSessions } from "./models/users.js";
import { runInTransaction, readAll } from "./helpers.js";
import { sqlitePath, type Database, type PersistenceAdapter } from "./types.js";

export class SqlitePersistenceAdapter implements PersistenceAdapter {
  private database: DatabaseSync | null = null;
  private initialized = false;

  async initialize() {
    if (this.initialized) {
      return;
    }

    await mkdir(dirname(sqlitePath), { recursive: true });
    this.database = new DatabaseSync(sqlitePath);
    this.database.exec("PRAGMA foreign_keys = ON;");
    this.database.exec("PRAGMA journal_mode = WAL;");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    const database = this.getDatabase();
    const applied = new Set(
      readAll<{ version: number }>(database, "SELECT version FROM schema_migrations ORDER BY version").map(
        (row) => row.version
      )
    );

    for (const migration of migrations) {
      if (applied.has(migration.version)) {
        continue;
      }

      await runInTransaction(database, async () => {
        await migration.up(database);
        database
          .prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)")
          .run(migration.version, migration.name, new Date().toISOString());
      });
    }

    this.initialized = true;
  }

  async read() {
    await this.initialize();
    const database = this.getDatabase();
    const { users, sessions } = readUsersAndSessions(database);
    const campaigns = readCampaigns(database);
    const compendium = readCompendium(database);

    return normalizeDatabase({
      users,
      sessions,
      campaigns,
      compendium
    });
  }

  async write(state: Database) {
    await this.initialize();
    await runInTransaction(this.getDatabase(), () => {
      const normalized = normalizeDatabase(state);
      clearCompendiumTables(this.getDatabase());
      clearRelationalTables(this.getDatabase());
      writeUsersAndSessions(this.getDatabase(), normalized);
      writeCampaigns(this.getDatabase(), normalized);
      writeCompendium(this.getDatabase(), normalized.compendium);
    });
  }

  private getDatabase() {
    if (!this.database) {
      throw new Error("SQLite adapter not initialized.");
    }

    return this.database;
  }
}
