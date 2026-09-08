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
import { describe, expect, it } from "vitest";
import type { GuidedChoiceSpec, GuidedSetupState } from "../src/features/sheet/playerNpcSheet2024Types";
import {
  applyBackgroundToActor,
  applyClassSkillChoicesToActor,
  applyClassToActor,
  applyEquipmentSelectionsToActor,
  applyGuideBaseAbilities,
  applyGuideSelectionsToActor,
  applySpeciesChoiceGroupSelections,
  applySpeciesChoiceSelections,
  applySpeciesToActor,
  finalizeDraftForSave
} from "../src/features/sheet/selectors/playerNpcSheet2024Mutations";
import {
  collectFeatRows,
  collectGuidedFeatures,
  deriveAttunementCount,
  deriveBackgroundAbilityConfig,
  deriveBackgroundEquipmentGroups,
  deriveBackgroundSkillChoiceConfig,
  deriveBackgroundSkillProficiencies,
  deriveCarryingCapacity,
  deriveClassChoiceGroups,
  deriveClassEquipmentGroups,
  deriveClassSkillChoiceConfig,
  deriveFeatChoiceGroups,
  deriveGrantedSpellState,
  deriveGuidedAbilityChoiceSlots,
  deriveGuidedChoiceSpec,
  deriveGuidedHitPointMax,
  deriveOriginFeatOptions,
  derivePreparedSpellLimit,
  deriveRestSpellChoiceGroups,
  deriveScaledSpellDice,
  deriveSpeciesChoiceGroups,
  deriveSpeciesOriginFeatOptions,
  deriveSpeciesSkillChoiceConfig,
  deriveSpellSlots,
  featCanBeSelectedAgain,
  featMeetsProgressionPrerequisites,
  healHitPoints,
  mergeDerivedResources,
  normalizeHitPoints,
  parseReferenceFeatureRows,
  selectGuidedAbilityChoiceMode,
  spellMatchesSingleClassFilter,
  syncBuildClasses
} from "../src/features/sheet/selectors/playerNpcSheet2024Selectors";
import { bonusTotal, skillTotal } from "../src/features/sheet/sheetUtils";

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
    armorProficiencies: [],
    weaponProficiencies: [],
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
      perLongRest: [],
      available: []
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

function createSetupState(overrides: Partial<GuidedSetupState> = {}): GuidedSetupState {
  return {
    speciesId: "",
    speciesSizeChoice: "",
    backgroundId: "",
    classId: "",
    subclassId: "",
    hpMode: "average",
    rolledHp: 0,
    baseAbilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    backgroundAbilityModeId: "three-plus-ones",
    speciesOriginFeatId: "",
    classChoiceIds: {},
    featChoiceMap: {},
    speciesSkillChoices: [],
    backgroundSkillChoices: [],
    classSkillChoices: [],
    expertiseSkillChoices: [],
    cantripIds: [],
    knownSpellIds: [],
    spellbookSpellIds: [],
    preparedSpellIds: [],
    languageChoices: [],
    equipmentChoiceIds: {},
    abilityChoices: [],
    asiMode: "feat",
    asiAbilityMode: "+2",
    asiFeatId: "",
    asiAbilityChoices: [],
    classFeatIds: [],
    optionalFeatureIds: [],
    weaponMasteryChoices: [],
    speciesChoiceIds: {},
    originFeatId: "",
    ...overrides
  };
}

function createChoiceSpec(overrides: Partial<GuidedChoiceSpec> = {}): GuidedChoiceSpec {
  return {
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
    preparedSpellOptions: [],
    preparedSpellCount: 0,
    preparedSpellPreviousIds: [],
    preparedSpellReplacementLimit: 0,
    preparedSpellTrigger: "levelUp",
    languageOptions: [],
    languageCount: 0,
    sizeOptions: [],
    expertiseSkillOptions: [],
    expertiseCount: 0,
    abilityImprovementCount: 0,
    weaponMasteryOptions: [],
    weaponMasteryCount: 0,
    hitDieFaces: 8,
    conModifier: 0,
    averageHpGain: 0,
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
        schemaVersion: 3,
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
      perLongRest: [],
      available: []
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

  it("preserves manual prepared-spell counts without normalizing them on save", () => {
    const actor = createActor({ preparedSpells: ["Entangle", "Faerie Fire", "Healing Word"] });
    const saved = finalizeDraftForSave(actor, {
      armorClass: 10,
      proficiencyBonus: 2,
      speed: 30,
      hitPointMax: 10,
      spellSlots: [],
      resources: [],
      featureNames: [],
      preparedSpellLimit: 2,
      preparableSpellNames: ["Entangle", "Faerie Fire"]
    });
    expect(saved.preparedSpells).toEqual(["Entangle", "Faerie Fire", "Healing Word"]);
  });

  it("lets the wizard replace its class preparation set without changing other prepared spells", () => {
    const druidClass = createClass({ id: "druid-xphb", name: "Druid", source: "XPHB", spellPreparation: "prepared" });
    const druidSpells = ["Entangle", "Faerie Fire", "Healing Word", "Goodberry", "Fog Cloud", "Ice Knife"].map((name) =>
      createSpell({ id: `${name.toLowerCase().replaceAll(" ", "-")}-xphb`, name, source: "XPHB", level: 1, classes: ["Druid"] })
    );
    const shield = createSpell({ id: "shield-xphb", name: "Shield", source: "XPHB", level: 1, classes: ["Wizard"] });
    const compendium = createCompendium({ classes: [druidClass], spells: [...druidSpells, shield] });
    let actor = applyClassToActor(createActor(), druidClass, compendium.classes);
    actor.preparedSpells = [...druidSpells.slice(0, 5).map((spell) => spell.name), shield.name];
    const druidActorClassId = actor.classes[0]?.id ?? "";
    actor.build = {
      ...(actor.build ?? { ruleset: "dnd-2024", mode: "guided", classes: [], selections: [] }),
      schemaVersion: 3,
      configurations: [
        {
          id: "druid-preparations",
          ownerRef: "Druid|XPHB",
          ownerInstanceId: druidActorClassId,
          groupId: "prepared-spells",
          trigger: "longRest",
          replacementLimit: "all",
          activeOptionIds: druidSpells.slice(0, 5).map((spell) => spell.id),
          activeEffects: druidSpells.slice(0, 5).map((spell, index) => ({
            id: `druid-preparations:${index}`,
            kind: "spell",
            ref: `${spell.name}|${spell.source}`,
            bucket: "prepared"
          }))
        }
      ]
    };
    const spec = deriveGuidedChoiceSpec({
      actor,
      classes: compendium.classes,
      spells: compendium.spells,
      feats: [],
      optionalFeatures: [],
      targetClassId: druidClass.id,
      targetActorClassId: druidActorClassId,
      targetSubclassId: "",
      mode: "levelup"
    });
    const chosenDruidSpells = druidSpells.slice(1, 6);

    actor = applyGuideSelectionsToActor(actor, {
      compendium,
      setup: {
        speciesId: "",
        backgroundId: "",
        classId: druidClass.id,
        subclassId: "",
        baseAbilities: actor.abilities,
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
        preparedSpellIds: chosenDruidSpells.map((spell) => spell.id),
        expertiseSkillChoices: [],
        weaponMasteryChoices: [],
        asiMode: "feat",
        asiAbilityMode: "+2",
        asiFeatId: "",
        asiAbilityChoices: [],
        speciesSkillChoices: [],
        backgroundSkillChoices: [],
        classSkillChoices: [],
        languageChoices: [],
        speciesSizeChoice: "Medium",
        speciesOriginFeatId: "",
        speciesChoiceIds: {},
        originFeatId: "",
        equipmentChoiceIds: {},
        abilityChoices: []
      },
      spec,
      level: 2,
      targetClass: druidClass,
      targetActorClassId: druidActorClassId,
      mode: "levelup"
    });

    expect(spec.preparedSpellCount).toBe(5);
    expect(actor.preparedSpells).toEqual([shield.name, ...chosenDruidSpells.map((spell) => spell.name)]);
  });

  it("filters Weapon Mastery choices by the class weapon proficiencies", () => {
    const rogue = createClass({ id: "rogue-xphb", name: "Rogue", source: "XPHB" });
    const spec = deriveGuidedChoiceSpec({
      actor: createActor(),
      classes: [rogue],
      spells: [],
      feats: [],
      optionalFeatures: [],
      targetClassId: rogue.id,
      targetActorClassId: "",
      targetSubclassId: "",
      mode: "setup"
    });

    expect(spec.weaponMasteryOptions).toContain("Dagger (Nick)");
    expect(spec.weaponMasteryOptions).toContain("Rapier (Vex)");
    expect(spec.weaponMasteryOptions).toContain("Shortsword (Vex)");
    expect(spec.weaponMasteryOptions).not.toContain("Greatsword (Graze)");
  });

  it("treats Sentinel's Strength or Dexterity prerequisite as OR", () => {
    const sentinel = createFeat({ id: "sentinel", name: "Sentinel", source: "XPHB", category: "General" });
    expect(
      featMeetsProgressionPrerequisites(sentinel, createActor({ abilities: { str: 10, dex: 13, con: 10, int: 10, wis: 10, cha: 10 } }), 4)
    ).toBe(true);
    expect(
      featMeetsProgressionPrerequisites(sentinel, createActor({ abilities: { str: 12, dex: 12, con: 10, int: 10, wis: 10, cha: 10 } }), 4)
    ).toBe(false);
  });

  it("prevents duplicate nonrepeatable feats while allowing repeatable feats", () => {
    const actor = createActor({ feats: ["Alert", "Skilled"] });
    expect(featCanBeSelectedAgain(createFeat({ id: "alert", name: "Alert", source: "XPHB" }), actor)).toBe(false);
    expect(featCanBeSelectedAgain(createFeat({ id: "skilled", name: "Skilled", source: "XPHB" }), actor)).toBe(true);
  });

  it("applies proficiency-scaled and level-scaled feat grants from progression JSON", () => {
    const fighter = createClass({ id: "fighter-xphb", name: "Fighter", source: "XPHB", hitDieFaces: 10 });
    const feats = [
      createFeat({ id: "alert", name: "Alert", source: "XPHB" }),
      createFeat({ id: "lucky", name: "Lucky", source: "XPHB" }),
      createFeat({ id: "tough", name: "Tough", source: "XPHB" })
    ];
    const compendium = createCompendium({ classes: [fighter], feats });
    const actorClass: ActorClassEntry = {
      id: "fighter-class",
      compendiumId: fighter.id,
      name: fighter.name,
      level: 5,
      hitDieFaces: 10,
      usedHitDice: 0,
      subclassId: "",
      subclassName: "",
      source: "XPHB",
      spellcastingAbility: null
    };
    const actor = applyGuideSelectionsToActor(createActor({ classes: [actorClass], level: 5, proficiencyBonus: 3 }), {
      compendium,
      setup: createSetupState({ classId: fighter.id, classFeatIds: feats.map((feat) => feat.id) }),
      spec: createChoiceSpec({ classFeatOptions: feats, classFeatCount: 3 }),
      level: 5,
      targetClass: fighter,
      targetActorClassId: actorClass.id,
      mode: "levelup"
    });

    expect(bonusTotal(actor, "initiative")).toBe(3);
    expect(actor.resources.find((resource) => resource.name === "Luck Points")).toMatchObject({ current: 3, max: 3 });
    expect(deriveGuidedHitPointMax(actor)).toBe(22);
  });

  it("materializes exact-level Mystic Arcanum choices and spellbook-only rest choices from JSON", () => {
    const warlock = createClass({ id: "warlock-xphb", name: "Warlock", source: "XPHB" });
    const wizard = createClass({ id: "wizard-xphb", name: "Wizard", source: "XPHB" });
    const circleOfDeath = createSpell({
      id: "circle-of-death-xphb",
      name: "Circle of Death",
      source: "XPHB",
      level: 6,
      classes: ["Warlock"]
    });
    const fingerOfDeath = createSpell({
      id: "finger-of-death-xphb",
      name: "Finger of Death",
      source: "XPHB",
      level: 7,
      classes: ["Warlock"]
    });
    const shield = createSpell({ id: "shield-xphb", name: "Shield", source: "XPHB", level: 1, classes: ["Wizard"] });
    const magicMissile = createSpell({ id: "magic-missile-xphb", name: "Magic Missile", source: "XPHB", level: 1, classes: ["Wizard"] });
    const actor = createActor({
      classes: [
        {
          id: "wizard-class",
          compendiumId: wizard.id,
          name: "Wizard",
          source: "XPHB",
          level: 18,
          hitDieFaces: 6,
          usedHitDice: 0,
          spellcastingAbility: "int"
        }
      ],
      spellState: {
        spellbook: ["Shield"],
        alwaysPrepared: [],
        atWill: [],
        perShortRest: [],
        perLongRest: []
      }
    });
    const arcanumGroups = deriveClassChoiceGroups(warlock, 10, 11, {
      spells: [circleOfDeath, fingerOfDeath],
      optionalFeatures: [],
      actor: createActor(),
      characterLevel: 11
    });
    const arcanum = arcanumGroups.find((group) => group.id === "mystic-arcanum-6");
    expect(arcanum?.spellBucket).toBe("perLongRest");
    expect(arcanum?.options.map((option) => option.label)).toEqual(["Circle of Death"]);

    const restGroups = deriveRestSpellChoiceGroups(actor, [shield, magicMissile]);
    expect(restGroups.find((group) => group.groupId === "wizard-spell-mastery-1")?.options.map((spell) => spell.name)).toEqual(["Shield"]);
  });

  it("derives Pact of the Tome child spell choices and exposes them for later Short Rest changes", () => {
    const warlock = createClass({ id: "warlock-xphb", name: "Warlock", source: "XPHB" });
    const fireBolt = createSpell({ id: "fire-bolt-xphb", name: "Fire Bolt", source: "XPHB", level: "cantrip", classes: ["Wizard"] });
    const guidance = createSpell({ id: "guidance-xphb", name: "Guidance", source: "XPHB", level: "cantrip", classes: ["Cleric"] });
    const alarm = createSpell({ id: "alarm-xphb", name: "Alarm", source: "XPHB", level: 1, classes: ["Wizard"] });
    const detectMagic = createSpell({ id: "detect-magic-xphb", name: "Detect Magic", source: "XPHB", level: 1, classes: ["Wizard"] });
    const burningHands = createSpell({ id: "burning-hands-xphb", name: "Burning Hands", source: "XPHB", level: 1, classes: ["Wizard"] });
    const spells = [fireBolt, guidance, alarm, detectMagic, burningHands];
    const actor = createActor({
      classes: [
        {
          id: "warlock-class",
          compendiumId: warlock.id,
          name: "Warlock",
          source: "XPHB",
          level: 1,
          hitDieFaces: 8,
          usedHitDice: 0,
          spellcastingAbility: "cha"
        }
      ],
      preparedSpells: ["Guidance"],
      spellState: {
        spellbook: [],
        alwaysPrepared: ["Detect Magic"],
        atWill: [],
        perShortRest: [],
        perLongRest: []
      },
      build: {
        ruleset: "dnd-2024",
        schemaVersion: 3,
        mode: "guided",
        classes: [],
        selections: [],
        configurations: [
          {
            id: "configuration:warlock-class:warlock-invocations",
            ownerRef: "Warlock|XPHB",
            ownerInstanceId: "warlock-class",
            groupId: "warlock-invocations",
            trigger: "levelUp",
            replacementLimit: 1,
            activeOptionIds: ["pact-of-the-tome"],
            activeEffects: []
          }
        ]
      }
    });

    const wizardGroups = deriveClassChoiceGroups(warlock, 0, 1, {
      spells,
      optionalFeatures: [],
      actor,
      selectedClassChoiceIds: { "warlock-invocations": ["pact-of-the-tome"] }
    });
    expect(wizardGroups.find((group) => group.id === "pact-tome-cantrips")).toMatchObject({
      count: 3,
      parentOption: { groupId: "warlock-invocations", optionId: "pact-of-the-tome" },
      configurationTrigger: "shortOrLongRest"
    });
    expect(wizardGroups.find((group) => group.id === "pact-tome-cantrips")?.options.map((option) => option.label)).toEqual(["Fire Bolt"]);
    expect(wizardGroups.find((group) => group.id === "pact-tome-rituals")?.options.map((option) => option.label)).toEqual(["Alarm"]);

    const restGroups = deriveRestSpellChoiceGroups(actor, spells);
    expect(restGroups.find((group) => group.groupId === "pact-tome-cantrips")?.options.map((spell) => spell.name)).toEqual(["Fire Bolt"]);
    expect(restGroups.find((group) => group.groupId === "pact-tome-rituals")?.options.map((spell) => spell.name)).toEqual(["Alarm"]);
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

  it("limits guided spell choices to the JSON class list, spell kind, learnable level, and unlearned spells", () => {
    const wizard = createClass({ id: "wizard-xphb", name: "Wizard", source: "XPHB", spellPreparation: "spellbook" });
    const actor = createActor({ spells: ["Magic Missile"] });
    const fireBolt = createSpell({ id: "fire-bolt", name: "Fire Bolt", level: "cantrip", classes: ["Wizard"], damageNotation: "1d10" });
    const guidance = createSpell({ id: "guidance", name: "Guidance", level: "cantrip", classes: ["Cleric"] });
    const shield = createSpell({ id: "shield", name: "Shield", level: 1, classes: ["Wizard"] });
    const magicMissile = createSpell({ id: "magic-missile", name: "Magic Missile", level: 1, classes: ["Wizard"] });
    const mistyStep = createSpell({ id: "misty-step", name: "Misty Step", level: 2, classes: ["Wizard"] });

    const choiceSpec = deriveGuidedChoiceSpec({
      actor,
      classes: [wizard],
      spells: [fireBolt, guidance, shield, magicMissile, mistyStep],
      feats: [],
      optionalFeatures: [],
      targetClassId: wizard.id,
      targetActorClassId: "",
      targetSubclassId: "",
      mode: "setup"
    });

    expect(choiceSpec.cantripOptions.map((spell) => spell.name)).toEqual(["Fire Bolt"]);
    expect(choiceSpec.spellbookOptions.map((spell) => spell.name)).toEqual(["Shield"]);
    expect(choiceSpec.spellbookOptions.map((spell) => spell.name)).not.toContain("Misty Step");
    expect(choiceSpec.spellbookOptions.map((spell) => spell.name)).not.toContain("Magic Missile");
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
      setup: createSetupState({
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
        knownSpellIds: [spell.id],
        speciesSkillChoices: ["Perception"],
        originFeatId: originFeat.id,
        equipmentChoiceIds: { "group-1": "option-1" },
        abilityChoices: ["int", "wis"]
      }),
      spec: createChoiceSpec({
        classFeatOptions: [guideFeat],
        classFeatCount: 1,
        knownSpellOptions: [spell],
        knownSpellCount: 1
      }),
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
      setup: createSetupState({
        classId: classEntry.id,
        baseAbilities: {
          str: 10,
          dex: 12,
          con: 14,
          int: 16,
          wis: 16,
          cha: 10
        },
        hpMode: "average",
        classFeatIds: [feat.id]
      }),
      spec: createChoiceSpec({
        classFeatOptions: [feat],
        classFeatCount: 1,
        weaponMasteryOptions: ["Dagger (Nick)", "Shortsword (Vex)"],
        weaponMasteryCount: 0,
        averageHpGain: 6
      }),
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
    const classEntry: ClassEntry = createClass({
      id: "cls-fighter",
      name: "Fighter",
      source: "XPHB",
      description: "A master of martial combat.",
      hitDieFaces: 10,
      primaryAbilities: ["str"],
      savingThrowProficiencies: ["Str", "Con"],
      spellcastingAbility: null,
      spellPreparation: "none",
      subclassLevel: 3,
      features: [
        { level: 1, name: "Weapon Mastery", description: "Master weapons.", source: "XPHB", reference: "" },
        { level: 4, name: "Ability Score Improvement", description: "Increase scores.", source: "XPHB", reference: "" }
      ]
    });

    let actor = createActor({ abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 8 } });
    actor = applyClassToActor(actor, classEntry, [classEntry]);
    const compendium = createCompendium({ classes: [classEntry] });

    // Apply +2 ASI and Weapon Masteries
    actor = applyGuideSelectionsToActor(actor, {
      compendium,
      setup: createSetupState({
        classId: classEntry.id,
        baseAbilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 8 },
        hpMode: "average",
        weaponMasteryChoices: ["Greatsword (Graze)", "Halberd (Cleave)"],
        asiMode: "ability",
        asiAbilityMode: "+2",
        asiAbilityChoices: ["str"]
      }),
      spec: createChoiceSpec({
        weaponMasteryOptions: ["Greatsword (Graze)", "Halberd (Cleave)"],
        weaponMasteryCount: 2,
        abilityImprovementCount: 1,
        averageHpGain: 8
      }),
      level: 4,
      targetClass: classEntry,
      targetActorClassId: actor.classes[0]?.id ?? null,
      mode: "levelup"
    });

    expect(actor.abilities.str).toBe(18);
    expect(actor.weaponMasteries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ weaponName: "Greatsword", mastery: "Graze" }),
        expect.objectContaining({ weaponName: "Halberd", mastery: "Cleave" })
      ])
    );
    expect(actor.features.some((entry) => entry.startsWith("Weapon Mastery:"))).toBe(false);
  });

  it("applies scripted class choices like Cleric Divine Orders with automated grants", () => {
    const clericEntry: ClassEntry = createClass({
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
      features: [{ level: 1, name: "Divine Order", description: "Choose a sacred order.", source: "XPHB", reference: "" }]
    });

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
    expect(choiceSpec.classChoiceGroups[0]?.id).toBe("cleric-divine-order");

    // Select Protector Divine Order
    actor = applyGuideSelectionsToActor(actor, {
      compendium,
      setup: createSetupState({
        classId: clericEntry.id,
        baseAbilities: { str: 14, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
        hpMode: "average",
        classChoiceIds: { "cleric-divine-order": ["protector"] }
      }),
      spec: choiceSpec,
      level: 1,
      targetClass: clericEntry,
      targetActorClassId: actor.classes[0]?.id ?? null,
      mode: "setup"
    });

    expect(actor.armorProficiencies).toContain("Heavy Armor");
    expect(actor.weaponProficiencies).toContain("Martial Weapons");
  });

  it("keeps prepared spells owned by their class configuration", () => {
    const cleric = createClass({ id: "cleric-xphb", name: "Cleric", source: "XPHB", spellPreparation: "prepared" });
    const druid = createClass({ id: "druid-xphb", name: "Druid", source: "XPHB", spellPreparation: "prepared" });
    const cureWounds = createSpell({ id: "cure-wounds-xphb", name: "Cure Wounds", source: "XPHB", classes: ["Cleric", "Druid"] });
    const bless = createSpell({ id: "bless-xphb", name: "Bless", source: "XPHB", classes: ["Cleric"] });
    const compendium = createCompendium({ classes: [cleric, druid], spells: [cureWounds, bless] });
    let actor = applyClassToActor(createActor(), cleric, [cleric, druid]);
    actor = applyClassToActor(actor, druid, [cleric, druid]);
    const clericClassId = actor.classes.find((entry) => entry.name === "Cleric")?.id ?? null;
    const druidClassId = actor.classes.find((entry) => entry.name === "Druid")?.id ?? null;
    const spec = createChoiceSpec({
      preparedSpellOptions: [cureWounds, bless],
      preparedSpellCount: 1,
      preparedSpellReplacementLimit: 1
    });

    actor = applyGuideSelectionsToActor(actor, {
      compendium,
      setup: createSetupState({ preparedSpellIds: [cureWounds.id] }),
      spec,
      level: 2,
      targetClass: cleric,
      targetActorClassId: clericClassId,
      mode: "levelup"
    });
    actor = applyGuideSelectionsToActor(actor, {
      compendium,
      setup: createSetupState({ preparedSpellIds: [cureWounds.id] }),
      spec,
      level: 2,
      targetClass: druid,
      targetActorClassId: druidClassId,
      mode: "levelup"
    });
    actor = applyGuideSelectionsToActor(actor, {
      compendium,
      setup: createSetupState({ preparedSpellIds: [bless.id] }),
      spec: { ...spec, preparedSpellPreviousIds: [cureWounds.id] },
      level: 3,
      targetClass: cleric,
      targetActorClassId: clericClassId,
      mode: "levelup"
    });

    expect(actor.build?.configurations?.filter((entry) => entry.groupId === "prepared-spells")).toHaveLength(2);
    expect(actor.preparedSpells).toEqual(expect.arrayContaining(["Bless", "Cure Wounds"]));
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
      classes: [
        {
          id: "c1",
          compendiumId: "druid-xphb",
          name: "Druid",
          source: "XPHB",
          level: 1,
          hitDieFaces: 8,
          usedHitDice: 0,
          subclassId: "",
          subclassName: "",
          spellcastingAbility: "wis"
        }
      ]
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
        { id: "skill-arcana", name: "Arcana", ability: "int", proficient: false, expertise: false },
        { id: "skill-nature", name: "Nature", ability: "int", proficient: true, expertise: false } // prof bonus = 2, int = 1
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
      createFeat({ id: "feat-alert", name: "Alert", category: "Origin", description: "Always on alert", source: "XPHB" }),
      createFeat({ id: "feat-tough", name: "Tough", category: "Origin", description: "Extra HP", source: "XPHB" }),
      createFeat({
        id: "feat-gwm",
        name: "Great Weapon Master",
        category: "General",
        description: "Heavy weapons",
        source: "XPHB",
        prerequisites: "Level 4"
      })
    ];

    const originOptions = deriveSpeciesOriginFeatOptions(humanSpecies, feats);
    expect(originOptions.some((f) => f.name === "Alert")).toBe(true);
    expect(originOptions.some((f) => f.name === "Tough")).toBe(true);
    expect(originOptions.some((f) => f.name === "Great Weapon Master")).toBe(false);

    const skills: CompendiumReferenceEntry[] = [
      { id: "sk-athletics", name: "Athletics", category: "skill", description: "", source: "XPHB", entries: "", tags: [] },
      { id: "sk-stealth", name: "Stealth", category: "skill", description: "", source: "XPHB", entries: "", tags: [] }
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
    const fighterClass: ClassEntry = createClass({
      id: "fighter-xphb",
      name: "Fighter",
      source: "XPHB",
      hitDieFaces: 10
    });

    const fighterLvl1Groups = deriveClassChoiceGroups(fighterClass, 0, 1, {
      spells: [],
      optionalFeatures: [],
      actor: createActor()
    });
    expect(fighterLvl1Groups.some((g) => g.id === "fighter-fighting-style")).toBe(true);

    const sorcererClass: ClassEntry = createClass({
      id: "sorcerer-xphb",
      name: "Sorcerer",
      source: "XPHB",
      hitDieFaces: 6
    });

    const sorcererLvl2Groups = deriveClassChoiceGroups(sorcererClass, 1, 2, {
      spells: [],
      optionalFeatures: [],
      actor: createActor()
    });
    const metamagicGroup = sorcererLvl2Groups.find((g) => g.id === "sorcerer-metamagic");
    expect(metamagicGroup).toBeDefined();
    expect(metamagicGroup?.count).toBe(2);

    const warlockClass: ClassEntry = createClass({
      id: "warlock-xphb",
      name: "Warlock",
      source: "XPHB",
      hitDieFaces: 8
    });

    const warlockLvl1Groups = deriveClassChoiceGroups(warlockClass, 0, 1, {
      spells: [],
      optionalFeatures: [],
      actor: createActor()
    });
    const invocationGroup = warlockLvl1Groups.find((g) => g.id === "warlock-invocations");
    expect(invocationGroup).toBeDefined();
    expect(invocationGroup?.options.map((option) => option.label)).toEqual([
      "Armor of Shadows",
      "Eldritch Mind",
      "Pact of the Blade",
      "Pact of the Chain",
      "Pact of the Tome"
    ]);
    const warlockLvl2Groups = deriveClassChoiceGroups(warlockClass, 1, 2, {
      spells: [],
      optionalFeatures: [],
      actor: createActor()
    });
    expect(warlockLvl2Groups.find((group) => group.id === "warlock-invocations")?.count).toBe(3);
    expect(warlockLvl2Groups.find((group) => group.id === "warlock-invocations")?.options.length).toBeGreaterThanOrEqual(7);

    const sorcererLvl10Groups = deriveClassChoiceGroups(sorcererClass, 9, 10, {
      spells: [],
      optionalFeatures: [],
      actor: createActor()
    });
    expect(sorcererLvl10Groups.find((group) => group.id === "sorcerer-metamagic")?.count).toBe(4);

    const druidClass = createClass({ id: "druid-xphb", name: "Druid", source: "XPHB" });
    const druidCantrip = createSpell({ id: "guidance-xphb", name: "Guidance", source: "XPHB", level: "cantrip", classes: ["Druid"] });
    const druidGroups = deriveClassChoiceGroups(druidClass, 0, 1, {
      spells: [druidCantrip],
      optionalFeatures: [],
      actor: createActor()
    });
    expect(druidGroups.find((group) => group.id === "druid-primal-order")?.options.map((option) => option.label)).toEqual([
      "Magician",
      "Warden"
    ]);
    expect(druidGroups.find((group) => group.id === "druid-primal-order:magician:cantrips")?.parentOption).toEqual({
      groupId: "druid-primal-order",
      optionId: "magician"
    });
    expect(druidGroups.find((group) => group.id === "druid-primal-order:magician:cantrips")?.selectionKind).toBe("spells");
    for (const primalOrder of ["magician", "warden"]) {
      expect(() =>
        deriveGuidedChoiceSpec({
          actor: createActor(),
          classes: [druidClass],
          spells: [druidCantrip],
          feats: [],
          optionalFeatures: [],
          targetClassId: druidClass.id,
          targetActorClassId: "",
          targetSubclassId: "",
          mode: "setup",
          selectedClassChoiceIds: { "druid-primal-order": [primalOrder] }
        })
      ).not.toThrow();
    }
    expect(
      deriveGuidedChoiceSpec({
        actor: createActor(),
        classes: [druidClass],
        spells: [druidCantrip],
        feats: [],
        optionalFeatures: [],
        targetClassId: druidClass.id,
        targetActorClassId: "",
        targetSubclassId: "",
        mode: "setup"
      }).languageOptions
    ).toContain("Draconic");

    const rangerClass = createClass({ id: "ranger-xphb", name: "Ranger", source: "XPHB" });
    const rangerGroups = deriveClassChoiceGroups(rangerClass, 1, 2, {
      spells: [druidCantrip],
      optionalFeatures: [],
      actor: createActor()
    });
    expect(rangerGroups.find((group) => group.id === "ranger-fighting-style:druidic-warrior:cantrips")).toMatchObject({
      count: 2,
      selectionKind: "spells"
    });

    const paladinClass = createClass({ id: "paladin-xphb", name: "Paladin", source: "XPHB" });
    const clericCantrip = createSpell({
      id: "thaumaturgy-xphb",
      name: "Thaumaturgy",
      source: "XPHB",
      level: "cantrip",
      classes: ["Cleric"]
    });
    const paladinGroups = deriveClassChoiceGroups(paladinClass, 1, 2, {
      spells: [clericCantrip],
      optionalFeatures: [],
      actor: createActor()
    });
    expect(paladinGroups.find((group) => group.id === "paladin-fighting-style:blessed-warrior:cantrips")).toMatchObject({
      count: 2,
      selectionKind: "spells"
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
    expect(magicGroups.find((group) => group.id === "magic-initiate-wizard:cantrips")).toMatchObject({
      count: 2,
      selectionKind: "spells",
      spellBucket: "known"
    });
    expect(magicGroups.find((group) => group.id === "magic-initiate-wizard:spells")?.spellBucket).toBe("alwaysPreparedPerLongRest");
    expect(magicGroups.find((group) => group.id === "magic-initiate-wizard:spells")?.options.map((entry) => entry.label)).toEqual([
      "Shield"
    ]);

    const skilled = createFeat({ id: "skilled", name: "Skilled", source: "XPHB" });
    const skilledGroup = deriveFeatChoiceGroups(skilled, [], createActor()).find((group) => group.id === "skilled-proficiencies");
    expect(skilledGroup?.count).toBe(3);
    expect(skilledGroup?.options.some((option) => option.grants?.skills?.includes("Perception"))).toBe(true);
    expect(skilledGroup?.options.some((option) => option.grants?.tools?.includes("Thieves' Tools"))).toBe(true);
  });

  it("offers every Magic Initiate list to Humans and stores its leveled spell outside class preparation", () => {
    const human = createSpecies({ id: "human-xphb", name: "Human", source: "XPHB" });
    const magicInitiate = createFeat({
      id: "compendium-magic-initiate",
      name: "Magic Initiate",
      source: "XPHB",
      description: "Choose a Cleric, Druid, or Wizard spell list."
    });
    const light = createSpell({ id: "light-xphb", name: "Light", source: "XPHB", level: "cantrip", classes: ["Wizard"] });
    const mageHand = createSpell({ id: "mage-hand-xphb", name: "Mage Hand", source: "XPHB", level: "cantrip", classes: ["Wizard"] });
    const shield = createSpell({ id: "shield-xphb", name: "Shield", source: "XPHB", level: 1, classes: ["Wizard"] });
    const druidClass = createClass({ id: "druid-xphb", name: "Druid", source: "XPHB", spellPreparation: "prepared" });
    const feats = [magicInitiate];
    const compendium = createCompendium({ classes: [druidClass], feats, races: [human], spells: [light, mageHand, shield] });

    const humanFeatOptions = deriveSpeciesOriginFeatOptions(human, feats);
    expect(humanFeatOptions.map((feat) => feat.id).sort()).toEqual([
      "magic-initiate-cleric",
      "magic-initiate-druid",
      "magic-initiate-wizard"
    ]);
    expect(humanFeatOptions.every((feat) => feat.description === magicInitiate.description)).toBe(true);
    expect(deriveOriginFeatOptions(createBackground({ id: "sage-xphb", source: "XPHB" }), feats)[0]).toMatchObject({
      id: "magic-initiate-wizard",
      name: "Magic Initiate (Wizard)",
      description: magicInitiate.description
    });
    expect(collectFeatRows(["Magic Initiate (Wizard)"], feats)[0]).toMatchObject({
      title: "Magic Initiate (Wizard)",
      description: magicInitiate.description
    });

    let actor = applyClassToActor(createActor(), druidClass, [druidClass]);
    const spec = deriveGuidedChoiceSpec({
      actor,
      classes: [druidClass],
      spells: [light, mageHand, shield],
      feats,
      optionalFeatures: [],
      targetClassId: druidClass.id,
      targetActorClassId: "",
      targetSubclassId: "",
      mode: "setup"
    });
    actor = applyGuideSelectionsToActor(actor, {
      compendium,
      setup: {
        speciesId: human.id,
        backgroundId: "",
        classId: druidClass.id,
        subclassId: "",
        baseAbilities: actor.abilities,
        backgroundAbilityModeId: "",
        hpMode: "average",
        rolledHp: null,
        classFeatIds: [],
        optionalFeatureIds: [],
        classChoiceIds: {},
        featChoiceMap: {
          "magic-initiate-wizard": {
            "magic-initiate-wizard-ability": ["wis"],
            "magic-initiate-wizard:cantrips": [light.id, mageHand.id],
            "magic-initiate-wizard:spells": [shield.id]
          }
        },
        cantripIds: [],
        knownSpellIds: [],
        spellbookSpellIds: [],
        preparedSpellIds: [],
        expertiseSkillChoices: [],
        weaponMasteryChoices: [],
        asiMode: "feat",
        asiAbilityMode: "+2",
        asiFeatId: "",
        asiAbilityChoices: [],
        speciesSkillChoices: [],
        backgroundSkillChoices: [],
        classSkillChoices: [],
        languageChoices: ["Common"],
        speciesSizeChoice: "Medium",
        speciesOriginFeatId: "magic-initiate-wizard",
        speciesChoiceIds: {},
        originFeatId: "",
        equipmentChoiceIds: {},
        abilityChoices: []
      },
      spec,
      level: 1,
      targetClass: druidClass,
      targetActorClassId: actor.classes[0]?.id ?? null,
      mode: "setup"
    });

    expect(actor.spells).toEqual(expect.arrayContaining(["Light", "Mage Hand", "Shield"]));
    expect(actor.spellState.alwaysPrepared).toContain("Shield");
    expect(actor.spellState.perLongRest).toContain("Shield");
    expect(actor.preparedSpells).not.toContain("Shield");
    expect(actor.feats).toContain("Magic Initiate (Wizard)");
  });

  it("derives subclass choice groups on level up such as Battle Master maneuvers and Hunter tactics", () => {
    const fighterClass: ClassEntry = createClass({
      id: "fighter-xphb",
      name: "Fighter",
      source: "XPHB",
      hitDieFaces: 10
    });

    const battleMasterLvl3Groups = deriveClassChoiceGroups(fighterClass, 2, 3, {
      spells: [],
      optionalFeatures: [],
      actor: createActor(),
      activeSubclassId: "fighter-battle-master-xphb"
    });
    const maneuverGroup = battleMasterLvl3Groups.find((g) => g.id === "battle-master-maneuvers");
    expect(maneuverGroup).toBeDefined();
    expect(maneuverGroup?.count).toBe(3);
    expect(maneuverGroup?.options.find((option) => option.label === "Riposte")?.grants?.features).toEqual(["Riposte"]);

    const battleMasterLvl7Groups = deriveClassChoiceGroups(fighterClass, 6, 7, {
      spells: [],
      optionalFeatures: [],
      actor: createActor({ features: ["Riposte", "Parry", "Precision Attack"] }),
      activeSubclassId: "fighter-battle-master-xphb"
    });
    const additionalManeuvers = battleMasterLvl7Groups.find((group) => group.id === "battle-master-maneuvers");
    expect(additionalManeuvers?.count).toBe(5);
    expect(additionalManeuvers?.options.some((option) => option.label === "Riposte")).toBe(false);

    const runeGroups = deriveClassChoiceGroups(fighterClass, 6, 7, {
      spells: [],
      optionalFeatures: [],
      actor: createActor(),
      activeSubclassId: "fighter-rune-knight-tce"
    });
    const runes = runeGroups.find((group) => group.id === "rune-knight-runes");
    expect(runes?.count).toBe(3);
    expect(runes?.options.map((option) => option.label)).toEqual(
      expect.arrayContaining(["Cloud Rune", "Fire Rune", "Frost Rune", "Stone Rune", "Hill Rune", "Storm Rune"])
    );
  });

  it("offers Lore Magical Discoveries from the three allowed lists up to the available slot level", () => {
    const bard = createClass({ id: "bard-xphb", name: "Bard", source: "XPHB" });
    const groups = deriveClassChoiceGroups(bard, 5, 6, {
      actor: createActor(),
      activeSubclassId: "bard-lore-xphb",
      optionalFeatures: [],
      spells: [
        createSpell({ id: "guidance", name: "Guidance", level: "cantrip", classes: ["Cleric"] }),
        createSpell({ id: "fireball", name: "Fireball", level: 3, classes: ["Wizard"] }),
        createSpell({ id: "polymorph", name: "Polymorph", level: 4, classes: ["Wizard"] }),
        createSpell({ id: "dissonant-whispers", name: "Dissonant Whispers", level: 1, classes: ["Bard"] })
      ]
    });
    const discoveries = groups.find((group) => group.id === "lore-magical-discoveries");

    expect(discoveries).toMatchObject({ count: 2, spellBucket: "alwaysPrepared", configurationTrigger: "levelUp" });
    expect(discoveries?.options.map((option) => option.label)).toEqual(["Guidance", "Fireball"]);
  });

  it("filters spells by class including source book and subclass annotations", () => {
    const druidSpellWithSource = createSpell({
      id: "druidcraft-xphb",
      name: "Druidcraft",
      level: "cantrip",
      classes: ["Druid (XPHB)"]
    });
    const wizardSpell = createSpell({
      id: "fire-bolt-xphb",
      name: "Fire Bolt",
      level: "cantrip",
      classes: ["Wizard (XPHB)"]
    });
    const subclassSpell = createSpell({
      id: "call-lightning-xphb",
      name: "Call Lightning",
      level: 3,
      classes: ["Circle of the Land (Druid)"],
      classReferences: [
        {
          name: "Circle of the Land",
          className: "Druid (XPHB)",
          classSource: "XPHB",
          source: "XPHB",
          kind: "subclass",
          definedInSources: ["XPHB"]
        }
      ]
    });

    expect(spellMatchesSingleClassFilter(druidSpellWithSource, "druid")).toBe(true);
    expect(spellMatchesSingleClassFilter(druidSpellWithSource, "Druid")).toBe(true);
    expect(spellMatchesSingleClassFilter(druidSpellWithSource, "Druid (XPHB)")).toBe(true);
    expect(spellMatchesSingleClassFilter(druidSpellWithSource, "Druid (PHB)")).toBe(false);
    expect(spellMatchesSingleClassFilter(wizardSpell, "druid")).toBe(false);
    expect(spellMatchesSingleClassFilter(wizardSpell, "Druid (XPHB)")).toBe(false);
    expect(spellMatchesSingleClassFilter(subclassSpell, "Druid (XPHB)")).toBe(false);
    expect(spellMatchesSingleClassFilter(subclassSpell, "Circle of the Land (Druid)")).toBe(true);

    const druidClass = createClass({ id: "druid-xphb", name: "Druid", source: "XPHB" });
    const spec = deriveGuidedChoiceSpec({
      actor: createActor(),
      classes: [druidClass],
      spells: [druidSpellWithSource, wizardSpell, subclassSpell],
      feats: [],
      optionalFeatures: [],
      targetClassId: "druid-xphb",
      targetActorClassId: "",
      targetSubclassId: "",
      mode: "setup"
    });

    expect(spec.cantripOptions.map((s) => s.name)).toEqual(["Druidcraft"]);
    expect(spec.cantripCount).toBe(2);
    expect(spec.preparedSpellCount).toBe(4);
  });

  it("does not block a class spellbook addition merely because another class owns the same spell name", () => {
    const wizard = createClass({ id: "wizard-xphb", name: "Wizard", source: "XPHB" });
    const magicMissile = createSpell({ id: "magic-missile-xphb", name: "Magic Missile", level: 1, classes: ["Wizard"] });
    const wizardClass: ActorClassEntry = {
      id: "wizard-class",
      compendiumId: wizard.id,
      name: "Wizard",
      level: 1,
      hitDieFaces: 6,
      usedHitDice: 0,
      subclassId: "",
      subclassName: "",
      source: "XPHB",
      spellcastingAbility: "int"
    };
    const actor = createActor({
      classes: [
        wizardClass,
        {
          ...wizardClass,
          id: "cleric-class",
          compendiumId: "cleric-xphb",
          name: "Cleric",
          hitDieFaces: 8,
          spellcastingAbility: "wis"
        }
      ],
      spells: [magicMissile.name]
    });
    const spec = deriveGuidedChoiceSpec({
      actor,
      classes: [wizard],
      spells: [magicMissile],
      feats: [],
      optionalFeatures: [],
      targetClassId: wizard.id,
      targetActorClassId: wizardClass.id,
      targetSubclassId: "",
      mode: "levelup"
    });

    expect(spec.spellbookOptions.map((spell) => spell.name)).toContain("Magic Missile");
  });

  it("filters generic subclass placeholders and decomposes into individual subclass features", () => {
    const fighterClass = createClass({
      id: "fighter-xphb",
      name: "Fighter",
      source: "XPHB"
    });
    const championSubclass = {
      id: "fighter-champion-xphb",
      name: "Champion",
      shortName: "Champion",
      source: "XPHB",
      className: "Fighter",
      classSource: "XPHB",
      description: "Champion fighter archetype",
      features: [
        {
          level: 3,
          name: "Improved Critical",
          description: "Your attack rolls score a critical hit on a roll of 19 or 20.",
          source: "XPHB",
          reference: ""
        },
        {
          level: 3,
          name: "Remarkable Athlete",
          description: "Add half your proficiency bonus to athletic checks.",
          source: "XPHB",
          reference: ""
        }
      ]
    };
    fighterClass.subclasses = [championSubclass];

    const actor = createActor({
      classes: [
        {
          id: "cls-1",
          compendiumId: "fighter-xphb",
          name: "Fighter",
          level: 3,
          hitDieFaces: 10,
          usedHitDice: 0,
          subclassId: "fighter-champion-xphb",
          subclassName: "Champion",
          source: "XPHB",
          spellcastingAbility: null
        }
      ]
    });

    const features = collectGuidedFeatures(actor, [fighterClass]);
    expect(features).toContain("Improved Critical");
    expect(features).toContain("Remarkable Athlete");
    expect(features).not.toContain("Martial Archetype");
    expect(features).not.toContain("Subclass");
  });
});
