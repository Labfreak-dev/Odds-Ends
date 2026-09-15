/* Gravemark — 20-vfx.js
   The procedural combat layer: weapon trails, hit flash, impact bursts,
   floating damage numbers and panel shake.

   Most of what makes Path of Idle's combat FEEL alive is not the character
   animation at all — it is this layer on top of it. It needs no art, so it
   works on today's whole-figure paintings exactly as well as on a rig.

   State is per panel (each battle panel owns a GM.Vfx.Panel), and everything
   is drawn in one pass with a single shake offset. */
"use strict";

GM.Vfx = {};

GM.Vfx.Panel = function () {
  this.trails = {};        /* actorId -> [{x,y,t}] */
  this.particles = [];
  this.numbers = [];
  this.shake = 0;          /* remaining magnitude */
  this.shakeUntil = 0;
};

var TRAIL_LEN = 9;
var TRAIL_LIFE = 0.22;

/* Record where a weapon tip is this frame. The trail is only drawn while
   points are fresh, so a resting actor leaves no smear. */
GM.Vfx.Panel.prototype.trail = function (actorId, x, y, now) {
  var t = this.trails[actorId] || (this.trails[actorId] = []);
  t.push({ x: x, y: y, t: now });
  if (t.length > TRAIL_LEN) t.shift();
};

GM.Vfx.Panel.prototype.flashShake = function (amount) {
  this.shake = Math.max(this.shake, amount);
  this.shakeUntil = performance.now() + 180;
};

GM.Vfx.Panel.prototype.number = function (x, y, text, cls) {
  this.numbers.push({ x: x, y: y, text: text, cls: cls || "", born: performance.now(),
                      dx: (GM.rng() - 0.5) * 30 });
  if (this.numbers.length > 24) this.numbers.shift();
};

/* A burst of sparks (hit) or dust (death) at a point. */
GM.Vfx.Panel.prototype.burst = function (x, y, kind, count) {
  var n = count || (kind === "death" ? 18 : 10);
  for (var i = 0; i < n; i++) {
    var ang = GM.rng() * Math.PI * 2;
    var spd = kind === "death" ? 40 + GM.rng() * 60 : 90 + GM.rng() * 160;
    this.particles.push({
      x: x, y: y,
      vx: Math.cos(ang) * spd * (kind === "death" ? 1 : 0.6) + (kind === "hit" ? 40 : 0),
      vy: Math.sin(ang) * spd * (kind === "death" ? 0.4 : 1) - (kind === "death" ? 30 : 60),
      life: kind === "death" ? 0.9 + GM.rng() * 0.5 : 0.28 + GM.rng() * 0.22,
      age: 0, kind: kind,
      size: kind === "death" ? 2 + GM.rng() * 4 : 1.5 + GM.rng() * 2
    });
  }
  if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220);
};

/* Advance and draw everything. Returns the shake offset the caller should
   have applied to the whole scene (it is returned rather than applied here so
   the caller can translate before drawing actors). */
GM.Vfx.Panel.prototype.shakeOffset = function (now) {
  if (now > this.shakeUntil) { this.shake = 0; return { x: 0, y: 0 }; }
  var k = this.shake * ((this.shakeUntil - now) / 180);
  return { x: (GM.rng() - 0.5) * 2 * k, y: (GM.rng() - 0.5) * 2 * k };
};

GM.Vfx.Panel.prototype.draw = function (ctx, w, h, now, dt) {
  var i, id;

  /* trails: a tapering ribbon through the last few tip positions */
  for (id in this.trails) {
    var t = this.trails[id];
    while (t.length && now - t[0].t > TRAIL_LIFE * 1000) t.shift();
    if (t.length < 3) continue;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (i = 1; i < t.length; i++) {
      var age = (now - t[i].t) / (TRAIL_LIFE * 1000);
      ctx.strokeStyle = "rgba(232,226,209," + (0.8 * (1 - age)) + ")";
      ctx.lineWidth = Math.max(1, (h * 0.014) * (1 - age) * (i / t.length));
      ctx.beginPath();
      ctx.moveTo(t[i - 1].x, t[i - 1].y);
      ctx.lineTo(t[i].x, t[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* particles */
  for (i = this.particles.length - 1; i >= 0; i--) {
    var p = this.particles[i];
    p.age += dt;
    if (p.age >= p.life) { this.particles.splice(i, 1); continue; }
    p.vy += (p.kind === "death" ? 60 : 420) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    var a = 1 - p.age / p.life;
    ctx.fillStyle = p.kind === "death"
      ? "rgba(120,110,95," + (a * 0.7) + ")"
      : "rgba(240,214,138," + a + ")";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (p.kind === "death" ? 1 + p.age : 1), 0, Math.PI * 2);
    ctx.fill();
  }

  /* damage numbers: rise, drift, fade; crits bigger and gold */
  for (i = this.numbers.length - 1; i >= 0; i--) {
    var n = this.numbers[i];
    var age2 = (now - n.born) / 950;
    if (age2 >= 1) { this.numbers.splice(i, 1); continue; }
    var pop = age2 < 0.12 ? 1 + (0.12 - age2) * 4 : 1;
    ctx.save();
    ctx.globalAlpha = age2 < 0.7 ? 1 : 1 - (age2 - 0.7) / 0.3;
    var size = Math.max(11, h * (n.cls === "crit" ? 0.085 : 0.062)) * pop;
    ctx.font = "700 " + size + "px ui-monospace,Menlo,Consolas,monospace";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,.85)";
    ctx.fillStyle = n.cls === "crit" ? "#f0d68a" : n.cls === "bad" ? "#e0666b"
                  : n.cls === "heal" ? "#87b14e" : "#e8e2d1";
    var x = n.x + n.dx * age2, y = n.y - age2 * h * 0.28;
    ctx.strokeText(n.text, x, y);
    ctx.fillText(n.text, x, y);
    ctx.restore();
  }
};

/* Per-actor flash: stamp the white silhouette over the sprite for a few
   frames after it is hit. */
GM.Vfx.drawFlash = function (ctx, key, frame, x, y, w, h) {
  var img = GM.whiteSprite(key);
  if (!img) return;
  var spec = GM.ART_BY_KEY[key];
  var n = Math.max(1, Math.round(img.width / (spec.w || img.width)));
  var fw = img.width / n;
  var f = ((frame | 0) % n + n) % n;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.drawImage(img, f * fw, 0, fw, img.height, x, y, w, h);
  ctx.restore();
};
