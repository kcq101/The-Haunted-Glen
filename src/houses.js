import * as THREE from 'three';
import { HOUSES, FACING_ANGLE, px } from './config.js';
import { makeRng, hashString } from './util.js';
import { GEO, addGableRoof } from './builder.js';
import { roadLines } from './terrain.js';
import { polylineDistance } from './util.js';

const SIDING = ['#efede6', '#d9d6cc', '#c9c0ad', '#a9b3a0', '#8e9aa6', '#d8cfbd', '#b9b2a2', '#e4e0d5', '#7f8b84'];
const ROOFS = ['#3d4146', '#4a4744', '#55524f', '#34383d', '#5b544c'];
const DOORS = ['#1f2326', '#7a2222', '#243a5e', '#5c3b24', '#2f4a3a'];
const STONE = ['#a08f7c', '#9b8a76', '#b4a28c', '#8d7f70'];
const TRIM = '#f4f3ee';

// Turn local house coordinates (front faces +z) into world coordinates.
function toWorld(spec, lx, lz) {
  const c = Math.cos(spec.rot), s = Math.sin(spec.rot);
  return { x: spec.x + lx * c + lz * s, z: spec.z - lx * s + lz * c };
}

function nearestRoad(p) {
  let best = null;
  for (const r of roadLines) {
    if (r.name === 'Snyder Ave' || r.name === 'Crossover Blvd') continue;
    const n = polylineDistance(p.x, p.z, r.line);
    if (!best || n.d < best.d) best = { ...n, width: r.width };
  }
  return best;
}

export function makeHouseSpecs() {
  return HOUSES.map((h) => {
    const rng = makeRng(hashString(h.id));
    const pos = px(h.x, h.y);
    const spec = {
      id: h.id,
      home: !!h.home,
      x: pos.x,
      z: pos.z,
      rot: FACING_ANGLE[h.facing],
      W: 10.5 + rng() * 2,
      D: 8.6 + rng() * 1.4,
      H: 5.8 + rng() * 0.6,
      siding: SIDING[(rng() * SIDING.length) | 0],
      roof: ROOFS[(rng() * ROOFS.length) | 0],
      door: DOORS[(rng() * DOORS.length) | 0],
      stone: rng() < 0.6 ? STONE[(rng() * STONE.length) | 0] : null,
      frontGable: rng() < 0.7,
      porch: rng() < 0.35,
      chimney: rng() < 0.35,
      garageSide: rng() < 0.5 ? -1 : 1,
      shutters: rng() < 0.75,
      shutterColor: rng() < 0.6 ? '#2a2d30' : ['#3b4a5e', '#4b3a2e', '#5a2a2a'][(rng() * 3) | 0],
      seed: hashString(h.id),
    };
    if (h.garage) spec.garageSide = h.garage;
    if (spec.home) {
      // Modeled on the street view: white siding, stone center bay with a
      // front gable, a 1.5-story wing on the right, black shutters, dark roof.
      Object.assign(spec, {
        W: 12.6, D: 9.6, H: 6.2, siding: '#f2f1ec', roof: '#3a3e43', door: '#24282b',
        stone: '#a8937a', frontGable: true, porch: false, chimney: false, garageSide: 1,
        shutters: true, shutterColor: '#2a2d30',
      });
    }
    // Garage / wing
    spec.gw = spec.home ? 6.6 : 6.8;
    spec.gd = spec.home ? 8.2 : 7.6;
    spec.gh = spec.home ? 3.9 : 3.3;
    spec.gx = spec.garageSide * (spec.W / 2 + spec.gw / 2 - 0.05);
    spec.gz = spec.home ? -0.4 : spec.D / 2 - spec.gd / 2 + 0.7;
    spec.doorX = spec.home ? -0.2 : spec.frontGable ? 0 : -spec.garageSide * spec.W * 0.18;

    // Door point used for trick-or-treat / entering
    spec.doorWorld = toWorld(spec, spec.doorX, spec.D / 2 + 1.6);
    spec.doorLocal = { x: spec.doorX, z: spec.D / 2 };

    // Pad, driveway and front walk for the ground painter
    const padCenter = toWorld(spec, spec.garageSide * spec.gw / 2, 0);
    spec.pad = { x: padCenter.x, z: padCenter.z, rot: spec.rot, hw: (spec.W + spec.gw) / 2 + 1.2, hd: spec.D / 2 + 1.6 };

    const garageFront = spec.home
      ? toWorld(spec, spec.gx + spec.garageSide * (spec.gw / 2 + 1.6), spec.D / 2 - 2)
      : toWorld(spec, spec.gx, spec.gz + spec.gd / 2 + 0.2);
    const road = nearestRoad(garageFront);
    spec.driveway = { a: garageFront, b: { x: road.x, z: road.z }, width: spec.home ? 4.4 : 5.4 };
    if (spec.home) {
      // the real driveway runs up the right side to a side-load garage
      spec.driveway.a = toWorld(spec, spec.gx + spec.garageSide * (spec.gw / 2 + 2.2), -spec.D / 2);
      spec.driveway.mid = toWorld(spec, spec.gx + spec.garageSide * (spec.gw / 2 + 2.2), spec.D / 2 + 2);
    }
    const doorPt = toWorld(spec, spec.doorX, spec.D / 2 + 0.6);
    const roadDoor = nearestRoad(doorPt);
    const dx = doorPt.x - roadDoor.x, dz = doorPt.z - roadDoor.z;
    const dl = Math.hypot(dx, dz) || 1;
    const off = roadDoor.width / 2 + 2.6;
    spec.walk = { a: doorPt, b: { x: roadDoor.x + (dx / dl) * off, z: roadDoor.z + (dz / dl) * off }, width: 1.5, color: spec.home ? '#9d9488' : '#aaa59c' };
    return spec;
  });
}

export function groundMarks(specs) {
  const driveways = [], walkways = [];
  for (const s of specs) {
    if (s.driveway.mid) {
      driveways.push({ a: s.driveway.a, b: s.driveway.mid, width: s.driveway.width });
      driveways.push({ a: s.driveway.mid, b: s.driveway.b, width: s.driveway.width });
    } else driveways.push(s.driveway);
    walkways.push(s.walk);
  }
  return { driveways, walkways };
}

// Build every house into the shared builder. Returns collision boxes.
export function buildHouses(B, specs, heightAt) {
  const colliders = [];
  for (const s of specs) {
    const y = s.pad.h ?? heightAt(s.x, s.z);
    s.y = y;
    const M = new THREE.Matrix4().compose(
      new THREE.Vector3(s.x, y, s.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s.rot, 0)),
      new THREE.Vector3(1, 1, 1),
    );
    buildOne(B, s, M);
    const main = toWorld(s, 0, 0);
    colliders.push({ x: main.x, z: main.z, hw: s.W / 2 + 0.2, hd: s.D / 2 + 0.2, rot: s.rot });
    const g = toWorld(s, s.gx, s.gz);
    colliders.push({ x: g.x, z: g.z, hw: s.gw / 2 + 0.2, hd: s.gd / 2 + 0.2, rot: s.rot });
  }
  return colliders;
}

function addWindow(B, M, x, y, z, w, h, opts = {}) {
  const { ry = 0, shutters = null, haunted = false, shutterTilt = 0 } = opts;
  const P = (lx, ly, lz, extra = {}) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    return { x: x + lx * c + lz * s, y: y + ly, z: z - lx * s + lz * c, ry, ...extra };
  };
  B.add(GEO.box, TRIM, { ...P(0, 0, -0.02), sx: w + 0.24, sy: h + 0.24, sz: 0.1 }, 'solid', M);
  B.add(GEO.box, haunted ? '#c58bff' : '#ffffff', { ...P(0, 0, 0.04), sx: w, sy: h, sz: 0.06 }, 'window', M);
  // mullions
  B.add(GEO.box, TRIM, { ...P(0, 0, 0.09), sx: 0.07, sy: h, sz: 0.04 }, 'solid', M);
  B.add(GEO.box, TRIM, { ...P(0, h * 0.05, 0.09), sx: w, sy: 0.07, sz: 0.04 }, 'solid', M);
  if (shutters) {
    for (const side of [-1, 1]) {
      B.add(GEO.box, shutters, { ...P(side * (w / 2 + 0.36), 0, 0.02, { rz: side * shutterTilt }), sx: 0.42, sy: h + 0.15, sz: 0.06 }, 'solid', M);
    }
  }
}

function buildOne(B, s, M) {
  const { W, D, H } = s;
  const haunted = s.home;
  const rng = makeRng(s.seed + 7);
  const tilt = () => (haunted ? (rng() - 0.5) * 0.35 : 0);

  // foundation hides small slopes
  B.add(GEO.box, '#8c877d', { y: -0.6, sx: W + 0.3, sy: 1.6, sz: D + 0.3 }, 'solid', M);
  B.add(GEO.box, '#8c877d', { x: s.gx, y: -0.6, z: s.gz, sx: s.gw + 0.3, sy: 1.6, sz: s.gd + 0.3 }, 'solid', M);

  // main body
  B.add(GEO.box, s.siding, { y: H / 2, sx: W, sy: H, sz: D }, 'solid', M);
  addGableRoof(B, { w: W, d: D, h: 3.3, roofColor: s.roof, wallColor: s.siding, parent: M, y: H });
  // band between floors
  B.add(GEO.box, TRIM, { y: H / 2 + 0.1, z: 0, sx: W + 0.08, sy: 0.18, sz: D + 0.08 }, 'solid', M);

  // stone veneer (center bay for gabled fronts, lower story otherwise)
  const bayW = s.home ? 4.6 : 4.2;
  if (s.stone) {
    if (s.frontGable) B.add(GEO.box, s.stone, { y: H / 2, z: D / 2 + 0.25, sx: bayW, sy: H, sz: 0.5 }, 'solid', M);
    else B.add(GEO.box, s.stone, { y: 0.9, z: D / 2 + 0.08, sx: W + 0.02, sy: 1.8, sz: 0.18 }, 'solid', M);
  }
  // front cross gable
  if (s.frontGable) {
    const gz = D / 2 + (s.stone ? 0.5 : 0.1);
    addGableRoof(B, {
      w: 3.0, d: bayW + 0.2, h: 2.6, roofColor: s.roof, wallColor: s.stone && !s.home ? s.siding : s.siding,
      parent: M, x: 0, y: H, z: gz - 1.5, ry: Math.PI / 2,
    });
    addWindow(B, M, 0, H + 0.95, gz - 0.02 + 0.06, 0.7, 0.85, { shutters: s.shutters ? s.shutterColor : null, haunted });
  }
  // metal accent roof over first floor of the bay (like the real house)
  if (s.home) B.add(GEO.box, '#2e3236', { y: H / 2 + 0.25, z: D / 2 + 0.75, rx: 0.5, sx: bayW + 0.3, sy: 0.12, sz: 0.9 }, 'solid', M);

  // door + steps + light
  const dz = D / 2 + (s.frontGable && s.stone ? 0.5 : 0.05);
  B.add(GEO.box, TRIM, { x: s.doorX, y: 1.25, z: dz + 0.02, sx: 1.7, sy: 2.6, sz: 0.1 }, 'solid', M);
  B.add(GEO.box, s.door, { x: s.doorX, y: 1.15, z: dz + 0.07, sx: 1.05, sy: 2.25, sz: 0.08 }, 'solid', M);
  B.add(GEO.box, '#ffd27a', { x: s.doorX + 0.32, y: 1.12, z: dz + 0.13, sx: 0.08, sy: 0.08, sz: 0.06 }, 'solid', M);
  // sidelights
  for (const side of [-1, 1]) B.add(GEO.box, '#ffffff', { x: s.doorX + side * 0.68, y: 1.25, z: dz + 0.06, sx: 0.22, sy: 1.9, sz: 0.04 }, 'window', M);
  B.add(GEO.box, '#bdb8ae', { x: s.doorX, y: 0.12, z: dz + 0.7, sx: 2.2, sy: 0.3, sz: 1.3 }, 'solid', M);
  B.add(GEO.box, '#bdb8ae', { x: s.doorX, y: -0.05, z: dz + 1.4, sx: 2.0, sy: 0.25, sz: 0.9 }, 'solid', M);
  // little canopy over the door
  if (!s.porch) B.add(GEO.box, s.home ? '#2e3236' : s.roof, { x: s.doorX, y: 2.75, z: dz + 0.55, rx: 0.35, sx: 2.2, sy: 0.12, sz: 1.2 }, 'solid', M);
  // porch lights
  for (const side of [-1, 1]) B.add(GEO.box, '#fff1b8', { x: s.doorX + side * 1.05, y: 1.9, z: dz + 0.16, sx: 0.18, sy: 0.32, sz: 0.14 }, 'lamp', M);

  // full front porch
  if (s.porch) {
    const pw = W * 0.7;
    B.add(GEO.box, '#bdb8ae', { x: 0, y: 0.2, z: D / 2 + 1.3, sx: pw, sy: 0.4, sz: 2.6 }, 'solid', M);
    for (const t of [-0.5, -0.17, 0.17, 0.5]) B.add(GEO.box, TRIM, { x: t * pw, y: 1.6, z: D / 2 + 2.4, sx: 0.22, sy: 2.6, sz: 0.22 }, 'solid', M);
    B.add(GEO.box, s.roof, { x: 0, y: 3.05, z: D / 2 + 1.5, rx: 0.22, sx: pw + 0.5, sy: 0.16, sz: 3.2 }, 'solid', M);
  }

  // windows across the front
  const cols = s.home ? [-4.7, -2.9, 1.0, 4.1] : [-W * 0.36, -W * 0.16, W * 0.16, W * 0.36];
  for (const row of [1.7, 4.4]) {
    for (const cx of cols) {
      if (Math.abs(cx - s.doorX) < 1.3 && row < 3) continue;
      const inBay = s.frontGable && Math.abs(cx) < bayW / 2;
      addWindow(B, M, cx, row, D / 2 + (inBay && s.stone ? 0.5 : 0) + 0.02, 1.15, 1.55, { shutters: s.shutters ? s.shutterColor : null, haunted, shutterTilt: tilt() });
    }
  }
  if (s.home) addWindow(B, M, 0.0, 4.4, D / 2 + 0.52, 1.05, 1.45, { shutters: s.shutterColor, haunted, shutterTilt: tilt() });
  // side + back windows
  for (const side of [-1, 1]) {
    if (side === s.garageSide) continue;
    for (const lz of [-D * 0.22, D * 0.22]) {
      for (const row of [1.7, 4.4]) addWindow(B, M, side * (W / 2 + 0.02), row, lz, 1.0, 1.4, { ry: side * Math.PI / 2, haunted });
    }
  }
  for (const cx of [-W * 0.3, 0, W * 0.3]) {
    for (const row of [1.7, 4.4]) addWindow(B, M, cx, row, -D / 2 - 0.02, 1.1, 1.45, { ry: Math.PI, haunted });
  }

  // chimney
  if (s.chimney) B.add(GEO.box, s.stone || '#8f5a46', { x: -s.garageSide * (W / 2 - 1.2), y: H + 2.4, z: -0.8, sx: 1.2, sy: 4.8, sz: 1.2 }, 'solid', M);

  // garage / wing
  B.add(GEO.box, s.siding, { x: s.gx, y: s.gh / 2, z: s.gz, sx: s.gw, sy: s.gh, sz: s.gd }, 'solid', M);
  if (s.home) {
    // 1.5-story wing with its own front gable, like the real house
    addGableRoof(B, { w: s.gd, d: s.gw, h: 3.4, roofColor: s.roof, wallColor: s.siding, parent: M, x: s.gx, y: s.gh, z: s.gz, ry: Math.PI / 2 });
    addWindow(B, M, s.gx, 1.8, s.gz + s.gd / 2 + 0.02, 1.3, 1.8, { shutters: s.shutterColor, haunted, shutterTilt: tilt() });
    addWindow(B, M, s.gx, s.gh + 1.1, s.gz + s.gd / 2 + 0.02, 0.75, 0.9, { shutters: s.shutterColor, haunted });
    B.add(GEO.box, s.stone, { x: s.gx, y: 0.35, z: s.gz + s.gd / 2 + 0.06, sx: s.gw, sy: 0.7, sz: 0.14 }, 'solid', M);
    // side-load garage doors on the far side
    const sx = s.gx + s.garageSide * (s.gw / 2 + 0.04);
    for (const lz of [-2.0, 1.2]) B.add(GEO.box, '#ecebe6', { x: sx, y: 1.15, z: s.gz + lz, ry: Math.PI / 2, sx: 2.6, sy: 2.3, sz: 0.08 }, 'solid', M);
  } else {
    addGableRoof(B, { w: s.gw, d: s.gd, h: 2.2, roofColor: s.roof, wallColor: s.siding, parent: M, x: s.gx, y: s.gh, z: s.gz });
    const gzF = s.gz + s.gd / 2 + 0.04;
    const two = rng() < 0.5;
    const doorsX = two ? [s.gx - 1.55, s.gx + 1.55] : [s.gx];
    for (const gx of doorsX) {
      B.add(GEO.box, '#f0eee8', { x: gx, y: 1.15, z: gzF, sx: two ? 2.6 : 5.2, sy: 2.3, sz: 0.08 }, 'solid', M);
      for (let k = 0; k < 3; k++) B.add(GEO.box, '#cfcbc2', { x: gx, y: 0.5 + k * 0.6, z: gzF + 0.05, sx: two ? 2.5 : 5.1, sy: 0.05, sz: 0.03 }, 'solid', M);
    }
  }
  // shrubs along the front
  const shrubCols = ['#3f6b35', '#4b7a3b', '#6a8a3a', '#9b6a2a', '#a04428'];
  for (let i = 0; i < 6; i++) {
    const t = -W / 2 + 0.8 + (i / 5) * (W - 1.6);
    if (Math.abs(t - s.doorX) < 1.4) continue;
    const r = 0.7 + rng() * 0.35;
    B.add(GEO.sphereLo, shrubCols[(rng() * shrubCols.length) | 0], { x: t, y: r * 0.55, z: D / 2 + 0.95 + (s.frontGable && s.stone && Math.abs(t) < bayW / 2 ? 0.5 : 0), sx: r * 1.6, sy: r * 1.2, sz: r * 1.3 }, 'solid', M);
  }
}

export { toWorld };
