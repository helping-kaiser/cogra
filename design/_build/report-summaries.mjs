// The gate on the feed-filter trigger's width, and the census behind it
// (backlog items 60 + 64, ruled 2026-09-14).
//
// `feedFilterSummary` (FeedFilter.jsx) composes the trigger's words from six
// independent axes — kinds, topic, forms, order, seen, also — and collapses to
// a change-count once the spelled sentence outgrows the band's 154px. Nothing
// here re-implements that: every candidate summary is produced by calling the
// real master function and measured with the master's own
// `measureTriggerText`, the way check-readouts.mjs calls the real formatters
// instead of re-deriving their output. What this stage owns is the font: it
// re-derives the master's advance table from `figtree.ttf` and fails if the
// two have drifted, so the budget and the ruler can never disagree.
//
// WHAT "REACHABLE" MEANS HERE: the full cross product of each axis's own
// value space (kinds/forms/also as subsets of their declared list, in
// DECLARED order; order and seen as their two states each) — every axis is
// independently settable through the sheet, so every combination is a state
// a reader can leave the sheet in. Three axes also carry an ORDER a reader
// could produce by clicking in a different sequence (`toggle` appends by
// click order), and this census enumerates only the declared-order member of
// each subset. That is EXACT for what the gate measures, not a sample:
//   - the head no longer spells more than one kind, so a kinds permutation
//     cannot change it (one label, or "N kinds");
//   - forms and also join their labels into one extra, and a permutation
//     reorders the same characters — an advance sum is commutative, so every
//     permutation of a subset measures to the same width, collapses at the
//     same point, and passes or fails this gate together.
// Permutations still spell distinct STRINGS, so the count below is a lower
// bound on distinct readings; every width they can produce is measured.
//
// THE TOPIC AXIS IS THE ONE WHOSE VALUE SPACE IS THE READER'S (the topic
// round, 2026-09-14): a tag name, not a declared label. It is still finite and
// still exactly gated, for two reasons the contract gives and one the master
// does:
//   - the name's grammar is ASCII `[A-Za-z0-9._-]`, 1 to 128 bytes
//     (hashtag.md §2), so no name can reach outside the measured alphabet and
//     none can be longer than the widest one below;
//   - the topic is spelled as an EXTRA, never in the head, and an extra is
//     exactly what the collapse takes away — so a name too wide to spell
//     leaves the summary entirely rather than stretching it;
//   - `feedFilterSummary` returns the spelled sentence only after measuring it
//     against the budget, so the spelled branch can never be the overflow. The
//     only branch this gate can fail on is the collapse, `head · N changes`,
//     and that string carries no name at all.
// So three states cover it exactly: absent; a representative name, which
// exercises the spelled branch; and the WIDEST NAME THE GRAMMAR ALLOWS, which
// forces the collapse branch in every combination — including the ones a short
// name would still spell. Enumerating more names would add strings, not widths.
//
// WIDTH, PRECISELY: real `figtree.ttf` advance summing AT THE TRIGGER'S OWN
// RENDER WEIGHT — cmap (format 4) to glyph id, hmtx to the font-unit advance
// of the default instance, then `fvar`/`avar`/`HVAR` to move that advance
// from the shipped default (wght=300, the Light corner) to the 500 the
// trigger actually renders at, scaled by `--text-label-large`'s size
// (0.875rem = 14px) and the tracking term the master documents. Advance
// instancing needs no glyph outlines and no new dependency: `HVAR` carries
// the per-glyph advance deltas over the normalized axis, and `avar` the warp
// that maps user coordinates onto it.
//
// A GATE, ABSOLUTELY (item 60 closed by item 64's rule): any reachable
// summary over the band's budget exits nonzero. The budget is the master's
// own collapse point, so an overflow is never a wide word — it is the
// collapse failing, and no judgment is owed before failing on it. The census
// line prints either way; it is the useful reporting the stage started as.
//
// Run from this directory: node report-summaries.mjs
//   --print-metrics   emit the wght-500 advance table for FeedFilter.jsx
//                     instead of the census (see the master's own note)

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

// ---- figtree.ttf, parsed by hand: sfnt table directory, then just the
// tables a per-character advance needs at a chosen weight (`head` for
// unitsPerEm, `hhea` for how many `hmtx` entries exist, `cmap` format 4 for
// codepoint → glyph id, `hmtx` for the default instance's advance, and
// `fvar`/`avar`/`HVAR` to instance that advance at another point on the
// weight axis). No glyph outlines are touched.
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

// ---- variable-font advance instancing, the spec's own four steps
// (OpenType 1.9, "OpenType Font Variations Common Table Formats").
//
// 1. `fvar` declares the axis and its min/default/max in USER coordinates
//    (wght 300 / 300 / 900 here — the shipped default is the Light corner).
// 2. The user coordinate is NORMALIZED to −1…0…+1 against that triple, then
//    warped by `avar`'s piecewise-linear segment map for the axis.
// 3. `HVAR`'s ItemVariationStore holds, per glyph, a row of deltas — one per
//    variation region — and each region contributes its delta scaled by how
//    far the normalized coordinate sits inside its start/peak/end tent.
// 4. The instanced advance is the `hmtx` advance plus that weighted sum.
//
// This is exactly what a shaping engine does to the advance; what it does
// NOT do here is interpolate outlines (`gvar`), which advances never need.
const F2DOT14 = 16384;

function readAxes(buf, tables) {
  const base = tables.fvar.offset;
  const count = buf.readUInt16BE(base + 8);
  const size = buf.readUInt16BE(base + 10);
  const offset = base + buf.readUInt16BE(base + 4);
  const axes = [];
  for (let i = 0; i < count; i++) {
    const rec = offset + i * size;
    axes.push({
      tag: buf.toString("ascii", rec, rec + 4),
      min: buf.readInt32BE(rec + 4) / 65536,
      def: buf.readInt32BE(rec + 8) / 65536,
      max: buf.readInt32BE(rec + 12) / 65536,
    });
  }
  return axes;
}

function normalizeCoord(axis, value) {
  const clamped = Math.min(Math.max(value, axis.min), axis.max);
  if (clamped === axis.def) return 0;
  return clamped < axis.def ? -(axis.def - clamped) / (axis.def - axis.min) : (clamped - axis.def) / (axis.max - axis.def);
}

function readAvarMaps(buf, tables) {
  if (!tables.avar) return null;
  const base = tables.avar.offset;
  const axisCount = buf.readUInt16BE(base + 6);
  const maps = [];
  let cursor = base + 8;
  for (let i = 0; i < axisCount; i++) {
    const pairCount = buf.readUInt16BE(cursor);
    cursor += 2;
    const pairs = [];
    for (let j = 0; j < pairCount; j++) {
      pairs.push([buf.readInt16BE(cursor) / F2DOT14, buf.readInt16BE(cursor + 2) / F2DOT14]);
      cursor += 4;
    }
    maps.push(pairs);
  }
  return maps;
}

function applyAvar(maps, index, coord) {
  const pairs = maps && maps[index];
  if (!pairs || pairs.length < 2) return coord;
  for (let i = 1; i < pairs.length; i++) {
    const [fromPrev, toPrev] = pairs[i - 1];
    const [from, to] = pairs[i];
    if (coord >= fromPrev && coord <= from) {
      return from === fromPrev ? to : toPrev + ((to - toPrev) * (coord - fromPrev)) / (from - fromPrev);
    }
  }
  return coord;
}

function readItemVariationStore(buf, offset) {
  const regionListOffset = offset + buf.readUInt32BE(offset + 2);
  const dataCount = buf.readUInt16BE(offset + 6);

  const regionAxisCount = buf.readUInt16BE(regionListOffset);
  const regionCount = buf.readUInt16BE(regionListOffset + 2);
  const regions = [];
  let cursor = regionListOffset + 4;
  for (let r = 0; r < regionCount; r++) {
    const region = [];
    for (let a = 0; a < regionAxisCount; a++) {
      region.push({
        start: buf.readInt16BE(cursor) / F2DOT14,
        peak: buf.readInt16BE(cursor + 2) / F2DOT14,
        end: buf.readInt16BE(cursor + 4) / F2DOT14,
      });
      cursor += 6;
    }
    regions.push(region);
  }

  const datas = [];
  for (let i = 0; i < dataCount; i++) {
    const dataOffset = offset + buf.readUInt32BE(offset + 8 + i * 4);
    const itemCount = buf.readUInt16BE(dataOffset);
    const wordDeltaCount = buf.readUInt16BE(dataOffset + 2);
    const regionIndexCount = buf.readUInt16BE(dataOffset + 4);
    const longWords = (wordDeltaCount & 0x8000) !== 0;
    const wordCount = wordDeltaCount & 0x7fff;
    const regionIndexes = [];
    for (let j = 0; j < regionIndexCount; j++) regionIndexes.push(buf.readUInt16BE(dataOffset + 6 + j * 2));
    const rowsOffset = dataOffset + 6 + regionIndexCount * 2;
    const rowSize = wordCount * (longWords ? 4 : 2) + (regionIndexCount - wordCount) * (longWords ? 2 : 1);
    datas.push({ itemCount, wordCount, longWords, regionIndexes, rowsOffset, rowSize });
  }

  return { regions, datas };
}

function regionScalar(region, coords) {
  let scalar = 1;
  for (let a = 0; a < region.length; a++) {
    const { start, peak, end } = region[a];
    const coord = coords[a] ?? 0;
    let axisScalar;
    if (peak === 0 || coord === peak) axisScalar = 1;
    else if (coord <= start || coord >= end) axisScalar = 0;
    else if (coord < peak) axisScalar = (coord - start) / (peak - start);
    else axisScalar = (end - coord) / (end - peak);
    scalar *= axisScalar;
    if (scalar === 0) return 0;
  }
  return scalar;
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

  const axes = readAxes(buf, tables);
  const avarMaps = readAvarMaps(buf, tables);
  const hvarBase = tables.HVAR.offset;
  const store = readItemVariationStore(buf, hvarBase + buf.readUInt32BE(hvarBase + 4));
  const advanceMappingOffset = buf.readUInt32BE(hvarBase + 8);

  // With no advance mapping the glyph id indexes the first (and only)
  // ItemVariationData directly; with one, a DeltaSetIndexMap splits the
  // glyph's id into the (outer, inner) pair that addresses its delta row.
  let deltaSetIndex;
  if (advanceMappingOffset === 0) {
    deltaSetIndex = (glyphId) => ({ outer: 0, inner: glyphId });
  } else {
    const mapBase = hvarBase + advanceMappingOffset;
    const format = buf.readUInt8(mapBase);
    const entryFormat = buf.readUInt8(mapBase + 1);
    const mapCount = format === 0 ? buf.readUInt16BE(mapBase + 2) : buf.readUInt32BE(mapBase + 2);
    const dataOffset = mapBase + (format === 0 ? 4 : 6);
    const entrySize = ((entryFormat & 0x30) >> 4) + 1;
    const innerBits = (entryFormat & 0x0f) + 1;
    deltaSetIndex = (glyphId) => {
      // Past the map's end every remaining glyph repeats the last entry.
      const index = Math.min(glyphId, mapCount - 1);
      let raw = 0;
      for (let b = 0; b < entrySize; b++) raw = (raw << 8) | buf.readUInt8(dataOffset + index * entrySize + b);
      return { outer: raw >>> innerBits, inner: raw & ((1 << innerBits) - 1) };
    };
  }

  const deltaOf = (glyphId, coords) => {
    const { outer, inner } = deltaSetIndex(glyphId);
    const data = store.datas[outer];
    if (!data || inner >= data.itemCount) return 0;
    let cursor = data.rowsOffset + inner * data.rowSize;
    let delta = 0;
    for (let i = 0; i < data.regionIndexes.length; i++) {
      let value;
      if (i < data.wordCount) {
        value = data.longWords ? buf.readInt32BE(cursor) : buf.readInt16BE(cursor);
        cursor += data.longWords ? 4 : 2;
      } else {
        value = data.longWords ? buf.readInt16BE(cursor) : buf.readInt8(cursor);
        cursor += data.longWords ? 2 : 1;
      }
      if (value === 0) continue;
      const scalar = regionScalar(store.regions[data.regionIndexes[i]], coords);
      if (scalar !== 0) delta += scalar * value;
    }
    return delta;
  };

  const coordsFor = (userCoords) => axes.map((axis, i) => applyAvar(avarMaps, i, normalizeCoord(axis, userCoords[axis.tag] ?? axis.def)));

  return {
    unitsPerEm,
    axes,
    cmap,
    advanceOf: (glyphId, coords) => {
      const base = glyphId < advances.length ? advances[glyphId] : advances[advances.length - 1];
      return base + deltaOf(glyphId, coords);
    },
    coordsFor,
  };
}

const font_ = loadFont(font);

// The trigger's own type: FilterTrigger's `reading`
// (components/navigation/FeedFilter.jsx) sets `fontSize:
// var(--text-label-large)` and `fontWeight:
// var(--text-label-large--font-weight)` — 0.875rem / 500
// (tokens/typography.css). 500 is the weight instanced above, not the
// shipped TTF's own wght=300 default, so these are the widths the reader
// actually sees.
const RENDER_WEIGHT = 500;
const renderCoords = font_.coordsFor({ wght: RENDER_WEIGHT });
const FONT_SIZE_PX = 0.875 * 16;
const LETTER_SPACING_PX = 0.00625 * 16;

// ---- `--print-metrics`: the master's advance table, written from the font.
// `feedFilterSummary` decides what fits by measuring, and it composes in the
// browser too, where no TTF can be read — so the master carries the instanced
// advances as data. This is where that data comes from; the check below is
// what keeps it honest.
const TABLE_ALPHABET = [];
for (let cp = 0x20; cp <= 0x7e; cp++) TABLE_ALPHABET.push(String.fromCodePoint(cp));
TABLE_ALPHABET.push("·");

const advanceUnits = (character) => {
  const glyphId = font_.cmap.get(character.codePointAt(0));
  if (glyphId === undefined) throw new Error(`report-summaries.mjs: figtree.ttf has no glyph for U+${character.codePointAt(0).toString(16).toUpperCase()}`);
  return Math.round(font_.advanceOf(glyphId, renderCoords) * 100) / 100;
};

if (process.argv.includes("--print-metrics")) {
  const advances = TABLE_ALPHABET.map(advanceUnits);
  console.log(`const TRIGGER_ALPHABET =\n  ${JSON.stringify(TABLE_ALPHABET.join(""))};`);
  console.log("const TRIGGER_ADVANCES = [");
  for (let i = 0; i < advances.length; i += 10) {
    console.log("  " + advances.slice(i, i + 10).map((n) => n.toFixed(2)).join(", ") + ",");
  }
  console.log("];");
  process.exit(0);
}

// ---- ONE MEASUREMENT, TWO READERS. The census does not measure for itself:
// it asks the master's own `measureTriggerText` how wide a summary is, the way
// it asks `feedFilterSummary` what the summary says. What it checks instead is
// that the master's table still IS the font — each character re-derived from
// `figtree.ttf` at the render weight and compared against what the master
// makes of that character alone. A table drifting from the file it came from
// is a gate failure, not a rounding curiosity: it would move the collapse
// point on every board at once.
const drifted = [];
for (const character of TABLE_ALPHABET) {
  const expected = (advanceUnits(character) / font_.unitsPerEm) * FONT_SIZE_PX + LETTER_SPACING_PX;
  const actual = ds.measureTriggerText(character);
  if (Math.abs(actual - expected) > 1e-9) drifted.push({ character, expected, actual });
}
if (drifted.length > 0) {
  const shown = drifted.slice(0, 8).map((d) => `'${d.character}' ${d.actual.toFixed(4)}px vs the font's ${d.expected.toFixed(4)}px`);
  console.error(
    `report-summaries: FeedFilter.jsx's advance table no longer matches figtree.ttf at wght ${RENDER_WEIGHT} — ` +
      `${drifted.length} of ${TABLE_ALPHABET.length} characters drifted (${shown.join("; ")}${drifted.length > 8 ? "; …" : ""}). ` +
      `Regenerate it with \`node report-summaries.mjs --print-metrics\` and paste the block into the master.`,
  );
  process.exit(1);
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

const kindsSubsets = subsetsInOrder(ds.FEED_KINDS); // 2^4 — the four V1.0 serves
const formsSubsets = subsetsInOrder(ds.FEED_FORMS); // 2^3
const alsoSubsets = subsetsInOrder(ds.FEED_ALSO); // 2^2
const orderValues = ds.FEED_ORDER.map((o) => o.value); // ["ranked", "newest"]
const seenValues = [false, true];

// The topic axis, three states — see the header for why three is exact. The
// widest name the grammar allows is 128 bytes of the table's widest character
// (plus the `#` every topic wears), which is far past any budget and therefore
// forces the collapse wherever a topic is set at all.
const TAG_NAME_MAX_BYTES = 128; // hashtag.md §2
// A canonical name is ASCII-lowercased, so this is its whole alphabet; the
// widest character in it is found by asking the master's own stick, rather than
// named here, so the worst case cannot go stale against the font.
const TAG_NAME_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789._-";
const widestNameCharacter = [...TAG_NAME_ALPHABET].reduce((widest, character) =>
  ds.measureTriggerText(character) > ds.measureTriggerText(widest) ? character : widest,
);
const topicValues = [null, "#saltmaps", "#" + widestNameCharacter.repeat(TAG_NAME_MAX_BYTES)];

const summaries = new Set();
for (const kinds of kindsSubsets) {
  for (const topic of topicValues) {
    for (const forms of formsSubsets) {
      for (const order of orderValues) {
        for (const seen of seenValues) {
          for (const also of alsoSubsets) {
            summaries.add(ds.feedFilterSummary({ kinds, topic, forms, order, seen, also }));
          }
        }
      }
    }
  }
}

// ---- measure every reachable summary once, with the master's own stick.
const TRIGGER_CEILING_PX = 198; // the trigger's own maxWidth: 14rem text room (backlog item 60)
const BAND_CEILING_PX = ds.BAND_CEILING_PX; // the band's room for it, and the master's budget

let overTrigger = 0;
const overBand = [];
let widestText = "";
let widestPx = -1;
const unknownCharacters = new Set();
const tableCharacters = new Set(TABLE_ALPHABET);

for (const text of summaries) {
  for (const character of text) if (!tableCharacters.has(character)) unknownCharacters.add(character);
  const widthPx = ds.measureTriggerText(text);
  if (widthPx > TRIGGER_CEILING_PX) overTrigger++;
  if (widthPx > BAND_CEILING_PX) overBand.push({ text, widthPx });
  if (widthPx > widestPx) {
    widestPx = widthPx;
    widestText = text;
  }
}

// A summary reaching outside the checked alphabet measures by the table's
// widest character — safe, but no longer verified against the font.
if (unknownCharacters.size > 0) {
  console.error(
    `report-summaries: a reachable summary uses characters the checked table does not carry: ${[...unknownCharacters].map((c) => `'${c}'`).join(", ")} — ` +
      `widen TABLE_ALPHABET and regenerate the master's block with \`node report-summaries.mjs --print-metrics\`.`,
  );
  process.exit(1);
}

const M = summaries.size;
console.log(
  `${overTrigger} of ${M} reachable summaries exceed the trigger's ${TRIGGER_CEILING_PX}px; ` +
    `${overBand.length} of ${M} exceed the band's ${BAND_CEILING_PX}px; ` +
    `widest: '${widestText}' at ${widestPx.toFixed(1)}px`,
);

// ---- THE GATE (backlog items 60 + 64). The band's budget is the master's
// own collapse point, so a summary past it is not a wide string — it is the
// collapse failing to fire, and the pill drawing words nobody can read.
// Nothing here is a judgment call, which is why it exits nonzero.
if (overBand.length > 0) {
  const shown = overBand
    .sort((a, b) => b.widthPx - a.widthPx)
    .slice(0, 5)
    .map(({ text, widthPx }) => `'${text}' at ${widthPx.toFixed(1)}px`);
  console.error(
    `report-summaries: ${overBand.length} of ${M} reachable filter summaries exceed the band's ${BAND_CEILING_PX}px — ` +
      `${shown.join("; ")}${overBand.length > 5 ? "; …" : ""}. ` +
      `The trigger cannot draw them: widen the band's budget or shorten what the summary spells (FeedFilter.jsx).`,
  );
  process.exit(1);
}

console.log(`report-summaries: ${M} reachable summaries measured in ${Date.now() - t0} ms`);
