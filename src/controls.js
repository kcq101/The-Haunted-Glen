// Touch joystick (left side), camera drag (right side) and keyboard support.
export class Controls {
  constructor(layer) {
    this.layer = layer;
    this.move = { x: 0, y: 0 }; // x right, y forward, length 0..1
    this.look = { dx: 0, dy: 0 };
    this.keys = new Set();
    this.joyId = null;
    this.lookId = null;
    this.enabled = true;
    this.onAction = null;
    this.onJump = null;

    this.base = document.getElementById('joy-base');
    this.knob = document.getElementById('joy-knob');
    this.radius = 60;

    layer.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.moveEv(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') { this.onJump?.(); e.preventDefault(); }
      if (e.code === 'Enter' || e.code === 'KeyF') this.onAction?.();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  down(e) {
    if (!this.enabled) return;
    const leftSide = e.clientX < window.innerWidth * 0.5;
    if (leftSide && this.joyId === null) {
      this.joyId = e.pointerId;
      this.origin = { x: e.clientX, y: e.clientY };
      this.base.style.display = 'block';
      this.base.style.left = `${e.clientX}px`;
      this.base.style.top = `${e.clientY}px`;
      this.knob.style.transform = 'translate(-50%, -50%)';
    } else if (this.lookId === null) {
      this.lookId = e.pointerId;
      this.lastLook = { x: e.clientX, y: e.clientY };
    }
    try { this.layer.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    e.preventDefault();
  }

  moveEv(e) {
    if (e.pointerId === this.joyId) {
      let dx = e.clientX - this.origin.x, dy = e.clientY - this.origin.y;
      const L = Math.hypot(dx, dy);
      if (L > this.radius) { dx *= this.radius / L; dy *= this.radius / L; }
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const m = Math.min(1, L / this.radius);
      const dead = 0.12;
      const scale = m < dead ? 0 : (m - dead) / (1 - dead);
      const len = Math.hypot(dx, dy) || 1;
      this.move.x = (dx / len) * scale;
      this.move.y = (-dy / len) * scale;
      e.preventDefault();
    } else if (e.pointerId === this.lookId) {
      this.look.dx += e.clientX - this.lastLook.x;
      this.look.dy += e.clientY - this.lastLook.y;
      this.lastLook = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }

  up(e) {
    if (e.pointerId === this.joyId) {
      this.joyId = null;
      this.move.x = this.move.y = 0;
      this.base.style.display = 'none';
    }
    if (e.pointerId === this.lookId) this.lookId = null;
  }

  reset() {
    this.joyId = this.lookId = null;
    this.move.x = this.move.y = 0;
    this.look.dx = this.look.dy = 0;
    this.base.style.display = 'none';
    this.keys.clear();
  }

  // Combined movement input (touch + keyboard), length <= 1
  get input() {
    let x = this.move.x, y = this.move.y;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    const L = Math.hypot(x, y);
    if (L > 1) { x /= L; y /= L; }
    return { x, y, mag: Math.min(1, L) };
  }

  consumeLook() {
    let dx = this.look.dx, dy = this.look.dy;
    if (this.keys.has('KeyQ')) dx -= 6;
    if (this.keys.has('KeyE')) dx += 6;
    this.look.dx = this.look.dy = 0;
    return { dx, dy };
  }
}
