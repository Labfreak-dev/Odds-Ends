using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Hollowmere.StyleTest.Skills;

namespace Hollowmere.StyleTest
{
    /// <summary>Playable phase-5 slice (-styleTest -stMode play5 [-stClass knight|ranger|mage]): subclass pick (debug level 20)
    /// -> loadout -> dungeon fight with the mobile HUD. Tap the floor to move; skills are the HUD buttons (tap = auto-aim).</summary>
    public class StPhase5Play : MonoBehaviour
    {
        Camera cam; int level = 1; string cls = "knight"; Loadout loadout; Canvas screen; StUi.Hud hud;
        StActor hero; StSkillRunner runner; readonly List<StActor> foes = new List<StActor>(); Vector3 moveTo; bool moving; float nextWave, hitCd;
        string selected;

        public static StPhase5Play Begin(Camera c, string cls)
        {
            var g = new GameObject("p5_play"); var p = g.AddComponent<StPhase5Play>(); p.cam = c; p.cls = string.IsNullOrEmpty(cls) ? "knight" : cls; return p;
        }

        void Start() { ShowPick(); var auto = System.Environment.GetEnvironmentVariable("HM_P5AUTO"); if (!string.IsNullOrEmpty(auto)) StartCoroutine(Auto(auto)); }

        /// <summary>Headless smoke test of the realtime path (HM_P5AUTO=&lt;subclass&gt;): level 20 -> pick -> fight -> cast every
        /// equipped skill through StSkillRunner, logging each cast and saving screenshots under -stOut/phase5/play/.</summary>
        IEnumerator Auto(string sub)
        {
            var outDir = System.IO.Path.Combine(System.Environment.GetCommandLineArgs() is var a && System.Array.IndexOf(a, "-stOut") is int i && i >= 0 && i + 1 < a.Length ? a[i + 1] : ".", "phase5/play");
            System.IO.Directory.CreateDirectory(outDir);
            yield return new WaitForSeconds(0.5f); level = 20; var sd = StSkillDb.Subclasses[sub]; cls = sd.cls; loadout = Loadout.Default(cls, sub); ShowLoadout();
            yield return new WaitForSeconds(0.5f); StartFight(); yield return new WaitForSeconds(1.5f);
            runner.ult = 1; int shot = 0;
            foreach (var id in loadout.All())
            {
                var sk = StSkillDb.Skills[id]; if (sk.slot == SlotType.Passive) { runner.ProcPassive(); }
                else { while (runner.Casting) yield return null; runner.mana = runner.maxMana; bool ok = runner.Cast(id); Debug.Log("[ST] p5 play cast " + id + " " + ok); }
                yield return new WaitForSeconds(sk.duration * 0.6f);
                ScreenCapture.CaptureScreenshot(System.IO.Path.Combine(outDir, (shot++).ToString("00") + "_" + id + ".png"));
                yield return new WaitForSeconds(sk.duration * 0.6f + 0.2f);
            }
            int alive = 0; foreach (var f in foes) if (f && !f.dead) alive++;
            Debug.Log("[ST] p5 play done hp " + runner.hp + " mana " + runner.mana + " foes alive " + alive + "/" + foes.Count);
            yield return new WaitForSeconds(0.5f); Application.Quit();
        }

        void ClearScreen() { if (screen) Destroy(screen.gameObject); if (hud != null && hud.canvas) Destroy(hud.canvas.gameObject); hud = null; }

        void ShowPick()
        {
            ClearScreen(); cam.backgroundColor = Color.black;
            screen = StUi.BuildSubclassPick(null, level, null, null, s =>
            {
                if (level < 20) { Debug.Log("[ST] p5 needs level 20"); return; }
                cls = s.cls; loadout = Loadout.Default(cls, s.id); ShowLoadout();
            }, () => { level = 20; ShowPick(); });
        }

        void ShowLoadout()
        {
            ClearScreen();
            screen = StUi.BuildLoadout(null, loadout, level, null, selected, ls => { selected = ls.selected; ShowLoadout(); }, StartFight, () => { level = 20; ShowLoadout(); }).canvas;
        }

        void StartFight()
        {
            ClearScreen();
            foreach (var go in FindObjectsByType<GameObject>(FindObjectsSortMode.None))
                if (go.transform.parent == null && go != gameObject && go != cam.gameObject && go.name != "Hollowmere" && go.name != "EventSystem" && go.name != "arrow_tpl" && go.GetComponent<StyleTestRunner>() == null) Destroy(go);
            StWorld.Built.Clear();
            var biome = cls == "knight" ? "crypt" : cls == "ranger" ? "cave" : "mine";
            StBiomes.Build(biome); cam.backgroundColor = RenderSettings.fogColor;
            hero = StPhase5Shots.Hero(cls, loadout.subclass, StBiomes.Hero, 0); hero.Loop(hero.idle);
            runner = StSkillRunner.Attach(hero, cam, loadout); runner.level = level; runner.maxHp = runner.hp = 820; runner.maxMana = runner.mana = 300; runner.ult = 0.5f;
            runner.foes = () => foes;
            hud = StUi.BuildHud(null, loadout, new StUi.HudState { hp = 820, maxHp = 820, mana = 300, maxMana = 300, level = level, ult = 0.5f }, runner, () => { level = 20; runner.level = 20; });
            nextWave = 0;
        }

        void Wave()
        {
            foes.RemoveAll(f => f == null || f.dead);
            var biome = cls == "knight" ? "crypt" : cls == "ranger" ? "cave" : "mine"; var ros = StBestiary.Rosters[biome];
            for (int i = 0; i < 5; i++)
            {
                var p = hero.transform.position + Quaternion.Euler(0, i * 72 + Random.value * 30, 0) * Vector3.forward * (9 + Random.value * 3);
                var m = StBestiary.Spawn(ros[i % 5], p, 0); if (m == null) continue; m.hp = 3; foes.Add(m);
            }
            nextWave = Time.time + 25;
        }

        void Update()
        {
            if (hero == null) return;
            if (Time.time > nextWave || foes.TrueForAll(f => f == null || f.dead)) Wave();
            StUi.Tick(hud);
            // tap to move
            var ptr = UnityEngine.InputSystem.Pointer.current;
            if (ptr != null && ptr.press.wasPressedThisFrame && !(UnityEngine.EventSystems.EventSystem.current && UnityEngine.EventSystems.EventSystem.current.IsPointerOverGameObject()))
            {
                var ray = cam.ScreenPointToRay(ptr.position.ReadValue()); var pl = new Plane(Vector3.up, hero.transform.position);
                if (pl.Raycast(ray, out var d)) { moveTo = ray.GetPoint(d); moving = true; }
            }
            if (!runner.Casting && moving)
            {
                var dv = moveTo - hero.transform.position; dv.y = 0;
                if (dv.magnitude < 0.2f) { moving = false; hero.Loop(hero.idle); }
                else { hero.transform.rotation = Quaternion.LookRotation(dv); hero.transform.position += dv.normalized * Mathf.Min(dv.magnitude, hero.speed * Time.deltaTime); hero.Loop(hero.run); }
            }
            else if (!runner.Casting && !hero.Busy) hero.Loop(hero.idle);
            // foes walk in and hit
            foreach (var f in foes)
            {
                if (f == null || f.dead || runner.Stunned(f)) continue;
                var dv = hero.transform.position - f.transform.position; dv.y = 0; f.transform.rotation = Quaternion.LookRotation(dv);
                if (dv.magnitude > 2.2f) { f.transform.position += dv.normalized * f.speed * (runner.Slowed(f) ? 0.4f : 1f) * Time.deltaTime * 0.6f; if (!f.Busy) f.Loop(f.run); }
                else if (Time.time > hitCd) { hitCd = Time.time + 1.2f; if (f.anim.GetClip(f.attack) != null) f.Once(f.attack); runner.TakeDamage(18); }
            }
            // follow camera
            var tgt = hero.transform.position + new Vector3(0, 1.2f, 3.5f);
            cam.transform.position = Vector3.Lerp(cam.transform.position, tgt + Quaternion.Euler(52, 0, 0) * new Vector3(0, 0, -17f), 6 * Time.deltaTime); cam.transform.rotation = Quaternion.Euler(52, 0, 0);
            if (runner.hp <= 0) { runner.hp = runner.maxHp; Debug.Log("[ST] p5 hero down - refilled"); }
        }
    }
}
