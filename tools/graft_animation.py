"""Copy one animation clip from a Meshy GLB into the game's (smaller) GLB.

Meshy exports come with big uncompressed textures; the models in
assets/models keep their optimized textures, so instead of swapping files we
graft just the new clip's keyframes in, matching bones by name.

    python3 tools/graft_animation.py SRC.glb assets/models/carter.glb _360_Power_Spin_Jump
"""
import json, struct, sys


def read_glb(path):
    f = open(path, 'rb').read()
    jl = struct.unpack('<I', f[12:16])[0]
    j = json.loads(f[20:20 + jl])
    bl = struct.unpack('<I', f[20 + jl:24 + jl])[0]
    return j, bytearray(f[28 + jl:28 + jl + bl])


def write_glb(path, j, bin_):
    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    bin_ += b'\0' * (-len(bin_) % 4)
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(bin_), 0x004E4942)); f.write(bin_)


def main(src_path, dst_path, clip):
    sj, sbin = read_glb(src_path)
    dj, dbin = read_glb(dst_path)
    anim = next(a for a in sj['animations'] if a['name'] == clip)
    if any(a['name'] == clip for a in dj.get('animations', [])):
        print(f'{dst_path} already has {clip}'); return
    dnodes = {n.get('name'): i for i, n in enumerate(dj['nodes'])}
    acc_map = {}

    def copy_acc(i):
        if i in acc_map: return acc_map[i]
        a = dict(sj['accessors'][i]); bv = sj['bufferViews'][a['bufferView']]
        start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        n = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[a['type']] * 4 * a['count']
        if bv.get('byteStride') not in (None, n // a['count']): raise SystemExit('strided data not supported')
        dbin.extend(b'\0' * (-len(dbin) % 4))
        dj['bufferViews'].append({'buffer': 0, 'byteOffset': len(dbin), 'byteLength': n})
        dbin.extend(sbin[start:start + n])
        a['bufferView'] = len(dj['bufferViews']) - 1; a.pop('byteOffset', None)
        dj['accessors'].append(a)
        acc_map[i] = len(dj['accessors']) - 1
        return acc_map[i]

    samplers, channels = [], []
    for c in anim['channels']:
        name = sj['nodes'][c['target']['node']].get('name')
        if name not in dnodes: continue
        s = anim['samplers'][c['sampler']]
        samplers.append({'input': copy_acc(s['input']), 'output': copy_acc(s['output']),
                         'interpolation': s.get('interpolation', 'LINEAR')})
        channels.append({'sampler': len(samplers) - 1, 'target': {'node': dnodes[name], 'path': c['target']['path']}})
    dj.setdefault('animations', []).append({'name': clip, 'samplers': samplers, 'channels': channels})
    dj['buffers'][0]['byteLength'] = len(dbin) + (-len(dbin) % 4)
    write_glb(dst_path, dj, dbin)
    print(f'grafted {clip}: {len(channels)} channels into {dst_path}')


if __name__ == '__main__':
    main(*sys.argv[1:4])
