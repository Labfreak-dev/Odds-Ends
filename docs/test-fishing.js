/* Headless proof of the fishing rebuild: the palette, the weather, and
   above all the fight — every archetype must be landable with good play,
   punishable with greedy play, and losable with none. */
const fs=require("fs"), path=require("path");
const fill=(names)=>names.map(n=>[n,"🐟"]);
global.FSH_CATCH=[
  {tier:0,label:"Junk",color:"#888",cr:[5,15],items:fill(["Old Boot","Rusty Can","Soggy Newspaper","Tangled Seaweed","Driftwood Chunk","Broken Bottle","Lost Flip-Flop","Mud Clump","Bent Fork","Old Tire Scrap","Sun-bleached Buoy","Frayed Rope"])},
  {tier:1,label:"Common",color:"#9ac",cr:[20,60],items:fill(["Bluegill","Creek Chub","Pond Snail","River Roach","Brook Silverside","Common Dace","Mud Minnow","Shore Sculpin","Gravel Gudgeon","Least Killifish","Penny Perch","Bank Shiner"])},
  {tier:2,label:"Uncommon",color:"#8d8",cr:[60,160],items:fill(["Rainbow Trout","Silver Bream","Lake Herring","Spot Croaker","Rain Runner Shad","Mist Carp","Dawn Perch","Dusk Darter","Copper Chub","Stony Loach","Willow Whiting","Marsh Smelt","Quiet Tench"])},
  {tier:3,label:"Rare",color:"#7cf",cr:[200,500],items:fill(["Northern Pike","Sauger","Blue Crab","Sun Gar","Reed Pike","Marsh Lurker","Night Crawler Catfish","Ember Bass","Hollow Eel","King Dace","Ridge Trout","Deep Bream","Glass Pike"])},
  {tier:4,label:"Epic",color:"#b9f",cr:[800,2000],items:fill(["Bull Shark","Rock Octopus","Storm Ray","Ghost Koi","Mahi-Mahi","Great Barracuda","Iron Snapper","Vein Marlin","Cliff Grouper","Warden Pike","Shade Tarpon","Bright Halibut"])},
  {tier:5,label:"Legendary",color:"#fc6",cr:[5000,12000],items:fill(["Golden Koi","Moonlit Eel","Thunderfin Marlin","Coelacanth","The Old Man of the Lake","Silverscale Leviathan","Abyssal Anglerfish","Kraken Hatchling","Frost Whale Calf","Great White Shark","Elder Sturgeon","First-Light Salmon","Deep Bell Ray","Wandering Oarfish"])},
  {tier:6,label:"Treasure",color:"#fd8",cr:[3000,8000],items:fill(["Sunken Chest","Message in a Bottle","Ship's Bell","Pearl Oyster","Doubloon Stack","Ancient Amphora","Ruby Ring","Bronze Trident","Treasure Map","Jeweled Chalice","Gold Pocket Watch","Antique Sextant"])}];
global.FSH_BASE_WEIGHTS=[40,30,16,8,3.2,0.55,1.5];
global.FSH_WEIGHT_SLOPE=[0,1,2,3,4,5.4,2.6];
const ASSETS=fs.readFileSync(path.join(__dirname,"..","modes","fishing-assets.module.js"),"utf8");
const SFX=fs.readFileSync(path.join(__dirname,"..","modes","fishing-sfx.module.js"),"utf8");
const SRC=fs.readFileSync(path.join(__dirname,"..","modes","fishing2.module.js"),"utf8");
global.Image=class{ constructor(){ this.complete=false; this.naturalWidth=0; } set src(v){} };

/* ---- stubs for the host surface the module touches ---- */
global.FSH_W=800; global.FSH_H=520; global.FSH_HORIZON=228; global.FSH_SURF_END=352;
global.FSH_SWEET_LO=76; global.FSH_SWEET_HI=92; global.FSH_RESULT_LOCK=1.15;
global.state={credits:0,fishing:{}};
global.fshT=0; global.fsh=null; global.fshTabActive=true; global.fshGulls=[];
const noop=()=>{};
for(const f of ["fshInitScene","fshStartLoop","fshStopLoop","fshDrawGull","fshRound","fshNew",
  "fshDrawSky","fshDrawClouds","fshDrawWater","fshDrawUnderwater","fshDrawReflection",
  "fshDrawFishSchool","fshDrawFoamLine","fshDrawDock","fshDrawFisherman","fshDrawRod",
  "fshDrawLineAndBobber","fshLandCast","fshBite","fshMissed","fshFlash","fshRenderLog",
  "fshLoadResultPhoto","fshReset","fshDismiss","fshUnlockConfirm","fshUpdateLockFill",
  "saveState","renderHeader","defaultFishing","fshRenderResult"]) global[f]=noop;
global.fshBobberTarget=()=>({x:500,y:300});
global.fshEquippedItem=()=>null;
global.fshEnterResult=noop;
const INV={ skills:{}, items:{}, equipped:{}, bait:{}, active:{} };
global.fshInv=()=>INV;
global.FSH_EQ_SLOTS=["rod","reel","line","hook","lure","hat","coat","boots","gloves"].map(k=>({key:k}));
global.FSH_NO_BAIT={ speed:-25, luck:-0.5 };
global.fshBait=()=>null; global.fshCharm=()=>null;
let STATS={ tapPower:16, maxTension:160, tensionDecay:26, calm:0, lootMult:1, luck:0 };
global.fshStats=()=>STATS;
global.document={getElementById:()=>null,querySelector:()=>null,addEventListener:noop,createElement:()=>({style:{}})};
global.showToast=noop; global.renderMiningStats=noop; global.renderFishingStats=noop;
global.grantBonusXP=noop; global.recomputePlayerXP=noop;
global.UNIQUE_TIERS=new Set([11,12,13,14,15]);
global.MINE_BONUS_BY_TIER=[0.01,0.015,0.02,0.03,0.05,0.08,0.12,0.18,0.27,0.4,0.6,0.9,2.8,4.2,6.5,10];
/* a miniature Tide & Tackle line: subjects across the tiers, unique tops */
global.cards=[];
{
  let id=0;
  const add=(name,t)=>cards.push({id:id++, name, category:"Tide & Tackle", emoji:"🐟", rarity:t});
  for(let t=0;t<=12;t++) for(let i=0;i<6;i++) add(`Filler T${t} — Print ${i}`, t);
  add("Rainbow Trout — Field Journal",5); add("Rainbow Trout — Dockside Print",3);
  add("Golden Koi — Record Catch",11);
  add("The First Cast — Master Angler's Seal",15); add("Kraken's Tentacle — Abyssal Proof",15);
  add("Bobber — Bait Shop Print",1); add("Ice Hut — Tide Chart",5);
  add("Pearl of the Deep — World Record Plate",13);
  cards.push({id:id++, name:"Not Fishing — Decoy", category:"Kitchen", emoji:"🥄", rarity:2});
}
global.performance={now:()=>Date.now()};
eval(ASSETS+";"+SFX+";"+SRC+`;global.__fe={fePalette,feBasePalette,feWeatherMod,fePickWeather,feEnvInit,feEnvTick,
  feSunPos,feMoonPos,feFightNew,feFightStep,feFightStats,FE_ARCH,FE_WEATHER_NEXT,
  FE_SPOTS,feSpots,feSpot,feNight,feTTInit,feTTOwned,feAwardTT,fePickFrom,
  FE_IMG,FE_ROD_AXIS,FE_ROD_REEL,FE_RIDGE,FE_SPECIES_ART:typeof FE_SPECIES_ART!=="undefined"?FE_SPECIES_ART:{},FE_CLASS_BY_EMOJI,FE_ASSET_TIER,feCatchSprite,
  FE_PROPS,feProps,feAwardProp,feNextProp,fePropSchedule,FE_PROP_ORDER,stats:fshStats,
  feConds,feCondOk,feCondHint,FE_COND_ICONIC,feJournalRecord,feJournalCount,feSpeciesTotal,
  feShadowSpawn,FE_SFX_KEYS:Object.keys(FE_SFX),
  FE_BOSSES,feBossDef,feBossState,feBossAvailable,feBossRecord,
  feKeys,feKeyRoll,feBestKeyFor,FE_ARCH,
  feInitAmbient, get stars(){return feStars;},
  rollCatch:fshRollCatch,release:fshRelease,
  get env(){return feEnv;}};`);
const FE=global.__fe;

let fails=0;
const check=(l,c,d)=>{console.log((c?"  ok   ":"  FAIL ")+l+(c||!d?"":"\n       "+d));if(!c)fails++;};
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}

console.log("\n=== palette: every hour of every sky is a valid picture ===");
{
  let bad=0, jumps=0, prev=null;
  for(const w of ["clear","overcast","drizzle","fog","storm"]){
    prev=null;
    for(let h=0;h<=24;h+=0.2){
      const p=FE.fePalette(Math.min(h,23.999), w);
      const nums=[...p.tint,...p.warm,p.stars,p.moon,p.sun,p.fog,p.rain,p.cloudX,p.dark];
      if(nums.some(v=>!isFinite(v))) bad++;
      if(p.tint.slice(0,3).some(v=>v<0||v>255) || p.tint[3]<0||p.tint[3]>0.95) bad++;
      if([p.stars,p.moon,p.sun].some(v=>v<0||v>1.01)) bad++;
      if(prev && Math.abs(p.tint[3]-prev.tint[3])>0.09) jumps++;
      prev=p;
    }
  }
  check("no NaN or out-of-range channel anywhere", bad===0, bad+" bad samples");
  check("light changes smoothly, never in steps", jumps===0, jumps+" discontinuities");
  check("noon is full sun", FE.fePalette(12,"clear").sun>0.95);
  check("midnight is full stars", FE.fePalette(0,"clear").stars>0.95);
  check("storm kills the sun and opens the rain",
    FE.fePalette(12,"storm").sun===0 && FE.fePalette(12,"storm").rain===1);
  check("fog is fog", FE.fePalette(12,"fog").fog>=0.5);
  const s=FE.feSunPos(12), m=FE.feMoonPos(12);
  check("sun high at noon, moon gone", s.up && s.y<80 && !m.up, JSON.stringify({s,m}));
  const s0=FE.feSunPos(0), m0=FE.feMoonPos(0);
  check("their places swap at midnight", !s0.up && m0.up);
  // weather blend interpolates between two skies
  const half=FE.fePalette(12,"storm","clear",0.5);
  check("mid-blend sits between the skies", half.rain>0.3 && half.rain<0.7 && half.sun>0.2, JSON.stringify({rain:half.rain,sun:half.sun}));
}

console.log("\n=== weather machine ===");
{
  let bad=0;
  for(const from in FE.FE_WEATHER_NEXT){
    const allowed=new Set(FE.FE_WEATHER_NEXT[from].map(o=>o[0]));
    for(let i=0;i<400;i++) if(!allowed.has(FE.fePickWeather(from, i/400))) bad++;
  }
  check("transitions only follow the table", bad===0, String(bad));
  check("storms never come from a clear sky",
    !FE.FE_WEATHER_NEXT.clear.some(o=>o[0]==="storm") && !FE.FE_WEATHER_NEXT.fog.some(o=>o[0]==="storm"));
  // long sim: day advances, weather varies, blend recovers
  FE.feEnvInit();
  const seen=new Set(); const h0=FE.env.hour;
  const mr=Math.random; Math.random=mulberry(2024);   // deterministic weather walk
  for(let i=0;i<7200;i++){ FE.feEnvTick(1); seen.add(FE.env.weather); }
  Math.random=mr;
  check("the clock goes round", FE.env.hour>=0 && FE.env.hour<24);
  check("two simulated hours see real variety", seen.size>=3, [...seen].join(","));
  check("blend always recovers to 1", FE.env.blend===1);
  check("environment persists on the save object", INV.env===FE.env);
}

console.log("\n=== the fight ===");
{
  const DEFS=[
    {tier:0,label:"Junk",need:60,pull:4,strain:1.00},
    {tier:1,label:"Common",need:115,pull:6,strain:1.08},
    {tier:2,label:"Uncommon",need:200,pull:9,strain:1.20},
    {tier:3,label:"Rare",need:330,pull:14,strain:1.40},
    {tier:4,label:"Epic",need:540,pull:20,strain:1.65},
    {tier:5,label:"Legendary",need:840,pull:27,strain:1.95},
    {tier:6,label:"Treasure",need:620,pull:22,strain:1.55},
  ];
  const GEAR={
    starter:{reelPower:6*1.55, reelLoad:30+6*0.75, maxTension:100, tensionDecay:16, calm:0},
    mid:    {reelPower:16*1.55,reelLoad:30+16*0.75,maxTension:160, tensionDecay:26, calm:0},
    maxed:  {reelPower:30*1.55,reelLoad:30+30*0.75,maxTension:240, tensionDecay:42, calm:0},
  };
  const smart=f=>{
    if(f.mood==="jump") return false;                    // telegraph + air: hands off
    if(f.mood==="run") return f.tension < f._st.maxTension*0.55;  // ride the run under the drag cap
    if(f.tension > f._st.maxTension*0.82) return false;
    return true;
  };
  const greedy=()=>true, sleep=()=>false;
  function run(def, st, bot, seed){
    const rng=mulberry(seed);
    const f=FE.feFightNew(def, st, rng); f._st=st;
    let guard=0;
    while(!f.over && guard++<40000){ FE.feFightStep(f, 1/60, bot(f), st, rng); }
    return f;
  }
  function rate(def, st, bot, n, want){
    let w=0; const ends={};
    for(let i=0;i<n;i++){ const f=run(def,st,bot,i*7919+3); ends[f.over]=(ends[f.over]||0)+1; if(f.over===want)w++; }
    return {p:w/n, ends};
  }

  for(const [i,g] of [[0,"starter"],[1,"starter"],[2,"mid"],[3,"mid"],[4,"mid"]]){
    const r=rate(DEFS[i],GEAR[g],smart,150,"landed");
    check(`${DEFS[i].label} lands with ${g} gear and smart hands (${Math.round(r.p*100)}%)`,
      r.p>=0.88, JSON.stringify(r.ends));
  }
  const leg=rate(DEFS[5],GEAR.maxed,smart,150,"landed");
  check(`Legendary lands with maxed gear most of the time (${Math.round(leg.p*100)}%)`, leg.p>=0.6, JSON.stringify(leg.ends));
  const tre=rate(DEFS[6],GEAR.maxed,smart,150,"landed");
  check(`Treasure hauls up with maxed gear (${Math.round(tre.p*100)}%)`, tre.p>=0.65, JSON.stringify(tre.ends));

  const gr=rate(DEFS[4],GEAR.starter,greedy,150,"snap");
  check(`never letting go snaps against an Epic (${Math.round(gr.p*100)}% snapped)`, gr.p>=0.6, JSON.stringify(gr.ends));
  const sl=rate(DEFS[1],GEAR.mid,sleep,80,"slip");
  check("never holding loses every fish to a slack hook", sl.p===1, JSON.stringify(sl.ends));

  // better gear can only help
  let mono=true, detail=[];
  for(const d of DEFS){
    const a=rate(d,GEAR.starter,smart,120,"landed").p, b=rate(d,GEAR.maxed,smart,120,"landed").p;
    detail.push(`${d.label} ${Math.round(a*100)}→${Math.round(b*100)}`);
    if(b < a-0.06) mono=false;
  }
  check("maxed gear never lands worse than starter", mono, detail.join(", "));
  console.log("       gear curve: "+detail.join(" · "));

  // legends jump, and jumping is telegraphed before it is airborne
  let tele=0, air=0, order=true, spike=0, calmAir=0, jumped=0;
  for(let s2=0;s2<40;s2++){
    const rng=mulberry(s2*31+7);
    const f=FE.feFightNew(DEFS[5],GEAR.maxed,rng); f._st=GEAR.maxed;
    let seenTele=false, guard=0;
    while(!f.over && guard++<40000){
      FE.feFightStep(f,1/60,smart(f),GEAR.maxed,rng);
      if(f.event==="telegraph"){ tele++; seenTele=true; }
      if(f.event==="airborne"){ air++; if(!seenTele) order=false; jumped++;
        // holding through the air must cost more than giving line
        const a=JSON.parse(JSON.stringify(f)), b=JSON.parse(JSON.stringify(f));
        for(let k=0;k<20;k++){ FE.feFightStep(a,1/60,true,GEAR.maxed,mulberry(1)); FE.feFightStep(b,1/60,false,GEAR.maxed,mulberry(1)); }
        if(a.tension > b.tension+30) spike++; else calmAir++;
      }
    }
  }
  check("legends actually jump", jumped>=20, jumped+" jumps in 40 fights");
  check("every jump is telegraphed first", order && tele>=air);
  check("holding a fish in the air punishes the line", spike>calmAir, `${spike} vs ${calmAir}`);

  // stamina: brutes get worn out, and it shows
  let winded=0;
  for(let s3=0;s3<30;s3++){
    const f=run(DEFS[4],GEAR.maxed,smart,s3*13+1);
    if(f.winded>0) winded++;
  }
  check("big fish get worn down before they come in", winded>=24, winded+"/30");

  // the futility window: outclassed tackle ends honestly and fast
  {
    const r=rate(DEFS[4],GEAR.starter,smart,120,"overpowered");
    let maxT=0;
    for(let i=0;i<60;i++){ const f=run(DEFS[4],GEAR.starter,smart,i*101+7); maxT=Math.max(maxT,f.t); }
    check(`starter tackle vs an Epic ends "overpowered" (${Math.round(r.p*100)}%)`, r.p>=0.7, JSON.stringify(r.ends));
    check("and ends inside 70s, not a 150s grind", maxT<70, maxT.toFixed(1)+"s worst");
    check("hopeless fights typically resolve within a minute", (()=>{ let tot=0; for(let i=0;i<60;i++) tot+=run(DEFS[4],GEAR.starter,smart,i*101+7).t; return tot/60 < 55; })());
    const ok=rate(DEFS[4],GEAR.mid,smart,150,"landed");
    check("mid gear vs an Epic never gets the overpowered card", (ok.ends.overpowered||0)===0 && ok.p>=0.88, JSON.stringify(ok.ends));
    const leg2=rate(DEFS[5],GEAR.maxed,smart,150,"landed");
    check("maxed vs Legendary is untouched by the futility check", (leg2.ends.overpowered||0)===0 && leg2.p>=0.6, JSON.stringify(leg2.ends));
    const sl2=rate(DEFS[1],GEAR.mid,sleep,60,"slip");
    check("a slack line still slips before futility ever fires", sl2.p===1, JSON.stringify(sl2.ends));
  }

console.log("\n=== legends & strongboxes ===");
{
  check("six waters, six rulers", FE.FE_BOSSES.length===6 &&
    ["dock","shallows","ledge","reef","midnight"].every(sp=>FE.FE_BOSSES.some(b=>b.spot===sp)));
  const acro = FE.FE_ARCH.find(a=>a.key==="acrobat");
  check("every scripted mood is one the fish can throw",
    FE.FE_BOSSES.every(b=>b.script.every(m=>acro.moods[m])));
  // the script is a rotation you can learn
  const f = feFightNew(FE.feBossDef(FE.FE_BOSSES[0]), GEAR.maxed, mulberry(7));
  const seen=[];
  let g2 = f.mood;
  const rr = mulberry(9);
  for(let i=0;i<6;i++){ const n = fePickMood(f, rr); seen.push(n.mood); }
  check("boss moods follow the script in order",
    JSON.stringify(seen)===JSON.stringify(FE.FE_BOSSES[0].script), seen.join(","));
  // winnable, hard, and honest
  const results = FE.FE_BOSSES.filter(b=>b.spot!=="confluence").map(b=>{
    const r = rate(FE.feBossDef(b), GEAR.maxed, smart, 80, "landed");
    return [b.name, Math.round(r.p*100)];
  });
  const king = FE.FE_BOSSES.find(b=>b.spot==="confluence");
  const kingR = king ? Math.round(rate(FE.feBossDef(king), GEAR.maxed, smart, 80, "landed").p*100) : 100;
  if(process.env.BOSS_DIAG){
    for(const b of FE.FE_BOSSES.filter(x=>x.spot!=="confluence")){
      const r = rate(FE.feBossDef(b), GEAR.maxed, smart, 120, "landed");
      console.log("DIAG", b.name, JSON.stringify(r.ends));
    }
  }
  check("maxed gear can land every legend (40%+)", results.every(([n,p])=>p>=40), JSON.stringify(results));
  check("the Drowned King is brutal but honest (12%+)", kingR >= 12 && kingR <= 60, kingR);
  check("the entry legend tops out near-certain (<=97%)", results.every(([n,p])=>p<=97), JSON.stringify(results));
  check("at least two legends are real challenges (<=80%)", results.filter(([n,p])=>p<=80).length>=2, JSON.stringify(results));
  const easy = rate(FE.feBossDef(FE.FE_BOSSES[0]), GEAR.mid, smart, 80, "landed");
  check(`mid gear has a real shot at Old Ironjaw (${Math.round(easy.p*100)}%)`, easy.p>=0.2, easy.p);
  // daily gate
  INV.bossDay=null; INV.bossJournal=null; INV.dayN=undefined;
  FE.feBossState(); INV.spots={cur:"dock",open:["dock"]};
  check("the legend waits when unfought", !!FE.feBossAvailable());
  INV.bossDay.dock = INV.dayN;
  check("one attempt per day, spent on the hook", !FE.feBossAvailable());
  INV.dayN++;
  check("a new day brings it back", !!FE.feBossAvailable());
  FE.feBossRecord("Old Ironjaw", 61.5); FE.feBossRecord("Old Ironjaw", 58);
  check("the legends journal keeps count and best", INV.bossJournal["Old Ironjaw"].n===2 && INV.bossJournal["Old Ironjaw"].best===61.5);
  // keys
  INV.keys=null; INV.strongboxes=null; FE.feKeys();
  let got=0;
  for(let i=0;i<4000;i++){ if(FE.feKeyRoll(3, mulberry(i*5+3))) got++; INV.keys={}; }
  check(`keys snag ~2.5% of decent catches (${(got/40).toFixed(1)}%)`, got>50 && got<160, got);
  INV.keys={2:1, 5:2};
  check("the best-fit key is the lowest that opens", FE.feBestKeyFor(2)===2 && FE.feBestKeyFor(3)===5 && FE.feBestKeyFor(6)===0);
}

  // a tap is not a cast
  {
    global.fshConsumeOnCast=()=>{ global.__consumed=(global.__consumed||0)+1; };
    global.__consumed=0; state.fishing.casts=0;
    global.fsh={ phase:"charging", power:4, castGuard:0 };
    FE.release();
    check("a tap cancels back to idle", fsh.phase==="idle" && (fsh.castGuard||0)>0);
    check("no bait burned, no cast counted on a tap", global.__consumed===0 && (state.fishing.casts||0)===0);
    global.fsh={ phase:"charging", power:55, castGuard:0, ripples:[], splash:[] };
    FE.release();
    check("a real hold still casts", fsh.phase==="casting" && global.__consumed===1 && state.fishing.casts===1);
    global.fsh=null;
  }

  // numeric hygiene under random mashing
  let dirty=0;
  const rng=mulberry(99);
  for(let s4=0;s4<40;s4++){
    const f=FE.feFightNew(DEFS[s4%7],GEAR.mid,rng); f._st=GEAR.mid;
    let guard=0;
    while(!f.over && guard++<40000){
      FE.feFightStep(f,1/60,rng()<0.5,GEAR.mid,rng);
      if(!isFinite(f.tension)||!isFinite(f.progress)||f.tension<0||f.progress<0||!isFinite(f.stamina)) dirty++;
    }
    if(!f.over) dirty++;                                   // every fight must end
  }
  check("no NaN, no negatives, no immortal fish", dirty===0, String(dirty));
}

console.log("\n=== spots ===");
{
  const S=FE.FE_SPOTS;
  check("six waters, dock free and first", S.length===6 && S[0].id==="dock" && S[0].cost===0);
  check("costs climb (gated waters exempt)", S.filter(d=>!d.gate).every((d,i,a)=>i===0 || d.cost>a[i-1].cost));
  check("odds arrays cover all seven tiers, positive", S.every(d=>d.odds.length===7 && d.odds.every(v=>v>0)));
  const dist=(spot,hour,n)=>{
    FE.feSpots().cur=spot; FE.env.hour=hour;
    const counts=[0,0,0,0,0,0,0];
    const rng=mulberry(4242); const mr=Math.random; Math.random=rng;
    for(let i=0;i<n;i++) counts[FE.rollCatch(0.8,true).def.tier]++;
    Math.random=mr;
    return counts.map(c=>c/n);
  };
  FE.feSpots().open=["dock","shallows","ledge","midnight"];
  const dock=dist("dock",12,6000), sh=dist("shallows",12,6000), le=dist("ledge",12,6000);
  const mmDay=dist("midnight",12,9000), mmNight=dist("midnight",1.5,9000);
  check("the Shallows run junky", sh[0]>dock[0]*1.25, `${sh[0].toFixed(3)} vs ${dock[0].toFixed(3)}`);
  check("the Shallows wash up treasure", sh[6]>dock[6]*1.2, `${sh[6].toFixed(3)} vs ${dock[6].toFixed(3)}`);
  check("the Ledge holds the big ones", (le[3]+le[4])>(dock[3]+dock[4])*1.5, `${(le[3]+le[4]).toFixed(3)} vs ${(dock[3]+dock[4]).toFixed(3)}`);
  check("the Mark's dark water opens at night", mmNight[5]>mmDay[5]*1.7, `${mmNight[5].toFixed(4)} vs ${mmDay[5].toFixed(4)}`);
  FE.feSpots().cur="dock";
}

console.log("\n=== Tide & Tackle ===");
{
  const tt=FE.feTTInit();
  const blockedFakes = cards.filter(c=>c.category==="Tide & Tackle" && ["The First Cast","Bobber","Ice Hut"].includes(c.name.split(" — ")[0])).length;
  check("only the aquatic fishing line is indexed",
    tt.all.every(c=>c.category==="Tide & Tackle") && tt.all.length===cards.length-1-blockedFakes);
  check("bait and buildings are off the line", !tt.bySubject.has("Bobber") && !tt.bySubject.has("Ice Hut") && !tt.bySubject.has("The First Cast"));
  // band-empty fallback expands gradually, never leaps
  const onlyT2 = cards.filter(c=>c.category==="Tide & Tackle" && c.rarity===2);
  const picked = FE.fePickFrom(onlyT2, 9, 12, mulberry(1));
  check("an empty band widens to the nearest tier", picked && picked.rarity===2);
  check("subjects split on the em-dash", tt.bySubject.has("Rainbow Trout") && tt.bySubject.get("Rainbow Trout").length===2);
  state.owned={};
  const rng=mulberry(7);
  // legendary always awards; epic always awards; junk rarely
  let leg=0, junk=0;
  for(let i=0;i<400;i++){
    state.owned={};
    if(FE.feAwardTT({name:"Golden Koi"},{tier:5},rng)) leg++;
    if(FE.feAwardTT({name:"Old Boot"},{tier:0},rng)) junk++;
  }
  FE.env.hour=12;
  check("a legendary catch always pulls a card", leg===400, String(leg));
  check("junk almost never does (~5%)", junk>2 && junk<45, String(junk));
  // bands respected (day, so no mythic window)
  FE.env.hour=12; state.owned={};
  let inBand=0, n=0;
  for(let i=0;i<300;i++){
    const c=FE.feAwardTT({name:"Nobody"},{tier:4},mulberry(i*3+1));
    if(c){ n++; if(c.rarity>=6&&c.rarity<=9) inBand++; }
  }
  check("Epic pulls stay in the 6-9 band", n>0 && inBand===n, `${inBand}/${n}`);
  // subject match: catching a Rainbow Trout usually pulls its own line
  state.owned={}; let match=0, total=0;
  for(let i=0;i<400;i++){
    const c=FE.feAwardTT({name:"Rainbow Trout"},{tier:2},mulberry(i*11+5));
    if(c){ total++; if(c.name.startsWith("Rainbow Trout")) match++; }
  }
  check("your catch pulls its own print more often than not", match/total>0.5, `${match}/${total}`);
  // the mythic window: legendaries in the dark can reach t13-15, day cannot
  let mythNight=0, mythDay=0;
  FE.feSpots().cur="midnight";
  for(let i=0;i<3000;i++){
    state.owned={};
    FE.env.hour=1.5; const a=FE.feAwardTT({name:"Golden Koi"},{tier:5},mulberry(i*17+3)); if(a&&a.rarity>=13) mythNight++;
    FE.env.hour=12;  const b=FE.feAwardTT({name:"Golden Koi"},{tier:5},mulberry(i*17+3)); if(b&&b.rarity>=13) mythDay++;
  }
  check("mythic plates only come out after dark", mythNight>60 && mythDay===0, `${mythNight} night vs ${mythDay} day`);
  // one-of-a-kind tiers reroll below when owned
  state.owned={}; FE.env.hour=1.5;
  for(const c of cards) if(c.rarity>=13) state.owned[c.id]=1;
  let dup=0;
  for(let i=0;i<1500;i++){
    const c=FE.feAwardTT({name:"Golden Koi"},{tier:5},mulberry(i*29+1));
    if(c && c.rarity>=13) dup++;
  }
  check("owned one-of-a-kinds never drop twice", dup===0, String(dup));
  state.owned={}; FE.feSpots().cur="dock"; FE.env.hour=12;
  check("collection counter counts distinct", (()=>{ state.owned={}; state.owned[tt.all[0].id]=3; state.owned[tt.all[1].id]=1; return FE.feTTOwned()===2; })());
}

console.log("\n=== dock comforts ===");
{
  check("five comforts with art at all seven tiers",
    FE.FE_PROPS.length===5 && FE.FE_PROPS.every(p=>[1,2,3,4,5,6,7].every(t=>FE.FE_IMG[p.spr+t])));
  // the schedule: deterministic, ordered, one per catch
  INV.props=null; delete INV.propGrants;
  const seen=[];
  for(let c=1;c<=60;c++){ const g=FE.feAwardProp(c); if(g) seen.push({c, key:g.key}); }
  check("catch #5 is always the first lantern", seen.length>0 && seen[0].c===5 && seen[0].key==="lantern", JSON.stringify(seen[0]));
  check("grants land exactly on schedule (5, 12, 20, 28, 37…)",
    JSON.stringify(seen.slice(0,5).map(x=>x.c))===JSON.stringify([5,12,20,28,37]), JSON.stringify(seen.map(x=>x.c)));
  check("the order laps every item each tier",
    JSON.stringify(seen.slice(0,5).map(x=>x.key))===JSON.stringify(["lantern","bucket","flask","bedroll","barrel"]),
    JSON.stringify(seen.slice(0,5).map(x=>x.key)));
  check("second lap begins with the tier-2 lantern", seen[5] && seen[5].key==="lantern" && INV.props.lantern>=1);
  check("the full dock (35 grants) lands around 420 catches",
    FE.fePropSchedule(35)>380 && FE.fePropSchedule(35)<460, FE.fePropSchedule(35));
  check("and the trickle never stops past tier 7", FE.fePropSchedule(40)>FE.fePropSchedule(35));
  // one grant per catch, even for a save that's far behind schedule
  INV.props={bucket:0,flask:0,lantern:0,barrel:0,bedroll:0}; INV.propGrants=0;
  let g1=FE.feAwardProp(61), g2=FE.feAwardProp(61);
  check("a legacy save catches up one comfort per catch", !!g1 && !!g2 && INV.propGrants===2);
  // players with old random stacks start the schedule where they stand
  INV.props={bucket:2,flask:1,lantern:0,barrel:0,bedroll:0}; delete INV.propGrants;
  FE.feProps();
  check("old random stacks count toward the schedule", INV.propGrants===3);
  check("the shelf can always say what's next", (()=>{ const n=FE.feNextProp(); return n.def && n.at>0 && n.k===4; })());
  // every stack moves the stats it claims to
  INV.props={bucket:0,flask:0,lantern:0,barrel:0,bedroll:0};
  INV.skills={}; INV.items={}; INV.equipped={}; INV.bait={}; INV.active={};
  const base=FE.stats();
  INV.props={bucket:10,flask:10,lantern:10,barrel:10,bedroll:10};
  const boosted=FE.stats();
  check("+10 buckets = +10% catch value", Math.abs(boosted.lootMult-base.lootMult-0.10)<1e-9, `${base.lootMult}→${boosted.lootMult}`);
  check("+10 flasks = +5/s recovery", Math.abs(boosted.tensionDecay-base.tensionDecay-5)<1e-9);
  check("+10 lanterns = +0.6 raw luck", Math.abs(boosted.raw.luck-base.raw.luck-0.6)<1e-9);
  check("+10 barrels = +20 max tension", boosted.maxTension-base.maxTension===20);
  check("+10 bedrolls shorten the wait", boosted.biteMult < base.biteMult);
  check("stacks persist on the save object", INV.props===FE.feProps());
  INV.props=null;
  check("the dock band redraw replaces per-item erase patches",
    typeof feRedrawDockBand === "function" && FE.FE_PROPS.every(p=>!p.erase));
  check("reel medallion boxes exist for all seven poles",
    [1,2,3,4,5,6,7].every(t=>{ const r=FE.FE_ROD_REEL[t]; return r && r[2]>40 && r[3]>40 && r[4]>0.02 && r[4]<0.5; }));
}

console.log("\n=== conditions & the journal ===");
{
  const conds=FE.feConds();
  const inTables=new Set(FSH_CATCH.flatMap(d=>d.items.map(it=>it[0])));
  const iconicKept=Object.keys(FE.FE_COND_ICONIC).filter(n=>inTables.has(n) && conds[n]).length;
  check(`iconic habits survive the floor guard (${iconicKept} kept)`, iconicKept>=10, iconicKept);
  let ok=true;
  for(const def of FSH_CATCH){
    const uncond = def.items.filter(it=>!conds[it[0]]).length;
    if(uncond < 8 && def.items.length >= 8) ok=false;
  }
  check("every tier keeps at least 8 species with no conditions", ok);
  const condCount = Object.keys(conds).length;
  check(`a meaningful share of species keep hours (${condCount})`, condCount>=15, condCount);
  // gates behave
  FE.feEnvInit(); FE.env.hour=13; FE.env.weather="clear";
  check("the Moonlit Eel refuses broad daylight", !FE.feCondOk({time:"night"}));
  FE.env.hour=23.5;
  check("and takes after dark", FE.feCondOk({time:"night"}));
  FE.env.weather="storm";
  check("storm species need the storm", FE.feCondOk({weather:"storm"}) && !FE.feCondOk({weather:"clear"}));
  check("hints read like an old-timer's tip", /Bites .*after dark/.test(FE.feCondHint({time:"night"})));
  check("no condition ever renders a bare hint",
    Object.values(conds).every(c=>FE.feCondHint(c).length===0 || FE.feCondHint(c).length>8));
  check("hash sign bug stays dead (values always valid)",
    Object.values(conds).every(c=>(!("time" in c) || c.time) && (!("weather" in c) || c.weather)));
  // every roll respects the gate
  FE.env.hour=13; FE.env.weather="clear"; INV.spots={cur:"dock",open:["dock"]};
  global.fsh=null;
  let clean=true;
  for(let i=0;i<400;i++){
    const c=FE.rollCatch(0.6,false);
    const cd=conds[c.name];
    if(cd && !FE.feCondOk(cd)) clean=false;
  }
  check("nothing bites outside its hours (400 rolls)", clean);
  // journal
  INV.journal=null;
  check("first catch is first exactly once", FE.feJournalRecord("Bluegill", 2.2)===true && FE.feJournalRecord("Bluegill", 4.1)===false);
  check("the journal keeps the best weight", INV.journal["Bluegill"].n===2 && INV.journal["Bluegill"].best===4.1);
  check("the roster counts every table entry", FE.feSpeciesTotal()===FSH_CATCH.reduce((a,d)=>a+d.items.length,0));
  check("progress counts distinct species", FE.feJournalCount()===1);
  // sight fishing
  const bands=new Set();
  for(let i=0;i<200;i++) bands.add(FE.feShadowSpawn().band.join("-"));
  check("shadows come in all four size bands", bands.size===4, [...bands].join(","));
  global.fsh={ sightBias:[4,5], phase:"idle" };
  let hi=0, base=0;
  for(let i=0;i<3000;i++){ const c=FE.rollCatch(0.4,false); if(c.def.tier===4||c.def.tier===5) hi++; }
  global.fsh=null;
  for(let i=0;i<3000;i++){ const c=FE.rollCatch(0.4,false); if(c.def.tier===4||c.def.tier===5) base++; }
  check(`aiming at a big shadow more than doubles its band (${base}→${hi})`, hi > base*1.7, `${base} vs ${hi}`);
  // sound coverage: every key the code plays exists in the pack
  const played=[...SRC.matchAll(/fe(?:Sound|LoopStart)\("([a-z_]+)"/g)].map(m=>m[1]);
  const fan=[...SRC.matchAll(/FANFARE = \[([^\]]+)\]/g)][0][1].match(/[a-z_]+/g);
  const need=[...new Set([...played,...fan])];
  const missing=need.filter(k=>!FE.FE_SFX_KEYS.includes(k));
  check(`all ${need.length} referenced sounds exist in the pack`, missing.length===0, missing.join(","));
}

console.log("\n=== sprites & the ridge line ===");
{
  check("the sprite set is complete (250+)", Object.keys(FE.FE_IMG).length>=250, Object.keys(FE.FE_IMG).length);
  check("every species portrait resolves to a real image",
    Object.values(FE.FE_SPECIES_ART).every(k=>FE.FE_IMG[k]));
  check("portraits are strictly one per species",
    new Set(Object.values(FE.FE_SPECIES_ART)).size===Object.keys(FE.FE_SPECIES_ART).length);
  const classes=[...new Set([...Object.values(FE.FE_CLASS_BY_EMOJI),"fish"])];
  let missing=[];
  for(const cls of classes) for(const t of FE.FE_ASSET_TIER) if(!FE.FE_IMG[cls+t]) missing.push(cls+t);
  check("every catch class has art at every mapped tier", missing.length===0, missing.join(","));
  check("rod art spans all seven tiers with sane axes",
    [1,2,3,4,5,6,7].every(t=>{ const a=FE.FE_ROD_AXIS[t]; return a && Math.hypot(a[2]-a[0],a[3]-a[1])>200; }));
  check("sharks read as sharks, chests as chests",
    FE.feCatchSprite("🦈",4).key==="shark5" && FE.feCatchSprite("🧰",6).key==="chest6" && FE.feCatchSprite("🐟",5).key==="fish7");
  check("the ridge envelope is real", FE.FE_RIDGE.length===101 && FE.FE_RIDGE.every(v=>v>=-80 && v<=200));
  FE.feInitAmbient();
  const ridgeAt = x => FE.FE_RIDGE[Math.max(0,Math.min(100,Math.round(x/8)))];
  const strays = FE.stars.filter(st=>st.y >= ridgeAt(st.x)-11).length;
  check("no star ever touches the mountains", strays===0, strays+" strays");
}

console.log(fails===0?"\nAll checks passed.\n":`\n${fails} FAILED\n`);
process.exit(fails?1:0);
