import type { DatabaseSync, SQLInputValue } from "./types.js";
const nestedTransactionCounters = new WeakMap<DatabaseSync, number>();
function createSavepointName(database: DatabaseSync) {
  const nextCounter = (nestedTransactionCounters.get(database) ?? 0) + 1;
  nestedTransactionCounters.set(database, nextCounter);
  return `nested_txn_${nextCounter}`;
}
export function runInTransaction<T>(database: DatabaseSync, task: () => Promise<T> | T) {
  if (nestedTransactionCounters.has(database)) {
    const savepointName = createSavepointName(database);
    return database
      .exec(`SAVEPOINT ${savepointName}`)
      .then(() => Promise.resolve(task()))
      .then((result) => database.exec(`RELEASE SAVEPOINT ${savepointName}`).then(() => result))
      .catch((error) =>
        database
          .exec(`ROLLBACK TO SAVEPOINT ${savepointName}`)
          .then(() => database.exec(`RELEASE SAVEPOINT ${savepointName}`))
          .then(() => {
            throw error;
          })
      );
  }
  nestedTransactionCounters.set(database, 1);
  return database
    .exec("BEGIN IMMEDIATE")
    .then(() => Promise.resolve(task()))
    .then((result) => database.exec("COMMIT").then(() => result))
    .catch((error) =>
      database.exec("ROLLBACK").then(
        () => {
          throw error;
        },
        () => {
          throw error;
        }
      )
    )
    .finally(() => {
      nestedTransactionCounters.delete(database);
    });
}
export async function addColumnIfMissing(database: DatabaseSync, tableName: string, columnName: string, definition: string) {
  const columns = await readAll<{
    name: string;
  }>(database, `PRAGMA table_info(${tableName})`);
  if (columns.some((column) => column.name === columnName)) {
    return;
  }
  await database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}
export async function tableExists(database: DatabaseSync, tableName: string) {
  const row = await database.prepare("SELECT 1 as found FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1").get<{
    found: number;
  }>(tableName);
  return Boolean(row?.found);
}
export async function readCount(database: DatabaseSync, table: string) {
  const row = await database.prepare(`SELECT COUNT(*) as count FROM ${table}`).get<{
    count: number;
  }>();
  return row?.count ?? 0;
}
export function readAll<T>(database: DatabaseSync, sql: string, ...params: SQLInputValue[]) {
  return database.prepare(sql).all<T>(...params);
}
export function parseCellKey(key: string) {
  const [columnText, rowText] = key.split(":");
  const column = Number(columnText);
  const row = Number(rowText);
  if (!Number.isInteger(column) || !Number.isInteger(row)) {
    return null;
  }
  return { column, row };
}
export function toBoolean(value: number) {
  return value === 1;
}
export function toIntegerBoolean(value: boolean) {
  return value ? 1 : 0;
}
export async function rebuildActorChildTables(database: DatabaseSync) {
  await database.exec(`
    ALTER TABLE actor_skills RENAME TO actor_skills_old;
    CREATE TABLE actor_skills (
      actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      name TEXT NOT NULL,
      ability TEXT NOT NULL,
      proficient INTEGER NOT NULL,
      expertise INTEGER NOT NULL,
      PRIMARY KEY (actor_id, id)
    );
    INSERT INTO actor_skills SELECT * FROM actor_skills_old;
    DROP TABLE actor_skills_old;

    ALTER TABLE actor_spell_slots RENAME TO actor_spell_slots_old;
    CREATE TABLE actor_spell_slots (
      actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
      level INTEGER NOT NULL,
      total INTEGER NOT NULL,
      used INTEGER NOT NULL,
      PRIMARY KEY (actor_id, level)
    );
    INSERT INTO actor_spell_slots SELECT * FROM actor_spell_slots_old;
    DROP TABLE actor_spell_slots_old;

    ALTER TABLE actor_text_entries RENAME TO actor_text_entries_old;
    CREATE TABLE actor_text_entries (
      actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('features', 'spells', 'talents', 'feats')),
      sort_order INTEGER NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (actor_id, kind, sort_order)
    );
    INSERT INTO actor_text_entries SELECT * FROM actor_text_entries_old;
    DROP TABLE actor_text_entries_old;

    ALTER TABLE actor_attacks RENAME TO actor_attacks_old;
    CREATE TABLE actor_attacks (
      actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      name TEXT NOT NULL,
      attack_bonus INTEGER NOT NULL,
      damage TEXT NOT NULL,
      damage_type TEXT NOT NULL,
      notes TEXT NOT NULL,
      PRIMARY KEY (actor_id, id)
    );
    INSERT INTO actor_attacks SELECT * FROM actor_attacks_old;
    DROP TABLE actor_attacks_old;

    ALTER TABLE actor_armor_items RENAME TO actor_armor_items_old;
    CREATE TABLE actor_armor_items (
      actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      name TEXT NOT NULL,
      armor_class INTEGER NOT NULL,
      notes TEXT NOT NULL,
      PRIMARY KEY (actor_id, id)
    );
    INSERT INTO actor_armor_items SELECT * FROM actor_armor_items_old;
    DROP TABLE actor_armor_items_old;

    ALTER TABLE actor_resources RENAME TO actor_resources_old;
    CREATE TABLE actor_resources (
      actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      name TEXT NOT NULL,
      current_value INTEGER NOT NULL,
      max_value INTEGER NOT NULL,
      reset_on TEXT NOT NULL,
      PRIMARY KEY (actor_id, id)
    );
    INSERT INTO actor_resources SELECT * FROM actor_resources_old;
    DROP TABLE actor_resources_old;

    ALTER TABLE actor_inventory RENAME TO actor_inventory_old;
    CREATE TABLE actor_inventory (
      actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      PRIMARY KEY (actor_id, id)
    );
    INSERT INTO actor_inventory SELECT * FROM actor_inventory_old;
    DROP TABLE actor_inventory_old;
  `);
}
