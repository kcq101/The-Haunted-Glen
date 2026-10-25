import * as THREE from 'three';
import { litMat } from './quality.js';

// ---------------------------------------------------------------------------
// Costume catalog for the Hares Hill Halloween Emporium.
// 4 slots: hat, face, outfit, prop. Every piece is built from simple shapes so
// it works on any character; `d` carries the wearer's body measurements.
// cost: candy needed (0 = free starter). reward: unlocked in the haunted house.
// ---------------------------------------------------------------------------

export const SLOTS = [
  { id: 'hat', label: 'Hats', icon: '🎩' },
  { id: 'face', label: 'Faces', icon: '🎭' },
  { id: 'outfit', label: 'Outfits', icon: '👕' },
  { id: 'prop', label: 'Props', icon: '🪄' },
];

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    const m = opts.basic ? new THREE.MeshBasicMaterial({ color, ...opts.params })
      : litMat({ color, ...(opts.params || {}) });
    matCache.set(key, m);
  }
  return matCache.get(key);
}

function mesh(geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, typeof material === 'string' ? mat(material) : material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}
const G = {
  sphere: new THREE.SphereGeometry(1, 16, 12),
  hemi: new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  cone: new THREE.ConeGeometry(1, 1, 16),
  box: new THREE.BoxGeometry(1, 1, 1),
  torus: new THREE.TorusGeometry(1, 0.2, 8, 20),
};

// --- canvas textures for outfits -------------------------------------------
const texCache = new Map();
function canvasTex(key, painter, w = 128, h = 128) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  painter(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.offset.x = 0.5; // put the front of the drawing on the front of the body
  texCache.set(key, t);
  return t;
}
const TEX = {
  stripes: () => canvasTex('stripes', (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4efe4' : '#c4322c'; g.fillRect(0, (i * h) / 8, w, h / 8); }
    g.fillStyle = '#2a1d16'; g.fillRect(w * 0.36, 0, w * 0.28, h); // vest front
    g.fillStyle = '#f4efe4'; g.fillRect(w * 0.45, 0, w * 0.1, h);
  }),
  fire: () => canvasTex('fire', (g, w, h) => {
    g.fillStyle = '#c9a94e'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8ff3c'; g.fillRect(0, h * 0.62, w, h * 0.1);
    g.fillStyle = '#d0d4d8'; g.fillRect(0, h * 0.65, w, h * 0.04);
    g.fillStyle = '#1c1c1c'; for (let i = 0; i < 4; i++) g.fillRect(w * 0.49, h * (0.1 + i * 0.13), w * 0.04, h * 0.06);
  }),
  firePants: () => canvasTex('firePants', (g, w, h) => {
    g.fillStyle = '#c9a94e'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8ff3c'; g.fillRect(0, h * 0.7, w, h * 0.1);
  }),
  bandage: () => canvasTex('bandage', (g, w, h) => {
    g.fillStyle = '#ece4cf'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) {
      g.strokeStyle = i % 2 ? '#cfc4a8' : '#f7f1e0'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(0, i * 8 + Math.random() * 4); g.lineTo(w, i * 8 + 6 + Math.random() * 6); g.stroke();
    }
  }),
  bones: () => canvasTex('bones', (g, w, h) => {
    g.fillStyle = '#1b1b1f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2f0e6';
    g.fillRect(w * 0.47, h * 0.05, w * 0.06, h * 0.9);
    for (let i = 0; i < 4; i++) {
      g.beginPath(); g.ellipse(w * 0.5, h * (0.18 + i * 0.16), w * 0.18, h * 0.035, 0, 0, 7); g.fill();
    }
  }),
  boneLegs: () => canvasTex('boneLegs', (g, w, h) => {
    g.fillStyle = '#1b1b1f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2f0e6'; g.fillRect(w * 0.44, 0, w * 0.12, h);
    g.beginPath(); g.arc(w * 0.5, h * 0.5, w * 0.1, 0, 7); g.fill();
  }),
  hero: () => canvasTex('hero', (g, w, h) => {
    g.fillStyle = '#2f6fd6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd23f'; g.fillRect(0, h * 0.86, w, h * 0.1);
    g.fillStyle = '#e63b3b';
    g.beginPath();
    const cx = w * 0.5, cy = h * 0.35, R = w * 0.12;
    for (let i = 0; i < 10; i++) { const r = i % 2 ? R * 0.45 : R; const a = -Math.PI / 2 + (i * Math.PI) / 5; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    g.fill();
  }),
  vampire: () => canvasTex('vampire', (g, w, h) => {
    g.fillStyle = '#18161c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2efe6'; g.beginPath(); g.moveTo(w * 0.38, 0); g.lineTo(w * 0.62, 0); g.lineTo(w * 0.5, h * 0.55); g.fill();
    g.fillStyle = '#9b1c2a'; g.fillRect(w * 0.44, h * 0.05, w * 0.12, h * 0.08);
  }),
  astro: () => canvasTex('astro', (g, w, h) => {
    g.fillStyle = '#f1f2f4'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8732c'; g.fillRect(w * 0.6, h * 0.25, w * 0.1, h * 0.12);
    g.fillStyle = '#3a6fd8'; g.fillRect(w * 0.32, h * 0.25, w * 0.12, h * 0.12);
    g.fillStyle = '#9aa1ab'; g.fillRect(0, h * 0.82, w, h * 0.06);
  }),
};

// glow material for pumpkin faces, lanterns, etc.
const glowMat = new THREE.MeshBasicMaterial({ color: '#ffb340' });
const glassMat = litMat({ color: '#cfe8ff', transparent: true, opacity: 0.28, depthWrite: false });

// --- catalog ----------------------------------------------------------------
// build(d) returns [{ anchor, obj }]. Anchors: head (head center), hand (right
// hand), shoulder (left shoulder), back (upper back), waist.
export const ITEMS = [
  // HATS
  {
    id: 'pirate_hat', slot: 'hat', name: 'Pirate Hat', emoji: '🏴‍☠️', theme: 'pirate', cost: 0, c2d: '#1d1d22',
    build: (d) => {
      const r = d.headR, g = new THREE.Group();
      g.add(mesh(G.cyl, '#1d1d22', 0, r * 0.75, 0, 0, 0, 0, r * 1.25, r * 0.12, r * 1.15));
      g.add(mesh(G.hemi, '#1d1d22', 0, r * 0.78, 0, 0, 0, 0, r * 0.85, r * 0.75, r * 0.85));
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        g.add(mesh(G.box, '#1d1d22', Math.sin(a) * r * 0.9, r * 1.0, Math.cos(a) * r * 0.9, 0.5, a, 0, r * 1.4, r * 0.4, r * 0.08));
        g.add(mesh(G.box, '#d8b440', Math.sin(a) * r * 0.95, r * 1.2, Math.cos(a) * r * 0.95, 0.5, a, 0, r * 1.4, r * 0.05, r * 0.09));
      }
      g.add(mesh(G.sphere, '#f4f1e6', 0, r * 1.15, r * 0.98, 0, 0, 0, r * 0.18, r * 0.16, r * 0.05));
      return [{ anchor: 'head', obj: g }];
    },
  },
  {
    id: 'fire_helmet', slot: 'hat', name: 'Fire Helmet', emoji: '🧑‍🚒', theme: 'firefighter', cost: 6, c2d: '#d23a2a',
    build: (d) => {
      const r = d.headR, g = new THREE.Group();
      g.add(mesh(G.hemi, '#d23a2a', 0, r * 0.35, 0, 0, 0, 0, r * 1.12, r * 1.05, r * 1.12));
      g.add(mesh(G.cyl, '#c23224', 0, r * 0.38, -r * 0.25, 0.12, 0, 0, r * 1.35, r * 0.07, r * 1.55));
      g.add(mesh(G.box, '#d23a2a', 0, r * 1.25, 0, 0, 0, 0, r * 0.18, r * 0.25, r * 1.6));
      g.add(mesh(G.box, '#e8c64a', 0, r * 0.95, r * 1.02, -0.3, 0, 0, r * 0.6, r * 0.6, r * 0.06));
      return [{ anchor: 'head', obj: g }];
    },
  },
  {
    id: 'franken_top', slot: 'hat', name: 'Monster Flat-Top', emoji: '🧟', theme: 'monster', cost: 7, c2d: '#1e2a1e',
    build: (d) => {
      const r = d.headR, g = new THREE.Group();
      g.add(mesh(G.box, '#1e2420', 0, r * 0.75, -r * 0.05, 0, 0, 0, r * 1.95, r * 0.7, r * 1.9));
      g.add(mesh(G.box, '#1e2420', 0, r * 0.5, r * 0.8, 0, 0, 0, r * 1.9, r * 0.3, r * 0.35));
      for (const s of [-1, 1]) {
        g.add(mesh(G.cyl, '#8c9096', s * r * 1.05, -r * 0.55, 0, 0, 0, Math.PI / 2, r * 0.12, r * 0.45, r * 0.12));
        g.add(mesh(G.cyl, '#6c7076', s * r * 1.28, -r * 0.55, 0, 0, 0, Math.PI / 2, r * 0.2, r * 0.1, r * 0.2));
      }
      g.add(mesh(G.box, '#3d2a2a', -r * 0.3, r * 0.42, r * 0.92, 0, 0, 0.3, r * 0.5, r * 0.06, r * 0.05));
      return [{ anchor: 'head', obj: g }];
    },
  },
  {
    id: 'wolf_ears', slot: 'hat', name: 'Werewolf Ears', emoji: '🐺', theme: 'monster', cost: 5, c2d: '#6b4a32',
    build: (d) => {
      const r = d.headR, g = new THREE.Group();
      g.add(mesh(G.hemi, '#6b4a32', 0, r * 0.15, -r * 0.08, 0, 0, 0, r * 1.08, r * 1.0, r * 1.08));
      for (const s of [-1, 1]) {
        g.add(mesh(new THREE.ConeGeometry(1, 1, 4), '#6b4a32', s * r * 0.62, r * 1.18, 0, 0, Math.PI / 4, s * -0.35, r * 0.38, r * 0.75, r * 0.2));
        g.add(mesh(new THREE.ConeGeometry(1, 1, 4), '#e2a6a0', s * r * 0.6, r * 1.12, r * 0.08, 0, Math.PI / 4, s * -0.35, r * 0.2, r * 0.45, r * 0.08));
      }
      return [{ anchor: 'head', obj: g }];
    },
  },
  {
    id: 'vamp_hair', slot: 'hat', name: 'Vampire Hair', emoji: '🧛', theme: 'monster', cost: 5, c2d: '#0e0e12',
    build: (d) => {
      const r = d.headR, g = new THREE.Group();
      g.add(mesh(G.hemi, '#0e0e12', 0, r * 0.1, -r * 0.06, -0.15, 0, 0, r * 1.09, r * 1.02, r * 1.08));
      g.add(mesh(new THREE.ConeGeometry(1, 1, 3), '#0e0e12', 0, r * 0.55, r * 0.92, Math.PI, 0, 0, r * 0.28, r * 0.5, r * 0.1));
      return [{ anchor: 'head', obj: g }];
    },
  },
  {
    id: 'space_helmet', slot: 'hat', name: 'Space Helmet', emoji: '👨‍🚀', theme: 'space', cost: 10, c2d: '#cfe8ff',
    build: (d) => {
      const r = d.headR, g = new THREE.Group();
      const glass = new THREE.Mesh(G.sphere, glassMat);
      glass.scale.setScalar(r * 1.45);
      glass.position.y = r * 0.08;
      g.add(glass);
      g.add(mesh(G.torus, '#e9ebef', 0, -r * 0.95, 0, Math.PI / 2, 0, 0, r * 1.05, r * 1.05, r * 1.6));
      g.add(mesh(G.box, '#e8732c', r * 0.9, r * 0.9, 0, 0, 0, -0.6, r * 0.1, r * 0.6, r * 0.1));
      return [{ anchor: 'head', obj: g }];
    },
  },
  {
    id: 'robot_antenna', slot: 'hat', name: 'Robot Antenna', emoji: '🤖', theme: 'space', cost: 4, c2d: '#9aa1ab',
    build: (d) => {
      const r = d.headR, g = new THREE.Group();
      g.add(mesh(G.cyl, '#9aa1ab', 0, r * 1.0, 0, 0, 0, 0, r * 0.35, r * 0.18, r * 0.35));
      g.add(mesh(G.cyl, '#c9ced6', 0, r * 1.45, 0, 0, 0, 0, r * 0.05, r * 0.8, r * 0.05));
      const ball = new THREE.Mesh(G.sphere, mat('#ff4d6d', { basic: true }));
      ball.scale.setScalar(r * 0.16);
      ball.position.y = r * 1.9;
      ball.userData.blink = true;
      g.add(ball);
      return [{ anchor: 'head', obj: g }];
    },
  },
  {
    id: 'pumpkin_head', slot: 'hat', name: 'Pumpkin Head', emoji: '🎃', theme: 'haunted', reward: true, c2d: '#ef7d1f',
    build: (d) => {
      const r = d.headR, g = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.add(mesh(G.sphere, '#ef7d1f', Math.sin(a) * r * 0.35, r * 0.1, Math.cos(a) * r * 0.35, 0, a, 0, r * 0.95, r * 1.18, r * 1.25));
      }
      g.add(mesh(G.cyl, '#4d6b2a', 0, r * 1.35, 0, 0.2, 0, 0.2, r * 0.15, r * 0.4, r * 0.15));
      const face = (geo, x, y, sx, sy, rz = 0) => {
        const m = new THREE.Mesh(geo, glowMat);
        m.position.set(x, y, r * 1.52);
        m.scale.set(sx, sy, r * 0.05);
        m.rotation.z = rz;
        g.add(m);
      };
      const tri = new THREE.ConeGeometry(1, 1, 3);
      face(tri, -r * 0.42, r * 0.38, r * 0.2, r * 0.25);
      face(tri, r * 0.42, r * 0.38, r * 0.2, r * 0.25);
      face(G.box, 0, -r * 0.3, r * 0.95, r * 0.18);
      face(G.box, -r * 0.2, -r * 0.18, r * 0.14, r * 0.12);
      face(G.box, r * 0.25, -r * 0.42, r * 0.14, r * 0.12);
      return [{ anchor: 'head', obj: g, hideHead: true }];
    },
  },

  // FACES
  {
    id: 'eyepatch', slot: 'face', name: 'Eye Patch', emoji: '🏴‍☠️', theme: 'pirate', cost: 2, c2d: '#111',
    build: (d) => {
      const r = d.headR, g = new THREE.Group();
      g.add(mesh(G.sphere, '#111114', -r * 0.36, r * 0.06, r * 0.93, 0, -0.35, 0, r * 0.26, r * 0.24, r * 0.08));
      g.add(mesh(G.torus, '#111114', 0, r * 0.1, 0, Math.PI / 2 - 0.25, 0, 0, r * 1.02, r * 1.02, r * 0.2));
      return [{ anchor: 'head', obj: g }];
    },
  },
  {
    id: 'pirate_beard', slot: 'face', name: 'Pirate Beard', emoji: '🧔', theme: 'pirate', cost: 4, c2d: '#3a2416',
    build: (d) => {
      const r = d.headR, g = new THREE.Group();
      g.add(mesh(G.sphere, '#3a2416', 0, -r * 0.55, r * 0.62, 0.3, 0, 0, r * 0.7, r * 0.55, r * 0.45));
      for (let i = 0; i < 3; i++) g.add(mesh(G.cone, '#3a2416', (i - 1) * r * 0.28, -r * 1.0, r * 0.7, Math.PI, 0, 0, r * 0.14, r * 0.35, r * 0.14));
      g.add(mesh(G.box, '#d8b440', 0, -r * 1.12, r * 0.72, 0, 0, 0, r * 0.12, r * 0.1, r * 0.1));
      return [{ anchor: 'head', obj: g }];
    },
  },
  {
    id: 'fangs', slot: 'face', name: 'Vampire Fangs', emoji: '🦷', theme: 'monster', cost: 3, c2d: '#fff',
    build: (d) => {
      const r = d.headR, g = new THREE.Group();
      for (const s of [-1, 1]) g.add(mesh(G.cone, '#ffffff', s * r * 0.13, -r * 0.42, r * 0.93, Math.PI, 0, 0, r * 0.06, r * 0.2, r * 0.06));
      for (const s of [-1, 1]) g.add(mesh(G.sphere, '#7a2a6a', s * r * 0.38, r * -0.02, r * 0.86, 0, 0, 0, r * 0.2, r * 0.07, r * 0.05));
      return [{ anchor: 'head', obj: g }];
    },
  },
  {
    id: 'mummy_wrap', slot: 'face', name: 'Mummy Wraps', emoji: '🩹', theme: 'monster', cost: 4, c2d: '#ece4cf',
    build: (d) => {
      const r = d.headR, g = new THREE.Group();
      for (let i = 0; i < 4; i++) g.add(mesh(G.torus, '#ece4cf', 0, r * (0.55 - i * 0.32), 0, Math.PI / 2 + (i % 2 ? 0.2 : -0.15), 0, 0, r * 1.0, r * 1.0, r * 0.9));
      return [{ anchor: 'head', obj: g }];
    },
  },
  {
    id: 'hero_mask', slot: 'face', name: 'Hero Mask', emoji: '🦸', theme: 'superhero', cost: 3, c2d: '#2f6fd6',
    build: (d) => {
      const r = d.headR, g = new THREE.Group();
      g.add(mesh(G.torus, '#2f6fd6', 0, r * 0.12, 0, Math.PI / 2, 0, 0, r * 1.01, r * 1.01, r * 0.75));
      for (const s of [-1, 1]) g.add(mesh(G.sphere, '#2f6fd6', s * r * 0.38, r * 0.1, r * 0.86, 0, 0, 0, r * 0.3, r * 0.22, r * 0.08));
      return [{ anchor: 'head', obj: g }];
    },
  },
  {
    id: 'mustache', slot: 'face', name: 'Silly Mustache', emoji: '👨', theme: 'silly', cost: 2, c2d: '#2a1a10',
    build: (d) => {
      const r = d.headR, g = new THREE.Group();
      for (const s of [-1, 1]) g.add(mesh(G.sphere, '#2a1a10', s * r * 0.22, -r * 0.25, r * 0.94, 0, 0, s * 0.35, r * 0.26, r * 0.1, r * 0.08));
      return [{ anchor: 'head', obj: g }];
    },
  },
  {
    id: 'visor', slot: 'face', name: 'Star Visor', emoji: '🕶️', theme: 'space', cost: 3, c2d: '#6a3cd6',
    build: (d) => {
      const r = d.headR, g = new THREE.Group();
      g.add(mesh(G.box, mat('#7a4cff', { params: { transparent: true, opacity: 0.8 } }), 0, r * 0.1, r * 0.95, 0, 0, 0, r * 1.25, r * 0.32, r * 0.08));
      g.add(mesh(G.torus, '#c9ced6', 0, r * 0.1, 0, Math.PI / 2, 0, 0, r * 1.0, r * 1.0, r * 0.6));
      return [{ anchor: 'head', obj: g }];
    },
  },
  {
    id: 'skull_mask', slot: 'face', name: 'Skull Mask', emoji: '💀', theme: 'haunted', reward: true, c2d: '#f2f0e6',
    build: (d) => {
      const r = d.headR, g = new THREE.Group();
      g.add(mesh(G.sphere, '#f2f0e6', 0, 0, r * 0.35, 0, 0, 0, r * 0.98, r * 1.0, r * 0.75));
      for (const s of [-1, 1]) g.add(mesh(G.sphere, '#121214', s * r * 0.36, r * 0.1, r * 0.98, 0, 0, 0, r * 0.22, r * 0.25, r * 0.1));
      g.add(mesh(G.cone, '#121214', 0, -r * 0.18, r * 1.03, 0, 0, Math.PI, r * 0.08, r * 0.14, r * 0.05));
      for (let i = 0; i < 4; i++) g.add(mesh(G.box, '#121214', (i - 1.5) * r * 0.16, -r * 0.48, r * 0.95, 0, 0, 0, r * 0.03, r * 0.16, r * 0.05));
      return [{ anchor: 'head', obj: g }];
    },
  },

  // OUTFITS
  {
    id: 'pirate_outfit', slot: 'outfit', name: 'Pirate Captain', emoji: '⚓', theme: 'pirate', cost: 6, c2d: '#c4322c',
    colors: { shirt: '#ffffff', sleeves: '#f4efe4', pants: '#3b2a1e', shoes: '#1a1412', tex: 'stripes' },
    build: (d) => {
      const g = new THREE.Group();
      g.add(mesh(G.torus, '#b3222a', 0, 0, 0, Math.PI / 2, 0, 0, d.torsoR * 1.18, d.torsoR * 0.92, d.torsoR * 0.9));
      g.add(mesh(G.box, '#b3222a', d.torsoR * 0.75, -d.torsoR * 0.55, d.torsoR * 0.55, 0, 0, 0.2, d.torsoR * 0.22, d.torsoR * 0.9, d.torsoR * 0.08));
      return [{ anchor: 'waist', obj: g }];
    },
  },
  {
    id: 'fire_outfit', slot: 'outfit', name: 'Firefighter', emoji: '🚒', theme: 'firefighter', cost: 8, c2d: '#c9a94e',
    colors: { shirt: '#ffffff', sleeves: '#c9a94e', pants: '#ffffff', shoes: '#1a1a1a', tex: 'fire', pantsTex: 'firePants' },
    build: (d) => {
      const g = new THREE.Group();
      g.add(mesh(G.cyl, '#b39443', 0, 0, 0, 0, 0, 0, d.torsoR * 1.2, d.torsoR * 0.5, d.torsoR * 1.0));
      return [{ anchor: 'neck', obj: g }];
    },
  },
  {
    id: 'vampire_outfit', slot: 'outfit', name: 'Vampire', emoji: '🦇', theme: 'monster', cost: 7, c2d: '#18161c',
    colors: { shirt: '#ffffff', sleeves: '#18161c', pants: '#18161c', shoes: '#0c0c0c', tex: 'vampire' },
    build: (d) => [{ anchor: 'back', obj: cape(d, '#121014', '#9b1c2a', true) }],
  },
  {
    id: 'mummy_outfit', slot: 'outfit', name: 'Mummy', emoji: '🧻', theme: 'monster', cost: 6, c2d: '#ece4cf',
    colors: { shirt: '#ffffff', sleeves: '#e4dcc6', pants: '#ffffff', shoes: '#cfc4a8', tex: 'bandage', pantsTex: 'bandage' },
    build: () => [],
  },
  {
    id: 'skeleton_outfit', slot: 'outfit', name: 'Skeleton', emoji: '☠️', theme: 'monster', cost: 6, c2d: '#1b1b1f',
    colors: { shirt: '#ffffff', sleeves: '#1b1b1f', pants: '#ffffff', shoes: '#1b1b1f', tex: 'bones', pantsTex: 'boneLegs' },
    build: () => [],
  },
  {
    id: 'astro_outfit', slot: 'outfit', name: 'Astronaut', emoji: '🚀', theme: 'space', cost: 10, c2d: '#f1f2f4',
    colors: { shirt: '#ffffff', sleeves: '#f1f2f4', pants: '#eceef1', shoes: '#c9ced6', tex: 'astro' },
    build: (d) => {
      const g = new THREE.Group();
      g.add(mesh(G.box, '#e3e6ea', 0, 0, 0, 0, 0, 0, d.torsoR * 1.6, d.torsoR * 2.1, d.torsoR * 0.9));
      g.add(mesh(G.cyl, '#e8732c', -d.torsoR * 0.5, -d.torsoR * 0.2, -d.torsoR * 0.45, 0, 0, 0, d.torsoR * 0.22, d.torsoR * 1.6, d.torsoR * 0.22));
      g.add(mesh(G.cyl, '#e8732c', d.torsoR * 0.5, -d.torsoR * 0.2, -d.torsoR * 0.45, 0, 0, 0, d.torsoR * 0.22, d.torsoR * 1.6, d.torsoR * 0.22));
      return [{ anchor: 'back', obj: g }];
    },
  },
  {
    id: 'hero_outfit', slot: 'outfit', name: 'Super Hero', emoji: '⭐', theme: 'superhero', cost: 8, c2d: '#2f6fd6',
    colors: { shirt: '#ffffff', sleeves: '#2f6fd6', pants: '#2f6fd6', shoes: '#e63b3b', tex: 'hero' },
    build: (d) => [{ anchor: 'back', obj: cape(d, '#e63b3b', '#c22a2a', false) }],
  },
  {
    id: 'ghost_sheet', slot: 'outfit', name: 'Ghost Sheet', emoji: '👻', theme: 'haunted', reward: true, c2d: '#f6f6fa',
    colors: { shirt: '#f6f6fa', sleeves: '#f6f6fa', pants: '#f6f6fa', shoes: '#f6f6fa' },
    build: (d) => {
      // A classic bedsheet ghost that covers the whole kid (with eye holes).
      const g = new THREE.Group();
      const pts = [];
      const H = d.H * 1.0;
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const y = H * (1 - t);
        let r;
        if (t < 0.22) r = Math.sin((t / 0.22) * Math.PI / 2) * d.headR * 1.25;
        else r = d.headR * 1.25 + (t - 0.22) * d.H * 0.42;
        pts.push(new THREE.Vector2(Math.max(0.001, r), y));
      }
      const geo = new THREE.LatheGeometry(pts, 20);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        if (p.getY(i) < 0.02) p.setY(i, Math.sin(Math.atan2(p.getZ(i), p.getX(i)) * 6) * 0.04 + 0.03);
      }
      geo.computeVertexNormals();
      const sheet = new THREE.Mesh(geo, mat('#f6f6fa', { params: { side: THREE.DoubleSide } }));
      sheet.castShadow = true;
      g.add(sheet);
      const eyeY = d.headY;
      for (const s of [-1, 1]) g.add(mesh(G.sphere, '#121214', s * d.headR * 0.42, eyeY, d.headR * 1.2, 0, 0, 0, d.headR * 0.18, d.headR * 0.26, d.headR * 0.08));
      g.add(mesh(G.sphere, '#121214', 0, eyeY - d.headR * 0.5, d.headR * 1.18, 0, 0, 0, d.headR * 0.16, d.headR * 0.2, d.headR * 0.08));
      return [{ anchor: 'root', obj: g, hideBody: true }];
    },
  },

  // PROPS
  {
    id: 'candy_pail', slot: 'prop', name: 'Pumpkin Pail', emoji: '🎃', theme: 'classic', cost: 0, c2d: '#ef7d1f',
    build: (d) => {
      const s = d.H * 0.1, g = new THREE.Group();
      g.add(mesh(G.cyl, '#ef7d1f', 0, -s * 1.3, 0, 0, 0, 0, s * 0.85, s * 1.2, s * 0.85));
      g.add(mesh(G.torus, '#222', 0, -s * 0.45, 0, 0, Math.PI / 2, 0, s * 0.7, s * 0.7, s * 0.4));
      const f = new THREE.Mesh(G.box, mat('#2b1606'));
      f.scale.set(s * 0.8, s * 0.12, s * 0.05); f.position.set(0, -s * 1.55, s * 0.85);
      g.add(f);
      for (const x of [-0.3, 0.3]) g.add(mesh(new THREE.ConeGeometry(1, 1, 3), '#2b1606', x * s, -s * 1.1, s * 0.85, 0, 0, 0, s * 0.15, s * 0.2, s * 0.05));
      return [{ anchor: 'hand', obj: g }];
    },
  },
  {
    id: 'cutlass', slot: 'prop', name: 'Pirate Sword', emoji: '🗡️', theme: 'pirate', cost: 4, c2d: '#c9ced6',
    build: (d) => {
      const s = d.H * 0.1, g = new THREE.Group();
      g.add(mesh(G.box, '#5c3b24', 0, 0, 0, 0, 0, 0, s * 0.18, s * 0.6, s * 0.18));
      g.add(mesh(G.torus, '#d8b440', 0, s * 0.2, s * 0.12, 0, Math.PI / 2, 0, s * 0.3, s * 0.3, s * 0.4));
      g.add(mesh(G.box, '#d9dde3', 0, s * 1.6, s * 0.15, -0.12, 0, 0, s * 0.08, s * 2.6, s * 0.28));
      g.rotation.x = Math.PI / 2.3;
      return [{ anchor: 'hand', obj: g }];
    },
  },
  {
    id: 'parrot', slot: 'prop', name: 'Parrot Pal', emoji: '🦜', theme: 'pirate', cost: 7, c2d: '#2eaa4a',
    build: (d) => {
      const s = d.H * 0.1, g = new THREE.Group();
      g.add(mesh(G.sphere, '#2eaa4a', 0, s * 0.55, 0, 0, 0, 0, s * 0.45, s * 0.6, s * 0.45));
      g.add(mesh(G.sphere, '#2eaa4a', 0, s * 1.2, s * 0.1, 0, 0, 0, s * 0.35, s * 0.35, s * 0.35));
      g.add(mesh(G.cone, '#f2c230', 0, s * 1.15, s * 0.5, Math.PI / 2, 0, 0, s * 0.12, s * 0.3, s * 0.12));
      g.add(mesh(G.box, '#d9332b', 0, s * 0.1, -s * 0.4, 0.5, 0, 0, s * 0.3, s * 0.8, s * 0.08));
      for (const x of [-1, 1]) {
        g.add(mesh(G.sphere, '#2a8be0', x * s * 0.4, s * 0.6, 0, 0, 0, x * 0.3, s * 0.12, s * 0.45, s * 0.3));
        g.add(mesh(G.sphere, '#111', x * s * 0.18, s * 1.28, s * 0.32, 0, 0, 0, s * 0.06, s * 0.06, s * 0.06));
      }
      g.userData.bob = true;
      return [{ anchor: 'shoulder', obj: g }];
    },
  },
  {
    id: 'hose', slot: 'prop', name: 'Fire Hose', emoji: '🧯', theme: 'firefighter', cost: 5, c2d: '#d23a2a',
    build: (d) => {
      const s = d.H * 0.1, g = new THREE.Group();
      g.add(mesh(G.cyl, '#e8c64a', 0, s * 0.5, s * 0.35, Math.PI / 2.4, 0, 0, s * 0.18, s * 1.1, s * 0.18));
      g.add(mesh(G.cyl, '#1c1c1c', 0, s * 0.85, s * 0.95, Math.PI / 2.4, 0, 0, s * 0.12, s * 0.4, s * 0.12));
      g.add(mesh(G.torus, '#d23a2a', 0, -s * 0.2, -s * 0.2, 0, 0, 0, s * 0.5, s * 0.5, s * 0.6));
      return [{ anchor: 'hand', obj: g }];
    },
  },
  {
    id: 'lantern', slot: 'prop', name: 'Spooky Lantern', emoji: '🏮', theme: 'classic', cost: 4, c2d: '#ffb340',
    build: (d) => {
      const s = d.H * 0.1, g = new THREE.Group();
      g.add(mesh(G.torus, '#2b2b2b', 0, 0, 0, 0, Math.PI / 2, 0, s * 0.35, s * 0.35, s * 0.4));
      g.add(mesh(G.cyl, '#2b2b2b', 0, -s * 0.45, 0, 0, 0, 0, s * 0.45, s * 0.12, s * 0.45));
      const glow = new THREE.Mesh(G.cyl, glowMat);
      glow.scale.set(s * 0.35, s * 0.8, s * 0.35); glow.position.y = -s * 0.95;
      g.add(glow);
      g.add(mesh(G.cyl, '#2b2b2b', 0, -s * 1.45, 0, 0, 0, 0, s * 0.5, s * 0.15, s * 0.5));
      g.userData.light = true;
      return [{ anchor: 'hand', obj: g }];
    },
  },
  {
    id: 'blaster', slot: 'prop', name: 'Space Blaster', emoji: '🔫', theme: 'space', cost: 6, c2d: '#7a4cff',
    build: (d) => {
      const s = d.H * 0.1, g = new THREE.Group();
      g.add(mesh(G.box, '#7a4cff', 0, -s * 0.2, 0, 0, 0, 0, s * 0.22, s * 0.6, s * 0.25));
      g.add(mesh(G.cyl, '#c9ced6', 0, s * 0.15, s * 0.5, Math.PI / 2, 0, 0, s * 0.22, s * 1.0, s * 0.22));
      for (let i = 0; i < 3; i++) g.add(mesh(G.torus, '#34e0a1', 0, s * 0.15, s * (0.2 + i * 0.25), 0, 0, 0, s * 0.26, s * 0.26, s * 0.5));
      g.add(new THREE.Mesh(G.sphere, mat('#34e0a1', { basic: true })));
      g.children[g.children.length - 1].scale.setScalar(s * 0.14);
      g.children[g.children.length - 1].position.set(0, s * 0.15, s * 1.05);
      return [{ anchor: 'hand', obj: g }];
    },
  },
  {
    id: 'star_wand', slot: 'prop', name: 'Star Wand', emoji: '🌟', theme: 'superhero', cost: 3, c2d: '#ffd23f',
    build: (d) => {
      const s = d.H * 0.1, g = new THREE.Group();
      g.add(mesh(G.cyl, '#f4f1e6', 0, s * 0.5, s * 0.3, Math.PI / 3, 0, 0, s * 0.06, s * 1.4, s * 0.06));
      const star = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.45 : 1, a = Math.PI / 2 + (i * Math.PI) / 5;
        i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      const sg = new THREE.ExtrudeGeometry(star, { depth: 0.3, bevelEnabled: false });
      const sm = new THREE.Mesh(sg, mat('#ffd23f', { basic: true }));
      sm.scale.setScalar(s * 0.38); sm.position.set(0, s * 1.15, s * 0.9);
      g.add(sm);
      g.userData.spin = sm;
      return [{ anchor: 'hand', obj: g }];
    },
  },
  {
    id: 'pet_bat', slot: 'prop', name: 'Pet Bat', emoji: '🦇', theme: 'monster', cost: 6, c2d: '#3a2a4a',
    build: (d) => {
      const s = d.H * 0.1, g = new THREE.Group();
      const body = new THREE.Group();
      body.add(mesh(G.sphere, '#2a2030', 0, 0, 0, 0, 0, 0, s * 0.35, s * 0.4, s * 0.3));
      for (const x of [-1, 1]) {
        const w = mesh(new THREE.ConeGeometry(1, 1, 3), '#3a2a4a', x * s * 0.7, 0, 0, 0, 0, x * Math.PI / 2, s * 0.35, s * 0.9, s * 0.05);
        w.userData.wing = x;
        body.add(w);
        body.add(mesh(G.sphere, '#ffcf3a', x * s * 0.13, s * 0.1, s * 0.27, 0, 0, 0, s * 0.06, s * 0.06, s * 0.04));
      }
      body.position.set(0, s * 3.2, -s * 0.5);
      g.add(body);
      g.userData.flap = body;
      return [{ anchor: 'shoulder', obj: g }];
    },
  },
  {
    id: 'hero_shield', slot: 'prop', name: 'Hero Shield', emoji: '🛡️', theme: 'superhero', cost: 6, c2d: '#e63b3b',
    build: (d) => {
      const s = d.H * 0.1, g = new THREE.Group();
      const rings = ['#e63b3b', '#f4f1e6', '#e63b3b', '#2f6fd6'];
      rings.forEach((c, i) => g.add(mesh(G.cyl, c, 0, 0, s * 0.03 * i, Math.PI / 2, 0, 0, s * (1.1 - i * 0.25), s * 0.08, s * (1.1 - i * 0.25))));
      g.position.set(-s * 0.2, -s * 0.3, s * 0.35);
      g.rotation.y = -0.5;
      return [{ anchor: 'hand', obj: g }];
    },
  },
];

export const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

function cape(d, outer, inner, collar) {
  const g = new THREE.Group();
  const h = d.H * 0.6, w = d.torsoR * 2.6;
  const geo = new THREE.PlaneGeometry(w, h, 6, 6);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), x = p.getX(i);
    const t = (h / 2 - y) / h; // 0 at top, 1 at bottom
    p.setX(i, x * (0.55 + t * 0.7));
    p.setZ(i, -t * t * d.torsoR * 0.9 - Math.cos((x / w) * Math.PI) * d.torsoR * 0.25);
  }
  geo.computeVertexNormals();
  geo.translate(0, -h / 2, 0);
  const front = new THREE.Mesh(geo, mat(inner, { params: { side: THREE.FrontSide } }));
  const back = new THREE.Mesh(geo, mat(outer, { params: { side: THREE.BackSide } }));
  front.castShadow = back.castShadow = true;
  g.add(front, back);
  if (collar) {
    for (const s of [-1, 1]) g.add(mesh(G.box, outer, s * d.torsoR * 0.6, d.torsoR * 0.55, d.torsoR * 0.2, -0.3, s * 0.6, 0, d.torsoR * 0.9, d.torsoR * 1.1, d.torsoR * 0.05));
  }
  g.userData.cape = true;
  return g;
}

export function outfitTexture(key) {
  return key && TEX[key] ? TEX[key]() : null;
}

export const STARTER_ITEMS = ITEMS.filter((i) => i.cost === 0).map((i) => i.id);
