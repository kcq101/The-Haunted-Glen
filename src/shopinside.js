import * as THREE from 'three';
import { litMat, q } from './quality.js';
import { ITEMS } from './costumes.js';
import { Kid } from './character.js';
import { makeHazel } from './hazel.js';

// ---------------------------------------------------------------------------
// Inside the Hares Hill Halloween Emporium.
// Four shelf bays on the back wall (Hats, Outfits, Faces, Props) hold the real
// costume pieces, chunky and easy to tap. Hazel works the front desk on the
// left. Each shelf spot has an invisible hit box (userData.itemId) for taps and
// a little price tag that main.js keeps up to date.
// ---------------------------------------------------------------------------

export const BAYS = [
  { slot: 'hat', label: 'Hats', icon: '🎩' },
  { slot: 'outfit', label: 'Outfits', icon: '👕' },
  { slot: 'face', label: 'Faces', icon: '🎭' },
  { slot: 'prop', label: 'Props', icon: '🪄' },
];

const W = 18, D = 13, H = 6.4;
const BACK = -D / 2;
const BAY_W = 2.9, BAY_X = [-4.65, -1.55, 1.55, 4.65], BAY_Z = BACK + 0.45;
const SHELF_Y = [0.82, 1.78, 2.74];

const WOOD = '#6b4426', WOOD_DARK = '#4a2e1a', WOOD_LIGHT = '#8a5a34';
const PURPLE = '#5b2f80', GOLD = '#ffd27a';

function plankTexture(base, n = 10, w = 256, h = 256, vertical = false) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const shades = [0, 10, -8, 5, -14, 8];
  const col = new THREE.Color(base);
  for (let i = 0; i < n; i++) {
    const k = shades[i % shades.length] / 255;
    g.fillStyle = `rgb(${(col.r + k) * 255 | 0},${(col.g + k) * 255 | 0},${(col.b + k) * 255 | 0})`;
    const s = (vertical ? w : h) / n;
    if (vertical) g.fillRect(i * s, 0, s, h); else g.fillRect(0, i * s, w, s);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    if (vertical) g.fillRect(i * s, 0, 2, h); else g.fillRect(0, i * s, w, 2);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let j = 0; j < 3; j++) {
      const o = ((i * 131 + j * 71) % 97) / 97;
      if (vertical) g.fillRect(i * s + o * s, ((i * 53 + j * 89) % 256), 1, 18); else g.fillRect(((i * 53 + j * 89) % 256), i * s + o * s, 18, 1);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function boardTexture(text, icon, { w = 512, h = 128, bg = PURPLE, fg = GOLD, font = 'bold 64px Georgia, serif' } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#3a2214'; g.fillRect(0, 0, w, h);
  g.fillStyle = bg; g.fillRect(10, 10, w - 20, h - 20);
  g.strokeStyle = '#e8b84a'; g.lineWidth = 4; g.strokeRect(18, 18, w - 36, h - 36);
  g.fillStyle = fg; g.textBaseline = 'middle'; g.textAlign = 'center';
  const lines = Array.isArray(text) ? text : [text];
  let px = parseFloat(font.match(/(\d+)px/)[1]);
  g.font = font;
  const maxW = w - (icon ? 150 : 70);
  const widest = Math.max(...lines.map((l) => g.measureText(l).width));
  if (widest > maxW) { px = Math.floor((px * maxW) / widest); g.font = font.replace(/\d+px/, `${px}px`); }
  const x = w / 2 + (icon ? 30 : 0);
  lines.forEach((l, i) => g.fillText(l, x, h / 2 + (i - (lines.length - 1) / 2) * px * 1.05 + 3));
  if (icon) {
    g.font = `${h * 0.48}px sans-serif`;
    const tw = Math.max(...lines.map((l) => { g.font = font.replace(/\d+px/, `${px}px`); return g.measureText(l).width; }));
    g.font = `${h * 0.48}px sans-serif`;
    g.fillText(icon, x - tw / 2 - h * 0.38, h / 2 + 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function rugTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 320;
  const g = c.getContext('2d');
  g.fillStyle = '#4a2466'; g.fillRect(0, 0, 512, 320);
  g.fillStyle = '#e8762a'; g.fillRect(14, 14, 484, 292);
  g.fillStyle = '#5b2f80'; g.fillRect(26, 26, 460, 268);
  // little diamonds round the border
  g.fillStyle = '#7a45a6';
  for (let i = 0; i < 18; i++) for (const y of [44, 276]) { g.save(); g.translate(48 + i * 24.5, y); g.rotate(Math.PI / 4); g.fillRect(-5, -5, 10, 10); g.restore(); }
  // big jack-o'-lantern
  g.fillStyle = '#f0802a';
  g.beginPath(); g.ellipse(256, 165, 140, 92, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#d96a1c';
  for (const dx of [-70, 0, 70]) { g.beginPath(); g.ellipse(256 + dx, 165, 18, 88, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#4d6b2a'; g.fillRect(248, 62, 16, 24);
  g.fillStyle = '#5b2f80';
  const tri = (x, y, s) => { g.beginPath(); g.moveTo(x - s, y + s * 0.6); g.lineTo(x + s, y + s * 0.6); g.lineTo(x, y - s * 0.7); g.fill(); };
  tri(206, 140, 26); tri(306, 140, 26); tri(256, 175, 14);
  g.beginPath(); g.moveTo(170, 192); g.quadraticCurveTo(256, 260, 342, 192); g.quadraticCurveTo(256, 222, 170, 192); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 160;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 160);
  gr.addColorStop(0, '#1a1650'); gr.addColorStop(1, '#3a3a9a');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 160);
  g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(92, 34, 14, 0, 7); g.fill();
  g.fillStyle = '#1a1650'; g.beginPath(); g.arc(86, 30, 12, 0, 7); g.fill();
  g.fillStyle = '#ffffff';
  for (const [x, y] of [[20, 20], [50, 40], [30, 60], [110, 70], [70, 15]]) g.fillRect(x, y, 2, 2);
  g.fillStyle = '#0f1d2a';
  for (const x of [10, 45, 80, 115]) { g.beginPath(); g.moveTo(x - 20, 160); g.lineTo(x, 95 + (x % 30)); g.lineTo(x + 20, 160); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// soft round glow, used behind the item a kid is wearing / trying on
function haloTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(255,230,140,0.95)');
  gr.addColorStop(0.45, 'rgba(255,200,80,0.45)');
  gr.addColorStop(1, 'rgba(255,170,40,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}


// --- cozy extras: wallpaper, wainscot, velvet, glows ------------------------
function canvasTex(w, h, paint, repeat = false) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// plum wallpaper with soft stripes, little gold stars and crescent moons
function wallpaperTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#4a2753'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + 40, 0, 24, h); g.fillStyle = 'rgba(255,220,160,0.05)'; g.fillRect(x, 0, 6, h); }
    const star = (x, y, r) => {
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      g.closePath(); g.fill();
    };
    g.fillStyle = 'rgba(232,184,74,0.55)';
    star(20, 30, 7); star(148, 158, 7); star(84, 98, 4); star(212, 222, 4); star(212, 60, 3); star(84, 220, 3);
    g.fillStyle = 'rgba(255,236,190,0.45)';
    for (const [x, y] of [[148, 36], [20, 166]]) {
      g.beginPath(); g.arc(x, y, 10, 0, Math.PI * 2); g.fill();
      g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(x + 5, y - 3, 9, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }, true);
}

// raised wooden panels for the lower part of the walls
function wainscotTexture() {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#5a361d'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 128) {
      g.fillStyle = '#3e2412'; g.fillRect(x + 12, 14, 104, h - 28);
      g.fillStyle = '#6e4426'; g.fillRect(x + 16, 18, 96, h - 36);
      g.fillStyle = 'rgba(255,220,170,0.12)'; g.fillRect(x + 16, 18, 96, 3);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + 16, h - 21, 96, 3);
      g.fillStyle = 'rgba(0,0,0,0.08)';
      for (let i = 0; i < 6; i++) g.fillRect(x + 20 + i * 15, 22, 1, h - 44);
    }
  }, true);
}

// deep purple velvet for the back of each shelf bay, lit from above
function velvetTexture() {
  return canvasTex(256, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#7a3f99'); gr.addColorStop(0.45, '#5a2b78'); gr.addColorStop(1, '#2e1440');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) {
      const f = g.createLinearGradient(x, 0, x + 32, 0);
      f.addColorStop(0, 'rgba(0,0,0,0.16)'); f.addColorStop(0.5, 'rgba(255,255,255,0.05)'); f.addColorStop(1, 'rgba(0,0,0,0.16)');
      g.fillStyle = f; g.fillRect(x, 0, 32, h);
    }
    g.fillStyle = 'rgba(232,184,74,0.18)';
    for (let y = 24; y < h; y += 48) for (let x = (y / 48) % 2 ? 16 : 0; x < w; x += 32) {
      g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-2.5, -2.5, 5, 5); g.restore();
    }
  });
}

let glowTexCache = null;
function glowTexture() {
  if (glowTexCache) return glowTexCache;
  glowTexCache = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.2, 'rgba(255,200,110,0.6)'); gr.addColorStop(1, 'rgba(255,150,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  glowTexCache.colorSpace = THREE.NoColorSpace;
  return glowTexCache;
}
function glowSprite(size, color = '#ffc070', opacity = 0.8) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.scale.setScalar(size);
  sp.userData.baseOpacity = opacity;
  return sp;
}

// a proper pumpkin: ribbed, with a curly stem
const pkGeo = new THREE.SphereGeometry(1, 14, 10);
const stemMat = litMat({ color: '#5a6b2a' });
const pkMats = {};
function pumpkin(r, color = '#ef7d1f') {
  pkMats[color] = pkMats[color] || [litMat({ color }), litMat({ color: new THREE.Color(color).multiplyScalar(0.82) })];
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(pkGeo, pkMats[color][i % 2]);
    rib.scale.set(r * 0.62, r * 0.78, r * 0.95);
    rib.rotation.y = (i / 6) * Math.PI;
    g.add(rib);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.08, r * 0.13, r * 0.45, 6), stemMat);
  stem.position.y = r * 0.85; stem.rotation.z = 0.25;
  g.add(stem);
  g.position.y = r * 0.78;
  const holder = new THREE.Group();
  holder.add(g);
  return holder;
}

// little candle with a flickering flame
const waxMat = litMat({ color: '#f4ead2' });
function candle(hgt = 0.22) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, hgt, 10), waxMat);
  c.position.y = hgt / 2;
  g.add(c);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd27a' }));
  flame.scale.y = 1.8;
  flame.position.y = hgt + 0.05;
  g.add(flame);
  const glow = glowSprite(0.36, '#ffb050', 0.75);
  glow.position.y = hgt + 0.06;
  g.add(glow);
  g.userData.flame = flame; g.userData.glow = glow;
  return g;
}

// --- costume pieces on display ----------------------------------------------
const formMat = litMat({ color: '#e9dcc6' });
const pegMat = litMat({ color: WOOD_DARK });
const headR = 0.2;
const dispD = { H: 1.2, headR, torsoR: 0.14, legL: 0.43, torsoL: 0.32, hipY: 0.43, shoulderY: 0.75, headY: 0, headZ: 0, faceDY: 0 };

// small per-item turns so things face the shopper nicely on a shelf
const POSE = {
  cutlass: { rx: -Math.PI / 2.3, rz: 0.5 },
  hose: { rz: -0.3 },
  blaster: { ry: -0.6 },
  star_wand: { rz: 0.25 },
  hero_shield: { ry: 0 },
};

function headForm(withHead = true) {
  const g = new THREE.Group();
  const sph = new THREE.SphereGeometry(1, q(24, 16), q(18, 12));
  if (withHead) {
    const h = new THREE.Mesh(sph, formMat);
    h.scale.set(headR, headR * 1.02, headR * 0.96);
    g.add(h);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.32, headR * 0.42, headR * 1.2, 12), formMat);
  neck.position.y = -headR * 1.25;
  g.add(neck);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.75, headR * 0.85, headR * 0.25, 18), pegMat);
  base.position.y = -headR * 1.9;
  g.add(base);
  return g;
}

function dressForm(item) {
  // a little headless mannequin wearing the outfit (uses the stand-in kid so
  // colors, patterns and capes match exactly what the boys will wear)
  const kid = new Kid({ height: 1.0, skin: '#e9dcc6', hair: '#e9dcc6', hairStyle: 'short', shirt: '#ffffff', pants: '#ffffff', shoes: '#333333' });
  kid.setCostume({ hat: null, face: null, outfit: item.id, prop: null });
  kid.head.visible = false;
  kid.arms.forEach((a, i) => (a.rotation.z = (i ? 1 : -1) * 0.18));
  kid.animated.forEach((o) => { if (o.userData.cape) o.rotation.x = 0.12; });
  const g = new THREE.Group();
  g.add(kid.root);
  // wooden hanger + hook
  const top = kid.d.shoulderY + kid.d.torsoR * 0.6;
  const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, kid.d.torsoR * 3.0, 3, 8), pegMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = top;
  g.add(bar);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 14, Math.PI * 1.4), litMat({ color: '#c9a640' }));
  hook.position.y = (item.id === 'ghost_sheet' ? kid.d.H : top) + 0.08;
  hook.rotation.z = -0.4;
  g.add(hook);
  if (item.id === 'ghost_sheet') bar.visible = false;
  return g;
}

function displayPiece(item) {
  const g = new THREE.Group();
  if (item.slot === 'outfit') {
    g.add(dressForm(item));
    return g;
  }
  if (item.slot === 'hat' || item.slot === 'face') {
    const parts = item.build(dispD);
    const hide = parts.some((p) => p.hideHead);
    g.add(headForm(!hide));
    for (const p of parts) g.add(p.obj);
    return g;
  }
  const inner = new THREE.Group();
  for (const p of item.build(dispD)) inner.add(p.obj);
  const pose = POSE[item.id] || {};
  inner.rotation.set(pose.rx || 0, pose.ry || 0, pose.rz || 0);
  g.add(inner);
  return g;
}

// scale an object to fit a cell and stand it on (or hang it from) y = 0
function fitInto(obj, maxW, maxH, maxD, hang = false) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const s = Math.min(maxW / size.x, maxH / size.y, maxD / size.z);
  const holder = new THREE.Group();
  obj.scale.multiplyScalar(s);
  obj.position.set(-c.x * s, hang ? -box.max.y * s : -box.min.y * s, -c.z * s);
  holder.add(obj);
  holder.userData.height = size.y * s;
  obj.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return holder;
}

// a little wrapped candy, drawn so it looks the same on every phone
function drawCandy(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s); g.rotate(-0.35);
  g.fillStyle = '#ff5d8a';
  for (const d of [-1, 1]) { g.beginPath(); g.moveTo(d * 18, 0); g.lineTo(d * 38, -15); g.lineTo(d * 33, 0); g.lineTo(d * 38, 15); g.closePath(); g.fill(); }
  g.beginPath(); g.ellipse(0, 0, 21, 17, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.arc(0, 0, 11, -2.4, 0.4); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(-7, -8, 5, 3, -0.5, 0, Math.PI * 2); g.fill();
  g.restore();
}

// price tags are tiny canvases redrawn as things change
function makeTag() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.21), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  m.userData.draw = (state) => {
    const g = c.getContext('2d');
    g.clearRect(0, 0, 256, 96);
    const styles = { price: ['#fff3d6', '#5a3214'], owned: ['#3fae55', '#ffffff'], wearing: ['#8a4cd6', '#ffffff'], prize: ['#4a3060', '#ffe2a8'] };
    const [bg, fg] = styles[state.kind];
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.roundRect(6, 10, 244, 82, 26); g.fill();
    g.fillStyle = bg;
    g.beginPath(); g.roundRect(4, 4, 244, 82, 26); g.fill();
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 50px "Nunito", system-ui, sans-serif';
    if (state.text.startsWith('🍬')) {
      const num = state.text.replace('🍬', '').trim();
      drawCandy(g, 84, 46, 1);
      g.textAlign = 'left';
      g.fillText(num, 128, 49);
    } else g.fillText(state.text, 126, 48);
    tex.needsUpdate = true;
  };
  return m;
}

// --- the room ----------------------------------------------------------------
export function buildStoreInterior() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#24142a');
  scene.fog = new THREE.Fog('#24142a', 26, 48);
  scene.add(new THREE.HemisphereLight('#ffe2b8', '#5a3a2a', 1.7));
  const key = new THREE.PointLight('#ffbf70', 45, 22, 1.4);
  key.position.set(0, 5.2, 0.5);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#ffe4c0', 1.1);
  fill.position.set(2, 7, 9);
  scene.add(fill);
  const deskLight = new THREE.PointLight('#ffb35a', 5, 6, 1.6);
  deskLight.position.set(-5.4, 3.4, -0.6);
  scene.add(deskLight);

  const box = (mat, x, y, z, sx, sy, sz, ry = 0, parent = scene) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), typeof mat === 'string' ? litMat({ color: mat }) : mat);
    o.position.set(x, y, z); o.rotation.y = ry;
    parent.add(o);
    return o;
  };
  const woodMat = litMat({ color: WOOD });
  const darkMat = litMat({ color: WOOD_DARK });
  const lightMat = litMat({ color: WOOD_LIGHT });

  // floor, walls, beams
  const ft = plankTexture('#9a6438', 16);
  ft.repeat.set(4, 5.5);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D + 16), litMat({ map: ft }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 8;
  scene.add(floor);
  const WAIN = 1.35; // height of the wooden panelling
  const paper = wallpaperTexture();
  const wain = wainscotTexture();
  const wallPiece = (len, x, z, ry) => {
    const pt = paper.clone(); pt.needsUpdate = true; pt.repeat.set(len / 1.3, (H - WAIN) / 1.3);
    const up = new THREE.Mesh(new THREE.PlaneGeometry(len, H - WAIN), litMat({ map: pt }));
    up.position.set(x, WAIN + (H - WAIN) / 2, z); up.rotation.y = ry;
    scene.add(up);
    const wt2 = wain.clone(); wt2.needsUpdate = true; wt2.repeat.set(len / 1.6, 1);
    const lo = new THREE.Mesh(new THREE.PlaneGeometry(len, WAIN), litMat({ map: wt2 }));
    lo.position.set(x, WAIN / 2, z); lo.rotation.y = ry;
    scene.add(lo);
  };
  wallPiece(W, 0, BACK, 0);
  for (const sd of [-1, 1]) wallPiece(D + 16, sd * W / 2, 8, -sd * Math.PI / 2);
  // chair rail along the top of the panelling
  box(lightMat, 0, WAIN, BACK + 0.04, W, 0.08, 0.08);
  for (const sd of [-1, 1]) box(lightMat, sd * (W / 2 - 0.04), WAIN, 8, 0.08, 0.08, D + 16);
  // plank ceiling
  const ct = plankTexture('#4a2e1a', 10);
  ct.repeat.set(5, 7);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D + 16), litMat({ map: ct }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, H, 8);
  scene.add(ceil);
  box(darkMat, 0, 0.12, BACK + 0.04, W, 0.24, 0.08); // skirting
  for (const sd of [-1, 1]) box(darkMat, sd * (W / 2 - 0.04), 0.12, 8, 0.08, 0.24, D + 16);
  for (let x = -7.5; x <= 7.5; x += 3.75) box(darkMat, x, H - 0.2, -2.5, 0.32, 0.32, D - 5);
  box(darkMat, 0, H - 0.4, BACK + 0.2, W, 0.3, 0.3);

  // --- shelf bays ------------------------------------------------------------
  const cells = [];
  const hits = [];
  const bayHits = [];
  const halos = [];
  const haloTex = haloTexture();
  const shelfMat = litMat({ map: plankTexture(WOOD_LIGHT, 3, 128, 64) });
  const velvetMat = litMat({ map: velvetTexture() });
  const fairy = []; // { bulb, glow, phase }
  const candles = [];
  const bulbCols = ['#ffd27a', '#ff9a3c', '#c08cff', '#ffd27a', '#7cffb0'];
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ffcf8a', transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending });
  BAYS.forEach((bay, bi) => {
    const g = new THREE.Group();
    g.position.set(BAY_X[bi], 0, BAY_Z);
    scene.add(g);
    // frame
    box(velvetMat, 0, 2.0, -0.38, BAY_W - 0.1, 3.9, 0.06, 0, g);
    // warm light spilling down the velvet from the top of the bay
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(BAY_W * 1.1, 2.6), poolMat);
    pool.position.set(0, 3.3, -0.33);
    g.add(pool);
    // a string of fairy lights draped along the top
    const n = 9, pts = [];
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1), x = -BAY_W / 2 + 0.12 + t * (BAY_W - 0.24);
      const y = 3.98 - Math.sin(t * Math.PI) * 0.16 - Math.sin(t * Math.PI * 2) ** 2 * 0.05;
      pts.push(new THREE.Vector3(x, y, 0.44));
      const col = bulbCols[(k + bi) % bulbCols.length];
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: col }));
      bulb.scale.y = 1.3;
      bulb.position.set(x, y - 0.05, 0.45);
      g.add(bulb);
      const gl = glowSprite(0.32, col, 0.7);
      gl.position.copy(bulb.position);
      g.add(gl);
      fairy.push({ glow: gl, phase: k * 1.7 + bi * 0.9 });
    }
    const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.CatmullRomCurve3(pts).getPoints(40)), new THREE.LineBasicMaterial({ color: '#2a1a10' }));
    g.add(wire);
    for (const sd of [-1, 1]) box(woodMat, sd * (BAY_W / 2 - 0.08), 2.05, 0, 0.16, 4.1, 0.8, 0, g);
    box(woodMat, 0, 0.25, 0.02, BAY_W - 0.2, 0.5, 0.76, 0, g); // base cabinet
    for (const sd of [-1, 1]) {
      box(lightMat, sd * 0.66, 0.25, 0.41, 1.2, 0.36, 0.03, 0, g);
      box(litMat({ color: '#c9a640' }), sd * 0.66, 0.27, 0.44, 0.18, 0.05, 0.04, 0, g);
    }
    box(darkMat, 0, 4.12, 0.05, BAY_W + 0.1, 0.16, 0.9, 0, g); // top cap
    // header sign
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.56), new THREE.MeshBasicMaterial({ map: boardTexture(bay.label.toUpperCase(), bay.icon) }));
    sign.position.set(0, 4.55, 0.1);
    g.add(sign);
    box(darkMat, 0, 4.55, 0.06, 2.42, 0.66, 0.06, 0, g);
    // a pumpkin and a couple of candles perched on top of the bay
    const pk = pumpkin(0.21, bi === 2 ? '#e8e2cf' : '#ef7d1f');
    pk.position.set(bi % 2 ? -1.12 : 1.12, 4.2, 0.12);
    g.add(pk);
    for (const [dx, hgt] of [[0.3, 0.26], [0.42, 0.17]]) {
      const cd = candle(hgt);
      cd.position.set((bi % 2 ? -1.12 : 1.12) + (bi % 2 ? dx : -dx), 4.2, 0.2);
      g.add(cd);
      candles.push(cd);
    }

    const bh = new THREE.Mesh(new THREE.BoxGeometry(BAY_W, 4.9, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
    bh.position.set(0, 2.45, 0.1);
    bh.userData.bay = bi;
    g.add(bh);
    bayHits.push(bh);
    const items = ITEMS.filter((i) => i.slot === bay.slot);
    const spots = [];
    if (bay.slot === 'outfit') {
      // two hanging rails, four outfits each
      for (const [r, ry] of [[0, 3.72], [1, 2.42]]) {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, BAY_W - 0.3, 8), litMat({ color: '#c9a640', metalness: 0.4, roughness: 0.4 }));
        rail.rotation.z = Math.PI / 2;
        rail.position.set(0, ry, 0.0);
        g.add(rail);
        for (let k = 0; k < 4; k++) spots.push({ x: -0.96 + k * 0.64, y: ry + 0.04, w: 0.6, h: 1.12, hang: true, row: r });
      }
      box(shelfMat, 0, 1.08, 0.02, BAY_W - 0.3, 0.07, 0.7, 0, g);
    } else {
      for (const y of SHELF_Y) {
        box(shelfMat, 0, y, 0.02, BAY_W - 0.3, 0.07, 0.7, 0, g);
        box(darkMat, 0, y - 0.02, 0.37, BAY_W - 0.3, 0.1, 0.03, 0, g); // shelf lip
      }
      for (let r = 2; r >= 0; r--) for (let k = 0; k < 3; k++) spots.push({ x: -0.84 + k * 0.84, y: SHELF_Y[r] + 0.04, w: 0.74, h: 0.8, row: 2 - r });
    }
    items.forEach((it, i) => {
      const s = spots[i];
      if (!s) return;
      const piece = fitInto(displayPiece(it), s.w, s.h * (it.slot === 'prop' ? 0.85 : 1), 0.55, s.hang);
      piece.position.set(s.x, s.y, 0.02);
      g.add(piece);
      // glow behind for "wearing" / "trying on"
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.set(s.w * 1.25, s.h * 1.15, 1);
      halo.position.set(s.x, s.hang ? s.y - s.h * 0.5 : s.y + s.h * 0.45, -0.3);
      halo.visible = false;
      g.add(halo);
      halos.push(halo);
      // price tag
      const tag = makeTag();
      if (s.hang) tag.position.set(s.x, s.y - s.h - 0.08, 0.32);
      else { tag.position.set(s.x, s.y - 0.08, 0.4); }
      tag.scale.setScalar(s.hang ? 0.95 : 1);
      g.add(tag);
      // generous invisible tap target
      const hit = new THREE.Mesh(new THREE.BoxGeometry(s.w + 0.08, s.h + 0.2, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(s.x, s.hang ? s.y - s.h / 2 - 0.05 : s.y + s.h / 2 - 0.05, 0.05);
      hit.userData.itemId = it.id;
      g.add(hit);
      hits.push(hit);
      cells.push({ id: it.id, bay: bi, piece, halo, tag, baseY: piece.position.y, state: null });
    });
    // fill any spare spot with a little decoration
    for (let i = items.length; i < spots.length; i++) {
      const s = spots[i];
      const cd = candle(0.24);
      cd.position.set(s.x - 0.16, s.y, 0.05);
      g.add(cd);
      candles.push(cd);
      const pk2 = pumpkin(0.16);
      pk2.position.set(s.x + 0.14, s.y, 0);
      g.add(pk2);
    }
  });

  // --- front desk + Hazel ------------------------------------------------------
  const desk = new THREE.Group();
  desk.position.set(-7.0, 0, -2.4);
  desk.rotation.y = 0.85;
  scene.add(desk);
  const deskTex = plankTexture('#6b4426', 6, 256, 128, true);
  box(litMat({ map: deskTex }), 0, 0.55, 0, 2.9, 1.1, 1.0, 0, desk);
  box(darkMat, 0, 0.06, 0.02, 3.0, 0.12, 1.05, 0, desk);
  box(lightMat, 0, 1.14, 0.02, 3.2, 0.09, 1.2, 0, desk);
  // purple runner hanging over the front, with a pumpkin on it
  box(litMat({ color: PURPLE }), 0.3, 1.19, 0.02, 0.95, 0.02, 1.22, 0, desk);
  const runner = box(litMat({ color: PURPLE }), 0.3, 0.75, 0.62, 0.95, 0.85, 0.02, 0, desk);
  const emb = new THREE.Mesh(new THREE.CircleGeometry(0.25, 20), litMat({ color: '#ef7d1f' }));
  emb.scale.y = 0.8;
  emb.position.set(0.3, 0.72, 0.64);
  desk.add(emb);
  for (const x of [-0.08, 0.08]) {
    const eyeT = new THREE.Mesh(new THREE.CircleGeometry(0.05, 3), new THREE.MeshBasicMaterial({ color: PURPLE }));
    eyeT.position.set(0.3 + x, 0.76, 0.65);
    eyeT.rotation.z = Math.PI / 2 * 0;
    desk.add(eyeT);
  }
  box(litMat({ color: '#ffd27a' }), 0.3, 0.33, 0.635, 0.95, 0.04, 0.02, 0, desk);
  void runner;
  // cash register
  const reg = new THREE.Group();
  reg.position.set(-0.85, 1.19, 0.05);
  reg.rotation.y = 0.15;
  desk.add(reg);
  const regMat = litMat({ color: '#3c3a44', metalness: 0.3, roughness: 0.5 });
  box(regMat, 0, 0.14, 0, 0.62, 0.28, 0.5, 0, reg);
  const keys = box(regMat, 0, 0.32, 0.08, 0.58, 0.08, 0.34, 0, reg);
  keys.rotation.x = 0.35;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) box(litMat({ color: j === 3 ? '#e85a4a' : '#f2ead8' }), -0.18 + j * 0.12, 0.37 + i * 0.03, 0.18 - i * 0.085, 0.08, 0.03, 0.06, 0, reg);
  box(regMat, 0, 0.5, -0.17, 0.4, 0.22, 0.12, 0, reg);
  box(new THREE.MeshBasicMaterial({ color: '#7cff9b' }), 0, 0.52, -0.105, 0.3, 0.11, 0.01, 0, reg);
  box(litMat({ color: '#c9a640', metalness: 0.4, roughness: 0.4 }), 0, 0.05, 0.26, 0.5, 0.06, 0.04, 0, reg);
  // lantern
  const lant = new THREE.Group();
  lant.position.set(-1.38, 1.19, 0.2);
  desk.add(lant);
  box(darkMat, 0, 0.03, 0, 0.3, 0.06, 0.3, 0, lant);
  box(new THREE.MeshBasicMaterial({ color: '#ffcf6a' }), 0, 0.24, 0, 0.22, 0.34, 0.22, 0, lant);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(darkMat, x * 0.12, 0.24, z * 0.12, 0.03, 0.4, 0.03, 0, lant);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.16, 4), darkMat);
  cap.position.y = 0.5; cap.rotation.y = Math.PI / 4;
  lant.add(cap);
  // jack-o'-lantern + candy jar
  const jol = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), litMat({ color: '#ef7d1f' }));
  jol.scale.y = 0.8; jol.position.set(1.22, 1.38, 0.2);
  desk.add(jol);
  for (const x of [-0.08, 0.08]) {
    const e = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.06, 3), new THREE.MeshBasicMaterial({ color: '#ffe08a' }));
    e.position.set(1.22 + x, 1.42, 0.43); e.rotation.x = Math.PI / 2;
    desk.add(e);
  }
  box(new THREE.MeshBasicMaterial({ color: '#ffe08a' }), 1.22, 1.31, 0.43, 0.18, 0.04, 0.02, 0, desk);
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.32, 16), litMat({ color: '#cfe8ff', transparent: true, opacity: 0.35, depthWrite: false }));
  jar.position.set(0.72, 1.35, 0.3);
  desk.add(jar);
  ['#ff4d6d', '#ffd23f', '#7a4cff', '#2eaa4a', '#ff8a1f', '#ffffff'].forEach((c, i) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), litMat({ color: c }));
    s.position.set(0.72 + Math.sin(i * 2.1) * 0.07, 1.24 + (i % 3) * 0.06, 0.3 + Math.cos(i * 2.1) * 0.07);
    desk.add(s);
  });
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16), litMat({ color: '#e85a4a' }));
  lid.position.set(0.72, 1.53, 0.3);
  desk.add(lid);

  const hazel = makeHazel();
  hazel.position.set(0.0, 0.42, -0.8);
  desk.add(hazel);

  // shop sign on the wall behind the desk
  const shopSign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.05), new THREE.MeshBasicMaterial({ map: boardTexture(['Hares Hill', 'Halloween Emporium'], null, { w: 640, h: 200, font: 'bold 64px Georgia, serif' }) }));
  shopSign.position.set(-7.55, 4.05, -2.7);
  shopSign.rotation.y = 0.75;
  scene.add(shopSign);
  box(darkMat, -7.58, 4.05, -2.73, 3.55, 1.18, 0.05, 0.75);
  const signPk = pumpkin(0.24);
  signPk.position.set(-7.0, 4.58, -2.15);
  scene.add(signPk);

  // --- decorations -------------------------------------------------------------
  // pumpkin rug in the middle of the floor
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.25), litMat({ map: rugTexture() }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.015, -1.3);
  scene.add(rug);
  // little welcome rug by the door
  const mat2 = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.4), litMat({ color: '#5b2f80' }));
  mat2.rotation.x = -Math.PI / 2;
  mat2.position.set(0.2, 0.012, 2.6);
  scene.add(mat2);

  // wagon-wheel chandelier with lanterns
  const lamps = [];
  const chand = new THREE.Group();
  chand.position.set(0, H - 1.05, -1.3);
  scene.add(chand);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.06, 6, 24), darkMat);
  wheel.rotation.x = Math.PI / 2;
  chand.add(wheel);
  box(darkMat, 0, 0.7, 0, 0.04, 1.4, 0.04, 0, chand);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    box(darkMat, Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5, 1.0, 0.04, 0.04, -a, chand);
    const l = box(new THREE.MeshBasicMaterial({ color: '#ffcf6a' }), Math.cos(a), 0.18, Math.sin(a), 0.16, 0.26, 0.16, 0, chand);
    lamps.push(l);
    const gl = glowSprite(0.9, '#ffb860', 0.55);
    gl.position.set(Math.cos(a), 0.18, Math.sin(a));
    chand.add(gl);
  }
  // hanging lanterns along the front
  for (const x of [-7.9, 7.9]) {
    const lz = -3.4;
    box(new THREE.MeshBasicMaterial({ color: '#222' }), x, H - 0.75, lz, 0.02, 1.1, 0.02);
    const l = box(new THREE.MeshBasicMaterial({ color: '#ffcf6a' }), x, H - 1.45, lz, 0.24, 0.32, 0.24);
    lamps.push(l);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.15, 4), darkMat);
    c2.position.set(x, H - 1.22, lz); c2.rotation.y = Math.PI / 4;
    scene.add(c2);
    const gl = glowSprite(1.1, '#ffb860', 0.6);
    gl.position.set(x, H - 1.45, lz);
    scene.add(gl);
  }
  // soft pool of light on the floor under the chandelier
  const floorPool = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ff9a40', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
  floorPool.rotation.x = -Math.PI / 2;
  floorPool.position.set(0, 0.03, -1.3);
  scene.add(floorPool);
  // dust motes drifting in the lamplight
  const MOTES = q(70, 30);
  const moteGeo = new THREE.BufferGeometry();
  const mp = new Float32Array(MOTES * 3), mSeed = [];
  for (let i = 0; i < MOTES; i++) { mSeed.push([Math.random() * 14 - 7, Math.random() * 4.5 + 0.4, Math.random() * 7 - 5.5, Math.random() * 6.28]); }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: glowTexture(), color: '#ffd9a0', size: 0.07, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  motes.frustumCulled = false;
  scene.add(motes);
  // friendly little ghosts hanging from the beams
  const ghosts = [];
  const ghostMat = litMat({ color: '#f6f3fb' });
  const gEye = new THREE.MeshBasicMaterial({ color: '#2a2030' });
  for (const [x, z] of [[-5.6, 0.8], [6.2, 0.2]]) {
    const gh = new THREE.Group();
    gh.position.set(x, H - 1.3, z);
    scene.add(gh);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.65), ghostMat);
    body.scale.y = 1.3;
    gh.add(body);
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.33, 0.35, 14, 1, true), ghostMat);
    skirt.position.y = -0.2; skirt.rotation.x = Math.PI;
    gh.add(skirt);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), gEye); e.position.set(s * 0.1, 0.05, 0.26); e.scale.y = 1.4; gh.add(e); }
    box(new THREE.MeshBasicMaterial({ color: '#222' }), x, H - 0.7, z, 0.015, 1.0, 0.015);
    ghosts.push(gh);
  }
  // pennant banners above the bays
  const flagMat = [litMat({ color: PURPLE, side: THREE.DoubleSide }), litMat({ color: '#ef7d1f', side: THREE.DoubleSide })];
  const flagGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.22, 0, 0), new THREE.Vector3(0.22, 0, 0), new THREE.Vector3(0, -0.5, 0)]);
  flagGeo.computeVertexNormals();
  for (let i = 0; i < 22; i++) {
    const x = -7.6 + i * 0.72;
    const sag = Math.sin(((i % 11) / 10) * Math.PI) * 0.18;
    const f = new THREE.Mesh(flagGeo, flagMat[i % 2]);
    f.position.set(x, H - 0.62 - sag, BACK + 0.12);
    scene.add(f);
  }
  // window on the right wall
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.9), new THREE.MeshBasicMaterial({ map: windowTexture() }));
  win.position.set(W / 2 - 0.03, 3.1, -2.2);
  win.rotation.y = -Math.PI / 2;
  scene.add(win);
  box(darkMat, W / 2 - 0.05, 3.1, -2.2, 0.08, 2.1, 1.7);
  box(darkMat, W / 2 - 0.1, 3.1, -2.2, 0.06, 1.95, 0.07);
  box(darkMat, W / 2 - 0.1, 3.1, -2.2, 0.06, 0.07, 1.55);
  win.position.x = W / 2 - 0.12;
  // bench + barrel + lantern on the right
  box(woodMat, 6.6, 0.55, -1.0, 1.0, 0.12, 2.2, 0);
  for (const z of [-1.9, -0.1]) box(darkMat, 6.6, 0.25, z, 0.9, 0.5, 0.12);
  box(litMat({ color: PURPLE }), 6.6, 0.62, -1.0, 1.02, 0.03, 0.8);
  const bl = box(new THREE.MeshBasicMaterial({ color: '#ffcf6a' }), 6.55, 0.82, -1.5, 0.22, 0.3, 0.22);
  lamps.push(bl);
  box(darkMat, 6.55, 0.98, -1.5, 0.28, 0.04, 0.28);
  for (let i = 0; i < 2; i++) {
    const b = box(litMat({ color: ['#e85a4a', '#4a8ad6'][i] }), 6.65, 0.69 + i * 0.1, -0.7, 0.5, 0.1, 0.35);
    b.rotation.y = i * 0.3;
  }
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.95, 16), woodMat);
  barrel.position.set(7.2, 0.48, 0.9);
  scene.add(barrel);
  for (const y of [0.18, 0.78]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 6, 20), litMat({ color: '#3a3a3a' }));
    hoop.rotation.x = Math.PI / 2; hoop.position.set(7.2, y, 0.9);
    scene.add(hoop);
  }
  const bpk = pumpkin(0.3);
  bpk.position.set(7.2, 0.96, 0.9);
  scene.add(bpk);
  const bpk2 = pumpkin(0.18, '#e8e2cf');
  bpk2.position.set(6.95, 0.96, 1.15);
  scene.add(bpk2);
  // potted plants
  const leaf = litMat({ color: '#4f8a3a' });
  const pot = litMat({ color: '#b5653a' });
  for (const [x, z, s] of [[-7.4, -5.3, 1.1], [7.4, -5.3, 1.1], [-7.4, 1.2, 0.9], [3.0, 4.40, 0]]) {
    if (!s) continue;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * s, 0.22 * s, 0.45 * s, 12), pot);
    p.position.set(x, 0.22 * s, z);
    scene.add(p);
    for (let i = 0; i < 6; i++) {
      const lf = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 8, 6), leaf);
      const a = i * 1.1;
      lf.position.set(x + Math.cos(a) * 0.16 * s, (0.55 + (i % 3) * 0.14) * s, z + Math.sin(a) * 0.16 * s);
      lf.scale.set(1, 0.7, 1);
      scene.add(lf);
    }
  }
  // cobweb in the corner (just for fun)
  const web = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#d8d0e8', transparent: true, opacity: 0.5 }));
  const wp = [];
  for (let i = 0; i < 6; i++) { const a = (i / 5) * Math.PI / 2; wp.push(0, 0, 0, Math.cos(a) * 1.4, -Math.sin(a) * 1.4, 0); }
  for (let r = 0.4; r < 1.4; r += 0.33) for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI / 2, b = ((i + 1) / 5) * Math.PI / 2;
    wp.push(Math.cos(a) * r, -Math.sin(a) * r, 0, Math.cos(b) * r, -Math.sin(b) * r, 0);
  }
  web.geometry.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  web.position.set(W / 2 - 0.05, H, BACK + 0.05);
  web.rotation.y = Math.PI;
  scene.add(web);

  // where the boys stand, and what the camera frames
  // the shopper stands out in front of the bay, facing the chest-high camera
  const bayFront = (i) => new THREE.Vector3(BAY_X[i], 0, BAY_Z + 4.0);
  const bayPoints = (i) => [
    new THREE.Vector3(BAY_X[i] - BAY_W / 2, 0.3, BAY_Z + 0.4), new THREE.Vector3(BAY_X[i] + BAY_W / 2, 0.3, BAY_Z + 0.4),
    new THREE.Vector3(BAY_X[i] - BAY_W / 2, 5.0, BAY_Z), new THREE.Vector3(BAY_X[i] + BAY_W / 2, 5.0, BAY_Z),
  ];
  const wallPoints = [
    new THREE.Vector3(-6.6, 0.3, -0.9), new THREE.Vector3(-7.8, 2.8, -2.8),
    new THREE.Vector3(BAY_X[3] + BAY_W / 2 + 0.2, 4.85, BAY_Z), new THREE.Vector3(BAY_X[3] + BAY_W / 2 + 0.2, 0.3, BAY_Z + 0.5),
    new THREE.Vector3(-6.2, 4.85, BAY_Z),
  ];

  let haloT = 0;
  return {
    scene,
    hazel,
    hits,
    bayHits,
    cells,
    BAYS,
    bayFront,
    bayPoints,
    wallPoints,
    stand: new THREE.Vector3(-0.7, 0, 1.2),
    standOther: new THREE.Vector3(1.0, 0, 0.8),
    // upright phone: the boys stand closer to the camera in the whole-shop view
    standNear: new THREE.Vector3(-0.8, 0, 9.4),
    standOtherNear: new THREE.Vector3(0.9, 0, 8.9),
    update(time, dt) {
      hazel.userData.update(time, dt);
      haloT += dt;
      lamps.forEach((l, i) => l.material.color.setHSL(0.11, 1, 0.68 + Math.sin(time * 6 + i * 1.7) * 0.04));
      for (const f of fairy) f.glow.material.opacity = f.glow.userData.baseOpacity * (0.65 + 0.35 * Math.sin(time * 1.6 + f.phase) ** 2);
      candles.forEach((cd, i) => {
        const fl = 0.85 + Math.sin(time * 13 + i * 3.1) * 0.08 + Math.sin(time * 7.3 + i) * 0.07;
        cd.userData.flame.scale.set(1, 1.8 * fl, 1);
        cd.userData.glow.material.opacity = cd.userData.glow.userData.baseOpacity * fl;
      });
      for (let i = 0; i < MOTES; i++) {
        const [x, y, z, ph] = mSeed[i];
        mp[i * 3] = x + Math.sin(time * 0.21 + ph) * 0.6;
        mp[i * 3 + 1] = 0.4 + ((y + time * 0.06 + Math.sin(time * 0.4 + ph) * 0.15) % 4.5);
        mp[i * 3 + 2] = z + Math.cos(time * 0.17 + ph) * 0.5;
      }
      moteGeo.attributes.position.needsUpdate = true;
      ghosts.forEach((gh, i) => { gh.position.y = H - 1.3 + Math.sin(time * 1.3 + i * 2) * 0.08; gh.rotation.y = Math.sin(time * 0.7 + i) * 0.4; });
      for (const c of cells) {
        const on = c.state === 'wearing' || c.state === 'trying';
        c.halo.visible = on;
        if (on) c.halo.material.opacity = c.state === 'trying' ? 0.75 + Math.sin(haloT * 6) * 0.25 : 0.7;
        if (c.state === 'trying') {
          c.piece.position.y = c.baseY + Math.abs(Math.sin(haloT * 4)) * 0.06;
          c.piece.rotation.y = Math.sin(haloT * 2) * 0.35;
        } else { c.piece.position.y = c.baseY; c.piece.rotation.y = 0; }
      }
    },
  };
}
