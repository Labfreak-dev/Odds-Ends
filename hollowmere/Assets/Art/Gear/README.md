# Hero gear

Visible armour is skinned to the v5 hero. Eight slots are shown: head, shoulders, chest, hands, wrists, waist, legs, and feet. Rings and the amulet are not drawn.

A piece is a shell of the body region (same weights and bind pose, 12 mm off the skin) unless a fitted mesh replaces it. The body triangles under that piece are removed so the surfaces do not z-fight or leave a hole.

## Meshy top tier

Drop a GLB or FBX on the hero's skeleton at:

`Assets/Resources/Gear/Meshy/<slot>.glb`

`<slot>` is `head`, `shoulders`, `chest`, `hands`, `wrists`, `waist`, `legs`, or `feet`.

On equip the mesh is rebound by bone name. Each vertex keeps its offset in bone space and is written into the hero bind pose. If the rest-pose fit check fails, the mesh is not shown and the body shell is used instead. A failed fit is a QA error. Do not ship it.

## Tiers

Each of plate, leather, arcane, bone, and infernal has three tiers. Tier 3 is the v7b mesh in `Resources/Gear/Sets/<family>/<slot>.glb`. Tiers 1 and 2 load `Resources/Gear/Lower/<family>/<slot>` when a CC0 skinned mesh is there, and otherwise wear the same v7b mesh. `GearTable` finishes multiply the authored base colour and metal values. They do not replace the albedo, normal, or metal maps. Tier 1 is worn and rusty, tier 2 is clean steel, and tier 3 keeps the maps with a small emission accent.

## Weapons

Signature props from the v7b pack are in `Resources/Gear/Weapons/`. Every other base has its own mesh in that folder. The grip is the mesh origin. `GearTable` gives each type a socket within 5 cm of the hand. A two-handed weapon places an off-hand target on the shaft.

## Restricted packs

Packs that are not CC0 do not go in git. Put them in `Assets/Art/Gear/Restricted/` (gitignored). If that folder is absent, the fitted body shell remains the piece.
