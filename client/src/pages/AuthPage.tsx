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
    <div className="grid min-h-[calc(100dvh-4.75rem)] gap-6 bg-[radial-gradient(circle_at_top_left,rgba(245,198,92,0.12),transparent_24%),linear-gradient(180deg,#090b0f,#11141d)] px-4 py-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(24rem,30rem)] lg:px-8">
      <section className="rounded-none border border-amber-200/10 bg-white/[0.04] p-8 shadow-[0_32px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-amber-200/60">Dungeon & Dragons 5e 2024</p>
        <h1 className="mt-3 max-w-4xl font-serif text-4xl leading-tight tracking-wide text-amber-50 lg:text-5xl">
          Campaign rooms, tactical maps, sheet rolls, line of sight, and monsters in one PWA.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
          Create a room, invite DMs or players, build characters and NPCs, pull monsters from a bestiary, and run the entire scene on a shared board.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-none border border-white/10 bg-slate-950/40 p-5">
            <h2 className="font-serif text-xl text-amber-100">Interactive sheet</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Dark, panel-based character sheet inspired by the layout you provided, with roll buttons across abilities and skills.</p>
          </article>
          <article className="rounded-none border border-white/10 bg-slate-950/40 p-5">
            <h2 className="font-serif text-xl text-amber-100">Encounter board</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Multiple maps, adjustable grids, line of sight, token movement, drawing, and walls on a shared board.</p>
          </article>
          <article className="rounded-none border border-white/10 bg-slate-950/40 p-5">
            <h2 className="font-serif text-xl text-amber-100">Room workflow</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">One chat per campaign, invite codes with roles, and persistent campaign state on the backend.</p>
          </article>
        </div>
      </section>

      <section className="rounded-none border border-amber-200/12 bg-slate-950/75 p-6 shadow-[0_22px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl">
        <div className="inline-flex rounded-none border border-amber-200/12 bg-white/[0.04] p-1">
          <button
            className={`rounded-none px-4 py-2 text-sm font-medium transition ${authMode === "login" ? "bg-amber-300/18 text-amber-50" : "text-slate-300 hover:text-amber-100"}`}
            type="button"
            onClick={() => onAuthModeChange("login")}
          >
            Login
          </button>
          <button
            className={`rounded-none px-4 py-2 text-sm font-medium transition ${authMode === "register" ? "bg-amber-300/18 text-amber-50" : "text-slate-300 hover:text-amber-100"}`}
            type="button"
            onClick={() => onAuthModeChange("register")}
          >
            Register
          </button>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          {authMode === "register" && (
            <label className="grid gap-2 text-sm text-slate-300">
              Name
              <input className="h-12 rounded-none border border-white/10 bg-white/[0.04] px-4 text-slate-100 outline-none transition focus:border-amber-200/30 focus:bg-white/[0.06]" value={authForm.name} onChange={(event) => onAuthFormChange("name", event.target.value)} required />
            </label>
          )}
          <label className="grid gap-2 text-sm text-slate-300">
            Email
            <input className="h-12 rounded-none border border-white/10 bg-white/[0.04] px-4 text-slate-100 outline-none transition focus:border-amber-200/30 focus:bg-white/[0.06]" type="email" value={authForm.email} onChange={(event) => onAuthFormChange("email", event.target.value)} required />
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            Password
            <input
              className="h-12 rounded-none border border-white/10 bg-white/[0.04] px-4 text-slate-100 outline-none transition focus:border-amber-200/30 focus:bg-white/[0.06]"
              type="password"
              value={authForm.password}
              onChange={(event) => onAuthFormChange("password", event.target.value)}
              required
            />
          </label>
          <button className="inline-flex h-12 items-center justify-center rounded-none border border-amber-200/20 bg-amber-300/18 px-5 text-sm font-semibold text-amber-50 transition hover:bg-amber-300/24" type="submit">
            {authMode === "login" ? "Enter the table" : "Create account"}
          </button>
        </form>
      </section>
    </div>
  );
}
