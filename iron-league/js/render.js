/* Iron League — arena canvas. Camera follows the squads through a wide pit.
   Pixel FX strips play additive; procedural strokes remain underneath and
   stand in fully when a sheet has not loaded. */
(function (root) {
  const IL = root.IL = root.IL || {};
  const SCALE = 4;
  /* One knob for every screen shake. Hits add 3.2 (1.5 if blocked, cap 7)
     and cast blasts add 4 (cap 8) in game.js. 1 is that original kick.
     0.1 is a small nudge, not a shake. */
  const SHAKE_SCALE = 0.1;

  function fitArena(canvas) {
    const parent = canvas.parentElement || canvas;
    const cssW = Math.max(280, parent.clientWidth || 960);
    const narrow = cssW < 760;
    const boxH = parent.clientHeight || 0;
    let cssH;
    if (narrow && boxH >= 200) {
      cssH = boxH;
    } else {
      const maxH = Math.max(260, Math.round((root.innerHeight || 800) * (narrow ? 0.72 : 0.7)));
      cssH = Math.round(cssW / (narrow ? 0.85 : 1.52));
      if (cssH > maxH) cssH = maxH;
      if (cssH < 240) cssH = 240;
    }
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    return { cssW: cssW, cssH: cssH, dpr: dpr };
  }

  function updateCam(match, fx, view) {
    const W = IL.WORLD;
    if (!fx.cam) {
      fx.cam = {
        x: W.w / 2,
        y: (W.top + W.bottom) / 2,
        viewW: view.cssW < 760 ? 680 : 1280
      };
    }
    const cam = fx.cam;
    const units = [];
    for (let i = 0; i < match.units.length; i++) if (match.units[i].hp > 0) units.push(match.units[i]);
    const focus = units.length ? units : match.units;
    let sx = 0;
    let sy = 0;
    let minX = 1e9;
    let maxX = -1e9;
    let minY = 1e9;
    let maxY = -1e9;
    for (let i = 0; i < focus.length; i++) {
      const u = focus[i];
      sx += u.x;
      sy += u.y;
      if (u.x < minX) minX = u.x;
      if (u.x > maxX) maxX = u.x;
      if (u.y < minY) minY = u.y;
      if (u.y > maxY) maxY = u.y;
    }
    for (let i = 0; i < match.units.length; i++) {
      const c = match.units[i].cast;
      if (!c) continue;
      if (c.x - c.r < minX) minX = c.x - c.r;
      if (c.x + c.r > maxX) maxX = c.x + c.r;
      if (c.y - c.r * 0.4 < minY) minY = c.y - c.r * 0.4;
      if (c.y + c.r * 0.4 > maxY) maxY = c.y + c.r * 0.4;
    }
    const cx = sx / focus.length;
    const cy = sy / focus.length;
    const aspect = view.cssW / Math.max(1, view.cssH);
    const narrow = view.cssW < 760;
    const spanW = (maxX - minX) + (narrow ? 200 : 380);
    const spanH = (maxY - minY) + (narrow ? 140 : 280);
    let want = Math.max(spanW, spanH * aspect);
    const minW = narrow ? 560 : 1180;
    const maxW = narrow ? 860 : W.w;
    want = Math.max(minW, Math.min(maxW, want));
    cam.x += (cx - cam.x) * 0.08;
    cam.y += (cy - cam.y) * 0.08;
    cam.viewW += (want - cam.viewW) * 0.05;
    const viewH = cam.viewW / aspect;
    const halfW = cam.viewW / 2;
    const halfH = viewH / 2;
    if (cam.viewW >= W.w - 2) cam.x = W.w / 2;
    else cam.x = Math.max(halfW, Math.min(W.w - halfW, cam.x));
    if (viewH >= W.h - 2) cam.y = W.h / 2;
    else cam.y = Math.max(halfH, Math.min(W.h - halfH, cam.y));
    cam.viewH = viewH;
    return cam;
  }

  function brazier(ctx, x, y, t) {
    const flick = 0.82 + 0.18 * Math.sin(t * 8 + x * 0.01);
    const glow = ctx.createRadialGradient(x, y, 4, x, y, 90);
    glow.addColorStop(0, "rgba(255,150,60," + (0.42 * flick) + ")");
    glow.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a2018";
    ctx.fillRect(x - 11, y, 22, 32);
    ctx.fillStyle = "#e07a32";
    ctx.beginPath();
    ctx.moveTo(x - 14, y + 4);
    ctx.lineTo(x, y - 18 * flick);
    ctx.lineTo(x + 14, y + 4);
    ctx.fill();
    ctx.fillStyle = "#f2c14a";
    ctx.beginPath();
    ctx.arc(x, y - 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPit(ctx, fx) {
    const W = IL.WORLD;
    const t = fx.t || 0;
    const cx = (W.left + W.right) / 2;
    const cy = (W.top + W.bottom) / 2;
    const parallaxX = ((fx.cam ? fx.cam.x : cx) - W.w / 2) * 0.06;
    const parallaxY = ((fx.cam ? fx.cam.y : cy) - W.h / 2) * 0.06;

    ctx.fillStyle = "#100e0c";
    ctx.fillRect(-80, -80, W.w + 160, W.h + 160);

    const sky = ctx.createLinearGradient(0, 0, 0, cy);
    sky.addColorStop(0, "#1c1814");
    sky.addColorStop(1, "#2a2118");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W.w, cy + 40);

    ctx.fillStyle = "#241812";
    ctx.beginPath();
    ctx.ellipse(cx - parallaxX, cy - parallaxY, (W.right - W.left) * 0.78, (W.bottom - W.top) * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#3a2a22";
    ctx.beginPath();
    ctx.ellipse(cx, cy, (W.right - W.left) * 0.62, (W.bottom - W.top) * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4e382c";
    ctx.beginPath();
    ctx.ellipse(cx, cy - 8, (W.right - W.left) * 0.48, (W.bottom - W.top) * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,220,180,0.09)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy - 6, 90 + i * 70, 32 + i * 26, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([8, 12]);
    ctx.strokeStyle = "rgba(232, 196, 150, 0.2)";
    ctx.beginPath();
    ctx.moveTo(cx, cy - 220);
    ctx.lineTo(cx, cy + 240);
    ctx.stroke();
    ctx.setLineDash([]);

    brazier(ctx, W.left + 36, W.top + 24, t);
    brazier(ctx, W.right - 36, W.top + 24, t + 1.2);
    brazier(ctx, W.left + 70, W.bottom - 16, t + 0.4);
    brazier(ctx, W.right - 70, W.bottom - 16, t + 1.7);
    brazier(ctx, cx - 460, cy - 20, t + 0.8);
    brazier(ctx, cx + 460, cy - 20, t + 2.1);
  }

  function teamColor(team, hot) {
    if (hot) return team === 0 ? "rgba(255, 176, 96," : "rgba(176, 206, 255,";
    return team === 0 ? "rgba(226, 140, 72," : "rgba(150, 176, 214,";
  }

  function drawUnderlay(ctx, s) {
    const p = s.life > 0 ? Math.max(0, 1 - s.t / s.life) : 1;
    const sprite = IL.fx && IL.fx.has(s.kind);
    const a = (sprite ? 0.38 : 0.9) * p;
    if (a <= 0.02) return;
    ctx.save();
    ctx.translate(s.x, s.y);
    if (s.facing < 0) ctx.scale(-1, 1);
    if (s.kind === "slash") {
      ctx.strokeStyle = teamColor(s.team, true) + a + ")";
      ctx.lineWidth = sprite ? 3 : 5;
      ctx.beginPath();
      ctx.arc(10, -4, s.size * 0.28, -1.05, 0.95);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,236,210," + (a * 0.8) + ")";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(10, -4, s.size * 0.2, -0.7, 0.7);
      ctx.stroke();
    } else if (s.kind === "boom" || s.kind === "bolt" || s.kind === "orbit") {
      ctx.strokeStyle = s.kind === "bolt" ? "rgba(120, 230, 210," + a + ")" : "rgba(255, 196, 120," + a + ")";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(18, s.size * (0.22 + (1 - p) * 0.18)), 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.kind === "spark") {
      ctx.fillStyle = "rgba(255, 210, 140," + a + ")";
      ctx.beginPath();
      ctx.arc(0, 0, 5 + (1 - p) * 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.kind === "smoke" || s.kind === "dash") {
      ctx.fillStyle = s.kind === "dash" ? "rgba(190, 140, 255," + (a * 0.7) + ")" : "rgba(210, 180, 255," + (a * 0.55) + ")";
      ctx.beginPath();
      ctx.ellipse(0, 0, 14 + (1 - p) * 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSprites(ctx, list, ground) {
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (!!s.ground !== !!ground) continue;
      drawUnderlay(ctx, s);
      if (IL.fx) IL.fx.drawOne(ctx, s);
    }
  }

  function drawCast(ctx, u, fx) {
    const c = u.cast;
    if (!c) return;
    const p = Math.max(0, Math.min(1, c.t / c.dur));
    const hot = c.kind === "cast2";
    const fill = hot ? "rgba(255, 150, 70," : "rgba(176, 140, 255,";
    const edge = hot ? "rgba(255, 214, 150," : "rgba(236, 220, 255,";
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fillStyle = fill + (0.08 + p * 0.12) + ")";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.arc(c.x, c.y, c.r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = fill + "0.22)";
    ctx.fill();
    const ticks = hot ? 6 : 8;
    ctx.fillStyle = edge + (0.45 + p * 0.45) + ")";
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * Math.PI * 2 + (fx.t || 0) * (hot ? -1.8 : 1.3);
      const rr = c.r * (0.78 + 0.16 * Math.sin((fx.t || 0) * 3 + i));
      ctx.beginPath();
      ctx.arc(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr * 0.55, hot ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.strokeStyle = edge + (0.4 + p * 0.55) + ")";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = edge + (0.25 + p * 0.35) + ")";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(u.x, u.y - 20);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
    if (IL.fx) {
      const kind = hot ? "orbit" : "plasma";
      const alt = hot ? "bolt" : "plasma";
      const drawn = IL.fx.drawLoop(ctx, kind, c.x, c.y, c.r * 2.15, (fx.t || 0) + c.t, { alpha: 0.72 + p * 0.25 });
      if (!drawn) IL.fx.drawLoop(ctx, alt, c.x, c.y, c.r * 2.05, fx.t || 0, { alpha: 0.8 });
    }
  }

  function drawBlock(ctx, u, fx) {
    if (u.state !== "block" || u.hp <= 0) return;
    const pulse = 0.55 + 0.45 * Math.sin((fx.t || 0) * 11);
    ctx.save();
    ctx.translate(u.x, u.y - 22);
    ctx.rotate(u.facing > 0 ? 0 : Math.PI);
    ctx.strokeStyle = "rgba(186, 214, 255," + (0.45 + pulse * 0.45) + ")";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(12, 0, 22 + pulse * 5, -1.2, 1.2);
    ctx.stroke();
    ctx.restore();
    if (IL.fx) IL.fx.drawLoop(ctx, "orbit", u.x + u.facing * 10, u.y - 20, 108, fx.t || 0, { alpha: 0.55 + pulse * 0.35, facing: u.facing });
  }

  function drawTrail(ctx, u) {
    const tr = u.trail;
    if (!tr || tr.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(tr[0].x, tr[0].y - (u.state === "dash" ? 14 : 2));
    for (let i = 1; i < tr.length; i++) ctx.lineTo(tr[i].x, tr[i].y - (u.state === "dash" ? 14 : 2));
    ctx.strokeStyle = u.state === "roll" ? "rgba(214, 186, 255, 0.45)" : "rgba(255, 170, 90, 0.55)";
    ctx.lineWidth = u.state === "dash" ? 4 : 3;
    ctx.stroke();
  }

  function drawShot(ctx, p, time) {
    const tr = p.trail || [];
    if (tr.length) {
      ctx.beginPath();
      ctx.moveTo(tr[0].x, tr[0].y);
      for (let i = 1; i < tr.length; i++) ctx.lineTo(tr[i].x, tr[i].y);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = p.team === 0 ? "rgba(255, 176, 96, 0.75)" : p.team === 1 ? "rgba(176, 206, 255, 0.75)" : "rgba(226, 196, 120, 0.75)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    const ang = Math.atan2(p.vy, p.vx);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    ctx.strokeStyle = "#f0d7a8";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(6, 0);
    ctx.stroke();
    ctx.fillStyle = p.team === 0 ? "#ffb45a" : p.team === 1 ? "#d5e4ff" : "#f0d48a";
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(4, -4);
    ctx.lineTo(4, 4);
    ctx.fill();
    ctx.strokeStyle = p.team === 0 ? "#c4622d" : "#8aa0c4";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(-9, -5);
    ctx.moveTo(-16, 0);
    ctx.lineTo(-9, 5);
    ctx.stroke();
    ctx.restore();
    if (IL.fx) IL.fx.drawLoop(ctx, "shot", p.x, p.y, 58, time, { alpha: 0.95, rot: ang });
  }

  function drawArena(ctx, match, fx) {
    const canvas = ctx.canvas;
    const view = fitArena(canvas);
    const cam = updateCam(match, fx, view);
    const scale = view.cssW / cam.viewW;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    const shake = (fx.shake || 0) * SHAKE_SCALE;
    if (shake > 0.2 * SHAKE_SCALE) {
      ctx.translate(Math.sin(fx.t * 48) * shake * view.dpr, Math.cos(fx.t * 37) * shake * 0.65 * view.dpr);
    }
    ctx.translate(view.dpr * (view.cssW / 2 - cam.x * scale), view.dpr * (view.cssH / 2 - cam.y * scale));
    ctx.scale(view.dpr * scale, view.dpr * scale);

    drawPit(ctx, fx);

    for (let i = 0; i < match.units.length; i++) drawCast(ctx, match.units[i], fx);
    for (let i = 0; i < match.units.length; i++) {
      if (match.units[i].state === "dash" || match.units[i].state === "roll") drawTrail(ctx, match.units[i]);
    }
    drawSprites(ctx, fx.sprites, true);

    if (fx.booms) {
      for (let i = 0; i < fx.booms.length; i++) {
        const b = fx.booms[i];
        const p = b.t / b.life;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * (0.55 + p * 0.7), 0, Math.PI * 2);
        ctx.strokeStyle = b.kind === "cast2" ? "rgba(255, 196, 120," + (1 - p) + ")" : "rgba(244, 220, 255," + (1 - p) + ")";
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * (0.25 + p * 0.4), 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 244, 220," + ((1 - p) * 0.7) + ")";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    const order = match.units.slice().sort(function (a, b) { return a.y - b.y; });
    const ui = Math.max(0.85, Math.min(1.35, cam.viewW / 1200));
    for (let i = 0; i < order.length; i++) {
      const u = order[i];
      const z = u.z || 0;
      const lift = z > 2 ? Math.max(0.45, 1 - z / 180) : 1;
      ctx.fillStyle = "rgba(0,0,0," + (0.28 + 0.16 * lift) + ")";
      ctx.beginPath();
      ctx.ellipse(u.x, u.y + 2, (u.hp > 0 ? 16 : 22) * lift, 6 * lift, 0, 0, Math.PI * 2);
      ctx.fill();
      if (u.iframe > 0 && u.hp > 0) {
        ctx.strokeStyle = "rgba(214, 186, 255, 0.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(u.x, u.y + 2, 22, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      const frame = IL.frameIndex(u.anim || "idle", u.animT || 0);
      const gy = u.y - z;
      if (u.sprite) {
        IL.hero.draw(ctx, u.sprite, frame, u.x, gy, SCALE, u.facing, u.cls);
        if (u.flash > 0 && u.hp > 0) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = Math.min(0.85, u.flash * 5);
          IL.hero.draw(ctx, u.sprite, frame, u.x, gy, SCALE, u.facing, u.cls);
          ctx.restore();
        }
      } else {
        ctx.fillStyle = u.team === 0 ? "#c4622d" : "#7f93b8";
        ctx.beginPath();
        ctx.arc(u.x, gy - 28, 12, 0, Math.PI * 2);
        ctx.fill();
      }
      drawBlock(ctx, u, fx);
      if (u.hp > 0) {
        const bw = 48 * ui;
        const bx = Math.round(u.x - bw / 2);
        const by = Math.round(gy - 34 * SCALE - 10);
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
        ctx.fillStyle = u.team === 0 ? "#c4622d" : "#7f93b8";
        ctx.fillRect(bx, by, Math.max(0, bw * (u.hp / u.maxHp)), 4);
        ctx.font = Math.round(13 * ui) + "px Palatino, Georgia, serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(10,8,6,0.75)";
        ctx.fillText(u.name, u.x + 1, by - 4);
        ctx.fillStyle = "#f4ecdf";
        ctx.fillText(u.name, u.x, by - 5);
      }
    }

    for (let i = 0; i < match.shots.length; i++) drawShot(ctx, match.shots[i], fx.t || 0);
    drawSprites(ctx, fx.sprites, false);

    ctx.font = "bold " + Math.round(18 * ui) + "px Palatino, Georgia, serif";
    ctx.textAlign = "center";
    if (fx.nums) {
      for (let i = 0; i < fx.nums.length; i++) {
        const n = fx.nums[i];
        const a = Math.max(0, 1 - n.t / n.life);
        ctx.globalAlpha = a;
        ctx.fillStyle = n.heal ? "#b7d39a" : n.crit ? "#ffd27a" : n.dodge ? "#e6d4ff" : n.blocked ? "#d7d2ea" : "#fff6e8";
        const label = n.heal ? ("+" + n.n) : n.crit ? "crit" : n.dodge ? "slip" : n.blocked ? n.n + " guard" : String(n.n);
        ctx.fillText(label, n.x, n.y - n.t * 42);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const vig = ctx.createRadialGradient(view.cssW / 2, view.cssH / 2, Math.min(view.cssW, view.cssH) * 0.35, view.cssW / 2, view.cssH / 2, Math.max(view.cssW, view.cssH) * 0.72);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, view.cssW, view.cssH);

    if (match.engage > 0) {
      ctx.fillStyle = "rgba(20,16,12,0.4)";
      ctx.fillRect(0, view.cssH * 0.38, view.cssW, 86);
      ctx.fillStyle = "#f4ecdf";
      ctx.font = "28px Palatino, Georgia, serif";
      ctx.textAlign = "center";
      const multi = (match.teams || 2) > 2;
      const title = multi ? (match.names || []).join("   ·   ") : (match.leftName + "  vs  " + match.rightName);
      ctx.fillText(title, view.cssW / 2, view.cssH * 0.38 + 36);
      ctx.font = "14px Palatino, Georgia, serif";
      ctx.fillStyle = "#e0b07a";
      ctx.fillText(multi ? "Chaos pit. Last club standing." : "They walk in on their own.", view.cssW / 2, view.cssH * 0.38 + 58);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  IL.SCALE = SCALE;
  IL.SHAKE_SCALE = SHAKE_SCALE;
  IL.fitArena = fitArena;
  IL.drawArena = drawArena;
})(typeof window !== "undefined" ? window : globalThis);
