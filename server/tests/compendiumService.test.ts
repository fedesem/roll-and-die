import { describe, expect, it, vi } from "vitest";
import type { ClassEntry, CompendiumSpeciesEntry } from "../../shared/types.js";

import {
  importSubclassesIntoClasses,
  isSubclassImport,
  normalizeCompendiumImportEntries,
  sanitizeCompendiumEntry
} from "../src/services/compendiumService.js";

vi.mock("node:crypto", () => ({
  randomUUID: () => "compendium-id"
}));

describe("class compendium imports", () => {
  it("keeps subclass features referenced by string IDs in external 5etools class files", () => {
    const [entry] = normalizeCompendiumImportEntries("classes", {
      class: [
        {
          name: "Wizard",
          source: "XPHB",
          hd: { faces: 6 },
          proficiency: ["int", "wis"],
          classFeatures: []
        }
      ],
      subclass: [
        {
          name: "School of Abjuration",
          shortName: "Abjuration",
          source: "XPHB",
          className: "Wizard",
          classSource: "XPHB",
          subclassFeatures: ["School of Abjuration|Wizard|XPHB|Abjuration|XPHB|2", "Projected Ward|Wizard|XPHB|Abjuration|XPHB|6"]
        }
      ],
      subclassFeature: [
        {
          name: "School of Abjuration",
          className: "Wizard",
          classSource: "XPHB",
          subclassShortName: "Abjuration",
          subclassSource: "XPHB",
          level: 2,
          source: "XPHB",
          entries: ["Gain your ward."]
        },
        {
          name: "Projected Ward",
          className: "Wizard",
          classSource: "XPHB",
          subclassShortName: "Abjuration",
          subclassSource: "XPHB",
          level: 6,
          source: "XPHB",
          entries: ["Project the ward."]
        }
      ]
    });

    const classEntry = sanitizeCompendiumEntry("classes", entry) as ClassEntry;

    expect(classEntry.subclassLevel).toBe(2);
    expect(classEntry.subclasses).toHaveLength(1);
    expect(classEntry.subclasses[0]?.features.map((feature) => ({ level: feature.level, name: feature.name }))).toEqual([
      { level: 2, name: "School of Abjuration" },
      { level: 6, name: "Projected Ward" }
    ]);
  });

  it("keeps all non-PHB class import entries and skips only PHB-sourced class content", () => {
    const [entry] = normalizeCompendiumImportEntries("classes", {
      class: [
        {
          name: "Bard",
          source: "PHB",
          hd: { faces: 8 },
          proficiency: ["dex", "cha"],
          classFeatures: []
        },
        {
          name: "Bard",
          source: "XPHB",
          edition: "one",
          hd: { faces: 8 },
          proficiency: ["dex", "cha"],
          classFeatures: []
        }
      ],
      subclass: [
        {
          name: "College of Lore",
          shortName: "Lore",
          source: "PHB",
          className: "Bard",
          classSource: "PHB",
          subclassFeatures: ["College of Lore|Bard|PHB|3"]
        },
        {
          name: "College of Lore",
          shortName: "Lore",
          source: "PHB",
          className: "Bard",
          classSource: "XPHB",
          subclassFeatures: ["College of Lore|Bard|XPHB|Lore|PHB|3", "Cutting Words|Bard|XPHB|Lore|PHB|3"]
        },
        {
          name: "College of Swords",
          shortName: "Swords",
          source: "XGE",
          className: "Bard",
          classSource: "PHB",
          subclassFeatures: ["College of Swords|Bard|PHB|Swords|XGE|3"]
        },
        {
          name: "College of Swords",
          shortName: "Swords",
          source: "XGE",
          className: "Bard",
          classSource: "XPHB",
          subclassFeatures: ["College of Swords|Bard|XPHB|Swords|XGE|3"]
        }
      ],
      subclassFeature: [
        {
          name: "College of Lore",
          className: "Bard",
          classSource: "PHB",
          subclassShortName: "Lore",
          subclassSource: "PHB",
          level: 3,
          source: "PHB",
          entries: ["Legacy lore."]
        },
        {
          name: "College of Lore",
          className: "Bard",
          classSource: "XPHB",
          subclassShortName: "Lore",
          subclassSource: "PHB",
          level: 3,
          source: "PHB",
          entries: ["Modern lore."]
        },
        {
          name: "Cutting Words",
          className: "Bard",
          classSource: "XPHB",
          subclassShortName: "Lore",
          subclassSource: "PHB",
          level: 3,
          source: "PHB",
          entries: ["Modern cutting words."]
        },
        {
          name: "College of Swords",
          className: "Bard",
          classSource: "PHB",
          subclassShortName: "Swords",
          subclassSource: "XGE",
          level: 3,
          source: "XGE",
          entries: ["Legacy swords."]
        },
        {
          name: "College of Swords",
          className: "Bard",
          classSource: "XPHB",
          subclassShortName: "Swords",
          subclassSource: "XGE",
          level: 3,
          source: "XGE",
          entries: ["Modern swords."]
        }
      ]
    });

    const classEntry = sanitizeCompendiumEntry("classes", entry) as ClassEntry;

    expect(classEntry.source).toBe("XPHB");
    expect(classEntry.subclasses.map((subclass) => subclass.name)).toEqual(["College of Swords"]);
    expect(classEntry.subclasses[0]?.features.map((feature) => feature.name)).toEqual(["College of Swords"]);
  });

  it("keeps non-PHB subclasses when only a PHB class-source variant exists", () => {
    const [entry] = normalizeCompendiumImportEntries("classes", {
      class: [
        {
          name: "Warlock",
          source: "PHB",
          hd: { faces: 8 },
          proficiency: ["wis", "cha"],
          classFeatures: []
        },
        {
          name: "Warlock",
          source: "XPHB",
          edition: "one",
          hd: { faces: 8 },
          proficiency: ["wis", "cha"],
          classFeatures: []
        }
      ],
      subclass: [
        {
          name: "The Hexblade",
          shortName: "Hexblade",
          source: "XGE",
          className: "Warlock",
          classSource: "PHB",
          subclassFeatures: ["The Hexblade|Warlock||Hexblade|XGE|3"]
        }
      ],
      subclassFeature: [
        {
          name: "The Hexblade",
          className: "Warlock",
          classSource: "PHB",
          subclassShortName: "Hexblade",
          subclassSource: "XGE",
          level: 3,
          source: "XGE",
          entries: ["Hexblade feature."]
        }
      ]
    });

    const classEntry = sanitizeCompendiumEntry("classes", entry) as ClassEntry;

    expect(classEntry.source).toBe("XPHB");
    expect(classEntry.subclasses.map((subclass) => `${subclass.name}|${subclass.source}`)).toEqual(["The Hexblade|XGE"]);
    expect(classEntry.subclasses[0]?.features.map((feature) => ({ level: feature.level, name: feature.name }))).toEqual([
      { level: 3, name: "The Hexblade" }
    ]);
  });

  it("resolves copied subclass features and prefers the matching class-source variant", () => {
    const [entry] = normalizeCompendiumImportEntries("classes", {
      class: [
        {
          name: "Warlock",
          source: "XPHB",
          edition: "one",
          hd: { faces: 8 },
          proficiency: ["wis", "cha"],
          classFeatures: []
        }
      ],
      subclass: [
        {
          name: "The Celestial",
          shortName: "Celestial",
          source: "XGE",
          className: "Warlock",
          classSource: "XPHB",
          _copy: {
            name: "The Celestial",
            shortName: "Celestial",
            source: "XGE",
            className: "Warlock",
            classSource: "PHB"
          },
          subclassFeatures: ["The Celestial|Warlock|XPHB|Celestial|XGE|3", "Radiant Soul|Warlock||Celestial|XGE|6"]
        }
      ],
      subclassFeature: [
        {
          name: "The Celestial",
          className: "Warlock",
          classSource: "PHB",
          subclassShortName: "Celestial",
          subclassSource: "XGE",
          level: 1,
          source: "XGE",
          entries: ["Legacy celestial feature."]
        },
        {
          name: "The Celestial",
          className: "Warlock",
          classSource: "XPHB",
          subclassShortName: "Celestial",
          subclassSource: "XGE",
          level: 3,
          source: "XGE",
          _copy: {
            name: "The Celestial",
            className: "Warlock",
            classSource: "PHB",
            subclassShortName: "Celestial",
            subclassSource: "XGE",
            level: 1,
            source: "XGE"
          }
        },
        {
          name: "Radiant Soul",
          className: "Warlock",
          classSource: "PHB",
          subclassShortName: "Celestial",
          subclassSource: "XGE",
          level: 6,
          source: "XGE",
          entries: ["Legacy radiant soul."]
        },
        {
          name: "Radiant Soul",
          className: "Warlock",
          classSource: "XPHB",
          subclassShortName: "Celestial",
          subclassSource: "XGE",
          level: 6,
          source: "XGE",
          entries: ["Modern radiant soul."]
        }
      ]
    });

    const classEntry = sanitizeCompendiumEntry("classes", entry) as ClassEntry;

    expect(classEntry.subclasses).toHaveLength(1);
    expect(
      classEntry.subclasses[0]?.features.map((feature) => ({
        level: feature.level,
        name: feature.name,
        description: feature.description
      }))
    ).toEqual([
      {
        level: 3,
        name: "The Celestial",
        description: "Legacy celestial feature."
      },
      {
        level: 6,
        name: "Radiant Soul",
        description: "Modern radiant soul."
      }
    ]);
  });

  it("expands referenced child features inside the first subclass feature description", () => {
    const [entry] = normalizeCompendiumImportEntries("classes", {
      class: [
        {
          name: "Warlock",
          source: "XPHB",
          edition: "one",
          hd: { faces: 8 },
          proficiency: ["wis", "cha"],
          classFeatures: []
        }
      ],
      subclass: [
        {
          name: "The Celestial",
          shortName: "Celestial",
          source: "XGE",
          className: "Warlock",
          classSource: "XPHB",
          subclassFeatures: ["The Celestial|Warlock|XPHB|Celestial|XGE|3"]
        }
      ],
      subclassFeature: [
        {
          name: "The Celestial",
          className: "Warlock",
          classSource: "XPHB",
          subclassShortName: "Celestial",
          subclassSource: "XGE",
          level: 3,
          source: "XGE",
          entries: [
            "Your patron is a celestial being.",
            {
              type: "entries",
              name: "Expanded Spell List",
              entries: [
                {
                  type: "table",
                  caption: "Celestial Expanded Spells",
                  colLabels: ["Spell Level", "Spells"],
                  rows: [["1st", "{@spell cure wounds}, {@spell guiding bolt}"]]
                }
              ]
            },
            {
              type: "refSubclassFeature",
              subclassFeature: "Healing Light|Warlock|XPHB|Celestial|XGE|3"
            }
          ]
        },
        {
          name: "Healing Light",
          className: "Warlock",
          classSource: "XPHB",
          subclassShortName: "Celestial",
          subclassSource: "XGE",
          level: 3,
          source: "XGE",
          entries: ["You can heal creatures with celestial energy."]
        }
      ]
    });

    const classEntry = sanitizeCompendiumEntry("classes", entry) as ClassEntry;
    const description = classEntry.subclasses[0]?.features[0]?.description ?? "";

    expect(description).toContain("Expanded Spell List");
    expect(description).toContain("Celestial Expanded Spells");
    expect(description).toContain("Spell Level: 1st; Spells: {@spell cure wounds}, {@spell guiding bolt}");
    expect(description).toContain("Healing Light");
    expect(description).toContain("You can heal creatures with celestial energy.");
  });

  it("imports class starting equipment packages from raw compendium data", () => {
    const classEntry = sanitizeCompendiumEntry("classes", {
      name: "Fighter",
      source: "XPHB",
      hd: { faces: 10 },
      proficiency: ["str", "con"],
      classFeatures: [],
      startingEquipment: {
        additionalFromBackground: true,
        defaultData: [
          {
            A: [
              { item: "chain mail|xphb" },
              { item: "greatsword|xphb" },
              { item: "flail|xphb" },
              { item: "javelin|xphb", quantity: 8 },
              { item: "dungeoneer's pack|xphb" },
              { value: 400 }
            ],
            B: [{ value: 15500 }]
          }
        ]
      }
    }) as ClassEntry;

    expect(classEntry.startingEquipment).toHaveLength(1);
    expect(classEntry.startingEquipment[0]?.options.map((option) => option.label)).toEqual(["Option A", "Option B"]);
    expect(classEntry.startingEquipment[0]?.options[0]?.items.map((item) => item.name)).toEqual([
      "chain mail",
      "greatsword",
      "flail",
      "javelin",
      "dungeoneer's pack",
      "4 GP"
    ]);
    expect(classEntry.startingEquipment[0]?.options[1]?.items[0]?.currency).toEqual({ gp: 155 });
  });
});

describe("reference compendium imports", () => {

  it("normalizes backgrounds and skips PHB backgrounds when source is PHB", () => {
    const entries = normalizeCompendiumImportEntries("backgrounds", {
      background: [
        {
          name: "Acolyte",
          source: "PHB",
          page: 127,
          entries: ["Classic background."]
        },
        {
          name: "Acolyte",
          source: "XPHB",
          page: 176,
          entries: ["Modern background."]
        },
        {
          name: "Rewarded",
          source: "XGE",
          page: 10,
          entries: ["Supplement background."]
        }
      ]
    });

    expect((entries as { name: string; source: string }[]).map((entry) => `${String(entry.name)}|${String(entry.source)}`)).toEqual(["Acolyte|XPHB", "Rewarded|XGE"]);
  });

  it("skips PHB backgrounds when source is PHB", () => {
    const entries = normalizeCompendiumImportEntries("backgrounds", {
      background: [
        {
          name: "Acolyte",
          source: "PHB",
          page: 127,
          entries: ["Legacy background."]
        },
        {
          name: "Acolyte",
          source: "XPHB",
          edition: "one",
          page: 178,
          entries: ["Modern background."]
        },
        {
          name: "Rewarded",
          source: "XGE",
          page: 10,
          entries: ["Supplement background."]
        }
      ]
    });

    expect((entries as { name: string; source: string }[]).map((entry) => `${String(entry.name)}|${String(entry.source)}`)).toEqual(["Acolyte|XPHB", "Rewarded|XGE"]);
  });

  it("skips PHB books based on book id", () => {
    const entries = normalizeCompendiumImportEntries("books", {
      book: [
        {
          id: "PHB",
          name: "Player's Handbook (2014)"
        },
        {
          id: "XPHB",
          name: "Player's Handbook (2024)"
        }
      ]
    });

    expect((entries as { id: string; name: string }[]).map((entry) => `${String(entry.id)}|${String(entry.name)}`)).toEqual(["XPHB|Player's Handbook (2024)"]);
  });

  it("derives table-based species choice groups and base species spells from raw race entries", () => {
    const species = sanitizeCompendiumEntry("races", {
      name: "Tiefling",
      source: "XPHB",
      size: ["M"],
      speed: 30,
      darkvision: 60,
      creatureTypes: ["humanoid"],
      languageProficiencies: [{ common: true, infernal: true }],
      entries: [
        {
          type: "entries",
          name: "Fiendish Legacy",
          entries: [
            "Choose a legacy from the Fiendish Legacies table.",
            "Intelligence, Wisdom, or Charisma is your spellcasting ability for the spells you cast with this trait (choose the ability when you select the legacy).",
            {
              type: "table",
              caption: "Fiendish Legacies",
              colLabels: ["Legacy", "Level 1", "Level 3", "Level 5"],
              rows: [
                [
                  "Abyssal",
                  "You have resistance to Poison damage. You also know the {@spell Poison Spray|XPHB} cantrip.",
                  "{@spell Ray of Sickness|XPHB}",
                  "{@spell Hold Person|XPHB}"
                ]
              ]
            }
          ]
        },
        {
          type: "entries",
          name: "Otherworldly Presence",
          entries: ["You know the {@spell Thaumaturgy|XPHB} cantrip."]
        }
      ]
    }) as CompendiumSpeciesEntry;

    expect(species.choiceGroups.map((group) => group.label)).toEqual(["Fiendish Legacy", "Legacy Spellcasting Ability"]);
    expect(species.choiceGroups[0]?.options[0]).toMatchObject({
      label: "Abyssal",
      spellNames: ["Poison Spray"],
      alwaysPreparedSpellNames: ["Ray of Sickness", "Hold Person"]
    });
    expect(species.spellNames).toEqual(["Thaumaturgy"]);
  });

  it("derives list-based species choice groups from raw race entries", () => {
    const species = sanitizeCompendiumEntry("races", {
      name: "Gnome",
      source: "XPHB",
      size: ["S"],
      speed: 30,
      darkvision: 60,
      creatureTypes: ["humanoid"],
      languageProficiencies: [{ common: true, gnomish: true }],
      entries: [
        {
          type: "entries",
          name: "Gnomish Lineage",
          entries: [
            "Choose one of the following options; whichever one you choose, Intelligence, Wisdom, or Charisma is your spellcasting ability for the spells you cast with this trait.",
            {
              type: "list",
              style: "list-hang-notitle",
              items: [
                {
                  type: "item",
                  name: "Forest Gnome",
                  entries: [
                    "You know the {@spell Minor Illusion|XPHB} cantrip. You also always have the {@spell Speak with Animals|XPHB} spell prepared."
                  ]
                },
                {
                  type: "item",
                  name: "Rock Gnome",
                  entries: ["You know the {@spell Mending|XPHB} and {@spell Prestidigitation|XPHB} cantrips."]
                }
              ]
            }
          ]
        }
      ]
    }) as CompendiumSpeciesEntry;

    expect(species.choiceGroups.map((group) => group.label)).toEqual(["Gnomish Lineage", "Lineage Spellcasting Ability"]);
    expect(species.choiceGroups[0]?.options.map((option) => option.label)).toEqual(["Forest Gnome", "Rock Gnome"]);
    expect(species.choiceGroups[0]?.options[0]).toMatchObject({
      spellNames: ["Minor Illusion"],
      alwaysPreparedSpellNames: ["Speak with Animals"]
    });
  });

  it("imports standalone 5etools subclass files directly into existing classes", () => {
    const rawSubclassFile = {
      subclass: [
        {
          name: "Oath of Conquest",
          shortName: "Conquest",
          source: "XGE",
          className: "Paladin",
          classSource: "PHB",
          subclassFeatures: ["Oath of Conquest|Paladin|PHB|Conquest|XGE|3"]
        }
      ],
      subclassFeature: [
        {
          name: "Oath of Conquest",
          className: "Paladin",
          classSource: "PHB",
          subclassShortName: "Conquest",
          subclassSource: "XGE",
          level: 3,
          source: "XGE",
          entries: ["Conquer all enemies."]
        }
      ]
    };

    expect(isSubclassImport(rawSubclassFile)).toBe(true);

    const classes: ClassEntry[] = [
      {
        id: "paladin-1",
        name: "Paladin",
        source: "XPHB",
        description: "",
        hitDieFaces: 10,
        primaryAbilities: ["str", "cha"],
        savingThrowProficiencies: ["wis", "cha"],
        startingProficiencies: { armor: [], weapons: [], tools: [] },
        spellcastingAbility: "cha",
        spellPreparation: "prepared",
        subclassLevel: 3,
        subclasses: [],
        features: [],
        tables: [],
        startingEquipment: []
      }
    ];

    const result = importSubclassesIntoClasses(classes, rawSubclassFile);
    expect(result.imported).toBe(1);
    expect(classes[0]?.subclasses).toHaveLength(1);
    expect(classes[0]?.subclasses[0]?.name).toBe("Oath of Conquest");
    expect(classes[0]?.subclasses[0]?.source).toBe("XGE");
    expect(classes[0]?.subclasses[0]?.features[0]?.name).toBe("Oath of Conquest");
  });
});
