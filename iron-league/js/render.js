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
     axis is vertical. Scale snaps to quarter steps. */
  function updateCam(match, fx, view) {
    const W = IL.WORLD;
    const portrait = view.cssH > view.cssW;
    const fw = portrait ? W.h : W.w;
    const fh = portrait ? W.w : W.h;
    const fit = Math.min(view.cssW / fw, view.cssH / fh);
    /* Quarter steps fill a laptop pit (1.75 at 1280x800 instead of 1.5).
       A short landscape phone may go under 1 rather than crop the walls. */
    const steps = [0.5, 0.625, 0.75, 0.875, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 4];
    let spriteScale = fit < steps[0] ? Math.max(0.25, fit) : steps[0];
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
    /* Pull the floor down so a 30px battler still reads on the grain. */
    g.save();
    g.globalCompositeOperation = "multiply";
    g.fillStyle = "#999999";
    g.fillRect(0, 0, 160, 160);
    g.restore();
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

  /* ---------- HD arena painter (v64) ----------
     Each pit is painted once per scale into an offscreen canvas at device
     resolution: the stands and crowd in the margins, stone walls, a
     detailed floor per theme, and soft light. drawPit blits it and adds
     only what moves: brazier fire, light flicker, and drifting motes. */
  const ART_M = 130;
  const artCache = {};

  function artRng(seed) {
    let a = (IL.hashStr ? IL.hashStr(seed) : 12345) >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hexRgb(hex) {
    const h = hex.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function shade(hex, k, a) {
    const c = hexRgb(hex);
    const f = function (v) { return Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)))); };
    return "rgba(" + f(c[0]) + "," + f(c[1]) + "," + f(c[2]) + "," + (a == null ? 1 : a) + ")";
  }

  const FLOOR = { l: 4, t: 10, r: 636, b: 350 };
  const WALL = 14;

  function paintGrain(g, rng, x0, y0, x1, y1, base, n, amp, size) {
    for (let i = 0; i < n; i++) {
      const x = x0 + rng() * (x1 - x0);
      const y = y0 + rng() * (y1 - y0);
      const k = (rng() - 0.5) * amp;
      g.fillStyle = shade(base, k, 0.35 + rng() * 0.45);
      const s = size * (0.4 + rng());
      g.fillRect(x, y, s, s * (0.6 + rng() * 0.6));
    }
  }

  function paintBlotches(g, rng, x0, y0, x1, y1, base, n, rMin, rMax, amp, alpha) {
    for (let i = 0; i < n; i++) {
      const x = x0 + rng() * (x1 - x0);
      const y = y0 + rng() * (y1 - y0);
      const r = rMin + rng() * (rMax - rMin);
      const k = (rng() - 0.5) * amp;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, shade(base, k, alpha));
      gr.addColorStop(1, shade(base, k, 0));
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(x, y, r, r * (0.55 + rng() * 0.5), rng() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }

  function crack(g, rng, x, y, len, color, width) {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x, y);
    let a = rng() * Math.PI * 2;
    for (let i = 0; i < 6; i++) {
      a += (rng() - 0.5) * 1.4;
      x += Math.cos(a) * len / 6;
      y += Math.sin(a) * len / 6;
      g.lineTo(x, y);
      if (rng() < 0.25) {
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a + 1.2) * len / 5, y + Math.sin(a + 1.2) * len / 5);
        g.moveTo(x, y);
      }
    }
    g.stroke();
  }

  function paintTiles(g, rng, pit, tw, th, jitter, bevel) {
    for (let y = FLOOR.t; y < FLOOR.b; y += th) {
      const off = (Math.floor((y - FLOOR.t) / th) % 2) * (tw / 2);
      for (let x = FLOOR.l - off; x < FLOOR.r; x += tw) {
        const k = (rng() - 0.5) * jitter;
        const x0 = x + 0.8, y0 = y + 0.8, w = tw - 1.6, h = th - 1.6;
        const gr = g.createLinearGradient(x0, y0, x0 + w, y0 + h);
        gr.addColorStop(0, shade(pit.floor, k + 0.08));
        gr.addColorStop(1, shade(pit.floor, k - 0.12));
        g.fillStyle = gr;
        g.fillRect(x0, y0, w, h);
        if (bevel) {
          g.fillStyle = shade(pit.lite, 0.1, 0.22);
          g.fillRect(x0, y0, w, 0.7);
          g.fillRect(x0, y0, 0.7, h);
          g.fillStyle = "rgba(0,0,0,0.35)";
          g.fillRect(x0, y0 + h - 0.7, w, 0.7);
          g.fillRect(x0 + w - 0.7, y0, 0.7, h);
        }
      }
    }
  }

  function paintFloor(g, pit, rng) {
    const L = FLOOR.l, T = FLOOR.t, R = FLOOR.r, B = FLOOR.b;
    g.save();
    g.beginPath();
    g.rect(L, T, R - L, B - T);
    g.clip();
    g.fillStyle = pit.floor;
    g.fillRect(L, T, R - L, B - T);
    if (pit.id === "sand") {
      paintBlotches(g, rng, L, T, R, B, pit.floor, 70, 20, 70, 0.5, 0.35);
      paintGrain(g, rng, L, T, R, B, pit.floor, 26000, 0.7, 0.9);
      g.strokeStyle = shade(pit.grain, 0, 0.18);
      g.lineWidth = 0.8;
      for (let r = 0; r < 26; r++) {
        g.beginPath();
        const y = T + 8 + r * 13;
        g.moveTo(L, y);
        for (let x = L; x <= R; x += 20) g.lineTo(x, y + Math.sin(x * 0.02 + r) * 4);
        g.stroke();
      }
      for (let i = 0; i < 140; i++) {
        const x = L + rng() * (R - L), y = T + rng() * (B - T), rr = 0.8 + rng() * 2.2;
        g.fillStyle = shade(pit.stone, (rng() - 0.5) * 0.4, 0.9);
        g.beginPath(); g.ellipse(x, y, rr * 1.3, rr, rng() * 3, 0, Math.PI * 2); g.fill();
        g.fillStyle = shade(pit.lite, 0.2, 0.5);
        g.beginPath(); g.ellipse(x - rr * 0.3, y - rr * 0.3, rr * 0.5, rr * 0.35, 0, 0, Math.PI * 2); g.fill();
      }
      for (let i = 0; i < 24; i++) {
        g.strokeStyle = "rgba(40,22,10,0.07)";
        g.lineWidth = 1.5 + rng() * 2;
        g.beginPath();
        const x = L + 40 + rng() * (R - L - 80), y = T + 30 + rng() * (B - T - 60);
        g.arc(x, y, 8 + rng() * 18, rng() * 6, rng() * 6 + 1.2);
        g.stroke();
      }
    } else if (pit.id === "frost") {
      paintTiles(g, rng, pit, 48, 40, 0.18, true);
      paintGrain(g, rng, L, T, R, B, pit.floor, 9000, 0.4, 0.7);
      g.lineCap = "round";
      for (let i = 0; i < 90; i++) {
        g.strokeStyle = "rgba(220,240,255," + (0.05 + rng() * 0.12) + ")";
        g.lineWidth = 0.6 + rng() * 2;
        const x = L + rng() * (R - L), y = T + rng() * (B - T);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + rng() * 50, y + (rng() - 0.5) * 10); g.stroke();
      }
      for (let i = 0; i < 18; i++) crack(g, rng, L + rng() * (R - L), T + rng() * (B - T), 30 + rng() * 50, "rgba(10,20,28,0.55)", 0.8);
      for (let i = 0; i < 18; i++) crack(g, rng, L + rng() * (R - L), T + rng() * (B - T), 24 + rng() * 40, "rgba(220,240,255,0.35)", 0.5);
      paintBlotches(g, rng, L, T, R, T + 18, "#f2f8ff", 50, 8, 18, 0.1, 0.26);
      paintBlotches(g, rng, L, B - 18, R, B, "#f2f8ff", 50, 8, 18, 0.1, 0.26);
    } else if (pit.id === "lava") {
      const cols = 16, rows = 9;
      const cw = (R - L) / cols, ch = (B - T) / rows;
      const pts = [];
      for (let r = 0; r <= rows; r++) {
        pts.push([]);
        for (let c = 0; c <= cols; c++) {
          const edge = r === 0 || c === 0 || r === rows || c === cols;
          pts[r].push([L + c * cw + (edge ? 0 : (rng() - 0.5) * cw * 0.7), T + r * ch + (edge ? 0 : (rng() - 0.5) * ch * 0.7)]);
        }
      }
      g.fillStyle = "#4a1306";
      g.fillRect(L, T, R - L, B - T);
      g.save();
      g.strokeStyle = "rgba(255,110,30,0.85)";
      g.shadowColor = "rgba(255,90,20,0.9)";
      g.shadowBlur = 6;
      g.lineWidth = 0.9;
      for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
          const p0 = pts[r][c];
          if (c < cols) { g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(pts[r][c + 1][0], pts[r][c + 1][1]); g.stroke(); }
          if (r < rows) { g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(pts[r + 1][c][0], pts[r + 1][c][1]); g.stroke(); }
        }
      }
      g.restore();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const p = [pts[r][c], pts[r][c + 1], pts[r + 1][c + 1], pts[r + 1][c]];
          const cx = (p[0][0] + p[2][0]) / 2, cy = (p[0][1] + p[2][1]) / 2;
          const inset = function (q) { return [q[0] + (cx - q[0]) * 0.035, q[1] + (cy - q[1]) * 0.035]; };
          const q = p.map(inset);
          const k = (rng() - 0.5) * 0.3;
          const gr = g.createLinearGradient(q[0][0], q[0][1], q[2][0], q[2][1]);
          gr.addColorStop(0, shade("#3a2620", k + 0.08));
          gr.addColorStop(1, shade("#1c120e", k));
          g.fillStyle = gr;
          g.beginPath();
          g.moveTo(q[0][0], q[0][1]);
          for (let i = 1; i < 4; i++) g.lineTo(q[i][0], q[i][1]);
          g.closePath();
          g.fill();
          g.strokeStyle = "rgba(255,170,90,0.10)";
          g.lineWidth = 0.6;
          g.stroke();
        }
      }
      paintGrain(g, rng, L, T, R, B, pit.floor, 8000, 0.6, 0.7);
      paintBlotches(g, rng, L, T, R, B, "#ff4a10", 26, 6, 18, 0.2, 0.25);
    } else if (pit.id === "night") {
      for (let y = T; y < B; y += 11) {
        const off = (Math.floor((y - T) / 11) % 2) * 7;
        for (let x = L - off; x < R; x += 14) {
          const w = 12 + rng() * 2, h = 9.5 + rng() * 1.2;
          const k = (rng() - 0.5) * 0.35;
          const gr = g.createRadialGradient(x + w * 0.35, y + h * 0.3, 0, x + w / 2, y + h / 2, w * 0.7);
          gr.addColorStop(0, shade(pit.lite, k + 0.15));
          gr.addColorStop(1, shade(pit.floor, k - 0.25));
          g.fillStyle = gr;
          g.beginPath();
          g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
      for (let i = 0; i < 60; i++) {
        g.strokeStyle = "rgba(224,190,140," + (0.04 + rng() * 0.08) + ")";
        g.lineWidth = 1 + rng() * 3;
        const x = L + rng() * (R - L), y = T + rng() * (B - T);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rng() - 0.5) * 6, y + 10 + rng() * 20); g.stroke();
      }
      paintBlotches(g, rng, L, T, R, B, "#0a0814", 24, 20, 50, 0.1, 0.4);
    } else {
      paintTiles(g, rng, pit, 44, 32, 0.25, true);
      paintGrain(g, rng, L, T, R, B, pit.floor, 12000, 0.6, 0.8);
      for (let i = 0; i < 26; i++) crack(g, rng, L + rng() * (R - L), T + rng() * (B - T), 26 + rng() * 40, "rgba(20,18,12,0.55)", 0.9);
      paintBlotches(g, rng, L, T, R, B, "#5a7a34", 60, 6, 22, 0.4, 0.45);
      for (let i = 0; i < 260; i++) {
        const x = L + rng() * (R - L);
        const y = rng() < 0.5 ? T + rng() * 26 : B - rng() * 26;
        g.strokeStyle = shade("#7aa040", (rng() - 0.5) * 0.4, 0.75);
        g.lineWidth = 0.6;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rng() - 0.5) * 3, y - 2 - rng() * 4); g.stroke();
      }
    }
    /* The center seal every pit shares: a ring of inlaid stone. */
    const cx = 320, cy = 180;
    const glow = "rgba(" + pit.glow + ",";
    g.strokeStyle = shade(pit.stone, -0.3, 0.9);
    g.lineWidth = 5;
    g.beginPath(); g.ellipse(cx, cy, 72, 46, 0, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = shade(pit.rail, 0, 0.55);
    g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(cx, cy, 72, 46, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.ellipse(cx, cy, 58, 37, 0, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * 58, cy + Math.sin(a) * 37);
      g.lineTo(cx + Math.cos(a) * 72, cy + Math.sin(a) * 46);
      g.stroke();
    }
    g.strokeStyle = glow + "0.35)";
    g.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 9);
      g.lineTo(cx + Math.cos(a + 0.4) * 44, cy + Math.sin(a + 0.4) * 28);
      g.stroke();
    }
    /* Ambient occlusion along the walls and a warm pool in the middle. */
    const ao = 30;
    [[L, T, R - L, ao, 0, T, 0, T + ao], [L, B - ao, R - L, ao, 0, B, 0, B - ao], [L, T, ao, B - T, L, 0, L + ao, 0], [R - ao, T, ao, B - T, R, 0, R - ao, 0]].forEach(function (q) {
      const gr = g.createLinearGradient(q[4], q[5], q[6], q[7]);
      gr.addColorStop(0, "rgba(0,0,0,0.55)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(q[0], q[1], q[2], q[3]);
    });
    const pool = g.createRadialGradient(cx, cy, 20, cx, cy, 330);
    pool.addColorStop(0, glow + "0.10)");
    pool.addColorStop(0.6, "rgba(0,0,0,0)");
    pool.addColorStop(1, "rgba(0,0,0,0.35)");
    g.fillStyle = pool;
    g.fillRect(L, T, R - L, B - T);
    g.restore();
  }

  function paintWalls(g, pit, rng) {
    const o = WALL;
    const L = FLOOR.l - o, T = FLOOR.t - o, R = FLOOR.r + o, B = FLOOR.b + o;
    function blocks(x0, y0, w, h, horiz) {
      const bl = 16;
      if (horiz) {
        for (let row = 0; row < 2; row++) {
          const yy = y0 + row * (h / 2);
          const off = row * bl / 2;
          for (let x = x0 - off; x < x0 + w; x += bl) {
            const k = (rng() - 0.5) * 0.25;
            const gr = g.createLinearGradient(0, yy, 0, yy + h / 2);
            gr.addColorStop(0, shade(pit.stone, k + 0.12));
            gr.addColorStop(1, shade(pit.wall, k - 0.1));
            g.fillStyle = gr;
            g.fillRect(Math.max(x0, x) + 0.4, yy + 0.4, Math.min(bl, x0 + w - x) - 0.8, h / 2 - 0.8);
          }
        }
      } else {
        for (let col = 0; col < 2; col++) {
          const xx = x0 + col * (w / 2);
          const off = col * bl / 2;
          for (let y = y0 - off; y < y0 + h; y += bl) {
            const k = (rng() - 0.5) * 0.25;
            const gr = g.createLinearGradient(xx, 0, xx + w / 2, 0);
            gr.addColorStop(0, shade(pit.stone, k + 0.1));
            gr.addColorStop(1, shade(pit.wall, k - 0.1));
            g.fillStyle = gr;
            g.fillRect(xx + 0.4, Math.max(y0, y) + 0.4, w / 2 - 0.8, Math.min(bl, y0 + h - y) - 0.8);
          }
        }
      }
    }
    g.fillStyle = shade(pit.wall, -0.5);
    g.fillRect(L - 2, T - 2, R - L + 4, B - T + 4);
    blocks(L, T, R - L, o, true);
    blocks(L, B - o, R - L, o, true);
    blocks(L, T + o, o, B - T - 2 * o, false);
    blocks(R - o, T + o, o, B - T - 2 * o, false);
    /* Coping: a lit rail along the inner edge. */
    g.strokeStyle = shade(pit.rail, 0, 0.9);
    g.lineWidth = 1.6;
    g.strokeRect(FLOOR.l - 1, FLOOR.t - 1, FLOOR.r - FLOOR.l + 2, FLOOR.b - FLOOR.t + 2);
    g.strokeStyle = "rgba(0,0,0,0.6)";
    g.lineWidth = 1;
    g.strokeRect(L, T, R - L, B - T);
    /* Corner towers with brazier bowls. */
    [[L, T], [R, T], [L, B], [R, B]].forEach(function (c) {
      const gr = g.createLinearGradient(c[0] - 14, c[1] - 14, c[0] + 14, c[1] + 14);
      gr.addColorStop(0, shade(pit.stone, 0.18));
      gr.addColorStop(1, shade(pit.wall, -0.2));
      g.fillStyle = gr;
      g.fillRect(c[0] - 15, c[1] - 15, 30, 30);
      g.strokeStyle = shade(pit.rail, 0, 0.8);
      g.lineWidth = 1.2;
      g.strokeRect(c[0] - 15, c[1] - 15, 30, 30);
      g.fillStyle = "#1a1310";
      g.beginPath(); g.ellipse(c[0], c[1], 8, 6, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = shade(pit.rail, -0.1, 1);
      g.stroke();
    });
    /* Banners along the top and bottom walls. */
    const cloths = pit.cloth;
    for (let i = 0; i < 10; i++) {
      [T, B - o].forEach(function (yy, side) {
        const x = L + 40 + i * ((R - L - 80) / 9) - 6;
        const col = cloths[(i + side) % cloths.length];
        const gr = g.createLinearGradient(x, 0, x + 12, 0);
        gr.addColorStop(0, shade(col, -0.25));
        gr.addColorStop(0.5, shade(col, 0.2));
        gr.addColorStop(1, shade(col, -0.3));
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(x, yy + 1);
        g.lineTo(x + 12, yy + 1);
        g.lineTo(x + 12, yy + o + 4);
        g.lineTo(x + 6, yy + o + 1);
        g.lineTo(x, yy + o + 4);
        g.closePath();
        g.fill();
        g.fillStyle = shade(pit.rail, 0.1, 0.8);
        g.fillRect(x, yy + 1, 12, 1.2);
        g.beginPath(); g.arc(x + 6, yy + o * 0.5, 2, 0, Math.PI * 2); g.fill();
      });
    }
  }

  function paintStands(g, pit, rng, X0, Y0, X1, Y1) {
    const sky = g.createLinearGradient(0, Y0, 0, Y1);
    sky.addColorStop(0, pit.sky[0]);
    sky.addColorStop(1, pit.sky[1]);
    g.fillStyle = sky;
    g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    const skins = ["#f1c9a5", "#d9a77c", "#b97f58", "#8a5a3c", "#5e3c28"];
    const L = FLOOR.l - WALL, T = FLOOR.t - WALL, R = FLOOR.r + WALL, B = FLOOR.b + WALL;
    function tier(x0, y0, x1, y1, depth, horiz) {
      const n = 5;
      for (let i = 0; i < n; i++) {
        const k = i / n;
        const dark = -0.2 - k * 0.45;
        g.fillStyle = shade(pit.stone, dark);
        if (horiz) {
          const yy = y0 + (y1 - y0) * k;
          g.fillRect(x0, yy, x1 - x0, (y1 - y0) / n - 1);
          g.fillStyle = shade(pit.rail, dark, 0.35);
          g.fillRect(x0, yy, x1 - x0, 0.8);
        } else {
          const xx = x0 + (x1 - x0) * k;
          g.fillRect(xx, y0, (x1 - x0) / n - 1, y1 - y0);
        }
      }
      /* Seat the crowd in rows: shoulders, then heads, shading by distance. */
      const step = 7;
      const along = horiz ? x1 - x0 : y1 - y0;
      const across = horiz ? y1 - y0 : x1 - x0;
      const rowsN = Math.max(1, Math.floor(Math.abs(across) / step));
      for (let r = 0; r < rowsN; r++) {
        const near = horiz ? (y0 < T ? rowsN - 1 - r : r) : (x0 < L ? rowsN - 1 - r : r);
        const far = near / Math.max(1, rowsN - 1);
        const dim = -0.25 - far * 0.5;
        const seats = Math.floor(Math.abs(along) / 6.2);
        for (let i = 0; i < seats; i++) {
          if (rng() < 0.12) continue;
          const a = (horiz ? x0 : y0) + (i + 0.5 + (rng() - 0.5) * 0.4) * 6.2;
          const b = (horiz ? y0 : x0) + (r + 0.6) * step + (rng() - 0.5) * 1.2;
          const x = horiz ? a : b;
          const y = horiz ? b : a;
          const cloth = rng() < 0.75 ? pit.cloth[Math.floor(rng() * pit.cloth.length)] : ["#6a3a2a", "#2e4060", "#6a5a2a", "#3a5a3a", "#4a2a5a"][Math.floor(rng() * 5)];
          g.fillStyle = shade(cloth, dim);
          g.beginPath(); g.ellipse(x, y + 2.4, 2.9, 2.3, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = shade(skins[Math.floor(rng() * skins.length)], dim - 0.05);
          g.beginPath(); g.arc(x, y - 0.6, 1.7, 0, Math.PI * 2); g.fill();
          if (rng() < 0.04) {
            g.fillStyle = shade(pit.cloth[Math.floor(rng() * pit.cloth.length)], 0.15 + dim);
            g.fillRect(x - 0.35, y - 8, 0.7, 6.5);
            g.fillRect(x, y - 8, 4.5, 2.8);
          }
        }
      }
    }
    tier(X0, Y0, X1, T - 2, 1, true);
    tier(X0, B + 2, X1, Y1, 1, true);
    tier(X0, T, L - 2, B, 1, false);
    tier(R + 2, T, X1, B, 1, false);
    /* Awnings over the top stand. */
    for (let x = X0; x < X1; x += 18) {
      g.fillStyle = (Math.floor((x - X0) / 18) % 2) ? shade(pit.cloth[0], -0.1, 0.85) : "rgba(230,214,190,0.75)";
      g.beginPath();
      g.moveTo(x, Y0);
      g.lineTo(x + 18, Y0);
      g.lineTo(x + 18, Y0 + 14);
      g.quadraticCurveTo(x + 9, Y0 + 20, x, Y0 + 14);
      g.closePath();
      g.fill();
    }
  }

  function arenaArt(pit, cw, ch, mat) {
    const key = pit.id + "@" + cw + "x" + ch + ":" + mat.join(",");
    if (artCache[key]) return artCache[key];
    if (typeof document === "undefined") return null;
    const W = IL.WORLD;
    const X0 = -ART_M, Y0 = -ART_M, X1 = W.w + ART_M, Y1 = W.h + ART_M;
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const g = c.getContext("2d");
    g.setTransform(mat[0], mat[1], mat[2], mat[3], mat[4], mat[5]);
    g.imageSmoothingEnabled = true;
    const rng = artRng("pit:" + pit.id);
    paintStands(g, pit, rng, X0, Y0, X1, Y1);
    paintWalls(g, pit, rng);
    paintFloor(g, pit, rng);
    /* v69: wash the floor toward its base color so cracks and rings read
       as texture, not as attacks, and fighters stand out. */
    g.save();
    g.globalAlpha = 0.36;
    g.fillStyle = pit.floor;
    g.fillRect(FLOOR.l, FLOOR.t, FLOOR.r - FLOOR.l, FLOOR.b - FLOOR.t);
    g.restore();
    const art = { canvas: c };
    Object.keys(artCache).forEach(function (old) { delete artCache[old]; });
    artCache[key] = art;
    return art;
  }

  /* Glow sprites, painted once per pit: a light pool and a flame core. */
  const glowCache = {};
  function glowSprite(pit, kind) {
    const key = pit.id + ":" + kind;
    if (glowCache[key]) return glowCache[key];
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    if (kind === "pool") {
      gr.addColorStop(0, "rgba(" + pit.glow + ",0.32)");
      gr.addColorStop(0.4, "rgba(" + pit.glow + ",0.10)");
      gr.addColorStop(1, "rgba(" + pit.glow + ",0)");
    } else {
      gr.addColorStop(0, "rgba(255,250,220,0.95)");
      gr.addColorStop(0.35, "rgba(" + pit.glow + ",0.6)");
      gr.addColorStop(1, "rgba(" + pit.glow + ",0)");
    }
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    glowCache[key] = c;
    return c;
  }

  function drawArenaLive(ctx, pit, fx, match) {
    const t = fx.t || 0;
    const L = FLOOR.l - WALL, T = FLOOR.t - WALL, R = FLOOR.r + WALL, B = FLOOR.b + WALL;
    const pool = glowSprite(pit, "pool");
    const flame = glowSprite(pit, "flame");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    [[L, T, 0], [R, T, 1.3], [L, B, 0.7], [R, B, 2.1]].forEach(function (c) {
      const fl = 0.8 + 0.2 * Math.sin(t * 9 + c[2] * 3) + 0.08 * Math.sin(t * 23 + c[2]);
      if (pool) {
        const r = 120 * fl;
        ctx.drawImage(pool, c[0] - r, c[1] - r, r * 2, r * 2);
      }
      if (flame) {
        for (let i = 0; i < 2; i++) {
          const h = (11 + i * 4) * fl + Math.sin(t * 13 + i + c[2]) * 2;
          ctx.drawImage(flame, c[0] - h * 0.5 + Math.sin(t * 7 + i) * 1.2, c[1] - h * 1.3, h, h * 1.6);
        }
      }
    });
    if (IL.fx && IL.fx.ready && IL.fx.ready()) {
      [[L, T], [R, T], [L, B], [R, B]].forEach(function (c, i) {
        IL.fx.drawLoop(ctx, "spark", c[0], c[1] - 10, 46, t + i * 0.37, { alpha: 0.8 });
      });
    }
    if (pit.id === "lava") {
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
      ctx.fillStyle = "rgba(255,90,20," + (0.04 + 0.05 * pulse) + ")";
      ctx.fillRect(FLOOR.l, FLOOR.t, FLOOR.r - FLOOR.l, FLOOR.b - FLOOR.t);
    }
    ctx.restore();
    /* Drifting motes: dust, snow, embers, fireflies, leaves. */
    const n = 46;
    for (let i = 0; i < n; i++) {
      const seed = i * 97.13;
      let x, y, a, r;
      if (pit.id === "frost") {
        x = (seed * 7.1 + t * (8 + (i % 5) * 3)) % 680 - 20;
        y = (seed * 3.3 + t * (14 + (i % 4) * 5)) % 400 - 20;
        r = 0.8 + (i % 3) * 0.5; a = 0.5;
        ctx.fillStyle = "rgba(240,248,255," + a + ")";
      } else if (pit.id === "lava") {
        x = (seed * 5.7 + Math.sin(t + i) * 10) % 640;
        y = 360 - ((seed * 2.9 + t * (18 + (i % 5) * 6)) % 380);
        r = 0.7 + (i % 3) * 0.4; a = 0.8;
        ctx.fillStyle = "rgba(255," + (120 + (i % 4) * 30) + ",40," + a + ")";
      } else if (pit.id === "night") {
        x = (seed * 5.3) % 640 + Math.sin(t * 0.7 + i) * 18;
        y = (seed * 3.7) % 360 + Math.cos(t * 0.9 + i * 1.3) * 12;
        r = 1 + (i % 2) * 0.6; a = 0.35 + 0.35 * Math.sin(t * 3 + i);
        ctx.fillStyle = "rgba(255,226,150," + Math.max(0, a) + ")";
      } else if (pit.id === "temple") {
        x = (seed * 6.1 + t * (10 + (i % 3) * 4)) % 680 - 20;
        y = (seed * 2.3 + t * (6 + (i % 4) * 3) + Math.sin(t + i) * 6) % 400 - 20;
        r = 1.2; a = 0.45;
        ctx.fillStyle = "rgba(170,200,100," + a + ")";
      } else {
        x = (seed * 6.7 + t * (12 + (i % 4) * 4)) % 680 - 20;
        y = (seed * 3.1 + Math.sin(t * 0.6 + i) * 20) % 360;
        r = 0.7; a = 0.3;
        ctx.fillStyle = "rgba(230,200,150," + a + ")";
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
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

    const mat = fx.worldMat;
    const art = mat ? arenaArt(pit, ctx.canvas.width, ctx.canvas.height, mat) : null;
    if (art) {
      /* A 1:1 copy in device pixels: no resampling per frame. */
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, fx.shx || 0, fx.shy || 0);
      ctx.drawImage(art.canvas, 0, 0);
      ctx.restore();
      drawArenaLive(ctx, pit, fx, match);
      return;
    }
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

  /* v68: casts mark the floor with one thin circle (pfx.drawTelegraph):
     cool blue for your side, red for theirs. */
  function drawCast(ctx, u, fx) {
    if (!u.cast || !IL.pfx) return;
    IL.pfx.drawTelegraph(ctx, u, fx, u.team === 0 ? "130,210,255" : "255,92,70");
  }

  /* v69 wind-up: a glint gathers on the weapon before the swing lands,
     so every hit has a beat of warning, as in Eslabong. */
  function drawWindup(ctx, u, gy, cam, fx) {
    const p = Math.min(1, (u.animT || 0) / 0.22);
    const f = u.facing || 1;
    const ox = f * 9;
    const oy = -20;
    const wx = cam.portrait ? u.x + oy : u.x + ox;
    const wy = cam.portrait ? gy + ox : gy + oy;
    const r = 1.5 + p * 3.5;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255,250,230," + (0.35 + 0.6 * p) + ")";
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + (fx.t || 0) * 3;
      const rr = i % 2 ? r * 0.28 : r;
      if (i === 0) ctx.moveTo(wx + Math.cos(a) * rr, wy + Math.sin(a) * rr);
      else ctx.lineTo(wx + Math.cos(a) * rr, wy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawBlock(ctx, u, fx) {
    if (u.state !== "block" || u.hp <= 0) return;
    const pulse = 0.55 + 0.45 * Math.sin((fx.t || 0) * 11);
    ctx.save();
    ctx.translate(u.x, u.y - 22);
    ctx.rotate(u.facing > 0 ? 0 : Math.PI);
    ctx.strokeStyle = "rgba(186, 214, 255," + (0.35 + pulse * 0.4) + ")";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(6, 0, 16 + pulse * 2, -1.1, 1.1);
    ctx.stroke();
    ctx.restore();
  }

  /* Projectiles: a soft streak behind, then the body. Arrows are a
     vector shaft and head at sprite scale; spells are glowing orbs. */
  function drawShot(ctx, p, time) {
    const ang = Math.atan2(p.vy, p.vx);
    const sp = Math.hypot(p.vx, p.vy) || 1;
    const ux = p.vx / sp;
    const uy = p.vy / sp;
    const spell = !!(p.spell || p.bolt);
    const rgb = spell ? (SCHOOL_RGB[String(p.spell || "").replace(/^spell_|_impact$/g, "")] || SCHOOL_RGB.arcane)
      : p.bullet ? "255,236,180" : (p.team === 0 ? "255,200,130" : "190,215,255");
    const tail = Math.min(46, sp * 0.07);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createLinearGradient(p.x, p.y, p.x - ux * tail, p.y - uy * tail);
    g.addColorStop(0, "rgba(" + rgb + ",0.75)");
    g.addColorStop(1, "rgba(" + rgb + ",0)");
    ctx.strokeStyle = g;
    ctx.lineCap = "round";
    ctx.lineWidth = spell ? 5 : 2.2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - ux * tail, p.y - uy * tail);
    ctx.stroke();
    if (spell) {
      const r = 9 + Math.sin(time * 30) * 1.2;
      const og = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 1.8);
      og.addColorStop(0, "rgba(255,255,255,0.95)");
      og.addColorStop(0.3, "rgba(" + rgb + ",0.85)");
      og.addColorStop(1, "rgba(" + rgb + ",0)");
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 1.8, 0, Math.PI * 2);
      ctx.fill();
      const tr = p.trail || [];
      for (let i = 0; i < tr.length; i++) {
        const k = i / tr.length;
        ctx.fillStyle = "rgba(" + rgb + "," + (0.35 * k) + ")";
        ctx.beginPath();
        ctx.arc(tr[i].x, tr[i].y, 1.5 + 3 * k, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    if (spell) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    if (p.bullet) {
      ctx.fillStyle = "#fff6dc";
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.4, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.strokeStyle = "#cfa673";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(4, 0);
    ctx.stroke();
    ctx.fillStyle = "#e9eef5";
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(3, -2.4);
    ctx.lineTo(3, 2.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = p.team === 0 ? "#e07a3a" : "#7f9fd0";
    ctx.beginPath();
    ctx.moveTo(-9, 0); ctx.lineTo(-12, -2.6); ctx.lineTo(-7, 0); ctx.lineTo(-12, 2.6); ctx.closePath();
    ctx.fill();
    ctx.restore();
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

  /* Spell colors for projectiles. Hit, cast and death effects live in
     pfx.js (v68); the v64 arcs, rings and sprite-strip overlays are gone. */
  const SCHOOL_RGB = {
    fire: "255,138,48", ice: "140,220,255", lightning: "255,240,150", shadow: "190,120,255",
    holy: "255,226,140", nature: "150,236,110", poison: "180,240,80", arcane: "214,170,255"
  };
  /* ---------- screen-space overheads (v64) ----------
     Health bars and damage numbers draw after the world transform, in
     CSS pixels, so a turned phone floor never mirrors the text and the
     bar keeps one size at every pit scale. Allies are green, foes red;
     a pale strip trails recent damage. No cast or cooldown bar. */
  const UI_FONT = "Avenir Next, Segoe UI, Helvetica Neue, Arial, sans-serif";

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* Ability icons for the overhead pop (Eslabong shows the move's icon
     over the caster's head instead of its name). */
  const abilityImgs = {};
  function abilityImg(id) {
    if (!id || typeof Image === "undefined" || !IL.abilityIcon) return null;
    if (abilityImgs[id] !== undefined) return abilityImgs[id];
    const src = IL.abilityIcon(id);
    if (!src) { abilityImgs[id] = null; return null; }
    const img = new Image();
    img.src = src;
    abilityImgs[id] = img;
    return img;
  }

  /* v69 overheads: one bar per fighter, no level badge (Info has levels).
     Bars that would overlap in a clump step up a row. Status effects are
     small glyphs to the right; a fresh ability shows its icon above. */
  function drawOverheads(ctx, heads, cam, fx, match) {
    const s = cam.spriteScale || 1;
    if (!fx.hpLag) fx.hpLag = {};
    const dt = fx.dtLast || 1 / 60;
    const placed = [];
    const list = heads.slice().sort(function (a, b) { return b.gy - a.gy; });
    for (let i = 0; i < list.length; i++) {
      const h = list[i];
      const u = h.u;
      if (u.hp <= 0) continue;
      const foot = worldToCss(h.x, h.gy, cam);
      const big = u.boss ? 1.5 : 1;
      const w = Math.round(Math.max(28, Math.min(56, 26 * s)) * big);
      const hh = s >= 1.5 ? 5 : 4;
      const x = Math.round(foot.x - w / 2);
      let y = Math.round(foot.y - h.bh * s - hh - 6);
      for (let k = 0; k < 3; k++) {
        let clash = false;
        for (let q = 0; q < placed.length; q++) {
          const o = placed[q];
          if (Math.abs(o.x - x) < (w + o.w) / 2 + 2 && Math.abs(o.y - y) < hh + 4) { clash = true; break; }
        }
        if (!clash) break;
        y -= hh + 5;
      }
      placed.push({ x: x, y: y, w: w });
      const frac = Math.max(0, Math.min(1, u.hp / u.maxHp));
      const key = u.id + ":" + u.team;
      let lag = fx.hpLag[key];
      if (lag == null || lag < frac) lag = frac;
      else lag = Math.max(frac, lag - dt * 0.55);
      fx.hpLag[key] = lag;
      ctx.fillStyle = "rgba(6,4,3,0.82)";
      roundRect(ctx, x - 1.5, y - 1.5, w + 3, hh + 3, 2);
      ctx.fill();
      if (lag > frac) {
        ctx.fillStyle = "rgba(255,236,200,0.75)";
        ctx.fillRect(x, y, w * lag, hh);
      }
      const ally = u.team === 0;
      const grad = ctx.createLinearGradient(0, y, 0, y + hh);
      if (ally) { grad.addColorStop(0, "#9be86f"); grad.addColorStop(1, "#3f9a3a"); }
      else { grad.addColorStop(0, "#ff7a62"); grad.addColorStop(1, "#b02b22"); }
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w * frac, hh);
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(x, y, w * frac, 1);
      /* A tick every 100 health, so a tank's bar reads thicker. */
      const ticks = Math.floor(u.maxHp / 100);
      if (ticks > 0 && ticks < 40) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        for (let k = 1; k <= ticks; k++) {
          const tx = x + w * (k * 100 / u.maxHp);
          if (tx < x + w - 1) ctx.fillRect(Math.round(tx), y, 1, hh);
        }
      }
      if ((u.shield || 0) > 0) {
        ctx.fillStyle = "rgba(220,236,255,0.9)";
        ctx.fillRect(x, y - 2.5, w * Math.min(1, u.shield / u.maxHp), 1.5);
      }
      drawStatusCss(ctx, u, x + w + 6, y + hh / 2, fx.t || 0);
      drawAbilityPop(ctx, u, foot.x, y - 4);
    }
    ctx.textBaseline = "alphabetic";
  }

  /* The move's icon in a dark frame, popping in and fading out, with a
     thin bar under it: cast progress while chanting, else time left. */
  function drawAbilityPop(ctx, u, cx, bottom) {
    const b = u.banner;
    if (!b || !b.id) return;
    const img = abilityImg(b.id);
    const p = b.life > 0 ? Math.min(1, b.t / b.life) : 1;
    const pop = p < 0.12 ? 0.7 + (p / 0.12) * 0.3 : 1;
    const a = p < 0.8 ? 1 : Math.max(0, 1 - (p - 0.8) / 0.2);
    const size = Math.round(18 * pop);
    const x = Math.round(cx - size / 2);
    const y = Math.round(bottom - size - 4);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(8,6,4,0.85)";
    roundRect(ctx, x - 2, y - 2, size + 4, size + 4, 3);
    ctx.fill();
    ctx.strokeStyle = b.ult ? "rgba(255,206,92,0.95)" : u.team === 0 ? "rgba(155,232,111,0.8)" : "rgba(255,122,98,0.8)";
    ctx.lineWidth = 1;
    ctx.stroke();
    if (img && img.complete && img.naturalWidth) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, x, y, size, size);
    } else {
      ctx.fillStyle = "#f4ecdf";
      ctx.font = "700 10px " + UI_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(b.name || "?").charAt(0), x + size / 2, y + size / 2 + 0.5);
    }
    const prog = u.cast && u.cast.dur ? Math.min(1, u.cast.t / u.cast.dur) : 1 - p;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(x, y + size + 1, size, 2);
    ctx.fillStyle = "rgba(150,210,255,0.95)";
    ctx.fillRect(x, y + size + 1, size * prog, 2);
    ctx.restore();
  }

  /* Status glyphs, 7 css px: stun stars, slow snowflake, bleed drop,
     buff arrow, rage flame, vulnerable cracked shield. */
  function drawStatusCss(ctx, u, x0, cy, t) {
    const marks = [];
    if ((u.stun || 0) > 0) marks.push("stun");
    if ((u.slow || 0) > 0) marks.push("slow");
    if (u.bleed && u.bleed.t > 0) marks.push("bleed");
    if ((u.buff || 0) > 0) marks.push("buff");
    if ((u.rage || 0) > 0) marks.push("rage");
    if ((u.vuln || 0) > 0) marks.push("vuln");
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < marks.length; i++) {
      const x = x0 + i * 10;
      const y = cy;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.beginPath();
      ctx.arc(x, y, 4.6, 0, Math.PI * 2);
      ctx.fill();
      const k = marks[i];
      if (k === "stun") {
        ctx.fillStyle = "#ffe066";
        for (let j = 0; j < 2; j++) {
          const a = t * 6 + j * Math.PI;
          star(ctx, x + Math.cos(a) * 2, y + Math.sin(a) * 1.2, 1.8);
        }
      } else if (k === "slow") {
        ctx.strokeStyle = "#a8e2ff";
        ctx.lineWidth = 1;
        for (let j = 0; j < 3; j++) {
          const a = j * Math.PI / 3;
          ctx.beginPath();
          ctx.moveTo(x - Math.cos(a) * 3, y - Math.sin(a) * 3);
          ctx.lineTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3);
          ctx.stroke();
        }
      } else if (k === "bleed") {
        ctx.fillStyle = "#e8333a";
        ctx.beginPath();
        ctx.moveTo(x, y - 3.4);
        ctx.quadraticCurveTo(x + 3, y + 0.5, x, y + 3);
        ctx.quadraticCurveTo(x - 3, y + 0.5, x, y - 3.4);
        ctx.fill();
      } else if (k === "buff") {
        ctx.fillStyle = "#ffd76a";
        ctx.beginPath();
        ctx.moveTo(x, y - 3.4);
        ctx.lineTo(x + 3, y);
        ctx.lineTo(x + 1.1, y);
        ctx.lineTo(x + 1.1, y + 3);
        ctx.lineTo(x - 1.1, y + 3);
        ctx.lineTo(x - 1.1, y);
        ctx.lineTo(x - 3, y);
        ctx.closePath();
        ctx.fill();
      } else if (k === "rage") {
        ctx.fillStyle = "#ff7a3a";
        ctx.beginPath();
        ctx.moveTo(x, y - 3.6);
        ctx.quadraticCurveTo(x + 3.2, y, x + 1.6, y + 3);
        ctx.lineTo(x - 1.6, y + 3);
        ctx.quadraticCurveTo(x - 3.2, y, x, y - 3.6);
        ctx.fill();
        ctx.fillStyle = "#ffe08a";
        ctx.fillRect(x - 0.7, y + 0.4, 1.4, 2);
      } else {
        ctx.strokeStyle = "#c58cff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 2.6, y - 2.6);
        ctx.lineTo(x + 2.6, y - 2.6);
        ctx.lineTo(x + 2.6, y);
        ctx.lineTo(x, y + 3);
        ctx.lineTo(x - 2.6, y);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 0.6, y - 2.6);
        ctx.lineTo(x - 0.6, y);
        ctx.lineTo(x + 0.6, y + 1.6);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function star(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const rr = i % 2 ? r * 0.4 : r;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  /* Kill feed, top left of the floor: killer, a cross, the fallen. */
  function drawFeed(ctx, fx, cam) {
    const feed = fx.feed;
    if (!feed || !feed.length) return;
    const corner = worldToCss(FLOOR.l, FLOOR.t, cam);
    const left = Math.round(corner.x + 6);
    let y = Math.round(corner.y + 6);
    ctx.save();
    ctx.font = "700 12px " + UI_FONT;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    for (let i = Math.max(0, feed.length - 4); i < feed.length; i++) {
      const f = feed[i];
      const a = f.t < 0.2 ? f.t / 0.2 : f.t > f.life - 0.6 ? Math.max(0, (f.life - f.t) / 0.6) : 1;
      const by = f.by || "The pit";
      const wBy = ctx.measureText(by).width;
      const wWho = ctx.measureText(f.who).width;
      const w = wBy + wWho + 30;
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(8,6,4,0.72)";
      roundRect(ctx, left, y, w, 18, 4);
      ctx.fill();
      ctx.fillStyle = f.byTeam === 0 ? "#9be86f" : f.byTeam === 1 ? "#ff8f78" : "#e8dccb";
      ctx.fillText(by, left + 7, y + 9);
      ctx.strokeStyle = "#f4ecdf";
      ctx.lineWidth = 1.4;
      const cx = left + 7 + wBy + 8;
      ctx.beginPath();
      ctx.moveTo(cx - 3, y + 6); ctx.lineTo(cx + 3, y + 12);
      ctx.moveTo(cx + 3, y + 6); ctx.lineTo(cx - 3, y + 12);
      ctx.stroke();
      ctx.fillStyle = f.team === 0 ? "#9be86f" : "#ff8f78";
      ctx.fillText(f.who, cx + 8, y + 9);
      y += 20;
    }
    ctx.restore();
  }

  function drawNums(ctx, fx, cam) {
    if (!fx.nums || !fx.nums.length) return;
    const s = cam.spriteScale || 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round";
    for (let i = 0; i < fx.nums.length; i++) {
      const n = fx.nums[i];
      const p = n.t / n.life;
      const at = worldToCss(n.x, n.y, cam);
      if (n.jx == null) n.jx = 0;
      const pop = p < 0.12 ? 1.45 - (p / 0.12) * 0.45 : 1;
      const rise = (n.heal ? 26 : 32) * Math.min(1, p * 1.6);
      const a = p < 0.7 ? 1 : Math.max(0, 1 - (p - 0.7) / 0.3);
      const base = n.crit ? 21 : n.dodge || n.blocked ? 12 : 15;
      const size = Math.round(base * pop * Math.min(1.3, Math.max(0.9, s / 1.5)));
      const label = n.heal ? "+" + n.n : n.crit ? n.n + "!" : n.dodge ? "Miss" : n.blocked ? (typeof n.n === "number" ? n.n + " blocked" : "Warded") : String(n.n);
      ctx.font = "800 " + size + "px " + UI_FONT;
      ctx.globalAlpha = a;
      ctx.lineWidth = n.crit ? 4 : 3;
      ctx.strokeStyle = "rgba(10,6,4,0.9)";
      const tx = at.x + n.jx;
      const ty = at.y - 8 - rise - (n.dy || 0);
      ctx.strokeText(label, tx, ty);
      ctx.fillStyle = n.heal ? "#8ef07a" : n.crit ? "#ffa62e" : n.dodge ? "#d9c8ff" : n.blocked ? "#cfd6e6" : (n.team === 0 ? "#ff8f78" : "#fff4e0");
      ctx.fillText(label, tx, ty);
    }
    ctx.globalAlpha = 1;
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

  /* Captain control marks, on the floor under the sprites: a gold ring
     on the fighter you steer, a red bracket on their target, and a
     small cross where a tap sent them. */
  function drawPilot(ctx, match, fx) {
    const P = match.pilot;
    if (!P || P.auto) return;
    let me = null;
    let foe = null;
    for (let i = 0; i < match.units.length; i++) {
      const u = match.units[i];
      if (u.id === P.id && u.hp > 0) me = u;
      if (u.id === P.targetId && u.hp > 0) foe = u;
    }
    const t = fx.t || 0;
    if (me) {
      const pulse = 0.65 + 0.35 * Math.sin(t * 5);
      ctx.strokeStyle = "rgba(255, 206, 92," + (0.55 + 0.4 * pulse) + ")";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (IL.pitTurn) ctx.ellipse(me.x, me.y + 2, 5, 13, 0, 0, Math.PI * 2);
      else ctx.ellipse(me.x, me.y + 2, 13, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 206, 92, 0.16)";
      ctx.fill();
    }
    if (foe) {
      ctx.strokeStyle = P.focusId ? "rgba(255, 92, 64, 0.95)" : "rgba(255, 120, 90, 0.55)";
      ctx.lineWidth = 1.5;
      const w = 13;
      const h = 5;
      for (let k = 0; k < 4; k++) {
        const sx = k % 2 ? 1 : -1;
        const sy = k < 2 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(foe.x + sx * w, foe.y + 2 + sy * h * 0.2);
        ctx.lineTo(foe.x + sx * w, foe.y + 2 + sy * h);
        ctx.lineTo(foe.x + sx * (w - 5), foe.y + 2 + sy * h);
        ctx.stroke();
      }
    }
    if (P.goX != null) {
      const a = 0.5 + 0.4 * Math.sin(t * 8);
      ctx.strokeStyle = "rgba(255, 230, 160," + a + ")";
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(P.goX - 4, P.goY - 2);
      ctx.lineTo(P.goX + 4, P.goY + 2);
      ctx.moveTo(P.goX + 4, P.goY - 2);
      ctx.lineTo(P.goX - 4, P.goY + 2);
      ctx.stroke();
    }
  }

  /* A pure white copy of a fighter atlas for the hit flash: Eslabong
     blinks the whole body white for a frame or two on every hit. */
  function whiteOf(atlas) {
    if (!atlas || typeof document === "undefined") return null;
    if (atlas._white) return atlas._white;
    const c = document.createElement("canvas");
    c.width = atlas.width;
    c.height = atlas.height;
    const g = c.getContext("2d");
    g.drawImage(atlas, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, c.width, c.height);
    c.tfSheet = atlas.tfSheet;
    try { atlas._white = c; } catch (err) { return c; }
    return c;
  }

  function drawArena(ctx, match, fx) {
    const canvas = ctx.canvas;
    const view = fitArena(canvas);
    const cam = updateCam(match, fx, view);
    IL.pitTurn = !!cam.portrait;
    fx.dpr = view.dpr;
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
    fx.worldMat = cam.portrait ? [0, d * s, d * s, 0, d * cam.ox, d * cam.oy] : [d * s, 0, 0, d * s, d * cam.ox, d * cam.oy];
    fx.shx = shx;
    fx.shy = shy;
    if (cam.portrait) ctx.setTransform(0, d * s, d * s, 0, d * cam.ox + shx, d * cam.oy + shy);
    else ctx.setTransform(d * s, 0, 0, d * s, d * cam.ox + shx, d * cam.oy + shy);
    ctx.imageSmoothingEnabled = false;

    drawPit(ctx, fx, match);

    /* v68 pixel FX: decals and afterimages under the fighters; bursts,
       glows, bolts and slashes over them (pfx.js). The v64 sprite strips,
       stacked rings and rune waves are retired. */
    if (IL.pfx) IL.pfx.drawGround(ctx, fx);
    for (let i = 0; i < match.units.length; i++) drawCast(ctx, match.units[i], fx);
    drawPilot(ctx, match, fx);

    const order = match.units.slice().sort(function (a, b) { return a.y - b.y; });
    const bodyH = (IL.BODY_H || 30);
    const bodyW = 20;
    IL.pitBoxes = [];
    IL.pitLabels = [];
    IL.pitBodies = [];
    let focus = null;
    let focusD = 1e9;
    const heads = [];
    const ptr = fx.pointer;
    const ptrWorld = ptr ? cssToWorld(ptr.x, ptr.y, cam) : null;
    for (let i = 0; i < order.length; i++) {
      const u = order[i];
      const x = u.x;
      const y = u.y;
      const z = u.z || 0;
      const gy = y - z;
      const lift = z > 2 ? Math.max(0.45, 1 - z / 180) : 1;
      const turnPit = !!cam.portrait;
      const shw = (u.hp > 0 ? 8 : 12) * lift;
      const shh = 3.5 * lift;
      ctx.fillStyle = "rgba(0,0,0," + (0.28 + 0.16 * lift) + ")";
      ctx.beginPath();
      if (turnPit) ctx.ellipse(x - 2, y, shh, shw, 0, 0, Math.PI * 2);
      else ctx.ellipse(x, y + 2, shw, shh, 0, 0, Math.PI * 2);
      ctx.fill();
      /* v69 team ring under the feet: green for yours, red for theirs. */
      if (u.hp > 0 && !u.summon) {
        ctx.strokeStyle = u.team === 0 ? "rgba(140,232,120,0.62)" : "rgba(255,98,78,0.62)";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        if (turnPit) ctx.ellipse(x - 2, y, 4.6, 11, 0, 0, Math.PI * 2);
        else ctx.ellipse(x, y + 2, 11, 4.6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
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
        if (IL.pfx && u.hp > 0 && (u.state === "dash" || u.state === "roll" || u.state === "leap")) {
          IL.pfx.ghost(fx, u, frame, gy, bodyScale);
        }
        IL.hero.draw(ctx, u.sprite, frame, x, gy, bodyScale, u.facing, u.cls, hint, u.weaponKind);
        if (u.flash > 0 && u.hp > 0) {
          const white = whiteOf(u.sprite);
          ctx.save();
          ctx.globalAlpha = Math.min(1, u.flash * 9);
          if (white) IL.hero.draw(ctx, white, frame, x, gy, bodyScale, u.facing, u.cls, hint, u.weaponKind);
          ctx.restore();
        }
      } else {
        ctx.fillStyle = u.team === 0 ? "#c4622d" : "#7f93b8";
        ctx.beginPath();
        ctx.arc(x, gy - 14, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      drawBlock(ctx, u, fx);
      if (u.hp > 0 && u.state === "attack" && !u.didSlash && !u.didHit) drawWindup(ctx, u, gy, cam, fx);
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
        heads.push({ u: u, x: x, gy: gy, bh: bh });
        if (ptrWorld) {
          const hit = Math.hypot(ptrWorld.x - x, ptrWorld.y - gy + bh * 0.5);
          if (hit < focusD && hit < 36) { focus = u; focusD = hit; }
        }
      }
    }

    for (let i = 0; i < match.shots.length; i++) drawShot(ctx, match.shots[i], fx.t || 0);
    if (IL.pfx) IL.pfx.drawAir(ctx, fx);

    noteOverlap(fx, match, bodyW, bodyH);
    IL.pitFocusId = focus ? focus.id : (fx.stickId || "");
    if (focus && ptr && ptr.stick) fx.stickId = focus.id;
    if (!ptr) IL.pitFocusId = fx.stickId || "";
    ctx.restore();
    IL.pitTurn = false;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    drawOverheads(ctx, heads, cam, fx, match);
    drawNums(ctx, fx, cam);
    drawFeed(ctx, fx, cam);

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
  IL.pitToWorld = cssToWorld;
})(typeof window !== "undefined" ? window : globalThis);
