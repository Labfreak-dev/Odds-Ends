# Restructure: fixed class models, whole-outfit skins, gear = stats (design note)

## Decisions this follows (user)
- The class is picked **at character creation**: Knight, Ranger or Mage. This replaces the classless hero. The "look follows weapon type" option is dropped.
- Each class wears **one whole outfit model** at a time. There are no per-piece armour meshes on the body. Subclass and class upgrades and milestones unlock new whole-outfit skins.
- Armour drops are **stats only**.
- **Weapons and off-hands stay visible and swappable** (sword, axe, greatsword, bow, crossbow, wand, staff, shields, quivers, tomes and orbs). They attach to every skin of the class, held by the handle.
- Tier and rarity show as **overlays only** (weapon rim glow, rune ring at the feet, small light, auras). They never re-tint or swap the outfit.

## Shared socket standard (every outfit model must provide these)
All hero skins share one skeleton (in the test that's KayKit Rig_Medium). A skin is only valid if it has these bones or empties with the stated frames:
| Socket | Test rig bone | Frame convention | Used for |
|---|---|---|---|
| `hand_R` | `handslot.r` | origin = centre of the closed grip; weapon +Z (Unity) runs pommel→tip along the handle, so a weapon's pivot = its grip point | main hand: swords, axes, wands, staffs, crossbows, daggers |
| `hand_L` | `handslot.l` | same as hand_R, mirrored | shields (pivot = strap/handle), bows (pivot = riser grip), tomes, orbs, off-hand daggers |
| `back` | child of `chest`, offset behind the spine | +Y up along the spine, +Z out of the back | sheathed 2H weapons, shields when stowed, capes or VFX |
| `hip` | child of `hips`, left side | +Y down along the thigh | sheathed 1H weapon or dagger |
| `quiver` | child of `chest`, right shoulder blade | +Y towards the arrow tips | quivers, bolt cases |
Rules:
- A weapon asset's **pivot is its grip**. Every weapon is authored once, never per skin.
- Per-class **hold presets** are rotation offsets on the socket. For example, the test uses an identity rotation for every KayKit weapon. The staff is held upright through the `Melee_2H_Idle` stance rather than a per-skin offset.
- Per-loadout **anim sets** (idle/run/attack) come with the weapon type, not the skin. Examples: 1H+shield → `Melee_1H_*`, 2H → `Melee_2H_*`, bow → `Ranged_Bow_*`, crossbow → `Ranged_1H_*`, staff or wand → `Ranged_Magic_*`.
- QA gate for any new skin: render every loadout × {idle, run, attack} as a strip and check that the grip sits in the fist and that nothing goes through the body or floor. The style test's `-stMode shots` strips do this.
- `back`, `hip` and `quiver` are defined here but **not exercised in the test**, because the KayKit Ranger already has a quiver built into its mesh. Offsets would be authored once per rig.

## Code changes (current classes → new)
- **GearWardrobe** (mesh loading per slot, Fitted/ meshes, conform): **retire** for heroes. Replace it with `HeroSkin` (class, skinId → one prefab on the shared rig). Fitted and conform code drops out of the runtime.
- **GearAttach / FitPiece / GearConform / HandGrip / HandCurl / finger rig / VolumeHelpers**: delete the body-armour paths. Keep a thin `WeaponSockets`, meaning `Attach(weapon, socket)` with pivot = grip, as in StKit.Attach. Grip QA becomes a check that the weapon pivot equals the socket.
- **RarityLook / RarityBook / RarityVfx**: keep rarity as data. Visuals become an `OverlayFx` component (weapon rim pass, ring, aura, light) driven by tier. There's **no material or mesh change on the outfit**, as in StGlow.Apply in the test.
- **Item data**: armour items lose mesh references and keep stats and affixes. Weapon items keep `weaponType` (which drives the anim set and socket) and `meshId`.
- **HeroActor anim driver**: choose the clip set by `weaponType` rather than by gear.
- **Character creator**: 3 class choices with the base models on pedestals, as in the test's `ShowCreator`. Skin picker later.
- **Saves**: migrate the current classless save to the class nearest the equipped weapon type, then let the player re-pick once.
- **Unlocks**: `SkinUnlocks` table (milestone, subclass or class upgrade → skinId). The skin is purely visual.

## Pros / cons of this structure
+ Nothing can tear or clip at the body. Each outfit is authored and skinned as a whole by the artist.
+ Far less runtime code (no conform, no fitting), and QA is reduced to sockets and strips.
+ Cheap content: atlas recolours become skins, and Meshy rigid weapons become loot visuals.
− Less visible loot variety on the body. Progress shows through the weapon, the overlays and occasional skins.
− Every skin has to follow the socket standard and the shared rig. Bought packs need to be on, or retargeted to, the same rig.
− Mage has only one free model, so the mage skins need recolours or a paid pack.
