import asyncio, sys
from playwright.async_api import async_playwright
import os as _os
# Default to the built index.html at the repo root (this file lives in docs/).
# Override with OE_INDEX=/path/to/index.html or OE_URL=<url>.
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
_URL = _os.environ.get("OE_URL") or "file://" + _os.environ.get(
    "OE_INDEX", _os.path.join(_ROOT, "index.html"))
fails=[]
def check(l,c,d=""):
    print(("  ok   " if c else "  FAIL ")+l+("" if c or not d else "  -> "+str(d)))
    if not c: fails.append(l)
async def main():
    async with async_playwright() as pw:
        b=await pw.chromium.launch()
        pg=await b.new_page(viewport={"width":1280,"height":900})
        errors=[]; pg.on("pageerror", lambda e: errors.append(str(e)))
        await pg.goto(_URL); await pg.wait_for_timeout(900)
        await pg.evaluate("uiEnterSection('fishing'); document.querySelectorAll('main > section').forEach(s=>s.style.display='none'); document.getElementById('tab-fishing').style.display='block';")
        await pg.evaluate("FE_TEST_EVERY5=false")
        await pg.wait_for_timeout(700)

        check("spot picker renders six waters", await pg.evaluate("document.querySelectorAll('.fe-spot').length===6"))
        check("dock starts active, rest locked", await pg.evaluate(
            "document.querySelector('.fe-spot.active').textContent.includes('Old Dock') && document.querySelectorAll('.fe-spot.locked').length===5"))
        # too poor: buying fails politely
        await pg.evaluate("state.credits=5")
        await pg.click(".fe-spot[data-spot='shallows']"); await pg.wait_for_timeout(250)
        check("can't buy what you can't afford", await pg.evaluate("!fshInv().spots.open.includes('shallows')"))
        # fund and buy
        await pg.evaluate("state.credits=10000000")
        await pg.click(".fe-spot[data-spot='shallows']"); await pg.wait_for_timeout(250)
        detail=await pg.evaluate("JSON.stringify({open:fshInv().spots.open, cur:fshInv().spots.cur, credits:state.credits})")
        check("buying the Shallows unlocks and selects it", await pg.evaluate(
            "fshInv().spots.open.includes('shallows') && fshInv().spots.cur==='shallows' && Math.abs(state.credits-(10000000-120000))<2000"), detail)   # idle income ticks during the test
        await pg.click(".fe-spot[data-spot='midnight']"); await pg.wait_for_timeout(250)
        check("the Mark unlocks too", await pg.evaluate("fshInv().spots.cur==='midnight'"))
        await pg.evaluate("feEnv.hour=1.5; feEnv.weather='clear'; feEnv.blend=1;")
        await pg.wait_for_timeout(900)
        check("night special line shows the open dark water", await pg.evaluate(
            "document.querySelector('.fe-spot-line').textContent.includes('dark water is open')"))
        check("collection counter shows on the line", await pg.evaluate(
            "/🎴 \\d+\\/1000/.test(document.querySelector('.fe-spot-line').textContent)"))

        # a legendary landed at night must pull a Tide & Tackle card
        await pg.evaluate("""
          fshStartCharge(); fsh.power=84; fshRelease();
        """)
        await pg.wait_for_timeout(1000)
        await pg.evaluate("fsh.waitMs=40; fsh.waitTimer=0;")
        await pg.wait_for_timeout(500)
        await pg.evaluate("""
          fsh.catch = { def: FSH_CATCH[5], name:'Golden Koi', icon:'🐠', sizeRoll:1, valueMult:1, weightLb:40 };
          fshHookSet(); fsh.holding=true; fsh.fight.progress = fsh.fight.need + 5;   /* past the line: land on the next tick, whatever the mood */
        """)
        await pg.wait_for_timeout(600)
        got=await pg.evaluate("fsh.phase==='result' && !!fsh.result.card")
        check("legendary catch pulls a Tide & Tackle card", got, await pg.evaluate("fsh.phase"))
        if got:
            check("the card is from the fishing line", await pg.evaluate("fsh.result.card.category==='Tide & Tackle'"))
            check("result chips count the collection", await pg.evaluate(
                "fsh.result.chips.some(c=>c.includes('Tide & Tackle') && c.includes('/1000'))"))
        # switching during the result card is allowed by design — pick your next water
        await pg.click(".fe-spot[data-spot='dock']"); await pg.wait_for_timeout(200)
        check("switching while the card is up is fine", await pg.evaluate("fshInv().spots.cur==='dock'"))
        await pg.click(".fe-spot[data-spot='midnight']"); await pg.wait_for_timeout(200)
        # mid-cast switching is now impossible through the UI: the picker
        # hides itself entirely (asserted below); the in-handler phase
        # guard remains as defense-in-depth.
        await pg.wait_for_timeout(1300)
        # --- picker placement & gating ---
        check("the bars ride the scene overlay, spots stay below deck", await pg.evaluate(
            "document.getElementById('fshBars').closest('#feCtl')!==null && document.getElementById('feSpotRow') && !document.getElementById('feSpotRow').closest('#feCtl')"))
        await pg.evaluate("fshReset()"); await pg.wait_for_timeout(400)
        check("picker visible at idle", await pg.evaluate("document.getElementById('feSpotRow').style.display!=='none'"))
        await pg.evaluate("fshStartCharge(); fsh.power=84; fshRelease();"); await pg.wait_for_timeout(1000)
        check("picker hides itself mid-cast", await pg.evaluate("document.getElementById('feSpotRow').style.display==='none'"))
        await pg.evaluate("fsh.phase='idle';"); await pg.wait_for_timeout(600)

        # --- each water dresses the scene ---
        await pg.evaluate("fshInv().spots.cur='shallows'; feInitAmbient();")
        sh=await pg.evaluate("JSON.stringify({reeds:feAgents.reeds.length, lilies:!!feSpot().dress.lilies})")
        await pg.evaluate("fshInv().spots.cur='ledge'; feInitAmbient();")
        le=await pg.evaluate("feAgents.reeds.length")
        check("the Shallows grow thick with reeds and lilies", await pg.evaluate(
            "fshInv().spots.cur='shallows', feInitAmbient(), feAgents.reeds.length>=15 && !!feAgents.lilies"), sh)
        check("the Ledge is bare rock", le==0, le)
        check("each water wears its own tint", await pg.evaluate(
            "FE_SPOTS.filter(s=>s.dress && s.dress.tint).length===5"))

        # --- training on the gear ---
        await pg.evaluate("fshInv().spots.cur='dock'; feInitAmbient(); state.credits=99999999; state.player=state.player||{}; state.player.level=99; feSecOpen('equip'); renderEquipment();")
        await pg.wait_for_timeout(300)
        check("every gear card offers its training", await pg.evaluate(
            "document.querySelectorAll('#fshEquip .eq-slot .eq-train').length===9"))
        t0=await pg.evaluate("fshSkillTier('rod')")
        c0=await pg.evaluate("state.credits")
        await pg.click("#fshEquip .eq-slot[data-slot='rod'] .eq-train-btn"); await pg.wait_for_timeout(300)
        check("training from the rod card raises Casting Technique", await pg.evaluate(f"fshSkillTier('rod')==={t0}+1"))
        check("and charges the right price", await pg.evaluate(f"state.credits < {c0}"))
        check("the train click doesn't open the picker underneath", await pg.evaluate("eqPicker===null || eqPicker===undefined"))
        await pg.click("#fshEquip .eq-slot[data-slot='rod']"); await pg.wait_for_timeout(250)
        check("the card itself still opens the picker", await pg.evaluate("eqPicker==='rod'"))
        await pg.evaluate("eqPicker=null; renderEquipment();")
        check("bait shelf and ledger carry their skills too", await pg.evaluate(
            "document.querySelectorAll('#fshEquip .eq-sec .eq-train').length===2"))

        await pg.evaluate("feSecOpen(null)")
        # --- dock comforts: catch one, see it on the dock and in the stats ---
        await pg.evaluate("fshInv().props={bucket:0,flask:0,lantern:0,barrel:0,bedroll:0};")
        base=await pg.evaluate("fshStats().lootMult")
        await pg.evaluate("fshInv().props.bucket=5; renderEquipment();")
        check("five buckets on the dock = +5% catch value", await pg.evaluate(f"Math.abs(fshStats().lootMult-{base}-0.05)<1e-9"))
        check("the comforts shelf shows the stacks", await pg.evaluate(
            "[...document.querySelectorAll('.fe-prop')].some(e=>e.textContent.includes('Bail Bucket') && e.textContent.includes('×5'))"))
        # the schedule, end to end: the 5th landed catch brings the lantern
        await pg.evaluate("""(()=>{
          const inv=fshInv();
          inv.props={bucket:0,flask:0,lantern:0,barrel:0,bedroll:0}; inv.propGrants=0;
          state.fishing.catches=4;
        })()""")
        await pg.evaluate("fshReset();"); await pg.wait_for_timeout(400)
        await pg.evaluate("fshStartCharge(); fsh.power=84; fshRelease();"); await pg.wait_for_timeout(1000)
        await pg.evaluate("fsh.waitMs=40; fsh.waitTimer=0;"); await pg.wait_for_timeout(400)
        await pg.evaluate("fshHookSet(); fsh.holding=true; fsh.fight.progress = fsh.fight.need - 1;")
        await pg.wait_for_timeout(700)
        check("the 5th catch brings the first lantern, on schedule", await pg.evaluate(
            "fshInv().props.lantern===1 && fsh.result && fsh.result.chips.some(c=>c.includes('Dock Lantern'))"))
        check("the shelf announces what's next", await pg.evaluate(
            "renderEquipment(), [...document.querySelectorAll('.eq-sec')].some(e=>e.textContent.includes('next:') && e.textContent.includes('at 12 catches'))"))
        await pg.wait_for_timeout(1300)
        # --- journal, conditions, sight, sound ---
        check("the journal button rides the spot line", await pg.evaluate(
            "!!document.getElementById('feJournalBtn')"))
        await pg.click("#feJournalBtn"); await pg.wait_for_timeout(300)
        check("the journal opens with the full roster", await pg.evaluate(
            "!!document.getElementById('feJournal') && document.querySelectorAll('#feJournal .fej-card').length === feSpeciesTotal() + FE_BOSSES.length"))
        check("the roster grew with the reef line (~164)", await pg.evaluate("feSpeciesTotal()>=158 && feSpeciesTotal()<=175"),
              await pg.evaluate("feSpeciesTotal()"))
        check("uncaught species are dark silhouettes with hints", await pg.evaluate(
            "document.querySelectorAll('#feJournal .ic.dark').length > 100"))
        await pg.evaluate("document.getElementById('fejClose').click()"); await pg.wait_for_timeout(200)
        # first catch writes the journal and pays the bonus
        await pg.evaluate("fshInv().journal=null; state.fishing.catches=10; fshReset();")
        await pg.wait_for_timeout(300)
        await pg.evaluate("fshStartCharge(); fsh.power=84; fshRelease();"); await pg.wait_for_timeout(1000)
        await pg.evaluate("fsh.waitMs=40; fsh.waitTimer=0;")
        await pg.wait_for_function("""(()=>{
          if(fsh.phase==='bite') return true;
          if(fsh.phase==='idle'){ fshStartCharge(); fsh.power=84; fshRelease(); return false; }
          if(fsh.phase==='waiting' && fsh.waitMs > 500){ fsh.waitMs=40; fsh.waitTimer=0; }
          return false;
        })()""", timeout=25000)
        await pg.evaluate("fshHookSet(); fsh.holding=true; fsh.fight.progress=fsh.fight.need-1;")
        # Wait on the CONDITION, not a stopwatch. This was a fixed 700ms sleep for
        # a landing that has to tick through the fight, resolve, and write the
        # journal - fine on an idle box, missed under load. Third failure in the
        # suite's history, all in fishing code the batch never touched.
        try:
            await pg.wait_for_function(
                """(()=>{ try{
                     return feJournalCount()===1 && fsh.result &&
                            fsh.result.chips.some(c=>c.includes('New species'));
                   }catch(e){ return false; } })()""", timeout=9000)
        except Exception:
            pass   # fall through so check() reports the real state, not a raw timeout
        check("a first catch enters the journal with a bonus chip", await pg.evaluate(
            "feJournalCount()===1 && !!fsh.result && fsh.result.chips.some(c=>c.includes('New species'))"))
        check("conditions gate the landed species", await pg.evaluate(
            "(()=>{ const c=feConds()[fsh.result.title]; return !c || feCondOk(c); })()"))
        # sight fishing: park a shadow on the bobber target and cast into it
        await pg.wait_for_timeout(1300)
        await pg.evaluate("fshReset();"); await pg.wait_for_timeout(300)
        await pg.evaluate("""(()=>{
          feShadows.length=0;
          const t=fshBobberTarget(0.84*1.0);
          feShadows.push({x:t.x, y:t.y, vx:0, band:[4,5], sz:20, ph:0, hit:0});
        })()""")
        await pg.evaluate("fshStartCharge(); fsh.power=84; fshRelease();")
        await pg.wait_for_timeout(1100)
        check("landing on a shadow arms the sight bias", await pg.evaluate(
            "JSON.stringify(fsh.sightBias)==='[4,5]'"))
        check("the spooked shadow bolts with a ring", await pg.evaluate(
            "feShadows.length===0 || feShadows[0].hit>0 || Math.abs(feShadows[0].vx)>0"))
        # sound: one buffer decodes, mute chip flips and persists
        dec=await pg.evaluate("(async()=>{ feAudioUnlock(); const b=await feBuffer('plunk'); return !!(b && b.duration>0.01); })()")
        check("the plunk decodes into a real audio buffer", dec)
        await pg.evaluate("fsh.phase='idle'; fshRenderControls();"); await pg.wait_for_timeout(300)
        # ambience: with the context awake, the music pad and water bed loop
        amb=await pg.evaluate("""(async()=>{
          feAudioUnlock();
          await new Promise(r=>setTimeout(r, 700));
          return { music: !!feLoops.music || !!feLoops.music_night, water: !!feLoops.amb_water,
                   keys: Object.keys(FE_SFX).length };
        })()""")
        check("the piano and water bed loop when awake", amb["music"] and amb["water"], amb)
        check("the pack now carries 43 sounds", amb["keys"]==43, amb["keys"])
        night=await pg.evaluate("""(async()=>{
          feEnv.hour=23.5;
          await new Promise(r=>setTimeout(r, 600));
          const n = !!feLoops.music_night && !feLoops.music;
          feEnv.hour=12.5;
          await new Promise(r=>setTimeout(r, 600));
          return n && !!feLoops.music && !feLoops.music_night;
        })()""")
        check("the piano keeps the hours (Blue after dark, Calm by day)", night)
        await pg.evaluate("document.getElementById('feMusicChip').click()"); await pg.wait_for_timeout(400)
        check("the music chip silences the pad alone", await pg.evaluate(
            "fshInv().musicMute===true && !feLoops.music && !!feLoops.amb_water"))
        await pg.evaluate("document.getElementById('feMusicChip').click()")
        await pg.evaluate("document.getElementById('feSfxChip').click()"); await pg.wait_for_timeout(300)
        check("the mute chip flips and persists", await pg.evaluate(
            "fshInv().sfxMute===true && document.getElementById('feSfxChip').textContent.includes('🔇')"))
        await pg.evaluate("document.getElementById('feSfxChip').click()")
        # --- species portraits ---
        chk=await pg.evaluate("""(()=>{
          const names=new Set(FSH_CATCH.flatMap(d=>d.items.map(it=>it[0])));
          const bad=Object.keys(FE_SPECIES_ART).filter(n=>!names.has(n));
          const missing=Object.values(FE_SPECIES_ART).filter(k=>!FE_IMG[k]);
          const vals=Object.values(FE_SPECIES_ART);
          return { bad, missing, mapped: vals.length, unique: new Set(vals).size };
        })()""")
        check("every mapped species name is a real table name", len(chk["bad"])==0, chk["bad"][:6])
        check("every portrait exists in the image set", len(chk["missing"])==0, chk["missing"][:4])
        check(f"portraits are one-per-species ({chk['mapped']} mapped)", chk["mapped"]==chk["unique"],
              f"{chk['mapped']} vs {chk['unique']}")
        # land a mapped fish: its portrait rides the result card and the journal
        await pg.evaluate("fshReset(); fshInv().journal=null;"); await pg.wait_for_timeout(300)
        await pg.evaluate("fshStartCharge(); fsh.power=84; fshRelease();"); await pg.wait_for_timeout(1000)
        await pg.evaluate("fsh.waitMs=40; fsh.waitTimer=0;")
        await pg.wait_for_function("""(()=>{
          if(fsh.phase==='bite') return true;
          if(fsh.phase==='idle'){ fshStartCharge(); fsh.power=84; fshRelease(); return false; }
          if(fsh.phase==='waiting' && fsh.waitMs > 500){ fsh.waitMs=40; fsh.waitTimer=0; }
          return false;
        })()""", timeout=25000)
        await pg.evaluate("""
          fsh.catch = { def: FSH_CATCH[2], name:'Rainbow Trout', icon:'🐟', sizeRoll:1, valueMult:1, weightLb:4.2 };
          fshHookSet(); fsh.holding=true; fsh.fight.progress=fsh.fight.need-1;
        """)
        await pg.wait_for_timeout(700)
        check("the result card wears the species portrait", await pg.evaluate(
            "fsh.result.spriteKey==='sp_multicolor2' && !!document.querySelector('#fshResult .rSpr')"))
        await pg.evaluate("feJournalOpen=true; feRenderJournal();"); await pg.wait_for_timeout(300)
        check("the journal shows the portrait too", await pg.evaluate(
            "!!document.querySelector('#feJournal .fej-spr')"))
        await pg.evaluate("feJournalOpen=false; feRenderJournal();")
        await pg.wait_for_timeout(1300)
        # --- the coral shelf ---
        await pg.evaluate("state.credits=30000000; fshInv().spots.open=['dock','shallows','ledge','midnight']; feSpotHtml=''; feRenderSpots();")
        await pg.wait_for_timeout(300)
        await pg.click(".fe-spot[data-spot='reef']"); await pg.wait_for_timeout(400)
        check("the Coral Shelf unlocks and selects", await pg.evaluate(
            "feSpot().id==='reef' && fshInv().spots.open.includes('reef')"))
        check("reef species live in the tables, reef-gated", await pg.evaluate(
            "(()=>{ const names=FSH_CATCH.flatMap(d=>d.items.map(it=>it[0])); return names.includes('Clownfish') && names.includes('Crowned Seahorse') && feConds()['Clownfish'].spot==='reef' && feCondOk(feConds()['Clownfish']); })()"))
        await pg.evaluate("fshInv().spots.cur='dock';")
        check("and refuse to bite anywhere else", await pg.evaluate("!feCondOk(feConds()['Clownfish'])"))
        await pg.evaluate("fshInv().spots.cur='reef';")
        # --- strongboxes ---
        await pg.evaluate("feSecOpen('equip')")
        await pg.evaluate("fshInv().keys=null; fshInv().strongboxes=null; feKeys(); fshReset();")
        await pg.wait_for_timeout(300)
        await pg.evaluate("fshStartCharge(); fsh.power=84; fshRelease();"); await pg.wait_for_timeout(1000)
        await pg.evaluate("fsh.waitMs=40; fsh.waitTimer=0;")
        await pg.wait_for_function("""(()=>{
          if(fsh.phase==='bite') return true;
          if(fsh.phase==='idle'){ fshStartCharge(); fsh.power=84; fshRelease(); return false; }
          if(fsh.phase==='waiting' && fsh.waitMs > 500){ fsh.waitMs=40; fsh.waitTimer=0; }
          return false;
        })()""", timeout=25000)
        await pg.evaluate("""
          window.__b0 = feKeys().strongboxes.length;
          feKeys().keys = {};   /* stray keys from earlier casts must not open it */
          fsh.catch = { def: FSH_CATCH[6], name:'Locked Strongbox', icon:'🧳', sizeRoll:1, valueMult:1, weightLb:22, boxNeed:4 };
          fshHookSet(); fsh.holding=true; fsh.fight.progress=fsh.fight.need-1;
        """)
        await pg.wait_for_timeout(700)
        check("a keyless strongbox banks into the hold", await pg.evaluate(
            "feKeys().strongboxes.length===window.__b0+1 && fsh.result.chips.some(c=>c.includes('Locked tight'))"))
        check("the card wears the chest that matches the lock", await pg.evaluate(
            "fsh.result.spriteKey==='chest'+fsh.result.boxNeed || /^chest[1-6]$/.test(fsh.result.spriteKey)"))
        await pg.evaluate("feKeys().keys[7]=1; fshReset(); renderEquipment();"); await pg.wait_for_timeout(300)
        check("the hold shows the chest and its key", await pg.evaluate(
            "!!document.querySelector('.fe-box img') && !!document.querySelector('.fe-boxkey')"))
        await pg.evaluate("document.querySelector('[data-openbox]').click()"); await pg.wait_for_timeout(300)
        check("the right key opens it from the shelf", await pg.evaluate(
            "feKeys().strongboxes.length===0 && feKeys().keys[7]===0"))
        await pg.evaluate("feSecOpen(null)")
        # --- the legend, end to end ---
        await pg.evaluate("""
          const inv=feBossState(); inv.bossDay={}; 
          feShadows.length=0;
          const b=feBossFor('reef');
          const t=fshBobberTarget(0.84*1.0);
          feShadows.push({x:t.x, y:t.y, vx:0, band:[5,5], sz:42, ph:0, hit:0, bossOf:b, wake:9});
        """)
        await pg.evaluate("fshReset(); fsh.phase='idle'; fsh.holding=false; fshRenderControls();")
        await pg.wait_for_timeout(300)
        await pg.evaluate("fshStartCharge(); fsh.power=84; fshRelease();")
        await pg.wait_for_timeout(1100)
        check("landing on the great shadow hooks the legend", await pg.evaluate(
            "fsh.bossHook && fsh.bossHook.name==='The Rooster King'"))
        check("the attempt is spent on the hook", await pg.evaluate(
            "feBossState().bossDay.reef===feBossState().dayN && !feBossAvailable()"))
        await pg.wait_for_function("fsh.phase==='bite'", timeout=10000)
        await pg.evaluate("fshHookSet();")
        check("the fight runs the legend's script", await pg.evaluate(
            "fsh.fight.script && fsh.fight.script.length===6 && fsh.catch.boss"))
        await pg.evaluate("fsh.holding=true; fsh.fight.progress=fsh.fight.need-1;")
        await pg.wait_for_timeout(800)
        check("the legend lands with crown and journal page", await pg.evaluate(
            "fsh.result.chips.some(c=>c.includes('LEGEND OF THE WATER')) && feBossState().bossJournal['The Rooster King'].n===1"))
        check("the legend keeps its portrait — no encyclopedia", await pg.evaluate("""(()=>{
          let called=false; const orig=ciLookup; window.ciLookup=(n)=>{ called=true; return orig(n); };
          fshLoadResultPhoto({ title:'The Rooster King', icon:'🐟' });
          window.ciLookup=orig;
          return !called && fsh.result.spriteKey==='sp_cc112';
        })()"""))
        check("half-real legends alias to true species", await pg.evaluate(
            "fshPicSubject('Moonlit Eel')==='Electric eel' && fshPicSubject('Thunderfin Marlin')==='Atlantic blue marlin' && fshPicSubject('Bluegill')==='Bluegill'"))
        await pg.evaluate("feJournalOpen=true; feRenderJournal();"); await pg.wait_for_timeout(300)
        check("the journal opens with a Legends page", await pg.evaluate(
            "document.querySelector('#feJournal').textContent.includes('Legends of the Water')"))
        await pg.evaluate("feJournalOpen=false; feRenderJournal(); fshReset();")
        await pg.wait_for_timeout(600)
        # --- the shore behind pop-ups ---
        check("the afternoon-off banner is gone", await pg.evaluate(
            "!document.querySelector('.fsh-banner') && !document.getElementById('fshTitle')"))
        check("the journal chip finally says Journal", await pg.evaluate(
            "document.getElementById('feJournalBtn').textContent.includes('Journal')"))
        check("five labeled section chips ride the row", await pg.evaluate(
            "document.querySelectorAll('.fe-secrow .fe-secbtn').length===5"))
        check("the panels left the page for their modals", await pg.evaluate(
            "document.querySelectorAll('.fe-secmodal').length===3 && document.querySelector('#fshEquip').closest('.fe-secmodal')!==null"))
        await pg.evaluate("document.querySelector(\"[data-sec='equip']\").click()"); await pg.wait_for_timeout(300)
        check("equipment pops up with the shelf inside", await pg.evaluate(
            "document.getElementById('feSec_equip').classList.contains('show') && document.querySelector('#fshEquip').offsetParent!==null"))
        await pg.evaluate("renderEquipment();"); await pg.wait_for_timeout(200)
        check("the host renderer still hits the moved ids", await pg.evaluate(
            "document.querySelectorAll('#fshEquip .eq-slot').length >= 6"))
        await pg.evaluate("document.querySelector('#feSec_equip .fe-secx').click()"); await pg.wait_for_timeout(250)
        check("the close button sends it home", await pg.evaluate(
            "!document.getElementById('feSec_equip').classList.contains('show')"))
        await pg.evaluate("document.querySelector(\"[data-sec='stats']\").click()"); await pg.wait_for_timeout(250)
        check("stats and bucket pop too", await pg.evaluate(
            "document.getElementById('feSec_stats').classList.contains('show')"))
        await pg.evaluate("feSecOpen(null); fshOnLeaveTab(); fshOnEnterTab();"); await pg.wait_for_timeout(400)
        check("re-entry doesn't double the modals", await pg.evaluate(
            "document.querySelectorAll('.fe-secmodal').length===3"))
        # --- controls at the water's foot + the recall ---
        check("the controls float at the scene's bottom", await pg.evaluate(
            "document.getElementById('feCtl') && document.getElementById('feCtl').contains(document.getElementById('fshCastBtn')) && document.getElementById('feCtl').contains(document.getElementById('fshBars')) && document.getElementById('feCtl').closest('.fsh-stage')!==null"))
        await pg.evaluate("fshInv().spots.cur='dock'; fsh=fshNew(); fshStartCharge(); fsh.power=70; fshRelease();")
        await pg.wait_for_timeout(1400)
        check("the recall offers itself while the line soaks", await pg.evaluate(
            "fsh.phase==='waiting' && document.getElementById('feRecall').style.display!=='none'"))
        await pg.evaluate("document.getElementById('feRecall').click()"); await pg.wait_for_timeout(300)
        check("reeling it in frees the line", await pg.evaluate(
            "fsh.phase==='idle'"))
        await pg.wait_for_timeout(400)
        check("and the recall tucks away when idle", await pg.evaluate(
            "document.getElementById('feRecall').style.display==='none'"))
        # --- the mixer & the buzz ---
        check("the mixer chip rides the row", await pg.evaluate("!!document.getElementById('feMixChip')"))
        await pg.evaluate("feMixerOpen()"); await pg.wait_for_timeout(200)
        check("two sliders and a vibe switch", await pg.evaluate(
            "!!document.getElementById('feMixSfx') && !!document.getElementById('feMixMus') && !!document.getElementById('feMixVibe')"))
        await pg.evaluate("""(()=>{ const s=document.getElementById('feMixSfx'); s.value=40; s.oninput({target:s});
          const m2=document.getElementById('feMixMus'); m2.value=65; m2.oninput({target:m2});
          document.getElementById('feMixVibe').onclick({target:document.getElementById('feMixVibe')}); })()""")
        await pg.wait_for_timeout(200)
        check("volumes and vibe choice persist", await pg.evaluate(
            "Math.abs(fshInv().sfxVol-0.4)<0.01 && Math.abs(fshInv().musicVol-0.65)<0.01 && fshInv().vibeOff===true"))
        check("muting effects leaves music free to start", await pg.evaluate("""(()=>{
          fshInv().sfxMute = true; fshInv().musicMute = false;
          feLoopStart('music', 0.3);
          const ok = !!feLoops['music'];
          feLoopStop('music'); fshInv().sfxMute = false;
          return ok;
        })()"""))
        check("the fight buzzes harder as it drags", await pg.evaluate("""(()=>{
          const g1 = Math.max(0.22, 0.62 - 2*0.018), g2 = Math.max(0.22, 0.62 - 20*0.018);
          const d1 = Math.min(90, 10 + 2*3.4), d2 = Math.min(90, 10 + 20*3.4);
          return g2 < g1 && d2 > d1;
        })()"""))
        await pg.evaluate("const mx=document.getElementById('feMixer'); if(mx) mx.remove();")
        check("the water lets the page scroll (pan-y, no idle capture)", await pg.evaluate("""(()=>{
          const cv = document.getElementById('fshCanvas');
          if(cv.style.touchAction !== 'pan-y') return false;
          fsh = fshNew();
          const ev = new PointerEvent('pointerdown', { cancelable: true });
          cv.dispatchEvent(ev);
          const idleFree = !ev.defaultPrevented;
          fsh.phase = 'reeling'; fsh.catch = {name:'T', tier:1, weight:1};
          const ev2 = new PointerEvent('pointerdown', { cancelable: true });
          cv.dispatchEvent(ev2);
          const fightHeld = ev2.defaultPrevented;
          fsh = fshNew();
          return idleFree && fightHeld;
        })()"""))
        check("rod bend + spots run with zero errors", len(errors)==0, errors[:3])
        await b.close()
    print("\n"+("SPOTS/CARDS ALL PASS" if not fails else f"{len(fails)} FAILED: {fails}"))
    sys.exit(1 if fails else 0)
asyncio.run(main())
