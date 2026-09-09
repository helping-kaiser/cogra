// @vitest-environment node
// Pins the type system to design.md §3: one variable family for the whole UI,
// loaded by next/font so nothing is fetched from Google in the browser, and
// Material 3's fifteen roles carrying every size, line height, tracking, and
// weight.
//
// The subset assertion is the one worth automating — a latin-only subset still
// renders every screen we have, and only breaks later, silently, on a Turkish
// name. Nothing else would catch it.
//
// The scale is pinned to `@material/web`'s generated token file rather than to
// numbers written here, the same arrangement design-tokens.test.ts has with
// material-color-utilities: the official package is the source, this is the
// enforcement. It is a devDependency and nothing imports it at runtime.

import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const CSS = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf-8");
const LAYOUT = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf-8");

const TOKENS_DIR = new URL("../../../node_modules/@material/web/tokens/versions/latest/sass/", import.meta.url);
const TYPESCALE = readFileSync(new URL("_md-sys-typescale.scss", TOKENS_DIR), "utf-8");
const TYPEFACE = readFileSync(new URL("_md-ref-typeface.scss", TOKENS_DIR), "utf-8");

type Role = { size: string; lineHeight: string; tracking: string; weight: string };

/** `$weight-regular: 400;` — what the typescale's weight tokens point at. */
function typefaceWeights(): Map<string, string> {
  const weights = new Map<string, string>();
  for (const [, name, value] of TYPEFACE.matchAll(/^\$(weight-[a-z]+):\s*([0-9]+);/gm)) {
    weights.set(name, value);
  }
  return weights;
}

/** The fifteen roles, each with the four properties a Tailwind font-size utility carries. */
function materialRoles(): Map<string, Role> {
  const weights = typefaceWeights();
  const roles = new Map<string, Partial<Role>>();
  const property = { size: "size", "line-height": "lineHeight", tracking: "tracking" } as const;

  for (const [, role, name, value] of TYPESCALE.matchAll(
    /^\$([a-z]+-(?:large|medium|small))-(size|line-height|tracking):\s*([^;]+);/gm,
  )) {
    const existing = roles.get(role) ?? {};
    roles.set(role, { ...existing, [property[name as keyof typeof property]]: value.trim() });
  }

  for (const [, role, ref] of TYPESCALE.matchAll(
    /^\$([a-z]+-(?:large|medium|small))-weight:\s*md-ref-typeface\.\$([a-z-]+);/gm,
  )) {
    const weight = weights.get(ref);
    if (weight === undefined) throw new Error(`unknown typeface weight ${ref}`);
    roles.set(role, { ...(roles.get(role) ?? {}), weight });
  }

  for (const [role, values] of roles) {
    if (
      values.size === undefined ||
      values.lineHeight === undefined ||
      values.tracking === undefined ||
      values.weight === undefined
    ) {
      throw new Error(`incomplete Material token set for ${role}`);
    }
  }
  return roles as Map<string, Role>;
}

/** The plain `@theme` block — the type roles; the colours live in `@theme inline`. */
function themeBlock(): string {
  const block = CSS.match(/@theme\s*\{([^}]*)\}/);
  if (block === null) throw new Error("no @theme block");
  return block[1];
}

/** Every .ts/.tsx under src that is not a test — where a stray utility would hide. */
function sourceFiles(): string[] {
  const root = new URL("../../", import.meta.url).pathname;
  return readdirSync(root, { recursive: true, encoding: "utf-8" })
    .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."))
    .map((name) => `${root}${name}`);
}

describe("type", () => {
  it("loads Figtree, and only Figtree, through next/font", () => {
    const imports = LAYOUT.match(/import\s*\{([^}]*)\}\s*from\s*"next\/font\/google"/);
    expect(imports, "no next/font/google import").not.toBeNull();
    expect(imports![1].split(",").map((name) => name.trim())).toEqual(["Figtree"]);
    expect(LAYOUT).toContain('variable: "--font-figtree"');
  });

  it("subsets latin and latin-ext", () => {
    expect(LAYOUT).toContain('subsets: ["latin", "latin-ext"]');
  });

  it("drives font-sans from the loaded family", () => {
    expect(CSS).toContain("--font-sans: var(--font-figtree);");
  });

  it("takes font-mono from the platform rather than a second webfont", () => {
    const mono = CSS.match(/--font-mono:\s*([^;]+);/);
    expect(mono, "no --font-mono declaration").not.toBeNull();
    expect(mono![1]).toContain("ui-monospace");
    expect(mono![1]).not.toContain("var(");
  });

  it("reads fifteen roles from Material's token file", () => {
    expect([...materialRoles().keys()].sort()).toEqual([
      "body-large",
      "body-medium",
      "body-small",
      "display-large",
      "display-medium",
      "display-small",
      "headline-large",
      "headline-medium",
      "headline-small",
      "label-large",
      "label-medium",
      "label-small",
      "title-large",
      "title-medium",
      "title-small",
    ]);
  });

  it("carries every role at Material's own size, leading, tracking, and weight", () => {
    const theme = themeBlock();
    for (const [role, values] of materialRoles()) {
      expect(theme, `--text-${role}`).toContain(`--text-${role}: ${values.size};`);
      expect(theme, `--text-${role}--line-height`).toContain(
        `--text-${role}--line-height: ${values.lineHeight};`,
      );
      expect(theme, `--text-${role}--letter-spacing`).toContain(
        `--text-${role}--letter-spacing: ${values.tracking};`,
      );
      expect(theme, `--text-${role}--font-weight`).toContain(
        `--text-${role}--font-weight: ${values.weight};`,
      );
    }
  });

  it("lands unclassed text on body-large", () => {
    const body = CSS.match(/\nbody\s*\{([^}]*)\}/);
    expect(body, "no body rule").not.toBeNull();
    for (const property of ["font-size", "line-height", "letter-spacing", "font-weight"]) {
      const declared = property === "font-size" ? "--text-body-large" : `--text-body-large--${property}`;
      expect(body![1], property).toContain(`${property}: var(${declared})`);
    }
  });

  // The role table's two rungs the audit found the apps disagreeing on
  // (readme §13, the audit answers): a page title is `title-large` — every
  // board's band title, and M3's top-app-bar spec — and `headline-small`'s home
  // is a dialog heading. `title-medium` belongs to a card or a section head.
  it("sets every dialog heading at headline-small", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const source = readFileSync(file, "utf-8");
      // A modal surface: the native element, or the role a hand-built one takes.
      if (!/<dialog|role="(?:alert)?dialog"/.test(source)) continue;
      // Sheets are not dialogs: a sheet's own heading is `title-medium`
      // (design/components/core/BottomSheet.jsx, SheetTitle).
      if (/BottomSheet|bottom-sheet/.test(source)) continue;
      if (/<h2[^>]*text-title-medium/.test(source)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("leaves no ad-hoc size, weight, or tracking in any screen", () => {
    // The analogue of palette.test.ts's no-raw-hex rule: a screen that sets its
    // own size is what makes the next scale change a rewrite instead of a token
    // edit. Two exceptions, each a mark rather than styling: `tracking-wider`
    // is the recovery code's legibility device (§3), and `font-semibold` is the
    // wordmark's own weight (§6, the mark) — the design master writes the same
    // 600 as a literal because the wordmark is not on the type ramp.
    const adHoc = /\btext-(?:xs|sm|base|lg|[2-9]?xl)\b|\bfont-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b|\bleading-|\btracking-/;
    const EXEMPT: Record<string, string> = {
      "recovery-code.tsx": "tracking-wider",
      "cogra-band.tsx": "font-semibold",
    };
    const offenders: string[] = [];
    const files = sourceFiles();
    expect(files.length, "scanned nothing — the walk is broken").toBeGreaterThan(20);
    for (const file of files) {
      const source = readFileSync(file, "utf-8");
      const exempt = Object.entries(EXEMPT).find(([name]) => file.endsWith(name));
      const stripped = exempt === undefined ? source : source.replaceAll(exempt[1], "");
      if (adHoc.test(stripped)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
