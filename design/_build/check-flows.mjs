// Cross-checks graph.json against the canvas and the rendered boards
// (backlog item 22): every interactive element on a wired page carries a
// data-flow number, every number has exactly one edge, every edge declares a
// known kind and lands on a real board or a declared terminal, and every
// screen on a wired page has an entry point. Gaps (`{"gap": "..."}` outcomes) are legal and reported, never
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
const graph = JSON.parse(readFileSync(join(dir, "graph.json"), "utf8"));

const fails = [];
const infos = [];
const gaps = [];

const stem = (file) => file.replace(/\.dc\.html$/, "");
const boards = new Map(); // stem -> { page, boardKind }
for (const a of canvas.artboards) {
  boards.set(stem(a.file), {
    page: a.page ?? canvas.pages?.[0]?.id ?? null,
    boardKind: graph.boardKinds?.[stem(a.file)] ?? "screen",
  });
}
const pageIds = new Set((canvas.pages ?? []).map((p) => p.id));
const wired = new Set(graph.wired ?? []);
for (const p of wired) if (!pageIds.has(p)) fails.push(`graph.json wires page "${p}", which canvas.json does not list`);
for (const b of Object.keys(graph.boardKinds ?? {})) if (!boards.has(b)) fails.push(`graph.json boardKinds names "${b}", which is not a board`);
for (const b of Object.keys(graph.entries ?? {})) if (!boards.has(b)) fails.push(`graph.json entries names "${b}", which is not a board`);

// canvas <-> files drift.
for (const a of canvas.artboards) if (!existsSync(join(dir, a.file))) fails.push(`canvas.json lists ${a.file}, which does not exist`);
for (const f of readdirSync(dir)) {
  if (f.endsWith(".dc.html") && !canvas.artboards.some((a) => a.file === f)) fails.push(`${f} is not on the canvas`);
}

// Edges: structure. Every edge declares what its control does — the flow
// engine path-searches over `advance` edges alone, so an undeclared or
// unknown kind is a build failure, never a default.
const KINDS = ["advance", "cancel", "back", "nav", "detour"];
const census = Object.fromEntries(KINDS.map((k) => [k, 0]));

const edgeByVia = new Map(); // "Board/3" -> edge
for (const e of graph.edges ?? []) {
  const key = `${e.from}/${e.via}`;
  if (e.kind === undefined) fails.push(`edge ${key} declares no "kind" — every edge carries one of ${KINDS.join(" / ")}`);
  else if (!KINDS.includes(e.kind)) fails.push(`edge ${key} declares kind "${e.kind}", which is not one of ${KINDS.join(" / ")}`);
  else census[e.kind] += 1;
  if (!boards.has(e.from)) { fails.push(`edge ${key} starts on unknown board "${e.from}"`); continue; }
  if (!Number.isInteger(e.via) || e.via < 1) fails.push(`edge ${key} has a non-positive via — data-flow numbers are 1..n per board`);
  if (edgeByVia.has(key)) fails.push(`two edges share ${key} — one element, one edge (list outcomes in "to")`);
  edgeByVia.set(key, e);
  if (!Array.isArray(e.to) || e.to.length === 0) { fails.push(`edge ${key} has no outcomes`); continue; }
  for (const o of e.to) {
    const ways = ["board", "terminal", "gap"].filter((k) => o[k] !== undefined);
    if (ways.length !== 1) { fails.push(`edge ${key}: each outcome is exactly one of board/terminal/gap`); continue; }
    if (o.board !== undefined && !boards.has(o.board)) fails.push(`edge ${key} points at unknown board "${o.board}"`);
    if (o.terminal !== undefined && !(graph.terminals ?? {})[o.terminal]) fails.push(`edge ${key} points at undeclared terminal "${o.terminal}"`);
    if (o.gap !== undefined) gaps.push(`${key}${o.case ? ` (${o.case})` : ""}: ${o.gap}`);
    if (o.info !== undefined && (o.info !== true || o.terminal === undefined)) {
      fails.push(`edge ${key}: "info": true marks a terminal outcome that only tells you something — it belongs on no other shape`);
    }
  }

  // Advance to nothing is a lie. A control whose every outcome merely informs
  // — the applicant's locked rows answering with a snackbar, a chip that lands
  // where you already are — leaves the journey exactly where it was, so the
  // path search must never walk it.
  const reaches = (o) => o.board !== undefined || o.gap !== undefined || (o.terminal !== undefined && o.info !== true);
  if (e.kind === "advance" && e.to.every((o) => !reaches(o))) {
    fails.push(`edge ${key} is "advance" but every outcome only informs — an advance reaches a board, a gap, or a terminal that does something; this one is a "detour"`);
  }
}

// Rendered boards: data-flow numbers and untagged semantic elements.
const inbound = new Set(); // boards some edge lands on
for (const e of graph.edges ?? []) for (const o of e.to ?? []) if (o.board) inbound.add(o.board);

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
      (onWired ? fails : infos).push(`${name}: data-flow ${n} has no edge in graph.json`);
    }
  }
  for (const key of edgeByVia.keys()) {
    const [b, n] = key.split("/");
    if (b === name && !seen.has(n)) fails.push(`${name}: edge ${key} exists but no element carries data-flow="${n}"`);
  }

  if (onWired && info.boardKind === "screen") {
    if (!(graph.scanExempt ?? {})[name]) {
      for (const [tag] of html.matchAll(/<(?:button|input|textarea|select|a href=)[^>]*>/g)) {
        if (!tag.includes("data-flow=")) fails.push(`${name}: untagged interactive element ${tag.slice(0, 80)}`);
      }
    }
    if (!(graph.entries ?? {})[name] && !inbound.has(name)) {
      fails.push(`${name}: no entry point — no edge lands here and it is not a declared entry`);
    }
  } else if (seen.size === 0 && info.boardKind === "screen") {
    infos.push(`${name}: not yet wired (page "${info.page}")`);
  }
}

const wiredNames = [...wired].join(", ") || "none";
console.log(`graph: ${(graph.edges ?? []).length} edges · wired pages: ${wiredNames} · ${gaps.length} gaps · ${infos.length} boards pending`);
console.log(`kinds: ${KINDS.map((k) => `${k} ${census[k]}`).join(" · ")}`);
if (gaps.length) { console.log("gaps (designs still owed):"); for (const g of gaps) console.log(`  ${g}`); }
for (const f of fails) console.log(`FAIL ${f}`);
console.log(`check-flows: ${fails.length ? `${fails.length} failures` : "ok"} in ${Date.now() - t0} ms`);
if (fails.length) process.exit(1);
