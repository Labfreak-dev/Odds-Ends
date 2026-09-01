# The Fishing Rebuild — living scene + real fight

## How it integrates
`modes/fishing2.module.js` is an **override module**: it is injected into the
same script as the original dock code, after it. Later `function` declarations
win (last-wins hoisting), so exactly 12 fsh* functions are redefined — the set
is allowlisted and enforced by `docs/check-globals.js`. No `let`/`const` from
the host is redeclared (new globals use the collision-checked `fe` prefix).
The painting, shop, skills, gear, bait, charms, cast, catch table, photos,
log and result flow are untouched host code.

**Trap that shaped the design:** a wrapper like
`const old = fshOnEnterTab; function fshOnEnterTab(){ old(); }` captures
*itself* under last-wins hoisting. Every override is a full replacement.

## The living scene
- **Clock**: a full day in 8 real minutes (`FE_DAY_SECONDS`), persisted at
  `state.fishing.env` so time continues between sessions.
- **Weather**: Markov machine (clear/overcast/drizzle/fog/storm; storms only
  arrive from overcast or drizzle) with 6-second palette blends.
- **Palette**: `fePalette(hour, weather)` is pure — keyframed multiply tint,
  warm overlays, star/moon/sun/fog/rain levels. The whole painted scene is
  colour-graded through the tint; the painting's own baked-in sun is damped
  by a targeted multiply radial whenever the sky disagrees (night, storm).
- **Ambient life**: gulls with a fly/dive/float/takeoff state machine (they
  roost at night), distant jumping fish (busiest at dawn/dusk), a horizon
  boat with a lantern after dark, dragonflies at golden hour, fireflies at
  night, foreground reeds answering a gust-driven wind, rain rings, and
  lightning during storms.
- **Anticipation**: a shadow glides under the bobber ~0.9s before the bite.

## The fight
Hold to reel, release to give line. Pure core (`feFightNew`/`feFightStep`),
archetypes by tier: debris, darter, runner, diver, brute, **acrobat** (jumps:
telegraph → airborne → slack you must reel), anchor (treasure wedges).
- Tension chases a load target; **giving line caps the fish's force at
  0.58×max** (that's what drag is). Without the cap, a running Epic exceeded
  mid-tier max tension and was unwinnable with perfect play — the bot sim
  caught it.
- Stamina wears down under load; each **winded** cycle permanently saps
  aggression (0.76^winded on run/jump weights) and lengthens tired windows,
  so long fights accelerate to a finish. Slack >3s slips the hook.
- Old gear stats map across: `reelPower = tapPower×1.55`,
  `reelLoad = 30 + tapPower×0.75`; maxTension/decay direct.

## Proof (docs/)
- `test-fishing.js` — palette validity/continuity, weather-table conformance,
  and bot-simulated landability: smart hands land every tier with prescribed
  gear (Legendary 69% with maxed gear — legends should escape sometimes),
  greedy holding snaps, never holding slips, gear strictly helps
  (Legendary 1%→69% starter→maxed), jumps telegraph first, holding an
  airborne fish punishes the line.
- `smoke-fishing.py` — five graded skies screenshotted, liveliness (frames
  differ), full fight in-browser (hook→reel→give line→snap / land), result
  card shows "Worn out ×N", touch hold works on mobile.

## Batch 2 (shipped)
**Spots** — four waters as honest trades, stated on the card: The Old Dock
(free, balanced) · Reedy Shallows (120k: bites 25% faster, junk-heavy,
treasure ×1.6) · Deepwater Ledge (900k: Rare/Epic ×~1.8, slower bites,
fights ×1.12) · The Midnight Mark (5M: Legendary ×1.6, ×2.6 **after
dark** — the day/night clock as gameplay). Switch at idle or on the
result card; buying is one tap when affordable. Fight difficulty scales
with the spot (`sp.fight` on pull/strain); payouts use the true def.

**Tide & Tackle** — every landed catch can pull from the 1,000-card
fishing line (`poolByCategoryTier`-compatible, granted with the same
owned/unique-tier/mining rules as packs). Chance by tier
5/10/20/50/100/100/100%, card-tier bands per catch tier, and a 65%
subject match: catch a Rainbow Trout, pull a Rainbow Trout print
(56 species match directly + a curated honest-alias map — Steelhead→
Rainbow Trout, Tiger Muskie→Muskellunge). **Mythic window**: a Legendary
landed after dark has 3% (6% at the Mark) to reach the t13–15 plates,
overriding the subject line. Result card shows the pull and your
`🎴 N/1000` progress; owned one-of-a-kinds never drop twice.

**Rod bend** — the rod now bends with live tension (14 + t×46 arc), not
just by phase. Stale tap-era copy across the host (blurb, skill stats,
stat line) retired via exactly-once integrate anchors.

Proof: `test-fishing.js` spots + Tide & Tackle sections (distribution
shifts per spot, night water at the Mark, bands, subject match, mythic
night-only, unique-tier dedupe) and `smoke-spots.py` in-browser (picker,
unlock economics, mid-cast lockout, card chips).

## Batch 3 (shipped) — playtest fixes + the sprite packs
**Immersion fixes**: stars now respect the painted ridge line (silhouette
sampled from the painting at build time into `FE_RIDGE`, one point per
8px — no star below it); the painting's baked-in sun is fully damped at
night with a second deep-night multiply pass; jumping fish travel
nose-first (source art faces left; rightward travel flips).

**Sprite packs** (`modes/fishing-assets.module.js`, 91 images, scaled +
quantized at build): 
- *Rod art*: your equipped rod IS the uploaded pole art — bare hands t1
  through Heirloom t6, and the t7 pole for a maxed rod with maxed
  Casting Technique. The sprite is pre-rotated to a horizontal strip
  (shaft axis auto-detected from alpha extremes) and drawn in 12 slices
  along the live bend, so the art itself flexes under tension. Along-axis
  scale fits gameplay length; perpendicular is squashed 0.42× so the
  icon-proportioned art reads as a rod, not a club; the source window
  tapers toward the tip to shed the painted dangling line.
- *Jumpers* use real fish sprites (rare sharks), plus a rare dolphin
  breach every few minutes.
- *Catch reveal*: the hooked creature's sprite (class by icon —
  fish/shark/whale/squid/crab/chest/bag/gem/medallion, tier by catch
  tier `[1,1,2,4,5,7,6]`) appears mid-air on jumps and on the result
  card (landed, snapped, and got-away).
- Not used: the Beowulf pack (pixel art clashes with the painted scene)
  and the seahorse/key/hook/lure sets (no natural home yet — candidates
  for a future reef spot and shop icons).

**Aquatic-only cards**: Tide & Tackle pulls are filtered to fish and
things of the water (58-subject blocklist removes bait, tackle, boats,
buildings, shore gear; sunken artifacts and sea-myths stay). Bands start
at t2 (t0-1 of the set is all bait), and an empty band widens one tier
at a time — never leaping to the whole pool.

## Batch 4 (shipped) — mobile playtest round
**Spot picker relocated + phase-gated**: it now sits BELOW the fight
bars and hides itself entirely outside idle/result, so on a phone the
tension/stamina/mood readout owns the space under the cast button
mid-fight. The in-handler phase guard stays as defense-in-depth.

**Spots now dress the scene** (they were odds-only; the user rightly
called it): each water carries a `dress` block — its own multiply tint,
reed count/banks, gull count, jumper rate and sprite pool. The Shallows
run green with reeds on both banks, lily pads (some flowering) and
double dragonflies; the Ledge is cold blue, bare of reeds, foggier,
with big sharks/whales jumping rarely; the Mark leans violet with
brighter stars and will-o'-wisps over the water after dark. Switching
spots re-inits the ambient dressing immediately.

**Training lives on the gear**: `renderEquipment` is overridden (added
to the globals allowlist) — every slot card carries its skill (pips +
train button with live cost, level gate, or MAX): Casting Technique on
the rod, Reeling Strength on the reel, Line Control, Hook Setting, Fish
Sense, Grip Training, and Endurance on all three outfit pieces; Bait
Craft on the bait shelf and Haggling by the ledger. Slot cards became
divs so buttons can nest; train clicks stopPropagation so the picker
doesn't open underneath. The Upgrades tab keeps its copy.

## Batch 5 (shipped) — "it's not casting" + "impossible to reel in"
**Mobile casting was being killed by thumb wobble.** True-touch (CDP)
reproduction showed a held cast dying to a scroll-intent pointercancel
after a few pixels of touchMove — the cast button and canvas never set
`touch-action` or captured the pointer. Fix: `touch-action:none` +
`setPointerCapture` on both. A wobbling hold now charges through (the
same fix stops mid-fight wobble from silently giving line). Separately,
a quick TAP used to release at power≈0 — a dud cast that still burned
bait via `fshConsumeOnCast()`. `fshRelease` is overridden (allowlisted):
below power 8 it cancels back to idle with a "Hold to charge" hint, no
bait burned, no cast counted.

**"Impossible to reel in" was the balance cliff, ended honestly.** An
Epic on starter tackle was mathematically unwinnable and ground to the
150s failsafe. Fights now carry pace checkpoints: a grace period, then a
rising progress bar; miss it and the fight ends. The ramp splits on par
(`reelPower < need/28`): under-par gear resolves fast (worst <70s, mean
<55s) with an "It was too strong — train Reeling Strength / buy a
stronger reel" card; at-par gear keeps a generous tier-scaled runway and
a plain "shook the hook" loss. Sim-proved: starter-vs-Epic 100%
overpowered; mid-vs-Epic and maxed-vs-Legendary see zero false
positives (99% / 69% land, unchanged); slack-slip still fires first for
idle hands.

## Batch 6 (shipped) — visible upgrades + dock comforts
**"Gear doesn't show" root-caused**: rod upgrades WERE live, but the
perpendicular squash was cropping out the reel — the one part that
visibly differs tier to tier — so adjacent shafts read alike. The reel
is now auto-detected per pole (densest below-axis blob in the grip
region, `FE_ROD_REEL`) and drawn whole and unsquashed at its true spot
on the bend. All six equip states hash pairwise-distinct in-browser.
Hat bands, line colors and bobber skins were already live host behavior.

**Dock Comforts** (5 new packs, 35 sprites): Bail Bucket, Warming Flask,
Dock Lantern, Catch Barrel, Dockside Bedroll live on the dock over the
painted originals. Any landed catch has a 3.5%+1%/tier chance to haul
one up; the least-stacked comfort surfaces first. Each catch stacks a
PERMANENT boost (bucket +1% value, flask +0.5/s recovery, lantern +0.06
luck, barrel +2 max tension, bedroll −1% wait) via an `fshStats`
override (allowlisted); displayed art tier = min(7, stacks), boosts
never cap. The lantern casts a warm glow on the dock after dark. A
"Dock Comforts" shelf on the equipment panel shows the stacks.

## Batch 7 (shipped) — the real-fish photo came back
The wiki photo on the catch card had silently died for long-time saves.
Root cause in host `ciLookup`: a NETWORK failure cached a 90-day miss —
one offline or flaky session permanently killed photos for every species
caught during it. Fixed via exactly-once anchors on the host (shared
with card-info, so both heal): misses now expire in 2 hours (stale
poisoned caches self-heal on the next catch of that species), hard
network failures cache nothing at all, genuine no-such-article results
still cache their (short) miss, and `ciLookup`/`fshPrefetchPic` guard
against undefined subjects. Proven in `docs/smoke-photos.py` with a
seeded 3-hour-old poisoned cache and a mocked offline round-trip.

## Batch 8 (shipped) — comforts on a schedule
The dock comforts moved from a dice roll to a readable trickle: grant #k
arrives at exactly `round(5·k^1.25)` total landed catches — 5, 12, 20,
28, 37 … the full 35-grant dock lands around catch 420, and the trickle
never stops past tier 7 (boosts stack forever). The order is fixed:
lantern → bucket → flask → bedroll → barrel, one lap per tier, so catch
#5 is ALWAYS the first lantern. At most one grant per landed catch, so
legacy saves that are behind schedule catch up one dock piece per catch;
stacks earned under the old random system count toward the schedule
(`propGrants` seeds from their sum). The Dock Comforts shelf announces
what's coming: "next: 🪣 Bail Bucket at 12 catches (5 so far)".

## Batch 9 (shipped) — true replacement + the showpiece lantern
The painted dock items are now genuinely REPLACED, not overdrawn: each
comfort carries an `erase` footprint that clone-stamps the painted
original away with a clean same-row strip of the painting itself (local
adjacent strips, so the water banding matches seamlessly) before the
sprite draws. Reassignments so every low-quality painted item has a
successor: bucket→Bail Bucket, red thermos→Warming Flask, food tin→
Dock Lantern (front and center), paper stack→Catch Barrel; the tackle
box stays. Iterated against artifacts: the bucket's handle arc and the
thermos's below-lip base needed taller rects, and a distant clone source
left a brightness seam fixed by sampling the adjacent 8px strip.

The lantern is the showpiece now: bigger (w23, growing ~1px per tier),
a glass glint by day, and from dusk on a flickering warm glow that
scales with its tier, a bright flame core drawn over the night tint, a
light pool on the planks, and sparks drifting up in deep night.

## Batch 10 (shipped) — big props, drop celebrations, photo diagnosis
**Props at real scale**: barrel 26→44 (a barrel, not a cup), bedroll 40,
bucket 36, lantern 32 (+1.4/tier), flask 24 — re-spread across the dock
(bedroll · bucket · flask · lantern · box · barrel) with natural
front-overlaps. Erase footprints unchanged (they cover the painted
originals wherever the sprites sit).

**Escalating drop celebrations** (`fePropFx`, armed on grant, plays the
moment the dock is back in view after the result card): tier 1 pops with
an elastic scale-bounce and a shake; tier 2+ adds an expanding shine
ring; tier 3+ golden spark bursts with gravity, more per tier; tier 5+
six turning light beams; tier 7 a full golden starburst. The light show
draws AFTER the day/night grade so it blazes at midnight.

**Photos, round two**: a found article WITHOUT a thumbnail was cached as
a 90-day hit with `img:""` — invisible to the miss fix. Img-less hits
now share the 2-hour TTL. And the card finally has a voice: when the
lookup comes back empty, a small "📷 no photo — offline or wikipedia
blocked" caption appears under the sprite, so a player with working
internet who still sees it knows something in their setup blocks
wikipedia.org and can report exactly that. (Real-network verification is
impossible from the build sandbox; every cache/DOM behavior is proven
with mocked fetch in `docs/smoke-photos.py`.)

## Batch 11 (shipped) — the dock, redrawn
The per-item clone patches read as pasted rectangles at phone zoom, so
the whole shelf is now REBUILT as one piece the moment the first comfort
lands (`feRedrawDockBand`): the water behind the items is a single clean
slice of the painting stretched wide (horizontal banding smears smooth —
tiling narrow slices combed badly, and a wide open-water block carried
hill reflections), sampled beside the band's right edge so the seam tone
matches by construction; the dock itself is procedurally redrawn in the
painting's palette — lit rim, planked deck with sparse seams, fascia
beam, a railed front with the lake showing between the posts, bottom
stringer. Every painted item is swept (tackle box included). The five
comforts sit on ONE baseline (y296, 2px over the rim) with contact
shadows, spread bedroll · bucket · flask · lantern · barrel. The band's
right edge lands where the fisherman masks it.

Build hygiene: the uploads mount hiccupped mid-build, so the pristine
source is cached at `/home/claude/source-pristine.html` and integrate.py
prefers it (uploads as fallback). The flaky weather-variety test is now
seeded.

## Batch 11b — the redrawn dock is unconditional
The band originally activated only once the first comfort existed, so a
save with zero comforts still showed the old painted clutter — exactly
what the playtester saw. The redraw is now unconditional: the dock
starts clean and bare, and the schedule furnishes it. Going bare also
exposed a 0.8px sliver between the rim's bottom (288.2) and the deck's
old top (289) where painted thermos pixels bled through — pixel-probed,
closed by drawing the deck across the full span under the rim, and
re-verified to zero stray pixels.

## Batch 11c — grounding by measurement
The bedroll floated because its sprites carry 26.6% transparent rows at
the bottom (wide roll on a square canvas) vs ~3.5% for the other props.
Bottom-alpha padding is now measured per sprite at build time
(FE_PROP_PAD, all 35 prop images) and compensated at draw, so every
item's VISIBLE base lands exactly on the shared y296 baseline at every
tier. Shelf spacing evened out: bedroll 26 · bucket 75 · flask 116 ·
lantern 153 · barrel 205.

## Batch 12 (shipped) — sound, the journal, habits, sight fishing
**Sound** (`modes/fishing-sfx.module.js`, 36 sounds from the uploaded
120-sound pack, mono ogg, 268KB): a WebAudio engine (lazy buffer decode,
unlock on first pointerdown, throttle gaps, declarative loops, mute chip
persisted at `sfxMute`). Wired: cast (sweet/normal/backlash), bobber
plunk, pre-bite nibble, bite alert, hookset, missed-bite, the reel crank
LOOPING exactly while you hold, drag scream on runs, jump + splashdown,
dive, snag thrash, tension-rise >60%, tension-max >85%, rod creak,
give-line click, line snap, escape splashes (slip vs overpowered), land
thunk + tier fanfare (junk gets the Old Boot sting, treasure its chime),
dock-comfort chime, tackle-box/equip/bait/train/spot UI sounds, ambient
jumper ripples and the dolphin breach. Loops stop on tab leave.

**Angler's Journal**: every landed species recorded (count, best lb,
first date) at `state.fishing.journal`; first catch of a species pays
`1.2×` its top base credit with a chip and toast. The 📖 button on the
spot line opens the roster — caught species in color with stats,
uncaught as dark silhouettes with '???' and a habit hint. 148 species.

**Conditions**: ~45 species keep hours — 20 hand-picked iconics (the
Moonlit Eel after dark, the Thunderfin in storms, the Coelacanth off the
Ledge at night) plus hash-assigned time/weather habits; rolls filter by
`feCondOk` with unconditional fallback, and `feConds` enforces ≥8
unconditional species per tier (shedding conditions in stable hash order
if hand-picks ever crowd a tier). Bug found via journal screenshot: bare
"Bites" hints — `h>>4` sign-extended past 2^31 making `WX[-n]`
undefined; fixed with `>>>` + a hint guard + regression tests.

**Sight fishing**: up to three fish shadows cruise the open water while
idle/charging, each a size band ([1,2]→[4,5]). Land the bobber within
reach and the next roll multiplies that band ×2.4 ("Right on its
nose!"); the spooked shadow bolts with a gold ring. Sim: aiming more
than doubles the band's landings.

**Staged next**: boss fish — one named legend per spot, scripted
multi-phase fights, once per in-game day.

## Batch 12b — sound that survives real devices
The playtester heard nothing. Two host-independent fixes: (1) all 36
sounds re-encoded OGG→MP3 mono 56k (Safari/iOS cannot decode OGG at
all — silent failure on iPhone; MP3 decodes everywhere; 188KB vs 200KB,
a wash); (2) feBuffer no longer fetch()es the data: URI — some mobile
WebViews block that — it atob-decodes straight to bytes and feeds
decodeAudioData in BOTH promise and legacy callback forms. Bonus: the
🔊 chip now plays a click on unmute, so a player can prove their device
path in one tap. (Also: iPhone's hardware silent switch mutes WebAudio
entirely — worth telling testers.)

## Batch 12c — the mix, the stinger, the soundtrack
Volume pass: every bright/chimey sound came down (bite 0.9→0.55, hookset
0.5, tension cues 0.38/0.28, UI clicks ~0.4). Landing stinger from the
pack's unused celebration sounds: thunk → heavy slam (tier 3+) → tier
fanfare → the Perfect sting on a first catch → the full Finish on
legendary/treasure/new-best. Ambience: a synthesized soothing F-major
pad (24s swell loop, own 🎵 chip, musicMute pref) and an 11s water bed
built from the pack's own ripples, both declarative loops gated on tab +
awake context; distant synthesized gull cries every 25-65s while gulls
are in the scene. Module 558KB / 42 sounds.

## Batch 13 (shipped) — species portraits
Two uploaded packs (Captainskeleto ×24 detailed pixel fish; Tropical
Pack — each colour png is a 3×3 grid of variants: 81 fish + 9 sharks =
105 singles after slicing) give 90 species their OWN portrait, mapped by
visual accuracy (FE_SPECIES_ART): sharks to the shark species, cap19's
gaunt huge-mouthed horror to the Abyssal Anglerfish, blue2's squiggle
bars to the Atlantic Mackerel, orange7's spots to the Brown Trout,
white7's pale ornate to the Ghost Koi, yellow1's ornamental gold to the
Golden Koi. Portraits show on the RESULT CARD (all four enders prefer
feSpeciesArt over tiered class art) and in the JOURNAL (pixelated 26px
faces); the painted scene keeps tiered art — pixel fish in painted water
clashed, same reason the Beowulf pack sat out. Browser-proven: all 90
names exist verbatim in FSH_CATCH, portraits 1:1 unique, and both
surfaces render them. Billfish, gars, pikes, eels and sturgeons keep
tiered art honestly — the packs hold no elongated bodies. The third
upload (cat_crate_games) is a RAR mislabelled .zip — unreadable in this
sandbox (no unrar); ask for a true zip re-export.

## Batch 13b — the cat_crate pack lands (re-zipped from RAR)
161 naturalistic pixel fish — including every elongated body the other
packs lacked. 38 species upgraded or newly mapped after TWO rounds of
number-verified identification (the contact-grid rows were shifted; a
labeled verify strip settled every ID): Northern Pike (#121, bean
spots), Lake Muskie (#153), Longnose Gar (#4), Alligator Gar (#125),
Lake Sturgeon (#51) and Beluga Sturgeon (#106), Blue Marlin (#33),
Thunderfin Marlin (#34), Swordfish (#76 broadbill), Sailfish (#137 —
the sail!), Wahoo (#29), Giant Tarpon (#25), Great Barracuda (#79),
Mahi-Mahi (#77), Yellowfin Tuna (#32), a REAL eel for the Moonlit Eel
(#68) and the Rainbow Serpent Eel (#65), the whiskered catfishes
(Channel #16, Flathead #22, Blue #129, Wels #91), Bowfin (#42, full
dorsal), Mirror Carp (#130, scattered mirror scales), the salmon run
(Sockeye #43, King #53, Atlantic #120, Arctic Char #124), and more.
104 species now carry unique portraits (headless invariants: 1:1
uniqueness + every portrait resolves; browser: all names verbatim in
FSH_CATCH).

## Batch 13c — QA pass
Marlin-class long portraits render at full aspect (object-fit:contain).
QA caught one real UX bug: opening the journal during a result card left
it layered UNDERNEATH — the journal is now a proper fixed top-layer
modal (z-index 9999, flex column, scrollable body). The flaky
wait-for-bite smoke helper now also handles the idle phase (recasts) at
a 15s ceiling. Full sweep green.

## Batch 14 (shipped) — the Coral Shelf, keys & strongboxes, legends
**Coral Shelf** 🪸: fifth spot, 25M, turquoise dress, odds favoring the
middle tiers. 15 new species injected into FSH_CATCH at load (guard
__fe2): Clownfish, Blue Tang, Damselfish, Fusilier, Parrotfish, Queen
Angelfish, Permit, Peacock Flounder, Coral Grouper, Napoleon Wrasse,
Roosterfish, Blue Tilapia, Reef Seahorse + Crowned Seahorse (the idle
7-tier seahorse art finds its home), and a Peacock Bass guest in the
Shallows. All reef-gated via conditions (bite only there, hint says so).
Roster now 163 species / 119 with unique portraits.

**Keys & Strongboxes** 🗝️: tier-1+ catches have a 2.5% chance to snag a
tiered key; the Locked Strongbox swims in the treasure tier — with a
fitting key it opens on the spot (40-70k × need-scaled × lootMult + a
guaranteed Tide & Tackle card), otherwise it banks into the hold, opened
later from the equipment shelf (lowest-fitting key spent).

**Legends of the Water** 👑: five named bosses, one per spot — Old
Ironjaw (dock), The Marsh King (shallows, Arowana art), The Pale Hunter
(ledge, the orca-patterned red9), The Rooster King (reef, Roosterfish),
The Black Phantom (midnight, cap3's jet-black phantom). Once per
in-game day (feEnvTick day counter; attempt spent ON THE HOOK), a great
wake patrols the water — land the bobber on it and the fight follows
the legend's scripted mood pattern (learnable, winded-softened),
boss-scale pace (grace 62s, failsafe 260s). Landing pays 300k-820k,
stamps the separate bossJournal (species count stays honest), crowns
the card, and layers the full stinger. The journal opens with a
"Legends of the Water" page. Sim-tuned with an expert bot that rides
runs and harvests sulks: maxed-gear land rates Ironjaw 69% · Marsh King
82% · Pale Hunter 45% · Rooster King 69% · Black Phantom 60%; mid gear
takes Ironjaw 25%. Lesson burned in twice: boss scripts MUST contain
sulks — a sulk-less script is unlandable at any gear (0%).

## Batch 14b — chests match their keys
The uploaded chest set is byte-identical to the embedded one, so this
was a wiring batch: the strongbox's lock tier is rolled at CATCH time
(boxNeed on the catch object), the result card wears that tier's chest
art (chest1-6, ahead of species art in the spriteKey chain), and the
equipment-shelf hold shows each banked box as its chest sprite with the
best-fitting key sprite beside the Open button. Browser-proven: card
chest matches the lock, hold renders chest + key art.

## Batch 14c — the Dreams piano pack
Analyzed all 8 loop candidates programmatically (RMS, note-onset
density, spectral brightness). The two 65.4s "Calm" files are an
authored layer pair — mixed (melody 1.0 + shimmer 0.7, loudnorm
I=-24) into the DAY track. "Dreams in Blue" (169s, darkest centroid
518 Hz, 0.53 notes/s) became the NIGHT track (loudnorm I=-26). Both
kept whole as authored seamless loops, mono mp3 48k/40k (+1.2MB). The
tick chooser swaps at the light change; the 🎵 chip stops whichever
plays. The synthesized pad is retired.

Test archaeology: the recurring smoke timeouts were NOT load flakes —
the "hardened" bite-waiter re-armed waitMs/waitTimer on EVERY RAF
poll, zeroing the timer before 40ms could elapse: a self-defeating
predicate, intermittent only because poll rate varies. All waiters now
re-arm only on a fresh roll (waitMs>500). Three consecutive full passes.

## Batch 14d — music, take two
Playtester verdict on Calm/Blue: too loud, too boring. Swapped to the
pack's melodic-but-gentle pieces: Dreams in Green (0.76 notes/s, warm
676 Hz centroid — a thoughtful day on the water) and A Silent Voice
(0.45 n/s, slow and silky — the sleep-adjacent night). Normalized well
down (I=-27 / I=-30) AND in-game gains cut (0.3 day / 0.24 night).
Net size ~unchanged.

## Batch 14e — fiction stays fiction
Playtester landed The Rooster King and the wiki pipeline served a rugby
player (the search fallback found the Sydney Roosters). Fixes:
FE_PIC_SKIP (five legends + pure inventions like the Old Man, the
Leviathan, the Strongbox, the Crowned Seahorse) never touch the
encyclopedia — the loader returns before lookup and the prefetch skips;
FE_PIC_ALIAS2 maps half-real names to true species (Moonlit Eel →
Electric eel, Thunderfin Marlin → Atlantic blue marlin, Kraken
Hatchling → Giant squid, Frost Whale Calf → Beluga whale, + the reef
roster to exact article titles). And the root display bug: boss art
(c.boss.art) now HEADS the spriteKey chain, so legends wear their
portraits on every card. Browser-proven: zero ciLookup calls for a
legend, card wears sp_cc112, aliases resolve. Bonus intel from the
screenshot: the game is live on github.io and real Wikipedia photos
WORK there — the caption diagnosis closed.

## Batch 15 — The Flooded Arena, verified and delivered
The auto-battler requested (journal squad + chest items + spell-sigil
icons + dungeon arena floors) already existed on disk from a later
session that never reached the playtester: arena.module.js (fb prefix,
25KB), arena-assets.module.js (28 sigils + all 10 floors), arena.css,
test-arena.js, smoke-arena.py — fully integrated (lobby entry
'The Flooded Arena', tab-flooded, enter/leave hooks) with
feOpenStrongbox already granting armory items. This session: discarded
a freshly-drafted duplicate (ta prefix) on discovering it, ran the
complete sweep (8 node suites incl. arena bands/legends/chest tests +
6 smokes) — ALL GREEN — and confirmed the armory UI renders real item
grants correctly (an early NaN scare was malformed hand-injected
screenshot data, not the game). Feature map: journal = roster with
regex innates (Rend sharks, Pierce billfish/pikes, Soothe koi, Bulwark
catfish, Rush tuna/salmon, Jolt eels, Ambush lurkers, School default);
foods feed permanent stats, relics equip abilities; endless ring
ladder, legend every fifth ring; first clears pay 4×.

## Batch 15b — the arena earns its ropes
Playtester direction: fighters should be RARE OR BETTER, and the UI was
clunky. fbRoster now gates at tier ≥3 (legends always fight); the empty
state explains the bar. The roster wears RARITY TABS (👑 Legends /
Legendary / Epic / Rare, tier-colored, counts shown, empty tabs hide);
cards slimmed — the innate is a small tag with the full line in the
tooltip. THE ARMORY SHELVES ITSELF: Foods and Relics in separate
sections, duplicates stacked with ×counts, sorted strongest-first — no
scrolling hunt for an equip button. Tests updated to encode the gate (a
commons-only journal cannot enter; a fresh rare trio clears rings 1-4);
smoke rewritten for tab-hopping picks, shelf sections, and stack counts.

## Batch 104 — a start screen, and the menu gets its plates
Playtester handed over the second Grok chrome pack (illustrated tab plates,
play tiles, a button kit, a fishing HUD sheet) plus a new owl crest, with
the brief: "whole new menu rebuild and a new logo. I want the logo to be an
opening Start screen with a Tap to Start flashing underneath. Cards from
the game fall from the top of the screen behind the logo, in front of the
background."

THE START SCREEN. A fixed overlay (#oeStart) is in the MARKUP, before the
header, so it is the first thing painted rather than something a script
bolts on after the game has flashed past. The crest is art/ui/logo.webp,
the delivered JPG with its navy exterior flood-keyed to alpha (from the
border only, so the navy inside the oval stays), so the cards really do
pass behind the oval and not behind a rectangle. The rain is the game's
own cards: the tail script picks 10-18 subjects round-robin across the
four high-tier frame bands (9-11 red, 12-13 teal, 14 gold, 15 magenta -
random picks came out all red, tiers 9-11 being most of the pool), dresses
each in its real frame via oeFrameFor and its real painting from art/, and
lets a CSS keyframe carry it from -45vh to 115vh with a negative delay so
the sky is already full at first paint. One tap, click, Enter or Space
fades it out and removes it; the same gesture calls feAudioUnlock, so the
first tap is also the audio unlock the browser wants.

AUTOMATION. Every suite drives the page by clicking, and a full-screen
overlay would make Playwright's actionability check wait forever on every
tab button. The tail script removes the overlay when navigator.webdriver is
set (Playwright sets it) or ?nostart is in the URL; ?start=1 forces it back
on, which is how docs/smoke-start.py tests it. No inline <script> for this:
integrate.py explodes EVERY script block into its own oe-NN file, so a
one-line inline script at the top of body would have renumbered all
nineteen files.

THE MENU. The nav keeps its <i>emoji</i> markup - every renderer that
toggles .active or reads data-tab is untouched - and the plate is painted
onto the <i> as an embedded webp background with the emoji shrunk to
font-size:0. Six plates cropped from Grok's sheet (bounding boxes found by
column projection, corners flood-keyed so the sheet's navy does not show
on the nav's near-black), ~4.5KB each. Play cards get the nine tiles the
same way, keyed on data-game; the descriptions stay (Grok's css hid them).
Buttons: primary is now gold metal, secondary steel, and the brass/ghost
family is re-declared at button.btn.btn-ghost specificity so it FINALLY
wins over button.btn - the pre-existing "ghost buttons render accent blue"
bug from batch 98 is closed by this. The 10-pack pill is the gold plate.

NOT TAKEN from the pack: the fishing HUD sheet (CAST/TACKLE/BAIT/SPOTS
plates - the css only recoloured the fishing buttons and never used the
art; that is a mode restyle for its own batch), the header-logo swap (it
would replace the player's avatar badge), the blurb-hiding rules, and the
generic input/.chip restyles.

VERIFIED. New docs/smoke-start.py: 28 checks at phone and desktop (overlay
covers, crest loads, 10+ framed cards with paintings across 2+ bands,
Tap-to-Start pulses, cards move, one tap removes it, six plates, 44px nav,
gold/ghost/brass palette, nine tiles, zero errors, automation skips).
Fast suites green; long smokes green. Stamp 600304.

## Batch 103 — the shelf shows the real foil
Playtester: "change the packs to the actual pack assets on the pack shelf.
its got old placeholder text/box style." The shelf tiles still carried the
prototype's emoji-in-a-box icon while the tear overlay had been drawing the
real "Odds & Ends COLLECTIBLES PACK" foil for forty batches.

WHAT. The foil image and the per-set hue live in the ripship module
(RZ_PACK_IMG, rzHue), so the module now exports both on window
(oePackImg, oePackHue) beside oeFrameFor/oeArtSlug/oeArtMin. renderPackShelf
sets one --pack-img custom property on the shelf and renders a .pack-art
tile per pack: the foil in a 104x166 window, hue-rotated by the set's
rzHue so each pack's crimps wear the same colour they wear on the tear
overlay, with the old emoji shrunk to a 30px badge in the corner
(counter-rotated so the emoji keeps its true colours). The emoji box stays
as the fallback when the module is absent.

WHY THE RE-RENDER. The host's boot render runs before oe-12-ripship loads,
so the first paint of the shelf has no oePackImg and would show the
fallback until the next render. The module calls renderPackShelf() once at
the end of its IIFE (guarded, try/catch) so the foil lands on boot.

VERIFIED. Headless at 430 and 980px: 8/8 packs render the foil, 0
fallbacks, eight distinct hues, eight badges, zero page errors. Fast suites
green (test-fishing, cardart 13, ripship 37, backs 15, economy 29); long
smokes green (fishing visual/fight, spots 80). Stamp c1297c.

## Batch 102 — card ink goes dark: the four-colour deck, deepened
Playtester: "the colors are too bright and every card looks the same."
Both halves were my doing. The per-rank wash added last batch tinted
every tile a slightly different pastel, so they all read as the same
washed-out square, and the suit colours were PK_SCOLORS - a NEON set
picked for the old dark tiles, garish once the tile turned cream.

Rendered four palettes onto real card faces and let the playtester
pick from the image rather than a description. Chose the deepest:
wine #8f1f28, navy #17456e, forest #155230, charcoal #20242c - the
standard four-colour poker deck, deepened for cream. Rank wash gone;
a faint tint of the SUIT now sits on the tile instead, so a flush
reads as a block of colour rather than fighting the suit signal.

TWO PALETTES, ON PURPOSE. PK_SCOLORS is still used for the clear-burst
particles that fly across the DARK felt - dark navy would have
vanished there. So card faces get PK_SMASH_INK (dark, for cream) and
PK_SCOLORS stays bright (for the table). Colour follows what it sits
on; one shared palette could not serve both.
ALSO: THE SMOKE-SPOTS FLAKE, ROOT-CAUSED AT LAST. It failed a third
time this batch - "a first catch enters the journal with a bonus chip",
in fishing code a poker palette change cannot touch. Not a flake: the
test sets fsh.fight.progress = need-1 and then sleeps a FIXED 700ms
while the landing has to tick through the fight, resolve, and write the
journal. Fine on an idle box, missed under load (this run had
smoke-fishing going back-to-back on a busy container). Fixed by waiting
on the CONDITION - wait_for_function on the same expression the check
asserts, 9s cap, wrapped so a real failure still reports through
check() instead of a raw timeout. 80/80 after.
Verified: ink applied, particles still bright, wash gone, zero errors.
19/19 parse, test-fishing, cardart 13/13, ripship 37/37, backs 15/15,
economy 29/29, smoke-fishing, smoke-spots 80/80. Stamp a6650a.

## Batch 101 — Poker Smash v2: four-colour suits back, 9s out
Revised skin. Three changes, all different in kind.

FOUR-COLOUR SUITS - AND THIS FIXES A REGRESSION FROM BATCH 100. The
game ALREADY had four-colour suits: PK_SCOLORS is red/amber/green/blue.
The v1 skin's SMASH_SUIT collapsed them to red-and-black and I shipped
it without noticing, throwing away the cue a player reads flushes by.
v2 walks it back; this build uses the host's OWN PK_SCOLORS rather than
v2's near-duplicate palette, so there is one source of truth. The tile
border now carries the suit colour, which is where the read lives.

RANK WASH: a faint per-rank tint (PK_SMASH_WASH) so pairs and trips
read without counting glyphs.

THE 9s - NOT A SKIN CHANGE. Buried mid-file as "No 9s - re-roll onto
10-A like Smash", and it did two things wrong. (1) Balance: the deck
was [9..A], six ranks; forcing five makes hands form materially more
often. Measured over 5x26s passive runs each way: mean score 300 ->
426, ~1.4x - and that UNDERSTATES it, because passive runs only match
by luck while a player building hands benefits more from a smaller
pool. (2) The implementation defeated a guard: pkSpawn retries up to 30
times calling pkSafe() so a new card never lands in an instant match,
and the override rewrote c.rank AFTER that check passed. Playtester
chose to take the change done properly, so PK_RANKS itself is now
[10..A] and pkSafe still applies.

Consequence, CORRECTED: I first recorded that a 6-long straight was now
impossible. Wrong - the playtester caught it. Jokers are wilds for BOTH
rank and suit ("a joker is any rank AND any suit" in pkScanLine), and
the straight scanner walks by POSITION (base + dir*(j - baseIdx)), so a
joker occupies a slot in the run rather than breaking it. Proven on a
live board: [10 J Q K A + joker] scans as sflush:6, as does
[joker + J Q K A + joker]; the same row without a joker caps at
sflush:5. Both 6-tiers stay reachable.
Better still: 10-J-Q-K-A is now the ONLY straight, so every straight
completed is the full run, and one joker on either end tops it to the
6-long straight flush - the 4,000 top tier. Dropping the 9s raised the
ceiling's reachability rather than removing it.
Verified: no 9s dealt, four colours on the board, felt intact, zero
errors. 19/19 parse, test-fishing, cardart 13/13, ripship 37/37,
backs 15/15, economy 29/29. Stamp c794e7.

## Batch 100 — POKER SMASH: felt, white tiles, challenge hands
Third outside proposal, and the first that ships real game code rather
than CSS. Tested by playing actual rounds headless before judging.

WORKED AS DELIVERED: white arcade tiles, gold HUD/RAISE, stage chrome,
the POKER SMASH overlay copy, timed Challenge Hands, chain lightning,
floating hand banners. Zero page errors. Every assumption it made about
the host held - PK_HANDNAME's keys (kind/straight/flush/sflush) match
the challenge types exactly, pkFaces and pkCtx are `let` so its
reassignments were legal, and all the DOM ids exist.

THE BUG: its green felt never appeared. The skin painted the canvas
background BEFORE calling the original pkDraw - and pkDraw opens with
clearRect() then fills its own dark gradient straight over it. Measured
the corner pixel: [17,19,23] with the skin, byte-identical to stock. A
wrapper fundamentally cannot repaint that background. Fix: the felt now
lives in pkDraw itself (two gradient stops plus a faint horizontal
weave). Corner now reads [15,42,30].

HOW IT LANDED: the visual identity went into the host functions
directly - pkDrawFace is the white tile, pkDrawJokerFace is the
dark/gold JOKER, pkDraw carries the felt - so there is no
double-implementation and no load-order dependency. Only the genuinely
ADDITIVE layer (challenges, bolts, banners) stays a wrapper block, kept
liftable in one piece. pkJokerGlyph is now unused but harmless.

DROPPED: cards.jpg + felt.jpg, 508KB shipped in the zip and referenced
by nothing. And its INSTALL.txt wanted a new root .js plus hand-edits to
index.html - both generated, wiped on the next build.

BALANCE (playtester's call, taken): challenges pay 180 + n*40, and
poker cashes out at min(12000, score*0.25), so each cleared challenge
is roughly +75-85 credits. Kept as proposed; the 12k cap bounds it.
Verified in play: bolts peak 8, banners firing, challenge cleared,
score 4,680, no errors. Stamp dcd3ff.

## Batch 99 — control chrome: one shape language for buttons and menus
Second outside CSS proposal (buttons/menus). Safer than the last one -
measured clean at 980 and 430px: no clipping, no overflow, no page
errors - so most of it shipped, adapted.

TAKEN:
- Fields and rows settle on ONE height. Before: toggle rows 48px,
  collection selects 37px, search box 35px, the rarity dropdown 28px.
  Now 34px across the board. That scatter was most of the "not
  designed" feeling.
- Mobile nav min-height 39 -> 44px, the standard touch-target floor.
- Buttons get geometry (min-height 38, inline-flex centring, one
  radius) plus a subtle gloss; pack price pills become real 32px pills
  and the 10-pack pill gets the gradient.
- nav gets a frosted background. Worth it here specifically because
  nav is position:sticky, so content really does scroll under it.
- Defines --line, which the host USES at .market-empty but never
  defined - that dashed border was falling back to currentColor.

REJECTED as dead selectors (match nothing in this game): .btn.ghost
(the real class is btn-ghost, hyphenated, already brass-styled),
.btn.sm, .btn.block, .filters button, .cfilt-more button (that
container holds selects), .pack-chip (the filter chips were skipped in
batch 98). The supplied preview HTML was built on that invented markup
- class="btn ghost", class="btn sm secondary" - which is why it
showed a tidier button family than the game actually has.

THE ONE THAT MATTERED: the proposal set `button.btn{background:...}`.
A synthetic probe showed why that is dangerous - `button.btn` is
(0,1,1) and `.btn-ghost`/`.btn-brass` are (0,1,0), so the base rule
already wins. Adopting a background shorthand would have repainted all
39 btn-ghost buttons. Fix: this block sets background-IMAGE only (a
gloss overlay), never background-colour, so every variant keeps its own
palette. Verified by probing all six variants before and after - every
background-colour is byte-identical to the previous build.

PRE-EXISTING BUG FOUND, NOT FIXED (needs a design call): because of
that same specificity, .btn-ghost and .btn-brass currently render as
accent BLUE, not brass - their palette has never applied. Fixing it
would visibly change ~39 fishing/tackle buttons, so it is the
playtester's call, not a silent ride-along.

Also removed the 10-pack pill's inline background so its styling lives
in the stylesheet with every other pill.
Verified: 19/19 parse, test-fishing, cardart 13/13, ripship 37/37,
backs 15/15, economy 29/29, smoke-fishing, smoke-spots. Stamp 5d3145.

## Batch 98 — UI pass: grouped Play shelves, packs grid, Auto-Open drawer
An outside review (Grok) proposed a Play/Packs redesign. Measured its
premises against the real page before touching anything: two held up,
one did not, and one file would have broken the build.

TAKEN, with the numbers that justified them:
- AUTO-OPEN IS NOW A DRAWER. That panel measured 289px tall and pushed
  the pack shelf 516px down a 900px phone screen - 57% of the first
  view was a settings box you touch once a week. Collapsed it to a 19px
  summary; the shelf now starts at 280px and the whole 8-pack wall fits
  one screen. Because a closed drawer hides its own state, the summary
  carries a live chip ("Off" / "On - stops on new cards & mythic+"),
  painted by paintAutoOpenStatus() from updateSettings + the restore
  path.
- PACK SHELF IS A GRID, not fixed-width flex. Cards 170 -> 214px on
  desktop (they fill the row instead of leaving a ragged edge) and
  256 -> 190px tall. Locked packs now dim (opacity .75) - previously a
  level-locked pack looked identical to a buyable one apart from its
  price line.
- PLAY LOBBY GROUPS into Outdoor & idle / Arcade / Puzzles, 3 games
  each, with per-group border + meta tints.

REJECTED:
- The proposed Play CSS was broken. It declared `.play-grid{display:grid
  !important}` while adding `.play-hub` to the SAME element (#playGrid
  already carries class play-grid in the host HTML). !important beat the
  hub's display:flex, so the three group sections laid out side-by-side
  at 170px each - proven headless before rejecting it. Fix: the
  container is now `.play-hub` ONLY and each group's row reuses the
  existing `.play-grid` rule verbatim - no new grid rule, no !important,
  nothing to fight. The tints then outranked `.play-card:hover` by
  source order, so hover is re-asserted at `[data-group]:hover`.
- Pack filter chips: 8 packs do not need a filter, and "Special"
  resolved to the same three packs as "Locked". Skipped.
- Its blurb rewrite ("9 games, sorted so you are not hunting through one
  pile of buttons") - UI describing itself. Kept the original line.

DELIVERY NOTE: every instruction pointed at generated files ("replace
UI_GAMES in oe-18-tail.js", "paste at the end of <style> in
index.html") - a rebuild erases that. Worse, pasting its 9-entry
UI_GAMES into the host deletes the `/* Runeshard entry removed */`
comment that integrate.py's registry splice anchors on, so once() would
abort the whole build (rule 1). Sidestepped entirely: grouping lives in
a PLAY_GROUP_OF map keyed by id, so UI_GAMES is untouched in BOTH
places and adding a mode later never has to edit two files. A game
missing from the map falls into the last shelf rather than vanishing.

Backup before shipping: branch backup/art-complete-3f2abc on GitHub,
plus a verified 25MB playable zip sent to the playtester.
Verified: 19/19 parse, test-fishing, cardart 13/13, ripship 37/37,
backs 15/15, economy 29/29, smoke-fishing, smoke-spots. Stamp d86885.

## Batch 97 — EVERY CARD IN THE GAME IS PAINTED: 967/967
The final 31 arrived pre-named with every correction note honored -
a real cassette walkman (not an iPod), a folding straight razor (not
a kitchen knife), a hiking compass (not brass), the coin frozen
mid-flip over a thumb, the white dealer puck, opal with real play-of-
color. Rare closes at 788/788, and with the foil tiers that is the
ENTIRE 967-subject manifest painted: 17MB across 967 lazy-loaded
webps, generated by the playtester, identified, cropped and shipped
here across 21 batches with zero misnamed files. One last test
archaeology: the collection framed-minis check went red - NOT from
the art, but because it had always passed by accident. The layer
probes' open_single applies pulls to state.owned, and the probe
subjects (first unpainted rarity>=9) sat on collection page 1; with
everything painted the probes became Raid Gear, which the collection
filters out, so the accidental page-1 frames vanished. The check now
filters owned-only (pagination-proof) and asserts locked cards exist
after resetting. cardart 13/13 twice, ripship 37/37.

## Batch 96 — the great triage: 129 shipped from five mixed dumps
rendered02-06 (346 unlabeled images) triaged in one pass: 129 new
subjects shipped, the rest re-renders or not-in-game extras, zero
misassignments caught by the labeled-crop review. The dedupe pipeline
resolved earlier holds too - the three red spheres became antares /
betelgeuse / aldebaran (judgment calls, flagged), and better takes
replaced earlier picks before shipping (iceberg, the-moon, garnet,
crab-nebula, monument-valley, card-shoe, geyser each had 2+
candidates; best won). Filename lesson: the generator's random names
mix l and I - matching normalizes both to one glyph. Standouts:
Saturn, the full moon, Machu Picchu, the maneki-neko, old-man-of-the-
lake, pearl-oyster. cardart 13/13, 936 files (~16MB). 757/788 (96%).
The last 31: 8 household (walkman, nokia, razor, scarf, denim,
egg-timer, office typewriter, outdoor compass), 18 cosmos (neptune,
deimos, proxima, orion-nebula, big-dipper, opal, peridot, onyx,
obsidian, blizzard, avalanche, glacier, rushmore, notre-dame,
neuschwanstein, amazon, iguazu, versailles), 4 fortune (shooting-
star, dealer-button, green-felt, flipped-coin), 1 tide (old-coin-
purse).

## Batch 95 — the new categories finally arrive (40 from a raw mix)
After SIX raw-archive zips of pure re-renders (553 images checked,
zero shipped - the dedupe pipeline earned its keep), rarerawrendered01
mixed the first genuinely new material in with more dupes and 16
subjects that are not in the game at all (giraffe, leopard, Marie
Curie, roulette wheel...). Triage: 83 in -> 40 shipped, 23 subject-
dupes skipped, 16 extras skipped, 4 HELD as too ambiguous to name
(two red star/planet spheres - antares vs betelgeuse vs aldebaran;
a grey disc; a blue-jeweled amulet - brass-talisman vs evil-eye-bead).
Shipped: 21 Cosmos (diamond, citrine, pyrite, malachite, marble,
iron/silver ore, meteorite, Fuji, Chichen Itza, Colosseum, Sagrada,
Sydney Opera, hurricane, hailstorm, rainbow, io, sirius, ring-nebula,
whirlpool-galaxy, milky-way), 12 Tide (blobfish, viperfish, goblin +
frilled sharks, taimen, the-one-that-got-away as a lunging bass,
silverscale-leviathan as a silver dragon, moonlit-eel, colossal-squid
tentacles, coral-reef, sunken-wreck, captain-s-compass), 5 Fortune
(ace-of-spades, tarot-deck, the-joker, dreamcatcher, wishbone), 2
Misc (antique-coin, kaleidoscope). cardart 13/13, 807 files.
628/788 Rares (80%).

## Batch 94 — MACHINES IN MOTION COMPLETE: 160/160
Trolley car through yacht closes the third big shelf, proven by
manifest diff. Windmill vs wind-turbine properly distinct; the
whaling ship reads apart from the clipper/galleon/pirate trio. Three
of the four large categories are now DONE (animals 216, legends 212,
machines 160): 588/788 Rares, 75%. cardart 13/13, 767 files (~13MB).
Remaining: Cosmos & Terra 130, Tide & Tackle 31, Fortune & Folly 27,
12 household stragglers - exactly 200 to the finish.

## Batch 93 — machines 49-144: the fleet doubles twice
Ninety-six in two zips: elevator through muscle-car, then oil-rig
through tow-truck. All verified; the lookalike families stay distinct
(fighter-jet / supersonic-jet / stealth-bomber; sailboat / clipper /
galleon / pirate-ship). One curated note: 'Steam Engine' arrived as a
second locomotive rather than a stationary engine - visually distinct
from steam-locomotive's profile, shipped. Tall subjects (oil rig,
ferris wheel, balloon, rocket, grandfather clock) got low biases.
cardart 13/13. 751 files. 572/788 Rares; machines 144/160 - one
16-drop closes the shelf (tractor through zamboni or thereabouts).

## Batch 92 — Machines in Motion opens: ATM to dune buggy (48)
The last big shelf begins, and the style pivots perfectly: weathered
miniature-model renders on the same muted backdrop - the trireme,
carousel, and blast furnace are standouts. Objects sit mid-frame so
one 0.32 bias covers nearly everything (ships and the blast furnace
excepted). All 48 verified. cardart 13/13. 655 files. 476/788 Rares;
machines 48/160.

## Batch 91 — LEGENDS & MYTH COMPLETE: 212/212
Tsukuyomi through Zheng He closes the second giant shelf, proven by
manifest diff (zero missing). Highlights of the final 20: Van Gogh
unmistakable, the Wright Brothers correctly a TWO-man portrait,
Gagarin in his helmet, Tsukuyomi's crescent crown, and Zeus to close.
One initials rename (web-du-bois -> w-e-b-du-bois). With animals done
that is BOTH 200+ shelves finished: 428/788 Rares. cardart 13/13, 607
files (~12MB). Remaining: Machines in Motion 160, Cosmos & Terra 130,
Tide & Tackle 31, Fortune & Folly 27, 12 household stragglers.

## Batch 90 — legends 181-192: the delivery format perfects itself
The zip carried BOTH a labeled reference sheet AND the 12 full-res
pre-named singles - review sheet plus canon files in one drop, the
best format yet. Suleiman through Toussaint Louverture, all verified:
Sun Wukong's gold fillet, red-faced winged Tengu, Tezcatlipoca's
smoking mirror, ibis-headed Thoth, Thor with Mjolnir, and Tlaloc's
goggle-eyed mask (project highlight). cardart 13/13. 587 files.
408/788 Rares; legends 192/212 - one drop of 20 closes the shelf
(tsukumogami through zeus).

## Batch 89 — legends 169-180 as a LABELED sheet
New format again: one 4x3 grid with each subject's name painted into
the tile bottom - self-documenting, and the labels confirmed all 12
against the manifest order (selkie through steve-jobs; Set's red
beast-head, Sobek's crocodile, blue Shiva, recognizable Hawking and
Jobs). Slice trims 42px off each tile bottom to drop the label band,
then squares from the top. Same resolution tradeoff as batch 80's
grids (~250px native) - if full-res singles arrive later, same-slug
overwrite upgrades them in place, no other action needed. cardart
13/13. 575 files. 396/788 Rares; legends 180/212, 32 to go.

## Batch 88 — legends 157-168: two queens, a qilin, Dali's mustache
Twelve loose images, all mapped by eye: Sekhmet (lioness with cobra
crown), Saraswati (correctly white-sari'd), Sally Ride, Dali
(unmistakable), Saladin, Rosa Parks, Rembrandt, Rachel Carson (older
than her famous photos - curated), Quetzalcoatl (scale-skinned, a
strong one), Queen Victoria in widow's black, Elizabeth I in full
ruff, and the qilin (0.12 bias for the antlers). cardart 13/13 first
run. 563 files. 384/788 Rares; legends 168/212, resuming at selkie.

## Batch 87 — legends 145-156, dropped loose
Twelve images with no filenames and slightly shuffled order - mapped
by identification against the next manifest stretch: Osiris (white
crown), Bismarck (the mustache), young Picasso, Persephone (sprig),
Perseus, Peter the Great, Pegasus, Phoenix, Pixiu (the Chinese winged
lion, correctly beast-form), Plato, Poseidon, Ptolemy. First cardart
run after the copy: 13/13 - the two-probe fix holds under exactly the
condition that used to flake. 551 files. 372/788 Rares; legends
156/212, resuming at qilin.

## Batch 86 — legends 49-144, and the cardart flake root-caused
NINETY-SIX portraits (Hemingway through Oni) - gods of eight
pantheons, monsters, kings, scientists. One apostrophe rename
(maat -> ma-at, same rule as anna-s-hummingbird); Kukulkan arrived
personified (warrior in feathered-serpent headdress) - curated.
THE FLAKE IS DEAD: third sighting arrived with full output captured,
and the failing pair told the story - layers 2/3 reused the SAME card
layer 1 had temporarily painted, and Chromium's memory cache kept
serving the unlinked temp file into the wiki-fallback and emoji
checks. Intermittent because cache eviction timing. Fix: two distinct
unpainted probes - layer 1 paints one, layers 2/3 use the other, so
no cache interaction exists at all. 3 consecutive 13/13 runs. 539
files. 360/788 Rares; legends 144/212.

## Batch 85 — Legends & Myth opens: Lincoln to Enki (48 portraits)
The second big shelf begins with people, and the portrait style shifts
naturally: bust-length, formal, the same muted backdrop. All 48
verified - the traps held (Cyrus vs Darius by regalia, Athena's helmet
vs Artemis's quiver, Anubis jackal vs Bastet cat, the Celtic trio
distinct). Uniform bias 0.20 works for busts; Atlas got 0.08 for his
globe. FLAKE WATCH: cardart's 2-fail-then-pass happened again (2nd
time, both first-runs after copying a big batch into art/) - the
failure detail scrolled off because only the tail was kept. Next
first-run gets full output captured; a third sighting earns
root-cause. 443 files. 264/788 Rares; legends 48/212.

## Batch 84 — ANIMAL KINGDOM COMPLETE: 216/216
Termite through yellow-bellied sea snake closes the category - every
Animal Kingdom Rare in the game now has a painting, proven by diffing
the manifest against art/ (zero missing). Nine drops start to finish
(batches 77-84), all playtester-generated from rare-art-list.txt,
zero misnamed files shipped. cardart 13/13, 395 files, ~9MB.
216/788 Rares painted overall. Next shelves: Legends & Myth (212),
Machines in Motion (160), Cosmos & Terra (130), Tide & Tackle (31),
Fortune & Folly (27), plus 12 household stragglers.

## Batch 83 — the gap closes; the alphabet reaches Tasmania
Sixty paintings in two zips: 061-072 (cougar through eastern-newt)
seals the last hole in the low alphabet, and 145-192 (poison-dart-frog
through tasmanian-devil) runs the S-shelf nearly to the end. Identity
traps all passed: spotted vs striped hyena, the three dark bears
(sloth's pale muzzle, sun's chest crescent, the devil's ears), and
ruby-throated vs anna-s hummingbird. cardart 13/13, 371 files.
192/788 Rares, 192/216 animals - only 193-216 (tiger-fish through the
end) remain, and Animal Kingdom is contiguous 001-192.

## Batch 82 — the gap half-closes: animals 49-60 and 73-84
Two zips into the 049-084 hole: chimpanzee through cottonmouth, then
echidna through fire-salamander. All 24 verified (copperhead and
cottonmouth are properly distinct snakes; the coral polyp came back
a stylized pink anemone - shipped as curated). Crop notes: elk got
bias 0.10 for the antlers, fennec 0.15 for the ears, hoopoe 0.15 for
the crest - tall headgear is the one thing the default biases clip.
cardart 13/13, 311 files. 132/788 Rares, 132/216 animals. Open gap
narrows to 061-072 (cougar through eastern-newt, 12 subjects).

## Batch 81 — animals 97-144 as full-res singles; grid tiles upgraded
A 48-image zip covering 097-144: the 24 grid-tile paintings from batch
80 re-delivered at full 784px (SAME slugs, so a plain cp upgraded them
in place - the batch-80 softness lasted one deploy), plus 24 new
(ladybug through plains-zebra), all verified on contact sheets. The
two-format story resolved itself: grids were a preview, singles are
the canon delivery. cardart 13/13, 287 files. 108/788 Rares, 108/216
animals - exactly half the Animal Kingdom. 049-084 still the open gap.

## Batch 80 — animals 97-120 arrive as contact sheets
New delivery format: two 4x3 GRID IMAGES instead of a zip, no
filenames. Worked because the tiles run in exact rare-art-list
alphabetical order, so position = slug (great-horned-owl through
kookaburra, 24 paintings, all verified by eye against that mapping).
Slicing lesson: a 6px inset left gutter slivers on tile edges; 12px
cleans them. Grid tiles carry ~270px of real detail vs 784px from
single-image drops - upscaled to 320, acceptably soft for the Rare
tier (the playtester: "not that important to be super special").
cardart 13/13, 263 files. 84/788 Rares, 84/216 animals; 049-084
still the open gap.

## Batch 79 — animals 85-96 (the F-G shelf)
Firefly through Great Blue Heron, 12 paintings, all identified clean -
the playtester is working ahead of the alphabet, so 049-084 (chinchilla
through emperor penguin territory) are still open. cardart flaked 2
checks on one run then passed 13/13 twice; watching for a third
appearance before root-causing (same policy as the feJournalBtn flake).
239 files in art/. 60/788 Rares painted, 60/216 animals.

## Batch 78 — animals 13-48 (three zips, one apostrophe)
Three more playtester zips, 36 paintings: Andean Condor through Cheetah.
All identified correctly on the contact sheets. One naming lesson: the
generator dropped the apostrophe from Anna's Hummingbird, producing
annas-hummingbird where rzArtSlug makes anna-s-hummingbird ("'" is
non-alnum, so it becomes a dash) - the slug validator caught it against
the manifest before anything shipped, renamed on crop. That validator
(every incoming name must exist in art-manifest.json with bucket Rare
and no file already in art/) is now step one of every drop. cardart
13/13 with 227 files in art/. 48/788 Rares painted, 48/216 animals.

## Batch 77 — the Rare tier starts getting painted (animals 1-12)
The playtester opened WAVE 4 by generating the first 12 Animal Kingdom
Rares themselves from docs/rare-art-list.txt (new file: all 788 Rare
subjects grouped by category under ONE shared mid-tier background brief
- plain painterly slate-grey gradient, subject at ~70% of frame, less
drama than the foil heroes) and dropping a zip already NAMED BY SLUG
(rare-cards/animals/NNN-slug.jpg). That kills the identify-by-eye step;
eyeballing is now just verification, and all 12 checked out. Aardvark,
Adelie Penguin, African Grey Parrot, Alpaca, American Beaver / Bison /
Bullfrog / Crow / Flamingo / Kestrel / Robin / Toad - standard
per-subject-bias crop to 320x320 webp q82, ~50KB each. NO WIRING
NEEDED: the Rare bucket is tiers 9-11, already at RZ_ART_MIN=9, so
these cards have been probing art/ (and 404ing to wiki) since the art
system shipped - the paintings go live on merge, no rebuild. Proven
headless: tier-0 Aardvark (Classic Print) correctly shows NO painting;
tier-9 Heritage Folio renders aardvark.webp at 320px inside the red
Rare frame. cardart 13/13 with 191 files in art/. 12/788 Rares done.

## Batch 76 — WAVE 3 COMPLETE: every foil card in the game is painted
The last four landmarks (Dead Sea, Great Blue Hole, Bora Bora Lagoon,
Antelope Canyon) close the Epic tier: 104/104. With waves 1 and 2 that
is 179 PAINTINGS - Mythic 38, Legendary 37, Epic 104 - and every card
from Epic up now turns over to real art in its metal frame, everywhere.
The whole set weighs ~4.3MB across lazy-loaded files; the Rare tail
stays on wiki photos by design. Generated by the playtester in Grok
Imagine chat over roughly a day, identified/cropped/verified/shipped
here in twenty-odd batches with zero misnamed files.

AND A SERIOUS NEAR-MISS, CAUGHT BY THE COMPLETION COUNT. The tally read
Mythic 37/38: vacuum-tube-radio.webp was GONE. Cause: smoke-cardart's
"painted file wins" test targeted THE FIRST MYTHIC IN THE DECK, wrote a
temp 1-pixel webp over that slug and unlinked it after. Harmless when
the test was written - no painting existed - but the day the real file
landed, the suite DELETED it, and batch 75's git add -A shipped the
deletion. Worse, while fixing it the old suite ran twice more (once
before checking the patch had actually applied) and ate the restored
copy both times. Lessons, plural: (1) a test that writes into real
content directories must derive a path PROVEN vacant and assert it,
never a path picked by convenient coincidence; (2) after patching a
destructive test, verify the patch is IN THE FILE by grep before
running it again; (3) completion counts catch what eyes do not - the
missing painting fell back to the wiki photo so gracefully that nobody
would ever have noticed. The suite now finds a genuinely unpainted slug,
asserts the temp path does not exist, and the restored painting survived
a full run with its hash unchanged.

## Batch 75 — the paintings reach the collection and the info panel
The playtester asked whether the collection showed the new art - it did
not, and the wave-1 announcement had wrongly said it did. The painted
layer only ever ran on the flip reveal; the collection grid and the
card-info panel still put the emoji in the frame window. Now all three
surfaces probe the same art/<slug>.webp files: framed cells carry a
lazy-loaded painting over the emoji, onerror removes the img so the
emoji shows through, and misses are remembered per session so re-renders
do not re-probe. The grid deliberately does NOT call the wiki - sixty
lookups per page is not a page anyone wants - so unpainted cards show
their emoji there and their wiki photo in the info panel, as before.

The suite then failed for the best possible reason: its "a Mythic with
no painting" and "a Legendary where everything misses" premises are
EXTINCT - every Mythic and Legendary is painted. smoke-cardart now finds
a genuinely unpainted Rare by diffing cards[] against art/*.webp instead
of assuming any tier is bare, which also future-proofs it against the
Epic wave.

Verified: 18/18 node --check, test-fishing 114/114, smoke-fishing 13/13,
smoke-spots 80/80, ripship 37/37, backs 15/15, cardart 13/13, economy
29/29, arcade 12/12, and the pocket-watch-in-the-collection screenshot.

## Batch 74 — WAVE 2: every Legendary is painted (PRs #46-#49)
Thirty-seven Legendary paintings in four sittings, same chat pipeline as
wave 1, and the LEGENDARY TIER IS COMPLETE - 75 paintings in the game,
every foil-and-up... every 14+ card now turns over to real art in its
gold or magenta frame. Standouts for the record: the Werewolf and the
Dragon as a matched pair of aristocratic monsters, the Solid Gold
Paperclip as a Dutch-master still-life, Enceladus wearing its real
tiger-stripe fractures, and the crooked-casino trio (Loaded Dice,
Marked Card, Roulette Ball) matching the Fortune & Folly mythics.

Two interpretations logged, both shipped as curated by the playtester:
Siren's Song arrived as a sea-encrusted siren figure rather than a
literal song, and Amber as a golden queen dressed in amber rather than
the raw gem - the anthropomorphized reads are consistent with how the
whole Legends set leans, and both look superb in the frame.

Next on the sheet: Epic, 104 subjects, then the Rare tail stays on wiki
photos until someone feels like a very long afternoon.

## Batch 73 — WAVE 1: every Mythic is painted (PRs #40-#44)
The first art wave is complete: all 38 Mythic subjects have real
paintings, generated by the playtester in Grok Imagine chat from the
paste sheet and shipped here in five batches over one sitting. Every
Mythic pull in the game now turns over to a painting inside its magenta
frame - flip reveal, collection, info panel - and the whole tier weighs
~950KB across 38 lazy-loaded files.

THE CHAT PIPELINE HELD UP: playtester pastes a block of four prompts,
downloads what Grok returns, drags the images into the repo chat with no
renaming; this side identifies each subject BY EYE, names to the
manifest slug, crops square with a per-subject vertical bias (antlers,
crowns and long necks all need the top of the frame; boats and bells
want the middle), converts to 320x320 webp q82, drives a real flip to
prove the painting loads inside its frame, and merges. Live on merge,
no rebuild - the batch-68 contract doing exactly what it promised.

The style lock in the prompts did its job: 38 images generated across
several separate Grok sessions read as one artist. Two judgment calls
logged for the record: the Hydra came back as a sorceress wreathed in
serpent heads rather than the beast (shipped; re-roll offered), and
Seventh Seven carries no literal sevens - it was matched by elimination
as the last unmatched artifact (shipped; re-roll offered). Next on the
sheet: Legendary, 37 subjects.

## Batch 72 — THE KEEP AND MYTHIC RAIDS RETIRE (playtester's call)
Two modes leave the game: The Keep ("we can't get that mode working
right") and Mythic Raids/the dungeon, with all Raid Gear ("a dead game
mode"). Retirement follows the house pattern, not deletion:

THE KEEP - fully unwired. Its lobby card leaves the host UI_GAMES; the
css read, the MODULE_FILES entry, and its tab-section splice come out of
integrate.py in one pass (the hooks needed no touching: keep was always
SELF-driving - no host reference to any kp* name existed, which is why
this unwires so cleanly). The build drops from 19 to 18 split files.
workshop/keep.module.js and keep.css STAY in the workshop, unwired -
retired source is not deleted source. The stale modes/keep.module.js
mirror is removed (generated, regenerable). The ledger's "Clear N waves
at the Keep" daily task leaves the pool - it would have been
uncompletable, and a dead daily blocks the grand prize.

MYTHIC RAIDS - retired host-side like empire/siege/raids before it: the
lobby card leaves UI_GAMES and #tab-dungeon joins the sealed-tabs CSS
rule. The dungeon code sleeps in place - its uiEnterSection branch even
has to stay, because it is the ANCHOR integrate.py splices the module
enter-hooks against. Raid Gear needed almost nothing: EXCLUSIVE_
CATEGORIES already kept it out of every pack pool, the collection and
stats already filtered it, and the data comment already said "Raid Gear
cards sleep in the data (ids are indices)" - rule 6 means the 200-odd
card entries stay in cards[] forever, unobtainable and invisible.

Saves are safe both ways: a save carrying state.keep and owned Raid Gear
boots clean (proved with a seeded save), the keep slice just goes
ignored. Players lose the Keep's mining-rate wrap (kpBonus) with the
mode - that income was the mode's, and the mode is gone.

The art manifest drops its Raid Gear entries: 985 -> 967 images (Mythic
38, Legendary 37, Epic 104, Rare 788); the brief's wave table now
carries the real counts. CLAUDE.md's mode lists updated so the next
chat does not go looking for keep.

One test taught a small lesson: the ripship smoke assumed a "pack" task
is always on the ledger's daily board - but the board is dealt by hash
from the pool, and SHRINKING THE POOL RESHUFFLED THE DEAL, so the pack
task vanished from today's board and the check went null. The check is
now deal-aware; the wrapper-order assertion was already the real proof.

Verified: 18/18 node --check, test-fishing 114/114, smoke-fishing 13/13,
smoke-spots 80/80, ripship 37/37, backs 15/15, cardart 12/12, economy
29/29, arcade 12/12 (now asserts both retired modes stay out of the
lobby), plus a 9-check removal pass: keep/dungeon gone from the lobby,
tab-keep absent, tab-dungeon sealed, no kp code in the page, a
keep-carrying save boots clean, raid gear stays hidden.

## Batch 71 — the last card surface (the info panel), and the foil-tier fight
The card-info panel's 250px card now wears its metal frame like every
other card surface - name and category on the plate, two-line names
clamped with an ellipsis, the count badge on the frame's bottom rail.
Undiscovered handling does not apply here (the panel only opens on a
real card), so every panel card is framed.

THE REAL FIND: the foil tiers were ERASING FRAMES EVERYWHERE. The
fx-mythic/legendary/unique/prototype classes set `background: ...
!important`, which outranks an inline background-image - so a Mythic in
the collection or the panel silently dropped its metal and showed only
the old holo gradient. Nobody had noticed because batch 70's screenshots
framed a Common. The fix: the frame now rides a CSS VARIABLE (--frame),
which no !important background can touch, and a higher-specificity rule
(`.mini-card.framed[class*="fx-"]`, 0-3-0 vs their 0-1-0) puts the metal
back while the foil's ::before shimmer and glow keep animating on top.
The result is what a foil card should have been all along: sunburst over
metal. Lesson for the log: any inline style a mode sets can be silently
beaten by a host `!important` - when a skin must survive every styling
tier, carry it in a custom property.

Also from this round: element screenshots of foil cards hang playwright's
stability wait forever (the shimmer never settles) - pass
animations="disabled" to screenshot() instead of raising timeouts.

The #feJournalBtn click flake hit smoke-spots again - SECOND appearance,
same button, same shape, in fishing code neither batch touched; clean on
the single allowed re-run both times. If it shows a third time it stops
being a flake and earns a root-cause on the journal button itself.

Verified: 19/19 node --check, test-fishing 114/114, smoke-fishing 13/13,
smoke-spots 80/80 (one re-run, above), ripship 37/37, backs 15/15,
cardart 12/12 (now: the panel card framed with fx on top, and the
collection check reads COMPUTED style since inline background is gone),
economy 29/29, arcade 12/12 - plus mythic/common/long-name panel
screenshots.

## Batch 70 — the frames travel (collection grid + the salesman's feed)
The metal frames leave the flip reveal and dress the other two card
surfaces. The COLLECTION's mini-cards (60 per page, 5:7 - almost exactly
the frame's own ratio) wear the full frame as the cell background: the
dark cell colour shows through the punched window behind the emoji, the
name rides the plate, the count badge stays. Only OWNED cards get metal -
undiscovered cells keep their grey mystery, which now reads even better
by contrast. The opened-stack variant grid gets the same treatment, so a
subject's editions fan out as a row of differently-metalled cards.

Perf note for the log: sixty cells share at most seven distinct frame
data-URIs, and the browser decodes each unique image once - the cost is
sixty background paints of cached bitmaps, which the smokes and a manual
scroll put well inside comfortable.

THE MARKET NEEDED READING FIRST. The host's marketGrid offers never
populate on a live save (state.market stays null) - the Market tab the
player actually sees is market2's Salesman's Feed, one visitor at a
time. So the visitor's bare emoji became a framed thumbnail (.mthumb,
also used to seed the host offers grid should it ever stock), while
sealed packs and unsearched lots keep their plain icons - they are not
cards yet, and the frame would spoil the gamble.

AND THE SCREENSHOT CAUGHT A CURRENCY STRAGGLER: the feed still PRICED in
🪙 while its Buy button has deducted DOLLARS since batch 63. Every
market2 money line (price, going rate, listing tiers, live listing, sold
toast) now reads $, and the host's Reset Stock button no longer says
"$100 🪙" with one glyph from each era.

The frames reach the host through window.oeFrameFor, exposed by the
ripship module and guarded at every host call site - the host's boot
render can run before the module has loaded, and the old unframed
markup remains as the fallback for exactly that window.

Verified: 19/19 node --check, test-fishing 114/114, smoke-fishing 13/13,
smoke-spots 80/80, ripship 37/37, backs 15/15, cardart 11/11 (now also:
owned collection cards framed, undiscovered cards plain, a market
visitor presents a framed card, the market prices in dollars), economy
29/29, arcade 12/12 - plus collection and market screenshots at phone
width.

## Batch 69 — METAL FRAMES: the card front becomes a real card
The playtester delivered eight metal frame renders (two 2x2 grids) and
asked for them as the card fronts. The flip reveal's dark panel is gone:
a card now IS its frame - art in the punched window, name and category
on the lower plate, the rarity band told by the metal itself:

  Common green/silver · Uncommon teal/gold · Fine purple/holo ·
  Rare red/gold · Epic dark-teal/holo · Legendary gold/holo ·
  Mythic magenta/holo   (the cream variant is held in reserve)

Each frame's dominant colour was matched to the rarity colour the game
already uses (Mythic #ff5cf0 -> magenta, etc), so the tier language is
consistent with every border and chip elsewhere.

HOW THE WINDOW WORKS. The art window is punched TRANSPARENT in the frame
webp; the art layer (emoji floor, wiki photo, painted art - batch 68's
three layers, unchanged) sits UNDERNEATH and shows through. The art rect
runs ~1% past the hole on every side, so it can never show a gap, and
anything larger simply hides under the frame. Each frame's measured hole
lives beside its image in RZ_FRAMES; text colours are overridable per
frame because the gold Legendary plate would swallow light text.

TWO CUTTING LESSONS. First: the flood-punch left ragged debris on every
holo-bordered frame - iridescent border colours sit near background grey,
so the flood ate into them unevenly and left speckle islands. The window
is a clean rectangle in the template, so the fix was to punch the
flood's BBOX as a straight rounded rect: clears every island, crisp
edge. Second, a regex bug the screenshots caught: replacing the "gold:"
entry matched INSIDE "tealgold:" and put the gold frame on Uncommon. The
fix (a lookbehind anchor) came with a guard that asserts all seven
embedded blobs are distinct - worth keeping for any future frame swap.

All seven frames total ~161KB webp; oe-12-ripship.js is 1.39MB.
Verified: 19/19 node --check, test-fishing 114/114, smoke-fishing 13/13,
smoke-spots 80/80, ripship 37/37, backs 15/15, cardart 7/7 (now asserts
the frame decodes, the window sits inside the card under the frame, and
different bands wear different frames), economy 29/29, arcade 12/12 -
plus a seven-tier contact sheet checked by eye at every band.

## Batch 68 — CARD ART ON THE FLIP (three layers, and a brief for the bench)
The flip reveal now dresses every card with the best art available, and
the emoji never leaves the floor:

1. PAINTED ART for Rare and up: the game probes art/<subject-slug>.webp
   at flip time. Nothing is committed there yet - the folder, contract
   and README exist so the bench's deliveries drop straight in with NO
   integrate.py wiring and NO REBUILD: commit a webp, push, live.
2. WIKI PHOTO for everything else (and as the painted layer's fallback):
   the same ciLookup the card-info panel has always used, sharing its
   90-day cache and alias table, keyed on the same subject split so both
   surfaces hit one cache entry.
3. The emoji, already on screen before any fetch starts. The art box is
   fixed-height so an arriving image never shifts the buttons.

THE NUMBERS THAT SHAPED IT. 60,171 cards total - any scheme that stores
an image per card is dead on arrival (300MB+). But variants share a
subject ("Bald Eagle - Sketch Plate" wears the Bald Eagle), and subjects
repeat across tiers, so Rare-and-up's 2,546 cards need only 985 unique
images: Mythic 40, Legendary 39, Epic 108, Rare 798. At the 320px/25KB
spec that is ~15-25MB of repo, lazy-loaded one file per flip. Common,
Uncommon and Fine stay on wiki photos by decision of the playtester
("junk that might eventually get removed").

FOR THE BENCH: docs/art-brief.md (spec, style, waves, the no-rebuild
delivery contract) and docs/art-manifest.json (all 985 slugs with
subject, bucket, category and how many cards each image covers - use the
slug verbatim, never re-derive by hand). art/README.md repeats the
contract at the drop point.

Mechanics worth recording: slugs are NFKD-folded so accents cannot fork
a filename; a probe that 404s is remembered for the session (one miss
per subject, not per flip); rzSetArt checks RZ.face so a slow fetch can
never paint the NEXT card's art onto the current one.

And one testing note: the suite's "zero errors" check began tripping on
console resource-load failures - which are now EXPECTED, because the art
layer 404s its probe by design and the sandbox blocks wikipedia. The
smoke now filters "Failed to load resource" console noise and keeps real
page errors strict; docs/smoke-cardart.py (6 checks) covers the actual
logic with stubs: a painted file replaces the emoji, the wiki photo
fills a miss, a Common never probes art/, the emoji holds when all else
fails, and the art box height never moves.

Verified: 19/19 node --check, test-fishing 114/114, smoke-fishing 13/13,
smoke-spots 80/80, ripship 37/37, backs 15/15, cardart 6/6, economy
29/29, arcade 12/12.

## Batch 67 — EARNABLE CARD BACKS (six designs, five locks)
The playtester's card-back set becomes a collection of its own. Six
backs, one worn at a time, and the whole hand wears it:

- Wrapper Cream - the default, yours from the start
- The Ribbons - open 25 packs
- Gold Foil - ship 100 cards (lifetime, tracked in state.ripship.shipN)
- The Golden Knot - pull a Mythic (retroactive: owning one counts)
- The Night Star - own a card of every rarity, Junk to Mythic
- Crimson Press - rip 10 packs in one sitting (the session streak)

A "🎴 backs" button in the hand opens the picker: earned backs equip on
tap, locked ones sit greyed with their price named. Owned/equipped ride
state.ripship through the normal save.

UNLOCKS ARE CHECKED AT FOUR MOMENTS, and the order of the first one
matters: at pack open the check runs BEFORE applyPulls, so it can only
see what you already had - otherwise "Golden Knot earned!" would toast
the moment a pack OPENED, spoiling the mythic sitting face-down in the
hand you were about to flip. Ship, flip and summary checks catch the
pack-driven unlocks at their dramatic moments instead. The ownership
scans walk state.owned (small) and index into cards[], never the 20k+
cards array itself.

THE CUTOUT PIPELINE GREW A SECOND MODE. The batch-64 flood-fill
silhouette assumes the subject is brighter than its background
everywhere along the outline - true for the cream pack, false for a
navy card on black or a silver card on beige, where the flood poured
through the matching-colour edges and ate the card bodies down to their
lettering. Card backs are rounded rectangles, so the right cut is: find
the largest connected blob of pattern pixels (the printed frame), take
its bbox, grow 2%, and stamp a rounded-rect alpha. All five cut clean on
the second pass, including two quarters cropped out of the 2x2 grid
image. Backs differ in aspect (the ribbons card is taller), so the hand
sizes them by HEIGHT - a taller design gets narrower instead of drooping
over the hint line, proved again with the rect-overlap probe.

And the flakiest check in the suite confessed its real cause: "KEEP pays
nothing" kept failing with ~2.6 dollars of drift even at a 60ms read -
because file:// localStorage PERSISTS BETWEEN RUNS, and dozens of test
runs had compounded the save's mining bonus into a rate that drips
dollars faster than any tolerance. smoke-ripship now clears storage and
reloads before checking anything. A test that inherits the last run's
save is not measuring what it thinks it is.

New suite docs/smoke-backs.py, 15 checks: picker opens with all six,
five locked, locked cells refuse to equip and name their price, every
back image decodes, the 25-pack and 100th-ship unlocks fire at their
moments, the whole hand wears the equipped back, no back overlaps the
hint line, and the worn back + earned set + ship count survive a reload.

Verified: 19/19 node --check, test-fishing 114/114, smoke-fishing 13/13,
smoke-spots 80/80, ripship 37/37, backs 15/15, economy 29/29, arcade
12/12. oe-12-ripship.js grows to 1.15MB - five more backs at 480px.

## Batch 66 — THE HAND (a sliced pack deals a real fan of cards)
Playtester request, built here: when the pack opens the cards SLIDE OUT
into a held hand - every undecided pull fanned face-down, offset and
rotated like cards actually held in front of you, wearing a real card
back. Tap the front card and it turns over in place while the rest of
the hand stays fanned behind it, face-down. SHIP or KEEP and the decided
card flies up out of the hand, the fan closes ranks, and the next card
takes the front - repeat until the hand is empty, then the summary.

The card back is the playtester's cream-diagonal design - literally the
matching back for the 3D pack art (same cream, same navy lettering, same
silver border and O&E medallion) - cut with the batch-64 pipeline:
flood-filled solid silhouette, 480x662 webp, 71KB, zero alpha holes on
the first try because the lesson was already written down.

Mechanics worth recording:
- The deal-in animation plays ONCE per pack (RZ.dealt), staggered by
  distance from the centre, so the cards pour out of the sliced pack;
  re-renders after each decision lay the fan straight.
- The fan is CAPPED AT 13 VISIBLE BACKS. An Everyday ten-pack holds
  FIFTY pulls, and the first version fanned all of them - the arc's lift
  term reached 218px and the hand swallowed the whole screen, buttons
  and all. The nearest thirteen fan; the hint line carries the true
  count. Found by screenshotting the ten-pack case, not the five.
- The drooping corners of the outer cards covered the hint line; proved
  fixed with a rect-overlap probe (0 overlapping cards), not by eye.
- Flip is two-phase (140ms rotateY out on the back, 160ms rotateY in on
  the face, perspective on the box); decisions guard against double-taps
  (RZ.leaving / RZ.flipping) because a 230ms fly-away window is exactly
  where a second tap used to land.
- Sigils now bloom at z25 - OVER the fanned backs, UNDER the face card.

One test lesson repeated itself: "KEEP pays nothing" compared exact
dollar balances 500ms apart, and mining dripped 2.6 dollars into the
pocket in between. The handler runs synchronously on the click, so the
check now reads the pocket 60ms after tapping and waits for the
animation afterwards. A live pocket is never compared exactly.

Verified: 19/19 node --check, test-fishing 114/114, smoke-fishing 13/13,
smoke-spots 80/80 (one journal-click timeout on the first run - the
documented flake shape, in code this batch never touched; passed clean
on the one allowed re-run), ripship 37/37 (now covers the fan count,
the back art decoding, and the face-down remainder), economy 29/29,
arcade 12/12, fx-in-hand 4/4, and the five-card hand, the flipped state,
the fly-away and the fifty-card ten-pack all checked as screenshots.

## Batch 65 — the pack opening gets its fireworks
Fx handoff from the bench: a particle canvas over the rip overlay
(sparks, star confetti, dust poofs, expanding rings) and twelve pixel
SIGIL BLOOMS - blue for Rare+, purple for tier 12+, red, and gold for
Mythic - that flare up behind the card as it turns. The slice now pops
gold sparks off the cap; flips burst by tier, from a modest puff at
tier 6 to a full star-storm with fireworks on a Mythic. Flip fx ride a
60ms delay so the card's own turn animation reads first.

THE HANDOFF WAS AGAIN BRANCHED FROM AN OLD MODULE - two generations
back this time. Copied in whole it would have reverted batches 62, 63
AND 64: buy-table valuation, credits instead of dollars, the coin
glyphs, the old colliding hue hash, the drag guard, and even the old
58KB speckled pack art (the file carried the superseded blob). The fx
layer, the sigil table, and the two burst hooks were lifted out of the
upload and spliced onto the CURRENT module instead; a grep for
state.credits, the coin glyph and m2TrueVal proving 0 hits is now part
of the merge routine. Same story in the css: the delivered file was the
pre-64 one (per-half drop-shadow seam and all) with five fx rules
appended - the five rules were appended to ours.

Verified with a new fx pass driving the real page: the slice draws >20
live particles on the canvas (read back via getImageData, not DOM
presence), a rare pull blooms a sigil, a spectrum-pack run peaks the
canvas hard on the top tiers, the card z-orders above the bloom, zero
page errors. Plus the standing sweep: 19/19 node --check, test-fishing
114/114, smoke-fishing 13/13, smoke-spots 80/80, ripship 34/34,
economy 29/29, arcade 12/12. oe-12-ripship.js grows to 414KB - the
twelve sigil PNGs - which is a tenth of fishing2.

## Batch 64 — the 3D pack (and the three fixes it nearly reverted)
The bench delivered new pack art: a real rendered wrapper (Meshy model),
sliced Pocket-style - drag the glowing seam and the foil cap tumbles off.
One webp, tinted per pack with hue-rotate so every pack on the shelf
wears its own colour.

THE HANDOFF WAS BRANCHED FROM THE OLD MODULE. Dropped in as sent it
would have quietly reverted batch 62 (valuation back on the BUY table -
the money printer returns) and batch 63 (shipping would PAY ARCADE
CREDITS, minting them from card sales and bypassing the change counter
entirely), plus the drag guard and the deep scrim. All four re-applied
onto the new file. A handoff that touches a file this repo has since
changed has to be treated as a BRANCH TO MERGE, never a file to copy.

Three defects found by looking at screens, none by the suites:
- A HARD SEAM across the sealed pack: each half carried its own
  drop-shadow, so the cap shadowed the body of a pack nobody had sliced
  yet. One shadow on the parent instead; the halves composite flush.
  Proved by row-luma scan across the join: largest step 3.9, down from a
  visible hard edge.
- The pack name printed ON TOP of the hint line - absolute-positioned
  30px below a pack that reserved no room for it.
- The delivered hue hash, (h%10)*36, collided three ways on the real
  shelf: Legends & Myth, Cosmos & Terra and Mega Booster all came out
  0deg - identical to each other and to the untinted art. Hues now come
  from the shelf index spaced by the golden angle: 7/7 distinct, no two
  within 32deg, and the starter pack keeps the artwork's own orange.

THE ART ITSELF WAS THE REAL CASUALTY. The playtester: "the middle part
of the pack with all the designs on it looks terrible." The module
embedded a 320x509 webp squeezed to 58KB, and the fine navy line-art had
been compressed into grey speckle. They posted the clean 1024x1024
source render, and the asset was re-cut from it at 708x1148, q88, 129KB.

And the re-cut taught an alpha lesson worth writing down. The pack sits
on a black starfield, so the cutout mask thresholded on brightness - and
the DARK NAVY ICONS fell below the threshold, punching alpha holes
through the artwork. Over the game's near-black overlay those holes read
as solid black blocks stamped on the design; composited over grey they
read as white. Diagnosis was fully confounded until the difference image
was checked against the alpha channel: every "corrupt" pixel sat at
alpha 0. A pack is a SOLID OBJECT: its alpha is its silhouette, holes
filled - flood-fill the background from the border and everything the
flood cannot reach stays opaque. (The erode/dilate that removes the
stars still shapes the outline; the flood fill un-punches the interior.)

Verified: 19/19 node --check, test-fishing 114/114, smoke-fishing 13/13,
smoke-spots 80/80, ripship 34/34 (now also asserts both halves render,
the art decodes, and the halves sit flush), economy 29/29, arcade 12/12,
and the sealed pack compared against the source render by eye.

## Batch 63 — TWO POCKETS: dollars for the business, credits for the arcade
The playtester picked "cash and tokens" from three shapes. Dollars are what
the collection earns and spends: mining income, level-up pay, selling and
shipping cards, buying packs and market cards, grading fees. Credits are
the arcade token - upgrades, the Keep, the tables, the water, the hunt -
and you buy them with dollars at THE CHANGE COUNTER.

HOW IT WAS DONE WITHOUT A 132-SITE REWRITE. `state.credits` appears 132
times across the host and nine modules. About 108 of those are the arcade
- the casino alone is 45 - and only 24 are the card business. So credits
KEEP their field and their meaning for the arcade, untouched, and a new
`state.dollars` was introduced at the 24 business sites. A quarter of the
diff, and every casino, upgrade, fishing and dungeon path is provably
unchanged because it was never edited.

THE MIGRATION IS THE DANGEROUS PART, and it has one non-obvious ordering
rule: it must run BEFORE loadState's backfill loop. That loop fills any
missing key from freshState, and freshState now carries dollars:100000 -
so once it has run there is no way left to tell an old save from a new
one, and every returning player would have been handed a free 100,000 on
top of their converted balance. Migrating first, while a missing `dollars`
still MEANS "written before the split", is what makes it safe. econV=2 is
the idempotence guard, so a reload can never convert a balance twice.
Balances convert one for one: what you had is what you keep, in dollars,
with credits restarting at zero.

The counter's base rate is 1:1, which is why nothing in the arcade had to
be repriced when the pockets split - every upgrade cost, casino stake and
tower price still means exactly what it meant. Changing more at once pays
better (+10% at $5k, +16% at $25k, +20% at $100k), so the only decision at
the counter is how big a handful to change, and small changes are never
punished.

EVERYDAY ITEMS 100 -> 750 (10-pack 900 -> 6,750). Rarity weights do not
vary by pack, so every pack holds roughly the same 600-900 in cards. Six
of the seven priced packs returned 0.41x to 0.78x - a fair gamble. Everyday
returned 6.32x, because it was priced at a tenth of packs holding the same
cards. At 750 it sits at 0.84x: still the best value on the shelf, which
is right for the pack a new player starts on, but no longer a printer.

A returning player wakes up with zero credits, so the counter has to be
findable. The credit chip in the header opens it, and carries a visible
"+" - because on a phone there is no hover and no title tooltip, which is
exactly the kind of thing a DOM check would have called fine.

New suite `docs/smoke-economy.py`, 29 checks, and it found two real
problems before shipping. First, `renderExchange` called `num()`, which
is a LOCAL of renderHeader, not a global - the counter threw the moment it
opened. Second, the first version of the test seeded localStorage after
navigating, which races the game's own autosave: the seed was overwritten
by a fresh state, and every migration check passed against freshState
instead of against the save it was supposed to be testing. Seeding through
add_init_script, before any page script runs, is what makes those checks
mean anything. Dollar comparisons carry a small tolerance because mining
accrues for the whole run; credits are never mined, so those stay exact.

Verified: 19/19 node --check, test-fishing 114/114, smoke-fishing 13/13,
smoke-spots 80/80, ripship 31/31, economy 29/29, arcade 12/12, and the
header checked for overflow at 390px and 430px.

## Batch 62 — the ledger tells the truth (SHIP was paying off the wrong table)
Batch 61 shipped with the verdict stuck on PACK PAID. The cause was not
the scoring rule, it was the price table. `rzVal` called `m2TrueVal`,
which reads MARKET_BUY_PRICE_BY_TIER - what a card COSTS in the market,
about five times what anyone pays for it. A Common priced at 40 to buy
sells for 8; a tier-8 at 2,800 sells for 520. Shipping paid 85% of the
BUY price, so a 100-credit pack returned well over a thousand and the
screen could not honestly say anything but PACK PAID.

rzVal now reads MARKET_SELL_PRICE_BY_TIER, with the same grading curve
the market applies, so a pull is scored at exactly what the collection
screen would pay for it. SHIP still takes 15% off that, which now means
something real: it is the price of the money landing NOW instead of
carrying the card to the collection screen yourself. KEEP scores full
value because a kept card - duplicate or not - can still be sold there
later. That is the decision the mode is named for, and it is finally a
decision.

This supersedes the note left at the end of batch 61, which proposed
scoring kept cards at SCRAP_VALUE. That was written before checking
which table m2TrueVal read. Scrap values run 1-250 against sell values
of 8-52,000, so scoring keeps at scrap would have flipped the verdict to
HOUSE WINS on essentially every pack rather than fixing it. Repricing
onto the sell table fixes both ends at once and needs no special case.

WHAT THIS EXPOSED, left for the playtester. With honest prices the shelf
splits cleanly: Animal, Myth, Machines and Cosmos at 1,000 return 0.56x
to 0.78x of their price, Tide 0.58x, Mega 0.41x - a fair gamble where you
are buying the chance at a rare. Everyday Items returns 6.32x. Rarity
weights do not vary by pack, so every pack holds roughly the same 600-900
in cards; Everyday is simply priced at a tenth of the others. It is the
starter pack, so it cannot just be raised to match - that is a balance
call, not a correctness one, and it is not made here.

Verified: 19/19 node --check, test-fishing 114/114, ripship 31/31.

## Batch 61 — RIP & SHIP (pack opening becomes a decision)
Handoff from the bench, integrated as `ripship.module.js` + `ripship.css`
(prefix `rz`, IIFE, no registry entry — it wraps the host's `startReveal`,
so the shelf, the ledger's grand prize and the market's lots all adopt it
at once). Opening a pack is now a ritual: drag your thumb across the foil
to tear it, flip the stack one card at a time, and call every pull — SHIP
for instant coin at 85% of market value, or KEEP it for the binder. A
running ledger line tracks cost against shipped against kept, and the
summary rules PACK PAID or HOUSE WINS with the best pull, a session
streak and one-tap RIP ANOTHER.

TWO CHANGES TO THE HANDOFF, both from reading the wiring rather than the
module. First, the handoff put `ripship.module.js` LAST in MODULE_FILES.
That would have broken the daily tasks: `ledger.module.js` already wraps
`startReveal` to count packs, and ripship does not call through on its
happy path, so loading ripship last would have made it the outer wrapper
and silently swallowed every `feLedgerBump("pack")`. Loading it BEFORE
ledger leaves ledger outermost and the count intact — no code change, and
the smoke now asserts `startReveal.toString()` still contains the bump.
Second, the tear drag could outlive the tear: pointer capture keeps
firing move events after the foil is open, which re-entered the flip
stage on every pixel. One guard, `if(!RZ || RZ.stage !== "rip") return`.

Also deepened the overlay scrim from .88 to .96 with a 3px blur. On the
summary screen there is no card panel, so the text sat on the backdrop
and the Packs tab's own controls read straight through it — "THE PACK
PAID" was landing on top of the auto-open dropdown. Caught by looking at
a screenshot, not by a DOM check; every DOM assertion passed while the
screen was muddy, which is the same lesson as batches 55 and 58.

New suite `docs/smoke-ripship.py`, 31 checks, drives the real page: the
wrapper order, pulls applied exactly once, a real pointer drag tearing
the foil, SHIP removing exactly one copy of exactly one id and paying
out, KEEP costing nothing and touching nothing, keep-the-rest, the
summary, RIP ANOTHER, and every other pack source — a granted pack
(price1 = 0, so no RIP ANOTHER), the market's bare `{name, key}` lot with
no icon and no price, and a ten-pack. Verified: 19/19 `node --check`,
test-fishing 114/114, smoke-fishing 13/13, smoke-spots 80/80, ripship
31/31, zero page errors.

ONE THING LEFT FOR THE PLAYTESTER TO CALL. The verdict counts kept cards
at full market value, so a 100-credit pack that yields ~3,000 in cards
reads PACK PAID every time — HOUSE WINS is close to unreachable and the
drama the screen is built around never lands. Fixing it is a balance
decision, not a correctness one, so it ships as delivered. The cheapest
lever if it wants changing: score kept cards at what they would fetch
scrapped rather than at market, so KEEP is a real cost against SHIP.

## Batch 60 — the claim overlay was reading as stacked layers
Reported as the layer duplicating whenever the camera moved. It was not a
rendering fault — a pan test rendered clean. Those were the claimable-
section highlights: 256px filled rectangles with hard yellow borders
drawn over the sea, several of them around an irregular island, stacking
into what reads exactly like duplicated layers. The cell grid made it
worse by running across water as well as land. The grid is now drawn on
owned cells only, and claimable sea gets a dashed edge with a plus in the
middle instead of a filled pane, so it reads as open water with an
invitation. Verified: 19/19 node --check, test-fishing 114/114,
smoke-fishing 13/13, smoke-spots 80/80, keep boot 13/13, plus the live,
world, folk, economy, claim, frontier and repair suites, and the
untouched board still 0.00% different from the build before build mode.

## Batch 59 — the collapsed board (frame the land you hold)
Reproduced from the playtester's screenshots. Claiming sections southward
made the world seven sections tall — 1792px against a 540px canvas — and
kpFit was framing the whole CLAIMABLE field, so it collapsed to z=0.29
and the island became a sliver lost in empty space. Worse, the area the
world canvas did not reach painted as dead navy, which is what made it
read as broken layers rather than a distant island. kpFit now frames the
land actually OWNED, with about half a section of sea round it, centred,
clamped so it cannot go below z=0.3; the claimable ring is still reachable
by panning. Anything beyond the world fills with open sea, so there is
never a void. Both gated on the world view, so a Keep nobody has built on
still renders 0.00% different from before build mode. Also split the two
HUD lines onto separate rows — the hold banner and the build line were
being written on top of each other.

## Batch 58 — build mode goes live, and the zoom regression it exposed
Build mode is now ON for every player. Nothing about the Keep looks
different until Build is tapped — same board, same waves, same income —
so this adds a door rather than changing the room. ?build=0 shuts it
again for anyone who wants the old screen, ?build=1 reopens it.
AND IT CAUGHT A LIVE REGRESSION SHIPPED IN BATCH 56. Stage 2 gated the
Build CHIP but not the CAMERA: kpFit() framed the owned sections, and
whole sections round UP past the drawn board (4x2 sections = 1024x512
against an 860x540 canvas), so kpFit returned z=0.84 and every player
has been looking at a Keep zoomed out 16% with the framing shifted.
Nothing caught it because the keep boot check only asserted the canvas
was sized and painting — never that the framing was UNCHANGED.
THE FIX: kpGrown() — has any sea actually been claimed? Until it has,
kpBounds returns the board rect, kpWorldPx returns the canvas exactly,
kpBg takes the ORIGINAL sea loop with no claimed-section grass, and
kpFrame skips the camera transform entirely. Proven, not asserted: the
untouched Keep now renders 0.00% different from the build BEFORE stage
2 existed (121,880 sampled pixels, zero differ), where current main
differs by 95%.
Lesson, and it is the same one twice now: a visual feature needs a
VISUAL test. Both times the checks passed while the screen was wrong,
because they measured that something rendered rather than that it
rendered THE SAME. Pixel-diffing against a known-good build is cheap
and would have caught this at the source.
Verified: 19/19 node --check, test-fishing 114/114, smoke-fishing
13/13, smoke-spots 80/80, keep boot 13/13, live 9/9 (plain visit shows
Build, board at rest, map row and towers intact, ?build=0 hides it and
sticks, ?build=1 restores), world 11/11, folk 9/9, economy 7/7.

## Batch 57 — the folk earn their keep (a proposed economy)
The folk were placeable but inert, and "tell me what they should be
worth" was the wrong answer — proposing the numbers is the job, the
playtester adjusts them. So here is a first economy, tuned to be felt
without replacing the waves, and every value sits in KP_FOLK_DEF so it
is one line to retune.
EACH TRADE HOOKS SOMETHING THE KEEP ALREADY DOES, so none of them is a
number floating on its own. MINER +0.6% mine rate each, folded into
kpBonus() beside the wave bonus, so it rides the same suppression
multiplier — miners earn less while the gate is under pressure, which
is the right pressure. WOODCUTTER +1 scrap/min each, accumulated in
kpTick and banked a whole unit at a time; it is the only steady scrap
source on this screen. MERCHANT −4% off the next stretch of sea each,
floored at half price, so the trade folk are what make expansion
affordable — which ties them to the feature's core loop rather than
being a side stat.
COSTS AND LIMITS: hiring is 3,000-4,000 credits rising 1.5-1.6x per
hire OF THAT TRADE, so a fourth miner is dear but a first woodcutter is
cheap — the curve pushes toward a mixed crew. Letting someone go
refunds half. The crew is capped by sections held, same as towers, so
claiming sea remains the thing that unlocks everything.
The palette shows each trade's count and next price, and a crew line
reads back the live totals (mine %, scrap/min, sea discount) so the
player can see what the settlement is actually doing.
Verified: 19/19 node --check, test-fishing 114/114, smoke-fishing
13/13, smoke-spots 80/80, keep boot 13/13, world 11/11, folk 9/9, and a
7-check economy suite proving each effect MOVES — miner raises the
bonus, merchant lowers the sea price, woodcutter's scrap climbs under a
fast-forwarded sim, hiring charges, the per-trade price rises, and the
crew cap tracks land.

## Batch 56 — THE ISLAND GROWS (build menu, claimed sea, the folk)
What was actually asked for; stage 1's tap-a-square wall tool was not it.
THE BOARD IS NO LONGER THE CANVAS. The world is a field of SECTIONS
(4x4 cells, 256px) the player claims with credits, pushing the island
out into the sea. kpBounds() is the extent of what is owned and the
camera frames exactly that, so the island growing IS the view pulling
back; zoom in and drag places detail, "fit the island" returns. This
also dissolves the sea-margin complaint outright — unclaimed water
surrounds you by definition, and it is the thing you are buying.
BUILDING IS A MENU: claim sea, wall, stairs, path, tree, rock, the four
towers, merchant, woodcutter, miner, remove. Towers are PLACED where
you choose instead of upgraded in fixed slots, and kpTowerCap() ties
the allowance to sections held — so claiming sea is what buys towers,
which is the land-grants-towers economy landing on a mechanic.
THE FOLK ARE DRAWN HERE. Merchant, woodcutter and miner exist nowhere
in the Tiny Swords art cut for this game — checked every module, hunt
has only monsters. kpFolkImg() plots them on a 16x20 grid at 3x with
fillRect blocks, two frames each, so they sit on the same chunky pixel
grid as the sprites beside them rather than reading as smooth art
dropped in. They do NOT block the road; they are drawn live in kpFrame
rather than baked into the bg, so they animate.
PATHING FOLLOWS THE LAND: kpSpawnCell() walks in from the far edge of
what is owned, so buying eastward moves the spawn out with it instead
of stranding it mid-island; unclaimed sea is impassable; sealing the
last way in is still refused and rolled back.
Two things worth remembering. Cells live in the map's LOWERED frame —
the base ground fills the canvas at y=0 but map content rides at
+KP_OY, so owned-section grass has to be drawn at r*CELL+KP_OY or the
land sits 90px above the mobs walking it. And kpFrame draws sheep and
the patrol AFTER the held banner, so the camera reset for the HUD
belongs at the very end, not before the banner, or the ambient sprites
snap into screen space.
Verified: 19/19 node --check, test-fishing 114/114, smoke-fishing
13/13, smoke-spots 80/80, keep boot 13/13 (live game still shows no
Build chip), an 11-check world suite (palette, claiming sea, the
charge, route surviving growth, placing a tower, zoom, fit) and a
9-check folk suite (all three place, all three sprites actually render
with pixels, none of them block the road).
All of it behind ?build=1, which wakes build mode in the LIVE game on
the player's own save — a preview folder or a separate page starts with
no credits and cannot test an economy at all.

## Batch 55 — BUILD MODE, stage 1 (walls that bend the road)
The first real piece of the maze rewrite, and it needed far less than
the brief feared. THE FREE LUNCH: kpPathPointRaw maps a mob's progress
scalar onto whatever polyline KP_PATH happens to hold, so REPLACING
that polyline with a computed route makes movement, targeting, archer
fx and the drawn road all follow the maze with the sim untouched. No
2-D rewrite was needed for stage 1.
SHIPPED: a 13x7 grid of 64px cells; a 🔨 Build chip; tap a square to
raise or clear a wall; breadth-first route from spawn cell to gate cell
around the walls; and sealing REFUSED — the placement is tried, and if
no route survives it is rolled back with "That would close the last way
in". An untouched board keeps the hand-drawn road, so nothing changes
visually until the player builds. Walls persist in state.keep.kpBuild
keyed by map, a field the live game simply ignores.
GATED, DELIBERATELY: KP_BUILD_ENABLED is true only when
location.pathname contains "/preview/". The code ships to root but
never wakes there, so a future root rebuild cannot surface an
unapproved feature — and because the gate reads the URL rather than the
bundle, the LIGHT preview works: 274KB of index.html over root's own
javascript, no 33MB duplicate.
TWO BUGS, BOTH MINE, BOTH FOUND BY PROBING RATHER THAN ASSUMING. (1)
kpBg() reassigns KP_PATH = MP.path every call, so the route has to be
recomputed INSIDE kpBg before the road is painted or mobs walk a maze
that isn't drawn. (2) The first pathfinder treated terraces as
impassable, which made every single placement get refused: the Meadow's
gate sits at y=116, INSIDE its own plat, so the goal cell was
permanently blocked and BFS always returned null. Terrain does not
block now — the authored roads already climb terraces by stairs, so it
never was a barrier. Lesson: when every action is refused, suspect the
goal, not the move.
Also: a first screenshot showed no walls because the test mutated the
walls object directly instead of clicking. kpBg only repaints from the
real handler. Probe through the handler — same lesson as Batch 54.
Verified: 19/19 node --check, test-fishing 114/114, smoke-fishing
13/13, smoke-spots 80/80, keep boot 13/13, plus a build-mode suite
(chip absent on live, present in preview, wall raises, route bends to
18 cells, seal refused and rolled back) and a clicked-through maze
screenshot with zero page errors.
NOT YET: towers are still the four upgrade levels at fixed slots, and
land is free to raise. The land-buys-towers economy and placeable
towers are stage 2.

## Batch 54 — somewhere to playtest (preview/) + the phone-width stage
Playtest feedback on 53: "the play screen is too small and the island
covers the whole visible screen." Both reproduced and measured. THE
STAGE ON A PHONE: #kpCv sits inside two 16px paddings (main + .panel),
so a 390px screen renders the 860x540 scene at 324x203 css px. Note 53
made this BETTER, not worse — the taller stage took it from 324x151 to
324x203; the smallness is an older mobile-layout constraint.
THE ISLAND: on the Isle the land runs edge to edge — margins measured
from frame edge to land at the midline are L4 R0 T46 B46 of 860x540.
The only open water is a 46px band top and bottom, which at the phone's
0.38x scale is ~17 screen px. The surf and bobbing rocks render fine;
there is nowhere to see them. Sea fills 26.7% of the frame but almost
none of it is where you look.
SHIPPED: preview/ — a playable copy at /Odds-Ends/preview/ built by
workshop/make-preview.py, layering workshop/preview.css over a normal
build so a change can be tried on a phone with the root untouched. The
light mode repoints script tags at ../oe-*.js: 274KB instead of ~33MB,
auto-tracks root's js, and CANNOT show module changes (--full for
those). First preview carries the full-bleed stage: 324x203 -> 390x245,
no horizontal overflow, zero page errors, desktop untouched at its
880px cap.
NOT SHIPPED, deliberately: the island's geometry. The Keep is not a
spatial tower defense — a mob's position is a SINGLE SCALAR marching a
fixed polyline (`f2.x -= f2.spd*dt`), turned into screen coords by
kpPathPoint(x) off the map's hardcoded path array; towers target by
comparing those numbers (`tgt.x > t.x`); there is no grid and no
pathfinding anywhere. The terraces and switchbacks are decoration drawn
around a 1-D lane. The stated goal — players building mazes out of
tiers — needs 2-D grid positions, repathing on every build, and 2-D
range checks: a rewrite of movement, targeting and rendering. Reshaping
the Isle's polyline now would be thrown away by it, so the sea-margin
numbers above become a REQUIREMENT for the new map format instead.
Lesson: probe through the real handler, not the state. A first pass set
state.keep.map directly and "proved" the background never redrew on a
map switch — kpBg() is called from the chip's click handler, which
setting state bypasses. The bug was in the probe.

## Batch 53 — the Keep grows up (and a false alarm that nearly held it)
Feature-bench batch: the Keep's stage grew to 860x540, the sea now
ANIMATES (surf foam, rocks bobbing around the Isle), and all four maps
CLIMB — every path ascends stairs to a terraced castle, capped by the
Highlands' three-tier switchback cliff defense. keep.css came back
byte-identical, so index.html was untouched; the rebuild moved only
oe-16-keep.js and modes/keep.module.js. No wiring, as before. Numbered
53 — the handoff proposed "51+51b" and both were long gone.
THE REAL STORY IS THE FALSE ALARM. smoke-spots failed three times on
the batch tree (stalling at 7, 28 and 46 checks) while origin/main
passed 80/80 twice, run INTERLEAVED between them. That looked like
attribution, so the batch shipped to a branch as BLOCKED with a draft
PR recommending against merge. After merging anyway on the
playtester's call, the SAME CODE passed smoke-spots 80/80 three times
running, plus smoke-fishing 13/13, test-fishing 114/114, node 19/19
and a 13-check Keep boot probe. The failures never reproduced and no
cause was ever found — no stray chromium, 14.7GB free, disk fine.
LESSON, and it is a rule now: smoke-spots is a ~20-minute browser
suite built on fixed waits, so an alternating 3-vs-2 is comfortably
inside chance. RUN SEVERAL PER CONDITION BEFORE REPORTING, not after.
The tell was already in hand and read backwards: four plausible
mechanisms had each been disproved — the !cv.offsetParent guard was
intact and identically placed, the Keep's rnd is a local LCG that
never touches the host's, load was 3.34s vs 3.39s at 61fps both ways,
and every global was KP_-prefixed and unique. Having eliminated every
route by which the batch could reach fishing, the conclusion should
have been "flake", not "blocked". Calling the interleaving the
STRONGEST evidence inverted it; against a flaky suite it is the
weakest. Verified post-merge, all green as listed above.

## Batch 52 — THE KEEP'S SELECTABLE MAPS (four lands, real elevation)
Feature-bench batch, integrated here. The Keep's territories became four
SELECTABLE maps instead of a one-way claim ladder: stone terraces with
grass crowns, stairs the road climbs, a bridge on the Isle, pines, and a
new double-terrace map THE HIGHLANDS (1,000,000 credits + 1,000 scrap,
+6% base pay). Selector chips replace the old claim row, owned maps
switch freely, and purchases migrate off the old territory levels
automatically. Two files only — keep.module.js + keep.css; the Keep was
already wired (css list, MODULE_FILES, tab-keep splice, host UI_GAMES),
so integrate.py was untouched and all 24 once() edits still applied.
NUMBERED 52, not the 51 the handoff said: 51 was already spent on the
build-unblock batch, and the log's headings are unique now — check
before claiming a number.
THE FILES CAME BY GITHUB UPLOAD, NOT THROUGH THE SESSION, which matters:
uploading workshop/*.js updates the SOURCE only. index.html and
oe-16-keep.js still carried the old three-territory Keep until the
rebuild ran here (grep 'Highlands' told it: 1 in workshop, 0 in the
built output). A workshop-only upload is a half-deploy — the golden
rule cuts both ways.
LESSON, integration review: a naive top-level grep flags W, cv, bg, IMG
and stage as colliding with hunt/mining2. They are NOT global — line 10
of the module is `(function(){` and those live inside it, written
unindented. Check for an enclosing IIFE before calling a redeclaration;
the same shape appears in hunt and mining2 and has always been fine.
Verified: 19/19 node --check, test-fishing green, smoke-fishing 13/13,
smoke-spots 80/80, zero page errors. Plus an ad-hoc Keep boot check
against the real built page — all four maps in the selector row, a chip
each, canvas sized AND painting non-blank pixels, and no errors after
the sim had run a few seconds. Rebuild touched exactly three files:
index.html, oe-16-keep.js, modes/keep.module.js.

## Batch 51 — the last three /home/claude paths (build unblocked)
Health check from a clean clone: `python3 workshop/integrate.py --out .`
died instantly on FileNotFoundError — the 2:3 background swap still
read the ABSOLUTE chat-bench path /home/claude/assets/bg2x3.txt.
Batch 50 made the source/module/css/modes reads HERE-relative and
missed this one because it is a bare open(), not the read() helper.
The asset was never in the repo, so the build was unreproducible from
a clone; it survived only because the built root files were committed.
RECOVERED the asset out of the committed oe-01-core.js (FSH_BG_URL
literal -> base64 -> valid JPEG, 1200x1800, exactly 2:3, 152KB) and
parked it at workshop/assets/bg2x3.txt; the swap now reads it
HERE-relative through read(), .strip()ed (a trailing newline inside
the "..." literal would SyntaxError every later file) and aborts with
a named message if missing, matching once()'s fail-loud contract.
PROOF the recovery is byte-exact: built to a scratch dir and cmp'd all
20 root artifacts against the committed ones — index.html + 19 oe-*.js
all identical, which also proves workshop/ has not drifted from the
deployed root. Same bug class in the verifiers: both smokes hardcoded
file:///home/claude/build/index.html, so neither could run here; both
now resolve the repo root from __file__ (OE_INDEX/OE_URL override).
Lessons: (1) grep for the machine name, not just the helper — one bare
open() outlived a whole location-independence pass; (2) a generated
artifact committed to the repo can hide a missing SOURCE input
indefinitely — a build only proves itself from a clean clone; (3)
committed output doubles as a recovery source for a lost asset.
modes/ IS NOW TRACKED, closing the last fresh-clone gap: it is a
build-time COPY of the 16 workshop modules (13MB, byte-identical to
workshop/*.module.js) and docs/test-fishing.js reads three files out of
it, so while it was untracked the node harness ENOENT'd on a fresh
clone until someone ran the build first. Committing it is what the
deploy section has always said to do (index.html + oe-*.js + modes/);
it is duplicated bytes, but the harness is the thing that has to work.
Checked before committing: all 16 byte-identical to their workshop
sources, 16/16 node --check, and the set matches integrate.py's
MODULE_FILES exactly. AND THE DUPLICATE IS GONE: this file carried a
956-line block twice over — everything from '## Batch 50' through
'## Batch 17' (68 headings), back to back, ~38% of the log. The SECOND
copy is the one cut, and which copy was NOT arbitrary: a lone
'## Batch 16b' entry sat BETWEEN the two, so cutting the first would
have stranded it above Batch 50 and broken the descending order —
cutting the second leaves 17 · 16b · 16 · 15d · 15c reading right.
Both options were simulated and their batch order compared before a
line was touched. Verified by a scan that ASSUMES NO ANCHOR (hash
every 30-line window, extend collisions to maximal exact repeats):
exactly one repeat before, zero after. 171 headings (103 unique)
became 103, all unique, heading SET unchanged; none of the 888
distinct lines vanished; and cut + removed slice reconstructs the
original exactly, proving nothing outside the block moved. 2522 lines
-> 1567. Lesson: describe a repeat by its HEADING SPAN, never line
numbers — this entry lives in the file it documents, so editing it
moves the very lines it cites, and two ranges here went stale that
way before the anchors were switched.
Verified this batch, all re-run inside a fresh clone: 24 once() edits
applied, 19/19 node --check, test-fishing all green, both playwright
smokes pass (13 fishing checks / 60 spots checks, zero page errors).

## Batch 50 — THE WORKSHOP MOVES INTO THE REPO (Claude Code era)
Prep for playtester driving deploys/tweaks via Claude Code on the
web (phone, Code tab, cloud VM, PR flow). integrate.py made
location-independent: HERE-relative reads (source, modules, css,
modes copies), --out <dir> flag (default HERE/build keeps the chat
bench unchanged; repo usage: python3 workshop/integrate.py --out .
from repo root). New artifact odds-and-ends-workshop.zip: repo root
= built game (index.html + 19 oe-*.js + modes/ + docs/), workshop/
= source-pristine.html + integrate.py + 16 modules + 13 css, plus
CLAUDE.md at root: golden rule (never edit generated root files),
architecture map, the ten hard-won build rules, verify commands,
deploy + docs-log conventions. Verified: bench build unchanged,
repo-layout build parses all 19 files and boots via file:// with
11 cards, zero errors. Chat sessions remain the feature bench; the
repo is now self-building for Claude Code sessions.

## Batch 49 — THE MULTI-FILE MIGRATION (the ceiling comes down)
integrate.py now ships a folder: slim index.html (273KB — html/css +
19 <script src> tags) + oe-NN-name.js files. Mechanism: the build
still assembles the single html string through EVERY existing splice
untouched; each module joins wrapped in /*@@SPLIT:name@@*/ sentinels,
and a final explosion pass regex-splits every <script> block on the
sentinels into ordered files (core, one per module, tail), replacing
blocks with src tags. Top-level const/let in classic scripts stay
visible across files, so module boundaries are safe split points.
Stale oe-*.js cleaned each build; module sources auto-copied to
build/modes/ for the node harness. File census: boot 6.1MB, core
1.5MB, fishing-assets 3.2MB, sfx 2.2MB, fishing2 5.3MB, hunt 533KB,
keep 443KB, mining 474KB + smalls — largest file 6.1MB vs the 25MB
PER-FILE GitHub cap: the byte ceiling is effectively gone, and
browsers now cache art/music files so updates re-download only what
changed. Verified: all 19 files node --check, zero stray sentinels,
full boot probe on file:// (relative srcs work), test-fishing green,
both smokes green. SHIP RULE CHANGED: the zip is the only artifact;
a lone index.html is now useless — every deploy uploads ALL files
together. Single-file era: Batches 1-48. This is the new world.

## Batch 48b — the load race (playtester phone screenshot)
Preset heroes rendered as floating swords/partial bodies on device
while the Guard + crafted hero drew fine: preset sheets compose at
first draw, and on a 21MB page the kit Images arrive AFTER my fixed
1.5s/4s redraw passes — the crafted hero worked only because it was
composed post-load. Fix: kimg() sets kitDirty on EVERY image onload;
a 400ms watcher drains the flag and recomposes all HCOMP sheets, so
late arrivals always land; 2.5s belt-and-suspenders pass kept.
Verified under CDP-throttled network: full warband dressed. Lesson:
never time-box asset readiness — event it.

## Batch 48 — THE HERO FORGE (player-crafted heroes) + composed everything
All hero art is now RUNTIME-COMPOSED from an embedded component
library (HU_KIT, 139KB): 6 skins, 7 faces, 17 cloths x 3 dyes
(top+bot pre-merged per variant), 12 hair styles x 3 shades x 2
layers, 5 weapons x 2 layers — each variant a 6-cell strip (idle
r0c0/c3, attack1 r5c1/c3, casting r10c2/c4). The ten preset classes
became RECIPES; the baked Tiny Swords + composed sprites were
deleted (net whole-feature cost +85KB). Heroes draw from per-recipe
offscreen sheets (composeHero -> 250x100 cells, HU_S=2.5 — the
size bump playtester asked for), imageSmoothing off, delayed
__redraw passes at 1.5s/4s cover async kimg loads. THE FORGE:
works-row button opens a modal — 7 cycling pickers (skin/face/garb/
dye/hair/shade/arms), live animated preview, name input — craft
consumes credits+scrap and pushes the recipe into state.hunt.custom
(max 5). Tier table: 75k/100sc/900dps -> 1.2M -> 15M -> 200M ->
2.5B/4000sc/2.2M dps; customs are permanent single units at
reserved slots with purple name labels, join the dps pool and the
attack-pulse rotation (weapon5 = orb caster, others melee).
Probed: modal, pickers, craft ('Ashka', cleaver), payment, on-field
w/ label, zero errors. Weapon picker names: Blade/Cleaver/
Twinblade/Spear/Orb.

## Batch 47 — THE WARBAND (Heroes99 classes, battle line, monk fix)
Heroes99_v1_2 = a layered paper-doll kit: 800x680 sheets, 100x40
cells, 17 anim rows (verified empirically — row cell-counts match
frameguide_v2 exactly: idle r0, attacks r5/6/7, casting r10). Layer
STACK LESSON: cloth _top files can be EMPTY — garments live in _bot
which renders ABOVE skin (only hair/weapon split behind/front);
first compose rendered naked heroes. pick() falls back across color
variants per component. SIX NEW CLASSES composed (skin+cloth+hair+
face+weapon, 2x nearest): Rogue 350/3, Duelist 4.5k/22, Dragoon
30k/110 (spear), Berserker 250k/620, Occultist 900k/1650 (purple
orb projectile w/ ring), Revenant 4M/4800 — ten hunters total, all
in one west-side battle-line formation. BEAST MOVED EAST (W-190):
clear side-vs-side; volleys retargeted. DISAPPEARING MONK ROOT
CAUSE: findu('Heal') glob matched Heal_Effect.png (sparkle overlay,
near-empty frames) before Heal.png — attack frames were invisible
glints; re-extracted from Heal.png [2,5] explicitly. Net art cost
+31KB. Probed: full 10-class warband vs shark on the sands, kill
pays, death-shrink, zero errors.

## Batch 46 — THE TEN-ZONE JOURNEY (Captainskeleto scene packs)
Playtester uploaded 14 background packs (57 scenes, 200x128 pixel
art) asking for scenes with STANDABLE FLOORS. All 57 eyeballed on
contact sheets; vistas (ocean islands, mountain panoramas, water-
heavy lagoons) rejected; ten keepers form a descent, one per boss
tier (zone now every 10 depths): Blooming Vale -> Hidden Lagoon ->
Endless Sands -> Mistwood -> Verdant Hollow -> Frozen Throat ->
Emberworks -> Warded Deep -> Bleeding Halls -> Forgotten Keep.
Each embedded whole at 200-color quantize = 99KB for ALL TEN; the
5 unused arena-pit floors excised from HU_ART (-80KB) = net +19KB.
Scenes drawn full-bleed w/ imageSmoothingEnabled=false (crisp 4x
nearest), TOP-cropped so the floor survives (H-512 offset), per-
scene gy ground line in meta; beast + party grounded on gy with
shadow ellipses, depth-staggered gyOff per hero; volleys re-aimed
from grounded origins; top vignette keeps the hp plate readable;
zone name flourish under the plate. Probed 3 zones w/ screenshots:
vale/ice/dungeon all grounded, zero errors. Runeshard (playtester's
old game w/ animated heroes) — no trace in project memory; noted
that those hero files can be uploaded any time.

## Batch 45b — THE LIVING PARTY (hired heroes on stage)
The hired party now stands the west rim of the pit, animated:
Squire = Free-Pack Blue Pawn (idle + INTERACT HAMMER swing — the
Attack glob found nothing, the hammer interact IS the swing),
Archer = Blue Archer (Idle+Shoot + the pack's actual Arrow.png as
the projectile sprite), Pyromancer = RED Monk (Heal cast = fire
invocation), Slayer = Purple Warrior (Attack1). 47KB total, 4
frames each (idle x2 / attack x2). Every 250ms dps pulse picks a
random owned hero: melee get a lunge translate, ranged spawn a
volley — arrows fly the pack sprite rotated along an arced path,
pyro throws a flickering fire orb. xN count badges under stacked
hunters. Probe lesson RE-LEARNED: seeding state.hunt with a NEW
object after load orphans the module's captured reference — always
Object.assign into the existing object. Party verified attacking a
425hp Guard-of-the-24th panda, arrow mid-flight, zero errors.

## Batch 45 — THE HUNT (our Endless Hunt, in our voice)
Playtester asked for a close copy of Ashbound: Endless Hunt (Steam,
July 2026: click-combat, waves+bosses, 100 weapon tiers, party,
relics, prestige). Built the MECHANICS in Odds & Ends language —
own name, own skin, our economy. hunt.module.js (327KB incl 236KB
art) + hunt.css + tab-hunt + UI_GAMES card + ledger 'hunt' kind.
ART: the Dungeon Arena pack turned out to be 10 circular battle
FLOORS (not monsters) — 5 embedded at 300px as zone stages (one per
20 depths); bestiary = 7 unused Enemy Pack species (lizard/skull/
shark/bombfish/sling/panda/turtle, 2 idle frames, 110-130px) +
3 Guards as bosses (minotaur 172px / panda / skull). LOOP: beast hp
14x1.16^depth, boss x6 every 10th w/ 30s timer (timeout = retreat
one step, no death). Tap dmg 2x1.5^(weapon-1); 10%% crit x2.5.
Party: squire/archer/pyro/slayer, cost x1.35^n, 250ms dps tick.
THE SMELTER TIE: forging blade T(n+1) consumes ingots — tier
min(7,1+floor(w/3)), count 1+floor(w/5). Kills pay hp/3 scaled by
zone; 2.2%% card drop (22%% boss) straight into the binder. REKINDLE
at depth>=15: embers = floor((d-10)/5)+1; depth resets, blade+party
+embers persist; each ember +2%% all damage AND +0.5%% mine rate
(fourth wrap, __huWrap). Probe: taps kill, idle dps advances alone,
forge ate 2x T3 ingots, boss retreat 10->9, rekindle +3 embers,
rate x1.066, zero errors. Canvas: torch glow, shake/flash/slash
arcs, crit numbers, boss timer bar, death-shrink.

## Batch 44 — sheep, bombers, and the door to multi-file
Selective expansion (+~95KB): HappySheep idle x2 — three drift as an
ambient flock on the hamlet rise; TNT goblin (7x3 grid, run+throw)
joins waves at w5; Barrel goblin (4x4, fast roller, 1.5x bulk) at
w9. Full 6-frame animation upgrade for the whole cast is EXPLICITLY
deferred to the multi-file era — the standing recommendation is now
the plan: next session restructures integrate.py to emit index.html
+ assets/*.js (art blobs split out), zip carries the folder, GitHub
Pages serves it unchanged, ceiling gone. Verified: bombers in the
spawn pool, flock drawn, zero errors.

## Batch 43c — TERRACES (the layers from the cover art)
plat() helper: elevation-tile 9-slice tops + cliff-face wall strip +
offset drop shadow = stacked plateaus. The keep commands a 4x3
western terrace (cobbled face reads clearly); lands 1+ add a high
shelf behind the walls and an eastern hamlet rise; land 2 adds a
south bluff. Path waypoints re-routed to clear the cliffs; castle
and houses seated on their rises. Honest visual note: the small
rises read subtly because e-tile tops resemble g-tiles at this
scale — deeper terracing (stairs, 3-level stacks) is a future pass.
Byte answer for the record (playtester asked if the WHOLE pack was
usable): raw pack ~30-40MB of sheets vs 25MB single-file GitHub
ceiling — wholesale NO, selective YES (+sheep/full 6-frame anims
~300KB, goblin bombers ~150KB, enemy camp ~60KB)... OR ship the
repo multi-file with an assets/ dir and the ceiling disappears;
GitHub Pages doesn't care. Recorded as the standing recommendation.

## Batch 43b — THE LIVING KEEP (the promo-picture rework)
Playtester wanted the Tiny Swords cover feel: a settlement you OWN
and check on — not a side lane. Rework: top-down diorama. The sim
stays 1D (all combat logic untouched, still verified) and RENDERING
bends it along KP_PATH, a 7-waypoint winding road from the east edge
to the gates — kpPathPoint(x) maps sim-x to the polyline; units
painter-sorted by y; arrows + castle-hit fx remapped. kpBg paints
sea -> tiled grass isle (land-2 insets the coast + foam) -> plateau
(elevation tiles, lands 1+) -> the dirt road (stroked polyline,
3-pass) -> village houses (1/2/4 by land) -> seeded decos kept off
the road. Ambient PATROLS: two guardsmen wander the fields off-duty.
ALPHA BUG: FASTOCTREE quantization matted the big sprites (grey
plate behind the castle, white foam boxes) — castle/towers/house/
foam re-embedded as straight RGBA (+120KB, module 410KB). Verified:
both land purchases, battle on the path, zero errors.

## Batch 43 — TERRITORIES (real Tiny Swords terrain, purchasable)
Playtester asked for tiled battlefields instead of the gradient
plain, with bigger areas purchasable — and asked if it was too big
byte-wise. It wasn't: a 27-piece tile kit (flat 9-slice, elevation
9-slice + wall, water, foam frame, 4 decos, blue house) costs 39KB
embedded ONCE and paints ANY map into the offscreen bg. Three lands
in KP_LANDS: The Meadow (free), The Rise (75k+150 scrap: elevated
plateau + house, +2%% base keep pay), The Isle (300k+500: sea
horizon, eastern water channel with foam, dense decos, +4%% base).
kpBg() composes per land with seeded decos; purchase row above the
tower shop repaints live. Fixes en route: Bridge_All is a multi-
piece SHEET (drew as fragments — replaced with a water channel) and
the house width read naturalWidth pre-load (0 -> squish; sized from
KP_TILES meta instead). Verified: both purchases, rate 105->107 at
land 1, zero errors.

## Batch 42b — the runaway bell (playtester screenshot: wave 34 off one win)
The wave-clear check fired every frame of the BETWEEN-WAVE PAUSE
(empty field looked like a fresh clear; the setTimeout(100ms) reset
made it ring ~10x/sec) — one real win rang up 33 waves and then
spawned a x77-hp horde. Fix: a true lifecycle — sim.waveActive set
when a wave spawns, the clear branch requires it and consumes it;
no timeout hack. One-time save heal (K.fix42b): any save past wave
4 resets to wave 3 / cleared 2 / supp 0. Rebalance while in there:
wave size 3+0.6w cap 16 (was 0.8w/22), hp 1.12^w, foe atk 1.10^w;
warriors 70hp/9atk, archers 38/6, Barracks base interval 3.2s;
suppression decays 0.018/s whenever no foe is within 220px of the
gate (was: only on a fully empty field). Verified: heal fires on
load, cleared increments exactly once per real wave, idle pause
holds steady. Lesson: state machines beat timers — a flag consumed
at the transition can't double-count; a timeout can.

## Batch 42 — THE KEEP (idle tower defense, Tiny Swords)
New Play mode: keep.module.js + tab-keep section + UI_GAMES card.
ART: 118KB embedded cut from three Tiny Swords zips — blue castle,
4 tower colors, warrior+archer (grid sheets 192px, rows walk/attack,
2 frames each), five enemies from per-action strips (gnome/thief/bat
192px, troll 384, minotaur 320), alpha-trimmed + quantized 160c.
DESIGN AS PITCHED + SHARPENED: the castle NEVER dies — the Keep pays
a %% bonus on currentMineRatePerMin (third wrap, __kpWrap): 5%% +1%%
per wave cleared, eaten by SUPPRESSION (foes reaching the gate add
1.2%%/hit, decays only while the field is clear; smoke plumes scale
with it). Towers: Barracks/Archery spawn (interval scales w/ level,
troop cap 3+levels), War Banner +15%%atk aura, Chapel regen aura;
costs 1.9x scaling in credits + scrap/100. Waves ramp n=3+0.8w cap
22, hp x1.14^w; troll joins at w4, minotaur w7. Every 5 cleared: the
CHOICE banner — Advance (choiceAt += 5) or HOLD THE LINE (held flag
freezes wave spec + income growth; resumable from the bar). Ledger
gains a keepwave contract kind. Sim exposed as __kpSim w/ debugFast
for probes. Verified: 9 waves cleared at 14x, rate 105->114, choice
shown, hold sticks, zero errors. Two-frame toggle animation reads
charmingly at 56-92px.

## Batch 41 — THE BACK ROOM LEDGER (all five casino asks)
E: the Sorting Wheel's zombie Reputation wedge now pays 3 VEIN ORE
(tier from collection level, into state.mining.ore) — payout branch
+ both odds blurbs rewritten. A: HOUSE STANDING — logWager wrapped
once (__c2WagerWrap): every wager feeds standingXP; ranks Nobody /
Regular 50k / High Roller 500k / Comped 2.5M with a daily comp claim
(500/2500/8000). D: HOUSE SPECIAL — seeded daily featured table
banner + a floor-wide daily contract (wager 4k + 3 wins, tracked via
the logWager/logWin wraps) paying 2k+5 scrap; honest note: per-game
prize DOUBLING was skipped (no shared payout seam — each game pays
inline). B: THE HIGH TABLE — Scrap Flip (even odds double-or-dust),
Ore Duel (stake 3 ore, 55%), CARD STAKE (46%: win a card one band
up from a clean pool; lose: the card BURNS, slab deleted with it).
C: FORTUNE & FOLLY DRIVE — set meter (owned/350), pity wrap on
openOnePack (every 5th risk pack swaps in an unowned F&F), completion
grants +1 permanent luck level. All probed green in one pass: rank
climb, comp, special, flip, duel, band-up stake, ore wedge, pity
counter. casino2.module.js + css, spliced after market2.

## Batch 40 — the second cull (siege, raids, scrapstorm)
Siege + Raids left UI_GAMES (host sections dormant + css-locked like
Empire); the Raid Supplies pack EXCISED from PACKS by brace-walk
(the false&&{} trick left a literal false element that threw at load
and TDZ-poisoned UI_GAMES — arrays don't skip falsy, they keep them);
~200 Raid Gear cards SLEEP in data (card ids are array indices —
removal shifts every save) but hide from the binder: getFilteredCards
drops the category, uniqueOwned + denominators count visible cards
only. Scrapstorm fully deleted from integrate (module read, section,
three hook lines, UI_GAMES card) — repairing the hook edits taught a
NEW splice lesson: those lists are Python implicit-string-concats
ending in + anchor; deleting the last line strands the concat and
SyntaxErrors the build script itself. Play lobby is nine cards now:
fishing, poker, casino, dungeon + five puzzle modes. 340KB back.
Boot-verified: all tabs, shelf clean, denominator excludes sleepers,
zero errors.

## Batch 39 — THE WORKSHOP (option D: the torn wallet)
Seventeen big-ticket scrap upgrades in a new Workshop category on the
Upgrades tab (4th container + groups entry; retired:true hides
Sturdier Pickaxe and Hire a Miner — grandfathered levels keep paying;
the forge owns mining progression now). The roster, all WIRED:
MINE — Second Crucible 4k (two smelt jobs; M.job legacy healed into
M.jobs[]), Forge Bellows 2.5k x3 (-20%/lvl time), Prospector's Eye 6k
(+1 ore, 10% tier-up w/ RICHER floater), Blast Charges 1.5k x3
(rock 20->14 hits). WATER — Board Pins 3.5k (4th bounty), Chum
Barrels 2k x2 (4->8 casts), Marksman's Discipline 5k (ring 36->50px,
x1.25), Rival's Purse 8k (weekly pays double). DESK — Third Desk
Slot 7.5k, Professor's Favor 12k x2 (grades <=4 re-rolled per lvl),
Storefront Sign 5k (bail halved, cut 7%). COUNTER — Silver Tongue
4.5k x2 (+15%/lvl odds, retry at mastery), Back Room 9k (extra
premium visitor: vault card or double-sealed lot), Fake Spotter 6.5k
(50% sniff line on counterfeits). GLOBAL — Foreman's Trust 10k (4th
contract + DOUBLE grand pack), Scrap Magnetism 3k x3 (+12%/lvl at
mine/water/board grant sites), THE MASTERWORK 50k (+10% mine rate,
catch credits, haggle odds). Verified: 17 cards render, retired
hidden, bellows 45->29s, hp 14, TWO crucibles running, 4 bounties,
4 contracts, rate x1.10, zero errors.

## Batch 38 — THE COUNTER, the tackle chip, and fullscreen manners
Playtest asks, all three: (1) MARKET AS DIALOG: the grid feed is now
THE COUNTER — one visitor at a time (portrait line, speech bubble,
item, price) with Buy / Bargain / Pass; visitor N of M; Pass marks
offer.passed and advances; quiet-shop state when everyone's seen.
BARGAIN once per listing, persona-priced: uncle 70%@-18, fair
55%@-10, hype 25%@-12, VaultDealer REFUSES and bumps +5%% for asking,
the scammer accepts INSTANTLY at -25 (the tell), packs/lots 50%@-12;
accepted price rides o.hagglePrice through every buy path incl the
reveal's spent line. (2) TACKLE SHOP left the Market: fold cut,
renderTackleShop guarded on its element, a 🧰 chip on the fishing
row opens a modal holding #tackleShop — buy handlers re-render live
inside it. (3) FULLSCREEN: all five fishing overlay mounts
(cine wrap, bounty, chum, mixer, journal) now append to
document.fullscreenElement || body — the boss reveal shows INSIDE
fullscreen (the reported bug: it waited outside until FS closed);
plus a fixed ✕ exit chip injected into the FS host (safe-area
padded) so leaving doesn't require the phone's back button.

## Batch 37c — the sell fold's ghost (playtester screenshot)
Live error banner: [render] market filters failed: null.appendChild.
populateMarketFilters still ran at boot via safeRender, appending
rarity options into #marketSellRarityFilter — a select that lived
INSIDE the deleted sell fold. safeRender call removed, fn no-op'd.
Boot probe walks all six tabs: zero pageerrors, zero console errors,
no warn banner. Lesson (the pair to renderMarketSell's): deleting a
UI region means grepping for EVERY renderer that writes into it —
the render list runs at boot, not just on tab entry. The safeRender
wrapper did its job: the banner said exactly which panel and why.

## Batch 37b — a fragile drive, not a regression
The spots smoke's legendary-card check stalled at 'reeling' after the
market batch. Isolation proved the game fine (direct fshLand pulls
the card); the smoke's drive set progress = need-1 and assumed the
first tick lands — but fights can OPEN in a fish-favored mood where
progress bleeds, and the module-load RNG stream shifting (market2's
load order) changed the opening mood draw. A Midnight legendary
out-muscling a naked rod is the design working. Fix: the drive sets
progress = need+5 (past the line, lands next tick whatever the
mood). Lesson: synthetic fight drives must cross thresholds, not
approach them — RNG-adjacent assumptions rot when module load order
changes.

## Batch 37 — THE SALESMAN'S FEED + BINDER SALES (the FeeBay batch)
Researched FeeBay Simulator (Steam) at the playtester's direction and
rebuilt the Market around its core truth: every card has a true value
and a seller who may or may not know it. MARKET: the Sell fold is
GONE (renderMarketSell retired to a no-op — 7 call sites made
harmless in one stroke, the lesson after two anchor aborts);
generateMarketOffers + renderMarketOffers overridden by
market2.module.js: the hourly seeded stock is now a FEED of listings
— five personas (Clueless Uncle 0.35-0.7x / Hype Merchant 1.7-2.8x /
definitely_real_cards 0.45-0.75x with 55% FAKE RISK paying 3 scrap
consolation / Fair Dealer / VaultDealer rare-only 1.25-1.6x) each
with flavor lines, plus sealed packs at 0.55-1.5x and MYSTERY LOTS
(4-5 weighted cards) that open through startReveal like a real pack.
True value = MARKET_BUY_PRICE_BY_TIER x slab multiplier for graded
cards. BINDER SALES: a Sell-mode toggle above the collection grid;
armed, tapping any owned data-cid card opens the sell sheet — Quick
0.75x/90s/sure, Fair 1.0x/8min/90%, Greedy 1.45x/20min/60% — card
leaves the binder while listed (mining bonus recomputed), buyers pay
minus the 10% house cut or BAIL and the card comes home. Verified:
feed kinds mixed, scam pays consolation, lot opens the rip flow,
list->bail->return, list->sale->net paid. V1 scope: stack-expanded
edition variants aren't sellable (no data-cid); grades shown as SLAB
chip in the sheet.

## Batch 36 — SEVEN BANDS + THE GRADING DESK
Rarity condensation done the cheap-and-total way: the 16-slot
RARITIES table keeps every id/weight/foil flag but now carries SEVEN
band names (Common x3 / Uncommon x3 / Fine x3 / Rare x3 / Epic x2 /
Legendary / Mythic) — all 19 display sites updated at once, odds
untouched, no card-data migration. The stop-rarity dropdown dedupes
to one option per band (value = band's lowest id); the reveal
summary merges chips by band. THE GRADING DESK (grading.module.js,
top of Collection): pulls arrive RAW; two desk slots; send a card to
Prof. Mullen for a band-priced fee (400x(band+1)^2) and a timed wait
(60s x band, wall-clock); CRACK THE SLAB opens the ceremony modal —
grade counts up 1..N to a weighted roll (10=4%, 9=9%, mode 7), GEM
MINT at 10, shine + perfect sting at 9+. Effects: graded cards pull
+grade/10 extra mining bonus (computeMiningBonusFromOwned wrapped),
grade 9+ pays band-scaled bonusXP. Slab shelf shows top 10. Verified
end to end: 7 bands, dedup dropdown, fee 6400, grade 5 EXCELLENT,
bonus 0.6 -> 0.9 exact. V1 scope: one grade per unique card; binder
grade chips + a market for slabs are natural next rungs.

## Batch 35 — THE FOREMAN'S LEDGER (the daily spine)
The tie-together layer, at last: ledger.module.js draws THREE daily
contracts (FNV-seeded by date, distinct kinds) from a 7-type pool
spanning the mine (break veins / tap swings / collect an ingot), the
water (land fish / rare+ fish / strike a bounty), and the shelf
(open packs). window.feLedgerBump(kind,n) is the one spine; mining2
and fishing2 call it guarded, and startReveal is wrapped once so
bought AND granted packs count (the grand's own pack excluded).
Panel rides the top of the Play lobby; a gold ● badges the Play nav
when anything's claimable. Each contract pays credits+scrap; all
three claimed unlocks THE PROSPECTOR'S PACK — a real 1000-tier pack
opened through startReveal(pack, pulls, 0), the host's own granted-
pack path ('opens exactly like a bought one'). Fallback pays 10k if
the pack path ever throws. Verified: seeded [fish,fbounty,tap],
bumps fill, badge lights, 7.8k claimed, reveal overlay opened, zero
errors. Pool expansion (poker/dungeon/puzzle kinds) is one entry
per game once their win hooks are found.

## Batch 34 — fullscreen keeps its hands, the rod trembles for real
Mobile playtest: ⛶ fullscreened .fsh-stage ALONE, orphaning the
Hold-to-Cast button outside the fullscreen element. Fix: fullscreen
stage.parentElement (stage + .fsh-controls travel together) with a
fe-fs-host class (flex column, safe-area padding, full-bleed margins
zeroed) cleaned up on fullscreenchange exit. VIBRATION rework: the
old discrete pulses (gap shrinking, 10-90ms) replaced by ONE
continuous tremble: every 240ms window issues vibrate([on,off]) over
a 300ms span with duty 0.32 -> 0.95 ramping across 14s of fight —
overlapping refresh windows read as unbroken, the duty climb reads
as the fish leaning harder; vibrate(0) fires when the fight ends.
Verified: early [100,200] -> late [285,15] -> cancel 0; cast button
inside the fs host; zero errors.

## Batch 33b — the seam selector (progression trap sprung)
Playtester hit the trap in the 33 design: the vein only dropped
CURRENT-tier ore, so a high collection level locked you out of the
low-tier ingots the forge ladder STARTS on. Fix: the seam selector —
a row of seven ore buttons above the works panel; any unlocked tier
stays workable forever (locked ones show 🔒 + the level needed).
mgTier() = min(veinSel, mgMaxTier()); picking your top seam stores 0
so it auto-follows collection progress; switching seams resets the
rock face. Lower seams keep their lower break bonuses — mining old
copper for ingots costs you gold-tier payouts, a real tradeoff.
Caption reads '(of N unlocked — working the old seam for its ore)'.
Design lesson: any ladder whose rungs are CONSUMED by progression
elsewhere must let players climb back down.

## Batch 33 — ORE, THE SMELTER, THE FORGE (mining becomes a loop)
Playtester shipped 7_Tiers_of_ores + 7_Tiers_of_ingots. The
procedural boulder AND the gem overlay are gone — the vein IS the
tiered ore art now (212px, alpha-trimmed, palette-quantized 232c:
501KB -> 125KB; ingots 84px/19KB; MG_GEMS deleted). THE CHAIN: vein
breaks drop 2-4 ore of the vein tier -> THE SMELTER (one timed job:
5 ore -> 1 ingot, 45s x tier, wall-clock timestamp so it finishes
offline) -> THE FORGE: Tier-N pick costs N ingots of tier N-1 and
grants +6% mine rate per tier (currentMineRatePerMin wrapped once,
__mgWrapped guard). Pick art now = forge level, NOT the host upgrade
(32c tie superseded — earned in the mine, by the mine). Works panel
under the scene: ore/ingot shelf chips, smelt buttons, forge button
with cost meter. Verified: break->ore, smelt->collect, forge->tier 2
pick @ rate 106, zero errors. Probe note: module fns are IIFE-scoped
— probes must drive the UI, not call internals.

## Batch 32c — the seven picks (playtester assets land)
The drawn pickaxe didn't survive playtest; the playtester shipped
7_Tiers_of_pickaxes_512x512 (+ a pixel pack, benched). All seven
embedded (197KB, alpha-TRIMMED at build — the bedroll lesson), swung
as sprites around a measured grip point (0.14w, 0.88h) with +0.79rad
axis offset, same three-phase swing. THE SECOND VISIBLE TIE: pick
tier = upgrades.pickaxe thresholds [0,2,5,9,14,20,27] — buying
upgrades forges your tool on screen, from bound-leather rustic to
prismatic arcane; caption reads 'Tier N Vein — enriched by your
collection · Tier M Pick — forged by your upgrades'. Verified at
tier 1 and tier 7 with matching gems.

## Batch 32b — the pick earns its keep
Playtest callouts: the quadratic-blob pickaxe looked terrible, and
the caption was clipped off the right of the scene. ROOT CAUSE of
the clip: the host .mine-scene is a fixed 240px FLEX ROW — it laid
the caption BESIDE the canvas and cut both. mining2.css now forces
the scene to display:block/height:auto. The pickaxe is a drawn tool
now: tapered two-tone handle with grain + grip wraps, forged crescent
head through a dark eye socket, steel gradient + edge highlight, and
a three-phase swing (wind-up over the shoulder, ease-in crash, short
recoil, slow return); sparks moved to the rock face where the tip
lands. Lesson: when a module injects into a host container, override
the container's layout css FIRST — flex rows eat captions.

## Batch 32 — THE VEIN (mining 2) + the last of Reputation
The mining screen graduated from css stick-men swinging an emoji at a
🪨 div to a painted canvas cavern: torch-glow, stalactites, rubble
floor, a seeded gold-veined boulder with damage cracks, an animated
pickaxe pacing itself to the REAL mine rate, and the collection tie
made visible — a TIER GEM (7_Tiers_of_Gems pack, 164KB embedded)
glows in the rock's heart, tier fed by collection level (thresholds
1/4/8/13/19/26/34), caption names the next unlock. TAP TO MINE:
each player swing pays ~2s of passive rate and chips the rock; 20
chips = VEIN STRUCK: gem-shard burst + bonus (45s of rate x tier
mult) + 2 scrap. RAF sleeps when the tab hides. Also: Reputation
fully retired (header chip, level-up grants, level-bonus blurb) —
the last Empire ghost. Verified: taps pay, break pays + scrap,
caption ties, zero pageerrors, fishing suites green.
NEXT (pitched, awaiting green light): the Foreman's Ledger — three
daily cross-game contracts paying a Prospector's Pack, plus
collection milestone chests.

## Batch 31 — the cull (empire, arena, dig, resto, breaker, skywatch)
Playtester retired the ideas that no longer fit. FULLY DELETED from
the build: the Flooded Arena (module + assets + Play card + chum feed
button), The Dig, Restoration, Breaker, Skywatch (modules + cards +
tab sections), the Empire nav tab (+ css lock on its section), the
fishing Reputation grant, and the 'worth real money' line — fishing
now reads 'The water pays out in Credits — some catches handsomely.'
Chum is single-purpose again (jars chum the water). Arena test suite
and smoke retired from the sweep. DORMANT (unreachable, still in
bytes): host empire section markup/code, state.empire data — a future
deep-strip can reclaim them. Debug lessons, hard-won twice: NEVER
blind-regex a build script (it ate quoted mode ids inside splice
payloads, shipping if(except!==) and id:name: syntax poison); and a
statement-excision that cuts at the first } will die INSIDE a
template literal — anchor on the full statement.

## Batch 30 — the size audit (and the music that refused to shrink)
Byte inventory of 19.5MB: code/data 7.8 (host card tables dominate),
boss cine 5.2 (98 frames), music 1.9, poles 0.6, sfx 0.4, scene 0.9,
ALL 142 fish portraits just 0.27. Playtester's bar: nothing that
touches fishing gameplay OR look — so frames/poles/code-strip parked.
Attempted the 'safe' music cut and LEARNED: the tracks were already
~40kbps mono (the original Safari conversion) — 64k re-encode GREW
them 1.15MB. Night restored BIT-EXACT from the loop's temp file; day
re-matched at 40k mono (second-generation, inaudible at in-game
gain). Net: back to baseline; the file is already tight everywhere
the playtester cares about. Real savings (frames q60 ~2MB, poles
~0.3MB, code strip ~2MB) remain available behind A/B proof if ever
needed. Lesson: measure the CURRENT bitrate before 'optimizing'
audio — and temp files from loops are accidental backups.

## Batch 29 — THE DROWNED KING RISES (the gauntlet)
The playtester's 10s clip delivered a stormlit crownless kraken — the
lore absorbed it ('a king needs no crown — the water swallowed it
long ago') and his weight went 10x (1400-2400 lb). Cinematic: 14
leap frames (0.3-6.6s, the loom -> lunge -> maw-snatch), HERO at 9.2s
(the bobber CAUGHT IN HIS FANGS, line trailing), ko 6.8s; 818KB.
Fight: sig GAUNTLET cycles all five signatures in order (he absorbed
his heralds) between rings, at 150 FURY (six clean strikes to win;
hp bar scales by hpMax). Six-boss test rotation. Probe lesson
repeated: aborted once() runs write NOTHING (atomic) — re-apply all.

## Batch 28 — THE CONFLUENCE and the Drowned King
The sixth water: 🌀 The Confluence, gated not by credits but by all
FIVE Legend defeats (chip reads 🔒 the five; the click counts
bossJournal and either refuses with the tally or parts the waters).
Odds skew hard to tiers 3-6; every spot-bound conditional species
treats the Confluence as home (feSpotSatisfies wildcard through
feCondOk). THE DROWNED KING waits there: a crowned kraken (need 760,
pull 27, strain 1.95, stam 560, 140-240 lb, 2.5M) — standard epic
fight until the playtester's clip arrives; his cinematic slot (17th
FE_CINE_BOSSES entry) is designed: gauntlet QTE that cycles ALL FIVE
signatures (each Legend was his herald) ending in a tentacle
multi-swipe finisher. Splice lesson: appending before ']; ' after a
trailing comma creates an ELISION (undefined array entry) — feBossFor
threw on .spot of undefined; always check the last entry's comma.

## Batch 27 — the chum grinder (two waters, one jar)
Commons/uncommons landed (tier 1-2) bank as scrap fish; the 🪱 chip
opens THE CHUM GRINDER: five scrap -> one jar. Jars spend two ways:
(1) CHUM THE WATER — next four casts bite at 0.45x wait and pay a
🪱 x1.2 chip (applied at the waiting transition beside the bullseye
check); (2) FEED THE ARENA — a Feed Dock Chum button rides the armory
header when jars exist: +8 HP +1.5 ATK to the selected fighter, for
good, through the existing fed{} additive path. Dead commons finally
have a job on both sides of the water. Verified end to end: 5 lands ->
grind -> jar -> wait 8000->3600 + chip -> arena fed {8,1.5} into
fbUnitFor. Remaining from the master list: The Confluence.

## Batch 26 — skip, the Hardened ladder, the marksman's ring
TAP-TO-SKIP: any tap during a boss leap jumps to the FIGHT button
(hint fades in at 0.8s) — the thirtieth viewing earned it. THE
HARDENED LADDER: each cinematic win raises bossJournal[name].hard
(cap III); harder tiers shrink the ring band (±2.5/3 per tier), speed
the shrink (+22%/tier), cut signature timers (-12%/tier) and the
Phantom's strike window; a ⚔ HARDENED badge shows in-fight, and wins
at tier N land the fish +15%xN heavier. THE MARKSMAN'S RING: every
idle rolls a pulsing gold target on the water (x430-710); land the
bobber within 36 and the bite comes inside 700ms with a 🎯 x1.15
payout chip. Verified: skip->ready, win->hard 1 with mash 3.6->3.02,
bullseye->wait 700 + chip. STILL QUEUED: bait crafting, The
Confluence — big systems, own batch.

## Batch 25b — the hook learns manners (verification fallout)
Three smoke failures traced to ONE root: the every-5 test hook was
hijacking the suite's scripted lands by position — a strongbox
became the Rooster King mid-bank (boxes now EXEMPT from the hook:
!c0.boxNeed), and later a scripted first-catch landed as a legend.
FE_TEST_EVERY5 is a let now; both smokes disable it at boot. Box
checks hardened to state-relative counts; the chip-count check grew
to five (Bounties joined the row). Lesson: positional test hooks and
positional test SUITES are natural enemies — hooks must exempt
special catches and suites must switch hooks off.

## Batch 25 — the reasons to come back (bounties, rival, quality, trophies)
QUALITY: every non-boss fish rolls a finish (30% fine x1.35 / 8%->7pt
pristine x1.9 / 1% perfect x3, shimmer chip), best-quality tracked per
journal species. THE BOUNTY BOARD (📜 chip, badge dot when claimable):
three marks a day, seeded by date via FNV hash (species-over-weight /
tier-or-better / fine-quality / in-the-weather), struck automatically
on a matching land, claimed at the board for credits+scrap. THE OLD
TIMER: a weekly rival (five-name pool) posts a seeded record fish;
the player's best tier-3+ catch of the week races it; beating it pays
once. TROPHY MOUNTS: the three heaviest journal bests (>=8lb) hang on
plaques on the dock front with sprite + weight — the visible bragging
wall. Debug lessons: FSH_CATCH items are [name,icon] PAIRS; h>>4
re-signs an unsigned hash (negative index — use >>>); the award's
credits was const. NEXT WAVE (agreed, not yet built): boss rematch
ladder, bait crafting from commons, The Confluence sixth water,
tap-to-skip reveals, casting-accuracy ring.

## Batch 24 — five signatures (the fights get personal)
Each Legend now owns a SIGNATURE mechanic interleaved with the ring
(sig -> ring -> sig -> ring): IRONJAW mash (hammer-tap a draining bar,
12ms micro-haptics), MARSH KING swipe (dodge his fist in the shown
direction, pointerup vector), PALE HUNTER hold-and-release (tension
needle, release in the 60-86% band — the reel-fight muscle memory),
ROOSTER KING multi-tap (three numbered lightning points in order),
PHANTOM vanish (screen goes dark, a ripple whispers where, tap the
eyes in a 0.85s window). Input is coordinate-aware now (pointerdown +
up, canvas-space transform). Shared hit/fail plumbing alternates
modes; misses stack the same three stress pips. All five driven to
defeat and recorded in one probe, zero errors. Build stamp B24.

## Batch 23e — rotation dedupe + the build stamp
Playtester saw Rooster twice in a row; clean-run probe proves the
five-cycle works (5=Ironjaw..25=Rooster), so the likely culprit is a
STALE downloaded build (the rooster-only era). Two defenses: the
mixer popover now shows a BUILD STAMP (scene build B24) so the
running version is always verifiable, and rotation remembers
inv.lastCineBoss and skips forward if the computed Legend matches —
never the same fight twice in a row under any save state.

## Batch 23d — the pantheon complete (the Pale Hunter)
Fifth and final cinematic: the only UNDERWATER fight — the camera
dives with the bobber (0.6-4.6s: surface -> sinking POV -> light
shafts -> the pale shape materializing and growing from below), hero
4.95s (the lunge at the lure), ko 5.75s. 374KB. Title: SOMETHING PALE
RISES FROM THE COLD. Test rotation cycles all FIVE Legends. Every
boss of the water now has a true-form fight; total cinematic budget
~3.4MB across five bosses. TO RETIRE TESTING: FE_TEST_EVERY5 = false
returns each Legend to his home water and daily gate.

## Batch 23c — The Marsh King stands up
Fourth cinematic: 14 leap frames (0.4-4.2s: ripples -> fin -> the
HULKING HUMANOID rise, slime sloughing, the water greening), hero
4.7s (towering, the line clenched in his raised fist), ko 5.8s.
656KB. Title: THE MARSH ITSELF STANDS UP. Test rotation cycles four.
One Legend remains: the Pale Hunter.

## Batch 23b — The Black Phantom rises
Third cinematic: 14 leap frames (0.2-3.4s slow RISE — the Phantom
doesn't jump, he surfaces), hero still 2.85s (the void maw over the
bobber), ko 4.25s (the dive-splash). 345KB — night frames compress
3x better than day. leapDur 3.0 honors the menace. Title: THE NIGHT
ITSELF TAKES THE HOOK. Test rotation cycles all three (5th=Rooster,
10th=Ironjaw, 15th=Phantom, repeat). Remaining: Marsh King, Pale
Hunter — one clip each.

## Batch 23 — Old Ironjaw joins the arena of legends
The cinematic is PER-BOSS now: FE_CINE_BOSSES {pfx, n, leapDur, title}
— Rooster King (16 frames) and Old Ironjaw (14 leap frames 0.2-4.6s
from the single clip, hero still at 1.8s — the airborne gape with the
hook in his teeth — ko at 5.55s; 880KB). fshLand intercepts ANY boss
in the table; the every-5 test hook alternates (multiples of 10 =
Ironjaw). Probe lesson: a silent .replace no-op left the probe
fighting the Rooster while asserting Ironjaw flags — false alarm;
always assert replace counts in probe edits too.

## Batch 22e — the FIGHT button and the watchdog
Playtester's preview stalled at fight start (tab-switch un-froze it):
preview panes throttle/pause requestAnimationFrame. Three defenses:
(1) a real ⚔️ FIGHT button between reveal and rings (their idea — a
breath before the storm, a guaranteed user gesture for audio unlock,
and a manual restart kick); (2) a 420ms WATCHDOG interval re-requests
the frame chain whenever 400ms pass without a frame (wall-clock
stamped per frame); (3) the frame body is try/caught so an exception
can never silently kill the loop again. Rings only spawn in the
button-gated fight phase now.

## Batch 22d — the NaN that became null (save poisoning)
The preview error (null.toLocaleString in the fishing panel) traced to
the test hook's synthetic boss catch missing sizeRoll -> credits NaN
-> JSON serialized NaN as NULL into the saved log -> every render
after reload threw. Three-layer fix: the synthetic catch carries
sizeRoll/valueMult; the log write guards Number.isFinite; and module
load HEALS poisoned saves (null credits -> 0, tier clamp), re-renders,
and takes the host's render-warning banner down (the host draws before
appended modules run). Lesson: synthetic game objects must carry every
field the economy reads — and NaN never survives JSON.

## Batch 22c — the smooth pop and the held fury
Playtester verdict: the 4-frame thrash loop was choppy. Rebuilt: the
LEAP (16 frames from clip A, 0.9-4.9s, crossfaded pairs over 2.7s —
the clip's own escalation does the menace: eyes redden, the fish
grows) ends in a white flash into ONE dramatic hero still; the QTE
lives in overlays on it (1.4% breathing zoom, drawn jagged lightning
on hits instead of frame swaps, ko still for defeat). 18 frames 737KB
(lighter than the choppy 13). Crossfade turns 6fps footage fluid.

## Batch 22b — test cadence: every fifth fish is the King
FE_TEST_EVERY5 flag (top of fshLand): non-boss lands increment
inv.testN; each fifth becomes the Rooster King true-form fight
(weight 42-86, 'the line goes HEAVY' toast). Verified: catches 1-4
pass through, the 5th opens the cinematic. Flip the const to false to
retire.

## Batch 22 — THE TRUE FORM (the Rooster King cinematic QTE)
Landing the Rooster King now intercepts fshLand (guard flag _trueForm)
into a keyframe cinematic: 13 frames cut from the playtester's four
clips (470x705 jpeg q76, 784KB embedded) — reveal x3 (plain fish
erupting at the lure = the transformation beat), thrash loop x4,
lightning-strike x3, defeat x3. Full-screen overlay (#feCineWrap,
z10001, own RAF): shrinking ring (130->22 over ~1.1s), tap r∈[28,56]
= 25% fury damage + bolt frame + flash + shake + 70ms haptic; miss or
timeout = stress pip; three pips = HE DIVES (fsh reset, daily mercy —
retry allowed); fury zeroed = defeat frames then the ORIGINAL fshLand
runs (record, result, rewards). Both branches browser-proven, zero
errors. The footage's crimson storm-devil is canonized as the Rooster
King's true form — the Coral Shelf always promised stranger things.

## Batch 21 — nothing to cover (the billboard dies at the source)
The playtester named it: every runtime cover is a BILLBOARD at some
tone. Final fix: the painted clutter + rail were INPAINTED OUT OF THE
SOURCE PAINTING offline (five rounds: dual-offset clone hit the man;
right-side clone imported sun glitter; same-column deep clone imported
a painted ripple; gradient synth sampled the man's jacket — winner:
per-row gradient from right-side open water x470-522, offset-corrected
by the left/right tone delta measured on rows 520-556 where both are
water, + painterly streak pass, feathered borders). Clean painting
baked into FSH_BG_URL (148KB, durable at assets/bg2x3.txt); the
runtime borrow strip DELETED. Man patch and dock stamp crop the clean
bg automatically. Verified at tier-7 props: one continuous lake.
Lesson of the whole arc: runtime covers over painted art always
betray themselves — fix the painting, not the frame.

## Batch 20d — him alone (why the box survived 20c)
The 20c trace kept his DOCK CORNER + the sandwich stack + a pale
waterline band — and the patch stamps AFTER props, so at HIGH prop
tiers (wider sprites crossing x238) the kept deck pixels SLICED the
barrel: 'items look cut out'. My verification used fresh tier-1
grants and missed it — REPRODUCTIONS MUST MATCH THE PLAYER'S SAVE
SHAPE (tier-7 now in the probe). Matte rebuilt HIM ALONE (six
region crops kill the corner/sandwiches/band/post), 5.5KB. Also fixed
a landmine: the matte-not-ready early return exited fshDrawFisherman
WITHOUT THE GRIP -> rod renderer dies on undefined; the stamp is now
skipped safely and the grip always returns.

## Batch 20c — the traced fisherman
The last box: even soft blob masks held faint water in their blur
margins. The playtester called the fix — TRACE HIM. Matte built
OFFLINE from the painting: waterish classification, flood-fill from
all four borders (unreachable = him), largest connected component of
50, MaxFilter(3) + 1.6px gaussian feather, 8KB PNG embedded as a data
URI, applied destination-in when loaded. Water now flows uninterrupted
to his exact outline. Method of record for cutting figures from
painted art.

## Batch 20b — boxes, beams, smudges, pops: all four down
(1) THE BOXES had two sources: the water-borrow strip printed hard
top/right edges (now pre-rendered once, feathered 9px/28px, widened to
368 so the painted rail behind the man is erased too), and the
auto-matte kept near-dock water whenever local shading drifted from
the x560 reference — REPLACED with a hand-shaped soft mask (six
blurred blobs: hat/head/torso/hands/legs/boots, blur 7px,
destination-in). Reference-matching mattes are fragile against shaded
water; hand masks are deterministic. (2) MOONLIGHT is a reflection
now, not a beam: a squashed radial pool at the horizon + 26 glints
that widen, spread and thin with depth, each twinkling on its own
phase. (3) The old multiply damper was STILL RUNNING under the night
cover — removed entirely; the cover ramp starts 20:12. (4) SUN/MOON
POP: feSunPos exposes an edge fade (0.18t smoothstep at both
horizons) — celestials now dissolve in and out.

## Batch 20 — six for keeps (the stay-and-fish batch)
(1) PROPS x1.55 — the 2:3 painting made everything bigger; the
comforts keep up. (2) THE INVISIBLE BOX: the man patch was a raw
rectangle; now AUTO-MATTED — every pixel within distance^2 1700 of the
open-water colour at its row (feSampleBg x560) goes transparent, so
fish, drift and birds swim to his silhouette. (3) THE PLANK WALL is
gone: same-row water borrow (x430) opens the horizon behind the shelf;
a slim 18px rail is all that remains. (4) THE SUN AT NIGHT cannot be
dimmed — it is PAINTED OVER: a feathered 360x380 cover of sun-free
left sky, faded in by a night amount (21:00->22:24 ramp). (5) MOON 3x
(r30 + craters, glow r150) with a MOONLIGHT COLUMN on the water
(skewed shaft + 9 drifting glints) — and the whole celestial arc
RAISED (amp 118->300) because the old peak (y32) hid behind the new
hills (crest 25) all night. (6) AMBIENT RIPPLES: expanding rings
spawn around the dock legs, the boat, and open water — the whole
scene breathes.

## Batch 19g — device-scoped sizing + the fullscreen chip
The desktop height-cap leaked onto phones (no scope), shrinking mobile
to a card — wrapped in @media (min-width:820px): desktop fits the
window, phones full-bleed (measured 412/412). NEW ⛶ chip beside the
mixer: element fullscreen on the stage (requestFullscreen w/ webkit
fallback, guarded), with :fullscreen CSS centering the canvas at
100vh contain. Detection answer for the record: CSS media queries by
width/pointer, not UA sniffing.

## Batch 19f — a floor for short viewports
Embedded previews (short iframes) drove the vh-derived stage width to
postage-stamp size. clamp(340px, (100vh-190px)*0.6667, 100%) — never
smaller than usable, still fits real desktops, phones still full-bleed.

## Batch 19e — desktop fits the frame
On PC the width-driven canvas grew ~1200px tall — scene and cast
button could never share a screen. One CSS rule: .fsh-stage max-width
= min(100%, (100vh-190px)*0.6667) + auto margins — width derived from
available height at 2:3, so the whole scene centers in the viewport
with controls pinned to its foot (measured: button bottom 829 < 860vh
at 1440x860). Phones unchanged (the viewport term exceeds 100%).

## Batch 19d — the water lets go (when it should)
Mobile couldn't scroll past the full-screen scene. The module's own
fight binding held touchAction:none + unconditional preventDefault BY
DESIGN (a wobbling thumb must not scroll mid-fight and silently give
line). Merged, not replaced: touchAction pan-y; pointerdown captures
(preventDefault + setPointerCapture + feHold) ONLY during bite/reeling
— idle and waiting touches pass through and the page scrolls. First
attempt naively added a second fshBindCanvas and silently killed
hold-to-reel — smoke-fishing caught it (3 fails) before it shipped.

## Batch 19c — boat tuned per taste
Playtester sign-off on the zone, then: boat 1.5x again (scale 2.6),
raised to (178,948), rope shortened to reach the dock naturally,
drift exclusion widened.

## Batch 19b — texture over blur, boat at true scale
The 'super blurry' patch was the flat sampled gradient sitting in
water that has visible texture everywhere — a gradient can never match.
The cover now rebuilds the painting's water character on itself:
64 seeded soft horizontal strokes + 7 slanted light shafts (and 14 on
the reed tongue), drawn before the edge feathering. THE BOAT: it sits
NEARER than the dock, so it must read BIGGER than the man — scaled
1.75x at (140,985), bob deepened, mooring rope re-hung to reach the
dock above, drift-line exclusion box enlarged to match.

## Batch 19 — the boat, the level drift, the re-rooted reeds
The 'dislocated rectangle' was the borrowed-water patchwork (hard
row-brightness edges); ALL mirror patches removed per the playtester's
call. In their place: a soft-edged cover whose colors are SAMPLED FROM
THE PAINTING at runtime (data-URI images don't taint canvas), feathered
on every edge so no rectangle can exist — and a procedural ROWBOAT
moored beside the legs, rocking (rot ±0.045, bob ±2.6) with oars laid
across the gunwales and a mooring rope to the dock. The 'broken
rain' was the deep-drift typo: moveTo used d.y+FE_OFF, lineTo used
d.y — every drift line was a 292px diagonal; both ends level now, and
drift skips the boat's box. The stray stalks were OUR OWN spot-dressing
reeds still rooted at the old band floor (FSH_H+8 = mid-lake in the
tall scene) — no cover could beat a redraw; re-rooted at the tall
frame's bottom edge (1200-FE_OFF) at 1.45x height as foreground
framing. Lesson: when a cover fails twice, the artifact is being DRAWN,
not painted — grep the renderers first.

## Batch 18e — measured, not guessed
Grip CALIBRATED with crosshairs rendered on the painting itself: his
fists center at logical (305,305) — three prior guesses all landed on
his sleeve. The strip's slab mirror (18d) read worse than nothing and
is gone; the painting's stray reed stalks at the left edge are covered
with matching water (cols+66, rows 946-1200). Lesson recorded: for
pixel anchors on painted art, render candidate markers ON the art and
pick visually — estimation from bboxes repeatedly missed by 8-15px.

## Batch 18d — the shaded mirror and the fists
The under-dock 'wrong reflection' was the clutter cover borrowing
SUNLIT water from x430 and pasting it into the SHADED under-dock zone
— a bright rectangle. It now borrows from directly below the strip
(same columns, y952) so shading matches per-column. The plank strip
gains a faint mirror (alpha .22 about y842) to match its props. Grip
final: (291,304), verified against a reeling zoom — butt in his
fists.

## Batch 18c — night sun, dry dock, held rod
(1) The painted sun's TRUE halo (probed: bloom centroid logical
~(640,25) band, extent ~390) was 130px from where the night damper
aimed with half the needed radius — recentred (655,25) r320 with a
deeper core pass at (700,5) r200. (2) The water shimmer painted
streaks across the dock; the painted dock region (0,542)-(372,718)
logical is now cropped once (feDockPatch) and stamped back at band
(0,250) before the plank strip and props — same recipe as the man.
(3) Grip empirically tuned against a live reeling zoom: (284,297)
puts the butt in his fists through the fight arc. 

## Batch 18b — the recall and the water's foot
A ↩️ REEL IT IN button appears only while the line soaks (visibility
driven per-frame from feEnvTick): tap to cancel the wait — fsh=fshNew()
is a clean reset, bait honestly spent — with a small splash + reel
blip. CONTROLS AT THE SCENE'S FOOT: on tab enter, #fshCastBtn and
#fshBars re-parent into a #feCtl overlay absolutely positioned at the
stage's bottom (bars get a blurred glass backdrop) — no more hunting
the perfect scroll position mid-fight; spot rows and hints stay below
deck. One stale smoke assertion (bars-before-spots DOM order) updated
to the overlay truth. 79 checks.

## Batch 18 — the mixer and the buzz
DECOUPLED CHANNELS: feLoopStart routed EVERYTHING through feMuted
(sfxMute), so muting effects silently blocked music from starting —
music keys now answer only to musicMute, and the sfx mute stops only
non-music loops. PER-CHANNEL VOLUME: inv.sfxVol / inv.musicVol
(default 1) multiply every gain; live loops re-gain via feApplyVols()
(loops remember their base). THE MIXER: a 🎚️ chip beside 🔊/🎵 opens
a fixed popover — Effects slider, Music slider, and a 📳 Vibration
on/off switch, all persisted. HAPTICS: navigator.vibrate (guarded —
iOS Safari lacks it, degrades silently): one 35ms tap on the bite,
then pulses through the fight that START at 10ms every 620ms and grow
to 90ms every 220ms as feFightT climbs — the fish literally fights
harder in your hand. 75 smoke checks.

## Batch 17c — dusk on the dock, four more from the phone
(1) LANTERN LIGHT ON THE PLANKS: the warm pool ellipse was hardcoded
at y297 — the OLD deck — so it hovered mid-air; it lies at 330 now.
(2) THE COMFORTS REFLECT: every prop draws a second time mirrored
about y=421 (the water's edge at the dock), alpha 0.20 — the shelf
belongs to the water like everything painted. (3) THE DEEP WATER
MOVES: the animated streak field ended at the old band floor (a hard
'cut off' line mid-lake); 24 seeded drift lines now stroke the water
from 575 down to 1135. (4) THE ROD IN HIS FIST: grip nudged
(296,292)->(287,299) onto his measured hands. (5) BONUS SEAM: the
dusk warm veil gradient started at the band's y0, stamping a hard
edge across the sky — it spans (-FE_OFF..FSH_SURF_END) now.

## Batch 17b — the tall water, playtested and repaired
Eight screenshots, eight fixes. (1) THE ROD: fshDrawRod wants
grip.gripX/gripY — the override returned {x,y}, so geometry went NaN
and the rod vanished; proper fields restored it to his hands. (2) THE
MAN OVER THE WAVES: foam and drift streaks drew across him — his patch
of the painting is now cropped once and STAMPED back after the water
layers (fshDrawFisherman runs post-foam), fixing the z-order with zero
host edits. First attempt grabbed his REFLECTION (srcY 784 vs 492) and
stamped an upside-down man in a blue box — the exact-once discipline
caught nothing here, only the screenshot did. (3) THE DOCK: the band
still sliced the OLD painting for its water fill (sky-colored strips)
— rewritten to repaint the walkway in clean planks over the painted
clutter, props baseY 330 on the deck edge. (4) REFLECTED CLUTTER:
clean water borrowed from x430 covers the reflected props (x<=302
spares his reflection). (5) MOON BEHIND HILLS: occlusion fade against
FE_RIDGE. (6) TWO SUNS: the painted-sun damper still aimed at the OLD
painting's sun (640,52) — recentred to (731,-40). (7) HUE SEAM: clouds
and gulls were born in the letterboxed sky — lifted 205/215px into the
tall one on first enter. (8) WEATHER: clear-heavy transition weights
rebalanced (fog 1.2→1.9, drizzle 1→1.7, storm 1.4→1.9) so 25 minutes
cannot pass rainless.

## Batch 17 — the tall water (2:3 full-screen scene)
The playtester repainted the scene rod-free at 2:3 (832x1248, upscaled
to 1200x1800, jpeg 152KB). Conversion strategy: the painting fills a
new 1600x2400 canvas (logical 800x1200); EVERY legacy system keeps its
800x560 math and runs translated FE_OFF=292 down onto the band where
waterlines align (band waterline 247 = painting 539 — alignment by
construction). Host overrides (allowlisted): fshDrawSky draws the tall
painting then translates; fshDrawReflection no-ops (the painting
mirrors itself); fshDrawFisherman returns only the grip (288,300) — the
angler is paint now; fshBobberTarget casts deeper (y 310-470). Dock
band deckTop 320 / props baseY 354 on the painted deck line; FE_RIDGE
regenerated from the new hills (envelope -53..120, test retuned);
night tint / fog / storm-dark / lightning / journal-dim fills extended
to (0,-FE_OFF,800,1200); stars fill the tall sky; rain spawns and
wraps across the full frame. All six smokes passed the conversion
unmodified. Phones now get a true full-screen painting.

## Batch 16b — the fifth slot, freed
Playtester couldn't field five. Root cause: the DISPLAY filtered squad
names that fell off the roster (pre-gate commons, uncrowned legends)
but the pick handler capped on the RAW list — ghosts held slots
invisibly. renderFlooded now PURGES invalid names from the saved squad
(self-healing for old saves); smoke seeds a ghost-ridden squad, watches
it heal to 2, then fields a full five. 23 checks.

## Batch 16 — the arena earns its water (the big batch)
PRESENTATION: fighters bob on the water, idle ripples ring beneath
them, attacks are real LUNGES (26px sine dash), hits flash white,
crits land HIT-STOP (85ms) + screen shake, deaths roll belly-up and
sink in bubbles with a splash, the last kill slows the world 0.35× for
a beat. Ghost-trail HP bars (white segment drains after the green).
Floor dressing per arena: embers rise on 9, snow falls on 4/10, green
motes on 5/7, violet on 6, ambient bubbles elsewhere; five spectator
fish (FE_SPECIES_ART commons) circle the pool rim at 42% alpha. Water
SFX finally hired: splash_big on deaths/legend rings, snag on crits.
DECISIONS: squad ORDER is formation (engine targets front-most) — ◀▶
arrows reorder, FRONT badge on slot one. RING CONDITIONS (8, seeded
per ring, previewed on the header AND printed on the pool rim):
Murky/Frenzy/Cold Snap/Blood Tide/Still Water/Deep Current/Shoal
Season/Ember Rain — wired through fbSimBattle(…, cond) with default
null preserving all prior sims. THE DRAFT: first-clear item drops are
now pick-1-of-3 (food vs relic guaranteed opposed + a credit purse
0.8-1.3× repeat-clear value), pure fbDraftChoices() for testing.
LEGENDS ENTER: fifth rings open on a darkened pool, a great shadow
circling in, name-card pulsing, then the bell. Tests: conds seeded &
each winnable, cold snap measurably slows, draft shape/econ bands;
smoke lesson — a reorder mid-battle re-rendered the lobby over the
live canvas (checks moved pre-bell), and fbSpeed=8 ate the 2s entrance
inside a 500ms wait (checked synchronously now). 22 smoke checks.

## Batch 15d — pop-ups, not drop-downs
Playtester rejected the collapse carets; new pattern is the journal's:
one labeled chip per section, a fixed top-layer card when opened. The
chip row sits under the spot line — 📖 Journal (the word restored,
count as a sub-tag) · 📊 Stats · 🪣 Bucket · 🧰 Equipment. The three
panels are RE-PARENTED into their modals once on tab enter, so the
host's render functions keep hitting #fshStatsBar/#fshLog/#fshEquip
without knowing they moved; the panels' inner bold titles hide (the
modal head names the section). Smoke visibility lesson: Playwright's
pg.click refuses hidden elements, so gear-training and strongbox
sections open the Equipment modal around themselves. 70 checks green.

## Batch 15c — the shore tidies itself (superseded by 15d)
The 'An Afternoon Off' banner panel (emoji + title + blurb) is
REMOVED at integration — plain text with no job. Its removal retires
the old blurb-rewrite patch (the blurb died with it); the host's
fshTitle personalization writer is if-guarded, so nothing throws.
COLLAPSIBLE SECTIONS: Angler Stats (given a header it never had), The
Bucket, and Equipment each wear a caret (▾ rotates when folded); a tap
folds the whole panel to its header; choices persist in
fshInv().collapse and survive tab re-entry without double-decorating
(dataset guard). The keys/strongbox shelf lives inside Equipment and
folds with it. Browser-proven end to end.

## Backlog
Gamepad · pole/hook/lure art as shop icons · a reef spot to give the
seahorses a home.
