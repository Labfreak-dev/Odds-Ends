"""Labfreak Legends: build the card pool and art atlases from every Labfreak set and the repo's game art.

Cards are data the JS engine reads. Every card's text is written from its effects (describe()),
so what a card says is what it does."""
import json, os, re, sys, math, random, hashlib, glob, io
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

REPO = "/home/claude/labfreak-dev/odds-ends/"
SCR = "/tmp/claude-0/-home-claude/b87feb6a-177e-51c2-9e93-a82d72e204cd/scratchpad/"
CACHE = SCR + "v4/cache/"
OUT = "/home/claude/LabfreakLegends/"
os.makedirs(OUT + "img", exist_ok=True)
os.makedirs(OUT + "data", exist_ok=True)
G = json.load(open(SCR + "v3/glim.json"))
GM = json.load(open(SCR + "v3/games.json"))
rng = random.Random(2026)

def h(s):  # stable hash 0..1
    return int(hashlib.md5(s.encode()).hexdigest()[:8], 16) / 0xFFFFFFFF

def title(k):
    k = re.sub(r"_alt$", "", k)
    return " ".join(w.capitalize() for w in re.split(r"[_\-]", k) if w)

CLS = {"tamer": "Tamer", "gambler": "Gambler", "healer": "Healer", "collector": "Collector", "scientist": "Scientist", "neutral": "Neutral"}
CCOL = {"tamer": (90, 200, 255), "gambler": (150, 200, 90), "healer": (240, 190, 90), "collector": (60, 210, 190),
        "scientist": (255, 110, 225), "neutral": (190, 180, 160)}
KWV = {"taunt": 0.75, "charge": 2.0, "rush": 1.0, "divine": 2.0, "windfury": 1.5, "stealth": 0.5, "poisonous": 1.5,
       "lifesteal": 1.0, "reborn": 2.0, "frostbite": 1.0, "enrage": 1.0, "cantattack": -2.5, "misfire": -1.0, "elusive": 1.0}

# ------------------------------------------------------------------ effect text (plain English)
TG = {"any": " to any target", "enemy": " to an enemy", "m": " to a minion", "em": " to an enemy minion", "fm": " to one of your minions",
      "ehero": " to the enemy hero", "fhero": " to your hero", "self": " to itself", "em_all": " to ALL enemy minions",
      "am_all": " to ALL minions", "others": " to ALL other minions", "enemies": " to ALL enemies", "rand_enemy": " to a random enemy",
      "rand_em": " to a random enemy minion", "friends": " to all your characters", "fm_all": " to your other minions", "adj": " to the minions next to it",
      "trig": " to it"}
TGO = {"any": "any character", "enemy": "an enemy", "m": "a minion", "em": "an enemy minion", "fm": "one of your minions",
       "ehero": "the enemy hero", "fhero": "your hero", "self": "itself", "em_all": "ALL enemy minions",
       "am_all": "ALL minions", "others": "ALL other minions", "enemies": "ALL enemies", "rand_enemy": "a random enemy",
       "rand_em": "a random enemy minion", "friends": "all your characters", "fm_all": "your other minions", "adj": "the minions next to it",
       "trig": "it"}
TRIG = {"bc": "When played: ", "dr": "When it dies: ", "eot": "End of your turn: ", "sot": "Start of your turn: ",
        "atk": "When it attacks: ", "dmg": "When it takes damage: ", "fspell": "After you cast a spell: ",
        "heal": "When anything is healed: ", "edie": "When an enemy minion dies: ", "combo": "If you played another card first this turn: ",
        "fsum": "When you summon a minion: ", "cast": "", "aura": ""}
SEC = {"eattack": "when an enemy attacks", "eminion": "after your opponent plays a minion", "espell": "when your opponent casts a spell",
       "fdie": "when one of your minions dies", "ehp": "when your hero takes damage"}
# plain-English keyword names (internal ids stay the same)
KWN = {"taunt": "Guard", "charge": "Haste", "rush": "Quick", "divine": "Shield", "windfury": "Double Strike", "stealth": "Hidden",
       "poisonous": "Deadly", "lifesteal": "Lifesteal", "reborn": "Comes Back", "frostbite": "Freezes anything it damages",
       "enrage": "+2 Attack while hurt", "cantattack": "Can't attack", "misfire": "Attacks a random enemy", "elusive": "Spells can't target it"}
REMIND = {"taunt": "enemies must attack it first", "charge": "can attack right away", "rush": "can attack minions right away",
          "divine": "blocks the first hit", "windfury": "attacks twice a turn", "stealth": "can't be targeted until it attacks",
          "poisonous": "kills any minion it damages", "lifesteal": "damage it deals heals your hero", "reborn": "returns with 1 Health the first time it dies"}
TOKENS = {}

def tok(tid, name, a, hp, kw=None, art=None, cls="neutral", fx=None):
    TOKENS[tid] = {"id": tid, "n": name, "c": cls, "t": "m", "r": 0, "m": max(0, (a + hp - 1) // 2), "a": a, "h": hp,
                   "kw": kw or [], "fx": fx or [], "art": art, "token": 1}
    return tid

def stats(a, h):
    if a and h: return f"+{a} Attack and +{h} Health"
    if a: return f"+{a} Attack"
    return f"+{h} Health"

def who(tg, default="a minion"):
    return TGO.get(tg, default) if tg not in ("any", "m") else default

# ---- synergy filters: f = {tr, r, amin, amax, mmin, mmax, kw, t} (see match() in js/engine.js)
RAR_N = ["Common", "Rare", "Epic", "Legendary"]
def fnoun(f, plural=False, kind="minion"):
    """'Beast' / 'Beasts', 'Legendary minion', 'minions with 2 or less Attack', 'spell'..."""
    f = f or {}
    if f.get("t") == "m": kind = "minion"
    if f.get("t") == "s": kind = "spell"
    elif f.get("t") == "w": kind = "weapon"
    tr = f.get("tr")
    PLW = {"Fish": "Fish", "Party": "Party members", "Boss": "Bosses", "Mech": "Mechs", "Sea": "Sea creatures", "Signature": "Signatures", "Swarm": "Swarms", "Nemesis": "Nemeses", "Enemy": "Enemies"}
    if isinstance(tr, list):   # several tribes: name them all, plural if asked
        names = [(PLW.get(t, t + "s") if plural else t) for t in tr]
        return (", ".join(names[:-1]) + " or " + names[-1])
    head = tr if tr else kind
    if tr and kind == "minion" and isinstance(tr, str) and tr in ELEMENTS: head = f"{tr} minion"
    if f.get("r") is not None: head = {0: "", 1: "Rare or better ", 2: "Epic or Legendary ", 3: "Legendary "}[f["r"]] + head
    if plural:
        last = head.split(" ")[-1]
        pl = {"Fish": "Fish", "Party": "Party members", "Boss": "Bosses", "Mech": "Mechs", "Sea": "Sea creatures", "Nemesis": "Nemeses", "Enemy": "Enemies"}.get(last, last + "s")
        head = head[: len(head) - len(last)] + pl
    tail = []
    if f.get("amin") is not None: tail.append(f"{f['amin']} or more Attack")
    if f.get("amax") is not None: tail.append(f"{f['amax']} or less Attack")
    if f.get("kw"): tail.append(KWN[f["kw"]])
    s = head + (" with " + " and ".join(tail) if tail else "")
    if f.get("mmax") is not None: s += f" that cost{'' if plural else 's'} {f['mmax']} or less"
    if f.get("mmin") is not None: s += f" that cost{'' if plural else 's'} {f['mmin']} or more"
    return s
ELEMENTS = {"Ember", "Tide", "Bloom", "Volt", "Stone", "Shade", "Frost", "Gale", "Metal", "Mystic", "Moss", "Rust", "Gloom", "Static", "Circuit", "Spore"}
def a_(noun): return ("an " if noun[:1].lower() in "aeiou" else "a ") + noun
def tphrase(e, to=False):
    """Who an effect hits, in words, honouring a filter."""
    tg, f = e.get("tg", "any"), e.get("f")
    if not f: return (TG.get(tg, "") if to else TGO.get(tg, "any character"))
    one, many = fnoun(f), fnoun(f, True)
    w = {"any": a_(one), "m": a_(one), "em": "an enemy " + one, "fm": "one of your " + many, "em_all": "ALL enemy " + many,
         "am_all": "ALL " + many, "others": "ALL other " + many, "fm_all": "your other " + many, "rand_em": "a random enemy " + one}.get(tg, many)
    return (" to " + w) if to else w

def eff_text(e):
    if "tx" in e: return e["tx"]   # hand-written wording for an effect that reads better joined to the one before
    op, tg = e["op"], e.get("tg", "any")
    n = e.get("n", 0)
    F = bool(e.get("f"))
    if op == "dmg": s = f"Deal {n} damage{tphrase(e, True)}"
    elif op == "heal": s = f"Heal {tphrase(e)} for {n}"
    elif op == "buff": s = f"Give {tphrase(e) if F else who(tg)} {stats(e['a'], e['h'])}" if tg != "self" else f"Gain {stats(e['a'], e['h'])}"
    elif op == "kw": s = (f"Give {tphrase(e) if F else who(tg)} {KWN[e['k']]}" if tg != "self" else f"Gain {KWN[e['k']]}")
    elif op == "armor": s = f"Gain {n} Armor"
    elif op == "draw": s = f"Draw {'a card' if n == 1 else str(n) + ' cards'}"
    elif op == "summon":
        t = TOKENS.get(e["id"])
        c = e.get("cnt", 1)
        s = f"Summon {'a' if c == 1 else ['', '', 'two', 'three'][c]} {t['a']}/{t['h']} {t['n']}{'' if c == 1 else 's'}" if t else "Summon a minion"
    elif op == "freeze": s = f"Freeze {tphrase(e) if F else (TGO.get(tg, 'any character') if tg != 'any' else 'any character')}"
    elif op == "silence": s = f"Remove all abilities from {who(tg)}"
    elif op == "destroy": s = f"Destroy {tphrase(e) if F else who(tg)}" + (f" with {e['max']} or less Attack" if e.get("max") is not None else "") + (f" with {e['min']} or more Attack" if e.get("min") is not None else "")
    elif op == "mana": s = f"Get {n} extra Mana this turn"
    elif op == "crystal": s = "Gain 1 more max Mana"
    elif op == "discover":
        what = fnoun(e["f"], True, "card") if e.get("f") else {"spell": "spells", "minion": "minions", "legendary": "Legendary cards", "any": "cards"}[e["pool"]]
        s = f"Pick 1 of 3 random {what} to add to your hand"
    elif op == "missiles": s = f"Fire {n} shots of 1 damage at random enemies"
    elif op == "resurrect": s = f"Bring back {'a random minion' if n == 1 else str(n) + ' random minions'} of yours that died"
    elif op == "coin": s = "Add a Coin to your hand"
    elif op == "steal": s = "Steal a random card from your opponent's hand"
    elif op == "transform": s = f"Turn {who(tg)} into a random minion of the same cost"
    elif op == "bounce": s = f"Send {who(tg)} back to its owner's hand"
    elif op == "gamble": s = f"Spin! Randomly: {n} damage to a random enemy, OR heal your hero for {n}, OR draw a card"
    elif op == "curse": s = f"Give {who(tg)} -{n} Attack"
    elif op == "copy": s = "Summon a copy of it"
    elif op == "aoe_heal": s = f"Heal all your characters for {n}"
    elif op == "equip": s = f"Equip a {e['a']}/{e['h']} weapon"
    elif op == "counter": s = "cancel that spell"
    elif op == "aura_adj": s = f"Minions next to it have +{e['a']} Attack"
    elif op == "aura_sd": s = f"Your spells deal +{n} damage"
    elif op == "aura_f": s = f"Your other {fnoun(e['f'], True)} have +{e['a']} Attack"
    elif op == "tutor": s = f"Draw {a_(fnoun(e['f'], kind='card'))} from your deck"
    elif op == "reduce": s = f"{fnoun(e['f'], True, 'card')[0].upper() + fnoun(e['f'], True, 'card')[1:]} in your hand cost {n} less"
    elif op == "hbuff": s = f"Give {fnoun(e.get('f'), True)} in your hand {stats(e.get('a', 0), e.get('h', 0))}"
    elif op == "overload": s = ""
    else: s = op
    if e.get("per") is not None:
        s = s.replace(" for ", " for ") + f" for each {'other ' if e['on'] != 'cast' else ''}{fnoun(e['per'])} you control"
    if e.get("if"):
        c = e["if"]
        if c.get("ctrl"): cond = (f"If you control another {fnoun(c['ctrl'])}" if e['on'] != 'cast' else f"If you control {a_(fnoun(c['ctrl']))}") if c.get("n", 1) == 1 else f"If you control {c['n']} or more other {fnoun(c['ctrl'], True)}"
        elif c.get("hand"): cond = f"If you're holding {a_(fnoun(c['hand'], kind='card'))}"
        elif c.get("weapon"): cond = "If you have a weapon"
        elif c.get("hurt"): cond = "If your hero is damaged"
        elif c.get("spells"): cond = f"If you cast {c['spells']} {'spell' if c['spells'] == 1 else 'spells'} this turn"
        else: cond = "If"
        s = cond + ", " + s[0].lower() + s[1:]
    return s

def describe(card):
    parts = []
    kw = card.get("kw", [])
    basic = [k for k in kw if k in REMIND]
    other = [k for k in kw if k not in REMIND]
    has_more = bool(card.get("fx") or card.get("ov") or card.get("sd") or other)
    if basic:
        if not has_more and len(basic) <= 2:
            parts.append(" ".join(f"{KWN[k]} ({REMIND[k]})." for k in basic))
        else:
            parts.append(", ".join(KWN[k] for k in basic) + ".")
    for k in other: parts.append(KWN[k] + ".")
    groups = {}
    for e in card.get("fx", []):
        groups.setdefault((e["on"], e.get("trig") or (json.dumps(e["sf"], sort_keys=True) if e.get("sf") else None)), []).append(e)
    if card.get("cred"):
        cr = card["cred"]; parts.append(f"Costs {cr.get('n', 1)} less for each {fnoun(cr['f'])} you control.")
    for (on, trig), es in groups.items():
        txt = [eff_text(e) for e in es if eff_text(e)]
        if not txt: continue
        body = ". ".join(txt[:1] + [t[0].upper() + t[1:] for t in txt[1:]])
        if on == "sec":
            parts.append(f"Trap: {SEC[trig]}, {body[0].lower() + body[1:]}.")
        elif on == "fsum" and es[0].get("sf"):
            parts.append(f"When you summon {a_(fnoun(es[0]['sf']))}: " + body.replace(" to it", " to it") + ".")
        else:
            parts.append(TRIG[on] + body + ".")
    if card.get("ov"): parts.append(f"Next turn you get {card['ov']} less Mana.")
    if card.get("sd"): parts.append(f"Your spells deal +{card['sd']} damage.")
    out = " ".join(parts).replace("..", ".")
    if card.get("t") in ("s", "w") or card.get("hpower"):
        out = out.replace("your other ", "your ").replace(" to itself", "").replace("each other ", "each ")
    return out

def eff_value(e):
    op, n = e["op"], e.get("n", 0)
    tg = e.get("tg", "any")
    mult = {"em_all": 2.8, "am_all": 1.2, "others": 1.0, "enemies": 3.2, "rand_enemy": 0.8, "rand_em": 0.8, "friends": 2.0, "fm_all": 2.0, "adj": 1.6}.get(tg, 1)
    v = {"dmg": n * 1.0, "heal": n * 0.35, "buff": (e.get("a", 0) + e.get("h", 0)) * 0.8, "kw": 1.0, "armor": n * 0.5,
         "draw": n * 1.6, "freeze": 0.8, "silence": 1.0, "destroy": 3.5, "mana": n * 1.0, "discover": 1.5, "missiles": n * 0.9,
         "resurrect": n * 2.5, "coin": 0.8, "steal": 1.5, "transform": 2.0, "bounce": 1.2, "gamble": n * 0.8, "curse": n * 0.7,
         "copy": 3.0, "aoe_heal": n * 0.7, "aura_adj": e.get("a", 0) * 1.6, "aura_sd": 1.0}.get(op, 1.0)
    if op == "summon":
        t = TOKENS[e["id"]]; v = ((t["a"] + t["h"]) * 0.8 + sum(KWV.get(k, 0) for k in t["kw"]) * 0.8) * e.get("cnt", 1)
    if op == "aura_f": v = e.get("a", 0) * 1.6
    elif op == "tutor": v = 1.9
    elif op == "reduce": v = n * 0.9
    elif op == "hbuff": v = (e.get("a", 0) + e.get("h", 0)) * 0.7
    v *= mult
    if e.get("f") and tg in ("em_all", "am_all", "others", "fm_all", "enemies", "friends"): v *= 0.45
    elif e.get("f"): v *= 0.85
    if e.get("per") is not None: v *= 1.5
    if e.get("if"): v *= 0.6
    if e["on"] in ("eot", "sot", "fspell", "heal", "edie", "fsum", "atk"): v *= 1.6
    if e["on"] == "dr": v *= 0.8
    if e["on"] == "combo": v *= 0.7
    return v

# per-class stat budget, set by bot-vs-bot simulation (see docs/fishing.md, Labfreak Legends balance entries)
CLASS_BONUS = {"healer": 0.3}
# ---- synergies: some minions of a tribe get an ability that pays off for building around that tribe,
# its stats or its rarity (Hearthstone-style "lords", "for each", "if you control", cost cuts, tutors).
# Chosen by a stable hash, so the same cards get the same ability on every build.
def _el(tr):
    T = {"tr": tr}
    return {
        "Ember": ([], [E("bc", "dmg", n=1, tg="rand_enemy", per=T)], {}),
        "Tide": ([], [E("bc", "draw", n=1, **{"if": {"ctrl": T}})], {}),
        "Bloom": ([], [E("aura", "aura_f", a=1, f=T)], {}),
        "Volt": ([], [E("fsum", "buff", a=1, h=0, tg="self", sf=T)], {}),
        "Stone": ([], [E("bc", "buff", a=0, h=2, tg="fm_all", f=T)], {}),
        "Shade": ([], [E("bc", "destroy", tg="em", max=2, **{"if": {"ctrl": T}})], {}),
        "Frost": ([], [E("bc", "freeze", tg="em_all", f={"amax": 3})], {}),
        "Gale": ([], [], {"cred": {"f": T, "n": 1}}),
        "Metal": ([], [E("bc", "buff", a=1, h=1, tg="fm_all", f=T)], {}),
        "Mystic": ([], [E("bc", "tutor", f={"t": "s"})], {}),
        "Moss": ([], [E("bc", "heal", n=2, tg="fhero", per=T)], {}),
        "Rust": ([], [E("bc", "buff", a=0, h=1, tg="self", per=T)], {}),
        "Gloom": ([], [E("bc", "dmg", n=2, tg="em", **{"if": {"ctrl": T}})], {}),
        "Static": ([], [E("aura", "aura_f", a=1, f=T)], {}),
        "Circuit": ([], [E("bc", "reduce", n=1, f={"t": "s"})], {}),
        "Spore": ([], [E("bc", "summon", id="t_spore", cnt=1, **{"if": {"ctrl": T}})], {}),
    }.get(tr)
def _tribe(tr, k):
    T = {"tr": tr}
    opts = [([], [E("aura", "aura_f", a=1, f=T)], {}),
            ([], [E("bc", "buff", a=1, h=1, tg="fm_all", f=T)], {}),
            ([], [], {"cred": {"f": T, "n": 1}}),
            ([], [E("fsum", "buff", a=1, h=1, tg="self", sf=T)], {}),
            ([], [E("bc", "tutor", f=T)], {}),
            ([], [E("bc", "reduce", n=1, f=T)], {})]
    return opts[k % len(opts)]
SYN_RATE = {"Beast": .12, "Mech": .16, "Fish": .2, "Sea": .15, "Myth": .3, "Lieutenant": .3, "Party": .5, "Monster": .25, "Boss": .15}
def synergize(cid, cls, rar, cost, kw, fx, extra):
    tr = extra.get("tr")
    if extra.get("nosyn") or not tr: return kw, fx, extra
    r = h(cid + "syn")
    add = None
    if tr in ELEMENTS and r < .22 and (rar >= 1 or cost >= 3): add = _el(tr)
    elif tr in ("Beast", "Fish", "Mech") and r < SYN_RATE[tr]: add = _tribe(tr, int(h(cid + "k") * 6))
    elif tr == "Mech" and r < .22: add = ([], [E("fsum", "buff", a=1, h=1, tg="trig", sf={"tr": "Mech"})], {})
    elif tr == "Sea" and r < SYN_RATE[tr]: add = ([], [E("bc", "buff", a=0, h=2, tg="fm_all", f={"tr": ["Sea", "Fish"]})], {})
    elif tr == "Myth" and r < SYN_RATE[tr]: add = [([], [E("bc", "buff", a=2, h=2, tg="self", **{"if": {"ctrl": {"r": 3}}})], {}),
                                                  ([], [E("bc", "destroy", tg="em", min=5)], {})][int(h(cid + "k") * 2)]
    elif tr in ("Lieutenant",) and r < SYN_RATE[tr]: add = ([], [E("bc", "buff", a=1, h=0, tg="fm_all", f={"tr": ["Lieutenant", "Nemesis"]})], {})
    elif tr in ("Party", "Signature") and r < .5: add = ([], [E("bc", "buff", a=1, h=1, tg="fm_all", f={"tr": ["Party", "Signature", "Swarm"]})], {})
    elif tr in ("Knight", "Duelist", "Brute", "Ranger", "Gambler", "Hexpriest") and r < .3: add = ([], [E("bc", "buff", a=2, h=0, tg="self", **{"if": {"weapon": True}})], {})
    elif tr in ("Monster", "Boss") and r < SYN_RATE[tr] and cost >= 5: add = ([], [E("bc", "destroy", tg="em", min=5)], {})
    elif r > .97 and cost >= 2: add = ([], [E("bc", "buff", a=2, h=0, tg="fm", f={"amax": 2})], {})
    if not add: return kw, fx, extra
    k2, f2, x2 = add
    if any(e["op"] in ("dmg", "destroy", "freeze", "transform") and e["on"] == "bc" for e in fx) and any(e["on"] == "bc" for e in f2): return kw, fx, extra
    extra = dict(extra, **x2)
    return kw + k2, fx + f2, extra

def minion(cid, name, cls, rar, cost, frac, kw=(), fx=(), art=None, bonus=0, **extra):
    bonus += CLASS_BONUS.get(cls, 0)
    kw, fx, extra = synergize(cid, cls, rar, cost, list(kw), list(fx), extra)
    kw = list(dict.fromkeys(kw))
    budget = 2 * cost + 1 + (0.5 if rar >= 2 else 0) + (1 if rar >= 3 else 0) + bonus
    spend = sum(KWV.get(k, 0) for k in kw) + sum(eff_value(e) for e in fx) + (1.2 * extra["cred"].get("n", 1) if extra.get("cred") else 0)
    if extra.get("sd"): spend += extra["sd"]
    if extra.get("ov"): spend -= extra["ov"] * 1.2
    # abilities worth more than the card's budget raise its cost instead of hiding behind the 2-stat floor
    while budget - spend < 2 and cost < 10:
        cost += 1
        budget = 2 * cost + 1 + (0.5 if rar >= 2 else 0) + (1 if rar >= 3 else 0) + bonus
    total = max(2, round(budget - spend))
    if cost == 0: total = max(1, total)
    a = int(round(total * frac))
    if "cantattack" in kw: a = max(a, 1)
    a = max(0, min(a, total - 1)); hp = max(1, total - a)
    c = {"id": cid, "n": name, "c": cls, "t": "m", "r": rar, "m": cost, "a": a, "h": hp, "kw": kw, "fx": list(fx), "art": art}
    c.update(extra)
    c["tx"] = describe(c)
    return c

def spell(cid, name, cls, rar, cost, fx, art=None, **extra):
    c = {"id": cid, "n": name, "c": cls, "t": "s", "r": rar, "m": cost, "fx": list(fx), "art": art}
    c.update(extra); c["tx"] = describe(c)
    return c

def weapon(cid, name, cls, rar, cost, a, dur, kw=(), fx=(), art=None, **extra):
    c = {"id": cid, "n": name, "c": cls, "t": "w", "r": rar, "m": cost, "a": a, "h": dur, "kw": list(kw), "fx": list(fx), "art": art}
    c.update(extra); c["tx"] = describe(c)
    return c

E = lambda on, op, **k: dict(on=on, op=op, **k)

# ------------------------------------------------------------------ art baking
CELL = 192
SHEETS = []          # list of lists of PIL images
FXS = []             # transparent FX images for battle VFX

def add_art(img):
    if not SHEETS or len(SHEETS[-1]) == 64: SHEETS.append([])
    SHEETS[-1].append(img)
    return [len(SHEETS) - 1, len(SHEETS[-1]) - 1]

_bgc = {}
def bgimg(path, blur=1.5, dark=0.75):
    k = (path, blur, dark)
    if k not in _bgc:
        im = Image.open(path).convert("RGB")
        s = max(CELL / im.width, CELL / im.height) * 1.35
        im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
        x = (im.width - CELL) // 2; y = max(0, int((im.height - CELL) * 0.6))
        im = im.crop((x, y, x + CELL, y + CELL)).filter(ImageFilter.GaussianBlur(blur))
        _bgc[k] = ImageEnhance.Brightness(im).enhance(dark)
    return _bgc[k].copy()

def radial_bg(col):
    im = Image.new("RGB", (CELL, CELL), tuple(int(c * 0.12) for c in col))
    d = ImageDraw.Draw(im)
    for r in range(CELL, 0, -6):
        t = 1 - r / CELL
        d.ellipse([CELL / 2 - r * 0.75, CELL / 2 - r * 0.75, CELL / 2 + r * 0.75, CELL / 2 + r * 0.75],
                  fill=tuple(int(c * (0.12 + 0.5 * t ** 1.5)) for c in col))
    return im

def bake_sprite(sprite, bg, mode="stand", glow=None, scale=0.9):
    im = bg.convert("RGBA")
    sp = sprite.convert("RGBA")
    bb = sp.getbbox()
    if bb: sp = sp.crop(bb)
    box = CELL * scale
    s = min(box / sp.width, box / sp.height)
    sp = sp.resize((max(1, int(sp.width * s)), max(1, int(sp.height * s))), Image.LANCZOS)
    x = (CELL - sp.width) // 2
    y = (CELL - sp.height - 4) if mode == "stand" else (CELL - sp.height) // 2
    if glow:
        a = sp.getchannel("A").filter(ImageFilter.GaussianBlur(6))
        gl = Image.new("RGBA", sp.size, glow + (0,)); gl.putalpha(a.point(lambda v: min(255, int(v * 1.3))))
        im.alpha_composite(gl, (x, y))
    im.alpha_composite(sp, (x, y))
    return im.convert("RGB")

def crop_card(path, box):
    im = Image.open(path).convert("RGB").crop(box)
    return im.resize((CELL, CELL), Image.LANCZOS)

def cached(g, k):
    p = CACHE + f"{g}_{k}.png"
    return Image.open(p) if os.path.exists(p) else None

FXART = {}
def fx_art(k, col):
    """A spell picture: one of the games' FX on a coloured glow."""
    im = cached("fx", k)
    if im is None: return add_art(radial_bg(col))
    return add_art(bake_sprite(im, radial_bg(col), mode="center", scale=0.95))

def fx_layer(k):
    if k in FXART: return FXART[k]
    im = cached("fx", k)
    if im is None: return None
    im = im.convert("RGBA"); im.thumbnail((256, 256))
    FXS.append(im); FXART[k] = len(FXS) - 1
    return FXART[k]

CARDS = []
def add(c): CARDS.append(c); return c

# ================================================================== TOKENS
tok("t_wisp", "Glimmer Wisp", 1, 1, cls="tamer")
tok("t_skel", "Skeleton", 2, 1, cls="gambler")
tok("t_slime", "Gel Blob", 1, 1, cls="gambler")
tok("t_homun", "Jar Homunculus", 1, 2, kw=["lifesteal"], cls="gambler")
tok("t_spore", "Spore", 1, 1, cls="scientist")
tok("t_wall", "Holy Wall", 0, 5, kw=["taunt"], cls="healer")
tok("t_brood", "Brood Hatchling", 1, 1, cls="healer")
tok("t_skel2", "Raised Skeleton", 1, 1, cls="healer")
tok("t_chip", "Lucky Chip", 1, 1, kw=["divine"], cls="collector")
TOKENS["coin"] = {"id": "coin", "n": "The Coin", "c": "neutral", "t": "s", "r": 0, "m": 0, "fx": [E("cast", "mana", n=1)], "token": 1, "art": None,
                  "tx": "Get 1 extra Mana this turn."}

# ================================================================== TAMER — Glimmerdeep
EL_BIOME = {"ember": "magma", "tide": "grotto", "bloom": "verdant", "volt": "spire", "stone": "dunes", "shade": "crypt",
            "frost": "tundra", "gale": "skyisles", "metal": "foundry", "mystic": "observatory"}
EL_COL = {"ember": (255, 120, 50), "tide": (40, 150, 255), "bloom": (80, 200, 90), "volt": (250, 205, 40), "stone": (205, 155, 95),
          "shade": (150, 90, 215), "frost": (110, 205, 250), "gale": (110, 220, 195), "metal": (170, 185, 205), "mystic": (235, 110, 225)}
EL_FX = {"ember": "fx_sigil_fire", "tide": "fxa_ring_water", "bloom": "fx_sigil_nature", "volt": "fxa_ring_bolt", "stone": "fxa_ring_quake",
         "shade": "fx_sigil_shadow", "frost": "fx_sigil_frost", "gale": "fx_tornado", "metal": "fxa_ring_shock", "mystic": "fxa_ring_arcane"}
tier2 = {s["k"]: s["tier"] for s in []}
sp2 = {}
try:
    import subprocess
except Exception:
    pass
src2 = open(REPO + "glimmerdeep/species2.js").read()
for m in re.finditer(r'\{"k":"(\w+)","el":"\w+","role":"\w+","tier":(\d)', src2):
    sp2[m.group(1)] = int(m.group(2))

def tamer_card(k, sp, st):
    el, role = sp["el"], sp["role"]
    tier = sp2.get(k, 1 + int(h(k) * 5))
    cost = [1, 3, 5, 7][st - 1] + (1 if tier >= 4 else 0)
    rar = [0, 0, 1, 2][st - 1]
    kw, fx, extra = [], [], {}
    frac = {"striker": 0.62, "tank": 0.35, "caster": 0.5, "support": 0.42}[role]
    if role == "tank": kw.append("taunt")
    if role == "striker": kw += [None, "rush", "rush", "charge"][st - 1:st] if st > 1 else []
    if role == "caster" and st >= 2: extra["sd"] = 1 if st < 4 else 2
    if role == "support":
        fx.append([E("bc", "buff", a=1, h=1, tg="fm"), E("bc", "heal", n=3, tg="any"), E("bc", "buff", a=1, h=1, tg="adj"),
                   E("eot", "aoe_heal", n=2, tg="friends")][st - 1])
    if st >= 2 or el in ("gale",):
        if el == "ember": fx.append(E("bc", "dmg", n=st - 1 if st < 4 else 3, tg="any"))
        elif el == "tide":
            if st >= 3: fx.append(E("bc", "draw", n=1))
            if st == 4: fx.append(E("bc", "freeze", tg="em"))
        elif el == "bloom": kw.append("lifesteal")
        elif el == "volt":
            if st >= 3: kw.append("windfury"); extra["ov"] = 1
        elif el == "stone":
            if "taunt" not in kw: kw.append("taunt")
            frac -= 0.1
        elif el == "shade": kw.append("stealth" if st == 2 else "poisonous")
        elif el == "frost": kw.append("frostbite")
        elif el == "gale":
            if "rush" not in kw and "charge" not in kw: kw.append("rush")
            if st == 4: kw.append("windfury")
        elif el == "metal": kw.append("divine")
        elif el == "mystic":
            if st == 3: fx.append(E("bc", "discover", pool="spell"))
            if st == 4: kw.append("reborn")
    kw = [x for x in kw if x][:3]
    bg = bgimg(REPO + f"glimmerdeep/img/bg_{EL_BIOME[el]}.webp")
    art = add_art(bake_sprite(Image.open(REPO + f"glimmerdeep/img/cr_{k}{st}.webp"), bg, glow=EL_COL[el]))
    evo = {"k": k, "s": st, "from": sp["names"][st - 2]} if st > 1 else None
    c = minion(f"gd_{k}{st}", sp["names"][st - 1], "tamer", rar, cost, frac, kw, fx, art, evo=evo, sd=extra.get("sd"),
               ov=extra.get("ov"), g="Glimmerdeep", tr=el.capitalize(), el=el, fl=(sp.get("desc4") if st == 4 else None))
    if evo: c["evo"] = {"k": k, "s": st, "from": sp["names"][st - 2], "fromId": f"gd_{k}{st-1}"}
    c["tx"] = describe(c)
    return c

for k, sp in sorted(G["SP"].items()):
    for st in range(1, 5):
        add(tamer_card(k, sp, st))

BOSS_FX = {
    "bramble": ([], [E("bc", "summon", id="t_wisp", cnt=2), E("eot", "heal", n=3, tg="self")]),
    "cinder": (["taunt"], [E("bc", "dmg", n=2, tg="others")]),
    "eel": (["frostbite"], [E("bc", "dmg", n=1, tg="em_all"), E("bc", "freeze", tg="em_all")]),
    "prism": (["taunt", "divine"], []),
    "grim": (["stealth"], [E("bc", "curse", n=2, tg="em_all")]),
    "thornqueen": (["taunt"], [E("dmg", "dmg", n=2, tg="ehero")]),
    "tempestroc": (["windfury", "rush"], []),
    "forgeheart": (["taunt"], [E("bc", "armor", n=5)]),
    "ashhydra": ([], [E("eot", "heal", n=4, tg="self"), E("atk", "dmg", n=1, tg="em_all")]),
    "deepmaw": (["lifesteal", "rush"], []),
    "rimeleviathan": (["frostbite"], [E("bc", "freeze", tg="em_all")]),
    "mirrorsphinx": (["divine"], [E("bc", "silence", tg="em")]),
    "geartyrant": (["taunt"], [E("dr", "summon", id="t_wisp", cnt=3)]),
    "eclipsechimera": (["lifesteal"], [E("atk", "dmg", n=2, tg="rand_enemy")]),
    "hollowcolossus": (["taunt"], [E("dmg", "dmg", n=2, tg="rand_enemy")]),
    "astralbehemoth": ([], [E("sot", "kw", k="divine", tg="self"), E("bc", "discover", pool="spell")]),
    "voidtitan": (["elusive"], [E("bc", "destroy", tg="em", max=4)]),
    "yeti": (["taunt"], [E("bc", "summon", id="t_wisp", cnt=2), E("bc", "freeze", tg="rand_em")]),
    "nimbus": (["rush", "divine"], []),
    "sandworm": (["poisonous"], [E("bc", "dmg", n=3, tg="em")]),
    "mirecroc": (["lifesteal"], [E("eot", "heal", n=3, tg="self")]),
    "juggernaut": (["taunt", "divine"], []),
    "astralmoth": ([], [E("bc", "draw", n=2), E("eot", "aoe_heal", n=2, tg="friends")]),
    "wyrm": (["charge"], [E("bc", "dmg", n=3, tg="enemies")]),
}
for bk, b in G["B"].items():
    el = b["el"]
    kw, fx = BOSS_FX.get(bk, ([], []))
    cost = 8 + int(h(bk) * 3) if bk != "wyrm" else 10
    bgk = next((bi["bg"] for bi in G["BI"].values() if bk in bi["bosses"]), "bg_" + EL_BIOME[el])
    art = add_art(bake_sprite(Image.open(REPO + f"glimmerdeep/img/{b['art']}.webp"), bgimg(REPO + f"glimmerdeep/img/{bgk}.webp"), glow=(255, 90, 60)))
    add(minion(f"gdb_{bk}", b["name"], "tamer", 3, cost, 0.5, kw, fx, art, g="Glimmerdeep", tr="Boss", el=el, fl=b["pd"]))

TAMER_SPELLS = {  # element: list of (cost, effects)
    "ember": [(1, [E("cast", "dmg", n=2, tg="any")]), (4, [E("cast", "dmg", n=2, tg="em_all")]), (6, [E("cast", "dmg", n=6, tg="any")])],
    "tide": [(2, [E("cast", "freeze", tg="any"), E("cast", "draw", n=1)]), (3, [E("cast", "heal", n=6, tg="any"), E("cast", "draw", n=1)])],
    "bloom": [(2, [E("cast", "buff", a=2, h=2, tg="m")]), (3, [E("cast", "aoe_heal", n=4, tg="friends")])],
    "volt": [(2, [E("cast", "dmg", n=4, tg="any")], 1), (3, [E("cast", "missiles", n=4)])],
    "stone": [(2, [E("cast", "buff", a=0, h=4, tg="m"), E("cast", "kw", k="taunt", tg="m")]), (5, [E("cast", "armor", n=5), E("cast", "draw", n=1)])],
    "shade": [(2, [E("cast", "destroy", tg="em", max=2)]), (4, [E("cast", "destroy", tg="em")]), (1, [E("cast", "curse", n=2, tg="m")])],
    "frost": [(3, [E("cast", "freeze", tg="em_all")]), (2, [E("cast", "dmg", n=3, tg="any"), E("cast", "freeze", tg="any")])],
    "gale": [(2, [E("cast", "bounce", tg="m")]), (1, [E("cast", "kw", k="rush", tg="fm"), E("cast", "buff", a=1, h=0, tg="fm")])],
    "metal": [(1, [E("cast", "kw", k="divine", tg="m"), E("cast", "draw", n=1)]), (3, [E("cast", "armor", n=6)])],
    "mystic": [(1, [E("cast", "discover", pool="minion")]), (0, [E("cast", "silence", tg="m")]), (3, [E("cast", "draw", n=2)])],
}
skill_names = {}
for k, sp in G["SP"].items():
    for s in sp["sk"]:
        skill_names.setdefault(sp["el"], set()).add(s["n"])
for el, lst in TAMER_SPELLS.items():
    names = sorted(skill_names.get(el, []))
    random.Random(el).shuffle(names)
    for i, spec in enumerate(lst):
        cost, fx = spec[0], spec[1]
        ov = spec[2] if len(spec) > 2 else None
        nm = names[i] if i < len(names) else f"{el.capitalize()} Rite"
        add(spell(f"gds_{el}{i}", nm, "tamer", 0 if cost <= 2 else 1, cost, fx, fx_art(EL_FX[el], EL_COL[el]), g="Glimmerdeep", ov=ov, el=el,
                  vfx=fx_layer(EL_FX[el])))

# ================================================================== GAMBLER — Dead Man's Pull
H = GM["H"]
DMP_BG = [REPO + f"lootdaggers/art-src/{b}.webp" for b in ("bg_wall", "bg_wall_2", "bg_wall_3", "bg_wall_4")]
def dmp_art(key, glow=(150, 200, 90), bg=None):
    im = cached("dmp", key)
    if im is None: im = Image.open(REPO + f"lootdaggers/art-src/{key}.webp")
    return add_art(bake_sprite(im, bgimg(bg or DMP_BG[int(h(key) * 4)], dark=0.6), glow=glow))

CLS_FX = {
    "knight": lambda t: (["taunt"] + (["divine"] if t >= 2 else []), []),
    "gambler": lambda t: ([], [E("bc", "gamble", n=1 + t)]),
    "duelist": lambda t: (["rush"] + (["windfury"] if t >= 4 else []), [] if t < 3 else [E("combo", "buff", a=2, h=0, tg="self")]),
    "brute": lambda t: ([] if t < 2 else ["taunt"] if t == 5 else [], [] if t < 3 else [E("bc", "dmg", n=1, tg="others")]),
    "hexpriest": lambda t: ([], [E("bc", "silence", tg="m")] if t < 4 else [E("bc", "destroy", tg="em", max=3)]),
    "ranger": lambda t: ([], [E("bc", "dmg", n=1 + t // 2, tg="rand_enemy")] + ([E("atk", "dmg", n=1, tg="rand_enemy")] if t >= 4 else [])),
}
CLS_FRAC = {"knight": 0.4, "gambler": 0.5, "duelist": 0.6, "brute": 0.6, "hexpriest": 0.45, "ranger": 0.55}
for c in CLS_FX:
    for k in [None] + sorted(x for x in H if os.path.exists(REPO + f"lootdaggers/art-src/hero_{c}_{x}_idle.webp")):
        t = H[k]["tier"] if k else 0
        name = H[k]["name"] if k else f"The {c.capitalize() if c != 'hexpriest' else 'Hexpriest'}"
        if k in ("champion", "reaperarrow"): name = title(k)
        cost = [2, 3, 4, 5, 6, 8][t]
        rar = [0, 0, 1, 1, 2, 3][t]
        kw, fx = CLS_FX[c](t)
        key = f"hero_{c}_{k}_idle" if k else f"hero_{c}_idle"
        add(minion(f"dmp_{c}_{k or 'base'}", name, "gambler", rar, cost, CLS_FRAC[c], kw, fx, dmp_art(key), g="Dead Man's Pull",
                   tr=c.capitalize()))

E_ = GM["E"]
ENEMY = {
    "rat": (1, 0, ["rush"], []), "skel": (1, 0, ["reborn"], []), "archer": (2, 0, [], [E("bc", "dmg", n=1, tg="any")]),
    "slime": (2, 0, [], [E("dr", "summon", id="t_slime", cnt=2)]), "orc": (3, 0, ["taunt"], []),
    "wraith": (2, 0, ["stealth", "lifesteal"], []), "mimic": (3, 1, ["stealth"], [E("dr", "discover", pool="minion")]),
    "croupier": (3, 1, [], [E("bc", "silence", tg="em")]), "taxman": (3, 1, [], [E("eot", "dmg", n=1, tg="ehero"), E("eot", "armor", n=1)]),
    "mirror": (3, 1, [], [E("dmg", "dmg", n=1, tg="ehero")]), "ironclad": (4, 1, ["taunt", "divine"], []),
    "abom": (5, 1, ["taunt"], [E("dr", "dmg", n=2, tg="am_all")]), "homunculus": (1, 0, ["lifesteal"], []),
    "brainjar": (3, 1, [], [E("bc", "dmg", n=1, tg="any")]),
}
for k, (cost, rar, kw, fx) in ENEMY.items():
    e = E_[k]
    c = minion(f"dmpe_{k}", e["name"], "gambler", rar, cost, 0.5, kw, fx, dmp_art(f"enemy_{k}", glow=(200, 60, 60)), g="Dead Man's Pull",
               tr="Enemy", fl=e.get("d") or None, sd=1 if k == "brainjar" else None)
    add(c)
BOSSES_DMP = [
    ("reaper", "enemy_reaper", "The Reaper", 6, ["poisonous", "stealth"], []),
    ("boneking", "boss_boneking", "The Bone King", 7, ["taunt"], [E("dr", "summon", id="t_skel", cnt=3)]),
    ("bandit", "boss_bandit", "One-Armed Bandit", 7, [], [E("bc", "steal"), E("bc", "gamble", n=3)]),
    ("lich", "boss_lich", "The Dice Lich", 8, [], [E("bc", "freeze", tg="em_all"), E("bc", "destroy", tg="rand_em")]),
    ("death1", "death_p1", "Death, the Dealer", 10, [], [E("bc", "destroy", tg="others")]),
    ("death3", "death_p3", "Death on the Throne", 9, ["taunt"], [E("sot", "dmg", n=3, tg="ehero")]),
    ("labmut", "boss_labfreak2", "Dr. Labfreak, Mutated", 8, [], [E("dr", "summon", id="t_homun", cnt=3), E("bc", "dmg", n=2, tg="em_all")]),
]
for k, art, name, cost, kw, fx in BOSSES_DMP:
    add(minion(f"dmpb_{k}", name, "gambler", 3, cost, 0.5, kw, fx, dmp_art(art, glow=(255, 70, 50), bg=REPO + "lootdaggers/art-src/bg_wall_boss.webp" if k != "labmut" else REPO + "lootdaggers/art-src/bg_wall_lab.webp"),
               g="Dead Man's Pull", tr="Boss"))

# weapons from gear
WEAP = sorted(k[:-5] for k in os.listdir(REPO + "lootdaggers/art-src") if k.startswith("gear_weapon_"))
for i, k in enumerate(WEAP):
    nm = title(k.replace("gear_weapon_", ""))
    nm = {"Cardshiv": "Card Shiv", "Chipsling": "Chip Sling", "Croupierrake": "Croupier's Rake", "Diceknuckles": "Dice Knuckles",
          "Embalmingneedle": "Embalming Needle", "Gravediggerspade": "Gravedigger's Spade", "Grenadierpouch": "Grenadier Pouch",
          "Headsmanaxe": "Headsman's Axe", "Loansharkhook": "Loan Shark Hook", "Luckyblade": "Lucky Blade", "Noosewhip": "Noose Whip",
          "Ossuarymace": "Ossuary Mace", "Pitbosscudgel": "Pit Boss Cudgel", "Powderflask": "Powder Flask", "Reapersickle": "Reaper's Sickle",
          "Tallymanhook": "Tallyman's Hook", "Coffinnail": "Coffin Nail", "Bonebow": "Bone Bow", "Bonesaw": "Bone Saw", "Longbow": "Long Bow",
          "Shortbow": "Short Bow"}.get(nm, nm)
    cost = 1 + int(h(k) * 5)
    a = max(1, cost - (1 if h(k + "a") < 0.5 else 0) + (1 if cost >= 4 else 0)); dur = 2 if cost <= 3 else 3
    kw = [["", "lifesteal", "poisonous", "frostbite", "windfury"][int(h(k + "kw") * 5)]] if cost >= 3 else []
    kw = [x for x in kw if x]
    if kw: a = max(1, a - 1)
    im = cached("dmp", k) or Image.open(REPO + f"lootdaggers/art-src/{k}.webp")
    add(weapon(f"dmpw_{i}", nm, "gambler", 0 if cost <= 2 else 1 if cost <= 4 else 2, cost, a, dur, kw, [],
               add_art(bake_sprite(im, radial_bg((150, 200, 90)), mode="center", scale=0.86)), g="Dead Man's Pull"))

# spells from relics, armour and charms
REL_TPL = [
    (lambda k: any(w in k for w in ("dice", "roulette", "wheel", "reel", "lever", "seven", "highroller", "allin", "bonusround", "wildcard")),
     lambda c: [E("cast", "gamble", n=c + 1)]),
    (lambda k: any(w in k for w in ("bomb", "powder", "keg", "fuse", "nitro", "sawnoff", "hollowpoint")), lambda c: [E("cast", "dmg", n=max(1, c - 1), tg="em_all")] if c >= 3 else [E("cast", "dmg", n=c + 2, tg="any")]),
    (lambda k: any(w in k for w in ("coin", "penny", "chip", "money", "piggy", "greed", "goldtooth", "counterfeit", "bounty", "vip")),
     lambda c: [E("cast", "coin"), E("cast", "draw", n=1)] if c >= 1 else [E("cast", "mana", n=1)]),
    (lambda k: any(w in k for w in ("death", "reaper", "scythe", "noose", "epitaph", "lastrites", "coffin", "grave", "wither", "spite")),
     lambda c: [E("cast", "destroy", tg="em", max=c)] if c < 4 else [E("cast", "destroy", tg="em")]),
    (lambda k: any(w in k for w in ("pickpocket", "sleeve", "thumb", "clamp")), lambda c: [E("cast", "steal")]),
    (lambda k: any(w in k for w in ("vampire", "soul", "blood", "fang", "marrow", "tetanus")), lambda c: [E("cast", "dmg", n=c + 1, tg="any"), E("cast", "heal", n=c + 1, tg="fhero")]),
    (lambda k: any(w in k for w in ("secondwind", "snakeoil", "ironlung", "insurance", "deathsdoor")), lambda c: [E("cast", "heal", n=4 + 2 * c, tg="fhero"), E("cast", "draw", n=1)]),
]
SECRET_KEYS = {"relic_tripwire": ("eattack", [E("sec", "dmg", n=2, tg="enemies", trig="eattack")]),
               "relic_houseedge": ("eminion", [E("sec", "dmg", n=4, tg="trig", trig="eminion")]),
               "relic_veil": ("espell", [E("sec", "counter", trig="espell")]),
               "relic_pallbearer": ("fdie", [E("sec", "summon", id="t_skel", cnt=2, trig="fdie")]),
               "relic_thornmail": ("ehp", [E("sec", "armor", n=6, trig="ehp")])}
RELS = sorted(k[:-5] for k in os.listdir(REPO + "lootdaggers/art-src") if k.startswith("relic_") and not k.endswith("_alt.webp"))
for i, k in enumerate(RELS):
    nm = title(k.replace("relic_", ""))
    im = cached("dmp", k) or Image.open(REPO + f"lootdaggers/art-src/{k}.webp")
    art = add_art(bake_sprite(im, radial_bg((150, 200, 90)), mode="center", scale=0.8))
    if k in SECRET_KEYS:
        add(spell(f"dmpr_{i}", nm, "gambler", 1, 2, SECRET_KEYS[k][1], art, g="Dead Man's Pull", secret=SECRET_KEYS[k][0]))
        continue
    cost = int(h(k) * 5)
    fx = None
    for test, mk in REL_TPL:
        if test(k): fx = mk(cost); break
    if fx is None:
        fx = [[E("cast", "draw", n=2)], [E("cast", "buff", a=2, h=1, tg="fm")], [E("cast", "dmg", n=3, tg="any")],
              [E("cast", "kw", k="poisonous", tg="fm"), E("cast", "draw", n=1)], [E("cast", "curse", n=3, tg="m")]][int(h(k + "t") * 5)]
        cost = max(1, min(4, round(sum(eff_value(e) for e in fx) / 1.7)))
    add(spell(f"dmpr_{i}", nm, "gambler", 0 if cost <= 1 else 1 if cost <= 3 else 2, cost, fx, art, g="Dead Man's Pull"))
for i, k in enumerate(sorted(x[:-5] for x in os.listdir(REPO + "lootdaggers/art-src") if x.startswith("gear_armor_"))):
    n = 2 + int(h(k) * 6)
    im = cached("dmp", k) or Image.open(REPO + f"lootdaggers/art-src/{k}.webp")
    add(spell(f"dmpa_{i}", title(k.replace("gear_armor_", "")), "gambler", 0, max(0, n // 2), [E("cast", "armor", n=n)] + ([E("cast", "draw", n=1)] if n >= 6 else []),
              add_art(bake_sprite(im, radial_bg((120, 160, 180)), mode="center", scale=0.86)), g="Dead Man's Pull"))
for i, k in enumerate(sorted(x[:-5] for x in os.listdir(REPO + "lootdaggers/art-src") if x.startswith(("gear_boots_", "gear_charm_", "gear_unique_")))):
    im = cached("dmp", k) or Image.open(REPO + f"lootdaggers/art-src/{k}.webp")
    if "boots" in k: fx, cost = [E("cast", "kw", k="rush", tg="fm"), E("cast", "buff", a=1, h=1, tg="fm")], 1
    elif "charm" in k: fx, cost = ([E("cast", "gamble", n=3)], 2) if h(k) < 0.5 else ([E("cast", "kw", k="divine", tg="fm"), E("cast", "draw", n=1)], 2)
    else: fx, cost = [[E("cast", "draw", n=3)], [E("cast", "dmg", n=5, tg="any")], [E("cast", "buff", a=3, h=3, tg="fm")], [E("cast", "resurrect", n=1)]][int(h(k) * 4)], 3 + int(h(k + "c") * 2)
    nm = title(k.replace("gear_boots_", "").replace("gear_charm_", "").replace("gear_unique_", ""))
    add(spell(f"dmpg_{i}", nm, "gambler", 2 if "unique" in k else 0, cost, fx,
              add_art(bake_sprite(im, radial_bg((200, 170, 90)), mode="center", scale=0.86)), g="Dead Man's Pull"))

# ================================================================== HEALER — Thankless
T = GM["T"]
TH_BG = Image.open(REPO + "thankless/card.jpg").convert("RGB").crop((0, 0, 430, 330))
TH_BG.save(SCR + "v5/th_bg.png")
def th_art(key, glow=(240, 190, 90)):
    im = cached("th", key)
    return add_art(bake_sprite(im, bgimg(SCR + "v5/th_bg.png", blur=2, dark=0.8), glow=glow))
TH = {
    "tank": (4, 0.3, ["taunt", "cantattack"], [], "ult_tank"), "archer": (2, 0.55, ["misfire"], [], "ult_archer"),
    "mage": (3, 0.6, [], [E("bc", "dmg", n=2, tg="rand_enemy")], "ult_mage"), "necro": (4, 0.5, [], [E("edie", "summon", id="t_skel2", cnt=1)], "ult_necro"),
    "assassin": (3, 0.75, ["stealth"], [E("combo", "buff", a=2, h=0, tg="self")], "ult_assassin"),
    "paladin": (4, 0.45, ["divine"], [E("eot", "heal", n=2, tg="self")], "ult_paladin"),
    "frost": (5, 0.45, ["frostbite"], [E("bc", "freeze", tg="em_all")], "ult_frost"), "ent": (6, 0.35, ["taunt"], [], "ult_ent"),
    "wolf": (3, 0.5, ["enrage"], [], "ult_wolf"), "vampire": (4, 0.5, ["lifesteal"], [], "ult_vampire"),
    "gunner": (5, 0.7, ["windfury"], [], "ult_gunner"), "robot": (4, 0.5, ["rush"], [E("atk", "dmg", n=1, tg="ehero")], "ult_robot"),
    "wren": (2, 0.3, [], [E("eot", "aoe_heal", n=2, tg="friends")], "ult_wren"),
    "ansel": (5, 0.3, [], [E("bc", "heal", n=8, tg="any")], "ult_ansel"),
    "ivy": (3, 0.4, [], [E("heal", "buff", a=1, h=1, tg="self")], "ult_ivy"),
}
for k, (cost, frac, kw, fx, art) in TH.items():
    t = T[k]
    add(minion(f"th_{k}", t["name"], "healer", 1 if cost >= 4 else 0, cost, frac, kw, fx, th_art(art), g="Thankless",
               tr=t["role"].replace("The ", "").rstrip(".").capitalize(), fl=t["blurb"]))
    for v in ("b", "c"):
        if cached("th", f"{art}_{v}") is None: continue
        kw2 = list(kw); fx2 = list(fx)
        if v == "b": extra_kw = {"tank": "lifesteal", "archer": "rush", "mage": None, "necro": "reborn", "assassin": "poisonous",
                                 "paladin": "lifesteal", "frost": "elusive", "ent": "lifesteal", "wolf": "rush", "vampire": "rush",
                                 "gunner": "divine", "robot": "divine", "wren": "divine", "ansel": "taunt", "ivy": "lifesteal"}.get(k)
        else: extra_kw = None
        if extra_kw: kw2.append(extra_kw)
        if v == "c": fx2 = fx2 + [E("bc", "draw", n=1)]
        add(minion(f"th_{k}_{v}", t["name"] + (" the Unthanked" if v == "b" else ", Unleashed"), "healer", 2, cost + 1, frac, kw2, fx2,
                   th_art(f"{art}_{v}", glow=(255, 220, 120)), g="Thankless", tr="Signature", fl=t["blurb"]))
for k in ("ult_mage_swarm", "ult_tank_nap", "ult_ivy2", "ult_wren2"):
    for v in ("", "_b", "_c"):
        key = k + v
        if cached("th", key) is None: continue
        base = {"ult_mage_swarm": ("Vex's Swarm", 4, 0.6, [], [E("bc", "missiles", n=3)]),
                "ult_tank_nap": ("Brom, Napping", 3, 0.2, ["taunt", "cantattack"], [E("eot", "heal", n=3, tg="self")]),
                "ult_ivy2": ("Ivy in Bloom", 4, 0.4, [], [E("eot", "aoe_heal", n=1, tg="friends"), E("bc", "summon", id="t_brood", cnt=1)]),
                "ult_wren2": ("Wren, Second Wind", 3, 0.35, [], [E("bc", "heal", n=5, tg="any"), E("bc", "draw", n=1)])}[k]
        nm, cost, frac, kw, fx = base
        if v: nm += [" II", " III"][["_b", "_c"].index(v)]; cost += 1
        add(minion(f"th_{key}", nm, "healer", 1 if not v else 2, cost, frac, kw, fx, th_art(key), g="Thankless", tr="Party"))
add(minion("th_king", "The King", "healer", 3, 8, 0.5, ["taunt"], [E("bc", "curse", n=2, tg="em_all")], th_art("king_a", glow=(255, 80, 60)), g="Thankless", tr="Boss",
           fl="Rules the field. Thanks nobody, ever."))
if cached("th", "king_b"):
    add(minion("th_king_b", "The King, Enthroned", "healer", 3, 7, 0.4, ["taunt"], [E("eot", "armor", n=3)], th_art("king_b", glow=(255, 80, 60)), g="Thankless", tr="Boss"))
add(minion("th_kingc", "The King, Charging", "healer", 3, 10, 0.55, ["charge"], [E("bc", "dmg", n=2, tg="em_all")], th_art("king_charge", glow=(255, 80, 60)), g="Thankless", tr="Boss"))
for v in ("brood_a", "brood_b", "brood_charge"):
    if cached("th", v):
        add(minion(f"th_{v}", {"brood_a": "Brood Swarm", "brood_b": "Brood Matron", "brood_charge": "Brood Stampede"}[v], "healer", 1, 3 if v != "brood_charge" else 4, 0.6,
                   ["rush"] if v == "brood_charge" else [], [E("bc", "summon", id="t_brood", cnt=2 if v == "brood_b" else 1)], th_art(v), g="Thankless", tr="Swarm"))
# faces as "Party Portrait" spells? faces become the healer's portraits for small 1-drops
for k in [x for x in T]:
    if cached("th", f"face_{k}") is None and k != "tank": continue
TH_SPELL = {
    "bless": [E("cast", "buff", a=1, h=2, tg="m")], "fortify": [E("cast", "buff", a=0, h=4, tg="m"), E("cast", "kw", k="taunt", tg="m")],
    "guardian": [E("cast", "kw", k="divine", tg="m"), E("cast", "draw", n=1)], "haste": [E("cast", "kw", k="charge", tg="fm")],
    "march": [E("cast", "buff", a=1, h=0, tg="fm_all")], "mending": [E("cast", "heal", n=6, tg="any")], "quicken": [E("cast", "draw", n=2)],
    "radiance": [E("cast", "dmg", n=2, tg="em_all"), E("cast", "aoe_heal", n=2, tg="friends")], "regrowth": [E("cast", "aoe_heal", n=4, tg="friends")],
    "retribution": [E("cast", "dmg", n=5, tg="any")], "revive": [E("cast", "resurrect", n=1)], "rouse": [E("cast", "buff", a=3, h=0, tg="m")],
    "sanctuary": [E("cast", "summon", id="t_wall", cnt=1), E("cast", "aoe_heal", n=3, tg="friends")], "surge": [E("cast", "buff", a=2, h=2, tg="fm_all")],
    "wall": [E("cast", "summon", id="t_wall", cnt=2)], "ward": [E("sec", "armor", n=8, trig="ehp")],
    "warprayer": [E("cast", "buff", a=2, h=2, tg="fm_all"), E("cast", "aoe_heal", n=2, tg="friends")],
}
for key in sorted(k[:-5] for k in os.listdir(REPO + "thankless/art-src") if k.startswith(("spell_", "skill_", "relic_"))):
    base = key.split("_", 1)[1]
    nm = title(re.sub(r"^(a|m|t)_", "", base).replace("ult_", ""))
    if base in TH_SPELL: fx = TH_SPELL[base]
    elif key.startswith("skill_a"): fx = [[E("cast", "dmg", n=3, tg="any")], [E("cast", "missiles", n=3)], [E("cast", "dmg", n=2, tg="em_all")]][int(h(key) * 3)]
    elif key.startswith("skill_m"): fx = [[E("cast", "dmg", n=4, tg="any")], [E("cast", "freeze", tg="em_all")], [E("cast", "dmg", n=1, tg="enemies")]][int(h(key) * 3)]
    elif key.startswith("skill_t"): fx = [[E("cast", "armor", n=5)], [E("cast", "kw", k="taunt", tg="m"), E("cast", "buff", a=0, h=3, tg="m")], [E("cast", "freeze", tg="em")]][int(h(key) * 3)]
    elif key.startswith("spell_ult"): fx = [E("cast", "aoe_heal", n=5, tg="friends"), E("cast", "draw", n=1)]
    else: fx = [[E("cast", "heal", n=4, tg="any"), E("cast", "draw", n=1)], [E("cast", "kw", k="divine", tg="fm")], [E("cast", "buff", a=1, h=1, tg="fm_all")],
                [E("cast", "armor", n=4)], [E("cast", "discover", pool="minion")], [E("cast", "silence", tg="m")]][int(h(key) * 6)]
    sec = None
    if any(e["on"] == "sec" for e in fx): sec = fx[0]["trig"]
    cost = 2 if sec else max(0, min(7, round(sum(eff_value(e) for e in fx) / 1.6)))
    im = cached("th", key)
    if im is None: continue
    add(spell(f"ths_{base}", nm, "healer", 0 if cost <= 2 else 1 if cost <= 4 else 2, cost, fx,
              add_art(bake_sprite(im, radial_bg((240, 190, 90)), mode="center", scale=0.86)), g="Thankless", secret=sec))

# ================================================================== COLLECTOR + NEUTRAL — Odds & Ends
man = json.load(open(REPO + "docs/art-manifest.json"))["images"]
OK_MYTH = {"yeti", "hydra", "zhulong", "dragon", "werewolf", "sphinx", "basilisk", "minotaur", "cyclops", "cerberus", "pegasus", "phoenix",
           "chimera", "fenrir", "jormungandr", "yggdrasil-guardian", "qilin", "pixiu", "kappa", "tengu", "kitsune", "oni", "banshee",
           "leprechaun", "selkie", "griffin", "kraken", "bigfoot", "loch-ness-monster", "unicorn", "mermaid", "golem", "medusa", "naga-serpent"}
BRAR = {"Rare": 0, "Epic": 1, "Legendary": 2, "Mythic": 3}
def oe_art(slug):
    im = Image.open(REPO + f"art/{slug}.webp").convert("RGB").resize((CELL, CELL), Image.LANCZOS)
    return add_art(im)
FORT = {
    "coin": [E("cast", "mana", n=1), E("cast", "draw", n=1)], "penny": [E("cast", "mana", n=1), E("cast", "draw", n=1)],
    "dice": [E("cast", "gamble", n=4)], "card": [E("cast", "draw", n=2)], "joker": [E("cast", "transform", tg="m")],
    "ticket": [E("cast", "discover", pool="legendary")], "jackpot": [E("cast", "draw", n=3)], "clover": [E("cast", "buff", a=2, h=2, tg="fm")],
    "horseshoe": [E("cast", "kw", k="divine", tg="fm"), E("cast", "buff", a=1, h=1, tg="fm")], "rabbit": [E("cast", "buff", a=1, h=1, tg="fm_all")],
    "black-cat": [E("cast", "curse", n=3, tg="m")], "mirror": [E("cast", "curse", n=2, tg="em_all")], "salt": [E("cast", "silence", tg="m")],
    "crystal-ball": [E("cast", "discover", pool="spell")], "tarot": [E("cast", "discover", pool="minion")], "8-ball": [E("cast", "discover", pool="any")],
    "star": [E("cast", "dmg", n=4, tg="any")], "wish": [E("cast", "discover", pool="legendary")], "chip": [E("cast", "summon", id="t_chip", cnt=2)],
    "bell": [E("sec", "dmg", n=3, tg="enemies", trig="eattack")], "marked": [E("sec", "dmg", n=4, tg="trig", trig="eminion")],
    "cooler": [E("sec", "counter", trig="espell")], "ledger": [E("cast", "draw", n=2), E("cast", "armor", n=3)],
}
for i in man:
    slug, cat, b = i["slug"], i["category"], i["bucket"]
    if cat == "Legends & Myth" and slug not in OK_MYTH: continue
    if cat not in ("Animal Kingdom", "Machines in Motion", "Cosmos & Terra", "Tide & Tackle", "Fortune & Folly", "Legends & Myth"): continue
    if not os.path.exists(REPO + f"art/{slug}.webp"): continue
    rar = BRAR[b]
    hv = h(slug)
    if cat == "Fortune & Folly":
        fx = next((v for k2, v in FORT.items() if k2 in slug), None) or [[E("cast", "draw", n=2)], [E("cast", "gamble", n=3)], [E("cast", "coin"), E("cast", "coin")]][int(hv * 3)]
        sec = fx[0]["trig"] if fx[0]["on"] == "sec" else None
        cost = 2 if sec else max(0, min(8, round(sum(eff_value(e) for e in fx) / 1.6)))
        add(spell(f"oe_{slug}", i["subject"], "collector", rar, cost, fx, oe_art(slug), g="Odds & Ends", secret=sec, tr="Fortune"))
    elif cat == "Cosmos & Terra":
        lst = [[E("cast", "dmg", n=2 + rar, tg="any")], [E("cast", "dmg", n=1 + rar, tg="em_all")], [E("cast", "armor", n=4 + 2 * rar), E("cast", "draw", n=1)],
               [E("cast", "freeze", tg="em_all")] + ([E("cast", "dmg", n=rar, tg="em_all")] if rar else []), [E("cast", "aoe_heal", n=3 + rar, tg="friends")],
               [E("cast", "draw", n=1 + (rar >= 2))], [E("cast", "missiles", n=3 + 2 * rar)], [E("cast", "summon", id="t_chip", cnt=1 + rar // 2)]]
        fx = lst[int(hv * len(lst))]
        if rar == 3: fx = [E("cast", "dmg", n=4, tg="enemies"), E("cast", "draw", n=2)] if hv < 0.5 else [E("cast", "destroy", tg="am_all")]
        cost = max(0, min(10, round(sum(eff_value(e) for e in fx) / 1.6)))
        add(spell(f"oe_{slug}", i["subject"], "collector", rar, cost, fx, oe_art(slug), g="Odds & Ends", tr="Cosmos"))
    else:
        cls = "collector" if cat == "Machines in Motion" else "neutral"
        cost = [1 + int(hv * 4), 2 + int(hv * 5), 4 + int(hv * 4), 6 + int(hv * 4)][rar]
        kw, fx = [], []
        r2 = h(slug + "k")
        if cat == "Machines in Motion":
            kw = [["divine"], ["rush"], ["charge"], ["taunt", "divine"], [], ["windfury"]][int(r2 * 6)]
            if not kw: fx = [E("dr", "summon", id="t_chip", cnt=2)]
            frac = 0.5; tr = "Mech"
        elif cat == "Animal Kingdom":
            kw = [[], ["rush"], ["taunt"], ["stealth"], ["poisonous"], ["charge"], []][int(r2 * 7)]
            if not kw and rar >= 1: fx = [E("bc", "buff", a=1, h=1, tg="fm")] if r2 < 0.5 else [E("bc", "dmg", n=2, tg="any")]
            frac = 0.55; tr = "Beast"
        elif cat == "Tide & Tackle":
            kw = [["taunt"], ["frostbite"], ["stealth"], []][int(r2 * 4)]
            if not kw: fx = [E("bc", "draw", n=1)]
            frac = 0.45; tr = "Sea"
        else:
            kw = [["taunt", "divine"], ["charge"], ["windfury", "rush"], ["poisonous", "stealth"], ["reborn"], ["lifesteal", "taunt"]][int(r2 * 6)]
            if rar >= 2: fx = [[E("bc", "dmg", n=3, tg="em_all")], [E("bc", "freeze", tg="em_all")], [E("bc", "draw", n=2)], [E("dr", "summon", id="t_wisp", cnt=3)]][int(h(slug + "f") * 4)]
            frac = 0.55; tr = "Myth"
        add(minion(f"oe_{slug}", i["subject"], cls, rar, cost, frac, kw, fx, oe_art(slug), g="Odds & Ends", tr=tr))

# ================================================================== SCIENTIST — Labfreak Series 1 & 2
s1 = json.load(open("/home/claude/LabfreakPack/labfreak_series_1.json"))["cards"]
s2 = json.load(open("/home/claude/LabfreakS2/cards.json"))["cards"]
SCI = {"Ember": (["bc_dmg"], 0.55), "Tide": (["freeze"], 0.45), "Moss": (["lifesteal"], 0.45), "Volt": (["windfury"], 0.6),
       "Gloom": (["stealth"], 0.6), "Frost": (["frostbite"], 0.45), "Rust": (["taunt"], 0.35), "Static": (["divine"], 0.5),
       "Spore": (["dr_spore"], 0.5), "Circuit": (["sd"], 0.5)}
RMAP = {"Common": 0, "Uncommon": 0, "Rare": 1, "Holo Rare": 2, "Ultra Rare": 3, "Secret Rare": 3, "Labfreak Prime": 3}
def sci(c, setn, path, box):
    rar = RMAP[c["rarity"]]
    hv = h(c["name"] + setn)
    cost = [1 + int(hv * 4), 3 + int(hv * 3), 5 + int(hv * 3), 7 + int(hv * 3)][rar]
    if c["rarity"] == "Labfreak Prime": cost = 10
    tags, frac = SCI[c["element"]]
    kw, fx, sd = [], [], None
    for t in tags:
        if t == "bc_dmg": fx.append(E("bc", "dmg", n=1 + rar, tg="any"))
        elif t == "freeze": fx.append(E("bc", "freeze", tg="em"))
        elif t == "dr_spore": fx.append(E("dr", "summon", id="t_spore", cnt=1 + rar // 2))
        elif t == "sd": sd = 1 + rar // 2
        else: kw.append(t)
    if rar == 3:
        fx.append([E("bc", "dmg", n=2, tg="em_all"), E("bc", "draw", n=2), E("bc", "summon", id="t_spore", cnt=3), E("bc", "transform", tg="em")][int(hv * 4)])
    if c["rarity"] == "Labfreak Prime":
        kw = ["divine", "taunt"]; fx = [E("bc", "transform", tg="others")]
    art = add_art(crop_card(path, box))
    return minion(f"s{setn}_{c['number']}", c["name"], "scientist", rar, cost, frac, kw, fx, art, bonus=-0.25, sd=sd, g=f"Labfreak Series {setn}",
                  tr=c["element"], fl=c.get("flavor"))
for c in s1:
    add(sci(c, "1", f"/home/claude/LabfreakPack/cards/{c['image']}", (90, 86, 410, 406)))
for c in s2:
    full = c["rarity"] in ("Ultra Rare", "Secret Rare", "Labfreak Prime")
    add(sci(dict(c, flavor=c.get("flavor")), "2", f"/home/claude/LabfreakS2/cards/{c['image']}", (117, 170, 617, 670) if full else (140, 100, 595, 555)))
SCI_SPELLS = [("Shrink Ray", 2, [E("cast", "curse", n=3, tg="m")], "fxa_ring_arcane"), ("Mutagen", 2, [E("cast", "buff", a=3, h=1, tg="fm")], "fx_pool_miasma"),
              ("Tesla Coil", 3, [E("cast", "dmg", n=1, tg="enemies"), E("cast", "dmg", n=1, tg="em_all")], "fxa_ring_shock"),
              ("It's Alive!", 4, [E("cast", "resurrect", n=2)], "fx_sigil_necro"), ("Petri Dish", 1, [E("cast", "summon", id="t_spore", cnt=2)], "fx_pool_acid" if cached("fx", "fx_pool_acid") else "fx_spray_acid"),
              ("Lab Accident", 5, [E("cast", "transform", tg="em_all")], "fx_explosion"), ("Acid Beam", 4, [E("cast", "dmg", n=6, tg="any")], "fx_beam_acid"),
              ("Cryo Chamber", 2, [E("cast", "freeze", tg="any"), E("cast", "draw", n=1)], "fx_beam_frost"),
              ("Arcane Spray", 3, [E("cast", "missiles", n=5)], "fx_spray_arcane"), ("Frost Spray", 3, [E("cast", "dmg", n=2, tg="em_all"), E("cast", "freeze", tg="em_all")], "fx_spray_frost"),
              ("Holy Beam", 2, [E("cast", "dmg", n=3, tg="any"), E("cast", "heal", n=3, tg="fhero")], "fx_beam_holy"),
              ("Experiment 626", 6, [E("cast", "summon", id="t_spore", cnt=3), E("cast", "buff", a=1, h=1, tg="fm_all")], "fx_sigil_nature"),
              ("Overclock", 1, [E("cast", "buff", a=2, h=0, tg="fm"), E("cast", "kw", k="rush", tg="fm")], "fxa_spark_zap"),
              ("Meteor", 7, [E("cast", "dmg", n=10, tg="m"), E("cast", "dmg", n=3, tg="others")], "fx_meteor"),
              ("Lightning", 1, [E("cast", "dmg", n=3, tg="any")], "fx_lightning")]
for i, (nm, cost, fx, fxk) in enumerate(SCI_SPELLS):
    if cached("fx", fxk) is None: fxk = "fxa_ring_arcane"
    add(spell(f"scs_{i}", nm, "scientist", 0 if cost <= 2 else 1 if cost <= 4 else 2, cost, fx, fx_art(fxk, (255, 110, 225)), g="Labfreak", vfx=fx_layer(fxk)))

# ================================================================== NEUTRAL legends — Multiverse crossovers + Dr. Labfreak
mv = json.load(open("/home/claude/LabfreakMV/cards.json"))["cards"]
for c in mv:
    if c["rarity"] not in ("crossover", "multiverse"): continue
    art = add_art(crop_card(f"/home/claude/LabfreakMV/cards/{c['image']}", (87, 105, 647, 665)))
    if c["rarity"] == "multiverse":
        add(minion("mv_labfreak", "Dr. Labfreak", "neutral", 3, 10, 0.5, ["taunt", "divine"],
                   [E("bc", "transform", tg="others"), E("bc", "draw", n=2)], art, g="Labfreak Multiverse", tr="Legend",
                   fl="Made every world in this set. Can unmake them too."))
    else:
        hv = h(c["name"])
        fx = [[E("bc", "dmg", n=3, tg="em_all")], [E("bc", "destroy", tg="em")], [E("bc", "dmg", n=2, tg="enemies"), E("bc", "aoe_heal", n=2, tg="friends")],
              [E("bc", "summon", id="t_wisp", cnt=2), E("bc", "buff", a=1, h=1, tg="fm_all")], [E("bc", "freeze", tg="em_all"), E("bc", "draw", n=1)]][int(hv * 5)]
        kw = [["rush"], ["taunt"], ["charge"], ["divine"], ["lifesteal"]][int(h(c["name"] + "k") * 5)]
        add(minion(f"mv_{c['number']}", c["name"], "neutral", 3, 7 + int(hv * 3), 0.5, kw, fx, art, g="Labfreak Multiverse", tr="Crossover",
                   fl="Two worlds collide. Only one walks away."))

# ================================================================== tokens art + heroes
for tid, t in TOKENS.items():
    if tid == "coin": t["art"] = add_art(bake_sprite(Image.open(REPO + "art/lucky-penny.webp") if os.path.exists(REPO + "art/lucky-penny.webp") else radial_bg((255, 215, 90)), radial_bg((255, 215, 90)), mode="center", scale=0.9)); continue
    src_ = {"t_wisp": (REPO + "glimmerdeep/img/cr_mydf1.webp", None), "t_skel": (None, "enemy_skel"), "t_slime": (None, "enemy_slime"),
            "t_homun": (None, "enemy_homunculus"), "t_spore": (None, None), "t_wall": (None, None), "t_brood": (None, "brood_a"),
            "t_skel2": (None, "enemy_skel"), "t_chip": (REPO + "art/poker-chip.webp", None)}[tid]
    if src_[0] and os.path.exists(src_[0]):
        im = Image.open(src_[0])
    elif src_[1]:
        im = cached("dmp", src_[1]) or cached("th", src_[1])
    else:
        im = cached("fx", "fx_ob_star") if tid == "t_spore" else cached("fx", "fx_wall_light")
    t["art"] = add_art(bake_sprite(im, radial_bg(CCOL[t["c"]]), mode="center" if tid in ("t_spore", "t_wall", "t_chip") else "stand", scale=0.86))
    t["tx"] = describe(t)

HEROES = {
    "tamer": ("The Tamer", REPO + "glimmerdeep/img/tamer_mystic_star/wd_tamer.webp", "Glimmer Bond", "Give one of your minions +1 Attack and +1 Health.",
              [E("hp", "buff", a=1, h=1, tg="fm")], "bg_core"),
    "gambler": ("The Gambler", REPO + "lootdaggers/art-src/portrait_gambler.webp", "Pull the Lever", "Deal 2 damage to a random enemy.",
                [E("hp", "dmg", n=2, tg="rand_enemy")], "bg_wall_boss"),
    "healer": ("Wren", REPO + "thankless/art-src/face_wren.webp", "Mend", "Heal any character for 3.", [E("hp", "heal", n=3, tg="any")], "th"),
    "collector": ("The Collector", REPO + "lootdaggers/art-src/portrait_merchant.webp", "Insurance", "Gain 3 Armor.", [E("hp", "armor", n=3)], "bg_title"),
    "scientist": ("Dr. Labfreak", REPO + "lootdaggers/art-src/portrait_drlabfreak.webp", "Zap", "Deal 1 damage to any target.", [E("hp", "dmg", n=1, tg="any")], "bg_wall_lab"),
}
heroes = {}
for k, (nm, path, hpn, hpt, hfx, bgk) in HEROES.items():
    im = Image.open(path).convert("RGBA")
    if k == "tamer":
        port = bake_sprite(im, radial_bg(CCOL[k]), mode="stand", glow=(160, 200, 255), scale=0.95)
    elif k == "healer":
        port = im.convert("RGB").crop((0, 40, 344, 384)).resize((CELL, CELL), Image.LANCZOS)
    else:
        w0 = min(im.size); x0 = (im.width - w0) // 2
        port = im.convert("RGB").crop((x0, int((im.height - w0) * 0.15), x0 + w0, int((im.height - w0) * 0.15) + w0)).resize((CELL, CELL), Image.LANCZOS)
    heroes[k] = {"n": nm, "art": add_art(port), "hp": {"n": hpn, "tx": hpt, "fx": hfx, "m": 2}, "col": CCOL[k], "bg": bgk}

# ================================================================== board backgrounds, FX layers, audio
BOARDS = {}
for name, path in [("bg_core", "glimmerdeep/img/bg_core.webp"), ("bg_magma", "glimmerdeep/img/bg_magma.webp"), ("bg_grotto", "glimmerdeep/img/bg_grotto.webp"),
                   ("bg_verdant", "glimmerdeep/img/bg_verdant.webp"), ("bg_crypt", "glimmerdeep/img/bg_crypt.webp"), ("bg_tundra", "glimmerdeep/img/bg_tundra.webp"),
                   ("bg_skyisles", "glimmerdeep/img/bg_skyisles.webp"), ("bg_observatory", "glimmerdeep/img/bg_observatory.webp"), ("bg_title", "glimmerdeep/img/bg_title.webp"),
                   ("bg_spire", "glimmerdeep/img/bg_spire.webp"), ("bg_dunes", "glimmerdeep/img/bg_dunes.webp"), ("bg_foundry", "glimmerdeep/img/bg_foundry.webp"),
                   ("bg_mire", "glimmerdeep/img/bg_mire.webp"), ("bg_wall_boss", "lootdaggers/art-src/bg_wall_boss.webp"), ("bg_wall_lab", "lootdaggers/art-src/bg_wall_lab.webp")]:
    im = Image.open(REPO + path).convert("RGB")
    im.thumbnail((1280, 1280))
    im.save(OUT + f"img/{name}.webp", quality=72, method=6)
    BOARDS[name] = f"img/{name}.webp"
Image.open(SCR + "v5/th_bg.png").save(OUT + "img/th.webp", quality=80); BOARDS["th"] = "img/th.webp"
for k in ["fxa_explode_fire", "fxa_hit", "fxa_slash_long", "fxa_ring_heal", "fxa_ring_holy", "fxa_nova_frost", "fx_soulorb", "fxa_spark_zap",
          "fxa_ring_arcane", "fx_explosion", "fxa_smash_hammer", "fx_curse", "fx_coins", "fxa_bolt_gold", "fx_slash", "fxa_claw"]:
    fx_layer(k)

def save_sheets():
    meta = []
    for i, sheet in enumerate(SHEETS):
        atlas = Image.new("RGB", (8 * CELL, 8 * CELL), (0, 0, 0))
        for j, im in enumerate(sheet):
            atlas.paste(im.convert("RGB"), ((j % 8) * CELL, (j // 8) * CELL))
        atlas.save(OUT + f"img/a{i:02d}.webp", quality=74, method=6)
        meta.append(f"img/a{i:02d}.webp")
    fxs = Image.new("RGBA", (8 * 256, ((len(FXS) + 7) // 8) * 256), (0, 0, 0, 0))
    for j, im in enumerate(FXS):
        fxs.alpha_composite(im, ((j % 8) * 256 + (256 - im.width) // 2, (j // 8) * 256 + (256 - im.height) // 2))
    fxs.save(OUT + "img/fx.webp", quality=78, method=6)
    return meta

sheets = save_sheets()
os.makedirs(OUT + "sfx", exist_ok=True)
import shutil
for f in ("click", "hit1", "hit2", "hit3", "heal", "ko", "summon", "shield", "ult", "coin", "crit", "fightstart", "lvl", "relic", "miss"):
    shutil.copy(REPO + f"glimmerdeep/sfx/{f}.mp3", OUT + f"sfx/{f}.mp3")
for f in ("fight", "title", "stinger_win", "stinger_lose"):
    shutil.copy(REPO + f"glimmerdeep/music/{f}.mp3", OUT + f"sfx/{f}.mp3")

# strip None fields, compact
def clean(c):
    return {k: v for k, v in c.items() if v not in (None, [], "") or k in ("kw", "fx")}
data = {"cards": [clean(c) for c in CARDS], "tokens": {k: clean(v) for k, v in TOKENS.items()}, "heroes": heroes,
        "sheets": sheets, "fx": FXART, "boards": BOARDS, "cell": CELL}
with open(OUT + "data/cards.js", "w") as f:
    f.write("window.LL_DATA=" + json.dumps(data, separators=(",", ":")) + ";")
from collections import Counter
print(len(CARDS), "cards;", len(SHEETS), "sheets;", len(FXS), "fx")
print(Counter(c["c"] for c in CARDS)); print(Counter(c["t"] for c in CARDS)); print(Counter(c["r"] for c in CARDS))
