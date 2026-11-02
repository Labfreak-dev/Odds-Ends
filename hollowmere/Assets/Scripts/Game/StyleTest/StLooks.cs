using UnityEngine;

namespace Hollowmere.StyleTest
{
    /// <summary>The three class base models plus the overlay-only progress layers (weapon swap, skin swap, tier glow).</summary>
    public class StLook
    {
        public string id, label, blurb, charRes, wR, wL, idle, run, attack, projectile;
        public float range = 2.8f, hitAt = 0.42f;
        public int glow; // 0 none, 2 rare (blue), 3 legendary (gold)

        public static StLook Knight() => new StLook { id = "knight", label = "Knight", blurb = "Sword & shield. Holds the line.", charRes = "Chars/Knight",
            wR = "Weapons/sword_1handed", wL = "Weapons/shield_badge_color", idle = "Idle_A", run = "Running_A", attack = "Melee_1H_Attack_Chop" };
        public static StLook Ranger() => new StLook { id = "ranger", label = "Ranger", blurb = "Bow. Strikes from range.", charRes = "Chars/Ranger",
            wL = "Weapons/bow_withString", idle = "Ranged_Bow_Idle", run = "Running_HoldingBow", attack = "Ranged_Bow_Release", projectile = "arrow", range = 12f, hitAt = 0.25f };
        public static StLook Mage() => new StLook { id = "mage", label = "Mage", blurb = "Staff. Bends arcane fire.", charRes = "Chars/Mage",
            wR = "Weapons/staff", idle = "Melee_2H_Idle", run = "Running_A", attack = "Ranged_Magic_Shoot", projectile = "orb", range = 12f, hitAt = 0.35f };

        public static StLook[] Base => new[] { Knight(), Ranger(), Mage() };

        /// <summary>Milestone "upgrade skin": a different complete KayKit character, same rig, same weapons.
        /// The free tier has no second mage model, so the mage has none.</summary>
        public StLook UpgradeSkin()
        {
            var l = (StLook)MemberwiseClone();
            if (id == "knight") { l.charRes = "Chars/Barbarian"; l.id = "knight_skin"; l.label = "Knight - Warlord skin"; }
            else if (id == "ranger") { l.charRes = "Chars/Rogue_Hooded"; l.id = "ranger_skin"; l.label = "Ranger - Hooded skin"; }
            else return null;
            return l;
        }

        /// <summary>Loadout k (0 = class default). Weapons/off-hands go on the shared sockets (hand_R/hand_L = KayKit handslot.r/.l),
        /// so every whole-outfit skin of the class takes the same loadouts.</summary>
        public StLook Loadout(int k)
        {
            if (k == 0) return this;
            var l = (StLook)MemberwiseClone();
            if (id.StartsWith("knight"))
            {
                if (k == 1) { l.wR = "Weapons/axe_1handed"; l.wL = "Weapons/shield_round_color"; l.id = id + "_axe"; l.label = label + " - axe + round shield"; }
                else { l.wR = "Weapons/sword_2handed"; l.wL = null; l.idle = "Melee_2H_Idle"; l.attack = "Melee_2H_Attack_Chop"; l.id = id + "_2h"; l.label = label + " - greatsword"; }
            }
            else if (id.StartsWith("ranger"))
            {
                if (k == 1) { l.wR = "Weapons/crossbow_1handed"; l.wL = "Weapons/dagger"; l.idle = "Ranged_1H_Aiming"; l.run = "Running_A"; l.attack = "Ranged_1H_Shoot"; l.id = id + "_xbow"; l.label = label + " - crossbow + dagger"; }
                else { l.wR = "Weapons/dagger"; l.wL = "Weapons/bow"; l.id = id + "_shortbow"; l.label = label + " - plain shortbow"; l.wR = null; }
            }
            else if (id.StartsWith("mage"))
            {
                if (k == 1) { l.wR = "Weapons/wand"; l.wL = "Weapons/spellbook_open"; l.idle = "Idle_B"; l.attack = "Ranged_Magic_Shoot"; l.id = id + "_wand"; l.label = label + " - wand + tome"; }
                else { l.wR = "Weapons/wand"; l.wL = "Weapons/spellbook_closed"; l.idle = "Idle_B"; l.attack = "Ranged_Magic_Shoot"; l.id = id + "_wandbook"; l.label = label + " - wand + closed grimoire"; }
            }
            return l;
        }

        public StLook WeaponSwap() => Loadout(1);

        public StLook WithGlow(int tier)
        {
            var l = (StLook)MemberwiseClone(); l.glow = tier; l.id = id + "_t" + tier; l.label = label + (tier == 3 ? " + legendary glow" : " + rare glow"); return l;
        }

        public StActor Build(Vector3 pos, float yaw)
        {
            var a = StActor.Make(charRes, pos, yaw);
            a.idle = idle; a.run = run; a.attack = attack; a.attackRange = range;
            a.SetWeapons(wR, wL);
            if (glow > 0) StGlow.Apply(a, glow);
            return a;
        }
    }

    public static class StGlow
    {
        static Shader shader;
        public static Material Mat(Color c, float mode, float power = 2.5f)
        {
            if (shader == null) shader = Shader.Find("Hollowmere/StGlow");
            var m = new Material(shader); m.SetColor("_Color", c); m.SetFloat("_Mode", mode); m.SetFloat("_Power", power); return m;
        }

        public static Color TierColor(int tier) => tier >= 3 ? new Color(2.2f, 1.4f, 0.35f) : new Color(0.35f, 0.8f, 2.2f);

        /// <summary>Overlay only: rim on the weapons (and a faint rim on the body), a rune ring at the feet, a small light. Base materials untouched.</summary>
        public static void Apply(StActor a, int tier)
        {
            var c = TierColor(tier);
            foreach (var w in new[] { a.weaponR, a.weaponL })
            {
                if (w == null) continue;
                foreach (var r in w.GetComponentsInChildren<Renderer>()) AddPass(r, Mat(c * 1.4f, 0, 1.6f));
            }
            // No body tint: the outfit keeps its own look; tier shows on weapons, the rune ring and a small light only.
            var ring = GameObject.CreatePrimitive(PrimitiveType.Quad);
            Object.Destroy(ring.GetComponent<Collider>());
            ring.name = "glow_ring"; ring.layer = 2;
            ring.transform.SetParent(a.transform, false);
            ring.transform.localPosition = new Vector3(0, 0.03f, 0); ring.transform.localRotation = Quaternion.Euler(90, 0, 0);
            ring.transform.localScale = Vector3.one * 2.0f / Mathf.Max(0.01f, a.transform.localScale.x) * 1.4f;
            var rr = ring.GetComponent<MeshRenderer>(); rr.sharedMaterial = Mat(c, 1); rr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            var lg = new GameObject("glow_light").AddComponent<Light>();
            lg.transform.SetParent(a.transform, false); lg.transform.localPosition = new Vector3(0, 0.15f, 0);
            lg.type = LightType.Point; lg.color = c.linear.maxColorComponent > 0 ? (Color)(c / c.maxColorComponent) : Color.white; lg.intensity = tier >= 3 ? 0.9f : 0.6f; lg.range = 4f; lg.shadows = LightShadows.None;
        }

        static void AddPass(Renderer r, Material m)
        {
            var mats = r.sharedMaterials; var n = new Material[mats.Length + 1];
            mats.CopyTo(n, 0); n[mats.Length] = m; r.sharedMaterials = n;
        }
    }
}
