// Generates the flow-map boards (backlog item 22): one Map<Page>.dc.html per
// canvas page plus MapOverview.dc.html, drawn from graph.json + canvas.json —
// never by hand, so never lying. Each page's map mirrors that page's grid:
// one card per board listing every numbered edge and its outcomes (boards,
// terminals, GAPs), with arrows for the same-page board-to-board edges. The
// script also maintains the maps' own canvas.json entries (position + size).
//
// Run from this directory, after render-screens: node gen-maps.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { shell } from "./shell.mjs";

const t0 = Date.now();
const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(here, "..", "designs/canonical");
const canvas = JSON.parse(readFileSync(join(dir, "canvas.json"), "utf8"));
const graph = JSON.parse(readFileSync(join(dir, "graph.json"), "utf8"));

const stem = (f) => f.replace(/\.dc\.html$/, "");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pageName = (id) => canvas.pages.find((p) => p.id === id)?.name ?? id;
const boardPage = new Map();
const boardTitle = new Map();
for (const a of canvas.artboards) {
  if (/^Map[A-Z]/.test(stem(a.file))) continue;
  boardPage.set(stem(a.file), a.page);
  boardTitle.set(stem(a.file), a.title ?? stem(a.file));
}
const edgesFrom = new Map();
for (const e of graph.edges) {
  if (!edgesFrom.has(e.from)) edgesFrom.set(e.from, []);
  edgesFrom.get(e.from).push(e);
}
const inbound = new Map();
for (const e of graph.edges) for (const o of e.to) if (o.board) inbound.set(o.board, (inbound.get(o.board) ?? 0) + 1);

const CARD_W = 250;
const COL_PITCH = 290;
const CHARS = 46; // ~10px font across a 234px text column
const lineCount = (text) => Math.max(1, Math.ceil(text.length / CHARS));

const outcomeText = (o, pageId) => {
  const label =
    o.board !== undefined
      ? boardPage.get(o.board) === pageId
        ? boardTitle.get(o.board)
        : `${boardTitle.get(o.board) ?? o.board} ⤴ ${pageName(boardPage.get(o.board))}`
      : o.terminal !== undefined
        ? `◦ ${o.terminal}`
        : `GAP · ${o.gap}`;
  return o.case ? `${label} (${o.case})` : label;
};

const edgeLine = (e, pageId) => `${e.via} · ${e.label} → ${e.to.map((o) => outcomeText(o, pageId)).join("  |  ")}`;

function pageMap(pageId) {
  const boards = canvas.artboards.filter((a) => a.page === pageId && !/^Map[A-Z]/.test(stem(a.file)));
  const wired = (graph.wired ?? []).includes(pageId);
  const cards = boards.map((a) => {
    const name = stem(a.file);
    const edges = (edgesFrom.get(name) ?? []).sort((p, q) => p.via - q.via);
    const lines = edges.map((e) => edgeLine(e, pageId));
    const entry = (graph.entries ?? {})[name];
    const boardKind = (graph.boardKinds ?? {})[name] ?? "screen";
    const h =
      34 + (entry ? 26 : 0) + (boardKind === "reference" ? 22 : 0) + lines.reduce((s, l) => s + lineCount(l) * 13 + 4, 0) + (lines.length ? 10 : wired ? 0 : 18) + 12;
    return { name, title: boardTitle.get(name), col: Math.round(a.x / 480), row: Math.round(a.y / 1060), edges, lines, entry, boardKind, h };
  });

  const rows = Math.max(...cards.map((c) => c.row)) + 1;
  const cols = Math.max(...cards.map((c) => c.col)) + 1;
  const rowY = [70];
  for (let r = 0; r < rows; r++) {
    const tallest = Math.max(60, ...cards.filter((c) => c.row === r).map((c) => c.h));
    rowY.push(rowY[r] + tallest + 50);
  }
  for (const c of cards) {
    c.x = 20 + c.col * COL_PITCH;
    c.y = rowY[c.row];
  }
  const width = 40 + cols * COL_PITCH - (COL_PITCH - CARD_W);
  const height = rowY[rows] + 20;

  const pos = new Map(cards.map((c) => [c.name, c]));
  const arrows = [];
  for (const c of cards)
    for (const e of c.edges)
      for (const o of e.to) {
        const t = o.board && pos.get(o.board);
        if (!t || t === c) continue;
        const sx = c.x + CARD_W;
        const sy = c.y + 17;
        const tx = t.x;
        const ty = t.y + 17;
        arrows.push(`<path d="M ${sx} ${sy} C ${sx + 70} ${sy}, ${tx - 70} ${ty}, ${tx} ${ty}" fill="none" stroke="var(--primary)" stroke-width="1.5" opacity="0.45" marker-end="url(#arr)"/>`);
      }

  const cardHtml = cards
    .map((c) => {
      const badges = [
        c.entry ? `<div style="margin-top:4px;font-size:9px;line-height:12px;color:var(--on-tertiary-container);background:var(--tertiary-container,var(--surface-container-highest));border-radius:4px;padding:2px 6px;">ENTRY · ${esc(c.entry)}</div>` : "",
        c.boardKind === "reference" ? `<div style="margin-top:4px;font-size:9px;line-height:12px;color:var(--on-surface-variant);">reference board — vocabulary, not a destination</div>` : "",
      ].join("");
      const body = c.lines.length
        ? c.edges
            .map(
              (e) =>
                `<div style="margin-top:4px;font-size:10px;line-height:13px;color:var(--on-surface-variant);">${e.to.some((o) => o.gap !== undefined) ? `<span style="color:var(--error);font-weight:700;">${e.via}</span>` : `<span style="color:var(--primary);font-weight:700;">${e.via}</span>`} ${esc(e.label)} → ${e.to.map((o) => (o.gap !== undefined ? `<span style="color:var(--error);">${esc(outcomeText(o, pageId))}</span>` : esc(outcomeText(o, pageId)))).join('<span style="opacity:0.5;"> | </span>')}</div>`
            )
            .join("")
        : c.boardKind === "reference" || wired
          ? ""
          : `<div style="margin-top:6px;font-size:10px;line-height:13px;color:var(--on-surface-variant);font-style:italic;">not yet wired</div>`;
      const inb = inbound.get(c.name);
      return `<div style="position:absolute;left:${c.x}px;top:${c.y}px;width:${CARD_W}px;box-sizing:border-box;border:1px solid var(--outline-variant);border-radius:8px;background:var(--surface-container,var(--surface));padding:8px;">
<div style="display:flex;justify-content:space-between;gap:6px;font-size:11px;line-height:14px;font-weight:700;">${esc(c.title)}${inb ? `<span style="flex:none;font-weight:400;color:var(--on-surface-variant);">◂ ${inb}</span>` : ""}</div>
${badges}${body}</div>`;
    })
    .join("\n");

  const markup = `<div style="padding:16px 20px 0 20px;">
<div style="font-size:16px;font-weight:700;">${esc(pageName(pageId))} · flow map</div>
<div style="margin-top:2px;font-size:10px;color:var(--on-surface-variant);">Generated from graph.json — do not edit. Numbers are the boards' orange badges; GAP marks a design still owed; ◦ is a terminal (back / self / OS); ◂ n counts inbound edges.</div>
</div>
<div style="position:relative;flex:1;">
<svg style="position:absolute;inset:0;" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--primary)" opacity="0.6"/></marker></defs>
${arrows.join("\n")}
</svg>
${cardHtml}
</div>`;
  return { markup, width: Math.max(width, 560), height: height + 70 };
}

function overviewMap() {
  const cross = new Map();
  for (const e of graph.edges)
    for (const o of e.to) {
      if (!o.board) continue;
      const fromPage = boardPage.get(e.from);
      const toPage = boardPage.get(o.board);
      if (fromPage === toPage) continue;
      const key = `${fromPage}→${toPage}`;
      cross.set(key, (cross.get(key) ?? 0) + 1);
    }
  const gapCount = (pid) =>
    graph.edges.filter((e) => boardPage.get(e.from) === pid).flatMap((e) => e.to).filter((o) => o.gap !== undefined).length;

  const pages = canvas.pages.filter((p) => p.id !== "overview");
  const cards = pages.map((p, i) => {
    const boards = canvas.artboards.filter((a) => a.page === p.id && !/^Map[A-Z]/.test(stem(a.file)));
    const edges = graph.edges.filter((e) => boardPage.get(e.from) === p.id);
    const out = [...cross.entries()].filter(([k]) => k.startsWith(`${p.id}→`)).map(([k, n]) => `→ ${pageName(k.split("→")[1])} × ${n}`);
    const wired = (graph.wired ?? []).includes(p.id);
    return { p, i, boards: boards.length, edges: edges.length, gaps: gapCount(p.id), out, wired };
  });
  const cardHtml = cards
    .map((c) => {
      const x = 20 + (c.i % 4) * 320;
      const y = 80 + Math.floor(c.i / 4) * 210;
      return `<div style="position:absolute;left:${x}px;top:${y}px;width:290px;height:180px;box-sizing:border-box;border:1px solid var(--outline-variant);border-radius:10px;background:var(--surface-container,var(--surface));padding:12px;">
<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;">${esc(c.p.name)}<span style="font-weight:400;font-size:10px;color:${c.wired ? "var(--primary)" : "var(--on-surface-variant)"};">${c.wired ? "wired ✓" : "pending"}</span></div>
<div style="margin-top:6px;font-size:10px;line-height:14px;color:var(--on-surface-variant);">${c.boards} boards${c.wired ? ` · ${c.edges} edges · <span style="color:${c.gaps ? "var(--error)" : "inherit"};">${c.gaps} gaps</span>` : ""}</div>
${c.out.map((l) => `<div style="margin-top:3px;font-size:10px;line-height:13px;color:var(--on-surface-variant);">${esc(l)}</div>`).join("")}
</div>`;
    })
    .join("\n");
  const markup = `<div style="padding:16px 20px 0 20px;">
<div style="font-size:16px;font-weight:700;">CoGra · flow overview</div>
<div style="margin-top:2px;font-size:10px;color:var(--on-surface-variant);">Generated from graph.json — do not edit. Each page's own map sits left of its boards; wired pages enforce completeness in the build.</div>
</div>
<div style="position:relative;flex:1;">${cardHtml}</div>`;
  return { markup, width: 1320, height: 80 + Math.ceil(cards.length / 4) * 210 + 20 };
}

const upsert = (file, page, x, y, w, h, title) => {
  let a = canvas.artboards.find((b) => b.file === file);
  if (!a) {
    a = { file };
    canvas.artboards.push(a);
  }
  Object.assign(a, { x, y, w, h, page, title });
};

let count = 0;
for (const p of canvas.pages) {
  const name = `Map${p.id[0].toUpperCase()}${p.id.slice(1)}`;
  const { markup, width, height } = p.id === "overview" ? overviewMap() : pageMap(p.id);
  writeFileSync(join(dir, `${name}.dc.html`), shell(markup, null, null, { width, height }));
  if (p.id === "overview") upsert(`${name}.dc.html`, "overview", 0, 0, width, height, "CoGra · flow overview");
  else upsert(`${name}.dc.html`, p.id, -(width + 420), 0, width, height, `${p.name} · flow map`);
  count += 1;
  console.log(`generated ${name}.dc.html (${width}×${height})`);
}
writeFileSync(join(dir, "canvas.json"), JSON.stringify(canvas, null, 2) + "\n");
console.log(`${count} maps generated in ${Date.now() - t0} ms`);
