using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>Weapon, helm, and chest on the class body. Bones named RightHand, Head, and a chest
    /// bone are used when they are a human size. Otherwise the socket offset from the spec is used.
    /// gear_{baseId}.glb replaces the primitive. Primitives are original, not a paid pack.</summary>
    public static class GearAttach
    {
        public static void Apply(Transform body, Hero hero)
        {
            if (body == null || hero == null) return;
            for (int i = body.childCount - 1; i >= 0; i--)
            {
                var c = body.GetChild(i);
                if (c.name.StartsWith("gear_")) Object.Destroy(c.gameObject);
            }
            Attach(body, "weapon", hero.Equipped(EquipSlot.MainHand));
            Attach(body, "helm", hero.Equipped(EquipSlot.Head));
            Attach(body, "chest", hero.Equipped(EquipSlot.Chest));
        }

        static void Attach(Transform body, string socketId, Item it)
        {
            if (Item.IsNone(it)) return;
            string bone = socketId == "weapon" ? "RightHand" : socketId == "helm" ? "Head" : "Spine2";
            var found = Find(body, bone) ?? Find(body, socketId == "chest" ? "chest" : bone.ToLowerInvariant());
            Transform parent = body;
            Vector3 local = Vector3.zero;
            if (found != null && found.lossyScale.y > 0.2f && found.lossyScale.y < 3f)
                parent = found;
            else
            {
                var s = DesignTable.Socket(socketId);
                local = new Vector3(s.X, s.Y, s.Z) / 1000f;
            }
            var host = new GameObject("gear_" + socketId).transform;
            host.SetParent(parent, false);
            host.localPosition = parent == body ? local : Vector3.zero;
            host.localRotation = Quaternion.identity;
            var mesh = Art.Model("gear_" + it.baseId, 0.45f, host);
            if (mesh != null) return;
            var slot = socketId == "weapon" ? "weapon" : socketId == "helm" ? "head" : "chest";
            var row = DesignTable.GroundFor(slot);
            float x = row.X / 1000f, y = row.Y / 1000f, z = row.Z / 1000f;
            if (socketId == "weapon" && it.Base != null && it.Base.twoHanded)
                y = DesignTable.TwoHandMm / 1000f;
            var col = Art.Rarity(it.rarity);
            float k = socketId == "weapon" ? 0.55f : 0.35f;
            if (row.Shape == "sphere")
                Art.Sphere(host, Vector3.zero, new Vector3(x, y, z) * k, Art.Mat(col, 0.35f));
            else
                Art.Cube(host, Vector3.zero, new Vector3(x, y, z) * k, Art.Mat(col, 0.35f));
        }

        static Transform Find(Transform root, string name)
        {
            if (root.name == name) return root;
            for (int i = 0; i < root.childCount; i++)
            {
                var hit = Find(root.GetChild(i), name);
                if (hit != null) return hit;
            }
            return null;
        }
    }
}
