// HISTORY, compiled from its six sidecars line by line (History.md,
// HistoryEmpty.md, HistoryFilter.md, HistoryHidden.md, HistoryNone.md,
// HistorySearch.md). Each test names the line(s) it holds; the lines another
// suite holds are named here once so the mapping is whole:
//
// - History.md:5-17, HistoryEmpty.md:9 (what joins History, the first seeing
//   only, never a record): the seen tracker — `seen-tracker.test.tsx`,
//   `seen-record.test.ts` — and the server (`crates/api/tests/view_history.rs`).
// - History.md:29, :61 (the card's score and its trace): the score slot waits
//   with every card's (`post-card.tsx`), so no card here draws one.
// - History.md:33, :43, :65-75 (the row's order, the veil, the stance hold):
//   the card masters' own suites (`post-card.test.tsx`,
//   `stance-control.test.tsx`, `comment-feed-card.test.ts`).
// - History.md:77-83 (one clip, the hard-top re-election): `StageHost`'s.
// - History.md:113-117 (Back to top): `collapsing-top.test.tsx`; here, only
//   that the header, field and trigger ride the collapsing top (:119).
// - History.md:121, HistoryNone.md:23, HistorySearch.md:45 (the lit slot):
//   `shell.test.tsx`.
// - History.md:89-101 (the matcher's law itself): the server's
//   (`crates/api/tests/view_history.rs`); the screen's duty is to ask with the
//   reader's query and draw the answer as served, which is pinned here.

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { PULL_THRESHOLD } from "@/lib/ui/pull-to-refresh";
import { ScrollHostProvider } from "@/lib/ui/scroll-host";
import { byNode } from "@/test/data-node";
import { hiddenHandlers, hiddenLog, hiddenPage } from "@/test/hidden";
import { intersect } from "@/test/media-env";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { stanceHandlers } from "@/test/stance";
import {
  HISTORY_EMPTY,
  HISTORY_NONE_KINDS,
  HISTORY_NONE_SEARCH,
  SEARCH_YOUR_HISTORY,
  SHOW_EVERYTHING,
  WHAT_YOUR_HISTORY_SHOWS,
  HistoryScreen,
} from "./history-view";

const push = vi.fn();
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

const server = startMswServer(...stanceHandlers());

beforeEach(() => push.mockReset());

const moderated = (value: string | null, status = "NORMAL") => ({
  __typename: "ModeratedText",
  value,
  status,
});

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const daysAgo = (days: number) => hoursAgo(days * 24);
/** A first seeing on a calendar day: `days` before today, at `hour` local — so a divider never flips at midnight. */
const seenOn = (days: number, hour: number) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, hour).toISOString();
};

function author(id: string, handle: string, name: string) {
  return {
    __typename: "User",
    id,
    handle,
    displayName: { __typename: "ModeratedText", value: name },
    avatar: null,
  };
}

function postNode(id: string, title: string | null, writtenDaysAgo = 1, by = author("u1", "ada", "Ada"), removed = false) {
  return {
    __typename: "Post",
    id,
    title: removed ? moderated(null, "REDACTED") : moderated(title),
    description: moderated(null),
    content: removed ? moderated(null, "REDACTED") : moderated(`${title ?? "Untitled"} words`),
    attachments: [],
    attachmentsStatus: "NORMAL",
    author: by,
    createdAt: daysAgo(writtenDaysAgo),
    updatedAt: daysAgo(writtenDaysAgo),
    landing: { __typename: "Landing", state: "LANDED" },
    moderationStatus: "NORMAL",
    // The node's own mark (api-spec.md `Post.removal`) — what the card's
    // RedactedContent reads its wording and its moment off.
    removal: removed ? { __typename: "Removal", at: hoursAgo(0.3), by: "AUTHOR" } : null,
    genesisRecordId: `rec-${id}`,
    license: { __typename: "License", attribution: 0, provenance: 0 },
    topics: [],
    references: [],
    viewerBookmarkedAt: null,
    comments: { __typename: "CommentConnection", totalCount: 0 },
  };
}

function commentNode(id: string, by = author("u2", "tobias", "Tobias")) {
  return {
    __typename: "Comment",
    id,
    content: moderated("The third headland light is real"),
    attachments: [],
    attachmentsStatus: "NORMAL",
    author: by,
    createdAt: hoursAgo(1),
    updatedAt: hoursAgo(1),
    landing: { __typename: "Landing", state: "LANDED" },
    moderationStatus: "NORMAL",
    removal: null,
    genesisRecordId: `rec-${id}`,
    license: { __typename: "License", attribution: 0, provenance: 0 },
    topics: [],
    references: [],
    viewerBookmarkedAt: null,
    target: {
      __typename: "Post",
      id: "p1",
      title: moderated("The long way home"),
      content: moderated("words"),
      attachments: [],
      author: { __typename: "User", id: "u1", handle: "ada" },
      moderationStatus: "NORMAL",
      removal: null,
    },
    post: { __typename: "Post", id: "p1" },
  };
}

function personNode(id: string, handle: string, name: string) {
  return {
    __typename: "User",
    id,
    handle,
    displayName: moderated(name),
    bio: moderated("Runs the stand by the sea wall."),
    avatar: null,
    viewerBookmarkedAt: null,
  };
}

function tagNode(id: string, name: string, tagged = true) {
  return {
    __typename: "Hashtag",
    id,
    name: moderated(name),
    taggedContent: tagged
      ? [
          {
            __typename: "TaggedContent",
            node: {
              __typename: "Post",
              id: "p7",
              title: moderated("Low tide at six tomorrow"),
              content: moderated("words"),
              attachments: [],
              author: { __typename: "User", id: "u2", handle: "tobias" },
              createdAt: hoursAgo(2),
            },
          },
          {
            __typename: "TaggedContent",
            node: {
              __typename: "Comment",
              id: "c7",
              content: moderated("Low tide is kinder to the rubbings"),
              author: { __typename: "User", id: "u1", handle: "ada" },
              createdAt: daysAgo(4),
            },
          },
        ]
      : [],
  };
}

type Entry = { node: Record<string, unknown>; firstSeenAt: string };

function page(
  entries: readonly Entry[],
  next: { hasNextPage: boolean; endCursor: string | null } = { hasNextPage: false, endCursor: null },
  more: { people?: boolean; tags?: boolean } = {},
) {
  return {
    me: {
      __typename: "User",
      id: "me",
      viewHistory: {
        __typename: "ViewHistoryConnection",
        edges: entries.map((entry, index) => ({
          __typename: "ViewHistoryEdge",
          cursor: `c${index}`,
          firstSeenAt: entry.firstSeenAt,
          node: entry.node,
        })),
        pageInfo: { __typename: "PageInfo", ...next },
        hasMorePeople: more.people ?? false,
        hasMoreTags: more.tags ?? false,
      },
    },
  };
}

const COMMENT: Entry = { node: commentNode("c1"), firstSeenAt: seenOn(0, 11) };
// Written a week ago, first seen today: its own age reads 7d.
const POST: Entry = { node: postNode("p1", "The long way home", 7), firstSeenAt: seenOn(0, 10) };
const PERSON: Entry = { node: personNode("u3", "mira", "Mira Voss"), firstSeenAt: seenOn(1, 12) };
const TAG: Entry = { node: tagNode("t1", "saltmaps"), firstSeenAt: seenOn(1, 9) };
const OLD: Entry = { node: postNode("p2", "Three mornings on the wall", 30), firstSeenAt: seenOn(26, 12) };
const ALL: Entry[] = [COMMENT, POST, PERSON, TAG, OLD];
const ALL_CARDS = [
  "history.commentCard:c1",
  "history.card:p1",
  "history.profileCard:u3",
  "history.tagCard:t1",
  "history.card:p2",
];

function signedIn() {
  const store = createTokenStore();
  store.save({ accessToken: "a", refreshToken: "r", accountId: "me" });
  return store;
}

/** One `HistoryPage` read, as the screen sent it. */
type Read = { query: string | null; kinds: string[] | null; after: string | null };

/**
 * History's server, narrowing the way the test says it answers — the law
 * itself is the server's to test; the screen's duty is to ask with the
 * reader's narrowing and draw the answer as served. Returns every read.
 */
function serveHistory(answer: (read: Read) => ReturnType<typeof page> | null) {
  const reads: Read[] = [];
  server.use(
    gqlLink.query("HistoryPage", ({ variables }) => {
      const read = {
        query: (variables.query as string | null | undefined) ?? null,
        kinds: (variables.kinds as string[] | null | undefined) ?? null,
        after: (variables.after as string | null | undefined) ?? null,
      };
      reads.push(read);
      const data = answer(read);
      return data === null
        ? HttpResponse.json({ data: null, errors: [{ message: "down", extensions: { code: "INTERNAL" } }] })
        : HttpResponse.json({ data });
    }),
  );
  return reads;
}

/** The cards on screen, in order, by the kind's name and key. */
function cards() {
  const list = screen.queryByTestId("history-list");
  if (list === null) return [];
  return within(list)
    .queryAllByTestId(/^history\.(card|commentCard|profileCard|tagCard)$/)
    .map((card) => `${card.getAttribute("data-testid")}:${card.getAttribute("data-testid-key")}`);
}

/** What the list stands, dividers and captions included, in order. */
function rows() {
  return within(screen.getByTestId("history-list"))
    .queryAllByTestId(/^history\.(card|commentCard|profileCard|tagCard|day|profilesLabel|tagsLabel|profilesDoor|tagsDoor)$/)
    .map((row) => {
      const id = row.getAttribute("data-testid");
      const key = row.getAttribute("data-testid-key");
      return key === null ? id : `${id}:${key}`;
    });
}

function search(query: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: SEARCH_YOUR_HISTORY }), { target: { value: query } });
}

const trigger = () => screen.getByTestId("history.filterTrigger");
const sheet = () => screen.getByTestId("history.filterSheet") as HTMLDialogElement;
const chip = (kind: string) => screen.getByTestId(`history.filterSheet.kinds.${kind}Chip`);

function render(options: { debounce?: number } = {}) {
  return renderWithProviders(<HistoryScreen searchDebounceMs={options.debounce ?? 0} />, { store: signedIn() });
}

describe("History — the seen-list as a feed (History.md)", () => {
  it("history_is_a_feed_of_every_kind_each_as_its_own_feed_card_newest_seen_first", async () => {
    // History.md:3, :19, :21, :23.
    serveHistory(() => page(ALL));
    render();
    await screen.findByTestId("history-list");
    expect(cards()).toEqual(ALL_CARDS);
    // Each card is the feed's own, live.
    expect(screen.getByTestId(byNode("history.card.title", "p1"))).toHaveTextContent("The long way home");
    expect(screen.getByTestId(byNode("history.card.actionRow.stance", "p1"))).toBeInTheDocument();
    expect(screen.getByTestId("history-comment-c1-head-title")).toHaveTextContent("The long way home");
    expect(screen.getByTestId(byNode("history.profileCard.name", "u3"))).toHaveTextContent("Mira Voss");
    expect(screen.getByTestId(byNode("history.tagCard.name", "t1"))).toHaveTextContent("#saltmaps");
  });

  it("a_quiet_day_divider_stands_above_the_first_thing_seen_each_day_and_belongs_to_the_list", async () => {
    // History.md:25, :27.
    serveHistory(() => page(ALL));
    render();
    await screen.findByTestId("history-list");
    const old = new Date(Date.parse(OLD.firstSeenAt));
    const month = old.toLocaleString("en-GB", { month: "long" });
    const year = old.getFullYear() === new Date().getFullYear() ? "" : `-${old.getFullYear()}`;
    expect(rows()).toEqual([
      "history.day:today",
      "history.commentCard:c1",
      "history.card:p1",
      "history.day:yesterday",
      "history.profileCard:u3",
      "history.tagCard:t1",
      `history.day:${old.getDate()}-${month.toLowerCase()}${year}`,
      "history.card:p2",
    ]);
    const today = screen.getByTestId(byNode("history.day", "today"));
    expect(today).toHaveTextContent("Today");
    expect(today).toHaveAttribute("role", "heading");
    expect(today.className).toContain("text-label-small");
    // Never part of a card.
    expect(today.closest("section")).toBeNull();
  });

  it("a_card_carries_no_age_of_the_seeing_only_its_own", async () => {
    // History.md:31.
    serveHistory(() => page([POST]));
    render();
    await screen.findByTestId("history-list");
    expect(screen.getByTestId(byNode("history.card.timestamp", "p1"))).toHaveTextContent("7d");
  });

  it("a_comment_card_carries_no_view_replies_line", async () => {
    // History.md:35, :37.
    serveHistory(() => page([COMMENT]));
    render();
    await screen.findByTestId("history-list");
    expect(within(screen.getByTestId(byNode("history.commentCard", "c1"))).queryByText(/View .* repl/)).toBeNull();
  });

  it("a_thing_removed_after_it_was_seen_keeps_its_place_wearing_its_mark", async () => {
    // History.md:39: the card's own removal mark, in its place.
    const removed: Entry = { node: postNode("p9", "Gone", 2, undefined, true), firstSeenAt: hoursAgo(0.55) };
    serveHistory(() => page([COMMENT, removed, POST]));
    render();
    await screen.findByTestId("history-list");
    expect(cards()).toEqual(["history.commentCard:c1", "history.card:p9", "history.card:p1"]);
    // The mark is the card's own part, `<card>.removed` with its line and its
    // moment (the evident path while Removed is unregistered).
    expect(screen.getByTestId(byNode("history.card.removed", "p9"))).toHaveTextContent("Removed by its author");
    expect(screen.getByTestId(byNode("history.card.removed.when", "p9"))).toHaveTextContent("18m");
  });

  it("the_readers_own_removal_from_a_cards_menu_leaves_it_in_place_wearing_its_mark", async () => {
    // History.md:39 with RM-G9's build word: removed from History's own ⋮,
    // the card stands as its mark where it stood. The removal answers here.
    const mine: Entry = { node: postNode("p5", "Mine", 1, author("me", "me", "Me")), firstSeenAt: hoursAgo(0.5) };
    serveHistory(() => page([COMMENT, mine, POST]));
    server.use(
      gqlLink.mutation("RemoveContent", () =>
        HttpResponse.json({
          data: { removeContent: { __typename: "RemoveContentPayload", records: [], userErrors: [] } },
        }),
      ),
      gqlLink.query("PostRemoval", ({ variables }) =>
        HttpResponse.json({
          data: {
            post: { __typename: "Post", id: variables.id, removal: { __typename: "Removal", at: hoursAgo(0), by: "AUTHOR" } },
          },
        }),
      ),
    );
    render();
    await screen.findByTestId("history-list");
    fireEvent.click(screen.getByTestId(byNode("history.card.menu", "p5")));
    fireEvent.click(screen.getByTestId("history-menu-remove"));
    fireEvent.click(await screen.findByTestId("history-menu-remove-confirm-remove"));
    expect(await screen.findByTestId(byNode("history.card.removed", "p5"))).toHaveTextContent("Removed by its author");
    expect(cards()).toEqual(["history.commentCard:c1", "history.card:p5", "history.card:p1"]);
  });

  it("a_hidden_accounts_posts_and_comments_stay_out_and_its_profile_card_stays", async () => {
    // History.md:41: the server keeps them out; a hide the server has not
    // taken yet is honoured by the device's own set at the read.
    serveHistory(() => page([COMMENT, POST, { node: personNode("u1", "ada", "Ada"), firstSeenAt: daysAgo(1) }]));
    server.use(
      gqlLink.query("HiddenActorsPage", () =>
        HttpResponse.json(hiddenPage([{ id: "u1", handle: "ada", displayName: "Ada", hiddenAt: daysAgo(0.1) }])),
      ),
    );
    render();
    await waitFor(() => expect(cards()).toEqual(["history.commentCard:c1", "history.profileCard:u1"]));
  });

  it("history_offers_no_way_to_clear_and_no_way_to_remove_one_thing", async () => {
    // History.md:45.
    serveHistory(() => page(ALL));
    render();
    await screen.findByTestId("history-list");
    expect(screen.queryByRole("button", { name: /clear/i })).toBeNull();
    fireEvent.click(screen.getByTestId(byNode("history.card.menu", "p1")));
    const menu = within(screen.getByTestId("history-menu-sheet")).getAllByRole("button");
    expect(menu.map((row) => row.textContent)).not.toContainEqual(expect.stringMatching(/history/i));
  });

  it("every_cards_doors_land_as_the_feeds_do_their_back_arrow_reading_back_to_history", async () => {
    // History.md:47, :49, :51, :53, :55, :57.
    serveHistory(() => page(ALL));
    render();
    await screen.findByTestId("history-list");
    expect(screen.getByTestId("history-comment-c1-head")).toHaveAttribute("href", "/posts/p1?from=history");
    expect(screen.getByTestId("history-comment-c1-link")).toHaveAttribute(
      "href",
      "/posts/p1?comment=c1&from=history",
    );
    expect(screen.getByTestId("history-comment-c1-reply")).toHaveAttribute(
      "href",
      "/posts/p1?comment=c1&from=history&reply=1",
    );
    expect(screen.getByTestId("history-post-p1-link")).toHaveAttribute("href", "/posts/p1?from=history");
    expect(screen.getByTestId("history-person-u3-link")).toHaveAttribute("href", "/u/mira?from=history");
    expect(screen.getByTestId("history-tag-t1-link")).toHaveAttribute("href", "/topics/saltmaps?from=history");
  });

  it("a_tag_card_reaching_the_reader_through_no_one_stands_no_through_line", async () => {
    // History.md:59.
    serveHistory(() => page([TAG]));
    render();
    await screen.findByTestId("history-list");
    expect(screen.queryByTestId(byNode("history.tagCard.through", "t1"))).toBeNull();
    // The glimpse names the newest tagged thing over its author, and counts the rest.
    expect(screen.getByTestId(byNode("history.tagCard.glimpse.newest", "t1"))).toHaveTextContent(
      "Low tide at six tomorrow",
    );
    expect(screen.getByTestId(byNode("history.tagCard.glimpse.by", "t1"))).toHaveTextContent("@tobias · and 1 more");
    expect(screen.getByTestId(byNode("history.tagCard.timestamp", "t1"))).toHaveTextContent("2h");
  });

  it("tag_a_new_post_with_it_opens_the_composer_with_the_tag_staged", async () => {
    // History.md:63, and the row's order: opinion, the act, share (History.md:33).
    serveHistory(() => page([TAG]));
    render();
    await screen.findByTestId("history-list");
    const row = screen.getByTestId(byNode("history.tagCard.actionRow", "t1"));
    const parts = Array.from(row.querySelectorAll("[data-testid^='history.tagCard.actionRow.']"))
      .map((element) => element.getAttribute("data-testid"))
      .filter((id) => id !== null && /actionRow\.(stance|compose|share)$/.test(id));
    expect(parts[0]).toBe("history.tagCard.actionRow.stance");
    expect(parts[1]).toBe("history.tagCard.actionRow.compose");
    const compose = screen.getByTestId(byNode("history.tagCard.actionRow.compose", "t1"));
    expect(compose).toHaveAccessibleName("Tag a new post with it");
    fireEvent.click(compose);
    expect(push).toHaveBeenCalledWith("/compose?tag=saltmaps");
  });

  it("an_empty_tag_keeps_its_card_and_its_glimpse_reads_one_quiet_line", async () => {
    serveHistory(() => page([{ node: tagNode("t2", "mudflats", false), firstSeenAt: hoursAgo(1) }]));
    render();
    await screen.findByTestId("history-list");
    expect(screen.getByTestId(byNode("history.tagCard.nothing", "t2"))).toHaveTextContent(
      "Nothing carries this tag right now.",
    );
    expect(screen.queryByTestId(byNode("history.tagCard.timestamp", "t2"))).toBeNull();
  });

  it("the_field_reads_search_your_history_and_the_trigger_everything_at_rest", async () => {
    // History.md:85, :105.
    serveHistory(() => page(ALL));
    render();
    await screen.findByTestId("history-list");
    const field = screen.getByRole("searchbox", { name: SEARCH_YOUR_HISTORY });
    expect(field).toHaveAttribute("placeholder", SEARCH_YOUR_HISTORY);
    expect(screen.getByTestId("history.searchField")).toBeInTheDocument();
    expect(trigger()).toHaveTextContent("Everything");
    expect(trigger()).toHaveAccessibleName("Everything, what your history shows");
  });

  it("tapping_the_trigger_opens_the_historys_filter_sheet_over_history", async () => {
    // History.md:107; HistoryNone.md:17; HistorySearch.md:39.
    serveHistory(() => page(ALL));
    render();
    await screen.findByTestId("history-list");
    fireEvent.click(trigger());
    expect(sheet().open).toBe(true);
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("history-list")).toBeInTheDocument();
  });

  it("the_order_stands_frozen_while_scrolling_and_the_next_page_continues_it", async () => {
    // History.md:109: the next page continues the open list; nothing moves.
    const later: Entry = { node: postNode("p8", "Later", 40), firstSeenAt: daysAgo(27) };
    const reads = serveHistory(({ after }) =>
      after === null ? page(ALL, { hasNextPage: true, endCursor: "c4" }) : page([later]),
    );
    const scroller = document.createElement("div");
    document.body.append(scroller);
    renderWithProviders(
      <ScrollHostProvider value={{ current: scroller }}>
        <HistoryScreen searchDebounceMs={0} />
      </ScrollHostProvider>,
      { store: signedIn() },
    );
    await screen.findByTestId("history-list");
    intersect(true);
    await waitFor(() => expect(cards()).toEqual([...ALL_CARDS, "history.card:p8"]));
    expect(reads.at(-1)).toEqual({ query: null, kinds: null, after: "c4" });
    scroller.remove();
  });

  it("pull_down_at_the_top_re_reads_history", async () => {
    // History.md:111; HistoryHidden.md:7's way in.
    let reads = 0;
    server.use(
      gqlLink.query("HistoryPage", () => {
        reads += 1;
        return HttpResponse.json({ data: page(ALL) });
      }),
    );
    const scroller = document.createElement("div");
    document.body.append(scroller);
    renderWithProviders(
      <ScrollHostProvider value={{ current: scroller }}>
        <HistoryScreen />
      </ScrollHostProvider>,
      { store: signedIn() },
    );
    await screen.findByTestId("history-list");
    expect(reads).toBe(1);
    pull(scroller);
    await waitFor(() => expect(reads).toBe(2));
    scroller.remove();
  });

  it("the_header_the_field_and_the_trigger_ride_the_collapsing_top", async () => {
    // History.md:119.
    serveHistory(() => page(ALL));
    render();
    await screen.findByTestId("history-list");
    const top = screen.getByTestId("collapsing-top");
    expect(top).toContainElement(screen.getByTestId("history.header"));
    expect(top).toContainElement(screen.getByTestId("history.searchField"));
    expect(top).toContainElement(trigger());
  });

  it("the_back_arrow_reads_back_to_your_profile_and_returns_to_it", async () => {
    // History.md:123, :125; HistoryEmpty.md:11, :13; HistoryNone.md:19, :21;
    // HistorySearch.md:41, :43.
    serveHistory(() => page(ALL));
    render();
    const back = await screen.findByTestId("history.header.back");
    expect(back).toHaveAttribute("aria-label", "Back to your profile");
    expect(back).toHaveAttribute("href", "/profile");
    expect(screen.getByTestId("history.header.title")).toHaveTextContent("History");
  });
});

function pull(scroller: HTMLElement) {
  const touch = (type: string, clientY: number) => {
    const event = new Event(type, { bubbles: true });
    const points = [{ clientY }];
    Object.defineProperty(event, "touches", { value: points });
    Object.defineProperty(event, "changedTouches", { value: points });
    return event;
  };
  fireEvent(scroller, touch("touchstart", 100));
  fireEvent(scroller, touch("touchmove", 100 + PULL_THRESHOLD));
  fireEvent(scroller, touch("touchend", 100 + PULL_THRESHOLD));
}

describe("History — search your history (History.md:85-103; HistorySearch.md)", () => {
  it("typing_narrows_on_the_server_trimmed_once_typing_settles", async () => {
    // History.md:87, :93: a query reaches everything seen — the server's
    // matcher — never only the loaded cards, and no page is walked for it.
    const reads = serveHistory(({ query }) =>
      query === "long way" ? page([POST]) : page(ALL, { hasNextPage: true, endCursor: "c4" }),
    );
    renderWithProviders(<HistoryScreen searchDebounceMs={20} />, { store: signedIn() });
    await screen.findByTestId("history-list");
    search("l");
    search("lo");
    search("  long way ");
    expect(cards()).toEqual(ALL_CARDS);
    await waitFor(() => expect(cards()).toEqual(["history.card:p1"]));
    expect(reads.map((read) => read.query)).toEqual([null, "long way"]);
    expect(reads.filter((read) => read.after !== null)).toEqual([]);
  });

  it("the_matches_stand_in_sections_people_then_tags_then_content_with_captions", async () => {
    // History.md:87; HistorySearch.md:3, :11, :23, :25.
    const MATEO: Entry = { node: personNode("u4", "mateo", "Mateo Ruiz"), firstSeenAt: hoursAgo(3) };
    serveHistory(({ query }) => (query === "m" ? page([MATEO, PERSON, TAG, POST]) : page(ALL)));
    render();
    await screen.findByTestId("history-list");
    search("m");
    await waitFor(() =>
      expect(rows()).toEqual([
        "history.profilesLabel",
        "history.profileCard:u4",
        "history.profileCard:u3",
        "history.tagsLabel",
        "history.tagCard:t1",
        "history.card:p1",
      ]),
    );
    expect(screen.getByTestId("history.profilesLabel")).toHaveTextContent("Profiles");
    expect(screen.getByTestId("history.tagsLabel")).toHaveTextContent("Tags");
    // No door closes a section three or fewer fill (HistorySearch.md:9, :17),
    // and no day divider breaks the sections.
    expect(screen.queryByTestId("history.profilesDoor")).toBeNull();
    expect(screen.queryByTestId("history.tagsDoor")).toBeNull();
    expect(screen.queryByTestId("history.day")).toBeNull();
  });

  it("see_all_profiles_closes_the_people_section_and_narrows_to_profiles_alone", async () => {
    // HistorySearch.md:5, :7, :27, :29.
    const reads = serveHistory(({ query, kinds }) => {
      if (query !== "m") return page(ALL);
      return kinds?.join() === "USER" ? page([PERSON]) : page([PERSON, POST], undefined, { people: true });
    });
    render();
    await screen.findByTestId("history-list");
    search("m");
    const door = await screen.findByTestId("history.profilesDoor");
    expect(door).toHaveTextContent("See all profiles");
    fireEvent.click(door);
    await waitFor(() => expect(rows()).toEqual(["history.profileCard:u3"]));
    expect(trigger()).toHaveTextContent("Profiles");
    expect(screen.getByRole("searchbox", { name: SEARCH_YOUR_HISTORY })).toHaveValue("m");
    expect(reads.at(-1)).toEqual({ query: "m", kinds: ["USER"], after: null });
    expect(reads.filter((read) => read.kinds?.join() === "USER")).toHaveLength(1);
  });

  it("see_all_tags_closes_the_tags_section_and_narrows_to_tags_alone", async () => {
    // HistorySearch.md:13, :15, :19, :21.
    const reads = serveHistory(({ query, kinds }) => {
      if (query !== "#m") return page(ALL);
      return kinds?.join() === "HASHTAG" ? page([TAG]) : page([TAG, POST], undefined, { tags: true });
    });
    render();
    await screen.findByTestId("history-list");
    search("#m");
    const door = await screen.findByTestId("history.tagsDoor");
    expect(door).toHaveTextContent("See all tags");
    fireEvent.click(door);
    await waitFor(() => expect(rows()).toEqual(["history.tagCard:t1"]));
    expect(trigger()).toHaveTextContent("Tags");
    expect(screen.getByRole("searchbox", { name: SEARCH_YOUR_HISTORY })).toHaveValue("#m");
    expect(reads.filter((read) => read.kinds?.join() === "HASHTAG")).toHaveLength(1);
  });

  it("kinds_that_leave_profiles_out_stand_no_people_section", async () => {
    // HistorySearch.md:31, :33: the kinds subtract on the server; the screen
    // draws what is served, with no caption for a section it was not served.
    const reads = serveHistory(({ query }) => (query === "@ad" ? page([POST]) : page(ALL)));
    render();
    await screen.findByTestId("history-list");
    fireEvent.click(trigger());
    fireEvent.click(chip("posts"));
    fireEvent.click(screen.getByTestId("history.filterSheet.foot.done"));
    search("@ad");
    await waitFor(() => expect(rows()).toEqual(["history.card:p1"]));
    expect(reads.at(-1)).toEqual({ query: "@ad", kinds: ["POST"], after: null });
  });

  it("emptying_the_field_stands_history_whole_as_the_filter_has_it_with_no_caption", async () => {
    // HistorySearch.md:35.
    serveHistory(({ query }) => (query === "m" ? page([PERSON, POST]) : page(ALL)));
    render();
    await screen.findByTestId("history-list");
    search("m");
    await screen.findByTestId("history.profilesLabel");
    search("");
    await waitFor(() => expect(cards()).toEqual(ALL_CARDS));
    expect(screen.queryByTestId("history.profilesLabel")).toBeNull();
  });

  it("a_query_nothing_seen_carries_stands_history_narrowed_to_nothing_with_show_everything", async () => {
    // History.md:103; HistoryNone.md:3, :7, :9, :11, :13.
    const reads = serveHistory(({ query, kinds }) => (query === null && kinds === null ? page(ALL) : page([])));
    render();
    await screen.findByTestId("history-list");
    search("brackish cartography");
    expect(await screen.findByTestId("history.empty.title")).toHaveTextContent(HISTORY_NONE_SEARCH);
    expect(screen.getByTestId("history.empty.title").className).not.toContain("text-error");
    // The field keeps the query, the trigger its reading.
    expect(screen.getByRole("searchbox", { name: SEARCH_YOUR_HISTORY })).toHaveValue("brackish cartography");
    expect(trigger()).toHaveTextContent("Everything");
    // Show everything is the one action.
    const actions = within(screen.getByTestId("history.empty")).getAllByRole("button");
    expect(actions.map((action) => action.textContent)).toEqual([SHOW_EVERYTHING]);
    fireEvent.click(screen.getByTestId("history.empty.action"));
    expect(screen.getByRole("searchbox", { name: SEARCH_YOUR_HISTORY })).toHaveValue("");
    await waitFor(() => expect(cards()).toEqual(ALL_CARDS));
    expect(trigger()).toHaveTextContent("Everything");
    expect(reads.at(-1)).toEqual({ query: null, kinds: null, after: null });
  });

  it("typing_a_query_something_carries_replaces_the_empty_state_with_the_matches", async () => {
    // HistoryNone.md:15.
    serveHistory(({ query }) => (query === "nothing" ? page([]) : query === "mira" ? page([PERSON]) : page(ALL)));
    render();
    await screen.findByTestId("history-list");
    search("nothing");
    await screen.findByTestId("history.empty");
    search("mira");
    await waitFor(() => expect(rows()).toEqual(["history.profilesLabel", "history.profileCard:u3"]));
    expect(screen.queryByTestId("history.empty")).toBeNull();
  });

  it("an_older_querys_answer_never_overwrites_the_newer_one", async () => {
    serveHistory(({ query }) => (query === "slow" ? page([PERSON]) : query === "slower" ? page([COMMENT]) : page(ALL)));
    render();
    await screen.findByTestId("history-list");
    search("slow");
    search("slower");
    await waitFor(() => expect(cards()).toEqual(["history.commentCard:c1"]));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(cards()).toEqual(["history.commentCard:c1"]);
  });
});

describe("History — what your history shows (HistoryFilter.md)", () => {
  it("the_sheet_is_titled_and_holds_the_feed_filters_four_kinds_and_nothing_else", async () => {
    // HistoryFilter.md:3, :5, :9, :11, :13, :25, :27.
    serveHistory(() => page(ALL));
    render();
    await screen.findByTestId("history-list");
    fireEvent.click(trigger());
    expect(screen.getByTestId("history.filterSheet.title")).toHaveTextContent(WHAT_YOUR_HISTORY_SHOWS);
    expect(sheet()).toHaveAttribute("aria-label", WHAT_YOUR_HISTORY_SHOWS);
    const kinds = ["posts", "comments", "profiles", "topics"].map((kind) => chip(kind));
    expect(kinds.map((element) => element.textContent)).toEqual(["Posts", "Comments", "Profiles", "Tags"]);
    // No chip is on at the default.
    expect(kinds.every((element) => element.getAttribute("aria-checked") === "false")).toBe(true);
    // Kinds and only kinds: one section, no order, no seen toggle, no "?".
    expect(within(sheet()).getAllByRole("group").map((group) => group.getAttribute("aria-label"))).toEqual([
      "Kinds",
    ]);
    expect(within(sheet()).queryByRole("checkbox")).toBeNull();
    expect(within(sheet()).queryByRole("button", { name: /how|\?/i })).toBeNull();
    expect(screen.getByTestId("history.filterSheet.kinds.hint")).toHaveTextContent(
      "Combine as many as you like. All, until you narrow it.",
    );
    // The foot: Reset in its corner, Done at its end, and no reading.
    expect(screen.getByTestId("history.filterSheet.foot").textContent).toBe("ResetDone");
  });

  it("a_chip_stages_and_chips_combine_and_history_never_moves_behind_the_sheet", async () => {
    // HistoryFilter.md:7, :15.
    const reads = serveHistory(() => page(ALL));
    render();
    await screen.findByTestId("history-list");
    fireEvent.click(trigger());
    fireEvent.click(chip("posts"));
    fireEvent.click(chip("comments"));
    expect(chip("posts")).toHaveAttribute("aria-checked", "true");
    expect(chip("comments")).toHaveAttribute("aria-checked", "true");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(reads).toHaveLength(1);
    expect(cards()).toEqual(ALL_CARDS);
    expect(trigger()).toHaveTextContent("Everything");
  });

  it("done_closes_the_sheet_and_re_reads_once_with_the_staged_kinds", async () => {
    // HistoryFilter.md:17, :31.
    const reads = serveHistory(({ kinds }) => (kinds?.join() === "COMMENT,HASHTAG" ? page([COMMENT, TAG]) : page(ALL)));
    render();
    await screen.findByTestId("history-list");
    fireEvent.click(trigger());
    fireEvent.click(chip("topics"));
    fireEvent.click(chip("comments"));
    fireEvent.click(screen.getByTestId("history.filterSheet.foot.done"));
    await waitFor(() => expect(cards()).toEqual(["history.commentCard:c1", "history.tagCard:t1"]));
    expect(trigger()).toHaveTextContent("2 kinds");
    expect(reads.slice(1)).toEqual([{ query: null, kinds: ["COMMENT", "HASHTAG"], after: null }]);
    // The apply is said once, in the trigger's own name.
    expect(screen.getByText("2 kinds, what your history shows")).toBeInTheDocument();
  });

  it("done_with_nothing_seen_of_the_staged_kinds_stands_history_narrowed_to_nothing", async () => {
    // HistoryFilter.md:19; HistoryNone.md:5, :7, :9.
    serveHistory(({ kinds }) => (kinds === null ? page(ALL) : page([])));
    render();
    await screen.findByTestId("history-list");
    fireEvent.click(trigger());
    fireEvent.click(chip("topics"));
    fireEvent.click(screen.getByTestId("history.filterSheet.foot.done"));
    expect(await screen.findByTestId("history.empty.title")).toHaveTextContent(HISTORY_NONE_KINDS);
    expect(trigger()).toHaveTextContent("Tags");
    expect(screen.getByRole("searchbox", { name: SEARCH_YOUR_HISTORY })).toHaveValue("");
    expect(screen.getByTestId("history.empty.action")).toHaveTextContent(SHOW_EVERYTHING);
    fireEvent.click(screen.getByTestId("history.empty.action"));
    await waitFor(() => expect(cards()).toEqual(ALL_CARDS));
    expect(trigger()).toHaveTextContent("Everything");
  });

  it("the_scrim_drops_the_staged_kinds_and_history_stands_as_it_was", async () => {
    // HistoryFilter.md:21.
    const reads = serveHistory(() => page(ALL));
    render();
    await screen.findByTestId("history-list");
    fireEvent.click(trigger());
    fireEvent.click(chip("posts"));
    fireEvent.click(sheet());
    await waitFor(() => expect(trigger()).toHaveAttribute("aria-expanded", "false"));
    expect(reads).toHaveLength(1);
    expect(trigger()).toHaveTextContent("Everything");
    // Opened again, nothing staged survives.
    fireEvent.click(trigger());
    expect(chip("posts")).toHaveAttribute("aria-checked", "false");
  });

  it("escape_or_back_drops_the_staged_kinds_and_history_stands_as_it_was", async () => {
    // HistoryFilter.md:23: Escape and system Back close the dialog natively.
    const reads = serveHistory(() => page(ALL));
    render();
    await screen.findByTestId("history-list");
    fireEvent.click(trigger());
    fireEvent.click(chip("profiles"));
    sheet().close();
    await waitFor(() => expect(trigger()).toHaveAttribute("aria-expanded", "false"));
    expect(reads).toHaveLength(1);
    expect(trigger()).toHaveTextContent("Everything");
  });

  it("reset_stages_the_default_and_history_never_re_reads", async () => {
    // HistoryFilter.md:29.
    const reads = serveHistory(({ kinds }) => (kinds === null ? page(ALL) : page([POST])));
    render();
    await screen.findByTestId("history-list");
    fireEvent.click(trigger());
    fireEvent.click(chip("posts"));
    fireEvent.click(screen.getByTestId("history.filterSheet.foot.done"));
    await waitFor(() => expect(cards()).toEqual(["history.card:p1"]));
    fireEvent.click(trigger());
    expect(chip("posts")).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByTestId("history.filterSheet.foot.reset"));
    expect(chip("posts")).toHaveAttribute("aria-checked", "false");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(reads).toHaveLength(2);
    expect(cards()).toEqual(["history.card:p1"]);
  });
});

describe("History — hiding from a card in it (HistoryHidden.md)", () => {
  it("hide_closes_the_sheet_keeps_every_card_in_its_place_and_snackbars_with_undo", async () => {
    // HistoryHidden.md:3, :5.
    const log = hiddenLog();
    serveHistory(() => page([COMMENT, POST]));
    server.use(...hiddenHandlers(log));
    render();
    await screen.findByTestId("history-list");
    fireEvent.click(screen.getByTestId(byNode("history.card.menu", "p1")));
    fireEvent.click(screen.getByTestId("history-menu-hide"));
    // No confirm step: the snackbar is the whole ceremony.
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByTestId("history.snackbar.message")).toHaveTextContent(
      "@ada is hidden — their posts stay out of your feed.",
    );
    expect(screen.getByTestId("history.snackbar.action")).toHaveTextContent("Undo");
    expect(cards()).toEqual(["history.commentCard:c1", "history.card:p1"]);
    await waitFor(() => expect(log.hides).toEqual([{ actor: "u1", at: null }]));
  });

  it("at_the_next_pull_the_hidden_persons_posts_and_comments_are_out_and_their_profile_stays", async () => {
    // HistoryHidden.md:7.
    // The server keeps serving Ada's post, so what takes it out at the pull is
    // the device's own set, read again beside the page — and that read now
    // holds the hide the tap sent.
    serveHistory(() => page([COMMENT, POST, { node: personNode("u1", "ada", "Ada"), firstSeenAt: daysAgo(1) }]));
    const log = hiddenLog();
    server.use(...hiddenHandlers(log));
    server.use(
      gqlLink.query("HiddenActorsPage", () =>
        HttpResponse.json(
          hiddenPage(
            log.hides.length === 0 ? [] : [{ id: "u1", handle: "ada", displayName: "Ada", hiddenAt: daysAgo(0) }],
          ),
        ),
      ),
    );
    const scroller = document.createElement("div");
    document.body.append(scroller);
    renderWithProviders(
      <ScrollHostProvider value={{ current: scroller }}>
        <HistoryScreen searchDebounceMs={0} />
      </ScrollHostProvider>,
      { store: signedIn() },
    );
    await screen.findByTestId("history-list");
    fireEvent.click(screen.getByTestId(byNode("history.card.menu", "p1")));
    fireEvent.click(screen.getByTestId("history-menu-hide"));
    expect(cards()).toEqual(["history.commentCard:c1", "history.card:p1", "history.profileCard:u1"]);
    await waitFor(() => expect(log.hides).toHaveLength(1));
    pull(scroller);
    await waitFor(() => expect(cards()).toEqual(["history.commentCard:c1", "history.profileCard:u1"]));
    scroller.remove();
  });

  it("undo_unhides_and_history_stands_as_it_stood", async () => {
    // HistoryHidden.md:9.
    const log = hiddenLog();
    serveHistory(() => page([COMMENT, POST]));
    server.use(...hiddenHandlers(log));
    render();
    await screen.findByTestId("history-list");
    fireEvent.click(screen.getByTestId(byNode("history.card.menu", "p1")));
    fireEvent.click(screen.getByTestId("history-menu-hide"));
    await waitFor(() => expect(log.hides).toHaveLength(1));
    fireEvent.click(screen.getByTestId("history.snackbar.action"));
    await waitFor(() => expect(log.unhides).toEqual(["u1"]));
    expect(cards()).toEqual(["history.commentCard:c1", "history.card:p1"]);
  });

  it("an_undo_that_does_not_go_through_leaves_the_card_saying_so_with_retry", async () => {
    // HistoryHidden.md:11.
    const log = hiddenLog();
    serveHistory(() => page([COMMENT, POST]));
    server.use(...hiddenHandlers(log, { failUnhide: true }));
    render();
    await screen.findByTestId("history-list");
    fireEvent.click(screen.getByTestId(byNode("history.card.menu", "p1")));
    fireEvent.click(screen.getByTestId("history-menu-hide"));
    await waitFor(() => expect(log.hides).toHaveLength(1));
    fireEvent.click(screen.getByTestId("history.snackbar.action"));
    const line = await screen.findByTestId("history-post-p1-row-line");
    expect(line).toHaveTextContent("That didn't go through.");
    expect(within(line).getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(cards()).toEqual(["history.commentCard:c1", "history.card:p1"]);
  });
});

describe("History — nothing seen yet (HistoryEmpty.md)", () => {
  it("history_empty_says_the_list_fills_itself_and_draws_no_field_no_trigger_no_action", async () => {
    // HistoryEmpty.md:3, :5, :7.
    serveHistory(() => page([]));
    render();
    expect(await screen.findByTestId("history.empty.title")).toHaveTextContent(HISTORY_EMPTY);
    expect(within(screen.getByTestId("history.empty")).queryByRole("button")).toBeNull();
    expect(screen.getByTestId("history.empty.title").className).not.toContain("text-error");
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByTestId("history.searchField")).toBeNull();
    expect(screen.queryByTestId("history.filterTrigger")).toBeNull();
    expect(screen.getByTestId("history.header.back")).toHaveAttribute("aria-label", "Back to your profile");
  });
});

describe("History — the reads' faults", () => {
  it("a_failed_next_page_uses_the_load_more_fault_and_retry_asks_again", async () => {
    let reads = 0;
    server.use(
      gqlLink.query("HistoryPage", ({ variables }) => {
        reads += 1;
        if (variables.after === null) {
          return HttpResponse.json({ data: page(ALL, { hasNextPage: true, endCursor: "c4" }) });
        }
        return HttpResponse.json({ data: null, errors: [{ message: "down", extensions: { code: "INTERNAL" } }] });
      }),
    );
    const scroller = document.createElement("div");
    document.body.append(scroller);
    renderWithProviders(
      <ScrollHostProvider value={{ current: scroller }}>
        <HistoryScreen />
      </ScrollHostProvider>,
      { store: signedIn() },
    );
    await screen.findByTestId("history-list");
    intersect(true);
    expect(await screen.findByTestId("history-more-failed")).toHaveTextContent("Couldn't load more");
    expect(cards()).toEqual(ALL_CARDS);
    fireEvent.click(screen.getByTestId("history-more-retry"));
    await waitFor(() => expect(reads).toBe(3));
    scroller.remove();
  });

  it("a_query_whose_read_fails_stands_the_fault_never_another_querys_cards", async () => {
    let failing = true;
    const reads = serveHistory(({ query }) => (query === null ? page(ALL) : failing ? null : page([POST])));
    render();
    await screen.findByTestId("history-list");
    search("long");
    expect(await screen.findByTestId("history-transport-error")).toBeInTheDocument();
    expect(screen.queryByTestId("history-list")).toBeNull();
    failing = false;
    fireEvent.click(screen.getByTestId("history-retry"));
    await waitFor(() => expect(cards()).toEqual(["history.card:p1"]));
    expect(reads.map((read) => read.query)).toEqual([null, "long", "long"]);
  });
});
