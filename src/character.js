import * as THREE from 'three';
import { litMat, q } from './quality.js';
import { ITEM, outfitTexture } from './costumes.js';
import { MeshyBody } from './meshykid.js';
import { fitFor, fitWrap, kidKey } from './costumefit.js';
import { buildScooter } from './scooter.js';

// A cozy, chunky kid built from rounded shapes. Costume pieces snap onto
// anchors (head, hand, shoulder, back, waist, neck). This is the stand-in;
// loadModel() swaps in the boy's Meshy model once it has downloaded and keeps
// the stand-in if it can't load.
export class Kid {
  constructor(cfg) {
    this.cfg = cfg;
    const H = cfg.height;
    const d = (this.d = {
      H,
      headR: H * 0.158,
      torsoR: H * 0.118,
      legL: H * 0.36,
      torsoL: H * 0.27,
    });
    d.hipY = d.legL;
    d.shoulderY = d.hipY + d.torsoL;
    d.headY = d.shoulderY + d.headR * 0.92;

    this.mats = {
      skin: litMat({ color: cfg.skin }),
      hair: litMat({ color: cfg.hair }),
      shirt: litMat({ color: cfg.shirt }),
      sleeves: litMat({ color: cfg.shirt }),
      pants: litMat({ color: cfg.pants }),
      shoes: litMat({ color: cfg.shoes }),
      eye: new THREE.MeshBasicMaterial({ color: '#1a1410' }),
      white: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      cheek: new THREE.MeshBasicMaterial({ color: '#f29b8f', transparent: true, opacity: 0.55 }),
      mouth: new THREE.MeshBasicMaterial({ color: '#7a3a2c' }),
    };

    const root = (this.root = new THREE.Group());
    const body = (this.body = new THREE.Group());
    root.add(body);
    this.bodyParts = [];

    const add = (parent, geo, material, x, y, z, sx = 1, sy = 1, sz = 1, part = true) => {
      const m = new THREE.Mesh(geo, material);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.castShadow = true;
      parent.add(m);
      if (part) this.bodyParts.push(m);
      return m;
    };
    const sph = new THREE.SphereGeometry(1, q(28, 18), q(20, 14));

    // legs
    this.legs = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * d.torsoR * 0.48, d.hipY, 0);
      body.add(pivot);
      const legGeo = new THREE.CapsuleGeometry(d.torsoR * 0.42, d.legL * 0.62, q(6, 4), q(16, 10));
      const leg = add(pivot, legGeo, this.mats.pants, 0, -d.legL * 0.48, 0);
      leg.userData.pants = true;
      add(pivot, sph, this.mats.shoes, 0, -d.legL + d.torsoR * 0.22, d.torsoR * 0.22, d.torsoR * 0.48, d.torsoR * 0.33, d.torsoR * 0.72);
      this.legs.push(pivot);
    }
    // torso
    const torsoGeo = new THREE.CapsuleGeometry(d.torsoR, d.torsoL * 0.55, q(8, 6), q(22, 14));
    this.torso = add(body, torsoGeo, this.mats.shirt, 0, d.hipY + d.torsoL * 0.5, 0, 1.12, 1, 0.86);
    // arms
    this.arms = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * d.torsoR * 1.18, d.shoulderY - d.torsoR * 0.35, 0);
      pivot.rotation.z = s * 0.12;
      body.add(pivot);
      const armGeo = new THREE.CapsuleGeometry(d.torsoR * 0.34, d.torsoL * 0.7, q(6, 4), q(16, 10));
      add(pivot, armGeo, this.mats.sleeves, 0, -d.torsoL * 0.42, 0);
      const hand = add(pivot, sph, this.mats.skin, 0, -d.torsoL * 0.92, 0, d.torsoR * 0.36, d.torsoR * 0.38, d.torsoR * 0.36);
      this.arms.push(pivot);
      if (s === 1) {
        this.handAnchor = new THREE.Group();
        this.handAnchor.position.copy(hand.position);
        pivot.add(this.handAnchor);
      }
    }
    // head
    const head = (this.head = new THREE.Group());
    head.position.y = d.headY;
    body.add(head);
    const r = d.headR;
    this.headMesh = add(head, sph, this.mats.skin, 0, 0, 0, r, r * 0.96, r * 0.94);
    add(head, sph, this.mats.skin, -r * 0.98, -r * 0.05, 0, r * 0.18, r * 0.24, r * 0.14);
    add(head, sph, this.mats.skin, r * 0.98, -r * 0.05, 0, r * 0.18, r * 0.24, r * 0.14);
    // face
    this.eyes = [];
    for (const s of [-1, 1]) {
      const e = add(head, sph, this.mats.eye, s * r * 0.36, r * 0.02, r * 0.86, r * 0.13, r * 0.17, r * 0.08);
      add(head, sph, this.mats.white, s * r * 0.33, r * 0.08, r * 0.92, r * 0.045, r * 0.045, r * 0.03);
      add(head, sph, this.mats.cheek, s * r * 0.55, -r * 0.27, r * 0.74, r * 0.14, r * 0.09, r * 0.05);
      this.eyes.push(e);
    }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(r * 0.16, r * 0.035, 8, q(20, 12), Math.PI), this.mats.mouth);
    smile.position.set(0, -r * 0.3, r * 0.9);
    smile.rotation.set(0.25, 0, Math.PI);
    head.add(smile);
    this.bodyParts.push(smile);
    // hair
    this.hair = new THREE.Group();
    head.add(this.hair);
    add(this.hair, sph, this.mats.hair, 0, r * 0.18, -r * 0.08, r * 1.06, r * 0.9, r * 1.04);
    if (cfg.hairStyle === 'shaggy') {
      for (let i = -2; i <= 2; i++) add(this.hair, sph, this.mats.hair, i * r * 0.28, r * 0.58, r * 0.66, r * 0.26, r * 0.22, r * 0.2);
      add(this.hair, sph, this.mats.hair, 0, r * 0.95, -r * 0.1, r * 0.3, r * 0.25, r * 0.3);
    } else {
      add(this.hair, sph, this.mats.hair, r * 0.1, r * 0.62, r * 0.6, r * 0.75, r * 0.26, r * 0.32);
    }

    // anchors
    this.anchors = {
      head,
      hand: this.handAnchor,
      shoulder: new THREE.Group(),
      back: new THREE.Group(),
      waist: new THREE.Group(),
      neck: new THREE.Group(),
      face: new THREE.Group(), // face pieces (eye level); same as head on the stand-in
      root,
    };
    head.add(this.anchors.face);
    this.anchors.shoulder.position.set(-d.torsoR * 1.05, d.shoulderY + d.torsoR * 0.05, 0);
    this.anchors.back.position.set(0, d.shoulderY + d.torsoR * 0.1, -d.torsoR * 0.85);
    this.anchors.waist.position.set(0, d.hipY + d.torsoR * 0.15, 0);
    this.anchors.neck.position.set(0, d.shoulderY + d.torsoR * 0.1, 0);
    body.add(this.anchors.shoulder, this.anchors.back, this.anchors.waist, this.anchors.neck);

    this.costumeObjs = [];
    this.costume = { hat: null, face: null, outfit: null, prop: null };
    this.walkPhase = 0;
    this.speed = 0;
    this.blinkT = 2;
    this.jumpV = 0;
    this.jumpY = 0;
    this.twirlT = -1;
    // scooter
    this.scooter = null; // built on first ride
    this.riding = false;
    this.rideLift = 0;
    this.rideSpinT = -1;
    this.lean = 0;
    this.kickT = -1;
    this.push = false; // set by the game while the rider is pushing off
    this.lastPos = new THREE.Vector3();
    this.lastYaw = 0;
  }

  // Hop on (or off) the scooter. Builds it the first time.
  async setRiding(on) {
    this.riding = on;
    if (on && !this.scooter && this.cfg.scooter) {
      if (!this.scooterLoading) {
        const H = this.cfg.height, a = this.d.arm;
        const fit = a ? { shoulderY: a.shoulderY, shoulderX: a.shoulderX, reach: a.upper + a.fore } : { shoulderY: H * 0.62, shoulderX: H * 0.14, reach: H * 0.36 };
        this.scooterLoading = buildScooter(this.cfg.scooter, fit).then((sc) => { this.scooter = sc; this.body.add(sc.group); }).catch((e) => console.warn("Couldn't load the scooter", e));
      }
      await this.scooterLoading;
    }
    if (this.scooter) this.scooter.group.visible = this.riding;
    this.rideLift = this.riding && this.scooter ? this.scooter.deckH : 0;
    this.lastPos.copy(this.root.position);
    this.lastYaw = this.root.rotation.y;
    if (!this.riding) { this.lean = 0; this.body.rotation.z = 0; this.rideSpinT = -1; this.body.rotation.y = 0; }
    return !!this.scooter;
  }

  // wheels, lean and kicks; returns nothing (the game moves the kid)
  _updateRide(dt) {
    const sc = this.scooter;
    const p = this.root.position;
    const dist = Math.hypot(p.x - this.lastPos.x, p.z - this.lastPos.z);
    let dyaw = this.root.rotation.y - this.lastYaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    this.lastPos.copy(p);
    this.lastYaw = this.root.rotation.y;
    if (dist > 2) return; // teleported (doors, swapping)
    const v = dist / Math.max(dt, 1e-4);
    this.rideSpeed = v;
    for (const w of sc.wheels) w.rotation.z += dist / sc.wheelR;
    // lean into turns
    const target = Math.max(-0.32, Math.min(0.32, -(dyaw / Math.max(dt, 1e-4)) * Math.min(v, 9) * 0.035));
    this.lean += (target - this.lean) * Math.min(1, dt * 6);
    this.body.rotation.z = this.lean;
    // trick spin: a full turn with a hop
    if (this.rideSpinT >= 0) {
      this.rideSpinT += dt;
      const t = Math.min(1, this.rideSpinT / 0.75);
      this.body.rotation.y = Math.PI * 2 * (t * t * (3 - 2 * t));
      if (t >= 1) { this.rideSpinT = -1; this.body.rotation.y = 0; }
    }
    // kicks while pushing off
    if (this.kickT >= 0) { this.kickT += dt; if (this.kickT > KICK + 0.25) this.kickT = -1; }
    else if (this.push && this.jumpY === 0 && this.rideSpinT < 0) this.kickT = 0;
  }


  async loadModel(url) {
    try {
      const m = await MeshyBody.load(url, this.cfg.height, this.cfg);
      this.model = m;
      this.body.add(m.root);
      this.d = m.d; // costumes size themselves to the real boy
      this.body.add(this.handAnchor); // follows the hand bone now, not the stand-in arm
      this.anchors.face.position.y = m.d.faceDY;
      m.bindAnchors(this.anchors, this.body);
      this.setCostume(this.costume);
      return true;
    } catch (e) {
      console.warn(`Couldn't load ${url}, keeping the stand-in kid`, e);
      return false;
    }
  }

  setCostume(costume) {
    this.costume = { ...costume };
    for (const o of this.costumeObjs) o.parent && o.parent.remove(o);
    this.costumeObjs = [];
    this.animated = [];
    // reset body
    const c = this.cfg;
    this.mats.shirt.color.set(c.shirt); this.mats.shirt.map = null;
    this.mats.sleeves.color.set(c.shirt);
    this.mats.pants.color.set(c.pants); this.mats.pants.map = null;
    this.mats.shoes.color.set(c.shoes);
    for (const k of ['shirt', 'pants']) this.mats[k].needsUpdate = true;
    const proc = !this.model;
    this.bodyParts.forEach((m) => (m.visible = proc));
    this.hair.visible = proc;
    if (this.model) {
      this.model.root.visible = true;
      this.model.hideHead = false;
      this.model.setOutfit(null);
    }

    const outfit = costume.outfit && ITEM[costume.outfit];
    if (outfit?.colors) {
      const oc = outfit.colors;
      this.mats.shirt.color.set(oc.shirt);
      this.mats.sleeves.color.set(oc.sleeves);
      this.mats.pants.color.set(oc.pants);
      this.mats.shoes.color.set(oc.shoes);
      this.mats.shirt.map = outfitTexture(oc.tex);
      this.mats.pants.map = outfitTexture(oc.pantsTex);
      if (oc.pantsTex) this.mats.pants.color.set('#ffffff');
      this.mats.shirt.needsUpdate = true;
      this.mats.pants.needsUpdate = true;
      if (this.model) this.model.setOutfit(oc, outfitTexture);
    }
    let hideBody = false;
    for (const slot of ['outfit', 'hat', 'face', 'prop']) {
      const item = costume[slot] && ITEM[costume[slot]];
      if (!item) continue;
      if (hideBody && slot === 'face') continue;
      for (const part of item.build(this.d)) {
        const name = slot === 'face' && part.anchor === 'head' ? 'face' : part.anchor;
        const anchor = this.anchors[name] || this.anchors.head;
        const fitted = fitWrap(part.obj, fitFor(kidKey(this), item.id, slot));
        anchor.add(fitted);
        this.costumeObjs.push(fitted);
        part.obj.traverse((o) => { if (o.userData.blink || o.userData.bob || o.userData.flap || o.userData.spin || o.userData.cape) this.animated.push(o); });
        if (part.hideHead && this.model) this.model.hideHead = true;
        if (part.hideBody && this.model) this.model.root.visible = false;
        if (part.hideHead) { this.headMesh.visible = false; this.hair.visible = false; this.eyes.forEach((e) => (e.visible = false)); }
        if (part.hideBody) {
          hideBody = true;
          this.bodyParts.forEach((m) => (m.visible = false));
          this.hair.visible = false;
        }
      }
    }
  }

  // Returns forward travel from a spin jump this frame (0 otherwise).
  update(dt, moving, speed01, time, boost = 1) {
    const target = moving ? speed01 : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 10);
    this.walkPhase += dt * (6 + this.speed * 7 * boost) * (this.speed > 0.05 ? 1 : 0);
    const riding = this.riding && this.scooter;
    if (riding) this._updateRide(dt);
    if (this.model) {
      const adv = this.model.update(dt, riding ? 0 : this.speed, boost);
      if (this.jumpY > 0 || this.jumpV > 0) {
        this.jumpV -= 18 * dt;
        this.jumpY = Math.max(0, this.jumpY + this.jumpV * dt);
        if (this.jumpY === 0) this.jumpV = 0;
      }
      this.body.position.y = this.jumpY + this.rideLift;
      if (riding) {
        this.body.updateMatrixWorld(true);
        const k = this.kickT >= 0 && this.kickT < KICK ? { amount: Math.sin((this.kickT / KICK) * Math.PI), phase: this.kickT / KICK, ground: this.scooter.deckH } : null;
        this.model.ride({ right: this.scooter.grips[0].getWorldPosition(_gr), left: this.scooter.grips[1].getWorldPosition(_gl) }, k);
      } else this.model.unride();
      this.model.syncAnchors();
      this.animateCostume(time);
      return adv;
    }
    // stand-in kid: a quick twirl with a hop
    let adv = 0;
    if (this.twirlT >= 0) {
      this.twirlT += dt;
      const p = Math.min(1, this.twirlT / 0.9);
      this.body.rotation.y = Math.PI * 2 * (p * p * (3 - 2 * p));
      adv = 1.6 * dt / 0.9;
      if (p >= 1) { this.twirlT = -1; this.body.rotation.y = 0; }
    }
    const sw = Math.sin(this.walkPhase) * 0.75 * this.speed;
    this.legs[0].rotation.x = sw;
    this.legs[1].rotation.x = -sw;
    this.arms[0].rotation.x = -sw * 0.9;
    this.arms[1].rotation.x = sw * 0.9 - (this.costume.prop ? 0.35 : 0);
    const bob = Math.abs(Math.sin(this.walkPhase)) * 0.05 * this.speed * this.d.H;
    const breathe = Math.sin(time * 2.2) * 0.008 * this.d.H;
    // jump
    if (this.jumpY > 0 || this.jumpV > 0) {
      this.jumpV -= 18 * dt;
      this.jumpY = Math.max(0, this.jumpY + this.jumpV * dt);
      if (this.jumpY === 0) this.jumpV = 0;
    }
    this.body.position.y = bob + breathe + this.jumpY + this.rideLift;
    this.head.rotation.z = Math.sin(this.walkPhase * 0.5) * 0.05 * this.speed;
    // blink
    this.blinkT -= dt;
    const blink = this.blinkT < 0.12;
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3;
    this.eyes.forEach((e) => (e.scale.y = blink ? this.d.headR * 0.02 : this.d.headR * 0.17));
    this.animateCostume(time);
    return adv;
  }

  animateCostume(time) {
    for (const o of this.animated || []) {
      if (o.userData.blink) o.visible = Math.sin(time * 6) > -0.3;
      if (o.userData.bob) o.position.y = Math.sin(time * 3) * 0.02;
      if (o.userData.spin) o.userData.spin.rotation.y = time * 2;
      if (o.userData.cape) o.rotation.x = 0.15 + this.speed * 0.5 + Math.sin(time * 4 + this.walkPhase) * 0.05;
      if (o.userData.flap) {
        const f = o.userData.flap;
        f.position.y = this.d.H * 0.32 + Math.sin(time * 3) * 0.06;
        f.children.forEach((w) => { if (w.userData.wing) w.rotation.y = w.userData.wing * Math.sin(time * 18) * 0.6; });
      }
    }
  }

  jump() {
    if (this.jumpY === 0 && !this.spinning) this.jumpV = 5.5;
  }

  get spinning() { return this.rideSpinT >= 0 || (this.model ? this.model.spinning : this.twirlT >= 0); }

  // the 360 power spin jump (or a twirl for the stand-in kid)
  spin() {
    if (this.spinning || this.jumpY > 0) return false;
    if (this.riding && this.scooter) { this.rideSpinT = 0; this.jumpV = 6; return true; } // scooter 360
    if (this.model) return this.model.canSpin && this.model.startSpin(1.5);
    this.twirlT = 0;
    this.jumpV = 5;
    return true;
  }
}

const _gl = new THREE.Vector3(), _gr = new THREE.Vector3();
const KICK = 0.6; // seconds per kick stroke
