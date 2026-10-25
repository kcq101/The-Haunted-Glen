import * as THREE from 'three';
import { DAY_CYCLE_SECONDS } from './config.js';
import { clamp } from './util.js';
import { HIGH } from './quality.js';

// Morning -> noon -> afternoon -> golden hour -> sunset -> night -> dawn.
// az = sun direction around the horizon (0 = east, -90 = south, -180 = west).
const KEYS = [
  { t: 0.0, elev: 14, az: -20, top: '#7fb0e6', hor: '#f3e0c6', sun: '#ffe2b0', sunI: 2.4, hemS: '#cfe0f5', hemG: '#7d6a4c', hemI: 1.0, fog: '#e9e2d4', night: 0 },
  { t: 0.12, elev: 32, az: -45, top: '#5f9ee8', hor: '#d9e8f2', sun: '#fff1d6', sunI: 2.8, hemS: '#d6e6fa', hemG: '#7a6e52', hemI: 1.1, fog: '#d9e4ec', night: 0 },
  { t: 0.24, elev: 55, az: -90, top: '#4d92ea', hor: '#cfe3f3', sun: '#ffffff', sunI: 3.0, hemS: '#dbe9fb', hemG: '#7f7458', hemI: 1.15, fog: '#d5e3ee', night: 0 },
  { t: 0.35, elev: 30, az: -105, top: '#5a8fd8', hor: '#e8dcc0', sun: '#fff0cf', sunI: 2.7, hemS: '#d2def2', hemG: '#7d6c50', hemI: 1.05, fog: '#e2dccb', night: 0 },
  { t: 0.45, elev: 11, az: -115, top: '#6c93d6', hor: '#f7c98a', sun: '#ffbd6e', sunI: 2.6, hemS: '#c4d6f2', hemG: '#80684a', hemI: 1.0, fog: '#ecd2ae', night: 0 },
  { t: 0.56, elev: 6, az: -120, top: '#5a7fc8', hor: '#f8a965', sun: '#ffa04e', sunI: 2.3, hemS: '#c0c8e6', hemG: '#7a5c40', hemI: 0.9, fog: '#e7b48c', night: 0 },
  { t: 0.62, elev: 0, az: -125, top: '#40589e', hor: '#ec7d50', sun: '#ff6e3c', sunI: 1.2, hemS: '#9c9cc8', hemG: '#5e4234', hemI: 0.7, fog: '#bd7f70', night: 0.25 },
  { t: 0.67, elev: -7, az: -130, top: '#1d2556', hor: '#5d4478', sun: '#8fa3ff', sunI: 0.45, hemS: '#4f5a94', hemG: '#2a2230', hemI: 0.55, fog: '#3a3658', night: 0.85 },
  { t: 0.71, elev: -12, az: -130, top: '#0a0f2e', hor: '#262650', sun: '#8aa2ff', sunI: 0.75, hemS: '#4a5a9e', hemG: '#262030', hemI: 0.8, fog: '#1a1c38', night: 1 },
  { t: 0.9, elev: -12, az: 10, top: '#0a0f2e', hor: '#262650', sun: '#8aa2ff', sunI: 0.75, hemS: '#4a5a9e', hemG: '#262030', hemI: 0.8, fog: '#1a1c38', night: 1 },
  { t: 0.955, elev: -4, az: -5, top: '#33467e', hor: '#e8957a', sun: '#ff9a6a', sunI: 0.8, hemS: '#7a7cb0', hemG: '#3e3032', hemI: 0.7, fog: '#8a7088', night: 0.5 },
  { t: 1.0, elev: 14, az: -20, top: '#7fb0e6', hor: '#f3e0c6', sun: '#ffe2b0', sunI: 2.4, hemS: '#cfe0f5', hemG: '#7d6a4c', hemI: 1.0, fog: '#e9e2d4', night: 0 },
];
// Times the sun/moon button jumps between
export const PHASES = [
  { id: 'morning', label: 'Morning', icon: '🌅', t: 0.02 },
  { id: 'noon', label: 'Noon', icon: '☀️', t: 0.24 },
  { id: 'golden', label: 'Golden hour', icon: '🌇', t: 0.46 },
  { id: 'night', label: 'Night', icon: '🌙', t: 0.75 },
];
export const NIGHT_START = 0.67;
KEYS.forEach((k) => {
  for (const f of ['top', 'hor', 'sun', 'hemS', 'hemG', 'fog']) k[f] = new THREE.Color(k[f]);
});

export class DayNight {
  constructor(scene) {
    this.scene = scene;
    this.t = 0.46; // start in golden hour
    this.state = {};
    this.night = 0;

    this.sun = new THREE.DirectionalLight('#ffffff', 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(HIGH ? 2048 : 1024, HIGH ? 2048 : 1024);
    if (HIGH) this.sun.shadow.radius = 3;
    const sc = this.sun.shadow.camera;
    sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 220;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight('#ffffff', '#444444', 1);
    scene.add(this.hemi);

    scene.fog = new THREE.Fog('#ecd2ae', 70, 260);

    // Sky dome
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color() },
        uHor: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3() },
        uSunCol: { value: new THREE.Color() },
        uNight: { value: 0 },
      },
      vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uNight;
        varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y, -0.2, 1.0);
          vec3 c = mix(uHor, uTop, pow(smoothstep(-0.05, 0.75, h), 0.7));
          float s = max(dot(vDir, normalize(uSunDir)), 0.0);
          c += uSunCol * (pow(s, 6.0) * 0.35 + pow(s, 120.0) * 1.2) * (1.0 - uNight);
          gl_FragColor = vec4(c, 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), this.skyMat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    // Stars
    const n = 700, sp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * Math.PI * 2, v = Math.random() * 0.9 + 0.08;
      const r = 285;
      sp[i * 3] = Math.cos(u) * Math.sqrt(1 - v * v) * r;
      sp[i * 3 + 1] = v * r;
      sp[i * 3 + 2] = Math.sin(u) * Math.sqrt(1 - v * v) * r;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.starMat = new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(sg, this.starMat);
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // Moon
    const mc = document.createElement('canvas');
    mc.width = mc.height = 128;
    const g = mc.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 10, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,250,225,1)');
    grd.addColorStop(0.45, 'rgba(255,245,210,1)');
    grd.addColorStop(0.5, 'rgba(255,240,200,0.35)');
    grd.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(200,190,170,0.5)';
    [[50, 52, 8], [74, 70, 6], [60, 80, 5]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
    const mt = new THREE.CanvasTexture(mc);
    mt.colorSpace = THREE.SRGBColorSpace;
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: mt, transparent: true, fog: false, depthWrite: false }));
    this.moon.scale.set(28, 28, 1);
    scene.add(this.moon);

    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3(0.45, 0.7, 0.55).normalize();
  }

  // Which part of the day it is now
  phase() {
    const t = this.t;
    if (t >= NIGHT_START && t < 0.94) return PHASES[3];
    if (t >= 0.4 && t < NIGHT_START) return PHASES[2];
    if (t >= 0.17 && t < 0.4) return PHASES[1];
    return PHASES[0];
  }

  // The time button: jump ahead to the next part of the day
  next() {
    const i = PHASES.indexOf(this.phase());
    const n = PHASES[(i + 1) % PHASES.length];
    this.t = n.t;
    return n;
  }

  update(dt, center) {
    this.t = (this.t + dt / DAY_CYCLE_SECONDS) % 1;
    let a = KEYS[0], b = KEYS[1];
    for (let i = 0; i < KEYS.length - 1; i++) {
      if (this.t >= KEYS[i].t && this.t <= KEYS[i + 1].t) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    }
    const k = clamp((this.t - a.t) / (b.t - a.t || 1), 0, 1);
    const s = this.state;
    for (const f of ['top', 'hor', 'sun', 'hemS', 'hemG', 'fog']) {
      s[f] = s[f] || new THREE.Color();
      s[f].copy(a[f]).lerp(b[f], k);
    }
    for (const f of ['elev', 'az', 'sunI', 'hemI', 'night']) s[f] = a[f] + (b[f] - a[f]) * k;
    this.night = s.night;

    const el = THREE.MathUtils.degToRad(s.elev);
    const az = THREE.MathUtils.degToRad(s.az);
    this.sunDir.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az) * -1).normalize();
    const lightDir = this.sunDir.clone();
    if (s.elev < 2) lightDir.lerp(this.moonDir, clamp((2 - s.elev) / 8, 0, 1)).normalize();
    lightDir.y = Math.max(lightDir.y, 0.12);

    this.sun.color.copy(s.sun);
    this.sun.intensity = s.sunI;
    this.sun.position.copy(center).addScaledVector(lightDir, 90);
    this.sun.target.position.copy(center);
    this.hemi.color.copy(s.hemS);
    this.hemi.groundColor.copy(s.hemG);
    this.hemi.intensity = s.hemI;

    this.scene.fog.color.copy(s.fog);
    this.scene.fog.near = 70 - s.night * 35;
    this.scene.fog.far = 260 - s.night * 90;

    this.skyMat.uniforms.uTop.value.copy(s.top);
    this.skyMat.uniforms.uHor.value.copy(s.hor);
    this.skyMat.uniforms.uSunDir.value.copy(this.sunDir);
    this.skyMat.uniforms.uSunCol.value.copy(s.sun);
    this.skyMat.uniforms.uNight.value = s.night;
    this.sky.position.copy(center);
    this.stars.position.copy(center);
    this.starMat.opacity = clamp((s.night - 0.4) / 0.5, 0, 1);
    this.moon.position.copy(center).addScaledVector(this.moonDir, 270);
    this.moon.material.opacity = clamp((s.night - 0.2) / 0.5, 0, 1);
  }
}
