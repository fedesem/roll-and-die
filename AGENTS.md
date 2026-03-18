# AGENTS.md

This repository is organized around feature boundaries and explicit responsibility splits. New code should preserve those boundaries instead of growing orchestration files again.

## Core Rules

1. Keep pages thin.
Pages compose feature hooks and presentational components. They should not become controllers full of data fetching, websocket message handling, or large blocks of derived state.

2. Keep I/O out of UI components.
React components and pages must not call `apiRequest`, `fetch`, or open websockets directly.
Use:
- `client/src/features/*/*Service.ts` for HTTP and persistence-adjacent client calls
- `client/src/services/roomConnection.ts` for room websocket transport
- feature hooks for orchestration

3. Put derived state in pure selectors.
Anything computed from campaign snapshot, actors, tokens, maps, fog, or filters belongs in pure selectors or small hooks, not inline inside JSX files.
Preferred locations:
- `client/src/features/<feature>/selectors.ts`
- `client/src/lib/*` for generic pure helpers

4. Split by feature first, then by file type.
Prefer:
- `client/src/features/campaign/...`
- `client/src/features/admin/...`
- `client/src/features/auth/...`
Use `components/`, `pages/`, and `services/` for shared cross-feature pieces, not as the primary place for feature logic.

5. Separate transport state from domain state.
Realtime room state such as snapshots, pings, recalls, and shared previews should live in dedicated hooks. Transport concerns should not be mixed with rendering code.

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

## Server Structure

1. Express endpoints must be split into routers, controllers, and services.
2. Controllers should validate input and delegate business logic.
3. Persistence access must go through store models under `server/src/store/models`.
4. Database-specific behavior must stay behind the store adapter/model boundary.
5. Each schema change gets its own migration file under `server/src/store/migrations`.

## Shared Models

- Shared cross-client/server contracts belong in `shared/types.ts`.
- Shared pure game logic belongs in `shared/*` when both client and server need the same rules.
- Do not duplicate transport or domain shapes locally if they already exist in `@shared/types`.

## CSS and Styling

1. Avoid growing one global stylesheet without structure.
2. Prefer splitting styles by feature or concern when a stylesheet becomes hard to navigate.
3. Keep class names tied to a view or feature, not vague generic names.

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

## Avoid

- Direct `apiRequest` usage in pages or large components
- Direct websocket message wiring inside view components
- Reintroducing giant all-purpose files like old `App.tsx`
- Duplicating shared domain types
- Mixing database schema concerns into controllers

## Verification

After structural changes:
- run the relevant workspace build
- update imports so the boundary is obvious
- keep the final file layout coherent enough that the next feature has an obvious home
