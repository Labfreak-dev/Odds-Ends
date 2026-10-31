using Hollowmere.Core;
using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Globals from DESIGN_SPEC.md section 12 onward: shake, trails, drops, fishing timings.
    /// Per-skill rows stay on DesignTable. Field initializers match the table, and the
    /// Resources asset is what the player reads.
    /// </summary>
    public sealed class Presentation : ScriptableObject
    {
        public int shakeDecay = (int)DesignTable.Present("shakeDecay");
        public int shakeCap = (int)DesignTable.Present("shakeCap");
        public int trailWidth = (int)DesignTable.Present("trailWidth");
        public int trailLife = (int)DesignTable.Present("trailLife");
        public int trailHold = (int)DesignTable.Present("trailHold");
        public int hopMm = (int)DesignTable.Present("hopMm");
        public int hopMs = (int)DesignTable.Present("hopMs");
        public int settleMs = (int)DesignTable.Present("settleMs");
        public int pip = (int)DesignTable.Present("pip");
        public int pipInset = (int)DesignTable.Present("pipInset");
        public int icon = (int)DesignTable.Present("icon");
        public int twoHandMm = (int)DesignTable.Present("twoHandMm");
        public int castMs = (int)DesignTable.Present("castMs");
        public int waitMinMs = (int)DesignTable.Present("waitMinMs");
        public int waitMaxMs = (int)DesignTable.Present("waitMaxMs");
        public int nibbleMs = (int)DesignTable.Present("nibbleMs");
        public int nibbleMax = (int)DesignTable.Present("nibbleMax");
        public int gapMinMs = (int)DesignTable.Present("gapMinMs");
        public int gapMaxMs = (int)DesignTable.Present("gapMaxMs");
        public int biteMs = (int)DesignTable.Present("biteMs");
        public int biteLuckMs = (int)DesignTable.Present("biteLuckMs");
        public int hookTension = (int)DesignTable.Present("hookTension");
        public int hookProgress = (int)DesignTable.Present("hookProgress");
        public int reelHold = (int)DesignTable.Present("reelHold");
        public int reelRun = (int)DesignTable.Present("reelRun");
        public int reelGain = (int)DesignTable.Present("reelGain");
        public int reelRunCut = (int)DesignTable.Present("reelRunCut");
        public int reelRelease = (int)DesignTable.Present("reelRelease");
        public int reelSlip = (int)DesignTable.Present("reelSlip");
        public int runMinMs = (int)DesignTable.Present("runMinMs");
        public int runMaxMs = (int)DesignTable.Present("runMaxMs");
        public int bobMm = (int)DesignTable.Present("bobMm");
        public int bobHz = (int)DesignTable.Present("bobHz");
        public int biteDipMm = (int)DesignTable.Present("biteDipMm");
        public int reelDeg = (int)DesignTable.Present("reelDeg");
        public int reelPumpMs = (int)DesignTable.Present("reelPumpMs");
        public int depthStep = (int)DesignTable.Present("depthStep");
        public int depthCap = (int)DesignTable.Present("depthCap");
        public int otherMilli = (int)DesignTable.Present("otherMilli");
        public int otherLuckCap = (int)DesignTable.Present("otherLuckCap");
        public int shakeEnabled = 1;
    }

    public static class Present
    {
        static Presentation loaded;

        public static Presentation Active
        {
            get
            {
                if (loaded == null) loaded = Resources.Load<Presentation>("Presentation");
                if (loaded == null) loaded = ScriptableObject.CreateInstance<Presentation>();
                return loaded;
            }
        }
    }
}
