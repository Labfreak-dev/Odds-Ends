/* Gravemark — tools/check-globals.js
   Every src file is a CLASSIC script: they share one global scope, so two
   files declaring the same top-level `var`/`function`/`let` silently clobber
   each other. That is how the art cache got nulled by the stat cache.
   This check fails the build on any duplicate. */
"use strict";
const fs = require("fs"), path = require("path");
const SRC = path.join(__dirname, "..", "src");

const decls = new Map();          /* name -> [files] */
const files = fs.readdirSync(SRC).filter(f => f.endsWith(".js")).sort();

for (const f of files) {
  const lines = fs.readFileSync(path.join(SRC, f), "utf8").split("\n");
  let depth = 0, inBlockComment = false;
  for (const raw of lines) {
    let line = raw;
    /* crude but sufficient: strip comments and strings before counting braces */
    if (inBlockComment) {
      const end = line.indexOf("*/");
      if (end < 0) continue;
      line = line.slice(end + 2);
      inBlockComment = false;
    }
    const bc = line.indexOf("/*");
    if (bc >= 0 && line.indexOf("*/", bc) < 0) { line = line.slice(0, bc); inBlockComment = true; }
    line = line.replace(/\/\*.*?\*\//g, "").replace(/\/\/.*$/, "");
    const stripped = line.replace(/"(\\.|[^"\\])*"/g, '""').replace(/'(\\.|[^'\\])*'/g, "''");

    if (depth === 0) {
      const m = stripped.match(/^\s*(?:var|let|const|function)\s+([A-Za-z_$][\w$]*)/);
      if (m) {
        const name = m[1];
        if (!decls.has(name)) decls.set(name, []);
        if (!decls.get(name).includes(f)) decls.get(name).push(f);
      }
    }
    for (const ch of stripped) {
      if (ch === "{" || ch === "(" || ch === "[") depth++;
      else if (ch === "}" || ch === ")" || ch === "]") depth--;
    }
    if (depth < 0) depth = 0;
  }
}

const clashes = [...decls.entries()].filter(([, fs2]) => fs2.length > 1);
console.log("scanned " + files.length + " files, " + decls.size + " top-level names");
if (clashes.length) {
  console.log("\nCOLLISIONS (same global declared in more than one file):");
  for (const [name, fs2] of clashes) console.log("  \u2717 " + name + "  \u2014 " + fs2.join(", "));
  console.log("\nFAIL " + clashes.length + " collision(s)");
  process.exit(1);
}
console.log("PASS no top-level collisions");
