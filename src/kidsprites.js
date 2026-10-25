// ---------------------------------------------------------------------------
// Pixel-art sprites for Carter and Jack in the 2D haunted house.
// Built by tools/build_sprites.py from the GPT sheets: <kid>.png is the atlas
// (rows: down, up, right, left), <kid>_mask.png marks shirt (red), pants
// (green) and shoes (blue) so outfits can recolor them, and kids.json has each
// frame's head, eye, torso and hand spots (relative to the feet) for costumes.
// ---------------------------------------------------------------------------

const S = { meta: null, atlas: {}, mask: {}, dressed: new Map(), ready: false };
const DIRS = ['down', 'up', 'right', 'left'];

function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

export const spritesReady = (async () => {
  try {
    const r = await fetch(new URL('../assets/sprites/kids.json', import.meta.url));
    if (!r.ok) return false;
    S.meta = await r.json();
    await Promise.all(Object.keys(S.meta).map(async (k) => {
      [S.atlas[k], S.mask[k]] = await Promise.all([loadImg(new URL(`../assets/sprites/${k}.png`, import.meta.url)), loadImg(new URL(`../assets/sprites/${k}_mask.png`, import.meta.url))]);
    }));
    S.ready = true;
  } catch (e) {
    console.warn('Kid sprites unavailable, using drawn kids', e);
  }
  return S.ready;
})();

export const hasSprite = (id) => S.ready && !!S.meta[id];

const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// Atlas with the outfit's colors painted onto shirt / pants / shoes (cached).
function dressed(id, L) {
  if (!L.outfit) return S.atlas[id];
  const key = `${id}|${L.outfit}`;
  if (S.dressed.has(key)) return S.dressed.get(key);
  const img = S.atlas[id], w = img.width, h = img.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.drawImage(S.mask[id], 0, 0);
  const m = g.getImageData(0, 0, w, h).data;
  g.clearRect(0, 0, w, h);
  g.drawImage(img, 0, 0);
  const id_ = g.getImageData(0, 0, w, h), d = id_.data;
  const targets = [hex(L.shirt), hex(L.pants), hex(L.shoes)];
  // average brightness of each part, so shading survives the recolor
  const sum = [0, 0, 0], cnt = [0, 0, 0];
  const cls = (i) => (m[i + 3] < 128 ? -1 : m[i] > 128 ? 0 : m[i + 1] > 128 ? 1 : m[i + 2] > 128 ? 2 : -1);
  for (let i = 0; i < d.length; i += 4) { const k = cls(i); if (k >= 0) { sum[k] += lum(d[i], d[i + 1], d[i + 2]); cnt[k]++; } }
  for (let i = 0; i < d.length; i += 4) {
    const k = cls(i);
    if (k < 0) continue;
    const f = Math.min(1.3, Math.max(0.55, 0.7 + 0.3 * (lum(d[i], d[i + 1], d[i + 2]) / (sum[k] / cnt[k] || 1))));
    const t = targets[k];
    d[i] = Math.min(255, t[0] * f); d[i + 1] = Math.min(255, t[1] * f); d[i + 2] = Math.min(255, t[2] * f);
  }
  g.putImageData(id_, 0, 0);
  S.dressed.set(key, c);
  return c;
}

// Draw the kid with feet at (cx, fy). Returns false if no sprite (use fallback).
export function drawSpriteKid(g, cx, fy, dir, moving, anim, L, D) {
  const id = L.id;
  if (!hasSprite(id)) return false;
  const M = S.meta[id];
  const list = M.anims[dir];
  const fi = moving ? Math.floor(anim * 1.25) % (M.cycle?.[dir] || list.length) : M.idle[dir];
  const F = list[fi];
  const [cw, ch] = M.cell;
  const ox = Math.round(cx) - M.foot[0], oy = Math.round(fy) - M.foot[1];
  const X = Math.round(cx), Y = Math.round(fy);
  const [tx0, ty0, tx1, ty1] = [X + F.torso[0], Y + F.torso[1], X + F.torso[2], Y + F.torso[3]];
  const hx0 = X + F.head[0], hx1 = X + F.head[1], hcx = (hx0 + hx1) / 2;
  const top = Y + F.top, eye = Y + F.eye;

  // shadow
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, fy, (cw - 8) / 2, 2.2, 0, 0, 7); g.fill();

  if (L.outfit === 'ghost_sheet') {
    // the old ghost sheet, stretched to this boy's height
    const s = (Y - top) / 25;
    g.save(); g.translate(cx, fy); g.scale(s, s); g.translate(-cx, -fy);
    D.ghostSheet(g, cx, fy, dir);
    g.restore();
    return true;
  }
  const cape = L.outfit === 'vampire_outfit' || L.outfit === 'hero_outfit';
  if (cape && dir !== 'down') D.rect(g, tx0 - 1, ty0 + 1, tx1 - tx0 + 2, ty1 - ty0 + 5, L.outfit === 'hero_outfit' ? '#e63b3b' : '#121014');

  const row = DIRS.indexOf(dir);
  g.drawImage(dressed(id, L), F.x, row * ch, cw, ch, ox, oy, cw, ch);

  // outfit details on the shirt
  const tw = tx1 - tx0, th = ty1 - ty0, front = dir !== 'up';
  const mid = Math.round((tx0 + tx1) / 2);
  switch (L.outfit) {
    case 'pirate_outfit': D.rect(g, tx0, ty0 + Math.round(th * 0.7), tw, 1, '#b3222a'); break;
    case 'fire_outfit': D.rect(g, tx0, ty0 + Math.round(th * 0.6), tw, 1, '#e8ff3c'); break;
    case 'skeleton_outfit':
      D.rect(g, mid, ty0 + 1, 1, th - 2, '#f2f0e6');
      for (let i = 0; i < 3; i++) D.rect(g, mid - 2, ty0 + 2 + i * 2, 5, 1, '#f2f0e6');
      break;
    case 'mummy_outfit': for (let y = ty0 + 1; y < ty1; y += 2) D.rect(g, tx0, y, tw, 1, '#cfc4a8'); break;
    case 'hero_outfit': if (front) { D.rect(g, mid - 1, ty0 + 2, 3, 3, '#e63b3b'); D.rect(g, tx0, ty1 - 1, tw, 1, '#ffd23f'); } break;
    case 'vampire_outfit': if (front) { D.rect(g, mid - 1, ty0, 3, Math.min(4, th), '#f2efe6'); D.rect(g, mid, ty0, 1, 1, '#9b1c2a'); } break;
    case 'astro_outfit': if (front) { D.rect(g, tx0 + 1, ty0 + 2, 2, 2, '#3a6fd8'); D.rect(g, tx1 - 3, ty0 + 2, 2, 2, '#e8732c'); } break;
    default:
  }

  // props
  if (L.prop === 'parrot') D.prop(g, tx0 + 12, ty0 + 9, 'parrot');
  else if (L.prop === 'pet_bat') D.prop(g, Math.round(hcx) + 8, top + 18, 'pet_bat');
  else if (L.prop) D.prop(g, X + F.hand[0] - 1, Y + F.hand[1] - 1, L.prop);

  // head pieces: the drawn costumes expect a 15 px head at x, with eyes at hy + 4
  const x = Math.round(hcx - 7.5);
  const ex = dir === 'left' ? -2 : dir === 'right' ? 2 : 0;
  if (L.hat === 'pumpkin_head') {
    const w = hx1 - hx0, h = eye - top + 5;
    D.rect(g, hx0, top + 1, w, h, '#ef7d1f'); D.rect(g, hx0 - 1, top + 3, w + 2, h - 4, '#ef7d1f'); D.rect(g, hx0 + 2, top, w - 4, 1, '#ef7d1f');
    D.rect(g, Math.round(hcx) - 1, top - 3, 2, 3, '#56702c');
    if (front) {
      D.rect(g, Math.round(hcx) - 5 + ex, eye - 1, 3, 2, '#ffd04a'); D.rect(g, Math.round(hcx) + 2 + ex, eye - 1, 3, 2, '#ffd04a');
      D.rect(g, Math.round(hcx) - 4 + ex, eye + 3, 8, 1, '#ffd04a');
    }
    return true;
  }
  if (front && L.face) D.face(g, x, eye - 4, ex, L.face);
  if (L.hat === 'space_helmet') {
    const r = (hx1 - hx0) / 2 + 2;
    g.strokeStyle = 'rgba(200,230,255,0.9)'; g.lineWidth = 1; g.beginPath(); g.arc(hcx, (top + eye) / 2 + 2, r, 0, 7); g.stroke();
    g.fillStyle = 'rgba(200,230,255,0.18)'; g.fill();
  } else if (L.hat) D.hat(g, x, top + 4, dir, L.hat); // sink into the spiky hair a little
  return true;
}
