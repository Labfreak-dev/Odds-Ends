# Workbench preview strips of Rig_Medium clips on the KayKit class heroes (fast by-eye iteration before Unity).
import bpy, math, os, json
from mathutils import Vector, Matrix
import hmanim as H

LOOKS = {'knight': ('Knight', 'sword_1handed', 'shield_badge_color'), 'ranger': ('Ranger', None, 'bow_withString'),
         'mage': ('Mage', 'staff', None)}
TILES = '/tmp/animwork/tiles'


def setup():
    sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'; sh.show_shadows = True; sh.show_cavity = False
    sh.show_object_outline = True; sh.object_outline_color = (0.05, 0.05, 0.08)
    sc.render.resolution_x = 360; sc.render.resolution_y = 400; sc.render.film_transparent = False
    sc.world = bpy.data.worlds.new('w') if not sc.world else sc.world
    sh.background_type = 'VIEWPORT'; sh.background_color = (0.16, 0.17, 0.2)
    bpy.ops.mesh.primitive_plane_add(size=8); fl = bpy.context.object; fl.name = 'floor'
    m = bpy.data.materials.new('floor'); m.diffuse_color = (0.36, 0.37, 0.42, 1); fl.data.materials.append(m)
    # 0.5 m grid lines (scale reference) as thin boxes
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.lens = 50
    return cam


def load(cls, x=0.0):
    char, wr, wl = LOOKS[cls]
    objs = H.imp_fbx(f'{H.ST}/Chars/{char}.fbx'); arm = H.arm_of(objs); arm.name = 'arm_' + cls
    arm.location.x = x
    # FBX import marks hips as 'connected', so Blender would ignore hips translation (Unity applies it): disconnect all
    bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT')
    for eb in arm.data.edit_bones: eb.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    for w, slot in ((wr, 'handslot.r'), (wl, 'handslot.l')):
        if not w: continue
        wo = H.imp_fbx(f'{H.ST}/Weapons/{w}.fbx')
        root = [o for o in wo if o.parent is None][0]
        c = root.constraints.new('CHILD_OF'); c.target = arm; c.subtarget = slot
        c.inverse_matrix = Matrix.Identity(4)
        root.location = (0, 0, 0); root.rotation_euler = (0, 0, 0)
        if w.startswith('bow'): root.rotation_euler = (math.radians(-45), 0, 0); root.scale = (0.75,) * 3
    arm.animation_data_create()
    return arm


def frame_cam(cam, target, yaw_deg, dist=5.2, h=1.3, look_h=0.6):
    # hero faces -Y. yaw 0 = camera in front; +yaw orbits toward the hero's left (+X)
    a = math.radians(yaw_deg); p = Vector((math.sin(a) * dist, -math.cos(a) * dist, h)) + target
    cam.location = p; d = (target + Vector((0, 0, look_h))) - p
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def strip(arm, act, tag, n=8, views=(-55, 25), hits=(), nframes=None):
    """Render n frames x len(views) tiles; returns metadata for the stitcher."""
    sc = bpy.context.scene; cam = sc.camera; arm.animation_data.action = act
    f0, f1 = act.frame_range; L = f1 - f0
    os.makedirs(TILES, exist_ok=True); tiles = []
    for vi, yaw in enumerate(views):
        frame_cam(cam, arm.location.copy(), yaw)
        for i in range(n):
            u = (i + 0.5) / n; f = f0 + u * L
            sc.frame_set(int(math.floor(f)), subframe=f - math.floor(f))
            p = f'{TILES}/{tag}_{vi}_{i}.png'; sc.render.filepath = p; bpy.ops.render.render(write_still=True); tiles.append(p)
    return {'tag': tag, 'n': n, 'views': len(views), 'len': L, 'hits': list(hits)}
