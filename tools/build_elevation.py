"""Turn the USGS 3DEP elevation samples into the game's height grid.

tools/lidar_grid_8m.json holds elevations (meters) sampled every 8 m from the
USGS Elevation Point Query Service (1 m LiDAR), on an east/north grid centered
on the Iron Works Rd cul-de-sac (40.146979, -75.543616).

Usage: python3 tools/build_elevation.py   ->  writes data/elevation.json
"""
import json, os
import numpy as np
from scipy.ndimage import gaussian_filter

HERE = os.path.dirname(os.path.abspath(__file__))
METERS_PER_PX = 0.41          # aerial screenshot scale
MAP_SCALE = 0.32              # game units per aerial pixel (see src/config.js)
ORIGIN = (420, 760)           # MAP_ORIGIN in src/config.js
CUL = (665, 522)              # cul-de-sac in aerial pixels = lat/lon anchor
VERTICAL = 0.9                # keep slopes gentle for little legs
STEP = 2.0                    # game units between height samples

d = json.load(open(os.path.join(HERE, 'lidar_grid_8m.json')))
ne, nn, st, e0, n0 = d['ne'], d['nn'], d['step'], d['e0'], d['n0']
Z = np.zeros((nn, ne))
for k, (e, n, v) in enumerate(d['pts']):
    Z[k // ne, k % ne] = v          # row 0 = southernmost
Z = gaussian_filter(Z, 0.7)

def sample(e, n):
    fx = np.clip((e - e0) / st, 0, ne - 1.001)
    fy = np.clip((n - n0) / st, 0, nn - 1.001)
    i, j = np.floor(fx).astype(int), np.floor(fy).astype(int)
    u, v = fx - i, fy - j
    return (Z[j, i] * (1 - u) + Z[j, i + 1] * u) * (1 - v) + (Z[j + 1, i] * (1 - u) + Z[j + 1, i + 1] * u) * v

# terrain extents in game units (match src/terrain.js)
x0, x1 = (-80 - ORIGIN[0]) * MAP_SCALE, (830 - ORIGIN[0]) * MAP_SCALE
z0, z1 = (180 - ORIGIN[1]) * MAP_SCALE, (1420 - ORIGIN[1]) * MAP_SCALE
cols = int(np.ceil((x1 - x0) / STEP)) + 1
rows = int(np.ceil((z1 - z0) / STEP)) + 1
X, Zg = np.meshgrid(x0 + np.arange(cols) * STEP, z0 + np.arange(rows) * STEP)
px = X / MAP_SCALE + ORIGIN[0]
py = Zg / MAP_SCALE + ORIGIN[1]
E = (px - CUL[0]) * METERS_PER_PX
N = -(py - CUL[1]) * METERS_PER_PX
ref = sample(np.array(0.0), np.array(0.0))
H = (sample(E, N) - ref) * VERTICAL
out = {
    'source': 'USGS 3DEP 1m DEM via Elevation Point Query Service, sampled every 8 m',
    'x0': round(x0, 3), 'z0': round(z0, 3), 'step': STEP, 'cols': cols, 'rows': rows,
    'heights': [round(float(h), 2) for h in H.ravel()],
}
os.makedirs(os.path.join(HERE, '..', 'data'), exist_ok=True)
json.dump(out, open(os.path.join(HERE, '..', 'data', 'elevation.json'), 'w'), separators=(',', ':'))
print(f'{cols}x{rows} grid, heights {H.min():.1f} .. {H.max():.1f} m (relative to the cul-de-sac)')
for name, (x, y) in {'home': (226, 462), 'street in front': (226, 526), 'Brinell bottom': (430, 1005), 'Crossover jct': (203, 1335), 'store': (752, 930), 'creek mid': (704, 900)}.items():
    print(f'  {name:16s} {float((sample(np.array((x-CUL[0])*METERS_PER_PX), np.array(-(y-CUL[1])*METERS_PER_PX)) - ref) * VERTICAL):6.1f}')
