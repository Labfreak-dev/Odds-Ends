# Fitted leather set: every piece is a shell of the hero's own body faces, offset along the
# body normal with a consistent thickness. Vertices keep the body's exact skin weights
# (then smoothed at joints), so pieces deform with the body and cannot tear away from it.
import bpy, bmesh, sys, os, math
from mathutils import Vector
HERO = "/tmp/hmmain/hollowmere/Assets/Resources/Models/hero.glb"
OUT = sys.argv[sys.argv.index("--")+1] if "--" in sys.argv else "/workspace/hm_bug/fitted"
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=HERO)
body = bpy.data.objects["hero"]; rig = bpy.data.objects["hero_rig"]
for o in list(bpy.data.objects):
    if o.type == 'MESH' and o != body: bpy.data.objects.remove(o)
P = "mixamorig:"
def bone(n): b = rig.data.bones[P+n]; return rig.matrix_world @ b.head_local, rig.matrix_world @ b.tail_local
gi = {g.name[len(P):]: g.index for g in body.vertex_groups}
gname = {v: k for k, v in gi.items()}
me = body.data
# dominant bone + position along that bone per vertex
dom = []; wts = []
for v in me.vertices:
    best = max(v.groups, key=lambda g: g.weight) if v.groups else None
    dom.append(gname.get(best.group, "") if best else "")
def along(p, name):
    h, t = bone(name); d = t - h; return (p - h).dot(d) / max(d.length_squared, 1e-9)
side = lambda n: n.replace("Left", "").replace("Right", "")
co = [body.matrix_world @ v.co for v in me.vertices]
hipz = bone("Hips")[0].z; headz = bone("Head")[0].z; neckz = bone("Neck")[0].z
print("hipz", hipz, "neck", neckz, "head", headz)

# rules: (vertex test) per slot/tier
def R(tier):
    fing = ("Hand",)
    def isb(i, *names): return side(dom[i]).split("Index")[0] in names or any(side(dom[i]).startswith(n) for n in names)
    def chest(i):
        d = side(dom[i]); p = co[i]
        if d in ("Spine", "Spine1", "Spine2", "Shoulder"): return True
        if d == "Neck": return p.z < neckz + 0.02
        if d == "Hips": return p.z > hipz - (0.02 if tier == 1 else 0.10 if tier == 2 else 0.16)
        if d == "Arm": return True
        if d == "ForeArm": return along(p, dom[i]) < 0.62
        if d == "UpLeg" and tier == 3: return along(p, dom[i]) < 0.18
        return False
    def waist(i):
        p = co[i]; d = side(dom[i])
        return d in ("Hips", "Spine", "UpLeg") and hipz - 0.03 < p.z < hipz + 0.06 + 0.02 * tier
    def legs(i):
        d = side(dom[i]); p = co[i]
        if d == "Hips": return p.z < hipz + 0.07
        if d == "UpLeg": return True
        if d == "Leg": return along(p, dom[i]) < 0.92
        return False
    def feet(i):
        d = side(dom[i])
        if d in ("Foot", "ToeBase"): return True
        if d == "Leg": return along(co[i], dom[i]) > (0.70 if tier == 1 else 0.55 if tier == 2 else 0.42)
        return False
    def hands(i):
        d = side(dom[i])
        if d.startswith("Hand"): return True
        if d == "ForeArm": return along(co[i], dom[i]) > 0.74
        return False
    def wrists(i):
        d = side(dom[i])
        return d == "ForeArm" and along(co[i], dom[i]) > (0.50 if tier == 1 else 0.40 if tier == 2 else 0.25)
    def shoulders(i):
        d = side(dom[i]); p = co[i]
        if d == "Shoulder": return True
        if d == "Arm": return along(p, dom[i]) < (0.25 if tier == 1 else 0.33 if tier == 2 else 0.42)
        if d == "Spine2": return p.z > neckz - (0.06 + 0.02 * tier) and abs(p.x) > 0.07
        return False
    def head(i):
        d = side(dom[i]); p = co[i]
        if d not in ("Head", "HeadTop_End", "HeadFront", "Neck"): return False
        # leather hood/cap: scalp and back of head; face open
        front = p.y < -0.0 and p.z < headz + 0.12  # glTF -> Blender: forward is -Y
        if tier == 1: return p.z > headz + 0.115
        if tier == 2: return p.z > headz + 0.09 and not (front and p.z < headz + 0.13)
        return (p.z > headz + 0.02 and not front) or p.z > headz + 0.12 or (d == "Neck" and tier == 3 and p.y > 0)
    return dict(chest=chest, waist=waist, legs=legs, feet=feet, hands=hands, wrists=wrists, shoulders=shoulders, head=head)

# offsets (m) layered inner -> outer, thickness (m)
OFF = dict(hands=0.004, legs=0.008, feet=0.014, chest=0.012, wrists=0.018, waist=0.022, shoulders=0.016, head=0.022)
TH = dict(hands=0.003, legs=0.004, feet=0.006, chest=0.005, wrists=0.006, waist=0.008, shoulders=0.007, head=0.007)
# Leather palette shared by the whole set (linear base colours)
PAL = dict(dark=(0.055, 0.030, 0.018), mid=(0.13, 0.068, 0.035), tan=(0.30, 0.18, 0.09), cloth=(0.17, 0.12, 0.08), strap=(0.035, 0.022, 0.014))
COL = {1: dict(chest="cloth", legs="cloth", feet="mid", hands="mid", wrists="mid", waist="mid", shoulders="mid", head="cloth"),
       2: dict(chest="mid", legs="dark", feet="dark", hands="dark", wrists="mid", waist="strap", shoulders="dark", head="mid"),
       3: dict(chest="dark", legs="dark", feet="strap", hands="strap", wrists="tan", waist="tan", shoulders="tan", head="dark")}
JOINTS = ["Arm", "ForeArm", "UpLeg", "Leg", "Spine", "Spine1", "Spine2", "Hips", "Shoulder"]

# leather grain texture (procedural, CC0 by construction)
def grain():
    img = bpy.data.images.get("leather_grain") or bpy.data.images.new("leather_grain", 512, 512)
    import random
    random.seed(7); N = 512; px = [0.0] * (N * N * 4)
    import array
    vals = array.array('f', [0.0]) * (N * N)
    for oc, amp in ((8, 0.5), (32, 0.3), (128, 0.2)):
        g = [[random.random() for _ in range(oc + 1)] for _ in range(oc + 1)]
        s = N / oc
        for y in range(N):
            fy = y / s; y0 = int(fy) % oc; ty = fy - int(fy)
            for x in range(N):
                fx = x / s; x0 = int(fx) % oc; tx = fx - int(fx)
                a = g[y0][x0] * (1 - tx) + g[y0][(x0 + 1) % oc] * tx
                b = g[(y0 + 1) % oc][x0] * (1 - tx) + g[(y0 + 1) % oc][(x0 + 1) % oc] * tx
                vals[y * N + x] += amp * (a * (1 - ty) + b * ty)
    for i in range(N * N):
        v = 0.80 + 0.35 * (vals[i] - 0.5)
        px[i * 4:i * 4 + 4] = (v, v, v, 1.0)
    img.pixels = px
    img.filepath_raw = OUT + "/leather_grain.png"; img.file_format = 'PNG'; img.save()
    return img
GRAIN = grain()
def mat(key):
    # glTF can't carry a multiply node: bake palette x grain into one texture per palette entry
    name = "leather_" + key
    m = bpy.data.materials.get(name)
    if m: return m
    N = GRAIN.size[0]; g = list(GRAIN.pixels); c = PAL[key]
    lin2s = lambda x: (x * 12.92 if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055)
    img = bpy.data.images.new(name, N, N)
    px = [0.0] * (N * N * 4)
    for i in range(N * N):
        v = g[i * 4]
        px[i*4:i*4+4] = (lin2s(min(1, c[0] * v)), lin2s(min(1, c[1] * v)), lin2s(min(1, c[2] * v)), 1.0)
    img.pixels = px; img.filepath_raw = OUT + "/" + name + ".png"; img.file_format = 'PNG'; img.save()
    m = bpy.data.materials.new(name); m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    t = m.node_tree.nodes.new("ShaderNodeTexImage"); t.image = img
    m.node_tree.links.new(t.outputs[0], bsdf.inputs["Base Color"])
    # metallic-roughness map too: the game's glTF path keys its Hollowmere/Lit adoption on it
    rough = 0.72 if key != "cloth" else 0.9
    mr = bpy.data.images.get("leather_mr")
    if mr is None:
        mr = bpy.data.images.new("leather_mr", 16, 16); mr.colorspace_settings.name = 'Non-Color'
        mr.pixels = [0.0, 0.75, 0.0, 1.0] * 256
    tm = m.node_tree.nodes.new("ShaderNodeTexImage"); tm.image = mr
    sep = m.node_tree.nodes.new("ShaderNodeSeparateColor")
    m.node_tree.links.new(tm.outputs[0], sep.inputs[0])
    m.node_tree.links.new(sep.outputs[1], bsdf.inputs["Roughness"]); m.node_tree.links.new(sep.outputs[2], bsdf.inputs["Metallic"])
    return m

def build(slot, tier):
    test = R(tier)[slot]
    keepv = [test(i) for i in range(len(me.vertices))]
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True); bpy.context.view_layer.objects.active = body
    bpy.ops.object.duplicate(); piece = bpy.context.active_object
    piece.name = "%s_t%d" % (slot, tier); piece.data.name = piece.name
    for m in list(piece.modifiers):
        if m.type != 'ARMATURE': piece.modifiers.remove(m)
    bm = bmesh.new(); bm.from_mesh(piece.data); bm.verts.ensure_lookup_table()
    # keep faces whose verts are mostly selected (decided on the original indices, then weld UV-seam splits)
    for f in bm.faces: f.tag = sum(keepv[v.index] for v in f.verts) < len(f.verts) * 0.67
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0002)
    drop = [f for f in bm.faces if f.tag]
    bmesh.ops.delete(bm, geom=drop, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]; bmesh.ops.delete(bm, geom=loose, context='VERTS')
    # drop tiny islands (ragged specks)
    bm.faces.ensure_lookup_table(); seen = set(); small = []
    for f in bm.faces:
        if f in seen: continue
        isl = []; st = [f]; seen.add(f)
        while st:
            g = st.pop(); isl.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h not in seen: seen.add(h); st.append(h)
        if len(isl) < 40: small += isl
    bmesh.ops.delete(bm, geom=small, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]; bmesh.ops.delete(bm, geom=loose, context='VERTS')
    # smooth the selection boundary so edges read as cut leather, not a staircase
    bnd = [v for v in bm.verts if v.is_boundary]
    for _ in range(6): bmesh.ops.smooth_vert(bm, verts=bnd, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.to_mesh(piece.data); bm.free()
    if len(piece.data.vertices) == 0: return None
    bpy.context.view_layer.objects.active = piece
    # relax body detail (abs, nipples, knuckles) out of the shell, then offset + thickness
    sm = piece.modifiers.new("relax", 'SMOOTH'); sm.iterations = 40 if slot == "head" else 6 if slot != "hands" else 1; sm.factor = 0.5
    
    disp = piece.modifiers.new("offset", 'DISPLACE'); disp.direction = 'NORMAL'; disp.strength = OFF[slot] + (0.002 * (tier - 1) if slot in ("chest", "shoulders") else 0); disp.mid_level = 0.0
    so = piece.modifiers.new("thick", 'SOLIDIFY'); so.thickness = TH[slot]; so.offset = 1.0; so.use_even_offset = False; so.use_quality_normals = True; so.use_rim = True; so.use_flip_normals = False
    arm = [m for m in piece.modifiers if m.type == 'ARMATURE']
    for m in arm: piece.modifiers.remove(m)
    for m in ("relax", "offset", "thick"): bpy.ops.object.modifier_apply(modifier=m)
    a = piece.modifiers.new("Armature", 'ARMATURE'); a.object = rig
    # weight cleanup at joints: smooth groups that meet at shoulders, elbows, hips, knees
    for g in piece.vertex_groups:
        if any(g.name == P + s + j for s in ("Left", "Right", "") for j in JOINTS):
            piece.vertex_groups.active_index = g.index
            bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
            bpy.ops.object.vertex_group_smooth(group_select_mode='ACTIVE', factor=0.3, repeat=2)
            bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    piece.data.materials.clear(); piece.data.materials.append(mat(COL[tier][slot]))
    for p in piece.data.polygons: p.use_smooth = True
    bpy.ops.object.select_all(action='DESELECT'); piece.select_set(True); rig.select_set(True)
    bpy.ops.export_scene.gltf(filepath="%s/t%d_%s.glb" % (OUT, tier, slot), use_selection=True, export_animations=False,
                              export_skins=True, export_apply=False, export_yup=True)
    print("BUILT", slot, tier, len(piece.data.vertices))
    piece.hide_set(True)
    return piece

SLOTS = ["chest", "waist", "legs", "feet", "hands", "wrists", "shoulders", "head"]
only = os.environ.get("HM_SLOT")
for t in (1, 2, 3):
    for s in SLOTS:
        if only and s != only: continue
        build(s, t)
bpy.ops.wm.save_as_mainfile(filepath=OUT + "/leather_fitted.blend")
