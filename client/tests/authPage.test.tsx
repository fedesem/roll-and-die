import type { FormEvent } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AuthPage } from "../src/pages/AuthPage.tsx";

afterEach(() => {
  cleanup();
});

describe("AuthPage", () => {
  it("shows the registration-only name field after switching modes", async () => {
    const user = userEvent.setup();
    const handleModeChange = vi.fn();

    render(
      <AuthPage
        authMode="login"
        authForm={{ name: "", email: "", password: "" }}
        authError={null}
        onAuthModeChange={handleModeChange}
        onAuthFormChange={() => undefined}
        onSubmit={(event) => event.preventDefault()}
      />
    );

    expect(screen.queryByLabelText("Name")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Register" }));
    expect(handleModeChange).toHaveBeenCalledWith("register");
  });

  it("forwards field changes and submit events", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const handleSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());

    render(
      <AuthPage
        authMode="register"
        authForm={{ name: "Fede", email: "fede@example.com", password: "secret" }}
        authError="Invalid credentials."
        onAuthModeChange={() => undefined}
        onAuthFormChange={handleChange}
        onSubmit={handleSubmit}
      />
    );

    await user.type(screen.getByLabelText("Name"), " Updated");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(handleChange).toHaveBeenCalled();
    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert").textContent).toContain("Invalid credentials.");
  });
});
