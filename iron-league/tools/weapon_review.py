#!/usr/bin/env python3
"""Contact sheet from the real battler renderer: every class, motion, frame, both facings."""
import os
import subprocess
import sys
import time
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tools", "out", "weapon_review.png")
PORT = 8766

DRAW = r"""
async (batch) => {
  await new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    IL.weapons.whenReady(finish);
    setTimeout(finish, 4000);
  });
  const motions = ["idle1","idle2","walk","atk1","atk2","bow","gun","magic","crouch","hit","cheer","dead"];
  const scale = 3;
  const cellW = 144;
  const cellH = 150;
  const labelW = 108;
  const head = 18;
  const canvas = document.createElement("canvas");
  canvas.width = labelW + motions.length * 3 * cellW;
  canvas.height = head + batch.length * 2 * cellH;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#241c16";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#f3d9b0";
  motions.forEach((name, i) => ctx.fillText(name, labelW + i * 3 * cellW + 4, 13));
  for (let i = 0; i < batch.length; i++) {
    const cls = batch[i];
    const atlas = await IL.hero.compose({ sheet: IL.defaultSheet(cls.id) });
    const kind = IL.CLASS_WEAPON[cls.id];
    for (let face = 0; face < 2; face++) {
      const facing = face === 0 ? -1 : 1;
      const row = i * 2 + face;
      ctx.fillStyle = "#f3d9b0";
      ctx.fillText(cls.name + (facing < 0 ? " L" : " R"), 4, head + row * cellH + 16);
      for (let mi = 0; mi < motions.length; mi++) {
        for (let sub = 0; sub < 3; sub++) {
          const x = labelW + (mi * 3 + sub) * cellW + cellW / 2;
          const y = head + row * cellH + cellH - 6;
          IL.hero.draw(ctx, atlas, 1 + sub, x, y, scale, facing, cls.id, motions[mi], kind);
        }
      }
    }
  }
  return canvas.toDataURL("image/png");
}
"""


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    server = subprocess.Popen(
        ["python3", "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(0.4)
    tiles = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", args=["--disable-dev-shm-usage"])
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            page.goto("http://127.0.0.1:%d/index.html" % PORT, wait_until="domcontentloaded")
            page.wait_for_function("() => window.IL && IL.CLASSES && IL.hero && IL.weapons")
            classes = page.evaluate(
                """() => Object.keys(IL.CLASSES).map(id => ({ id, name: IL.CLASSES[id].name }))"""
            )
            if len(classes) != 27:
                raise SystemExit("expected 27 classes, got %d" % len(classes))
            for start in range(0, len(classes), 9):
                batch = classes[start:start + 9]
                url = page.evaluate(DRAW, batch)
                import base64
                raw = base64.b64decode(url.split(",", 1)[1])
                path = "/tmp/weapon_tile_%d.png" % start
                open(path, "wb").write(raw)
                tiles.append(Image.open(path).convert("RGB"))
                print("tile", start, tiles[-1].size)
            browser.close()
    finally:
        server.terminate()
    width = max(im.width for im in tiles)
    height = sum(im.height for im in tiles)
    sheet = Image.new("RGB", (width, height), (20, 16, 14))
    y = 0
    for im in tiles:
        sheet.paste(im, (0, y))
        y += im.height
    sheet.save(OUT, optimize=True)
    print("wrote", OUT, sheet.size)


if __name__ == "__main__":
    main()
