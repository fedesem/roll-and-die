import type { LucideIcon } from "lucide-react";
import {
  Ban,
  BatteryWarning,
  Beer,
  Droplets,
  EarOff,
  EyeOff,
  Ghost,
  Gem,
  HandGrab,
  HeartHandshake,
  Moon,
  MoveDown,
  Pill,
  Skull,
  Sparkles,
  Timer,
  TriangleAlert,
  X,
  ZapOff,
  Link2
} from "lucide-react";
import { TOKEN_STATUS_MARKERS, type TokenStatusMarker } from "@shared/types";

export type TokenStatusTone = "danger" | "warning" | "arcane" | "neutral" | "stealth" | "success";

export interface TokenStatusOption {
  value: TokenStatusMarker;
  label: string;
  tone: TokenStatusTone;
  Icon: LucideIcon;
}

export const TOKEN_STATUS_OPTIONS: TokenStatusOption[] = [
  { value: "skull", label: "Skull", tone: "danger", Icon: Skull },
  { value: "slow", label: "Slow", tone: "warning", Icon: Timer },
  { value: "bloodied", label: "Bloodied", tone: "danger", Icon: Droplets },
  { value: "blinded", label: "Blinded", tone: "warning", Icon: EyeOff },
  { value: "charmed", label: "Charmed", tone: "arcane", Icon: HeartHandshake },
  { value: "deafened", label: "Deafened", tone: "neutral", Icon: EarOff },
  { value: "drunkenness", label: "Drunkenness", tone: "warning", Icon: Beer },
  { value: "exhaustion", label: "Exhaustion", tone: "warning", Icon: BatteryWarning },
  { value: "frightened", label: "Frightened", tone: "danger", Icon: TriangleAlert },
  { value: "grappled", label: "Grappled", tone: "arcane", Icon: HandGrab },
  { value: "incapacitated", label: "Incapacitated", tone: "danger", Icon: Ban },
  { value: "invisible", label: "Invisible", tone: "stealth", Icon: Ghost },
  { value: "paralyzed", label: "Paralyzed", tone: "danger", Icon: ZapOff },
  { value: "petrified", label: "Petrified", tone: "neutral", Icon: Gem },
  { value: "poisoned", label: "Poisoned", tone: "success", Icon: Pill },
  { value: "prone", label: "Prone", tone: "warning", Icon: MoveDown },
  { value: "restrained", label: "Restrained", tone: "arcane", Icon: Link2 },
  { value: "stunned", label: "Stunned", tone: "danger", Icon: Sparkles },
  { value: "unconscious", label: "Unconscious", tone: "neutral", Icon: Moon },
  { value: "cross", label: "Crossed Out", tone: "danger", Icon: X }
];

const tokenStatusOptionsByValue = new Map<TokenStatusMarker, TokenStatusOption>(
  TOKEN_STATUS_OPTIONS.map((option) => [option.value, option])
);

export function getTokenStatusOption(statusMarker: TokenStatusMarker | null) {
  return statusMarker ? tokenStatusOptionsByValue.get(statusMarker) ?? null : null;
}

export function isTokenStatusMarker(value: string | null | undefined): value is TokenStatusMarker {
  return typeof value === "string" && TOKEN_STATUS_MARKERS.includes(value as TokenStatusMarker);
}
