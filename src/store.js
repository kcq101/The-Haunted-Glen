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

// --- shopkeeper -------------------------------------------------------------
export function makeHare() {
  const g = new THREE.Group();
  const fur = litMat({ color: '#b89a78' });
  const light = litMat({ color: '#efe3d0' });
  const vest = litMat({ color: '#6a3a8a' });
  const dark = new THREE.MeshBasicMaterial({ color: '#1a1410' });
  const S = new THREE.SphereGeometry(1, 18, 14);
  const m = (mat, x, y, z, sx, sy, sz, parent = g) => {
    const o = new THREE.Mesh(S, mat);
    o.position.set(x, y, z); o.scale.set(sx, sy, sz);
    o.castShadow = true;
    parent.add(o);
    return o;
  };
  m(vest, 0, 1.0, 0, 0.5, 0.62, 0.42);
  m(light, 0, 1.0, 0.25, 0.3, 0.45, 0.22);
  m(fur, 0, 0.35, 0, 0.45, 0.35, 0.4);
  const head = new THREE.Group();
  head.position.set(0, 1.85, 0.05);
  g.add(head);
  m(fur, 0, 0, 0, 0.38, 0.36, 0.38, head);
  m(light, 0, -0.1, 0.28, 0.2, 0.15, 0.14, head);
  m(new THREE.MeshBasicMaterial({ color: '#d98a8a' }), 0, -0.02, 0.4, 0.06, 0.05, 0.04, head);
  for (const sd of [-1, 1]) {
    m(dark, sd * 0.16, 0.08, 0.31, 0.06, 0.08, 0.04, head);
    const ear = new THREE.Group();
    ear.position.set(sd * 0.14, 0.3, -0.05);
    ear.rotation.z = sd * -0.15;
    head.add(ear);
    m(fur, 0, 0.45, 0, 0.11, 0.5, 0.07, ear);
    m(litMat({ color: '#e2a6a0' }), 0, 0.45, 0.04, 0.06, 0.4, 0.03, ear);
    // spectacles
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.015, 6, 14), new THREE.MeshBasicMaterial({ color: '#c9a640' }));
    ring.position.set(sd * 0.16, 0.08, 0.36);
    head.add(ring);
    m(fur, sd * 0.5, 1.05, 0.1, 0.13, 0.42, 0.13);
  }
  // little top hat
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.3, 14), litMat({ color: '#2a1f30' }));
  hat.position.set(0.15, 0.34, 0); hat.rotation.z = -0.25;
  head.add(hat);
  g.userData.head = head;
  return g;
}

// --- interior (its own little scene) ----------------------------------------
export function buildStoreInterior() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2a1b2e');
  scene.fog = new THREE.Fog('#2a1b2e', 18, 40);
  scene.add(new THREE.HemisphereLight('#ffe2b8', '#4a2e3a', 1.6));
  const key = new THREE.PointLight('#ffc27a', 30, 25, 1.6);
  key.position.set(0, 5, 3);
  scene.add(key);
  const spot = new THREE.DirectionalLight('#ffe9c8', 1.4);
  spot.position.set(3, 8, 6);
  scene.add(spot);

  const W = 16, D = 12, H = 6;
  const floorC = document.createElement('canvas');
  floorC.width = 256; floorC.height = 256;
  const fg = floorC.getContext('2d');
  for (let i = 0; i < 16; i++) {
    fg.fillStyle = ['#8a5a36', '#7d5130', '#946240', '#82552f'][i % 4];
    fg.fillRect(0, i * 16, 256, 16);
    fg.fillStyle = 'rgba(0,0,0,0.25)';
    fg.fillRect(0, i * 16, 256, 1);
    fg.fillRect(((i * 97) % 256), i * 16, 1, 16);
  }
  const ft = new THREE.CanvasTexture(floorC);
  ft.colorSpace = THREE.SRGBColorSpace;
  ft.wrapS = ft.wrapT = THREE.RepeatWrapping;
  ft.repeat.set(3, 3);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), litMat({ map: ft }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const wallMat = litMat({ color: '#5a3a5e' });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat);
  back.position.set(0, H / 2, -D / 2);
  scene.add(back);
  for (const sd of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMat);
    side.position.set(sd * W / 2, H / 2, 0);
    side.rotation.y = -sd * Math.PI / 2;
    scene.add(side);
  }
  // wainscoting + beams
  const wood = litMat({ color: '#4a3020' });
  const box = (mat, x, y, z, sx, sy, sz, ry = 0) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    o.position.set(x, y, z); o.rotation.y = ry;
    scene.add(o);
    return o;
  };
  box(wood, 0, 0.6, -D / 2 + 0.05, W, 1.2, 0.1);
  for (let x = -6; x <= 6; x += 4) box(wood, x, H - 0.2, 0, 0.3, 0.3, D);
  // shelves full of costume goodies
  const colors = ['#ef7d1f', '#7a4cff', '#2eaa4a', '#e63b3b', '#f2f0e6', '#2f6fd6', '#ffd23f', '#1b1b1f'];
  let ci = 0;
  for (const sx of [-5, 0, 5]) {
    for (let row = 0; row < 3; row++) {
      box(wood, sx, 1.6 + row * 1.25, -D / 2 + 0.45, 4.2, 0.12, 0.8);
      for (let k = 0; k < 5; k++) {
        const c = colors[ci++ % colors.length];
        const kind = (ci * 7) % 3;
        const geo = kind === 0 ? new THREE.ConeGeometry(0.28, 0.55, 10) : kind === 1 ? new THREE.SphereGeometry(0.28, 10, 8) : new THREE.BoxGeometry(0.45, 0.5, 0.35);
        const o = new THREE.Mesh(geo, litMat({ color: c }));
        o.position.set(sx - 1.6 + k * 0.8, 1.6 + row * 1.25 + 0.32, -D / 2 + 0.45);
        scene.add(o);
      }
    }
  }
  // counter with the shopkeeper
  box(wood, 2.3, 0.6, -2.2, 3.0, 1.2, 1.2);
  box(litMat({ color: '#6a3a8a' }), 2.3, 1.25, -2.2, 3.2, 0.1, 1.4);
  const hare = makeHare();
  hare.position.set(2.4, 0, -3.3);
  hare.rotation.y = -0.5;
  scene.add(hare);
  // costume racks
  for (const sx of [-5.5, -3.2]) {
    box(litMat({ color: '#c9a640' }), sx, 1.9, 1.5, 1.8, 0.06, 0.06);
    for (const k of [-0.6, 0, 0.6]) {
      const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.3, 10), litMat({ color: colors[(ci++) % colors.length] }));
      cloak.position.set(sx + k, 1.2, 1.5);
      scene.add(cloak);
    }
    box(litMat({ color: '#c9a640' }), sx - 0.85, 0.95, 1.5, 0.06, 1.9, 0.06);
    box(litMat({ color: '#c9a640' }), sx + 0.85, 0.95, 1.5, 0.06, 1.9, 0.06);
  }
  // round fitting rug + mirror where the kid stands
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.8, 28), litMat({ color: '#8a2a4a' }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.02, 1.2);
  scene.add(rug);
  const rug2 = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.6, 28), new THREE.MeshBasicMaterial({ color: '#e8c64a' }));
  rug2.rotation.x = -Math.PI / 2; rug2.position.set(0, 0.03, 1.2);
  scene.add(rug2);
  // hanging jack-o'-lantern lamps
  const lamps = [];
  for (const [x, z] of [[-4, -1], [0, -2], [4, 1], [-2, 3]]) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), new THREE.MeshBasicMaterial({ color: '#ff9a2a' }));
    p.scale.y = 0.8;
    p.position.set(x, H - 1.2, z);
    scene.add(p);
    box(new THREE.MeshBasicMaterial({ color: '#222' }), x, H - 0.6, z, 0.03, 1.0, 0.03);
    lamps.push(p);
  }
  // cobwebs in the corners (just for fun)
  const web = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#d8d0e8', transparent: true, opacity: 0.5 }));
  const wp = [];
  for (let i = 0; i < 6; i++) { const a = (i / 5) * Math.PI / 2; wp.push(0, 0, 0, Math.cos(a) * 1.5, -Math.sin(a) * 1.5, 0); }
  for (let r = 0.4; r < 1.5; r += 0.35) for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI / 2, b = ((i + 1) / 5) * Math.PI / 2;
    wp.push(Math.cos(a) * r, -Math.sin(a) * r, 0, Math.cos(b) * r, -Math.sin(b) * r, 0);
  }
  web.geometry.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  web.position.set(-W / 2 + 0.05, H, -D / 2 + 0.05);
  scene.add(web);

  return {
    scene,
    hare,
    stand: new THREE.Vector3(0, 0, 1.2),
    update(time) {
      hare.userData.head.rotation.z = Math.sin(time * 1.5) * 0.06;
      hare.userData.head.rotation.y = Math.sin(time * 0.7) * 0.2;
      lamps.forEach((l, i) => (l.material.color.setHSL(0.07, 1, 0.5 + Math.sin(time * 7 + i) * 0.04)));
    },
  };
}

export const HAZEL_LINES = {
  welcome: [
    "Welcome to Hares Hill! I'm Hazel. Try on anything you like!",
    "Ooh, visitors! Come in, come in. The costumes don't bite... mostly.",
    "Hop on in! Tap a costume to try it on.",
  ],
  buy: ['A splendid choice!', 'Oh, that looks hare-raisingly good!', "Wear it well, little one!", 'Spooktacular!'],
  poor: ["You'll need a bit more candy for that one. Try trick-or-treating at the glowing doors!", 'Almost! Knock on a few more doors for candy.'],
  reward: ['Only the bravest find that one... in the haunted house!'],
};
