// The filter's split between ranker arguments and device axes (CD-1, §5.1).

import { describe, expect, it } from "vitest";

import {
  BAND_CEILING_PX,
  deviceCutsOf,
  doneEffectOf,
  FEED_FILTER_DEFAULT,
  feedFilterSummary,
  measureTriggerText,
  rankArgumentsOf,
  type FeedFilterValue,
} from "./feed-filter";

const RUST = { id: "ht-rust", name: "rust" };

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
    expect(rankArgumentsOf(staged({ topic: RUST })).topic).toBe("ht-rust");
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
    expect(doneEffectOf(FEED_FILTER_DEFAULT, staged({ topic: RUST }))).toBe("rank");
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

// THE TRIGGER'S READING, compiled from the sidecars' trigger lines
// (FeedNarrowed.md, FeedTopic.md, FeedFar.md, FeedNothing.md, FeedSheet.md).
describe("the trigger's reading", () => {
  it("reads Posts at the default with no default of the reader's own (FeedNarrowed.md:3)", () => {
    expect(feedFilterSummary(FEED_FILTER_DEFAULT)).toBe("Posts");
  });

  it("spells the deviations out while they fit 154px (FeedNarrowed.md:7)", () => {
    const narrowed = staged({ forms: ["photos"], order: "newest" });
    expect(feedFilterSummary(narrowed)).toBe("Posts · photos · newest");
    expect(measureTriggerText("Posts · photos · newest")).toBeLessThanOrEqual(BAND_CEILING_PX);
  });

  it("collapses the deviations past its kinds to a count when they do not fit (FeedNarrowed.md:9)", () => {
    const far = staged({ forms: ["photos", "video"], order: "newest", seen: true, also: [] });
    expect(feedFilterSummary(far)).toBe("Posts · 4 changes");
  });

  it("reads settled only among its deviations with Still settling off (FeedNarrowed.md:11)", () => {
    expect(feedFilterSummary(staged({ also: [] }))).toBe("Posts · settled only");
  });

  it("names the topic by the tag's own name, leading the extras (FeedTopic.md:3)", () => {
    expect(feedFilterSummary(staged({ topic: { id: "t", name: "saltmaps" } }))).toBe("Posts · #saltmaps");
    expect(feedFilterSummary(staged({ topic: { id: "t", name: "saltmaps" }, order: "newest" }))).toBe(
      "Posts · 2 changes",
    );
  });

  it("collapses a topic too wide for the pill with the extras, the kinds kept (FeedTopic.md:5-7)", () => {
    const wide = staged({ topic: { id: "t", name: "a".repeat(60) }, order: "newest" });
    expect(feedFilterSummary(wide)).toBe("Posts · 2 changes");
  });

  it("names one kind or counts the kinds that are on (FeedFar.md:3-5)", () => {
    expect(feedFilterSummary(staged({ kinds: ["comments"] }))).toBe("Comments");
    expect(feedFilterSummary(staged({ kinds: ["posts", "comments"] }))).toBe("2 kinds");
    expect(feedFilterSummary(staged({ kinds: ["posts", "comments", "profiles", "topics"] }))).toBe("All kinds");
    const far = staged({
      kinds: ["posts", "comments", "profiles"],
      forms: ["photos"],
      order: "newest",
      seen: true,
      also: [],
    });
    expect(feedFilterSummary(far)).toBe("3 kinds · 4 changes");
  });

  it("reads Nothing with every kind off (FeedNothing.md:3)", () => {
    expect(feedFilterSummary(staged({ kinds: [] }))).toBe("Nothing");
  });

  it("reads your people, for — and collapses against past the budget (FeedSheet.md:71; PR-42)", () => {
    expect(feedFilterSummary(staged({ people: "yourPeople" }))).toBe("Posts · your people");
    expect(feedFilterSummary(staged({ people: "yourPeople", peopleSign: "for" }))).toBe("Posts · your people, for");
    expect(feedFilterSummary(staged({ people: "yourPeople", peopleSign: "against" }))).toBe("Posts · 1 change");
  });

  it("speaks no sign kept under Everyone (FeedSheet.md:27)", () => {
    expect(feedFilterSummary(staged({ people: "everyone", peopleSign: "against" }))).toBe("Posts");
  });

  it("reads the borrowed view's account's people (FeedSheet.md, GIVEN the feed borrows a view)", () => {
    expect(feedFilterSummary(staged({ people: "yourPeople" }), FEED_FILTER_DEFAULT, "mira")).toBe(
      "Posts · @mira's people",
    );
  });

  it("speaks only the deviations from the READER's default, back toward the app's included (FeedSheet.md:65-69)", () => {
    const readers = staged({ order: "newest", seen: true, also: ["settling", "sensitive"] });
    expect(feedFilterSummary(readers, readers)).toBe("Posts");
    // The app's own default, read against that reader's: each axis's state.
    expect(feedFilterSummary(FEED_FILTER_DEFAULT, readers)).toBe("Posts · 3 changes");
    expect(feedFilterSummary(staged({ order: "ranked", seen: true, also: ["settling", "sensitive"] }), readers)).toBe(
      "Posts · ranked",
    );
    expect(feedFilterSummary(staged({ order: "newest", seen: false, also: ["settling", "sensitive"] }), readers)).toBe(
      "Posts · hiding seen",
    );
    expect(feedFilterSummary(staged({ order: "newest", seen: true, also: ["settling"] }), readers)).toBe(
      "Posts · hiding sensitive",
    );
    const photosOnly = staged({ forms: ["photos"] });
    expect(feedFilterSummary(FEED_FILTER_DEFAULT, photosOnly)).toBe("Posts · all forms");
    const settledOnly = staged({ also: [] });
    expect(feedFilterSummary(FEED_FILTER_DEFAULT, settledOnly)).toBe("Posts · + still settling");
  });

  it("joins the also chips switched on past the default to the + list", () => {
    expect(feedFilterSummary(staged({ also: ["settling", "sensitive"] }))).toBe("Posts · + sensitive");
    expect(feedFilterSummary(staged({ also: ["settling", "sensitive", "removed"] }))).toBe("Posts · 1 change");
  });
});
