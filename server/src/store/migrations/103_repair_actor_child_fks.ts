import type { Migration } from "../types.js";
import { rebuildActorChildTables, tableExists } from "../helpers.js";
export const repairActorChildForeignKeysMigration: Migration = {
    version: 103,
    name: "repair_actor_child_foreign_keys",
    up(database) {
        if (!tableExists(database, "actors") || !tableExists(database, "actor_skills")) {
            return;
        }
        database.exec("PRAGMA foreign_keys = OFF;");
        rebuildActorChildTables(database);
        database.exec("PRAGMA foreign_key_check;");
        database.exec("PRAGMA foreign_keys = ON;");
    }
};
