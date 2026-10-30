# Hollowmere

A mobile dungeon crawler for Unity. The structure follows the old *Fate* games: a
lakeside town, a dungeon that goes down floor after floor, a companion who fights beside
you and runs back to town to sell your junk, and fishing holes whose catch transforms
that companion. The loot and skills follow *Diablo III*: rarity tiers with affixes,
legendary powers, set bonuses, smart loot, a mystic and a blacksmith, Torment
difficulties, and skills whose runes change how they work.

Everything here (names, classes, monsters, items, fish, places) is original.

## Open it

1. Install **Unity 6** (6000.0 LTS) with Android and/or iOS build support.
2. In Unity Hub choose *Add project from disk* and pick this `hollowmere/` folder. Unity
   fetches the packages in `Packages/manifest.json` (uGUI, Input System, glTFast for
   the `.glb` models) and creates the rest of `ProjectSettings/`.
3. Open any scene, even the empty default one, and press Play. The game builds itself
   from code (`Boot.cs`), so there are no scenes or prefabs to wire up.
4. On first open, if Unity asks which input backend to use, either works. The code
   supports the old Input Manager, the new Input System, or both.

Desktop test keys: WASD to move, Space to attack, 1–4 for skills, Q for a potion, E to
use things, I for the bag, K for skills, P for the companion, T to read a portal scroll.

For phones: *File → Build Profiles*, pick Android or iOS, landscape. The HUD is built
for touch, with a floating thumbstick on the left and attack, skill, potion and portal
buttons on the right. It keeps clear of notches.

## How it plays

- **Town (Hollowmere).** Merchant (potions, portal scrolls, selling), Blacksmith
  (salvage into scrap, dust and souls), Mystic (re-roll one affix per item, D3-style),
  Curio Dealer (gamble gold for a mystery item of a chosen slot), Stash, Quest Board
  (bounties, culls, fishing orders, depth goals), the Old Angler and the town lake, and
  the entrance to the Hollow.
- **The Hollow.** Endless generated floors. The theme changes every 10 floors (Crypts,
  Caverns, Sunken Halls, Ember Depths). Monster level follows depth. Every 5th floor has
  a guardian boss, and killing it opens a waystone to the floor below. Packs can be
  normal, champions (blue) or an elite (yellow, with a name) with minions. Elites roll
  affixes: Hasty, Armored, Vampiric, Molten, Frozen, Teleporter, Shielding, Plagued and
  Extra Health. Floors also have chests, shrines and fishing pools.
- **Classes.**
  - Ironclad: Strength, Fury, melee.
  - Stalker: Dexterity, Focus, bows and traps.
  - Hexweaver: Intelligence, Arcana, spells and a thrall.

  Each class has 6 active skills with 3 runes each and 4 passives, on a tree gated by
  level and prerequisites. You get one point per level, plus a bonus point every 10
  levels. The tree is free to reset in town.
- **Loot.** Rarities are common, magic, rare, legendary and set, plus ancient
  legendaries at max level. Primary and secondary affixes scale by item level. 16
  legendary powers change skills, elements, the companion or fishing. There are 4 sets
  with 2- and 4-piece bonuses (one per class, plus *The Old Angler's Kit*). Tooltips
  compare against what you wear and show the change in damage, toughness and life. Ten
  difficulties run from Normal to Torment VI, and Torment unlocks at 70.
- **Fishing.** Cast, wait, and ignore the nibbles. Strike when the bobber goes under.
  Then hold to reel and let go when the line gets tight. Twelve species. Some heal, some
  give buffs, and some transform the companion: Cinder Drake, Frost Wyrm, Thunder Hound,
  Gilded Serpent, Boneguard, and two permanent legendary forms. About 15% of casts bring
  up gold, junk or an item instead of a fish.
- **Companion.** A hound or a lynx. It fights, and when beaten it flees instead of
  dying. Load its saddlebags and send it to town, and it comes back with the gold.
- **Death.** Wake in town for free, or pay 10% of your gold to get up where you fell.

## Code layout

```
Assets/Scripts/Core/   engine-free C# (no UnityEngine): all rules, tables and formulas
  Balance.cs           every tuning curve: XP, monster scaling, difficulty multipliers
  Items.cs ItemDb.cs   item model, bases, affixes, legendary powers, sets
  Loot.cs              rarity rolls, smart loot, affix rolling, naming, mystic enchant
  Hero.cs              level/XP, inventory, equip rules (rings, two-handers, quivers), stats
  Skills.cs            skill tree, runes, and SkillCast resolution (rank + rune + gear + legendaries)
  Combat.cs            hit formulas (hero, companion, monster to hero)
  Monsters.cs          monster defs, bosses, elite affixes, level scaling
  Dungeon.cs           floor generator (rooms, corridors, pools, packs, chests), A*, line of sight
  Fishing.cs           fish table, FishingSession state machine, companion forms and sell trips
  GameState.cs         the save (JsonUtility-compatible), quests, town services, town layout
  ItemText.cs          tooltip text with rich-text colours and upgrade comparison
Assets/Scripts/Game/   Unity layer
  Boot.cs GameManager.cs  bootstrap, save/load, town and floor building, events
  World.cs Art.cs Fx.cs   level meshes, model loading with primitive fallbacks, effects
  Actor.cs HeroActor.cs MonsterActor.cs PetActor.cs SkillRunner.cs Pickup.cs
  UI/                     HUD, thumbstick, and every screen, built with uGUI in code
tests/CoreTests/          console runner: about 15,900 invariant checks plus a 40-floor bot playthrough
tests/UnityCompileCheck/  compiles every script against Unity's reference assemblies (nothing runs)
tools/                    asset manifest and generator
```

The core has no Unity dependency, so the rules are tested without the editor:

```bash
dotnet run -c Release --project tests/CoreTests      # expects "ALL CORE CHECKS PASSED"
dotnet build tests/UnityCompileCheck                  # expects "Build succeeded."
```

The bot playthrough prints the pacing per class. Hero level stays close to the floor
number. A normal monster takes about 1–2 seconds to kill, a guardian 15–35 seconds, and
a floor about 1–3 minutes.

## Assets

Each asset is optional. The game loads `Resources/Models/<key>` and
`Resources/Audio/<key>`. When one is missing it builds a coloured stand-in from
primitives, or stays silent. `tools/assets.json` lists every key with its generation
prompt.

```bash
python3 tools/fetch_assets.py --list                    # what's present, what's missing
python3 tools/fetch_assets.py --models --priority 2     # Meshy (MESHY_API_KEY)
python3 tools/fetch_assets.py --audio                   # ElevenLabs (ELEVENLABS_API_KEY)
```

- **Meshy**: these models are in the repo now.
  - `pet_hound`, textured.
  - `mon_bonewalker`, rigged, plus `mon_bonewalker_walk` with a walk cycle. Monsters
    play it while moving.

  The account ran down to 6 credits after these. The remaining 19 models in the
  manifest (3 heroes, 5 monsters, a boss, NPCs, props) are queued by priority. Paid
  task ids are journalled in `tools/.meshy-tasks.json`, so an interrupted run resumes
  rather than paying twice.
- **ElevenLabs**: 22 sound effects and music tracks are in the manifest. No API key was
  available in the build environment, so none are generated yet.
- **itch.io**: free packs mostly need a logged-in browser download. Drop the files
  under `Assets/Resources/Models` or `Assets/Resources/Audio` and rename them to the
  manifest keys. FBX, GLB and OGG/MP3/WAV all work.

## Not built yet

- Not yet tested in the Unity editor. The scripts compile against Unity's reference
  assemblies and the rules are unit-tested, but scene behaviour needs a first run in
  the editor and on a device.
- Item icons. Cells show the slot name in rarity colour.
- A minimap.
- Skill VFX beyond primitive rings, bursts and beams.
- Hero models, and walk cycles for anything but the skeleton.
