// Renders the canonical screens from the design system's ACTUAL components
// (backlog item 17): each `designs/canonical/screens/<Name>.jsx` is compiled,
// rendered with ReactDOMServer against the live `_ds_bundle.js`, and written
// out as `designs/canonical/<Name>.dc.html`. Update a component, re-run
// `node bundle.mjs && node render-screens.mjs`, and every screen that uses it
// updates with it. Screens may drop to raw markup (the `Raw` helper) where no
// component exists yet — that markup lives in exactly one place, the screen.
//
// Run from this directory: node render-screens.mjs

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

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

// ---- compile and render every screen.
// An argument renders another canvas's screens/ (ideation canvases build from
// the masters too — freezing happens by committing the outputs, never by
// copying markup): `node render-screens.mjs designs/search`.
const canvasDir = process.argv[2] ?? "designs/canonical";
const screensDir = join(root, canvasDir, "screens");
const outDir = join(root, canvasDir);
// `_shared.jsx` is prepended to every screen: screen-level helpers (the logo
// band, sample people) that are not design-system components live once there.
let prelude = "";
try {
  prelude = readFileSync(join(screensDir, "_shared.jsx"), "utf8") + "\n";
} catch {}
let count = 0;
for (const file of readdirSync(screensDir).sort()) {
  if (!file.endsWith(".jsx") || file.startsWith("_")) continue;
  const name = basename(file, ".jsx");
  const source = (prelude + readFileSync(join(screensDir, file), "utf8")).replace(/^export\s+/gm, "");
  const compiled = Babel.transform(source, { presets: ["react"] }).code;
  const factory = new Function(
    "React",
    "components",
    "Raw",
    `${compiled}\nif (typeof Screen !== "function") throw new Error("no Screen export");\nreturn { Screen, PROPS: typeof PROPS === "undefined" ? null : PROPS, VALS: typeof VALS === "undefined" ? null : VALS, FRAME: typeof FRAME === "undefined" ? null : FRAME };`
  );
  const { Screen, PROPS, VALS, FRAME } = factory(React, ns, Raw);
  const markup = applyFlowMarkers(name, renderToStaticMarkup(React.createElement(Screen)));
  writeFileSync(join(outDir, `${name}.dc.html`), shell(markup, PROPS, VALS, FRAME ?? undefined));
  count += 1;
  console.log(`rendered ${name}.dc.html`);
}
console.log(`${count} screens rendered from the design system`);
