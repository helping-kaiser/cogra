import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { useLayoutEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { fakeIdentityStore } from "@/test/identity";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { stanceHandlers } from "@/test/stance";
import {
  intersect,
  intersectEach,
  pullsAtTop,
  setsPageVisibility,
  whenObserved,
} from "@/test/media-env";
import { FeedView } from "./feed-view";
import { announceFeedDone } from "@/lib/feed/feed-done";
import { FEED_FILTER_DEFAULT } from "@/lib/feed/feed-filter";
import { resetSeenQueueForTests } from "@/lib/history/seen-queue";
import { seenRecord } from "@/lib/history/seen-record";
import { forgetFeed, recallFeed } from "./feed-memory";
import { PULL_THRESHOLD } from "@/lib/ui/pull-to-refresh";
import { ScrollHostProvider } from "@/lib/ui/scroll-host";
import type { RegistrationFlow } from "@/lib/signing/registration-flow";
import type { RegistrationProgress } from "@/lib/signing/registration-signer";
import { byNode } from "@/test/data-node";
import { announceStanceSigned } from "@/lib/stance/signed-events";

// The feed reads `?compose=` to say that the last post did not land, and
// rewrites the URL when the notice is dismissed.
const replace = vi.fn();
const push = vi.fn();
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => searchParams,
}));

/**
 * Whose view the reader borrows. Every viewer of this feed asks, so the
 * genesis moderator is the default and the tests that care override it.
 */
function borrowedViewHandler(
  vantage: {
    id: string;
    handle: string;
    displayName: string | null;
    avatarUrl?: string;
  } | null = {
    id: "genesis-id",
    handle: "genesis_mod",
    displayName: "Genesis Moderator",
  },
) {
  return graphql.query("BorrowedView", () =>
    HttpResponse.json({
      data: {
        borrowedView:
          vantage === null
            ? null
            : {
                __typename: "User",
                id: vantage.id,
                handle: vantage.handle,
                displayName: { __typename: "ModeratedText", value: vantage.displayName },
                avatar:
                  vantage.avatarUrl === undefined
                    ? null
                    : { __typename: "MediaAttachment", url: vantage.avatarUrl },
              },
      },
    }),
  );
}

// Every signed-in card reads its own standing, so the read is a default
// rather than something each test remembers: an unhandled one degrades
// the control silently instead of failing the test.
const server = startMswServer(...stanceHandlers(), borrowedViewHandler());

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

/**
 * The status banners ride the signed-in feed and read the viewer, and so
 * does the band — the account state is what picks its wording.
 */
function meHandler(accountState: "MEMBER" | "APPLICANT" = "MEMBER") {
  return graphql.query("Me", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "acct-1",
          handle: "ada",
          displayName: { __typename: "ModeratedText", value: null },
          accountState,
          hasReciprocated: true,
          vouchBackDismissed: false,
          invitedBy: null,
        },
      },
    }),
  );
}

function moderated(value: string | null) {
  return { __typename: "ModeratedText", value, status: "NORMAL" };
}

function topicClaim(name: string) {
  return {
    __typename: "TopicClaim",
    hashtag: { __typename: "Hashtag", id: `ht-${name}`, name: moderated(name) },
    relevance: 0.1,
    confidence: 1,
    pending: false,
  };
}

function post(
  id: string,
  title: string,
  pending = false,
  topics: ReturnType<typeof topicClaim>[] = [],
  comments = 0,
) {
  return {
    __typename: "Post",
    id,
    comments: { __typename: "CommentConnection", totalCount: comments },
    title: moderated(title),
    description: moderated(null),
    content: moderated(`body of ${id}`),
    attachments: [] as unknown[],
    attachmentsStatus: "NORMAL",
    author: {
      __typename: "User",
      id: "u1",
      handle: "alice",
      displayName: { __typename: "ModeratedText", value: "Alice" },
      avatar: null,
    },
    createdAt: "2026-08-12T10:00:00Z",
    updatedAt: "2026-08-12T10:00:00Z",
    landing: { __typename: "Landing", state: pending ? "PENDING" : "LANDED" },
    moderationStatus: "NORMAL",
    license: { __typename: "License", attribution: 0, provenance: 0 },
    topics,
    references: [],
  };
}

type PostNode = { id: string; __typename: string };

/** What the ranked feed's two reads were asked: the viewer per ranking, the ids per window. */
type FeedReads = { ranks: string[]; windows: string[][] };

function feedReads(): FeedReads {
  return { ranks: [], windows: [] };
}

/** A ranking of `nodes`, in the order given, with nothing settling. */
function rankingOf(nodes: readonly PostNode[]) {
  return {
    feedRanking: {
      __typename: "FeedRanking",
      asOfEpoch: 4,
      entries: nodes.map((node, index) => ({
        __typename: "FeedEntry",
        targetId: node.id,
        kind: "POST",
        score: 1 - index / 100,
        mark: null,
        newestIndex: index,
      })),
      settling: [],
    },
  };
}

/** A hydrated window: the nodes behind the ids handed, in their order. */
function windowOf(nodes: readonly PostNode[], ids: readonly string[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return {
    feed: {
      __typename: "FeedConnection",
      edges: ids
        .filter((id) => byId.has(id))
        .map((id) => ({ __typename: "FeedEdge", node: byId.get(id) })),
    },
  };
}

/**
 * The ranked feed's two reads over `nodes` (ranked-feed packet §4.1, §4.4):
 * one ranking of them all, in the order given, and windows hydrated from it.
 * `nodes` may be a function, read at each ranking, for a feed that changes
 * between asks. `failWindow` faults the hydration of the given window call.
 */
function rankedFeed(
  nodes: readonly PostNode[] | (() => readonly PostNode[]),
  reads: FeedReads = feedReads(),
  { failWindow }: { failWindow?: (call: number) => boolean } = {},
) {
  let current: readonly PostNode[] = typeof nodes === "function" ? [] : nodes;
  return [
    graphql.query("FeedRanking", ({ variables }) => {
      reads.ranks.push(variables.viewer as string);
      if (typeof nodes === "function") current = nodes();
      return HttpResponse.json({ data: rankingOf(current) });
    }),
    graphql.query("Feed", ({ variables }) => {
      const ids = variables.orderedIds as string[];
      reads.windows.push(ids);
      if (failWindow?.(reads.windows.length)) return HttpResponse.error();
      return HttpResponse.json({ data: windowOf(current, ids) });
    }),
  ];
}

/** `count` posts, p1 first: more than one window's worth past 20. */
function posts(count: number) {
  return Array.from({ length: count }, (_, i) => post(`p${i + 1}`, `Post ${i + 1}`));
}

describe("FeedView", () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParams = new URLSearchParams();
    replace.mockClear();
    push.mockClear();
    // The feed's memory is module scope, which is the point of it — so each
    // test starts from a reader who has not been here yet.
    forgetFeed();
  });

  it("lists posts newest-first as served and links the composer when signed in", async () => {
    server.use(
      ...rankedFeed([post("p1", "First")]),
    );
    server.use(meHandler());
    renderWithProviders(<FeedView />, { store: signedInStore() });
    expect(await screen.findByTestId(byNode("feed.card", "p1"))).toHaveTextContent("First");
    expect(screen.queryByTestId("feed-borrowed-view-action")).not.toBeInTheDocument();
    expect(screen.getByTestId("feed-post-p1-link")).toHaveAttribute("href", "/posts/p1");
    expect(screen.queryByTestId("feed-empty")).not.toBeInTheDocument();
  });

  // A FEED POST IS A FULL-WIDTH CONTAINER with 8px of surface as the seam
  // (design/readme.md, "Feed containers — rounded full-width cards"): the list
  // leaves the gutter its neighbours keep, so a card runs edge to edge.
  it("runs its cards edge to edge with the ruled 8px seam", async () => {
    server.use(
      ...rankedFeed([post("p1", "First")]),
    );
    renderWithProviders(<FeedView />);
    const list = await screen.findByTestId("feed-list");
    expect(list.className).toContain("gap-2");
    expect(list.className).not.toContain("px-6");
  });

  // The card's own header line: the author, and the post's age beside it.
  it("carries the post's age on the card", async () => {
    server.use(
      ...rankedFeed([post("p1", "First")]),
    );
    renderWithProviders(<FeedView />);
    const stamp = await screen.findByTestId(byNode("feed.card.timestamp", "p1"));
    expect(stamp).toHaveAttribute("datetime", "2026-08-12T10:00:00Z");
    expect(stamp.textContent).toMatch(/^(now|\d+[mhd])$/);
  });

  // The affordance row: stance, then the comment count, then share — one
  // line, glyph plus number, the count spoken by the accessible name.
  //
  // THE COUNT RAISES THE THREAD, it does not travel to it (jakob 2026-09-15):
  // the sheet is the one comments surface, over this list, so the card's own
  // tap is what still opens the post.
  it("raises the thread from the comments affordance, over the feed", async () => {
    server.use(
      ...rankedFeed([post("p1", "First", false, [], 2)]),
      graphql.query("PostComments", () =>
        HttpResponse.json({
          data: {
            post: {
              __typename: "Post",
              id: "p1",
              comments: {
                __typename: "CommentConnection",
                totalCount: 0,
                edges: [],
                pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
              },
            },
          },
        }),
      ),
    );
    renderWithProviders(<FeedView />);
    const comments = await screen.findByTestId(byNode("feed.card.actionRow.comments", "p1"));
    expect(comments).toHaveAccessibleName("2 comments");
    expect(comments).toHaveTextContent("2");
    // A control, not a link: its destination is a layer over this surface.
    expect(comments).not.toHaveAttribute("href");
    fireEvent.click(comments);
    const sheet = await screen.findByTestId("comments-sheet");
    expect(sheet).toBeVisible();
    expect(sheet).toHaveAccessibleName("Comments");
    // ...and the feed is still underneath it, pages and all.
    expect(screen.getByTestId(byNode("feed.card", "p1"))).toBeInTheDocument();
  });

  // THE SHEET IS A LAYER, NOT A DESTINATION. The feed is never left, so its
  // pages and the reader's place in them stand through a raise, a dismissal,
  // and the composer the thread opens on top of it.
  it("keeps the reader's place in the feed through the thread and its composer", async () => {
    server.use(
      ...rankedFeed([post("p1", "First", false, [], 1)]),
      graphql.query("PostComments", () =>
        HttpResponse.json({
          data: {
            post: {
              __typename: "Post",
              id: "p1",
              comments: {
                __typename: "CommentConnection",
                totalCount: 0,
                edges: [],
                pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
              },
            },
          },
        }),
      ),
      meHandler(),
    );
    const scroller = document.createElement("div");
    document.body.append(scroller);
    const host = { current: scroller };
    renderWithProviders(
      <ScrollHostProvider value={host}>
        <FeedView store={fakeIdentityStore({ keyOnDevice: true })} />
      </ScrollHostProvider>,
      { store: signedInStore() },
    );
    await screen.findByTestId(byNode("feed.card", "p1"));
    scroller.scrollTop = 1240;
    fireEvent.scroll(scroller);
    await waitFor(() => expect(recallFeed("acct-1")?.place.offset).toBe(1240));

    fireEvent.click(screen.getByTestId(byNode("feed.card.actionRow.comments", "p1")));
    const sheet = await screen.findByTestId("comments-sheet");
    // The same full-function thread the detail raises: its own composer door.
    fireEvent.click(await screen.findByTestId("comment-add"));
    await screen.findByTestId("reply-wizard");
    await waitFor(() => expect(sheet).not.toBeVisible());
    fireEvent.click(screen.getByTestId("header-back"));
    await waitFor(() => expect(screen.getByTestId("comments-sheet")).toBeVisible());
    fireEvent.keyDown(sheet, { key: "Escape" });

    expect(scroller.scrollTop).toBe(1240);
    expect(recallFeed("acct-1")?.place.offset).toBe(1240);
    scroller.remove();
  });

  // THE FEED'S ONE STAGE (Feed.md:3–55), driven through the real list: the
  // host around it, the cards' frames on it, and the thread over it.
  describe("the feed's stage", () => {
    const clipPost = (id: string, comments = 0) => ({
      ...post(id, `Clip ${id}`, false, [], comments),
      attachments: [
        {
          __typename: "MediaAttachment",
          id: `m-${id}`,
          url: `https://media.test/${id}.mp4`,
          altText: null,
          status: "NORMAL",
          mimeType: "video/mp4",
          options: { __typename: "MediaOptions", aspectRatio: "9:16", durationMs: 12_000 },
          coverMedia: null,
          coverTaken: false,
        },
      ],
    });
    const frameOf = (postId: string) =>
      screen
        .getByTestId(byNode("feed.card.media.frame", `${postId}/1`))
        .querySelector("video") as HTMLVideoElement;
    const emptyThread = graphql.query("PostComments", () =>
      HttpResponse.json({
        data: {
          post: {
            __typename: "Post",
            id: "p1",
            comments: {
              __typename: "CommentConnection",
              totalCount: 0,
              edges: [],
              pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
            },
          },
        },
      }),
    );

    it("plays one clip, the topmost of those that qualify (F01 Feed.md:3, F08 Feed.md:17)", async () => {
      server.use(
        ...rankedFeed([clipPost("p1"), clipPost("p2")]),
      );
      renderWithProviders(<FeedView />);
      await screen.findByTestId(byNode("feed.card.media.frame", "p2/1"));
      // The stage watches its clips from a passive effect; report their places
      // only once it does (`whenObserved`).
      await whenObserved(frameOf("p1"), frameOf("p2"));
      act(() =>
        intersectEach([
          { target: frameOf("p2"), ratio: 1 },
          { target: frameOf("p1"), ratio: 0.8 },
        ]),
      );
      expect(frameOf("p1").paused).toBe(false);
      expect(frameOf("p2").paused).toBe(true);
    });

    // F13 Feed.md:31 — the thread over the feed stops its clip. SL-1 flag c —
    // the thread then yields to its composer and takes the screen back; the
    // feed beneath never reads the moment between as the suspension lifting,
    // so its clip does not start until the reader drops the thread for real
    // (F15 Feed.md:35).
    it("stops under the thread, starts nothing through the composer's handover, and decides again once the thread drops", async () => {
      server.use(
        ...rankedFeed([clipPost("p1", 1)]),
        emptyThread,
        meHandler(),
      );
      renderWithProviders(<FeedView store={fakeIdentityStore({ keyOnDevice: true })} />, {
        store: signedInStore(),
      });
      await screen.findByTestId(byNode("feed.card.media.frame", "p1/1"));
      const video = frameOf("p1");
      await whenObserved(video);
      act(() => intersectEach([{ target: video, ratio: 1 }]));
      expect(video.paused).toBe(false);

      fireEvent.click(screen.getByTestId(byNode("feed.card.actionRow.comments", "p1")));
      const sheet = await screen.findByTestId("comments-sheet");
      expect(video.paused).toBe(true);

      let starts = 0;
      video.addEventListener("play", () => {
        starts += 1;
      });
      fireEvent.click(await screen.findByTestId("comment-add"));
      await screen.findByTestId("reply-wizard");
      await waitFor(() => expect(sheet).not.toBeVisible());
      fireEvent.click(screen.getByTestId("header-back"));
      await waitFor(() => expect(screen.getByTestId("comments-sheet")).toBeVisible());
      expect(starts).toBe(0);
      expect(video.paused).toBe(true);

      fireEvent(sheet, new Event("close"));
      await waitFor(() => expect(video.paused).toBe(false));
    });

    // CONTINUITY (FeedCover.md:9/13): a played clip keeps its reached frame
    // for the reading session — until the list holding it refreshes.
    it("a pull at the top re-stills the list: its played clip wears its stored still again (C18 FeedCover.md:13)", async () => {
      const COVER = "https://media.test/p1-cover.webp";
      const coveredClip = () => {
        const base = clipPost("p1");
        return {
          ...base,
          attachments: [
            {
              ...base.attachments[0],
              coverMedia: {
                __typename: "MediaAttachment",
                id: "c-p1",
                url: COVER,
                status: "NORMAL",
                options: { __typename: "MediaOptions", aspectRatio: "9:16" },
              },
            },
          ],
        };
      };
      const reads = feedReads();
      server.use(...rankedFeed([coveredClip()], reads));
      const scroller = document.createElement("div");
      document.body.append(scroller);
      renderWithProviders(
        <ScrollHostProvider value={{ current: scroller }}>
          <FeedView store={fakeIdentityStore()} />
        </ScrollHostProvider>,
      );
      await screen.findByTestId(byNode("feed.card.media.frame", "p1/1"));
      const played = frameOf("p1");
      expect(played).toHaveAttribute("poster", COVER);
      await whenObserved(played);
      act(() => intersectEach([{ target: played, ratio: 1 }]));
      expect(played.paused).toBe(false);
      played.currentTime = 4;

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

      // The refreshed list lands with its clip built anew, on its stored still.
      await waitFor(() => expect(frameOf("p1")).not.toBe(played));
      expect(reads.ranks).toHaveLength(2);
      expect(frameOf("p1")).toHaveAttribute("poster", COVER);
      expect(frameOf("p1").currentTime).toBe(0);
      scroller.remove();
    });
  });

  it("shows the comments glyph alone where there are none", async () => {
    server.use(
      ...rankedFeed([post("p1", "First")]),
    );
    renderWithProviders(<FeedView />);
    const comments = await screen.findByTestId(byNode("feed.card.actionRow.comments", "p1"));
    expect(comments).toHaveAccessibleName("0 comments");
    expect(comments).toHaveTextContent("");
  });

  // One slot the row is drawn with and cannot fill yet, absent rather than
  // dead: the Post Score has no field on the contract until slice 3's ranker.
  // The ⋮ beside it is drawn — `PostCard.jsx:262` puts it on every non-detail
  // card — and the rows it holds are read on the card's own suite.
  it("draws the overflow ⋮ but not the Post Score, whose field does not exist", async () => {
    server.use(
      ...rankedFeed([post("p1", "First")]),
    );
    renderWithProviders(<FeedView />);
    await screen.findByTestId(byNode("feed.card", "p1"));
    expect(screen.queryByTestId("feed-post-p1-score")).not.toBeInTheDocument();
    expect(screen.getByTestId(byNode("feed.card.menu", "p1"))).toHaveAccessibleName("More on this post");
  });

  it("carries the post's topics on one line, each chip navigating to its topic route", async () => {
    server.use(
      ...rankedFeed([post("p1", "First", false, [topicClaim("rust")])]),
    );
    renderWithProviders(<FeedView />);
    expect(await screen.findByTestId(byNode("feed.card.tagsLine.tag", "p1/rust"))).toBeInTheDocument();
    expect(screen.getByTestId("feed-post-p1-topic-rust-link")).toHaveAttribute(
      "href",
      "/topics/rust",
    );
  });

  it("carries a stance control on every post card", async () => {
    server.use(
      ...rankedFeed([post("p1", "First"), post("p2", "Second")]),
    );
    server.use(meHandler());
    renderWithProviders(<FeedView />, { store: signedInStore() });
    // Part of the post card's inventory (design.md §6) — and outside the
    // link, since it acts rather than navigates.
    expect(await screen.findByTestId(byNode("feed.card.actionRow.stance.anchor", "p1"))).toBeInTheDocument();
    expect(screen.getByTestId(byNode("feed.card.actionRow.stance.anchor", "p2"))).toBeInTheDocument();
    expect(screen.getByTestId("feed-post-p1-link")).not.toContainElement(
      screen.getByTestId(byNode("feed.card.actionRow.stance.anchor", "p1")),
    );
  });

  it("wears the viewer's own standing on each card it has one for", async () => {
    // §8.3: at rest the target shows the standing — face, words, and the
    // folded pair — for every card the viewer has a bundle toward.
    server.use(
      ...rankedFeed([post("p1", "First"), post("p2", "Second")]),
    );
    server.use(
      meHandler(),
      ...stanceHandlers({ p1: { pDirected: 0.55, pInterest: 0.2, recordCount: 2 } }),
    );
    renderWithProviders(<FeedView />, { store: signedInStore() });
    await waitFor(() =>
      expect(screen.getByTestId(byNode("feed.card.actionRow.stance.anchor", "p1"))).toHaveTextContent("Like this"),
    );
    expect(screen.getByTestId(byNode("feed.card.actionRow.stance.anchor", "p1"))).toHaveTextContent("😊");
    expect(screen.getByTestId(byNode("feed.card.actionRow.stance.anchor.exact", "p1"))).toHaveTextContent("+0.55 / +0.20");
    // A card the viewer has no bundle toward keeps the affordance — a
    // muted face outside the table, never a bare word and never the
    // shrug a zero standing owns (design.md §8.3, §8.4).
    expect(screen.getByTestId(byNode("feed.card.actionRow.stance.anchor", "p2"))).toHaveTextContent("🫥");
    expect(screen.getByTestId(byNode("feed.card.actionRow.stance.anchor", "p2"))).not.toHaveTextContent("🤷");
    expect(screen.getByTestId(byNode("feed.card.actionRow.stance.anchor", "p2"))).toHaveTextContent("No stance yet");
  });

  it("offers a guest the stance control, which asks them to join", async () => {
    server.use(
      ...rankedFeed([post("p1", "First")]),
    );
    renderWithProviders(<FeedView />);
    fireEvent.click(await screen.findByTestId(byNode("feed.card.actionRow.stance.anchor", "p1")));
    expect(await screen.findByTestId("join-prompt")).toBeInTheDocument();
  });

  // The chats affordance (jakob 2026-09-01). A signed-out tap opens the
  // guest gate, the edge the canvas draws (`graph.json` "FeedBare" →
  // `GuestGate`) — ask, never bounce.
  it("asks a guest to join when they tap the band's chats affordance", async () => {
    server.use(
      ...rankedFeed([]),
    );
    renderWithProviders(<FeedView />);
    fireEvent.click(await screen.findByTestId(byNode("feed.band.chats")));
    expect(await screen.findByTestId("join-prompt")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalledWith("/chats");
  });

  // A signed-in tap reaches the coming-soon destination (`graph.json`
  // "Feed" → `ChatsComingSoon`, backlog item 68).
  it("sends a signed-in reader to the coming-soon screen", async () => {
    server.use(
      ...rankedFeed([]),
    );
    server.use(meHandler(), borrowedViewHandler(null));
    renderWithProviders(<FeedView />, { store: signedInStore() });
    fireEvent.click(await screen.findByTestId(byNode("feed.band.chats")));
    expect(push).toHaveBeenCalledWith("/chats");
  });

  it("collapses the restore card into the header for a keyless member", async () => {
    server.use(
      ...rankedFeed([]),
    );
    server.use(meHandler());
    renderWithProviders(<FeedView store={fakeIdentityStore({})} />, {
      store: signedInStore(),
    });
    const restore = await screen.findByTestId("home_restore");
    expect(screen.getByTestId("collapsing-top")).toContainElement(restore);
  });

  it("names the genesis moderator's view to a signed-out reader, with the way in", async () => {
    server.use(
      ...rankedFeed([post("p1", "First")]),
    );
    renderWithProviders(<FeedView />);
    expect(await screen.findByTestId(byNode("feed.card", "p1"))).toHaveTextContent("First");

    // The band subsumes the guest notice: it says whose view this is and
    // carries the one sign-in-or-join entry, riding the collapsing top.
    const band = await screen.findByTestId("feed-borrowed-view");
    expect(screen.getByTestId("collapsing-top")).toContainElement(band);
    expect(screen.getByTestId("feed-borrowed-view-line")).toHaveTextContent(
      "Browsing from @genesis_mod's view — join to build your own.",
    );
    fireEvent.click(screen.getByTestId("feed-borrowed-view-action"));
    expect(push).toHaveBeenCalledWith("/login");
  });

  // The account exists from the moment the invite link is spent, before
  // either proof is in — and the band must name the vantage from then.
  it("names the inviter's view to an applicant whose email is not verified yet", async () => {
    server.use(
      ...rankedFeed([]),
    );
    server.use(
      meHandler("APPLICANT"),
      borrowedViewHandler({ id: "inv-1", handle: "mira", displayName: "Mira Voss" }),
    );
    renderWithProviders(<FeedView />, { store: signedInStore() });

    expect(await screen.findByTestId("feed-borrowed-view-line")).toHaveTextContent(
      "Browsing from @mira's view while your application lands.",
    );
    // The applicant can do nothing about the borrowing, so no action.
    expect(screen.queryByTestId("feed-borrowed-view-action")).not.toBeInTheDocument();
  });

  // Landing grants membership; the member's FIRST SIGNED OPINION, toward
  // anyone, is what gives them a view of their own (VouchBack.md:13, :21).
  // Until then the band names the vantage and asks for nothing (:17).
  it("the landed member's band says the first opinion starts their own", async () => {
    server.use(
      ...rankedFeed([]),
    );
    server.use(
      meHandler(),
      borrowedViewHandler({ id: "inv-1", handle: "mira", displayName: "Mira Voss" }),
    );
    renderWithProviders(<FeedView />, { store: signedInStore() });

    // The member's band is the registered one (VouchBack board).
    expect(await screen.findByTestId("feed.borrowedViewBand.line")).toHaveTextContent(
      "Browsing from @mira's view — your first opinion starts your own.",
    );
    // The members band carries no action.
    expect(screen.queryByTestId("feed-borrowed-view-action")).not.toBeInTheDocument();
    expect(screen.getByTestId("feed.borrowedViewBand").querySelector("button")).toBeNull();
  });

  // The vouch card is the list's first item (VouchBack.jsx) and not a post:
  // it carries no seen id, so the history tracker never reports it seen.
  it("puts the vouch card first in the list, outside the seen tracker", async () => {
    server.use(
      ...rankedFeed([post("p1", "First")]),
      graphql.query("Me", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "acct-1",
              handle: "noa",
              displayName: { __typename: "ModeratedText", value: null },
              accountState: "MEMBER",
              hasReciprocated: false,
              vouchBackDismissed: false,
              invitedBy: {
                __typename: "User",
                id: "inv-1",
                handle: "mira",
                displayName: { __typename: "ModeratedText", value: "Mira Voss" },
                avatar: null,
              },
            },
          },
        }),
      ),
    );
    renderWithProviders(<FeedView />, { store: signedInStore() });
    const card = await screen.findByTestId("feed.vouchCard");
    const list = screen.getByTestId("feed-list");
    const item = card.closest("li");
    expect(item?.parentElement).toBe(list);
    expect(list.firstElementChild).toBe(item);
    expect(item).not.toHaveAttribute("data-seen-id");
    expect(card.querySelector("[data-seen-id]")).toBeNull();
  });

  // The band wears the vantage's own face (`... on User { avatar }`).
  it("the band shows the vantage's face", async () => {
    server.use(
      ...rankedFeed([]),
    );
    server.use(
      meHandler(),
      borrowedViewHandler({
        id: "inv-1",
        handle: "mira",
        displayName: "Mira Voss",
        avatarUrl: "https://media.example/mira.jpg",
      }),
    );
    renderWithProviders(<FeedView />, { store: signedInStore() });

    const avatar = await screen.findByTestId("feed.borrowedViewBand.avatar");
    expect(avatar.querySelector("img")?.getAttribute("src")).toContain("mira.jpg");
  });

  // A signing taken anywhere re-reads the band, and the server's null takes
  // it away at once — with no reload of the feed under the reader (:21).
  it("an opinion signed anywhere takes the band away", async () => {
    let borrowing = true;
    const reads = feedReads();
    server.use(...rankedFeed([post("p1", "First")], reads));
    server.use(meHandler());
    server.use(
      graphql.query("BorrowedView", () =>
        HttpResponse.json({
          data: {
            borrowedView: borrowing
              ? {
                  __typename: "User",
                  id: "inv-1",
                  handle: "mira",
                  displayName: { __typename: "ModeratedText", value: "Mira Voss" },
                  avatar: null,
                }
              : null,
          },
        }),
      ),
    );
    renderWithProviders(<FeedView />, { store: signedInStore() });
    expect(await screen.findByTestId("feed.borrowedViewBand")).toBeInTheDocument();
    // The borrowed view is the one ranked (CD-5).
    await waitFor(() => expect(reads.ranks).toEqual(["inv-1"]));

    borrowing = false;
    act(() => announceStanceSigned());
    await waitFor(() =>
      expect(screen.queryByTestId("feed.borrowedViewBand")).not.toBeInTheDocument(),
    );
    expect(reads.ranks).toHaveLength(1);
  });

  // An Affinity never ends the borrowing (:25): the signing is announced like
  // any other, the contract still answers the vantage, and the band stands.
  it("an affinity leaves the band standing", async () => {
    let reads = 0;
    server.use(
      ...rankedFeed([]),
    );
    server.use(meHandler());
    server.use(
      graphql.query("BorrowedView", () => {
        reads += 1;
        return HttpResponse.json({
          data: {
            borrowedView: {
              __typename: "User",
              id: "inv-1",
              handle: "mira",
              displayName: { __typename: "ModeratedText", value: "Mira Voss" },
              avatar: null,
            },
          },
        });
      }),
    );
    renderWithProviders(<FeedView />, { store: signedInStore() });
    expect(await screen.findByTestId("feed.borrowedViewBand")).toBeInTheDocument();
    // The band's read and the ranking's own viewer read (Apollo may answer
    // both with one request when they are in flight together).
    await screen.findByTestId("feed-empty");
    const before = reads;

    act(() => announceStanceSigned());
    await waitFor(() => expect(reads).toBe(before + 1));
    expect(screen.getByTestId("feed.borrowedViewBand")).toBeInTheDocument();
  });

  // A first opinion that expired with nothing landed brings the borrowing
  // back (:23); the feed's next refresh is where the band reads it.
  it("an expired first opinion brings the band back", async () => {
    let borrowing = false;
    server.use(
      ...rankedFeed([post("p1", "First")]),
    );
    server.use(meHandler());
    server.use(
      graphql.query("BorrowedView", () =>
        HttpResponse.json({
          data: {
            borrowedView: borrowing
              ? {
                  __typename: "User",
                  id: "inv-1",
                  handle: "mira",
                  displayName: { __typename: "ModeratedText", value: "Mira Voss" },
                  avatar: null,
                }
              : null,
          },
        }),
      ),
    );
    const scroller = document.createElement("div");
    document.body.append(scroller);
    renderWithProviders(
      <ScrollHostProvider value={{ current: scroller }}>
        <FeedView store={fakeIdentityStore({ keyOnDevice: true })} />
      </ScrollHostProvider>,
      { store: signedInStore() },
    );
    await screen.findByTestId(byNode("feed.card", "p1"));
    expect(screen.queryByTestId("feed.borrowedViewBand")).not.toBeInTheDocument();

    borrowing = true;
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
    expect(await screen.findByTestId("feed.borrowedViewBand.line")).toHaveTextContent(
      "Browsing from @mira's view — your first opinion starts your own.",
    );
    scroller.remove();
  });

  it("shows no band to a reader whose view is their own", async () => {
    server.use(
      ...rankedFeed([]),
    );
    server.use(meHandler(), borrowedViewHandler(null));
    renderWithProviders(<FeedView />, { store: signedInStore() });
    expect(await screen.findByTestId("feed-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("feed-borrowed-view")).not.toBeInTheDocument();
  });

  it("carries no back arrow — the feed is a tab root for every viewer", async () => {
    server.use(
      ...rankedFeed([]),
    );
    renderWithProviders(<FeedView />);
    expect(await screen.findByTestId("feed-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("feed-back")).not.toBeInTheDocument();
  });

  it("shows the empty copy when nothing has landed", async () => {
    server.use(
      ...rankedFeed([]),
    );
    renderWithProviders(<FeedView />);
    expect(await screen.findByTestId("feed-empty")).toBeInTheDocument();
  });

  // THE NEXT PAGE ARRIVES BECAUSE THE READER KEPT GOING (design readme §13,
  // the audit states): no Show more, no page numbers, nothing drawn at rest.
  // The watch reaches the reader before the end of the list does.
  // The next window of the held ranking (CD-2): a hydration, never a second
  // ranking, at most a page of ids at a time.
  it("loads the next page from the cursor as the reader nears the tail", async () => {
    const reads = feedReads();
    server.use(...rankedFeed(posts(25), reads));
    renderWithProviders(<FeedView />);
    await screen.findByTestId(byNode("feed.card", "p1"));
    expect(screen.queryByTestId(byNode("feed.card", "p21"))).not.toBeInTheDocument();
    expect(screen.queryByTestId("feed-load-more")).not.toBeInTheDocument();

    intersect(true);
    expect(await screen.findByTestId(byNode("feed.card", "p21"))).toBeInTheDocument();
    expect(screen.getByTestId(byNode("feed.card", "p1"))).toBeInTheDocument();
    expect(reads.ranks).toHaveLength(1);
    expect(reads.windows.map((ids) => [ids[0], ids.length])).toEqual([
      ["p1", 20],
      ["p21", 5],
    ]);
  });

  it("the_feed_hydrates_by_windows_of_at_most_100", async () => {
    const reads = feedReads();
    server.use(...rankedFeed(posts(25), reads));
    renderWithProviders(<FeedView />);
    await screen.findByTestId(byNode("feed.card", "p1"));
    intersect(true);
    await screen.findByTestId(byNode("feed.card", "p25"));
    for (const ids of reads.windows) expect(ids.length).toBeLessThanOrEqual(100);
  });

  it("stops asking once the last page has landed", async () => {
    const reads = feedReads();
    server.use(...rankedFeed(posts(25), reads));
    renderWithProviders(<FeedView />);
    await screen.findByTestId(byNode("feed.card", "p1"));
    intersect(true);
    await screen.findByTestId(byNode("feed.card", "p21"));

    intersect(true);
    await waitFor(() => expect(reads.windows).toHaveLength(2));
    expect(reads.ranks).toHaveLength(1);
  });

  // A page that did not arrive is the one thing the boards draw here, and the
  // way back is the reader's — a watch that re-asked on its own would spend
  // the failure in a loop.
  it("leaves a failed page to its Retry rather than asking again", async () => {
    const reads = feedReads();
    server.use(...rankedFeed(posts(25), reads, { failWindow: (call) => call > 1 }));
    renderWithProviders(<FeedView />);
    await screen.findByTestId(byNode("feed.card", "p1"));
    intersect(true);
    expect(await screen.findByTestId("feed-load-more-error")).toBeInTheDocument();

    intersect(true);
    await waitFor(() => expect(reads.windows).toHaveLength(2));
    expect(screen.getByTestId("feed-load-more-retry")).toBeInTheDocument();
  });

  // HT-2. The restore ask and the key ceremony are different accounts'
  // problems, and no board carries both: `KeyElsewhere` is for a key that
  // exists somewhere else, `KeyCeremony` for one that does not exist yet.
  describe("the key ask above the feed", () => {
    function flowAt(progress: RegistrationProgress | null): RegistrationFlow {
      return {
        progress: () => progress,
        subscribe: () => () => {},
        ensureAdvancing: () => {},
        consumeLanded: () => false,
        reset: () => {},
      };
    }

    function renderFeed(progress: RegistrationProgress | null) {
      server.use(...rankedFeed([post("p1", "First")]));
      return renderWithProviders(<FeedView store={fakeIdentityStore()} />, {
        store: signedInStore(),
        flow: flowAt(progress),
      });
    }

    it("offers nothing to restore to an account whose key was never made", async () => {
      renderFeed({
        kind: "awaitingApproval",
        emailVerified: false,
        keyAttached: false,
        keyOnDevice: false,
      });
      expect(await screen.findByTestId(byNode("feed.card", "p1"))).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.queryByTestId("home_restore")).not.toBeInTheDocument(),
      );
    });

    it("asks an account whose key is attached elsewhere to restore it", async () => {
      renderFeed({
        kind: "awaitingApproval",
        emailVerified: true,
        keyAttached: true,
        keyOnDevice: false,
      });
      expect(await screen.findByTestId("home_restore")).toHaveAttribute("href", "/restore");
    });

    // A member's loop never reports, so a null progress must not withhold the
    // one card that tells them why they cannot act.
    it("keeps asking a member with no key here, progress or none", async () => {
      renderFeed(null);
      expect(await screen.findByTestId("home_restore")).toBeInTheDocument();
    });
  });

  // HT-1. Opening a post unmounts the feed, so a re-mount used to start at
  // page one and the top. Both halves come back from the feed's own memory,
  // and they come back on the FIRST render — the pages have to be there
  // before the offset means anything.
  describe("coming back to it", () => {
    function pagedPosts(reads: FeedReads) {
      return rankedFeed(posts(25), reads);
    }

    it("lands the reader back on every page they had loaded", async () => {
      const reads = feedReads();
      server.use(...pagedPosts(reads));
      const first = renderWithProviders(<FeedView />);
      await screen.findByTestId(byNode("feed.card", "p1"));
      intersect(true);
      expect(await screen.findByTestId(byNode("feed.card", "p21"))).toBeInTheDocument();
      first.unmount();

      renderWithProviders(<FeedView />);
      // Synchronously, on the first render: no `find`, no await.
      expect(screen.getByTestId(byNode("feed.card", "p1"))).toBeInTheDocument();
      expect(screen.getByTestId(byNode("feed.card", "p21"))).toBeInTheDocument();
      // And nothing was re-fetched — a fresh ranking would have answered
      // with page one and dropped page two.
      await waitFor(() =>
        expect(reads.windows.map((ids) => `${ids[0]}:${ids.length}`)).toEqual(["p1:20", "p21:5"]),
      );
      expect(reads.ranks).toHaveLength(1);
    });

    it("restores the scroller's offset before anything is painted", async () => {
      const reads = feedReads();
      server.use(...pagedPosts(reads));
      const scroller = document.createElement("div");
      document.body.append(scroller);
      const host = { current: scroller };

      const first = renderWithProviders(
        <ScrollHostProvider value={host}>
          <FeedView />
        </ScrollHostProvider>,
      );
      await screen.findByTestId(byNode("feed.card", "p1"));
      scroller.scrollTop = 1240;
      fireEvent.scroll(scroller);
      await waitFor(() => expect(recallFeed(null)?.place.offset).toBe(1240));
      first.unmount();

      scroller.scrollTop = 0;
      renderWithProviders(
        <ScrollHostProvider value={host}>
          <FeedView />
        </ScrollHostProvider>,
      );
      expect(scroller.scrollTop).toBe(1240);
      scroller.remove();
    });

    // FX-6 (jakob's hand test 2026-10-09): opening a post and coming back
    // landed at the top. The scroller is the shell's, and the page drawn next
    // moves it in its own first commit — Next's navigation scrolls a fresh page
    // to its top from a layout-phase lifecycle — while the leaving feed's passive
    // cleanup has not run yet. A feed still listening then recorded the detail's
    // top, anchored to nothing, over the reader's place. The swap here is one
    // root, as a navigation is: the feed leaves and the next page arrives in the
    // same commit, and the next page's scroll lands before any passive cleanup.
    it("keeps the reader's place through the next page scrolling the shared scroller on its way in", async () => {
      const reads = feedReads();
      server.use(...pagedPosts(reads));
      const scroller = document.createElement("div");
      document.body.append(scroller);
      const host = { current: scroller };
      // The detail page's arrival, as far as the shared scroller sees it.
      function NextPage() {
        useLayoutEffect(() => {
          scroller.scrollTop = 0;
          fireEvent.scroll(scroller);
        }, []);
        return <p data-testid="next-page">Post</p>;
      }
      let navigate: (feed: boolean) => void = () => {};
      function Route() {
        const [feed, setFeed] = useState(true);
        navigate = setFeed;
        return <ScrollHostProvider value={host}>{feed ? <FeedView /> : <NextPage />}</ScrollHostProvider>;
      }

      renderWithProviders(<Route />);
      await screen.findByTestId(byNode("feed.card", "p1"));
      scroller.scrollTop = 1240;
      fireEvent.scroll(scroller);
      await waitFor(() => expect(recallFeed(null)?.place.offset).toBe(1240));

      act(() => navigate(false));
      expect(screen.getByTestId("next-page")).toBeInTheDocument();
      // A measurement the leaving feed scheduled would land within a frame.
      await act(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      expect(recallFeed(null)?.place.offset).toBe(1240);

      act(() => navigate(true));
      // Synchronously, on the first render — and with nothing re-fetched.
      expect(screen.getByTestId(byNode("feed.card", "p1"))).toBeInTheDocument();
      expect(screen.queryByTestId("feed-loading")).not.toBeInTheDocument();
      expect(scroller.scrollTop).toBe(1240);
      expect(reads.ranks).toHaveLength(1);
      expect(reads.windows).toHaveLength(1);
      scroller.remove();
    });

    // F3-1: the restored offset landing before paint is not enough on its
    // own — the collapsing header is `position: sticky`, so at any offset
    // above 0 it paints pinned at the top regardless, until its own scroll
    // listener catches up and hides it. That listener only runs after a real
    // scroll event, which is a frame too late for the first paint — so the
    // header itself must already be told to start gone, synchronously, the
    // same way the offset itself is (`collapsing-top.tsx`'s `initiallyHidden`).
    it("starts the collapsing header already gone when landing away from the top", async () => {
      const reads = feedReads();
      server.use(...pagedPosts(reads));
      const scroller = document.createElement("div");
      document.body.append(scroller);
      const host = { current: scroller };

      const first = renderWithProviders(
        <ScrollHostProvider value={host}>
          <FeedView />
        </ScrollHostProvider>,
      );
      await screen.findByTestId(byNode("feed.card", "p1"));
      scroller.scrollTop = 1240;
      fireEvent.scroll(scroller);
      await waitFor(() => expect(recallFeed(null)?.place.offset).toBe(1240));
      first.unmount();

      scroller.scrollTop = 0;
      renderWithProviders(
        <ScrollHostProvider value={host}>
          <FeedView />
        </ScrollHostProvider>,
      );
      // Synchronously, on the first render: no `find`, no await — a header
      // that is still shown at this point already flashed.
      expect(screen.getByTestId("collapsing-top").className).toContain("-translate-y-");
      scroller.remove();
    });

    it("starts over for a reader who has not been here this load", async () => {
      const reads = feedReads();
      server.use(...pagedPosts(reads));
      renderWithProviders(<FeedView />);
      expect(await screen.findByTestId(byNode("feed.card", "p1"))).toBeInTheDocument();
      expect(reads.ranks).toHaveLength(1);
    });

    // THE MEMORY IS ONE READER'S: the held ranking is cut by its reader's
    // seen record, so another reader never comes back to it.
    it("starts over for a different reader", async () => {
      const reads = feedReads();
      server.use(...pagedPosts(reads));
      const guest = renderWithProviders(<FeedView />);
      await screen.findByTestId(byNode("feed.card", "p1"));
      guest.unmount();

      server.use(meHandler());
      renderWithProviders(<FeedView />, { store: signedInStore() });
      await waitFor(() => expect(reads.ranks).toHaveLength(2));
    });
  });

  // The feed's second refresh route (design readme §13, the bottom bar's
  // re-tap ladder). The browser's own gesture cannot fire here — the document
  // is pinned and closed, so it has no overscroll to give (`shell.tsx`) — so
  // the pull is read off the touch stream, and it belongs to every viewer:
  // reading needs no account, and neither does asking for newer posts.
  describe("pulling down at the top", () => {
    // One object, not one per read: the progress rides `useSyncExternalStore`,
    // and a fresh snapshot every call is an endless render.
    const applicantProgress: RegistrationProgress = {
      kind: "awaitingApproval",
      emailVerified: true,
      keyAttached: true,
      keyOnDevice: true,
    };
    const applicantFlow: RegistrationFlow = {
      progress: () => applicantProgress,
      subscribe: () => () => {},
      ensureAdvancing: () => {},
      consumeLanded: () => false,
      reset: () => {},
    };

    function touch(type: string, clientY: number): Event {
      const event = new Event(type, { bubbles: true });
      const points = [{ clientY }];
      Object.defineProperty(event, "touches", { value: points });
      Object.defineProperty(event, "changedTouches", { value: points });
      return event;
    }

    function pull(scroller: HTMLElement, travel = PULL_THRESHOLD) {
      fireEvent(scroller, touch("touchstart", 100));
      fireEvent(scroller, touch("touchmove", 100 + travel));
      fireEvent(scroller, touch("touchend", 100 + travel));
    }

    function feedIn(options: Parameters<typeof renderWithProviders>[1]) {
      const scroller = document.createElement("div");
      document.body.append(scroller);
      renderWithProviders(
        <ScrollHostProvider value={{ current: scroller }}>
          <FeedView store={fakeIdentityStore()} />
        </ScrollHostProvider>,
        options,
      );
      return scroller;
    }

    function servePosts(calls: { n: number }) {
      server.use(
        ...rankedFeed(() => {
          calls.n += 1;
          return [post(`p${calls.n}`, `Page ${calls.n}`)];
        }),
      );
    }

    it("asks the server again for a signed-in reader", async () => {
      const calls = { n: 0 };
      servePosts(calls);
      server.use(meHandler());
      const scroller = feedIn({ store: signedInStore() });
      await screen.findByTestId(byNode("feed.card", "p1"));

      pull(scroller);
      expect(await screen.findByTestId(byNode("feed.card", "p2"))).toBeInTheDocument();
      scroller.remove();
    });

    it("asks the server again for an applicant", async () => {
      const calls = { n: 0 };
      servePosts(calls);
      server.use(meHandler());
      const scroller = feedIn({ store: signedInStore(), flow: applicantFlow });
      await screen.findByTestId(byNode("feed.card", "p1"));

      pull(scroller);
      expect(await screen.findByTestId(byNode("feed.card", "p2"))).toBeInTheDocument();
      scroller.remove();
    });

    it("asks the server again for a guest", async () => {
      const calls = { n: 0 };
      servePosts(calls);
      const scroller = feedIn(undefined);
      await screen.findByTestId(byNode("feed.card", "p1"));

      pull(scroller);
      expect(await screen.findByTestId(byNode("feed.card", "p2"))).toBeInTheDocument();
      scroller.remove();
    });

    it("says it is asking, in the list's own loading line", async () => {
      const calls = { n: 0 };
      servePosts(calls);
      const scroller = feedIn(undefined);
      await screen.findByTestId(byNode("feed.card", "p1"));

      pull(scroller);
      expect(screen.getByTestId("feed-loading")).toHaveTextContent("Loading…");
      await screen.findByTestId(byNode("feed.card", "p2"));
      expect(screen.queryByTestId("feed-loading")).not.toBeInTheDocument();
      scroller.remove();
    });

    it("takes a short tug for what it is — a scroll, not an ask", async () => {
      const calls = { n: 0 };
      servePosts(calls);
      const scroller = feedIn(undefined);
      await screen.findByTestId(byNode("feed.card", "p1"));

      pull(scroller, PULL_THRESHOLD - 1);
      await waitFor(() => expect(calls.n).toBe(1));
      scroller.remove();
    });

    it("ignores a pull that starts anywhere but the top", async () => {
      const calls = { n: 0 };
      servePosts(calls);
      const scroller = feedIn(undefined);
      await screen.findByTestId(byNode("feed.card", "p1"));

      scroller.scrollTop = 900;
      pull(scroller);
      await waitFor(() => expect(calls.n).toBe(1));
      scroller.remove();
    });
  });

  it("marks a pending post and leaves a landed one unmarked", async () => {
    server.use(...rankedFeed([post("p1", "Settling", true), post("p2", "Final")]));
    renderWithProviders(<FeedView />);
    expect(await screen.findByTestId("feed-post-p1-pending")).toHaveTextContent("Still settling");
    expect(screen.queryByTestId("feed-post-p2-pending")).not.toBeInTheDocument();
    // Shown in full, never held back (design.md §9).
    expect(screen.getByTestId(byNode("feed.card", "p1"))).toHaveTextContent("Settling");
  });

  // The pod down is the server's INTERNAL (§4.5): the house fault, and no
  // other listing standing in for the ranking.
  it("renders the transport error on a fault", async () => {
    const listing = vi.fn();
    server.use(
      graphql.query("FeedRanking", () => HttpResponse.error()),
      graphql.query("Posts", () => {
        listing();
        return HttpResponse.error();
      }),
    );
    renderWithProviders(<FeedView />);
    expect(await screen.findByTestId("feed-transport-error")).toBeInTheDocument();
    expect(listing).not.toHaveBeenCalled();
  });

  it("keeps loaded posts readable and faults at the load-more slot when a page fetch fails", async () => {
    server.use(...rankedFeed(posts(25), feedReads(), { failWindow: (call) => call > 1 }));
    renderWithProviders(<FeedView />);
    await screen.findByTestId(byNode("feed.card", "p1"));
    intersect(true);
    expect(await screen.findByTestId("feed-load-more-error")).toBeInTheDocument();
    // The fault surfaces where the failed fetch was requested — where the page
    // would have been, not the top-of-page banner.
    expect(screen.queryByTestId("feed-transport-error")).not.toBeInTheDocument();
    expect(screen.getByTestId(byNode("feed.card", "p1"))).toBeInTheDocument();
  });

  it("holds the load-more error through a failed retry instead of flashing", async () => {
    server.use(...rankedFeed(posts(25), feedReads(), { failWindow: (call) => call > 1 }));
    renderWithProviders(<FeedView />);
    await screen.findByTestId(byNode("feed.card", "p1"));
    intersect(true);
    await screen.findByTestId("feed-load-more-error");
    fireEvent.click(screen.getByTestId("feed-load-more-retry"));
    expect(screen.getByTestId("feed-load-more-error")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("feed-load-more-retry")).toBeEnabled());
    expect(screen.getByTestId("feed-load-more-error")).toBeInTheDocument();
  });

  it("holds the banner through a failed retry instead of flashing", async () => {
    server.use(graphql.query("FeedRanking", () => HttpResponse.error()));
    renderWithProviders(<FeedView />);
    await screen.findByTestId("feed-transport-error");
    fireEvent.click(screen.getByTestId("feed-retry"));
    // The flag reflects the last completed fetch: still set the moment
    // the retry starts, still set once the retry has also failed.
    expect(screen.getByTestId("feed-transport-error")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("feed-loading")).not.toBeInTheDocument());
    expect(screen.getByTestId("feed-transport-error")).toBeInTheDocument();
  });

  it("clears the load-more error when a retried page fetch succeeds", async () => {
    server.use(...rankedFeed(posts(25), feedReads(), { failWindow: (call) => call === 2 }));
    renderWithProviders(<FeedView />);
    await screen.findByTestId(byNode("feed.card", "p1"));
    intersect(true);
    await screen.findByTestId("feed-load-more-error");
    fireEvent.click(screen.getByTestId("feed-load-more-retry"));
    expect(await screen.findByTestId(byNode("feed.card", "p21"))).toBeInTheDocument();
    expect(screen.queryByTestId("feed-load-more-error")).not.toBeInTheDocument();
    expect(screen.getByTestId(byNode("feed.card", "p1"))).toBeInTheDocument();
  });
});

// THE RANKED FEED'S DATA PATH (ranked-feed packet §4.12, §14.3; RF-5): one
// ranking held, the list derived from it on the device, re-derived without a
// ranking whenever only device axes change. Test names are the packet's.
describe("FeedView's ranked data path", () => {
  beforeEach(() => {
    resetSeenQueueForTests();
    window.localStorage.clear();
    searchParams = new URLSearchParams();
    forgetFeed();
  });

  const markSeenOk = graphql.mutation("MarkSeen", () =>
    HttpResponse.json({
      data: { markSeen: { __typename: "MarkSeenPayload", ok: true, userErrors: [] } },
    }),
  );

  /** Cards on screen, in order. */
  function cardIds(): string[] {
    return [...document.querySelectorAll("[data-seen-id]")].map(
      (card) => card.getAttribute("data-seen-id") ?? "",
    );
  }

  it("the_feed_ranks_once_per_open", async () => {
    const reads = feedReads();
    server.use(...rankedFeed([post("p1", "First"), post("p2", "Second")], reads));
    renderWithProviders(<FeedView />);
    await screen.findByTestId(byNode("feed.card", "p2"));
    expect(cardIds()).toEqual(["p1", "p2"]);
    // The guest ranks the genesis vantage their band names (CD-5).
    expect(reads.ranks).toEqual(["genesis-id"]);
  });

  it("a_borrowing_reader_ranks_the_lenders_view", async () => {
    const reads = feedReads();
    server.use(
      ...rankedFeed([post("p1", "First")], reads),
      meHandler("APPLICANT"),
      borrowedViewHandler({ id: "inv-1", handle: "mira", displayName: "Mira Voss" }),
    );
    renderWithProviders(<FeedView />, { store: signedInStore() });
    await screen.findByTestId(byNode("feed.card", "p1"));
    expect(reads.ranks).toEqual(["inv-1"]);
  });

  it("ranks the reader's own view once nothing is borrowed", async () => {
    const reads = feedReads();
    server.use(
      ...rankedFeed([post("p1", "First")], reads),
      meHandler(),
      borrowedViewHandler(null),
    );
    renderWithProviders(<FeedView />, { store: signedInStore() });
    await screen.findByTestId(byNode("feed.card", "p1"));
    expect(reads.ranks).toEqual(["acct-1"]);
  });

  it("newest_never_reads_the_global_posts_listing", async () => {
    const listing = vi.fn();
    server.use(
      ...rankedFeed([post("p1", "First"), post("p2", "Second")]),
      graphql.query("Posts", () => {
        listing();
        return HttpResponse.error();
      }),
    );
    renderWithProviders(<FeedView />);
    await screen.findByTestId(byNode("feed.card", "p2"));
    act(() => announceFeedDone({ ...FEED_FILTER_DEFAULT, order: "newest" }));
    await waitFor(() => expect(cardIds()).toEqual(["p1", "p2"]));
    expect(listing).not.toHaveBeenCalled();
  });

  // jakob's scenario (PR-48): fetch, scroll Ranked until rows are seen, switch
  // to Newest with a local Done — none of the newly seen rows is in the Newest
  // list, and nothing was asked of the ranker.
  it("a_switch_to_newest_never_shows_what_ranked_scrolling_made_seen", async () => {
    const reads = feedReads();
    server.use(
      ...rankedFeed([post("p1", "First"), post("p2", "Second"), post("p3", "Third")], reads),
      meHandler(),
      borrowedViewHandler(null),
      markSeenOk,
    );
    renderWithProviders(<FeedView />, { store: signedInStore() });
    await screen.findByTestId(byNode("feed.card", "p3"));
    const [first, second] = ["p1", "p2"].map(
      (id) => document.querySelector(`[data-seen-id="${id}"]`) as HTMLElement,
    );
    await whenObserved(first, second);
    act(() =>
      intersectEach([
        { target: first, ratio: 1 },
        { target: second, ratio: 1 },
      ]),
    );
    // W-6: scrolling never deletes the rows under the reader.
    expect(cardIds()).toEqual(["p1", "p2", "p3"]);

    act(() => announceFeedDone({ ...FEED_FILTER_DEFAULT, order: "newest" }));
    await waitFor(() => expect(cardIds()).toEqual(["p3"]));
    expect(reads.ranks).toHaveLength(1);
    // p3 was hydrated with the first window: the re-derive asked for nothing.
    expect(reads.windows).toHaveLength(1);
  });

  it("done_with_only_device_side_changes_never_ranks_and_rederives", async () => {
    const reads = feedReads();
    server.use(
      graphql.query("FeedRanking", ({ variables }) => {
        reads.ranks.push(variables.viewer as string);
        return HttpResponse.json({
          data: {
            feedRanking: {
              __typename: "FeedRanking",
              asOfEpoch: 4,
              entries: [
                { __typename: "FeedEntry", targetId: "p1", kind: "POST", score: 0.9, mark: "FOR", newestIndex: 1 },
                { __typename: "FeedEntry", targetId: "p2", kind: "POST", score: 0.5, mark: null, newestIndex: 0 },
              ],
              settling: [],
            },
          },
        });
      }),
      graphql.query("Feed", ({ variables }) => {
        reads.windows.push(variables.orderedIds as string[]);
        return HttpResponse.json({
          data: windowOf([post("p1", "First"), post("p2", "Second")], variables.orderedIds as string[]),
        });
      }),
    );
    renderWithProviders(<FeedView />);
    await screen.findByTestId(byNode("feed.card", "p2"));
    expect(cardIds()).toEqual(["p1", "p2"]);

    act(() => announceFeedDone({ ...FEED_FILTER_DEFAULT, order: "newest" }));
    await waitFor(() => expect(cardIds()).toEqual(["p2", "p1"]));
    act(() =>
      announceFeedDone({ ...FEED_FILTER_DEFAULT, order: "newest", people: "yourPeople", peopleSign: "for" }),
    );
    await waitFor(() => expect(cardIds()).toEqual(["p1"]));
    expect(reads.ranks).toHaveLength(1);
  });

  it("done_with_a_kinds_or_topic_change_ranks_once", async () => {
    const reads = feedReads();
    const kinds: unknown[] = [];
    // First in the list, so it answers before the shared handler would.
    server.use(
      graphql.query("FeedRanking", ({ variables }) => {
        reads.ranks.push(variables.viewer as string);
        kinds.push(variables.kinds);
        return HttpResponse.json({ data: rankingOf([post("p1", "First")]) });
      }),
      ...rankedFeed([post("p1", "First")], reads),
    );
    renderWithProviders(<FeedView />);
    await screen.findByTestId(byNode("feed.card", "p1"));
    act(() => announceFeedDone({ ...FEED_FILTER_DEFAULT, kinds: ["posts", "comments"] }));
    await waitFor(() => expect(reads.ranks).toHaveLength(2));
    expect(kinds).toEqual([["POST"], ["POST", "COMMENT"]]);
  });

  it("every_kind_off_shows_the_empty_state_and_never_ranks", async () => {
    const reads = feedReads();
    server.use(...rankedFeed([post("p1", "First")], reads));
    renderWithProviders(<FeedView />);
    await screen.findByTestId(byNode("feed.card", "p1"));
    act(() => announceFeedDone({ ...FEED_FILTER_DEFAULT, kinds: [] }));
    expect(await screen.findByTestId("feed-empty")).toBeInTheDocument();
    expect(reads.ranks).toHaveLength(1);
  });

  it("a_failed_refresh_keeps_the_held_snapshot", async () => {
    let ranks = 0;
    server.use(
      graphql.query("FeedRanking", () => {
        ranks += 1;
        return ranks === 1
          ? HttpResponse.json({ data: rankingOf([post("p1", "First")]) })
          : HttpResponse.error();
      }),
      graphql.query("Feed", ({ variables }) =>
        HttpResponse.json({ data: windowOf([post("p1", "First")], variables.orderedIds as string[]) }),
      ),
    );
    const scroller = document.createElement("div");
    document.body.append(scroller);
    renderWithProviders(
      <ScrollHostProvider value={{ current: scroller }}>
        <FeedView store={fakeIdentityStore()} />
      </ScrollHostProvider>,
    );
    await screen.findByTestId(byNode("feed.card", "p1"));
    pullsAtTop(scroller, PULL_THRESHOLD);
    expect(await screen.findByTestId("feed-transport-error")).toBeInTheDocument();
    expect(screen.getByTestId(byNode("feed.card", "p1"))).toBeInTheDocument();
    scroller.remove();
  });

  // PR-55 (i): a fully-closed app reopened ranks again on its first feed view.
  // On the web a cold start is a new page load, which starts with no memory.
  it("a_cold_start_always_refetches_the_ranking", async () => {
    const reads = feedReads();
    server.use(...rankedFeed([post("p1", "First")], reads));
    const before = renderWithProviders(<FeedView />);
    await screen.findByTestId(byNode("feed.card", "p1"));
    before.unmount();
    // The page load ends.
    forgetFeed();

    renderWithProviders(<FeedView />);
    await screen.findByTestId(byNode("feed.card", "p1"));
    await waitFor(() => expect(reads.ranks).toHaveLength(2));
  });

  // PR-55 (ii): a backgrounded app returns in the state it was left in,
  // however long the absence — nothing ranks, nothing moves.
  it("a_return_from_background_keeps_the_held_feed_unfetched", async () => {
    const reads = feedReads();
    server.use(...rankedFeed([post("p1", "First"), post("p2", "Second")], reads));
    renderWithProviders(<FeedView />);
    await screen.findByTestId(byNode("feed.card", "p2"));

    act(() => setsPageVisibility("hidden"));
    act(() => {
      setsPageVisibility("visible");
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("pageshow"));
    });
    await act(() => new Promise((done) => setTimeout(done, 50)));
    expect(reads.ranks).toHaveLength(1);
    expect(reads.windows).toHaveLength(1);
    expect(cardIds()).toEqual(["p1", "p2"]);
    expect(screen.queryByTestId("feed-loading")).not.toBeInTheDocument();
  });

  // §4.3: the record is the reader's, on the reader's device — a borrowing
  // applicant cuts their own seeing out of the lender's ranking.
  it("a_borrowing_reader_cuts_their_own_seeing_from_the_lenders_ranking", async () => {
    await seenRecord.use("acct-1");
    await seenRecord.add("acct-1", ["p1"]);
    const reads = feedReads();
    server.use(
      ...rankedFeed([post("p1", "First"), post("p2", "Second")], reads),
      meHandler("APPLICANT"),
      borrowedViewHandler({ id: "inv-1", handle: "mira", displayName: "Mira Voss" }),
    );
    renderWithProviders(<FeedView />, { store: signedInStore() });
    await screen.findByTestId(byNode("feed.card", "p2"));
    expect(reads.ranks).toEqual(["inv-1"]);
    expect(cardIds()).toEqual(["p2"]);
  });

  it("a_session_less_reader_cuts_nothing_for_seen", async () => {
    await seenRecord.use("acct-1");
    await seenRecord.add("acct-1", ["p1"]);
    server.use(...rankedFeed([post("p1", "First"), post("p2", "Second")]));
    renderWithProviders(<FeedView />);
    await screen.findByTestId(byNode("feed.card", "p2"));
    expect(cardIds()).toEqual(["p1", "p2"]);
  });

  it("a_restart_keeps_the_devices_seen_record", async () => {
    // A seeing from before the restart, already on disk under the account.
    await seenRecord.add("acct-1", ["p1"]);
    server.use(
      ...rankedFeed([post("p1", "First"), post("p2", "Second")]),
      meHandler(),
      borrowedViewHandler(null),
    );
    renderWithProviders(<FeedView />, { store: signedInStore() });
    await screen.findByTestId(byNode("feed.card", "p2"));
    expect(cardIds()).toEqual(["p2"]);
  });
});

// THE SEEN TRACKER RIDES THE FEED LIST (History.md:5; `seen-tracker.ts`): a
// post wholly on screen joins History as itself — its id alone, never its
// author's or its tags' — and the list leaving the screen sends it.
describe("FeedView's seen tracker", () => {
  beforeEach(() => {
    resetSeenQueueForTests();
    window.localStorage.clear();
    searchParams = new URLSearchParams();
    forgetFeed();
  });

  it("marks a post seen once it stands wholly in view, and nothing else", async () => {
    const marked: unknown[] = [];
    server.use(
      ...rankedFeed([post("p1", "First", false, [topicClaim("salt")]), post("p2", "Second")]),
      meHandler(),
      graphql.mutation("MarkSeen", ({ variables }) => {
        marked.push(variables.nodes);
        return HttpResponse.json({
          data: { markSeen: { __typename: "MarkSeenPayload", ok: true, userErrors: [] } },
        });
      }),
    );
    const { unmount } = renderWithProviders(<FeedView />, { store: signedInStore() });
    await screen.findByTestId(byNode("feed.card", "p2"));
    const [first, second] = ["p1", "p2"].map(
      (id) => document.querySelector(`[data-seen-id="${id}"]`) as HTMLElement,
    );
    await whenObserved(first, second);
    intersectEach([
      { target: first, ratio: 1 },
      { target: second, ratio: 0.5 },
    ]);
    unmount();
    await waitFor(() => expect(marked).toEqual([["p1"]]));
  });
});
