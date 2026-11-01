# Hero gear

Visible armour is skinned to the v5 hero. Eight slots are shown: head, shoulders, chest, hands, wrists, waist, legs, and feet. Rings and the amulet are not drawn.

A piece is a shell of the body region (same weights and bind pose, 12 mm off the skin) unless a fitted mesh replaces it. The body triangles under that piece are removed so the surfaces do not z-fight or leave a hole.

## Meshy top tier

Drop a GLB or FBX on the hero's skeleton at:

`Assets/Resources/Gear/Meshy/<slot>.glb`

`<slot>` is `head`, `shoulders`, `chest`, `hands`, `wrists`, `waist`, `legs`, or `feet`.

On equip the mesh is rebound by bone name. Each vertex keeps its offset in bone space and is written into the hero bind pose. If the rest-pose fit check fails, the mesh is not shown and the body shell is used instead. A failed fit is a QA error. Do not ship it.

## Restricted packs

Packs that are not CC0 do not go in git. Put them in `Assets/Art/Gear/Restricted/` (gitignored). If that folder is absent, the fitted body shell remains the piece.
