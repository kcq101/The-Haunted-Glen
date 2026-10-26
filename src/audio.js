// Tiny synthesized sound effects (no files needed). Optional background music
// can be dropped in at assets/music/theme.mp3.

let ctx = null;
let master = null;
let muted = false;
let ambient = null;
let music = null;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    startAmbient();
    tryMusic();
  } catch (e) {
    ctx = null;
  }
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.6;
  if (music) music.muted = m;
}
export const isMuted = () => muted;

function tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0, attack = 0.005 } = {}) {
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
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, { vol = 0.2, freq = 800, q = 1, delay = 0, type = 'bandpass' } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export const sfx = {
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
  step() { noise(0.05, { vol: 0.05, freq: 400 + Math.random() * 300, q: 1 }); },
  splash() { noise(0.3, { vol: 0.12, freq: 1600, q: 1 }); },
};

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
  ambient = { gain: g, cricketT: 0 };
}

export function updateAmbient(dt, night, indoors) {
  if (!ctx || !ambient) return;
  ambient.gain.gain.value = indoors ? 0.02 : 0.05 + (1 - night) * 0.04;
  ambient.cricketT -= dt;
  if (!indoors && night > 0.5 && ambient.cricketT < 0) {
    ambient.cricketT = 0.6 + Math.random() * 1.6;
    const f = 4200 + Math.random() * 600;
    for (let i = 0; i < 3; i++) tone(f, 0.04, { type: 'sine', vol: 0.025, delay: i * 0.07 });
  }
  if (music) music.volume = indoors ? 0.2 : 0.35;
}

function tryMusic() {
  const a = new Audio('assets/music/theme.mp3');
  a.loop = true;
  a.volume = 0.35;
  a.addEventListener('canplaythrough', () => { music = a; a.muted = muted; a.play().catch(() => {}); }, { once: true });
  a.addEventListener('error', () => {}, { once: true });
}
