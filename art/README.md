# art/ — painted card art

One webp per SUBJECT, named by slug: `art/<slug>.webp` (e.g. `art/giraffe.webp`).
The slugs, and every card each one covers, are listed in `docs/art-manifest.json`.

The game probes this folder at flip time for Rare-and-up cards and falls back
to the Wikipedia photo, then the emoji, when a file is missing — so art can
land in ANY order, in waves, with no code change and NO REBUILD: committing a
webp here and pushing to main is the whole deploy.

Spec: 320×320, square, webp quality ~82, aim under 25KB. Subject centred,
no text, no border (the card supplies its own frame). It renders at ~100px
in a dark card, so favour strong silhouettes over fine detail.
