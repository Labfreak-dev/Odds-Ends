using System;
using System.Linq;
using Hollowmere.Core;
using UnityEngine;
using UnityEngine.UI;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace Hollowmere
{
    /// <summary>In-game HUD: bars, joystick, attack/skill/potion/portal buttons, the context action
    /// button, target and boss bars, and the menu buttons. Also maps keyboard keys for desktop testing.</summary>
    public sealed class Hud : MonoBehaviour
    {
        HeroActor hero;
        Joystick stick;
        RectTransform lifeFill, resFill, xpFill, targetBox, targetFill, bossBox, bossFill, petFill;
        float lifeTrail = 1f;
        Text lifeText, resText, xpText, levelText, goldText, locText, targetText, bossText, buffText, petText, potionText, portalText;
        HoldButton primary, potion, portal, action;
        readonly HoldButton[] skills = new HoldButton[4];
        Button skillsBtn;
        Interactable near;
        MonsterActor boss;

        public static Hud Create(Transform parent)
        {
            var root = Ui.Rect(parent, "hud", Vector2.zero, Vector2.one);
            var h = root.gameObject.AddComponent<Hud>();
            h.Build(root);
            return h;
        }

        void Build(RectTransform r)
        {
            stick = Joystick.Create(r);

            // ---- top-left: level, life, resource, xp, gold
            var tl = Ui.At(r, "status", new Vector2(0, 1), new Vector2(20, -16), new Vector2(620, 280));
            var lv = Ui.At(tl, "level", new Vector2(0, 1), Vector2.zero, new Vector2(100, 100));
            var lvi = lv.gameObject.AddComponent<Image>();
            lvi.sprite = Ui.Circle; lvi.color = new Color(0.15f, 0.12f, 0.1f, 0.9f);
            levelText = Ui.Label(lv, "1", 44, TextAnchor.MiddleCenter, Ui.Gold);
            lifeFill = Ui.Bar(Ui.At(tl, "life", new Vector2(0, 1), new Vector2(112, 0), new Vector2(360, 52)), new Color(0, 0, 0, 0.6f), new Color(0.75f, 0.12f, 0.12f), out lifeText, 22, "health");
            resFill = Ui.Bar(Ui.At(tl, "res", new Vector2(0, 1), new Vector2(112, -58), new Vector2(360, 40)), new Color(0, 0, 0, 0.6f), new Color(0.3f, 0.4f, 0.9f), out resText, 18, "mana");
            xpFill = Ui.Bar(Ui.At(tl, "xp", new Vector2(0, 1), new Vector2(112, -104), new Vector2(360, 36)), new Color(0, 0, 0, 0.6f), new Color(0.85f, 0.7f, 0.25f), out xpText, 14, "xp");
            goldText = Ui.Label(Ui.At(tl, "gold", new Vector2(0, 1), new Vector2(0, -166), new Vector2(620, 40)), "", 28, TextAnchor.MiddleLeft, Ui.Gold);
            petFill = Ui.Bar(Ui.At(tl, "pet", new Vector2(0, 1), new Vector2(0, -210), new Vector2(360, 36)), new Color(0, 0, 0, 0.6f), new Color(0.4f, 0.75f, 0.35f), out petText, 18);
            buffText = Ui.Label(Ui.At(r, "buffs", new Vector2(0, 1), new Vector2(20, -300), new Vector2(560, 120)), "", 22, TextAnchor.UpperLeft, new Color(0.7f, 0.9f, 1f));

            // ---- top-centre: target and boss
            targetBox = Ui.At(r, "target", new Vector2(0.5f, 1), new Vector2(0, -16), new Vector2(560, 46));
            targetFill = Ui.Bar(targetBox, new Color(0, 0, 0, 0.6f), new Color(0.6f, 0.15f, 0.15f), out targetText, 24);
            bossBox = Ui.At(r, "boss", new Vector2(0.5f, 1), new Vector2(0, -70), new Vector2(820, 54));
            bossFill = Ui.Bar(bossBox, new Color(0, 0, 0, 0.7f), new Color(0.85f, 0.2f, 0.1f), out bossText, 28);
            bossBox.gameObject.SetActive(false);

            // ---- top-right: menus + location
            var tr = Ui.At(r, "menus", new Vector2(1, 1), new Vector2(-16, -16), new Vector2(560, 84));
            var hl = tr.gameObject.AddComponent<HorizontalLayoutGroup>();
            hl.spacing = 10; hl.childControlWidth = true; hl.childControlHeight = true; hl.childForceExpandWidth = true;
            MenuButton(tr, "Bag", "bag", () => UiRoot.I.OpenInventory());
            skillsBtn = MenuButton(tr, "Skills", "skills", () => UiRoot.I.OpenSkills());
            MenuButton(tr, "Pet", "pet", () => UiRoot.I.OpenPet());
            MenuButton(tr, "Menu", "menu", () => UiRoot.I.OpenMenu());
            locText = Ui.Label(Ui.At(r, "loc", new Vector2(1, 1), new Vector2(-16, -104), new Vector2(560, 40)), "", 26, TextAnchor.MiddleRight, new Color(0.85f, 0.8f, 0.7f));

            // ---- bottom-right: combat buttons
            var br = new Vector2(1, 0);
            primary = HoldButton.Create(r, "primary", br, new Vector2(-60, 60), 230, new Color(0.65f, 0.2f, 0.15f, 0.9f), "Attack", 34);
            primary.onDown.AddListener(() => { if (hero != null) hero.attackHeld = true; });
            primary.onUp.AddListener(() => { if (hero != null) hero.attackHeld = false; });
            Vector2[] spots = { new Vector2(-310, 50), new Vector2(-300, 210), new Vector2(-190, 330), new Vector2(-40, 330) };
            for (int i = 0; i < 4; i++)
            {
                int slot = i + 1;
                skills[i] = HoldButton.Create(r, "skill" + slot, br, spots[i], 140, new Color(0.2f, 0.18f, 0.3f, 0.9f), "", 22);
                skills[i].onDown.AddListener(() => hero?.UseSkillSlot(slot));
            }
            potion = HoldButton.Create(r, "potion", br, new Vector2(-470, 40), 110, new Color(0.6f, 0.1f, 0.15f, 0.9f), "", 22);
            potion.onDown.AddListener(() => hero?.DrinkPotion());
            portal = HoldButton.Create(r, "portal", br, new Vector2(-470, 170), 100, new Color(0.15f, 0.3f, 0.6f, 0.9f), "", 20);
            portal.onDown.AddListener(() => GameManager.I.UseTownPortal());
            action = HoldButton.Create(r, "action", new Vector2(0.5f, 0), new Vector2(0, 40), 190, new Color(0.75f, 0.55f, 0.15f, 0.95f), "", 32);
            action.onDown.AddListener(() => { if (near != null) GameManager.I.Interact(near); });
        }

        static Button MenuButton(Transform parent, string label, string iconKey, System.Action click)
        {
            var b = Ui.Button(parent, label, click, null, 22);
            var plate = b.GetComponent<Image>();
            var skin = UiArt.Catalog != null ? UiArt.Catalog.iconButton : null;
            if (plate != null && skin != null)
            {
                plate.sprite = skin;
                plate.type = Image.Type.Sliced;
                plate.color = Color.white;
                plate.pixelsPerUnitMultiplier = 1f;
                var press = b.GetComponent<UiPress>();
                if (press != null) press.pressedSprite = UiArt.Catalog.iconButtonPressed != null ? UiArt.Catalog.iconButtonPressed : skin;
            }
            var icon = UiArt.Icon(iconKey);
            if (icon != null)
            {
                var slot = Ui.Rect(b.transform, "glyph", new Vector2(0.5f, 0.62f), new Vector2(0.5f, 0.62f));
                slot.sizeDelta = new Vector2(56, 56);
                var ii = slot.gameObject.AddComponent<Image>();
                ii.sprite = icon;
                ii.preserveAspect = true;
                ii.raycastTarget = false;
                var text = b.GetComponentInChildren<Text>();
                if (text != null)
                {
                    text.alignment = TextAnchor.LowerCenter;
                    text.fontSize = 18;
                }
            }
            Ui.Size(b, 128);
            return b;
        }

        public void Bind(HeroActor h)
        {
            hero = h;
            gameObject.SetActive(true);
            var cls = h.Hero.heroClass;
            var resImg = resFill.GetComponent<Image>();
            if (resImg != null && resImg.sprite == null)
                resImg.color = cls == HeroClass.Ironclad ? new Color(0.8f, 0.35f, 0.1f) : cls == HeroClass.Stalker ? new Color(0.25f, 0.7f, 0.4f) : new Color(0.45f, 0.35f, 0.95f);
        }

        public void SetLocation(string s) { if (locText != null) locText.text = s; }

        public void SetBoss(MonsterActor m)
        {
            boss = m;
            bossBox.gameObject.SetActive(m != null);
        }

        void Update()
        {
            if (hero == null || GameManager.I.State == null) return;
            var st = GameManager.I.State;
            var h = st.hero;
            Keys();
            // -qaFrames owns the stick. Overwriting it here left speed at 0 for the whole clip.
            if (string.IsNullOrEmpty(QaFrames.Requested))
                hero.moveInput = stick.Value + KeyMove();

            levelText.text = h.level.ToString();
            float lifeFrac = hero.LifeFraction;
            Ui.SetBar(lifeFill, lifeFrac);
            var trail = lifeFill.parent.Find("ghost") as RectTransform;
            if (trail != null)
            {
                if (lifeFrac >= lifeTrail) lifeTrail = lifeFrac;
                else lifeTrail = Mathf.MoveTowards(lifeTrail, lifeFrac, Time.deltaTime * 0.35f);
                Ui.SetBar(trail, lifeTrail);
            }
            lifeText.text = $"{Fx.Short(hero.life)} / {Fx.Short(hero.maxLife)}";
            Ui.SetBar(resFill, hero.maxResource > 0 ? hero.resource / hero.maxResource : 0);
            resText.text = $"{StatInfo.ResourceName(h.heroClass)} {Mathf.FloorToInt(hero.resource)}";
            long need = Balance.XpToNext(h.level);
            Ui.SetBar(xpFill, h.level >= Balance.MaxLevel ? 1 : h.xp / (float)need);
            goldText.text = st.depth <= 0 ? $"{h.gold:N0} gold" : $"{h.gold:N0} gold   <color=#bbbbbb>Floor {st.depth}</color>";
            var pet = PetActor.I;
            if (pet != null)
            {
                Ui.SetBar(petFill, st.pet.Away || pet.Fled ? 0 : pet.LifeFraction);
                petText.text = st.pet.Away ? $"{st.pet.name}: selling ({st.pet.tripSeconds:0}s)" : pet.Fled ? $"{st.pet.name}: fled" : $"{st.pet.name}{(st.pet.Form != null ? " · " + st.pet.Form.name : "")}";
            }
            buffText.text = string.Join("\n", st.buffs.Select(b => $"{StatInfo.Describe(b.stat, b.value)} ({b.seconds:0}s)"));

            // target
            var t = hero.target as MonsterActor;
            targetBox.gameObject.SetActive(t != null && t != boss);
            if (t != null && t != boss)
            {
                Ui.SetBar(targetFill, t.LifeFraction);
                string aff = t.stats.affixes.Count > 0 ? "  <color=#8ab4ff>" + string.Join(", ", t.stats.affixes.Select(MonsterDb.AffixName)) + "</color>" : "";
                string col = t.stats.rank == MonsterRank.Elite ? "#ffe25a" : t.stats.rank == MonsterRank.Champion ? "#6f8cff" : "#ffffff";
                targetText.text = $"<color={col}>{t.stats.displayName}</color>{aff}";
            }
            if (boss != null)
            {
                if (boss.Dead) SetBoss(null);
                else
                {
                    Ui.SetBar(bossFill, boss.LifeFraction);
                    string aff = boss.stats.affixes.Count > 0 ? "\n<size=18><color=#e8d7a8>" + string.Join(" · ", boss.stats.affixes.Select(MonsterDb.AffixName)) + "</color></size>" : "";
                    bossText.text = $"<b>{boss.stats.displayName}</b>{aff}";
                }
            }

            // skills
            for (int i = 0; i < 4; i++)
            {
                var id = h.skills.bar[i + 1];
                var def = SkillDb.Get(id);
                skills[i].gameObject.SetActive(def != null);
                if (def == null) continue;
                skills[i].label.text = Abbrev(def.name);
                float cd = hero.CooldownLeft(id);
                var cast = def.cooldown > 0 ? SkillDb.Resolve(def, h, hero.stats).cooldown : 0;
                skills[i].SetCooldown(cast > 0 ? cd / cast : 0);
                skills[i].image.color = hero.resource >= SkillDb.Resolve(def, h, hero.stats).cost ? new Color(0.22f, 0.2f, 0.36f, 0.92f) : new Color(0.12f, 0.12f, 0.16f, 0.92f);
            }
            var prim = SkillDb.Get(h.skills.bar[0]);
            primary.label.text = prim != null ? prim.name : "Attack";
            potion.label.text = $"Potion\n{h.Count(ItemKind.Potion)}";
            potion.SetCooldown(hero.PotionCooldown / (float)DesignTable.PotionCooldownSeconds);
            portal.gameObject.SetActive(!GameManager.I.InTown);
            portal.label.text = $"Portal\n{h.Count(ItemKind.TownPortal)}";
            skillsBtn.GetComponentInChildren<Text>().text = h.skills.unspent > 0 ? $"Skills <color=#ffe25a>+{h.skills.unspent}</color>" : "Skills";

            near = hero.busy ? null : Interactable.Near(hero.Pos);
            action.gameObject.SetActive(near != null);
            if (near != null) action.label.text = near.Label;
        }

        static string Abbrev(string name)
        {
            var parts = name.Split(' ');
            return parts.Length == 1 ? name : string.Join("\n", parts.Take(2));
        }

        // ---------------- keyboard (desktop / editor testing) ----------------

        Vector2 KeyMove()
        {
            Vector2 v = Vector2.zero;
#if ENABLE_INPUT_SYSTEM
            var k = Keyboard.current;
            if (k != null)
            {
                if (k.wKey.isPressed) v.y += 1; if (k.sKey.isPressed) v.y -= 1;
                if (k.dKey.isPressed) v.x += 1; if (k.aKey.isPressed) v.x -= 1;
            }
#elif ENABLE_LEGACY_INPUT_MANAGER
            v = new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical"));
#endif
            return Vector2.ClampMagnitude(v, 1);
        }

        void Keys()
        {
            if (UiRoot.I.AnyModal) return;
#if ENABLE_INPUT_SYSTEM
            var k = Keyboard.current;
            if (k == null) return;
            if (!primary.Held) hero.attackHeld = k.spaceKey.isPressed || k.jKey.isPressed;
            if (k.digit1Key.wasPressedThisFrame) hero.UseSkillSlot(1);
            if (k.digit2Key.wasPressedThisFrame) hero.UseSkillSlot(2);
            if (k.digit3Key.wasPressedThisFrame) hero.UseSkillSlot(3);
            if (k.digit4Key.wasPressedThisFrame) hero.UseSkillSlot(4);
            if (k.qKey.wasPressedThisFrame) hero.DrinkPotion();
            if (k.eKey.wasPressedThisFrame && near != null) GameManager.I.Interact(near);
            if (k.iKey.wasPressedThisFrame) UiRoot.I.OpenInventory();
            if (k.kKey.wasPressedThisFrame) UiRoot.I.OpenSkills();
            if (k.pKey.wasPressedThisFrame) UiRoot.I.OpenPet();
            if (k.tKey.wasPressedThisFrame) GameManager.I.UseTownPortal();
#elif ENABLE_LEGACY_INPUT_MANAGER
            if (!primary.Held) hero.attackHeld = Input.GetKey(KeyCode.Space) || Input.GetKey(KeyCode.J);
            for (int i = 1; i <= 4; i++) if (Input.GetKeyDown(KeyCode.Alpha0 + i)) hero.UseSkillSlot(i);
            if (Input.GetKeyDown(KeyCode.Q)) hero.DrinkPotion();
            if (Input.GetKeyDown(KeyCode.E) && near != null) GameManager.I.Interact(near);
            if (Input.GetKeyDown(KeyCode.I)) UiRoot.I.OpenInventory();
            if (Input.GetKeyDown(KeyCode.K)) UiRoot.I.OpenSkills();
            if (Input.GetKeyDown(KeyCode.P)) UiRoot.I.OpenPet();
            if (Input.GetKeyDown(KeyCode.T)) GameManager.I.UseTownPortal();
#endif
        }
    }
}
