import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from '../lib/addons/utils/BufferGeometryUtils.js';
import { q } from './quality.js';

export const CHUNK = 48;

// Collects many small pieces (walls, roofs, shutters, pumpkins...) and merges
// them into a handful of meshes, one per material. Phones and tablets draw a
// few big meshes far faster than hundreds of small ones.
export class Builder {
  constructor() {
    this.parts = new Map();
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
  }

  // Add a geometry with a solid color. `xf` = { x, y, z, ry, rx, rz, sx, sy, sz }
  // or a THREE.Matrix4. `parent` is an optional Matrix4 applied afterwards.
  add(geometry, color, xf = {}, key = 'solid', parent = null) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.deleteAttribute('uv');
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    const m = xf.isMatrix4 ? xf : this.matrix(xf);
    g.applyMatrix4(m);
    if (parent) g.applyMatrix4(parent);
    const col = new THREE.Color(color);
    const n = g.attributes.position.count;
    const c = new Float32Array(n * 3);
    // shapes with their own vertex shading get tinted by the color
    const own = g.attributes.color;
    for (let i = 0; i < n; i++) {
      const k = own ? [own.getX(i), own.getY(i), own.getZ(i)] : [1, 1, 1];
      c[i * 3] = col.r * k[0]; c[i * 3 + 1] = col.g * k[1]; c[i * 3 + 2] = col.b * k[2];
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    // group pieces into map chunks so the renderer can skip what's off screen
    g.computeBoundingBox();
    const bb = g.boundingBox;
    const ck = `${key}|${Math.floor((bb.min.x + bb.max.x) / 2 / CHUNK)},${Math.floor((bb.min.z + bb.max.z) / 2 / CHUNK)}`;
    if (!this.parts.has(ck)) this.parts.set(ck, []);
    this.parts.get(ck).push(g);
    return g;
  }

  matrix({ x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, s = null } = {}) {
    this._e.set(rx, ry, rz, 'YXZ');
    this._q.setFromEuler(this._e);
    this._p.set(x, y, z);
    if (s !== null) this._s.set(s, s, s);
    else this._s.set(sx, sy, sz);
    return new THREE.Matrix4().compose(this._p, this._q, this._s);
  }

  build(materials) {
    const meshes = [];
    for (const [ck, list] of this.parts) {
      if (!list.length) continue;
      const key = ck.split('|')[0];
      const geo = mergeGeometries(list, false);
      geo.computeBoundingSphere();
      const mat = materials[key] || materials.solid;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = key;
      meshes.push(mesh);
      list.forEach((g) => g.dispose());
    }
    this.parts.clear();
    return meshes;
  }
}

function smoothIco(r, detail) {
  let g = new THREE.IcosahedronGeometry(r, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  g.computeVertexNormals();
  return g;
}

// --- Shared low-poly shapes ------------------------------------------------
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(0.5, q(16, 10), q(11, 7)),
  sphereLo: q(smoothIco(0.5, 2), new THREE.IcosahedronGeometry(0.5, 1)),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, q(16, 10)),
  cylLo: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  cone: new THREE.ConeGeometry(0.5, 1, q(16, 10)),
  cone4: new THREE.ConeGeometry(0.5, 1, 4),
  plane: new THREE.PlaneGeometry(1, 1),
  // triangular prism: base 1 wide (along z), 1 tall, 1 long (along x); base at y=0
  prism: (() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.5, 0);
    shape.lineTo(0.5, 0);
    shape.lineTo(0, 1);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
    g.translate(0, 0, -0.5);
    g.rotateY(Math.PI / 2);
    return g;
  })(),
};

// A gable roof made of two slabs + gable end walls, ridge running along local X.
// Returns nothing; adds to builder. (cx,cy,cz) = center of wall top.
export function addGableRoof(B, { w, d, h, overhang = 0.45, thick = 0.22, roofColor, wallColor, parent, x = 0, y = 0, z = 0, ry = 0 }) {
  const local = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)),
    new THREE.Vector3(1, 1, 1),
  );
  const M = parent ? parent.clone().multiply(local) : local;
  // gable fill (siding colored)
  B.add(GEO.prism, wallColor, { x: 0, y: 0, z: 0, sx: w, sy: h, sz: d }, 'solid', M);
  const half = d / 2;
  const hyp = Math.hypot(half, h);
  const slope = Math.atan2(h, half);
  const len = hyp + overhang;
  for (const side of [-1, 1]) {
    // walk from the ridge down the slope by len/2, then lift by half the thickness
    const cz = side * half * (len / 2) / hyp + side * (h / hyp) * thick / 2;
    const cy = h - h * (len / 2) / hyp + (half / hyp) * thick / 2;
    B.add(GEO.box, roofColor, { x: 0, y: cy, z: cz, rx: side * slope, sx: w + overhang * 2, sy: thick, sz: len }, 'solid', M);
  }
}
