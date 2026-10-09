// @vitest-environment node
// The installable app: the manifest meets Chromium's install criteria
// (web.dev "What does it take to be installable?"), every icon it names is a
// real file of the size it claims, and nothing — manifest or head — sets a
// theme colour, because a theme colour is painted into the phone's status bar
// and the app never colours the system status bar.

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import manifest from "./manifest";

// The root layout loads its family through next/font, which only exists under
// Next's compiler; the layout's head metadata is what is under test here.
vi.mock("next/font/google", () => ({ Figtree: () => ({ variable: "font-figtree" }) }));

const TOKENS = JSON.parse(
  readFileSync(new URL("../../../design/tokens/scheme.json", import.meta.url), "utf-8"),
) as { light: Record<string, string> };

const PUBLIC = new URL("../../public/", import.meta.url);

/** A PNG's pixel size and colour type, read from its IHDR chunk. */
function png(src: string): { width: number; height: number; colourType: number } {
  const bytes = readFileSync(new URL(src.replace(/^\//, ""), PUBLIC));
  expect(bytes.subarray(1, 4).toString("latin1"), `${src} is a PNG`).toBe("PNG");
  expect(bytes.subarray(12, 16).toString("latin1"), `${src} IHDR`).toBe("IHDR");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colourType: bytes[25] };
}

describe("manifest", () => {
  const m = manifest();
  const icons = m.icons ?? [];

  it("meets Chromium's install criteria", () => {
    expect(m.name || m.short_name).toBeTruthy();
    expect(m.start_url).toBe("/");
    expect(["fullscreen", "standalone", "minimal-ui", "window-controls-overlay"]).toContain(
      m.display,
    );
    expect(m.prefer_related_applications ?? false).toBe(false);
    for (const size of ["192x192", "512x512"]) {
      expect(
        icons.some((i) => i.sizes === size && i.type === "image/png" && i.purpose !== "maskable"),
        `a ${size} icon`,
      ).toBe(true);
    }
  });

  it("opens standalone, inside its own scope", () => {
    expect(m.display).toBe("standalone");
    expect(m.start_url?.startsWith(m.scope ?? "")).toBe(true);
  });

  it("never sets a theme colour", () => {
    expect(m).not.toHaveProperty("theme_color");
  });

  it("launches on the light theme's background role", () => {
    expect(m.background_color).toBe(TOKENS.light.background.toLowerCase());
  });

  it.each(
    (manifest().icons ?? []).map((i) => [i.src, i] as const),
  )("ships %s at the size it claims", (src, icon) => {
    const { width, height, colourType } = png(src);
    expect(`${width}x${height}`).toBe(icon.sizes);
    if (icon.purpose === "maskable") {
      // Full-bleed: the launcher cuts the shape, so no pixel may be clear.
      expect(colourType, "maskable icon carries no alpha channel").toBe(2);
    }
  });
});

describe("the document head", () => {
  it("sets no theme-color", async () => {
    const { metadata, viewport } = await import("./layout");
    expect(viewport).not.toHaveProperty("themeColor");
    expect(metadata).not.toHaveProperty("themeColor");
  });
});
