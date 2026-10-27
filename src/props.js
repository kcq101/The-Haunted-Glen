import * as THREE from 'three';
import { mergeVertices } from '../lib/addons/utils/BufferGeometryUtils.js';
import { GEO } from './builder.js';
import { q } from './quality.js';

// ---------------------------------------------------------------------------
// Yard props with a bit more craft: ribbed jack-o'-lanterns with real carved
// faces, a puffy inflatable ghost, a sitting black cat, and a jointed skeleton.
// Everything is merged through the Builder like the rest of the decorations.
// ---------------------------------------------------------------------------

const UP = new THREE.Vector3(0, 1, 0);

// Shading baked into vertex colors (Builder multiplies them by the part color)
function shade(g, fn) {
  const p = g.attributes.position;
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const v = fn(p.getX(i), p.getY(i), p.getZ(i));
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

function smooth(g) {
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  g.computeVertexNormals();
  return g;
}

// --- Pumpkin ---------------------------------------------------------------
// Body for r = 1: 0.9 wide (radius), 0.62 tall (half height), 10 ribs with a
// groove straight down the front so the nose and mouth sit in it.
const PW = 0.9, PH = 0.62, RIBS = 5;
const rib = (phi) => 1 - 0.085 * Math.pow(1 - Math.abs(Math.sin(RIBS * phi)), 2.2);

const PUMPKIN_GEO = (() => {
  let g = new THREE.SphereGeometry(1, q(30, 20), q(16, 10));
  g = smooth(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const rh = Math.hypot(x, z);
    const k = rib(Math.atan2(x, z)) * PW;
    // dimples top and bottom where the stem and blossom end sit
    const dimple = 0.16 * Math.pow(Math.max(0, 1 - rh), 2);
    p.setXYZ(i, x * k, y * PH - Math.sign(y) * dimple, z * k);
  }
  g.computeVertexNormals();
  return shade(g, (x, y, z) => {
    const r = rib(Math.atan2(x, z));
    return 0.78 + 0.22 * ((r - 0.915) / 0.085) + 0.06 * (y / PH);
  });
})();

const STEM_GEO = (() => {
  const g = new THREE.CylinderGeometry(0.05, 0.09, 0.3, 6, 2);
  g.translate(0, 0.15, 0);
  // little curl at the top
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + Math.pow(p.getY(i) / 0.3, 2) * 0.06);
  g.computeVertexNormals();
  return g;
})();

// Front surface depth of the pumpkin body (r = 1) at face coords (x, y)
function pumpkinZ(x, y) {
  const v = Math.max(0, 1 - (y / PH) ** 2);
  let z = Math.sqrt(Math.max(0, (PW * v ** 0.5) ** 2 - x * x));
  for (let it = 0; it < 4; it++) {
    const R = PW * rib(Math.atan2(x, z)) * Math.sqrt(v);
    z = Math.sqrt(Math.max(0.0001, R * R - x * x));
  }
  return z;
}

// The carved face, built once for r = 1 and hugging the pumpkin's curve.
// Bright yellow at the center of each cut, deeper orange at the edges, so it
// reads as candlelight glowing through carved holes.
const FACE_GEO = (() => {
  const pos = [], col = [];
  const LIFT = 0.008;
  const hot = new THREE.Color('#fff1a6'), rim = new THREE.Color('#ff8c1a');
  const put = (x, y, c) => { pos.push(x, y, pumpkinZ(x, y) + LIFT); col.push(c.r, c.g, c.b); };
  const tri = (a, b, c) => { put(...a); put(...b); put(...c); };

  // fan-filled polygon (outline listed counter-clockwise), edges subdivided
  const poly = (pts) => {
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const ring = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      for (let k = 0; k < 4; k++) ring.push([a[0] + (b[0] - a[0]) * k / 4, a[1] + (b[1] - a[1]) * k / 4]);
    }
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      tri([cx, cy, hot], [a[0], a[1], rim], [b[0], b[1], rim]);
    }
  };
  // triangle eyes, tipped a little for a friendly look
  const eye = [[-0.13, -0.08], [0.13, -0.08], [0.03, 0.13]];
  poly(eye.map(([x, y]) => [x + 0.27, y + 0.15]));
  poly(eye.map(([x, y]) => [-x - 0.27, y + 0.15]).reverse());
  // triangle nose
  poly([[-0.065, -0.05], [0.065, -0.05], [0, 0.06]]);

  // grinning mouth with teeth, built as thin columns so it follows the curve
  const W = 0.45;
  const top = (x) => -0.12 - 0.075 * (1 - (x / W) ** 2);
  const bot = (x) => -0.14 - 0.215 * (1 - (x / W) ** 2);
  const TOOTH = 0.07;
  const topTeeth = [[-0.23, -0.115], [0.115, 0.23]];
  const botTeeth = [[-0.055, 0.055]];
  const xs = [];
  for (let x = -W; x <= W + 1e-6; x += 0.025) xs.push(x);
  for (const [a, b] of [...topTeeth, ...botTeeth]) xs.push(a - 1e-4, a + 1e-4, b - 1e-4, b + 1e-4);
  xs.sort((a, b) => a - b);
  const inside = (x, list) => list.some(([a, b]) => x > a && x < b);
  const cols = xs.map((x) => {
    const t = top(x) - (inside(x, topTeeth) ? TOOTH : 0);
    const b = bot(x) + (inside(x, botTeeth) ? TOOTH : 0);
    return { x, t, b, m: (t + b) / 2 };
  });
  for (let i = 0; i < cols.length - 1; i++) {
    const L = cols[i], R = cols[i + 1];
    tri([L.x, L.t, rim], [L.x, L.m, hot], [R.x, R.m, hot]);
    tri([L.x, L.t, rim], [R.x, R.m, hot], [R.x, R.t, rim]);
    tri([L.x, L.m, hot], [L.x, L.b, rim], [R.x, R.b, rim]);
    tri([L.x, L.m, hot], [R.x, R.b, rim], [R.x, R.m, hot]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
})();

export function addPumpkin(B, glows, x, y, z, r, ry = 0, carved = false, color = '#ef7d1f') {
  const cy = y + PH * r - 0.02 * r;
  B.add(PUMPKIN_GEO, color, { x, y: cy, z, ry, s: r });
  const top = cy + (PH - 0.1) * r;
  B.add(STEM_GEO, '#5b6b2a', { x, y: top, z, ry: ry + 0.6, rz: -0.15, s: r });
  if (carved) {
    B.add(FACE_GEO, '#ffffff', { x, y: cy, z, ry, s: r }, 'lamp');
    glows?.add({ x, y: cy + r * 0.1, z }, '#ff9a2a', r * 5, 0, 1);
  }
}

// --- helpers for posed parts -----------------------------------------------
function poseMatrix(x, y, z, ry, s = 1) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, ry), new THREE.Vector3(s, s, s));
}

// A cylinder from a to b (local coords) with the given radius
function seg(B, color, a, b, rad, parent, geo = GEO.cylLo) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b);
  const d = Bv.clone().sub(A);
  const len = d.length();
  const m = new THREE.Matrix4().compose(
    A.clone().add(Bv).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()),
    new THREE.Vector3(rad * 2, len, rad * 2),
  );
  B.add(geo, color, m, 'solid', parent);
}

const ball = (B, color, p, s, parent, key = 'solid') =>
  B.add(GEO.sphere, color, { x: p[0], y: p[1], z: p[2], sx: s[0], sy: s[1], sz: s[2], rx: s[3] || 0, ry: s[4] || 0, rz: s[5] || 0 }, key, parent);

// Points on a lathe body's front: given the body radius at a height, push a
// feature out to the surface and turn it to face outward.
function onSurface(R, x, y, depthIn = 0.03) {
  const z = Math.sqrt(Math.max(0.01, R * R - x * x)) - depthIn;
  return { p: [x, y, z], yaw: Math.atan2(x, z) };
}

// --- Inflatable ghost ------------------------------------------------------
const GHOST_PROFILE = [[0, 3.0], [0.36, 2.96], [0.66, 2.83], [0.87, 2.6], [0.98, 2.3], [1.0, 1.98], [1.0, 1.62], [1.04, 1.22],
  [1.12, 0.84], [1.24, 0.48], [1.36, 0.16], [1.39, 0.03], [1.2, 0.05], [0.6, 0.3], [0, 0.36]];
const GHOST_GEO = (() => {
  let g = new THREE.LatheGeometry(GHOST_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), q(32, 18));
  g = smooth(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y > 0.6) continue;
    const th = Math.atan2(z, x);
    const w = 1 - y / 0.6;
    const wave = Math.sin(th * 7);
    const k = 1 + 0.05 * wave * w;
    p.setXYZ(i, x * k, y + 0.16 * (0.5 + 0.5 * wave) * w, z * k);
  }
  g.computeVertexNormals();
  // soft inflatable shading: a touch bluer and darker toward the hem
  return shade(g, (x, y) => 0.84 + 0.16 * Math.min(1, y / 2.6));
})();

function ghostRadius(y) {
  for (let i = 0; i < GHOST_PROFILE.length - 1; i++) {
    const [r0, y0] = GHOST_PROFILE[i], [r1, y1] = GHOST_PROFILE[i + 1];
    if ((y <= y0 && y >= y1)) return r0 + (r1 - r0) * ((y - y0) / (y1 - y0 || 1));
  }
  return 1;
}

export function addGhost(B, glows, x, y, z, ry, s = 1) {
  const P = poseMatrix(x, y, z, ry, s);
  B.add(GHOST_GEO, '#f7f6ff', new THREE.Matrix4(), 'solid', P);
  // arms up, "boo!"
  for (const sd of [-1, 1]) {
    ball(B, '#f1f0fb', [sd * 1.08, 1.75, 0.05], [0.42, 0.95, 0.4, 0, 0, -sd * 0.75], P);
    ball(B, '#f1f0fb', [sd * 1.36, 2.12, 0.06], [0.32, 0.32, 0.32], P);
  }
  // big friendly eyes with a shine
  for (const sd of [-1, 1]) {
    const e = onSurface(ghostRadius(2.25), sd * 0.3, 2.25, 0.035);
    ball(B, '#1c1a24', e.p, [0.24, 0.36, 0.12, 0, e.yaw], P);
    const h = onSurface(ghostRadius(2.33), sd * 0.3 - 0.04, 2.33, -0.01);
    ball(B, '#ffffff', h.p, [0.07, 0.08, 0.04, 0, h.yaw], P);
    const c = onSurface(ghostRadius(1.98), sd * 0.56, 1.98, 0.03);
    ball(B, '#ffb7cc', c.p, [0.22, 0.12, 0.08, 0, c.yaw], P);
  }
  // little "oh!" mouth
  const m = onSurface(ghostRadius(1.9), 0, 1.9, 0.03);
  ball(B, '#3a1f38', m.p, [0.22, 0.28, 0.1], P);
  glows?.add({ x, y: y + 1.5 * s, z }, '#cfd8ff', 4 * s, 0, 0);
}

// --- Black cat (sitting) ---------------------------------------------------
const CAT_PROFILE = [[0, 0], [0.62, 0.02], [0.86, 0.28], [0.9, 0.7], [0.78, 1.12], [0.58, 1.48], [0.44, 1.72], [0.36, 1.86], [0, 1.9]];
const CAT_BODY = (() => {
  let g = new THREE.LatheGeometry(CAT_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), q(24, 14));
  g = smooth(g);
  // a little deeper front to back than side to side, chest pushed forward
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * 0.92, p.getY(i), p.getZ(i) * 1.06 + 0.05 * Math.sin(Math.PI * p.getY(i) / 1.9));
  g.computeVertexNormals();
  return shade(g, (x, y) => 0.8 + 0.2 * Math.min(1, y / 1.9));
})();
const CAT_TAIL = (() => {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.22, -0.72), new THREE.Vector3(0.55, 0.22, -0.92), new THREE.Vector3(0.95, 0.75, -0.82),
    new THREE.Vector3(0.95, 1.45, -0.6), new THREE.Vector3(0.72, 1.85, -0.52),
  ]);
  const g = new THREE.TubeGeometry(curve, q(24, 14), 0.12, q(8, 6), false);
  // taper toward the tip
  const p = g.attributes.position;
  const pts = curve.getSpacedPoints(200);
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    let best = 0, bd = 1e9;
    pts.forEach((c, k) => { const d = c.distanceToSquared(v); if (d < bd) { bd = d; best = k; } });
    const c = pts[best], t = best / 200;
    v.sub(c).multiplyScalar(1 - 0.45 * t).add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
})();
const EAR_GEO = new THREE.ConeGeometry(0.5, 1, 3);
const TORUS_GEO = new THREE.TorusGeometry(1, 0.14, 6, q(20, 12));

export function addCat(B, x, y, z, ry, s = 1) {
  const P = poseMatrix(x, y, z, ry, s);
  const fur = '#2a2731', dark = '#1f1d25';
  B.add(CAT_BODY, fur, new THREE.Matrix4(), 'solid', P);
  B.add(CAT_TAIL, fur, new THREE.Matrix4(), 'solid', P);
  ball(B, fur, [0.72, 1.85, -0.52], [0.2, 0.2, 0.2], P);
  // front paws
  for (const sd of [-1, 1]) ball(B, dark, [sd * 0.3, 0.1, 0.72], [0.34, 0.22, 0.44], P);
  // head
  const hy = 2.28;
  ball(B, fur, [0, hy, 0.06], [1.62, 1.36, 1.42], P);
  for (const sd of [-1, 1]) {
    // ears with pink insides
    B.add(EAR_GEO, fur, { x: sd * 0.44, y: hy + 0.66, z: 0.0, rz: -sd * 0.28, ry: sd * 0.3, sx: 0.5, sy: 0.62, sz: 0.34 }, 'solid', P);
    B.add(EAR_GEO, '#f3a1b6', { x: sd * 0.42, y: hy + 0.6, z: 0.09, rz: -sd * 0.28, ry: sd * 0.3, sx: 0.3, sy: 0.42, sz: 0.12 }, 'solid', P);
    // glowing green eyes with slit pupils
    ball(B, '#bff04a', [sd * 0.3, hy + 0.1, 0.66], [0.34, 0.4, 0.14, 0, sd * 0.35], P, 'lamp');
    ball(B, '#121016', [sd * 0.31, hy + 0.1, 0.71], [0.08, 0.32, 0.06, 0, sd * 0.35], P);
    ball(B, '#ffffff', [sd * 0.25, hy + 0.2, 0.72], [0.06, 0.06, 0.03], P);
    // muzzle puffs + whiskers
    ball(B, '#3a3642', [sd * 0.13, hy - 0.2, 0.68], [0.26, 0.2, 0.18], P);
    for (const k of [-1, 1]) B.add(GEO.box, '#d8d4de', { x: sd * 0.48, y: hy - 0.2 + k * 0.05, z: 0.62, rz: sd * k * 0.12, ry: -sd * 0.25, sx: 0.5, sy: 0.018, sz: 0.018 }, 'solid', P);
  }
  ball(B, '#f08aa4', [0, hy - 0.08, 0.76], [0.12, 0.08, 0.08], P);
  // orange collar + bell
  B.add(TORUS_GEO, '#ff8a1f', { x: 0, y: 1.72, z: 0.02, rx: Math.PI / 2, sx: 0.46, sy: 0.56, sz: 0.42 }, 'solid', P);
  ball(B, '#ffd23a', [0, 1.6, 0.6], [0.14, 0.14, 0.14], P);
}

// --- Skeleton --------------------------------------------------------------
const RIB_GEO = new THREE.TorusGeometry(1, 0.22, 5, q(16, 10));

export function addSkeleton(B, x, y, z, ry, s = 1) {
  const P = poseMatrix(x, y, z, ry, s);
  const bone = '#eee8d5', joint = '#e4dcc4', hole = '#17151b';
  const LB = 0.034, AB = 0.028, J = 0.05;
  const j = (p, r = J) => ball(B, joint, p, [r * 2, r * 2, r * 2], P);
  // legs
  for (const sd of [-1, 1]) {
    const hip = [sd * 0.11, 0.88, 0], knee = [sd * 0.125, 0.5, 0.03], ankle = [sd * 0.12, 0.1, 0];
    seg(B, bone, hip, knee, LB, P); seg(B, bone, knee, ankle, LB * 0.85, P);
    j(knee, 0.048); j(ankle, 0.038);
    ball(B, bone, [sd * 0.12, 0.045, 0.07], [0.13, 0.08, 0.26], P);
  }
  // pelvis + spine
  ball(B, bone, [0, 0.9, 0], [0.34, 0.17, 0.2], P);
  seg(B, bone, [0, 0.9, -0.02], [0, 1.55, -0.02], 0.03, P);
  for (let i = 0; i < 4; i++) ball(B, joint, [0, 0.98 + i * 0.05, -0.03], [0.07, 0.035, 0.07], P);
  // ribcage: hoops getting smaller toward the bottom, plus the breastbone
  const ribs = [[1.38, 0.15], [1.3, 0.165], [1.22, 0.16], [1.14, 0.14]];
  for (const [ry0, R] of ribs) B.add(RIB_GEO, bone, { x: 0, y: ry0, z: 0.02, rx: Math.PI / 2, sx: R, sy: R * 0.8, sz: 0.11 }, 'solid', P);
  B.add(GEO.box, bone, { x: 0, y: 1.27, z: 0.15, sx: 0.045, sy: 0.24, sz: 0.03 }, 'solid', P);
  // shoulders
  seg(B, bone, [-0.21, 1.46, 0], [0.21, 1.46, 0], 0.026, P);
  // arms: left relaxed, right waving
  const arms = [
    [[-0.22, 1.46, 0], [-0.27, 1.17, 0.03], [-0.28, 0.92, 0.07]],
    [[0.22, 1.46, 0], [0.42, 1.58, 0.03], [0.47, 1.84, 0.07]],
  ];
  for (const [sh, el, wr] of arms) {
    j(sh, 0.045);
    seg(B, bone, sh, el, AB, P); seg(B, bone, el, wr, AB * 0.85, P);
    j(el, 0.04);
    ball(B, bone, [wr[0], wr[1] + (wr[1] > 1.5 ? 0.05 : -0.05), wr[2]], [0.09, 0.12, 0.05], P);
  }
  // neck + skull
  seg(B, bone, [0, 1.46, -0.01], [0, 1.6, 0], 0.025, P);
  const hy = 1.76;
  ball(B, bone, [0, hy, 0], [0.31, 0.3, 0.33], P);
  ball(B, bone, [0, hy - 0.12, 0.05], [0.21, 0.13, 0.21], P);
  for (const sd of [-1, 1]) ball(B, hole, [sd * 0.068, hy + 0.01, 0.13], [0.09, 0.1, 0.06, 0, sd * 0.3], P);
  B.add(GEO.cone4, hole, { x: 0, y: hy - 0.06, z: 0.15, rx: Math.PI, sx: 0.045, sy: 0.05, sz: 0.03 }, 'solid', P);
  // grin with tooth lines
  B.add(GEO.box, hole, { x: 0, y: hy - 0.135, z: 0.145, sx: 0.12, sy: 0.012, sz: 0.02 }, 'solid', P);
  for (let i = -2; i <= 2; i++) B.add(GEO.box, hole, { x: i * 0.024, y: hy - 0.135, z: 0.146, sx: 0.006, sy: 0.04, sz: 0.02 }, 'solid', P);
}
