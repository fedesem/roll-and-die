import type { ActorKind, ActorSheet, CampaignMap } from "@shared/types";

export function cloneMap(map: CampaignMap) {
  return JSON.parse(JSON.stringify(map)) as CampaignMap;
}

export function formatMonsterModifier(score: number) {
  const modifier = Math.floor((score - 10) / 2);
  return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}

export function createClientMapDraft(name = "Encounter Map"): CampaignMap {
  return {
    id: `draft_${crypto.randomUUID().slice(0, 8)}`,
    name,
    backgroundUrl: "",
    backgroundOffsetX: 0,
    backgroundOffsetY: 0,
    backgroundScale: 1,
    width: 1600,
    height: 1200,
    grid: {
      show: true,
      cellSize: 70,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      color: "rgba(220, 182, 92, 0.5)"
    },
    walls: [],
    drawings: [],
    fog: [],
    visibilityVersion: 1
  };
}

export function createClientActorDraft(kind: ActorKind, currentUserId?: string): ActorSheet {
  return {
    id: `draft_${crypto.randomUUID().slice(0, 8)}`,
    campaignId: "",
    ownerId: kind === "character" ? currentUserId ?? "draft-owner" : undefined,
    name: kind === "static" ? "New Static Actor" : "New Actor",
    kind,
    className:
      kind === "npc"
        ? "Supporting Role"
        : kind === "monster"
          ? "Monster"
          : kind === "static"
            ? "2 x 4"
            : "Adventurer",
    species: kind === "monster" ? "Bestiary" : kind === "static" ? "Vehicle" : "Human",
    background: kind === "monster" ? "" : kind === "static" ? "500 kg" : "Wayfarer",
    alignment: "Neutral",
    level: 1,
    challengeRating: kind === "monster" ? "1" : "",
    experience: 0,
    spellcastingAbility: "wis",
    armorClass: 14,
    initiative: 2,
    speed: 30,
    proficiencyBonus: 2,
    inspiration: false,
    visionRange: 6,
    hitPoints: { current: 12, max: 12, temp: 0 },
    hitDice: "1d8",
    abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 12, cha: 10 },
    skills: [
      { id: `sk_${crypto.randomUUID().slice(0, 8)}`, name: "Acrobatics", ability: "dex", proficient: false, expertise: false },
      { id: `sk_${crypto.randomUUID().slice(0, 8)}`, name: "Perception", ability: "wis", proficient: true, expertise: false },
      { id: `sk_${crypto.randomUUID().slice(0, 8)}`, name: "Stealth", ability: "dex", proficient: false, expertise: false }
    ],
    spellSlots: Array.from({ length: 9 }, (_, index) => ({ level: index + 1, total: 0, used: 0 })),
    features: ["Second Wind"],
    spells: ["Guidance"],
    talents: ["Perception"],
    feats: ["Lucky"],
    attacks: [
      {
        id: `atk_${crypto.randomUUID().slice(0, 8)}`,
        name: "Quarterstaff",
        attackBonus: 4,
        damage: "1d6+2",
        damageType: "Bludgeoning",
        notes: ""
      }
    ],
    armorItems: [
      {
        id: `arm_${crypto.randomUUID().slice(0, 8)}`,
        name: "Leather Armor",
        armorClass: 11,
        notes: ""
      }
    ],
    resources: [
      {
        id: `res_${crypto.randomUUID().slice(0, 8)}`,
        name: "Second Wind",
        current: 1,
        max: 1,
        resetOn: "Short Rest"
      }
    ],
    inventory: [
      { id: `inv_${crypto.randomUUID().slice(0, 8)}`, name: "Bedroll", quantity: 1 },
      { id: `inv_${crypto.randomUUID().slice(0, 8)}`, name: "Torch", quantity: 5 }
    ],
    currency: { pp: 0, gp: 15, ep: 0, sp: 5, cp: 12 },
    notes: "",
    color:
      kind === "npc"
        ? "#d98f46"
        : kind === "monster"
          ? "#ae4a39"
          : kind === "static"
            ? "#6e8897"
            : "#8cae75"
  };
}
