import bpy, sys, math
from mathutils import Vector
OUT = "/workspace/hm_bug/fitted"
bpy.ops.wm.open_mainfile(filepath=OUT + "/leather_fitted.blend")
sc = bpy.context.scene; sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x, sc.render.resolution_y = 500, 900
w = sc.world or bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.35, 0.35, 0.37, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 1.0
for n, rot, e in (("key", (50, 0, 30), 4), ("fill", (60, 0, 200), 2)):
    l = bpy.data.lights.new(n, 'SUN'); l.energy = e; o = bpy.data.objects.new(n, l); sc.collection.objects.link(o); o.rotation_euler = [math.radians(a) for a in rot]
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 85
import os; NOBODY = os.environ.get("NOBODY") == "1"
pose = sys.argv[sys.argv.index("--")+1] if "--" in sys.argv else ""
for t in (1, 2, 3):
    for o in bpy.data.objects:
        if o.type == 'MESH': o.hide_render = not ((o.name == "hero" and not NOBODY) or o.name.endswith("_t%d" % t)); o.hide_set(False)
    for i, ang in enumerate((0, 90, 180)):
        a = math.radians(ang); d = 6.5
        cam.location = (math.sin(a) * d, -math.cos(a) * d, 0.95); cam.rotation_euler = (math.radians(90), 0, a)
        sc.render.filepath = "%s/prev%s_t%d_%d.png" % (OUT, "nb" if NOBODY else "", t, ang); bpy.ops.render.render(write_still=True)
