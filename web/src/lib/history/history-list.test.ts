import { describe, expect, it } from "vitest";

import { dayLabel, dayNodeKey, dividersOf, kindsReading, nodeKindsOf, sectionOf } from "./history-list";

// A fixed "now": 28 October 2026, mid-afternoon, local time.
const NOW = new Date(2026, 9, 28, 15, 0).getTime();
const local = (year: number, month: number, day: number, hour = 12) => new Date(year, month, day, hour).toISOString();

describe("History's day dividers (History.md:25)", () => {
  it("reads Today, Yesterday, then the date as 2 October", () => {
    expect(dayLabel(local(2026, 9, 28, 0), NOW)).toBe("Today");
    expect(dayLabel(local(2026, 9, 27, 23), NOW)).toBe("Yesterday");
    expect(dayLabel(local(2026, 9, 2), NOW)).toBe("2 October");
  });

  it("adds the year only when it is not the current one", () => {
    expect(dayLabel(local(2025, 11, 31), NOW)).toBe("31 December 2025");
  });

  it("keys a divider by its words, lowercased, other characters one -", () => {
    expect(dayNodeKey("Today")).toBe("today");
    expect(dayNodeKey("2 October")).toBe("2-october");
    expect(dayNodeKey("31 December 2025")).toBe("31-december-2025");
  });

  it("stands a divider above the first thing first seen on each day, never between two of one day", () => {
    const seen = [local(2026, 9, 28, 14), local(2026, 9, 28, 9), local(2026, 9, 27), local(2026, 9, 2), local(2026, 9, 2, 8)];
    expect(dividersOf(seen, NOW)).toEqual(["Today", null, "Yesterday", "2 October", null]);
  });
});

describe("History's filter kinds (HistoryFilter.md:5-9, :31; History.md:105)", () => {
  it("reads Everything with no kind narrowed, and the narrowed kinds in the pill's state words", () => {
    expect(kindsReading([])).toBe("Everything");
    expect(kindsReading(["topics"])).toBe("Tags");
    expect(kindsReading(["profiles"])).toBe("Profiles");
    expect(kindsReading(["posts", "comments"])).toBe("2 kinds");
    expect(kindsReading(["topics", "posts", "comments", "profiles"])).toBe("All kinds");
  });

  it("asks every kind with no chip on, else the narrowed kinds on the wire", () => {
    expect(nodeKindsOf([])).toBeNull();
    expect(nodeKindsOf(["topics", "posts"])).toEqual(["POST", "HASHTAG"]);
    expect(nodeKindsOf(["profiles", "comments"])).toEqual(["COMMENT", "USER"]);
  });
});

describe("a narrowed History's sections (HistorySearch.md:3-23)", () => {
  it("stands people, then tags, then the content", () => {
    expect(sectionOf("User")).toBe("people");
    expect(sectionOf("Hashtag")).toBe("tags");
    expect(sectionOf("Post")).toBe("content");
    expect(sectionOf("Comment")).toBe("content");
  });
});
