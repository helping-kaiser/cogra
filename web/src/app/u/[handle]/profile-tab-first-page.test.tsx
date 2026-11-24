// A PROFILE CARD TAB'S FIRST PAGE, NOT YET IN OR NOT COMING (round 45;
// `_shared.jsx` `ProfileTabFirstPage`), compiled from the four sidecars that
// draw it: ProfilePosts.md:21-27, ProfilePostsOwn.md:31-37,
// ProfileComments.md:25-31, ProfileCommentsOwn.md:31-37. The next page's own
// wait and fault (Profile.md:47-49) stay `profile-posts.test.tsx`'s and
// `profile-comments.test.tsx`'s; here only that a failed next page still
// reads its own line.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { forgetAllProfileViews } from "@/lib/profile/profile-memory";
import { createTokenStore } from "@/lib/session/token-store";
import { ScrollHostProvider } from "@/lib/ui/scroll-host";
import { byNode } from "@/test/data-node";
import { gqlLink, startMswServer } from "@/test/msw";
import { chroniclePage } from "@/test/chronicle";
import { commentsPage, profileComment } from "@/test/profile-comment";
import { renderWithProviders } from "@/test/providers";
import { reelPost } from "@/test/reel";
import { stanceHandlers } from "@/test/stance";
import { COULDNT_LOAD_MORE, LOADING_AFTER_MS, ProfileScreen, tabFirstPageFault } from "./profile-view";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

const server = startMswServer(
  ...stanceHandlers(),
  gqlLink.query("ProfileFigures", () => HttpResponse.json({ data: { user: null } })),
  gqlLink.mutation("MarkSeen", () =>
    HttpResponse.json({ data: { markSeen: { __typename: "MarkSeenPayload", ok: true, userErrors: [] } } }),
  ),
  gqlLink.query("ProfileChronicle", () => HttpResponse.json(chroniclePage([]))),
);

type Tab = "posts" | "comments";
/** What one read of a tab's page answers: its items, a failure, or a wait the test releases. */
type Answer = { ids: string[]; next?: string | null } | "down" | Gate;
type Gate = { gate: Promise<void> };

const moderated = (value: string | null) => ({ __typename: "ModeratedText", value, status: "NORMAL" });
const ADA = { __typename: "User", id: "u-ada", handle: "ada", displayName: moderated("Ada Okonkwo"), avatar: null };

function person(id: string, handle: string) {
  return {
    __typename: "User",
    id,
    handle,
    displayName: moderated("Ada Okonkwo"),
    bio: moderated(null),
    websiteUrl: moderated(null),
    avatar: null,
    viewerBookmarkedAt: null,
  };
}

/** A wait the test ends by hand. */
function gate(): { answer: Gate; release: () => void } {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { answer: { gate: promise }, release };
}

/**
 * Serves one tab's reads in order: the first read takes the first answer, and
 * so on; a gated answer serves `ids` once released. Returns the cursors asked.
 */
function serveTab(tab: Tab, answers: Answer[], released: { ids: string[] } = { ids: [] }): (string | null)[] {
  const asked: (string | null)[] = [];
  const operation = tab === "posts" ? "ProfilePosts" : "ProfileComments";
  server.use(
    gqlLink.query(operation, async ({ variables }) => {
      const id = variables.id as string;
      const after = (variables.after as string | null | undefined) ?? null;
      asked.push(after);
      let answer = answers[asked.length - 1] ?? answers.at(-1)!;
      if (typeof answer === "object" && "gate" in answer) {
        await answer.gate;
        answer = released;
      }
      if (answer === "down") return HttpResponse.error();
      return HttpResponse.json({ data: page(tab, id, answer.ids, answer.next ?? null) });
    }),
  );
  return asked;
}

function page(tab: Tab, id: string, ids: string[], next: string | null) {
  if (tab === "comments") return commentsPage(id, ids.map((each) => profileComment(each)), next);
  return {
    user: {
      __typename: "User",
      id,
      posts: {
        __typename: "PostConnection",
        edges: ids.map((each) => ({
          __typename: "PostEdge",
          cursor: `cur-${each}`,
          node: reelPost(each, "photo", { author: ADA }),
        })),
        pageInfo: { __typename: "PageInfo", hasNextPage: next !== null, endCursor: next },
      },
    },
  };
}

function signedInAsAda() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "u-ada" });
  server.use(
    gqlLink.query("Me", () =>
      HttpResponse.json({
        data: {
          me: {
            __typename: "User",
            id: "u-ada",
            handle: "ada",
            displayName: { __typename: "ModeratedText", value: null },
            accountState: "MEMBER",
            hasReciprocated: true,
            vouchBackDismissed: false,
            invitedBy: null,
          },
        },
      }),
    ),
    gqlLink.query("MyProfile", () => HttpResponse.json({ data: { me: person("u-ada", "ada") } })),
  );
  return store;
}

/** Another's profile (a guest reading it), or the reader's own root. */
function draw(reader: "guest" | "own") {
  if (reader === "own") return renderWithProviders(<ProfileScreen handle={null} />, { store: signedInAsAda() });
  server.use(gqlLink.query("UserProfile", () => HttpResponse.json({ data: { user: person("u-ada", "ada") } })));
  return renderWithProviders(<ProfileScreen handle="ada" />);
}

const TAB_NODE = { posts: "profile.tabRow.postsTab", comments: "profile.tabRow.commentsTab" } as const;
const CARD_NODE = { posts: "profile.posts.card", comments: "profile.comments.commentCard" } as const;
const cardsOf = (tab: Tab) => screen.queryAllByTestId(byNode(CARD_NODE[tab]));
const loadingOf = (tab: Tab) => screen.queryByTestId(byNode(`profile.${tab}.loading`));

/**
 * Lands on Posts (served empty at once) and, for Posts, steps off to
 * Everything, so the tab under test is then asked by a switch the test times.
 */
async function standReady(tab: Tab) {
  await screen.findByTestId(byNode("profile.posts.empty"));
  if (tab === "posts") {
    fireEvent.click(screen.getByTestId(byNode("profile.tabRow.everythingTab")));
    await screen.findByTestId("profile-chronicle-empty");
  }
}

/** Records whether `path` stood in the document at any moment, however brief. */
function watchFor(path: string): { seen: () => boolean; stop: () => void } {
  let seen = false;
  const look = () => {
    if (document.querySelector(`[data-testid="${path}"]`) !== null) seen = true;
  };
  const observer = new MutationObserver(look);
  observer.observe(document.body, { childList: true, subtree: true });
  look();
  return { seen: () => seen, stop: () => observer.disconnect() };
}

const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

beforeEach(() => {
  window.localStorage.clear();
  push.mockReset();
  forgetAllProfileViews();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("a card tab's first page that does not arrive", () => {
  for (const tab of ["posts", "comments"] as const) {
    for (const reader of ["guest", "own"] as const) {
      it(`${tab}_${reader}_says_the_server_cannot_be_reached_with_retry_where_the_list_would_stand`, async () => {
        // ProfilePosts.md:23 / ProfilePostsOwn.md:33 / ProfileComments.md:27 /
        // ProfileCommentsOwn.md:33.
        if (tab === "posts") serveTab("posts", ["down", { ids: ["k1", "k2"] }]);
        else {
          serveTab("posts", [{ ids: [] }]);
          serveTab("comments", ["down", { ids: ["k1", "k2"] }]);
        }
        draw(reader);
        if (tab === "comments") {
          await screen.findByTestId(byNode("profile.posts.empty"));
          fireEvent.click(screen.getByTestId(byNode(TAB_NODE.comments)));
        }
        const view = await screen.findByTestId(byNode(`profile.${tab}`));
        await waitFor(() => expect(view).toHaveTextContent(tabFirstPageFault(tab)));
        const fault = screen.getByTestId(byNode(`profile.${tab}.moreFault`));
        expect(fault).toHaveTextContent(tabFirstPageFault(tab));
        expect(fault).not.toHaveTextContent(COULDNT_LOAD_MORE);
        // Never the error colour; never a full-tab fault, never the empty line.
        expect(fault.className).not.toContain("text-error");
        expect(screen.queryByTestId(byNode(`profile.${tab}.empty`))).toBeNull();
        expect(screen.queryByTestId("profile-rows-failed")).toBeNull();
        // :27 / :37 / :31 / :37 — the retried first page arrives: its cards
        // stand and the line goes.
        fireEvent.click(screen.getByTestId(byNode(`profile.${tab}.moreFault.retry`)));
        await waitFor(() => expect(cardsOf(tab)).toHaveLength(2));
        expect(screen.queryByTestId(byNode(`profile.${tab}.moreFault`))).toBeNull();
      });
    }
  }

  it("the_fault_line_reads_the_sidecars_words_character_for_character", () => {
    const law = (board: string) =>
      readFileSync(join(process.cwd(), "..", "design", "designs", "canonical", "behavior", `${board}.md`), "utf8");
    for (const board of ["ProfilePosts", "ProfilePostsOwn"]) {
      expect(law(board)).toContain(`reading ${tabFirstPageFault("posts")}, then profile.posts.moreFault.retry`);
    }
    for (const board of ["ProfileComments", "ProfileCommentsOwn"]) {
      expect(law(board)).toContain(`reading ${tabFirstPageFault("comments")}, then profile.comments.moreFault.retry`);
    }
  });

  it("the_worn_paths_are_the_registered_ones_on_all_four_boards", () => {
    const registry = JSON.parse(
      readFileSync(join(process.cwd(), "..", "design", "designs", "canonical", "nodes.json"), "utf8"),
    ) as { screens: Record<string, { nodes: Record<string, string[]> }> };
    const boards = { posts: ["ProfilePosts", "ProfilePostsOwn"], comments: ["ProfileComments", "ProfileCommentsOwn"] };
    for (const tab of ["posts", "comments"] as const) {
      for (const board of boards[tab]) {
        const paths = Object.keys(registry.screens[board]!.nodes);
        for (const tail of ["loading", "moreFault", "moreFault.retry"]) {
          expect(paths).toContain(`profile.${tab}.${tail}`);
        }
      }
    }
  });

  it("a_failed_next_page_still_reads_its_own_line_alone", async () => {
    // ProfilePosts.md:23 — `Couldn't load more` being a failed next page's
    // line alone (Profile.md:49).
    serveTab("posts", [{ ids: ["k1"], next: "c1" }, "down"]);
    const scroller = document.createElement("div");
    document.body.append(scroller);
    server.use(gqlLink.query("UserProfile", () => HttpResponse.json({ data: { user: person("u-ada", "ada") } })));
    renderWithProviders(
      <ScrollHostProvider value={{ current: scroller }}>
        <ProfileScreen handle="ada" />
      </ScrollHostProvider>,
    );
    await waitFor(() => expect(cardsOf("posts")).toHaveLength(1));
    const { intersect } = await import("@/test/media-env");
    act(() => intersect(true));
    expect(await screen.findByTestId("profile-rows-failed")).toHaveTextContent(COULDNT_LOAD_MORE);
    expect(screen.queryByTestId(byNode("profile.posts.moreFault"))).toBeNull();
    scroller.remove();
  });
});

describe("a card tab's first page in flight", () => {
  for (const tab of ["posts", "comments"] as const) {
    it(`${tab}_shows_nothing_for_199ms_then_loading_at_200ms_and_never_the_empty_line`, async () => {
      // ProfilePosts.md:21 / ProfileComments.md:25 (and the Own twins' :31).
      const wait = gate();
      // Switching tabs reads the tab afresh: posts' second read, comments' first.
      serveTab("posts", [{ ids: [] }, ...(tab === "posts" ? [wait.answer] : [])], { ids: ["k1"] });
      if (tab === "comments") serveTab("comments", [wait.answer], { ids: ["k1"] });
      draw("guest");
      await standReady(tab);
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      fireEvent.click(screen.getByTestId(byNode(TAB_NODE[tab])));
      await advance(LOADING_AFTER_MS - 1);
      expect(loadingOf(tab)).toBeNull();
      expect(screen.queryByTestId(byNode(`profile.${tab}.empty`))).toBeNull();
      await advance(1);
      expect(loadingOf(tab)).toHaveTextContent("Loading…");
      expect(screen.queryByTestId(byNode(`profile.${tab}.empty`))).toBeNull();
      wait.release();
      await advance(50);
      expect(cardsOf(tab)).toHaveLength(1);
      expect(loadingOf(tab)).toBeNull();
    });

    it(`${tab}_a_first_page_answered_at_150ms_never_shows_loading`, async () => {
      const wait = gate();
      serveTab("posts", [{ ids: [] }, ...(tab === "posts" ? [wait.answer] : [])], { ids: ["k1"] });
      if (tab === "comments") serveTab("comments", [wait.answer], { ids: ["k1"] });
      draw("guest");
      await standReady(tab);
      const watch = watchFor(`profile.${tab}.loading`);
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      fireEvent.click(screen.getByTestId(byNode(TAB_NODE[tab])));
      await advance(150);
      wait.release();
      await advance(10);
      expect(cardsOf(tab)).toHaveLength(1);
      await advance(500);
      watch.stop();
      expect(watch.seen()).toBe(false);
    });

    it(`${tab}_a_retry_waits_200ms_before_loading_stands_in_the_rows_place`, async () => {
      // ProfilePosts.md:25 / ProfileComments.md:29 (and the Own twins' :35).
      const wait = gate();
      if (tab === "posts") serveTab("posts", ["down", wait.answer], { ids: ["k1"] });
      else {
        serveTab("posts", [{ ids: [] }]);
        serveTab("comments", ["down", wait.answer], { ids: ["k1"] });
      }
      draw("guest");
      if (tab === "comments") {
        await screen.findByTestId(byNode("profile.posts.empty"));
        fireEvent.click(screen.getByTestId(byNode(TAB_NODE.comments)));
      }
      const retry = await screen.findByTestId(byNode(`profile.${tab}.moreFault.retry`));
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      fireEvent.click(retry);
      await advance(LOADING_AFTER_MS - 1);
      expect(loadingOf(tab)).toBeNull();
      expect(screen.queryByTestId(byNode(`profile.${tab}.moreFault`))).toBeNull();
      await advance(1);
      expect(loadingOf(tab)).toHaveTextContent("Loading…");
      wait.release();
      await advance(50);
      expect(cardsOf(tab)).toHaveLength(1);
    });
  }

  it("a_tab_switched_mid_read_counts_its_200ms_from_its_own_ask", async () => {
    // :21 "200ms after it was asked for" — the abandoned read's clock is not
    // the new tab's.
    const comments = gate();
    const posts = gate();
    serveTab("posts", [{ ids: [] }, posts.answer], { ids: ["k1"] });
    serveTab("comments", [comments.answer], { ids: ["k1"] });
    draw("guest");
    await standReady("posts");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(screen.getByTestId(byNode(TAB_NODE.posts)));
    await advance(150);
    fireEvent.click(screen.getByTestId(byNode(TAB_NODE.comments)));
    // 250ms after Posts was asked, 100ms after Comments: nothing yet.
    await advance(100);
    expect(loadingOf("posts")).toBeNull();
    expect(loadingOf("comments")).toBeNull();
    await advance(100);
    expect(loadingOf("comments")).toHaveTextContent("Loading…");
    comments.release();
    posts.release();
    await advance(50);
    expect(cardsOf("comments")).toHaveLength(1);
  });
});
