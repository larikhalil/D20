# Crypt of the D20 — "Living Candlelight" Cinematic Restyle (Design)

**Date:** 2026-06-26
**Art direction:** *Living Candlelight* — push the crypt from a static lit room into a volumetric, reactive, cinematic space. Same gothic D20 identity; it now breathes, reacts, and hits with weight.
**Delivery:** **One single pass — everything together**, not staged. (User decision.)
**Non-goal:** No rule changes. The 44-card Donsol/Scoundrel ruleset, scoring, difficulty knobs, and all gameplay stay exactly as documented. This is purely visual/feel + two UX fixes (difficulty click, tutorial alignment).
**Platform:** Offline static site (vanilla HTML/CSS/JS). No Firebase, no deploy, no version-bump. Source of truth: GitHub `larikhalil/D20` (clone `Desktop\D20`). User reloads the browser; updates pushed to GitHub.

---

## The four things the user explicitly named

1. **Tutorial is misaligned (desktop + mobile)** → redesign as a spotlight coach-mark anchored to the *measured* target rect. Aligned by construction.
2. **Difficulty: click-to-pick, no Confirm** → clicking a difficulty card selects it and returns to the menu. Remove the Confirm button entirely.
3. **HP bar doesn't move, only the number changes** → **confirmed bug**: `renderHp()` sets `bar.style.height` but `.hp-bar` is a horizontal rail pinned `top:0;bottom:0` with `transition:width`. Setting height is a no-op. Fix to drive the fill correctly + animate it.
4. **"Improve all the graphics, smoother animation, cooler effects, super creative"** → the full *Living Candlelight* restyle below (user chose **bold cinematic restyle**).

---

## Pillars

### P1 — Cinematic lighting & depth grade
- Layered parallax atmosphere: mist / motes / embers drift at different speeds; subtle pointer-parallax on desktop (disabled on touch & reduced-motion).
- Warm/cool color grade: gold highlights vs near-black-teal shadows. Centralize as CSS custom properties so the grade is coherent and tweakable.
- Torchlight: warm radial pools that flicker (flames already exist); a gentle global light "breathe."
- Card/entity grounding: soft contact-shadow + warm rim-light from torch direction so cards read as physical objects.
- Restrained film layer: existing grain + subtle edge chromatic aberration + occasional drifting dust mote. **Chromatic aberration kept very subtle; easy to remove if it reads as too much.**

### P2 — Tactile cards
- Deal-in: staggered spring easing with overshoot settle (custom cubic-bezier), replacing today's linear/ease.
- Desktop hover: 3D perspective tilt toward cursor + lift + suit-tinted inner glow (red monster / green potion / steel-gold weapon).
- Resolve animations: monster slash + dissolve; potion drains into the D20 as a liquid streak; weapon flies to the armory with a metallic glint.
- One shared easing token used across all card motion.

### P3 — The D20 as a living vitality core (HP fix lives here)
- **Fix the bar bug.** Drive the visible fill correctly; rail reads as a **liquid vitality meter** that drains with a wobble and a glowing leading edge, color-shifting gold → amber → blood as HP falls.
- The die reacts: warm glow at full; cracks + red tremble at low HP; recoil + flash on damage; green bloom + sparkle on heal.
- Damage feedback (shake intensity + red-vignette pulse) **scales to the damage value** — a 2 is light, a 13 is devastating.
- Cooler floating numbers: weightier font, arc trajectory, scale-pop. (Builds on the existing HP-die + struck-card floaters added in today's earlier pass.)

### P4 — Combat impact (weight)
- Micro **hit-stop** (~70ms freeze) on a landed strike.
- Weapon strike = spark burst + slash streak across the monster; bare-handed = blood spatter + harder shake.
- High-value kills get a bigger payoff beat (more particles, a slower moment).
- All effect intensities scale to the damage number.

### P5 — Cinematic transitions
- Lean into the existing swinging dungeon door: room/screen changes do a quick fade-to-black + door + a momentary letterbox.
- Menu ↔ screens cross-fade with a subtle camera-push (scale), not an instant swap.

### P6 — Tutorial redesign (fixes alignment)
- Replace the hand-placed `.tut-dialog` arrow offsets with a **spotlight coach-mark**:
  - Dim/blur the arena, cut a glowing hole around the **measured** target element rect (via `getBoundingClientRect`).
  - Dock the dialog in a guaranteed-safe slot: bottom-center on mobile, beside the spotlight on desktop, clamped to viewport.
  - Pointer/arrow computed from real geometry, not magic numbers.
  - Step pill + progress retained.
- Must work at 360 / 390 / 430px portrait widths and on desktop. Verified live.

### P7 — Difficulty + menu
- **Difficulty:** remove the Confirm button. Click a card → ignite/flash flourish → `selectDifficulty()` → return to menu. Cards restyled as torch-lit stone tablets with rank numerals; the selected one glows.
- **Menu:** deeper animated ember backdrop on the crypt entrance; torch-lit button hovers.

### P8 — Typography grade
- Metallic-gold gradient + subtle emboss on the title; tightened hierarchy; coherent accent-variable system.

---

## Safety rails (apply to every pillar)
- **Respect the existing `Animations` toggle** (`body.no-anim`) and `prefers-reduced-motion` → instant/static fallbacks. No motion-locked content.
- GPU-friendly: animate `transform`/`opacity`/`filter` only; `will-change` used sparingly; no layout thrash (no animating `width`/`top` in hot loops where avoidable — the HP fill uses transform-scale where possible).
- Lighter particle counts and no pointer-parallax on mobile/touch.
- No regressions to today's mobile/touch work (sheathe toggle, haptics, safe-area insets, HUD fit).
- Verify live in a browser (desktop + a phone viewport) before declaring done — tutorial alignment especially.

## Files touched
- `index.html` — difficulty screen (remove Confirm), tutorial overlay markup (spotlight structure), any new effect layers.
- `styles.css` — the bulk: grade variables, lighting, card motion, HP fill, combat FX, transitions, tutorial coach-mark, difficulty/menu/typography.
- `game.js` — HP fill fix, difficulty click→return wiring, tutorial coach-mark positioning (measure target rect), hit-stop + scaled-FX hooks, transition triggers.
- `README.md` — `## Changelog` dated entry, newest first.
- This spec.

## Out of scope
- Any rule / card / scoring / difficulty-balance change.
- Backend, networking, accounts, build tooling.

## Success criteria
- Tutorial dialog + spotlight are correctly aligned on desktop and on 360–430px portrait phones.
- One click on a difficulty card selects it and returns to the menu; no Confirm button exists.
- The HP meter visibly drains/fills (not just the number) with a satisfying animation, color-graded by remaining HP.
- The game reads as visibly more cinematic — lighting depth, tactile cards, weighty combat, smooth transitions — with no FPS cliff on desktop and no breakage on mobile.
- `Animations`-off and `prefers-reduced-motion` both yield a clean, static, fully-playable game.
- No gameplay/rule regressions.

## Record-keeping
- This spec is the design record.
- A live task checklist (harness tasks) tracks implementation progress so nothing is lost across the single large pass.
- README `## Changelog` gets the shipped summary.
