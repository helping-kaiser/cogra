// Saved as a feed (Saved.md, SavedUndo.md, SavedEmpty.md, SavedNone.md; round
// 12): every kept thing as its kind's own live card, newest by save time; the
// unsave as the first row of each card's ⋮, Undo in place, the comfort line on
// the returned card; the one search rule over the saved set; hidden accounts'
// things staying.

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { SavedProvider } from "@/lib/saved/provider";
import { SavedWrites } from "@/lib/saved/saved-writes";
import { createTokenStore } from "@/lib/session/token-store";
import { PULL_THRESHOLD } from "@/lib/ui/pull-to-refresh";
import { ScrollHostProvider } from "@/lib/ui/scroll-host";
import { byNode } from "@/test/data-node";
import { hiddenPage } from "@/test/hidden";
import { intersect } from "@/test/media-env";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { bookmarkHandlers, bookmarkLog } from "@/test/saved";
import { stanceHandlers } from "@/test/stance";
import {
  SAVED_EMPTY,
  SAVED_NONE,
  SEARCH_WHAT_YOU_SAVED,
  SHOW_EVERYTHING,
  SavedScreen,
} from "./saved-view";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

const server = startMswServer(...stanceHandlers());

const moderated = (value: string | null, status = "NORMAL") => ({
  __typename: "ModeratedText",
  value,
  status,
});

const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

function author(id: string, handle: string, name: string) {
  return {
    __typename: "User",
    id,
    handle,
    displayName: { __typename: "ModeratedText", value: name },
    avatar: null,
  };
}

function topic(name: string) {
  return {
    __typename: "TopicClaim",
    hashtag: { __typename: "Hashtag", id: `t-${name}`, name: moderated(name) },
    relevance: 0.5,
    confidence: 1,
    pending: false,
  };
}

function postNode(id: string, title: string | null, savedAt: string, writtenDaysAgo = 1, tags: string[] = []) {
  return {
    __typename: "Post",
    id,
    title: moderated(title),
    description: moderated(null),
    content: moderated(`${title ?? "Untitled"} words`),
    attachments: [],
    attachmentsStatus: "NORMAL",
    author: author("u1", "ada", "Ada"),
    createdAt: at(writtenDaysAgo),
    updatedAt: at(writtenDaysAgo),
    landing: { __typename: "Landing", state: "LANDED" },
    moderationStatus: "NORMAL",
    license: { __typename: "License", attribution: 0, provenance: 0 },
    topics: tags.map(topic),
    references: [],
    viewerBookmarkedAt: savedAt,
    comments: { __typename: "CommentConnection", totalCount: 0 },
  };
}

function commentNode(id: string, savedAt: string, tags: string[] = []) {
  return {
    __typename: "Comment",
    id,
    content: moderated("The third headland light is real"),
    attachments: [],
    attachmentsStatus: "NORMAL",
    author: author("u2", "tobias", "Tobias"),
    createdAt: at(0.05),
    updatedAt: at(0.05),
    landing: { __typename: "Landing", state: "LANDED" },
    moderationStatus: "NORMAL",
    license: { __typename: "License", attribution: 0, provenance: 0 },
    topics: tags.map(topic),
    references: [],
    viewerBookmarkedAt: savedAt,
    target: {
      __typename: "Post",
      id: "p1",
      title: moderated("The long way home"),
      content: moderated("words"),
      attachments: [],
      author: { __typename: "User", id: "u1", handle: "ada" },
      moderationStatus: "NORMAL",
    },
    post: { __typename: "Post", id: "p1", title: moderated("The long way home") },
  };
}

function personNode(id: string, savedAt: string, deleted = false) {
  return {
    __typename: "User",
    id,
    handle: "mira",
    displayName: deleted ? moderated(null, "REDACTED") : moderated("Mira Voss"),
    bio: deleted ? moderated(null, "REDACTED") : moderated("Runs the stand by the sea wall."),
    avatar: null,
    viewerBookmarkedAt: savedAt,
  };
}

type Entry = { node: Record<string, unknown>; bookmarkedAt: string };

function page(
  entries: readonly Entry[],
  next: { hasNextPage: boolean; endCursor: string | null } = { hasNextPage: false, endCursor: null },
) {
  return {
    me: {
      __typename: "User",
      id: "me",
      bookmarks: {
        __typename: "BookmarkConnection",
        edges: entries.map((entry, index) => ({
          __typename: "BookmarkEdge",
          cursor: `c${index}`,
          bookmarkedAt: entry.bookmarkedAt,
          node: entry.node,
        })),
        pageInfo: { __typename: "PageInfo", ...next },
      },
    },
  };
}

const SAVED = [at(2), at(3), at(5)] as const;

/**
 * Newest by when the reader saved each thing — the post written a week ago
 * leads the comment written an hour ago, because it was kept later.
 */
const THREE: Entry[] = [
  { node: postNode("p1", "The long way home", SAVED[0], 7, ["coastroad"]), bookmarkedAt: SAVED[0] },
  { node: commentNode("c1", SAVED[1], ["glovebox"]), bookmarkedAt: SAVED[1] },
  { node: personNode("u3", SAVED[2]), bookmarkedAt: SAVED[2] },
];

function signedIn() {
  const store = createTokenStore();
  store.save({ accessToken: "a", refreshToken: "r", accountId: "me" });
  return store;
}

function serve(entries: readonly Entry[]) {
  server.use(graphql.query("SavedPage", () => HttpResponse.json({ data: page(entries) })));
}

/** The cards on screen, in order, by the kind's name and key. */
function cards() {
  return within(screen.getByTestId("saved-list"))
    .getAllByTestId(/^saved\.(card|commentCard|profileCard)$/)
    .map((card) => `${card.getAttribute("data-testid")}:${card.getAttribute("data-testid-key")}`);
}

const ALL = ["saved.card:p1", "saved.commentCard:c1", "saved.profileCard:u3"];

/** Opens a card's ⋮ and returns its sheet's rows, in order. */
function openMenu(trigger: HTMLElement, sheetTestId: string) {
  fireEvent.click(trigger);
  return within(screen.getByTestId(sheetTestId)).getAllByRole("button");
}

const postMenu = () => openMenu(screen.getByTestId(byNode("saved.card.menu", "p1")), "saved-menu-sheet");
const commentMenu = () => openMenu(screen.getByTestId("saved-comment-c1-menu"), "saved-comment-c1-menu-sheet");
const personMenu = () =>
  openMenu(screen.getByTestId(byNode("saved.profileCard.menu", "u3")), "saved-person-u3-menu-sheet");

function search(query: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: SEARCH_WHAT_YOU_SAVED }), {
    target: { value: query },
  });
}

describe("SavedScreen — a feed of kept things", () => {
  it("saved_stands_each_kind_as_its_own_feed_card_newest_by_save_time", async () => {
    serve(THREE);
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved-list");
    expect(cards()).toEqual(ALL);
    // Each card is the feed's own, live: the post card's title and stance, the
    // comment's thread shape, the person's name and handle.
    expect(screen.getByTestId(byNode("saved.card.title", "p1"))).toHaveTextContent("The long way home");
    expect(screen.getByTestId(byNode("saved.card.actionRow.stance", "p1"))).toBeInTheDocument();
    expect(screen.getByTestId("saved-comment-c1-head-title")).toHaveTextContent("The long way home");
    expect(screen.getByTestId(byNode("saved.profileCard.name", "u3"))).toHaveTextContent("Mira Voss");
    expect(screen.getByTestId(byNode("saved.profileCard.handle", "u3"))).toHaveTextContent("@mira");
  });

  it("no_card_carries_a_save_age_a_saved_mark_or_an_unsave_control_of_its_own", async () => {
    serve(THREE);
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved-list");
    // The cards wear their own ages (7d, 1h), never the save's (2d, 3d, 5d).
    expect(screen.getByTestId(byNode("saved.card.timestamp", "p1"))).toHaveTextContent("7d");
    expect(screen.queryByText("2d")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Unsave/ })).not.toBeInTheDocument();
    // No kind label, filter or heading beyond the page's own title.
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("a_comment_card_carries_no_view_replies_line", async () => {
    serve(THREE);
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved-list");
    expect(within(screen.getByTestId(byNode("saved.commentCard", "c1"))).queryByText(/View .* repl/)).toBeNull();
  });

  it("every_cards_doors_land_as_the_feeds_do_their_back_arrow_naming_saved", async () => {
    serve(THREE);
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved-list");
    expect(screen.getByTestId("saved-post-p1-link")).toHaveAttribute("href", "/posts/p1?from=saved");
    // The comment card's double door: its head row opens the post it answers,
    // the rest of it the post's comment section landed on it.
    expect(screen.getByTestId("saved-comment-c1-head")).toHaveAttribute("href", "/posts/p1?from=saved");
    expect(screen.getByTestId("saved-comment-c1-link")).toHaveAttribute("href", "/posts/p1?comment=c1&from=saved");
    // Its comment glyph: the same landing with the reply composer aimed at it.
    const reply = screen.getByTestId("saved-comment-c1-reply");
    expect(reply).toHaveAttribute("href", "/posts/p1?comment=c1&from=saved&reply=1");
    expect(reply).toHaveAccessibleName("Reply to @tobias");
    expect(screen.getByTestId("saved-person-u3-link")).toHaveAttribute("href", "/u/mira?from=saved");
  });

  it("the_back_arrow_reads_back_to_your_profile", async () => {
    serve(THREE);
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    const back = await screen.findByTestId("saved.header.back");
    expect(back).toHaveAttribute("aria-label", "Back to your profile");
    expect(back).toHaveAttribute("href", "/profile");
  });

  it("a_deleted_accounts_card_stands_redacted_with_no_handle_and_no_bio", async () => {
    serve([{ node: personNode("u3", SAVED[2], true), bookmarkedAt: SAVED[2] }]);
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved-list");
    expect(screen.getByTestId(byNode("saved.profileCard.name", "u3"))).toHaveTextContent("Deleted account");
    expect(screen.queryByTestId(byNode("saved.profileCard.handle", "u3"))).not.toBeInTheDocument();
    expect(screen.queryByTestId(byNode("saved.profileCard.bio", "u3"))).not.toBeInTheDocument();
  });

  it("a_hidden_accounts_things_and_profile_stay_in_saved", async () => {
    serve(THREE);
    server.use(
      graphql.query("HiddenActorsPage", () =>
        HttpResponse.json(
          hiddenPage([
            { id: "u1", handle: "ada", displayName: "Ada", hiddenAt: at(1) },
            { id: "u3", handle: "mira", displayName: "Mira Voss", hiddenAt: at(1) },
          ]),
        ),
      ),
    );
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved-list");
    expect(cards()).toEqual(ALL);
  });
});

describe("SavedScreen — the unsave is the card's own ⋮ first row", () => {
  it("the_first_row_of_every_cards_menu_reads_unsave", async () => {
    serve(THREE);
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved-list");
    expect(postMenu()[0]).toHaveTextContent("Unsave");
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(commentMenu()[0]).toHaveTextContent("Unsave");
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(personMenu()[0]).toHaveTextContent("Unsave");
  });

  it("unsave_takes_the_card_and_undo_puts_it_back_where_it_was", async () => {
    const log = bookmarkLog();
    serve(THREE);
    server.use(...bookmarkHandlers(log));
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved-list");
    fireEvent.click(commentMenu()[0]!);
    // The sheet closes, the card leaves, the cards behind it move up.
    expect(cards()).toEqual(["saved.card:p1", "saved.profileCard:u3"]);
    expect(screen.getByTestId("saved.snackbar.message")).toHaveTextContent("Removed from Saved.");
    expect(screen.getByTestId("saved.snackbar.action")).toHaveTextContent("Undo");
    // Focus moves to the next card.
    await waitFor(() =>
      expect(screen.getByTestId(byNode("saved.profileCard", "u3")).contains(document.activeElement)).toBe(true),
    );
    await waitFor(() => expect(log.removes).toEqual(["c1"]));
    fireEvent.click(screen.getByTestId("saved.snackbar.action"));
    expect(cards()).toEqual(ALL);
    await waitFor(() => expect(log.sets).toEqual([{ node: "c1", at: SAVED[1] }]));
  });

  it("a_second_unsave_while_the_snackbar_stands_takes_that_card_too", async () => {
    serve(THREE);
    server.use(...bookmarkHandlers(bookmarkLog()));
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved-list");
    fireEvent.click(postMenu()[0]!);
    fireEvent.click(personMenu()[0]!);
    expect(cards()).toEqual(["saved.commentCard:c1"]);
    expect(screen.getByTestId("saved.snackbar.message")).toHaveTextContent("Removed from Saved.");
  });

  it("a_failed_unsave_brings_the_card_back_with_its_line_and_unsave_still_first", async () => {
    const log = bookmarkLog();
    serve(THREE);
    server.use(...bookmarkHandlers(log, { failRemove: true }));
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved-list");
    fireEvent.click(postMenu()[0]!);
    const line = await screen.findByTestId("saved-post-p1-row-line");
    expect(line).toHaveTextContent("That didn't go through.");
    // The card came back in its place, and the snackbar never carries the failure.
    expect(cards()).toEqual(ALL);
    expect(screen.queryByTestId("saved.snackbar.message")).not.toBeInTheDocument();
    expect(postMenu()[0]).toHaveTextContent("Unsave");
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    // Retry asks the unsave again, and the card leaves again at the tap.
    fireEvent.click(within(line).getByRole("button", { name: "Retry" }));
    expect(cards()).toEqual(["saved.commentCard:c1", "saved.profileCard:u3"]);
    await waitFor(() => expect(log.removes).toEqual(["p1", "p1"]));
  });

  it("a_failed_undo_keeps_the_returned_card_carrying_its_line", async () => {
    const log = bookmarkLog();
    serve(THREE);
    server.use(...bookmarkHandlers(log, { failSet: true }));
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved-list");
    fireEvent.click(personMenu()[0]!);
    await waitFor(() => expect(log.removes).toEqual(["u3"]));
    fireEvent.click(screen.getByTestId("saved.snackbar.action"));
    expect(await screen.findByTestId("saved-person-u3-row-line")).toHaveTextContent("That didn't go through.");
    expect(cards()).toEqual(ALL);
  });

  it("the_last_cards_unsave_stands_the_empty_state_under_the_snackbar", async () => {
    serve([THREE[0]!]);
    server.use(...bookmarkHandlers(bookmarkLog()));
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved-list");
    fireEvent.click(postMenu()[0]!);
    expect(screen.getByTestId("saved.empty.title")).toHaveTextContent(SAVED_EMPTY);
    expect(screen.getByTestId("saved.snackbar.message")).toHaveTextContent("Removed from Saved.");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("saved.empty.title")));
    // Undo from the empty Saved puts the card back as it stood.
    fireEvent.click(screen.getByTestId("saved.snackbar.action"));
    expect(cards()).toEqual(["saved.card:p1"]);
  });

  it("the_last_card_a_query_narrowed_to_leaves_saved_narrowed_to_nothing_under_the_snackbar", async () => {
    serve(THREE);
    server.use(...bookmarkHandlers(bookmarkLog()));
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved-list");
    search("long");
    expect(cards()).toEqual(["saved.card:p1"]);
    fireEvent.click(postMenu()[0]!);
    expect(screen.getByTestId("saved.empty.title")).toHaveTextContent(SAVED_NONE);
    expect(screen.getByTestId("saved.empty.action")).toHaveTextContent(SHOW_EVERYTHING);
    expect(screen.getByTestId("saved.snackbar.message")).toHaveTextContent("Removed from Saved.");
  });

  it("an_unsave_made_elsewhere_is_applied_on_return_with_no_snackbar", async () => {
    serve(THREE);
    // The reader unsaved the post from its own page before coming back.
    const writes = new SavedWrites(() => new Promise(() => {}));
    writes.drop("p1", SAVED[0]);
    renderWithProviders(
      <SavedProvider writes={writes}>
        <SavedScreen />
      </SavedProvider>,
      { store: signedIn() },
    );
    await screen.findByTestId("saved-list");
    expect(cards()).toEqual(["saved.commentCard:c1", "saved.profileCard:u3"]);
    expect(screen.queryByTestId("saved.snackbar.message")).not.toBeInTheDocument();
  });
});

describe("SavedScreen — search what you saved", () => {
  it("the_field_reads_search_what_you_saved_at_rest", async () => {
    serve(THREE);
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved-list");
    const field = screen.getByRole("searchbox", { name: SEARCH_WHAT_YOU_SAVED });
    expect(field).toHaveAttribute("placeholder", SEARCH_WHAT_YOU_SAVED);
    expect(screen.getByTestId("saved.searchField")).toBeInTheDocument();
  });

  it("a_query_narrows_by_names_and_titles_never_bodies_newest_by_save_time", async () => {
    serve(THREE);
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved-list");
    search("long way");
    expect(cards()).toEqual(["saved.card:p1"]);
    // A body is never matched: the comment's words carry "headland".
    search("headland");
    expect(screen.getByTestId("saved.empty.title")).toHaveTextContent(SAVED_NONE);
    search("voss");
    expect(cards()).toEqual(["saved.profileCard:u3"]);
  });

  it("an_at_handle_narrows_to_people_and_its_remainder_to_their_things", async () => {
    serve(THREE);
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved-list");
    // A bare @handle proposes people and never lists anyone's contents.
    search("@mi");
    expect(cards()).toEqual(["saved.profileCard:u3"]);
    search("@ada");
    expect(screen.getByTestId("saved.empty.title")).toHaveTextContent(SAVED_NONE);
    // The remainder: a comment through the title of the post it answers.
    search("@tobias long");
    expect(cards()).toEqual(["saved.commentCard:c1"]);
  });

  it("a_bare_hash_tag_matches_nothing_and_its_remainder_matches_what_carries_it", async () => {
    serve(THREE);
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved-list");
    search("#coastroad");
    expect(screen.getByTestId("saved.empty.title")).toHaveTextContent(SAVED_NONE);
    search("#glovebox home");
    expect(cards()).toEqual(["saved.commentCard:c1"]);
  });

  it("saved_none_keeps_the_query_wears_no_error_colour_and_show_everything_clears_it", async () => {
    serve(THREE);
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved-list");
    search("brackish cartography");
    expect(screen.getByTestId("saved.empty.title")).toHaveTextContent(SAVED_NONE);
    expect(screen.getByTestId("saved.empty.title").className).not.toContain("text-error");
    expect(screen.getByRole("searchbox", { name: SEARCH_WHAT_YOU_SAVED })).toHaveValue("brackish cartography");
    fireEvent.click(screen.getByTestId("saved.empty.action"));
    expect(screen.getByRole("searchbox", { name: SEARCH_WHAT_YOU_SAVED })).toHaveValue("");
    expect(cards()).toEqual(ALL);
  });

  it("a_search_reads_the_whole_saved_set_across_pages", async () => {
    const later = postNode("p9", "Brackish cartography", at(9));
    server.use(
      graphql.query("SavedPage", ({ variables }) =>
        HttpResponse.json({
          data:
            variables.after === null
              ? page(THREE, { hasNextPage: true, endCursor: "c2" })
              : page([{ node: later, bookmarkedAt: at(9) }]),
        }),
      ),
    );
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved-list");
    search("brackish");
    await waitFor(() => expect(cards()).toEqual(["saved.card:p9"]));
  });
});

describe("SavedScreen — states", () => {
  it("saved_empty_names_the_save_in_words_and_draws_no_field_and_no_action", async () => {
    serve([]);
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    expect(await screen.findByTestId("saved.empty.title")).toHaveTextContent(SAVED_EMPTY);
    expect(within(screen.getByTestId("saved.empty")).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByTestId("saved.empty.title").className).not.toContain("text-error");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByTestId("saved.searchField")).not.toBeInTheDocument();
  });

  it("a_failed_next_page_uses_the_load_more_fault", async () => {
    let reads = 0;
    server.use(
      graphql.query("SavedPage", ({ variables }) => {
        reads += 1;
        if (variables.after === null) {
          return HttpResponse.json({ data: page(THREE, { hasNextPage: true, endCursor: "c2" }) });
        }
        return HttpResponse.json({ data: null, errors: [{ message: "down", extensions: { code: "INTERNAL" } }] });
      }),
    );
    const scroller = document.createElement("div");
    document.body.append(scroller);
    renderWithProviders(
      <ScrollHostProvider value={{ current: scroller }}>
        <SavedScreen />
      </ScrollHostProvider>,
      { store: signedIn() },
    );
    await screen.findByTestId("saved-list");
    intersect(true);
    expect(await screen.findByTestId("saved-more-failed")).toHaveTextContent("Couldn't load more");
    expect(reads).toBe(2);
    // The cards on screen stay, and Retry asks the page again.
    expect(cards()).toHaveLength(3);
    fireEvent.click(screen.getByTestId("saved-more-retry"));
    await waitFor(() => expect(reads).toBe(3));
    scroller.remove();
  });

  it("pull_down_refreshes_saved", async () => {
    let reads = 0;
    server.use(
      graphql.query("SavedPage", () => {
        reads += 1;
        return HttpResponse.json({ data: page(THREE) });
      }),
    );
    const scroller = document.createElement("div");
    document.body.append(scroller);
    renderWithProviders(
      <ScrollHostProvider value={{ current: scroller }}>
        <SavedScreen />
      </ScrollHostProvider>,
      { store: signedIn() },
    );
    await screen.findByTestId("saved-list");
    expect(reads).toBe(1);
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
    await waitFor(() => expect(reads).toBe(2));
    scroller.remove();
  });
});
