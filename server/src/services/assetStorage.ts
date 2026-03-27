import { createHash } from "node:crypto";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import { basename, extname, resolve, sep } from "node:path";
import sharp from "sharp";
import type { DatabaseSync } from "../store/types.js";
type AssetCategory = "actors" | "chat" | "maps" | "tokens";
const assetProfiles: Record<
  AssetCategory,
  {
    maxWidth?: number;
    maxHeight?: number;
    quality: number;
  }
> = {
  actors: {
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 78
  },
  chat: {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 80
  },
  maps: {
    quality: 82
  },
  tokens: {
    maxWidth: 768,
    maxHeight: 768,
    quality: 74
  }
};
function resolveProjectRoot() {
  return basename(process.cwd()) === "server" ? resolve(process.cwd(), "..") : process.cwd();
}
export const uploadsRootPath = resolve(resolveProjectRoot(), "data", "uploads");
export function isInlineImageDataUrl(value: string) {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(value.trim());
}
export function isStoredUploadPath(value: string) {
  return value.startsWith("/uploads/");
}
export async function externalizeImageUrl(value: string, category: AssetCategory) {
  const trimmed = value.trim();
  if (!trimmed || !isInlineImageDataUrl(trimmed)) {
    return trimmed;
  }
  return await storeInlineImage(trimmed, category);
}
export async function storeInlineImage(dataUrl: string, category: AssetCategory) {
  const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\r\n]+)$/i);
  if (!match) {
    throw new Error("Invalid inline image payload.");
  }
  const mimeType = match[1].toLowerCase();
  const base64 = match[2].replace(/\s+/g, "");
  if (!mimeType.startsWith("image/")) {
    throw new Error("Unsupported image payload.");
  }
  const contents = Buffer.from(base64, "base64");
  return await storeUploadedImageBuffer(contents, category);
}
export async function storeUploadedImageBuffer(contents: Buffer, category: AssetCategory) {
  const normalizedContents = await normalizeImageBuffer(contents, category);
  const digest = createHash("sha256").update(normalizedContents).digest("hex");
  const directory = resolve(uploadsRootPath, category);
  const filename = `${digest}.webp`;
  const destination = resolve(directory, filename);
  await mkdir(directory, { recursive: true });
  try {
    await stat(destination);
  } catch {
    await writeFile(destination, normalizedContents);
  }
  return `/uploads/${category}/${filename}`;
}
async function normalizeImageBuffer(contents: Buffer, category: AssetCategory) {
  const profile = assetProfiles[category];
  let pipeline = sharp(contents, {
    animated: false,
    limitInputPixels: 100_000_000
  }).rotate();
  if (profile.maxWidth || profile.maxHeight) {
    pipeline = pipeline.resize({
      width: profile.maxWidth,
      height: profile.maxHeight,
      fit: "inside",
      withoutEnlargement: true
    });
  }
  return await pipeline
    .webp({
      quality: profile.quality,
      effort: 4,
      smartSubsample: true
    })
    .toBuffer();
}
export async function externalizeTableImageColumn(params: {
  database: DatabaseSync;
  tableName: string;
  idColumn: string;
  imageColumn: string;
  category: AssetCategory;
}) {
  const rows = await params.database
    .prepare(
      `
        SELECT ${params.idColumn} as id, ${params.imageColumn} as imageUrl
        FROM ${params.tableName}
        WHERE ${params.imageColumn} LIKE 'data:image/%'
      `
    )
    .all<{
      id: string;
      imageUrl: string;
    }>();
  if (rows.length === 0) {
    return;
  }
  const updateRecord = params.database.prepare(`
      UPDATE ${params.tableName}
      SET ${params.imageColumn} = ?
      WHERE ${params.idColumn} = ?
    `);
  for (const row of rows) {
    const nextUrl = await externalizeImageUrl(row.imageUrl, params.category);
    if (nextUrl && nextUrl !== row.imageUrl) {
      await updateRecord.run(nextUrl, row.id);
    }
  }
}
export async function externalizeImageUrlSync(value: string, category: AssetCategory) {
  return await externalizeImageUrl(value, category);
}
export function assetCategoryFromUrl(value: string): AssetCategory | null {
  if (!isStoredUploadPath(value)) {
    return null;
  }
  const [, , category] = value.split("/");
  return category === "actors" || category === "chat" || category === "maps" || category === "tokens" ? category : null;
}
export function getUploadFileExtension(value: string) {
  const extension = extname(value).replace(/^\./, "").toLowerCase();
  return extension || null;
}
export async function deleteReplacedStoredUpload(params: { previousValue: string; nextValue: string }) {
  const previousValue = params.previousValue.trim();
  const nextValue = params.nextValue.trim();
  if (!previousValue || previousValue === nextValue || !isStoredUploadPath(previousValue)) {
    return;
  }
  const relativeUploadPath = previousValue.replace(/^\/uploads\//, "");
  const filePath = resolve(uploadsRootPath, relativeUploadPath);
  const uploadsRootWithSeparator = uploadsRootPath.endsWith(sep) ? uploadsRootPath : `${uploadsRootPath}${sep}`;
  if (filePath !== uploadsRootPath && !filePath.startsWith(uploadsRootWithSeparator)) {
    return;
  }
  try {
    await unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
