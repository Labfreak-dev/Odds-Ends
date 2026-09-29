// hero GLB -> static kit GLB (all meshes, bind pose, no skin/anims), textures as 1K JPEG base only
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import fs from 'fs'; import { execFileSync } from 'child_process';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
const [inp, out, keep] = process.argv.slice(2);
const doc = await io.read(inp); const root = doc.getRoot();
for (const a of root.listAnimations()) a.dispose();
for (const n of root.listNodes()) if (n.getMesh() && n.getName() !== keep) { n.getMesh().dispose(); n.dispose(); }
for (const n of root.listNodes()) if (n.getSkin()) n.setSkin(null);
for (const s of root.listSkins()) s.dispose();
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) for (const k of ['JOINTS_0','WEIGHTS_0']) p.setAttribute(k, null);
await doc.transform(dequantize(), prune());
for (const m of root.listMaterials()) {
  const b = m.getBaseColorTexture();
  for (const t of [m.getNormalTexture(), m.getMetallicRoughnessTexture()]) if (t && t !== b) {}
  m.setNormalTexture(null); m.setMetallicRoughnessTexture(null); m.setExtension('KHR_materials_specular', null);
  if (b) { fs.writeFileSync('/tmp/_t.webp', b.getImage()); execFileSync('python3', ['-c', "from PIL import Image;Image.open('/tmp/_t.webp').convert('RGB').resize((1024,1024)).save('/tmp/_t.jpg',quality=85)"]);
    b.setImage(new Uint8Array(fs.readFileSync('/tmp/_t.jpg'))); b.setMimeType('image/jpeg'); b.setURI(m.getName()+'.jpg'); }
}
await doc.transform(prune());
for (const e of root.listExtensionsUsed()) e.dispose();
await io.write(out, doc);
console.log(out, fs.statSync(out).size, root.listMaterials().map(m=>m.getName()));
