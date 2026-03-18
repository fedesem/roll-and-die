import { Router } from "express";

import { tokenController } from "../controllers/tokenController.js";
import { wrap } from "../http/wrap.js";

export function createTokenRouter() {
  const router = Router({ mergeParams: true });

  router.post("/", wrap(tokenController.create));
  router.put("/:tokenId", wrap(tokenController.update));
  router.delete("/:tokenId", wrap(tokenController.remove));

  return router;
}
