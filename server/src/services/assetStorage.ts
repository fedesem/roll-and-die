import { createHash } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";

type AssetCategory = "actors" | "chat" | "maps" | "tokens";

const assetMimeExtensions: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp"
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

export async function externalizeImageUrl(
  value: string,
  category: AssetCategory
) {
  const trimmed = value.trim();

  if (!trimmed || !isInlineImageDataUrl(trimmed)) {
    return trimmed;
  }

  return storeInlineImage(trimmed, category);
}

export async function storeInlineImage(
  dataUrl: string,
  category: AssetCategory
) {
  const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\r\n]+)$/i);

  if (!match) {
    throw new Error("Invalid inline image payload.");
  }

  const mimeType = match[1].toLowerCase();
  const base64 = match[2].replace(/\s+/g, "");
  const extension = assetMimeExtensions[mimeType] ?? "bin";
  const contents = Buffer.from(base64, "base64");
  const digest = createHash("sha256").update(contents).digest("hex");
  const directory = resolve(uploadsRootPath, category);
  const filename = `${digest}.${extension}`;
  const destination = resolve(directory, filename);

  await mkdir(directory, { recursive: true });

  try {
    await stat(destination);
  } catch {
    await writeFile(destination, contents);
  }

  return `/uploads/${category}/${filename}`;
}

export async function externalizeTableImageColumn(params: {
  database: DatabaseSync;
  tableName: string;
  idColumn: string;
  imageColumn: string;
  category: AssetCategory;
}) {
  const rows = params.database
    .prepare(
      `
        SELECT ${params.idColumn} as id, ${params.imageColumn} as imageUrl
        FROM ${params.tableName}
        WHERE ${params.imageColumn} LIKE 'data:image/%'
      `
    )
    .all() as Array<{ id: string; imageUrl: string }>;

  if (rows.length === 0) {
    return;
  }

  const updateRecord = params.database.prepare(
    `
      UPDATE ${params.tableName}
      SET ${params.imageColumn} = ?
      WHERE ${params.idColumn} = ?
    `
  );

  for (const row of rows) {
    const nextUrl = await externalizeImageUrl(row.imageUrl, params.category);

    if (nextUrl && nextUrl !== row.imageUrl) {
      updateRecord.run(nextUrl, row.id);
    }
  }
}

export function externalizeImageUrlSync(
  value: string,
  category: AssetCategory
) {
  return externalizeImageUrl(value, category);
}

export function assetCategoryFromUrl(value: string): AssetCategory | null {
  if (!isStoredUploadPath(value)) {
    return null;
  }

  const [, , category] = value.split("/");
  return category === "actors" || category === "chat" || category === "maps" || category === "tokens"
    ? category
    : null;
}

export function getUploadFileExtension(value: string) {
  const extension = extname(value).replace(/^\./, "").toLowerCase();
  return extension || null;
}
