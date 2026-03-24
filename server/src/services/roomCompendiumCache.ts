import type { CompendiumData, MonsterTemplate } from "../../../shared/types.js";
import { runStoreQuery } from "../store.js";
import { readCampaignCompendium } from "../store/models/compendium.js";
type RoomCompendium = Pick<CompendiumData, "spells" | "monsters" | "feats" | "classes">;
let cachedCompendium: RoomCompendium | null = null;
let pendingCompendiumRead: Promise<RoomCompendium> | null = null;
function stripMonsterImages(monsters: MonsterTemplate[]) {
    return monsters.map((monster) => ({
        ...monster,
        imageUrl: ""
    }));
}
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
            monsters: stripMonsterImages(compendium.monsters)
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
