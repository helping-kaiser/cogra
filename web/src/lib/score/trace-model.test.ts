// The trace's words and figures, read off one answer (FeedEntry.md,
// RankPath.md, RankHop.md, RankRecords.md; copy-voice, *The score
// drill-down*). Names follow the packet's test list (score-readout §9).

import { describe, expect, it } from "vitest";

import { ADA, MIRA, NAMED, NOW, POST_CREATED, SOL, borrowedAnswer, clippedAnswer, ownAnswer } from "./trace-fixtures";
import {
  CLIPPED_RECORDS,
  foldNote,
  levelOne,
  levelOneNote,
  memberPairs,
  memberSum,
  morePathsWords,
  pathNewest,
  pathValue,
  placeNote,
  recordAge,
  recordsNote,
  spokenTrace,
  stepAge,
  stepSecondLine,
  stepTitle,
  stepsOf,
  throughLine,
  type TraceAnswer,
  type TraceContext,
  type TracePath,
} from "./trace-model";

const own: TraceContext = {
  viewer: SOL.id,
  borrowed: false,
  named: NAMED,
  targetKind: "post",
  targetCreatedAt: POST_CREATED,
  now: NOW,
};
const borrowed: TraceContext = { ...own, viewer: MIRA.id, borrowed: true };

function centsOf(value: string): number {
  return Math.round(Number(value.replace("−", "-")) * 100);
}

describe("level one (FeedEntry.md)", () => {
  it("the_strongest_four_stand_drawn_and_the_rest_ride_one_quiet_row", () => {
    const { drawn, more } = levelOne(ownAnswer(), false);
    expect(drawn.map((row) => row.value)).toEqual(["+6.80", "+4.20", "+2.60", "+1.10"]);
    expect(more).toEqual({ count: 2, value: "+0.50" });
    expect(morePathsWords(2)).toEqual({ label: "2 more paths", name: "Show 2 more paths" });
    expect(morePathsWords(1)).toEqual({ label: "1 more path", name: "Show 1 more path" });
  });

  it("the_drawn_paths_and_the_quiet_row_add_up_to_the_traces_own_score", () => {
    for (const unfolded of [false, true]) {
      const { drawn, more } = levelOne(ownAnswer(), unfolded);
      const sum = drawn.reduce((s, row) => s + centsOf(row.value), 0) + (more ? centsOf(more.value) : 0);
      expect(sum).toBe(1520);
    }
  });

  it("a_trace_whose_figure_differs_from_the_cards_sums_to_its_own_figure", () => {
    // The card wore 15.20 from the feed fetch; the live paths sum to 14.70.
    const live: TraceAnswer = {
      score: 14.7,
      paths: ownAnswer().paths.map((p, i) => (i === 0 ? { ...p, contribution: 6.3 } : p)),
    };
    const { drawn, more } = levelOne(live, false);
    const sum = drawn.reduce((s, row) => s + centsOf(row.value), 0) + centsOf(more!.value);
    expect(sum).toBe(1470);
  });

  it("the_trace_lists_the_paths_strongest_first — extraction order, never re-sorted", () => {
    const answer: TraceAnswer = {
      score: 1,
      paths: [
        { ...ownAnswer().paths[0]!, contribution: -0.5 },
        { ...ownAnswer().paths[1]!, contribution: 1.5 },
      ],
    };
    expect(levelOne(answer, false).drawn.map((row) => row.value)).toEqual(["−0.50", "+1.50"]);
  });

  it("a path reads the same value on the list and on its own level", () => {
    expect(pathValue(ownAnswer(), 0)).toBe("+6.80");
  });

  it("the note names the view the paths start from (FeedEntry.md:5-7)", () => {
    expect(levelOneNote(own, null)).toBe("Every path here starts with an opinion you gave.");
    expect(levelOneNote(borrowed, "mira")).toBe("Every path here starts with an opinion @mira gave.");
  });
});

describe("a path's trace (PathTrace, PathRow)", () => {
  const [ada, , , kelWren] = ownAnswer().paths as TracePath[];

  it("the_path_trace_speaks_you_then_the_handle_then_what_reached_you", () => {
    expect(spokenTrace(ada!, own)).toBe("You, then @ada, then what reached you");
    expect(throughLine(ada!, own)).toBe("Through @ada");
  });

  it("a_multi_hop_trace_speaks_several_steps", () => {
    expect(spokenTrace(kelWren!, own)).toBe("You, then several steps, then what reached you");
    expect(throughLine(kelWren!, own)).toBe("Through @kel and @wren");
  });

  it("a_borrowed_trace_leads_with_the_lenders_face_never_you", () => {
    const lent = borrowedAnswer().paths[0]!;
    expect(spokenTrace(lent, borrowed)).toBe("@mira, then @ada, then what reached you");
  });
});

describe("level two (RankPath.md)", () => {
  const ada = ownAnswer().paths[0]!;
  const steps = stepsOf(ada);

  it("a step is one hop when no record crosses two", () => {
    expect(steps).toHaveLength(2);
  });

  it("each_family_reads_its_drawn_step_title — opinion and publish", () => {
    expect(stepTitle(ada, steps[0]!, own)).toBe("Your opinion of @ada");
    expect(stepTitle(ada, steps[1]!, own)).toBe("@ada published it");
  });

  it("a_borrowed_step_reads_in_the_third_person", () => {
    const lent = borrowedAnswer().paths[0]!;
    expect(stepTitle(lent, stepsOf(lent)[0]!, borrowed)).toBe("@mira's opinion of @ada");
  });

  it("the step's second line counts the opinions behind it; the author's publish says whose rides the post", () => {
    expect(stepSecondLine(ada, steps[0]!, own)).toBe("2 opinions behind it");
    expect(stepSecondLine(ada, steps[1]!, own)).toBe("@ada's own opinion rides the post");
  });

  it("the_authors_publish_is_a_step_aged_as_the_post", () => {
    expect(stepAge(ada, steps[1]!, own)).toBe("2h");
  });

  it("the_paths_newest_age_is_its_last_steps", () => {
    expect(pathNewest(ada, own)).toBe("2h");
  });

  it("every_age_on_the_path_reads_the_ladder", () => {
    expect(stepAge(ada, steps[0]!, own)).toBe("8d");
  });
});

describe("a two-legged record reads as one step (RankPath.md:13; SR-G4)", () => {
  const review: TracePath = {
    nodes: [
      { graphId: "prof:u-sol", id: "u-sol", kind: "USER" },
      { graphId: "prof:u-ada", id: "u-ada", kind: "USER" },
      { graphId: "mint:act:u-ada:4:review", id: "c1", kind: "COMMENT" },
      { graphId: "mint:act:u-tobias:1:publish", id: "p2", kind: "POST" },
    ],
    sign: 1,
    contribution: 1,
    hops: [
      ownAnswer().paths[0]!.hops[0]!,
      ...[0, 1].map(() => ({
        pDirected: 0.4,
        pInterest: 0.2,
        records: [
          {
            id: "act:u-ada:4:review",
            family: "REVIEW" as const,
            author: ADA,
            landedAt: new Date(NOW - 3_600_000).toISOString(),
            legs: [
              { role: "A" as const, sourceId: "addr:u-ada", targetId: "mint:act:u-ada:4:review", pDirected: 0.4, pInterest: 0.2, censusUnknown: false },
              { role: "T" as const, sourceId: "mint:act:u-ada:4:review", targetId: "mint:act:u-tobias:1:publish", pDirected: 0.3, pInterest: 0.1, censusUnknown: false },
            ],
          },
        ],
      })),
    ],
  };

  it("a_two_legged_record_reads_as_one_step_naming_what_it_passed", () => {
    const steps = stepsOf(review);
    expect(steps).toHaveLength(2);
    expect(steps[1]!.through).toEqual([2]);
    expect(stepTitle(review, steps[1]!, own)).toBe("@ada replied to it");
  });

  it("a_t_leg_hop_shows_the_t_legs_pair_not_the_actors", () => {
    const step = stepsOf(review)[1]!;
    expect(memberPairs(review, step).map(({ pDirected, pInterest }) => [pDirected, pInterest])).toEqual([[0.3, 0.1]]);
  });
});

describe("level three (RankHop.md)", () => {
  const ada = ownAnswer().paths[0]!;
  const first = stepsOf(ada)[0]!;

  it("the note names the step by its title and its place", () => {
    expect(placeNote("Your opinion of @ada", 1, 2)).toBe("Your opinion of @ada — the first of this path's two steps.");
  });

  it("the fold's note reads in the reader's own word, with the pad", () => {
    expect(foldNote(ada, first, own)).toBe(
      "You have given @ada two opinions. They add up to one, and that one is what carries — the same adding up the pad shows you as your current opinion.",
    );
  });

  it("another_persons_fold_note_names_them_and_leaves_the_pad_out", () => {
    const lent = borrowedAnswer().paths[0]!;
    expect(foldNote(lent, stepsOf(lent)[0]!, borrowed)).toBe(
      "@mira has given @ada two opinions. They add up to one, and that one is what carries.",
    );
  });

  it("a_clipped_step_says_it_carries_the_limit", () => {
    const clipped = clippedAnswer().paths[0]!;
    const step = stepsOf(clipped)[0]!;
    expect(memberSum(clipped, step).clipped).toBe(true);
    expect(foldNote(clipped, step, own)).toMatch(
      / Added up, they go past the limit an opinion can reach, so the step carries the limit\.$/,
    );
    expect(memberSum(ada, first).clipped).toBe(false);
  });
});

describe("level four (RankRecords.md)", () => {
  const ada = ownAnswer().paths[0]!;
  const first = stepsOf(ada)[0]!;

  it("the_records_open_under_the_line_naming_their_step", () => {
    expect(recordsNote("Your opinion of @ada", 2)).toBe("The two records behind your opinion of @ada.");
    expect(recordsNote("@mira's opinion of @ada", 2)).toBe("The two records behind @mira's opinion of @ada.");
  });

  it("the_records_pairs_add_up_to_the_steps_pair", () => {
    const sum = memberSum(ada, first);
    expect(sum.pDirected).toBeCloseTo(first.hops[0]!.pDirected, 9);
    expect(sum.pInterest).toBeCloseTo(first.hops[0]!.pInterest, 9);
  });

  it("a_record_older_than_thirty_days_wears_a_date", () => {
    const [recent, old] = first.hops[0]!.records;
    expect(recordAge(recent!, NOW)).toBe("8d");
    expect(recordAge(old!, NOW)).toMatch(/^\d\d\.\d\d\.\d{4}$/);
  });

  it("the clipped floor's line is the drawn one", () => {
    expect(CLIPPED_RECORDS).toBe(
      "Added up, these go past the limit an opinion can reach, so the step carries the limit.",
    );
  });
});
