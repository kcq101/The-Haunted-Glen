import * as THREE from 'three';
import { GLTFLoader } from '../lib/addons/loaders/GLTFLoader.js';
import { ITEM, EXTRA_TEX } from './costumes.js';

// ---------------------------------------------------------------------------
// Costume fit + drop-in 3D models.
//
// data/costume_fit.json   nudges each piece on each boy: position (meters),
//                         rotation (degrees) and scale. Slot defaults first,
//                         then per-item overrides.
// data/costume_models.json swaps a hand-built piece for a GLB (e.g. made in
//                         GPT -> Meshy) or an outfit's shirt/pants for a PNG.
//
// Open the game with ?fit=1 to tune pieces live on the phone; tweaks are kept
// on that device and "Copy" puts the JSON on the clipboard to paste into
// data/costume_fit.json.
// ---------------------------------------------------------------------------

const LOCAL_KEY = 'hauntedglen.fit';
let FIT = { slot: {}, item: {} };
let LOCAL = {};
try { LOCAL = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch { LOCAL = {}; }

// which boy a Kid is ('carter' / 'jack'); the shelf mannequins are 'form'
export const kidKey = (kid) => (kid.cfg.name ? kid.cfg.name.toLowerCase() : 'form');

export function fitFor(who, itemId, slot) {
  return LOCAL[itemId]?.[who] || FIT.item[itemId]?.[who] || FIT.slot[slot]?.[who] || null;
}

export function setLocalFit(itemId, who, fit) {
  LOCAL[itemId] = LOCAL[itemId] || {};
  if (fit) LOCAL[itemId][who] = fit; else delete LOCAL[itemId][who];
  if (!Object.keys(LOCAL[itemId]).length) delete LOCAL[itemId];
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(LOCAL)); } catch { /* ignore */ }
}

// everything tuned so far, merged, ready to paste into data/costume_fit.json
export function exportFit() {
  const out = { slot: FIT.slot, item: JSON.parse(JSON.stringify(FIT.item)) };
  for (const [id, byKid] of Object.entries(LOCAL)) out.item[id] = { ...(out.item[id] || {}), ...byKid };
  return JSON.stringify(out, null, 1);
}

// wrap a costume part so the fit can move it without touching the item code
export function fitWrap(obj, fit) {
  const g = new THREE.Group();
  g.add(obj);
  if (fit) {
    const p = fit.p || [0, 0, 0], r = fit.r || [0, 0, 0];
    g.position.set(p[0], p[1], p[2]);
    g.rotation.set(THREE.MathUtils.degToRad(r[0]), THREE.MathUtils.degToRad(r[1]), THREE.MathUtils.degToRad(r[2]));
    g.scale.setScalar(fit.s ?? 1);
  }
  return g;
}

// --- GLB items --------------------------------------------------------------
const DEFAULT_ANCHOR = { hat: 'head', face: 'face', prop: 'hand', outfit: 'back' };
const DEFAULT_ALIGN = { hat: 'bottom', face: 'center', prop: 'center', outfit: 'center' };
const TEXTURES = EXTRA_TEX; // name -> THREE.Texture for outfit shirts / pants

function glbBuild(item, gltf, spec) {
  const src = gltf.scene;
  src.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(src);
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const big = Math.max(size.x, size.y, size.z) || 1;
  const align = spec.align || DEFAULT_ALIGN[item.slot];
  return (d) => {
    // size and offset are in "head radii" for hats and faces, "body radii" otherwise
    const unit = item.slot === 'hat' || item.slot === 'face' ? d.headR : d.torsoR;
    const s = ((spec.size ?? 2.4) * unit) / big;
    const model = src.clone(true);
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.material = o.material.clone(); } });
    const ay = align === 'bottom' ? box.min.y : align === 'top' ? box.max.y : c.y;
    model.scale.setScalar(s);
    const off = spec.offset || [0, 0, 0];
    model.position.set(-c.x * s + off[0] * unit, -ay * s + off[1] * unit, -c.z * s + off[2] * unit);
    const r = spec.rot || [0, 0, 0];
    const g = new THREE.Group();
    g.rotation.set(THREE.MathUtils.degToRad(r[0]), THREE.MathUtils.degToRad(r[1]), THREE.MathUtils.degToRad(r[2]));
    g.add(model);
    const parts = [{ anchor: spec.anchor || DEFAULT_ANCHOR[item.slot], obj: g, hideHead: !!spec.hideHead }];
    // an outfit can still bring along its hand-built extras (cape etc.) unless told not to
    if (item.slot === 'outfit' && spec.keepParts && item._build) parts.push(...item._build(d));
    return parts;
  };
}

// Load both JSON files and any models/textures they point at. Safe to call
// even if the files are missing: everything falls back to the built-in pieces.
export async function loadCostumeData() {
  try {
    const r = await fetch('data/costume_fit.json');
    if (r.ok) { const j = await r.json(); FIT = { slot: j.slot || {}, item: j.item || {} }; }
  } catch { /* no fit file: defaults */ }
  let models = {};
  try {
    const r = await fetch('data/costume_models.json');
    if (r.ok) models = await r.json();
  } catch { /* none */ }
  const loader = new GLTFLoader();
  const tl = new THREE.TextureLoader();
  const jobs = [];
  for (const [id, spec] of Object.entries(models.items || {})) {
    const item = ITEM[id];
    if (!item || !spec.glb) continue;
    jobs.push(loader.loadAsync(spec.glb).then((gltf) => {
      item._build = item._build || item.build;
      item.build = glbBuild(item, gltf, spec);
    }).catch((e) => console.warn(`Couldn't load ${spec.glb}, keeping the built-in ${id}`, e)));
  }
  for (const [id, spec] of Object.entries(models.textures || {})) {
    const item = ITEM[id];
    if (!item?.colors) continue;
    // plain colors for the parts a picture doesn't cover
    for (const k of ['sleeves', 'shoes']) if (spec[k]) item.colors = { ...item.colors, [k]: spec[k] };
    for (const part of ['shirt', 'pants']) {
      if (!spec[part]) continue;
      const name = `img:${id}:${part}`;
      jobs.push(tl.loadAsync(spec[part]).then((t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = THREE.RepeatWrapping;
        t.offset.x = 0.5;
        TEXTURES[name] = t;
        item.colors = { ...item.colors, [part === 'shirt' ? 'tex' : 'pantsTex']: name };
        // the picture carries the color, so don't tint it
        if (part === 'shirt') item.colors.shirt = '#ffffff';
        else item.colors.pants = '#ffffff';
      }).catch((e) => console.warn(`Couldn't load ${spec[part]}`, e)));
    }
  }
  await Promise.all(jobs);
}
