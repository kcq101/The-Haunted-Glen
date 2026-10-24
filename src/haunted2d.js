import { ITEM } from './costumes.js';
import { sfx } from './audio.js';

// ---------------------------------------------------------------------------
// The haunted house interior: a 2D top-down (Stardew-style) world that is far
// bigger inside than outside. Everything is drawn with code in a pixel-art
// style for now; GPT sprites can replace the draw functions later.
// ---------------------------------------------------------------------------

const T = 16; // pixels per tile (before scaling)
const MW = 44, MH = 30;

// --- floor plans ------------------------------------------------------------
function makeFloors(names) {
  const ground = {
    name: 'ground',
    rooms: [
      { name: 'The Library', x: 1, y: 1, w: 16, h: 10, floor: 'wood2' },
      { name: 'The Great Hall', x: 1, y: 12, w: 16, h: 17, floor: 'wood' },
      { name: 'Hall of Portraits', x: 18, y: 1, w: 8, h: 18, floor: 'runner' },
      { name: 'The Foyer', x: 18, y: 20, w: 8, h: 9, floor: 'marble' },
      { name: 'The Dining Room', x: 27, y: 1, w: 16, h: 16, floor: 'wood2' },
      { name: 'The Spooky Kitchen', x: 27, y: 18, w: 16, h: 11, floor: 'checker' },
    ],
    doors: [[21, 19, 2, 1], [17, 23, 1, 2], [26, 23, 1, 2], [17, 5, 1, 2], [26, 8, 1, 2], [7, 11, 2, 1], [35, 17, 2, 1]],
    exit: { x: 21, y: 29, w: 2 },
    stairs: { x: 21, y: 1, w: 2, h: 2, to: 'upstairs', arrive: { x: 22, y: 4.5 } },
    furniture: [
      // library
      ...[2, 6, 11].map((x) => ({ t: 'shelf', x, y: 1, w: 4, h: 2 })),
      { t: 'rug', x: 4, y: 5, w: 8, h: 4, c: '#5a2a6a' },
      { t: 'armchair', x: 3, y: 6, w: 2, h: 2, c: '#7a2a3a' },
      { t: 'armchair', x: 12, y: 6, w: 2, h: 2, c: '#7a2a3a' },
      { t: 'table', x: 7, y: 6, w: 3, h: 2, cloth: '#3a2a4a' },
      { t: 'candle', x: 8, y: 6, w: 1, h: 1 },
      { t: 'globe', x: 14, y: 3, w: 1, h: 1 },
      { t: 'shelf', x: 1, y: 8, w: 2, h: 2 },
      // great hall
      { t: 'fireplace', x: 7, y: 12, w: 4, h: 2 },
      { t: 'rug', x: 4, y: 16, w: 10, h: 7, c: '#8a2a2a' },
      { t: 'sofa', x: 6, y: 20, w: 5, h: 2, c: '#4a2a6a' },
      { t: 'armchair', x: 3, y: 16, w: 2, h: 2, c: '#2a5a4a' },
      { t: 'armchair', x: 13, y: 16, w: 2, h: 2, c: '#2a5a4a' },
      { t: 'table', x: 7, y: 17, w: 3, h: 2 },
      { t: 'piano', x: 2, y: 24, w: 4, h: 3, ghost: true },
      { t: 'clock', x: 15, y: 12, w: 1, h: 2 },
      { t: 'plant', x: 1, y: 12, w: 1, h: 1 },
      { t: 'plant', x: 15, y: 27, w: 1, h: 1 },
      { t: 'pumpkin', x: 12, y: 13, w: 1, h: 1 },
      { t: 'pumpkin', x: 6, y: 13, w: 1, h: 1 },
      // portrait hall
      { t: 'armor', x: 18, y: 5, w: 1, h: 2 },
      { t: 'armor', x: 25, y: 11, w: 1, h: 2 },
      { t: 'plant', x: 18, y: 17, w: 1, h: 1 },
      { t: 'candelabra', x: 25, y: 4, w: 1, h: 1 },
      { t: 'candelabra', x: 18, y: 12, w: 1, h: 1 },
      // foyer
      { t: 'rug', x: 19, y: 24, w: 6, h: 4, c: '#2a3a6a' },
      { t: 'coatrack', x: 18, y: 20, w: 1, h: 1 },
      { t: 'closet', x: 24, y: 20, w: 2, h: 2, ghost: true },
      { t: 'pumpkin', x: 19, y: 27, w: 1, h: 1 },
      { t: 'pumpkin', x: 24, y: 27, w: 1, h: 1 },
      // dining room
      { t: 'table', x: 30, y: 6, w: 10, h: 3, cloth: '#5a1a2a' },
      ...[31, 33, 35, 37].flatMap((x) => [{ t: 'chair', x, y: 5, w: 1, h: 1 }, { t: 'chair', x, y: 9, w: 1, h: 1 }]),
      { t: 'candelabra', x: 32, y: 6, w: 1, h: 1, onTable: true },
      { t: 'candelabra', x: 37, y: 6, w: 1, h: 1, onTable: true },
      { t: 'cabinet', x: 28, y: 1, w: 4, h: 2 },
      { t: 'clock', x: 41, y: 1, w: 1, h: 2 },
      { t: 'cabinet', x: 37, y: 1, w: 3, h: 2 },
      { t: 'plant', x: 27, y: 15, w: 1, h: 1 },
      // kitchen
      { t: 'counter', x: 27, y: 18, w: 7, h: 1 },
      { t: 'stove', x: 34, y: 18, w: 2, h: 1 },
      { t: 'counter', x: 36, y: 18, w: 4, h: 1 },
      { t: 'fridge', x: 40, y: 18, w: 2, h: 2, ghost: true },
      { t: 'cauldron', x: 33, y: 23, w: 2, h: 2 },
      { t: 'table', x: 28, y: 24, w: 3, h: 3 },
      { t: 'pumpkin', x: 41, y: 27, w: 1, h: 1 },
    ],
    corn: [{ id: 'g1', x: 15.5, y: 9.5 }, { id: 'g2', x: 2.5, y: 27.5 }, { id: 'g3', x: 41.5, y: 15.5 }, { id: 'g4', x: 31.5, y: 27.5 }],
    portraits: [[19, 0], [24, 0], [3, 11], [13, 11], [30, 0], [34, 0]],
    windows: [[10, 0], [16, 0], [32, 0], [39, 0]],
    floaters: [{ x: 10, y: 22 }, { x: 34, y: 12 }],
  };

  const upstairs = {
    name: 'upstairs',
    rooms: [
      { name: `${names.carter}'s Room`, x: 1, y: 1, w: 16, h: 13, floor: 'carpetBlue' },
      { name: 'The Toy Room', x: 1, y: 15, w: 16, h: 14, floor: 'carpetOrange' },
      { name: 'Upstairs Hallway', x: 18, y: 1, w: 8, h: 28, floor: 'runner' },
      { name: `${names.jack}'s Room`, x: 27, y: 1, w: 16, h: 13, floor: 'carpetGreen' },
      { name: "Mom & Dad's Room", x: 27, y: 15, w: 16, h: 14, floor: 'wood2' },
    ],
    doors: [[17, 6, 1, 2], [17, 20, 1, 2], [26, 6, 1, 2], [26, 20, 1, 2]],
    stairs: { x: 21, y: 1, w: 2, h: 2, to: 'ground', arrive: { x: 22, y: 4.5 } },
    furniture: [
      // older brother's room
      { t: 'bed', x: 2, y: 2, w: 3, h: 4, c: '#2f6fd6' },
      { t: 'desk', x: 8, y: 1, w: 3, h: 2 },
      { t: 'closet', x: 14, y: 1, w: 2, h: 2, ghost: true },
      { t: 'rug', x: 6, y: 6, w: 6, h: 4, c: '#e8732c' },
      { t: 'toybox', x: 2, y: 11, w: 2, h: 2, ghost: true },
      { t: 'rocket', x: 13, y: 10, w: 2, h: 3 },
      { t: 'ball', x: 9, y: 8, w: 1, h: 1 },
      // toy room
      { t: 'rug', x: 3, y: 18, w: 11, h: 8, c: '#3a8a5a' },
      { t: 'train', x: 4, y: 19, w: 9, h: 6 },
      { t: 'blocks', x: 2, y: 16, w: 2, h: 1 },
      { t: 'toybox', x: 14, y: 15, w: 2, h: 2, ghost: true },
      { t: 'ball', x: 14, y: 26, w: 1, h: 1 },
      { t: 'teepee', x: 2, y: 26, w: 3, h: 2 },
      // little brother's room
      { t: 'bed', x: 39, y: 2, w: 3, h: 4, c: '#4f9d4a' },
      { t: 'dino', x: 30, y: 9, w: 2, h: 2 },
      { t: 'closet', x: 28, y: 1, w: 2, h: 2, ghost: true },
      { t: 'rug', x: 32, y: 5, w: 6, h: 4, c: '#e8c64a' },
      { t: 'blocks', x: 36, y: 11, w: 2, h: 1 },
      { t: 'shelf', x: 32, y: 1, w: 3, h: 2 },
      // parents
      { t: 'bed', x: 33, y: 16, w: 5, h: 5, c: '#7a2a3a', big: true },
      { t: 'dresser', x: 28, y: 15, w: 3, h: 2 },
      { t: 'closet', x: 40, y: 15, w: 2, h: 2, ghost: true },
      { t: 'rug', x: 31, y: 22, w: 9, h: 4, c: '#5a3a6a' },
      { t: 'plant', x: 41, y: 27, w: 1, h: 1 },
      { t: 'candle', x: 28, y: 27, w: 1, h: 1 },
      // hallway
      { t: 'plant', x: 18, y: 10, w: 1, h: 1 },
      { t: 'candelabra', x: 25, y: 14, w: 1, h: 1 },
      { t: 'armor', x: 18, y: 24, w: 1, h: 2 },
      { t: 'pumpkin', x: 25, y: 27, w: 1, h: 1 },
    ],
    corn: [{ id: 'g5', x: 1.5, y: 7.5 }, { id: 'g6', x: 15.5, y: 27.5 }, { id: 'g7', x: 42.5, y: 12.5 }, { id: 'g8', x: 28.5, y: 22.5 }],
    portraits: [[20, 0], [23, 0], [8, 14], [35, 14]],
    windows: [[4, 0], [11, 0], [31, 0], [37, 0]],
    floaters: [{ x: 8, y: 22 }, { x: 34, y: 25 }, { x: 22, y: 18 }],
  };
  return { ground, upstairs };
}

const SOLID = new Set(['shelf', 'armchair', 'table', 'fireplace', 'sofa', 'piano', 'clock', 'plant', 'armor', 'closet', 'cabinet', 'counter', 'stove', 'fridge', 'cauldron', 'bed', 'desk', 'toybox', 'rocket', 'dresser', 'teepee', 'dino', 'globe', 'coatrack', 'pumpkin', 'candelabra']);

// --- pixel painting helpers -------------------------------------------------
function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
function speck(g, x, y, w, h, cols, n, rng) {
  for (let i = 0; i < n; i++) { g.fillStyle = cols[(rng() * cols.length) | 0]; g.fillRect(x + ((rng() * w) | 0), y + ((rng() * h) | 0), 1, 1); }
}
function mkRng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function drawFloor(g, kind, x, y, rng) {
  const px = x * T, py = y * T;
  switch (kind) {
    case 'wood':
    case 'wood2': {
      const base = kind === 'wood' ? ['#7a4e2e', '#6e4529', '#835535'] : ['#5e3b25', '#56351f', '#66412a'];
      for (let r = 0; r < 4; r++) {
        rect(g, px, py + r * 4, T, 4, base[(x * 3 + y * 5 + r) % 3]);
        rect(g, px, py + r * 4 + 3, T, 1, 'rgba(0,0,0,0.25)');
        if ((x + r * 3 + y) % 4 === 0) rect(g, px + ((r * 7 + x) % 14), py + r * 4, 1, 3, 'rgba(0,0,0,0.3)');
      }
      speck(g, px, py, T, T, ['rgba(255,220,180,0.07)', 'rgba(0,0,0,0.12)'], 6, rng);
      break;
    }
    case 'checker': {
      const a = (x + y) % 2 ? '#e8dcc8' : '#4a3a5a';
      rect(g, px, py, T, T, a);
      rect(g, px, py + T - 1, T, 1, 'rgba(0,0,0,0.2)');
      speck(g, px, py, T, T, ['rgba(0,0,0,0.1)'], 4, rng);
      break;
    }
    case 'marble': {
      rect(g, px, py, T, T, (x + y) % 2 ? '#cfc8d8' : '#b8b0c4');
      g.strokeStyle = 'rgba(120,110,140,0.35)'; g.beginPath(); g.moveTo(px + rng() * T, py); g.lineTo(px + rng() * T, py + T); g.stroke();
      break;
    }
    case 'runner': {
      rect(g, px, py, T, T, '#5e3b25');
      speck(g, px, py, T, T, ['rgba(0,0,0,0.15)'], 6, rng);
      break;
    }
    default: {
      const c = { carpetBlue: ['#3a5a9a', '#34518c'], carpetGreen: ['#4a7a4a', '#426e42'], carpetOrange: ['#b06a3a', '#a26034'] }[kind] || ['#555', '#4a4a4a'];
      rect(g, px, py, T, T, c[0]);
      speck(g, px, py, T, T, [c[1], 'rgba(255,255,255,0.06)'], 22, rng);
    }
  }
}

function drawWall(g, x, y, face, rng, floorName) {
  const px = x * T, py = y * T;
  if (face) {
    // wallpaper with stripes and a baseboard
    const paper = floorName === 'upstairs' ? ['#4a3a6a', '#423460'] : ['#3a2a4a', '#33243f'];
    rect(g, px, py, T, T, paper[0]);
    for (let i = 0; i < T; i += 4) rect(g, px + i, py, 2, T, paper[1]);
    for (let i = 2; i < T; i += 8) rect(g, px + i, py + 5, 1, 1, '#7a5a9a');
    rect(g, px, py + T - 4, T, 4, '#2a1a20');
    rect(g, px, py + T - 4, T, 1, '#5a3a3a');
    rect(g, px, py, T, 2, '#1e1426');
  } else {
    rect(g, px, py, T, T, '#1a1220');
    rect(g, px, py, T, 1, '#2a2032');
    speck(g, px, py, T, T, ['#221828'], 5, rng);
  }
}

// furniture painters: (g, px, py, w, h, f)
const PAINT = {
  shelf(g, x, y, w, h) {
    rect(g, x, y, w, h, '#4a2e1c'); rect(g, x + 1, y + 1, w - 2, h - 2, '#2a1a10');
    const cols = ['#c4322c', '#2f6fd6', '#2eaa4a', '#e8c64a', '#7a4cff', '#e8732c', '#d8d0c0'];
    for (let r = 0; r < Math.floor(h / 8); r++) {
      let bx = x + 2;
      while (bx < x + w - 3) {
        const bw = 2 + ((bx * 7 + r * 3) % 3);
        rect(g, bx, y + 2 + r * 8 + ((bx % 3) ? 1 : 0), bw, 6 - ((bx % 3) ? 1 : 0), cols[(bx + r * 5) % cols.length]);
        bx += bw + 1;
      }
      rect(g, x + 1, y + 8 + r * 8, w - 2, 1, '#5a3a24');
    }
  },
  armchair(g, x, y, w, h, f) {
    const c = f.c || '#7a2a3a';
    rect(g, x + 2, y + 1, w - 4, h - 6, shade(c, -20)); rect(g, x + 1, y + 6, w - 2, h - 8, c);
    rect(g, x + 1, y + 6, 3, h - 8, shade(c, -30)); rect(g, x + w - 4, y + 6, 3, h - 8, shade(c, -30));
    rect(g, x + 3, y + h - 3, 2, 2, '#2a1a10'); rect(g, x + w - 5, y + h - 3, 2, 2, '#2a1a10');
  },
  sofa(g, x, y, w, h, f) {
    const c = f.c || '#4a2a6a';
    rect(g, x + 1, y + 1, w - 2, 9, shade(c, -25)); rect(g, x + 1, y + 9, w - 2, h - 12, c);
    rect(g, x, y + 5, 4, h - 8, shade(c, -35)); rect(g, x + w - 4, y + 5, 4, h - 8, shade(c, -35));
    for (let i = 1; i < 3; i++) rect(g, x + (w * i) / 3, y + 10, 1, h - 14, shade(c, -40));
  },
  table(g, x, y, w, h, f) {
    rect(g, x + 1, y + 2, w - 2, h - 3, '#3a2214');
    rect(g, x, y, w, h - 4, f.cloth || '#7a4a2a');
    rect(g, x, y + h - 5, w, 1, 'rgba(0,0,0,0.3)');
    if (f.cloth) for (let i = 2; i < w; i += 6) rect(g, x + i, y + h - 4, 3, 2, f.cloth);
    rect(g, x + 2, y + 1, w - 4, 1, 'rgba(255,255,255,0.12)');
  },
  fireplace(g, x, y, w, h) {
    rect(g, x, y, w, h, '#6a6070'); speck(g, x, y, w, h, ['#5a5060', '#7a7080'], 60, mkRng(9));
    rect(g, x + 8, y + 8, w - 16, h - 8, '#140c10');
    rect(g, x - 1, y + 4, w + 2, 3, '#4a2e1c');
  },
  piano(g, x, y, w, h) {
    rect(g, x, y, w, h - 4, '#141016'); rect(g, x + 2, y + 2, w - 4, 6, '#2a2430');
    rect(g, x + 2, y + h - 12, w - 4, 6, '#f2efe6');
    for (let i = x + 3; i < x + w - 3; i += 3) rect(g, i, y + h - 12, 1, 6, '#141016');
    rect(g, x + 4, y + h - 4, 2, 4, '#141016'); rect(g, x + w - 6, y + h - 4, 2, 4, '#141016');
  },
  clock(g, x, y, w, h) {
    rect(g, x + 1, y, w - 2, h, '#4a2a18'); rect(g, x + 3, y + 3, w - 6, 9, '#efe6cc');
    rect(g, x + 7, y + 5, 1, 4, '#111'); rect(g, x + 7, y + 7, 3, 1, '#111');
    rect(g, x + 3, y + 14, w - 6, h - 17, '#2a1a10');
  },
  plant(g, x, y) {
    rect(g, x + 4, y + 9, 8, 6, '#9a5a3a'); rect(g, x + 4, y + 9, 8, 1, '#b06a42');
    g.fillStyle = '#4a7a3a'; [[8, 3], [4, 6], [12, 6], [6, 1], [10, 2]].forEach(([a, b]) => g.fillRect(x + a - 2, y + b, 4, 6));
    g.fillStyle = '#c4501f'; g.fillRect(x + 6, y + 4, 2, 2);
  },
  pumpkin(g, x, y) {
    g.fillStyle = '#d8661f'; g.fillRect(x + 2, y + 5, 12, 9); g.fillStyle = '#ef7d1f'; g.fillRect(x + 4, y + 4, 8, 11);
    g.fillStyle = '#56702c'; g.fillRect(x + 7, y + 2, 2, 3);
    g.fillStyle = '#ffd04a'; g.fillRect(x + 5, y + 7, 2, 2); g.fillRect(x + 9, y + 7, 2, 2); g.fillRect(x + 5, y + 11, 6, 1);
  },
  armor(g, x, y, w, h) {
    rect(g, x + 4, y + 1, 8, 7, '#a8acb4'); rect(g, x + 5, y + 4, 6, 1, '#1a1a1e');
    rect(g, x + 3, y + 8, 10, 12, '#9098a2'); rect(g, x + 4, y + 20, 3, 10, '#8a909a'); rect(g, x + 9, y + 20, 3, 10, '#8a909a');
    rect(g, x + 13, y + 4, 1, 22, '#5a3a24'); rect(g, x + 12, y + 2, 3, 3, '#c9ced6');
  },
  closet(g, x, y, w, h) {
    rect(g, x, y, w, h, '#5a3420'); rect(g, x + 2, y + 2, w / 2 - 3, h - 4, '#6e4229'); rect(g, x + w / 2 + 1, y + 2, w / 2 - 3, h - 4, '#6e4229');
    rect(g, x + w / 2 - 2, y + h / 2, 1, 3, '#e8c64a'); rect(g, x + w / 2 + 1, y + h / 2, 1, 3, '#e8c64a');
  },
  cabinet(g, x, y, w, h) {
    rect(g, x, y, w, h, '#4a2a18'); rect(g, x + 1, y + 2, w - 2, 10, '#9ab0c4');
    for (let i = x + 3; i < x + w - 3; i += 5) { rect(g, i, y + 4, 3, 3, '#f2efe6'); rect(g, i, y + 8, 3, 3, '#e8c64a'); }
    rect(g, x + 1, y + 14, w - 2, h - 16, '#5a3420');
  },
  counter(g, x, y, w, h) {
    rect(g, x, y, w, h, '#6a5040'); rect(g, x, y, w, 5, '#cfc8bc');
    for (let i = x + 1; i < x + w - 4; i += 8) rect(g, i, y + 7, 6, 7, '#7a5e4c');
  },
  stove(g, x, y, w, h) {
    rect(g, x, y, w, h, '#2a2a30'); rect(g, x + 2, y + 1, 6, 4, '#4a4a52'); rect(g, x + w - 8, y + 1, 6, 4, '#4a4a52');
    rect(g, x + 4, y + 8, w - 8, 6, '#141418');
  },
  fridge(g, x, y, w, h) {
    rect(g, x, y, w, h, '#d8dce2'); rect(g, x, y + 10, w, 1, '#9aa0a8'); rect(g, x + w - 5, y + 3, 1, 5, '#7a8088'); rect(g, x + w - 5, y + 14, 1, 8, '#7a8088');
    rect(g, x + 4, y + 16, 4, 4, '#e8732c'); rect(g, x + 10, y + 18, 3, 3, '#2f6fd6');
  },
  cauldron(g, x, y, w, h) {
    g.fillStyle = '#1a1820'; g.beginPath(); g.ellipse(x + w / 2, y + h / 2 + 3, w / 2 - 1, h / 2 - 3, 0, 0, 7); g.fill();
    g.fillStyle = '#3a3840'; g.fillRect(x + 3, y + 5, w - 6, 2);
  },
  bed(g, x, y, w, h, f) {
    rect(g, x, y, w, h, '#4a2a18');
    rect(g, x + 2, y + 2, w - 4, 8, '#f4f1ea');
    if (f.big) rect(g, x + w / 2, y + 2, 1, 8, '#d8d4c8');
    rect(g, x + 1, y + 11, w - 2, h - 13, f.c || '#2f6fd6');
    rect(g, x + 1, y + 11, w - 2, 3, shade(f.c || '#2f6fd6', 30));
    for (let i = y + 17; i < y + h - 3; i += 6) rect(g, x + 2, i, w - 4, 1, shade(f.c || '#2f6fd6', -25));
  },
  desk(g, x, y, w, h) {
    rect(g, x, y, w, h - 3, '#7a4a2a'); rect(g, x, y + h - 5, w, 2, '#5a3420');
    rect(g, x + 4, y + 2, 10, 7, '#2a2a30'); rect(g, x + 5, y + 3, 8, 5, '#5ab0e0');
    rect(g, x + w - 12, y + 3, 4, 6, '#e8c64a'); rect(g, x + w - 7, y + 4, 3, 5, '#c4322c');
  },
  toybox(g, x, y, w, h) {
    rect(g, x, y + 4, w, h - 4, '#c4322c'); rect(g, x, y + 2, w, 4, '#e8c64a');
    rect(g, x + 4, y + 10, 4, 4, '#2f6fd6'); rect(g, x + w - 10, y + 12, 5, 5, '#2eaa4a');
    rect(g, x + w / 2 - 2, y + h - 10, 4, 4, '#ffffff');
  },
  rocket(g, x, y, w, h) {
    rect(g, x + 10, y + 6, 12, h - 12, '#f2f0e6'); rect(g, x + 13, y + 2, 6, 6, '#c4322c');
    rect(g, x + 13, y + 14, 6, 6, '#5ab0e0'); rect(g, x + 6, y + h - 14, 4, 10, '#c4322c'); rect(g, x + 22, y + h - 14, 4, 10, '#c4322c');
    rect(g, x + 12, y + h - 6, 8, 3, '#e8732c');
  },
  ball(g, x, y) {
    g.fillStyle = '#c4322c'; g.beginPath(); g.arc(x + 8, y + 9, 5, 0, 7); g.fill();
    g.fillStyle = '#f2efe6'; g.fillRect(x + 4, y + 8, 9, 2);
  },
  train(g, x, y, w, h) {
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 3; g.strokeRect(x + 4, y + 4, w - 8, h - 8);
    g.strokeStyle = '#8a8a8a'; g.lineWidth = 1; g.strokeRect(x + 3, y + 3, w - 6, h - 6); g.strokeRect(x + 5, y + 5, w - 10, h - 10);
  },
  blocks(g, x, y, w) {
    const cols = ['#c4322c', '#2f6fd6', '#e8c64a', '#2eaa4a'];
    for (let i = 0; i < w / 6; i++) rect(g, x + 1 + i * 6, y + 6 + (i % 2) * 3, 5, 5, cols[i % 4]);
  },
  teepee(g, x, y, w, h) {
    g.fillStyle = '#e8d8b0'; g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w - 2, y + h); g.lineTo(x + 2, y + h); g.fill();
    g.fillStyle = '#c4322c'; g.fillRect(x + 10, y + h - 14, w - 20, 2);
    g.fillStyle = '#5a3a24'; g.beginPath(); g.moveTo(x + w / 2, y + h - 12); g.lineTo(x + w / 2 + 5, y + h); g.lineTo(x + w / 2 - 5, y + h); g.fill();
  },
  dino(g, x, y, w, h) {
    rect(g, x + 6, y + 10, 16, 12, '#4f9d4a'); rect(g, x + 18, y + 3, 10, 9, '#4f9d4a'); rect(g, x + 2, y + 16, 6, 4, '#4f9d4a');
    rect(g, x + 24, y + 5, 2, 2, '#111'); rect(g, x + 8, y + 22, 4, 6, '#3f8a3a'); rect(g, x + 16, y + 22, 4, 6, '#3f8a3a');
    for (let i = 0; i < 4; i++) rect(g, x + 8 + i * 4, y + 7, 2, 3, '#e8c64a');
  },
  dresser(g, x, y, w, h) {
    rect(g, x, y, w, h, '#5a3420'); for (let r = 0; r < 3; r++) { rect(g, x + 2, y + 3 + r * 9, w - 4, 7, '#6e4229'); rect(g, x + w / 2 - 2, y + 6 + r * 9, 4, 1, '#e8c64a'); }
    rect(g, x + 6, y - 6, 8, 8, '#c9ced6');
  },
  globe(g, x, y) {
    rect(g, x + 7, y + 10, 2, 5, '#4a2a18'); rect(g, x + 4, y + 14, 8, 2, '#4a2a18');
    g.fillStyle = '#3a6fa8'; g.beginPath(); g.arc(x + 8, y + 7, 5, 0, 7); g.fill(); g.fillStyle = '#4a9a4a'; g.fillRect(x + 5, y + 5, 4, 3);
  },
  coatrack(g, x, y) {
    rect(g, x + 7, y + 1, 2, 14, '#4a2a18'); rect(g, x + 3, y + 14, 10, 2, '#4a2a18');
    rect(g, x + 3, y + 2, 4, 6, '#1d1d22'); rect(g, x + 9, y + 3, 4, 7, '#7a2a3a');
  },
  chair(g, x, y) { rect(g, x + 3, y + 2, 10, 4, '#4a2a18'); rect(g, x + 3, y + 6, 10, 8, '#6e4229'); },
  candle(g, x, y) { rect(g, x + 6, y + 6, 4, 8, '#efe6cc'); },
  candelabra(g, x, y) {
    rect(g, x + 7, y + 6, 2, 9, '#c9a640'); rect(g, x + 3, y + 6, 10, 2, '#c9a640'); rect(g, x + 4, y + 14, 8, 2, '#c9a640');
    for (const cx of [3, 7, 11]) rect(g, x + cx, y + 2, 2, 4, '#efe6cc');
  },
  rug(g, x, y, w, h, f) {
    const c = f.c || '#8a2a2a';
    rect(g, x, y, w, h, shade(c, -20)); rect(g, x + 3, y + 3, w - 6, h - 6, c);
    g.strokeStyle = '#e8c64a'; g.lineWidth = 1; g.strokeRect(x + 5.5, y + 5.5, w - 11, h - 11);
    for (let i = x + 2; i < x + w - 2; i += 4) { rect(g, i, y - 1, 1, 2, '#e8d8b0'); rect(g, i, y + h - 1, 1, 2, '#e8d8b0'); }
  },
};

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt)), gg = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt)), b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${gg},${b})`;
}

// --- kid sprite --------------------------------------------------------------
function kidLook(cfg, costume) {
  const o = costume.outfit && ITEM[costume.outfit];
  return {
    skin: cfg.skin,
    hair: cfg.hair,
    shirt: o ? (o.colors?.tex ? o.c2d : o.colors.sleeves) : cfg.shirt,
    sleeves: o ? o.colors.sleeves : cfg.shirt,
    pants: o ? (o.colors.pantsTex ? o.c2d : o.colors.pants) : cfg.pants,
    shoes: o ? o.colors.shoes : cfg.shoes,
    outfit: costume.outfit,
    hat: costume.hat,
    face: costume.face,
    prop: costume.prop,
    small: cfg.height < 1.15,
  };
}

function drawKid(g, cx, fy, dir, frame, L) {
  // cx = center x, fy = feet y (pixels, base scale)
  const s = L.small ? 0 : 1; // older brother is a couple of pixels taller
  const x = Math.round(cx - 7), top = Math.round(fy - 23 - s * 2);
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, fy, 6, 2.2, 0, 0, 7); g.fill();

  if (L.outfit === 'ghost_sheet') {
    const bob = Math.sin(performance.now() / 200) * 1;
    g.fillStyle = '#f6f6fa';
    g.beginPath(); g.moveTo(x + 1, fy - 1 + bob);
    g.quadraticCurveTo(x - 1, top + 2, x + 7, top + bob); g.quadraticCurveTo(x + 15, top + 2, x + 13, fy - 1 + bob);
    for (let i = 0; i < 4; i++) g.lineTo(x + 13 - i * 3 - 1.5, fy - 3 + bob + (i % 2) * 2);
    g.fill();
    if (dir !== 'up') { rect(g, x + 4, top + 7 + bob, 2, 3, '#121214'); rect(g, x + 9, top + 7 + bob, 2, 3, '#121214'); }
    return;
  }
  const step = frame % 2 === 1 ? 1 : 0;
  // legs
  rect(g, x + 4, fy - 6, 3, 5 - step, L.pants); rect(g, x + 8, fy - 6, 3, 5 - (1 - step) * (frame ? 1 : 0), L.pants);
  rect(g, x + 4, fy - 2 - step, 3, 2, L.shoes); rect(g, x + 8, fy - 2 - (frame ? 1 - step : 0), 3, 2, L.shoes);
  // cape behind
  if ((L.outfit === 'vampire_outfit' || L.outfit === 'hero_outfit') && dir !== 'down') rect(g, x + 2, top + 10, 11, 11, L.outfit === 'hero_outfit' ? '#e63b3b' : '#121014');
  // body
  const by = top + 10 + s * 0;
  rect(g, x + 3, by, 9, 8, L.shirt);
  // outfit details
  if (L.outfit === 'pirate_outfit') { for (let i = 0; i < 4; i++) rect(g, x + 3, by + i * 2, 9, 1, '#f4efe4'); rect(g, x + 3, by + 6, 9, 1, '#b3222a'); }
  if (L.outfit === 'fire_outfit') rect(g, x + 3, by + 5, 9, 1, '#e8ff3c');
  if (L.outfit === 'skeleton_outfit') { rect(g, x + 7, by + 1, 1, 6, '#f2f0e6'); for (let i = 0; i < 3; i++) rect(g, x + 5, by + 1 + i * 2, 5, 1, '#f2f0e6'); }
  if (L.outfit === 'mummy_outfit') for (let i = 0; i < 4; i++) rect(g, x + 3, by + i * 2 + 1, 9, 1, '#cfc4a8');
  if (L.outfit === 'hero_outfit' && dir !== 'up') { rect(g, x + 6, by + 2, 3, 3, '#e63b3b'); rect(g, x + 3, by + 6, 9, 1, '#ffd23f'); }
  if (L.outfit === 'vampire_outfit' && dir !== 'up') { rect(g, x + 6, by, 3, 4, '#f2efe6'); rect(g, x + 7, by, 1, 1, '#9b1c2a'); }
  if (L.outfit === 'astro_outfit') { rect(g, x + 4, by + 2, 2, 2, '#3a6fd8'); rect(g, x + 9, by + 2, 2, 2, '#e8732c'); }
  // arms
  const sw = frame ? (step ? 1 : -1) : 0;
  rect(g, x + 1, by + 1 + sw, 2, 6, L.sleeves); rect(g, x + 12, by + 1 - sw, 2, 6, L.sleeves);
  rect(g, x + 1, by + 7 + sw, 2, 2, L.skin); rect(g, x + 12, by + 7 - sw, 2, 2, L.skin);
  // prop in hand
  if (L.prop) drawProp(g, x + 13, by + 7 - sw, L.prop);
  // head
  const hy = top;
  if (L.hat === 'pumpkin_head') {
    rect(g, x + 1, hy, 13, 11, '#ef7d1f'); rect(g, x + 3, hy - 1, 9, 1, '#ef7d1f'); rect(g, x + 6, hy - 3, 2, 3, '#56702c');
    if (dir !== 'up') { rect(g, x + 3, hy + 3, 3, 2, '#ffd04a'); rect(g, x + 9, hy + 3, 3, 2, '#ffd04a'); rect(g, x + 4, hy + 7, 7, 1, '#ffd04a'); }
    return;
  }
  rect(g, x + 2, hy + 1, 11, 9, L.skin);
  rect(g, x + 3, hy, 9, 1, L.skin);
  // hair
  rect(g, x + 2, hy - 1, 11, 4, L.hair);
  if (dir === 'up') rect(g, x + 2, hy + 1, 11, 7, L.hair);
  else if (dir === 'left') rect(g, x + 8, hy + 1, 5, 5, L.hair);
  else if (dir === 'right') rect(g, x + 2, hy + 1, 5, 5, L.hair);
  else { rect(g, x + 2, hy + 2, 2, 3, L.hair); rect(g, x + 11, hy + 2, 2, 3, L.hair); }
  // face
  if (dir !== 'up') {
    const ex = dir === 'left' ? -2 : dir === 'right' ? 2 : 0;
    if (dir !== 'right') rect(g, x + 4 + ex, hy + 4, 2, 2, '#1a1410');
    if (dir !== 'left') rect(g, x + 9 + ex, hy + 4, 2, 2, '#1a1410');
    rect(g, x + 6 + ex, hy + 7, 3, 1, '#7a3a2c');
    drawFace(g, x, hy, ex, L.face);
  }
  drawHat(g, x, hy, dir, L.hat);
}

function drawFace(g, x, hy, ex, face) {
  switch (face) {
    case 'eyepatch': rect(g, x + 3 + ex, hy + 3, 4, 3, '#111'); rect(g, x + 2, hy + 3, 11, 1, '#111'); break;
    case 'hero_mask': rect(g, x + 2, hy + 3, 11, 3, '#2f6fd6'); rect(g, x + 4 + ex, hy + 4, 2, 1, '#fff'); rect(g, x + 9 + ex, hy + 4, 2, 1, '#fff'); break;
    case 'mustache': rect(g, x + 4 + ex, hy + 6, 7, 1, '#2a1a10'); break;
    case 'pirate_beard': rect(g, x + 3 + ex, hy + 7, 9, 4, '#3a2416'); break;
    case 'fangs': rect(g, x + 6 + ex, hy + 8, 1, 1, '#fff'); rect(g, x + 8 + ex, hy + 8, 1, 1, '#fff'); break;
    case 'mummy_wrap': for (let i = 0; i < 3; i++) rect(g, x + 2, hy + 1 + i * 3, 11, 1, '#ece4cf'); break;
    case 'visor': rect(g, x + 2, hy + 3, 11, 3, '#7a4cff'); break;
    case 'skull_mask': rect(g, x + 2, hy + 1, 11, 9, '#f2f0e6'); rect(g, x + 4 + ex, hy + 3, 3, 3, '#121214'); rect(g, x + 8 + ex, hy + 3, 3, 3, '#121214'); rect(g, x + 5 + ex, hy + 8, 5, 1, '#121214'); break;
    default:
  }
}

function drawHat(g, x, hy, dir, hat) {
  switch (hat) {
    case 'pirate_hat': rect(g, x, hy - 2, 15, 3, '#1d1d22'); rect(g, x + 3, hy - 5, 9, 3, '#1d1d22'); rect(g, x, hy - 2, 15, 1, '#d8b440'); if (dir !== 'up') rect(g, x + 7, hy - 4, 1, 1, '#f4f1e6'); break;
    case 'fire_helmet': rect(g, x + 1, hy - 3, 13, 4, '#d23a2a'); rect(g, x - 1, hy, 17, 2, '#c23224'); if (dir !== 'up') rect(g, x + 6, hy - 2, 3, 3, '#e8c64a'); break;
    case 'franken_top': rect(g, x + 1, hy - 4, 13, 5, '#1e2420'); rect(g, x, hy + 7, 2, 2, '#8c9096'); rect(g, x + 13, hy + 7, 2, 2, '#8c9096'); break;
    case 'wolf_ears': rect(g, x + 2, hy - 1, 11, 3, '#6b4a32'); rect(g, x + 2, hy - 4, 3, 3, '#6b4a32'); rect(g, x + 10, hy - 4, 3, 3, '#6b4a32'); break;
    case 'vamp_hair': rect(g, x + 2, hy - 1, 11, 4, '#0e0e12'); if (dir !== 'up') rect(g, x + 7, hy + 3, 1, 1, '#0e0e12'); break;
    case 'space_helmet': g.strokeStyle = 'rgba(200,230,255,0.9)'; g.lineWidth = 1; g.beginPath(); g.arc(x + 7.5, hy + 4.5, 8, 0, 7); g.stroke(); g.fillStyle = 'rgba(200,230,255,0.18)'; g.fill(); break;
    case 'robot_antenna': rect(g, x + 7, hy - 5, 1, 4, '#c9ced6'); rect(g, x + 6, hy - 7, 3, 2, '#ff4d6d'); break;
    default:
  }
}

function drawProp(g, x, y, prop) {
  switch (prop) {
    case 'candy_pail': rect(g, x - 1, y, 5, 4, '#ef7d1f'); rect(g, x, y + 1, 1, 1, '#2b1606'); rect(g, x + 2, y + 1, 1, 1, '#2b1606'); rect(g, x - 1, y - 1, 5, 1, '#333'); break;
    case 'cutlass': rect(g, x + 1, y - 7, 1, 7, '#d9dde3'); rect(g, x, y - 1, 3, 1, '#d8b440'); break;
    case 'lantern': rect(g, x, y, 3, 4, '#ffcf6a'); rect(g, x, y - 1, 3, 1, '#2b2b2b'); break;
    case 'blaster': rect(g, x, y, 4, 2, '#7a4cff'); rect(g, x + 3, y, 2, 1, '#34e0a1'); break;
    case 'star_wand': rect(g, x + 1, y - 5, 1, 6, '#f4f1e6'); rect(g, x, y - 7, 3, 3, '#ffd23f'); break;
    case 'hose': rect(g, x, y, 4, 2, '#e8c64a'); rect(g, x - 1, y + 2, 3, 3, '#d23a2a'); break;
    case 'hero_shield': rect(g, x - 1, y - 2, 5, 5, '#e63b3b'); rect(g, x, y - 1, 3, 3, '#f4f1e6'); rect(g, x + 1, y, 1, 1, '#2f6fd6'); break;
    case 'parrot': rect(g, x - 13, y - 13, 3, 4, '#2eaa4a'); rect(g, x - 11, y - 12, 1, 1, '#f2c230'); break;
    case 'pet_bat': rect(g, x - 9, y - 22, 3, 2, '#2a2030'); rect(g, x - 12, y - 23, 3, 1, '#3a2a4a'); rect(g, x - 6, y - 23, 3, 1, '#3a2a4a'); break;
    default:
  }
}

function drawGhost(g, x, y, scale, alpha, face, t) {
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  g.scale(scale, scale);
  g.fillStyle = '#eef0ff';
  g.beginPath();
  g.moveTo(-7, 6);
  g.quadraticCurveTo(-8, -10, 0, -11);
  g.quadraticCurveTo(8, -10, 7, 6);
  for (let i = 0; i < 4; i++) g.lineTo(7 - (i + 0.5) * 3.5, 6 + (i % 2 ? -2 : 2) + Math.sin(t * 8 + i) * 1);
  g.lineTo(-7, 6);
  g.fill();
  g.fillStyle = '#1a1a22';
  if (face === 'boo') { g.fillRect(-4, -5, 3, 4); g.fillRect(1, -5, 3, 4); g.beginPath(); g.ellipse(0, 2, 3, 3.5, 0, 0, 7); g.fill(); }
  else if (face === 'scared') { g.fillRect(-4, -4, 2, 2); g.fillRect(2, -4, 2, 2); g.fillRect(-2, 1, 4, 1); }
  else { g.fillRect(-4, -5, 2, 3); g.fillRect(2, -5, 2, 3); g.fillStyle = '#f29bb6'; g.fillRect(-6, -1, 2, 1); g.fillRect(4, -1, 2, 1); g.fillStyle = '#1a1a22'; g.fillRect(-1, 0, 2, 1); }
  g.restore();
}

// ---------------------------------------------------------------------------
export class HauntedHouse {
  constructor(canvas, names) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.floors = makeFloors(names);
    for (const f of Object.values(this.floors)) this.prepareFloor(f);
    this.dark = document.createElement('canvas');
    this.dg = this.dark.getContext('2d');
    this.time = 0;
    this.shake = 0;
    this.flash = 0;
    this.nextThunder = 12;
    this.nextCreak = 5;
    this.flicker = 1;
    this.nextFlicker = 6;
    this.popups = [];
    this.roomName = '';
  }

  prepareFloor(f) {
    const grid = [];
    for (let y = 0; y < MH; y++) grid.push(new Array(MW).fill('#'));
    const floorKind = [];
    for (let y = 0; y < MH; y++) floorKind.push(new Array(MW).fill(null));
    for (const r of f.rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { grid[y][x] = '.'; floorKind[y][x] = r.floor; }
    for (const [x, y, w, h] of f.doors) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { grid[yy][xx] = '.'; floorKind[yy][xx] = 'wood2'; }
    if (f.exit) for (let i = 0; i < f.exit.w; i++) { grid[f.exit.y][f.exit.x + i] = 'E'; floorKind[f.exit.y][f.exit.x + i] = 'marble'; }
    f.grid = grid;
    f.solid = grid.map((row) => row.map((c) => c === '#'));
    for (const fu of f.furniture) {
      if (!SOLID.has(fu.t)) continue;
      const shrink = fu.t === 'bed' || fu.t === 'sofa' || fu.t === 'table' ? 0 : 0;
      for (let y = fu.y; y < fu.y + fu.h - shrink; y++) for (let x = fu.x; x < fu.x + fu.w; x++) f.solid[y][x] = true;
    }
    // static layer
    const c = document.createElement('canvas');
    c.width = MW * T; c.height = MH * T;
    const g = c.getContext('2d');
    const rng = mkRng(f.name === 'ground' ? 5 : 11);
    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        if (grid[y][x] === '#') {
          const face = y + 1 < MH && grid[y + 1][x] !== '#';
          drawWall(g, x, y, face, rng, f.name);
        } else drawFloor(g, floorKind[y][x] || 'wood2', x, y, rng);
      }
    }
    // stairs
    if (f.stairs) {
      const s = f.stairs;
      for (let i = 0; i < s.h * 4; i++) rect(g, s.x * T, s.y * T + i * 4, s.w * T, 3, f.name === 'ground' ? shade('#7a4e2e', 30 - i * 6) : shade('#7a4e2e', -10 - i * 2));
      rect(g, s.x * T - 2, s.y * T, 2, s.h * T, '#3a2214'); rect(g, (s.x + s.w) * T, s.y * T, 2, s.h * T, '#3a2214');
    }
    if (f.exit) { rect(g, f.exit.x * T, f.exit.y * T, f.exit.w * T, T, '#4a2a18'); rect(g, f.exit.x * T + 2, f.exit.y * T + 2, f.exit.w * T - 4, T - 2, '#24282b'); rect(g, (f.exit.x + f.exit.w) * T - 6, f.exit.y * T + 8, 2, 2, '#e8c64a'); }
    // rugs first, then furniture
    for (const fu of f.furniture.filter((q) => q.t === 'rug')) PAINT.rug(g, fu.x * T, fu.y * T, fu.w * T, fu.h * T, fu);
    for (const fu of f.furniture.filter((q) => q.t !== 'rug')) PAINT[fu.t]?.(g, fu.x * T, fu.y * T, fu.w * T, fu.h * T, fu);
    // windows on walls
    for (const [x, y] of f.windows) {
      rect(g, x * T + 3, y * T + 2, 10, 11, '#3a2a1a'); rect(g, x * T + 4, y * T + 3, 8, 9, '#1a2448');
      rect(g, x * T + 7, y * T + 3, 1, 9, '#3a2a1a'); rect(g, x * T + 4, y * T + 7, 8, 1, '#3a2a1a');
      rect(g, x * T + 5, y * T + 4, 1, 1, '#f2efd8');
    }
    // cobwebs in corners
    g.strokeStyle = 'rgba(220,215,235,0.45)'; g.lineWidth = 1;
    for (const r of f.rooms) {
      for (const [cx, cy, sx] of [[r.x * T, r.y * T, 1], [(r.x + r.w) * T, r.y * T, -1]]) {
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + sx * (14 - i * 3), cy + i * 4.5); g.stroke(); }
        for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(cx + sx * k * 5, cy); g.lineTo(cx, cy + k * 5); g.stroke(); }
      }
    }
    f.layer = c;
    // lights
    f.lights = [];
    for (const fu of f.furniture) {
      if (fu.t === 'fireplace') f.lights.push({ x: fu.x + fu.w / 2, y: fu.y + 1.5, r: 6, c: '255,140,40', fl: 1 });
      if (fu.t === 'candelabra' || fu.t === 'candle') f.lights.push({ x: fu.x + 0.5, y: fu.y + 0.4, r: 3.4, c: '255,190,90', fl: 0.6 });
      if (fu.t === 'cauldron') f.lights.push({ x: fu.x + 1, y: fu.y + 1, r: 3.5, c: '120,255,120', fl: 0.5 });
      if (fu.t === 'pumpkin') f.lights.push({ x: fu.x + 0.5, y: fu.y + 0.6, r: 2.4, c: '255,150,40', fl: 0.8 });
      if (fu.t === 'rocket') f.lights.push({ x: fu.x + 1, y: fu.y + 1, r: 2.2, c: '120,190,255', fl: 0.2 });
    }
    for (const [x, y] of f.windows) f.lights.push({ x: x + 0.5, y: y + (y === 0 ? 1 : 0), r: 2.6, c: '140,160,255', fl: 0.1, win: true });
  }

  start(kidCfg, costume, save, callbacks, floor = 'ground') {
    this.cfg = kidCfg;
    this.look = kidLook(kidCfg, costume);
    this.save = save;
    this.cb = callbacks;
    this.floor = this.floors[floor];
    this.p = { x: 22, y: 26.6, dir: 'up', frame: 0, anim: 0 };
    this.fade = 1;
    this.roomName = '';
    this.setupGhosts();
    this.resize();
  }

  setupGhosts() {
    this.ghosts = [];
    for (const fu of this.floor.furniture) {
      if (!fu.ghost) continue;
      this.ghosts.push({ kind: 'hider', hx: fu.x + fu.w / 2, hy: fu.y + fu.h + 0.4, fu, x: fu.x + fu.w / 2, y: fu.y + fu.h / 2, state: 'hidden', t: 0, cd: 0, rattle: 0 });
    }
    for (const fl of this.floor.floaters) {
      this.ghosts.push({ kind: 'floater', x: fl.x, y: fl.y, vx: 0.6, vy: 0.4, state: 'float', t: Math.random() * 5, cd: 0, alpha: 0.75 });
    }
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    // show about 13 tiles vertically (a bit more on wide tablets)
    this.scale = Math.max(2, Math.round(this.canvas.height / (13 * T)));
    this.dark.width = Math.ceil(this.canvas.width / 4);
    this.dark.height = Math.ceil(this.canvas.height / 4);
  }

  nearExit() {
    const e = this.floor.exit;
    return e && this.p.y > e.y - 1.6 && this.p.x > e.x - 0.5 && this.p.x < e.x + e.w + 0.5;
  }

  actionLabel() {
    if (this.nearExit()) return { label: 'Go outside', icon: '🚪', kind: 'exit' };
    return { label: 'BOO!', icon: '👻', kind: 'boo' };
  }

  action() {
    if (this.nearExit()) { sfx.door(); this.cb.onExit(); return; }
    // the kid says BOO! — nearby ghosts get scared and drop candy
    sfx.boo();
    this.popups.push({ text: 'BOO!', x: this.p.x, y: this.p.y - 1.8, t: 0, color: '#ffd23f', big: true });
    for (const gh of this.ghosts) {
      if (gh.state === 'hidden') continue;
      const d = Math.hypot(gh.x - this.p.x, gh.y - this.p.y);
      if (d < 3.4) {
        gh.state = 'scared';
        gh.t = 0;
        gh.fx = (gh.x - this.p.x) / (d || 1);
        gh.fy = (gh.y - this.p.y) / (d || 1);
        if (gh.cd <= 0) {
          gh.cd = 25;
          this.cb.onCandy(1);
          this.popups.push({ text: '+1 🍬', x: gh.x, y: gh.y - 1, t: 0, color: '#ffffff' });
          setTimeout(() => sfx.giggle(), 250);
        }
      }
    }
  }

  solidAt(x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return true;
    return this.floor.solid[ty][tx];
  }

  collides(x, y) {
    const hw = 0.3;
    return this.solidAt(x - hw, y - 0.35) || this.solidAt(x + hw, y - 0.35) || this.solidAt(x - hw, y - 0.02) || this.solidAt(x + hw, y - 0.02);
  }

  update(dt, input) {
    this.time += dt;
    const p = this.p;
    this.fade = Math.max(0, this.fade - dt * 2.5);
    // move
    const speed = 4.6;
    const mx = input.x, my = -input.y;
    const moving = input.mag > 0.05;
    if (moving) {
      const nx = p.x + mx * speed * dt, ny = p.y + my * speed * dt;
      if (!this.collides(nx, p.y)) p.x = nx;
      if (!this.collides(p.x, ny)) p.y = ny;
      if (Math.abs(mx) > Math.abs(my)) p.dir = mx > 0 ? 'right' : 'left';
      else p.dir = my > 0 ? 'down' : 'up';
      p.anim += dt * 8;
      p.frame = 1 + (Math.floor(p.anim) % 2);
    } else p.frame = 0;

    // stairs
    const st = this.floor.stairs;
    if (st && p.x > st.x && p.x < st.x + st.w && p.y > st.y && p.y < st.y + st.h + 0.2) {
      const to = this.floors[st.to];
      this.floor = to;
      p.x = to.stairs.arrive.x; p.y = to.stairs.arrive.y; p.dir = 'down';
      this.fade = 1;
      this.setupGhosts();
      sfx.creak();
      this.roomName = '';
    }

    // room label
    const room = this.floor.rooms.find((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
    if (room && room.name !== this.roomName) { this.roomName = room.name; this.cb.onRoom(room.name); }

    // golden candy corn
    for (const c of this.floor.corn) {
      if (this.save.found.includes(c.id)) continue;
      if (Math.hypot(c.x - p.x, c.y - (p.y - 0.3)) < 0.8) {
        this.save.found.push(c.id);
        sfx.found();
        this.popups.push({ text: '🌽 Golden Candy Corn!', x: c.x, y: c.y - 1.2, t: 0, color: '#ffd23f' });
        this.cb.onCorn(this.save.found.length);
      }
    }

    // ghosts
    for (const gh of this.ghosts) {
      gh.cd -= dt;
      gh.t += dt;
      const d = Math.hypot(gh.x - p.x, gh.y - p.y);
      if (gh.kind === 'hider') {
        if (gh.state === 'hidden') {
          const dh = Math.hypot(gh.hx - p.x, gh.hy - p.y);
          gh.rattle = dh < 4.5 && gh.cd <= 0 ? Math.sin(this.time * 40) * (Math.sin(this.time * 3 + gh.hx) > 0.3 ? 1 : 0) : 0;
          if (dh < 1.7 && gh.cd <= 0) {
            gh.state = 'pop'; gh.t = 0; gh.x = gh.hx; gh.y = gh.hy - 0.3;
            this.shake = 0.45;
            sfx.boo();
            this.popups.push({ text: 'BOO!', x: gh.x, y: gh.y - 2.2, t: 0, color: '#ffffff', big: true });
          }
        } else if (gh.state === 'pop') {
          if (gh.t > 1.0) { gh.state = 'giggle'; gh.t = 0; sfx.giggle(); }
        } else if (gh.state === 'giggle' || gh.state === 'scared') {
          const fx = gh.state === 'scared' ? gh.fx : 0.3, fy = gh.state === 'scared' ? gh.fy : -1;
          gh.x += fx * dt * 3; gh.y += fy * dt * 2.2;
          if (gh.t > 1.6) { gh.state = 'hidden'; gh.cd = Math.max(gh.cd, 20); gh.x = gh.hx; gh.y = gh.hy; }
        }
      } else {
        if (gh.state === 'scared') {
          gh.x += gh.fx * dt * 4; gh.y += gh.fy * dt * 4;
          if (gh.t > 1.4) { gh.state = 'float'; gh.t = 0; }
        } else {
          // drift around, sometimes sneak up behind the player
          gh.x += gh.vx * dt; gh.y += gh.vy * dt;
          if (gh.x < 2 || gh.x > MW - 2) gh.vx *= -1;
          if (gh.y < 2 || gh.y > MH - 2) gh.vy *= -1;
          if (d < 6 && d > 1.3) { gh.x += ((p.x - gh.x) / d) * dt * 0.8; gh.y += ((p.y - gh.y) / d) * dt * 0.8; }
          if (Math.random() < dt * 0.2) { gh.vx = (Math.random() - 0.5) * 1.6; gh.vy = (Math.random() - 0.5) * 1.6; }
          gh.alpha = 0.45 + Math.sin(this.time * 1.5 + gh.x) * 0.25;
          if (d < 1.2 && gh.cd <= 0) {
            gh.cd = 12;
            this.shake = 0.25;
            sfx.boo();
            this.popups.push({ text: 'Boo!', x: gh.x, y: gh.y - 1.8, t: 0, color: '#d8d8ff' });
          }
        }
      }
    }

    // spooky atmosphere
    this.nextThunder -= dt;
    if (this.nextThunder < 0) { this.flash = 1; this.nextThunder = 14 + Math.random() * 18; setTimeout(() => sfx.thunder(), 500); }
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.nextCreak -= dt;
    if (this.nextCreak < 0) { sfx.creak(); this.nextCreak = 6 + Math.random() * 10; }
    this.nextFlicker -= dt;
    if (this.nextFlicker < 0) { this.flickerT = 0.7; this.nextFlicker = 8 + Math.random() * 10; }
    if (this.flickerT > 0) { this.flickerT -= dt; this.flicker = Math.random() < 0.5 ? 0.35 : 1; } else this.flicker = 1;
    this.shake = Math.max(0, this.shake - dt);
    for (const pp of this.popups) pp.t += dt;
    this.popups = this.popups.filter((pp) => pp.t < 1.6);
  }

  render() {
    const g = this.g, S = this.scale, cw = this.canvas.width, ch = this.canvas.height;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#07040c';
    g.fillRect(0, 0, cw, ch);
    // camera
    const viewW = cw / S, viewH = ch / S;
    let camX = this.p.x * T - viewW / 2, camY = (this.p.y - 0.8) * T - viewH / 2;
    camX = Math.max(-T, Math.min(MW * T - viewW + T, camX));
    camY = Math.max(-T, Math.min(MH * T - viewH + T, camY));
    if (MW * T + 2 * T < viewW) camX = (MW * T - viewW) / 2;
    if (this.shake > 0) { camX += (Math.random() - 0.5) * 4 * this.shake * 4; camY += (Math.random() - 0.5) * 4 * this.shake * 4; }
    this.cam = { x: camX, y: camY };
    g.save();
    g.scale(S, S);
    g.translate(-Math.round(camX), -Math.round(camY));
    g.drawImage(this.floor.layer, 0, 0);

    const t = this.time;
    // animated furniture
    for (const fu of this.floor.furniture) {
      const x = fu.x * T, y = fu.y * T;
      if (fu.t === 'fireplace') {
        for (let i = 0; i < 6; i++) {
          const fx = x + 10 + i * ((fu.w * T - 20) / 6), fh = 6 + Math.sin(t * 12 + i * 2) * 3 + Math.sin(t * 7 + i) * 2;
          rect(g, fx, y + fu.h * T - 4 - fh, 4, fh, i % 2 ? '#ff9a2a' : '#ffd04a');
          rect(g, fx + 1, y + fu.h * T - 4 - fh * 0.5, 2, fh * 0.5, '#fff1b8');
        }
      }
      if (fu.t === 'cauldron') {
        g.fillStyle = '#5cff6a'; g.beginPath(); g.ellipse(x + 16, y + 12, 12, 4, 0, 0, 7); g.fill();
        for (let i = 0; i < 3; i++) { const by = ((t * 6 + i * 5) % 14); g.fillStyle = 'rgba(160,255,160,0.8)'; g.beginPath(); g.arc(x + 9 + i * 7, y + 10 - by, 2 - by * 0.1, 0, 7); g.fill(); }
      }
      if (fu.t === 'clock') { const sw = Math.sin(t * 3.2) * 3; rect(g, x + 7 + sw, y + 16, 2, 8, '#c9a640'); rect(g, x + 6 + sw, y + 23, 4, 3, '#e8c64a'); }
      if (fu.t === 'candelabra' || fu.t === 'candle') {
        const xs = fu.t === 'candle' ? [7] : [3, 7, 11];
        for (const cx of xs) { const fl = Math.sin(t * 15 + cx) > 0 ? 1 : 0; rect(g, x + cx, y + (fu.t === 'candle' ? 3 : -1) - fl, 2, 3 + fl, '#ffd04a'); }
      }
      if (fu.t === 'rocket') { const b = Math.sin(t * 6) > 0; rect(g, x + 14, y + 16, 4, 3, b ? '#5affd8' : '#5ab0e0'); }
    }
    // hiders rattle their furniture
    for (const gh of this.ghosts) {
      if (gh.kind === 'hider' && gh.state === 'hidden' && gh.rattle) {
        const fu = gh.fu;
        g.save(); g.translate(gh.rattle, 0);
        PAINT[fu.t](g, fu.x * T, fu.y * T, fu.w * T, fu.h * T, fu);
        g.restore();
        if (Math.sin(t * 2 + gh.hx) > 0.6) { g.fillStyle = '#ffffff'; g.font = 'bold 7px sans-serif'; g.fillText('?', fu.x * T + fu.w * T / 2 - 2, fu.y * T - 2); }
      }
    }
    // portraits with eyes that follow you
    for (const [px, py] of this.floor.portraits) {
      const x = px * T, y = py * T;
      rect(g, x + 2, y + 1, 12, 13, '#c9a640'); rect(g, x + 3, y + 2, 10, 11, '#3a2a3a');
      rect(g, x + 5, y + 4, 6, 6, '#c8a890'); rect(g, x + 5, y + 3, 6, 2, '#2a1a10'); rect(g, x + 4, y + 10, 8, 3, '#5a2a4a');
      const ang = Math.atan2(this.p.y - (py + 0.4), this.p.x - (px + 0.5));
      const ex = Math.round(Math.cos(ang) * 0.8), ey = Math.round(Math.sin(ang) * 0.8);
      rect(g, x + 6, y + 6, 2, 2, '#f2efe6'); rect(g, x + 9, y + 6, 2, 2, '#f2efe6');
      rect(g, x + 6 + Math.max(0, ex), y + 6 + Math.max(0, ey), 1, 1, '#111'); rect(g, x + 9 + Math.max(0, ex), y + 6 + Math.max(0, ey), 1, 1, '#111');
    }
    // golden candy corn sparkles
    for (const c of this.floor.corn) {
      if (this.save.found.includes(c.id)) continue;
      const x = c.x * T, y = c.y * T + Math.sin(t * 3 + c.x) * 1.5;
      g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 4, y + 4); g.lineTo(x - 4, y + 4); g.fill();
      g.fillStyle = '#ff9a2a'; g.fillRect(x - 3, y, 6, 2);
      g.fillStyle = '#ffffff'; g.fillRect(x - 3, y + 3, 6, 1);
      if (Math.sin(t * 5 + c.y) > 0.6) { rect(g, x + 5, y - 7, 1, 3, '#fff'); rect(g, x + 4, y - 6, 3, 1, '#fff'); }
    }
    // sorted entities
    const ents = [{ y: this.p.y, draw: () => drawKid(g, this.p.x * T, this.p.y * T, this.p.dir, this.p.frame, this.look) }];
    for (const gh of this.ghosts) {
      if (gh.state === 'hidden') continue;
      ents.push({
        y: gh.y + 2,
        draw: () => {
          let sc = 1, al = gh.alpha ?? 0.9, face = 'happy';
          if (gh.state === 'pop') { sc = 0.4 + Math.min(1, gh.t * 4) * 1.3; face = 'boo'; al = 0.95; }
          if (gh.state === 'giggle') { sc = 1.2; al = Math.max(0, 0.9 - gh.t * 0.5); }
          if (gh.state === 'scared') { sc = 1; face = 'scared'; al = Math.max(0.2, 0.9 - gh.t * 0.4); }
          const bob = Math.sin(t * 3 + gh.x) * 2;
          drawGhost(g, gh.x * T, gh.y * T - 12 + bob, sc, al, face, t);
        },
      });
    }
    ents.sort((a, b) => a.y - b.y).forEach((e) => e.draw());
    g.restore();

    // darkness + lights (drawn at quarter resolution for speed)
    const dg = this.dg, dw = this.dark.width, dh = this.dark.height, k = S / 4;
    dg.globalCompositeOperation = 'source-over';
    dg.clearRect(0, 0, dw, dh);
    const darkness = 0.88 + (1 - this.flicker) * 0.1 - this.flash * 0.6;
    dg.fillStyle = `rgba(8,4,18,${Math.max(0.15, darkness)})`;
    dg.fillRect(0, 0, dw, dh);
    dg.globalCompositeOperation = 'destination-out';
    const toD = (x, y) => [((x * T - this.cam.x) * k), ((y * T - this.cam.y) * k)];
    const hole = (x, y, r, a) => {
      const [cx, cy] = toD(x, y);
      const rr = r * T * k;
      if (cx < -rr || cy < -rr || cx > dw + rr || cy > dh + rr) return;
      const grd = dg.createRadialGradient(cx, cy, 0, cx, cy, rr);
      grd.addColorStop(0, `rgba(0,0,0,${a})`); grd.addColorStop(0.6, `rgba(0,0,0,${a * 0.6})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
      dg.fillStyle = grd;
      dg.beginPath(); dg.arc(cx, cy, rr, 0, 7); dg.fill();
    };
    // the kid's flashlight glow
    const hasLantern = this.look.prop === 'lantern';
    hole(this.p.x, this.p.y - 0.6, hasLantern ? 6.5 : 4.6, 1);
    const fdx = { left: -1, right: 1, up: 0, down: 0 }[this.p.dir], fdy = { up: -1, down: 1, left: 0, right: 0 }[this.p.dir];
    hole(this.p.x + fdx * 2.5, this.p.y - 0.6 + fdy * 2.5, 3.6, 0.8);
    for (const L of this.floor.lights) {
      const fl = 1 - L.fl * 0.15 * (Math.sin(t * 11 + L.x) * 0.5 + 0.5);
      hole(L.x, L.y, L.r * fl * (L.win ? 1 : this.flicker === 1 ? 1 : 0.6), L.win ? 0.45 : 0.95);
    }
    for (const gh of this.ghosts) if (gh.state !== 'hidden') hole(gh.x, gh.y - 0.8, 2.2, 0.6);
    g.imageSmoothingEnabled = true;
    g.drawImage(this.dark, 0, 0, cw, ch);
    // warm color glow on top
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const L of this.floor.lights) {
      if (L.win) continue;
      const cx = (L.x * T - this.cam.x) * S, cy = (L.y * T - this.cam.y) * S, rr = L.r * T * S * 0.7;
      if (cx < -rr || cy < -rr || cx > cw + rr || cy > ch + rr) continue;
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
      const a = 0.18 * this.flicker * (1 - L.fl * 0.3 * (Math.sin(t * 13 + L.y) * 0.5 + 0.5));
      grd.addColorStop(0, `rgba(${L.c},${a})`); grd.addColorStop(1, `rgba(${L.c},0)`);
      g.fillStyle = grd;
      g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
    }
    g.restore();
    if (this.flash > 0) { g.fillStyle = `rgba(220,225,255,${this.flash * 0.35})`; g.fillRect(0, 0, cw, ch); }

    // popups
    g.save();
    g.textAlign = 'center';
    for (const pp of this.popups) {
      const x = (pp.x * T - this.cam.x) * S, y = (pp.y * T - this.cam.y) * S - pp.t * 30 * (S / 3);
      const a = Math.max(0, 1 - pp.t / 1.6);
      g.globalAlpha = a;
      g.font = `bold ${Math.round((pp.big ? 13 : 8) * S)}px "Chewy", "Trebuchet MS", sans-serif`;
      g.lineWidth = S * 1.5;
      g.strokeStyle = 'rgba(20,10,30,0.9)';
      g.strokeText(pp.text, x, y);
      g.fillStyle = pp.color;
      g.fillText(pp.text, x, y);
    }
    g.restore();
    if (this.fade > 0) { g.fillStyle = `rgba(0,0,0,${this.fade})`; g.fillRect(0, 0, cw, ch); }
  }
}

export const CORN_TOTAL = 8;
export const CORN_REWARDS = [
  { at: 3, item: 'skull_mask' },
  { at: 6, item: 'pumpkin_head' },
  { at: 8, item: 'ghost_sheet' },
];
