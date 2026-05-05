# Implementation Plan: Phase 5 — Gameplay Completeness

## Overview

Complete Singapore Mahjong gameplay rules. Brings the game from "tiles can be drawn/discarded/eaten" to "a full match can be played, won, scored, and ended." Touches T6.1–T6.5 from `TODO.md`.

Source of truth for rules: `rules.html` (tile-image gallery of winning patterns) + Singapore mahjong conventions (see Open Questions below — `rules.html` does not specify tai counts, scoring, or match length).

## Current State (read-only audit)

| Task | Status | Evidence |
|------|--------|----------|
| T6.1 Win detection | **mostly done** (untracked) | `public/js/utils/winCheck.js` exists; wired in `game.js:555` (after eat) and `game.js:630` (after self-draw); `showWinScreen()` (`game.js:720`) + `showLossScreen()` (`game.js:738`) overlays exist; `gameState.winner` persisted (`game.js:734`) |
| T6.2 Kong handling | **not started** | No grep hits for kong/gang. No declare-kong button, no replacement-draw path for kong. |
| T6.3 Chow seating restriction | **done** (untracked) | `game.js:510-514` — only player at `(currentPlayer+1) % 4` can take chow combos |
| T6.4 Tai/fan scoring | **not started** | `chips`/`currentScore` declared on `Player` but never updated |
| T6.5 Game-end conditions | **partial** | `drawTile` warns on deck-exhaustion (`game.js:128, 138`) but doesn't end the round; no wind rotation; no match end |

## Architecture Decisions

1. **Meld-type metadata.** When a meld is added to `playerChecked`, also persist its kind (`pong` / `chow` / `kong-exposed` / `kong-concealed` / `kong-promoted` / `eye` / `flower` / `animal`). Required by both kong handling and scoring. Today `playerChecked` is a flat array of tile objects; we'll add a sibling array `playerMelds` (or replace with grouped structure) — TBD in Task 4.
2. **Round/match state lives in `gameState`.** Add `gameState.roundNumber`, `gameState.matchNumber` (or similar), `gameState.dealer` (uid of east), `gameState.prevailingWind`. Round end clears per-player tiles + reshuffles deck + redeals + rotates seats/winds when applicable.
3. **Host owns "next round" deal.** Mirrors the current pattern (host runs `startGameInstance` in interstitial). On round-end the host reshuffles + redeals; non-host clients react to a `gameState.roundStartedAt` timestamp via `onSnapshot`.
4. **Kong = a deferred-decision UI.** Like the current eat-prompt, kongs surface buttons in `#eatOptions`. Concealed/promoted kong are surfaced on the player's own turn (after draw). Exposed kong is surfaced when an opponent discards (alongside pong/chow buttons).
5. **Scoring config in one file.** New `public/js/rooms/game/scoring.js` exports a tai table + chip-conversion fn. Keeps Singapore-rule tweaks in one place.
6. **No tests.** Project has no test runner (`pnpm test` is a no-op). Verification is manual (browser walkthrough in 4 tabs against the emulator) plus inline `console.assert`-style sanity checks where they're cheap.

## Dependency Graph

```
T6.1 win-finish ─┐
T6.3 chow-seat ──┴── verify + commit
                              │
                              ├── T6.5 deck-exhaust + draw (流局)
                              │       │
                              │       └── T6.5 round transition + wind rotation + match end
                              │              │
                              ├── T6.2 concealed kong (own hand) ┐
                              │                                  │
                              ├── T6.2 exposed kong (from discard)┤
                              │                                  │
                              └── T6.2 promoted kong (add 4th)   ┴── meld-type metadata
                                                                    │
                                                                    └── T6.4 tai calculator
                                                                              │
                                                                              └── T6.4 chip transfer + score display
```

## Task List

### Phase 5A — Verify & commit existing work

#### Task 1: Verify and commit T6.1 + T6.3
**Description:** The win-detection module and chow seating restriction are written but uncommitted. Walk through both in the emulator with 4 tabs, confirm the overlays render for both self-draw and discard wins, confirm only the player to the right of the discarder gets chow buttons, then commit.

**Acceptance criteria:**
- [ ] In a 4-tab emulator session, a self-draw winning hand triggers `showWinScreen('self-draw')` on the winner's tab and `showLossScreen(...)` on the other 3
- [ ] A discard win (eat-to-win) triggers the same on the winner / others
- [ ] When player N discards, only player (N+1)%4 sees chow combos in `#eatOptions`; pong-only combos still appear for everyone
- [ ] Edge case: chow combo that's also a pong (impossible by construction, but) — verify pong still works for non-right players
- [ ] `winCheck.js` and the related `game.js` changes committed with a message that names T6.1 + T6.3

**Verification:**
- [ ] Manual: 4-tab walkthrough described above
- [ ] Build: `pnpm run build` succeeds
- [ ] No console errors during a full round

**Dependencies:** None
**Files likely touched:** `public/js/utils/winCheck.js` (already written), `public/js/rooms/game/game.js` (already modified) — commit only
**Estimated scope:** XS

---

### Checkpoint: Phase 5A
- [ ] Single commit pushed for T6.1 + T6.3
- [ ] `git status` shows winCheck.js + game.js no longer dirty

---

### Phase 5B — Game-end conditions (T6.5)

#### Task 2: Deck-exhaustion → draw game (流局)
**Description:** When `deckInPlay` is empty during a draw attempt, end the current round as a draw (no winner, no chip transfer). Current code only `console.warn`s. Replace with a `gameState.roundEnd = { type: 'draw' }` write that all clients react to.

**Acceptance criteria:**
- [ ] `Player.drawTile` (in `game.js`) detects empty deck and writes `gameState.roundEnd = { type: 'draw', endedAt: <ts> }`
- [ ] All 4 clients render a draw banner (similar look to `showWinScreen` but neutral copy: "流局 — Draw") via the `gameStateRef` snapshot
- [ ] Turn timer is cleared on all clients
- [ ] No further discards/eats are accepted (UI input disabled until next round starts)

**Verification:**
- [ ] Manual: in emulator, set `deckInPlay` to a 1-tile array via Firestore UI before a draw attempt; confirm draw banner shows on all 4 tabs
- [ ] Build: `pnpm run build` succeeds

**Dependencies:** Task 1
**Files likely touched:** `public/js/rooms/game/game.js`
**Estimated scope:** S (1 file, ~30 lines)

---

#### Task 3: Round transition + wind rotation + match end
**Description:** After a win or draw, the host re-deals a fresh round. Wind rotates per Singapore convention (decision from Open Q5: simplest is "wind rotates every round; match = 4 rounds = one wind cycle = 16 games" — confirm with user before implementing). Provide a "Next Round" button visible only to the host on the win/draw overlay; clicking it reshuffles, redeals, increments `roundNumber`, rotates `prevailingWind` and seats if needed, and writes new game state. Non-host clients re-render on `gameStateRef` snapshot.

**Acceptance criteria:**
- [ ] Host sees "Next Round" button on win/draw overlay; non-host sees "Waiting for host..."
- [ ] Clicking it: reshuffles deck (`buildDeck()`), wipes per-player `playerHand/Checked/Discarded`, redeals 13 tiles per player, increments `gameState.roundNumber`, sets `gameState.currentPlayer = 0` (east), clears `gameState.winner`/`roundEnd`
- [ ] Wind rotation happens between rounds per agreed rule (default: dealer rotates each round; after 4 rounds the prevailing wind rotates)
- [ ] After 16 games (or whatever match length is decided), a "Match Complete" screen shows final scores and a "Return to Lobby" button
- [ ] All overlays dismiss correctly on next-round start

**Verification:**
- [ ] Manual: play a quick round to a draw, click Next Round, confirm fresh hands on all 4 tabs
- [ ] Manual: play a win, confirm dealer rotation works
- [ ] Manual: simulate match-end by manually setting `gameState.roundNumber = 16` then triggering a win

**Dependencies:** Task 2
**Files likely touched:**
- `public/js/rooms/game/game.js` (round-end UI, snapshot handler)
- `public/js/rooms/interstitial/interstitial.js` (extract `playerGameInit` so it can be reused for re-deal — or duplicate carefully in game.js)
- New: `public/js/rooms/game/roundManager.js` (deal/reshuffle helpers, host-only)

**Estimated scope:** M (3-4 files, ~150 lines)

---

### Checkpoint: Phase 5B
- [ ] All four players can finish a round (win or draw) and start a new one
- [ ] Match-end screen displays final scores (placeholder if scoring not yet wired)
- [ ] No stale tiles from previous round on any client

---

### Phase 5C — Kong handling (T6.2)

#### Task 4: Meld-type metadata foundation
**Description:** Today every meld in `playerChecked` is just an array of tiles. Scoring and kong-promotion both need to know "is this a pong, chow, or kong, and which tiles formed it." Introduce a parallel `playerMelds` structure: array of `{ kind: 'pong'|'chow'|'kong-exposed'|'kong-concealed'|'kong-promoted'|'flower'|'animal', tiles: [...] }`. Update `eatTile` to push a meld entry; update Firestore converter; update render code so opponents still see the flat tile list.

**Acceptance criteria:**
- [ ] `Player` instances carry a `playerMelds` array
- [ ] `eatTile` populates a meld entry with kind = `pong` (3 same names) or `chow` (3 sequential)
- [ ] Auto-flowers/animals during `drawTile` create `kind: 'flower'` / `kind: 'animal'` meld entries
- [ ] Firestore converter persists `playerMelds`; opponents' UI unchanged (they still render tiles flat from `playerChecked`)
- [ ] Existing win-check logic still passes

**Verification:**
- [ ] Manual: eat a chow, eat a pong, draw a flower; inspect Firestore — three meld entries with correct kinds
- [ ] No regression in win detection

**Dependencies:** Task 1 (so we're committing on a clean base)
**Files likely touched:**
- `public/js/rooms/game/game.js` (Player class, eatTile, drawTile)
- `public/js/rooms/Player.js` (mirror)
- `public/js/rooms/game/converters.js` (new converter or extend `playerCheckedConverter`)
- `public/js/rooms/interstitial/interstitial.js` (init `playerMelds: []`)

**Estimated scope:** M (4 files, ~80 lines)

---

#### Task 5: Concealed kong (暗杠) — declare from own hand
**Description:** On the player's own turn (after draw, before discard), if they hold 4 of the same tile in `playerHand`, surface a "Declare Kong" button. On click: move all 4 to `playerMelds` as `kind: 'kong-concealed'`, draw a replacement tile from end of deck (pop), and re-evaluate win.

**Acceptance criteria:**
- [ ] Detection: scan `playerHand` for any name with count == 4 after each draw; surface button(s) in `#eatOptions`
- [ ] Declare: removes 4 tiles from hand, adds meld entry, pops 1 replacement from `deckInPlay`, re-renders
- [ ] Replacement tile triggers `checkWin` again (kong-on-kong-on-win is a thing)
- [ ] If replacement is a flower/animal, the existing flower-replacement loop still runs
- [ ] Player still must discard after kong (unless they win)

**Verification:**
- [ ] Manual: seed a hand with 4 east tiles via Firestore, take a turn, click Declare Kong, confirm meld appears + replacement tile drawn
- [ ] Manual: confirm kong→win flow works

**Dependencies:** Task 4
**Files likely touched:** `public/js/rooms/game/game.js`
**Estimated scope:** S (1 file, ~50 lines)

---

#### Task 6: Exposed kong (明杠) — claim from discard
**Description:** When an opponent discards a tile that the player holds 3 of, surface a "Kong" button alongside the existing pong/chow buttons. Same seating rule as pong (any opponent can claim, not just the one to the right). On click: move all 3 from hand + the discarded tile into `playerMelds` as `kind: 'kong-exposed'`, draw a replacement, become the current player, must discard.

**Acceptance criteria:**
- [ ] Kong button appears in `#eatOptions` when discarded-tile-name appears 3× in player's hand
- [ ] Button works for any opponent (not just right-of-discarder)
- [ ] Splices the discarded tile from the discarder's pile (matches existing pong transaction in `game.js:535-548`)
- [ ] Replacement tile drawn from `deckInPlay.pop()`
- [ ] `gameState.currentPlayer` becomes the kong-er; `awaitingDiscard = true`
- [ ] After replacement, `checkWin` runs

**Verification:**
- [ ] Manual: seed a 4-tab game so player A holds 3 wests and player B discards a west; confirm kong button shows on player A's tab; click; confirm meld + transaction success

**Dependencies:** Task 5
**Files likely touched:** `public/js/rooms/game/game.js` (extend `checkIfCanBeEaten` and the eat-button rendering)
**Estimated scope:** S–M (1 file, ~70 lines)

---

#### Task 7: Promoted kong (加杠) — add 4th to existing pong
**Description:** On the player's turn (after draw), if they hold a tile that matches one of their existing pong melds, surface a "Promote Kong" button. On click: move that 1 tile from hand into the meld, change kind from `pong` to `kong-promoted`, draw a replacement.

**Acceptance criteria:**
- [ ] Detection: scan `playerHand` for a name that matches the tile-name of any meld in `playerMelds` with `kind: 'pong'`
- [ ] Promote: removes 1 tile from hand, mutates meld (length 3 → 4, kind → `kong-promoted`), pops 1 from `deckInPlay`
- [ ] Re-render preserves opponents' view (the meld still displays correctly)
- [ ] After replacement, `checkWin` runs

**Verification:**
- [ ] Manual: complete a turn where the player has an existing pong (eaten earlier), then draws the 4th tile; confirm Promote Kong button + meld update

**Dependencies:** Task 6
**Files likely touched:** `public/js/rooms/game/game.js`
**Estimated scope:** S (1 file, ~40 lines)

---

### Checkpoint: Phase 5C
- [ ] All three kong types work end-to-end
- [ ] Replacement draws correctly come from end of deck
- [ ] No tile-in-two-places bugs (verify Firestore consistency after each kong type)

---

### Phase 5D — Tai/fan scoring (T6.4)

#### Task 8: Tai calculator (`scoring.js`)
**Description:** New module `public/js/rooms/game/scoring.js` exports `calculateTai(player, gameState, winType)` returning `{ tai: number, breakdown: [{ name, tai }, ...] }`. Implement the agreed Singapore tai table (decision needed — see Open Q3). Inputs: player's `playerHand` + `playerMelds`, `gameState.prevailingWind`, player's `wind`, win type (`self-draw` / `discard-win` / `kong-replacement`).

**Acceptance criteria:**
- [ ] Pure function, no Firestore deps, easily testable manually with sample hands
- [ ] Counts at minimum: animal (1 tai each), flower set (1 tai per matching wind), seat wind triplet (1 tai), prevailing wind triplet (1 tai), dragon triplet (1 tai each), all-pongs / 碰碰胡 (2 tai), half-color / 混一色 (2 tai), full-color / 清一色 (4 tai), self-draw (1 tai)
- [ ] Returns 0 tai if hand isn't actually winning (defensive — caller should have checked already)
- [ ] Console-loggable breakdown for debugging

**Verification:**
- [ ] Manual: hand-seed 5 known winning patterns from `rules.html`, run `calculateTai` in DevTools console, confirm tai counts match expected
- [ ] No regressions in win detection

**Dependencies:** Task 4 (needs `playerMelds` for meld-type counting)
**Files likely touched:** New: `public/js/rooms/game/scoring.js`. Updates: `public/js/rooms/game/game.js` (call after `checkWin`)
**Estimated scope:** M (1 new file ~150 lines + small wiring)

---

#### Task 9: Chip transfer + score display
**Description:** On a win, calculate tai, convert to chips per the agreed table (Open Q4), transfer chips between players, persist `currentScore`, display the breakdown in the win/loss overlay.

**Acceptance criteria:**
- [ ] Win-screen overlay shows: tai count, breakdown list, chip change for each player
- [ ] Discard win: discarder pays the winner full chips
- [ ] Self-draw win: all 3 losers pay the winner full chips each
- [ ] Chips persisted to Firestore via the existing player-meta converter
- [ ] Negative chips allowed (no game-over from bankruptcy in Phase 5; flag for future)
- [ ] Match-end screen (Task 3) shows final chip totals as winner ranking

**Verification:**
- [ ] Manual: complete a discard win, confirm discarder loses chips, winner gains; confirm `currentScore` updated in Firestore
- [ ] Manual: complete a self-draw, confirm all 3 lose chips
- [ ] Manual: complete a 2-round match, confirm match-end ranking is correct

**Dependencies:** Task 8, Task 3 (match-end screen)
**Files likely touched:**
- `public/js/rooms/game/scoring.js` (add `taiToChips` fn)
- `public/js/rooms/game/game.js` (modify `showWinScreen`/`showLossScreen` to render breakdown + write chip changes)
- `public/js/rooms/game/converters.js` (`currentScore` already in converter, just confirm)

**Estimated scope:** M (3 files, ~100 lines)

---

### Checkpoint: Phase 5D
- [ ] A full match can be played to completion: 16 rounds, dealer rotation, scoring, final ranking
- [ ] All five tasks (T6.1–T6.5) demonstrably complete
- [ ] No console errors across a full match
- [ ] Ready for review

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Singapore tai rules ambiguous | High | Open Questions block — get explicit decision from user before Task 8 |
| Round-transition desyncs across 4 clients | High | Drive everything off `gameStateRef` snapshot; host is single writer for new round |
| Kong replacement-draw races with another player's eat-decision | Med | Run kong as a Firestore transaction (mirror existing eat transaction pattern) |
| `playerMelds` migration breaks existing `playerChecked` rendering | Med | Keep `playerChecked` populated in parallel during Task 4; cut over fully only after Task 8 lands |
| No test suite — bugs caught only at runtime | Med | Dense manual checkpoints; consider adding Vitest in Phase 6+ |
| Reshuffle redeals into players' active state mid-tile-click | Low | Disable input via `gameState.roundEnd` flag before shuffling |

## Open Questions (need user decisions before Phase 5D, ideally before 5B)

1. **Tai limit (max tai per win)** — common Singapore: **5**. Confirm?
2. **Min tai required to win** — common: **1**. Confirm?
3. **Tai table** — proposed minimal set listed in Task 8 acceptance criteria. Add anything else? (e.g. 平和 pinghu, 十三幺 — tracked separately as T6.7)
4. **Chip conversion** — common: `chips = base * 2^(tai-1)`, capped at max-tai. Confirm base value (e.g., 1, 2, 5)?
5. **Match length & wind rotation** — proposed: dealer wind rotates every round; match = 4 prevailing-wind cycles × 4 dealer rotations = 16 rounds. Common variants: 4 rounds (1 cycle), 8 rounds. Pick one.
6. **Dealer-stays-on-win rule** — in some variants, dealer keeps the dealer seat if they win (連莊). Implement or skip?
7. **Out-of-scope confirm** — T6.6 (花胡 flower-instant-win) and T6.7 (十三幺 thirteen wonders) are listed separately in TODO and *not* in this plan. Confirm we're skipping them for now.

## Parallelization Opportunities

- Tasks 1–3 (Phase 5A + 5B) sequential — they share `gameState` shape changes
- Tasks 5, 6, 7 (kong types) can be done by separate agents in parallel after Task 4 lands
- Task 8 (tai calc) is pure-function; can be drafted in parallel with Task 5 once Task 4's `playerMelds` shape is locked
- Task 9 (chip transfer) sequential after 8 + 3
