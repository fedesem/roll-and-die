import { randomUUID } from "node:crypto";

import type { DiceRoll } from "../../shared/types.js";

export interface ParsedRoll {
  notation: string;
  count: number;
  sides: number;
  modifier: number;
}

const rollPattern = /^(\d{0,2})d(\d{1,3})([+-]\d{1,3})?$/i;

export function parseRoll(input: string): ParsedRoll | null {
  const normalized = input.trim().replace(/^\/roll\s+/i, "").replace(/\s+/g, "");
  const match = normalized.match(rollPattern);

  if (!match) {
    return null;
  }

  const count = Number(match[1] || "1");
  const sides = Number(match[2]);
  const modifier = Number(match[3] || "0");

  if (count < 1 || count > 20 || sides < 2 || sides > 100) {
    return null;
  }

  return {
    notation: `${count}d${sides}${modifier === 0 ? "" : modifier > 0 ? `+${modifier}` : modifier}`,
    count,
    sides,
    modifier
  };
}

export function rollDice(notation: string, label: string): DiceRoll {
  const parsed = parseRoll(notation);

  if (!parsed) {
    throw new Error("Use standard dice notation like 1d20+5 or 2d6.");
  }

  const rolls = Array.from({ length: parsed.count }, () => Math.floor(Math.random() * parsed.sides) + 1);
  const total = rolls.reduce((sum, value) => sum + value, 0) + parsed.modifier;

  return {
    id: randomUUID(),
    label,
    notation: parsed.notation,
    rolls,
    modifier: parsed.modifier,
    total,
    createdAt: new Date().toISOString()
  };
}

