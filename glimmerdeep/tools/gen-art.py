#!/usr/bin/env python3
"""Glimmerdeep art batch (Meshy). Every image the game uses is listed here.

    MESHY_API_KEY=... python3 glimmerdeep/tools/gen-art.py            # all missing
    MESHY_API_KEY=... python3 glimmerdeep/tools/gen-art.py cr_cind1    # just these keys

Raw 1024px renders land in glimmerdeep/art-src/<key>.webp (q92); pack.py turns them into
the game's webp files in glimmerdeep/img/. Resumable: a key whose PNG exists is
skipped, so delete a source to re-roll it. Task ids go to meshy-log.jsonl.

Look: glossy stylized 3D toy renders, rich saturated colour, soft studio light.
Sprites are keyed off MAGENTA, so no design may be pink or magenta.
Evolution stages 2 and 3 are image-to-image from the previous stage so a line
keeps one design as it grows.
"""
import json, os, sys, concurrent.futures as cf
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import meshy

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'art-src')

KEYBG = ('on a flat solid pure magenta #FF00FF background filling the whole frame, no ground, '
         'no cast shadow, no text, no border, no frame')
CREATURE = ('Glossy stylized 3D render of a collectible monster for a premium creature-taming game: {d}. '
            'Chunky rounded toy-like proportions, big expressive eyes, rich vibrant saturated colours, '
            'soft studio lighting with a warm key light and cool rim light, subtle subsurface scattering, '
            'crisp clean detail. Whole body in frame with margin around it, three-quarter view facing to '
            'the RIGHT, {pose}. ' + KEYBG + '. The creature has no pink or magenta anywhere.')
EVOLVE = ('Use the reference image ONLY as a guide for colour palette and render style. Design its {stage}: '
          '{d}. It must look like a brand new, far more advanced and powerful creature, not the same animal '
          'with small changes: a new body shape and silhouette, {size}, more elaborate features such as armour, '
          'horns, crests, crowns or glowing markings, and a strong dramatic presence. Glossy stylized 3D render, '
          'chunky stylized shapes, rich vibrant saturated colours, dramatic rim lighting, whole body in frame with '
          'margin around it, three-quarter view facing to the RIGHT, {pose}. ' + KEYBG + '. No pink or magenta anywhere on the creature.')
BOSS = ('Glossy stylized 3D render of a huge boss monster for a premium creature-taming game: {d}. '
        'Imposing but charming, chunky stylized shapes, rich vibrant saturated colours, dramatic studio '
        'lighting with strong rim light, crisp detail. Whole body in frame with margin, three-quarter view '
        'facing to the LEFT. ' + KEYBG + '. No pink or magenta anywhere on the monster.')
ICON = ('A single glossy 3D rendered fantasy game item icon: {d}. Chunky stylized shapes, rich vibrant '
        'saturated colours, soft studio lighting with a bright rim light, centered with margin, '
        + KEYBG + '. The object itself has no pink or magenta.')
BG = ('Wide stylized 3D render of a game environment that fills the entire frame edge to edge, the backdrop of a creature-taming roguelite battle: {d}. '
      'Rich vibrant saturated colours, magical glowing light, soft depth of field in the far background, '
      'a broad clear flat ground area across the lower half where creatures will stand, no creatures, '
      'no characters, no animals, no people, no text, no UI.')

# evolved forms re-rolled in g4 for more dramatic evolutions (they override LINES below)
EVO_OVERRIDE = {'cind2': 'a chunky armoured fire axolotl drake on four legs, black obsidian spikes along its back, a blazing flame tail, glowing lava veins and ember eyes',
 'cind3': 'a tall horned fire dragon with small flame wings, a long body and tail, a jagged flame frill running down its back, glowing lava veins across dark red scales, fierce narrowed eyes',
 'pyrp2': 'a lithe adolescent fire fox standing tall on long legs, three blazing tails, ember-tipped ears, flame markings on its legs and glowing amber eyes',
 'pyrp3': 'a majestic sun goddess fox, tall and regal, nine radiant tails of white-gold fire fanned behind her like a sunburst, a floating crown of flame above her head and ornate golden markings',
 'bubb2': 'a sleek streamlined river otter warrior standing upright, long blade-like fins on its forearms and tail, a flowing mane of water and swirling bubbles around it',
 'bubb3': 'a mighty sea otter titan riding a huge cresting tidal wave, a crown of coral horns, glowing aqua runes across its body and a cape of rushing water',
 'shel3': 'a colossal leviathan turtle titan with a huge horned head, a glowing coral fortress city of spires on its back, barnacle armour plates and bioluminescent markings',
 'sprt2': 'an agile adolescent leaf hare in a fighting stance, long leaf-blade ears, thorny vine bracers wrapped around its legs and bright green fur',
 'sprt3': 'a towering ancient forest guardian hare spirit with branching antlers covered in blossoms, a thick mossy mane, a mantle of leaves and petals and glowing green eyes',
 'sprk3': 'a hulking storm beast hedgehog standing on two legs, a towering crown of jagged glowing yellow crystal quills crackling with lightning, a storm cloud swirling around its shoulders and glowing eyes',
 'buzz2': 'a sleek fierce hornet with four glowing crystal wings, a long sparking stinger at the tip of its abdomen, natural yellow and deep blue chitin plates and glowing eyes, holding nothing',
 'buzz3': 'a colossal thunder queen bee empress hovering with six huge crystal wings, a crown of crackling blue plasma, golden ornate armour and a storm of tiny lightning bees circling her',
 'pebb3': 'a colossal mountain titan golem, its shoulders are snowy mountain peaks, glowing amber magma core in its chest, enormous boulder fists and crystals and moss growing over its body',
 'crys3': 'a massive crystal behemoth dinosaur with a long spiked tail, rows of huge glowing prismatic teal, gold and sapphire crystal spines, a crystal-armoured head with three horns',
 'wisp2': 'a sleek shadow lynx with tufted ears, long smoky tail, glowing cyan eyes and glowing cyan rune markings along its indigo body',
 'wisp3': 'a huge void panther spirit, its body made of a starry night sky full of stars and nebulae, a flowing cosmic smoke mane, three glowing cyan eyes and wisps of shadow trailing from its paws',
 'dusk2': 'a wiry adolescent night bat with wide navy wings patterned with glowing silver crescent moons, big pointed ears and sharp silver claws',
 'dusk3': 'a gigantic eclipse dragon bat with vast midnight wings full of stars, a glowing golden eclipse corona ring behind its head, crescent-moon horns and armoured silver claws'}

# key -> (template, description, extra)
A = {}
def cr(key, d, pose='standing alert and playful'): A[key] = ('creature', d, pose)
def ev(key, ref, d, pose='in a dynamic battle-ready stance'): A[key] = ('evolve', d, pose, ref, int(key[-1]))

# ---- creature lines: three stages each ------------------------------------
LINES = [
 ('cind', 'a round chubby baby axolotl in warm coral orange with frilly external gills that glow like hot coals and tiny flames, a stubby tail and a golden belly',
          'a bigger fierce fire axolotl with long blazing gill fronds of flame, glowing lava-crack markings and a flame-finned tail',
          'a huge majestic magma axolotl dragon with a mane of roaring fire gills, molten obsidian armour plates on its back, a long flaming tail fin and glowing ember eyes'),
 ('pyrp', 'a fluffy orange fox pup with a tail made of a soft puff of fire and cream chest fur',
          'a sly sleek fire fox with two flaming tails and amber flame-tipped ears',
          'a radiant sun fox with five blazing tails fanned out behind it and a floating halo ring of golden fire'),
 ('bubb', 'a round chubby baby otter in sky blue and white, floating inside a ring of shimmering bubbles',
          'a sleek playful river otter with water-fin ears and a flowing mane of rippling water',
          'a regal sea otter guardian with a cresting wave for a mane, glowing aqua coral markings and a swirl of water orbiting it'),
 ('shel', 'a tiny teal turtle with a big spiral seashell on its back and sleepy smiling eyes',
          'a stout armoured turtle whose shell is a living coral reef in teal and orange with little sea anemones',
          'a huge ancient sea turtle titan with a whole glowing reef city of coral spires on its shell and barnacle armour'),
 ('sprt', 'a round lime green bunny with a two-leaf sprout growing on its head and a cotton tail',
          'a nimble hare with long leaf-shaped ears and curling thorny green vines around its legs',
          'a great lop-eared forest hare spirit crowned with blooming white and yellow flowers and a mossy mane'),
 ('moss', 'a little mushroom creature with a mossy green cap dotted with tiny glowing teal spots and stubby feet',
          'a sturdy mushroom golem with a broad green cap, glowing teal spots and root-like arms',
          'a towering ancient mushroom beast with a huge canopy cap raining glowing teal spores and a bark-armoured body'),
 ('sprk', 'a tiny round teal hedgehog whose spines are glowing yellow crystal lightning shards, with a cream face and little paws',
          'a spiky teal hedgehog crackling with electricity, longer jagged crystal-lightning quills and a mane of sparks',
          'a muscular storm hedgehog beast with a crown of huge jagged electric-yellow crystal quills, crackling blue lightning arcs and glowing eyes'),
 ('buzz', 'a chubby baby bee with electric yellow and deep blue stripes and tiny sparking antennae',
          'a sleek bee with glowing crystal blue wings, sparking antennae and a bright yellow body',
          'a regal thunder bee queen with a crown of crackling blue plasma, four big crystal wings and golden armour-like plates'),
 ('pebb', 'a round little grey pebble golem with a mossy top, stubby arms and a cheerful face',
          'a hulking boulder golem with mossy shoulders, big stone fists and glowing amber eyes',
          'a colossal granite titan with glowing amber core veins, mountain-peak shoulders and moss and crystals growing on it'),
 ('crys', 'a baby armadillo with a sandy shell studded with small teal crystals',
          'a chunky armadillo with large spiky teal and sapphire crystals erupting from its armoured shell',
          'a dinosaur-like armadillo behemoth with huge prismatic teal, gold and sapphire crystal spines glowing from within'),
 ('wisp', 'a small floating ghost kitten, translucent indigo with glowing cyan eyes and a wispy smoke tail',
          'a sleek shadow cat in deep indigo with a long smoky tail and glowing cyan eyes and markings',
          'a sleek void panther with starry night-sky fur full of tiny stars, cyan glowing eyes and a trailing cosmic smoke mane'),
 ('dusk', 'a round fuzzy baby bat in deep navy blue with oversized ears and big shiny eyes',
          'a bat with wide navy wings patterned with glowing silver crescent moons',
          'a grand eclipse bat with vast midnight wings and a glowing golden corona ring floating behind it'),
]
for k, s1, s2, s3 in LINES:
    cr(f'cr_{k}1', s1)
    s2, s3 = EVO_OVERRIDE.get(k + '2', s2), EVO_OVERRIDE.get(k + '3', s3)
    # re-rolled forms take stage 1 as the palette guide, so both read as the same line
    ev(f'cr_{k}2', f'cr_{k}1', s2)
    ev(f'cr_{k}3', f'cr_{k}1' if k + '3' in EVO_OVERRIDE else f'cr_{k}2', s3)

# ---- bosses ----------------------------------------------------------------
for k, d in [
 ('boss_bramble', 'Mother Bramble, a huge ancient tree beast of twisted bark with thorned vine arms and a glowing golden flower heart in its chest'),
 ('boss_cinder', 'Cinderking, a magma golem king with a molten glowing core, obsidian horns and rivers of lava running down its rocky body'),
 ('boss_eel', 'Abyssqueen, a giant bioluminescent sea serpent eel with glowing aqua fins, crackling blue electric whiskers and a crown-like frill'),
 ('boss_prism', 'the Prism Sentinel, a towering crystal guardian beast made of faceted teal and gold crystal with floating crystal shards orbiting it'),
 ('boss_grim', 'Grimhoot, a giant spectral owl of deep indigo smoke with two huge glowing lantern-yellow eyes and tattered ghostly wings'),
 ('boss_wyrm', 'the Glimmerwyrm, a cosmic iridescent dragon made of shifting crystal and light, its body glowing with fire, water, leaf, lightning, stone and shadow colours'),
]: A[k] = ('boss', d)

# ---- battle backgrounds and screens -----------------------------------------
for k, d in [
 ('bg_verdant', 'a lush glowing forest hollow inside a giant cavern, huge mossy roots, glowing mushrooms, fireflies and shafts of warm light'),
 ('bg_magma', 'a volcanic forge cavern with rivers of glowing orange lava, obsidian pillars and floating embers'),
 ('bg_grotto', 'a sunken underwater-like grotto with shallow glowing turquoise water pools, coral, waterfalls and shimmering caustic light'),
 ('bg_spire', 'a crystal spire cavern full of giant teal and gold crystals refracting rainbow light'),
 ('bg_crypt', 'a moonlit shadow crypt of deep indigo and teal, ruined mossy stone arches, glowing cyan ghost lanterns, blue magical fire braziers and luminous crystals, rich saturated night colours'),
 ('bg_core', 'the glowing heart of the world, a cosmic cavern with a huge iridescent crystal core, floating rocks and swirling multicoloured elemental light'),
 ('bg_title', 'the entrance to a magical glowing cave in a hillside at golden hour, crystals glinting inside, a winding path leading in, lush meadow'),
 ('bg_camp', 'a cozy explorer camp at the mouth of a glowing cave at dusk, a crackling campfire, a tent, lanterns and crates'),
]: A[k] = ('bg', d)

# ---- map nodes and element badges ---------------------------------------------
for k, d in [
 ('node_battle', 'two crossed glowing claw slashes on a round bronze badge'),
 ('node_elite', 'a fierce horned monster skull on a round silver badge with red gems'),
 ('node_den', 'a cozy grassy nest with a speckled monster egg in it'),
 ('node_shop', 'a small leather coin pouch overflowing with gold coins'),
 ('node_rest', 'a crackling campfire with logs and stones'),
 ('node_event', 'a glowing blue question mark carved from crystal'),
 ('node_treasure', 'an ornate wooden treasure chest with gold trim, lid slightly open with light pouring out'),
 ('node_boss', 'a menacing golden crown with a dark red gem'),
 ('el_ember', 'a round glossy orange badge with a bright stylized flame'),
 ('el_tide', 'a round glossy blue badge with a stylized water droplet'),
 ('el_bloom', 'a round glossy green badge with a stylized sprouting leaf'),
 ('el_volt', 'a round glossy yellow badge with a stylized lightning bolt'),
 ('el_stone', 'a round glossy brown badge with a stylized boulder'),
 ('el_shade', 'a round glossy deep indigo badge with a stylized crescent moon'),
 ('ui_gold', 'a shiny stack of three gold coins'),
 ('ui_shard', 'a glowing iridescent crystal shard'),
]: A[k] = ('icon', d)

# ---- relics (team-wide passives: icons only, never drawn on a creature) -----
RELICS = {
 'ember_heart': 'a glowing orange crystal heart with fire inside', 'tide_pearl': 'a large luminous blue pearl in a seashell',
 'bloom_seed': 'a glowing green seed sprouting two leaves', 'volt_coil': 'a copper coil crackling with blue lightning',
 'stone_idol': 'a small carved stone idol with amber eyes', 'shade_orchid': 'a dark indigo orchid flower glowing cyan',
 'kindling': 'a bundle of sticks tied with twine with small flames', 'brine_flask': 'a round glass flask of swirling blue sea water',
 'toxic_vial': 'a corked vial of bubbling green poison', 'storm_jar': 'a glass jar with a tiny thundercloud and lightning inside',
 'hex_doll': 'a small stitched voodoo doll made of indigo cloth', 'fault_stone': 'a cracked stone with glowing gold veins',
 'clover': 'a bright green four-leaf clover', 'hawk_gem': 'a golden eye-shaped gemstone', 'loaded_die': 'a red and gold six-sided die',
 'bulwark_shell': 'a thick armoured turtle shell piece', 'bramble_knot': 'a knot of thorny green brambles',
 'ironroot': 'a twisted root made of iron', 'gale_feather': 'a white and teal feather swirling with wind',
 'quickglass': 'a small golden hourglass with glowing blue sand', 'tempo_drum': 'a small tribal drum with lightning patterns',
 'vamp_fang': 'a single long white fang with a red drop', 'chalice': 'a golden chalice filled with glowing red liquid',
 'heartstone': 'a red gemstone carved in the shape of a heart', 'tome': 'a thick leather-bound tome with a glowing star on the cover',
 'sunstone': 'a glowing yellow sun-shaped stone', 'golden_egg': 'a shiny golden egg', 'purse': 'a green velvet coin purse with a gold clasp',
 'bell': 'a polished brass merchant bell', 'treasure_map': 'a rolled parchment treasure map tied with red string',
 'star_shard': 'a glowing five-pointed star shard', 'comet_core': 'a fiery blue comet rock', 'echo_chime': 'a set of glowing crystal wind chimes',
 'rally_horn': 'a curved horn with bronze bands', 'guardian_totem': 'a small carved wooden totem pole',
 'kinship_knot': 'a knot of six coloured braided cords', 'pure_prism': 'a clear triangular prism splitting light into a rainbow',
 'thundercloud': 'a small fluffy dark cloud with lightning', 'geyser_stone': 'a rock spouting a jet of hot steam',
 'blight_bulb': 'a glowing green and orange bulb plant', 'morning_dew': 'a single big water droplet on a green leaf',
 'phoenix_plume': 'a blazing red and gold phoenix feather', 'fragile_star': 'a cracked glass star glowing white-hot',
 'mirror_pond': 'a small round hand mirror whose glass is rippling water', 'lodestone': 'a dark magnetic lodestone with iron filings',
 'moon_pearl': 'a silver pearl glowing with moonlight', 'frostcore': 'a glowing icy blue crystal core with frost',
 'lumen_moth': 'a glowing golden moth', 'gill_pearl': 'a teal pearl with little gill frills', 'incense': 'a small brass incense burner with fragrant white smoke',
 'prism_lens': 'a round crystal lens in a gold ring',
 # legendary fusions
 'supernova': 'an exploding miniature star of orange and white fire', 'tempest_engine': 'a brass engine core with a storm swirling inside',
 'leviathan_pearl': 'a giant deep blue pearl wrapped by a small sea serpent', 'world_seed': 'a radiant golden seed with a tiny tree growing from it',
 'mountain_heart': 'a glowing amber heart encased in granite', 'eclipse_eye': 'a black and gold eclipse orb like an eye',
 'jackpot': 'a gold coin with a lucky seven and sparkles', 'philosopher': 'a glowing iridescent philosopher stone',
}
for k, d in RELICS.items(): A['rl_' + k] = ('icon', d)

CHARMS = {
 'fang': 'a sharp white monster fang on a cord', 'shell': 'a hard spiral shell', 'plume': 'a light blue speed feather',
 'acorn': 'a big glossy acorn glowing green', 'leaf': 'a lucky golden leaf', 'leech': 'a curved red tooth',
 'berry': 'a juicy half-eaten red berry', 'lens': 'a small focusing glass lens', 'burr': 'a spiky green burr seed pod',
 'grit': 'a small sturdy pebble with a smiling crack', 'scope': 'a blue crystal monocle scope', 'coal': 'a glowing lump of coal',
 'seaglass': 'a smooth piece of blue sea glass', 'wildseed': 'a big green seed with leaf pattern', 'magnet': 'a red and silver horseshoe magnet',
 'geode': 'a split geode showing teal crystals', 'spelltag': 'a paper talisman tag with a glowing indigo rune',
}
for k, d in CHARMS.items(): A['ch_' + k] = ('icon', d)

ITEMS = {
 'berry': 'a plump glowing red healing berry with a leaf', 'revive': 'a glowing golden seed sprouting a heart-shaped leaf',
 'candy': 'a wrapped iridescent glowing candy', 'evo': 'a glowing rainbow evolution crystal', 'bomb': 'a round fizzing blue bomb with a lit fuse',
 'elixir': 'a tall glass bottle of glowing clear blue elixir', 'lure': 'a glowing orb with a soft golden light inside a silver cage',
 'smoke': 'a puff of grey smoke bursting from a small clay pot',
}
for k, d in ITEMS.items(): A['it_' + k] = ('icon', d)


def prompt(spec):
    t = spec[0]
    if t == 'creature': return CREATURE.format(d=spec[1], pose=spec[2])
    if t == 'evolve':
        st = spec[3][-1]
        return EVOLVE.format(d=spec[1], pose=spec[2],
            stage='second evolution, a bold adolescent form' if spec[0] == 'evolve' and spec[4] == 2 else 'final evolution, an awe-inspiring apex form',
            size='about twice the size with a more athletic build' if spec[4] == 2 else 'about three times the size, majestic, towering and imposing')
    if t == 'boss': return BOSS.format(d=spec[1])
    if t == 'icon': return ICON.format(d=spec[1])
    if t == 'bg': return BG.format(d=spec[1])

CAND = 0
def make(key, cand=None):
    spec = A[key]
    out = os.path.join(SRC, key + '.webp') if cand is None else os.path.join(SRC, '_cand', f'{key}_{cand}.webp')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if os.path.exists(out): return key, 'have'
    p = prompt(spec)
    if spec[0] == 'evolve':
        ref = os.path.join(SRC, spec[3] + '.webp')
        if not os.path.exists(ref): return key, 'no ref'
        kind = 'v1/image-to-image'
        body = {'ai_model': 'nano-banana', 'reference_image_urls': [meshy.data_uri(ref)], 'prompt': p, 'aspect_ratio': '1:1'}
    else:
        kind = 'v1/text-to-image'
        body = {'ai_model': 'nano-banana', 'prompt': p, 'aspect_ratio': '16:9' if spec[0] == 'bg' else '1:1'}
    r = meshy.wait(kind, meshy.create(kind, body, key if cand is None else f'{key}#{cand}'), every=4)
    if r.get('status') != 'SUCCEEDED': return key, 'FAILED ' + json.dumps(r.get('task_error'))
    tmp = out + '.png'
    meshy.fetch(r['image_urls'][0], tmp)
    Image.open(tmp).convert('RGB').save(out, 'WEBP', quality=92, method=5)
    os.remove(tmp)
    return key, 'ok'

def run(keys):
    # stage order: everything that is not an evolution first, then stage 2, then 3
    tiers = [[k for k in keys if A[k][0] != 'evolve'],
             [k for k in keys if A[k][0] == 'evolve' and k.endswith('2')],
             [k for k in keys if A[k][0] == 'evolve' and k.endswith('3')]]
    if CAND:
        tiers = [[(k, i) for k in keys for i in range(CAND)]]
    else:
        tiers = [[(k, None) for k in t] for t in tiers]
    for tier in tiers:
        with cf.ThreadPoolExecutor(8) as ex:
            for f in cf.as_completed([ex.submit(make, k, c) for k, c in tier]):
                try: print(*f.result(), flush=True)
                except Exception as e: print('ERR', e, flush=True)
    print('balance', meshy.balance(), flush=True)

if __name__ == '__main__':
    os.makedirs(SRC, exist_ok=True)
    args = sys.argv[1:]
    if args and args[0] == '--cand':
        CAND = int(args[1]); args = args[2:]
    keys = args or list(A)
    bad = [k for k in keys if k not in A]
    if bad: sys.exit('unknown keys: ' + ' '.join(bad))
    run(keys)
