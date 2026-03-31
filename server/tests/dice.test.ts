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
    expect(parseDiceToken("2d20kh1")).toEqual({
      notation: "2d20kh1",
      count: 2,
      sides: 20,
      keep: {
        mode: "highest",
        count: 1
      }
    });
    expect(parseDiceToken("2d20kl1")).toEqual({
      notation: "2d20kl1",
      count: 2,
      sides: 20,
      keep: {
        mode: "lowest",
        count: 1
      }
    });
    expect(parseDiceToken("21d6")).toBeNull();
    expect(parseDiceToken("1d101")).toBeNull();
    expect(parseDiceToken("2d1")).toBeNull();
    expect(parseDiceToken("2d20kh3")).toBeNull();
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

  it("supports division with the same precedence as multiplication", () => {
    const evaluation = evaluateRollNotation("1d8/2+1", () => 6);

    expect(evaluation).toMatchObject({
      notation: "1d8/2+1",
      rolls: [6],
      total: 4,
      breakdown: "((1d8[6] / 2) + 1)"
    });
    expect(validateRollNotation("1d8/2+1")).toBe(true);
  });

  it("supports keep-highest and keep-lowest dice notation", () => {
    const high = evaluateRollNotation("2d20kh1+5", (() => {
      const values = [4, 17];
      let index = 0;
      return () => values[index++] ?? 1;
    })());
    const low = evaluateRollNotation("2d20kl1+2", (() => {
      const values = [19, 3];
      let index = 0;
      return () => values[index++] ?? 1;
    })());

    expect(high).toMatchObject({
      notation: "2d20kh1+5",
      rolls: [4, 17],
      total: 22,
      breakdown: "(2d20kh1[4, 17 -> 17] + 5)"
    });
    expect(low).toMatchObject({
      notation: "2d20kl1+2",
      rolls: [19, 3],
      total: 5,
      breakdown: "(2d20kl1[19, 3 -> 3] + 2)"
    });
    expect(validateRollNotation("2d20kh1+5")).toBe(true);
    expect(validateRollNotation("2d20kl1+2")).toBe(true);
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

  it("rolls advantage notation on the backend", async () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.1).mockReturnValueOnce(0.9);

    const { rollDice } = await import("../src/dice.ts");
    const roll = rollDice("2d20kh1+4", "Initiative");

    expect(roll).toMatchObject({
      notation: "2d20kh1+4",
      rolls: [3, 19],
      total: 23,
      breakdown: "(2d20kh1[3, 19 -> 19] + 4)"
    });
  });

  it("throws a user-friendly message for invalid notations", async () => {
    const { rollDice } = await import("../src/dice.ts");

    expect(() => rollDice("abc", "Bad Roll")).toThrowError("Use roll expressions like 1d20+2, 2d20kh1+4, 2d8*2, 1d8/2, or 3d6+2d4.");
  });
});
