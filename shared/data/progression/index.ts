import artificer from "./classes/artificer.json" with { type: "json" };
import barbarian from "./classes/barbarian.json" with { type: "json" };
import bard from "./classes/bard.json" with { type: "json" };
import cleric from "./classes/cleric.json" with { type: "json" };
import druid from "./classes/druid.json" with { type: "json" };
import fighter from "./classes/fighter.json" with { type: "json" };
import monk from "./classes/monk.json" with { type: "json" };
import paladin from "./classes/paladin.json" with { type: "json" };
import ranger from "./classes/ranger.json" with { type: "json" };
import rogue from "./classes/rogue.json" with { type: "json" };
import sorcerer from "./classes/sorcerer.json" with { type: "json" };
import warlock from "./classes/warlock.json" with { type: "json" };
import wizard from "./classes/wizard.json" with { type: "json" };

import { SUBCLASS_DATA_BY_CLASS } from "./subclasses/index.js";

import speciesData from "./species/index.js";
import backgroundsData from "./backgrounds/index.js";
import featsData from "./feats/index.js";
import referenceManifest from "./compendium-reference-manifest.json" with { type: "json" };
import choiceDomains from "./choice-domains.json" with { type: "json" };

import type {
  BackgroundProgressionDef,
  ClassProgressionDef,
  FeatProgressionDef,
  ProgressionChoiceDomainDef,
  ProgressionRegistry,
  SpeciesProgressionDef,
  SubclassProgressionDef
} from "./types.js";
import { validateProgressionCatalog } from "./validation.js";

export * from "./types.js";
export * from "./actions.js";
export * from "./validation.js";

const rawClasses = [barbarian, bard, cleric, druid, fighter, monk, paladin, ranger, rogue, sorcerer, warlock, wizard];
const rawSubclassEntries = Object.entries(SUBCLASS_DATA_BY_CLASS) as Array<[string, unknown[]]>;
const rawSubclasses = rawSubclassEntries.flatMap(([, subclasses]) => subclasses);

export const PROGRESSION_CATALOG_DIAGNOSTICS = validateProgressionCatalog({
  classes: rawClasses,
  compatibilityClasses: [artificer],
  subclasses: rawSubclasses,
  species: speciesData,
  backgrounds: backgroundsData,
  feats: featsData,
  choiceDomains,
  manifest: referenceManifest
});

if (PROGRESSION_CATALOG_DIAGNOSTICS.length > 0) {
  console.warn("Progression catalog contains invalid entries.", PROGRESSION_CATALOG_DIAGNOSTICS);
}

export const CLASS_PROGRESSIONS: Record<string, ClassProgressionDef> = {
  barbarian: barbarian as unknown as ClassProgressionDef,
  bard: bard as unknown as ClassProgressionDef,
  cleric: cleric as unknown as ClassProgressionDef,
  druid: druid as unknown as ClassProgressionDef,
  fighter: fighter as unknown as ClassProgressionDef,
  monk: monk as unknown as ClassProgressionDef,
  paladin: paladin as unknown as ClassProgressionDef,
  ranger: ranger as unknown as ClassProgressionDef,
  rogue: rogue as unknown as ClassProgressionDef,
  sorcerer: sorcerer as unknown as ClassProgressionDef,
  warlock: warlock as unknown as ClassProgressionDef,
  wizard: wizard as unknown as ClassProgressionDef
};

const COMPATIBILITY_CLASS_PROGRESSIONS: Record<string, ClassProgressionDef> = {
  artificer: artificer as unknown as ClassProgressionDef
};

export const SUBCLASSES_BY_CLASS: Record<string, SubclassProgressionDef[]> = {
  ...(SUBCLASS_DATA_BY_CLASS as unknown as Record<string, SubclassProgressionDef[]>)
};

// Also wire into class object subclasses
Object.entries(SUBCLASSES_BY_CLASS).forEach(([key, subs]) => {
  if (CLASS_PROGRESSIONS[key]) {
    CLASS_PROGRESSIONS[key].subclasses = subs;
  }
});

export const SPECIES_PROGRESSIONS: Record<string, SpeciesProgressionDef> = Object.fromEntries(
  (speciesData as unknown as SpeciesProgressionDef[]).map((entry) => [entry.id, entry])
);

export const BACKGROUND_PROGRESSIONS: Record<string, BackgroundProgressionDef> = Object.fromEntries(
  (backgroundsData as unknown as BackgroundProgressionDef[]).map((entry) => [entry.id, entry])
);

export const FEAT_PROGRESSIONS: Record<string, FeatProgressionDef> = Object.fromEntries(
  (featsData as unknown as FeatProgressionDef[]).map((entry) => [entry.id, entry])
);

export const ALL_SUBCLASSES: SubclassProgressionDef[] = Object.values(SUBCLASSES_BY_CLASS).flat();

export function findProgressionChoiceDomain(id: string) {
  return (choiceDomains as ProgressionChoiceDomainDef[]).find((entry) => entry.id === id) ?? null;
}

export const PROGRESSION_REGISTRY: ProgressionRegistry = {
  classes: CLASS_PROGRESSIONS,
  subclasses: Object.fromEntries(ALL_SUBCLASSES.map((sub) => [sub.id, sub])),
  species: SPECIES_PROGRESSIONS,
  backgrounds: BACKGROUND_PROGRESSIONS,
  feats: FEAT_PROGRESSIONS
};

export function findClassProgression(classNameOrId: string): ClassProgressionDef | null {
  const norm = classNameOrId.toLowerCase().replace(/[^a-z0-9]+/g, "");
  for (const [key, value] of Object.entries({ ...CLASS_PROGRESSIONS, ...COMPATIBILITY_CLASS_PROGRESSIONS })) {
    if (key === norm || value.id === classNameOrId || value.name.toLowerCase().replace(/[^a-z0-9]+/g, "") === norm) {
      return value;
    }
  }
  return null;
}

export function findBaseClassProgression(classNameOrId: string): ClassProgressionDef | null {
  const norm = classNameOrId.toLowerCase().replace(/[^a-z0-9]+/g, "");
  for (const [key, value] of Object.entries(CLASS_PROGRESSIONS)) {
    if (key === norm || value.id === classNameOrId || value.name.toLowerCase().replace(/[^a-z0-9]+/g, "") === norm) return value;
  }
  return null;
}

export function findSubclassesForClass(classNameOrId: string, allowedSources?: string[]): SubclassProgressionDef[] {
  const norm = classNameOrId.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const allSubclasses = SUBCLASSES_BY_CLASS[norm] ?? [];
  if (!allowedSources || allowedSources.length === 0 || allowedSources.includes("all")) {
    return allSubclasses;
  }
  const sourceSet = new Set(allowedSources.map((s) => s.toUpperCase()));
  return allSubclasses.filter((sub) => sourceSet.has(sub.source.toUpperCase()));
}

export function findSpeciesProgression(speciesNameOrId: string): SpeciesProgressionDef | null {
  const norm = speciesNameOrId.toLowerCase().replace(/[^a-z0-9]+/g, "");
  for (const [key, value] of Object.entries(SPECIES_PROGRESSIONS)) {
    if (key === norm || value.id === speciesNameOrId || value.name.toLowerCase().replace(/[^a-z0-9]+/g, "") === norm) {
      return value;
    }
  }
  return null;
}

export function findBackgroundProgression(backgroundNameOrId: string): BackgroundProgressionDef | null {
  const norm = backgroundNameOrId.toLowerCase().replace(/[^a-z0-9]+/g, "");
  for (const [key, value] of Object.entries(BACKGROUND_PROGRESSIONS)) {
    if (key === norm || value.id === backgroundNameOrId || value.name.toLowerCase().replace(/[^a-z0-9]+/g, "") === norm) {
      return value;
    }
  }
  return null;
}

export function findFeatProgression(featNameOrId: string): FeatProgressionDef | null {
  const norm = featNameOrId.toLowerCase().replace(/[^a-z0-9]+/g, "");
  for (const [key, value] of Object.entries(FEAT_PROGRESSIONS)) {
    if (key === norm || value.id === featNameOrId || value.name.toLowerCase().replace(/[^a-z0-9]+/g, "") === norm) {
      return value;
    }
  }
  return null;
}

export function filterProgressionBySources(allowedSources?: string[]): {
  classes: ClassProgressionDef[];
  species: SpeciesProgressionDef[];
  backgrounds: BackgroundProgressionDef[];
  feats: FeatProgressionDef[];
} {
  if (!allowedSources || allowedSources.length === 0 || allowedSources.includes("all")) {
    return {
      classes: Object.values(CLASS_PROGRESSIONS),
      species: Object.values(SPECIES_PROGRESSIONS),
      backgrounds: Object.values(BACKGROUND_PROGRESSIONS),
      feats: Object.values(FEAT_PROGRESSIONS)
    };
  }

  const sourceSet = new Set(allowedSources.map((s) => s.toUpperCase()));
  return {
    classes: Object.values(CLASS_PROGRESSIONS).filter((c) => sourceSet.has(c.source.toUpperCase())),
    species: Object.values(SPECIES_PROGRESSIONS).filter((s) => sourceSet.has(s.source.toUpperCase())),
    backgrounds: Object.values(BACKGROUND_PROGRESSIONS).filter((b) => sourceSet.has(b.source.toUpperCase())),
    feats: Object.values(FEAT_PROGRESSIONS).filter((f) => sourceSet.has(f.source.toUpperCase()))
  };
}
