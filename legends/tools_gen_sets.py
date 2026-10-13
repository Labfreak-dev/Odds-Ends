#!/usr/bin/env python3
"""Labfreak Legends expansion sets: Siege of Ironhold and The Deep Catch.

    python3 legends/tools_gen_sets.py

Reads the Core Set already in legends/data/cards.js (built by tools_gen_cards.py) and
appends two Hearthstone-style expansions built from art that was not in the game yet:

  Siege of Ironhold (set "ih")  Ironhold Idle's monsters, nemeses, companions, uniques and
                                gear. Brings the sixth class, the Champion, and the Frenzy
                                keyword (the first time a minion survives damage, it acts).
  The Deep Catch    (set "dc")  Odds & Ends fishing: the hundred painted species, the sea
                                creatures, treasure, tackle and the six Legend fish. Brings
                                the Dredge keyword (look at the bottom 3 cards of your deck,
                                put one on top).

Every asset is read straight out of the repo (ironhold/art.js, ironhold/index.html,
workshop/fishing-*.module.js), so the build is reproducible. Running it twice is safe:
cards from earlier runs of this tool are dropped before the new ones are added.
Card text comes from the Core generator's describe(), so what a card says is what it does.
"""
import base64, io, json, os, re, sys
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEG = os.path.join(ROOT, "legends")
REPO = ROOT + "/"

# ---------------------------------------------------------------- the Core generator's rules
# The card helpers (budget formula, describe(), keyword values, sprite baking) are taken from
# tools_gen_cards.py so both generators price and word cards the same way.
_src = open(os.path.join(LEG, "tools_gen_cards.py")).read()
_a = _src.index("def h(s):")
_b = _src.index("# ------------------------------------------------------------------ art baking")
_c = _src.index("CELL = 192")
_d = _src.index("def crop_card")
NS = {"json": json, "os": os, "re": re, "math": __import__("math"), "random": __import__("random"),
      "hashlib": __import__("hashlib"), "Image": Image, "ImageDraw": ImageDraw, "ImageFilter": ImageFilter,
      "ImageEnhance": ImageEnhance}
exec(_src[_a:_b], NS)
exec(_src[_c:_d], NS)
h, E, minion, spell, weapon, describe, bake_sprite, radial_bg = (NS[k] for k in
    ("h", "E", "minion", "spell", "weapon", "describe", "bake_sprite", "radial_bg"))
CELL = NS["CELL"]

# new trigger and effects
NS["TRIG"]["frenzy"] = "Frenzy: "
NS["CCOL"]["champion"] = (225, 95, 70)
_old_text, _old_value = NS["eff_text"], NS["eff_value"]
def eff_text(e):
    op = e["op"]
    if op == "dredge": return "Dredge"
    if op == "hatk": return f"Your hero gets +{e['n']} Attack this turn"
    if op == "wbuff": return f"Give your weapon {NS['stats'](e.get('a', 0), e.get('h', 0)).replace('Health', 'Durability')}"
    return _old_text(e)
def eff_value(e):
    op = e["op"]
    if op == "dredge": v = 1.2
    elif op == "hatk": v = e["n"] * 0.6
    elif op == "wbuff": v = (e.get("a", 0) + e.get("h", 0)) * 0.9
    else: return _old_value(e) * (0.75 if e["on"] == "frenzy" else 1)
    if e["on"] == "frenzy": v *= 0.75
    if e["on"] == "dr": v *= 0.8
    return v
NS["eff_text"], NS["eff_value"] = eff_text, eff_value

CLASS_BONUS = {"champion": 0.5, "healer": 0.5, "collector": -0.5}
_minion = minion
def minion(cid, name, cls, rar, cost, frac, kw=(), fx=(), art=None, bonus=0, **extra):
    return _minion(cid, name, cls, rar, cost, frac, kw, fx, art, bonus=bonus + CLASS_BONUS.get(cls, 0), **extra)

def spell_cost(fx, lo=0, hi=10):
    return max(lo, min(hi, int(sum(eff_value(e) for e in fx) / 1.6 + 0.5)))

# ---------------------------------------------------------------- the Core Set already built
DATA_JS = os.path.join(LEG, "data", "cards.js")
raw = open(DATA_JS).read()
DATA = json.loads(raw[raw.index("{"):raw.rstrip().rstrip(";").rindex("}") + 1])
DATA["cards"] = [c for c in DATA["cards"] if c.get("s") in (None, "core")]  # drops ih/dc/tt from earlier runs
for k in [k for k, t in DATA["tokens"].items() if t.get("s") in ("ih", "dc", "tt")]: del DATA["tokens"][k]
DATA["heroes"].pop("champion", None)
CORE_SHEETS = [s for s in DATA["sheets"] if int(re.search(r"a(\d+)", s).group(1)) < 37]
DATA["sheets"] = CORE_SHEETS
BASE = len(CORE_SHEETS)
CORE_NAMES = {c["n"].lower() for c in DATA["cards"]}
NS["TOKENS"].update(DATA["tokens"])  # Core tokens, so summon text and values resolve

SHEETS = []
def add_art(img):
    if not SHEETS or len(SHEETS[-1]) == 64: SHEETS.append([])
    SHEETS[-1].append(img.convert("RGB"))
    return [BASE + len(SHEETS) - 1, len(SHEETS[-1]) - 1]

CARDS, TOKENS, NAMES = [], {}, set()
def tidy(tx):
    """describe() writes one sentence per effect; fold repeats into one."""
    for one, many in (("Add a Coin to your hand.", "Add {n} Coins to your hand."), ("Dredge.", "Dredge {n} times."),
                      ("Steal a random card from your opponent's hand.", "Steal {n} random cards from your opponent's hand.")):
        for n in (3, 2):
            rep = " ".join([one] * n)
            if rep in tx: tx = tx.replace(rep, many.format(n="two" if n == 2 else "three").replace("Dredge two times", "Dredge twice"))
    return tx
def add(c, s):
    c["s"] = s
    n = c["n"]
    if n.lower() in CORE_NAMES or n.lower() in NAMES:
        raise SystemExit(f"duplicate card name: {n}")
    NAMES.add(n.lower())
    c["tx"] = tidy(describe(c))
    CARDS.append(c)
    return c

def tok(tid, name, a, hp, art, cls="neutral", kw=None, s="ih"):
    TOKENS[tid] = {"id": tid, "n": name, "c": cls, "t": "m", "r": 0, "m": max(0, (a + hp - 1) // 2), "a": a, "h": hp,
                   "kw": kw or [], "fx": [], "art": art, "token": 1, "s": s}
    NS["TOKENS"][tid] = TOKENS[tid]
    TOKENS[tid]["tx"] = describe(TOKENS[tid])

def b64img(d):
    return Image.open(io.BytesIO(base64.b64decode(d.split(",", 1)[1])))

def bg_crop(im, blur=1.2, dark=0.72, yfrac=0.6, zoom=1.35):
    im = im.convert("RGB")
    s = max(CELL / im.width, CELL / im.height) * zoom
    im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    x = (im.width - CELL) // 2; y = max(0, int((im.height - CELL) * yfrac))
    im = im.crop((x, y, x + CELL, y + CELL)).filter(ImageFilter.GaussianBlur(blur))
    return ImageEnhance.Brightness(im).enhance(dark)

# ================================================================ SIEGE OF IRONHOLD
ih_art = open(REPO + "ironhold/art.js").read()
_i = ih_art.index("SPR_SRC=") + len("SPR_SRC=")
_j = ih_art.index("AREA_BG_SRC")
_body = ih_art[_i:_j].rstrip().rstrip(";").rstrip()
SPR = json.loads(_body[:_body.rindex("}") + 1])
_k = ih_art.index("AREA_BG_SRC"); _l = ih_art.index("[", _k)
AREA_BG = [b64img(d) for d in re.findall(r'"(data:image/[^"]+)"', ih_art[_l:ih_art.index("]", _l) + 1])]
AREA_C = [bg_crop(im, yfrac=0.75, zoom=1.0) for im in AREA_BG]
ih_html = open(REPO + "ironhold/index.html").read()
_n = re.search(r"(?:const|let|var) ICONS\s*=\s*\{", ih_html).end() - 1
_depth = 0
for _q in range(_n, len(ih_html)):
    ch = ih_html[_q]
    if ch == "{": _depth += 1
    elif ch == "}":
        _depth -= 1
        if _depth == 0: break
ICONS = dict(re.findall(r'["\']?([A-Za-z_0-9]+)["\']?\s*:\s*["\'](data:image/[^"\']+)["\']', ih_html[_n:_q + 1]))
_u = ih_html.index("UNIQUES={"); _v = ih_html.index("\n};", _u)
UNIQ = {}
for k, v in re.findall(r"\n\s*(\w+):\{(.*?)\},?(?=\n)", ih_html[_u:_v]):
    nm = re.search(r"n:(['\"])((?:\\.|(?!\1).)*)\1", v).group(2).replace("\\'", "'")
    UNIQ[k] = (nm, int(re.search(r"tier:(\d+)", v).group(1)), re.search(r"eff:\{([^}]*)\}", v).group(1),
               re.search(r"d:(['\"])((?:\\.|(?!\1).)*)\1", v).group(2).replace("\\'", "'"))

def spr(key):
    v = SPR.get(key + "_idle") or SPR.get(key) or SPR.get(key + "_atk")
    return b64img(v["f"][0]["src"]).convert("RGBA")

def ih_art_(key, area, glow=None, mode="stand", scale=0.92):
    return add_art(bake_sprite(spr(key), AREA_C[area].copy(), mode=mode, glow=glow, scale=scale))

def icon_art(key, col, scale=0.8):
    return add_art(bake_sprite(b64img(ICONS[key]).convert("RGBA"), radial_bg(col), mode="center", scale=scale))

IHC = NS["CCOL"]["champion"]
F_ATK = lambda n: E("frenzy", "buff", a=n, h=0, tg="self")
F_DMG = lambda n: E("frenzy", "dmg", n=n, tg="rand_enemy")
F_ARM = lambda n: E("frenzy", "armor", n=n)
F_SUM = lambda t, c=1: E("frenzy", "summon", id=t, cnt=c)
F_KW = lambda k: E("frenzy", "kw", k=k, tg="self")
GI = "Ironhold Idle"

tok("t_spider", "Spiderling", 1, 1, ih_art_("giant_spider", 2), cls="champion")
tok("t_stitch", "Stitchling", 1, 1, ih_art_("min_stitched", 8), cls="champion")
tok("t_goblin", "Goblin Raider", 1, 1, ih_art_("goblin", 1), kw=["rush"])
tok("t_rat", "Sewer Rat", 1, 1, ih_art_("giant_rat", 2))
tok("t_wyrmling", "Wyrmling", 2, 2, ih_art_("min_wyrmpriest", 7))
tok("t_bonehound", "Bone Hound", 2, 1, ih_art_("night_gravehound", 8, scale=0.8), cls="champion")

# --- the thirty lieutenants (Champion): the nemeses' minions, and where Frenzy lives
LT = [  # nemesis id, minion name, cost, rarity, attack share, keywords, effects, area
    ("vorgath", "Vorgath's Hound", 1, 0, .6, ["rush"], [F_ATK(1)], 0),
    ("skarn", "Skarn's Cutthroat", 2, 0, .6, ["stealth"], [E("combo", "buff", a=2, h=0, tg="self")], 1),
    ("ulthra", "Bog Wisp", 1, 0, .5, ["elusive"], [E("dr", "dmg", n=1, tg="rand_enemy")], 2),
    ("maldrek", "Plague Rat", 2, 0, .5, ["poisonous"], [], 2),
    ("ossira", "Ossira's Marksman", 3, 0, .55, [], [E("bc", "dmg", n=2, tg="any")], 3),
    ("karzoth", "Chain Thrall", 2, 0, .4, ["taunt"], [F_ATK(2)], 3),
    ("draveth", "Gravebound", 3, 0, .5, ["reborn"], [], 8),
    ("nyxeth", "Shade", 2, 0, .6, ["stealth"], [E("atk", "dmg", n=1, tg="rand_enemy")], 8),
    ("brannoc", "Throne-Bearer", 4, 0, .4, ["taunt"], [F_ARM(4)], 4),
    ("widow", "Widow's Brood", 3, 0, .5, [], [E("dr", "summon", id="t_spider", cnt=2)], 2),
    ("gorrum", "Slag Golem", 5, 0, .45, ["taunt"], [F_DMG(3)], 6),
    ("ash", "Ember Acolyte", 2, 0, .5, [], [F_DMG(2)], 6),
    ("tollman", "Drowned One", 3, 0, .5, ["frostbite"], [], 5),
    ("vexil", "Imp Scribe", 2, 0, .5, [], [E("bc", "discover", pool="spell")], 6),
    ("hollowjaw", "Bone Kite", 3, 0, .6, ["rush"], [F_ATK(2)], 7),
    ("marrow", "Marrow Guard", 4, 0, .45, ["taunt", "divine"], [], 8),
    ("stitched", "Stitchling Swarm", 1, 0, .5, [], [F_SUM("t_stitch")], 8),
    ("ilvara", "Rime Sprite", 2, 0, .5, [], [E("bc", "freeze", tg="em")], 5),
    ("gilt", "Gilded Bat", 2, 0, .55, ["rush", "lifesteal"], [], 7),
    ("wyrmpriest", "Wyrmling Hatcher", 4, 0, .55, [], [F_ATK(3)], 7),
    ("thessaly", "Watcher Eye", 3, 1, .4, [], [E("eot", "dmg", n=1, tg="rand_enemy")], 8),
    ("grimwald", "Root Wight", 4, 1, .45, ["taunt", "lifesteal"], [], 4),
    ("ashking", "Cinder Steed", 5, 1, .6, ["charge"], [], 6),
    ("sallow", "Reed Hound", 3, 1, .55, ["rush"], [E("frenzy", "copy")], 0),
    ("kael", "Rift Mote", 1, 1, .5, ["elusive"], [E("dr", "discover", pool="spell")], 8),
    ("bellringer", "Bell Toll", 4, 1, .2, ["taunt", "cantattack"], [E("sot", "dmg", n=1, tg="enemies")], 8),
    ("seraphel", "Iron Feather", 3, 1, .5, ["divine", "rush"], [], 8),
    ("dragonknight", "Bone Drake", 6, 1, .55, ["rush", "reborn"], [F_ATK(2)], 7),
    ("ossuary", "Ossuary Hand", 5, 1, .5, [], [E("dr", "resurrect", n=1)], 8),
    ("inevitable", "Reflection", 4, 1, .5, [], [E("bc", "copy")], 8),
]
for k, nm, cost, rar, frac, kw, fx, area in LT:
    add(minion(f"ihl_{k}", nm, "champion", rar, cost, frac, kw, fx, ih_art_(f"min_{k}", area), g=GI, tr="Lieutenant"), "ih")

# --- the thirty nemeses: Epic and Legendary, five for every class
NEM = [  # id, name, class, keywords, effects, flavor
    ("vorgath", "Vorgath the Hunter", "champion", ["rush"], [E("frenzy", "buff", a=2, h=2, tg="self")], "The first to come for you. Not the last."),
    ("skarn", "Skarn", "gambler", ["stealth"], [E("combo", "steal")], "Takes a cut of everything, including you."),
    ("ulthra", "Ulthra", "tamer", ["stealth", "poisonous"], [], "The bog remembers every traveller it kept."),
    ("maldrek", "Maldrek", "collector", ["poisonous"], [E("dr", "summon", id="t_rat", cnt=3)], "Counts his rats. Never loses one."),
    ("ossira", "Ossira", "champion", [], [E("bc", "missiles", n=4)], "Never misses twice."),
    ("karzoth", "Karzoth", "collector", ["taunt"], [E("bc", "destroy", tg="em", max=3)], "Collects chains, and the people in them."),
    ("draveth", "Draveth", "healer", ["reborn"], [E("eot", "aoe_heal", n=2, tg="friends")], "Died once. Didn't care for it."),
    ("nyxeth", "Nyxeth", "scientist", ["stealth"], [E("eot", "dmg", n=1, tg="em_all")], "A shadow that learned to keep notes."),
    ("brannoc", "Brannoc", "collector", ["taunt"], [E("eot", "armor", n=3)], "Carries his throne to every fight."),
    ("widow", "The Pale Widow", "tamer", ["poisonous"], [E("dr", "summon", id="t_spider", cnt=3)], "Her brood is never far."),
    ("gorrum", "Gorrum Ironbelly", "collector", ["taunt", "divine"], [F_ARM(5)], "Swallowed a forge. Kept it."),
    ("ash", "Sister Ash", "scientist", [], [E("bc", "dmg", n=2, tg="em_all")], "Her sermons end in fire.", 2),
    ("tollman", "The Tollman", "gambler", [], [E("eot", "dmg", n=2, tg="ehero"), E("eot", "armor", n=2)], "Every crossing has a price."),
    ("vexil", "Vexil the Tongue", "gambler", [], [E("bc", "steal"), E("bc", "draw", n=1)], "Talks you out of your own cards."),
    ("hollowjaw", "Hollowjaw", "champion", ["rush", "lifesteal"], [F_ATK(3)], "Nothing in there but teeth."),
    ("marrow", "Queen Marrow", "healer", ["taunt"], [E("bc", "summon", id="t_skel2", cnt=2), E("bc", "armor", n=3)], "Rules a kingdom of bones."),
    ("stitched", "The Stitched Man", "scientist", ["reborn"], [F_SUM("t_stitch", 3)], "Every seam is somebody else."),
    ("ilvara", "Ilvara Frostmere", "healer", [], [E("bc", "freeze", tg="em_all"), E("bc", "heal", n=5, tg="fhero")], "Cold enough to stop a heart. Kind enough to start it again."),
    ("gilt", "Baron Gilt", "gambler", ["lifesteal"], [E("bc", "coin"), E("bc", "coin")], "Pays in gold. Collects in blood."),
    ("wyrmpriest", "The Wyrm Priest", "tamer", [], [E("bc", "summon", id="t_wyrmling", cnt=2)], "Preaches to dragons. They listen."),
    ("thessaly", "Thessaly of the Nine Eyes", "healer", [], [E("bc", "draw", n=3)], "Sees every card in your hand."),
    ("grimwald", "Grimwald the Unburied", "tamer", ["taunt", "reborn"], [E("bc", "summon", id="t_wisp", cnt=2)], "The roots let him go. Mostly."),
    ("ashking", "The Ashen King", "champion", ["charge"], [E("bc", "dmg", n=2, tg="em_all")], "His crown is still burning."),
    ("sallow", "Mother Sallow", "tamer", ["rush"], [E("eot", "summon", id="t_bonehound", cnt=1)], "Her hounds come home from the reeds."),
    ("kael", "Kael Voidrender", "scientist", ["elusive"], [E("bc", "transform", tg="em")], "Opens holes in the world to see what falls in."),
    ("bellringer", "The Bell-Ringer", "gambler", ["taunt"], [E("bc", "gamble", n=6)], "Every toll is somebody's number coming up."),
    ("seraphel", "Seraphel the Fallen", "healer", ["divine", "lifesteal"], [], "Fell from the high tower. Landed angry."),
    ("dragonknight", "The Last Dragon Knight", "champion", ["taunt", "divine"], [E("bc", "equip", a=5, h=2)], "His dragon is bones. His lance is not."),
    ("ossuary", "Ossuary", "collector", [], [E("dr", "resurrect", n=2)], "A cathedral that walks. Its congregation follows."),
    ("inevitable", "The Inevitable", "scientist", ["divine"], [E("bc", "copy")], "You. Again. Always."),
]
for i, row in enumerate(NEM):
    k, nm, cls, kw, fx, fl = row[:6]
    rar = 3 if i >= 18 else 2
    cost = 4 + i // 5
    add(minion(f"ihn_{k}", nm, cls, rar, cost, 0.5, kw, fx, ih_art_(f"nem_{k}", int(h(k) * 9), glow=(255, 70, 50)), g=GI, tr="Nemesis", fl=fl,
               sd=row[6] if len(row) > 6 else None), "ih")

# --- companions
COMP = [  # sprite, name, class, cost, rarity, frac, kw, fx
    ("hound", "War Hound", "champion", 2, 0, .6, ["rush"], [F_ATK(1)]),
    ("cleric", "Ironhold Cleric", "healer", 3, 1, .35, [], [E("eot", "heal", n=3, tg="fhero")]),
    ("squire", "Squire", "champion", 1, 0, .4, ["taunt"], [F_ARM(2)]),
    ("comp_tiger", "Tiger Companion", "champion", 4, 1, .6, ["rush"], [F_ATK(2)]),
    ("comp_imp", "Demon Imp", "champion", 2, 1, .55, [], [E("bc", "dmg", n=2, tg="any")]),
    ("comp_fairy", "Fairy Companion", "healer", 2, 1, .4, ["divine"], [E("bc", "heal", n=3, tg="any")]),
    ("comp_barbarian", "Barbarian Companion", "champion", 4, 1, .6, [], [F_KW("windfury")]),
    ("comp_assassin", "Assassin Companion", "gambler", 3, 1, .6, ["stealth", "poisonous"], []),
    ("comp_necro", "Necromancer Companion", "champion", 4, 2, .45, [], [E("edie", "summon", id="t_bonehound", cnt=1)]),
    ("comp_knight", "Knight Companion", "champion", 4, 1, .45, ["taunt", "divine"], []),
    ("comp_bear", "Armored Bear", "tamer", 5, 2, .45, ["taunt"], [F_ARM(4)]),
    ("comp_ent", "Ent Companion", "tamer", 6, 2, .4, ["taunt", "lifesteal"], [E("eot", "heal", n=3, tg="self")]),
    ("comp_sword", "Excalibur", "champion", 6, 3, .6, ["charge", "divine"], [E("atk", "armor", n=2)]),
    ("comp_goldragon", "Golden Dragon", "collector", 8, 3, .5, ["taunt"], [E("bc", "coin"), E("bc", "coin")]),
    ("band", "The Mariachis", "gambler", 4, 2, .4, [], [E("eot", "buff", a=1, h=0, tg="fm_all")]),
    ("comp_labfreak", "Labfreak, Field Assistant", "scientist", 3, 2, .45, [], [E("bc", "discover", pool="minion")]),
]
for key, nm, cls, cost, rar, frac, kw, fx in COMP:
    add(minion(f"ihc_{key.replace('comp_', '')}", nm, cls, rar, cost, frac, kw, fx, ih_art_(key, 0 if key in ("hound", "squire", "cleric") else int(h(key) * 9)),
               g=GI, tr="Companion", sd=1 if key == "comp_labfreak" else None), "ih")

# --- the champion's looks
LOOKS = [
    ("lk_sov", "The Sovereign", 8, 3, .5, ["taunt", "divine"], [E("bc", "armor", n=8)], "The champion, ascended."),
    ("lk_pyre", "Pyre Knight", 6, 2, .55, ["rush"], [E("frenzy", "dmg", n=2, tg="em_all")], "Walked out of the pyre wearing it."),
    ("lk_set_saint", "Saint of the Hold", 5, 2, .45, ["divine"], [E("eot", "heal", n=3, tg="fhero")], None),
    ("hero_bow", "Champion of the Bow", 3, 1, .55, [], [E("bc", "dmg", n=3, tg="em")], None),
    ("hero_wiz", "Champion of the Staff", 4, 1, .45, [], [E("bc", "draw", n=1)], None),
]
for key, nm, cost, rar, frac, kw, fx, fl in LOOKS:
    add(minion(f"ihk_{key}", nm, "champion", rar, cost, frac, kw, fx, ih_art_(key, 8, glow=(255, 210, 120) if rar >= 2 else None),
               g=GI, tr="Champion", fl=fl, sd=1 if key == "hero_wiz" else None), "ih")

# --- the champion's spells: stances, swings and the plate sets
CH_SPELLS = [
    ("hero_atk_gs", "Greatsword Swing", 0, [E("cast", "hatk", n=4)], 2),
    ("hero_atk_scim", "Scimitar Flurry", 0, [E("cast", "dmg", n=1, tg="am_all"), E("cast", "draw", n=1)], None),
    ("hero_hurt", "Second Wind", 0, [E("cast", "heal", n=6, tg="fhero"), E("cast", "hatk", n=2)], None),
    ("pyre_burst", "Pyre Burst", 1, [E("cast", "dmg", n=3, tg="em_all")], None),
    ("sov_burst", "Sovereign's Light", 2, [E("cast", "dmg", n=2, tg="enemies"), E("cast", "heal", n=4, tg="fhero")], None),
    ("hero_death", "Last Stand", 1, [E("cast", "armor", n=5), E("cast", "kw", k="taunt", tg="fm"), E("cast", "buff", a=0, h=3, tg="fm")], None),
]
for key, nm, rar, fx, cost in CH_SPELLS:
    add(spell(f"ihs_{key}", nm, "champion", rar, cost if cost is not None else spell_cost(fx, 1), fx,
              add_art(bake_sprite(spr(key), radial_bg(IHC), mode="center", scale=0.9)), g=GI), "ih")
SETS = [  # sprite, name, rarity, effects
    ("set_meadow", "Meadow Guard Set", 0, [E("cast", "armor", n=3), E("cast", "draw", n=1)]),
    ("set_goblin", "Goblin Spoils Set", 0, [E("cast", "coin"), E("cast", "coin"), E("cast", "armor", n=2)]),
    ("set_sewer", "Sewer Warden Set", 0, [E("cast", "buff", a=0, h=3, tg="fm"), E("cast", "kw", k="taunt", tg="fm")]),
    ("set_barb", "Barbarian Set", 0, [E("cast", "dmg", n=1, tg="am_all"), E("cast", "armor", n=4)]),
    ("set_giant", "Giant-Hide Set", 1, [E("cast", "armor", n=8)]),
    ("set_frost", "Frostbound Set", 1, [E("cast", "freeze", tg="em_all"), E("cast", "armor", n=3)]),
    ("set_ash", "Ashborn Set", 1, [E("cast", "dmg", n=2, tg="am_all")]),
    ("set_wyrm", "Wyrmscale Set", 1, [E("cast", "buff", a=1, h=1, tg="fm_all"), E("cast", "armor", n=2)]),
    ("set_hold", "Ironhold Set", 2, [E("cast", "armor", n=5), E("cast", "hatk", n=3)]),
    ("set_saint", "Last Saint Set", 2, [E("cast", "heal", n=8, tg="fhero"), E("cast", "kw", k="divine", tg="fm")]),
]
for key, nm, rar, fx in SETS:
    add(spell(f"ihg_{key[4:]}", nm, "champion", rar, spell_cost(fx, 1), fx,
              add_art(bake_sprite(spr(key), radial_bg((150, 160, 180)), mode="stand", scale=0.92)), g=GI, tr="Gear"), "ih")
add(spell("ihs_whetstone", "Oiled Whetstone", "champion", 0, 1, [E("cast", "wbuff", a=2, h=1)],
          icon_art("comp_squire_polish", IHC), g=GI), "ih")

# --- the uniques: weapons (gold ones belong to the Gambler)
for key, (nm, tier, eff, d) in UNIQ.items():
    if key not in ICONS or "uq_" + key not in SPR:
        continue
    gold = "gold" in eff or "luck" in eff
    cls = "gambler" if gold else "champion"
    cost = max(1, min(8, 1 + tier))
    kw = []
    if "leech" in eff: kw.append("lifesteal")
    if key in ("frostbite", "matriarch_breath"): kw = ["frostbite"]
    if key in ("widows_kiss", "sewer_needle", "ratfang"): kw = ["poisonous"] if key == "widows_kiss" else kw
    a = max(1, cost - (1 if kw else 0) + (1 if cost >= 5 else 0))
    dur = 2 if cost <= 3 else 3
    fx = [E("bc", "coin")] if gold and cost >= 4 else []
    if "xp" in eff: fx = [E("bc", "draw", n=1)]
    if "def" in eff: fx = [E("bc", "armor", n=3)]
    rar = 0 if tier <= 1 else 1 if tier <= 4 else 2
    add(weapon(f"ihw_{key}", nm, cls, rar, cost, a, dur, kw, fx, icon_art(key, IHC if cls == "champion" else (150, 200, 90)),
               g=GI, fl=d), "ih")

# --- the realm's monsters and bosses (Neutral), the treasure goblins (Gambler), the omens and the lairs
MOB = [  # sprite, name, class, cost, rarity, frac, kw, fx, area
    ("chicken", "Pasture Chicken", "neutral", 1, 0, .5, [], [E("dr", "coin")], 0),
    ("cow", "Pasture Cow", "neutral", 2, 0, .3, ["taunt"], [], 0),
    ("goblin", "Village Goblin", "neutral", 1, 0, .6, ["rush"], [], 1),
    ("goblin_guard", "Goblin Guard", "neutral", 2, 0, .4, ["taunt"], [F_ATK(1)], 1),
    ("giant_rat", "Giant Rat", "neutral", 1, 0, .5, [], [F_ATK(1)], 2),
    ("giant_spider", "Giant Spider", "neutral", 3, 0, .5, ["poisonous"], [], 2),
    ("skeleton", "Sewer Skeleton", "neutral", 2, 0, .55, ["reborn"], [], 2),
    ("barbarian", "Camp Barbarian", "neutral", 3, 0, .6, [], [F_ATK(2)], 3),
    ("wolf", "Grey Wolf", "neutral", 2, 0, .6, ["rush"], [], 3),
    ("hill_giant", "Hill Giant", "neutral", 6, 0, .45, ["taunt"], [], 4),
    ("moss_giant", "Moss Giant", "neutral", 7, 1, .45, ["taunt", "lifesteal"], [], 4),
    ("ice_warrior", "Ice Warrior", "neutral", 4, 0, .5, ["frostbite"], [], 5),
    ("ice_troll", "Ice Troll", "neutral", 5, 1, .5, ["taunt"], [E("eot", "heal", n=3, tg="self")], 5),
    ("lesser_demon", "Lesser Demon", "neutral", 3, 0, .55, ["rush"], [F_DMG(2)], 6),
    ("greater_demon", "Greater Demon", "neutral", 6, 1, .55, [], [E("bc", "dmg", n=3, tg="rand_enemy"), F_ATK(2)], 6),
    ("green_dragon", "Green Dragon", "neutral", 5, 1, .5, ["lifesteal"], [F_ATK(2)], 7),
    ("blue_dragon", "Blue Dragon", "neutral", 6, 1, .5, ["frostbite"], [E("bc", "freeze", tg="em")], 7),
    ("black_dragon", "Black Dragon", "neutral", 7, 2, .55, [], [E("bc", "dmg", n=2, tg="others")], 7),
    ("tower_sentinel", "Tower Sentinel", "neutral", 4, 0, .4, ["taunt"], [F_ARM(3)], 8),
    ("cursed_knight", "Cursed Knight", "neutral", 4, 1, .55, ["lifesteal"], [F_ATK(2)], 8),
    ("pit_hound", "Pit Hound", "neutral", 2, 0, .6, [], [F_KW("rush"), F_ATK(1)], 8),
    ("gargoyle", "Gargoyle", "neutral", 3, 0, .45, ["taunt", "elusive"], [], 8),
    ("stone_giant", "Stone Giant", "neutral", 8, 1, .45, ["taunt"], [F_ARM(5)], 8),
    ("tower_wyrm", "Tower Wyrm", "neutral", 7, 2, .55, ["elusive"], [F_DMG(4)], 8),
    ("night_wraith", "Night Wraith", "neutral", 3, 1, .55, ["stealth", "lifesteal"], [], 8),
    ("night_mothwitch", "Moth-witch", "neutral", 3, 1, .5, [], [E("bc", "curse", n=2, tg="em")], 8),
    ("night_gravehound", "Gravehound", "neutral", 4, 1, .6, ["rush", "reborn"], [], 8),
    ("gob_gold", "Gold Goblin", "gambler", 2, 1, .5, ["elusive"], [E("dr", "coin"), E("dr", "coin")], 1),
    ("gob_chest", "Chest Goblin", "gambler", 3, 1, .5, [], [E("dr", "draw", n=2)], 1),
    ("gob_jewel", "Jewel Goblin", "gambler", 4, 2, .5, ["stealth"], [E("dr", "discover", pool="legendary")], 1),
    ("gob_loot", "Loot Goblin", "gambler", 2, 0, .5, ["elusive"], [E("dr", "steal")], 1),
    ("gob_rune", "Rune Goblin", "gambler", 3, 1, .5, [], [E("dr", "discover", pool="spell")], 1),
    ("mark_ash", "Herald of the Ashen Sky", "neutral", 4, 1, .5, [], [E("bc", "buff", a=1, h=0, tg="fm_all")], 6),
    ("mark_famine", "Herald of the Gilded Famine", "neutral", 3, 1, .5, [], [E("bc", "coin"), E("bc", "coin")], 7),
    ("mark_twins", "Herald of the Twin Wardens", "neutral", 6, 1, .45, ["taunt"], [E("bc", "copy")], 8),
    ("mark_dead", "Herald of the Restless Dead", "neutral", 5, 1, .5, [], [E("dr", "resurrect", n=1)], 8),
    ("mark_iron", "Herald of the Iron Age", "neutral", 5, 1, .4, ["taunt", "divine"], [F_ARM(3)], 4),
    ("mark_storm", "Herald of Storm Season", "neutral", 4, 1, .6, ["windfury", "rush"], [], 5),
    ("bull", "Bull of the Meadow", "neutral", 5, 2, .6, ["rush"], [F_ATK(3)], 0),
    ("goblin_chieftain", "Goblin Chieftain", "neutral", 6, 2, .5, [], [E("bc", "summon", id="t_goblin", cnt=2)], 1),
    ("sewer_wyrm", "Sewer Wyrm", "neutral", 6, 2, .45, ["taunt", "poisonous"], [], 2),
    ("gunnar", "Warlord Gunnar", "neutral", 7, 2, .6, ["charge"], [F_KW("windfury")], 3),
    ("grothek", "Grothek the Broad", "neutral", 8, 2, .5, ["taunt"], [E("bc", "dmg", n=2, tg="others")], 4),
    ("frost_matriarch", "Frost Matriarch", "neutral", 8, 2, .5, ["frostbite"], [E("bc", "freeze", tg="em_all")], 5),
    ("overlord", "Ashborn Overlord", "neutral", 9, 2, .55, ["lifesteal"], [E("bc", "dmg", n=3, tg="em_all")], 6),
    ("elder_wyrm", "The Elder Wyrm", "neutral", 10, 3, .5, [], [E("bc", "dmg", n=3, tg="enemies")], 7),
]
for key, nm, cls, cost, rar, frac, kw, fx, area in MOB:
    tr = "Omen" if key.startswith("mark_") else "Boss" if rar >= 2 and not key.startswith(("gob_", "mark_")) and key not in ("black_dragon", "tower_wyrm") else \
         "Goblin" if key.startswith("gob_") else "Monster"
    add(minion(f"ihm_{key}", nm, cls, rar, cost, frac, kw, fx, ih_art_(key, area, glow=(255, 90, 60) if tr == "Boss" else None), g=GI, tr=tr), "ih")

LAIRS = [  # name, class, cost, kw, fx
    ("The Mad Bull", "tamer", 5, ["rush"], [F_ATK(3)]),
    ("The Gob-King's Shaman", "gambler", 4, [], [E("bc", "gamble", n=4)]),
    ("The Rat Mother", "scientist", 5, [], [E("dr", "summon", id="t_rat", cnt=3)]),
    ("Gunnar's Champion", "champion", 5, ["taunt"], [F_ARM(5)]),
    ("The Sleeping Giant", "collector", 6, ["taunt"], [E("eot", "armor", n=2)]),
    ("The Ice Wyrmling", "tamer", 4, ["frostbite", "rush"], []),
    ("The Bound Demon", "scientist", 6, ["lifesteal"], [E("bc", "dmg", n=2, tg="enemies")]),
    ("The Elder's Brood", "champion", 6, [], [E("bc", "summon", id="t_wyrmling", cnt=2)]),
]
for i, (nm, cls, cost, kw, fx) in enumerate(LAIRS):
    add(minion(f"ihr_{i}", nm, cls, 1, cost, 0.5, kw, fx, ih_art_(f"lair_{i}", i, glow=(255, 160, 60)), g=GI, tr="Lair Boss"), "ih")
HUNTS = [  # name, class, cost, kw, fx, flavor (Ironhold's own words)
    ("The Auroch King", "tamer", 7, ["taunt"], [F_ATK(4)], "A bull the size of a barn, horns worn to iron on the fence posts of forty years."),
    ("Grizzletooth, Matron of the Warrens", "gambler", 6, [], [E("bc", "summon", id="t_goblin", cnt=3)], "Mother to every goblin you ever killed, and she has counted."),
    ("The Rat Emperor", "collector", 6, [], [E("eot", "summon", id="t_rat", cnt=2)], "A rat grown fat on a sewer's worth of drowned kings."),
    ("Hrothgar Bloodbeard", "champion", 7, ["rush"], [E("bc", "hatk", n=3), F_KW("windfury")], "The warlord's father, who taught him everything but mercy."),
    ("The Hill Father", "healer", 8, ["taunt"], [E("eot", "aoe_heal", n=3, tg="friends")], "The hills are his children; you have been killing his children."),
    ("The White Stag of the Pass", "neutral", 5, ["stealth", "elusive"], [E("bc", "aoe_heal", n=4, tg="friends")], "No one has seen it and lived to say what it is."),
    ("Vhalgor, Duke of Ash", "scientist", 8, [], [E("bc", "dmg", n=3, tg="em_all")], "The ruins were his palace; he wants the furniture back."),
    ("Nyxdrathis the Old", "neutral", 9, [], [E("bc", "missiles", n=8)], "Older than the Elder Wyrm, and never once fooled."),
]
for i, (nm, cls, cost, kw, fx, fl) in enumerate(HUNTS):
    add(minion(f"ihh_{i}", nm, cls, 3, cost, 0.5, kw, fx, ih_art_(f"hunt_{i}", i, glow=(255, 70, 50)), g=GI, tr="Great Hunt", fl=fl), "ih")

# the Champion hero
hero_port = bake_sprite(spr("hero"), AREA_C[8].copy(), mode="stand", glow=(255, 200, 120), scale=0.95)
CHAMP_HERO = {"n": "The Champion", "art": add_art(hero_port),
              "hp": {"n": "Battle Stance", "tx": "Gain 2 Armor. Your hero gets +1 Attack this turn.",
                     "fx": [E("hp", "armor", n=2), E("hp", "hatk", n=1)], "m": 2},
              "col": list(IHC), "bg": "bg_ironhold"}

# ================================================================ THE DEEP CATCH
FA = open(REPO + "workshop/fishing-assets.module.js").read()
FE_IMG = json.loads(re.search(r"const FE_IMG = (\{.*?\});", FA).group(1))
SPECIES = json.loads(re.search(r"const FE_SPECIES_ART = (\{.*?\});", FA).group(1))
FB = open(REPO + "workshop/fishing-spot-bgs.module.js").read()
SPOT = {k: b64img(d) for k, d in re.findall(r'\b(dock|shallows|ledge|midnight|reef|confluence)\s*:\s*"(data:image/[a-z]+;base64,[A-Za-z0-9+/=]+)"', FB)}
SPOT_C = {k: bg_crop(im, blur=1.6, dark=0.7, yfrac=0.72, zoom=1.15) for k, im in SPOT.items()}
SPOTS = ["dock", "shallows", "ledge", "midnight", "reef", "confluence"]
GF = "Odds & Ends Fishing"
DCC = (40, 150, 220)

def fe(key):
    return b64img(FE_IMG[key]).convert("RGBA")

def pix_art(key, spot, glow=None):
    """The species sprites are pixel art: scale by whole pixels (nearest) so they stay crisp."""
    sp = fe(key); bb = sp.getbbox(); sp = sp.crop(bb) if bb else sp
    k = max(1, int(min(CELL * 0.86 / sp.width, CELL * 0.7 / sp.height)))
    sp = sp.resize((sp.width * k, sp.height * k), Image.NEAREST)
    im = SPOT_C[spot].copy().convert("RGBA")
    x, y = (CELL - sp.width) // 2, (CELL - sp.height) // 2 + 6
    if glow:
        a = sp.getchannel("A").filter(ImageFilter.GaussianBlur(5))
        gl = Image.new("RGBA", sp.size, glow + (0,)); gl.putalpha(a.point(lambda v: min(255, int(v * 1.2))))
        im.alpha_composite(gl, (x, y))
    im.alpha_composite(sp, (x, y))
    return add_art(im)

def paint_art(key, spot, scale=0.82, glow=None):
    return add_art(bake_sprite(fe(key), SPOT_C[spot].copy(), mode="center", glow=glow, scale=scale))

def item_art(key, col, scale=0.8):
    return add_art(bake_sprite(fe(key), radial_bg(col), mode="center", scale=scale))

tok("t_fry", "Fry", 1, 1, pix_art("sp_blue6", "shallows"), s="dc")
tok("t_tentacle", "Tentacle", 2, 2, paint_art("squid6", "confluence", scale=0.7), kw=["taunt"], s="dc")

# where each species lives in the card game: class by kind, cost by size
def fish_class(n):
    l = n.lower()
    if any(w in l for w in ("eel", "angler", "ghost", "thunderfin", "megalodon", "snakehead", "bowfin")): return "scientist"
    if any(w in l for w in ("shark", "barracuda", "pike", "muskie", "pickerel", "gar", "wahoo", "tarpon", "trevally", "marlin", "swordfish", "sailfish", "zander", "walleye", "sauger")): return "champion"
    if any(w in l for w in ("golden", "snapper", "halibut", "grouper", "mahi", "porgy", "bream", "croaker", "pinfish", "tuna", "mackerel")): return "collector"
    if any(w in l for w in ("catfish", "bullhead", "burbot", "carp", "barbel", "tench", "drum", "sturgeon")): return "gambler"
    if any(w in l for w in ("sunfish", "bluegill", "crappie", "perch", "pumpkinseed", "warmouth", "bass")): return "healer"
    if any(w in l for w in ("koi", "trout", "salmon", "char", "grayling", "steelhead", "darter", "whitefish", "shad")): return "tamer"
    return "neutral"
SIZE = {  # cost by size; anything not listed is a small fish (cost 1-2)
    "Megalodon Pup": 8, "Great White Shark": 7, "Thunderfin Marlin": 8, "Blue Marlin": 7, "Sailfish": 6, "Swordfish": 6, "Bluefin Tuna": 6,
    "Yellowfin Tuna": 5, "Goliath Grouper": 6, "Beluga Sturgeon": 7, "Lake Sturgeon": 5, "Alligator Gar": 6, "Giant Tarpon": 6,
    "Wels Catfish": 6, "Blue Catfish": 5, "Flathead Catfish": 5, "Tiger Shark": 6, "Hammerhead Shark": 6, "Bull Shark": 5, "Mako Shark": 5,
    "Great Barracuda": 4, "Pacific Halibut": 5, "Abyssal Anglerfish": 5, "Rainbow Serpent Eel": 5, "Moonlit Eel": 4, "Ghost Koi": 4,
    "Golden Koi": 4, "Northern Pike": 4, "Lake Muskie": 5, "Tiger Muskie": 5, "King Salmon": 4, "Atlantic Salmon": 4, "Mahi-Mahi": 4,
    "Giant Trevally": 5, "Wahoo": 4, "King Mackerel": 3, "Red Snapper": 3, "Steelhead": 3, "Striped Bass": 3, "Largemouth Bass": 3,
    "Smallmouth Bass": 3, "Channel Catfish": 3, "Common Carp": 3, "Mirror Carp": 3, "Grass Carp": 3, "Longnose Gar": 3, "Bowfin": 3,
    "Snakehead": 3, "Burbot": 3, "Walleye": 3, "Zander": 3, "Sauger": 2, "Chain Pickerel": 2, "Brown Trout": 3, "Rainbow Trout": 2,
    "Cutthroat Trout": 2, "Brook Trout": 2, "Golden Trout": 3, "Arctic Char": 3, "Coho Salmon": 3, "Sockeye Salmon": 3, "Barbel": 2,
    "Freshwater Drum": 2, "Tench": 2, "Atlantic Mackerel": 2, "Sea Bream": 2, "Porgy": 2, "Spot Croaker": 2, "Arctic Grayling": 2,
    "American Shad": 2, "Lake Whitefish": 2, "White Bass": 2, "Rock Bass": 2, "Black Crappie": 2, "Yellow Perch": 2, "White Perch": 2,
    "Crucian Carp": 2, "Yellow Bullhead": 2, "Brown Bullhead": 2, "Warmouth": 1, "Bluegill": 1, "Pumpkinseed": 1,
}
EPIC = {"Megalodon Pup", "Great White Shark", "Thunderfin Marlin", "Golden Koi", "Ghost Koi", "Moonlit Eel", "Rainbow Serpent Eel",
        "Abyssal Anglerfish", "Beluga Sturgeon", "Goliath Grouper", "Blue Marlin", "Wels Catfish"}
RENAME = {}  # species that share a name with a Core card wear their catch name instead
SPOT_OF = {"scientist": "midnight", "champion": "ledge", "collector": "reef", "gambler": "confluence", "healer": "shallows", "tamer": "dock", "neutral": "shallows"}

def fish_fx(n, cls, cost, rar):
    hv = h(n + "fx")
    if cls == "champion":
        kw = [["rush"], ["rush"], ["charge"], []][int(hv * 4)]
        fx = [] if kw else [E("atk", "dmg", n=1 + rar, tg="rand_enemy")]
        if cost >= 6 and not kw: kw = ["rush"]
        return kw, fx, .6
    if cls == "gambler":
        return ([], [E("bc", "dredge")] + ([E("dr", "coin")] if hv < .5 else []), .5) if hv < .75 else (["taunt"], [E("bc", "dredge")], .4)
    if cls == "healer":
        return ([], [E("bc", "heal", n=2 + cost, tg="any")], .45) if hv < .6 else (["lifesteal"], [], .5)
    if cls == "collector":
        return ([], [E("bc", "dredge"), E("bc", "draw", n=1)] if cost >= 3 else [E("bc", "coin")], .5) if hv < .7 else (["divine"], [E("bc", "dredge")], .5)
    if cls == "tamer":
        return ([], [E("bc", "buff", a=1, h=1, tg="adj")], .5) if hv < .45 else (["lifesteal"], [E("bc", "dredge")], .5) if hv < .75 else (["rush"], [], .55)
    if cls == "scientist":
        return [["elusive"], ["stealth"], ["frostbite"], ["poisonous"]][int(hv * 4)], ([E("bc", "dredge")] if hv < .5 else []), .55
    # neutral small fry
    return ([], [E("bc", "dredge")], .5) if hv < .45 else ([], [E("dr", "summon", id="t_fry", cnt=1)], .5) if hv < .8 else (["rush"], [], .6)

for n, key in sorted(SPECIES.items()):
    cls = fish_class(n)
    cost = SIZE.get(n, 1 + int(h(n) * 2))
    rar = 2 if n in EPIC else 1 if cost >= 5 or h(n + "r") < 0.18 else 0
    kw, fx, frac = fish_fx(n, cls, cost, rar)
    if n == "Megalodon Pup": kw, fx = ["rush"], [E("frenzy", "buff", a=3, h=0, tg="self")]
    if n == "Thunderfin Marlin": kw, fx = ["charge", "windfury"], []
    if n == "Golden Koi": kw, fx = ["divine"], [E("bc", "dredge"), E("bc", "draw", n=2)]
    if n == "Ghost Koi": kw, fx = ["stealth", "elusive"], [E("dr", "discover", pool="minion")]
    if n == "Abyssal Anglerfish": kw, fx = ["stealth"], [E("bc", "destroy", tg="em", max=3)]
    name = n if n.lower() not in CORE_NAMES else ("Trophy " + n)
    RENAME[n] = name
    art = pix_art(key, SPOT_OF[cls], glow=(255, 220, 120) if rar >= 2 else None)
    add(minion(f"dcf_{re.sub(r'[^a-z]+', '_', n.lower()).strip('_')}", name, cls, rar, cost, frac, kw, fx, art, g=GF, tr="Fish"), "dc")

CREATURES = [  # sprite, name, class, cost, rarity, frac, kw, fx, spot
    ("crab1", "Tidepool Hermit", "neutral", 1, 0, .3, ["taunt"], [], "dock"),
    ("crab4", "Armored Crab", "neutral", 3, 0, .35, ["taunt"], [E("frenzy", "armor", n=2)], "reef"),
    ("crab6", "Crystal Crab", "neutral", 5, 1, .35, ["taunt", "divine"], [], "midnight"),
    ("squid2", "Reef Squid", "scientist", 2, 0, .55, ["stealth"], [], "reef"),
    ("squid4", "Ink Squid", "scientist", 3, 1, .5, [], [E("bc", "freeze", tg="em"), E("bc", "dredge")], "midnight"),
    ("squid7", "Leviathan Squid", "scientist", 7, 2, .5, [], [E("bc", "freeze", tg="em_all"), E("dr", "summon", id="t_tentacle", cnt=2)], "confluence"),
    ("seahorse2", "Seahorse Foal", "tamer", 1, 0, .4, [], [E("bc", "buff", a=1, h=1, tg="fm")], "shallows"),
    ("seahorse4", "Coral Seahorse", "tamer", 2, 1, .4, [], [E("bc", "heal", n=3, tg="any"), E("bc", "dredge")], "reef"),
    ("seahorse7", "Dragon Seahorse", "tamer", 4, 2, .5, [], [E("bc", "discover", pool="minion"), E("bc", "dredge")], "reef"),
    ("dolphin2", "Harbor Dolphin", "tamer", 3, 0, .55, ["rush"], [E("bc", "draw", n=1)], "ledge"),
    ("dolphin5", "Silver Dolphin", "tamer", 4, 1, .55, ["rush", "divine"], [], "ledge"),
    ("dolphin7", "Starfall Dolphin", "tamer", 6, 2, .55, ["charge"], [E("bc", "dredge"), E("bc", "draw", n=1)], "midnight"),
    ("whale3", "Bluewater Whale", "healer", 6, 0, .3, ["taunt"], [E("bc", "aoe_heal", n=3, tg="friends")], "ledge"),
    ("whale5", "Ironback Whale", "healer", 8, 1, .35, ["taunt", "divine"], [], "ledge"),
    ("whale7", "Moonwhale", "healer", 9, 2, .35, ["taunt", "lifesteal"], [E("bc", "aoe_heal", n=6, tg="friends")], "midnight"),
    ("fish4", "Glassfin", "neutral", 2, 0, .5, ["elusive"], [], "reef"),
    ("fish7", "Prismfin", "neutral", 4, 1, .5, ["divine"], [E("bc", "dredge")], "reef"),
    ("shark7", "Bronze Reef Shark", "champion", 4, 0, .6, ["rush"], [F_ATK(2)], "reef"),
]
for key, nm, cls, cost, rar, frac, kw, fx, spot in CREATURES:
    add(minion(f"dcm_{key}", nm, cls, rar, cost, frac, kw, fx, paint_art(key, spot), g=GF, tr="Sea"), "dc")

TREASURE = [  # sprite, name, class, rarity, effects, colour
    ("chest2", "Waterlogged Chest", "collector", 0, [E("cast", "dredge"), E("cast", "draw", n=2)]),
    ("chest4", "Pirate's Chest", "collector", 1, [E("cast", "discover", pool="any"), E("cast", "coin")]),
    ("chest6", "Abyssal Chest", "collector", 2, [E("cast", "draw", n=3), E("cast", "dredge")]),
    ("bag2", "Coin Purse", "gambler", 0, [E("cast", "coin"), E("cast", "coin")]),
    ("bag4", "Velvet Pouch", "gambler", 1, [E("cast", "gamble", n=4), E("cast", "dredge")]),
    ("bag6", "Black Pouch", "gambler", 2, [E("cast", "steal"), E("cast", "steal")]),
    ("gem3", "Sea Glass", "collector", 0, [E("cast", "kw", k="divine", tg="fm"), E("cast", "draw", n=1)]),
    ("gem4", "Ruby of the Reef", "collector", 1, [E("cast", "buff", a=3, h=3, tg="fm")]),
    ("gem7", "Abyss Opal", "collector", 2, [E("cast", "discover", pool="legendary")]),
    ("key1", "Rusty Key", "gambler", 0, [E("cast", "dredge"), E("cast", "mana", n=1)]),
    ("key4", "Captain's Key", "healer", 1, [E("cast", "resurrect", n=1), E("cast", "dredge")]),
    ("key7", "The Drowned King's Key", "scientist", 2, [E("cast", "resurrect", n=2), E("cast", "dredge")]),
    ("medal3", "Angler's Medal", "champion", 0, [E("cast", "armor", n=4), E("cast", "hatk", n=2)]),
    ("medal5", "Tournament Medal", "healer", 1, [E("cast", "heal", n=6, tg="any"), E("cast", "draw", n=1)]),
    ("medal7", "Medal of the Five Waters", "tamer", 2, [E("cast", "buff", a=2, h=2, tg="fm_all")]),
    ("bucketp3", "Bait Bucket", "tamer", 0, [E("cast", "summon", id="t_fry", cnt=2), E("cast", "dredge")]),
    ("flaskp4", "Angler's Flask", "healer", 0, [E("cast", "heal", n=5, tg="fhero"), E("cast", "dredge")]),
    ("lanternp5", "Night Lantern", "scientist", 1, [E("cast", "draw", n=2), E("cast", "dredge")]),
    ("barrelp4", "Barrel of Brine", "scientist", 1, [E("cast", "freeze", tg="em_all"), E("cast", "dmg", n=1, tg="em_all")]),
    ("bedrollp3", "Angler's Bedroll", "champion", 0, [E("cast", "armor", n=6), E("cast", "dredge")]),
]
for key, nm, cls, rar, fx in TREASURE:
    add(spell(f"dct_{key}", nm, cls, rar, spell_cost(fx), fx, item_art(key, NS["CCOL"][cls]), g=GF, tr="Treasure" if key[:3] in ("che", "bag", "gem", "key", "med") else "Tackle"), "dc")
RODS = [("pole1", "Cane Pole", "collector", 1, 0, 1, 3), ("pole3", "Fiberglass Rod", "collector", 3, 0, 2, 3),
        ("pole5", "Carbon Rod", "champion", 4, 1, 3, 3), ("pole7", "Abyssal Rod", "gambler", 6, 2, 4, 3)]
for key, nm, cls, cost, rar, a, dur in RODS:
    add(weapon(f"dcw_{key}", nm, cls, rar, cost, a, dur, [], [E("bc", "dredge")] + ([E("bc", "draw", n=1)] if cost >= 4 else []),
               item_art(key, NS["CCOL"][cls], scale=0.9), g=GF, tr="Tackle"), "dc")

# the six Legends of the fishing game, painted from their own cinematics
CINE = {}
for k in ("ironjaw", "marshking", "palehunter", "roosterking", "blackphantom", "drownedking"):
    src = open(REPO + f"workshop/fishing-cine-{k}.module.js").read()
    fr = re.findall(r'"(data:image/[^"]+)"', re.search(r"fury:\s*\[(.*?)\]", src, re.S).group(1))
    im = b64img(fr[len(fr) // 2]).convert("RGB")
    w = im.width; top = int(im.height * 0.12)
    CINE[k] = im.crop((0, top, w, top + w)).resize((CELL, CELL), Image.LANCZOS)
LEGENDS = [
    ("ironjaw", "Old Ironjaw", "gambler", 7, ["taunt", "divine"], [E("bc", "dredge"), E("bc", "dredge")], "The dock's oldest story. Bent three gaffs, they say."),
    ("marshking", "The Marsh King", "tamer", 7, ["rush", "lifesteal"], [E("atk", "dmg", n=2, tg="rand_enemy")], "A dragon in the reeds. The lilies part when it passes."),
    ("palehunter", "The Pale Hunter", "champion", 8, ["rush"], [E("frenzy", "buff", a=3, h=3, tg="self"), E("atk", "armor", n=3)], "Two colors, no mercy. The gulls go quiet when it's near."),
    ("roosterking", "The Rooster King", "collector", 7, ["divine"], [E("bc", "dredge"), E("bc", "draw", n=2), E("bc", "coin")], "Its comb breaks the surface like a crown. Bow or reel."),
    ("blackphantom", "The Black Phantom", "scientist", 7, ["stealth", "elusive"], [E("bc", "destroy", tg="em")], "Older than the Mark itself. Seen only as an absence of stars."),
    ("drownedking", "The Drowned King", "neutral", 10, ["taunt"], [E("bc", "summon", id="t_tentacle", cnt=3), E("bc", "dredge")], "The five Legends were only his heralds."),
]
for k, nm, cls, cost, kw, fx, fl in LEGENDS:
    add(minion(f"dcl_{k}", nm, cls, 3, cost, 0.5, kw, fx, add_art(CINE[k]), g=GF, tr="Legend", fl=fl), "dc")

# ================================================================ TRICKS OF THE TRADE
# A spell expansion (set "tt"): every class gets new spells built around synergies - tribes, Attack, cost,
# rarity, weapons, spells cast this turn - drawn on Ironhold Idle's trinkets and the Odds & Ends curios.
GT = "Tricks of the Trade"
def oe_item(slug, col):
    im = Image.open(REPO + f"art/{slug}.webp").convert("RGB")
    return add_art(im.resize((CELL, CELL), Image.LANCZOS))
IF = lambda **k: {"if": k}
TT = {  # class: [(art, name, rarity, effects, cost or None)]  art = Ironhold icon key, or "oe:<slug>" for an Odds & Ends curio
    "tamer": [
        ("comp_fairy_pixiedust", "Pixie Dust", 1, [E("cast", "buff", a=1, h=1, tg="fm_all")], None),
        ("comp_ent_acorn", "Seed of Plenty", 0, [E("cast", "tutor", f={"tr": "Beast"}), E("cast", "reduce", n=1, f={"tr": "Beast"})], None),
        ("comp_tiger_sabrefang", "Sabre Strike", 0, [E("cast", "dmg", n=3, tg="em"), E("cast", "draw", n=1, **IF(ctrl={"tr": "Beast"}))], None),
        ("comp_bear_honeypot", "Honeypot", 0, [E("cast", "buff", a=2, h=2, tg="fm", f={"tr": "Beast"}, tx="Give one of your Beasts +2 Attack, +2 Health and Guard"), E("cast", "kw", k="taunt", tg="fm", f={"tr": "Beast"}, tx="")], None),
        ("comp_fairy_moonflower", "Moonflower", 1, [E("cast", "heal", n=3, tg="fhero", per={"tr": "Bloom"}), E("cast", "draw", n=1)], None),
        ("comp_ent_heartwood", "Heartwood", 1, [E("cast", "buff", a=0, h=3, tg="fm_all", f={"tr": "Stone"}), E("cast", "armor", n=3)], None),
        ("comp_fairy_dew", "Morning Dew", 0, [E("cast", "buff", a=1, h=1, tg="fm_all", f={"tr": "Tide"}), E("cast", "draw", n=1)], None),
        ("comp_tiger_ambereye", "Amber Eye", 2, [E("cast", "discover", pool="legendary", f={"r": 3, "t": "m"})], None),
        ("comp_ent_leafcrown", "Crown of Leaves", 1, [E("cast", "buff", a=2, h=0, tg="fm_all", f={"amax": 2})], None),
        ("comp_fairy_wand", "Spark Wand", 1, [E("cast", "dmg", n=1, tg="enemy"), E("cast", "dmg", n=1, tg="enemy", per={"tr": "Volt"}, tx="It takes 1 more damage for each Volt minion you control")], None),
        ("comp_bear_berries", "Wild Berries", 0, [E("cast", "hbuff", a=1, h=1)], None),
        ("comp_tiger_bell", "Tamer's Bell", 2, [E("cast", "tutor", f={"r": 2}, tx="Draw two Epic or Legendary cards from your deck"), E("cast", "tutor", f={"r": 2}, tx="")], None),
    ],
    "scientist": [
        ("comp_labfreak_vial", "Unstable Vial", 1, [E("cast", "dmg", n=3, tg="em_all", f={"amax": 3})], None),
        ("comp_labfreak_formula", "Formula X", 0, [E("cast", "reduce", n=1, f={"t": "s"}), E("cast", "draw", n=1)], None),
        ("comp_labfreak_flask", "Spore Flask", 0, [E("cast", "summon", id="t_spore", cnt=2), E("cast", "summon", id="t_spore", cnt=2, **IF(ctrl={"tr": "Spore"}), tx="If you control a Spore minion, summon two more")], None),
        ("comp_labfreak_goggles", "Safety Goggles", 0, [E("cast", "kw", k="divine", tg="fm_all", f={"tr": "Static"}), E("cast", "draw", n=1)], None),
        ("comp_labfreak_coat", "Lab Coat", 1, [E("cast", "armor", n=4), E("cast", "draw", n=2, **IF(spells=2))], None),
        ("comp_labfreak_glove", "Rubber Glove", 0, [E("cast", "destroy", tg="em", max=2), E("cast", "draw", n=1, **IF(ctrl={"tr": "Circuit"}))], None),
        ("comp_necro_voidink", "Void Ink", 0, [E("cast", "discover", pool="spell", f={"t": "s", "mmax": 2}), E("cast", "reduce", n=1, f={"t": "s"})], None),
        ("comp_necro_soulshard", "Soul Shard", 1, [E("cast", "dmg", n=2, tg="m"), E("cast", "dmg", n=2, tg="m", per={"tr": "Gloom"}, tx="It takes 2 more damage for each Gloom minion you control")], None),
        ("comp_imp_brimstone", "Brimstone", 1, [E("cast", "destroy", tg="em", min=5)], None),
        ("comp_imp_contract", "Infernal Contract", 1, [E("cast", "tutor", f={"t": "s"}, tx="Draw two spells from your deck"), E("cast", "tutor", f={"t": "s"}, tx="")], None),
        ("comp_necro_witherrose", "Wither Rose", 0, [E("cast", "curse", n=1, tg="em_all"), E("cast", "heal", n=2, tg="fhero", per={"tr": "Moss"})], None),
        ("comp_necro_phylactery", "Phylactery", 2, [E("cast", "resurrect", n=2), E("cast", "hbuff", a=1, h=1)], None),
    ],
    "champion": [
        ("comp_knight_swordcharm", "Sword Charm", 0, [E("cast", "wbuff", a=1, h=1), E("cast", "tutor", f={"t": "w"})], None),
        ("comp_barbarian_warpaint", "War Paint", 1, [E("cast", "buff", a=1, h=0, tg="fm_all"), E("cast", "buff", a=0, h=1, tg="fm_all", **IF(weapon=True))], None),
        ("comp_barbarian_meadhorn", "Mead Horn", 0, [E("cast", "dmg", n=1, tg="am_all"), E("cast", "armor", n=1, per={})], None),
        ("comp_knight_vowscroll", "Vow Scroll", 1, [E("cast", "buff", a=1, h=1, tg="fm_all", f={"tr": ["Lieutenant", "Nemesis"]}), E("cast", "draw", n=1)], None),
        ("comp_barbarian_throwingaxe", "Throwing Axe", 0, [E("cast", "dmg", n=2, tg="any"), E("cast", "dmg", n=2, tg="any", **IF(weapon=True), tx="If you have a weapon, deal 2 more")], None),
        ("comp_hound_whistle", "Hound Whistle", 0, [E("cast", "summon", id="t_bonehound", cnt=2)], None),
        ("comp_knight_heater", "Heater Shield", 1, [E("cast", "armor", n=5), E("cast", "buff", a=1, h=1, tg="fm_all", f={"kw": "taunt"})], None),
        ("comp_barbarian_oathring", "Oath Ring", 1, [E("cast", "hatk", n=3), E("cast", "draw", n=1, **IF(weapon=True))], None),
        ("comp_hound_steak", "Raw Steak", 0, [E("cast", "buff", a=3, h=3, tg="fm", f={"tr": ["Beast", "Monster", "Companion"]})], None),
        ("comp_sword_runeoil", "Rune Oil", 1, [E("cast", "wbuff", a=2, h=0), E("cast", "hatk", n=2)], None),
        ("comp_knight_pennant", "Battle Pennant", 0, [E("cast", "kw", k="rush", tg="fm_all", f={"tr": ["Lieutenant", "Nemesis"]}, tx="Give your Lieutenants and Nemeses +1 Attack and Quick"), E("cast", "buff", a=1, h=0, tg="fm_all", f={"tr": ["Lieutenant", "Nemesis"]}, tx="")], None),
        ("comp_sword_prayer", "Last Prayer", 2, [E("cast", "destroy", tg="em", min=5), E("cast", "armor", n=5)], None),
    ],
    "healer": [
        ("comp_cleric_holywater", "Holy Water", 0, [E("cast", "aoe_heal", n=3, tg="friends"), E("cast", "draw", n=1, **IF(hurt=True))], None),
        ("comp_cleric_scripture", "Scripture", 0, [E("cast", "tutor", f={"tr": ["Party", "Signature"]}), E("cast", "heal", n=3, tg="fhero")], None),
        ("comp_cleric_bandage", "Bandage Roll", 0, [E("cast", "heal", n=8, tg="m", tx="Heal a minion for 8 and give it Guard"), E("cast", "kw", k="taunt", tg="m", tx="")], None),
        ("comp_cleric_beads", "Prayer Beads", 1, [E("cast", "buff", a=1, h=2, tg="fm_all", f={"tr": ["Party", "Signature", "Swarm"]})], None),
        ("comp_cleric_crucifix", "Blessed Ward", 1, [E("cast", "kw", k="divine", tg="fm_all", f={"amax": 2})], None),
        ("comp_fairy_locket", "Healing Locket", 0, [E("cast", "heal", n=2, tg="fhero", per={}), E("cast", "draw", n=1)], None),
        ("comp_cleric_sash", "Cleric's Sash", 1, [E("cast", "buff", a=2, h=4, tg="fm", tx="Give one of your minions +2 Attack, +4 Health and Lifesteal"), E("cast", "kw", k="lifesteal", tg="fm", tx="")], None),
        ("comp_cleric_staffcharm", "Smite the Mighty", 1, [E("cast", "destroy", tg="em", min=6)], None),
        ("comp_knight_clasp", "Steadfast Clasp", 0, [E("cast", "buff", a=0, h=2, tg="fm_all", f={"kw": "taunt"}), E("cast", "armor", n=3)], None),
        ("comp_fairy_ribbon", "Second Chance", 1, [E("cast", "kw", k="reborn", tg="fm", tx="Heal one of your minions for 4 and give it Comes Back"), E("cast", "heal", n=4, tg="fm", tx="")], None),
        ("comp_squire_ribbon", "Thank-You Note", 2, [E("cast", "draw", n=1, per={"tr": ["Party", "Signature"]}), E("cast", "aoe_heal", n=2, tg="friends")], None),
    ],
    "collector": [
        ("comp_goldragon_hoardcoin", "Hoard Coin", 0, [E("cast", "coin"), E("cast", "reduce", n=1, f={"tr": "Mech"})], None),
        ("comp_goldragon_eyegem", "Dragon's Eye", 1, [E("cast", "discover", pool="minion", f={"tr": "Mech"}), E("cast", "reduce", n=1, f={"tr": "Mech"})], None),
        ("comp_goldragon_crown", "Gilded Crown", 1, [E("cast", "buff", a=1, h=1, tg="fm_all", f={"tr": "Mech"}), E("cast", "coin")], None),
        ("comp_goldragon_scale", "Appraisal", 2, [E("cast", "draw", n=1, per={"r": 2}), E("cast", "armor", n=3)], None),
        ("comp_goldragon_wyrmheart", "Wyrmheart", 2, [E("cast", "armor", n=8), E("cast", "draw", n=2, **IF(ctrl={"r": 3}))], None),
        ("oe:vintage-pocket-watch", "Pocket Watch", 0, [E("cast", "mana", n=2)], None),
        ("oe:kaleidoscope", "Kaleidoscope", 1, [E("cast", "discover", pool="any", f={"mmin": 5})], None),
        ("oe:compass", "Wayfinder's Compass", 0, [E("cast", "tutor", f={"tr": "Mech"}), E("cast", "tutor", f={"t": "s"})], None),
        ("oe:brass-telescope", "Brass Telescope", 1, [E("cast", "discover", pool="any", f={"r": 2}), E("cast", "draw", n=1)], None),
        ("oe:swiss-army-knife", "Swiss Army Knife", 0, [E("cast", "dmg", n=2, tg="any"), E("cast", "armor", n=2), E("cast", "coin")], None),
        ("oe:golden-egg-timer", "Golden Egg Timer", 1, [E("cast", "reduce", n=1, f={"mmin": 5}), E("cast", "draw", n=1)], None),
        ("oe:genuine-meteorite-fragment", "Meteorite Fragment", 2, [E("cast", "dmg", n=5, tg="em"), E("cast", "dmg", n=2, tg="em_all", f={"amax": 2})], None),
    ],
    "gambler": [
        ("comp_assassin_contract", "Shady Contract", 0, [E("cast", "steal"), E("cast", "steal", **IF(weapon=True), tx="If you have a weapon, steal another")], None),
        ("comp_assassin_poison", "Poison Vial", 0, [E("cast", "kw", k="poisonous", tg="fm"), E("cast", "draw", n=1)], None),
        ("comp_assassin_smokebomb", "Smoke Bomb", 1, [E("cast", "kw", k="stealth", tg="fm_all")], None),
        ("comp_assassin_lotus", "Black Lotus", 1, [E("cast", "destroy", tg="em", max=3), E("cast", "coin")], None),
        ("comp_imp_hellberries", "Hell Berries", 0, [E("cast", "gamble", n=3, tx="Spin! twice. Each time, randomly: 3 damage to a random enemy, OR heal your hero for 3, OR draw a card"), E("cast", "gamble", n=3, tx="")], None),
        ("comp_assassin_wristblades", "Wrist Blades", 1, [E("cast", "equip", a=2, h=2), E("cast", "tutor", f={"t": "w"})], None),
        ("comp_imp_pitchfork", "Pitchfork Rally", 1, [E("cast", "buff", a=2, h=1, tg="fm_all", f={"tr": ["Enemy", "Boss", "Goblin"]})], None),
        ("oe:grandfather-s-lucky-coin", "Grandfather's Lucky Coin", 2, [E("cast", "coin"), E("cast", "coin"), E("cast", "gamble", n=4)], None),
        ("oe:straight-razor", "Straight Razor", 0, [E("cast", "dmg", n=2, tg="em"), E("cast", "dmg", n=2, tg="em", **IF(weapon=True), tx="If you have a weapon, deal 2 more")], None),
    ],
}
for cls, lst in TT.items():
    for art, nm, rar, fx, cost in lst:
        col = NS["CCOL"][cls]
        a = oe_item(art[3:], col) if art.startswith("oe:") else icon_art(art, col)
        add(spell(f"tt_{re.sub(r'[^a-z]+', '_', nm.lower()).strip('_')}", nm, cls, rar, cost if cost is not None else spell_cost(fx, 1), fx, a, g=GT, tr="Trick"), "tt")
TT_W = [  # weapons: the synergy lands when you equip them
    ("wep_3_greatsword", "Tower Greatsword", "champion", 3, 1, 3, 2, [E("bc", "buff", a=1, h=0, tg="fm_all", f={"kw": "taunt"})]),
    ("wep_5_battleaxe", "Frenzied Axe", "champion", 4, 1, 3, 3, [E("bc", "dmg", n=1, tg="am_all")]),
    ("wep_4_longsword", "Knight's Longsword", "champion", 4, 2, 4, 2, [E("bc", "tutor", f={"tr": ["Lieutenant", "Nemesis"]})]),
    ("wep_2_dagger", "Coin Dagger", "gambler", 1, 0, 1, 2, [E("bc", "coin")]),
    ("wep_6_knives", "Twin Knives", "gambler", 3, 1, 2, 3, [E("bc", "kw", k="poisonous", tg="fm")]),
    ("wep_7_scimitar", "Gilded Scimitar", "gambler", 5, 2, 4, 3, [E("bc", "buff", a=1, h=1, tg="fm_all", f={"tr": ["Enemy", "Boss", "Goblin"]})]),
]
for art, nm, cls, cost, rar, a, dur, fx in TT_W:
    add(weapon(f"ttw_{re.sub(r'[^a-z]+', '_', nm.lower()).strip('_')}", nm, cls, rar, cost, a, dur, [], fx, icon_art(art, NS["CCOL"][cls], 0.85), g=GT, tr="Trick"), "tt")

# ================================================================ write
def save_sheets():
    out = []
    for i, sheet in enumerate(SHEETS):
        atlas = Image.new("RGB", (8 * CELL, 8 * CELL), (0, 0, 0))
        for j, im in enumerate(sheet):
            atlas.paste(im, ((j % 8) * CELL, (j // 8) * CELL))
        name = f"img/a{BASE + i:02d}.webp"
        atlas.save(os.path.join(LEG, name), quality=74, method=6)
        out.append(name)
    return out
DATA["sheets"] = CORE_SHEETS + save_sheets()
board = AREA_BG[8].convert("RGB"); board.thumbnail((1280, 1280))
board.save(os.path.join(LEG, "img/bg_ironhold.webp"), quality=72, method=6)
DATA["boards"]["bg_ironhold"] = "img/bg_ironhold.webp"
DATA["heroes"]["champion"] = CHAMP_HERO
def clean(c):
    return {k: v for k, v in c.items() if v not in (None, [], "") or k in ("kw", "fx")}
DATA["cards"] += [clean(c) for c in CARDS]
DATA["tokens"].update({k: clean(v) for k, v in TOKENS.items()})
DATA["sets"] = [{"id": "core", "n": "Core Set"}, {"id": "ih", "n": "Siege of Ironhold", "kw": "Frenzy"},
                {"id": "dc", "n": "The Deep Catch", "kw": "Dredge"}, {"id": "tt", "n": "Tricks of the Trade", "kw": "Synergy spells"}]
with open(DATA_JS, "w") as f:
    f.write("window.LL_DATA=" + json.dumps(DATA, separators=(",", ":")) + ";")
from collections import Counter
for s in ("ih", "dc", "tt"):
    cs = [c for c in CARDS if c["s"] == s]
    print(s, len(cs), dict(Counter(c["c"] for c in cs)), dict(Counter(c["r"] for c in cs)), dict(Counter(c["t"] for c in cs)))
print("sheets", len(DATA["sheets"]), "renamed", {k: v for k, v in RENAME.items() if k != v})
