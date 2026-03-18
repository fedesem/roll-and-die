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
      return JSON.stringify({
        spell: [
          {
            name: "Acid Splash",
            source: "XPHB",
            page: 241,
            level: 0,
            school: "C",
            time: [{ number: 1, unit: "action" }],
            range: { type: "point", distance: { type: "feet", amount: 60 } },
            components: { v: true, s: true },
            duration: [{ type: "instant" }],
            entries: [
              "You hurl a bubble of acid. Choose one creature you can see within range, or choose two creatures you can see within range that are within 5 feet of each other."
            ],
            entriesHigherLevel: [
              "The damage increases by {@damage 1d6} when you reach levels 5, 11, and 17."
            ],
            classes: {
              fromClassList: [
                { name: "Artificer", source: "TCE" },
                { name: "Sorcerer", source: "PHB" },
                { name: "Wizard", source: "PHB" }
              ]
            }
          }
        ]
      }, null, 2);
    case "monsters":
      return JSON.stringify(
        [
          {
            name: "Aarakocra Aeromancer",
            source: "XMM",
            page: 10,
            referenceSources: ["FRAiF"],
            size: ["M"],
            type: "elemental",
            alignment: ["N"],
            ac: [16],
            hp: {
              average: 66,
              formula: "12d8 + 12"
            },
            speed: {
              walk: 20,
              fly: 50
            },
            str: 10,
            dex: 16,
            con: 12,
            int: 13,
            wis: 17,
            cha: 12,
            save: {
              dex: "+5",
              wis: "+5"
            },
            skill: {
              arcana: "+3",
              nature: "+5",
              perception: "+7"
            },
            passive: 17,
            languages: ["Aarakocra", "Primordial (Auran)"],
            cr: "4",
            spellcasting: [
              {
                name: "Spellcasting",
                type: "spellcasting",
                headerEntries: [
                  "The aarakocra casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save {@dc 13}):"
                ],
                will: [
                  "{@spell Elementalism|XPHB}",
                  "{@spell Gust of Wind|XPHB}",
                  "{@spell Mage Hand|XPHB}",
                  "{@spell Message|XPHB}"
                ],
                daily: {
                  "1": ["{@spell Lightning Bolt|XPHB}"]
                },
                ability: "wis",
                displayAs: "action"
              }
            ],
            action: [
              {
                name: "Multiattack",
                entries: [
                  "The aarakocra makes two Wind Staff attacks, and it can use Spellcasting to cast {@spell Gust of Wind|XPHB}."
                ]
              },
              {
                name: "Wind Staff",
                entries: [
                  "{@atkr m,r} {@hit 5}, reach 5 ft. or range 120 ft. {@h}7 ({@damage 1d8 + 3}) Bludgeoning damage plus 11 ({@damage 2d10}) Lightning damage."
                ]
              }
            ],
            environment: ["mountain", "planar, air"],
            treasure: ["implements", "individual"],
            hasToken: true,
            hasFluff: true,
            hasFluffImages: true
          }
        ],
        null,
        2
      );
    case "feats":
      return JSON.stringify({
        feat: [
          {
            name: "Spell Sniper",
            source: "XPHB",
            page: 208,
            category: "G",
            prerequisite: [
              { level: 4, other: "Spellcasting or Pact Magic Feature" }
            ],
            ability: [
              {
                choose: {
                  from: ["int", "wis", "cha"],
                  amount: 1
                }
              }
            ],
            entries: [
              "You gain the following benefits.",
              {
                type: "entries",
                name: "Ability Score Increase",
                entries: [
                  "Increase your Intelligence, Wisdom, or Charisma by 1, to a maximum of 20."
                ]
              }
            ]
          }
        ]
      }, null, 2);
    case "classes":
      return JSON.stringify({
        class: [
          {
            name: "Barbarian",
            source: "XPHB",
            page: 56,
            hd: { faces: 12 },
            proficiency: ["str", "con"],
            primaryAbility: [{ str: true }],
            classFeatures: [
              [{ classFeature: "Rage|Barbarian|XPHB|1" }],
              [{ classFeature: "Danger Sense|Barbarian|XPHB|2" }]
            ],
            classTableGroups: [
              {
                title: "Barbarian Features",
                colLabels: ["Level", "Features"],
                rows: [
                  ["1", "Rage, Unarmored Defense"],
                  ["2", "Danger Sense, Reckless Attack"]
                ]
              }
            ]
          }
        ],
        classFeature: [
          {
            name: "Rage",
            className: "Barbarian",
            source: "XPHB",
            level: 1,
            entries: ["You can imbue yourself with a primal power called Rage."]
          },
          {
            name: "Danger Sense",
            className: "Barbarian",
            source: "XPHB",
            level: 2,
            entries: ["You gain an uncanny sense of when things aren't as they should be."]
          }
        ]
      }, null, 2);
  }
}
