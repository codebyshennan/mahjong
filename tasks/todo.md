# Phase 5 — Gameplay Completeness: Todo

See `tasks/plan.md` for full task descriptions, acceptance criteria, and verification.

## Open Questions (resolve before Phase 5B/5D)

- [x] Q1: Tai limit = **5** (Singapore standard)
- [x] Q2: Min tai to win = **1** (caller responsibility — scoring still computes raw if 0)
- [x] Q3: Tai table = the minimal proposed set (animal, matching-flower, seat-wind, prevailing-wind, dragon, self-draw, all-pongs 2, half-color 2, full-color 4)
- [x] Q4: Chip conversion = **`base × 2^(tai-1)` with base 2** (1→2, 2→4, 3→8, 4→16, 5→32)
- [x] Q5: Match = **4 rounds** (one dealer cycle, prevailing wind = East throughout)
- [x] Q6: 連莊 = **yes** (dealer stays on win, doesn't rotate)
- [x] Q7: T6.6 (8-flower instant win) and T6.7 (十三幺) **out of scope** for Phase 5

## Phase 5A — Verify & commit existing work

- [x] **Task 1** (XS) — Verify and commit T6.1 (winCheck) + T6.3 (chow seating restriction)
  - Commit `21c6425`. Manual 4-tab emulator walkthrough still pending.

### Checkpoint A
- [x] One commit pushed; `winCheck.js` + `game.js` no longer dirty

## Phase 5B — Game-end conditions (T6.5)

- [x] **Task 2** (S) — Deck-exhaustion → draw game (流局) banner + input lockout
  - `endRoundAsDraw()` writes `gameState.roundEnd = { type: 'draw' }`; snapshot handler shows overlay + clears timer + locks tile click. Manual 4-tab verification still pending.
- [x] **Task 3** (M) — Round transition + wind rotation + match end + Next-Round button
  - `buildNextRound()` (host-only) reshuffles, redeals 13 each, writes fresh gameState (clears winner/roundEnd, bumps roundNumber, advances dealerSeat unless 連莊). Round-start branch in snapshot handler refetches local hand and re-renders. Match-end overlay auto-shows after round 4 with chip standings + Return to Lobby. `gameState.winner` mirrored locally so 連莊 detection works on host.

### Checkpoint B
- [ ] Full round → win/draw → next round → match-end flow works across 4 tabs (manual verification pending)

## Phase 5C — Kong handling (T6.2)

- [x] **Task 4** (M) — Meld-type metadata foundation (`playerMelds`)
  - `Player` (both `game.js` and `Player.js`) carries `playerMelds: []`. `eatTile` classifies pong (3 same names) vs chow and pushes `{kind, tiles}`. Auto-flowers/animals push `{kind:'flower'|'animal', tiles:[tile]}`. `playerCheckedConverter` now persists `playerMelds` alongside `playerChecked`; `fromFirestore` unchanged so opponents still render flat tiles. New `playerMeldsConverter` exported for Task 5–7 read paths. **Note:** round-start refetch (`game.js:606`) doesn't yet refetch `playerMelds` — fine for fresh-round (always `[]`) but a page-mid-round refresh would lose meld metadata. Address in Task 5 when first read site needs it. Manual 4-tab verification pending.
- [x] **Task 5** (S) — Concealed kong (暗杠) declared from own hand
  - `findConcealedKongCandidates`/`declareConcealedKong`/`renderConcealedKongOptions` in `game.js`. Triggers after auto-draw and in the awaitingDiscard branch (kong-after-eat). Splices 4 from hand, pushes `{kind:'kong-concealed', tiles}` to playerMelds, mirrors to playerChecked for opponent rendering, draws replacement via `drawTile(1, 'special')`, re-checks win and kong-on-kong. Deck-exhaustion during replacement guarded — early-returns to avoid clobbering `gameState.roundEnd` written by `endRoundAsDraw`. Manual 4-tab verification pending.
- [x] **Task 6** (S–M) — Exposed kong (明杠) claimed from opponent's discard
  - `claimExposedKong(discardedTile, fromOpponentIndex)` in `game.js`. Splices 3 of name from hand, builds 4-tile meld `{kind:'kong-exposed'}`, updates local gameState (eattiles, currentPlayer = self, awaitingDiscard = true), draws replacement via `drawTile(1, 'special')`, then a single `runTransaction` writes discarder pile + own player docs; gameState + deck conditional on `replacementOK` to avoid clobbering `roundEnd` if the replacement exhausted the deck. Kong button rendered inside the existing eat-button block whenever `tallyByName()[name] >= 3` (any opponent, not just chow seat). After success: clears eat options, resets `lastCheckedTileIndex`, runs `checkWin`, then `renderConcealedKongOptions()` for kong-on-kong. Manual 4-tab verification pending.

#### Pre-existing follow-ups surfaced during Task 6 (not in scope)
- [ ] Eat/kong claim race: two opponents claiming the same discard simultaneously — second tx skips the pile pop (pile already popped) but its player-side writes still go through, leaving a phantom meld + short hand. Fix: read pile inside tx, abort tx (throw) if last index ≠ discardedTile.index, instead of skipping the pop.
- [ ] Claim priority not enforced: real Singapore mahjong is kong > pong > chow when multiple players claim the same discard. Currently first Firestore write wins. Open Question: defer or implement priority window?
- [x] **Task 7** (S) — Promoted kong (加杠) — add 4th to existing pong
  - `findPromotedKongCandidates`/`promoteKong` in `game.js`. Detects hand tiles whose name matches an existing pong meld; promotes by splicing 1 from hand, mutating the meld in place (`tiles.length 3 → 4`, `kind: 'pong' → 'kong-promoted'`), mirroring into `playerChecked`, drawing replacement, committing, re-checking win + kong-on-kong. Existing `renderConcealedKongOptions` was unified into `renderOwnTurnKongOptions` so both concealed and promoted kongs render in one pass without div-clear conflicts. Manual 4-tab verification pending.

### Checkpoint C
- [ ] All three kong types work; replacement draws come from end of deck; no tile-in-two-places bugs

## Phase 5D — Tai/fan scoring (T6.4)

- [x] **Task 8** (M) — Tai calculator (`scoring.js`)
  - New `public/js/rooms/game/scoring.js`. Pure exports `calculateTai(player, gameState, winType, options?)` and `taiToChips(tai, base=2)`. Counts: animal × n, matching-flower × n, seat-wind, prevailing-wind, dragon × n, self-draw, all-pongs (2), half-color (2), full-color (4). Concealed-set detection via hand tally so in-hand wind/dragon triplets credit. Cap at 5 (Q1). Sanity-tested against 5 sample hands inline (cmd-line node smoke test, no test runner). Not yet wired into `game.js` — that's Task 9.
- [x] **Task 9** (M) — Chip transfer + score display
  - `game.js` imports `calculateTai`/`taiToChips` from `scoring.js`. `showWinScreen(type, discarderUid?)` is now async: computes tai (Q2 false-hu guard at < 1), runs a transaction reading gameState + 4 player metas and writing all 4 metas with chip deltas + winner's hand/checked/discarded + gameState.winner carrying `{uid,name,type,tai,breakdown,chipsTransfer,discarderUid}`. **Race guard** inside the tx aborts if `state.winner` is already set so simultaneous claims don't clobber each other. `showLossScreen` reads tai/breakdown/chipsTransfer off `winner` and renders the breakdown + per-player chip change (only the discarder pays on a discard-win). All 5 callers of `showWinScreen` awaited. `discarderUid` derived from `playersDiv[i].id` in the eat-to-win path. Match-end ranking unchanged — re-reads metas, picks up post-win chips automatically.

### Checkpoint D — Phase 5 complete
- [x] Full match playable end-to-end with scoring + ranking (code-complete; manual 4-tab walkthrough pending)
- [x] T6.1–T6.5 demonstrably complete (code paths in place — verification still manual)
- [ ] No console errors across a full match (pending live walkthrough)

### Phase 5 wrap-up follow-ups (deferred, not in scope)
- Eat/kong claim race: tx-level abort instead of pile-pop skip (flagged in Task 6 commit message).
- Claim priority kong > pong > chow not enforced on simultaneous claims.
- `tilesInHands` / `tilesToPlay` counters drift between draw and discard-win paths — pre-existing accounting inconsistency.
- `updateGameState(_, 'wingame')` is a no-op (case body is `break`); leftover from earlier phases.
- Concealed kong UI shows all 4 tiles face-up to opponents; traditional Singapore mahjong shows 1 face-up + 3 face-down. Cosmetic, post-Phase-5.
- All Phase 5 manual 4-tab walkthroughs (Tasks 1–9) still pending.
