// @vitest-environment node
// Exports `design-tokens.json` (repo root) — the cross-platform colour
// contract both clients pin their themes to, generated from the recipe in
// design.md §2.2 rather than transcribed. Mirrors the crypto vectors:
// `make tokens` rewrites it, every other run asserts it is not stale.
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  Blend,
  DynamicScheme,
  Hct,
  MaterialDynamicColors,
  SchemeContent,
  TonalPalette,
  Variant,
} from "@material/material-color-utilities";

const TOKENS_PATH = new URL("../../../../design-tokens.json", import.meta.url);

const SEED = 0xffef6c1a;

// The design colour behind §2.3's Success role. Teal rather than a true green:
// harmonizing a green into an orange-led palette lands it on top of `tertiary`,
// and teal keeps a blue component that survives red/green colour blindness.
const SUCCESS_DESIGN_COLOR = 0xff00897b;

// The Material 3 roles Compose's ColorScheme carries, in ColorScheme order so
// the emitted file reads like the class it feeds.
const M3_ROLES = [
  "primary", "onPrimary", "primaryContainer", "onPrimaryContainer", "inversePrimary",
  "secondary", "onSecondary", "secondaryContainer", "onSecondaryContainer",
  "tertiary", "onTertiary", "tertiaryContainer", "onTertiaryContainer",
  "background", "onBackground",
  "surface", "onSurface", "surfaceVariant", "onSurfaceVariant", "surfaceTint",
  "inverseSurface", "inverseOnSurface",
  "error", "onError", "errorContainer", "onErrorContainer",
  "outline", "outlineVariant", "scrim",
  "surfaceBright", "surfaceDim",
  "surfaceContainer", "surfaceContainerHigh", "surfaceContainerHighest",
  "surfaceContainerLow", "surfaceContainerLowest",
] as const;

// §2.3's Success table: a CoGra extension outside M3's spec, read at M3's own
// error tone positions so success carries exactly the weight error does.
const SUCCESS_TONES = {
  light: { success: 40, onSuccess: 100, successContainer: 90, onSuccessContainer: 10 },
  dark: { success: 80, onSuccess: 20, successContainer: 30, onSuccessContainer: 90 },
} as const;

const hex = (argb: number): string =>
  "#" +
  [16, 8, 0]
    .map((shift) => ((argb >> shift) & 0xff).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

/**
 * Material pins the error palette at hue 25 whatever the seed. That is far from
 * a typical blue or purple primary but a near-neighbour of this one at hue 44.6
 * — same tone 40, and identical contrast against `surface` — so the error read
 * as another brand colour rather than as an alarm. Moving it to hue 5 doubles
 * the separation while staying unmistakably a warning colour. Chroma is
 * Material's own.
 */
const ERROR_HUE = 5;

/**
 * design.md §2.2. Dark rebuilds the neutrals at chroma 1.5/2.5 — Content derives
 * them from the seed hard enough to tint every dark surface brown — and takes
 * `primary` from tone 70, where Material's tone 80 reads as peach.
 */
function scheme(isDark: boolean): DynamicScheme {
  const base = new SchemeContent(Hct.fromInt(SEED), isDark, 0.0);
  return new DynamicScheme({
    sourceColorHct: Hct.fromInt(SEED),
    variant: Variant.CONTENT,
    contrastLevel: 0.0,
    isDark,
    primaryPalette: base.primaryPalette,
    secondaryPalette: base.secondaryPalette,
    tertiaryPalette: base.tertiaryPalette,
    errorPalette: TonalPalette.fromHueAndChroma(ERROR_HUE, base.errorPalette.chroma),
    neutralPalette: isDark
      ? TonalPalette.fromHueAndChroma(base.neutralPalette.hue, 1.5)
      : base.neutralPalette,
    neutralVariantPalette: isDark
      ? TonalPalette.fromHueAndChroma(base.neutralVariantPalette.hue, 2.5)
      : base.neutralVariantPalette,
  });
}

function roles(isDark: boolean): Record<string, string> {
  const s = scheme(isDark);
  const out: Record<string, string> = {};
  for (const role of M3_ROLES) {
    const dynamic = MaterialDynamicColors[role as keyof typeof MaterialDynamicColors];
    out[role] = hex((dynamic as { getArgb(s: DynamicScheme): number }).getArgb(s));
  }
  if (isDark) {
    // §2.1's two dark overrides. surfaceTint follows primary rather than MCU's
    // tone-80 output, so dark elevation cannot reintroduce the rejected peach.
    out.primary = hex(s.primaryPalette.tone(70));
    out.onPrimary = hex(s.primaryPalette.tone(10));
  }
  out.surfaceTint = out.primary;

  // Material's error tones are 40 light / 80 dark, and tone 80 holds only
  // chroma 32.6 of the palette's 84 — a pastel, whatever the hue. Taken deeper
  // the same hue more than doubles its saturation, and error stops being
  // *brighter* than primary on a dark screen and becomes heavier than it.
  out.error = hex(s.errorPalette.tone(isDark ? 65 : 35));

  // Harmonized toward the seed the way Material Theme Builder builds custom
  // colours, so the role is generated rather than picked.
  const harmonized = Hct.fromInt(Blend.harmonize(SUCCESS_DESIGN_COLOR, SEED));
  const successPalette = TonalPalette.fromHueAndChroma(harmonized.hue, harmonized.chroma);
  for (const [role, tone] of Object.entries(SUCCESS_TONES[isDark ? "dark" : "light"])) {
    out[role] = hex(successPalette.tone(tone));
  }
  return out;
}

function build() {
  return {
    seed: hex(SEED),
    successDesignColor: hex(SUCCESS_DESIGN_COLOR),
    light: roles(false),
    dark: roles(true),
  };
}

/** WCAG 2.1 relative luminance over the sRGB channels. */
function luminance(hexColor: string): number {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hexColor.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The `on`-pairs design.md §2.1 guarantees at WCAG AA. */
const ON_PAIRS = [
  ["onPrimary", "primary"],
  ["onPrimaryContainer", "primaryContainer"],
  ["onSecondary", "secondary"],
  ["onSecondaryContainer", "secondaryContainer"],
  ["onTertiary", "tertiary"],
  ["onTertiaryContainer", "tertiaryContainer"],
  ["onError", "error"],
  ["onErrorContainer", "errorContainer"],
  ["onSurface", "surface"],
  ["onSurfaceVariant", "surfaceVariant"],
  ["inverseOnSurface", "inverseSurface"],
  ["onSuccess", "success"],
  ["onSuccessContainer", "successContainer"],
] as const;

describe("design tokens", () => {
  it("match the committed file", () => {
    const rendered = `${JSON.stringify(build(), null, 2)}\n`;
    if (process.env.UPDATE_DESIGN_TOKENS) {
      writeFileSync(TOKENS_PATH, rendered);
      return;
    }
    const committed = readFileSync(TOKENS_PATH, "utf-8");
    expect(committed, "design-tokens.json is stale — run `make tokens`").toBe(rendered);
  });

  // design.md §2.1: "A palette change that fails that check does not ship."
  // The check runs here, against what generation just produced.
  it.each(["light", "dark"] as const)("clear WCAG AA on every %s on-pair", (theme) => {
    const roles = build()[theme];
    for (const [on, background] of ON_PAIRS) {
      expect(contrast(roles[on], roles[background]), `${theme}: ${on} on ${background}`)
        .toBeGreaterThanOrEqual(4.5);
    }
  });
});
