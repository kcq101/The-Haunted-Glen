import * as THREE from 'three';
import { GLTFLoader } from '../lib/addons/loaders/GLTFLoader.js';

// ---------------------------------------------------------------------------
// Kick scooters (Meshy models). The scooter models come without wheels, so
// the separate wheel model is dropped onto each axle and spun as they roll.
//
// Spots below are in the scooter model's own units (front of the scooter
// points toward -x, the handlebar is at +y, the deck runs along x).
// ---------------------------------------------------------------------------

export const SCOOTER_WHEEL = 'assets/models/scooter_wheel.glb';
const WHEEL_R_MODEL = 0.952; // radius of the wheel model as it comes from Meshy
export const SHIFT = 0.45; // how far (as a share of the left foot's offset) the scooter sits toward the kid's left

export const SCOOTERS = {
  blue: {
    glb: 'assets/models/scooter_blue.glb',
    front: [-0.915, -0.66], // axle x, y
    rear: [0.72, -0.66],
    r: 0.2, // wheel radius
    deckTop: -0.662,
    deck: [-0.4, 0.56], // standing room along x
    grip: [-0.5, 0.66, 0.52], // handlebar grip center x, y, |z|
  },
  red: {
    glb: 'assets/models/scooter_red.glb',
    front: [-0.9, -0.57],
    rear: [0.76, -0.57],
    r: 0.2,
    deckTop: -0.566,
    deck: [-0.52, 0.55],
    grip: [-0.56, 0.6, 0.52],
  },
};

const loader = new GLTFLoader();
const cache = new Map();
function load(url) {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url));
  return cache.get(url);
}

// No environment map in this world, so metal would read as black; keep it satin.
function tidy(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = false;
    const m = o.material;
    m.metalness = 0;
    m.metalnessMap = null;
    m.roughness = 0.75;
    m.envMapIntensity = 0;
    m.needsUpdate = true;
  });
  return root;
}

// Preload both scooters and the wheel (returns a promise).
export function preloadScooters() {
  return Promise.all([load(SCOOTER_WHEEL), ...Object.values(SCOOTERS).map((s) => load(s.glb))]);
}

// Build one scooter sized for a kid.
//  fit: { shoulderY, shoulderX, reach } in the kid's body space (meters).
// The scooter group's origin is on the ground where the kid stands; the deck
// top is at `deckH` and the handlebar grips are exposed for the arms.
export async function buildScooter(color, fit) {
  const spec = SCOOTERS[color];
  const [sg, wg] = await Promise.all([load(spec.glb), load(SCOOTER_WHEEL)]);
  const ground = spec.front[1] - spec.r;

  // Size: grips a bit below the shoulders, an easy reach in front of the kid.
  const dy = fit.reach * 0.42;
  const s = (fit.shoulderY - dy) / (spec.grip[1] - spec.deckTop);
  const deckH = (spec.deckTop - ground) * s;
  const dz = Math.max(0, spec.grip[2] * s - fit.shoulderX);
  const fwd = Math.sqrt(Math.max(0.01, (fit.reach * 0.9) ** 2 - dy * dy - dz * dz));
  const lo = spec.deck[0] + 0.12, hi = spec.deck[1] - 0.12;
  const kx = Math.min(hi, Math.max(lo, spec.grip[0] + fwd / s)); // where the kid stands (model x)

  const outer = new THREE.Group(); // in the kid's body: +z forward, y=0 on the ground
  outer.rotation.y = Math.PI / 2; // model -x (front) -> +z
  outer.position.x = (fit.footX || 0) * SHIFT; // the kid rides a little right of center; his left foot reaches in to the middle of the deck
  const inner = new THREE.Group();
  inner.scale.setScalar(s);
  inner.position.set(-kx * s, -ground * s, 0);
  outer.add(inner);
  inner.add(tidy(sg.scene.clone(true)));

  const wheels = [];
  const wheelProto = tidy(wg.scene.clone(true));
  for (const [x, y] of [spec.front, spec.rear]) {
    const w = wheelProto.clone(true);
    w.scale.setScalar(spec.r / WHEEL_R_MODEL);
    w.position.set(x, y, 0);
    inner.add(w);
    wheels.push(w);
  }
  const grips = [-1, 1].map((side) => { // [right hand, left hand]
    const g = new THREE.Object3D();
    g.position.set(spec.grip[0], spec.grip[1] - 0.03, side * spec.grip[2]);
    inner.add(g);
    return g;
  });
  return { group: outer, deckH, wheels, grips, wheelR: spec.r * s };
}
