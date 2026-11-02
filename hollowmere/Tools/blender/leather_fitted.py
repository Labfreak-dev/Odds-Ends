# Fitted leather set v2 (Hollowmere). Every piece is a shell of the hero's own body (pouches/sculpted pads smoothed
# away first), cut along clean planes (belt, hems, cuffs, ankles), offset along the body normal with an even
# thickness, body skin weights kept (joint-smoothed). Pauldrons/kneeguards are domed authored layers; the hood is a
# clean ellipsoid shrunk onto the skull (not the hair) with a size cap. Albedo / normal / metal-rough maps are baked
# from a procedural leather shader: grain, trim bands, stitching, straps, buckles, edge wear. Shared palette per set.
import bpy, bmesh, sys, os, math, heapq
from mathutils import Vector, kdtree
from mathutils.bvhtree import BVHTree
HERO = "/tmp/hmmain/hollowmere/Assets/Resources/Models/hero.glb"
OUT = sys.argv[sys.argv.index("--")+1] if "--" in sys.argv else "/workspace/hm_bug/fitted"
TEX = int(os.environ.get("HM_TEX", "1024"))
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=HERO)
body = bpy.data.objects["hero"]; rig = bpy.data.objects["hero_rig"]
for o in list(bpy.data.objects):
    if o.type == 'MESH' and o != body: bpy.data.objects.remove(o)
P = "mixamorig:"
def bone(n): b = rig.data.bones[P+n]; return rig.matrix_world @ b.head_local, rig.matrix_world @ b.tail_local
def bfrac(n, f): h, t = bone(n); return h + (t - h) * f, (t - h).normalized()
hipz = bone("Hips")[0].z; headz = bone("Head")[0].z; neckz = bone("Neck")[0].z
FWD = (bone("HeadFront")[0] - bone("Head")[0]); FWD.z = 0; FWD.normalize()
print("hipz", hipz, "neck", neckz, "head", headz, "fwd", FWD)
gname = {g.index: g.name[len(P):] for g in body.vertex_groups}
side = lambda n: n.replace("Left", "").replace("Right", "")

# ---- smooth body: weld UV-seam splits, then volume-preserving smoothing away from hands/face ----
bpy.context.view_layer.objects.active = body; body.select_set(True)
bpy.ops.object.duplicate(); sb = bpy.context.active_object; sb.name = "smoothbody"
for m in list(sb.modifiers): sb.modifiers.remove(m)
bm = bmesh.new(); bm.from_mesh(sb.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0002); bm.to_mesh(sb.data); bm.free()
me = sb.data
dom = []
for v in me.vertices:
    best = max(v.groups, key=lambda g: g.weight) if v.groups else None
    dom.append(side(gname.get(best.group, "")) if best else "")
vg = sb.vertex_groups.new(name="smoothmask")
for v in me.vertices:
    d = dom[v.index]
    if not (d.startswith("Hand") or d in ("Head", "HeadTop_End", "HeadFront")): vg.add([v.index], 1.0, 'REPLACE')
lap = sb.modifiers.new("lap", 'LAPLACIANSMOOTH'); lap.iterations = int(os.environ.get("HM_LAP", "60")); lap.lambda_factor = 1.2; lap.lambda_border = 0.0
lap.use_volume_preserve = True; lap.use_normalized = True; lap.vertex_group = "smoothmask"
bpy.ops.object.modifier_apply(modifier="lap")
smo = sb.modifiers.new("smo", 'SMOOTH'); smo.factor = 0.8; smo.iterations = int(os.environ.get("HM_SMO", "25")); smo.vertex_group = "smoothmask"
bpy.ops.object.modifier_apply(modifier="smo")
sb.vertex_groups.remove(sb.vertex_groups["smoothmask"])
me = sb.data   # modifier_apply swaps the mesh datablock
co0 = [v.co.copy() for v in me.vertices]
KD = kdtree.KDTree(len(co0))
for i, p in enumerate(co0): KD.insert(p, i)
KD.balance()
sb.hide_set(True); sb.hide_render = True

PAL = dict(brown=(0.16, 0.075, 0.035), dark=(0.055, 0.03, 0.017), tan=(0.34, 0.21, 0.10), oxblood=(0.11, 0.032, 0.02),
           charcoal=(0.075, 0.068, 0.06), linen=(0.40, 0.33, 0.23), iron=(0.32, 0.32, 0.34), brass=(0.55, 0.38, 0.14))
# per tier/slot: (main, trim, accent layer, strap, buckle metal)
LOOK = {
 1: dict(chest=("brown", "dark", "brown", "dark", "iron"), legs=("charcoal", "dark", "dark", "dark", "iron"), feet=("dark", "brown", "brown", "brown", "iron"),
         hands=("tan", "brown", "tan", "brown", "iron"), wrists=("brown", "dark", "brown", "dark", "iron"), waist=("dark", "brown", "dark", "dark", "iron"),
         shoulders=("brown", "dark", "dark", "dark", "iron"), head=("brown", "dark", "brown", "dark", "iron")),
 2: dict(chest=("dark", "tan", "brown", "brown", "iron"), legs=("charcoal", "dark", "brown", "dark", "iron"), feet=("dark", "tan", "dark", "tan", "iron"),
         hands=("dark", "tan", "dark", "tan", "iron"), wrists=("oxblood", "tan", "oxblood", "dark", "iron"), waist=("tan", "dark", "tan", "dark", "iron"),
         shoulders=("oxblood", "tan", "dark", "dark", "iron"), head=("brown", "tan", "brown", "dark", "iron")),
 3: dict(chest=("oxblood", "tan", "dark", "dark", "brass"), legs=("dark", "tan", "oxblood", "brown", "brass"), feet=("dark", "tan", "oxblood", "tan", "brass"),
         hands=("dark", "tan", "oxblood", "tan", "brass"), wrists=("dark", "tan", "oxblood", "tan", "brass"), waist=("dark", "tan", "dark", "tan", "brass"),
         shoulders=("dark", "tan", "oxblood", "tan", "brass"), head=("charcoal", "oxblood", "charcoal", "dark", "brass")),
}
OFF = dict(hands=0.003, legs=0.006, feet=0.012, chest=0.010, wrists=0.016, waist=0.020, shoulders=0.016)
TH = dict(hands=0.0025, legs=0.004, feet=0.006, chest=0.005, wrists=0.006, waist=0.007, shoulders=0.007, head=0.006)
JOINTS = ["Arm", "ForeArm", "UpLeg", "Leg", "Spine", "Spine1", "Spine2", "Hips", "Shoulder"]
UP = Vector((0, 0, 1))

def cuts_for(slot, t):
    """Plane cuts: (point, normal, sideSign or 0). Geometry on the normal's side is removed."""
    C = []
    def limb(n, f, keep):
        for sd in ("Left", "Right"):
            p, d = bfrac(sd + n, f); C.append((p, d if keep == "prox" else -d, 1 if p.x > 0 else -1))
    if slot == "chest":
        C.append((Vector((0, 0, neckz + 0.025)), UP, 0))
        C.append((Vector((0, 0, hipz - (0.03, 0.10, 0.17)[t-1])), -UP, 0))
        limb("ForeArm", 0.62, "prox")
    elif slot == "waist":
        C.append((Vector((0, 0, hipz + 0.05 + 0.012 * t)), UP, 0)); C.append((Vector((0, 0, hipz - 0.03)), -UP, 0))
    elif slot == "legs":
        C.append((Vector((0, 0, hipz + 0.08)), UP, 0)); limb("Leg", 0.95, "prox")
    elif slot == "feet":
        limb("Leg", (0.62, 0.52, 0.42)[t-1], "dist")
    elif slot == "hands":
        limb("ForeArm", 0.76, "dist")
    elif slot == "wrists":
        limb("ForeArm", (0.48, 0.40, 0.28)[t-1], "dist"); limb("ForeArm", 0.92, "prox")
    elif slot == "shoulders":
        limb("Arm", (0.30, 0.36, 0.44)[t-1], "prox")
        C.append((Vector((0, 0, neckz - 0.09)), -UP, 0))
        C.append((Vector((0.085, 0, 0)), Vector((-1, 0, 0)), 1)); C.append((Vector((-0.085, 0, 0)), Vector((1, 0, 0)), -1))
    return C

SETS = dict(chest={"Spine", "Spine1", "Spine2", "Shoulder", "Neck", "Hips", "Arm", "ForeArm", "UpLeg"},
            waist={"Hips", "Spine", "Spine1", "UpLeg"}, legs={"Hips", "UpLeg", "Leg", "Spine"}, feet={"Leg", "Foot", "ToeBase"},
            hands={"Hand", "ForeArm"}, wrists={"ForeArm", "Hand"}, shoulders={"Shoulder", "Arm", "Spine2", "Neck"})

def clean_islands(bm, minf=60):
    seen = set(); small = []
    for f in bm.faces:
        if f in seen: continue
        isl = []; st = [f]; seen.add(f)
        while st:
            g = st.pop(); isl.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h not in seen: seen.add(h); st.append(h)
        if len(isl) < minf: small += isl
    bmesh.ops.delete(bm, geom=small, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')

def shell(slot, t, cuts=None, sel=None):
    bm = bmesh.new(); bm.from_mesh(me); bm.normal_update()
    # remember each vertex's smoothbody position: weights are looked up there, not after offset/smoothing moved it
    ol = [bm.verts.layers.float.new(a) for a in ("ox", "oy", "oz")]
    for v in bm.verts:
        for k in range(3): v[ol[k]] = v.co[k]
    names = SETS[slot]
    for f in bm.faces:
        if sel is not None: f.tag = not sel(f)
        else: f.tag = sum((dom[v.index] in names or (dom[v.index].startswith("Hand") and "Hand" in names)) for v in f.verts) < len(f.verts) * 0.5
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.tag], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    for (p, n, sd) in (cuts if cuts is not None else cuts_for(slot, t)):
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        if sd:
            geom = [g for g in geom if all(((v.co.x > 0) == (sd > 0)) for v in (g.verts if hasattr(g, "verts") else [g]))]
        if not geom: continue
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=p, plane_no=n, clear_outer=True, dist=0.0005)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    clean_islands(bm)
    # close small holes left by the body (pouch/strap cut-outs) so no black slot shows through a piece;
    # the plane-cut hems are long loops and stay open
    bound = [e for e in bm.edges if e.is_boundary]
    if bound: bmesh.ops.holes_fill(bm, edges=bound, sides=int(os.environ.get("HM_HOLE", "40")))
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    return bm

def edge_dist(bm):
    d = {v: (0.0 if v.is_boundary else 9.0) for v in bm.verts}
    h = [(0.0, i, v) for i, v in enumerate(bm.verts) if v.is_boundary]; heapq.heapify(h); k = len(h)
    while h:
        dv, _, v = heapq.heappop(h)
        if dv > d[v]: continue
        for e in v.link_edges:
            o = e.other_vert(v); nd = dv + e.calc_length()
            if nd < d[o]: d[o] = nd; k += 1; heapq.heappush(h, (nd, k, o))
    return d

def offset(bm, base, dome=0.0, domeDir=None):
    bm.normal_update()
    ed = edge_dist(bm)
    moves = []
    for v in bm.verts:
        n = v.normal.copy(); x = base
        if dome:
            u = domeDir(v.co)
            x += dome * max(0.0, n.dot(u)) * min(1.0, ed[v] / 0.04)
        moves.append((v, n * x))
    for v, d in moves: v.co += d

def merge(dst, src):
    lay_d = dst.verts.layers.float.get("layer") or dst.verts.layers.float.new("layer")
    dfd = dst.verts.layers.deform.verify(); dfs = src.verts.layers.deform.verify()
    vm = {}
    for v in src.verts:
        nv = dst.verts.new(v.co); nv[lay_d] = 1.0
        for gi, w in v[dfs].items(): nv[dfd][gi] = w
        vm[v] = nv
    for f in src.faces:
        try: dst.faces.new([vm[v] for v in f.verts])
        except ValueError: pass

BVH = None
def ray_cap(c, off, cap_r, cuts, smooth=40, seg=(48, 32)):
    """Clean authored dome: rays from c onto the smooth body, radius field smoothed, +off, capped at cap_r; plane cuts."""
    global BVH
    if BVH is None: BVH = BVHTree.FromObject(sb, bpy.context.evaluated_depsgraph_get())
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg[0], v_segments=seg[1], radius=1.0); bm.verts.ensure_lookup_table()
    R = []
    for v in bm.verts:
        d = v.co.normalized(); hit = BVH.ray_cast(c + d * 0.5, -d, 0.5)
        R.append((0.5 - hit[3]) if hit[0] is not None else cap_r)
    for _ in range(smooth):
        R = [0.5 * R[v.index] + 0.5 * sum(R[e.other_vert(v).index] for e in v.link_edges) / len(v.link_edges) for v in bm.verts]
    for v in bm.verts:
        d = v.co.normalized(); v.co = c + d * min(R[v.index] + off, cap_r)
    for p, n in cuts:
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=p, plane_no=n, clear_outer=True)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    clean_islands(bm, 30)
    return bm

def append(dst, src, layer_val):
    lay = dst.verts.layers.float.get("layer") or dst.verts.layers.float.new("layer")
    vm = {}
    for v in src.verts:
        nv = dst.verts.new(v.co); nv[lay] = layer_val; vm[v] = nv
    for f in src.faces:
        try: dst.faces.new([vm[v] for v in f.verts])
        except ValueError: pass

def ellipsoid(c, rx, ry, rz, cuts, seg=(40, 24)):
    """Clean authored dome (no body bumps): ellipsoid around a joint, plane cuts give clean rim loops."""
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg[0], v_segments=seg[1], radius=1.0)
    for v in bm.verts: v.co = c + Vector((v.co.x * rx, v.co.y * ry, v.co.z * rz))
    for p, n in cuts:
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=p, plane_no=n, clear_outer=True)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    return bm

def pauldron(sd, t, lame=False):
    h = bone(sd + "Arm")[0]; out = Vector((1 if h.x > 0 else -1, 0, 0))
    k = (1.0, 1.08, 1.16)[t-1] * (0.82 if lame else 1.0)
    c = h + out * (0.020 if not lame else 0.032) + UP * (0.005 if not lame else -0.010)
    rz = 0.088 * k; low = c.z - (0.030 if not lame else 0.045)
    cuts = [(Vector((0, 0, low)), -UP), (h - out * 0.055, -out)]
    return ellipsoid(c, 0.105 * k, 0.098 * k, rz, cuts)

def kneeguard(sd, t):
    k = bone(sd + "Leg")[0]; s_ = 1.0 if t == 2 else 1.15
    c = k + FWD * 0.022
    cuts = [(c, -FWD)]
    return ellipsoid(c, 0.055 * s_, 0.036 * s_, 0.068 * s_, cuts)

def head_hood(t):
    hv = [co0[i] for i in range(len(co0)) if dom[i] in ("Head", "HeadTop_End", "HeadFront") and co0[i].z > headz + 0.02]
    mn = Vector((min(p.x for p in hv), min(p.y for p in hv), min(p.z for p in hv))); mx = Vector((max(p.x for p in hv), max(p.y for p in hv), max(p.z for p in hv)))
    c = (mn + mx) / 2; c.z = headz + 0.10
    dg = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(sb, dg)
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=32, radius=1.0)
    bm.verts.ensure_lookup_table()
    R = []
    for v in bm.verts:
        d = v.co.normalized(); hit = bvh.ray_cast(c + d * 0.4, -d, 0.4)
        R.append((0.4 - hit[3]) if hit[0] is not None else 0.10)
    for _ in range(12):
        R = [0.5 * R[v.index] + 0.5 * sum(R[e.other_vert(v).index] for e in v.link_edges) / len(v.link_edges) for v in bm.verts]
    for v in bm.verts:
        d = v.co.normalized(); r = R[v.index] + 0.014
        cap = 1.0 / math.sqrt((d.x / 0.135) ** 2 + (d.y / 0.145) ** 2 + (d.z / 0.16) ** 2)   # size limit
        v.co = c + d * min(r, cap)
    low = (c.z - 0.005, c.z - 0.085, neckz - 0.03)[t-1]
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=Vector((0, 0, low)), plane_no=-UP, clear_outer=True)
    if t >= 2:
        brow = c.z + 0.025; front = c + FWD * 0.045
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=Vector((0, 0, brow)), plane_no=UP)
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=front, plane_no=FWD)
        kill = [f for f in bm.faces if f.calc_center_median().z < brow and (f.calc_center_median() - front).dot(FWD) > 0]
        bmesh.ops.delete(bm, geom=kill, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def lin(c): return (c[0], c[1], c[2], 1.0)
def leather_mat(name, look):
    main, trim, acc, strp, metal = look
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; L = nt.links
    for n in list(N): N.remove(n)
    out = N.new("ShaderNodeOutputMaterial"); bsdf = N.new("ShaderNodeBsdfPrincipled"); L.new(bsdf.outputs[0], out.inputs[0])
    tc = N.new("ShaderNodeTexCoord")
    def attr(n): a = N.new("ShaderNodeAttribute"); a.attribute_name = n; a.attribute_type = 'GEOMETRY'; return a.outputs["Fac"]
    def M(op, a, b=None):
        x = N.new("ShaderNodeMath"); x.operation = op
        for i, v in enumerate((a, b)):
            if v is None: continue
            if isinstance(v, (int, float)): x.inputs[i].default_value = v
            else: L.new(v, x.inputs[i])
        return x.outputs[0]
    def MA(a, mul, add):
        x = N.new("ShaderNodeMath"); x.operation = 'MULTIPLY_ADD'; L.new(a, x.inputs[0]); x.inputs[1].default_value = mul; x.inputs[2].default_value = add; return x.outputs[0]
    def mix(fac, a, b):
        x = N.new("ShaderNodeMix"); x.data_type = 'RGBA'; L.new(fac, x.inputs[0])
        for sock, v in ((x.inputs[6], a), (x.inputs[7], b)):
            if isinstance(v, tuple): sock.default_value = v
            else: L.new(v, sock)
        return x.outputs[2]
    def band(val, lo, hi, soft=0.0015):
        s1 = M('MINIMUM', M('MAXIMUM', M('DIVIDE', M('SUBTRACT', val, lo - soft), soft * 2), 0.0), 1.0)
        s2 = M('MINIMUM', M('MAXIMUM', M('DIVIDE', M('SUBTRACT', hi + soft, val), soft * 2), 0.0), 1.0)
        return M('MULTIPLY', s1, s2)
    edge = attr("edge"); strapd = attr("strap"); buck = attr("buckle"); layer = attr("layer")
    pos = tc.outputs["Object"]
    noise = N.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 90; noise.inputs["Detail"].default_value = 6; L.new(pos, noise.inputs["Vector"])
    vor = N.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 420; L.new(pos, vor.inputs["Vector"])
    big = N.new("ShaderNodeTexNoise"); big.inputs["Scale"].default_value = 9; big.inputs["Detail"].default_value = 3; L.new(pos, big.inputs["Vector"])
    wave = N.new("ShaderNodeTexWave"); wave.bands_direction = 'DIAGONAL'; wave.inputs["Scale"].default_value = 85; wave.inputs["Distortion"].default_value = 0; L.new(pos, wave.inputs["Vector"])
    dash = M('GREATER_THAN', wave.outputs["Fac"], 0.5)
    seamv = N.new("ShaderNodeTexVoronoi"); seamv.feature = 'DISTANCE_TO_EDGE'; seamv.inputs["Scale"].default_value = 3.2; L.new(pos, seamv.inputs["Vector"])
    seamD = seamv.outputs["Distance"]
    seamM = band(seamD, -1.0, 0.010, 0.003)
    seamSt = M('MULTIPLY', band(seamD, 0.022, 0.032, 0.002), dash)
    trimM = band(edge, -1.0, 0.011)
    stitch = M('MAXIMUM', M('MAXIMUM', M('MULTIPLY', band(edge, 0.0125, 0.0165, 0.0005), dash), M('MULTIPLY', band(strapd, 0.0108, 0.0135, 0.0005), dash)), seamSt)
    strapM = band(strapd, -1.0, 0.016)
    bucM = band(buck, -1.0, 0.020, 0.001); bucHole = band(buck, -1.0, 0.0065, 0.001)
    metM = M('MULTIPLY', bucM, M('SUBTRACT', 1.0, bucHole)); met = M('MULTIPLY', metM, 0.45)   # part-metal: full metal read black without sky
    wear = M('MAXIMUM', M('MULTIPLY', band(edge, -1.0, 0.005, 0.002), 0.75), M('MULTIPLY', M('MULTIPLY', band(edge, -1.0, 0.03, 0.01), M('GREATER_THAN', noise.outputs["Fac"], 0.62)), 0.45))
    base = mix(layer, lin(PAL[main]), lin(PAL[acc]))
    base = mix(trimM, base, lin(PAL[trim]))
    base = mix(strapM, base, lin(PAL[strp]))
    tt = M('MULTIPLY', MA(noise.outputs["Fac"], 0.25, 0.87), MA(big.outputs["Fac"], 0.3, 0.85))
    cm = N.new("ShaderNodeCombineColor")
    for i in range(3): L.new(tt, cm.inputs[i])
    shade = N.new("ShaderNodeMix"); shade.data_type = 'RGBA'; shade.blend_type = 'MULTIPLY'; shade.inputs[0].default_value = 1.0
    L.new(base, shade.inputs[6]); L.new(cm.outputs[0], shade.inputs[7])
    col = mix(wear, shade.outputs[2], lin(PAL["tan"]))
    col = mix(M('MULTIPLY', seamM, 0.7), col, lin(PAL["dark"]))
    col = mix(stitch, col, lin(PAL["linen"]))
    col = mix(metM, col, lin(PAL[metal]))
    col = mix(bucHole, col, tuple(0.6 * x for x in lin(PAL[strp])[:3]) + (1.0,))   # strap leather seen through the frame, not a black hole
    L.new(col, bsdf.inputs["Base Color"])
    rough = M('ADD', M('MULTIPLY', met, -0.4), MA(noise.outputs["Fac"], 0.15, 0.62))
    L.new(rough, bsdf.inputs["Roughness"]); L.new(met, bsdf.inputs["Metallic"])
    hgt = M("MULTIPLY", vor.outputs["Distance"], 0.12)
    hgt = M('ADD', hgt, M('MULTIPLY', band(edge, 0.010, 0.0125, 0.0008), -0.6))
    hgt = M('ADD', hgt, M('MULTIPLY', strapM, 0.7))
    hgt = M('ADD', hgt, M('MULTIPLY', stitch, 0.5))
    hgt = M('ADD', hgt, M('MULTIPLY', seamM, -0.8))
    hgt = M('ADD', hgt, metM)
    bump = N.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 1.0; bump.inputs["Distance"].default_value = 0.004
    L.new(hgt, bump.inputs["Height"]); L.new(bump.outputs[0], bsdf.inputs["Normal"])
    return m

def bake(obj, name, size):
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 2
    m = obj.data.materials[0]; nt = m.node_tree; N = nt.nodes
    imgs = {}
    for kind in ("albedo", "normal", "mr"):
        img = bpy.data.images.new(name + "_" + kind, size, size, alpha=False)
        if kind != "albedo": img.colorspace_settings.name = 'Non-Color'
        tn = N.new("ShaderNodeTexImage"); tn.image = img
        for n in N: n.select = False
        tn.select = True; N.active = tn
        bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active = obj
        if kind == "albedo":
            sc.render.bake.use_pass_direct = False; sc.render.bake.use_pass_indirect = False; sc.render.bake.use_pass_color = True
            bpy.ops.object.bake(type='DIFFUSE', margin=8)
        elif kind == "normal":
            bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT', margin=8)
        else:
            bsdf = next(n for n in N if n.type == 'BSDF_PRINCIPLED'); out = next(n for n in N if n.type == 'OUTPUT_MATERIAL')
            em = N.new("ShaderNodeEmission"); cc = N.new("ShaderNodeCombineColor")
            nt.links.new(bsdf.inputs["Roughness"].links[0].from_socket, cc.inputs[1]); nt.links.new(bsdf.inputs["Metallic"].links[0].from_socket, cc.inputs[2])
            nt.links.new(cc.outputs[0], em.inputs[0]); nt.links.new(em.outputs[0], out.inputs[0])
            bpy.ops.object.bake(type='EMIT', margin=8)
            nt.links.new(bsdf.outputs[0], out.inputs[0])
        img.filepath_raw = "%s/%s_%s.png" % (OUT, name, kind); img.file_format = 'PNG'; img.save()
        N.remove(tn); imgs[kind] = img
    fm = bpy.data.materials.new(name); fm.use_nodes = True; F = fm.node_tree.nodes; FL = fm.node_tree.links
    b = F["Principled BSDF"]
    a = F.new("ShaderNodeTexImage"); a.image = imgs["albedo"]; FL.new(a.outputs[0], b.inputs["Base Color"])
    nn = F.new("ShaderNodeTexImage"); nn.image = imgs["normal"]; nm = F.new("ShaderNodeNormalMap"); FL.new(nn.outputs[0], nm.inputs["Color"]); FL.new(nm.outputs[0], b.inputs["Normal"])
    mm = F.new("ShaderNodeTexImage"); mm.image = imgs["mr"]; sp = F.new("ShaderNodeSeparateColor"); FL.new(mm.outputs[0], sp.inputs[0])
    FL.new(sp.outputs[1], b.inputs["Roughness"]); FL.new(sp.outputs[2], b.inputs["Metallic"])
    obj.data.materials.clear(); obj.data.materials.append(fm)

def strap_planes(slot, t):
    S = []
    def limb(n, f):
        for sd in ("Left", "Right"):
            p, d = bfrac(sd + n, f); S.append((p, d, 1 if p.x > 0 else -1))
    if slot == "chest" and t >= 2:
        S.append((bone("Spine1")[0] + Vector((0, 0, 0.02)), Vector((0.75, 0, 0.66)).normalized(), 0))
        if t == 3: S.append((bone("Spine1")[0], Vector((-0.75, 0, 0.66)).normalized(), 0))
    if slot == "feet":
        limb("Leg", 0.80)
        if t >= 2: limb("Leg", 0.90)
    if slot == "wrists":
        for f in ((0.62, 0.84) if t >= 2 else (0.72,)): limb("ForeArm", f)
    if slot == "hands": limb("ForeArm", 0.86)
    if slot == "legs" and t >= 2: limb("UpLeg", 0.55)
    if slot == "shoulders" and t >= 2: limb("Arm", 0.18)
    return S

def buckle_points(bm, slot, t):
    pts = []
    def front_at(z):
        best = None
        for v in bm.verts:
            if abs(v.co.z - z) < 0.03 and abs(v.co.x) < 0.03:
                s = v.co.dot(FWD)
                if best is None or s > best[0]: best = (s, v.co.copy())
        return best[1] if best else None
    if slot == "waist":
        z = sum(v.co.z for v in bm.verts) / max(1, len(bm.verts)); p = front_at(z)
        if p: pts.append(p)
    if slot == "chest" and t >= 2:
        p = front_at(bone("Spine1")[0].z + 0.02)
        if p: pts.append(p)
    if slot == "feet":
        for sd in ("Left", "Right"):
            p, d = bfrac(sd + "Leg", 0.80); so = Vector((1 if p.x > 0 else -1, 0, 0))
            cand = [v for v in bm.verts if abs((v.co - p).dot(d)) < 0.015 and (v.co.x > 0) == (p.x > 0)]
            if cand: pts.append(max(cand, key=lambda v: v.co.dot(so)).co.copy())
    return pts

def fields(bm, slot, t):
    ed = edge_dist(bm)
    lay = {}
    for a in ("edge", "strap", "buckle", "layer"):
        lay[a] = bm.verts.layers.float.get(a) or bm.verts.layers.float.new(a)
    S = strap_planes(slot, t); B = buckle_points(bm, slot, t)
    for v in bm.verts:
        v[lay["edge"]] = ed.get(v, 1.0)
        s = 1.0
        for p, n, sd in S:
            if sd and (v.co.x > 0) != (sd > 0): continue
            s = min(s, abs((v.co - p).dot(n)))
        v[lay["strap"]] = s
        v[lay["buckle"]] = min([1.0] + [(v.co - p).length for p in B])

def to_object(bm, name):
    mesh = bpy.data.meshes.new(name); bm.to_mesh(mesh)
    obj = bpy.data.objects.new(name, mesh); bpy.context.scene.collection.objects.link(obj)
    return obj

def finish(obj, slot, t, body_weights=True):
    if len(obj.data.polygons) == 0:
        print('EMPTY', slot, t, flush=True); return
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.01)
    bpy.ops.object.mode_set(mode='OBJECT')
    for p in obj.data.polygons: p.use_smooth = True
    obj.data.materials.clear(); obj.data.materials.append(leather_mat("proc_%s_t%d" % (slot, t), LOOK[t][slot]))
    size = TEX if slot in ("chest", "legs", "shoulders", "head") else TEX // 2
    bake(obj, "leather_t%d_%s" % (t, slot), size)
    for a in ("edge", "strap", "buckle", "layer", "ox", "oy", "oz"):
        if obj.data.attributes.get(a): obj.data.attributes.remove(obj.data.attributes[a])
    so = obj.modifiers.new("thick", 'SOLIDIFY'); so.thickness = TH[slot]; so.offset = 1.0; so.use_even_offset = False; so.use_quality_normals = True; so.use_rim = True
    bpy.ops.object.modifier_apply(modifier="thick")
    a = obj.modifiers.new("Armature", 'ARMATURE'); a.object = rig
    if body_weights:
        for g in obj.vertex_groups:
            if any(g.name == P + s + j for s in ("Left", "Right", "") for j in JOINTS):
                obj.vertex_groups.active_index = g.index
                bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
                bpy.ops.object.vertex_group_smooth(group_select_mode='ACTIVE', factor=0.3, repeat=2)
                bpy.ops.object.mode_set(mode='OBJECT')
        if slot == "hands":
            # mitten glove over fused fingers: hard per-finger weights folded the palm into shards in the fist, so
            # blend hand/finger weights across neighbours for a soft bend
            for g in obj.vertex_groups:
                if "Hand" in g.name:
                    obj.vertex_groups.active_index = g.index
                    bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
                    bpy.ops.object.vertex_group_smooth(group_select_mode='ACTIVE', factor=0.5, repeat=int(os.environ.get("HM_GLOVE_SMOOTH", "16")))
                    bpy.ops.object.mode_set(mode='OBJECT')
        bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
        bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); rig.select_set(True)
    bpy.ops.export_scene.gltf(filepath="%s/t%d_%s.glb" % (OUT, t, slot), use_selection=True, export_animations=False, export_skins=True, export_yup=True, export_image_format='JPEG', export_image_quality=90)
    print("BUILT", slot, t, len(obj.data.vertices), flush=True); obj.hide_set(True); obj.hide_render = True

def body_groups(obj):
    for gi in sorted(gname): obj.vertex_groups.new(name=P + gname[gi])
    vgs = list(obj.vertex_groups)
    oa = [obj.data.attributes.get(a) for a in ("ox", "oy", "oz")]
    for v in obj.data.vertices:
        q = Vector([oa[k].data[v.index].value for k in range(3)]) if all(oa) else v.co
        if q.length < 1e-6: q = v.co   # appended authored parts (kneeguards) carry no smoothbody position
        _, idx, _ = KD.find(q)
        for g in me.vertices[idx].groups:
            if g.weight > 0: vgs[g.group].add([v.index], g.weight, 'REPLACE')

def build(slot, t):
    name = "%s_t%d" % (slot, t)
    if slot == "head":
        bm = head_hood(t); fields(bm, slot, t)
        obj = to_object(bm, name)
        hg = obj.vertex_groups.new(name=P + "Head"); ng = obj.vertex_groups.new(name=P + "Neck")
        for v in obj.data.vertices:
            w = max(0.0, min(1.0, (v.co.z - (neckz - 0.03)) / max(0.01, headz - (neckz - 0.03))))
            hg.add([v.index], w, 'REPLACE'); ng.add([v.index], 1 - w, 'REPLACE')
        finish(obj, slot, t, body_weights=False); return
    if slot == "waist":
        # belt: every torso face in the band (not dominant-bone faces, whose boundary zig-zagged under the hem), the two
        # plane cuts then give clean top/bottom loops; arms hanging beside the hips are excluded by side distance
        def wsel(f):
            c = f.calc_center_median()
            return abs(c.x) < 0.19 and hipz - 0.08 < c.z < hipz + 0.14 and not any(dom[v.index].startswith(("Hand", "ForeArm", "Arm")) for v in f.verts)
        bm = shell(slot, t, sel=wsel)
    else:
        bm = shell(slot, t) if slot != "shoulders" else bmesh.new()
    if slot == "shoulders":
        bm.free(); bm = bmesh.new()
        for sd in ("Left", "Right"):
            p1 = pauldron(sd, t); append(bm, p1, 0.0); p1.free()
            if t >= 2: p2 = pauldron(sd, t, True); append(bm, p2, 1.0); p2.free()
    elif slot == "legs":
        offset(bm, OFF[slot])
        if t >= 2:
            for sd in ("Left", "Right"):
                k2 = kneeguard(sd, t); append(bm, k2, 1.0); k2.free()
    else:
        if slot in ("hands", "feet"):
            for _ in range(4): bmesh.ops.smooth_vert(bm, verts=[v for v in bm.verts if not v.is_boundary], factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
            if slot == "hands":   # glove: volume-kept relax so the knuckle/vein sculpt of the bare hand doesn't read as lumps
                for _ in range(10): bmesh.ops.smooth_laplacian_vert(bm, verts=[v for v in bm.verts if not v.is_boundary], lambda_factor=0.4, lambda_border=0.0, use_x=True, use_y=True, use_z=True, preserve_volume=True)
        offset(bm, OFF[slot] + (0.002 * (t - 1) if slot == "chest" else 0))
        if slot == "chest" and t == 3:
            lay = bm.verts.layers.float.get("layer") or bm.verts.layers.float.new("layer")
            for v in bm.verts: v[lay] = 1.0 if v.co.z > bone("Spine2")[0].z + 0.04 else 0.0
    fields(bm, slot, t)
    obj = to_object(bm, name)
    for g in list(obj.vertex_groups): obj.vertex_groups.remove(g)
    body_groups(obj)
    finish(obj, slot, t)

SLOTS = ["chest", "waist", "legs", "feet", "hands", "wrists", "shoulders", "head"]
only = os.environ.get("HM_SLOT"); tiers = [int(x) for x in os.environ.get("HM_TIERS", "1,2,3").split(",")]
for t in tiers:
    for s in SLOTS:
        if only and s not in only.split(","): continue
        build(s, t)
bpy.ops.wm.save_as_mainfile(filepath=OUT + "/leather_fitted.blend")
