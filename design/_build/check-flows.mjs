// Cross-checks graph.json against the canvas and the rendered boards
// (backlog item 22): every interactive element on a wired page carries a
// data-flow number, every number has exactly one edge, every edge declares a
// known kind and lands on a real board or a declared terminal, and every
// screen on a wired page has an entry point. Gaps (`{"gap": "..."}` outcomes) are legal and reported, never
// failed — gaps are honest, lies aren't.
//
// Run from this directory: node check-flows.mjs   (exit 1 on any FAIL)

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveAll, bless, serialize, pickOutcome } from "./flow-engine.mjs";

const t0 = Date.now();
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dir = join(root, "designs/canonical");

const canvas = JSON.parse(readFileSync(join(dir, "canvas.json"), "utf8"));
const graph = JSON.parse(readFileSync(join(dir, "graph.json"), "utf8"));

const fails = [];
const infos = [];
const gaps = [];

// A replaced element (<input>, <textarea>) cannot host the flow badge's
// ::after (shell.mjs) — its badge sits on its wrapper instead, the way
// `LicenseAxis` stamps its row rather than its own hidden radio (jakob's
// ruling A9, backlog item 40). "Wrapper" is not always the immediate parent —
// `PasswordField` wraps its input in a plain row div (for the reveal button
// beside it) inside the field's own labeled div, so this walks the full
// ancestor chain rather than stopping one level up: track nesting depth over
// closed tags so an already-closed sibling is never mistaken for a true
// ancestor, and at each true ancestor found, either it carries data-flow (the
// field is tagged) or the walk continues past it to the next one out.
function hasAncestorDataFlow(html, pos) {
  let depth = 0;
  let i = pos;
  for (;;) {
    const lt = html.lastIndexOf("<", i - 1);
    if (lt === -1) return false;
    const gt = html.indexOf(">", lt);
    if (gt === -1) return false;
    const tag = html.slice(lt, gt + 1);
    if (tag.startsWith("</")) {
      depth += 1;
    } else if (!tag.endsWith("/>")) {
      if (depth === 0) {
        if (tag.includes("data-flow=")) return true;
      } else {
        depth -= 1;
      }
    }
    i = lt;
  }
}
const FIELD_TAGS = new Set(["input", "textarea"]);
const isFieldTag = (tag) => FIELD_TAGS.has(/^<(\w+)/.exec(tag)?.[1]);

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
      for (const m of html.matchAll(/<(?:button|input|textarea|select|a href=)[^>]*>/g)) {
        const tag = m[0];
        if (tag.includes("data-flow=")) continue;
        // A field's badge may sit on its wrapper instead of the field itself
        // — the only exception to "the element carries its own data-flow",
        // because a replaced element is the only element that cannot host one.
        if (isFieldTag(tag) && hasAncestorDataFlow(html, m.index)) continue;
        fails.push(`${name}: untagged interactive element ${tag.slice(0, 80)}`);
      }
    }
    if (!(graph.entries ?? {})[name] && !inbound.has(name)) {
      fails.push(`${name}: no entry point — no edge lands here and it is not a declared entry`);
    }
  } else if (seen.size === 0 && info.boardKind === "screen") {
    infos.push(`${name}: not yet wired (page "${info.page}")`);
  }
}

// The flow layer. Structure above says the graph tells no lies; this says the
// journeys the product owes still run through it.
const flowsFile = join(dir, "flows.json");
const witnessFile = join(dir, "flows.resolved.json");
const rebless = process.argv.includes("--rebless");
let flowLines = [];
if (existsSync(flowsFile)) {
  const declared = JSON.parse(readFileSync(flowsFile, "utf8")).flows ?? [];
  const { results, fails: flowFails, view } = resolveAll(graph, { flows: declared });
  fails.push(...flowFails);

  const blocked = results.filter((r) => r.status === "blocked by gap");

  // Journey-stopping gaps. The triage below asks which gaps sit on a board
  // some flow walks, which saturates as flows spread — a gap three taps off
  // the route counts the same as one the journey dies on. This asks the
  // sharper question: where does a declared journey actually stop? Three ways
  // it can: its end edge lands on a gap, its start edge opens one, or a
  // control-selector start names an origin with no board behind it.
  const stops = new Map(); // board/via + role + text -> { board, via, text, role, flows }
  const stopsAt = (board, via, text, role, flow) => {
    const key = `${board}/${via} ${role} ${text}`;
    const row = stops.get(key) ?? { board, via: Number(via), text, role, flows: new Set() };
    row.flows.add(flow);
    stops.set(key, row);
  };
  const byName = new Map(declared.map((f) => [f.name, f]));
  for (const r of results) {
    const end = byName.get(r.name)?.end;
    if (r.status === "blocked by gap" && end) stopsAt(end.board, end.via, r.blockedBy, "ends", r.name);
    for (const u of r.startsUndesignedAt ?? []) stopsAt(u.board, u.via, u.text, "starts", r.name);
  }
  // A start edge that opens a gap fails its flow outright, so that flow never
  // reaches `results` — read those off the declaration instead.
  for (const f of declared) {
    const s = f.start ?? {};
    if (s.board === undefined || s.via === undefined) continue;
    const edge = view.edgeByVia.get(`${s.board}/${s.via}`);
    if (!edge) continue;
    const { outcome } = pickOutcome(edge, s, ""); // an unpickable start already failed above
    if (outcome?.gap !== undefined) stopsAt(s.board, s.via, outcome.gap, "starts", f.name);
  }
  const stopRows = [...stops.values()].sort(
    (a, b) => a.board.localeCompare(b.board) || a.via - b.via || a.role.localeCompare(b.role) || a.text.localeCompare(b.text),
  );

  flowLines.push(
    `flows: ${declared.length} declared · ${results.length - blocked.length} resolved · ${blocked.length} blocked by a gap · ${stopRows.length} journey-stopping`,
  );
  for (const r of blocked) flowLines.push(`  blocked by gap — ${r.name}: ${r.blockedBy}`);

  const { witness, triage } = bless(results, view);
  const shared = Object.entries(witness.boardsOnFlows)
    .filter(([, row]) => row.flows.length > 1)
    .sort((a, b) => b[1].flows.length - a[1].flows.length || a[0].localeCompare(b[0]));
  if (shared.length) {
    flowLines.push(`shared boards (on more than one flow): ${shared.map(([b, row]) => `${b} ×${row.flows.length}`).join(" · ")}`);
  }
  flowLines.push(`gap triage: ${triage.onFlow.length} of ${gaps.length} gaps sit on a flow's boards · ${triage.offFlow.length} off every flow`);

  if (stopRows.length) {
    flowLines.push("journey-stopping gaps (where a declared journey halts, not merely passes near):");
    for (const row of stopRows) {
      flowLines.push(`  ${row.board}/${row.via} ${row.role} ${[...row.flows].sort().join(", ")}: ${row.text}`);
    }
  }

  // The witness is the blessing: it drifts only when someone means it to.
  const fresh = serialize(witness);
  if (rebless) {
    writeFileSync(witnessFile, fresh);
    flowLines.push(`re-blessed ${witnessFile.split(/[\\/]/).pop()} — review the diff; that review is the blessing`);
  } else if (!existsSync(witnessFile)) {
    fails.push(`flows.resolved.json is missing — resolve and bless it with: node check-flows.mjs --rebless`);
  } else if (readFileSync(witnessFile, "utf8") !== fresh) {
    const was = JSON.parse(readFileSync(witnessFile, "utf8"));
    const old = new Map((was.flows ?? []).map((f) => [f.name, f]));
    const now = new Map(witness.flows.map((f) => [f.name, f]));
    const moved = [];
    for (const [name, f] of now) {
      const b = old.get(name);
      if (!b) moved.push(`${name}: newly declared`);
      else if (JSON.stringify(b) !== JSON.stringify(f)) {
        let at = -1;
        for (let i = 0; i < Math.max(b.steps.length, f.steps.length); i += 1) if (b.steps[i] !== f.steps[i]) { at = i; break; }
        moved.push(
          at < 0
            ? `${name}: the chain holds; its status or its boards moved (${b.status} → ${f.status})`
            : `${name}: reroutes at step ${at + 1} of ${f.steps.length}\n      was: ${b.steps[at] ?? "(the flow ended here)"}\n      now: ${f.steps[at] ?? "(the flow ends here)"}`,
        );
      }
    }
    for (const name of old.keys()) if (!now.has(name)) moved.push(`${name}: no longer declared`);
    if (!moved.length) moved.push("the index or the triage moved under the flows");
    fails.push(`flows.resolved.json no longer matches the graph:\n${moved.map((m) => `  ${m}`).join("\n")}\n  Re-bless deliberately: node check-flows.mjs --rebless`);
  }
} else {
  flowLines.push("flows: none declared");
}

const wiredNames = [...wired].join(", ") || "none";
console.log(`graph: ${(graph.edges ?? []).length} edges · wired pages: ${wiredNames} · ${gaps.length} gaps · ${infos.length} boards pending`);
console.log(`kinds: ${KINDS.map((k) => `${k} ${census[k]}`).join(" · ")}`);
for (const l of flowLines) console.log(l);
if (gaps.length) { console.log("gaps (designs still owed):"); for (const g of gaps) console.log(`  ${g}`); }
for (const f of fails) console.log(`FAIL ${f}`);
console.log(`check-flows: ${fails.length ? `${fails.length} failures` : "ok"} in ${Date.now() - t0} ms`);
if (fails.length) process.exit(1);
