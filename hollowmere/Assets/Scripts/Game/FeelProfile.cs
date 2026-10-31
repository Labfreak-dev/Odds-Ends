using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Movement, pet follow, and QA frame capture. The numbers match DESIGN_SPEC.md
    /// and DesignTable; the asset in Resources is what the player reads.
    /// </summary>
    public sealed class FeelProfile : ScriptableObject
    {
        public float accel = (float)DesignTable.Accel;
        public float decel = (float)DesignTable.Decel;
        public float turn = (float)DesignTable.Turn;
        public float attackTurn = (float)DesignTable.AttackTurn;
        public float idle = (float)DesignTable.IdleSpeed;
        public float walkRun = (float)DesignTable.WalkRun;
        public float clipWalk = (float)DesignTable.ClipWalk;
        public float locoBlend = (float)DesignTable.LocoBlend;
        public float attackBlend = (float)DesignTable.AttackBlend;
        public float attackSeconds = (float)DesignTable.AttackSeconds;

        public float trailBack = (float)DesignTable.TrailBack;
        public float trailSide = (float)DesignTable.TrailSide;
        public float arrive = (float)DesignTable.Arrive;
        public float cruise = (float)DesignTable.Cruise;
        public float catchup = (float)DesignTable.Catchup;
        public float maxSpeed = (float)DesignTable.MaxSpeed;
        public float warp = (float)DesignTable.WarpDistance;
        public float stuck = (float)DesignTable.StuckSeconds;
        public float sample = (float)DesignTable.SampleRadius;

        public int frames = DesignTable.QaFrames;
        public int fps = DesignTable.QaFps;
        public int width = DesignTable.QaWidth;
        public int height = DesignTable.QaHeight;
    }

    public static class Feel
    {
        static FeelProfile loaded;

        public static FeelProfile Active
        {
            get
            {
                if (loaded == null) loaded = Resources.Load<FeelProfile>("FeelProfile");
                if (loaded == null) loaded = ScriptableObject.CreateInstance<FeelProfile>();
                return loaded;
            }
        }
    }
}
