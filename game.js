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

const DIFFICULTY = {
  easy:      { hp: 20, skips: 3, undo: true,  peek: true,  label: 'Easy',      mult: 1.0 },
  normal:    { hp: 20, skips: 1, undo: true,  peek: false, label: 'Normal',    mult: 1.5 },
  hard:      { hp: 20, skips: 0, undo: true,  peek: false, label: 'Hard',      mult: 2.5 },
  nightmare: { hp: 18, skips: 0, undo: false, peek: false, label: 'Nightmare', mult: 4.0 }
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
const ATMOSPHERE_ANCHORS = [
  { at: 0.00, // Antechamber (warm ambient, slight golden ambient overlay)
    flameInner:[255,245,212], flameMid:[255,184, 74], flameOuter:[217,122, 60], flameBase:[139, 26, 26],
    glowStrong:[217,122, 60,0.42], glowWeak:[217,122, 60,0.16],
    vignMid:[ 12,  6,  0,0.55],   vignEdge:[  4,  2,  0,0.95],
    overlay:[ 90, 60, 30,0.20],
    bgHue: 0,    bgSat: 1.0, bgBri: 1.0
  },
  { at: 0.18, // Catacombs — cool green-blue, dim
    flameInner:[232,244,255], flameMid:[168,196,216], flameOuter:[ 80,120,168], flameBase:[ 26, 40, 72],
    glowStrong:[ 80,140,200,0.55], glowWeak:[ 80,140,200,0.22],
    vignMid:[  0,  8, 18,0.72],   vignEdge:[  0,  4, 10,0.97],
    overlay:[ 50,120, 90,0.42],
    bgHue: 130,  bgSat: 0.7, bgBri: 0.85
  },
  { at: 0.42, // Reliquary — violet ritual
    flameInner:[255,232,255], flameMid:[216,168,232], flameOuter:[160, 80,208], flameBase:[ 72, 26, 74],
    glowStrong:[176,104,208,0.58], glowWeak:[176,104,208,0.24],
    vignMid:[ 24,  0, 36,0.76],   vignEdge:[ 12,  0, 20,0.98],
    overlay:[120, 40,170,0.48],
    bgHue: 220,  bgSat: 1.1, bgBri: 0.85
  },
  { at: 0.66, // Sanctum — crimson, deeply saturated
    flameInner:[255,224,224], flameMid:[255,128, 96], flameOuter:[216, 56, 56], flameBase:[ 74,  8,  8],
    glowStrong:[216, 56, 56,0.62], glowWeak:[216, 56, 56,0.26],
    vignMid:[ 48,  0,  0,0.80],   vignEdge:[ 24,  0,  0,0.99],
    overlay:[170, 20, 20,0.55],
    bgHue: 340,  bgSat: 1.5, bgBri: 0.80
  },
  { at: 0.88, // Throne — deep red-violet, dim, otherworldly
    flameInner:[255,255,255], flameMid:[255,232,160], flameOuter:[255,208,112], flameBase:[128, 96, 16],
    glowStrong:[255,232,160,0.66], glowWeak:[255,232,160,0.28],
    vignMid:[ 48,  0, 24,0.88],   vignEdge:[ 24,  0, 12,1.00],
    overlay:[100, 10, 60,0.62],
    bgHue: 290,  bgSat: 1.7, bgBri: 0.70
  }
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
  if (banner) banner.textContent = _stageNameFor(progress);
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
function buildDeck() {
  // Spades & Clubs: 2..14 (full)
  // Hearts & Diamonds: 2..10 (red royals + Aces removed)
  const deck = [];
  for (const suit of ['spades','clubs']) {
    for (let v=2; v<=14; v++) deck.push({ suit, value: v });
  }
  for (const suit of ['hearts','diamonds']) {
    for (let v=2; v<=10; v++) deck.push({ suit, value: v });
  }
  return deck; // 13+13+9+9 = 44
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
  difficulty: 'normal',
  hp: 20,
  maxHp: 20,
  deck: [],
  room: [null, null, null, null],     // 4 fixed slots; null = empty
  weapon: null,                       // { suit: 'diamonds', value: N }
  lastMonsterValue: null,
  weaponStack: [],                    // monsters defeated under current weapon
  skipsLeft: 1,
  cardsCleared: 0,
  monstersDefeated: 0,
  damageTaken: 0,
  potionsUsed: 0,
  weaponsEquipped: 0,
  inputLocked: false,
  isOver: false,
  undoSnapshot: null,
  undoUsed: false,
  undoAllowed: true,
  showPeek: false,
  atmosphereMilestonesFired: [],
  options: { sfx: true, music: false, anim: true, tip: true }
};

const $ = (id) => document.getElementById(id);
const qs  = (sel, root=document) => root.querySelector(sel);
const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));

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
// PLAYER SPRITE — cloaked wanderer (back-facing, 16x16)
// =============================================================
// Warm tan/leather cloak — needs to stand out clearly against the dark dungeon stone.
// (Earlier dark-brown palette blended into the background.)
const PLAYER_PALETTE = {
  '#': '#0a0604',  // outline (kept very dark)
  'O': '#a06030',  // cloak highlight (warm tan — main visual)
  'o': '#704a26',  // cloak mid (warm brown)
  'd': '#3a1f10',  // cloak shadow / hood interior (deep burnt umber)
  'b': '#1a0a04',  // boot — VERY dark for high contrast against the warm cloak
  'e': '#ff8030',  // ember-glint (vivid orange — visible in attack/hurt frames)
  'w': '#f4ebd0',  // weapon-flash highlight / face eyes (bone-pale)
  'y': '#c9a857'   // gold accent (belt buckle, weapon trim — used sparingly)
};

// All player frames are 16x16 back-view. Hood/head rows (0-5) are stable across
// most poses; variations live in the body/cloak/legs (rows 6-15). Weapons are
// composited separately (see Cutscene module) — these sprites only show body
// posture, not the wielded weapon.
const PLAYER_PX = {
  // IDLE — 4-frame loop, ~5 fps. Cloak fold sways gently L→C→R→C.
  // Two eye-glints (w) peer out from inside the hood at row 5 cols 5,10 — gives
  // the figure a visible face cue, otherwise a back-view hood is just a silhouette.
  idle: { fps: 5, loop: true, frames: [
    [
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOddddOO#...','..#OowoooowoO#..','.#OOooooooooOO#.','.#OOooddddooOO#.',
      '.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.',
      '.#OOooooooooOO#.','..#OooooooooO#..','...bbbb..bbbb...','..bbbbb..bbbbb..'
    ],
    [ // fold shifts right
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOddddOO#...','..#OowoooowoO#..','.#OOooooooooOO#.','.#OOoooddddoOO#.',
      '.#OOoooddddoOO#.','.#OOoooddddoOO#.','.#OOoooddddoOO#.','.#OOoooddddoOO#.',
      '.#OOooooooooOO#.','..#OooooooooO#..','...bbbb..bbbb...','..bbbbb..bbbbb..'
    ],
    [ // neutral (== F0)
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOddddOO#...','..#OowoooowoO#..','.#OOooooooooOO#.','.#OOooddddooOO#.',
      '.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.',
      '.#OOooooooooOO#.','..#OooooooooO#..','...bbbb..bbbb...','..bbbbb..bbbbb..'
    ],
    [ // fold shifts left + brief blink (single eye, suggests breathing rhythm)
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOddddOO#...','..#OoeoooooooO#.','.#OOooooooooOO#.','.#OOoddddoooOO#.',
      '.#OOoddddoooOO#.','.#OOoddddoooOO#.','.#OOoddddoooOO#.','.#OOoddddoooOO#.',
      '.#OOooooooooOO#.','..#OooooooooO#..','...bbbb..bbbb...','..bbbbb..bbbbb..'
    ]
  ]},

  // DASH-IN — 3 frames, runs once. Body leans forward, cloak streams back, legs spread.
  dashIn: { fps: 12, loop: false, frames: [
    [ // F0 — start (≈ idle baseline)
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOddddOO#...','..#OooooooooO#..','.#OOooooooooOO#.','.#OOooddddooOO#.',
      '.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.',
      '.#OOooooooooOO#.','..#OooooooooO#..','...bbbb..bbbb...','..bbbbb..bbbbb..'
    ],
    [ // F1 — running stance, cloak hem widens
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOddddOO#...','..#OooooooooO#..','.#OOooooooooOO#.','.#OOooddddooOO#.',
      '.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOoooooooooO#.',
      '.#OoooooooooOOo.','..#OoooooooO#...','...bbb...bbbb...','...bb.....bbb...'
    ],
    [ // F2 — peak dash, cloak fully streaming
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOddddOO#...','..#OooooooooO#..','.#OOooooooooOO#.','.#OOooddddooOO#.',
      '.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOoooooooooO#.','.#OoooooooooOO#.',
      'OoOooooooooooOo.','.#OoooooooOO#...','..bbb.....bbbb..','..bb.......bb...'
    ]
  ]},

  // ATTACK-PIERCE — 4 frames, runs once. Body coils → lunges → recoils.
  attackPierce: { fps: 10, loop: false, frames: [
    [ // F0 — wind-up (cloak coiled, fold widens)
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOddddOO#...','..#OooooooooO#..','.#OOooooooooOO#.','.#OOoddddddoOO#.',
      '.#OOoddddddoOO#.','.#OOoddddddoOO#.','.#OOoddddddoOO#.','.#OOoddddddoOO#.',
      '.#OOooooooooOO#.','..#OooooooooO#..','...bbbb..bbbb...','..bbbbb..bbbbb..'
    ],
    [ // F1 — lunge starts (cloak compressed forward, eye-glint visible)
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOdeddddOO#.','..#OooooooooO#..','.#OOooooooooOO#.','.#OOooooooooOO#.',
      '.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooooooooOO#.',
      '.#OOooooooooOO#.','..#OoooooooO#...','...bbbb..bbb....','...bbb....bb....'
    ],
    [ // F2 — peak extension (body fully forward, cloak compressed)
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOdeddddOO#.','..#OooooooooO#..','.#OOooooooooOO#.','.#OOooooooooOO#.',
      '.#OOoooooooOO#..','.#OOooddddooOO#.','.#OOooooooooOO#.','.#OOooooooooOO#.',
      '..#OoooooooooO#.','..#OoooooooO#...','....bbbb..bbb...','....bbb....bb...'
    ],
    [ // F3 — recoil (returning to idle)
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOddddOO#...','..#OooooooooO#..','.#OOooooooooOO#.','.#OOooddddooOO#.',
      '.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.',
      '.#OOooooooooOO#.','..#OooooooooO#..','...bbbb..bbbb...','..bbbbb..bbbbb..'
    ]
  ]},

  // ATTACK-SLASH — 4 frames, runs once. Body twists right → through center → left → recoil.
  attackSlash: { fps: 8, loop: false, frames: [
    [ // F0 — wind-up, body twisted right (cloak folds right)
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOdeddddOO#.','..#OooooooooO#..','.#OoOoooooooOO#.','.#OOooodddddOO#.',
      '.#OOooodddddOO#.','.#OOooodddddOO#.','.#OOoooddddoOO#.','.#OOoooddddoOO#.',
      '.#OOooooooooOO#.','..#OoooooooO#...','...bbbb..bbbb...','..bbbbb..bbbbb..'
    ],
    [ // F1 — mid-swing through center
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOdeddddOO#.','..#OooooooooO#..','.#OOoooooooOOO#.','.#OOooddddooOO#.',
      '.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.',
      '.#OOooooooooOO#.','..#OooooooooO#..','...bbbb..bbbb...','..bbbbb..bbbbb..'
    ],
    [ // F2 — follow-through, body twisted left (cloak folds left)
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOdeddddOO#.','..#OooooooooO#..','.#OOOoooooooOo#.','.#OOdddddoooOO#.',
      '.#OOdddddoooOO#.','.#OOdddddoooOO#.','.#OOoddddoooOO#.','.#OOoddddoooOO#.',
      '.#OOooooooooOO#.','..#OoooooooO#...','...bbbb..bbbb...','..bbbbb..bbbbb..'
    ],
    [ // F3 — recovery
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOddddOO#...','..#OooooooooO#..','.#OOooooooooOO#.','.#OOooddddooOO#.',
      '.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.',
      '.#OOooooooooOO#.','..#OooooooooO#..','...bbbb..bbbb...','..bbbbb..bbbbb..'
    ]
  ]},

  // ATTACK-SMASH — 4 frames, runs once. Arm raises high → holds → strikes down → impact crouch.
  attackSmash: { fps: 6.67, loop: false, frames: [
    [ // F0 — wind-up high (small O column above hood = arm raised)
      '.......OO.......','.......OO.......','.....######.....','....#OOOOOO#....',
      '...#OOdeddddOO#.','..#OooooooooO#..','.#OOooooooooOO#.','.#OOooddddooOO#.',
      '.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.',
      '.#OOooooooooOO#.','..#OooooooooO#..','...bbbb..bbbb...','..bbbbb..bbbbb..'
    ],
    [ // F1 — hold wind-up (eye-glint, slight tension)
      '.......OO.......','.......OO.......','.....######.....','....#OOOOOO#....',
      '...#OOdeddddOO#.','..#OooooooooO#..','.#OOooooooooOO#.','.#OOoddddddoOO#.',
      '.#OOoddddddoOO#.','.#OOoddddddoOO#.','.#OOoddddddoOO#.','.#OOoddddddoOO#.',
      '.#OOooooooooOO#.','..#OooooooooO#..','...bbbb..bbbb...','..bbbbb..bbbbb..'
    ],
    [ // F2 — striking down (body crouched, cloak compressed)
      '................','................','................','.....######.....',
      '....#OOOOOO#....','...#OOddddOO#...','..#OooooooooO#..','.#OOooooooooOO#.',
      '.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooooooooOO#.',
      '..#OooooooooO#..','...#OOOOOOOO#...','...bbbb..bbbb...','...bbb....bbb...'
    ],
    [ // F3 — impact / recovery (body returning, last frame ≈ idle)
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOddddOO#...','..#OooooooooO#..','.#OOooooooooOO#.','.#OOooddddooOO#.',
      '.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.',
      '.#OOooooooooOO#.','..#OooooooooO#..','...bbbb..bbbb...','..bbbbb..bbbbb..'
    ]
  ]},

  // ATTACK-BARE — 3 frames, runs once. Right punch → left punch → reset.
  attackBare: { fps: 8, loop: false, frames: [
    [ // F0 — right punch (right shoulder forward, left side cloak compressed)
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOdeddddOO#.','..#OooooooooO#..','.#OOoooooooOOO#.','.#OOooddddoOOO#.',
      '.#OOooddddoOOO#.','.#OOooddddoOOO#.','.#OOooddddoOOO#.','.#OOooooooooOO#.',
      '.#OOooooooooOO#.','..#OooooooooO#..','...bbbb..bbbb...','..bbbbb..bbbbb..'
    ],
    [ // F1 — left punch (mirror)
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOdeddddOO#.','..#OooooooooO#..','.#OOOoooooooOO#.','.#OOOoddddooOO#.',
      '.#OOOoddddooOO#.','.#OOOoddddooOO#.','.#OOOoddddooOO#.','.#OOooooooooOO#.',
      '.#OOooooooooOO#.','..#OooooooooO#..','...bbbb..bbbb...','..bbbbb..bbbbb..'
    ],
    [ // F2 — reset
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOddddOO#...','..#OooooooooO#..','.#OOooooooooOO#.','.#OOooddddooOO#.',
      '.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.',
      '.#OOooooooooOO#.','..#OooooooooO#..','...bbbb..bbbb...','..bbbbb..bbbbb..'
    ]
  ]},

  // DRINK — 3 frames, runs once. Bottle raises → quaff → lower.
  drink: { fps: 5, loop: false, frames: [
    [ // F0 — bottle raised at hood-side (single 'w' pixel)
      '................','........w.......','.....######.....','....#OOOOOO#....',
      '...#OOddddOO#...','..#OooooooooO#..','.#OOooooooooOO#.','.#OOooddddooOO#.',
      '.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.',
      '.#OOooooooooOO#.','..#OooooooooO#..','...bbbb..bbbb...','..bbbbb..bbbbb..'
    ],
    [ // F1 — quaff (head tilt suggested by hood asymmetry, bottle still up)
      '........w.......','........w.......','.....######.....','....#OOOOOO#....',
      '...#OOdedddOOO..','..#OooooooooOo..','.#OOooooooooOO#.','.#OOooddddooOO#.',
      '.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.',
      '.#OOooooooooOO#.','..#OooooooooO#..','...bbbb..bbbb...','..bbbbb..bbbbb..'
    ],
    [ // F2 — lower (back to baseline)
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOddddOO#...','..#OooooooooO#..','.#OOooooooooOO#.','.#OOooddddooOO#.',
      '.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.',
      '.#OOooooooooOO#.','..#OooooooooO#..','...bbbb..bbbb...','..bbbbb..bbbbb..'
    ]
  ]},

  // EQUIP-PICKUP — 3 frames, runs once. Crouch → grab → rise.
  equipPickup: { fps: 7.5, loop: false, frames: [
    [ // F0 — crouch (figure compressed, hood lowered)
      '................','................','................','................',
      '.....######.....','....#OOOOOO#....','...#OOddddOO#...','..#OooooooooO#..',
      '.#OOooooooooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooooooooOO#.',
      '..#OoooooooO#...','...#OOOOOOOO#...','...bbbb..bbbb...','...bbb....bbb...'
    ],
    [ // F1 — fully crouched, grabbing (small w glint at hand)
      '................','................','................','................',
      '.....######.....','....#OOOOOO#....','...#OOddddOO#...','..#OooooooooO#..',
      '.#OOooooooooOO#.','.#OOooddddooOO#.','.#OOoooooooooO#.','.#OoooooooooOO#.',
      '....wwooooowww..','....bbbb.bbbb...','....bbb...bbb...','....bb.....bb...'
    ],
    [ // F2 — rising (back to standing, ≈ idle)
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOddddOO#...','..#OooooooooO#..','.#OOooooooooOO#.','.#OOooddddooOO#.',
      '.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.',
      '.#OOooooooooOO#.','..#OooooooooO#..','...bbbb..bbbb...','..bbbbb..bbbbb..'
    ]
  ]},

  // HURT — 2 frames, runs once. Recoil with red-glint in hood, then recovery.
  hurt: { fps: 8, loop: false, frames: [
    [ // F0 — recoiled (figure shifted left, ember-glint = visible eye flash)
      '................','................','....######......','...#OOOOOO#.....',
      '..#OOdeddddOO#..','.#OooooooooO#...','#OOooooooooOO#..','#OOooddddooOO#..',
      '#OOooddddooOO#..','#OOooddddooOO#..','#OOooddddooOO#..','#OOooooooooOO#..',
      '.#OoooooooooO#..','..#OoooooooO#...','...bbb..bbb.....','...bb....bb.....'
    ],
    [ // F1 — recovery (≈ idle but with lingering glint)
      '................','................','.....######.....','....#OOOOOO#....',
      '...#OOdeddddOO#.','..#OooooooooO#..','.#OOooooooooOO#.','.#OOooddddooOO#.',
      '.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.','.#OOooddddooOO#.',
      '.#OOooooooooOO#.','..#OooooooooO#..','...bbbb..bbbb...','..bbbbb..bbbbb..'
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

function weaponArchetype(weaponValue) {
  if (weaponValue === 2 || weaponValue === 3) return 'pierce';                 // dagger, short sword
  if (weaponValue === 4 || weaponValue === 6 || weaponValue === 9) return 'slash';   // hand axe, long sword, greatsword
  return 'smash'; // 5 mace, 7 war hammer, 8 battle axe, 10 great axe
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
    // Animations off — preserve legacy card-level flash/shake, then resolve fast.
    const a = action.archetype;
    if (a === 'pierce' || a === 'slash' || a === 'smash' || a === 'bare') shakeCard(slotIndex);
    else if (a === 'drink') flashCard(slotIndex, 'flash-heal');
    else if (a === 'equip') flashCard(slotIndex, 'flash-equip');
    setTimeout(() => {
      if (callbacks.onImpact) callbacks.onImpact();
    }, 240);
    setTimeout(() => {
      if (callbacks.onEnd) callbacks.onEnd();
    }, 820);
  }

  function play(slotIndex, action, callbacks) {
    if (active) return;
    if (!state.options.anim) { _bypass(slotIndex, action, callbacks); return; }

    const timing = CUTSCENE_TIMINGS[action.archetype] || CUTSCENE_TIMINGS.bare;
    active = true;
    impactFired = false;
    pending = { slotIndex, action, callbacks };
    timers = [];

    _setStaging(slotIndex, true);

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

  // 2 — RAT  (small, lower band)
  2: { sz: 38, c: { '#':'#0a0604','o':'#7a5530','O':'#a47540','d':'#3a1f10','e':'#ff3030','t':'#5a3818' },
    g: [
      '................',
      '................',
      '................',
      '................',
      '....##.....##...',
      '...#oO#...#oO#..',
      '....##.....##...',
      '...#######dttttt',
      '..#ooOoOoO#.....',
      '.#oeoOoOoOo###..',
      '#OoOoOoOoOoOoOo#',
      '.#OoOoOoOoOoOo#.',
      '..#OoOoOoOoOO#..',
      '..##..##..##....',
      '................',
      '................'
    ]},

  // 3 — BAT  (wings spread, hovering)
  3: { sz: 46, c: { '#':'#0a0604','o':'#3a2818','O':'#5a3a22','d':'#1a0e08','e':'#ff3030','f':'#fff' },
    g: [
      '................',
      '................',
      '..##.........##.',
      '.#oo#.......#oo#',
      '#oOOo##...##oOOo',
      'doOoOOoo#oodoOOd',
      'd#oOoOoOoOoOoO#d',
      '..#oOoOoOoOoO#..',
      '..#o#.#oo#.#o#..',
      '...##oo##oo##...',
      '....#OoOOoO#....',
      '....#oeooee#....',
      '.....#fofo#.....',
      '......####......',
      '................',
      '................'
    ]},

  // 4 — GOBLIN  (hunched, club, big nose)
  4: { sz: 54, c: { '#':'#0a0604','o':'#5e7a3a','O':'#84a050','d':'#2a3818','e':'#ffe040','n':'#7a4824','a':'#3a2616','w':'#fff' },
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

  // 5 — KOBOLD  (lizardfolk, scaled, tail, horns)
  5: { sz: 56, c: { '#':'#0a0604','o':'#a04020','O':'#d05a30','d':'#5a1a08','e':'#ffe040','h':'#3a1a08','t':'#fff' },
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

  // 6 — SKELETON WARRIOR
  6: { sz: 62, c: { '#':'#0a0604','o':'#e4d4a8','O':'#fff5d4','d':'#7a6a4a','e':'#ff3030','m':'#aaaaaa','M':'#ffffff','s':'#3a2616','b':'#5a3a18' },
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
  7: { sz: 66, c: { '#':'#0a0604','o':'#5a6452','O':'#7e8470','d':'#1a1c14','e':'#88ff44','t':'#3a3a2a','c':'#aabbaa' },
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

  // 8 — ORC  (tusked warrior with axe)
  8: { sz: 70, c: { '#':'#0a0604','o':'#4a6040','O':'#6e8a58','d':'#1a2818','e':'#ff5050','w':'#fff','t':'#fff5d4','a':'#3a2616','m':'#aaaaaa','b':'#5a3818' },
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

  // 9 — TROLL  (huge lumpy)
  9: { sz: 76, c: { '#':'#0a0604','o':'#5a4a6a','O':'#7e6a8e','d':'#1a1424','e':'#ffaa30','b':'#3a2c4a','t':'#e8d8b4','c':'#aabbaa' },
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

  // 10 — WYVERN  (small dragon, wings + tail)
  10: { sz: 82, c: { '#':'#0a0604','o':'#6a2a40','O':'#a04060','d':'#1a0a14','e':'#ffd040','w':'#3a1a24','t':'#fff','y':'#ffaa30' },
    g: [
      '................',
      '....#####.......',
      '...#oOOOO#####..',
      'w##oOOoOoOoOOo#.',
      'w#oOoOoeOoOoOOo#',
      'w#OoOteOoOoOOOoo',
      'w#oo##OoOOOOOOOo',
      'ww##.##oOOOOOOO#',
      '......##oOOOOO##',
      '......##OoOOO##.',
      '......#oOOOO#yyy',
      '....##oOoOoO###y',
      '...#OoOoOoOoO#yy',
      '..#oOoOoOoOoO#y.',
      '..#####OoO#####.',
      '......##.##.....'
    ]},

  // 11 (J) — WRAITH  (hooded ghost)
  11: { sz: 78, c: { '#':'#0a0604','o':'#3a2840','O':'#5a4060','d':'#10081a','e':'#88ccff','m':'#aabbcc','M':'#ffffff','b':'#5a8fbf' },
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

  // 12 (Q) — HAG / WITCH  (pointy hat, staff with skull)
  12: { sz: 76, c: { '#':'#0a0604','o':'#4a2a4a','O':'#6e3e6e','d':'#10081a','s':'#90a878','S':'#b4cc94','e':'#ffaa30','b':'#e8d8b4','g':'#88ff44','w':'#fff','y':'#c9a857' },
    g: [
      '..........#.....',
      '.........###....',
      '........##o##...',
      '.......##oOo##..',
      '......##oOoOo##.',
      '.....##oOoOoOo##',
      '....#####ddd####',
      '...#sSSsSSsSSs#.',
      '...#sSeSwwSeSs#.',
      '....#sSwwSwSs#by',
      '....#sSSSSSs#bb.',
      '...#oOoOoOoOoo#.',
      '..#oOoOoOoOoOOo#',
      '..#oOoOoOoOoOOo#',
      '..#OoOoO##OoOoO#',
      '...##.##..##.##.'
    ]},

  // 13 (K) — DEMON LORD  (horns, wings, sword, crown)
  13: { sz: 88, c: { '#':'#0a0604','o':'#a02020','O':'#d04030','d':'#3a0808','e':'#ffe040','y':'#ffaa30','w':'#5a1010','m':'#c0c0c0','M':'#ffffff','c':'#c9a857','b':'#3a2616' },
    g: [
      '..d............d',
      '.dd...####....dd',
      'wddd.#cccc#..dddw',
      'wddd#cccccc#dddww',
      'ww##oOOOOOOo##ww',
      'w#oOeOOOOeOoOoo#',
      'w#oOOddOddOOoOO#',
      '##oOooOOOooOoOO#',
      '#oOoOoOoOoOoOo##',
      '#oOoOoOoOoOoOOww',
      '##oOoOoOoOoOOww.',
      '.##OoOoOoOoO##..',
      '...##OoOoO##.mb.',
      '....##OoO##.mb..',
      '......###...mb..',
      '......####.bbb..'
    ]},

  // 14 (A) — ANCIENT DRAGON  (full beast)
  14: { sz: 100, c: { '#':'#0a0604','o':'#206040','O':'#388858','d':'#0a1a10','e':'#ffe040','y':'#ffaa30','w':'#1a4028','t':'#fff','s':'#040a06','b':'#3a2616' },
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
  2: { sz: 36, c: { '#':'#0a0604','b':'#aabbcc','B':'#ffffff','h':'#5a3a18','H':'#3a2616','y':'#c9a857' },
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
  3: { sz: 44, c: { '#':'#0a0604','b':'#aabbcc','B':'#ffffff','h':'#5a3a18','H':'#3a2616','y':'#c9a857' },
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

  // 4 — HAND AXE
  4: { sz: 50, c: { '#':'#0a0604','b':'#aabbcc','B':'#ffffff','h':'#5a3a18','H':'#3a2616','d':'#3a4a5a','y':'#c9a857' },
    g: [
      '................',
      '................',
      '....##..........',
      '...#bB##........',
      '..#bBBBBB#......',
      '.#bBBBBdBb#.....',
      '.#bBBBdBb#......',
      '..#bBdBb#.......',
      '....#hH#........',
      '....#hH#........',
      '....#hH#........',
      '....#hH#........',
      '....#hH#........',
      '....#hH#........',
      '....#yy#........',
      '................'
    ]},

  // 5 — MACE  (flanged head)
  5: { sz: 56, c: { '#':'#0a0604','b':'#aabbcc','B':'#ffffff','d':'#3a4a5a','h':'#5a3a18','H':'#3a2616','y':'#c9a857' },
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

  // 6 — LONG SWORD
  6: { sz: 64, c: { '#':'#0a0604','b':'#aabbcc','B':'#ffffff','h':'#5a3a18','H':'#3a2616','y':'#c9a857','r':'#c52828' },
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

  // 7 — WAR HAMMER
  7: { sz: 70, c: { '#':'#0a0604','b':'#aabbcc','B':'#ffffff','d':'#3a4a5a','h':'#5a3a18','H':'#3a2616','y':'#c9a857' },
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
  8: { sz: 78, c: { '#':'#0a0604','b':'#aabbcc','B':'#ffffff','d':'#3a4a5a','h':'#5a3a18','H':'#3a2616','y':'#c9a857' },
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

  // 9 — GREATSWORD  (very long, fancy)
  9: { sz: 86, c: { '#':'#0a0604','b':'#aabbcc','B':'#ffffff','h':'#5a3a18','H':'#3a2616','y':'#c9a857','r':'#7eb8e8' },
    g: [
      '......##........',
      '.....#bB#.......',
      '......#bB#......',
      '......#bB#......',
      '......#bB#......',
      '......#bB#......',
      '......#bB#......',
      '......#bB#......',
      '......#bB#......',
      '..#yyyyBByyy#...',
      '.##.##.##.##.##.',
      '......#hH#......',
      '......#hH#......',
      '......#hH#......',
      '....#yyrryy#....',
      '....##.##.##....'
    ]},

  // 10 — GREAT AXE  (massive double-bladed)
  10: { sz: 96, c: { '#':'#0a0604','b':'#aabbcc','B':'#ffffff','d':'#3a4a5a','h':'#5a3a18','H':'#3a2616','y':'#c9a857' },
    g: [
      '......##........',
      '....######......',
      '..####bBBb####..',
      '.#bBb#bBBb#bBb#.',
      '#bBBb#bBBb#bBBb#',
      '#dBBBbBBBBbBBBd#',
      '#bBBBdBBBBdBBBb#',
      '#dBBBBBBBBBBBBd#',
      '#bBBBBBBBBBBBBb#',
      '.#dBBBBBBBBBBd#.',
      '..#bBBBBBBBBb#..',
      '...#bBBBBBBb#...',
      '....#######.....',
      '......#hH#......',
      '......#hH#......',
      '.....#yyyy#.....'
    ]}
};

const POTION_PX = {

  // 2 — TINY VIAL
  2: { sz: 38, c: { '#':'#0a0604','c':'#3a2616','y':'#c9a857','r':'#ff90a0','R':'#c52828','w':'#fff' },
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
  3: { sz: 44, c: { '#':'#0a0604','c':'#3a2616','y':'#c9a857','r':'#ff90a0','R':'#c52828','w':'#fff' },
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
  4: { sz: 50, c: { '#':'#0a0604','c':'#3a2616','y':'#c9a857','r':'#ff90a0','R':'#c52828','w':'#fff' },
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
  5: { sz: 56, c: { '#':'#0a0604','c':'#3a2616','y':'#c9a857','r':'#ff90a0','R':'#c52828','w':'#fff' },
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
  6: { sz: 62, c: { '#':'#0a0604','c':'#3a2616','y':'#c9a857','r':'#ff90a0','R':'#c52828','w':'#fff' },
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
  7: { sz: 68, c: { '#':'#0a0604','c':'#3a2616','y':'#c9a857','r':'#ff90a0','R':'#c52828','w':'#fff','s':'#ffe040' },
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
  8: { sz: 74, c: { '#':'#0a0604','c':'#3a2616','y':'#c9a857','r':'#ff90a0','R':'#c52828','w':'#fff' },
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
  9: { sz: 82, c: { '#':'#0a0604','c':'#3a2616','y':'#c9a857','r':'#ff90a0','R':'#c52828','w':'#fff','b':'#5a3a18' },
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
  10: { sz: 92, c: { '#':'#0a0604','c':'#3a2616','y':'#c9a857','r':'#ff90a0','R':'#c52828','w':'#fff','b':'#5a3a18','s':'#ffe040' },
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
    && state.weapon
    && state.lastMonsterValue !== null
    && card.value >= state.lastMonsterValue);

  // Outcome badge — predicts what happens if the player resolves this card
  let badgeHtml = '';
  if (kind === 'monster') {
    const useWeapon = state.weapon && (state.lastMonsterValue === null || card.value < state.lastMonsterValue);
    const dmg = useWeapon ? Math.max(0, card.value - state.weapon.value) : card.value;
    const tier = dmg === 0 ? 'safe' : dmg <= 3 ? 'low' : dmg <= 6 ? 'mid' : dmg <= 10 ? 'high' : 'lethal';
    badgeHtml = `<div class="outcome-badge dmg ${tier}" title="Damage if you fight this">
      <span class="badge-icon">⚔</span><span class="badge-num">−${dmg}</span></div>`;
  } else if (kind === 'potion') {
    const heal = Math.min(card.value, state.maxHp - state.hp);
    badgeHtml = `<div class="outcome-badge heal" title="HP restored if you drink this">
      <span class="badge-icon">✚</span><span class="badge-num">+${heal}</span></div>`;
  } else if (kind === 'weapon') {
    badgeHtml = `<div class="outcome-badge equip" title="Damage reduction if equipped">
      <span class="badge-icon">⛨</span><span class="badge-num">−${card.value}</span></div>`;
  }

  slot.innerHTML = `
    <div class="card ${kind} ${constraintLocked ? 'locked-out' : ''} flipping" data-slot="${slotIndex}">
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
}

// Update outcome badges & locked-out state on existing room cards without re-creating them.
function refreshBadges() {
  for (let i = 0; i < 4; i++) {
    const card = state.room[i];
    if (!card) continue;
    const slot = $('slot-' + i);
    if (!slot) continue;
    const cardEl = qs('.card', slot);
    if (!cardEl) continue;
    const badge = qs('.outcome-badge', slot);
    if (!badge) continue;
    const kind = SUIT[card.suit].kind;
    const numEl = qs('.badge-num', badge);
    if (kind === 'monster') {
      const useWeapon = state.weapon && (state.lastMonsterValue === null || card.value < state.lastMonsterValue);
      const dmg = useWeapon ? Math.max(0, card.value - state.weapon.value) : card.value;
      const tier = dmg === 0 ? 'safe' : dmg <= 3 ? 'low' : dmg <= 6 ? 'mid' : dmg <= 10 ? 'high' : 'lethal';
      badge.className = `outcome-badge dmg ${tier}`;
      if (numEl) numEl.textContent = `−${dmg}`;
      const constraintLocked = state.weapon && state.lastMonsterValue !== null && card.value >= state.lastMonsterValue;
      cardEl.classList.toggle('locked-out', constraintLocked);
    } else if (kind === 'potion') {
      const heal = Math.min(card.value, state.maxHp - state.hp);
      if (numEl) numEl.textContent = `+${heal}`;
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
      <div class="weapon-frame" id="weapon-frame">
        <div class="weapon-empty">NO<br>WEAPON</div>
      </div>`;
    meta.innerHTML = '<span style="color:var(--bone-mid)">—</span>';
    _renderCache.weaponSig = null;
    _renderCache.slainSig = null;
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

  html += `
    <div class="slot-card weapon-card${equipChanged ? ' just-equipped' : ''}">
      <div class="slot-corner">
        <span>${VALUE_LABEL[w.value]}</span>
        <span class="sc-suit">${SUIT[w.suit].glyph}</span>
      </div>
      <div class="slot-art">${weaponSvg(w.value, { staticPose: true })}</div>
    </div>`;

  if (state.lastMonsterValue !== null) {
    html += `<div class="weapon-vs">&lt; ${VALUE_LABEL[state.lastMonsterValue]}</div>`;
  }

  stack.innerHTML = html;

  if (state.lastMonsterValue !== null) {
    meta.innerHTML = `${VALUE_LABEL[w.value]}♦<span class="sub-val">&lt; ${VALUE_LABEL[state.lastMonsterValue]}</span>`;
  } else {
    meta.innerHTML = `${VALUE_LABEL[w.value]}♦<span class="sub-val">ready</span>`;
  }

  // Sync the back-strap weapon on the player layer so the equipped weapon is
  // visible at all times during gameplay (not just during cutscenes).
  Player.renderEquippedWeapon();
}

function renderHud() {
  $('deck-count').textContent = state.deck.length;
  $('skip-count').textContent = state.skipsLeft;
  $('skip-count').classList.toggle('zero', state.skipsLeft === 0);
  $('skip-btn').disabled = state.skipsLeft <= 0 || state.inputLocked;
  $('undo-btn').disabled = !state.undoAllowed || !state.undoSnapshot || state.undoUsed || state.inputLocked;
  renderWeapon();
  updateAtmosphere();
}

function renderHp(opts={}) {
  const num = $('hp-number');
  num.textContent = state.hp;
  num.classList.toggle('low', state.hp <= 6);
  const bar = $('hp-bar');
  bar.style.height = Math.max(0, Math.min(100, (state.hp / state.maxHp) * 100)) + '%';
  bar.classList.toggle('low', state.hp <= 6);
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
    const constraintLocked = state.weapon
      && state.lastMonsterValue !== null
      && card.value >= state.lastMonsterValue;
    html += `<span class="tip-title">Fight ${VALUE_NAME[card.value]} of ${sName}</span>`;
    if (state.weapon && !constraintLocked) {
      const dmg = Math.max(0, card.value - state.weapon.value);
      html += `<span class="tip-line">Strike with ${VALUE_LABEL[state.weapon.value]}♦ blade</span>`;
      html += `<span class="tip-line"><strong>Damage taken: ${dmg}</strong></span>`;
      html += `<span class="tip-hint">Hold SHIFT to fight bare-handed</span>`;
    } else if (state.weapon && constraintLocked) {
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
  setTimeout(() => renderHp(), 60);
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
  const kind = SUIT[card.suit].kind;
  if (kind === 'monster') {
    const forceBare = evt && evt.shiftKey;
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
      Audio.play('attack');
      if (damage > 0) {
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
      setTimeout(() => finalizeAction(), 600);
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
      if (heal > 0) applyHpChange(heal);
    },
    onEnd: () => {
      consumeCard(slotIndex);
      // 600ms: consumeCard's internal state-null timeout is at 500ms. finalizeAction
      // must run AFTER that so the refill check sees the just-cleared slot as null.
      // The original v0.3 doFight used 600ms after consumeCard for this reason; v0.4
      // accidentally set it to 400ms and broke the 3-of-4 → refill rule.
      setTimeout(() => finalizeAction(), 600);
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
      state.lastMonsterValue = null;
      state.weaponStack = [];
      state.weaponsEquipped++;
      state.cardsCleared++;
      log(`Equip ${VALUE_LABEL[card.value]}♦ — blade ready`);
      Audio.play('equip');
    },
    onEnd: () => {
      consumeCard(slotIndex);
      renderWeapon();
      // 600ms (matches doFight/doDrink) — must wait for consumeCard's 500ms
      // internal state-null timer so finalizeAction sees the correct remaining count.
      setTimeout(() => finalizeAction(), 600);
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
  if (!cardEl) return;
  cardEl.classList.add('consumed');
  setTimeout(() => {
    state.room[slotIndex] = null;
    renderCard(slotIndex);
  }, 500);
}

function finalizeAction() {
  state.inputLocked = false;
  renderHud();
  refreshBadges();
  if (state.hp <= 0) {
    state.isOver = true;
    return endGame(false);
  }
  // Refill check: when only 1 card remains and deck has cards
  const remaining = state.room.filter(c => c !== null).length;
  const allEmpty = remaining === 0 && state.deck.length === 0;
  if (allEmpty) {
    state.isOver = true;
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
    setTimeout(() => refillRoom(), 320);
  } else if (remaining === 0 && state.deck.length > 0) {
    state.inputLocked = true;
    renderHud();
    setTimeout(() => refillRoom(), 320);
  }
  updatePeek();
}

function refillRoom() {
  // place new cards in empty slots, with stagger
  let delay = 0;
  state.undoUsed = false; // new room → undo refreshed
  for (let i = 0; i < 4; i++) {
    if (state.room[i] === null && state.deck.length > 0) {
      const card = state.deck.shift();
      state.room[i] = card;
      ((idx, d) => {
        setTimeout(() => {
          renderCard(idx);
          Audio.play('card-deal');
        }, d);
      })(i, delay);
      delay += 140;
    }
  }
  setTimeout(() => {
    // Unlock input now that deal animations have finished. (finalizeAction
    // re-locked input before scheduling this refill to prevent a race-click
    // on the surviving card.)
    state.inputLocked = false;
    renderHud();
    updatePeek();
  }, delay + 200);
}

// -----------------------------------------------------------
// SKIP / FLEE
// -----------------------------------------------------------
function doSkip() {
  if (state.inputLocked || state.isOver) return;
  if (state.skipsLeft <= 0) {
    Audio.play('cant');
    hint('No flees remain', 1400);
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
// NEW GAME / END GAME
// -----------------------------------------------------------
function newGame(diff) {
  if (diff) state.difficulty = diff;
  const cfg = DIFFICULTY[state.difficulty];
  state.maxHp = cfg.hp;
  state.hp = cfg.hp;
  state.deck = shuffle(buildDeck());
  state.room = [null, null, null, null];
  state.weapon = null;
  state.lastMonsterValue = null;
  state.weaponStack = [];
  state.skipsLeft = cfg.skips;
  state.cardsCleared = 0;
  state.monstersDefeated = 0;
  state.damageTaken = 0;
  state.potionsUsed = 0;
  state.weaponsEquipped = 0;
  state.inputLocked = false;
  state.isOver = false;
  state.undoSnapshot = null;
  state.undoUsed = false;
  state.undoAllowed = cfg.undo;
  state.showPeek = cfg.peek;
  state.atmosphereMilestonesFired = [];
  _resetRenderCache();
  setAtmosphere(0); // reset to Antechamber on every new run

  showScreen('game');
  hideOverlay('pause'); hideOverlay('defeat'); hideOverlay('victory');
  Player.render('idle');
  renderRoom();
  renderHp();
  renderHud();
  updatePeek();
  log(`Descend into the Crypt — ${cfg.label} difficulty`);
  // Initial deal animation
  setTimeout(() => refillRoom(), 250);
}

function endGame(victory) {
  state.inputLocked = true;
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

function computeStats() {
  const cfg = DIFFICULTY[state.difficulty];
  const score = Math.round(
    (state.hp * 10
      + state.cardsCleared * 5
      + state.skipsLeft * 8
      + state.monstersDefeated * 3
      - state.damageTaken
    ) * cfg.mult
  );
  return {
    difficulty: cfg.label,
    cardsCleared: state.cardsCleared,
    monstersDefeated: state.monstersDefeated,
    damageTaken: state.damageTaken,
    potionsUsed: state.potionsUsed,
    weaponsEquipped: state.weaponsEquipped,
    hpRemaining: state.hp,
    skipsLeft: state.skipsLeft,
    score: Math.max(0, score)
  };
}

function renderStats(s) {
  return `
    <div class="stat-label">Difficulty</div><div class="stat-value">${s.difficulty}</div>
    <div class="stat-label">Vitality</div><div class="stat-value">${s.hpRemaining}</div>
    <div class="stat-label">Cards Cleared</div><div class="stat-value">${s.cardsCleared}</div>
    <div class="stat-label">Monsters Slain</div><div class="stat-value">${s.monstersDefeated}</div>
    <div class="stat-label">Damage Taken</div><div class="stat-value">${s.damageTaken}</div>
    <div class="stat-label">Potions Drunk</div><div class="stat-value">${s.potionsUsed}</div>
    <div class="stat-label">Blades Equipped</div><div class="stat-value">${s.weaponsEquipped}</div>
    <div class="stat-label">Flees Unused</div><div class="stat-value">${s.skipsLeft}</div>
    <div class="stat-label" style="border-top:1px solid rgba(201,168,87,0.3);padding-top:8px;margin-top:6px;grid-column:1">Score</div>
    <div class="stat-value" style="border-top:1px solid rgba(201,168,87,0.3);padding-top:8px;margin-top:6px;font-size:22px;">${s.score}</div>
  `;
}

function saveBest(s) {
  const save = loadSave() || {};
  const key = 'best_' + state.difficulty;
  if (!save[key] || s.score > save[key].score) {
    save[key] = s;
    saveData(save);
  }
}
function refreshBestScoreLine() {
  const save = loadSave() || {};
  const cfg = DIFFICULTY[state.difficulty];
  const best = save['best_' + state.difficulty];
  $('best-score-line').textContent =
    best ? `Best (${cfg.label}): ${best.score} pts · ${best.hpRemaining} HP` : `Best (${cfg.label}): —`;
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
// TUTORIAL
// -----------------------------------------------------------
let tutPage = 0;
function tutNav(delta) {
  const pages = qsa('.tut-page');
  tutPage = Math.max(0, Math.min(pages.length - 1, tutPage + delta));
  pages.forEach((p, i) => p.classList.toggle('active', i === tutPage));
  $('tut-progress').textContent = `${tutPage + 1} / ${pages.length}`;
  $('tut-prev').disabled = tutPage === 0;
  $('tut-next').disabled = tutPage === pages.length - 1;
  $('tut-prev').style.opacity = tutPage === 0 ? 0.4 : 1;
  $('tut-next').style.opacity = tutPage === pages.length - 1 ? 0.4 : 1;
  Audio.play('card-flip');
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

  if (save.lastDifficulty) {
    state.difficulty = save.lastDifficulty;
    selectDifficulty(save.lastDifficulty);
  }
  refreshBestScoreLine();
}

// -----------------------------------------------------------
// EVENT WIRING
// -----------------------------------------------------------
function wireEvents() {
  // Menu buttons
  qsa('[data-menu]').forEach(btn => {
    btn.addEventListener('click', () => {
      Audio.play('click');
      const action = btn.dataset.menu;
      if (action === 'play') newGame();
      else showScreen(action);
    });
  });
  // Back buttons
  qsa('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => {
      Audio.play('click');
      showScreen(btn.dataset.back);
    });
  });
  // Difficulty cards
  qsa('.diff-card').forEach(card => {
    card.addEventListener('click', () => {
      Audio.play('click');
      selectDifficulty(card.dataset.diff);
    });
  });
  qs('[data-difficulty-confirm]').addEventListener('click', () => {
    Audio.play('click');
    showScreen('menu');
  });

  // Tutorial nav
  $('tut-prev').addEventListener('click', () => tutNav(-1));
  $('tut-next').addEventListener('click', () => tutNav(1));

  // In-game controls
  $('skip-btn').addEventListener('click', () => { Audio.play('click'); doSkip(); });
  $('undo-btn').addEventListener('click', () => doUndo());
  $('pause-btn').addEventListener('click', () => { Audio.play('click'); togglePause(); });

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
  tutNav(0);
  showScreen('menu');
}

document.addEventListener('DOMContentLoaded', init);
