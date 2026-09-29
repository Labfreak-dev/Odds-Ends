"""Hero skins: each hero part (body, weapons) retextured per skin with the
part's own UVs kept, styled by the skin's 2D idle art and its art-pack-26
description. Resumable; outputs WebP maps named <hero>_<skin>_<part>_<map>.webp."""
import json, os, re, sys, subprocess, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import meshy
HERE = os.path.dirname(os.path.abspath(__file__)); LD = os.path.join(HERE, '..')
WORK = sys.argv[1]; NODEJS = sys.argv[2]   # scratch dir, dir holding part.mjs + node_modules
DST = os.path.join(LD, 'death3d', 'assets', 'textures', 'skins')
PARTS = {'knight': [('body', 'Knight_Body'), ('shield', 'Shield'), ('sword', 'Sword')], 'ranger': [('body', 'Ranger_Body'), ('bow', 'Bow')],
  'gambler': [('body', 'Gambler_Body'), ('dagger', 'Dagger')], 'brute': [('body', 'Brute_Body'), ('cleaver', 'Cleaver')],
  'duelist': [('body', 'Duelist_Body'), ('rapier', 'Rapier')], 'hexpriest': [('body', 'Hexpriest_Body'), ('staff', 'Staff')]}
SIZES = {'body': (2048, 1024), 'weapon': (1024, 512)}
sys.path.insert(0, os.path.join(WORK, 'm3')); from prep import clean
from PIL import Image

def skins():
    out = []
    for line in open(os.path.join(LD, 'art-pack26-prompts.txt')):
        m = re.match(r'hero_(\w+?)_(\w+)_idle\.png \| (.*)', line)
        if not m: continue
        hero, sid, txt = m.groups()
        dress = re.search(r're-dressed as (.*?), standing in', txt)
        base = re.search(r'the \w[\w ]*? \((.*?)\)', txt)
        out.append((hero, sid, dress.group(1) if dress else txt[:300], base.group(1) if base else ''))
    return out

def part_glb(hero, node):
    p = os.path.join(WORK, 'parts', f'{hero}_{node}.glb')
    if not os.path.exists(p):
        os.makedirs(os.path.dirname(p), exist_ok=True)
        subprocess.run(['node', os.path.join(NODEJS, 'part.mjs'), os.path.join(LD, 'death3d', 'assets', 'models', f'hero_{hero}.glb'), p, node], cwd=NODEJS, check=True, capture_output=True)
    return p

def extract(glb, prefix, kind):
    """write base/normal/mr WebP from a retextured GLB"""
    sub = os.path.join(WORK, 'x', os.path.basename(prefix)); os.makedirs(sub, exist_ok=True)
    subprocess.run(['node', os.path.join(NODEJS, 'maps.mjs'), glb, sub], cwd=NODEJS, check=True, capture_output=True)
    big, small = SIZES[kind]
    for m, sz, q in (('base', big, 80), ('normal', small, 88), ('mr', small, 88)):
        src = os.path.join(sub, m + '.img')
        if os.path.exists(src):
            Image.open(src).convert('RGB').resize((sz, sz), Image.LANCZOS).save(prefix + f'_{m}.webp', quality=q)

def one(job):
    hero, sid, dress, base, pname, node = job
    prefix = os.path.join(DST, f'{hero}_{sid}_{pname}')
    if os.path.exists(prefix + '_base.webp'): return job[:2] + (pname, 'have')
    d = os.path.join(WORK, 'skins', f'{hero}_{sid}'); os.makedirs(d, exist_ok=True)
    style = os.path.join(d, 'style.png')
    if not os.path.exists(style): clean(os.path.join(LD, 'art-src', f'hero_{hero}_{sid}_idle.webp'), style)
    what = 'the whole outfit and body' if pname == 'body' else f'only the {pname}'
    prompt = f'{dress}. Texture {what} to match this look: dark gothic hand-painted game texture, worn and grim.'[:790]
    rj = os.path.join(d, pname + '.json')
    r = json.load(open(rj)) if os.path.exists(rj) else None
    if not r or r.get('status') != 'SUCCEEDED':
        tid = meshy.create('v1/retexture', {'model_url': meshy.data_uri(part_glb(hero, node)), 'image_style_url': meshy.data_uri(style),
            'text_style_prompt': prompt, 'enable_original_uv': True, 'enable_pbr': True, 'target_formats': ['glb']}, f'{hero}_{sid}:{pname}')
        r = meshy.wait('v1/retexture', tid, every=8); json.dump(r, open(rj, 'w'))
        if r['status'] != 'SUCCEEDED': return job[:2] + (pname, 'FAILED ' + str(r.get('task_error')))
    glb = os.path.join(d, pname + '.glb')
    if not os.path.exists(glb): meshy.fetch(r['model_urls']['glb'], glb)
    extract(glb, prefix, 'body' if pname == 'body' else 'weapon')
    return job[:2] + (pname, 'ok')

if __name__ == '__main__':
    only = os.environ.get('ONLY')
    jobs = [(h, s, dr, b, pn, nd) for h, s, dr, b in skins() for pn, nd in PARTS[h] if not only or f'{h}_{s}' in only.split(',')]
    os.makedirs(DST, exist_ok=True)
    print(len(jobs), 'jobs', flush=True)
    with cf.ThreadPoolExecutor(int(os.environ.get('PAR', '4'))) as ex:
        for res in ex.map(lambda j: (lambda: one(j))() if True else None, jobs):
            print(res, flush=True)
    print('balance', meshy.balance(), flush=True)
