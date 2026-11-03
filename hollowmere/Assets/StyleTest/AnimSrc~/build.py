# blender -b --python build.py -- [--export PATH] [--preview TAGS|all] [--only CLIPS]
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, hmanim as H, preview as PV, clips as CL

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
opt = {argv[i]: argv[i + 1] for i in range(0, len(argv) - 1, 2)}
H.reset(); cam = PV.setup()
kk = H.load_kk_actions()
arms = {c: PV.load(c, x=i * 30) for i, c in enumerate(['knight', 'ranger', 'mage'])}
rig = H.Rig(arms['knight'])
clips = CL.build(kk, None)
only = opt.get('--only'); only = set(only.split(',')) if only else None
meta = []; hits = {}
from mathutils import Vector
def wverts(arm):
    """Weapon vertices in handslot space (same holds as Unity WeaponDef), subsampled."""
    out = {}
    for o in bpy.data.objects:
        if o.type != 'MESH' or o.parent is not None: continue
        for cn in o.constraints:
            if cn.type == 'CHILD_OF' and cn.target == arm:
                vs = [o.matrix_basis @ v.co for v in o.data.vertices]
                vs.sort(key=lambda v: v.length); step = max(1, len(vs) // 60)
                out.setdefault(cn.subtarget[-1], []).extend(vs[::step] + vs[-8:])
    return out
WV = {c: wverts(a) for c, a in arms.items()}
for c in clips:
    if only and c.name not in only: continue
    c.weapons = WV[CL.CLASS[c.name[3]]]
    act = c.bake(rig)
    print('[HM] floorfix', c.name, 'spine %.0f arm %.0f' % c.floor_fix, flush=True); hits[c.name] = {'frames': c.n, 'hits': c.hits}
    print('[HM] baked', c.name, c.n, c.hits, flush=True)
json.dump(hits, open('/tmp/animwork/hits.json', 'w'), indent=1)
pv = opt.get('--preview')
if pv:
    for c in clips:
        if only and c.name not in only: continue
        cls = CL.CLASS[c.name[3]]
        views = (-80, 20) if cls == 'ranger' else (-60, 25)
        meta.append(PV.strip(arms[cls], c.action, c.name, n=int(opt.get('--n', 8)), views=views, hits=c.hits))
    json.dump(meta, open('/tmp/animwork/meta_b.json', 'w'))
if '--export' in opt:
    for a in arms.values(): pass
    H.export(arms['knight'], opt['--export'])
    print('[HM] exported', opt['--export'])
