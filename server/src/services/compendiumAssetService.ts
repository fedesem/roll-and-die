import type { MonsterTemplate } from "../../../shared/types.js";
import { unzipSync } from "fflate";
import { HttpError } from "../http/errors.js";
import { runStoreQuery, runStoreTransaction } from "../store.js";
import { readCompendiumCollection, upsertCompendiumEntry } from "../store/models/compendium.js";
import { externalizeImageUrl, storeUploadedImageBuffer } from "./assetStorage.js";

const supportedArchiveImageExtensions = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);

export interface MonsterTokenArchiveImportResult {
  processedFiles: number;
  matchedFiles: number;
  updatedMonsters: number;
  ignoredEntries: number;
  unmatchedFiles: string[];
}

export async function prepareMonsterTemplateForStorage(monster: MonsterTemplate): Promise<MonsterTemplate> {
  return {
    ...monster,
    imageUrl: await externalizeImageUrl(monster.imageUrl, "tokens")
  };
}

export async function importMonsterTokenArchive(archiveBuffer: Buffer): Promise<MonsterTokenArchiveImportResult> {
  let archiveEntries: Record<string, Uint8Array>;

  try {
    archiveEntries = unzipSync(archiveBuffer);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "Unable to read the uploaded zip archive.");
  }

  const monsters = await runStoreQuery(async (database) => await readCompendiumCollection(database, "monsters"));
  const monstersByName = buildMonsterNameLookup(monsters);
  const updatesByMonsterId = new Map<string, MonsterTemplate>();
  const unmatchedFiles: string[] = [];
  let processedFiles = 0;
  let matchedFiles = 0;
  let ignoredEntries = 0;

  for (const [archivePath, entryBytes] of Object.entries(archiveEntries)) {
    const fileName = getArchiveFileName(archivePath);
    const extension = getFileExtension(fileName);

    if (!fileName || archivePath.endsWith("/") || archivePath.startsWith("__MACOSX/") || fileName.startsWith(".")) {
      ignoredEntries += 1;
      continue;
    }

    if (!supportedArchiveImageExtensions.has(extension)) {
      ignoredEntries += 1;
      continue;
    }

    processedFiles += 1;
    const matches = monstersByName.get(normalizeMonsterLookupKey(stripFileExtension(fileName)));

    if (!matches || matches.length === 0) {
      unmatchedFiles.push(fileName);
      continue;
    }

    matchedFiles += 1;
    const nextImageUrl = await storeUploadedImageBuffer(Buffer.from(entryBytes), "tokens");

    matches.forEach((monster) => {
      updatesByMonsterId.set(monster.id, {
        ...monster,
        imageUrl: nextImageUrl
      });
    });
  }

  if (processedFiles === 0) {
    throw new HttpError(400, "The uploaded zip archive does not contain any supported image files.");
  }

  if (updatesByMonsterId.size > 0) {
    await runStoreTransaction(async (database) => {
      for (const monster of updatesByMonsterId.values()) {
        await upsertCompendiumEntry(database, "monsters", monster);
      }
    });
  }

  return {
    processedFiles,
    matchedFiles,
    updatedMonsters: updatesByMonsterId.size,
    ignoredEntries,
    unmatchedFiles: unmatchedFiles.sort((left, right) => left.localeCompare(right))
  };
}

function buildMonsterNameLookup(monsters: MonsterTemplate[]) {
  const lookup = new Map<string, MonsterTemplate[]>();

  monsters.forEach((monster) => {
    const key = normalizeMonsterLookupKey(monster.name);
    const existing = lookup.get(key) ?? [];

    existing.push(monster);
    lookup.set(key, existing);
  });

  return lookup;
}

function getArchiveFileName(entryName: string) {
  const segments = entryName.split("/");
  return segments[segments.length - 1] ?? "";
}

function getFileExtension(value: string) {
  const lowerCasedValue = value.toLowerCase();
  const lastDotIndex = lowerCasedValue.lastIndexOf(".");
  return lastDotIndex >= 0 ? lowerCasedValue.slice(lastDotIndex) : "";
}

function stripFileExtension(value: string) {
  return value.replace(/\.[^.]+$/, "");
}

function normalizeMonsterLookupKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
