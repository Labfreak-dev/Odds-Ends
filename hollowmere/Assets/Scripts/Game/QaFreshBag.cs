using System.Collections;
using System.IO;
using System.Linq;
using Hollowmere.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Hollowmere
{
    /// <summary>
    ///   Hollowmere -qaShot freshbag
    /// The real player flow on a fresh install: the save file is deleted, the title opens, the creator opens,
    /// the real "Begin" button is clicked (BuildConfig.TestStart decides, nothing is forced), then the Bag opens.
    /// FAIL when the bag does not hold the kit. Then an old save without the grant is loaded through Continue().
    /// Writes qa-freshbag-page-N.png.
    /// </summary>
    public static partial class QaFrames
    {
        public static IEnumerator RunFreshBag(GameManager gm)
        {
            int fails = 0;
            var save = Path.Combine(Application.persistentDataPath, "hollowmere.json");
            if (File.Exists(save)) File.Delete(save);
            Screen.SetResolution(2340, 1080, FullScreenMode.Windowed);
            Debug.Log("Hollowmere freshbag BuildConfig.TestStart=" + BuildConfig.TestStart + " save=" + File.Exists(save));
            UiRoot.I.ShowTitle();
            yield return new WaitForSecondsRealtime(0.6f);
            TitleScreen.ShowNewHero();
            yield return new WaitForSecondsRealtime(0.8f);
            var begin = Object.FindObjectsByType<Button>(FindObjectsSortMode.None).FirstOrDefault(b => b.GetComponentInChildren<Text>() != null && b.GetComponentInChildren<Text>().text.Trim() == "Begin");
            if (begin == null) { Debug.LogError("Hollowmere freshbag FAIL no Begin button"); Application.Quit(); yield break; }
            begin.onClick.Invoke();
            yield return new WaitForSecondsRealtime(1.5f);
            var h = gm.State.hero;
            int eq = h.inventory.Count(i => i.kind == ItemKind.Equipment);
            int gems = h.inventory.Where(i => i.kind == ItemKind.Gem).Sum(i => i.stack);
            int leg = h.inventory.Count(i => i.kind == ItemKind.Equipment && i.rarity == Rarity.Legendary);
            int set = h.inventory.Count(i => i.kind == ItemKind.Equipment && i.rarity == Rarity.Set);
            int weapons = h.inventory.Count(i => i.kind == ItemKind.Equipment && i.Base != null && (i.Base.slot == ItemSlot.MainHand || i.Base.slot == ItemSlot.OffHand));
            int maxIl = h.inventory.Where(i => i.kind == ItemKind.Equipment).Select(i => i.itemLevel).DefaultIfEmpty(0).Max();
            bool ok = h.level >= TestStart.Level && eq >= 200 && leg >= 20 && set >= 20 && weapons >= 20 && gems >= 50;
            if (!ok) fails++;
            Debug.Log("Hollowmere freshbag level=" + h.level + " bag=" + h.inventory.Count + "/" + h.Capacity + " equipment=" + eq + " legendary=" + leg + " set=" + set + " weapons=" + weapons + " gems=" + gems + " maxIlvl=" + maxIl + " stash=" + gm.State.stash.Count + (ok ? " ok" : " FAIL kit not in bag"));
            InventoryScreen.BagPage = 0;
            InventoryScreen.Show(UiRoot.I);
            int pages = Mathf.Max(1, (h.Capacity + 29) / 30);
            for (int pg = 0; pg < Mathf.Min(pages, 4); pg++)
            {
                InventoryScreen.BagPage = pg;
                UiRoot.I.CloseAll();
                InventoryScreen.Show(UiRoot.I);
                yield return new WaitForSecondsRealtime(0.6f);
                yield return new WaitForEndOfFrame();
                SaveNamed("freshbag-page-" + (pg + 1));
            }
            UiRoot.I.CloseAll();
            // Existing save that predates the grant: strip the kit and the flag, save, Continue().
            h.inventory.RemoveAll(i => i.kind == ItemKind.Equipment || i.kind == ItemKind.Gem);
            gm.State.testStartGranted = false;
            h.bagCapacity = 0;
            File.WriteAllText(save, JsonUtility.ToJson(gm.State));
            bool loaded = gm.Continue();
            yield return new WaitForSecondsRealtime(0.8f);
            var h2 = gm.State.hero;
            int eq2 = h2.inventory.Count(i => i.kind == ItemKind.Equipment);
            bool ok2 = loaded && eq2 >= 200 && gm.State.testStartGranted;
            if (!ok2) fails++;
            Debug.Log("Hollowmere freshbag oldsave loaded=" + loaded + " equipment=" + eq2 + " granted=" + gm.State.testStartGranted + (ok2 ? " ok" : " FAIL"));
            Debug.Log("Hollowmere freshbag fails=" + fails);
            Debug.Log("Hollowmere QA freshbag done");
            Application.Quit();
        }
    }
}
