import { describe, expect, it } from "vitest";

import { TAIL_DISTANCE, tailIndexOf } from "./infinite-list";

describe("the watched item", () => {
  it("sits a few short of the end, so the page is on its way before the end is", () => {
    expect(tailIndexOf(20)).toBe(20 - TAIL_DISTANCE);
    expect(tailIndexOf(41)).toBe(41 - TAIL_DISTANCE);
  });

  it("is the first item in a list too short to have a tail", () => {
    expect(tailIndexOf(3)).toBe(0);
    expect(tailIndexOf(TAIL_DISTANCE)).toBe(0);
  });

  it("is no item at all in an empty list", () => {
    expect(tailIndexOf(0)).toBe(-1);
  });
});
