// The reader's default on this device (SettingsReading.md).

import { afterEach, describe, expect, it } from "vitest";

import { FEED_FILTER_DEFAULT } from "./feed-filter";
import { parseReaderDefault, readReaderDefault, writeReaderDefault } from "./reader-default";

afterEach(() => {
  window.localStorage.clear();
});

describe("the reader's default", () => {
  it("is CoGra's where the reader has set none (FeedSheet.md:59)", () => {
    expect(readReaderDefault("acct-1")).toEqual(FEED_FILTER_DEFAULT);
  });

  it("is a guest's always CoGra's — a guest has no Settings", () => {
    expect(readReaderDefault(null)).toEqual(FEED_FILTER_DEFAULT);
  });

  it("is the one they set, on this device, per account (SettingsReading.md: stays on this device)", () => {
    const theirs = { ...FEED_FILTER_DEFAULT, order: "newest" as const, seen: true };
    writeReaderDefault("acct-1", theirs);
    expect(readReaderDefault("acct-1")).toEqual(theirs);
    expect(readReaderDefault("acct-2")).toEqual(FEED_FILTER_DEFAULT);
    expect(window.localStorage.getItem("cogra.feed.default.acct-1")).not.toBeNull();
  });

  it("never holds a topic", () => {
    writeReaderDefault("acct-1", { ...FEED_FILTER_DEFAULT, topic: { id: "t", name: "rust" } });
    expect(readReaderDefault("acct-1").topic).toBeNull();
  });

  it("falls back to CoGra's on a stored value this build cannot read", () => {
    window.localStorage.setItem("cogra.feed.default.acct-1", "{\"kinds\":[\"chats\"]}");
    expect(readReaderDefault("acct-1")).toEqual(FEED_FILTER_DEFAULT);
    expect(parseReaderDefault("not json")).toBeNull();
  });
});
