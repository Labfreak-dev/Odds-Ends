using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>Ground mesh, hop, and rarity motes for a drop. A licensed glb at
    /// Models/item_{baseId} replaces the primitive. Icons are generated at 64².</summary>
    public static class LootDrop
    {
        public static void Dress(Pickup pickup, Item it)
        {
            var host = new GameObject("model").transform;
            host.SetParent(pickup.transform, false);
            var dropped = Art.Model("item_" + it.baseId, 0.6f, host);
            if (dropped == null) Primitive(host, it);
            var mote = DesignTable.Mote(it.rarity.ToString());
            var c = Art.Rarity(it.rarity);
            if (mote.Motes > 0) Fx.Sparks(pickup.transform.position + Vector3.up * 0.4f, c, mote.Motes >= 12 ? "crit" : mote.Motes >= 8 ? "skill" : "normal");
            if (mote.Ring > 0) Fx.Ring(pickup.transform.position, 0.9f, c, 0.45f);
            host.gameObject.AddComponent<DropHop>();
        }

        static void Primitive(Transform host, Item it)
        {
            var slot = it.Base != null ? it.Base.slot : ItemSlot.MainHand;
            string key = slot == ItemSlot.MainHand ? "weapon" : slot == ItemSlot.OffHand ? "offhand" : slot.ToString().ToLowerInvariant();
            var row = DesignTable.GroundFor(key);
            float x = row.X / 1000f, y = row.Y / 1000f, z = row.Z / 1000f;
            if (slot == ItemSlot.MainHand && it.Base != null && it.Base.twoHanded)
                y = Present.Active.twoHandMm / 1000f;
            var c = Art.Rarity(it.rarity);
            if (row.Shape == "sphere")
                Art.Sphere(host, Vector3.up * (y * 0.5f), new Vector3(x, y, z), Art.Mat(c, 0.4f));
            else
                Art.Cube(host, Vector3.up * (y * 0.5f), new Vector3(x, y, z), Art.Mat(c, 0.4f), Quaternion.Euler(0f, 25f, 0f));
        }
    }

    public sealed class DropHop : MonoBehaviour
    {
        float t;
        float hop, dur, settle;

        void Awake()
        {
            var p = Present.Active;
            hop = p.hopMm / 1000f;
            dur = Mathf.Max(0.05f, p.hopMs / 1000f);
            settle = p.settleMs / 1000f;
        }

        void Update()
        {
            t += Time.deltaTime;
            float y;
            if (t < dur) y = Mathf.Sin(t / dur * Mathf.PI) * hop;
            else if (t < dur + settle) y = Mathf.Lerp(0f, 0f, (t - dur) / settle);
            else { enabled = false; y = 0f; }
            var lp = transform.localPosition;
            lp.y = y;
            transform.localPosition = lp;
        }
    }

    /// <summary>A 64×64 original icon per base id. Assets/Art/Icons/{id}.png replaces it.</summary>
    public static class ItemIcon
    {
        static readonly System.Collections.Generic.Dictionary<string, Sprite> cache = new System.Collections.Generic.Dictionary<string, Sprite>();

        public static Sprite Get(string id)
        {
            if (string.IsNullOrEmpty(id)) id = "item";
            var painted = ArtDrop.Sprite(IconName(id));
            if (painted != null) return painted;
            if (cache.TryGetValue(id, out var have)) return have;
            var loaded = Resources.Load<Sprite>("Icons/" + id);
            if (loaded == null)
            {
                var tex = Resources.Load<Texture2D>("Icons/" + id);
                if (tex != null) loaded = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f));
            }
            if (loaded != null) { cache[id] = loaded; return loaded; }
            int n = Mathf.Max(8, Present.Active.icon);
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

        static string IconName(string id) => id switch
        {
            "greataxe" or "axe" => "icon_axe",
            "warhammer" or "mace" => "icon_mace",
            "crossbow" or "bow" or "quiver" => "icon_bow",
            "rod" or "staff" => "icon_staff",
            "hood" or "helm" => "icon_helm",
            "pauldrons" or "mantle" => "icon_shoulders",
            "plate" or "robe" or "jerkin" => "icon_chest",
            "gauntlets" or "gloves" => "icon_gloves",
            "sash" or "belt" => "icon_belt",
            "greaves" or "trousers" => "icon_pants",
            "waders" or "boots" => "icon_boots",
            "cloak" => "icon_cloak",
            "potion" => "icon_hpotion",
            "portal" => "icon_scroll",
            _ => "icon_" + id,
        };
    }
}
