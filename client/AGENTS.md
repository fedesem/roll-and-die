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

## Client File Placement

- `client/src/pages/*` for routed screens
- `client/src/components/*` for reusable presentational or narrow interactive UI
- `client/src/features/<feature>/*` for hooks, selectors, and feature services
- `client/src/lib/*` for generic pure helpers

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

## Client Verification

After client structural changes:
- run `tsc --noEmit -p client/tsconfig.json`
- run `npm run lint --workspace client`
- run `npm run build --workspace client`
