using Hollowmere.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Hollowmere
{
    /// <summary>Turntable for the new-hero page. A second camera draws the class and the pet
    /// into a texture so the title key art does not cover them.</summary>
    public sealed class HeroStage : MonoBehaviour
    {
        const int StageLayer = 8;
        Camera cam;
        RenderTexture rt;
        Transform heroPivot, petPivot;
        HeroClass shownClass;
        PetSpecies shownPet;
        bool built;
        float spin;

        public static HeroStage Create(RawImage target)
        {
            var go = new GameObject("heroStage");
            var stage = go.AddComponent<HeroStage>();
            stage.Build(target);
            return stage;
        }

        void Build(RawImage target)
        {
            rt = new RenderTexture(640, 720, 16) { name = "heroStage" };
            var camGo = new GameObject("stageCam");
            camGo.transform.SetParent(transform, false);
            cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.05f, 0.04f, 0.07f, 1f);
            cam.fieldOfView = 32f;
            cam.nearClipPlane = 0.05f;
            cam.farClipPlane = 30f;
            cam.cullingMask = 1 << StageLayer;
            cam.targetTexture = rt;
            camGo.transform.localPosition = new Vector3(0.4f, 1.35f, -4.4f);
            camGo.transform.localRotation = Quaternion.Euler(12f, -6f, 0f);
            if (Camera.main != null) Camera.main.cullingMask &= ~(1 << StageLayer);

            var floor = Art.Cylinder(transform, new Vector3(0.15f, 0.02f, 0f), new Vector3(2.4f, 0.02f, 2.4f), Art.Mat(new Color(0.45f, 0.28f, 0.85f), 1.4f));
            var key = new GameObject("key").AddComponent<Light>();
            key.transform.SetParent(transform, false);
            key.transform.localPosition = new Vector3(-1.2f, 2.4f, -1.4f);
            key.type = LightType.Point;
            key.range = 8f;
            key.intensity = 2.4f;
            key.color = new Color(1f, 0.92f, 0.8f);
            key.cullingMask = 1 << StageLayer;
            var rim = new GameObject("rim").AddComponent<Light>();
            rim.transform.SetParent(transform, false);
            rim.transform.localPosition = new Vector3(1.4f, 1.6f, 1.2f);
            rim.type = LightType.Point;
            rim.range = 6f;
            rim.intensity = 2.8f;
            rim.color = new Color(0.65f, 0.45f, 1f);
            rim.cullingMask = 1 << StageLayer;

            heroPivot = new GameObject("heroPivot").transform;
            heroPivot.SetParent(transform, false);
            heroPivot.localPosition = new Vector3(-0.15f, 0f, 0f);
            petPivot = new GameObject("petPivot").transform;
            petPivot.SetParent(transform, false);
            petPivot.localPosition = new Vector3(0.95f, 0f, 0.35f);
            AssignLayer(gameObject);
            if (target != null) target.texture = rt;
        }

        public void Set(HeroClass cls, PetSpecies pet)
        {
            if (!built || cls != shownClass)
            {
                Clear(heroPivot);
                var model = Art.Animated(Art.HeroModelKey(cls), 1.7f, heroPivot);
                if (model == null)
                    Art.Capsule(heroPivot, Vector3.up * 0.9f, new Vector3(0.45f, 0.9f, 0.45f), Art.Mat(Art.ClassColor(cls)));
                shownClass = cls;
            }
            if (!built || pet != shownPet)
            {
                Clear(petPivot);
                string key = pet == PetSpecies.Hound ? "pet_hound" : "pet_lynx";
                var model = Art.Animated(key, 0.7f, petPivot);
                if (model == null)
                    Art.Quadruped(petPivot, pet == PetSpecies.Hound ? new Color(0.35f, 0.28f, 0.22f) : new Color(0.55f, 0.42f, 0.18f), 0.7f);
                shownPet = pet;
            }
            built = true;
            AssignLayer(gameObject);
        }

        void LateUpdate()
        {
            spin += 28f * Time.unscaledDeltaTime;
            if (heroPivot != null) heroPivot.localRotation = Quaternion.Euler(0f, spin, 0f);
            if (petPivot != null) petPivot.localRotation = Quaternion.Euler(0f, spin * 0.8f + 40f, 0f);
        }

        void OnDestroy()
        {
            if (cam != null) cam.targetTexture = null;
            if (rt != null) rt.Release();
        }

        static void Clear(Transform t)
        {
            for (int i = t.childCount - 1; i >= 0; i--)
                Destroy(t.GetChild(i).gameObject);
        }

        static void AssignLayer(GameObject go)
        {
            foreach (var tr in go.GetComponentsInChildren<Transform>(true))
                tr.gameObject.layer = StageLayer;
        }
    }
}
