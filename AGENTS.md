# AGENTS.md

This repository is organized around feature boundaries and explicit responsibility splits. New code should preserve those boundaries instead of growing orchestration files again.

More specific rules now live in:

- [client/AGENTS.md](client/AGENTS.md)
- [server/AGENTS.md](server/AGENTS.md)

Use this root file for cross-cutting rules, then follow the nearest child `AGENTS.md` for client or server work.

## Core Rules

1. Keep pages thin.
   Pages compose feature hooks and presentational components. They should not become controllers full of data fetching, websocket message handling, or large blocks of derived state.

2. Keep Docker image families stable.
   If a Dockerfile uses a specific base image family such as Alpine, do not switch it to another image family such as Debian or Ubuntu as part of routine feature work or bug fixing.
   Only adjust the image version when needed unless the user explicitly requests a base-image-family change.

3. Do not add a dedicated `node_modules` Docker volume.
   Do not introduce or reintroduce compose volumes that mount `node_modules` separately from the project bind mount unless the user explicitly asks for that workflow.

4. Keep I/O out of UI components.
   React components and pages must not call `apiRequest`, `fetch`, or open websockets directly.
   Use:

- `client/src/features/*/*Service.ts` for HTTP and persistence-adjacent client calls
- `client/src/services/roomConnection.ts` for room websocket transport
- feature hooks for orchestration

5. Put derived state in pure selectors.
   Anything computed from campaign snapshot, actors, tokens, maps, fog, or filters belongs in pure selectors or small hooks, not inline inside JSX files.
   Preferred locations:

- `client/src/features/<feature>/selectors.ts`
- `client/src/lib/*` for generic pure helpers

6. Split by feature first, then by file type.
   Prefer:

- `client/src/features/campaign/...`
- `client/src/features/admin/...`
- `client/src/features/auth/...`
  Use `components/`, `pages/`, and `services/` for shared cross-feature pieces, not as the primary place for feature logic.

7. Separate transport state from domain state.
   Realtime room state such as snapshots, pings, recalls, and shared previews should live in dedicated hooks. Transport concerns should not be mixed with rendering code.

8. Keep TypeScript contracts strict and consistent.
   Do not mix nullable conventions casually, do not redefine child handler signatures in parent pages, and do not rely on `vite build` alone to validate client types.

## Client Structure

### Pages

- `client/src/pages/*`
- Pages should mostly wire hooks to components.
- If a page grows past roughly 300-400 lines, split sections or move orchestration into hooks.

### Components

- `client/src/components/*`
- Components should be presentational or narrowly interactive.
- Large components should be split by sub-view or visual section.
- Do not embed unrelated business rules in presentational components.

### Hooks

- `client/src/features/<feature>/*.ts`
- Use hooks for orchestration, coordination of setters, and side effects.
- Hooks should expose stable callbacks and derived view models.
- If a hook grows past roughly 200-250 lines, split it by responsibility.

### Services

- `client/src/features/<feature>/*Service.ts`
- Services own HTTP requests and response typing.
- Services should not contain React state.

### Storage

- Use `client/src/hooks/usePersistentState.ts` or helpers in `client/src/lib/storage.ts`.
- Do not read/write `localStorage` or `sessionStorage` directly from page components.

### Routing

- Route definitions and route helpers stay in `client/src/router.ts`.
- New top-level screens should be routed explicitly instead of hidden behind conditional JSX trees.

## TypeScript Rules

1. Use one nullable convention per boundary.
   For client state, prefer `null` for "known empty" values.
   For optional component props, prefer `undefined`.
   Convert explicitly at the boundary instead of letting `null | undefined` spread across multiple files.

2. Reuse handler types instead of rewriting them.
   If a page passes handlers to a child component, do not manually retype the same callbacks with slightly different return types.
   Export and reuse shared prop or handler types when a contract is shared across multiple files.

3. Pass async handlers directly.
   Do not wrap async functions with `() => void someAsyncFn(...)` when passing props unless the child explicitly expects a sync callback.
   Wrapper functions tend to erase `Promise<void>` contracts and create type drift.

4. Prefer functional state updates for nested object edits.
   When editing `ActorSheet`, map state, drawing state, or similar nested structures, use setter callbacks.
   This avoids stale closures and reduces strict-null issues.

5. Narrow values once inside effects.
   If an effect depends on values like `map`, `dragging`, `panning`, or `selectedActor`, guard them first and assign narrowed locals like `const currentMap = map`.
   Use those narrowed locals inside event handlers registered by the effect.

6. Keep "hidden actor" and "missing entity" cases explicit in types.
   If selectors can legitimately return entries without a full actor, encode that in the return type instead of forcing unsafe casts or over-narrow types.

7. Prefer shared model types over local shape copies.
   When a contract already exists in `@shared/types`, reuse it directly or derive from it locally instead of re-declaring a similar object shape.

## Server Structure

1. Express endpoints must be split into routers, controllers, and services.
2. Controllers should validate input and delegate business logic.
3. Persistence access must go through store models under `server/src/store/models`.
4. Database-specific behavior must stay behind the store adapter/model boundary.
5. Each schema change gets its own migration file under `server/src/store/migrations`.
   Never modify old migration files. Treat existing migrations as append-only and create a new migration for follow-up fixes or data backfills.
6. `server/src/index.ts` stays as app composition only. Do not move route logic or websocket business logic back into it.
7. Realtime room behavior belongs in `server/src/realtime/roomGateway.ts` and related services, not inside HTTP controllers.
8. Request validation should use shared zod contracts plus `server/src/http/validation.ts`, not ad hoc object parsing.
9. Structured request logging goes through `request.log` from `server/src/logger.ts`.

## Shared Models

- Shared HTTP and websocket DTO/schema contracts belong in `shared/contracts/*`.
- Shared domain models and game-state types belong in `shared/types.ts`.
- Shared pure game logic belongs in `shared/*` when both client and server need the same rules.
- Do not duplicate transport or domain shapes locally if they already exist in `shared/contracts/*` or `@shared/types`.

## CSS and Styling

1. Prefer Tailwind-first styling for client UI work.
   Use utility classes directly in React components for page shells, cards, forms, buttons, layout, spacing, typography, and state styling unless there is a strong reason not to.

2. Use CSS modules or component-scoped CSS only when Tailwind is a poor fit.
   Good reasons:

- complex interaction styling for board/map SVG layers
- large pseudo-element or keyframe-driven visuals
- third-party content rendering that needs scoped descendant selectors

3. Avoid reintroducing a monolithic global stylesheet.
   If CSS is needed, split it by feature/component under `client/src/styles/components/*` or use `*.module.css` next to the component.

4. Keep shared global CSS minimal.
   Global CSS should be limited to:

- Tailwind entry/imports
- base/reset rules
- truly shared design tokens or cross-app utility selectors

5. Do not add new presentational client components that depend on broad legacy-style class systems.
   If a component is being touched for UI work, prefer migrating it toward Tailwind instead of adding more rules to a shared global file.

6. Keep class names tied to a feature or component when CSS is unavoidable.
   Avoid vague names that make ownership unclear.

## Refactor Triggers

Refactor before adding more code when any of these are true:

- a page/component starts mixing rendering, HTTP, storage, and websocket logic
- a file becomes the only place that “knows everything”
- the same derived filtering or mapping logic appears twice
- a component takes a very large prop list because it is doing too much
- a feature requires comments to explain ownership boundaries

## Preferred Patterns In This Repo

- Pure selectors for campaign/admin derived state
- Feature services for API calls
- Feature hooks for orchestration
- Thin routed pages
- Presentational subcomponents for large views
- Store model separation on the server
- One migration per file
- Shared zod transport schemas for request/response/socket validation
- Structured request logging on the server
- React Query only for non-realtime REST screens
- Tailwind-first client styling with component-scoped CSS only where needed

## Avoid

- Direct `apiRequest` usage in pages or large components
- Direct websocket message wiring inside view components
- Reintroducing giant all-purpose files like old `App.tsx`
- Reintroducing giant all-purpose files like old `server/src/index.ts`
- Duplicating shared domain types
- Duplicating API or websocket DTOs locally
- Mixing database schema concerns into controllers
- Adding new UI styling to a catch-all legacy stylesheet when Tailwind or a local module would work

## Verification

After any file edit:

- always run the relevant automated tests or validation commands before responding
- if no dedicated test exists for the touched area, run the closest meaningful verification for that workspace and state what you ran
- do not skip verification just because the change looks small

After structural changes:

- run lint only on the staged or otherwise touched files by default after client/server code changes; only run repo-wide lint when the change genuinely requires it
- run `tsc --noEmit -p client/tsconfig.json` for client refactors
- use `npm run format:check` before wide formatting or style-only changes
- prefer `npm run check` for a full repo validation pass
- run the relevant workspace build
- do not treat `vite build` as a substitute for TypeScript checking
- update imports so the boundary is obvious
- keep the final file layout coherent enough that the next feature has an obvious home
