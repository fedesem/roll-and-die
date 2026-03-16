import type { MonsterTemplate } from "../../shared/types.js";

export const monsterCatalog: MonsterTemplate[] = [
  {
    id: "goblin-skirmisher",
    name: "Goblin Skirmisher",
    source: "Starter Bestiary",
    challengeRating: "1/4",
    armorClass: 14,
    hitPoints: 12,
    speed: 30,
    abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    traits: ["Darkvision", "Nimble Escape"],
    actions: ["Scimitar +4 to hit, 1d6+2 slashing", "Shortbow +4 to hit, 1d6+2 piercing"],
    spells: [],
    color: "#7fa857"
  },
  {
    id: "skeleton-guard",
    name: "Skeleton Guard",
    source: "Starter Bestiary",
    challengeRating: "1/4",
    armorClass: 13,
    hitPoints: 13,
    speed: 30,
    abilities: { str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5 },
    traits: ["Undead Nature", "Vulnerable to bludgeoning"],
    actions: ["Shortsword +4 to hit, 1d6+2 piercing", "Shortbow +4 to hit, 1d6+2 piercing"],
    spells: [],
    color: "#cfcab9"
  },
  {
    id: "orc-raider",
    name: "Orc Raider",
    source: "Starter Bestiary",
    challengeRating: "1/2",
    armorClass: 13,
    hitPoints: 19,
    speed: 30,
    abilities: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 },
    traits: ["Aggressive", "Darkvision"],
    actions: ["Greataxe +5 to hit, 1d12+3 slashing", "Javelin +5 to hit, 1d6+3 piercing"],
    spells: [],
    color: "#b56d45"
  },
  {
    id: "cult-adept",
    name: "Cult Adept",
    source: "Starter Bestiary",
    challengeRating: "2",
    armorClass: 12,
    hitPoints: 33,
    speed: 30,
    abilities: { str: 9, dex: 14, con: 12, int: 13, wis: 15, cha: 11 },
    traits: ["Dark Devotion", "Spellcasting"],
    actions: ["Dagger +4 to hit, 1d4+2 piercing"],
    spells: ["bless", "hold person", "spiritual weapon"],
    color: "#84649b"
  },
  {
    id: "owlbear",
    name: "Owlbear",
    source: "Starter Bestiary",
    challengeRating: "3",
    armorClass: 13,
    hitPoints: 59,
    speed: 40,
    abilities: { str: 20, dex: 12, con: 17, int: 3, wis: 12, cha: 7 },
    traits: ["Keen Sight and Smell"],
    actions: ["Multiattack", "Beak +7 to hit, 1d10+5 piercing", "Claws +7 to hit, 2d8+5 slashing"],
    spells: [],
    color: "#8f5b34"
  },
  {
    id: "young-red-dragon",
    name: "Young Red Dragon",
    source: "Starter Bestiary",
    challengeRating: "10",
    armorClass: 18,
    hitPoints: 178,
    speed: 40,
    abilities: { str: 23, dex: 10, con: 21, int: 14, wis: 11, cha: 19 },
    traits: ["Legendary Resistance", "Blindsight", "Fire Breath"],
    actions: ["Multiattack", "Bite +10 to hit, 2d10+6 piercing + 2d6 fire", "Fire Breath 30 ft cone, 16d6 fire"],
    spells: [],
    color: "#cc4b35"
  }
];

