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
MODULE_FILES exactly. STILL OPEN, needs a call: THIS FILE carries a
956-line block duplicated verbatim (lines 539-1494 repeat at
1502-2457, ~38% of the log); the copies are identical line-for-line so
a dedupe is safe, but it is the playtester's memory to cut.
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
