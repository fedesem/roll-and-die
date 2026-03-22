import { SqlitePersistenceAdapter } from "./store/sqliteAdapter.js";
import type { Database } from "./store/types.js";
import type { DatabaseSync } from "node:sqlite";

export type { Database, StoredUser, SessionRecord } from "./store/types.js";

const adapter = new SqlitePersistenceAdapter();
let writeQueue: Promise<unknown> = Promise.resolve();

export async function readDatabase(): Promise<Database> {
  return adapter.read();
}

export async function mutateDatabase<T>(mutator: (database: Database) => Promise<T> | T): Promise<T> {
  const task = writeQueue.then(async () => {
    const database = await adapter.read();
    const result = await mutator(database);
    await adapter.write(database);
    return result;
  });

  writeQueue = task.then(
    () => undefined,
    () => undefined
  );

  return task;
}

export async function runStoreTransaction<T>(task: (database: DatabaseSync) => Promise<T> | T): Promise<T> {
  const queuedTask = writeQueue.then(() => adapter.transaction(task));

  writeQueue = queuedTask.then(
    () => undefined,
    () => undefined
  );

  return queuedTask;
}
