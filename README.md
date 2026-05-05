# Crypt of the D20

> *A solitaire dungeon for one weary soul.*

A Flash-era 2D card dungeon crawler built in vanilla HTML, CSS, and JavaScript — no frameworks, no build step, no dependencies. Open `index.html` in any modern browser to play.

---

## Overview

You descend into a stone crypt armed with nothing but your wits and a deck of forty-four enchanted cards. Each room is laid out as four cards. Resolve them, survive every chamber, exhaust the deck — and the Crypt is yours.

Mechanically the game is in the lineage of *Donsol* / *Scoundrel* (44-card solitaire dungeons), polished into a complete Flash-style package with menus, tutorial, difficulty modes, animations, procedural sound, and a dark-fantasy crypt aesthetic.

---

## How to Play

### Setup

The deck is a standard 52-card pack with the **red royals and red Aces removed**:

| Suit | Cards in deck | Total |
|---|---|---|
| ♠ Spades | 2 → A (full) | 13 |
| ♣ Clubs | 2 → A (full) | 13 |
| ♥ Hearts | 2 → 10 (no face cards, no Ace) | 9 |
| ♦ Diamonds | 2 → 10 (no face cards, no Ace) | 9 |
| **Total** | | **44** |

You start with **20 vitality** (HP), shown on a great D20 die. Four cards are dealt face-up — that is the first room.

### Cards

| Suit | Means | Value |
|---|---|---|
| ♠ Spades · ♣ Clubs | **Monsters** — fight them | 2–10 face value · J=11 · Q=12 · K=13 · A=14 |
| ♥ Hearts | **Potions** — heal HP equal to value | 2–10 |
| ♦ Diamonds | **Weapons** — equip to reduce damage | 2–10 |

### Combat

- **Bare-handed** → you take damage equal to the monster's value.
- **With a weapon equipped** → damage taken = `max(0, monster − weapon)`.

> *Example: equipped 4♦ vs. 10♣ → take 6 damage.*

### The Weapon's Curse

A blade dulls upon iron flesh. After your weapon strikes a monster, the **next** monster you fight with that same weapon must have a **strictly lower** value than the previous one.

- Strike a 10, then no foe of 10 or higher may face that blade again.
- You may always set the weapon aside and meet a foe **bare-handed** (Shift-click to force).
- You may always **replace** your weapon by equipping a new diamond — the curse resets.

The HUD shows the equipped weapon as a card in front, with the most recently slain monster's card peeking out from behind. A small `< N` marker between them tells you the next maximum.

### Potions

Drinking a heart restores HP equal to its value. Maximum vitality is 20 — overflow is wasted.

### Rooms

After three of the four cards in a room have been resolved, the lone surviving card stays put and three new cards are drawn to refill the room to four. This is the dungeon advancing.

### Fleeing

You may flee a room. The four cards return to the bottom of the deck and four new cards rise to greet you. Flees are limited by difficulty.

### Win / Lose

- **Win** — exhaust the deck and clear every room with HP > 0.
- **Lose** — HP ≤ 0.

---

## Controls

### Mouse

| Action | How |
|---|---|
| Resolve a card | Click it |
| Fight bare-handed (overriding equipped weapon) | **Shift+click** the monster |
| Hover for predicted outcome | Card tooltip appears |

### Keyboard

| Key | Action |
|---|---|
| `1` `2` `3` `4` | Resolve the card in that slot |
| `F` | Flee the current room |
| `U` | Undo last action (once per room) |
| `D` | Toggle peek-next strip (Easy mode only) |
| `Esc` | Pause / resume |
| `Shift` (held while clicking a monster) | Fight bare-handed |

---

## Difficulty

| Mode | HP | Flees | Undo | Peek next | Score multiplier |
|---|---|---|---|---|---|
| **Apprentice** (Easy) | 20 | 3 | ✓ | ✓ | ×1.0 |
| **Adventurer** (Normal) | 20 | 1 | ✓ | — | ×1.5 |
| **Vanquisher** (Hard) | 20 | 0 | ✓ | — | ×2.5 |
| **Damned** (Nightmare) | 18 | 0 | — | — | ×4.0 |

Best score per difficulty is saved in `localStorage`.

---

## Bestiary

Every monster value gets its own SVG illustration — values rise visibly in menace.

| Value | Creature |
|---|---|
| 2 | Rat |
| 3 | Bat |
| 4 | Goblin |
| 5 | Kobold |
| 6 | Skeleton Warrior |
| 7 | Ghoul |
| 8 | Orc |
| 9 | Troll |
| 10 | Wyvern |
| J | Wraith |
| Q | Hag / Witch |
| K | Demon Lord |
| A | Ancient Dragon |

## Armoury

Diamonds tier from a humble dagger to a great two-handed axe.

| Value | Weapon |
|---|---|
| 2 | Dagger |
| 3 | Short Sword |
| 4 | Hand Axe |
| 5 | Mace |
| 6 | Long Sword |
| 7 | War Hammer |
| 8 | Battle Axe |
| 9 | Greatsword |
| 10 | Great Axe |

---

## Project Structure

```
Habibs_game/
├── index.html      DOM for menu, difficulty, tutorial, options, credits, game, overlays
├── styles.css      All visuals — typography, dungeon decor, animations, screens
├── game.js         Game logic, deck, audio engine, monster/weapon SVG libraries, save state
└── README.md       This file (system of record + changelog)
```

No build, no dependencies, no server required.

### How to run

Open `index.html` in any modern browser. That is all.

```powershell
Start-Process "C:\Users\khalil.lari\Desktop\Habibs_game\index.html"
```

### Tech notes

- **No framework.** Pure vanilla HTML / CSS / JS.
- **No images.** All artwork is inline SVG drawn from primitives (paths, gradients, ellipses).
- **No audio files.** Sound effects and ambient drone are synthesised at runtime via the Web Audio API (oscillators + filtered noise).
- **No external state.** Save data lives in `localStorage` under the key `crypt_d20_save_v1`.
- **Typography** — `Cinzel Decorative` (display), `Cinzel` (headings), `IM Fell English` / `IM Fell DW Pica SC` (body) loaded from Google Fonts.

### Editing artwork

Monster and weapon illustrations live in `game.js` as the `MONSTER_SVG[value]` and `WEAPON_SVG[value]` dictionaries. To swap or add a creature, edit the corresponding entry — the canvas is `viewBox="0 0 80 100"`.

The dungeon back-wall door, cobwebs, and stone-block pattern live as inline SVG inside `index.html` and `styles.css`.

---

## §Changelog

Newest first. Every code change should add an entry here in the same edit round.

### 2026-05-05 — v0.4.5 · Stage particle decor + mobile pass

Fifth iteration — feedback was "wall *recolors* but the *scene* doesn't change", plus a request for mobile readiness ahead of GitHub upload.

**Per-stage particle decor (each stage now has visible character beyond hue)**
- New element family `.stage-decor` inside `.atmosphere`, with 4 sub-layers: `.decor-mist` (Catacombs), `.decor-motes` (Reliquary), `.decor-blood` (Sanctum), `.decor-ash` (Throne). Antechamber stays bare (default).
- Visibility driven by `body[data-stage="..."]` attribute — set live by `updateAtmosphere()` via a new `_stageKeyFor(progress)` helper. Crossfades between stages with a 1.4s opacity transition.
- Particle effects:
  - **Catacombs** — pale horizontal mist bands drifting laterally (18s cycle).
  - **Reliquary** — golden motes rising upward (22s cycle, 3 layered radial-gradient sizes).
  - **Sanctum** — slow blood drips falling from above (7s + 9s desynced layers).
  - **Throne** — ember/ash particles rising (14s cycle, 3 layered gradient sizes).
- Each layer uses `mix-blend-mode: screen` (or `normal` for blood) for proper additive feel against the dimmed wall.

**Mobile responsiveness — three breakpoints + touch handling**
- **≤980px (tablet)** — slimmer player (170px), tighter HUD, narrower room-row.
- **≤720px (mobile portrait)** — HP panel stacks horizontally below arena (was already there); player drops `-100px` HP-panel offset since panel is no longer right-of-arena; player 150px; cutscene transforms recentered.
- **≤520px (phone)** — Cards reflow to **2x2 grid** for big tap targets. Player 130px. Touch-friendly `min-height: 44px` on all buttons. Difficulty grid collapses to 1 column. Torches + door scaled down. Stage banner / action log / peek strip all sized down.
- Landscape phone (≤920px wide + ≤480px tall + landscape) — desktop-ish layout retained but smaller.
- `@media (hover: none)` — hover tooltips and hover-tilt animations disabled on touchscreens (where there's no hover gesture).
- Existing `<meta name="viewport" content="width=device-width, initial-scale=1.0">` already present, so phones get correct viewport scaling.

**Note on the file:// security warning**
- *"Unsafe attempt to load URL... 'file:' URLs are treated as unique security origins"* — this is Chrome's policy when opening `index.html` directly via `file://` protocol. It is harmless; gameplay is unaffected. Already documented in the v0.3 changelog. To eliminate, serve via a local server (`python -m http.server` or `npx serve`).

### 2026-05-05 — v0.4.4 · doEquip refill bug + dramatic atmosphere

Fourth iteration. Three concrete fixes from continued user testing.

**Bug — doEquip's `onEnd` was still 400ms (replace_all missed it)**
- v0.4.2's `replace_all` for `setTimeout(() => finalizeAction(), 400) → 600` matched the doFight and doDrink cases, but doEquip has an extra `renderWeapon()` line between `consumeCard()` and `setTimeout()`, so the surrounding context didn't match. doEquip kept the broken 400ms.
- Effect: when the last card in a room was a weapon (diamond), equipping it triggered the same stale-state read — `finalizeAction` saw the equipped slot still occupied, refill never fired, user was forced to clear all 4. Reproduced the exact bug from v0.4.1.
- Fix: explicit edit on doEquip's onEnd to bump 400 → 600. Verified all three `do*` functions now use 600ms.

**Player less wide**
- `.player-layer` 240×240 → 200×200. Smaller footprint at the bottom-center; cards above and surrounding atmosphere read more clearly.

**Action log moved out of player's way**
- Was at `bottom: 14px` center — directly under the new player position, hidden by the 200px wide sprite.
- Moved to `bottom: 80px left: 22px` (above the peek strip in the bottom-left corner). `flex-direction: column-reverse` so newest entries appear on top of the stack.
- max-width capped at 38% so long lines don't bleed into the play area.

**Atmosphere — hue-rotate filter on the brick wall (now unmistakable)**
- Previous overlay used `mix-blend-mode: multiply` with moderate alphas — way too subtle, especially at low progress (under 25%) where the lerped tint never exceeded ~0.15 effective opacity. User reported the wall "still looked the same".
- New approach: a `filter: hue-rotate(...) saturate(...) brightness(...)` applied directly to `.bg-stone`. Each anchor specifies `bgHue / bgSat / bgBri`:
  - **Antechamber** (warm brown brick) — hue 0°, sat 1.0, bri 1.0 (default)
  - **Catacombs** — hue 130°, sat 0.7, bri 0.85 (greenish, desaturated, dimmer)
  - **Reliquary** — hue 220°, sat 1.1, bri 0.85 (violet)
  - **Sanctum** — hue 340°, sat 1.5, bri 0.80 (highly-saturated crimson)
  - **Throne** — hue 290°, sat 1.7, bri 0.70 (deep dim red-violet)
- Lerped continuously by `setAtmosphere()` (writes `--atm-bg-hue/sat/bri` CSS vars). 1.5s ease-out transition.
- `.atmosphere-tint` overlay also dropped its `mix-blend-mode: multiply` and is now a plain alpha overlay — additional color cast on top of the hue-shift.
- Combined effect: walls visibly shift from warm brown → green-blue → violet → crimson → red-black across a run.

### 2026-05-05 — v0.4.3 · Refill race fix + weapon strap-on

Third iteration based on user testing.

**Bug — refill rule still broken (race condition this time)**
- v0.4.2 fixed the stale-state read in `finalizeAction`, but a race remained: `finalizeAction` set `state.inputLocked = false` BEFORE scheduling `refillRoom` 320ms later. During that 320ms gap, the user could click the surviving card.
- The pending `refillRoom` then fired mid-cutscene, filling 3 slots — but the survivor's slot was ALSO consumed by the in-flight new action. Result: user ended up with 3 new cards instead of "1 survivor + 3 new = 4". They were effectively forced to clear all 4 each room.
- Fix: when scheduling a refill, immediately re-lock input (`state.inputLocked = true`). `refillRoom` unlocks only after all card-deal animations complete. The 320ms gap is now untouchable.

**Layout — peek strip moved out of player's way**
- The "NEXT" strip (Easy-mode peek) was at `bottom: 50px` center, directly under the new player position. Moved to `bottom: 22px left: 22px` (bottom-left corner of arena).
- Z-index raised 4 → 8 so it floats over the dungeon floor decoration.

**Player — equipped weapon visible at all times**
- New `<div class="player-weapon">` mounted on the player layer. Persistent (the cutscene's animated `weapon-trail` is a separate transient element).
- Positioned at upper-right of player layer, rotated `-32deg`, ~36% size. Gives the impression of the weapon strapped diagonally to the back, hilt rising over the right shoulder.
- New `Player.renderEquippedWeapon()` exposed; called from `renderWeapon` whenever `state.weapon` changes (or clears). Hidden via `.empty` class when unarmed.
- Custom keyframe `player-weapon-bob` preserves the diagonal rotation through the idle bob (the generic `player-bob` keyframe would have erased the rotate transform).

**Player sprite — wider legs + darker boots**
- `'b'` palette entry darkened: `#2a1810` → `#1a0a04` (high-contrast near-black against the warm-tan cloak).
- Boot rows widened across all 8 animations (idle, dashIn, attackPierce/Slash/Smash/Bare, drink, equipPickup, hurt): `'....bbb..bbb....'` → `'...bbbb..bbbb...'` (4-wide legs); soles `'....bb....bb....'` → `'..bbbbb..bbbbb..'` (5-wide).
- New palette entry `'y'` = `#c9a857` (gold) reserved for future belt/buckle accents.

**Note on full sprite redesign (24×24 with face/nose/profile)**
- Held off on a full 24×24 rebuild this round — that's an 8-animation × 2-4-frame redraw and warrants its own iteration. The current 16×16 pass focuses on what was bugging the user most: visible boots, weapon on back, and the bug fixes.

### 2026-05-05 — v0.4.2a · Hotfix: setAtmosphere ReferenceError

`setAtmosphere` was missing its `a`/`b`/`span`/`localT` const declarations after a botched refactor edit — node --check passed (syntax was valid) but the function threw `ReferenceError: a is not defined` at runtime when `newGame` called it, breaking the Descend button entirely. Restored the four declarations between the segment-finder loop and the CSS-variable writes.

### 2026-05-05 — v0.4.2 · Pokemon flip + refill bug fix

Second iteration based on user testing. Three real bugs found, three layout shifts.

**Bug — refill rule was broken (3-of-4 → carry-survivor failed)**
- `onEnd` callback in doFight/doDrink/doEquip scheduled `finalizeAction` at +400ms, but `consumeCard` doesn't null `state.room[slotIndex]` until +500ms (its own internal animation timer). So `finalizeAction`'s "remaining card count" was always reading STALE state — the just-cleared slot still appeared occupied.
- Effect: refill never triggered at the correct moment. The game appeared to force you to clear all 4 cards before refilling, breaking the original rule.
- Fix: bumped 400 → 600ms in all 3 `onEnd` callbacks so `finalizeAction` runs AFTER `consumeCard`'s state-null timer completes. (The original v0.3 used 600ms after `consumeCard`; v0.4 accidentally compressed it.)

**Layout — Pokemon flip (cards UP, player DOWN)**
- Previous v0.4.1 placed the player at `bottom: 38%` directly above the cards at `bottom: 6%`. With a 200px sprite + 280px card-row height, vertical ranges overlapped (player y=38-67%, cards y=6-46%) — player ended up sitting on top of cards visually.
- Now true Pokemon-style: `.room-row` at `bottom: 42%` (foes in upper-mid), `.player-layer` at `bottom: 4%` (over-shoulder, prominent). Player size bumped 200 → 240px. Vertical ranges no longer overlap.
- Player z-index 7 stays — above non-target cards, below cutscene-target card (z-50). Drop-shadow heavier for ground separation.

**Atmosphere — visible from the very start**
- Previous: anchors at uniform 0/25/50/75/100% progress with Antechamber as zero-tint default. At 9% progress (deck=40, 4 cards in) the visible tint was barely 0.15 opacity — invisible.
- Now: anchors front-loaded — `at: 0.00 / 0.18 / 0.42 / 0.66 / 0.88`. Catacombs reaches full effect at 18% progress instead of 25%.
- Antechamber given a subtle warm ambient overlay `rgba(90,60,30,0.18)` so the start has its own identity instead of looking like the un-themed default.
- `setAtmosphere` rewritten to use each anchor's explicit `at` field (non-linear distribution) instead of assuming uniform spacing.
- `STAGE_NAMES` thresholds re-synced with new anchor positions (banner now updates at 18% / 42% / 66% / 88%).

**Cutscene — diagonal clash convergence**
- With cards now ABOVE player, the cutscene direction reversed: target card descends `translateY(+110px)` toward the rising player; player rises `translateY(-70px) scale(1.18)` to meet it. They converge in the middle of the screen.
- Per-slot horizontal convergence — outer slots translate inward toward center: `nth-child(1) +140px`, `nth-child(2) +46px`, `nth-child(3) -46px`, `nth-child(4) -140px`. All four card positions clash with the player at center, regardless of which slot was clicked.
- Target scale tuned 1.85 → 1.7 to keep the card readable at the new size.

**Player face — eye-glints inside hood**
- All 4 idle frames updated: row 5 now contains two bone-pale (`w`) eye-glints peering out from inside the hood shadow. Frame 3 has a single ember-glint (`e`) for a subtle breathing-rhythm blink.
- Hooded silhouette + visible eyes is the back-view equivalent of a face — gives the figure presence without breaking the "weary soul" cloaked-wanderer fiction.

**Files**
- `game.js` 2612 → ~2620 lines (atmosphere refactor, sprite eye-glints, refill timing fix).
- `styles.css` 2416 → ~2425 lines (Pokemon-flip positions, diagonal cutscene convergence).
- No dependency changes.

### 2026-05-05 — v0.4.1 · Visibility iteration

Hot-fixes from v0.4 user-testing — the player layer was rendering correctly but was hidden behind cards and blended into the background; the atmosphere shifts were too subtle to read.

**Layout — player visible, cards below**
- `.player-layer` moved from `bottom: 11%` to `bottom: 38%` (vertical center of arena, above the cards).
- `.player-layer` z-index raised from `3` to `7` so the player renders **in front of** cards (which are at z-index `5`). Cutscene-target cards still pop in front via z-index `50`.
- Player sprite size bumped from 132×132 to 200×200 — much more prominent.
- Added drop-shadow on the player layer for depth separation against the floor.
- `.room-row` switched from in-flow flex item (vertically centered) to absolute positioning at `bottom: 6%` with the same horizontal offset as the back-door so it lines up with the play area.
- `.dungeon-floor` height raised from `18%` to `32%` so more of the floor is visible — closer to a top-down dungeon feel.

**Player palette — warm tan, not near-black**
- Cloak highlight `#3a2c20` → `#a06030` (warm tan), mid `#2a1d18` → `#704a26` (warm brown), shadow `#15090a` → `#3a1f10` (burnt umber). Eye-glint accent `#c9a857` → `#ff8030` (vivid orange — visible in attack/hurt frames).
- Result: the player reads instantly against the dark dungeon stone instead of disappearing into it.

**Atmosphere — much more dramatic**
- Overlay opacities roughly doubled per stage: Catacombs `0.18 → 0.42`, Reliquary `0.20 → 0.50`, Sanctum `0.24 → 0.55`, Throne `0.32 → 0.62`. Glow and vignette opacities also bumped (`0.40 → 0.50-0.62`).
- Vignette base color shifts more dramatically into stage colors.
- New **Stage banner** at top-center of the arena (`<div class="stage-banner">`), always visible, updates live with the current stage name (`Antechamber → Catacombs → Reliquary → Sanctum → Throne`).

**Cutscene staging — unmistakable focus**
- Target card scale `1.55× → 1.85×`, lift `-22px → -90px`, brightness `1.0 → 1.08`. Drop-shadow heavier.
- Dimmed cards opacity `0.22 → 0.10`, blur `2px → 3px`.
- Player approach during cutscene reversed direction: was sliding UP toward distant cards (when cards were at vertical center), now slides DOWN with `scale(1.18)` to meet the card that just lifted toward it. Z-index raised to `12` during the cutscene.

### 2026-05-05 — v0.4 · Top-down + Pokemon battle pass

The card row is preserved as the play surface, but the surrounding scene gets a Pokemon-style over-the-shoulder framing, a continuous Zelda-style descent atmosphere, and a six-archetype encounter cutscene with weapon trails, hit-spark VFX, and screen-shake on heavy strikes. All eight player animations and every monster/weapon/potion sprite are now multi-frame or motion-class animated — nothing visible is static.

**Architecture (no gameplay change)**
- All existing rules, badges, weapon-curse, undo/flee/peek, score/save remain identical.
- Three new visual layers stacked over `.dungeon-arena`: **player layer** (cloaked wanderer, back-facing), **atmosphere tint layer** (interpolates per deck-position), **encounter layer** (cutscene overlay).
- State mutations (HP, weapon, lastMonster) now happen at the cutscene's **impact frame** rather than at click time — so a mid-cutscene skip resolves to the same end-state as the un-skipped cutscene.

**Player sprite — cloaked wanderer, back-facing 16×16**
- New `pixelSpriteSheet(frames, palette, sizePct, opts)` engine — multi-frame sprites laid horizontally inside one SVG, animated via CSS `steps(N)` timing. One `@keyframes sheet-cycle` handles all frame counts.
- `PLAYER_PX` library — 8 hand-drawn animations: `idle` (4-frame loop, cloak sway), `dashIn`, `attackPierce`, `attackSlash`, `attackSmash`, `attackBare`, `drink`, `equipPickup`, `hurt`.
- Weapons are NOT baked into player frames — equipped weapon sprite composites separately as a `.weapon-trail` child element with archetype-specific motion paths (forward thrust / arc swing / overhead chop / pickup-glint).
- Player layer at `bottom: 11%` of the arena, mirrored offset to align with the play area (compensating for the HP-panel padding). Idle bob handled by `.player-bob` inner element so it doesn't conflict with the layer's static position transform.
- During cutscene, the layer slides upward (`translateY(-92px)`) to approach the action.

**Atmosphere progression — continuous Zelda-style descent**
- Six new CSS variables on `:root` interpolate between five anchor stages based on `progress = 1 - deck.length / 44`: **Antechamber** → **Catacombs** → **Reliquary** → **Sanctum** → **Throne**.
- Tinted surfaces: torch flame (warm gold → blue → violet → crimson → white-hot), torch glow, vignette (deepens with crimson tint), and a new full-screen `.atmosphere-tint` overlay using `mix-blend-mode: multiply` to retint the existing brick walls without rebuilding the SVG.
- 1.2s ease-out transitions on all variables — descent is felt, not announced.
- Four atmospheric milestone hint flashes fire once each at progress 0.25 / 0.50 / 0.75 / 0.90: *"the air grows colder"*, *"you hear distant chanting"*, *"the stones smell of blood"*, *"something on the throne stirs"*. Reuses the existing `#hint` banner.
- Door, cobwebs, and D20 retain their own colors through all stages so the player has visual anchors.

**Battle cutscene — six choreographies, ~1.1-1.7s each**
| Action | Total | Hit at | Player anim | VFX |
|---|---|---|---|---|
| **Pierce** (dagger 2, short sword 3) | 1400ms | 700ms | dash-in → attack-pierce | white spark + thin recoil |
| **Slash** (hand axe 4, long sword 6, greatsword 9) | 1500ms | 720ms | dash-in → attack-slash | gold arc + radial spikes |
| **Smash** (mace 5, war hammer 7, battle axe 8, great axe 10) | 1700ms | 840ms | dash-in → attack-smash | crimson shockwave + screen-shake |
| **Bare-hand** (Shift+click or no weapon) | 1300ms | 580ms | dash-in → attack-bare ×2 cycles | small white sparks |
| **Drink** (potion) | 1300ms | 700ms | dash-in → drink | green heal pulse on D20 (existing) |
| **Equip** (weapon) | 1100ms | 600ms | dash-in → equip-pickup | gold equip-flash + weapon glint |

- Camera staging (CSS-only, no real 3D): target card scales to 1.55× and lifts forward; other 3 cards drop to opacity 0.22 with 2px blur. Player layer translates upward toward the action.
- Weapon trails composited at the player's hand: forward thrust (pierce), arc swing (slash), overhead chop (smash), pickup-glint (equip).
- Hit-spark VFX with archetype-specific glyphs (`↟` pierce, `✦` slash, `✸` smash, `✱` bare) and color-tuned radial gradients.
- Screen-shake on smash impacts via `.dungeon-arena.arena-shake` keyframe, ~360ms.
- `Player.play('hurt')` overlays 200ms after impact whenever damage > 0.

**Cutscene gating + skip**
- During cutscene: card input + keyboard 1-4 + F (flee) + U (undo) all blocked via `state.inputLocked` and an early-return guard in the keydown handler.
- **Esc** during cutscene → `Cutscene.skip()` (overrides the normal pause behavior).
- **Click anywhere** during cutscene → also skips. Listener registered in capture phase 220ms after cutscene start (so the click that initiated it doesn't immediately skip), removed on finish.
- Skip preserves outcome integrity: if impact hasn't fired yet, it fires synchronously before cleanup. `onEnd` runs immediately after.
- **Animations toggle off** (`Options → Animations`) bypasses the cutscene entirely. Legacy card-shake (attacks) and flash-card (drink/equip) effects are preserved on this path; impact callback fires at 240ms, end at 820ms.
- Undo snapshot is captured BEFORE the cutscene starts, so undoing post-action restores the pre-click state regardless of whether the cutscene was skipped.

**Sprite micro-animations — every existing sprite is now alive**
- Five new motion classes layered on top of the existing `sprite-bob`, assigned per card kind/value:
  - **`anim-quick`** (rat 2, bat 3, goblin 4, kobold 5, ghoul 7) — 0.9s faster bob with X-scale flutter (reads as wing-flap on bat, twitch on others)
  - **`anim-heavy`** (skeleton 6, orc 8, troll 9, wyvern 10, demon lord K, dragon A) — 2.2s slow weighty sway with ±1.5° rotation drift
  - **`anim-eerie`** (wraith J, hag Q) — hovering with opacity flicker (0.85↔1.0)
  - **`anim-glint`** (all weapons) — 1.6s brightness/saturation pulse suggesting metal-glint sweep
  - **`anim-bubble`** (all potions) — slosh + skew + brightness pulse suggesting liquid wobble
- `pixelSpriteSvg` extended to accept an optional `motion` class via opts; HUD usages (equipped-weapon card, last-slain peek) pass `staticPose: true` to avoid jitter.

**Files touched**
- `index.html` — atmosphere-tint div, player-layer/bob divs (+10 lines).
- `styles.css` — atmosphere variables, sprite-sheet engine + player layer + 5 micro-animation keyframes + 4 cutscene staging keyframes + hit-spark VFX + screen-shake (+306 lines).
- `game.js` — atmosphere progression engine, sprite-sheet renderer, player module + 8 animation sprites + Cutscene orchestrator with 6 choreographies, do* refactored to flow through Cutscene (+669 lines).
- `README.md` — this entry.

**Tech notes**
- Vanilla HTML/CSS/JS unchanged. No new dependencies, no build step, no image files. Player sprites + weapon trails + hit-spark all rendered as inline SVG/CSS.
- File totals: `game.js` 2.6k lines · `styles.css` 2.4k · `index.html` 492.
- Cutscene timings can be tuned by editing `CUTSCENE_TIMINGS` table near the top of `game.js`.
- Atmosphere stage colors live in `ATMOSPHERE_ANCHORS` array; milestone hints in `ATMOSPHERE_MILESTONES`.

### 2026-05-02 — v0.3 · 8-bit pixel-art pass

**Pixel-art sprite engine**
- New `pixelSpriteSvg(grid, palette, sizePct)` helper renders a 16×16 pixel grid into compact, run-length-merged SVG with `shape-rendering="crispEdges"` and `image-rendering: pixelated` for sharp NES-style edges.
- Removed the old vector SVG dictionaries (`MONSTER_SVG`, `WEAPON_SVG`, vector `potionSvg`); replaced with `MONSTER_PX`, `WEAPON_PX`, `POTION_PX` pixel grids.
- Each sprite is a hand-drawn 16×16 grid with a per-sprite color palette (~4–8 colors).

**Visual size now scales with card value**
- Monsters: 38% (rat) → 100% (Ancient Dragon) of the card-illustration area.
- Weapons: 36% (dagger) → 96% (great axe).
- Potions: 38% (tiny vial) → 92% (eldritch flask).
- Size is encoded per-sprite as `sz` and applied via inline `style="width:N%;height:N%"`.

**Sprite library — every value has its own art** (overhauled from previous vector pass)
- Monsters 2–A: rat · bat · goblin · kobold · skeleton warrior · ghoul · orc · troll · wyvern · wraith · hag · demon lord · ancient dragon.
- Weapons 2–10: dagger · short sword · hand axe · mace · long sword · war hammer · battle axe · greatsword · great axe.
- Potions 2–10: tiny vial · round flask · flat flask · conical flask · standard flask · enchanted flask (with sparkles) · large bottle · giant flask · eldritch flask (largest, bubbling).

**"Sprite animation" feel**
- Every pixel-art sprite has a CSS `sprite-bob` idle animation — gentle vertical bob, 1.4s loop. Neighbour cards desync (odd slots offset by 0.3s) so the room feels alive.
- On hover, sprites tilt with a `sprite-alert` micro-animation.
- The mini-sprite inside the equipped-weapon HUD card stays still (avoids HUD jitter).

**Outcome-prediction badge on every card**
- New always-visible badge in the top-right of each card showing exactly what happens if you resolve it now.
- Monsters: `⚔ −N` damage taken. Color-coded by severity:
  - `safe` (0 dmg) — green
  - `low` (1–3) — pale yellow
  - `mid` (4–6) — ember orange
  - `high` (7–10) — blood red
  - `lethal` (11+) — pulsing pink glow
- Potions: `✚ +N` HP restored (capped at max vitality).
- Weapons: `⛨ −N` damage reduction value.
- Badges live outside `.card-face` so they aren't clipped by its `overflow: hidden`. They live-update via `refreshBadges()` after every action so the predicted damage reflects the currently equipped weapon and constraint.

**AudioContext fix**
- Browsers refuse to start an AudioContext outside a user gesture. Init-time calls (`tutNav(0)`, `Audio.setMusic(...)`) used to trigger the warning *AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page.*
- Audio module now defers context creation until `Audio.unlock()` is called from the first `pointerdown` or `keydown` event.
- `Audio.setMusic(true)` before unlock is remembered (`pendingMusicStart`) and applied when the user first interacts.

**Cleanup**
- Removed ~460 lines of dead legacy vector-SVG dictionaries.
- File totals: `game.js` 1.9k lines · `styles.css` 2.1k · `index.html` 482.

**Known browser warning (not a bug)**
- Opening `index.html` directly via `file://` produces *"Unsafe attempt to load URL ... 'file:' URLs are treated as unique security origins."* in Chrome. This is browser policy when running locally without a server and does not affect gameplay. Use a tiny local server (e.g., `python -m http.server`) if it bothers you.

### 2026-05-02 — v0.2 · Graphics overhaul

**Dungeon ambience**
- Replaced abstract gradient background with a tileable stone-block brick pattern (offset rows, mortar shadows, pitting).
- Added moss patches in the corners and edges, drip / damp stains running from the ceiling, deep shadow corners.
- Added a stone floor strip at the base of the chamber with its own brick tiling.
- Built an iron-banded wooden door at the back wall (planked, riveted, ring handle, carved rune at the keystone).
- Added cobwebs to the upper corners.
- Reseated the torches in iron sconces with handles below the flame.

**Tiered monster illustrations** — every value 2-A now has its own creature SVG:
rat → bat → goblin → kobold → skeleton warrior → ghoul → orc → troll → wyvern → wraith (J) → hag (Q) → demon lord (K) → ancient dragon (A).

**Tiered weapon illustrations** — every diamond 2-10 now has its own armament SVG:
dagger → short sword → hand axe → mace → long sword → war hammer → battle axe → greatsword → great axe.

**Equipped-weapon HUD**
- Replaced the "Last Slain" text with a stacked-cards display.
- Equipped weapon shows as a full card; the most recently slain monster's actual card peeks out from behind, top-left, rotated −9°.
- A small `< N` marker floats between the cards to show the weapon constraint at a glance.
- Slain-card slides in from below-left with an animation when a new monster joins the stack.
- Weapon-card pops in with a scale animation when newly equipped.
- Animations are change-detected by signature, so they only fire when the weapon or last-slain actually changes — not on every HUD refresh.

### 2026-05-02 — v0.1 · Initial build

Full game scaffolded from scratch:

- 44-card deck (red royals + red Aces removed), shuffle, deal, refill mechanics.
- Combat resolution with weapon-curse constraint.
- Potion healing capped at 20.
- Flee mechanic returning the room to the bottom of the deck.
- Per-room undo (1 use per room, refreshed on refill).
- Win on deck + room exhaustion; lose on HP ≤ 0.

UI:
- Main menu with title block and decorative D20 emblem.
- Difficulty selection (Apprentice / Adventurer / Vanquisher / Damned).
- Six-page interactive tutorial.
- Options screen (music / SFX / animations / tooltips toggles).
- Credits screen.
- In-game HUD: deck count, equipped weapon, last-slain marker, flee/undo/pause buttons, action log, hint banner.
- D20 vitality display with damage tumble + heal pulse animations and floating damage/heal numbers.
- Pause overlay with sound toggles.
- Defeat / victory overlays with full run statistics (cards cleared, monsters slain, damage taken, potions drunk, weapons equipped, flees unused, score).

Visuals:
- Dark-fantasy palette (ink, ember, blood, antique gold, bone).
- Cinzel Decorative + IM Fell English typography.
- Animated torches, dust drift, atmospheric vignette, screen-flash on damage / heal / equip / victory.
- Card animations — deal flip, consume scale-out, attack shake, equip flash, heal flash.

Audio:
- Procedural Web Audio SFX for card-deal, card-flip, attack, damage, heal, equip, skip, click, death, victory.
- Synthesised ambient drone for the music toggle.

Persistence:
- Best-score-per-difficulty + last-difficulty + options stored in `localStorage` under `crypt_d20_save_v1`.

Keyboard:
- `1`–`4` resolve cards · `F` flee · `U` undo · `D` toggle peek (Easy) · `Esc` pause · `Shift+click` fight bare-handed.
