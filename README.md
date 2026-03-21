# Roll or Die

Roll or Die is a PWA-ready Dungeon and Dragons 5e 2024 campaign board built as a Vite monorepo with a React frontend and a Node/Express backend.

## Features

- Account registration and login with token-based sessions
- Campaign rooms with role-based membership (`dm` or `player`)
- Invite codes for joining campaigns
- Screenshot-inspired dark/gold interactive character sheet
- Editable characters, NPCs, and monsters
- Monster catalog for DMs
- Tactical board with multiple maps and per-map token positions
- Adjustable grid with scale and offsets
- Drawing, walls, and fog of war
- One chat per campaign room
- Dice rolls from sheet actions or `/roll 1d20+5` in chat
- SQLite-backed persistence in the backend
- PWA manifest and service worker via `vite-plugin-pwa`

## Workspace

- [client](client): React + Vite frontend
- [server](server): Express API and persistence
- [shared](shared): shared TypeScript models

## Run

```bash
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:4000`

## Build

```bash
npm run build
```

## Data

The backend stores persistent data in `data/app.sqlite`, created automatically on first run.
