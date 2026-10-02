"""Tiny Meshy API client for the 3D pipeline. Reads MESHY_API_KEY from the
environment (never stored in the repo). Every task id and result URL is
appended to meshy-log.jsonl next to this file so paid work can be recovered."""
import base64, json, os, sys, time, urllib.request, urllib.error

API = 'https://api.meshy.ai/openapi'
KEY = os.environ.get('MESHY_API_KEY', '')
LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'meshy-log.jsonl')

def _req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + path, data=data, method=method,
                               headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(r, timeout=300) as f:
                return json.load(f)
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:500]
            if e.code in (429, 500, 502, 503) and attempt < 4:
                time.sleep(4 * (attempt + 1)); continue
            raise RuntimeError(f'{method} {path} -> {e.code}: {msg}')
        except urllib.error.URLError:
            if attempt < 4: time.sleep(4 * (attempt + 1)); continue
            raise

def balance():
    return _req('GET', '/v1/balance')['balance']

def data_uri(path):
    ext = os.path.splitext(path)[1].lower().lstrip('.')
    mime = {'webp': 'image/webp', 'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'glb': 'application/octet-stream'}[ext]
    return f'data:{mime};base64,' + base64.b64encode(open(path, 'rb').read()).decode()

def log(entry):
    with open(LOG, 'a') as f: f.write(json.dumps(entry) + '\n')

def create(kind, body, tag):
    """kind: 'v1/image-to-image', 'v1/image-to-3d', 'v1/rigging', 'v1/animations', 'v1/retexture'"""
    res = _req('POST', '/' + kind, body)
    tid = res.get('result')
    log({'t': time.time(), 'tag': tag, 'kind': kind, 'id': tid})
    return tid

def wait(kind, tid, every=8, limit=1800):
    t0 = time.time()
    while True:
        d = _req('GET', f'/{kind}/{tid}')
        st = d.get('status')
        if st in ('SUCCEEDED', 'FAILED', 'CANCELED', 'EXPIRED'):
            return d
        if time.time() - t0 > limit:
            raise TimeoutError(f'{kind} {tid} still {st}')
        time.sleep(every)

def fetch(url, path):
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    urllib.request.urlretrieve(url, path)
    return path
