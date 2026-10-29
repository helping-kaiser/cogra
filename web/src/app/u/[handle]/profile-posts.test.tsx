// THE POSTS VIEW, compiled from its sidecar line by line
// (design/designs/canonical/behavior/ProfilePosts.md). Each test names the
// line(s) it holds; the lines another suite holds are named here once so the
// mapping is whole:
//
// - :7-11 (one clip at a time, the hard-top re-election): `StageHost`'s suite
//   (`stage-host` / `stage.test.ts`) — the view wraps its cards in one host,
//   as History and the topic page do.
// - :13 the header block is pinned below with the tab switches; :15, :27 the
//   ⋮ and its menu, :17 the header bar, :29 the figures, :31-35 Message and
//   the guest gate: `profile-view.test.tsx` (they are the profile's, whatever
//   tab stands).
// - :37 the score's lookup law itself: `score-slot.test.tsx`; here, that the
//   view's cards read it.
// - :53-55 the back arrow's noun table: `back-origin.test.ts`; :59 the lit
//   slot: `shell.test.tsx`.

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PostView } from "@/lib/api/content-api";
import { forgetAllProfilePosts } from "@/lib/profile/profile-memory";
import { forgetStream, heldStream, streamBack } from "@/lib/reel/stream-session";
import { forgetStandings, holdRanking } from "@/lib/score/standing";
import { originOf, traceBack } from "@/lib/score/trace-session";
import { createTokenStore } from "@/lib/session/token-store";
import { ScrollHostProvider } from "@/lib/ui/scroll-host";
import { byNode } from "@/test/data-node";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { reelPost } from "@/test/reel";
import { stanceHandlers } from "@/test/stance";
import { ProfileScreen } from "./profile-view";

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
);

const moderated = (value: string | null) => ({ __typename: "ModeratedText", value, status: "NORMAL" });

function person(id: string, handle: string) {
  return {
    __typename: "User",
    id,
    handle,
    displayName: moderated("Ada Okonkwo"),
    bio: moderated("A dozen tries at the third headland light."),
    websiteUrl: moderated(null),
    avatar: null,
    viewerBookmarkedAt: null,
  };
}

const ADA = { __typename: "User", id: "u-ada", handle: "ada", displayName: moderated("Ada Okonkwo"), avatar: null };

/** One of Ada's posts: a clip of `ratio`, or a picture for "photo". */
function adas(id: string, ratio: string | null | "photo" = "photo"): PostView {
  return reelPost(id, ratio, { author: ADA });
}

function signedIn(account = "u1") {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: account });
  return store;
}

function meAs(id: string, handle: string) {
  return gqlLink.query("Me", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id,
          handle,
          displayName: { __typename: "ModeratedText", value: null },
          accountState: "MEMBER",
          hasReciprocated: true,
          vouchBackDismissed: false,
          invitedBy: null,
        },
      },
    }),
  );
}

type PostsRead = { id: string; after: string | null };

/** Serves the posts view's pages, keyed by the cursor they continue from. */
function servePosts(pages: Record<string, { posts: PostView[]; next: string | null } | "down">): PostsRead[] {
  const reads: PostsRead[] = [];
  server.use(
    gqlLink.query("ProfilePosts", ({ variables }) => {
      const read = { id: variables.id as string, after: (variables.after as string | null | undefined) ?? null };
      reads.push(read);
      const page = pages[read.after ?? ""];
      if (page === undefined || page === "down") return HttpResponse.error();
      return HttpResponse.json({
        data: {
          user: {
            __typename: "User",
            id: read.id,
            posts: {
              __typename: "RecordConnection",
              edges: page.posts.map((post) => ({
                __typename: "RecordEdge",
                node: { __typename: "Record", id: `rec-${post.id}`, target: post },
              })),
              pageInfo: { __typename: "PageInfo", hasNextPage: page.next !== null, endCursor: page.next },
            },
          },
        },
      });
    }),
  );
  return reads;
}

/** The chronicle's reads, by the family each asked for. */
function serveChronicle(): (string | null)[] {
  const families: (string | null)[] = [];
  server.use(
    gqlLink.query("AuthorRecords", ({ variables }) => {
      families.push((variables as { family: string | null }).family);
      return HttpResponse.json({
        data: {
          records: {
            __typename: "RecordConnection",
            edges: [
              {
                __typename: "RecordEdge",
                node: {
                  __typename: "Record",
                  id: "act:1",
                  family: "PUBLISH",
                  act: "GENESIS",
                  targetId: "mint:act:1",
                  terminalId: null,
                  landedAt: new Date(Date.now() - 86_400_000).toISOString(),
                  pDirected: 0,
                  pInterest: 0,
                  severed: null,
                  target: {
                    __typename: "Post",
                    id: "p1",
                    title: { __typename: "ModeratedText", value: "The long way home" },
                    content: { __typename: "ModeratedText", value: "Body" },
                    removal: null,
                  },
                  terminal: null,
                },
              },
            ],
            pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
          },
        },
      });
    }),
  );
  return families;
}

function serveAda() {
  server.use(gqlLink.query("UserProfile", () => HttpResponse.json({ data: { user: person("u-ada", "ada") } })));
}

function serveOwn() {
  server.use(
    meAs("u-ada", "ada"),
    gqlLink.query("MyProfile", () => HttpResponse.json({ data: { me: person("u-ada", "ada") } })),
  );
}

async function openPostsTab() {
  fireEvent.click(await screen.findByTestId(byNode("profile.tabRow.postsTab")));
  return screen.findByTestId("profile-posts");
}

const cardIds = () =>
  screen.getAllByTestId(byNode("profile.posts.card")).map((card) => card.getAttribute("data-testid-key"));

beforeEach(() => {
  window.localStorage.clear();
  push.mockReset();
  forgetAllProfilePosts();
  forgetStream();
});

afterEach(() => forgetStandings());

describe("ProfilePosts — the posts view (ProfilePosts.md)", () => {
  it("the_posts_view_lists_the_persons_posts_as_post_cards_never_as_chronicle_entries", async () => {
    // ProfilePosts.md:3, in the order the read serves — newest first.
    serveAda();
    serveChronicle();
    const reads = servePosts({ "": { posts: [adas("p2"), adas("p1")], next: null } });
    renderWithProviders(<ProfileScreen handle="ada" />);
    const list = await openPostsTab();
    expect(reads).toEqual([{ id: "u-ada", after: null }]);
    expect(cardIds()).toEqual(["p2", "p1"]);
    // The feed's own card, live: its title, its opinion, its score, its comments.
    expect(screen.getByTestId(byNode("profile.posts.card.title", "p2"))).toHaveTextContent("Clip p2");
    expect(screen.getByTestId(byNode("profile.posts.card.actionRow.score", "p2"))).toBeInTheDocument();
    // Never a chronicle entry.
    expect(within(list).queryByTestId(byNode("profile.chronicle.act", "1"))).toBeNull();
    expect(screen.queryByTestId("profile-chronicle")).toBeNull();
    expect(screen.queryByTestId(byNode("profile.chronicle"))).toBeNull();
  });

  it("reads_nothing_here_yet_the_line_alone_given_no_post", async () => {
    // ProfilePosts.md:5.
    serveAda();
    serveChronicle();
    servePosts({ "": { posts: [], next: null } });
    renderWithProviders(<ProfileScreen handle="ada" />);
    fireEvent.click(await screen.findByTestId(byNode("profile.tabRow.postsTab")));
    const empty = await screen.findByTestId(byNode("profile.posts.empty.title"));
    expect(empty).toHaveTextContent(/^Nothing here yet\.$/);
    expect(screen.queryByTestId("profile-posts")).toBeNull();
  });

  it("the_header_stays_as_it_was_and_the_chronicle_tabs_read_the_chronicle", async () => {
    // ProfilePosts.md:13, :19, :21, :23.
    serveAda();
    const families = serveChronicle();
    const reads = servePosts({ "": { posts: [adas("p1")], next: null } });
    renderWithProviders(<ProfileScreen handle="ada" />);
    const name = await screen.findByTestId(byNode("profile.identity.name"));
    await openPostsTab();
    // The header block is the same element it was — it never re-rendered away.
    expect(screen.getByTestId(byNode("profile.identity.name"))).toBe(name);
    // :23 — tapping the Posts tab on the posts view changes nothing.
    fireEvent.click(screen.getByTestId(byNode("profile.tabRow.postsTab")));
    expect(reads).toHaveLength(1);
    // :19 — Comments: the person's comments, below the same header.
    fireEvent.click(screen.getByTestId(byNode("profile.tabRow.commentsTab")));
    await waitFor(() => expect(families).toEqual([null, "REVIEW"]));
    expect(screen.queryByTestId("profile-posts")).toBeNull();
    expect(screen.getByTestId(byNode("profile.identity.name"))).toBe(name);
    // :21 — Everything: the chronicle.
    fireEvent.click(screen.getByTestId(byNode("profile.tabRow.everythingTab")));
    await waitFor(() => expect(families).toEqual([null, "REVIEW", null]));
    expect(await screen.findByTestId(byNode("profile.chronicle.act", "1"))).toBeInTheDocument();
  });

  it("the_author_chip_on_the_persons_own_card_changes_nothing", async () => {
    // ProfilePosts.md:25.
    serveAda();
    serveChronicle();
    servePosts({ "": { posts: [adas("p1")], next: null } });
    renderWithProviders(<ProfileScreen handle="ada" />);
    await openPostsTab();
    const chip = screen.getByTestId(byNode("profile.posts.card.authorChip", "p1"));
    expect(chip.tagName).not.toBe("A");
    expect(chip.closest("a")).toBeNull();
    expect(chip).toHaveTextContent("@ada");
    fireEvent.click(chip);
    expect(push).not.toHaveBeenCalled();
  });

  it("a_cards_feed_score_is_the_figure_the_latest_fetch_found_a_dash_where_none", async () => {
    // ProfilePosts.md:37.
    holdRanking(
      "u1",
      {
        asOfEpoch: 3,
        entries: [{ targetId: "p2", kind: "POST", score: 15.2, mark: null, newestIndex: 0 }],
        settling: [],
      },
      "u1",
    );
    serveAda();
    serveChronicle();
    servePosts({ "": { posts: [adas("p2"), adas("p1")], next: null } });
    renderWithProviders(<ProfileScreen handle="ada" />, { store: signedIn() });
    await openPostsTab();
    expect(screen.getByTestId(byNode("profile.posts.card.actionRow.score", "p2"))).toHaveTextContent("15.20");
    expect(screen.getByTestId(byNode("profile.posts.card.actionRow.score", "p1"))).toHaveTextContent("—");
  });

  it("a_cards_feed_score_opens_its_trace_back_to_the_profile_or_back_to_your_profile", async () => {
    // ProfilePosts.md:39 (another's), :41 (the reader's own).
    serveAda();
    serveChronicle();
    servePosts({ "": { posts: [adas("p1")], next: null } });
    const other = renderWithProviders(<ProfileScreen handle="ada" />);
    await openPostsTab();
    const from = (slot: HTMLElement) => new URL(slot.getAttribute("href") ?? "", "http://x").searchParams.get("from");
    const theirs = screen.getByTestId(byNode("profile.posts.card.actionRow.score", "p1"));
    expect(theirs.getAttribute("href")).toMatch(/^\/trace\/p1\?/);
    expect(traceBack(originOf(from(theirs))).label).toBe("Back to the profile");
    other.unmount();

    serveOwn();
    renderWithProviders(<ProfileScreen handle={null} />, { store: signedIn("u-ada") });
    await openPostsTab();
    const mine = screen.getByTestId(byNode("profile.posts.card.actionRow.score", "p1"));
    expect(traceBack(originOf(from(mine)))).toEqual({ href: "/profile", label: "Back to your profile" });
  });

  it("a_portrait_clip_on_anothers_profile_opens_the_stream_back_to_the_profile", async () => {
    // ProfilePosts.md:43; Reel.md:3 — the profile's posts, narrowed to their
    // portrait clips in the view's order, continuing through its own pages.
    serveAda();
    serveChronicle();
    const reads = servePosts({
      "": { posts: [adas("v1", "9:16"), adas("w1", "16:9"), adas("p1"), adas("v2", "3:4")], next: "c1" },
      c1: { posts: [adas("v3", "9:16")], next: null },
    });
    renderWithProviders(<ProfileScreen handle="ada" />);
    await openPostsTab();
    // The wide clip and the picture open the post; the portrait clips the stream.
    expect(screen.queryByTestId("profile-post-w1-stream-link")).toBeNull();
    expect(screen.queryByTestId("profile-post-p1-stream-link")).toBeNull();
    const door = screen.getByTestId("profile-post-v2-stream-link");
    expect(door).toHaveAttribute("href", "/reel/v2");
    fireEvent.click(door);
    const stream = heldStream();
    expect(stream?.snapshot.clips.map((clip) => clip.id)).toEqual(["v1", "v2"]);
    expect(stream?.snapshot.index).toBe(1);
    expect(streamBack(stream!.snapshot.origin)).toEqual({ href: "/u/ada", label: "Back to the profile" });
    // Past the page on screen, the stream reads the view's next page.
    act(() => {
      stream!.next();
    });
    await waitFor(() => expect(stream!.snapshot.clips.map((clip) => clip.id)).toEqual(["v1", "v2", "v3"]));
    expect(reads.at(-1)).toEqual({ id: "u-ada", after: "c1" });
  });

  it("a_portrait_clip_on_your_own_profile_opens_the_stream_back_to_your_profile", async () => {
    // ProfilePosts.md:45.
    serveOwn();
    serveChronicle();
    servePosts({ "": { posts: [adas("v1", "9:16")], next: null } });
    renderWithProviders(<ProfileScreen handle={null} />, { store: signedIn("u-ada") });
    await openPostsTab();
    fireEvent.click(screen.getByTestId("profile-post-v1-stream-link"));
    expect(streamBack(heldStream()!.snapshot.origin)).toEqual({ href: "/profile", label: "Back to your profile" });
  });

  it("a_cards_other_media_opens_the_post_back_to_the_profile_or_back_to_your_profile", async () => {
    // ProfilePosts.md:47 (another's), :49 (the reader's own): the post's own
    // route, carrying the origin its back arrow names (`back-origin.ts`).
    serveAda();
    serveChronicle();
    servePosts({ "": { posts: [adas("w1", "16:9"), adas("p1")], next: null } });
    const other = renderWithProviders(<ProfileScreen handle="ada" />);
    await openPostsTab();
    expect(screen.getByTestId("profile-post-w1-link")).toHaveAttribute("href", "/posts/w1?from=u%3Aada");
    expect(screen.getByTestId("profile-post-p1-link")).toHaveAttribute("href", "/posts/p1?from=u%3Aada");
    other.unmount();

    serveOwn();
    renderWithProviders(<ProfileScreen handle={null} />, { store: signedIn("u-ada") });
    await openPostsTab();
    expect(screen.getByTestId("profile-post-p1-link")).toHaveAttribute("href", "/posts/p1?from=profile");
  });

  it("the_way_back_returns_to_the_posts_view_in_the_state_it_was_left", async () => {
    // ProfilePosts.md:51; Reel.md:83 — the stream's back disc closes onto the
    // posts view exactly: its tab, its cards and its paging, never read again,
    // and the profile's own back arrow still names where it was opened from.
    serveAda();
    serveChronicle();
    const reads = servePosts({
      "": { posts: [adas("v1", "9:16"), adas("p1")], next: "c1" },
      c1: { posts: [adas("p0")], next: null },
    });
    const left = renderWithProviders(<ProfileScreen handle="ada" from="saved" />);
    await openPostsTab();
    fireEvent.click(screen.getByTestId("profile-post-v1-stream-link"));
    left.unmount();
    expect(reads).toHaveLength(1);

    // The stream's way back is the profile's route, with no `from` of its own.
    renderWithProviders(<ProfileScreen handle="ada" />);
    expect(screen.getByTestId("profile-posts")).toBeInTheDocument();
    expect(cardIds()).toEqual(["v1", "p1"]);
    expect(screen.getByTestId(byNode("profile.header.back"))).toHaveAttribute("aria-label", "Back to Saved");
    await screen.findByTestId(byNode("profile.identity.name"));
    expect(reads).toHaveLength(1);
  });

  it("a_profile_opened_afresh_or_left_off_the_posts_view_lands_on_everything", async () => {
    // Every profile board draws the reader landing on Everything: the held
    // view is a return's, never a new opening's.
    serveAda();
    const families = serveChronicle();
    servePosts({ "": { posts: [adas("p1")], next: null } });
    const first = renderWithProviders(<ProfileScreen handle="ada" from="saved" />);
    await openPostsTab();
    first.unmount();
    // Opened from another list, it is a new opening.
    const fresh = renderWithProviders(<ProfileScreen handle="ada" from="history" />);
    await screen.findByTestId(byNode("profile.chronicle.act", "1"));
    expect(screen.queryByTestId("profile-posts")).toBeNull();
    fresh.unmount();
    // And the fresh opening let the held view go.
    renderWithProviders(<ProfileScreen handle="ada" />);
    await screen.findByTestId(byNode("profile.chronicle.act", "1"));
    expect(screen.queryByTestId("profile-posts")).toBeNull();
    expect(families.every((family) => family === null)).toBe(true);
  });

  it("the_next_page_arrives_in_place_and_a_failed_one_says_so_with_retry", async () => {
    // Profile.md:29, :35 — the posts view pages the profile's way.
    serveAda();
    serveChronicle();
    const reads = servePosts({ "": { posts: [adas("p2")], next: "c1" }, c1: "down" });
    const scroller = document.createElement("div");
    document.body.append(scroller);
    renderWithProviders(
      <ScrollHostProvider value={{ current: scroller }}>
        <ProfileScreen handle="ada" />
      </ScrollHostProvider>,
    );
    await openPostsTab();
    const { intersect } = await import("@/test/media-env");
    act(() => intersect(true));
    await waitFor(() => expect(reads.at(-1)).toEqual({ id: "u-ada", after: "c1" }));
    const line = await screen.findByTestId("profile-rows-failed");
    expect(line).toHaveTextContent("Couldn't load more");
    servePosts({ c1: { posts: [adas("p1")], next: null } });
    fireEvent.click(screen.getByTestId("profile-rows-retry"));
    await waitFor(() => expect(cardIds()).toEqual(["p2", "p1"]));
    scroller.remove();
  });

  it("a_pull_at_the_top_refreshes_the_profile_and_keeps_the_posts_view", async () => {
    // ProfilePosts.md:57.
    serveAda();
    const families = serveChronicle();
    const reads = servePosts({ "": { posts: [adas("p1")], next: null } });
    const scroller = document.createElement("div");
    document.body.append(scroller);
    renderWithProviders(
      <ScrollHostProvider value={{ current: scroller }}>
        <ProfileScreen handle="ada" />
      </ScrollHostProvider>,
    );
    await openPostsTab();
    const { pullsAtTop } = await import("@/test/media-env");
    const { PULL_THRESHOLD } = await import("@/lib/ui/pull-to-refresh");
    pullsAtTop(scroller, PULL_THRESHOLD);
    await waitFor(() => expect(reads).toHaveLength(2));
    expect(screen.getByTestId("profile-posts")).toBeInTheDocument();
    expect(families).toEqual([null]);
    scroller.remove();
  });
});
