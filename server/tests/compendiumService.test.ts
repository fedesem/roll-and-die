import { describe, expect, it, vi } from "vitest";

import { normalizeCompendiumImportEntries, sanitizeCompendiumEntry } from "../src/services/compendiumService.js";

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

    const classEntry = sanitizeCompendiumEntry("classes", entry);

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

    const classEntry = sanitizeCompendiumEntry("classes", entry);

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

    const classEntry = sanitizeCompendiumEntry("classes", entry);

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

    const classEntry = sanitizeCompendiumEntry("classes", entry);

    expect(classEntry.subclasses).toHaveLength(1);
    expect(classEntry.subclasses[0]?.features.map((feature) => ({
      level: feature.level,
      name: feature.name,
      description: feature.description
    }))).toEqual([
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

    const classEntry = sanitizeCompendiumEntry("classes", entry);
    const description = classEntry.subclasses[0]?.features[0]?.description ?? "";

    expect(description).toContain("Expanded Spell List");
    expect(description).toContain("Celestial Expanded Spells");
    expect(description).toContain("Spell Level: 1st; Spells: {@spell cure wounds}, {@spell guiding bolt}");
    expect(description).toContain("Healing Light");
    expect(description).toContain("You can heal creatures with celestial energy.");
  });
});

describe("reference compendium imports", () => {
  it("skips PHB 2014 entries while keeping newer rules content", () => {
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

    expect(entries.map((entry) => `${String(entry.name)}|${String(entry.source)}`)).toEqual(["Acolyte|XPHB", "Rewarded|XGE"]);
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

    expect(entries.map((entry) => `${String(entry.id)}|${String(entry.name)}`)).toEqual(["XPHB|Player's Handbook (2024)"]);
  });
});
