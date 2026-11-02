import bpy,mathutils,numpy as np,collections,sys
SRC='/workspace/hm_bug/backup/hero.orig.glb'; OUT=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
me=bpy.data.objects['hero']; arm=bpy.data.objects['hero_rig']; M=me.data
key={v.index:tuple(round(c,4) for c in v.co) for v in M.vertices}
grp=collections.defaultdict(list)
for i,k in key.items(): grp[k].append(i)
adj=collections.defaultdict(set)
for e in M.edges: a,b=e.vertices; adj[a].add(b); adj[b].add(a)
for l in grp.values():
    for i in l: adj[i].update(j for j in l if j!=i)
def comps(keep):
    seen=set(); out=[]
    for v in keep:
        if v in seen: continue
        st=[v]; c=[]; seen.add(v)
        while st:
            x=st.pop(); c.append(x)
            for y in adj[x]:
                if y in keep and y not in seen: seen.add(y); st.append(y)
        out.append(c)
    return sorted(out,key=len,reverse=True)
plan={}
def hg_w(g,i):
    return max([x.weight for x in M.vertices[i].groups if x.group==g] or [0])
for side in ['Right','Left']:
    bn='mixamorig:%sHand'%side; g=me.vertex_groups[bn].index
    H=[v.index for v in M.vertices if any(x.group==g and x.weight>0.05 for x in v.groups)]
    co={i:np.array(M.vertices[i].co[:]) for i in H}
    P=np.array([co[i] for i in H]); w=np.array(arm.data.bones[bn].head_local[:])
    f=np.linalg.svd(P-P.mean(0),full_matrices=False)[2][0]
    if (P.mean(0)-w)@f<0: f=-f
    a={i:(co[i]-w)@f for i in H}; amin=min(a.values()); amax=max(a.values()); span=amax-amin
    H3=set(i for i in H if hg_w(g,i)>0.5)
    cs=comps(set(i for i in H3 if a[i]>amin+0.45*span))
    print(side,"comps",[len(c) for c in cs[:5]])
    thumb=set(cs[1]) if len(cs)>1 and len(cs[1])>20 else set()
    ak=amin+0.55*span
    fing=[i for i in cs[0] if a[i]>ak-0.02]
    F=np.array([co[i] for i in fing]); k=np.linalg.svd(F-F.mean(0),full_matrices=False)[2]
    k=k[0] - (k[0]@f)*f; k/=np.linalg.norm(k)
    tc=np.mean([co[i] for i in thumb],0) if thumb else F.mean(0)+k
    if (tc-F.mean(0))@k<0: k=-k   # +k toward thumb => index side
    nn=np.cross(f,k); nv={i:(co[i]-w)@nn for i in H3}
    tipn=np.mean([nv[i] for i in H3 if a[i]>amin+0.8*span])
    mid=[i for i in H3 if amin+0.3*span<a[i]<amin+0.75*span]
    t0=max(mid,key=lambda i:abs(nv[i]-tipn)); sg=np.sign(nv[t0]-tipn)
    ok=lambda i: i in H3 and sg*(nv[i]-tipn)>0.012
    thumb=set([t0]); st=[t0] if side=='Right' else []
    if side!='Right': thumb=set()
    while st:
        x=st.pop()
        for y in adj[x]:
            if y not in thumb and ok(y): thumb.add(y); st.append(y)
    fing=[i for i in fing if i not in thumb]
    ktmax=0
    print(side,'thumb by k',len(thumb),'ktmax',ktmax)
    kv={i:(co[i]-w)@k for i in fing}; ks=np.array(sorted(kv.values()))
    # 1D kmeans 4 clusters
    cen=np.quantile(ks,[0.125,0.375,0.625,0.875])
    for _ in range(30):
        lab={i:int(np.argmin(abs(cen-kv[i]))) for i in fing}
        cen=np.array([np.mean([kv[i] for i in fing if lab[i]==c] or [cen[c]]) for c in range(4)])
    names=['Pinky','Ring','Middle','Index']  # ascending k: away from thumb first
    plan[side]=dict(bn=bn,w=w,f=f,k=k,ak=ak,amax=amax,fing=fing,lab=lab,cen=cen,names=names,thumb=sorted(thumb),a=a,co=co,H=H)
    print(side,'thumbN',len(thumb),'H',len(H),'fing',len(fing),'thumb',len(thumb),'clusters',[sum(1 for i in fing if lab[i]==c) for c in range(4)])
# build bones
bpy.context.view_layer.objects.active=arm; bpy.ops.object.mode_set(mode='EDIT'); eb=arm.data.edit_bones
V=lambda x:mathutils.Vector(x.tolist())
for side,p in plan.items():
    par=eb[p['bn']]; w,f,k=p['w'],p['f'],p['k']
    for c,nm in enumerate(p['names']):
        ids=[i for i in p['fing'] if p['lab'][i]==c]; if_=np.array([p['co'][i] for i in ids])
        L=max(p['a'][i] for i in ids)-p['ak']; base=w+f*p['ak']+k*p['cen'][c]
        # lift to mean height (n) of the finger
        n=np.cross(f,k); base=base+n*np.mean((if_-w)@n)
        p.setdefault('L',{})[nm]=L
        prev=par
        for j in range(3):
            b=eb.new('mixamorig:%sHand%s%d'%(side,nm,j+1)); b.head=V(base+f*L*j/3); b.tail=V(base+f*L*(j+1)/3); b.align_roll(V(n)); b.parent=prev; b.use_connect=j>0; prev=b
    if p['thumb']:
        T=np.array([p['co'][i] for i in p['thumb']]); tf=np.linalg.svd(T-T.mean(0),full_matrices=False)[2][0]
        if (T.mean(0)-w)@tf<0: tf=-tf
        ta=(T-w)@tf; base=T.mean(0)+tf*(ta.min()-ta.mean()); tl=ta.max()-ta.min()
        prev=par
        for j in range(2):
            b=eb.new('mixamorig:%sHandThumb%d'%(side,j+1)); b.head=V(base+tf*tl*j/2); b.tail=V(base+tf*tl*(j+1)/2); b.align_roll(V(np.cross(f,k))); b.parent=prev; b.use_connect=j>0; prev=b
        p['tf']=tf; p['tbase']=base; p['tl']=tl
bpy.ops.object.mode_set(mode='OBJECT')
# weights
def vg(n): return me.vertex_groups.get(n) or me.vertex_groups.new(name=n)
for side,p in plan.items():
    hg=me.vertex_groups[p['bn']]
    def split(i,parts):
        wh=hg.weight(i); tot=sum(parts.values())
        hg.add([i],wh*(1-tot),'REPLACE')
        for n,x in parts.items():
            if x>0: vg(n).add([i],wh*x,'ADD')
    for c,nm in enumerate(p['names']):
        L=p['L'][nm]
        for i in p['fing']:
            if p['lab'][i]!=c: continue
            t=(p['a'][i]-p['ak'])/L
            s=lambda lo,hi: min(1,max(0,(t-lo)/(hi-lo)))
            w1=s(-0.10,0.05); w2=s(0.28,0.38); w3=s(0.62,0.72)
            parts={'mixamorig:%sHand%s1'%(side,nm):w1-w2,'mixamorig:%sHand%s2'%(side,nm):w2-w3,'mixamorig:%sHand%s3'%(side,nm):w3}
            split(i,parts)
    for i in p['thumb']:
        t=((p['co'][i]-p['tbase'])@p['tf'])/max(p['tl'],1e-4); w1=min(1,max(0,(t+0.05)/0.25)); w2=min(1,max(0,(t-0.45)/0.15))
        split(i,{'mixamorig:%sHandThumb1'%side:w1-w2,'mixamorig:%sHandThumb2'%side:w2})
import math
act=bpy.data.actions.new('grip_fist'); arm.animation_data_create(); old=arm.animation_data.action; arm.animation_data.action=act
for side in ['Right','Left']:
    for fn in ['Index','Middle','Ring','Pinky']:
        for j,ang in zip((1,2,3),(75,90,60)):
            pb=arm.pose.bones['mixamorig:%sHand%s%d'%(side,fn,j)]; pb.rotation_mode='QUATERNION'
            pb.rotation_quaternion=mathutils.Euler((-math.radians(ang),0,0)).to_quaternion()
            for fr in (0,1): pb.keyframe_insert('rotation_quaternion',frame=fr)
    for j,ang in ((1,40),(2,48)):
        pb=arm.pose.bones.get('mixamorig:%sHandThumb%d'%(side,j))
        if pb is None: continue
        pb.rotation_mode='QUATERNION'; pb.rotation_quaternion=mathutils.Euler((-math.radians(ang),0,0)).to_quaternion()
        for fr in (0,1): pb.keyframe_insert('rotation_quaternion',frame=fr)
arm.animation_data.action=old
for pb in arm.pose.bones: pb.rotation_quaternion=(1,0,0,0)
act.use_fake_user=True
for ac in bpy.data.actions:
    if ac.name.endswith('_hero_rig'): ac.name=ac.name[:-9]
bpy.ops.export_scene.gltf(filepath=OUT,export_format='GLB',export_animation_mode='ACTIONS',export_apply=False,export_yup=True)
print('EXPORTED',OUT)
