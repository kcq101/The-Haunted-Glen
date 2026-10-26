import * as THREE from 'three';
import { litMat, q } from './quality.js';

// ---------------------------------------------------------------------------
// Hazel, the hare who runs the Hares Hill Halloween Emporium.
// Chibi proportions to match the boys: big round head, big glossy eyes, rosy
// cheeks, long ears (one flops), round spectacles, a little witch hat, an
// orange scarf and a purple cardigan. Built to stand behind the counter.
// g.userData.update(time, dt) animates her; g.userData.wave() / .cheer() react.
// ---------------------------------------------------------------------------

export function makeHazel() {
  const g = new THREE.Group();
  const sph = new THREE.SphereGeometry(1, q(28, 18), q(20, 14));
  const fur = litMat({ color: '#b07a4e' });
  const furLight = litMat({ color: '#f1dfc4' });
  const pinkIn = litMat({ color: '#f0a9a6' });
  const sweater = litMat({ color: '#5a2f86' });
  const sweaterDark = litMat({ color: '#43216a' });
  const scarf = litMat({ color: '#f08a24' });
  const scarfStripe = litMat({ color: '#ffd27a' });
  const gold = litMat({ color: '#e6bb45', metalness: 0.4, roughness: 0.4 });
  const hatMat = litMat({ color: '#3d2552' });
  const black = new THREE.MeshBasicMaterial({ color: '#1d1420' });
  const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const cheekMat = new THREE.MeshBasicMaterial({ color: '#ff8f9a', transparent: true, opacity: 0.5, depthWrite: false });
  const noseMat = litMat({ color: '#e7737f', roughness: 0.5 });

  const ball = (mat, parent, x, y, z, sx, sy = sx, sz = sx) => {
    const m = new THREE.Mesh(sph, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  // --- body: a soft pear in a cardigan ----------------------------------------
  const body = new THREE.Group();
  g.add(body);
  const pear = new THREE.LatheGeometry([
    [0.001, 0], [0.38, 0.02], [0.47, 0.2], [0.46, 0.45], [0.38, 0.7], [0.26, 0.86], [0.12, 0.92], [0.001, 0.93],
  ].map(([x, y]) => new THREE.Vector2(x, y)), q(28, 16));
  const torso = new THREE.Mesh(pear, sweater);
  torso.position.y = 0.2;
  torso.castShadow = true;
  body.add(torso);
  // cream tummy / shirt front + cardigan edges + buttons
  ball(furLight, body, 0, 0.62, 0.24, 0.25, 0.34, 0.2);
  for (const s of [-1, 1]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.05), sweaterDark);
    edge.position.set(s * 0.2, 0.6, 0.37);
    edge.rotation.set(-0.12, 0, s * -0.12);
    body.add(edge);
  }
  for (let i = 0; i < 3; i++) ball(gold, body, 0.21 - i * 0.008, 0.78 - i * 0.16, 0.41 - i * 0.005, 0.035);
  // pumpkin brooch
  ball(scarf, body, -0.24, 0.78, 0.36, 0.06, 0.05, 0.04);
  ball(litMat({ color: '#4d6b2a' }), body, -0.24, 0.83, 0.36, 0.015, 0.025, 0.015);

  // scarf: chunky ring + a tail
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.075, q(10, 6), q(22, 14)), scarf);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.1;
  body.add(ring);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.32, 0.06), scarf);
  tail.position.set(0.13, 0.92, 0.27);
  tail.rotation.set(-0.2, 0, 0.15);
  body.add(tail);
  for (const y of [-0.06, 0.06]) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.03, 0.065), scarfStripe);
    st.position.set(0, y, 0);
    tail.add(st);
  }

  // --- arms: sleeves + paws (pivot at the shoulder) ---------------------------
  const arms = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.36, 0.98, 0.02);
    body.add(pivot);
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.32, 4, q(14, 10)), sweater);
    sleeve.position.y = -0.2;
    sleeve.castShadow = true;
    pivot.add(sleeve);
    ball(sweaterDark, pivot, 0, -0.4, 0, 0.115, 0.05, 0.115); // cuff
    const paw = ball(furLight, pivot, 0, -0.47, 0, 0.1, 0.09, 0.11);
    // resting pose: paws forward onto the counter
    pivot.rotation.set(-0.95, 0, s * 0.18);
    pivot.userData.rest = pivot.rotation.clone();
    arms.push(pivot);
    pivot.userData.paw = paw;
  }

  // --- head ------------------------------------------------------------------
  const neck = new THREE.Group();
  neck.position.y = 1.18;
  body.add(neck);
  const head = new THREE.Group();
  head.position.y = 0.36;
  neck.add(head);
  const R = 0.42;
  ball(fur, head, 0, 0, 0, R, R * 0.92, R * 0.9);
  // fluffy cheek tufts at the sides
  for (const s of [-1, 1]) ball(fur, head, s * R * 0.88, -R * 0.3, R * 0.1, R * 0.26, R * 0.22, R * 0.24);
  // muzzle
  for (const s of [-1, 1]) ball(furLight, head, s * R * 0.2, -R * 0.38, R * 0.74, R * 0.25, R * 0.2, R * 0.18);
  ball(furLight, head, 0, -R * 0.55, R * 0.7, R * 0.18, R * 0.14, R * 0.14); // chin
  // nose (wiggles)
  const nose = ball(noseMat, head, 0, -R * 0.2, R * 0.9, R * 0.1, R * 0.075, R * 0.07);
  // two buck teeth
  for (const s of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(R * 0.1, R * 0.13, R * 0.04), white);
    t.position.set(s * R * 0.055, -R * 0.58, R * 0.87);
    head.add(t);
  }
  // little "w" mouth line
  const mouthGeo = new THREE.TorusGeometry(R * 0.07, R * 0.016, 6, 12, Math.PI);
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(mouthGeo, black);
    m.position.set(s * R * 0.07, -R * 0.43, R * 0.93);
    m.rotation.set(0.2, 0, Math.PI);
    head.add(m);
  }
  // big glossy eyes with lids that blink
  const lids = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(s * R * 0.38, R * 0.1, R * 0.78);
    eye.rotation.y = s * 0.32;
    head.add(eye);
    ball(white, eye, 0, 0, 0, R * 0.21, R * 0.25, R * 0.1);
    ball(black, eye, s * -R * 0.01, -R * 0.02, R * 0.04, R * 0.17, R * 0.21, R * 0.09);
    ball(white, eye, s * -R * 0.06, R * 0.07, R * 0.12, R * 0.055, R * 0.06, R * 0.03);
    ball(white, eye, s * R * 0.06, -R * 0.09, R * 0.12, R * 0.025, R * 0.028, R * 0.02);
    // eyelid: a fur cap that drops over the eye
    const lid = ball(fur, eye, 0, R * 0.3, R * 0.02, R * 0.24, R * 0.06, R * 0.13);
    lid.visible = false;
    lids.push(lid);
    // lashes
    for (let k = 0; k < 2; k++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(R * 0.11, R * 0.025, R * 0.02), black);
      l.position.set(s * R * (0.17 + k * 0.05), R * (0.19 + k * 0.05), R * 0.06);
      l.rotation.z = s * (0.5 + k * 0.35);
      eye.add(l);
    }
    // rosy cheek
    const ch = new THREE.Mesh(new THREE.CircleGeometry(R * 0.14, 16), cheekMat);
    ch.position.set(s * R * 0.58, -R * 0.26, R * 0.72);
    ch.rotation.y = s * 0.6;
    head.add(ch);
    // brow
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.022, R * 0.13, 2, 6), litMat({ color: '#8a6446' }));
    brow.position.set(s * R * 0.38, R * 0.42, R * 0.8);
    brow.rotation.set(0, 0, Math.PI / 2 + s * 0.2);
    head.add(brow);
  }
  // round gold spectacles perched low on the nose
  const rimGeo = new THREE.TorusGeometry(R * 0.2, R * 0.022, 6, q(24, 14));
  for (const s of [-1, 1]) {
    const rim = new THREE.Mesh(rimGeo, gold);
    rim.position.set(s * R * 0.36, R * 0.04, R * 0.98);
    rim.rotation.y = s * 0.3;
    head.add(rim);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(R * 0.2, R * 0.03, R * 0.03), gold);
  bridge.position.set(0, R * 0.1, R * 1.0);
  head.add(bridge);

  // ears: long and soft, the left one flops over halfway up
  const earGeo = new THREE.CapsuleGeometry(R * 0.2, R * 0.75, 4, q(14, 10));
  const earInGeo = new THREE.CapsuleGeometry(R * 0.12, R * 0.62, 4, q(12, 8));
  const ears = [];
  for (const s of [-1, 1]) {
    const base = new THREE.Group();
    base.position.set(s * R * 0.42, R * 0.72, -R * 0.08);
    base.rotation.set(-0.12, 0, s * -0.2);
    head.add(base);
    const lower = new THREE.Mesh(earGeo, fur);
    lower.scale.z = 0.55;
    lower.position.y = R * 0.45;
    lower.castShadow = true;
    base.add(lower);
    const lin = new THREE.Mesh(earInGeo, pinkIn);
    lin.scale.z = 0.4;
    lin.position.set(0, R * 0.45, R * 0.06);
    base.add(lin);
    if (s === -1) {
      // flop: shorten the straight part and add a bent tip
      lower.scale.y = 0.55; lower.position.y = R * 0.3;
      lin.scale.y = 0.5; lin.position.y = R * 0.3;
      const tip = new THREE.Group();
      tip.position.y = R * 0.62;
      tip.rotation.z = 0.95;
      base.add(tip);
      const t = new THREE.Mesh(earGeo, fur);
      t.scale.set(1, 0.6, 0.55);
      t.position.y = R * 0.32;
      tip.add(t);
      const tin = new THREE.Mesh(earInGeo, pinkIn);
      tin.scale.set(1, 0.55, 0.4);
      tin.position.set(0, R * 0.32, R * 0.06);
      tip.add(tin);
      base.userData.tip = tip;
    }
    ears.push(base);
    base.userData.rest = base.rotation.clone();
  }

  // a little witch hat tipped jauntily between the ears
  const hat = new THREE.Group();
  hat.position.set(R * 0.06, R * 0.84, R * 0.06);
  hat.rotation.set(-0.12, 0, -0.22);
  head.add(hat);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.55, R * 0.58, R * 0.05, q(28, 16)), hatMat);
  brim.castShadow = true;
  hat.add(brim);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(R * 0.3, R * 0.9, q(20, 12), 4), hatMat);
  crown.position.y = R * 0.45;
  crown.castShadow = true;
  // bend the tip of the cone back a little
  const cp = crown.geometry.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const t = (cp.getY(i) + R * 0.45) / (R * 0.9);
    cp.setX(i, cp.getX(i) - t * t * R * 0.35);
  }
  crown.geometry.computeVertexNormals();
  hat.add(crown);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.29, R * 0.3, R * 0.1, q(20, 12), 1, true), scarf);
  band.position.y = R * 0.08;
  hat.add(band);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(R * 0.12, R * 0.1, R * 0.02), gold);
  buckle.position.set(0, R * 0.08, R * 0.3);
  hat.add(buckle);

  // --- animation ---------------------------------------------------------------
  let blinkT = 1.5, earT = 2.5, earKick = 0, wave = 0, cheer = 0, noseT = 0;
  g.userData.head = head;
  g.userData.wave = () => { wave = 2.2; };
  g.userData.cheer = () => { cheer = 1.0; wave = 1.4; };
  g.userData.update = (time, dt = 1 / 60) => {
    // gentle idle sway and breathing
    body.rotation.z = Math.sin(time * 0.9) * 0.025;
    body.scale.y = 1 + Math.sin(time * 2.2) * 0.012;
    neck.rotation.z = Math.sin(time * 1.3) * 0.07;
    neck.rotation.y = Math.sin(time * 0.6) * 0.18;
    neck.rotation.x = Math.sin(time * 0.8) * 0.04;
    // blink
    blinkT -= dt;
    const closed = blinkT < 0.13;
    lids.forEach((l) => (l.visible = closed));
    if (blinkT < 0) blinkT = 2 + Math.random() * 3;
    // ear twitch
    earT -= dt;
    if (earT < 0) { earKick = 1; earT = 2 + Math.random() * 4; }
    earKick = Math.max(0, earKick - dt * 3);
    const tw = Math.sin(earKick * Math.PI * 3) * earKick * 0.25;
    ears[1].rotation.z = ears[1].userData.rest.z - tw;
    ears[0].rotation.z = ears[0].userData.rest.z + Math.sin(time * 1.1) * 0.04;
    if (ears[0].userData.tip) ears[0].userData.tip.rotation.z = 0.95 + Math.sin(time * 2) * 0.08 + tw * 0.6;
    // nose wiggle in little bursts
    noseT = (noseT + dt) % 3;
    nose.position.y = -R * 0.2 + (noseT < 0.5 ? Math.sin(noseT * 40) * R * 0.012 : 0);
    // wave with the right paw
    const arm = arms[1];
    if (wave > 0) {
      wave = Math.max(0, wave - dt);
      const k = Math.min(1, wave * 3, (2.2 - wave) * 5);
      arm.rotation.x = arm.userData.rest.x * (1 - k) + -0.2 * k;
      arm.rotation.z = arm.userData.rest.z + k * (2.3 + Math.sin(time * 14) * 0.3);
    } else arm.rotation.copy(arm.userData.rest);
    // happy hop
    if (cheer > 0) {
      cheer = Math.max(0, cheer - dt * 1.6);
      body.position.y = Math.abs(Math.sin(cheer * Math.PI * 2)) * 0.12;
    } else body.position.y = 0;
  };
  return g;
}
