// Report-only census of the feed-filter trigger's truncation exposure
// (backlog item 60, option A — ruled 2026-09-14; measurement method from the
// gate-guards round's item-60 finding, item 64).
//
// `feedFilterSummary` (FeedFilter.jsx) composes the trigger's words from five
// independent axes — kinds, forms, order, seen, also — and collapses to a
// change-count once the spelled sentence outgrows its own 26-char budget.
// Nothing here re-implements that: every candidate summary is produced by
// calling the real master function, the way check-readouts.mjs calls the
// real formatters instead of re-deriving their output.
//
// WHAT "REACHABLE" MEANS HERE: the full cross product of each axis's own
// value space (kinds/forms/also as subsets of their declared list, in
// DECLARED order; order and seen as their two states each) — every axis is
// independently settable through the sheet, so every combination is a state
// a reader can leave the sheet in. Two axes (kinds, forms, also) also carry
// an ORDER a reader could produce by clicking in a different sequence
// (`toggle` appends by click order, and the trigger's head capitalizes only
// the first of two kinds) — this census does not enumerate click-order
// permutations, only the declared-order canonical member of each subset, so
// the reachable count here is a LOWER BOUND on the true click-order space,
// not the full one. Flagged in the lane report rather than guessed past.
//
// WIDTH, PRECISELY: real `figtree.ttf` advance summing — cmap (format 4) to
// glyph id, hmtx to font-unit advance, scaled by the trigger's own
// `--text-label-large` size (0.875rem = 14px) and letter-spacing
// (0.00625rem = 0.1px/char). The committed TTF's default instance is the
// variable font's wght=300 (Light) corner; the trigger itself renders at
// wght 500 (`--text-label-large--font-weight`), which is wider. This is a
// LOWER BOUND on true rendered width, same caveat item 60's own measurement
// carried — no gvar/HVAR interpolation here, by the same zero-new-dependency
// mechanical scope.
//
// Report-only: prints the census line and always exits 0 — "gaps are
// reported, never failed" (check-flows.mjs's own idiom). It becomes a real
// gate once item 64 rules a threshold to hold the tree to.
//
// Run from this directory: node report-summaries.mjs

import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const t0 = Date.now();
const require = createRequire(import.meta.url);
const React = require("react");
const Babel = require("@babel/standalone");

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

// ---- the masters, compiled the way bundle.mjs (and check-readouts.mjs)
// compile them — see check-readouts.mjs for why this reads the source
// directly rather than importing it: `_ds_bundle.js` keeps non-capitalized
// helpers in its private scope, and `feedFilterSummary` is one of them.
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

// OrderSection.jsx first: FeedFilter.jsx's `FEED_ORDER = FILTER_ORDER` needs
// it in scope at module-eval time.
const ds = loadMasters([
  join(root, "components/navigation/OrderSection.jsx"),
  join(root, "components/navigation/FeedFilter.jsx"),
]);

// ---- figtree.ttf, parsed by hand: sfnt table directory, then just the two
// tables a plain advance-width sum needs (`head` for unitsPerEm, `hhea` for
// how many `hmtx` entries exist, `cmap` format 4 for codepoint → glyph id,
// `hmtx` for the glyph's own advance). No glyph outlines are touched.
const fontPath = join(root, "assets/fonts/figtree.ttf");
const font = readFileSync(fontPath);

function readTableDirectory(buf) {
  const numTables = buf.readUInt16BE(4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = buf.toString("ascii", rec, rec + 4);
    tables[tag] = { offset: buf.readUInt32BE(rec + 8), length: buf.readUInt32BE(rec + 12) };
  }
  return tables;
}

function parseCmapFormat4(buf, subtableOffset) {
  const format = buf.readUInt16BE(subtableOffset);
  if (format !== 4) throw new Error(`report-summaries.mjs: unsupported cmap subtable format ${format} — figtree.ttf's format changed`);
  const segCountX2 = buf.readUInt16BE(subtableOffset + 6);
  const segCount = segCountX2 / 2;
  const endCodeOff = subtableOffset + 14;
  const startCodeOff = endCodeOff + segCountX2 + 2; // +2 skips reservedPad
  const idDeltaOff = startCodeOff + segCountX2;
  const idRangeOff = idDeltaOff + segCountX2;

  const map = new Map();
  for (let s = 0; s < segCount; s++) {
    const endCode = buf.readUInt16BE(endCodeOff + s * 2);
    const startCode = buf.readUInt16BE(startCodeOff + s * 2);
    const idDelta = buf.readInt16BE(idDeltaOff + s * 2);
    const idRangeOffset = buf.readUInt16BE(idRangeOff + s * 2);
    if (startCode === 0xffff && endCode === 0xffff) continue;
    for (let c = startCode; c <= endCode; c++) {
      let glyphId;
      if (idRangeOffset === 0) {
        glyphId = (c + idDelta) & 0xffff;
      } else {
        const addr = idRangeOff + s * 2 + idRangeOffset + 2 * (c - startCode);
        glyphId = buf.readUInt16BE(addr);
        if (glyphId !== 0) glyphId = (glyphId + idDelta) & 0xffff;
      }
      if (glyphId !== 0) map.set(c, glyphId);
    }
  }
  return map;
}

function loadFont(buf) {
  const tables = readTableDirectory(buf);
  const unitsPerEm = buf.readUInt16BE(tables.head.offset + 18);
  const numberOfHMetrics = buf.readUInt16BE(tables.hhea.offset + 34);

  const advances = new Array(numberOfHMetrics);
  for (let i = 0; i < numberOfHMetrics; i++) {
    advances[i] = buf.readUInt16BE(tables.hmtx.offset + i * 4);
  }

  // Prefer the Windows/Unicode-BMP subtable (platform 3, encoding 1); fall
  // back to the Unicode platform's own (platform 0). Both are format 4 in
  // figtree.ttf.
  const cmapBase = tables.cmap.offset;
  const numSubtables = buf.readUInt16BE(cmapBase + 2);
  let chosenOffset = null;
  let fallbackOffset = null;
  for (let i = 0; i < numSubtables; i++) {
    const rec = cmapBase + 4 + i * 8;
    const platformID = buf.readUInt16BE(rec);
    const encodingID = buf.readUInt16BE(rec + 2);
    const subOffset = cmapBase + buf.readUInt32BE(rec + 4);
    if (platformID === 3 && encodingID === 1) chosenOffset = subOffset;
    else if (platformID === 0) fallbackOffset = subOffset;
  }
  const cmap = parseCmapFormat4(buf, chosenOffset ?? fallbackOffset);

  return {
    unitsPerEm,
    advanceOf: (glyphId) => (glyphId < advances.length ? advances[glyphId] : advances[advances.length - 1]),
    cmap,
  };
}

const font_ = loadFont(font);

// The trigger's own type: FilterTrigger's `reading` span
// (components/navigation/FeedFilter.jsx) sets `fontSize:
// var(--text-label-large)` and inherits `fontWeight:
// var(--text-label-large--font-weight)` — 0.875rem / 500 / 0.00625rem
// (tokens/typography.css). 500 is above the shipped TTF's own wght=300
// default instance — see the file header's lower-bound note.
const FONT_SIZE_PX = 0.875 * 16;
const LETTER_SPACING_PX = 0.00625 * 16;

function measure(text) {
  let units = 0;
  const missing = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    const glyphId = font_.cmap.get(cp);
    if (glyphId === undefined) {
      missing.push(ch);
      continue;
    }
    units += font_.advanceOf(glyphId);
  }
  const charCount = [...text].length;
  const widthPx = (units / font_.unitsPerEm) * FONT_SIZE_PX + charCount * LETTER_SPACING_PX;
  return { widthPx, missing };
}

// ---- enumerate the reachable value space — see the file header for what
// "reachable" means here (declared-order subsets, not click-order
// permutations).
function subsetsInOrder(items) {
  const out = [];
  for (let mask = 0; mask < 1 << items.length; mask++) {
    const subset = [];
    for (let i = 0; i < items.length; i++) if (mask & (1 << i)) subset.push(items[i].value);
    out.push(subset);
  }
  return out;
}

const kindsSubsets = subsetsInOrder(ds.FEED_KINDS); // 2^10
const formsSubsets = subsetsInOrder(ds.FEED_FORMS); // 2^3
const alsoSubsets = subsetsInOrder(ds.FEED_ALSO); // 2^2
const orderValues = ds.FEED_ORDER.map((o) => o.value); // ["ranked", "newest"]
const seenValues = [false, true];

const summaries = new Set();
for (const kinds of kindsSubsets) {
  for (const forms of formsSubsets) {
    for (const order of orderValues) {
      for (const seen of seenValues) {
        for (const also of alsoSubsets) {
          summaries.add(ds.feedFilterSummary({ kinds, forms, order, seen, also }));
        }
      }
    }
  }
}

// ---- measure every reachable summary once.
const TRIGGER_CEILING_PX = 198; // the trigger's own maxWidth: 14rem text room (backlog item 60)
const BAND_CEILING_PX = 154; // the CograBand's actual room for the trigger (backlog items 60, 64)

let overTrigger = 0;
let overBand = 0;
let widestText = "";
let widestPx = -1;
const missingGlyphs = new Set();

for (const text of summaries) {
  const { widthPx, missing } = measure(text);
  for (const ch of missing) missingGlyphs.add(ch);
  if (widthPx > TRIGGER_CEILING_PX) overTrigger++;
  if (widthPx > BAND_CEILING_PX) overBand++;
  if (widthPx > widestPx) {
    widestPx = widthPx;
    widestText = text;
  }
}

if (missingGlyphs.size > 0) {
  console.log(`note report-summaries: figtree.ttf has no glyph for: ${[...missingGlyphs].map((c) => `"${c}"`).join(", ")} — those characters measured as 0px`);
}

const M = summaries.size;
console.log(
  `${overTrigger} of ${M} reachable summaries exceed the trigger's ${TRIGGER_CEILING_PX}px; ` +
    `${overBand} of ${M} exceed the band's ${BAND_CEILING_PX}px; ` +
    `widest: '${widestText}' at ${widestPx.toFixed(1)}px`,
);
console.log(`report-summaries: ${M} reachable summaries measured in ${Date.now() - t0} ms`);
