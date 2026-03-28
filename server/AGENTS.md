# Server AGENTS.md

Follow the root [AGENTS.md](../AGENTS.md) first. This file adds server-specific rules.

## Server Architecture

1. Keep `server/src/index.ts` minimal.
It should compose middleware, routers, websocket gateway setup, and the error handler. Do not move business logic back into it.

2. Keep HTTP layers explicit.
- routers map paths to controller functions
- controllers validate input and translate HTTP concerns
- services hold business logic and cross-model coordination
- store models own relational reads/writes

3. Keep realtime layers explicit.
- websocket transport and room fan-out belong in `server/src/realtime/roomGateway.ts`
- room/business rules belong in services
- do not duplicate validation between HTTP and websocket code when a shared contract already exists

4. Validate external input with shared schemas.
- use zod schemas from `shared/contracts/*`
- use helpers from `server/src/http/validation.ts`
- do not trust `request.body`, query params, or raw websocket payloads without parsing

5. Keep persistence logic behind the store boundary.
- use `server/src/store/sqliteAdapter.ts` only as the adapter
- keep read/write details in `server/src/store/models/*`
- schema/default normalization belongs in `server/src/store/normalization.ts`
- each schema change gets its own migration file
- never modify old migration files; treat them as append-only and create a new migration for fixes, corrections, or backfills

6. Use structured request logging.
- log through `request.log` inside controllers/middleware
- keep log events structured and machine-readable
- prefer stable event names like `request.start`, `request.complete`, `campaign.updated`

## Contracts And Types

1. API DTOs and websocket message schemas belong in `shared/contracts/*`.
2. Domain entities and game-state types belong in `shared/types.ts`.
3. Do not redefine request/response shapes in controllers when a shared schema already exists.

## Server Refactor Triggers

Refactor before adding more code when:
- a controller starts owning business rules
- a route file contains validation, persistence, and broadcast logic together
- a service reaches across unrelated features without a clear boundary
- a store model starts knowing about HTTP or websocket concerns

## Server Verification

After any server edit:
- always run the relevant automated tests or validation commands before responding
- if there is no dedicated test for the touched server area, run the closest meaningful server verification and state what you ran

After server structural changes:
- run `npm run lint --workspace server`
- run `npm run build --workspace server`
- run the relevant health or endpoint smoke check when behavior changed
