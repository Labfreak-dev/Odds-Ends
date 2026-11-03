# Hollowmere attack-animation toolkit (Blender 4.2, run headless).
# Sources (all CC0): KayKit Character Animations 1.1 (Rig_Medium FBX already in the repo), Quaternius Universal Animation
# Library 1 + 2 [Standard] (glb, retargeted here onto Rig_Medium). Output: one legacy-clip FBX with HM_* takes.
import bpy, math, os, sys
from mathutils import Vector, Quaternion, Matrix

ST = '/tmp/hmmain/hollowmere/Assets/StyleTest/Resources/ST'
UAL1 = '/tmp/animdl/ual1/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb'
UAL2 = '/tmp/animdl/ual2/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb'
FPS = 30
UP, FWD, LEFT = Vector((0, 1, 0)), Vector((0, 0, 1)), Vector((1, 0, 0))   # KayKit armature space
HIP_SCALE = 0.6  # hip drops: rigid KayKit capes are skinned to the hips, deeper drops push the hem through the floor
KNEE_MIN = 0.13  # knee joint height that keeps the KayKit knee mesh above the floor


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS


def _imp(fn, p):
    before = set(bpy.data.objects); fn(filepath=p); return [o for o in bpy.data.objects if o not in before]


def imp_fbx(p): return _imp(bpy.ops.import_scene.fbx, p)
def imp_glb(p): return _imp(bpy.ops.import_scene.gltf, p)
def arm_of(objs): return [o for o in objs if o.type == 'ARMATURE'][0]


def short(name):
    n = name.split('|')[-1]
    for suf in ('_Rig_Medium', '_Armature'):
        if suf in n: n = n[:n.index(suf)]
    return n


def kill(objs):
    for o in objs: bpy.data.objects.remove(o, do_unlink=True)


def load_kk_actions():
    """KayKit actions from the repo FBX (same bone names as every KayKit hero)."""
    acts = {}
    for f in ['CombatMelee', 'CombatRanged', 'General', 'MovementAdvanced', 'MovementBasic', 'Special']:
        before = set(bpy.data.actions)
        objs = imp_fbx(f'{ST}/Anim/Rig_Medium_{f}.fbx')
        for a in bpy.data.actions:
            if a not in before:
                a.use_fake_user = True; acts[short(a.name)] = a
                for fc in [c for c in a.fcurves if not c.data_path.startswith('pose.bones')]: a.fcurves.remove(fc)
        kill(objs)
    return acts


# ------------------------------------------------------------------------------------------------ rig maths
class Rig:
    def __init__(self, arm):
        self.arm = arm; bs = arm.data.bones
        depth = lambda b: 0 if b.parent is None else 1 + depth(b.parent)
        self.order = [b.name for b in sorted(bs, key=depth)]
        self.parent = {b.name: (b.parent.name if b.parent else None) for b in bs}
        self.rest = {b.name: b.matrix_local.copy() for b in bs}
        self.rel = {n: (self.rest[p].inverted() @ self.rest[n] if p else self.rest[n]) for n, p in self.parent.items()}

    def fk(self, pose):
        M = {}
        for n in self.order:
            loc, q = pose.get(n, (Vector(), Quaternion()))
            basis = Matrix.Translation(loc) @ q.to_matrix().to_4x4()
            p = self.parent[n]
            M[n] = (M[p] if p else Matrix.Identity(4)) @ self.rel[n] @ basis
        return M

    def set_arm(self, pose, M, n, rot3=None, pos=None):
        """Set bone n's basis so its armature-space rotation (and optionally position) match. M = fk of pose (parents valid)."""
        p = self.parent[n]; base = (M[p] if p else Matrix.Identity(4)) @ self.rel[n]
        cur = M[n]
        r = rot3 if rot3 is not None else cur.to_3x3().normalized()
        t = pos if pos is not None else cur.translation
        want = Matrix.Translation(t) @ r.to_4x4()
        b = base.inverted() @ want
        loc, q, _ = b.decompose()
        if pos is None: loc = pose.get(n, (Vector(), Quaternion()))[0].copy()
        pose[n] = (loc, q.normalized())

    def rotate(self, pose, n, axis, deg):
        """Rotate bone n (and so its children) by deg about an armature-space axis through its head."""
        M = self.fk(pose)
        R = Matrix.Rotation(math.radians(deg), 3, axis)
        self.set_arm(pose, M, n, R @ M[n].to_3x3().normalized())

    def ik2(self, pose, up, lo, end, target, pole, w=1.0):
        """Analytic two-bone IK in armature space; blends with the FK pose by w."""
        if w <= 0.001: return
        orig = {k: pose[k] for k in (up, lo) if k in pose}
        M = self.fk(pose); S = M[up].translation; E = M[lo].translation; W = M[end].translation
        a = (E - S).length; b = (W - E).length; st = target - S; d = min(max(st.length, abs(a - b) + 1e-4), a + b - 1e-4)
        dr = st.normalized(); x = (a * a - b * b + d * d) / (2 * d); h = math.sqrt(max(a * a - x * x, 0))
        pv = (pole - S); pv = pv - dr * pv.dot(dr)
        if pv.length < 1e-5: pv = UP.cross(dr)
        pv.normalize(); En = S + dr * x + pv * h
        q1 = (E - S).rotation_difference(En - S)
        self.set_arm(pose, M, up, q1.to_matrix() @ M[up].to_3x3().normalized())
        M = self.fk(pose); E2 = M[lo].translation; W2 = M[end].translation
        q2 = (W2 - E2).rotation_difference((S + dr * d) - E2)
        self.set_arm(pose, M, lo, q2.to_matrix() @ M[lo].to_3x3().normalized())
        if w < 0.999:
            for k, v in orig.items():
                l1, q1o = v; l2, q2n = pose[k]; pose[k] = (l1.lerp(l2, w), q1o.slerp(q2n, w))


def fc_index(action):
    idx = {}
    for fc in action.fcurves:
        if not fc.data_path.startswith('pose.bones["'): continue
        b = fc.data_path.split('"')[1]; ch = fc.data_path.rsplit('.', 1)[1]
        d = idx.setdefault(b, {})
        if ch == 'location': d.setdefault('loc', [None] * 3)[fc.array_index] = fc
        elif ch == 'rotation_quaternion': d.setdefault('rot', [None] * 4)[fc.array_index] = fc
    return idx


_idx = {}
def sample(action, f):
    """Basis pose {bone: (loc, quat)} at (fractional) frame f, measured from the action's first frame."""
    ix = _idx.get(action.name) or _idx.setdefault(action.name, fc_index(action))
    f0, f1 = action.frame_range; t = min(max(f0 + f, f0), f1)
    pose = {}
    for b, d in ix.items():
        loc = Vector([c.evaluate(t) if c else 0 for c in d.get('loc', [None] * 3)])
        r = d.get('rot'); q = Quaternion([r[i].evaluate(t) if r and r[i] else (1 if i == 0 else 0) for i in range(4)]).normalized()
        pose[b] = (loc, q)
    return pose


def length(action): return action.frame_range[1] - action.frame_range[0]


def blend(p1, p2, w):
    out = {}
    for k in set(p1) | set(p2):
        a = p1.get(k, (Vector(), Quaternion())); b = p2.get(k, (Vector(), Quaternion()))
        qb = b[1] if a[1].dot(b[1]) >= 0 else -b[1]
        out[k] = (a[0].lerp(b[0], w), a[1].slerp(qb, w))
    return out


# ------------------------------------------------------------------------------------------------ retarget
UAL_MAP = {'hips': 'pelvis', 'spine': 'spine_02', 'chest': 'spine_03', 'head': 'Head',
           'upperarm.l': 'upperarm_l', 'lowerarm.l': 'lowerarm_l', 'wrist.l': 'hand_l',
           'upperarm.r': 'upperarm_r', 'lowerarm.r': 'lowerarm_r', 'wrist.r': 'hand_r',
           'upperleg.l': 'thigh_l', 'lowerleg.l': 'calf_l', 'foot.l': 'foot_l', 'toes.l': 'ball_l',
           'upperleg.r': 'thigh_r', 'lowerleg.r': 'calf_r', 'foot.r': 'foot_r', 'toes.r': 'ball_r'}


def retarget(rig, src, action, name):
    """World-space rotation-delta retarget (both rigs rest in a T-pose facing -Y): Wt = Ws(t) Ws_rest^-1 Wt_rest.
    Hips translation is scaled by the hip-height ratio. Bakes a new action on the KayKit bone names."""
    sc = bpy.context.scene; src.animation_data_create(); src.animation_data.action = action
    tw = rig.arm.matrix_world; tw3 = tw.to_3x3().normalized(); sw = src.matrix_world
    s_rest = {sb: (sw @ src.data.bones[sb].matrix_local) for sb in UAL_MAP.values()}
    t_rest = {tb: (tw @ rig.rest[tb]) for tb in UAL_MAP}
    k = t_rest['hips'].translation.z / s_rest['pelvis'].translation.z
    f0, f1 = int(action.frame_range[0]), int(action.frame_range[1])
    frames = []
    for f in range(f0, f1 + 1):
        sc.frame_set(f); pose = {}
        for tb in rig.order:
            M = rig.fk(pose)
            sb = UAL_MAP.get(tb)
            if not sb: continue
            Ws = sw @ src.pose.bones[sb].matrix
            Wt = Ws.to_3x3().normalized() @ s_rest[sb].to_3x3().normalized().inverted() @ t_rest[tb].to_3x3().normalized()
            At = tw3.inverted() @ Wt
            pos = None
            if tb == 'hips':
                dW = Ws.translation - s_rest[sb].translation
                pos = tw.inverted() @ (t_rest[tb].translation + dW * k)
            rig.set_arm(pose, M, tb, At, pos)
        frames.append(pose)
    return Baked(name, frames)


class Baked:
    """A list of poses (frame 0..n-1) used like an action by the composer."""
    def __init__(self, name, frames): self.name = name; self.frames = frames
    def at(self, f):
        f = min(max(f, 0), len(self.frames) - 1); i = int(math.floor(f)); j = min(i + 1, len(self.frames) - 1)
        return blend(self.frames[i], self.frames[j], f - i) if j != i else dict(self.frames[i])
    def __len__(self): return len(self.frames)


def src_at(src, f): return src.at(f) if isinstance(src, Baked) else sample(src, f)
def src_len(src): return len(src) - 1 if isinstance(src, Baked) else length(src)


# ------------------------------------------------------------------------------------------------ composer
def ease(u, kind):
    if kind == 'in': return u * u            # slow start (anticipation into the wind-up)
    if kind == 'out': return 1 - (1 - u) ** 2
    if kind == 'io': return u * u * (3 - 2 * u)
    if kind == 'snap': return 1 - (1 - u) ** 3  # violent start, soft arrival (the strike)
    return u


def warp(keys, f):
    """keys: [(out_f, src_f, ease)], piecewise; ease applies to the segment ending at that key."""
    if f <= keys[0][0]: return keys[0][1]
    for (a, sa, _), (b, sb, e) in zip(keys, keys[1:]):
        if f <= b: u = (f - a) / max(b - a, 1e-6); return sa + (sb - sa) * ease(u, e)
    return keys[-1][1]


def curve(keys, f):
    """Smooth (smoothstep) interpolation of scalar/vector keys [(f, v)]."""
    if f <= keys[0][0]: return keys[0][1]
    for (a, va), (b, vb) in zip(keys, keys[1:]):
        if f <= b: u = (f - a) / max(b - a, 1e-6); u = u * u * (3 - 2 * u); return va + (vb - va) * u
    return keys[-1][1]


class Clip:
    """Out clip of n frames. layers: source + warp with fade in; adds: armature-space additive rotations; ik: arm IK."""
    def __init__(self, name, n, hits=()):
        self.name, self.n, self.hits = name, n, list(hits); self.layers = []; self.adds = []; self.iks = []; self.hip = None; self.post = []
        self.weapons = None; self.floor_fix = (0, 0); self.max_arm = 40  # arm lift cap: more would undo the strike

    def src(self, s, keys, start=0, fade=0):
        self.layers.append((s, [(k[0], k[1], k[2] if len(k) > 2 else 'lin') for k in keys], start, fade)); return self

    def add(self, bone, axis, keys): self.adds.append((bone, axis, keys)); return self
    def hips(self, keys): self.hip = keys; return self  # [(f, Vector)] armature-space offset
    def ik(self, side, target_fn, wkeys, pole_fn=None): self.iks.append((side, target_fn, wkeys, pole_fn)); return self

    def pose(self, rig, f):
        pose = None
        for s, keys, start, fade in self.layers:
            if f < start: continue
            p = src_at(s, warp(keys, f))
            w = 1 if fade <= 0 else min(1, (f - start) / fade)
            pose = p if pose is None else blend(pose, p, w)
        M0 = rig.fk(pose); feet = {sd: (M0['foot.' + sd].translation.copy(), M0['foot.' + sd].to_3x3().normalized()) for sd in ('l', 'r')}
        if self.hip:
            o = curve(self.hip, f) * HIP_SCALE; l, q = pose['hips']; M = rig.fk(pose)
            rig.set_arm(pose, M, 'hips', None, M['hips'].translation + o)
        for bone, axis, keys in self.adds:
            d = curve(keys, f)
            if abs(d) > 1e-3: rig.rotate(pose, bone, axis, d)
        for side, tfn, wkeys, pfn in self.iks:
            w = curve(wkeys, f)
            if w > 0.001:
                M = rig.fk(pose)
                tgt = tfn(M, f); pole = pfn(M, f) if pfn else M['lowerarm.' + side].translation - FWD * 0.3
                rig.ik2(pose, 'upperarm.' + side, 'lowerarm.' + side, 'wrist.' + side, tgt, pole, w)
        for fn in self.post: fn(rig, pose, f)
        corr = getattr(self, '_corr', None)
        if corr is not None:
            sp, ar, side = corr[f]
            if abs(sp) > 1e-3: rig.rotate(pose, 'spine', LEFT, -sp)
            if abs(ar) > 1e-3 and side: rig.rotate(pose, 'upperarm.' + side, LEFT, -ar)
        self.plant(rig, pose, feet)
        M = rig.fk(pose); kn = min(M['lowerleg.l'].translation.y, M['lowerleg.r'].translation.y)
        if kn < KNEE_MIN:  # kneeling source poses push the knee mesh through the floor: lift the hips, keep the feet
            rig.set_arm(pose, M, 'hips', None, M['hips'].translation + UP * (KNEE_MIN - kn)); self.plant(rig, pose, feet)
        return pose

    def plant(self, rig, pose, feet):
        """Feet stay where the source clip put them (hip drops bend the knees instead of sinking the legs)."""
        for sd, (pos, rot) in feet.items():
            pos = pos.copy(); pos.y = max(pos.y, rig.rest['foot.' + sd].translation.y)  # never below the rest ankle height
            M = rig.fk(pose); knee = M['lowerleg.' + sd].translation + FWD * 0.4
            rig.ik2(pose, 'upperleg.' + sd, 'lowerleg.' + sd, 'foot.' + sd, pos, knee)
            M = rig.fk(pose); rig.set_arm(pose, M, 'foot.' + sd, rot)
            ty = rig.rest['toes.' + sd].translation.y
            for _ in range(12):  # toe pitched into the floor (source pose): rotate the foot toe-up until the toe joint is at rest height
                M = rig.fk(pose)
                if M['toes.' + sd].translation.y >= ty - 0.004: break
                rig.rotate(pose, 'foot.' + sd, LEFT, -3)

    def weapon_min(self, rig, pose):
        lo = 9.0; side = None
        if not self.weapons: return lo, side
        M = rig.fk(pose)
        for sd, verts in self.weapons.items():
            Mh = M['handslot.' + sd]
            for v in verts:
                y = (Mh @ v).y
                if y < lo: lo = y; side = sd
        return lo, side

    def solve_floor(self, rig, margin=0.03):
        """Per frame: lean back (spine) then lift the weapon arm until every weapon vertex clears the floor; smoothed."""
        n = self.n + 1; sp = [0.0] * n; ar = [0.0] * n; sides = [None] * n; self._corr = None
        for f in range(n):
            base = self.pose(rig, f); lo, side = self.weapon_min(rig, base); sides[f] = side
            if lo >= margin: continue
            a = b = 0.0
            while lo < margin and a < 20:
                a += 2; p = {k: (v[0].copy(), v[1].copy()) for k, v in base.items()}; rig.rotate(p, 'spine', LEFT, -a); lo, _ = self.weapon_min(rig, p)
            while lo < margin and b < self.max_arm:
                b += 4; p = {k: (v[0].copy(), v[1].copy()) for k, v in base.items()}; rig.rotate(p, 'spine', LEFT, -a); rig.rotate(p, 'upperarm.' + side, LEFT, -b); lo, _ = self.weapon_min(rig, p)
            sp[f] = a; ar[f] = b
        def smooth(x):
            m = [max(x[max(0, i - 2):i + 3]) for i in range(n)]
            return [sum(m[max(0, i - 2):i + 3]) / len(m[max(0, i - 2):i + 3]) for i in range(n)]
        sp2, ar2 = smooth(sp), smooth(ar)
        sd = next((s for s in sides if s), None)
        self._corr = [(max(sp[i], sp2[i]), max(ar[i], ar2[i]), sides[i] or sd) for i in range(n)]
        self.floor_fix = (max(sp), max(ar))

    def bake(self, rig):
        act = bpy.data.actions.new('Rig_Medium|' + self.name); act.use_fake_user = True
        if self.weapons: self.solve_floor(rig)
        frames = [self.pose(rig, f) for f in range(self.n + 1)]
        prev = {}
        curves = {}
        for n in rig.order:
            curves[n] = ([act.fcurves.new(f'pose.bones["{n}"].location', index=i, action_group=n) for i in range(3)],
                         [act.fcurves.new(f'pose.bones["{n}"].rotation_quaternion', index=i, action_group=n) for i in range(4)],
                         [act.fcurves.new(f'pose.bones["{n}"].scale', index=i, action_group=n) for i in range(3)])
        for f, pose in enumerate(frames):
            for n in rig.order:
                loc, q = pose.get(n, (Vector(), Quaternion()))
                if n in prev and prev[n].dot(q) < 0: q = -q
                prev[n] = q
                lc, rc, sc = curves[n]
                for i in range(3): lc[i].keyframe_points.insert(f + 1, loc[i], options={'FAST'}).interpolation = 'LINEAR'
                for i in range(4): rc[i].keyframe_points.insert(f + 1, q[i], options={'FAST'}).interpolation = 'LINEAR'
                for i in range(3): sc[i].keyframe_points.insert(f + 1, 1.0, options={'FAST'}).interpolation = 'LINEAR'
        for c3 in curves.values():
            for group in c3:
                for c in group: c.update()
        self.action = act; self.frames = frames
        return act


def export(arm, path, keep_prefix='HM_'):
    """FBX with only the armature and the HM_* takes (other actions removed from the export)."""
    for a in list(bpy.data.actions):
        if not short(a.name).startswith(keep_prefix): bpy.data.actions.remove(a)
    for o in bpy.context.scene.objects:
        o.select_set(False)
        if o.name == 'Rig_Medium' and o != arm: o.name = 'Rig_Medium_other'
    arm.name = 'Rig_Medium'; arm.data.name = 'Rig_Medium'  # root node name = the KayKit rig node, so Unity clip paths bind
    for a in bpy.data.actions: a.name = 'Rig_Medium|' + short(a.name)
    arm.select_set(True); bpy.context.view_layer.objects.active = arm
    # second top-level node: keeps Unity from collapsing Rig_Medium into the asset root (clip paths stay Rig_Medium/root/...)
    anc = bpy.data.objects.get('hm_anchor') or bpy.data.objects.new('hm_anchor', None)
    if anc.name not in bpy.context.scene.collection.objects: bpy.context.scene.collection.objects.link(anc)
    anc.parent = None; anc.select_set(True)
    arm.animation_data_create(); arm.animation_data.action = None
    bpy.ops.export_scene.fbx(filepath=path, use_selection=True, object_types={'ARMATURE', 'EMPTY'}, add_leaf_bones=False,
                             bake_anim=True, bake_anim_use_all_actions=True, bake_anim_use_nla_strips=False,
                             bake_anim_force_startend_keying=True, bake_anim_simplify_factor=0.0, bake_anim_step=1.0,
                             apply_unit_scale=True, apply_scale_options='FBX_SCALE_UNITS', armature_nodetype='NULL')
