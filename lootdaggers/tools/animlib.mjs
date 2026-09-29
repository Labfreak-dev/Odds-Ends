import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, resample, dedup } from '@gltf-transform/functions';
import fs from 'fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const [out, ...ins] = process.argv.slice(2);
// first file is the base; animations from the others are re-targeted onto its nodes by name
const base = await io.read(ins[0]);
const root = base.getRoot();
const byName = new Map(root.listNodes().map(n => [n.getName(), n]));
const seen = new Set(root.listAnimations().map(a => a.getName()));
for (const f of ins.slice(1)) {
  const d = await io.read(f);
  for (const a of d.getRoot().listAnimations()) {
    let name = a.getName(); if (name.includes('|')) name = f.includes('walk') ? 'Walking' : f.includes('run') ? 'Running' : name;
    if (seen.has(name)) continue; seen.add(name);
    const na = base.createAnimation(name);
    for (const ch of a.listChannels()) {
      const tn = byName.get(ch.getTargetNode().getName()); if (!tn) continue;
      const s = ch.getSampler();
      const inp = base.createAccessor().setArray(s.getInput().getArray().slice()).setType('SCALAR');
      const outp = base.createAccessor().setArray(s.getOutput().getArray().slice()).setType(s.getOutput().getType());
      const ns = base.createAnimationSampler().setInput(inp).setOutput(outp).setInterpolation(s.getInterpolation());
      na.addSampler(ns).addChannel(base.createAnimationChannel().setTargetNode(tn).setTargetPath(ch.getTargetPath()).setSampler(ns));
    }
  }
}
for (const n of root.listNodes()) { if (n.getMesh()) n.setMesh(null); if (n.getSkin()) n.setSkin(null); }
for (const m of root.listMeshes()) m.dispose();
for (const s of root.listSkins()) s.dispose();
for (const t of root.listTextures()) t.dispose();
for (const m of root.listMaterials()) m.dispose();
const buf = root.listBuffers(); for (let i = 1; i < buf.length; i++) buf[i].dispose();
for (const acc of root.listAccessors()) acc.setBuffer(root.listBuffers()[0]);
await base.transform(resample({ tolerance: 1e-4 }), dedup(), prune());
for (const e of root.listExtensionsUsed()) e.dispose();
await io.write(out, base);
console.log(out, fs.statSync(out).size, root.listAnimations().map(a => a.getName()).join(', '));
