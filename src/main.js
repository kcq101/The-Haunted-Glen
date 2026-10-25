import * as THREE from 'three';
import { litMat, HIGH, setQuality } from './quality.js';
import { CHARACTERS, BOUNDS, px, HOME_ID, STORE } from './config.js';
import { createTerrain, storePos, setElevation } from './terrain.js';
import { makeHouseSpecs, groundMarks, buildHouses } from './houses.js';
import { Builder } from './builder.js';
import { createTrees, createFallingLeaves } from './nature.js';
import { createBackdrop } from './backdrop.js';
import { GlowField } from './glow.js';
import { DayNight, NIGHT_START } from './sky.js';
import { decorateNeighborhood, addStreetLamps, addTrail, hauntHome, addBoundaryFence } from './decor.js';
import { buildStoreExterior, buildStoreInterior, HAZEL_LINES } from './store.js';
import { Kid } from './character.js';
import { Controls } from './controls.js';
import { ITEMS, ITEM, SLOTS } from './costumes.js';
import { HauntedHouse, CORN_TOTAL, CORN_REWARDS } from './haunted2d.js';
import { initAudio, sfx, setMuted, isMuted, updateAmbient } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { clamp } from './util.js';

const $ = (id) => document.getElementById(id);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

window.addEventListener('error', (e) => showError(e.message));
window.addEventListener('unhandledrejection', (e) => showError(String(e.reason)));
function showError(msg) {
  const el = $('error');
  el.textContent = `Oops: ${msg}`;
  el.classList.remove('hidden');
}

// Graphics quality toggle on the title screen (reloads to rebuild the world)
{
  const qb = $('quality-btn');
  qb.textContent = HIGH ? '✨ Graphics: High' : '🔋 Graphics: Low (faster)';
  qb.addEventListener('click', () => setQuality(HIGH ? 'low' : 'high'));
}

// ---------------------------------------------------------------------------
// Renderer + world
// ---------------------------------------------------------------------------
const canvas = $('world');
// High quality: always antialiased. Low: the original lighter settings.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: HIGH || (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
// PCF honours shadow.radius (set in sky.js) for soft edges at 2048
renderer.shadowMap.type = HIGH ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.3, 330); // near 0.3 = sharper depth, less flicker
const sky = new DayNight(scene);
const glows = new GlowField(2500);
scene.add(glows.points);
// soft "moonlight" that follows the kids so they stay visible at night
const kidLight = new THREE.PointLight('#cfdcff', 0, 14, 1.4);
scene.add(kidLight);

const save = loadSave();
const kids = { carter: new Kid(CHARACTERS.carter), jack: new Kid(CHARACTERS.jack) };
kids.carter.setCostume(save.outfits.carter);
kids.jack.setCostume(save.outfits.jack);
for (const k of Object.values(kids)) if (k.cfg.model) k.loadModel(k.cfg.model);
let current = save.current in kids ? save.current : 'carter';
const other = () => (current === 'carter' ? 'jack' : 'carter');

const W = {}; // world bits filled in by buildWorld()
const mats = {
  solid: litMat({ vertexColors: true }),
  window: new THREE.MeshBasicMaterial({ vertexColors: true }),
  lamp: new THREE.MeshBasicMaterial({ vertexColors: true }),
  shopwin: new THREE.MeshBasicMaterial({ vertexColors: true }),
};

function buildWorld() {
  const specs = makeHouseSpecs();
  const marks = groundMarks(specs);
  const storePad = { x: storePos.x, z: storePos.z, rot: STORE.facing, hw: 7.5, hd: 8.5 };
  const terrain = createTerrain([...specs.map((s) => s.pad), storePad], marks.driveways, marks.walkways);
  scene.add(terrain.mesh);
  W.heightAt = terrain.heightAt;
  // countryside, farms and hazy hills beyond the neighborhood
  W.backdrop = createBackdrop(scene, terrain, renderer.getPixelRatio());
  W.specs = specs;

  const B = new Builder();
  W.colliders = buildHouses(B, specs, terrain.heightAt);
  // walkable step/porch tops in world space
  W.steps = [];
  for (const s of specs) {
    for (const st of s.steps || []) {
      const c = Math.cos(s.rot), sn = Math.sin(s.rot);
      W.steps.push({ cx: s.x + st.x * c + st.z * sn, cz: s.z - st.x * sn + st.z * c, rot: s.rot, hw: st.hw, hd: st.hd, top: s.y + st.top, r: Math.hypot(st.hw, st.hd) + 0.3 });
    }
  }
  decorateNeighborhood(B, glows, specs, terrain.heightAt);
  addStreetLamps(B, glows, terrain.heightAt);
  addBoundaryFence(B, terrain.heightAt);
  const trail = addTrail(B, glows, scene, terrain.heightAt);
  W.bridge = trail.bridge;
  const home = specs.find((s) => s.id === HOME_ID);
  W.home = home;
  W.haunt = hauntHome(B, glows, scene, home, terrain.heightAt);
  const store = buildStoreExterior(B, glows, scene, terrain.heightAt);
  W.store = store;
  W.colliders.push(store.collider);
  W.steps.push(...store.steps);
  const meshes = B.build(mats);
  for (const m of meshes) {
    m.castShadow = m.name === 'solid';
    m.receiveShadow = m.name === 'solid';
    scene.add(m);
  }
  const trees = createTrees(specs, terrain.heightAt);
  scene.add(trees.group);
  W.trees = trees.trees;
  // spatial hash of tree trunks for collisions
  W.treeGrid = new Map();
  for (const t of trees.trees) {
    const k = `${Math.floor(t.x / 8)},${Math.floor(t.z / 8)}`;
    if (!W.treeGrid.has(k)) W.treeGrid.set(k, []);
    W.treeGrid.get(k).push(t);
  }
  W.leaves = createFallingLeaves();
  scene.add(W.leaves.points);

  // trick-or-treat doors (everyone except home)
  W.doors = specs.filter((s) => !s.home).map((s) => {
    const y = terrain.heightAt(s.doorWorld.x, s.doorWorld.z);
    const glow = glows.add({ x: s.doorWorld.x, y: y + 1.3, z: s.doorWorld.z }, '#ffcf6a', 3.4, 0.55, 0.15);
    return { id: s.id, x: s.doorWorld.x, z: s.doorWorld.z, y, glow, spec: s };
  });
  W.homeDoor = { x: home.doorWorld.x, z: home.doorWorld.z };
  W.interior = buildStoreInterior();
}

// ---------------------------------------------------------------------------
// Player state
// ---------------------------------------------------------------------------
const player = { x: 0, z: 0, y: 0, yaw: Math.PI, busy: 0 };
const follower = { x: 0, z: 0, y: 0, yaw: Math.PI };
const cam = { yaw: Math.PI, pitch: 0.38, dist: 6.2, pos: new THREE.Vector3(), target: new THREE.Vector3() };
let mode = 'title'; // title | world | shop | haunted
let time = 0;
let lastT = performance.now();

function placeAtHome() {
  const s = W.home;
  const p = { x: s.doorWorld.x, z: s.doorWorld.z };
  const dirX = Math.sin(s.rot), dirZ = Math.cos(s.rot);
  player.x = p.x + dirX * 6; player.z = p.z + dirZ * 6;
  player.yaw = s.rot;
  follower.x = player.x - 1.6; follower.z = player.z - 1;
  cam.yaw = s.rot; // camera out by the street, looking back at the kids and the haunted house
}

// ---------------------------------------------------------------------------
// Collision helpers
// ---------------------------------------------------------------------------
const R = 0.38;
function pushOut(p) {
  for (const c of W.colliders) {
    const dx = p.x - c.x, dz = p.z - c.z;
    const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
    let lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
    const ex = c.hw + R, ez = c.hd + R;
    if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
      const px1 = ex - Math.abs(lx), pz1 = ez - Math.abs(lz);
      if (px1 < pz1) lx = Math.sign(lx || 1) * ex; else lz = Math.sign(lz || 1) * ez;
      p.x = c.x + lx * cs + lz * sn;
      p.z = c.z - lx * sn + lz * cs;
    }
  }
  const gx = Math.floor(p.x / 8), gz = Math.floor(p.z / 8);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const list = W.treeGrid.get(`${gx + i},${gz + j}`);
    if (!list) continue;
    for (const t of list) {
      const rr = (t.woods ? 0.45 : 0.32) * t.s + R;
      const dx = p.x - t.x, dz = p.z - t.z, d = Math.hypot(dx, dz);
      if (d < rr && d > 0.0001) { p.x = t.x + (dx / d) * rr; p.z = t.z + (dz / d) * rr; }
    }
  }
  const a = px(BOUNDS.minX, BOUNDS.minY), b = px(BOUNDS.maxX, BOUNDS.maxY);
  p.x = clamp(p.x, a.x, b.x);
  p.z = clamp(p.z, a.z, b.z);
}

function groundY(x, z) {
  let y = W.heightAt(x, z);
  // front steps and porches
  for (const st of W.steps) {
    if (Math.abs(x - st.cx) > st.r || Math.abs(z - st.cz) > st.r) continue;
    const dx = x - st.cx, dz = z - st.cz;
    const lx = dx * Math.cos(st.rot) - dz * Math.sin(st.rot);
    const lz = dx * Math.sin(st.rot) + dz * Math.cos(st.rot);
    if (Math.abs(lx) <= st.hw + 0.15 && Math.abs(lz) <= st.hd + 0.15) y = Math.max(y, st.top);
  }
  const br = W.bridge;
  if (br) {
    const dx = x - br.x, dz = z - br.z;
    const along = dx * Math.sin(br.ang) + dz * Math.cos(br.ang);
    const across = dx * Math.cos(br.ang) - dz * Math.sin(br.ang);
    if (Math.abs(along) < br.len / 2 && Math.abs(across) < br.halfW) {
      const t = along / br.len;
      y = Math.max(y, br.deckY + Math.cos(t * Math.PI) * 0.35 + 0.08);
    }
  }
  return y;
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
let toastTimer = 0;
function toast(msg, secs = 3.2) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  toastTimer = secs;
}
function hideToast() { toastTimer = 0; $('toast').classList.add('hidden'); }
let bubbleTimer = 0;
function bubble(name, text, secs = 3.2) {
  $('bubble-name').textContent = name;
  $('bubble-text').textContent = text;
  const el = $('bubble');
  el.classList.remove('hidden');
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  bubbleTimer = secs;
}
let roomTimer = 0;
function roomLabel(text) {
  const el = $('room-label');
  el.textContent = text;
  el.classList.remove('hidden');
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  roomTimer = 2.4;
}
function updateCounters() {
  $('candy-count').textContent = save.candy;
  $('corn-count').textContent = `${save.found.length}/${CORN_TOTAL}`;
  $('corn-pill').classList.toggle('hidden', save.found.length === 0 && mode !== 'haunted');
}
function bump(id) {
  const el = $(id);
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 220);
}
function candyBurst(n) {
  const box = $('candy-burst');
  const target = $('candy-pill').getBoundingClientRect();
  for (let i = 0; i < Math.min(n, 6); i++) {
    const s = document.createElement('div');
    s.className = 'candy-fly';
    s.textContent = pick(['🍬', '🍭', '🍫', '🍬']);
    const sx = window.innerWidth / 2 + (Math.random() - 0.5) * 80, sy = window.innerHeight * 0.55 + (Math.random() - 0.5) * 40;
    s.style.left = `${sx}px`; s.style.top = `${sy}px`;
    s.style.setProperty('--tx', `${target.left + 20 - sx}px`);
    s.style.setProperty('--ty', `${target.top + 10 - sy}px`);
    s.style.animationDelay = `${i * 0.08}s`;
    box.appendChild(s);
    setTimeout(() => s.remove(), 1500);
  }
  setTimeout(() => { updateCounters(); bump('candy-pill'); }, 700);
}
function fadeTo(fn) {
  const f = $('fade');
  f.classList.add('on');
  setTimeout(() => { fn(); setTimeout(() => f.classList.remove('on'), 60); }, 380);
}
function updateSwapButton() {
  const o = other();
  const face = $('swap-face');
  face.textContent = CHARACTERS[o].name[0];
  face.className = `swap-face ${o}`;
  $('swap-name').textContent = `Play as ${CHARACTERS[o].name}`;
  $('shop-swap').textContent = `Dress ${CHARACTERS[o].name}`;
}

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------
let currentAction = null;

function nearestAction() {
  if (mode === 'haunted') return haunted.actionLabel();
  if (mode !== 'world' || player.busy > 0) return null;
  let best = null, bd = 2.8;
  const consider = (d, a) => { if (d < bd) { bd = d; best = a; } };
  for (const d of W.doors) {
    const dist = Math.hypot(d.x - player.x, d.z - player.z);
    const done = save.knocked[d.id] === save.nightNumber;
    consider(dist, done ? { kind: 'knocked', label: 'Visited', icon: '✅', door: d } : { kind: 'knock', label: 'Trick or treat!', icon: '🚪', door: d });
  }
  consider(Math.hypot(W.homeDoor.x - player.x, W.homeDoor.z - player.z), { kind: 'haunted', label: 'Enter… if you dare!', icon: '👻' });
  consider(Math.hypot(W.store.door.x - player.x, W.store.door.z - player.z) - 0.6, { kind: 'shop', label: 'Go shopping', icon: '🛍️' });
  return best;
}

function doAction() {
  if (!currentAction) return;
  initAudio();
  const a = currentAction;
  if (a.kind === 'boo' || a.kind === 'exit') { haunted.action(); return; }
  if (a.kind === 'knock') knock(a.door);
  else if (a.kind === 'knocked') bubble('Neighbor', pick(["We already gave you candy! Come back next night!", 'See you next round, trick-or-treater!']));
  else if (a.kind === 'haunted') enterHaunted();
  else if (a.kind === 'shop') enterShop();
}

const NEIGHBOR_LINES = [
  (n) => `Happy Halloween, ${n}!`,
  () => 'Trick or treat? Treat it is!',
  () => 'Ooh, spooky! Here you go!',
  () => "Don't eat it all at once!",
  (n) => `Well hello, ${n}! Take a handful!`,
];
function knock(door) {
  player.busy = 1.4;
  sfx.knock();
  glows.setAlpha(door.glow, 2.2);
  // face the door
  player.yaw = Math.atan2(door.x - player.x, door.z - player.z);
  setTimeout(() => {
    const kid = CHARACTERS[current];
    const outfit = kids[current].costume.outfit && ITEM[kids[current].costume.outfit];
    const line = outfit && Math.random() < 0.6 ? `Wow, a ${outfit.name}! Here's some candy!` : pick(NEIGHBOR_LINES)(kid.name);
    bubble('Neighbor', line);
    const n = 2 + ((Math.random() * 3) | 0);
    save.candy += n;
    save.knocked[door.id] = save.nightNumber;
    writeSave(save);
    sfx.candy();
    candyBurst(n);
    glows.setAlpha(door.glow, 0.12);
    const left = W.doors.filter((d) => save.knocked[d.id] !== save.nightNumber).length;
    if (left === 0) setTimeout(() => toast('You visited every house! 🎉 More candy next night.'), 1800);
  }, 750);
}

function refreshDoorGlows() {
  for (const d of W.doors) glows.setAlpha(d.glow, save.knocked[d.id] === save.nightNumber ? 0.12 : 1);
}

// ---------------------------------------------------------------------------
// Haunted house
// ---------------------------------------------------------------------------
const haunted = new HauntedHouse($('haunted'), { carter: CHARACTERS.carter.name, jack: CHARACTERS.jack.name });

function enterHaunted() {
  sfx.door();
  fadeTo(() => {
    mode = 'haunted';
    controls.reset();
    hideToast();
    canvas.classList.add('hidden');
    $('haunted').classList.remove('hidden');
    $('btn-time').classList.add('hidden');
    haunted.start(CHARACTERS[current], kids[current].costume, save, {
      onExit: leaveHaunted,
      onRoom: (name) => roomLabel(name),
      onCandy: (n) => { save.candy += n; writeSave(save); updateCounters(); bump('candy-pill'); },
      onCorn: (count) => {
        writeSave(save);
        updateCounters();
        bump('corn-pill');
        const reward = CORN_REWARDS.find((r) => r.at === count);
        if (reward && !save.owned.includes(reward.item)) {
          save.owned.push(reward.item);
          writeSave(save);
          setTimeout(() => showReward(reward.item), 900);
        } else toast(`Golden candy corn: ${count} of ${CORN_TOTAL}!`);
      },
    });
    updateCounters();
    toast('Find the 8 golden candy corns! Tap BOO! to scare ghosts.', 4);
  });
}

function leaveHaunted() {
  fadeTo(() => {
    mode = 'world';
    controls.reset();
    $('haunted').classList.add('hidden');
    canvas.classList.remove('hidden');
    $('btn-time').classList.remove('hidden');
    const s = W.home;
    player.x = s.doorWorld.x + Math.sin(s.rot) * 1.5;
    player.z = s.doorWorld.z + Math.cos(s.rot) * 1.5;
    player.yaw = s.rot;
    cam.yaw = s.rot + Math.PI;
    cam.snap = true;
    updateCounters();
  });
}

function showReward(itemId) {
  const it = ITEM[itemId];
  $('reward-emoji').textContent = it.emoji;
  $('reward-title').textContent = `You won the ${it.name}!`;
  $('reward-text').textContent = 'Wear it from Hares Hill Halloween Emporium — it\'s free for brave ghost hunters!';
  $('reward').classList.remove('hidden');
  sfx.chime();
}
$('reward-ok').addEventListener('click', () => $('reward').classList.add('hidden'));

// ---------------------------------------------------------------------------
// Shop
// ---------------------------------------------------------------------------
let shopSlot = 'hat';
let preview = null; // { slot, id }

function enterShop() {
  sfx.door();
  fadeTo(() => {
    mode = 'shop';
    controls.reset();
    hideToast();
    controls.enabled = true;
    const I = W.interior;
    I.scene.add(kids[current].root, kids[other()].root);
    kids[current].root.position.copy(I.stand);
    kids[current].root.rotation.y = 0.25;
    kids[other()].root.position.set(I.stand.x - 2.2, 0, I.stand.z - 0.6);
    kids[other()].root.rotation.y = 0.5;
    $('hud').classList.add('hidden');
    $('shop').classList.remove('hidden');
    $('hazel-text').textContent = pick(HAZEL_LINES.welcome);
    preview = null;
    renderShop();
  });
}

function leaveShop() {
  revertPreview();
  fadeTo(() => {
    mode = 'world';
    camera.clearViewOffset();
    scene.add(kids[current].root, kids[other()].root);
    $('shop').classList.add('hidden');
    $('hud').classList.remove('hidden');
    const d = W.store.door;
    player.x = d.x + Math.sin(STORE.facing) * 1.5; player.z = d.z + Math.cos(STORE.facing) * 1.5;
    player.yaw = STORE.facing;
    follower.x = player.x + 1.2; follower.z = player.z - 0.6;
    cam.yaw = STORE.facing + Math.PI;
    cam.snap = true;
  });
}

function revertPreview() {
  if (!preview) return;
  const kid = kids[current];
  const cos = { ...kid.costume, [preview.slot]: save.outfits[current][preview.slot] };
  kid.setCostume(cos);
  preview = null;
}

function renderShop() {
  const tabs = $('shop-tabs');
  tabs.innerHTML = '';
  for (const s of SLOTS) {
    const b = document.createElement('button');
    b.className = `shop-tab${s.id === shopSlot ? ' active' : ''}`;
    b.innerHTML = `<span class="ti">${s.icon}</span>${s.label}`;
    b.onclick = () => { sfx.click(); revertPreview(); shopSlot = s.id; renderShop(); };
    tabs.appendChild(b);
  }
  const list = $('shop-items');
  list.innerHTML = '';
  const worn = kids[current].costume[shopSlot];
  const saved = save.outfits[current][shopSlot];
  const none = { id: null, name: 'Nothing', emoji: '🚫' };
  for (const it of [none, ...ITEMS.filter((i) => i.slot === shopSlot)]) {
    const owned = it.id === null || save.owned.includes(it.id);
    const card = document.createElement('button');
    card.className = `item-card${worn === it.id ? ' selected' : ''}`;
    let tag;
    if (saved === it.id && it.id !== null) tag = '<span class="ip wearing">Wearing</span>';
    else if (owned) tag = it.id === null ? '' : '<span class="ip owned">Yours</span>';
    else if (it.reward) tag = '<span class="ip locked">👻 Prize</span>';
    else tag = `<span class="ip">🍬 ${it.cost}</span>`;
    card.innerHTML = `<span class="ie">${it.emoji}</span><span class="in">${it.name}</span>${tag}`;
    card.onclick = () => tryOn(it);
    list.appendChild(card);
  }
  updateBuyButton();
}

function tryOn(it) {
  sfx.click();
  const kid = kids[current];
  const owned = it.id === null || save.owned.includes(it.id);
  kid.setCostume({ ...kid.costume, [shopSlot]: it.id });
  if (owned) {
    save.outfits[current][shopSlot] = it.id;
    writeSave(save);
    preview = null;
    if (it.id) $('hazel-text').textContent = pick(HAZEL_LINES.buy);
  } else {
    preview = { slot: shopSlot, id: it.id };
    if (it.reward) $('hazel-text').textContent = pick(HAZEL_LINES.reward);
    else if (save.candy < it.cost) $('hazel-text').textContent = `That one costs ${it.cost} candy. ${pick(HAZEL_LINES.poor)}`;
    else $('hazel-text').textContent = `Looks great! It's ${it.cost} candy.`;
  }
  renderShop();
}

function updateBuyButton() {
  const btn = $('shop-buy');
  if (!preview) { btn.classList.add('hidden'); return; }
  const it = ITEM[preview.id];
  btn.classList.remove('hidden');
  if (it.reward) { btn.textContent = '👻 Find it in the haunted house'; btn.disabled = true; return; }
  btn.disabled = save.candy < it.cost;
  btn.textContent = save.candy < it.cost ? `Need 🍬 ${it.cost} (you have ${save.candy})` : `Buy for 🍬 ${it.cost}`;
}

$('shop-buy').addEventListener('click', () => {
  if (!preview) return;
  const it = ITEM[preview.id];
  if (it.reward || save.candy < it.cost) return;
  save.candy -= it.cost;
  save.owned.push(it.id);
  save.outfits[current][preview.slot] = it.id;
  writeSave(save);
  preview = null;
  sfx.chime();
  $('hazel-text').textContent = pick(HAZEL_LINES.buy);
  updateCounters();
  renderShop();
});
$('shop-leave').addEventListener('click', () => { sfx.click(); leaveShop(); });
$('shop-swap').addEventListener('click', () => { sfx.click(); swapKid(); });

// ---------------------------------------------------------------------------
// Swapping brothers
// ---------------------------------------------------------------------------
function swapKid() {
  initAudio();
  if (mode === 'shop') {
    revertPreview();
    const a = kids[current], b = kids[other()];
    const pa = a.root.position.clone(), ra = a.root.rotation.y;
    a.root.position.copy(b.root.position); a.root.rotation.y = b.root.rotation.y;
    b.root.position.copy(pa); b.root.rotation.y = ra;
    current = other();
    save.current = current;
    writeSave(save);
    updateSwapButton();
    $('hazel-text').textContent = `Hello there, ${CHARACTERS[current].name}! What would you like to try?`;
    renderShop();
    return;
  }
  // swap places with your brother
  const px0 = player.x, pz0 = player.z, py0 = player.yaw;
  player.x = follower.x; player.z = follower.z; player.yaw = follower.yaw;
  follower.x = px0; follower.z = pz0; follower.yaw = py0;
  current = other();
  save.current = current;
  writeSave(save);
  updateSwapButton();
  sfx.jump();
  if (mode === 'haunted') {
    // keep the same spot, just change who is walking
    const p = { ...haunted.p };
    haunted.start(CHARACTERS[current], kids[current].costume, save, haunted.cb, haunted.floor.name);
    haunted.p = p;
    haunted.fade = 0;
  }
  toast(`Now playing as ${CHARACTERS[current].name}!`, 1.8);
}

// ---------------------------------------------------------------------------
// Controls + buttons
// ---------------------------------------------------------------------------
const controls = new Controls($('touch-layer'));
controls.onAction = () => doAction();
controls.onJump = () => { if (mode === 'world') { kids[current].jump(); sfx.jump(); } };
$('btn-action').addEventListener('click', () => doAction());
$('btn-jump').addEventListener('click', () => controls.onJump());
$('btn-swap').addEventListener('click', () => swapKid());
$('btn-time').addEventListener('click', () => { initAudio(); const ph = sky.next(); sfx.click(); toast(`${ph.icon} ${ph.label}`, 1.6); });
$('btn-sound').addEventListener('click', () => {
  initAudio();
  setMuted(!isMuted());
  $('btn-sound').textContent = isMuted() ? '🔇' : '🔊';
});
for (const b of [$('btn-action'), $('btn-jump'), $('btn-swap'), $('btn-time'), $('btn-sound')]) {
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
}

// Title screen
document.querySelectorAll('.pick-card').forEach((card) => {
  if (card.dataset.kid === current) card.classList.add('selected'); else card.classList.remove('selected');
  card.addEventListener('click', () => {
    document.querySelectorAll('.pick-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    current = card.dataset.kid;
  });
});
$('play-btn').addEventListener('click', () => {
  initAudio();
  save.current = current;
  writeSave(save);
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');
  updateSwapButton();
  updateCounters();
  mode = 'world';
  setTimeout(() => { if (mode === 'world') toast('Tap the glowing doors to trick-or-treat! 🎃', 4); }, 600);
  setTimeout(() => { if (mode === 'world') toast('Spend candy at Hares Hill — follow the lanterns past the cul-de-sac!', 4.5); }, 5400);
});

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (mode === 'haunted') haunted.resize();
});

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const tmpV = new THREE.Vector3();
const dayWin = new THREE.Color('#5d6b80'), nightWin = new THREE.Color('#ffd28a').multiplyScalar(1.5);
const dayLamp = new THREE.Color('#d8d0b8'), nightLamp = new THREE.Color('#ffffff').multiplyScalar(1.9);
const dayShop = new THREE.Color('#ffd9a0'), nightShop = new THREE.Color('#ffc070').multiplyScalar(1.7);
let stepT = 0;
const PITCH_LOW = 0.12; // lowest orbit angle behind the kid

function updateWorld(dt) {
  const kid = kids[current];
  const inp = controls.input;
  const look = controls.consumeLook();
  cam.yaw -= look.dx * 0.006;
  cam.pitch = clamp(cam.pitch + look.dy * 0.004, PITCH_LOW - 1.45, 1.1); // below PITCH_LOW the view tilts up toward the sky

  let moving = false;
  const speed = CHARACTERS[current].speed;
  if (player.busy > 0) player.busy -= dt;
  else if (inp.mag > 0.02) {
    // camera-relative movement
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
    const rx = -fz, rz = fx;
    const mx = fx * inp.y + rx * inp.x, mz = fz * inp.y + rz * inp.x;
    const L = Math.hypot(mx, mz) || 1;
    player.x += (mx / L) * speed * inp.mag * dt;
    player.z += (mz / L) * speed * inp.mag * dt;
    const targetYaw = Math.atan2(mx, mz);
    let dy = targetYaw - player.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    player.yaw += dy * Math.min(1, dt * 12);
    moving = true;
    // gently swing the camera behind the kid while walking
    let cd = player.yaw + Math.PI - cam.yaw;
    while (cd > Math.PI) cd -= Math.PI * 2;
    while (cd < -Math.PI) cd += Math.PI * 2;
    if (inp.y > 0.3 && controls.lookId === null) cam.yaw += cd * Math.min(1, dt * 0.9) * inp.mag;
    stepT -= dt * inp.mag;
    if (stepT < 0) { stepT = 0.32; sfx.step(); }
  }
  pushOut(player);
  player.y = groundY(player.x, player.z);
  kid.root.position.set(player.x, player.y, player.z);
  kid.root.rotation.y = player.yaw;
  kid.update(dt, moving, inp.mag, time);

  // big brother / little brother follows along
  const fk = kids[other()];
  const behindX = player.x - Math.sin(player.yaw) * 1.9 + Math.cos(player.yaw) * 1.0;
  const behindZ = player.z - Math.cos(player.yaw) * 1.9 - Math.sin(player.yaw) * 1.0;
  const fdx = behindX - follower.x, fdz = behindZ - follower.z, fd = Math.hypot(fdx, fdz);
  let fMoving = false;
  if (fd > 3.2) {
    // teleport if left far behind (e.g. after a door)
    follower.x = behindX; follower.z = behindZ;
  } else if (fd > 0.6) {
    const sp = Math.min(speed * 1.05, fd * 3);
    follower.x += (fdx / fd) * sp * dt; follower.z += (fdz / fd) * sp * dt;
    follower.yaw = Math.atan2(fdx, fdz);
    fMoving = true;
  } else {
    let dy = Math.atan2(player.x - follower.x, player.z - follower.z) - follower.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    follower.yaw += dy * Math.min(1, dt * 3);
  }
  pushOut(follower);
  follower.y = groundY(follower.x, follower.z);
  fk.root.position.set(follower.x, follower.y, follower.z);
  fk.root.rotation.y = follower.yaw;
  fk.update(dt, fMoving, Math.min(1, fd / 2), time + 1.3);

  // day / night
  const prevT = sky.t;
  sky.update(dt, tmpV.set(player.x, player.y, player.z));
  if (prevT < NIGHT_START && sky.t >= NIGHT_START && sky.t < NIGHT_START + 0.2) { save.nightNumber++; writeSave(save); refreshDoorGlows(); toast('Halloween night is here! The doors are glowing again. 🎃'); }
  const n = sky.night;
  mats.window.color.copy(dayWin).lerp(nightWin, n);
  mats.lamp.color.copy(dayLamp).lerp(nightLamp, n);
  mats.shopwin.color.copy(dayShop).lerp(nightShop, n);
  glows.update(n, time, renderer.domElement.height);
  kidLight.intensity = n * 9;
  kidLight.position.set(player.x, player.y + 3.2, player.z + 0.5);
  $('btn-time').textContent = sky.phase().icon;
  W.haunt.update(dt, time, n);
  W.leaves.update(dt, player, W.heightAt, time);
  updateAmbient(dt, n, false);

  // camera
  const headY = player.y + CHARACTERS[current].height * 0.85;
  cam.target.set(player.x, headY, player.z);
  // Past the lowest orbit angle, the camera drops to about head height and
  // swings closer, then tilts its view upward so you can look right up at the sky.
  const lookUp = Math.max(0, PITCH_LOW - cam.pitch); // 0 .. ~1.45
  const lu = Math.min(1, lookUp / 0.6);
  const orbitPitch = Math.max(cam.pitch, PITCH_LOW) - lu * (PITCH_LOW + 0.04);
  const dist = cam.dist * (1 - 0.3 * lu);
  const cx = player.x + Math.sin(cam.yaw) * Math.cos(orbitPitch) * dist;
  const cz = player.z + Math.cos(cam.yaw) * Math.cos(orbitPitch) * dist;
  let cy = headY + Math.sin(orbitPitch) * dist;
  cy = Math.max(cy, W.heightAt(cx, cz) + 0.6);
  const desired = tmpV.set(cx, cy, cz);
  cam.pos.lerp(desired, Math.min(1, dt * 6));
  if (cam.pos.lengthSq() === 0 || cam.snap) { cam.pos.copy(desired); cam.snap = false; }
  camera.position.copy(cam.pos);
  if (lookUp > 0) {
    // start from the normal "look at the kid" direction and raise it
    const dx = cam.target.x - cam.pos.x, dy = cam.target.y - cam.pos.y, dz = cam.target.z - cam.pos.z;
    const h = Math.hypot(dx, dz) || 1;
    const elev = Math.min(Math.atan2(dy, h) + lookUp * 1.1, 1.5);
    camera.lookAt(cam.pos.x + (dx / h) * Math.cos(elev), cam.pos.y + Math.sin(elev), cam.pos.z + (dz / h) * Math.cos(elev));
  } else camera.lookAt(cam.target);
  if (window.__debugCam) { camera.position.set(...window.__debugCam.pos); camera.lookAt(...window.__debugCam.look); if (window.__debugCam.nofog) { scene.fog.near = 1e4; scene.fog.far = 1e5; } }
  W.backdrop.update(sky, camera);
  renderer.render(scene, camera);
}

function updateShop(dt) {
  const I = W.interior;
  const look = controls.consumeLook();
  const kid = kids[current];
  kid.root.rotation.y += look.dx * 0.01;
  kid.update(dt, false, 0, time);
  kids[other()].update(dt, false, 0, time + 1.1);
  I.update(time);
  const h = CHARACTERS[current].height;
  const wide = window.innerWidth / window.innerHeight;
  const dist = (wide < 1 ? 4.4 : 3.2) * (0.6 + h * 0.4);
  camera.position.set(I.stand.x + 0.9, h * 0.9 + 0.5, I.stand.z + dist);
  camera.lookAt(I.stand.x - (wide > 1.2 ? 0.7 : 0.2), h * 0.55, I.stand.z);
  // push the picture up so the kid stands above the costume drawer
  const sheetH = document.querySelector('.shop-sheet').offsetHeight;
  const topH = document.querySelector('.shop-top').offsetHeight;
  camera.setViewOffset(window.innerWidth, window.innerHeight, 0, (sheetH - topH) * 0.5, window.innerWidth, window.innerHeight);
  updateAmbient(dt, 0, true);
  renderer.render(I.scene, camera);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  time += dt;
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) $('toast').classList.add('hidden');
  if (bubbleTimer > 0 && (bubbleTimer -= dt) <= 0) $('bubble').classList.add('hidden');
  if (roomTimer > 0 && (roomTimer -= dt) <= 0) $('room-label').classList.add('hidden');

  if (mode === 'title') {
    if (!W.ready) return;
    // slow orbit around the haunted house behind the title screen
    const s = W.home;
    const a = time * 0.08;
    camera.position.set(s.x + Math.sin(s.rot + 0.4 + Math.sin(a) * 0.5) * 30, s.y + 9, s.z + Math.cos(s.rot + 0.4 + Math.sin(a) * 0.5) * 30);
    camera.lookAt(s.x, s.y + 4, s.z);
    sky.update(dt * 0.3, tmpV.set(s.x, s.y, s.z));
    const n = sky.night;
    mats.window.color.copy(dayWin).lerp(nightWin, n);
    mats.lamp.color.copy(dayLamp).lerp(nightLamp, n);
    mats.shopwin.color.copy(dayShop).lerp(nightShop, n);
    glows.update(n, time, renderer.domElement.height);
    W.haunt.update(dt, time, n);
    W.backdrop.update(sky, camera);
    renderer.render(scene, camera);
    return;
  }
  if (mode === 'world') updateWorld(dt);
  else if (mode === 'shop') updateShop(dt);
  else if (mode === 'haunted') {
    const inp = controls.input;
    controls.consumeLook();
    haunted.update(dt, inp);
    haunted.render();
    updateAmbient(dt, 1, true);
  }

  // action button
  const a = nearestAction();
  const btn = $('btn-action');
  if (a && mode !== 'shop') {
    if (!currentAction || currentAction.label !== a.label) {
      $('action-icon').textContent = a.icon;
      $('action-label').textContent = a.label;
    }
    btn.classList.remove('hidden');
  } else btn.classList.add('hidden');
  currentAction = a;
  $('btn-jump').classList.toggle('hidden', mode !== 'world');
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
requestAnimationFrame(() => setTimeout(async () => {
  try {
    const r = await fetch('data/elevation.json');
    if (r.ok) setElevation(await r.json());
  } catch (e) { /* fall back to the hand-shaped hills */ }
  const t0 = performance.now();
  buildWorld();
  placeAtHome();
  scene.add(kids[current].root, kids[other()].root);
  refreshDoorGlows();
  W.ready = true;
  cam.snap = true;
  console.log(`World built in ${Math.round(performance.now() - t0)} ms`);
  $('play-btn').disabled = false;
  $('play-label').textContent = "Let's go! 🎃";
  updateCounters();
  requestAnimationFrame(frame);
}, 30));

// handy for testing from the console
window.__game = { save, sky, player, W, kids, get mode() { return mode; }, enterShop, enterHaunted, renderer, scene, camera, get action() { return currentAction; }, doAction, haunted };
