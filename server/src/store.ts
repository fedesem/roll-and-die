import { SqlitePersistenceAdapter } from "./store/sqliteAdapter.js";
import type { DatabaseSync } from "node:sqlite";

export type { Database, StoredUser, SessionRecord } from "./store/types.js";

const adapter = new SqlitePersistenceAdapter();
let writeQueue: Promise<unknown> = Promise.resolve();

export async function runStoreQuery<T>(task: (database: DatabaseSync) => T): Promise<T> {
  await writeQueue;
  return adapter.query(task);
}

export async function runStoreTransaction<T>(task: (database: DatabaseSync) => Promise<T> | T): Promise<T> {
  const queuedTask = writeQueue.then(() => adapter.transaction(task));

  writeQueue = queuedTask.then(
    () => undefined,
    () => undefined
  );

  return queuedTask;
}
