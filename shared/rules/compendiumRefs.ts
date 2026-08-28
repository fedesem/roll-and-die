export type CompendiumRef = string;

export interface ParsedCompendiumRef {
  name: string;
  source: string;
  parts: string[];
}

export function normalizeSourceCode(value: string): string {
  return value.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
}

export function createCompendiumRef(name: string, source: string, ...context: Array<string | number | undefined>): CompendiumRef {
  const parts = [name.trim(), normalizeSourceCode(source), ...context.map((entry) => String(entry ?? "").trim())];
  while (parts.at(-1) === "") {
    parts.pop();
  }
  return parts.join("|");
}

export function parseCompendiumRef(value: string): ParsedCompendiumRef | null {
  const parts = value.split("|").map((part) => part.trim());
  if (!parts[0] || !parts[1]) {
    return null;
  }
  return { name: parts[0], source: normalizeSourceCode(parts[1]), parts };
}

export function isCompendiumRef(value: string): boolean {
  return parseCompendiumRef(value) !== null;
}

export function compendiumRefMatches(ref: string, entry: { name: string; source: string }): boolean {
  const parsed = parseCompendiumRef(ref);
  if (!parsed) {
    return false;
  }
  return normalizeLookupKey(parsed.name) === normalizeLookupKey(entry.name) && parsed.source === normalizeSourceCode(entry.source);
}

function normalizeLookupKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
