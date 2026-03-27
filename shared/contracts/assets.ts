import { z } from "zod";

export const assetUploadCategorySchema = z.enum(["actors", "chat", "maps", "tokens"]);

export const uploadedAssetResponseSchema = z.object({
  url: z.string().trim().min(1)
});
