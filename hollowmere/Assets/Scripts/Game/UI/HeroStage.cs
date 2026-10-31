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
        int framed;

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
            cam.backgroundColor = new Color(0.14f, 0.12f, 0.16f, 1f);
            cam.fieldOfView = 28f;
            cam.nearClipPlane = 0.05f;
            cam.farClipPlane = 30f;
            cam.cullingMask = 1 << StageLayer;
            cam.targetTexture = rt;
            camGo.transform.localPosition = new Vector3(0.05f, 1.45f, -6.8f);
            camGo.transform.localRotation = Quaternion.Euler(8f, 0f, 0f);
            if (Camera.main != null) Camera.main.cullingMask &= ~(1 << StageLayer);

            // Hollowmere/Color only samples the main directional light. Point lights left the preview black.
            var sun = new GameObject("stageSun").AddComponent<Light>();
            sun.transform.SetParent(transform, false);
            sun.type = LightType.Directional;
            sun.transform.rotation = Quaternion.Euler(42f, 18f, 0f);
            sun.intensity = 1.7f;
            sun.color = new Color(1f, 0.94f, 0.84f);
            sun.cullingMask = 1 << StageLayer;
            var fill = new GameObject("stageFill").AddComponent<Light>();
            fill.transform.SetParent(transform, false);
            fill.type = LightType.Directional;
            fill.transform.rotation = Quaternion.Euler(20f, 160f, 0f);
            fill.intensity = 0.55f;
            fill.color = new Color(0.75f, 0.7f, 0.95f);
            fill.cullingMask = 1 << StageLayer;

            var floor = Art.Cube(transform, new Vector3(0.05f, -0.02f, 0.05f), new Vector3(4.2f, 0.05f, 3.4f), Art.GroundMat("cobble"));
            floor.name = "stageFloor";

            heroPivot = new GameObject("heroPivot").transform;
            heroPivot.SetParent(transform, false);
            heroPivot.localPosition = new Vector3(-0.42f, 0f, 0f);
            petPivot = new GameObject("petPivot").transform;
            petPivot.SetParent(transform, false);
            petPivot.localPosition = new Vector3(0.48f, 0f, 0.05f);
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
            framed = 0;
            AssignLayer(gameObject);
        }

        void LateUpdate()
        {
            spin += 28f * Time.unscaledDeltaTime;
            if (heroPivot != null) heroPivot.localRotation = Quaternion.Euler(0f, spin, 0f);
            if (petPivot != null) petPivot.localRotation = Quaternion.Euler(0f, spin * 0.8f + 40f, 0f);
            if (built && framed < 4)
            {
                framed++;
                if (framed == 4 && cam != null)
                    Art.FrameCamera(cam, gameObject, "stageFloor", 0.72f);
            }
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
