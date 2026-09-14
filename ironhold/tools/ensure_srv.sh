SRV=/tmp/claude-0/-home-user-Odds-Ends/6256ba04-1a25-565f-b31b-2b72a8b325ad/scratchpad/srv
if ! curl -s -o /dev/null http://localhost:8899/dbg6/index.html; then
  (cd $SRV && setsid nohup python3 -m http.server 8899 >/dev/null 2>&1 < /dev/null &) ; disown 2>/dev/null
  for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:8899/dbg6/index.html && break; sleep 0.25; done
fi
curl -s -o /dev/null -w 'server %{http_code}\n' http://localhost:8899/dbg6/index.html
