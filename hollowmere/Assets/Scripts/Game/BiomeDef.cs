using System;
using System.Collections.Generic;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    [Serializable]
    public sealed class BiomeRoom
    {
        public string name;
        public int minW = 6, maxW = 10, minH = 6, maxH = 10;
        public float weight = 1f;
    }

    /// <summary>One depth band: surfaces, light, fog, clutter, and the room shapes the generator draws.</summary>
    public sealed class BiomeDef : ScriptableObject
    {
        public string id;
        public string displayName;
        public Theme theme;
        public int minDepth = 1;
        public int maxDepth = 5;
        public string floorMaterial = "catacomb_floor";
        public string wallMaterial = "crypt_wall";
        public string kitFloor = "kit_dun_floor_blood_4m";
        public Color lightColor = new Color(1f, 0.78f, 0.55f);
        public float lightIntensity = 1.35f;
        public Color fogColor = new Color(0.22f, 0.18f, 0.16f);
        public float fogStart = 22f;
        public float fogEnd = 64f;
        public Color ambient = new Color(0.16f, 0.14f, 0.18f);
        public string[] props;
        public float propDensity = 0.4f;
        public int maxProps = 16;
        public BiomeRoom[] rooms;
        public int minRooms = 6;
        public int sideRooms = 3;
        public float wideCorridor = 0.25f;

        public bool Contains(int depth) => depth >= minDepth && (maxDepth <= 0 || depth <= maxDepth);

        public BiomePlan ToPlan()
        {
            var list = new RoomTemplate[rooms != null ? rooms.Length : 0];
            for (int i = 0; i < list.Length; i++)
            {
                var r = rooms[i];
                list[i] = new RoomTemplate
                {
                    name = r.name,
                    minW = r.minW,
                    maxW = Mathf.Max(r.minW, r.maxW),
                    minH = r.minH,
                    maxH = Mathf.Max(r.minH, r.maxH),
                    weight = r.weight,
                };
            }
            return new BiomePlan
            {
                theme = theme,
                id = id,
                rooms = list,
                minRooms = minRooms,
                sideRooms = sideRooms,
                wideCorridor = wideCorridor,
            };
        }
    }

    public static class BiomeCatalog
    {
        static BiomeDef[] all;
        static bool tried;

        public static BiomeDef ForDepth(int depth)
        {
            Ensure();
            if (all == null) return null;
            for (int i = 0; i < all.Length; i++)
                if (all[i] != null && all[i].Contains(depth)) return all[i];
            return null;
        }

        public static BiomeDef ForTheme(Theme theme)
        {
            Ensure();
            if (all == null) return null;
            for (int i = 0; i < all.Length; i++)
                if (all[i] != null && all[i].theme == theme) return all[i];
            return null;
        }

        /// <summary>Point the core generator at this band's room list for the next build.</summary>
        public static void Install(int depth)
        {
            var def = ForDepth(depth);
            BiomePlans.Override = def != null ? def.ToPlan() : null;
        }

        static void Ensure()
        {
            if (tried) return;
            tried = true;
            all = Resources.LoadAll<BiomeDef>("Biomes");
        }
    }

    /// <summary>Corner clutter from the biome's prop list. Count is capped and far pieces stop drawing.</summary>
    public static class BiomeDress
    {
        public static void Scatter(DungeonMap map, Transform root, IList<Int2> blocked)
        {
            if (map == null || root == null || map.theme == Theme.Town) return;
            var def = BiomeCatalog.ForTheme(map.theme);
            if (def == null || def.props == null || def.props.Length == 0 || def.maxProps <= 0) return;
            var skip = new HashSet<Int2>();
            if (blocked != null) foreach (var p in blocked) skip.Add(p);
            skip.Add(map.entry);
            skip.Add(map.exit);
            var rng = new System.Random((int)(map.seed ^ 0x51A7));
            var batch = new GameObject("biomeProps");
            batch.transform.SetParent(root, false);
            int placed = 0;
            var spots = new List<Int2>();
            for (int y = 1; y < map.height - 1; y++)
                for (int x = 1; x < map.width - 1; x++)
                {
                    if (map.Get(x, y) != Tile.Floor) continue;
                    var p = new Int2(x, y);
                    if (skip.Contains(p)) continue;
                    if (p.y < map.entry.y + 2 && Math.Abs(p.x - map.entry.x) < 4) continue;
                    int walls = 0;
                    foreach (var d in Pathfinder.Dirs4)
                        if (map.Get(x + d.x, y + d.y) == Tile.Wall) walls++;
                    if (walls < 2) continue;
                    spots.Add(p);
                }
            for (int i = spots.Count - 1; i > 0; i--)
            {
                int j = rng.Next(i + 1);
                var tmp = spots[i];
                spots[i] = spots[j];
                spots[j] = tmp;
            }
            for (int i = 0; i < spots.Count && placed < def.maxProps; i++)
            {
                if (rng.NextDouble() > def.propDensity) continue;
                string key = def.props[rng.Next(def.props.Length)];
                var go = Art.Model(key, 0f, batch.transform);
                if (go == null) continue;
                var fit = go.GetComponent<ModelFit>();
                if (fit != null) fit.freeze = true;
                var at = World.ToWorld(spots[i]);
                go.transform.SetPositionAndRotation(at, Quaternion.Euler(0f, (float)rng.NextDouble() * 360f, 0f));
                foreach (var r in go.GetComponentsInChildren<Renderer>(true))
                {
                    if (!(r is MeshRenderer) && !(r is SkinnedMeshRenderer)) continue;
                    r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                }
                var lod = go.AddComponent<PropLod>();
                lod.hide = 24f;
                placed++;
            }
            Debug.Log("Hollowmere biome " + def.id + " props " + placed + "/" + def.maxProps
                + " rooms " + map.rooms.Count);
        }
    }

    /// <summary>Stops drawing a prop once the camera is far enough that it would not read on a phone.</summary>
    public sealed class PropLod : MonoBehaviour
    {
        public float hide = 24f;
        Renderer[] renderers;
        float next;

        void LateUpdate()
        {
            if (Time.time < next) return;
            next = Time.time + 0.4f;
            var cam = Camera.main;
            if (cam == null) return;
            if (renderers == null) renderers = GetComponentsInChildren<Renderer>(true);
            bool on = (cam.transform.position - transform.position).sqrMagnitude < hide * hide;
            for (int i = 0; i < renderers.Length; i++)
                if (renderers[i] != null) renderers[i].enabled = on;
        }
    }
}
