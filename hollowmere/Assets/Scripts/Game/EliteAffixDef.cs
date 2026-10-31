using System.Collections.Generic;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>One elite affix: the core behaviour, the name on the plate, and the rim colour.</summary>
    public sealed class EliteAffixDef : ScriptableObject
    {
        public EliteAffix affix;
        public string displayName;
        public Color tint = Color.white;
    }

    /// <summary>Loads the affix list the game is allowed to roll. Core tests leave the full enum in place.</summary>
    public static class AffixCatalog
    {
        static EliteAffixDef[] all;
        static bool tried;

        public static void Install()
        {
            Ensure();
            if (all == null || all.Length == 0) return;
            var ids = new List<EliteAffix>();
            for (int i = 0; i < all.Length; i++)
            {
                if (all[i] == null || ids.Contains(all[i].affix)) continue;
                ids.Add(all[i].affix);
            }
            if (ids.Count > 0) MonsterDb.UseAffixes(ids.ToArray());
        }

        public static string Label(EliteAffix id)
        {
            var def = Find(id);
            return def != null && !string.IsNullOrEmpty(def.displayName) ? def.displayName : MonsterDb.AffixName(id);
        }

        public static Color Tint(EliteAffix id)
        {
            var def = Find(id);
            return def != null ? def.tint : Color.white;
        }

        static EliteAffixDef Find(EliteAffix id)
        {
            Ensure();
            if (all == null) return null;
            for (int i = 0; i < all.Length; i++)
                if (all[i] != null && all[i].affix == id) return all[i];
            return null;
        }

        static void Ensure()
        {
            if (tried) return;
            tried = true;
            all = Resources.LoadAll<EliteAffixDef>("Affixes");
        }
    }
}
