import { beforeEach, describe, expect, it } from "vitest";

import { forgetRecents, readRecents, recentNodeKey, rememberSearch } from "./recents";

// Explore.md:21-31: device-only, ten newest first, case-insensitive dedupe,
// per account, cleared at sign-out.
describe("recent searches", () => {
  beforeEach(() => window.localStorage.clear());

  it("are kept on the device under the cogra prefix the erase clears", () => {
    rememberSearch("me", "salt");
    expect(window.localStorage.getItem("cogra.explore.recents.me")).toBe(JSON.stringify(["salt"]));
  });

  it("keep accounts apart and drop one account's at its sign-out", () => {
    rememberSearch("me", "salt");
    rememberSearch("you", "coast");
    forgetRecents("me");
    expect(readRecents("me")).toEqual([]);
    expect(readRecents("you")).toEqual(["coast"]);
  });

  it("never keep a blank query", () => {
    rememberSearch("me", "   ");
    expect(readRecents("me")).toEqual([]);
  });

  it("key a row by its words, lowercased, other runs one dash (nodes.json explore.recent)", () => {
    expect(recentNodeKey("@sol salt")).toBe("sol-salt");
    expect(recentNodeKey("#saltmaps")).toBe("saltmaps");
    expect(recentNodeKey("Coast Road")).toBe("coast-road");
  });
});
