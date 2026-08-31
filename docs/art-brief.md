# Handoff brief — painted card art for Rare, Epic, Legendary, Mythic

## What this is
The flip reveal now has three art layers: painted art (this brief), the
Wikipedia photo (already live for everything), and the emoji floor. This
brief covers the painted layer: **985 images** that put unique art on every
Rare-and-up card — 2,546 cards in all, because variants share their
subject's painting ("Bald Eagle — Sketch Plate" wears the Bald Eagle).

Common, Uncommon and Fine stay on wiki photos by design.

## The contract (this is the whole integration)
- One webp per subject: `art/<slug>.webp`. The slug for every subject is in
  **docs/art-manifest.json** — use it verbatim, never re-derive by hand.
- Drop finished files into `art/` and hand them over. Nothing else: no
  integrate.py wiring, no module changes, **no rebuild**. The game probes
  `art/<slug>.webp` at flip time and falls back gracefully while a file
  doesn't exist yet, so art ships in waves and each wave is live the moment
  it lands on main.

## Image spec
- 320×320, square, webp quality ~82, target ≤25KB each (hard cap 40KB).
- Subject centred and filling the frame; no text, no logos, no border —
  the card supplies its own frame, name plate and rarity colour.
- It displays ~100px tall inside a dark card: strong silhouette and value
  contrast beat fine detail. Dark-background-friendly (no white fields).
- One consistent style across the whole set — pick it on the first wave
  and hold it. The 3D pack and card backs set the tone: rich, printed,
  slightly vintage.

## Waves (deliver in this order)
| wave | bucket | images | why first |
|---|---|---|---|
| 1 | Mythic | 40 | the fireworks moment — every player stares at these |
| 2 | Legendary | 39 | same |
| 3 | Epic | 108 | foil tiers complete |
| 4 | Rare | 798 | the long tail, any pace |

Total: 985 images ≈ 15–25MB at spec, lazy-loaded one file per flip.

## The manifest
`docs/art-manifest.json` — an array of `{slug, subject, bucket, category,
tier, cards}` sorted Mythic→Rare. `cards` is how many card variants that
one image covers. Generate from the subject text; name the file by slug.

## Verifying a wave before handoff
Open the game, dev-grant the pack containing a covered card, flip it: the
painting should replace the emoji within a beat. A missing/misnamed file
shows the wiki photo instead — if you see a photo where you shipped a
painting, the filename doesn't match the manifest slug.
