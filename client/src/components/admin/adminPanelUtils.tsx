import type { ReactNode } from "react";

import { GraduationCap, ShieldPlus, Skull, Sparkles, Users, type LucideIcon } from "lucide-react";

import { toErrorMessage } from "../../lib/errors";

export type AdminTab = "users" | "spells" | "monsters" | "feats" | "classes";
export type CompendiumTab = Exclude<AdminTab, "users">;

export interface PreviewState<T> {
  entry: T | null;
  error: string | null;
}

export const tabIcons = {
  users: Users,
  spells: Sparkles,
  monsters: Skull,
  feats: ShieldPlus,
  classes: GraduationCap
} satisfies Record<AdminTab, LucideIcon>;

export function AdminField({
  label,
  wide,
  children
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`admin-field${wide ? " admin-field-wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function filterEntries<T>(entries: T[], query: string, project: (entry: T) => string[]) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return entries;
  }

  return entries.filter((entry) => project(entry).some((value) => value.toLowerCase().includes(normalized)));
}

export function resolveSelected<T extends { id: string }>(entries: T[], selectedId: string | null) {
  return entries.find((entry) => entry.id === selectedId) ?? entries[0] ?? null;
}

export function buildPreview<T>(builder: () => T): PreviewState<T> {
  try {
    return {
      entry: builder(),
      error: null
    };
  } catch (error) {
    return {
      entry: null,
      error: toErrorMessage(error)
    };
  }
}

export function labelForTab(tab: AdminTab) {
  switch (tab) {
    case "users":
      return "Users";
    case "spells":
      return "Spells";
    case "monsters":
      return "Monsters";
    case "feats":
      return "Feats";
    case "classes":
      return "Classes";
  }
}

export function singularLabel(tab: AdminTab) {
  if (tab === "users") {
    return "User";
  }

  switch (tab) {
    case "spells":
      return "Spell";
    case "monsters":
      return "Monster";
    case "feats":
      return "Feat";
    case "classes":
      return "Class";
  }
}

export function countForTab(tab: AdminTab, counts: Record<AdminTab, number>) {
  return counts[tab];
}

export function getImportExample(tab: CompendiumTab) {
  switch (tab) {
    case "spells":
      return JSON.stringify(
        [
          {
            name: "Acid Splash",
            source: "PHB'24",
            level: "cantrip",
            school: "Evocation",
            castingTimeUnit: "action",
            castingTimeValue: 1,
            rangeType: "feet",
            rangeValue: 60,
            description: "You create an acidic bubble at a point within range.",
            components: {
              verbal: true,
              somatic: true,
              material: false,
              materialText: "",
              materialValue: 0,
              materialConsumed: false
            },
            durationUnit: "instant",
            durationValue: 0,
            concentration: false,
            damageNotation: "1d6",
            damageAbility: null,
            fullDescription: "A target in a 5-foot-radius Sphere must make a Dexterity saving throw or take Acid damage.",
            classes: ["Artificer", "Sorcerer", "Wizard"]
          }
        ],
        null,
        2
      );
    case "monsters":
      return JSON.stringify(
        [
          {
            name: "Adult Red Dragon",
            source: "MM'25",
            challengeRating: "17",
            armorClass: 19,
            hitPoints: 256,
            speed: 40,
            speedModes: { walk: 40, fly: 80, burrow: 0, swim: 0, climb: 40 },
            abilities: { str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21 },
            skills: [{ name: "Perception", bonus: 13 }, { name: "Stealth", bonus: 6 }],
            senses: [{ name: "Blindsight", range: 60, notes: "" }, { name: "Darkvision", range: 120, notes: "" }],
            passivePerception: 23,
            languages: ["Common", "Draconic"],
            xp: 18000,
            proficiencyBonus: 6,
            gear: [],
            resistances: [],
            vulnerabilities: [],
            immunities: ["Fire"],
            traits: ["Legendary Resistance (3/Day). If the dragon fails a saving throw, it can choose to succeed instead."],
            actions: [
              {
                name: "Rend",
                description: "Melee Attack Roll: +14, reach 10 ft. Hit: 13 (1d10 + 8) Slashing damage plus 5 (2d4) Fire damage.",
                damage: "1d10+8 + 2d4",
                attackType: "melee",
                attackBonus: 14,
                reachOrRange: "reach 10 ft.",
                damageType: "slashing + fire"
              }
            ],
            bonusActions: [],
            reactions: [],
            legendaryActions: [],
            legendaryActionsUse: 3,
            lairActions: [],
            regionalEffects: [],
            spells: ["Command", "Detect Magic", "Scorching Ray"],
            habitat: "Volcanic mountains",
            treasure: "Hoard",
            imageUrl: "",
            color: "#9a5546"
          }
        ],
        null,
        2
      );
    case "feats":
      return JSON.stringify(
        [
          {
            name: "Spell Sniper",
            source: "PHB'24",
            category: "General Feat",
            abilityScoreIncrease: "Increase your Intelligence, Wisdom, or Charisma by 1, to a maximum of 20.",
            prerequisites: "Level 4+; Spellcasting or Pact Magic Feature",
            description: "Your attack rolls for spells ignore Half Cover and Three-Quarters Cover, and your spell range increases by 60 feet when appropriate."
          }
        ],
        null,
        2
      );
    case "classes":
      return JSON.stringify(
        [
          {
            name: "Barbarian",
            source: "PHB'24",
            description: "A fierce warrior of primal power and relentless endurance.",
            features: [
              { level: 1, name: "Rage", description: "Enter a rage as a Bonus Action." },
              { level: 1, name: "Unarmored Defense", description: "Your AC equals 10 + Dex + Con when unarmored." }
            ],
            tables: [
              {
                name: "Barbarian Progression",
                columns: ["Level", "Proficiency Bonus", "Features", "Rages"],
                rows: [
                  ["1st", "+2", "Rage, Unarmored Defense", "2"],
                  ["2nd", "+2", "Danger Sense, Reckless Attack", "2"]
                ]
              }
            ]
          }
        ],
        null,
        2
      );
  }
}
