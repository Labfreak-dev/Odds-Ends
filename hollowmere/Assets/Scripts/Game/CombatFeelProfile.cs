using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Hit-stop, camera kick, damage numbers, the monster flash, loot-beam tints,
    /// which footstep set a biome uses, and the death burst. Resources/CombatFeelProfile.
    /// </summary>
    public sealed class CombatFeelProfile : ScriptableObject
    {
        public int critStopMs = 60;
        public int killStopMs = 72;
        public int kickMm = 12;
        public int kickCapMm = 24;
        public int kicks = 1;

        public Color numberNormal = new Color(0.957f, 0.945f, 0.918f, 1f);
        public Color numberCrit = new Color(1f, 0.886f, 0.353f, 1f);
        public Color numberHurt = new Color(1f, 0.353f, 0.290f, 1f);

        public Color flash = Color.white;
        public float flashSeconds = 0.1f;

        public Color beamCommon = new Color(0.92f, 0.92f, 0.92f, 1f);
        public Color beamMagic = new Color(0.412f, 0.412f, 1f, 1f);
        public Color beamRare = new Color(1f, 1f, 0.25f, 1f);
        public Color beamLegendary = new Color(0.749f, 0.392f, 0.184f, 1f);
        public Color beamSet = new Color(0.15f, 1f, 0.2f, 1f);

        public string stepCrypt = "stone";
        public string stepCaverns = "dirt";
        public string stepForge = "stone";
        public string stepInfernal = "dirt";

        public string deathDust = "black_smoke_flipbook_5x5";
        public string deathEmber = "fire_flipbook_4x4";
        public string deathWisp = "holy_flipbook_4x4";
        public int wispCount = 3;

        static CombatFeelProfile active;

        public static CombatFeelProfile Active
        {
            get
            {
                if (active == null) active = Resources.Load<CombatFeelProfile>("CombatFeelProfile");
                return active;
            }
        }

        public static int StopMs(string kind)
        {
            var p = Active;
            if (p != null && kind == "crit") return Mathf.Clamp(p.critStopMs, 40, 80);
            if (p != null && kind == "kill") return Mathf.Clamp(p.killStopMs, 40, 80);
            return DesignTable.HitStopMs(kind);
        }

        public static int KickMm(string kind)
        {
            var p = Active;
            if (p == null || p.kicks == 0) return DesignTable.ShakeMm(kind);
            if (kind == "cap") return Mathf.Max(p.kickMm, p.kickCapMm);
            if (kind == "normal") return Mathf.Max(4, p.kickMm / 2);
            if (kind == "crit" || kind == "kill" || kind == "hurt" || kind == "skill") return Mathf.Max(0, p.kickMm);
            return DesignTable.ShakeMm(kind);
        }

        public static bool KicksOn => Active == null || Active.kicks != 0;

        public static Color NumberColor(string style)
        {
            var p = Active;
            if (p == null) return Art.Hex("#" + DesignTable.Number(style).Hex);
            if (style == "crit") return p.numberCrit;
            if (style == "hurt") return p.numberHurt;
            return p.numberNormal;
        }

        public static Color BeamColor(Rarity rarity)
        {
            var p = Active;
            if (p == null) return Art.Hex(DesignTable.BeamHex(rarity.ToString()));
            switch (rarity)
            {
                case Rarity.Magic: return p.beamMagic;
                case Rarity.Rare: return p.beamRare;
                case Rarity.Legendary: return p.beamLegendary;
                case Rarity.Set: return p.beamSet;
                default: return p.beamCommon;
            }
        }

        public static string Step(string biomeId)
        {
            var p = Active;
            if (p == null || string.IsNullOrEmpty(biomeId)) return null;
            switch (biomeId)
            {
                case "crypt": return p.stepCrypt;
                case "caverns": return p.stepCaverns;
                case "forge": return p.stepForge;
                case "infernal": return p.stepInfernal;
                default: return null;
            }
        }

        public static void Flash(Actor actor)
        {
            if (actor == null) return;
            var p = Active;
            var tint = p != null ? p.flash : Color.white;
            float seconds = p != null ? p.flashSeconds : 0.1f;
            var fx = actor.GetComponent<HitFlash>();
            if (fx == null) fx = actor.gameObject.AddComponent<HitFlash>();
            fx.Play(tint, seconds);
        }

        public static void Death(Vector3 at, bool undead)
        {
            var p = Active;
            string dust = p != null && !string.IsNullOrEmpty(p.deathDust) ? p.deathDust : "black_smoke_flipbook_5x5";
            string ember = p != null && !string.IsNullOrEmpty(p.deathEmber) ? p.deathEmber : "fire_flipbook_4x4";
            Fx.Flip(at + Vector3.up * 0.35f, new Color(0.72f, 0.68f, 0.6f, 1f), dust, 5, 5, 25, 1.5f);
            Fx.Flip(at + Vector3.up * 0.7f, new Color(1f, 0.5f, 0.18f, 1f), ember, 4, 4, 16, 1.05f);
            if (!undead) return;
            int n = p != null ? Mathf.Clamp(p.wispCount, 1, 4) : 3;
            string wisp = p != null && !string.IsNullOrEmpty(p.deathWisp) ? p.deathWisp : "holy_flipbook_4x4";
            var col = new Color(0.72f, 0.9f, 1f, 1f);
            for (int i = 0; i < n; i++)
            {
                var g = Art.VfxSprite(null, 0.42f, col, wisp);
                if (g == null) continue;
                g.name = "soulwisp";
                g.transform.position = at + new Vector3((i - 1) * 0.26f, 0.55f, 0f);
                g.AddComponent<FxLife>().Init(0.75f, Vector3.one * 0.32f, Vector3.one * 0.12f, 1.35f);
            }
        }

        public static bool Undead(MonsterDef def)
        {
            if (def == null) return false;
            if (def.family == "Undead") return true;
            string model = def.model ?? "";
            return model.Contains("skel") || model.Contains("wraith") || model.Contains("ghoul") || model.Contains("husk") || model.Contains("grave");
        }
    }

    /// <summary>One skinned material flashes and then returns. No extra light, so a pack of hits stays cheap.</summary>
    public sealed class HitFlash : MonoBehaviour
    {
        Renderer skin;
        Material mat;
        Color orig = Color.white;
        Color origEmit = Color.black;
        bool haveEmit;
        float left, dur;
        Color tint = Color.white;

        public void Play(Color c, float seconds)
        {
            tint = c;
            dur = Mathf.Max(0.04f, seconds);
            left = dur;
            if (mat == null)
            {
                skin = GetComponentInChildren<SkinnedMeshRenderer>(true);
                if (skin == null) return;
                mat = skin.material;
                if (mat.HasProperty("_BaseColor")) orig = mat.GetColor("_BaseColor");
                else if (mat.HasProperty("_Color")) orig = mat.color;
                haveEmit = mat.HasProperty("_EmissionColor");
                if (haveEmit) origEmit = mat.GetColor("_EmissionColor");
            }
            Paint(1f);
        }

        void Update()
        {
            if (left <= 0f || mat == null) return;
            left -= Time.deltaTime;
            Paint(Mathf.Clamp01(left / dur));
        }

        void Paint(float k)
        {
            var c = Color.Lerp(orig, tint, k * 0.8f);
            if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", c);
            if (mat.HasProperty("_Color")) mat.SetColor("_Color", c);
            mat.color = c;
            if (!haveEmit) return;
            mat.EnableKeyword("_EMISSION");
            mat.SetColor("_EmissionColor", Color.Lerp(origEmit, tint * 1.4f, k));
        }
    }
}
