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
        Color shownTint;
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
            // Off the town. A stage at the origin was scaled and culled with the world,
            // which left only the hound in the portrait.
            transform.position = new Vector3(5200f, 0f, 5200f);
            rt = new RenderTexture(640, 720, 16) { name = "heroStage" };
            var camGo = new GameObject("stageCam");
            camGo.transform.SetParent(transform, false);
            cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.07f, 0.06f, 0.08f, 1f);
            cam.fieldOfView = 32f;
            cam.nearClipPlane = 0.05f;
            cam.farClipPlane = 24f;
            cam.cullingMask = 1 << StageLayer;
            cam.targetTexture = rt;
            camGo.transform.localPosition = new Vector3(0.15f, 1.15f, -4.1f);
            camGo.transform.LookAt(transform.TransformPoint(new Vector3(0.05f, 0.95f, 0.2f)));
            if (Camera.main != null) Camera.main.cullingMask &= ~(1 << StageLayer);

            var sun = new GameObject("stageKey").AddComponent<Light>();
            sun.transform.SetParent(transform, false);
            sun.type = LightType.Directional;
            sun.transform.rotation = Quaternion.Euler(42f, -28f, 0f);
            sun.intensity = 2.1f;
            sun.color = new Color(1f, 0.93f, 0.8f);
            sun.cullingMask = 1 << StageLayer;
            var fill = new GameObject("stageFill").AddComponent<Light>();
            fill.transform.SetParent(transform, false);
            fill.type = LightType.Directional;
            fill.transform.rotation = Quaternion.Euler(18f, 160f, 0f);
            fill.intensity = 0.85f;
            fill.color = new Color(0.62f, 0.58f, 0.78f);
            fill.cullingMask = 1 << StageLayer;
            var rim = new GameObject("stageRim").AddComponent<Light>();
            rim.transform.SetParent(transform, false);
            rim.type = LightType.Directional;
            rim.transform.rotation = Quaternion.Euler(12f, 210f, 0f);
            rim.intensity = 1.35f;
            rim.color = new Color(1f, 0.72f, 0.48f);
            rim.cullingMask = 1 << StageLayer;

            var floorTint = new Color(0.32f, 0.28f, 0.24f);
            var wallTint = new Color(0.16f, 0.14f, 0.13f);
            Art.PlaceQuad(transform, "stageFloor", new Vector3(0.05f, 0f, 0.15f), Quaternion.identity, 5.2f, 4.2f, Art.GroundMat("cobble", floorTint), true);
            Art.PlaceQuad(transform, "stageBackdrop", new Vector3(0.05f, 1.45f, 2.1f), Quaternion.identity, 6.4f, 3.6f, Art.GroundMat("crypt", wallTint), false);

            heroPivot = new GameObject("heroPivot").transform;
            heroPivot.SetParent(transform, false);
            heroPivot.localPosition = new Vector3(-0.38f, 0f, 0.1f);
            petPivot = new GameObject("petPivot").transform;
            petPivot.SetParent(transform, false);
            petPivot.localPosition = new Vector3(0.58f, 0f, 0.15f);
            AssignLayer(gameObject);
            if (target != null) target.texture = rt;
        }

        /// <summary>Creator turntable. One mesh for now; body, skin, hair, and armour tint are stored on the hero and the tint is what the stage shows.</summary>
        public void SetLook(Color tint, PetSpecies pet)
        {
            if (!built || shownTint != tint)
            {
                Clear(heroPivot);
                var model = Art.Animated("hero_hexweaver", 1.7f, heroPivot);
                if (model != null) Art.Tint(model, tint);
                else Art.Capsule(heroPivot, Vector3.up * 0.9f, new Vector3(0.45f, 0.9f, 0.45f), Art.Mat(tint));
                shownTint = tint;
                shownClass = HeroClass.Hexweaver;
            }
            ShowPet(pet);
            built = true;
            framed = 0;
            AssignLayer(gameObject);
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
            ShowPet(pet);
            built = true;
            framed = 0;
            AssignLayer(gameObject);
        }

        void ShowPet(PetSpecies pet)
        {
            if (built && pet == shownPet) return;
            Clear(petPivot);
            string key = pet == PetSpecies.Hound ? "pet_hound" : "pet_lynx";
            var model = Art.Animated(key, 0.7f, petPivot);
            if (model == null)
                Art.Quadruped(petPivot, pet == PetSpecies.Hound ? new Color(0.35f, 0.28f, 0.22f) : new Color(0.55f, 0.42f, 0.18f), 0.7f);
            shownPet = pet;
        }

        void LateUpdate()
        {
            spin += 28f * Time.unscaledDeltaTime;
            if (heroPivot != null) heroPivot.localRotation = Quaternion.Euler(0f, spin, 0f);
            if (petPivot != null) petPivot.localRotation = Quaternion.Euler(0f, spin * 0.8f + 40f, 0f);
            if (built && framed < 6)
            {
                framed++;
                if (framed == 6 && cam != null)
                    FrameBoth();
            }
        }

        void OnDestroy()
        {
            if (cam != null) cam.targetTexture = null;
            if (rt != null) rt.Release();
        }

        void FrameBoth()
        {
            bool any = false;
            Bounds b = default;
            foreach (var pivot in new[] { heroPivot, petPivot })
            {
                if (pivot == null) continue;
                Bounds piece;
                bool sane = Art.MeshWorldBounds(pivot, out piece) && piece.size.y > 0.3f && piece.size.y < 3f;
                if (!sane)
                    piece = new Bounds(pivot.position + Vector3.up * 0.9f, new Vector3(0.9f, 1.8f, 0.8f));
                piece.Expand(new Vector3(0.55f, 0.2f, 0.3f));
                if (!any) { b = piece; any = true; }
                else b.Encapsulate(piece);
            }
            if (!any) return;
            float dist = Mathf.Clamp(Mathf.Max(b.size.y * 2.1f, b.size.x * 2.1f), 4.2f, 7.2f);
            var look = b.center;
            cam.transform.position = look + new Vector3(0f, b.size.y * 0.08f, -dist);
            cam.transform.rotation = Quaternion.LookRotation(look - cam.transform.position, Vector3.up);
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
