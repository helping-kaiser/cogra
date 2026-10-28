// @vitest-environment node
import { describe, expect, it } from "vitest";

import { directionOf, opinionsHref, opinionsOrigin, parseOpinionsOrigin } from "./opinions-route";

// Where the opinions page lives and how it is named as an origin
// (ProfileStances.md; graph.json `ProfileStances`).
describe("the opinions page's address", () => {
  it("stands under the reader's own root, or under a person's drill-in", () => {
    expect(opinionsHref(null)).toBe("/profile/opinions");
    expect(opinionsHref("ada")).toBe("/u/ada/opinions");
  });

  it("carries the tab it stands on, and the profile's own origin", () => {
    expect(opinionsHref("ada", "by")).toBe("/u/ada/opinions?tab=by");
    expect(opinionsHref("ada", "on", "saved")).toBe("/u/ada/opinions?from=saved");
    expect(opinionsHref("ada", "by", "u:mira")).toBe("/u/ada/opinions?tab=by&from=u%3Amira");
    // The own root is opened from nowhere but itself.
    expect(opinionsHref(null, "by", "saved")).toBe("/profile/opinions?tab=by");
  });

  it("reads only `by` as the second tab; anything else is the first", () => {
    expect(directionOf("by")).toBe("by");
    expect(directionOf("on")).toBe("on");
    expect(directionOf(null)).toBe("on");
    expect(directionOf("sideways")).toBe("on");
  });
});

describe("the opinions page as an origin", () => {
  it("names the page, its tab and whose it is, and reads its own names back", () => {
    for (const [handle, direction] of [
      [null, "on"],
      [null, "by"],
      ["ada", "on"],
      ["ada", "by"],
    ] as const) {
      expect(parseOpinionsOrigin(opinionsOrigin(handle, direction))).toEqual({ handle, direction });
    }
    expect(opinionsOrigin(null, "on")).toBe("opinions");
    expect(opinionsOrigin("ada", "by")).toBe("opinions.by:ada");
  });

  it("names no page for any other origin, nor for an empty handle", () => {
    for (const from of [null, undefined, "", "profile", "u:ada", "opinions:", "opinions.on", "xopinions"]) {
      expect(parseOpinionsOrigin(from)).toBeNull();
    }
  });
});
