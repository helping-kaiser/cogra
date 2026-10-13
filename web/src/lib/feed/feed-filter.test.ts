// The filter's split between ranker arguments and device axes (CD-1, §5.1).

import { describe, expect, it } from "vitest";

import {
  deviceCutsOf,
  doneEffectOf,
  FEED_FILTER_DEFAULT,
  rankArgumentsOf,
  type FeedFilterValue,
} from "./feed-filter";

const staged = (change: Partial<FeedFilterValue>): FeedFilterValue => ({
  ...FEED_FILTER_DEFAULT,
  ...change,
});

describe("the feed filter", () => {
  // The interim flip (§4.9): the ranked path is the feed's default order.
  it("defaults to the drawn sheet's value, Ranked first", () => {
    expect(FEED_FILTER_DEFAULT).toEqual({
      kinds: ["posts"],
      forms: ["text", "photos", "video"],
      order: "ranked",
      seen: false,
      also: ["settling"],
      topic: null,
      people: "everyone",
      peopleSign: "either",
    });
  });

  it("sends the ranker its kinds and topic and nothing else", () => {
    expect(rankArgumentsOf(staged({ kinds: ["posts", "comments", "profiles", "topics"] }))).toEqual({
      kinds: ["POST", "COMMENT", "USER", "HASHTAG"],
      topic: null,
    });
    expect(rankArgumentsOf(staged({ topic: "ht-rust" })).topic).toBe("ht-rust");
  });

  it("reads every device axis off the value", () => {
    expect(deviceCutsOf(FEED_FILTER_DEFAULT)).toEqual({
      order: "ranked",
      showSeen: false,
      showSettling: true,
      people: "everyone",
      peopleSign: "either",
    });
    expect(
      deviceCutsOf(
        staged({ order: "newest", seen: true, also: [], people: "yourPeople", peopleSign: "for" }),
      ),
    ).toEqual({
      order: "newest",
      showSeen: true,
      showSettling: false,
      people: "yourPeople",
      peopleSign: "for",
    });
  });

  it("done_without_changes_never_ranks", () => {
    expect(doneEffectOf(FEED_FILTER_DEFAULT, staged({}))).toBe("nothing");
    // The same kinds in another order are the same question.
    expect(
      doneEffectOf(staged({ kinds: ["posts", "comments"] }), staged({ kinds: ["comments", "posts"] })),
    ).toBe("nothing");
  });

  it("done_with_a_kinds_or_topic_change_ranks_once", () => {
    expect(doneEffectOf(FEED_FILTER_DEFAULT, staged({ kinds: ["comments"] }))).toBe("rank");
    expect(doneEffectOf(FEED_FILTER_DEFAULT, staged({ topic: "ht-rust" }))).toBe("rank");
  });

  it("done_with_only_device_side_changes_never_ranks_and_rederives", () => {
    for (const change of [
      { order: "newest" },
      { seen: true },
      { also: [] },
      { also: ["settling", "sensitive"] },
      { forms: ["text"] },
      { people: "yourPeople" },
      { peopleSign: "against" },
    ] as Partial<FeedFilterValue>[]) {
      expect(doneEffectOf(FEED_FILTER_DEFAULT, staged(change))).toBe("rederive");
    }
  });

  it("a_mixed_done_ranks_once_then_derives", () => {
    expect(doneEffectOf(FEED_FILTER_DEFAULT, staged({ kinds: ["comments"], order: "newest" }))).toBe(
      "rank",
    );
  });

  it("the_sign_kept_for_your_peoples_return_is_client_state", () => {
    const leaving = staged({ people: "everyone", peopleSign: "against" });
    expect(rankArgumentsOf(leaving)).toEqual(rankArgumentsOf(FEED_FILTER_DEFAULT));
    expect(doneEffectOf(FEED_FILTER_DEFAULT, leaving)).toBe("rederive");
  });
});
