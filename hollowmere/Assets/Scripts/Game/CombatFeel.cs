using System.Collections.Generic;
using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>Hit-stop and camera shake. Actors pause; the UI clock does not.</summary>
    public static class CombatClock
    {
        public const string Pref = "hollowmere.shake";
        static float holdUntil;
        static float amp;

        public static bool Frozen => Time.time < holdUntil;

        public static bool ShakeEnabled
        {
            get => PlayerPrefs.GetInt(Pref, 1) != 0;
            set => PlayerPrefs.SetInt(Pref, value ? 1 : 0);
        }

        public static void Punch(string kind)
        {
            float ms = DesignTable.HitStopMs(kind) / 1000f;
            if (ms > 0f) holdUntil = Mathf.Max(holdUntil, Time.time + ms);
            if (!ShakeEnabled) return;
            float add = DesignTable.ShakeMm(kind) / 1000f;
            float cap = DesignTable.ShakeMm("cap") / 1000f;
            amp = Mathf.Min(cap, amp + add);
        }

        public static Vector3 Offset(float dt)
        {
            if (amp <= 0.0001f) return Vector3.zero;
            float decay = DesignTable.ShakeMm("decay");
            var o = new Vector3(
                Mathf.PerlinNoise(Time.time * 37f, 0.2f) - 0.5f,
                Mathf.PerlinNoise(0.2f, Time.time * 37f) - 0.5f,
                0f) * (amp * 2f);
            amp *= Mathf.Exp(-decay * dt);
            return o;
        }
    }

    public static class CombatDrop
    {
        static Dictionary<string, Texture2D> map;
        static bool tried;

        public static Texture2D Tex(string name)
        {
            if (!tried)
            {
                tried = true;
                map = new Dictionary<string, Texture2D>();
                var cat = Resources.Load<CombatArt>("CombatArt");
                if (cat != null && cat.textures != null)
                    for (int i = 0; i < cat.textures.Length; i++)
                        if (cat.textures[i] != null) map[cat.textures[i].name] = cat.textures[i];
            }
            if (map == null || string.IsNullOrEmpty(name)) return null;
            map.TryGetValue(name, out var tex);
            return tex;
        }

        public static Material Sheet(Color tint, Texture2D tex)
        {
            var src = Resources.Load<Material>("HollowmereSheet");
            Material m;
            if (src != null) m = new Material(src);
            else m = Art.GlowMat(tint, true);
            m.color = tint;
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", tint);
            if (m.HasProperty("_Color")) m.SetColor("_Color", tint);
            if (tex != null) m.mainTexture = tex;
            return m;
        }
    }

    public static class SkillVfx
    {
        public static void Play(HeroActor h, SkillCast c, Vector3 dir, Actor target)
        {
            if (h == null || c == null || c.skill == null) return;
            string id = c.skill.id;
            // The flying glow, trail and impact own Hex Bolt. The sheet cell is a dark square
            // when drawn with alpha blend, which is what QA saw as an opaque pink quad.
            if (id == "hx_bolt") return;
            var style = DesignTable.Vfx(id);
            var col = Art.Hex("#" + style.Hex);
            if (!DesignTable.HasSheet(id))
            {
                Placeholder(h, c, dir, style.Kind, col);
                return;
            }
            var tex = CombatDrop.Tex(DesignTable.SheetName(id));
            if (tex == null)
            {
                Placeholder(h, c, dir, style.Kind, col);
                return;
            }
            var go = new GameObject("vfx_" + id);
            float size = c.radius > 0.5f ? c.radius * 2f : 2.4f;
            if (c.range > size && (style.Kind == "line" || style.Kind == "fan" || style.Kind == "bolt"))
                size = Mathf.Min(c.range, 8f);
            bool flat = style.Kind == "nova" || style.Kind == "ground" || style.Kind == "meteor" || style.Kind == "line" || id == "ic_charge";
            Vector3 at = h.Pos;
            if (id == "st_mark" && target != null)
                at = target.Pos;
            else if (style.Kind == "ground" || style.Kind == "meteor")
                at = target != null ? target.Pos : h.Pos + dir * Mathf.Max(2f, c.range * 0.6f);
            else if (style.Kind == "bolt" || style.Kind == "fan" || style.Kind == "chain")
                at = target != null ? target.Pos : h.Pos + dir * 2.2f;
            at.y = flat ? 0.08f : at.y + 1.1f;
            go.transform.position = at;
            go.transform.localScale = new Vector3(size, size, 1f);
            if (flat)
            {
                Vector3 face = dir.sqrMagnitude > 0.001f ? dir : h.transform.forward;
                face.y = 0f;
                if (face.sqrMagnitude < 0.001f) face = Vector3.forward;
                go.transform.rotation = Quaternion.LookRotation(Vector3.up, face.normalized);
            }
            var filt = go.AddComponent<MeshFilter>();
            filt.sharedMesh = Quad();
            var rend = go.AddComponent<MeshRenderer>();
            var mat = CombatDrop.Sheet(Color.white, tex);
            rend.sharedMaterial = mat;
            var play = go.AddComponent<SheetPlay>();
            play.mat = mat;
            play.fps = DesignTable.SheetFps(id);
            play.loop = DesignTable.SheetLoops(id);
            play.life = play.loop ? Mathf.Max(0.4f, c.duration > 0f ? c.duration : 2f) : 12f / Mathf.Max(1, play.fps);
            play.flat = flat;
        }

        /// <summary>A second copy at the landing point for blink and roll.</summary>
        public static void Landing(HeroActor h, SkillCast c)
        {
            if (h == null || c == null || c.skill == null) return;
            if (c.skill.id != "hx_blink" && c.skill.id != "st_roll") return;
            Play(h, c, h.transform.forward, null);
        }

        /// <summary>Hexweaver cast glyph at the hand, or on the ground for a ring.</summary>
        public static void CastGlyph(HeroActor h, string skillId)
        {
            if (h == null || string.IsNullOrEmpty(skillId) || !skillId.StartsWith("hx_")) return;
            // The bolt cast sheet is a flat lavender hexagon. The projectile glow is the bolt.
            if (skillId == "hx_bolt") return;
            string key = "hexweaver_hx_cast_" + skillId.Substring(3);
            var tex = CombatDrop.Tex(key);
            if (tex == null) return;
            bool feet = skillId == "hx_frostring" || skillId == "hx_meteor" || skillId == "hx_blink" || skillId == "hx_thrall";
            var hand = FindHand(h.transform);
            var go = new GameObject("glyph_" + skillId);
            if (!feet && hand != null)
            {
                go.transform.SetParent(hand, false);
                go.transform.localPosition = new Vector3(0f, 0.02f, 0.1f);
                go.transform.localScale = Vector3.one * 0.65f;
            }
            else
            {
                var face = h.transform.forward;
                face.y = 0f;
                if (face.sqrMagnitude < 0.001f) face = Vector3.forward;
                go.transform.SetPositionAndRotation(h.Pos + Vector3.up * 0.06f, Quaternion.LookRotation(Vector3.up, face.normalized));
                go.transform.localScale = new Vector3(1.7f, 1.7f, 1f);
            }
            var filt = go.AddComponent<MeshFilter>();
            filt.sharedMesh = Quad();
            var rend = go.AddComponent<MeshRenderer>();
            var mat = CombatDrop.Sheet(Color.white, tex);
            rend.sharedMaterial = mat;
            var play = go.AddComponent<SheetPlay>();
            play.mat = mat;
            play.fps = 24;
            play.loop = false;
            play.life = 12f / 24f;
            play.flat = feet;
        }

        static Transform FindHand(Transform root)
        {
            if (root.name == "RightHand") return root;
            for (int i = 0; i < root.childCount; i++)
            {
                var f = FindHand(root.GetChild(i));
                if (f != null) return f;
            }
            return null;
        }

        static void Placeholder(HeroActor h, SkillCast c, Vector3 dir, string kind, Color col)
        {
            if (kind == "dash")
            {
                var to = h.Pos + dir * Mathf.Max(1.5f, c.range);
                Fx.Beam(h.Pos + Vector3.up * 0.9f, to + Vector3.up * 0.9f, col, 0.18f, 0.22f);
                Fx.Burst(h.Pos + Vector3.up, col, 0.8f, 0.2f);
            }
            else if (kind == "buff")
                Fx.Ring(h.Pos, 2.2f, col, 0.45f);
            else
                Fx.Burst(h.Pos + Vector3.up * 1.1f, col, 1.4f, 0.35f);
        }

        static Mesh quad;
        static Mesh Quad()
        {
            if (quad != null) return quad;
            quad = new Mesh();
            quad.vertices = new[]
            {
                new Vector3(-0.5f, -0.5f, 0f), new Vector3(0.5f, -0.5f, 0f),
                new Vector3(-0.5f, 0.5f, 0f), new Vector3(0.5f, 0.5f, 0f),
            };
            quad.uv = new[] { new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0f, 1f), new Vector2(1f, 1f) };
            quad.colors = new[] { Color.white, Color.white, Color.white, Color.white };
            quad.triangles = new[] { 0, 2, 1, 2, 3, 1 };
            return quad;
        }
    }

    public sealed class SheetPlay : MonoBehaviour
    {
        public Material mat;
        public int columns = 4, rows = 3, count = 12, fps = 24;
        public bool loop, flat;
        public float life = 0.5f;
        float t;

        void LateUpdate()
        {
            if (!flat)
            {
                var cam = Camera.main;
                if (cam != null) transform.rotation = cam.transform.rotation;
            }
            t += Time.deltaTime;
            int frame = (int)(t * Mathf.Max(1, fps));
            if (!loop && (frame >= count || t >= life)) { Destroy(gameObject); return; }
            if (t >= life) { Destroy(gameObject); return; }
            if (loop) frame %= count;
            frame = Mathf.Clamp(frame, 0, count - 1);
            int col = frame % columns;
            int row = frame / columns;
            if (mat != null)
            {
                mat.mainTextureScale = new Vector2(1f / columns, 1f / rows);
                mat.mainTextureOffset = new Vector2(col / (float)columns, 1f - (row + 1f) / rows);
            }
        }
    }

    public static class TrailHold
    {
        public static void Arm(HeroActor h, SkillCast c)
        {
            if (h == null) return;
            // World-space follower. Parenting the ribbon to the hand inherits the 0.01 armature
            // and the swing disappears.
            var go = new GameObject("weaponTrail");
            var origin = h.Pos;
            var forward = h.transform.forward;
            forward.y = 0f;
            if (forward.sqrMagnitude < 0.01f) forward = Vector3.forward;
            forward.Normalize();
            var right = Vector3.Cross(Vector3.up, forward);
            // The hand bone barely moves in world space, so a trail stuck to it
            // draws no ribbon. Sweep an arc in front of the hero instead.
            go.transform.position = origin + forward * 1.35f + Vector3.up * 1.15f;
            var follow = go.AddComponent<TrailFollow>();
            follow.origin = origin;
            follow.forward = forward;
            follow.right = right;
            follow.life = 0.45f;
            var tr = go.AddComponent<TrailRenderer>();
            var col = Color.Lerp(Art.Hex("#" + DesignTable.Vfx(c.skill.id).Hex), Color.white, 0.45f);
            col.a = 0.9f;
            tr.time = Mathf.Max(0.45f, DesignTable.TrailLife / 1000f);
            float width = 1.6f;
            tr.startWidth = width;
            tr.endWidth = width * 0.85f;
            tr.minVertexDistance = 0.02f;
            tr.textureMode = LineTextureMode.Stretch;
            tr.numCornerVertices = 2;
            tr.numCapVertices = 2;
            tr.startColor = col;
            tr.endColor = new Color(col.r, col.g, col.b, 0.85f);
            // No trail texture: a dark cell multiplied the ribbon down to nothing.
            // Vertex colour is the emissive tint, alpha kept at 0.85 or above.
            var ribbon = Art.GlowMat(Color.white, true, null);
            tr.material = ribbon;
            tr.emitting = true;
            var burst = Art.GlowSprite(null, 1.6f, new Color(1f, 0.95f, 0.75f, 1f));
            burst.transform.position = go.transform.position;
            burst.AddComponent<FxLife>().Init(0.22f, Vector3.one * 1.2f, Vector3.one * 2.4f);
            var hold = go.AddComponent<TrailStop>();
            hold.trail = tr;
            hold.until = Time.time + Mathf.Max(0.45f, DesignTable.TrailHold / 1000f);
        }

        public static string TrailFor(HeroActor h)
        {
            string id = h.Hero.Equipped(EquipSlot.MainHand)?.baseId;
            switch (id)
            {
                case "sword": return "trail_sword";
                case "dagger": return "trail_dagger";
                case "axe": return "trail_axe";
                case "greataxe": return "trail_greataxe";
                case "mace":
                case "warhammer": return "trail_mace";
                case "staff":
                case "wand":
                case "rod": return "trail_staff";
                case "bow":
                case "crossbow": return "trail_bow";
                default: return "trail_fist";
            }
        }

    }

    /// <summary>Sweeps the ribbon through a world-space arc so the swing is visible.</summary>
    public sealed class TrailFollow : MonoBehaviour
    {
        public Vector3 origin = Vector3.zero;
        public Vector3 forward = Vector3.forward;
        public Vector3 right = Vector3.right;
        public float life = 0.45f;
        float t;

        void LateUpdate()
        {
            t += Time.deltaTime;
            float u = Mathf.Clamp01(t / Mathf.Max(0.05f, life));
            float ang = Mathf.Lerp(-1.15f, 1.15f, u);
            transform.position = origin + (forward * Mathf.Cos(ang) + right * Mathf.Sin(ang)) * 1.35f + Vector3.up * 1.15f;
        }
    }

    public sealed class TrailStop : MonoBehaviour
    {
        public TrailRenderer trail;
        public float until;

        void Update()
        {
            if (Time.time < until) return;
            if (trail != null) trail.emitting = false;
            Destroy(gameObject, trail != null ? trail.time : 0.2f);
            enabled = false;
        }
    }

    public static class CombatSparks
    {
        public static void Burst(Vector3 at, Color col, string kind)
        {
            var s = DesignTable.Sparks(kind);
            float life = s.Life / 1000f;
            float speed = s.Speed / 1000f;
            float size = Mathf.Max(0.9f, s.Size / 1000f * 8f);
            var flash = Art.GlowSprite(null, size * 4.5f, Color.Lerp(col, Color.white, 0.35f));
            flash.transform.position = at;
            flash.AddComponent<FxLife>().Init(Mathf.Max(0.18f, life), Vector3.one * size * 2.2f, Vector3.one * size * 4.5f);
            for (int i = 0; i < s.Count; i++)
            {
                var dir = Random.onUnitSphere;
                dir.y = Mathf.Abs(dir.y);
                var g = Art.GlowSprite(null, size, col);
                g.transform.position = at;
                var mote = g.AddComponent<SparkMote>();
                mote.vel = dir * speed;
                mote.life = life;
            }
        }
    }

    public sealed class SparkMote : MonoBehaviour
    {
        public Vector3 vel;
        public float life;
        float t;

        void Update()
        {
            t += Time.deltaTime;
            transform.position += vel * Time.deltaTime;
            vel *= Mathf.Exp(-8f * Time.deltaTime);
            float k = Mathf.Clamp01(t / Mathf.Max(0.05f, life));
            transform.localScale = Vector3.one * Mathf.Lerp(transform.localScale.x, 0.01f, k);
            if (t >= life) Destroy(gameObject);
        }
    }

    public static class CombatNumbers
    {
        public static void Spawn(Vector3 at, string text, string style, Color tint)
        {
            if (string.IsNullOrEmpty(text)) return;
            string file = style == "crit" ? "dmg_crit" : style == "hurt" ? "dmg_player" : style == "heal" ? "dmg_heal" : "dmg_normal";
            var tex = CombatDrop.Tex(file);
            bool glyphs = tex != null;
            if (glyphs)
            {
                for (int i = 0; i < text.Length; i++)
                    if (!DesignTable.Glyph(style, text[i], out _, out _, out _, out _)) { glyphs = false; break; }
            }
            if (!glyphs)
            {
                var spec = DesignTable.Number(style);
                Fx.Text(at, text, tint, spec.Size / 50f, spec.Life / 1000f);
                return;
            }
            var num = DesignTable.Number(style);
            float life = num.Life / 1000f;
            float rise = life > 0.001f ? (num.Rise / 1000f) / life : 0f;
            float height = num.Size / 1000f;
            var go = new GameObject("dmg");
            go.transform.position = at + new Vector3(Random.Range(-0.25f, 0.25f), 1.7f, 0f);
            var filt = go.AddComponent<MeshFilter>();
            filt.sharedMesh = Build(text, style, tex, height);
            var rend = go.AddComponent<MeshRenderer>();
            var tintColor = style == "normal" ? tint : Color.white;
            rend.sharedMaterial = CombatDrop.Sheet(tintColor, tex);
            go.AddComponent<FaceCamera>();
            var pop = go.AddComponent<NumberRise>();
            pop.life = life;
            pop.rise = rise;
            pop.pop = style == "crit";
        }

        static Mesh Build(string text, string style, Texture2D tex, float height)
        {
            float width = 0f;
            for (int i = 0; i < text.Length; i++)
            {
                DesignTable.Glyph(style, text[i], out _, out int cellH, out _, out int advance);
                width += height * (advance / (float)cellH);
            }
            var verts = new Vector3[text.Length * 4];
            var uvs = new Vector2[text.Length * 4];
            var cols = new Color[text.Length * 4];
            var tris = new int[text.Length * 6];
            float pen = -width * 0.5f;
            float tw = Mathf.Max(1, tex.width);
            float th = Mathf.Max(1, tex.height);
            for (int i = 0; i < text.Length; i++)
            {
                DesignTable.Glyph(style, text[i], out int cellW, out int cellH, out int x, out int advance);
                float gw = height * (cellW / (float)cellH);
                float adv = height * (advance / (float)cellH);
                int v = i * 4;
                verts[v] = new Vector3(pen, 0f, 0f);
                verts[v + 1] = new Vector3(pen + gw, 0f, 0f);
                verts[v + 2] = new Vector3(pen, height, 0f);
                verts[v + 3] = new Vector3(pen + gw, height, 0f);
                float u0 = x / tw;
                float u1 = (x + cellW) / tw;
                float v0 = 1f - cellH / th;
                float v1 = 1f;
                uvs[v] = new Vector2(u0, v0);
                uvs[v + 1] = new Vector2(u1, v0);
                uvs[v + 2] = new Vector2(u0, v1);
                uvs[v + 3] = new Vector2(u1, v1);
                cols[v] = cols[v + 1] = cols[v + 2] = cols[v + 3] = Color.white;
                int t = i * 6;
                tris[t] = v; tris[t + 1] = v + 2; tris[t + 2] = v + 1;
                tris[t + 3] = v + 2; tris[t + 4] = v + 3; tris[t + 5] = v + 1;
                pen += adv;
            }
            var mesh = new Mesh();
            mesh.vertices = verts;
            mesh.uv = uvs;
            mesh.colors = cols;
            mesh.triangles = tris;
            return mesh;
        }
    }

    public sealed class NumberRise : MonoBehaviour
    {
        public float life = 0.7f, rise = 2f;
        public bool pop;
        float t;

        void Update()
        {
            t += Time.deltaTime;
            float k = Mathf.Clamp01(t / Mathf.Max(0.05f, life));
            transform.position += Vector3.up * rise * Time.deltaTime;
            float s = pop ? Mathf.Lerp(1.4f, 1f, Mathf.Clamp01(t / 0.15f)) : 1f;
            s *= 1f - k * k * 0.15f;
            transform.localScale = Vector3.one * s;
            var rend = GetComponent<Renderer>();
            if (rend != null && rend.material != null)
            {
                var c = rend.material.color;
                c.a = 1f - k * k;
                rend.material.color = c;
                if (rend.material.HasProperty("_BaseColor")) rend.material.SetColor("_BaseColor", c);
                if (rend.material.HasProperty("_Color")) rend.material.SetColor("_Color", c);
            }
            if (t >= life) Destroy(gameObject);
        }
    }

    /// <summary>Plays the baked combat takes on the hero's existing Meshy rig.</summary>
    public static class CombatClipPlayer
    {
        public static void Attach(ModelAnim ma, string key)
        {
            if (ma == null || ma.anim == null || string.IsNullOrEmpty(key)) return;
            string hero = ClipFeet.Strip(key);
            var text = Resources.Load<TextAsset>("Combat/" + hero + "_combat");
            if (text == null) return;
            var clips = CombatClipPack.Load(text.bytes);
            for (int i = 0; i < clips.Length; i++)
            {
                var src = clips[i];
                if (DesignTable.TryTrim(src.Name, out int a, out int b, out _))
                    src = CombatClipPack.Slice(src, a, b);
                var clip = Build(src, ma.anim.transform);
                if (clip != null) ma.anim.AddClip(clip, clip.name);
            }
            ma.Forget();
        }

        /// <summary>Retarget a baked clip pack onto the hero rig. Fishing uses Combat/hero_fishing.</summary>
        public static void AddPack(ModelAnim ma, string resource)
        {
            if (ma == null || ma.anim == null || string.IsNullOrEmpty(resource)) return;
            var text = Resources.Load<TextAsset>(resource);
            if (text == null) return;
            var clips = CombatClipPack.Load(text.bytes);
            for (int i = 0; i < clips.Length; i++)
            {
                var clip = Build(clips[i], ma.anim.transform);
                if (clip != null) ma.anim.AddClip(clip, clip.name);
            }
            ma.Forget();
        }

        static AnimationClip Build(CombatClipPack.Clip src, Transform root)
        {
            if (src == null || src.Bones == null) return null;
            var clip = new AnimationClip();
            clip.legacy = true;
            clip.name = src.Name;
            clip.frameRate = 24f;
            int used = 0;
            for (int i = 0; i < src.Bones.Length; i++)
            {
                var bone = src.Bones[i];
                if (bone.Keys == null || bone.Keys.Length == 0) continue;
                var joint = Find(root, bone.Name);
                if (joint == null) continue;
                string path = Rel(root, joint);
                if (path == null) continue;
                var cx = new AnimationCurve();
                var cy = new AnimationCurve();
                var cz = new AnimationCurve();
                var cw = new AnimationCurve();
                for (int k = 0; k < bone.Keys.Length; k++)
                {
                    var key = bone.Keys[k];
                    cx.AddKey(key.Time, key.X);
                    cy.AddKey(key.Time, key.Y);
                    cz.AddKey(key.Time, key.Z);
                    cw.AddKey(key.Time, key.W);
                }
                Linear(cx); Linear(cy); Linear(cz); Linear(cw);
                clip.SetCurve(path, typeof(Transform), "localRotation.x", cx);
                clip.SetCurve(path, typeof(Transform), "localRotation.y", cy);
                clip.SetCurve(path, typeof(Transform), "localRotation.z", cz);
                clip.SetCurve(path, typeof(Transform), "localRotation.w", cw);
                used++;
            }
            if (used == 0) return null;
            clip.EnsureQuaternionContinuity();
            return clip;
        }

        static void Linear(AnimationCurve curve)
        {
            for (int i = 0; i < curve.length; i++)
            {
                var key = curve[i];
                if (i > 0)
                {
                    var prev = curve[i - 1];
                    float dx = key.time - prev.time;
                    float tan = Mathf.Abs(dx) > 0.00001f ? (key.value - prev.value) / dx : 0f;
                    prev.outTangent = tan;
                    key.inTangent = tan;
                    curve.MoveKey(i - 1, prev);
                }
                if (i + 1 < curve.length)
                {
                    var next = curve[i + 1];
                    float dx = next.time - key.time;
                    key.outTangent = Mathf.Abs(dx) > 0.00001f ? (next.value - key.value) / dx : 0f;
                }
                curve.MoveKey(i, key);
            }
        }

        static Transform Find(Transform root, string name)
        {
            if (root.name == name) return root;
            for (int i = 0; i < root.childCount; i++)
            {
                var f = Find(root.GetChild(i), name);
                if (f != null) return f;
            }
            return null;
        }

        static string Rel(Transform root, Transform bone)
        {
            if (bone == root) return "";
            var names = new List<string>();
            var t = bone;
            while (t != null && t != root)
            {
                names.Add(t.name);
                t = t.parent;
            }
            if (t != root) return null;
            names.Reverse();
            return string.Join("/", names);
        }
    }
}
