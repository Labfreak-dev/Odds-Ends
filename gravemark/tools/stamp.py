#!/usr/bin/env python3
"""Set the build stamp in ONE place: GM.BUILD in src/00-util.js and the ?v=
query on every script and stylesheet tag in index.html. Art URLs pick the
stamp up from GM.BUILD at runtime. Run before every deploy:

    python3 tools/stamp.py b016-something
"""
import re, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
stamp = sys.argv[1]
p = os.path.join(ROOT, "src", "00-util.js"); s = open(p).read()
s2 = re.sub(r'GM\.BUILD = "[^"]*"', 'GM.BUILD = "%s"' % stamp, s)
assert s2 != s or stamp in s, "GM.BUILD not found"
open(p, "w").write(s2)
p = os.path.join(ROOT, "index.html"); s = open(p).read()
s = re.sub(r'href="css/main\.css(\?v=[^"]*)?"', 'href="css/main.css?v=%s"' % stamp, s)
s = re.sub(r'src="(src/[^"?]+\.js)(\?v=[^"]*)?"', r'src="\1?v=%s"' % stamp, s)
open(p, "w").write(s)
print("stamped", stamp)
