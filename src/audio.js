// Sound for The Haunted Glen.
//  - Music: four songs in assets/music, crossfaded by where you are
//    (street by day, street at night, the Emporium, the haunted house).
//  - Sound effects + ambience: all synthesized with Web Audio (no files).
// Everything runs through one master gain, so the 🔊 button mutes it all.

let ctx = null;
let master = null;
let musicBus = null;
let muted = false;
let ambient = null;
let rollBus = null; // scooter wheels
let creekBus = null; // babbling creek
let noiseBuf = null;

// ---------------------------------------------------------------------------
// Music
// ---------------------------------------------------------------------------
const TRACKS = {
  day: { src: 'assets/music/fun-fall-day.mp3', vol: 0.5 }, // walking the street, morning → golden hour
  night: { src: 'assets/music/trick-or-treat-time.mp3', vol: 0.5 }, // trick-or-treat night
  shop: { src: 'assets/music/hip-halloween.mp3', vol: 0.5 }, // Hares Hill Halloween Emporium
  haunted: { src: 'assets/music/woooo.mp3', vol: 0.42 }, // inside the haunted house
};
const tracks = {}; // name -> { el, gain, level, target }
let area = 'world'; // world | shop | haunted
let isNight = false;
let musicTimer = 0;

function currentTrack() {
  if (area === 'shop') return 'shop';
  if (area === 'haunted') return 'haunted';
  return isNight ? 'night' : 'day';
}

function makeTrack(name) {
  if (tracks[name]) return tracks[name];
  const el = new Audio(TRACKS[name].src);
  el.loop = true;
  el.preload = 'auto';
  let gain = null;
  try {
    // through Web Audio so the volume works on iPads (they ignore audio.volume)
    const src = ctx.createMediaElementSource(el);
    gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain).connect(musicBus);
  } catch (e) {
    el.volume = 0;
  }
  const t = { el, gain, level: 0, target: 0, name };
  tracks[name] = t;
  return t;
}

function setTrackLevel(t, v) {
  t.level = v;
  if (t.gain) t.gain.gain.value = v;
  else t.el.volume = Math.min(1, v);
}

function startMusic() {
  // Unlock every song while we're inside the tap that started the sound
  // (iPads only let a song play later if it was started by a finger once).
  for (const name of Object.keys(TRACKS)) {
    const t = makeTrack(name);
    const p = t.el.play();
    if (p && p.then) p.then(() => { if (t.target <= 0) t.el.pause(); }).catch(() => {});
  }
  musicTimer = setInterval(tickMusic, 80);
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) { ctx.suspend(); for (const t of Object.values(tracks)) t.el.pause(); }
    else { ctx.resume(); tickMusic(true); }
  });
}

let lastTick = 0;
function tickMusic(kick = false) {
  if (!ctx || document.hidden) return;
  // fade by real elapsed time, so a busy tablet still crossfades in ~1.2 s
  const nowMs = performance.now();
  const dtS = Math.min(1, lastTick ? (nowMs - lastTick) / 1000 : 0.08);
  lastTick = nowMs;
  const want = currentTrack();
  for (const [name, t] of Object.entries(tracks)) {
    t.target = name === want ? TRACKS[name].vol : 0;
    if (t.target > 0 && (t.el.paused || kick)) { const p = t.el.play(); if (p && p.catch) p.catch(() => {}); }
    // ease toward the target: ~1.2 s crossfade
    const step = dtS / 1.2 * TRACKS[name].vol;
    if (t.level < t.target) setTrackLevel(t, Math.min(t.target, t.level + step));
    else if (t.level > t.target) setTrackLevel(t, Math.max(t.target, t.level - step));
    if (t.level <= 0.0005 && t.target === 0 && !t.el.paused) { setTrackLevel(t, 0); t.el.pause(); }
  }
}

// Where the player is: 'world' (the street), 'shop' or 'haunted'.
export function setArea(a) {
  area = a;
  if (a !== 'world') setRoll(0);
  if (ctx) tickMusic();
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
export function initAudio() {
  if (ctx) {
    if (ctx.state !== 'running' && !document.hidden) ctx.resume();
    return;
  }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 1;
    musicBus.connect(master);
    // one shared second of noise for every whoosh, crunch and splash
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    startAmbient();
    startLoops();
    startMusic();
  } catch (e) {
    ctx = null;
  }
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.6;
}
export const isMuted = () => muted;

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------
function tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0, attack = 0.005, to = null } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(to || master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, { vol = 0.2, freq = 800, q = 1, delay = 0, type = 'bandpass', sweep = 0, fade = true } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (fade ? 1 - i / len : 1);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + dur);
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

// a wavering note (owls, ghosts, howls)
function wobble(freq, dur, { vol = 0.1, depth = 0.04, rate = 6, delay = 0, type = 'sine', slide = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lg = ctx.createGain();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t + dur);
  lfo.frequency.value = rate;
  lg.gain.value = freq * depth;
  lfo.connect(lg).connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.15, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); lfo.start(t);
  o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}

// ---------------------------------------------------------------------------
// Sound effects
// ---------------------------------------------------------------------------
const rnd = (a, b) => a + Math.random() * (b - a);

export const sfx = {
  // ---- the originals --------------------------------------------------------
  knock() { for (let i = 0; i < 3; i++) { noise(0.08, { vol: 0.6, freq: 180, q: 3, delay: i * 0.22 }); tone(110, 0.08, { type: 'triangle', vol: 0.3, delay: i * 0.22 }); } },
  candy() { [880, 1175, 1568].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.18, delay: 0.55 + i * 0.07 })); },
  chime() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.3, { type: 'sine', vol: 0.15, delay: i * 0.08 })); },
  click() { tone(660, 0.06, { type: 'triangle', vol: 0.12 }); },
  door() { tone(220, 0.6, { type: 'sawtooth', vol: 0.05, slide: 160 }); noise(0.5, { vol: 0.15, freq: 1200, q: 8 }); },
  boo() { tone(330, 0.5, { type: 'sine', vol: 0.3, slide: -200 }); tone(220, 0.6, { type: 'triangle', vol: 0.15, slide: -120, delay: 0.05 }); },
  giggle() { [700, 820, 700, 860, 760].forEach((f, i) => tone(f, 0.09, { type: 'sine', vol: 0.12, delay: i * 0.09, slide: 60 })); },
  creak() { tone(140 + Math.random() * 60, 0.9, { type: 'sawtooth', vol: 0.025, slide: 70, attack: 0.2 }); },
  thunder() { noise(1.8, { vol: 0.5, freq: 120, q: 0.5, type: 'lowpass' }); },
  found() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.16, delay: i * 0.08 })); },
  jump() { tone(300, 0.18, { type: 'sine', vol: 0.12, slide: 300 }); },
  spin() { tone(260, 0.5, { type: 'sine', vol: 0.12, slide: 520 }); noise(0.45, { vol: 0.08, freq: 900, q: 0.8, delay: 0.05 }); [784, 988, 1319].forEach((f, i) => tone(f, 0.14, { type: 'triangle', vol: 0.1, delay: 1.25 + i * 0.06 })); },
  boost() { noise(0.35, { vol: 0.1, freq: 700, q: 0.7 }); tone(220, 0.3, { type: 'triangle', vol: 0.06, slide: 220 }); },
  splash() { noise(0.3, { vol: 0.12, freq: 1600, q: 1 }); },

  // footsteps change with the ground: grass, leaves (woods), road, wood (bridge + haunted floors)
  step(kind = 'grass') {
    if (kind === 'wood') { noise(0.05, { vol: 0.07, freq: rnd(500, 700), q: 3 }); tone(rnd(150, 190), 0.07, { type: 'triangle', vol: 0.08 }); }
    else if (kind === 'road') noise(0.035, { vol: 0.05, freq: rnd(2200, 3000), q: 2 });
    else if (kind === 'leaf') { noise(0.14, { vol: 0.08, freq: rnd(2800, 3800), q: 0.8 }); noise(0.08, { vol: 0.04, freq: rnd(1500, 2000), q: 1, delay: 0.04 }); }
    else noise(0.07, { vol: 0.045, freq: rnd(350, 650), q: 0.9 });
  },
  land(hard = false) { noise(0.12, { vol: hard ? 0.22 : 0.12, freq: 220, q: 0.6, type: 'lowpass' }); tone(95, 0.12, { type: 'sine', vol: hard ? 0.2 : 0.1, slide: -40 }); },
  spinLand() { sfx.land(true); [659, 880, 1175].forEach((f, i) => tone(f, 0.12, { type: 'triangle', vol: 0.07, delay: 0.05 + i * 0.05 })); },

  // ---- scooters --------------------------------------------------------------
  scooterOn() { tone(180, 0.1, { type: 'square', vol: 0.05 }); tone(260, 0.1, { type: 'square', vol: 0.05, delay: 0.09 }); noise(0.25, { vol: 0.08, freq: 3000, q: 4, delay: 0.1 }); [660, 880].forEach((f, i) => tone(f, 0.12, { type: 'triangle', vol: 0.08, delay: 0.22 + i * 0.07 })); },
  scooterOff() { noise(0.18, { vol: 0.07, freq: 2200, q: 3 }); tone(300, 0.18, { type: 'triangle', vol: 0.06, slide: -120, delay: 0.05 }); },
  kick() { noise(0.12, { vol: 0.08, freq: 500, q: 0.8, type: 'lowpass' }); tone(140, 0.08, { type: 'triangle', vol: 0.05 }); },
  bump() { noise(0.18, { vol: 0.2, freq: 160, q: 0.6, type: 'lowpass' }); tone(120, 0.15, { type: 'square', vol: 0.05, slide: -60 }); tone(420, 0.1, { type: 'triangle', vol: 0.06, slide: -200 }); },
  bell() { [1568, 2093].forEach((f, i) => tone(f, 0.7, { type: 'sine', vol: 0.07, delay: i * 0.12 })); }, // shop door bell

  // ---- neighbors + town ---------------------------------------------------------
  doorOpen() { tone(200, 0.45, { type: 'sawtooth', vol: 0.035, slide: 110 }); noise(0.3, { vol: 0.07, freq: 900, q: 6 }); },
  doorbell() { tone(659, 0.5, { type: 'sine', vol: 0.12 }); tone(523, 0.8, { type: 'sine', vol: 0.12, delay: 0.4 }); },
  notYet() { tone(392, 0.12, { type: 'triangle', vol: 0.1 }); tone(311, 0.2, { type: 'triangle', vol: 0.1, delay: 0.11 }); },
  start() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.1, delay: i * 0.07 })); tone(1568, 0.7, { type: 'sine', vol: 0.06, delay: 0.38 }); },
  fanfare() { [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.52], [1047, 0.64], [1319, 0.76]].forEach(([f, d]) => { tone(f, 0.28, { type: 'triangle', vol: 0.14, delay: d }); tone(f / 2, 0.28, { type: 'sine', vol: 0.06, delay: d }); }); },
  swap() { noise(0.25, { vol: 0.1, freq: 500, q: 1.2, sweep: 1800 }); tone(420, 0.18, { type: 'sine', vol: 0.08, slide: 380 }); },
  timeSkip() { noise(0.6, { vol: 0.09, freq: 400, q: 1, sweep: 2600 }); [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'sine', vol: 0.07, delay: 0.12 + i * 0.07 })); },
  nightfall() {
    // a distant bell tolls as the doors start to glow
    [0, 1.7, 3.4].forEach((d) => { tone(196, 2.2, { type: 'sine', vol: 0.14, delay: d }); tone(392, 1.6, { type: 'sine', vol: 0.05, delay: d }); tone(587, 1.0, { type: 'sine', vol: 0.025, delay: d }); });
    setTimeout(() => sfx.owl(), 4200);
  },

  // ---- shop ------------------------------------------------------------------------
  tryOn() { tone(500, 0.16, { type: 'sine', vol: 0.1, slide: 700 }); [1047, 1319, 1760].forEach((f, i) => tone(f, 0.12, { type: 'triangle', vol: 0.06, delay: 0.1 + i * 0.05 })); noise(0.1, { vol: 0.05, freq: 4000, q: 2, delay: 0.05 }); },
  takeOff() { noise(0.18, { vol: 0.08, freq: 1500, q: 1, sweep: -900 }); tone(600, 0.14, { type: 'sine', vol: 0.06, slide: -300 }); },
  swish() { noise(0.22, { vol: 0.07, freq: 700, q: 1.3, sweep: 1400 }); },
  buy() {
    // cash-register cha-ching + coins
    tone(1568, 0.5, { type: 'triangle', vol: 0.09 });
    tone(2093, 0.7, { type: 'triangle', vol: 0.09, delay: 0.09 });
    noise(0.05, { vol: 0.15, freq: 5000, q: 3 });
    for (let i = 0; i < 5; i++) tone(rnd(2400, 3400), 0.07, { type: 'sine', vol: 0.05, delay: 0.25 + i * 0.06 });
    sfx.chime();
  },
  deny() { tone(220, 0.12, { type: 'square', vol: 0.05 }); tone(165, 0.22, { type: 'square', vol: 0.05, delay: 0.11 }); },
  // little blips for a character talking (Hazel's voice is high, neighbors' is lower)
  babble(len = 30, low = false) {
    const n = Math.max(3, Math.min(9, Math.round(len / 7)));
    const base = low ? 190 : 520;
    for (let i = 0; i < n; i++) tone(base * rnd(0.85, 1.5), 0.07, { type: low ? 'triangle' : 'sine', vol: low ? 0.1 : 0.07, slide: rnd(-60, 90), delay: i * 0.075 + rnd(0, 0.02) });
  },

  // ---- night + day ambience ----------------------------------------------------------
  owl() { wobble(430, 0.35, { vol: 0.07, depth: 0.012, rate: 5, slide: -60 }); wobble(380, 0.7, { vol: 0.07, depth: 0.014, rate: 5, delay: 0.55, slide: -50 }); },
  bark() { [0, 0.26].forEach((d) => { tone(rnd(300, 360), 0.14, { type: 'sawtooth', vol: 0.035, slide: -120, delay: d }); noise(0.1, { vol: 0.05, freq: 900, q: 2, delay: d }); }); },
  bats() { for (let i = 0; i < 7; i++) noise(0.05, { vol: 0.05, freq: rnd(2500, 4500), q: 3, delay: i * rnd(0.04, 0.07) }); },
  cricket() { const f = rnd(4200, 4800); for (let i = 0; i < 3; i++) tone(f, 0.04, { type: 'sine', vol: 0.025, delay: i * 0.07 }); },
  bird() { const f = rnd(2400, 3600); [0, 1, 2].slice(0, 2 + ((Math.random() * 3) | 0)).forEach((i) => tone(f * rnd(0.9, 1.25), 0.09, { type: 'sine', vol: 0.035, slide: rnd(300, 900), delay: i * 0.12 })); },
  crow() { [0, 0.28, 0.56].forEach((d) => { tone(rnd(330, 380), 0.2, { type: 'sawtooth', vol: 0.03, slide: -90, delay: d }); noise(0.18, { vol: 0.03, freq: 1200, q: 1.5, delay: d }); }); },
  gust() { noise(2.2, { vol: 0.07, freq: 500, q: 0.6, sweep: 900, fade: false }); },
  leaves() { for (let i = 0; i < 6; i++) noise(0.06, { vol: 0.045, freq: rnd(3000, 5000), q: 1, delay: i * rnd(0.05, 0.12) }); },

  // ---- haunted house ---------------------------------------------------------------------
  rattle() { for (let i = 0; i < 5; i++) { noise(0.04, { vol: 0.09, freq: rnd(500, 900), q: 4, delay: i * 0.055 }); tone(rnd(120, 170), 0.04, { type: 'square', vol: 0.02, delay: i * 0.055 }); } },
  poof() { noise(0.35, { vol: 0.14, freq: 1500, q: 0.7, sweep: -1000 }); tone(700, 0.25, { type: 'sine', vol: 0.08, slide: -450 }); },
  whoo() { wobble(300, 1.1, { vol: 0.07, depth: 0.03, rate: 4.5, slide: 120 }); wobble(450, 1.0, { vol: 0.03, depth: 0.03, rate: 4, delay: 0.1, slide: 90 }); },
  stairs() { for (let i = 0; i < 5; i++) { noise(0.05, { vol: 0.1, freq: 500, q: 3, delay: i * 0.12 }); tone(130 + i * 12, 0.09, { type: 'triangle', vol: 0.09, delay: i * 0.12 }); } },
  sparkle() { for (let i = 0; i < 6; i++) tone(rnd(1800, 3200), 0.12, { type: 'sine', vol: 0.045, delay: i * 0.05 }); },
  crackle() { for (let i = 0; i < 3; i++) noise(rnd(0.015, 0.04), { vol: rnd(0.06, 0.12), freq: rnd(1500, 4500), q: 1.5, delay: rnd(0, 0.3) }); },
  cauldron() { const f = rnd(160, 260); tone(f, 0.1, { type: 'sine', vol: 0.07, slide: f * 1.2 }); noise(0.08, { vol: 0.04, freq: 700, q: 2, delay: 0.02 }); },
  clock() { for (let i = 0; i < 2; i++) { tone(i ? 1000 : 1300, 0.04, { type: 'square', vol: 0.025, delay: i * 0.5 }); } },
  // a slow, wobbly little tune on the haunted piano
  piano() {
    const scale = [220, 262, 330, 349, 392, 330, 262, 247];
    const start = (Math.random() * 3) | 0;
    for (let i = 0; i < 6; i++) {
      const f = scale[(start + i * (1 + (i % 2))) % scale.length] * (Math.random() < 0.15 ? 0.5 : 1);
      tone(f * 1.003, 0.9, { type: 'triangle', vol: 0.07, delay: i * 0.38, attack: 0.01 });
      tone(f * 2, 0.5, { type: 'sine', vol: 0.025, delay: i * 0.38 });
    }
  },
};

// ---------------------------------------------------------------------------
// Looping beds: wind, scooter wheels, creek
// ---------------------------------------------------------------------------
function loopNoise(filterType, freq, q) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = filterType; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = 0;
  src.connect(f).connect(g).connect(master);
  src.start();
  return { gain: g, filter: f };
}

function startAmbient() {
  // soft wind
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = last * 0.985 + (Math.random() * 2 - 1) * 0.015; d[i] = last * 4; }
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const g = ctx.createGain();
  g.gain.value = 0.08;
  src.connect(g).connect(master);
  src.start();
  ambient = { gain: g, cricketT: 0, birdT: 3, owlT: 12, barkT: 40, gustT: 10, crowT: 25, batT: 30, leafT: 8 };
}

function startLoops() {
  rollBus = loopNoise('bandpass', 300, 0.8);
  creekBus = loopNoise('bandpass', 1400, 0.5);
}

// scooter wheels: v is 0..1 of top speed
export function setRoll(v) {
  if (!ctx || !rollBus) return;
  const t = ctx.currentTime;
  rollBus.gain.gain.setTargetAtTime(v > 0.03 ? 0.02 + v * 0.1 : 0, t, 0.08);
  rollBus.filter.frequency.setTargetAtTime(250 + v * 1100, t, 0.1);
}

// creek: near is 0..1 (1 = standing next to the water)
export function setCreek(near) {
  if (!ctx || !creekBus) return;
  creekBus.gain.gain.setTargetAtTime(near > 0.02 ? near * 0.05 : 0, ctx.currentTime, 0.3);
}

export function updateAmbient(dt, night, indoors) {
  if (!ctx || !ambient) return;
  // wind is quieter inside; the creek and scooter beds only belong on the street
  ambient.gain.gain.value = indoors ? 0.02 : 0.05 + (1 - night) * 0.04;
  if (indoors) { setCreek(0); setRoll(0); return; }
  // music follows the sky, with a little hysteresis so it doesn't flip-flop at dusk
  if (!isNight && night > 0.6) isNight = true;
  else if (isNight && night < 0.4) isNight = false;

  const a = ambient;
  const tick = (key, every, fn) => { a[key] -= dt; if (a[key] < 0) { a[key] = every(); fn(); } };
  if (night > 0.5) {
    tick('cricketT', () => 0.6 + Math.random() * 1.6, () => sfx.cricket());
    tick('owlT', () => 14 + Math.random() * 22, () => sfx.owl());
    tick('barkT', () => 35 + Math.random() * 50, () => sfx.bark());
    tick('batT', () => 25 + Math.random() * 35, () => sfx.bats());
  } else if (night < 0.35) {
    tick('birdT', () => 2 + Math.random() * 5, () => sfx.bird());
    tick('crowT', () => 22 + Math.random() * 30, () => sfx.crow());
  }
  tick('gustT', () => 12 + Math.random() * 18, () => sfx.gust());
  tick('leafT', () => 6 + Math.random() * 12, () => sfx.leaves());
}
