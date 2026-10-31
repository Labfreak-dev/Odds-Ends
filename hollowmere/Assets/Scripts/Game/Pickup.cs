using System.Collections.Generic;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>Loot on the floor. Gold and potions vacuum up inside the pickup radius; items are
    /// collected by walking over them. Legendary and set items stand in a pillar of light.</summary>
    public sealed class Pickup : MonoBehaviour
    {
        static readonly List<Pickup> all = new List<Pickup>();
        public Item item;
        public int gold;
        public bool globe;
        float bob, age;

        public static void DropItem(Item it, Vector3 at)
        {
            var p = Make(at);
            p.item = it;
            var c = it.kind == ItemKind.Equipment ? Art.Rarity(it.rarity) : it.kind == ItemKind.Potion ? new Color(0.9f, 0.2f, 0.25f) : Art.Hex("#c9a14a");
            Art.Cube(p.transform, new Vector3(0, 0.25f, 0), new Vector3(0.45f, 0.18f, 0.3f), Art.Mat(c, it.rarity >= Rarity.Rare ? 1.2f : 0.3f), Quaternion.Euler(0, Random.Range(0, 360), 0));
            if (it.kind == ItemKind.Equipment)
            {
                float beam = (float)DesignTable.BeamHeight;
                Art.Cylinder(p.transform, new Vector3(0, beam * 0.5f, 0), new Vector3(0.22f, beam * 0.5f, 0.22f), Art.Mat(c, 2.5f));
                var l = new GameObject("glow").AddComponent<Light>();
                l.transform.SetParent(p.transform, false);
                l.transform.localPosition = Vector3.up;
                l.color = c; l.range = 6; l.intensity = 2;
                Fx.WorldLabel(p.transform, new Vector3(0, 1.2f, 0), it.name, c, 48, 0.04f);
                if (it.rarity >= Rarity.Legendary) AudioHub.Play("sfx_legendary");
            }
            else if (it.kind != ItemKind.Equipment)
            {
                Fx.WorldLabel(p.transform, new Vector3(0, 1.2f, 0), it.name, c, 48, 0.04f);
            }
        }

        public static void DropGlobe(Vector3 at)
        {
            var p = Make(at);
            p.globe = true;
            Art.Sphere(p.transform, new Vector3(0, 0.35f, 0), Vector3.one * 0.35f, Art.Mat(new Color(0.85f, 0.12f, 0.14f), 1.6f));
        }

        public static void DropGold(int amount, Vector3 at)
        {
            if (amount <= 0) return;
            var p = Make(at);
            p.gold = amount;
            Art.Cylinder(p.transform, new Vector3(0, 0.1f, 0), new Vector3(0.35f, 0.05f, 0.35f), Art.Mat(new Color(1f, 0.82f, 0.25f), 1f));
        }

        static Pickup Make(Vector3 at)
        {
            var go = new GameObject("pickup");
            go.transform.position = World.ClampToFloor(at + new Vector3(Random.Range(-1f, 1f), 0, Random.Range(-1f, 1f)));
            var p = go.AddComponent<Pickup>();
            p.bob = Random.value * 6;
            all.Add(p);
            return p;
        }

        void OnDestroy() => all.Remove(this);

        void Update()
        {
            age += Time.deltaTime;
            bob += Time.deltaTime * 3;
            if (transform.childCount > 0) transform.GetChild(0).localPosition = new Vector3(0, 0.25f + Mathf.Sin(bob) * 0.06f, 0);
        }

        public static void Collect(HeroActor h, float radius)
        {
            var state = GameManager.I.State;
            for (int i = all.Count - 1; i >= 0; i--)
            {
                var p = all[i];
                if (p == null || p.age < 0.4f) continue;
                float d = (p.transform.position - h.Pos).Flat().magnitude;
                bool vacuum = p.gold > 0 || p.globe || (p.item != null && p.item.kind != ItemKind.Equipment);
                if (d > (vacuum ? radius * 1.2f : 1.3f)) continue;
                if (p.gold > 0)
                {
                    state.hero.gold += p.gold;
                    state.counters.goldEarned += p.gold;
                    Fx.Text(p.transform.position, "+" + p.gold + "g", new Color(1f, 0.85f, 0.3f), 0.8f);
                    AudioHub.Play("sfx_gold", 0.5f);
                    float heal = h.Hero.LegendaryTotal(LegendaryEffect.GoldToLife);
                    if (heal > 0) h.Heal(h.maxLife * heal / 100f);
                }
                else if (p.globe)
                {
                    h.Heal(h.maxLife * (float)DesignTable.GlobeHealFraction);
                    Fx.Text(p.transform.position, "Globe", new Color(1f, 0.35f, 0.3f), 0.8f);
                    AudioHub.Play("sfx_gold", 0.35f);
                }
                else if (p.item != null)
                {
                    if (!state.hero.AddItem(p.item))
                    {
                        if (Time.frameCount % 120 == 0)
                        {
                            GameManager.I.Toast("Inventory full! Send your companion to sell, or use a portal.");
                            Sfx.Bag("error_bag_full");
                        }
                        continue;
                    }
                    Sfx.Bag("item_pickup");
                    GameManager.I.OnPickedUp(p.item);
                }
                all.RemoveAt(i);
                Destroy(p.gameObject);
            }
        }

        public static void ClearAll()
        {
            foreach (var p in all) if (p != null) Destroy(p.gameObject);
            all.Clear();
        }
    }

    public enum InteractKind { StairsDown, StairsUp, TownPortal, Chest, Shrine, Fishing, Merchant, Blacksmith, Mystic, Gambler, Stash, QuestBoard, DungeonEntrance, Fisherman }

    /// <summary>Something the hero can use by standing near it and pressing the action button.</summary>
    public sealed class Interactable : MonoBehaviour
    {
        public static readonly List<Interactable> All = new List<Interactable>();
        public InteractKind kind;
        public FishingPool pool;
        public bool used;
        public float range = 2.6f;

        void OnEnable() => All.Add(this);
        void OnDisable() => All.Remove(this);

        public string Label => kind switch
        {
            InteractKind.StairsDown => "Descend",
            InteractKind.StairsUp => "Ascend",
            InteractKind.TownPortal => "Portal",
            InteractKind.Chest => "Open",
            InteractKind.Shrine => "Pray",
            InteractKind.Fishing => "Fish",
            InteractKind.Fisherman => "Fish",
            InteractKind.Merchant => "Trade",
            InteractKind.Blacksmith => "Smith",
            InteractKind.Mystic => "Mystic",
            InteractKind.Gambler => "Gamble",
            InteractKind.Stash => "Stash",
            InteractKind.QuestBoard => "Quests",
            _ => "Enter",
        };

        public static Interactable Near(Vector3 pos)
        {
            Interactable best = null;
            float bestD = float.MaxValue;
            foreach (var i in All)
            {
                if (i.used) continue;
                float d = (i.transform.position - pos).Flat().magnitude;
                if (d <= i.range && d < bestD) { best = i; bestD = d; }
            }
            return best;
        }

        public static Interactable Create(InteractKind kind, Vector3 at, Transform parent, string label = null)
        {
            var go = new GameObject(kind.ToString());
            go.transform.SetParent(parent, false);
            go.transform.position = at;
            var it = go.AddComponent<Interactable>();
            it.kind = kind;
            it.BuildVisual(label);
            return it;
        }

        void BuildVisual(string label)
        {
            var t = transform;
            switch (kind)
            {
                case InteractKind.StairsDown:
                    if (Art.Model("prop_stairs", 0.6f, t) == null)
                    {
                        Art.Cube(t, new Vector3(0, 0.02f, 0), new Vector3(1.9f, 0.04f, 1.9f), Art.Mat(Color.black));
                        for (int i = 0; i < 4; i++) Art.Cube(t, new Vector3(0, 0.05f, -0.6f + i * 0.4f), new Vector3(1.6f, 0.05f, 0.3f), Art.Mat(new Color(0.35f, 0.33f, 0.3f) * (1 - i * 0.2f)));
                    }
                    Glow(new Color(0.4f, 0.7f, 1f));
                    break;
                case InteractKind.StairsUp:
                    for (int i = 0; i < 4; i++) Art.Cube(t, new Vector3(0, 0.15f + i * 0.3f, -0.6f + i * 0.4f), new Vector3(1.6f, 0.3f, 0.4f), Art.Mat(new Color(0.5f, 0.48f, 0.44f)));
                    break;
                case InteractKind.TownPortal:
                case InteractKind.DungeonEntrance:
                    var col = kind == InteractKind.TownPortal ? new Color(0.3f, 0.6f, 1f) : new Color(0.6f, 0.3f, 0.9f);
                    Art.Cylinder(t, new Vector3(0, 1.3f, 0), new Vector3(1.6f, 0.05f, 2.4f), Art.Mat(col, 2f), Quaternion.Euler(90, 0, 0));
                    if (kind == InteractKind.DungeonEntrance)
                    {
                        Art.Cube(t, new Vector3(-1.1f, 1.3f, 0), new Vector3(0.4f, 2.6f, 0.5f), Art.Mat(new Color(0.4f, 0.38f, 0.36f)));
                        Art.Cube(t, new Vector3(1.1f, 1.3f, 0), new Vector3(0.4f, 2.6f, 0.5f), Art.Mat(new Color(0.4f, 0.38f, 0.36f)));
                        Art.Cube(t, new Vector3(0, 2.7f, 0), new Vector3(2.6f, 0.4f, 0.5f), Art.Mat(new Color(0.4f, 0.38f, 0.36f)));
                    }
                    Glow(col);
                    break;
                case InteractKind.Chest:
                    if (Art.Model("prop_chest", 0.7f, t) == null)
                    {
                        Art.Cube(t, new Vector3(0, 0.3f, 0), new Vector3(1f, 0.6f, 0.65f), Art.Mat(new Color(0.45f, 0.3f, 0.15f)));
                        Art.Cube(t, new Vector3(0, 0.62f, 0), new Vector3(1.04f, 0.1f, 0.69f), Art.Mat(new Color(0.8f, 0.65f, 0.2f), 0.5f));
                    }
                    break;
                case InteractKind.Shrine:
                    if (Art.Model("prop_shrine", 1.6f, t) == null)
                    {
                        Art.Cylinder(t, new Vector3(0, 0.6f, 0), new Vector3(0.6f, 0.6f, 0.6f), Art.Mat(new Color(0.5f, 0.55f, 0.5f)));
                        Art.Sphere(t, new Vector3(0, 1.5f, 0), Vector3.one * 0.5f, Art.Mat(new Color(0.3f, 0.7f, 1f), 2.5f));
                    }
                    Glow(new Color(0.3f, 0.7f, 1f));
                    break;
                case InteractKind.Fishing:
                    // A bobbing marker over the water so pools read as fishable.
                    Art.Sphere(t, new Vector3(0, 0.2f, 0), new Vector3(0.25f, 0.25f, 0.25f), Art.Mat(new Color(1f, 0.25f, 0.2f), 0.8f));
                    break;
                default:
                    string npc = kind switch
                    {
                        InteractKind.Merchant => "npc_merchant", InteractKind.Blacksmith => "npc_smith",
                        InteractKind.Mystic => "npc_mystic", InteractKind.Fisherman => "npc_fisher", _ => null,
                    };
                    var model = npc != null ? Art.Animated(npc, 1.75f, t) : null;
                    if (model == null && kind == InteractKind.QuestBoard)
                    {
                        Art.Cube(t, new Vector3(0, 1.2f, 0), new Vector3(1.8f, 1.2f, 0.12f), Art.Mat(new Color(0.55f, 0.4f, 0.25f)));
                        Art.Cube(t, new Vector3(-0.8f, 0.6f, 0), new Vector3(0.12f, 1.2f, 0.12f), Art.Mat(new Color(0.4f, 0.3f, 0.2f)));
                        Art.Cube(t, new Vector3(0.8f, 0.6f, 0), new Vector3(0.12f, 1.2f, 0.12f), Art.Mat(new Color(0.4f, 0.3f, 0.2f)));
                        for (int i = 0; i < 3; i++) Art.Cube(t, new Vector3(-0.5f + i * 0.5f, 1.25f, -0.08f), new Vector3(0.35f, 0.45f, 0.02f), Art.Mat(new Color(0.95f, 0.92f, 0.8f)));
                    }
                    else if (model == null && kind == InteractKind.Stash)
                    {
                        Art.Cube(t, new Vector3(0, 0.45f, 0), new Vector3(1.4f, 0.9f, 0.8f), Art.Mat(new Color(0.35f, 0.25f, 0.15f)));
                        Art.Cube(t, new Vector3(0, 0.92f, 0), new Vector3(1.44f, 0.08f, 0.84f), Art.Mat(new Color(0.6f, 0.6f, 0.65f), 0.3f));
                    }
                    else if (model == null)
                    {
                        var c = kind switch
                        {
                            InteractKind.Merchant => new Color(0.75f, 0.55f, 0.2f), InteractKind.Blacksmith => new Color(0.45f, 0.3f, 0.25f),
                            InteractKind.Mystic => new Color(0.5f, 0.25f, 0.6f), InteractKind.Gambler => new Color(0.2f, 0.45f, 0.35f),
                            _ => new Color(0.85f, 0.75f, 0.2f),
                        };
                        Art.Humanoid(t, c, c * 0.6f, 1.75f, out var hand);
                        if (kind == InteractKind.Fisherman) Art.Weapon(hand, "rod", new Color(0.6f, 0.45f, 0.3f));
                        if (kind == InteractKind.Blacksmith) Art.Weapon(hand, "mace", Color.gray);
                    }
                    break;
            }
            if (!string.IsNullOrEmpty(label))
                Fx.WorldLabel(t, new Vector3(0.85f, 2.05f, 0), label, new Color(1f, 0.92f, 0.7f), 48, 0.05f);
        }

        void Glow(Color c)
        {
            var l = new GameObject("glow").AddComponent<Light>();
            l.transform.SetParent(transform, false);
            l.transform.localPosition = Vector3.up * 1.5f;
            l.color = c; l.range = 6; l.intensity = 1.5f;
        }
    }

    /// <summary>Fixed-angle isometric-style follow camera, the classic dungeon crawler view.</summary>
    [DefaultExecutionOrder(120)]
    public sealed class CameraRig : MonoBehaviour
    {
        public static float Yaw = 0f;
        public Transform follow;
        public float distance = 15f, pitch = 55f;
        Camera cam;
        readonly List<Renderer> hidden = new List<Renderer>();
        bool locked;
        Vector3 lockedPos;
        Quaternion lockedRot;

        /// <summary>Stop following so a QA pass can watch the hero cross a fixed frame.</summary>
        public void Lock(Vector3 pos, Quaternion rot)
        {
            locked = true;
            lockedPos = pos;
            lockedRot = rot;
            transform.SetPositionAndRotation(pos, rot);
        }

        public static CameraRig Create()
        {
            var go = new GameObject("Main Camera");
            go.tag = "MainCamera";
            var cam = go.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = Color.black;
            cam.fieldOfView = 45;
            cam.nearClipPlane = 0.3f; cam.farClipPlane = 120f;
            go.AddComponent<AudioListener>();
            var rig = go.AddComponent<CameraRig>();
            rig.cam = cam;
            return rig;
        }

        void LateUpdate()
        {
            if (locked)
            {
                transform.SetPositionAndRotation(lockedPos, lockedRot);
                return;
            }
            if (follow == null) return;
            // Pull in on narrow (portrait-ish) screens so the hero stays readable.
            float aspect = (float)Screen.width / Mathf.Max(1, Screen.height);
            float d = distance * (aspect < 1.5f ? 1.15f : 1f);
            var rot = Quaternion.Euler(pitch, Yaw, 0);
            var targetPos = follow.position + Vector3.up * 1f - rot * Vector3.forward * d;
            transform.position = Vector3.Lerp(transform.position, targetPos, 1 - Mathf.Exp(-10 * Time.unscaledDeltaTime))
                + CombatClock.Offset(Time.deltaTime);
            transform.rotation = rot;
            HideOccluders();
        }

        /// <summary>Props that sit between the lens and the hero are hidden for the frame.
        /// Characters, the floor and the bolt stay. A mesh the camera is inside of is hidden too.</summary>
        void HideOccluders()
        {
            for (int i = 0; i < hidden.Count; i++)
                if (hidden[i] != null) hidden[i].enabled = true;
            hidden.Clear();
            Vector3 eye = transform.position;
            Vector3 chest = follow.position + Vector3.up * 1.15f;
            foreach (var r in Object.FindObjectsByType<Renderer>(FindObjectsSortMode.None))
            {
                if (r == null || !r.enabled) continue;
                if (!(r is MeshRenderer) && !(r is SkinnedMeshRenderer)) continue;
                if (KeepVisible(r)) continue;
                var b = r.bounds;
                if (!b.Contains(eye) && !SegmentHits(eye, chest, b, 0.35f)) continue;
                r.enabled = false;
                hidden.Add(r);
            }
        }

        static bool KeepVisible(Renderer r)
        {
            if (r.GetComponent<TextMesh>() != null) return true;
            Transform t = r.transform;
            while (t != null)
            {
                string n = t.name;
                if (n == "floor" || n == "walls" || n == "water" || n == "skirt" || n == "waterBlock" || n == "heroRing") return true;
                if (t.GetComponent<HeroActor>() != null || t.GetComponent<PetActor>() != null) return true;
                if (t.GetComponent<Projectile>() != null || t.GetComponent<FxLife>() != null) return true;
                if (n.StartsWith("npc_") || n.StartsWith("hero_") || n.StartsWith("pet_") || n.StartsWith("mon_") || n.StartsWith("boss_"))
                    return true;
                t = t.parent;
            }
            return false;
        }

        static bool SegmentHits(Vector3 a, Vector3 b, Bounds box, float pad)
        {
            var min = box.min - Vector3.one * pad;
            var max = box.max + Vector3.one * pad;
            var d = b - a;
            float t0 = 0f, t1 = 1f;
            for (int axis = 0; axis < 3; axis++)
            {
                float origin = axis == 0 ? a.x : axis == 1 ? a.y : a.z;
                float dir = axis == 0 ? d.x : axis == 1 ? d.y : d.z;
                float bmin = axis == 0 ? min.x : axis == 1 ? min.y : min.z;
                float bmax = axis == 0 ? max.x : axis == 1 ? max.y : max.z;
                if (Mathf.Abs(dir) < 1e-6f)
                {
                    if (origin < bmin || origin > bmax) return false;
                    continue;
                }
                float inv = 1f / dir;
                float ta = (bmin - origin) * inv;
                float tb = (bmax - origin) * inv;
                if (ta > tb) { float s = ta; ta = tb; tb = s; }
                if (ta > t0) t0 = ta;
                if (tb < t1) t1 = tb;
                if (t0 > t1) return false;
            }
            // Ignore a graze at the hero's chest so the ring and nearby ground stay up.
            return t0 < 0.92f;
        }

        public void Snap()
        {
            if (follow == null) return;
            var rot = Quaternion.Euler(pitch, Yaw, 0);
            transform.position = follow.position + Vector3.up - rot * Vector3.forward * distance;
            transform.rotation = rot;
        }
    }
}
