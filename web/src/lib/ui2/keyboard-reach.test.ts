// @vitest-environment node
// The guard behind which pinned surfaces meet the on-screen keyboard (jakob's
// ruling, design → impl seam 388): with the keyboard up the field being typed
// in comes first. ONE field → the pinned commit rides directly above the
// keyboard; SEVERAL fields → the foot stays where it is, under the keyboard,
// and the focused field takes the room — his reason: buttons right above the
// keyboard on a page with several fields invite an accidental submit. jsdom
// has no keyboard, so this pins the declared geometry: every consumer names
// its class through the shared constants, with its reason here, and no raw
// full-height box can come back beside them.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { stageKeyboard } from "@/lib/compose/wizard";

import { SHEET_CEILING, SHEET_CEILING_RIDING, SHEET_KEYBOARD_LIFT } from "./bottom-sheet";
import { KEYBOARD_INSET_VAR } from "./keyboard-inset";
import {
  PINNED_FLOOR,
  PINNED_FLOOR_STILL,
  PINNED_PAGE,
  PINNED_PAGE_STILL,
  SCREEN_LAYER,
  SCREEN_LAYER_STILL,
} from "./screen-layer";

const root = new URL("../../", import.meta.url).pathname;

function sourceFiles(): string[] {
  return readdirSync(root, { recursive: true, encoding: "utf-8" })
    .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."))
    .map((name) => `${root}${name}`);
}

const relative = (file: string) => file.split("/src/")[1];
const read = (path: string) => readFileSync(`${root}${path}`, "utf-8");
const usersOf = (files: string[], name: string) =>
  files
    .filter((file) => !file.endsWith("/lib/ui2/screen-layer.ts"))
    .filter((file) => new RegExp(`\\b${name}\\b`).test(readFileSync(file, "utf-8")))
    .map(relative)
    .sort();

/**
 * EVERY CONSUMER'S CLASS, AND WHY (seam 388). `rides`: one field with its
 * commit. `stays`: several fields. `inert`: no text field — no keyboard rises
 * there, so the riding geometry it keeps moves nothing.
 */
const CLASSES: Record<string, Record<string, string>> = {
  SCREEN_LAYER: {
    "app/posts/[id]/edit/comment-edit-view.tsx": "rides only while a picker (one search field, Done) stands over the edit",
    "app/posts/[id]/reply/reply-wizard-view.tsx": "rides: the reply's words are one field; its pickers one search field",
    "lib/ui2/media/media-viewer.tsx": "inert: no field",
  },
  SCREEN_LAYER_STILL: {
    "app/posts/[id]/edit/comment-edit-view.tsx": "stays: the comment edit is several fields (point 2, named)",
  },
  PINNED_PAGE: {
    "app/(app)/compose/post-edit-route.tsx": "rides: the edit's pickers, one search field and Done",
    "app/(app)/compose/wizard/wizard-view.tsx": "rides: the composer's pickers, one search field and Done",
    "app/profile/change-seal.tsx": "inert: no field",
    "app/profile/edit/avatar-crop.tsx": "inert: no field",
  },
  PINNED_PAGE_STILL: {
    "app/(app)/compose/post-edit-view.tsx": "stays: the post edit (EditCompose / EditWords) is several fields",
    "app/profile/edit/profile-edit-screen.tsx": "stays: display name, bio, website",
  },
  PINNED_FLOOR: {
    "app/(app)/compose/post-edit-route.tsx": "inert: the crop and the cover hold no field",
    "app/(app)/compose/wizard/wizard-view.tsx": "rides: the words stage is one field (stageKeyboard)",
  },
  PINNED_FLOOR_STILL: {
    "app/(app)/compose/wizard/wizard-view.tsx": "stays: the details stage is several fields (stageKeyboard)",
  },
};

/** Every sheet that holds a text field names its class, and why. */
const SHEET_CLASSES: Record<string, "rides" | "stays"> = {
  "lib/ui2/compose/describe-sheet.tsx": "rides", // one field (alt text) and Done
  "lib/ui2/compose/sensitive-sheet.tsx": "rides", // one field (the reason) and Done
  "lib/ui2/compose/pair-sheet.tsx": "stays", // `Type exact values`: two number fields and Done
};

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
  it("the_riding_geometry_reads_the_keyboard_inset_and_the_still_never_does", () => {
    const inset = `var(${KEYBOARD_INSET_VAR},0px)`;
    expect(SCREEN_LAYER).toContain(`bottom-[${inset}]`);
    expect(PINNED_PAGE).toMatch(/^h-\[calc\(100dvh_-_var\(--keyboard-inset,0px\)\)\]$/);
    expect(PINNED_FLOOR).toMatch(/^min-h-\[calc\(100dvh_-_var\(--keyboard-inset,0px\)\)\]$/);
    expect(SHEET_CEILING_RIDING).toContain(`var(${KEYBOARD_INSET_VAR}, 0px)`);
    expect(SHEET_KEYBOARD_LIFT).toBe(`var(${KEYBOARD_INSET_VAR}, 0px)`);
    // The still twins are the same boxes with the inset at 0.
    expect(SCREEN_LAYER_STILL).toBe("fixed inset-0 pb-[env(safe-area-inset-bottom)]");
    expect(PINNED_PAGE_STILL).toBe("h-dvh");
    expect(PINNED_FLOOR_STILL).toBe("min-h-dvh");
    expect(SHEET_CEILING).not.toContain(KEYBOARD_INSET_VAR);
    expect(SHEET_CEILING_RIDING.replace(` - var(${KEYBOARD_INSET_VAR}, 0px)`, "")).toBe(SHEET_CEILING);
  });

  it("every_pinned_surface_names_its_keyboard_class", () => {
    const files = sourceFiles();
    expect(files.length, "scanned nothing — the walk is broken").toBeGreaterThan(20);
    for (const [name, users] of Object.entries(CLASSES)) {
      expect(usersOf(files, name), name).toEqual(Object.keys(users).sort());
    }
  });

  it("several_fields_stay_and_one_field_rides_on_the_compose_stages", () => {
    expect(stageKeyboard("details")).toBe("stays");
    expect(stageKeyboard("pick")).toBe("rides");
  });

  it("every_sheet_with_a_text_field_names_its_keyboard_class", () => {
    const withField = sourceFiles()
      .filter((file) => /<BottomSheet\b/.test(readFileSync(file, "utf-8")))
      .filter((file) => /<TextField\b|<textarea\b|type="(text|number|search)"/.test(readFileSync(file, "utf-8")))
      .map(relative)
      .filter((file) => file !== "lib/ui2/gallery.tsx")
      .sort();
    expect(withField).toEqual(Object.keys(SHEET_CLASSES).sort());
    for (const [file, kind] of Object.entries(SHEET_CLASSES)) {
      expect(read(file), file).toContain(`keyboard="${kind}"`);
    }
  });

  it("the_dialogs_of_several_fields_never_read_the_keyboard", () => {
    // The opinion pad's typed values (number fields plus a commit, point 2)
    // stand as a centred dialog that reads no inset.
    for (const file of ["lib/ui/stance-alternates.tsx"]) {
      expect(read(file), file).not.toMatch(/keyboard-inset|SCREEN_LAYER|PINNED_|SHEET_KEYBOARD_LIFT/);
    }
  });

  it("a_riding_words_field_keeps_three_of_its_lines", () => {
    // THE FIELD WINS (point 1): the floor holds three lines plus the box's own
    // padding and border, so a band too short for them and the commit lets the
    // commit fall under the keyboard instead of the field giving up lines.
    expect(read("app/(app)/compose/wizard/pick-step.tsx")).toContain("min-h-[calc(3lh+1.5rem+2px)] flex-1");
    expect(read("app/posts/[id]/reply/reply-compose-step.tsx")).toContain("min-h-[calc(3lh+1.25rem+2px)] flex-1");
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
