import type { CompendiumData } from "../../../shared/types.js";
import { runStoreQuery } from "../store.js";
import { readCampaignCompendium } from "../store/models/compendium.js";
type RoomCompendium = Pick<CompendiumData, "spells" | "monsters" | "feats" | "classes" | "variantRules" | "conditions">;
let cachedCompendium: RoomCompendium | null = null;
let pendingCompendiumRead: Promise<RoomCompendium> | null = null;
export async function readRoomCompendiumCache() {
  if (cachedCompendium) {
    return cachedCompendium;
  }
  if (pendingCompendiumRead) {
    return pendingCompendiumRead;
  }
  pendingCompendiumRead = runStoreQuery(async (database) => {
    const compendium = await readCampaignCompendium(database);
    return {
      spells: compendium.spells,
      feats: compendium.feats,
      classes: compendium.classes,
      variantRules: compendium.variantRules,
      conditions: compendium.conditions,
      monsters: compendium.monsters
    } satisfies RoomCompendium;
  });
  const nextCompendium = await pendingCompendiumRead;
  cachedCompendium = nextCompendium;
  pendingCompendiumRead = null;
  return nextCompendium;
}
export function invalidateRoomCompendiumCache() {
  cachedCompendium = null;
  pendingCompendiumRead = null;
}
