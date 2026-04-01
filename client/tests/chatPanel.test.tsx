import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatPanel } from "../src/components/ChatPanel";

afterEach(() => {
  cleanup();
});

describe("ChatPanel", () => {
  it("shows local help for /help without sending a message", async () => {
    const onSend = vi.fn(async (_text: string) => undefined);
    const user = userEvent.setup();

    render(<ChatPanel messages={[]} currentUserId="user-1" onSend={onSend} />);

    await user.type(screen.getByPlaceholderText("Talk to the room or type /r 2d6+3"), "/help");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(onSend).not.toHaveBeenCalled();
    expect(await screen.findByText("Local Help")).not.toBeNull();
    expect(screen.getByText((content) => content.includes("/r 2d20kh1+4"))).not.toBeNull();
  });

  it("reuses the current user's chat and roll history with arrow up", async () => {
    const user = userEvent.setup();

    render(
      <ChatPanel
        currentUserId="user-1"
        onSend={vi.fn(async (_text: string) => undefined)}
        messages={[
          {
            id: "msg-1",
            campaignId: "camp-1",
            userId: "user-1",
            userName: "Fede",
            text: "hello room",
            createdAt: "2026-03-31T10:00:00.000Z",
            kind: "message"
          },
          {
            id: "msg-2",
            campaignId: "camp-1",
            userId: "user-1",
            userName: "Fede",
            text: "Fede initiative: 2d20kh1+3",
            createdAt: "2026-03-31T10:01:00.000Z",
            kind: "roll",
            roll: {
              id: "roll-1",
              label: "Fede initiative",
              notation: "2d20kh1+3",
              rolls: [5, 17],
              modifier: 0,
              total: 20,
              breakdown: "(2d20kh1[5, 17 -> 17] + 3)",
              createdAt: "2026-03-31T10:01:00.000Z"
            }
          }
        ]}
      />
    );

    const input = screen.getByPlaceholderText("Talk to the room or type /r 2d6+3");

    await user.click(input);
    await user.keyboard("{ArrowUp}");
    expect((input as HTMLInputElement).value).toBe("/r 2d20kh1+3");

    await user.keyboard("{ArrowUp}");
    expect((input as HTMLInputElement).value).toBe("hello room");
  });

  it("shows appended roll messages while always following the latest messages", async () => {
    const onSend = vi.fn(async (_text: string) => undefined);
    const { rerender } = render(
      <ChatPanel
        currentUserId="user-1"
        onSend={onSend}
        alwaysFollowLatest
        messages={[
          {
            id: "msg-1",
            campaignId: "camp-1",
            userId: "user-1",
            userName: "Fede",
            text: "hello room",
            createdAt: "2026-03-31T10:00:00.000Z",
            kind: "message"
          }
        ]}
      />
    );

    expect(screen.getByText("hello room")).not.toBeNull();

    rerender(
      <ChatPanel
        currentUserId="user-1"
        onSend={onSend}
        alwaysFollowLatest
        messages={[
          {
            id: "msg-1",
            campaignId: "camp-1",
            userId: "user-1",
            userName: "Fede",
            text: "hello room",
            createdAt: "2026-03-31T10:00:00.000Z",
            kind: "message"
          },
          {
            id: "msg-2",
            campaignId: "camp-1",
            userId: "user-1",
            userName: "Fede",
            text: "Fede initiative: 2d20kh1+3",
            createdAt: "2026-03-31T10:01:00.000Z",
            kind: "roll",
            roll: {
              id: "roll-1",
              label: "Fede initiative",
              notation: "2d20kh1+3",
              rolls: [5, 17],
              modifier: 0,
              total: 20,
              breakdown: "(2d20kh1[5, 17 -> 17] + 3)",
              createdAt: "2026-03-31T10:01:00.000Z"
            }
          }
        ]}
      />
    );

    expect(await screen.findByText("Fede initiative")).not.toBeNull();
    expect(screen.getByText("20")).not.toBeNull();
  });
});
