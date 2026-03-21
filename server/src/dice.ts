import { randomUUID } from "node:crypto";

import {
  evaluateRollNotation,
  normalizeRollNotation,
  parseRollCommand,
  validateRollNotation
} from "../../shared/dice.js";
import type { DiceRoll } from "../../shared/types.js";

export { normalizeRollNotation, parseRollCommand, validateRollNotation };

export function rollDice(notation: string, label: string): DiceRoll {
  const normalized = normalizeRollNotation(notation);
  const roll = evaluateRollNotation(normalized, (sides) => Math.floor(Math.random() * sides) + 1);

  if (!roll) {
    throw new Error("Use roll expressions like 1d20+2, 2d8*2, or 3d6+2d4.");
  }

  return {
    id: randomUUID(),
    label,
    notation: roll.notation,
    rolls: roll.rolls,
    modifier: roll.modifier,
    total: roll.total,
    breakdown: roll.breakdown,
    createdAt: new Date().toISOString()
  };
}
