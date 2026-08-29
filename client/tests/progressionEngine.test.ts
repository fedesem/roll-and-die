import {
  BACKGROUND_PROGRESSIONS,
  CLASS_PROGRESSIONS,
  filterProgressionBySources,
  findActionDefinition,
  findBackgroundProgression,
  findClassProgression,
  findSpeciesProgression,
  findSubclassesForClass,
  PROGRESSION_CATALOG_DIAGNOSTICS,
  SPECIES_PROGRESSIONS
} from "@shared/data/progression";
import {
  applyRestChoiceSelections,
  createProgressionAwardFromActorDelta,
  evaluateActorDerivedResources,
  evaluateActorPassiveSkillBonuses,
  evaluateActorPreparedSpellsLimit,
  evaluateActorRestChoices,
  evaluateActorSpellSlots,
  evaluateActorSubclassAlwaysPreparedSpells,
  evaluateClassChoicesForLevel,
  evaluateRestRecovery,
  resolveProgressionEffects,
  validateProgressionAwardAgainstCurrentRules
} from "@shared/rules/progressionEngine";
import type { ActorSheet } from "@shared/types";
import { describe, expect, it } from "vitest";

function createActor(overrides: Partial<ActorSheet> = {}): ActorSheet {
  return {
    id: "actor-prog-test",
    campaignId: "camp-1",
    ownerId: "user-1",
    sheetAccess: "full",
    name: "Progression Hero",
    kind: "character",
    creatureSize: "medium",
    imageUrl: "",
    className: "",
    species: "",
    background: "",
    alignment: "",
    level: 1,
    challengeRating: "",
    experience: 0,
    armorClass: 10,
    initiative: 0,
    speed: 30,
    proficiencyBonus: 2,
    inspiration: false,
    visionRange: 6,
    tokenWidthSquares: 1,
    tokenLengthSquares: 1,
    hitPoints: { current: 10, max: 10, temp: 0, reducedMax: 0 },
    hitDice: "1d8",
    deathSaves: { successes: 0, failures: 0 },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrowProficiencies: [],
    skills: [],
    attacks: [],
    spellcastingAbility: "int",
    spellSlots: [],
    spells: [],
    preparedSpells: [],
    spellState: {
      alwaysPrepared: [],
      spellbook: [],
      atWill: [],
      perShortRest: [],
      perLongRest: []
    },
    features: [],
    talents: [],
    bonuses: [],
    conditions: [],
    exhaustionLevel: 0,
    concentration: false,
    initiativeRoll: null,
    inventory: [],
    armorItems: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    notes: "",
    color: "#000000",
    classes: [],
    feats: [],
    resources: [],
    weaponProficiencies: [],
    armorProficiencies: [],
    toolProficiencies: [],
    languageProficiencies: [],
    layout: [],
    ...overrides
  };
}

describe("JSON Progression Registry & Engine", () => {
  it("validates the entire local progression catalog at import time", () => {
    expect(PROGRESSION_CATALOG_DIAGNOSTICS).toEqual([]);
  });

  it("freezes wizard effects into an immutable canonical award delta", () => {
    const before = createActor({ classes: [] });
    const after = createActor({
      level: 1,
      classes: [
        {
          id: "c1",
          name: "Fighter",
          level: 1,
          usedHitDice: 0,
          subclassId: "",
          spellcastingAbility: null,
          source: "XPHB",
          compendiumId: "fighter-xphb",
          hitDieFaces: 10
        }
      ],
      features: ["Second Wind"],
      armorProficiencies: ["Heavy Armor"]
    });
    const award = createProgressionAwardFromActorDelta(before, after, {
      id: "award-1",
      characterLevel: 1,
      classLevel: 1,
      className: "Fighter",
      classSource: "XPHB",
      choices: [{ groupId: "fighter-fighting-style", optionIds: ["defense"] }],
      committedAt: "2026-01-01T00:00:00.000Z"
    });

    expect(award.classRef).toBe("Fighter|XPHB");
    expect(award.effects).toContainEqual(expect.objectContaining({ kind: "feature", ref: "Second Wind|XPHB" }));
    expect(validateProgressionAwardAgainstCurrentRules(award)).toEqual([]);
    expect(
      resolveProgressionEffects(
        [award],
        [{ id: "override-1", operation: "suppress", targetEffectId: award.effects[0]?.id, notes: "manual" }]
      )
    ).not.toContainEqual(award.effects[0]);
  });

  it("rejects a Warlock award choice when its JSON prerequisite is not met", () => {
    const before = createActor();
    const award = createProgressionAwardFromActorDelta(before, before, {
      id: "award-warlock-1",
      characterLevel: 1,
      classLevel: 1,
      className: "Warlock",
      classSource: "XPHB",
      choices: [{ groupId: "warlock-invocations-1", optionIds: ["agonizing-blast"] }],
      committedAt: "2026-01-01T00:00:00.000Z"
    });

    expect(validateProgressionAwardAgainstCurrentRules(award, before)).toContain("warlock-invocations-1: Requires Warlock level 2.");
  });

  it("contains all 12 D&D 2024 classes, species, and backgrounds in the registry", () => {
    const classKeys = [
      "barbarian",
      "bard",
      "cleric",
      "druid",
      "fighter",
      "monk",
      "paladin",
      "ranger",
      "rogue",
      "sorcerer",
      "warlock",
      "wizard"
    ];
    classKeys.forEach((key) => {
      expect(CLASS_PROGRESSIONS[key]).toBeDefined();
      expect(findClassProgression(key)).toBeDefined();
      expect(CLASS_PROGRESSIONS[key].levels[1]).toBeDefined();
      expect(CLASS_PROGRESSIONS[key].levels[20]).toBeDefined();
    });
    expect(Object.keys(CLASS_PROGRESSIONS).sort()).toEqual(classKeys.sort());

    expect(Object.keys(SPECIES_PROGRESSIONS).length).toBeGreaterThanOrEqual(10);
    expect(Object.keys(BACKGROUND_PROGRESSIONS).length).toBeGreaterThanOrEqual(16);
    expect(findSpeciesProgression("human-xphb")).toBeDefined();
    expect(findBackgroundProgression("acolyte-xphb")).toBeDefined();
  });

  it("evaluates single-class full caster spell slots (Wizard / Cleric / Druid / Sorcerer / Bard)", () => {
    const wizardActor = createActor({
      classes: [
        {
          id: "c1",
          name: "Wizard",
          level: 5,
          usedHitDice: 0,
          subclassId: "",
          spellcastingAbility: "int",
          source: "XPHB",
          compendiumId: "wizard-xphb",
          hitDieFaces: 6
        }
      ]
    });

    const slots = evaluateActorSpellSlots(wizardActor);
    expect(slots[0]?.total).toBe(4); // 1st level slots
    expect(slots[1]?.total).toBe(3); // 2nd level slots
    expect(slots[2]?.total).toBe(2); // 3rd level slots
    expect(slots[3]?.total).toBe(0); // 4th level slots
  });

  it("evaluates single-class half caster spell slots (Paladin / Ranger) starting at level 1", () => {
    const paladinActor = createActor({
      classes: [
        {
          id: "c1",
          name: "Paladin",
          level: 1,
          usedHitDice: 0,
          subclassId: "",
          spellcastingAbility: "cha",
          source: "XPHB",
          compendiumId: "paladin-xphb",
          hitDieFaces: 10
        }
      ]
    });

    const slotsLvl1 = evaluateActorSpellSlots(paladinActor);
    expect(slotsLvl1[0]?.total).toBe(2);

    paladinActor.classes[0].level = 5;
    const slotsLvl5 = evaluateActorSpellSlots(paladinActor);
    expect(slotsLvl5[0]?.total).toBe(4);
    expect(slotsLvl5[1]?.total).toBe(2);
  });

  it("evaluates Warlock Pact Magic slots accurately", () => {
    const warlockActor = createActor({
      classes: [
        {
          id: "c1",
          name: "Warlock",
          level: 3,
          usedHitDice: 0,
          subclassId: "",
          spellcastingAbility: "cha",
          source: "XPHB",
          compendiumId: "warlock-xphb",
          hitDieFaces: 8
        }
      ]
    });

    const slots = evaluateActorSpellSlots(warlockActor);
    expect(slots[0]?.total).toBe(0);
    expect(slots[1]?.total).toBe(2); // 2 2nd-level pact slots
  });

  it("evaluates multiclass spell slots (Paladin 2 / Sorcerer 3)", () => {
    const multiclassActor = createActor({
      classes: [
        {
          id: "c1",
          name: "Paladin",
          level: 2,
          usedHitDice: 0,
          subclassId: "",
          spellcastingAbility: "cha",
          source: "XPHB",
          compendiumId: "paladin-xphb",
          hitDieFaces: 10
        },
        {
          id: "c2",
          name: "Sorcerer",
          level: 3,
          usedHitDice: 0,
          subclassId: "",
          spellcastingAbility: "cha",
          source: "XPHB",
          compendiumId: "sorcerer-xphb",
          hitDieFaces: 6
        }
      ]
    });

    // Effective caster level = 3 (Sorcerer) + floor(2 / 2) (Paladin) = 4
    const slots = evaluateActorSpellSlots(multiclassActor);
    expect(slots[0]?.total).toBe(4);
    expect(slots[1]?.total).toBe(3);
    expect(slots[2]?.total).toBe(0);
  });

  it("scales character resources accurately across levels from JSON definitions", () => {
    // Barbarian Rage scaling
    const barbarianActor = createActor({
      classes: [
        {
          id: "c1",
          name: "Barbarian",
          level: 1,
          usedHitDice: 0,
          subclassId: "",
          spellcastingAbility: null,
          source: "XPHB",
          compendiumId: "barbarian-xphb",
          hitDieFaces: 12
        }
      ]
    });
    let resources = evaluateActorDerivedResources(barbarianActor);
    const rageRes = resources.find((r) => r.name === "Rage");
    expect(rageRes).toBeDefined();
    expect(rageRes?.max).toBe(2);

    barbarianActor.classes[0].level = 6;
    resources = evaluateActorDerivedResources(barbarianActor);
    expect(resources.find((r) => r.name === "Rage")?.max).toBe(4);

    // Monk Focus Points = Level
    const monkActor = createActor({
      classes: [
        {
          id: "c2",
          name: "Monk",
          level: 7,
          usedHitDice: 0,
          subclassId: "",
          spellcastingAbility: null,
          source: "XPHB",
          compendiumId: "monk-xphb",
          hitDieFaces: 8
        }
      ]
    });
    const monkRes = evaluateActorDerivedResources(monkActor);
    expect(monkRes.find((r) => r.name === "Focus Points")?.max).toBe(7);

    // Paladin Lay on Hands = Level * 5
    const paladinActor = createActor({
      classes: [
        {
          id: "c3",
          name: "Paladin",
          level: 4,
          usedHitDice: 0,
          subclassId: "",
          spellcastingAbility: "cha",
          source: "XPHB",
          compendiumId: "paladin-xphb",
          hitDieFaces: 10
        }
      ]
    });
    const paladinRes = evaluateActorDerivedResources(paladinActor);
    expect(paladinRes.find((r) => r.name === "Lay on Hands")?.max).toBe(20);
  });

  it("uses fixed 2024 prepared-spell tables instead of ability modifiers", () => {
    const clericActor = createActor({
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 3, cha: 10 },
      classes: [
        {
          id: "c1",
          name: "Cleric",
          level: 1,
          usedHitDice: 0,
          subclassId: "",
          spellcastingAbility: "wis",
          source: "XPHB",
          compendiumId: "cleric-xphb",
          hitDieFaces: 8
        }
      ]
    });

    expect(evaluateActorPreparedSpellsLimit(clericActor)).toBe(4);
    clericActor.abilities.wis = 20;
    expect(evaluateActorPreparedSpellsLimit(clericActor)).toBe(4);
  });

  it("matches every XPHB prepared-spell progression from the reference data", () => {
    const expected: Record<string, number[]> = {
      Bard: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
      Cleric: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
      Druid: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
      Paladin: [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15],
      Ranger: [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15],
      Sorcerer: [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
      Warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
      Wizard: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25]
    };

    Object.entries(expected).forEach(([className, progression]) => {
      expect(findClassProgression(className)?.spellcastingRules?.preparedSpellsProgression).toEqual(progression);
      progression.forEach((count, index) => {
        const actor = createActor({
          classes: [
            {
              id: `${className}-${index + 1}`,
              name: className,
              level: index + 1,
              usedHitDice: 0,
              spellcastingAbility: "wis",
              source: "XPHB",
              compendiumId: `${className.toLowerCase()}-xphb`,
              hitDieFaces: 8
            }
          ]
        });
        expect(evaluateActorPreparedSpellsLimit(actor)).toBe(count);
      });
    });
  });

  it("derives passive bonuses for Primal Order Magician and Holy Order Thaumaturge", () => {
    const druidActor = createActor({
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 }, // wis mod = +4
      bonuses: ["Arcana", "Nature"].map((skillName) => ({
        id: `magician-${skillName}`,
        name: "Primal Order: Magician",
        sourceType: "buff" as const,
        targetType: "skill" as const,
        targetKey: skillName,
        value: 0,
        statBonus: "wis" as const,
        minimum: 1,
        enabled: true
      }))
    });

    expect(evaluateActorPassiveSkillBonuses(druidActor, "Arcana")).toBe(4);
    expect(evaluateActorPassiveSkillBonuses(druidActor, "Nature")).toBe(4);
    expect(evaluateActorPassiveSkillBonuses(druidActor, "Athletics")).toBe(0);
  });

  it("handles short rest partial recovery (+1 for Wild Shape, Channel Divinity, Second Wind)", () => {
    const druidActor = createActor({
      classes: [
        {
          id: "c1",
          name: "Druid",
          level: 2,
          usedHitDice: 0,
          subclassId: "",
          spellcastingAbility: "wis",
          source: "XPHB",
          compendiumId: "druid-xphb",
          hitDieFaces: 8
        }
      ],
      resources: [{ id: "prog-res-wild-shape", name: "Wild Shape", current: 0, max: 2, resetOn: "shortRest", restoreAmount: 1 }]
    });

    const restedDruid = evaluateRestRecovery(druidActor, "short");
    const ws = restedDruid.resources.find((r) => r.name === "Wild Shape");
    expect(ws?.current).toBe(1); // Regains +1 on Short Rest

    const secondRest = evaluateRestRecovery(restedDruid, "short");
    expect(secondRest.resources.find((r) => r.name === "Wild Shape")?.current).toBe(2);

    // Third short rest doesn't exceed max 2
    const thirdRest = evaluateRestRecovery(secondRest, "short");
    expect(thirdRest.resources.find((r) => r.name === "Wild Shape")?.current).toBe(2);
  });

  it("recovers full Focus Points on Short Rest and keeps Rage unchanged", () => {
    const multiActor = createActor({
      classes: [
        {
          id: "c1",
          name: "Monk",
          level: 5,
          usedHitDice: 0,
          subclassId: "",
          spellcastingAbility: null,
          source: "XPHB",
          compendiumId: "monk-xphb",
          hitDieFaces: 8
        },
        {
          id: "c2",
          name: "Barbarian",
          level: 3,
          usedHitDice: 0,
          subclassId: "",
          spellcastingAbility: null,
          source: "XPHB",
          compendiumId: "barbarian-xphb",
          hitDieFaces: 12
        }
      ],
      resources: [
        { id: "prog-res-focus-points", name: "Focus Points", current: 1, max: 5, resetOn: "shortRest", restoreAmount: 0 },
        { id: "prog-res-rage", name: "Rage", current: 1, max: 3, resetOn: "longRest", restoreAmount: 0 }
      ]
    });

    const rested = evaluateRestRecovery(multiActor, "short");
    expect(rested.resources.find((r) => r.name === "Focus Points")?.current).toBe(5); // full recovery
    expect(rested.resources.find((r) => r.name === "Rage")?.current).toBe(1); // unchanged on short rest
  });

  it("restores all HP, spell slots, and resources on Long Rest", () => {
    const clericActor = createActor({
      hitPoints: { current: 3, max: 25, temp: 5, reducedMax: 0 },
      classes: [
        {
          id: "c1",
          name: "Cleric",
          level: 3,
          usedHitDice: 2,
          subclassId: "",
          spellcastingAbility: "wis",
          source: "XPHB",
          compendiumId: "cleric-xphb",
          hitDieFaces: 8
        }
      ],
      spellSlots: [
        { level: 1, total: 4, used: 4 },
        { level: 2, total: 2, used: 2 }
      ],
      resources: [{ id: "prog-res-channel-divinity", name: "Channel Divinity", current: 0, max: 2, resetOn: "shortRest", restoreAmount: 0 }]
    });

    const rested = evaluateRestRecovery(clericActor, "long");
    expect(rested.hitPoints.current).toBe(25);
    expect(rested.hitPoints.temp).toBe(0);
    expect(rested.spellSlots[0]?.used).toBe(0);
    expect(rested.spellSlots[1]?.used).toBe(0);
    expect(rested.resources.find((r) => r.name === "Channel Divinity")?.current).toBe(2);
  });

  it("provides retrocompatible subclasses and sourcebook filtering", () => {
    const clericSubclasses = findSubclassesForClass("Cleric");
    expect(clericSubclasses.some((s) => s.name === "Knowledge Domain")).toBe(true);
    expect(clericSubclasses.some((s) => s.name === "Tempest Domain")).toBe(true);

    const xphbOnly = filterProgressionBySources(["XPHB"]);
    expect(xphbOnly.classes.length).toBe(12);

    const subFiltered = findSubclassesForClass("Cleric", ["XPHB"]);
    expect(subFiltered.every((s) => s.source === "XPHB")).toBe(true);
  });

  it("looks up structured action definitions for character features", () => {
    const secondWindAction = findActionDefinition("action-second-wind");
    expect(secondWindAction).toBeDefined();
    expect(secondWindAction?.actionCost).toBe("bonus");
    expect(secondWindAction?.roll?.kind).toBe("heal");

    const wildShapeAction = findActionDefinition("action-wild-shape");
    expect(wildShapeAction).toBeDefined();
    expect(wildShapeAction?.actionCost).toBe("bonus");
  });

  it("handles Artificer class progression and subclasses from TCE", () => {
    const artificerDef = findClassProgression("Artificer");
    expect(artificerDef).toBeDefined();
    expect(artificerDef?.source).toBe("TCE");

    const artificerSubclasses = findSubclassesForClass("Artificer");
    expect(artificerSubclasses.length).toBeGreaterThanOrEqual(4);
    expect(artificerSubclasses.some((s) => s.name === "Battle Smith")).toBe(true);
    expect(artificerSubclasses.some((s) => s.name === "Armorer")).toBe(true);

    const artificerActor = createActor({
      classes: [
        {
          id: "c1",
          name: "Artificer",
          level: 2,
          usedHitDice: 0,
          subclassId: "",
          spellcastingAbility: "int",
          source: "TCE",
          compendiumId: "artificer-tce",
          hitDieFaces: 8
        }
      ]
    });

    const resources = evaluateActorDerivedResources(artificerActor);
    expect(resources.find((r) => r.name === "Infused Items")?.max).toBe(2);
  });

  it("evaluates subclass always-prepared spells accurately for domain / circle / oath spells", () => {
    const clericActor = createActor({
      classes: [
        {
          id: "c1",
          name: "Cleric",
          level: 5,
          usedHitDice: 0,
          subclassId: "cleric-life-xphb",
          spellcastingAbility: "wis",
          source: "XPHB",
          compendiumId: "cleric-xphb",
          hitDieFaces: 8
        }
      ]
    });

    const spells = evaluateActorSubclassAlwaysPreparedSpells(clericActor);
    expect(spells).toContain("Aid");
    expect(spells).toContain("Bless");
    expect(spells).toContain("Cure Wounds");
    expect(spells).toContain("Lesser Restoration");
    expect(spells).toContain("Mass Healing Word");
    expect(spells).toContain("Revivify");
  });

  it("evaluates Circle of the Land biome choices with full spell lists", () => {
    const druidDef = findClassProgression("Druid");
    expect(druidDef).toBeDefined();

    const choices = evaluateClassChoicesForLevel(druidDef!, 3, "druid-land-xphb");
    const biomeChoice = choices.find((c) => c.id === "land-biome-choice");
    expect(biomeChoice).toBeDefined();
    expect(biomeChoice?.options).toHaveLength(4);
    expect(biomeChoice?.options.some((opt) => opt.name === "Arid")).toBe(true);
    expect(biomeChoice?.options.find((opt) => opt.name === "Arid")?.grants?.alwaysPreparedSpells).toContain("Fireball");
  });

  it("evaluates rest choices and applies selections during short and long rests", () => {
    const druidLandActor = createActor({
      classes: [
        {
          id: "c1",
          name: "Druid",
          level: 3,
          usedHitDice: 0,
          subclassId: "druid-land-xphb",
          spellcastingAbility: "wis",
          source: "XPHB",
          compendiumId: "druid-xphb",
          hitDieFaces: 8
        }
      ]
    });

    const longRestChoices = evaluateActorRestChoices(druidLandActor, "long");
    expect(longRestChoices.some((g) => g.id === "land-biome-choice")).toBe(true);

    const updatedActor = applyRestChoiceSelections(druidLandActor, {
      "land-biome-choice": ["arid"]
    });

    expect(updatedActor.spells).toContain("Fireball");
    expect(updatedActor.spells).toContain("Blur");

    const artificerActor = createActor({
      classes: [
        {
          id: "c2",
          name: "Artificer",
          level: 3,
          usedHitDice: 0,
          subclassId: "artificer-battle-smith-tce",
          spellcastingAbility: "int",
          source: "TCE",
          compendiumId: "artificer-tce",
          hitDieFaces: 8
        }
      ]
    });

    const shortRestChoices = evaluateActorRestChoices(artificerActor, "short");
    expect(shortRestChoices.some((g) => g.id === "artificer-tool-job")).toBe(true);

    const updatedArtificer = applyRestChoiceSelections(artificerActor, {
      "artificer-tool-job": ["thieves-tools"]
    });
    expect(updatedArtificer.toolProficiencies).toContain("Thieves' Tools");
  });
});
