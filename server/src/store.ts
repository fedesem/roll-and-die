import { SqlitePersistenceAdapter } from "./store/sqliteAdapter.js";
import type { DatabaseSync } from "node:sqlite";

export type { Database, StoredUser, SessionRecord } from "./store/types.js";

const adapter = new SqlitePersistenceAdapter();
const writeQueues = new Map<string, Promise<unknown>>();
let writeExecutionQueue: Promise<unknown> = Promise.resolve();

interface StoreExecutionOptions {
  queueKey?: string;
}

function resolveQueueKey(options?: StoreExecutionOptions) {
  return options?.queueKey ?? "__global__";
}

export async function runStoreQuery<T>(
  task: (database: DatabaseSync) => T,
  options?: StoreExecutionOptions
): Promise<T> {
  await (writeQueues.get(resolveQueueKey(options)) ?? Promise.resolve());
  return adapter.query(task);
}

export async function runStoreTransaction<T>(
  task: (database: DatabaseSync) => Promise<T> | T,
  options?: StoreExecutionOptions
): Promise<T> {
  const queueKey = resolveQueueKey(options);
  const priorQueue = writeQueues.get(queueKey) ?? Promise.resolve();
  const queuedTask = priorQueue.then(async () => {
    const executionTask = writeExecutionQueue.then(() => adapter.transaction(task));

    writeExecutionQueue = executionTask.then(
      () => undefined,
      () => undefined
    );

    return executionTask;
  });
  const settledTask = queuedTask.then(
    () => undefined,
    () => undefined
  );

  writeQueues.set(queueKey, settledTask);

  void settledTask.then(() => {
    if (writeQueues.get(queueKey) === settledTask) {
      writeQueues.delete(queueKey);
    }
  });

  return queuedTask;
}
