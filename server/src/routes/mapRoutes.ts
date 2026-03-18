import { Router } from "express";

import { mapController } from "../controllers/mapController.js";
import { wrap } from "../http/wrap.js";

export function createMapRouter() {
  const router = Router({ mergeParams: true });

  router.post("/", wrap(mapController.create));
  router.put("/:mapId", wrap(mapController.update));
  router.post("/:mapId/actors", wrap(mapController.assignActor));
  router.delete("/:mapId/actors/:actorId", wrap(mapController.removeActor));

  return router;
}
