using System;
using System.Linq;
using Hollowmere.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Hollowmere
{
    public static class DeathScreen
    {
        public static void Show(UiRoot ui)
        {
            var gm = GameManager.I;
            var body = ui.Modal("death", "You have fallen", new Vector2(0.3f, 0.3f), new Vector2(0.7f, 0.7f), closable: false);
            var col = Ui.Rect(body, "col", Vector2.zero, Vector2.one);
            var vl = col.gameObject.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 16; vl.childControlHeight = true; vl.childControlWidth = true; vl.childForceExpandHeight = false;
            Ui.Size(Ui.Button(col, "Wake in Hollowmere (free)", () => { ui.CloseAll(); gm.Revive(false); }), 90);
            if (!gm.InTown)
            {
                var b = Ui.Button(col, $"Get up right here ({gm.ReviveCost} gold)", () => { ui.CloseAll(); gm.Revive(true); }, Ui.ButtonHot);
                b.interactable = gm.State.hero.gold >= gm.ReviveCost;
                Ui.Size(b, 90);
            }
        }
    }

    public static class WaypointScreen
    {
        public static void Show(UiRoot ui)
        {
            var gm = GameManager.I;
            var body = ui.Modal("waypoints", "The Hollow", new Vector2(0.3f, 0.15f), new Vector2(0.7f, 0.85f));
            var list = Ui.Scroll(body);
            Ui.Size(Ui.Label(Ui.Rect(list, "t", Vector2.zero, Vector2.one), $"Deepest floor reached: {gm.State.deepest}. Slay a floor's guardian to open a waystone below it.", 26), 80);
            if (gm.State.portalDepth > 0)
                Ui.Size(Ui.Button(list, $"Through your portal: Floor {gm.State.portalDepth}", () => { ui.CloseAll(); gm.EnterFloor(gm.State.portalDepth, fromPortal: true); }, Ui.ButtonHot), 80);
            foreach (var f in gm.Waypoints())
            {
                int floor = f;
                Ui.Size(Ui.Button(list, $"Floor {floor}", () => { ui.CloseAll(); gm.EnterFloor(floor); }), 80);
            }
        }
    }

    public static class MenuScreen
    {
        public static void Show(UiRoot ui)
        {
            var gm = GameManager.I;
            var s = gm.State;
            var body = ui.Modal("menu", "Menu", new Vector2(0.18f, 0.08f), new Vector2(0.82f, 0.92f));
            var left = Ui.Rect(body, "left", Vector2.zero, new Vector2(0.5f, 1), Vector2.zero, new Vector2(-10, 0));
            var list = Ui.Scroll(left);
            Ui.Size(Ui.Label(Ui.Rect(list, "h", Vector2.zero, Vector2.one), "<b>Difficulty</b>  (higher = tougher monsters, more XP, gold and legendaries)", 24, TextAnchor.MiddleLeft, Ui.Gold), 70);
            foreach (Difficulty d in Enum.GetValues(typeof(Difficulty)))
            {
                var dd = d;
                bool locked = s.hero.level < Balance.MinLevelFor(d);
                var b = Ui.Button(list, $"{Balance.DifficultyNames[(int)d]}{(locked ? $"  (level {Balance.MinLevelFor(d)})" : $"   +{Balance.XpBonus(d) * 100:0}% XP")}",
                    () => { gm.ChangeDifficulty(dd); Show(ui); }, d == s.difficulty ? Ui.ButtonHot : Ui.ButtonC, 26);
                b.interactable = !locked && gm.InTown;
                Ui.Size(b, 64);
            }
            if (!gm.InTown) Ui.Size(Ui.Label(Ui.Rect(list, "n", Vector2.zero, Vector2.one), "Difficulty can be changed in town.", 22, TextAnchor.MiddleLeft, Color.gray), 40);

            var right = Ui.Rect(body, "right", new Vector2(0.5f, 0), Vector2.one, new Vector2(10, 0), Vector2.zero);
            var rl = Ui.Scroll(right);
            var c = s.counters;
            var st = HeroActor.I != null ? HeroActor.I.stats : s.Stats();
            Ui.Size(Ui.Label(Ui.Rect(rl, "stats", Vector2.zero, Vector2.one),
                $"<b>{s.hero.name}</b>, level {s.hero.level} {s.hero.heroClass}\n" +
                $"Damage {Fx.Short(s.hero.SheetDps(st))}   Toughness {Fx.Short(s.hero.Toughness(st))}\n" +
                $"Kills {c.kills}   Elites {c.elites}   Guardians {c.bosses}\nFish caught {c.fishCaught}   Species {s.fishLog.Count}/{FishDb.All.Count}\n" +
                $"Legendaries {c.legendaries}   Deaths {c.deaths}\nGold earned {c.goldEarned:N0}", 26, TextAnchor.UpperLeft), 280);
            Ui.Size(Ui.Button(rl, "Save", () => { gm.Save(); ui.Toast("Saved."); }), 70);
            Ui.Size(Ui.Button(rl, $"Sound: {(AudioHub.I.sfxVolume > 0 ? "on" : "off")}", () => { AudioHub.SetVolumes(AudioHub.I.sfxVolume > 0 ? 0 : 0.8f, AudioHub.I.musicVolume); Show(ui); }), 70);
            Ui.Size(Ui.Button(rl, $"Music: {(AudioHub.I.musicVolume > 0 ? "on" : "off")}", () => { AudioHub.SetVolumes(AudioHub.I.sfxVolume, AudioHub.I.musicVolume > 0 ? 0 : 0.45f); Show(ui); }), 70);
            Ui.Size(Ui.Button(rl, "Save and quit to title", () => { gm.Save(); ui.CloseAll(); ui.ShowTitle(); }, new Color(0.4f, 0.15f, 0.12f)), 70);
        }
    }

    public static class SkillScreen
    {
        static string selected;

        public static void Show(UiRoot ui)
        {
            var gm = GameManager.I;
            var h = gm.State.hero;
            var body = ui.Modal("skills", $"Skills — {h.skills.unspent} point{(h.skills.unspent == 1 ? "" : "s")} to spend", new Vector2(0.04f, 0.04f), new Vector2(0.96f, 0.96f), onClose: gm.OnEquipmentChanged);
            var left = Ui.Rect(body, "tree", Vector2.zero, new Vector2(0.58f, 1), Vector2.zero, new Vector2(-10, 0));
            var list = Ui.Scroll(left, 6);
            var defs = SkillDb.ForClass(h.heroClass).OrderBy(s => s.shape == SkillShape.Passive).ThenBy(s => s.reqLevel).ToList();
            if (selected == null || SkillDb.Get(selected)?.cls != h.heroClass) selected = defs[0].id;

            foreach (var s in defs)
            {
                var sd = s;
                int rank = h.skills.Rank(s.id);
                bool can = h.skills.CanRankUp(s, h.level);
                var row = Ui.Row(list, 78, 8);
                string kind = s.primary ? "Primary" : s.ultimate ? "Ultimate" : s.shape == SkillShape.Passive ? "Passive" : "Skill";
                string lockText = h.level < s.reqLevel ? $"  <color=#ff7070>lvl {s.reqLevel}</color>" : s.prereq != null && h.skills.Rank(s.prereq) == 0 ? $"  <color=#ff7070>needs {SkillDb.Get(s.prereq).name}</color>" : "";
                var b = Ui.Button(row, $"<b>{s.name}</b>  <color=#999999>{kind}</color>  {rank}/{s.maxRank}{lockText}", () => { selected = sd.id; Show(ui); }, s.id == selected ? Ui.ButtonHot : Ui.ButtonC, 26);
                b.GetComponentInChildren<Text>().alignment = TextAnchor.MiddleLeft;
                Ui.Size(b, -1, -1, 1);
                var plus = Ui.Button(row, "+", () => { if (h.skills.RankUp(sd, h.level)) { selected = sd.id; gm.OnEquipmentChanged(); } Show(ui); }, can ? new Color(0.25f, 0.5f, 0.2f) : new Color(0.2f, 0.2f, 0.2f), 40);
                plus.interactable = can;
                Ui.Size(plus, -1, 90, 0);
            }
            if (gm.InTown)
                Ui.Size(Ui.Button(list, "Reset all points (free in town)", () => { h.skills.Reset(h.level); var p = SkillDb.ForClass(h.heroClass).First(x => x.primary); h.skills.RankUp(p, h.level); gm.OnEquipmentChanged(); Show(ui); }, new Color(0.4f, 0.15f, 0.12f), 24), 64);

            // ---- detail: description, runes, bar slots
            var right = Ui.Rect(body, "detail", new Vector2(0.58f, 0), Vector2.one, new Vector2(10, 0), Vector2.zero);
            Ui.Box(right, Ui.PanelLight);
            var dl = Ui.Scroll(right, 8);
            var sel = SkillDb.Get(selected);
            int r = h.skills.Rank(sel.id);
            string nums = "";
            if (sel.shape == SkillShape.Passive) nums = sel.text;
            else
            {
                var hero = HeroActor.I;
                var c = SkillDb.Resolve(sel, h, hero != null ? hero.stats : gm.State.Stats());
                nums = $"{sel.text}\n";
                if (c.weaponDamage > 0) nums += $"<color=#ffe25a>{c.weaponDamage * 100:0}% weapon damage</color> as {c.element}\n";
                if (c.cost > 0) nums += $"Cost {c.cost:0} {StatInfo.ResourceName(h.heroClass)}   ";
                if (sel.generate > 0) nums += $"Generates {sel.generate:0}   ";
                if (c.cooldown > 0) nums += $"Cooldown {c.cooldown:0.0}s";
                if (r < sel.maxRank) nums += $"\n<color=#999999>Next rank: +{sel.perRank * 100:0}% weapon damage (needs level {sel.reqLevel + r * 4})</color>";
            }
            Ui.Size(Ui.Label(Ui.Rect(dl, "desc", Vector2.zero, Vector2.one), $"<b><size=36>{sel.name}</size></b>  Rank {r}/{sel.maxRank}\n{nums}", 26, TextAnchor.UpperLeft), 250);

            if (sel.runes.Count > 0)
            {
                Ui.Size(Ui.Label(Ui.Rect(dl, "rh", Vector2.zero, Vector2.one), "<b>Runes</b> — choose one to change how the skill works", 24, TextAnchor.MiddleLeft, Ui.Gold), 44);
                string current = h.skills.Rune(sel.id);
                foreach (var rune in sel.runes)
                {
                    var rr = rune;
                    bool locked = h.level < rune.unlockLevel || r == 0;
                    var b = Ui.Button(dl, $"<b>{rune.name}</b>{(locked ? $"  <color=#ff7070>lvl {rune.unlockLevel}</color>" : "")}\n<size=22>{rune.text}</size>",
                        () => { h.skills.SetRune(sel, current == rr.id ? "" : rr.id, h.level); Show(ui); }, current == rune.id ? new Color(0.3f, 0.25f, 0.5f) : Ui.ButtonC, 26);
                    b.interactable = !locked;
                    Ui.Size(b, 96);
                }
            }
            if (sel.shape != SkillShape.Passive && !sel.primary && r > 0)
            {
                Ui.Size(Ui.Label(Ui.Rect(dl, "bh", Vector2.zero, Vector2.one), "<b>Put on button</b>", 24, TextAnchor.MiddleLeft, Ui.Gold), 44);
                var row = Ui.Row(dl, 80);
                for (int i = 1; i <= 4; i++)
                {
                    int slot = i;
                    var cur = SkillDb.Get(h.skills.bar[slot]);
                    Ui.Button(row, $"{slot}: {(cur != null ? cur.name : "—")}", () =>
                    {
                        int existing = Array.IndexOf(h.skills.bar, sel.id);
                        if (existing > 0) h.skills.bar[existing] = h.skills.bar[slot];
                        h.skills.bar[slot] = sel.id;
                        Show(ui);
                    }, h.skills.bar[slot] == sel.id ? Ui.ButtonHot : Ui.ButtonC, 22);
                }
            }
        }
    }

    public static class PetScreen
    {
        public static void Show(UiRoot ui)
        {
            var gm = GameManager.I;
            var s = gm.State;
            var p = s.pet;
            var body = ui.Modal("pet", $"{p.name} the {p.species}", new Vector2(0.1f, 0.06f), new Vector2(0.9f, 0.94f));
            var left = Ui.Rect(body, "left", Vector2.zero, new Vector2(0.5f, 1), Vector2.zero, new Vector2(-10, 0));
            var ll = Ui.Scroll(left);
            var form = p.Form;
            string formText = form == null ? "Ordinary form. Feed it a fish to transform it." :
                $"<color={form.color}><b>{form.name}</b></color> — {form.text}\n{(p.formSeconds < 0 ? "Permanent" : $"{p.formSeconds:0}s left")}";
            Ui.Size(Ui.Label(Ui.Rect(ll, "form", Vector2.zero, Vector2.one), formText, 26, TextAnchor.UpperLeft), 130);
            Ui.Size(Ui.Label(Ui.Rect(ll, "fh", Vector2.zero, Vector2.one), "<b>Fish in your bag</b>", 26, TextAnchor.MiddleLeft, Ui.Gold), 44);
            var fish = s.hero.inventory.Where(i => i.kind == ItemKind.Fish).ToList();
            if (fish.Count == 0) Ui.Size(Ui.Label(Ui.Rect(ll, "nf", Vector2.zero, Vector2.one), "No fish. Find a pool in the dungeon or try the town lake.", 24, TextAnchor.MiddleLeft, Color.gray), 60);
            foreach (var f in fish)
            {
                var ff = f;
                var def = FishDb.Get(f.fishId);
                var b = Ui.Button(ll, $"<color={ItemText.RarityColor(f.rarity)}>{f.name}</color> x{f.stack}\n<size=20>{def?.text}</size>", () => { gm.UseFish(ff, true); Show(ui); }, Ui.ButtonC, 26);
                Ui.Size(b, 100);
            }

            var right = Ui.Rect(body, "right", new Vector2(0.5f, 0), Vector2.one, new Vector2(10, 0), Vector2.zero);
            var rl = Ui.Scroll(right);
            long value = p.pack.Sum(i => (long)i.SellValue());
            Ui.Size(Ui.Label(Ui.Rect(rl, "ph", Vector2.zero, Vector2.one), $"<b>Saddlebags</b> {p.pack.Count}/{PetState.PackSize}  ·  worth {value} gold\nGive items from your Bag, then send {p.name} to sell them while you keep fighting.", 24, TextAnchor.UpperLeft, Ui.Gold), 110);
            if (p.Away)
                Ui.Size(Ui.Label(Ui.Rect(rl, "away", Vector2.zero, Vector2.one), $"{p.name} is in town selling. Back in {p.tripSeconds:0}s with {p.tripGold} gold.", 26), 80);
            else
            {
                var send = Ui.Button(rl, $"Send to town to sell ({value} gold)", () => { gm.SendPetToTown(); Show(ui); }, Ui.ButtonHot);
                send.interactable = p.pack.Count > 0;
                Ui.Size(send, 80);
                Ui.Size(Ui.Button(rl, "Load all white & blue items", () =>
                {
                    foreach (var it in s.hero.inventory.Where(i => i.kind == ItemKind.Equipment && (i.rarity <= Rarity.Magic || i.junk)).ToList())
                        if (!gm.GiveToPet(it)) break;
                    Show(ui);
                }), 70);
            }
            foreach (var it in p.pack.ToList())
            {
                var itx = it;
                Ui.Size(Ui.Button(rl, $"<color={ItemText.RarityColor(it.rarity)}>{it.name}</color>  ({it.SellValue()}g) — take back", () =>
                {
                    if (!p.Away && s.hero.AddItem(itx)) p.pack.Remove(itx);
                    Show(ui);
                }, Ui.ButtonC, 24), 60);
            }
        }
    }

    /// <summary>The fishing mini-game: tap when the bobber goes under, then hold to reel and let go
    /// when the line gets too tight. Not modal — the world keeps running, so pick a quiet spot.</summary>
    public sealed class FishingScreen : MonoBehaviour
    {
        FishingSession s;
        Action onDone;
        Text status, hint;
        RectTransform tensionFill, progressFill, staminaFill;
        HoldButton big;
        Transform bobber;
        Vector3 bobberAt;
        float doneTimer;
        bool closed;

        public static void Show(UiRoot ui, FishingSession session, Vector3 at, Action done)
        {
            var root = Ui.Rect(ui.modalLayer, "fishing", Vector2.zero, Vector2.one);
            var fs = root.gameObject.AddComponent<FishingScreen>();
            fs.s = session; fs.onDone = done; fs.bobberAt = at;
            ui.Track(root.gameObject);
            fs.Build(root);
        }

        void Build(RectTransform root)
        {
            var panel = Ui.At(root, "panel", new Vector2(0.5f, 0), new Vector2(0, 20), new Vector2(1100, 360));
            Ui.Box(panel, Ui.Panel);
            status = Ui.Label(Ui.At(panel, "status", new Vector2(0.5f, 1), new Vector2(0, -10), new Vector2(1060, 70)), "", 40, TextAnchor.MiddleCenter, Ui.Gold);
            hint = Ui.Label(Ui.At(panel, "hint", new Vector2(0.5f, 1), new Vector2(0, -78), new Vector2(1060, 50)), "", 26, TextAnchor.MiddleCenter);
            tensionFill = Ui.Bar(Ui.At(panel, "tension", new Vector2(0, 1), new Vector2(30, -140), new Vector2(700, 40)), new Color(0, 0, 0, 0.6f), new Color(0.9f, 0.3f, 0.2f), out var tl, 20);
            tl.text = "Line tension";
            progressFill = Ui.Bar(Ui.At(panel, "progress", new Vector2(0, 1), new Vector2(30, -192), new Vector2(700, 40)), new Color(0, 0, 0, 0.6f), new Color(0.3f, 0.7f, 0.95f), out var pl, 20);
            pl.text = "Reeling in";
            staminaFill = Ui.Bar(Ui.At(panel, "stamina", new Vector2(0, 1), new Vector2(30, -244), new Vector2(700, 30)), new Color(0, 0, 0, 0.6f), new Color(0.5f, 0.8f, 0.4f), out var sl, 18);
            sl.text = "Fish stamina";
            big = HoldButton.Create(panel, "big", new Vector2(1, 0), new Vector2(-30, 30), 280, new Color(0.2f, 0.45f, 0.65f, 0.95f), "Cast", 40);
            big.onDown.AddListener(() =>
            {
                if (s.Done) { Finish(); return; }
                if (s.phase == FishingPhase.Reeling) s.Hold(true);
                else { s.Tap(); if (s.phase == FishingPhase.Casting) AudioHub.Play("sfx_cast_line"); }
            });
            big.onUp.AddListener(() => s.Hold(false));
            var leave = Ui.Button(panel, "Leave", Finish, new Color(0.4f, 0.15f, 0.12f), 28);
            var lr = (RectTransform)leave.transform;
            lr.anchorMin = lr.anchorMax = new Vector2(0, 0); lr.pivot = Vector2.zero; lr.sizeDelta = new Vector2(180, 64); lr.anchoredPosition = new Vector2(30, 20);

            bobber = Art.Sphere(null, bobberAt + Vector3.up * 0.1f, Vector3.one * 0.35f, Art.Mat(new Color(1f, 0.2f, 0.15f), 0.8f)).transform;
            bobber.gameObject.SetActive(false);
        }

        void Update()
        {
            if (closed) return;
            var prev = s.phase;
            s.Tick(Time.deltaTime);
            if (prev != s.phase)
            {
                if (s.phase == FishingPhase.Bite) AudioHub.Play("sfx_bite");
                if (s.phase == FishingPhase.Caught) AudioHub.Play("sfx_catch");
                if (s.phase == FishingPhase.Snapped) AudioHub.Play("sfx_snap");
            }
            if (s.phase == FishingPhase.Reeling && s.holding && Time.frameCount % 20 == 0) AudioHub.Play("sfx_reel", 0.4f);

            bool showBars = s.phase == FishingPhase.Reeling;
            tensionFill.parent.gameObject.SetActive(showBars);
            progressFill.parent.gameObject.SetActive(showBars);
            staminaFill.parent.gameObject.SetActive(showBars);
            Ui.SetBar(tensionFill, s.tension);
            Ui.SetBar(progressFill, s.progress);
            Ui.SetBar(staminaFill, s.fishMaxStamina > 0 ? s.fishStamina / s.fishMaxStamina : 0);
            ((Image)tensionFill.GetComponent<Image>()).color = s.tension > 0.75f ? new Color(1f, 0.15f, 0.1f) : new Color(0.9f, 0.55f, 0.2f);

            bobber.gameObject.SetActive(s.phase != FishingPhase.Ready && !s.Done);
            float y = 0.1f + Mathf.Sin(Time.time * 3) * 0.04f;
            if (s.phase == FishingPhase.Nibble) y = 0.02f + Mathf.Sin(Time.time * 40) * 0.05f;
            if (s.phase == FishingPhase.Bite) y = -0.2f;
            if (s.phase == FishingPhase.Reeling) y = -0.1f + Mathf.Sin(Time.time * 18) * 0.08f;
            bobber.position = bobberAt + new Vector3(0, y, 0);

            switch (s.phase)
            {
                case FishingPhase.Ready: status.text = "Fishing"; hint.text = "Tap Cast to throw your line."; big.label.text = "Cast"; break;
                case FishingPhase.Casting: status.text = "…"; hint.text = ""; big.label.text = "…"; break;
                case FishingPhase.Waiting: status.text = "Waiting"; hint.text = "Wait for the bobber to go under. Don't strike at nibbles!"; big.label.text = "Strike"; break;
                case FishingPhase.Nibble: status.text = "Nibble…"; hint.text = "Not yet…"; big.label.text = "Strike"; break;
                case FishingPhase.Bite: status.text = "<color=#ff6040>BITE!</color>"; hint.text = "Strike now!"; big.label.text = "STRIKE!"; break;
                case FishingPhase.Reeling: status.text = "Fish on!"; hint.text = "Hold to reel. Let go when the line gets tight."; big.label.text = s.holding ? "Reeling" : "Hold"; break;
                default:
                    big.label.text = "OK";
                    status.text = s.phase switch
                    {
                        FishingPhase.Caught => "Caught!",
                        FishingPhase.Snapped => "<color=#ff6040>The line snapped!</color>",
                        FishingPhase.Spooked => "You spooked it.",
                        _ => "It got away.",
                    };
                    hint.text = s.phase == FishingPhase.Caught ? Describe(s.result) : "";
                    break;
            }
        }

        static string Describe(CatchResult r) => r.kind switch
        {
            CatchKind.Fish => $"<color={ItemText.RarityColor(r.fish.rarity)}>{r.fish.name}</color> — {r.fish.text}",
            CatchKind.Gold => $"A sodden purse: {r.gold} gold",
            _ => $"<color={ItemText.RarityColor(r.item.rarity)}>{r.item.name}</color>",
        };

        void Finish()
        {
            if (closed) return;
            closed = true;
            if (bobber != null) Destroy(bobber.gameObject);
            UiRoot.I.Close(gameObject);
            onDone?.Invoke();
        }

        void OnDestroy() { if (bobber != null) Destroy(bobber.gameObject); }
    }
}
