import type { DatabaseSync, SQLInputValue } from "node:sqlite";

export function runInTransaction<T>(database: DatabaseSync, task: () => Promise<T> | T) {
  database.exec("BEGIN IMMEDIATE");

  return Promise.resolve(task())
    .then((result) => {
      database.exec("COMMIT");
      return result;
    })
    .catch((error) => {
      database.exec("ROLLBACK");
      throw error;
    });
}

export function addColumnIfMissing(database: DatabaseSync, tableName: string, columnName: string, definition: string) {
  const columns = readAll<{ name: string }>(database, `PRAGMA table_info(${tableName})`);

  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

export function tableExists(database: DatabaseSync, tableName: string) {
  const row = database
    .prepare("SELECT 1 as found FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .get(tableName) as { found: number } | undefined;

  return Boolean(row?.found);
}

export function readCount(database: DatabaseSync, table: string) {
  const row = database.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
  return row.count;
}

export function readAll<T>(database: DatabaseSync, sql: string, ...params: SQLInputValue[]) {
  return database.prepare(sql).all(...params) as T[];
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

export function rebuildActorChildTables(database: DatabaseSync) {
  database.exec(`
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
