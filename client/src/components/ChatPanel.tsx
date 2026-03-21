import { useEffect, useMemo, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";

import { parseRollCommand, validateRollNotation } from "@shared/dice";
import type { ChatActorContext, ChatMessage } from "@shared/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => Promise<void>;
}

const pageSize = 50;

export function ChatPanel({ messages, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(() => Math.min(messages.length, pageSize));
  const [showLoadingHint, setShowLoadingHint] = useState(false);
  const draftHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const historyDraftRef = useRef("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollOffsetRef = useRef<number | null>(null);
  const stickToBottomRef = useRef(true);
  const previousLastMessageIdRef = useRef<string | null>(messages[messages.length - 1]?.id ?? null);
  const previousCampaignIdRef = useRef<string | null>(messages[0]?.campaignId ?? null);

  useEffect(() => {
    const nextCampaignId = messages[0]?.campaignId ?? null;
    const campaignChanged = nextCampaignId !== previousCampaignIdRef.current;
    const nextLastMessageId = messages[messages.length - 1]?.id ?? null;
    const lastMessageChanged = nextLastMessageId !== previousLastMessageIdRef.current;

    setVisibleCount((current) => {
      if (messages.length === 0) {
        return 0;
      }

      if (campaignChanged) {
        return Math.min(messages.length, pageSize);
      }

      if (current === 0) {
        return Math.min(messages.length, pageSize);
      }

      const maxVisible = Math.min(messages.length, current);
      return lastMessageChanged && !pendingScrollOffsetRef.current && !stickToBottomRef.current
        ? maxVisible
        : Math.min(messages.length, Math.max(pageSize, current));
    });

    previousLastMessageIdRef.current = nextLastMessageId;
    previousCampaignIdRef.current = nextCampaignId;
    if (campaignChanged) {
      pendingScrollOffsetRef.current = null;
      stickToBottomRef.current = true;
    }
  }, [messages]);

  const visibleMessages = useMemo(
    () => messages.slice(Math.max(0, messages.length - visibleCount)),
    [messages, visibleCount]
  );

  useEffect(() => {
    if (messages.length > 0) {
      setShowLoadingHint(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowLoadingHint(true);
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [messages.length]);

  useEffect(() => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    if (pendingScrollOffsetRef.current !== null) {
      container.scrollTop = container.scrollHeight - pendingScrollOffsetRef.current;
      pendingScrollOffsetRef.current = null;
      return;
    }

    if (stickToBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [visibleMessages]);

  function loadOlderMessages() {
    const container = scrollRef.current;

    if (!container || visibleCount >= messages.length) {
      return;
    }

    pendingScrollOffsetRef.current = container.scrollHeight - container.scrollTop;
    setVisibleCount((current) => Math.min(messages.length, current + pageSize));
  }

  function handleScroll() {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 24;

    if (container.scrollTop < 80) {
      loadOlderMessages();
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextDraft = draft.trim();

    if (!nextDraft) {
      return;
    }

    const rollCommand = parseRollCommand(nextDraft);

    if (nextDraft.startsWith("/")) {
      if (!rollCommand || !validateRollNotation(rollCommand.expression)) {
        setError("Invalid roll. Use /r 1d20+2, /roll 2d8*2, or /r 3d6+2d4.");
        return;
      }
    }

    setError(null);
    if (
      draftHistoryRef.current[draftHistoryRef.current.length - 1] !== nextDraft
    ) {
      draftHistoryRef.current.push(nextDraft);
    }
    historyIndexRef.current = -1;
    historyDraftRef.current = "";
    setDraft("");
    stickToBottomRef.current = true;
    await onSend(nextDraft);
  }

  function handleDraftKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const history = draftHistoryRef.current;

    if (history.length === 0) {
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (historyIndexRef.current === -1) {
        historyDraftRef.current = draft;
      }

      historyIndexRef.current =
        historyIndexRef.current <= 0 ? history.length - 1 : historyIndexRef.current - 1;
      setDraft(history[historyIndexRef.current] ?? "");
      setError(null);
      return;
    }

    if (event.key === "ArrowDown" && historyIndexRef.current !== -1) {
      event.preventDefault();
      historyIndexRef.current =
        historyIndexRef.current >= history.length - 1 ? -1 : historyIndexRef.current + 1;
      setDraft(
        historyIndexRef.current === -1
          ? historyDraftRef.current
          : (history[historyIndexRef.current] ?? "")
      );
      setError(null);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col rounded-none border border-white/10 bg-slate-950/78 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="border-b border-white/8 px-3 py-2 text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
        {messages.length > visibleMessages.length
          ? `Showing latest ${visibleMessages.length} of ${messages.length}`
          : `${messages.length} messages`}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3" onScroll={handleScroll}>
        {messages.length > visibleMessages.length && (
          <div className="mb-3 flex justify-center">
            <button
              type="button"
              className="rounded-none border border-white/10 bg-white/[0.03] px-3 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-slate-400 transition hover:border-amber-200/20 hover:text-amber-50"
              onClick={loadOlderMessages}
            >
              Load 50 older messages
            </button>
          </div>
        )}

        {showLoadingHint && messages.length === 0 && (
          <p className="mb-2 text-center text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
            Loading chat...
          </p>
        )}

        {visibleMessages.map((message) => (
          <article
            key={message.id}
            className={`mb-1.5 rounded-none border px-2.5 py-2 text-[0.82rem] ${
              message.kind === "roll"
                ? "border-amber-200/12 bg-amber-300/8"
                : message.kind === "system"
                  ? "border-sky-200/10 bg-sky-300/8"
                  : "border-white/8 bg-white/[0.03]"
            }`}
          >
            <header className="mb-1 flex items-center justify-between gap-3 text-[0.63rem] uppercase tracking-[0.14em] text-slate-500">
              <strong className="truncate font-semibold text-amber-100">{message.userName}</strong>
              <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </header>

            {message.roll ? (
              <CompactRollMessage message={message} />
            ) : (
              <p className="leading-5 text-slate-200">{message.text}</p>
            )}
          </article>
        ))}
      </div>

      <form className="border-t border-white/8 px-3 py-3" onSubmit={handleSubmit}>
        <div className="flex items-center gap-2">
          <input
            className="h-11 flex-1 rounded-none border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-100 outline-none transition focus:border-amber-200/30 focus:bg-white/[0.06]"
            placeholder="Talk to the room or type /r 2d6+3"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              historyIndexRef.current = -1;
              if (error) {
                setError(null);
              }
            }}
            onKeyDown={handleDraftKeyDown}
          />
          <button className="inline-flex h-11 w-11 items-center justify-center rounded-none border border-amber-200/20 bg-amber-300/18 text-amber-50 transition hover:bg-amber-300/24" type="submit" aria-label="Send message">
            <SendHorizontal size={15} />
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      </form>
    </section>
  );
}

function ChatActorBadge({ actor }: { actor: ChatActorContext }) {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 text-[0.52rem] font-semibold text-slate-950"
      style={{ backgroundColor: actor.actorColor }}
      title={actor.actorName}
      aria-label={actor.actorName}
    >
      {actor.actorImageUrl ? (
        <img src={actor.actorImageUrl} alt={actor.actorName} className="h-full w-full object-cover" />
      ) : (
        actor.actorName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() ?? "")
          .join("")
      )}
    </span>
  );
}

function CompactRollMessage({ message }: { message: ChatMessage }) {
  const roll = message.roll;

  if (!roll) {
    return null;
  }

  const label = roll.label || extractRollLabel(message.text);
  const parts = buildRollParts(roll.notation, roll.rolls);

  return (
    <div className="flex flex-col gap-1 leading-5 text-slate-200">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {message.actor && <ChatActorBadge actor={message.actor} />}
        <span className="font-medium text-amber-100">{label}</span>
      </div>
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 flex-wrap items-center gap-1.5 text-[0.74rem] text-amber-50/80">
          <span className="flex flex-wrap items-center gap-1.5">
            {parts.map((part, index) => (
              <RollPartView
                key={part.type === "dice" ? `${part.label}-${index}` : `${part.type}-${index}`}
                part={part}
              />
            ))}
          </span>
        </span>
        <span className="inline-flex min-w-10 shrink-0 items-center justify-center rounded-none border border-amber-200/16 bg-slate-950/60 px-2 py-0.5 text-sm font-semibold text-amber-50">
          {roll.total}
        </span>
      </div>
    </div>
  );
}

function RollPartView({ part }: { part: RollPart }) {
  if (part.type === "operator") {
    return <span className="text-slate-500">{part.value}</span>;
  }

  if (part.type === "number") {
    return <span>{part.value}</span>;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span>{part.label}</span>
      <span
        className="inline-flex flex-wrap items-center gap-1 rounded-none border border-white/10 bg-slate-950/55 px-1.5 py-0.5"
      >
        {part.values.map((value, index) => (
          <span
            key={`${part.label}-${value}-${index}`}
            className={getRollValueClassName(value, part.sides)}
          >
            {value}
          </span>
        ))}
      </span>
    </span>
  );
}

type RollPart =
  | {
      type: "dice";
      label: string;
      sides: number;
      values: number[];
    }
  | {
      type: "operator";
      value: "+" | "-" | "*";
    }
  | {
      type: "number";
      value: string;
    };

function buildRollParts(notation: string, rolls: number[]): RollPart[] {
  const tokens = notation.match(/\d*d\d+|\d+|[+\-*]/gi) ?? [];
  const parts: RollPart[] = [];
  let rollOffset = 0;

  for (const token of tokens) {
    if (token === "+" || token === "-" || token === "*") {
      parts.push({ type: "operator", value: token });
      continue;
    }

    const diceMatch = token.match(/^(\d*)d(\d+)$/i);

    if (!diceMatch) {
      parts.push({ type: "number", value: token });
      continue;
    }

    const count = Number(diceMatch[1] || "1");
    const sides = Number(diceMatch[2]);
    const values = rolls.slice(rollOffset, rollOffset + count);
    rollOffset += count;
    parts.push({
      type: "dice",
      label: `${count}d${sides}`,
      sides,
      values
    });
  }

  return parts;
}

function extractRollLabel(text: string) {
  const separatorIndex = text.indexOf(":");
  return separatorIndex > 0 ? text.slice(0, separatorIndex).trim() : text;
}

function getRollValueClassName(value: number, sides: number) {
  const baseClass = "inline-flex min-w-5 items-center justify-center px-1";

  if (value <= 1) {
    return `${baseClass} bg-rose-500/18 text-rose-200`;
  }

  if (value >= sides) {
    return `${baseClass} bg-emerald-500/18 text-emerald-200`;
  }

  return `${baseClass} text-amber-50`;
}
