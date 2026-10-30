#!/usr/bin/env python3
"""Generate Hollowmere's 3D models (Meshy) and audio (ElevenLabs) from tools/assets.json.

Everything lands inside the Unity project, so the build stays reproducible:
    Assets/Resources/Models/<key>.glb            (+ <key>_walk.glb / <key>_run.glb when rigged)
    Assets/Resources/Audio/<key>.mp3

The game loads by key and falls back to primitives / silence for anything missing,
so this can be run a few assets at a time as credits allow.

    python3 tools/fetch_assets.py --list                 # what exists, what is missing
    python3 tools/fetch_assets.py --models --only pet_hound mon_bonewalker
    python3 tools/fetch_assets.py --models --priority 2  # everything at priority <= 2
    python3 tools/fetch_assets.py --audio                # needs ELEVENLABS_API_KEY

Env: MESHY_API_KEY, ELEVENLABS_API_KEY.
Meshy task ids are journalled in tools/.meshy-tasks.json, so an interrupted run resumes
the tasks it already paid for instead of starting (and paying for) new ones.

Itch.io packs are not fetched here: most free packs need a logged-in browser download.
Drop their files into Assets/Resources/Models or Assets/Resources/Audio using the same
keys and the game picks them up.
"""
import argparse, json, os, sys, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "tools", "assets.json")
JOURNAL = os.path.join(ROOT, "tools", ".meshy-tasks.json")
MODELS = os.path.join(ROOT, "Assets", "Resources", "Models")
AUDIO = os.path.join(ROOT, "Assets", "Resources", "Audio")
MESHY = "https://api.meshy.ai/openapi"


def http(method, url, headers, body=None, raw=False):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=dict(headers))
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            payload = r.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {url} -> {e.code}: {e.read()[:400]!r}")
    return payload if raw else json.loads(payload or b"{}")


def download(url, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with urllib.request.urlopen(url, timeout=300) as r, open(path + ".part", "wb") as f:
        f.write(r.read())
    os.replace(path + ".part", path)
    print(f"  saved {os.path.relpath(path, ROOT)} ({os.path.getsize(path) // 1024} KB)")


def load_journal():
    try:
        with open(JOURNAL) as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def save_journal(j):
    with open(JOURNAL, "w") as f:
        json.dump(j, f, indent=1, sort_keys=True)


def meshy_wait(path, task_id, key):
    hdr = {"Authorization": f"Bearer {key}"}
    while True:
        t = http("GET", f"{MESHY}/{path}/{task_id}", hdr)
        status = t.get("status")
        if status == "SUCCEEDED":
            return t
        if status in ("FAILED", "CANCELED", "EXPIRED"):
            raise RuntimeError(f"{path} task {task_id} {status}: {t.get('task_error')}")
        print(f"  {path} {task_id[:8]} {status} {t.get('progress', 0)}%")
        time.sleep(10)


def meshy_balance(key):
    return http("GET", f"{MESHY}/v1/balance", {"Authorization": f"Bearer {key}"}).get("balance", 0)


def gen_model(entry, style, key, ai_model, journal):
    hdr = {"Authorization": f"Bearer {key}"}
    k = entry["key"]
    out = os.path.join(MODELS, f"{k}.glb")
    if os.path.exists(out):
        print(f"{k}: present, skipping")
        return
    j = journal.setdefault(k, {})
    print(f"{k}: generating")
    if "preview" not in j:
        j["preview"] = http("POST", f"{MESHY}/v2/text-to-3d", hdr, {
            "mode": "preview",
            "prompt": f"{entry['prompt']}, {style}"[:600],
            "art_style": "realistic",
            "ai_model": ai_model,
            "topology": "triangle",
            "target_polycount": 6000,
            "should_remesh": True,
        })["result"]
        save_journal(journal)
    meshy_wait("v2/text-to-3d", j["preview"], key)
    if "refine" not in j:
        j["refine"] = http("POST", f"{MESHY}/v2/text-to-3d", hdr, {
            "mode": "refine", "preview_task_id": j["preview"], "enable_pbr": False,
        })["result"]
        save_journal(journal)
    done = meshy_wait("v2/text-to-3d", j["refine"], key)
    download(done["model_urls"]["glb"], out)
    if entry.get("rig"):
        try:
            if "rig" not in j:
                j["rig"] = http("POST", f"{MESHY}/v1/rigging", hdr, {
                    "input_task_id": j["refine"], "height_meters": entry.get("height_m", 1.8),
                })["result"]
                save_journal(journal)
            rig = meshy_wait("v1/rigging", j["rig"], key)["result"]
            download(rig["rigged_character_glb_url"], out)
            anims = rig.get("basic_animations") or {}
            # Only the walk cycle is used (monsters play it while moving, slowed when idle);
            # each clip is a full copy of the mesh, so the run cycle isn't worth the repo space.
            for name, field in (("walk", "walking_glb_url"),):
                if anims.get(field):
                    download(anims[field], os.path.join(MODELS, f"{k}_{name}.glb"))
        except RuntimeError as e:
            print(f"  rigging failed, keeping the static model: {e}")


def gen_audio(entry, key):
    k = entry["key"]
    out = os.path.join(AUDIO, f"{k}.mp3")
    if os.path.exists(out):
        print(f"{k}: present, skipping")
        return
    hdr = {"xi-api-key": key, "Accept": "audio/mpeg"}
    print(f"{k}: generating {entry['kind']}")
    if entry["kind"] == "music":
        data = http("POST", "https://api.elevenlabs.io/v1/music", hdr,
                    {"prompt": entry["prompt"], "music_length_ms": int(entry["seconds"] * 1000)}, raw=True)
    else:
        data = http("POST", "https://api.elevenlabs.io/v1/sound-generation", hdr,
                    {"text": entry["prompt"], "duration_seconds": max(0.5, min(22, entry["seconds"]))}, raw=True)
    os.makedirs(AUDIO, exist_ok=True)
    with open(out, "wb") as f:
        f.write(data)
    print(f"  saved {os.path.relpath(out, ROOT)} ({len(data) // 1024} KB)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--models", action="store_true")
    ap.add_argument("--audio", action="store_true")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--only", nargs="*", default=None)
    ap.add_argument("--priority", type=int, default=99)
    ap.add_argument("--ai-model", default="meshy-6-lite", help="meshy-6-lite is the cheap tier; meshy-6 looks better and costs more")
    ap.add_argument("--min-balance", type=int, default=15, help="stop starting new models below this many credits")
    a = ap.parse_args()
    m = json.load(open(MANIFEST))

    def wanted(e):
        return (a.only is None or e["key"] in a.only) and e.get("priority", 99) <= a.priority

    if a.list or not (a.models or a.audio):
        for e in m["models"]:
            print(("ok  " if os.path.exists(os.path.join(MODELS, e["key"] + ".glb")) else "--  ") + "model " + e["key"])
        for e in m["audio"]:
            print(("ok  " if os.path.exists(os.path.join(AUDIO, e["key"] + ".mp3")) else "--  ") + "audio " + e["key"])
        return

    if a.models:
        key = os.environ.get("MESHY_API_KEY") or sys.exit("MESHY_API_KEY is not set")
        journal = load_journal()
        for e in sorted(filter(wanted, m["models"]), key=lambda e: e.get("priority", 99)):
            started = e["key"] in journal
            if not started and not os.path.exists(os.path.join(MODELS, e["key"] + ".glb")):
                bal = meshy_balance(key)
                if bal < a.min_balance:
                    print(f"{e['key']}: stopping, Meshy balance {bal} < {a.min_balance}")
                    break
            try:
                gen_model(e, m["style"], key, a.ai_model, journal)
            except RuntimeError as err:
                print(f"  {e['key']} failed: {err}")

    if a.audio:
        key = os.environ.get("ELEVENLABS_API_KEY") or sys.exit("ELEVENLABS_API_KEY is not set")
        for e in filter(wanted, m["audio"]):
            try:
                gen_audio(e, key)
            except RuntimeError as err:
                print(f"  {e['key']} failed: {err}")


if __name__ == "__main__":
    main()
