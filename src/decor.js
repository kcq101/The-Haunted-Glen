import * as THREE from 'three';
import { GEO } from './builder.js';
import { makeRng, polylineDistance, resample } from './util.js';
import { toWorld } from './houses.js';
import { roadLines, trailLine, creekLine, culDeSac } from './terrain.js';
import { px, BOUNDS } from './config.js';

// ---------------------------------------------------------------------------
// Fall + Halloween decorations, street lamps, trail lanterns, the footbridge
// and the extra-spooky touches on the haunted house.
// ---------------------------------------------------------------------------

export function addPumpkin(B, glows, x, y, z, r, ry = 0, carved = false, color = '#ef7d1f') {
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + ry + 0.4;
    B.add(GEO.sphereLo, color, { x: x + Math.sin(a) * r * 0.3, y: y + r * 0.62, z: z + Math.cos(a) * r * 0.3, ry: a, sx: r * 1.1, sy: r * 1.2, sz: r * 1.35 });
  }
  B.add(GEO.cylLo, '#56702c', { x, y: y + r * 1.3, z, rz: 0.25, sx: r * 0.18, sy: r * 0.5, sz: r * 0.18 });
  if (carved) {
    const f = (lx, ly, sx, sy) => {
      const c = Math.cos(ry), s = Math.sin(ry);
      const lz = r * 0.86;
      B.add(GEO.box, '#ffb03a', { x: x + lx * c + lz * s, y: y + r * 0.62 + ly, z: z - lx * s + lz * c, ry, sx, sy, sz: r * 0.2 }, 'lamp');
    };
    f(-r * 0.32, r * 0.2, r * 0.26, r * 0.22);
    f(r * 0.32, r * 0.2, r * 0.26, r * 0.22);
    f(0, -r * 0.2, r * 0.7, r * 0.16);
    glows?.add({ x, y: y + r * 0.7, z }, '#ff9a2a', r * 5, 0, 1);
  }
}

function addTombstone(B, x, y, z, ry, s = 1) {
  B.add(GEO.box, '#8e9196', { x, y: y + 0.45 * s, z, ry, rx: (Math.random() - 0.5) * 0.15, sx: 0.85 * s, sy: 0.9 * s, sz: 0.18 * s });
  B.add(GEO.cyl, '#8e9196', { x, y: y + 0.9 * s, z, ry, rx: Math.PI / 2, sx: 0.85 * s, sy: 0.18 * s, sz: 0.85 * s });
  B.add(GEO.box, '#6f7276', { x: x + Math.sin(ry) * 0.1 * s, y: y + 0.7 * s, z: z + Math.cos(ry) * 0.1 * s, ry, sx: 0.4 * s, sy: 0.06 * s, sz: 0.02 });
}

function addInflatable(B, glows, x, y, z, ry, kind) {
  if (kind === 'ghost') {
    B.add(GEO.sphere, '#f6f6fa', { x, y: y + 1.0, z, sx: 1.4, sy: 2.0, sz: 1.3 });
    B.add(GEO.sphere, '#f6f6fa', { x, y: y + 2.3, z, sx: 1.0, sy: 1.0, sz: 0.95 });
    for (const s of [-1, 1]) {
      const c = Math.cos(ry), sn = Math.sin(ry);
      B.add(GEO.sphere, '#151518', { x: x + s * 0.28 * c + 0.88 * sn, y: y + 2.4, z: z - s * 0.28 * sn + 0.88 * c, sx: 0.16, sy: 0.24, sz: 0.08, ry });
    }
    glows?.add({ x, y: y + 1.5, z }, '#cfd8ff', 4, 0, 0);
  } else if (kind === 'pumpkin') {
    addPumpkin(B, glows, x, y, z, 1.3, ry, true);
  } else {
    // black cat
    B.add(GEO.sphere, '#1b1a20', { x, y: y + 0.9, z, sx: 1.0, sy: 1.3, sz: 0.9 });
    B.add(GEO.sphere, '#1b1a20', { x, y: y + 2.1, z, sx: 0.8, sy: 0.75, sz: 0.75 });
    for (const s of [-1, 1]) {
      const c = Math.cos(ry), sn = Math.sin(ry);
      B.add(GEO.cone4, '#1b1a20', { x: x + s * 0.45 * c, y: y + 2.75, z: z - s * 0.45 * sn, ry, sx: 0.4, sy: 0.6, sz: 0.3 });
      B.add(GEO.sphere, '#c8f04a', { x: x + s * 0.27 * c + 0.68 * sn, y: y + 2.2, z: z - s * 0.27 * sn + 0.68 * c, sx: 0.14, sy: 0.18, sz: 0.06 }, 'lamp');
    }
  }
}

function addHayDisplay(B, glows, x, y, z, ry) {
  B.add(GEO.box, '#d8b45a', { x, y: y + 0.4, z, ry, sx: 1.6, sy: 0.8, sz: 0.9 });
  for (let i = 0; i < 5; i++) {
    const c = Math.cos(ry), s = Math.sin(ry);
    const lx = -0.9 + (i % 3) * 0.12, lz = -0.2 + i * 0.1;
    B.add(GEO.cone, '#c2a24a', { x: x + lx * c + lz * s, y: y + 1.4, z: z - lx * s + lz * c, sx: 0.25, sy: 2.6, sz: 0.25, rz: (i - 2) * 0.06 });
  }
  B.add(GEO.sphere, '#c4501f', { x: x + 0.4, y: y + 1.0, z, s: 0.45 });
  B.add(GEO.sphere, '#f0e6c8', { x: x - 0.3, y: y + 0.95, z: z + 0.1, s: 0.38 });
  addPumpkin(B, glows, x + 0.9, y, z + 0.6, 0.35, ry, false);
}

function addSkeleton(B, x, y, z, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, ly, lz) => ({ x: x + lx * c + lz * s, y: y + ly, z: z - lx * s + lz * c, ry });
  const bone = '#efece2';
  B.add(GEO.sphere, bone, { ...P(0, 1.55, 0), sx: 0.4, sy: 0.42, sz: 0.4 });
  for (const sx of [-1, 1]) B.add(GEO.sphere, '#151518', { ...P(sx * 0.12, 1.58, 0.18), sx: 0.08, sy: 0.1, sz: 0.05 });
  B.add(GEO.box, bone, { ...P(0, 1.05, 0), sx: 0.08, sy: 0.75, sz: 0.08 });
  for (let i = 0; i < 4; i++) B.add(GEO.box, bone, { ...P(0, 1.3 - i * 0.12, 0.02), sx: 0.42 - i * 0.04, sy: 0.04, sz: 0.2 });
  for (const sx of [-1, 1]) {
    B.add(GEO.box, bone, { ...P(sx * 0.3, 1.0, 0), rz: sx * 0.4, sx: 0.05, sy: 0.6, sz: 0.05 });
    B.add(GEO.box, bone, { ...P(sx * 0.12, 0.35, 0), sx: 0.06, sy: 0.7, sz: 0.06 });
  }
}

function addStringLights(B, glows, s, colors) {
  const pts = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const lx = -s.W / 2 + (i / n) * s.W;
    const sag = Math.sin(((i % 4) / 4) * Math.PI) * 0.18;
    pts.push(toWorld(s, lx, s.D / 2 + 0.55));
    pts[pts.length - 1].y = s.y + s.H - 0.1 - sag;
  }
  pts.forEach((p, i) => {
    const col = colors[i % colors.length];
    B.add(GEO.sphere, col, { x: p.x, y: p.y, z: p.z, s: 0.14 }, 'lamp');
    if (i % 2 === 0) glows.add(p, col, 1.1, 0, 0.3);
  });
}

function addMailbox(B, x, y, z, ry) {
  B.add(GEO.box, '#2b2b2b', { x, y: y + 0.55, z, sx: 0.1, sy: 1.1, sz: 0.1 });
  B.add(GEO.box, '#1f2326', { x, y: y + 1.15, z, ry, sx: 0.32, sy: 0.32, sz: 0.55 });
  B.add(GEO.cyl, '#1f2326', { x, y: y + 1.3, z, ry, rx: Math.PI / 2, sx: 0.32, sy: 0.55, sz: 0.32 });
}

// distance from a point to the edge of the nearest road (negative = on the road)
function roadSurfaceDist(x, z) {
  let best = Math.hypot(x - culDeSac.x, z - culDeSac.z) - culDeSac.r;
  for (const r of roadLines) best = Math.min(best, polylineDistance(x, z, r.line).d - r.width / 2);
  return best;
}

// --- neighborhood decorations ----------------------------------------------
export function decorateNeighborhood(B, glows, specs, heightAt) {
  for (const s of specs) {
    if (s.home) continue;
    const rng = makeRng(s.seed + 99);
    const W = (lx, lz) => {
      const p = toWorld(s, lx, lz);
      return { ...p, y: heightAt(p.x, p.z) };
    };
    // pumpkins by the door
    const n = 2 + ((rng() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const p = W(s.doorX + side * (1.3 + rng() * 0.7), s.D / 2 + 1.1 + rng() * 1.2);
      addPumpkin(B, glows, p.x, p.y, p.z, 0.32 + rng() * 0.18, s.rot, rng() < 0.6, rng() < 0.15 ? '#f2eee0' : '#ef7d1f');
    }
    if (rng() < 0.55) { const p = W(s.doorX - 2.6, s.D / 2 + 1.8); addHayDisplay(B, glows, p.x, p.y, p.z, s.rot); }
    if (rng() < 0.4) {
      const kinds = ['ghost', 'pumpkin', 'cat'];
      const p = W((rng() - 0.5) * s.W * 0.6 + s.garageSide * -2, s.D / 2 + 7 + rng() * 3);
      addInflatable(B, glows, p.x, p.y, p.z, s.rot, kinds[(rng() * 3) | 0]);
    }
    if (rng() < 0.35) {
      for (let i = 0; i < 3; i++) {
        const p = W(-s.garageSide * (s.W * 0.25 + i * 1.6), s.D / 2 + 5 + (i % 2) * 1.3);
        addTombstone(B, p.x, p.y, p.z, s.rot + (rng() - 0.5) * 0.4, 0.9 + rng() * 0.3);
      }
    }
    if (rng() < 0.25) { const p = W(-s.garageSide * s.W * 0.4, s.D / 2 + 3.5); addSkeleton(B, p.x, p.y, p.z, s.rot); }
    if (rng() < 0.35) addStringLights(B, glows, s, rng() < 0.5 ? ['#ff8a1f', '#ff8a1f', '#9b5cff'] : ['#ff8a1f', '#7cff6b', '#9b5cff']);
    // mailbox at the curb next to the driveway
    const dw = s.driveway;
    const dx = dw.a.x - dw.b.x, dz = dw.a.z - dw.b.z, L = Math.hypot(dx, dz) || 1;
    let t = 0;
    while (t < L && roadSurfaceDist(dw.b.x + (dx / L) * t, dw.b.z + (dz / L) * t) < 1.0) t += 0.25;
    const mx = dw.b.x + (dx / L) * t - (dz / L) * 3.4, mz = dw.b.z + (dz / L) * t + (dx / L) * 3.4;
    addMailbox(B, mx, heightAt(mx, mz), mz, s.rot);
  }
}

// Street lamps along the neighborhood roads
export function addStreetLamps(B, glows, heightAt) {
  const lamps = [];
  for (const r of roadLines) {
    if (!r.sidewalks) continue;
    const pts = resample(r.line, 34);
    pts.forEach((p, i) => {
      if (i === 0) return;
      const q = pts[Math.min(i + 1, pts.length - 1)], o = pts[i - 1];
      const dx = q.x - o.x, dz = q.z - o.z, L = Math.hypot(dx, dz) || 1;
      const side = i % 2 ? 1 : -1;
      const off = r.width / 2 + 2.4;
      const x = p.x + (-dz / L) * off * side, z = p.z + (dx / L) * off * side;
      if (lamps.some((l) => Math.hypot(l.x - x, l.z - z) < 18)) return;
      lamps.push({ x, z });
    });
  }
  for (const l of lamps) {
    const y = heightAt(l.x, l.z);
    B.add(GEO.cylLo, '#24272b', { x: l.x, y: y + 2.2, z: l.z, sx: 0.16, sy: 4.4, sz: 0.16 });
    B.add(GEO.cylLo, '#24272b', { x: l.x, y: y + 0.25, z: l.z, sx: 0.32, sy: 0.5, sz: 0.32 });
    B.add(GEO.cone, '#24272b', { x: l.x, y: y + 4.95, z: l.z, sx: 0.75, sy: 0.4, sz: 0.75 });
    B.add(GEO.cyl, '#fff1c4', { x: l.x, y: y + 4.6, z: l.z, sx: 0.42, sy: 0.55, sz: 0.42 }, 'lamp');
    glows.add({ x: l.x, y: y + 4.6, z: l.z }, '#ffd58a', 3.2, 0, 0);
  }
  return lamps;
}

// Split-rail fence marking the edges of the neighborhood
export function addBoundaryFence(B, heightAt) {
  const runs = [
    [px(BOUNDS.minX + 5, BOUNDS.minY - 6), px(BOUNDS.maxX - 40, BOUNDS.minY - 6)],
  ];
  for (const [a, b] of runs) {
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.floor(L / 3);
    const ang = Math.atan2(b.x - a.x, b.z - a.z);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = heightAt(x, z);
      B.add(GEO.box, '#7a5a3a', { x, y: y + 0.6, z, sx: 0.18, sy: 1.3, sz: 0.18 });
      if (i < n) {
        const x2 = a.x + (b.x - a.x) * ((i + 0.5) / n), z2 = a.z + (b.z - a.z) * ((i + 0.5) / n), y2 = heightAt(x2, z2);
        for (const hy of [0.5, 1.0]) B.add(GEO.box, '#8a6a46', { x: x2, y: y2 + hy, z: z2, ry: ang, sx: 0.1, sy: 0.12, sz: 3.1 });
      }
    }
  }
}

// --- trail through the woods: lanterns, signpost, footbridge ---------------
function textTexture(lines, opts = {}) {
  const { w = 512, h = 256, bg = '#6b4628', fg = '#ffe7b0', font = 'bold 54px Georgia, serif', border = '#3f2814' } = opts;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.05})`; g.fillRect(0, Math.random() * h, w, 2 + Math.random() * 4); }
  g.strokeStyle = border; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font;
  lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * (h / (lines.length + 0.6))));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function addTrail(B, glows, scene, heightAt) {
  // lanterns every few steps along the trail
  const pts = resample(trailLine, 9);
  pts.forEach((p, i) => {
    if (i === 0 || i === pts.length - 1) return;
    const q = pts[i + 1], dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1;
    const side = i % 2 ? 1 : -1;
    const x = p.x + (-dz / L) * 2.1 * side, z = p.z + (dx / L) * 2.1 * side, y = heightAt(x, z);
    B.add(GEO.box, '#4a3322', { x, y: y + 0.8, z, sx: 0.14, sy: 1.6, sz: 0.14 });
    B.add(GEO.box, '#4a3322', { x: x + (dz / L) * 0.25 * side, y: y + 1.55, z: z - (dx / L) * 0.25 * side, sx: 0.5, sy: 0.08, sz: 0.08, ry: Math.atan2(dz, -dx) });
    if (i % 2 === 0) addPumpkin(B, glows, x + (dz / L) * 0.4 * side, y + 1.0, z - (dx / L) * 0.4 * side, 0.22, Math.atan2(-dz, dx) * 0, true);
    else {
      B.add(GEO.box, '#ffcf6a', { x: x + (dz / L) * 0.45 * side, y: y + 1.3, z: z - (dx / L) * 0.45 * side, sx: 0.22, sy: 0.3, sz: 0.22 }, 'lamp');
      glows.add({ x: x + (dz / L) * 0.45 * side, y: y + 1.3, z: z - (dx / L) * 0.45 * side }, '#ffc25a', 2.2, 0.15, 0.6);
    }
  });

  // signpost at the trailhead
  const start = trailLine[2], next = trailLine[8];
  const tdx = next.x - start.x, tdz = next.z - start.z, tl = Math.hypot(tdx, tdz) || 1;
  const sx = start.x - (tdz / tl) * 3.2, sz = start.z + (tdx / tl) * 3.2, sy = heightAt(sx, sz);
  B.add(GEO.box, '#5a3d26', { x: sx, y: sy + 1.5, z: sz, sx: 0.22, sy: 3.0, sz: 0.22 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 0.12), [
    new THREE.MeshLambertMaterial({ color: '#5a3d26' }), new THREE.MeshLambertMaterial({ color: '#5a3d26' }),
    new THREE.MeshLambertMaterial({ color: '#5a3d26' }), new THREE.MeshLambertMaterial({ color: '#5a3d26' }),
    new THREE.MeshLambertMaterial({ map: textTexture(['Hares Hill', 'Halloween Emporium ➜'], { font: 'bold 50px Georgia, serif' }) }),
    new THREE.MeshLambertMaterial({ map: textTexture(['Hares Hill', 'Halloween Emporium ➜'], { font: 'bold 50px Georgia, serif' }) }),
  ]);
  sign.position.set(sx, sy + 2.5, sz);
  sign.rotation.y = Math.atan2(tdx, tdz);
  sign.castShadow = true;
  scene.add(sign);
  glows.add({ x: sx, y: sy + 3.3, z: sz }, '#ffc25a', 2.5, 0.1, 0.4);

  // footbridge where the trail crosses the creek
  let best = null;
  for (let i = 0; i < trailLine.length; i++) {
    const n = polylineDistance(trailLine[i].x, trailLine[i].z, creekLine);
    if (!best || n.d < best.d) best = { ...n, i };
  }
  const a = trailLine[Math.max(0, best.i - 5)], b = trailLine[Math.min(trailLine.length - 1, best.i + 5)];
  const mid = trailLine[best.i];
  const ang = Math.atan2(b.x - a.x, b.z - a.z);
  const ya = heightAt(a.x, a.z), yb = heightAt(b.x, b.z);
  const deckY = Math.max(ya, yb, heightAt(mid.x, mid.z) + 0.6);
  const len = Math.hypot(b.x - a.x, b.z - a.z) * 0.85;
  for (let k = -5; k <= 5; k++) {
    const t = k / 10;
    const x = mid.x + Math.sin(ang) * len * t, z = mid.z + Math.cos(ang) * len * t;
    const arch = Math.cos(t * Math.PI) * 0.35;
    B.add(GEO.box, k % 2 ? '#8a6440' : '#7c5a3a', { x, y: deckY + arch, z, ry: ang, sx: 2.6, sy: 0.16, sz: len / 11 + 0.05 });
  }
  for (const side of [-1, 1]) {
    for (let k = -5; k <= 5; k += 2) {
      const t = k / 10;
      const x = mid.x + Math.sin(ang) * len * t + Math.cos(ang) * 1.25 * side, z = mid.z + Math.cos(ang) * len * t - Math.sin(ang) * 1.25 * side;
      B.add(GEO.box, '#5a3d26', { x, y: deckY + Math.cos(t * Math.PI) * 0.35 + 0.5, z, sx: 0.14, sy: 1.0, sz: 0.14 });
    }
    const x = mid.x + Math.cos(ang) * 1.25 * side, z = mid.z - Math.sin(ang) * 1.25 * side;
    B.add(GEO.box, '#6b4a2e', { x, y: deckY + 1.15, z, ry: ang, sx: 0.12, sy: 0.12, sz: len });
  }
  return { bridge: { x: mid.x, z: mid.z, ang, len, deckY, halfW: 1.3 } };
}

// --- the haunted house ------------------------------------------------------
export function hauntHome(B, glows, scene, s, heightAt) {
  const rng = makeRng(13);
  const W = (lx, lz) => {
    const p = toWorld(s, lx, lz);
    return { ...p, y: heightAt(p.x, p.z) };
  };
  // pumpkins lining the front walk
  for (let i = 0; i < 8; i++) {
    for (const side of [-1, 1]) {
      if ((i + (side > 0 ? 1 : 0)) % 2) continue;
      const p = W(s.doorX + side * 1.3, s.D / 2 + 2.6 + i * 1.9);
      addPumpkin(B, glows, p.x, p.y, p.z, 0.3 + rng() * 0.12, s.rot, true, rng() < 0.2 ? '#7cbf3a' : '#ef7d1f');
    }
  }
  // tombstones on the lawn
  const graves = [[-5.5, 7.5], [-3.8, 9.2], [-7.4, 9.6], [-5.2, 11.3], [4.5, 8.4]];
  graves.forEach(([lx, lz]) => { const p = W(lx, s.D / 2 + lz - 2); addTombstone(B, p.x, p.y, p.z, s.rot + (rng() - 0.5) * 0.3, 1.1); });
  // funny gravestone signs
  const epitaphs = [['R.I.P.', 'Homework'], ['Here Lies', 'Broccoli'], ['Boo!', '']];
  epitaphs.forEach((lines, i) => {
    const [lx, lz] = graves[i];
    const p = W(lx, s.D / 2 + lz - 2);
    const tex = textTexture(lines, { w: 256, h: 256, bg: '#8e9196', fg: '#3a3c40', border: '#6f7276', font: 'bold 48px Georgia, serif' });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.8), new THREE.MeshLambertMaterial({ map: tex }));
    const c = Math.cos(s.rot), sn = Math.sin(s.rot);
    plate.position.set(p.x + sn * 0.1 * 1.1, p.y + 0.52 * 1.1, p.z + c * 0.1 * 1.1);
    plate.rotation.y = s.rot;
    scene.add(plate);
  });
  // purple + green string lights
  addStringLights(B, glows, s, ['#9b5cff', '#7cff6b', '#ff8a1f']);
  // black wrought-iron fence on the west side, like the real one
  for (let i = 0; i < 14; i++) {
    const p = W(-s.W / 2 - 3, -s.D / 2 + 1 + i * 1.0);
    B.add(GEO.box, '#141416', { x: p.x, y: p.y + 0.65, z: p.z, sx: 0.06, sy: 1.3, sz: 0.06 });
    B.add(GEO.cone4, '#141416', { x: p.x, y: p.y + 1.4, z: p.z, sx: 0.12, sy: 0.2, sz: 0.12 });
  }
  // "Enter if you dare" sign
  {
    const p = W(s.doorX + 3, s.D / 2 + 6);
    B.add(GEO.box, '#3a2a1c', { x: p.x, y: p.y + 0.7, z: p.z, sx: 0.12, sy: 1.4, sz: 0.12 });
    const tex = textTexture(['Enter...', 'if you dare!'], { w: 512, h: 256, bg: '#2a1a2e', fg: '#c8f04a', border: '#7a3cff', font: 'bold 64px Georgia, serif' });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: tex }));
    board.position.set(p.x, p.y + 1.55, p.z + 0.08);
    board.rotation.y = s.rot;
    board.rotation.z = 0.08;
    scene.add(board);
  }
  // black cat on the steps
  {
    const p = W(s.doorX + 0.75, s.D / 2 + 1.0);
    B.add(GEO.sphere, '#16151a', { x: p.x, y: p.y + 0.55, z: p.z, sx: 0.32, sy: 0.4, sz: 0.36 });
    B.add(GEO.sphere, '#16151a', { x: p.x, y: p.y + 0.95, z: p.z + 0.05, s: 0.28 });
    for (const sd of [-1, 1]) {
      B.add(GEO.cone4, '#16151a', { x: p.x + sd * 0.1, y: p.y + 1.16, z: p.z, sx: 0.12, sy: 0.18, sz: 0.08 });
      B.add(GEO.sphere, '#c8f04a', { x: p.x + sd * 0.07, y: p.y + 0.98, z: p.z + 0.18, sx: 0.04, sy: 0.05, sz: 0.02 }, 'lamp');
    }
  }
  // giant (friendly) spider on the roof
  {
    const p = toWorld(s, -3.2, s.D / 2 - 0.6);
    const y = s.y + s.H + 1.0;
    B.add(GEO.sphere, '#1b1520', { x: p.x, y, z: p.z, sx: 1.0, sy: 0.75, sz: 1.2 });
    B.add(GEO.sphere, '#1b1520', { x: p.x, y: y + 0.1, z: p.z + 0.9, s: 0.6 });
    for (let k = 0; k < 4; k++) for (const sd of [-1, 1]) {
      B.add(GEO.box, '#1b1520', { x: p.x + sd * 1.0, y: y + 0.2, z: p.z + (k - 1.5) * 0.45, rz: sd * -0.7, sx: 1.4, sy: 0.1, sz: 0.1 });
    }
    for (const sd of [-1, 1]) B.add(GEO.sphere, '#ff4d6d', { x: p.x + sd * 0.18, y: y + 0.2, z: p.z + 1.42, s: 0.13 }, 'lamp');
  }
  // purple glow at the front door
  glows.add({ ...W(s.doorX, s.D / 2 + 1.0), y: s.y + 1.6 }, '#9b5cff', 4.5, 0.35, 0.5);
  // window glows (purple/green) at night
  for (const [lx, ly] of [[-4.7, 1.7], [-2.9, 1.7], [1.0, 1.7], [4.1, 1.7], [-4.7, 4.4], [-2.9, 4.4], [0, 4.4], [4.1, 4.4]]) {
    const p = toWorld(s, lx, s.D / 2 + 0.7);
    glows.add({ x: p.x, y: s.y + ly, z: p.z }, rng() < 0.5 ? '#9b5cff' : '#5cff8a', 2.6, 0, 0.8);
  }

  // Animated extras: a friendly ghost above the roof + bats
  const anim = new THREE.Group();
  scene.add(anim);
  const ghost = new THREE.Group();
  const gm = new THREE.MeshLambertMaterial({ color: '#f4f6ff', emissive: '#6a6aa0', transparent: true, opacity: 0.92 });
  const gb = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), gm);
  gb.scale.set(1.1, 1.4, 1.0);
  ghost.add(gb);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.6, 16), gm);
  tail.position.y = -1.3; tail.rotation.x = Math.PI;
  ghost.add(tail);
  for (const sd of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: '#1a1a22' }));
    e.position.set(sd * 0.35, 0.35, 0.92); e.scale.y = 1.4;
    ghost.add(e);
    const arm = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), gm);
    arm.position.set(sd * 1.05, -0.2, 0.1); arm.scale.set(0.6, 1.0, 0.5);
    ghost.add(arm);
  }
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: '#1a1a22' }));
  mouth.position.set(0, -0.15, 0.95); mouth.scale.set(1, 1.3, 0.5);
  ghost.add(mouth);
  const ghostBase = toWorld(s, 2.5, 0);
  ghost.position.set(ghostBase.x, s.y + s.H + 6, ghostBase.z);
  anim.add(ghost);

  const bats = [];
  const batMat = new THREE.MeshLambertMaterial({ color: '#1b1520', side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Group();
    b.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), batMat));
    for (const sd of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 3), batMat);
      w.rotation.z = sd * Math.PI / 2;
      w.position.x = sd * 0.42;
      w.scale.z = 0.2;
      w.userData.side = sd;
      b.add(w);
    }
    anim.add(b);
    bats.push({ b, r: 5 + Math.random() * 6, h: 8 + Math.random() * 5, sp: 0.5 + Math.random() * 0.5, ph: Math.random() * 6.28 });
  }
  const center = toWorld(s, 0, 0);
  // low fog patches in the yard
  const fogTexC = document.createElement('canvas');
  fogTexC.width = fogTexC.height = 64;
  const fg = fogTexC.getContext('2d');
  const grd = fg.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(220,210,255,0.55)'); grd.addColorStop(1, 'rgba(220,210,255,0)');
  fg.fillStyle = grd; fg.fillRect(0, 0, 64, 64);
  const fogMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(fogTexC), transparent: true, depthWrite: false, opacity: 0 });
  const fogs = [];
  for (let i = 0; i < 9; i++) {
    const sp = new THREE.Sprite(fogMat);
    const p = W((rng() - 0.5) * 18, s.D / 2 + 3 + rng() * 9);
    sp.position.set(p.x, p.y + 0.6, p.z);
    sp.scale.set(7, 2.2, 1);
    anim.add(sp);
    fogs.push({ sp, base: p, ph: rng() * 6 });
  }

  return {
    update(dt, time, night) {
      ghost.position.y = s.y + s.H + 6 + Math.sin(time * 1.3) * 0.6;
      ghost.position.x = ghostBase.x + Math.sin(time * 0.4) * 2.5;
      ghost.rotation.y = s.rot + Math.sin(time * 0.7) * 0.4;
      gm.opacity = 0.55 + night * 0.4;
      for (const bt of bats) {
        const a = time * bt.sp + bt.ph;
        bt.b.position.set(center.x + Math.cos(a) * bt.r, s.y + bt.h + Math.sin(a * 2) * 0.8, center.z + Math.sin(a) * bt.r);
        bt.b.rotation.y = -a;
        bt.b.children.forEach((w) => { if (w.userData.side) w.rotation.x = Math.sin(time * 20 + bt.ph) * 0.7; });
        bt.b.visible = night > 0.15;
      }
      fogMat.opacity = 0.15 + night * 0.5;
      for (const f of fogs) f.sp.position.x = f.base.x + Math.sin(time * 0.3 + f.ph) * 1.2;
    },
  };
}

export { textTexture };
