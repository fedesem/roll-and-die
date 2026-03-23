import type { Migration } from "../types.js";
import { addColumnIfMissing } from "../helpers.js";
export const campaignSourceBooksMigration: Migration = {
    version: 115,
    name: "campaign_source_books",
    up(database) {
        addColumnIfMissing(database, "campaigns", "allowed_source_books_json", "TEXT NOT NULL DEFAULT '[]'");
    }
};
