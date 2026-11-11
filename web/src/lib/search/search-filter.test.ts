import { describe, expect, it } from "vitest";

import { FEED_FILTER_DEFAULT } from "@/lib/feed/feed-filter";
import { writeReaderDefault } from "@/lib/feed/reader-default";

import {
  APP_SEARCH_DEFAULT,
  guestSearchFilter,
  readCommittedFilter,
  readerSearchDefault,
  searchFilterSummary,
  toggleKind,
  wireKinds,
  wireOrder,
} from "./search-filter";

// The trigger's reading (ExploreFilter.md:17; ExploreSearch.md:17;
// ExploreUnscoped.md:9) and the wire's arguments (api-spec "Search").
describe("search filter", () => {
  it("reads Everything at the default, a kind's name alone, then counts", () => {
    expect(searchFilterSummary(APP_SEARCH_DEFAULT)).toBe("Everything");
    expect(searchFilterSummary({ ...APP_SEARCH_DEFAULT, kinds: ["comments"] })).toBe("Comments");
    expect(searchFilterSummary({ ...APP_SEARCH_DEFAULT, kinds: ["topics"] })).toBe("Tags");
    expect(searchFilterSummary({ ...APP_SEARCH_DEFAULT, kinds: ["posts", "topics"] })).toBe("2 kinds");
    expect(
      searchFilterSummary({ ...APP_SEARCH_DEFAULT, kinds: ["posts", "comments", "profiles", "topics"] }),
    ).toBe("All kinds");
  });

  it("speaks only deviations, a deviation back toward the app's default included", () => {
    expect(searchFilterSummary({ ...APP_SEARCH_DEFAULT, order: "newest" })).toBe("Everything · newest");
    const readerDefault = { kinds: [], order: "newest" } as const;
    expect(searchFilterSummary(readerDefault, readerDefault)).toBe("Everything");
    expect(searchFilterSummary(APP_SEARCH_DEFAULT, readerDefault)).toBe("Everything · ranked");
  });

  // Seam 296 (jakob, 2026-11-11): search never looks at the seen-list, so the
  // reader's saved default gives search its order and nothing else.
  it("takes only the order from the reader's saved default, whatever its seen toggle", () => {
    writeReaderDefault("me", { ...FEED_FILTER_DEFAULT, order: "newest", seen: true });
    try {
      expect(readerSearchDefault("me")).toEqual({ kinds: [], order: "newest" });
    } finally {
      window.localStorage.removeItem("cogra.feed.default.me");
    }
  });

  it("reads a filter kept with a seen toggle past the toggle", () => {
    window.localStorage.setItem(
      "cogra.explore.filter.me",
      JSON.stringify({ kinds: ["posts"], order: "newest", seen: true }),
    );
    try {
      expect(readCommittedFilter("me")).toEqual({ kinds: ["posts"], order: "newest" });
    } finally {
      window.localStorage.removeItem("cogra.explore.filter.me");
    }
  });

  it("a guest's default reads Everything against itself", () => {
    expect(searchFilterSummary(guestSearchFilter(), guestSearchFilter())).toBe("Everything");
  });

  it("asks every kind with none on, and the list's own order otherwise", () => {
    expect(wireKinds([])).toBeNull();
    expect(wireKinds(["topics", "posts"])).toEqual(["POST", "HASHTAG"]);
    expect(wireOrder("ranked")).toBe("RANKED");
    expect(wireOrder("newest")).toBe("NEWEST");
  });

  it("chips combine and keep the list's order", () => {
    expect(toggleKind(["topics"], "posts")).toEqual(["posts", "topics"]);
    expect(toggleKind(["posts", "topics"], "posts")).toEqual(["topics"]);
  });
});
