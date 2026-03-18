# Client AGENTS.md

Follow the root [AGENTS.md](../AGENTS.md) first. This file adds client-specific rules.

## Client Architecture

1. Keep pages thin.
Pages compose hooks and presentational components. They should not own raw HTTP calls, websocket setup, or large blocks of derived state.

2. Keep transport concerns outside UI.
- REST calls belong in `client/src/features/*/*Service.ts`
- websocket transport belongs in `client/src/services/roomConnection.ts`
- query wiring belongs in feature hooks

3. Use React Query only for non-realtime REST screens.
- Good: campaigns list, admin lists, auth profile refresh
- Not for the live room snapshot, pings, shared previews, or board interaction state

4. Use shared contracts at the boundary.
- Validate REST requests and responses with schemas from `shared/contracts/*`
- Validate websocket messages with the shared realtime schemas
- Do not create parallel DTO types in components or hooks

5. Keep the board split by responsibility.
- Board viewport/persistence logic belongs in `client/src/features/board/useBoardViewport.ts`
- Board math and pure geometry belong in `client/src/features/board/boardUtils.ts`
- Board toolbars and control chrome belong in `client/src/features/board/*Toolbar*.tsx`
- If `BoardCanvas.tsx` grows again, move interaction slices into hooks or visual layers before adding more features

6. Error handling must degrade cleanly.
- Keep the top-level error boundary in place
- Prefer explicit fallback UI for async list screens instead of throwing generic errors into JSX

7. Prefer Tailwind for client styling work.
- Use Tailwind utilities directly in JSX for layout and presentational styling by default
- When a component is already being edited for UI work, migrate it toward Tailwind instead of adding more shared global CSS
- Use `*.module.css` or focused files under `client/src/styles/components/*` only when Tailwind is not a good fit
- Complex board/map/sheet rendering layers may still need CSS, but keep those files narrow and component-owned

## Client File Placement

- `client/src/pages/*` for routed screens
- `client/src/components/*` for reusable presentational or narrow interactive UI
- `client/src/features/<feature>/*` for hooks, selectors, and feature services
- `client/src/lib/*` for generic pure helpers
- `client/src/styles/components/*` for non-module component/feature CSS that cannot be expressed cleanly in Tailwind

## Client TypeScript Rules

1. Prefer `null` in app state and convert to `undefined` only at optional prop boundaries.
2. Reuse child prop types or shared handler types instead of retyping callback signatures in pages.
3. Pass async handlers directly when the child expects `Promise<void>`.
4. Normalize uncertain values before effects and event bindings.
5. Use functional state updates for nested objects and arrays.

## Client Refactor Triggers

Refactor before adding more code when:
- a page exceeds roughly 300-400 lines
- a hook exceeds roughly 200-250 lines
- a component mixes rendering with transport or persistence logic
- multiple screens repeat the same filtering or derived-state logic
- `BoardCanvas.tsx` gains another interaction system without a new hook/layer split
- a styling change would require growing a shared catch-all stylesheet instead of using Tailwind or a component-local style file

## Client Verification

After client structural changes:
- run `tsc --noEmit -p client/tsconfig.json`
- run `npm run lint --workspace client`
- run `npm run build --workspace client`

## Styling Rules

1. Tailwind is the default.
Do not introduce new general-purpose presentational classes for buttons, cards, forms, layout, spacing, or typography unless there is a concrete reason.

2. Keep base CSS small.
`client/src/styles/base.css` and `client/src/index.css` should stay focused on imports, resets, and app-wide primitives.

3. Keep CSS split by owner.
If CSS is needed, prefer one of:
- `ComponentName.module.css`
- `client/src/styles/components/<feature>.css`

4. Do not recreate `legacy.css`.
Large mixed-responsibility CSS files are a refactor smell in this repo.
