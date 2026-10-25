import * as THREE from 'three';
import { litMat } from './quality.js';
import { ROADS, WOODS, CREEK, TRAIL, STORE, CUL_DE_SAC, px, MAP_SCALE } from './config.js';
import { fbm, noise2, polylineDistance, pointInPolygon, smoothstep, lerp, chaikin, makeRng } from './util.js';

// Terrain covers a little more than the playable area so the edges feel natural.
const X0 = px(-80, 0).x, X1 = px(830, 0).x;
const Z0 = px(0, 180).z, Z1 = px(0, 1420).z;
const STEP = 1.6;
// The playable ground's outline; the distant backdrop (backdrop.js) starts here.
export const TERRAIN_RECT = { x0: X0, x1: X1, z0: Z0, z1: Z1 };

const P = (arr) => arr.map(([x, y]) => px(x, y));

export const roadLines = ROADS.map((r) => ({ ...r, line: chaikin(P(r.pts), 3) }));
export const creekLine = chaikin(P(CREEK), 3);
export const trailLine = chaikin(P(TRAIL), 3);
export const woodsPolys = WOODS.map(P);
export const culDeSac = { ...px(CUL_DE_SAC.x, CUL_DE_SAC.y), r: CUL_DE_SAC.r * MAP_SCALE, island: CUL_DE_SAC.island * MAP_SCALE };
export const storePos = px(STORE.x, STORE.y);

const northRoadZ = px(0, 525).z;
const NORTH_RISE_CUT = 0.5; // 0 = real height, 0.5 = half as high above the street
const ourHollow = px(176, 488);
const haresHill = px(760, 940);

// "Natural" ground before roads and yards are leveled. This is an artistic
// approximation of the real slopes: houses on the north side sit up on a bank
// above the street, the east woods drop into a creek valley, and Hares Hill
// rises on the far side of the creek.
// Real ground heights from USGS 3DEP LiDAR (1 m), resampled to game units by
// tools/build_elevation.py. Loaded before the world is built.
let ELEV = null;
export function setElevation(data) {
  if (!data || !data.heights) return;
  ELEV = { ...data, h: Float32Array.from(data.heights) };
}
function lidar(x, z) {
  const E = ELEV;
  const fx = Math.max(0, Math.min(E.cols - 1.001, (x - E.x0) / E.step));
  const fz = Math.max(0, Math.min(E.rows - 1.001, (z - E.z0) / E.step));
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const a = E.h[j * E.cols + i], b = E.h[j * E.cols + i + 1], c = E.h[(j + 1) * E.cols + i], d = E.h[(j + 1) * E.cols + i + 1];
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function natural(x, z) {
  if (ELEV) {
    // real elevation, plus a little channel so the creek reads as a creek
    let h = lidar(x, z);
    // the north-side yards were graded up into a bank above the street
    // (see the street view); the LiDAR predates the houses, so add it back
    const bank = smoothstep(northRoadZ - 4.5, northRoadZ - 12, z) * (1 - smoothstep(px(0, 360).z, px(0, 330).z, z));
    h += bank * 1.9 * smoothstep(px(60, 0).x, px(110, 0).x, x) * (1 - smoothstep(px(690, 0).x, px(740, 0).x, x));
    const dh = Math.hypot(x - ourHollow.x, z - ourHollow.z);
    h -= 0.9 * Math.exp(-((dh / 9) ** 2));
    // a little channel so the creek reads as a creek, and a gentle knoll for Hares Hill
    const c = polylineDistance(x, z, creekLine).d;
    h -= 0.9 * (1 - smoothstep(0.8, 3.2, c));
    const dhh = Math.hypot(x - haresHill.x, z - haresHill.z);
    h += 1.6 * Math.exp(-((dhh / 14) ** 2));
    // The north-side houses sit up above Iron Works; this halves how far they
    // rise above the street (fading out again toward Snyder Ave behind them)
    const north = smoothstep(northRoadZ - 1, northRoadZ - 6, z) * (1 - smoothstep(px(0, 400).z, px(0, 372).z, z))
      * smoothstep(px(178, 0).x, px(196, 0).x, x) * (1 - smoothstep(px(690, 0).x, px(740, 0).x, x)); // not the white corner house
    if (north > 0) {
      const street = lidar(x, northRoadZ);
      if (h > street) h = street + (h - street) * (1 - NORTH_RISE_CUT * north); // only lower, never sink
    }
    return h;
  }
  let h = 0;
  h += (fbm(x * 0.012 + 3.1, z * 0.012 + 7.7, 4) - 0.5) * 6.0; // rolling ground
  h += -x * 0.02 - z * 0.008; // overall fall toward the southeast
  // North bank: houses north of Iron Works sit on a rise above the street
  const bank = smoothstep(northRoadZ - 4.5, northRoadZ - 12, z) * (1 - smoothstep(px(0, 360).z, px(0, 330).z, z));
  h += bank * 2.8 * smoothstep(px(60, 0).x, px(110, 0).x, x);
  // Side yard by the house dips down to the west
  const dh = Math.hypot(x - ourHollow.x, z - ourHollow.z);
  h -= 1.4 * Math.exp(-((dh / 9) ** 2));
  // Creek valley
  const c = polylineDistance(x, z, creekLine).d;
  h -= 4.6 * Math.exp(-((c / 15) ** 2));
  h -= 0.7 * (1 - smoothstep(0.8, 2.6, c));
  // Hares Hill
  const dhh = Math.hypot(x - haresHill.x, z - haresHill.z);
  h += 4.2 * Math.exp(-((dhh / 22) ** 2));
  return h;
}

// Curbs: sidewalks and lawns sit about 4.5" above the asphalt.
export const CURB = 0.115;

// Is this spot on the asphalt (any road or the cul-de-sac ring)?
export function onRoad(x, z) {
  const dc = Math.hypot(x - culDeSac.x, z - culDeSac.z);
  if (dc <= culDeSac.r && dc >= culDeSac.island) return true;
  for (const r of roadLines) if (polylineDistance(x, z, r.line).d <= r.width / 2) return true;
  return false;
}
function nearRoadEdge(x, z, margin) {
  const dc = Math.hypot(x - culDeSac.x, z - culDeSac.z);
  if (dc <= culDeSac.r + margin && dc >= culDeSac.island - margin) return true;
  for (const r of roadLines) if (polylineDistance(x, z, r.line).d <= r.width / 2 + margin) return true;
  return false;
}

export function createTerrain(pads, driveways, walkways) {
  const cols = Math.ceil((X1 - X0) / STEP) + 1;
  const rows = Math.ceil((Z1 - Z0) / STEP) + 1;
  const heights = new Float32Array(cols * rows);

  const flatten = (x, z, h) => {
    // Roads follow the land but are smoothed side-to-side
    for (const r of roadLines) {
      const n = polylineDistance(x, z, r.line);
      const inner = r.width / 2 + (r.sidewalks ? 3.2 : 1.2);
      const w = 1 - smoothstep(inner, inner + 4.5, n.d);
      if (w > 0) h = lerp(h, natural(n.x, n.z), w);
    }
    // Cul-de-sac bulb
    const dc = Math.hypot(x - culDeSac.x, z - culDeSac.z);
    const wc = 1 - smoothstep(culDeSac.r + 2, culDeSac.r + 6, dc);
    if (wc > 0) h = lerp(h, natural(culDeSac.x, culDeSac.z), wc);
    // House pads: blend overlapping lots together instead of letting the
    // last one win (that used to bury the edge of a neighbor's house)
    let wMax = 0, sw = 0, sh = 0;
    for (const p of pads) {
      const dx = x - p.x, dz = z - p.z;
      const lx = Math.abs(dx * Math.cos(p.rot) - dz * Math.sin(p.rot));
      const lzs = dx * Math.sin(p.rot) + dz * Math.cos(p.rot); // + toward the front
      let target = p.h, hdBack = p.hd;
      if (p.walkout) {
        // walkout: the house and front yard are built up a story above the
        // natural ground; it slopes down along the sides to the back yard,
        // which stays at the natural level
        const wo = p.walkout;
        hdBack = p.hd + wo.yard;
        target = p.h + wo.drop * (1 - smoothstep(wo.depth * 0.1, -wo.depth / 2 - 0.6, lzs));
      }
      const d = Math.max(lx - p.hw, lzs >= 0 ? lzs - p.hd : -lzs - hdBack, 0);
      const w = 1 - smoothstep(0.5, 5, d);
      if (w > 0) { wMax = Math.max(wMax, w); sw += w; sh += w * target; }
    }
    if (wMax > 0) h = lerp(h, sh / sw, wMax);
    // Trail is gently leveled across its width
    const t = polylineDistance(x, z, trailLine);
    const wt = 1 - smoothstep(1.2, 3.5, t.d);
    if (wt > 0) h = lerp(h, natural(t.x, t.z), wt * 0.8);
    return h;
  };

  for (const p of pads) p.h = natural(p.x, p.z);

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = X0 + i * STEP, z = Z0 + j * STEP;
      heights[j * cols + i] = flatten(x, z, natural(x, z));
    }
  }

  const sampleGrid = (arr, x, z) => {
    const fx = (x - X0) / STEP, fz = (z - Z0) / STEP;
    const i = Math.max(0, Math.min(cols - 2, Math.floor(fx)));
    const j = Math.max(0, Math.min(rows - 2, Math.floor(fz)));
    const u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fz - j));
    const a = arr[j * cols + i], b = arr[j * cols + i + 1];
    const c = arr[(j + 1) * cols + i], d = arr[(j + 1) * cols + i + 1];
    if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
    return d + (c - d) * (1 - u) + (b - d) * (1 - v);
  };
  // Street level everywhere (smooth), then lawns/sidewalks step up by a curb
  const baseAt = (x, z) => sampleGrid(heights, x, z);
  const heightAt = (x, z) => baseAt(x, z) + (onRoad(x, z) ? 0 : CURB);

  // The big ground mesh: raised by the curb height, and tucked down out of
  // sight under the asphalt (the sharp curb edges are a separate mesh)
  const shown = new Float32Array(heights.length);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i, x = X0 + i * STEP, z = Z0 + j * STEP;
      shown[k] = heights[k] + (nearRoadEdge(x, z, 1.7) ? -0.3 : CURB);
    }
  }

  const pos = new Float32Array(cols * rows * 3);
  const uv = new Float32Array(cols * rows * 2);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      const x = X0 + i * STEP, z = Z0 + j * STEP;
      pos[k * 3] = x; pos[k * 3 + 1] = shown[k]; pos[k * 3 + 2] = z;
      uv[k * 2] = (x - X0) / (X1 - X0);
      uv[k * 2 + 1] = 1 - (z - Z0) / (Z1 - Z0);
    }
  }
  const index = [];
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();

  // Split the ground into tiles that share one set of vertices, so the
  // renderer can skip tiles that are off screen (same look, far fewer triangles).
  const TILE = 30; // grid cells per tile side (~48 world units)
  const tiles = [];
  for (let tj = 0; tj < rows - 1; tj += TILE) {
    for (let ti = 0; ti < cols - 1; ti += TILE) {
      const idx = [];
      const box = new THREE.Box3();
      const v = new THREE.Vector3();
      for (let j = tj; j < Math.min(tj + TILE, rows - 1); j++) {
        for (let i = ti; i < Math.min(ti + TILE, cols - 1); i++) {
          const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
          idx.push(a, c, b, b, c, d);
          for (const k of [a, d]) box.expandByPoint(v.fromArray(pos, k * 3));
        }
      }
      const tg = new THREE.BufferGeometry();
      for (const name of ['position', 'uv', 'normal']) tg.setAttribute(name, geo.attributes[name]);
      tg.setIndex(idx);
      tg.boundingBox = box;
      tg.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
      tiles.push(tg);
    }
  }

  const tex = paintGround(driveways, walkways);
  const mat = litMat({ map: tex });
  // Fine detail tiled on top of the big painted ground so it stays crisp up close
  const detail = makeDetailTexture();
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.detailMap = { value: detail };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform sampler2D detailMap;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= texture2D(detailMap, vMapUv * vec2(150.0, 205.0)).rgb * 1.9;');
  };
  const group = new THREE.Group();
  group.name = 'terrain';
  for (const tg of tiles) {
    const mesh = new THREE.Mesh(tg, mat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const street = buildStreetMesh(heightAt, mat);
  street.receiveShadow = true;
  group.add(street);
  return { mesh: group, heightAt, groundCanvas: tex.image };
}

// High-detail strips along every road (and the cul-de-sac) with a crisp curb
// step, painted with the same ground texture so they blend into the lawns.
function buildStreetMesh(heightAt, mat) {
  const pos = [], uv = [], index = [];
  const push = (x, z) => {
    pos.push(x, heightAt(x, z), z);
    uv.push((x - X0) / (X1 - X0), 1 - (z - Z0) / (Z1 - Z0));
    return pos.length / 3 - 1;
  };
  const strip = (rowsPts) => {
    // rowsPts: array of rows, each an array of [x, z]; stitch into quads
    const ids = rowsPts.map((row) => row.map(([x, z]) => push(x, z)));
    for (let j = 0; j < ids.length - 1; j++) {
      for (let i = 0; i < ids[j].length - 1; i++) {
        const a = ids[j][i], b = ids[j][i + 1], c = ids[j + 1][i], d = ids[j + 1][i + 1];
        index.push(a, b, c, b, d, c);
      }
    }
  };
  const E = 3.6;
  for (const r of roadLines) {
    const h = r.width / 2;
    const offs = [-(h + E), -(h + 2.2), -(h + 1.0), -(h + 0.35), -(h + 0.08), -h, -(h - 0.25), -(h - 1.2)];
    for (let x = -(h - 2.4); x < h - 2.0; x += 1.6) offs.push(x);
    offs.push(h - 1.2, h - 0.25, h, h + 0.08, h + 0.35, h + 1.0, h + 2.2, h + E);
    offs.sort((a, b) => a - b);
    const line = resampleLine(r.line, 0.9);
    const rowsPts = line.map((p, i) => {
      const q = line[Math.min(i + 1, line.length - 1)], o = line[Math.max(i - 1, 0)];
      const dx = q.x - o.x, dz = q.z - o.z, L = Math.hypot(dx, dz) || 1;
      const nx = -dz / L, nz = dx / L;
      return offs.map((t) => [p.x + nx * t, p.z + nz * t]);
    });
    strip(rowsPts);
  }
  // cul-de-sac: rings from the island out past the curb
  const radii = [0.1, culDeSac.island - 1.2, culDeSac.island - 0.35, culDeSac.island - 0.08, culDeSac.island, culDeSac.island + 0.25, culDeSac.island + 1.2];
  for (let rr = culDeSac.island + 2.6; rr < culDeSac.r - 1.5; rr += 1.6) radii.push(rr);
  radii.push(culDeSac.r - 1.2, culDeSac.r - 0.25, culDeSac.r, culDeSac.r + 0.08, culDeSac.r + 0.35, culDeSac.r + 1.0, culDeSac.r + 2.2, culDeSac.r + E);
  const segs = 72;
  const rings = radii.map((rr) => {
    const row = [];
    for (let k = 0; k <= segs; k++) {
      const a = (k / segs) * Math.PI * 2;
      row.push([culDeSac.x + Math.cos(a) * rr, culDeSac.z + Math.sin(a) * rr]);
    }
    return row;
  });
  strip(rings);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  // draw slightly in front of the lawn where they overlap at the outer edge
  mesh.renderOrder = 1;
  return mesh;
}

function resampleLine(line, step) {
  const out = [line[0]];
  let carry = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    let d = step - carry;
    while (d <= len) { out.push({ x: a.x + ((b.x - a.x) * d) / len, z: a.z + ((b.z - a.z) * d) / len }); d += step; }
    carry = len - (d - step);
  }
  out.push(line[line.length - 1]);
  return out;
}

// ---------------------------------------------------------------------------
// Ground painting: grass, leaf litter, roads, sidewalks, driveways, creek, trail
// ---------------------------------------------------------------------------
const CW = 1024, CH = 1400;
const toC = (p) => [((p.x - X0) / (X1 - X0)) * CW, ((p.z - Z0) / (Z1 - Z0)) * CH];
const unitsToPx = CW / (X1 - X0);

function strokeLine(ctx, line, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width * unitsToPx;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  line.forEach((p, i) => {
    const [cx, cy] = toC(p);
    i ? ctx.lineTo(cx, cy) : ctx.moveTo(cx, cy);
  });
  ctx.stroke();
}
function fillCircle(ctx, p, r, color) {
  const [cx, cy] = toC(p);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r * unitsToPx, 0, Math.PI * 2);
  ctx.fill();
}
function fillPoly(ctx, poly, style) {
  ctx.fillStyle = style;
  ctx.beginPath();
  poly.forEach((p, i) => {
    const [cx, cy] = toC(p);
    i ? ctx.lineTo(cx, cy) : ctx.moveTo(cx, cy);
  });
  ctx.closePath();
  ctx.fill();
}

function makeTile(size, painter) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  painter(c.getContext('2d'), size);
  return c;
}

function paintGround(driveways, walkways) {
  const canvas = document.createElement('canvas');
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext('2d');
  const rng = makeRng(42);

  // 1) Grass with gentle color variation and mowing stripes
  const img = ctx.createImageData(CW, CH);
  const d = img.data;
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) {
      const n = fbm(x * 0.012, y * 0.012, 3);
      const fine = noise2(x * 0.35, y * 0.35);
      const stripe = Math.sin((x + y * 0.15) * 0.11) > 0 ? 1 : 0;
      const k = (y * CW + x) * 4;
      const autumn = Math.max(0, n - 0.55) * 1.6;
      d[k] = 92 + n * 40 + fine * 14 + autumn * 60 + stripe * 6;
      d[k + 1] = 142 + n * 34 + fine * 16 + stripe * 9;
      d[k + 2] = 58 + n * 16 + fine * 6;
      d[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // 2) Leaf litter under the woods
  const litter = makeTile(128, (c, s) => {
    c.fillStyle = '#6b4a2a';
    c.fillRect(0, 0, s, s);
    const cols = ['#9a5b22', '#c27a2c', '#7d3f1c', '#b8892f', '#5b3a1f', '#a33a1f', '#d39a3a'];
    for (let i = 0; i < 900; i++) {
      c.fillStyle = cols[(Math.random() * cols.length) | 0];
      c.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2.5, 1 + Math.random() * 2);
    }
  });
  const litterPat = ctx.createPattern(litter, 'repeat');
  ctx.save();
  ctx.filter = 'blur(1.2px)';
  for (const poly of woodsPolys) fillPoly(ctx, poly, litterPat);
  ctx.restore();

  // 3) Creek: muddy bank then water
  strokeLine(ctx, creekLine, 5.2, '#5d4630');
  strokeLine(ctx, creekLine, 3.2, '#3f6f7a');
  strokeLine(ctx, creekLine, 1.6, '#5e98a3');

  // 4) Trail and store clearing
  fillCircle(ctx, storePos, 13, '#8a7a4a');
  fillCircle(ctx, storePos, 10, '#9b8655');
  strokeLine(ctx, trailLine, 3.0, '#6e5534');
  strokeLine(ctx, trailLine, 2.2, '#9c7b4f');

  // 5) Sidewalks, grass strips, curbs, asphalt — layered so crossings look right
  const swRoads = roadLines.filter((r) => r.sidewalks);
  for (const r of swRoads) strokeLine(ctx, r.line, r.width + 7.0, '#c9c6bd');
  fillCircle(ctx, culDeSac, culDeSac.r + 3.5, '#c9c6bd');
  const grassStrip = makeTile(64, (c, s) => {
    c.fillStyle = '#6f9c43';
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 300; i++) {
      c.fillStyle = Math.random() > 0.5 ? '#7aa84a' : '#64913c';
      c.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
  });
  const stripPat = ctx.createPattern(grassStrip, 'repeat');
  for (const r of swRoads) strokeLine(ctx, r.line, r.width + 4.2, stripPat);
  fillCircle(ctx, culDeSac, culDeSac.r + 1.6, stripPat);

  // Driveways and front walkways cross the sidewalk
  // driveways: mostly street asphalt with a bit of sidewalk concrete mixed in,
  // with a little speckle like the road
  const drive = makeTile(64, (c, sz) => {
    c.fillStyle = '#6a6c6e';
    c.fillRect(0, 0, sz, sz);
    for (let i = 0; i < 400; i++) {
      const g = 92 + Math.random() * 32;
      c.fillStyle = `rgb(${g},${g + 1},${g + 3})`;
      c.fillRect(Math.random() * sz, Math.random() * sz, 1, 1);
    }
  });
  const drivePat = ctx.createPattern(drive, 'repeat');
  for (const dw of driveways) strokeLine(ctx, [dw.a, dw.b], dw.width, drivePat);
  for (const w of walkways) strokeLine(ctx, [w.a, w.b], w.width, w.color || '#a9a39a');

  for (const r of roadLines) strokeLine(ctx, r.line, r.width + 0.5, '#d4d1c8');
  fillCircle(ctx, culDeSac, culDeSac.r + 0.25, '#d4d1c8');
  const asphalt = makeTile(64, (c, s) => {
    c.fillStyle = '#4b4e53';
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 500; i++) {
      const g = 60 + Math.random() * 30;
      c.fillStyle = `rgb(${g},${g + 2},${g + 6})`;
      c.fillRect(Math.random() * s, Math.random() * s, 1, 1);
    }
  });
  const asphaltPat = ctx.createPattern(asphalt, 'repeat');
  for (const r of roadLines) strokeLine(ctx, r.line, r.width, asphaltPat);
  fillCircle(ctx, culDeSac, culDeSac.r, asphaltPat);
  // Cul-de-sac island
  fillCircle(ctx, culDeSac, culDeSac.island + 0.4, '#d4d1c8');
  fillCircle(ctx, culDeSac, culDeSac.island, '#6a4a2c');
  fillCircle(ctx, culDeSac, culDeSac.island - 1.2, stripPat);

  // Crossover Blvd gets a center line
  ctx.setLineDash([10, 10]);
  strokeLine(ctx, roadLines.find((r) => r.name === 'Crossover Blvd').line, 0.25, '#e5c74a');
  ctx.setLineDash([]);

  // 6) Fallen leaves sprinkled on lawns (thicker near the woods)
  const leafCols = ['#d9822b', '#c4471f', '#e8b23a', '#a8441f', '#f0a030', '#8c3b1e'];
  for (let i = 0; i < 34000; i++) {
    const x = rng() * CW, y = rng() * CH;
    const n = fbm(x * 0.01 + 11, y * 0.01 + 5, 2);
    if (rng() > n * 1.3) continue;
    ctx.fillStyle = leafCols[(rng() * leafCols.length) | 0];
    ctx.globalAlpha = 0.75;
    ctx.fillRect(x, y, 0.8 + rng() * 1.1, 0.8 + rng() * 0.9);
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function makeDetailTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(134,134,134)';
  g.fillRect(0, 0, 128, 128);
  const rng = makeRng(5);
  for (let i = 0; i < 2600; i++) {
    const v = 100 + rng() * 70;
    g.fillStyle = `rgb(${v},${v},${v})`;
    const x = rng() * 128, y = rng() * 128;
    g.fillRect(x, y, 1, 2 + rng() * 3); // little grass blades / grit
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

export function isInWoods(x, z) {
  return woodsPolys.some((poly) => pointInPolygon(x, z, poly));
}
