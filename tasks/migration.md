# Web Mahjong — React + Vite + TS + Tailwind Migration

Hard cutover from Express+EJS+vanilla-JS-via-CDN to Vite + React + TypeScript + Tailwind. Single branch, no feature flags. Existing Phase 5 gameplay (kong handling, tai/fan scoring, chip transfer, draw game, match end) must be preserved.

## Architecture decisions

- **Framework**: React 18, Vite, TypeScript (strict).
- **Styling**: Tailwind CSS v3 (v4 still has rough edges with the Materialize-style components we'll port). No design system; copy spacing/colors from current EJS pages.
- **Routing**: React Router v6. Routes: `/login`, `/register`, `/lobby`, `/interstitial/:roomId`, `/game/:roomId`, `/demo` (practice mode).
- **Firebase SDK**: npm `firebase@10+`, modular imports. Drops the CDN bare-import pattern.
- **State**: Local component state + Context for auth/firebase singletons. `onSnapshot` listeners migrate to `useEffect` with cleanup. No Redux/Zustand unless something forces it.
- **Server**: Cloud Functions (`functions/`) trimmed to the two RTDB→Firestore mirror triggers (`onUserStatusChanged`, `onLobbyStatusChanged`) only. Express + EJS + auth pages all deleted.
- **Hosting**: `firebase.json` rewrites point to `web/dist` static output, no longer to the `application` Cloud Function.
- **Repo layout**: `web/` for the new client, alongside existing `public/` and `functions/`. `public/` deleted in P6.

## Pure modules to lift verbatim (TS-converted)

These are framework-agnostic and just need typing:
- ✅ `public/js/rooms/game/tileset.js` → `web/src/game/tileset.ts` (also exports `Tile`, `Meld`, `Wind` types + `isSpecialName` / `isNumberedName` / `isDragonName` / `isWindName` helpers)
- ✅ `public/js/utils/makeDeck.js` → `web/src/game/deck.ts` (file renamed from makeDeck for clarity)
- ✅ `public/js/utils/winCheck.js` → `web/src/game/winCheck.ts` (NB: original lives under `utils/`, not `rooms/game/`)
- ✅ `public/js/rooms/game/scoring.js` → `web/src/game/scoring.ts`
- ✅ `public/js/utils/sorthand.js` → `web/src/game/sortHand.ts`
- ⏸ `public/js/rooms/Player.js` — degenerate subset of game.js's inline `Player`. Defer; consolidate to one `web/src/game/player.ts` once 5b/5c reads identify the methods to fold in.
- ⏸ `public/js/utils/timer.js` — drop entirely. Replace with `useEffect` + `setInterval` inside `TurnTimer.tsx`.
- ⏸ `public/js/demo/AIPlayer.js` → `web/src/demo/aiPlayer.ts` (slice 5d)
- ⏸ `public/js/demo/LocalGameState.js` → `web/src/demo/localGameState.ts` (slice 5d)

Tile shape: `{ name: string; index: number; suit: string; url: string; copy?: number; count?: number }`. Meld shape: discriminated union on `kind` (`'pong' | 'chow' | 'kong-exposed' | 'kong-concealed' | 'kong-promoted' | 'flower' | 'animal'`).

## Phases

### P1 — Scaffold (in progress)

Create `web/` with Vite + React 18 + TS + Tailwind v3. Wire emulator connections (auth 9099, firestore 8080, rtdb 9000 — current code uses `12088 / 14701 / 15047`; investigate which is correct during P2). Pin Node 22 via existing `.nvmrc`.

**End-state**: `pnpm --filter web dev` boots; `http://localhost:5173` shows a Tailwind-styled "Web Mahjong — migrating" placeholder; no console errors.

### P2 — Firebase + Auth

- `web/src/lib/firebase.ts` — `initializeApp` + `getAuth`/`getFirestore`/`getDatabase` + emulator connectors.
- `AuthContext` exposing `user`, `loading`, `signIn`, `signUp`, `signOut`.
- `RequireAuth` wrapper for protected routes.
- Port `login.ejs` and `register.ejs` to `LoginPage` / `RegisterPage` components.

**End-state**: Signup against the auth emulator works; logging in lands on `/lobby` (placeholder); logout returns to `/login`.

### P3 — Lobby

- `LobbyPage`: online-users panel (RTDB `.info/connected` presence + Firestore mirror), room list (Firestore `lobby` collection), create-room button, join-room buttons.
- `useFirestoreCollection` / `useRtdbValue` hooks for typed snapshot subscriptions with cleanup.
- Preserve current Firestore data model (`lobby/{roomId}`, `lobby/{roomId}/readiness/{uid}`).

**End-state**: From two browser tabs, can register two accounts, see each other online, create a room from tab 1, join it from tab 2.

### P4 — Interstitial

- `InterstitialPage`: chat panel (RTDB), readiness toggle (Firestore subcollection), seat-wind assignment, host-only "Start game" button.
- On host-start: build deck, deal 13 tiles per player, write `gameState` + per-player tile docs, then route all 4 tabs to `/game/:roomId`.

**End-state**: 4 tabs all reach `/game/:roomId` simultaneously after host clicks start; each player can see their hand.

### P5 — Game (the big one)

Sliced for risk and verifiability. Each slice ends with a runnable checkpoint.

- **5a — pure module lift** ✅. tileset/deck/winCheck/scoring/sortHand to TS. Typecheck passes. Player + timer deferred.
- **5b — replace start-game stub.** Read the rest of `game.js` (lines 75-end) to identify the `Player` API surface used post-deal. Lift to `web/src/game/player.ts`. Replace InterstitialPage's stub `setDoc(gameState)` with the full init: deal 13 to each, write 4 player docs (meta + hand + checked + discarded), write deck doc, write gameState. End-state: clicking Start in 4-player room creates valid Firestore state (verifiable via emulator UI).
- **5c-skeleton — vertical slice.** Smallest possible 4-tab loop: render own hand from Firestore + render opponents' checked + click own tile to discard + opponent renders the new discard. No eat / kong / win / scoring. End-state: 4-tab manual session round-trips a single discard. **This is the architectural gate — if React state flow is wrong, fix here, not deeper.**
- **5c-features.** Layered on top of skeleton, in order of risk:
  1. Turn rotation + timer + auto-discard on timeout.
  2. Eat (pong/chow) claim flow.
  3. Kong (concealed / exposed / promoted) — Phase 5 logic preserved.
  4. Win check + tai calc + chip transfer transaction. Modals (win/loss/draw).
  5. Round transition (連莊, dealer rotation) + match end (4 rounds, ranking).
- **5d — demo mode.** Lift `LocalGameState` + `AIPlayer` to TS. `/demo` route runs against the local state, no Firestore.

**End-state**: Full match playable end-to-end across 4 tabs. Chip transfer correct on discard-win (only discarder pays) and self-draw (all 3 pay). Kong on kong, 流局, match end with chip ranking all work.

**Verification gate**: 4-tab manual session. Playwright single-context can't cover this. Plan a clean test pass at end of 5c-skeleton + at end of 5c-features.

### P6 — Cleanup

- `firebase.json`: change `hosting.public` from `public` to `web/dist`; remove the `function: "application"` rewrite, replace with `{ source: "**", destination: "/index.html" }` for SPA routing.
- `functions/index.js`: keep `onUserStatusChanged` and `onLobbyStatusChanged` only; remove Express, EJS views, auth routes, `application` export. Reduce `functions/package.json` deps accordingly.
- Delete `public/` entirely.
- Delete root `webpack.config.js` and webpack-related deps from root `package.json`.
- Update `CLAUDE.md` with the new layout.

**End-state**: `pnpm --filter web build && firebase deploy` succeeds. Site loads on production. No EJS, no Express, no webpack, no CDN bare imports anywhere.

## Things that must NOT regress

- 4 simultaneous players see each other's discards / checked tiles in real time.
- Phase 5 kong logic (3 variants) and tai scoring (10-tai cap, base-2 chip formula).
- 連莊 (dealer stays on win, doesn't rotate seat winds).
- 4-round match → match-end ranking.
- 流局 (deck exhaustion → draw, no chip transfer).
- Race-guard transactions when two players claim the same discard or both call win.
- Presence: closing a tab marks the user offline within the RTDB `onDisconnect` window.

## Out of scope (still deferred from Phase 5)

- Eat/kong claim race tx-level abort (currently first write wins).
- Claim priority kong > pong > chow.
- 8-flower instant win, 十三幺.
- Concealed kong cosmetic fix (1-up-3-down for opponents).
