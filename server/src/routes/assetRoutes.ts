import { raw, Router } from "express";

import { assetController } from "../controllers/assetController.js";
import { wrap } from "../http/wrap.js";

export function createAssetRouter() {
  const router = Router();
  const imageUploadBody = raw({
    type: ["image/*", "application/octet-stream"],
    limit: "250mb"
  });

  router.post("/:category", imageUploadBody, wrap(assetController.uploadImage));

  return router;
}
