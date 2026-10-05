/* Iron League — arena canvas. Background is cached; fighters come from atlases. */
(function (root) {
  const IL = root.IL = root.IL || {};
  const SCALE = 4;

  let bg = null;

  function ensureBg() {
    if (bg) return bg;
    const c = document.createElement("canvas");
    c.width = 960;
    c.height = 600;
    const g = c.getContext("2d");
    g.fillStyle = "#14110e";
    g.fillRect(0, 0, 960, 600);

    const sky = g.createLinearGradient(0, 0, 0, 360);
    sky.addColorStop(0, "#1c1814");
    sky.addColorStop(1, "#2a2118");
    g.fillStyle = sky;
    g.fillRect(0, 0, 960, 360);

    g.fillStyle = "#3a2a22";
    g.beginPath();
    g.ellipse(480, 360, 430, 168, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#4e382c";
    g.beginPath();
    g.ellipse(480, 352, 360, 128, 0, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = "rgba(255,220,180,0.08)";
    g.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.ellipse(480, 352, 80 + i * 48, 28 + i * 16, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.setLineDash([6, 10]);
    g.strokeStyle = "rgba(232, 196, 150, 0.18)";
    g.beginPath();
    g.moveTo(480, 230);
    g.lineTo(480, 490);
    g.stroke();
    g.setLineDash([]);

    function brazier(x, y) {
      const glow = g.createRadialGradient(x, y, 4, x, y, 70);
      glow.addColorStop(0, "rgba(255,150,60,0.55)");
      glow.addColorStop(1, "rgba(255,120,40,0)");
      g.fillStyle = glow;
      g.beginPath();
      g.arc(x, y, 70, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#2a2018";
      g.fillRect(x - 10, y, 20, 28);
      g.fillStyle = "#e07a32";
      g.beginPath();
      g.moveTo(x - 12, y + 4);
      g.lineTo(x, y - 16);
      g.lineTo(x + 12, y + 4);
      g.fill();
      g.fillStyle = "#f2c14a";
      g.beginPath();
      g.arc(x, y - 2, 4, 0, Math.PI * 2);
      g.fill();
    }
    brazier(86, 168);
    brazier(874, 168);
    brazier(120, 500);
    brazier(840, 500);

    const vig = g.createRadialGradient(480, 320, 180, 480, 320, 560);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.45)");
    g.fillStyle = vig;
    g.fillRect(0, 0, 960, 600);
    bg = c;
    return bg;
  }

  function drawArena(ctx, match, fx) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 960, 600);
    const shake = fx.shake || 0;
    ctx.save();
    if (shake > 0.2) {
      ctx.translate(Math.sin(fx.t * 48) * shake, Math.cos(fx.t * 37) * shake * 0.65);
    }
    ctx.drawImage(ensureBg(), 0, 0);

    for (let i = 0; i < match.units.length; i++) {
      const u = match.units[i];
      if (!u.cast) continue;
      const p = Math.max(0, Math.min(1, u.cast.t / u.cast.dur));
      ctx.beginPath();
      ctx.arc(u.cast.x, u.cast.y, u.cast.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(176, 140, 255," + (0.10 + p * 0.18) + ")";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(u.cast.x, u.cast.y);
      ctx.arc(u.cast.x, u.cast.y, u.cast.r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = "rgba(214, 186, 255, 0.28)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(u.cast.x, u.cast.y, u.cast.r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(236, 220, 255," + (0.35 + p * 0.55) + ")";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    for (let i = 0; i < fx.booms.length; i++) {
      const b = fx.booms[i];
      const p = b.t / b.life;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * (0.7 + p * 0.5), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(244, 220, 255," + (1 - p) + ")";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    const order = match.units.slice().sort(function (a, b) { return a.y - b.y; });
    for (let i = 0; i < order.length; i++) {
      const u = order[i];
      ctx.fillStyle = "rgba(0,0,0,0.38)";
      ctx.beginPath();
      ctx.ellipse(u.x, u.y + 2, u.hp > 0 ? 16 : 22, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      const frame = IL.frameIndex(u.anim || "idle", u.animT || 0);
      if (u.sprite) {
        IL.hero.draw(ctx, u.sprite, frame, u.x, u.y, SCALE, u.facing);
        if (u.flash > 0 && u.hp > 0) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = Math.min(0.85, u.flash * 5);
          IL.hero.draw(ctx, u.sprite, frame, u.x, u.y, SCALE, u.facing);
          ctx.restore();
        }
      } else {
        ctx.fillStyle = u.team === 0 ? "#c4622d" : "#7f93b8";
        ctx.beginPath();
        ctx.arc(u.x, u.y - 28, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      if (u.hp > 0) {
        const bw = 44;
        const bx = Math.round(u.x - bw / 2);
        const by = Math.round(u.y - 34 * SCALE - 8);
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
        ctx.fillStyle = u.team === 0 ? "#c4622d" : "#7f93b8";
        ctx.fillRect(bx, by, Math.max(0, bw * (u.hp / u.maxHp)), 4);
        ctx.font = "11px Palatino, Georgia, serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(10,8,6,0.7)";
        ctx.fillText(u.name, u.x + 1, by - 3);
        ctx.fillStyle = "#f4ecdf";
        ctx.fillText(u.name, u.x, by - 4);
      }
    }

    for (let i = 0; i < match.shots.length; i++) {
      const p = match.shots[i];
      const ang = Math.atan2(p.vy, p.vx);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.fillStyle = p.team === 0 ? "#f0d7a4" : "#d5deee";
      ctx.fillRect(-8, -1.5, 12, 3);
      ctx.fillStyle = p.team === 0 ? "#c4622d" : "#8aa0c4";
      ctx.fillRect(2, -2, 4, 4);
      ctx.restore();
    }

    ctx.font = "bold 16px Palatino, Georgia, serif";
    ctx.textAlign = "center";
    for (let i = 0; i < fx.nums.length; i++) {
      const n = fx.nums[i];
      const a = Math.max(0, 1 - n.t / n.life);
      ctx.globalAlpha = a;
      ctx.fillStyle = n.blocked ? "#d7d2ea" : "#fff6e8";
      ctx.fillText(n.blocked ? n.n + " guard" : String(n.n), n.x, n.y - n.t * 36);
    }
    ctx.globalAlpha = 1;

    if (match.engage > 0) {
      ctx.fillStyle = "rgba(20,16,12,0.35)";
      ctx.fillRect(0, 250, 960, 90);
      ctx.fillStyle = "#f4ecdf";
      ctx.font = "28px Palatino, Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText(match.leftName + "  vs  " + match.rightName, 480, 292);
      ctx.font = "14px Palatino, Georgia, serif";
      ctx.fillStyle = "#e0b07a";
      ctx.fillText("They walk in on their own.", 480, 316);
    }
    ctx.restore();
  }

  IL.SCALE = SCALE;
  IL.drawArena = drawArena;
})(typeof window !== "undefined" ? window : globalThis);
