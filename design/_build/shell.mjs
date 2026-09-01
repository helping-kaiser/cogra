// The artboard chrome every generated board shares: token CSS, theming logic,
// and the flow badges. Extracted from render-screens.mjs so the flow-map
// generator (gen-maps.mjs) builds boards from the same shell instead of
// carrying a diverging copy.
//
// Token CSS is inlined from styles.css's imports; fonts.css is skipped (its
// @font-face points at a repo-local TTF the artifact cannot serve — the shell
// carries the Google Fonts link instead and defines the font tokens itself).

import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

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

// Flow badges (backlog item 22): any element carrying data-flow="n" shows a
// small orange number — the same number graph.json's edges reference as `via`
// and the generated maps print on their arrows. Replaced elements (<input>)
// cannot host ::after; a field's badge goes on its wrapper instead.
export const flowBadgeCss = `[data-flow] { position: relative; }
[data-flow]::after { content: attr(data-flow); position: absolute; top: -7px; right: -7px; min-width: 15px; height: 15px; padding: 0 3px; border-radius: 999px; background: #e8590c; color: #fff; font-family: var(--font-sans); font-size: 10px; font-weight: 700; line-height: 15px; text-align: center; z-index: 40; pointer-events: none; box-sizing: border-box; }`;

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

// frame: { width, height, style } — the phone screen by default; the map
// boards pass their own computed size and a scrolling-free flex column.
export const shell = (markup, extraProps, extraVals, frame = {}) => {
  const width = frame.width ?? 390;
  const height = frame.height ?? 844;
  const style = frame.style ?? "display: flex; flex-direction: column; overflow: hidden;";
  return `<!doctype html>
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
${flowBadgeCss}
  </style>
</helmet>
<div class="screen" data-theme="{{theme}}" style="width: ${width}px; height: ${height}px; background: var(--surface); color: var(--on-surface); font-family: var(--font-sans); box-sizing: border-box; position: relative; ${style}">
${markup}
</div>
</x-dc>
${logicFor(extraProps, extraVals)}
</body>
</html>
`;
};
