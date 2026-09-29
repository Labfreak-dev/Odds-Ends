import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'fs';
const [inp, dir] = process.argv.slice(2);
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(inp);
const m = doc.getRoot().listMaterials()[0];
const put = (t, n) => { if (t) fs.writeFileSync(dir + '/' + n + '.img', t.getImage()); };
put(m.getBaseColorTexture(), 'base'); put(m.getNormalTexture(), 'normal'); put(m.getMetallicRoughnessTexture(), 'mr');
