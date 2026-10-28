// YOUR TOPICS — the sidecar compiled line by line (YourTopics.md), plus the
// board's states (YourTopics.dc.html) and copy-voice's empty line. Which
// topics are held — the netted pair not (0, 0), a landed walk-back leaving —
// is the server's fold to test (`User.heldTopics`); the page's duty is to ask
// for the held set and draw it as served.

import { fireEvent, screen, within } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { byNode } from "@/test/data-node";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";

import { NO_TOPICS_YET, YourTopicsView } from "./your-topics-view";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

const server = startMswServer();

type Held = { name: string; d: number; i: number; pending?: boolean };

/** The board's five rows, strongest first by association. */
const BOARD: readonly Held[] = [
  { name: "saltmaps", d: 0.6, i: 0.35 },
  { name: "coastroad", d: 0.45, i: 0.7 },
  { name: "fieldnotes", d: 0.3, i: 0.15, pending: true },
  { name: "tidetables", d: 0.15, i: 0.5 },
  { name: "wellness", d: -0.65, i: -0.3 },
];

function edge(topic: Held) {
  return {
    __typename: "HeldTopicEdge",
    cursor: `c-${topic.name}`,
    pDirected: topic.d,
    pInterest: topic.i,
    pending: topic.pending ?? false,
    node: {
      __typename: "Hashtag",
      id: `t-${topic.name}`,
      name: { __typename: "ModeratedText", value: topic.name, status: "NORMAL" },
    },
  };
}

function page(topics: readonly Held[], next: string | null = null) {
  return {
    data: {
      me: {
        __typename: "User",
        id: "me",
        heldTopics: {
          __typename: "HeldTopicConnection",
          totalCount: topics.length,
          edges: topics.map(edge),
          pageInfo: { __typename: "PageInfo", hasNextPage: next !== null, endCursor: next },
        },
      },
    },
  };
}

function serve(topics: readonly Held[]) {
  const asked: unknown[] = [];
  server.use(
    gqlLink.query("HeldTopics", ({ variables }) => {
      asked.push(variables);
      return HttpResponse.json(page(topics));
    }),
  );
  return asked;
}

function signedIn() {
  const store = createTokenStore();
  store.save({ accessToken: "a", refreshToken: "r", accountId: "me" });
  return store;
}

const render = (from: string | null = null) =>
  renderWithProviders(<YourTopicsView from={from} />, { store: signedIn() });

const rowNames = () =>
  screen.getAllByTestId(byNode("yourTopics.row")).map((row) => row.getAttribute("data-testid-key"));

describe("Your topics", () => {
  it("your_topics_md_3_lists_every_topic_held_and_asks_with_pending_acts_in", async () => {
    const asked = serve(BOARD);
    render();
    await screen.findByTestId("your-topics-list");
    expect(rowNames()).toEqual(["saltmaps", "coastroad", "fieldnotes", "tidetables", "wellness"]);
    expect(asked).toEqual([{ after: null, includePending: true }]);
  });

  it("your_topics_md_9_a_topic_held_against_stands_like_any_other_with_no_mark_of_its_own", async () => {
    serve(BOARD);
    render();
    const against = await screen.findByTestId(byNode("yourTopics.row", "wellness"));
    const warm = screen.getByTestId(byNode("yourTopics.row", "saltmaps"));
    // The same parts, and nothing more: the feed's own filter is where it shows.
    const parts = (row: HTMLElement) =>
      Array.from(row.querySelectorAll("[data-testid]")).map((el) => el.getAttribute("data-testid")!.replace(/-wellness|-saltmaps/, ""));
    expect(parts(against)).toEqual(parts(warm));
  });

  it("your_topics_md_11_a_row_carries_the_mark_the_name_and_the_affinity_pair_signed", async () => {
    serve(BOARD);
    render();
    const row = await screen.findByTestId(byNode("yourTopics.row", "saltmaps"));
    expect(within(row).getByTestId(byNode("yourTopics.row.mark", "saltmaps"))).toHaveTextContent("#");
    expect(within(row).getByTestId(byNode("yourTopics.row.name", "saltmaps"))).toHaveTextContent("#saltmaps");
    const edgeOf = within(row).getByTestId(byNode("yourTopics.row.value", "saltmaps"));
    // The board's face, the digits as the geek reading, the word spoken with
    // the pair (copy-voice, *The readouts, spoken*).
    expect(within(edgeOf).getByText("😊")).toBeInTheDocument();
    expect(within(edgeOf).getByText("+0.60 / +0.35")).toHaveClass("cg-exact");
    expect(within(edgeOf).getByText("Like this, +0.60 / +0.35")).toHaveClass("sr-only");
    // The topic held against reads its own face, the minus a true minus.
    const against = screen.getByTestId(byNode("yourTopics.row.value", "wellness"));
    expect(within(against).getByText("Dislike, keep away, −0.65 / −0.30")).toBeInTheDocument();
  });

  it("your_topics_board_a_settling_act_wears_the_marker_under_its_pair", async () => {
    serve(BOARD);
    render();
    await screen.findByTestId("your-topics-list");
    const settling = screen.getByTestId(byNode("yourTopics.row.value", "fieldnotes"));
    expect(within(settling).getByTestId("yourTopics.row.value.pending")).toHaveTextContent("Still settling");
    const landed = screen.getByTestId(byNode("yourTopics.row.value", "saltmaps"));
    expect(within(landed).queryByTestId("yourTopics.row.value.pending")).toBeNull();
  });

  // Never erase silently: a held topic whose name moderation took away keeps
  // its row, drawn as the topic page draws a removed name — the `#` alone —
  // with its pair, and opening nothing (the name is the page's address).
  it("your_topics_a_held_topic_whose_name_was_removed_keeps_its_row_and_opens_nothing", async () => {
    server.use(
      gqlLink.query("HeldTopics", () => {
        const removed = edge({ name: "gone", d: 0.2, i: 0.4 });
        removed.node.id = "t-gone";
        removed.node.name = { __typename: "ModeratedText", value: null as unknown as string, status: "REDACTED" };
        return HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "me",
              heldTopics: {
                __typename: "HeldTopicConnection",
                totalCount: 2,
                edges: [edge(BOARD[0]!), removed],
                pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      }),
    );
    render();
    const row = await screen.findByTestId(byNode("yourTopics.row", "t-gone"));
    expect(rowNames()).toEqual(["saltmaps", "t-gone"]);
    expect(within(row).getByTestId(byNode("yourTopics.row.name", "t-gone")).textContent).toBe("#");
    expect(row.tagName).not.toBe("A");
    expect(within(row).queryByRole("link")).toBeNull();
    expect(within(row).getByTestId(byNode("yourTopics.row.value", "t-gone"))).toHaveTextContent("+0.20 / +0.40");
  });

  it("your_topics_md_13_rows_stand_strongest_first_as_served", async () => {
    // The order is the server's; a list served in any order is drawn in it.
    serve([BOARD[4]!, BOARD[0]!]);
    render();
    await screen.findByTestId("your-topics-list");
    expect(rowNames()).toEqual(["wellness", "saltmaps"]);
  });

  it("your_topics_md_15_a_row_offers_no_removal_of_its_own_and_opens_the_topics_page", async () => {
    serve(BOARD);
    render();
    const row = await screen.findByTestId(byNode("yourTopics.row", "saltmaps"));
    expect(row.tagName).toBe("A");
    expect(row).toHaveAttribute("href", "/topics/saltmaps?from=yourTopics");
    expect(within(row).queryByRole("button")).toBeNull();
    expect(screen.queryByRole("button", { name: /remove|walk/i })).toBeNull();
  });

  it("your_topics_md_19_the_word_follow_appears_nowhere", async () => {
    serve(BOARD);
    const { container } = render();
    await screen.findByTestId("your-topics-list");
    expect(container.textContent).not.toMatch(/follow/i);
  });

  it("your_topics_empty_says_the_copy_voice_line_and_no_follow", async () => {
    serve([]);
    const { container } = render();
    expect(await screen.findByTestId("yourTopics.empty")).toHaveTextContent(NO_TOPICS_YET);
    expect(container.textContent).not.toMatch(/follow/i);
  });

  it("your_topics_header_reads_the_title_and_back_to_explore_from_explore_and_a_cold_entry", async () => {
    serve(BOARD);
    render();
    const header = screen.getByTestId(byNode("yourTopics.header"));
    expect(within(header).getByRole("heading", { level: 1 })).toHaveTextContent("Your topics");
    const back = within(header).getByRole("link", { name: "Back to Explore" });
    expect(back).toHaveAttribute("href", "/explore");
    await screen.findByTestId("your-topics-list");
  });

  it("your_topics_back_names_the_feed_when_the_feed_filter_opened_it", async () => {
    serve(BOARD);
    render("feed");
    expect(screen.getByRole("link", { name: "Back to feed" })).toHaveAttribute("href", "/feed");
    await screen.findByTestId("your-topics-list");
  });

  it("your_topics_a_failed_read_says_the_house_line_with_retry", async () => {
    server.use(gqlLink.query("HeldTopics", () => HttpResponse.error()));
    render();
    expect(await screen.findByTestId("your-topics-transport-error")).toBeInTheDocument();
    serve(BOARD);
    fireEvent.click(screen.getByTestId("your-topics-retry"));
    await screen.findByTestId("your-topics-list");
    expect(rowNames()).toHaveLength(5);
  });
});
