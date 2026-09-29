"""Foes and bosses: sprite -> front reference (image-to-image) -> 3D model ->
rig (humanoids). Resumable: each step's task JSON is kept in OUT/<id>/."""
import json, os, sys, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import meshy
sys.path.insert(0, sys.argv[2] if len(sys.argv) > 2 else '.')
from prep import clean

ART = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'art-src')
OUT = sys.argv[1]
H = 'Character turnaround reference for a 3D model: the exact same {d} from the reference image, same design, clothing, weapon, colours and gothic hand-painted style, shown full body from the FRONT facing the camera, standing straight in a neutral A-pose with arms held slightly away from the body and legs slightly apart{w}, plain white background, even flat lighting, no shadow, no text.'
N = '3D model reference: the exact same {d} from the reference image, same design, colours and gothic hand-painted style, shown whole in a clear three-quarter front view standing on the ground, plain white background, even flat lighting, no shadow, no text.'
ROSTER = [
  # id, sprite, humanoid height (m) or 0, description, weapon clause
  ('archer', 'enemy_archer', 1.8, 'skeleton archer in a rotting burial shroud hood', ', the bone bow held in the left hand pointing down'),
  ('orc', 'enemy_orc', 2.3, 'hulking tusked orc brute', ', the spiked stone club held in the right hand pointing down'),
  ('croupier', 'enemy_croupier', 1.8, 'undead casino croupier', ', the fan of cards in one hand and the slot-machine lever arm hanging at the side'),
  ('taxman', 'enemy_taxman', 1.8, 'bloated undead tax collector', ', the chained ledger hanging from the wrist'),
  ('mirror', 'enemy_mirror', 2.1, 'mirror wight spectre with a cracked hand-mirror for a face', ''),
  ('ironclad', 'enemy_ironclad', 2.3, 'ironclad husk in rusted riveted iron plate', ', the huge iron cleaver held in the right hand pointing down'),
  ('abom', 'enemy_abom', 2.4, 'stitched flesh abomination', ''),
  ('reaper', 'enemy_reaper', 2.6, 'hooded skeletal Reaper', ', the enormous scythe held upright in the right hand'),
  ('boneking', 'boss_boneking', 2.8, 'skeletal Bone King in a rotted crimson mantle and crooked crown', ', the bone greatsword held in the right hand pointing down'),
  ('lich', 'boss_lich', 2.2, 'Dice Lich sorcerer in tattered black and gold robes', ', the staff held upright in the right hand'),
  ('labfreak', 'boss_labfreak', 1.75, 'mad scientist Dr. Labfreak in a blood-stained lab coat', ''),
  ('labfreak2', 'boss_labfreak2', 2.8, 'hulking mutated Dr. Labfreak', ''),
  ('homunculus', 'enemy_homunculus', 1.0, 'small hunched homunculus with an oversized bald head', ''),
  ('rat', 'enemy_rat', 0, 'bloated plague rat', ''),
  ('slime', 'enemy_slime', 0, 'mass of translucent green ooze with a skull and coins inside', ''),
  ('wraith', 'enemy_wraith', 0, 'legless floating coin wraith in black grave-shrouds', ''),
  ('mimic', 'enemy_mimic', 0, 'mimic treasure chest with a fanged maw', ''),
  ('brainjar', 'enemy_brainjar', 0, 'brain in a glass jar on four brass spider legs', ''),
  ('bandit', 'boss_bandit', 0, 'One-Armed Bandit, a living cursed iron slot machine with a lever arm', ''),
]

def step(dirp, name, fn):
    p = os.path.join(dirp, name + '.json')
    if os.path.exists(p):
        d = json.load(open(p))
        if d.get('status') == 'SUCCEEDED': return d
    d = fn()
    json.dump(d, open(p, 'w'))
    return d

def run(c):
    cid, sprite, h, desc, weap = c
    d = os.path.join(OUT, cid); os.makedirs(d, exist_ok=True)
    src = os.path.join(d, 'src.png')
    if not os.path.exists(src): clean(os.path.join(ART, sprite + '.webp'), src)
    prompt = (H.format(d=desc, w=weap) if h else N.format(d=desc))
    ref = step(d, 'ref', lambda: meshy.wait('v1/image-to-image', meshy.create('v1/image-to-image', {
        'ai_model': 'nano-banana-2', 'reference_image_urls': [meshy.data_uri(src)], 'prompt': prompt, 'aspect_ratio': '3:4' if h else '1:1'}, cid + ':ref'), every=5))
    if ref['status'] != 'SUCCEEDED': return cid, 'ref ' + ref['status']
    refp = os.path.join(d, 'ref.png')
    if not os.path.exists(refp): meshy.fetch(ref['image_urls'][0], refp)
    mod = step(d, 'model', lambda: meshy.wait('v1/image-to-3d', meshy.create('v1/image-to-3d', {
        'image_url': meshy.data_uri(refp), 'ai_model': 'latest', 'should_remesh': True, 'topology': 'triangle',
        'target_polycount': 15000 if h else 12000, 'should_texture': True, 'enable_pbr': True, 'target_formats': ['glb']}, cid + ':model'), every=10))
    if mod['status'] != 'SUCCEEDED': return cid, 'model ' + mod['status']
    if not os.path.exists(os.path.join(d, 'thumb.png')): meshy.fetch(mod['thumbnail_url'], os.path.join(d, 'thumb.png'))
    if not os.path.exists(os.path.join(d, 'model.glb')): meshy.fetch(mod['model_urls']['glb'], os.path.join(d, 'model.glb'))
    if not h: return cid, 'static ok'
    rig = step(d, 'rig', lambda: meshy.wait('v1/rigging', meshy.create('v1/rigging', {'input_task_id': mod['id'], 'height_meters': h}, cid + ':rig'), every=8))
    if rig['status'] != 'SUCCEEDED': return cid, 'rig ' + rig['status'] + ' ' + str(rig.get('task_error'))
    if not os.path.exists(os.path.join(d, 'rigged.glb')): meshy.fetch(rig['result']['rigged_character_glb_url'], os.path.join(d, 'rigged.glb'))
    return cid, 'rigged ok'

if __name__ == '__main__':
    only = os.environ.get('ONLY')
    todo = [c for c in ROSTER if not only or c[0] in only.split(',')]
    with cf.ThreadPoolExecutor(4) as ex:
        futs = {ex.submit(run, c): c[0] for c in todo}
        for f in cf.as_completed(futs):
            try: print(f.result(), flush=True)
            except Exception as e: print(futs[f], 'ERROR', e, flush=True)
    print('balance', meshy.balance(), flush=True)
