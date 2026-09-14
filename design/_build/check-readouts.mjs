// Checks the hand-drawn pad readouts against the masters' own format contract
// (backlog item 54.2): `RefPair`, `ComposePad`, `TagPad`, `TagPadCompose`,
// `PadKeyAbsent` and the shared `ReplyPadBody` spell their face and their pair
// as literals, because `nearestAnchor` and the formatters are master-side
// helpers the bundle does not expose to screens. Six literals with no compiler
// between them and the contract is exactly where drift lives: a pad value moves
// and its readout does not, or a negative pair reaches a board written with an
// ASCII hyphen where readme §3 rules U+2212.
//
// So the check reads the value each pad is actually set to and asks the MASTERS
// what that value reads as — `formatStancePair` / `formatTagPair` for the pair,
// `nearestAnchor` / `nearestTagAnchor` for the face, `padPercentOf` for where a
// knob sits. Nothing here re-implements a rule: every expectation is a helper's
// return value, so the day a formatter changes, these boards are told.
//
// Run from this directory: node check-readouts.mjs   (exit 1 on any FAIL)

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const t0 = Date.now();
const require = createRequire(import.meta.url);
const React = require("react");
const Babel = require("@babel/standalone");

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const screensDir = join(root, "designs/canonical/screens");

// ---- the masters, compiled the way bundle.mjs compiles them.
// `_ds_bundle.js` keeps these helpers in its private scope on purpose — only
// capitalized exports reach the namespace a screen sees — so the bundle cannot
// hand them over and the check compiles the two modules it needs itself.
const IMPORT_RE = /^import\s+([\s\S]*?)\s+from\s+"([^"]+)";?\s*$/gm;
const EXPORT_RE = /^export\s+(?:function|const|class)\s+(\w+)/gm;

function loadMasters(paths) {
  const scope = {};
  for (const path of paths) {
    const source = readFileSync(path, "utf8");
    const imported = [];
    const stripped = source
      .replace(IMPORT_RE, (whole, clause, from) => {
        if (!from.startsWith(".")) return "";
        const named = clause.match(/\{([\s\S]*)\}/);
        if (named) for (const piece of named[1].split(",")) if (piece.trim()) imported.push(piece.trim());
        return "";
      })
      .replace(/^export\s+(function|const|class)/gm, "$1");
    const exported = [...source.matchAll(EXPORT_RE)].map((m) => m[1]);
    const compiled = Babel.transform(stripped, { presets: ["react"] }).code;
    const factory = new Function(
      "React",
      "__scope",
      `const { ${imported.join(", ")} } = __scope;\n${compiled}\nreturn { ${exported.join(", ")} };`,
    );
    Object.assign(scope, factory(React, scope));
  }
  return scope;
}

const ds = loadMasters([
  join(root, "components/stance/StanceReadout.jsx"),
  join(root, "components/stance/StancePad.jsx"),
]);

const fails = [];
const infos = [];

// ---- the six hand-drawn readouts.
// A site is named by its file and, where a file holds more than one component,
// the function that draws it. Everything else about a site is READ, never
// declared: which family it belongs to comes from the pad's own `ranges` prop,
// and what it should say comes from the pad's own `value`. A declaration that
// stops matching its source is a failure, not a skip — a readout that quietly
// leaves the check's sight is the drift this check exists to catch.
const SITES = [
  { file: "RefPair.jsx" },
  { file: "PadKeyAbsent.jsx" },
  { file: "TagPad.jsx" },
  { file: "TagPadCompose.jsx" },
  { file: "_shared.jsx", region: "ReplyPadBody" },
  // The one-axis pad: `StancePad` is not here (a post's own `pInterest` is not
  // a choice), so the board draws its own field and there is no `value` prop to
  // read. Its number is checked against the formatter and against where the
  // knob it draws actually sits; its face has no master lookup to check against
  // — a one-axis pick names no pair — and is reported rather than guessed.
  { file: "ComposePad.jsx", oneAxis: true },
];

function regionOf(source, file, region) {
  if (!region) return source;
  const start = source.search(new RegExp(`^(?:export )?function ${region}\\(`, "m"));
  if (start === -1) return null;
  const rest = source.slice(start + 1);
  const end = rest.search(/^(?:export )?function \w+\(/m);
  return end === -1 ? source.slice(start) : source.slice(start, start + 1 + end);
}

// Exactly one match, or the site no longer looks the way the check reads it.
function only(region, re, what, site) {
  const found = [...region.matchAll(re)];
  if (found.length === 1) return found[0];
  fails.push(`${site}: expected exactly one ${what}, found ${found.length} — the readout moved; re-read it in check-readouts.mjs`);
  return null;
}

const FACE_RE = /lineHeight: 1\.2 \}\}>\s*([^\s<][^<]*?)\s*<\/span>/g;
const EXACT_RE = /className="cg-exact"[^>]*>\s*([^<]*?)\s*<\/span>/g;
const PAD_RE = /<StancePad\s+value=\{\{\s*pDirected:\s*(-?[\d.]+),\s*pInterest:\s*(-?[\d.]+)\s*\}\}([^>]*?)\/>/g;
const KNOB_RE = /left: "([\d.]+)%", top: "50%", width: 24, height: 24/g;
const SPOKEN_RE = /style=\{SR_ONLY\}>\s*([\s\S]*?)\s*<\/span>/g;
// Every number the system writes is two decimals; the sign is U+002B or the
// U+2212 MINUS readme §3 rules. A hyphen is not in the class ON PURPOSE — a
// pair written with one must reach the round-trip below and fail there, with
// the character named, rather than slip past the scanner as "no number here".
const NUMBER_RE = /[+−-]?\d+\.\d+/g;

for (const site of SITES) {
  const file = join(screensDir, site.file);
  const source = readFileSync(file, "utf8");
  const name = site.region ? `${site.file} (${site.region})` : site.file;
  const region = regionOf(source, site.file, site.region);
  if (region === null) {
    fails.push(`${name}: no such function in the file — the region declared in check-readouts.mjs is gone`);
    continue;
  }

  const face = only(region, FACE_RE, "face literal", name);
  const exact = only(region, EXACT_RE, "cg-exact literal", name);
  const spoken = only(region, SPOKEN_RE, "spoken reading", name);
  if (!face || !exact || !spoken) continue;

  let expectedPair;
  let expectedFace;
  if (site.oneAxis) {
    // The literal is the only place the value is written, so it is the value:
    // round-tripping it through the formatter is what says it is written the
    // way the system writes a number at all.
    const parsed = Number(exact[1].replace("−", "-"));
    if (!Number.isFinite(parsed)) {
      fails.push(`${name}: "${exact[1]}" is not a number the system could have written`);
      continue;
    }
    expectedPair = ds.formatDimension(parsed);
    const knob = only(region, KNOB_RE, "knob position", name);
    if (knob) {
      const drawn = Number(knob[1]);
      const owed = ds.padPercentOf({ pDirected: parsed, pInterest: 0 }).x;
      if (drawn !== owed) {
        fails.push(`${name}: the knob sits at ${drawn}% but ${expectedPair} is ${owed}% of the field (padPercentOf)`);
      }
    }
    infos.push(`${name}: face ${face[1]} unchecked — a one-axis pick names no pair, so no anchor table answers for it`);
    expectedFace = face[1];
  } else {
    const pad = only(region, PAD_RE, "StancePad", name);
    if (!pad) continue;
    const value = { pDirected: Number(pad[1]), pInterest: Number(pad[2]) };
    const tagFamily = pad[3].includes("TAG_RANGES");
    expectedPair = tagFamily ? ds.formatTagPair(value) : ds.formatStancePair(value);
    expectedFace = (tagFamily ? ds.nearestTagAnchor(value) : ds.nearestAnchor(value)).emoji;
  }

  if (exact[1] !== expectedPair) {
    fails.push(`${name}: the readout says "${exact[1]}" where the pad's value reads "${expectedPair}"`);
  }
  if (face[1] !== expectedFace) {
    fails.push(`${name}: the face is ${face[1]} where the anchor table answers ${expectedFace}`);
  }

  // The spoken reading carries the same numbers in words; a pad value that
  // moves the drawn readout and not this one leaves a screen reader with the
  // old pick.
  const owed = expectedPair.split(" / ");
  const said = expectedPair.match(NUMBER_RE) ?? [];
  const heard = spoken[1].match(NUMBER_RE) ?? [];
  if (heard.join(" ") !== said.join(" ")) {
    fails.push(`${name}: the spoken reading says ${heard.join(", ") || "no numbers"} where the pair reads ${owed.join(", ")}`);
  }
}

// ---- nothing hand-spells a number outside the six.
// The table above is a list of sites, not of files, so a seventh hand-drawn
// readout would be checked by nobody — including one added to a file already
// on the list, which is why this counts per file rather than asking whether the
// file is declared at all. What it counts: a `cg-exact` span whose content is a
// spelled number rather than an expression the render already computed.
const declaredPerFile = new Map();
for (const site of SITES) declaredPerFile.set(site.file, (declaredPerFile.get(site.file) ?? 0) + 1);
for (const file of readdirSync(screensDir).sort()) {
  if (!file.endsWith(".jsx")) continue;
  const source = readFileSync(join(screensDir, file), "utf8");
  const spelled = [...source.matchAll(EXACT_RE)].map(([, content]) => content).filter((c) => /^[+−-]?\d/.test(c));
  const owed = declaredPerFile.get(file) ?? 0;
  if (spelled.length > owed) {
    fails.push(
      `${file}: hand-spells ${spelled.length} number${spelled.length === 1 ? "" : "s"} in cg-exact spans (${spelled.map((c) => `"${c}"`).join(", ")}) where check-readouts.mjs declares ${owed} — an unchecked literal is not a state a readout gets to be in`,
    );
  }
}

for (const i of infos) console.log(`note ${i}`);
for (const f of fails) console.log(`FAIL ${f}`);
console.log(`check-readouts: ${SITES.length} hand-drawn readouts · ${fails.length ? `${fails.length} failures` : "ok"} in ${Date.now() - t0} ms`);
if (fails.length) process.exit(1);
