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
| Fight bare-handed (overriding equipped weapon) | **Shift+click** the monster, **or** tap the weapon in the HUD to **sheathe** it |
| Hover for predicted outcome | Card tooltip appears |

### Touch (phone / tablet)

| Action | How |
|---|---|
| Resolve a card | Tap it |
| Fight bare-handed | **Tap the equipped weapon** in the HUD to *sheathe* it — while sheathed, every fight is bare-handed. Tap it again to draw the blade. |
| Predicted outcome | Always shown on each card's corner badge (`−6` / `+8` / `−4`) |

Sheathing pauses the weapon's dulling-curse; drawing the blade again resumes it. Equipping a new weapon always draws it (un-sheathes). Damage and heals pulse with a short haptic buzz on supported devices (tied to the SFX setting).

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

## Changelog

Newest first.

### 2026-06-26 (follow-up) — Mobile HUD fit & sheathe discoverability

Fixes from real-device feedback on the pass below.

- **One-time sheathe hint** — the first time a weapon is equipped on a touch device, a tip appears ("tap your weapon to sheathe it and fight bare-handed") and the weapon card pulses three times. Shown once ever (persisted in `localStorage` as `d20_sheathe_hint`).
- **Armory no longer oversized / cut off** — the weapon stack's layout box is a fixed `102×110`, and a CSS `transform: scale()` only shrank it *visually* while still reserving the full size, which shoved the Armory label off the right edge and made the HUD tall. On mobile the reserved space is now collapsed with negative margins matched to the scale, so the footprint equals what you see.
- **Controls always visible** — Flee / Undo / Pause now sit on their own centred, full-width HUD row on phones instead of overflowing the right edge at narrow widths.
- **Action history reads in full** — mobile log lines wrap instead of truncating with an ellipsis.
- **Fixed a mobile regression** — the earlier unscoped `#screen-game` safe-area padding was overriding the mobile `padding:0` reflow (adding ~56px of horizontal padding and pushing content off-screen). Safe-area insets are now scoped inside the mobile layout where they belong.

### 2026-06-26 — Mobile / touch, juice & solidity pass

A polish pass focused on phone playability and feel — **no rule changes**.

**Mobile / touch**
- **Sheathe-weapon toggle** — tap the equipped weapon in the HUD to sheathe it; while sheathed every fight resolves bare-handed. This is the touch-friendly equivalent of desktop `Shift+click` (phones have no Shift key), and it works for mouse users too. Sheathing pauses the weapon's dulling-curse; equipping a fresh blade always un-sheathes. New `state.weaponSheathed` flows through all combat-prediction math via a `weaponActive()` helper, so the corner badges and curse-lock visuals update live when you sheathe/draw. Undo restores the sheathe state.
- **Haptics** — short vibration on hit (heavier for ≥6 damage), heal, equip/sheathe, and a longer buzz on death/win. Guarded for unsupported browsers and tied to the SFX setting (no separate toggle).
- **Notch safe-area insets** — `env(safe-area-inset-*)` padding on the game screen / HUD / HP panel via `max()`, so desktop is unchanged but phones with notches/rounded corners don't clip the chrome.
- **Bigger touch targets** — control buttons get a ≥44px hit area on touch devices, and the equipped weapon shows a clearer tappable affordance where there's no hover to reveal it.

**Juice**
- **Floating combat numbers** — a `−N` / `+N` now pops off the struck card at the impact frame, where the player's eyes already are, complementing the existing HP-die floater. (HP-die reaction, screen flash, and shake were already present.)

**Solidity**
- Audited the refill / undo / flee state machine — the 3-of-4 refill rule, race-lock window, and once-per-room undo were already correctly guarded; no changes needed there. Added the death/victory haptic hooks at the win/lose branches.

**Files touched:** `game.js`, `styles.css`, `README.md`, plus the design spec under `docs/superpowers/specs/`.

