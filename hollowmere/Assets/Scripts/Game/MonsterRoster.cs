using UnityEngine;

namespace Hollowmere
{
    /// <summary>The monsters a biome is allowed to spawn. Bosses stay on the shared rotation.</summary>
    public sealed class MonsterRoster : ScriptableObject
    {
        public string id;
        public string[] monsterIds;
    }
}
