import bpy,mathutils,sys
path=sys.argv[sys.argv.index('--')+1]; out=sys.argv[sys.argv.index('--')+2]; side=sys.argv[sys.argv.index('--')+3]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)
arm=bpy.data.objects['hero_rig']
for o in bpy.data.objects:
    if o.type=='ARMATURE' and o.animation_data: o.animation_data.action=None
pose=sys.argv[sys.argv.index('--')+4] if len(sys.argv)>sys.argv.index('--')+4 else ''
if pose:
    import json
    for bn,ang in json.loads(pose).items():
        pb=arm.pose.bones.get(bn)
        if pb: pb.rotation_mode='XYZ'; pb.rotation_euler=mathutils.Euler((ang*3.14159/180,0,0))
bpy.context.view_layer.update()
me=bpy.data.objects['hero']; g=me.vertex_groups['mixamorig:%sHand'%side].index
dg=bpy.context.evaluated_depsgraph_get(); ev=me.evaluated_get(dg); m2=ev.to_mesh()
idx=[v.index for v in me.data.vertices if any(x.group==g and x.weight>0.5 for x in v.groups)]
c=sum((me.matrix_world@m2.vertices[i].co for i in idx),mathutils.Vector())/len(idx)
sc=bpy.context.scene; sc.render.engine='BLENDER_WORKBENCH'; sc.render.resolution_x=sc.render.resolution_y=600
cams=[]
for i,d in enumerate([(1,0,0),(0,-1,0),(-1,0,0),(0,1,0)]):
    cd=bpy.data.cameras.new('c'); co=bpy.data.objects.new('c',cd); sc.collection.objects.link(co)
    co.location=c+mathutils.Vector(d)*0.35; co.rotation_euler=(c-co.location).to_track_quat('-Z','Z').to_euler()
    sc.camera=co; sc.render.filepath=out+'_%d.png'%i; bpy.ops.render.render(write_still=True)
