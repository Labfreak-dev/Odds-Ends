# Style test - third-party assets (all CC0 1.0, free tiers, downloaded at $0)

Downloaded 2026-11-02 from itch.io "name your own price" pages at $0 (free uploads only; no paid tiers).
Each pack's own License.txt was checked and states CC0 1.0 Universal (public domain dedication).
Credit is not required by CC0; given here as thanks.

| Pack | Version / upload | Source | License | Used in project |
|---|---|---|---|---|
| KayKit Adventurers | Free 2.0 | https://kaylousberg.itch.io/kaykit-adventurers | CC0 1.0 (License.txt) | Knight, Ranger, Mage, Barbarian, Rogue_Hooded + weapons (Resources/ST/Chars, Weapons) |
| KayKit Skeletons | Free 1.1 | https://kaylousberg.itch.io/kaykit-skeletons | CC0 1.0 (License.txt) | Skeleton Warrior/Minion/Rogue/Mage + weapons (Resources/ST/Skel) |
| KayKit Dungeon Remastered (Dungeon Pack) | Free 1.1 | https://kaylousberg.itch.io/kaykit-dungeon-remastered (redirects to /kaykit-dungeon-pack) | CC0 1.0 (License.txt) | Room tiles, walls, props (Resources/ST/Dungeon) |
| KayKit Character Animations | Free 1.1 | https://kaylousberg.itch.io/kaykit-character-animations | CC0 1.0 (License.txt) | Rig_Medium clips (Resources/ST/Anim) |
| Quaternius Modular Character Outfits - Fantasy | Standard (free) | https://quaternius.itch.io/modular-character-outfits-fantasy | CC0 1.0 (License_Standard.txt) | Male/Female Peasant + Male/Female Ranger outfits, base-colour textures (Resources/ST/Folk) - town villagers + model-agnostic socket proof |
| Quaternius Universal Base Characters | Standard (free) | https://quaternius.itch.io/universal-base-characters | CC0 1.0 (License_Standard.txt) | Superhero Male/Female FullBody (head kept at runtime), hair + eyebrow meshes, skin/hair/eye textures (Resources/ST/Folk) |
| Quaternius Universal Animation Library | Standard (free) | https://quaternius.itch.io/universal-animation-library | CC0 1.0 (License.txt) | UAL1_Standard.fbx clips for villagers (Resources/ST/Folk) |
| KayKit Medieval Hexagon Pack | 1.0 FREE | https://kaylousberg.itch.io/kaykit-medieval-hexagon | CC0 1.0 (License.txt) | Blue + neutral buildings, decoration props and nature, shared texture hexagons_medieval.png (Resources/ST/Town/Hex) - town houses, tavern, church, smithy, windmill (hex mountain tiles tried and dropped) |
| Medieval Village Kit (algumacoisaqq / Daniel Gruginski) | FBX + PNG release | https://algumacoisaqq.itch.io (generator source https://github.com/danielgruginski/MedievalVillageKit) | CC0 1.0 (LICENSE.txt) | 121 VK pieces (market stalls, fountain, forge yard, lamps, signs, banners, fences, trees, bushes, rocks, graves...) + 38 textures + vk_mats.txt (converted from Data/materials.json) (Resources/ST/Town/VK). README states the kit was AI-generated (Blender Python scripts written with Claude Code, human-directed). |
| Quaternius LowPoly Animated Animals (Farm Animals Animated) | free upload | https://quaternius.itch.io/lowpoly-animated-animals | CC0 1.0 (itch page licence; no licence file in zip) | Cow, Horse, Pig, Pug, Sheep (Resources/ST/Town/Animals) |
| Quaternius Medieval Village MegaKit | Standard (free) | https://quaternius.itch.io/medieval-village-megakit | CC0 1.0 (License_Standard.txt) | Downloaded and evaluated; not imported yet (glTF-only textured modular houses) |
| Quaternius Fantasy Props MegaKit | Standard (free) | https://quaternius.itch.io/fantasy-props-megakit | CC0 1.0 (License_Standard.txt) | Phase 2: 28 FBX (barrel, crates, chain, cage, pickaxe, rope, lanterns, torch, buckets, vases, candlesticks, chandelier, bookcase, cauldron, coins, chest, shelf, table, bag, anvil, workbench, scroll, books) in Resources/ST/Props; flat StToon palette/vertex colours, no textures |
| Quaternius Stylized Nature MegaKit | Standard (free) | https://quaternius.itch.io/stylized-nature-megakit | CC0 1.0 (License_Standard.txt) | Phase 2: 14 FBX (Unity) - rocks, mushrooms, dead trees, pebbles, fern, plants, grass (Resources/ST/Nature); cave/mine boulder walls |

Repo assets reused (already in Hollowmere; licences per repo_asset_inventory.md / v6_cc0_licences.txt): hm_warwolf, hm_spider, hm_lava_golem, hm_giant_mutant, hm_vampire_bat, hm_rat from Resources/Models (CC0, OpenGameArt v6 set) for the flat-toon recolour test; gem_{sapphire,amethyst,emerald,topaz,ruby}_royal/regular (Resources/Models, repo gem models) as glowing crystals/ore in phase 2 biomes;
( see Assets/Audio/CREDITS.md for CC-BY audio): StGlow overlay shader, KayKit dungeon arch/torches for the town's dungeon gate.

## Owned itch.io 2D packs (NOT in git)

Bought by the user on itch.io, downloaded with the itch API. Stored only in the gitignored folder
`Assets/StyleTest/Owned/` (see root .gitignore). The code loads them with Resources.Load and silently skips them when absent,
so the public repo never contains them. Do NOT ship a public APK built on a machine that has the Owned folder
unless the licence row says redistribution inside a game is fine.

| Pack | Source | Licence as published | Notes |
|---|---|---|---|
| 7T4E Gems / Medallions / Ores / Ingots / Keys / Treasure Chests / Flasks / Treasure Bags (Dreaming of Light) | dreamingoflight888.itch.io/7t4e-* | Not stated; store pages are now restricted, no licence file in zips | Treat as personal/owned use only until confirmed |
| Wenrexa Fantasy Armory (resources-pack-vol-4) | wenrexa.itch.io/resources-pack-vol-4 | CC0 1.0 (page) + LICENSE.txt: free for commercial use, attribution optional; README says AI-generated | Safe |
| Wenrexa Skill Icon Pack 4.0 | wenrexa.itch.io/spells-4 | CC0 1.0 (page) | Safe |
| Wenrexa Skill & Spell Icon Pack #3 / #5 | wenrexa.itch.io/spells-3, /spells-5 | Page tag CC BY-SA 4.0; text: free commercial use, no reselling the assets | #5 downloaded, not used in game yet; ShareAlike needs a decision |
| Wenrexa RPG Icons Potions | wenrexa.itch.io/potions1 | CC BY 4.0 (page) | Credit "Wenrexa" |
| Wenrexa Banners Kingdoms | wenrexa.itch.io/banners-kingdoms | No licence tag; author comment: "you can use my products in your projects" | Ask before shipping |
| CaptainSkolot swords, 100 shields, potions | captainskolot.itch.io | CC BY 4.0 tag; text: free+commercial use, no redistribution/resale of the assets on their own | Credit appreciated |
| CaptainSkolot magic books, castle backgrounds | captainskolot.itch.io | Page tag CC BY-NC-SA 4.0 but body text allows commercial use | Conflicting; ask the author before commercial release |
| CaptainSkolot lumberjack house, fiery dungeon, pastel landscapes backgrounds | captainskolot.itch.io | CC BY 4.0 tag; same text | Used: loading screen, notice-board poster |

KayKit by Kay Lousberg (www.kaylousberg.com). Quaternius models by @Quaternius (quaternius.com).

## Phase 3 – monsters
| Asset | Path | Source | Licence |
|---|---|---|---|
| Kenney Graveyard Kit 5.0 (21 FBX incl. ghost/skeleton/vampire/zombie/keeper characters + colormap) | Resources/ST/Grave, Resources/ST/Mon/Kenney_* | https://kenney.nl/assets/graveyard-kit (OpenGameArt mirror) | CC0 1.0 |
| Quaternius Easy Animated Enemies (Frog, Rat, Snake, Snake_angry, Spider, Wasp) | Resources/ST/Mon/Easy_* | https://quaternius.com (Animated Easy Enemies) | CC0 1.0 |
| Quaternius LowPoly Animated Monsters (Bat, Dragon, Skeleton, Slime) | Resources/ST/Mon/LP_* | https://quaternius.com (LowPoly Animated Monsters) | CC0 1.0 |
| Quaternius Bestiary – Dungeon Monsters (Imp, Puglin + textures) | Owned/Resources/STO/Mon (gitignored, NOT in repo) | Quaternius Bestiary pack | QAL – use in product allowed, asset redistribution forbidden; kept out of git |
| Death boss (st_death.glb; meshopt/webp decoded + textures resized to 1024 with gltf-transform) | Resources/Models/st_death.glb | Project-owned model from lootdaggers/death3d | Project-owned |
| UAL animation clips reused on Bestiary rigs | Resources/ST/Folk | Quaternius Universal Animation Library (already logged) | CC0 1.0 |

## Phase 3 cleanup / Phase 4
- Kenney Graveyard characters dropped from the crypt roster (style mismatch); files stay in repo (CC0), unused by rosters.
- Phase 4 VFX and telegraphs (StFx.shader, StFx.cs) are procedural, written for this project: no third-party assets.

## Phase 5 (skills, HUD, subclass skins) - no new third-party assets
- Arrows: `Weapons/arrow_bow.fbx` from **KayKit Adventurers (CC0)**, already imported above; it replaces the phase-4 cube arrows (StVfx.Arrow).
- All skill VFX are procedural (StFx/StVfx meshes on the existing StFx shader). The banner, Judgement hammer, crystals, flames, bubble, beams and lightning are built in code.
- Subclass outfit skins are runtime palette recolours of the existing KayKit Knight/Ranger/Mage atlases (StSkins). There are no new models or textures in git.
- Skill icons: the owned itch icon set in the gitignored `Owned/` folder (sk4_*), gradient-mapped per subclass palette at runtime. A procedural glyph fallback is used when Owned/ is absent, so the public repo builds without it.
- UI font: Unity's built-in LegacyRuntime.ttf.

## Phase 5b (fishing)
### CC0, committed (`Resources/ST/Fish/`, converted GLB -> FBX in Blender 4.2: meshes joined, normalised to 1 u, rod butt at origin / tip +Z)
| File | Source model (poly.pizza id) | Author | Licence |
|---|---|---|---|
| q_rod.fbx | Fishing Rod (0YAR0Lg58p) | Quaternius | CC0 1.0 |
| q_clownfish.fbx, q_salmon.fbx, q_tang.fbx | Fish (BEcU9rjiAq, XWl86YFtpF, Ymu8ftrmuT) | Quaternius | CC0 1.0 |
| q_bigeye.fbx | Clownfish (769fHo3eEB) | Quaternius | CC0 1.0 |
| q_fishbone.fbx | Fish Bone (bU5RLZnq6v) | Quaternius | CC0 1.0 |
| q_shark.fbx | Shark (YYsK3gRCBZ) | Quaternius | CC0 1.0 |
| q_angler.fbx | Anglerfish (MRjSlwCjHM) | Quaternius | CC0 1.0 |
| q_puffer.fbx | Puffer (UKHtgpxTOk) | Quaternius | CC0 1.0 |
| q_lionfish.fbx | Lionfish (czsz9Baw86) | Quaternius | CC0 1.0 |
| q_swordfish.fbx | Swordfish (7hMOlBjln0) | Quaternius | CC0 1.0 |
| q_butterfly.fbx | Butterfly Fish (s2MkBeSzGy) | Quaternius | CC0 1.0 |
| q_koi.fbx | Koi (qyGtRmhgzl) | Quaternius | CC0 1.0 |
| q_bluegold.fbx, q_goldfish.fbx | Blue Goldfish (imxZBHZ1yS), Goldfish (qS6CgsWFAh) | Quaternius | CC0 1.0 |
| q_lure.fbx | Lure (JknXyvHxtD) | Quaternius | CC0 1.0 |
Downloaded from https://poly.pizza/m/<id> (licence shown on each page as CC0 1.0). Treasure models reuse already-logged assets: KayKit `Props/Bag`, `Props/Chest_Wood` (CC0) and the repo gem meshes (`Models/gem_*`); ingots/medallions/keys are procedural boxes.

### Owned itch.io packs ($0 downloads from the user's owned library) - gitignored `Owned/Resources/STO/Fish*`, NOT in git
| Pack | Author | Used as | Licence / terms |
|---|---|---|---|
| 7T4E - Fish, Fishing Hooks, Fishing Lures, Cane Pole, Reel Fishing Poles | DreamingOfLight888 | catch icons (fish_t*, hook_t*, lure_t*), FISH/REEL button art (reel_t2), spot sign | Owned via the itch library (store terms: use in projects; no redistribution of the files) |
| 7T4E - Gems, Ingots, Keys, Medallions, Ores, Treasure Bags, Treasure Chests (already owned for phase 1) | DreamingOfLight888 | treasure icons | as above |
| Cartoon Fishes [Pack] | Wenrexa | fish icons (wx_01..21, 256x150) | Owned via the itch library; use in projects, no resale of the assets |
| Fishing Minigame SFX - 120 Game Sounds | candlelightgame | 20 SFX in STO/FishSfx (cast, plunk, nibble, bite alert, hook set, reel, drag, snap, splash, catch/rare/legendary/treasure/boot, escape) | Included LICENSE.txt: commercial use OK, editing OK, no attribution required; no redistribution as a sound pack |
| Fishing Assets / Tropical Fishing Assets (pixel art) | CaptainSkolot | downloaded, NOT used (pixel style clashes with the painted 7T4E/Wenrexa icons) | CC BY 4.0 tag (see CaptainSkolot row above) |
Without `Owned/` the game falls back to a procedural fish silhouette (icons, sign) and silent SFX; nothing else depends on the owned packs.

Everything else in fishing is procedural/code: pools, rim layout, cattails, lily pads, jetty, sign post, bobber, line ribbon, ripples, splashes, the IK fishing poses and all UI.

## Attack animations + targeting (ANIM pass)
| Asset | Version / tier | Source | Licence | Used for |
|---|---|---|---|---|
| Quaternius Universal Animation Library 2 | Standard (free, $0 tier), v2.2 | https://quaternius.itch.io/universal-animation-library-2 | CC0 1.0 (License.txt in zip) | Retarget source evaluated (sword combos, shield dash); the toolkit retargets UAL rigs onto Rig_Medium. Not shipped as raw clips. |
| Quaternius Universal Animation Library 1 | Standard (free) | https://quaternius.itch.io/universal-animation-library | CC0 1.0 (already logged above) | Retarget source evaluated (Spell_Simple_*) |
| KayKit Character Animations | Free 1.1 | https://kaylousberg.itch.io/kaykit-character-animations | CC0 1.0 (already logged above) | Base poses re-timed into the weighted HM_* clips |
| `Resources/ST/Anim/Rig_Medium_HMAttacks.fbx` | generated | anim/tools/build.py (Blender 4.2) | derivative of CC0 sources above, CC0 | 24 weighted attack clips (anticipation, hit-stop, overshoot, bow draw-to-cheek IK, staff gather IK) |
Not obtained (would need a sign-in; listed as options only): Kevin Iglesias "Basic Motions FREE", "Free 32 RPG Animations" and other free Unity Asset Store melee packs, Mixamo. Kenney (CC0): not evaluated - kenney.nl returned HTTP 403 to this box; its Animated Characters packs are a further CC0 option.
