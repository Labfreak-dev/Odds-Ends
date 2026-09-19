#!/usr/bin/env python3
"""Generate the Thankless art with Grok Imagine (xAI API).

Reads thankless/art-prompts.txt (one "filename | prompt" per line) and writes
the raw takes into thankless/art-src/ at 512px, quality 95, backgrounds and
all. The packer (pack-art.py) keys, trims, resizes and bundles them into
art.js, so a bad key tolerance is fixed by re-packing, never by regenerating.
Run it on your own machine:

    pip install pillow
    export XAI_API_KEY=xai-...              # from console.x.ai
    python3 thankless/gen-art.py --dry-run  # the plan, free
    python3 thankless/gen-art.py            # everything not yet in art-src/
    python3 thankless/gen-art.py --only brom_asleep,pip_panic   # retakes

Resumable: a file already in art-src/ is skipped, so delete a take you don't
like and re-run to get a fresh one. Then:

    python3 thankless/pack-art.py           # art-src/ -> art.js, stamps index.html

    --only a,b,c    only these keys
    --limit N       stop after N new images (a style test: --limit 4)
    --model M       default grok-imagine-image-2.0
    --delay S       pause between calls, default 1.0s
    --dry-run       print the plan, call nothing
"""
import argparse, base64, io, json, os, pathlib, sys, time, urllib.request, urllib.error

API = "https://api.x.ai/v1/images/generations"
HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE / "art-src"

def load_plan(only, limit):
    plan = []
    for line in open(HERE / "art-prompts.txt", encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#"): continue
        fn, prompt = [p.strip() for p in line.split("|", 1)]
        key = fn.rsplit(".", 1)[0]
        if only and key not in only: continue
        plan.append((fn, prompt))
        if limit and len(plan) >= limit: break
    return plan

def generate(prompt, model, key):
    body = json.dumps({"model": model, "prompt": prompt, "n": 1, "response_format": "b64_json"}).encode()
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
                wait = 5 * (2 ** attempt); print(f"      http {e.code}, retrying in {wait}s... {detail}"); time.sleep(wait); continue
            raise RuntimeError(f"http {e.code}: {detail}")
        except Exception:
            if attempt < 3: time.sleep(5 * (2 ** attempt)); continue
            raise

def save_take(raw, out_path):
    from PIL import Image
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    w, h = im.size
    s = 512 / max(w, h)
    if s < 1: im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
    im.save(out_path, "WEBP", quality=95, method=6)
    return out_path.stat().st_size

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default=""); ap.add_argument("--limit", type=int)
    ap.add_argument("--model", default="grok-imagine-image-2.0"); ap.add_argument("--delay", type=float, default=1.0)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    only = set(s.strip() for s in a.only.split(",") if s.strip()) or None
    plan = load_plan(only, a.limit); SRC.mkdir(exist_ok=True)
    todo = [(fn, p) for fn, p in plan if not (SRC / fn).exists()]
    print(f"{len(plan)} in scope, {len(plan)-len(todo)} already done, {len(todo)} to generate  (~${len(todo)*0.02:.2f} at $0.02/image)")
    if a.dry_run:
        for fn, _ in todo: print("  would make", fn)
        return
    if not todo: return
    try: from PIL import Image  # noqa
    except ImportError: sys.exit("Pillow is required:  pip install pillow")
    key = os.environ.get("XAI_API_KEY")
    if not key: sys.exit("set XAI_API_KEY first (from console.x.ai)")
    done, failed = 0, []
    for i, (fn, prompt) in enumerate(todo, 1):
        print(f"[{i}/{len(todo)}] {fn}")
        try:
            size = save_take(generate(prompt, a.model, key), SRC / fn); print(f"      ok, {size//1024}KB"); done += 1
        except Exception as e:
            print(f"      FAILED: {e}"); failed.append(fn)
        time.sleep(a.delay)
    print(f"\ndone: {done} generated, {len(failed)} failed")
    if failed: print("re-run just the failures with:\n  python3 thankless/gen-art.py --only " + ",".join(f.rsplit('.',1)[0] for f in failed))
    print("now pack:  python3 thankless/pack-art.py")

if __name__ == "__main__":
    main()
