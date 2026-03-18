import type { FormEvent } from "react";

export type AuthMode = "login" | "register";

interface AuthPageProps {
  authMode: AuthMode;
  authForm: {
    name: string;
    email: string;
    password: string;
  };
  onAuthModeChange: (mode: AuthMode) => void;
  onAuthFormChange: (field: "name" | "email" | "password", value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function AuthPage({
  authMode,
  authForm,
  onAuthModeChange,
  onAuthFormChange,
  onSubmit
}: AuthPageProps) {
  return (
    <div className="app-shell auth-shell">
      <section className="hero-panel">
        <p className="eyebrow">Dungeon & Dragons 5e 2024</p>
        <h1>Campaign rooms, tactical maps, sheet rolls, line of sight, and monsters in one PWA.</h1>
        <p className="lede">
          Create a room, invite DMs or players, build characters and NPCs, pull monsters from a bestiary, and run the entire scene on a shared board.
        </p>
        <div className="hero-grid">
          <article className="hero-card">
            <h2>Interactive sheet</h2>
            <p>Dark, panel-based character sheet inspired by the layout you provided, with roll buttons across abilities and skills.</p>
          </article>
          <article className="hero-card">
            <h2>Encounter board</h2>
            <p>Multiple maps, adjustable grids, line of sight, token movement, drawing, and walls on a shared board.</p>
          </article>
          <article className="hero-card">
            <h2>Room workflow</h2>
            <p>One chat per campaign, invite codes with roles, and persistent campaign state on the backend.</p>
          </article>
        </div>
      </section>

      <section className="auth-panel">
        <div className="segmented">
          <button className={authMode === "login" ? "is-active" : ""} type="button" onClick={() => onAuthModeChange("login")}>
            Login
          </button>
          <button className={authMode === "register" ? "is-active" : ""} type="button" onClick={() => onAuthModeChange("register")}>
            Register
          </button>
        </div>

        <form className="stack-form" onSubmit={onSubmit}>
          {authMode === "register" && (
            <label>
              Name
              <input value={authForm.name} onChange={(event) => onAuthFormChange("name", event.target.value)} required />
            </label>
          )}
          <label>
            Email
            <input type="email" value={authForm.email} onChange={(event) => onAuthFormChange("email", event.target.value)} required />
          </label>
          <label>
            Password
            <input
              type="password"
              value={authForm.password}
              onChange={(event) => onAuthFormChange("password", event.target.value)}
              required
            />
          </label>
          <button className="accent-button" type="submit">
            {authMode === "login" ? "Enter the table" : "Create account"}
          </button>
        </form>
      </section>
    </div>
  );
}
