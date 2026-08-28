
/* =====================================================================
   PROVENANCE — bundled catalogue
   ---------------------------------------------------------------------
   Original entries written for the game, not fetched text. Two jobs:

     1. The game stays playable when the archive can't be reached —
        offline, a blocked API, a page opened from file://.
     2. First-run players get an instant first question instead of
        waiting on a network round-trip.

   Live Wikipedia still takes priority whenever it answers; this is the
   floor, not the ceiling. Every entry names its subject at least once so
   there is something for the redactor to strike.
   ===================================================================== */
const PV_CATALOGUE = {

  /* ---- Animal Kingdom ---- */
  "Lion": "The lion is a large cat native to Africa and a small population in western India. Unusually among cats, lions live in family groups called prides, and males carry a heavy mane that darkens with age.",
  "Axolotl": "The axolotl is a salamander that never grows up. It keeps its feathery external gills and stays in the water for life, and it can regrow lost limbs, spinal tissue and parts of its heart.",
  "Great White Shark": "The great white shark is the largest predatory fish, reaching six metres. It keeps its body warmer than the surrounding sea, which lets it hunt in cold water, and it can detect the faint electrical fields of hidden prey.",
  "Red Kangaroo": "The red kangaroo is the largest living marsupial and the biggest mammal native to Australia. It travels by hopping, a gait so efficient that going faster costs it almost no extra energy.",
  "Arctic Fox": "The arctic fox survives temperatures near minus fifty degrees on the tundra. Its coat turns thick and white in winter and thin and brown in summer, and it can hear prey moving beneath the snow.",
  "Bumblebee": "The bumblebee is a round, densely furred bee that can warm its own flight muscles by shivering, letting it forage in cold weather. It pollinates by gripping a flower and vibrating the pollen loose.",
  "Scarlet Macaw": "The scarlet macaw is a large red, yellow and blue parrot of Central and South American rainforests. Pairs mate for life, fly together, and can live for decades.",
  "Nile Crocodile": "The nile crocodile is Africa's largest freshwater predator, reaching five metres. Despite its reputation the female is a careful parent, carrying newly hatched young to the water in her jaws.",
  "Blue Crab": "The blue crab is a swimming crab of the western Atlantic with paddle-shaped hind legs. It must shed its shell to grow, and it is at its most vulnerable and most prized in the hours just after moulting.",
  "Great Blue Heron": "The great blue heron is a tall wading bird that hunts by standing motionless in shallow water and striking with its dagger bill. In flight it folds its neck into a tight S rather than stretching it out.",
  "Dromedary Camel": "The dromedary camel has a single hump storing fat, not water. It can lose a quarter of its body weight to dehydration and recover it in minutes at a trough, and its nostrils reclaim moisture from its own breath.",
  "Barracuda": "The barracuda is a long, silver ambush predator with a jutting lower jaw and prominent teeth. It hunts by sight in short, extremely fast bursts along reefs and open coast.",

  /* ---- Legends & Myth ---- */
  "Isaac Newton": "Isaac Newton formulated the laws of motion and universal gravitation, built the first reflecting telescope, and developed calculus. He spent much of his later life as Master of the Royal Mint, pursuing counterfeiters.",
  "Aristotle": "Aristotle studied under Plato, tutored Alexander the Great, and wrote on logic, biology, ethics, politics and poetics. His classification of living things shaped natural science for nearly two thousand years.",
  "Euclid": "Euclid worked in Alexandria and wrote the Elements, which derives geometry from a handful of postulates. It served as the standard mathematics textbook for over two millennia.",
  "Archimedes": "Archimedes of Syracuse worked out the principle of buoyancy, the law of the lever, and a close approximation of pi. He designed war machines that held off a Roman siege for two years.",
  "Banshee": "The banshee is a woman of Irish folklore whose wailing outside a house foretells a death in the family. She is described as washing bloodstained clothes at a ford, or as an old woman with long grey hair.",
  "Sphinx": "The sphinx is a creature with a lion's body and a human head. The Greek version guarded Thebes and strangled travellers who could not answer its riddle; the Egyptian version was a benevolent guardian of tombs.",
  "Ishtar": "Ishtar was the Mesopotamian goddess of love and war, associated with the planet Venus. Her most famous myth describes her descent into the underworld, passing through seven gates and surrendering something at each.",
  "Baldr": "Baldr was the Norse god of light and beauty, beloved by all. His mother extracted an oath from every thing in the world not to harm him, overlooking only the mistletoe that eventually killed him.",
  "Izanami": "Izanami is the Japanese creator goddess who, with her husband, formed the islands of Japan. After dying in childbirth she became ruler of the underworld, and her husband's failed attempt to retrieve her brought death into the world.",

  /* ---- Machines in Motion ---- */
  "Espresso Machine": "The espresso machine forces water at around nine atmospheres of pressure through finely ground coffee. The pressure emulsifies oils that ordinary brewing leaves behind, producing the layer of crema on top.",
  "Bicycle": "The bicycle is the most energy-efficient form of transport ever devised, moving a person further per calorie than walking or any animal. It stays upright largely through steering corrections rather than gyroscopic effect.",
  "Space Shuttle": "The space shuttle was the first reusable orbital spacecraft, flying 135 missions over thirty years. It launched as a rocket, manoeuvred as a spacecraft, and landed unpowered as a glider with one attempt at the runway.",
  "Cash Register": "The cash register was invented by a saloon owner to stop staff pocketing takings. Its innovation was the bell and the visible total, which turned every sale into something the customer witnessed and recorded.",
  "Sled": "The sled predates the wheel and works by reducing friction across a broad surface rather than concentrating weight on an axle. On snow, the pressure of the runners melts a microscopic film of water that acts as lubricant.",
  "Barge": "The barge is a flat-bottomed vessel built to carry bulk cargo on rivers and canals. Most have no engine and are pushed or towed, and a single tow can move freight that would need hundreds of trucks.",
  "Minivan": "The minivan put a tall, boxy passenger cabin on a car chassis rather than a truck frame, giving it a low floor and car-like handling. The sliding side door became its defining feature.",
  "Solar Panel Array": "A solar panel array converts sunlight directly into electricity through the photovoltaic effect, with no moving parts to wear out. Output depends on light intensity, and efficiency falls as the panels heat up.",
  "Tandem Bicycle": "The tandem bicycle seats riders in line, both contributing to a single drivetrain. It is faster than a solo bike on flat ground because it nearly doubles power while barely increasing wind resistance.",
  "Tank Truck": "The tank truck carries liquid in a cylindrical vessel divided into compartments. The baffles between them exist to stop the load surging forward under braking, which could otherwise overwhelm the driver.",

  /* ---- Cosmos & Terra ---- */
  "The Moon": "The moon is the only natural satellite of Earth and the only other body humans have walked on. It is tidally locked, so the same face always points toward us, and it drifts a few centimetres further away each year.",
  "Diamond": "Diamond is pure carbon arranged in a rigid lattice, formed under enormous pressure deep in the mantle and carried up by volcanic eruption. It is the hardest natural material and an excellent conductor of heat.",
  "Topaz": "Topaz is a silicate mineral that grows in long prismatic crystals in cavities of igneous rock. Naturally colourless or pale, most blue stones on the market have been irradiated and heated to bring out the colour.",
  "Pyrite": "Pyrite is an iron sulphide whose brassy metallic cubes have fooled prospectors for centuries, earning it the name fool's gold. Unlike the real thing it is brittle and will strike sparks against steel.",
  "Aquamarine": "Aquamarine is the blue-green variety of beryl, coloured by traces of iron and found in large flawless crystals. Sailors once carried it as a charm against drowning.",
  "Death Valley": "Death valley holds the lowest, driest and hottest ground in North America, dipping to 86 metres below sea level. Air heated on the valley floor is trapped by surrounding mountains and recirculates, driving temperatures higher.",
  "Loch Ness": "Loch ness is a long, deep freshwater lake in the Scottish Highlands, holding more water than all the lakes of England and Wales combined. Its peat-darkened water makes visibility almost nil a few metres down.",
  "Colosseum": "The colosseum is a Roman amphitheatre that seated perhaps fifty thousand people, with eighty entrances allowing the crowd to clear in minutes. Beneath the floor ran a network of tunnels, cages and lifts.",
  "Great Blue Hole": "The great blue hole is a near-perfect circular marine sinkhole off the coast of Belize, over 300 metres across and 120 deep. It formed as a limestone cave during the ice ages and flooded when sea levels rose.",
  "Tsunami Wave": "A tsunami wave is generated by displacement of the seafloor rather than by wind. In deep water it may be barely noticeable while travelling at the speed of a jet aircraft, rising only as it reaches shallow coast.",

  /* ---- Tide & Tackle ---- */
  "Burbot": "The burbot is the only freshwater member of the cod family, with a single barbel on its chin. It spawns under ice in midwinter and feeds mostly at night in cold, deep water.",
  "Bull Shark": "The bull shark tolerates fresh water better than almost any other shark and has been recorded far up rivers, hundreds of miles from the sea. It is stocky, blunt-snouted, and hunts in murky shallows.",
  "Tide Pool": "A tide pool is a rock basin left holding seawater as the tide retreats. Everything living in it must survive hours of heat, evaporation and changing salinity before the sea returns.",
  "Blobfish": "The blobfish lives at depths where pressure is dozens of times that at the surface, and its body is a gelatinous mass slightly less dense than water so it can hover without a swim bladder. It only looks slack when brought up.",
  "Anglerfish": "The anglerfish hunts in the deep sea using a luminous lure grown from a modified fin spine, lit by symbiotic bacteria. In some species the tiny male fuses permanently to the female and lives as an attached parasite.",
  "Coelacanth": "The coelacanth was known only from fossils and assumed extinct for 65 million years until one was landed off South Africa in 1938. It has fleshy, limb-like fins and a hinged skull.",
  "Oarfish": "The oarfish is the longest bony fish, reaching over eight metres, with a silver ribbon body and a crimson crest. It swims vertically, head up, and is so rarely seen alive that strandings often make the news.",
  "Maine Lobster": "The maine lobster has one crusher claw and one finer cutting claw, and which side they fall on varies between individuals. It tastes with its legs and must moult its entire shell to grow.",
  "Common Octopus": "The common octopus has three hearts, blue copper-based blood, and two thirds of its neurons distributed through its arms rather than its brain. It changes colour and skin texture in a fraction of a second.",
  "Cuttlefish": "The cuttlefish controls its buoyancy with a porous internal shell and communicates by running waves of colour across its skin, despite being colourblind. Its W-shaped pupil gives it unusual depth perception.",
  "Blue Marlin": "The blue marlin is a fast open-ocean predator with a spear-like upper jaw used to stun prey. Females grow several times larger than males and can exceed 500 kilograms.",
  "Rainbow Trout": "The rainbow trout is a cold-water fish marked with a pink band along its flank. Populations that migrate to sea and return to spawn grow far larger and turn silver, and are known by a different name entirely.",
  "Northern Pike": "The northern pike is a long, olive ambush predator that lies motionless among weeds and strikes in a single explosive lunge. Its jaws hold hundreds of backward-pointing teeth.",
  "Yellow Perch": "The yellow perch is a small schooling fish with dark vertical bars along golden flanks and two separate dorsal fins. It feeds by day and is among the first fish most anglers ever catch.",
  "Walleye": "The walleye takes its name from its reflective eye, which gathers light and lets it hunt at dusk and in stained water where prey fish cannot see it coming.",
  "Old Boot": "An old boot is what the lake gives you instead of a fish. Waterlogged leather, laces long gone, and by long tradition it still goes in the bucket and gets counted.",
};

/* Shaped like a ciLookup result so the two sources are interchangeable. */
function pvCatalogueEntry(name){
  const text = PV_CATALOGUE[name];
  if(!text) return null;
  return { t: Date.now(), title: name, desc: "", extract: text, img: "", url: "", local: true };
}
function pvCatalogueSubjects(){ return Object.keys(PV_CATALOGUE); }


