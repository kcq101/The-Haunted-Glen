import * as THREE from 'three';
import { litMat, HIGH, q } from './quality.js';
import { mergeGeometries, mergeVertices } from '../lib/addons/utils/BufferGeometryUtils.js';
import { TERRAIN_RECT as R, roadLines, woodsPolys } from './terrain.js';
import { fbm, noise2, smoothstep, clamp, makeRng, pointInPolygon } from './util.js';

// ---------------------------------------------------------------------------
// The world beyond the neighborhood: what you see on the horizon, especially
// looking south down the hill.
//
//  1. Countryside: a ring of land around the playable ground that keeps the
//     slope going (down into the valley to the south, up to the north), painted
//     in the shader as Chester County farm fields with hedgerows and woodlots.
//  2. Trees on that land (instanced, low detail, a few draw calls).
//  3. A few farmsteads (red barn, silo, farmhouse) and the two cross streets
//     running off into the distance.
//  4. Layered hazy ridges on the horizon that move with the camera like the
//     sky, plus tiny warm house lights on the hills at night.
// ---------------------------------------------------------------------------

// What a lit, fogged surface of color c ends up as on screen: ACES filmic
// tone mapping (as set in main.js) then sRGB. Used to match the sky dome,
// which skips both.
const EXPOSURE = 1.05;
function displayColor(c) {
  const k = EXPOSURE / 0.6;
  const r = c.r * k, g = c.g * k, b = c.b * k;
  const ir = 0.59719 * r + 0.35458 * g + 0.04823 * b;
  const ig = 0.076 * r + 0.90834 * g + 0.01566 * b;
  const ib = 0.0284 * r + 0.13383 * g + 0.83777 * b;
  const fit = (v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
  const fr = fit(ir), fg = fit(ig), fb = fit(ib);
  const o = (x) => clamp(x, 0, 1);
  c.r = o(1.60475 * fr - 0.53108 * fg - 0.07367 * fb);
  c.g = o(-0.10208 * fr + 1.10813 * fg - 0.00605 * fb);
  c.b = o(-0.00327 * fr - 0.07276 * fg + 1.07602 * fb);
  const enc = (x) => (x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
  c.r = enc(c.r); c.g = enc(c.g); c.b = enc(c.b);
  return c;
}

const CX = (R.x0 + R.x1) / 2, CZ = (R.z0 + R.z1) / 2;
const RINGS = [0, 3, 8, 15, 24, 36, 50, 66, 86, 110, 140, 176, 220];
const TREE_MAX_D = 150;

// Farm fields: rotated rectangles in staggered rows (kept identical in JS and
// GLSL so hedgerow trees line up with the painted hedgerows).
const FIELD_A = 0.38, FIELD_W = 34, FIELD_H = 24;

// How far a point is outside the playable ground
function outside(x, z) {
  const dx = Math.max(R.x0 - x, 0, x - R.x1);
  const dz = Math.max(R.z0 - z, 0, z - R.z1);
  return Math.hypot(dx, dz);
}
const clampX = (x) => clamp(x, R.x0, R.x1);
const clampZ = (z) => clamp(z, R.z0, R.z1);

function hedgeDist(x, z) {
  const c = Math.cos(FIELD_A), s = Math.sin(FIELD_A);
  let qx = c * x + s * z;
  const qz = -s * x + c * z;
  const row = Math.floor(qz / FIELD_H);
  qx += (((row % 3) + 3) % 3) * 13;
  const fx = qx / FIELD_W - Math.floor(qx / FIELD_W), fz = qz / FIELD_H - Math.floor(qz / FIELD_H);
  return Math.min(Math.min(fx, 1 - fx) * FIELD_W, Math.min(fz, 1 - fz) * FIELD_H);
}

export function createBackdrop(scene, terrain, pixelRatio = 1) {
  const { heightAt, groundCanvas } = terrain;
  const rng = makeRng(1031);
  const group = new THREE.Group();
  group.name = 'backdrop';

  // --- shape of the land ---------------------------------------------------
  // Starts exactly at the edge of the playable ground and smoothly takes over:
  // falls away into the valley to the south, rises gently to the north.
  // Ground height all the way around the edge, 1 unit apart (heightAt is
  // too slow to call thousands of times while building)
  const EW = R.x1 - R.x0, ED = R.z1 - R.z0, PER = 2 * (EW + ED);
  const edgeTab = new Float32Array(Math.ceil(PER) + 2);
  const perimPoint = (t) => {
    t = ((t % PER) + PER) % PER;
    if (t < EW) return [R.x0 + t, R.z0];
    if ((t -= EW) < ED) return [R.x1, R.z0 + t];
    if ((t -= ED) < EW) return [R.x1 - t, R.z1];
    return [R.x0, R.z1 - (t - EW)];
  };
  for (let i = 0; i < edgeTab.length; i++) { const [x, z] = perimPoint(i); edgeTab[i] = heightAt(x, z); }
  const EPS = 1e-4;
  const edgeH = (x, z) => {
    let t;
    if (Math.abs(z - R.z0) < EPS) t = x - R.x0;
    else if (Math.abs(x - R.x1) < EPS) t = EW + (z - R.z0);
    else if (Math.abs(z - R.z1) < EPS) t = EW + ED + (R.x1 - x);
    else if (Math.abs(x - R.x0) < EPS) t = 2 * EW + ED + (R.z1 - z);
    else return heightAt(x, z); // inside (only happens near the corners)
    t = clamp(t, 0, PER);
    const i = Math.floor(t), f = t - i;
    return edgeTab[i] * (1 - f) + edgeTab[Math.min(i + 1, edgeTab.length - 1)] * f;
  };
  const landHeight = (x, z) => {
    const d = outside(x, z);
    const r = Math.min(d * 0.6, 40); // blur the edge profile further out
    let e = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) e += edgeH(clampX(x + i * r), clampZ(z + j * r));
    e /= 9;
    const ux = x - CX, uz = z - CZ, L = Math.hypot(ux, uz) || 1;
    const south = smoothstep(0.1, 0.8, uz / L), north = smoothstep(0.1, 0.8, -uz / L);
    let h = e - 0.06;
    // keep going down the hill into the valley to the south
    h -= 13 * south * smoothstep(15, 150, d);
    h += smoothstep(0, 150, d) * (5 * north - 3 * (1 - south - north));
    h += (fbm(x * 0.007 + 31, z * 0.007 + 17, 3) - 0.5) * 10 * smoothstep(30, 130, d);
    h += (noise2(x * 0.05, z * 0.05) - 0.5) * 1.6 * smoothstep(4, 30, d);
    h -= 14 * smoothstep(160, 220, d); // tuck the far rim under the horizon hills
    return h;
  };

  const woodsAt = (x, z) => woodsPolys.some((p) => pointInPolygon(x, z, p));
  const forestAt = (x, z, d) => {
    const edgeWoods = woodsAt(clamp(x, R.x0 + 3, R.x1 - 3), clamp(z, R.z0 + 3, R.z1 - 3))
      ? 1 - smoothstep(25, 70, d + (noise2(x * 0.04, z * 0.04) - 0.5) * 30) : 0;
    const lots = smoothstep(0.56, 0.66, fbm(x * 0.011 + 5, z * 0.011 + 9, 3));
    const farHills = smoothstep(130, 200, d) * 0.7;
    return Math.max(edgeWoods, lots, farHills);
  };

  // Color of the painted ground right at the edge, so the seam disappears
  let img = null;
  try { img = groundCanvas.getContext('2d').getImageData(0, 0, groundCanvas.width, groundCanvas.height); } catch { /* ignore */ }
  const tmpC = new THREE.Color();
  const edgeColor = (x, z) => {
    if (!img) return tmpC.set('#6f9c43');
    const u = (clampX(x) - R.x0) / (R.x1 - R.x0), v = (clampZ(z) - R.z0) / (R.z1 - R.z0);
    const px = Math.round(u * (img.width - 1)), py = Math.round(v * (img.height - 1));
    let r = 0, g = 0, b = 0, n = 0;
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
      const xx = clamp(px + i * 2, 0, img.width - 1), yy = clamp(py + j * 2, 0, img.height - 1);
      const k = (yy * img.width + xx) * 4;
      r += img.data[k]; g += img.data[k + 1]; b += img.data[k + 2]; n++;
    }
    return tmpC.setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
  };

  // --- 1. countryside ring ---------------------------------------------------
  // Points around the edge (corners included), then rings pushed outward.
  const perim = [];
  const sideN = q(1 / 4.2, 1 / 5.5); // samples per unit of edge
  const corners = [[R.x0, R.z0], [R.x1, R.z0], [R.x1, R.z1], [R.x0, R.z1]];
  for (let c = 0; c < 4; c++) {
    const [ax, az] = corners[c], [bx, bz] = corners[(c + 1) % 4];
    const n = Math.max(4, Math.round(Math.hypot(bx - ax, bz - az) * sideN));
    for (let i = 0; i < n; i++) perim.push({ x: ax + ((bx - ax) * i) / n, z: az + ((bz - az) * i) / n });
  }
  const M = perim.length, K = RINGS.length;
  const pos = new Float32Array(M * K * 3), misc = new Float32Array(M * K * 2), ecol = new Float32Array(M * K * 3);
  for (let k = 0; k < K; k++) {
    for (let i = 0; i < M; i++) {
      const p0 = perim[i];
      const ux = p0.x - CX, uz = p0.z - CZ, L = Math.hypot(ux, uz);
      const x = p0.x + (ux / L) * RINGS[k], z = p0.z + (uz / L) * RINGS[k];
      const v = k * M + i, d = outside(x, z);
      pos[v * 3] = x; pos[v * 3 + 1] = landHeight(x, z); pos[v * 3 + 2] = z;
      misc[v * 2] = forestAt(x, z, d); misc[v * 2 + 1] = d;
      const ec = edgeColor(x, z);
      ecol[v * 3] = ec.r; ecol[v * 3 + 1] = ec.g; ecol[v * 3 + 2] = ec.b;
    }
  }
  const landGeo = new THREE.BufferGeometry();
  landGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  landGeo.setAttribute('aMisc', new THREE.BufferAttribute(misc, 2));
  landGeo.setAttribute('aEdge', new THREE.BufferAttribute(ecol, 3));
  // winding: the perimeter runs clockwise seen from above, so this faces up
  const quad = (idx, k, i) => {
    const a = k * M + i, b = k * M + ((i + 1) % M), c = a + M, d = b + M;
    idx.push(a, b, c, b, d, c);
  };
  const all = [];
  for (let k = 0; k < K - 1; k++) for (let i = 0; i < M; i++) quad(all, k, i);
  landGeo.setIndex(all);
  landGeo.computeVertexNormals();
  if (landGeo.attributes.normal.getY(M * 3) < 0) { // safety: flip if built upside down
    const ix = landGeo.index.array;
    for (let t = 0; t < ix.length; t += 3) { const s = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = s; }
    landGeo.computeVertexNormals();
  }

  const landMat = litMat({ color: '#ffffff' });
  landMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aMisc; attribute vec3 aEdge; varying vec2 vMisc; varying vec3 vEdgeCol; varying vec3 vLandW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vMisc = aMisc; vEdgeCol = aEdge; vLandW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vMisc; varying vec3 vEdgeCol; varying vec3 vLandW;
float bdHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float bdNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bdHash(i), bdHash(i + vec2(1.0, 0.0)), f.x), mix(bdHash(i + vec2(0.0, 1.0)), bdHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec3 landColor() {
  vec2 p = vLandW.xz;
  float ca = cos(${FIELD_A.toFixed(4)}), sa = sin(${FIELD_A.toFixed(4)});
  vec2 qq = vec2(ca * p.x + sa * p.y, -sa * p.x + ca * p.y);
  vec2 size = vec2(${FIELD_W.toFixed(1)}, ${FIELD_H.toFixed(1)});
  float row = floor(qq.y / size.y);
  qq.x += mod(row, 3.0) * 13.0;
  vec2 cell = floor(qq / size), f = fract(qq / size);
  float h = bdHash(cell + 17.0);
  // pasture, meadow, golden stubble, plowed, straw
  vec3 c = h < 0.3 ? vec3(0.15, 0.29, 0.06) : h < 0.5 ? vec3(0.23, 0.36, 0.08) : h < 0.7 ? vec3(0.52, 0.36, 0.07) : h < 0.85 ? vec3(0.24, 0.14, 0.06) : vec3(0.45, 0.32, 0.11);
  if (h >= 0.5) c *= 0.92 + 0.08 * sin(qq.x * 2.2); // crop rows
  c *= 0.84 + 0.3 * bdNoise(p * 0.05);
  vec2 e = min(f, 1.0 - f) * size;
  float hedge = 1.0 - smoothstep(0.8, 2.4, min(e.x, e.y));
  vec3 hc = mix(vec3(0.07, 0.08, 0.02), vec3(0.32, 0.09, 0.02), bdNoise(p * 0.3));
  c = mix(c, hc, hedge * 0.85);
  // woods: mottled fall canopy
  float n1 = bdNoise(p * 0.12), n2 = bdNoise(p * 0.07 + 9.0);
  vec3 fc = mix(vec3(0.40, 0.06, 0.02), vec3(0.72, 0.28, 0.03), smoothstep(0.2, 0.6, n1));
  fc = mix(fc, vec3(0.62, 0.48, 0.05), smoothstep(0.55, 0.8, n2));
  fc = mix(fc, vec3(0.12, 0.17, 0.04), smoothstep(0.75, 0.95, n1 * 0.5 + n2 * 0.5));
  fc *= 0.5 + 0.35 * bdNoise(p * 0.8);
  float forest = smoothstep(0.42, 0.58, vMisc.x + (bdNoise(p * 0.08) - 0.5) * 0.3);
  c = mix(c, fc, forest);
  // blend into the painted ground at the edge of the neighborhood
  return mix(vEdgeCol, c, smoothstep(1.0, 16.0, vMisc.y));
}`)
      .replace('#include <color_fragment>', 'diffuseColor.rgb = landColor();');
  };

  // split into sectors so the renderer skips the parts behind the camera
  const SECT = 6;
  for (let s = 0; s < SECT; s++) {
    const i0 = Math.floor((s * M) / SECT), i1 = Math.floor(((s + 1) * M) / SECT);
    const idx = [];
    for (let k = 0; k < K - 1; k++) for (let i = i0; i < i1; i++) quad(idx, k, i);
    const g = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'aMisc', 'aEdge']) g.setAttribute(name, landGeo.attributes[name]);
    g.setIndex(idx);
    const box = new THREE.Box3(), v = new THREE.Vector3();
    for (const k of idx) box.expandByPoint(v.fromArray(pos, k * 3));
    g.boundingBox = box;
    g.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    const mesh = new THREE.Mesh(g, landMat);
    mesh.receiveShadow = false;
    group.add(mesh);
  }

  // --- 3a. roads running off into the distance -------------------------------
  const roadGeos = [];
  const extendRoad = (from, dir, len, width) => {
    let hx = dir.x, hz = dir.z, x = from.x, z = from.z;
    const pts = [];
    const step = 4, n = Math.ceil(len / step);
    const bend = (rng() - 0.5) * 0.02;
    for (let i = 0; i <= n; i++) {
      pts.push({ x, z, hx, hz });
      const a = bend + Math.sin(i * 0.11 + rng()) * 0.01;
      const nx = hx * Math.cos(a) - hz * Math.sin(a), nz = hx * Math.sin(a) + hz * Math.cos(a);
      hx = nx; hz = nz;
      x += hx * step; z += hz * step;
    }
    const vp = [];
    const yAt = (px, pz) => (outside(px, pz) < 0.01 ? heightAt(px, pz) + 0.05 : landHeight(px, pz) + 0.2);
    for (const p of pts) {
      const sx = -p.hz * width / 2, sz = p.hx * width / 2;
      vp.push(p.x + sx, yAt(p.x + sx, p.z + sz), p.z + sz, p.x - sx, yAt(p.x - sx, p.z - sz), p.z - sz);
    }
    const idx = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) { g.setIndex(idx.map((_, i) => idx[i - (i % 3) + [0, 2, 1][i % 3]])); g.computeVertexNormals(); }
    roadGeos.push(g);
    return pts;
  };
  const roadPaths = [];
  for (const name of ['Crossover Blvd', 'Snyder Ave']) {
    const r = roadLines.find((rr) => rr.name === name);
    if (!r) continue;
    const L = r.line;
    for (const [a, b] of [[L[0], L[1]], [L[L.length - 1], L[L.length - 2]]]) {
      const dx = a.x - b.x, dz = a.z - b.z, len = Math.hypot(dx, dz);
      roadPaths.push(extendRoad(a, { x: dx / len, z: dz / len }, 230, r.width));
    }
  }
  // (roads are merged with the farm buildings below: one draw call)
  const asphalt = new THREE.Color('#45484d');
  for (const g of roadGeos) {
    const a = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) { a[i] = asphalt.r; a[i + 1] = asphalt.g; a[i + 2] = asphalt.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  }
  const nearRoad = (x, z, m) => roadPaths.some((pts) => pts.some((p) => Math.abs(p.x - x) < m + 2 && Math.abs(p.z - z) < m + 2 && Math.hypot(p.x - x, p.z - z) < m));

  // --- 2. trees --------------------------------------------------------------
  const trees = [];
  for (let gx = R.x0 - TREE_MAX_D; gx < R.x1 + TREE_MAX_D; gx += 7) {
    for (let gz = R.z0 - TREE_MAX_D; gz < R.z1 + TREE_MAX_D; gz += 7) {
      const x = gx + (rng() - 0.5) * 6, z = gz + (rng() - 0.5) * 6;
      const d = outside(x, z);
      if (d < 2 || d > TREE_MAX_D) continue;
      if (d > 45 && rng() < 0.4) continue; // a bit sparser in the distance
      const f = forestAt(x, z, d);
      // behind the neighborhood's own woods (west, north, east) you barely see
      // past the trunks, so keep that band thin; woodlots and hedgerows in
      // the open country get the trees
      const behindWoods = woodsAt(clamp(x, R.x0 + 3, R.x1 - 3), clamp(z, R.z0 + 3, R.z1 - 3)) && d < 70;
      const p = f > 0.5 ? (behindWoods ? 0.05 : 0.85) : hedgeDist(x, z) < 1.6 ? 0.3 : 0.012;
      if (rng() > p) continue;
      if (nearRoad(x, z, 8)) continue;
      trees.push({ x, z, d, s: 0.8 + rng() * 0.55, conifer: rng() < 0.1 });
    }
  }
  const FALL = ['#c0392b', '#e0661f', '#f0a12a', '#e9c03a', '#d4a017', '#b5541f', '#8e2f22', '#7a8f34', '#c9772b', '#a8341f'];
  const blob = (detail) => {
    let g = new THREE.IcosahedronGeometry(1, detail);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g);
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 0.82 + fbm(x * 2.3 + 4, z * 2.3 + y * 1.7, 2) * 0.36;
      p.setXYZ(i, x * k, (y < 0 ? y * 0.8 : y) * k, z * k);
      const sh = 0.62 + 0.25 * (y * 0.5 + 0.5);
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = sh;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  };
  // Near trees: canopy and trunk in one mesh (unit size, scaled per tree), so
  // each tree type is a single draw call per quarter of the map.
  const nearGeo = (() => {
    const can = blob(q(1, 0)).translate(0, 1.51, 0);
    let tr = new THREE.CylinderGeometry(0.078, 0.125, 1.06, 5, 1, true).translate(0, 0.43, 0);
    tr = tr.toNonIndexed(); tr.deleteAttribute('uv');
    tr.setAttribute('color', new THREE.BufferAttribute(new Float32Array(tr.attributes.position.count * 3).fill(0.22), 3));
    return mergeGeometries([can.toNonIndexed(), tr]);
  })();
  const farGeo = blob(q(1, 0));
  const canopyMat = litMat({ color: '#ffffff', vertexColors: true });
  const NEAR_D = q(30, 0); // closest trees get rounder canopies and trunks
  const TSECT = 4;
  const sectorOf = (x, z) => {
    const a = Math.atan2(z - CZ, x - CX);
    return Math.min(TSECT - 1, Math.floor(((a + Math.PI) / (Math.PI * 2)) * TSECT));
  };
  const bins = [...Array(TSECT)].map(() => ({ near: [], far: [] }));
  for (const t of trees) {
    const b = bins[sectorOf(t.x, t.z)];
    (t.d < NEAR_D && !t.conifer ? b.near : b.far).push(t);
  }
  const m = new THREE.Matrix4(), qt = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const addInst = (geo, list, place) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, canopyMat, list.length);
    list.forEach((t, i) => place(im, i, t));
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    group.add(im);
  };
  const fallColor = () => col.set(FALL[(rng() * FALL.length) | 0]).offsetHSL(0, -0.04, 0.02 + (rng() - 0.5) * 0.08);
  for (const b of bins) {
    addInst(nearGeo, b.near, (im, i, t) => {
      const r = 3.2 * t.s;
      qt.setFromAxisAngle(up, rng() * Math.PI * 2);
      m.compose(v3.set(t.x, landHeight(t.x, t.z), t.z), qt, sc.set(r, r * 0.9, r));
      im.setMatrixAt(i, m);
      im.setColorAt(i, fallColor());
    });
    addInst(farGeo, b.far, (im, i, t) => {
      const r = 3.2 * t.s;
      qt.setFromAxisAngle(up, rng() * Math.PI * 2);
      if (t.conifer) { // tall dark evergreen
        m.compose(v3.set(t.x, landHeight(t.x, t.z) + r * 1.1, t.z), qt, sc.set(r * 0.62, r * 1.5, r * 0.62));
        im.setColorAt(i, col.set('#2f5634').offsetHSL(0, 0, (rng() - 0.5) * 0.06));
      } else {
        m.compose(v3.set(t.x, landHeight(t.x, t.z) + r * 0.7, t.z), qt, sc.set(r, r * 0.9, r));
        im.setColorAt(i, fallColor());
      }
      im.setMatrixAt(i, m);
    });
  }

  // --- 3b. farmsteads down in the valley -------------------------------------
  const farmGeos = [];
  const lights = [];
  const colored = (g, hex) => {
    g = g.index ? g.toNonIndexed() : g;
    g.deleteAttribute('uv');
    const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    if (!g.attributes.normal) g.computeVertexNormals();
    return g;
  };
  const gable = (w, d, h) => {
    const W = w / 2, D = d / 2;
    const p = [
      -W, 0, -D, -W, 0, D, 0, h, D, -W, 0, -D, 0, h, D, 0, h, -D, // left slope
      W, 0, D, W, 0, -D, 0, h, -D, W, 0, D, 0, h, -D, 0, h, D, // right slope
      -W, 0, D, W, 0, D, 0, h, D, // front gable
      W, 0, -D, -W, 0, -D, 0, h, -D, // back gable
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    return g;
  };
  const place = (g, x, y, z, rot) => g.applyMatrix4(new THREE.Matrix4().makeRotationY(rot).setPosition(x, y, z));
  // one farm sits right where you look down the hill from the end of Iron Works
  const farmSpots = [{ x: -22, z: 268 }];
  for (let tries = 0; tries < 400 && farmSpots.length < 7; tries++) {
    // mostly down the hill to the south, a couple off to the sides
    const a = farmSpots.length < 5 ? Math.PI * (0.15 + rng() * 0.7) : rng() * Math.PI * 2;
    const p0 = { x: CX + Math.cos(a) * 400, z: CZ + Math.sin(a) * 400 };
    const ex = clampX(p0.x), ez = clampZ(p0.z);
    const dd = 40 + rng() * 110;
    const L = Math.hypot(p0.x - ex, p0.z - ez) || 1;
    const x = ex + ((p0.x - ex) / L) * dd, z = ez + ((p0.z - ez) / L) * dd;
    const d = outside(x, z);
    if (forestAt(x, z, d) > 0.3 || nearRoad(x, z, 12)) continue;
    if (farmSpots.some((f) => Math.hypot(f.x - x, f.z - z) < 60)) continue;
    const slope = Math.abs(landHeight(x + 6, z) - landHeight(x - 6, z)) + Math.abs(landHeight(x, z + 6) - landHeight(x, z - 6));
    if (slope > 3) continue;
    farmSpots.push({ x, z });
  }
  for (const f of farmSpots) {
    const rot = rng() * Math.PI;
    const c = Math.cos(rot), s = Math.sin(rot);
    const at = (lx, lz) => ({ x: f.x + lx * c + lz * s, z: f.z - lx * s + lz * c });
    const y0 = (p) => landHeight(p.x, p.z) - 0.6;
    // red bank barn with a dark roof
    const b = at(0, 0), by = y0(b);
    farmGeos.push(place(colored(new THREE.BoxGeometry(9, 5.5, 15), '#9a3324').translate(0, 2.75, 0), b.x, by, b.z, rot));
    farmGeos.push(place(colored(gable(9.8, 15.6, 3.6), '#45403c').translate(0, 5.5, 0), b.x, by, b.z, rot));
    farmGeos.push(place(colored(new THREE.BoxGeometry(3, 3.2, 0.2), '#e9e2d0').translate(0, 1.6, 7.55), b.x, by, b.z, rot));
    // silo
    const si = at(6.4, -4), sy = y0(si);
    farmGeos.push(place(colored(new THREE.CylinderGeometry(1.7, 1.7, 11, 10), '#b9b3a7').translate(0, 5.5, 0), si.x, sy, si.z, 0));
    farmGeos.push(place(colored(new THREE.SphereGeometry(1.75, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), '#7e8287').translate(0, 11, 0), si.x, sy, si.z, 0));
    // white farmhouse
    const h = at(-14, 6), hy = y0(h);
    farmGeos.push(place(colored(new THREE.BoxGeometry(7, 6, 9), '#ece6da').translate(0, 3, 0), h.x, hy, h.z, rot));
    farmGeos.push(place(colored(gable(7.6, 9.6, 2.8), '#3b3a3a').translate(0, 6, 0), h.x, hy, h.z, rot));
    for (const [lx, ly, lz] of [[-3.6, 1.8, 1.5], [-3.6, 4.3, -1.8], [3.6, 1.8, -1]]) {
      const w = at(-14 + lx * 1.02, 6 + lz);
      lights.push(w.x, hy + ly, w.z);
    }
  }
  const builtGeos = [...roadGeos.map((g) => g.toNonIndexed()), ...farmGeos];
  if (builtGeos.length) group.add(new THREE.Mesh(mergeGeometries(builtGeos), litMat({ vertexColors: true })));
  // scattered farmhouse lights across the countryside (only at night)
  for (let i = 0; i < 45; i++) {
    const a = rng() * Math.PI * 2, dd = 50 + rng() * 160;
    const p0 = { x: CX + Math.cos(a) * 400, z: CZ + Math.sin(a) * 400 };
    const ex = clampX(p0.x), ez = clampZ(p0.z), L = Math.hypot(p0.x - ex, p0.z - ez) || 1;
    const x = ex + ((p0.x - ex) / L) * dd, z = ez + ((p0.z - ez) / L) * dd;
    lights.push(x, landHeight(x, z) + 1.5 + rng() * 2, z);
  }
  const lightTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,240,200,1)');
    grd.addColorStop(0.35, 'rgba(255,200,110,0.9)');
    grd.addColorStop(1, 'rgba(255,170,80,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  })();
  const lightMat = (size) => new THREE.PointsMaterial({ map: lightTex, color: '#ffd28a', size: size * pixelRatio, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const landLightGeo = new THREE.BufferGeometry();
  landLightGeo.setAttribute('position', new THREE.Float32BufferAttribute(lights, 3));
  const landLights = new THREE.Points(landLightGeo, lightMat(4.5));
  landLights.frustumCulled = false;
  group.add(landLights);

  // --- 4. hazy ridges on the horizon -----------------------------------------
  // Three layers of hills on cylinders around the camera (they move with it
  // like the sky). Far layers are paler and bluer; the lower slopes melt into
  // the valley mist. Drawn right after the sky and before everything else.
  const LAYERS = [
    { r: 268, base: 12, amp: 22, freq: 1.4, haze: 0.62, mot: 0.2, seed: 3 },
    { r: 254, base: 5, amp: 16, freq: 2.1, haze: 0.42, mot: 0.6, seed: 21 },
    { r: 240, base: -2, amp: 12, freq: 3.2, haze: 0.22, mot: 1.0, seed: 47 },
  ];
  const RIDGE_Y = -8;
  const N = q(240, 160);
  const rp = [], ra = [], ri = [];
  const ridgeLights = [];
  const crest = (Lr, a) => {
    const cx = Math.cos(a) * Lr.freq, sz = Math.sin(a) * Lr.freq;
    let h = Lr.base + Lr.amp * fbm(cx + Lr.seed, sz + Lr.seed * 0.7, 4);
    // looking south (+z) you see across the valley: a bit lower and farther
    h -= 4 * smoothstep(0.2, 0.9, Math.sin(a));
    // tree-top bumps along the near crests
    h += (noise2(a * 70 + Lr.seed, Lr.seed) - 0.5) * 1.6 * Lr.mot;
    return RIDGE_Y + h;
  };
  LAYERS.forEach((Lr) => {
    const start = rp.length / 3;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const top = crest(Lr, a);
      const x = Math.cos(a) * Lr.r, z = Math.sin(a) * Lr.r;
      const mot = Lr.mot * noise2(a * 9 + Lr.seed, 1.7);
      rp.push(x, top, z, x, -160, z);
      ra.push(Lr.haze, top, mot, Lr.haze, top, mot);
    }
    for (let i = 0; i < N; i++) {
      const a = start + i * 2, b = a + 1, c = a + 2, d = a + 3;
      ri.push(a, b, c, b, d, c);
    }
    if (Lr.haze < 0.7) {
      for (let i = 0; i < 14; i++) {
        const a = rng() * Math.PI * 2, rr = Lr.r - 1.5;
        ridgeLights.push(Math.cos(a) * rr, crest(Lr, a) - 4 - rng() * 7, Math.sin(a) * rr);
      }
    }
  });
  const ridgeGeo = new THREE.BufferGeometry();
  ridgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  ridgeGeo.setAttribute('aRidge', new THREE.Float32BufferAttribute(ra, 3));
  ridgeGeo.setIndex(ri);
  const ridgeMat = new THREE.ShaderMaterial({
    uniforms: {
      uDark: { value: new THREE.Color() },
      uHaze: { value: new THREE.Color() },
      uFog: { value: new THREE.Color() },
      uFall: { value: new THREE.Color(1.45, 0.82, 0.5) },
      uSunCol: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3() },
      uNight: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aRidge;
      varying vec3 vRidge; varying float vY; varying vec3 vDir;
      void main() {
        vRidge = aRidge;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vY = w.y;
        vDir = w.xyz - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uDark; uniform vec3 uHaze; uniform vec3 uFog; uniform vec3 uFall; uniform vec3 uSunCol; uniform vec3 uSunDir; uniform float uNight;
      varying vec3 vRidge; varying float vY; varying vec3 vDir;
      void main() {
        float k = vRidge.x;
        vec3 c = mix(uDark, uHaze, k);
        c = mix(c, c * uFall, vRidge.z * (1.0 - k) * 0.9 * (1.0 - uNight));
        // lit crest: a touch brighter right at the top
        float below = vRidge.y - vY;
        c *= 1.0 + 0.12 * (1.0 - smoothstep(0.0, 3.0, below)) * (1.0 - uNight);
        // the lower slopes fade into the valley mist
        c = mix(c, uFog, smoothstep(3.0, 40.0, below));
        float s = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
        c += uSunCol * (pow(s, 5.0) * 0.32) * (0.35 + k) * (1.0 - uNight);
        gl_FragColor = vec4(c, 1.0);
      }`,
    // like the sky dome, colors here are final screen colors (no tone mapping)
    toneMapped: false,
    depthFunc: THREE.AlwaysDepth,
    depthWrite: true,
    fog: false,
  });
  const ridges = new THREE.Mesh(ridgeGeo, ridgeMat);
  ridges.renderOrder = -9; // right after the sky dome
  ridges.frustumCulled = false;
  const horizon = new THREE.Group();
  horizon.add(ridges);
  const rlGeo = new THREE.BufferGeometry();
  rlGeo.setAttribute('position', new THREE.Float32BufferAttribute(ridgeLights, 3));
  const ridgeLightPts = new THREE.Points(rlGeo, lightMat(2.6));
  ridgeLightPts.frustumCulled = false;
  horizon.add(ridgeLightPts);
  group.add(horizon);

  scene.add(group);

  const tmpC2 = new THREE.Color();
  return {
    group,
    landHeight,
    update(sky, camera) {
      const st = sky.state;
      if (!st.top) return;
      horizon.position.set(camera.position.x, 0, camera.position.z);
      const u = ridgeMat.uniforms;
      // the sky dome writes its colors straight to the screen, while the fogged
      // land is tone mapped; match each: haze -> sky horizon, mist -> fog
      displayColor(u.uFog.value.copy(st.fog));
      u.uHaze.value.copy(st.hor).lerp(u.uFog.value, 0.35 + 0.5 * st.night);
      u.uDark.value.copy(st.top).lerp(st.hemG, 0.5).lerp(st.hor, 0.15).multiplyScalar(0.62);
      // at night the hills are moonlit shapes in the haze, a little darker
      // than the fog (the fogged woods in front are lighter than the sky too)
      u.uDark.value.lerp(tmpC2.copy(u.uFog.value).multiplyScalar(0.62), st.night);
      u.uSunCol.value.copy(st.sun);
      u.uSunDir.value.copy(sky.sunDir);
      u.uNight.value = st.night;
      const lo = clamp((st.night - 0.3) / 0.5, 0, 1);
      landLights.material.opacity = lo;
      ridgeLightPts.material.opacity = lo * 0.9;
      landLights.visible = ridgeLightPts.visible = lo > 0.01;
    },
  };
}
