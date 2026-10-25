import * as THREE from 'three';
import { litMat, HIGH } from './quality.js';
import { mergeVertices } from '../lib/addons/utils/BufferGeometryUtils.js';
import { makeRng, polylineDistance, pointInPolygon, fbm } from './util.js';
import { woodsPolys, roadLines, creekLine, trailLine, culDeSac, storePos } from './terrain.js';
import { toWorld } from './houses.js';
import { CHUNK } from './builder.js';

const FALL = ['#c0392b', '#e0661f', '#f0a12a', '#e9c03a', '#d4a017', '#b5541f', '#8e2f22', '#7a8f34', '#c9772b', '#a8341f'];
const STREET_FALL = ['#d4421f', '#e8762a', '#f2b233', '#c0392b', '#e0661f'];

function insideAnyPad(x, z, specs, margin) {
  for (const s of specs) {
    const dx = x - s.pad.x, dz = z - s.pad.z;
    const lx = Math.abs(dx * Math.cos(s.rot) - dz * Math.sin(s.rot));
    const lz = Math.abs(dx * Math.sin(s.rot) + dz * Math.cos(s.rot));
    if (lx < s.pad.hw + margin && lz < s.pad.hd + margin) return true;
  }
  return false;
}

function nearRoad(x, z, extra) {
  for (const r of roadLines) if (polylineDistance(x, z, r.line).d < r.width / 2 + extra) return true;
  return Math.hypot(x - culDeSac.x, z - culDeSac.z) < culDeSac.r + extra;
}


// Smooth, lumpy canopy blob: rounded (shared vertices -> soft shading), with
// clumps of leaves bulging out, darker underneath and inside like real foliage.
function leafyBlob(detail) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const clumps = fbm(x * 2.6 + 4, z * 2.6 + y * 1.7, 3);
    const k = 0.8 + clumps * 0.38;
    const yy = y < 0 ? y * 0.82 : y; // flatter underside
    p.setXYZ(i, x * k, yy * k, z * k);
    // shade: dark underside, brighter clump tips and top
    const shade = 0.62 + 0.22 * (y * 0.5 + 0.5) + 0.3 * (clumps - 0.5);
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = Math.min(1.05, Math.max(0.45, shade));
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// Pine tier: a 14-sided cone with a slightly drooping, jagged skirt.
function pineTier() {
  const g = new THREE.ConeGeometry(1, 1.6, 14, 3);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const r = Math.hypot(x, z);
    const jag = 1 + 0.12 * Math.sin(a * 7) * (r > 0.01 ? 1 : 0);
    const droop = r > 0.6 ? -0.12 * (r - 0.6) : 0;
    p.setXYZ(i, x * jag, y + droop, z * jag);
    const shade = 0.7 + 0.35 * ((y + 0.8) / 1.6);
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = shade;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

export function createTrees(specs, heightAt) {
  const rng = makeRng(7);
  const trees = [];

  // Woods: jittered grid so trees never clump on top of each other
  const SP = 6.4;
  for (const poly of woodsPolys) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of poly) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
    for (let x = minX; x < maxX; x += SP) {
      for (let z = minZ; z < maxZ; z += SP) {
        const tx = x + (rng() - 0.5) * SP * 0.9, tz = z + (rng() - 0.5) * SP * 0.9;
        if (!pointInPolygon(tx, tz, poly)) continue;
        if (polylineDistance(tx, tz, trailLine).d < 3.6) continue;
        if (polylineDistance(tx, tz, creekLine).d < 2.6) continue;
        if (Math.hypot(tx - storePos.x, tz - storePos.z) < 17) continue;
        if (nearRoad(tx, tz, 3)) continue;
        if (insideAnyPad(tx, tz, specs, 2)) continue;
        const conifer = rng() < 0.16;
        trees.push({ x: tx, z: tz, s: 1.05 + rng() * 0.45, conifer, color: FALL[(rng() * FALL.length) | 0], woods: true });
      }
    }
  }

  // Front-yard trees, like the young maple in front of the house
  for (const s of specs) {
    const r = makeRng(s.seed + 3);
    const count = s.home ? 1 : r() < 0.7 ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const lx = s.home ? -1.4 + 6.9 : (r() - 0.5) * s.W * 1.1 - s.garageSide * 2;
      const lz = s.home ? s.D / 2 + 9.2 : s.D / 2 + 6 + r() * 5;
      const p = toWorld(s, lx, lz);
      if (nearRoad(p.x, p.z, 2.5)) continue;
      trees.push({ x: p.x, z: p.z, s: 0.55 + r() * 0.2, conifer: false, color: STREET_FALL[(r() * STREET_FALL.length) | 0], woods: false });
    }
    // a few backyard trees
    if (!s.home && r() < 0.5) {
      const p = toWorld(s, (r() - 0.5) * 12, -s.D / 2 - 7 - r() * 4);
      if (!nearRoad(p.x, p.z, 4) && !insideAnyPad(p.x, p.z, specs, 1)) trees.push({ x: p.x, z: p.z, s: 0.75 + r() * 0.3, conifer: r() < 0.3, color: FALL[(r() * FALL.length) | 0], woods: false });
    }
  }
  // Cul-de-sac island tree
  trees.push({ x: culDeSac.x, z: culDeSac.z, s: 0.6, conifer: false, color: '#d4421f', woods: false });

  // --- instanced meshes, one set per map chunk so off-screen woods are skipped ---
  const blobsPer = 3;
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 1, HIGH ? 9 : 6);
  trunkGeo.translate(0, 0.5, 0);
  const trunkMat = litMat({ color: '#5a3d2b', ...(HIGH ? { roughness: 0.95 } : {}) });
  // woods canopies are many and mostly further away; yard trees get the extra detail
  const blobGeo = HIGH ? leafyBlob(2) : new THREE.IcosahedronGeometry(1, 1);
  const yardGeo = HIGH ? leafyBlob(3) : blobGeo;
  if (!HIGH) {
    // squash vertices a touch so canopies feel hand-made
    const bp = blobGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const n = fbm(bp.getX(i) * 2 + 4, bp.getZ(i) * 2 + bp.getY(i), 2);
      const k = 0.86 + n * 0.3;
      bp.setXYZ(i, bp.getX(i) * k, bp.getY(i) * k, bp.getZ(i) * k);
    }
    blobGeo.computeVertexNormals();
  }
  const blobMat = litMat({ color: '#ffffff', vertexColors: HIGH });
  const coneGeo = HIGH ? pineTier() : new THREE.ConeGeometry(1, 1.6, 7);
  const coneMat = litMat({ color: '#ffffff', vertexColors: HIGH });

  const chunks = new Map();
  for (const t of trees) {
    const key = `${Math.floor(t.x / CHUNK)},${Math.floor(t.z / CHUNK)}`;
    if (!chunks.has(key)) chunks.set(key, []);
    chunks.get(key).push(t);
  }

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const col = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  const group = new THREE.Group();
  for (const list of chunks.values()) {
    const nDec = list.filter((t) => !t.conifer).length;
    const nCon = list.length - nDec;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, list.length);
    const nYard = list.filter((t) => !t.conifer && !t.woods).length;
    const blobs = nDec - nYard ? new THREE.InstancedMesh(blobGeo, blobMat, (nDec - nYard) * blobsPer) : null;
    const yard = nYard ? new THREE.InstancedMesh(yardGeo, blobMat, nYard * blobsPer) : null;
    let yi = 0;
    const cones = nCon ? new THREE.InstancedMesh(coneGeo, coneMat, nCon * 3) : null;
    let ti = 0, bi = 0, ci = 0;
    for (const t of list) {
      const y = heightAt(t.x, t.z);
      t.y = y;
      const trunkH = (t.conifer ? 2.2 : t.woods ? 4.2 : 2.6) * t.s;
      q.setFromAxisAngle(up, rng() * Math.PI * 2);
      m.compose(v.set(t.x, y - 0.2, t.z), q, sc.set(t.s * (t.woods ? 1.1 : 0.8), trunkH + 0.2, t.s * (t.woods ? 1.1 : 0.8)));
      trunks.setMatrixAt(ti++, m);
      if (t.conifer) {
        for (let k = 0; k < 3; k++) {
          const r = (2.4 - k * 0.65) * t.s;
          m.compose(v.set(t.x, y + trunkH + k * 1.25 * t.s, t.z), q, sc.set(r, t.s * 1.3, r));
          cones.setMatrixAt(ci, m);
          cones.setColorAt(ci++, col.set(k === 2 ? '#3f6a3a' : '#2f5634').offsetHSL(0, 0, (rng() - 0.5) * 0.06));
        }
      } else {
        const base = new THREE.Color(t.color);
        for (let k = 0; k < blobsPer; k++) {
          const a = rng() * Math.PI * 2;
          const off = k === 0 ? 0 : 1.1 * t.s;
          const r = (k === 0 ? 2.5 : 1.9 + rng() * 0.4) * t.s * (t.woods ? 1.15 : 1);
          m.compose(
            v.set(t.x + Math.cos(a) * off, y + trunkH + r * 0.55 + (k === 0 ? 0.4 : rng() * 1.2) * t.s, t.z + Math.sin(a) * off),
            q,
            sc.set(r, r * 0.85, r),
          );
          col.copy(base).offsetHSL((rng() - 0.5) * 0.03, 0, (rng() - 0.5) * 0.1);
          if (t.woods) { blobs.setMatrixAt(bi, m); blobs.setColorAt(bi++, col); } else { yard.setMatrixAt(yi, m); yard.setColorAt(yi++, col); }
        }
      }
    }
    for (const im of [trunks, blobs, yard, cones]) {
      if (!im) continue;
      im.castShadow = true;
      im.receiveShadow = true;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      group.add(im);
    }
  }
  return { group, trees };
}

// Leaves drifting down around the player.
export function createFallingLeaves(count = 260) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(32, 4);
  g.quadraticCurveTo(60, 26, 32, 60);
  g.quadraticCurveTo(4, 26, 32, 4);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const pos = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const vel = [];
  const col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 60;
    pos[i * 3 + 1] = Math.random() * 14;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
    col.set(FALL[(Math.random() * FALL.length) | 0]);
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    vel.push({ fall: 0.7 + Math.random() * 0.8, sway: Math.random() * 6.28, sp: 0.6 + Math.random() });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ size: 0.42, map: tex, vertexColors: true, transparent: true, alphaTest: 0.4, depthWrite: true });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  function update(dt, center, groundAt, time) {
    for (let i = 0; i < count; i++) {
      const v = vel[i];
      let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      y -= v.fall * dt;
      x += Math.sin(time * v.sp + v.sway) * dt * 0.9 + dt * 0.35;
      z += Math.cos(time * v.sp * 0.7 + v.sway) * dt * 0.6;
      const g = groundAt(x, z);
      if (y < g || Math.abs(x - center.x) > 32 || Math.abs(z - center.z) > 32) {
        x = center.x + (Math.random() - 0.5) * 60;
        z = center.z + (Math.random() - 0.5) * 60;
        y = groundAt(x, z) + 6 + Math.random() * 10;
      }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    }
    geo.attributes.position.needsUpdate = true;
  }
  return { points, update };
}
