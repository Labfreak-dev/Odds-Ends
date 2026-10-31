using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Drop-in art from Assets/Art. The Resources catalog references the sprites, so a
    /// player build includes them. Missing entries fall back to the procedural art.
    /// </summary>
    public sealed class HollowmereArt : ScriptableObject
    {
        public Sprite[] sprites;
        public Texture2D[] grounds;
    }

    public static class ArtDrop
    {
        static HollowmereArt cat;
        static Dictionary<string, Sprite> byName;
        static bool tried;

        public static Sprite Sprite(string name)
        {
            Ensure();
            if (byName == null || string.IsNullOrEmpty(name)) return null;
            byName.TryGetValue(name, out var s);
            return s;
        }

        public static Texture2D Ground(string name)
        {
            Ensure();
            if (cat == null || cat.grounds == null) return null;
            for (int i = 0; i < cat.grounds.Length; i++)
                if (cat.grounds[i] != null && cat.grounds[i].name == name) return cat.grounds[i];
            return null;
        }

        public static Color RarityTint(string rarity)
        {
            switch ((rarity ?? "").ToLowerInvariant())
            {
                case "magic": return Hex("#6969FF");
                case "rare": return Hex("#FFFF00");
                case "legendary": return Hex("#BF642F");
                case "set": return Hex("#00FF00");
                case "unique": return Hex("#3CDCD2");
                case "mythic": return Hex("#E8403A");
                default: return Hex("#FFFFFF");
            }
        }

        public static Color BeamTint(string rarity)
        {
            switch ((rarity ?? "").ToLowerInvariant())
            {
                case "magic": return Hex("#6969FF");
                case "rare": return Hex("#FFE628");
                case "legendary": return Hex("#FF8C28");
                case "set": return Hex("#3CE650");
                case "unique": return Hex("#3CDCD2");
                case "mythic": return Hex("#E8403A");
                default: return Hex("#D8D8D8");
            }
        }

        static Color Hex(string hex)
        {
            return ColorUtility.TryParseHtmlString(hex, out var c) ? c : Color.white;
        }

        static void Ensure()
        {
            if (tried) return;
            tried = true;
            cat = Resources.Load<HollowmereArt>("HollowmereArt");
            byName = new Dictionary<string, Sprite>();
            if (cat == null || cat.sprites == null) return;
            for (int i = 0; i < cat.sprites.Length; i++)
            {
                var s = cat.sprites[i];
                if (s != null && !byName.ContainsKey(s.name)) byName[s.name] = s;
            }
        }
    }
}
