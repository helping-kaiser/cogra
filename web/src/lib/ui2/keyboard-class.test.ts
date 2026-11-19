// @vitest-environment node
// With the on-screen keyboard up, the field being typed in comes first (seam
// 388, jakob 2026-11-19): ONE field → the pinned commit rides above the
// keyboard, unless riding would leave the field fewer than three of its
// lines; SEVERAL fields → the foot stays under the keyboard.

import { describe, it } from "vitest";

describe("the keyboard class of a pinned surface", () => {
  it.todo("a_riding_commit_that_leaves_three_lines_rides");
  it.todo("a_riding_commit_that_leaves_fewer_than_three_lines_stays");
  it.todo("a_field_shorter_than_three_lines_needs_only_its_own_lines");
});
