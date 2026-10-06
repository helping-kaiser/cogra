// Renders every tree's screens (`trees.mjs`: canonical and postmvp) from the
// design system's ACTUAL components (backlog item 17): each
// `designs/<tree>/screens/<Name>.jsx` is compiled, rendered with
// ReactDOMServer against the live `_ds_bundle.js`, and written out as
// `designs/<tree>/<Name>.dc.html`. Update a component, re-run
// `node bundle.mjs && node render-screens.mjs`, and every screen that uses it
// updates with it. Screens may drop to raw markup (the `Raw` helper) where no
// component exists yet — that markup lives in exactly one place, the screen.
//
// Run from this directory: node render-screens.mjs

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const t0 = Date.now();

const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const Babel = require("@babel/standalone");

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

// ---- browser shims: enough for module evaluation and a static render.
globalThis.window = globalThis;
globalThis.React = React;
if (!globalThis.matchMedia)
  globalThis.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
if (!globalThis.localStorage)
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
if (!globalThis.IntersectionObserver)
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
if (!globalThis.ResizeObserver)
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

// ---- the design system, from the same bundle the cards load.
(0, eval)(readFileSync(join(root, "_ds_bundle.js"), "utf8"));
const ns = globalThis.CoGraDesignSystem_9084ba;
if (!ns) throw new Error("bundle namespace missing");
if (ns.__errors.length) {
  console.error(ns.__errors);
  throw new Error(`bundle evaluated with ${ns.__errors.length} errors`);
}

// Raw markup escape hatch for screen-local, not-yet-componentized regions.
function Raw({ html, tag = "div", style }) {
  return React.createElement(tag, { style, dangerouslySetInnerHTML: { __html: html } });
}

// ---- the shell: the artboard chrome every generated screen shares.
// Lives in shell.mjs (shared with gen-maps.mjs); the phone frame is its
// default. A screen may export PROPS (extra data-props descriptors) and VALS
// (extra `renderVals` entries, one code string like `keyTitle: this.props
// .wording === "app" ? "…" : "…"`); its markup then carries `{{name}}` holes
// the canvas substitutes live — how a generated board keeps a tweak chip
// beyond the theme. It may also export FRAME ({ width, height }) where the
// state it draws is not a portrait phone — the rotated viewer, and nothing
// else so far; the canvas entry carries the same size.
import { shell } from "./shell.mjs";
import { applyFlowMarkers } from "./flow-markers.mjs";

// ---- the data-node join (node-paths.mjs; design ⇄ impl seam 002). A screen
// that exports NODE is registered: its local segments join into full paths and
// its board's nodes land in the tree's `nodes.json`, the committed registry the
// implementation side pins and `check-behavior.mjs` reads. Every other board
// renders with the annotations stripped. Registered paths are APPEND-ONLY: a
// path the committed registry holds that no longer renders fails this stage
// and the registry is left as it was — a rename is a breaking change for the
// implementation side, made by deleting the old path from `nodes.json` by hand
// in a reviewed PR, never by a re-render. A screen's PROPS go to the join too:
// a copy its chip draws once per value is keyed by that value (node-paths.mjs).
import { joinNodePaths, stripNodes, boardEntry, isSegment } from "./node-paths.mjs";
const registryFails = [];

// ---- compile and render every screen.
// An argument renders one directory's screens/ (ideation canvases build from
// the masters too — freezing happens by committing the outputs, never by
// copying markup): `node render-screens.mjs designs/search`. With no argument
// every generated tree renders, `trees.mjs` being the one place they are named.
import { TREES } from "./trees.mjs";

function renderTree(canvasDir) {
  const screensDir = join(root, canvasDir, "screens");
  const outDir = join(root, canvasDir);
  // `_shared.jsx` is prepended to every screen: screen-level helpers (the logo
  // band, sample people) that are not design-system components live once there.
  let prelude = "";
  try {
    prelude = readFileSync(join(screensDir, "_shared.jsx"), "utf8") + "\n";
  } catch {}
  let count = 0;
  const screens = {};
  for (const file of readdirSync(screensDir).sort()) {
    if (!file.endsWith(".jsx") || file.startsWith("_")) continue;
    const name = basename(file, ".jsx");
    const source = (prelude + readFileSync(join(screensDir, file), "utf8")).replace(/^export\s+/gm, "");
    const compiled = Babel.transform(source, { presets: ["react"] }).code;
    const factory = new Function(
      "React",
      "components",
      "Raw",
      `${compiled}\nif (typeof Screen !== "function") throw new Error("no Screen export");\nreturn { Screen, PROPS: typeof PROPS === "undefined" ? null : PROPS, VALS: typeof VALS === "undefined" ? null : VALS, FRAME: typeof FRAME === "undefined" ? null : FRAME, NODE: typeof NODE === "undefined" ? null : NODE };`
    );
    const { Screen, PROPS, VALS, FRAME, NODE } = factory(React, ns, Raw);
    let rendered = renderToStaticMarkup(React.createElement(Screen));
    if (NODE !== null) {
      if (typeof NODE !== "string" || !isSegment(NODE)) throw new Error(`${canvasDir}/${name}: NODE must be one camelCase segment`);
      const joined = joinNodePaths(rendered, NODE, `${canvasDir}/${name}`, PROPS);
      rendered = joined.markup;
      screens[name] = boardEntry(NODE, joined.nodes);
    } else {
      rendered = stripNodes(rendered);
    }
    const markup = applyFlowMarkers(name, rendered);
    writeFileSync(join(outDir, `${name}.dc.html`), shell(markup, PROPS, VALS, FRAME ?? undefined));
    count += 1;
    console.log(`rendered ${canvasDir}/${name}.dc.html`);
  }
  writeRegistry(canvasDir, screens);
  return count;
}

// The tree's registry, `<tree>/nodes.json`: written whenever the tree has a
// registered screen, held to the committed copy's paths (append-only, above).
function writeRegistry(canvasDir, screens) {
  const path = join(root, canvasDir, "nodes.json");
  let committed = null;
  try {
    committed = JSON.parse(readFileSync(path, "utf8"));
  } catch {}
  const lost = [];
  for (const [board, entry] of Object.entries(committed?.screens ?? {})) {
    const now = screens[board];
    for (const p of Object.keys(entry.nodes ?? {})) {
      if (!now || !(p in now.nodes)) lost.push(`${p} (${board})`);
    }
    for (const [p, rule] of Object.entries(entry.keys ?? {})) {
      if (now && p in now.nodes && now.keys[p] !== rule) lost.push(`${p}'s key rule (${board}) — was "${rule}", now "${now.keys[p] ?? "unkeyed"}"`);
    }
  }
  if (lost.length) {
    for (const l of lost) registryFails.push(`${canvasDir}/nodes.json: ${l} is registered and no longer renders as registered`);
    return;
  }
  const boards = Object.keys(screens).sort();
  if (!boards.length && committed === null) return;
  const registry = {
    note: "Generated by design/_build/render-screens.mjs from the registered screens (those exporting NODE) — never edited by hand, except to delete a path in a deliberate breaking change. Paths are an append-only contract (design ⇄ impl seam 002): a node is identified by (data-node, data-node-key) on the built board, never by DOM order; a node inside a keyed instance carries that instance's key, nested keys joined outermost first with /.",
    screens: Object.fromEntries(boards.map((b) => [b, screens[b]])),
  };
  writeFileSync(path, JSON.stringify(registry, null, 2) + "\n");
  const total = boards.reduce((s, b) => s + Object.keys(screens[b].nodes).length, 0);
  console.log(`${canvasDir}/nodes.json: ${boards.length} registered screen${boards.length === 1 ? "" : "s"}, ${total} paths`);
}

let total = 0;
for (const canvasDir of process.argv[2] ? [process.argv[2]] : TREES) {
  const count = renderTree(canvasDir);
  total += count;
  console.log(`${canvasDir}: ${count} screens`);
}
for (const f of registryFails) console.log(`FAIL ${f}`);
if (registryFails.length) {
  console.log(
    `render-screens: registered data-node paths are append-only (design ⇄ impl seam 002) — restore what stopped rendering; only a breaking change agreed with the implementation side deletes a path from nodes.json, by hand (${Date.now() - t0} ms)`,
  );
  process.exit(1);
}
console.log(`${total} screens rendered from the design system in ${Date.now() - t0} ms`);
