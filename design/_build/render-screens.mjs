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
// Token CSS is inlined from styles.css's imports; fonts.css is skipped (its
// @font-face points at a repo-local TTF the artifact cannot serve — the shell
// carries the Google Fonts link instead and defines the font tokens itself).
const tokenFiles = [...readFileSync(join(root, "styles.css"), "utf8").matchAll(/@import "\.\/(tokens\/[^"]+)";/g)]
  .map(([, file]) => file)
  .filter((file) => file !== "tokens/fonts.css");
const tokenCss = tokenFiles.map((file) => readFileSync(join(root, file), "utf8")).join("\n");
// Semantic aliases (`--surface-card: var(--surface-container-highest)`) resolve
// at :root and inherit RESOLVED, so a mid-tree `data-theme="dark"` alone cannot
// re-theme them. Re-scoping the whole token sheet under the dark selector makes
// every alias recompute where the dark base tokens apply; the sheet's own dark
// blocks repeat after their light values, so the cascade stays correct.
const darkCss = tokenCss.replace(/:root/g, '[data-theme="dark"]');
const fontTokens = `:root { --font-figtree: "Figtree"; --font-sans: var(--font-figtree), "Segoe UI", system-ui, sans-serif; --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }`;

// A screen may export PROPS (extra data-props descriptors) and VALS (extra
// `renderVals` entries, one code string like `keyTitle: this.props.wording ===
// "app" ? "…" : "…"`); its markup then carries `{{name}}` holes the canvas
// substitutes live — how a generated board keeps a tweak chip beyond the theme.
const THEME_PROP = { theme: { editor: "enum", options: ["auto", "light", "dark"], default: "auto" } };
const logicFor = (extraProps, extraVals) => `<script data-dc-script data-props='${JSON.stringify({ ...THEME_PROP, ...(extraProps ?? {}) })}'>
class Component extends DCLogic {
  componentDidMount() {
    this.media = window.matchMedia("(prefers-color-scheme: dark)");
    this.onScheme = () => this.forceUpdate();
    this.media.addEventListener("change", this.onScheme);
    this.onMsg = (event) => {
      const d = event.data;
      if (d && (d.cograTheme === "light" || d.cograTheme === "dark" || d.cograTheme === "auto")) {
        if (!this.state || this.state.remote !== d.cograTheme) this.setState({ remote: d.cograTheme });
      } else if (d && d.cograThemeQuery && this.state && this.state.remote && event.source) {
        try { event.source.postMessage({ cograTheme: this.state.remote }, "*"); } catch (e) {}
      }
    };
    window.addEventListener("message", this.onMsg);
    try {
      const askWalk = (w, depth) => {
        if (depth > 5) return;
        let n = 0;
        try { n = w.length; } catch (e) { n = 0; }
        for (let i = 0; i < n; i++) {
          let c = null;
          try { c = w[i]; } catch (e) { c = null; }
          if (c) {
            try { c.postMessage({ cograThemeQuery: true }, "*"); } catch (e) {}
            askWalk(c, depth + 1);
          }
        }
      };
      askWalk(window.top, 0);
    } catch (e) {}
  }
  componentDidUpdate(prevProps) {
    if (prevProps.theme !== this.props.theme && this.state && this.state.remote) {
      this.setState({ remote: null });
    }
  }
  componentWillUnmount() {
    if (this.media) this.media.removeEventListener("change", this.onScheme);
    window.removeEventListener("message", this.onMsg);
  }
  renderVals() {
    const remote = this.state ? this.state.remote : null;
    const mode = remote ?? this.props.theme ?? "auto";
    const dark = mode === "auto"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : mode === "dark";
    return { theme: dark ? "dark" : "light"${extraVals ? `, ${extraVals}` : ""} };
  }
}
</${"script"}>`;

const shell = (markup, extraProps, extraVals) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></${"script"}>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@300..900&amp;display=swap">
  <style>
    body { margin: 0; }
${fontTokens}
${tokenCss}
${darkCss}
  </style>
</helmet>
<div class="screen" data-theme="{{theme}}" style="width: 390px; height: 844px; display: flex; flex-direction: column; background: var(--surface); color: var(--on-surface); font-family: var(--font-sans); overflow: hidden; box-sizing: border-box; position: relative;">
${markup}
</div>
</x-dc>
${logicFor(extraProps, extraVals)}
</body>
</html>
`;

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
    `${compiled}\nif (typeof Screen !== "function") throw new Error("no Screen export");\nreturn { Screen, PROPS: typeof PROPS === "undefined" ? null : PROPS, VALS: typeof VALS === "undefined" ? null : VALS };`
  );
  const { Screen, PROPS, VALS } = factory(React, ns, Raw);
  const markup = renderToStaticMarkup(React.createElement(Screen));
  writeFileSync(join(outDir, `${name}.dc.html`), shell(markup, PROPS, VALS));
  count += 1;
  console.log(`rendered ${name}.dc.html`);
}
console.log(`${count} screens rendered from the design system`);
