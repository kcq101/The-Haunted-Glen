import * as THREE from 'three';

// Soft light halos (porch lights, jack-o'-lanterns, street lamps, door glows).
// One draw call for all of them; brightness follows the day/night cycle.
export class GlowField {
  constructor(max = 2000) {
    this.max = max;
    this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.day = new Float32Array(max); // visibility during the day (0..1)
    this.alpha = new Float32Array(max).fill(1);
    this.flicker = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('gcolor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('gsize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('gday', new THREE.BufferAttribute(this.day, 1));
    geo.setAttribute('galpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setAttribute('gflicker', new THREE.BufferAttribute(this.flicker, 1));
    this.geo = geo;
    this.material = new THREE.ShaderMaterial({
      uniforms: { uNight: { value: 0 }, uTime: { value: 0 }, uScale: { value: 400 } },
      vertexShader: /* glsl */ `
        attribute vec3 gcolor; attribute float gsize; attribute float gday; attribute float galpha; attribute float gflicker;
        uniform float uNight; uniform float uTime; uniform float uScale;
        varying vec3 vColor; varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float f = 1.0 - gflicker * (0.25 + 0.25 * sin(uTime * 9.0 + position.x * 3.1) * sin(uTime * 5.3 + position.z));
          vA = mix(gday, 1.0, uNight) * galpha * f;
          vColor = gcolor;
          gl_PointSize = gsize * uScale / max(0.5, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vA;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d) * 2.0;
          float a = smoothstep(1.0, 0.0, r);
          a = a * a * 0.85 + smoothstep(0.25, 0.0, r) * 0.6;
          gl_FragColor = vec4(vColor * a * vA, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  add(p, color, size = 1.5, day = 0, flicker = 0) {
    if (this.n >= this.max) return -1;
    const i = this.n++;
    const c = new THREE.Color(color);
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.col.set([c.r, c.g, c.b], i * 3);
    this.size[i] = size;
    this.day[i] = day;
    this.flicker[i] = flicker;
    this.geo.setDrawRange(0, this.n);
    for (const a of Object.values(this.geo.attributes)) a.needsUpdate = true;
    return i;
  }

  setAlpha(i, a) {
    if (i < 0) return;
    this.alpha[i] = a;
    this.geo.attributes.galpha.needsUpdate = true;
  }

  setPos(i, p) {
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.geo.attributes.position.needsUpdate = true;
  }

  update(night, time, viewportH) {
    this.material.uniforms.uNight.value = night;
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uScale.value = viewportH * 0.9;
  }
}
