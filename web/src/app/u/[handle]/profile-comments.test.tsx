// THE COMMENTS VIEW, compiled from its sidecar line by line
// (design/designs/canonical/behavior/ProfileComments.md). Each test names the
// line(s) it holds; the lines another suite holds are named here once so the
// mapping is whole:
//
// - :11 the ⋮ closing the actions row, :13 the header bar, :35 the profile's
//   menu, :37 the figures, :39-43 Message, the guest gate and the guest's
//   stance anchor: `profile-view.test.tsx` (they are the profile's, whatever
//   tab stands).
// - :47 the back arrow's noun table: `back-origin.test.ts`; :53 the lit slot:
//   `shell.test.tsx`.

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { COMMENT_LOCKED } from "@/lib/ui/comment-feed-card";
import { forgetAllProfileViews } from "@/lib/profile/profile-memory";
import { createTokenStore } from "@/lib/session/token-store";
import { ScrollHostProvider } from "@/lib/ui/scroll-host";
import { byNode } from "@/test/data-node";
import { gqlLink, startMswServer } from "@/test/msw";
import { answersComment, commentsPage, profileComment } from "@/test/profile-comment";
import { renderWithProviders } from "@/test/providers";
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

const moderated = (value: string | null, status = "NORMAL") => ({ __typename: "ModeratedText", value, status });

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

function signedIn(account = "u1") {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: account });
  return store;
}

function meAs(id: string, handle: string, accountState: "MEMBER" | "APPLICANT" = "MEMBER") {
  return gqlLink.query("Me", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id,
          handle,
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

type CommentsRead = { id: string; after: string | null };

/** Serves the comments view's pages, keyed by the cursor they continue from. */
function serveComments(
  pages: Record<string, { comments: Record<string, unknown>[]; next: string | null } | "down">,
): CommentsRead[] {
  const reads: CommentsRead[] = [];
  server.use(
    gqlLink.query("ProfileComments", ({ variables }) => {
      const read = { id: variables.id as string, after: (variables.after as string | null | undefined) ?? null };
      reads.push(read);
      const page = pages[read.after ?? ""];
      if (page === undefined || page === "down") return HttpResponse.error();
      return HttpResponse.json({ data: commentsPage(read.id, page.comments, page.next) });
    }),
  );
  return reads;
}

/** The chronicle's reads: one entry per read. */
function serveChronicle(): number[] {
  const reads: number[] = [];
  server.use(
    gqlLink.query("AuthorRecords", () => {
      reads.push(reads.length);
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
                  family: "REVIEW",
                  act: "GENESIS",
                  targetId: "p1",
                  terminalId: "mint:act:1",
                  landedAt: new Date(Date.now() - 86_400_000).toISOString(),
                  pDirected: 0,
                  pInterest: 0,
                  severed: null,
                  target: null,
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
  return reads;
}

function servePostsTab() {
  server.use(
    gqlLink.query("ProfilePosts", ({ variables }) =>
      HttpResponse.json({
        data: {
          user: {
            __typename: "User",
            id: variables.id,
            posts: {
              __typename: "RecordConnection",
              edges: [],
              pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
            },
          },
        },
      }),
    ),
  );
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

async function openCommentsTab() {
  fireEvent.click(await screen.findByTestId(byNode("profile.tabRow.commentsTab")));
  return screen.findByTestId("profile-comments");
}

const cardIds = () =>
  screen.getAllByTestId(byNode("profile.comments.card")).map((card) => card.getAttribute("data-testid-key"));

const replies = (count: number) => ({ replies: { __typename: "CommentConnection", totalCount: count } });

beforeEach(() => {
  window.localStorage.clear();
  push.mockReset();
  forgetAllProfileViews();
});

describe("ProfileComments — the comments view (ProfileComments.md)", () => {
  it("the_comments_view_lists_the_persons_comments_as_comment_cards_each_in_reach_of_its_thread", async () => {
    // ProfileComments.md:3, in the order the read serves — newest first.
    serveAda();
    serveChronicle();
    const reads = serveComments({ "": { comments: [profileComment("c2"), profileComment("c1")], next: null } });
    renderWithProviders(<ProfileScreen handle="ada" />);
    const list = await openCommentsTab();
    expect(reads).toEqual([{ id: "u-ada", after: null }]);
    expect(cardIds()).toEqual(["c2", "c1"]);
    // The comment card, live: its words, its opinion, its ⋮ — and its thread
    // one tap away.
    const card = screen.getByTestId(byNode("profile.comments.card", "c2"));
    expect(card).toHaveTextContent("Words of c2");
    expect(screen.getByTestId(byNode("profile.comments.card.actionRow.stance", "c2"))).toBeInTheDocument();
    expect(screen.getByTestId(byNode("profile.comments.card.menu", "c2"))).toBeInTheDocument();
    expect(screen.getByTestId(byNode("profile.comments.card.target", "c2"))).toHaveAttribute(
      "href",
      "/posts/p1?comment=c2&from=u%3Aada",
    );
    // Never a chronicle entry.
    expect(within(list).queryByTestId(byNode("profile.chronicle.act", "1"))).toBeNull();
    expect(screen.queryByTestId("profile-chronicle")).toBeNull();
    expect(screen.queryByTestId(byNode("profile.chronicle"))).toBeNull();
    expect(screen.getByTestId(byNode("profile.comments"))).toBeInTheDocument();
  });

  it("a_comment_card_here_leads_with_the_pointer_to_what_it_answers", async () => {
    // ProfileComments.md:5 — a post by its title and author, a comment by its
    // author; the line shape, never the feed's head row.
    serveAda();
    serveChronicle();
    serveComments({
      "": {
        comments: [profileComment("c2"), profileComment("c1", { target: answersComment("c0", "sol") })],
        next: null,
      },
    });
    renderWithProviders(<ProfileScreen handle="ada" />);
    await openCommentsTab();
    const card = screen.getByTestId(byNode("profile.comments.card", "c2"));
    const pointer = screen.getByTestId(byNode("profile.comments.card.target", "c2"));
    expect(card.firstElementChild).toBe(pointer);
    expect(pointer).toHaveTextContent(/^On “The long way home” — @ada$/);
    expect(screen.getByTestId(byNode("profile.comments.card.target", "c1"))).toHaveTextContent(/^On @sol's comment$/);
    expect(screen.queryByTestId("profile-comment-c2-head")).toBeNull();
  });

  it("reads_nothing_here_yet_the_line_alone_given_no_comment", async () => {
    // ProfileComments.md:7.
    serveAda();
    serveChronicle();
    serveComments({ "": { comments: [], next: null } });
    renderWithProviders(<ProfileScreen handle="ada" />);
    fireEvent.click(await screen.findByTestId(byNode("profile.tabRow.commentsTab")));
    const empty = await screen.findByTestId(byNode("profile.comments.empty.title"));
    expect(empty).toHaveTextContent(/^Nothing here yet\.$/);
    expect(screen.queryByTestId("profile-comments")).toBeNull();
  });

  it("the_header_stays_as_it_was_and_the_tabs_read_their_own_views", async () => {
    // ProfileComments.md:9, :15, :17, :19.
    serveAda();
    const chronicle = serveChronicle();
    servePostsTab();
    const reads = serveComments({ "": { comments: [profileComment("c1")], next: null } });
    renderWithProviders(<ProfileScreen handle="ada" />);
    const name = await screen.findByTestId(byNode("profile.identity.name"));
    await openCommentsTab();
    expect(screen.getByTestId(byNode("profile.identity.name"))).toBe(name);
    // :19 — tapping the Comments tab on the comments view changes nothing.
    fireEvent.click(screen.getByTestId(byNode("profile.tabRow.commentsTab")));
    expect(reads).toHaveLength(1);
    expect(cardIds()).toEqual(["c1"]);
    // :15 — Posts: the person's posts, below the same header.
    fireEvent.click(screen.getByTestId(byNode("profile.tabRow.postsTab")));
    expect(await screen.findByTestId(byNode("profile.posts.empty.title"))).toBeInTheDocument();
    expect(screen.queryByTestId("profile-comments")).toBeNull();
    expect(screen.getByTestId(byNode("profile.identity.name"))).toBe(name);
    // :17 — Everything: the chronicle.
    fireEvent.click(screen.getByTestId(byNode("profile.tabRow.everythingTab")));
    expect(await screen.findByTestId(byNode("profile.chronicle.act", "1"))).toBeInTheDocument();
    expect(chronicle).toHaveLength(2);
    expect(screen.getByTestId(byNode("profile.identity.name"))).toBe(name);
  });

  it("the_author_chip_on_the_persons_own_comment_changes_nothing", async () => {
    // ProfileComments.md:21.
    serveAda();
    serveChronicle();
    serveComments({ "": { comments: [profileComment("c1")], next: null } });
    renderWithProviders(<ProfileScreen handle="ada" />);
    await openCommentsTab();
    const chip = screen.getByTestId(byNode("profile.comments.card.authorChip", "c1"));
    expect(chip.tagName).not.toBe("A");
    expect(chip.closest("a")).toBeNull();
    expect(chip).toHaveTextContent("@ada");
    fireEvent.click(chip);
    expect(push).not.toHaveBeenCalled();
  });

  it("the_pointer_reply_and_view_replies_open_the_thread_the_comment_lives_in", async () => {
    // ProfileComments.md:23, :25, :27 — the thread over its post, landed on
    // the comment (a reply's pointer on the comment it answers), its back
    // arrow naming the profile; Reply aims the thread's composer at it.
    server.use(meAs("u1", "pixel"));
    serveAda();
    serveChronicle();
    serveComments({
      "": {
        comments: [
          profileComment("c2", replies(2)),
          profileComment("c1", { target: answersComment("c0", "sol"), ...replies(1) }),
          profileComment("c9"),
        ],
        next: null,
      },
    });
    renderWithProviders(<ProfileScreen handle="ada" />, { store: signedIn() });
    await openCommentsTab();
    const href = (path: string, key: string) => screen.getByTestId(byNode(path, key)).getAttribute("href");
    expect(href("profile.comments.card.target", "c2")).toBe("/posts/p1?comment=c2&from=u%3Aada");
    expect(href("profile.comments.card.target", "c1")).toBe("/posts/p1?comment=c0&from=u%3Aada");
    await waitFor(() =>
      expect(screen.getByTestId(byNode("profile.comments.card.actionRow.reply", "c2"))).toHaveTextContent("Reply"),
    );
    expect(href("profile.comments.card.actionRow.reply", "c2")).toBe("/posts/p1?comment=c2&from=u%3Aada&reply=1");
    const line = screen.getByTestId(byNode("profile.comments.card.viewReplies", "c2"));
    expect(line).toHaveTextContent(/^View 2 replies$/);
    expect(line).toHaveAttribute("href", "/posts/p1?comment=c2&from=u%3Aada");
    expect(screen.getByTestId(byNode("profile.comments.card.viewReplies", "c1"))).toHaveTextContent(/^View 1 reply$/);
    // No replies, no line.
    expect(screen.queryByTestId(byNode("profile.comments.card.viewReplies", "c9"))).toBeNull();
    // The line stands under the card, not in it.
    expect(screen.getByTestId(byNode("profile.comments.card", "c2")).contains(line)).toBe(false);
  });

  it("the_doors_name_your_profile_from_your_own_root", async () => {
    // The thread's back arrow reads `Back to your profile` from the own root.
    serveOwn();
    serveChronicle();
    serveComments({ "": { comments: [profileComment("c1")], next: null } });
    renderWithProviders(<ProfileScreen handle={null} />, { store: signedIn("u-ada") });
    await openCommentsTab();
    expect(screen.getByTestId(byNode("profile.comments.card.target", "c1"))).toHaveAttribute(
      "href",
      "/posts/p1?comment=c1&from=profile",
    );
  });

  it("an_applicants_reply_answers_in_the_snackbar_and_never_opens_the_composer", async () => {
    // ProfileComments.md:29 — locked, not gone (staged-surfaces.md).
    server.use(meAs("u1", "pixel", "APPLICANT"));
    serveAda();
    serveChronicle();
    serveComments({ "": { comments: [profileComment("c1")], next: null } });
    renderWithProviders(<ProfileScreen handle="ada" />, { store: signedIn() });
    await openCommentsTab();
    const reply = await screen.findByTestId(byNode("profile.comments.card.actionRow.reply", "c1"));
    await waitFor(() => expect(reply.tagName).toBe("BUTTON"));
    const locked = screen.getByTestId(byNode("profile.comments.card.actionRow.reply", "c1"));
    expect(locked).not.toHaveAttribute("href");
    expect(locked.className).toContain("opacity-[var(--state-disabled)]");
    fireEvent.click(locked);
    expect(await screen.findByTestId("profile.snackbar.message")).toHaveTextContent(COMMENT_LOCKED);
    expect(COMMENT_LOCKED).toBe("You can comment once you're in.");
    expect(push).not.toHaveBeenCalled();
  });

  it("a_guest_meets_no_reply_as_in_the_thread", async () => {
    serveAda();
    serveChronicle();
    serveComments({ "": { comments: [profileComment("c1")], next: null } });
    renderWithProviders(<ProfileScreen handle="ada" />);
    await openCommentsTab();
    expect(screen.queryByTestId(byNode("profile.comments.card.actionRow.reply", "c1"))).toBeNull();
    // The thread is still in reach through the pointer.
    expect(screen.getByTestId(byNode("profile.comments.card.target", "c1"))).toBeInTheDocument();
  });

  it("the_menu_of_your_own_comment_carries_remove_and_anothers_does_not", async () => {
    // ProfileComments.md:31 (the reader's own), :33 (someone else's).
    serveOwn();
    serveChronicle();
    serveComments({ "": { comments: [profileComment("c1")], next: null } });
    const own = renderWithProviders(<ProfileScreen handle={null} />, { store: signedIn("u-ada") });
    await openCommentsTab();
    fireEvent.click(screen.getByTestId(byNode("profile.comments.card.menu", "c1")));
    const mine = within(screen.getByTestId("profile-comment-c1-menu-sheet")).getAllByRole("button");
    expect(mine.map((row) => row.textContent)).toContain("Remove");
    own.unmount();

    server.use(meAs("u1", "pixel"));
    serveAda();
    renderWithProviders(<ProfileScreen handle="ada" />, { store: signedIn() });
    await openCommentsTab();
    fireEvent.click(screen.getByTestId(byNode("profile.comments.card.menu", "c1")));
    const theirs = within(screen.getByTestId("profile-comment-c1-menu-sheet")).getAllByRole("button");
    expect(theirs.map((row) => row.textContent)).toContain("Opinions on this");
    expect(theirs.map((row) => row.textContent)).not.toContain("Remove");
  });

  it("a_removed_comment_stands_as_its_mark_with_no_menu", async () => {
    // CommentRemoved.md's mark, at comment scale; the node is never deleted.
    serveAda();
    serveChronicle();
    serveComments({
      "": {
        comments: [
          profileComment("c1", {
            content: moderated(null, "REDACTED"),
            removal: { __typename: "Removal", at: new Date().toISOString(), by: "AUTHOR" },
          }),
        ],
        next: null,
      },
    });
    renderWithProviders(<ProfileScreen handle="ada" />);
    await openCommentsTab();
    expect(screen.getByTestId(byNode("profile.comments.card.removalMark", "c1"))).toBeInTheDocument();
    expect(screen.queryByTestId(byNode("profile.comments.card.menu", "c1"))).toBeNull();
    expect(screen.getByTestId(byNode("profile.comments.card.target", "c1"))).toBeInTheDocument();
  });

  it("the_way_back_returns_to_the_comments_view_in_the_state_it_was_left", async () => {
    // ProfileComments.md:45 — a thread's back arrow names the profile by its
    // route alone (`backFor("u:ada")`); the return lands on the comments view,
    // its cards and its paging, never read again, and the profile's own back
    // arrow still names where it was opened from.
    serveAda();
    serveChronicle();
    const reads = serveComments({ "": { comments: [profileComment("c2"), profileComment("c1")], next: "k1" } });
    const left = renderWithProviders(<ProfileScreen handle="ada" from="saved" />);
    await openCommentsTab();
    left.unmount();
    expect(reads).toHaveLength(1);

    renderWithProviders(<ProfileScreen handle="ada" />);
    expect(screen.getByTestId("profile-comments")).toBeInTheDocument();
    expect(cardIds()).toEqual(["c2", "c1"]);
    expect(screen.getByTestId(byNode("profile.tabRow.commentsTab"))).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId(byNode("profile.header.back"))).toHaveAttribute("aria-label", "Back to Saved");
    await screen.findByTestId(byNode("profile.identity.name"));
    expect(reads).toHaveLength(1);
  });

  it("a_cold_entry_reads_back_to_feed_and_leads_to_the_feed", async () => {
    // ProfileComments.md:49.
    serveAda();
    serveChronicle();
    serveComments({ "": { comments: [profileComment("c1")], next: null } });
    renderWithProviders(<ProfileScreen handle="ada" />);
    await openCommentsTab();
    const back = screen.getByTestId(byNode("profile.header.back"));
    expect(back).toHaveAttribute("aria-label", "Back to feed");
    expect(back).toHaveAttribute("href", "/feed");
  });

  it("a_tab_switch_lets_the_held_view_go", async () => {
    serveAda();
    const chronicle = serveChronicle();
    serveComments({ "": { comments: [profileComment("c1")], next: null } });
    const first = renderWithProviders(<ProfileScreen handle="ada" />);
    await openCommentsTab();
    fireEvent.click(screen.getByTestId(byNode("profile.tabRow.everythingTab")));
    await screen.findByTestId(byNode("profile.chronicle.act", "1"));
    first.unmount();
    renderWithProviders(<ProfileScreen handle="ada" />);
    await screen.findByTestId(byNode("profile.chronicle.act", "1"));
    expect(screen.queryByTestId("profile-comments")).toBeNull();
    expect(chronicle).toHaveLength(3);
  });

  it("the_next_page_arrives_in_place_and_a_failed_one_says_so_with_retry", async () => {
    // Profile.md:33, :35 — the comments view pages the profile's way.
    serveAda();
    serveChronicle();
    const reads = serveComments({ "": { comments: [profileComment("c2")], next: "k1" }, k1: "down" });
    const scroller = document.createElement("div");
    document.body.append(scroller);
    renderWithProviders(
      <ScrollHostProvider value={{ current: scroller }}>
        <ProfileScreen handle="ada" />
      </ScrollHostProvider>,
    );
    await openCommentsTab();
    const { intersect } = await import("@/test/media-env");
    act(() => intersect(true));
    await waitFor(() => expect(reads.at(-1)).toEqual({ id: "u-ada", after: "k1" }));
    const line = await screen.findByTestId("profile-rows-failed");
    expect(line).toHaveTextContent("Couldn't load more");
    serveComments({ k1: { comments: [profileComment("c1")], next: null } });
    fireEvent.click(screen.getByTestId("profile-rows-retry"));
    await waitFor(() => expect(cardIds()).toEqual(["c2", "c1"]));
    scroller.remove();
  });

  it("a_pull_at_the_top_refreshes_the_profile_and_keeps_the_comments_view", async () => {
    // ProfileComments.md:51.
    serveAda();
    const chronicle = serveChronicle();
    const reads = serveComments({ "": { comments: [profileComment("c1")], next: null } });
    const scroller = document.createElement("div");
    document.body.append(scroller);
    renderWithProviders(
      <ScrollHostProvider value={{ current: scroller }}>
        <ProfileScreen handle="ada" />
      </ScrollHostProvider>,
    );
    await openCommentsTab();
    const { pullsAtTop } = await import("@/test/media-env");
    const { PULL_THRESHOLD } = await import("@/lib/ui/pull-to-refresh");
    pullsAtTop(scroller, PULL_THRESHOLD);
    await waitFor(() => expect(reads).toHaveLength(2));
    expect(screen.getByTestId("profile-comments")).toBeInTheDocument();
    expect(chronicle).toHaveLength(1);
    scroller.remove();
  });
});
