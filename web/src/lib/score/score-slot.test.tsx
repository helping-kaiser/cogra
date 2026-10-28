// THE SCORE SLOT on every surface that wears it (FeedKinds.md:7-15;
// PostDetail.md:19; History.md:29, :61; Saved.md:13, :37; TagPage.md:23;
// ComposeLanded.md:5-7; score-readout §5.4 CD-SR5, §8).

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HttpResponse } from "msw/http";

import { createTokenStore } from "@/lib/session/token-store";
import { gqlLink, startMswServer } from "@/test/msw";
import { byNode } from "@/test/data-node";
import { renderWithProviders } from "@/test/providers";
import { topicCover } from "./cover";
import { ScoreSlot } from "./score-slot";
import { adoptTrace, forgetStandings, holdRanking } from "./standing";
import { forgetTrace, openTrace, type TraceOrigin } from "./trace-session";

function asReader(id: string | null) {
  const store = createTokenStore();
  if (id !== null) store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: id });
  return store;
}

function hold(reader: string | null, viewer: string, entries: [string, number][]) {
  holdRanking(
    reader,
    {
      asOfEpoch: 3,
      entries: entries.map(([targetId, score], newestIndex) => ({ targetId, kind: "POST", score, mark: null, newestIndex })),
      settling: [],
    },
    viewer,
  );
}

function slot(
  origin: TraceOrigin,
  { id = "p1", pending = false, detail = false, path = "history.card" }: { id?: string; pending?: boolean; detail?: boolean; path?: string } = {},
) {
  return (
    <ScoreSlot
      targetId={id}
      kind="post"
      pending={pending}
      cover={() => topicCover("held")}
      origin={origin}
      dashWhileSettling={detail}
      node={{ path: `${path}.actionRow.score`, key: id }}
      testId={`slot-${id}`}
    />
  );
}

/** Every standing read the slot could make; it must make none (FeedKinds.md:9). */
const asked: string[] = [];
startMswServer(
  gqlLink.query("FeedTrace", () => {
    asked.push("FeedTrace");
    return HttpResponse.json({ data: { feedTrace: null } });
  }),
  gqlLink.query("FeedRanking", () => {
    asked.push("FeedRanking");
    return HttpResponse.json({ data: { feedRanking: null } });
  }),
);

afterEach(() => {
  asked.length = 0;
  forgetStandings();
  forgetTrace();
});

describe("the score slot", () => {
  it("an_off_feed_card_looks_its_thing_up_in_the_last_feed_fetch", async () => {
    hold("u1", "u1", [["p1", 15.2]]);
    renderWithProviders(slot({ kind: "history" }), { store: asReader("u1") });
    const door = await screen.findByTestId(byNode("history.card.actionRow.score", "p1"));
    await waitFor(() => expect(screen.getByTestId(byNode("history.card.actionRow.score.value", "p1"))).toHaveTextContent("15.20"));
    expect(door).toHaveAccessibleName("Feed score 15.20");
    // History.md:61 — the trace's back arrow reads Back to History.
    expect(door).toHaveAttribute("href", "/trace/p1?from=history&kind=post");
  });

  it("an_off_feed_lookup_miss_reads_a_dash_whose_tap_opens_the_live_trace", async () => {
    hold("u1", "u1", [["p2", 1]]);
    renderWithProviders(slot({ kind: "saved" }, { path: "saved.card" }), { store: asReader("u1") });
    await waitFor(() => expect(screen.getByTestId(byNode("saved.card.actionRow.score.value", "p1"))).toHaveTextContent("—"));
    // Saved.md:37 — Back to Saved; no settling: the tap is the live fetch.
    expect(screen.getByTestId(byNode("saved.card.actionRow.score", "p1"))).toHaveAttribute(
      "href",
      "/trace/p1?from=saved&kind=post",
    );
  });

  it("a negative figure keeps its minus on the card, and no plus", async () => {
    hold("u1", "u1", [["p1", -2.5]]);
    renderWithProviders(slot({ kind: "history" }), { store: asReader("u1") });
    await waitFor(() => expect(screen.getByTestId(byNode("history.card.actionRow.score.value", "p1"))).toHaveTextContent("−2.50"));
  });

  it("the_detail_adopts_the_figure_its_trace_found, and an_adoption_shows_on_every_surface_rendering_that_thing", async () => {
    hold("u1", "u1", [["p1", 15.2]]);
    renderWithProviders(
      <>
        {slot({ kind: "post", postId: "p1", via: null }, { detail: true, path: "postDetail.card" })}
        {slot({ kind: "history" })}
      </>,
      { store: asReader("u1") },
    );
    await screen.findByTestId(byNode("postDetail.card.actionRow.score.value", "p1"));
    act(() => adoptTrace("p1", 14.7));
    expect(screen.getByTestId(byNode("postDetail.card.actionRow.score.value", "p1"))).toHaveTextContent("14.70");
    expect(screen.getByTestId(byNode("history.card.actionRow.score.value", "p1"))).toHaveTextContent("14.70");
    // after_a_no_paths_trace_the_card_reads_a_dash_and_still_opens_the_trace
    act(() => adoptTrace("p1", null));
    expect(screen.getByTestId(byNode("history.card.actionRow.score.value", "p1"))).toHaveTextContent("—");
    expect(screen.getByTestId(byNode("history.card.actionRow.score", "p1"))).toHaveAttribute("href");
  });

  it("a_card_slot_is_bare_only_for_settling — the detail reads the dash (ComposeLanded.md:5)", async () => {
    hold("u1", "u1", []);
    renderWithProviders(
      <>
        {slot({ kind: "feed" }, { pending: true, path: "feed.card" })}
        {slot({ kind: "post", postId: "p1", via: null }, { pending: true, detail: true, path: "postDetail.card" })}
      </>,
      { store: asReader("u1") },
    );
    const bare = await screen.findByTestId(byNode("feed.card.actionRow.score", "p1"));
    expect(screen.queryByTestId(byNode("feed.card.actionRow.score.value", "p1"))).not.toBeInTheDocument();
    expect(bare).toHaveAccessibleName("Feed score");
    expect(bare).toHaveAttribute("href", "/trace/p1?from=feed&kind=post&settling=1");
    expect(screen.getByTestId(byNode("postDetail.card.actionRow.score.value", "p1"))).toHaveTextContent("—");
  });

  it("the tap hands the trace the thing as the card holds it and the view its figure came from", async () => {
    hold("u1", "u-mira", [["p1", 15.2]]);
    renderWithProviders(slot({ kind: "history" }), { store: asReader("u1") });
    const door = await screen.findByTestId(byNode("history.card.actionRow.score", "p1"));
    fireEvent.click(door);
    const open = openTrace("p1");
    expect(open.viewer).toBe("u-mira");
    expect(open.cover?.title).toBe("#held");
    expect(open.read).toEqual({ kind: "idle" });
  });

  it("a_guest_off_feed_lookup_reads_the_genesis_vantage_feed", async () => {
    hold(null, "genesis-id", [["p1", 3.3]]);
    renderWithProviders(slot({ kind: "tag", name: "saltmaps" }, { path: "topic.card" }), { store: asReader(null) });
    await waitFor(() => expect(screen.getByTestId(byNode("topic.card.actionRow.score.value", "p1"))).toHaveTextContent("3.30"));
    fireEvent.click(screen.getByTestId(byNode("topic.card.actionRow.score", "p1")));
    expect(openTrace("p1").viewer).toBe("genesis-id");
  });

  it("nothing_rereads_one_cards_standing_in_the_background — the slot asks the server nothing", async () => {
    hold("u1", "u1", [["p1", 15.2]]);
    renderWithProviders(slot({ kind: "history" }), { store: asReader("u1") });
    await waitFor(() =>
      expect(screen.getByTestId(byNode("history.card.actionRow.score.value", "p1"))).toHaveTextContent("15.20"),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(asked).toEqual([]);
  });
});
