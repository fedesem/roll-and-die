import { Router } from "express";

import { campaignController } from "../controllers/campaignController.js";
import { wrap } from "../http/wrap.js";

export function createCampaignRouter() {
  const router = Router();

  router.get("/books", wrap(campaignController.sourceBooks));
  router.get("/", wrap(campaignController.list));
  router.post("/", wrap(campaignController.create));
  router.get("/:campaignId/snapshot", wrap(campaignController.snapshot));
  router.post("/:campaignId/invites", wrap(campaignController.createInvite));
  router.post("/:campaignId/actors", wrap(campaignController.createActor));
  router.put("/:campaignId/actors/:actorId", wrap(campaignController.updateActor));
  router.delete("/:campaignId/actors/:actorId", wrap(campaignController.deleteActor));
  router.post("/:campaignId/monsters", wrap(campaignController.createMonsterActor));

  return router;
}

export function createInviteRouter() {
  const router = Router();

  router.post("/accept", wrap(campaignController.acceptInvite));

  return router;
}
