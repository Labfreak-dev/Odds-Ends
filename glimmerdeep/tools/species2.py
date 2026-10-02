#!/usr/bin/env python3
"""The 60 species added in g6 (four new elements, tiers 4 and 5).

One table feeds both the game and the art batch:
    python3 glimmerdeep/tools/species2.py      # writes glimmerdeep/species2.js
gen-art.py imports SPECIES2 for the prompts. Skills are built in species2.js from
role kits flavoured by element (see KIT there), named from the per-element banks below.
"""
import json, os

# key, element, role, tier, range, (names x3), (art descriptions x3: base, ★2, ★3)
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
  'a small stubby red dragon hatchling with a little flame on its tail and tiny wings',
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
  'a sturdy mole with huge rocky digging claws and a back of jagged stones',
  'a gigantic earthquake mole with boulder armour, colossal crystal-tipped claws and cracks in the ground around it')),
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
  'a proud stone guardian lion with a carved granite mane and glowing gold runes',
  'a majestic temple guardian lion with an ornate carved mane, gold-inlaid stone armour, glowing rune eyes and a floating stone halo')),
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
  'a floating dandelion spirit with a glowing seed crown and drifting seeds',
  'a tall elegant wind flower spirit with a huge glowing dandelion crown, petals swirling around it and floating seed lanterns')),
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
  'a sturdy pangolin with overlapping chrome plates and a heavy steel tail',
  'a colossal fortress pangolin with layered titanium plates, spiked steel tail and glowing blue seams')),
 ('mewf', 'metal', 'striker', 3, 1, ('Chromepup', 'Steelwolf', 'Argentwolf'), (
  'a small silver wolf pup with metallic sheen fur',
  'a sleek steel wolf with blade-like silver fur and glowing blue eyes',
  'a huge silver alpha wolf with a mane of gleaming steel blades, mirror-polished armour plates and glowing blue eyes')),
 ('mest', 'metal', 'tank', 4, 1, ('Tinstag', 'Ironstag', 'Titanstag'), (
  'a small stag beetle with shiny tin mandibles',
  'a big iron stag beetle with huge serrated steel mandibles',
  'a colossal titanium stag beetle with enormous gleaming mandibles, plated wings and glowing blue engravings')),
 ('mebu', 'metal', 'striker', 5, 1, ('Ironcalf', 'Steelbull', 'Adamantor'), (
  'a stubby little calf with shiny iron skin and tiny horns',
  'a powerful steel bull with polished chrome horns and riveted plates',
  'a colossal adamant bull with huge gleaming horns, a body of mirror-polished metal plates and glowing blue energy in its chest')),
 # ---- mystic ----
 ('myun', 'mystic', 'support', 1, 2, ('Starfoal', 'Astrocorn', 'Celesticorn'), (
  'a small white foal with a tiny glowing gold horn and a teal starry mane',
  'a graceful unicorn with a starry teal mane, a golden horn and glowing constellations on its coat',
  'a majestic celestial unicorn with a flowing mane of galaxies, a radiant golden spiral horn and wings of starlight')),
 ('myor', 'mystic', 'caster', 1, 3, ('Orblet', 'Seerorb', 'Oracleye'), (
  'a small floating crystal ball creature with one big friendly eye and tiny gold fins',
  'a floating crystal orb seer with a large glowing eye, golden rings orbiting it and tiny star sparkles',
  'a majestic oracle of many floating golden rings around a huge glowing crystal eye, orbiting runes and starlight')),
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
  'a colossal lunar bear spirit with a huge glowing full moon on its chest, fur full of stars and a crown of crescent moons')),
 ('mysh', 'mystic', 'support', 4, 3, ('Stellin', 'Nebulin', 'Cosmarine'), (
  'a small teal and gold seahorse floating in the air with star sparkles',
  'a seahorse with a nebula-patterned body, golden fins and a crown of stars',
  'a majestic cosmic seahorse with a body like a swirling galaxy, golden crystal fins and a halo of orbiting stars')),
 ('mydr', 'mystic', 'caster', 5, 3, ('Lumenling', 'Aurorawyrm', 'Astralon'), (
  'a small round dragon hatchling of teal and gold light with star-shaped spots',
  'a graceful dragon with wings of shimmering aurora light and golden horns',
  'an enormous celestial dragon of starlight and gold with vast aurora wings, a crown of floating stars and constellations across its body')),
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
    rows = [{'k': k, 'el': el, 'role': role, 'tier': tier, 'range': rng, 'names': list(names)} for k, el, role, tier, rng, names, _ in SPECIES2]
    js = ('// GENERATED by tools/species2.py from its table: the 60 species added in g6.\n'
          '// Skills come from role kits (species2 kit builder below) flavoured by element.\n'
          '(typeof window !== "undefined" ? window : globalThis).GD_SPECIES2 = ' + json.dumps(rows, separators=(',', ':')) + ';\n'
          '(typeof window !== "undefined" ? window : globalThis).GD_NAMES2 = ' + json.dumps(NAMES, separators=(',', ':')) + ';\n')
    open(out, 'w').write(js)
    return out

if __name__ == '__main__':
    print(emit(), len(SPECIES2))
