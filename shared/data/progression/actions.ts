import type { StructuredActionDefinition } from "./types.js";

export const STANDARD_CLASS_ACTIONS: StructuredActionDefinition[] = [
  {
    id: "action-second-wind",
    name: "Second Wind",
    source: "XPHB",
    category: "feature",
    actionCost: "bonus",
    resourceCost: {
      resourceName: "Second Wind",
      count: 1
    },
    roll: {
      kind: "heal",
      diceFormula: "1d10 + level"
    },
    range: "Self"
  },
  {
    id: "action-action-surge",
    name: "Action Surge",
    source: "XPHB",
    category: "feature",
    actionCost: "free",
    resourceCost: {
      resourceName: "Action Surge",
      count: 1
    },
    range: "Self"
  },
  {
    id: "action-rage",
    name: "Rage",
    source: "XPHB",
    category: "feature",
    actionCost: "bonus",
    resourceCost: {
      resourceName: "Rage",
      count: 1
    },
    duration: "10 minutes",
    range: "Self"
  },
  {
    id: "action-wild-shape",
    name: "Wild Shape",
    source: "XPHB",
    category: "feature",
    actionCost: "bonus",
    resourceCost: {
      resourceName: "Wild Shape",
      count: 1
    },
    duration: "Hours = Level / 2",
    range: "Self"
  },
  {
    id: "action-flurry-of-blows",
    name: "Flurry of Blows",
    source: "XPHB",
    category: "feature",
    actionCost: "bonus",
    resourceCost: {
      resourceName: "Focus Points",
      count: 1
    },
    roll: {
      kind: "attack"
    },
    range: "Melee"
  },
  {
    id: "action-patient-defense",
    name: "Patient Defense",
    source: "XPHB",
    category: "feature",
    actionCost: "bonus",
    resourceCost: {
      resourceName: "Focus Points",
      count: 1
    },
    range: "Self"
  },
  {
    id: "action-step-of-the-wind",
    name: "Step of the Wind",
    source: "XPHB",
    category: "feature",
    actionCost: "bonus",
    resourceCost: {
      resourceName: "Focus Points",
      count: 1
    },
    range: "Self"
  },
  {
    id: "action-lay-on-hands",
    name: "Lay on Hands",
    source: "XPHB",
    category: "feature",
    actionCost: "bonus",
    resourceCost: {
      resourceName: "Lay on Hands",
      count: 1
    },
    roll: {
      kind: "heal"
    },
    range: "Touch"
  },
  {
    id: "action-bardic-inspiration",
    name: "Bardic Inspiration",
    source: "XPHB",
    category: "feature",
    actionCost: "bonus",
    resourceCost: {
      resourceName: "Bardic Inspiration",
      count: 1
    },
    range: "60 feet"
  },
  {
    id: "action-channel-divinity",
    name: "Channel Divinity",
    source: "XPHB",
    category: "feature",
    actionCost: "action",
    resourceCost: {
      resourceName: "Channel Divinity",
      count: 1
    },
    range: "30 feet"
  }
];

export function findActionDefinition(actionNameOrId: string): StructuredActionDefinition | null {
  const norm = actionNameOrId.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return STANDARD_CLASS_ACTIONS.find((a) => a.id === actionNameOrId || a.name.toLowerCase().replace(/[^a-z0-9]+/g, "") === norm) ?? null;
}
