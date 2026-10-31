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
            if (string.IsNullOrEmpty(name)) return null;
            if (byName != null && byName.TryGetValue(name, out var s) && s != null && s.texture != null) return s;
            var loaded = Resources.Load<Sprite>("Art/Icons/" + name);
            if (loaded != null && loaded.texture != null)
            {
                if (byName != null) byName[name] = loaded;
                return loaded;
            }
            // Spell sheets were imported as Default textures (textureType 0). Load<Sprite>
            // returns null for those, which is how the bag drew a checker instead of the PNG.
            var tex = Resources.Load<Texture2D>("Art/Icons/" + name);
            if (tex == null) return null;
            var made = UnityEngine.Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), 100f);
            made.name = name;
            if (byName != null) byName[name] = made;
            return made;
        }

        public static Texture2D Tex(string name)
        {
            if (string.IsNullOrEmpty(name)) return null;
            return Resources.Load<Texture2D>("Art/Beams/" + name)
                ?? Resources.Load<Texture2D>("Art/" + name);
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
