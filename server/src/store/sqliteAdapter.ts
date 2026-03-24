import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { open, type Database as SqliteDatabase } from "sqlite";
import sqlite3 from "sqlite3";

import { runInTransaction, readAll } from "./helpers.js";
import { migrations } from "./migrations/index.js";
import { sqlitePath, type DatabaseSync, type StatementSync, type SQLInputValue } from "./types.js";

const defaultPoolSize = Number(process.env.SQLITE_POOL_SIZE ?? 4);
const defaultBusyTimeoutMs = Number(process.env.SQLITE_BUSY_TIMEOUT_MS ?? 5_000);

class AsyncSqliteStatement implements StatementSync {
  constructor(
    private readonly connection: AsyncSqliteConnection,
    private readonly sql: string
  ) {}

  async all<T>(...params: SQLInputValue[]) {
    return this.connection.all<T>(this.sql, ...params);
  }

  async get<T>(...params: SQLInputValue[]) {
    return this.connection.get<T>(this.sql, ...params);
  }

  async run(...params: SQLInputValue[]) {
    await this.connection.run(this.sql, ...params);
  }
}

class AsyncSqliteConnection implements DatabaseSync {
  private operationQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly database: SqliteDatabase<sqlite3.Database, sqlite3.Statement>) {}

  async all<T>(sql: string, ...params: SQLInputValue[]) {
    return this.enqueue(() => this.database.all<T[]>(sql, ...params) as Promise<T[]>);
  }

  drain() {
    return this.operationQueue.then(() => undefined);
  }

  exec(sql: string) {
    return this.enqueue(() => this.database.exec(sql));
  }

  async get<T>(sql: string, ...params: SQLInputValue[]) {
    return this.enqueue(() => this.database.get<T>(sql, ...params));
  }

  prepare(sql: string) {
    return new AsyncSqliteStatement(this, sql);
  }

  async run(sql: string, ...params: SQLInputValue[]) {
    await this.enqueue(() => this.database.run(sql, ...params));
  }

  close() {
    return this.database.close();
  }

  private enqueue<T>(task: () => Promise<T>) {
    const executionTask = this.operationQueue.then(task);

    this.operationQueue = executionTask.then(
      () => undefined,
      () => undefined
    );

    return executionTask;
  }
}

export class SqlitePersistenceAdapter {
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private readonly transactionContext = new AsyncLocalStorage<AsyncSqliteConnection>();
  private readonly idleConnections: AsyncSqliteConnection[] = [];
  private readonly waitingResolvers: Array<(connection: AsyncSqliteConnection) => void> = [];
  private openConnectionCount = 0;
  private readonly poolSize = Math.max(1, defaultPoolSize);

  async initialize() {
    if (this.initialized) {
      return;
    }

    if (!this.initializationPromise) {
      this.initializationPromise = (async () => {
        await mkdir(dirname(sqlitePath), { recursive: true });

        const migrationConnection = await this.openConnection();

        try {
          await migrationConnection.exec(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
              version INTEGER PRIMARY KEY,
              name TEXT NOT NULL,
              applied_at TEXT NOT NULL
            );
          `);

          const applied = new Set(
            (await readAll<{ version: number }>(
              migrationConnection,
              "SELECT version FROM schema_migrations ORDER BY version"
            )).map((row) => row.version)
          );

          for (const migration of migrations) {
            if (applied.has(migration.version)) {
              continue;
            }

            await runInTransaction(migrationConnection, async () => {
              await migration.up(migrationConnection);
              await migrationConnection
                .prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)")
                .run(migration.version, migration.name, new Date().toISOString());
            });
          }
        } finally {
          await migrationConnection.close();
        }

        this.initialized = true;
      })().finally(() => {
        this.initializationPromise = null;
      });
    }

    await this.initializationPromise;
  }

  async transaction<T>(task: (database: DatabaseSync) => Promise<T> | T) {
    await this.initialize();

    const currentConnection = this.transactionContext.getStore();

    if (currentConnection) {
      return runInTransaction(currentConnection, async () => {
        const result = await task(currentConnection);
        await currentConnection.drain();
        return result;
      });
    }

    const connection = await this.acquireConnection();

    try {
      return await this.transactionContext.run(connection, () =>
        runInTransaction(connection, async () => {
          const result = await task(connection);
          await connection.drain();
          return result;
        })
      );
    } finally {
      this.releaseConnection(connection);
    }
  }

  async query<T>(task: (database: DatabaseSync) => Promise<T> | T) {
    await this.initialize();

    const currentConnection = this.transactionContext.getStore();

    if (currentConnection) {
      const result = await task(currentConnection);
      await currentConnection.drain();
      return result;
    }

    const connection = await this.acquireConnection();

    try {
      const result = await task(connection);
      await connection.drain();
      return result;
    } finally {
      this.releaseConnection(connection);
    }
  }

  private async acquireConnection() {
    const available = this.idleConnections.pop();

    if (available) {
      return available;
    }

    if (this.openConnectionCount < this.poolSize) {
      this.openConnectionCount += 1;

      try {
        return await this.openConnection();
      } catch (error) {
        this.openConnectionCount -= 1;
        throw error;
      }
    }

    return new Promise<AsyncSqliteConnection>((resolve) => {
      this.waitingResolvers.push(resolve);
    });
  }

  private releaseConnection(connection: AsyncSqliteConnection) {
    const nextResolver = this.waitingResolvers.shift();

    if (nextResolver) {
      nextResolver(connection);
      return;
    }

    this.idleConnections.push(connection);
  }

  private async openConnection() {
    const database = await open({
      filename: sqlitePath,
      driver: sqlite3.Database
    });

    database.configure("busyTimeout", defaultBusyTimeoutMs);
    await database.exec("PRAGMA foreign_keys = ON;");
    await database.exec("PRAGMA journal_mode = WAL;");

    return new AsyncSqliteConnection(database);
  }
}
