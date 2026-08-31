#!/usr/bin/env python3
"""Batch-generate the card art with Grok Imagine (xAI API).

Reads docs/art-prompts.txt (one "filename | prompt" per line), calls the xAI
image API, and writes game-ready 320x320 webps straight into art/ under the
exact filenames the game probes for. Run it on your own machine:

    pip install pillow
    export XAI_API_KEY=xai-...          # from console.x.ai
    python3 docs/gen-art.py --wave 1    # the 38 Mythics
    python3 docs/gen-art.py --wave 1 --dry-run   # see what it WOULD do, free

It is resumable by design: a file that already exists in art/ is skipped, so
you can stop any time and re-run, do waves in pieces, or delete a webp you
don't like and re-run to get a fresh take on just that one.

    --wave N        only wave N (1 Mythic, 2 Legendary, 3 Epic, 4 Rare)
    --only a,b,c    only these slugs (e.g. --only giraffe,stonehenge)
    --limit N       stop after N new images (a cheap style test: --limit 5)
    --model M       default grok-imagine-image-2.0 (try grok-2-image if
                    your account doesn't have it)
    --delay S       pause between calls, default 1.0s
    --dry-run       print the plan, call nothing, spend nothing

When a run finishes, hand the art/ folder (or just the new files) back to the
repo chat: filenames are already correct, so shipping them is commit + push.
"""
import argparse, base64, csv, io, json, os, pathlib, sys, time, urllib.request, urllib.error

API = "https://api.x.ai/v1/images/generations"

# Works from EITHER layout: the full repo (script in docs/, output to ../art)
# or a plain folder holding just gen-art.py + art-list.csv + art-prompts.txt
# (output to an art/ subfolder created next to them).
HERE = pathlib.Path(__file__).resolve().parent
if (HERE/"art-list.csv").exists():
    DOCS, ART = HERE, HERE/"art"
else:
    DOCS, ART = HERE.parent/"docs", HERE.parent/"art"
    if not (DOCS/"art-list.csv").exists():
        sys.exit("can't find art-list.csv - put it (and art-prompts.txt) in the same folder as this script")

def load_plan(wave, only, limit):
    waves = {}
    with open(DOCS/"art-list.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            waves[row["filename"]] = int(row["wave"])
    plan = []
    for line in open(DOCS/"art-prompts.txt", encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#"): continue
        fn, prompt = [p.strip() for p in line.split("|", 1)]
        slug = fn[:-5]  # drop .webp
        if wave and waves.get(fn) != wave: continue
        if only and slug not in only: continue
        plan.append((fn, prompt))
        if limit and len(plan) >= limit: break
    return plan

def generate(prompt, model, key):
    body = json.dumps({"model": model, "prompt": prompt, "n": 1,
                       "response_format": "b64_json"}).encode()
    req = urllib.request.Request(API, data=body, method="POST", headers={
        "Authorization": "Bearer " + key, "Content-Type": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                j = json.loads(r.read())
            return base64.b64decode(j["data"][0]["b64_json"])
        except urllib.error.HTTPError as e:
            detail = ""
            try: detail = e.read().decode()[:200]
            except Exception: pass
            if e.code in (429, 500, 502, 503) and attempt < 3:
                wait = 5 * (2 ** attempt)
                print(f"      http {e.code}, retrying in {wait}s... {detail}")
                time.sleep(wait); continue
            raise RuntimeError(f"http {e.code}: {detail}")
        except Exception as e:
            if attempt < 3:
                time.sleep(5 * (2 ** attempt)); continue
            raise

def to_card_webp(raw, out_path):
    from PIL import Image
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    # centre-crop square (the API may return non-square), then game size
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w-s)//2, (h-s)//2, (w-s)//2+s, (h-s)//2+s)).resize((320, 320), Image.LANCZOS)
    im.save(out_path, "WEBP", quality=82, method=6)
    return out_path.stat().st_size

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--wave", type=int)
    ap.add_argument("--only", type=str, default="")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--model", default="grok-imagine-image-2.0")
    ap.add_argument("--delay", type=float, default=1.0)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    only = set(s.strip() for s in a.only.split(",") if s.strip()) or None
    plan = load_plan(a.wave, only, a.limit)
    art = ART; art.mkdir(exist_ok=True)
    todo = [(fn, p) for fn, p in plan if not (art/fn).exists()]
    print(f"{len(plan)} in scope, {len(plan)-len(todo)} already done, {len(todo)} to generate"
          f"  (~${len(todo)*0.02:.2f} at $0.02/image)")
    if a.dry_run:
        for fn, p in todo[:15]: print("  would make", fn)
        if len(todo) > 15: print(f"  ... and {len(todo)-15} more")
        return
    if not todo: return
    try: from PIL import Image  # noqa: F401
    except ImportError:
        sys.exit("Pillow is required for the webp conversion:  pip install pillow")
    key = os.environ.get("XAI_API_KEY")
    if not key: sys.exit("set XAI_API_KEY first (from console.x.ai)")

    done, failed = 0, []
    for i, (fn, prompt) in enumerate(todo, 1):
        print(f"[{i}/{len(todo)}] {fn}")
        try:
            raw = generate(prompt, a.model, key)
            size = to_card_webp(raw, art/fn)
            note = "  (over the 40KB cap - consider a retake)" if size > 40_000 else ""
            print(f"      ok, {size//1024}KB{note}")
            done += 1
        except Exception as e:
            print(f"      FAILED: {e}")
            failed.append(fn)
        time.sleep(a.delay)

    print(f"\ndone: {done} generated, {len(failed)} failed")
    if failed:
        slugs = ",".join(f[:-5] for f in failed)
        print(f"re-run just the failures with:\n  python3 docs/gen-art.py --only {slugs}")

if __name__ == "__main__":
    main()
