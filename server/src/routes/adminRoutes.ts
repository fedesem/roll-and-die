import { Router } from "express";

import { adminController } from "../controllers/adminController.js";
import { wrap } from "../http/wrap.js";

export function createAdminRouter() {
  const router = Router();

  router.get("/overview", wrap(adminController.overview));
  router.post("/users/:userId/promote", wrap(adminController.promoteUser));
  router.post("/users/:userId/demote", wrap(adminController.demoteUser));
  router.post("/compendium/:kind", wrap(adminController.createCompendiumEntry));
  router.post("/compendium/:kind/import", wrap(adminController.importCompendiumEntries));

  return router;
}
