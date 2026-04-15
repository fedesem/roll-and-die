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
