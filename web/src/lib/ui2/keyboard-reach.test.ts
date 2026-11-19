// @vitest-environment node
// The guard behind the pinned foot's reach with the on-screen keyboard up
// (seam 381, on design/readme.md, *Spacing and layout*: a stage or a sheet
// pins its footer "so a growing field never walks the commitment out of
// reach"). jsdom has no keyboard, so this pins the declared geometry: every
// pinned surface reads `--keyboard-inset` through the shared constants, and
// no raw full-height box can come back beside them.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { SHEET_CEILING, SHEET_KEYBOARD_LIFT } from "./bottom-sheet";
import { KEYBOARD_INSET_VAR } from "./keyboard-inset";
import { PINNED_FLOOR, PINNED_PAGE, SCREEN_LAYER } from "./screen-layer";

const root = new URL("../../", import.meta.url).pathname;

function sourceFiles(): string[] {
  return readdirSync(root, { recursive: true, encoding: "utf-8" })
    .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."))
    .map((name) => `${root}${name}`);
}

const relative = (file: string) => file.split("/src/")[1];
const usersOf = (files: string[], name: string) =>
  files.filter((file) => new RegExp(`\\$\\{${name}\\}`).test(readFileSync(file, "utf-8"))).map(relative).sort();

/**
 * Full-height boxes that may keep the plain viewport height, each with why: the
 * document itself (it must not resize, or the bottom bar would ride the
 * keyboard on every page), and pages with no pinned foot over a field.
 */
const PLAIN_HEIGHT_ALLOWED: Record<string, string> = {
  "app/layout.tsx": "the document's body: the bottom bar and task pages never move for the keyboard",
  "app/(app)/kept-picks/kept-picks-view.tsx": "a list with a sticky foot and no field: no keyboard rises there",
  "app/(app)/vouched-in/vouched-in-view.tsx": "a task page: its action follows its last field",
};

describe("a pinned foot with the on-screen keyboard up", () => {
  it("every_pinned_foot_reads_the_keyboard_inset", () => {
    const inset = `var(${KEYBOARD_INSET_VAR},0px)`;
    expect(SCREEN_LAYER).toContain(`bottom-[${inset}]`);
    expect(PINNED_PAGE).toMatch(/^h-\[calc\(100dvh_-_var\(--keyboard-inset,0px\)\)\]$/);
    expect(PINNED_FLOOR).toMatch(/^min-h-\[calc\(100dvh_-_var\(--keyboard-inset,0px\)\)\]$/);
    expect(SHEET_CEILING).toContain(`var(${KEYBOARD_INSET_VAR}, 0px)`);
    expect(SHEET_KEYBOARD_LIFT).toBe(`var(${KEYBOARD_INSET_VAR}, 0px)`);
  });

  it("every_pinned_page_stands_on_the_shared_geometry", () => {
    const files = sourceFiles();
    expect(files.length, "scanned nothing — the walk is broken").toBeGreaterThan(20);
    expect(usersOf(files, "PINNED_PAGE")).toEqual([
      "app/(app)/compose/post-edit-route.tsx",
      "app/(app)/compose/post-edit-view.tsx",
      "app/(app)/compose/wizard/wizard-view.tsx",
      "app/profile/change-seal.tsx",
      "app/profile/edit/avatar-crop.tsx",
      "app/profile/edit/profile-edit-screen.tsx",
    ]);
    expect(usersOf(files, "PINNED_FLOOR")).toEqual([
      "app/(app)/compose/post-edit-route.tsx",
      "app/(app)/compose/wizard/wizard-view.tsx",
    ]);
  });

  it("no_raw_full_height_box_misses_the_keyboard", () => {
    // A new pinned page written with `h-dvh` / `min-h-dvh` / `h-screen` would
    // leave its foot under the keyboard: it takes the shared constant instead,
    // or an entry above that says why no keyboard can rise over it.
    const offenders = sourceFiles()
      .filter((file) => !(relative(file) in PLAIN_HEIGHT_ALLOWED))
      .flatMap((file) =>
        readFileSync(file, "utf-8")
          .split("\n")
          .map((line, index) => ({ line, at: `${relative(file)}:${index + 1}` }))
          .filter(({ line }) => /className=.*\b(min-)?h-(dvh|screen|svh|lvh)\b/.test(line))
          .map(({ at }) => at),
      );
    expect(offenders).toEqual([]);
  });

  it("no_fields_scroller_lets_a_row_give_up_height", () => {
    // A scrolling column whose rows may shrink lets a `min-h-0` row (a
    // `TextField`) fall under its own content, which then paints over the
    // rows below it — the comment editor's collapse in jakob's hand test,
    // 2026-11-19. Where the box is short the column scrolls; no row shrinks.
    const exempt: Record<string, string> = {
      "app/shell.tsx": "the app's main: it holds one page, which sizes itself",
      "lib/ui2/compose/picker-rows.tsx": "it holds one list, which is the scrolled content",
      "lib/ui/stance-control.tsx": "the parked pad is content-sized: it is never shorter than its rows",
      "lib/ui2/bottom-sheet.tsx":
        "the sheet's body yields by design, so a growing field scrolls inside its own box (text-field.tsx, the growth law) down to its rows floor",
    };
    const offenders = sourceFiles()
      .filter((file) => !(relative(file) in exempt))
      .flatMap((file) =>
        readFileSync(file, "utf-8")
          .split("\n")
          .map((line, index) => ({ line, at: `${relative(file)}:${index + 1}` }))
          .filter(({ line }) => /className=.*\bflex-col\b.*\boverflow-y-auto\b|className=.*\boverflow-y-auto\b.*\bflex-col\b/.test(line))
          .filter(({ line }) => !line.includes("*:shrink-0"))
          .map(({ at }) => at),
      );
    expect(offenders).toEqual([]);
  });

  it("the_inset_is_kept_once_for_the_whole_app", () => {
    const files = sourceFiles();
    const mounts = files.filter((file) => /<KeyboardInsetSync\s*\/>/.test(readFileSync(file, "utf-8"))).map(relative);
    expect(mounts).toEqual(["app/layout.tsx"]);
  });
});
