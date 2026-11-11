// @vitest-environment node
// Round 28's law (design readme §13, "the whole roles", after round 20): a site
// that sets a type role sets all of it — size, leading, tracking and weight
// from the one role — except a deliberate, named one-part override the master
// itself draws.
//
// The role table is the design's `design/tokens/typography.css`; the web reads
// the same sixty variables from globals.css, and this pins them equal so the
// two cannot drift (type.test.ts pins the web side to Material's own tokens).

import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const WEB = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf-8");
const DESIGN = readFileSync(new URL("../../../../design/tokens/typography.css", import.meta.url), "utf-8");

/** Every `--text-<role>[--part]: value;` declaration whose role is on the type ramp. */
function roleTable(css: string): Map<string, string> {
  const table = new Map<string, string>();
  for (const [, name, value] of css.matchAll(
    /(--text-(?:display|headline|title|body|label)-(?:large|medium|small)(?:--[a-z-]+)?):\s*([^;]+);/g,
  )) {
    if (!table.has(name)) table.set(name, value.trim());
  }
  return table;
}

/**
 * Every part of a role a screen sets apart from the role utility, each licensed
 * by the master line that sets that one part on purpose. A screen reads a role
 * through `text-<role>`, which carries all four parts; anything below is a
 * deliberate override the master draws, and nothing else may join it.
 */
const LICENSED: Record<string, string> = {
  "app/trace/[id]/trace-parts.tsx [font-weight:500]": "_shared.jsx ScoreOrigin / PathRow value: fontWeight 500",
  "app/trace/[id]/trace-view.tsx [font-weight:500]": "FeedEntry.jsx morePaths value: fontWeight 500",
  "lib/ui2/explainable-number.tsx [font-weight:500]": "ExplainableNumber.jsx value: fontWeight 500",
  "lib/ui2/monogram-avatar.tsx [font-weight:500]": "ActorChip.jsx MonogramAvatar: fontWeight 500 on every disc",
  "lib/ui/comment-feed-card.tsx [font-weight:400]": "CommentCard.jsx removed target title: fontWeight 400",
  "lib/ui2/compose/media-thumb.tsx [font-weight:700]": "MediaThumb.jsx failed badge: fontWeight 700",
  "lib/ui2/compose/acts-card.tsx [font-weight:var(--text-label-large--font-weight)]": "ActsCard.jsx total: label-large's weight on body-medium",
  "lib/ui2/content-row.tsx [line-height:1]": "ContentRow.jsx face and letter discs: lineHeight 1",
  "lib/ui2/pair-readout.tsx [line-height:1]": "ReferenceRow.jsx pair face: lineHeight 1",
  "lib/ui2/reference-row.tsx [line-height:1]": "ReferenceRow.jsx pair face: lineHeight 1",
  "lib/ui/stance-control.tsx text-[length:var(--text-title-large)]": "StanceControl.jsx resting face: title-large size, lineHeight 1",
  "lib/ui/stance-control.tsx [line-height:1]": "StanceControl.jsx resting face: lineHeight 1",
  "lib/ui/node-mark.tsx text-[length:var(--text-title-medium)]": "ReferenceRow.jsx NodeMark letter: title-medium size and weight",
  "lib/ui2/compose/topic-removable.tsx [letter-spacing:inherit]": "the chip's inner button reads the chip's own label-large",
  "lib/ui/node-mark.tsx fontWeight:": "ReferenceRow.jsx NodeMark letter: title-medium size and weight",
  "lib/ui/node-mark.tsx lineHeight:": "ReferenceRow.jsx NodeMark letter: the tile centres it, no line of its own",
  "lib/ui/stance-control.tsx fontSize:": "StanceControl.jsx resting face over media: --size-face-over-media",
  "lib/ui2/feed-filter-sheet.tsx fontWeight:": "FeedFilter.jsx sign words: fontWeight chosen ? 500 : 400",
};

/** Comments say why; only code sets type. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, "$1");
}

/** A role part set apart: an arbitrary size, leading, tracking or weight utility. */
const PART_TOKEN =
  /text-\[length:[^\]]+\](?:\/\[[^\]]+\])?|\[(?:line-height|letter-spacing|font-weight|font-size):[^\]]+\]|\b(?:fontSize|lineHeight|letterSpacing|fontWeight):/g;

function sourceFiles(): string[] {
  const root = new URL("../../", import.meta.url).pathname;
  return readdirSync(root, { recursive: true, encoding: "utf-8" })
    .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."))
    .map((name) => name.replaceAll("\\", "/"));
}

describe("whole type roles", () => {
  it("carries the design's role table, all fifteen roles by four parts", () => {
    const design = roleTable(DESIGN);
    expect(design.size).toBe(60);
    expect(Object.fromEntries(roleTable(WEB))).toEqual(Object.fromEntries(design));
  });

  it("sets no part of a role apart but the overrides a master draws", () => {
    const root = new URL("../../", import.meta.url).pathname;
    const files = sourceFiles();
    expect(files.length, "scanned nothing — the walk is broken").toBeGreaterThan(20);
    const found = new Set<string>();
    for (const file of files) {
      for (const [token] of code(readFileSync(`${root}${file}`, "utf-8")).matchAll(PART_TOKEN)) found.add(`${file} ${token}`);
    }
    const unlicensed = [...found].filter((site) => !(site in LICENSED)).sort();
    expect(unlicensed).toEqual([]);
    const stale = Object.keys(LICENSED).filter((site) => !found.has(site)).sort();
    expect(stale, "a licensed override no screen sets any more").toEqual([]);
  });
});
