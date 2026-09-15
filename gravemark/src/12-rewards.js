/* Gravemark — 12-rewards.js
   What a kill pays: gold and shards. Nothing drops. Gold raises the parish
   and hires the warband; shards cut names into heroes and anoint them. */
"use strict";

/* Shards are a deterministic trickle rather than a lottery, so inscription
   is never gated purely on luck. `findShards` widens the trickle. */
GM.SHARD_CHANCE = 0.18;

GM.rollRewards = function (stage, st, opts) {
  opts = opts || {};
  var gold = Math.max(1, Math.round(GM.goldFor(stage) * (1 + st.findGold) * (opts.goldMult || 1)));
  var chance = GM.SHARD_CHANCE * (opts.shardMult || 1) * (1 + (st.findShards || 0));
  var shards = 0;
  while (chance > 0) {
    if (GM.chance(Math.min(1, chance))) shards += GM.randInt(1, 3);
    chance -= 1;
  }
  return { gold: gold, shards: shards };
};
