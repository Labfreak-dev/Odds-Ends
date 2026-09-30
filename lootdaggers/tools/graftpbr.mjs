// Give a rigged foe back the PBR maps Meshy's rigging step dropped. The rigged file keeps
// only the base colour, wired as both base and a full-white emissive (so the model ignores
// the scene's lights) with a doubled specular. The unrigged model from the same task has the
// same UVs and its normal + metal/roughness maps: copy them in (WebP, 1K), turn the emissive
// off and reset the specular. Usage: node graftpbr.mjs game.glb meshy_model.glb out.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import fs from 'fs'; import { execFileSync } from 'child_process';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const [gameP, srcP, outP, size = '1024'] = process.argv.slice(2);
const doc = await io.read(gameP), src = await io.read(srcP);
const sm = src.getRoot().listMaterials()[0];
const webp = (img, name) => {
  const a = `/tmp/_g_${name}.img`, b = `/tmp/_g_${name}.webp`;
  fs.writeFileSync(a, img);
  execFileSync('python3', ['-c', `from PIL import Image;im=Image.open('${a}').convert('RGB');im.resize((${size},${size}),Image.LANCZOS).save('${b}',quality=86)`]);
  return new Uint8Array(fs.readFileSync(b));
};
const nImg = sm.getNormalTexture() && sm.getNormalTexture().getImage();
const mrImg = sm.getMetallicRoughnessTexture() && sm.getMetallicRoughnessTexture().getImage();
if (!nImg || !mrImg) { console.error('source has no normal/MR maps'); process.exit(1); }
for (const m of doc.getRoot().listMaterials()) {
  const nT = doc.createTexture('normal').setImage(webp(nImg, 'n')).setMimeType('image/webp');
  const mT = doc.createTexture('mr').setImage(webp(mrImg, 'mr')).setMimeType('image/webp');
  m.setNormalTexture(nT).setMetallicRoughnessTexture(mT).setMetallicFactor(1).setRoughnessFactor(1);
  m.setEmissiveTexture(null).setEmissiveFactor([0, 0, 0]);
  m.setExtension('KHR_materials_specular', null);
}
await io.write(outP, doc);
console.log(outP, (fs.statSync(gameP).size / 1e3).toFixed(0) + 'K ->', (fs.statSync(outP).size / 1e3).toFixed(0) + 'K');
