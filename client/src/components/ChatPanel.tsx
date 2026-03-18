import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";

import type { ChatMessage } from "@shared/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => Promise<void>;
}

export function ChatPanel({ messages, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <section className="flex h-full min-h-0 flex-col rounded-[1.35rem] border border-white/10 bg-slate-950/78 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`mb-2 rounded-2xl border px-3 py-2.5 text-sm ${
              message.kind === "roll"
                ? "border-amber-200/12 bg-amber-300/8"
                : message.kind === "system"
                  ? "border-sky-200/10 bg-sky-300/8"
                  : "border-white/8 bg-white/[0.03]"
            }`}
          >
            <header className="mb-1.5 flex items-center justify-between gap-3 text-[0.72rem] uppercase tracking-[0.15em] text-slate-400">
              <strong className="truncate text-[0.72rem] font-semibold text-amber-100">{message.userName}</strong>
              <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </header>
            <p className="leading-6 text-slate-200">{message.text}</p>
            {message.roll && (
              <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-full border border-amber-200/12 bg-slate-950/55 px-3 py-1.5 text-xs text-amber-50">
                <strong className="text-sm">{message.roll.total}</strong>
                <span className="text-amber-100/80">
                  {message.roll.notation} [{message.roll.rolls.join(", ")}]
                  {message.roll.modifier !== 0 ? ` ${message.roll.modifier > 0 ? "+" : ""}${message.roll.modifier}` : ""}
                </span>
              </div>
            )}
          </article>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex items-center gap-2 border-t border-white/8 px-3 py-3"
        onSubmit={(event) => {
          event.preventDefault();

          if (!draft.trim()) {
            return;
          }

          void onSend(draft.trim());
          setDraft("");
        }}
      >
        <input
          className="h-11 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-100 outline-none transition focus:border-amber-200/30 focus:bg-white/[0.06]"
          placeholder="Talk to the room or type /roll 2d6+3"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-300/18 text-amber-50 transition hover:bg-amber-300/24" type="submit" aria-label="Send message">
          <SendHorizontal size={15} />
        </button>
      </form>
    </section>
  );
}
