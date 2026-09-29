// Re-seat a weapon so the hand holds its handle: move the handle point (frac along the
// long axis, cross-section centre) onto the hand and turn the weapon 180° about its
// local x so the blade points where the handle used to.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [inp, out, name, fracS] = process.argv.slice(2); const frac = +fracS;
const doc = await io.read(inp);
const n = doc.getRoot().listNodes().find(x => x.getName() === name);
const pos = n.getMesh().listPrimitives()[0].getAttribute('POSITION');
const P = []; for (let i = 0; i < pos.getCount(); i++) P.push(pos.getElement(i, []));   // getElement dequantizes normalized data
const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
for (const p of P) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); }
const ax = 2, len = mx[ax] - mn[ax];
const sel = P.filter(p => { const f = (p[ax] - mn[ax]) / len; return f > frac - 0.03 && f < frac + 0.03; });
const H = [0, 1, 2].map(k => sel.reduce((a, p) => a + p[k], 0) / sel.length);
const qmul = (a, b) => [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1], a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0], a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3], a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const rot = (q, v) => { const [x,y,z,w]=q; const uv=[y*v[2]-z*v[1], z*v[0]-x*v[2], x*v[1]-y*v[0]]; const uuv=[y*uv[2]-z*uv[1], z*uv[0]-x*uv[2], x*uv[1]-y*uv[0]]; return [v[0]+2*(w*uv[0]+uuv[0]), v[1]+2*(w*uv[1]+uuv[1]), v[2]+2*(w*uv[2]+uuv[2])]; };
const R = n.getRotation(), s = n.getScale();
const R2 = qmul(R, [1, 0, 0, 0]);                       // 180° about local x
const sH = [H[0]*s[0], H[1]*s[1], H[2]*s[2]];
const t2 = rot(R2, sH).map(x => -x);
console.log(name, 'handle point', H.map(x=>x.toFixed(3)), 'old t', n.getTranslation().map(x=>x.toFixed(2)), 'new t', t2.map(x=>x.toFixed(2)));
n.setRotation(R2).setTranslation(t2);
await io.write(out, doc);
