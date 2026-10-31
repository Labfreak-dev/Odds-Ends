using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>Ground primitive, hop, and rarity motes. A mesh at Models/item_{baseId} replaces the primitive.
    /// Icons are generated at 64² until a painted sprite is catalogued. No paid meshes.</summary>
    public static class LootDrop
    {
        public static void Dress(Pickup pickup, Item it)
        {
            var host = new GameObject("model").transform;
            host.SetParent(pickup.transform, false);
            string cc0 = it.kind == ItemKind.Equipment ? Art.Cc0Gear(it.baseId) : null;
            string key = it.kind == ItemKind.Gem ? DesignTable.GemArt(it.baseId)
                : it.kind == ItemKind.Fish ? "fish_" + it.fishId
                : cc0 ?? ("drop_" + it.baseId);
            var dropped = Art.DropIn(key, host);
            if (dropped == null) Primitive(host, it);
            else if (it.kind == ItemKind.Gem) dropped.transform.localPosition = Vector3.up * 0.04f;
            var mote = DesignTable.Mote(it.rarity.ToString());
            var c = Art.Hex(DesignTable.BeamHex(it.rarity.ToString()));
            if (mote.Motes > 0) CombatSparks.Burst(pickup.transform.position + Vector3.up * 0.4f, c, mote.Motes >= 12 ? "crit" : mote.Motes >= 8 ? "skill" : "normal");
            Beam(host, it.rarity, c);
            host.gameObject.AddComponent<DropHop>();
            Sfx.Drop(it.rarity);
            if (it.rarity == Rarity.Legendary || it.rarity == Rarity.Set) AudioHub.Vary("legendary_sting", 0.8f);
        }

        static void Beam(Transform host, Rarity rarity, Color tint)
        {
            string key = rarity.ToString().ToLowerInvariant();
            float h = (float)DesignTable.BeamHeight * DesignTable.BeamRelMilli(key) / 1000f;
            var ground = ArtDrop.Tex("ground_" + key);
            if (ground != null)
            {
                var g = Quad(host, "ground", ground, tint);
                g.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
                g.transform.localPosition = new Vector3(0f, 0.03f, 0f);
                g.transform.localScale = new Vector3(1.35f, 1.35f, 1f);
            }
            var beam = ArtDrop.Tex("beam_" + key);
            if (beam == null) return;
            var b = Quad(host, "beam", beam, tint);
            b.transform.localPosition = new Vector3(0f, h * 0.5f, 0f);
            b.transform.localScale = new Vector3(0.55f, h, 1f);
            b.AddComponent<YawBillboard>();
        }

        static GameObject Quad(Transform parent, string name, Texture tex, Color tint)
        {
            var g = new GameObject(name);
            g.transform.SetParent(parent, false);
            var mf = g.AddComponent<MeshFilter>();
            mf.sharedMesh = UnitQuad();
            var mr = g.AddComponent<MeshRenderer>();
            mr.sharedMaterial = Art.GlowMat(tint, false, tex);
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            mr.receiveShadows = false;
            return g;
        }

        static Mesh quad;
        static Mesh UnitQuad()
        {
            if (quad != null) return quad;
            quad = new Mesh { name = "lootQuad" };
            quad.vertices = new[]
            {
                new Vector3(-0.5f, -0.5f, 0f), new Vector3(0.5f, -0.5f, 0f),
                new Vector3(-0.5f, 0.5f, 0f), new Vector3(0.5f, 0.5f, 0f),
            };
            quad.uv = new[] { new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0f, 1f), new Vector2(1f, 1f) };
            quad.triangles = new[] { 0, 2, 1, 2, 3, 1 };
            return quad;
        }

        static void Primitive(Transform host, Item it)
        {
            var slot = it.Base != null ? it.Base.slot : ItemSlot.MainHand;
            string key = slot == ItemSlot.MainHand ? "weapon" : slot == ItemSlot.OffHand ? "offhand" : slot.ToString().ToLowerInvariant();
            var row = DesignTable.GroundFor(key);
            float x = row.X / 1000f, y = row.Y / 1000f, z = row.Z / 1000f;
            if (slot == ItemSlot.MainHand && it.Base != null && it.Base.twoHanded)
                y = DesignTable.TwoHandMm / 1000f;
            var c = Art.Rarity(it.rarity);
            if (row.Shape == "sphere")
                Art.Sphere(host, Vector3.up * (y * 0.5f), new Vector3(x, y, z), Art.Mat(c, 0.4f));
            else
                Art.Cube(host, Vector3.up * (y * 0.5f), new Vector3(x, y, z), Art.Mat(c, 0.4f), Quaternion.Euler(0f, 25f, 0f));
        }
    }

    /// <summary>Beam faces the camera around Y only, so the pillar stays upright.</summary>
    public sealed class YawBillboard : MonoBehaviour
    {
        void LateUpdate()
        {
            var cam = Camera.main;
            if (cam == null) return;
            var to = cam.transform.position - transform.position;
            to.y = 0f;
            if (to.sqrMagnitude < 0.0001f) return;
            transform.rotation = Quaternion.LookRotation(to);
        }
    }

    public sealed class DropHop : MonoBehaviour
    {
        float t;
        float hop, dur;

        void Awake()
        {
            hop = DesignTable.HopMm / 1000f;
            dur = Mathf.Max(0.05f, DesignTable.HopMs / 1000f);
        }

        void Update()
        {
            t += Time.deltaTime;
            float y = t < dur ? Mathf.Sin(t / dur * Mathf.PI) * hop : 0f;
            if (t >= dur + DesignTable.SettleMs / 1000f) enabled = false;
            var lp = transform.localPosition;
            lp.y = y;
            transform.localPosition = lp;
        }
    }

    /// <summary>A 64×64 original icon per base id. A catalogued sprite replaces it.</summary>
    public static class ItemIcon
    {
        static readonly System.Collections.Generic.Dictionary<string, Sprite> cache = new System.Collections.Generic.Dictionary<string, Sprite>();

        public static Sprite For(Item it)
        {
            if (Item.IsNone(it)) return null;
            if (it.kind == ItemKind.Fish) return Get("fish_" + it.fishId);
            if (it.kind == ItemKind.Gem) return Get(DesignTable.GemArt(it.baseId) ?? it.baseId);
            return Get(it.baseId);
        }

        public static Sprite Get(string id)
        {
            if (string.IsNullOrEmpty(id)) id = "item";
            var painted = ArtDrop.Sprite("icon_" + id) ?? ArtDrop.Sprite(id);
            if (painted != null) return painted;
            if (cache.TryGetValue(id, out var have)) return have;
            int n = Mathf.Max(8, DesignTable.IconPx);
            var img = new Texture2D(n, n, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp };
            uint h = 2166136261u;
            for (int i = 0; i < id.Length; i++) h = (h ^ id[i]) * 16777619u;
            var tint = Color.HSVToRGB((h % 360) / 360f, 0.45f, 0.75f);
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    bool border = x < 2 || y < 2 || x >= n - 2 || y >= n - 2;
                    bool mark = ((x + (int)(h % 7)) / 3) % 2 == ((y + (int)(h % 5)) / 3) % 2;
                    img.SetPixel(x, y, border ? new Color(0.15f, 0.12f, 0.1f, 1f) : mark ? tint : tint * 0.55f);
                }
            img.Apply();
            var sprite = Sprite.Create(img, new Rect(0, 0, n, n), new Vector2(0.5f, 0.5f), 100f);
            cache[id] = sprite;
            return sprite;
        }
    }
}
