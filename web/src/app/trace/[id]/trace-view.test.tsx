// THE SCORE'S TRACE, compiled from its six sidecars line by line
// (FeedEntry.md, FeedEntryKinds.md, FeedEntryMoved.md, RankPath.md,
// RankHop.md, RankRecords.md) plus the data path the packet binds them to
// (score-readout §5.1 CD-SR1..CD-SR5, §9). Names follow the packet's list.
// The words' own arithmetic — titles per family, the add-up, the clip — is
// pinned on the model (`trace-model.test.ts`); here, what the screen draws
// and asks.

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { commentCover, personCover, postCover, topicCover, type TraceCover } from "@/lib/score/cover";
import { forgetStandings, holdRanking, standingOf } from "@/lib/score/standing";
import {
  ADA,
  MIRA,
  NOW,
  POST_CREATED,
  POST_ID,
  SOL,
  TOBIAS,
  borrowedAnswer,
  clippedAnswer,
  ownAnswer,
} from "@/lib/score/trace-fixtures";
import type { TraceAnswer, TracePerson, TraceThingKind } from "@/lib/score/trace-model";
import { beginTrace, forgetTrace, type TraceAddress, type TraceLevel } from "@/lib/score/trace-session";
import { byNode } from "@/test/data-node";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { TraceView } from "./trace-view";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

const PEOPLE: TracePerson[] = [SOL, ADA, TOBIAS, MIRA, ...["kel", "wren", "nadia", "juno"].map((h) => ({
  id: `u-${h}`,
  handle: h,
  displayName: h,
}))];

/** The answer as the wire carries it (`FeedTrace`). */
function wire(answer: TraceAnswer | null) {
  if (answer === null) return { feedTrace: null };
  return {
    feedTrace: {
      __typename: "FeedTrace",
      score: answer.score,
      paths: answer.paths.map((path) => ({
        __typename: "RankPath",
        nodes: path.nodes.map((node) => ({ __typename: "SliceNode", ...node })),
        sign: path.sign,
        contribution: path.contribution,
        hops: path.hops.map((hop) => ({
          __typename: "RankHop",
          pDirected: hop.pDirected,
          pInterest: hop.pInterest,
          records: hop.records.map((record) => ({
            __typename: "Record",
            id: record.id,
            family: record.family,
            authorId: record.author === null ? "addr:gone" : `addr:${record.author.id}`,
            author:
              record.author === null
                ? null
                : {
                    __typename: "User",
                    id: record.author.id,
                    handle: record.author.handle,
                    displayName: { __typename: "ModeratedText", value: record.author.displayName },
                  },
            targetId: null,
            terminalId: null,
            landedAt: record.landedAt,
            legs: record.legs.map((leg) => ({ __typename: "RecordLeg", ...leg })),
          })),
        })),
      })),
    },
  };
}

/** What the trace's reads were asked. */
type Asked = { traces: Record<string, unknown>[]; nodes: string[][] };

function traceHandlers(answer: TraceAnswer | null | "offline" | "internal", asked: Asked) {
  return [
    gqlLink.query("FeedTrace", ({ variables }) => {
      asked.traces.push(variables);
      if (answer === "offline") return HttpResponse.error();
      if (answer === "internal") {
        return HttpResponse.json({
          errors: [{ message: "the read failed", extensions: { code: "INTERNAL" } }],
          data: { feedTrace: null },
        });
      }
      return HttpResponse.json({ data: wire(answer) });
    }),
    gqlLink.query("TraceNodes", ({ variables }) => {
      const ids = variables.ids as string[];
      asked.nodes.push(ids);
      return HttpResponse.json({
        data: {
          nodes: ids.map((id) => {
            const person = PEOPLE.find((p) => p.id === id);
            return person === undefined
              ? null
              : {
                  __typename: "User",
                  id: person.id,
                  handle: person.handle,
                  displayName: { __typename: "ModeratedText", value: person.displayName },
                  avatar: null,
                };
          }),
        },
      });
    }),
    gqlLink.query("BorrowedView", () => HttpResponse.json({ data: { borrowedView: null } })),
  ];
}

const server = startMswServer();

function asReader(id: string) {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: id });
  return store;
}

function moderated(value: string | null) {
  return { value, status: "NORMAL" };
}

/** The cover a post card hands the trace on the tap. */
const POST_COVER: TraceCover = postCover({
  title: moderated("The long way home"),
  content: moderated("Took the coast road instead of the tunnel. Four hours longer, worth every minute."),
  description: moderated(null),
  author: { handle: "ada", displayName: { value: "Ada Lindqvist" }, avatar: null },
  attachments: [],
  attachmentsStatus: "NORMAL",
  moderationStatus: "NORMAL",
  removal: null,
  createdAt: POST_CREATED,
});

const FEED_ADDRESS: TraceAddress = { targetId: POST_ID, kind: "post", origin: { kind: "feed" }, settling: false };

function render(
  answer: TraceAnswer | null | "offline" | "internal",
  {
    level = { kind: "entry" },
    address = FEED_ADDRESS,
    reader = SOL.id,
    viewer = SOL.id,
    cover = POST_COVER,
  }: {
    level?: TraceLevel;
    address?: TraceAddress;
    reader?: string;
    viewer?: string | null;
    cover?: TraceCover | null;
  } = {},
) {
  const asked: Asked = { traces: [], nodes: [] };
  server.use(...traceHandlers(answer, asked));
  // THE TAP: the card hands its cover and the view its figure came from.
  beginTrace(address.targetId, cover, viewer);
  const view = renderWithProviders(<TraceView address={address} level={level} />, { store: asReader(reader) });
  return { asked, view };
}

const TITLES = ["Why this reached you", "One path", "One step", "What landed"];
const paths = () => screen.queryAllByTestId(byNode("feedEntry.path"));
const centsOf = (value: string) => Math.round(Number(value.replace("−", "-")) * 100);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  push.mockClear();
  forgetTrace();
  forgetStandings();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("FeedEntry.md — level one", () => {
  it("the_trace_lists_the_paths_strongest_first_each_with_what_it_adds", async () => {
    render(ownAnswer());
    await waitFor(() => expect(paths()).toHaveLength(4));
    expect(paths().map((row) => row.getAttribute("data-testid-key"))).toEqual(["1", "2", "3", "4"]);
    expect(screen.getAllByTestId(byNode("feedEntry.path.value")).map((v) => v.textContent)).toEqual([
      "+6.80",
      "+4.20",
      "+2.60",
      "+1.10",
    ]);
    expect(screen.getAllByTestId(byNode("feedEntry.path.through")).map((v) => v.textContent)).toEqual([
      "Through @ada",
      "Through @tobias",
      "Through @mira",
      "Through @kel and @wren",
    ]);
    expect(screen.getByTestId(byNode("feedEntry.pathsLabel"))).toHaveTextContent("Strongest first");
  });

  it("every_path_starts_at_the_snapshots_viewer — the reader's own note", async () => {
    const { asked } = render(ownAnswer());
    expect(await screen.findByTestId(byNode("feedEntry.note"))).toHaveTextContent(
      "Every path here starts with an opinion you gave.",
    );
    expect(asked.traces[0]).toEqual({ viewer: SOL.id, target: POST_ID });
  });

  it("a_borrowed_trace_names_the_lender_in_its_note", async () => {
    render(borrowedAnswer(), { viewer: MIRA.id });
    expect(await screen.findByTestId(byNode("feedEntry.note"))).toHaveTextContent(
      "Every path here starts with an opinion @mira gave.",
    );
  });

  it("a_borrowed_trace_leads_with_the_lenders_face_never_you", async () => {
    render(borrowedAnswer(), { viewer: MIRA.id });
    await waitFor(() => expect(paths()).toHaveLength(4));
    const first = screen.getAllByTestId(byNode("feedEntry.path.trace"))[0]!;
    expect(first).toHaveTextContent("@mira, then @ada, then what reached you");
    expect(document.body).not.toHaveTextContent(/You, then/);
  });

  it("the_strongest_four_stand_drawn_and_the_rest_ride_one_quiet_row", async () => {
    render(ownAnswer());
    const more = await screen.findByTestId(byNode("feedEntry.morePaths"));
    expect(more).toHaveAccessibleName("Show 2 more paths");
    expect(screen.getByTestId(byNode("feedEntry.morePaths.label"))).toHaveTextContent("2 more paths");
    expect(screen.getByTestId(byNode("feedEntry.morePaths.value"))).toHaveTextContent("+0.50");
  });

  it("the_drawn_paths_and_the_quiet_row_add_up_to_the_traces_own_score", async () => {
    render(ownAnswer());
    await screen.findByTestId(byNode("feedEntry.morePaths"));
    const drawn = screen.getAllByTestId(byNode("feedEntry.path.value")).map((v) => centsOf(v.textContent ?? ""));
    const more = centsOf(screen.getByTestId(byNode("feedEntry.morePaths.value")).textContent ?? "");
    const flag = centsOf(screen.getByTestId(byNode("feedEntry.origin.flag.value")).textContent ?? "");
    expect(drawn.reduce((a, b) => a + b, 0) + more).toBe(flag);
    expect(flag).toBe(1520);
  });

  it("a_trace_whose_figure_differs_from_the_cards_sums_to_its_own_figure", async () => {
    // The card wore 15.20 from the feed fetch; the live paths find 14.70.
    holdRanking(SOL.id, { asOfEpoch: 1, entries: [{ targetId: POST_ID, kind: "POST", score: 15.2, mark: null, newestIndex: 0 }], settling: [] }, SOL.id);
    const live = ownAnswer(14.7);
    render({ ...live, paths: live.paths.map((p, i) => (i === 0 ? { ...p, contribution: 6.3 } : p)) });
    expect(await screen.findByTestId(byNode("feedEntry.origin.flag.value"))).toHaveTextContent("+14.70");
    await waitFor(() => expect(paths()).toHaveLength(4));
    const drawn = screen.getAllByTestId(byNode("feedEntry.path.value")).map((v) => centsOf(v.textContent ?? ""));
    const more = centsOf(screen.getByTestId(byNode("feedEntry.morePaths.value")).textContent ?? "");
    expect(drawn.reduce((a, b) => a + b, 0) + more).toBe(1470);
    // the_card_adopts_the_figure_the_trace_found
    expect(standingOf(SOL.id, POST_ID, false)).toEqual({ kind: "figure", score: 14.7 });
  });

  it("the_quiet_row_unfolds_the_weakest_paths_in_place_never_a_second_page", async () => {
    const { asked } = render(ownAnswer());
    fireEvent.click(await screen.findByTestId(byNode("feedEntry.morePaths")));
    expect(paths()).toHaveLength(6);
    expect(screen.queryByTestId(byNode("feedEntry.morePaths"))).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(asked.traces).toHaveLength(1);
  });

  it("the_trace_draws_no_chart_bar_meter_percentage_or_trend", async () => {
    render(ownAnswer());
    await waitFor(() => expect(paths()).toHaveLength(4));
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    expect(screen.queryAllByRole("meter")).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/%|↑|↓|▲|▼/);
  });

  it("every_level_carries_the_cover_of_the_tapped_thing", async () => {
    const levels: TraceLevel[] = [
      { kind: "entry" },
      { kind: "path", path: 1 },
      { kind: "step", path: 1, step: 1 },
      { kind: "records", path: 1, step: 1 },
    ];
    // ONE MOUNT WALKED DOWN THE LEVELS, as the route's search params do.
    const asked: Asked = { traces: [], nodes: [] };
    server.use(...traceHandlers(ownAnswer(), asked));
    beginTrace(POST_ID, POST_COVER, SOL.id);
    function Walk() {
      const [at, setAt] = useState(0);
      return (
        <>
          <button type="button" data-testid="walk-down" onClick={() => setAt((i) => i + 1)} />
          <TraceView address={FEED_ADDRESS} level={levels[at]!} />
        </>
      );
    }
    renderWithProviders(<Walk />, { store: asReader(SOL.id) });
    for (const [index] of levels.entries()) {
      if (index > 0) fireEvent.click(screen.getByTestId("walk-down"));
      await waitFor(() => expect(screen.getByTestId(byNode("feedEntry.header.title"))).toHaveTextContent(TITLES[index]!));
      expect(await screen.findByTestId(byNode("feedEntry.origin.quote.title"))).toHaveTextContent(
        "The long way home — @ada",
      );
    }
    // the_trace_calls_once_and_the_deeper_levels_read_the_held_answer
    expect(asked.traces).toHaveLength(1);
  });
});

describe("FeedEntryKinds.md — one trace for every kind", () => {
  const covers: [TraceThingKind, TraceCover, string, string | null][] = [
    ["post", POST_COVER, "The long way home — @ada", "Took the coast road"],
    [
      "comment",
      commentCover({ content: moderated("Same road, other direction."), author: { handle: "tobias", displayName: { value: "Tobias" }, avatar: null } }),
      "@tobias",
      "Same road, other direction.",
    ],
    ["person", personCover({ handle: "mira", displayName: { value: "Mira Okafor" }, avatar: null }), "Mira Okafor", "@mira"],
    ["topic", topicCover("saltmaps"), "#saltmaps", null],
  ];

  it.each(covers)("every_kind_opens_the_same_four_levels — %s", async (kind, cover, title, snippet) => {
    render(ownAnswer(), { address: { ...FEED_ADDRESS, kind }, cover });
    // the_top_block_names_each_kind_in_its_own_words
    expect(await screen.findByTestId(byNode("feedEntry.origin.quote.title"))).toHaveTextContent(title);
    if (snippet === null) {
      expect(screen.queryByTestId(byNode("feedEntry.origin.quote.snippet"))).not.toBeInTheDocument();
    } else {
      expect(screen.getByTestId(byNode("feedEntry.origin.quote.snippet"))).toHaveTextContent(snippet);
    }
    await waitFor(() => expect(paths()).toHaveLength(4));
  });

  it("the_flag_wears_the_glyph_and_the_signed_figure, spoken Feed score", async () => {
    render(ownAnswer());
    const flag = await screen.findByTestId(byNode("feedEntry.origin.flag"));
    await waitFor(() => expect(within(flag).getByTestId(byNode("feedEntry.origin.flag.value"))).toHaveTextContent("+15.20"));
    // the_flag_is_spoken_feed_score
    expect(within(flag).getByText("Feed score")).toHaveClass("sr-only");
    expect(flag.querySelector("svg")).not.toBeNull();
  });

  it("the_trace_ends_on_the_things_own_mark_and_speaks_then_what_reached_you", async () => {
    render(ownAnswer());
    await waitFor(() => expect(paths()).toHaveLength(4));
    // the_path_trace_speaks_you_then_the_handle_then_what_reached_you
    expect(screen.getAllByTestId(byNode("feedEntry.path.trace"))[0]).toHaveTextContent(
      "You, then @ada, then what reached you",
    );
    // a_multi_hop_trace_speaks_several_steps
    expect(screen.getAllByTestId(byNode("feedEntry.path.trace"))[3]).toHaveTextContent(
      "You, then several steps, then what reached you",
    );
  });

  it("the_back_arrow_reads_back_to_feed_from_a_feed_card", async () => {
    render(ownAnswer());
    const back = await screen.findByTestId(byNode("feedEntry.header.back"));
    expect(back).toHaveAccessibleName("Back to feed");
    expect(back).toHaveAttribute("href", "/feed");
    expect(screen.getByTestId(byNode("feedEntry.header.title"))).toHaveTextContent("Why this reached you");
  });
});

describe("FeedEntryMoved.md — no paths, or still settling", () => {
  it("a_trace_whose_fetch_finds_no_paths_reads_the_moved_on_line_under_the_cover", async () => {
    render({ score: null, paths: [] });
    expect(await screen.findByTestId(byNode("feedEntry.note"))).toHaveTextContent(
      "The paths that carried it here have moved on.",
    );
    // a_trace_with_no_computed_figure_reads_a_dash_never_0_00
    expect(screen.getByTestId(byNode("feedEntry.origin.flag.value"))).toHaveTextContent("—");
    expect(document.body).not.toHaveTextContent("0.00");
    // an_absent_target_reads_the_moved_on_state_and_the_card_adopts_the_dash
    expect(standingOf(SOL.id, POST_ID, false)).toEqual({ kind: "dash" });
  });

  it("a_trace_with_no_paths_offers_no_action_and_draws_no_empty_state", async () => {
    render({ score: null, paths: [] });
    await screen.findByTestId(byNode("feedEntry.note"));
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByTestId(byNode("feedEntry.pathsLabel"))).not.toBeInTheDocument();
  });

  it("a_settling_trace_reads_still_settling_its_paths_count_once_it_lands, and makes no fetch", async () => {
    const { asked } = render(ownAnswer(), { address: { ...FEED_ADDRESS, settling: true } });
    expect(await screen.findByTestId(byNode("feedEntry.note"))).toHaveTextContent(
      "Still settling — its paths count once it lands.",
    );
    expect(screen.getByTestId(byNode("feedEntry.origin.flag.value"))).toHaveTextContent("—");
    // a_settling_trace_makes_no_fetch (a_settling_target_never_calls_the_ranker)
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(asked.traces).toHaveLength(0);
    expect(paths()).toHaveLength(0);
  });
});

describe("RankPath.md — one path", () => {
  const level: TraceLevel = { kind: "path", path: 1 };

  it("the_paths_facts_stand_before_its_steps, and the path states what it adds", async () => {
    render(ownAnswer(), { level });
    const adds = await screen.findByTestId(byNode("feedEntry.adds"));
    const stepsLabel = screen.getByTestId(byNode("feedEntry.stepsLabel"));
    expect(adds.compareDocumentPosition(stepsLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId(byNode("feedEntry.adds.value"))).toHaveTextContent("+6.80");
    expect(screen.getByTestId(byNode("feedEntry.header.title"))).toHaveTextContent("One path");
    expect(screen.getByTestId(byNode("feedEntry.header.back"))).toHaveAccessibleName("Back to the paths");
  });

  it("the_path_states_what_it_adds_and_no_step_carries_a_number", async () => {
    render(ownAnswer(), { level });
    const steps = await screen.findAllByTestId(byNode("feedEntry.step"));
    expect(steps).toHaveLength(2);
    for (const step of steps) expect(step.textContent).not.toMatch(/[+−]\d+\.\d\d/);
  });

  it("the_paths_newest_age_is_its_last_steps and the_authors_publish_is_a_step_aged_as_the_post", async () => {
    render(ownAnswer(), { level });
    expect(await screen.findByTestId(byNode("feedEntry.newest.value"))).toHaveTextContent("2h");
    const trailing = screen.getAllByTestId(byNode("feedEntry.step.trailing")).map((t) => t.textContent);
    // every_age_on_the_path_reads_the_ladder
    expect(trailing).toEqual(["8d", "2h"]);
    expect(screen.getAllByTestId(byNode("feedEntry.step.title")).map((t) => t.textContent)).toEqual([
      "Your opinion of @ada",
      "@ada published it",
    ]);
  });

  it("a_borrowed_step_reads_in_the_third_person", async () => {
    render(borrowedAnswer(), { level, viewer: MIRA.id });
    expect((await screen.findAllByTestId(byNode("feedEntry.step.title")))[0]).toHaveTextContent(
      "@mira's opinion of @ada",
    );
  });

  it("a step opens its own level", async () => {
    render(ownAnswer(), { level });
    const step = (await screen.findAllByTestId(byNode("feedEntry.step")))[0]!;
    expect(step.querySelector("a")).toHaveAttribute("href", "/trace/p-long-way?from=feed&kind=post&path=1&step=1");
  });
});

describe("RankHop.md — one step", () => {
  const level: TraceLevel = { kind: "step", path: 1, step: 1 };

  it("the_step_states_its_fold_its_record_count_and_its_newest_landing", async () => {
    render(ownAnswer(), { level });
    expect(await screen.findByTestId(byNode("feedEntry.carries.label"))).toHaveTextContent("What carries it");
    expect(screen.getByTestId(byNode("feedEntry.carries.value"))).toHaveAccessibleName(/\+0\.55 \/ \+0\.20/);
    expect(screen.getByTestId(byNode("feedEntry.behind.value"))).toHaveTextContent("2 opinions");
    expect(screen.getByTestId(byNode("feedEntry.newest.value"))).toHaveTextContent("8d");
    expect(screen.getByTestId(byNode("feedEntry.note"))).toHaveTextContent(
      "Your opinion of @ada — the first of this path's two steps.",
    );
    expect(screen.getByTestId(byNode("feedEntry.header.back"))).toHaveAccessibleName("Back to the path");
  });

  it("the_steps_value_is_the_fold_of_its_records — said in the reader's own word", async () => {
    render(ownAnswer(), { level });
    expect(await screen.findByTestId(byNode("feedEntry.foldNote"))).toHaveTextContent(
      "You have given @ada two opinions. They add up to one, and that one is what carries — the same adding up the pad shows you as your current opinion.",
    );
  });

  it("another_persons_fold_note_names_them_and_leaves_the_pad_out", async () => {
    render(borrowedAnswer(), { level, viewer: MIRA.id });
    expect(await screen.findByTestId(byNode("feedEntry.foldNote"))).toHaveTextContent(
      "@mira has given @ada two opinions. They add up to one, and that one is what carries.",
    );
  });

  it("a_clipped_step_says_it_carries_the_limit", async () => {
    render(clippedAnswer(), { level });
    expect(await screen.findByTestId(byNode("feedEntry.foldNote"))).toHaveTextContent(
      /Added up, they go past the limit an opinion can reach, so the step carries the limit\.$/,
    );
  });

  it("show_them_opens_the_records", async () => {
    render(ownAnswer(), { level });
    fireEvent.click(await screen.findByTestId(byNode("feedEntry.behind.action")));
    expect(push).toHaveBeenCalledWith("/trace/p-long-way?from=feed&kind=post&path=1&step=1&records=1");
  });
});

describe("RankRecords.md — what landed", () => {
  const level: TraceLevel = { kind: "records", path: 1, step: 1 };

  it("the_records_open_under_the_line_naming_their_step", async () => {
    render(ownAnswer(), { level });
    expect(await screen.findByTestId(byNode("feedEntry.note"))).toHaveTextContent(
      "The two records behind your opinion of @ada.",
    );
    expect(screen.getByTestId(byNode("feedEntry.header.back"))).toHaveAccessibleName("Back to the step");
    expect(screen.getByTestId(byNode("feedEntry.header.title"))).toHaveTextContent("What landed");
  });

  it("a record says what it is in its step's own title, its pair, its age and its key", async () => {
    render(ownAnswer(), { level });
    const records = await screen.findAllByTestId(byNode("feedEntry.record"));
    expect(records).toHaveLength(2);
    const [recent, old] = records;
    expect(within(recent!).getByTestId(byNode("feedEntry.record.what"))).toHaveTextContent("Your opinion of @ada");
    expect(within(recent!).getByTestId(byNode("feedEntry.record.when"))).toHaveTextContent("8d");
    // a_record_older_than_thirty_days_wears_a_date
    expect(within(old!).getByTestId(byNode("feedEntry.record.when")).textContent).toMatch(/^\d\d\.\d\d\.\d{4}$/);
    // a_record_states_its_key_in_mono_with_no_copy_control
    const key = within(recent!).getByTestId(byNode("feedEntry.record.key"));
    expect(key).toHaveClass("font-mono");
    expect(key).toHaveTextContent(recent!.getAttribute("data-testid-key")!);
    // a_record_row_is_inert
    expect(within(recent!).queryAllByRole("button")).toHaveLength(0);
    expect(within(recent!).queryAllByRole("link")).toHaveLength(0);
  });

  it("the_records_close_on_the_public_sum_line", async () => {
    render(ownAnswer(), { level });
    expect(await screen.findByTestId(byNode("feedEntry.closingNote"))).toHaveTextContent(
      "These records are public. Anyone can run the same sum and land on the same number.",
    );
    expect(screen.queryByTestId("feedEntry-clipped")).not.toBeInTheDocument();
  });

  it("past the limit the records say so, the unclipped sum in exact values beside the step's pair", async () => {
    render(clippedAnswer(), { level });
    expect(await screen.findByTestId("feedEntry-clipped")).toHaveTextContent(
      "Added up, these go past the limit an opinion can reach, so the step carries the limit.",
    );
    // the_unclipped_sum_reads_beside_the_pair_in_exact_mode
    const sum = screen.getByTestId("feedEntry-unclippedSum");
    expect(sum.querySelector(".cg-exact")).toHaveTextContent("+1.50 / +0.30 → +1.00 / +0.30");
  });

  it("pairs_follow_the_reading_mode_and_figures_keep_their_digits", async () => {
    render(ownAnswer(), { level });
    const pair = (await screen.findAllByTestId(byNode("feedEntry.record.pair.exact")))[0]!;
    expect(pair).toHaveClass("cg-exact");
    expect(screen.getByTestId(byNode("feedEntry.origin.flag.value"))).not.toHaveClass("cg-exact");
  });
});

describe("the data path (CD-SR1..CD-SR4)", () => {
  it("the_trace_read_carries_no_pin", async () => {
    const { asked } = render(ownAnswer());
    await waitFor(() => expect(asked.traces).toHaveLength(1));
    expect(Object.keys(asked.traces[0]!).sort()).toEqual(["target", "viewer"]);
  });

  it("a_trace_opened_before_the_hand_over_keeps_the_snapshots_viewer", async () => {
    // The reader is @sol, but the figure came from a feed borrowed from @mira.
    const { asked } = render(borrowedAnswer(), { viewer: MIRA.id });
    await waitFor(() => expect(asked.traces).toHaveLength(1));
    expect(asked.traces[0]!.viewer).toBe(MIRA.id);
  });

  it("a cold arrival asks for the feed's own viewer: the borrowed vantage, else the reader", async () => {
    const { asked } = render(ownAnswer(), { viewer: null, cover: null });
    await waitFor(() => expect(asked.traces).toHaveLength(1));
    expect(asked.traces[0]!.viewer).toBe(SOL.id);
    // The held thing is hydrated with the people when the tap handed no cover.
    expect(asked.nodes[0]).toContain(POST_ID);
  });

  it("a_trace_whose_ranking_fails_shows_the_house_line_and_retry — no answer", async () => {
    const { asked } = render("offline");
    expect(await screen.findByTestId("feedEntry-fault")).toHaveTextContent(
      "Can't reach the server. Check your connection and try again.",
    );
    // The cover stands and no figure is substituted.
    expect(screen.getByTestId(byNode("feedEntry.origin.quote.title"))).toBeInTheDocument();
    expect(screen.queryByTestId(byNode("feedEntry.origin.flag.value"))).not.toBeInTheDocument();
    server.use(...traceHandlers(ownAnswer(), asked));
    fireEvent.click(screen.getByTestId("feedEntry-retry"));
    await waitFor(() => expect(paths()).toHaveLength(4));
  });

  it("a_trace_whose_ranking_fails_shows_the_house_line_and_retry — INTERNAL", async () => {
    render("internal");
    expect(await screen.findByTestId("feedEntry-fault")).toHaveTextContent("That didn't go through. Try again.");
    expect(screen.getByTestId("feedEntry-retry")).toHaveTextContent("Retry");
  });

  it("no_score_surface_string_speaks_fetch", async () => {
    render(ownAnswer());
    await waitFor(() => expect(paths()).toHaveLength(4));
    expect(document.body.textContent).not.toMatch(/fetch/i);
  });
});
