import { Router } from "express";

import { chatController } from "../controllers/chatController.js";
import { wrap } from "../http/wrap.js";

export function createChatRouter() {
  const router = Router({ mergeParams: true });

  router.post("/:campaignId/chat", wrap(chatController.createMessage));
  router.post("/:campaignId/roll", wrap(chatController.createRoll));

  return router;
}
