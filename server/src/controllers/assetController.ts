import type { Request, Response } from "express";

import { assetUploadCategorySchema, uploadedAssetResponseSchema } from "../../../shared/contracts/assets.js";
import { HttpError } from "../http/errors.js";
import { parseWithSchema } from "../http/validation.js";
import { requireUser } from "../services/authService.js";
import { storeUploadedImageBuffer } from "../services/assetStorage.js";

export const assetController = {
  async uploadImage(request: Request, response: Response) {
    requireUser(request);

    const category = parseWithSchema(assetUploadCategorySchema, request.params.category, "Invalid asset upload category.");

    if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
      throw new HttpError(400, "Upload an image file.");
    }

    const payload = uploadedAssetResponseSchema.parse({
      url: await storeUploadedImageBuffer(request.body, category)
    });

    response.status(201).json(payload);
  }
};
