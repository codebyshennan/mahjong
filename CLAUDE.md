# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Web Mahjong — a 4-player online multiplayer mahjong game client using Singapore rules. Built as a Rocket Academy bootcamp project (Project 3). Deployed on Firebase Hosting at `mahjong-7d9ae.firebaseapp.com`.

## Commands

```bash
# Development (requires Firebase emulators)
firebase emulators:start                  # Start all emulators (auth:9099, firestore:8080, rtdb:9000, functions:5001, hosting:5000)
pnpm run watch                            # Webpack dev build with watch mode
cd functions && pnpm run serve            # Start functions emulator only

# Build & Deploy
pnpm run build                            # Production webpack build
firebase deploy                           # Deploy everything
cd functions && pnpm run deploy           # Deploy functions only

# Install dependencies (two separate package.json files)
pnpm install                              # Root dependencies
cd functions && pnpm install              # Cloud Functions dependencies
```

## Architecture

### Dual-Runtime Structure

The app runs across two runtimes with separate `package.json` files:

- **`functions/`** — Firebase Cloud Functions (Node 16, ES modules). Express server exported as `application` HTTPS function. Serves EJS views and handles auth routes. Also exports `onUserStatusChanged` and `onLobbyStatusChanged` database triggers that sync RTDB presence to Firestore.
- **`public/`** — Client-side vanilla JS loaded directly by the browser via ES module imports from `gstatic.com` Firebase CDN URLs (not bundled). Webpack is configured but only used for SCSS bundling, not the game JS.

### Firebase Services Used

- **Firebase Auth** — email/password registration and login
- **Realtime Database (RTDB)** — presence/online status, chat messages (low-latency)
- **Cloud Firestore** — game state, lobby rooms, player tiles, readiness tracking (structured data)
- **Firebase Hosting** — static assets, rewrites all routes to the `application` Cloud Function

### Game Flow (3 screens)

1. **Lobby** (`public/js/rooms/lobby/lobby.js`) — shows online users, create/join rooms. Rooms stored in Firestore `lobby` collection.
2. **Interstitial** (`public/js/rooms/interstitial/interstitial.js`) — waiting room with chat, readiness toggle, host starts game. On start: builds deck, deals 13 tiles per player, writes game state to Firestore, then redirects all players to game.
3. **Game** (`public/js/rooms/game/game.js`) — the mahjong table. Players draw/discard tiles in turn order (east→south→west→north). 10-second turn timer auto-discards a random tile on timeout. Opponents' checked/discarded tiles rendered via Firestore `onSnapshot` listeners.

### Key Game Concepts

- **148-tile deck**: 108 numbered (bamboo/dots/character × 9 × 4), 16 wind, 12 dragon, 8 flower, 4 animal
- **Player state**: `playerHand` (hidden), `playerChecked` (revealed melds/flowers), `playerDiscarded` (discard pile)
- **Tile eating**: when an opponent discards, checks if the tile can form a pong (triple) or chow (sequence) with tiles in hand
- **Flower/animal tiles**: auto-checked on draw, replacement tile drawn from bottom of deck (`type='special'`)

### Firestore Data Model

```
lobby/{roomId}                    — room metadata (host, players[], state, playerCount)
lobby/{roomId}/readiness/{uid}    — player readiness flags
games/{roomId}/gameState/{roomId} — current game state (turn, wind, tile counts)
games/{roomId}/players/{uid}      — player meta (name, wind, chips, score)
games/{roomId}/players/{uid}/tiles/playerHand      — hidden hand
games/{roomId}/players/{uid}/tiles/playerChecked    — revealed melds
games/{roomId}/players/{uid}/tiles/playerDiscarded  — discard pile
games/{roomId}/deck/deckInPlay    — remaining deck array
```

### Important Files

- `public/js/rooms/game/tileset.js` — tile constants (suits, names, emoji mappings, win combos)
- `public/js/utils/makeDeck.js` — `buildDeck()` builds and shuffles all 148 tiles
- `public/js/rooms/game/converters.js` — Firestore data converters for Player fields
- `public/js/rooms/Player.js` — standalone Player class (exported, used by interstitial)
- `functions/index.js` — Express routes + Cloud Function triggers

### Presence System

RTDB is used as the presence source of truth (via `.info/connected` + `onDisconnect`). Cloud Functions (`onUserStatusChanged`, `onLobbyStatusChanged`) mirror RTDB status changes into Firestore for querying. The client also writes to both RTDB and Firestore directly for local cache consistency.

## Development Notes

- All client JS uses bare ES module imports from Firebase CDN (`https://www.gstatic.com/firebasejs/9.1.1/...`), not package-manager-installed modules. The root `package.json` dependencies are for the Cloud Functions server side.
- Firebase config is imported from `public/js/config.js` (client) and `functions/firebaseConfig.js` (server) — both gitignored.
- Emulator connections are hardcoded in every client JS file (`connectAuthEmulator`, `connectDatabaseEmulator`, `connectFirestoreEmulator`).
- The `roomId` variable in game and interstitial pages is injected by EJS templates from Express route params.
- No test suite exists (`pnpm test` is a no-op).
- CI: GitHub Actions auto-deploys to Firebase Hosting on push to `master`.
