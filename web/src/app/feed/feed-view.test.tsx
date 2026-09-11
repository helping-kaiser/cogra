import { fireEvent, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { fakeIdentityStore } from "@/test/identity";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { stanceHandlers } from "@/test/stance";
import { FeedView } from "./feed-view";
import { forgetFeed, recallFeed } from "./feed-memory";
import { ScrollHostProvider } from "@/lib/ui/scroll-host";
import type { RegistrationFlow } from "@/lib/signing/registration-flow";
import type { RegistrationProgress } from "@/lib/signing/registration-signer";

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
  vantage: { id: string; handle: string; displayName: string | null } | null = {
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
    attachments: [],
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

function postsPage(nodes: ReturnType<typeof post>[], endCursor: string | null, hasNext: boolean) {
  return {
    posts: {
      __typename: "PostConnection",
      edges: nodes.map((node) => ({ __typename: "PostEdge", node })),
      pageInfo: { __typename: "PageInfo", hasNextPage: hasNext, endCursor },
    },
  };
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
      graphql.query("Posts", () => HttpResponse.json({ data: postsPage([post("p1", "First")], null, false) })),
    );
    server.use(meHandler());
    renderWithProviders(<FeedView />, { store: signedInStore() });
    expect(await screen.findByTestId("feed-post-p1")).toHaveTextContent("First");
    expect(screen.queryByTestId("feed-borrowed-view-action")).not.toBeInTheDocument();
    expect(screen.getByTestId("feed-post-p1-link")).toHaveAttribute("href", "/posts/p1");
    expect(screen.queryByTestId("feed-empty")).not.toBeInTheDocument();
  });

  // A FEED POST IS A FULL-WIDTH CONTAINER with 8px of surface as the seam
  // (design/readme.md, "Feed containers — rounded full-width cards"): the list
  // leaves the gutter its neighbours keep, so a card runs edge to edge.
  it("runs its cards edge to edge with the ruled 8px seam", async () => {
    server.use(
      graphql.query("Posts", () =>
        HttpResponse.json({ data: postsPage([post("p1", "First")], null, false) }),
      ),
    );
    renderWithProviders(<FeedView />);
    const list = await screen.findByTestId("feed-list");
    expect(list.className).toContain("gap-2");
    expect(list.className).not.toContain("px-6");
  });

  // The card's own header line: the author, and the post's age beside it.
  it("carries the post's age on the card", async () => {
    server.use(
      graphql.query("Posts", () =>
        HttpResponse.json({ data: postsPage([post("p1", "First")], null, false) }),
      ),
    );
    renderWithProviders(<FeedView />);
    const stamp = await screen.findByTestId("feed-post-p1-timestamp");
    expect(stamp).toHaveAttribute("datetime", "2026-08-12T10:00:00Z");
    expect(stamp.textContent).toMatch(/^(now|\d+[mhd])$/);
  });

  // The affordance row: stance, then the comment count, then share — one
  // line, glyph plus number, the count spoken by the accessible name.
  it("carries the comments affordance, leading to the thread", async () => {
    server.use(
      graphql.query("Posts", () =>
        HttpResponse.json({ data: postsPage([post("p1", "First", false, [], 2)], null, false) }),
      ),
    );
    renderWithProviders(<FeedView />);
    const comments = await screen.findByTestId("feed-post-p1-comments");
    expect(comments).toHaveAccessibleName("2 comments");
    expect(comments).toHaveAttribute("href", "/posts/p1");
    expect(comments).toHaveTextContent("2");
  });

  it("shows the comments glyph alone where there are none", async () => {
    server.use(
      graphql.query("Posts", () =>
        HttpResponse.json({ data: postsPage([post("p1", "First")], null, false) }),
      ),
    );
    renderWithProviders(<FeedView />);
    const comments = await screen.findByTestId("feed-post-p1-comments");
    expect(comments).toHaveAccessibleName("0 comments");
    expect(comments).toHaveTextContent("");
  });

  // Two slots the row is drawn with and cannot fill yet, each absent rather
  // than dead: the Post Score has no field on the contract until slice 3's
  // ranker, and the overflow ⋮ has no menus drawn here yet.
  it("draws neither the Post Score nor the overflow ⋮ until their surfaces exist", async () => {
    server.use(
      graphql.query("Posts", () =>
        HttpResponse.json({ data: postsPage([post("p1", "First")], null, false) }),
      ),
    );
    renderWithProviders(<FeedView />);
    await screen.findByTestId("feed-post-p1");
    expect(screen.queryByTestId("feed-post-p1-score")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("More on this post")).not.toBeInTheDocument();
  });

  it("carries the post's topics on one line, each chip navigating to its topic route", async () => {
    server.use(
      graphql.query("Posts", () =>
        HttpResponse.json({
          data: postsPage([post("p1", "First", false, [topicClaim("rust")])], null, false),
        }),
      ),
    );
    renderWithProviders(<FeedView />);
    expect(await screen.findByTestId("feed-post-p1-topic-rust")).toBeInTheDocument();
    expect(screen.getByTestId("feed-post-p1-topic-rust-link")).toHaveAttribute(
      "href",
      "/topics/rust",
    );
  });

  it("carries a stance control on every post card", async () => {
    server.use(
      graphql.query("Posts", () =>
        HttpResponse.json({ data: postsPage([post("p1", "First"), post("p2", "Second")], null, false) }),
      ),
    );
    server.use(meHandler());
    renderWithProviders(<FeedView />, { store: signedInStore() });
    // Part of the post card's inventory (design.md §6) — and outside the
    // link, since it acts rather than navigates.
    expect(await screen.findByTestId("feed-stance-p1")).toBeInTheDocument();
    expect(screen.getByTestId("feed-stance-p2")).toBeInTheDocument();
    expect(screen.getByTestId("feed-post-p1-link")).not.toContainElement(
      screen.getByTestId("feed-stance-p1"),
    );
  });

  it("wears the viewer's own standing on each card it has one for", async () => {
    // §8.3: at rest the target shows the standing — face, words, and the
    // folded pair — for every card the viewer has a bundle toward.
    server.use(
      graphql.query("Posts", () =>
        HttpResponse.json({ data: postsPage([post("p1", "First"), post("p2", "Second")], null, false) }),
      ),
    );
    server.use(
      meHandler(),
      ...stanceHandlers({ p1: { pDirected: 0.55, pInterest: 0.2, recordCount: 2 } }),
    );
    renderWithProviders(<FeedView />, { store: signedInStore() });
    await waitFor(() =>
      expect(screen.getByTestId("feed-stance-p1")).toHaveTextContent("Like this"),
    );
    expect(screen.getByTestId("feed-stance-p1")).toHaveTextContent("😊");
    expect(screen.getByTestId("feed-stance-p1-resting-exact")).toHaveTextContent("+0.55 / +0.20");
    // A card the viewer has no bundle toward keeps the affordance — a
    // muted face outside the table, never a bare word and never the
    // shrug a zero standing owns (design.md §8.3, §8.4).
    expect(screen.getByTestId("feed-stance-p2")).toHaveTextContent("😐");
    expect(screen.getByTestId("feed-stance-p2")).not.toHaveTextContent("🤷");
    expect(screen.getByTestId("feed-stance-p2")).toHaveTextContent("No stance yet");
  });

  it("offers a guest the stance control, which asks them to join", async () => {
    server.use(
      graphql.query("Posts", () => HttpResponse.json({ data: postsPage([post("p1", "First")], null, false) })),
    );
    renderWithProviders(<FeedView />);
    fireEvent.click(await screen.findByTestId("feed-stance-p1"));
    expect(await screen.findByTestId("join-prompt")).toBeInTheDocument();
  });

  it("collapses the restore card into the header for a keyless member", async () => {
    server.use(
      graphql.query("Posts", () => HttpResponse.json({ data: postsPage([], null, false) })),
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
      graphql.query("Posts", () => HttpResponse.json({ data: postsPage([post("p1", "First")], null, false) })),
    );
    renderWithProviders(<FeedView />);
    expect(await screen.findByTestId("feed-post-p1")).toHaveTextContent("First");

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
      graphql.query("Posts", () => HttpResponse.json({ data: postsPage([], null, false) })),
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

  // Landing grants membership; the vouch-back is what gives the reader a
  // view of their own (§13). Between them the band still names the inviter.
  it("asks a landed member who has not pointed back to vouch back", async () => {
    server.use(
      graphql.query("Posts", () => HttpResponse.json({ data: postsPage([], null, false) })),
    );
    server.use(
      meHandler(),
      borrowedViewHandler({ id: "inv-1", handle: "mira", displayName: "Mira Voss" }),
    );
    renderWithProviders(<FeedView />, { store: signedInStore() });

    expect(await screen.findByTestId("feed-borrowed-view-line")).toHaveTextContent(
      "Browsing from @mira's view — vouch back to start your own.",
    );
    // The reciprocation card below carries the control; the band names it.
    expect(screen.queryByTestId("feed-borrowed-view-action")).not.toBeInTheDocument();
  });

  it("shows no band to a reader whose view is their own", async () => {
    server.use(
      graphql.query("Posts", () => HttpResponse.json({ data: postsPage([], null, false) })),
    );
    server.use(meHandler(), borrowedViewHandler(null));
    renderWithProviders(<FeedView />, { store: signedInStore() });
    expect(await screen.findByTestId("feed-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("feed-borrowed-view")).not.toBeInTheDocument();
  });

  it("carries no back arrow — the feed is a tab root for every viewer", async () => {
    server.use(
      graphql.query("Posts", () => HttpResponse.json({ data: postsPage([], null, false) })),
    );
    renderWithProviders(<FeedView />);
    expect(await screen.findByTestId("feed-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("feed-back")).not.toBeInTheDocument();
  });

  it("shows the empty copy when nothing has landed", async () => {
    server.use(
      graphql.query("Posts", () => HttpResponse.json({ data: postsPage([], null, false) })),
    );
    renderWithProviders(<FeedView />);
    expect(await screen.findByTestId("feed-empty")).toBeInTheDocument();
  });

  it("loads the next page from the cursor", async () => {
    const afters: (string | null)[] = [];
    server.use(
      graphql.query("Posts", ({ variables }) => {
        afters.push((variables.after as string | null) ?? null);
        return HttpResponse.json({
          data:
            variables.after == null
              ? postsPage([post("p1", "First")], "c1", true)
              : postsPage([post("p2", "Second")], null, false),
        });
      }),
    );
    renderWithProviders(<FeedView />);
    fireEvent.click(await screen.findByTestId("feed-load-more"));
    expect(await screen.findByTestId("feed-post-p2")).toBeInTheDocument();
    expect(screen.getByTestId("feed-post-p1")).toBeInTheDocument();
    expect(afters).toEqual([null, "c1"]);
    expect(screen.queryByTestId("feed-load-more")).not.toBeInTheDocument();
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
      server.use(
        graphql.query("Posts", () =>
          HttpResponse.json({ data: postsPage([post("p1", "First")], null, false) }),
        ),
      );
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
      expect(await screen.findByTestId("feed-post-p1")).toBeInTheDocument();
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
    function pagedPosts(afters: (string | null)[]) {
      return graphql.query("Posts", ({ variables }) => {
        afters.push((variables.after as string | null) ?? null);
        return HttpResponse.json({
          data:
            variables.after == null
              ? postsPage([post("p1", "First")], "c1", true)
              : postsPage([post("p2", "Second")], null, false),
        });
      });
    }

    it("lands the reader back on every page they had loaded", async () => {
      const afters: (string | null)[] = [];
      server.use(pagedPosts(afters));
      const first = renderWithProviders(<FeedView />);
      fireEvent.click(await screen.findByTestId("feed-load-more"));
      expect(await screen.findByTestId("feed-post-p2")).toBeInTheDocument();
      first.unmount();

      renderWithProviders(<FeedView />);
      // Synchronously, on the first render: no `find`, no await.
      expect(screen.getByTestId("feed-post-p1")).toBeInTheDocument();
      expect(screen.getByTestId("feed-post-p2")).toBeInTheDocument();
      // And nothing was re-fetched — a cursorless refresh would have answered
      // with page one and dropped page two.
      await waitFor(() => expect(afters).toEqual([null, "c1"]));
    });

    it("restores the scroller's offset before anything is painted", async () => {
      const afters: (string | null)[] = [];
      server.use(pagedPosts(afters));
      const scroller = document.createElement("div");
      document.body.append(scroller);
      const host = { current: scroller };

      const first = renderWithProviders(
        <ScrollHostProvider value={host}>
          <FeedView />
        </ScrollHostProvider>,
      );
      await screen.findByTestId("feed-post-p1");
      scroller.scrollTop = 1240;
      fireEvent.scroll(scroller);
      await waitFor(() => expect(recallFeed()?.offset).toBe(1240));
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

    it("starts over for a reader who has not been here this load", async () => {
      const afters: (string | null)[] = [];
      server.use(pagedPosts(afters));
      renderWithProviders(<FeedView />);
      expect(await screen.findByTestId("feed-post-p1")).toBeInTheDocument();
      expect(afters).toEqual([null]);
    });
  });

  it("marks a pending post and leaves a landed one unmarked", async () => {
    server.use(
      graphql.query("Posts", () =>
        HttpResponse.json({
          data: postsPage([post("p1", "Settling", true), post("p2", "Final")], null, false),
        }),
      ),
    );
    renderWithProviders(<FeedView />);
    expect(await screen.findByTestId("feed-post-p1-pending")).toHaveTextContent("Still settling");
    expect(screen.queryByTestId("feed-post-p2-pending")).not.toBeInTheDocument();
    // Shown in full, never held back (design.md §9).
    expect(screen.getByTestId("feed-post-p1")).toHaveTextContent("Settling");
  });

  // A pending entry sorts above every landed one until it lands, when
  // it drops into landing order — which can put it below the cursor the
  // walk resumes from, so the next page serves it again.
  it("drops an entry the held page already carries when appending", async () => {
    server.use(
      graphql.query("Posts", ({ variables }) =>
        HttpResponse.json({
          data:
            variables.after == null
              ? postsPage([post("p1", "Settling", true), post("p2", "Older")], "c1", true)
              : postsPage([post("p1", "Settling"), post("p3", "Oldest")], null, false),
        }),
      ),
    );
    renderWithProviders(<FeedView />);
    fireEvent.click(await screen.findByTestId("feed-load-more"));
    expect(await screen.findByTestId("feed-post-p3")).toBeInTheDocument();
    expect(screen.getAllByTestId("feed-post-p1")).toHaveLength(1);
    // The held copy stays as it was read — no reconciliation.
    expect(screen.getByTestId("feed-post-p1-pending")).toBeInTheDocument();
  });

  it("renders the transport error on a fault", async () => {
    server.use(graphql.query("Posts", () => HttpResponse.error()));
    renderWithProviders(<FeedView />);
    expect(await screen.findByTestId("feed-transport-error")).toBeInTheDocument();
  });

  it("keeps loaded posts readable and faults at the load-more slot when a page fetch fails", async () => {
    let calls = 0;
    server.use(
      graphql.query("Posts", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ data: postsPage([post("p1", "First")], "c1", true) })
          : HttpResponse.error();
      }),
    );
    renderWithProviders(<FeedView />);
    fireEvent.click(await screen.findByTestId("feed-load-more"));
    expect(await screen.findByTestId("feed-load-more-error")).toBeInTheDocument();
    // The fault surfaces where the failed fetch was requested — at the
    // load-more slot, not the top-of-page banner.
    expect(screen.queryByTestId("feed-transport-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("feed-load-more")).not.toBeInTheDocument();
    expect(screen.getByTestId("feed-post-p1")).toBeInTheDocument();
  });

  it("holds the load-more error through a failed retry instead of flashing", async () => {
    let calls = 0;
    server.use(
      graphql.query("Posts", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ data: postsPage([post("p1", "First")], "c1", true) })
          : HttpResponse.error();
      }),
    );
    renderWithProviders(<FeedView />);
    fireEvent.click(await screen.findByTestId("feed-load-more"));
    await screen.findByTestId("feed-load-more-error");
    fireEvent.click(screen.getByTestId("feed-load-more-retry"));
    expect(screen.getByTestId("feed-load-more-error")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("feed-load-more-retry")).toBeEnabled());
    expect(screen.getByTestId("feed-load-more-error")).toBeInTheDocument();
  });

  it("holds the banner through a failed retry instead of flashing", async () => {
    server.use(graphql.query("Posts", () => HttpResponse.error()));
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
    let calls = 0;
    server.use(
      graphql.query("Posts", () => {
        calls += 1;
        if (calls === 2) return HttpResponse.error();
        return HttpResponse.json({
          data:
            calls === 1
              ? postsPage([post("p1", "First")], "c1", true)
              : postsPage([post("p2", "Second")], null, false),
        });
      }),
    );
    renderWithProviders(<FeedView />);
    fireEvent.click(await screen.findByTestId("feed-load-more"));
    await screen.findByTestId("feed-load-more-error");
    fireEvent.click(screen.getByTestId("feed-load-more-retry"));
    expect(await screen.findByTestId("feed-post-p2")).toBeInTheDocument();
    expect(screen.queryByTestId("feed-load-more-error")).not.toBeInTheDocument();
    expect(screen.getByTestId("feed-post-p1")).toBeInTheDocument();
  });
});
