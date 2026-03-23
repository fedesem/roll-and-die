import type { ReactNode } from "react";

import { BookText, GraduationCap, ShieldPlus, Skull, Sparkles, Swords, Users, type LucideIcon } from "lucide-react";

import { toErrorMessage } from "../../lib/errors";

export type AdminTab =
  | "users"
  | "spells"
  | "monsters"
  | "feats"
  | "classes"
  | "books"
  | "optionalFeatures"
  | "actions"
  | "backgrounds"
  | "items"
  | "languages"
  | "races"
  | "skills";
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
  classes: GraduationCap,
  books: BookText,
  optionalFeatures: BookText,
  actions: Swords,
  backgrounds: BookText,
  items: BookText,
  languages: BookText,
  races: BookText,
  skills: BookText
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
    case "books":
      return "Books";
    case "optionalFeatures":
      return "Optional Features";
    case "actions":
      return "Actions";
    case "backgrounds":
      return "Backgrounds";
    case "items":
      return "Items";
    case "languages":
      return "Languages";
    case "races":
      return "Races";
    case "skills":
      return "Skills";
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
    case "books":
      return "Book";
    case "optionalFeatures":
      return "Optional Feature";
    case "actions":
      return "Action";
    case "backgrounds":
      return "Background";
    case "items":
      return "Item";
    case "languages":
      return "Language";
    case "races":
      return "Race";
    case "skills":
      return "Skill";
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
    case "books":
      return JSON.stringify({
        book: [
          {
            name: "Player's Handbook (2014)",
            id: "PHB",
            group: "core",
            published: "2014-08-19",
            author: "Wizards RPG Team"
          }
        ]
      }, null, 2);
    case "optionalFeatures":
      return JSON.stringify({
        optionalfeature: [
          {
            name: "Agonizing Blast",
            source: "XPHB",
            page: 155,
            featureType: ["EI"],
            prerequisite: [
              {
                level: {
                  level: 2,
                  class: {
                    name: "Warlock",
                    source: "XPHB"
                  }
                }
              }
            ],
            entries: [
              "Choose one of your known warlock cantrips that deals damage. You can add your Charisma modifier to that spell's damage rolls."
            ]
          }
        ]
      }, null, 2);
    case "actions":
      return JSON.stringify({
        action: [
          {
            name: "Disengage",
            source: "PHB",
            page: 192,
            time: [{ number: 1, unit: "action" }],
            entries: ["If you take the Disengage action, your movement doesn't provoke opportunity attacks for the rest of the turn."]
          }
        ]
      }, null, 2);
    case "backgrounds":
      return JSON.stringify({
        background: [
          {
            name: "Acolyte",
            source: "PHB",
            page: 127,
            entries: ["You have spent your life in the service of a temple."],
            skillProficiencies: [{ insight: true, religion: true }]
          }
        ]
      }, null, 2);
    case "items":
      return JSON.stringify({
        item: [
          {
            name: "Alchemy Jug",
            source: "DMG",
            page: 150,
            type: "W",
            rarity: "uncommon",
            entries: ["This ceramic jug appears to be able to hold a gallon of liquid and weighs 12 pounds whether full or empty."]
          }
        ]
      }, null, 2);
    case "languages":
      return JSON.stringify({
        language: [
          {
            name: "Abyssal",
            source: "PHB",
            page: 123,
            type: "exotic",
            script: "Infernal",
            typicalSpeakers: ["Demons"]
          }
        ]
      }, null, 2);
    case "races":
      return JSON.stringify({
        race: [
          {
            name: "Aarakocra",
            source: "DMG",
            page: 282,
            size: ["M"],
            entries: ["You can speak, read, and write Auran."]
          }
        ]
      }, null, 2);
    case "skills":
      return JSON.stringify({
        skill: [
          {
            name: "Arcana",
            source: "PHB",
            page: 177,
            ability: "int",
            entries: ["Your Intelligence (Arcana) check measures your ability to recall lore about spells and magic items."]
          }
        ]
      }, null, 2);
  }
}
