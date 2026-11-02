import bpy,mathutils,sys,json,math
A=sys.argv[sys.argv.index('--')+1:]; path,out,side,pose=A[0],A[1],A[2],json.loads(A[3])
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=path)
arm=bpy.data.objects['hero_rig']; arm.animation_data.action=None if arm.animation_data else None
for bn,e in pose.items():
    pb=arm.pose.bones.get(bn)
    if pb: pb.rotation_mode='XYZ'; pb.rotation_euler=mathutils.Euler([math.radians(x) for x in e])
bpy.context.view_layer.update()
me=bpy.data.objects['hero']; g=me.vertex_groups['mixamorig:%sHand'%side].index
idx=[v.index for v in me.data.vertices if any(x.group==g and x.weight>0.3 for x in v.groups)]
import statistics
c=sum((me.matrix_world@me.data.vertices[i].co for i in idx),mathutils.Vector())/len(idx)
sc=bpy.context.scene; sc.render.engine='BLENDER_WORKBENCH'; sc.render.resolution_x=sc.render.resolution_y=400
for i,d in enumerate([(1,0,0),(0,-1,0),(-1,0,0),(0,1,0)]):
    cd=bpy.data.cameras.new('c'); co=bpy.data.objects.new('c',cd); sc.collection.objects.link(co)
    co.location=c+mathutils.Vector(d)*0.35; co.rotation_euler=(c-co.location).to_track_quat('-Z','Z').to_euler()
    sc.camera=co; sc.render.filepath=out+'_%d.png'%i; bpy.ops.render.render(write_still=True)
