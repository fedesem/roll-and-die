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
    teleporters: [],
    drawings: [],
    fogEnabled: true,
    fog: [],
    visibilityVersion: 1
  };
}

export function createClientActorDraft(kind: ActorKind, currentUserId?: string): ActorSheet {
  return {
    id: `draft_${crypto.randomUUID().slice(0, 8)}`,
    campaignId: "",
    ownerId: kind === "character" ? (currentUserId ?? "draft-owner") : undefined,
    name: kind === "static" ? "New Static Actor" : "New Actor",
    kind,
    creatureSize: "medium",
    imageUrl: "",
    className: kind === "monster" ? "Monster" : kind === "static" ? "2 x 4" : "",
    species: kind === "monster" ? "Bestiary" : kind === "static" ? "Vehicle" : "",
    background: kind === "static" ? "500 kg" : "",
    alignment: "",
    level: 1,
    challengeRating: kind === "monster" ? "1" : "",
    experience: 0,
    spellcastingAbility: "int",
    armorClass: 10,
    initiative: 0,
    initiativeRoll: null,
    speed: 30,
    proficiencyBonus: 2,
    inspiration: false,
    visionRange: 6,
    tokenWidthSquares: kind === "static" ? 2 : 1,
    tokenLengthSquares: kind === "static" ? 4 : 1,
    hitPoints: { current: 0, max: 0, temp: 0, reducedMax: 0 },
    hitDice: "",
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    skills: [
      { id: `sk_${crypto.randomUUID().slice(0, 8)}`, name: "Acrobatics", ability: "dex", proficient: false, expertise: false },
      { id: `sk_${crypto.randomUUID().slice(0, 8)}`, name: "Animal Handling", ability: "wis", proficient: false, expertise: false },
      { id: `sk_${crypto.randomUUID().slice(0, 8)}`, name: "Arcana", ability: "int", proficient: false, expertise: false },
      { id: `sk_${crypto.randomUUID().slice(0, 8)}`, name: "Athletics", ability: "str", proficient: false, expertise: false },
      { id: `sk_${crypto.randomUUID().slice(0, 8)}`, name: "Deception", ability: "cha", proficient: false, expertise: false },
      { id: `sk_${crypto.randomUUID().slice(0, 8)}`, name: "History", ability: "int", proficient: false, expertise: false },
      { id: `sk_${crypto.randomUUID().slice(0, 8)}`, name: "Insight", ability: "wis", proficient: false, expertise: false },
      { id: `sk_${crypto.randomUUID().slice(0, 8)}`, name: "Intimidation", ability: "cha", proficient: false, expertise: false },
      { id: `sk_${crypto.randomUUID().slice(0, 8)}`, name: "Investigation", ability: "int", proficient: false, expertise: false },
      { id: `sk_${crypto.randomUUID().slice(0, 8)}`, name: "Medicine", ability: "wis", proficient: false, expertise: false },
      { id: `sk_${crypto.randomUUID().slice(0, 8)}`, name: "Nature", ability: "int", proficient: false, expertise: false },
      { id: `sk_${crypto.randomUUID().slice(0, 8)}`, name: "Perception", ability: "wis", proficient: false, expertise: false },
      { id: `sk_${crypto.randomUUID().slice(0, 8)}`, name: "Performance", ability: "cha", proficient: false, expertise: false },
      { id: `sk_${crypto.randomUUID().slice(0, 8)}`, name: "Persuasion", ability: "cha", proficient: false, expertise: false },
      { id: `sk_${crypto.randomUUID().slice(0, 8)}`, name: "Religion", ability: "int", proficient: false, expertise: false },
      { id: `sk_${crypto.randomUUID().slice(0, 8)}`, name: "Sleight of Hand", ability: "dex", proficient: false, expertise: false },
      { id: `sk_${crypto.randomUUID().slice(0, 8)}`, name: "Stealth", ability: "dex", proficient: false, expertise: false },
      { id: `sk_${crypto.randomUUID().slice(0, 8)}`, name: "Survival", ability: "wis", proficient: false, expertise: false }
    ],
    classes: [],
    savingThrowProficiencies: [],
    toolProficiencies: [],
    languageProficiencies: [],
    spellSlots: Array.from({ length: 9 }, (_, index) => ({ level: index + 1, total: 0, used: 0 })),
    features: [],
    spells: [],
    preparedSpells: [],
    spellState: {
      spellbook: [],
      alwaysPrepared: [],
      atWill: [],
      perShortRest: [],
      perLongRest: []
    },
    talents: [],
    feats: [],
    bonuses: [],
    layout: [
      { sectionId: "info", column: 1, order: 0 },
      { sectionId: "abilities", column: 1, order: 1 },
      { sectionId: "skills", column: 1, order: 2 },
      { sectionId: "combat", column: 2, order: 3 },
      { sectionId: "attacks", column: 2, order: 4 },
      { sectionId: "armor", column: 2, order: 5 },
      { sectionId: "resources", column: 2, order: 6 },
      { sectionId: "spellSlots", column: 3, order: 7 },
      { sectionId: "spells", column: 3, order: 8 },
      { sectionId: "feats", column: 3, order: 9 },
      { sectionId: "traits", column: 3, order: 10 },
      { sectionId: "items", column: 2, order: 11 },
      { sectionId: "notes", column: 3, order: 12 }
    ],
    attacks: [],
    armorItems: [],
    resources: [],
    inventory: [],
    conditions: [],
    exhaustionLevel: 0,
    concentration: false,
    deathSaves: {
      successes: 0,
      failures: 0,
      history: []
    },
    currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
    notes: "",
    color: kind === "npc" ? "#d98f46" : kind === "monster" ? "#ae4a39" : kind === "static" ? "#6e8897" : "#8cae75",
    build:
      kind === "character" || kind === "npc"
        ? {
            ruleset: "dnd-2024",
            mode: "guided",
            classes: [],
            selections: []
          }
        : undefined
  };
}
