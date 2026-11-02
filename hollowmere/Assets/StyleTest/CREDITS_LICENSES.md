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
| KayKit Medieval Hexagon Pack | 1.0 FREE | https://kaylousberg.itch.io/kaykit-medieval-hexagon | CC0 1.0 (License.txt) | Blue + neutral buildings, decoration props and nature, shared texture hexagons_medieval.png (Resources/ST/Town/Hex) - town houses, tavern, church, smithy, windmill, horizon hills |
| Medieval Village Kit (algumacoisaqq / Daniel Gruginski) | FBX + PNG release | https://algumacoisaqq.itch.io (generator source https://github.com/danielgruginski/MedievalVillageKit) | CC0 1.0 (LICENSE.txt) | 121 VK pieces (market stalls, fountain, forge yard, lamps, signs, banners, fences, trees, bushes, rocks, graves...) + 38 textures + vk_mats.txt (converted from Data/materials.json) (Resources/ST/Town/VK). README states the kit was AI-generated (Blender Python scripts written with Claude Code, human-directed). |
| Quaternius LowPoly Animated Animals (Farm Animals Animated) | free upload | https://quaternius.itch.io/lowpoly-animated-animals | CC0 1.0 (itch page licence; no licence file in zip) | Cow, Horse, Pig, Pug, Sheep (Resources/ST/Town/Animals) |
| Quaternius Medieval Village MegaKit | Standard (free) | https://quaternius.itch.io/medieval-village-megakit | CC0 1.0 (License_Standard.txt) | Downloaded and evaluated; not imported yet (glTF-only textured modular houses) |
| Quaternius Fantasy Props MegaKit | Standard (free) | https://quaternius.itch.io/fantasy-props-megakit | CC0 1.0 | Downloaded and evaluated; not imported yet (VK props cover phase 1) |
| Quaternius Stylized Nature MegaKit | Standard (free) | https://quaternius.itch.io/stylized-nature-megakit | CC0 1.0 (License_Standard.txt) | Downloaded; reserved for phase 2 biomes |

Repo assets reused (already in Hollowmere, see Assets/Audio/CREDITS.md for CC-BY audio): StGlow overlay shader, KayKit dungeon arch/torches for the town's dungeon gate.

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
