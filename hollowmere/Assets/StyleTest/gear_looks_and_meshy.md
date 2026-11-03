# What the free packs actually give (honest count) and how Meshy could extend them

## Distinct looks in the FREE tiers (CC0)
**KayKit Adventurers Free 2.0** (all on the same Rig_Medium skeleton, chibi proportions)
- 6 complete outfit models: Knight, Barbarian, Mage, Ranger, Rogue, Rogue_Hooded.
  - Per class: Knight 2 (Knight, Barbarian as "Warlord" skin), Ranger 3 (Ranger, Rogue, Rogue_Hooded), Mage **1 (no second mage model in the free tier)**.
  - Helmets/hoods are part of each model. The sample sheet says the knight helmet can be taken off, but that only toggles one model's own mesh. It isn't a mix-and-match system.
- Weapons and off-hands: 21 usable for heroes, including colour variants. Main hand: sword_1handed, sword_2handed (+_color), axe_1handed, axe_2handed, dagger, wand, staff, bow, bow_withString, crossbow_1handed, crossbow_2handed. Off-hand: 8 shields (badge, round, round_barbarian, spikes, square, each plain/colour), spellbook open and closed, quiver. Plus arrows and bolts, smokebomb and mugs (props).
  - Roughly 12 distinct weapon silhouettes. Shields and colour versions make it about 21 visible items.
- No rarity or tier variants of anything, and only one texture atlas per character.

**KayKit Skeletons Free 1.1**: 4 enemies (Warrior, Minion, Rogue, Mage) and 9 weapons and shields (axe, blade, staff, crossbow, 2+2 shields, quiver, arrows). No boss or crowned model. The boss in the test is a 1.7x Warrior with an axe, a large shield and a red overlay.

**KayKit Dungeon Free 1.1**: 211 FBX pieces (floors, walls, doorways, stairs, pillars, banners in 6 colours, barrels, chests, tables, torches, candles, rubble). That's plenty for many rooms.

**KayKit Character Animations Free 1.1**: Rig_Medium has 8 sets with about 160 clips (1H/2H/dual-wield melee, bow, 1H/2H ranged, magic, dodges, hits, deaths, skeleton set, tools/fishing). Rig_Large has 6 sets. This is the strongest part of the free kit.

**Quaternius Modular Character Outfits Fantasy (Standard/free)**: only **2 outfits** (Peasant, Ranger), each for male and female. That's 4 full outfits and about 20 modular parts in FBX. The rest of the outfits are in the paid Source tier.
**Quaternius Universal Base Characters (Standard)**: 2 bodies (male and female "Superhero" base) plus hair, eyebrows and beard parts.
**Quaternius Universal Animation Library (Standard)**: 1 humanoid clip library (UAL1).
- Verdict: the Quaternius free tier is a realistic-proportion humanoid on a different skeleton. Mixing it with KayKit chibi heroes would clash in style and scale, and it would mean kitbashing across bodies. I evaluated it and didn't import it.

**Total for heroes using free KayKit only**: 3 class base models, 2 extra upgrade skins (Knight→Barbarian, Ranger→Rogue_Hooded; Rogue is a third option for Ranger), so **5-6 whole-outfit looks**, and about 21 weapons and off-hands. Each class gets 3+ loadouts. Mage skins: **only 1**.

## How Meshy could extend this, in matching style (no credits spent)
Meshy works well for **rigid props**, which have no deformation and so can't tear:
1. **Weapons and off-hands** (best fit): tiered versions of the 12 KayKit silhouettes (rusty, steel, gilded, runed), extra orbs, tomes, totems, quivers. Prompt with the KayKit sample image as reference ("low-poly chibi, flat colour atlas, bevelled, KayKit style"), decimate to about 1-3k tris, re-texture onto a flat palette atlas, then author the grip pivot on the shared hand_R/hand_L socket standard (see restructure.md). This is where most visible progression would come from.
2. **Dungeon dressing**: altars, sarcophagi, braziers, bone piles, boss thrones. These are static, so they're low risk.
3. **Monsters**: rigid or simple creatures (slimes, golems, spiders, turrets) rigged with Meshy's auto-rig or a simple Blender rig. Humanoid enemies should reuse KayKit Rig_Medium/Large so the animation library carries over. A Meshy-generated humanoid would need retargeting and is the riskiest option.
4. **Outfit skins (not recommended with Meshy)**: whole-outfit skins have to be skinned to Rig_Medium and look KayKit-consistent. That's hand work in Blender (re-texturing an existing KayKit model's atlas, recolouring, swapping helmet meshes), or it means buying the Extra tiers or Synty. A cheap trick is **texture-atlas recolours** of the 6 free models. Every KayKit model uses one small palette texture, so a new atlas gives, for example, a crimson knight or a shadow mage with no mesh work and no tearing risk.
