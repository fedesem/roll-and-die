import { describe, expect, it } from "vitest";

import type {
  ActorClassEntry,
  ActorSheet,
  CampaignSnapshot,
  ClassEntry,
  CompendiumBackgroundEntry,
  CompendiumOptionalFeatureEntry,
  CompendiumReferenceEntry,
  CompendiumSpeciesEntry,
  FeatEntry,
  SpellEntry
} from "@shared/types";

import {
  applyGuideBaseAbilities,
  applyBackgroundToActor,
  applyEquipmentSelectionsToActor,
  applyClassSkillChoicesToActor,
  applyClassToActor,
  applyGuideSelectionsToActor,
  applySpeciesChoiceGroupSelections,
  applySpeciesChoiceSelections,
  applySpeciesToActor
} from "../src/features/sheet/selectors/playerNpcSheet2024Mutations";
import {
  deriveAttunementCount,
  deriveBackgroundSkillChoiceConfig,
  deriveBackgroundAbilityConfig,
  deriveBackgroundEquipmentGroups,
  deriveBackgroundSkillProficiencies,
  deriveCarryingCapacity,
  deriveClassChoiceGroups,
  deriveFeatChoiceGroups,
  deriveClassEquipmentGroups,
  deriveClassSkillChoiceConfig,
  deriveGuidedAbilityChoiceSlots,
  deriveGuidedChoiceSpec,
  deriveGrantedSpellState,
  deriveGuidedHitPointMax,
  derivePreparedSpellLimit,
  deriveScaledSpellDice,
  deriveSpeciesChoiceGroups,
  deriveSpeciesOriginFeatOptions,
  deriveSpeciesSkillChoiceConfig,
  deriveSpellSlots,
  healHitPoints,
  mergeDerivedResources,
  normalizeHitPoints,
  parseReferenceFeatureRows,
  selectGuidedAbilityChoiceMode,
  syncBuildClasses
} from "../src/features/sheet/selectors/playerNpcSheet2024Selectors";
import { skillTotal } from "../src/features/sheet/sheetUtils";

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
    startingEquipment: [],
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
    spellNames: [],
    alwaysPreparedSpellNames: [],
    choiceGroups: [],
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

function createSkillReference(name: string): CompendiumReferenceEntry {
  return {
    id: `skill-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name,
    source: "PHB",
    category: "Skill",
    description: `${name} skill.`,
    entries: `${name} skill.`,
    tags: []
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
  it("derives granted spells from frozen JSON awards and ignores compendium prose", () => {
    const actor = createActor({
      build: {
        ruleset: "dnd-2024",
        schemaVersion: 2,
        mode: "guided",
        backgroundId: "prose-trap",
        classes: [],
        selections: [],
        overrides: [],
        awards: [
          {
            id: "award-spell",
            characterLevel: 1,
            classRef: "Wizard|XPHB",
            classLevel: 1,
            definitionFingerprint: "frozen",
            choices: [],
            effects: [{ id: "award-spell:0", kind: "spell", ref: "Magic Missile|XPHB", bucket: "alwaysPrepared" }],
            committedAt: "2026-01-01T00:00:00.000Z"
          }
        ]
      }
    });
    const compendium = createCompendium({
      backgrounds: [createBackground({ id: "prose-trap", entries: "You always have {@spell Fireball|XPHB} prepared." })]
    });

    expect(deriveGrantedSpellState(actor, compendium)).toEqual({
      known: [],
      spellbook: [],
      alwaysPrepared: ["Magic Missile"],
      atWill: [],
      perShortRest: [],
      perLongRest: []
    });
  });

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

    expect(slots[0]).toEqual({ level: 1, total: 3, used: 3 });
  });

  it("derives prepared spell limits exclusively from progression JSON", () => {
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

    expect(derivePreparedSpellLimit(actor, [cleric, druid])).toBe(9);
  });

  it("uses progression JSON instead of imported prose for background and species skill choices", () => {
    const skillEntries = ["Arcana", "History", "Insight", "Perception", "Religion", "Survival"].map(createSkillReference);
    const background = createBackground({
      abilityChoices: [],
      skillProficiencies: [],
      featIds: [],
      startingEquipment: [],
      entries: "Skill Proficiencies:. {@skill Survival}, plus one from among {@skill Arcana}, {@skill History}, and {@skill Religion}"
    });
    const species = createSpecies({
      entries: "Keen Senses\nYou have proficiency in the {@skill Insight}, {@skill Perception}, or {@skill Survival} skill."
    });

    expect(deriveBackgroundSkillProficiencies(background)).toEqual(["Arcana", "History"]);
    expect(deriveBackgroundSkillChoiceConfig(background, skillEntries).count).toBe(0);
    expect(deriveBackgroundSkillChoiceConfig(background, skillEntries).options).toEqual([]);

    expect(deriveSpeciesSkillChoiceConfig(species, skillEntries).count).toBe(0);
    expect(deriveSpeciesSkillChoiceConfig(species, skillEntries).options).toEqual([]);
  });

  it("applies fixed and chosen setup skills from species and backgrounds", () => {
    const actor = createActor({
      abilities: {
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10
      },
      skills: [
        { id: "skill-arcana", name: "Arcana", ability: "int", proficient: false, expertise: false },
        { id: "skill-history", name: "History", ability: "int", proficient: false, expertise: false },
        { id: "skill-perception", name: "Perception", ability: "wis", proficient: false, expertise: false },
        { id: "skill-survival", name: "Survival", ability: "wis", proficient: false, expertise: false }
      ]
    });
    const species = createSpecies({
      entries: "Keen Senses\nYou have proficiency in the {@skill Perception} skill."
    });
    const background = createBackground({
      abilityChoices: [],
      skillProficiencies: [],
      featIds: [],
      startingEquipment: [],
      entries: "Skill Proficiencies:. {@skill Survival}, plus one from among {@skill Arcana}, {@skill History}"
    });

    const speciesApplied = applySpeciesChoiceSelections(actor, species, [], [], "");
    const backgroundApplied = applyBackgroundToActor(speciesApplied, background, [], {
      skillChoices: ["History"],
      equipmentChoiceIds: {},
      abilityChoices: []
    });

    expect(backgroundApplied.skills.find((entry) => entry.name === "Perception")?.proficient).toBe(false);
    expect(backgroundApplied.skills.find((entry) => entry.name === "Survival")?.proficient).toBe(false);
    expect(backgroundApplied.skills.find((entry) => entry.name === "History")?.proficient).toBe(true);
    expect(backgroundApplied.skills.find((entry) => entry.name === "Arcana")?.proficient).toBe(true);
  });

  it("applies guide base abilities before background bonuses", () => {
    const actor = createActor({
      abilities: {
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10
      }
    });
    const background = createBackground({
      abilityChoices: [
        { abilities: ["str", "dex", "con", "int", "wis", "cha"], amount: 2, count: 1 },
        { abilities: ["str", "dex", "con", "int", "wis", "cha"], amount: 1, count: 1 }
      ],
      skillProficiencies: [],
      featIds: [],
      startingEquipment: []
    });
    const abilityConfig = deriveBackgroundAbilityConfig(background);
    const plusTwoPlusOneMode = selectGuidedAbilityChoiceMode(abilityConfig, "primary");
    const threePlusOneMode = selectGuidedAbilityChoiceMode(abilityConfig, "three-plus-one");

    const baseApplied = applyGuideBaseAbilities(actor, {
      str: 10,
      dex: 12,
      con: 14,
      int: 8,
      wis: 13,
      cha: 18
    });
    const backgroundApplied = applyBackgroundToActor(baseApplied, background, [], {
      abilityChoices: ["int", "wis"],
      abilityChoiceModeId: plusTwoPlusOneMode?.id,
      equipmentChoiceIds: {},
      skillChoices: []
    });
    const backgroundAppliedThreePlusOne = applyBackgroundToActor(baseApplied, background, [], {
      abilityChoices: ["con", "int", "wis"],
      abilityChoiceModeId: threePlusOneMode?.id,
      equipmentChoiceIds: {},
      skillChoices: []
    });

    expect(abilityConfig.modes.map((entry) => entry.label)).toEqual(["+2 / +1", "+1 / +1 / +1"]);
    expect(deriveGuidedAbilityChoiceSlots(threePlusOneMode).map((entry) => entry.amount)).toEqual([1, 1, 1]);

    expect(backgroundApplied.abilities).toMatchObject({
      str: 10,
      dex: 12,
      con: 14,
      int: 10,
      wis: 14,
      cha: 18
    });
    expect(backgroundAppliedThreePlusOne.abilities).toMatchObject({
      str: 10,
      dex: 12,
      con: 15,
      int: 9,
      wis: 14,
      cha: 18
    });
  });

  it("uses species progression JSON for choices while ignoring compendium mechanics", () => {
    const dragonborn = createSpecies({
      name: "Dragonborn",
      choiceGroups: [
        {
          id: "choice:draconic-ancestry",
          label: "Draconic Ancestry",
          options: [
            {
              id: "black",
              label: "Black",
              description: "Damage Type: Acid",
              featureName: "Draconic Ancestry: Black",
              spellNames: [],
              alwaysPreparedSpellNames: []
            }
          ]
        }
      ]
    });
    const elf = createSpecies({
      choiceGroups: [
        {
          id: "choice:elven-lineage",
          label: "Elven Lineage",
          options: [
            {
              id: "lorwyn",
              label: "Lorwyn",
              description: "Level 1: Thorn Whip",
              featureName: "Elven Lineage: Lorwyn",
              spellNames: ["Thorn Whip"],
              alwaysPreparedSpellNames: []
            },
            {
              id: "shadowmoor",
              label: "Shadowmoor",
              description: "Level 1: Darkvision 120 feet and Starry Wisp",
              featureName: "Elven Lineage: Shadowmoor",
              spellNames: ["Starry Wisp"],
              alwaysPreparedSpellNames: ["Heroism", "Gentle Repose"],
              visionRangeOverride: 24
            }
          ]
        },
        {
          id: "choice:elven-lineage:spellcasting-ability",
          label: "Lineage Spellcasting Ability",
          options: [
            {
              id: "int",
              label: "Intelligence",
              description: "Use Intelligence for the lineage spells.",
              spellNames: [],
              alwaysPreparedSpellNames: []
            }
          ]
        }
      ]
    });

    expect(deriveSpeciesChoiceGroups(dragonborn).map((group) => group.label)).toEqual(["Draconic Ancestry"]);
    expect(deriveSpeciesChoiceGroups(elf).map((group) => group.label)).toEqual(["Elven Lineage"]);
    expect(deriveSpeciesChoiceGroups(elf)[0]?.options.map((option) => option.label)).toEqual(["Drow", "High Elf", "Wood Elf"]);
  });

  it("applies species lineage choices, package equipment, and class equipment with coins", () => {
    const actor = createActor();
    const elf = createSpecies({
      speed: 30,
      darkvision: 60,
      choiceGroups: [
        {
          id: "lineage",
          label: "Elven Lineage",
          options: [
            {
              id: "wood-elf",
              label: "Wood Elf",
              description: "Your Speed is 35 feet. You also know Druidcraft.",
              featureName: "Elven Lineage: Wood Elf",
              spellNames: ["Druidcraft"],
              alwaysPreparedSpellNames: [],
              speedOverride: 35
            }
          ]
        },
        {
          id: "lineage-spellcasting",
          label: "Lineage Spellcasting Ability",
          options: [
            {
              id: "wis",
              label: "Wisdom",
              description: "Use Wisdom for the lineage spells.",
              spellNames: [],
              alwaysPreparedSpellNames: []
            }
          ]
        }
      ]
    });
    const background = createBackground({
      source: "XPHB",
      abilityChoices: [],
      skillProficiencies: [],
      featIds: [],
      startingEquipment: [],
      entries: "Equipment:. Choose A or B: (A) {@item Quarterstaff|XPHB}, {@item Robe|XPHB}, 8 GP; or (B) 50 GP"
    });
    const fighter = createClass({
      id: "fighter",
      name: "Fighter",
      hitDieFaces: 10,
      spellPreparation: "none",
      startingEquipment: [
        {
          id: "equipment",
          label: "Class Equipment",
          choose: 1,
          options: [
            {
              id: "a",
              label: "Option A",
              items: [
                { name: "Chain Mail", quantity: 1, notes: "", equipped: false },
                { name: "Greatsword", quantity: 1, notes: "", equipped: false },
                { name: "Flail", quantity: 1, notes: "", equipped: false },
                { name: "Javelin", quantity: 8, notes: "", equipped: false },
                { name: "Dungeoneer's Pack", quantity: 1, notes: "", equipped: false },
                { name: "4 GP", quantity: 1, notes: "", equipped: false, type: "loot", currency: { gp: 4 } }
              ]
            },
            {
              id: "b",
              label: "Option B",
              items: [
                { name: "Studded Leather Armor", quantity: 1, notes: "", equipped: false },
                { name: "Scimitar", quantity: 1, notes: "", equipped: false },
                { name: "Shortsword", quantity: 1, notes: "", equipped: false },
                { name: "Longbow", quantity: 1, notes: "", equipped: false },
                { name: "Arrow", quantity: 20, notes: "", equipped: false },
                { name: "Quiver", quantity: 1, notes: "", equipped: false },
                { name: "Dungeoneer's Pack", quantity: 1, notes: "", equipped: false },
                { name: "11 GP", quantity: 1, notes: "", equipped: false, type: "loot", currency: { gp: 11 } }
              ]
            },
            {
              id: "c",
              label: "Compendium-only package that must be ignored",
              items: [{ name: "999 GP", quantity: 1, notes: "", equipped: false, type: "loot", currency: { gp: 999 } }]
            }
          ]
        }
      ]
    });
    const speciesGroups = deriveSpeciesChoiceGroups(elf);
    const backgroundGroups = deriveBackgroundEquipmentGroups(background);
    const classGroups = deriveClassEquipmentGroups(fighter);

    const withSpeciesChoices = applySpeciesChoiceGroupSelections(
      applySpeciesToActor(actor, elf),
      elf,
      speciesGroups,
      {
        "elf-lineage": "wood-elf"
      },
      [createSpell({ id: "spell-druidcraft", name: "Druidcraft", level: "cantrip" })]
    );
    const withBackground = applyBackgroundToActor(withSpeciesChoices, background, [], {
      equipmentChoiceIds: {
        [backgroundGroups[0]?.id ?? ""]: backgroundGroups[0]?.options[0]?.id ?? ""
      },
      abilityChoices: [],
      skillChoices: []
    });
    const withClassEquipment = applyEquipmentSelectionsToActor(withBackground, classGroups, {
      [classGroups[0]?.id ?? ""]: classGroups[0]?.options[2]?.id ?? ""
    });

    expect(withSpeciesChoices.speed).toBe(35);
    expect(withSpeciesChoices.spells).toContain("Druidcraft");
    expect(withSpeciesChoices.features).toContain("Elven Lineage: Wood Elf (Wood Elf Magic, Fleet of Foot)");
    expect(backgroundGroups[0]?.options).toHaveLength(2);
    expect(withClassEquipment.inventory.map((entry) => entry.name)).toEqual(expect.arrayContaining(["Quarterstaff", "Robe"]));
    expect(withClassEquipment.currency.gp).toBe(166);
  });

  it("derives class skill choices and limits setup expertise to proficient skills", () => {
    const rogue = createClass({
      id: "rogue",
      name: "Rogue",
      spellPreparation: "none",
      features: [
        {
          level: 1,
          name: "Expertise",
          description: "You gain Expertise in two of your skill proficiencies of your choice.",
          source: "PHB",
          reference: ""
        }
      ]
    });
    const actor = createActor({
      skills: [
        { id: "skill-acrobatics", name: "Acrobatics", ability: "dex", proficient: false, expertise: false },
        { id: "skill-athletics", name: "Athletics", ability: "str", proficient: false, expertise: false },
        { id: "skill-deception", name: "Deception", ability: "cha", proficient: false, expertise: false },
        { id: "skill-insight", name: "Insight", ability: "wis", proficient: true, expertise: false },
        { id: "skill-perception", name: "Perception", ability: "wis", proficient: false, expertise: false },
        { id: "skill-stealth", name: "Stealth", ability: "dex", proficient: false, expertise: false }
      ]
    });
    const skillEntries = ["Acrobatics", "Athletics", "Deception", "Insight", "Perception", "Stealth"].map(createSkillReference);
    const classSkillConfig = deriveClassSkillChoiceConfig(rogue, skillEntries, actor);
    const setupActor = applyClassSkillChoicesToActor(actor, ["Stealth", "Deception"]);
    const choiceSpec = deriveGuidedChoiceSpec({
      actor: setupActor,
      classes: [rogue],
      spells: [],
      feats: [],
      optionalFeatures: [],
      targetClassId: rogue.id,
      targetActorClassId: "",
      targetSubclassId: "",
      mode: "setup"
    });

    expect(classSkillConfig.count).toBe(4);
    expect(classSkillConfig.options.map((entry) => entry.name)).toEqual(["Acrobatics", "Athletics", "Deception", "Perception", "Stealth"]);
    expect(choiceSpec.expertiseCount).toBe(2);
    expect(choiceSpec.expertiseSkillOptions.map((entry) => entry.name)).toEqual(["Deception", "Insight", "Stealth"]);
  });

  it("syncs build classes from actor subclass fields", () => {
    const actorClasses: ActorClassEntry[] = [
      {
        id: "wizard-actor",
        compendiumId: "wizard",
        name: "Wizard",
        source: "PHB",
        subclassId: "evoker",
        subclassName: "School of Evocation",
        subclassSource: "PHB",
        level: 3,
        hitDieFaces: 6,
        usedHitDice: 1,
        spellcastingAbility: "int"
      }
    ];

    expect(syncBuildClasses(actorClasses, [])).toEqual([
      {
        id: "wizard-actor",
        classId: "wizard",
        className: "Wizard",
        classSource: "PHB",
        subclassId: "evoker",
        subclassName: "School of Evocation",
        subclassSource: "PHB",
        level: 3
      }
    ]);
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

  it("refreshes saved derived resources from the current class definition while preserving remaining uses", () => {
    const merged = mergeDerivedResources(
      [
        {
          id: "derived:cleric-actor:channeldivinity",
          name: "Channel Divinity",
          current: 1,
          max: 1,
          resetOn: "Long Rest",
          restoreAmount: 1
        }
      ],
      [
        {
          id: "derived:cleric-actor:channeldivinity",
          name: "Cleric Channel Divinity",
          max: 2,
          resetOn: "Short Rest",
          restoreAmount: 2,
          description: "Derived",
          source: "PHB"
        }
      ]
    );

    expect(merged).toEqual([
      {
        id: "derived:cleric-actor:channeldivinity",
        name: "Cleric Channel Divinity",
        current: 1,
        max: 2,
        resetOn: "Short Rest",
        restoreAmount: 2
      }
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
    actor = applySpeciesChoiceSelections(actor, species, compendium.feats, ["Perception"], "");
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
        baseAbilities: {
          str: 10,
          dex: 12,
          con: 14,
          int: 16,
          wis: 16,
          cha: 10
        },
        backgroundAbilityModeId: "primary",
        classFeatIds: [guideFeat.id],
        optionalFeatureIds: [],
        cantripIds: [],
        knownSpellIds: [spell.id],
        spellbookSpellIds: [],
        expertiseSkillChoices: [],
        asiMode: "feat",
        asiFeatId: "",
        asiAbilityChoices: [],
        speciesSkillChoices: ["Perception"],
        backgroundSkillChoices: [],
        classSkillChoices: [],
        speciesOriginFeatId: "",
        speciesChoiceIds: {},
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
    expect(actor.inventory.map((entry) => entry.name)).toContain("Book (History)");
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
        baseAbilities: {
          str: 10,
          dex: 12,
          con: 14,
          int: 16,
          wis: 16,
          cha: 10
        },
        backgroundAbilityModeId: "",
        hpMode: "average",
        rolledHp: null,
        classFeatIds: [feat.id],
        optionalFeatureIds: [],
        classChoiceIds: {},
        featChoiceMap: {},
        cantripIds: [],
        knownSpellIds: [],
        spellbookSpellIds: [],
        expertiseSkillChoices: [],
        weaponMasteryChoices: [],
        asiMode: "feat",
        asiAbilityMode: "+2",
        asiFeatId: "",
        asiAbilityChoices: [],
        speciesSkillChoices: [],
        backgroundSkillChoices: [],
        classSkillChoices: [],
        speciesOriginFeatId: "",
        speciesChoiceIds: {},
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
        classChoiceGroups: [],
        featChoiceGroups: {},
        cantripOptions: [],
        cantripCount: 0,
        knownSpellOptions: [],
        knownSpellCount: 0,
        spellbookOptions: [],
        spellbookCount: 0,
        expertiseSkillOptions: [],
        expertiseCount: 0,
        weaponMasteryOptions: ["Dagger (Nick)", "Shortsword (Vex)"],
        weaponMasteryCount: 0,
        abilityImprovementCount: 0,
        hitDieFaces: 6,
        conModifier: 2,
        averageHpGain: 6
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

  it("applies +2 and +1/+1 ASI increases and weapon masteries on level up", () => {
    const classEntry: ClassEntry = {
      id: "cls-fighter",
      name: "Fighter",
      source: "XPHB",
      description: "A master of martial combat.",
      hitDieFaces: 10,
      primaryAbilities: ["str"],
      savingThrowProficiencies: ["Str", "Con"],
      startingProficiencies: { armor: [], weapons: [], tools: [] },
      spellcastingAbility: null,
      spellPreparation: "none",
      subclassLevel: 3,
      features: [
        { level: 1, name: "Weapon Mastery", description: "Master weapons.", source: "XPHB", reference: "" },
        { level: 4, name: "Ability Score Improvement", description: "Increase scores.", source: "XPHB", reference: "" }
      ],
      subclasses: [],
      tables: [],
      startingEquipment: []
    };

    let actor = createActor({ abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 8 } });
    actor = applyClassToActor(actor, classEntry, [classEntry]);
    const compendium = createCompendium({ classes: [classEntry] });

    // Apply +2 ASI and Weapon Masteries
    actor = applyGuideSelectionsToActor(actor, {
      compendium,
      setup: {
        speciesId: "",
        backgroundId: "",
        classId: classEntry.id,
        subclassId: "",
        baseAbilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 8 },
        backgroundAbilityModeId: "",
        hpMode: "average",
        rolledHp: null,
        classFeatIds: [],
        optionalFeatureIds: [],
        classChoiceIds: {},
        featChoiceMap: {},
        cantripIds: [],
        knownSpellIds: [],
        spellbookSpellIds: [],
        expertiseSkillChoices: [],
        weaponMasteryChoices: ["Greatsword (Graze)", "Halberd (Cleave)"],
        asiMode: "ability",
        asiAbilityMode: "+2",
        asiFeatId: "",
        asiAbilityChoices: ["str"],
        speciesSkillChoices: [],
        backgroundSkillChoices: [],
        classSkillChoices: [],
        speciesOriginFeatId: "",
        speciesChoiceIds: {},
        originFeatId: "",
        equipmentChoiceIds: {},
        abilityChoices: []
      },
      spec: {
        subclassOptions: [],
        classFeatOptions: [],
        classFeatCount: 0,
        optionalFeatureOptions: [],
        optionalFeatureCount: 0,
        classChoiceGroups: [],
        featChoiceGroups: {},
        cantripOptions: [],
        cantripCount: 0,
        knownSpellOptions: [],
        knownSpellCount: 0,
        spellbookOptions: [],
        spellbookCount: 0,
        expertiseSkillOptions: [],
        expertiseCount: 0,
        weaponMasteryOptions: ["Greatsword (Graze)", "Halberd (Cleave)"],
        weaponMasteryCount: 2,
        abilityImprovementCount: 1,
        hitDieFaces: 10,
        conModifier: 2,
        averageHpGain: 8
      },
      level: 4,
      targetClass: classEntry,
      targetActorClassId: actor.classes[0]?.id ?? null,
      mode: "levelup"
    });

    expect(actor.abilities.str).toBe(18);
    expect(actor.features).toContain("Weapon Mastery: Greatsword (Graze)");
    expect(actor.features).toContain("Weapon Mastery: Halberd (Cleave)");
  });

  it("applies scripted class choices like Cleric Holy Orders with automated grants", () => {
    const clericEntry: ClassEntry = {
      id: "cls-cleric",
      name: "Cleric",
      source: "XPHB",
      description: "Divine spellcaster.",
      hitDieFaces: 8,
      primaryAbilities: ["wis"],
      savingThrowProficiencies: ["Wis", "Cha"],
      startingProficiencies: { armor: ["Light", "Medium"], weapons: ["Simple"], tools: [] },
      spellcastingAbility: "wis",
      spellPreparation: "prepared",
      subclassLevel: 3,
      features: [{ level: 1, name: "Holy Order", description: "Choose a sacred order.", source: "XPHB", reference: "" }],
      subclasses: [],
      tables: [],
      startingEquipment: []
    };

    let actor = createActor();
    actor = applyClassToActor(actor, clericEntry, [clericEntry]);
    const compendium = createCompendium({ classes: [clericEntry] });

    const choiceSpec = deriveGuidedChoiceSpec({
      actor,
      classes: [clericEntry],
      spells: [],
      feats: [],
      optionalFeatures: [],
      targetClassId: clericEntry.id,
      targetActorClassId: "",
      targetSubclassId: "",
      mode: "setup"
    });

    expect(choiceSpec.classChoiceGroups.length).toBeGreaterThan(0);
    expect(choiceSpec.classChoiceGroups[0]?.id).toBe("cleric-holy-order");

    // Select Protector Holy Order
    actor = applyGuideSelectionsToActor(actor, {
      compendium,
      setup: {
        speciesId: "",
        backgroundId: "",
        classId: clericEntry.id,
        subclassId: "",
        baseAbilities: { str: 14, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
        backgroundAbilityModeId: "",
        hpMode: "average",
        rolledHp: null,
        classFeatIds: [],
        optionalFeatureIds: [],
        classChoiceIds: { "cleric-holy-order": ["protector"] },
        featChoiceMap: {},
        cantripIds: [],
        knownSpellIds: [],
        spellbookSpellIds: [],
        expertiseSkillChoices: [],
        weaponMasteryChoices: [],
        asiMode: "feat",
        asiAbilityMode: "+2",
        asiFeatId: "",
        asiAbilityChoices: [],
        speciesSkillChoices: [],
        backgroundSkillChoices: [],
        classSkillChoices: [],
        speciesOriginFeatId: "",
        speciesChoiceIds: {},
        originFeatId: "",
        equipmentChoiceIds: {},
        abilityChoices: []
      },
      spec: choiceSpec,
      level: 1,
      targetClass: clericEntry,
      targetActorClassId: actor.classes[0]?.id ?? null,
      mode: "setup"
    });

    expect(actor.armorProficiencies).toContain("Heavy Armor");
    expect(actor.weaponProficiencies).toContain("Martial Weapons");
  });

  it("calculates carrying capacity, coin weights, and encumbrance thresholds accurately", () => {
    const actor = createActor({
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      currency: { pp: 0, gp: 100, ep: 0, sp: 0, cp: 0 }, // 100 coins = 2 lbs
      inventory: [{ id: "item-1", name: "Chain Mail", type: "gear", quantity: 1, weight: 55, equipped: true, notes: "" }]
    });

    const capacity = deriveCarryingCapacity(actor);
    // STR 10 => carrying capacity: 150 lbs, encumbered: >50 lbs, heavily encumbered: >100 lbs
    expect(capacity.carryingCapacity).toBe(150);
    expect(capacity.coinWeight).toBe(2);
    expect(capacity.itemWeight).toBe(55);
    expect(capacity.totalCarriedWeight).toBe(57);
    expect(capacity.encumbranceStatus).toBe("encumbered");
  });

  it("tracks magic item attunement limits and evaluates upcast spell dice scaling", () => {
    const actor = createActor({
      inventory: [
        { id: "item-1", name: "Cloak of Protection", type: "gear", quantity: 1, equipped: true, attuned: true, notes: "" },
        { id: "item-2", name: "Ring of Spell Storing", type: "gear", quantity: 1, equipped: true, attuned: true, notes: "" }
      ]
    });

    const attunement = deriveAttunementCount(actor);
    expect(attunement.count).toBe(2);
    expect(attunement.max).toBe(3);

    const spell = createSpell({
      name: "Cure Wounds",
      level: 1,
      damageNotation: "2d8",
      higherLevelDescription: "+1d8 for each slot level above 1st"
    });

    const upcastLevel1 = deriveScaledSpellDice(spell, 1);
    const upcastLevel3 = deriveScaledSpellDice(spell, 3);
    expect(upcastLevel1).toBe("2d8");
    expect(upcastLevel3).toBe("4d8");
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

  it("filters out mechanical headers like Size, Speed, Languages from species feature rows", () => {
    const species = createSpecies({
      entries:
        "Creature Type: Humanoid\nSize: Medium or Small\nSpeed: 30 feet\nLanguages: Common and one other\nDarkvision: You can see in dim light within 60 feet as if it were bright light."
    });

    const parsedRows = parseReferenceFeatureRows("Species", species);
    expect(parsedRows.some((r) => /creature type|size|speed|language/i.test(r.title))).toBe(false);
    expect(parsedRows.some((r) => /darkvision/i.test(r.title))).toBe(true);
  });

  it("scales spell slots across levels for full casters and half casters with standard D&D 2024 tables", () => {
    const druidActor = createActor({
      classes: [{ id: "c1", name: "Druid", level: 1, hitDice: "d8", usedHitDice: 0, subclassId: "", spellcastingAbility: "wis" }]
    });

    const slotsLvl1 = deriveSpellSlots(druidActor, []);
    expect(slotsLvl1[0]?.total).toBe(2);
    expect(slotsLvl1[1]?.total).toBe(0);

    druidActor.classes[0].level = 3;
    const slotsLvl3 = deriveSpellSlots(druidActor, []);
    expect(slotsLvl3[0]?.total).toBe(4);
    expect(slotsLvl3[1]?.total).toBe(2);

    druidActor.classes[0].level = 5;
    const slotsLvl5 = deriveSpellSlots(druidActor, []);
    expect(slotsLvl5[0]?.total).toBe(4);
    expect(slotsLvl5[1]?.total).toBe(3);
    expect(slotsLvl5[2]?.total).toBe(2);
  });

  it("applies Druid Primal Order Magician bonuses (+Wis to Arcana/Nature checks and extra cantrip in choice spec)", () => {
    const actor = createActor({
      abilities: { str: 10, dex: 12, con: 14, int: 12, wis: 16, cha: 10 }, // wis mod = +3, int mod = +1
      skills: [
        { name: "Arcana", ability: "int", proficient: false, expertise: false },
        { name: "Nature", ability: "int", proficient: true, expertise: false } // prof bonus = 2, int = 1
      ],
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

    // Arcana: int(+1) + wis bonus(+3) = +4
    const arcanaSkill = actor.skills.find((s) => s.name === "Arcana")!;
    expect(skillTotal(actor, arcanaSkill)).toBe(4);

    // Nature: int(+1) + prof(+2) + wis bonus(+3) = +6
    const natureSkill = actor.skills.find((s) => s.name === "Nature")!;
    expect(skillTotal(actor, natureSkill)).toBe(6);
  });

  it("handles Human species origin feat and skill choices correctly", () => {
    const humanSpecies = createSpecies({
      id: "human-xphb",
      name: "Human",
      description: "A versatile human with Skillful and Versatile traits."
    });

    const feats: FeatEntry[] = [
      { id: "feat-alert", name: "Alert", category: "Origin", description: "Always on alert", entries: "", tags: [], prerequisite: null },
      { id: "feat-tough", name: "Tough", category: "Origin", description: "Extra HP", entries: "", tags: [], prerequisite: null },
      {
        id: "feat-gwm",
        name: "Great Weapon Master",
        category: "General",
        description: "Heavy weapons",
        entries: "",
        tags: [],
        prerequisite: "Level 4"
      }
    ];

    const originOptions = deriveSpeciesOriginFeatOptions(humanSpecies, feats);
    expect(originOptions.some((f) => f.name === "Alert")).toBe(true);
    expect(originOptions.some((f) => f.name === "Tough")).toBe(true);
    expect(originOptions.some((f) => f.name === "Great Weapon Master")).toBe(false);

    const skills: CompendiumReferenceEntry[] = [
      { id: "sk-athletics", name: "Athletics", category: "skill", description: "", entries: "", tags: [] },
      { id: "sk-stealth", name: "Stealth", category: "skill", description: "", entries: "", tags: [] }
    ];

    const skillConfig = deriveSpeciesSkillChoiceConfig(humanSpecies, skills);
    expect(skillConfig.count).toBe(1);
    expect(skillConfig.options.length).toBe(2);
  });

  it("derives species choice groups from progression definitions for Elf, Gnome, Goliath, Tiefling, etc.", () => {
    const elfSpecies = createSpecies({
      id: "elf-xphb",
      name: "Elf"
    });

    const elfChoiceGroups = deriveSpeciesChoiceGroups(elfSpecies);
    expect(elfChoiceGroups.length).toBeGreaterThanOrEqual(1);
    expect(elfChoiceGroups[0]?.options.some((opt) => opt.label.includes("High Elf"))).toBe(true);

    const tieflingSpecies = createSpecies({
      id: "tiefling-xphb",
      name: "Tiefling"
    });

    const tieflingChoiceGroups = deriveSpeciesChoiceGroups(tieflingSpecies);
    expect(tieflingChoiceGroups.length).toBeGreaterThanOrEqual(1);
    expect(tieflingChoiceGroups[0]?.options.some((opt) => opt.label.includes("Infernal"))).toBe(true);
  });

  it("derives class progression choice groups including Fighting Style, Metamagic, and Invocations", () => {
    const fighterClass: ClassEntry = {
      id: "fighter-xphb",
      name: "Fighter",
      source: "XPHB",
      category: "classes",
      tags: [],
      subclasses: [],
      hitDieFaces: 10,
      features: [],
      tables: [],
      startingEquipment: []
    };

    const fighterLvl1Groups = deriveClassChoiceGroups(fighterClass, 0, 1, {
      spells: [],
      optionalFeatures: [],
      actor: createActor()
    });
    expect(fighterLvl1Groups.some((g) => g.id === "fighter-fighting-style")).toBe(true);

    const sorcererClass: ClassEntry = {
      id: "sorcerer-xphb",
      name: "Sorcerer",
      source: "XPHB",
      category: "classes",
      tags: [],
      subclasses: [],
      hitDieFaces: 6,
      features: [],
      tables: [],
      startingEquipment: []
    };

    const sorcererLvl2Groups = deriveClassChoiceGroups(sorcererClass, 1, 2, {
      spells: [],
      optionalFeatures: [],
      actor: createActor()
    });
    const metamagicGroup = sorcererLvl2Groups.find((g) => g.id === "sorcerer-metamagic");
    expect(metamagicGroup).toBeDefined();
    expect(metamagicGroup?.count).toBe(2);

    const warlockClass: ClassEntry = {
      id: "warlock-xphb",
      name: "Warlock",
      source: "XPHB",
      category: "classes",
      tags: [],
      subclasses: [],
      hitDieFaces: 8,
      features: [],
      tables: [],
      startingEquipment: []
    };

    const warlockLvl1Groups = deriveClassChoiceGroups(warlockClass, 0, 1, {
      spells: [],
      optionalFeatures: [],
      actor: createActor()
    });
    expect(warlockLvl1Groups.some((g) => g.id === "warlock-invocations-1")).toBe(true);

    const druidClass = createClass({ id: "druid-xphb", name: "Druid", source: "XPHB" });
    const druidCantrip = createSpell({ id: "guidance-xphb", name: "Guidance", source: "XPHB", level: "cantrip", classes: ["Druid"] });
    const druidGroups = deriveClassChoiceGroups(druidClass, 0, 1, {
      spells: [druidCantrip],
      optionalFeatures: [],
      actor: createActor()
    });
    expect(druidGroups.find((group) => group.id === "druid-primal-order:magician:cantrips")?.parentOption).toEqual({
      groupId: "druid-primal-order",
      optionId: "magician"
    });
  });

  it("derives every feat subchoice from JSON, including dynamic spell and proficiency domains", () => {
    const magicInitiate = createFeat({ id: "magic-initiate-wizard", name: "Magic Initiate (Wizard)", source: "XPHB" });
    const wizardSpells = [
      createSpell({ id: "light-xphb", name: "Light", source: "XPHB", level: "cantrip", classes: ["Wizard"] }),
      createSpell({ id: "mage-hand-xphb", name: "Mage Hand", source: "XPHB", level: "cantrip", classes: ["Wizard"] }),
      createSpell({ id: "shield-xphb", name: "Shield", source: "XPHB", level: 1, classes: ["Wizard"] })
    ];
    const magicGroups = deriveFeatChoiceGroups(magicInitiate, wizardSpells, createActor());
    expect(magicGroups.find((group) => group.id === "magic-initiate-wizard-ability")?.count).toBe(1);
    expect(magicGroups.find((group) => group.id === "magic-initiate-wizard:cantrips")?.count).toBe(2);
    expect(magicGroups.find((group) => group.id === "magic-initiate-wizard:spells")?.options.map((entry) => entry.label)).toEqual([
      "Shield"
    ]);

    const skilled = createFeat({ id: "skilled", name: "Skilled", source: "XPHB" });
    const skilledGroup = deriveFeatChoiceGroups(skilled, [], createActor()).find((group) => group.id === "skilled-proficiencies");
    expect(skilledGroup?.count).toBe(3);
    expect(skilledGroup?.options.some((option) => option.grants?.skills?.includes("Perception"))).toBe(true);
    expect(skilledGroup?.options.some((option) => option.grants?.tools?.includes("Thieves' Tools"))).toBe(true);
  });

  it("derives subclass choice groups on level up such as Battle Master maneuvers and Hunter tactics", () => {
    const fighterClass: ClassEntry = {
      id: "fighter-xphb",
      name: "Fighter",
      source: "XPHB",
      category: "classes",
      tags: [],
      subclasses: [],
      hitDieFaces: 10,
      features: [],
      tables: [],
      startingEquipment: []
    };

    const battleMasterLvl3Groups = deriveClassChoiceGroups(fighterClass, 2, 3, {
      spells: [],
      optionalFeatures: [],
      actor: createActor(),
      activeSubclassId: "fighter-battle-master-xphb"
    });
    const maneuverGroup = battleMasterLvl3Groups.find((g) => g.id === "battle-master-maneuvers-lvl3");
    expect(maneuverGroup).toBeDefined();
    expect(maneuverGroup?.count).toBe(3);
  });
});
