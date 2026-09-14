/* Gravemark — tools/art-manifest.js
   Dumps the asset manifest as JSON so non-JS tooling (tools/art-check.py) can
   validate delivered art against it without duplicating the spec. */
"use strict";
const { load } = require("./harness");
const GM = load({ quiet: true });
GM.startSeason("s_none");
console.log(JSON.stringify(GM.ART, null, 0));
