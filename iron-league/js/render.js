/* Iron League — arena canvas. Camera follows the squads through a wide pit.
   Pixel FX strips play additive; procedural strokes remain underneath and
   stand in fully when a sheet has not loaded. */
(function (root) {
  const IL = root.IL = root.IL || {};
  const SCALE = 6;
  /* One knob for every screen shake. Hits add 3.2 (1.5 if blocked, cap 7)
     and cast blasts add 4 (cap 8) in game.js. 1 is that original kick.
     0.1 is a small nudge, not a shake. */
  const SHAKE_SCALE = 0.1;
  /* Floors stay mid-tone. A near-white oval washes the battlers out. */
  const PITS = [
    {
      id: "sand", name: "Sand colosseum",
      sky: ["#24160f", "#4a3020"], floor: "#7a5638", grain: "#3a2616", lite: "#a88458",
      wall: "#3a2a1c", rail: "#c4a06a", stone: "#5a4030",
      crowd: "#140e0a", cloth: ["#6e3030", "#2c4068", "#6a5428", "#3a3028", "#243028"],
      torch: "#e07a32", core: "#f2c14a", glow: "255,150,60",
      mote: "rgba(210,170,120,0.35)", line: "rgba(48,28,14,0.4)"
    },
    {
      id: "frost", name: "Frozen ring",
      sky: ["#0c161e", "#1c3040"], floor: "#3e5564", grain: "#1a2c38", lite: "#7f9aab",
      wall: "#1c303c", rail: "#c5dbe6", stone: "#2c4554",
      crowd: "#0c141c", cloth: ["#1e3348", "#2a4a5c", "#243038", "#3a4a58", "#182430"],
      torch: "#9fd0e8", core: "#e8f6ff", glow: "150,200,230",
      mote: "rgba(190,220,235,0.28)", line: "rgba(190,220,235,0.28)"
    },
    {
      id: "lava", name: "Lava forge",
      sky: ["#1a0a08", "#4a180e"], floor: "#3a1c14", grain: "#140806", lite: "#6a3020",
      wall: "#24100c", rail: "#e07040", stone: "#4a2018",
      crowd: "#120806", cloth: ["#4a2018", "#2a1210", "#6a2818", "#3a1814", "#20100c"],
      torch: "#ff6a2a", core: "#ffd27a", glow: "255,100,40",
      mote: "rgba(255,140,60,0.4)", line: "rgba(255,90,30,0.28)"
    },
    {
      id: "night", name: "Night market",
      sky: ["#0c0a12", "#221c32"], floor: "#2a2438", grain: "#14101c", lite: "#403850",
      wall: "#14101c", rail: "#e0b07a", stone: "#2a2436",
      crowd: "#0a0810", cloth: ["#2a2040", "#3a2848", "#201828", "#403020", "#182030"],
      torch: "#e0b07a", core: "#fff0c8", glow: "224,176,122",
      mote: "rgba(224,176,122,0.32)", line: "rgba(224,176,122,0.16)"
    },
    {
      id: "temple", name: "Ruined temple",
      sky: ["#10160e", "#24301c"], floor: "#4a483c", grain: "#26241c", lite: "#6a6856",
      wall: "#22261c", rail: "#c6d48a", stone: "#3a4032",
      crowd: "#10140e", cloth: ["#2a3424", "#3a4030", "#243028", "#4a4030", "#1c2418"],
      torch: "#c6d48a", core: "#f4f0c8", glow: "198,212,138",
      mote: "rgba(198,212,138,0.28)", line: "rgba(28,32,20,0.45)"
    }
  ];
  IL.PITS = PITS;
  const pitTex = {};

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
    /* Phones draw the pit at 1x. A 2x backing store is the desktop path. */
    const dpr = Math.min(narrow ? 1 : 2, root.devicePixelRatio || 1);
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
        viewW: view.cssW < 760 ? 520 : 980
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
    const spanW = (maxX - minX) + (narrow ? 150 : 260);
    const spanH = (maxY - minY) + (narrow ? 120 : 220);
    let want = Math.max(spanW, spanH * aspect);
    const minW = narrow ? 460 : 900;
    const maxW = narrow ? 720 : W.w;
    want = Math.max(minW, Math.min(maxW, want));
    const zoom = match.zoom || 0;
    if (zoom > 0) want *= 1 - 0.22 * Math.min(1, zoom);
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

  function pitGrain(pit) {
    if (pitTex[pit.id]) return pitTex[pit.id];
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 160;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.fillStyle = pit.floor;
    g.fillRect(0, 0, 160, 160);
    if (pit.id === "sand") {
      for (let i = 0; i < 320; i++) {
        g.globalAlpha = 0.28 + (i % 5) * 0.08;
        g.fillStyle = i % 3 ? pit.grain : pit.lite;
        g.fillRect((i * 47) % 160, (i * 29) % 160, i % 4 === 0 ? 3 : 2, 2);
      }
      g.globalAlpha = 0.22;
      g.strokeStyle = pit.grain;
      g.lineWidth = 1;
      for (let r = 0; r < 5; r++) {
        g.beginPath();
        g.moveTo(0, 18 + r * 30);
        g.bezierCurveTo(40, 8 + r * 30, 100, 34 + r * 30, 160, 16 + r * 30);
        g.stroke();
      }
    } else if (pit.id === "frost") {
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          g.fillStyle = (row + col) % 2 ? pit.lite : pit.floor;
          g.globalAlpha = (row + col) % 2 ? 0.35 : 1;
          g.fillRect(4 + col * 40, 4 + row * 40, 34, 34);
        }
      }
      g.globalAlpha = 0.7;
      g.strokeStyle = pit.lite;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(6, 18); g.lineTo(74, 52); g.lineTo(36, 118); g.lineTo(128, 86); g.lineTo(154, 148);
      g.moveTo(96, 8); g.lineTo(138, 64); g.lineTo(88, 152);
      g.stroke();
      g.globalAlpha = 0.18;
      g.fillStyle = "#d5e6ee";
      g.fillRect(0, 36, 160, 2);
      g.fillRect(0, 108, 160, 2);
    } else if (pit.id === "lava") {
      g.fillStyle = pit.grain;
      for (let i = 0; i < 18; i++) {
        g.globalAlpha = 0.65;
        g.beginPath();
        g.arc((i * 53) % 150 + 6, (i * 37) % 150 + 6, 8 + (i % 4) * 3, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 0.85;
      g.strokeStyle = pit.torch;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, 40); g.lineTo(36, 28); g.lineTo(70, 58); g.lineTo(110, 34); g.lineTo(160, 62);
      g.moveTo(20, 120); g.lineTo(80, 100); g.lineTo(140, 132);
      g.stroke();
    } else if (pit.id === "night") {
      for (let row = 0; row < 8; row++) {
        const off = row % 2 ? 12 : 0;
        for (let col = 0; col < 8; col++) {
          g.fillStyle = (row + col) % 2 ? pit.lite : pit.floor;
          g.fillRect(off + col * 22, row * 20, 18, 14);
        }
      }
      g.globalAlpha = 0.35;
      g.fillStyle = pit.grain;
      g.fillRect(0, 0, 160, 160);
    } else {
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          g.fillStyle = (row + col) % 2 ? pit.lite : pit.floor;
          g.globalAlpha = (row + col) % 2 ? 0.55 : 1;
          g.fillRect(3 + col * 40, 3 + row * 40, 34, 34);
        }
      }
      g.globalAlpha = 0.45;
      g.strokeStyle = pit.grain;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(20, 8); g.lineTo(48, 70); g.lineTo(30, 150);
      g.moveTo(110, 4); g.lineTo(96, 80); g.lineTo(140, 150);
      g.stroke();
    }
    g.globalAlpha = 1;
    pitTex[pit.id] = c;
    return c;
  }

  function brazier(ctx, x, y, t, pit) {
    const flick = 0.82 + 0.18 * Math.sin(t * 8 + x * 0.01);
    const glow = ctx.createRadialGradient(x, y, 4, x, y, 78);
    glow.addColorStop(0, "rgba(" + pit.glow + "," + (0.38 * flick) + ")");
    glow.addColorStop(1, "rgba(" + pit.glow + ",0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 78, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pit.wall;
    ctx.fillRect(x - 10, y, 20, 26);
    ctx.fillStyle = pit.torch;
    ctx.beginPath();
    ctx.moveTo(x - 12, y + 4);
    ctx.lineTo(x, y - 16 * flick);
    ctx.lineTo(x + 12, y + 4);
    ctx.fill();
    ctx.fillStyle = pit.core;
    ctx.beginPath();
    ctx.arc(x, y - 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSpectator(ctx, x, y, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y - h, 7, h);
    ctx.beginPath();
    ctx.arc(x + 3.5, y - h - 3, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStands(ctx, pit, frame, t, cheer) {
    const left = frame.left;
    const top = frame.top;
    const vw = frame.viewW;
    const vh = frame.viewH;
    const band = Math.max(56, Math.min(104, vh * 0.18));
    const side = Math.max(18, Math.min(46, vw * 0.05));
    ctx.fillStyle = pit.wall;
    ctx.fillRect(left - 8, top - 12, vw + 16, band + 8);
    const blocks = Math.ceil(vw / 26) + 2;
    for (let i = 0; i < blocks; i++) {
      ctx.fillStyle = i % 2 ? pit.stone : pit.wall;
      ctx.fillRect(left - 8 + i * 26, top - 8, 24, 12);
      ctx.fillStyle = i % 2 ? pit.wall : pit.stone;
      ctx.fillRect(left + 6 + i * 26, top + 4, 24, 11);
    }
    const rows = 3;
    for (let row = 0; row < rows; row++) {
      const y = top + 22 + row * ((band - 18) / rows);
      ctx.fillStyle = pit.crowd;
      ctx.fillRect(left, y, vw, 4);
      const n = Math.ceil(vw / 20);
      for (let i = 0; i < n; i++) {
        const bounce = Math.sin(t * 4.2 + i * 0.7 + row) * (1.4 + cheer * 5);
        const h = 7 + ((i + row) % 3) * 3;
        drawSpectator(ctx, left + 6 + i * 20, y + bounce, h, pit.cloth[(i + row * 2) % pit.cloth.length]);
      }
    }
    ctx.fillStyle = pit.rail;
    ctx.fillRect(left, top + band - 4, vw, 4);
    if (pit.id === "sand") {
      for (let i = 0; i < 8; i++) {
        const x = left + 24 + i * (vw / 8);
        ctx.fillStyle = pit.cloth[i % pit.cloth.length];
        ctx.beginPath();
        ctx.moveTo(x, top + band);
        ctx.lineTo(x + 8, top + band);
        ctx.lineTo(x + 4, top + band + 16);
        ctx.fill();
      }
    } else if (pit.id === "frost") {
      ctx.fillStyle = pit.rail;
      for (let i = 0; i < Math.ceil(vw / 16); i++) {
        const x = left + i * 16;
        ctx.beginPath();
        ctx.moveTo(x, top + band);
        ctx.lineTo(x + 5, top + band);
        ctx.lineTo(x + 2.5, top + band + 10 + (i % 3) * 4);
        ctx.fill();
      }
    } else if (pit.id === "lava") {
      ctx.fillStyle = "rgba(" + pit.glow + ",0.45)";
      ctx.fillRect(left, top + band, vw, 6);
    } else if (pit.id === "night") {
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = pit.cloth[i % pit.cloth.length];
        ctx.beginPath();
        ctx.moveTo(left + i * (vw / 6), top + 8);
        ctx.quadraticCurveTo(left + (i + 0.5) * (vw / 6), top + 28, left + (i + 1) * (vw / 6), top + 8);
        ctx.fill();
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const x = left + 18 + i * (vw / 5);
        ctx.fillStyle = pit.stone;
        ctx.fillRect(x, top - 6, 14, band + 18);
        ctx.fillStyle = pit.rail;
        ctx.fillRect(x - 4, top - 8, 22, 6);
      }
    }
    ctx.fillStyle = pit.wall;
    ctx.fillRect(left - 6, top, side, vh + 10);
    ctx.fillRect(left + vw - side + 6, top, side, vh + 10);
    ctx.fillStyle = pit.rail;
    ctx.fillRect(left + side - 8, top + band, 3, vh - band);
    ctx.fillRect(left + vw - side + 5, top + band, 3, vh - band);
    const posts = Math.max(4, Math.floor((vh - band) / 42));
    for (let i = 0; i < posts; i++) {
      const y = top + band + 8 + i * ((vh - band - 16) / posts);
      ctx.fillStyle = pit.stone;
      ctx.fillRect(left + side - 12, y, 8, 16);
      ctx.fillRect(left + vw - side + 4, y, 8, 16);
      ctx.fillStyle = pit.rail;
      ctx.fillRect(left + side - 14, y, 12, 3);
      ctx.fillRect(left + vw - side + 2, y, 12, 3);
    }
    ctx.fillStyle = pit.wall;
    ctx.fillRect(left - 4, top + vh - 12, vw + 8, 18);
    ctx.fillStyle = pit.rail;
    ctx.fillRect(left, top + vh - 14, vw, 3);
  }

  function drawPit(ctx, fx, match) {
    const W = IL.WORLD;
    const t = fx.t || 0;
    const pit = PITS[(match && match.pit) || 0] || PITS[0];
    const cheer = (match && match.cheer) || 0;
    const cx = (W.left + W.right) / 2;
    const cy = (W.top + W.bottom) / 2;
    const cam = fx.cam;
    const frame = cam ? {
      left: cam.x - cam.viewW / 2,
      top: cam.y - cam.viewH / 2,
      viewW: cam.viewW,
      viewH: cam.viewH
    } : { left: 0, top: 0, viewW: W.w, viewH: W.h };

    const sky = ctx.createLinearGradient(0, 0, 0, W.h);
    sky.addColorStop(0, pit.sky[0]);
    sky.addColorStop(1, pit.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(-80, -80, W.w + 160, W.h + 160);

    const tex = pitGrain(pit);
    if (!pit._pat && tex) pit._pat = ctx.createPattern(tex, "repeat");
    ctx.fillStyle = pit._pat || pit.floor;
    ctx.fillRect(-40, -40, W.w + 80, W.h + 80);

    const shade = ctx.createRadialGradient(cx, cy, 160, cx, cy, 820);
    shade.addColorStop(0, "rgba(0,0,0,0)");
    shade.addColorStop(0.55, "rgba(0,0,0,0.16)");
    shade.addColorStop(1, "rgba(0,0,0,0.52)");
    ctx.fillStyle = shade;
    ctx.fillRect(-40, -40, W.w + 80, W.h + 80);

    ctx.strokeStyle = pit.line;
    ctx.lineWidth = 2;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, 120 + i * 90, 46 + i * 34, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    drawStands(ctx, pit, frame, t, cheer);

    brazier(ctx, frame.left + 36, frame.top + 28, t, pit);
    brazier(ctx, frame.left + frame.viewW - 36, frame.top + 28, t + 1.2, pit);
    brazier(ctx, frame.left + 28, frame.top + frame.viewH - 20, t + 0.6, pit);
    brazier(ctx, frame.left + frame.viewW - 28, frame.top + frame.viewH - 20, t + 1.8, pit);
    ctx.fillStyle = pit.mote;
    for (let i = 0; i < 14; i++) {
      const px = cx + Math.sin(t * 0.7 + i * 1.7) * (160 + (i % 5) * 36);
      const py = cy + Math.cos(t * 0.9 + i) * (60 + (i % 4) * 16) - ((t * 22 + i * 30) % 70);
      ctx.fillRect(px, py, 2, 2);
    }
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

  function markColor(kind) {
    if (kind === "heal" || kind === "mend" || kind === "buff") return "186, 214, 160";
    if (kind === "shield" || kind === "bolt" || kind === "arc") return "186, 206, 255";
    if (kind === "frost") return "190, 230, 245";
    if (kind === "summon" || kind === "dot") return "176, 140, 210";
    if (kind === "rage" || kind === "fireball") return "255, 150, 70";
    return "244, 210, 150";
  }

  function drawMarks(ctx, fx) {
    const rings = fx.rings || [];
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      const p = r.t / r.life;
      const rgb = markColor(r.kind);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r * (0.35 + p * 0.85), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(" + rgb + "," + (1 - p) + ")";
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    const beams = fx.beams || [];
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i];
      const p = b.t / b.life;
      const rgb = markColor(b.kind);
      ctx.strokeStyle = "rgba(" + rgb + "," + (1 - p) + ")";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + (b.x2 - b.x) * Math.min(1, p * 1.4), b.y + (b.y2 - b.y) * Math.min(1, p * 1.4));
      ctx.stroke();
    }
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
    if (p.bullet) {
      if (p.life > 1.06) {
        const ang = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.fillStyle = "rgba(255, 236, 180, 0.9)";
        ctx.fillRect(-16, -3, 14, 6);
        ctx.fillStyle = "#fffef8";
        ctx.fillRect(-8, -2, 6, 4);
        ctx.restore();
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = "#f6f1e6";
      ctx.beginPath();
      ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2c261f";
      ctx.beginPath();
      ctx.arc(1.2, 0, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const arrow = IL.weapons && IL.weapons.sprite ? IL.weapons.sprite("arrow") : null;
    if (arrow) {
      const ang = Math.atan2(p.vy, p.vx);
      const s = 3;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang + Math.PI);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(arrow, Math.round(-5 * s), Math.round(-2 * s), 11 * s, 4 * s);
      ctx.restore();
      return;
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

  function drawStatus(ctx, u, by) {
    const marks = [];
    if (u.bleed && u.bleed.t > 0) marks.push("#7dce6a");
    if ((u.stun || 0) > 0) marks.push("#f2d15a");
    if ((u.shield || 0) > 0) marks.push("#8eb6e8");
    if ((u.buff || 0) > 0) marks.push("#f4ecdf");
    if ((u.rage || 0) > 0) marks.push("#e07048");
    if (!marks.length) return;
    const x0 = u.x - (marks.length - 1) * 6;
    for (let i = 0; i < marks.length; i++) {
      ctx.fillStyle = marks[i];
      ctx.beginPath();
      ctx.arc(x0 + i * 12, by - 16, 4, 0, Math.PI * 2);
      ctx.fill();
    }
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

    drawPit(ctx, fx, match);

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
    const shown = {};
    for (let i = 0; i < order.length; i++) {
      const u = order[i];
      let x = u.x;
      let y = u.y;
      const gap = 16 * SCALE;
      if (u.hp > 0) {
        for (let j = 0; j < order.length; j++) {
          const o = order[j];
          if (o === u || o.hp <= 0 || o.team === u.team) continue;
          const ox = shown[o.id] ? shown[o.id].x : o.x;
          const oy = shown[o.id] ? shown[o.id].y : o.y;
          const dx = x - ox;
          const dy = y - oy;
          const d = Math.hypot(dx, dy) || 1;
          if (d < gap) {
            const push = (gap - d) * 0.5;
            x += (dx / d) * push;
            y += (dy / d) * push;
          }
        }
      }
      shown[u.id] = { x: x, y: y };
      const z = u.z || 0;
      const lift = z > 2 ? Math.max(0.45, 1 - z / 180) : 1;
      ctx.fillStyle = "rgba(0,0,0," + (0.28 + 0.16 * lift) + ")";
      ctx.beginPath();
      ctx.ellipse(x, y + 2, (u.hp > 0 ? 16 : 22) * lift, 6 * lift, 0, 0, Math.PI * 2);
      ctx.fill();
      if (u.iframe > 0 && u.hp > 0) {
        ctx.strokeStyle = "rgba(214, 186, 255, 0.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, y + 2, 22, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      const frame = IL.frameIndex(u.anim || "idle", u.animT || 0);
      const gy = y - z;
      if (u.sprite) {
        const hint = (u.state === "attack" || u.state === "cast") ? u.motion : null;
        IL.hero.draw(ctx, u.sprite, frame, x, gy, SCALE, u.facing, u.cls, hint, u.weaponKind);
        if (u.flash > 0 && u.hp > 0) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = Math.min(0.85, u.flash * 5);
          IL.hero.draw(ctx, u.sprite, frame, x, gy, SCALE, u.facing, u.cls, hint, u.weaponKind);
          ctx.restore();
        }
      } else {
        ctx.fillStyle = u.team === 0 ? "#c4622d" : "#7f93b8";
        ctx.beginPath();
        ctx.arc(x, gy - 28, 12, 0, Math.PI * 2);
        ctx.fill();
      }
      drawBlock(ctx, u, fx);
      if (u.hp > 0) {
        const bw = 48 * ui;
        const bx = Math.round(x - bw / 2);
        const by = Math.round(gy - 34 * SCALE - 10);
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
        ctx.fillStyle = u.team === 0 ? "#c4622d" : "#7f93b8";
        ctx.fillRect(bx, by, Math.max(0, bw * (u.hp / u.maxHp)), 4);
        ctx.font = Math.round(13 * ui) + "px Palatino, Georgia, serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(10,8,6,0.75)";
        ctx.fillText(u.name, x + 1, by - 4);
        ctx.fillStyle = "#f4ecdf";
        ctx.fillText(u.name, x, by - 5);
        drawStatus(ctx, u, by);
        if (u.state === "cast" && u.cast && u.cast.dur > 0) {
          const cp = Math.max(0, Math.min(1, u.cast.t / u.cast.dur));
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.fillRect(bx, by + 7, bw, 4);
          ctx.fillStyle = "#d7c4ff";
          ctx.fillRect(bx, by + 7, Math.max(0, bw * cp), 4);
        }
        if (u.banner) {
          const a = Math.max(0, 1 - u.banner.t / u.banner.life);
          ctx.globalAlpha = a;
          ctx.font = "bold " + Math.round((u.banner.ult ? 16 : 13) * ui) + "px Palatino, Georgia, serif";
          ctx.fillStyle = u.banner.ult ? "#ffd27a" : "#f4ecdf";
          ctx.fillText(u.banner.name, x, by - 16 - u.banner.t * 18);
          ctx.globalAlpha = 1;
        }
      }
    }

    drawMarks(ctx, fx);
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
        const label = n.heal ? ("+" + n.n) : n.crit ? String(n.n) : n.dodge ? "slip" : n.blocked ? n.n + " guard" : String(n.n);
        if (n.crit) ctx.font = "bold " + Math.round(26 * ui) + "px Palatino, Georgia, serif";
        ctx.fillText(label, n.x, n.y - n.t * 42);
        if (n.crit) ctx.font = "bold " + Math.round(18 * ui) + "px Palatino, Georgia, serif";
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const vig = ctx.createRadialGradient(view.cssW / 2, view.cssH / 2, Math.min(view.cssW, view.cssH) * 0.28, view.cssW / 2, view.cssH / 2, Math.max(view.cssW, view.cssH) * 0.68);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(0.62, "rgba(0,0,0,0.08)");
    vig.addColorStop(1, "rgba(0,0,0,0.58)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, view.cssW, view.cssH);
    if ((match.zoom || 0) > 0.15) {
      ctx.fillStyle = "rgba(6,4,8," + (0.45 * Math.min(1, match.zoom)) + ")";
      ctx.fillRect(0, 0, view.cssW, view.cssH);
    }

    if (match.cine && match.cine.dur > 0) {
      const c = match.cine;
      const p = Math.max(0, Math.min(1, c.t / c.dur));
      const fade = p > 0.78 ? (1 - p) / 0.22 : 1;
      ctx.fillStyle = "rgba(8,6,12," + (0.72 * fade) + ")";
      ctx.fillRect(0, view.cssH * 0.3, view.cssW, 96);
      ctx.fillStyle = "rgba(255,210,122," + fade + ")";
      ctx.fillRect(0, view.cssH * 0.3, view.cssW, 3);
      ctx.fillRect(0, view.cssH * 0.3 + 93, view.cssW, 3);
      ctx.globalAlpha = fade;
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffd27a";
      ctx.font = "13px Palatino, Georgia, serif";
      ctx.fillText("ULTIMATE", view.cssW / 2, view.cssH * 0.33 + 26);
      ctx.fillStyle = "#f4ecdf";
      ctx.font = "28px Palatino, Georgia, serif";
      ctx.fillText(c.name || "", view.cssW / 2, view.cssH * 0.33 + 58);
      ctx.globalAlpha = 1;
    }

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
      const pit = PITS[(match.pit) || 0] || PITS[0];
      ctx.fillText(multi ? "Chaos pit. Last club standing." : pit.name, view.cssW / 2, view.cssH * 0.38 + 58);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  IL.SCALE = SCALE;
  IL.SHAKE_SCALE = SHAKE_SCALE;
  IL.fitArena = fitArena;
  IL.drawArena = drawArena;
})(typeof window !== "undefined" ? window : globalThis);
