#!/usr/bin/env python3
"""Build a PREVIEW copy of the game, so a change can be played on a real
phone without touching the live game at the repo root.

    python3 workshop/make-preview.py              # -> preview/index.html
    python3 workshop/make-preview.py --full       # -> preview/ + its own oe-*.js

GitHub Pages serves subfolders, so the result is playable at
labfreak-dev.github.io/Odds-Ends/preview/ while the root stays untouched.

LIGHT (default): writes ONLY preview/index.html and points its <script>
tags at the root's ../oe-*.js. Costs ~270KB instead of ~33MB, and the
preview automatically tracks whatever javascript the root is serving.
Use it for css/layout questions. It CANNOT show module changes, because
it is running the root's javascript by definition.

FULL (--full): a complete standalone build inside preview/. Use this to
try module changes. Costs the full ~33MB per copy, so prefer light.

Both layer workshop/preview.css on top of the normal build. Everything
needed lives in the repo, so the preview rebuilds from a clean clone -
the Batch 51 lesson: never ship a build whose source is not committed.
"""
import io, os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.abspath(sys.argv[sys.argv.index("--out")+1]) if "--out" in sys.argv \
       else os.path.join(ROOT, "preview")
FULL = "--full" in sys.argv

extra = io.open(os.path.join(HERE, "preview.css"), encoding="utf-8").read()

def inject(html):
    """Append the preview css to the LAST </style>, so it wins on specificity ties."""
    n = html.count("</style>")
    if n < 1:
        print("  ABORT [preview css] no </style> in the generated html"); sys.exit(1)
    i = html.rfind("</style>")
    return html[:i] + "\n/* ===== PREVIEW OVERRIDES ===== */\n" + extra + "\n" + html[i:]

build_dir = OUT if FULL else tempfile.mkdtemp(prefix="oe-preview-")
r = subprocess.run([sys.executable, os.path.join(HERE, "integrate.py"), "--out", build_dir])
if r.returncode != 0:
    print("  ABORT [preview] integrate.py failed"); sys.exit(1)

html = io.open(os.path.join(build_dir, "index.html"), encoding="utf-8").read()
html = inject(html)

if not FULL:
    # point the script tags at the root build one level up
    html, n = re.subn(r'(<script src=")(oe-)', r'\1../\2', html)
    print(f"  light: {n} script tags repointed to ../oe-*.js")
    os.makedirs(OUT, exist_ok=True)
    shutil.rmtree(build_dir, ignore_errors=True)

io.open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(html)
kb = len(html) // 1024
print(f"  preview -> {os.path.relpath(OUT, ROOT)}/index.html ({kb} KB, {'full' if FULL else 'light'})")
print(f"  css layered from workshop/preview.css ({len(extra)} bytes)")
