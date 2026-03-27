import type { z } from "zod";

import { assetUploadCategorySchema, uploadedAssetResponseSchema } from "@shared/contracts/assets";

import { apiRequest } from "../api";

type AssetUploadCategory = z.infer<typeof assetUploadCategorySchema>;

export function uploadImageAsset(token: string, category: AssetUploadCategory, file: File) {
  const normalizedCategory = assetUploadCategorySchema.parse(category);

  return apiRequest<{ url: string }>(`/assets/${normalizedCategory}`, {
    method: "POST",
    token,
    body: file,
    contentType: file.type || "application/octet-stream",
    headers: {
      "X-Upload-Filename": encodeURIComponent(file.name)
    },
    responseSchema: uploadedAssetResponseSchema
  });
}
