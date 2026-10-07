# Iron League — the Eslabong rebuild

Iron League is our own take on **Eslabong** (shirowita, Steam 2026): pixel
arena fights run by a mercenary club you manage across endless seasons.
This file maps every Eslabong system to what Iron League has today and the
batch that brings it over. Sources: the developer's Steam patch notes and
devblogs, the Steam guide "Stats and detailed numbers information", the
store page media, and player reviews (October 2026). "Our way" notes where
we keep our own twist.

## Phases

| Batch | Area | Status |
|---|---|---|
| v70 | Level up: Choose a stat, then Choose a skill (T1-T4, category pills, Reroll, Later) | shipped |
| v71 | **Hub shell**: Eslabong header, six tabs, bottom bar, Events inbox, Overview feed | shipped |
| v72 | **Roster tab**: first-team cards, substitutes strip, fighter detail sheet (market value, performance score, profile, combat summary) | shipped |
| v73 | **Season calendar**: 8-club divisions, 7 league weeks, Division V→I labels (our five tiers kept); Champions Cup moves to v79 | shipped |
| v74 | **Market tab**: list + detail layout with filters, market value against price, watch stars | shipped |
| v74b | **Market depth**: offers from rival clubs for your fighters, rival listings, champion auctions | planned |
| v75 | **Facilities**: Headquarters, Training Grounds, Time Chamber, Barracks, Medical Bay, Scouting Office, Treasure House | shipped |
| v75b | **Club House and staff** (Medic, Scout, Trainer, Treasure Hunter) | planned |
| v76 | **Fighter depth**: per-stat growth grades (Good / Excellent), personalities with mistake chance, form and injuries, milestone levels | planned |
| v77 | **Relics v2**: two slots per fighter (second at level 10), Common / Rare / Legendary, chests, relic market rotation | planned |
| v77 | **Intel tab**: club leaders, records, rival rosters, Archive (classes with codex pages, clubs, champions, relics, systems) | shipped |
| v76 | **Champions Cup** for the league's top four before the ceremony | shipped |
| v79 | **Activities**: Iron Gate (8 floors, bosses on 5/7/8), Tournament Center, Draft Cup rework, Hall of Legends, Academy 3v3 | planned |
| v80 | **Matches as series** and bigger squads (league 5v5 in rounds), formations and opening moves | planned |

## System map

### Screens
- **Eslabong**: header with crest + club name (left), "Season N - Week w/W" with
  a strip of week pips and a season modifier badge (center), currencies and
  Menu (right). Tabs Overview, Matches, Roster, Club, Market, Intel. Bottom
  bar: Academy Match (left), NEXT MATCH (center), Events with a badge (right).
- **Iron League today**: crest + name + division, purse chips, seven tabs
  (Club, Team, Market, Compete, Relics, Events, Train), a fight dock.
- **Plan (v71)**: same shell as Eslabong. Old tabs fold in: Club → Overview,
  Team → Roster, Compete → Matches, Relics → Roster ▸ Relics, Events and
  Train → Club, Goals and records → Intel. Settings move under Menu.

### Season
- **Eslabong**: 20-club leagues, about 30 weeks, MidCup, Chaos Thunder Cup,
  Champions Cup (top 8, best of 5), All-Star match, free weeks (Draft week 7,
  Iron Gate week 10), four divisions IV→I, last places disbanded, season
  modifiers (2-4 rules from a pool of 40).
- **Iron League today**: 6 clubs, 5 league rounds, a token cup, a draft cup,
  chaos pit, five divisions Sand→Crown.
- **Plan (v73)**: a week calendar with league weeks, cup weeks and a free
  week; 8-club divisions; division names kept (our way) but four of them;
  season modifiers as a badge (later batch).

### Fighters
- **Eslabong**: Mercenary Union recruits, rival listings, direct offers,
  auctions for champions, champion approaches, scouting, draft, loans,
  named leaders. Market value from level, stat and ability quality, impact,
  awards, form and injury risk. Personalities with hidden mistake chance.
  Growth per stat: Balanced ×1.0, Good ×1.3, Excellent ×1.6. Form and
  injuries. No wages, no aging.
- **Iron League today**: market board with watchlist, deals, champions,
  rarity, growth style presets, specialty, personality, stamina.
- **Plan (v72, v74, v76)**: market value and performance score on every
  fighter; offers from rival clubs; per-stat growth grades; form and injuries
  (Medical Bay); scouting office.

### Leveling
- **Eslabong**: cap 100. Skill choices at 2/5/10, stat choices every 3 levels,
  evolutions at 20/50, upgrades every 5 levels, masteries from 27. Stat roll
  8-35 placed on the stat you choose; automatic growth every level.
- **Iron League today (v70)**: cap 30; every level is a stat card and a skill
  card (new move, upgrade, or passive).
- **Our way**: keep a pick every level (fights are shorter, seasons faster).

### Economy
- **Eslabong**: Gold (league win 750-1,500 by division, draw 500, loss 300),
  Renown, Development Tomes. Sinks: fighters, relics, facilities (HQ 5k →
  500k), scouting 2.5k+, respec, emblem change.
- **Iron League today**: gold, renown, cup tokens, spec points.
- **Plan**: keep our smaller numbers; add facility upgrades and scouting as
  the big sinks (v75).

### Relics
- **Eslabong**: 2 slots per fighter (second at level 10), Common / Rare /
  Legendary, up to 5 legendaries in a lineup, chests, a relic market that
  rotates weekly, reroll for renown, Treasure House capacity.
- **Iron League today**: 64 relics, 2 club slots + 1 per fighter, sets.
- **Plan (v77)**: move to per-fighter slots, keep our sets (our way).

### Club
- **Eslabong**: Facilities Headquarters, Time Chamber, Scouting Office,
  Tournament Center, Medical Bay, Club House (staff), Barracks, Treasure
  House. Activities Challenge Tower (async PvP), Iron Gate, Draft Mode,
  Hall of Legends.
- **Iron League today**: yard, hall, infirmary (2 ranks each); events tab
  (boss, gauntlet, horde, king, mirror, endless, daily, fight a friend).
- **Plan (v75, v79)**: the Club grid; our events become the activities.

### Combat
- **Eslabong**: league 5v5 in rounds; captain control or autobattle; mana and
  stamina; 12-option tactics, formations, live orders.
- **Iron League today**: 1-3 a side, captain control, behavior rows.
- **Plan (v80)**: series of rounds and bigger squads once the roster and
  market can feed them.
