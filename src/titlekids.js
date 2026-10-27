import * as THREE from 'three';
import { GLTFLoader } from '../lib/addons/loaders/GLTFLoader.js';
import { MeshyBody } from './meshykid.js';
import { CHARACTERS } from './config.js';
import { HIGH } from './quality.js';

// ---------------------------------------------------------------------------
// The "Who's playing?" cards show the real 3D boys (no costumes). Each card
// gets its own little transparent renderer so it can sit on top of the glass
// card. The picked boy walks in place; the other stands and waits. Everything
// is torn down when the game starts so the world gets the GPU back.
// ---------------------------------------------------------------------------

const loader = new GLTFLoader(); // its own parse: the world's boys keep their own materials

function makeStage(card, kidId) {
  const canvas = card.querySelector('.pick-canvas');
  const cfg = CHARACTERS[kidId];
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: HIGH, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, HIGH ? 2 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffe6c8, 0x4a2c6e, 1.35));
  const key = new THREE.DirectionalLight(0xffd7a0, 2.2);
  key.position.set(1.6, 2.6, 2.4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xa070ff, 1.4); // purple moonlight from behind
  rim.position.set(-2, 1.6, -2);
  scene.add(rim);

  // soft glow disc on the ground under the boy
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 32),
    new THREE.MeshBasicMaterial({ color: 0x120820, transparent: true, opacity: 0.4 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  scene.add(shadow);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
  const stage = { kidId, card, canvas, renderer, scene, camera, body: null, pivot: new THREE.Group(), t: Math.random() * 3, walk: 0, cw: 0, ch: 0 };
  scene.add(stage.pivot);

  loader.loadAsync(cfg.model).then((gltf) => {
    const body = new MeshyBody(gltf, cfg.height, cfg);
    stage.body = body;
    stage.pivot.add(body.root);
    const s = cfg.height / 1.3; // keep the brothers' real size difference
    shadow.scale.setScalar(0.5 + 0.3 * s);
    card.classList.add('ready');
  }).catch((e) => {
    console.warn('title kid failed to load', kidId, e);
    card.classList.add('no-model');
  });
  return stage;
}

function resize(st) {
  const w = st.canvas.clientWidth, h = st.canvas.clientHeight;
  if (!w || !h || (w === st.cw && h === st.ch)) return;
  st.cw = w; st.ch = h;
  st.renderer.setSize(w, h, false);
  st.camera.aspect = w / h;
  // frame Carter's full height (the tallest) for both, so Jack is visibly smaller
  const H = CHARACTERS.carter.height;
  const dist = (H * 0.52) / Math.tan((st.camera.fov * Math.PI) / 360) / Math.min(1, st.camera.aspect * 1.25);
  st.camera.position.set(0, H * 0.5 + 0.06, dist);
  st.camera.lookAt(0, H * 0.5 - 0.02, 0);
  st.camera.updateProjectionMatrix();
}

export function initTitleKids() {
  const titleEl = document.getElementById('title');
  const cards = [...document.querySelectorAll('.pick-card')];
  if (!titleEl || !cards.length) return;
  let stages;
  try {
    stages = cards.map((c) => makeStage(c, c.dataset.kid));
  } catch (e) {
    console.warn('3D title kids unavailable', e);
    cards.forEach((c) => c.classList.add('no-model'));
    return;
  }

  const clock = new THREE.Clock();
  let raf = 0, alive = true;
  const frame = () => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    for (const st of stages) {
      if (!st.body) continue;
      resize(st);
      const picked = st.card.classList.contains('selected');
      st.t += dt;
      // the picked boy walks in place, turned a little toward the camera; the other idles and looks around
      st.walk += ((picked ? 1 : 0) - st.walk) * Math.min(1, dt * 8);
      st.body.update(dt, st.walk * 0.3, 1);
      const sway = picked ? 0.35 * Math.sin(st.t * 0.9) : -0.45 + 0.12 * Math.sin(st.t * 0.7);
      st.pivot.rotation.y += (sway - st.pivot.rotation.y) * Math.min(1, dt * 6);
      st.renderer.render(st.scene, st.camera);
    }
  };
  frame();

  // when the game starts the title hides: free the extra WebGL contexts
  new MutationObserver(() => {
    if (!titleEl.classList.contains('hidden') || !alive) return;
    alive = false;
    cancelAnimationFrame(raf);
    for (const st of stages) { st.renderer.dispose(); st.renderer.forceContextLoss(); }
  }).observe(titleEl, { attributes: true, attributeFilter: ['class'] });
}
