import * as THREE from 'three';
import { GLTFLoader } from '../lib/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from '../lib/addons/utils/SkeletonUtils.js';

// ---------------------------------------------------------------------------
// Meshy-rigged boys (Mixamo skeleton). Plays idle / walk / run, lets costume
// pieces ride along on the bones, and recolors the shirt, sleeves, pants and
// shoes in the shader when an outfit is worn (with the outfit's pattern
// wrapped around the body like on the stand-in kid).
// ---------------------------------------------------------------------------

const loader = new GLTFLoader();
const cache = new Map();
function loadGLB(url) {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url));
  return cache.get(url);
}

const short = (name) => name.replace(/^mixamorig:?/, '');

// region per bone: 0 torso (shirt), 1 arms (sleeves), 2 legs (pants), 3 feet (shoes)
function regionOf(bone) {
  const n = short(bone);
  if (/^Spine/.test(n)) return 0;
  if (/(Shoulder|Arm|ForeArm)$/.test(n)) return 1;
  if (/(UpLeg|Leg)$/.test(n)) return 2;
  if (/(Foot|Toe)/.test(n)) return 3;
  if (n === 'Hips') return 'hips';
  return -1;
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class MeshyBody {
  static async load(url, height, cfg = {}) {
    const gltf = await loadGLB(url);
    return new MeshyBody(gltf, height, cfg);
  }

  constructor(gltf, height, cfg = {}) {
    this.cfg = cfg;
    // each kid gets its own copy (the cache may be shared)
    const src = gltf.scene;
    this.root = src.userData.used ? cloneSkinned(src) : src;
    src.userData.used = true;
    let mesh = null;
    this.root.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
    this.mesh = mesh;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false; // bind-pose bounds don't follow the animation

    const geo = mesh.geometry;
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    this.scale = height / (bb.max.y - bb.min.y);
    this.root.scale.setScalar(this.scale);
    this.root.position.y = -bb.min.y * this.scale;

    this.bones = {};
    for (const b of mesh.skeleton.bones) this.bones[short(b.name)] = b;

    this._buildRegions();
    this._setupMaterial();
    this._setupAnimation(gltf.animations);
    this._measure(height);
  }

  // --- per-vertex clothing regions from the skin weights --------------------
  _buildRegions() {
    const geo = this.mesh.geometry;
    const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, pos = geo.attributes.position;
    const bones = this.mesh.skeleton.bones;
    // waist line: a little above the hip joint in the bind pose
    const hipsW = new THREE.Vector3();
    this.mesh.skeleton.pose();
    this.root.updateMatrixWorld(true);
    this.bones.Hips.getWorldPosition(hipsW);
    const hipY = this.mesh.worldToLocal(hipsW.clone()).y;
    const reg = new Float32Array(pos.count * 4);
    const torsoY = [Infinity, -Infinity], headBox = new THREE.Box3(), torsoBox = new THREE.Box3();
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      let best = 0, bw = -1;
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (w > bw) { bw = w; best = si.getComponent(i, k); }
      }
      const name = bones[best].name;
      let r = regionOf(name);
      const y = pos.getY(i);
      if (r === 'hips') r = y > hipY + 0.02 ? 0 : 2;
      if (r >= 0) reg[i * 4 + r] = 1;
      v.fromBufferAttribute(pos, i);
      if (r === 0) { torsoY[0] = Math.min(torsoY[0], y); torsoY[1] = Math.max(torsoY[1], y); torsoBox.expandByPoint(v); }
      const sn = short(name);
      if (sn === 'Head' || sn === 'HeadTop_End' || sn === 'headfront') headBox.expandByPoint(v);
    }
    geo.setAttribute('aRegion', new THREE.BufferAttribute(reg, 4));
    this.torsoY = torsoY;
    this.headBox = headBox;
    this.torsoBox = torsoBox;
    // legs: the stand-in's pants pattern wraps each leg separately
    this.legX = Math.abs(this.bones.LeftUpLeg.position.x) || 0.08;
    this.legY = [this.mesh.geometry.boundingBox.min.y, hipY];
  }

  _setupMaterial() {
    const m = this.mesh.material;
    // no environment map in this world, so metal reads as black; keep it matte
    m.metalness = 0;
    m.metalnessMap = null;
    m.roughness = 1;
    m.envMapIntensity = 0;
    const U = (this.uniforms = {
      uOn: { value: new THREE.Vector4(0, 0, 0, 0) },
      uShirt: { value: new THREE.Color() },
      uSleeve: { value: new THREE.Color() },
      uPants: { value: new THREE.Color() },
      uShoes: { value: new THREE.Color() },
      uShirtTex: { value: null },
      uPantsTex: { value: null },
      uHasTex: { value: new THREE.Vector2() },
      uTorsoY: { value: new THREE.Vector2(...this.torsoY) },
      uLegY: { value: new THREE.Vector2(...this.legY) },
      uLegX: { value: this.legX },
      // blinking: the face is painted on, so a lid + lash line is painted over each eye
      uBlink: { value: 0 },
      uEye0: { value: new THREE.Vector4(...(this.cfg.eyeUV?.[0] || [0, 0, 0, 0])) },
      uEye1: { value: new THREE.Vector4(...(this.cfg.eyeUV?.[1] || [0, 0, 0, 0])) },
      uLid: { value: new THREE.Color(this.cfg.lid || '#f6b48c') },
    });
    const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    blank.needsUpdate = true;
    U.uShirtTex.value = blank; U.uPantsTex.value = blank;
    this.blank = blank;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 aRegion;\nvarying vec4 vRegion;\nvarying vec3 vRest;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRegion = aRegion;\nvRest = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec4 vRegion; varying vec3 vRest;
uniform vec4 uOn; uniform vec3 uShirt, uSleeve, uPants, uShoes;
uniform sampler2D uShirtTex, uPantsTex; uniform vec2 uHasTex, uTorsoY, uLegY; uniform float uLegX;
uniform float uBlink; uniform vec4 uEye0, uEye1; uniform vec3 uLid;
void blinkEye(inout vec3 col, vec2 uv, vec4 E) {
  vec2 q = (uv - E.xy) / E.zw;          // -1..1 across the eye; -y is the top of the eye
  float r2 = dot(q, q);
  if (r2 >= 1.0) return;
  float edge = mix(-1.05, 0.3, uBlink) + 0.18 * (1.0 - q.x * q.x) * uBlink; // lid edge curves down
  float lid = (1.0 - smoothstep(0.75, 1.0, r2)) * step(q.y, edge);
  vec3 skin = uLid * (0.9 + 0.08 * (q.y - edge + 1.0));
  col = mix(col, skin, lid);
  float lash = (1.0 - smoothstep(0.06, 0.13, abs(q.y - edge))) * step(abs(q.x), 0.92) * step(0.25, uBlink);
  col = mix(col, vec3(0.05, 0.025, 0.015), lash * (1.0 - smoothstep(0.85, 1.0, r2)));
}`)
        .replace('#include <map_fragment>', `#include <map_fragment>
#ifdef USE_MAP
if (uBlink > 0.0) { blinkEye(diffuseColor.rgb, vMapUv, uEye0); blinkEye(diffuseColor.rgb, vMapUv, uEye1); }
#endif
if (dot(uOn, vec4(1.0)) > 0.0) {
  vec3 c = pow(max(diffuseColor.rgb, vec3(1e-4)), vec3(1.0 / 2.2));
  float gr = c.g / c.r, br = c.b / c.r;
  float skin = step(0.5, c.r) * step(0.55, gr) * step(gr, 0.87) * step(0.38, br) * step(br, 0.82) * step(0.1, c.r - c.b);
  vec4 R = vRegion * uOn * (1.0 - skin);
  float tu = atan(vRest.x, vRest.z) / 6.2831853 + 0.5;
  float tv = clamp((vRest.y - uTorsoY.x) / (uTorsoY.y - uTorsoY.x), 0.02, 0.98);
  vec3 shirt = uShirt * mix(vec3(1.0), texture2D(uShirtTex, vec2(tu, tv)).rgb, uHasTex.x);
  float lx = vRest.x - sign(vRest.x) * uLegX;
  float lu = atan(lx, vRest.z) / 6.2831853 + 0.5;
  float lv = clamp((vRest.y - uLegY.x) / (uLegY.y - uLegY.x), 0.02, 0.98);
  vec3 pants = uPants * mix(vec3(1.0), texture2D(uPantsTex, vec2(lu, lv)).rgb, uHasTex.y);
  vec3 col = diffuseColor.rgb;
  col = mix(col, shirt, R.x);
  col = mix(col, uSleeve, R.y);
  col = mix(col, pants, R.z);
  col = mix(col, uShoes, R.w);
  diffuseColor.rgb = col;
}`);
    };
    m.customProgramCacheKey = () => 'meshy-outfit';
    m.needsUpdate = true;
  }

  setOutfit(colors, texFor) {
    const U = this.uniforms;
    if (!colors) { U.uOn.value.set(0, 0, 0, 0); return; }
    U.uOn.value.set(1, 1, 1, 1);
    U.uShirt.value.set(colors.shirt);
    U.uSleeve.value.set(colors.sleeves || colors.shirt);
    U.uPants.value.set(colors.pants);
    U.uShoes.value.set(colors.shoes || colors.pants);
    const st = colors.tex && texFor(colors.tex), pt = colors.pantsTex && texFor(colors.pantsTex);
    U.uShirtTex.value = st || this.blank;
    U.uPantsTex.value = pt || this.blank;
    U.uHasTex.value.set(st ? 1 : 0, pt ? 1 : 0);
  }

  // --- animation ------------------------------------------------------------
  _setupAnimation(clips) {
    const mixer = (this.mixer = new THREE.AnimationMixer(this.root));
    const find = (re) => clips.find((c) => re.test(c.name));
    const walkClip = find(/^walking$/i) || find(/walk/i);
    const runClip = find(/^running$/i) || find(/run/i);
    this.extra = clips.filter((c) => c !== walkClip && c !== runClip);

    // Idle: arms hanging from the walk's "passing" frame, everything else in
    // the rest pose so the legs stand straight.
    const idleClip = this._makeIdle(walkClip);
    this.actions = {
      idle: mixer.clipAction(idleClip),
      walk: walkClip && mixer.clipAction(walkClip),
      run: runClip && mixer.clipAction(runClip),
    };
    for (const a of Object.values(this.actions)) if (a) { a.play(); a.setEffectiveWeight(0); }
    this.actions.idle.setEffectiveWeight(1);
    mixer.update(0);
  }

  _makeIdle(walkClip) {
    const bones = this.mesh.skeleton.bones;
    this.mesh.skeleton.pose();
    const rest = new Map(bones.map((b) => [b, { q: b.quaternion.clone(), p: b.position.clone() }]));
    const armQ = new Map();
    if (walkClip) {
      const m = new THREE.AnimationMixer(this.root);
      const a = m.clipAction(walkClip).play();
      const lf = this.bones.LeftFoot, rf = this.bones.RightFoot, pl = new THREE.Vector3(), pr = new THREE.Vector3();
      let bestT = 0, best = Infinity;
      for (let i = 0; i < 40; i++) {
        const t = (i / 40) * walkClip.duration;
        a.time = t; m.update(0);
        this.root.updateMatrixWorld(true);
        lf.getWorldPosition(pl); rf.getWorldPosition(pr);
        const dz = Math.abs(pl.z - pr.z);
        if (dz < best) { best = dz; bestT = t; }
      }
      a.time = bestT; m.update(0);
      for (const b of bones) if (/(Shoulder|Arm|ForeArm|Hand)/.test(short(b.name))) armQ.set(b, b.quaternion.clone());
      m.stopAllAction(); m.uncacheRoot(this.root);
    }
    const tracks = [];
    for (const b of bones) {
      const q = armQ.get(b) || rest.get(b).q;
      tracks.push(new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, [0], q.toArray()));
      if (short(b.name) === 'Hips') tracks.push(new THREE.VectorKeyframeTrack(`${b.name}.position`, [0], rest.get(b).p.toArray()));
    }
    this.mesh.skeleton.pose();
    return new THREE.AnimationClip('idle', -1, tracks);
  }

  // speed01: 0 standing … 1 full joystick
  update(dt, speed01) {
    const { idle, walk, run } = this.actions;
    const move = smooth(0.03, 0.2, speed01);
    const r = run ? smooth(0.55, 0.8, speed01) : 0;
    idle.setEffectiveWeight(1 - move);
    if (walk) { walk.setEffectiveWeight(move * (1 - r)); walk.timeScale = 0.75 + speed01 * 0.9; }
    if (run) { run.setEffectiveWeight(move * r); run.timeScale = 0.8 + speed01 * 0.35; }
    this.mixer.update(dt);
    this._blink(dt);
    if (this.hideHead) this.bones.Head.scale.setScalar(0.001);
    else this.bones.Head.scale.setScalar(1);
  }

  // a blink every few seconds, sometimes a double blink
  _blink(dt) {
    if (!this.cfg.eyeUV) return;
    if (this.blinkWait === undefined) this.blinkWait = 1 + Math.random() * 3;
    this.blinkWait -= dt;
    if (this.blinkWait <= 0) {
      this.blinkWait = 2.5 + Math.random() * 3.5;
      this.blinkAt = 0;
      this.blinkTimes = Math.random() < 0.2 ? 2 : 1;
    }
    let v = 0;
    if (this.blinkAt !== undefined && this.blinkAt >= 0) {
      const D = 0.16, GAP = 0.08;
      this.blinkAt += dt;
      const p = this.blinkAt % (D + GAP);
      if (p < D) v = Math.min(1, Math.sin((p / D) * Math.PI) * 1.4);
      if (this.blinkAt > this.blinkTimes * (D + GAP)) this.blinkAt = -1;
    }
    this.uniforms.uBlink.value = v;
  }

  // --- body measurements for costumes (same fields as the stand-in kid) ------
  _measure(H) {
    const s = this.scale, y0 = this.root.position.y;
    this.root.updateMatrixWorld(true);
    const wp = (b) => { const v = new THREE.Vector3(); b.getWorldPosition(v); return v; };
    // positions are relative to the kid's body group = this.root's parent
    const hip = wp(this.bones.Hips), sh = wp(this.bones.LeftArm);
    const face = this.bones.headfront ? wp(this.bones.headfront) : null;
    const hc = new THREE.Vector3(); this.headBox.getCenter(hc);
    const hs = new THREE.Vector3(); this.headBox.getSize(hs);
    const ts = new THREE.Vector3(); this.torsoBox.getSize(ts);
    const d = {
      H,
      headR: (hs.x / 2) * s * 0.9,
      torsoR: Math.max((ts.x / 2) / 1.12, (ts.z / 2) / 0.86) * s * 0.92,
      hipY: hip.y,
      legL: hip.y,
      shoulderY: sh.y,
      headY: hc.y * s + y0,
      headZ: hc.z * s,
    };
    // chibi eyes sit well below the middle of the big head
    d.faceDY = face ? (face.y - d.headY) * 0.5 : 0;
    d.torsoL = d.shoulderY - d.hipY;
    this.d = d;
  }

  // Costume anchors follow bones. Anchor rest spots are given in body space.
  bindAnchors(anchors, body) {
    const d = this.d;
    const spots = {
      head: ['Head', [0, d.headY, d.headZ]],
      hand: ['LeftHand', null],
      shoulder: ['Spine2', [-d.torsoR * 1.05, d.shoulderY + d.torsoR * 0.05, 0]],
      back: ['Spine2', [0, d.shoulderY + d.torsoR * 0.1, -d.torsoR * 0.85]],
      waist: ['Hips', [0, d.hipY + d.torsoR * 0.15, 0]],
      neck: ['Spine2', [0, d.shoulderY + d.torsoR * 0.1, 0]],
    };
    body.updateMatrixWorld(true);
    const invBody = body.matrixWorld.clone().invert();
    this.links = [];
    for (const [name, [boneName, p]] of Object.entries(spots)) {
      const a = anchors[name], bone = this.bones[boneName];
      if (!a || !bone) continue;
      const boneInBody = invBody.clone().multiply(noScale(bone.matrixWorld));
      const pos = p ? new THREE.Vector3(...p) : new THREE.Vector3().setFromMatrixPosition(boneInBody);
      // hand: keep the prop upright relative to the hanging arm pose
      const want = new THREE.Matrix4().makeTranslation(pos.x, pos.y, pos.z);
      const offset = boneInBody.clone().invert().multiply(want);
      a.matrixAutoUpdate = false;
      this.links.push({ a, bone, offset });
    }
    this.body = body;
  }

  syncAnchors() {
    if (!this.links) return;
    this.body.updateMatrixWorld(true);
    const invBody = _m.copy(this.body.matrixWorld).invert();
    for (const { a, bone, offset } of this.links) {
      a.matrix.copy(invBody).multiply(noScale(bone.matrixWorld)).multiply(offset);
      a.matrixWorldNeedsUpdate = true;
    }
  }
}

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _n = new THREE.Matrix4();
function noScale(m) {
  m.decompose(_p, _q, _s);
  // keep the model's overall scale out of the anchor (costumes are in meters)
  return _n.compose(_p, _q, _s.set(1, 1, 1));
}
