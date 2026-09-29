// Meshy GLB -> game GLB: drop the bind-pose clip, WebP textures (base 1K, others 512),
// quantize + meshopt. Animation-only files (no meshes) keep their clips.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { prune, dedup, quantize, meshopt, resample } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import fs from 'fs'; import { execFileSync } from 'child_process';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const [inp, out, baseSize = '1024', otherSize = '512'] = process.argv.slice(2);
const doc = await io.read(inp); const root = doc.getRoot();
const hasMesh = root.listMeshes().length > 0;
if (hasMesh) for (const a of root.listAnimations()) if (/clip0|baselayer/i.test(a.getName())) a.dispose();
const baseTex = new Set(root.listMaterials().map(m => m.getBaseColorTexture()).filter(Boolean));
let i = 0;
for (const t of root.listTextures()) {
  const src = `/tmp/_o${i}.img`, dst = `/tmp/_o${i}.webp`; i++;
  fs.writeFileSync(src, t.getImage());
  const sz = baseTex.has(t) ? baseSize : otherSize;
  execFileSync('python3', ['-c', `from PIL import Image;im=Image.open('${src}');im=im.convert('RGBA' if im.mode in ('RGBA','LA') else 'RGB');im.resize((${sz},${sz}),Image.LANCZOS).save('${dst}',quality=82)`]);
  t.setImage(new Uint8Array(fs.readFileSync(dst))).setMimeType('image/webp').setURI('');
}
doc.createExtension(EXTTextureWebP).setRequired(true);
for (const m of root.listMaterials()) m.setExtension('KHR_materials_ior', null);
await doc.transform(resample({ tolerance: 1e-4 }), dedup(), prune(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(out, doc);
console.log(out, (fs.statSync(inp).size / 1e6).toFixed(1) + 'MB ->', (fs.statSync(out).size / 1e6).toFixed(2) + 'MB', 'clips', root.listAnimations().length);
