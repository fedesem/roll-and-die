import type { Migration } from "../types.js";
import { hasRelationalData, loadLegacyDatabase } from "../legacy.js";

export const importLegacyMigration: Migration = {
  version: 101,
  name: "import_legacy",
  async up(database) {
    if (hasRelationalData(database)) {
      return;
    }

    const { writeCampaigns } = await import("../models/campaigns.js");
    const { writeUsersAndSessions } = await import("../models/users.js");
    const legacy = await loadLegacyDatabase(database);

    writeUsersAndSessions(database, legacy);
    writeCampaigns(database, legacy);
  }
};
