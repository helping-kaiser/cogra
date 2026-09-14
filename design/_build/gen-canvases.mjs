// Generates the per-canvas seed manifests (backlog item 69): the canonical
// tree is one master, but the editor it is reviewed in caps a canvas at 200
// files and 16MB, so review is split across the canvases `canvases.json`
// names. Membership is derived, never declared — a board belongs to the
// canvas that serves its `page`, so a new board joins one the moment this
// runs. Each canvas gets `designs/canonical/canvases/<id>/canvas.json` (its
// pages' artboards and annotations, coordinates verbatim) and `images.json`
// (the photographs its boards actually reference), so seeding reads one
// directory and scans nothing.
//
// This is also the gate on the split: a page no canvas claims or two claim,
// a board or an image that would not reach the canvas that needs it, a
// canvas over its file or byte budget, and a committed manifest regeneration
// no longer reproduces are each a failure.
//
// Run from this directory, after gen-maps: node gen-canvases.mjs  (exit 1 on FAIL)

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync, statSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const t0 = Date.now();
const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(here, "..", "designs/canonical");
const outRoot = join(dir, "canvases");
const imgDir = join(dir, "img");

// The editor's own ceilings, and the margins this gate holds instead: a wall
// found at publish time is found too late, so the budget sits under the cap
// far enough that the next few rounds of growth trip the gate, not the tool.
const FILE_CAP = 200;
const FILE_BUDGET = 180;
const BYTE_CAP = 16 * 1024 * 1024;
const BYTE_BUDGET = 14 * 1024 * 1024;

const IMAGE_EXT = /\.(?:jpe?g|png|gif|webp|avif|svg|bmp|ico)$/i;

const canvas = JSON.parse(readFileSync(join(dir, "canvas.json"), "utf8"));
const map = JSON.parse(readFileSync(join(dir, "canvases.json"), "utf8"));

const fails = [];
const notes = [];
const serialize = (o) => JSON.stringify(o, null, 2) + "\n";

// ---- the map covers the canvas exactly once ------------------------------

const pageIds = canvas.pages.map((p) => p.id);
const pageName = (id) => canvas.pages.find((p) => p.id === id)?.name ?? id;
const canvases = map.canvases ?? [];
if (!canvases.length) fails.push("canvases.json declares no canvases");

const seenId = new Set();
const claimedBy = new Map();
for (const c of canvases) {
  if (!c.id || !c.title || !Array.isArray(c.pages) || !c.pages.length || !c.launch)
    fails.push(`canvases.json: ${c.id ?? "(unnamed)"} needs id, title, a non-empty pages list and launch`);
  if (seenId.has(c.id)) fails.push(`canvases.json: ${c.id} is declared twice`);
  seenId.add(c.id);
  for (const p of c.pages ?? []) {
    if (!pageIds.includes(p)) fails.push(`canvases.json: ${c.id} claims page "${p}", which canvas.json does not know`);
    if (claimedBy.has(p)) fails.push(`page "${p}" is claimed by both ${claimedBy.get(p)} and ${c.id} — a page belongs to exactly one canvas`);
    else claimedBy.set(p, c.id);
  }
  if (c.launch && !(c.pages ?? []).includes(c.launch)) fails.push(`canvases.json: ${c.id} opens on "${c.launch}", which is not one of its pages`);
}
for (const p of pageIds) if (!claimedBy.has(p)) fails.push(`page "${p}" (${pageName(p)}) is claimed by no canvas — it would be reviewed nowhere`);

// A page an artboard or annotation names but canvas.json's `pages` omits is
// the same silent loss from the other end: the board is in the tree, on no
// page bar, and so in no canvas.
for (const a of canvas.artboards) if (!pageIds.includes(a.page)) fails.push(`artboard ${a.file} names page "${a.page}", which canvas.json's pages list does not declare`);
for (const a of canvas.annotations ?? []) if (!pageIds.includes(a.page)) fails.push(`annotation ${a.id} names page "${a.page}", which canvas.json's pages list does not declare`);

// ---- what each canvas carries --------------------------------------------

const images = existsSync(imgDir) ? readdirSync(imgDir).filter((f) => IMAGE_EXT.test(f)).sort() : [];
const imageBytes = Object.fromEntries(images.map((f) => [f, statSync(join(imgDir, f)).size]));
const imageSet = new Set(images);

// Boards name their pictures by bare filename, so the scan is over the
// rendered source itself — there is no manifest on a board to trust.
const REF = /(?:src|href)\s*=\s*"([^"]*)"|url\(\s*(['"]?)([^'")]+)\2\s*\)/g;
const boardUses = new Map();
const boardBytes = new Map();
const unresolved = new Set();
const nonImage = new Set();
for (const a of canvas.artboards) {
  const path = join(dir, a.file);
  if (!existsSync(path)) {
    fails.push(`artboard ${a.file} is in canvas.json but not in the tree`);
    continue;
  }
  const html = readFileSync(path, "utf8");
  boardBytes.set(a.file, Buffer.byteLength(html));
  boardUses.set(a.file, images.filter((f) => html.includes(f)));
  for (const m of html.matchAll(REF)) {
    const ref = m[1] ?? m[3];
    if (!ref || /^(?:data:|https?:|#|mailto:)/.test(ref)) continue;
    const name = basename(ref.split(/[?#]/)[0]);
    if (IMAGE_EXT.test(name)) {
      if (!imageSet.has(name)) unresolved.add(`${name} (${a.file})`);
    } else if (name.includes(".")) nonImage.add(name); // an in-app route has no extension and names no file
  }
}
for (const u of unresolved) fails.push(`${u} is referenced by a board and is not in img/ — no canvas could carry it`);
const unused = images.filter((f) => ![...boardUses.values()].some((u) => u.includes(f)));
if (unused.length) notes.push(`img/ carries ${unused.length} unreferenced file(s), seeded onto no canvas: ${unused.join(", ")}`);
if (nonImage.size) notes.push(`named by a board and carried by no canvas, because the tree holds no such file: ${[...nonImage].sort().join(", ")}`);

// ---- the manifests --------------------------------------------------------

const outputs = new Map();
const rows = [];
for (const c of canvases) {
  const pages = c.pages ?? [];
  const artboards = canvas.artboards.filter((a) => pages.includes(a.page));
  const annotations = (canvas.annotations ?? []).filter((a) => pages.includes(a.page));
  const used = images.filter((f) => artboards.some((a) => (boardUses.get(a.file) ?? []).includes(f)));
  const bytes = artboards.reduce((s, a) => s + (boardBytes.get(a.file) ?? 0), 0) + used.reduce((s, f) => s + imageBytes[f], 0);

  const manifest = {
    artboards,
    annotations,
    launch: { view: "canvas", page: c.launch },
    pages: pages.map((p) => canvas.pages.find((q) => q.id === p)).filter(Boolean),
  };
  outputs.set(`${c.id}/canvas.json`, serialize(manifest));
  outputs.set(`${c.id}/images.json`, serialize({ from: "../../img", images: used }));

  // The canvas is the boards, the pictures beside them and its own manifest;
  // images.json is the seeder's note to itself and never ships.
  const files = artboards.length + used.length + 1;
  const total = bytes + Buffer.byteLength(outputs.get(`${c.id}/canvas.json`));
  rows.push({ c, boards: artboards.length, images: used.length, files, bytes: total });
  if (files > FILE_BUDGET) fails.push(`${c.id} seeds ${files} files, over the ${FILE_BUDGET} budget (the editor caps a canvas at ${FILE_CAP}) — split a page off it`);
  if (total > BYTE_BUDGET)
    fails.push(`${c.id} seeds ${(total / 1048576).toFixed(2)} MB, over the ${(BYTE_BUDGET / 1048576).toFixed(0)} MB budget (the editor publishes at most ${(BYTE_CAP / 1048576).toFixed(0)} MB) — split a page off it`);
  if (!artboards.length) fails.push(`${c.id} would seed no boards`);
}

const pad = (s, n) => String(s).padEnd(n);
for (const r of rows)
  console.log(
    `${pad(r.c.id, 8)} boards ${pad(r.boards, 4)} images ${pad(r.images, 3)} files ${pad(`${r.files}/${FILE_CAP}`, 8)} ${pad(`${(r.bytes / 1048576).toFixed(2)}/${(BYTE_CAP / 1048576).toFixed(1)} MB`, 15)} headroom ${Math.round((1 - r.files / FILE_CAP) * 100)}% files · ${Math.round((1 - r.bytes / BYTE_CAP) * 100)}% bytes`,
  );
for (const n of notes) console.log(n);

// Nothing is written while the split is wrong: a manifest generated from a
// map that does not cover the canvas is a confident lie on disk.
if (fails.length) {
  for (const f of fails) console.log(`FAIL ${f}`);
  console.log(`gen-canvases: ${fails.length} failures in ${Date.now() - t0} ms`);
  process.exit(1);
}

// ---- write, and hold the committed copies to the regeneration -------------

const existing = new Set();
if (existsSync(outRoot))
  for (const d of readdirSync(outRoot, { withFileTypes: true })) {
    if (!d.isDirectory()) {
      existing.add(d.name);
      continue;
    }
    for (const f of readdirSync(join(outRoot, d.name))) existing.add(`${d.name}/${f}`);
  }

const drift = [];
for (const [rel, body] of outputs) {
  const path = join(outRoot, rel);
  const had = existing.has(rel) ? readFileSync(path, "utf8") : null;
  if (had === body) continue;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  drift.push(had === null ? `${rel} was missing` : `${rel} changed`);
}
for (const rel of existing)
  if (!outputs.has(rel)) {
    rmSync(join(outRoot, rel), { recursive: true, force: true });
    drift.push(`${rel} no longer belongs to any canvas`);
  }
if (existsSync(outRoot)) for (const d of readdirSync(outRoot, { withFileTypes: true })) if (d.isDirectory() && !readdirSync(join(outRoot, d.name)).length) rmSync(join(outRoot, d.name), { recursive: true });

if (drift.length) {
  for (const d of drift) console.log(`FAIL ${d}`);
  console.log(`gen-canvases: the committed manifests were stale — regenerated in place; commit them and re-run (${Date.now() - t0} ms)`);
  process.exit(1);
}

console.log(`gen-canvases: ${rows.length} canvases ok in ${Date.now() - t0} ms`);
