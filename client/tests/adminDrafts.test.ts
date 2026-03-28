import { describe, expect, it } from "vitest";

import {
  classFormToEntry,
  createClassForm,
  createMonsterForm,
  createSpellForm,
  monsterFormToEntry,
  spellFormToEntry
} from "../src/lib/adminDrafts.ts";

describe("spellFormToEntry", () => {
  it("normalizes trimmed values and derives class references", () => {
    const form = createSpellForm();
    form.name = " Fireball ";
    form.source = " PHB ";
    form.level = "3";
    form.description = "  Big explosion. ";
    form.fullDescription = " ";
    form.classesText = "Wizard, Sorcerer , Evoker ";
    form.damageNotation = " 8d6 ";
    form.damageAbility = "int";
    form.material = true;
    form.materialText = " bat guano ";
    form.materialValue = "25";

    const entry = spellFormToEntry(form);

    expect(entry).toMatchObject({
      name: "Fireball",
      source: "PHB",
      level: 3,
      description: "Big explosion.",
      fullDescription: "Big explosion.",
      damageNotation: "8d6",
      damageAbility: "int",
      classes: ["Wizard", "Sorcerer", "Evoker"],
      components: {
        material: true,
        materialText: "bat guano",
        materialValue: 25
      }
    });

    expect(entry.classReferences).toEqual([
      {
        name: "Wizard",
        source: "",
        kind: "class",
        className: "Wizard",
        classSource: "",
        definedInSources: []
      },
      {
        name: "Sorcerer",
        source: "",
        kind: "class",
        className: "Sorcerer",
        classSource: "",
        definedInSources: []
      },
      {
        name: "Evoker",
        source: "",
        kind: "class",
        className: "Evoker",
        classSource: "",
        definedInSources: []
      }
    ]);
  });
});

describe("monsterFormToEntry", () => {
  it("parses list, line, and JSON fields into the monster entry shape", () => {
    const form = createMonsterForm();
    form.name = " Owlbear ";
    form.source = " MM ";
    form.skillsText = "Perception: 4, Stealth: -1";
    form.sensesText = "darkvision: 60: keen sight, tremorsense: 10";
    form.languagesText = "Common, Elvish";
    form.traitsText = "Keen Sight\nPack Tactics";
    form.actionsJson = JSON.stringify([
      {
        name: "Claw",
        description: "Melee Weapon Attack.",
        damage: "2d8+4",
        attackType: "melee",
        attackBonus: 6,
        reachOrRange: "5 ft",
        damageType: "slashing"
      }
    ]);
    form.bonusActionsJson = "{invalid";

    const entry = monsterFormToEntry(form);

    expect(entry).toMatchObject({
      name: "Owlbear",
      source: "MM",
      languages: ["Common", "Elvish"],
      traits: ["Keen Sight", "Pack Tactics"],
      skills: [
        { name: "Perception", bonus: 4 },
        { name: "Stealth", bonus: -1 }
      ],
      senses: [
        { name: "darkvision", range: 60, notes: "keen sight" },
        { name: "tremorsense", range: 10, notes: "" }
      ],
      actions: [
        {
          name: "Claw",
          description: "Melee Weapon Attack.",
          damage: "2d8+4",
          attackType: "melee",
          attackBonus: 6,
          reachOrRange: "5 ft",
          damageType: "slashing"
        }
      ],
      bonusActions: []
    });
  });
});

describe("classFormToEntry", () => {
  it("fills missing optional feature fields and ignores invalid table JSON", () => {
    const form = createClassForm();
    form.name = " Fighter ";
    form.source = " PHB ";
    form.description = " Martial expert. ";
    form.featuresJson = JSON.stringify([
      {
        level: 1,
        name: "Second Wind",
        description: "Regain hit points."
      }
    ]);
    form.tablesJson = "{not-json";

    const entry = classFormToEntry(form);

    expect(entry).toMatchObject({
      name: "Fighter",
      source: "PHB",
      description: "Martial expert.",
      features: [
        {
          level: 1,
          name: "Second Wind",
          description: "Regain hit points.",
          source: "",
          reference: ""
        }
      ],
      tables: []
    });
  });
});
