// Cross-checks flows.json against the canvas and the rendered boards
// (backlog item 22): every interactive element on a wired page carries a
// data-flow number, every number has exactly one edge, every edge lands on a
// real board or a declared terminal, and every screen on a wired page has an
// entry point. Gaps (`{"gap": "..."}` outcomes) are legal and reported, never
// failed — gaps are honest, lies aren't.
//
// Run from this directory: node check-flows.mjs   (exit 1 on any FAIL)

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const t0 = Date.now();
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dir = join(root, "designs/canonical");

const canvas = JSON.parse(readFileSync(join(dir, "canvas.json"), "utf8"));
const flows = JSON.parse(readFileSync(join(dir, "flows.json"), "utf8"));

const fails = [];
const infos = [];
const gaps = [];

const stem = (file) => file.replace(/\.dc\.html$/, "");
const boards = new Map(); // stem -> { page, kind }
for (const a of canvas.artboards) {
  boards.set(stem(a.file), {
    page: a.page ?? canvas.pages?.[0]?.id ?? null,
    kind: flows.kinds?.[stem(a.file)] ?? "screen",
  });
}
const pageIds = new Set((canvas.pages ?? []).map((p) => p.id));
const wired = new Set(flows.wired ?? []);
for (const p of wired) if (!pageIds.has(p)) fails.push(`flows.json wires page "${p}", which canvas.json does not list`);
for (const b of Object.keys(flows.kinds ?? {})) if (!boards.has(b)) fails.push(`flows.json kinds names "${b}", which is not a board`);
for (const b of Object.keys(flows.entries ?? {})) if (!boards.has(b)) fails.push(`flows.json entries names "${b}", which is not a board`);

// canvas <-> files drift.
for (const a of canvas.artboards) if (!existsSync(join(dir, a.file))) fails.push(`canvas.json lists ${a.file}, which does not exist`);
for (const f of readdirSync(dir)) {
  if (f.endsWith(".dc.html") && !canvas.artboards.some((a) => a.file === f)) fails.push(`${f} is not on the canvas`);
}

// Edges: structure.
const edgeByVia = new Map(); // "Board/3" -> edge
for (const e of flows.edges ?? []) {
  const key = `${e.from}/${e.via}`;
  if (!boards.has(e.from)) { fails.push(`edge ${key} starts on unknown board "${e.from}"`); continue; }
  if (!Number.isInteger(e.via) || e.via < 1) fails.push(`edge ${key} has a non-positive via — data-flow numbers are 1..n per board`);
  if (edgeByVia.has(key)) fails.push(`two edges share ${key} — one element, one edge (list outcomes in "to")`);
  edgeByVia.set(key, e);
  if (!Array.isArray(e.to) || e.to.length === 0) { fails.push(`edge ${key} has no outcomes`); continue; }
  for (const o of e.to) {
    const ways = ["board", "terminal", "gap"].filter((k) => o[k] !== undefined);
    if (ways.length !== 1) { fails.push(`edge ${key}: each outcome is exactly one of board/terminal/gap`); continue; }
    if (o.board !== undefined && !boards.has(o.board)) fails.push(`edge ${key} points at unknown board "${o.board}"`);
    if (o.terminal !== undefined && !(flows.terminals ?? {})[o.terminal]) fails.push(`edge ${key} points at undeclared terminal "${o.terminal}"`);
    if (o.gap !== undefined) gaps.push(`${key}${o.case ? ` (${o.case})` : ""}: ${o.gap}`);
  }
}

// Rendered boards: data-flow numbers and untagged semantic elements.
const inbound = new Set(); // boards some edge lands on
for (const e of flows.edges ?? []) for (const o of e.to ?? []) if (o.board) inbound.add(o.board);

for (const [name, info] of boards) {
  const file = join(dir, `${name}.dc.html`);
  if (!existsSync(file)) continue;
  const html = readFileSync(file, "utf8");
  const onWired = wired.has(info.page);

  // A number may repeat (per-post controls recur on every post instance);
  // each DISTINCT number needs its edge.
  const seen = new Set();
  for (const [, n] of html.matchAll(/data-flow="(\d+)"/g)) {
    if (seen.has(n)) continue;
    seen.add(n);
    if (!edgeByVia.has(`${name}/${n}`)) {
      (onWired ? fails : infos).push(`${name}: data-flow ${n} has no edge in flows.json`);
    }
  }
  for (const key of edgeByVia.keys()) {
    const [b, n] = key.split("/");
    if (b === name && !seen.has(n)) fails.push(`${name}: edge ${key} exists but no element carries data-flow="${n}"`);
  }

  if (onWired && info.kind === "screen") {
    if (!(flows.scanExempt ?? {})[name]) {
      for (const [tag] of html.matchAll(/<(?:button|input|textarea|select|a href=)[^>]*>/g)) {
        if (!tag.includes("data-flow=")) fails.push(`${name}: untagged interactive element ${tag.slice(0, 80)}`);
      }
    }
    if (!(flows.entries ?? {})[name] && !inbound.has(name)) {
      fails.push(`${name}: no entry point — no edge lands here and it is not a declared entry`);
    }
  } else if (seen.size === 0 && info.kind === "screen") {
    infos.push(`${name}: not yet wired (page "${info.page}")`);
  }
}

const wiredNames = [...wired].join(", ") || "none";
console.log(`flows: ${(flows.edges ?? []).length} edges · wired pages: ${wiredNames} · ${gaps.length} gaps · ${infos.length} boards pending`);
if (gaps.length) { console.log("gaps (designs still owed):"); for (const g of gaps) console.log(`  ${g}`); }
for (const f of fails) console.log(`FAIL ${f}`);
console.log(`check-flows: ${fails.length ? `${fails.length} failures` : "ok"} in ${Date.now() - t0} ms`);
if (fails.length) process.exit(1);
