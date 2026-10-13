// Saved (Saved.md, SavedUndo.md, SavedEmpty.md; design digest items 46-57):
// one mixed list, every row's own Unsave, Undo in place, the comfort line in
// the row's second slot, and the reader's own acts applied on return.

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { SavedProvider } from "@/lib/saved/provider";
import { SavedWrites } from "@/lib/saved/saved-writes";
import { createTokenStore } from "@/lib/session/token-store";
import { PULL_THRESHOLD } from "@/lib/ui/pull-to-refresh";
import { ScrollHostProvider } from "@/lib/ui/scroll-host";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { intersect } from "@/test/media-env";
import { bookmarkHandlers, bookmarkLog } from "@/test/saved";
import { SAVED_EMPTY, SavedScreen } from "./saved-view";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

const server = startMswServer();

const moderated = (value: string | null, status = "NORMAL") => ({
  __typename: "ModeratedText",
  value,
  status,
});

const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

function postNode(id: string, title: string) {
  return {
    __typename: "Post",
    id,
    title: moderated(title),
    description: moderated(null),
    content: moderated(`${title} words`),
    attachments: [],
    moderationStatus: "NORMAL",
    sensitiveReason: null,
    author: { __typename: "User", id: "u1", handle: "ada" },
  };
}

function commentNode(id: string) {
  return {
    __typename: "Comment",
    id,
    content: moderated("The third headland light is real"),
    attachments: [],
    moderationStatus: "NORMAL",
    sensitiveReason: null,
    author: { __typename: "User", id: "u2", handle: "tobias" },
    post: {
      __typename: "Post",
      id: "p1",
      title: moderated("The long way home"),
      content: moderated("words"),
      attachments: [],
      author: { __typename: "User", id: "u1", handle: "ada" },
    },
  };
}

function personNode(id: string) {
  return {
    __typename: "User",
    id,
    handle: "mira",
    displayName: moderated("Mira Voss"),
    bio: moderated("Runs the stand by the sea wall."),
    avatar: null,
  };
}

type Entry = { node: Record<string, unknown>; bookmarkedAt: string };

function page(entries: Entry[], next: { hasNextPage: boolean; endCursor: string | null } = { hasNextPage: false, endCursor: null }) {
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

const THREE: Entry[] = [
  { node: postNode("p1", "The long way home"), bookmarkedAt: at(2) },
  { node: commentNode("c1"), bookmarkedAt: at(3) },
  { node: personNode("u3"), bookmarkedAt: at(5) },
];

function signedIn() {
  const store = createTokenStore();
  store.save({ accessToken: "a", refreshToken: "r", accountId: "me" });
  return store;
}

function serve(entries: Entry[]) {
  server.use(graphql.query("SavedPage", () => HttpResponse.json({ data: page(entries) })));
}

function rowIds() {
  return within(screen.getByTestId("saved.list"))
    .getAllByTestId("saved.list.entry")
    .map((row) => row.getAttribute("data-testid-key"));
}

describe("SavedScreen", () => {
  it("reads_one_mixed_list_newest_first_with_the_save_age", async () => {
    serve(THREE);
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved.list");
    expect(rowIds()).toEqual(["the-long-way-home", "the-third-headland-light-is-real", "mira-voss"]);
    const rows = screen.getAllByTestId("saved.list.entry");
    expect(within(rows[0]!).getByTestId("saved.list.entry.trailing")).toHaveTextContent("2d");
    expect(within(rows[1]!).getByTestId("saved.list.entry.second")).toHaveTextContent("on The long way home");
    // EVERY ROW'S OWN UNSAVE: the glyph alone, named for its row.
    expect(within(rows[2]!).getByTestId("saved.list.entry.unsave")).toHaveAccessibleName("Unsave Mira Voss");
    // No kind label, filter or heading beyond the screen's own title.
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("opens_a_comments_row_landed_on_the_comment", async () => {
    serve(THREE);
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved.list");
    expect(screen.getByTestId("saved-entry-c1-open")).toHaveAttribute(
      "href",
      "/posts/p1?comment=c1&from=saved",
    );
    expect(screen.getByTestId("saved-entry-p1-open")).toHaveAttribute("href", "/posts/p1?from=saved");
    expect(screen.getByTestId("saved-entry-u3-open")).toHaveAttribute("href", "/u/mira?from=saved");
  });

  it("the_back_arrow_reads_back_to_your_profile", async () => {
    serve(THREE);
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    const back = await screen.findByTestId("saved.header.back");
    expect(back).toHaveAttribute("aria-label", "Back to your profile");
    expect(back).toHaveAttribute("href", "/profile");
  });

  it("names_the_save_in_words_when_nothing_is_kept", async () => {
    serve([]);
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    expect(await screen.findByTestId("saved.empty.title")).toHaveTextContent(SAVED_EMPTY);
    // No action button, no error colour.
    expect(within(screen.getByTestId("saved.empty")).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByTestId("saved.empty.title").className).not.toContain("text-error");
  });

  it("unsave_takes_the_row_and_undo_puts_it_back_where_it_was", async () => {
    const log = bookmarkLog();
    serve(THREE);
    server.use(...bookmarkHandlers(log));
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved.list");
    const middle = screen.getAllByTestId("saved.list.entry")[1]!;
    fireEvent.click(within(middle).getByTestId("saved.list.entry.unsave"));
    expect(rowIds()).toEqual(["the-long-way-home", "mira-voss"]);
    expect(screen.getByTestId("saved.snackbar.message")).toHaveTextContent("Removed from Saved.");
    // Focus moves to the next row.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("saved-entry-u3-open")));
    await waitFor(() => expect(log.removes).toEqual(["c1"]));
    fireEvent.click(screen.getByTestId("saved.snackbar.action"));
    expect(rowIds()).toEqual(["the-long-way-home", "the-third-headland-light-is-real", "mira-voss"]);
    await waitFor(() => expect(log.sets).toEqual([{ node: "c1", at: THREE[1]!.bookmarkedAt }]));
  });

  it("a_reverted_unsave_clears_its_snackbar_and_the_row_says_retry", async () => {
    const log = bookmarkLog();
    serve(THREE);
    server.use(...bookmarkHandlers(log, { failRemove: true }));
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved.list");
    fireEvent.click(within(screen.getAllByTestId("saved.list.entry")[0]!).getByTestId("saved.list.entry.unsave"));
    const line = await screen.findByTestId("saved-row-line-p1");
    expect(line).toHaveTextContent("That didn't go through.");
    // The row came back, its Unsave stays, and the snackbar is gone.
    expect(rowIds()).toEqual(["the-long-way-home", "the-third-headland-light-is-real", "mira-voss"]);
    expect(within(screen.getAllByTestId("saved.list.entry")[0]!).getByTestId("saved.list.entry.unsave")).toBeInTheDocument();
    expect(screen.queryByTestId("saved.snackbar.message")).not.toBeInTheDocument();
    // Retry asks the unsave again, and the row leaves again at the tap.
    fireEvent.click(screen.getByTestId("saved-row-line-p1-retry"));
    expect(rowIds()).toEqual(["the-third-headland-light-is-real", "mira-voss"]);
    await waitFor(() => expect(log.removes).toEqual(["p1", "p1"]));
  });

  it("a_failed_undo_keeps_the_returned_row_carrying_its_line", async () => {
    const log = bookmarkLog();
    serve(THREE);
    server.use(...bookmarkHandlers(log, { failSet: true }));
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved.list");
    fireEvent.click(within(screen.getAllByTestId("saved.list.entry")[2]!).getByTestId("saved.list.entry.unsave"));
    await waitFor(() => expect(log.removes).toEqual(["u3"]));
    fireEvent.click(screen.getByTestId("saved.snackbar.action"));
    expect(await screen.findByTestId("saved-row-line-u3")).toHaveTextContent("That didn't go through.");
    expect(rowIds()).toEqual(["the-long-way-home", "the-third-headland-light-is-real", "mira-voss"]);
  });

  it("the_last_rows_unsave_stands_the_empty_state_under_the_snackbar", async () => {
    serve([THREE[0]!]);
    server.use(...bookmarkHandlers(bookmarkLog()));
    renderWithProviders(<SavedScreen />, { store: signedIn() });
    await screen.findByTestId("saved.list");
    fireEvent.click(screen.getByTestId("saved.list.entry.unsave"));
    expect(screen.getByTestId("saved.empty.title")).toHaveTextContent(SAVED_EMPTY);
    expect(screen.getByTestId("saved.snackbar.message")).toHaveTextContent("Removed from Saved.");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("saved.empty.title")));
  });

  it("an_unsave_made_elsewhere_is_applied_on_return", async () => {
    serve(THREE);
    // The reader unsaved the post from its own page before coming back.
    const writes = new SavedWrites(() => new Promise(() => {}));
    writes.drop("p1", THREE[0]!.bookmarkedAt);
    renderWithProviders(
      <SavedProvider writes={writes}>
        <SavedScreen />
      </SavedProvider>,
      { store: signedIn() },
    );
    await screen.findByTestId("saved.list");
    expect(rowIds()).toEqual(["the-third-headland-light-is-real", "mira-voss"]);
    expect(screen.queryByTestId("saved.snackbar.message")).not.toBeInTheDocument();
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
    await screen.findByTestId("saved.list");
    // The list's tail comes into view, and the next page is asked for.
    intersect(true);
    expect(await screen.findByTestId("saved-more-failed")).toHaveTextContent("Couldn't load more");
    expect(reads).toBe(2);
    // The rows on screen stay, and Retry asks the page again.
    expect(rowIds()).toHaveLength(3);
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
    await screen.findByTestId("saved.list");
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
