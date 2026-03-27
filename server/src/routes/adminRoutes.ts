import { raw, Router } from "express";

import { adminController } from "../controllers/adminController.js";
import { wrap } from "../http/wrap.js";

export function createAdminRouter() {
  const router = Router();
  const zipUploadBody = raw({
    type: ["application/zip", "application/x-zip-compressed", "application/octet-stream"],
    limit: "250mb"
  });

  router.get("/overview", wrap(adminController.overview));
  router.post("/users/:userId/promote", wrap(adminController.promoteUser));
  router.post("/users/:userId/demote", wrap(adminController.demoteUser));
  router.delete("/users/:userId", wrap(adminController.deleteUser));
  router.post("/compendium/monsters/token-images/import", zipUploadBody, wrap(adminController.importMonsterTokenArchive));
  router.post("/compendium/:kind", wrap(adminController.createCompendiumEntry));
  router.delete("/compendium/:kind", wrap(adminController.clearCompendiumEntries));
  router.post("/compendium/:kind/import", wrap(adminController.importCompendiumEntries));
  router.delete("/compendium/:kind/:itemId", wrap(adminController.deleteCompendiumEntry));

  return router;
}
