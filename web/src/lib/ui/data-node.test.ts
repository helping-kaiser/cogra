import { describe, expect, it } from "vitest";

import { instance, part, testAttributes } from "./data-node";

describe("data-node ids", () => {
  it("renders a node's path as the test id, and its key beside it", () => {
    expect(testAttributes({ path: "feed.band" })).toEqual({ "data-testid": "feed.band" });
    expect(testAttributes({ path: "feed.card", key: "p1" })).toEqual({
      "data-testid": "feed.card",
      "data-testid-key": "p1",
    });
  });

  it("keeps the legacy id where no node is handed", () => {
    expect(testAttributes(undefined, "feed-post-p1")).toEqual({ "data-testid": "feed-post-p1" });
    expect(testAttributes(undefined)).toEqual({ "data-testid": undefined });
  });

  it("gives a part the instance's own key", () => {
    expect(part({ path: "feed.card", key: "p1" }, "actionRow.share")).toEqual({
      path: "feed.card.actionRow.share",
      key: "p1",
    });
    expect(part({ path: "feed.bottomBar" }, "feedSlot")).toEqual({
      path: "feed.bottomBar.feedSlot",
      key: undefined,
    });
    expect(part(undefined, "anything")).toBeUndefined();
  });

  it("joins a nested instance's key outermost first with a slash", () => {
    const media = part({ path: "feed.card", key: "p1" }, "media");
    expect(instance(media, "frame", "2")).toEqual({ path: "feed.card.media.frame", key: "p1/2" });
    expect(instance({ path: "composeDetails.tags" }, "tag", "coastroad")).toEqual({
      path: "composeDetails.tags.tag",
      key: "coastroad",
    });
    expect(instance(undefined, "frame", "1")).toBeUndefined();
  });
});
