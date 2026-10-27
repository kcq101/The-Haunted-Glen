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
import { decorateNeighborhood, addStreetLamps, addTrail, hauntHome, addBoundaryFence, addSwales, addStopSign } from './decor.js';
import { buildStoreExterior, HAZEL_LINES } from './store.js';
import { buildStoreInterior } from './shopinside.js';
import { Kid } from './character.js';
import { Controls } from './controls.js';
import { ITEM } from './costumes.js';
import { loadCostumeData } from './costumefit.js';
import { initFitTuner } from './fittuner.js';
import { HauntedHouse, CORN_TOTAL, CORN_REWARDS } from './haunted2d.js';
import { initAudio, sfx, setMuted, isMuted, updateAmbient } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { preloadScooters } from './scooter.js';
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
  addStreetLamps(B, glows, terrain.heightAt, [...marks.driveways, ...marks.walkways]);
  addBoundaryFence(B, terrain.heightAt);
  addSwales(B, terrain.heightAt);
  W.colliders.push(addStopSign(B, scene, terrain.heightAt));
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
let R = 0.38; // a bit wider on a scooter
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
    ride.v = 0;
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
let shopPage = 0; // 0 = the whole shop, 1..4 = zoomed in on one shelf bay
let preview = null; // { slot, id } — something being tried on that isn't bought yet
const shopCam = { fov: 55, tFov: 55, pos: new THREE.Vector3(), look: new THREE.Vector3(), tPos: new THREE.Vector3(), tLook: new THREE.Vector3(), key: '', snap: true };
const isPortrait = () => window.innerWidth / window.innerHeight < 1.05;

function hazelSay(text) {
  $('hazel-text').textContent = text;
  const el = $('hazel');
  el.classList.remove('say'); void el.offsetWidth; el.classList.add('say');
}

function enterShop() {
  sfx.door();
  fadeTo(() => {
    mode = 'shop';
    controls.reset();
    controls.enabled = false;
    hideToast();
    const I = W.interior;
    parkScooters(true);
    I.scene.add(kids[current].root, kids[other()].root);
    shopPage = 0;
    setShopTargets(true);
    $('hud').classList.add('hidden');
    $('shop').classList.remove('hidden');
    hazelSay(pick(HAZEL_LINES.welcome));
    I.hazel.userData.wave();
    preview = null;
    shopCam.snap = true;
    shopCam.key = '';
    renderShop();
  });
}

function leaveShop() {
  revertPreview();
  fadeTo(() => {
    mode = 'world';
    camera.clearViewOffset();
    camera.fov = 55;
    camera.updateProjectionMatrix();
    controls.enabled = true;
    scene.add(kids[current].root, kids[other()].root);
    parkScooters(false);
    ride.v = 0;
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

// Where each boy should stand: on the rug for the whole-shop view, or the
// shopper walks up to the shelf bay in view.
function setShopTargets(snap = false) {
  const I = W.interior;
  const cur = kids[current].root, oth = kids[other()].root;
  const near = isPortrait();
  cur.userData.shopTarget = shopPage ? I.bayFront(shopPage - 1, near) : (near ? I.standNear : I.stand).clone();
  oth.userData.shopTarget = (near ? I.standOtherNear : I.standOther).clone();
  if (snap) for (const r of [cur, oth]) { r.position.copy(r.userData.shopTarget); r.rotation.y = 0; }
}

function setShopPage(i) {
  const n = W.interior.BAYS.length + 1;
  const next = (i + n) % n;
  if (next === shopPage) return;
  shopPage = next;
  sfx.click();
  setShopTargets();
  renderShop();
}

function revertPreview() {
  if (!preview) return;
  const kid = kids[current];
  const cos = { ...kid.costume, [preview.slot]: save.outfits[current][preview.slot] };
  kid.setCostume(cos);
  preview = null;
}

function tagFor(it) {
  if (save.outfits[current][it.slot] === it.id) return { kind: 'wearing', text: 'Wearing' };
  if (save.owned.includes(it.id)) return { kind: 'owned', text: 'Yours ✓' };
  if (it.reward) return { kind: 'prize', text: '👻 Prize' };
  return { kind: 'price', text: `🍬 ${it.cost}` };
}

function renderShop() {
  const I = W.interior;
  for (const c of I.cells) {
    const it = ITEM[c.id];
    const tag = tagFor(it);
    const key = tag.kind + tag.text;
    if (c.tagKey !== key) { c.tag.userData.draw(tag); c.tagKey = key; }
    c.state = preview && preview.id === c.id ? 'trying' : tag.kind === 'wearing' ? 'wearing' : null;
  }
  // page buttons (only shown on an upright phone)
  const tabs = $('shop-tabs');
  tabs.innerHTML = '';
  [{ icon: '🏪', label: 'Shop' }, ...I.BAYS].forEach((b, i) => {
    const t = document.createElement('button');
    t.className = `shop-tab${i === shopPage ? ' active' : ''}`;
    t.innerHTML = `<span class="ti">${b.icon}</span>${b.label}`;
    t.onclick = () => setShopPage(i);
    tabs.appendChild(t);
  });
  $('shop-candy').textContent = save.candy;
  updateBuyButton();
}

function tryOn(it) {
  initAudio();
  sfx.click();
  const kid = kids[current];
  const slot = it.slot;
  const owned = save.owned.includes(it.id);
  const taking = owned && save.outfits[current][slot] === it.id;
  revertPreview();
  if (taking) {
    kid.setCostume({ ...kid.costume, [slot]: null });
    save.outfits[current][slot] = null;
    writeSave(save);
    hazelSay(pick(HAZEL_LINES.off));
  } else {
    kid.setCostume({ ...kid.costume, [slot]: it.id });
    if (kid.jumpY === 0) kid.jumpV = 3;
    if (owned) {
      save.outfits[current][slot] = it.id;
      writeSave(save);
      hazelSay(pick(HAZEL_LINES.buy));
    } else {
      preview = { slot, id: it.id };
      if (it.reward) hazelSay(pick(HAZEL_LINES.reward));
      else if (save.candy < it.cost) hazelSay(`The ${it.name} costs ${it.cost} candy. ${pick(HAZEL_LINES.poor)}`);
      else hazelSay(`Ooh, the ${it.name}! That's ${it.cost} candy.`);
    }
  }
  renderShop();
}

function updateBuyButton() {
  const btn = $('shop-buy');
  if (!preview) { btn.classList.add('hidden'); return; }
  const it = ITEM[preview.id];
  btn.classList.remove('hidden');
  if (it.reward) { btn.textContent = '👻 Haunted house prize'; btn.disabled = true; return; }
  btn.disabled = save.candy < it.cost;
  btn.textContent = save.candy < it.cost ? `Need 🍬 ${it.cost}` : `Buy it! 🍬 ${it.cost}`;
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
  W.interior.hazel.userData.cheer();
  if (kids[current].jumpY === 0) kids[current].jumpV = 4.5;
  hazelSay(pick(HAZEL_LINES.buy));
  updateCounters();
  renderShop();
});
$('shop-leave').addEventListener('click', () => { sfx.click(); leaveShop(); });
$('shop-swap').addEventListener('click', () => { sfx.click(); swapKid(); });
$('shop-prev').addEventListener('click', () => setShopPage(shopPage - 1));
$('shop-next').addEventListener('click', () => setShopPage(shopPage + 1));

// Taps on the shelves try things on; on an upright phone a sideways swipe
// moves along the wall.
const shopRay = new THREE.Raycaster();
let shopPress = null;
$('touch-layer').addEventListener('pointerdown', (e) => {
  if (mode !== 'shop') return;
  shopPress = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
});
window.addEventListener('pointerup', (e) => {
  if (mode !== 'shop' || !shopPress || e.pointerId !== shopPress.id) return;
  const dx = e.clientX - shopPress.x, dy = e.clientY - shopPress.y;
  const quick = performance.now() - shopPress.t < 700;
  shopPress = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) {
    if (shopPage) setShopPage(Math.max(1, Math.min(4, shopPage + (dx < 0 ? 1 : -1))));
    return;
  }
  if (Math.hypot(dx, dy) > 14 || !quick) return;
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  shopRay.setFromCamera(ndc, camera);
  const I = W.interior;
  const hit = shopRay.intersectObjects(shopPage ? I.hits : [...I.hits, ...I.bayHits], false)[0];
  if (!hit) {
    if (shopPage) { const any = shopRay.intersectObjects(I.bayHits, false)[0]; if (any && any.object.userData.bay !== shopPage - 1) setShopPage(any.object.userData.bay + 1); }
    return;
  }
  const id = hit.object.userData.itemId;
  const bay = id ? I.cells.find((c) => c.id === id).bay : hit.object.userData.bay;
  if (bay !== shopPage - 1) { setShopPage(bay + 1); return; } // zoom in first
  tryOn(ITEM[id]);
});

// ---------------------------------------------------------------------------
// Swapping brothers
// ---------------------------------------------------------------------------
function swapKid() {
  initAudio();
  if (mode === 'shop') {
    revertPreview();
    current = other();
    setShopTargets();
    save.current = current;
    writeSave(save);
    updateSwapButton();
    hazelSay(`Hello there, ${CHARACTERS[current].name}! What would you like to try?`);
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
// --- scooters ----------------------------------------------------------------
const ride = { on: false, v: 0, busy: false };
const SCOOT = {
  top: 1.45, // top speed vs. running
  boost: 1.3, // ⚡ on a scooter
  accel: 6.5, // m/s² while pushing
  coast: 1.6, // slows this much (m/s²) when you let go
  brake: 9, // pulling back on the stick
  turn: 3.4, // radians per second at low speed…
  turnFast: 2.2, // …and at top speed
};
async function setScooter(on) {
  if (ride.busy) return;
  ride.busy = true;
  $('btn-scooter').classList.toggle('on', on);
  if (on) toast('🛴 Scooter time!', 1.6);
  const ok = await kids[current].setRiding(on);
  await kids[other()].setRiding(on);
  ride.busy = false;
  if (on && !ok) { $('btn-scooter').classList.remove('on'); toast("The scooters aren't ready yet. Try again!", 2.5); kids[other()].setRiding(false); return; }
  ride.on = on;
  ride.v = 0;
  R = on ? 0.48 : 0.38;
  if (!on) toast('Back on foot! 👟', 1.4);
}
// riding stays on between the shop and the street, but the scooters park outside
const parkScooters = (park) => { for (const k of Object.values(kids)) if (k.scooter) { k.scooter.group.visible = !park && ride.on; k.rideLift = !park && ride.on ? k.scooter.deckH : 0; k.riding = !park && ride.on; if (park) { k.body.rotation.set(0, 0, 0); k.lean = 0; } } };

const controls = new Controls($('touch-layer'));
controls.onAction = () => doAction();
controls.onJump = () => { if (mode === 'world' && kids[current].jumpY === 0 && !kids[current].spinning) { kids[current].jump(); sfx.jump(); } };
controls.onSpin = () => {
  if (mode !== 'world' || player.busy > 0) return;
  if (kids[current].spin()) {
    sfx.spin();
    setTimeout(() => { if (mode === 'world') kids[other()].spin(); }, 350); // little brother copies
  }
};
$('btn-action').addEventListener('click', () => doAction());
// Jump / Spin / Boost react the moment a finger lands (a "click" gets dropped
// on phones and tablets while the other thumb is on the joystick).
const pressBtn = (el, fn) => el.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation(); initAudio(); fn();
  el.classList.add('pressed'); setTimeout(() => el.classList.remove('pressed'), 120);
});
pressBtn($('btn-jump'), () => controls.onJump());
pressBtn($('btn-spin'), () => controls.onSpin());
pressBtn($('btn-scooter'), () => { if (mode === 'world') setScooter(!ride.on); });
controls.onScooter = () => { if (mode === 'world') setScooter(!ride.on); };
{
  const b = $('btn-boost');
  const on = (e) => { e.preventDefault(); e.stopPropagation(); initAudio(); try { b.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } if (!controls.boostTouch) sfx.boost(); controls.boostTouch = true; b.classList.add('held'); };
  const off = () => { controls.boostTouch = false; b.classList.remove('held'); };
  b.addEventListener('pointerdown', on);
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, off);
}
$('btn-swap').addEventListener('click', () => swapKid());
$('btn-time').addEventListener('click', () => { initAudio(); const ph = sky.next(); sfx.click(); toast(`${ph.icon} ${ph.label}`, 1.6); });
$('btn-sound').addEventListener('click', () => {
  initAudio();
  setMuted(!isMuted());
  $('btn-sound').textContent = isMuted() ? '🔇' : '🔊';
});
for (const b of [$('btn-action'), $('btn-jump'), $('btn-spin'), $('btn-scooter'), $('btn-boost'), $('btn-swap'), $('btn-time'), $('btn-sound')]) {
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
const BOOST = 1.6; // ⚡ speed boost
const BOOST_ANIM = 1.45; // run cycle speed-up to match
const AIR_LEAP = 1.2; // extra forward speed while in the air
const PITCH_LOW = 0.12; // lowest orbit angle behind the kid

// --- auto camera ------------------------------------------------------------
// After the kid has run in a new direction for a moment, the camera slowly
// pans back behind them. A quick sidestep doesn't move it, running toward the
// camera waits longer, and dragging the camera pauses it for a few seconds.
const AUTO_CAM = {
  delay: 0.7, // seconds of steady running before the camera starts to follow
  backDelay: 1.6, // ...when running back toward the camera
  ramp: 0.8, // seconds to ease up to full follow speed
  rate: 0.9, // follow strength at full run (per second)
  maxTurn: 1.0, // never turn faster than this (radians per second, ~57 degrees)
  backMaxTurn: 0.75, // gentler when swinging all the way around
  ignore: 0.3, // don't start if within ~17 degrees of behind...
  settle: 0.05, // ...but once following, finish to within ~3 degrees
  pause: 2.5, // seconds of no auto-follow after a manual camera drag
  pitch: 0.38, // the normal camera height it drifts back to
};
const autoCam = { t: 0, pause: 0, ctrlYaw: null, stickAng: 0, following: false };
const wrapAng = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

function updateWorld(dt) {
  const kid = kids[current];
  const inp = controls.input;
  const look = controls.consumeLook();
  cam.yaw -= look.dx * 0.006;
  cam.pitch = clamp(cam.pitch + look.dy * 0.004, PITCH_LOW - 1.45, 1.1); // below PITCH_LOW the view tilts up toward the sky
  if (look.dx || look.dy || controls.lookId !== null) { autoCam.pause = AUTO_CAM.pause; autoCam.t = 0; }
  else autoCam.pause = Math.max(0, autoCam.pause - dt);

  let moving = false;
  const riding = ride.on && kid.riding;
  const spinning = kid.spinning && !riding;
  const boosting = controls.boost && inp.mag > 0.02 && !spinning;
  const airLeap = kid.jumpY > 0 ? AIR_LEAP : 1; // a jump while running carries them a bit further
  const speed = CHARACTERS[current].speed * (boosting ? BOOST : 1) * airLeap;
  kid.push = false;
  if (player.busy > 0) { player.busy -= dt; ride.v = Math.max(0, ride.v - SCOOT.brake * dt); }
  else if (spinning) { /* the spin carries them forward on its own (below) */ }
  else if (riding || inp.mag > 0.02) {
    // camera-relative movement. While the stick is held, steer relative to
    // where the camera was when they started, so an auto-pan doesn't curve
    // their path; re-sync when they push a clearly different way.
    const stickAng = Math.atan2(inp.x, inp.y);
    if (autoCam.ctrlYaw === null || Math.abs(wrapAng(stickAng - autoCam.stickAng)) > 0.6) {
      autoCam.ctrlYaw = cam.yaw;
      autoCam.stickAng = stickAng;
    }
    if (autoCam.pause > 0) autoCam.ctrlYaw = cam.yaw; // manual drag: steer with the view
    const fx = -Math.sin(autoCam.ctrlYaw), fz = -Math.cos(autoCam.ctrlYaw);
    const rx = -fz, rz = fx;
    const mx = fx * inp.y + rx * inp.x, mz = fz * inp.y + rz * inp.x;
    const L = Math.hypot(mx, mz) || 1;
    const targetYaw = Math.atan2(mx, mz);
    let dy = targetYaw - player.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    if (riding) {
      // A scooter rolls where it points: steer toward the stick, push off to
      // speed up, coast when you let go, and brake by pulling the other way.
      const top = CHARACTERS[current].speed * SCOOT.top * (controls.boost ? SCOOT.boost : 1);
      const stick = inp.mag > 0.02;
      if (stick) {
        const back = Math.abs(dy) > 2.4 && ride.v > 1.5;
        const rate = SCOOT.turn + (SCOOT.turnFast - SCOOT.turn) * Math.min(1, ride.v / top);
        if (!back) player.yaw += clamp(dy, -rate * dt, rate * dt);
        if (back) ride.v = Math.max(0, ride.v - SCOOT.brake * dt);
        else if (ride.v < top * inp.mag) { ride.v = Math.min(top * inp.mag, ride.v + SCOOT.accel * dt * (Math.abs(dy) > 1.5 ? 0.4 : 1)); kid.push = ride.v < top * inp.mag * 0.97; }
        else ride.v = Math.max(top * inp.mag, ride.v - SCOOT.coast * 2 * dt);
      } else ride.v = Math.max(0, ride.v - SCOOT.coast * dt);
      const ox = player.x, oz = player.z;
      player.x += Math.sin(player.yaw) * ride.v * dt;
      player.z += Math.cos(player.yaw) * ride.v * dt;
      pushOut(player);
      // bumping into a wall or tree slows you down
      const want = ride.v * dt, got = Math.hypot(player.x - ox, player.z - oz);
      if (want > 1e-4 && got < want * 0.7) ride.v *= Math.max(0.2, got / want);
      moving = ride.v > 0.4;
      if (!stick) { autoCam.ctrlYaw = null; }
    } else {
      player.x += (mx / L) * speed * inp.mag * dt;
      player.z += (mz / L) * speed * inp.mag * dt;
      player.yaw += dy * Math.min(1, dt * 12);
      moving = true;
    }
    // slowly pan the camera back behind the kid if they keep going another way
    const cd = wrapAng(player.yaw + Math.PI - cam.yaw);
    const near = Math.abs(cd) < (autoCam.following ? AUTO_CAM.settle : AUTO_CAM.ignore);
    if (autoCam.pause > 0 || near) { autoCam.t = Math.max(0, autoCam.t - dt * 2); if (near) autoCam.following = false; }
    else autoCam.t += dt;
    const back = Math.abs(cd) > 2.3; // running toward the camera
    const delay = back ? AUTO_CAM.backDelay : AUTO_CAM.delay;
    const ease = clamp((autoCam.t - delay) / AUTO_CAM.ramp, 0, 1);
    if (ease > 0) {
      autoCam.following = true;
      const k = ease * AUTO_CAM.rate * (0.45 + 0.55 * inp.mag);
      const mt = (back ? AUTO_CAM.backMaxTurn : AUTO_CAM.maxTurn) * ease * dt;
      const turn = clamp(cd * Math.min(1, dt * k * 1.6), -mt, mt);
      cam.yaw += turn;
      cam.pitch += (AUTO_CAM.pitch - cam.pitch) * Math.min(1, dt * 0.6 * ease);
    }
    if (!riding) {
      stepT -= dt * inp.mag * (boosting ? BOOST : 1);
      if (stepT < 0) { stepT = 0.32; if (kid.jumpY === 0) sfx.step(); }
    }
  }
  if (!moving) { autoCam.ctrlYaw = null; autoCam.following = false; autoCam.t = 0; } // stopping restarts the wait
  pushOut(player);
  player.y = groundY(player.x, player.z);
  kid.root.position.set(player.x, player.y, player.z);
  kid.root.rotation.y = player.yaw;
  const spinAdv = kid.update(dt, moving && !riding, inp.mag, time, boosting ? BOOST_ANIM : 1);
  if (spinAdv) {
    player.x += Math.sin(player.yaw) * spinAdv;
    player.z += Math.cos(player.yaw) * spinAdv;
    pushOut(player);
    player.y = groundY(player.x, player.z);
    kid.root.position.set(player.x, player.y, player.z);
  }

  // big brother / little brother follows along
  const fk = kids[other()];
  const behindX = player.x - Math.sin(player.yaw) * 1.9 + Math.cos(player.yaw) * 1.0;
  const behindZ = player.z - Math.cos(player.yaw) * 1.9 - Math.sin(player.yaw) * 1.0;
  const fdx = behindX - follower.x, fdz = behindZ - follower.z, fd = Math.hypot(fdx, fdz);
  let fMoving = false;
  if (fd > (riding ? 6 : 3.2)) {
    // teleport if left far behind (e.g. after a door)
    follower.x = behindX; follower.z = behindZ;
  } else if (fd > 0.6) {
    const sp = riding ? Math.min(Math.max(ride.v * 1.08, 2), fd * 3) : Math.min(speed * 1.05, fd * 3) * (fk.spinning ? 0.4 : 1);
    follower.x += (fdx / fd) * sp * dt; follower.z += (fdz / fd) * sp * dt;
    const fy = Math.atan2(fdx, fdz);
    if (riding) { let d = fy - follower.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; follower.yaw += d * Math.min(1, dt * 5); } else follower.yaw = fy;
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
  fk.push = riding && fMoving && kid.push;
  fk.update(dt, fMoving && !riding, Math.min(1, fd / 2), time + 1.3, boosting && fMoving ? BOOST_ANIM : 1);

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

// Frame the camera on a set of points, leaving room for the shop's buttons.
const fitV = new THREE.Vector3();
function fitShopCamera() {
  const I = W.interior;
  const w = window.innerWidth, h = window.innerHeight;
  const portrait = isPortrait();
  const topH = $('shop-top').getBoundingClientRect().bottom;
  const botH = h - $('shop-bottom').getBoundingClientRect().top + 6;
  const leftW = portrait ? 0 : document.querySelector('.shop-pager').getBoundingClientRect().right + 4;
  const rightW = portrait ? 0 : w - document.querySelector('.shop-bar').getBoundingClientRect().left + 4;
  const key = [w, h, portrait, shopPage, current, Math.round(topH), Math.round(botH), Math.round(leftW), Math.round(rightW)].join();
  if (key === shopCam.key) return;
  shopCam.key = key;
  camera.aspect = w / h;
  // an upright phone can't fit the whole shop at the normal lens, so widen it
  shopCam.tFov = portrait && !shopPage ? 72 : 55;
  const fovNow = camera.fov;
  camera.fov = shopCam.tFov;
  camera.setViewOffset(w, h, (rightW - leftW) * 0.5, (botH - topH) * 0.5, w, h);
  camera.updateProjectionMatrix();
  const pts = [];
  const kidPts = (k) => {
    const t = k.root.userData.shopTarget, kh = CHARACTERS[k === kids[current] ? current : other()].height;
    const footY = shopPage ? kh * 0.12 : 0; // try-on view can crop the shoes a touch
    pts.push(t.clone().add(new THREE.Vector3(-0.4, footY, 0.3)), t.clone().add(new THREE.Vector3(0.4, footY, 0.3)), t.clone().add(new THREE.Vector3(0, kh + 0.15, 0)));
  };
  if (shopPage) { pts.push(...I.bayPoints(shopPage - 1)); kidPts(kids[current]); } else {
    // an upright phone frames just the four bays (Hazel's desk peeks in at the edge)
    pts.push(...(portrait ? [...I.bayPoints(0), ...I.bayPoints(3)] : I.wallPoints));
    kidPts(kids[current]); kidPts(kids[other()]);
  }
  const box = new THREE.Box3().setFromPoints(pts);
  const target = box.getCenter(new THREE.Vector3());
  const u = Math.max(0.2, (h - topH - botH) / h) * 0.96, ux = Math.max(0.2, (w - leftW - rightW) / w) * 0.96;
  const place = (d) => {
    camera.position.copy(target).addScaledVector(dir, d);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const p of pts) {
      fitV.copy(p).project(camera);
      x0 = Math.min(x0, fitV.x); x1 = Math.max(x1, fitV.x); y0 = Math.min(y0, fitV.y); y1 = Math.max(y1, fitV.y);
    }
    return { x0, x1, y0, y1 };
  };
  {
    // Try-on view: the camera sits about chest high in front of the shopper
    // and tilts up, so the costume fills the bottom of the screen and the
    // whole shelf bay rises up behind him. The whole-shop view uses the same
    // idea from just under the ceiling, so it never peeks over the walls.
    const kt = kids[current].root.userData.shopTarget, kh = CHARACTERS[current].height;
    const cx = (box.min.x + box.max.x) / 2, cy = shopPage ? kh * 0.74 : 5.5;
    const aim = (dz, pitch) => {
      camera.position.set(cx, cy, kt.z + dz);
      camera.lookAt(cx, cy + Math.tan(pitch), kt.z + dz - 1);
      camera.updateMatrixWorld(true);
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for (const p of pts) {
        fitV.copy(p).project(camera);
        if (fitV.z > 1 || fitV.z < -1) return { x0: -9, x1: 9, y0: -9, y1: 9 }; // behind the lens
        x0 = Math.min(x0, fitV.x); x1 = Math.max(x1, fitV.x); y0 = Math.min(y0, fitV.y); y1 = Math.max(y1, fitV.y);
      }
      return { x0, x1, y0, y1 };
    };
    // for a distance, tilt until the picture is centred top-to-bottom
    const tilt = (dz) => {
      let lo = -1.0, hi = 1.2;
      // try-on: centred; whole shop: shelves pinned near the top so the lit floor fills the rest
      for (let k = 0; k < 22; k++) { const m = (lo + hi) / 2, b = aim(dz, m); if ((shopPage ? (b.y0 + b.y1) / 2 : b.y1 - u * 0.97) > 0) lo = m; else hi = m; }
      return (lo + hi) / 2;
    };
    let lo = 0.6, hi = 20;
    for (let k = 0; k < 22; k++) {
      const m = (lo + hi) / 2, b = aim(m, tilt(m));
      if (b.x0 < -ux || b.x1 > ux || b.y0 < -u || b.y1 > u) lo = m; else hi = m;
    }
    const pitch = tilt(hi);
    aim(hi, pitch);
    shopCam.tPos.copy(camera.position);
    shopCam.tLook.set(cx, cy + Math.tan(pitch) * 4, kt.z + hi - 4);
    camera.fov = fovNow;
    camera.updateProjectionMatrix();
  }
}

function angleTo(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function updateShop(dt) {
  const I = W.interior;
  $('shop').classList.toggle('portrait', isPortrait());
  if (shopCam.portrait !== isPortrait()) { shopCam.portrait = isPortrait(); setShopTargets(); }
  // the boys walk to their spots, then turn to show off for the camera
  [current, other()].forEach((id, n) => {
    const kid = kids[id], r = kid.root, t = r.userData.shopTarget;
    const dx = t.x - r.position.x, dz = t.z - r.position.z, dist = Math.hypot(dx, dz);
    const moving = dist > 0.04;
    if (moving) {
      const step = Math.min(dist, Math.max(2.4, dist * 1.8) * dt);
      r.position.x += (dx / dist) * step; r.position.z += (dz / dist) * step;
      r.rotation.y = angleTo(r.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 10));
    } else {
      const face = Math.atan2(shopCam.pos.x - r.position.x, shopCam.pos.z - r.position.z) * 0.85 + (n ? -0.25 : 0.15);
      r.rotation.y = angleTo(r.rotation.y, face, Math.min(1, dt * 5));
    }
    kid.update(dt, moving, moving ? 0.5 : 0, time + n * 1.1);
  });
  I.update(time, dt);
  fitShopCamera();
  if (shopCam.snap) { shopCam.pos.copy(shopCam.tPos); shopCam.look.copy(shopCam.tLook); camera.fov = shopCam.tFov; camera.updateProjectionMatrix(); shopCam.snap = false; }
  const k = 1 - Math.exp(-dt * 4);
  if (Math.abs(camera.fov - shopCam.tFov) > 0.01) { camera.fov += (shopCam.tFov - camera.fov) * k; camera.updateProjectionMatrix(); }
  shopCam.pos.lerp(shopCam.tPos, k);
  shopCam.look.lerp(shopCam.tLook, k);
  camera.position.copy(shopCam.pos);
  camera.lookAt(shopCam.look);
  if (window.__debugCam) { camera.position.set(...window.__debugCam.pos); camera.lookAt(...window.__debugCam.look); }
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
  $('move-btns').classList.toggle('hidden', mode !== 'world');
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
requestAnimationFrame(() => setTimeout(async () => {
  try {
    const r = await fetch('data/elevation.json');
    if (r.ok) setElevation(await r.json());
  } catch (e) { /* fall back to the hand-shaped hills */ }
  await loadCostumeData(); // fit tweaks + any GPT/Meshy costume models
  for (const k of Object.values(kids)) k.setCostume(k.costume);
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
  setTimeout(() => preloadScooters().catch(() => {}), 1500); // ready before anyone taps 🛴
}, 30));

initFitTuner({ getKid: () => kids[current], isShop: () => mode === 'shop' });

// handy for testing from the console
window.__game = { shopCam, get preview() { return preview; }, setShopPage: (i) => setShopPage(i), shopSnap: () => { setShopTargets(true); shopCam.snap = true; }, tryOnId: (id) => tryOn(ITEM[id]), save, sky, player, cam, autoCam, W, kids, get mode() { return mode; }, enterShop, enterHaunted, renderer, scene, camera, get action() { return currentAction; }, doAction, haunted, ride, setScooter };
