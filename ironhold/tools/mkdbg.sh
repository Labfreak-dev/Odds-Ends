#!/bin/bash
# build the debug copy: index.html + window.__D hook before the final })();
python3 - <<'PY'
import re
p='/home/user/Odds-Ends/ironhold/index.html'; s=open(p).read(); h=open('/tmp/dbg_hook.txt').read()
tail="\n})();\n</script>"; assert s.count(tail)==1
s=s.replace(tail,"\n"+h+tail)
open('/tmp/claude-0/-home-user-Odds-Ends/6256ba04-1a25-565f-b31b-2b72a8b325ad/scratchpad/srv/dbg6/index.html','w').write(s)
for i,m in enumerate(re.findall(r'<script>(.*?)</script>',s,re.S)): open('/tmp/dbg6_%d.js'%i,'w').write(m)
PY
for f in /tmp/dbg6_*.js; do node --check "$f" || exit 1; done; echo dbg6 ok
cp /home/user/Odds-Ends/ironhold/art.js /tmp/claude-0/-home-user-Odds-Ends/6256ba04-1a25-565f-b31b-2b72a8b325ad/scratchpad/srv/dbg6/art.js && node --check /tmp/claude-0/-home-user-Odds-Ends/6256ba04-1a25-565f-b31b-2b72a8b325ad/scratchpad/srv/dbg6/art.js && echo "art ok"
