using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.UI;
using Hollowmere.StyleTest.Skills;

namespace Hollowmere.StyleTest
{
    /// <summary>Phase-6 automated smoke test (-styleTest -stMode smoke -stOut DIR). Drives the real StGame through its own UI buttons
    /// (Button.onClick on the live widgets) and the joystick input: for each class create -> town -> (fishing, loadout) -> every
    /// dungeon (cast all equipped skills, kill all waves + boss, take the portal home) -> death/respawn -> set level 20 -> pick
    /// the subclass -> subclass dungeon run -> return to town -> save &amp; quit -> Continue. Logs "[SMOKE] PASS|FAIL step" lines,
    /// saves 2340x1080 screenshots and DIR/smoke_results.txt, then quits (exit code 0 only when every step passed and no
    /// exception was logged). Env: HM_SMOKE_CLASSES=knight,ranger HM_SMOKE_BIOMES=crypt,cave limit the matrix.</summary>
    public class StSmokeTest : MonoBehaviour
    {
        Camera cam; string outDir; StGame g; int pass, fail, shot; readonly List<string> lines = new List<string>(); readonly List<string> errors = new List<string>();
        float t0, nextPlan;

        public static StSmokeTest Begin(Camera cam, string outDir)
        {
            var go = new GameObject("st_smoke"); var s = go.AddComponent<StSmokeTest>(); s.cam = cam; s.outDir = outDir; return s;
        }

        void Awake() { Application.logMessageReceived += OnLog; }
        void OnDestroy() { Application.logMessageReceived -= OnLog; }

        void OnLog(string msg, string stack, LogType type)
        {
            if (type == LogType.Exception || type == LogType.Error || type == LogType.Assert)
            { if (errors.Count < 60) errors.Add(type + ": " + msg + (type == LogType.Exception ? "\n" + stack : "")); }
        }

        void Step(string name, bool ok, string detail = "")
        {
            if (ok) pass++; else fail++;
            var l = (ok ? "PASS " : "FAIL ") + name + (string.IsNullOrEmpty(detail) ? "" : "  (" + detail + ")") + "  t=" + (Time.realtimeSinceStartup - t0).ToString("0") + "s";
            lines.Add(l); Debug.Log("[SMOKE] " + l);
        }

        IEnumerator Shot(string name)
        {
            yield return null; yield return new WaitForEndOfFrame();
            var p = Path.Combine(outDir, (shot++).ToString("00") + "_" + name + ".png"); ScreenCapture.CaptureScreenshot(p);
            yield return null; yield return null;
        }

        bool Click(string name)
        {
            var b = StGameUi.Find(name);
            if (b == null) { Debug.Log("[SMOKE] button not found: " + name); return false; }
            b.onClick.Invoke(); return true;
        }

        IEnumerator Until(System.Func<bool> cond, float timeout)
        {
            float t = Time.realtimeSinceStartup; while (!cond() && Time.realtimeSinceStartup - t < timeout) yield return null;
        }

        IEnumerator Wait(float s) { float t = Time.realtimeSinceStartup; while (Time.realtimeSinceStartup - t < s) yield return null; }

        static List<string> Env(string key, string def)
        {
            var v = System.Environment.GetEnvironmentVariable(key); if (string.IsNullOrEmpty(v)) v = def;
            return new List<string>(v.Split(','));
        }

        static readonly Dictionary<string, string> SubOf = new Dictionary<string, string> { { "knight", "paladin" }, { "ranger", "sharpshooter" }, { "mage", "fire_wizard" } };

        IEnumerator Start()
        {
            t0 = Time.realtimeSinceStartup; Directory.CreateDirectory(outDir);
            StSave.Wipe();
            g = StGame.Begin(cam);
            yield return Wait(2.5f);
            Step("boot -> title", g.where == StGame.Where.Title && StGameUi.Find("btn_new") != null);
            yield return Shot("title");
            var classes = Env("HM_SMOKE_CLASSES", "knight,ranger,mage"); var biomes = Env("HM_SMOKE_BIOMES", "crypt,cave,sewer,mine");
            bool first = true;
            foreach (var cls in classes)
            {
                yield return RunClass(cls, biomes, first); first = false;
            }
            // persistence: Continue restores the last hero
            yield return Until(() => StGameUi.Find("btn_continue") != null, 10);
            Step("title shows Continue (save present)", StGameUi.Find("btn_continue") != null);
            var last = classes[classes.Count - 1];
            Click("btn_continue"); yield return Until(() => g.where == StGame.Where.Town && g.hero != null, 30); yield return Wait(1f);
            Step("Continue -> town with saved hero", g.where == StGame.Where.Town && g.save != null && g.save.cls == last && g.save.level >= 20 && g.save.sub == SubOf[last],
                g.save == null ? "no save" : g.save.name + " " + g.save.cls + " lv" + g.save.level + " sub " + g.save.sub + " gold " + g.save.gold);
            yield return Shot("continue_town");
            Finish();
        }

        IEnumerator RunClass(string cls, List<string> biomes, bool first)
        {
            // ---- create
            if (!Click("btn_new")) { Step(cls + ": new game", false, "no New Game button"); yield break; }
            yield return Wait(1.0f);
            Click("btn_class_" + cls); yield return Wait(1.2f);
            var nf = Object.FindFirstObjectByType<InputField>(); if (nf) nf.text = "Smoke" + char.ToUpper(cls[0]) + cls.Substring(1);
            Step(cls + ": character creation shows class preview", g.where == StGame.Where.Create && nf != null && StGameUi.Find("btn_begin") != null);
            yield return Shot(cls + "_create");
            Click("btn_begin");
            yield return Until(() => g.where == StGame.Where.Town && g.hero != null, 30); yield return Wait(1.5f);
            Step(cls + ": enter town", g.where == StGame.Where.Town && g.hero != null && g.save.cls == cls && StTown.Folk.Count > 0, "folk " + StTown.Folk.Count);
            yield return Shot(cls + "_town");

            // ---- town extras (once): fishing + loadout
            if (first)
            {
                if (StFlags.On("fishing") && g.spot != null)
                {
                    yield return WalkTo(g.spot.stand - g.spot.facing * 0.3f, 0.5f, 25);
                    yield return Wait(0.5f);
                    bool btn = StGameUi.Find("btn_fish") != null;
                    Step("town: FISH button near the spot", btn, "dist " + (g.hero.transform.position - g.spot.stand).magnitude.ToString("0.0") + " m");
                    yield return Shot("town_fish_button");
                    int fish0 = g.save.fish; g.StartFishing(true); yield return Wait(4f); yield return Shot("town_fishing");
                    yield return Until(() => g.fishing == null, 150);
                    Step("town: fishing autoplay (3 casts)", g.fishing == null && g.save.fish > fish0, "caught " + (g.save.fish - fish0));
                }
                else Step("town: fishing (flag off)", true, "skipped: fishing flag off");
                Click("btn_loadout"); yield return Wait(0.6f);
                bool lo = GameObject.Find("st_loadout") != null; Step("town: loadout screen opens", lo);
                yield return Shot(cls + "_loadout");
                Click("done"); yield return Wait(0.4f);
                Step("town: loadout closes back to town", !g.ModalOpen && g.where == StGame.Where.Town && !g.paused);
            }

            // ---- dungeons
            int bi = 0;
            foreach (var b in biomes) { yield return RunDungeon(cls, b, first && bi == 0, bi == 0); bi++; }

            // ---- death -> respawn (first class only)
            if (first)
            {
                yield return GoThroughGate(biomes[0]);
                if (g.where == StGame.Where.Dungeon)
                {
                    StFlags.Override("godMode", false); yield return Wait(2.5f);
                    g.runner.hp = 1; g.runner.TakeDamage(50); yield return Until(() => StGameUi.Find("btn_respawn") != null, 10);
                    Step(cls + ": death shows respawn", StGameUi.Find("btn_respawn") != null && g.dead);
                    yield return Shot(cls + "_death");
                    Click("btn_respawn"); yield return Until(() => g.where == StGame.Where.Town && g.hero != null, 30); yield return Wait(1f);
                    Step(cls + ": respawn in town at full hp", g.where == StGame.Where.Town && g.runner.hp >= g.runner.maxHp - 0.5f && g.save.deaths >= 1);
                }
                else Step(cls + ": death test", false, "could not enter dungeon");
            }

            // ---- level 20 + subclass
            Click("dbg_level20"); yield return Wait(1.6f);
            Step(cls + ": debug Set level 20", g.save.level >= 20, "lv " + g.save.level);
            yield return Until(() => GameObject.Find("st_pick") != null, 5);
            Step(cls + ": subclass pick offered at 20", GameObject.Find("st_pick") != null);
            yield return Shot(cls + "_subclass_pick");
            var sub = SubOf[cls]; Click("card_" + sub); yield return Wait(1.2f);
            Step(cls + ": pick subclass " + sub, g.save.sub == sub && g.runner.loadout.subclass == sub && !g.ModalOpen, "loadout " + string.Join(",", g.save.loadout.All()));
            yield return Shot(cls + "_" + sub + "_town");

            // ---- subclass dungeon: cast every equipped skill (incl. subclass skills), then return to town via pause
            var sb = biomes[biomes.Count - 1];
            yield return GoThroughGate(sb);
            if (g.where == StGame.Where.Dungeon)
            {
                StFlags.Override("godMode", true); yield return Until(() => g.foes.Count > 0, 6);
                yield return CastAll(cls + "/" + sub + " " + sb, true);
                Click("btn_pause"); yield return Wait(0.3f); Click("btn_leave");
                yield return Until(() => g.where == StGame.Where.Town && g.hero != null, 30); yield return Wait(1f);
                Step(cls + ": return to town from pause menu", g.where == StGame.Where.Town);
            }
            else Step(cls + ": subclass dungeon", false, "could not enter " + sb);

            // ---- save & quit to title
            Click("btn_pause"); yield return Wait(0.3f); Click("btn_title"); yield return Until(() => g.where == StGame.Where.Title, 20); yield return Wait(1f);
            Step(cls + ": save & quit to title", g.where == StGame.Where.Title && StSave.Exists);
        }

        IEnumerator GoThroughGate(string biome)
        {
            if (g.where != StGame.Where.Town) yield break;
            var gate = StTown.Spots.TryGetValue("gate", out var gp) ? gp : new Vector3(0, 0, 17.4f);
            yield return WalkTo(gate + new Vector3(0, 0, 3f), 0.4f, 40, () => GameObject.Find("st_dungeons") != null);
            yield return Until(() => GameObject.Find("st_dungeons") != null, 3);
            Click("btn_dungeon_" + biome);
            yield return Until(() => g.where == StGame.Where.Dungeon && g.hero != null, 30); yield return Wait(0.5f);
        }

        IEnumerator RunDungeon(string cls, string biome, bool honest, bool shots)
        {
            yield return GoThroughGate(biome);
            Step(cls + ": walk to gate + enter " + biome, g.where == StGame.Where.Dungeon && g.biome == biome);
            if (g.where != StGame.Where.Dungeon) yield break;
            yield return Until(() => g.foes.Count > 0, 6); yield return Wait(0.6f);
            StFlags.Override("godMode", true); // the smoke tests the flow, not balance (death is tested on its own)
            yield return Shot(cls + "_" + biome + "_enter");
            yield return CastAll(cls + " " + biome, shots);
            // kill everything: drive toward the nearest foe and fight with the HUD buttons
            StFlags.Override("oneShot", !honest);
            float start = Time.realtimeSinceStartup; bool bossShot = false; int k0 = g.kills;
            while (!g.cleared && Time.realtimeSinceStartup - start < (honest ? 240 : 150))
            {
                yield return Fight();
                if (!bossShot && g.boss != null && g.bossEngaged && !g.boss.dead && Time.realtimeSinceStartup - start > 1) { yield return Wait(0.8f); yield return Shot(cls + "_" + biome + "_boss"); bossShot = true; }
            }
            g.drive = null;
            Step(cls + ": kill waves + boss in " + biome, g.cleared, "kills " + (g.kills - k0) + ", waves " + g.wave + "/" + g.waveCount + ", " + (Time.realtimeSinceStartup - start).ToString("0") + "s" + (honest ? " real damage" : " one-shot"));
            StFlags.Override("oneShot", false);
            if (!g.cleared) { Click("btn_pause"); yield return Wait(0.3f); Click("btn_leave"); yield return Until(() => g.where == StGame.Where.Town, 30); yield break; }
            yield return Until(() => g.portal != null, 5); yield return Wait(1.2f);
            yield return Shot(cls + "_" + biome + "_cleared");
            Step(cls + ": loot/xp + portal in " + biome, g.portal != null && g.save.Cleared(biome), "lv " + g.save.level + " xp " + g.save.xp + " gold " + g.save.gold);
            if (g.portal != null && !g.portal.armed)
            {   // the portal arms once the hero has stood clear of it: step away first
                var away = g.portal.transform.position + (StBiomes.Centre - g.portal.transform.position).normalized * 3.5f; away.y = 0;
                yield return WalkTo(away, 0.4f, 15); yield return Wait(0.3f);
            }
            if (g.portal != null) yield return WalkTo(g.portal.transform.position, 0.3f, 30, () => g.where == StGame.Where.Town);
            yield return Until(() => g.where == StGame.Where.Town && g.hero != null, 20); yield return Wait(0.8f);
            Step(cls + ": portal -> town from " + biome, g.where == StGame.Where.Town);
        }

        /// <summary>Taps every equipped skill's HUD button (basic, 4 actives, ultimate; passive proc) and checks the runner took it.</summary>
        IEnumerator CastAll(string tag, bool shots)
        {
            var l = g.runner.loadout; int ok = 0, n = 0; var bad = new List<string>();
            var ids = new List<string> { l.basic }; ids.AddRange(l.actives); ids.Add(l.ultimate);
            foreach (var id in ids)
            {
                if (string.IsNullOrEmpty(id)) continue; n++;
                yield return Until(() => !g.runner.Casting, 6);
                // face a live foe so aimed skills have something to hit
                g.runner.mana = g.runner.maxMana; if (StSkillDb.Skills[id].slot == SlotType.Ultimate) g.runner.ult = 1;
                bool clicked = Click("btn_" + id); yield return null;
                bool took = g.runner.Current != null && g.runner.Current.id == id || g.runner.CooldownLeft(id) > 0;
                if (clicked && took) ok++; else bad.Add(id + (clicked ? "" : "(no button)"));
                var sk = StSkillDb.Skills[id];
                yield return Wait(sk.duration * 0.55f);
                if (shots) yield return Shot(tag.Replace(' ', '_').Replace('/', '_') + "_" + id);
                yield return Until(() => !g.runner.Casting, 6);
            }
            if (!string.IsNullOrEmpty(l.passive)) { g.runner.ProcPassive(); yield return Wait(0.5f); }
            Step(tag + ": cast all equipped skills " + ok + "/" + n, ok == n, bad.Count > 0 ? "failed " + string.Join(",", bad) : string.Join(",", ids));
        }

        /// <summary>One fight tick (~0.1 s): close to engage range of the nearest live foe, then use whatever is off cooldown.</summary>
        IEnumerator Fight()
        {
            var h = g.hero; StActor tgt = null; float best = 1e9f;
            foreach (var f in g.foes) if (f && !f.dead) { float d = (f.transform.position - h.transform.position).sqrMagnitude; if (d < best) { best = d; tgt = f; } }
            if (tgt == null) { g.drive = Vector2.zero; yield return Wait(0.1f); yield break; }
            var basic = StSkillDb.Skills[g.runner.loadout.basic];
            float engage = Mathf.Max(1.0f, basic.range * StScale.DU * 0.85f);
            var dv = tgt.transform.position - h.transform.position; dv.y = 0;
            bool vis = StTargeting.Visible(h, tgt, out _);
            if (dv.magnitude > engage || !vis)
            {   // approach along the game's own A* path (re-planned every 0.5 s), joystick drive as fallback
                g.drive = null;
                if (Time.realtimeSinceStartup >= nextPlan) { nextPlan = Time.realtimeSinceStartup + 0.5f; if (!g.SetDestination(tgt.transform.position)) g.drive = new Vector2(dv.x, dv.z).normalized; }
                yield return Wait(0.1f); yield break;
            }
            g.drive = Vector2.zero; nextPlan = 0; g.StopMoving();
            if (!g.runner.Casting)
            {
                string pick = null; var l = g.runner.loadout;
                if (g.runner.ult >= 1 && g.runner.CanCast(l.ultimate, out _)) pick = l.ultimate;
                foreach (var a in l.actives) if (pick == null && !string.IsNullOrEmpty(a) && g.runner.CanCast(a, out _) && StSkillDb.Skills[a].effects.Exists(e => e.kind == EffectKind.Damage)) pick = a;
                if (pick == null) pick = l.basic;
                Click("btn_" + pick);
            }
            yield return Wait(0.1f);
        }

        /// <summary>Walks with the joystick input toward a point; sidesteps when blocked (no navmesh in the prototype).</summary>
        IEnumerator WalkTo(Vector3 target, float tol, float timeout, System.Func<bool> stop = null)
        {
            // the game's own tap-to-move path (A* around props) first; joystick steering only as a fallback
            g.drive = null;
            if (g.hero != null && g.SetDestination(target))
            {
                float t1 = Time.realtimeSinceStartup;
                while (g.hero != null && g.Moving && Time.realtimeSinceStartup - t1 < timeout && (stop == null || !stop())) yield return null;
                if (g.hero == null || stop != null && stop()) yield break;
                var dd = target - g.hero.transform.position; dd.y = 0; if (dd.magnitude < tol + 0.3f) yield break;
                Debug.Log("[SMOKE] path ended " + dd.magnitude.ToString("0.0") + " m short, steering");
            }
            else Debug.Log("[SMOKE] no path to " + target + ", steering");
            float t = Time.realtimeSinceStartup; var last = g.hero ? g.hero.transform.position : Vector3.zero; float lastT = t; int side = 1; float sideUntil = 0;
            while (g.hero != null && Time.realtimeSinceStartup - t < timeout && (stop == null || !stop()))
            {
                var d = target - g.hero.transform.position; d.y = 0; if (d.magnitude < tol) break;
                var dir = new Vector2(d.x, d.z).normalized;
                if (Time.realtimeSinceStartup < sideUntil) dir = (dir * 0.25f + new Vector2(-dir.y, dir.x) * side).normalized;
                g.drive = dir; yield return null;
                if (Time.realtimeSinceStartup - lastT > 0.4f)
                {
                    if ((g.hero.transform.position - last).magnitude < 0.12f) { sideUntil = Time.realtimeSinceStartup + 0.9f; side = -side; }
                    last = g.hero.transform.position; lastT = Time.realtimeSinceStartup;
                }
            }
            if (g != null) g.drive = Vector2.zero; yield return null; if (g != null) g.drive = null;
        }

        void Finish()
        {
            int exc = 0; foreach (var e in errors) if (e.StartsWith("Exception")) exc++;
            var head = "SMOKE " + (fail == 0 && errors.Count == 0 ? "ALL PASS" : "FAILURES") + ": " + pass + " pass, " + fail + " fail, " + exc + " exceptions, " + errors.Count + " errors, " + (Time.realtimeSinceStartup - t0).ToString("0") + " s";
            Debug.Log("[SMOKE] " + head);
            var all = new List<string> { head, "flags: " + StFlags.Describe(), "" }; all.AddRange(lines);
            if (errors.Count > 0) { all.Add(""); all.Add("ERRORS:"); all.AddRange(errors); }
            File.WriteAllLines(Path.Combine(outDir, "smoke_results.txt"), all);
            StartCoroutine(Quit(fail == 0 && errors.Count == 0 ? 0 : 1));
        }

        IEnumerator Quit(int code) { yield return Wait(1f); Application.Quit(code); }
    }
}
