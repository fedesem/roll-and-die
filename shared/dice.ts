export interface ParsedDiceToken {
  notation: string;
  count: number;
  sides: number;
  keep?: {
    mode: "highest" | "lowest";
    count: number;
  };
}

export interface RollCommand {
  command: "/roll" | "/r";
  expression: string;
}

export interface RollEvaluation {
  notation: string;
  rolls: number[];
  modifier: number;
  total: number;
  breakdown: string;
}

type Token =
  | {
      type: "dice";
      value: string;
    }
  | {
      type: "number";
      value: string;
    }
  | {
      type: "operator";
      value: "+" | "-" | "*" | "/";
    };

interface ValueNode {
  total: number;
  rolls: number[];
  breakdown: string;
  hasDice: boolean;
}

const commandPattern = /^(\/roll|\/r)\s+(.+)$/i;
const tokenPattern = /\d*d\d+(?:k[hl]\d+)?|\d+|[+\-*/]/gi;
const dicePattern = /^(\d{0,2})d(\d{1,3})(?:k([hl])(\d{1,2}))?$/i;

export function parseRollCommand(input: string): RollCommand | null {
  const match = input.trim().match(commandPattern);

  if (!match) {
    return null;
  }

  const expression = normalizeRollNotation(match[2] ?? "");

  if (!expression) {
    return null;
  }

  return {
    command: match[1].toLowerCase() === "/r" ? "/r" : "/roll",
    expression
  };
}

export function normalizeRollNotation(input: string) {
  return input.trim().replace(/\s+/g, "");
}

export function isRollCommand(input: string) {
  return commandPattern.test(input.trim());
}

export function validateRollNotation(input: string) {
  return tokenizeRollExpression(normalizeRollNotation(input)) !== null;
}

export function evaluateRollNotation(input: string, rollDie: (sides: number) => number): RollEvaluation | null {
  const notation = normalizeRollNotation(input);
  const tokens = tokenizeRollExpression(notation);

  if (!tokens) {
    return null;
  }

  let cursor = 0;

  const readExpression = (): ValueNode | null => {
    let left = readTerm();

    if (!left) {
      return null;
    }

    while (cursor < tokens.length) {
      const operator = tokens[cursor];

      if (operator.type !== "operator" || (operator.value !== "+" && operator.value !== "-")) {
        break;
      }

      cursor += 1;
      const right = readTerm();

      if (!right) {
        return null;
      }

      left = {
        total: operator.value === "+" ? left.total + right.total : left.total - right.total,
        rolls: [...left.rolls, ...right.rolls],
        breakdown: `(${left.breakdown} ${operator.value} ${right.breakdown})`,
        hasDice: left.hasDice || right.hasDice
      };
    }

    return left;
  };

  const readTerm = (): ValueNode | null => {
    let left = readFactor();

    if (!left) {
      return null;
    }

    while (cursor < tokens.length) {
      const operator = tokens[cursor];

      if (operator.type !== "operator" || (operator.value !== "*" && operator.value !== "/")) {
        break;
      }

      cursor += 1;
      const right = readFactor();

      if (!right) {
        return null;
      }

      if (operator.value === "/" && right.total === 0) {
        return null;
      }

      left = {
        total: operator.value === "*" ? left.total * right.total : left.total / right.total,
        rolls: [...left.rolls, ...right.rolls],
        breakdown: `(${left.breakdown} ${operator.value} ${right.breakdown})`,
        hasDice: left.hasDice || right.hasDice
      };
    }

    return left;
  };

  const readFactor = (): ValueNode | null => {
    const token = tokens[cursor];

    if (!token) {
      return null;
    }

    cursor += 1;

    if (token.type === "number") {
      return {
        total: Number(token.value),
        rolls: [],
        breakdown: token.value,
        hasDice: false
      };
    }

    if (token.type !== "dice") {
      return null;
    }

    const parsed = parseDiceToken(token.value);

    if (!parsed) {
      return null;
    }

    const rolls = Array.from({ length: parsed.count }, () => rollDie(parsed.sides));
    const keptRolls =
      parsed.keep?.mode === "highest"
        ? [...rolls].sort((left, right) => right - left).slice(0, parsed.keep.count)
        : parsed.keep?.mode === "lowest"
          ? [...rolls].sort((left, right) => left - right).slice(0, parsed.keep.count)
          : rolls;

    return {
      total: keptRolls.reduce((sum, value) => sum + value, 0),
      rolls,
      breakdown:
        parsed.keep && parsed.keep.count < rolls.length
          ? `${parsed.notation}[${rolls.join(", ")} -> ${keptRolls.join(", ")}]`
          : `${parsed.notation}[${rolls.join(", ")}]`,
      hasDice: true
    };
  };

  const result = readExpression();

  if (!result || cursor !== tokens.length || !result.hasDice) {
    return null;
  }

  return {
    notation,
    rolls: result.rolls,
    modifier: 0,
    total: result.total,
    breakdown: result.breakdown
  };
}

export function parseDiceToken(input: string): ParsedDiceToken | null {
  const match = input.match(dicePattern);

  if (!match) {
    return null;
  }

  const count = Number(match[1] || "1");
  const sides = Number(match[2]);
  const keepMode = match[3]?.toLowerCase();
  const keepCount = typeof match[4] === "string" ? Number(match[4]) : null;

  if (count < 1 || count > 20 || sides < 2 || sides > 100) {
    return null;
  }

  if (keepMode && (keepCount === null || keepCount < 1 || keepCount > count)) {
    return null;
  }

  return {
    notation: `${count}d${sides}${keepMode && keepCount !== null ? `k${keepMode}${keepCount}` : ""}`,
    count,
    sides,
    keep:
      keepMode && keepCount !== null
        ? {
            mode: keepMode === "h" ? "highest" : "lowest",
            count: keepCount
          }
        : undefined
  };
}

function tokenizeRollExpression(input: string): Token[] | null {
  if (!input) {
    return null;
  }

  const parts = input.match(tokenPattern);

  if (!parts || parts.join("") !== input) {
    return null;
  }

  const tokens = parts.map<Token | null>((part) => {
    if (part === "+" || part === "-" || part === "*" || part === "/") {
      return {
        type: "operator",
        value: part
      };
    }

    if (/^\d+$/.test(part)) {
      return {
        type: "number",
        value: part
      };
    }

    if (parseDiceToken(part)) {
      return {
        type: "dice",
        value: part
      };
    }

    return null;
  });

  if (tokens.some((token) => token === null)) {
    return null;
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;

    if (index % 2 === 0 && token.type === "operator") {
      return null;
    }

    if (index % 2 === 1 && token.type !== "operator") {
      return null;
    }
  }

  return tokens as Token[];
}
