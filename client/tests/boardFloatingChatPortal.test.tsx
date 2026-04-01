import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BoardFloatingChatPortal } from "../src/features/campaign/BoardFloatingChatPortal";

afterEach(() => {
  cleanup();
});

describe("BoardFloatingChatPortal", () => {
  it("updates the visible floating chat while mounted when a new roll message is appended", async () => {
    const onSend = vi.fn(async (_text: string) => undefined);
    const { rerender } = render(
      <BoardFloatingChatPortal
        currentUserId="user-1"
        onSend={onSend}
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
      <BoardFloatingChatPortal
        currentUserId="user-1"
        onSend={onSend}
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
