# Unity handoff for Hollowmere

This is for whoever picks the project up inside the Unity editor. Everything up to
this point was written and verified outside Unity:

- The game rules pass about 15,900 automated checks, including a 40-floor bot
  playthrough.
- Every script compiles against Unity's reference assemblies.

Nobody has pressed Play yet. Your job starts there.

Read `README.md` first for what the game is and where the code lives.

## 1. Open and first run

1. Use **Unity 6 (6000.0 LTS)**. Add the `hollowmere/` folder in Unity Hub and open it.
   A newer 6000.x patch is fine, so accept the upgrade prompt if one appears.
2. Unity resolves `Packages/manifest.json`:
   - glTFast 6.18.0, which imports the `.glb` models
   - Input System 1.19.0
   - uGUI
3. If Unity asks to enable the new Input System backend, choose **Yes** (or "Both").
   The code handles either.
4. Open the default scene (or make an empty one) and press **Play**. `Boot.cs` builds
   everything from code: camera, light, UI and world. You should see the title screen.
   Pick a class and press Begin.

Desktop keys:

| Key | Action |
|---|---|
| WASD | move |
| Space | attack |
| 1–4 | skills |
| Q | potion |
| E | use the thing you're next to |
| I | bag |
| K | skills |
| P | companion |
| T | town portal |

## 2. Model import settings (check these first)

The 28 Meshy models are in `Assets/Resources/Models/`. Files named `<key>_walk.glb`
contain a rigged walk cycle. Code loads them with `Resources.Load` by key.

- **Animation.** Select any `_walk.glb`. In the glTFast importer, set
  **Animation → Legacy** and apply. `ModelAnim` (in `Art.cs`) drives the legacy
  `Animation` component. It also handles an `Animator`, but a Mecanim import has no
  controller and so won't play by itself. Apply the setting to every `_walk.glb`, in
  one multi-select.
- **Facing.** Walk around in Play mode. If heroes and monsters move backwards, set
  `Art.ModelYaw = 180f` in `Art.cs`. That one constant applies to every model.
- **Scale.** `Art.Model` rescales each model to a target height and puts its feet on
  the ground, so there's nothing to do here unless something looks off.
- **Materials.** If any model renders pink, the render pipeline doesn't match the
  material. The project uses the Built-in pipeline by default. If you switch to URP,
  run the URP material converter. Procedural materials clone the primitive default
  material, so they follow the active pipeline automatically.

## 3. First-run checklist

Report anything that fails, along with the console error.

- [ ] Title screen appears. New hero → town loads with NPCs, lake, dungeon gate.
- [ ] Thumbstick moves the hero. Camera follows. Hero can't walk through walls or water.
- [ ] Each NPC's action button opens its screen; game pauses while a screen is open.
- [ ] Merchant: buy potions/portals. Gambler gives an item. Stash moves items.
- [ ] Town lake: Fish → cast, wait, strike on BITE, hold/release to reel, catch lands in bag.
- [ ] Enter The Hollow → floor 1 builds, monsters chase and attack, damage numbers show.
- [ ] Attack button (hold) auto-targets. Each class's skills fire (try all 4 buttons).
- [ ] Loot drops. Legendary items have a light pillar. Walking over items picks them up.
- [ ] Bag: equip, compare tooltip shows green/red deltas, unequip.
- [ ] Companion follows and fights. Feed it a fish → it changes colour/form.
- [ ] Companion screen: load items, send to town, it returns with gold (~45 s).
- [ ] Floor 5 guardian: boss bar appears; stairs locked until it dies.
- [ ] Die → death screen → both options work.
- [ ] Portal scroll → town → portal back returns to the same spot.
- [ ] Quit to title → Continue restores the save.
- [ ] Build to an Android phone (landscape): touch controls, safe area, 60 fps.

## 4. Things to build next (in Unity)

These are listed in priority order.

1. **Fix whatever the checklist turns up.**
2. **Skill visuals.** Effects are primitive rings, beams and spheres (`Fx.cs`,
   `SkillRunner.cs`). Particle systems per element would be a big improvement.
3. **Item icons.** Bag cells show text (`ItemUi.Cell` in `UI/ItemScreens.cs`). You
   could render each base model to a sprite, or use an itch.io icon pack keyed by base
   id.
4. **Minimap.** The floor grid is `World.Map` (`DungeonMap.tiles`). A small RawImage
   texture painted from it, with revealed tiles, is enough.
5. **Audio.** The 22 keys are in `tools/assets.json`. The files go in
   `Assets/Resources/Audio/<key>.mp3`. They play automatically once present.
6. **Attack animations.** The Meshy rigs only include walk and run clips. Mixamo or
   Meshy's animation library could supply attacks; a Mecanim controller would then
   replace `ModelAnim`.

## 5. Rules for changing code

- **Keep `Assets/Scripts/Core/` free of UnityEngine.** All game rules and numbers live
  there, and the tests run without Unity. After changing anything in Core, run:
  ```bash
  dotnet run -c Release --project tests/CoreTests    # must end "ALL CORE CHECKS PASSED"
  dotnet build tests/UnityCompileCheck                # must say "Build succeeded."
  ```
  (This needs the .NET 8 SDK. Ubuntu: `apt-get install dotnet-sdk-8.0`.)
- **Tuning goes in `Balance.cs`.** The bot playthrough in the tests prints pacing per
  class. Keep normals at about 1–2 s to kill and guardians at about 15–40 s.
- **Saves use `JsonUtility`.** That means no dictionaries, no properties and no
  polymorphism in save classes. Null strings come back as `""` and null items come
  back as empty objects. Use `Item.IsNone()` and `string.IsNullOrEmpty`, and call
  `GameState.Normalize()` after loading.
- **Assets are optional by design.** A missing model or sound falls back to a stand-in
  or silence. Keep that behaviour so the game always runs.
- **Commit the `.meta` files Unity generates**, along with any scene or prefab you add.
  The project currently has none because Unity creates them on first open.

## 6. Generating more assets

```bash
python3 tools/fetch_assets.py --list                  # status of every key
python3 tools/fetch_assets.py --models --ai-model meshy-6 --only <key> ...   # MESHY_API_KEY
python3 tools/fetch_assets.py --audio                 # ELEVENLABS_API_KEY
```

Add new keys to `tools/assets.json` first. Paid Meshy task ids are journalled in
`tools/.meshy-tasks.json`, so commit that file: it stops a re-run from paying twice.
