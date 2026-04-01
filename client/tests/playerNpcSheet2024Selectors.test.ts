import { describe, expect, it } from "vitest";

import type {
  ActorClassEntry,
  ActorSheet,
  CampaignSnapshot,
  ClassEntry,
  CompendiumBackgroundEntry,
  CompendiumOptionalFeatureEntry,
  CompendiumSpeciesEntry,
  FeatEntry,
  SpellEntry
} from "@shared/types";

import {
  applyBackgroundToActor,
  applyClassToActor,
  applyGuideSelectionsToActor,
  applySpeciesChoiceSelections,
  applySpeciesToActor
} from "../src/features/sheet/selectors/playerNpcSheet2024Mutations";
import {
  deriveGuidedHitPointMax,
  derivePreparedSpellLimit,
  deriveSpellSlots,
  healHitPoints,
  mergeDerivedResources,
  normalizeHitPoints,
  syncBuildClasses
} from "../src/features/sheet/selectors/playerNpcSheet2024Selectors";

function createActor(overrides: Partial<ActorSheet> = {}): ActorSheet {
  return {
    id: "actor-1",
    campaignId: "campaign-1",
    ownerId: "user-1",
    sheetAccess: "full",
    name: "Aria",
    kind: "character",
    creatureSize: "medium",
    imageUrl: "",
    className: "",
    species: "",
    background: "",
    alignment: "",
    level: 0,
    challengeRating: "",
    experience: 0,
    spellcastingAbility: "int",
    armorClass: 10,
    initiative: 0,
    initiativeRoll: null,
    speed: 30,
    proficiencyBonus: 2,
    inspiration: false,
    visionRange: 0,
    tokenWidthSquares: 1,
    tokenLengthSquares: 1,
    hitPoints: {
      current: 0,
      max: 0,
      temp: 0,
      reducedMax: 0
    },
    hitDice: "",
    abilities: {
      str: 10,
      dex: 12,
      con: 14,
      int: 16,
      wis: 16,
      cha: 10
    },
    skills: [
      { id: "skill-arcana", name: "Arcana", ability: "int", proficient: false, expertise: false },
      { id: "skill-history", name: "History", ability: "int", proficient: false, expertise: false },
      { id: "skill-perception", name: "Perception", ability: "wis", proficient: false, expertise: false }
    ],
    classes: [],
    savingThrowProficiencies: [],
    toolProficiencies: [],
    languageProficiencies: [],
    spellSlots: [],
    features: [],
    spells: [],
    preparedSpells: [],
    spellState: {
      spellbook: [],
      alwaysPrepared: [],
      atWill: [],
      perShortRest: [],
      perLongRest: []
    },
    talents: [],
    feats: [],
    bonuses: [],
    layout: [],
    attacks: [],
    armorItems: [],
    resources: [],
    inventory: [],
    conditions: [],
    exhaustionLevel: 0,
    concentration: false,
    deathSaves: {
      successes: 0,
      failures: 0,
      history: []
    },
    currency: {
      pp: 0,
      gp: 0,
      ep: 0,
      sp: 0,
      cp: 0
    },
    notes: "",
    color: "#334155",
    build: {
      ruleset: "dnd-2024",
      mode: "guided",
      classes: [],
      selections: []
    },
    ...overrides
  };
}

function createClass(overrides: Partial<ClassEntry> = {}): ClassEntry {
  return {
    id: "class-1",
    name: "Wizard",
    source: "PHB",
    description: "Arcane class.",
    hitDieFaces: 6,
    primaryAbilities: ["Intelligence"],
    savingThrowProficiencies: ["int", "wis"],
    startingProficiencies: {
      armor: [],
      weapons: [],
      tools: []
    },
    spellcastingAbility: "int",
    spellPreparation: "spellbook",
    subclassLevel: 2,
    features: [],
    subclasses: [],
    tables: [],
    ...overrides
  };
}

function createFeat(overrides: Partial<FeatEntry> = {}): FeatEntry {
  return {
    id: "feat-1",
    name: "Tough",
    source: "PHB",
    category: "Origin",
    abilityScoreIncrease: "",
    prerequisites: "",
    description: "Gain extra hit points.",
    ...overrides
  };
}

function createSpecies(overrides: Partial<CompendiumSpeciesEntry> = {}): CompendiumSpeciesEntry {
  return {
    id: "species-1",
    name: "Elf",
    source: "PHB",
    category: "Species",
    description: "",
    entries: "You gain {@skill Perception}. Choose an {@feat Tough}.",
    tags: [],
    creatureTypes: ["humanoid"],
    sizes: ["Medium"],
    speed: 35,
    darkvision: 60,
    languages: ["Common", "Elvish"],
    traitTags: [],
    ...overrides
  };
}

function createBackground(overrides: Partial<CompendiumBackgroundEntry> = {}): CompendiumBackgroundEntry {
  return {
    id: "background-1",
    name: "Sage",
    source: "PHB",
    category: "Background",
    description: "",
    entries: "",
    tags: [],
    abilityChoices: [{ abilities: ["int", "wis"], amount: 1, count: 2 }],
    skillProficiencies: ["Arcana", "History"],
    toolProficiencies: ["Calligrapher's Supplies"],
    languageProficiencies: ["Draconic"],
    featIds: ["feat-origin"],
    startingEquipment: [
      {
        id: "group-1",
        label: "Scholar Pack",
        choose: 1,
        options: [
          {
            id: "option-1",
            label: "Default",
            items: [{ name: "Spellbook", quantity: 1, notes: "", equipped: false, type: "gear" }]
          }
        ]
      }
    ],
    ...overrides
  };
}

function createSpell(overrides: Partial<SpellEntry> = {}): SpellEntry {
  return {
    id: "spell-1",
    name: "Magic Missile",
    source: "PHB",
    level: 1,
    school: "Evocation",
    castingTimeUnit: "action",
    castingTimeValue: 1,
    rangeType: "feet",
    rangeValue: 120,
    description: "Force darts.",
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
    damageNotation: "",
    damageAbility: null,
    higherLevelDescription: "",
    fullDescription: "Force darts.",
    classes: ["Wizard"],
    classReferences: [],
    ...overrides
  };
}

function createOptionalFeature(overrides: Partial<CompendiumOptionalFeatureEntry> = {}): CompendiumOptionalFeatureEntry {
  return {
    id: "optional-1",
    name: "Metamagic Adept",
    source: "PHB",
    category: "Metamagic",
    description: "Shape spells.",
    entries: "Shape spells.",
    tags: [],
    featureTypes: ["metamagic"],
    prerequisites: "",
    ...overrides
  };
}

function createCompendium(overrides: Partial<CampaignSnapshot["compendium"]> = {}): CampaignSnapshot["compendium"] {
  return {
    spells: [],
    feats: [],
    classes: [],
    variantRules: [],
    conditions: [],
    optionalFeatures: [],
    backgrounds: [],
    items: [],
    languages: [],
    races: [],
    skills: [],
    ...overrides
  };
}

describe("playerNpcSheet2024 extracted helpers", () => {
  it("derives multiclass spell slots and clamps used slots", () => {
    const wizardActorClass: ActorClassEntry = {
      id: "wizard-actor",
      compendiumId: "wizard",
      name: "Wizard",
      source: "PHB",
      level: 1,
      hitDieFaces: 6,
      usedHitDice: 0,
      spellcastingAbility: "int"
    };
    const clericActorClass: ActorClassEntry = {
      id: "cleric-actor",
      compendiumId: "cleric",
      name: "Cleric",
      source: "PHB",
      level: 1,
      hitDieFaces: 8,
      usedHitDice: 0,
      spellcastingAbility: "wis"
    };
    const actor = createActor({
      classes: [wizardActorClass, clericActorClass],
      spellSlots: [{ level: 1, total: 0, used: 9 }]
    });
    const wizard = createClass({
      id: "wizard",
      name: "Wizard",
      spellPreparation: "spellbook",
      tables: [{ name: "Wizard", columns: ["1st"], rows: [["2"]] }]
    });
    const cleric = createClass({
      id: "cleric",
      name: "Cleric",
      spellPreparation: "prepared",
      spellcastingAbility: "wis",
      hitDieFaces: 8,
      tables: [{ name: "Cleric", columns: ["1st"], rows: [["2"]] }]
    });

    const slots = deriveSpellSlots(actor, [wizard, cleric]);

    expect(slots[0]).toEqual({ level: 1, total: 4, used: 4 });
  });

  it("derives prepared spell limits from table values and fallback formula", () => {
    const actor = createActor({
      abilities: { str: 10, dex: 12, con: 14, int: 16, wis: 16, cha: 10 },
      classes: [
        {
          id: "cleric-actor",
          compendiumId: "cleric",
          name: "Cleric",
          source: "PHB",
          level: 1,
          hitDieFaces: 8,
          usedHitDice: 0,
          spellcastingAbility: "wis"
        },
        {
          id: "druid-actor",
          compendiumId: "druid",
          name: "Druid",
          source: "PHB",
          level: 2,
          hitDieFaces: 8,
          usedHitDice: 0,
          spellcastingAbility: "wis"
        }
      ]
    });
    const cleric = createClass({
      id: "cleric",
      name: "Cleric",
      spellPreparation: "prepared",
      spellcastingAbility: "wis",
      tables: [{ name: "Cleric", columns: ["Prepared Spells"], rows: [["3"]] }]
    });
    const druid = createClass({
      id: "druid",
      name: "Druid",
      spellPreparation: "prepared",
      spellcastingAbility: "wis",
      hitDieFaces: 8,
      tables: [{ name: "Druid", columns: ["1st"], rows: [["2"], ["3"]] }]
    });

    expect(derivePreparedSpellLimit(actor, [cleric, druid])).toBe(8);
  });

  it("merges derived resources while preserving manual overrides", () => {
    const merged = mergeDerivedResources(
      [
        { id: "manual-1", name: "Wizard Arcane Recovery", current: 1, max: 5, resetOn: "Long Rest", restoreAmount: 2 },
        { id: "manual-2", name: "Custom Pool", current: 2, max: 2, resetOn: "Short Rest", restoreAmount: 2 }
      ],
      [
        {
          id: "derived-1",
          name: "Wizard Arcane Recovery",
          max: 3,
          resetOn: "Long Rest",
          restoreAmount: 3,
          description: "Derived",
          source: "PHB"
        }
      ]
    );

    expect(merged).toEqual([
      { id: "manual-1", name: "Wizard Arcane Recovery", current: 1, max: 5, resetOn: "Long Rest", restoreAmount: 2 },
      { id: "manual-2", name: "Custom Pool", current: 2, max: 2, resetOn: "Short Rest", restoreAmount: 2 }
    ]);
  });

  it("applies guided setup selections to actor state", () => {
    const originFeat = createFeat({ id: "feat-origin", name: "Skilled", category: "Origin" });
    const guideFeat = createFeat({ id: "feat-guide", name: "Alert", category: "Feat" });
    const species = createSpecies();
    const background = createBackground();
    const classEntry = createClass({
      id: "wizard",
      name: "Wizard",
      spellPreparation: "spellbook",
      tables: [{ name: "Wizard", columns: ["1st"], rows: [["2"]] }]
    });
    const spell = createSpell();
    const compendium = createCompendium({
      feats: [originFeat, guideFeat],
      races: [species],
      backgrounds: [background],
      classes: [classEntry],
      spells: [spell],
      optionalFeatures: []
    });

    let actor = createActor();
    actor = applySpeciesToActor(actor, species);
    actor = applySpeciesChoiceSelections(actor, species, compendium.feats, "Perception", "");
    actor = applyBackgroundToActor(actor, background, compendium.feats, {
      featId: originFeat.id,
      abilityChoices: ["int", "wis"],
      equipmentChoiceIds: { "group-1": "option-1" }
    });
    actor = applyClassToActor(actor, classEntry, compendium.classes);
    actor = applyGuideSelectionsToActor(actor, {
      compendium,
      setup: {
        speciesId: species.id,
        backgroundId: background.id,
        classId: classEntry.id,
        subclassId: "",
        classFeatIds: [guideFeat.id],
        optionalFeatureIds: [],
        cantripIds: [],
        knownSpellIds: [spell.id],
        spellbookSpellIds: [],
        expertiseSkillChoices: [],
        asiMode: "feat",
        asiFeatId: "",
        asiAbilityChoices: [],
        speciesSkillChoice: "Perception",
        speciesOriginFeatId: "",
        originFeatId: originFeat.id,
        equipmentChoiceIds: { "group-1": "option-1" },
        abilityChoices: ["int", "wis"]
      },
      spec: {
        subclassOptions: [],
        classFeatOptions: [guideFeat],
        classFeatCount: 1,
        optionalFeatureOptions: [],
        optionalFeatureCount: 0,
        cantripOptions: [],
        cantripCount: 0,
        knownSpellOptions: [spell],
        knownSpellCount: 1,
        spellbookOptions: [],
        spellbookCount: 0,
        expertiseSkillOptions: [],
        expertiseCount: 0,
        abilityImprovementCount: 0
      },
      level: 1,
      targetClass: classEntry,
      targetActorClassId: actor.classes[0]?.id ?? null,
      mode: "setup"
    });

    expect(actor.species).toBe("Elf");
    expect(actor.background).toBe("Sage");
    expect(actor.className).toBe("Wizard");
    expect(actor.feats).toEqual(expect.arrayContaining(["Skilled", "Alert"]));
    expect(actor.spells).toContain("Magic Missile");
    expect(actor.inventory.map((entry) => entry.name)).toContain("Spellbook");
    expect(actor.build?.speciesId).toBe(species.id);
    expect(actor.build?.backgroundId).toBe(background.id);
    expect(actor.skills.find((entry) => entry.name === "Arcana")?.proficient).toBe(true);
    expect(actor.skills.find((entry) => entry.name === "Perception")?.proficient).toBe(true);
  });

  it("tracks level-up hit point growth and build class sync through extracted helpers", () => {
    const feat = createFeat({ id: "feat-level", name: "War Caster", category: "Feat" });
    const optionalFeature = createOptionalFeature();
    const classEntry = createClass({
      id: "wizard",
      name: "Wizard",
      spellPreparation: "spellbook",
      tables: [{ name: "Wizard", columns: ["1st"], rows: [["2"], ["3"]] }]
    });
    const compendium = createCompendium({
      feats: [feat],
      classes: [classEntry],
      optionalFeatures: [optionalFeature],
      spells: []
    });

    let actor = createActor();
    actor = applyClassToActor(actor, classEntry, compendium.classes);
    actor.classes = actor.classes.map((entry) => ({ ...entry, level: 2 }));
    actor.hitPoints.max += 5;
    actor.hitPoints.current += 5;
    actor.build = {
      ...(actor.build ?? { ruleset: "dnd-2024", mode: "guided", classes: [], selections: [] }),
      selections: [
        ...(actor.build?.selections ?? []),
        {
          id: "selection-hp",
          kind: "custom",
          level: 2,
          name: "Level Up: Wizard",
          source: "PHB",
          notes: "+5 HP"
        }
      ],
      classes: syncBuildClasses(actor.classes, actor.build?.classes ?? [])
    };
    actor = applyGuideSelectionsToActor(actor, {
      compendium,
      setup: {
        speciesId: "",
        backgroundId: "",
        classId: classEntry.id,
        subclassId: "",
        classFeatIds: [feat.id],
        optionalFeatureIds: [],
        cantripIds: [],
        knownSpellIds: [],
        spellbookSpellIds: [],
        expertiseSkillChoices: [],
        asiMode: "feat",
        asiFeatId: "",
        asiAbilityChoices: [],
        speciesSkillChoice: "",
        speciesOriginFeatId: "",
        originFeatId: "",
        equipmentChoiceIds: {},
        abilityChoices: []
      },
      spec: {
        subclassOptions: [],
        classFeatOptions: [feat],
        classFeatCount: 1,
        optionalFeatureOptions: [],
        optionalFeatureCount: 0,
        cantripOptions: [],
        cantripCount: 0,
        knownSpellOptions: [],
        knownSpellCount: 0,
        spellbookOptions: [],
        spellbookCount: 0,
        expertiseSkillOptions: [],
        expertiseCount: 0,
        abilityImprovementCount: 0
      },
      level: 2,
      targetClass: classEntry,
      targetActorClassId: actor.classes[0]?.id ?? null,
      mode: "levelup"
    });

    expect(actor.build?.classes[0]?.level).toBe(2);
    expect(actor.build?.selections.some((entry) => entry.notes === "+5 HP")).toBe(true);
    expect(actor.feats).toContain("War Caster");
    expect(deriveGuidedHitPointMax(actor)).toBe(13);
  });

  it("normalizes and heals hit points against reduced maximums", () => {
    const normalized = normalizeHitPoints(
      {
        current: 50,
        max: 40,
        temp: 5,
        reducedMax: 8
      },
      40
    );

    expect(normalized).toEqual({
      current: 32,
      max: 40,
      temp: 5,
      reducedMax: 8
    });

    expect(
      healHitPoints(
        {
          current: 20,
          max: 40,
          temp: 0,
          reducedMax: 8
        },
        20,
        40
      )
    ).toEqual({
      current: 32,
      max: 40,
      temp: 0,
      reducedMax: 8
    });
  });
});
