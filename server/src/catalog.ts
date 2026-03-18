import type { MonsterActionEntry, MonsterTemplate } from "../../shared/types.js";

function action(
  name: string,
  description: string,
  damage = "",
  damageType = "",
  attackBonus = 0,
  attackType: MonsterActionEntry["attackType"] = "other",
  reachOrRange = ""
): MonsterActionEntry {
  return {
    name,
    description,
    damage,
    damageType,
    attackBonus,
    attackType,
    reachOrRange
  };
}

function starterMonster(
  monster: Omit<
    MonsterTemplate,
    | "passivePerception"
    | "speedModes"
    | "skills"
    | "senses"
    | "languages"
    | "xp"
    | "proficiencyBonus"
    | "gear"
    | "resistances"
    | "vulnerabilities"
    | "immunities"
    | "bonusActions"
    | "reactions"
    | "legendaryActions"
    | "legendaryActionsUse"
    | "lairActions"
    | "regionalEffects"
    | "habitat"
    | "treasure"
    | "imageUrl"
    | "initiative"
    | "spellcasting"
  >
): MonsterTemplate {
  const initiative = Math.floor((monster.abilities.dex - 10) / 2);
  return {
    ...monster,
    initiative,
    speedModes: {
      walk: monster.speed,
      fly: 0,
      burrow: 0,
      swim: 0,
      climb: 0
    },
    skills: [],
    senses: [],
    passivePerception: 10,
    languages: [],
    xp: 0,
    proficiencyBonus: monster.challengeRating === "10" ? 4 : 2,
    gear: [],
    resistances: [],
    vulnerabilities: [],
    immunities: [],
    bonusActions: [],
    reactions: [],
    legendaryActions: [],
    legendaryActionsUse: 0,
    lairActions: [],
    regionalEffects: [],
    habitat: "",
    treasure: "",
    imageUrl: "",
    spellcasting: []
  };
}

export const monsterCatalog: MonsterTemplate[] = [
  starterMonster({
    id: "goblin-skirmisher",
    name: "Goblin Skirmisher",
    source: "Starter Bestiary",
    challengeRating: "1/4",
    armorClass: 14,
    hitPoints: 12,
    speed: 30,
    abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    traits: ["Darkvision", "Nimble Escape"],
    actions: [
      action("Scimitar", "Melee Weapon Attack: +4 to hit.", "1d6+2", "slashing", 4, "melee", "5 ft"),
      action("Shortbow", "Ranged Weapon Attack: +4 to hit.", "1d6+2", "piercing", 4, "ranged", "80/320 ft")
    ],
    spells: [],
    color: "#7fa857"
  }),
  starterMonster({
    id: "skeleton-guard",
    name: "Skeleton Guard",
    source: "Starter Bestiary",
    challengeRating: "1/4",
    armorClass: 13,
    hitPoints: 13,
    speed: 30,
    abilities: { str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5 },
    traits: ["Undead Nature", "Vulnerable to bludgeoning"],
    actions: [
      action("Shortsword", "Melee Weapon Attack: +4 to hit.", "1d6+2", "piercing", 4, "melee", "5 ft"),
      action("Shortbow", "Ranged Weapon Attack: +4 to hit.", "1d6+2", "piercing", 4, "ranged", "80/320 ft")
    ],
    spells: [],
    color: "#cfcab9"
  }),
  starterMonster({
    id: "orc-raider",
    name: "Orc Raider",
    source: "Starter Bestiary",
    challengeRating: "1/2",
    armorClass: 13,
    hitPoints: 19,
    speed: 30,
    abilities: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 },
    traits: ["Aggressive", "Darkvision"],
    actions: [
      action("Greataxe", "Melee Weapon Attack: +5 to hit.", "1d12+3", "slashing", 5, "melee", "5 ft"),
      action("Javelin", "Ranged Weapon Attack: +5 to hit.", "1d6+3", "piercing", 5, "ranged", "30/120 ft")
    ],
    spells: [],
    color: "#b56d45"
  }),
  starterMonster({
    id: "cult-adept",
    name: "Cult Adept",
    source: "Starter Bestiary",
    challengeRating: "2",
    armorClass: 12,
    hitPoints: 33,
    speed: 30,
    abilities: { str: 9, dex: 14, con: 12, int: 13, wis: 15, cha: 11 },
    traits: ["Dark Devotion", "Spellcasting"],
    actions: [action("Dagger", "Melee Weapon Attack: +4 to hit.", "1d4+2", "piercing", 4, "melee", "5 ft")],
    spells: ["bless", "hold person", "spiritual weapon"],
    color: "#84649b"
  }),
  starterMonster({
    id: "owlbear",
    name: "Owlbear",
    source: "Starter Bestiary",
    challengeRating: "3",
    armorClass: 13,
    hitPoints: 59,
    speed: 40,
    abilities: { str: 20, dex: 12, con: 17, int: 3, wis: 12, cha: 7 },
    traits: ["Keen Sight and Smell"],
    actions: [
      action("Multiattack", "The owlbear makes one beak attack and one claws attack."),
      action("Beak", "Melee Weapon Attack: +7 to hit.", "1d10+5", "piercing", 7, "melee", "5 ft"),
      action("Claws", "Melee Weapon Attack: +7 to hit.", "2d8+5", "slashing", 7, "melee", "5 ft")
    ],
    spells: [],
    color: "#8f5b34"
  }),
  starterMonster({
    id: "young-red-dragon",
    name: "Young Red Dragon",
    source: "Starter Bestiary",
    challengeRating: "10",
    armorClass: 18,
    hitPoints: 178,
    speed: 40,
    abilities: { str: 23, dex: 10, con: 21, int: 14, wis: 11, cha: 19 },
    traits: ["Legendary Resistance", "Blindsight", "Fire Breath"],
    actions: [
      action("Multiattack", "The dragon makes three attacks: one with its bite and two with its claws."),
      action("Bite", "Melee Weapon Attack: +10 to hit.", "2d10+6", "piercing", 10, "melee", "10 ft"),
      action("Fire Breath", "The dragon exhales fire in a 30-foot cone.", "16d6", "fire", 0, "other", "30 ft cone")
    ],
    spells: [],
    color: "#cc4b35"
  })
];
