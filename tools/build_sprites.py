"""Turn the GPT sprite sheets in tools/sprite_src into clean game sprites.

    python3 tools/build_sprites.py

For each boy it:
  1. cuts the background away (flat gray or soft gradient),
  2. finds the frames for walking down / up / right (left = mirrored right),
  3. scales them down onto a true pixel grid (Carter 32 px tall, Jack 27 px),
  4. shares one small palette per boy so colors don't shimmer frame to frame,
  5. writes assets/sprites/<kid>.png (atlas), <kid>_mask.png (shirt/pants/shoes
     map used to recolor outfits) and kids.json (frame boxes + head, eye,
     torso and hand spots so hats, masks and props can be drawn on top).
"""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'tools', 'sprite_src')
OUT = os.path.join(ROOT, 'assets', 'sprites')

KIDS = {
    'carter': {
        'height': 32, 'colors': 26,
        'sheet': ('carter_sheet.png', 'gray'), 'updown': ('carter_updown.png', 'gray'),
        # walk-right row on the big sheet: y band and x range (left group)
        'right': {'y': (440, 615), 'x': (0, 770), 'count': 7},
        # his walk row never brings the feet together: use the side idle row
        'side_idle': {'y': (240, 425), 'x': (790, 1510), 'count': 6},
        'idle_pick': 2,
    },
    'jack': {
        'height': 27, 'colors': 26,
        'sheet': ('jack_sheet.png', 'gradient'), 'updown': ('jack_updown.png', 'gray'),
        'right': {'y': (440, 615), 'x': (0, 775), 'count': 9},
        'idle_pick': 2,
        # GPT gave Jack Carter's hair on the up/down sheet: warm it toward his gold
        'hair_fix': True,
    },
}


# --- background removal ---------------------------------------------------------
def fg_gray(a):
    """Flat gray background (frame-box lines are gray too)."""
    f = a.astype(np.int32)
    mx, mn = f.max(2), f.min(2)
    lum = f.mean(2)
    # sample the background from the corners
    corners = np.concatenate([f[:8, :8].reshape(-1, 3), f[-8:, -8:].reshape(-1, 3)])
    bgl = corners.mean()
    grayish = (mx - mn < 14) & (np.abs(lum - bgl) < 30)
    lab, n = ndi.label(grayish)
    sizes = ndi.sum(np.ones_like(lab), lab, range(n + 1))
    bg = np.isin(lab, np.nonzero(sizes > 3000)[0][1:] if n else [])
    bg |= np.isin(lab, [l for l in np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])) if l])
    fg = ~bg
    fg = ndi.binary_opening(fg, iterations=2)  # thin box lines
    return ndi.binary_fill_holes(fg)


def fg_gradient(a):
    """Soft gradient / glow background: grow from the border through smooth areas."""
    h, w, _ = a.shape
    f = a.astype(np.int32)
    dx = np.abs(np.diff(f, axis=1)).sum(2)
    dy = np.abs(np.diff(f, axis=0)).sum(2)
    edge = np.zeros((h, w), bool)
    e = 18
    edge[:, :-1] |= dx > e; edge[:, 1:] |= dx > e; edge[:-1] |= dy > e; edge[1:] |= dy > e
    lab, n = ndi.label(~edge)
    sizes = ndi.sum(np.ones_like(lab), lab, range(n + 1))
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, [i for i in range(1, n + 1) if i in border or sizes[i] > 20000])
    fg = ndi.binary_opening(~bg, iterations=1)
    return ndi.binary_fill_holes(fg)


def load(name, kind):
    a = np.array(Image.open(os.path.join(SRC, name)).convert('RGB'))
    fg = fg_gray(a) if kind == 'gray' else fg_gradient(a)
    return a, fg


# --- frame finding --------------------------------------------------------------
def frames_in(fg, y0, y1, x0, x1, count):
    band = fg[y0:y1, x0:x1]
    lab, n = ndi.label(ndi.binary_dilation(band, iterations=2))
    objs = [s for s in ndi.find_objects(lab) if (s[0].stop - s[0].start) > 40]
    boxes = sorted([(s[1].start, s[1].stop) for s in objs])
    # split anything that swallowed neighbours at the emptiest columns
    while len(boxes) < count:
        widths = [b[1] - b[0] for b in boxes]
        i = int(np.argmax(widths))
        a_, b_ = boxes[i]
        proj = band[:, a_:b_].sum(0).astype(float)
        k = max(1, round((b_ - a_) / np.median(widths)))
        cuts = []
        for j in range(1, k):
            c = int((b_ - a_) * j / k)
            lo, hi = max(1, c - 18), min(len(proj) - 1, c + 18)
            cuts.append(lo + int(np.argmin(proj[lo:hi])))
        pts = [a_] + [a_ + c for c in cuts] + [b_]
        boxes[i:i + 1] = [(pts[j], pts[j + 1]) for j in range(len(pts) - 1)]
    boxes = boxes[:count]
    out = []
    for xa, xb in boxes:
        sub = band[:, xa:xb]
        rows = np.nonzero(sub.any(1))[0]
        cols = np.nonzero(sub.any(0))[0]
        out.append((y0 + rows[0], x0 + xa + cols[0], y0 + rows[-1] + 1, x0 + xa + cols[-1] + 1))
    return out


def updown_frames(fg):
    h = fg.shape[0]
    mid = h // 2
    return frames_in(fg, 0, mid, 0, fg.shape[1], 6), frames_in(fg, mid, h, 0, fg.shape[1], 6)


# --- hair fix ---------------------------------------------------------------------
def warm_hair(rgb, alpha, up):
    """Shift Jack's hair toward his golden blond (only near the top of the head)."""
    f = rgb.astype(float)
    h = f.shape[0]
    r, g, b = f[..., 0] + 1, f[..., 1], f[..., 2]
    zone = np.zeros(f.shape[:2], bool)
    zone[: int(h * (0.42 if up else 0.27))] = True
    hair = zone & alpha & (b / r < 0.45) & (g / r < 0.72) & (f.mean(2) > 55)
    out = f.copy()
    out[hair, 1] = np.clip(f[hair, 1] * 1.09 + 6, 0, 255)
    out[hair, 0] = np.clip(f[hair, 0] * 1.04 + 4, 0, 255)
    out[hair, 2] = np.clip(f[hair, 2] * 0.95, 0, 255)
    return out.astype(np.uint8)


# --- downscale ------------------------------------------------------------------
def shrink(rgb, alpha, scale):
    h, w = alpha.shape
    nh, nw = max(1, round(h * scale)), max(1, round(w * scale))
    im = Image.fromarray(np.dstack([rgb, (alpha * 255).astype(np.uint8)]), 'RGBA')
    # premultiplied box downscale keeps edges from picking up background color
    pre = np.dstack([rgb * alpha[..., None], alpha * 255]).astype(np.float32)
    chans = [np.array(Image.fromarray(pre[..., c]).resize((nw, nh), Image.BOX)) for c in range(4)]
    a = chans[3] / 255
    col = np.dstack(chans[:3]) / np.maximum(a[..., None], 1e-3)
    return np.clip(col, 0, 255), a > 0.5


def build(kid, cfg):
    sheet, sfg = load(*cfg['sheet'])
    ud, ufg = load(*cfg['updown'])
    downs, ups = updown_frames(ufg)
    rr = cfg['right']
    rights = frames_in(sfg, rr['y'][0], rr['y'][1], rr['x'][0], rr['x'][1], rr['count'])

    def crops(img, fg, boxes, fix=None):
        out = []
        for (y0, x0, y1, x1) in boxes:
            rgb, al = img[y0:y1, x0:x1], fg[y0:y1, x0:x1]
            if fix is not None:
                rgb = warm_hair(rgb, al, fix)
            out.append((rgb, al))
        return out

    fixd = cfg.get('hair_fix')
    sets = {
        'down': crops(ud, ufg, downs, False if fixd else None),
        'up': crops(ud, ufg, ups, True if fixd else None),
        'right': crops(sheet, sfg, rights),
    }
    if 'side_idle' in cfg:
        si = cfg['side_idle']
        sets['side_idle'] = crops(sheet, sfg, frames_in(sfg, si['y'][0], si['y'][1], si['x'][0], si['x'][1], si['count'])[:1])
    # each source set gets its own scale so a standing boy is `height` px tall
    small = {}
    for name, fr in sets.items():
        med = np.median([a.shape[0] for _, a in fr])
        if name == 'side_idle':
            med = np.median([a.shape[0] for _, a in sets['right']]) * 1.0
            # standing is a touch taller than mid-stride
            med = max(med, fr[0][1].shape[0] * 0.97)
        s = cfg['height'] / med
        small[name] = [shrink(rgb, al, s) for rgb, al in fr]

    # one shared palette per boy
    allpx = np.concatenate([c[a] for fr in small.values() for c, a in fr]).astype(np.uint8)
    pal_img = Image.fromarray(allpx.reshape(1, -1, 3))
    pal = pal_img.quantize(colors=cfg['colors'], method=Image.Quantize.MEDIANCUT, kmeans=4)
    palette = np.array(pal.getpalette()[: cfg['colors'] * 3]).reshape(-1, 3)

    def to_pal(c):
        d = ((c[..., None, :] - palette[None, None]) ** 2).sum(-1)
        return palette[d.argmin(-1)]

    frames = {}
    for name, fr in small.items():
        frames[name] = [(to_pal(c).astype(np.uint8), a) for c, a in fr]
        # stray single pixels
        for i, (c, a) in enumerate(frames[name]):
            lab, n = ndi.label(a)
            if n > 1:
                sizes = ndi.sum(a, lab, range(1, n + 1))
                # drop strays and bits of the neighbouring frame
                a = np.isin(lab, 1 + np.nonzero(sizes >= max(4, sizes.max() * 0.15))[0])
                rows, cols = np.nonzero(a.any(1))[0], np.nonzero(a.any(0))[0]
                c, a = c[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1], a[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]
            frames[name][i] = (c, a)

    cycle = {d: len(frames[d]) for d in ('down', 'up', 'right')}
    pick = cfg['idle_pick']
    if 'side_idle' in frames:
        frames['right'].append(frames.pop('side_idle')[0])
    frames['left'] = [(c[:, ::-1], a[:, ::-1]) for c, a in frames['right']]
    cycle['left'] = cycle['right']
    # side idle: the walk frame with the narrowest stance
    def spread(a):
        xs = np.nonzero(a[-3:].any(0))[0]
        return xs[-1] - xs[0]
    widths = [spread(a) for _, a in frames['right']]
    side_idle = int(np.argmin(widths))
    if len(frames['right']) > cycle['right']:
        side_idle = cycle['right']
    return frames, palette, {'down': pick, 'up': pick, 'right': side_idle, 'left': side_idle}, cycle


# --- classes for outfit recolor + attachment spots -------------------------------
SHIRT, PANTS, SHOES = 1, 2, 3


def classify(kid, c, a):
    h, w = a.shape
    f = c.astype(int)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    lum = f.mean(2)
    sat = f.max(2) - f.min(2)
    yy = np.repeat(np.arange(h)[:, None], w, 1) / h
    cls = np.zeros((h, w), np.uint8)
    skin = (r > 170) & (r - b > 70) & (g > 0.5 * r) & (g < 0.88 * r)
    if kid == 'carter':
        shirt = (r > 110) & (r - g > 55) & (r - b > 35) & ~skin & (yy > 0.35)
        pants = (b > r + 20) & (b > 60) & (yy > 0.5)
        shoes = (sat < 30) & (lum > 85) & (yy > 0.82)
    else:
        # white/blue stripes: anything bluish-or-neutral and not dark in the torso band
        shirt = (b >= r - 8) & (lum > 90) & (yy > 0.38) & (yy < 0.78)
        pants = (r > 80) & (g > 0.72 * r) & (g < 0.85 * r) & (b > 0.5 * r) & (b < 0.72 * r) & (yy > 0.55)
        shoes = (yy > 0.86) & (((r > 150) & (g < 90)) | ((sat < 40) & (lum > 140)))
    # pants hang under the shirt: keep hands at the sides out of them
    sx = np.nonzero(shirt.any(0))[0]
    if len(sx):
        xx = np.repeat(np.arange(w)[None], h, 0)
        pants &= (yy > 0.8) | ((xx > sx[0] + 1) & (xx < sx[-1] - 1))
    cls[shirt] = SHIRT
    cls[pants & ~shirt] = PANTS
    cls[shoes & ~shirt & ~pants] = SHOES
    cls[~a] = 0
    return cls


def spots(c, a, cls, direction):
    h, w = a.shape
    rows = np.nonzero(a.any(1))[0]
    top = int(rows[0])
    headzone = a[top: top + int(h * 0.45)]
    xs = np.nonzero(headzone.any(0))[0]
    hx0, hx1 = int(xs[0]), int(xs[-1]) + 1
    # eyes: near-black pixels with opaque neighbours, in the face band
    f = c.astype(int)
    dark = (f.mean(2) < 60) & a
    inner = ndi.binary_erosion(a, iterations=1)
    band = np.zeros_like(a)
    band[top + int(h * 0.18): top + int(h * 0.42)] = True
    eyes = np.nonzero(dark & inner & band)
    eye_y = int(np.median(eyes[0])) if direction != 'up' and len(eyes[0]) >= 2 else top + int(h * 0.3)
    sh = np.nonzero(cls == SHIRT)
    if len(sh[0]):
        torso = [int(sh[1].min()), int(sh[0].min()), int(sh[1].max()) + 1, int(sh[0].max()) + 1]
    else:
        torso = [hx0, top + int(h * 0.45), hx1, top + int(h * 0.7)]
    # hand: lowest skin-ish pixel on the viewer's right below the torso top
    skin = (f[..., 0] > 170) & (f[..., 0] - f[..., 2] > 70) & a
    cand = np.nonzero(skin[torso[1]:, :])
    if len(cand[0]):
        if direction == 'left':
            i = np.argmin(cand[1] - cand[0] * 0.3)
        else:
            i = np.argmax(cand[1] + cand[0] * 0.3)
        hand = [int(cand[1][i]), int(cand[0][i]) + torso[1]]
    else:
        hand = [torso[2], torso[3]]
    return {'top': top, 'head': [hx0, hx1], 'eye': eye_y, 'torso': torso, 'hand': hand}


def pack(kid, frames, idle):
    order = ['down', 'up', 'right', 'left']
    allf = [fr for d in order for fr in frames[d]]
    # every frame aligned on its head center (steadier than the full bounding box)
    def head_cx(a):
        rows = np.nonzero(a.any(1))[0]
        hz = a[rows[0]: rows[0] + int(a.shape[0] * 0.4)]
        xs = np.nonzero(hz.any(0))[0]
        return (xs[0] + xs[-1] + 1) / 2
    left = max(head_cx(a) for _, a in allf)
    right = max(a.shape[1] - head_cx(a) for _, a in allf)
    cw = int(np.ceil(left + right)) + 2
    ch = max(a.shape[0] for _, a in allf) + 2
    ncol = max(len(frames[d]) for d in order)
    atlas = np.zeros((ch * len(order), cw * ncol, 4), np.uint8)
    mask = np.zeros_like(atlas)
    meta = {'cell': [cw, ch], 'foot': [cw // 2, ch - 1], 'anims': {}, 'idle': idle}
    colors = {SHIRT: (255, 0, 0), PANTS: (0, 255, 0), SHOES: (0, 0, 255)}
    for ri, d in enumerate(order):
        meta['anims'][d] = []
        for fi, (c, a) in enumerate(frames[d]):
            h, w = a.shape
            ox = int(round(cw / 2 - head_cx(a)))
            oy = ch - 1 - h
            X, Y = fi * cw + ox, ri * ch + oy
            cls = classify(kid, c, a)
            atlas[Y:Y + h, X:X + w][a] = np.dstack([c, np.full(a.shape, 255, np.uint8)])[a]
            for k, col in colors.items():
                mask[Y:Y + h, X:X + w][cls == k] = (*col, 255)
            sp = spots(c, a, cls, d)
            # spot coordinates relative to the cell's foot point
            fx, fy = fi * cw + cw // 2, ri * ch + ch - 1
            rel = lambda x, y: [int(X + x - fx), int(Y + y - fy)]
            meta['anims'][d].append({
                'x': fi * cw, 'y': ri * ch,
                'top': rel(0, sp['top'])[1],
                'head': [rel(sp['head'][0], 0)[0], rel(sp['head'][1], 0)[0]],
                'eye': rel(0, sp['eye'])[1],
                'torso': rel(sp['torso'][0], sp['torso'][1]) + rel(sp['torso'][2], sp['torso'][3]),
                'hand': rel(*sp['hand']),
            })
    Image.fromarray(atlas, 'RGBA').save(os.path.join(OUT, f'{kid}.png'), optimize=True)
    Image.fromarray(mask, 'RGBA').save(os.path.join(OUT, f'{kid}_mask.png'), optimize=True)
    return meta


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for kid, cfg in KIDS.items():
        frames, palette, idle, cycle = build(kid, cfg)
        meta[kid] = pack(kid, frames, idle)
        meta[kid]['cycle'] = cycle
        print(kid, 'cell', meta[kid]['cell'], {d: len(v) for d, v in meta[kid]['anims'].items()}, 'idle', idle)
    with open(os.path.join(OUT, 'kids.json'), 'w') as f:
        json.dump(meta, f, separators=(',', ':'))


if __name__ == '__main__':
    main()
