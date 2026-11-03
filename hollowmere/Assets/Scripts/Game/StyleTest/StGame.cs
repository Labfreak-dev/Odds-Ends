using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Hollowmere.StyleTest.Skills;
using Hollowmere.StyleTest.Fishing;

namespace Hollowmere.StyleTest
{
    /// <summary>Phase 6: the style test as a game loop. Boot -> title -> character creation (name + class, outfit preview) ->
    /// town hub (walkable, folk, fishing spot, dungeon gate) -> dungeon biomes (waves -> elite -> boss -> loot/XP -> return portal)
    /// with the phase-5 mobile HUD, loadout (town button / pause), level-ups and the subclass pick at 20 (debug "Set level 20"
    /// kept). Joystick + tap-to-move; death respawns in town; progress in PlayerPrefs (StSave). -stMode game (APK default).</summary>
    public class StGame : MonoBehaviour
    {
        public static StGame I;
        public enum Where { Title, Create, Town, Dungeon }
        public Where where; public Camera cam; public StSave save;
        public StActor hero; public StSkillRunner runner; public StUi.Hud hud;
        public readonly List<StActor> foes = new List<StActor>();
        public string biome; public int wave, waveCount; public bool cleared, dead, paused;
        public StActor boss; public bool bossEngaged; public StPortal portal;
        public FishSpot spot; public StFishing fishing;
        /// <summary>Smoke-test drive: when set, replaces joystick/keyboard input (x = right, y = up/north).</summary>
        public Vector2? drive;
        public int kills; public string lastToast;

        Canvas sceneUi, modal, toastCv; StJoystick joy; RectTransform fishBtn; Text goldTxt, xpTxt, waveTxt, fpsTxt; Image xpFill;
        Vector3 moveTo; bool moving; readonly List<Vector3> path = new List<Vector3>(); bool gateArmed = true; float nextWaveAt = -1; int fishSeed = 1; float camDist;
        string createCls = "knight"; InputField nameField; StActor preview; float previewYaw;
        static readonly string[] Names = { "Rowan", "Elsa", "Bram", "Isolde", "Corin", "Mira", "Tamsin", "Alder" };

        public static readonly Dictionary<string, (string name, int lvl, int tier, string blurb)> Dungeons = new Dictionary<string, (string, int, int, string)>
        {
            { "crypt", ("Ossuary Crypt", 1, 0, "Skeletons stir beneath the chapel. Boss: Death.") },
            { "cave",  ("Glimmer Cave", 5, 1, "Crystal-lit tunnels full of spiders and bats. Boss: Cave Drake.") },
            { "sewer", ("Outflow Sewer", 10, 2, "Rats, slimes and worse in the old drains. Boss: Giant Mutant.") },
            { "mine",  ("Flooded Mine", 15, 3, "Imps work the deep seams. Boss: Lava Golem.") },
        };
        static readonly float[] TierHp = { 1f, 1.6f, 2.4f, 3.4f }, TierDmg = { 1f, 1.35f, 1.8f, 2.4f };

        public static StGame Begin(Camera cam)
        {
            var g = new GameObject("st_game"); var s = g.AddComponent<StGame>(); s.cam = cam; I = s; return s;
        }

        void Start()
        {
            Debug.Log("[ST] game start, flags " + StFlags.Describe());
            ShowTitle();
        }

        // ================================================================== scene plumbing
        void Clear()
        {
            CloseModal(); if (sceneUi) Destroy(sceneUi.gameObject); if (hud != null && hud.canvas) Destroy(hud.canvas.gameObject); hud = null;
            if (fishing != null) { fishing.onEnd = null; fishing = null; }
            foreach (var go in FindObjectsByType<GameObject>(FindObjectsSortMode.None))
                if (go.transform.parent == null && go != gameObject && go != cam.gameObject && go.name != "Hollowmere" && go.name != "EventSystem"
                    && go.name != "arrow_tpl" && go.name != "StyleTest" && go.name != "st_smoke" && go.GetComponent<StyleTestRunner>() == null && (!toastCv || go != toastCv.gameObject)) Destroy(go);
            StWorld.Built.Clear(); StBiomes.Built.Clear(); StTown.Built.Clear(); foes.Clear();
            hero = null; runner = null; boss = null; bossEngaged = false; portal = null; spot = null; preview = null; moving = false; dead = false;
            Time.timeScale = 1; paused = false; drive = null;
        }

        void CloseModal() { if (modal) Destroy(modal.gameObject); modal = null; if (paused) { paused = false; Time.timeScale = 1; } }

        public bool ModalOpen => modal != null;

        public void Toast(string s, Color? c = null, float secs = 2.2f)
        {
            lastToast = s; Debug.Log("[ST] toast " + s);
            if (!toastCv) { toastCv = StGameUi.Canvas("st_toast", 15); DontDestroyOnLoad(toastCv.gameObject); }
            foreach (Transform t in toastCv.transform) Destroy(t.gameObject);
            var r = StGameUi.PanelRect(toastCv.transform, "toast", new Vector2(0.5f, 1), new Vector2(0, -250), new Vector2(1100, 110), new Color(0.05f, 0.05f, 0.07f, 0.85f));
            r.GetComponent<Image>().raycastTarget = false;
            StUi.Txt(r, s, 46, c ?? StGameUi.Gold, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1080, 100), TextAnchor.MiddleCenter, FontStyle.Bold);
            StartCoroutine(KillToast(r.gameObject, secs));
        }
        IEnumerator KillToast(GameObject g, float s) { yield return new WaitForSecondsRealtime(s); if (g) Destroy(g); }

        // ================================================================== title
        public void ShowTitle()
        {
            Clear(); where = Where.Title;
            StTown.Lighting(); StTown.Build(); cam.backgroundColor = new Color(0.62f, 0.66f, 0.74f); cam.fieldOfView = 35; cam.farClipPlane = 200;
            sceneUi = StGameUi.Canvas("st_title", 10); var root = sceneUi.transform;
            var shade = StUi.Stretch(root, "shade"); StUi.Img(shade, new Color(0.02f, 0.02f, 0.05f, 0.55f), StUi.Vertical).transform.localScale = new Vector3(1, -1, 1);
            StUi.Txt(root, "HOLLOWMERE", 150, new Color(1f, 0.9f, 0.68f), new Vector2(0.5f, 1), new Vector2(0, -130), new Vector2(1800, 190), TextAnchor.MiddleCenter, FontStyle.Bold);
            StUi.Txt(root, "style test · playable prototype", 40, StGameUi.Dim, new Vector2(0.5f, 1), new Vector2(0, -270), new Vector2(1600, 60));
            var existing = StSave.Load(); float y = 70;
            if (existing != null)
            {
                var c = StGameUi.Button(root, "btn_continue", "Continue", new Vector2(0.5f, 0.5f), new Vector2(0, y), new Vector2(560, 110), StGameUi.Green, () => { save = StSave.Load(); EnterTown("Welcome back"); }, 44);
                var cls = StSkillDb.Classes[existing.cls]; var sub = existing.sub != null ? StSkillDb.Subclasses[existing.sub].name : cls.name;
                StUi.Txt(c, existing.name + " · " + sub + " · Lv " + existing.level, 26, StGameUi.Gold, new Vector2(0.5f, 0), new Vector2(0, -24), new Vector2(700, 36));
                y -= 170;
            }
            StGameUi.Button(root, "btn_new", "New Game", new Vector2(0.5f, 0.5f), new Vector2(0, y), new Vector2(560, 110), existing != null ? StGameUi.Slate : StGameUi.Green, ShowCreate, 44);
            StGameUi.Button(root, "btn_flags", "Feature flags", new Vector2(0.5f, 0.5f), new Vector2(0, y - 150), new Vector2(420, 84), StGameUi.Slate, ShowFlags, 30);
            StUi.Txt(root, "Free/CC0 assets: KayKit, Quaternius, Kenney, VK · see CREDITS_LICENSES.md", 22, StGameUi.Dim, new Vector2(0.5f, 0), new Vector2(0, 40), new Vector2(1800, 40));
            camDist = 0;
        }

        void TitleTick()
        {
            float a = Time.time * 4f; var c = Quaternion.Euler(0, a, 0) * new Vector3(0, 0, -34f) + Vector3.up * 15;
            cam.transform.position = c; cam.transform.LookAt(new Vector3(0, 1.5f, 4));
        }

        // ================================================================== character creation
        public void ShowCreate()
        {
            Clear(); where = Where.Create;
            StWorld.NeutralLighting(); RenderSettings.fog = false;
            cam.backgroundColor = new Color(0.10f, 0.09f, 0.13f); cam.fieldOfView = 35;
            var ped = StKit.Spawn("Dungeon/floor_tile_small", Vector3.zero, 0); var b = StWorld.Bounds(ped);
            ped.transform.localScale *= 1.6f / Mathf.Max(0.1f, b.size.x); b = StWorld.Bounds(ped); ped.transform.position += new Vector3(-b.center.x, -b.max.y, -b.center.z);
            var key = new GameObject("create_spot").AddComponent<Light>(); key.type = LightType.Spot; key.spotAngle = 40; key.range = 12; key.intensity = 6; key.color = new Color(1f, 0.92f, 0.8f);
            key.transform.position = new Vector3(0, 6, -2); key.transform.LookAt(Vector3.up * 0.8f);
            cam.transform.position = new Vector3(2.3f, 1.35f, -6.6f); cam.transform.rotation = Quaternion.Euler(5, 0, 0);

            sceneUi = StGameUi.Canvas("st_create", 10); var root = sceneUi.transform;
            StUi.Txt(root, "CREATE YOUR HERO", 64, Color.white, new Vector2(0.5f, 1), new Vector2(0, -40), new Vector2(1400, 90), TextAnchor.MiddleCenter, FontStyle.Bold);
            var panel = StGameUi.PanelRect(root, "create_panel", new Vector2(1, 0.5f), new Vector2(-470, -20), new Vector2(860, 860));
            StUi.Txt(panel, "NAME", 30, StGameUi.Dim, new Vector2(0.5f, 1), new Vector2(-330, -50), new Vector2(160, 40), TextAnchor.MiddleLeft, FontStyle.Bold);
            nameField = NameField(panel, Names[Random.Range(0, Names.Length)]);
            StUi.Txt(panel, "CLASS", 30, StGameUi.Dim, new Vector2(0.5f, 1), new Vector2(-330, -200), new Vector2(160, 40), TextAnchor.MiddleLeft, FontStyle.Bold);
            string[] ids = { "knight", "ranger", "mage" };
            for (int i = 0; i < 3; i++)
            {
                var c = StSkillDb.Classes[ids[i]]; var id = ids[i];
                var btn = StGameUi.Button(panel, "btn_class_" + id, c.name, new Vector2(0.5f, 1), new Vector2(-270 + i * 270, -290), new Vector2(250, 100), id == createCls ? (Color)Palette.Ldr(c.palette.primary) * 0.85f : StGameUi.Slate, () => { createCls = id; RefreshCreate(); }, 36);
                if (id == createCls) { var rim = StUi.Rect(btn, "sel", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(262, 112)); var ri = StUi.Img(rim, StGameUi.Gold, StUi.RoundRect); ri.type = Image.Type.Sliced; ri.fillCenter = false; }
            }
            var cd = StSkillDb.Classes[createCls];
            StUi.Txt(panel, cd.blurb, 32, Color.white, new Vector2(0.5f, 1), new Vector2(0, -380), new Vector2(780, 50), TextAnchor.MiddleCenter);
            StUi.Txt(panel, "Starting skills", 26, StGameUi.Dim, new Vector2(0.5f, 1), new Vector2(0, -440), new Vector2(780, 40));
            var l = Loadout.Default(createCls); int k = 0;
            foreach (var sid in l.All())
            {
                if (string.IsNullOrEmpty(sid)) continue; var sk = StSkillDb.Skills[sid];
                var ic = StUi.IconButton(panel, sk, l.Palette, new Vector2(0.5f, 1), new Vector2(-306 + k * 102, -530), 90, sk.slot == SlotType.Ultimate); k++;
            }
            StUi.Txt(panel, "Subclass paths unlock at level 20", 26, StGameUi.Gold, new Vector2(0.5f, 1), new Vector2(0, -620), new Vector2(780, 40));
            StGameUi.Button(panel, "btn_begin", "Begin adventure", new Vector2(0.5f, 0), new Vector2(0, 70), new Vector2(560, 110), StGameUi.Green, () => CreateHero(nameField ? nameField.text : "Hero", createCls), 42);
            StGameUi.Button(root, "btn_back", "Back", new Vector2(0, 1), new Vector2(130, -60), new Vector2(200, 80), StGameUi.Slate, ShowTitle, 30);
            Preview();
        }

        void RefreshCreate() { var n = nameField ? nameField.text : null; ShowCreate(); if (nameField && !string.IsNullOrEmpty(n)) nameField.text = n; }

        void Preview()
        {
            if (preview) Destroy(preview.gameObject);
            preview = StPhase5Shots.Hero(createCls, null, Vector3.zero, 180 + 25); preview.Loop(preview.idle); previewYaw = 180 + 25;
        }

        void CreateTick()
        {
            if (preview == null) return;
            previewYaw += Time.deltaTime * 18; preview.transform.rotation = Quaternion.Euler(0, previewYaw, 0);
        }

        static InputField NameField(Transform parent, string def)
        {
            var r = StUi.Rect(parent, "name_field", new Vector2(0.5f, 1), new Vector2(60, -120), new Vector2(620, 90)); var im = StUi.Img(r, new Color(0, 0, 0, 0.5f), StUi.RoundRect); im.type = Image.Type.Sliced; im.raycastTarget = true;
            var t = StUi.Txt(r, "", 40, Color.white, new Vector2(0.5f, 0.5f), new Vector2(-290, 0), new Vector2(580, 80), TextAnchor.MiddleLeft); t.supportRichText = false;
            var f = r.gameObject.AddComponent<InputField>(); f.textComponent = t; f.characterLimit = 14; f.targetGraphic = im; f.text = def;
            return f;
        }

        public void CreateHero(string name, string cls)
        {
            save = StSave.New(name, cls); save.Save();
            Debug.Log("[ST] created " + save.name + " " + cls);
            EnterTown("Welcome to Hollowmere, " + save.name);
        }

        // ================================================================== hero + HUD shared by town and dungeons
        void SpawnHero(Vector3 at, float yaw)
        {
            hero = StPhase5Shots.Hero(save.cls, save.sub, at, yaw); hero.Loop(hero.idle);
            runner = StSkillRunner.Attach(hero, cam, save.loadout); runner.foes = () => foes;
            ApplyStats(true);
            runner.onFloat = (s, p, c) => StFloatText.Spawn(s, p, c);
            runner.onKill = OnKill; runner.onHit = OnHit;
            var l = new GameObject("hero_light").AddComponent<Light>(); l.type = LightType.Point; l.range = 7; l.intensity = 1.6f; l.color = new Color(1f, 0.85f, 0.65f);
            l.transform.SetParent(hero.transform, false); l.transform.localPosition = new Vector3(0, 2.2f, -0.6f) / Mathf.Max(0.01f, hero.transform.localScale.y);
        }

        void ApplyStats(bool refill)
        {
            runner.level = save.level; runner.maxHp = 500 + 25 * (save.level - 1); runner.maxMana = 260 + 6 * (save.level - 1);
            runner.power = 1 + 0.07f * (save.level - 1);
            if (refill) { runner.hp = runner.maxHp; runner.mana = runner.maxMana; runner.ult = 0.3f; }
        }

        void BuildHud()
        {
            if (hud != null && hud.canvas) Destroy(hud.canvas.gameObject);
            hud = StUi.BuildHud(null, save.loadout, new StUi.HudState { hp = runner.hp, maxHp = runner.maxHp, mana = runner.mana, maxMana = runner.maxMana, level = save.level, ult = runner.ult }, runner, () => SetLevel(20));
            hud.canvas.sortingOrder = 0; var root = hud.canvas.transform;
            // name over the class line
            StUi.Txt(root, save.name, 30, StGameUi.Gold, new Vector2(0, 1), new Vector2(232, -14), new Vector2(560, 40), TextAnchor.MiddleLeft, FontStyle.Bold);
            StGameUi.Button(root, "btn_pause", "II", new Vector2(1, 1), new Vector2(-400, -67), new Vector2(110, 74), StGameUi.Slate, ShowPause, 38);
            if (where == Where.Town) StGameUi.Button(root, "btn_loadout", "LOADOUT", new Vector2(1, 1), new Vector2(-590, -67), new Vector2(230, 74), StGameUi.Blue, () => ShowLoadout(), 30);
            // top-centre: gold, xp bar, wave/location
            var top = StUi.Rect(root, "top", new Vector2(0.5f, 1), new Vector2(-60, -30), new Vector2(620, 120), new Vector2(0.5f, 1));
            goldTxt = StUi.Txt(top, "", 34, StGameUi.Gold, new Vector2(0.5f, 1), new Vector2(0, 0), new Vector2(600, 44), TextAnchor.MiddleCenter, FontStyle.Bold);
            var xb = StUi.Rect(top, "xp", new Vector2(0.5f, 1), new Vector2(0, -50), new Vector2(560, 22)); StUi.Img(xb, new Color(0, 0, 0, 0.6f), StUi.RoundRect).type = Image.Type.Sliced;
            var xf = StUi.Rect(xb, "fill", new Vector2(0, 0.5f), new Vector2(3, 0), new Vector2(554, 16), new Vector2(0, 0.5f)); xpFill = StUi.Img(xf, new Color(0.55f, 0.35f, 0.95f), StUi.RoundRect); xpFill.type = Image.Type.Sliced;
            xpTxt = StUi.Txt(top, "", 20, Color.white, new Vector2(0.5f, 1), new Vector2(0, -50), new Vector2(560, 22), TextAnchor.MiddleCenter, FontStyle.Bold);
            waveTxt = StUi.Txt(top, "", 30, Color.white, new Vector2(0.5f, 1), new Vector2(0, -80), new Vector2(800, 40), TextAnchor.MiddleCenter, FontStyle.Bold);
            if (StFlags.On("fps")) fpsTxt = StUi.Txt(root, "", 24, Color.green, new Vector2(0.5f, 0), new Vector2(0, 20), new Vector2(300, 30));
            if (StFlags.On("joystick") || StFlags.On("tapToMove"))
            {
                joy = StJoystick.Create(root); joy.onTap = sp => { if (StFlags.On("tapToMove")) TapMove(sp); };
                if (!StFlags.On("joystick")) foreach (Transform t in joy.transform) t.gameObject.SetActive(false);
            }
            fishBtn = StFishUi.FishButton(root, () => StartFishing()); fishBtn.gameObject.SetActive(false);
            TopBar();
        }

        void TopBar()
        {
            if (goldTxt) goldTxt.text = save.gold + " gold";
            int need = StSave.XpToNext(save.level); if (xpFill) ((RectTransform)xpFill.transform).sizeDelta = new Vector2(554 * Mathf.Clamp01(save.xp / (float)need), 16);
            if (xpTxt) xpTxt.text = "XP " + save.xp + " / " + need;
            if (waveTxt) waveTxt.text = where == Where.Town ? "Hollowmere" : cleared ? Dungeons[biome].name + " · cleared" : Dungeons[biome].name + " · " + (boss != null && wave == waveCount ? "BOSS" : "wave " + wave + "/" + waveCount);
        }

        // ================================================================== town
        public void EnterTown(string msg = null)
        {
            Clear(); where = Where.Town; save.Save();
            StTown.Lighting(); StTown.Build();
            StTargeting.BuildOccluders(StTown.Built); // walls/props block walking in town too
            cam.backgroundColor = new Color(0.62f, 0.66f, 0.74f); cam.fieldOfView = StScale.GameCamFov; cam.farClipPlane = 160;
            if (StFlags.On("fishing")) spot = StFishSpot.Build("town");
            SpawnHero(StTown.HeroSpawn, 0); BuildHud(); gateArmed = true;
            cam.transform.position = CamGoal(); cam.transform.rotation = Quaternion.Euler(StScale.GameCamPitch, 0, 0);
            if (msg != null) Toast(msg);
            Debug.Log("[ST] town entered, folk " + StTown.Folk.Count + ", fishing " + (spot != null));
        }

        void TownTick()
        {
            if (fishing != null) { FollowCam(); return; }
            MoveHero(); HudTick();
            var gate = StTown.Spots.TryGetValue("gate", out var g) ? g : new Vector3(0, 0, 17.4f);
            var hp = hero.transform.position; bool atGate = hp.z > gate.z + 1.5f && Mathf.Abs(hp.x - gate.x) < 3f;
            if (atGate && gateArmed && !ModalOpen) { gateArmed = false; moving = false; ShowDungeonSelect(); }
            if (!atGate && hp.z < gate.z) gateArmed = true;
            FollowCam();
        }

        public void ShowDungeonSelect()
        {
            CloseModal(); modal = StGameUi.Canvas("st_dungeons", 20); var root = modal.transform; StGameUi.Dimmer(root);
            var p = StGameUi.PanelRect(root, "dungeon_panel", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1900, 820));
            StUi.Txt(p, "THE RUNE GATE", 60, Color.white, new Vector2(0.5f, 1), new Vector2(0, -60), new Vector2(1400, 80), TextAnchor.MiddleCenter, FontStyle.Bold);
            StUi.Txt(p, "Choose a dungeon. Clear the waves and its boss, then take the portal home.", 30, StGameUi.Dim, new Vector2(0.5f, 1), new Vector2(0, -120), new Vector2(1600, 44));
            int i = 0;
            foreach (var kv in Dungeons)
            {
                var id = kv.Key; var d = kv.Value; float x = -690 + i * 460; i++;
                var card = StGameUi.PanelRect(p, "card_" + id, new Vector2(0.5f, 0.5f), new Vector2(x, -40), new Vector2(430, 480), new Color(0.13f, 0.13f, 0.17f, 1));
                StUi.Txt(card, d.name, 40, Color.white, new Vector2(0.5f, 1), new Vector2(0, -50), new Vector2(410, 60), TextAnchor.MiddleCenter, FontStyle.Bold);
                StUi.Txt(card, "Recommended Lv " + d.lvl, 28, save.level >= d.lvl ? StGameUi.Gold : new Color(1f, 0.5f, 0.4f), new Vector2(0.5f, 1), new Vector2(0, -105), new Vector2(410, 40));
                StUi.Txt(card, d.blurb, 26, StGameUi.Dim, new Vector2(0.5f, 1), new Vector2(0, -190), new Vector2(380, 120));
                if (save.Cleared(id)) StUi.Txt(card, "CLEARED", 28, new Color(0.4f, 0.9f, 0.5f), new Vector2(0.5f, 0), new Vector2(0, 150), new Vector2(380, 40), TextAnchor.MiddleCenter, FontStyle.Bold);
                StGameUi.Button(card, "btn_dungeon_" + id, "Enter", new Vector2(0.5f, 0), new Vector2(0, 70), new Vector2(300, 90), StGameUi.Green, () => EnterDungeon(id), 36);
            }
            StGameUi.Button(p, "btn_close", "Stay in town", new Vector2(0.5f, 0), new Vector2(0, 60), new Vector2(360, 80), StGameUi.Slate, CloseModal, 30);
        }

        // ================================================================== dungeon
        public void EnterDungeon(string id)
        {
            Clear(); where = Where.Dungeon; biome = id; cleared = false; wave = 0; kills = 0;
            StBiomes.Build(id); cam.backgroundColor = RenderSettings.fogColor; cam.fieldOfView = StScale.GameCamFov; cam.farClipPlane = 120;
            if (StFlags.On("fishing")) spot = StFishSpot.Build(id);
            SpawnHero(StBiomes.Hero, 0); BuildHud();
            waveCount = 4; nextWaveAt = Time.time + 1.5f;
            cam.transform.position = CamGoal(); cam.transform.rotation = Quaternion.Euler(StScale.GameCamPitch, 0, 0);
            Toast(Dungeons[id].name);
            Debug.Log("[ST] dungeon " + id + " entered");
        }

        List<StBestiary.Entry> Roster(int tier)
        {
            var list = new List<StBestiary.Entry>();
            foreach (var e in StBestiary.Rosters[biome])
            {
                if (e.tier != tier) continue;
                if (e.id == "elite_horror" && !StFlags.On("eliteHorror"))
                {   // flag off: the horror's legacy clips don't bind to its rig (T-pose); a Rat Brute elite stands in
                    list.Add(new StBestiary.Entry("elite_rat_brute", "Models/hm_rat", StScale.Elite, StBestiary.Surf.Flat, 1).P(new Color(0.5f, 0.55f, 0.42f)).E(new Color(0.1f, 0.22f, 0.05f)));
                    continue;
                }
                list.Add(e);
            }
            return list;
        }

        Vector3 SpawnPoint(int i)
        {
            var hp = hero.transform.position;
            for (int tries = 0; tries < 30; tries++)
            {
                Vector3 baseP = StBiomes.Spawns.Count > 0 ? StBiomes.Spawns[(i + tries) % StBiomes.Spawns.Count] : StBiomes.Centre;
                var p = baseP + new Vector3(Random.Range(-2.2f, 2.2f), 0, Random.Range(-2.2f, 2.2f)); p.y = 0;
                if (StBiomes.Walkable(p, 0.6f) && (p - hp).magnitude > 4.5f) return p;
            }
            return StBiomes.Spawns.Count > 0 ? StBiomes.Spawns[i % StBiomes.Spawns.Count] : StBiomes.Centre;
        }

        void SpawnWave()
        {
            wave++; int tier = Dungeons[biome].tier; float hpM = TierHp[tier];
            var normals = Roster(0);
            if (wave < waveCount)
            {
                int n = 3 + wave; // 4, 5, 6
                for (int i = 0; i < n; i++) AddFoe(normals[(i + wave) % normals.Count], SpawnPoint(i), 2.0f * hpM, 0);
                if (wave == waveCount - 1) { var el = Roster(1); if (el.Count > 0) AddFoe(el[0], SpawnPoint(n), 7f * hpM, 1); }
                Toast("Wave " + wave + " / " + waveCount, Color.white, 1.6f);
            }
            else
            {
                var bs = Roster(2); var far = StBiomes.Spawns.Count > 0 ? StBiomes.Spawns[0] : StBiomes.Centre;
                foreach (var s in StBiomes.Spawns) if ((s - hero.transform.position).sqrMagnitude > (far - hero.transform.position).sqrMagnitude) far = s;
                if (bs.Count > 0) { boss = AddFoe(bs[0], far, 18f * hpM, 2); }
                for (int i = 0; i < 2; i++) AddFoe(normals[i % normals.Count], SpawnPoint(i + 1), 2.0f * hpM, 0);
                Toast("The boss awakens!", new Color(1f, 0.5f, 0.4f), 2f);
            }
            Debug.Log("[ST] wave " + wave + "/" + waveCount + " foes " + foes.Count + (boss ? " boss " + boss.name : ""));
            TopBar();
        }

        StActor AddFoe(StBestiary.Entry e, Vector3 p, float hp, int tier)
        {
            var yaw = Quaternion.LookRotation(Flat(hero.transform.position - p).normalized + Vector3.forward * 1e-3f).eulerAngles.y;
            var m = StBestiary.Spawn(e, p, yaw); if (m == null) return null;
            m.hp = hp; var info = m.gameObject.AddComponent<StFoeInfo>(); info.tier = tier; info.maxHp = hp; info.entry = e.id; info.lastNear = Time.time;
            if (m.anim && m.anim.GetClip(m.idle) != null) m.Loop(m.idle);
            foes.Add(m); return m;
        }

        void OnHit(StActor f, float dmg) { if (f == boss) bossEngaged = true; }

        void OnKill(StActor f)
        {
            kills++; var info = f.GetComponent<StFoeInfo>(); int tier = info ? info.tier : 0; int dt = Dungeons.ContainsKey(biome ?? "") ? Dungeons[biome].tier : 0;
            int xp = (tier == 2 ? 160 : tier == 1 ? 45 : 14) * (1 + dt); int gold = (tier == 2 ? 120 : tier == 1 ? 30 : Random.Range(3, 9)) * (1 + dt);
            save.gold += gold; StFloatText.Spawn("+" + gold + "g", f.transform.position + Vector3.up * 2.3f, StGameUi.Gold, 0.8f);
            GiveXp(xp);
            StartCoroutine(Sink(f));
            if (f == boss) StartCoroutine(BossDown(f.transform.position));
        }

        IEnumerator Sink(StActor f)
        {
            yield return new WaitForSeconds(2.2f); if (f == null) yield break;
            float t = 0; var p0 = f.transform.position;
            while (t < 1 && f) { t += Time.deltaTime; f.transform.position = p0 + Vector3.down * t * 1.6f; yield return null; }
            if (f) { foes.Remove(f); Destroy(f.gameObject); }
        }

        IEnumerator BossDown(Vector3 at)
        {
            cleared = true; save.MarkCleared(biome); save.Save();
            Toast(Dungeons[biome].name + " cleared!", new Color(0.5f, 1f, 0.6f), 3f);
            foreach (var f in foes) if (f && !f.dead) { f.dead = true; f.Once(f.death, 0.05f, true); StartCoroutine(Sink(f)); }
            yield return new WaitForSeconds(1.0f);
            var chest = StKit.Spawn("Dungeon/chest_gold", Flat(at) + Vector3.right * 0.1f, 180); if (chest) { chest.transform.localScale *= StScale.DungeonKit * StScale.DU; StBiomes.Built.Add(chest.transform); }
            StFloatText.Spawn("Treasure!", Flat(at) + Vector3.up * 2.2f, StGameUi.Gold, 1.3f);
            portal = StPortal.Create(StBiomes.Hero, new Color(0.45f, 0.6f, 1.6f));
            Debug.Log("[ST] boss down, portal at " + StBiomes.Hero);
            TopBar();
        }

        void DungeonTick()
        {
            if (fishing != null) { FollowCam(); return; }
            if (dead) { FollowCam(); return; }
            MoveHero(); HudTick();
            if (!cleared && foes.TrueForAll(f => f == null || f.dead) && nextWaveAt < 0 && wave < waveCount) nextWaveAt = Time.time + 1.6f;
            if (nextWaveAt > 0 && Time.time >= nextWaveAt) { nextWaveAt = -1; SpawnWave(); }
            FoeTick();
            if (boss && !boss.dead && (boss.transform.position - hero.transform.position).magnitude < 13f) bossEngaged = true;
            if (portal)
            {
                float pd = Flat(portal.transform.position - hero.transform.position).magnitude;
                if (pd > 2.2f) portal.armed = true;
                if (portal.armed && pd < 1.3f) { ReturnToTown(); return; }
            }
            if (runner.hp <= 0) { Die(); return; }
            FollowCam();
        }

        void FoeTick()
        {
            int dt = Dungeons[biome].tier; var hp = hero.transform.position;
            for (int i = 0; i < foes.Count; i++)
            {
                var f = foes[i]; if (f == null || f.dead || runner.Stunned(f)) continue;
                var info = f.GetComponent<StFoeInfo>(); int tier = info ? info.tier : 0;
                float reach = tier == 2 ? 2.6f : tier == 1 ? 1.7f : 1.25f;
                var dv = Flat(hp - f.transform.position);
                if (info != null)
                {   // leash: a foe that hasn't closed in for 15 s is stuck behind geometry -> re-enter at a reachable spawn point
                    if (dv.magnitude < 9f) info.lastNear = Time.time;
                    else if (Time.time - info.lastNear > 15f) { info.lastNear = Time.time; f.transform.position = SpawnPoint(i); Debug.Log("[ST] leash " + f.name); continue; }
                }
                if (dv.sqrMagnitude > 1e-4f) f.transform.rotation = Quaternion.Slerp(f.transform.rotation, Quaternion.LookRotation(dv), Time.deltaTime * 8);
                if (dv.magnitude > reach)
                {
                    float sp = f.speed * (tier == 2 ? 0.45f : 0.6f) * (runner.Slowed(f) ? 0.4f : 1f);
                    var np = f.transform.position + dv.normalized * sp * Time.deltaTime;
                    // light separation so packs don't stack into one model
                    for (int j = 0; j < foes.Count; j++) { var o = foes[j]; if (o == null || o == f || o.dead) continue; var d = Flat(np - o.transform.position); if (d.magnitude < 0.8f && d.magnitude > 1e-3f) np += d.normalized * (0.8f - d.magnitude) * 0.5f; }
                    if (StBiomes.Walkable(np, 0.3f) || !StBiomes.Walkable(f.transform.position, 0.3f)) f.transform.position = np;
                    if (!f.Busy) f.Loop(f.run);
                }
                else if (info != null && Time.time > info.nextHit)
                {
                    info.nextHit = Time.time + (tier == 2 ? 2.4f : tier == 1 ? 1.6f : 1.4f) + Random.value * 0.4f;
                    if (f.anim.GetClip(f.attack) != null) f.Once(f.attack);
                    float dmg = (tier == 2 ? 40 : tier == 1 ? 20 : 7) * TierDmg[dt];
                    runner.TakeDamage(dmg); if (!StFlags.On("godMode")) StFloatText.Spawn(Mathf.RoundToInt(dmg).ToString(), hp + Vector3.up * 2.1f, new Color(1f, 0.35f, 0.3f), 0.8f);
                    if (tier == 2) bossEngaged = true;
                }
                else if (!f.Busy) f.Loop(f.idle);
            }
        }

        void Die()
        {
            dead = true; moving = false; save.deaths++; int lost = save.gold / 10; save.gold -= lost; save.Save();
            if (hero.anim.GetClip(hero.death) != null) hero.Once(hero.death, 0.05f, true); hero.dead = true;
            Debug.Log("[ST] hero died in " + biome + ", lost " + lost + " gold");
            CloseModal(); modal = StGameUi.Canvas("st_dead", 20); var root = modal.transform; StGameUi.Dimmer(root, 0.55f);
            StUi.Txt(root, "YOU HAVE FALLEN", 110, new Color(1f, 0.4f, 0.35f), new Vector2(0.5f, 0.5f), new Vector2(0, 140), new Vector2(1800, 140), TextAnchor.MiddleCenter, FontStyle.Bold);
            StUi.Txt(root, "The healers of Hollowmere drag you home." + (lost > 0 ? "  (-" + lost + " gold)" : ""), 36, Color.white, new Vector2(0.5f, 0.5f), new Vector2(0, 30), new Vector2(1600, 60));
            StGameUi.Button(root, "btn_respawn", "Respawn in town", new Vector2(0.5f, 0.5f), new Vector2(0, -120), new Vector2(560, 110), StGameUi.Green, () => EnterTown("You wake by the fountain"), 40);
        }

        public void ReturnToTown() { Debug.Log("[ST] return to town from " + biome + (cleared ? " (cleared)" : "")); EnterTown(cleared ? "Back in Hollowmere - " + Dungeons[biome].name + " cleared" : "Back in Hollowmere"); }

        // ================================================================== progression
        public void GiveXp(int xp)
        {
            save.xp += xp; bool up = false;
            while (save.xp >= StSave.XpToNext(save.level) && save.level < 40) { save.xp -= StSave.XpToNext(save.level); save.level++; up = true; }
            if (up) LevelUp(); TopBar();
        }

        public void SetLevel(int lvl)
        {
            if (save == null) return; save.level = Mathf.Max(save.level, lvl); save.xp = 0; LevelUp(); TopBar();
        }

        void LevelUp()
        {
            save.Save(); Debug.Log("[ST] level " + save.level);
            if (runner != null) { ApplyStats(false); runner.hp = runner.maxHp; runner.mana = runner.maxMana; BuildHud(); }
            if (hero != null) { StFloatText.Spawn("LEVEL " + save.level + "!", hero.transform.position + Vector3.up * 2.6f, new Color(0.75f, 0.6f, 1f), 1.5f); var g = StPortal.Create(hero.transform.position, new Color(0.7f, 0.5f, 1.6f), "levelup_fx"); StartCoroutine(KillToast(g.gameObject, 1.2f)); } // not parented: skin recolours walk the hero's renderers
            Toast("Level " + save.level + "!", new Color(0.8f, 0.7f, 1f));
            if (save.level >= 20 && save.sub == null) StartCoroutine(OfferSubclass());
        }

        IEnumerator OfferSubclass() { yield return new WaitForSecondsRealtime(0.6f); if (!ModalOpen && save.sub == null && !dead) ShowSubclassPick(); }

        public void ShowSubclassPick()
        {
            CloseModal(); Pause(true);
            modal = StUi.BuildSubclassPick(null, save.level, null, null, PickSubclass, () => SetLevel(20)); modal.sortingOrder = 20; modal.name = "st_pick";
            StGameUi.Button(modal.transform, "btn_pick_later", "Later", new Vector2(0, 1), new Vector2(150, -60), new Vector2(220, 80), StGameUi.Slate, CloseModal, 30);
        }

        public void PickSubclass(SubclassDef s)
        {
            if (save.level < 20) { Toast("Reach level 20 first"); return; }
            if (s.cls != save.cls) { Toast("That path belongs to the " + StSkillDb.Classes[s.cls].name, new Color(1f, 0.6f, 0.5f)); return; }
            if (save.sub != null && save.sub != s.id) { Toast("Respec isn't in this build"); return; }
            save.sub = s.id; save.loadout = Loadout.Default(save.cls, s.id); save.Save();
            Debug.Log("[ST] subclass " + s.id);
            CloseModal();
            if (hero != null)
            {
                StSkins.Apply(hero, s.id); runner.loadout = save.loadout; if (runner.marker) { Destroy(runner.marker.gameObject); runner.marker = null; }
                BuildHud();
            }
            Toast("You walk the path of the " + s.name, Palette.Ldr(s.palette.primary));
        }

        // ================================================================== pause / loadout / flags
        void Pause(bool on) { paused = on; Time.timeScale = on ? 0 : 1; }

        public void ShowPause()
        {
            if (where != Where.Town && where != Where.Dungeon || dead) return;
            CloseModal(); Pause(true); modal = StGameUi.Canvas("st_pause", 20); var root = modal.transform; StGameUi.Dimmer(root);
            var p = StGameUi.PanelRect(root, "pause_panel", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(760, 900));
            StUi.Txt(p, "PAUSED", 64, Color.white, new Vector2(0.5f, 1), new Vector2(0, -60), new Vector2(700, 80), TextAnchor.MiddleCenter, FontStyle.Bold);
            float y = -170; void B(string n, string l, Color c, System.Action a) { StGameUi.Button(p, n, l, new Vector2(0.5f, 1), new Vector2(0, y), new Vector2(560, 92), c, a, 34); y -= 112; }
            B("btn_resume", "Resume", StGameUi.Green, CloseModal);
            B("btn_pause_loadout", "Loadout", StGameUi.Blue, () => ShowLoadout());
            if (save.level >= 20 && save.sub == null) B("btn_pause_subclass", "Choose subclass", new Color(0.55f, 0.4f, 0.8f), ShowSubclassPick);
            if (where == Where.Dungeon) B("btn_leave", "Return to town", StGameUi.Slate, () => { CloseModal(); ReturnToTown(); });
            B("btn_pause_flags", "Debug: feature flags", StGameUi.Slate, ShowFlags);
            B("btn_title", "Save & quit to title", StGameUi.Red, () => { save.Save(); ShowTitle(); });
            StUi.Txt(p, save.name + " · Lv " + save.level + " · " + save.gold + " gold · fish " + save.fish, 26, StGameUi.Dim, new Vector2(0.5f, 0), new Vector2(0, 40), new Vector2(720, 40));
        }

        public void ShowLoadout(string selected = null)
        {
            CloseModal(); Pause(true);
            var ls = StUi.BuildLoadout(null, save.loadout, save.level, null, selected, l => ShowLoadout(l.selected), () => { save.Save(); CloseModal(); if (runner) { runner.loadout = save.loadout; BuildHud(); } },
                () => { CloseModal(); SetLevel(20); }, "Done");
            modal = ls.canvas; modal.sortingOrder = 20; modal.name = "st_loadout";
        }

        public void ShowFlags()
        {
            bool wasPaused = paused; CloseModal(); if (wasPaused || where == Where.Town || where == Where.Dungeon) Pause(true);
            modal = StGameUi.Canvas("st_flags", 30); var root = modal.transform; StGameUi.Dimmer(root, 0.75f);
            var p = StGameUi.PanelRect(root, "flags_panel", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1900, 980));
            StUi.Txt(p, "FEATURE FLAGS (debug)", 52, Color.white, new Vector2(0.5f, 1), new Vector2(0, -50), new Vector2(1400, 70), TextAnchor.MiddleCenter, FontStyle.Bold);
            StUi.Txt(p, "Saved on this device. Command line: -stFlag name=on|off. Some flags apply on the next scene load.", 26, StGameUi.Dim, new Vector2(0.5f, 1), new Vector2(0, -105), new Vector2(1700, 40));
            for (int i = 0; i < StFlags.All.Count; i++)
            {
                var d = StFlags.All[i]; int col = i % 2, row = i / 2; var pos = new Vector2(-470 + col * 940, -190 - row * 118);
                bool on = StFlags.On(d.id); var id = d.id;
                StGameUi.Button(p, "flag_" + id, (on ? "ON  " : "OFF  ") + d.label, new Vector2(0.5f, 1), pos + new Vector2(-230, 0), new Vector2(420, 80), on ? StGameUi.Green : StGameUi.Slate, () => { StFlags.Set(id, !StFlags.On(id)); ShowFlags(); }, 28);
                StUi.Txt(p, d.note, 20, StGameUi.Dim, new Vector2(0.5f, 1), pos + new Vector2(210, 0), new Vector2(440, 100), TextAnchor.MiddleLeft);
            }
            StGameUi.Button(p, "btn_flags_reset", "Reset to defaults", new Vector2(0.5f, 0), new Vector2(-300, 60), new Vector2(420, 84), StGameUi.Red, () => { StFlags.ResetAll(); ShowFlags(); }, 30);
            StGameUi.Button(p, "btn_flags_close", "Close", new Vector2(0.5f, 0), new Vector2(300, 60), new Vector2(420, 84), StGameUi.Green, () => { CloseModal(); if (hud != null) BuildHud(); }, 30);
        }

        // ================================================================== fishing (phase 5b, behind the "fishing" flag)
        public bool NearFishSpot => spot != null && hero != null && (hero.transform.position - spot.stand).magnitude < 3.5f * StScale.DU;

        public void StartFishing(bool auto = false)
        {
            if (fishing != null || spot == null || !StFlags.On("fishing")) return;
            moving = false; if (hud != null && hud.canvas) hud.canvas.enabled = false;
            fishing = StFishing.Begin(hero, spot, cam, auto, fishSeed++);
            var f = fishing; System.Action stopAct = () => { if (f != null) f.End(); };
            var stop = StFishUi.FishingHud(null, spot.loc, 0, stopAct);
            f.onCatch = (c, isNew) =>
            {
                save.fish++; save.gold += c.value; save.Save(); Debug.Log("[ST] fish " + c.id + " " + c.rarity + " +" + c.value + "g");
                if (stop) Destroy(stop.gameObject); stop = StFishUi.FishingHud(null, spot.loc, f.caught, stopAct);
            };
            f.onEnd = () => { fishing = null; if (stop) Destroy(stop.gameObject); if (hud != null && hud.canvas) hud.canvas.enabled = true; if (hero) hero.Loop(hero.idle); TopBar(); };
        }

        // ================================================================== movement + camera
        public void TapMove(Vector2 screen)
        {
            if (hero == null || dead || fishing != null) return;
            var ray = cam.ScreenPointToRay(screen); var pl = new Plane(Vector3.up, hero.transform.position);
            if (pl.Raycast(ray, out var d)) SetDestination(ray.GetPoint(d));
        }

        /// <summary>Walk to a point along a grid path around props/walls (tap-to-move; smoke test).</summary>
        public bool SetDestination(Vector3 p)
        {
            path.Clear(); var pts = FindPath(hero.transform.position, p);
            if (pts == null || pts.Count == 0) { moving = false; return false; }
            path.AddRange(pts); moveTo = path[0]; moving = true; return true;
        }
        public bool Moving => moving;
        public void StopMoving() { moving = false; path.Clear(); }

        /// <summary>A* on a 0.5 m grid using the same Blocked() test as walking (layer-28 boxes, dungeon floor mask), 8-neighbour,
        /// then string-pulled. Returns null when nothing reachable lies near the goal.</summary>
        public List<Vector3> FindPath(Vector3 a, Vector3 b)
        {
            const float cs = 0.5f; Vector3 mn, mx;
            if (where == Where.Town) { mn = new Vector3(-26, 0, -22); mx = new Vector3(26, 0, 22.5f); }
            else { mn = StBiomes.Centre - new Vector3(20, 0, 18); mx = StBiomes.Centre + new Vector3(20, 0, 18); }
            int nx = Mathf.CeilToInt((mx.x - mn.x) / cs) + 1, nz = Mathf.CeilToInt((mx.z - mn.z) / cs) + 1;
            var state = new sbyte[nx * nz]; // 0 unknown, 1 free, 2 blocked
            Vector3 W(int i) => new Vector3(mn.x + (i % nx) * cs, 0, mn.z + (i / nx) * cs);
            int C(Vector3 p) => Mathf.Clamp(Mathf.RoundToInt((p.x - mn.x) / cs), 0, nx - 1) + Mathf.Clamp(Mathf.RoundToInt((p.z - mn.z) / cs), 0, nz - 1) * nx;
            bool Free(int i) { if (state[i] == 0) state[i] = (sbyte)(Blocked(W(i)) ? 2 : 1); return state[i] == 1; }
            int s0 = C(a), goal = C(b);
            if (!Free(goal))
            {   // nearest free cell to the goal (spiral search)
                int best = -1; float bd = 1e9f; int gx = goal % nx, gz = goal / nx;
                for (int r = 1; r < 12 && best < 0; r++) for (int dz = -r; dz <= r; dz++) for (int dx = -r; dx <= r; dx++)
                { int x = gx + dx, z = gz + dz; if (x < 0 || z < 0 || x >= nx || z >= nz) continue; int i = x + z * nx; if (Free(i)) { float d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } } }
                if (best < 0) return null; goal = best;
            }
            var gs = new Dictionary<int, float> { { s0, 0 } }; var from = new Dictionary<int, int>(); var open = new List<(float f, int i)> { (0, s0) }; var closed = new HashSet<int>();
            int gx2 = goal % nx, gz2 = goal / nx; int found = -1, iter = 0;
            while (open.Count > 0 && iter++ < 40000)
            {
                int bi = 0; for (int k = 1; k < open.Count; k++) if (open[k].f < open[bi].f) bi = k;
                var cur = open[bi].i; open.RemoveAt(bi); if (!closed.Add(cur)) continue;
                if (cur == goal) { found = cur; break; }
                int cx = cur % nx, cz = cur / nx;
                for (int dz = -1; dz <= 1; dz++) for (int dx = -1; dx <= 1; dx++)
                {
                    if (dx == 0 && dz == 0) continue; int x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= nx || z >= nz) continue;
                    int n = x + z * nx; if (closed.Contains(n) || !Free(n)) continue;
                    if (dx != 0 && dz != 0 && (!Free(cx + dx + cz * nx) || !Free(cx + (cz + dz) * nx))) continue;
                    float g2 = gs[cur] + (dx != 0 && dz != 0 ? 1.414f : 1f);
                    if (gs.TryGetValue(n, out var old) && old <= g2) continue;
                    gs[n] = g2; from[n] = cur; float h = Mathf.Sqrt((x - gx2) * (x - gx2) + (z - gz2) * (z - gz2)); open.Add((g2 + h, n));
                }
            }
            if (found < 0) return null;
            var cells = new List<Vector3>(); for (int c = found; c != s0; c = from[c]) cells.Add(W(c)); cells.Reverse();
            if (cells.Count == 0) return new List<Vector3> { Flat(b) };
            cells[cells.Count - 1] = Free(C(b)) ? Flat(b) : cells[cells.Count - 1];
            // string-pull: skip waypoints that are in clear sight of the previous kept point
            var outp = new List<Vector3>(); var last = Flat(a); int j = 0;
            while (j < cells.Count)
            {
                int far = j; for (int k = cells.Count - 1; k > j; k--) if (Clear(last, cells[k])) { far = k; break; }
                outp.Add(cells[far]); last = cells[far]; j = far + 1;
            }
            return outp;
        }

        bool Clear(Vector3 a, Vector3 b)
        {
            float d = (b - a).magnitude; int n = Mathf.CeilToInt(d / 0.25f);
            for (int i = 1; i <= n; i++) if (Blocked(Vector3.Lerp(a, b, i / (float)n))) return false;
            return true;
        }

        Vector2 InputVec()
        {
            if (drive.HasValue) return drive.Value;
            var v = joy != null && StFlags.On("joystick") ? joy.value : Vector2.zero;
            var kb = UnityEngine.InputSystem.Keyboard.current;
            if (kb != null)
            {
                if (kb.wKey.isPressed || kb.upArrowKey.isPressed) v.y += 1; if (kb.sKey.isPressed || kb.downArrowKey.isPressed) v.y -= 1;
                if (kb.dKey.isPressed || kb.rightArrowKey.isPressed) v.x += 1; if (kb.aKey.isPressed || kb.leftArrowKey.isPressed) v.x -= 1;
            }
            return Vector2.ClampMagnitude(v, 1);
        }

        bool Blocked(Vector3 p)
        {
            if (where == Where.Dungeon && !StBiomes.Walkable(p)) return true;
            return Physics.CheckCapsule(p + Vector3.up * 0.4f, p + Vector3.up * 1.4f, 0.32f, StTargeting.Mask, QueryTriggerInteraction.Ignore);
        }

        bool TryStep(Vector3 step)
        {
            var p = hero.transform.position; bool stuck = Blocked(p);
            if (!Blocked(p + step) || stuck) { hero.transform.position = p + step; return true; }
            var sx = new Vector3(step.x, 0, 0); var sz = new Vector3(0, 0, step.z);
            if (Mathf.Abs(step.x) > 1e-4f && !Blocked(p + sx)) { hero.transform.position = p + sx; return true; }
            if (Mathf.Abs(step.z) > 1e-4f && !Blocked(p + sz)) { hero.transform.position = p + sz; return true; }
            return false;
        }

        void MoveHero()
        {
            if (hero == null || paused) return;
            // pointer tap outside the joystick zone (right half of the screen) also moves, when not on a button
            var ptr = UnityEngine.InputSystem.Pointer.current;
            if (!drive.HasValue && StFlags.On("tapToMove") && ptr != null && ptr.press.wasReleasedThisFrame && !(UnityEngine.EventSystems.EventSystem.current && UnityEngine.EventSystems.EventSystem.current.IsPointerOverGameObject()))
                TapMove(ptr.position.ReadValue());
            var iv = InputVec(); bool casting = runner != null && runner.Casting;
            if (iv.sqrMagnitude > 0.01f) moving = false;
            if (casting) return;
            if (iv.sqrMagnitude > 0.01f)
            {
                var dir = new Vector3(iv.x, 0, iv.y); float sp = hero.speed * Mathf.Clamp01(iv.magnitude * 1.25f);
                hero.transform.rotation = Quaternion.Slerp(hero.transform.rotation, Quaternion.LookRotation(dir), Time.deltaTime * 14);
                TryStep(dir.normalized * sp * Time.deltaTime); hero.Loop(hero.run);
            }
            else if (moving)
            {
                var dv = Flat(moveTo - hero.transform.position);
                if (dv.magnitude < 0.2f && path.Count > 1) { path.RemoveAt(0); moveTo = path[0]; dv = Flat(moveTo - hero.transform.position); }
                if (dv.magnitude < 0.2f) { moving = false; path.Clear(); hero.Loop(hero.idle); }
                else
                {
                    hero.transform.rotation = Quaternion.Slerp(hero.transform.rotation, Quaternion.LookRotation(dv), Time.deltaTime * 14);
                    if (!TryStep(dv.normalized * Mathf.Min(dv.magnitude, hero.speed * Time.deltaTime))) moving = false; hero.Loop(hero.run);
                }
            }
            else if (!hero.Busy) hero.Loop(hero.idle);
            if (where == Where.Town) { var p = hero.transform.position; p.x = Mathf.Clamp(p.x, -26f, 26f); p.z = Mathf.Clamp(p.z, -22f, 22.5f); hero.transform.position = p; }
        }

        void HudTick()
        {
            if (hud != null) StUi.Tick(hud);
            if (fishBtn) fishBtn.gameObject.SetActive(StFlags.On("fishing") && NearFishSpot && fishing == null);
            if (fpsTxt) fpsTxt.text = (1f / Mathf.Max(1e-4f, Time.smoothDeltaTime)).ToString("0") + " fps";
        }

        /// <summary>Game camera goal. With a boss engaged (bossCam flag) the focus slides toward the boss and the camera pulls back
        /// so the hero and the 4.5 m boss both stay in frame (the plain follow cam cropped the boss at the top edge).</summary>
        Vector3 CamGoal()
        {
            var focus = hero.transform.position + StScale.GameCamTarget; float dist = StScale.GameCamDist;
            if (StFlags.On("bossCam") && bossEngaged && boss != null && !boss.dead)
            {
                var d = Flat(boss.transform.position - hero.transform.position); float sep = d.magnitude;
                focus = hero.transform.position + d * 0.45f + new Vector3(0, 1.6f, 0) - Vector3.forward * 0.6f;
                dist = StScale.GameCamDist * Mathf.Clamp(1.3f + sep * 0.045f, 1.3f, 1.85f);
            }
            camDist = camDist <= 0 ? dist : Mathf.Lerp(camDist, dist, 2.5f * Time.deltaTime);
            return focus + Quaternion.Euler(StScale.GameCamPitch, 0, 0) * new Vector3(0, 0, -camDist);
        }

        void FollowCam()
        {
            if (hero == null) return;
            cam.transform.position = Vector3.Lerp(cam.transform.position, CamGoal(), 6 * Time.deltaTime); cam.transform.rotation = Quaternion.Euler(StScale.GameCamPitch, 0, 0);
        }

        static Vector3 Flat(Vector3 v) { v.y = 0; return v; }

        void Update()
        {
            switch (where)
            {
                case Where.Title: TitleTick(); break;
                case Where.Create: CreateTick(); break;
                case Where.Town: if (hero) TownTick(); break;
                case Where.Dungeon: if (hero) DungeonTick(); break;
            }
            // Android back button / Escape: pause or close the top modal
            var kb = UnityEngine.InputSystem.Keyboard.current;
            if (kb != null && kb.escapeKey.wasPressedThisFrame) { if (ModalOpen) CloseModal(); else ShowPause(); }
        }

        void OnApplicationPause(bool p) { if (p && save != null) save.Save(); }
        void OnApplicationQuit() { if (save != null) save.Save(); }
    }

    /// <summary>Per-foe combat data for the phase-6 loop.</summary>
    public class StFoeInfo : MonoBehaviour { public int tier; public float maxHp, nextHit, lastNear; public string entry; }
}
