# Hollowmere design spec

This is the number source for Hollowmere. Reference notes supplied the shape of the curves. Every figure below is computed from the formula in the same section. There is no difficulty ladder and no optional harder-dive toggle. Floor depth is the only scale. An old save may still contain a `difficulty` field; load ignores it, and the next save does not write it.

Player-facing words in this spec are Hollowmere's. The code field `Item.ancient` stays, because saves already use it. The word shown to the player for that flag is Deepwrought.

The shipping numbers live in `Hollowmere.Core.DesignTable`. Tests read the tables in this file and compare them to `DesignTable`.

## 1. Experience

Character levels run from 1 to 70. The cost to leave level L, for L from 1 through 69, is

`XpToNext(L) = round(120 * L^1.75)`

`round` is half-to-even, the same rule as `decimal` rounding to 0 places. Level 70 does not spend character XP. `Balance.XpToNext(70)` stays `long.MaxValue` so the level loop stops. Cumulative XP to *arrive* at level N is the sum of `XpToNext(1)` through `XpToNext(N-1)`.

Why this exponent: 1.75 sits between a straight line and a square, so the first hour moves and levels 60–69 cost real time. Level 1 costs 120, which is a handful of floor-1 kills. Reaching level 70 costs 5,073,279 XP.

### T.xp

| Level | XpToNext | CumulativeToArrive |
| --- | --- | --- |
| 1 | 120 | 0 |
| 2 | 404 | 120 |
| 3 | 821 | 524 |
| 4 | 1358 | 1345 |
| 5 | 2006 | 2703 |
| 6 | 2760 | 4709 |
| 7 | 3615 | 7469 |
| 8 | 4567 | 11084 |
| 9 | 5612 | 15651 |
| 10 | 6748 | 21263 |
| 11 | 7973 | 28011 |
| 12 | 9284 | 35984 |
| 13 | 10680 | 45268 |
| 14 | 12159 | 55948 |
| 15 | 13720 | 68107 |
| 16 | 15360 | 81827 |
| 17 | 17079 | 97187 |
| 18 | 18876 | 114266 |
| 19 | 20749 | 133142 |
| 20 | 22698 | 153891 |
| 21 | 24721 | 176589 |
| 22 | 26818 | 201310 |
| 23 | 28987 | 228128 |
| 24 | 31228 | 257115 |
| 25 | 33541 | 288343 |
| 26 | 35924 | 321884 |
| 27 | 38377 | 357808 |
| 28 | 40899 | 396185 |
| 29 | 43489 | 437084 |
| 30 | 46147 | 480573 |
| 31 | 48872 | 526720 |
| 32 | 51665 | 575592 |
| 33 | 54523 | 627257 |
| 34 | 57447 | 681780 |
| 35 | 60437 | 739227 |
| 36 | 63491 | 799664 |
| 37 | 66609 | 863155 |
| 38 | 69792 | 929764 |
| 39 | 73037 | 999556 |
| 40 | 76346 | 1072593 |
| 41 | 79717 | 1148939 |
| 42 | 83151 | 1228656 |
| 43 | 86647 | 1311807 |
| 44 | 90204 | 1398454 |
| 45 | 93822 | 1488658 |
| 46 | 97501 | 1582480 |
| 47 | 101240 | 1679981 |
| 48 | 105040 | 1781221 |
| 49 | 108899 | 1886261 |
| 50 | 112818 | 1995160 |
| 51 | 116796 | 2107978 |
| 52 | 120833 | 2224774 |
| 53 | 124929 | 2345607 |
| 54 | 129083 | 2470536 |
| 55 | 133296 | 2599619 |
| 56 | 137566 | 2732915 |
| 57 | 141893 | 2870481 |
| 58 | 146278 | 3012374 |
| 59 | 150720 | 3158652 |
| 60 | 155219 | 3309372 |
| 61 | 159775 | 3464591 |
| 62 | 164387 | 3624366 |
| 63 | 169055 | 3788753 |
| 64 | 173779 | 3957808 |
| 65 | 178558 | 4131587 |
| 66 | 183393 | 4310145 |
| 67 | 188283 | 4493538 |
| 68 | 193229 | 4681821 |
| 69 | 198229 | 4875050 |
| 70 | — | 5073279 |

The last cumulative cell is the XP required to arrive at 70, which is 5073279.

### After 70: Delve ranks

Character level stays 70. Further XP fills Delve ranks. Rank k (k starts at 1) costs

`DelveXp(k) = round(XpToNext(69) * 1.04^(k-1))`

`XpToNext(69)` is 198,229. The first rank costs one full endgame level. Each later rank costs 4% more, so a rank stays a short run rather than a blank number or a wall. One rank grants one Delve point. Points are spent in town, and the town sells a full reset.

Four tabs, and the point caps:

| Tab | Line | Per point | Cap (points) |
| --- | --- | --- | --- |
| Core | Main stat | +5 | none |
| Core | Vitality | +5 | 50 |
| Core | Move speed | +0.5% | 50 |
| Offense | Critical chance | +0.2% | 50 |
| Offense | Critical damage | +1% | 50 |
| Offense | Attack speed | +0.2% | 50 |
| Offense | Cooldown reduction | +0.2% | 50 |
| Defense | Life percent | +0.5% | 50 |
| Defense | Armor | +20 | 50 |
| Defense | All resist | +2 | 50 |
| Defense | Life per second | +10 | 50 |
| Utility | Area damage | +1% | 50 |
| Utility | Resource cost reduction | +0.2% | 50 |
| Utility | Life on hit | +20 | 50 |
| Utility | Gold find | +1% | 50 |

A level's natural growth is +3 main stat, so a Delve point is richer (+5) and the XP price is the whole of level 69. Capped lines stop at 50 points: 25% move speed, 10% critical chance, 50% critical damage.

### T.delve

| Rank | DelveXp |
| --- | --- |
| 1 | 198229 |
| 2 | 206158 |
| 3 | 214404 |
| 4 | 222981 |
| 5 | 231900 |
| 10 | 282142 |
| 25 | 508121 |
| 50 | 1354568 |

## 2. Stats, damage, armor, crit, resist

A level-L hero with no gear has

- Main stat `7 + 3L` on the class stat (Strength, Dexterity, or Intelligence). The other two are `7 + L`.
- Vitality `7 + 2L`.
- Life `40 + 10L + 10 * Vitality`.
- Critical chance 5, critical damage 50. Both are percent points.
- Armor starts at 0 from items. Strength then adds 1 armor per point. Intelligence adds `Intelligence / 10` all resist.

Damage of one hero hit, before the skill coefficient:

`weaponRoll * (1 + Main/100) * (1 + DamagePercent/100) * (1 + ElementPercent/100) * (1 + EliteDamage/100 if the target is elite)`

A critical hit, rolled at `min(1, CritChance/100)`, multiplies that by `1 + CritDamage/100`.

Sheet DPS uses the average of min and max weapon damage, times attacks per second, times the same main-stat, damage-percent, and expected-crit factors. Expected crit factor is `1 + min(1, CritChance/100) * CritDamage/100`. At the naked 5 / 50 that factor is 1.025.

Incoming physical damage is multiplied by `1 - Armor / (Armor + 50 * attackerLevel)`. Elemental damage uses all resist: `1 - Resist / (Resist + 5 * attackerLevel)`. A further `DamageReduction` percent, capped at 75, applies after that. A block, capped at 75% chance, multiplies the remainder by 0.4.

The 50 and the 5 are the mitigation slopes. Naked Ironclad armor equals main stat, so at level 1 armor is 10 and mitigation against a level-1 hit is `10/60 = 1/6`. At level 70 armor is 217 and mitigation against a level-70 hit is `217 / (217 + 3500) = 217/3717`. Resist uses a slope of 5 so a point of resist matters about ten times a point of armor, which matches resist being granted at one tenth of Intelligence.

### T.stats

| Level | Main | Off | Vitality | Life | NakedArmorMitigation | NakedResistMitigation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 10 | 8 | 9 | 140 | 0.166667 | 0.137931 |
| 10 | 37 | 17 | 27 | 410 | 0.068901 | 0.032882 |
| 20 | 67 | 27 | 47 | 710 | 0.062793 | 0.026290 |
| 30 | 97 | 37 | 67 | 1010 | 0.060739 | 0.024073 |
| 40 | 127 | 47 | 87 | 1310 | 0.059709 | 0.022960 |
| 50 | 157 | 57 | 107 | 1610 | 0.059089 | 0.022292 |
| 60 | 187 | 67 | 127 | 1910 | 0.058676 | 0.021845 |
| 70 | 217 | 77 | 147 | 2210 | 0.058380 | 0.021526 |

Naked resist in that table uses the off-stat Intelligence of a Strength hero (`(7+L)/10`). A Hexweaver's resist uses main-stat Intelligence instead: `(7+3L)/10` over `(7+3L)/10 + 5L`.

## 3. Depth scaling

Monster level from the floor alone, before the hero-level lift already in `Balance.MonsterLevel`, is

`LevelFromFloor(F) = clamp(F + floor(F/10), 1, 73)`

`73` is `MaxLevel + 3`. `Balance.MonsterLevel` may still raise this when the hero is more than 10 levels above the floor, and that function is unchanged. The table uses `LevelFromFloor` only, which is the dive when the hero is not ahead.

A normal monster with role multipliers 1 has

`NormalLife(F) = round(ExpectedHeroDps(L) * MonsterToughness(L) * 1.12^Tier(F))`

`NormalDamage(F) = round(ExpectedHeroLife(L) * 0.055 * 1.08^Tier(F))`

`L = LevelFromFloor(F)`. `Tier(F) = max(0, floor((F-60)/10))`. Floors 1–69 are tier 0, so the 12% and 8% do not touch the early dive. From floor 70 the tier adds pressure after monster level has stopped climbing in a useful way.

`ExpectedHeroDps`, `MonsterToughness`, and `ExpectedHeroLife` stay the functions in `Balance.cs`. Toughness is `1.6 + 2.4 * clamp((L-5)/30, 0, 1)`.

Rank multipliers, applied to the unrounded normal life and damage before the final round:

| Rank | Life | Damage | XP |
| --- | --- | --- | --- |
| Normal | 1 | 1 | 1 |
| Minion | 1.8 | 1.3 | 1.5 |
| Champion | 4 | 1.6 | 4 |
| Elite | 7 | 1.9 | 8 |
| Guardian | 28 on the DPS*toughness base, not on NormalLife | 2.2 | 40 |

Nothing else multiplies life, damage, or XP. There is no per-save difficulty.

### Monster XP and the two pace anchors

A clear's expected XP is computed from the generator as it stands.

- Room target `7 + min(floor(F/3), 6)`. The entry room does not spawn. Mean packs per other room is 1.5 (`Range(1, 3)`).
- Pack roll: elite 0.08, else champion 0.12, else normal. Those two constants stay.
- Normal pack size is the leader's role: swarm mean 6.5, brute mean 1.5, otherwise mean 4. Each body is the leader 75% of the time and a uniform pool member 25% of the time. Pool members are the non-boss defs whose depth band contains F.
- Elite pack: one leader at 8× its `def.xp`, plus mean 3.5 minions at 1.5× the pool's mean `def.xp`.
- Champion pack: mean 3.5 bodies at 4× the leader's `def.xp`.
- On a guardian floor (`F` divisible by 5) the exit room is a guardian (40× `def.xp` of 1) instead of packs, so packing rooms are `target - 2`.

Let `K(F)` be that expected total of `def.xp * rank` units. The unit XP at monster level L is the line

`Unit(L) = round(-6.008511016257839 + 10.547001071872975 * L)`

Those two coefficients are the unique solution of

`sum_{F=1..8} K(F) * (a + b * LevelFromFloor(F)) = 21263`

`sum_{F=1..28} K(F) * (a + b * LevelFromFloor(F)) = 480573`

21,263 is the cumulative XP to arrive at level 10. 480,573 is the cumulative XP to arrive at level 30. So an expected clear of floors 1–8 reaches level 10, and floors 1–28 reaches level 30, before per-kill rounding. `a + bL` is positive for every legal monster level (4.54 at level 1).

A spawned monster's XP is `round(Unit(L) * def.xp * rankXp)`. The table's NormalXP column is `round(Unit(L))` for `def.xp = 1` and rank XP 1.

### T.floors

| Floor | Level | NormalLife | NormalDamage | NormalXP | ChampionLife | EliteLife | GuardianLife |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 | 16 | 17 | 5 | 63 | 110 | — |
| 2 | 2 | 24 | 35 | 15 | 96 | 169 | — |
| 3 | 3 | 34 | 53 | 26 | 135 | 237 | — |
| 4 | 4 | 45 | 71 | 36 | 180 | 315 | — |
| 5 | 5 | 58 | 90 | 47 | 232 | 405 | 1622 |
| 6 | 6 | 76 | 108 | 57 | 305 | 533 | — |
| 7 | 7 | 98 | 126 | 68 | 392 | 686 | — |
| 8 | 8 | 124 | 144 | 78 | 496 | 867 | — |
| 9 | 9 | 154 | 162 | 89 | 617 | 1079 | — |
| 10 | 11 | 230 | 198 | 110 | 921 | 1611 | 6445 |
| 11 | 12 | 277 | 216 | 121 | 1108 | 1938 | — |
| 12 | 13 | 330 | 234 | 131 | 1321 | 2312 | — |
| 13 | 14 | 391 | 252 | 142 | 1563 | 2735 | — |
| 14 | 15 | 459 | 270 | 152 | 1836 | 3213 | — |
| 15 | 16 | 536 | 288 | 163 | 2143 | 3750 | 15002 |
| 16 | 17 | 622 | 306 | 173 | 2487 | 4352 | — |
| 17 | 18 | 717 | 324 | 184 | 2869 | 5022 | — |
| 18 | 19 | 824 | 342 | 194 | 3295 | 5765 | — |
| 19 | 20 | 941 | 360 | 205 | 3765 | 6589 | — |
| 20 | 22 | 1213 | 396 | 226 | 4854 | 8494 | 33978 |
| 21 | 23 | 1370 | 414 | 237 | 5479 | 9589 | — |
| 22 | 24 | 1541 | 432 | 247 | 6163 | 10785 | — |
| 23 | 25 | 1727 | 451 | 258 | 6909 | 12090 | — |
| 24 | 26 | 1930 | 469 | 268 | 7720 | 13510 | — |
| 25 | 27 | 2150 | 487 | 279 | 8600 | 15051 | 60202 |
| 26 | 28 | 2389 | 505 | 289 | 9554 | 16720 | — |
| 27 | 29 | 2646 | 523 | 300 | 10585 | 18524 | — |
| 28 | 30 | 2924 | 541 | 310 | 11697 | 20471 | — |
| 29 | 31 | 3224 | 559 | 321 | 12895 | 22567 | — |
| 30 | 33 | 3891 | 595 | 342 | 15564 | 27238 | 108950 |
| 31 | 34 | 4261 | 613 | 353 | 17045 | 29828 | — |
| 32 | 35 | 4657 | 631 | 363 | 18628 | 32599 | — |
| 33 | 36 | 4980 | 649 | 374 | 19921 | 34862 | — |
| 34 | 37 | 5318 | 667 | 384 | 21273 | 37228 | — |
| 35 | 38 | 5671 | 685 | 395 | 22685 | 39699 | 158794 |
| 36 | 39 | 6040 | 703 | 405 | 24158 | 42277 | — |
| 37 | 40 | 6424 | 721 | 416 | 25694 | 44965 | — |
| 38 | 41 | 6823 | 739 | 426 | 27294 | 47764 | — |
| 39 | 42 | 7240 | 757 | 437 | 28959 | 50678 | — |
| 40 | 44 | 8123 | 793 | 458 | 32491 | 56859 | 227436 |
| 41 | 45 | 8590 | 812 | 469 | 34360 | 60130 | — |
| 42 | 46 | 9075 | 830 | 479 | 36300 | 63524 | — |
| 43 | 47 | 9578 | 848 | 490 | 38311 | 67045 | — |
| 44 | 48 | 10099 | 866 | 500 | 40396 | 70694 | — |
| 45 | 49 | 10639 | 884 | 511 | 42556 | 74473 | 297891 |
| 46 | 50 | 11198 | 902 | 521 | 44791 | 78385 | — |
| 47 | 51 | 11776 | 920 | 532 | 47104 | 82432 | — |
| 48 | 52 | 12374 | 938 | 542 | 49495 | 86616 | — |
| 49 | 53 | 12992 | 956 | 553 | 51966 | 90941 | — |
| 50 | 55 | 14288 | 992 | 574 | 57153 | 100018 | 400073 |

Guardian life uses the 28× base, not 28× the already-rounded normal life. Champion and elite life use 4× and 7× the unrounded normal life, then round.

### T.depthtier

| Floor | Tier | LifeScale | DamageScale |
| --- | --- | --- | --- |
| 60 | 0 | 1.000000 | 1.000000 |
| 70 | 1 | 1.120000 | 1.080000 |
| 80 | 2 | 1.254400 | 1.166400 |
| 90 | 3 | 1.404928 | 1.259712 |
| 100 | 4 | 1.573519 | 1.360489 |
| 120 | 6 | 1.973823 | 1.586874 |

## 4. Elites, champions, affixes

Each pack rolls one number in `[0, 1)`.

- Below 0.08: a named elite, plus 3 or 4 minions (`Range(3, 5)`).
- Below 0.20: a champion pack of 3 or 4.
- Otherwise a normal pack.

With 6 to 12 spawning rooms and 1.5 packs each, a floor expects about 0.7 to 1.4 elite packs and 1.1 to 2.2 champion packs.

Affix count comes from the floor, not from a menu. `extra = floor(F / 20)`. Champions roll `1 + extra`, elites roll `2 + extra`, and a guardian rolls `extra` (none on floors 1–19, one from floor 20, two from floor 40). The new affixes are added at the end of the enum so existing ordinals do not move.

### T.affixdepth

| Floor | Champion | Elite | Guardian |
| --- | --- | --- | --- |
| 1 | 1 | 2 | 0 |
| 19 | 1 | 2 | 0 |
| 20 | 2 | 3 | 1 |
| 40 | 3 | 4 | 2 |
| 50 | 3 | 4 | 2 |

Each affix shows its name under the elite bar and draws the telegraph before the damage.

### T.affix

| Id | Name | Telegraph |
| --- | --- | --- |
| Hasty | Swift | No ground mark. The body leans forward and the move loop runs at 1.5×. |
| Armored | Plated | A grey shell on the body. Hits show a chip, not a pool. |
| Vampiric | Leech | A red thread from the target back to the body on each hit that heals. |
| Molten | Cinder Trail | A 2 m fire pool under the body, 0.2 s of warning, then 4 s of damage. |
| Frozen | Rime | Three 1.8 m frost circles near the hero, 1.5 s of warning, then a 60% slow. |
| Teleporter | Blink | A violet burst at the old spot and the new spot. No damage in the burst. |
| Shielding | Aegis | A pale sphere for 2.5 s. Damage taken in that window is zero. |
| Plagued | Miasma | A 2.5 m poison pool on the hero, 0.8 s of warning, then 5 s of damage. |
| Extra | Hulking | The life bar is 1.5× and the name is prefixed. No separate pool. |
| Waller | Raised Wall | A 4 m line of stone across the hero, 0.6 s of dust, then a 3 s blocker. |
| Sweep | Searing Sweep | A rotating 6 m beam, shown as a bright wedge for 0.4 s before it ticks. |
| Pulse | Frost Pulse | A ring that grows from 1 m to 5 m over 1.2 s, then a frost hit on the ring. |
| Mortar | Lobber | A red circle, radius 2 m, on the hero for 1.0 s, then a hit. |
| Jailer | Manacles | A ring at the hero's feet for 0.5 s, then a 2 s root if they are still inside. |

## 5. Loot

Item level is `clamp(monsterLevel + (1 if the source is elite, guardian, or boss), 1, 70)`.

On a normal kill with magic find 0, the five chances sum to 1:

`Special(F) = min(0.06, 0.01 + 0.0005 * F)`

`P(Legendary) = 0.70 * Special(F)` before normalizing

`P(Set) = 0.30 * Special(F)`

`P(Rare) = (0.08 + 0.001 * min(F, 50)) * (1 + MagicFind/100)`

`P(Magic) = 0.28 * (1 + MagicFind/100)`

`P(Common) = 1 - Special(F) - P0(Rare) - 0.28` when magic find is 0. With magic find, the five weights are normalized so they sum to 1. Depth does not add a second loot multiplier on top of `Special(F)`.

Special hits the 6% cap at floor 100, because `0.01 + 0.0005 * 100 = 0.06`.

Other sources multiply the special weight and shift the common weight, then normalize:

| Source | Common weight | Special multiplier | Rare multiplier |
| --- | --- | --- | --- |
| Normal | as above | 1 | 1 |
| Champion | 0.25 | 3 | 3 |
| Elite | 0 | 5 | 5 |
| Guardian | 0, and magic weight 0 | 30 | rare weight is 0.60 before normalize |
| Chest | 0.20 | 2 | 2 |
| Gamble | 0, and magic weight 0 | the special weight is 0.10, split 70/30, and is not multiplied again | rare weight is 0.90 |
| Fishing | 0.30 | 2 | 2.5 |

A guardian's rare weight is 0.60 before the weights are normalized, and its special weight is thirty times the floor's special chance. After that roll, a guardian that produced no legendary and no set still has an extra 0.35 chance to add one. Gamble spends the curio's price on a 0.90 rare / 0.10 special roll. Fishing keeps a common weight of 0.30, doubles special, and multiplies rare by 2.5.

### T.drops

Chances for a normal kill, magic find 0. Percents, three decimals.

| Floor | Common | Magic | Rare | Legendary | Set |
| --- | --- | --- | --- | --- | --- |
| 1 | 62.850 | 28.000 | 8.100 | 0.735 | 0.315 |
| 2 | 62.700 | 28.000 | 8.200 | 0.770 | 0.330 |
| 3 | 62.550 | 28.000 | 8.300 | 0.805 | 0.345 |
| 4 | 62.400 | 28.000 | 8.400 | 0.840 | 0.360 |
| 5 | 62.250 | 28.000 | 8.500 | 0.875 | 0.375 |
| 6 | 62.100 | 28.000 | 8.600 | 0.910 | 0.390 |
| 7 | 61.950 | 28.000 | 8.700 | 0.945 | 0.405 |
| 8 | 61.800 | 28.000 | 8.800 | 0.980 | 0.420 |
| 9 | 61.650 | 28.000 | 8.900 | 1.015 | 0.435 |
| 10 | 61.500 | 28.000 | 9.000 | 1.050 | 0.450 |
| 11 | 61.350 | 28.000 | 9.100 | 1.085 | 0.465 |
| 12 | 61.200 | 28.000 | 9.200 | 1.120 | 0.480 |
| 13 | 61.050 | 28.000 | 9.300 | 1.155 | 0.495 |
| 14 | 60.900 | 28.000 | 9.400 | 1.190 | 0.510 |
| 15 | 60.750 | 28.000 | 9.500 | 1.225 | 0.525 |
| 16 | 60.600 | 28.000 | 9.600 | 1.260 | 0.540 |
| 17 | 60.450 | 28.000 | 9.700 | 1.295 | 0.555 |
| 18 | 60.300 | 28.000 | 9.800 | 1.330 | 0.570 |
| 19 | 60.150 | 28.000 | 9.900 | 1.365 | 0.585 |
| 20 | 60.000 | 28.000 | 10.000 | 1.400 | 0.600 |
| 21 | 59.850 | 28.000 | 10.100 | 1.435 | 0.615 |
| 22 | 59.700 | 28.000 | 10.200 | 1.470 | 0.630 |
| 23 | 59.550 | 28.000 | 10.300 | 1.505 | 0.645 |
| 24 | 59.400 | 28.000 | 10.400 | 1.540 | 0.660 |
| 25 | 59.250 | 28.000 | 10.500 | 1.575 | 0.675 |
| 26 | 59.100 | 28.000 | 10.600 | 1.610 | 0.690 |
| 27 | 58.950 | 28.000 | 10.700 | 1.645 | 0.705 |
| 28 | 58.800 | 28.000 | 10.800 | 1.680 | 0.720 |
| 29 | 58.650 | 28.000 | 10.900 | 1.715 | 0.735 |
| 30 | 58.500 | 28.000 | 11.000 | 1.750 | 0.750 |
| 31 | 58.350 | 28.000 | 11.100 | 1.785 | 0.765 |
| 32 | 58.200 | 28.000 | 11.200 | 1.820 | 0.780 |
| 33 | 58.050 | 28.000 | 11.300 | 1.855 | 0.795 |
| 34 | 57.900 | 28.000 | 11.400 | 1.890 | 0.810 |
| 35 | 57.750 | 28.000 | 11.500 | 1.925 | 0.825 |
| 36 | 57.600 | 28.000 | 11.600 | 1.960 | 0.840 |
| 37 | 57.450 | 28.000 | 11.700 | 1.995 | 0.855 |
| 38 | 57.300 | 28.000 | 11.800 | 2.030 | 0.870 |
| 39 | 57.150 | 28.000 | 11.900 | 2.065 | 0.885 |
| 40 | 57.000 | 28.000 | 12.000 | 2.100 | 0.900 |
| 41 | 56.850 | 28.000 | 12.100 | 2.135 | 0.915 |
| 42 | 56.700 | 28.000 | 12.200 | 2.170 | 0.930 |
| 43 | 56.550 | 28.000 | 12.300 | 2.205 | 0.945 |
| 44 | 56.400 | 28.000 | 12.400 | 2.240 | 0.960 |
| 45 | 56.250 | 28.000 | 12.500 | 2.275 | 0.975 |
| 46 | 56.100 | 28.000 | 12.600 | 2.310 | 0.990 |
| 47 | 55.950 | 28.000 | 12.700 | 2.345 | 1.005 |
| 48 | 55.800 | 28.000 | 12.800 | 2.380 | 1.020 |
| 49 | 55.650 | 28.000 | 12.900 | 2.415 | 1.035 |
| 50 | 55.500 | 28.000 | 13.000 | 2.450 | 1.050 |

### Affix counts

Counts are exact so a drop is readable at a glance.

### T.affixcount

| Rarity | Primary | Secondary |
| --- | --- | --- |
| Common | 0 | 0 |
| Magic | 2 | 0 |
| Rare | 4 | 2 |
| Legendary | 4 | 1 |
| Set | 4 | 1 |

Legendary and set items also carry their fixed power, which is not one of these affixes. Rare and above that are rolled for a class put that class's main stat in one primary slot (the existing smart-loot rule).

### Sockets and the jeweler

Sockets roll on weapons, helms, chests, and legs only. One socket per piece.

| Rarity | Socket chance |
| --- | --- | --- |
| Common | 0 |
| Magic | 0 |
| Rare | 0.25 |
| Legendary | 1 |
| Set | 1 |

Four gems, five ranks. Rank R is tuned at item level `1 + (R-1)*17`, so the ranks sit on levels 1, 18, 35, 52, and 69. The value is the affix midpoint at that level, rounded half-to-even. Combining three gems of rank R costs `100 * R * R` gold and yields one gem of rank R+1. Rank 5 does not combine.

| Gem | Socket effect |
| --- | --- |
| Cinder | Weapon: adds the Min column to minimum damage and the Max column to maximum damage. Helm: `+R%` XP from kills. |
| Thorn | `+Crit` critical damage percent. |
| Marrow | `+Life` maximum life, which is 10× the vitality midpoint. |
| Salt | `+Resist` all resist. |

### T.gems

| Rank | ItemLevel | CinderMin | CinderMax | ThornCrit | MarrowLife | SaltResist | CombineGold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 | 2 | 3 | 6 | 35 | 4 | 100 |
| 2 | 18 | 9 | 16 | 16 | 1049 | 24 | 400 |
| 3 | 35 | 17 | 30 | 26 | 2063 | 44 | 900 |
| 4 | 52 | 24 | 43 | 37 | 3077 | 64 | 1600 |
| 5 | 69 | 32 | 57 | 47 | 4090 | 84 | 0 |

Deepwrought: once the floor is at least 60 and the item level is 70, a legendary or set item has a 0.10 chance to set `ancient`. Rolls on a Deepwrought item use 1.3× the usual scale, which is the factor already in `Loot.Generate`. There is no second perfect-roll tier.

## 6. Globes, beams, level-up

A health globe heals `0.25 * max life` on pickup and uses the hero's pickup radius.

- A normal kill drops one with probability 0.08.
- An elite, champion, or guardian drops one the first time its life fraction falls to or below 0.75, 0.50, and 0.25. That is three globes, one per quarter of the bar except the killing blow, which already drops loot.

The potion keeps its current heal: 60% of max life spread over 2 seconds. The cooldown becomes 20 seconds, because globes are the heal you take by standing your ground and the potion is the one you save.

Ground beams and name labels use the rarity colours already returned by `ItemText.RarityColor`:

| Rarity | Hex |
| --- | --- | --- |
| Common | #e8e8e8 |
| Magic | #6f8cff |
| Rare | #ffe25a |
| Legendary | #ff8a1e |
| Set | #3fe05a |

Beam height is 3.5 m, a point light of range 6 and intensity 2 in that colour, and the label sits at 1.2 m. Legendary and set beams also play the existing legendary sting if one is assigned. A guardian death spawns the beams in a ring of radius 1.5 m rather than a single pile.

On reaching a new character level, a warm pillar (`#e8c77a`, intensity 6, range 8) stands on the hero for 1.2 seconds, and a toast reads `Level N` plus the name of each skill whose `reqLevel` is N and each rune whose unlock level is N. If nothing unlocks, the toast is `Level N` only.

## 7. Guardians

Every 5th floor the exit room is a guardian. Life fraction sets the phase:

| Phase | While life fraction is | Cooldown scale | Damage scale |
| --- | --- | --- | --- |
| 1 | above 0.66 | 1 | 1 |
| 2 | above 0.33 and at most 0.66 | 0.80 | 1 |
| 3 | at most 0.33 | 0.80 | 1.25 |

Crossing into phase 2 or 3 plays a 0.6 second ring of radius 4 m and a toast with the guardian's name and the phase number. In phase 3, every 8 seconds a 2.5 m hazard circle is marked for 1.0 second at the hero's feet, then hits for the guardian's damage.

The story guardian is the floor-40 exit. It uses the same phase rules. No separate health multiplier.

## 8. UI layout, 2340 × 1080 dp

The design canvas is 2340 by 1080 dp, landscape, origin at the top-left. 1 dp is one pixel of that canvas. The runtime scaler may letterbox; these rectangles are in design dp, not raw device pixels. Nothing here overlaps another rectangle in the same screen.

### T.ui

| Screen | Id | X | Y | W | H |
| --- | --- | --- | --- | --- | --- |
| hud | portrait | 24 | 24 | 72 | 72 |
| hud | healthGlobe | 108 | 28 | 64 | 64 |
| hud | resourceGlobe | 184 | 28 | 64 | 64 |
| hud | xpBar | 108 | 100 | 360 | 16 |
| hud | gold | 24 | 124 | 280 | 28 |
| hud | buffRow | 24 | 160 | 400 | 36 |
| hud | minimap | 2136 | 24 | 180 | 180 |
| hud | quest | 1960 | 212 | 356 | 72 |
| hud | bossBar | 760 | 24 | 820 | 48 |
| hud | targetBar | 890 | 80 | 560 | 36 |
| hud | joystick | 24 | 896 | 160 | 160 |
| hud | primary | 2220 | 960 | 96 | 96 |
| hud | skill1 | 2108 | 984 | 72 | 72 |
| hud | skill2 | 2060 | 888 | 72 | 72 |
| hud | skill3 | 2148 | 808 | 72 | 72 |
| hud | skill4 | 2244 | 848 | 72 | 72 |
| hud | potion | 1980 | 984 | 64 | 64 |
| inventory | panel | 48 | 48 | 2244 | 984 |
| inventory | doll | 72 | 120 | 640 | 860 |
| inventory | model | 248 | 200 | 280 | 520 |
| inventory | stats | 760 | 120 | 480 | 860 |
| inventory | grid | 1500 | 160 | 472 | 552 |
| inventory | gridCell | 0 | 0 | 72 | 72 |
| inventory | tooltip | 1040 | 200 | 440 | 560 |
| vendor | panel | 48 | 48 | 2244 | 984 |
| vendor | goods | 72 | 120 | 900 | 760 |
| vendor | actions | 72 | 900 | 900 | 80 |
| vendor | grid | 1500 | 160 | 472 | 552 |
| hero | list | 24 | 120 | 400 | 880 |
| hero | stage | 448 | 120 | 1100 | 820 |
| hero | info | 1580 | 120 | 480 | 560 |
| hero | play | 960 | 960 | 420 | 72 |

Inventory grid is 6 columns by 7 rows. Cell pitch is 72 plus an 8 dp gap, and `6*72 + 5*8 = 472`, `7*72 + 6*8 = 552`. The cell row's X and Y are the cell size, not a position. Tooltip is a card, not a hover, and it sits between the stat column and the grid.

Paper-doll slots, coordinates inside the doll rect (add 72, 120 for canvas position). Each slot is 72×72 except the two weapons, which are 72×120.

### T.doll

| Slot | X | Y | W | H |
| --- | --- | --- | --- | --- |
| head | 284 | 24 | 72 | 72 |
| shoulders | 120 | 160 | 72 | 72 |
| amulet | 448 | 160 | 72 | 72 |
| chest | 284 | 200 | 72 | 72 |
| hands | 40 | 300 | 72 | 72 |
| wrists | 40 | 390 | 72 | 72 |
| waist | 284 | 400 | 72 | 72 |
| legs | 284 | 490 | 72 | 72 |
| feet | 284 | 620 | 72 | 72 |
| weapon | 40 | 520 | 72 | 120 |
| offhand | 528 | 520 | 72 | 120 |
| ring1 | 40 | 660 | 72 | 72 |
| ring2 | 528 | 660 | 72 | 72 |

Empty slots draw the silhouette for that family. Filled slots wash the cell with the rarity colour at 45% toward white and put an 8 dp rarity bar on the bottom edge.

