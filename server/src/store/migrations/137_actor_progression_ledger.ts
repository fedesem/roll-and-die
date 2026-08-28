import type { Migration } from "../types.js";

export const actorProgressionLedgerMigration: Migration = {
  version: 137,
  name: "actor_progression_ledger",
  async up(database) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS actor_progression_awards (
        actor_id TEXT NOT NULL,
        award_id TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        committed_at TEXT NOT NULL,
        PRIMARY KEY (actor_id, award_id),
        FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS actor_manual_overrides (
        actor_id TEXT NOT NULL,
        override_id TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (actor_id, override_id),
        FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_actor_progression_awards_actor_order
        ON actor_progression_awards(actor_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_actor_manual_overrides_actor_order
        ON actor_manual_overrides(actor_id, sort_order);
    `);
  }
};
