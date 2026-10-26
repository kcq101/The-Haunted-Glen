import * as THREE from 'three';
import { litMat } from './quality.js';
import { GEO, addGableRoof } from './builder.js';
import { addPumpkin, textTexture } from './decor.js';
import { storePos } from './terrain.js';
import { STORE } from './config.js';

// ---------------------------------------------------------------------------
// Hares Hill Halloween Emporium — a cozy cottage at the end of the woods trail
// ---------------------------------------------------------------------------

const SW = 12, SD = 9, SH = 4.2;

function toStoreWorld(lx, lz) {
  const r = STORE.facing, c = Math.cos(r), s = Math.sin(r);
  return { x: storePos.x + lx * c + lz * s, z: storePos.z - lx * s + lz * c };
}

export function buildStoreExterior(B, glows, scene, heightAt) {
  const y = heightAt(storePos.x, storePos.z);
  const M = new THREE.Matrix4().compose(
    new THREE.Vector3(storePos.x, y, storePos.z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, STORE.facing, 0)),
    new THREE.Vector3(1, 1, 1),
  );
  // stone base + timber walls
  B.add(GEO.box, '#8d8273', { y: 0.2, sx: SW + 0.6, sy: 1.6, sz: SD + 0.6 }, 'solid', M);
  B.add(GEO.box, '#e9dcc0', { y: SH / 2 + 0.9, sx: SW, sy: SH, sz: SD }, 'solid', M);
  for (const lx of [-SW / 2, -SW / 4, 0, SW / 4, SW / 2]) B.add(GEO.box, '#4a3020', { x: lx, y: SH / 2 + 0.9, z: SD / 2 + 0.05, sx: 0.3, sy: SH, sz: 0.12 }, 'solid', M);
  B.add(GEO.box, '#4a3020', { y: 2.7, z: SD / 2 + 0.06, sx: SW, sy: 0.25, sz: 0.12 }, 'solid', M);
  for (const lz of [-SD / 2, 0, SD / 2]) for (const sd of [-1, 1]) B.add(GEO.box, '#4a3020', { x: sd * (SW / 2 + 0.05), y: SH / 2 + 0.9, z: lz, sx: 0.12, sy: SH, sz: 0.3 }, 'solid', M);
  // steep storybook roof
  addGableRoof(B, { w: SW, d: SD, h: 5.2, overhang: 0.6, thick: 0.35, roofColor: '#7a5a9a', wallColor: '#e9dcc0', parent: M, y: SH + 0.9 });
  // dormer
  addGableRoof(B, { w: 3, d: 3.2, h: 1.8, overhang: 0.3, roofColor: '#7a5a9a', wallColor: '#e9dcc0', parent: M, x: 0, y: SH + 2.2, z: SD / 2 - 1.2, ry: Math.PI / 2 });
  B.add(GEO.box, '#e9dcc0', { x: 0, y: SH + 1.6, z: SD / 2 - 0.4, sx: 3.0, sy: 1.6, sz: 1.6 }, 'solid', M);
  B.add(GEO.box, '#ffffff', { x: 0, y: SH + 1.6, z: SD / 2 + 0.42, sx: 1.2, sy: 1.0, sz: 0.05 }, 'shopwin', M);
  // crooked chimney
  B.add(GEO.box, '#7a5a4a', { x: -SW / 2 + 2, y: SH + 5, z: -1, rz: 0.08, sx: 1.2, sy: 4.5, sz: 1.2 }, 'solid', M);
  B.add(GEO.box, '#5a4038', { x: -SW / 2 + 2.15, y: SH + 7.3, z: -1, rz: 0.08, sx: 1.5, sy: 0.4, sz: 1.5 }, 'solid', M);
  // round-top door
  B.add(GEO.box, '#7a3a7a', { y: 1.9, z: SD / 2 + 0.1, sx: 1.9, sy: 2.6, sz: 0.15 }, 'solid', M);
  B.add(GEO.cyl, '#7a3a7a', { y: 3.2, z: SD / 2 + 0.1, rx: Math.PI / 2, sx: 0.95, sy: 0.15, sz: 0.95 }, 'solid', M);
  B.add(GEO.sphere, '#e8c64a', { x: 0.55, y: 1.9, z: SD / 2 + 0.22, s: 0.16 }, 'solid', M);
  // stone landing + two steps down to the yard. Each block runs down into the
  // ground so there are no floating gaps, and each top is walkable.
  const steps = [];
  const stoneStep = (lz, d, w, top, col) => {
    B.add(GEO.box, col, { y: (top - 0.3) / 2, z: lz, sx: w, sy: top + 0.3, sz: d }, 'solid', M);
    B.add(GEO.box, '#a39886', { y: top - 0.03, z: lz + d / 2 - 0.06, sx: w + 0.04, sy: 0.06, sz: 0.14 }, 'solid', M); // lighter nosing so each step reads
    const p = toStoreWorld(0, lz);
    steps.push({ cx: p.x, cz: p.z, rot: STORE.facing, hw: w / 2, hd: d / 2, top: y + top, r: Math.hypot(w / 2, d / 2) + 0.3 });
  };
  stoneStep(SD / 2 + 0.85, 1.3, 3.4, 1.1, '#8d8273'); // landing at the door
  stoneStep(SD / 2 + 1.85, 0.7, 3.2, 0.74, '#857a6b');
  stoneStep(SD / 2 + 2.55, 0.7, 3.0, 0.37, '#7d7263');
  // big glowing shop windows with little panes
  for (const sd of [-1, 1]) {
    B.add(GEO.box, '#4a3020', { x: sd * 3.6, y: 2.6, z: SD / 2 + 0.06, sx: 3.0, sy: 2.2, sz: 0.12 }, 'solid', M);
    B.add(GEO.box, '#ffffff', { x: sd * 3.6, y: 2.6, z: SD / 2 + 0.13, sx: 2.6, sy: 1.8, sz: 0.04 }, 'shopwin', M);
    B.add(GEO.box, '#4a3020', { x: sd * 3.6, y: 2.6, z: SD / 2 + 0.17, sx: 0.08, sy: 1.8, sz: 0.04 }, 'solid', M);
    B.add(GEO.box, '#4a3020', { x: sd * 3.6, y: 2.6, z: SD / 2 + 0.17, sx: 2.6, sy: 0.08, sz: 0.04 }, 'solid', M);
    B.add(GEO.box, '#5b4a6e', { x: sd * 3.6, y: 3.85, z: SD / 2 + 0.6, rx: 0.5, sx: 3.2, sy: 0.1, sz: 1.2 }, 'solid', M);
    // window boxes with little pumpkins
    B.add(GEO.box, '#4a3020', { x: sd * 3.6, y: 1.4, z: SD / 2 + 0.35, sx: 2.8, sy: 0.35, sz: 0.5 }, 'solid', M);
  }
  // hanging lanterns by the door
  for (const sd of [-1, 1]) {
    const p = toStoreWorld(sd * 1.6, SD / 2 + 0.5);
    B.add(GEO.box, '#2b2b2b', { x: p.x, y: y + 3.4, z: p.z, sx: 0.08, sy: 0.6, sz: 0.08 });
    B.add(GEO.box, '#ffcf6a', { x: p.x, y: y + 2.95, z: p.z, sx: 0.35, sy: 0.45, sz: 0.35 }, 'lamp');
    glows.add({ x: p.x, y: y + 2.95, z: p.z }, '#ffc25a', 3.2, 0.35, 0.5);
  }
  // pumpkin piles and a hay bale
  const rng = (() => { let k = 3; return () => ((k = (k * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < 12; i++) {
    const sd = i % 2 ? 1 : -1;
    const p = toStoreWorld(sd * (2.5 + rng() * 3.2), SD / 2 + 1.6 + rng() * 2.2); // clear of the steps
    addPumpkin(B, glows, p.x, heightAt(p.x, p.z), p.z, 0.3 + rng() * 0.35, STORE.facing, rng() < 0.4, ['#ef7d1f', '#f2eee0', '#e2a03a', '#d8662a'][(rng() * 4) | 0]);
  }
  // weathervane hare on the roof ridge
  const hare = new THREE.Shape();
  hare.moveTo(-1, 0); hare.lineTo(0.8, 0); hare.quadraticCurveTo(1.2, 0.5, 0.8, 0.8);
  hare.lineTo(0.95, 1.9); hare.lineTo(0.75, 1.9); hare.lineTo(0.6, 1.0);
  hare.lineTo(0.5, 1.9); hare.lineTo(0.3, 1.9); hare.lineTo(0.35, 0.9);
  hare.quadraticCurveTo(-0.6, 1.0, -1, 0.4); hare.closePath();
  const hg = new THREE.ExtrudeGeometry(hare, { depth: 0.08, bevelEnabled: false });
  const hm = new THREE.Mesh(hg, litMat({ color: '#2b2622' }));
  hm.position.set(storePos.x, y + SH + 0.9 + 5.4, storePos.z);
  hm.rotation.y = STORE.facing + 0.4;
  hm.scale.setScalar(0.9);
  scene.add(hm);

  // shop sign: a big painted board on posts out front where the trail arrives
  const tex = textTexture(['Hares Hill', 'Halloween Emporium'], { w: 1024, h: 256, bg: '#3a2448', fg: '#ffd27a', border: '#e8c64a', font: 'bold 76px Georgia, serif' });
  const sp = toStoreWorld(-4.9, SD / 2 + 5.2);
  const sgy = heightAt(sp.x, sp.z);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  sign.position.set(sp.x, sgy + 2.3, sp.z);
  sign.rotation.y = STORE.facing + 0.35;
  scene.add(sign);
  for (const sd of [-1, 1]) {
    const c = Math.cos(STORE.facing + 0.35), s2 = Math.sin(STORE.facing + 0.35);
    B.add(GEO.box, '#4a3020', { x: sp.x + sd * 2.75 * c, y: sgy + 1.3, z: sp.z - sd * 2.75 * s2, sx: 0.2, sy: 2.6, sz: 0.2, ry: STORE.facing + 0.35 });
  }
  const signGlow = glows.add({ x: sp.x, y: sgy + 2.3, z: sp.z }, '#ffd27a', 4, 0.0, 0);
  // small sign over the door too
  const tex2 = textTexture(['COSTUMES'], { w: 512, h: 128, bg: '#3a2448', fg: '#ffd27a', border: '#e8c64a', font: 'bold 72px Georgia, serif' });
  const small = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: tex2 }));
  const dp = toStoreWorld(0, SD / 2 + 0.3);
  small.position.set(dp.x, y + 4.55, dp.z);
  small.rotation.y = STORE.facing;
  scene.add(small);
  // string lights along the front eave
  for (let i = 0; i <= 18; i++) {
    const p = toStoreWorld(-SW / 2 + (i / 18) * SW, SD / 2 + 0.75);
    const col = ['#ff8a1f', '#9b5cff', '#7cff6b'][i % 3];
    const ly = y + SH + 0.55 - Math.sin(((i % 3) / 3) * Math.PI) * 0.15;
    B.add(GEO.sphere, col, { x: p.x, y: ly, z: p.z, s: 0.16 }, 'lamp');
    if (i % 2 === 0) glows.add({ x: p.x, y: ly, z: p.z }, col, 1.2, 0.2, 0.3);
  }
  // a warm magical glow so the shop always feels welcoming
  const shopLight = new THREE.PointLight('#ffbb77', 40, 26, 1.5);
  const lp = toStoreWorld(0, SD / 2 + 4);
  shopLight.position.set(lp.x, y + 4, lp.z);
  scene.add(shopLight);

  const door = toStoreWorld(0, SD / 2 + 2.4);
  const collider = { x: storePos.x, z: storePos.z, hw: SW / 2 + 0.4, hd: SD / 2 + 0.4, rot: STORE.facing };
  return { door: { ...door, y: heightAt(door.x, door.z) }, collider, signGlow, steps };
}

export const HAZEL_LINES = {
  welcome: [
    "Welcome to Hares Hill! I'm Hazel. Tap anything on the shelves to try it on!",
    "Ooh, visitors! Come in, come in. The costumes don't bite... mostly.",
    "Hop on in! Tap anything on the shelves to try it on.",
  ],
  off: ['Off it comes!', 'Back on the shelf it goes.', 'Tap it again any time!'],
  buy: ['A splendid choice!', 'Oh, that looks hare-raisingly good!', "Wear it well, little one!", 'Spooktacular!'],
  poor: ["You'll need a bit more candy for that one. Try trick-or-treating at the glowing doors!", 'Almost! Knock on a few more doors for candy.'],
  reward: ['Only the bravest find that one... in the haunted house!'],
};
