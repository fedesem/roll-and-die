import type { ActorSheet, CampaignSnapshot, ClassEntry, SpellEntry } from "@shared/types";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useMemo, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { RulesText } from "../src/components/compendium/RulesText";
import { GuidedSheetModal } from "../src/features/sheet/components/GuidedSheetModal";
import { useGuidedSheetFlow } from "../src/features/sheet/hooks/useGuidedSheetFlow";
import type { SpellSelectionTarget } from "../src/features/sheet/playerNpcSheet2024Types";
import { SpellSelectionModal } from "../src/features/sheet/SpellSelectionModal";
import { createClientActorDraft } from "../src/lib/drafts";

const druid: ClassEntry = {
  id: "druid-xphb",
  name: "Druid",
  source: "XPHB",
  description: "Druid class description",
  hitDieFaces: 8,
  primaryAbilities: ["Wisdom"],
  savingThrowProficiencies: ["int", "wis"],
  startingProficiencies: { armor: ["Light Armor"], weapons: ["Simple Weapons"], tools: ["Herbalism Kit"] },
  spellcastingAbility: "wis",
  spellPreparation: "prepared",
  subclassLevel: 3,
  features: [
    {
      id: "primal-order",
      name: "Primal Order",
      source: "XPHB",
      level: 1,
      description:
        "You have dedicated yourself to one of the following sacred roles of your choice.\nMagician\nYou know one extra cantrip from the {@filter Druid spell list|spells|class=Druid}. In addition, your mystical connection to nature gives you a bonus to your Intelligence ({@skill Arcana|XPHB} or {@skill Nature|XPHB}) checks. The bonus equals your Wisdom modifier (minimum bonus of +1).\nWarden\nTrained for battle, you gain proficiency with {@filter Martial weapons|items|type=martial weapon} and training with {@filter Medium armor|items|type=Medium Armor}."
    }
  ],
  subclasses: [],
  tables: [],
  startingEquipment: []
};

const druidcraft: SpellEntry = {
  id: "druidcraft-xphb",
  name: "Druidcraft",
  source: "XPHB",
  level: "cantrip",
  school: "Transmutation",
  castingTime: "Action",
  range: "30 feet",
  components: "V, S",
  duration: "Instantaneous",
  description: "Whispering to the spirits of nature, you create a minor floral effect.",
  fullDescription: "Whispering to the spirits of nature, you create a minor floral effect.",
  classes: ["Druid"],
  damageNotation: "",
  damageType: "",
  tags: []
};

const compendium: CampaignSnapshot["compendium"] = {
  spells: [druidcraft],
  feats: [],
  classes: [druid],
  variantRules: [],
  conditions: [],
  optionalFeatures: [],
  backgrounds: [],
  items: [],
  languages: [],
  races: [],
  skills: []
};

function DruidWizardHarness({ initialActor, mode = "setup" }: { initialActor?: ActorSheet; mode?: "setup" | "levelup" }) {
  const [draft, setDraft] = useState<ActorSheet>(() => initialActor ?? createClientActorDraft("character", "user-1"));
  const [spellSelectionTarget, setSpellSelectionTarget] = useState<SpellSelectionTarget | null>(null);

  const guided = useGuidedSheetFlow({
    actor: draft,
    draft,
    compendium,
    filteredFeats: [],
    updateDraft: (recipe) => setDraft((current) => recipe(current)),
    setActiveTab: () => undefined
  });

  useEffect(() => {
    guided.openGuidedFlow(mode);
  }, [mode]);

  const spellSelectionConfig = useMemo(() => {
    if (!spellSelectionTarget) return null;
    if (typeof spellSelectionTarget === "object" && spellSelectionTarget.kind === "guidedChoice") {
      const target = spellSelectionTarget;
      const group =
        target.owner === "class"
          ? guided.guidedChoiceSpec.classChoiceGroups?.find((entry) => entry.id === target.groupId)
          : guided.guidedChoiceSpec.featChoiceGroups?.[target.ownerId]?.find((entry) => entry.id === target.groupId);
      if (!group) return null;
      const spells = compendium.spells.filter((spell) => group.options.some((option) => option.id === spell.id));
      const selectedSpellIds =
        target.owner === "class"
          ? (guided.guidedSetup.classChoiceIds[target.groupId] ?? [])
          : (guided.guidedSetup.featChoiceMap[target.ownerId]?.[target.groupId] ?? []);
      return {
        title: group.label,
        subtitle: `Choose exactly ${group.count} eligible spell${group.count === 1 ? "" : "s"}. Eligibility filters are fixed by the feature's JSON rules.`,
        spells,
        selectedSpellIds: selectedSpellIds.filter((id) => spells.some((spell) => spell.id === id)),
        maxSelections: group.count,
        applyLabel: "Apply Spell Choice",
        onApply: (spellIds: string[]) =>
          guided.setGuidedSetup((current) =>
            target.owner === "class"
              ? {
                  ...current,
                  classChoiceIds: { ...current.classChoiceIds, [target.groupId]: spellIds.slice(0, group.count) }
                }
              : {
                  ...current,
                  featChoiceMap: {
                    ...current.featChoiceMap,
                    [target.ownerId]: {
                      ...(current.featChoiceMap[target.ownerId] ?? {}),
                      [target.groupId]: spellIds.slice(0, group.count)
                    }
                  }
                }
          )
      };
    }
    return null;
  }, [spellSelectionTarget, guided.guidedChoiceSpec, guided.guidedSetup]);

  return (
    <>
      {spellSelectionConfig ? (
        <SpellSelectionModal
          isOpen={Boolean(spellSelectionTarget)}
          title={spellSelectionConfig.title}
          subtitle={spellSelectionConfig.subtitle}
          spells={spellSelectionConfig.spells}
          selectedSpellIds={spellSelectionConfig.selectedSpellIds}
          compendium={compendium}
          allowedSourceBooks={[]}
          maxSelections={spellSelectionConfig.maxSelections}
          onApply={(ids) => {
            spellSelectionConfig.onApply(ids);
            setSpellSelectionTarget(null);
          }}
          onClose={() => setSpellSelectionTarget(null)}
          applyLabel={spellSelectionConfig.applyLabel}
        />
      ) : null}
      <GuidedSheetModal
        draft={draft}
        compendium={compendium}
        guided={guided}
        onOpenSpellSelection={setSpellSelectionTarget}
        renderRulesText={(text) => (
          <RulesText
            text={text}
            spellEntries={compendium.spells}
            classEntries={compendium.classes}
            featEntries={compendium.feats}
            itemEntries={compendium.items}
          />
        )}
      />
    </>
  );
}

describe("Druid guided creation", () => {
  afterEach(cleanup);

  it.each(["Magician", "Warden"])("keeps rendering after choosing %s", async (order) => {
    render(<DruidWizardHarness />);
    const option = await screen.findByText(order, { selector: "span" });
    const input = option.closest("label")?.querySelector("input");
    expect(input).toBeTruthy();
    fireEvent.click(input!);
    await waitFor(() => expect(screen.getByText("Primal Order", { selector: "legend" })).toBeTruthy());
    expect(input?.checked).toBe(true);
    expect(screen.getAllByText(order, { selector: "span" })[0]).toBeTruthy();
    if (order === "Magician") {
      expect(await screen.findByText("Magician: choose cantrips", { selector: "legend" })).toBeTruthy();
    }
  });

  it("allows selecting Magician, picking a cantrip, and switching to Warden", async () => {
    render(<DruidWizardHarness />);

    // Select Magician
    const magicianSpan = await screen.findByText("Magician", { selector: "span" });
    const magicianInput = magicianSpan.closest("label")?.querySelector("input");
    expect(magicianInput).toBeTruthy();
    fireEvent.click(magicianInput!);

    // Cantrip choice group appears with "Choose Spells" button
    const chooseSpellsBtn = await screen.findByRole("button", { name: /Choose Spells/i });
    expect(chooseSpellsBtn).toBeTruthy();
    fireEvent.click(chooseSpellsBtn);

    // Modal opens, pick Druidcraft via Pick button
    const pickButton = await screen.findByRole("button", { name: /^Pick$/i });
    expect(pickButton).toBeTruthy();
    fireEvent.click(pickButton);

    const applyBtn = await screen.findByRole("button", { name: /Apply Spell Choice/i });
    fireEvent.click(applyBtn);

    // Badge for Druidcraft should now be displayed in the guided modal
    await waitFor(() => {
      expect(screen.getByText("Druidcraft", { selector: "span" })).toBeTruthy();
    });

    // Switch to Warden
    const wardenSpan = await screen.findByText("Warden", { selector: "span" });
    const wardenInput = wardenSpan.closest("label")?.querySelector("input");
    expect(wardenInput).toBeTruthy();
    fireEvent.click(wardenInput!);

    // Warden is checked, Magician cantrips group disappears
    await waitFor(() => {
      expect(wardenInput?.checked).toBe(true);
      expect(screen.queryByText("Magician: choose cantrips", { selector: "legend" })).toBeNull();
    });
  });

  it("handles level up flow on existing Druid without errors", async () => {
    const existingDraft = createClientActorDraft("character", "user-1");
    existingDraft.classes = [
      {
        id: "class-druid-1",
        compendiumId: "druid-xphb",
        name: "Druid",
        source: "XPHB",
        level: 1,
        isStartingClass: true
      }
    ];
    existingDraft.build = {
      configurations: [
        {
          ownerInstanceId: "class-druid-1",
          groupId: "druid-primal-order",
          activeOptionIds: ["magician"]
        }
      ]
    };

    render(<DruidWizardHarness initialActor={existingDraft} mode="levelup" />);

    await waitFor(() => {
      expect(screen.getByText("Druid", { selector: "h3, p, span, div" })).toBeTruthy();
    });
  });
});
