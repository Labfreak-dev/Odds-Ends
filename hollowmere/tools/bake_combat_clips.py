#!/usr/bin/env python3
"""Bake mesh-less combat glbs into HMCL rotation packs for Resources/Combat.

glTF quaternions are converted the way glTFast does: x and z negated.
Clip ids come from the sibling .clips.json and are paired to glTF animations
by duration, because Meshy's animation names are not the skill ids.
"""
import json, os, struct, math

ROOT = os.path.join(os.path.dirname(__file__), "..", "Assets")
ANIM = os.path.join(ROOT, "Art", "Combat", "anims")
OUT = os.path.join(ROOT, "Resources", "Combat")

HEROES = {
    "hero_ironclad": "hero_ironclad_combat_anims",
    "hero_stalker": "hero_stalker_combat_anims",
    "hero_hexweaver": "hero_hexweaver_combat_anims",
}


def load_glb(path):
    data = open(path, "rb").read()
    off = 12
    clen, _ = struct.unpack_from("<II", data, off)
    off += 8
    gltf = json.loads(data[off:off + clen])
    off += clen
    blen, _ = struct.unpack_from("<II", data, off)
    off += 8
    return gltf, data[off:off + blen]


def accessor(gltf, blob, index):
    acc = gltf["accessors"][index]
    view = gltf["bufferViews"][acc["bufferView"]]
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    count = acc["count"]
    n = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc["type"]]
    stride = view.get("byteStride", 4 * n)
    out = []
    for k in range(count):
        vals = struct.unpack_from("<" + "f" * n, blob, start + k * stride)
        out.append(vals[0] if n == 1 else vals)
    return out


def duration(gltf, blob, anim):
    accs = gltf["accessors"]
    tmax = 0.0
    for samp in anim["samplers"]:
        mx = accs[samp["input"]].get("max")
        if mx:
            tmax = max(tmax, mx[0] if isinstance(mx, list) else mx)
    return tmax


def unity_quat(q):
    x, y, z, w = -q[0], q[1], -q[2], q[3]
    m = math.sqrt(x * x + y * y + z * z + w * w) or 1.0
    return (x / m, y / m, z / m, w / m)


def pair(clips_json, gltf, blob):
    anims = list(enumerate(gltf["animations"]))
    items = []
    for name, frames in clips_json.items():
        items.append((name, frames[1] / 24.0))
    used = set()
    mapping = {}
    for name, dur in sorted(items, key=lambda x: -x[1]):
        best, err = None, 1e9
        for i, anim in anims:
            if i in used:
                continue
            d = abs(duration(gltf, blob, anim) - dur)
            if d < err:
                best, err = i, d
        used.add(best)
        mapping[name] = best
        print(f"  {name:24} {gltf['animations'][best]['name']:32} err {err:.3f}s")
        if err > 0.25:
            raise SystemExit("clip duration did not match an animation")
    return mapping


def pack(path, mapping, gltf, blob):
    nodes = gltf["nodes"]
    buf = bytearray()
    buf += b"HMCL"
    buf += struct.pack("<ii", 1, len(mapping))
    for name, index in mapping.items():
        anim = gltf["animations"][index]
        bones = []
        for ch in anim["channels"]:
            if ch["target"]["path"] != "rotation":
                continue
            node = nodes[ch["target"]["node"]]
            bone = node.get("name") or ""
            if not bone:
                continue
            samp = anim["samplers"][ch["sampler"]]
            times = accessor(gltf, blob, samp["input"])
            vals = accessor(gltf, blob, samp["output"])
            bones.append((bone, times, vals))
        raw = name.encode("utf-8")
        buf += struct.pack("<H", len(raw)) + raw
        buf += struct.pack("<i", len(bones))
        for bone, times, vals in bones:
            bname = bone.encode("utf-8")
            buf += struct.pack("<H", len(bname)) + bname
            buf += struct.pack("<i", len(times))
            for t, q in zip(times, vals):
                u = unity_quat(q)
                buf += struct.pack("<fffff", float(t), u[0], u[1], u[2], u[3])
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "wb").write(buf)
    print("wrote", path, len(buf))


def main():
    for hero, stem in HEROES.items():
        gltf, blob = load_glb(os.path.join(ANIM, stem + ".glb"))
        clips = json.load(open(os.path.join(ANIM, stem + ".clips.json")))
        print(hero)
        mapping = pair(clips, gltf, blob)
        pack(os.path.join(OUT, hero + "_combat.bytes"), mapping, gltf, blob)


if __name__ == "__main__":
    main()
