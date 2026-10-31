using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace Hollowmere.Core
{
    /// <summary>
    /// Rotation keys baked from the mesh-less combat glbs. Quaternions are already
    /// converted to Unity (glTF x and z negated). Slice applies a trim window so the
    /// game and the tests share one cut.
    /// </summary>
    public static class CombatClipPack
    {
        public sealed class Clip
        {
            public string Name;
            public Bone[] Bones;
        }

        public sealed class Bone
        {
            public string Name;
            public Key[] Keys;
        }

        public struct Key
        {
            public float Time, X, Y, Z, W;
        }

        public static Clip[] Load(byte[] data)
        {
            if (data == null || data.Length < 8) return Array.Empty<Clip>();
            using (var ms = new MemoryStream(data))
            using (var r = new BinaryReader(ms))
            {
                if (Encoding.ASCII.GetString(r.ReadBytes(4)) != "HMCL") return Array.Empty<Clip>();
                if (r.ReadInt32() != 1) return Array.Empty<Clip>();
                int n = r.ReadInt32();
                var clips = new Clip[n];
                for (int i = 0; i < n; i++)
                {
                    var clip = new Clip();
                    clip.Name = ReadName(r);
                    int bones = r.ReadInt32();
                    clip.Bones = new Bone[bones];
                    for (int b = 0; b < bones; b++)
                    {
                        var bone = new Bone();
                        bone.Name = ReadName(r);
                        int keys = r.ReadInt32();
                        bone.Keys = new Key[keys];
                        for (int k = 0; k < keys; k++)
                        {
                            bone.Keys[k] = new Key
                            {
                                Time = r.ReadSingle(),
                                X = r.ReadSingle(),
                                Y = r.ReadSingle(),
                                Z = r.ReadSingle(),
                                W = r.ReadSingle(),
                            };
                        }
                        clip.Bones[b] = bone;
                    }
                    clips[i] = clip;
                }
                return clips;
            }
        }

        static string ReadName(BinaryReader r)
        {
            int n = r.ReadUInt16();
            return Encoding.UTF8.GetString(r.ReadBytes(n));
        }

        /// <summary>Keep frames [start, end] inclusive at 24 fps and start the clip at time 0.</summary>
        public static Clip Slice(Clip src, int startFrame, int endFrame)
        {
            float t0 = startFrame / 24f;
            float t1 = endFrame / 24f;
            if (t1 < t0) t1 = t0;
            var clip = new Clip();
            clip.Name = src.Name;
            clip.Bones = new Bone[src.Bones.Length];
            for (int i = 0; i < src.Bones.Length; i++)
            {
                var bone = src.Bones[i];
                var keys = new List<Key>();
                keys.Add(At(bone.Keys, t0, t0));
                if (bone.Keys != null)
                {
                    for (int k = 0; k < bone.Keys.Length; k++)
                    {
                        float t = bone.Keys[k].Time;
                        if (t > t0 + 0.0001f && t < t1 - 0.0001f)
                        {
                            var key = bone.Keys[k];
                            key.Time = t - t0;
                            keys.Add(key);
                        }
                    }
                }
                keys.Add(At(bone.Keys, t1, t0));
                var next = new Bone();
                next.Name = bone.Name;
                next.Keys = keys.ToArray();
                clip.Bones[i] = next;
            }
            return clip;
        }

        static Key At(Key[] keys, float time, float origin)
        {
            if (keys == null || keys.Length == 0)
                return new Key { Time = time - origin, W = 1f };
            if (time <= keys[0].Time) return Rebase(keys[0], origin);
            if (time >= keys[keys.Length - 1].Time) return Rebase(keys[keys.Length - 1], origin);
            int hi = 1;
            while (hi < keys.Length - 1 && keys[hi].Time < time) hi++;
            var a = keys[hi - 1];
            var b = keys[hi];
            float span = b.Time - a.Time;
            float u = span > 0.000001f ? (time - a.Time) / span : 0f;
            float dot = a.X * b.X + a.Y * b.Y + a.Z * b.Z + a.W * b.W;
            float bx = b.X, by = b.Y, bz = b.Z, bw = b.W;
            if (dot < 0f) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
            float x = a.X + (bx - a.X) * u;
            float y = a.Y + (by - a.Y) * u;
            float z = a.Z + (bz - a.Z) * u;
            float w = a.W + (bw - a.W) * u;
            float m = (float)Math.Sqrt(x * x + y * y + z * z + w * w);
            if (m > 0.000001f) { x /= m; y /= m; z /= m; w /= m; }
            return new Key { Time = time - origin, X = x, Y = y, Z = z, W = w };
        }

        static Key Rebase(Key k, float origin)
        {
            k.Time -= origin;
            return k;
        }
    }
}
