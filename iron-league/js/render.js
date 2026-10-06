/* Iron League — arena canvas. The whole floor is on screen. A tall
   viewport turns the floor so the clubs start at the top and the bottom.
   Pixel FX strips play additive; procedural strokes remain underneath and
   stand in fully when a sheet has not loaded. */
(function (root) {
  const IL = root.IL = root.IL || {};
  /* 1 world unit is 1 sprite texel. The view scale (1, 1.5, 2, …) is
     chosen per frame so the sheet stays crisp and never drops below 1x. */
  const SCALE = 1;
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
    if (boxH >= 200) {
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

  /* Whole floor, letterboxed. A portrait viewport turns it so the long
     axis is vertical. Scale snaps to whole or half steps and stays ≥ 1. */
  function updateCam(match, fx, view) {
    const W = IL.WORLD;
    const portrait = view.cssH > view.cssW;
    const fw = portrait ? W.h : W.w;
    const fh = portrait ? W.w : W.h;
    const fit = Math.min(view.cssW / fw, view.cssH / fh);
    const steps = [1, 1.5, 2, 2.5, 3];
    let spriteScale = 1;
    for (let i = 0; i < steps.length; i++) {
      if (steps[i] <= fit + 0.001) spriteScale = steps[i];
    }
    const drawW = fw * spriteScale;
    const drawH = fh * spriteScale;
    const cam = {
      x: W.w / 2,
      y: W.h / 2,
      viewW: W.w,
      viewH: W.h,
      portrait: portrait,
      spriteScale: spriteScale,
      ox: Math.round((view.cssW - drawW) / 2),
      oy: Math.round((view.cssH - drawH) / 2),
      drawW: drawW,
      drawH: drawH
    };
    fx.cam = cam;
    return cam;
  }

  function worldToCss(x, y, cam) {
    const s = cam.spriteScale;
    if (cam.portrait) return { x: cam.ox + y * s, y: cam.oy + x * s };
    return { x: cam.ox + x * s, y: cam.oy + y * s };
  }

  function cssToWorld(px, py, cam) {
    const s = cam.spriteScale || 1;
    if (cam.portrait) return { x: (py - cam.oy) / s, y: (px - cam.ox) / s };
    return { x: (px - cam.ox) / s, y: (py - cam.oy) / s };
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
    const band = Math.max(10, Math.min(16, vh * 0.04));
    const side = Math.max(6, Math.min(10, vw * 0.016));
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

    const bgL = Math.min(-80, frame.left - 80);
    const bgT = Math.min(-80, frame.top - 80);
    const bgR = Math.max(W.w + 80, frame.left + frame.viewW + 80);
    const bgB = Math.max(W.h + 80, frame.top + frame.viewH + 80);
    const sky = ctx.createLinearGradient(0, bgT, 0, bgB);
    sky.addColorStop(0, pit.sky[0]);
    sky.addColorStop(1, pit.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(bgL, bgT, bgR - bgL, bgB - bgT);

    const tex = pitGrain(pit);
    if (!pit._pat && tex) pit._pat = ctx.createPattern(tex, "repeat");
    ctx.fillStyle = pit._pat || pit.floor;
    ctx.fillRect(bgL, bgT, bgR - bgL, bgB - bgT);

    const shade = ctx.createRadialGradient(cx, cy, W.h * 0.15, cx, cy, W.w * 0.48);
    shade.addColorStop(0, "rgba(0,0,0,0)");
    shade.addColorStop(0.55, "rgba(0,0,0,0.16)");
    shade.addColorStop(1, "rgba(0,0,0,0.52)");
    ctx.fillStyle = shade;
    ctx.fillRect(bgL, bgT, bgR - bgL, bgB - bgT);

    ctx.strokeStyle = pit.line;
    ctx.lineWidth = 2;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, W.w * (0.06 + i * 0.045), W.h * (0.05 + i * 0.04), 0, 0, Math.PI * 2);
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

  function sigFade(p) {
    return p < 0.72 ? 1 : Math.max(0, 1 - (p - 0.72) / 0.28);
  }

  function drawSigRing(ctx, s, p, a) {
    const grow = 0.32 + p * 0.78;
    const rx = Math.max(8, s.r * grow);
    const ry = rx * 0.42;
    ctx.save();
    ctx.translate(s.x, s.y);
    if (s.mark === "soft") {
      ctx.fillStyle = "rgba(" + s.rgb + "," + (a * 0.22) + ")";
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(" + s.rgb + "," + a + ")";
    ctx.lineWidth = s.mark === "spike" ? 2 : 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,244,220," + (a * 0.65) + ")";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.7, ry * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();
    const n = s.mark === "spike" ? 12 : 8;
    const spin = s.mark === "spin" ? p * 6 : 0;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + spin;
      const cs = Math.cos(ang);
      const sn = Math.sin(ang);
      if (s.mark === "spike") {
        ctx.strokeStyle = "rgba(" + s.rgb + "," + a + ")";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cs * rx * 0.4, sn * ry * 0.4);
        ctx.lineTo(cs * rx * 1.18, sn * ry * 1.18);
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(" + s.rgb + "," + a + ")";
        ctx.beginPath();
        ctx.arc(cs * rx, sn * ry, s.mark === "soft" ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawSigTrail(ctx, s, p, a) {
    const head = Math.min(1, p * 1.2);
    const lift = s.mark === "flask" ? Math.sin(head * Math.PI) * 42 : 0;
    const hx = s.x + (s.x2 - s.x) * head;
    const hy = s.y + (s.y2 - s.y) * head - lift;
    ctx.save();
    ctx.strokeStyle = "rgba(" + s.rgb + "," + a + ")";
    ctx.lineWidth = s.mark === "slash" ? 5 : (s.mark === "bolt" ? 3.5 : 2);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    const steps = s.mark === "bolt" ? 3 : 6;
    for (let i = 1; i <= steps; i++) {
      const t = head * (i / steps);
      const arc = s.mark === "flask" ? Math.sin(t * Math.PI) * 42 : 0;
      ctx.lineTo(s.x + (s.x2 - s.x) * t, s.y + (s.y2 - s.y) * t - arc);
    }
    ctx.stroke();
    const motes = s.mark === "smoke" ? 5 : 4;
    for (let i = 0; i < motes; i++) {
      const t = Math.max(0, head - i * 0.12);
      const arc = s.mark === "flask" ? Math.sin(t * Math.PI) * 42 : 0;
      const spread = s.mark === "bolt" ? (i - 1.5) * s.r * 0.35 : 0;
      ctx.fillStyle = "rgba(" + s.rgb + "," + (a * (1 - i * 0.18)) + ")";
      ctx.beginPath();
      ctx.arc(s.x + (s.x2 - s.x) * t + spread, s.y + (s.y2 - s.y) * t - arc, Math.max(2, (s.r || 8) * 0.28 - i), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,248,230," + a + ")";
    ctx.beginPath();
    ctx.arc(hx, hy, s.mark === "slash" ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function sigBolt(ctx, x1, y1, x2, y2, reach, rgb, a, bend) {
    const segs = 8;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const mag = Math.hypot(dx, dy) || 1;
    const nx = -dy / mag;
    const ny = dx / mag;
    ctx.strokeStyle = "rgba(" + rgb + "," + a + ")";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      if (t > reach) break;
      const wob = (i % 2 === 0 ? 1 : -1) * bend * (0.55 + (i % 3) * 0.22);
      const x = x1 + dx * t + nx * wob;
      const y = y1 + dy * t + ny * wob;
      ctx.lineTo(x, y);
      if (i % 2 === 0 && t < reach) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + nx * bend * 0.85, y + ny * bend * 0.85);
        ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,244,220," + (a * 0.85) + ")";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawSigChain(ctx, s, p, a) {
    const reach = Math.min(1, p * 1.45);
    const bend = s.mark === "warm" ? 28 : 36;
    ctx.save();
    sigBolt(ctx, s.x, s.y, s.x2, s.y2, reach, s.rgb, a, bend);
    if (s.hop && reach > 0.55) {
      sigBolt(ctx, s.x2, s.y2, s.x3, s.y3, Math.min(1, (reach - 0.45) / 0.55), s.rgb, a * 0.9, bend * 0.7);
    }
    ctx.fillStyle = "rgba(" + s.rgb + "," + a + ")";
    ctx.beginPath();
    ctx.arc(s.x2, s.y2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSigSummon(ctx, s, p, a) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.strokeStyle = "rgba(" + s.rgb + "," + a + ")";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, s.r * (0.7 + p * 0.25), s.r * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,236,210," + (a * 0.75) + ")";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, s.r * 0.4, s.r * 0.16, 0, 0, Math.PI * 2);
    ctx.stroke();
    const n = s.mark === "beast" ? 6 : 5;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + p * 2;
      const rise = p * (28 + i * 8);
      ctx.fillStyle = "rgba(" + s.rgb + "," + a + ")";
      ctx.fillRect(Math.cos(ang) * s.r * 0.55 - 2, -rise, s.mark === "beast" ? 6 : 4, s.mark === "beast" ? 6 : 4);
    }
    ctx.restore();
  }

  function drawSigShield(ctx, s, p, a) {
    ctx.save();
    ctx.translate(s.x, s.y - 20);
    const pulse = 0.85 + 0.15 * Math.sin(p * 12);
    for (let i = 0; i < 3; i++) {
      const a0 = p * 5 + i * 2.1;
      ctx.strokeStyle = "rgba(" + s.rgb + "," + a + ")";
      ctx.lineWidth = i === 1 ? 4 : 2;
      ctx.beginPath();
      ctx.arc(0, 0, s.r * (0.5 + i * 0.16) * pulse, a0, a0 + (s.mark === "cross" ? 0.7 : 1.15));
      ctx.stroke();
    }
    if (s.mark === "cross") {
      ctx.strokeStyle = "rgba(255,244,210," + a + ")";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -s.r * 0.35);
      ctx.lineTo(0, s.r * 0.35);
      ctx.moveTo(-s.r * 0.22, -s.r * 0.08);
      ctx.lineTo(s.r * 0.22, -s.r * 0.08);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSigDust(ctx, s, p, a) {
    const dir = (s.facing < 0 ? -1 : 1) * (s.mark === "back" || s.mark === "slash" ? -1 : 1);
    const n = s.mark === "slash" ? 4 : 6;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const k = (i + 1) / n;
      const x = s.x + dir * (8 + i * 14) * (0.35 + p);
      const y = s.y - p * (6 + i * 7);
      const w = (s.mark === "slash" ? 22 : 16) * (1.15 - p * 0.3) + i;
      ctx.fillStyle = "rgba(" + s.rgb + "," + (a * (0.55 + 0.4 * (1 - k))) + ")";
      ctx.beginPath();
      ctx.ellipse(x, y, w, w * (s.mark === "slash" ? 0.28 : 0.42), dir * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSigs(ctx, fx, ground) {
    const list = fx.sigs;
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const onFloor = s.style === "ring" || s.style === "dust" || s.style === "summon";
      if (onFloor !== !!ground) continue;
      const p = s.life > 0 ? Math.max(0, Math.min(1, s.t / s.life)) : 1;
      const a = sigFade(p);
      if (a <= 0.02) continue;
      if (s.style === "ring") drawSigRing(ctx, s, p, a);
      else if (s.style === "trail") drawSigTrail(ctx, s, p, a);
      else if (s.style === "chain") drawSigChain(ctx, s, p, a);
      else if (s.style === "summon") drawSigSummon(ctx, s, p, a);
      else if (s.style === "shield") drawSigShield(ctx, s, p, a);
      else drawSigDust(ctx, s, p, a);
    }
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

  /* y is the text baseline. The glyph box sits above it. Bodies are center rects.
     far is the furthest the baseline may rise above y, in world units. Sideways
     comes first so a name stays by its head; a rise is one row, not a leap to
     the top of a sprite. */
  function labelSlot(labels, bodies, x, y, w, h, ceil, minX, maxX, gap, far) {
    function clampX(xx) {
      const half = w * 0.5;
      const lo = minX + half;
      const hi = maxX - half;
      if (hi <= lo) return (minX + maxX) * 0.5;
      return Math.max(lo, Math.min(hi, xx));
    }
    function hitAt(cx, base) {
      const cy = base - h * 0.5;
      for (let i = 0; i < labels.length; i++) {
        const L = labels[i];
        if (Math.abs(cx - L.x) < (w + L.w) * 0.5 && Math.abs(cy - L.y) < (h + L.h) * 0.5 + pad) {
          return L;
        }
      }
      for (let i = 0; i < bodies.length; i++) {
        const B = bodies[i];
        if (Math.abs(cx - B.x) < (w + B.w) * 0.5 && Math.abs(cy - B.y) < (h + B.h) * 0.5) {
          return B;
        }
      }
      return null;
    }
    let xx = clampX(x);
    let yy = y;
    let fade = 1;
    const minBase = ceil + h;
    const cap = far > 0 ? y - far : minBase;
    const farBase = Math.max(minBase, cap);
    const nudge = Math.max(36, Math.round(w * 0.7));
    const pad = gap > 0 ? gap : 4;
    function slide(base) {
      const stepW = Math.max(nudge, w * 1.1);
      for (let step = 1; step <= 6; step++) {
        const dirs = step % 2 ? [1, -1] : [-1, 1];
        for (let d = 0; d < dirs.length; d++) {
          const nx = clampX(x + dirs[d] * stepW * step);
          if (Math.abs(nx - xx) < 6) continue;
          if (!hitAt(nx, base)) return nx;
        }
      }
      return null;
    }
    for (let n = 0; n < 4; n++) {
      if (!hitAt(xx, yy)) break;
      const side = slide(yy);
      if (side != null) { xx = side; break; }
      const one = yy - (h + pad);
      const up = Math.max(farBase, one);
      if (up < yy - 1) { yy = up; continue; }
      fade = 0.45;
      break;
    }
    if (yy < farBase) yy = farBase;
    if (yy < minBase) yy = minBase;
    xx = clampX(xx);
    const left = hitAt(xx, yy);
    if (left && !left.name) fade = 0;
    else if (left) fade = Math.min(fade, 0.45);
    const lead = fade > 0 && yy < y - Math.max(6, pad * 0.5);
    labels.push({ x: xx, y: yy - h * 0.5, w: w, h: h });
    return { x: xx, y: yy, fade: fade, lead: lead };
  }

  function drawStatus(ctx, u, by) {
    const marks = [];
    if (u.bleed && u.bleed.t > 0) marks.push("#7dce6a");
    if ((u.stun || 0) > 0) marks.push("#f2d15a");
    if ((u.shield || 0) > 0) marks.push("#8eb6e8");
    if ((u.buff || 0) > 0) marks.push("#f4ecdf");
    if ((u.rage || 0) > 0) marks.push("#e07048");
    if (!marks.length) return;
    const x0 = u.x + 12;
    for (let i = 0; i < marks.length; i++) {
      ctx.fillStyle = marks[i];
      ctx.beginPath();
      ctx.arc(x0 + i * 5, by + 1.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function noteOverlap(fx, match, bodyW, bodyH) {
    const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
    let worst = 0;
    const live = [];
    for (let i = 0; i < match.units.length; i++) if (match.units[i].hp > 0) live.push(match.units[i]);
    for (let i = 0; i < live.length; i++) {
      const a = live[i];
      const ay = a.y - (a.z || 0);
      for (let j = i + 1; j < live.length; j++) {
        const b = live[j];
        const by = b.y - (b.z || 0);
        const ow = bodyW - Math.abs(a.x - b.x);
        const oh = bodyH - Math.abs(ay - by);
        if (ow <= 0 || oh <= 0) continue;
        const frac = (ow * oh) / (bodyW * bodyH);
        if (frac > worst) worst = frac;
      }
    }
    if (!fx._olapAt) fx._olapAt = now;
    const dt = Math.min(0.1, (now - fx._olapAt) / 1000);
    fx._olapAt = now;
    if (worst > 0.3) fx.overlapHold = (fx.overlapHold || 0) + dt;
    else fx.overlapHold = 0;
    if ((fx.overlapHold || 0) > (fx.overlapWorst || 0)) fx.overlapWorst = fx.overlapHold;
    IL.pitOverlap = { hold: fx.overlapHold || 0, worst: fx.overlapWorst || 0, frac: worst };
  }

  function drawArena(ctx, match, fx) {
    const canvas = ctx.canvas;
    const view = fitArena(canvas);
    const cam = updateCam(match, fx, view);
    IL.pitTurn = !!cam.portrait;
    IL.pitCam = { viewW: cam.viewW, viewH: cam.viewH, cssW: view.cssW, cssH: view.cssH, scale: cam.spriteScale, portrait: !!cam.portrait };
    IL.pitFloor = { l: cam.ox, t: cam.oy, w: cam.drawW, h: cam.drawH, r: cam.ox + cam.drawW, b: cam.oy + cam.drawH };
    IL.pitScale = cam.spriteScale;
    IL.pitSpawn = (match && typeof match.spawnSpread === "number") ? match.spawnSpread : 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    const shake = (fx.shake || 0) * SHAKE_SCALE;
    let shx = 0;
    let shy = 0;
    if (shake > 0.2 * SHAKE_SCALE) {
      shx = Math.sin(fx.t * 48) * shake * view.dpr;
      shy = Math.cos(fx.t * 37) * shake * 0.65 * view.dpr;
    }
    const d = view.dpr;
    const s = cam.spriteScale;
    if (cam.portrait) ctx.setTransform(0, d * s, d * s, 0, d * cam.ox + shx, d * cam.oy + shy);
    else ctx.setTransform(d * s, 0, 0, d * s, d * cam.ox + shx, d * cam.oy + shy);
    ctx.imageSmoothingEnabled = false;

    drawPit(ctx, fx, match);

    for (let i = 0; i < match.units.length; i++) drawCast(ctx, match.units[i], fx);
    for (let i = 0; i < match.units.length; i++) {
      if (match.units[i].state === "dash" || match.units[i].state === "roll") drawTrail(ctx, match.units[i]);
    }
    drawSprites(ctx, fx.sprites, true);
    drawSigs(ctx, fx, true);

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
    const bodyH = (IL.BODY_H || 30);
    const bodyW = 20;
    IL.pitBoxes = [];
    IL.pitLabels = [];
    IL.pitBodies = [];
    let focus = null;
    let focusD = 1e9;
    const ptr = fx.pointer;
    const ptrWorld = ptr ? cssToWorld(ptr.x, ptr.y, cam) : null;
    for (let i = 0; i < order.length; i++) {
      const u = order[i];
      const x = u.x;
      const y = u.y;
      const z = u.z || 0;
      const gy = y - z;
      const lift = z > 2 ? Math.max(0.45, 1 - z / 180) : 1;
      ctx.fillStyle = "rgba(0,0,0," + (0.28 + 0.16 * lift) + ")";
      ctx.beginPath();
      ctx.ellipse(x, y + 2, (u.hp > 0 ? 8 : 12) * lift, 3.5 * lift, 0, 0, Math.PI * 2);
      ctx.fill();
      if (u.iframe > 0 && u.hp > 0) {
        ctx.strokeStyle = "rgba(214, 186, 255, 0.55)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x, y + 2, 10, 4, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      const frame = IL.frameIndex(u.anim || "idle", u.animT || 0);
      if (u.sprite) {
        const hint = (u.state === "attack" || u.state === "cast") ? u.motion : null;
        const bodyScale = u.giant ? SCALE * 1.15 : SCALE;
        IL.hero.draw(ctx, u.sprite, frame, x, gy, bodyScale, u.facing, u.cls, hint, u.weaponKind);
        if (u.flash > 0 && u.hp > 0) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = Math.min(0.85, u.flash * 5);
          IL.hero.draw(ctx, u.sprite, frame, x, gy, bodyScale, u.facing, u.cls, hint, u.weaponKind);
          ctx.restore();
        }
      } else {
        ctx.fillStyle = u.team === 0 ? "#c4622d" : "#7f93b8";
        ctx.beginPath();
        ctx.arc(x, gy - 14, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      drawBlock(ctx, u, fx);
      if (u.hp > 0) {
        const bh = bodyH * (u.giant ? 1.15 : 1);
        const bw = bodyW * (u.giant ? 1.15 : 1);
        const foot = worldToCss(x, gy, cam);
        const box = {
          name: u.name,
          role: u.role || "",
          l: foot.x - (bw * s) / 2,
          t: foot.y - bh * s,
          r: foot.x + (bw * s) / 2,
          b: foot.y
        };
        IL.pitBoxes.push(box);
        IL.pitBodies.push(box);
        const barW = 18;
        const bx = Math.round(x - barW / 2);
        const by = Math.round(gy - bh - 3);
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(bx - 1, by - 1, barW + 2, 4);
        ctx.fillStyle = u.team === 0 ? "#c4622d" : "#7f93b8";
        ctx.fillRect(bx, by, Math.max(0, barW * (u.hp / u.maxHp)), 2);
        drawStatus(ctx, u, by);
        if (u.state === "cast" && u.cast && u.cast.dur > 0) {
          const cp = Math.max(0, Math.min(1, u.cast.t / u.cast.dur));
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.fillRect(bx, by + 4, barW, 2);
          ctx.fillStyle = "#d7c4ff";
          ctx.fillRect(bx, by + 4, Math.max(0, barW * cp), 2);
        }
        if (ptrWorld) {
          const hit = Math.hypot(ptrWorld.x - x, ptrWorld.y - gy + bh * 0.5);
          if (hit < focusD && hit < 36) { focus = u; focusD = hit; }
        }
      }
    }

    drawSigs(ctx, fx, false);
    drawMarks(ctx, fx);
    for (let i = 0; i < match.shots.length; i++) drawShot(ctx, match.shots[i], fx.t || 0);
    drawSprites(ctx, fx.sprites, false);

    const numPx = Math.max(7, 11 / s);
    ctx.font = "bold " + numPx.toFixed(1) + "px Palatino, Georgia, serif";
    ctx.textAlign = "center";
    if (fx.nums) {
      for (let i = 0; i < fx.nums.length; i++) {
        const n = fx.nums[i];
        const a = Math.max(0, 1 - n.t / n.life);
        ctx.globalAlpha = a;
        ctx.fillStyle = n.heal ? "#b7d39a" : n.crit ? "#ffd27a" : n.dodge ? "#e6d4ff" : n.blocked ? "#d7d2ea" : "#fff6e8";
        const label = n.heal ? ("+" + n.n) : n.crit ? String(n.n) : n.dodge ? "slip" : n.blocked ? n.n + " guard" : String(n.n);
        if (n.crit) ctx.font = "bold " + Math.max(8, 13 / s).toFixed(1) + "px Palatino, Georgia, serif";
        ctx.fillText(label, n.x, n.y - n.t * 18);
        if (n.crit) ctx.font = "bold " + numPx.toFixed(1) + "px Palatino, Georgia, serif";
      }
    }
    ctx.globalAlpha = 1;
    noteOverlap(fx, match, bodyW, bodyH);
    IL.pitFocusId = focus ? focus.id : (fx.stickId || "");
    if (focus && ptr && ptr.stick) fx.stickId = focus.id;
    if (!ptr) IL.pitFocusId = fx.stickId || "";
    ctx.restore();
    IL.pitTurn = false;

    if (IL.pitFocusId) {
      let named = null;
      for (let i = 0; i < match.units.length; i++) {
        if (match.units[i].id === IL.pitFocusId && match.units[i].hp > 0) named = match.units[i];
      }
      if (named) {
        const foot = worldToCss(named.x, named.y - (named.z || 0), cam);
        ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
        ctx.font = "12px Palatino, Georgia, serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(8,6,4,0.92)";
        ctx.strokeText(named.name, foot.x, foot.y - bodyH * s - 8);
        ctx.fillStyle = "#f4ecdf";
        ctx.fillText(named.name, foot.x, foot.y - bodyH * s - 8);
      }
    }

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const vig = ctx.createRadialGradient(view.cssW / 2, view.cssH / 2, Math.min(view.cssW, view.cssH) * 0.28, view.cssW / 2, view.cssH / 2, Math.max(view.cssW, view.cssH) * 0.68);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(0.62, "rgba(0,0,0,0.08)");
    vig.addColorStop(1, "rgba(0,0,0,0.36)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, view.cssW, view.cssH);
    if ((match.zoom || 0) > 0.15) {
      ctx.fillStyle = "rgba(6,4,8," + (0.2 * Math.min(1, match.zoom)) + ")";
      ctx.fillRect(0, 0, view.cssW, view.cssH);
    }
    if (match.hazard === "fog") {
      ctx.fillStyle = "rgba(168, 176, 186, 0.22)";
      ctx.fillRect(0, 0, view.cssW, view.cssH);
    } else if (match.hazard === "fire") {
      ctx.fillStyle = "rgba(176, 52, 18, 0.16)";
      ctx.fillRect(0, view.cssH * 0.5, view.cssW, view.cssH * 0.5);
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
