// The figure every score slot reads (CD-SR5, CD-9; FeedKinds.md:7-15;
// PostDetail.md:19; History.md:29; TagPage.md:23; ProfilePosts.md:37).

import { afterEach, describe, expect, it } from "vitest";

import type { HeldAnswer } from "@/lib/feed/derive";
import { adoptTrace, forgetStandings, heldViewer, holdRanking, standingOf } from "./standing";

const answer = (entries: [string, number][], settling: string[] = []): HeldAnswer => ({
  asOfEpoch: 7,
  entries: entries.map(([targetId, score], newestIndex) => ({
    targetId,
    kind: "POST",
    score,
    mark: null,
    newestIndex,
  })),
  settling: settling.map((targetId, at) => ({
    targetId,
    kind: "POST",
    mark: null,
    rankedPosition: at,
    newestPosition: at,
  })),
});

afterEach(() => forgetStandings());

describe("a thing's standing", () => {
  it("an_off_feed_card_looks_its_thing_up_in_the_last_feed_fetch", () => {
    holdRanking("u1", answer([["p1", 15.2]]), "u1");
    expect(standingOf("u1", "p1", false)).toEqual({ kind: "figure", score: 15.2 });
  });

  it("an_off_feed_lookup_miss_reads_a_dash", () => {
    holdRanking("u1", answer([["p1", 15.2]]), "u1");
    expect(standingOf("u1", "p9", false)).toEqual({ kind: "dash" });
  });

  it("with no ranking held, every lookup misses", () => {
    expect(standingOf("u1", "p1", false)).toEqual({ kind: "dash" });
  });

  it("another reader's ranking is never this reader's", () => {
    holdRanking("u1", answer([["p1", 15.2]]), "u1");
    expect(standingOf("u2", "p1", false)).toEqual({ kind: "dash" });
    expect(heldViewer("u2")).toBeNull();
  });

  it("a settling thing stands bare, by its own landing or by the answer's settling list", () => {
    holdRanking("u1", answer([["p1", 15.2]], ["p2"]), "u1");
    expect(standingOf("u1", "p2", false)).toEqual({ kind: "settling" });
    expect(standingOf("u1", "p1", true)).toEqual({ kind: "settling" });
  });

  it("the_card_adopts_the_figure_the_trace_found", () => {
    holdRanking("u1", answer([["p1", 15.2]]), "u1");
    adoptTrace("p1", 14.7);
    expect(standingOf("u1", "p1", false)).toEqual({ kind: "figure", score: 14.7 });
  });

  it("an_absent_target_reads_the_moved_on_state_and_the_card_adopts_the_dash", () => {
    holdRanking("u1", answer([["p1", 15.2]]), "u1");
    adoptTrace("p1", null);
    // after_a_no_paths_trace_the_old_figure_never_shows_again
    expect(standingOf("u1", "p1", false)).toEqual({ kind: "dash" });
  });

  it("a trace answers a lookup miss: its figure is adopted", () => {
    holdRanking("u1", answer([]), "u1");
    adoptTrace("p9", 3.1);
    expect(standingOf("u1", "p9", false)).toEqual({ kind: "figure", score: 3.1 });
  });

  it("the_next_feed_fetch_replaces_every_adopted_figure (the_next_feed_fetch_dissolves_the_dash)", () => {
    holdRanking("u1", answer([["p1", 15.2]]), "u1");
    adoptTrace("p1", null);
    holdRanking("u1", answer([["p1", 12.4]]), "u1");
    expect(standingOf("u1", "p1", false)).toEqual({ kind: "figure", score: 12.4 });
  });

  it("the trace keeps the view the figure was computed in (CD-SR1)", () => {
    holdRanking("u1", answer([["p1", 15.2]]), "mira");
    expect(heldViewer("u1")).toBe("mira");
  });
});
