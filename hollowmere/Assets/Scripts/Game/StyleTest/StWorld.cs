using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest
{
    /// <summary>Small KayKit Dungeon room with stylized lighting: cool moonlit ambient, warm flickering torches, light fog.</summary>
    public static class StWorld
    {
        public static float Tile = 4f;
        public static Vector3 RoomMin, RoomMax;
        public static readonly List<Transform> Built = new List<Transform>();

        static GameObject Put(string name, Vector3 target, float yaw, bool snapGround = true)
        {
            var g = StKit.Spawn("Dungeon/" + name, Vector3.zero, yaw);
            var b = Bounds(g);
            var d = new Vector3(target.x - b.center.x, snapGround ? target.y - b.min.y : target.y - b.center.y, target.z - b.center.z);
            g.transform.position += d;
            Built.Add(g.transform);
            return g;
        }

        public static Bounds Bounds(GameObject g)
        {
            var rs = g.GetComponentsInChildren<Renderer>();
            if (rs.Length == 0) return new Bounds(g.transform.position, Vector3.zero);
            var b = rs[0].bounds; foreach (var r in rs) b.Encapsulate(r.bounds); return b;
        }

        public static void BuildRoom(int nx = 6, int nz = 5)
        {
            var probe = StKit.Spawn("Dungeon/floor_tile_large", Vector3.zero, 0);
            var pb = Bounds(probe); Tile = Mathf.Max(1f, Mathf.Round(Mathf.Max(pb.size.x, pb.size.z))); Object.Destroy(probe);
            Debug.Log("[ST] dungeon tile " + Tile + " size " + pb.size);
            float half = Tile * 0.5f;
            float x0 = -nx * half, z0 = -nz * half;
            RoomMin = new Vector3(x0, 0, z0); RoomMax = new Vector3(-x0, 0, -z0);
            string[] floors = { "floor_tile_large", "floor_tile_large", "floor_tile_large_rocks", "floor_tile_large" };
            var rng = new System.Random(7);
            for (int i = 0; i < nx; i++)
                for (int k = 0; k < nz; k++)
                {
                    var f = floors[rng.Next(floors.Length)];
                    if (i == 4 && k == 1) f = "floor_tile_big_grate";
                    var g = Put(f, new Vector3(x0 + half + i * Tile, 0, z0 + half + k * Tile), 90 * rng.Next(4), false);
                    var b = Bounds(g); g.transform.position += new Vector3(0, -b.max.y, 0);
                }
            // walls: north row, west and east columns (camera looks north from the open south side)
            for (int i = 0; i < nx; i++)
            {
                string w = i == 1 ? "wall_arched" : i == 3 ? "wall_cracked" : i == 4 ? "wall_arched" : "wall";
                Wall(w, new Vector3(x0 + half + i * Tile, 0, -z0), true);
            }
            for (int k = 0; k < nz; k++)
            {
                Wall(k == 1 ? "wall_doorway" : "wall", new Vector3(x0, 0, z0 + half + k * Tile), false);
                Wall(k == 2 ? "wall_broken" : "wall", new Vector3(-x0, 0, z0 + half + k * Tile), false);
            }
            Put("wall_corner", new Vector3(x0, 0, -z0), 0);
            Put("wall_corner", new Vector3(-x0, 0, -z0), 90);
            // props
            Put("pillar_decorated", new Vector3(x0 + 2.2f, 0, -z0 - 2.2f), 0);
            Put("pillar_decorated", new Vector3(-x0 - 2.2f, 0, -z0 - 2.2f), 0);
            Put("pillar", new Vector3(x0 + 2.2f, 0, z0 + 3.5f), 0);
            Put("pillar", new Vector3(-x0 - 2.2f, 0, z0 + 3.5f), 0);
            Put("chest_gold", new Vector3(0.2f, 0, -z0 - 1.3f), 180);
            Put("coin_stack_large", new Vector3(1.4f, 0, -z0 - 1.2f), 0);
            Put("barrel_large", new Vector3(x0 + 1.0f, 0, -z0 - 4.6f), 0);
            Put("barrel_small", new Vector3(x0 + 1.0f, 0, -z0 - 5.8f), 30);
            Put("box_stacked", new Vector3(-x0 - 1.2f, 0, -z0 - 4.5f), 70);
            Put("crates_stacked", new Vector3(-x0 - 1.3f, 0, z0 + 6.2f), 90);
            Put("keg", new Vector3(x0 + 1.0f, 0, z0 + 6.4f), 0);
            Put("rubble_half", new Vector3(-x0 - 1.6f, 0, 1.5f), 20);
            Put("rubble_half", new Vector3(x0 + 2.0f, 0, z0 + 1.8f), 60);
            Put("sword_shield_broken", new Vector3(-6.5f, 0, 3.2f), 40);
            Put("table_medium_broken", new Vector3(x0 + 2.0f, 0, -1.5f), 80);
            Put("candle_triple", new Vector3(-1.4f, 0, -z0 - 1.0f), 0);
            Put("candle_lit", new Vector3(1.9f, 0, -z0 - 0.9f), 0);
            Put("banner_patternA_red", new Vector3(x0 + half + Tile * 0.5f, 2.3f, -z0 - 0.45f), 0, false);
            Put("banner_shield_red", new Vector3(-x0 - half - Tile * 0.5f, 2.3f, -z0 - 0.45f), 0, false);
            // torches + warm lights
            Torch(new Vector3(-Tile * 0.5f - 0.0f, 2.2f, -z0 - 0.35f), 180);
            Torch(new Vector3(Tile * 0.5f + 0.0f, 2.2f, -z0 - 0.35f), 180);
            Torch(new Vector3(x0 + 0.35f, 2.2f, 0.0f), 90);
            Torch(new Vector3(-x0 - 0.35f, 2.2f, 0.0f), -90);
            Torch(new Vector3(x0 + 0.35f, 2.2f, z0 + 3.0f), 90);
            Torch(new Vector3(-x0 - 0.35f, 2.2f, z0 + 3.0f), -90);
            Torch(new Vector3(-Tile * 2.0f, 2.2f, -z0 - 0.35f), 180);
            Torch(new Vector3(Tile * 2.0f, 2.2f, -z0 - 0.35f), 180);
        }

        static void Wall(string name, Vector3 edgeCenter, bool alongX)
        {
            var g = StKit.Spawn("Dungeon/" + name, Vector3.zero, 0);
            var b = Bounds(g);
            bool runsX = b.size.x >= b.size.z;
            if (runsX != alongX) g.transform.rotation = Quaternion.Euler(0, 90, 0);
            b = Bounds(g);
            g.transform.position += new Vector3(edgeCenter.x - b.center.x, -b.min.y, edgeCenter.z - b.center.z);
            Built.Add(g.transform);
        }

        static void Torch(Vector3 pos, float yaw)
        {
            var g = Put("torch_mounted", pos, yaw, false);
            var l = new GameObject("torch_light").AddComponent<Light>();
            l.type = LightType.Point; l.color = new Color(1f, 0.58f, 0.26f); l.intensity = 7f; l.range = 11f;
            l.shadows = LightShadows.None;
            l.transform.position = pos + Quaternion.Euler(0, yaw, 0) * new Vector3(0, 0.45f, 0.5f);
            l.gameObject.AddComponent<StFlicker>();
            var fl = GameObject.CreatePrimitive(PrimitiveType.Quad); Object.Destroy(fl.GetComponent<Collider>());
            fl.transform.position = l.transform.position + Vector3.up * 0.05f; fl.transform.localScale = Vector3.one * 0.55f;
            fl.GetComponent<MeshRenderer>().sharedMaterial = StGlow.Mat(new Color(2.4f, 1.1f, 0.35f), 2);
            fl.AddComponent<StBillboard>();
        }

        public static void DungeonLighting()
        {
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.36f, 0.42f, 0.62f);
            RenderSettings.ambientEquatorColor = new Color(0.26f, 0.24f, 0.30f);
            RenderSettings.ambientGroundColor = new Color(0.13f, 0.11f, 0.11f);
            RenderSettings.fog = true; RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = new Color(0.07f, 0.07f, 0.11f); RenderSettings.fogStartDistance = 22; RenderSettings.fogEndDistance = 55;
            var sun = new GameObject("moon").AddComponent<Light>();
            sun.type = LightType.Directional; sun.color = new Color(0.72f, 0.80f, 1f); sun.intensity = 0.85f;
            sun.shadows = LightShadows.Soft; sun.shadowStrength = 0.75f;
            sun.transform.rotation = Quaternion.Euler(58, -28, 0);
        }

        public static void NeutralLighting()
        {
            RenderSettings.fog = false;
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.62f, 0.64f, 0.68f);
            RenderSettings.ambientEquatorColor = new Color(0.5f, 0.5f, 0.5f);
            RenderSettings.ambientGroundColor = new Color(0.32f, 0.31f, 0.30f);
            var key = new GameObject("key").AddComponent<Light>();
            key.type = LightType.Directional; key.intensity = 1.25f; key.color = new Color(1f, 0.97f, 0.92f); key.shadows = LightShadows.Soft;
            key.transform.rotation = Quaternion.Euler(35, 150, 0);
            var fill = new GameObject("fill").AddComponent<Light>();
            fill.type = LightType.Directional; fill.intensity = 0.45f; fill.color = new Color(0.85f, 0.9f, 1f);
            fill.transform.rotation = Quaternion.Euler(20, -150, 0);
            var rim = new GameObject("rim").AddComponent<Light>();
            rim.type = LightType.Directional; rim.intensity = 0.55f; rim.transform.rotation = Quaternion.Euler(30, 0, 0);
        }
    }

    public class StFlicker : MonoBehaviour
    {
        Light l; float baseI; float seed;
        void Start() { l = GetComponent<Light>(); baseI = l.intensity; seed = Random.value * 10; }
        void Update() { l.intensity = baseI * (0.88f + 0.12f * Mathf.PerlinNoise(seed, Time.time * 4f)); }
    }

    public class StBillboard : MonoBehaviour
    {
        void LateUpdate() { var c = Camera.main; if (c) transform.rotation = c.transform.rotation; }
    }
}
