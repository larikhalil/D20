'use strict';

/* =============================================================
   CRYPT OF THE D20 — GAME LOGIC
   ============================================================= */

// -----------------------------------------------------------
// CONSTANTS
// -----------------------------------------------------------
const SUIT = {
  spades:   { glyph: '♠', kind: 'monster', name: 'Spades' },
  clubs:    { glyph: '♣', kind: 'monster', name: 'Clubs' },
  hearts:   { glyph: '♥', kind: 'potion',  name: 'Hearts' },
  diamonds: { glyph: '♦', kind: 'weapon',  name: 'Diamonds' }
};

const VALUE_LABEL = { 2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',11:'J',12:'Q',13:'K',14:'A' };
const VALUE_NAME  = { 2:'Two',3:'Three',4:'Four',5:'Five',6:'Six',7:'Seven',8:'Eight',9:'Nine',10:'Ten',11:'Jack',12:'Queen',13:'King',14:'Ace' };

// =============================================================
// DIFFICULTY — five tiers from Damned (hardest, default) to Wanderer (easiest)
// =============================================================
// Each easier tier ADDS ONE eased mechanic AND adds back one suit-rank of red
// royals to the deck. The hardest tier is the design baseline; everything
// downstream eases from there. Mechanic ladder:
//   Damned     — 3 flees, no flee mid-room, no undo, no peek, deck = 44
//   Vanquisher — 3 flees, FLEE-MID enabled,  no undo, no peek, deck +red J = 46
//   Adventurer — 3 flees, flee-mid,          UNDO,    no peek, deck +red Q = 48
//   Apprentice — 3 flees, flee-mid,          undo,    PEEK,    deck +red K = 50
//   Wanderer   — UNLIMITED flees, all eases,                   deck +red A = 52
// `fleeAfterPick` controls whether you may flee a room after at least one card
// has been resolved (any room slot is null). When false, you can only flee an
// untouched 4-card room.
// `redRoyals` is the highest red royal value included (10 = none, 11 = +red
// Jacks, 12 = +red Queens, 13 = +red Kings, 14 = +red Aces / full deck).
// `skips: Infinity` for unlimited flees; the HUD renders that as "∞".
const DIFFICULTY = {
  damned:     { hp: 20, skips: 3,        undo: false, peek: false, fleeAfterPick: false, redRoyals: 10, label: 'Damned',     mult: 4.0 },
  vanquisher: { hp: 20, skips: 3,        undo: false, peek: false, fleeAfterPick: true,  redRoyals: 11, label: 'Vanquisher', mult: 2.5 },
  adventurer: { hp: 20, skips: 3,        undo: true,  peek: false, fleeAfterPick: true,  redRoyals: 12, label: 'Adventurer', mult: 1.5 },
  apprentice: { hp: 20, skips: 3,        undo: true,  peek: true,  fleeAfterPick: true,  redRoyals: 13, label: 'Apprentice', mult: 1.0 },
  wanderer:   { hp: 20, skips: Infinity, undo: true,  peek: true,  fleeAfterPick: true,  redRoyals: 14, label: 'Wanderer',   mult: 0.7 }
};

const STORAGE_KEY = 'crypt_d20_save_v1';

// -----------------------------------------------------------
// ATMOSPHERE PROGRESSION — drives the descent visual arc
// -----------------------------------------------------------
// Each anchor's values are written to :root CSS variables, interpolated
// continuously between adjacent anchors based on (1 - deck.length / 44).
// Five stages: Antechamber → Catacombs → Reliquary → Sanctum → Throne.
// Each anchor has an explicit `at` (progress threshold). Stages are now front-
// loaded — Catacombs by 18% so the descent is visible early; Antechamber gets
// a slight ambient warm overlay so the start isn't a flat untinted default.
// Each anchor also drives a hue-rotate/saturate/brightness filter on the
// brick-pattern wall (.bg-stone). That + an alpha overlay = unmistakable
// stage-to-stage shift. Earlier mix-blend-multiply was too subtle — now we
// hard-shift the wall's hue and dump a colored haze over it.
// v0.6.2 — all 5 anchors share identical values. The atmosphere never shifts
// between rooms (per user request: "remove the visual effects differences
// between rooms"). The lerp logic still runs but produces a constant result,
// so the look stays consistent end-to-end. Stage names still advance for
// narrative texture, but the lighting/particles do not change.
const _SHARED_ATM = {
  flameInner:[255,248,160], flameMid:[255,174, 32], flameOuter:[217,122, 60], flameBase:[122, 32,  8],
  glowStrong:[255,160, 50,0.55], glowWeak:[255,160, 50,0.25],
  vignMid:[ 10, 12, 16,0.65],    vignEdge:[  4,  5,  8,0.95],
  overlay:[ 80, 56, 24,0.22],
  bgHue:  0,   bgSat: 1.00, bgBri: 1.00
};
const ATMOSPHERE_ANCHORS = [
  { at: 0.00, ..._SHARED_ATM },
  { at: 0.18, ..._SHARED_ATM },
  { at: 0.42, ..._SHARED_ATM },
  { at: 0.66, ..._SHARED_ATM },
  { at: 0.88, ..._SHARED_ATM }
];

const STAGE_NAMES = [
  { at: 0.00, name: 'Antechamber' },
  { at: 0.18, name: 'Catacombs' },
  { at: 0.42, name: 'Reliquary' },
  { at: 0.66, name: 'Sanctum' },
  { at: 0.88, name: 'Throne' }
];

function _stageNameFor(progress) {
  let name = STAGE_NAMES[0].name;
  for (const s of STAGE_NAMES) { if (progress >= s.at) name = s.name; }
  return name;
}

const ATMOSPHERE_MILESTONES = [
  { at: 0.25, text: 'the air grows colder' },
  { at: 0.50, text: 'you hear distant chanting' },
  { at: 0.75, text: 'the stones smell of blood' },
  { at: 0.90, text: 'something on the throne stirs' }
];

function _lerp(a, b, t) { return a + (b - a) * t; }
function _lerpRgb(a, b, t) {
  return [
    Math.round(_lerp(a[0], b[0], t)),
    Math.round(_lerp(a[1], b[1], t)),
    Math.round(_lerp(a[2], b[2], t))
  ];
}
function _lerpRgba(a, b, t) {
  return [
    Math.round(_lerp(a[0], b[0], t)),
    Math.round(_lerp(a[1], b[1], t)),
    Math.round(_lerp(a[2], b[2], t)),
    +(_lerp(a[3], b[3], t)).toFixed(3)
  ];
}
function _rgbStr([r,g,b]) { return `rgb(${r},${g},${b})`; }
function _rgbaStr([r,g,b,a]) { return `rgba(${r},${g},${b},${a})`; }

function setAtmosphere(progress) {
  const stages = ATMOSPHERE_ANCHORS;
  const t = Math.max(0, Math.min(1, progress));
  // Find the segment based on each anchor's explicit `at` position
  // (anchors are non-linearly distributed: front-loaded for early visibility).
  let i = 0;
  while (i < stages.length - 1 && t >= stages[i + 1].at) i++;
  const a = stages[i];
  const b = stages[Math.min(i + 1, stages.length - 1)];
  const span = b.at - a.at;
  const localT = span > 0 ? (t - a.at) / span : 0;
  const root = document.documentElement.style;
  root.setProperty('--atm-flame-inner', _rgbStr(_lerpRgb(a.flameInner, b.flameInner, localT)));
  root.setProperty('--atm-flame-mid',   _rgbStr(_lerpRgb(a.flameMid,   b.flameMid,   localT)));
  root.setProperty('--atm-flame-outer', _rgbStr(_lerpRgb(a.flameOuter, b.flameOuter, localT)));
  root.setProperty('--atm-flame-base',  _rgbStr(_lerpRgb(a.flameBase,  b.flameBase,  localT)));
  root.setProperty('--atm-glow-strong', _rgbaStr(_lerpRgba(a.glowStrong, b.glowStrong, localT)));
  root.setProperty('--atm-glow-weak',   _rgbaStr(_lerpRgba(a.glowWeak,   b.glowWeak,   localT)));
  root.setProperty('--atm-vignette-mid',  _rgbaStr(_lerpRgba(a.vignMid,  b.vignMid,  localT)));
  root.setProperty('--atm-vignette-edge', _rgbaStr(_lerpRgba(a.vignEdge, b.vignEdge, localT)));
  root.setProperty('--atm-overlay',       _rgbaStr(_lerpRgba(a.overlay,  b.overlay,  localT)));
  // Wall hue/sat/bri filter — by far the most visible stage-shift cue.
  root.setProperty('--atm-bg-hue', _lerp(a.bgHue, b.bgHue, localT).toFixed(1) + 'deg');
  root.setProperty('--atm-bg-sat', _lerp(a.bgSat, b.bgSat, localT).toFixed(3));
  root.setProperty('--atm-bg-bri', _lerp(a.bgBri, b.bgBri, localT).toFixed(3));
}

function _stageKeyFor(progress) {
  if (progress < 0.18) return 'antechamber';
  if (progress < 0.42) return 'catacombs';
  if (progress < 0.66) return 'reliquary';
  if (progress < 0.88) return 'sanctum';
  return 'throne';
}

function updateAtmosphere() {
  const total = 44; // canonical deck size
  const progress = 1 - state.deck.length / total;
  setAtmosphere(progress);
  // Stage banner (always visible — explicit feedback that the descent is shifting)
  const banner = $('stage-banner');
  if (banner) {
    const ROMAN = { Antechamber: 'I', Catacombs: 'II', Reliquary: 'III', Sanctum: 'IV', Throne: 'V' };
    const name = _stageNameFor(progress);
    banner.innerHTML = '<span class="roman">' + ROMAN[name] + '</span><span class="name">' + name.toUpperCase() + '</span>';
  }
  // Stage key on body — drives per-stage particle decor in styles.css.
  document.body.dataset.stage = _stageKeyFor(progress);
  // milestone hint flashes (fire-once per run)
  for (const m of ATMOSPHERE_MILESTONES) {
    if (progress >= m.at && !state.atmosphereMilestonesFired.includes(m.at)) {
      state.atmosphereMilestonesFired.push(m.at);
      hint(m.text, 2500);
    }
  }
}

// -----------------------------------------------------------
// AUDIO — Procedural SFX via Web Audio API
// -----------------------------------------------------------
const Audio = (() => {
  let ctx = null;
  let masterGain = null;
  let musicGain = null;
  let musicNodes = null;
  let sfxOn = true;
  let musicOn = false;
  let userUnlocked = false;       // becomes true on first user gesture
  let pendingMusicStart = false;  // music was requested before unlock

  function ensure() {
    // Browsers refuse to start an AudioContext outside a user gesture.
    // Defer creation until we have one.
    if (!userUnlocked) return;
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.6;
      masterGain.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0;
      musicGain.connect(masterGain);
    } catch(e) { /* audio unavailable */ }
  }

  function unlock() {
    if (userUnlocked) return;
    userUnlocked = true;
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    if (pendingMusicStart && musicOn) {
      pendingMusicStart = false;
      startMusic();
    }
  }

  function tone(freq, dur, type='sine', vol=0.3, attack=0.005, release=0.1) {
    if (!ctx || !sfxOn) return;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + attack);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur + release);
    osc.connect(g); g.connect(masterGain);
    osc.start();
    osc.stop(ctx.currentTime + dur + release + 0.05);
  }

  function noiseBurst(dur, vol=0.3, filterFreq=2000, filterType='lowpass') {
    if (!ctx || !sfxOn) return;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i=0;i<data.length;i++) data[i] = (Math.random()*2-1) * (1 - i/data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filter); filter.connect(g); g.connect(masterGain);
    src.start();
  }

  function chord(freqs, dur=0.5, type='sine', vol=0.18) {
    freqs.forEach((f, i) => setTimeout(() => tone(f, dur, type, vol), i * 60));
  }

  // Public SFX
  function play(name) {
    ensure();
    if (!ctx || !sfxOn) return;
    if (ctx.state === 'suspended') ctx.resume();
    switch(name) {
      case 'card-deal':
        noiseBurst(0.18, 0.25, 4000, 'highpass');
        tone(420, 0.12, 'triangle', 0.12);
        break;
      case 'card-flip':
        noiseBurst(0.08, 0.15, 6000, 'highpass');
        tone(800, 0.05, 'triangle', 0.08);
        break;
      case 'attack':
        tone(180, 0.08, 'square', 0.25);
        setTimeout(() => noiseBurst(0.12, 0.3, 3500, 'bandpass'), 50);
        setTimeout(() => tone(110, 0.18, 'sawtooth', 0.18), 70);
        break;
      case 'damage':
        tone(80, 0.25, 'sawtooth', 0.32, 0.001, 0.15);
        setTimeout(() => noiseBurst(0.18, 0.25, 800, 'lowpass'), 30);
        break;
      case 'heal':
        chord([523.25, 659.25, 783.99], 0.4, 'triangle', 0.18);
        break;
      case 'equip':
        tone(680, 0.06, 'square', 0.18);
        setTimeout(() => tone(920, 0.08, 'square', 0.16), 50);
        setTimeout(() => noiseBurst(0.1, 0.18, 5000, 'highpass'), 70);
        break;
      case 'skip':
        tone(140, 0.18, 'sawtooth', 0.22);
        setTimeout(() => noiseBurst(0.22, 0.22, 1500, 'lowpass'), 100);
        break;
      case 'cant':
        tone(200, 0.08, 'square', 0.2);
        setTimeout(() => tone(150, 0.15, 'square', 0.18), 80);
        break;
      case 'click':
        tone(900, 0.03, 'square', 0.1);
        break;
      case 'death':
        // descending dirge
        [392, 369.99, 329.63, 311.13, 261.63].forEach((f, i) =>
          setTimeout(() => tone(f, 0.45, 'sawtooth', 0.22), i * 180)
        );
        break;
      case 'victory':
        // ascending fanfare
        [261.63, 329.63, 392, 523.25, 659.25].forEach((f, i) =>
          setTimeout(() => tone(f, 0.4, 'triangle', 0.22), i * 110)
        );
        setTimeout(() => chord([523.25, 659.25, 783.99, 1046.5], 0.8, 'triangle', 0.2), 700);
        break;
      // v0.6.0 — new SFX for the door cinematic + corridor + treasure
      case 'door-open':
        // Heavy iron creak — low filtered noise + descending sub-tone
        noiseBurst(0.45, 0.32, 600, 'lowpass');
        tone(72, 0.5, 'sawtooth', 0.18, 0.01, 0.3);
        setTimeout(() => tone(48, 0.4, 'sawtooth', 0.14), 180);
        break;
      case 'door-close':
        // Slammed thud + reverb tail
        noiseBurst(0.18, 0.45, 200, 'lowpass');
        tone(64, 0.18, 'sawtooth', 0.32);
        setTimeout(() => noiseBurst(0.32, 0.2, 400, 'lowpass'), 90);
        break;
      case 'footstep':
        // Soft tap on stone — high-passed click
        noiseBurst(0.04, 0.18, 8000, 'highpass');
        tone(120, 0.04, 'square', 0.06);
        break;
      case 'treasure':
        // Sparkly chord — bright triangle stack
        chord([783.99, 987.77, 1174.66, 1567.98], 0.5, 'triangle', 0.16);
        setTimeout(() => chord([1046.5, 1318.51, 1567.98], 0.6, 'triangle', 0.14), 280);
        break;
    }
  }

  function startMusic() {
    ensure();
    if (!ctx || musicNodes) return;
    if (ctx.state === 'suspended') ctx.resume();
    // Slow pad: two detuned sines through a low-pass + tremolo
    const o1 = ctx.createOscillator();  o1.type='sine'; o1.frequency.value = 55;
    const o2 = ctx.createOscillator();  o2.type='sine'; o2.frequency.value = 82.41; // E
    const o3 = ctx.createOscillator();  o3.type='triangle'; o3.frequency.value = 220;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12;
    const lfoG = ctx.createGain();      lfoG.gain.value = 0.12;
    const mix = ctx.createGain();       mix.gain.value = 0.22;
    const filt = ctx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value = 600;
    o1.connect(mix); o2.connect(mix); o3.connect(mix);
    mix.connect(filt); filt.connect(musicGain);
    lfo.connect(lfoG); lfoG.connect(mix.gain);
    o1.start(); o2.start(); o3.start(); lfo.start();
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(musicOn ? 0.6 : 0, ctx.currentTime + 1.2);
    musicNodes = { o1, o2, o3, lfo };
  }

  function stopMusic() {
    if (!ctx || !musicNodes) return;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
    setTimeout(() => {
      try { musicNodes.o1.stop(); musicNodes.o2.stop(); musicNodes.o3.stop(); musicNodes.lfo.stop(); } catch(e) {}
      musicNodes = null;
    }, 700);
  }

  return {
    play,
    unlock,
    setSfx(on) { sfxOn = on; },
    setMusic(on) {
      musicOn = on;
      if (!userUnlocked) {
        // remember the choice; will start when user first interacts
        pendingMusicStart = on;
        return;
      }
      ensure();
      if (!ctx) return;
      if (on) startMusic();
      else stopMusic();
    },
    sfxOn() { return sfxOn; },
    musicOn() { return musicOn; }
  };
})();

// -----------------------------------------------------------
// DECK
// -----------------------------------------------------------
function buildDeck(diffKey) {
  // Spades & Clubs always full (2..14).
  // Hearts & Diamonds 2..N where N = DIFFICULTY[diffKey].redRoyals
  // (10 = no red royals, 11 = +Jacks, 12 = +Queens, 13 = +Kings, 14 = full).
  // Sizes: 44 / 46 / 48 / 50 / 52 across the five tiers.
  const cfg = DIFFICULTY[diffKey] || DIFFICULTY.damned;
  const redCap = cfg.redRoyals;
  const deck = [];
  for (const suit of ['spades','clubs']) {
    for (let v=2; v<=14; v++) deck.push({ suit, value: v });
  }
  for (const suit of ['hearts','diamonds']) {
    for (let v=2; v<=redCap; v++) deck.push({ suit, value: v });
  }
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// -----------------------------------------------------------
// STATE
// -----------------------------------------------------------
const state = {
  // 'adventure' = full staging (trainer sprite, cutscenes, room decor).
  // 'quick'     = card-only — no character, no cutscenes, minimal chrome.
  // v0.6.1 — Adventure mode is hidden from the menu but its code paths remain
  // intact for the (unlikely) case someone re-enables it. New runs default to
  // 'quick' (the card-game-only experience).
  mode: 'quick',
  difficulty: 'damned',
  hp: 20,
  maxHp: 20,
  deck: [],
  room: [null, null, null, null],     // 4 fixed slots; null = empty
  weapon: null,                       // { suit: 'diamonds', value: N }
  weaponSheathed: false,              // true = weapon set aside; all fights bare-handed (touch-friendly bare-hand)
  lastMonsterValue: null,
  weaponStack: [],                    // monsters defeated under current weapon
  skipsLeft: 1,
  cardsCleared: 0,
  monstersDefeated: 0,
  damageTaken: 0,
  potionsUsed: 0,
  weaponsEquipped: 0,
  // v0.6.1 — high-score / efficiency tracking
  startTime: null,
  endTime: null,
  bareHits: 0,
  fullHpHits: 0,
  inputLocked: false,
  isOver: false,
  undoSnapshot: null,
  undoUsed: false,
  undoAllowed: true,
  showPeek: false,
  atmosphereMilestonesFired: [],
  // Tutorial mode — when true, the first room is the scripted goblin / sword /
  // skeleton / potion sequence and the UI is gated to the current step.
  // After all 4 cards resolve, the player chooses to continue the run (scored)
  // or return to the menu.
  tutorialMode: false,
  tutorialStep: 0,
  options: { sfx: true, music: false, anim: true, tip: true }
};

const $ = (id) => document.getElementById(id);
const qs  = (sel, root=document) => root.querySelector(sel);
const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));

// Whether the equipped weapon will actually be used in combat. False when
// unarmed OR when the blade is sheathed (the touch-friendly bare-hand toggle).
// All combat-prediction math and the fight resolver route through this so the
// sheathed state is reflected consistently in badges and damage.
function weaponActive() { return !!state.weapon && !state.weaponSheathed; }

// Haptic feedback for touch devices. Tied to the SFX option (no separate
// toggle) and guarded for browsers without the Vibration API. No-op on desktop.
function haptic(kind) {
  if (!state.options.sfx) return;
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  const PATTERNS = {
    hit:   25,
    heavy: [0, 35, 25, 45],
    heal:  [0, 12, 30, 12],
    light: 10,
    death: [0, 90, 50, 130]
  };
  try { navigator.vibrate(PATTERNS[kind] || 10); } catch (e) { /* ignore */ }
}

// Spawn a short-lived floating number off a room card at the impact frame, so
// the damage/heal reads where the player's eyes already are (the struck card) —
// not only at the HP die across the screen. Complements the existing hp-floater.
function spawnCardFloater(slotIndex, text, cls) {
  const slot = $('slot-' + slotIndex);
  if (!slot) return;
  const f = document.createElement('div');
  f.className = 'card-floater ' + cls;
  f.textContent = text;
  slot.appendChild(f);
  setTimeout(() => { if (f.parentNode) f.parentNode.removeChild(f); }, 850);
}

// -----------------------------------------------------------
// SAVE / LOAD
// -----------------------------------------------------------
function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e) { return null; }
}
function saveData(data) {
  try {
    const cur = loadSave() || {};
    Object.assign(cur, data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cur));
  } catch(e) {}
}

// -----------------------------------------------------------
// SCREEN MANAGEMENT
// -----------------------------------------------------------
function showScreen(name) {
  qsa('.screen').forEach(el => el.classList.toggle('active', el.dataset.screen === name));
  // Clean up in-game body classes when navigating away from the game so the
  // grey-crypt palette (scoped on body.mode-*) doesn't bleed into menus.
  if (name !== 'game') {
    document.body.classList.remove('mode-quick', 'mode-adventure', 'tutorial-mode');
  }
}
function showOverlay(name) { $('overlay-' + name).classList.add('active'); }
function hideOverlay(name) { $('overlay-' + name).classList.remove('active'); }

// -----------------------------------------------------------
// CARD RENDERING
// -----------------------------------------------------------
function cardKindClass(card) {
  if (!card) return '';
  return SUIT[card.suit].kind; // monster | potion | weapon
}

function suitColor(suit) {
  if (suit === 'spades' || suit === 'clubs') return '#1a1410';
  if (suit === 'hearts') return '#8b1a1a';
  if (suit === 'diamonds') return '#2c4a70';
  return '#000';
}

/* =========================================================
   PIXEL-ART SPRITE ENGINE
   ========================================================= */

// Render a 2D pixel grid (array of equal-length strings) into compact SVG.
// Adjacent same-color pixels are merged into single rects per row run.
function pixelSpriteSvg(grid, palette, sizePct, opts = {}) {
  const h = grid.length;
  const w = grid[0].length;
  let rects = '';
  for (let y = 0; y < h; y++) {
    const row = grid[y];
    let x = 0;
    while (x < w) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') { x++; continue; }
      const start = x;
      while (x < w && row[x] === ch) x++;
      const color = palette[ch];
      if (color) {
        rects += `<rect x="${start}" y="${y}" width="${x - start}" height="1" fill="${color}"/>`;
      }
    }
  }
  const flip = opts.flip ? ' transform="scale(-1,1) translate(-' + w + ',0)"' : '';
  const motion = opts.motion ? ' ' + opts.motion : '';
  return `<svg class="card-illustration pixel-art${motion}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" style="width:${sizePct}%;height:${sizePct}%;">${flip ? '<g' + flip + '>' + rects + '</g>' : rects}</svg>`;
}

// Render a multi-frame sprite sheet — frames laid horizontally inside one SVG,
// inner SVG translates through them via CSS steps(N). One CSS @keyframes
// (sheet-cycle, defined in styles.css) handles all frame counts.
//
// opts: { fps:5, loop:true } — when loop=false the animation runs once with
// fill-mode:forwards. After the duration the caller should swap to another anim.
function pixelSpriteSheet(frames, palette, sizePct, opts = {}) {
  if (!frames || !frames.length) return '';
  const fps = opts.fps || 5;
  const loop = opts.loop !== false;
  const h = frames[0].length;
  const w = frames[0][0].length;
  const n = frames.length;
  let rects = '';
  for (let f = 0; f < n; f++) {
    const grid = frames[f];
    const offsetX = f * w;
    for (let y = 0; y < h; y++) {
      const row = grid[y];
      let x = 0;
      while (x < w) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') { x++; continue; }
        const start = x;
        while (x < w && row[x] === ch) x++;
        const color = palette[ch];
        if (color) {
          rects += `<rect x="${offsetX + start}" y="${y}" width="${x - start}" height="1" fill="${color}"/>`;
        }
      }
    }
  }
  const dur = (n / fps).toFixed(3);
  const iter = loop ? 'infinite' : '1 forwards';
  return `<div class="pixel-sheet" style="width:${sizePct}%;aspect-ratio:${w}/${h};">` +
         `<svg class="pixel-art-sheet" viewBox="0 0 ${w * n} ${h}" preserveAspectRatio="xMinYMid meet" ` +
         `style="width:${n * 100}%;height:100%;animation:sheet-cycle ${dur}s steps(${n}) ${iter};">` +
         rects +
         `</svg></div>`;
}

// =============================================================
// PLAYER SPRITE — KNIGHT (back-view, 16x16, v0.5.6 redraw)
// =============================================================
// Pokemon Gen-1 trainer staging — silver-armored knight viewed from behind,
// helmet + cuirass + greaves silhouette, optional cape draped down the back.
// Idle is a SINGLE static frame (no breathing sway); the figure only animates
// during action poses (drink, equip, attack, dash, hurt).
// v0.6 — replaced the cloaked knight with the Wild Berserker (Phase B of the
// Golden Axe visual reset). Spec: docs/superpowers/specs/2026-05-15-visual-direction-design.md §5
// Mockup: .superpowers/brainstorm/1504-1778853848/content/s3-hero-evolution.html
// Sprites are 24-wide × 28-tall back-view (player faces away from camera).
// Axis at col 11-12; mane occupies cols 8-16, fur pads 5-7 and 16-18, skin
// (bare back) 8-15, belt at row 23, pants 24-25, boots 26-27. Battle-axe
// is mounted diagonally on the right shoulder (haft cols 14-17, head cols 16-19).
const PLAYER_PALETTE = {
  '.': null,        // transparent
  'H': '#ffd83a',   // mane highlight (bright gold)
  'h': '#ffae20',   // mane base (amber)
  'R': '#c8202a',   // headband (crimson)
  'r': '#7a1818',   // headband shadow / dark accent
  'X': '#ff4080',   // headband hurt-flash (brighter red-pink)
  'S': '#e8a868',   // skin base (tan)
  's': '#c88848',   // skin shadow (deep tan)
  'L': '#f8c898',   // skin highlight (pale tan)
  'F': '#6a4028',   // fur pad base (dark brown)
  'f': '#8a5838',   // fur pad highlight
  'B': '#7a3018',   // belt sash base (russet)
  'b': '#9a4028',   // belt sash highlight
  'Y': '#ffd83a',   // belt buckle gold
  'P': '#3a2014',   // pants leather
  'p': '#5a3018',   // pants rim light
  'K': '#1a0a04',   // boot leather (near-black)
  'k': '#3a2014',   // boot cuff
  'M': '#9a9a9a',   // axe steel head
  'm': '#5a5a5a',   // axe steel shadow
  'W': '#5a3818',   // axe wood haft (default battleaxe)
  'w': '#7a5028',   // axe wood highlight
  'V': '#f4ebd0',   // pale highlight (drink bottle glass, weapon flash)
  '#': '#0a0408'    // outline (rare — silhouette only)
};

// All berserker frames are 24×28 grids. Animation slots match the cutscene
// module's existing weapon-shape → animation routing; only the sprite data
// changes — engine code is untouched.
const PLAYER_PX = {
  // IDLE — single static frame. Wild Berserker, back-view.
  // Anatomy: mane (rows 9-14), headband (row 12), fur pads + skin shoulders
  // (rows 15-17), bare back with spine shadow (rows 18-22), belt sash + gold
  // buckle (row 23), leather pants (rows 24-25), boots (rows 26-27). Battle-axe
  // mounted on the right shoulder: head at rows 2-6 cols 16-19, haft slanting
  // down-left through rows 7-8 to the body.
  idle: { fps: 1, loop: true, frames: [
    [
      '........................', // 0
      '........................', // 1
      '.................MM.....', // 2  axe head top
      '................MMmM....', // 3
      '................MmmM....', // 4
      '................MMmM....', // 5
      '................MMMM....', // 6  axe head bottom
      '...............WWW......', // 7  axe haft
      '..............WWW.......', // 8
      '.........HHHHHH.........', // 9  mane peak
      '........hHHHHHHHh.......', // 10
      '........hhhhhhhhh.......', // 11
      '........RRRRRRRRR.......', // 12 HEADBAND
      '........hhhhhhhhh.......', // 13
      '.........hhhhhhh........', // 14 mane bottom taper
      '......FFFLSSSSLFFF......', // 15 fur pads + skin neck
      '.....FFFFLSSSSSLFFFF....', // 16 widest shoulder
      '......fFFSSSSSSFFf......', // 17
      '.......sSSSSSSSs........', // 18 bare back start
      '.......sSSSsSSSs........', // 19 spine shadow center
      '.......sSSSsSSSs........', // 20
      '.......sSSSsSSSs........', // 21
      '.......sSSSsSSSs........', // 22
      '.......bBBYYBBb.........', // 23 belt + buckle
      '.........PPPpPPP........', // 24 pants
      '.........PPPpPPP........', // 25
      '.........PP..PP.........', // 26 legs split
      '........KKK..KKK........'  // 27 boots
    ]
  ]},

  // DASH-IN — 2 frames. Stride forward. Only the bottom rows change.
  dashIn: { fps: 8, loop: false, frames: [
    [ // F0 — left foot lifted forward
      '........................','........................',
      '.................MM.....','................MMmM....',
      '................MmmM....','................MMmM....',
      '................MMMM....','...............WWW......',
      '..............WWW.......','.........HHHHHH.........',
      '........hHHHHHHHh.......','........hhhhhhhhh.......',
      '........RRRRRRRRR.......','........hhhhhhhhh.......',
      '.........hhhhhhh........','......FFFLSSSSLFFF......',
      '.....FFFFLSSSSSLFFFF....','......fFFSSSSSSFFf......',
      '.......sSSSSSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......bBBYYBBb.........',
      '.........PPPpPPP........','.........PPPpPPP........',
      '.........PP...PP........','........KKK...KKK.......'
    ],
    [ // F1 — right foot lifted forward
      '........................','........................',
      '.................MM.....','................MMmM....',
      '................MmmM....','................MMmM....',
      '................MMMM....','...............WWW......',
      '..............WWW.......','.........HHHHHH.........',
      '........hHHHHHHHh.......','........hhhhhhhhh.......',
      '........RRRRRRRRR.......','........hhhhhhhhh.......',
      '.........hhhhhhh........','......FFFLSSSSLFFF......',
      '.....FFFFLSSSSSLFFFF....','......fFFSSSSSSFFf......',
      '.......sSSSSSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......bBBYYBBb.........',
      '.........PPPpPPP........','.........PPPpPPP........',
      '.........PP..PPP........','........KKK..KKKK.......'
    ]
  ]},

  // ATTACK-PIERCE — 3 frames. Body coils → thrust right → recoil. The forward
  // thrust extends skin cells to the right of the body (the right arm reaching).
  attackPierce: { fps: 9, loop: false, frames: [
    [ // F0 — wind-up (body coils slightly, axe haft pulls back)
      '........................','........................',
      '.................MM.....','................MMmM....',
      '................MmmM....','................MMmM....',
      '................MMMM....','...............WWW......',
      '..............WWW.......','.........HHHHHH.........',
      '........hHHHHHHHh.......','........hhhhhhhhh.......',
      '........RRRRRRRRR.......','........hhhhhhhhh.......',
      '.........hhhhhhh........','......FFFLSSSSLFFF......',
      '.....FFFFLSSSSSLFFFF....','......fFFSSSSSSFFf......',
      '.......sSSSSSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......bBBYYBBb.........',
      '.........PPPpPPP........','.........PPPpPPP........',
      '.........PP..PP.........','........KKK..KKK........'
    ],
    [ // F1 — thrust peak (skin cells extend to col 18+ representing arm reaching)
      '........................','........................',
      '.................MM.....','................MMmM....',
      '................MmmM....','................MMmM....',
      '................MMMM....','...............WWW......',
      '..............WWW.......','.........HHHHHH.........',
      '........hHHHHHHHh.......','........hhhhhhhhh.......',
      '........RRRRRRRRR.......','........hhhhhhhhh.......',
      '.........hhhhhhh........','......FFFLSSSSLFFF......',
      '.....FFFFLSSSSSLFFFFSSs.','......fFFSSSSSSFFfSSSs..',
      '.......sSSSSSSSsSSSSs...','.......sSSSsSSSSSSSSs...',
      '.......sSSSsSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......bBBYYBBb.........',
      '.........PPPpPPP........','.........PPPpPPP........',
      '.........PP..PP.........','........KKK..KKK........'
    ],
    [ // F2 — recoil (back to wind-up posture)
      '........................','........................',
      '.................MM.....','................MMmM....',
      '................MmmM....','................MMmM....',
      '................MMMM....','...............WWW......',
      '..............WWW.......','.........HHHHHH.........',
      '........hHHHHHHHh.......','........hhhhhhhhh.......',
      '........RRRRRRRRR.......','........hhhhhhhhh.......',
      '.........hhhhhhh........','......FFFLSSSSLFFF......',
      '.....FFFFLSSSSSLFFFF....','......fFFSSSSSSFFf......',
      '.......sSSSSSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......bBBYYBBb.........',
      '.........PPPpPPP........','.........PPPpPPP........',
      '.........PP..PP.........','........KKK..KKK........'
    ]
  ]},

  // ATTACK-SLASH — 3 frames. Torso sweeps left → up → right. Axe orbits overhead
  // in F1 (axe head moves to top-center cells).
  attackSlash: { fps: 8, loop: false, frames: [
    [ // F0 — wind-up to LEFT (skin cells extend left, axe haft tilts left)
      '........................','........................',
      '.................MM.....','................MMmM....',
      '................MmmM....','................MMmM....',
      '................MMMM....','............WWW.........',
      '...........WWW..........','.........HHHHHH.........',
      '........hHHHHHHHh.......','........hhhhhhhhh.......',
      '........RRRRRRRRR.......','........hhhhhhhhh.......',
      '.........hhhhhhh........','......FFFLSSSSLFFF......',
      '..sSSFFFFLSSSSSLFFFF....','.sSSSfFFSSSSSSFFf......',
      'sSSSSsSSSSSSSSs.........','.sSSSsSSSsSSSSs.........',
      '.......sSSSsSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......bBBYYBBb.........',
      '.........PPPpPPP........','.........PPPpPPP........',
      '.........PP..PP.........','........KKK..KKK........'
    ],
    [ // F1 — axe overhead, body upright (axe head at top of frame)
      '.........MMMM...........','........MMmmMM..........',
      '.........MMMM...........','...........WW...........',
      '...........WW...........','...........WW...........',
      '...........WW...........','...........WW...........',
      '...........WW...........','.........HHHHHH.........',
      '........hHHHHHHHh.......','........hhhhhhhhh.......',
      '........RRRRRRRRR.......','........hhhhhhhhh.......',
      '.........hhhhhhh........','......FFFLSSSSLFFF......',
      '.....FFFFLSSSSSLFFFF....','......fFFSSSSSSFFf......',
      '.......sSSSSSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......bBBYYBBb.........',
      '.........PPPpPPP........','.........PPPpPPP........',
      '.........PP..PP.........','........KKK..KKK........'
    ],
    [ // F2 — follow-through to RIGHT (skin cells extend right, axe haft tilts right)
      '........................','........................',
      '.................MM.....','................MMmM....',
      '................MmmM....','................MMmM....',
      '................MMMM....','..................WWW...',
      '...................WWW..','.........HHHHHH.........',
      '........hHHHHHHHh.......','........hhhhhhhhh.......',
      '........RRRRRRRRR.......','........hhhhhhhhh.......',
      '.........hhhhhhh........','......FFFLSSSSLFFF......',
      '.....FFFFLSSSSSLFFFFSSs.','......fFFSSSSSSFFfSSSs..',
      '.......sSSSSSSSsSSSSSs..','.......sSSSsSSSSSSSSs...',
      '.......sSSSsSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......bBBYYBBb.........',
      '.........PPPpPPP........','.........PPPpPPP........',
      '.........PP..PP.........','........KKK..KKK........'
    ]
  ]},

  // ATTACK-SMASH — 3 frames. Axe raised STRAIGHT UP overhead → held → bring down.
  // F2 brings the axe head BELOW the body (overlap with legs/boots region).
  attackSmash: { fps: 7, loop: false, frames: [
    [ // F0 — axe up high
      '..........MMMM..........','.........MMmmMM.........',
      '..........MMMM..........','...........WW...........',
      '...........WW...........','...........WW...........',
      '...........WW...........','...........WW...........',
      '...........WW...........','.........HHHHHH.........',
      '........hHHHHHHHh.......','........hhhhhhhhh.......',
      '........RRRRRRRRR.......','........hhhhhhhhh.......',
      '.........hhhhhhh........','......FFFLSSSSLFFF......',
      '.....FFFFLSSSSSLFFFF....','......fFFSSSSSSFFf......',
      '.......sSSSSSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......bBBYYBBb.........',
      '.........PPPpPPP........','.........PPPpPPP........',
      '.........PP..PP.........','........KKK..KKK........'
    ],
    [ // F1 — held high, body braced (knees bent — pants compressed)
      '..........MMMM..........','.........MMmmMM.........',
      '..........MMMM..........','...........WW...........',
      '...........WW...........','...........WW...........',
      '...........WW...........','...........WW...........',
      '...........WW...........','.........HHHHHH.........',
      '........hHHHHHHHh.......','........hhhhhhhhh.......',
      '........RRRRRRRRR.......','........hhhhhhhhh.......',
      '.........hhhhhhh........','......FFFLSSSSLFFF......',
      '.....FFFFLSSSSSLFFFF....','......fFFSSSSSSFFf......',
      '.......sSSSSSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......bBBYYBBb.........',
      '.........PPPpPPP........','.........PP..PP.........',
      '........KKK..KKK........','........KKK..KKK........'
    ],
    [ // F2 — strike down (axe head now in front of body, cells at lower rows)
      '........................','........................',
      '........................','........................',
      '........................','.........HHHHHH.........',
      '........hHHHHHHHh.......','........hhhhhhhhh.......',
      '........RRRRRRRRR.......','........hhhhhhhhh.......',
      '.........hhhhhhh........','......FFFLSSSSLFFF......',
      '.....FFFFLSSSSSLFFFF....','......fFFSSSSSSFFf......',
      '.......sSSSSSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......bBBYYBBb.........',
      '.........PPPpPPP........','.........PPPpPPP........',
      '.........PP..PP.........','........KKK..KKK........',
      '..........MMMM..........','.........MMmmMM.........'
    ]
  ]},

  // ATTACK-BARE — 2 frames. No axe shown. Right shoulder twists forward, fist
  // extends past sprite edge.
  attackBare: { fps: 8, loop: false, frames: [
    [ // F0 — jab forward (axe omitted, skin cells extend right)
      '........................','........................',
      '........................','........................',
      '........................','........................',
      '........................','........................',
      '........................','.........HHHHHH.........',
      '........hHHHHHHHh.......','........hhhhhhhhh.......',
      '........RRRRRRRRR.......','........hhhhhhhhh.......',
      '.........hhhhhhh........','......FFFLSSSSLFFF......',
      '.....FFFFLSSSSSLFFFFSSs.','......fFFSSSSSSFFfSSSSs.',
      '.......sSSSSSSSsSSSSSSs.','.......sSSSsSSSSSSSSSs..',
      '.......sSSSsSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......bBBYYBBb.........',
      '.........PPPpPPP........','.........PPPpPPP........',
      '.........PP..PP.........','........KKK..KKK........'
    ],
    [ // F1 — reset (axe still omitted — bare-handed posture)
      '........................','........................',
      '........................','........................',
      '........................','........................',
      '........................','........................',
      '........................','.........HHHHHH.........',
      '........hHHHHHHHh.......','........hhhhhhhhh.......',
      '........RRRRRRRRR.......','........hhhhhhhhh.......',
      '.........hhhhhhh........','......FFFLSSSSLFFF......',
      '.....FFFFLSSSSSLFFFF....','......fFFSSSSSSFFf......',
      '.......sSSSSSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......bBBYYBBb.........',
      '.........PPPpPPP........','.........PPPpPPP........',
      '.........PP..PP.........','........KKK..KKK........'
    ]
  ]},

  // DRINK — 2 frames. Right hand raises a pale potion bottle ('V') near the face.
  drink: { fps: 5, loop: false, frames: [
    [ // F0 — bottle raised at shoulder height
      '........................','........................',
      '.................MM.....','................MMmM....',
      '................MmmM....','................MMmM....',
      '................MMMM....','...............WWW......',
      '..............WWW.......','.........HHHHHH...VV....',
      '........hHHHHHHHh.VVV...','........hhhhhhhhh.VV....',
      '........RRRRRRRRR.VV....','........hhhhhhhhh.VV....',
      '.........hhhhhhh........','......FFFLSSSSLFFF......',
      '.....FFFFLSSSSSLFFFF....','......fFFSSSSSSFFf......',
      '.......sSSSSSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......bBBYYBBb.........',
      '.........PPPpPPP........','.........PPPpPPP........',
      '.........PP..PP.........','........KKK..KKK........'
    ],
    [ // F1 — bottle at face height (head tilted up)
      '........................','.........HHHHHH..VV.....',
      '........hHHHHHHHh.VVV...','........hhhhhhhhh.VV....',
      '........RRRRRRRRR.VV....','........hhhhhhhhh.VV....',
      '.........hhhhhhh........','.................MM.....',
      '................MMmM....','................MmmM....',
      '................MMmM....','................MMMM....',
      '...............WWW......','..............WWW.......',
      '......FFFLSSSSLFFF......','.....FFFFLSSSSSLFFFF....',
      '......fFFSSSSSSFFf......','.......sSSSSSSSs........',
      '.......sSSSsSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......sSSSsSSSs........',
      '.......bBBYYBBb.........','.........PPPpPPP........',
      '.........PPPpPPP........','.........PP..PP.........',
      '........KKK..KKK........','........................'
    ]
  ]},

  // EQUIP-PICKUP — 2 frames. Crouch (head + body shifted down, hands at lower rows) → rise.
  equipPickup: { fps: 6, loop: false, frames: [
    [ // F0 — crouch (whole figure shifted DOWN ~5 rows + skin hands visible at bottom)
      '........................','........................',
      '........................','........................',
      '........................','.................MM.....',
      '................MMmM....','................MmmM....',
      '................MMmM....','................MMMM....',
      '..........HHHHHH........','.........hHHHHHHHh......',
      '.........hhhhhhhhh......','.........RRRRRRRRR......',
      '.........hhhhhhhhh......','..........hhhhhhh.......',
      '......FFFLSSSSLFFF......','......fFFSSSSSSFFf......',
      '.......sSSSSSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......sSSSsSSSs........',
      '.......bBBYYBBb.........','.........PPPpPPP........',
      '......sssPPPpPPPsss.....','.....sss.PP..PP.sss.....',
      '....sss.................','...sss..................'
    ],
    [ // F1 — rising (≈ idle posture)
      '........................','........................',
      '.................MM.....','................MMmM....',
      '................MmmM....','................MMmM....',
      '................MMMM....','...............WWW......',
      '..............WWW.......','.........HHHHHH.........',
      '........hHHHHHHHh.......','........hhhhhhhhh.......',
      '........RRRRRRRRR.......','........hhhhhhhhh.......',
      '.........hhhhhhh........','......FFFLSSSSLFFF......',
      '.....FFFFLSSSSSLFFFF....','......fFFSSSSSSFFf......',
      '.......sSSSSSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......bBBYYBBb.........',
      '.........PPPpPPP........','.........PPPpPPP........',
      '.........PP..PP.........','........KKK..KKK........'
    ]
  ]},

  // HURT — 2 frames. Sprite shifted LEFT 2 cols, headband flares 'X' (pink-red flash).
  hurt: { fps: 8, loop: false, frames: [
    [ // F0 — staggered left, headband bright
      '........................','........................',
      '...............MM.......','..............MMmM......',
      '..............MmmM......','..............MMmM......',
      '..............MMMM......','.............WWW........',
      '............WWW.........','.......HHHHHH...........',
      '......hHHHHHHHh.........','......hhhhhhhhh.........',
      '......XXXXXXXXX.........','......hhhhhhhhh.........',
      '.......hhhhhhh..........','....FFFLSSSSLFFF........',
      '...FFFFLSSSSSLFFFF......','....fFFSSSSSSFFf........',
      '.....sSSSSSSSs..........','.....sSSSsSSSs..........',
      '.....sSSSsSSSs..........','.....sSSSsSSSs..........',
      '.....sSSSsSSSs..........','.....bBBYYBBb...........',
      '.......PPPpPPP..........','.......PPPpPPP..........',
      '.......PP..PP...........','......KKK..KKK..........'
    ],
    [ // F1 — recovery (idle posture, headband returns to normal red)
      '........................','........................',
      '.................MM.....','................MMmM....',
      '................MmmM....','................MMmM....',
      '................MMMM....','...............WWW......',
      '..............WWW.......','.........HHHHHH.........',
      '........hHHHHHHHh.......','........hhhhhhhhh.......',
      '........RRRRRRRRR.......','........hhhhhhhhh.......',
      '.........hhhhhhh........','......FFFLSSSSLFFF......',
      '.....FFFFLSSSSSLFFFF....','......fFFSSSSSSFFf......',
      '.......sSSSSSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......sSSSsSSSs........',
      '.......sSSSsSSSs........','.......bBBYYBBb.........',
      '.........PPPpPPP........','.........PPPpPPP........',
      '.........PP..PP.........','........KKK..KKK........'
    ]
  ]}
};

// Player module — orchestrates which animation is currently playing.
// Looping animations (idle) just render. Non-looping animations (loop:false)
// run once, then auto-revert to idle and call the optional onComplete callback.
// If state.options.anim is OFF, play() skips the animation but still calls
// onComplete immediately so cutscene flow is unaffected.
const Player = (() => {
  let layerEl = null;
  let bobEl = null;
  let currentAnim = null;
  let animTimer = null;

  function ensure() {
    if (!layerEl) layerEl = document.getElementById('player-layer');
    if (!bobEl)   bobEl   = document.getElementById('player-bob');
  }

  function _writeSprite(animName) {
    ensure();
    if (!bobEl) return;
    const anim = PLAYER_PX[animName];
    if (!anim) return;
    bobEl.innerHTML = pixelSpriteSheet(anim.frames, PLAYER_PALETTE, 100, {
      fps: anim.fps || 5,
      loop: anim.loop !== false
    });
    currentAnim = animName;
  }

  function render(animName) {
    clearTimeout(animTimer);
    _writeSprite(animName);
  }

  function play(animName, onComplete) {
    const anim = PLAYER_PX[animName];
    if (!anim) { if (onComplete) onComplete(); return; }
    if (state.options.anim === false) {
      // Animations off — skip the visual but still progress the cutscene flow.
      if (onComplete) onComplete();
      return;
    }
    clearTimeout(animTimer);
    _writeSprite(animName);
    if (anim.loop === false) {
      const dur = (anim.frames.length / (anim.fps || 5)) * 1000;
      animTimer = setTimeout(() => {
        // Only revert to idle if no other anim has been started since.
        if (currentAnim === animName) _writeSprite('idle');
        if (onComplete) onComplete();
      }, dur);
    } else {
      // Looping anim: invoke completion immediately (caller drives next state).
      if (onComplete) onComplete();
    }
  }

  function show() { ensure(); if (layerEl) layerEl.style.display = ''; }
  function hide() { ensure(); if (layerEl) layerEl.style.display = 'none'; }

  // Mount the equipped weapon on the player's back. Persistent (not animated):
  // the cutscene's weapon-trail is a separate transient element. Whenever
  // state.weapon changes, callers (renderWeapon, newGame) call this to sync.
  function renderEquippedWeapon() {
    const wep = document.getElementById('player-weapon');
    if (!wep) return;
    if (state.weapon) {
      wep.innerHTML = weaponSvg(state.weapon.value, { staticPose: true });
      wep.classList.remove('empty');
    } else {
      wep.innerHTML = '';
      wep.classList.add('empty');
    }
  }

  return { render, play, show, hide, renderEquippedWeapon };
})();

// =============================================================
// CUTSCENE — Pokemon-style battle/action cinematic
// =============================================================
// Six choreographies share one orchestrator. Each archetype has totalMs
// (full cutscene duration), hitMs (impact frame inside totalMs), and a
// playerAnim that the Player module runs in parallel with weapon-trail and
// hit-spark VFX. State mutations (HP, weapon, deck) happen at hitMs in the
// caller-supplied onImpact callback — so a mid-cutscene skip resolves to
// the same end state as the un-skipped cutscene.
const CUTSCENE_TIMINGS = {
  pierce: { totalMs: 1400, hitMs: 700, playerAnim: 'attackPierce' },
  slash:  { totalMs: 1500, hitMs: 720, playerAnim: 'attackSlash'  },
  smash:  { totalMs: 1700, hitMs: 840, playerAnim: 'attackSmash'  },
  bare:   { totalMs: 1300, hitMs: 580, playerAnim: 'attackBare'   },
  drink:  { totalMs: 1300, hitMs: 700, playerAnim: 'drink'        },
  equip:  { totalMs: 1100, hitMs: 600, playerAnim: 'equipPickup'  }
};

// Maps a weapon's card value to its attack archetype (cutscene choreography
// + sprite animation). v0.5.5 — re-mapped to match the v0.5.3 weapon roster:
//   2 dagger / 3 short sword       → pierce  (thrust forward)
//   4 scimitar / 5 long sword /
//   8 battle axe / 10 great sword  → slash   (sweeping swing)
//   6 mace / 7 war hammer /
//   9 great mace                   → smash   (overhead crush)
function weaponArchetype(weaponValue) {
  if (weaponValue === 2 || weaponValue === 3) return 'pierce';
  if (weaponValue === 4 || weaponValue === 5 || weaponValue === 8 || weaponValue === 10) return 'slash';
  return 'smash';   // 6 mace, 7 war hammer, 9 great mace
}

const Cutscene = (() => {
  let active = false;
  let timers = [];
  let pending = null;          // { slotIndex, action, callbacks }
  let impactFired = false;
  let weaponTrailEl = null;
  let clickSkipHandler = null;

  function _setStaging(slotIndex, on) {
    const targetSlot = $('slot-' + slotIndex);
    if (on) {
      document.body.classList.add('cutscene-active');
      qsa('.card-slot').forEach(s => {
        if (s === targetSlot) s.classList.add('cutscene-target');
        else                  s.classList.add('cutscene-dim');
      });
    } else {
      document.body.classList.remove('cutscene-active');
      qsa('.card-slot').forEach(s => {
        s.classList.remove('cutscene-target', 'cutscene-dim');
      });
    }
  }

  function _spawnWeaponTrail(weapon, archetype) {
    if (!weapon) return null;
    const layer = $('player-layer');
    if (!layer) return null;
    const trail = document.createElement('div');
    trail.className = 'weapon-trail weapon-trail-' + archetype;
    trail.innerHTML = weaponSvg(weapon.value, { staticPose: true });
    layer.appendChild(trail);
    return trail;
  }

  function _spawnHitSpark(slotIndex, archetype) {
    const slot = $('slot-' + slotIndex);
    if (!slot) return;
    const card = qs('.card', slot);
    if (!card) return;
    const spark = document.createElement('div');
    spark.className = 'hit-spark hit-spark-' + archetype;
    card.appendChild(spark);
    setTimeout(() => spark.remove(), 380);
  }

  function _shakeArena() {
    const arena = qs('.dungeon-arena');
    if (!arena) return;
    arena.classList.add('arena-shake');
    setTimeout(() => arena.classList.remove('arena-shake'), 360);
  }

  function _bypass(slotIndex, action, callbacks) {
    // Quick mode (and anim-off Adventure) — resolve fast so tap-tap-tap
    // queues smoothly. v0.5.6 cut both timeouts ~3x: impact at 80ms (just
    // long enough for the flash/shake to register), end at 220ms.
    const a = action.archetype;
    if (a === 'pierce' || a === 'slash' || a === 'smash' || a === 'bare') shakeCard(slotIndex);
    else if (a === 'drink') flashCard(slotIndex, 'flash-heal');
    else if (a === 'equip') flashCard(slotIndex, 'flash-equip');
    setTimeout(() => {
      if (callbacks.onImpact) callbacks.onImpact();
    }, 80);
    setTimeout(() => {
      if (callbacks.onEnd) callbacks.onEnd();
    }, 220);
  }

  function play(slotIndex, action, callbacks) {
    if (active) return;
    // Quick Play has no trainer / weapon-trail / dash; resolve immediately with
    // the lightweight card-only feedback (flash + shake) reused from anim-off.
    if (state.mode === 'quick' || !state.options.anim) {
      _bypass(slotIndex, action, callbacks);
      return;
    }
    // Adventure mode: trainer physically walks up to the entity. Inline
    // transform is set BEFORE Player.play(dashIn) is invoked below so the CSS
    // transition kicks in during the dash animation.
    if (state.mode === 'adventure') {
      walkPlayerToEntity(slotIndex);
    }

    const timing = CUTSCENE_TIMINGS[action.archetype] || CUTSCENE_TIMINGS.bare;
    active = true;
    impactFired = false;
    pending = { slotIndex, action, callbacks };
    timers = [];

    _setStaging(slotIndex, true);

    // v0.6.0 — apply an archetype-specific glow filter on the player-layer
    // for the duration of the cutscene (CSS .action-* rules above).
    const playerLayer = qs('.player-layer');
    if (playerLayer) {
      playerLayer.classList.remove('action-attack', 'action-drink', 'action-equip');
      const a = action.archetype;
      if (a === 'drink')      playerLayer.classList.add('action-drink');
      else if (a === 'equip') playerLayer.classList.add('action-equip');
      else                    playerLayer.classList.add('action-attack');
    }

    // Player animation — dash in first, then the archetype attack.
    Player.play('dashIn', () => {
      // After dashIn completes, kick off the main attack pose.
      // Guard: if cutscene was skipped during dashIn, bail.
      if (!active) return;
      if (action.archetype === 'bare') {
        // bare-hand: punch flurry x2 cycles
        Player.play('attackBare', () => {
          if (active) Player.play('attackBare');
        });
      } else {
        Player.play(timing.playerAnim);
      }
    });

    // Weapon trail composited at player's hand position.
    if (action.weapon && (action.archetype === 'pierce' || action.archetype === 'slash' || action.archetype === 'smash' || action.archetype === 'equip')) {
      // Dash takes 240ms; the weapon trail starts when the attack does.
      timers.push(setTimeout(() => {
        if (!active) return;
        weaponTrailEl = _spawnWeaponTrail(action.weapon, action.archetype === 'equip' ? 'equip' : action.archetype);
      }, 240));
    }

    // Impact frame — state mutation, audio, hit-spark, screen-shake.
    timers.push(setTimeout(() => fireImpact(), timing.hitMs));

    // End-of-cutscene — cleanup, consume card, advance.
    timers.push(setTimeout(() => finish(), timing.totalMs));

    // Click-anywhere-to-skip — registered after a small delay so the click
    // that initiated the cutscene doesn't immediately skip it.
    timers.push(setTimeout(() => {
      if (!active) return;
      clickSkipHandler = (ev) => {
        if (!active) return;
        Cutscene.skip();
        ev.preventDefault();
        ev.stopImmediatePropagation();
      };
      document.addEventListener('click', clickSkipHandler, { capture: true });
    }, 220));
  }

  function fireImpact() {
    if (!active || impactFired || !pending) return;
    impactFired = true;
    const { slotIndex, action, callbacks } = pending;
    if (callbacks.onImpact) callbacks.onImpact();
    // VFX on the target card
    if (action.archetype === 'pierce' || action.archetype === 'slash' || action.archetype === 'smash' || action.archetype === 'bare') {
      _spawnHitSpark(slotIndex, action.archetype);
      if (action.archetype === 'smash') _shakeArena();
    }
  }

  function finish() {
    if (!active || !pending) return;
    if (!impactFired) fireImpact();
    const { slotIndex, callbacks } = pending;
    timers.forEach(t => clearTimeout(t));
    timers = [];
    if (clickSkipHandler) {
      document.removeEventListener('click', clickSkipHandler, { capture: true });
      clickSkipHandler = null;
    }
    _setStaging(slotIndex, false);
    if (weaponTrailEl) { weaponTrailEl.remove(); weaponTrailEl = null; }
    qsa('.weapon-trail').forEach(el => el.remove());
    qsa('.hit-spark').forEach(el => el.remove());
    // v0.6.0 — clear the action-glow class so the next idle starts clean.
    const playerLayer = qs('.player-layer');
    if (playerLayer) {
      playerLayer.classList.remove('action-attack', 'action-drink', 'action-equip');
    }
    // Adventure mode: walk the trainer back to home position. The same CSS
    // transition that animated the walk-out animates the walk-back.
    if (state.mode === 'adventure') returnPlayerHome();
    active = false;
    pending = null;
    if (callbacks.onEnd) callbacks.onEnd();
  }

  function skip() {
    if (!active) return;
    timers.forEach(t => clearTimeout(t));
    timers = [];
    finish();
  }

  function isActive() { return active; }

  return { play, skip, isActive };
})();

// Tier classes — drive sprite micro-animations defined in styles.css.
function monsterMotion(value) {
  // 2 rat, 3 bat, 4 goblin, 5 kobold, 7 ghoul → quick/jittery
  if (value === 2 || value === 3 || value === 4 || value === 5 || value === 7) return 'anim-quick';
  // 11 wraith, 12 hag → spectral hover
  if (value === 11 || value === 12) return 'anim-eerie';
  // 6 skeleton, 8 orc, 9 troll, 10 wyvern, 13 demon lord, 14 dragon → heavy sway
  return 'anim-heavy';
}

/* ---------- MONSTER SPRITES (16x16) ---------- */
/* color codes:  # = outline   o/O = body main / highlight   d = dark shade
                 e = eye glow  a = accent (weapon/teeth/tusk)
                 m = metal     b = blood/red    g = green glow
                 w = white     y = yellow gold  r = red       k = pink     */

const MONSTER_PX = {

  // 2 — SLIME  (small green blob, low to ground, single eye + glint)
  // v0.5.3 redraw — was RAT. Lowest-tier monster on the user's bestiary
  // ladder. Sits at the bottom of the 16x16 frame so larger sprites stay
  // anchored to the same ground-line.
  2: { sz: 32, c: { '#':'#0a0408','O':'#7eeb44','o':'#5ed432','d':'#2e6a1a','e':'#0a0408','w':'#fff8e0' },
    g: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '......######....',
      '....##OOOOOO##..',
      '...#OoOoOoOoOO#.',
      '..#OoOoOweOoOoO#',
      '.#OoOoOoOoOoOoOd',
      '#OoOoOoOoOoOoOod',
      '#oOoOoOoOoOoOoOd',
      '#OoOoOoOoOoOoOdd',
      '################',
      '................'
    ]},

  // 3 — KOBOLD  (lizardfolk, scaled, tail, horns)
  // v0.5.3 — moved from old slot 5 unchanged.
  3: { sz: 46, c: { '#':'#0a0408','o':'#d65a28','O':'#ff7a38','d':'#6a1e08','e':'#fff200','h':'#3a1608','t':'#fff8e0' },
    g: [
      '................',
      '....#.....#.....',
      '.h.#h#...#h#....',
      '.#h#oOh.#oOh#...',
      '..##oOOoOOoO##..',
      '..#oeoOoOoeoO#..',
      '..#oOttttttoO#..',
      '...#oOoOoOoO#...',
      '..#OOoOOoOoOO#..',
      '.#OoOoOoOoOoOo#.',
      '#oOoOoOoOoOoOoOd',
      '#oOoOoOoOoOoOd##',
      '.#oOoOoOoOoOdd..',
      '..#####OoOO#....',
      '....#o#####.....',
      '....#o#.#o#.....'
    ]},

  // 4 — GOBLIN  (hunched, club, big nose) — kept from prior roster
  4: { sz: 54, c: { '#':'#0a0408','o':'#5ca030','O':'#8ad040','d':'#2e4818','e':'#fff200','n':'#a05a24','a':'#3a2014','w':'#ffffff' },
    g: [
      '................',
      '................',
      '....######......',
      '...#oOOoOOo#....',
      '..#oOOoOOOoOo#..',
      '..#o##oOoOo##o#.',
      '..#oeo#oOo#oeo#a',
      '..#oOnnnnnoOo#a.',
      '...#owwwwwwo#aa.',
      '..#ooOoOoOoOo#a.',
      '.#oOoOoOoOoOoOo#',
      '.#oOoOoOoOoOoOo#',
      '..#o##OoOoOo##o#',
      '..#o#.#oOo#.#o#.',
      '..##...#o#...##.',
      '.......#.#......'
    ]},

  // 5 — ORC  (tusked warrior with axe)
  // v0.5.3 — moved from old slot 8 unchanged.
  5: { sz: 60, c: { '#':'#0a0408','o':'#3e7440','O':'#5fa058','d':'#1a3018','e':'#ff3040','w':'#ffffff','t':'#f4ebd0','a':'#3a2014','m':'#c8d0d8','b':'#7a5028' },
    g: [
      '................',
      '......####......',
      '....##oOOOo##...',
      '...#oOOOOOOOo#..',
      'd##oOoOOOOOOOo#a',
      'd#OoOeOoeOOOOO#a',
      '##oOOddOddOOoO#a',
      '..#OoOoooOoOoO#a',
      '..#OOttoootOOO#a',
      '...#OoOoooOoO#aa',
      '..#OOoOoOoOoOO#a',
      '.#oOoOoOoOoOoOo#',
      '.#oOoOoOoOoOoOo#',
      '.#OoOoOoOoOoOoO#',
      '..##OOoOoOOOO##.',
      '...##........##.'
    ]},

  // 6 — SKELETON WARRIOR
  6: { sz: 62, c: { '#':'#0a0408','o':'#f0e4c0','O':'#fff8e0','d':'#8a7050','e':'#60e8ff','m':'#c0c8d0','M':'#ffffff','s':'#3a2014','b':'#7a5028' },
    g: [
      '................',
      '......####......',
      '.....#oOOo#.....',
      '....#oo##oo#....',
      '....#oeo#oeo#...',
      '....#oOddOo#....',
      '...##oooooo##...',
      'mMMm#oooooo#sss.',
      'mMMm#o####o#sss.',
      'mMMm##oooo##sss.',
      'mMMm#oOoOoo#sss.',
      'mMMm#oOoOoo#sss.',
      '....#oOoOoo#....',
      '....#oo##oo#....',
      '....##....##....',
      '....##....##....'
    ]},

  // 7 — GHOUL  (gaunt, claws, sunken)
  7: { sz: 66, c: { '#':'#0a0408','o':'#4a7050','O':'#7ea868','d':'#1a2818','e':'#a8ff30','t':'#3a3a2a','c':'#a0c8a0' },
    g: [
      '................',
      '......####......',
      '.....#oOOOo#....',
      '....#oOOOOOO#...',
      '....#odeoeOd#...',
      '....#oOoooOO#...',
      '...##oOoeeoO##..',
      '..#oOoooooooOo#.',
      '#cco##OoOoO##cc#',
      'cco.#oOoOoO#.occ',
      'cc..#odoooo#..cc',
      '....#oOoOoo#....',
      '....#oOoOoo#....',
      '....#oo##oo#....',
      '....##....##....',
      '...c##....##c...'
    ]},

  // 8 — WRAITH  (hooded ghost) — moved from old slot 11 unchanged.
  // v0.5.3 — fits between ghoul (7) and troll (9) on the new ladder.
  8: { sz: 70, c: { '#':'#0a0408','o':'#3a2854','O':'#5a3a78','d':'#10081a','e':'#60d8ff','m':'#c0c8d0','M':'#ffffff','b':'#60c8ff' },
    g: [
      '................',
      '......####......',
      '....##oOOOo##...',
      '...#oOoOoOOoO#..',
      '..#oOoddooddoOo#',
      '..#oOdeeeeeedOob',
      '..#oOdMeeeeMdOob',
      '..#oOdeeeeeedOob',
      '..#oOoOoOoOoOoob',
      '...#OoOoOoOoObb#',
      '...#oOoOoObOOOO#',
      '....##OoOoOoOO#.',
      '...#.##.##.##.#.',
      '..#.##.##.##.##.',
      '...#..#..#..#...',
      '................'
    ]},

  // 9 — TROLL  (huge lumpy)
  9: { sz: 76, c: { '#':'#0a0408','o':'#6a4080','O':'#9858b8','d':'#1a1424','e':'#ffc020','b':'#3a2050','t':'#f4ebd0','c':'#a0c8a0' },
    g: [
      '................',
      '......####......',
      '....##oOOOo##...',
      '...#oeOdOdOe#...',
      'cc.#oOOoooOOo#cc',
      'c.##OttoootOO##c',
      '.##oOoOoOoOoOo##',
      '##oObOoOoOoObOo#',
      '#oOoOoObOoObOoOo',
      '#oObOoOoOoOoObOo',
      '#oOoOoOoOoOoOoOo',
      '##OoOoOoOoOoOO##',
      '.##OoOoOoOoOO#..',
      '..####OoOo####..',
      '....##....##....',
      '....##....##....'
    ]},

  // 10 — MINOTAUR  (bull-headed warrior, sweeping horns, broad shoulders)
  // v0.5.3 redraw — was WYVERN. Top-of-numerics on the new ladder; hulking
  // silhouette signals the turn from "men" to "monsters" at J+.
  10: { sz: 78, c: { '#':'#0a0408','o':'#a04018','O':'#e06028','d':'#3a1408','e':'#ff3040','t':'#fff8e0','b':'#3a1f10','m':'#c0c8d0' },
    g: [
      '................',
      '.tt..........tt.',
      'ttt#.######..#tt',
      '#tt##oOOOOo##tt#',
      '##oOOoOoOoOOOo##',
      '#oOoOeOoOeOoOOo#',
      '#oOoOdOttOdOOOo#',
      '#oOoOOttttOoOoO#',
      '##oOooOOOOoooO##',
      '##oOoOoOoOoOoO##',
      '#oOoOoOoOoOoOoO#',
      '#oOoOoOoOoOoOoO#',
      '#OoOoOoOoOoOoOo#',
      '##OoOoOoOoOoOO##',
      '..##bb#####bb##.',
      '..##bb..bb.##bb.'
    ]},

  // 11 (J) — MIMIC  (treasure chest with teeth + tongue + glowing eye)
  // v0.5.3 redraw — was WRAITH. Classic dungeon-crawler trickster: looks like
  // a chest, opens up to reveal jagged teeth and a long tongue.
  11: { sz: 72, c: { '#':'#0a0408','o':'#7a7a82','O':'#b0b8c0','d':'#2a2a30','t':'#fff8e0','e':'#60d8ff','y':'#ffd83a','w':'#ffffff','r':'#ff3040' },
    g: [
      '................',
      '................',
      '..############..',
      '.#OoOyyyyyyOoO#.',
      '.#OoOttttttOoO#.',
      '.#Otetwttwtetto#',
      '.#OttttreettttO#',
      '.#Ottwwrrrrwwtt#',
      '.#OttdddrrdddtO#',
      '.#OoOoyyyyOoOoO#',
      '.#OoOoOoOoOoOoO#',
      '.#OoOoOoOyOoOoO#',
      '.#OoOoOoOoOoOoO#',
      '.##############.',
      '..##.bb..bb.##..',
      '...........#....'
    ]},

  // 12 (Q) — SUCCUBUS  (winged demon, horns, hourglass silhouette)
  // v0.5.3 redraw — was HAG. Sharp-tipped wings flank the figure, small horns
  // on the head, slender torso narrowing to hips for the classic silhouette.
  12: { sz: 80, c: { '#':'#0a0408','o':'#c8327a','O':'#ff4aa0','d':'#4a0a28','e':'#fff200','t':'#fff0d4','w':'#7a1838','y':'#ffd83a','b':'#3a1620' },
    g: [
      '...##.....##....',
      '..#oo#...#oo#...',
      '#wwoOo#.#oOoww#.',
      '#wwoOoo#oOoOoww#',
      '#wwOoOoOoOoOoww#',
      '##oOttooootOoO##',
      '.#OttoeooeotOO#.',
      '.#OttoddddotOO#.',
      '.#OoOoOttoOoOO#.',
      '.#OoOoOoOoOoOO#.',
      '..#OoOoOoOoOoO#.',
      '..#OoOoOoOoOO#..',
      '...#OoOoOoOO#...',
      '...#OoOoOoOO#...',
      '....#bb..bb#....',
      '....##....##....'
    ]},

  // 13 (K) — OGRE  (huge brute, club, slack jaw, single eye)
  // v0.5.3 redraw — was DEMON LORD. Squat, broad-shouldered, with a massive
  // club resting against the body. Reads as "big stupid muscle".
  13: { sz: 88, c: { '#':'#0a0408','o':'#2a8030','O':'#3eb848','d':'#1a3a08','e':'#fff200','t':'#fff8e0','b':'#3a1f10','y':'#ffd83a','w':'#ffffff' },
    g: [
      '......####......',
      '....##oOOOo##...',
      '...#oOOOOOOOo#..',
      '..#oOoOOOOOOOo#.',
      '##oOoeOdttOOOoO#',
      '#oOoOdOttttOoOO#',
      '#OoOoOOttbbOoOOb',
      '#oOoOoOoOoOoOob#',
      '#oOoOoOoOoOoOob#',
      '#oOoOoOoOoOoOob#',
      '#OoOoOoOoOoOoOb#',
      '#oOoOoOoOoOoOoOb',
      '#OoOoOoOoOoOoOob',
      '##OoOoOoOoOoOO##',
      '..##bb#####bb##.',
      '..##bb..bb.##bb.'
    ]},

  // 14 (A) — ANCIENT DRAGON  (full beast)
  14: { sz: 130, c: { '#':'#0a0408','o':'#1a0a04','O':'#3a1a10','d':'#050204','e':'#ff5018','y':'#ffae20','w':'#7a2008','t':'#fff5d4','s':'#050204','b':'#ff6a08' },
    g: [
      'w...........w...',
      'wwd........wwd..',
      'wwddd.....wwddd.',
      '#wwddOd.OOddww#.',
      '#wOdOdooooOdOw#.',
      '#wOddOoOoOoddOw#',
      '##OoOoeOoeOoOOw#',
      '.#OodOoOOOOdoOw#',
      '..##oOOOOOOOoOw#',
      '...#OoOoOoOoO#w.',
      '...#oOoOoOoOd#..',
      '...#oOoOoOoO#...',
      '....#OoOoOO#bbb.',
      '.....##OO##.bbbb',
      '....s#.bb#.s.bbb',
      '....s..bb..s....'
    ]}
};

const WEAPON_PX = {

  // 2 — DAGGER  (small, centered)
  2: { sz: 36, c: { '#':'#0a0408','b':'#c0c8d0','B':'#ffffff','h':'#7a5028','H':'#3a2616','y':'#ffd83a' },
    g: [
      '................',
      '................',
      '................',
      '................',
      '.......##.......',
      '......#bB#......',
      '......#bB#......',
      '......#bB#......',
      '.....#bbBB#.....',
      '....#yyyyyy#....',
      '......#hH#......',
      '......#hH#......',
      '......#yy#......',
      '................',
      '................',
      '................'
    ]},

  // 3 — SHORT SWORD
  3: { sz: 44, c: { '#':'#0a0408','b':'#c0c8d0','B':'#ffffff','h':'#7a5028','H':'#3a2616','y':'#ffd83a' },
    g: [
      '................',
      '................',
      '......##........',
      '......#bB#......',
      '......#bB#......',
      '......#bB#......',
      '......#bB#......',
      '......#bB#......',
      '....#yyBByy#....',
      '....##.##.##....',
      '......#hH#......',
      '......#hH#......',
      '......#hH#......',
      '......#yy#......',
      '......##.#......',
      '................'
    ]},

  // 4 — SCIMITAR  (curved single-edged blade, hilt at bottom-left)
  // v0.5.3 redraw — was HAND AXE. Curve sweeps up-right from the hilt.
  4: { sz: 50, c: { '#':'#0a0408','b':'#c0c8d0','B':'#ffffff','h':'#7a5028','H':'#3a2616','y':'#ffd83a' },
    g: [
      '................',
      '............##..',
      '...........#bB#.',
      '..........#bBBb#',
      '.........#bBBBb#',
      '........#bBBBb#.',
      '.......#bBBBb#..',
      '......#bBBBb#...',
      '.....#bBBb#.....',
      '....#bBBb#......',
      '...#bBb#........',
      '..#bb#..........',
      '..#y##..........',
      '..#hH#..........',
      '..#hH#..........',
      '..#yy#..........'
    ]},

  // 5 — LONG SWORD  (slim straight blade, value-mid)
  // v0.5.3 — moved from old slot 6.
  5: { sz: 56, c: { '#':'#0a0408','b':'#c0c8d0','B':'#ffffff','h':'#7a5028','H':'#3a2616','y':'#ffd83a','r':'#ff3040' },
    g: [
      '......##........',
      '......#bB#......',
      '......#bB#......',
      '......#bB#......',
      '......#bB#......',
      '......#bB#......',
      '......#bB#......',
      '......#bB#......',
      '...#yyyBByyy#...',
      '..##.##.##.##...',
      '......#hH#......',
      '......#hH#......',
      '......#hH#......',
      '.....#yyrr#.....',
      '......#yy#......',
      '................'
    ]},

  // 6 — MACE  (flanged head)
  // v0.5.3 — moved from old slot 5. Pairs with 9 GREAT MACE: same family,
  // scaled up at the top of the ladder.
  6: { sz: 64, c: { '#':'#0a0408','b':'#c0c8d0','B':'#ffffff','d':'#4a5868','h':'#7a5028','H':'#3a2616','y':'#ffd83a' },
    g: [
      '................',
      '......##........',
      '.....#bB#.......',
      '....##bBB##.....',
      '...#bdBBBdb#....',
      '..#bBBBBBBBb#...',
      '..#dBBBbBBBd#...',
      '...#bBBBBBb#....',
      '....##bBB##.....',
      '......#hH#......',
      '......#hH#......',
      '......#hH#......',
      '......#hH#......',
      '......#hH#......',
      '.....#yyyy#.....',
      '................'
    ]},

  // 7 — WAR HAMMER
  7: { sz: 70, c: { '#':'#0a0408','b':'#c0c8d0','B':'#ffffff','d':'#4a5868','h':'#7a5028','H':'#3a2616','y':'#ffd83a' },
    g: [
      '................',
      '...########.....',
      '..#bBBBBBBb#....',
      '..#bBBdBdBb#####',
      '..#dBBBBBBd#bBb#',
      '..#bBBdBdBb#bBb#',
      '..#bBBBBBBb###b#',
      '...#####ddd##b##',
      '......#hH#......',
      '......#hH#......',
      '......#hH#......',
      '......#hH#......',
      '......#hH#......',
      '......#hH#......',
      '.....#yyyy#.....',
      '................'
    ]},

  // 8 — BATTLE AXE  (bigger axe head)
  8: { sz: 78, c: { '#':'#0a0408','b':'#c0c8d0','B':'#ffffff','d':'#4a5868','h':'#7a5028','H':'#3a2616','y':'#ffd83a' },
    g: [
      '................',
      '....##....####..',
      '...#bB#..#bBBb#.',
      '..#bBBB##bBBBBb#',
      '.#bBBBBBBBBBBBd#',
      '#bBBBBdBBBdBBBb#',
      '#dBBBBBBBBBBBBd#',
      '.#bBBBBBBBBBBd#.',
      '..#bBBBBBBBBb#..',
      '...#######HH#...',
      '......#hH#......',
      '......#hH#......',
      '......#hH#......',
      '......#hH#......',
      '.....#yyyy#.....',
      '................'
    ]},

  // 9 — GREAT MACE  (oversized flanged head, spike top, broad pommel)
  // v0.5.3 redraw — was GREATSWORD. Bigger sibling of slot 6 MACE — same
  // weapon family, dramatically scaled.
  9: { sz: 86, c: { '#':'#0a0408','b':'#c0c8d0','B':'#ffffff','d':'#4a5868','h':'#7a5028','H':'#3a2616','y':'#ffd83a' },
    g: [
      '......####......',
      '....##bBBb##....',
      '...#bBBBBBBb#...',
      '..#bBBBBBBBBb#..',
      '..#bBBBdBdBBb#..',
      '..#dBBBBBBBBd#..',
      '..#bBBBdBdBBb#..',
      '..#bBBBBBBBBb#..',
      '...#bBBBBBBb#...',
      '....##bBBb##....',
      '......#hH#......',
      '......#hH#......',
      '......#hH#......',
      '......#hH#......',
      '......#hH#......',
      '.....#yyyy#.....'
    ]},

  // 10 — GREAT SWORD  (very long blade, ornate fuller, jewelled pommel)
  // v0.5.3 — was GREAT AXE; replaced with the longer-blade design from old
  // slot 9 (the original GREATSWORD), now extended further.
  10: { sz: 96, c: { '#':'#0a0408','b':'#c0c8d0','B':'#ffffff','d':'#4a5868','h':'#7a5028','H':'#3a2616','y':'#ffd83a','r':'#60c8ff' },
    g: [
      '......##........',
      '......#bB#......',
      '......#bB#......',
      '......#bB#......',
      '......#bB#......',
      '......#bB#......',
      '......#bB#......',
      '......#bB#......',
      '......#bB#......',
      '......#bB#......',
      '..#yyyyBByyyy#..',
      '.##.##.##.##.##.',
      '......#hH#......',
      '......#hH#......',
      '....#yyrryy#....',
      '....##.##.##....'
    ]}
};

const POTION_PX = {

  // 2 — TINY VIAL
  2: { sz: 38, c: { '#':'#0a0408','c':'#5a3818','y':'#ffd83a','r':'#ff8aa0','R':'#c52828','w':'#ffffff' },
    g: [
      '................',
      '................',
      '................',
      '................',
      '.......##.......',
      '......#cc#......',
      '......#cc#......',
      '......#yy#......',
      '......#rr#......',
      '......#wR#......',
      '......#rR#......',
      '......#rR#......',
      '......#rR#......',
      '......####......',
      '................',
      '................'
    ]},

  // 3 — ROUND FLASK (small)
  3: { sz: 44, c: { '#':'#0a0408','c':'#5a3818','y':'#ffd83a','r':'#ff8aa0','R':'#c52828','w':'#ffffff' },
    g: [
      '................',
      '................',
      '................',
      '.......##.......',
      '.....#cc#.......',
      '.....#cc#.......',
      '....#yyyy#......',
      '....#rrRR#......',
      '...##rwRR##.....',
      '..#rrrrRRRR#....',
      '..#rrrrRRRR#....',
      '..#rrrrRRRR#....',
      '...##rrRR##.....',
      '.....####.......',
      '................',
      '................'
    ]},

  // 4 — FLAT FLASK
  4: { sz: 50, c: { '#':'#0a0408','c':'#5a3818','y':'#ffd83a','r':'#ff8aa0','R':'#c52828','w':'#ffffff' },
    g: [
      '................',
      '................',
      '......##........',
      '......#cc#......',
      '......#cc#......',
      '.....#yyyy#.....',
      '....##rRrR##....',
      '...#rrRwRRRr#...',
      '..#rrRRRRRRRr#..',
      '..#rrRRRRRRRr#..',
      '..#rrRRRRRRRr#..',
      '..#rrRRRRRRRr#..',
      '...#rrRRRRRr#...',
      '....##rRrR##....',
      '......####......',
      '................'
    ]},

  // 5 — CONICAL
  5: { sz: 56, c: { '#':'#0a0408','c':'#5a3818','y':'#ffd83a','r':'#ff8aa0','R':'#c52828','w':'#ffffff' },
    g: [
      '................',
      '......##........',
      '......#cc#......',
      '......#cc#......',
      '.....#yyyy#.....',
      '.....#rrRR#.....',
      '....##rwRR##....',
      '....#rRRRRRr#...',
      '...#rrRRRRRRr#..',
      '..#rrRRRRRRRRr#.',
      '.#rrRRRRRRRRRRr#',
      '#rrRRRRRRRRRRRr#',
      '#rrRRRRRRRRRRRr#',
      '##rRRRRRRRRRRR##',
      '################',
      '................'
    ]},

  // 6 — STANDARD FLASK
  6: { sz: 62, c: { '#':'#0a0408','c':'#5a3818','y':'#ffd83a','r':'#ff8aa0','R':'#c52828','w':'#ffffff' },
    g: [
      '................',
      '......##........',
      '......#cc#......',
      '......#cc#......',
      '.....#yyyy#.....',
      '.....#yyyy#.....',
      '....#rrRRRr#....',
      '...#rrwRRRRr#...',
      '..#rrRRRRRRRr#..',
      '.#rrRRRRRRRRRr#.',
      '.#rrRRRRRRRRRr#.',
      '.#rrRRRRRRRRRr#.',
      '.#rrRRRRRRRRRr#.',
      '..#rrRRRRRRRr#..',
      '...##rrRRRr##...',
      '.....######.....'
    ]},

  // 7 — ENCHANTED (with sparkles)
  7: { sz: 68, c: { '#':'#0a0408','c':'#5a3818','y':'#ffd83a','r':'#ff8aa0','R':'#c52828','w':'#ffffff','s':'#fff200' },
    g: [
      '......s.s.......',
      '.s....##........',
      '......#cc#...s..',
      '..s..#yyyy#.....',
      '....#yywwyy#....',
      '....#rrRRRr#.s..',
      's..#rrRRRRRr#...',
      '..#rrRRsRRRRr#..',
      '.#rrRRRRRRRRRr#.',
      '.#rrRsRRRRsRRr#.',
      '.#rrRRRRRRRRRr#.',
      '.#rrRRRRsRRRRr#.',
      '.#rrRRRRRRRRRr#.',
      '..#rrRRRRRRRr#..',
      '...##rrRRRr##...',
      '.....######.....'
    ]},

  // 8 — LARGE BOTTLE
  8: { sz: 74, c: { '#':'#0a0408','c':'#5a3818','y':'#ffd83a','r':'#ff8aa0','R':'#c52828','w':'#ffffff' },
    g: [
      '......##........',
      '......#cc#......',
      '......#cc#......',
      '.....##cc##.....',
      '....#yyyyyy#....',
      '....#yyyyyy#....',
      '...#rrRRRRRr#...',
      '..#rrwRRRRRRr#..',
      '.#rrRRRRRRRRRr#.',
      '#rrRRRRRRRRRRRr#',
      '#rrRRRRRRRRRRRr#',
      '#rrRRRRRRRRRRRr#',
      '#rrRRRRRRRRRRRr#',
      '#rrRRRRRRRRRRRr#',
      '##rrRRRRRRRRRr##',
      '################'
    ]},

  // 9 — GIANT FLASK
  9: { sz: 82, c: { '#':'#0a0408','c':'#5a3818','y':'#ffd83a','r':'#ff8aa0','R':'#c52828','w':'#ffffff','b':'#7a5028' },
    g: [
      '......##........',
      '.....#cc#.......',
      '.....#cc#.......',
      '....#yyyy#......',
      '...#yybbyy#.....',
      '..#yybbbbyy#....',
      '.#rrRRRRRRRr#...',
      '#rrwRRRRRRRRRr#.',
      '#rRRRRRRRRRRRr#.',
      '#rRRRRRRRRRRRr##',
      '#rRRRRRRRRRRRRr#',
      '#rRRRRRRRRRRRRr#',
      '#rRRRRRRRRRRRRr#',
      '#rRRRRRRRRRRRRr#',
      '##rRRRRRRRRRRr##',
      '.##############.'
    ]},

  // 10 — ELDRITCH FLASK (largest, bubbling)
  10: { sz: 92, c: { '#':'#0a0408','c':'#5a3818','y':'#ffd83a','r':'#ff8aa0','R':'#c52828','w':'#ffffff','b':'#7a5028','s':'#fff200' },
    g: [
      '......##........',
      '....##cc##......',
      '...#yybbyy#.....',
      '..#yybbbbyy#....',
      '.#yyybbbbyyy#...',
      '#rrRRRRRRRRRr#..',
      '#rwRRRRsRRRRRr#.',
      '#rRRRRRRRRRsRr##',
      '#rRsRRRRRRRRRr#.',
      '#rRRRRRRRRsRRr#.',
      '#rRRRsRRRRRRRr#.',
      '#rRRRRRRRRRRRRr#',
      '#rRRRRsRRRRRRRr#',
      '##rRRRRRRRRRRr##',
      '.##############.',
      '..############..'
    ]}
};


function monsterSvg(value, opts = {}) {
  const s = MONSTER_PX[value] || MONSTER_PX[2];
  const motion = opts.staticPose ? '' : monsterMotion(value);
  return pixelSpriteSvg(s.g, s.c, s.sz, { motion });
}
function weaponSvg(value, opts = {}) {
  const s = WEAPON_PX[value] || WEAPON_PX[2];
  const motion = opts.staticPose ? '' : 'anim-glint';
  return pixelSpriteSvg(s.g, s.c, s.sz, { motion });
}
function potionSvg(value, opts = {}) {
  const s = POTION_PX[value] || POTION_PX[2];
  const motion = opts.staticPose ? '' : 'anim-bubble';
  return pixelSpriteSvg(s.g, s.c, s.sz, { motion });
}

function svgIllustration(card) {
  const kind = SUIT[card.suit].kind;
  if (kind === 'monster') return monsterSvg(card.value);
  if (kind === 'weapon')  return weaponSvg(card.value);
  if (kind === 'potion')  return potionSvg(card.value);
  return '';
}

// Outcome-prediction badge HTML for any card. Used by both the .card-slot
// (Quick mode) and .adv-entity (Adventure mode) renders so the prediction
// tier (safe/low/mid/high/lethal) is identical between modes.
function outcomeBadgeHtml(card) {
  const kind = SUIT[card.suit].kind;
  if (kind === 'monster') {
    const useWeapon = weaponActive() && (state.lastMonsterValue === null || card.value < state.lastMonsterValue);
    const dmg = useWeapon ? Math.max(0, card.value - state.weapon.value) : card.value;
    const tier = dmg === 0 ? 'safe' : dmg <= 3 ? 'low' : dmg <= 6 ? 'mid' : dmg <= 10 ? 'high' : 'lethal';
    return `<div class="outcome-badge dmg ${tier}" title="Damage if you fight this">
      <span class="badge-icon">⚔</span><span class="badge-num">−${dmg}</span></div>`;
  }
  if (kind === 'potion') {
    const heal = Math.min(card.value, state.maxHp - state.hp);
    return `<div class="outcome-badge heal" title="HP restored if you drink this">
      <span class="badge-icon">✚</span><span class="badge-num">+${heal}</span></div>`;
  }
  if (kind === 'weapon') {
    return `<div class="outcome-badge equip" title="Damage reduction if equipped">
      <span class="badge-icon">⛨</span><span class="badge-num">−${card.value}</span></div>`;
  }
  return '';
}

function renderCard(slotIndex) {
  const slot = $('slot-' + slotIndex);
  const card = state.room[slotIndex];
  if (!slot) return;
  if (!card) {
    slot.innerHTML = '';
    return;
  }
  const kind = SUIT[card.suit].kind;
  const glyph = SUIT[card.suit].glyph;
  const label = VALUE_LABEL[card.value];
  const constraintLocked = (kind === 'monster'
    && weaponActive()
    && state.lastMonsterValue !== null
    && card.value >= state.lastMonsterValue);

  const badgeHtml = outcomeBadgeHtml(card);

  slot.innerHTML = `
    <div class="card ${kind} ${constraintLocked ? 'locked-out' : ''} flipping" data-slot="${slotIndex}" data-suit="${card.suit}" data-value="${card.value}">
      <div class="card-face">
        <div class="card-corner top-left">
          <span class="corner-value">${label}</span>
          <span class="corner-suit">${glyph}</span>
        </div>
        <div class="card-center">
          ${svgIllustration(card)}
        </div>
        <div class="card-corner bottom-right">
          <span class="corner-value">${label}</span>
          <span class="corner-suit">${glyph}</span>
        </div>
      </div>
      ${badgeHtml}
    </div>
  `;

  const cardEl = qs('.card', slot);
  cardEl.addEventListener('click', (e) => onCardClick(slotIndex, e));
  cardEl.addEventListener('mouseenter', (e) => onCardHover(slotIndex, e));
  cardEl.addEventListener('mousemove',  (e) => positionTooltip(e));
  cardEl.addEventListener('mouseleave', () => hideTooltip());
  setTimeout(() => cardEl.classList.remove('flipping'), 600);
}

function renderRoom() {
  const row = $('room-row');
  if (row.children.length !== 4) {
    row.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const slot = document.createElement('div');
      slot.className = 'card-slot';
      slot.id = 'slot-' + i;
      row.appendChild(slot);
    }
  }
  for (let i = 0; i < 4; i++) renderCard(i);
  renderAdventureScene();
}

// Adventure-mode entity scene (v0.5.2 → v0.5.3). Same state.room data as the
// cards, just rendered as physical "encounter" tiles the trainer walks up to.
// v0.5.3 embeds the actual monster / weapon / potion pixel-art sprite inside
// each entity tile (svgIllustration), scaled per card value (sprite's own `sz`
// percentage drives this — bigger value = bigger sprite). Empty slots get the
// .empty class so layout doesn't reflow when a card is consumed. Click
// delegates to the same onCardClick handler the .card-slot uses.
function renderAdventureScene() {
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById('adv-entity-' + i);
    if (!el) continue;
    const card = state.room[i];
    el.classList.remove('consumed');
    if (!card) {
      el.classList.add('empty');
      el.removeAttribute('data-kind');
      el.innerHTML = '';
      continue;
    }
    el.classList.remove('empty');
    const kind = SUIT[card.suit].kind;
    el.dataset.kind = kind;
    el.dataset.value = card.value;
    // Locked-out: weapon equipped + card.value >= last-slain (blade dulls).
    // Surfaces as a darker tile + struck-through prediction so user sees why.
    const constraintLocked = (kind === 'monster'
      && weaponActive()
      && state.lastMonsterValue !== null
      && card.value >= state.lastMonsterValue);
    el.classList.toggle('locked-out', constraintLocked);
    // v0.6.1 — replace the value/suit corner badge with plain stat language.
    // Adventure mode reads as "monster has 8 HP" / "+4 weapon" / "+8 HP" for
    // potion. The outcome-prediction badge (top-right) still shows the actual
    // damage you'd take or HP you'd recover after weapon math, locked-out
    // constraints, max-HP cap, etc.
    let labelTop, labelBot;
    if (kind === 'monster')      { labelTop = card.value;       labelBot = 'HP'; }
    else if (kind === 'potion')  { labelTop = '+' + card.value; labelBot = 'HP'; }
    else                         { labelTop = '+' + card.value; labelBot = 'WPN'; }   // weapon
    el.innerHTML =
      `<div class="ent-sprite">${svgIllustration(card)}</div>` +
      `<div class="ent-corner">` +
        `<span class="ent-value">${labelTop}</span>` +
        `<span class="ent-suit">${labelBot}</span>` +
      `</div>` +
      outcomeBadgeHtml(card);
  }
}

// Walk-to-entity (adventure mode). Computes dynamically from the entity's
// bounding box so we don't have to maintain hardcoded translates per slot.
// Caller is the cutscene; the inline transform overrides the body.cutscene-active
// rule's transform (specificity wins on inline). returnPlayerHome() clears it.
function walkPlayerToEntity(slotIndex) {
  if (state.mode !== 'adventure') return;
  const player = document.getElementById('player-layer');
  const entity = document.getElementById('adv-entity-' + slotIndex);
  if (!player || !entity) return;
  const playerRect = player.getBoundingClientRect();
  const entityRect = entity.getBoundingClientRect();
  // Stop ~80% of the way to the entity so the trainer faces it without
  // overlapping. Subtle lift on Y so the figure reads as "approaching".
  const dx = (entityRect.left + entityRect.width  / 2)
           - (playerRect.left + playerRect.width  / 2);
  const dy = (entityRect.top  + entityRect.height / 2)
           - (playerRect.top  + playerRect.height / 2);
  player.style.transform = `translate(${dx * 0.78}px, ${dy * 0.78}px) scale(1.12)`;
  player.style.zIndex = '12';
}
function returnPlayerHome() {
  const player = document.getElementById('player-layer');
  if (!player) return;
  player.style.transform = '';
  player.style.zIndex = '';
}

// v0.6.0 — corridor + door cinematic. Replaces the v0.5.5 plain corridor
// fade with a real "trainer walks to the door, the door opens, camera
// follows through" sequence. Helpers below are composed by refillRoom().
function walkPlayerToCorridor() {
  if (state.mode !== 'adventure') return;
  const player = document.getElementById('player-layer');
  if (!player) return;
  player.style.transition = 'transform 700ms ease-in-out, opacity 700ms ease-in-out';
  player.style.transform = 'translate(180px, -220px) scale(0.42)';
  player.style.opacity = '0.42';
  player.style.zIndex = '4';
}
function walkPlayerFromCorridor() {
  const player = document.getElementById('player-layer');
  if (!player) return;
  player.style.transition = 'transform 620ms ease-in-out, opacity 420ms ease-in';
  player.style.transform = '';
  player.style.opacity = '';
  player.style.zIndex = '';
  setTimeout(() => { if (player) player.style.transition = ''; }, 700);
}
function openDungeonDoor()  {
  const d = qs('.dungeon-door');
  if (d && !d.classList.contains('door-open')) {
    d.classList.add('door-open');
    Audio.play('door-open');
  }
}
function closeDungeonDoor() {
  const d = qs('.dungeon-door');
  if (d && d.classList.contains('door-open')) {
    d.classList.remove('door-open');
    Audio.play('door-close');
  }
}
// Camera follow: scale + translate the arena so the door drifts toward
// viewport-center — reads as "we just walked through the doorway."
function zoomCameraThroughDoor() {
  const arena = qs('.dungeon-arena');
  if (!arena) return;
  arena.style.transition = 'transform 700ms cubic-bezier(0.5, 0, 0.4, 1)';
  arena.style.transformOrigin = 'calc(50% - 100px) 25%';
  arena.style.transform = 'scale(1.55)';
}
function resetCameraZoom() {
  const arena = qs('.dungeon-arena');
  if (!arena) return;
  arena.style.transition = 'transform 600ms cubic-bezier(0.5, 0, 0.4, 1)';
  arena.style.transform = '';
  setTimeout(() => {
    if (arena) { arena.style.transition = ''; arena.style.transformOrigin = ''; }
  }, 700);
}

// Update outcome badges & locked-out state on existing room cards/entities
// without re-creating them. v0.5.6 — also refreshes the .adv-entity badges
// so adventure mode reflects equipped-weapon / dulled-blade state changes.
function refreshBadges() {
  for (let i = 0; i < 4; i++) {
    const card = state.room[i];
    if (!card) continue;
    const kind = SUIT[card.suit].kind;
    let dmg = 0, heal = 0, tier = '';
    let constraintLocked = false;
    if (kind === 'monster') {
      const useWeapon = weaponActive() && (state.lastMonsterValue === null || card.value < state.lastMonsterValue);
      dmg = useWeapon ? Math.max(0, card.value - state.weapon.value) : card.value;
      tier = dmg === 0 ? 'safe' : dmg <= 3 ? 'low' : dmg <= 6 ? 'mid' : dmg <= 10 ? 'high' : 'lethal';
      constraintLocked = weaponActive() && state.lastMonsterValue !== null && card.value >= state.lastMonsterValue;
    } else if (kind === 'potion') {
      heal = Math.min(card.value, state.maxHp - state.hp);
    }

    // Card slot (Quick mode visible).
    const slot = $('slot-' + i);
    const cardEl = slot ? qs('.card', slot) : null;
    const cardBadge = slot ? qs('.outcome-badge', slot) : null;
    if (cardEl && cardBadge) {
      const numEl = qs('.badge-num', cardBadge);
      if (kind === 'monster') {
        cardBadge.className = `outcome-badge dmg ${tier}`;
        if (numEl) numEl.textContent = `−${dmg}`;
        cardEl.classList.toggle('locked-out', constraintLocked);
      } else if (kind === 'potion') {
        if (numEl) numEl.textContent = `+${heal}`;
      }
    }

    // Adventure entity (Adventure mode visible).
    const advEl = document.getElementById('adv-entity-' + i);
    const advBadge = advEl ? qs('.outcome-badge', advEl) : null;
    if (advEl && advBadge) {
      const numEl = qs('.badge-num', advBadge);
      if (kind === 'monster') {
        advBadge.className = `outcome-badge dmg ${tier}`;
        if (numEl) numEl.textContent = `−${dmg}`;
        advEl.classList.toggle('locked-out', constraintLocked);
      } else if (kind === 'potion') {
        if (numEl) numEl.textContent = `+${heal}`;
      }
    }
  }
}

// Render-cache for change detection (so we only animate weapon/slain when they actually change)
let _renderCache = { weaponSig: null, slainSig: null };
function _resetRenderCache() { _renderCache = { weaponSig: null, slainSig: null }; }

function renderWeapon() {
  const stack = $('weapon-stack');
  const meta  = $('armory-value');
  if (!stack || !meta) return;

  if (!state.weapon) {
    stack.innerHTML = `
      <div class="weapon-frame empty" id="weapon-frame">
        <div class="weapon-empty">NO<br>WEAPON</div>
      </div>`;
    meta.innerHTML = '<span style="color:var(--bone-mid)">—</span>';
    _renderCache.weaponSig = null;
    _renderCache.slainSig = null;
    _applyWeaponElement();
    Player.renderEquippedWeapon(); // hide the back-strap weapon when unarmed
    return;
  }

  const w = state.weapon;
  const lastSlain = state.weaponStack[state.weaponStack.length - 1] || null;

  const wSig = `${w.suit}-${w.value}`;
  const sSig = lastSlain ? `${lastSlain.suit}-${lastSlain.value}` : null;
  const justEquipped = wSig !== _renderCache.weaponSig && _renderCache.weaponSig !== null
                       || (wSig !== _renderCache.weaponSig && _renderCache.weaponSig === null && sSig === null);
  // simplified: animate equip whenever weapon signature changes
  const equipChanged = wSig !== _renderCache.weaponSig;
  const slainChanged = sSig !== null && sSig !== _renderCache.slainSig;

  _renderCache.weaponSig = wSig;
  _renderCache.slainSig  = sSig;

  let html = '';

  if (lastSlain) {
    html += `
      <div class="slot-card last-slain-card${slainChanged ? ' just-slain' : ''}">
        <div class="slot-corner">
          <span>${VALUE_LABEL[lastSlain.value]}</span>
          <span class="sc-suit">${SUIT[lastSlain.suit].glyph}</span>
        </div>
        <div class="slot-art">${monsterSvg(lastSlain.value, { staticPose: true })}</div>
      </div>`;
  }

  const sheathed = state.weaponSheathed;
  html += `
    <div class="slot-card weapon-card${equipChanged ? ' just-equipped' : ''}${sheathed ? ' sheathed' : ''}" role="button" tabindex="0" title="${sheathed ? 'Blade sheathed — tap to draw' : 'Tap to sheathe (fight bare-handed)'}">
      <div class="slot-corner">
        <span>${VALUE_LABEL[w.value]}</span>
        <span class="sc-suit">${SUIT[w.suit].glyph}</span>
      </div>
      <div class="slot-art">${weaponSvg(w.value, { staticPose: true })}</div>
      <div class="sheathe-badge">${sheathed ? 'SHEATHED' : ''}</div>
    </div>`;

  if (!sheathed && state.lastMonsterValue !== null) {
    html += `<div class="weapon-vs">&lt; ${VALUE_LABEL[state.lastMonsterValue]}</div>`;
  }

  stack.innerHTML = html;

  if (sheathed) {
    meta.innerHTML = `${VALUE_LABEL[w.value]}♦<span class="sub-val sub-sheathed">sheathed</span>`;
  } else if (state.lastMonsterValue !== null) {
    meta.innerHTML = `${VALUE_LABEL[w.value]}♦<span class="sub-val">&lt; ${VALUE_LABEL[state.lastMonsterValue]}</span>`;
  } else {
    meta.innerHTML = `${VALUE_LABEL[w.value]}♦<span class="sub-val">ready</span>`;
  }

  _applyWeaponElement();

  // Sync the back-strap weapon on the player layer so the equipped weapon is
  // visible at all times during gameplay (not just during cutscenes).
  Player.renderEquippedWeapon();
}

// Toggle the equipped blade between drawn and sheathed. While sheathed, every
// fight resolves bare-handed — this is the touch-friendly equivalent of holding
// Shift on desktop (phones have no Shift key). Freely reversible, no turn cost;
// the weapon's dulling-curse is paused while sheathed and resumes when redrawn.
// One-time coaching: the first time a weapon is equipped on a touch device,
// point out that the weapon card is tappable to sheathe (fight bare-handed) —
// there's no Shift key and no hover to reveal it otherwise. Persisted in
// localStorage so it shows once, ever.
function maybeSheatheHint() {
  try {
    if (state.tutorialMode) return;
    if (localStorage.getItem('d20_sheathe_hint') === '1') return;
    const touch = window.matchMedia && window.matchMedia('(hover: none)').matches;
    if (!touch) return;
    localStorage.setItem('d20_sheathe_hint', '1');
    hint('Tip: tap your weapon to sheathe it and fight bare-handed', 3200);
    const wc = document.querySelector('.slot-card.weapon-card');
    if (wc) {
      wc.classList.add('hint-pulse');
      setTimeout(() => wc.classList.remove('hint-pulse'), 2800);
    }
  } catch (e) { /* localStorage/matchMedia unavailable — skip the hint */ }
}

function toggleSheathe() {
  if (!state.weapon || state.inputLocked || state.isOver || state.tutorialMode) return;
  state.weaponSheathed = !state.weaponSheathed;
  Audio.play(state.weaponSheathed ? 'skip' : 'equip');
  haptic('light');
  renderWeapon();
  refreshBadges();
  hint(state.weaponSheathed ? 'Blade sheathed — fighting bare-handed' : 'Blade drawn', 1100);
}

// Apply an "element-<kind>" class to the weapon UI based on the equipped
// weapon's value, driving the elemental glow border defined in styles.css.
// Targets whichever element currently exists in the DOM:
//   - #weapon-frame: empty/placeholder state when no weapon is equipped
//   - .slot-card.weapon-card: rendered when a weapon IS equipped
function _applyWeaponElement() {
  const target =
    document.querySelector('.slot-card.weapon-card') ||
    document.getElementById('weapon-frame');
  if (!target) return;
  const ELEMENT_MAP = { 2:'rust', 3:'rust', 4:'steel', 5:'steel', 6:'flame', 7:'thunder', 8:'purple', 9:'void', 10:'flame', 11:'flame', 12:'flame', 13:'flame', 14:'divine' };
  target.classList.remove('element-rust','element-steel','element-flame','element-thunder','element-void','element-purple','element-divine');
  if (!state.weapon) {
    target.classList.add('empty');
  } else {
    target.classList.remove('empty');
    const v = state.weapon.value;
    const el = ELEMENT_MAP[v] || 'steel';
    target.classList.add('element-' + el);
  }
}

function renderHud() {
  const cfg = DIFFICULTY[state.difficulty];
  $('deck-count').textContent = state.deck.length;
  // Wanderer has unlimited flees — render the badge as ∞ instead of a number.
  $('skip-count').textContent = state.skipsLeft === Infinity ? '∞' : state.skipsLeft;
  $('skip-count').classList.toggle('zero', state.skipsLeft === 0);
  // Damned cannot flee a room once any card is resolved — disable the button
  // mid-room so the player isn't tempted to click and get the "too late" hint.
  const fleeMidLocked = !cfg.fleeAfterPick && state.room.some(c => c === null);
  $('skip-btn').disabled = state.skipsLeft <= 0 || state.inputLocked || fleeMidLocked;
  $('undo-btn').disabled = !state.undoAllowed || !state.undoSnapshot || state.undoUsed || state.inputLocked;
  renderWeapon();
  updateAtmosphere();
}

// HP colour grade: full=gold, mid=amber, low=blood. Smoothly lerps through
// amber at the 50% mark so the meter visibly "bleeds" as vitality drops.
const HP_GRADE = {
  full: [232, 200, 120],   // gold  #e8c878
  mid:  [217, 122,  60],   // amber #d97a3c
  low:  [197,  40,  40],   // blood #c52828
};
function _hpLerp(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}
function _hpRgb(frac) {
  if (frac >= 0.5) return _hpLerp(HP_GRADE.mid, HP_GRADE.full, (frac - 0.5) / 0.5);
  return _hpLerp(HP_GRADE.low, HP_GRADE.mid, frac / 0.5);
}
function renderHp(opts={}) {
  const num = $('hp-number');
  num.textContent = state.hp;
  num.classList.toggle('low', state.hp <= 6);

  const bar = $('hp-bar');
  if (!bar) return;
  const frac = Math.max(0, Math.min(1, state.hp / state.maxHp));
  const [r, g, b] = _hpRgb(frac);
  // glossy vertical gradient: a lighter top edge over the graded base colour
  const top = `rgb(${Math.min(255, r + 30)}, ${Math.min(255, g + 30)}, ${Math.min(255, b + 24)})`;
  const base = `rgb(${r}, ${g}, ${b})`;
  bar.style.width = (frac * 100) + '%';
  bar.style.setProperty('--hp-fill', `linear-gradient(180deg, ${top}, ${base})`);
  bar.style.setProperty('--hp-glow', `rgba(${r}, ${g}, ${b}, 0.65)`);
  bar.classList.toggle('low', state.hp <= 6);
  bar.classList.toggle('crit', state.hp <= 3);

  // D20 life-state: healthy glow / wounded unease / dying throb + cracks.
  const cont = $('d20-container');
  if (cont) {
    const alive = state.hp > 0;
    cont.classList.toggle('full',    alive && frac >= 0.999);
    cont.classList.toggle('wounded', alive && state.hp <= 6 && state.hp > 3);
    cont.classList.toggle('dying',   alive && state.hp <= 3);
  }

  // brief flare when the value just changed (driven from applyHpChange)
  if (opts.pulse) {
    const cls = opts.pulse === 'damage' ? 'pulse-damage' : 'pulse-heal';
    bar.classList.remove('pulse-damage', 'pulse-heal'); void bar.offsetWidth;
    bar.classList.add(cls);
  }
}

// -----------------------------------------------------------
// TOOLTIP
// -----------------------------------------------------------
function showTooltip(html) {
  if (!state.options.tip) return;
  const tip = $('tooltip');
  tip.innerHTML = html;
  tip.classList.add('visible');
}
function hideTooltip() {
  $('tooltip').classList.remove('visible');
}
function positionTooltip(e) {
  const tip = $('tooltip');
  const x = e.clientX + 18;
  const y = e.clientY + 18;
  const rect = tip.getBoundingClientRect();
  const maxX = window.innerWidth  - rect.width  - 12;
  const maxY = window.innerHeight - rect.height - 12;
  tip.style.left = Math.min(x, maxX) + 'px';
  tip.style.top  = Math.min(y, maxY) + 'px';
}

function onCardHover(slotIndex, e) {
  const card = state.room[slotIndex];
  if (!card) return;
  const kind = SUIT[card.suit].kind;
  const label = VALUE_LABEL[card.value];
  const sName = SUIT[card.suit].name;
  let html = '';
  if (kind === 'monster') {
    const constraintLocked = weaponActive()
      && state.lastMonsterValue !== null
      && card.value >= state.lastMonsterValue;
    html += `<span class="tip-title">Fight ${VALUE_NAME[card.value]} of ${sName}</span>`;
    if (weaponActive() && !constraintLocked) {
      const dmg = Math.max(0, card.value - state.weapon.value);
      html += `<span class="tip-line">Strike with ${VALUE_LABEL[state.weapon.value]}♦ blade</span>`;
      html += `<span class="tip-line"><strong>Damage taken: ${dmg}</strong></span>`;
      html += `<span class="tip-hint">Hold SHIFT (or sheathe the blade) to fight bare-handed</span>`;
    } else if (weaponActive() && constraintLocked) {
      html += `<span class="tip-line tip-warn">Blade too dull (last slew ${VALUE_LABEL[state.lastMonsterValue]})</span>`;
      html += `<span class="tip-line"><strong>Damage taken: ${card.value}</strong> (bare-handed)</span>`;
    } else {
      html += `<span class="tip-line"><strong>Damage taken: ${card.value}</strong> (bare-handed)</span>`;
    }
  } else if (kind === 'potion') {
    const heal = Math.min(card.value, state.maxHp - state.hp);
    html += `<span class="tip-title">Drink ${VALUE_NAME[card.value]} of Hearts</span>`;
    html += `<span class="tip-line"><strong>Restore ${heal} vitality</strong></span>`;
    if (heal < card.value) html += `<span class="tip-line tip-warn">${card.value - heal} wasted (max ${state.maxHp})</span>`;
  } else if (kind === 'weapon') {
    html += `<span class="tip-title">Equip ${VALUE_NAME[card.value]} of Diamonds</span>`;
    html += `<span class="tip-line"><strong>Reduces damage by ${card.value}</strong></span>`;
    if (state.weapon) html += `<span class="tip-line tip-warn">Replaces current ${VALUE_LABEL[state.weapon.value]}♦</span>`;
  }
  showTooltip(html);
  positionTooltip(e);
}

// -----------------------------------------------------------
// LOG / HINT
// -----------------------------------------------------------
function log(msg) {
  const line = document.createElement('div');
  line.className = 'log-line';
  line.textContent = msg;
  $('action-log').appendChild(line);
  setTimeout(() => line.remove(), 4200);
}
function hint(msg, dur=1800) {
  const h = $('hint');
  h.textContent = msg;
  h.classList.add('show');
  clearTimeout(hint._t);
  hint._t = setTimeout(() => h.classList.remove('show'), dur);
}
function flashScreen(color) {
  const f = $('flash-overlay');
  f.classList.add('show-' + color);
  setTimeout(() => f.classList.remove('show-' + color), 220);
}

// Damage-scaled impact feel: arena shake throw, red edge-vignette pulse, and a
// hit-stop punch on heavy blows. All intensities ramp with `dmg` so a 2 reads
// light and a 13 reads devastating. No-op when animations are disabled.
function impactFeedback(dmg) {
  if (!state.options.anim || dmg <= 0) return;
  const mag = Math.max(3, Math.min(15, dmg));        // shake throw in px
  const arena = qs('.dungeon-arena');
  if (arena) {
    arena.style.setProperty('--shake-mag', mag + 'px');
    arena.classList.remove('arena-shake'); void arena.offsetWidth;
    arena.classList.add('arena-shake');
    setTimeout(() => arena.classList.remove('arena-shake'), 380);
  }
  const v = $('impact-vignette');
  if (v) {
    v.style.setProperty('--dmg-alpha', Math.min(0.72, 0.16 + dmg * 0.045).toFixed(3));
    v.classList.remove('show'); void v.offsetWidth;
    v.classList.add('show');
    setTimeout(() => v.classList.remove('show'), 440);
  }
  if (dmg >= 8) {
    const app = $('app');
    if (app) {
      app.classList.remove('hitstop'); void app.offsetWidth;
      app.classList.add('hitstop');
      setTimeout(() => app.classList.remove('hitstop'), 100);
    }
  }
}

// -----------------------------------------------------------
// HP CHANGE
// -----------------------------------------------------------
function applyHpChange(delta, reason) {
  const before = state.hp;
  state.hp = Math.max(0, Math.min(state.maxHp, state.hp + delta));
  const real = state.hp - before;
  const floater = $('hp-floater');
  const cont = $('d20-container');

  if (real < 0) {
    cont.classList.remove('damage-roll'); void cont.offsetWidth;
    cont.classList.add('damage-roll');
    floater.textContent = real;
    floater.classList.remove('show-damage','show-heal'); void floater.offsetWidth;
    floater.classList.add('show-damage');
    flashScreen('red');
    impactFeedback(-real);
    Audio.play('damage');
  } else if (real > 0) {
    cont.classList.remove('heal-pulse'); void cont.offsetWidth;
    cont.classList.add('heal-pulse');
    floater.textContent = '+' + real;
    floater.classList.remove('show-damage','show-heal'); void floater.offsetWidth;
    floater.classList.add('show-heal');
    flashScreen('green');
    Audio.play('heal');
  }
  setTimeout(() => {
    cont.classList.remove('damage-roll', 'heal-pulse');
  }, 800);

  // animate number
  animateNumber(before, state.hp, 'hp-number', 600);
  setTimeout(() => renderHp({ pulse: real < 0 ? 'damage' : (real > 0 ? 'heal' : null) }), 60);
}

function animateNumber(from, to, elId, dur) {
  const el = $(elId);
  if (!el) return;
  const start = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - start) / dur);
    const eased = 1 - Math.pow(1 - k, 3);
    const v = Math.round(from + (to - from) * eased);
    el.textContent = v;
    if (k < 1) requestAnimationFrame(step);
    else el.textContent = to;
  };
  requestAnimationFrame(step);
}

// -----------------------------------------------------------
// SNAPSHOT (for undo)
// -----------------------------------------------------------
function snapshot() {
  return JSON.parse(JSON.stringify({
    hp: state.hp,
    deck: state.deck,
    room: state.room,
    weapon: state.weapon,
    weaponSheathed: state.weaponSheathed,
    lastMonsterValue: state.lastMonsterValue,
    weaponStack: state.weaponStack,
    skipsLeft: state.skipsLeft,
    cardsCleared: state.cardsCleared,
    monstersDefeated: state.monstersDefeated,
    damageTaken: state.damageTaken,
    potionsUsed: state.potionsUsed,
    weaponsEquipped: state.weaponsEquipped
  }));
}

function captureUndo() {
  state.undoSnapshot = snapshot();
  // undoUsed is reset on room refill, not on each capture
}

function applySnapshot(snap) {
  Object.assign(state, snap);
  renderRoom();
  renderHud();
  renderHp();
  updatePeek();
}

// -----------------------------------------------------------
// CARD CLICK / ACTIONS
// -----------------------------------------------------------
function onCardClick(slotIndex, evt) {
  if (state.inputLocked || state.isOver) return;
  const card = state.room[slotIndex];
  if (!card) return;
  // Tutorial mode: only the card matching the current scripted step is allowed.
  if (state.tutorialMode) {
    const step = TUTORIAL_SCRIPT[state.tutorialStep];
    if (!step || card.suit !== step.expect.suit || card.value !== step.expect.value) {
      shakeCard(slotIndex);
      Audio.play('cant');
      return;
    }
  }
  const kind = SUIT[card.suit].kind;
  if (kind === 'monster') {
    // Bare-handed override: desktop Shift+click OR the sheathed-weapon toggle
    // (the touch-friendly equivalent, since phones have no Shift key).
    const forceBare = (evt && evt.shiftKey) || state.weaponSheathed;
    return doFight(slotIndex, forceBare);
  }
  if (kind === 'potion')   return doDrink(slotIndex);
  if (kind === 'weapon')   return doEquip(slotIndex);
}

function doFight(slotIndex, forceBare) {
  if (state.inputLocked) return;
  captureUndo();
  const card = state.room[slotIndex];
  const useWeapon = state.weapon
    && !forceBare
    && (state.lastMonsterValue === null || card.value < state.lastMonsterValue);
  const damage = useWeapon ? Math.max(0, card.value - state.weapon.value) : card.value;
  const archetype = useWeapon ? weaponArchetype(state.weapon.value) : 'bare';

  state.inputLocked = true;

  Cutscene.play(slotIndex, {
    archetype,
    weapon: useWeapon ? state.weapon : null
  }, {
    onImpact: () => {
      // State mutation at impact frame so a mid-cutscene skip resolves
      // identically to the un-skipped cutscene.
      if (useWeapon) {
        state.lastMonsterValue = card.value;
        state.weaponStack.push(card);
        log(`Strike ${VALUE_LABEL[card.value]}${SUIT[card.suit].glyph} with ${VALUE_LABEL[state.weapon.value]}♦ — ${damage} damage`);
      } else {
        if (state.weapon && state.lastMonsterValue !== null && card.value >= state.lastMonsterValue && !forceBare) {
          hint('Blade too dull — fought bare-handed', 1400);
        }
        log(`Strike ${VALUE_LABEL[card.value]}${SUIT[card.suit].glyph} bare-handed — ${damage} damage`);
      }
      state.monstersDefeated++;
      state.damageTaken += damage;
      state.cardsCleared++;
      // v0.6.1 — efficiency tracking: count "mistakes" for the high-score
      // formula. A bare-handed swing when the equipped weapon was usable
      // (would have reduced damage) counts as a mistake. Hits taken at full
      // HP also count (you "wasted" the buffer that lets potions stack up).
      if (!useWeapon && state.weapon && !forceBare && damage > 0) state.bareHits++;
      if (damage > 0 && state.hp >= state.maxHp) state.fullHpHits++;
      Audio.play('attack');
      // Floating combat number off the struck card (where the eyes are),
      // complementing the HP-die floater. "0" when the blade fully absorbs.
      spawnCardFloater(slotIndex, damage > 0 ? '−' + damage : '0', damage > 0 ? 'dmg' : 'safe');
      if (damage > 0) {
        haptic(damage >= 6 ? 'heavy' : 'hit');
        applyHpChange(-damage);
        if (state.options.anim) setTimeout(() => Player.play('hurt'), 200);
      }
    },
    onEnd: () => {
      consumeCard(slotIndex);
      // 600ms: consumeCard's internal state-null timeout is at 500ms. finalizeAction
      // must run AFTER that so the refill check sees the just-cleared slot as null.
      // The original v0.3 doFight used 600ms after consumeCard for this reason; v0.4
      // accidentally set it to 400ms and broke the 3-of-4 → refill rule.
      setTimeout(() => finalizeAction(), state.mode === 'quick' ? 160 : 600);
    }
  });
}

function doDrink(slotIndex) {
  if (state.inputLocked) return;
  captureUndo();
  const card = state.room[slotIndex];
  const heal = Math.min(card.value, state.maxHp - state.hp);

  state.inputLocked = true;

  Cutscene.play(slotIndex, { archetype: 'drink', weapon: null }, {
    onImpact: () => {
      state.potionsUsed++;
      state.cardsCleared++;
      log(`Quaff ${VALUE_LABEL[card.value]}♥ — restore ${heal} vitality${heal < card.value ? ' (' + (card.value-heal) + ' wasted)' : ''}`);
      spawnCardFloater(slotIndex, heal > 0 ? '+' + heal : '0', heal > 0 ? 'heal' : 'safe');
      if (heal > 0) { haptic('heal'); applyHpChange(heal); }
    },
    onEnd: () => {
      consumeCard(slotIndex);
      // 600ms: consumeCard's internal state-null timeout is at 500ms. finalizeAction
      // must run AFTER that so the refill check sees the just-cleared slot as null.
      // The original v0.3 doFight used 600ms after consumeCard for this reason; v0.4
      // accidentally set it to 400ms and broke the 3-of-4 → refill rule.
      setTimeout(() => finalizeAction(), state.mode === 'quick' ? 160 : 600);
    }
  });
}

function doEquip(slotIndex) {
  if (state.inputLocked) return;
  captureUndo();
  const card = state.room[slotIndex];

  state.inputLocked = true;

  Cutscene.play(slotIndex, {
    archetype: 'equip',
    weapon: { suit: card.suit, value: card.value }
  }, {
    onImpact: () => {
      state.weapon = { suit: card.suit, value: card.value };
      state.weaponSheathed = false;   // drawing a fresh blade un-sheathes
      state.lastMonsterValue = null;
      state.weaponStack = [];
      state.weaponsEquipped++;
      state.cardsCleared++;
      log(`Equip ${VALUE_LABEL[card.value]}♦ — blade ready`);
      Audio.play('equip');
      haptic('light');
    },
    onEnd: () => {
      consumeCard(slotIndex);
      renderWeapon();
      maybeSheatheHint();
      // 600ms (matches doFight/doDrink) — must wait for consumeCard's 500ms
      // internal state-null timer so finalizeAction sees the correct remaining count.
      setTimeout(() => finalizeAction(), state.mode === 'quick' ? 160 : 600);
    }
  });
}

function shakeCard(slotIndex) {
  const cardEl = qs('.card', $('slot-'+slotIndex));
  if (!cardEl) return;
  cardEl.classList.add('shake');
  setTimeout(() => cardEl.classList.remove('shake'), 420);
}
function flashCard(slotIndex, cls) {
  const cardEl = qs('.card', $('slot-'+slotIndex));
  if (!cardEl) return;
  cardEl.classList.add(cls);
  setTimeout(() => cardEl.classList.remove(cls), 620);
}
function consumeCard(slotIndex) {
  const cardEl = qs('.card', $('slot-'+slotIndex));
  const card = state.room[slotIndex];
  if (cardEl) {
    // Suit-flavoured exit: monster bursts, potion sinks, weapon flies off.
    if (card && SUIT[card.suit]) cardEl.classList.add('exit-' + SUIT[card.suit].kind);
    cardEl.style.transform = '';   // clear any lingering hover-tilt inline transform
    cardEl.classList.add('consumed');
  }
  // Adventure mode: also fade the entity tile. Both modes' visuals fade in
  // sync — the underlying state.room nullification happens once for both.
  const advEl = document.getElementById('adv-entity-' + slotIndex);
  if (advEl) advEl.classList.add('consumed');
  // v0.5.6 — Quick mode runs ~4x faster so taps queue smoothly. Adventure
  // keeps the leisurely 500ms fade matching its cinematic pacing.
  const fadeMs = state.mode === 'quick' ? 120 : 500;
  setTimeout(() => {
    state.room[slotIndex] = null;
    renderCard(slotIndex);
    renderAdventureScene();
  }, fadeMs);
}

function finalizeAction() {
  state.inputLocked = false;
  renderHud();
  refreshBadges();
  if (state.hp <= 0) {
    state.isOver = true;
    haptic('death');
    return endGame(false);
  }
  // Tutorial mode: after a scripted CARD step resolves, show the result text
  // + OK button instead of refilling the room. The tutorial controller
  // advances the step (or shows the finish prompt after the last step) when
  // OK is clicked. noCard (HUD-tip) steps never reach finalizeAction.
  if (state.tutorialMode && state.tutorialStep < TUTORIAL_SCRIPT.length) {
    const tStep = TUTORIAL_SCRIPT[state.tutorialStep];
    if (tStep && !tStep.noCard) {
      state.inputLocked = true;
      showTutorialResult();
      return;
    }
  }
  // Refill check: when only 1 card remains and deck has cards
  const remaining = state.room.filter(c => c !== null).length;
  const allEmpty = remaining === 0 && state.deck.length === 0;
  if (allEmpty) {
    state.isOver = true;
    haptic('heavy');
    return endGame(true);
  }
  if (remaining <= 1 && state.deck.length > 0) {
    // Re-lock input through the refill window so the user can't race-click
    // the surviving card before refillRoom fires — that race lets the user
    // consume the survivor AND get 3 new cards (effectively 4 new) instead
    // of "1 survivor + 3 new" as the rule intends. refillRoom unlocks when
    // the deal animations finish.
    state.inputLocked = true;
    renderHud();
    setTimeout(() => refillRoom(), state.mode === 'quick' ? 80 : 320);
  } else if (remaining === 0 && state.deck.length > 0) {
    state.inputLocked = true;
    renderHud();
    setTimeout(() => refillRoom(), state.mode === 'quick' ? 80 : 320);
  }
  updatePeek();
}

function refillRoom() {
  state.undoUsed = false; // new room → undo refreshed

  // Adventure mode (v0.6.0): full door cinematic. Sequence:
  //   t=0     trainer walks toward door
  //   t=550   door swings open + camera zooms through the doorway
  //   t=900   entity scene fade-out + new entities deal in
  //   t=1700  door swings closed
  //   t=1900  camera resets + trainer walks back
  //   t=2520  input unlocks
  // Quick mode keeps the snappy v0.5.6 timing — no door, no walk.
  const advScene = $('adventure-scene');
  const useCorridor = state.mode === 'adventure' && advScene;
  const preWalkMs = useCorridor ? 900 : 0;   // walk + door + camera before deal

  if (useCorridor) {
    walkPlayerToCorridor();
    // Footstep tap as the trainer walks toward the door
    Audio.play('footstep');
    setTimeout(() => Audio.play('footstep'), 220);
    setTimeout(() => Audio.play('footstep'), 440);
    // Letterbox in to frame the descent (skipped when animations are off).
    if (state.options.anim) document.body.classList.add('cinematic');
    setTimeout(() => openDungeonDoor(), 550);
    setTimeout(() => zoomCameraThroughDoor(), 600);
    setTimeout(() => {
      advScene.classList.add('room-transition');
      setTimeout(() => advScene.classList.remove('room-transition'), 720);
    }, preWalkMs);
    setTimeout(() => closeDungeonDoor(), preWalkMs + 700);
    setTimeout(() => resetCameraZoom(), preWalkMs + 850);
    setTimeout(() => document.body.classList.remove('cinematic'), preWalkMs + 850);
  } else if (advScene) {
    advScene.classList.add('room-transition');
    setTimeout(() => advScene.classList.remove('room-transition'), 720);
  }

  // Stagger the deal so entities/cards appear one-by-one. Quick mode uses a
  // tight 60ms stagger so refilling doesn't kill the tap-tap-tap rhythm.
  const stagger = state.mode === 'quick' ? 60 : 140;
  let delay = preWalkMs + (useCorridor ? 200 : 0);
  for (let i = 0; i < 4; i++) {
    if (state.room[i] === null && state.deck.length > 0) {
      const card = state.deck.shift();
      state.room[i] = card;
      ((idx, d) => {
        setTimeout(() => {
          renderCard(idx);
          renderAdventureScene();
          Audio.play('card-deal');
        }, d);
      })(i, delay);
      delay += stagger;
    }
  }

  if (useCorridor) {
    // Trainer walks back from the corridor after the camera/door reset.
    setTimeout(() => walkPlayerFromCorridor(), preWalkMs + 950);
  }
  const tail = state.mode === 'quick' ? 60 : 350;
  setTimeout(() => {
    state.inputLocked = false;
    renderHud();
    updatePeek();
    // Tutorial: once the (pre-seeded) opening room is on the table, show the
    // first step's hint + highlight. Only fires on step 0 so subsequent
    // mid-tutorial refills (which don't happen — finalizeAction returns
    // early in tutorial mode) wouldn't double-trigger anyway.
    if (state.tutorialMode && state.tutorialStep === 0) showTutorialHint();
  }, delay + tail);
}

// -----------------------------------------------------------
// SKIP / FLEE
// -----------------------------------------------------------
function doSkip() {
  if (state.inputLocked || state.isOver) return;
  if (state.tutorialMode) {
    Audio.play('cant');
    hint('Flee disabled during the tutorial', 1400);
    return;
  }
  if (state.skipsLeft <= 0) {
    Audio.play('cant');
    hint('No flees remain', 1400);
    return;
  }
  // Damned tier: cannot flee a room once any card has been resolved. The room
  // must still be all four cards intact for the flee to be allowed.
  const cfg = DIFFICULTY[state.difficulty];
  if (!cfg.fleeAfterPick && state.room.some(c => c === null)) {
    Audio.play('cant');
    hint('Too late to flee — a card is already resolved', 1600);
    return;
  }
  captureUndo();
  state.skipsLeft--;
  // Place all current room cards at bottom of deck
  const cards = state.room.filter(c => c !== null);
  shuffle(cards); // small randomization to avoid identical replay
  state.deck.push(...cards);
  for (let i = 0; i < 4; i++) state.room[i] = null;
  Audio.play('skip');
  log('Flee the room — cards return to the deck');

  state.inputLocked = true;
  // animate cards out
  qsa('.card').forEach((el, i) => {
    setTimeout(() => {
      el.classList.add('consumed');
    }, i * 60);
  });
  setTimeout(() => {
    renderRoom();
    refillRoom();
    state.inputLocked = false;
    renderHud();
  }, 600);
}

// -----------------------------------------------------------
// UNDO
// -----------------------------------------------------------
function doUndo() {
  if (state.tutorialMode) {
    Audio.play('cant');
    hint('Undo disabled during the tutorial', 1400);
    return;
  }
  if (!state.undoAllowed) return;
  if (!state.undoSnapshot || state.undoUsed) return;
  if (state.inputLocked || state.isOver) return;
  applySnapshot(state.undoSnapshot);
  state.undoSnapshot = null;
  state.undoUsed = true;
  Audio.play('click');
  log('Undo — moment unwound');
  renderHud();
}

// -----------------------------------------------------------
// PEEK (Easy mode)
// -----------------------------------------------------------
function updatePeek() {
  const wrap = $('peek-strip');
  if (!state.showPeek || !DIFFICULTY[state.difficulty].peek) {
    if (wrap) wrap.remove();
    return;
  }
  let strip = $('peek-strip');
  if (!strip) {
    strip = document.createElement('div');
    strip.id = 'peek-strip';
    strip.className = 'peek-strip';
    $('screen-game').querySelector('.dungeon-arena').appendChild(strip);
  }
  const next = state.deck.slice(0, 3);
  strip.innerHTML = '<span>NEXT</span>' + next.map(c => {
    const k = SUIT[c.suit].kind;
    return `<span class="peek-mini ${k}">${VALUE_LABEL[c.value]}${SUIT[c.suit].glyph}</span>`;
  }).join('');
}

// -----------------------------------------------------------
// TUTORIAL CONTROLLER
// -----------------------------------------------------------
// The tutorial mode runs the real game with a pre-seeded first room
// (3♣ Goblin, 5♦ Sword, 4♠ Skeleton, 6♥ Potion). For each of those
// 4 cards a scripted hint is shown before the click and a result
// explanation after. After the 4th OK, the player picks Continue
// (run keeps going, scored) or Return (back to menu).
const TUTORIAL_SCRIPT = [
  {
    expect: { suit: 'clubs', value: 3 },
    hint: 'Click the glowing <strong>3 ♣ Goblin</strong> to fight it.',
    result: 'Ouch — you took <strong>3 damage</strong> fighting bare-handed. Monsters deal their full value when you have no weapon.',
    resultPointAt: 'hp'
  },
  {
    expect: { suit: 'diamonds', value: 5 },
    hint: 'Now click the <strong>5 ♦ Sword</strong> to equip it.',
    result: '<strong>Sword equipped!</strong> Every monster you fight now deals 5 less damage. Strike the <strong>4 ♠ Skeleton</strong> next to see it in action.',
    resultPointAt: 'weapon'
  },
  {
    expect: { suit: 'spades', value: 4 },
    hint: 'Strike the <strong>4 ♠ Skeleton</strong> with your sword.',
    result: '<strong>Zero damage!</strong> Your sword absorbed all of it (4 − 5 = 0). But the blade is now battered — it can only fight monsters under value 4 from here on.',
    resultPointAt: 'weapon'
  },
  {
    expect: { suit: 'hearts', value: 6 },
    hint: 'Drink the <strong>6 ♥ Potion</strong> to heal.',
    result: '<strong>Room cleared!</strong> The potion restored your HP, capped at the maximum of 20.',
    resultPointAt: 'hp'
  },
  // -- HUD-tip steps (no card click required — just OK to advance) --
  {
    noCard: true,
    pointAt: 'weapon',
    hint: 'Tap your equipped <strong>weapon</strong> to <strong>sheathe</strong> it — then every fight is bare-handed (no Shift key needed). Tap it again to draw the blade.<br><br>Why bother? Sheathing <strong>pauses the blade’s dulling curse</strong> — take a weak foe bare-handed to keep a sharp edge for a bigger one.'
  },
  {
    noCard: true,
    pointAt: 'flee',
    hint: 'If a room looks deadly, hit <strong>Flee</strong>. The four cards go back to the bottom of the deck and a fresh room is dealt. You start with limited flee charges.'
  },
  {
    noCard: true,
    pointAt: 'undo',
    hint: '<strong>Undo</strong> rewinds your last action — handy when you misclick. It’s only available on the easier difficulties.'
  },
  {
    noCard: true,
    pointAt: 'pause',
    hint: '<strong>Pause</strong> stops the run. From there you can resume, restart, or abandon back to the menu.'
  },
  {
    noCard: true,
    pointAt: 'deck',
    hint: 'The <strong>deck</strong> counter tracks how many cards are left. Clear every last one to win the run.'
  }
];

// Track what the bubble should point at for the CURRENT phase. Cleared and
// reset by showTutorialHint / showTutorialResult so positionTutorialBubble
// can re-resolve when the window resizes or layout settles.
let _tutPointTarget = null;

// Show the current step's hint text. For card steps: highlights the card and
// hides OK until clicked. For noCard (HUD-tip) steps: shows OK immediately so
// the player can just acknowledge and advance.
function showTutorialHint() {
  const step = TUTORIAL_SCRIPT[state.tutorialStep];
  if (!step) return;
  const txt = $('tut-dialog-text');
  const num = $('tut-step-num');
  const total = $('tut-step-total');
  if (txt) txt.innerHTML = step.hint;
  if (num) num.textContent = state.tutorialStep + 1;
  if (total) total.textContent = TUTORIAL_SCRIPT.length;
  const ok = $('tut-ok-btn');
  qsa('.card.tutorial-active').forEach(c => c.classList.remove('tutorial-active'));
  if (step.noCard) {
    // HUD-tip step — show OK immediately, point at the HUD target.
    if (ok) {
      ok.style.display = '';
      ok.textContent = state.tutorialStep === TUTORIAL_SCRIPT.length - 1
        ? 'Finish ▸' : 'OK ▸';
    }
    _tutPointTarget = step.pointAt;
  } else {
    // Card step — wait for the click; highlight the card.
    if (ok) ok.style.display = 'none';
    highlightTutorialCard();
    _tutPointTarget = 'card';
  }
  scheduleTutReposition();
}

// Show the result text + OK button after the player clicks the correct card.
// Called from finalizeAction. Points at whatever the step's resultPointAt
// says (default: the just-consumed card).
function showTutorialResult() {
  const step = TUTORIAL_SCRIPT[state.tutorialStep];
  if (!step || step.noCard) return;
  const txt = $('tut-dialog-text');
  if (txt) txt.innerHTML = step.result;
  const ok = $('tut-ok-btn');
  if (ok) { ok.style.display = ''; ok.textContent = 'OK ▸'; }
  qsa('.card.tutorial-active').forEach(c => c.classList.remove('tutorial-active'));
  _tutPointTarget = step.resultPointAt || 'card';
  scheduleTutReposition();
}

// Map a pointAt key to its DOM target + the side the arrow should sit on.
function _resolveTutTarget(key) {
  if (key === 'hp')     return { el: $('d20-container'), arrow: 'right' }; // bubble LEFT of D20
  if (key === 'weapon') return { el: $('weapon-frame') || qs('.weapon-block'), arrow: 'up' };
  if (key === 'flee')   return { el: $('skip-btn'),  arrow: 'up' };
  if (key === 'undo')   return { el: $('undo-btn'),  arrow: 'up' };
  if (key === 'pause')  return { el: $('pause-btn'), arrow: 'up' };
  if (key === 'deck')   return { el: $('deck-stack'), arrow: 'up' };
  // 'card' or unknown — find the slot for the current step's expected card,
  // falling back to any .consumed card still in the DOM (result phase).
  const step = TUTORIAL_SCRIPT[state.tutorialStep];
  if (step && step.expect) {
    for (let i = 0; i < 4; i++) {
      const c = state.room[i];
      if (c && c.suit === step.expect.suit && c.value === step.expect.value) {
        return { el: $('slot-' + i), arrow: 'down' };
      }
    }
  }
  for (let i = 0; i < 4; i++) {
    const s = $('slot-' + i);
    if (s && qs('.card.consumed', s)) return { el: s, arrow: 'down' };
  }
  return { el: null, arrow: 'down' };
}

// Position the spotlight over the resolved target and dock the dialog on the
// side with the most room. All geometry is computed RELATIVE TO THE OVERLAY's
// own rect (not assumed to be at viewport 0,0), so it stays aligned regardless
// of page layout, scroll, or screen size. No arrow tail — the lit hole directs
// the eye, which removes the old "arrow points at nothing after clamp" bug.
// Re-run positioning across the next few frames so the spotlight/dialog settle
// onto targets even while the deal-in / cutscene animations are still moving
// layout around. Cheap (a handful of measures) and only while in tutorial mode.
function scheduleTutReposition() {
  positionTutorialBubble();
  requestAnimationFrame(positionTutorialBubble);
  setTimeout(positionTutorialBubble, 120);
  setTimeout(positionTutorialBubble, 380);
}

function positionTutorialBubble() {
  const dialog = $('tut-dialog');
  const spot   = $('tut-spotlight');
  const ovl    = $('tutorial-overlay');
  if (!dialog || !ovl) return;
  const orect = ovl.getBoundingClientRect();

  const { el } = _resolveTutTarget(_tutPointTarget);

  // --- Spotlight ---
  if (spot) {
    if (el) {
      const r = el.getBoundingClientRect();
      const pad = 8;
      const sx = r.left - orect.left - pad;
      const sy = r.top  - orect.top  - pad;
      const sw = r.width  + pad * 2;
      const sh = r.height + pad * 2;
      spot.style.left   = sx + 'px';
      spot.style.top    = sy + 'px';
      spot.style.width  = sw + 'px';
      spot.style.height = sh + 'px';
      spot.classList.add('show', 'pulse');
    } else {
      // No concrete target — dim the whole arena, no lit hole.
      spot.classList.remove('show', 'pulse');
    }
  }

  // --- Dialog: dock on the side of the target with more vertical room ---
  const dh = dialog.offsetHeight || 120;
  const dw = dialog.offsetWidth  || 300;
  const gap = 20;
  const topSafe = 64;                       // clear the step pill / HUD top
  let left, top;

  if (el) {
    const r = el.getBoundingClientRect();
    const ty = r.top - orect.top;           // target top within overlay
    const tcx = r.left - orect.left + r.width / 2;
    const spaceAbove = ty - topSafe;
    const spaceBelow = orect.height - (ty + r.height) - 16;
    if (spaceAbove >= dh + gap || spaceAbove >= spaceBelow) {
      top = ty - dh - gap;                  // above the target
    } else {
      top = ty + r.height + gap;            // below the target
    }
    left = tcx;
  } else {
    left = orect.width / 2;
    top  = orect.height - dh - 28;
  }

  // Clamp within the overlay (no arrow → free to clamp horizontally).
  top  = Math.max(topSafe, Math.min(orect.height - dh - 16, top));
  left = Math.max(dw / 2 + 10, Math.min(orect.width - dw / 2 - 10, left));
  dialog.style.left = left + 'px';
  dialog.style.top  = top  + 'px';
}

// Pulsing gold glow on the slot matching the current step's expected card.
function highlightTutorialCard() {
  qsa('.card.tutorial-active').forEach(c => c.classList.remove('tutorial-active'));
  const step = TUTORIAL_SCRIPT[state.tutorialStep];
  if (!step) return;
  for (let i = 0; i < 4; i++) {
    const c = state.room[i];
    if (c && c.suit === step.expect.suit && c.value === step.expect.value) {
      const cardEl = qs('.card', $('slot-' + i));
      if (cardEl) cardEl.classList.add('tutorial-active');
      return;
    }
  }
}

// OK click handler — advances to the next step's hint, or shows the
// Continue / Return prompt after the last step.
function advanceTutorialStep() {
  state.tutorialStep++;
  if (state.tutorialStep >= TUTORIAL_SCRIPT.length) {
    showTutorialFinish();
    return;
  }
  // Unlock so the player can click the next card.
  state.inputLocked = false;
  showTutorialHint();
}

function showTutorialFinish() {
  const f = $('tutorial-finish');
  if (f) f.classList.add('active');
  // Hide the dialog while the finish prompt is up.
  const ovl = $('tutorial-overlay');
  if (ovl) ovl.style.display = 'none';
}

// Called when the player picks Continue or Return from the finish prompt.
// keepPlaying === true: drop tutorial mode, refill the room, normal play
// resumes (and the run is scored on victory/defeat). false: back to menu.
function finishTutorial(keepPlaying) {
  const f = $('tutorial-finish');
  if (f) f.classList.remove('active');
  const ovl = $('tutorial-overlay');
  if (ovl) ovl.style.display = '';
  state.tutorialMode = false;
  document.body.classList.remove('tutorial-mode');
  if (!keepPlaying) {
    state.isOver = true;
    showScreen('menu');
    return;
  }
  // Continue: deal the next room and let the game play out normally.
  state.inputLocked = false;
  refillRoom();
}

// -----------------------------------------------------------
// NEW GAME / END GAME
// -----------------------------------------------------------
function newGame(diff, tutorial) {
  if (diff) state.difficulty = diff;
  const cfg = DIFFICULTY[state.difficulty];
  state.maxHp = cfg.hp;
  state.hp = cfg.hp;
  state.tutorialMode = !!tutorial;
  state.tutorialStep = 0;
  state.deck = shuffle(buildDeck(state.difficulty));
  if (state.tutorialMode) {
    // Force the first 4 cards drawn to be the scripted tutorial sequence.
    // Pull them out of wherever the shuffle dropped them and prepend in order.
    const tut = [
      { suit: 'clubs',    value: 3 },
      { suit: 'diamonds', value: 5 },
      { suit: 'spades',   value: 4 },
      { suit: 'hearts',   value: 6 }
    ];
    for (const tc of tut) {
      const idx = state.deck.findIndex(c => c.suit === tc.suit && c.value === tc.value);
      if (idx >= 0) state.deck.splice(idx, 1);
    }
    state.deck = tut.concat(state.deck);
  }
  state.room = [null, null, null, null];
  state.weapon = null;
  state.weaponSheathed = false;
  state.lastMonsterValue = null;
  state.weaponStack = [];
  state.skipsLeft = cfg.skips;
  state.cardsCleared = 0;
  state.monstersDefeated = 0;
  state.damageTaken = 0;
  state.potionsUsed = 0;
  state.weaponsEquipped = 0;
  // v0.6.1 — efficiency tracking for the high-score formula.
  state.startTime = Date.now();
  state.endTime = null;
  state.bareHits = 0;     // bare-handed fights when a weapon was usable
  state.fullHpHits = 0;   // hits taken at full HP (potion was wasted)
  state.inputLocked = false;
  state.isOver = false;
  state.undoSnapshot = null;
  state.undoUsed = false;
  state.undoAllowed = cfg.undo;
  state.showPeek = cfg.peek;
  state.atmosphereMilestonesFired = [];
  _resetRenderCache();
  setAtmosphere(0); // reset to Antechamber on every new run

  // Apply mode class on <body> so the CSS strip / cutscene bypass takes effect
  // BEFORE the game screen appears. mode-quick hides the trainer + decorations
  // and short-circuits the cutscene; mode-adventure is the full presentation.
  document.body.classList.toggle('mode-quick', state.mode === 'quick');
  document.body.classList.toggle('mode-adventure', state.mode !== 'quick');
  document.body.classList.toggle('tutorial-mode', state.tutorialMode);

  // Adventure mode entry (v0.6.0): open the door, zoom in through it, settle.
  // Combines the zoom-intro keyframe with the new door-swing for a "we just
  // walked into the crypt" feel rather than a hard scene cut.
  const arena = qs('.dungeon-arena');
  const treasure = $('treasure-room');
  if (treasure) treasure.classList.remove('active');
  closeDungeonDoor();
  resetCameraZoom();
  if (arena) {
    arena.classList.remove('zoom-intro');
    if (state.mode === 'adventure') {
      // Door pre-opens so the zoom-in reveals the room beyond. After the
      // zoom-in settles, the door swings shut behind the trainer.
      openDungeonDoor();
      void arena.offsetWidth;
      arena.classList.add('zoom-intro');
      setTimeout(() => closeDungeonDoor(), 1100);
      setTimeout(() => arena.classList.remove('zoom-intro'), 1300);
    }
  }

  showScreen('game');
  hideOverlay('pause'); hideOverlay('defeat'); hideOverlay('victory');
  Player.render('idle');
  renderRoom();
  renderHp();
  renderHud();
  updatePeek();
  const modeLabel = state.mode === 'quick' ? 'Quick Play' : 'Adventure';
  log(`Descend into the Crypt — ${cfg.label} · ${modeLabel}`);
  // Initial deal animation
  setTimeout(() => refillRoom(), 250);
}

function endGame(victory) {
  state.inputLocked = true;
  state.endTime = Date.now();         // v0.6.1 — freeze the time-bonus clock
  const treasure = $('treasure-room');
  const adventureWin = victory && state.mode === 'adventure' && treasure;

  if (adventureWin) {
    // Treasure-room entry cinematic (v0.6.0). Trainer walks to the door, the
    // door opens revealing the treasure room beyond, the trainer walks IN from
    // the far-left toward the gold pile, then the victory frame lands.
    Audio.play('victory');
    walkPlayerToCorridor();                 // t=0  — walk to door
    setTimeout(() => openDungeonDoor(), 250);
    setTimeout(() => {
      treasure.classList.add('active');     // t=520 — treasure scene appears
      Audio.play('treasure');
    }, 520);

    const player = document.getElementById('player-layer');
    setTimeout(() => {
      // t=920 — teleport player to far-left of the treasure scene (above
      // the overlay) then walk across toward the pile. Disable transition
      // for the teleport, force reflow, re-enable for the walk.
      if (player) {
        player.style.transition = 'none';
        player.style.transform = 'translate(-360px, -180px) scale(1)';
        player.style.opacity = '1';
        player.style.zIndex = '40';   // above treasure-room (z-index 30)
        void player.offsetWidth;
        player.style.transition = 'transform 1500ms cubic-bezier(0.4, 0, 0.5, 1)';
        requestAnimationFrame(() => {
          // walk to a spot left-of-pile so trainer + treasure both visible
          player.style.transform = 'translate(-90px, -180px) scale(1.05)';
        });
      }
    }, 920);

    // v0.6.1 — instead of auto-advancing to the score frame after 2.7s,
    // wait for the player to click "CONTINUE" in the treasure room. This
    // lets them savor the win.
    const advanceToVictory = () => {
      flashScreen('gold');
      const stats = computeStats();
      $('victory-stats').innerHTML = renderStats(stats);
      saveBest(stats);
      showOverlay('victory');
      if (player) {
        player.style.transition = '';
        player.style.transform = '';
        player.style.opacity = '';
        player.style.zIndex = '';
      }
      treasure.classList.remove('active');
      closeDungeonDoor();
    };
    const continueBtn = $('treasure-continue');
    if (continueBtn) {
      const handler = (e) => {
        e.stopPropagation();
        continueBtn.removeEventListener('click', handler);
        document.removeEventListener('keydown', keyHandler);
        advanceToVictory();
      };
      const keyHandler = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          continueBtn.removeEventListener('click', handler);
          document.removeEventListener('keydown', keyHandler);
          advanceToVictory();
        }
      };
      continueBtn.addEventListener('click', handler);
      document.addEventListener('keydown', keyHandler);
    } else {
      // Fallback if the markup is missing: auto-advance after the original delay.
      setTimeout(advanceToVictory, 2700);
    }
    return;
  }

  // Non-adventure victory + all defeats: original path (no cinematic).
  setTimeout(() => {
    if (victory) {
      Audio.play('victory');
      flashScreen('gold');
      const stats = computeStats();
      $('victory-stats').innerHTML = renderStats(stats);
      saveBest(stats);
      showOverlay('victory');
    } else {
      Audio.play('death');
      flashScreen('red');
      const stats = computeStats();
      $('defeat-stats').innerHTML = renderStats(stats);
      showOverlay('defeat');
    }
  }, 700);
}

// v0.6.1 — score formula rewritten around skill, not raw activity.
// Components (before difficulty multiplier):
//   clear_bonus   200 if the deck was cleared (you reached the treasure room)
//   hp_bonus      hp_remaining * 8   (rewards survival)
//   monster_bonus monstersDefeated * 4
//   time_bonus    max(0, 200 - elapsedSeconds)   (faster = better, cap 200)
//   mistake_pen   bareHits * 12 + fullHpHits * 6   (penalises sloppy play)
// The whole stack is multiplied by the difficulty mult (Damned ×4 → Wanderer ×0.7).
// Scores are floored to 0 so a bad run can't go negative.
function computeStats() {
  const cfg = DIFFICULTY[state.difficulty];
  if (!state.endTime) state.endTime = Date.now();
  const elapsedMs = state.startTime ? (state.endTime - state.startTime) : 0;
  const elapsedSeconds = Math.round(elapsedMs / 1000);
  const deckCleared = state.deck.length === 0 && state.room.every(c => c === null);

  const clearBonus    = deckCleared ? 200 : 0;
  const hpBonus       = state.hp * 8;
  const monsterBonus  = state.monstersDefeated * 4;
  const timeBonus     = Math.max(0, 200 - elapsedSeconds);
  const mistakePenalty = state.bareHits * 12 + state.fullHpHits * 6;

  const raw = (clearBonus + hpBonus + monsterBonus + timeBonus - mistakePenalty);
  const score = Math.max(0, Math.round(raw * cfg.mult));
  return {
    difficulty: cfg.label,
    diffKey: state.difficulty,
    mode: state.mode,
    cardsCleared: state.cardsCleared,
    monstersDefeated: state.monstersDefeated,
    damageTaken: state.damageTaken,
    potionsUsed: state.potionsUsed,
    weaponsEquipped: state.weaponsEquipped,
    hpRemaining: state.hp,
    skipsLeft: state.skipsLeft === Infinity ? '∞' : state.skipsLeft,
    elapsedSeconds,
    bareHits: state.bareHits,
    fullHpHits: state.fullHpHits,
    deckCleared,
    score,
    date: Date.now()
  };
}

function _fmtTime(s) {
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function renderStats(s) {
  // Pull the top-5 leaderboard for this run's mode + difficulty so the
  // overlay shows where this score lands.
  const top = loadTopScores(s.mode, s.diffKey);
  const myRank = top.findIndex(t => t.date === s.date && t.score === s.score);
  const leaderRows = top.length
    ? top.map((t, i) => {
        const me = (i === myRank);
        return `<tr class="${me ? 'me' : ''}">
          <td>${i + 1}</td>
          <td>${t.score}</td>
          <td>${_fmtTime(t.elapsedSeconds || 0)}</td>
          <td>${t.hpRemaining ?? '—'}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="4" class="empty">no records yet</td></tr>`;

  return `
    <div class="stat-label">Mode</div><div class="stat-value">${s.mode === 'quick' ? 'Quick Play' : 'Adventure'}</div>
    <div class="stat-label">Difficulty</div><div class="stat-value">${s.difficulty}</div>
    <div class="stat-label">Vitality</div><div class="stat-value">${s.hpRemaining}</div>
    <div class="stat-label">Time</div><div class="stat-value">${_fmtTime(s.elapsedSeconds)}</div>
    <div class="stat-label">Monsters Slain</div><div class="stat-value">${s.monstersDefeated}</div>
    <div class="stat-label">Damage Taken</div><div class="stat-value">${s.damageTaken}</div>
    <div class="stat-label">Bare-handed Hits</div><div class="stat-value">${s.bareHits}</div>
    <div class="stat-label">Full-HP Hits</div><div class="stat-value">${s.fullHpHits}</div>
    <div class="stat-label" style="border-top:1px solid rgba(201,168,87,0.3);padding-top:8px;margin-top:6px;grid-column:1">Score</div>
    <div class="stat-value" style="border-top:1px solid rgba(201,168,87,0.3);padding-top:8px;margin-top:6px;font-size:22px;">${s.score}</div>
    <div class="leaderboard" style="grid-column:1 / -1">
      <div class="leaderboard-title">Top 5 — ${s.mode === 'quick' ? 'Quick Play' : 'Adventure'} · ${s.difficulty}</div>
      <table>
        <thead><tr><th>#</th><th>Score</th><th>Time</th><th>HP</th></tr></thead>
        <tbody>${leaderRows}</tbody>
      </table>
    </div>
  `;
}

// v0.6.1 — top-5 leaderboard per (mode, difficulty). Stored under
// `top5_<mode>_<diff>` in the save blob. Saves all entries; `loadTopScores`
// returns the top 5 sorted desc by score.
function _topKey(mode, diff) { return `top5_${mode}_${diff}`; }
function loadTopScores(mode, diff) {
  const save = loadSave() || {};
  const arr = save[_topKey(mode, diff)] || [];
  return [...arr].sort((a, b) => b.score - a.score).slice(0, 5);
}
function saveBest(s) {
  const save = loadSave() || {};
  const key = _topKey(s.mode, s.diffKey);
  const list = save[key] || [];
  list.push({
    score: s.score, hpRemaining: s.hpRemaining,
    elapsedSeconds: s.elapsedSeconds, deckCleared: s.deckCleared,
    bareHits: s.bareHits, fullHpHits: s.fullHpHits,
    date: s.date
  });
  // Keep at most top-10 stored (display top 5; storing more buffers ties).
  list.sort((a, b) => b.score - a.score);
  save[key] = list.slice(0, 10);
  // Legacy single-best key kept for backward compat (consumed by menu line).
  const legacyKey = 'best_' + s.diffKey;
  if (!save[legacyKey] || s.score > save[legacyKey].score) {
    save[legacyKey] = s;
  }
  saveData(save);
}
function refreshBestScoreLine() {
  const save = loadSave() || {};
  const cfg = DIFFICULTY[state.difficulty];
  // Show best across BOTH modes for the current difficulty so the menu
  // surfaces the player's PR regardless of which mode they last played.
  const adv = (save[_topKey('adventure', state.difficulty)] || [])[0];
  const qk  = (save[_topKey('quick',     state.difficulty)] || [])[0];
  const best = (adv && (!qk || adv.score >= qk.score)) ? { ...adv, mode: 'Adv' }
             : (qk ? { ...qk, mode: 'Qk' } : null);
  $('best-score-line').textContent =
    best ? `Best (${cfg.label} · ${best.mode}): ${best.score} pts · ${_fmtTime(best.elapsedSeconds || 0)}`
         : `Best (${cfg.label}): —`;
}

// -----------------------------------------------------------
// PAUSE
// -----------------------------------------------------------
function togglePause() {
  const ovl = $('overlay-pause');
  if (ovl.classList.contains('active')) hideOverlay('pause');
  else showOverlay('pause');
}

// -----------------------------------------------------------
// DIFFICULTY UI
// -----------------------------------------------------------
function selectDifficulty(diff) {
  state.difficulty = diff;
  qsa('.diff-card').forEach(el => el.classList.toggle('selected', el.dataset.diff === diff));
  $('diff-label').textContent = DIFFICULTY[diff].label;
  saveData({ lastDifficulty: diff });
  refreshBestScoreLine();
}

// -----------------------------------------------------------
// OPTIONS / TOGGLES
// -----------------------------------------------------------
function applyOptionsFromInputs() {
  state.options.sfx   = $('opt-sfx').checked;
  state.options.music = $('opt-music').checked;
  state.options.anim  = $('opt-anim').checked;
  state.options.tip   = $('opt-tip').checked;
  Audio.setSfx(state.options.sfx);
  Audio.setMusic(state.options.music);
  document.body.classList.toggle('no-anim', !state.options.anim);
  saveData({ options: state.options });
}
function loadOptions() {
  const save = loadSave() || {};
  const o = save.options || state.options;
  state.options = {...state.options, ...o};
  $('opt-sfx').checked   = state.options.sfx;
  $('opt-music').checked = state.options.music;
  $('opt-anim').checked  = state.options.anim;
  $('opt-tip').checked   = state.options.tip;
  Audio.setSfx(state.options.sfx);
  Audio.setMusic(state.options.music);
  // Apply the animations preference to <body> on load (not just on toggle) so a
  // saved "animations off" actually disables motion from the first frame.
  document.body.classList.toggle('no-anim', !state.options.anim);

  if (save.lastDifficulty) {
    // Map legacy v0.4.x difficulty keys to the v0.4.9 5-tier ladder so saves
    // from before the rework don't snap back to default. easy → apprentice
    // (closest equivalent: peek+undo+3-flees), normal → adventurer, hard →
    // vanquisher (no undo / no peek), nightmare → damned. New 'wanderer' tier
    // has no legacy equivalent — only reachable by selecting it explicitly.
    const LEGACY_DIFF_MAP = {
      easy: 'apprentice', normal: 'adventurer', hard: 'vanquisher', nightmare: 'damned'
    };
    const mapped = LEGACY_DIFF_MAP[save.lastDifficulty] || save.lastDifficulty;
    if (DIFFICULTY[mapped]) {
      state.difficulty = mapped;
      selectDifficulty(mapped);
    }
  }
  if (save.lastMode === 'quick' || save.lastMode === 'adventure') {
    state.mode = save.lastMode;
  }
  refreshBestScoreLine();
}

// -----------------------------------------------------------
// EVENT WIRING
// -----------------------------------------------------------
function wireEvents() {
  // Menu buttons (navigation)
  qsa('[data-menu]').forEach(btn => {
    btn.addEventListener('click', () => {
      Audio.play('click');
      const action = btn.dataset.menu;
      if (action === 'play') newGame();   // legacy path; current menu uses data-mode
      else if (action === 'tutorial') {
        // Tutorial = real game run with a scripted first room. Mode defaults
        // to quick (no door cinematic between cards) so the script flows fast.
        state.mode = 'quick';
        saveData({ lastMode: state.mode });
        newGame(undefined, true);
      }
      else showScreen(action);
    });
  });
  // Mode buttons — Adventure / Quick Play. Sets state.mode then starts a run.
  qsa('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      Audio.play('click');
      state.mode = btn.dataset.mode === 'quick' ? 'quick' : 'adventure';
      saveData({ lastMode: state.mode });
      newGame();
    });
  });
  // Adventure-mode entity clicks. The entities persist across renders so we
  // wire clicks once at init (not per render). Same handler as cards — the
  // slot index lives on data-slot.
  qsa('.adv-entity').forEach(entity => {
    entity.addEventListener('click', (e) => {
      if (entity.classList.contains('empty') || entity.classList.contains('consumed')) return;
      const idx = parseInt(entity.dataset.slot, 10);
      if (Number.isFinite(idx)) onCardClick(idx, e);
    });
  });
  // Back buttons
  qsa('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => {
      Audio.play('click');
      showScreen(btn.dataset.back);
    });
  });
  // Difficulty cards — one click selects the peril AND returns to the menu
  // (no separate Confirm step). A brief "ignite" flourish plays on the chosen
  // card before the screen slides back so the choice registers visually.
  qsa('.diff-card').forEach(card => {
    card.addEventListener('click', () => {
      if (card._igniting) return;          // guard against double-fire mid-flourish
      Audio.play('click');
      selectDifficulty(card.dataset.diff);
      const flourish = !document.body.classList.contains('no-anim')
        && !matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (flourish) {
        card._igniting = true;
        card.classList.remove('igniting'); void card.offsetWidth;
        card.classList.add('igniting');
        setTimeout(() => {
          card.classList.remove('igniting');
          card._igniting = false;
          showScreen('menu');
        }, 360);
      } else {
        showScreen('menu');
      }
    });
  });

  // Intro splash overlay — first thing the player sees on load. Either button
  // ([X] or "Enter the Crypt") dismisses it and reveals the home menu.
  qsa('[data-intro="dismiss"]').forEach(btn => {
    btn.addEventListener('click', () => {
      Audio.unlock();
      const overlay = document.getElementById('overlay-intro');
      if (overlay) overlay.classList.remove('active');
      Audio.play('click');
    });
  });

  // Tutorial overlay wiring — OK button + finish prompt buttons. The overlay
  // is driven by the TUTORIAL_SCRIPT controller defined above newGame(); these
  // handlers just connect the DOM events.
  $('tut-ok-btn')?.addEventListener('click', () => {
    Audio.play('click');
    advanceTutorialStep();
  });
  $('tut-finish-continue')?.addEventListener('click', () => {
    Audio.play('click');
    finishTutorial(true);
  });
  $('tut-finish-exit')?.addEventListener('click', () => {
    Audio.play('click');
    finishTutorial(false);
  });
  // Keep the spotlight/dialog locked onto its target through resize & rotate.
  window.addEventListener('resize', () => {
    if (state.tutorialMode) positionTutorialBubble();
  });

  // Desktop pointer-tilt on room cards — the card leans toward the cursor in
  // 3D (the slot already has perspective). Delegated on #room-row so it keeps
  // working across re-renders. Cleared on exit and respects the anim toggle.
  const roomRow = $('room-row');
  if (roomRow && window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    roomRow.addEventListener('mousemove', (e) => {
      if (!state.options.anim) return;
      const card = e.target.closest && e.target.closest('.card');
      if (!card || card.classList.contains('consumed')) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width  - 0.5;   // -0.5 .. 0.5
      const py = (e.clientY - r.top)  / r.height - 0.5;
      card.classList.add('tilting');
      card.style.transform =
        `translateY(-12px) rotateX(${(-py * 12).toFixed(2)}deg) rotateY(${(px * 15).toFixed(2)}deg) scale(1.04)`;
    }, { passive: true });
    roomRow.addEventListener('mouseout', (e) => {
      const card = e.target.closest && e.target.closest('.card');
      if (!card) return;
      if (e.relatedTarget && card.contains(e.relatedTarget)) return;  // still inside the card
      card.style.transform = '';
      card.classList.remove('tilting');
    });
  }

  // Pointer parallax — drift the far wall + colour grade against the static
  // play layer for depth. Desktop pointers only; honours the animation toggle
  // and reduced-motion; throttled to one update per frame.
  if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let parRaf = 0, pmx = 0, pmy = 0;
    window.addEventListener('mousemove', (e) => {
      if (!state.options.anim) return;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      pmx = (e.clientX / window.innerWidth  - 0.5) * 2;
      pmy = (e.clientY / window.innerHeight - 0.5) * 2;
      if (parRaf) return;
      parRaf = requestAnimationFrame(() => {
        parRaf = 0;
        const root = document.documentElement.style;
        root.setProperty('--par-x', pmx.toFixed(3));
        root.setProperty('--par-y', pmy.toFixed(3));
      });
    }, { passive: true });
  }

  // In-game controls
  $('skip-btn').addEventListener('click', () => { Audio.play('click'); doSkip(); });
  $('undo-btn').addEventListener('click', () => doUndo());
  $('pause-btn').addEventListener('click', () => { Audio.play('click'); togglePause(); });

  // Sheathe / draw the equipped blade (touch-friendly bare-hand toggle).
  // Delegated on the stable #weapon-stack parent since the weapon card is
  // re-rendered on every renderWeapon() call.
  const weaponStack = $('weapon-stack');
  if (weaponStack) {
    weaponStack.addEventListener('click', (e) => {
      if (e.target.closest('.weapon-card')) toggleSheathe();
    });
    weaponStack.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.weapon-card')) {
        e.preventDefault();
        toggleSheathe();
      }
    });
  }

  // Pause overlay buttons
  qsa('[data-pause]').forEach(btn => {
    btn.addEventListener('click', () => {
      Audio.play('click');
      const a = btn.dataset.pause;
      if (a === 'resume') hideOverlay('pause');
      else if (a === 'restart') { hideOverlay('pause'); newGame(); }
      else if (a === 'menu') { hideOverlay('pause'); showScreen('menu'); refreshBestScoreLine(); Audio.setMusic(false); }
    });
  });
  // End overlay buttons
  qsa('[data-end]').forEach(btn => {
    btn.addEventListener('click', () => {
      Audio.play('click');
      const a = btn.dataset.end;
      hideOverlay('defeat'); hideOverlay('victory');
      if (a === 'restart') newGame();
      else if (a === 'menu') { showScreen('menu'); refreshBestScoreLine(); Audio.setMusic(false); }
    });
  });

  // Pause overlay toggles (mirrors)
  qs('.ovl-music').addEventListener('change', (e) => {
    state.options.music = e.target.checked;
    $('opt-music').checked = e.target.checked;
    Audio.setMusic(state.options.music);
    saveData({ options: state.options });
  });
  qs('.ovl-sfx').addEventListener('change', (e) => {
    state.options.sfx = e.target.checked;
    $('opt-sfx').checked = e.target.checked;
    Audio.setSfx(state.options.sfx);
    saveData({ options: state.options });
  });

  // Options inputs
  ['opt-sfx','opt-music','opt-anim','opt-tip'].forEach(id => {
    $(id).addEventListener('change', () => {
      applyOptionsFromInputs();
      // mirror to pause overlay
      qs('.ovl-music').checked = state.options.music;
      qs('.ovl-sfx').checked = state.options.sfx;
    });
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    const gameActive = qs('.screen.active')?.dataset.screen === 'game';
    // Cutscene skip — Esc during a cutscene jumps to the resolved end-state.
    // This branch must run BEFORE the pause toggle so Esc doesn't pause mid-cutscene.
    if (Cutscene.isActive()) {
      if (e.key === 'Escape') Cutscene.skip();
      return; // block all other key input during a cutscene
    }
    if (e.key === 'Escape') {
      if (gameActive && !state.isOver) togglePause();
    }
    if (!gameActive || state.inputLocked || state.isOver) return;
    if (e.key === 'f' || e.key === 'F') doSkip();
    if (e.key === 'u' || e.key === 'U') doUndo();
    if (e.key === 'd' || e.key === 'D') {
      // toggle peek if difficulty allows
      if (DIFFICULTY[state.difficulty].peek) {
        state.showPeek = !state.showPeek;
        updatePeek();
      }
    }
    if (['1','2','3','4'].includes(e.key)) {
      const idx = parseInt(e.key) - 1;
      const card = state.room[idx];
      if (card) onCardClick(idx, e);
    }
  });

  // Unlock the AudioContext on the first user interaction (browsers block it before a gesture)
  const unlockOnce = () => { Audio.unlock(); };
  document.addEventListener('pointerdown', unlockOnce, { once: true });
  document.addEventListener('keydown',     unlockOnce, { once: true });
}

// -----------------------------------------------------------
// INIT
// -----------------------------------------------------------
function init() {
  loadOptions();
  selectDifficulty(state.difficulty);
  wireEvents();
  showScreen('menu');
}

document.addEventListener('DOMContentLoaded', init);
