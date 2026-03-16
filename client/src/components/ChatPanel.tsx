import { useEffect, useRef, useState } from "react";

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
    <section className="chat-panel">
      <div className="panel-head">
        <div>
          <p className="panel-label">Room Chat</p>
          <h2>Dice and table chatter</h2>
        </div>
        <p className="panel-caption">Manual rolls use `/roll 1d20+5`.</p>
      </div>

      <div className="chat-log">
        {messages.map((message) => (
          <article key={message.id} className={`chat-message ${message.kind}`}>
            <header>
              <strong>{message.userName}</strong>
              <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </header>
            <p>{message.text}</p>
            {message.roll && (
              <div className="roll-pill">
                <strong>{message.roll.total}</strong>
                <span>
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
        className="chat-form"
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
          placeholder="Talk to the room or type /roll 2d6+3"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button className="accent-button" type="submit">
          Send
        </button>
      </form>
    </section>
  );
}
