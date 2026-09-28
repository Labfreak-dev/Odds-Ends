/* Procedural stand-ins for the Death arena. Replaced per slot when a GLB loads.
   Built in meters, Y-up. Death's group origin is his pelvis; the hero's origin
   is his feet. Both face the directions documented in manifest.js. */
import * as THREE from 'three';

const HERO_IDS = ['knight', 'ranger', 'gambler', 'brute', 'duelist', 'hexpriest'];

const PAL = {
  bone: 0xcbb89a,
  boneDark: 0x8a7b66,
  cloak: 0x100c10,
  cloakEdge: 0x231820,
  iron: 0x3a363c,
  ironDark: 0x1c191c,
  gold: 0x8d7040,
  stone: 0x6a635c,
  stoneDark: 0x3e3836,
  cushion: 0x4a1218,
  soul: 0x14382e,
  soulE: 0x8dffe4,
  fire: 0xff6a2a,
  wood: 0x3a2418,
};

function std(color, extra) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.62, metalness: 0.18 }, extra));
}

function unit(geo, mat, s) {
  const m = new THREE.Mesh(geo, mat);
  if (s) m.scale.set(s[0], s[1], s[2]);
  return m;
}

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sph: new THREE.SphereGeometry(1, 14, 10),
  sphLo: new THREE.SphereGeometry(1, 10, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cylLo: new THREE.CylinderGeometry(1, 1, 1, 7),
};

function box(mat, w, h, d) { return unit(GEO.box, mat, [w, h, d]); }
function sph(mat, sx, sy, sz) { return unit(GEO.sph, mat, [sx, sy == null ? sx : sy, sz == null ? sx : sz]); }
function cyl(mat, rTop, rBot, h, seg) {
  const m = new THREE.Mesh(seg ? GEO.cylLo : GEO.cyl, mat);
  m.scale.set(rTop, h, rBot);
  return m;
}

function rest(obj) {
  obj.userData.rest = {
    rx: obj.rotation.x, ry: obj.rotation.y, rz: obj.rotation.z,
    x: obj.position.x, y: obj.position.y, z: obj.position.z,
  };
}
function applyRest(obj, ox, oy, oz, px, py, pz) {
  const r = obj.userData.rest;
  if (!r) return;
  obj.rotation.set(r.rx + (ox || 0), r.ry + (oy || 0), r.rz + (oz || 0));
  obj.position.set(r.x + (px || 0), r.y + (py || 0), r.z + (pz || 0));
}

function glowTex(inner, mid, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, inner);
  rg.addColorStop(0.35, mid);
  rg.addColorStop(1, outer);
  g.fillStyle = rg;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function stoneTex() {
  const s = 512, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#3c3732';
  g.fillRect(0, 0, s, s);
  const img = g.getImageData(0, 0, s, s), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * 0.92));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.8));
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(10,8,8,0.55)';
  g.lineWidth = 3;
  for (let i = 0; i <= s; i += 64) {
    g.beginPath(); g.moveTo(0, i + (i % 128 ? 2 : 0)); g.lineTo(s, i); g.stroke();
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + (i % 128 ? -3 : 2), s); g.stroke();
  }
  g.strokeStyle = 'rgba(18,14,12,0.8)';
  g.lineWidth = 1.4;
  for (let k = 0; k < 22; k++) {
    let x = Math.random() * s, y = Math.random() * s;
    g.beginPath(); g.moveTo(x, y);
    for (let n = 0; n < 6; n++) { x += (Math.random() - 0.5) * 48; y += (Math.random() - 0.5) * 36; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function sigilTex() {
  const s = 256, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.translate(s / 2, s / 2);
  g.strokeStyle = 'rgba(150,255,220,0.9)';
  g.lineWidth = 3;
  g.beginPath(); g.arc(0, 0, 96, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(0, 0, 70, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    g.beginPath();
    g.moveTo(Math.cos(a) * 40, Math.sin(a) * 40);
    g.lineTo(Math.cos(a) * 100, Math.sin(a) * 100);
    g.stroke();
  }
  g.strokeStyle = 'rgba(80,20,40,0.95)';
  g.lineWidth = 4;
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + i / 6 * Math.PI * 2;
    const x = Math.cos(a) * 52, y = Math.sin(a) * 52;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath(); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeTextures() {
  return {
    stone: stoneTex(),
    soul: glowTex('rgba(230,255,245,1)', 'rgba(90,230,190,0.7)', 'rgba(40,140,120,0)'),
    spark: glowTex('rgba(255,250,240,1)', 'rgba(255,190,120,0.75)', 'rgba(255,80,20,0)'),
    beam: glowTex('rgba(210,255,245,1)', 'rgba(70,220,190,0.55)', 'rgba(20,80,70,0)'),
    wisp: glowTex('rgba(200,240,255,0.95)', 'rgba(120,180,255,0.35)', 'rgba(40,60,120,0)'),
    sigil: sigilTex(),
    fire: glowTex('rgba(255,236,180,1)', 'rgba(255,120,30,0.75)', 'rgba(180,30,0,0)'),
    shadow: glowTex('rgba(0,0,0,0.55)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0)'),
  };
}

function cloakMesh(mat) {
  const segX = 18, segY = 14;
  const pos = [], uv = [], idx = [];
  for (let y = 0; y <= segY; y++) {
    const v = y / segY;
    for (let x = 0; x <= segX; x++) {
      const u = x / segX;
      /* Open at the front (+Z is the body's forward before the slot turns
         Death around). The sheet wraps the back and both sides. */
      const ang = (u - 0.5) * Math.PI * 1.35 + Math.PI;
      const flare = 0.38 + v * v * 1.55;
      const px = Math.sin(ang) * flare;
      const pz = Math.cos(ang) * flare * 0.85;
      const py = 1.25 - v * 2.55;
      pos.push(px, py, pz);
      uv.push(u, v);
    }
  }
  for (let y = 0; y < segY; y++) {
    for (let x = 0; x < segX; x++) {
      const a = y * (segX + 1) + x;
      idx.push(a, a + 1, a + segX + 1, a + 1, a + segX + 2, a + segX + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const base = geo.attributes.position.array.slice();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.sway = (t, amp) => {
    const a = geo.attributes.position.array;
    const k = amp == null ? 1 : amp;
    for (let i = 0; i < a.length; i += 3) {
      const by = base[i + 1];
      const w = Math.max(0, (1.05 - by) / 2.4);
      a[i] = base[i] + Math.sin(t * 1.35 + by * 1.8 + base[i] * 2.2) * 0.055 * w * k;
      a[i + 2] = base[i + 2] + Math.cos(t * 1.05 + base[i] * 1.6) * 0.04 * w * k;
    }
    geo.attributes.position.needsUpdate = true;
  };
  mesh.frustumCulled = false;
  return mesh;
}

function scythe(metal, edge) {
  const g = new THREE.Group();
  const haft = cyl(metal, 0.035, 0.045, 2.15);
  haft.position.y = 0.7;
  const shape = new THREE.Shape();
  shape.moveTo(0.02, 0);
  shape.quadraticCurveTo(0.55, 0.35, 0.72, 1.05);
  shape.quadraticCurveTo(0.55, 1.25, 0.15, 1.32);
  shape.quadraticCurveTo(0.48, 1.05, 0.28, 0.45);
  shape.quadraticCurveTo(0.12, 0.2, 0.02, 0.02);
  const blade = new THREE.Mesh(new THREE.ShapeGeometry(shape), edge);
  blade.position.set(0.02, 1.55, 0);
  const bladeBack = blade.clone();
  bladeBack.material = metal;
  bladeBack.position.z = -0.012;
  g.add(haft, bladeBack, blade);
  return g;
}

export function buildDeath() {
  const bone = std(PAL.bone, { roughness: 0.55, metalness: 0.08 });
  const boneD = std(PAL.boneDark, { roughness: 0.7, metalness: 0.05 });
  const cloak = std(PAL.cloak, { roughness: 0.92, metalness: 0.02 });
  const metal = std(PAL.iron, { roughness: 0.38, metalness: 0.72 });
  const gold = std(PAL.gold, { roughness: 0.32, metalness: 0.8 });
  const edge = std(0x9fd6ff, { roughness: 0.22, metalness: 0.85, emissive: 0x2a6a62, emissiveIntensity: 0.4 });
  const eyeMat = std(PAL.soul, { emissive: PAL.soulE, emissiveIntensity: 2.4, roughness: 0.25, metalness: 0.1 });
  const mats = [bone, boneD, cloak, metal, gold, edge, eyeMat];

  const group = new THREE.Group();
  const hips = new THREE.Group();
  const torso = new THREE.Group();
  torso.position.y = 0.12;
  const chest = new THREE.Group();
  chest.position.y = 0.42;
  hips.add(torso);
  torso.add(chest);

  const pelvis = sph(boneD, 0.28, 0.16, 0.2);
  hips.add(pelvis);

  const spine = cyl(boneD, 0.07, 0.08, 0.55);
  spine.position.y = 0.22;
  torso.add(spine);

  for (let i = 0; i < 5; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.2 + i * 0.018, 0.02, 6, 16, Math.PI * 1.15), i % 2 ? bone : boneD);
    rib.rotation.x = Math.PI / 2;
    rib.rotation.z = Math.PI / 2;
    rib.position.set(0, 0.08 + i * 0.1, 0.02);
    chest.add(rib);
  }
  const sternum = box(bone, 0.08, 0.42, 0.06);
  sternum.position.set(0, 0.22, 0.16);
  chest.add(sternum);

  const neck = new THREE.Group();
  neck.position.y = 0.62;
  chest.add(neck);
  const neckBone = cyl(boneD, 0.06, 0.07, 0.16);
  neckBone.position.y = 0.06;
  neck.add(neckBone);

  const head = new THREE.Group();
  head.position.y = 0.2;
  neck.add(head);
  const cranium = sph(bone, 0.26, 0.3, 0.24);
  cranium.position.y = 0.08;
  head.add(cranium);
  const jaw = box(bone, 0.2, 0.08, 0.16);
  jaw.position.set(0, -0.12, 0.04);
  head.add(jaw);
  for (let i = 0; i < 6; i++) {
    const tooth = box(bone, 0.025, 0.045, 0.02);
    tooth.position.set(-0.07 + i * 0.028, -0.16, 0.1);
    head.add(tooth);
  }
  const socketMat = std(0x070605, { roughness: 1, metalness: 0 });
  mats.push(socketMat);
  const sockets = new THREE.Group();
  sockets.position.set(0, 0.04, 0.16);
  head.add(sockets);
  [-1, 1].forEach(s => {
    const sock = sph(socketMat, 0.07, 0.085, 0.05);
    sock.position.set(s * 0.09, 0, 0);
    const eye = sph(eyeMat, 0.035, 0.045, 0.03);
    eye.position.set(s * 0.09, 0, 0.02);
    sockets.add(sock, eye);
  });
  const nose = box(socketMat, 0.04, 0.08, 0.04);
  nose.position.set(0, -0.06, 0.18);
  head.add(nose);

  const hood = cloakMesh(cloak);
  hood.scale.set(0.72, 0.55, 0.72);
  hood.position.y = 0.15;
  head.add(hood);
  const hoodCowl = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 8, 18, Math.PI * 1.3), cloak);
  hoodCowl.rotation.x = Math.PI / 2.3;
  hoodCowl.position.set(0, 0.02, 0.12);
  head.add(hoodCowl);

  function arm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.34, 0.48, 0);
    const cap = sph(boneD, 0.1, 0.1, 0.1);
    shoulder.add(cap);
    const upper = new THREE.Group();
    upper.position.y = -0.08;
    shoulder.add(upper);
    const hum = cyl(bone, 0.045, 0.04, 0.48);
    hum.position.y = -0.24;
    upper.add(hum);
    const sleeve = cyl(cloak, 0.11, 0.13, 0.5);
    sleeve.position.y = -0.22;
    upper.add(sleeve);
    const fore = new THREE.Group();
    fore.position.y = -0.48;
    upper.add(fore);
    const rad = cyl(bone, 0.035, 0.03, 0.42);
    rad.position.y = -0.2;
    fore.add(rad);
    const cuff = cyl(cloak, 0.09, 0.1, 0.36);
    cuff.position.y = -0.16;
    fore.add(cuff);
    const hand = new THREE.Group();
    hand.position.y = -0.42;
    fore.add(hand);
    const palm = box(bone, 0.1, 0.05, 0.12);
    hand.add(palm);
    for (let i = 0; i < 4; i++) {
      const f = cyl(bone, 0.012, 0.01, 0.14);
      f.position.set(-0.03 + i * 0.022, -0.08, 0.03);
      f.rotation.x = 0.4;
      hand.add(f);
    }
    chest.add(shoulder);
    rest(shoulder); rest(upper); rest(fore); rest(hand);
    return { shoulder, upper, fore, hand };
  }

  const left = arm(1);
  const right = arm(-1);
  /* Seated, facing +Z. Negative X rotation swings a limb toward +Z, which
     is toward the hero after the group is yawed 180°. The left hand casts. */
  right.upper.rotation.x = -0.4;
  right.upper.rotation.z = 0.25;
  right.fore.rotation.x = -0.75;
  left.upper.rotation.x = -0.7;
  left.upper.rotation.z = 0.3;
  left.fore.rotation.x = -0.45;
  rest(right.upper); rest(right.fore); rest(left.upper); rest(left.fore);

  const weapon = scythe(metal, edge);
  weapon.rotation.z = 0.45;
  weapon.rotation.x = -0.35;
  weapon.position.set(-0.05, 0.05, 0.02);
  right.hand.add(weapon);

  function leg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.16, -0.05, 0.02);
    const thigh = cyl(bone, 0.07, 0.06, 0.62);
    thigh.position.set(0, -0.18, 0.22);
    thigh.rotation.x = -1.05;
    const shinP = new THREE.Group();
    shinP.position.set(0, -0.28, 0.42);
    const shin = cyl(bone, 0.05, 0.045, 0.7);
    shin.position.y = -0.34;
    shin.rotation.x = 0.95;
    const foot = box(boneD, 0.1, 0.06, 0.22);
    foot.position.set(0, -0.72, 0.06);
    shinP.add(shin, foot);
    const robe = cyl(cloak, 0.16, 0.14, 0.7);
    robe.position.set(0, -0.2, 0.22);
    robe.rotation.x = 0.7;
    hip.add(thigh, robe, shinP);
    hips.add(hip);
    return hip;
  }
  leg(-1); leg(1);

  const cloakBody = cloakMesh(cloak);
  cloakBody.position.y = 0.55;
  torso.add(cloakBody);

  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.04, 6, 20, Math.PI * 1.4), gold);
  hem.rotation.x = Math.PI / 2;
  hem.rotation.z = Math.PI / 2;
  hem.position.set(0, -1.15, -0.15);
  hips.add(hem);

  group.add(hips);
  rest(hips); rest(torso); rest(chest); rest(neck); rest(head);

  return {
    group,
    mats,
    procedural: true,
    sway: [cloakBody, hood],
    bones: { hips, torso, chest, neck, head, armL: left.upper, foreL: left.fore, armR: right.upper, foreR: right.fore, weapon },
    anchors: { cast: left.hand, eyes: sockets, chest, scythe: weapon },
    applyRest,
  };
}

const HERO_LOOK = {
  knight: { body: 0x8e9aab, trim: 0xc4a25a, cloth: 0x2a2428, metal: 0.72, bulk: 1.08, helm: 1 },
  ranger: { body: 0x3d6a48, trim: 0x6a4228, cloth: 0x1c2418, metal: 0.25, bulk: 0.92, hood: 1, bow: 1 },
  gambler: { body: 0x2a2030, trim: 0xc4a25a, cloth: 0x3a1848, metal: 0.2, bulk: 0.9, coat: 1, hat: 1 },
  brute: { body: 0x6a3030, trim: 0x4a3028, cloth: 0x241816, metal: 0.35, bulk: 1.38, bare: 1 },
  duelist: { body: 0xb7b0c4, trim: 0x8a1a2a, cloth: 0x241418, metal: 0.55, bulk: 0.86, rapier: 1, feather: 1 },
  hexpriest: { body: 0x3a3050, trim: 0xb07cf0, cloth: 0x1a1020, metal: 0.15, bulk: 0.98, robe: 1, staff: 1 },
};

export function buildHero(id) {
  const look = HERO_LOOK[id] || HERO_LOOK.knight;
  const b = look.bulk;
  const plate = std(look.body, { roughness: 0.45, metalness: look.metal });
  const trim = std(look.trim, { roughness: 0.35, metalness: 0.65 });
  const cloth = std(look.cloth, { roughness: 0.9, metalness: 0.04 });
  const skin = std(0xc4b29a, { roughness: 0.7, metalness: 0.02 });
  const mats = [plate, trim, cloth, skin];
  const group = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  const torso = new THREE.Group();
  hips.add(torso);

  const chest = box(plate, 0.46 * b, 0.5, 0.26 * Math.min(b, 1.15));
  chest.position.y = 0.28;
  torso.add(chest);
  const pauldronL = sph(trim, 0.13 * b, 0.1, 0.12);
  pauldronL.position.set(-0.26 * b, 0.48, 0);
  const pauldronR = pauldronL.clone();
  pauldronR.position.x *= -1;
  torso.add(pauldronL, pauldronR);

  const head = new THREE.Group();
  head.position.y = 0.68;
  torso.add(head);
  if (look.hood || look.robe) {
    const hood = sph(cloth, 0.18, 0.22, 0.18);
    hood.position.y = 0.02;
    head.add(hood);
    const cowl = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 6, 12), cloth);
    cowl.rotation.x = Math.PI / 2.4;
    cowl.position.set(0, -0.02, 0.06);
    head.add(cowl);
  } else if (look.helm) {
    const helm = sph(plate, 0.16, 0.18, 0.17);
    helm.position.y = 0.02;
    head.add(helm);
    const crest = box(trim, 0.04, 0.16, 0.22);
    crest.position.set(0, 0.1, -0.02);
    head.add(crest);
  } else if (look.hat) {
    const skull = sph(skin, 0.13, 0.15, 0.14);
    head.add(skull);
    const brim = cyl(cloth, 0.22, 0.22, 0.03);
    brim.position.y = 0.08;
    const crown = cyl(cloth, 0.12, 0.13, 0.16);
    crown.position.y = 0.16;
    head.add(brim, crown);
  } else {
    const skull = sph(look.bare ? skin : plate, 0.15 * (look.bare ? 1.15 : 1), 0.17, 0.15);
    head.add(skull);
  }

  function limb(side) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.3 * b, 0.42, 0);
    const upper = cyl(look.bare ? skin : plate, 0.07 * b, 0.06 * b, 0.34);
    upper.position.y = -0.18;
    arm.add(upper);
    const fore = new THREE.Group();
    fore.position.y = -0.36;
    const fa = cyl(look.bare ? skin : cloth, 0.055 * b, 0.05, 0.3);
    fa.position.y = -0.14;
    fore.add(fa);
    arm.add(fore);
    torso.add(arm);
    rest(arm); rest(fore);
    arm.rotation.x = 0.18;
    rest(arm);
    return { arm, fore };
  }
  const armL = limb(-1);
  const armR = limb(1);

  if (look.bow) {
    const bow = new THREE.Group();
    const stave = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.018, 5, 18, Math.PI * 1.15), trim);
    stave.rotation.y = Math.PI / 2;
    bow.add(stave);
    bow.position.set(0.05, 0.15, -0.2);
    torso.add(bow);
  }
  let weapon = null;
  if (look.staff) {
    weapon = new THREE.Group();
    const haft = cyl(std(PAL.wood, { roughness: 0.8 }), 0.025, 0.03, 1.7);
    haft.position.y = 0.3;
    const gem = sph(std(look.trim, { emissive: look.trim, emissiveIntensity: 0.8, roughness: 0.3 }), 0.07);
    gem.position.y = 1.15;
    weapon.add(haft, gem);
    weapon.position.set(-0.28, -0.15, 0.08);
    armL.fore.add(weapon);
  } else if (look.rapier || id === 'knight' || id === 'duelist') {
    weapon = new THREE.Group();
    const blade = box(trim, 0.03, 0.72, 0.012);
    blade.position.y = 0.3;
    const guard = box(trim, 0.16, 0.025, 0.04);
    weapon.add(blade, guard);
    weapon.rotation.x = 0.4;
    weapon.position.set(0, -0.2, 0.04);
    armR.fore.add(weapon);
  }
  if (!look.staff && !look.bow) {
    const shield = box(plate, 0.34, 0.48, 0.05);
    const boss = sph(trim, 0.07, 0.07, 0.05);
    boss.position.z = 0.04;
    shield.add(boss);
    shield.position.set(0.02, -0.05, 0.08);
    armL.fore.add(shield);
  }
  if (look.coat || look.robe) {
    const tail = cloakMesh(cloth);
    tail.scale.set(0.42, 0.38, 0.4);
    tail.position.y = 0.15;
    torso.add(tail);
    group.userData.tail = tail;
  }
  if (id === 'brute') {
    const bomb = sph(std(0x2a2420, { roughness: 0.5, metalness: 0.4 }), 0.12);
    bomb.position.set(0.22, -0.15, 0.12);
    const fuse = cyl(trim, 0.012, 0.012, 0.1);
    fuse.position.y = 0.12;
    bomb.add(fuse);
    hips.add(bomb);
  }
  if (look.feather) {
    const feather = box(trim, 0.03, 0.22, 0.01);
    feather.position.set(0.08, 0.22, -0.04);
    feather.rotation.z = -0.4;
    head.add(feather);
  }

  [-1, 1].forEach(side => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.12 * b, -0.02, 0);
    const thigh = cyl(id === 'hexpriest' || id === 'gambler' ? cloth : plate, 0.09 * Math.min(b, 1.2), 0.08, 0.42);
    thigh.position.y = -0.22;
    const shin = cyl(id === 'ranger' ? cloth : plate, 0.07, 0.06, 0.4);
    shin.position.y = -0.62;
    const boot = box(std(0x1a1412, { roughness: 0.7, metalness: 0.2 }), 0.1, 0.08, 0.2);
    boot.position.set(0, -0.86, 0.03);
    mats.push(boot.material);
    leg.add(thigh, shin, boot);
    hips.add(leg);
  });

  group.add(hips);
  rest(hips); rest(torso); rest(head);
  return {
    group, mats, procedural: true,
    sway: group.userData.tail ? [group.userData.tail] : [],
    bones: { hips, torso, head, armL: armL.arm, foreL: armL.fore, armR: armR.arm, foreR: armR.fore, weapon },
    anchors: { chest: torso, cast: armR.fore },
    applyRest,
  };
}

export function buildHeroes() {
  const out = {};
  for (const id of HERO_IDS) out[id] = buildHero(id);
  return out;
}

export function buildThrone() {
  const stone = std(PAL.stone, { roughness: 0.88, metalness: 0.06 });
  const stoneD = std(PAL.stoneDark, { roughness: 0.9, metalness: 0.05 });
  const gold = std(PAL.gold, { roughness: 0.34, metalness: 0.75 });
  const cloth = std(PAL.cushion, { roughness: 0.8, metalness: 0.02 });
  const crackMat = std(0x063028, { emissive: 0x39ffb0, emissiveIntensity: 0.2, roughness: 0.4 });
  const mats = [stone, stoneD, gold, cloth, crackMat];
  const group = new THREE.Group();

  const dais = box(stoneD, 3.4, 0.45, 2.4);
  dais.position.y = 0.22;
  group.add(dais);
  /* Steps climb away from the hero (negative Z is toward the camera). */
  for (let i = 0; i < 5; i++) {
    const step = box(i % 2 ? stone : stoneD, 3.5 - i * 0.22, 0.22, 0.48);
    step.position.set(0, 0.11 + i * 0.26, -1.72 + i * 0.32);
    group.add(step);
  }
  const seat = box(stone, 1.5, 0.28, 1.15);
  seat.position.set(0, 1.55, 0.05);
  const cushion = box(cloth, 1.15, 0.12, 0.8);
  cushion.position.set(0, 1.74, 0.08);
  group.add(seat, cushion);

  /* Backrest on the far side of the seat, so Death sits in front of it. */
  const back = box(stoneD, 1.7, 3.6, 0.28);
  back.position.set(0, 3.45, 0.78);
  group.add(back);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.15, 4), stone);
  cap.position.set(0, 5.55, 0.78);
  cap.rotation.y = Math.PI / 4;
  group.add(cap);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.08, 8, 20, Math.PI), gold);
  arch.position.set(0, 4.55, 0.52);
  group.add(arch);

  [-1, 1].forEach(s => {
    const post = cyl(stone, 0.16, 0.2, 3.3);
    post.position.set(s * 0.95, 3.15, 0.42);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 12), gold);
    band.rotation.x = Math.PI / 2;
    band.position.set(s * 0.95, 4.4, 0.42);
    const finial = sph(gold, 0.14, 0.18, 0.14);
    finial.position.set(s * 1.05, 1.95, -0.35);
    const arm = box(stone, 0.16, 0.16, 1.15);
    arm.position.set(s * 0.85, 1.85, 0.05);
    const skull = sph(std(PAL.bone, { roughness: 0.6 }), 0.12, 0.14, 0.11);
    skull.position.set(s * 0.55, 5.15, 0.52);
    group.add(post, band, finial, arm, skull);
  });
  const crest = sph(std(PAL.bone, { roughness: 0.55 }), 0.22, 0.26, 0.2);
  crest.position.set(0, 5.35, 0.5);
  group.add(crest);

  const cracks = [];
  const crackSpecs = [[0.1, 2.2, 0.62, 0.9, 2], [-0.35, 3.1, 0.62, 1.3, 3], [0.4, 3.6, 0.62, 1.6, 3], [0, 1.2, -0.55, 1.1, 2]];
  for (const [x, y, z, h, ph] of crackSpecs) {
    const m = box(crackMat, 0.035, h, 0.02);
    m.position.set(x, y, z);
    m.rotation.z = (x < 0 ? -0.3 : 0.25);
    m.scale.y = 0.001;
    m.userData.phase = ph;
    m.userData.full = h;
    cracks.push(m);
    group.add(m);
  }

  const fires = [];
  [[-0.7, 0.5, -0.85], [0.7, 0.5, -0.85], [0, 0.42, -1.15]].forEach(([x, y, z], i) => {
    const a = new THREE.Group();
    a.position.set(x, y, z);
    a.userData.phase = i === 2 ? 3 : 2;
    fires.push(a);
    group.add(a);
  });

  return { group, mats, cracks, fires, crackMat, procedural: true };
}

export function buildRoom(textures) {
  const stoneMap = textures.stone;
  stoneMap.repeat.set(7, 9);
  const floorMat = std(0x6a635c, { map: stoneMap, roughness: 0.94, metalness: 0.04 });
  const wallMat = std(0x2c292c, { roughness: 0.92, metalness: 0.05 });
  const pillarMat = std(0x3e3a3c, { roughness: 0.86, metalness: 0.08 });
  const gold = std(PAL.gold, { roughness: 0.35, metalness: 0.7 });
  const iron = std(PAL.ironDark, { roughness: 0.4, metalness: 0.65 });
  const mats = [floorMat, wallMat, pillarMat, gold, iron];
  const group = new THREE.Group();

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 26), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 6);
  group.add(floor);

  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 10), std(0x2a1014, { roughness: 0.9 }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, 0.012, 4.2);
  mats.push(carpet.material);
  group.add(carpet);

  const back = box(wallMat, 16, 9, 0.4);
  back.position.set(0, 4.5, 13.2);
  const left = box(wallMat, 0.4, 8, 18);
  left.position.set(-7.2, 4, 5);
  const right = left.clone();
  right.position.x = 7.2;
  group.add(back, left, right);

  const pillars = [];
  const spots = [[-3.1, 2.2], [3.1, 2.2], [-3.4, 6.4], [3.4, 6.4], [-3.2, 10.2], [3.2, 10.2]];
  for (const [x, z] of spots) {
    const p = new THREE.Group();
    const shaft = cyl(pillarMat, 0.38, 0.46, 6.2);
    shaft.position.y = 3.1;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 14), gold);
    band.rotation.x = Math.PI / 2;
    band.position.y = 4.6;
    const cap = box(pillarMat, 0.95, 0.28, 0.95);
    cap.position.y = 6.25;
    p.add(shaft, band, cap);
    p.position.set(x, 0, z);
    pillars.push(p);
    group.add(p);
  }

  const braziers = [];
  [[-2.35, 1.15], [2.35, 1.15]].forEach(([x, z]) => {
    const b = new THREE.Group();
    const pole = cyl(iron, 0.07, 0.09, 1.25);
    pole.position.y = 0.62;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.18, 0.24, 10), iron);
    bowl.position.y = 1.32;
    const coal = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), std(0xff5a18, { emissive: 0xff4a10, emissiveIntensity: 1.6, roughness: 1 }));
    coal.scale.y = 0.45;
    coal.position.y = 1.4;
    mats.push(coal.material);
    b.add(pole, bowl, coal);
    b.position.set(x, 0, z);
    b.userData.flameY = 1.55;
    braziers.push(b);
    group.add(b);
  });

  const candles = [];
  const candleMat = std(0xd9cbb0, { roughness: 0.6, emissive: 0x3a2a18, emissiveIntensity: 0.15 });
  mats.push(candleMat);
  const candleSpots = [[-1.3, 0.9, 3.4], [1.3, 0.9, 3.4], [-1.6, 1.35, 5.2], [1.6, 1.35, 5.2], [-0.9, 1.7, 6.5], [0.9, 1.7, 6.5], [-4.6, 0.85, 2.6], [4.6, 0.85, 2.6]];
  for (const [x, y, z] of candleSpots) {
    const c = new THREE.Group();
    const stick = cyl(candleMat, 0.035, 0.04, 0.28);
    stick.position.y = 0.14;
    c.add(stick);
    c.position.set(x, y, z);
    c.userData.flameY = 0.32;
    candles.push(c);
    group.add(c);
  }

  /* A few carved dice, the room's only hint of the machine downstairs. */
  const dieMat = std(0x1a1614, { roughness: 0.45, metalness: 0.15 });
  const pip = std(0xd9cbb0, { roughness: 0.5 });
  mats.push(dieMat, pip);
  const dice = [];
  [[-1.8, 2.4, 4.2, 0.22], [2.1, 3.1, 5.5, 0.16], [0.8, 1.6, 2.4, 0.12]].forEach(([x, y, z, s], i) => {
    const d = box(dieMat, s, s, s);
    const p = sph(pip, s * 0.12);
    p.position.z = s * 0.52;
    d.add(p);
    d.position.set(x, y, z);
    d.userData.spin = 0.15 + i * 0.07;
    dice.push(d);
    group.add(d);
  });

  return { group, mats, braziers, candles, dice, pillars, procedural: true };
}

export { applyRest, HERO_IDS };
