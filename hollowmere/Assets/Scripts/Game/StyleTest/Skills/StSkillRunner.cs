using System.Collections.Generic;
using UnityEngine;

namespace Hollowmere.StyleTest.Skills
{
    /// <summary>Runtime caster: cooldowns, mana, ultimate charge, telegraph -> delay -> effect steps, passive procs.
    /// Drives StVfx every frame with the same recipe the proof shots pose, so what the shots show is what plays.</summary>
    public class StSkillRunner : MonoBehaviour
    {
        public StActor hero; public Camera cam; public Loadout loadout;
        public System.Func<IEnumerable<StActor>> foes;
        public float hp = 100, maxHp = 100, mana = 100, maxMana = 100, ult, shield, dmgBuff = 1, buffUntil, shieldUntil;
        public int level = 1;
        public float manaRegen = 6;
        public float UltCharge => Mathf.Clamp01(ult);
        readonly Dictionary<string, float> readyAt = new Dictionary<string, float>();
        readonly Dictionary<string, float> lastCd = new Dictionary<string, float>();
        Transform fx; SkillDef cur; VfxCtx ctx; float start, curDur; readonly HashSet<int> applied = new HashSet<int>();
        float passiveNext; public readonly Dictionary<StActor, (Status s, float until)> status = new Dictionary<StActor, (Status, float)>();
        public System.Action<string, Vector3, Color> onFloat; // floating combat text hook (HUD)
        public System.Action<StActor> onKill; public System.Action<StActor, float> onHit; // phase 6: xp/loot + boss engage
        public float power = 1; // phase 6: level scaling of skill damage

        public bool Casting => cur != null;
        public SkillDef Current => cur;
        public Palette PaletteOf(SkillDef s) => s.palettePin ?? loadout.Palette;

        public static StSkillRunner Attach(StActor hero, Camera cam, Loadout l)
        {
            var r = hero.gameObject.GetComponent<StSkillRunner>() ?? hero.gameObject.AddComponent<StSkillRunner>();
            r.hero = hero; r.cam = cam; r.loadout = l; return r;
        }

        void Awake() { fx = new GameObject("skill_fx").transform; }
        void OnDestroy() { if (fx) Destroy(fx.gameObject); if (marker) Destroy(marker.gameObject); }

        public float CooldownLeft(string id) => readyAt.TryGetValue(id, out var t) ? Mathf.Max(0, t - Time.time) : 0;
        public float CooldownFrac(string id)
        {
            float left = CooldownLeft(id); if (left <= 0) return 0;
            return lastCd.TryGetValue(id, out var cd) && cd > 0 ? left / cd : 0;
        }

        public bool CanCast(string id, out string why)
        {
            why = null; if (string.IsNullOrEmpty(id) || !StSkillDb.Skills.TryGetValue(id, out var s)) { why = "empty"; return false; }
            if (s.slot == SlotType.Passive) { why = "passive"; return false; }
            if (cur != null) { why = "busy"; return false; }
            if (CooldownLeft(id) > 0) { why = "cooldown"; return false; }
            if (s.slot == SlotType.Ultimate && ult < 1) { why = "charge"; return false; }
            if (mana < s.cost) { why = "mana"; return false; }
            return true;
        }

        // ---- lock-on (auto, line of sight; there is no drag-to-aim) ----
        public StActor Target { get; private set; }
        public StTargetMarker marker; public bool showMarker = true;
        float nextRetarget; bool occludersBuilt;

        /// <summary>Lock range in metres for a skill (data is design units).</summary>
        public static float LockRange(SkillDef s) => (s.range * 1.6f + 2) * StScale.DU;
        float IdleLockRange => loadout != null && !string.IsNullOrEmpty(loadout.basic) && StSkillDb.Skills.TryGetValue(loadout.basic, out var b) ? LockRange(b) : 8f;

        void EnsureOccluders()
        {
            if (occludersBuilt) return; occludersBuilt = true;
            var roots = new List<Transform>(StBiomes.Built); roots.AddRange(StWorld.Built);
            StTargeting.BuildOccluders(roots);
        }

        /// <summary>Re-evaluates the lock: nearest foe in range whose chest the hero can see (occluded foes are skipped).</summary>
        public StActor Retarget(float range)
        {
            EnsureOccluders();
            Target = StTargeting.Pick(hero, foes != null ? foes() : null, range);
            if (showMarker && StFlags.On("targetMarker"))
            {
                if (marker == null) marker = StTargetMarker.Create(loadout != null ? loadout.Palette.primary : Color.white);
                marker.Set(Target);
            }
            return Target;
        }

        StActor Nearest(float within) => Retarget(within);

        public bool Cast(string id, Vector3? aimAt = null)
        {
            if (!CanCast(id, out _)) return false;
            var s = StSkillDb.Skills[id];
            Vector3? aim = aimAt;
            if (aim == null && s.targeting != Targeting.Self && s.range > 0)
            {
                var t = Nearest((s.range * 1.6f + 2) * StScale.DU); // skill data is in design units; world is metres
                if (t != null) { aim = t.transform.position; }
            }
            if (aim != null)
            {
                var d = aim.Value - hero.transform.position; d.y = 0;
                if (d.sqrMagnitude > 0.01f) hero.transform.rotation = Quaternion.LookRotation(d);
                // clamp the aim point to the skill's reach
                if (d.magnitude > s.range * StScale.DU && s.range > 0) aim = hero.transform.position + d.normalized * s.range * StScale.DU;
            }
            mana -= s.cost; if (s.slot == SlotType.Ultimate) ult = 0;
            float cd = s.cooldown; readyAt[id] = Time.time + cd; lastCd[id] = cd;
            cur = s; start = Time.time; applied.Clear();
            ctx = VfxCtx.For(hero, fx, cam, s, PaletteOf(s), aim);
            float lingerMax = 0; if (s.vfx != null) foreach (var st in s.vfx.steps) lingerMax = Mathf.Max(lingerMax, st.t1 + st.linger);
            curDur = s.duration * Mathf.Max(1f, lingerMax);
            var clip = AnimMap.ClipFor(hero, s.anim);
            if (hero.anim.GetClip(clip) != null)
            {
                hero.Once(clip, 0.06f);
                var st = hero.anim[clip]; st.speed = st.length / Mathf.Max(0.1f, s.duration);
            }
            return true;
        }

        /// <summary>Plays the equipped passive's proc visual (it has no button).</summary>
        public void ProcPassive()
        {
            if (cur != null || loadout == null || string.IsNullOrEmpty(loadout.passive)) return;
            var s = StSkillDb.Skills[loadout.passive]; cur = s; start = Time.time; applied.Clear(); ctx = VfxCtx.For(hero, fx, cam, s, PaletteOf(s)); curDur = s.duration * 1.3f;
        }

        public void TakeDamage(float d)
        {
            if (StFlags.On("godMode")) return;
            if (shield > 0 && Time.time < shieldUntil) { float a = Mathf.Min(shield, d); shield -= a; d -= a; }
            if (loadout != null && loadout.passive == "k_iron_skin" && hp < maxHp * 0.5f) { d *= 0.75f; if (Time.time > passiveNext) { passiveNext = Time.time + 6; ProcPassive(); } }
            hp = Mathf.Max(0, hp - d); ult += d * 0.01f;
        }

        void Update()
        {
            mana = Mathf.Min(maxMana, mana + manaRegen * (loadout != null && loadout.passive == "m_mana_flow" ? 1.5f : 1f) * Time.deltaTime);
            if (Time.time > buffUntil) dmgBuff = 1;
            // keep the lock fresh: drop dead / out-of-range / newly occluded targets and pick the next visible one
            if (Time.time >= nextRetarget && hero != null)
            {
                nextRetarget = Time.time + 0.2f; float r = IdleLockRange;
                bool stale = Target == null || Target.dead || (Target.transform.position - hero.transform.position).magnitude > r || !StTargeting.Visible(hero, Target, out _);
                if (stale || cur == null) Retarget(r);
            }
            if (loadout != null && cur == null && Time.time > passiveNext && (loadout.passive == "m_mana_flow" && mana < maxMana * 0.6f || loadout.passive == "r_eagle_eye"))
            { passiveNext = Time.time + 12; ProcPassive(); }
            if (cur == null) return;
            float t = (Time.time - start) / Mathf.Max(0.05f, cur.duration);
            StVfx.Play(ctx, t);
            for (int i = 0; i < cur.effects.Count; i++)
                if (!applied.Contains(i) && t >= cur.effects[i].at) { applied.Add(i); Apply(cur, cur.effects[i]); }
            if (Time.time - start >= curDur) { StFx.Clear(fx); StVfx.SetVisible(hero, true); cur = null; }
        }

        bool Inside(SkillDef s, Vector3 p)
        {
            var td = s.telegraph; var o = ctx.origin; var f = ctx.fwd;
            if (td == null) return false;
            var c = td.atAim ? ctx.aim : o; var d = (p - c) / StScale.DU; d.y = 0; float r = d.magnitude; // test in design units
            switch (td.shape)
            {
                case StFx.Shape.Circle: return r <= td.size + 0.5f;
                case StFx.Shape.Ring: return r <= td.size + 0.5f && r >= td.size * td.inner - 0.5f;
                case StFx.Shape.Cone: return r <= td.size + 0.5f && Vector3.Angle(f, d) <= td.angle / 2 + 8;
                case StFx.Shape.Line: { float z = Vector3.Dot(d, f), x = Vector3.Dot(d, ctx.right); return z >= -0.5f && z <= td.size + 0.5f && Mathf.Abs(x) <= td.width / 2 + 0.6f; }
            }
            return false;
        }

        List<StActor> Targets(SkillDef s)
        {
            var list = new List<StActor>(); if (foes == null) return list;
            if (s.telegraph != null) { foreach (var f in foes()) if (f && !f.dead && Inside(s, f.transform.position)) list.Add(f); return list; }
            // single-target / chain skills: nearest to the aim point (chain = 3 hops)
            var all = new List<StActor>(); foreach (var f in foes()) if (f && !f.dead) all.Add(f);
            all.Sort((a, b) => (a.transform.position - ctx.aim).sqrMagnitude.CompareTo((b.transform.position - ctx.aim).sqrMagnitude));
            int n = s.id == "m_chain_spark" ? 3 : 1;
            for (int i = 0; i < all.Count && list.Count < n; i++) if ((all[i].transform.position - ctx.aim).magnitude < (3.5f + i * 2.5f) * StScale.DU) list.Add(all[i]);
            return list;
        }

        void Apply(SkillDef s, EffectStep e)
        {
            switch (e.kind)
            {
                case EffectKind.Heal: hp = Mathf.Min(maxHp, hp + e.amount * 8); onFloat?.Invoke("+" + Mathf.RoundToInt(e.amount * 8), hero.transform.position + Vector3.up * 3.4f * StScale.DU, new Color(0.5f, 1f, 0.5f)); return;
                case EffectKind.Shield: shield = e.amount * 10; shieldUntil = Time.time + e.duration; return;
                case EffectKind.Buff: dmgBuff = 1 + e.amount; buffUntil = Time.time + e.duration; return;
            }
            foreach (var f in Targets(s))
            {
                switch (e.kind)
                {
                    case EffectKind.Damage:
                    {
                        float dmg = e.amount * dmgBuff * power * (StFlags.On("oneShot") ? 20 : 1); f.hp -= dmg; onHit?.Invoke(f, dmg); ult += 0.04f * e.amount;
                        onFloat?.Invoke(Mathf.RoundToInt(dmg * 10).ToString(), f.transform.position + Vector3.up * 3f * StScale.DU, Palette.Ldr(PaletteOf(s).primary));
                        if (f.hp <= 0 && !f.dead) { f.dead = true; f.Once(f.death, 0.05f, true); onKill?.Invoke(f); }
                        else if (!f.dead && f.anim.GetClip(f.hit) != null) f.Once(f.hit, 0.05f);
                        break;
                    }
                    case EffectKind.Knockback:
                    {
                        var d = f.transform.position - hero.transform.position; d.y = 0; f.transform.position += d.normalized * e.amount * StScale.DU; break;
                    }
                    case EffectKind.Status: status[f] = (e.status, Time.time + e.duration); break;
                }
            }
        }

        public bool Slowed(StActor f) => status.TryGetValue(f, out var s) && Time.time < s.until && (s.s == Status.Slow || s.s == Status.Freeze);
        public bool Stunned(StActor f) => status.TryGetValue(f, out var s) && Time.time < s.until && (s.s == Status.Stun || s.s == Status.Root || s.s == Status.Freeze);
    }
}
