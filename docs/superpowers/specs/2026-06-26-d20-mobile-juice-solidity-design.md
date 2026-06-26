# Crypt of the D20 — Mobile, Juice & Solidity Pass (Design)

**Date:** 2026-06-26
**Scope:** Improve the existing game without changing its rules. Three pillars: mobile/touch playability, polish & juice (feel), and a bug-hunt + balance solidity pass.
**Non-goal:** No new gameplay systems, cards, abilities, modes, or rule changes. The 44-card Donsol/Scoundrel ruleset stays exactly as documented.

---

## Background (current state, from code)

- Vanilla HTML/CSS/JS, no build step. Source of truth: GitHub `larikhalil/D20` (cloned to `Desktop\D20`).
- Responsive media queries already exist (`720px`, `380px`, `@media (hover:none)`, landscape phone). Viewport meta is present.
- Outcome prediction shows as an **always-on corner badge** (`−6` / `+8` / `−4`) plus a **desktop-only hover tooltip** with extra detail. The badge survives on touch; the tooltip is non-essential.
- Juice already present: arena shake, card shake, hit-spark, screen-shake on heavy hits, procedural audio.
- **Critical gap:** bare-handed fighting is hard-wired to `evt.shiftKey` (`onCardClick` → `doFight(slotIndex, evt.shiftKey)`). There is no touch path, so on a phone a player can never override an equipped weapon.
- No haptic feedback (`navigator.vibrate`) anywhere.
- No floating combat numbers (damage/heal feedback is shake + spark + static badge only).

---

## Pillar 1 — Mobile / touch (functional)

### 1A. Bare-hand override via "sheathe weapon" toggle  *(approved approach)*
- The equipped-weapon card in the HUD becomes tappable. Tapping it toggles a **sheathed** state.
- While **sheathed**: the weapon is visually dimmed with a slash/"sheathed" marker, and **every monster fight resolves bare-handed** (passes `forceBare = true` regardless of input device).
- While **drawn** (default): fights use the weapon per existing curse rules.
- Tapping the weapon again re-draws it.
- **Desktop unchanged:** Shift+click on a monster still forces a single bare-handed fight. The sheathe toggle is an additional, persistent control that works for mouse and touch alike.
- State: add `state.weaponSheathed` (boolean), reset on new game and whenever a new weapon is equipped (drawing a fresh blade un-sheathes). `doFight`'s `forceBare` becomes `evt?.shiftKey || state.weaponSheathed`.
- Edge cases: sheathing with no weapon equipped is a no-op; sheathe state must not break the weapon-curse `lastMonsterValue` tracking (sheathed = same as bare, curse untouched until weapon is drawn again); undo must restore prior sheathe state.

### 1B. Responsiveness pass
- Verify portrait layout at 360 / 390 / 430 px widths: no horizontal scroll, room row readable, HUD + HP die fit.
- Tap targets ≥ ~44px (cards, HUD weapon, skip/undo/pause buttons).
- Add `env(safe-area-inset-*)` padding so notches/home-indicators don't clip the HUD.
- Confirm the existing landscape-phone block still holds with the new sheathe control.

### 1C. Haptics
- `navigator.vibrate` (guarded for unsupported browsers): short tick on hit, double tick on heal, light tick on equip/sheathe, longer buzz on death. Respect a global on/off (tie to existing sound/settings toggle if one exists; otherwise default on, no new UI unless trivial).

---

## Pillar 2 — Polish & juice (feel)

### 2A. Floating combat numbers
- At the cutscene **impact frame**, spawn a floating `−N` (damage, red) off the monster card, `+N` (heal, green) off the HP die when drinking, and `−N`/reduction cue on equip. Number rises ~40px, fades ~600ms, then removes itself. CSS-keyframe driven, no layout thrash.
- Must fire on the same impact hook the existing shake/spark use, so a mid-cutscene skip still shows it correctly.

### 2B. HP-die reaction
- HP die flashes red + small recoil on damage, green pulse on heal. (Confirm during implementation whether any of this already exists; only add what's missing.)

> Juice is deliberately restrained — the game is already well-juiced on desktop. These two additions close the "what just happened to my HP" feedback loop, especially on mobile where hover is gone.

---

## Pillar 3 — Bug hunt & balance (solidity)

A dedicated audit pass over `game.js`, **findings reported before any non-trivial fix** (per established workflow: present plans before big changes). Focus areas:
- Undo / flee / room-refill interactions (the "three resolved, one survivor stays, draw three" refill logic and the once-per-room undo).
- Weapon-curse edge cases (`lastMonsterValue`, replacing a weapon mid-curse, sheathe interaction from 1A).
- End-game gating (treasure → CONTINUE → score) and per-game listener setup/teardown (leak check).
- Input-lock / cutscene-skip race conditions.
- Quick balance/scoring sanity (difficulty knobs, score formula) — report only, no balance changes without sign-off.

Trivial/safe fixes get applied directly; anything that changes feel or balance is reported first.

---

## Documentation
- Re-introduce a **`## §Changelog`** section in the GitHub README (currently absent) and add a dated entry per change round, newest first.

## Out of scope
- New cards, abilities, relics, bosses, modes, or any rule change.
- Backend / networking / accounts (game stays fully offline, static).
- Framework or build-tooling migration.

## Success criteria
- The game is fully playable on a phone in portrait, including choosing to fight bare-handed.
- Damage/heal is legible at a glance via floating numbers + (on mobile) haptics.
- No regressions in the desktop experience; audit-found bugs fixed; balance unchanged unless explicitly approved.
