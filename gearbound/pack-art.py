#!/usr/bin/env python3
"""Build gearbound/art.js from art other Labfreak games already ship.

Nothing here is painted for Gearbound. Sprites, icons and dungeon walls come
from Dead Man's Pull (lootdaggers/art.js + art-anim.js); the outdoor
battlefields come from Thankless (thankless/art.js). Each entry carries its
display height in game units so the game needs none of the source metadata.

    python3 gearbound/pack-art.py
"""
import base64, io, json, os, re
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

def load_map(path, var):
    s = open(os.path.join(ROOT, path)).read()
    m = re.search(r'window\.%s\s*=\s*' % var, s)
    d = json.JSONDecoder().raw_decode(s, m.end())[0]
    for m in re.finditer(r'Object\.assign\(window\.%s,' % var, s):
        d.update(json.JSONDecoder().raw_decode(s, m.end())[0])
    return d

LD = load_map('lootdaggers/art.js', 'LD_ART')
LD_META = load_map('lootdaggers/art.js', 'LD_ART_META')
LD_ANIM = load_map('lootdaggers/art-anim.js', 'LD_ART_ANIM')
TL = load_map('thankless/art.js', 'TL_ART')
html = open(os.path.join(ROOT, 'lootdaggers/index.html')).read()
FXA = json.loads(re.search(r'const FXA=(\{.*?\});\n', html).group(1))
CANVAS_H = {}
for k, v in re.findall(r'(\w+):(\d+)', re.search(r'const CANVAS_H=\{(.*?)\};', html, re.S).group(1)):
    CANVAS_H[k] = int(v)

def canvas_h(k):
    if k in CANVAS_H: return CANVAS_H[k]
    if k.startswith('hero_'): return CANVAS_H['hero']
    if k.startswith('boss'): return CANVAS_H['boss']
    return CANVAS_H.get(k.replace('enemy_attack_', 'enemy_'), 100)

def img_of(uri):
    return Image.open(io.BytesIO(base64.b64decode(uri.split(',', 1)[1])))

def reencode(uri, max_w=None, q=80):
    im = img_of(uri)
    if max_w and im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()

def shrink(uri, k, q=82):
    """Re-encode at a k-times scale (k<1). Returns the new data URI."""
    im = img_of(uri)
    if k < 1:
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()

def fit(uri, max_px):
    im = img_of(uri); k = min(1, max_px / max(im.width, im.height))
    return shrink(uri, k) if k < 1 else uri

HEROES = ['knight', 'brute', 'duelist', 'ranger', 'hexpriest', 'gambler']
ENEMIES = ['rat', 'skel', 'slime', 'archer', 'orc', 'wraith', 'mimic', 'ironclad', 'reaper',
           'abom', 'homunculus', 'brainjar', 'mirror', 'taxman', 'croupier']
BOSSES = ['bandit', 'boneking', 'lich', 'labfreak', 'labfreak2']
# every icon an item, enemy move or menu uses (see ITEMS / ENEMIES in index.html)
ICONS = """gear_weapon_shiv gear_weapon_dirk gear_weapon_stiletto gear_weapon_kris gear_weapon_cleaver gear_weapon_luckyblade
gear_weapon_ossuarymace gear_weapon_headsmanaxe gear_weapon_reapersickle gear_weapon_crossbow gear_weapon_shortbow gear_weapon_longbow
gear_weapon_noosewhip gear_weapon_grenadierpouch gear_weapon_bonesaw gear_weapon_gravediggerspade
gear_armor_jerkin gear_armor_chainmail gear_armor_plate gear_armor_coffinlid gear_armor_bonecuirass gear_armor_gambeson
gear_boots_sandals gear_boots_greaves gear_boots_nightwalkers
gear_charm_fourleafclover gear_charm_ring gear_charm_amulet gear_charm_die gear_charm_horseshoe gear_charm_soullantern
relic_whetstone relic_emberheart relic_hexbag relic_fang relic_eagleeye relic_momentum relic_tower relic_snakeoil relic_beaker
relic_piggybank relic_pouch relic_candle relic_glasscannon relic_thornmail relic_skullring relic_goldtooth relic_ironlung
relic_secondwind relic_scythe relic_spite relic_wither relic_souljar relic_powderkeg relic_bloodpact relic_gauntlet relic_quiver relic_vampirecape
sym_potion sym_shield sym_bomb sym_bow scratch_potion shop_tonic shop_meal ui_hp ui_block ui_coin ui_souls ui_souls_big ui_best""".split()
MISC = ['chest', 'chest_open', 'map_boss', 'map_elite', 'map_fight', 'map_rest', 'map_treasure', 'shop_chest', 'coinpile',
        'ui_bag', 'ui_daily', 'ui_settings', 'ui_vault', 'ui_wardrobe', 'ui_contracts', 'ui_fast', 'ui_logo', 'portrait_locked']
WALLS = ['bg_wall', 'bg_wall_2', 'bg_wall_3', 'bg_wall_4', 'bg_wall_lab', 'bg_wall_boss',
         'bg_floor', 'bg_floor_2', 'bg_floor_3', 'bg_floor_4', 'bg_floor_lab']
FX = ['fxa_hit', 'fxa_slash', 'fxa_heal', 'fxa_coins', 'fxa_bomb', 'fxa_curse', 'fxa_block', 'fxa_souls', 'fxa_arrow']

out, meta = {}, {}

def sprite(k):
    """A standing sprite: h = drawn height in game units, feet at the bottom."""
    if k not in LD: print('missing', k); return
    m = LD_META.get(k); im = img_of(LD[k])
    f = canvas_h(k) / (m[0] * m[1]) if m else canvas_h(k) / im.height
    out[k] = fit(LD[k], 300); meta[k] = {'w': round(im.width * f, 1), 'h': round(im.height * f, 1)}

def anim(base, kind):
    k = 'cha_%s_%s' % (base, kind)
    if k not in LD_ANIM or k not in FXA: print('missing', k); return
    m = FXA[k]; mt = LD_META[base]
    f = canvas_h(base) / (mt[0] * mt[1])
    # frames are ~300px tall; 0.6 keeps them crisp at phone size for a third of the bytes
    s = min(1, 190 / m['ch']); sw = len(m['d']) * m['cw']
    im = img_of(LD_ANIM[k]); cw = round(m['cw'] * s); ch = round(m['ch'] * s)
    im = im.crop((0, 0, sw, m['ch'])).resize((cw * len(m['d']), ch), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'WEBP', quality=80, method=6)
    out[k] = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
    meta[k] = {'cw': cw, 'ch': ch, 'n': len(m['d']), 'ms': m['d'][0], 'f': round(f / s, 5),
               'ax': round(m['ax'] * s, 2), 'ay': round(m['ay'] * s, 2),
               'uw': round(m.get('uw', m['cw']) * s, 2), 'uh': round(m.get('uh', m['ch']) * s, 2)}

for h in HEROES:
    for a in ('idle', 'attack', 'hurt'): sprite('hero_%s_%s' % (h, a))
    anim('hero_%s_idle' % h, 'idle'); anim('hero_%s_idle' % h, 'walk')
    out['portrait_' + h] = fit(LD['portrait_' + h], 160); meta['portrait_' + h] = {}
for e in ENEMIES:
    sprite('enemy_' + e); sprite('enemy_attack_' + e); anim('enemy_' + e, 'idle'); anim('enemy_' + e, 'walk')
for b in BOSSES:
    sprite('boss_' + b); sprite('boss_attack_' + b); anim('boss_' + b, 'idle'); anim('boss_' + b, 'walk')
for k in ICONS:
    if k in LD: out[k] = fit(LD[k], 192); meta[k] = {}
    else: print('missing', k)
for k in MISC:
    if k in LD: out[k] = fit(LD[k], 300); meta[k] = {}
    else: print('missing', k)
for k in WALLS:
    out[k] = reencode(LD[k], 1024, 74); meta[k] = {}
for k in FX:
    if k in LD:
        out[k] = LD[k]; m = FXA[k]
        meta[k] = {'cw': m['cw'], 'ch': m['ch'], 'n': len(m['d']), 'd': m['d'], 'dy': m.get('dy', 0)}
    else: print('missing', k)
for k in ('field_mire', 'field_bonefields', 'field_keep'):
    v = TL[k]; src = v['src'] if isinstance(v, dict) else v
    out[k] = reencode(src, 1024, 74); meta[k] = {}

with open(os.path.join(HERE, 'art.js'), 'w') as f:
    f.write('// GENERATED by pack-art.py from lootdaggers/ and thankless/ art. Do not edit.\n')
    f.write('window.GB_ART=' + json.dumps(out, separators=(',', ':')) + ';\n')
    f.write('window.GB_META=' + json.dumps(meta, separators=(',', ':')) + ';\n')
print(len(out), 'images,', os.path.getsize(os.path.join(HERE, 'art.js')) // 1024, 'KB')
