#!/usr/bin/env python3
"""160 species: the 60 added in g6, plus 100 more.

One table feeds both the game and the art batch:
    python3 glimmerdeep/tools/species2.py      # writes glimmerdeep/species2.js
gen-art.py imports SPECIES2 for the prompts. Skills are built in species2.js from
role kits flavoured by element (see KIT there), named from the per-element banks below.
"""
import json, os

# key, element, role, tier, range, names (3 or 4), (art descriptions x3) [, mod or None, ult or None]
SPECIES2 = [
 # ---- ember ----
 ('emba', 'ember', 'striker', 1, 1, ('Kindlet', 'Scorchtusk', 'Volcanoar'), (
  'a chubby little piglet with glowing ember bristles along its back and a smoky snout',
  'a stocky fire boar with curved glowing lava tusks, a ridge of flames along its spine and cracked charcoal skin',
  'a gigantic volcanic boar with a small erupting volcano on its back, massive molten tusks and rivers of lava down its flanks')),
 ('emfl', 'ember', 'caster', 2, 3, ('Sparkbug', 'Lanternix', 'Pyrolumen'), (
  'a tiny round beetle whose glowing orange abdomen is a little lantern of fire',
  'a sleek beetle with a large glowing lantern abdomen, four amber glass wings and ember sparks trailing behind',
  'a majestic fire beetle sovereign with a blazing sun-like lantern body, six wings of molten glass and a crown of flame antennae')),
 ('emgo', 'ember', 'tank', 3, 1, ('Magmite', 'Lavapincer', 'Calderacrab'), (
  'a small round crab with a dark basalt shell glowing with lava cracks',
  'a heavy armoured lava crab with huge obsidian pincers and magma bubbling between its plates',
  'a colossal volcano crab with a smoking caldera on its back, enormous obsidian claws and lava pouring from its joints')),
 ('emph', 'ember', 'caster', 4, 3, ('Ashling', 'Cinderwing', 'Phoenexa'), (
  'a fluffy round bird chick of soft orange flame-feathers with a tiny ember crest',
  'a graceful young firebird with long blazing tail feathers and wings edged in golden flame',
  'a radiant phoenix with vast wings of white-gold fire, a long flowing tail of flame ribbons and a crown of blazing plumes')),
 ('emdr', 'ember', 'striker', 5, 1, ('Wyrmling', 'Flamewyvern', 'Solarwyrm'), (
  'a small round crimson dragon hatchling with stubby curled horns, little bat wings, a puff of smoke from its nose and a thick spiked tail with no flame on it',
  'a fierce crimson wyvern with large leathery wings, a horned head and fire glowing in its throat',
  'an enormous solar dragon with four great wings of fire, golden armoured scales, a sun halo behind its horns and a blazing tail')),
 # ---- tide ----
 ('tifr', 'tide', 'support', 1, 2, ('Puddlet', 'Ripplefrog', 'Monsoad'), (
  'a round sky-blue frog wearing a lily pad on its head with big friendly eyes',
  'a nimble blue frog with fin-like frills, glowing water markings and a lily pad cape',
  'a huge regal rain toad with a crown of lily flowers, a storm cloud raining above it and glowing aqua markings')),
 ('tijl', 'tide', 'caster', 2, 3, ('Jellyp', 'Glowmedus', 'Abyssquall'), (
  'a small round glowing blue jellyfish with short curly ribbon tentacles and a cute face',
  'a larger luminous jellyfish with a bell crown of glowing teal spots and long flowing ribbon tentacles',
  'a towering abyssal jellyfish monarch with a cathedral-like glowing bell, dozens of shimmering tentacles and a whirlpool swirling below it')),
 ('tish', 'tide', 'striker', 3, 1, ('Finnip', 'Rippershark', 'Tidalmaw'), (
  'a small chubby baby shark with stubby fins and a toothy grin',
  'a sleek blue shark with blade-like fins, white wave stripes and a fierce jaw',
  'a gigantic tidal shark leviathan riding a curling wave, armoured fins, a huge jaw and glowing aqua eyes')),
 ('tisq', 'tide', 'caster', 4, 3, ('Squiddle', 'Inkreaver', 'Krakenos'), (
  'a small round teal squid with big eyes and curly little tentacles',
  'a sleek deep-blue squid with long glowing tentacles and swirling ink clouds around it',
  'a colossal kraken with a huge domed head, eight vast tentacles crackling with glowing runes and a storm of whirling water')),
 ('tiwh', 'tide', 'tank', 5, 1, ('Calfin', 'Tidebreaker', 'Oceanos'), (
  'a round little blue whale calf with a water spout and a happy face',
  'a large armoured blue whale with coral growing on its back and glowing barnacle plates',
  'a titanic sky whale floating above the sea, an entire coral island with tiny waterfalls on its back and glowing constellations on its belly')),
 # ---- bloom ----
 ('blbe', 'bloom', 'striker', 1, 1, ('Leafbug', 'Thornbeetle', 'Bramblehorn'), (
  'a small round green beetle with a leaf-shaped horn and shiny shell',
  'a sturdy rhino beetle with a large thorny horn and a mossy green carapace',
  'a gigantic forest rhino beetle with a massive branching horn of living wood, flowering vines and a glowing green shell')),
 ('blfl', 'bloom', 'support', 2, 2, ('Budpup', 'Blossomhound', 'Gardenwolf'), (
  'a cheerful green puppy with a big flower bud for a tail and leafy ears',
  'a graceful hound with a mane of white and yellow blossoms and vine-wrapped legs',
  'a majestic garden wolf with a flowing mane of blooming flowers, a tail like a flowering branch and glowing golden pollen around it')),
 ('blcm', 'bloom', 'caster', 3, 3, ('Vinecham', 'Mossleon', 'Junglesage'), (
  'a small round green chameleon with a curly vine tail and big rolling eyes',
  'a larger mossy chameleon with leaf frills, glowing green spots and a long prehensile vine tail',
  'an ancient jungle sage chameleon with a crown of orchids, a mossy beard, glowing rune spots and floating seeds orbiting it')),
 ('bldr', 'bloom', 'tank', 4, 1, ('Fawnleaf', 'Mossbuck', 'Elderstag'), (
  'a little deer fawn with leaf-dappled green fur and tiny branch antlers',
  'a strong stag with mossy shoulders and large antlers sprouting leaves',
  'a towering ancient forest stag with colossal antlers that are a whole flowering tree, a bark-armoured body and glowing green eyes')),
 ('blmn', 'bloom', 'striker', 5, 1, ('Mantling', 'Orchidblade', 'Petalmantis'), (
  'a small round green mantis with leaf-shaped forelegs and big eyes',
  'a sleek mantis with sharp leaf-blade forelegs, orchid petal wings and a jade body',
  'a majestic orchid mantis empress with huge flower-petal wings, gleaming jade blade arms and a crown of blossoms')),
 # ---- volt ----
 ('vosn', 'volt', 'caster', 1, 3, ('Zapsnail', 'Voltshell', 'Thundershell'), (
  'a small yellow snail with a spiral shell crackling with blue sparks',
  'a larger snail with a glowing copper coil shell and lightning antennae',
  'a gigantic storm snail with a towering spiral shell like a lightning tower, arcs of electricity and a thundercloud above it')),
 ('vohu', 'volt', 'striker', 2, 1, ('Voltpup', 'Arcwolf', 'Thunderfang'), (
  'a small fluffy blue-white puppy with yellow zig-zag markings and sparking paws',
  'a lean electric wolf with spiky blue-white fur, glowing yellow lightning stripes and crackling fangs',
  'a huge storm wolf alpha with a mane of crackling lightning, glowing yellow eyes and thunderclouds swirling at its paws')),
 ('vobi', 'volt', 'caster', 3, 3, ('Sparrowbolt', 'Stormhawk', 'Thunderroc'), (
  'a small round yellow sparrow with lightning-bolt shaped tail feathers',
  'a fierce hawk with blue and yellow feathers and crackling electric wingtips',
  'a colossal thunderbird roc with vast wings of storm clouds and lightning, a golden beak and glowing eyes')),
 ('voro', 'volt', 'tank', 4, 1, ('Ohmcalf', 'Voltrhino', 'Teslahorn'), (
  'a stubby yellow rhino calf with a tiny glowing horn',
  'a heavy armoured rhino with a large copper horn crackling with electricity',
  'a colossal thunder rhino with a giant glowing tesla-coil horn throwing lightning arcs and heavy plated hide')),
 ('voli', 'volt', 'caster', 5, 3, ('Voltcub', 'Arclion', 'Stormking'), (
  'a fluffy yellow lion cub with a tiny spiky mane that sparks',
  'a proud young lion with a mane of crackling blue lightning and glowing stripes',
  'a majestic storm lion king with a vast mane of living lightning, a crown of thunderclouds and glowing golden eyes')),
 # ---- stone ----
 ('stmo', 'stone', 'tank', 1, 1, ('Pebmole', 'Rockdigger', 'Quakemole'), (
  'a round little brown mole with pebble-covered back and big stone claws',
  'a big burly digging mole beast with huge drill-like stone claws, a back of jagged amber crystals and a cracked rocky head crest, an animal creature, not humanoid, wearing no clothing or armour',
  'a colossal earthquake mole titan bursting up from cracked ground, enormous crystal-tipped drill claws, a mountain of boulders on its back and glowing amber cracks, an animal creature, not humanoid, wearing no clothing or armour')),
 ('stgo', 'stone', 'striker', 2, 1, ('Kidrock', 'Craggoat', 'Summitram'), (
  'a small fluffy goat kid with little stone horns and pebble hooves',
  'a strong mountain goat with large curled granite horns and a rocky mane',
  'a mighty summit ram with enormous spiralling horns of crystal and stone, a snowy rocky fleece and a mountain peak on its back')),
 ('stsc', 'stone', 'caster', 3, 2, ('Grainip', 'Dunescorp', 'Sandstormer'), (
  'a small round sandy scorpion with a stubby tail and big eyes',
  'a sandstone scorpion with a glowing amber stinger and carved rune plates',
  'a colossal desert scorpion king with a swirling sandstorm around it, carved temple-like armour and a huge glowing amber stinger')),
 ('stbe', 'stone', 'tank', 4, 1, ('Cubble', 'Boulderbear', 'Mountainursa'), (
  'a round bear cub made of smooth grey pebbles with mossy ears',
  'a hulking bear made of boulders with moss on its shoulders and glowing amber eyes',
  'a colossal mountain bear with a forested mountain ridge on its back, granite armour and glowing amber veins')),
 ('stli', 'stone', 'striker', 5, 1, ('Guardcub', 'Stonelion', 'Templelion'), (
  'a small stone lion cub statue come to life with a curly carved mane',
  'a lean adult stone guardian lion, much larger than the cub, with a carved granite mane, glowing gold runes and a long stone tail, an animal creature, not humanoid, wearing no clothing or armour',
  'a towering temple guardian lion statue come alive, a massive ornate carved mane with gold inlay, a floating stone halo, glowing rune eyes and broken temple pillars at its paws, an animal creature, not humanoid, wearing no clothing or armour')),
 # ---- shade ----
 ('shra', 'shade', 'striker', 1, 1, ('Smudgling', 'Duskraven', 'Nightmonarch'), (
  'a small round fluffy raven chick made of soft shadow with glowing cyan eyes',
  'a sleek shadow raven with smoky wingtips and glowing cyan eyes',
  'a towering raven monarch of the night with vast smoky wings full of stars, a crown of dark feathers and three glowing eyes')),
 ('shsp', 'shade', 'caster', 2, 3, ('Webbit', 'Shadeweaver', 'Nightspinner'), (
  'a small round fuzzy indigo spider with big cyan eyes and short legs',
  'a sleek shadow spider with glowing cyan web patterns on its back and long elegant legs',
  'a giant night-weaver spider queen sitting on a glowing web of starlight, an ornate crown-like head and shimmering cosmic patterns')),
 ('shdo', 'shade', 'striker', 3, 1, ('Gloompup', 'Hollowhound', 'Grimhound'), (
  'a small shadowy puppy with glowing lantern-yellow eyes and a smoky tail',
  'a lean shadow hound with glowing yellow eyes, smoky fur and spectral chains of light',
  'a huge nightmare hound with a mane of black flame, three glowing yellow eyes and shadows pouring from its paws')),
 ('shwr', 'shade', 'caster', 4, 3, ('Hexling', 'Hexwraith', 'Hexmonarch'), (
  'a small floating shadow spirit with a round moonstone face and tiny wispy arms',
  'a tall hooded shadow wraith with glowing cyan runes and a cracked moonstone face',
  'a towering shadow monarch spirit with a moonstone crown, flowing robes of night sky and glowing cyan rune circles around it')),
 ('shse', 'shade', 'tank', 5, 1, ('Nyxling', 'Nyxserpent', 'Nyxleviathan'), (
  'a small coiled indigo serpent hatchling with glowing cyan eyes',
  'a long shadow serpent with a hooded crest and glowing cyan scales along its belly',
  'a colossal void leviathan serpent coiled in a spiral, its body full of stars, a crested crown and glowing cyan eyes')),
 # ---- frost ----
 ('frpe', 'frost', 'support', 1, 2, ('Snowpeep', 'Frostpengu', 'Auroramperor'), (
  'a round fluffy white and icy-blue penguin chick with a snowflake crest',
  'a sturdy penguin with an icy crest, frosted flipper fins and glowing ice-blue markings',
  'a majestic emperor penguin with a crown of ice crystals, an aurora shimmering above it and a cape of frost')),
 ('frst', 'frost', 'striker', 1, 1, ('Frostling', 'Rimestoat', 'Blizzstoat'), (
  'a small white stoat with icy blue ear tips and a frosty tail',
  'a sleek ice stoat with sharp crystal claws and a tail trailing snowflakes',
  'a large blizzard stoat with a mane of jagged ice crystals, glowing blue eyes and a swirling snowstorm around it')),
 ('frwa', 'frost', 'tank', 2, 1, ('Tuskpup', 'Glacialrus', 'Bergtusk'), (
  'a chubby baby walrus with tiny ice tusks and a snowy moustache',
  'a large walrus with long crystal ice tusks and frost-covered blubber',
  'a gigantic glacier walrus with colossal ice tusks, an iceberg growing on its back and frozen armour plates')),
 ('frow', 'frost', 'caster', 2, 3, ('Flurrowl', 'Frostowl', 'Aurorowl'), (
  'a round fluffy snowy owlet with big icy-blue eyes',
  'a snowy owl with frost-crystal wingtips and glowing ice runes on its feathers',
  'a majestic aurora owl with vast wings shimmering with green and blue aurora light and a crown of ice crystals')),
 ('frmm', 'frost', 'tank', 3, 1, ('Mammitt', 'Frostmammoth', 'Glacitan'), (
  'a round fluffy baby mammoth with tiny ice tusks and snowy fur',
  'a big woolly mammoth with long curved ice tusks and frost in its fur',
  'a titanic glacier mammoth with enormous crystal tusks, a frozen fortress of ice on its back and blizzard winds around it')),
 ('frfl', 'frost', 'caster', 3, 3, ('Flakelet', 'Crystaflake', 'Cryomonarch'), (
  'a small floating snowflake spirit with a cute face in its centre',
  'a larger floating crystal snowflake spirit with six glowing ice arms and orbiting ice shards',
  'a majestic cryo spirit of enormous interlocking crystal snowflakes, a glowing core and a halo of floating ice')),
 ('frsa', 'frost', 'striker', 4, 1, ('Sabercub', 'Frostsaber', 'Rimesaber'), (
  'a fluffy white tiger cub with blue stripes and tiny ice fangs',
  'a powerful white sabre-tooth tiger with long ice fangs and frost-blue stripes',
  'a colossal glacier sabre-tooth with huge crystal fangs, ice armour on its shoulders and a blizzard mane')),
 ('frdr', 'frost', 'caster', 5, 3, ('Snowyrm', 'Rimedrake', 'Cryonarch'), (
  'a small round icy-blue dragon hatchling with frosty little wings',
  'a sleek ice drake with crystal wings, frost horns and a frozen breath glowing in its jaw',
  'an enormous ice dragon sovereign with vast crystal wings, a crown of ice spikes and a glowing aurora trailing from its tail')),
 # ---- gale ----
 ('gahu', 'gale', 'striker', 1, 1, ('Breezlet', 'Zephling', 'Galestrike'), (
  'a tiny round mint-green hummingbird with swirly wind feathers',
  'a sleek emerald hummingbird with long sharp tail streamers and wind trails',
  'a large storm hummingbird with blade-like crystal feathers, a cyclone swirling around it and glowing eyes')),
 ('gash', 'gale', 'caster', 1, 3, ('Cloudlamb', 'Nimbusheep', 'Stormram'), (
  'a fluffy white lamb whose wool is a soft cloud',
  'a sheep with a big thundercloud fleece and small curled horns of wind',
  'a mighty storm ram with a huge swirling storm-cloud fleece, curled horns crackling with wind and floating above the ground')),
 ('gafe', 'gale', 'striker', 2, 1, ('Swirlit', 'Whirlferret', 'Tornadex'), (
  'a small mint-green ferret with a curly tail of swirling wind',
  'a lithe ferret with a long spiralling wind tail and leaf-shaped ears',
  'a large tornado ferret wrapped in a spinning cyclone, sharp wind-blade fur and glowing teal eyes')),
 ('gamt', 'gale', 'support', 2, 2, ('Driftray', 'Skymanta', 'Stratomanta'), (
  'a small round flying manta ray in mint and white with a cute face',
  'a graceful flying manta ray with wing tips trailing wind streamers',
  'a gigantic sky manta gliding on currents, clouds swirling under its wings and glowing teal patterns on its back')),
 ('gagr', 'gale', 'striker', 3, 1, ('Griffchick', 'Skygriff', 'Stormgriffin'), (
  'a fluffy griffin chick with a small beak, tiny wings and a lion cub body',
  'a young griffin with large feathered wings, a sharp beak and a lion body with wind-swept fur',
  'a majestic storm griffin with vast wings of wind and lightning feathers, golden talons and a crest of cloud')),
 ('gadl', 'gale', 'support', 3, 3, ('Fluffseed', 'Dandelwisp', 'Galeflower'), (
  'a small round dandelion puff creature with tiny leaf feet',
  'a floating dandelion puff spirit with a glowing seed crown, small leaf wings and drifting seeds around its round body, an animal creature, not humanoid, wearing no clothing or armour',
  'a large floating wind blossom spirit with a giant glowing dandelion crown, leafy wings, swirling petals and seed lanterns orbiting its round body, an animal creature, not humanoid, wearing no clothing or armour')),
 ('gaki', 'gale', 'caster', 4, 3, ('Gustkit', 'Zephyrfox', 'Stormkitsune'), (
  'a small mint and white fox kit with a fluffy tail of swirling cloud',
  'a graceful wind fox with three cloud tails and teal swirl markings',
  'a majestic sky kitsune with seven tails of swirling cloud and wind, a floating jade orb and glowing markings')),
 ('gase', 'gale', 'caster', 5, 3, ('Cirrling', 'Cloudserpent', 'Skysovereign'), (
  'a small round cloud serpent hatchling with tiny whiskers and wispy fins',
  'a long eastern-style wind serpent with cloud fins, whiskers and a jade pearl',
  'a colossal celestial wind dragon of the eastern style, coiling through swirling clouds, long whiskers, jade antlers and a glowing pearl')),
 # ---- metal ----
 ('mecr', 'metal', 'tank', 1, 1, ('Nutcrab', 'Gearcrab', 'Ironmonarch'), (
  'a small hermit crab living in a shiny brass nut shell',
  'a sturdy crab with a gear-shaped steel shell and polished iron claws',
  'a colossal iron crab king with a fortress-like steel shell, huge gleaming claws and glowing blue rivets')),
 ('mean', 'metal', 'striker', 1, 1, ('Rivet', 'Steelant', 'Titanant'), (
  'a small shiny chrome ant with big eyes',
  'a sturdy steel ant with sharp polished mandibles and riveted plates',
  'a gigantic titanium ant with massive gleaming mandibles, armour plates and glowing blue joints')),
 ('mesc', 'metal', 'caster', 2, 3, ('Coppermite', 'Brassbeetle', 'Auricscarab'), (
  'a small round copper beetle with shiny metallic wings',
  'a brass scarab beetle with polished bronze wings and glowing blue engravings',
  'a majestic golden scarab with radiant metallic wings, an ornate engraved shell and a floating sun disk above it')),
 ('mepa', 'metal', 'tank', 2, 1, ('Platelin', 'Chromgolin', 'Bastiongolin'), (
  'a small pangolin covered in shiny steel scales',
  'a pangolin beast with flared chrome plates like a spiked crown, a massive steel club tail and glowing blue seams, an animal creature, not humanoid, wearing no clothing or armour',
  'a colossal fortress pangolin rearing on its hind legs, towering layered titanium plates like a spiked citadel and glowing blue energy seams, an animal creature, not humanoid, wearing no clothing or armour')),
 ('mewf', 'metal', 'striker', 3, 1, ('Chromepup', 'Steelwolf', 'Argentwolf'), (
  'a small silver wolf pup with metallic sheen fur',
  'a lean steel wolf standing tall with blade-like silver fur, a mane of metal spikes and glowing blue eyes, much bigger than the pup, an animal creature, not humanoid, wearing no clothing or armour',
  'a huge silver dire wolf with a towering mane of gleaming steel blades, a mirror-polished plated body, glowing blue runes and twin metal horns, an animal creature, not humanoid, wearing no clothing or armour')),
 ('mest', 'metal', 'tank', 4, 1, ('Tinstag', 'Ironstag', 'Titanstag'), (
  'a small stag beetle with shiny tin mandibles',
  'an iron stag beetle standing tall with enormous serrated mandibles twice its body length and glowing blue wing cases spread open, an animal creature, not humanoid, wearing no clothing or armour',
  'a towering titan stag beetle in flight with four huge translucent steel wings, colossal glowing mandibles like a crown and blue circuit engravings, an animal creature, not humanoid, wearing no clothing or armour')),
 ('mebu', 'metal', 'striker', 5, 1, ('Ironcalf', 'Steelbull', 'Adamantor'), (
  'a stubby little calf with shiny iron skin and tiny horns',
  'a charging muscular steel bull with huge polished chrome horns, glowing blue nostrils and riveted shoulder plates, an animal creature, not humanoid, wearing no clothing or armour',
  'a titanic adamant bull beast on four legs, enormous swept horns of gold-steel, a body of mirror-polished plates and a blazing blue energy core in its chest, an animal creature, not humanoid, wearing no clothing or armour')),
 # ---- mystic ----
 ('myun', 'mystic', 'support', 1, 2, ('Starfoal', 'Astrocorn', 'Celesticorn'), (
  'a small white foal with a tiny glowing gold horn and a teal starry mane',
  'a young winged unicorn with small starlight wings, a longer golden spiral horn and a flowing galaxy mane, an animal creature, not humanoid, wearing no clothing or armour',
  'a majestic celestial unicorn with a flowing mane of galaxies, a radiant golden spiral horn and wings of starlight')),
 ('myor', 'mystic', 'caster', 1, 3, ('Orblet', 'Seerorb', 'Oracleye'), (
  'a small floating crystal ball creature with one big friendly eye and tiny gold fins',
  'a floating crystal orb seer with a large glowing eye, golden rings orbiting it and tiny star sparkles',
  'a colossal floating oracle: a giant glowing crystal eye surrounded by many rotating golden rings and floating rune tablets, no body, no limbs, not humanoid')),
 ('mydf', 'mystic', 'support', 2, 3, ('Twinklefly', 'Starfly', 'Aurorafly'), (
  'a small teal dragonfly with glowing gold-tipped wings',
  'a dragonfly with four large glowing star-patterned wings and a golden body',
  'a majestic aurora dragonfly with vast crystal wings shimmering with aurora light and a trail of glowing stars')),
 ('myqi', 'mystic', 'caster', 3, 3, ('Qilet', 'Qilin', 'Skyqilin'), (
  'a small teal and gold qilin fawn with tiny antlers and cloud hooves',
  'a graceful qilin with a golden mane, teal scales, antlers and hooves of cloud',
  'a majestic celestial qilin with a flowing mane of golden fire, jade antlers, cloud hooves and a halo of runes')),
 ('mybe', 'mystic', 'tank', 3, 1, ('Lunacub', 'Moonbear', 'Lunarsa'), (
  'a round fluffy dark blue bear cub with a glowing crescent moon on its chest',
  'a big moon bear with a glowing crescent moon mark and starry fur',
  'a towering lunar bear spirit rearing on its hind legs, a translucent body full of galaxies, a huge glowing full moon behind its head and crescent-moon horns, an animal creature, not humanoid, wearing no clothing or armour')),
 ('mysh', 'mystic', 'support', 4, 3, ('Stellin', 'Nebulin', 'Cosmarine'), (
  'a small teal and gold seahorse floating in the air with star sparkles',
  'a long elegant star seahorse dragon with flowing golden fins like wings, a nebula-patterned body and a crown of stars, an animal creature, not humanoid, wearing no clothing or armour',
  'a colossal cosmic sea-dragon seahorse coiling through space, vast golden crystal fins, a body like a swirling galaxy and a halo of orbiting planets, an animal creature, not humanoid, wearing no clothing or armour')),
 ('mydr', 'mystic', 'caster', 5, 3, ('Lumenling', 'Aurorawyrm', 'Astralon'), (
  'a small round dragon hatchling of teal and gold light with star-shaped spots',
  'a graceful dragon with wings of shimmering aurora light and golden horns',
  'an enormous celestial dragon of starlight and gold with vast aurora wings, a crown of floating stars and constellations across its body')),
 ('emmk', 'ember', 'striker', 1, 1, ('Sootkin', 'Flarimian', 'Magmacaque', 'Ignisimius'), ('a macaque with a flame-tuft crest and sooty hands', 'a macaque with a flame-tuft crest and sooty hands', 'a macaque with a flame-tuft crest and sooty hands'), None, 'Tail Flurry'),
 ('emkg', 'ember', 'striker', 3, 1, ('Emberoo', 'Blazeroo', 'Pyrobound', 'Solarroo'), ('a kangaroo whose tail and feet glow like heated iron', 'a kangaroo whose tail and feet glow like heated iron', 'a kangaroo whose tail and feet glow like heated iron'), None, 'Rocket Kick'),
 ('emcp', 'ember', 'tank', 2, 1, ('Cinderbara', 'Hearthbara', 'Magmabara', 'Calderabara'), ('a calm capybara that soaks in a pool of hot spring and steams', 'a calm capybara that soaks in a pool of hot spring and steams', 'a calm capybara that soaks in a pool of hot spring and steams'), {'hp': 1.08, 'spd': 0.9}, 'Hot Spring'),
 ('emto', 'ember', 'tank', 4, 1, ('Kilnlet', 'Forgetoise', 'Furnacadel', 'Citadelforge'), ('a tortoise with a little campfire and chimney on its shell', 'a tortoise with a little campfire and chimney on its shell', 'a tortoise with a little campfire and chimney on its shell'), {'hp': 1.08, 'spd': 0.9}, 'Banked Coals'),
 ('embf', 'ember', 'tank', 3, 1, ('Bisonet', 'Cindison', 'Magmabison', 'Solarbison'), ('a bison with a smouldering hump and charcoal fur', 'a bison with a smouldering hump and charcoal fur', 'a bison with a smouldering hump and charcoal fur'), {'hp': 1.08, 'spd': 0.9}, 'Stampede'),
 ('emhc', 'ember', 'support', 1, 2, ('Warmpaw', 'Hearthpuss', 'Kindlecat', 'Solhearth'), ('a calico cat curled on a glowing coal cushion', 'a calico cat curled on a glowing coal cushion', 'a calico cat curled on a glowing coal cushion'), None, 'Warm Lap'),
 ('emmo', 'ember', 'support', 2, 2, ('Wicklet', 'Candlemoth', 'Chandelmoth', 'Luminarch'), ('a moth whose wings are two melting candles', 'a moth whose wings are two melting candles', 'a moth whose wings are two melting candles'), {'spd': 1.1}, 'Candlelight'),
 ('emsp', 'ember', 'support', 1, 2, ('Sunchick', 'Sunparrot', 'Solarara', 'Heliomacaw'), ('a sun parrot chick with ember-tipped plumage', 'a sun parrot chick with ember-tipped plumage', 'a sun parrot chick with ember-tipped plumage'), {'spd': 1.1}, 'Dawn Call'),
 ('emgk', 'ember', 'support', 4, 2, ('Gekkle', 'Cindergecko', 'Pyrogecko', 'Heliogecko'), ('a gecko that radiates comforting warmth', 'a gecko that radiates comforting warmth', 'a gecko that radiates comforting warmth'), None, 'Basking Heat'),
 ('empc', 'ember', 'caster', 5, 3, ('Peaflame', 'Firepeacock', 'Pyropavo', 'Solarpavo'), ('a peacock whose tail fan is a wheel of fire feathers', 'a peacock whose tail fan is a wheel of fire feathers', 'a peacock whose tail fan is a wheel of fire feathers'), {'spd': 1.1}, 'Feather Fan'),
 ('tinw', 'tide', 'striker', 3, 1, ('Narwee', 'Tidehorn', 'Narwave', 'Leviahorn'), ('a narwhal pup with a glossy spiral horn (natural horn, no weapon)', 'a narwhal pup with a glossy spiral horn (natural horn, no weapon)', 'a narwhal pup with a glossy spiral horn (natural horn, no weapon)'), {'hp': 1.04}, 'Spiral Charge'),
 ('tior', 'tide', 'striker', 4, 1, ('Orcalet', 'Orcarift', 'Orcatide', 'Tempestorca'), ('an orca calf with a bubble-ring blowhole', 'an orca calf with a bubble-ring blowhole', 'an orca calf with a bubble-ring blowhole'), {'hp': 1.04}, 'Breach'),
 ('tims', 'tide', 'striker', 1, 1, ('Shrimplet', 'Punchshrimp', 'Prismpincer', 'Chromatitan'), ('a mantis shrimp in rainbow armour with spring-loaded fists', 'a mantis shrimp in rainbow armour with spring-loaded fists', 'a mantis shrimp in rainbow armour with spring-loaded fists'), {'spd': 1.08, 'def': 0.95}, 'Shockfist'),
 ('tioc', 'tide', 'caster', 2, 3, ('Octolet', 'Inkocto', 'Tentaclys', 'Octarch'), ('an octopus doodling swirls of ink', 'an octopus doodling swirls of ink', 'an octopus doodling swirls of ink'), {'spd': 1.05}, 'Eight Arms'),
 ('tisa', 'tide', 'caster', 5, 3, ('Angelet', 'Seaserafin', 'Clionaris', 'Seraphim'), ('a translucent sea angel with wing-fins and a glowing core', 'a translucent sea angel with wing-fins and a glowing core', 'a translucent sea angel with wing-fins and a glowing core'), {'spd': 1.05}, 'Halo Tide'),
 ('time', 'tide', 'tank', 2, 1, ('Manalet', 'Manatide', 'Lagoonatee', 'Seamanatee'), ('a manatee with a lily pad hat', 'a manatee with a lily pad hat', 'a manatee with a lily pad hat'), {'hp': 1.08, 'spd': 0.9}, 'Gentle Drift'),
 ('ticl', 'tide', 'tank', 4, 1, ('Pearlet', 'Clamguard', 'Pearlclam', 'Abyssearl'), ('a giant clam guarding a glowing pearl', 'a giant clam guarding a glowing pearl', 'a giant clam guarding a glowing pearl'), {'hp': 1.08, 'spd': 0.9}, 'Pearl Shell'),
 ('tise', 'tide', 'support', 1, 2, ('Sealet', 'Splashseal', 'Lagoseal', 'Tidemonarch'), ('a sea-lion pup with a pearl necklace of bubbles', 'a sea-lion pup with a pearl necklace of bubbles', 'a sea-lion pup with a pearl necklace of bubbles'), None, 'Splash Cheer'),
 ('tist', 'tide', 'support', 2, 2, ('Stelle', 'Starfishel', 'Regenstar', 'Pentastar'), ('a starfish that regrows its own arms', 'a starfish that regrows its own arms', 'a starfish that regrows its own arms'), {'spd': 1.05}, 'Regrow'),
 ('tina', 'tide', 'support', 3, 2, ('Nautilet', 'Chambernaut', 'Spiralnaut', 'Nautilarch'), ('a nautilus with a pearly spiral shell and sparkling tentacles', 'a nautilus with a pearly spiral shell and sparkling tentacles', 'a nautilus with a pearly spiral shell and sparkling tentacles'), {'spd': 1.05}, 'Chamber Ward'),
 ('blmg', 'bloom', 'striker', 1, 1, ('Mongling', 'Vinemonge', 'Thornmongoose', 'Briarmongoose'), ('a mongoose wrapped in vines with a thorn-tipped tail', 'a mongoose wrapped in vines with a thorn-tipped tail', 'a mongoose wrapped in vines with a thorn-tipped tail'), None, 'Snake Snap'),
 ('blrc', 'bloom', 'striker', 3, 1, ('Leafcoon', 'Briarcoon', 'Verdacoon', 'Sylvacoon'), ('a raccoon with a leafy mask and acorn-cap ears', 'a raccoon with a leafy mask and acorn-cap ears', 'a raccoon with a leafy mask and acorn-cap ears'), None, 'Pilfer Pounce'),
 ('blpi', 'bloom', 'caster', 2, 3, ('Pitchlet', 'Pitcherpod', 'Nepenthral', 'Nepenthrone'), ('a pitcher plant creature with a lid hat and a happy face', 'a pitcher plant creature with a lid hat and a happy face', 'a pitcher plant creature with a lid hat and a happy face'), None, 'Nectar Trap'),
 ('blmo', 'bloom', 'caster', 4, 3, ('Budmoth', 'Lunabloom', 'Lunaflora', 'Selenabloom'), ('a luna moth with petal-shaped wings and pollen sparkle', 'a luna moth with petal-shaped wings and pollen sparkle', 'a luna moth with petal-shaped wings and pollen sparkle'), {'spd': 1.1}, 'Pollen Veil'),
 ('blcr', 'bloom', 'caster', 5, 3, ('Craneling', 'Sakuracrane', 'Blossomcrane', 'Hanacrane'), ('a crane in a cherry-blossom plumage with petal-tail trains', 'a crane in a cherry-blossom plumage with petal-tail trains', 'a crane in a cherry-blossom plumage with petal-tail trains'), {'spd': 1.1}, 'Blossom Gale'),
 ('blhi', 'bloom', 'tank', 2, 1, ('Hippolet', 'Lilyhippo', 'Padhippo', 'Marshpotamus'), ('a hippo with lily pads on its back and a frog friend', 'a hippo with lily pads on its back and a frog friend', 'a hippo with lily pads on its back and a frog friend'), {'hp': 1.08, 'spd': 0.9}, 'Mud Bath'),
 ('blen', 'bloom', 'tank', 4, 1, ('Acornlet', 'Oakent', 'Elderoak', 'Worldoak'), ('a walking acorn that grows into a mossy oak guardian', 'a walking acorn that grows into a mossy oak guardian', 'a walking acorn that grows into a mossy oak guardian'), {'hp': 1.08, 'spd': 0.9}, 'Deep Roots'),
 ('blld', 'bloom', 'support', 1, 2, ('Ladylet', 'Bloomladybug', 'Petalbug', 'Ladybloom'), ('a ladybug with a flower on its shell', 'a ladybug with a flower on its shell', 'a ladybug with a flower on its shell'), {'spd': 1.08, 'def': 0.95}, 'Lucky Spots'),
 ('blpa', 'bloom', 'support', 3, 2, ('Bamboocub', 'Bamboopanda', 'Bambooguardian', 'Pandarch'), ('a panda cub munching a bamboo shoot', 'a panda cub munching a bamboo shoot', 'a panda cub munching a bamboo shoot'), None, 'Bamboo Barrier'),
 ('blsn', 'bloom', 'support', 1, 2, ('Snaillet', 'Gardenail', 'Bloomshell', 'Edenshell'), ('a snail with a tiny garden growing on its shell', 'a snail with a tiny garden growing on its shell', 'a snail with a tiny garden growing on its shell'), None, 'Garden Grows'),
 ('vosq', 'volt', 'striker', 1, 1, ('Sparkirrel', 'Voltirrel', 'Arcsquirrel', 'Tempestirrel'), ('a squirrel with a sparking, fluffed tail', 'a squirrel with a sparking, fluffed tail', 'a squirrel with a sparking, fluffed tail'), None, 'Nut Zap'),
 ('voch', 'volt', 'striker', 3, 1, ('Cheetlet', 'Bolttah', 'Voltcheetah', 'Thundercheetah'), ('a cheetah with lightning-bolt spots', 'a cheetah with lightning-bolt spots', 'a cheetah with lightning-bolt spots'), None, 'Flash Run'),
 ('voal', 'volt', 'caster', 4, 3, ('Zaplaca', 'Voltalpaca', 'Teslalpaca', 'Thunderalpaca'), ('an alpaca with static-puffed wool and a glowing fringe', 'an alpaca with static-puffed wool and a glowing fringe', 'an alpaca with static-puffed wool and a glowing fringe'), None, 'Static Fleece'),
 ('vogi', 'volt', 'tank', 3, 1, ('Lightraffe', 'Voltraffe', 'Thunderaffe', 'Stormgiraffe'), ('a giraffe whose horns are lightning rods', 'a giraffe whose horns are lightning rods', 'a giraffe whose horns are lightning rods'), None, 'Lightning Rod'),
 ('voyk', 'volt', 'tank', 2, 1, ('Yaklet', 'Staticyak', 'Thunderyak', 'Stormyak'), ('a yak with a coat that crackles with static', 'a yak with a coat that crackles with static', 'a yak with a coat that crackles with static'), {'hp': 1.08, 'spd': 0.9}, 'Static Coat'),
 ('vogo', 'volt', 'tank', 5, 1, ('Gorillet', 'Voltilla', 'Thundergorilla', 'Titanilla'), ('a gorilla with capacitor coils in its chest', 'a gorilla with capacitor coils in its chest', 'a gorilla with capacitor coils in its chest'), {'hp': 1.08, 'spd': 0.9}, 'Chest Slam'),
 ('voha', 'volt', 'support', 1, 2, ('Hamlet', 'Spinhamster', 'Dynamster', 'Dynamo'), ('a hamster in a spinning wheel that charges everyone', 'a hamster in a spinning wheel that charges everyone', 'a hamster in a spinning wheel that charges everyone'), None, 'Wheel Spin'),
 ('voct', 'volt', 'support', 2, 2, ('Cricklet', 'Voltcricket', 'Arccricket', 'Symphonicket'), ('a cricket that plays chirping tunes on its wings', 'a cricket that plays chirping tunes on its wings', 'a cricket that plays chirping tunes on its wings'), {'spd': 1.08, 'def': 0.95}, 'Chirp'),
 ('vogw', 'volt', 'support', 2, 2, ('Wormlet', 'Voltworm', 'Arcworm', 'Lumiserpent'), ('a glowworm with a bright bulb tail', 'a glowworm with a bright bulb tail', 'a glowworm with a bright bulb tail'), {'atk': 1.05}, 'Glow'),
 ('vosl', 'volt', 'support', 3, 2, ('Snoozap', 'Zaploth', 'Ampereloth', 'Teslarch'), ('a sleepy sloth with sparks in its fur', 'a sleepy sloth with sparks in its fur', 'a sleepy sloth with sparks in its fur'), None, 'Slow Charge'),
 ('stgl', 'stone', 'striker', 3, 1, ('Gilalet', 'Granitegila', 'Quartzgila', 'Obsidiangila'), ('a gila monster in basalt scales with glowing seams', 'a gila monster in basalt scales with glowing seams', 'a gila monster in basalt scales with glowing seams'), None, 'Venom Bite'),
 ('stje', 'stone', 'caster', 2, 3, ('Jerblet', 'Dunejerboa', 'Sandjerboa', 'Mirajerboa'), ('a jerboa kicking up sparkling sand', 'a jerboa kicking up sparkling sand', 'a jerboa kicking up sparkling sand'), None, 'Sand Kick'),
 ('stca', 'stone', 'caster', 4, 3, ('Cairnlet', 'Cairnshade', 'Cairnseer', 'Monolith'), ('a floating cairn of balanced pebbles with a calm face', 'a floating cairn of balanced pebbles with a calm face', 'a floating cairn of balanced pebbles with a calm face'), {'spd': 1.05}, 'Balance'),
 ('stsx', 'stone', 'caster', 5, 3, ('Sphinxlet', 'Sandsphinx', 'Sphinxar', 'Pharasphinx'), ('a sphinx cat with a sandstone headdress (animal, no humanoid)', 'a sphinx cat with a sandstone headdress (animal, no humanoid)', 'a sphinx cat with a sandstone headdress (animal, no humanoid)'), None, 'Riddle Sand'),
 ('stwm', 'stone', 'tank', 1, 1, ('Wombling', 'Granitewomb', 'Cragwombat', 'Mountwombat'), ('a wombat with a pebble-coated back', 'a wombat with a pebble-coated back', 'a wombat with a pebble-coated back'), {'hp': 1.08, 'spd': 0.9}, 'Burrow Block'),
 ('stak', 'stone', 'tank', 3, 1, ('Ankylet', 'Ankylodon', 'Bastionodon', 'Citadelodon'), ('an ankylosaur hatchling with a club tail', 'an ankylosaur hatchling with a club tail', 'an ankylosaur hatchling with a club tail'), {'hp': 1.08, 'spd': 0.9}, 'Tail Club'),
 ('stmk', 'stone', 'support', 2, 2, ('Meerkit', 'Sentrimeer', 'Dunewarden', 'Sunpharaoh'), ('a meerkat sentinel watching the horizon', 'a meerkat sentinel watching the horizon', 'a meerkat sentinel watching the horizon'), None, 'Lookout'),
 ('stcm', 'stone', 'support', 3, 2, ('Camlet', 'Oasiscamel', 'Dunecamel', 'Miragecamel'), ('a camel with water jugs of shimmering oasis water', 'a camel with water jugs of shimmering oasis water', 'a camel with water jugs of shimmering oasis water'), None, 'Oasis'),
 ('sthy', 'stone', 'support', 1, 2, ('Hyraxlet', 'Cragrax', 'Cliffhyrax', 'Summithyrax'), ('a rock hyrax sunbathing on a warm boulder', 'a rock hyrax sunbathing on a warm boulder', 'a rock hyrax sunbathing on a warm boulder'), None, 'Sunning'),
 ('sttr', 'stone', 'support', 4, 2, ('Trilolet', 'Trilobite', 'Fossiltri', 'Primevaltri'), ('a trilobite with a fossil-pattern shell', 'a trilobite with a fossil-pattern shell', 'a trilobite with a fossil-pattern shell'), {'spd': 1.08, 'def': 0.95}, 'Fossil Plate'),
 ('shwe', 'shade', 'striker', 1, 1, ('Weaslet', 'Duskweasel', 'Nightermine', 'Umbramustela'), ('a weasel in a hood of night, silent paws', 'a weasel in a hood of night, silent paws', 'a weasel in a hood of night, silent paws'), None, 'Backstab'),
 ('shhy', 'shade', 'striker', 3, 1, ('Hyenlet', 'Murkhyena', 'Wraithhyena', 'Cacklord'), ('a hyena with a cackling grin and a smoke mane', 'a hyena with a cackling grin and a smoke mane', 'a hyena with a cackling grin and a smoke mane'), None, 'Pack Laugh'),
 ('shnm', 'shade', 'caster', 5, 3, ('Mareling', 'Nightmare', 'Dreadmare', 'Eclipsemare'), ('a spectral horse with a mane of dark smoke and moon-pale eyes (no rider)', 'a spectral horse with a mane of dark smoke and moon-pale eyes (no rider)', 'a spectral horse with a mane of dark smoke and moon-pale eyes (no rider)'), None, 'Dread Gallop'),
 ('shpb', 'shade', 'tank', 1, 1, ('Pillet', 'Murkpill', 'Umbrapill', 'Abysspill'), ('a pillbug that rolls into a dark armoured ball', 'a pillbug that rolls into a dark armoured ball', 'a pillbug that rolls into a dark armoured ball'), {'spd': 1.08, 'def': 0.95}, 'Roll Up'),
 ('shmi', 'shade', 'tank', 2, 1, ('Mimlet', 'Chestmimic', 'Vaultmimic', 'Hoardmimic'), ('a treasure chest creature with a long tongue and shy eyes', 'a treasure chest creature with a long tongue and shy eyes', 'a treasure chest creature with a long tongue and shy eyes'), {'hp': 1.08, 'spd': 0.9}, 'Snap Lid'),
 ('shbl', 'shade', 'tank', 4, 1, ('Belllet', 'Murkbell', 'Tollwraith', 'Dirgebell'), ('a tolling bell ghost that hangs in the air', 'a tolling bell ghost that hangs in the air', 'a tolling bell ghost that hangs in the air'), {'spd': 1.05}, 'Funeral Toll'),
 ('shdm', 'shade', 'support', 1, 2, ('Dozemouse', 'Dreammouse', 'Somnimouse', 'Oneiromouse'), ('a dormouse curled in a nightcap of cloud-mist', 'a dormouse curled in a nightcap of cloud-mist', 'a dormouse curled in a nightcap of cloud-mist'), None, 'Lullaby'),
 ('shnu', 'shade', 'support', 2, 2, ('Nudilet', 'Nightnudi', 'Umbranudi', 'Tenebranch'), ('a glow-spotted night nudibranch', 'a glow-spotted night nudibranch', 'a glow-spotted night nudibranch'), {'spd': 1.05}, 'Glow Trail'),
 ('shta', 'shade', 'support', 3, 2, ('Tarslet', 'Dusktarsier', 'Nighttarsier', 'Moontarsier'), ('a tarsier with huge glowing eyes', 'a tarsier with huge glowing eyes', 'a tarsier with huge glowing eyes'), None, 'Night Watch'),
 ('shnj', 'shade', 'support', 4, 2, ('Nightlet', 'Nightjar', 'Gloamjar', 'Eclipjar'), ('a nightjar bird in mottled twilight feathers', 'a nightjar bird in mottled twilight feathers', 'a nightjar bird in mottled twilight feathers'), {'spd': 1.1}, 'Twilight Song'),
 ('frlx', 'frost', 'striker', 2, 1, ('Lynxlet', 'Snowlynx', 'Glaciolynx', 'Blizzlynx'), ('a snowshoe lynx with tufted ears', 'a snowshoe lynx with tufted ears', 'a snowshoe lynx with tufted ears'), None, 'Ambush'),
 ('frwv', 'frost', 'striker', 3, 1, ('Wolvlet', 'Frostverine', 'Glaciverine', 'Blizzverine'), ('a wolverine with frost-crusted claws', 'a wolverine with frost-crusted claws', 'a wolverine with frost-crusted claws'), None, 'Rime Rend'),
 ('frrp', 'frost', 'striker', 4, 1, ('Clawchick', 'Rimeraptor', 'Glacieraptor', 'Cryoraptor'), ('a feathered raptor chick with an icicle crest', 'a feathered raptor chick with an icicle crest', 'a feathered raptor chick with an icicle crest'), None, 'Talon Flurry'),
 ('frhr', 'frost', 'caster', 2, 3, ('Hareling', 'Rimehare', 'Moonhare', 'Auroreus'), ('a snow hare drawing moon runes in the snow', 'a snow hare drawing moon runes in the snow', 'a snow hare drawing moon runes in the snow'), None, 'Moonlit Snow'),
 ('frki', 'frost', 'caster', 5, 3, ('Koiling', 'Glaciokoi', 'Aurorakoi', 'Cryokoidrake'), ('an ice koi with a flowing aurora tail', 'an ice koi with a flowing aurora tail', 'an ice koi with a flowing aurora tail'), {'hp': 1.04}, 'Aurora Swim'),
 ('frmo', 'frost', 'tank', 1, 1, ('Muskit', 'Frostmusk', 'Glaciomusk', 'Mammuskox'), ('a musk ox with an icicle fringe', 'a musk ox with an icicle fringe', 'a musk ox with an icicle fringe'), {'hp': 1.08, 'spd': 0.9}, 'Icy Fringe'),
 ('frse', 'frost', 'tank', 4, 1, ('Bergseal', 'Frostseal', 'Glacielephant', 'Cryolephant'), ('an elephant seal with ice plate armour', 'an elephant seal with ice plate armour', 'an elephant seal with ice plate armour'), {'hp': 1.08, 'spd': 0.9}, 'Iceberg Belly'),
 ('frpf', 'frost', 'support', 1, 2, ('Fluffin', 'Frostpuffin', 'Glaciopuffin', 'Auropuffin'), ('a puffin chick with a snowflake bill pattern', 'a puffin chick with a snowflake bill pattern', 'a puffin chick with a snowflake bill pattern'), {'spd': 1.1}, 'Fish Toss'),
 ('frsm', 'frost', 'support', 2, 2, ('Snowlet', 'Springmacaque', 'Onsenape', 'Glaciosage'), ('a snow monkey soaking in an icy-blue hot spring', 'a snow monkey soaking in an icy-blue hot spring', 'a snow monkey soaking in an icy-blue hot spring'), None, 'Hot Spring Soak'),
 ('frsd', 'frost', 'support', 3, 2, ('Dropbud', 'Snowdrop', 'Belldrop', 'Winterbloom'), ('a snowdrop flower sprite with bell petals', 'a snowdrop flower sprite with bell petals', 'a snowdrop flower sprite with bell petals'), {'spd': 1.05}, 'Winter Bloom'),
 ('gagz', 'gale', 'striker', 3, 1, ('Gazlet', 'Galezelle', 'Zephyrgazelle', 'Tempestgazelle'), ('a gazelle with swirling wind patterns in its coat', 'a gazelle with swirling wind patterns in its coat', 'a gazelle with swirling wind patterns in its coat'), None, 'Wind Sprint'),
 ('gaff', 'gale', 'caster', 2, 3, ('Fliplet', 'Skyfish', 'Zephyrfish', 'Aeropiscis'), ('a flying fish gliding on mint wind ribbons', 'a flying fish gliding on mint wind ribbons', 'a flying fish gliding on mint wind ribbons'), {'hp': 1.04}, 'Spray Gale'),
 ('galy', 'gale', 'caster', 5, 3, ('Lyrlet', 'Windlyre', 'Galelyrebird', 'Tempestlyre'), ('a lyrebird whose tail is a harp of wind strings', 'a lyrebird whose tail is a harp of wind strings', 'a lyrebird whose tail is a harp of wind strings'), {'spd': 1.1}, 'Wind Song'),
 ('gact', 'gale', 'tank', 1, 1, ('Cloudtort', 'Mistturtle', 'Cumulotort', 'Stratotort'), ('a turtle with a cloud for a shell', 'a turtle with a cloud for a shell', 'a turtle with a cloud for a shell'), {'hp': 1.08, 'spd': 0.9}, 'Cloud Cover'),
 ('gapf', 'gale', 'tank', 3, 1, ('Puffet', 'Gustpuff', 'Stratobloat', 'Cyclonimbus'), ('a balloon-pufferfish floating on the wind (SAMPLE, art done)', 'a balloon-pufferfish floating on the wind (SAMPLE, art done)', 'a balloon-pufferfish floating on the wind (SAMPLE, art done)'), {'spd': 1.05}, 'Inflate'),
 ('gaib', 'gale', 'tank', 4, 1, ('Ibexlet', 'Cliffibex', 'Zephibex', 'Aeribex'), ('an ibex on a windy crag with swept-back horns', 'an ibex on a windy crag with swept-back horns', 'an ibex on a windy crag with swept-back horns'), None, 'Crag Stand'),
 ('gael', 'gale', 'tank', 4, 1, ('Flaplet', 'Galephant', 'Zephyrphant', 'Tempestphant'), ('an elephant calf with huge wing-like ears that can glide', 'an elephant calf with huge wing-like ears that can glide', 'an elephant calf with huge wing-like ears that can glide'), {'hp': 1.08, 'spd': 0.9}, 'Ear Gust'),
 ('gasw', 'gale', 'support', 1, 2, ('Swalllet', 'Swiftswallow', 'Zephswallow', 'Haloswallow'), ('a swallow chick that swoops with the breeze', 'a swallow chick that swoops with the breeze', 'a swallow chick that swoops with the breeze'), {'spd': 1.1}, 'Tailwind'),
 ('gado', 'gale', 'support', 2, 2, ('Doveling', 'Zephyrdove', 'Peacedove', 'Halcyon'), ('a dove with silver-mint tail streamers', 'a dove with silver-mint tail streamers', 'a dove with silver-mint tail streamers'), {'spd': 1.1}, 'Peace Wing'),
 ('gapw', 'gale', 'support', 3, 2, ('Spinlet', 'Pinwheel', 'Whirligig', 'Cyclonwheel'), ('a pinwheel flower that spins when happy', 'a pinwheel flower that spins when happy', 'a pinwheel flower that spins when happy'), {'spd': 1.05}, 'Spin Up'),
 ('mekf', 'metal', 'striker', 5, 1, ('Kinglet', 'Cobaltfisher', 'Titanfisher', 'Argentfisher'), ('a cobalt kingfisher with a streamlined titanium crest', 'a cobalt kingfisher with a streamlined titanium crest', 'a cobalt kingfisher with a streamlined titanium crest'), {'spd': 1.1}, 'Dive Bomb'),
 ('meow', 'metal', 'caster', 2, 3, ('Cogowl', 'Clockowl', 'Chronowl', 'Horologowl'), ('a clockwork owl with ticking gear eyes', 'a clockwork owl with ticking gear eyes', 'a clockwork owl with ticking gear eyes'), {'spd': 1.1}, 'Tick Tock'),
 ('mefn', 'metal', 'caster', 3, 3, ('Fennelet', 'Radarfennec', 'Signalfennec', 'Orbitfennec'), ('a radar fennec with satellite-dish ears', 'a radar fennec with satellite-dish ears', 'a radar fennec with satellite-dish ears'), None, 'Ping'),
 ('meot', 'metal', 'caster', 5, 3, ('Cogturt', 'Orrerotortoise', 'Armillarch', 'Chronolith'), ('a tortoise carrying a spinning brass orrery of planets on its shell', 'a tortoise carrying a spinning brass orrery of planets on its shell', 'a tortoise carrying a spinning brass orrery of planets on its shell'), {'hp': 1.08, 'spd': 0.9}, 'Orbit'),
 ('mepc', 'metal', 'tank', 1, 1, ('Needlet', 'Steelquill', 'Chromedgehog', 'Adamantpine'), ('a porcupine with chrome needles', 'a porcupine with chrome needles', 'a porcupine with chrome needles'), None, 'Needle Coat'),
 ('memd', 'metal', 'tank', 4, 1, ('Bullpup', 'Rivetmastiff', 'Ironmastiff', 'Adamantmastiff'), ('a riveted bulldog with a steel jaw plate (animal)', 'a riveted bulldog with a steel jaw plate (animal)', 'a riveted bulldog with a steel jaw plate (animal)'), None, 'Iron Bite'),
 ('meko', 'metal', 'support', 1, 2, ('Koalet', 'Chromekoala', 'Platekoala', 'Argentkoala'), ('a silver koala hugging a chrome eucalyptus branch', 'a silver koala hugging a chrome eucalyptus branch', 'a silver koala hugging a chrome eucalyptus branch'), None, 'Soft Plating'),
 ('memo', 'metal', 'support', 1, 2, ('Moulet', 'Cogmouse', 'Clockmouse', 'Chronomouse'), ('a music-box mouse with a winding key on its back', 'a music-box mouse with a winding key on its back', 'a music-box mouse with a winding key on its back'), None, 'Wind Up'),
 ('megw', 'metal', 'support', 2, 2, ('Gildlet', 'Gildflutter', 'Aurumfly', 'Auricbutterfly'), ('a butterfly with gilded wings', 'a butterfly with gilded wings', 'a butterfly with gilded wings'), {'spd': 1.1}, 'Gilded Dust'),
 ('mewe', 'metal', 'support', 3, 2, ('Cogphant', 'Clockphant', 'Chronophant', 'Horolophant'), ('a wind-up elephant calf that hums a tune', 'a wind-up elephant calf that hums a tune', 'a wind-up elephant calf that hums a tune'), {'hp': 1.08, 'spd': 0.9}, 'Humming Gears'),
 ('mygk', 'mystic', 'striker', 1, 1, ('Gecklet', 'Prismgecko', 'Mirrorgecko', 'Kaleidogecko'), ('a gecko whose skin mirrors rainbow light', 'a gecko whose skin mirrors rainbow light', 'a gecko whose skin mirrors rainbow light'), None, 'Mirror Flash'),
 ('mypm', 'mystic', 'striker', 2, 1, ('Prismoth', 'Kaleidoth', 'Prismarch', 'Auroramorph'), ('a butterfly with kaleidoscope wings and a stardust trail', 'a butterfly with kaleidoscope wings and a stardust trail', 'a butterfly with kaleidoscope wings and a stardust trail'), {'spd': 1.1}, 'Kaleido Dash'),
 ('mylm', 'mystic', 'striker', 3, 1, ('Lemlet', 'Moonlemur', 'Astrolemur', 'Cosmolemur'), ('a ring-tailed lemur with a glowing star-ringed tail (SAMPLE, art done)', 'a ring-tailed lemur with a glowing star-ringed tail (SAMPLE, art done)', 'a ring-tailed lemur with a glowing star-ringed tail (SAMPLE, art done)'), None, 'Ring Toss'),
 ('myjk', 'mystic', 'striker', 4, 1, ('Jacklet', 'Runejackal', 'Astrajackal', 'Cosmojackal'), ('a jackal with a rune-glyph mane (animal, no humanoid)', 'a jackal with a rune-glyph mane (animal, no humanoid)', 'a jackal with a rune-glyph mane (animal, no humanoid)'), None, 'Rune Pounce'),
 ('mytp', 'mystic', 'caster', 5, 3, ('Tapirlet', 'Dreamtapir', 'Somnitapir', 'Oneirotapir'), ('a dream-eating tapir with galaxy-speckled fur', 'a dream-eating tapir with galaxy-speckled fur', 'a dream-eating tapir with galaxy-speckled fur'), None, 'Dream Eat'),
 ('mytd', 'mystic', 'tank', 1, 1, ('Tardilet', 'Cosmotardi', 'Voidtardigrade', 'Eternitardi'), ('a tardigrade water-bear with tiny stars on its back', 'a tardigrade water-bear with tiny stars on its back', 'a tardigrade water-bear with tiny stars on its back'), None, 'Cryptobiosis'),
 ('mymc', 'mystic', 'tank', 2, 1, ('Mochilet', 'Moonmochi', 'Lunamochi', 'Mooncake'), ('a round mochi moon rabbit that squishes when hit', 'a round mochi moon rabbit that squishes when hit', 'a round mochi moon rabbit that squishes when hit'), None, 'Squish'),
 ('mymo', 'mystic', 'tank', 5, 1, ('Moosling', 'Auroramoose', 'Astralmoose', 'Celestialmoose'), ('a moose with aurora-lit antlers', 'a moose with aurora-lit antlers', 'a moose with aurora-lit antlers'), None, 'Aurora Antlers'),
 ('myfc', 'mystic', 'support', 2, 2, ('Lucklet', 'Fortunecat', 'Wishcat', 'Cosmoneko'), ('a lucky cat with a glowing paw that beckons good fortune', 'a lucky cat with a glowing paw that beckons good fortune', 'a lucky cat with a glowing paw that beckons good fortune'), None, 'Beckon'),
 ('myho', 'mystic', 'support', 4, 2, ('Upupling', 'Haloopoe', 'Auropoe', 'Seraphoe'), ('a hoopoe with a crown crest of glowing feathers', 'a hoopoe with a crown crest of glowing feathers', 'a hoopoe with a crown crest of glowing feathers'), {'spd': 1.1}, 'Crown Chime'),
]

# skill names per element: basic, single, splash, volley, self-buff, heal, shield, taunt, ultimate (cycled per species)
NAMES = {
 'ember': dict(basic=['Ember Snap', 'Cinder Spit', 'Hot Claw', 'Spark Peck', 'Scorch Bite'], single=['Lava Lunge', 'Blaze Ram', 'Searing Strike', 'Pyre Bolt', 'Inferno Fang'], splash=['Flame Burst', 'Magma Splash', 'Ember Rain', 'Firestorm Ring'], volley=['Spark Swarm', 'Cinder Barrage', 'Meteor Shower'], buff=['Stoke the Flames', 'Molten Fury', 'Heat Rush'], heal=['Warm Embers'], shield=['Ash Ward'], taunt=['Magma Shell', 'Burning Guard'], ult=['Volcanic Rampage', 'Lantern Supernova', 'Caldera Eruption', 'Rebirth Blaze', 'Solar Cataclysm']),
 'tide': dict(basic=['Splash Slap', 'Water Jet', 'Fin Swipe', 'Ink Spurt', 'Spout'], single=['Torrent Lunge', 'Riptide Bite', 'Hydro Lance', 'Tsunami Jaw'], splash=['Wave Crash', 'Whirlpool', 'Ink Storm', 'Monsoon'], volley=['Bubble Volley', 'Rain Darts'], buff=['Current Rush', 'Feeding Frenzy'], heal=['Healing Rain', 'Tide Pool'], shield=['Bubble Ward', 'Water Veil'], taunt=['Breaker Wall', 'Coral Bulwark'], ult=['Monsoon Deluge', 'Abyssal Tempest', 'Maelstrom Maw', 'Kraken Crush', 'Ocean Leviathan']),
 'bloom': dict(basic=['Leaf Jab', 'Seed Shot', 'Vine Lash', 'Thorn Prick', 'Petal Cut'], single=['Thorn Charge', 'Bramble Spear', 'Orchid Slash', 'Root Crush'], splash=['Pollen Burst', 'Spore Cloud', 'Petal Storm', 'Bramble Bloom'], volley=['Seed Barrage', 'Petal Darts'], buff=['Photosynthesis', 'Verdant Rage'], heal=['Blossom Balm', 'Garden Song'], shield=['Bark Ward', 'Leaf Veil'], taunt=['Ironbark', 'Rooted Stance'], ult=['Forest Stampede', 'Garden of Life', 'Jungle Wrath', 'Elder Grove', 'Orchid Tempest']),
 'volt': dict(basic=['Zap', 'Spark Bite', 'Static Peck', 'Shock Horn', 'Arc Claw'], single=['Thunder Fang', 'Bolt Dive', 'Tesla Charge', 'Volt Lance'], splash=['Thunderclap', 'Static Burst', 'Chain Storm', 'Plasma Ring'], volley=['Lightning Barrage', 'Spark Rain'], buff=['Overcharge', 'Static Rush'], heal=['Recharge'], shield=['Ion Shield', 'Magnet Ward'], taunt=['Lightning Rod', 'Grounded Stance'], ult=['Tempest Spiral', 'Storm Pack', 'Thunderroc Dive', 'Tesla Stampede', 'King of Storms']),
 'stone': dict(basic=['Rock Claw', 'Pebble Throw', 'Horn Butt', 'Sand Sting', 'Stone Swipe'], single=['Boulder Ram', 'Granite Horn', 'Quake Strike', 'Avalanche Fist'], splash=['Rockslide', 'Sandstorm', 'Quake Wave', 'Rune Burst'], volley=['Gravel Barrage', 'Shard Volley'], buff=['Harden', 'Mountain Might'], heal=['Earthen Mend'], shield=['Stone Skin', 'Sand Veil'], taunt=['Fortify', 'Bedrock Stance'], ult=['Earthquake', 'Summit Charge', 'Desert Tempest', 'Mountain Collapse', 'Temple Roar']),
 'shade': dict(basic=['Shadow Peck', 'Night Bite', 'Gloom Claw', 'Hex Touch', 'Dark Fang'], single=['Night Slash', 'Phantom Lunge', 'Dread Fang', 'Void Bite'], splash=['Gloom Burst', 'Night Web', 'Shadow Wave', 'Curse Ring'], volley=['Raven Swarm', 'Hex Barrage'], buff=['Dark Hunger', 'Shadow Step'], heal=['Moon Drain'], shield=['Shroud', 'Night Veil'], taunt=['Haunting Coil', 'Dread Stance'], ult=['Night Monarch', 'Web of Stars', 'Nightmare Howl', 'Hex Eclipse', 'Void Leviathan']),
 'frost': dict(basic=['Frost Peck', 'Ice Claw', 'Snow Bite', 'Chill Touch', 'Rime Fang'], single=['Glacier Ram', 'Icicle Lance', 'Frost Pounce', 'Sabre Bite'], splash=['Blizzard', 'Ice Burst', 'Frost Nova', 'Hailstorm'], volley=['Icicle Barrage', 'Snowflake Volley'], buff=['Cold Fury', 'Frostbite Frenzy'], heal=['Aurora Song', 'Snow Balm'], shield=['Ice Shell', 'Frost Ward'], taunt=['Iceberg Stance', 'Glacier Wall'], ult=['Emperor Aurora', 'Blizzard Rush', 'Glacier Crash', 'Absolute Zero', 'Cryo Cataclysm']),
 'gale': dict(basic=['Wind Peck', 'Gust', 'Air Slice', 'Breeze Kick', 'Wing Clip'], single=['Cyclone Dive', 'Sky Talon', 'Gale Lance', 'Wind Blade'], splash=['Tornado', 'Squall', 'Whirlwind', 'Storm Front'], volley=['Feather Barrage', 'Seed Gust'], buff=['Tailwind', 'Updraft'], heal=['Soothing Breeze', 'Sky Song'], shield=['Wind Wall', 'Cloud Veil'], taunt=['Eye of the Storm', 'Gale Stance'], ult=['Hurricane', 'Storm Dive', 'Sky Stampede', 'Kitsune Tempest', 'Heaven Serpent']),
 'metal': dict(basic=['Clamp', 'Steel Bite', 'Bolt Shot', 'Rivet Jab', 'Iron Horn'], single=['Steel Ram', 'Chrome Fang', 'Titan Charge', 'Adamant Horn'], splash=['Shrapnel Burst', 'Magnet Pulse', 'Gear Storm', 'Mercury Wave'], volley=['Rivet Barrage', 'Bolt Volley'], buff=['Polish', 'Iron Will'], heal=['Repair'], shield=['Steel Plating', 'Chrome Ward'], taunt=['Iron Wall', 'Bastion Stance'], ult=['Iron Monarch', 'Swarm of Steel', 'Sun Disk', 'Fortress Roll', 'Adamant Stampede']),
 'mystic': dict(basic=['Star Tap', 'Glimmer Shot', 'Moon Bop', 'Rune Spark', 'Light Beam'], single=['Star Lance', 'Astral Horn', 'Rune Bolt', 'Lunar Swipe'], splash=['Starburst', 'Aurora Wave', 'Rune Circle', 'Nebula Pulse'], volley=['Meteor Sparks', 'Star Volley'], buff=['Moonlit Power', 'Arcane Focus'], heal=['Starlight Mend', 'Moon Blessing'], shield=['Rune Shield', 'Lunar Veil'], taunt=['Full Moon Stance', 'Celestial Guard'], ult=['Constellation', 'Oracle Vision', 'Aurora Bloom', 'Celestial Gallop', 'Astral Genesis']),
}

def emit():
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'species2.js')
    rows = []
    for row in SPECIES2:
        k, el, role, tier, rng, names, _art = row[:7]
        d = {'k': k, 'el': el, 'role': role, 'tier': tier, 'range': rng, 'names': list(names)}
        mod = row[7] if len(row) > 7 else None
        ult = row[8] if len(row) > 8 else None
        if mod:
            d['mod'] = mod
        if ult:
            d['ult'] = ult
        rows.append(d)
    js = ('// GENERATED by tools/species2.py from its table: 160 species.\n'
          '// Skills come from role kits (species2 kit builder below) flavoured by element.\n'
          '(typeof window !== "undefined" ? window : globalThis).GD_SPECIES2 = ' + json.dumps(rows, separators=(',', ':')) + ';\n'
          '(typeof window !== "undefined" ? window : globalThis).GD_NAMES2 = ' + json.dumps(NAMES, separators=(',', ':')) + ';\n')
    open(out, 'w').write(js)
    return out

if __name__ == '__main__':
    print(emit(), len(SPECIES2))
