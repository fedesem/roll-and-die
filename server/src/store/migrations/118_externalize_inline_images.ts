import type { Migration } from "../types.js";
import { externalizeTableImageColumn } from "../../services/assetStorage.js";
export const externalizeInlineImagesMigration: Migration = {
    version: 118,
    name: "externalize_inline_images",
    async up(database) {
        await externalizeTableImageColumn({
            database,
            tableName: "maps",
            idColumn: "id",
            imageColumn: "background_url",
            category: "maps"
        });
        await externalizeTableImageColumn({
            database,
            tableName: "actors",
            idColumn: "id",
            imageColumn: "image_url",
            category: "actors"
        });
        await externalizeTableImageColumn({
            database,
            tableName: "tokens",
            idColumn: "id",
            imageColumn: "image_url",
            category: "tokens"
        });
        await externalizeTableImageColumn({
            database,
            tableName: "chat_messages",
            idColumn: "id",
            imageColumn: "actor_image_url",
            category: "chat"
        });
    }
};
