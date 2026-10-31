using UnityEngine;

namespace Hollowmere
{
    /// <summary>Textures in Assets/Art/Combat, referenced so a player build includes them.</summary>
    public sealed class CombatArt : ScriptableObject
    {
        public Texture2D[] textures;
    }
}
