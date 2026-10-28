// EXPLORE — the sidecars compiled line by line (Explore.md, ExploreSearch.md,
// ExploreFilter.md, ExploreNone.md, ExploreUnscoped.md, ExplorePerson.md).
// Each test names the line it carries. The search law itself — what matches,
// how the server sections and orders — is the server's to test
// (`crates/api/tests/search.rs`); the screen's duty is to ask with the
// reader's query and filter and to draw the answer as served.

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { delay } from "msw/utils/delay";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { readRecents, rememberSearch, RECENTS_KEPT, withRecent } from "@/lib/search/recents";
import { createTokenStore } from "@/lib/session/token-store";
import { CLEAR_SEARCH } from "@/lib/ui2/search-bar";
import { byNode } from "@/test/data-node";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import {
  ExploreView,
  EXPLORE_FIELD_NAME,
  HOW_SEARCHING_WORKS,
  LOADING_LADDER_MS,
  resetExploreMemory,
  SKY_TITLE,
} from "./explore-view";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

const server = startMswServer();

const NOW = Date.parse("2026-10-28T12:00:00Z");
const at = (hoursAgo: number) => new Date(NOW - hoursAgo * 3_600_000).toISOString();

const moderated = (value: string | null, status = "NORMAL") => ({ __typename: "ModeratedText", value, status });

function post(id: string, title: string, { hoursAgo = 72, cover = false, sensitive = false } = {}) {
  return {
    __typename: "Post",
    id,
    title: moderated(title),
    createdAt: at(hoursAgo),
    landing: { __typename: "Landing", state: "LANDED" },
    author: { __typename: "User", id: "u-sol", handle: "sol" },
    attachments: cover
      ? [
          {
            __typename: "MediaAttachment",
            id: `${id}-m`,
            url: `https://media.test/${id}.jpg`,
            status: "NORMAL",
            mimeType: "image/jpeg",
            coverMedia: null,
          },
        ]
      : [],
    attachmentsStatus: sensitive ? "SENSITIVE" : "NORMAL",
  };
}

function comment(id: string, words: string, rootTitle: string, hoursAgo = 2) {
  return {
    __typename: "Comment",
    id,
    content: moderated(words),
    createdAt: at(hoursAgo),
    landing: { __typename: "Landing", state: "LANDED" },
    post: { __typename: "Post", id: "p-root", title: { __typename: "ModeratedText", value: rootTitle } },
  };
}

function person(id: string, name: string, handle: string) {
  return {
    __typename: "User",
    id,
    handle,
    displayName: { __typename: "ModeratedText", value: name },
    avatar: null,
  };
}

function tag(name: string) {
  return { __typename: "Hashtag", id: `t-${name}`, name: { __typename: "ModeratedText", value: name } };
}

type Hit = { node: Record<string, unknown>; score?: number | null };

function answer(hits: readonly Hit[], { hasNextPage = false, hasMorePeople = false } = {}) {
  return {
    search: {
      __typename: "SearchConnection",
      edges: hits.map((hit, index) => ({
        __typename: "SearchEdge",
        cursor: `c${index}`,
        score: hit.score ?? null,
        node: hit.node,
      })),
      pageInfo: { __typename: "PageInfo", hasNextPage, endCursor: hasNextPage ? "next" : null },
      hasMorePeople,
    },
  };
}

type Ask = {
  query: string;
  kinds: string[] | null;
  includeSeen: boolean | null;
  order: string | null;
  viewer: string | null;
  after: string | null;
};

/** The search server, answering as the test says; returns the log of every ask. */
function serveSearch(respond: (ask: Ask) => ReturnType<typeof answer> | null | Promise<ReturnType<typeof answer> | null>) {
  const asks: Ask[] = [];
  server.use(
    gqlLink.query("Search", async ({ variables }) => {
      const ask: Ask = {
        query: variables.query as string,
        kinds: (variables.kinds as string[] | null | undefined) ?? null,
        includeSeen: (variables.includeSeen as boolean | null | undefined) ?? null,
        order: (variables.order as string | null | undefined) ?? null,
        viewer: (variables.viewer as string | null | undefined) ?? null,
        after: (variables.after as string | null | undefined) ?? null,
      };
      asks.push(ask);
      const data = await respond(ask);
      return data === null
        ? HttpResponse.json({ data: null, errors: [{ message: "down", extensions: { code: "INTERNAL" } }] })
        : HttpResponse.json({ data });
    }),
  );
  return asks;
}

function signedIn(account = "me") {
  const store = createTokenStore();
  store.save({ accessToken: "a", refreshToken: "r", accountId: account });
  return store;
}

function renderExplore(options: { guest?: boolean; initialQuery?: string | null; debounceMs?: number } = {}) {
  return renderWithProviders(
    <ExploreView initialQuery={options.initialQuery ?? null} debounceMs={options.debounceMs ?? 0} now={NOW} />,
    options.guest === true ? {} : { store: signedIn() },
  );
}

const field = () => screen.getByRole("searchbox", { name: EXPLORE_FIELD_NAME });
const type = (text: string) => fireEvent.change(field(), { target: { value: text } });

/** The result rows on screen, by their drawn name. */
function rowNames(): string[] {
  return screen.queryAllByTestId(byNode("explore.result.name")).map((element) => element.textContent ?? "");
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/explore");
  resetExploreMemory();
  server.use(
    gqlLink.query("NotificationBell", () =>
      HttpResponse.json({ data: { me: { __typename: "User", id: "me", hasUnreadNotifications: false } } }),
    ),
  );
});

describe("Explore at rest", () => {
  it("explore_md_3_at_rest_reads_field_sky_topics_then_recent", async () => {
    rememberSearch("me", "coast road");
    renderExplore();
    const order = [
      byNode("explore.searchField"),
      byNode("explore.skyCard"),
      byNode("explore.topics"),
      byNode("explore.recentLabel"),
    ].map((matcher) => screen.getByTestId(matcher));
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.getByTestId(byNode("explore.recentLabel"))).toHaveTextContent("Recent");
  });

  it("explore_md_5_the_sky_card_reads_coming_soon_and_opens_nothing", () => {
    renderExplore();
    const card = screen.getByTestId(byNode("explore.skyCard"));
    expect(within(card).getByTestId(byNode("explore.skyCard.title"))).toHaveTextContent(SKY_TITLE);
    expect(within(card).queryByRole("link")).toBeNull();
    expect(within(card).queryByRole("button")).toBeNull();
  });

  it("explore_md_7_9_typing_takes_the_screen_as_a_state_of_the_root", async () => {
    serveSearch(() => answer([{ node: post("p1", "Salt maps") }]));
    renderExplore();
    type("salt");
    expect(screen.queryByTestId(byNode("explore.skyCard"))).toBeNull();
    expect(screen.getByTestId(byNode("explore.filterTrigger"))).toBeInTheDocument();
    // Still the one route: the query rides the URL as a parameter of Explore.
    expect(window.location.pathname).toBe("/explore");
    expect(new URLSearchParams(window.location.search).get("q")).toBe("salt");
  });

  it("explore_md_9_the_first_keystroke_keeps_the_field_it_was_typed_into", () => {
    serveSearch(() => answer([]));
    renderExplore();
    const input = field();
    input.focus();
    type("s");
    expect(field()).toBe(input);
    expect(input).toHaveFocus();
  });

  it("explore_md_11_13_the_trailing_x_stands_only_with_text_and_brings_rest", async () => {
    serveSearch(() => answer([]));
    renderExplore();
    expect(screen.queryByRole("button", { name: CLEAR_SEARCH })).toBeNull();
    type("salt");
    fireEvent.click(screen.getByRole("button", { name: CLEAR_SEARCH }));
    expect(field()).toHaveValue("");
    expect(screen.getByTestId(byNode("explore.skyCard"))).toBeInTheDocument();
  });

  it("explore_md_15_back_mid_query_clears_to_rest_and_never_leaves_explore", async () => {
    serveSearch(() => answer([]));
    renderExplore();
    type("salt");
    // The browser's Back pops the one entry the search added.
    window.history.replaceState(null, "", "/explore");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(field()).toHaveValue("");
    expect(screen.getByTestId(byNode("explore.skyCard"))).toBeInTheDocument();
  });

  it("explore_md_17_an_emptied_field_returns_to_rest", async () => {
    serveSearch(() => answer([]));
    renderExplore();
    type("salt");
    type("");
    expect(screen.getByTestId(byNode("explore.skyCard"))).toBeInTheDocument();
  });

  it("explore_md_19_query_and_rows_stand_as_left_on_return", async () => {
    const asks = serveSearch(() => answer([{ node: post("p1", "Salt maps") }]));
    const first = renderExplore();
    type("salt");
    await waitFor(() => expect(rowNames()).toEqual(["Salt maps"]));
    first.unmount();
    renderExplore();
    expect(field()).toHaveValue("salt");
    expect(rowNames()).toEqual(["Salt maps"]);
    // A restore is not a refine: nothing new is asked.
    expect(asks).toHaveLength(1);
  });

  it("explore_md_21_23_opening_a_result_writes_the_query_on_the_device_only", async () => {
    serveSearch(() => answer([{ node: post("p1", "Salt maps") }]));
    renderExplore();
    type("Salt");
    await waitFor(() => expect(rowNames()).toEqual(["Salt maps"]));
    fireEvent.click(screen.getByTestId(byNode("explore.result", "1")));
    expect(readRecents("me")).toEqual(["Salt"]);
  });

  it("explore_md_25_the_action_key_dismisses_the_keyboard_and_keeps_the_query", async () => {
    const asks = serveSearch(() => answer([]));
    renderExplore();
    type("coast road");
    await waitFor(() => expect(asks).toHaveLength(1));
    field().focus();
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(field()).not.toHaveFocus();
    expect(readRecents("me")).toEqual(["coast road"]);
    // NEVER anything else happens: no further read.
    expect(asks).toHaveLength(1);
  });

  it("explore_md_27_ten_newest_first_and_a_query_met_again_moves_up_never_twice", () => {
    let list: readonly string[] = [];
    for (let i = 0; i < 12; i += 1) list = withRecent(list, `q${i}`);
    expect(list).toHaveLength(RECENTS_KEPT);
    expect(list[0]).toBe("q11");
    list = withRecent(list, "Q5");
    expect(list[0]).toBe("Q5");
    expect(list.filter((entry) => entry.toLowerCase() === "q5")).toHaveLength(1);
  });

  it("explore_md_29_33_a_recent_carries_no_x_and_a_tap_runs_it_again", async () => {
    const asks = serveSearch(() => answer([]));
    rememberSearch("me", "#saltmaps");
    renderExplore();
    const recent = screen.getByTestId(byNode("explore.recent", "saltmaps"));
    expect(within(recent).queryByRole("button")).toBeNull();
    fireEvent.click(recent);
    expect(field()).toHaveValue("#saltmaps");
    await waitFor(() => expect(asks.map((ask) => ask.query)).toEqual(["#saltmaps"]));
  });

  it("explore_md_31_recents_are_kept_per_account_and_a_guests_on_the_device_alone", () => {
    rememberSearch("me", "mine");
    rememberSearch("other", "theirs");
    rememberSearch(null, "a guest's");
    renderExplore();
    expect(screen.getByTestId(byNode("explore.recent", "mine"))).toBeInTheDocument();
    expect(screen.queryByTestId(byNode("explore.recent", "theirs"))).toBeNull();
    expect(screen.queryByTestId(byNode("explore.recent", "a-guest-s"))).toBeNull();
  });

  it("explore_md_35_37_a_guest_has_the_bare_band_and_no_your_topics", () => {
    renderExplore({ guest: true });
    expect(screen.queryByTestId(byNode("explore.band.bell"))).toBeNull();
    expect(screen.queryByTestId(byNode("explore.topics"))).toBeNull();
  });

  it("explore_md_41_your_topics_stands_as_a_door", () => {
    renderExplore();
    const door = screen.getByTestId(byNode("explore.topics"));
    expect(within(door).getByTestId(byNode("explore.topics.title"))).toHaveTextContent("Your topics");
    expect(within(door).getByTestId(byNode("explore.topics.chevron"))).toBeInTheDocument();
  });
});

describe("Explore searching", () => {
  it("explore_search_md_3_results_refine_as_the_reader_types_once_typing_settles", async () => {
    const asks = serveSearch((ask) => answer([{ node: post("p1", `${ask.query} maps`) }]));
    renderExplore({ debounceMs: 30 });
    type("s");
    type("sa");
    type("salt");
    await waitFor(() => expect(rowNames()).toEqual(["salt maps"]));
    expect(asks.map((ask) => ask.query)).toEqual(["salt"]);
  });

  it("explore_filter_md_7_15_explore_search_md_21_the_default_asks_every_kind_ranked_hiding_seen", async () => {
    const asks = serveSearch(() => answer([]));
    renderExplore();
    type("salt");
    await waitFor(() => expect(asks).toHaveLength(1));
    expect(asks[0]).toMatchObject({ kinds: null, order: "RANKED", includeSeen: false, viewer: "me" });
  });

  it("explore_search_md_5_7_13_ranked_rows_carry_their_rank_and_the_seam_stands_before_the_unscored", async () => {
    serveSearch(() =>
      answer([
        { node: post("p1", "Salt maps of the coast road", { cover: true }), score: 9.1 },
        { node: comment("c1", "The wax-stick ones", "Salt flats at first light"), score: 2.1 },
        { node: post("p4", "Salt rubbing", { hoursAgo: 24 * 400 }), score: null },
      ]),
    );
    renderExplore();
    type("@sol salt");
    await waitFor(() => expect(rowNames()).toHaveLength(3));
    expect(screen.getByTestId(byNode("explore.result.rank", "1"))).toHaveTextContent("9.10");
    expect(screen.getByTestId(byNode("explore.result.rank", "2"))).toHaveTextContent("2.10");
    // Past the seam the age replaces the rank, in the one ladder (:9).
    expect(screen.queryByTestId(byNode("explore.result.rank", "3"))).toBeNull();
    expect(screen.getByTestId(byNode("explore.result.value", "3"))).toHaveTextContent(/^\d\d\.\d\d\.\d{4}$/);
    const seam = screen.getByTestId(byNode("explore.seam", "content"));
    expect(seam).toHaveTextContent("Beyond your reach — newest first");
    const third = screen.getByTestId(byNode("explore.result", "3"));
    expect(seam.compareDocumentPosition(third) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("explore_search_md_11_a_tag_or_person_past_the_seam_carries_nothing_on_its_edge", async () => {
    serveSearch(() => answer([{ node: person("u1", "Sal Torres", "saltorres") }, { node: tag("saltmaps") }]));
    renderExplore();
    type("sal");
    await waitFor(() => expect(rowNames()).toHaveLength(2));
    for (const key of ["1", "2"]) {
      expect(screen.queryByTestId(byNode("explore.result.rank", key))).toBeNull();
      expect(screen.queryByTestId(byNode("explore.result.value", key))).toBeNull();
    }
  });

  it("explore_search_md_17_19_the_trigger_reads_everything_and_says_what_the_search_shows", async () => {
    serveSearch(() => answer([]));
    renderExplore();
    type("salt");
    const trigger = screen.getByTestId(byNode("explore.filterTrigger"));
    expect(trigger).toHaveTextContent("Everything");
    expect(trigger).toHaveAttribute("aria-label", "Everything, what the search shows");
  });

  it("explore_search_md_31_43_45_an_indirect_rows_second_line_names_what_it_was_found_through", async () => {
    serveSearch(() =>
      answer([{ node: tag("saltmaps"), score: 3.4 }, { node: comment("c1", "The wax-stick ones", "Salt flats"), score: 2.1 }]),
    );
    renderExplore();
    type("@sol salt");
    await waitFor(() => expect(rowNames()).toHaveLength(2));
    expect(screen.getByTestId(byNode("explore.result.sub", "1"))).toHaveTextContent("tagged by @sol");
    expect(screen.getByTestId(byNode("explore.result.sub", "2"))).toHaveTextContent("on Salt flats");
    // Search-into-a-thread: the comment opens its thread landed on it.
    expect(screen.getByTestId(byNode("explore.result", "2"))).toHaveAttribute(
      "href",
      "/posts/p-root?comment=c1&from=search",
    );
  });

  it("explore_search_md_49_a_sensitive_result_wears_the_text_tile_never_its_cover", async () => {
    serveSearch(() => answer([{ node: post("p1", "Salt", { cover: true, sensitive: true }), score: 1 }]));
    renderExplore();
    type("salt");
    await waitFor(() => expect(rowNames()).toEqual(["Salt"]));
    const mark = screen.getByTestId(byNode("explore.result.mark", "1"));
    expect(mark.querySelector("img")).toBeNull();
    expect(mark).toHaveTextContent("T");
  });

  it("explore_search_md_55_57_stale_rows_stay_readable_then_loading_shows_past_200ms", async () => {
    serveSearch(async (ask) => {
      if (ask.query === "salt flats") await delay(LOADING_LADDER_MS * 3);
      return answer([{ node: post("p1", `${ask.query} maps`) }]);
    });
    renderExplore();
    type("salt");
    await waitFor(() => expect(rowNames()).toEqual(["salt maps"]));
    type("salt flats");
    // Within the window the rows on screen stay and nothing says Loading.
    await new Promise((resolve) => setTimeout(resolve, LOADING_LADDER_MS / 2));
    expect(rowNames()).toEqual(["salt maps"]);
    expect(screen.queryByTestId("explore-loading")).toBeNull();
    expect(await screen.findByTestId("explore-loading")).toHaveTextContent("Loading…");
    await waitFor(() => expect(rowNames()).toEqual(["salt flats maps"]));
  });

  it("explore_search_md_59_63_a_failed_refine_keeps_the_rows_under_couldnt_load_more_and_retry_asks_again", async () => {
    let down = false;
    const asks = serveSearch((ask) => (down ? null : answer([{ node: post("p1", `${ask.query} maps`) }])));
    renderExplore();
    type("salt");
    await waitFor(() => expect(rowNames()).toEqual(["salt maps"]));
    down = true;
    type("salt flats");
    expect(await screen.findByTestId("explore-refine-failed")).toHaveTextContent("Couldn't load more");
    expect(rowNames()).toEqual(["salt maps"]);
    down = false;
    fireEvent.click(screen.getByTestId("explore-retry"));
    await waitFor(() => expect(rowNames()).toEqual(["salt flats maps"]));
    expect(asks.map((ask) => ask.query)).toEqual(["salt", "salt flats", "salt flats"]);
  });

  it("explore_search_md_61_a_failed_read_with_nothing_loaded_says_the_house_line_with_retry", async () => {
    serveSearch(() => null);
    renderExplore();
    type("salt");
    expect(await screen.findByTestId("explore-transport-error")).toHaveTextContent(
      "Can't reach the server. Check your connection and try again.",
    );
    expect(screen.getByTestId("explore-retry")).toHaveTextContent("Retry");
  });

  it("explore_search_md_65_a_guests_results_stand_newest_with_ages_no_rank_no_seam", async () => {
    const asks = serveSearch(() =>
      answer([{ node: post("p1", "Salt", { hoursAgo: 2 }) }, { node: tag("saltmaps") }]),
    );
    renderExplore({ guest: true });
    type("salt");
    await waitFor(() => expect(rowNames()).toHaveLength(2));
    expect(asks[0]).toMatchObject({ order: "NEWEST", viewer: null });
    expect(screen.getByTestId(byNode("explore.result.value", "1"))).toHaveTextContent("2h");
    expect(screen.queryByTestId(byNode("explore.result.value", "2"))).toBeNull();
    expect(screen.queryAllByTestId(byNode("explore.seam"))).toHaveLength(0);
    expect(screen.queryAllByTestId(byNode("explore.result.rank"))).toHaveLength(0);
  });

  it("explore_search_md_71_77_under_newest_no_seam_no_rank_and_ages_but_tags_and_people", async () => {
    window.localStorage.setItem(
      "cogra.explore.filter.me",
      JSON.stringify({ kinds: [], order: "newest", seen: false }),
    );
    const asks = serveSearch(() =>
      answer([
        { node: person("u1", "Sal Torres", "saltorres") },
        { node: tag("saltmaps") },
        { node: comment("c1", "The wax-stick ones", "Salt flats", 2) },
      ]),
    );
    renderExplore();
    type("sal");
    await waitFor(() => expect(rowNames()).toHaveLength(3));
    expect(asks[0]).toMatchObject({ order: "NEWEST" });
    expect(screen.queryAllByTestId(byNode("explore.seam"))).toHaveLength(0);
    expect(screen.queryByTestId(byNode("explore.result.value", "1"))).toBeNull();
    expect(screen.queryByTestId(byNode("explore.result.value", "2"))).toBeNull();
    expect(screen.getByTestId(byNode("explore.result.value", "3"))).toHaveTextContent("2h");
    // The trigger speaks the deviation from the reader's default (ExploreFilter.md:17).
    expect(screen.getByTestId(byNode("explore.filterTrigger"))).toHaveTextContent("Everything · newest");
  });

  it("explore_filter_md_39_no_result_is_marked_seen_by_standing_in_view", async () => {
    let marked = 0;
    server.use(
      gqlLink.mutation("MarkSeen", () => {
        marked += 1;
        return HttpResponse.json({ data: null });
      }),
    );
    serveSearch(() => answer([{ node: post("p1", "Salt"), score: 1 }]));
    renderExplore();
    type("salt");
    await waitFor(() => expect(rowNames()).toEqual(["Salt"]));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(marked).toBe(0);
  });

  it("opens_the_searching_help_by_its_own_name", async () => {
    serveSearch(() => answer([]));
    renderExplore();
    type("salt");
    fireEvent.click(screen.getByRole("button", { name: HOW_SEARCHING_WORKS }));
    expect(await screen.findByTestId("explore-help-dialog")).toBeInTheDocument();
  });
});

describe("the search filter sheet", () => {
  async function openSheet() {
    type("salt");
    fireEvent.click(screen.getByTestId(byNode("explore.filterTrigger")));
    return screen.getByTestId(byNode("explore.filterSheet"));
  }

  it("explore_filter_md_3_9_21_23_kinds_order_and_the_foot", async () => {
    serveSearch(() => answer([]));
    renderExplore();
    const sheet = await openSheet();
    const chips = within(sheet)
      .getAllByTestId(/^explore\.filterSheet\.kinds\.\w+Chip$/)
      .map((chip) => chip.textContent);
    expect(chips).toEqual(["Posts", "Comments", "Profiles", "Tags"]);
    expect(within(sheet).getByTestId(byNode("explore.filterSheet.order.picker.rankedOption"))).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const seen = within(sheet).getByRole("checkbox", { name: "Show what you've already seen" });
    expect(seen).not.toBeChecked();
    const foot = within(sheet).getByTestId(byNode("explore.filterSheet.foot"));
    expect(within(foot).getAllByRole("button").map((button) => button.textContent)).toEqual(["Reset", "Done"]);
  });

  it("explore_filter_md_5_25_33_chips_combine_stage_and_done_requeries_once", async () => {
    const asks = serveSearch(() => answer([]));
    renderExplore();
    const sheet = await openSheet();
    await waitFor(() => expect(asks).toHaveLength(1));
    fireEvent.click(within(sheet).getByTestId("explore.filterSheet.kinds.postsChip"));
    fireEvent.click(within(sheet).getByTestId("explore.filterSheet.kinds.topicsChip"));
    fireEvent.click(within(sheet).getByTestId(byNode("explore.filterSheet.order.picker.newestOption")));
    fireEvent.click(within(sheet).getByRole("checkbox", { name: "Show what you've already seen" }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    // Nothing behind the sheet moves before Done.
    expect(asks).toHaveLength(1);
    fireEvent.click(within(sheet).getByTestId(byNode("explore.filterSheet.foot.done")));
    await waitFor(() => expect(asks).toHaveLength(2));
    expect(asks[1]).toMatchObject({ kinds: ["POST", "HASHTAG"], order: "NEWEST", includeSeen: true });
    expect(screen.getByTestId(byNode("explore.filterTrigger"))).toHaveTextContent("2 kinds · newest · showing seen");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(asks).toHaveLength(2);
  });

  it("explore_filter_md_31_reset_stages_the_default_and_asks_nothing", async () => {
    const asks = serveSearch(() => answer([]));
    renderExplore();
    const sheet = await openSheet();
    await waitFor(() => expect(asks).toHaveLength(1));
    const posts = within(sheet).getByTestId("explore.filterSheet.kinds.postsChip");
    fireEvent.click(posts);
    expect(posts).toHaveAttribute("aria-checked", "true");
    fireEvent.click(within(sheet).getByTestId(byNode("explore.filterSheet.foot.reset")));
    expect(posts).toHaveAttribute("aria-checked", "false");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(asks).toHaveLength(1);
  });

  it("explore_filter_md_35_37_every_other_exit_drops_what_was_staged", async () => {
    const asks = serveSearch(() => answer([]));
    renderExplore();
    const sheet = await openSheet();
    await waitFor(() => expect(asks).toHaveLength(1));
    fireEvent.click(within(sheet).getByTestId("explore.filterSheet.kinds.postsChip"));
    fireEvent.keyDown(sheet, { key: "Escape" });
    fireEvent(sheet, new Event("cancel"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(asks).toHaveLength(1);
    expect(screen.getByTestId(byNode("explore.filterTrigger"))).toHaveTextContent("Everything");
  });

  it("explore_filter_md_41_a_guests_filter_carries_no_seen_toggle", async () => {
    serveSearch(() => answer([]));
    renderExplore({ guest: true });
    const sheet = await openSheet();
    expect(within(sheet).queryByRole("checkbox", { name: "Show what you've already seen" })).toBeNull();
  });
});

describe("nothing found, and comments without a scope", () => {
  it("explore_none_md_3_5_7_nothing_carries_that_name_until_a_name_does", async () => {
    serveSearch((ask) => (ask.query === "salt" ? answer([{ node: post("p1", "Salt maps") }]) : answer([])));
    renderExplore();
    type("@nobody brackish");
    expect(await screen.findByTestId(byNode("explore.empty.title"))).toHaveTextContent(
      "Nothing carries that name. Search reads names and titles, never bodies — fewer words reach further.",
    );
    type("salt");
    await waitFor(() => expect(rowNames()).toEqual(["Salt maps"]));
    expect(screen.queryByTestId(byNode("explore.empty"))).toBeNull();
  });

  function commentsOnly(kinds: string[]) {
    window.localStorage.setItem("cogra.explore.filter.me", JSON.stringify({ kinds, order: "ranked", seen: false }));
  }

  it("explore_unscoped_md_3_5_9_comments_alone_and_no_scope_say_the_way_and_stand_no_row", async () => {
    const asks = serveSearch(() => answer([{ node: post("p1", "never drawn") }]));
    commentsOnly(["comments"]);
    renderExplore();
    type("salt flats");
    expect(await screen.findByTestId(byNode("explore.empty.title"))).toHaveTextContent(
      "Found through people and tags — start with @handle or #tag.",
    );
    expect(rowNames()).toEqual([]);
    expect(screen.getByTestId(byNode("explore.filterTrigger"))).toHaveTextContent("Comments");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(asks).toHaveLength(0);
  });

  it("explore_unscoped_md_7_beside_another_kind_the_line_stands_after_the_last_row", async () => {
    serveSearch(() => answer([{ node: post("p1", "Salt flats") }]));
    commentsOnly(["posts", "comments"]);
    renderExplore();
    type("salt flats");
    await waitFor(() => expect(rowNames()).toEqual(["Salt flats"]));
    const line = screen.getByTestId(byNode("explore.empty"));
    const row = screen.getByTestId(byNode("explore.result", "1"));
    expect(row.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("explore_unscoped_md_11_a_scoped_query_replaces_the_line_with_the_comments", async () => {
    serveSearch(() => answer([{ node: comment("c1", "Wax sticks", "Salt flats"), score: 1 }]));
    commentsOnly(["comments"]);
    renderExplore();
    type("@sol salt");
    await waitFor(() => expect(rowNames()).toEqual(["Wax sticks"]));
    expect(screen.queryByTestId(byNode("explore.empty"))).toBeNull();
  });
});

describe("people in the results", () => {
  const PEOPLE = [
    { node: person("u1", "Sal Torres", "saltorres"), score: 4.2 },
    { node: person("u2", "Ines Salas", "inesalas"), score: 3.1 },
    { node: person("me", "Me Myself", "me"), score: 2.6 },
    { node: post("p1", "Salt maps of the coast road"), score: 9.1 },
  ];

  it("explore_person_md_3_7_19_people_first_under_profiles_then_the_door_then_content", async () => {
    serveSearch(() => answer(PEOPLE, { hasMorePeople: true }));
    renderExplore();
    type("sal");
    await waitFor(() => expect(rowNames()).toHaveLength(4));
    const label = screen.getByTestId(byNode("explore.profilesLabel"));
    expect(label).toHaveTextContent("Profiles");
    const door = screen.getByTestId(byNode("explore.profilesDoor"));
    expect(door).toHaveTextContent("See all profiles");
    const third = screen.getByTestId(byNode("explore.result", "3"));
    const fourth = screen.getByTestId(byNode("explore.result", "4"));
    expect(third.compareDocumentPosition(door) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(door.compareDocumentPosition(fourth) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The person row: display name over @handle, rank on the edge.
    expect(screen.getByTestId(byNode("explore.result.name", "1"))).toHaveTextContent("Sal Torres");
    expect(screen.getByTestId(byNode("explore.result.sub", "1"))).toHaveTextContent("@saltorres");
    expect(screen.getByTestId(byNode("explore.result.rank", "1"))).toHaveTextContent("4.20");
  });

  it("explore_person_md_9_no_door_when_three_or_fewer_match", async () => {
    serveSearch(() => answer(PEOPLE, { hasMorePeople: false }));
    renderExplore();
    type("sal");
    await waitFor(() => expect(rowNames()).toHaveLength(4));
    expect(screen.queryByTestId(byNode("explore.profilesDoor"))).toBeNull();
  });

  it("explore_person_md_13_15_the_door_narrows_to_profiles_alone_once", async () => {
    const asks = serveSearch((ask) =>
      ask.kinds?.join() === "USER" ? answer(PEOPLE.slice(0, 3)) : answer(PEOPLE, { hasMorePeople: true }),
    );
    renderExplore();
    type("sal");
    await waitFor(() => expect(rowNames()).toHaveLength(4));
    fireEvent.click(screen.getByTestId(byNode("explore.profilesDoor")));
    await waitFor(() => expect(asks).toHaveLength(2));
    expect(asks[1]).toMatchObject({ kinds: ["USER"], query: "sal" });
    await waitFor(() => expect(rowNames()).toHaveLength(3));
    expect(screen.getByTestId(byNode("explore.filterTrigger"))).toHaveTextContent("Profiles");
    expect(screen.queryByTestId(byNode("explore.profilesLabel"))).toBeNull();
    expect(screen.queryByTestId(byNode("explore.profilesDoor"))).toBeNull();
  });

  it("explore_person_md_23_25_a_person_opens_their_profile_with_the_way_back_and_the_reader_their_own", async () => {
    serveSearch(() => answer(PEOPLE));
    renderExplore();
    type("sal");
    await waitFor(() => expect(rowNames()).toHaveLength(4));
    expect(screen.getByTestId(byNode("explore.result", "1"))).toHaveAttribute("href", "/u/saltorres?from=search");
    expect(screen.getByTestId(byNode("explore.result", "3"))).toHaveAttribute("href", "/profile");
    expect(screen.getByTestId(byNode("explore.result", "4"))).toHaveAttribute("href", "/posts/p1?from=search");
  });
});
