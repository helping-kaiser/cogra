// The feed's committed filter on this device (FeedSheet.md:65-67): kept per
// account, a topic and all, read back only where it is one this build holds.

import { beforeEach, describe, expect, it } from "vitest";

import { FEED_FILTER_DEFAULT } from "./feed-filter";
import {
  forgetCommittedFeedFilter,
  parseCommittedFilter,
  readCommittedFeedFilter,
  writeCommittedFeedFilter,
} from "./committed-filter";

const NARROWED = { ...FEED_FILTER_DEFAULT, kinds: ["posts", "comments"] as const, topic: { id: "t-salt", name: "saltmaps" } };

describe("the committed feed filter", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps what Done committed per account, its topic included, and a guest's apart", () => {
    writeCommittedFeedFilter("acct-1", NARROWED);
    expect(readCommittedFeedFilter("acct-1")).toEqual(NARROWED);
    expect(readCommittedFeedFilter("acct-2")).toBeNull();
    expect(readCommittedFeedFilter(null)).toBeNull();
    writeCommittedFeedFilter(null, FEED_FILTER_DEFAULT);
    expect(readCommittedFeedFilter(null)).toEqual(FEED_FILTER_DEFAULT);
  });

  it("never writes the saved default", () => {
    writeCommittedFeedFilter("acct-1", NARROWED);
    expect(window.localStorage.getItem("cogra.feed.default.acct-1")).toBeNull();
  });

  it("lets the filter go", () => {
    writeCommittedFeedFilter("acct-1", NARROWED);
    forgetCommittedFeedFilter("acct-1");
    expect(readCommittedFeedFilter("acct-1")).toBeNull();
  });

  it("reads nothing back from a value this build cannot hold", () => {
    expect(parseCommittedFilter("not json")).toBeNull();
    expect(parseCommittedFilter(JSON.stringify({ ...FEED_FILTER_DEFAULT, order: "sideways" }))).toBeNull();
    expect(parseCommittedFilter(JSON.stringify({ ...FEED_FILTER_DEFAULT, topic: { id: 3 } }))).toBeNull();
    expect(parseCommittedFilter(JSON.stringify({ ...FEED_FILTER_DEFAULT, topic: null }))).toEqual(FEED_FILTER_DEFAULT);
  });
});
