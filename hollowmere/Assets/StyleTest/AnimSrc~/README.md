# Weighted attack clips (Rig_Medium_HMAttacks.fbx) - Blender 4.2 toolkit
Unity ignores this folder (`~`). Sources: KayKit Character Animations 1.1 (repo `Resources/ST/Anim`), Quaternius UAL1/UAL2 Standard glb
(CC0, paths in hmanim.py; download the free tiers from itch to use the retargeter).
    blender -b --python build.py -- --export Rig_Medium_HMAttacks.fbx [--preview all] [--only HM_K_Slash,...]
- hmanim.py: FK/2-bone IK in Rig_Medium armature space (hips translation applied like Unity; preview armatures are disconnected
  so Blender matches), UAL->Rig_Medium world-delta retarget, clip composer (time-warp with eases/holds, additive spine/hips,
  arm IK, foot planting + knee/toe clamps, weapon floor clamp), FBX export (root node Rig_Medium, UnitScaleFactor 100 like KayKit).
- clips.py: the 24 recipes; contact/release frame = skill damage/projectile time x duration x 30.
- Unity side: Editor/StyleTestImport.cs strips root/Rig_Medium node curves from these takes; AnimMap "W.*" keys map to HM_* clips.
