using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Modular town and dungeon pieces on the 2 m grid (World.T). Meshes ship without
    /// embedded textures. One shared PBR material per surface is applied here.
    /// </summary>
    public static class ModularKit
    {
        public static void Dress(DungeonMap map, Transform root)
        {
            if (map == null || root == null) return;
            if (map.theme == Theme.Town) Town(map, root);
            else Dungeon(map, root);
        }

        static void Town(DungeonMap map, Transform root)
        {
            int y = map.height - 2;
            int placed = 0;
            for (int x = 2; x + 1 < map.width - 1; x += 2)
            {
                if (map.Get(x, y) != Tile.Floor || map.Get(x + 1, y) != Tile.Floor) continue;
                string key = (x / 2) % 5 == 0 ? "kit_town_wall_doorway_4m" : "kit_town_wall_4m";
                if ((x / 2) % 7 == 3) key = "kit_town_timber_frame_4m";
                Place(key, root, new Int2(x, y), Quaternion.Euler(0f, 180f, 0f), "crypt_wall", false);
                placed++;
            }
            Place("kit_town_floor_cobble_4m", root, new Int2(2, 2), Quaternion.identity, "town_cobble", false);
            Place("kit_town_floor_dirt_4m", root, new Int2(map.width - 4, 2), Quaternion.identity, "dirt_path", false);
            Debug.Log("Hollowmere kit town pieces " + placed);
        }

        static void Dungeon(DungeonMap map, Transform root)
        {
            var at = map.entry;
            var band = BiomeCatalog.ForTheme(map.theme);
            string wall = band != null ? band.wallMaterial : "crypt_wall";
            Place("kit_dun_arch_4m", root, new Int2(at.x, at.y + 2), Quaternion.identity, wall, false);
            Place("kit_dun_pillar_stone_4m", root, new Int2(at.x + 2, at.y + 2), Quaternion.identity, wall, false);
            string floor = band != null ? band.kitFloor : "kit_dun_floor_blood_4m";
            string surf = band != null ? band.floorMaterial : "blood_stained_stone";
            Place(floor, root, new Int2(at.x, at.y + 3), Quaternion.identity, surf, surf == "lava");
        }

        static void Place(string key, Transform root, Int2 tile, Quaternion rot, string surface, bool emit)
        {
            if (tile.x < 1 || tile.y < 1) return;
            var go = Art.Model(key, 0f, root);
            if (go == null) return;
            var fit = go.GetComponent<ModelFit>();
            if (fit != null) fit.freeze = true;
            go.transform.SetPositionAndRotation(World.ToWorld(tile) + Vector3.up * 0.02f, rot);
            var mat = surface == "iron_plates"
                ? PbrKit.UrpLit(surface, 1.5f, new Color(0.78f, 0.74f, 0.7f), 0.4f, 0.38f)
                : Material(surface, emit);
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
            {
                if (!(r is MeshRenderer) && !(r is SkinnedMeshRenderer)) continue;
                var mats = r.sharedMaterials;
                for (int i = 0; i < mats.Length; i++) mats[i] = mat;
                r.sharedMaterials = mats;
            }
        }

        static Material Material(string surface, bool emit)
        {
            var m = PbrKit.Surface(surface, 2f, Color.white);
            if (!emit) return m;
            m.EnableKeyword("_EMISSION");
            if (m.HasProperty("_EmissionColor"))
                m.SetColor("_EmissionColor", new Color(2.4f, 0.45f, 0.05f));
            var glow = Resources.Load<Texture2D>("PbrKit/materials/lava/lava_emission");
            if (glow != null && m.HasProperty("_EmissionMap"))
                m.SetTexture("_EmissionMap", glow);
            return m;
        }
    }
}
