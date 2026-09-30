// Weapon-seat measurement for Dead Man's Pull heroes (see tools/README.md). Loaded into the game page by seatopt_run.py.
// Runs in the page. Measures weapon/body collisions for the loaded hero across the clips it
// plays, and searches the weapon's orientation in hand space for the fewest collisions.
window.seatOpt = function (opts) {
  const S = Slayer.stage, h = S.hero;
  const THREE_V = h.holder.position.constructor, THREE_Q = h.holder.quaternion.constructor;
  let skin = null, w = null;
  h.root.traverse(o => { if (o.isSkinnedMesh && !skin) skin = o; if (o.isMesh && !o.isSkinnedMesh && o.parent && o.parent.isBone && /Sword|Dagger|Cleaver|Rapier|Staff|Bow/.test(o.name)) w = o; });
  const hand = w.parent, bi = skin.skeleton.bones.indexOf(hand);
  // weapon samples in weapon-local space, with their position along the length axis
  const g = w.geometry; g.computeBoundingBox();
  const bb = g.boundingBox, ext = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z], ax = ext.indexOf(Math.max(...ext));
  const P = g.attributes.position, samp = [], v = new THREE_V();
  const step = Math.max(1, Math.floor(P.count / (opts.wpts || 160)));
  for (let i = 0; i < P.count; i += step) samp.push(new THREE_V().fromBufferAttribute(P, i));
  const cfg = opts.cfg, lo = bb.min.getComponent(ax), len = ext[ax];
  const handleL = new THREE_V(); let m = 0;
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); if (Math.abs((v.getComponent(ax) - lo) / len - cfg.at) < 0.03) { handleL.add(v); m++; } }
  handleL.divideScalar(m);
  const sc = w.scale.x;
  const local = samp.map(p => p.clone().sub(handleL).multiplyScalar(sc));        // relative to the handle, in hand units
  const along = samp.map(p => (p.getComponent(ax) - handleL.getComponent(ax)) * sc);
  const lenH = len * sc;
  // hand: the fist centre (bind), hand length
  const fist = new THREE_V(); let n = 0, handLen = 0;
  const pos = skin.geometry.attributes.position, si = skin.geometry.attributes.skinIndex, sw = skin.geometry.attributes.skinWeight;
  const dom = new Int16Array(pos.count);
  for (let i = 0; i < pos.count; i++) { let best = -1, bw = 0; for (let k = 0; k < 4; k++) { const wt = sw.getComponent(i, k); if (wt > bw) { bw = wt; best = si.getComponent(i, k); } } dom[i] = bw >= 0.5 ? best : -1; }
  const inv = skin.skeleton.boneInverses[bi];
  for (let i = 0; i < pos.count; i++) if (dom[i] === bi) { v.fromBufferAttribute(pos, i).applyMatrix4(skin.bindMatrix).applyMatrix4(inv); fist.add(v); n++; handLen = Math.max(handLen, v.y); }
  fist.divideScalar(n);
  const gripHalf = cfg.grip ? cfg.grip * lenH : (opts.gripHalf || handLen * 0.45);   // cfg.grip: the handle's half-length as a fraction of the weapon
  // poses: the clips this hero plays, at a few times each
  const poses = [];
  for (const name of opts.clips) {
    const act = S._clip(h, name); if (!act) continue;
    for (const f of opts.times) {
      h.mixer.stopAllAction(); act.reset().play(); act.time = act.getClip().duration * f; h.mixer.update(0);
      h.holder.updateMatrixWorld(true);
      const toHand = hand.matrixWorld.clone().invert();
      const body = [], hnd = [];
      for (let i = 0; i < pos.count; i++) {
        const isHand = dom[i] === bi;
        if (!isHand && i % (opts.bstep || 4)) continue;
        skin.getVertexPosition(i, v); v.applyMatrix4(skin.matrixWorld).applyMatrix4(toHand);
        if (isHand) hnd.push(v.x, v.y, v.z); else body.push(v.x, v.y, v.z);
      }
      poses.push({ name, f, body: grid(body, 3), hand: grid(hnd, 2) });
    }
  }
  h.mixer.stopAllAction();
  function grid(arr, cell) {
    const map = new Map();
    for (let i = 0; i < arr.length; i += 3) {
      const k = Math.floor(arr[i] / cell) + ',' + Math.floor(arr[i + 1] / cell) + ',' + Math.floor(arr[i + 2] / cell);
      let b = map.get(k); if (!b) map.set(k, b = []); b.push(arr[i], arr[i + 1], arr[i + 2]);
    }
    return { map, cell };
  }
  function near(G, x, y, z, r) {
    const c = G.cell, cx = Math.floor(x / c), cy = Math.floor(y / c), cz = Math.floor(z / c), r2 = r * r, k = Math.ceil(r / c);
    for (let a = -k; a <= k; a++) for (let b = -k; b <= k; b++) for (let d = -k; d <= k; d++) {
      const L = G.map.get((cx + a) + ',' + (cy + b) + ',' + (cz + d)); if (!L) continue;
      for (let i = 0; i < L.length; i += 3) { const dx = L[i] - x, dy = L[i + 1] - y, dz = L[i + 2] - z; if (dx * dx + dy * dy + dz * dz < r2) return true; }
    }
    return false;
  }
  const rBody = opts.rBody || 2.5, rHand = opts.rHand || 1.2;
  const tmp = new THREE_V();
  function score(q, detail) {
    let body = 0, back = 0, grip = 0, total = 0;
    const per = {};
    for (const ps of poses) {
      let pb = 0;
      for (let i = 0; i < local.length; i++) {
        tmp.copy(local[i]).applyQuaternion(q).add(fist);
        const inGrip = Math.abs(along[i]) < gripHalf;
        if (!inGrip && near(ps.hand, tmp.x, tmp.y, tmp.z, rHand)) back++;
        if (!inGrip && near(ps.body, tmp.x, tmp.y, tmp.z, rBody)) { body++; pb++; }
        total++;
      }
      if (detail) per[ps.name + '@' + ps.f] = pb;
    }
    return { cost: body + 3 * back, body, back, total, per };
  }
  if (opts.probe) {
    const q = w.quaternion.clone(), buckets = {};
    for (const ps of poses) for (let i = 0; i < local.length; i++) {
      tmp.copy(local[i]).applyQuaternion(q).add(fist);
      if (near(ps.hand, tmp.x, tmp.y, tmp.z, opts.probe)) { const k = Math.round(along[i] / 2) * 2; buckets[k] = (buckets[k] || 0) + 1; }
    }
    return { lenH, gripHalf, buckets, poses: poses.length, handleAt: cfg.at };
  }
  // the palm: its thin axis (normal) from the hand slice, and the knuckle line across it
  const hpts = [];
  for (let k = 0; k < pos.count; k++) if (dom[k] === bi) hpts.push(new THREE_V().fromBufferAttribute(pos, k).applyMatrix4(skin.bindMatrix).applyMatrix4(inv));
  let thin = null;
  for (let a = 0; a < 180; a += 3) {
    const d = new THREE_V(Math.cos(a * Math.PI / 180), 0, Math.sin(a * Math.PI / 180)); let mn = 1e9, mx = -1e9;
    for (const p of hpts) if (p.y > 0.25 * handLen && p.y < 0.55 * handLen) { const t = p.dot(d); mn = Math.min(mn, t); mx = Math.max(mx, t); }
    if (!thin || mx - mn < thin.w) thin = { d, w: mx - mn };
  }
  // the thin axis comes out with an arbitrary sign; the Meshy rigs agree on the hand bone's
  // axes, and the palm faces +(0.85, 0, 0.52) there (checked on the Gambler's and Duelist's hands)
  const nrm = thin.d; if (nrm.dot(new THREE_V(0.85, 0, 0.52)) < 0) nrm.negate();
  const Y = new THREE_V(0, 1, 0), K = new THREE_V().crossVectors(Y, nrm).normalize();
  const tipSign = cfg.at < 0.5 ? 1 : -1;                       // local +axis points at the business end?
  const axL = new THREE_V().setComponent(ax, 1);
  const handGrid = poses.map(ps => ps.hand);
  // handle penetration: handle points closer than rPen to the hand surface, summed over poses
  const rPen = opts.rPen || 0.8;
  function handlePen(q, off) {
    let pen = 0;
    for (const ps of poses) for (let i = 0; i < local.length; i++) {
      if (Math.abs(along[i]) >= gripHalf) continue;
      tmp.copy(local[i]).applyQuaternion(q).add(fist).add(off);
      if (near(ps.hand, tmp.x, tmp.y, tmp.z, rPen)) pen++;
    }
    return pen;
  }
  function score2(q, off, detail) {
    let body = 0, back = 0; const per = {};
    for (const ps of poses) {
      let pb = 0;
      for (let i = 0; i < local.length; i++) {
        if (Math.abs(along[i]) < gripHalf) continue;
        tmp.copy(local[i]).applyQuaternion(q).add(fist).add(off);
        if (near(ps.hand, tmp.x, tmp.y, tmp.z, rHand)) back++;
        if (near(ps.body, tmp.x, tmp.y, tmp.z, rBody)) { body++; pb++; }
      }
      if (detail) per[ps.name + '@' + ps.f] = pb;
    }
    return { body, back, per };
  }
  const zero = new THREE_V();
  const base = Object.assign(score2(w.quaternion, zero, true), { pen: handlePen(w.quaternion, zero) });
  const curTip = axL.clone().multiplyScalar(tipSign).applyQuaternion(w.quaternion);
  // score orientations with the handle already on the palm face (half the hand's thickness out)
  const palm0 = nrm.clone().multiplyScalar(thin.w / 2);
  let best = null;
  const tilts = opts.tilts || [-15, 0, 15, 30, 45], outs = [-15, 0, 15], rolls = opts.rolls || 12;
  for (const sgn of [1, -1]) for (const tdeg of tilts) for (const odeg of outs) {
    const t = tdeg * Math.PI / 180, o = odeg * Math.PI / 180;
    // the direction the business end points: along the knuckle line, tilted toward the fingers and out of the palm
    const tip = K.clone().multiplyScalar(sgn * Math.cos(t) * Math.cos(o)).addScaledVector(Y, Math.sin(t)).addScaledVector(nrm, Math.sin(o) * Math.cos(t)).normalize();
    const q0 = new THREE_Q().setFromUnitVectors(axL.clone().multiplyScalar(tipSign), tip);
    for (let r = 0; r < rolls; r++) {
      const q = new THREE_Q().setFromAxisAngle(tip, r * 2 * Math.PI / rolls).multiply(q0);
      const s = score2(q, palm0, false);
      const keep = (opts.keep || 20) * (1 - tip.dot(curTip));          // prefer the look already approved, all else equal
      const cost = s.body + 3 * s.back + keep;
      if (!best || cost < best.cost) best = { cost, q, tip, s };
    }
  }
  // slide the handle across the palm's thickness and along the fingers: it must not pierce
  // the hand (pen) and should touch it (contact: handle points within rTouch of the skin)
  const rTouch = opts.rTouch || 2.2;
  function handleFit(q, off) {
    let pen = 0, touch = 0;
    for (const ps of poses) for (let i = 0; i < local.length; i++) {
      if (Math.abs(along[i]) >= gripHalf) continue;
      tmp.copy(local[i]).applyQuaternion(q).add(fist).add(off);
      if (near(ps.hand, tmp.x, tmp.y, tmp.z, rPen)) pen++;
      else if (near(ps.hand, tmp.x, tmp.y, tmp.z, rTouch)) touch++;
    }
    return { pen, touch };
  }
  let bestOff = zero.clone(), bestFit = handleFit(best.q, zero), bestC = Infinity;
  for (let a = 0; a <= 6; a += 0.5) for (let b2 = -3; b2 <= 3; b2 += 1) {           // palm side only
    const off = nrm.clone().multiplyScalar(a).addScaledVector(Y, b2);
    const f = handleFit(best.q, off);
    const c = 10 * f.pen - f.touch + 0.1 * (Math.abs(a) + Math.abs(b2));
    if (c < bestC) { bestC = c; bestOff = off; bestFit = f; }
  }
  const bestPen = bestFit.pen, bestTouch = bestFit.touch;
  const finS = score2(best.q, bestOff, true);
  return { lenH: +lenH.toFixed(1), handLen: +handLen.toFixed(1), weapon: w.name, hand: hand.name, gripHalf: +gripHalf.toFixed(2), poses: poses.length, pts: local.length,
    palmNormal: nrm.toArray().map(x => +x.toFixed(3)), knuckle: K.toArray().map(x => +x.toFixed(3)),
    before: { body: base.body, back: base.back, pen: base.pen, per: base.per }, after: { body: finS.body, back: finS.back, pen: bestPen, touch: bestTouch, per: finS.per },
    q: best.q.toArray().map(x => +x.toFixed(4)), off: bestOff.toArray().map(x => +x.toFixed(2)), tipBefore: curTip.toArray().map(x => +x.toFixed(3)), tipAfter: best.tip.toArray().map(x => +x.toFixed(3)) };
};
