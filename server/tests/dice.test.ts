import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { evaluateRollNotation, isRollCommand, parseDiceToken, parseRollCommand, validateRollNotation } from "../../shared/dice.ts";

vi.mock("node:crypto", () => ({
  randomUUID: () => "roll-id"
}));

describe("shared dice helpers", () => {
  it("parses roll commands and normalizes whitespace", () => {
    expect(parseRollCommand("  /ROLL  2d6 + 3 ")).toEqual({
      command: "/roll",
      expression: "2d6+3"
    });
    expect(parseRollCommand("/r   1d20 + 5")).toEqual({
      command: "/r",
      expression: "1d20+5"
    });
    expect(parseRollCommand("hello there")).toBeNull();
  });

  it("validates bounded dice tokens", () => {
    expect(parseDiceToken("d20")).toEqual({
      notation: "1d20",
      count: 1,
      sides: 20
    });
    expect(parseDiceToken("21d6")).toBeNull();
    expect(parseDiceToken("1d101")).toBeNull();
    expect(parseDiceToken("2d1")).toBeNull();
  });

  it("applies operator precedence when evaluating expressions", () => {
    const rolledSides: number[] = [];
    const evaluation = evaluateRollNotation("1d6+2*3", (sides) => {
      rolledSides.push(sides);
      return 4;
    });

    expect(rolledSides).toEqual([6]);
    expect(evaluation).toMatchObject({
      notation: "1d6+2*3",
      rolls: [4],
      total: 10,
      breakdown: "(1d6[4] + (2 * 3))"
    });
  });

  it("rejects expressions that do not contain at least one dice token", () => {
    expect(evaluateRollNotation("2+3", () => 1)).toBeNull();
    expect(validateRollNotation("2+3")).toBe(true);
    expect(validateRollNotation("1d20++2")).toBe(false);
    expect(isRollCommand("/roll 2d8")).toBe(true);
    expect(isRollCommand("/say 2d8")).toBe(false);
  });
});

describe("server rollDice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns a complete DiceRoll payload using deterministic random values", async () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.5);

    const { rollDice } = await import("../src/dice.ts");
    const roll = rollDice(" 2d6 + 1 ", "Longsword");

    expect(roll).toMatchObject({
      id: "roll-id",
      label: "Longsword",
      notation: "2d6+1",
      rolls: [1, 4],
      total: 6,
      breakdown: "(2d6[1, 4] + 1)",
      createdAt: "2026-03-28T00:00:00.000Z"
    });
  });

  it("throws a user-friendly message for invalid notations", async () => {
    const { rollDice } = await import("../src/dice.ts");

    expect(() => rollDice("abc", "Bad Roll")).toThrowError("Use roll expressions like 1d20+2, 2d8*2, or 3d6+2d4.");
  });
});
