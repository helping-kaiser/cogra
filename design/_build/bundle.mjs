// Regenerates ../_ds_bundle.js from the component sources, replacing the copy
// the claude.ai Design app generated. Format 4, faithfully: one guarded IIFE
// per source file assigning its exports into a shared `__ds_scope`, exposed
// names (leading capital) mirrored onto `window.CoGraDesignSystem_9084ba`,
// and a header manifest with sha256-12 source hashes.
//
// Run from anywhere:  node design/_build/bundle.mjs
// Needs @babel/standalone (npm install in this directory).

import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve, relative, posix } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Babel = require("@babel/standalone");

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const NAMESPACE = "CoGraDesignSystem_9084ba";

const jsxFiles = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (name.endsWith(".jsx")) jsxFiles.push(path);
  }
};
walk(join(root, "components"));

const rel = (path) => relative(root, path).split("\\").join("/");

// Parse each file: imports (names + dep files), exports, stripped source.
const files = new Map();
const IMPORT_RE = /^import\s+([\s\S]*?)\s+from\s+"([^"]+)";?\s*$/gm;
const EXPORT_RE = /^export\s+(?:function|const|class)\s+(\w+)/gm;

for (const path of jsxFiles) {
  const source = readFileSync(path, "utf8");
  const imported = [];
  const deps = [];
  const stripped = source.replace(IMPORT_RE, (whole, clause, from) => {
    if (!from.startsWith(".")) return "";
    const target = rel(resolve(dirname(path), from));
    deps.push(target);
    const named = clause.match(/\{([\s\S]*)\}/);
    if (named) {
      for (const piece of named[1].split(",")) {
        const name = piece.trim();
        if (name) imported.push(name);
      }
    }
    return "";
  });
  const exported = [];
  for (const match of stripped.matchAll(EXPORT_RE)) exported.push(match[1]);
  files.set(rel(path), {
    source,
    stripped: stripped.replace(/^export\s+(function|const|class)/gm, "$1"),
    imported,
    deps,
    exported,
  });
}

// Topological order, so `const { X } = __ds_scope;` finds X already defined.
const order = [];
const state = new Map();
const visit = (key, chain) => {
  if (state.get(key) === "done") return;
  if (state.get(key) === "visiting") {
    throw new Error("import cycle: " + [...chain, key].join(" -> "));
  }
  state.set(key, "visiting");
  const entry = files.get(key);
  if (!entry) throw new Error("unresolved import target: " + key);
  for (const dep of entry.deps) visit(dep, [...chain, key]);
  state.set(key, "done");
  order.push(key);
};
for (const key of [...files.keys()].sort()) visit(key, []);

const blocks = [];
for (const key of order) {
  const entry = files.get(key);
  const compiled = Babel.transform(entry.stripped, { presets: ["react"] }).code;
  const bindings = entry.imported.length
    ? `const { ${entry.imported.join(", ")} } = __ds_scope;\n`
    : "";
  const assigns = entry.exported.map((name) => `__ds_scope.${name} = ${name};`).join("\n");
  blocks.push(
    `// ${key}\ntry { (() => {\n${bindings}${compiled}\n${assigns}\n})(); } catch (e) { __ds_ns.__errors.push({ path: ${JSON.stringify(key)}, error: String((e && e.message) || e) }); }`
  );
}

const exposed = [];
const unexposed = [];
for (const key of [...files.keys()].sort()) {
  for (const name of files.get(key).exported) {
    (/^[A-Z]/.test(name) ? exposed : unexposed).push({ name, sourcePath: key });
  }
}
unexposed.sort((a, b) => a.name.localeCompare(b.name));

const sourceHashes = {};
const hashTargets = [...files.keys()].sort();
for (const extra of ["designs/core-loop/app.jsx", "designs/core-loop/data.jsx"]) {
  try {
    readFileSync(join(root, extra));
    hashTargets.push(extra);
  } catch {}
}
for (const key of hashTargets) {
  const bytes = readFileSync(join(root, key));
  sourceHashes[key] = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
}

const manifest = {
  format: 4,
  namespace: NAMESPACE,
  components: exposed,
  sourceHashes,
  inlinedExternals: [],
  unexposedExports: unexposed,
};

const expose = exposed.map(({ name }) => `__ds_ns.${name} = __ds_scope.${name};`).join("\n\n");

const bundle = `/* @ds-bundle: ${JSON.stringify(manifest)} */

(() => {

const __ds_ns = (window.${NAMESPACE} = window.${NAMESPACE} || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

${blocks.join("\n\n")}

${expose}

})();
`;

writeFileSync(join(root, "_ds_bundle.js"), bundle);
console.log(
  `wrote _ds_bundle.js: ${order.length} files, ${exposed.length} exposed, ${unexposed.length} helpers, ${bundle.length} bytes`
);
void posix;
