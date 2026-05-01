# Mahjong Project Audit — TODO

Full audit of logic, gameplay, UI/UX, architecture, security, and packages.
Findings ordered by severity within each category.

---

## T1 — Showstoppers (game cannot function)

### T1.1 Syntax errors prevent eat flow from working
- **File:** `game.js:595` — trailing `=` after `renderPlayerTiles(...)=` is a SyntaxError
- **File:** `game.js:567` — stray backticks ` `` ` after `onSnapshot` callback closing paren
- **Impact:** The entire tile-eating code path is dead. Any opponent discard triggers a parse error.

### T1.2 Only the host (player 0) can click to discard tiles
- **File:** `game.js:428` — `if(gameState.currentPlayer == 0)` is hardcoded
- **Fix:** Change to `if(gameState.currentPlayer == currentPlayer.playerNumber)`
- **Impact:** Non-host players can never manually discard; they always time out (10s) and have a random tile auto-discarded.

### T1.3 Deck is never written back to Firestore after draws
- **File:** `game.js:647-649` — reads deck from Firestore, draws locally via `deckInPlay.shift()`, but never saves the modified deck
- **File:** `game.js:67-75` — `commitPlayerHandToFS` saves hand/checked/discarded/gameState but NOT the deck
- **Impact:** Every player reads the same unmodified deck and draws duplicate tiles. Core multiplayer is broken.

### T1.4 Build pipeline is broken — webpack template doesn't exist
- **File:** `webpack_conf/webpack.dev.js:32` and `webpack_conf/webpack.prod.js:13` — template `src/main.html` does not exist
- **File:** `.github/workflows/` — CI runs `pnpm install --frozen-lockfile && pnpm run build` on every push to master
- **Impact:** Every CI deploy has been failing. `pnpm run build` and `pnpm run watch` crash immediately.
- **Fix:** Either create `src/main.html` or remove webpack (currently only used for SCSS bundling).

### T1.5 `gameroom.js` camera permission blocks game loading
- **File:** `game.ejs:68` — `<script type="module" src="/js/rooms/game/gameroom.js" defer>`
- **File:** `gameroom.js:45-48` — top-level `await navigator.mediaDevices.getUserMedia(...)` with no try/catch
- **Impact:** If user denies camera/mic, the unhandled rejection may prevent `game.js` from loading (it imports `fsdb` from `gameroom.js`). Even if camera is allowed, `hostCalling`/`guestsAnswering` are commented out in `game.js:12`, so the video grid shows empty boxes for no reason.
- **Fix:** Remove the script tag from `game.ejs` or gate behind a feature flag.

---

## T2 — Correctness Bugs (game plays incorrectly)

### T2.1 Tile index collisions in deck building
- **File:** `makeDeck.js:36` — wind index formula `108 + (copy + 1) * (tiletype + 1)` produces collisions:
  - east copy=1 (110) == south copy=0 (110)
  - east copy=3 (112) == south copy=1 (112) == north copy=0 (112)
  - Many more overlaps for wind and dragon tiles
- **File:** `makeDeck.js:52` — dragon index formula `124 + (copy + 1) * (tiletype + 1)` has same issue
- **Impact:** `discardTile` uses `findIndex(tile => tile.index == targetIndex)` — with collisions it may match the wrong tile.
- **Fix:** Wind: `108 + (tiletype * 4) + copy + 1`. Dragon: `124 + (tiletype * 4) + copy + 1`.

### T2.2 `possibleMergeCombinations` is never reset
- **File:** `game.js:31` — initialized as `[]`, pushed to on every opponent discard check, never cleared
- **Impact:** Stale combinations accumulate across turns. Players see eat options from 5 turns ago mixed with current ones.
- **Fix:** Reset to `[]` at the start of each eat check cycle.

### T2.3 Pong detection misses hands with 3 matching tiles
- **File:** `game.js:248,261` and `Player.js:181,194` — `playerTally[name] == 2` (strict equality to 2)
- **Impact:** If a player holds 3 of a tile, the `== 2` check fails and a valid pong is missed. Also prevents kong detection entirely.
- **Fix:** `>= 2` for pong. Add separate `>= 3` check for kong.

### T2.4 `startButton.disabled` uses comparison instead of assignment
- **File:** `interstitial.js:54` — `startButton.disabled == false` (should be `=`)
- **File:** `interstitial.js:56` — `startButton.disabled == true` (should be `=`)
- **Impact:** The readiness gate never enables/disables the start button. Host can start any time regardless of player readiness.

### T2.5 `loggedInUser['host']` uses comparison instead of assignment
- **File:** `interstitial.js:207` — `loggedInUser['host'] == true` (should be `=`)
- **File:** `interstitial.js:209` — `loggedInUser['host'] == false` (should be `=`)
- **Impact:** Host flag is never actually set on the user object.

### T2.6 Wind changes every turn instead of every round
- **File:** `game.js:693-694` — `++gameState.windCount; gameState.currentWind = WIND_TILES[gameState.windCount%4]`
- **Impact:** In Singapore mahjong, prevailing wind stays the same for an entire round (min 4 games). Here it cycles E→S→W→N per single discard. Breaks scoring if ever implemented and shows wrong wind indicators.

### T2.7 Stale gameState overwrites other players' updates
- **File:** `game.js:58` — `gameState` read once at page load
- **File:** `game.js:625` — `onSnapshot` reads `currentGameState` but only for display; the click handler at line 428 and `updateGameState` at line 684 mutate the original stale `gameState`
- **Impact:** If player A and player B both mutate their stale copy and commit, the last writer silently overwrites the other's changes (turn counters, tile counts, etc.).

### T2.8 `eatTile` produces nested arrays in `playerChecked`
- **File:** `game.js:200` — `this.playerChecked.push(sortHand(checkedGroup))` pushes a sorted array
- **File:** `game.js:448-454` — `check.forEach(playerTile => playerTile.url)` expects flat tile objects
- **Impact:** After eating, `renderPlayerTiles` crashes on the nested array with `Cannot read property 'url' of undefined`.

### T2.9 Non-numbered tile eat check returns `undefined` instead of `false`
- **File:** `game.js:247-253` — when `discardedTile.index > 108` and player doesn't have 2 matching tiles, no `return false`
- **Impact:** Falsy `undefined` return. Not a crash but breaks truthiness checks upstream.

### T2.10 `skipTurn` function signature mismatch
- **File:** `game.js:290` — standalone `skipTurn(player)` takes a player argument
- **File:** `game.js:640` — `startTimer(10, timerDisplay, currentPlayer.skipTurn)` passes it as a bare callback (no args)
- **Impact:** When timer expires, `skipTurn` is called with no arguments → `player` is `undefined` → `player.playerHand` throws.
- **Note:** The `Player` class version at `game.js:82` also has `skipTurn` as a method. Ambiguity about which one the timer calls.

### T2.11 Tile click target detection is fragile
- **File:** `game.js:430` — `ev.target.parentElement.id` assumes the click lands on the `<img>` child
- **Impact:** If user clicks the `<div class="tile">` wrapper directly, `parentElement` is `#playerHand` (id="playerHand"), not a tile index. The `.find()` returns `undefined` and `discardTile(undefined)` crashes.

### T2.12 `sortHand` sorts indices as strings
- **File:** `sorthand.js:10` — `firstCard.index.toString().localeCompare(nextCard.index.toString())`
- **Impact:** Tile index 2 sorts after index 19 (string comparison). Affects any display that sorts by index.

### T2.13 Eat check fires for wrong opponents / wrong timing
- **File:** `game.js:576` — `gameState.currentPlayer != (currentPlayer.playerNumber+1)%4`
- **Intent:** Skip eat check when it's the next player's turn (they should draw instead)
- **Bug:** `(playerNumber+1)%4` is the player AFTER the current player, not a meaningful filter. The condition doesn't prevent eat-checking your own discards, and doesn't limit chow to the correct seating position.

### T2.14 Readiness listener has nested iteration bug
- **File:** `interstitial.js:58-73` — `snapshot.docs.forEach(doc => { snapshot.docChanges().forEach(...) })`
- **Impact:** For each doc in the snapshot, ALL doc changes are processed. If 3 players are ready, each change is processed 3 times (9 total `classList.toggle` calls instead of 3), causing visual flickering.

### T2.15 `playerGameInit` calls are not awaited
- **File:** `interstitial.js:434` — `playerGameInit(...)` without `await` for host
- **File:** `interstitial.js:437` — same for other players in the loop
- **Impact:** Four async `writeBatch.commit()` calls race against each other. The gameState is written at line 450 potentially before all player docs are committed. Players may arrive at the game page before their tile data exists in Firestore.

### T2.16 Deck exhaustion causes crash
- **File:** `game.js:140` — `deckInPlay.shift()` on empty array returns `undefined`
- **File:** `game.js:146` — `ANIMAL_TILES.includes(newTile.name)` where `newTile` is `undefined` → TypeError
- **Impact:** No guard for empty deck. Game crashes when tiles run out instead of declaring a draw.

### T2.17 Flower tile recursive draw can stack overflow
- **File:** `game.js:149` — `this.drawTile(1,'special')` recursively draws a replacement
- **Impact:** If the deck's tail is all flowers/animals (unlikely but possible with a bad shuffle), this recurses until the deck is empty, then hits T2.16 crash. Also, the `for` loop at line 137 continues after the recursive call, calling `updateGameState('drawtiles')` an extra time per recursion.

---

## T3 — Security

### T3.1 Firestore rules are completely open ✅ (phase 3)
- Rules now scope per collection. Hidden hand: `games/{roomId}/players/{uid}/tiles/playerHand` is readable only by the owner. Presence (`online/{uid}`, `status/{roomId}/players/{uid}`) and readiness (`lobby/{roomId}/readiness/{uid}`) writes are owner-only. Lobby/gameState/deck remain authed read+write — full ownership requires moving game logic into Cloud Functions (out of scope).

### T3.2 RTDB rules expired in 2021 ✅ (phase 3)
- Rules now scope by path. `online/{uid}` and `status/{roomId}/players/{uid}` writes locked to owner. Chat under `interstitial/{roomId}/chats` and `games/{roomId}/chats` is write-once for any authed user (existing messages cannot be edited or deleted). No expiry timestamp.

### T3.3 XSS via innerHTML in chat ✅ (earlier phase)
- All chat renderers in `game.js`, `lobby.js`, `interstitial.js` now use `textContent` + `createTextNode`.

### T3.4 XSS via innerHTML in lobby room cards ✅ (earlier phase)
- `lobby.js` `buildRoomCard` builds cards with `createElement` + `textContent` only.

### T3.5 Unescaped EJS template variables ✅ (earlier phase)
- `game.ejs:10` and `interstitial.ejs:120` use `<%- JSON.stringify(...) %>`. Server also rejects non-UUID room/game keys before render (`functions/index.js:38`).

### T3.6 Emulator connections hardcoded in production ✅ (earlier phase)
- Single gated init in `public/js/firebase-init.js` checks `localhost`/`127.0.0.1`.

### T3.7 Server uses client SDK for auth ✅ (earlier phase)
- `functions/index.js` uses `admin.auth().createUser(...)` (Admin SDK).

### T3.8 Registration logs password to console ✅ (earlier phase)
- Password no longer logged; only `error.code`/`error.message` written on failure.

### T3.9 No CSRF protection on POST routes — DEFERRED
- Adds a session-middleware dependency for a single `POST /register` route. Out of scope for phase 3.

### T3.10 Uncontrolled `photoURL` used as `img.src` — DEFERRED
- `photoURL` is set by the user themselves and now T3.1 prevents others from injecting into another user's profile doc. `img.src` does not execute `javascript:` in modern browsers; risk is limited to self-pointed tracking. Not a phase 3 blocker.

### T3.11 `serviceAccountKey.json` loaded at runtime — DEFERRED
- Replacing with `admin.initializeApp()` (ADC) requires testing the deploy path. Out of scope for phase 3.

---

## T4 — UI/UX Issues

### T4.1 No responsive design
- **File:** `game.css` — 6x6 CSS grid with `95vh` height, `body { overflow-y: hidden }`
- **Impact:** Unplayable on mobile/tablet. Content cut off on smaller screens. No breakpoints defined.

### T4.2 No loading states anywhere
- **Impact:** Auth checks, Firestore reads, and game init show blank white screen. Users have no feedback during the 3-5 second Firebase init.

### T4.3 Silent error handling
- **Files:** `functions/index.js:79-83,103-107` — `.catch()` logs to console but never sends error response to client
- **Files:** All client JS — Firestore/auth errors caught and logged, never shown to user
- **Impact:** Failed login, network errors, missing rooms all appear as "nothing happened."

### T4.4 Eat tile UX is broken and spammy
- **File:** `game.js:599,604` — `alertify.alert(...)` fires on EVERY opponent discard snapshot
- **Impact:** Even when nothing can be eaten, a "Nothing to eat" alert appears. When combinations exist, multiple overlapping modals appear. No way to dismiss or ignore.

### T4.5 Timer auto-discard is punishing
- **File:** `game.js:640`, `skipTurn:290-301` — 10-second timer discards a random tile
- **Impact:** A random tile from the player's hand is discarded. No warning animation. Players lose strategically important tiles. Timer should at minimum highlight which tile will be discarded, or extend on first timeout.

### T4.6 Player count display says "X / 3" (should be "X / 4")
- **File:** `lobby.js:230,252` — `${room.playerCount} / 3`
- **Impact:** Mahjong requires 4 players. Display suggests max is 3.

### T4.7 No room capacity check
- **File:** `lobby.js:202` — `joinRoom` adds player via `arrayUnion` with `increment(1)` but never checks if room is full
- **Impact:** 5th, 6th, etc. players can join a room. No guard against over-capacity.

### T4.8 Leave room doesn't clean up Firestore
- **File:** `interstitial.js:96-101` — "Leave Room" button navigates to `/lobby` but doesn't remove the player from the room document
- **Impact:** Ghost players remain in the room. The presence system's `onDisconnect` may eventually clean up, but the player array in the lobby document is never pruned on voluntary leave.

### T4.9 Dummy tiles are always 14 regardless of actual hand size
- **File:** `game.js:611-622` — renders exactly 14 green-backed tiles for each opponent
- **Impact:** Opponents always appear to have 14 tiles, even after discarding, eating, or drawing. No visual feedback of their hand size.

### T4.10 Video grid takes space but is non-functional
- **File:** `game.ejs:172-179` — 4 video containers rendered. WebRTC code is loaded but never connected.
- **Impact:** ~25% of screen is wasted on empty black video boxes.

### T4.11 Chat has no enter-key support
- **Files:** `game.js:761`, `interstitial.js:344`, `lobby.js` — send button only; no `keydown` listener for Enter
- **Impact:** Users must click "Send" button every time.

### T4.12 No visual distinction for current player's turn
- **File:** `game.js:635-636` — turn indicator sets `backgroundColor = 'tomato'` on a wind control div
- **Impact:** The wind control diamond is small and not prominent. No animation, no sound, no toast. Players easily miss that it's their turn.

### T4.13 Checked tiles (flowers) not visually grouped
- **File:** `game.js:448-455` — checked tiles rendered flat, same as hand tiles
- **Impact:** Flowers, animals, and eaten melds all look the same. In real mahjong, they should be visually separated.

### T4.14 No link between login and register pages
- **File:** `login.ejs` — no "Register" link. `register.ejs` — no "Login" link.
- **Impact:** Users must manually type `/register` in the URL bar.

### T4.15 `register.ejs` has malformed HTML
- **File:** `register.ejs` — duplicate `<head>`, `<style>`, `<body>` tags
- **Impact:** Browser attempts recovery but rendering is unpredictable.

### T4.16 `rules.html` references wrong asset paths
- **File:** `rules.html` — images use `./assets/MJh5.png` etc. (wikitiles naming convention)
- **Impact:** Since `rules.html` is in the project root but assets are in `public/assets/wikitiles/`, paths only resolve if served from the correct base. Also not linked from any page — unreachable.

---

## T5 — Architecture & Code Quality

### T5.1 Firebase initialized 4 times ✅ (phase 4)
- All four entry files (`login.js`, `lobby.js`, `interstitial.js`, `game.js`) import `auth/rtdb/fsdb` from `public/js/firebase-init.js`. Emulator gating is centralized there. Orphan `public/js/rooms/firebase/initFirebase.js` removed.

### T5.2 `startDBSync` copy-pasted 3 times (~80 lines each) ✅ (phase 2)
- Extracted to `public/js/presence.js` — `startDBSync(loggedInUser, statusBasePath)`. Used by lobby (`'online'`) and interstitial/game (`status/<roomId>/players`).

### T5.3 Duplicate `onValue('.info/connected')` listeners in each `startDBSync`
- **Impact:** Each call registers 2 listeners on the same path (one for RTDB, one for Firestore). These accumulate if `startDBSync` is called multiple times.

### T5.4 Player class is duplicated and diverges ✅ (phase 4)
- `Player.js` slimmed to only what `interstitial.js` actually uses: constructor + `drawTile(noOfTiles, deck, updateGameState)`. All broken methods that referenced undefined globals (`timer`, `commitPlayerHand`, `renderBoard`, `possibleMergeCombinations`) are deleted. The full game-time class remains inline in `game.js` where the closure-captured state lives.

### T5.5 No Firestore listener cleanup
- **Impact:** `onSnapshot` calls return unsubscribe functions that are never stored or called. When navigating between pages (lobby→interstitial→game), listeners from previous pages are abandoned. Since each page is a full navigation (not SPA), the JS context is destroyed, but in-flight callbacks could fire during teardown causing errors.

### T5.6 Duplicate lobby snapshot listeners
- **File:** `lobby.js:266-278` and `lobby.js:285-302` — two separate `onSnapshot` on the same `lobby` collection
- **Impact:** Second listener only logs to console — pure development leftover.

### T5.7 Functions `package.json` has client-side deps ✅ (phase 2)
- `functions/package.json` now contains only server deps (`cors`, `ejs`, `express`, `firebase-admin`, `firebase-functions`).

### T5.8 Root and functions `package.json` are near-identical ✅ (phase 2)
- Root `package.json` no longer carries client/build deps. Webpack was dropped; client JS is loaded directly via CDN ES module imports.

### T5.9 `http` package is a security placeholder ✅ (phase 2)
- Removed from both manifests during the package cleanup.

### T5.10 Missing dev dependencies ✅ (phase 2 — moot)
- Webpack tooling was removed entirely, so `@babel/preset-env`, `sass-loader`, `webpack-merge` are no longer referenced.

### T5.11 Dead code files ✅ (phase 4)
| File | Status |
|------|--------|
| `splitdeck.js` | Already removed. |
| `showHandCombinations.js` | Already removed. |
| `winningCombinations.js` | Already removed. |
| `diceroll.js` | Already removed. |
| `gameroom.js` | Removed (phase 4) — was already script-tag-disabled; T1.5 camera issue resolved. |
| `interactivity.mjs` | Removed (phase 4) — never loaded. |
| `videostreaming.mjs` | Removed (phase 4) — peer.js never loaded; non-functional. |
| `experimental.css` | Removed (phase 4) — never linked from any view. |
| `rooms/firebase/initFirebase.js` | Removed (phase 4) — superseded by `public/js/firebase-init.js`. |

### T5.12 `highlightTilesToBeMergedWith` adds CSS class with quotes in name
- **File:** `game.js:238` and `Player.js:33` — `tiles[idx].classList.add(\`'${type}'\`)`
- **Impact:** Adds classes like `'same'` (with literal quote characters). These don't match any CSS rule and are invalid class names.

### T5.13 No config template for cloning
- **Impact:** `config.js` and `functions/firebaseConfig.js` are gitignored. No `.env.example` or config template exists. Anyone cloning the repo cannot run it.

### T5.14 `rules.html` is an unlinked orphan
- **Impact:** Contains Singapore mahjong hand examples but is not referenced from any page. Uses `wikitiles/` PNG assets rather than `svgtiles/` SVGs used by the game.

---

## T6 — Missing Singapore Mahjong Features

### T6.1 No win detection
- **Status:** `winningCombinations.js` is a stub with broken code. Never imported.
- **Required:** Check for 4 melds + 1 eye after each draw or eat. Both self-draw (zi mo 自摸) and discard win (hu 胡).

### T6.2 No kong (gang 杠) handling
- **Impact:** 4-of-a-kind is a fundamental mechanic. Concealed kong (暗杠), exposed kong (明杠), and promoted kong (加杠) are all missing.

### T6.3 No chow seating restriction
- **Impact:** In Singapore rules, only the player to the RIGHT of the discarder can chow. Current code checks all opponents.

### T6.4 No scoring (tai/fan system)
- **Impact:** `chips` and `currentScore` fields exist but are never modified. Singapore mahjong uses a specific tai-based scoring table.

### T6.5 No game-end conditions
- No check for deck exhaustion (draw game / 流局)
- No round end / wind rotation between games
- No match end (typically 4 rounds = East, South, West, North)

### T6.6 No flower gang instant win (八仙过海)
- **File:** `winningCombinations.js:50-62` — stub exists but is broken and never called
- **Impact:** Collecting all 8 flower tiles should be an instant win.

### T6.7 No 十三幺 (Thirteen Wonders) detection
- **File:** `rules.html:348-369` — listed in the rules reference but not implemented

---

## T7 — Package Upgrades

### T7.1 Critical upgrades (security + EOL)

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| Node.js | 16 | 22 LTS | Node 16 EOL since Sep 2023. Required by Firebase Admin v12+. |
| `firebase` | 9.1.1 | 12.x | Major security patches. Client JS uses CDN imports pinned to 9.1.1 — update ALL import URLs. |
| `firebase-admin` | 9.12.0 | 13.x | v10 drops Node 10, v11 drops callbacks, v12 requires Node 18+. |
| `firebase-functions` | 3.15.7 | 7.x | v4+ uses 2nd-gen Cloud Functions with different export patterns. |
| `express` | 4.17.1 | 5.x | Security patches in 4.x line; Express 5 has breaking path-matching changes. |
| `ejs` | 3.1.6 | 5.x | Security fixes for prototype pollution. |
| `socket.io` | 4.2.0 | 4.8.x | Security fixes. |

### T7.2 Major version upgrades

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| `uuid` | 8.3.2 | 14.x | v9+ is ESM-only. |
| `peer` | 0.6.1 | 1.x | Major rewrite. Currently unused (WebRTC is non-functional). |
| `webpack` | 5.56.1 | 5.99.x | Minor bumps, compatible. |

### T7.3 Packages to remove

| Package | Reason |
|---------|--------|
| `http` | `0.0.1-security` placeholder — does nothing |
| `interactjs` | In `functions/package.json` but only used client-side (and even there, commented out) |
| `toastr` | In `functions/package.json` but only used client-side |
| `socket.io-client` | In `functions/package.json` but only used client-side |
| `socket.io` | Never used anywhere in the codebase |
| `peer` | WebRTC feature is non-functional / commented out |

### T7.4 Missing dev dependencies to add

| Package | Used by |
|---------|---------|
| `@babel/preset-env` | webpack config |
| `sass-loader` | webpack config (SCSS rule) |
| `webpack-merge` | webpack dev/prod configs |
| `css-loader` | webpack common config (already in use but not declared) |

### T7.5 CDN libraries to update

| Library | Current | Latest | File |
|---------|---------|--------|------|
| Materialize CSS | 1.0.0 (2018, unmaintained) | Consider replacing with active framework | All EJS templates |
| jQuery | 1.9.1 (2013) | Remove (only used for toastr dependency) | `lobby.ejs` |
| toastr.js | latest via CDN | Replace with Materialize toast or custom | `lobby.ejs`, `game.ejs` |
| alertify.js | 1.13.1 | Replace (used only in eat flow which is broken) | `game.ejs` |
| axios | latest via CDN | Remove (never used in any JS file) | `login.ejs` |

### T7.6 Recommended upgrade path
1. Upgrade Node to 20 or 22 LTS (update `functions/package.json` engines)
2. Fix webpack or remove it (game JS uses CDN imports, not bundles)
3. Update Firebase client SDK CDN URLs from 9.1.1 to latest 9.x (non-breaking)
4. Then plan migration to Firebase SDK 10+ (modular tree-shaking changes)
5. Update `firebase-admin` to 12+ and `firebase-functions` to 6+ together (requires Node 18+)
6. Replace Materialize CSS with a maintained framework
7. Remove jQuery, axios, alertify, toastr CDN dependencies

---

## T8 — CI/CD

### T8.1 GitHub Actions use outdated action versions
- `actions/checkout@v2` → should be `v4`
- `FirebaseExtended/action-hosting-deploy@v0` → should be latest

### T8.2 CI installs functions dependencies separately
- Workflow runs `pnpm install --frozen-lockfile` in root
- `functions/` has its own `package.json` and needs separate `pnpm --dir functions install --frozen-lockfile`

### T8.3 No test step in CI
- `pnpm test` is a no-op (`echo "Error: no test specified"`)
- No linting step either

---

## Suggested Fix Order

**Phase 1 — Make it run:**
T1.1, T1.2, T1.3, T1.4, T1.5, T3.6 (emulator gating)

**Phase 2 — Make it correct:**
T2.1, T2.2, T2.3, T2.4, T2.5, T2.8, T2.10, T2.11, T2.12, T2.16

**Phase 3 — Security:**
T3.1, T3.2, T3.3, T3.4, T3.5, T3.7, T3.8

**Phase 4 — Code quality:** ✅
T5.1, T5.2, T5.4, T5.7, T5.8, T5.9, T5.10, T5.11

**Phase 5 — Gameplay completeness:**
T6.1, T6.2, T6.3, T6.4, T6.5

**Phase 6 — Package upgrades:**
T7.1, T7.2, T7.3, T7.4, T7.5

**Phase 7 — UI/UX polish:**
T4.1 through T4.16
