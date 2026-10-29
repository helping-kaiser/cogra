import { gql, InMemoryCache } from "@apollo/client";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FeedDocument, type FeedQuery } from "@/__generated__/graphql";
import { COMMENT_BODY_MAX_CHARS } from "@/lib/compose/reply-wizard";
import { SENSITIVE_REASON_MAX_CHARS } from "@/lib/compose/wizard";
import { createTokenStore } from "@/lib/session/token-store";
import { writeConfirmMultiAction } from "@/lib/signing/confirm-multi-action";
import { forgetReveals } from "@/lib/ui2/media/reveal";
import { PULL_THRESHOLD } from "@/lib/ui/pull-to-refresh";
import { ScrollHostProvider } from "@/lib/ui/scroll-host";
import { hiddenHandlers, hiddenLog } from "@/test/hidden";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeIdentityStore } from "@/test/identity";
import { fakeWriteSigner } from "@/test/registration";
import { whenObserved } from "@/test/media-env";
import { stanceBundle, stanceHandlers } from "@/test/stance";
import { keepPick } from "@/lib/stance/kept-picks";
import { PostView } from "./post-view";
import { byNode } from "@/test/data-node";
import { bookmarkHandlers, bookmarkLog } from "@/test/saved";
import { citingRecord, citingRecords } from "@/test/inbound";

// The menu rows that go somewhere navigate rather than link, because a sheet
// row is a button — so the router is what a citing or editing row is measured
// against.
const routerPush = vi.fn();
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({
    push: routerPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// The post and every comment read their own standing, so the read is a
// default rather than something each test remembers: an unhandled one
// degrades the control silently instead of failing the test.
//
// Opening a comment's editor reads that comment's OWN sensitive mark for the
// same reason — it is not on the thread read — so it gets the same treatment:
// unmarked by default, and a test that cares says so with its own handler.
const server = startMswServer(
  ...stanceHandlers(),
  gqlLink.query("CommentSelfMark", ({ variables }) =>
    HttpResponse.json({
      data: {
        comment: {
          __typename: "Comment",
          id: variables.id,
          sensitiveSelfMark: false,
          sensitiveReason: null,
        },
      },
    }),
  ),
);

function moderated(value: string | null) {
  return { __typename: "ModeratedText", value, status: "NORMAL" };
}

function landing(pending = false) {
  return { __typename: "Landing", state: pending ? "PENDING" : "LANDED" };
}

function topicClaim(name: string, relevance = 0.4, confidence = 0.9) {
  return {
    __typename: "TopicClaim",
    hashtag: {
      __typename: "Hashtag",
      id: `ht-${name}`,
      name: { __typename: "ModeratedText", value: name, status: "NORMAL" },
    },
    relevance,
    confidence,
    pending: false,
  };
}

type TopicFixture = ReturnType<typeof topicClaim>;

type FixtureComment = {
  id: string;
  body: string;
  authorId?: string;
  edited?: boolean;
  pending?: boolean;
  /** What `CommentConnection.totalCount` reports for this comment's branch. */
  replyCount?: number;
  topics?: TopicFixture[];
  references?: ReferenceFixture[];
  attachments?: unknown[];
  attachmentsStatus?: string;
  /** The node's mark (`Comment.removal`); absent, it stands. */
  removal?: { at: string; by: string };
};

/**
 * A `ReferenceClaim` as the wire serves it: the L1 identifier beside the
 * TYPED target, whose own `id` is the L2 one the prepare verbs take.
 */
function referenceClaim(
  target: Record<string, unknown>,
  relevance = 0.1,
  support = 0.1,
  pending = false,
  withdrawalCost = 1,
) {
  return {
    __typename: "ReferenceClaim",
    targetId: `l1-${target.id as string}`,
    relevance,
    support,
    withdrawalCost,
    pending,
    target,
  };
}

function userTarget(id: string, handle: string) {
  return {
    __typename: "User",
    id,
    handle,
    displayName: { __typename: "ModeratedText", value: handle },
  };
}

function postTarget(id: string, title: string) {
  return {
    __typename: "Post",
    id,
    title: { __typename: "ModeratedText", value: title },
    content: { __typename: "ModeratedText", value: "quoted body" },
    author: { __typename: "User", handle: "carol" },
  };
}

type ReferenceFixture = ReturnType<typeof referenceClaim>;

function commentNode(comment: FixtureComment): Record<string, unknown> {
  return {
    __typename: "Comment",
    id: comment.id,
    content: moderated(comment.body),
    attachments: comment.attachments ?? [],
    attachmentsStatus: comment.attachmentsStatus ?? "NORMAL",
    sensitiveSelfMark: false,
    sensitiveReason: null,
    author: {
      __typename: "User",
      id: comment.authorId ?? "u2",
      handle: "bob",
      displayName: { __typename: "ModeratedText", value: "Bob" },
      avatar: null,
    },
    createdAt: "2026-08-12T10:05:00Z",
    updatedAt: comment.edited ? "2026-08-12T11:00:00Z" : "2026-08-12T10:05:00Z",
    landing: landing(comment.pending),
    moderationStatus: "NORMAL",
    removal: comment.removal ? { __typename: "Removal", ...comment.removal } : null,
    genesisRecordId: `rec-${comment.id}`,
    license: { __typename: "License", attribution: 0, provenance: 0 },
    topics: comment.topics ?? [],
    references: comment.references ?? [],
    // Q49: a comment carries its branch as a COUNT, never as a page — on the
    // thread read and on the expand read alike. `withReplies` is gone with the
    // prefetch; every node answers the same way.
    replies: {
      __typename: "CommentConnection",
      totalCount: comment.replyCount ?? 0,
    },
  };
}

function detail(
  authorId: string,
  comments: FixtureComment[],
  page: { hasNextPage: boolean; endCursor: string | null } = {
    hasNextPage: false,
    endCursor: null,
  },
  postPending = false,
  postTopics: TopicFixture[] = [],
  postReferences: ReferenceFixture[] = [],
  body: {
    description?: string | null;
    content?: string | null;
    attachments?: unknown[];
    attachmentsStatus?: string;
    moderationStatus?: string;
    removal?: { at: string; by: string };
  } = {},
) {
  return {
    post: {
      __typename: "Post",
      id: "p1",
      title: moderated("The title"),
      description: moderated(body.description ?? null),
      content: moderated(body.content === undefined ? "The body" : body.content),
      attachments: body.attachments ?? [],
      attachmentsStatus: body.attachmentsStatus ?? "NORMAL",
      author: {
        __typename: "User",
        id: authorId,
        handle: "alice",
        displayName: { __typename: "ModeratedText", value: "Alice" },
        avatar: null,
      },
      createdAt: "2026-08-12T10:00:00Z",
      updatedAt: "2026-08-12T10:00:00Z",
      landing: landing(postPending),
      moderationStatus: body.moderationStatus ?? "NORMAL",
      removal: body.removal ? { __typename: "Removal", ...body.removal } : null,
      genesisRecordId: "rec-p1",
      license: { __typename: "License", attribution: 0, provenance: 0 },
      topics: postTopics,
      references: postReferences,
      // Not kept: the menu's first row reads Save.
      viewerBookmarkedAt: null,
      // The detail read selects the author's own mark beside the card's
      // fields; an answer without it is one the cache cannot store whole.
      sensitiveSelfMark: false,
      sensitiveReason: null,
      comments: {
        __typename: "CommentConnection",
        // The card's affordance counts the WHOLE thread, not this page.
        totalCount: comments.length,
        edges: comments.map((comment) => ({
          __typename: "CommentEdge",
          node: commentNode(comment),
        })),
        pageInfo: {
          __typename: "PageInfo",
          hasNextPage: page.hasNextPage,
          endCursor: page.endCursor,
        },
      },
    },
  };
}

/** Whatever shape a test's own fixture builder hands back. */
type PostPayload = { post?: Record<string, unknown> | null };

/** The thread's own read, projected off a post fixture so the two agree. */
function commentsOf(data: PostPayload) {
  const post = data.post;
  if (post === null || post === undefined) return { post: null };
  return { post: { __typename: "Post", id: post.id, comments: post.comments } };
}

/** Both reads from one payload, for a test that builds its own fixture. */
function threadFrom(build: () => PostPayload) {
  return [
    gqlLink.query("PostDetail", () => HttpResponse.json({ data: build() })),
    gqlLink.query("PostComments", () => HttpResponse.json({ data: commentsOf(build()) })),
  ];
}

/**
 * THE TWO READS ONE POST FIXTURE ANSWERS.
 *
 * The thread arrives on its own operation, because the sheet is raised from
 * feed cards with no post read behind them at all — so a fixture has to answer
 * `PostComments` as well as `PostDetail` to reach the screen. Projecting both
 * from one payload is what keeps them agreeing.
 */
function thread(...args: Parameters<typeof detail>) {
  const data = detail(...args);
  return [
    gqlLink.query("PostDetail", () => HttpResponse.json({ data })),
    gqlLink.query("PostComments", () => HttpResponse.json({ data: commentsOf(data) })),
  ];
}

/**
 * THE THREAD IS A SHEET (`_shared.jsx:1247-1257`), so a test that reads it
 * opens it the way a reader does — through the affordance row's count.
 */
async function openComments() {
  fireEvent.click(await screen.findByTestId(byNode("postDetail.card.actionRow.comments")));
  const sheet = await screen.findByTestId("postDetail.threadSheet");
  // THE THREAD READS WHEN IT IS RAISED — it is the sheet's own read now, not
  // a slice of the post's — so opening it means waiting for that read, the
  // way a reader waits for the list to land.
  await waitFor(() =>
    expect(screen.queryByTestId("comments-loading")).not.toBeInTheDocument(),
  );
  return sheet;
}

/**
 * THE DETAIL'S ONE MENU SHEET (seam 094 item 64): the post's ⋮ and every
 * comment's raise `postDetail.menuSheet`, so the one standing open is the
 * one a test reads.
 */
function openMenuSheet(): HTMLElement {
  const open = screen
    .getAllByTestId("postDetail.menuSheet")
    .find((sheet) => (sheet as HTMLDialogElement).open);
  if (open === undefined) throw new Error("no postDetail.menuSheet stands open");
  return open;
}

/**
 * THE COMMENT EDIT ADDS A TAG THROUGH THE PICKER (CommentEdit's `+ Add a tag`):
 * the door, the name typed, its row, Done — and the edit is back with the pick
 * staged.
 */
async function addTagThroughPicker(name: string) {
  fireEvent.click(screen.getByTestId("commentEdit.tags.add"));
  fireEvent.change(await screen.findByRole("searchbox", { name: "Name a tag" }), { target: { value: name } });
  fireEvent.click(await screen.findByTestId(byNode("tagPicker.tag", name)));
  fireEvent.click(screen.getByTestId("tagPicker.done"));
  await screen.findByTestId("commentEdit.header");
}

function storeFor(accountId: string) {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId });
  return store;
}

describe("PostView", () => {
  beforeEach(() => {
    window.localStorage.clear();
    routerPush.mockClear();
    // THE REVEAL IS A SESSION, A SUITE IS MANY SESSIONS (`reveal.ts`): every
    // fixture in this file answers to the same post id, so a reveal one test
    // clicks would otherwise stand for every later test that renders the
    // same node id and sensitive signature.
    forgetReveals();
  });

  // The narrow-share fold's own idiom (`post-card.test.tsx`): a test that
  // stubs the viewport or the share capability cleans up after itself, so
  // neither bleeds into the next test in this file.
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true, writable: true });
  });

  it("renders the post with its thread", async () => {
    server.use(
      ...thread("u1", [{ id: "c1", body: "First!" }]),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    await openComments();
    expect(await screen.findByTestId(byNode("postDetail.card.title"))).toHaveTextContent("The title");
    expect(screen.getByTestId(byNode("postDetail.card.body"))).toHaveTextContent("The body");
    expect(screen.getByTestId("post-comment-c1")).toHaveTextContent("First!");
    expect(screen.queryByTestId("post-no-comments")).not.toBeInTheDocument();
  });

  // ROUND 27 REGISTERS `stance.pending` on the detail and the thread: a pick
  // kept pending wears its waiting line under the face, by the shared control.
  it("wears postDetail.card.actionRow.stance.pending and the thread's under a kept pick", async () => {
    await keepPick("u2", { kind: "post", id: "p1" }, { pDirected: 0.4, pInterest: 0.2 });
    await keepPick("u2", { kind: "comment", id: "c1" }, { pDirected: 0.3, pInterest: 0.1 });
    server.use(...thread("u1", [{ id: "c1", body: "First!" }]));
    renderWithProviders(<PostView postId="p1" />, { store: storeFor("u2"), writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId(byNode("postDetail.card.actionRow.stance.pending"))).toHaveTextContent(
      /^Waiting for your (review|key)$/,
    );
    await openComments();
    expect(
      await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.stance.pending", "c1")),
    ).toHaveTextContent(/^Waiting for your (review|key)$/);
  });

  it("carries a stance control on the post and on every comment", async () => {
    server.use(
      ...threadFrom(() => detail("u1", [{ id: "c1", body: "First!", replyCount: 1 }])),
      gqlLink.query("CommentReplies", () =>
        HttpResponse.json({
          data: {
            comment: {
              __typename: "Comment",
              id: "c1",
              replies: {
                __typename: "CommentConnection",
                edges: [
                  { __typename: "CommentEdge", node: commentNode({ id: "c1a", body: "Nested" }) },
                ],
                pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
              },
            },
          },
        }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("u2"),
      writeSigner: fakeWriteSigner(),
    });
    await openComments();
    // Opinion toward any passive node — a post, a comment, a reply
    // (design.md §6; roadmap slice 2.2).
    expect(await screen.findByTestId(byNode("postDetail.card.actionRow.stance.anchor"))).toBeInTheDocument();
    expect(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.stance.anchor", "c1"))).toBeInTheDocument();
    // The reply arrives unfolded, and wears the control like anything else.
    fireEvent.click(screen.getByTestId("replies-more-c1"));
    expect(await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.stance.anchor", "c1a"))).toBeInTheDocument();
  });

  it("wears the viewer's own standing on the post and on a comment", async () => {
    // §8.3: at rest the target shows the standing — on every surface
    // that carries a control, not only on the one it was built for.
    server.use(
      ...threadFrom(() => detail("u1", [{ id: "c1", body: "First!" }])),
      ...stanceHandlers({
        p1: { pDirected: 0.9, pInterest: 0.25, recordCount: 3 },
        c1: { pDirected: -0.55, pInterest: 0.25, recordCount: 1 },
      }),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("u2"),
      writeSigner: fakeWriteSigner(),
    });
    await openComments();
    await waitFor(() => expect(screen.getByTestId(byNode("postDetail.card.actionRow.stance.anchor"))).toHaveAccessibleName(/Love this/));
    expect(screen.getByTestId(byNode("postDetail.card.actionRow.stance.anchor.exact"))).toHaveTextContent("+0.90 / +0.25");
    await waitFor(() =>
      expect(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.stance.anchor", "c1"))).toHaveAccessibleName(/Don't like this/),
    );
    expect(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.stance.anchor.exact", "c1"))).toHaveTextContent(
      "−0.55 / +0.25",
    );
  });

  // The quiet marker in design.md §9's register: the content reads in
  // full either way, and only its place in the order is unsettled.
  it("marks a pending post and a pending comment, leaving landed ones unmarked", async () => {
    server.use(
      ...threadFrom(() => detail(
            "u1",
            [
              { id: "c1", body: "Just signed", pending: true },
              { id: "c2", body: "Long landed" },
            ],
            { hasNextPage: false, endCursor: null },
            true,
          )),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    await openComments();
    expect(await screen.findByTestId("post-pending")).toHaveTextContent("Still settling");
    expect(screen.getByTestId("comment-pending-c1")).toHaveTextContent("Still settling");
    expect(screen.queryByTestId("comment-pending-c2")).not.toBeInTheDocument();
    expect(screen.getByTestId(byNode("postDetail.card.body"))).toHaveTextContent("The body");
    expect(screen.getByTestId("post-comment-c1")).toHaveTextContent("Just signed");
  });

  it("leaves a landed post unmarked", async () => {
    server.use(
      ...thread("u1", [{ id: "c1", body: "First!" }]),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId(byNode("postDetail.card.title"))).toBeInTheDocument();
    expect(screen.queryByTestId("post-pending")).not.toBeInTheDocument();
  });

  // Enforcement inside CoGra reduces to honest display
  // (platform-guidelines.md §5), so the qualifiers ride both the post
  // and every comment.
  // THE TERMS ARE NEVER A STATE OF THE CARD (`ReaderPostMenu.jsx:27-29`): the
  // license is a rare read, so it arrives from the menu in a sheet over the
  // surface the reader asked from, rather than sitting on the post.
  it("keeps the license off the surface, and raises it from the menu's row", async () => {
    server.use(
      ...thread("u1", [{ id: "c1", body: "First!" }]),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    await openComments();
    await screen.findByTestId(byNode("postDetail.card.body"));
    expect(screen.queryByTestId("post-license-terms")).not.toBeInTheDocument();
    expect(screen.queryByTestId("comment-license-terms-c1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId(byNode("postDetail.header.menu")));
    fireEvent.click(screen.getByTestId("postDetail.menuSheet.license"));
    expect(screen.getByTestId("postDetail.licenseSheet.terms")).toHaveTextContent("Public domain");
    expect(screen.getByTestId("postDetail.licenseSheet.terms.publicDomain")).toHaveTextContent(
      "Public domain",
    );
    // Raised from the post's own menu, over the page — never stacked
    // (design/readme.md:2364).
    expect(screen.getByTestId("postDetail.licenseSheet").className).not.toContain(
      "bg-surface-container-highest",
    );
    expect(screen.getByTestId("postDetail.licenseSheet.dragHandle")).toBeInTheDocument();
    // The legacy ids are retired: the registered paths are the only names.
    expect(screen.queryByTestId("post-menu-license-sheet")).not.toBeInTheDocument();
    expect(screen.queryByTestId("post-menu-license-sheet-terms")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("post-menu-license-sheet-terms-public-domain"),
    ).not.toBeInTheDocument();
  });

  // The terms' two rows are the registered keyed `axis`
  // (design/readme.md round 10: `credit`, `public-record-of-use`).
  it("names the post's license rows by their registered axis keys", async () => {
    server.use(...thread("u1", [{ id: "c1", body: "First!" }]));
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    await openComments();
    await screen.findByTestId(byNode("postDetail.card.body"));
    fireEvent.click(screen.getByTestId(byNode("postDetail.header.menu")));
    fireEvent.click(screen.getByTestId("postDetail.menuSheet.license"));
    const credit = screen.getByTestId(byNode("postDetail.licenseSheet.terms.axis", "credit"));
    expect(
      within(credit).getByTestId(byNode("postDetail.licenseSheet.terms.axis.label", "credit")),
    ).toHaveTextContent("Credit");
    expect(
      within(credit).getByTestId(byNode("postDetail.licenseSheet.terms.axis.value", "credit")),
    ).toHaveTextContent("Not required");
    const record = screen.getByTestId(
      byNode("postDetail.licenseSheet.terms.axis", "public-record-of-use"),
    );
    expect(
      within(record).getByTestId(
        byNode("postDetail.licenseSheet.terms.axis.label", "public-record-of-use"),
      ),
    ).toHaveTextContent("Public record of use");
    expect(
      within(record).getByTestId(
        byNode("postDetail.licenseSheet.terms.axis.value", "public-record-of-use"),
      ),
    ).toHaveTextContent("Not logged");
  });

  it("raises a comment's own terms from the comment's menu", async () => {
    server.use(
      ...thread("u1", [{ id: "c1", body: "First!" }]),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    await openComments();
    await screen.findByTestId(byNode("postDetail.card.body"));
    fireEvent.click(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.menu", "c1")));
    // The comment's own menu is a sheet over the comments thread's sheet,
    // and takes the next tonal rung (`CommentMenu.jsx`, design/readme.md:2364).
    expect(openMenuSheet().className).toContain(
      "bg-surface-container-highest",
    );
    fireEvent.click(screen.getByTestId("comment-menu-license-c1"));
    expect(screen.getByTestId("postDetail.licenseSheet.terms")).toHaveTextContent("Public domain");
    expect(screen.getByTestId("postDetail.licenseSheet.terms.publicDomain")).toHaveTextContent(
      "Public domain",
    );
    // Raised from a comment's menu, over the comments thread — stacked
    // (`CommentLicense.jsx`, design/readme.md:2364).
    expect(screen.getByTestId("postDetail.licenseSheet").className).toContain(
      "bg-surface-container-highest",
    );
    expect(screen.getByTestId("postDetail.licenseSheet.dragHandle")).toBeInTheDocument();
    // The legacy ids are retired: the registered paths are the only names.
    expect(screen.queryByTestId("license-sheet")).not.toBeInTheDocument();
    expect(screen.queryByTestId("license-sheet-terms")).not.toBeInTheDocument();
    expect(screen.queryByTestId("license-sheet-terms-public-domain")).not.toBeInTheDocument();
  });

  // The comment's stacked terms ride the same registered `postDetail.licenseSheet`
  // home, their two rows the keyed `axis` (`CommentLicense`, design/readme.md round 10).
  it("names a comment's license rows by their registered axis keys", async () => {
    server.use(...thread("u1", [{ id: "c1", body: "First!" }]));
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    await openComments();
    await screen.findByTestId(byNode("postDetail.card.body"));
    fireEvent.click(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.menu", "c1")));
    fireEvent.click(screen.getByTestId("comment-menu-license-c1"));
    const credit = screen.getByTestId(byNode("postDetail.licenseSheet.terms.axis", "credit"));
    expect(
      within(credit).getByTestId(byNode("postDetail.licenseSheet.terms.axis.label", "credit")),
    ).toHaveTextContent("Credit");
    expect(
      within(credit).getByTestId(byNode("postDetail.licenseSheet.terms.axis.value", "credit")),
    ).toHaveTextContent("Not required");
    const record = screen.getByTestId(
      byNode("postDetail.licenseSheet.terms.axis", "public-record-of-use"),
    );
    expect(
      within(record).getByTestId(
        byNode("postDetail.licenseSheet.terms.axis.label", "public-record-of-use"),
      ),
    ).toHaveTextContent("Public record of use");
    expect(
      within(record).getByTestId(
        byNode("postDetail.licenseSheet.terms.axis.value", "public-record-of-use"),
      ),
    ).toHaveTextContent("Not logged");
  });

  // The rows are `OWN_POST_MENU` (`_shared.jsx:421-428`): Save · Cite in a
  // new post · Edit · Mark as sensitive · Remove · License terms. Cite
  // takes the reader menu's own position, second, so the thumb finds one
  // row in one place on every menu that has it.
  it("gives the creator the own-post menu, cite in second position", async () => {
    server.use(
      ...thread("acct-1", []),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.click(await screen.findByTestId(byNode("postDetail.header.menu")));
    expect(screen.getByTestId("postDetail.menuSheet.save")).toHaveTextContent("Save");
    expect(screen.getByTestId("postDetail.menuSheet.cite")).toHaveTextContent("Cite in a new post");
    expect(screen.getByTestId("postDetail.menuSheet.edit")).toHaveTextContent("Edit");
    expect(screen.getByTestId("postDetail.menuSheet.markSensitive")).toHaveTextContent(
      "Mark as sensitive",
    );
    expect(screen.getByTestId("postDetail.menuSheet.remove")).toHaveTextContent("Remove");
    expect(screen.getByTestId("postDetail.menuSheet.license")).toHaveTextContent("License terms");
    // A reader's rows are not on an author's menu — nor is Report: a reader
    // has nothing to report themselves for (ruling 75).
    expect(screen.queryByTestId("postDetail.menuSheet.hide")).not.toBeInTheDocument();
    expect(screen.queryByTestId("postDetail.menuSheet.report")).not.toBeInTheDocument();
    const order = Array.from(
      screen.getByTestId("post-menu-sheet-body").querySelectorAll("[data-testid]"),
      (node) => node.getAttribute("data-testid"),
    );
    expect(order).toEqual([
      "postDetail.menuSheet.save",
      "postDetail.menuSheet.cite",
      "postDetail.menuSheet.edit",
      "postDetail.menuSheet.markSensitive",
      "postDetail.menuSheet.remove",
      "postDetail.menuSheet.license",
    ]);
  });

  // The rows are `READER_POST_MENU` (`_shared.jsx:605`): Save · Cite in a new
  // post · Hide @handle · License terms · Report at the sheet tail.
  it("gives a non-creator the reader menu, naming the author in its hide row", async () => {
    server.use(
      ...thread("someone-else", []),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    await openComments();
    expect(await screen.findByTestId("post-no-comments")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(byNode("postDetail.header.menu")));
    expect(screen.getByTestId("postDetail.menuSheet.save")).toHaveTextContent("Save");
    expect(screen.getByTestId("postDetail.menuSheet.cite")).toHaveTextContent("Cite in a new post");
    // `Hide @ada`, never "Hide this author" (`ActorChip.jsx:67`).
    expect(screen.getByTestId("postDetail.menuSheet.hide")).toHaveTextContent(/^Hide @/);
    expect(screen.getByTestId("postDetail.menuSheet.license")).toHaveTextContent("License terms");
    expect(screen.getByTestId("postDetail.menuSheet.report")).toHaveTextContent("Report");
    expect(screen.queryByTestId("postDetail.menuSheet.edit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("postDetail.menuSheet.remove")).not.toBeInTheDocument();
    const order = Array.from(
      screen.getByTestId("post-menu-sheet-body").querySelectorAll("[data-testid]"),
      (node) => node.getAttribute("data-testid"),
    );
    expect(order).toEqual([
      "postDetail.menuSheet.save",
      "postDetail.menuSheet.cite",
      "postDetail.menuSheet.hide",
      "postDetail.menuSheet.license",
      "postDetail.menuSheet.report",
    ]);
  });

  // REPORT, CONFIRMED BEFORE IT GOES (ReportConfirm.md:3-11): the menu closes,
  // `postDetail.reportSheet` rises in its place with nothing sent, and only its
  // commit sends — the page's own snackbar then says `Reported.`.
  it("report_confirm_sends_the_mail_and_snackbars_reported", async () => {
    const targets: string[] = [];
    server.use(
      ...thread("someone-else", []),
      gqlLink.mutation("SendReport", ({ variables }) => {
        targets.push(variables.target as string);
        return HttpResponse.json({
          data: {
            sendReport: {
              __typename: "SendReportPayload",
              reportedAt: "2026-10-13T12:00:00Z",
              userErrors: [],
            },
          },
        });
      }),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.click(await screen.findByTestId(byNode("postDetail.header.menu")));
    fireEvent.click(screen.getByTestId("postDetail.menuSheet.report"));
    const sheet = screen.getByTestId("postDetail.reportSheet") as HTMLDialogElement;
    expect(sheet.open).toBe(true);
    expect(screen.getByTestId("postDetail.reportSheet.title")).toHaveTextContent(
      "Report this post?",
    );
    expect(screen.getByTestId("postDetail.reportSheet.body")).toHaveTextContent(
      "It goes to the people who run CoGra for a look.",
    );
    expect(targets).toEqual([]);

    fireEvent.click(screen.getByTestId("postDetail.reportSheet.report"));
    expect(await screen.findByTestId("postDetail.snackbar.message")).toHaveTextContent(
      "Reported.",
    );
    expect(targets).toEqual(["p1"]);
    await waitFor(() => expect(sheet.open).toBe(false));
  });

  // ReportConfirm.md:15 (FC-G15): a refusal keeps the sheet up and never
  // claims the report went out.
  it("a_rate_limited_report_answers_with_the_no_answer_snackbar", async () => {
    server.use(
      ...thread("someone-else", []),
      gqlLink.mutation("SendReport", () =>
        HttpResponse.json({
          data: null,
          errors: [{ message: "rate limited; retry later", extensions: { code: "RATE_LIMITED" } }],
        }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.click(await screen.findByTestId(byNode("postDetail.header.menu")));
    fireEvent.click(screen.getByTestId("postDetail.menuSheet.report"));
    fireEvent.click(screen.getByTestId("postDetail.reportSheet.report"));
    expect(await screen.findByTestId("postDetail.snackbar.message")).toHaveTextContent(
      "That didn't send. Try again.",
    );
    expect((screen.getByTestId("postDetail.reportSheet") as HTMLDialogElement).open).toBe(true);
  });

  // THE NARROW PHONE'S MENU HOLDS THE SHARE IT TOOK (design/readme.md, jakob
  // 2026-09-17, sharpened 2026-09-22 — PR #794): the detail's page-header
  // menu is the reader's menu too (`_shared.jsx:341-346` — the card's own
  // dot yields to it), so it leads with Share the same way the card's does,
  // strictly below the breakpoint.
  it("leads the detail's reader menu with Share strictly below the narrow breakpoint", async () => {
    vi.stubGlobal("navigator", { share: vi.fn() });
    Object.defineProperty(window, "innerWidth", { value: 359, configurable: true, writable: true });
    server.use(
      ...thread("someone-else", []),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.click(await screen.findByTestId(byNode("postDetail.header.menu")));
    expect(screen.getByTestId("post-menu-share")).toHaveTextContent("Share");
    const order = Array.from(
      screen.getByTestId("post-menu-sheet-body").querySelectorAll("[data-testid]"),
      (node) => node.getAttribute("data-testid"),
    );
    expect(order[0]).toBe("post-menu-share");
  });

  // AT 360 THE WIDE LAYOUT STANDS — the inequality is strict (jakob
  // 2026-09-22): the detail's menu keeps the same rows the wide board draws.
  it("keeps the detail's reader menu free of Share at the breakpoint itself", async () => {
    vi.stubGlobal("navigator", { share: vi.fn() });
    Object.defineProperty(window, "innerWidth", { value: 360, configurable: true, writable: true });
    server.use(
      ...thread("someone-else", []),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.click(await screen.findByTestId(byNode("postDetail.header.menu")));
    expect(screen.queryByTestId("post-menu-share")).not.toBeInTheDocument();
  });

  // The comment's rows are `COMMENT_MENU` (`_shared.jsx:392`) — and the missing
  // Hide row is RULED (jakob 2026-09-12): hiding names an actor, and its route
  // is the commenter's own profile.
  // INBOUND BEFORE OPINIONS (`_shared.jsx:397-413`): `Cited by` sits between
  // the acts and the license, because it is a fact about the artifact where the
  // row under it is a fact about people.
  it("gives a comment Save · Cite · Cited by · Opinions · License, and no Hide", async () => {
    server.use(
      ...thread("u1", [{ id: "c1", body: "First!" }]),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    await openComments();
    await screen.findByTestId(byNode("postDetail.card.body"));
    fireEvent.click(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.menu", "c1")));
    expect(screen.getByTestId("comment-menu-save-c1")).toHaveTextContent("Save");
    expect(screen.getByTestId("comment-menu-cite-c1")).toHaveTextContent("Cite in a new post");
    expect(screen.getByTestId("comment-menu-cited-by-c1")).toHaveTextContent("Cited by");
    expect(screen.getByTestId("comment-menu-opinions-c1")).toHaveTextContent("Opinions on this");
    expect(screen.getByTestId("comment-menu-license-c1")).toHaveTextContent("License terms");
    expect(screen.queryByTestId("comment-menu-hide-c1")).not.toBeInTheDocument();
  });

  // A comment has no count line of its own, so its ⋮ row stands whatever the
  // count is — and is therefore the only door a reader can walk through and
  // find nothing behind it (`CommentCitedByEmpty.jsx`).
  it("opens the cited-by sheet from a comment's menu, stacked over the thread", async () => {
    server.use(
      ...thread("u1", [{ id: "c1", body: "First!" }]),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    await openComments();
    await screen.findByTestId(byNode("postDetail.card.body"));
    fireEvent.click(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.menu", "c1")));
    fireEvent.click(screen.getByTestId("comment-menu-cited-by-c1"));
    expect(await screen.findByTestId("cited-by-sheet-empty")).toHaveTextContent(
      "Nothing cites this yet — yours would be the first.",
    );
    expect(screen.getByTestId("cited-by-sheet").className).toContain(
      "bg-surface-container-highest",
    );
  });

  // CommentOpinionsEmpty.md: the comment's `Opinions on this` row raises the
  // opinions sheet stacked over the thread, titled for a comment, and with
  // nobody holding one it reads the calm empty line.
  it("opens the comment's opinions sheet from its menu, stacked over the thread", async () => {
    server.use(...thread("u1", [{ id: "c1", body: "First!" }]));
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    await openComments();
    await screen.findByTestId(byNode("postDetail.card.body"));
    fireEvent.click(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.menu", "c1")));
    fireEvent.click(screen.getByTestId("comment-menu-opinions-c1"));
    expect(await screen.findByTestId("opinions-sheet-empty")).toHaveTextContent(
      "No opinions yet — yours would be the first.",
    );
    expect(screen.getByRole("dialog", { name: "Opinions on this comment" })).toBeInTheDocument();
    expect(screen.getByTestId("opinions-sheet").className).toContain("bg-surface-container-highest");
    expect(screen.getByTestId("postDetail.threadSheet")).toBeInTheDocument();
  });

  // AT ZERO THERE IS NO ROW, and above it the line opens what it counts.
  it("draws the post's cited-by line only above zero", async () => {
    server.use(
      ...thread("u1", []),
      citingRecords(
        ["sol", "ada", "kel", "mira"].map((author, at) =>
          citingRecord(author, { kind: "post", id: `p-cite-${at}`, title: `Citing ${at}` }, 0.4, 0.2),
        ),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId(byNode("postDetail.card.citedBy"))).toHaveTextContent("Cited by 4");
    // The count rides inside the name: the line's own words are it.
    expect(screen.getByRole("button", { name: "Cited by 4" })).toBeInTheDocument();
  });

  // ReaderPostMenu.md:15 — hiding from the detail keeps the reader on the post;
  // the person leaves the feed, never this page.
  it("hide_from_the_detail_keeps_the_reader_on_the_post", async () => {
    const log = hiddenLog();
    server.use(...thread("someone-else", []), ...hiddenHandlers(log));
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.click(await screen.findByTestId(byNode("postDetail.header.menu")));
    fireEvent.click(screen.getByTestId("postDetail.menuSheet.hide"));
    expect(await screen.findByText(/is hidden — their posts stay out of your feed\.$/)).toBeInTheDocument();
    expect(screen.getByTestId(byNode("postDetail.card.body"))).toBeInTheDocument();
    await waitFor(() => expect(log.hides).toEqual([{ actor: "someone-else", at: null }]));
  });

  /** The detail's post, kept by the reader at `keptAt` (or not kept). */
  function keptThread(keptAt: string | null) {
    return threadFrom(() => {
      const data = detail("someone-else", []);
      return { post: { ...data.post, viewerBookmarkedAt: keptAt } };
    });
  }

  // THE SAVE ACTION (ReaderPostMenu.md:5-13): the row reads Save while the post
  // is not kept; the tap closes the sheet, keeps it and says `Saved.`.
  it("save_row_keeps_the_post_and_snackbars_saved", async () => {
    const log = bookmarkLog();
    server.use(...keptThread(null), ...bookmarkHandlers(log));
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.click(await screen.findByTestId(byNode("postDetail.header.menu")));
    expect(screen.getByTestId("postDetail.menuSheet.save")).toHaveTextContent(/^Save$/);
    fireEvent.click(screen.getByTestId("postDetail.menuSheet.save"));
    expect(await screen.findByTestId("postDetail.snackbar.message")).toHaveTextContent("Saved.");
    expect(screen.queryByTestId("postDetail.snackbar.action")).not.toBeInTheDocument();
    await waitFor(() => expect(log.sets).toEqual([{ node: "p1", at: null }]));
    fireEvent.click(screen.getByTestId(byNode("postDetail.header.menu")));
    expect(screen.getByTestId("postDetail.menuSheet.save")).toHaveTextContent("Unsave");
  });

  // UNSAVE ON A MENU (design digest item 48): the sheet closes and the
  // snackbar reads `Removed from Saved.` with `Undo`, which keeps the post
  // again at its own first time.
  it("unsave_from_a_menu_closes_and_offers_undo", async () => {
    const log = bookmarkLog();
    server.use(...keptThread("2026-10-01T08:00:00Z"), ...bookmarkHandlers(log));
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.click(await screen.findByTestId(byNode("postDetail.header.menu")));
    expect(screen.getByTestId("postDetail.menuSheet.save")).toHaveTextContent("Unsave");
    fireEvent.click(screen.getByTestId("postDetail.menuSheet.save"));
    expect(await screen.findByTestId("postDetail.snackbar.message")).toHaveTextContent(
      "Removed from Saved.",
    );
    await waitFor(() => expect(log.removes).toEqual(["p1"]));
    fireEvent.click(screen.getByTestId("postDetail.snackbar.action"));
    await waitFor(() =>
      expect(log.sets).toEqual([{ node: "p1", at: "2026-10-01T08:00:00Z" }]),
    );
  });

  // A COMFORT THAT FAILS (ReaderPostMenu.md:13; RowSigning.md): the save
  // reverts, the snackbar that announced it clears, and the target's row says
  // `That didn't go through.` with Retry — never the snackbar.
  it("a_failed_save_reverts_and_the_row_says_retry", async () => {
    const log = bookmarkLog();
    server.use(...keptThread(null), ...bookmarkHandlers(log, { failSet: true }));
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.click(await screen.findByTestId(byNode("postDetail.header.menu")));
    fireEvent.click(screen.getByTestId("postDetail.menuSheet.save"));
    const line = await screen.findByTestId("post-row-line");
    expect(line).toHaveTextContent("That didn't go through.");
    expect(line).toHaveAttribute("role", "alert");
    expect(screen.queryByTestId("postDetail.snackbar.message")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId(byNode("postDetail.header.menu")));
    expect(screen.getByTestId("postDetail.menuSheet.save")).toHaveTextContent(/^Save$/);
    // Retry asks the same save again, and signs nothing.
    fireEvent.click(screen.getByTestId("post-row-line-retry"));
    await waitFor(() => expect(log.sets).toHaveLength(2));
  });

  // GuestGate.md:5 — a guest's Save asks them to join and sends nothing.
  it("a_guest_meets_the_ask_on_save", async () => {
    const log = bookmarkLog();
    server.use(...keptThread(null), ...bookmarkHandlers(log));
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    fireEvent.click(await screen.findByTestId(byNode("postDetail.header.menu")));
    fireEvent.click(screen.getByTestId("postDetail.menuSheet.save"));
    expect(await screen.findByTestId("join-prompt")).toBeInTheDocument();
    expect(log.sets).toEqual([]);
  });

  // THE COMMENT MENUS GAIN THE SNACKBAR (design digest item 54): a comment's
  // Save keeps it and says `Saved.` on the thread.
  it("a_comments_save_keeps_it_and_snackbars_saved", async () => {
    const log = bookmarkLog();
    server.use(...thread("u1", [{ id: "c1", body: "First!" }]), ...bookmarkHandlers(log));
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    await openComments();
    fireEvent.click(await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.menu", "c1")));
    fireEvent.click(screen.getByTestId("comment-menu-save-c1"));
    expect(await screen.findByTestId("comment-menu-snackbar")).toHaveTextContent("Saved.");
    await waitFor(() => expect(log.sets).toEqual([{ node: "c1", at: null }]));
  });

  // LANDING ON A COMMENT (jakob 2026-10-01; Saved.md "tap a comment's row"):
  // the thread opens over the post, the reply's branch unfolds, and the reply
  // takes focus.
  it("a_saved_reply_opens_its_thread_landed_on_it", async () => {
    server.use(
      ...thread("u1", [{ id: "c1", body: "Top", replyCount: 1 }]),
      gqlLink.query("CommentParent", ({ variables }) =>
        HttpResponse.json({
          data: {
            comment: {
              __typename: "Comment",
              id: variables.id,
              target:
                variables.id === "r1"
                  ? { __typename: "Comment", id: "c1" }
                  : { __typename: "Post", id: "p1" },
            },
          },
        }),
      ),
      gqlLink.query("CommentReplies", () =>
        HttpResponse.json({
          data: {
            comment: {
              __typename: "Comment",
              id: "c1",
              replies: {
                __typename: "CommentConnection",
                edges: [{ __typename: "CommentEdge", node: commentNode({ id: "r1", body: "nested" }) }],
                pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
              },
            },
          },
        }),
      ),
    );
    renderWithProviders(<PostView postId="p1" landOn="r1" from="saved" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    const reply = await screen.findByTestId("post-comment-r1");
    await waitFor(() => expect(document.activeElement).toBe(reply));
    expect((screen.getByTestId("postDetail.threadSheet") as HTMLDialogElement).open).toBe(true);
  });

  // A SAVED ROW'S DESTINATION NAMES ITS ORIGIN (the origin-naming table).
  it("opened_from_saved_the_back_arrow_reads_back_to_saved", async () => {
    server.use(...thread("someone-else", []));
    renderWithProviders(<PostView postId="p1" from="saved" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    const back = await screen.findByTestId(byNode("postDetail.header.back"));
    expect(back).toHaveAttribute("aria-label", "Back to Saved");
    expect(back).toHaveAttribute("href", "/saved");
  });

  // CONTENT REMOVAL, on the detail and in its thread — compiled 1:1 from
  // RemoveMenu.md:19, Removed.md:3-17, CommentMenuOwn.md:3/:7/:13 and
  // CommentRemoved.md:3-21. The removal itself runs against MSW: the
  // mutation, the node's re-read, and the reads that follow.
  describe("content removal", () => {
    // The removal's own moment, a moment ago — the mark's `when` reads `now`.
    const removedAt = () => new Date(Date.now() - 20_000).toISOString();
    let removals: string[] = [];

    /** The server's side of a taken removal: the verb, and the node's mark after it. */
    function removalHandlers(kind: "post" | "comment", by = "AUTHOR") {
      const at = removedAt();
      return [
        gqlLink.mutation("RemoveContent", ({ variables }) => {
          removals.push(variables.record as string);
          return HttpResponse.json({
            data: {
              removeContent: {
                __typename: "RemoveContentPayload",
                records: [
                  { __typename: "Record", id: variables.record, payloadState: "REDUCED", redactedAt: at },
                ],
                userErrors: [],
              },
            },
          });
        }),
        gqlLink.query(kind === "post" ? "PostRemoval" : "CommentRemoval", ({ variables }) =>
          HttpResponse.json({
            data: {
              [kind]: {
                __typename: kind === "post" ? "Post" : "Comment",
                id: variables.id,
                removal: { __typename: "Removal", at, by },
              },
            },
          }),
        ),
      ];
    }

    beforeEach(() => {
      removals = [];
    });

    /** The own post's menu, up to its Remove. */
    async function raiseRemove() {
      fireEvent.click(await screen.findByTestId(byNode("postDetail.header.menu")));
      // The sheet is named as the board names it (`RemoveMenu.jsx`: "Post actions").
      expect(screen.getByTestId(byNode("postDetail.menuSheet"))).toHaveAccessibleName("Post actions");
      fireEvent.click(screen.getByTestId("postDetail.menuSheet.remove"));
      return screen.getByTestId("postDetail.dialog") as HTMLDialogElement;
    }

    // RemoveMenu.md:19 WHEN tap Remove -> the think-twice dialog opens — and
    // the sheet it was tapped in closes (RemoveMenu, graph:1487).
    it("opens the think-twice dialog from the own menu's Remove, the sheet closing", async () => {
      server.use(...thread("acct-1", []));
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner(),
      });
      const dialog = await raiseRemove();
      expect(dialog.open).toBe(true);
      expect(dialog).toHaveAccessibleName("Remove this post?");
      expect(dialog).toHaveTextContent("This is immediate and permanent.");
      await waitFor(() =>
        expect((screen.getByTestId(byNode("postDetail.menuSheet")) as HTMLDialogElement).open).toBe(false),
      );
    });

    // RemoveConfirm.md:11 WHEN the removal is taken -> the post stands as its
    // mark; Removed.md:3/:7/:11/:13 — the mark in the words' place, its two
    // lines and its moment, back alone in the header, and the skeleton kept.
    it("stands the detail as Removed once the removal is taken", async () => {
      let removed = false;
      server.use(
        ...threadFrom(() =>
          removed
            ? detail("acct-1", [{ id: "c1", body: "First!" }], undefined, false, [], [], {
                content: null,
                removal: { at: removedAt(), by: "AUTHOR" },
              })
            : detail("acct-1", [{ id: "c1", body: "First!" }]),
        ),
        ...removalHandlers("post"),
        citingRecords(
          ["sol", "ada", "kel"].map((author, at) =>
            citingRecord(author, { kind: "post", id: `p-cite-${at}`, title: `Citing ${at}` }, 0.4, 0.2),
          ),
        ),
      );
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner(),
      });
      expect(await screen.findByTestId(byNode("postDetail.card.citedBy"))).toBeInTheDocument();
      const dialog = await raiseRemove();
      removed = true;
      fireEvent.click(screen.getByTestId("postDetail.dialog.remove"));

      const mark = await screen.findByTestId(byNode("postDetail.card.removalMark"));
      await waitFor(() => expect(dialog.isConnected && dialog.open).toBe(false));
      // The whole-chain removal, named by the genesis record.
      expect(removals).toEqual(["rec-p1"]);
      expect(screen.getByTestId(byNode("postDetail.card.removalMark.line"))).toHaveTextContent(
        "Removed by its author",
      );
      expect(screen.getByTestId(byNode("postDetail.card.removalMark.detail"))).toHaveTextContent(
        "The words and pictures are gone. The post's place in the thread, and every response, remain.",
      );
      expect(screen.getByTestId(byNode("postDetail.card.removalMark.when"))).toHaveTextContent("now");
      // Removed.md:9 — never the platform's words.
      expect(mark).not.toHaveTextContent("Removed under the platform's rules");
      // Removed.md:11 — the header carries the way back alone and no menu.
      expect(screen.getByTestId(byNode("postDetail.header.back"))).toBeInTheDocument();
      expect(screen.queryByTestId(byNode("postDetail.header.menu"))).not.toBeInTheDocument();
      // The words are gone, and the cited-by line with them (`PostCard.jsx`).
      expect(screen.queryByTestId(byNode("postDetail.card.title"))).not.toBeInTheDocument();
      expect(screen.queryByTestId(byNode("postDetail.card.body"))).not.toBeInTheDocument();
      expect(screen.queryByTestId(byNode("postDetail.card.citedBy"))).not.toBeInTheDocument();
      // Removed.md:13 — its author chip, its opinion, its comment count (share
      // is capability-gated and untouched by the removal; jsdom has no share door).
      expect(screen.getByTestId(byNode("postDetail.card.authorChip"))).toBeInTheDocument();
      expect(screen.getByTestId(byNode("postDetail.card.actionRow.stance.anchor"))).toBeInTheDocument();
      expect(screen.getByTestId(byNode("postDetail.card.actionRow.comments"))).toBeInTheDocument();
    });

    // Removed.md:15 WHEN tap the comment count -> the thread opens with every
    // response in it.
    it("opens the whole thread from a removed post's comment count", async () => {
      server.use(
        ...thread(
          "acct-1",
          [
            { id: "c1", body: "First!" },
            { id: "c2", body: "Second" },
          ],
          undefined,
          false,
          [],
          [],
          { content: null, removal: { at: removedAt(), by: "AUTHOR" } },
        ),
      );
      renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
      await screen.findByTestId(byNode("postDetail.card.removalMark"));
      await openComments();
      expect(screen.getByTestId("post-comment-c1")).toHaveTextContent("First!");
      expect(screen.getByTestId("post-comment-c2")).toHaveTextContent("Second");
    });

    // Removed.md:5 — swept with its author's account deletion, it reads the
    // author's own mark: AUTHOR and ACCOUNT never branch the words.
    it("reads an account sweep as Removed by its author", async () => {
      server.use(
        ...thread("u1", [], undefined, false, [], [], {
          content: null,
          removal: { at: removedAt(), by: "ACCOUNT" },
        }),
      );
      renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
      expect(await screen.findByTestId(byNode("postDetail.card.removalMark.line"))).toHaveTextContent(
        "Removed by its author",
      );
    });

    // The mark is read off `removal`, never `moderationStatus` (the packet's
    // item 11): a removed post whose fields still read NORMAL wears it.
    it("reads the mark off the node's removal, whatever its fields still say", async () => {
      server.use(
        ...thread("u1", [], undefined, false, [], [], { removal: { at: removedAt(), by: "AUTHOR" } }),
      );
      renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
      expect(await screen.findByTestId(byNode("postDetail.card.removalMark"))).toBeInTheDocument();
      expect(screen.queryByTestId(byNode("postDetail.card.body"))).not.toBeInTheDocument();
    });

    // RM-G8's build word: Removed is the detail in its removed state, so the
    // back arrow names the origin it arrived with (the origin table).
    it("keeps the origin's back label on a removed post", async () => {
      server.use(
        ...thread("u1", [], undefined, false, [], [], {
          content: null,
          removal: { at: removedAt(), by: "AUTHOR" },
        }),
      );
      renderWithProviders(<PostView postId="p1" from="saved" />, { writeSigner: fakeWriteSigner() });
      await screen.findByTestId(byNode("postDetail.card.removalMark"));
      expect(screen.getByTestId(byNode("postDetail.header.back"))).toHaveAttribute(
        "aria-label",
        "Back to Saved",
      );
    });

    // RemoveConfirm.md:13 over the detail: nothing removed, the post whole.
    it("leaves the post whole when the removal does not go through", async () => {
      server.use(...thread("acct-1", []), gqlLink.mutation("RemoveContent", () => HttpResponse.error()));
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner(),
      });
      const dialog = await raiseRemove();
      fireEvent.click(screen.getByTestId("postDetail.dialog.remove"));
      const line = await screen.findByTestId("postDetail.dialog.line");
      expect(line).toHaveTextContent("That didn't send. Try again.");
      // The line is the surface's own slot, between the body and the pair —
      // never a paragraph of the body (DialogSurface's `line`, seam 248).
      expect(screen.getByTestId("postDetail.dialog.body")).not.toContainElement(line);
      expect(line.parentElement).toBe(dialog);
      expect(screen.getByTestId("postDetail.dialog.remove")).toHaveTextContent("Retry");
      expect(dialog.open).toBe(true);
      expect(screen.getByTestId(byNode("postDetail.card.body"))).toHaveTextContent("The body");
      expect(screen.queryByTestId(byNode("postDetail.card.removalMark"))).not.toBeInTheDocument();
    });

    // CommentMenuOwn.md:3 — Save or Unsave, Cite in a new post, Remove, Cited
    // by, Opinions on this, License terms; :7 — no Report row.
    it("gives the reader's own comment the own menu's rows, in order", async () => {
      server.use(...thread("u1", [{ id: "c1", body: "Mine", authorId: "acct-1" }]));
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner(),
      });
      await openComments();
      fireEvent.click(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.menu", "c1")));
      const order = Array.from(
        screen.getByTestId("comment-menu-c1-sheet-body").querySelectorAll("[data-testid]"),
        (node) => node.getAttribute("data-testid"),
      );
      expect(order).toEqual([
        "comment-menu-save-c1",
        "comment-menu-cite-c1",
        "comment-menu-remove-c1",
        "comment-menu-cited-by-c1",
        "comment-menu-opinions-c1",
        "comment-menu-license-c1",
      ]);
      expect(openMenuSheet()).toHaveAccessibleName("Comment actions");
      expect(screen.queryByTestId("comment-menu-report-c1")).not.toBeInTheDocument();
    });

    it("gives someone else's comment no Remove", async () => {
      server.use(...thread("u1", [{ id: "c1", body: "Theirs", authorId: "u2" }]));
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner(),
      });
      await openComments();
      fireEvent.click(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.menu", "c1")));
      expect(screen.queryByTestId("comment-menu-remove-c1")).not.toBeInTheDocument();
    });

    // CommentMenuOwn.md:13 WHEN tap Remove -> the menu closes AND the
    // think-twice dialog comes up over the thread; CommentRemoveConfirm.md:11
    // and CommentRemoved.md:3-19 — the mark in the comment's own place, the
    // card's author, time and place kept, no ⋮ and no Edit, Reply and the face
    // kept, its unfolded replies under it and readable, the thread's place held.
    it("removes the reader's own comment in place, the thread standing as it was", async () => {
      server.use(
        ...thread("u1", [
          { id: "c0", body: "Above" },
          { id: "c1", body: "Mine", authorId: "acct-1", replyCount: 1 },
        ]),
        gqlLink.query("CommentReplies", () =>
          HttpResponse.json({
            data: {
              comment: {
                __typename: "Comment",
                id: "c1",
                replies: {
                  __typename: "CommentConnection",
                  edges: [{ __typename: "CommentEdge", node: commentNode({ id: "c1a", body: "An answer" }) }],
                  pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
                },
              },
            },
          }),
        ),
        ...removalHandlers("comment"),
      );
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner(),
      });
      const sheet = await openComments();
      fireEvent.click(screen.getByTestId("replies-more-c1"));
      expect(await screen.findByTestId("post-comment-c1a")).toHaveTextContent("An answer");
      const scroller = screen.getByTestId("comments-sheet-body");
      scroller.scrollTop = 440;

      fireEvent.click(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.menu", "c1")));
      fireEvent.click(screen.getByTestId("comment-menu-remove-c1"));
      const dialog = screen.getByTestId("postDetail.dialog") as HTMLDialogElement;
      expect(dialog).toHaveAccessibleName("Remove this comment?");
      await waitFor(() =>
        expect(screen.queryAllByTestId("postDetail.menuSheet").some((d) => (d as HTMLDialogElement).open)).toBe(false),
      );
      expect((sheet as HTMLDialogElement).open).toBe(true);

      fireEvent.click(screen.getByTestId("postDetail.dialog.remove"));
      const mark = await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.removalMark", "c1"));
      await waitFor(() => expect(screen.queryByTestId("postDetail.dialog")).not.toBeInTheDocument());
      expect(removals).toEqual(["rec-c1"]);
      expect(mark).toHaveTextContent("Removed by its author");
      expect(mark).toHaveTextContent("The comment's place in the thread, and every response, remain.");
      expect(mark).toHaveTextContent("now");
      const card = screen.getByTestId("post-comment-c1");
      expect(card).not.toHaveTextContent("Mine");
      // :3 its author and its time; :9 no menu; the removed card loses Edit.
      expect(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.authorChip", "c1"))).toBeInTheDocument();
      expect(screen.getByTestId("comment-c1-timestamp")).toBeInTheDocument();
      expect(screen.queryByTestId(byNode("postDetail.threadSheet.commentCard.menu", "c1"))).not.toBeInTheDocument();
      expect(screen.queryByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c1"))).not.toBeInTheDocument();
      // :11 its opinion and its Reply.
      expect(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.stance.anchor", "c1"))).toBeInTheDocument();
      expect(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.reply", "c1"))).toBeInTheDocument();
      // One action row (CommentRemoved): the face leads, Reply at the row's end.
      const row = screen.getByTestId(byNode("postDetail.threadSheet.commentCard.actionRow", "c1"));
      expect(row).toContainElement(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.reply", "c1")));
      expect(row).toContainElement(
        screen.getByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.stance.anchor", "c1")),
      );
      expect(row.className).toContain("justify-between");
      // :15 its replies stay under it, readable; its neighbours untouched.
      expect(screen.getByTestId("post-comment-c1a")).toHaveTextContent("An answer");
      expect(screen.getByTestId("post-comment-c0")).toHaveTextContent("Above");
      // :19 the thread holds the reader's offset, and the sheet stays up.
      expect(scroller.scrollTop).toBe(440);
      expect((sheet as HTMLDialogElement).open).toBe(true);
    });

    // CommentRemoveConfirm.md:13 / :15 — not through, or kept: the thread
    // stands as it was.
    it("leaves the comment whole when the removal does not go through, or is kept", async () => {
      server.use(
        ...thread("u1", [{ id: "c1", body: "Mine", authorId: "acct-1" }]),
        gqlLink.mutation("RemoveContent", () => HttpResponse.error()),
      );
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner(),
      });
      await openComments();
      fireEvent.click(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.menu", "c1")));
      fireEvent.click(screen.getByTestId("comment-menu-remove-c1"));
      fireEvent.click(screen.getByTestId("postDetail.dialog.remove"));
      await waitFor(() =>
        expect(screen.getByTestId("postDetail.dialog.remove")).toHaveTextContent("Retry"),
      );
      expect(screen.queryByTestId(byNode("postDetail.threadSheet.commentCard.removalMark", "c1"))).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId("postDetail.dialog.keep"));
      await waitFor(() => expect(screen.queryByTestId("postDetail.dialog")).not.toBeInTheDocument());
      expect(screen.getByTestId("post-comment-c1")).toHaveTextContent("Mine");
      expect(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.menu", "c1"))).toBeInTheDocument();
    });
  });

  it("serves not-found for an unknown id", async () => {
    server.use(...threadFrom(() => ({ post: null })));
    renderWithProviders(<PostView postId="gone" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("post-not-found")).toBeInTheDocument();
  });

  it("reads without a session and swaps the comment box for the sign-in entry", async () => {
    server.use(
      ...thread("u1", [{ id: "c1", body: "First!" }]),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    await openComments();
    expect(await screen.findByTestId(byNode("postDetail.card.title"))).toHaveTextContent("The title");
    expect(screen.getByTestId("post-comment-c1")).toHaveTextContent("First!");
    expect(screen.queryByTestId("comment-draft")).not.toBeInTheDocument();
    expect(screen.queryByTestId("comment-submit")).not.toBeInTheDocument();
    expect(screen.getByTestId("comment-signin")).toHaveAttribute("href", "/login");
  });

  it("keeps the thread readable and faults at the load-more slot when a comments page fails", async () => {
    let calls = 0;
    const page = detail("u1", [{ id: "c1", body: "First!" }], {
      hasNextPage: true,
      endCursor: "cur1",
    });
    server.use(
      gqlLink.query("PostDetail", () => HttpResponse.json({ data: page })),
      // The thread pages on its OWN read, so the ask that fails is the
      // second one of those — the post underneath is never re-read for it.
      gqlLink.query("PostComments", () => {
        calls += 1;
        return calls === 1 ? HttpResponse.json({ data: commentsOf(page) }) : HttpResponse.error();
      }),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    await openComments();
    fireEvent.click(await screen.findByTestId("post-more-comments"));
    expect(await screen.findByTestId("post-more-comments-error")).toBeInTheDocument();
    // The fault surfaces where the failed fetch was requested — at the
    // load-more slot, not the banner above the thread.
    expect(screen.queryByTestId("post-thread-transport-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("post-more-comments")).not.toBeInTheDocument();
    expect(screen.getByTestId(byNode("postDetail.card.title"))).toHaveTextContent("The title");
    expect(screen.getByTestId("post-comment-c1")).toHaveTextContent("First!");
  });

  it("clears the load-more error when a retried comments page succeeds", async () => {
    let calls = 0;
    const first = detail("u1", [{ id: "c1", body: "First!" }], {
      hasNextPage: true,
      endCursor: "cur1",
    });
    const second = detail("u1", [{ id: "c2", body: "Second!" }]);
    server.use(
      gqlLink.query("PostDetail", () => HttpResponse.json({ data: first })),
      gqlLink.query("PostComments", () => {
        calls += 1;
        if (calls === 2) return HttpResponse.error();
        return HttpResponse.json({ data: commentsOf(calls === 1 ? first : second) });
      }),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    await openComments();
    fireEvent.click(await screen.findByTestId("post-more-comments"));
    await screen.findByTestId("post-more-comments-error");
    fireEvent.click(screen.getByTestId("post-more-comments-retry"));
    expect(await screen.findByTestId("post-comment-c2")).toBeInTheDocument();
    expect(screen.queryByTestId("post-more-comments-error")).not.toBeInTheDocument();
    expect(screen.getByTestId("post-comment-c1")).toBeInTheDocument();
  });

  it("offers a retry on the nothing-loaded transport error and heals from it", async () => {
    let calls = 0;
    server.use(
      gqlLink.query("PostDetail", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.error()
          : HttpResponse.json({ data: detail("u1", [{ id: "c1", body: "First!" }]) });
      }),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("post-transport-error")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("post-retry"));
    expect(await screen.findByTestId(byNode("postDetail.card.title"))).toHaveTextContent("The title");
    expect(screen.queryByTestId("post-transport-error")).not.toBeInTheDocument();
  });

  it("backs to the feed from every branch", async () => {
    server.use(...threadFrom(() => ({ post: null })));
    renderWithProviders(<PostView postId="gone" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("post-not-found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to feed" })).toHaveAttribute("href", "/feed");
  });

  it("marks an edited comment softly and offers the edit to its creator only", async () => {
    server.use(
      ...threadFrom(() => detail("author-1", [
            { id: "c1", body: "mine", authorId: "acct-1", edited: true },
            { id: "c2", body: "theirs" },
          ])),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    await openComments();
    expect(await screen.findByTestId("comment-edited-c1")).toBeInTheDocument();
    expect(screen.queryByTestId("comment-edited-c2")).not.toBeInTheDocument();
    expect(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c1"))).toBeInTheDocument();
    expect(screen.queryByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c2"))).not.toBeInTheDocument();
  });

  it("edits a comment inline and signs the update", async () => {
    let variables: unknown;
    server.use(
      ...threadFrom(() => detail("author-1", [{ id: "c1", body: "old words", authorId: "acct-1" }])),
      gqlLink.mutation("PrepareCommentEdit", ({ variables: v }) => {
        variables = v;
        return HttpResponse.json({
          data: {
            prepareCommentEdit: {
              __typename: "PrepareContentPayload",
              node: "c1",
              writes: [
                {
                  __typename: "PreparedWrite",
                  id: "w1",
                  family: "REVIEW",
                  canonicalProposal: "cHJvcG9zYWw=",
                  gcAfterEpochs: 8,
                },
              ],
              userErrors: [],
            },
          },
        });
      }),
    );
    const signer = fakeWriteSigner();
    renderWithProviders(<PostView postId="p1" />, { store: storeFor("acct-1"), writeSigner: signer });
    await openComments();
    fireEvent.click(await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c1")));
    const input = screen.getByTestId("commentEdit.words.input");
    expect(input).toHaveValue("old words");
    fireEvent.change(input, { target: { value: "better words" } });
    fireEvent.click(screen.getByTestId("commentEdit.sign"));
    await waitFor(() => expect(signer.signStaged).toHaveBeenCalledTimes(1));
    expect(variables).toEqual({
      // The mark is re-stated on the edit: a complete-state write that omitted
      // it would unveil a comment its author had veiled. The gallery is
      // complete state for the same reason — this comment carries none, so an
      // empty gallery is what the edit leaves standing.
      input: {
        id: "c1",
        content: "better words",
        attachments: null,
        sensitive: false,
        sensitiveReason: null,
      },
    });
    // The editor closes and the in-flight notice shows.
    expect(screen.queryByTestId("commentEdit.words.input")).not.toBeInTheDocument();
    expect(screen.getByTestId("comment-signed")).toBeInTheDocument();
  });

  describe("leaving a comment edit (CommentEdit, DiscardConfirm): the edit keeps no draft", () => {
    const ask = () => screen.getByTestId("comment-edit-discard-confirm");

    async function openEdit() {
      let prepared = false;
      server.use(
        ...threadFrom(() =>
          detail("author-1", [{ id: "c1", body: "old words", authorId: "acct-1" }]),
        ),
        gqlLink.mutation("PrepareCommentEdit", () => {
          prepared = true;
          return HttpResponse.json({ data: { prepareCommentEdit: null } });
        }),
      );
      const signer = fakeWriteSigner();
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: signer,
      });
      await openComments();
      fireEvent.click(await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c1")));
      return { signer, wasPrepared: () => prepared };
    }

    it("the_x_is_named_leave_the_edit_is_discarded", async () => {
      await openEdit();
      expect(screen.getByRole("button", { name: "Leave — the edit is discarded" })).toBeVisible();
      expect(screen.queryByRole("button", { name: "Leave — this edit is discarded" })).toBeNull();
    });

    it("an_unchanged_edit_leaves_at_once_by_the_x_and_the_back_arrow", async () => {
      await openEdit();
      fireEvent.click(screen.getByTestId("commentEdit.header.leave"));
      expect(screen.queryByTestId("comment-edit")).not.toBeInTheDocument();
      expect(screen.queryByTestId("comment-edit-discard-confirm")).not.toBeInTheDocument();
      fireEvent.click(await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c1")));
      fireEvent.click(screen.getByTestId("commentEdit.header.back"));
      expect(screen.queryByTestId("comment-edit")).not.toBeInTheDocument();
      expect(screen.queryByTestId("comment-edit-discard-confirm")).not.toBeInTheDocument();
    });

    it("a_changed_edit_asks_discard_the_changes_before_the_x_leaves", async () => {
      await openEdit();
      fireEvent.change(screen.getByTestId("commentEdit.words.input"), {
        target: { value: "better words" },
      });
      fireEvent.click(screen.getByTestId("commentEdit.header.leave"));
      expect(screen.getByTestId("comment-edit")).toBeInTheDocument();
      expect(ask()).toHaveAttribute("open");
      expect(ask()).toHaveTextContent("Discard the changes?");
      expect(ask()).toHaveTextContent("Nothing is kept.");
    });

    it("a_changed_edit_asks_the_same_before_the_back_arrow_leaves", async () => {
      await openEdit();
      fireEvent.change(screen.getByTestId("commentEdit.words.input"), {
        target: { value: "better words" },
      });
      fireEvent.click(screen.getByTestId("commentEdit.header.back"));
      expect(screen.getByTestId("comment-edit")).toBeInTheDocument();
      expect(ask()).toHaveAttribute("open");
    });

    it("keep_writing_closes_the_ask_onto_the_edit_as_it_was", async () => {
      await openEdit();
      const input = screen.getByTestId("commentEdit.words.input");
      fireEvent.change(input, { target: { value: "better words" } });
      fireEvent.click(screen.getByTestId("commentEdit.header.leave"));
      fireEvent.click(screen.getByTestId("comment-edit-discard-confirm-keep"));
      expect(ask()).not.toHaveAttribute("open");
      expect(screen.getByTestId("comment-edit")).toBeInTheDocument();
      expect(input).toHaveValue("better words");
    });

    it("discard_returns_to_the_thread_and_keeps_and_signs_nothing", async () => {
      const { signer, wasPrepared } = await openEdit();
      fireEvent.change(screen.getByTestId("commentEdit.words.input"), {
        target: { value: "better words" },
      });
      fireEvent.click(screen.getByTestId("commentEdit.header.leave"));
      fireEvent.click(screen.getByTestId("comment-edit-discard-confirm-discard"));
      expect(screen.queryByTestId("comment-edit")).not.toBeInTheDocument();
      expect(await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c1"))).toBeInTheDocument();
      expect(screen.getByText("old words")).toBeInTheDocument();
      expect(screen.queryByTestId("comment-signed")).not.toBeInTheDocument();
      expect(wasPrepared()).toBe(false);
      expect(signer.signStaged).not.toHaveBeenCalled();
      // Reopening starts from the comment, not from the discarded words.
      fireEvent.click(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c1")));
      expect(screen.getByTestId("commentEdit.words.input")).toHaveValue("old words");
    });
  });

  // Q49: the thread read carries no replies at all. A branch is a count, and
  // the nodes arrive only for the reader who unfolds one.
  it("collapses a branch behind its count and unfolds it on request", async () => {
    server.use(
      ...threadFrom(() => detail("author-1", [{ id: "c1", body: "top", replyCount: 2 }])),
      gqlLink.query("CommentReplies", () =>
        HttpResponse.json({
          data: {
            comment: {
              __typename: "Comment",
              id: "c1",
              replies: {
                __typename: "CommentConnection",
                edges: [
                  { __typename: "CommentEdge", node: commentNode({ id: "r1", body: "nested" }) },
                  { __typename: "CommentEdge", node: commentNode({ id: "r2", body: "more" }) },
                ],
                pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
              },
            },
          },
        }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    await openComments();

    // Nothing of the branch is on screen, and the line promises the count.
    const unfold = await screen.findByTestId("replies-more-c1");
    expect(unfold).toHaveTextContent("View 2 replies");
    expect(screen.queryByTestId("post-comment-r1")).not.toBeInTheDocument();

    fireEvent.click(unfold);
    expect(await screen.findByTestId("post-comment-r1")).toHaveTextContent("nested");
    expect(screen.getByTestId("post-comment-r2")).toHaveTextContent("more");
    // The whole branch came in one page, so nothing is left to ask for.
    expect(screen.queryByTestId("replies-more-c1")).not.toBeInTheDocument();
  });

  // design/readme.md §13 (2026-08-28), matched by the canonical CommentCard
  // and Android's PostDetailScreen.kt (PR #574): the thread indents ONE
  // level on screen. A reply to a reply flattens into that same level
  // instead of indenting further — its own @handle lead is content the
  // composer prefilled, not something this view generates.
  it("flattens a reply-to-a-reply to the same indent as its parent", async () => {
    server.use(
      ...threadFrom(() => detail("author-1", [{ id: "c1", body: "top", replyCount: 1 }])),
      gqlLink.query("CommentReplies", ({ variables }) => {
        const parentId = variables.id as string;
        if (parentId === "c1") {
          return HttpResponse.json({
            data: {
              comment: {
                __typename: "Comment",
                id: "c1",
                replies: {
                  __typename: "CommentConnection",
                  edges: [
                    {
                      __typename: "CommentEdge",
                      node: commentNode({ id: "r1", body: "@alice nested", replyCount: 1 }),
                    },
                  ],
                  pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
                },
              },
            },
          });
        }
        return HttpResponse.json({
          data: {
            comment: {
              __typename: "Comment",
              id: "r1",
              replies: {
                __typename: "CommentConnection",
                edges: [
                  {
                    __typename: "CommentEdge",
                    node: commentNode({ id: "r1-1", body: "@bob grandchild" }),
                  },
                ],
                pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      }),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    await openComments();

    fireEvent.click(await screen.findByTestId("replies-more-c1"));
    fireEvent.click(await screen.findByTestId("replies-more-r1"));

    const child = await screen.findByTestId("post-comment-r1");
    const grandchild = await screen.findByTestId("post-comment-r1-1");
    expect(grandchild).toHaveTextContent("@bob grandchild");
    // Depth 1 (the child) and depth 2 (the grandchild) draw at the SAME
    // indent — the thread never grows a third rung.
    expect(grandchild.style.marginLeft).toBe(child.style.marginLeft);
    expect(grandchild.style.marginLeft).toBe("12px");
  });

  it("says one reply in the singular", async () => {
    server.use(
      ...threadFrom(() => detail("author-1", [{ id: "c1", body: "top", replyCount: 1 }])),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    await openComments();
    expect(await screen.findByTestId("replies-more-c1")).toHaveTextContent("View 1 reply");
  });

  it("draws no unfold line on a comment nobody answered", async () => {
    server.use(
      ...thread("author-1", [{ id: "c1", body: "top" }]),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    await openComments();
    await screen.findByTestId("post-comment-c1");
    expect(screen.queryByTestId("replies-more-c1")).not.toBeInTheDocument();
  });

  it("wears the standing on a load that starts with no access token", async () => {
    // The state every direct arrival at this URL begins in: the refresh
    // token is persisted, the access token is per-tab memory and this tab
    // has none yet. Nothing on this surface is viewer-scoped except the
    // stance controls — the post and its thread read fine anonymously —
    // so the stance read is the first request that needs a viewer, and it
    // must already be carrying one when it goes.
    window.localStorage.setItem("cogra.activeAccount", "u2");
    window.localStorage.setItem("cogra.refreshToken", "refresh-1");
    const store = createTokenStore();
    expect(store.accessToken()).toBeNull();

    const anonymous: string[] = [];
    const seeded = {
      p1: { pDirected: 1, pInterest: 0.2, recordCount: 3 },
      c1: { pDirected: -0.55, pInterest: 0.25, recordCount: 1 },
    };
    const stanceRoot = (operation: string, field: string, typename: string) =>
      gqlLink.query(operation, ({ variables, request }) => {
        const id = String(variables.id);
        const authorized = request.headers.get("authorization") !== null;
        if (!authorized) anonymous.push(id);
        return HttpResponse.json({
          data: {
            [field]: {
              __typename: typename,
              id,
              // What the server actually answers a request it did not
              // authenticate: a null field, not an error (types.rs
              // `viewer_stance`). Nothing in the errors array means
              // nothing for the guard to react to on its own.
              viewerStance: authorized ? stanceBundle(seeded[id as keyof typeof seeded]) : null,
            },
          },
        });
      });

    server.use(
      ...thread("u1", [{ id: "c1", body: "First!" }]),
      gqlLink.mutation("RefreshSession", () =>
        HttpResponse.json({
          data: {
            refreshSession: {
              __typename: "AuthPayload",
              auth: {
                __typename: "AuthSession",
                accessToken: "access-2",
                refreshToken: "refresh-2",
                user: { __typename: "User", id: "u2" },
              },
              userErrors: [],
            },
          },
        }),
      ),
      stanceRoot("PostStance", "post", "Post"),
      stanceRoot("CommentStance", "comment", "Comment"),
    );

    renderWithProviders(<PostView postId="p1" />, { store, writeSigner: fakeWriteSigner() });
    await openComments();

    // Both controls, because both are viewer-scoped reads on this surface
    // and the defect took the whole class, not the post alone.
    expect(await screen.findByTestId(byNode("postDetail.card.actionRow.stance.anchor.exact"))).toHaveTextContent("+1.00 / +0.20");
    await waitFor(() =>
      expect(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.stance.anchor.exact", "c1"))).toHaveTextContent(
        "−0.55 / +0.25",
      ),
    );
    expect(screen.getByTestId(byNode("postDetail.card.actionRow.stance.anchor"))).toHaveAccessibleName(/Love this/);
    // And no read went out without one: the tab settled its session before
    // it sent anything, so the standing is right on the first answer rather
    // than on a replay of it.
    expect(anonymous).toEqual([]);
    expect(store.accessToken()).toBe("access-2");
  });

  it("shows the read-only chip row for a post the viewer doesn't own", async () => {
    server.use(
      ...threadFrom(() => ({
            ...detail("author-1", []),
            post: {
              ...detail("author-1", []).post,
              topics: [
                {
                  __typename: "TopicClaim",
                  hashtag: {
                    __typename: "Hashtag",
                    id: "ht-1",
                    name: moderated("rust"),
                  },
                  relevance: 0.1,
                  confidence: 1,
                  pending: false,
                },
              ],
            },
          })),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    expect(await screen.findByTestId(byNode("postDetail.card.tagsLine.tag", "p1/rust"))).toBeInTheDocument();
    // TWO TAP MODELS, NEVER MIXED (`TopicsLine.jsx:22-24`): on a detail
    // surface the WHOLE LINE is one control opening the tags-and-references
    // sheet, the chips inert inside it. The chip's own link belongs to the
    // summary card, where the counts are the opener instead.
    expect(screen.queryByTestId("post-topic-rust-link")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId(byNode("postDetail.card.tagsLine")));
    expect(screen.getByTestId("post-refs-sheet-topic-rust")).toBeInTheDocument();
    // Not the viewer's own post — no add/remove affordance.
    expect(screen.queryByTestId("post-tag-input")).not.toBeInTheDocument();
  });

  // F3: tag editing moved onto the edit screen, so the detail view is
  // read-only for the author too — the Edit affordance is the way in.
  it("shows read-only chips on the viewer's OWN post, with no tag gestures", async () => {
    server.use(
      ...threadFrom(() => ({
            post: {
              ...detail("acct-1", []).post,
              topics: [
                {
                  __typename: "TopicClaim",
                  hashtag: { __typename: "Hashtag", id: "ht-1", name: moderated("rust") },
                  relevance: 0.1,
                  confidence: 1,
                  pending: false,
                },
              ],
            },
          })),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    expect(await screen.findByTestId(byNode("postDetail.card.tagsLine.tag", "p1/rust"))).toBeInTheDocument();
    // THE REVEAL HAS NO OWNERSHIP CASE: `graph.json:1197` carries one
    // `tags and references` edge off `PostDetail`, where the edge that does
    // split by ownership says so (`:1194`, the ⋮'s "the reader's sheet").
    // So an own post's line reads exactly like anyone else's — one control,
    // the chips inert, the sheet behind it.
    expect(screen.queryByTestId("post-topic-rust-link")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId(byNode("postDetail.card.tagsLine")));
    expect(screen.getByTestId("post-refs-sheet-topic-rust")).toBeInTheDocument();
    expect(screen.queryByTestId("post-tag-input")).not.toBeInTheDocument();
    expect(screen.queryByTestId("post-topic-rust-remove")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId(byNode("postDetail.header.menu")));
    fireEvent.click(screen.getByTestId("postDetail.menuSheet.edit"));
    expect(routerPush).toHaveBeenCalledWith("/compose?post=p1");
  });

  // SENSITIVE STAYS IN EDIT (jakob 2026-09-14): marking a published post is
  // always a signed action changing it, so the row is a door into the edit
  // flow — the intentioned one beside Edit's general one — never its own
  // sheet with a commit of its own.
  it("sends Mark as sensitive into the edit flow", async () => {
    server.use(
      ...thread("acct-1", []),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.click(await screen.findByTestId(byNode("postDetail.header.menu")));
    fireEvent.click(screen.getByTestId("postDetail.menuSheet.markSensitive"));
    expect(routerPush).toHaveBeenCalledWith("/compose?post=p1");
  });

  it("shows read-only chips on the viewer's own COMMENT too", async () => {
    server.use(
      ...threadFrom(() => {
        const base = detail("author-1", [{ id: "c1", body: "mine", authorId: "acct-1" }]);
        return {
          post: {
            ...base.post,
            comments: {
              ...base.post.comments,
              edges: base.post.comments.edges.map((edge) => ({
                ...edge,
                node: {
                  ...edge.node,
                  topics: [
                    {
                      __typename: "TopicClaim",
                      hashtag: { __typename: "Hashtag", id: "ht-1", name: moderated("rust") },
                      relevance: 0.1,
                      confidence: 1,
                      pending: false,
                    },
                  ],
                },
              })),
            },
          },
        };
      }),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    await openComments();
    expect(await screen.findByTestId("comment-c1-topic-rust")).toBeInTheDocument();
    expect(screen.queryByTestId("comment-c1-tag-input")).not.toBeInTheDocument();
  });

  // DV-18/20/21: the post is a card here too, the author leads it, and the
  // title is the card's heading rather than the app bar's.
  it("draws the post as a card, the author leading it", async () => {
    server.use(
      ...thread("u1", [{ id: "c1", body: "First!" }]),
    );
    const { container } = renderWithProviders(<PostView postId="p1" />, {
      writeSigner: fakeWriteSigner(),
    });
    const card = await screen.findByTestId(byNode("postDetail.card"));
    expect(card.tagName).toBe("SECTION");
    expect(card.className).toContain("bg-surface-container-highest");
    expect(card).toContainElement(screen.getByTestId(byNode("postDetail.card.authorChip")));
    expect(card).toContainElement(screen.getByTestId(byNode("postDetail.card.title")));
    expect(card).toContainElement(screen.getByTestId(byNode("postDetail.card.actionRow.stance.anchor")));
    const order = Array.from(
      container.querySelectorAll("[data-testid]"),
      (node) => node.getAttribute("data-testid"),
    );
    expect(order.indexOf("postDetail.card.authorChip")).toBeGreaterThan(-1);
    expect(order.indexOf("postDetail.card.authorChip")).toBeLessThan(
      order.indexOf("postDetail.card.title"),
    );
    expect(order.indexOf("postDetail.card.authorChip")).toBeLessThan(
      order.indexOf("postDetail.card.body"),
    );
  });

  // The count states the thread's size and raises it (graph.json: every
  // `comment count` edge advances to `ReplyEntry`).
  it("carries the comments affordance, counting the whole thread", async () => {
    server.use(
      ...thread("u1", [{ id: "c1", body: "First!" }]),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    const comments = await screen.findByTestId(byNode("postDetail.card.actionRow.comments"));
    expect(comments).toHaveAccessibleName("1 comment");
    const sheet = screen.getByTestId("postDetail.threadSheet");
    expect(sheet).not.toBeVisible();
    fireEvent.click(comments);
    expect(sheet).toBeVisible();
    expect(sheet).toHaveAccessibleName("Comments");
    // The thread is the sheet's own read, made when it is raised — so the
    // comments arrive a moment after the drawer does.
    expect(sheet).toContainElement(await screen.findByTestId("post-comment-c1"));
    // The foot rides the sheet whichever way the write affordance swapped —
    // this reader has no session, so it is the join entry.
    expect(sheet).toContainElement(screen.getByTestId("comment-signin"));
  });

  // A drawer the reader opened is a drawer the reader can drop, and the post
  // is where dropping it lands — never a page whose thread scrolled away.
  it("drops the thread again, leaving the post where it was", async () => {
    server.use(
      ...thread("u1", [{ id: "c1", body: "First!" }]),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    const sheet = await openComments();
    fireEvent.keyDown(sheet, { key: "Escape" });
    fireEvent(sheet, new Event("close"));
    await waitFor(() => expect(sheet).not.toBeVisible());
    expect(screen.getByTestId(byNode("postDetail.card.title"))).toHaveTextContent("The title");
  });

  // ReplyEntry 7 → ReplyCompose, and every way out of the composer comes back
  // to the thread: the sheet steps aside for the full-focus surface rather
  // than standing behind it.
  it("yields the sheet to the composer and takes it back on the way out", async () => {
    server.use(
      ...thread("u1", [{ id: "c1", body: "First!" }]),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("u2"),
      writeSigner: fakeWriteSigner(),
    });
    const sheet = await openComments();
    fireEvent.click(await screen.findByTestId("comment-add"));
    expect(await screen.findByTestId("reply-wizard")).toBeInTheDocument();
    await waitFor(() => expect(sheet).not.toBeVisible());
    fireEvent.click(screen.getByTestId("header-back"));
    expect(screen.queryByTestId("reply-wizard")).not.toBeInTheDocument();
    expect(screen.getByTestId("postDetail.threadSheet")).toBeVisible();
  });

  // THE COMPOSER TAKES THE SCREEN AND GIVES IT BACK WHOLE (jakob 2026-09-15).
  // The return is two values — where the reader was, and which branch has to
  // be standing when they get back — and both composers take it: a reply and
  // an edit alike put what was just written in front of its author (Q6).
  describe("coming back from a composer", () => {
    /** One staged write, which is all these care about. */
    function oneWrite(id: string) {
      return {
        __typename: "PreparedWrite",
        id,
        family: "REVIEW",
        canonicalProposal: "AA==",
        gcAfterEpochs: 3,
      };
    }

    /** One comment's branch, as the expand read serves it. */
    function branchOf(parent: string, replies: FixtureComment[]) {
      return {
        comment: {
          __typename: "Comment",
          id: parent,
          replies: {
            __typename: "CommentConnection",
            edges: replies.map((reply) => ({
              __typename: "CommentEdge",
              node: commentNode(reply),
            })),
            pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
          },
        },
      };
    }

    /**
     * The reader, some way down the thread.
     *
     * A REAL BROWSER DROPS THIS ON THE WAY OUT — a closed `<dialog>` is
     * `display: none` and the offset goes with it — where jsdom keeps it. So
     * the tests below zero it by hand while the composer is up, which is what
     * the browser would have done, and the restore is what puts it back.
     *
     * The sheet measures the place a frame after a scroll, and a reader's next
     * tap comes after that frame — so the frame passes here, rather than the
     * measurement landing late, over the zeroed offset.
     */
    async function scrollThreadTo(offset: number) {
      const body = screen.getByTestId("comments-sheet-body");
      body.scrollTop = offset;
      fireEvent.scroll(body);
      await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
      return body;
    }

    it("comes back to the reader's place with the reply's own branch standing", async () => {
      let reads = 0;
      const before = detail("author-1", [{ id: "c1", body: "First!" }]);
      // The refetch carries the branch the reply landed in as a COUNT (Q49);
      // unfolding it is the return's own second act.
      const after = detail("author-1", [{ id: "c1", body: "First!", replyCount: 1 }]);
      server.use(
        gqlLink.query("PostDetail", () => HttpResponse.json({ data: before })),
        gqlLink.query("PostComments", () => {
          reads += 1;
          return HttpResponse.json({ data: commentsOf(reads === 1 ? before : after) });
        }),
        gqlLink.query("CommentReplies", () =>
          HttpResponse.json({
            data: branchOf("c1", [{ id: "r1", body: "Mine, settling", pending: true }]),
          }),
        ),
        gqlLink.mutation("PrepareComment", () =>
          HttpResponse.json({
            data: {
              prepareComment: {
                __typename: "PrepareContentPayload",
                node: "r1",
                writes: [oneWrite("w-reply")],
                userErrors: [],
              },
            },
          }),
        ),
      );
      renderWithProviders(
        // The wizard signs on this device, so the key has to be on it.
        <PostView postId="p1" store={fakeIdentityStore({ keyOnDevice: true })} />,
        { store: storeFor("acct-1"), writeSigner: fakeWriteSigner() },
      );
      const sheet = await openComments();
      const body = await scrollThreadTo(320);
      // The branch is behind its count: nothing of it is on screen yet.
      expect(screen.queryByTestId("post-comment-r1")).not.toBeInTheDocument();

      fireEvent.click(await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.reply", "c1")));
      await screen.findByTestId("reply-wizard");
      await waitFor(() => expect(sheet).not.toBeVisible());
      body.scrollTop = 0;

      fireEvent.change(screen.getByTestId("reply-words"), {
        target: { value: "Mine, settling" },
      });
      fireEvent.click(screen.getByTestId("reply-next"));
      await screen.findByTestId("reply-seal");
      await waitFor(() => expect(screen.getByTestId("reply-sign")).not.toBeDisabled());
      fireEvent.click(screen.getByTestId("reply-sign"));

      // THE BRANCH IS UNFOLDED, and the new reply is in it wearing the marker
      // a fresh write wears — a refetch alone would have left the thread
      // looking unchanged.
      expect(await screen.findByTestId("post-comment-r1")).toHaveTextContent("Mine, settling");
      expect(screen.getByTestId("comment-pending-r1")).toBeInTheDocument();
      expect(screen.getByTestId("postDetail.threadSheet")).toBeVisible();
      expect(screen.getByTestId("comment-signed")).toHaveTextContent("still settling");
      // ...and the reader is where they left off, not back at the top.
      await waitFor(() => expect(body.scrollTop).toBe(320));
    });

    // Q6, jakob 2026-09-15: "we must extend for edit aswell.. editing sth and
    // then not seeing the corrected version gives the user uncertainty if it
    // even happened." An edited REPLY lives behind its parent's count, so the
    // edit's return unfolds that branch exactly as the reply's does.
    // Many sequential awaits through MSW: a starved full suite needs more than
    // the 5 s default (timeout argument below).
    it("unfolds the branch an edited reply lives in, so its author sees it", async () => {
      let reads = 0;
      let branches = 0;
      const thread1 = detail("author-1", [{ id: "c1", body: "First!", replyCount: 1 }]);
      server.use(
        gqlLink.query("PostDetail", () => HttpResponse.json({ data: thread1 })),
        gqlLink.query("PostComments", () => {
          reads += 1;
          return HttpResponse.json({ data: commentsOf(thread1) });
        }),
        gqlLink.query("CommentReplies", () => {
          branches += 1;
          return HttpResponse.json({
            data: branchOf("c1", [
              {
                id: "r1",
                body: branches === 1 ? "old words" : "better words",
                authorId: "acct-1",
                edited: branches > 1,
              },
            ]),
          });
        }),
        gqlLink.mutation("PrepareCommentEdit", () =>
          HttpResponse.json({
            data: {
              prepareCommentEdit: {
                __typename: "PrepareContentPayload",
                node: "r1",
                writes: [oneWrite("w-edit")],
                userErrors: [],
              },
            },
          }),
        ),
      );
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner(),
      });
      const sheet = await openComments();
      // The reader unfolds the branch themselves and edits their own reply.
      fireEvent.click(await screen.findByTestId("replies-more-c1"));
      expect(await screen.findByTestId("post-comment-r1")).toHaveTextContent("old words");
      const body = await scrollThreadTo(180);

      fireEvent.click(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "r1")));
      await screen.findByTestId("comment-edit");
      // The sheet steps aside for the editor and drops on a 200 ms exit timer;
      // saving before that timer has run lets its close land on top of the
      // sheet's return (see the reply test above, which waits the same way).
      await waitFor(() => expect(sheet).not.toBeVisible());
      body.scrollTop = 0;
      fireEvent.change(screen.getByTestId("commentEdit.words.input"), {
        target: { value: "better words" },
      });
      fireEvent.click(screen.getByTestId("commentEdit.sign"));

      // The refetch re-collapsed every branch; this one comes back open,
      // because that is where the words the author just wrote are.
      // Marker lands after the sign, the thread refetch and the branch read:
      // three sequential reads, so the default 1 s is too tight under load.
      expect(
        await screen.findByTestId("comment-edited-r1", undefined, { timeout: 4000 }),
      ).toBeInTheDocument();
      expect(screen.getByTestId("post-comment-r1")).toHaveTextContent("better words");
      await waitFor(() => expect(screen.getByTestId("postDetail.threadSheet")).toBeVisible());
      await waitFor(() => expect(reads).toBe(2));
      await waitFor(() => expect(body.scrollTop).toBe(180));
    }, 15_000);

    // A comment on the POST is already at the top level, so there is no branch
    // to unfold — the place alone is the whole return.
    it("takes the reader's place back when the composer is dismissed", async () => {
      server.use(...thread("author-1", [{ id: "c1", body: "First!" }]));
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner(),
      });
      const sheet = await openComments();
      const body = await scrollThreadTo(240);

      fireEvent.click(await screen.findByTestId("comment-add"));
      await screen.findByTestId("reply-wizard");
      await waitFor(() => expect(sheet).not.toBeVisible());
      body.scrollTop = 0;

      // Discarded, not signed: the thread comes back exactly as it was.
      fireEvent.click(screen.getByTestId("header-back"));
      expect(screen.queryByTestId("reply-wizard")).not.toBeInTheDocument();
      expect(screen.getByTestId("postDetail.threadSheet")).toBeVisible();
      await waitFor(() => expect(body.scrollTop).toBe(240));
    });
  });

  // CR-20: both apps read `createdAt` for the Edited comparison and drew none
  // of it.
  it("carries every comment's age beside its author", async () => {
    server.use(
      ...thread("u1", [{ id: "c1", body: "First!" }]),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    await openComments();
    const stamp = await screen.findByTestId("comment-c1-timestamp");
    expect(stamp).toHaveAttribute("datetime");
    expect(stamp.textContent).toMatch(/^(now|\d+[mhd])$/);
  });

  it("links authors as chips into their profiles", async () => {
    server.use(
      ...thread("author-1", [{ id: "c1", body: "top" }]),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    await openComments();
    expect(await screen.findByTestId(byNode("postDetail.card.authorChip"))).toHaveAttribute("href", "/u/alice");
    expect(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.authorChip", "c1"))).toHaveAttribute("href", "/u/bob");
  });

  // ONE LINE, TWO CHIPS, THEN THE COUNTS on the post and on every comment
  // (`TopicsLine.jsx`). The values a reader can ask for live in the
  // topics-and-references sheet, which is not drawn here yet — so the line
  // states the counts and opens nothing, rather than growing a toggle the
  // boards do not carry.
  it("states the post's topics on one line, the rest as a count", async () => {
    server.use(
      ...threadFrom(() => detail("u1", [], { hasNextPage: false, endCursor: null }, false, [
            topicClaim("rust", 0.4, 0.9),
            topicClaim("wasm", 0.2, 0.8),
            topicClaim("axum", 0.1, 0.7),
          ])),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId(byNode("postDetail.card.tagsLine.tag", "p1/rust"))).toBeInTheDocument();
    expect(screen.getByTestId(byNode("postDetail.card.tagsLine.tag", "p1/wasm"))).toBeInTheDocument();
    expect(screen.queryByTestId(byNode("postDetail.card.tagsLine.tag", "p1/axum"))).not.toBeInTheDocument();
    expect(screen.getByTestId(byNode("postDetail.card.tagsLine.counts"))).toHaveTextContent("· 1 tag");
    expect(screen.queryByTestId("post-topics-reveal")).not.toBeInTheDocument();
  });

  it("gives every comment the same line", async () => {
    server.use(
      ...threadFrom(() => detail(
            "u1",
            [{ id: "c1", body: "First!", topics: [topicClaim("wasm", -0.25, 0.5)] }],
            { hasNextPage: false, endCursor: null },
            false,
            [topicClaim("rust", 0.4, 0.9)],
          )),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    await openComments();
    expect(await screen.findByTestId("comment-c1-topic-wasm")).toBeInTheDocument();
    expect(screen.getByTestId(byNode("postDetail.card.tagsLine.tag", "p1/rust"))).toBeInTheDocument();
    expect(screen.queryByTestId("comment-c1-topics-reveal")).not.toBeInTheDocument();
  });

  // ---- F9: tagging is part of the comment compose gesture ----

  // ---- F10: the inline comment edit tags like the post edit ----

  describe("editing a comment's tags", () => {
    function tagPayload(id: string) {
      return {
        prepareTag: {
          __typename: "PreparePayload",
          writes: [
            {
              __typename: "PreparedWrite",
              id,
              family: "TAG",
              canonicalProposal: "cHJvcG9zYWw=",
            },
          ],
          userErrors: [],
        },
      };
    }

    function editPayload() {
      return {
        prepareCommentEdit: {
          __typename: "PrepareContentPayload",
          node: "c1",
          writes: [
            {
              __typename: "PreparedWrite",
              id: "w-edit",
              family: "REVIEW",
              canonicalProposal: "cHJvcG9zYWw=",
              gcAfterEpochs: 8,
            },
          ],
          userErrors: [],
        },
      };
    }

    /** The viewer's own comment, carrying whatever claims it was given. */
    function ownComment(topics: TopicFixture[]) {
      return detail("author-1", [
        { id: "c1", body: "old words", authorId: "acct-1", topics },
      ]);
    }

    beforeEach(() => {
      writeConfirmMultiAction(false);
    });

    it("opens the editor on the claims the comment actually carries", async () => {
      server.use(
        ...threadFrom(() => ownComment([topicClaim("rust", 0.4, 0.8)])),
      );
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner(),
      });
      await openComments();
      fireEvent.click(await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c1")));
      expect(screen.getByTestId("commentEdit.tags.tag")).toHaveTextContent("#rust");
      // The chip opens its pair in a sheet over the edit (CommentEdit.md), on
      // the values the claim actually carries — real ones, never the entry
      // defaults.
      fireEvent.click(screen.getByTestId("comment-edit-tag-0-select"));
      expect(screen.getByTestId("comment-edit-tag-pair-exact")).toHaveTextContent("+0.40 / 0.80");
      // No creation batch here, so no batch cap.
      expect(screen.queryByTestId("comment-edit-tag-cap")).not.toBeInTheDocument();
    });

    // Round 4: the display state is the OR of the author's mark and the
    // moderator's, and neither side can clear the other. Re-stating the OR on
    // an edit would quietly adopt a moderator's verdict as the author's own
    // mark, which the author could then never take back.
    it("carries the author's own sensitive mark on an edit, never a moderator's", async () => {
      let sent: { sensitive?: boolean } | null = null;
      server.use(
        ...threadFrom(() => ownComment([])),
        // The reader sees a veiled comment — but that veil is the moderator's.
        gqlLink.query("CommentSelfMark", () =>
          HttpResponse.json({
            data: {
              comment: {
                __typename: "Comment",
                id: "c1",
                sensitiveSelfMark: false,
                sensitiveReason: null,
              },
            },
          }),
        ),
        gqlLink.mutation("PrepareCommentEdit", ({ variables }) => {
          sent = (variables.input as { sensitive?: boolean }) ?? null;
          return HttpResponse.json({ data: editPayload() });
        }),
      );
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner(),
      });
      await openComments();

      fireEvent.click(await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c1")));
      fireEvent.change(screen.getByTestId("commentEdit.words.input"), {
        target: { value: "new words" },
      });
      fireEvent.click(screen.getByTestId("commentEdit.sign"));

      await waitFor(() => expect(sent).not.toBeNull());
      expect(sent!.sensitive).toBe(false);
    });

    // The mark is the author's ongoing judgement (design/backlog.md item 25.2),
    // so the edit surface carries the row — and the mark is a term of the edit
    // record, so moving it alone is enough to write one.
    it("the mark row alone stages the edit, and the reason travels with it", async () => {
      let sent: { sensitive?: boolean; sensitiveReason?: string | null } | null = null;
      server.use(
        ...threadFrom(() => ownComment([])),
        gqlLink.mutation("PrepareCommentEdit", ({ variables }) => {
          sent = (variables.input as typeof sent) ?? null;
          return HttpResponse.json({ data: editPayload() });
        }),
      );
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner(),
      });
      await openComments();

      fireEvent.click(await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c1")));
      // Nothing typed: the row is the only change.
      expect(screen.getByTestId("commentEdit.sign")).toBeDisabled();

      // `Mark` opens the sheet already marked (ComposeSensitive.jsx).
      fireEvent.click(screen.getByTestId("commentEdit.facts.sensitive.action"));
      fireEvent.change(screen.getByTestId("comment-edit-sensitive-reason"), {
        target: { value: "A dead seabird." },
      });
      fireEvent.click(screen.getByTestId("comment-edit-sensitive-done"));

      expect(screen.getByTestId("commentEdit.facts.sensitive.value")).toHaveTextContent("Marked");
      fireEvent.click(screen.getByTestId("commentEdit.sign"));

      await waitFor(() => expect(sent).not.toBeNull());
      expect(sent!.sensitive).toBe(true);
      expect(sent!.sensitiveReason).toBe("A dead seabird.");
    });

    // An edit is complete state: a reason the editor never showed would be
    // erased by the very edit that left it alone.
    it("carries a reason the comment already had through an untouched edit", async () => {
      let sent: { sensitiveReason?: string | null } | null = null;
      server.use(
        ...threadFrom(() => ownComment([])),
        gqlLink.query("CommentSelfMark", () =>
          HttpResponse.json({
            data: {
              comment: {
                __typename: "Comment",
                id: "c1",
                sensitiveSelfMark: true,
                sensitiveReason: "One rubbing includes a dead seabird.",
              },
            },
          }),
        ),
        gqlLink.mutation("PrepareCommentEdit", ({ variables }) => {
          sent = (variables.input as typeof sent) ?? null;
          return HttpResponse.json({ data: editPayload() });
        }),
      );
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner(),
      });
      await openComments();

      fireEvent.click(await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c1")));
      await waitFor(() =>
        expect(screen.getByTestId("commentEdit.facts.sensitive.value")).toHaveTextContent("Marked"),
      );
      fireEvent.change(screen.getByTestId("commentEdit.words.input"), {
        target: { value: "new words" },
      });
      fireEvent.click(screen.getByTestId("commentEdit.sign"));

      await waitFor(() => expect(sent).not.toBeNull());
      expect(sent!.sensitiveReason).toBe("One rubbing includes a dead seabird.");
    });

    // The words answer to the same cap a fresh comment does — mirrored so an
    // over-length edit never reaches the seal a refusal would otherwise waste.
    it("holds the save shut on words past the cap", async () => {
      server.use(...threadFrom(() => ownComment([])));
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner(),
      });
      await openComments();

      fireEvent.click(await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c1")));
      fireEvent.change(screen.getByTestId("commentEdit.words.input"), {
        target: { value: "x".repeat(COMMENT_BODY_MAX_CHARS + 1) },
      });

      expect(screen.getByTestId("commentEdit.sign")).toBeDisabled();
    });

    // The reason is entered on the editor's own sheet, so this is the one
    // place that cap is checked — and only while the mark is on, exactly as
    // the compose surfaces' own seal.
    it("holds the save shut on a sensitive reason past the cap, only while marked", async () => {
      server.use(...threadFrom(() => ownComment([])));
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner(),
      });
      await openComments();

      fireEvent.click(await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c1")));
      // The sheet opens marked; over the cap its Done is visible and inert, so
      // an over-long reason never reaches the edit.
      fireEvent.click(screen.getByTestId("commentEdit.facts.sensitive.action"));
      fireEvent.change(screen.getByTestId("comment-edit-sensitive-reason"), {
        target: { value: "x".repeat(SENSITIVE_REASON_MAX_CHARS + 1) },
      });
      expect(screen.getByTestId("comment-edit-sensitive-done")).toBeDisabled();

      // Unmarking leaves Done free of THIS refusal: the leftover text is never
      // sent. A words change keeps something staged to sign, so the assertion
      // is not vacuously true against an empty batch.
      fireEvent.click(screen.getByTestId("comment-edit-sensitive-switch"));
      fireEvent.click(screen.getByTestId("comment-edit-sensitive-done"));
      fireEvent.change(screen.getByTestId("commentEdit.words.input"), {
        target: { value: "new words" },
      });

      expect(screen.getByTestId("commentEdit.sign")).not.toBeDisabled();
    });

    it("stages the edit record and one Tag act per change, in one signing pass", async () => {
      const tagInputs: Record<string, unknown>[] = [];
      let editCalled = false;
      server.use(
        ...threadFrom(() => ownComment([topicClaim("wasm", 0.1, 0.6)])),
        gqlLink.mutation("PrepareCommentEdit", () => {
          editCalled = true;
          return HttpResponse.json({ data: editPayload() });
        }),
        gqlLink.mutation("PrepareTag", ({ variables }) => {
          tagInputs.push(variables.input as Record<string, unknown>);
          return HttpResponse.json({ data: tagPayload(`w-tag-${tagInputs.length}`) });
        }),
      );
      const signer = fakeWriteSigner();
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: signer,
      });
      await openComments();
      fireEvent.click(await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c1")));
      fireEvent.change(screen.getByTestId("commentEdit.words.input"), {
        target: { value: "better words" },
      });
      await addTagThroughPicker("rust");
      // Drop the tag the comment came with.
      fireEvent.click(screen.getByTestId(byNode("commentEdit.tags.tag.remove", "wasm")));
      fireEvent.click(screen.getByTestId("commentEdit.sign"));

      await waitFor(() => expect(signer.signStaged).toHaveBeenCalledTimes(3));
      expect(editCalled).toBe(true);
      expect(tagInputs).toEqual([
        { target: "c1", name: "rust", pDirected: 0.1, pInterest: 1 },
        // A withdrawal is a Tag act at (0,0), never a deletion, whatever the
        // removed chip showed (hashtag.md §4) — never a hole the
        // server would fill.
        { target: "c1", name: "wasm", pDirected: 0, pInterest: 0 },
      ]);
    });

    it("stages no edit record when only the tags moved", async () => {
      let editCalled = false;
      server.use(
        ...threadFrom(() => ownComment([])),
        gqlLink.mutation("PrepareCommentEdit", () => {
          editCalled = true;
          return HttpResponse.json({ data: editPayload() });
        }),
        gqlLink.mutation("PrepareTag", () => HttpResponse.json({ data: tagPayload("w-tag-1") })),
      );
      const signer = fakeWriteSigner();
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: signer,
      });
      await openComments();
      fireEvent.click(await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c1")));
      await addTagThroughPicker("rust");
      fireEvent.click(screen.getByTestId("commentEdit.sign"));

      await waitFor(() => expect(signer.signStaged).toHaveBeenCalledTimes(1));
      expect(editCalled).toBe(false);
    });

    // Re-tuning is its own act: a fresh declaration at the new values.
    it("stages a re-tune as its own Tag act", async () => {
      const tagInputs: Record<string, unknown>[] = [];
      server.use(
        ...threadFrom(() => ownComment([topicClaim("rust", 0.4, 0.8)])),
        gqlLink.mutation("PrepareTag", ({ variables }) => {
          tagInputs.push(variables.input as Record<string, unknown>);
          return HttpResponse.json({ data: tagPayload("w-tag-1") });
        }),
      );
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner(),
      });
      await openComments();
      fireEvent.click(await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c1")));
      fireEvent.click(screen.getByTestId("comment-edit-tag-0-select"));
      fireEvent.click(screen.getByTestId("comment-edit-tag-pair-exact-route"));
      fireEvent.change(screen.getByTestId("comment-edit-tag-pair-tracks-directed"), {
        target: { value: "0.75" },
      });
      fireEvent.click(screen.getByTestId("comment-edit-tag-pair-done"));
      fireEvent.click(screen.getByTestId("commentEdit.sign"));

      await waitFor(() =>
        expect(tagInputs).toEqual([
          { target: "c1", name: "rust", pDirected: 0.75, pInterest: 0.8 },
        ]),
      );
    });

    // F2: prepared fully before signing — a refusal on a tag leaves
    // nothing signed at all.
    it("signs nothing when a Tag act is refused", async () => {
      server.use(
        ...threadFrom(() => ownComment([])),
        gqlLink.mutation("PrepareCommentEdit", () => HttpResponse.json({ data: editPayload() })),
        gqlLink.mutation("PrepareTag", () =>
          HttpResponse.json({
            data: {
              prepareTag: {
                __typename: "PreparePayload",
                writes: null,
                userErrors: [
                  {
                    __typename: "UserError",
                    message: "`a-b` is not a legal topic name: reserved",
                    code: "BAD_INPUT",
                    field: ["name"],
                  },
                ],
              },
            },
          }),
        ),
      );
      const signer = fakeWriteSigner();
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: signer,
      });
      await openComments();
      fireEvent.click(await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c1")));
      fireEvent.change(screen.getByTestId("commentEdit.words.input"), { target: { value: "moved" } });
      await addTagThroughPicker("a-b");
      fireEvent.click(screen.getByTestId("commentEdit.sign"));

      expect(await screen.findByTestId("comment-edit-tag-error-0")).toHaveTextContent(
        "Something in this wasn't accepted",
      );
      expect(signer.signStaged).not.toHaveBeenCalled();
      // The editor stays open on the work that was refused.
      expect(screen.getByTestId("commentEdit.words.input")).toBeInTheDocument();
    });

    it("counts the batch: the record once the words were typed, and each tag act", async () => {
      server.use(
        ...threadFrom(() => ownComment([topicClaim("wasm", 0.1, 1)])),
      );
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner(),
      });
      await openComments();
      fireEvent.click(await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c1")));
      // Untouched: nothing to sign, and the press is inert.
      expect(screen.getByTestId("commentEdit.acts.line")).toHaveTextContent(
        "Nothing to sign yet",
      );
      expect(screen.getByTestId("commentEdit.sign")).toBeDisabled();

      fireEvent.click(screen.getByTestId("commentEdit.tags.tag.remove"));
      expect(screen.getByTestId("commentEdit.acts.line")).toHaveTextContent(
        "You're signing 1 thing",
      );
      const input = screen.getByTestId("commentEdit.words.input");
      const words = (input as HTMLTextAreaElement).value;
      fireEvent.change(input, { target: { value: "moved" } });
      expect(screen.getByTestId("commentEdit.acts.line")).toHaveTextContent(
        "You're signing 2 things",
      );
      // THE GUARD IS THE ACTS BATCH, NOT A BYTE COMPARISON
      // (EditComposeUnchanged.md:3): typed back, the record stays staged.
      fireEvent.change(input, { target: { value: words } });
      expect(screen.getByTestId("commentEdit.acts.line")).toHaveTextContent(
        "You're signing 2 things",
      );
    });

    it("signs a batch of more than one act on the press, no dialog asking again", async () => {
      writeConfirmMultiAction(true);
      server.use(
        ...threadFrom(() => ownComment([])),
        gqlLink.mutation("PrepareCommentEdit", () => HttpResponse.json({ data: editPayload() })),
        gqlLink.mutation("PrepareTag", () => HttpResponse.json({ data: tagPayload("w-tag-1") })),
      );
      const signer = fakeWriteSigner();
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: signer,
      });
      await openComments();
      fireEvent.click(await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c1")));
      fireEvent.change(screen.getByTestId("commentEdit.words.input"), { target: { value: "moved" } });
      await addTagThroughPicker("rust");
      expect(screen.getByTestId("commentEdit.acts.line")).toHaveTextContent(
        "You're signing 2 things",
      );
      fireEvent.click(screen.getByTestId("commentEdit.sign"));

      // Sign is the confirmation: the count was said on the foot.
      expect(screen.queryByTestId("comment-edit-multi-action-count")).not.toBeInTheDocument();
      await waitFor(() => expect(signer.signStaged).toHaveBeenCalledTimes(2));
    });
  });

  // The post detail is one of the named surfaces (design/readme.md, "The
  // pull-down lives on every full-screen scrolling root", ruled
  // 2026-09-10) — the feed's own twin test (feed-view.test.tsx,
  // "pulling down at the top").
  describe("pulling down at the top", () => {
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

    function postIn() {
      const scroller = document.createElement("div");
      document.body.append(scroller);
      renderWithProviders(
        <ScrollHostProvider value={{ current: scroller }}>
          <PostView postId="p1" />
        </ScrollHostProvider>,
        { writeSigner: fakeWriteSigner() },
      );
      return scroller;
    }

    it("asks the server again without blanking the post already on screen", async () => {
      let reads = 0;
      server.use(
        gqlLink.query("PostDetail", () => {
          reads += 1;
          return HttpResponse.json({ data: detail("u1", []) });
        }),
      );
      const scroller = postIn();
      await screen.findByTestId(byNode("postDetail.card.title"));
      expect(reads).toBe(1);

      pull(scroller);
      await waitFor(() => expect(reads).toBe(2));
      // The already-drawn post stays — the pull is an indicator, not a
      // blank page (the shared HT-10 rule).
      expect(screen.getByTestId(byNode("postDetail.card.title"))).toBeInTheDocument();
      scroller.remove();
    });

    it("says it is asking, in its own loading line, without the nothing-loaded page", async () => {
      let reads = 0;
      server.use(
        gqlLink.query("PostDetail", () => {
          reads += 1;
          return HttpResponse.json({ data: detail("u1", []) });
        }),
      );
      const scroller = postIn();
      await screen.findByTestId(byNode("postDetail.card.title"));

      pull(scroller);
      expect(screen.getByTestId("post-refreshing")).toHaveTextContent("Loading…");
      await waitFor(() => expect(reads).toBe(2));
      expect(screen.queryByTestId("post-refreshing")).not.toBeInTheDocument();
      scroller.remove();
    });

    it("takes a short tug for what it is — a scroll, not an ask", async () => {
      let reads = 0;
      server.use(
        gqlLink.query("PostDetail", () => {
          reads += 1;
          return HttpResponse.json({ data: detail("u1", []) });
        }),
      );
      const scroller = postIn();
      await screen.findByTestId(byNode("postDetail.card.title"));

      pull(scroller, PULL_THRESHOLD - 1);
      await waitFor(() => expect(reads).toBe(1));
      scroller.remove();
    });

    it("ignores a pull that starts anywhere but the top", async () => {
      let reads = 0;
      server.use(
        gqlLink.query("PostDetail", () => {
          reads += 1;
          return HttpResponse.json({ data: detail("u1", []) });
        }),
      );
      const scroller = postIn();
      await screen.findByTestId(byNode("postDetail.card.title"));

      scroller.scrollTop = 900;
      pull(scroller);
      await waitFor(() => expect(reads).toBe(1));
      scroller.remove();
    });
  });
});

// Slice 2.4. Named apart from the topics suites above: the reference row
// and the tag row are siblings on this screen.
describe("PostView — references", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Asking is the default; the tests that care about the dialog turn
    // it back on themselves.
    writeConfirmMultiAction(false);
    // THE REVEAL IS A SESSION, A SUITE IS MANY SESSIONS (`reveal.ts`): this
    // describe is its own top-level suite, sibling to `PostView` above, so
    // it needs its own reset — a reveal one of its tests clicks would
    // otherwise stand for every later test sharing the fixture's post id
    // and sensitive signature (`the gallery`, below).
    forgetReveals();
  });

  function referenceWrites(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      __typename: "PreparedWrite",
      id: `r${i}`,
      family: "REFERENCE",
      canonicalProposal: "cHJvcG9zYWw=",
      gcAfterEpochs: 8,
    }));
  }

  // A CARD NEVER LISTS ITS REFERENCES INLINE (design/readme.md, "Reference
  // rows and signed pairs — 2026-08-28"):
  // the count is on the topics line, and the full set — with each claim's
  // pair — is the topics-and-references sheet's, which is not drawn yet.
  it("states the post's references as a count, never as chips", async () => {
    server.use(
      ...threadFrom(() => detail("u1", [], undefined, false, [], [
            referenceClaim(userTarget("u-ada", "ada"), 0.4, -0.2),
            referenceClaim(postTarget("p-quoted", "On folding")),
          ])),
    );
    renderWithProviders(<PostView postId="p1" />);

    expect(await screen.findByTestId(byNode("postDetail.card.tagsLine.counts"))).toHaveTextContent("· 2 references");
    expect(screen.queryByTestId("post-reference-l1-u-ada-link")).not.toBeInTheDocument();
    expect(screen.queryByTestId("post-references-reveal")).not.toBeInTheDocument();
  });

  it("counts a comment's own references the same way", async () => {
    server.use(
      ...threadFrom(() => detail("u1", [
            {
              id: "c1",
              body: "First!",
              references: [referenceClaim(userTarget("u-ada", "ada"))],
            },
          ])),
    );
    renderWithProviders(<PostView postId="p1" />);
    await openComments();
    expect(await screen.findByTestId("comment-c1-topics-counts")).toHaveTextContent(
      "· 1 reference",
    );
    expect(screen.queryByTestId("comment-c1-reference-l1-u-ada-link")).not.toBeInTheDocument();
  });

  // CITING RIDES THE MENU on every content (`_shared.jsx:165-175`), post and
  // comment alike — it opens the composer with the node already drafted as a
  // chip. The word is the menu's own: `Cite in a new post`.
  it("sends the composer the node the menu's cite row was opened on", async () => {
    server.use(
      ...thread("u2", [{ id: "c1", body: "First!" }]),
    );
    renderWithProviders(<PostView postId="p1" />, { store: storeFor("u1") });
    await openComments();
    await screen.findByTestId(byNode("postDetail.card.body"));

    fireEvent.click(screen.getByTestId(byNode("postDetail.header.menu")));
    fireEvent.click(screen.getByTestId("postDetail.menuSheet.cite"));
    expect(routerPush).toHaveBeenCalledWith("/compose?reference=p1");

    fireEvent.click(screen.getByTestId(byNode("postDetail.threadSheet.commentCard.menu", "c1")));
    fireEvent.click(screen.getByTestId("comment-menu-cite-c1"));
    expect(routerPush).toHaveBeenCalledWith("/compose?reference=c1");
  });

  it("counts a comment's withdrawal at its served cost before anything is prepared", async () => {
    writeConfirmMultiAction(true);
    let withdrawalInput: Record<string, unknown> | undefined;
    server.use(
      ...threadFrom(() => detail("u2", [
            {
              id: "c1",
              body: "First!",
              authorId: "u1",
              references: [referenceClaim(userTarget("u-ada", "ada"), 1, 1, false, 2)],
            },
          ])),
      gqlLink.mutation("PrepareReferenceWithdrawal", ({ variables }) => {
        withdrawalInput = variables;
        return HttpResponse.json({
          data: {
            prepareReferenceWithdrawal: {
              __typename: "PreparePayload",
              writes: referenceWrites(2),
              userErrors: [],
            },
          },
        });
      }),
    );
    const signer = fakeWriteSigner();
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("u1"),
      writeSigner: signer,
    });
    await openComments();

    fireEvent.click(await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c1")));
    fireEvent.click(screen.getByTestId("commentEdit.references.stagedReference.remove"));
    // The foot counts the withdrawal's counter-records, served by the claim,
    // and nothing is staged while the reader reads it.
    expect(screen.getByTestId("commentEdit.acts.line")).toHaveTextContent(
      "You're signing 2 things",
    );
    expect(screen.getByText(/Withdrawn:/)).toBeInTheDocument();
    expect(withdrawalInput).toBeUndefined();
    expect(signer.signStaged).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("commentEdit.sign"));
    await waitFor(() => expect(signer.signStaged).toHaveBeenCalledTimes(2));
    // The withdrawal names the L2 id, never the claim's L1 identifier.
    expect((withdrawalInput as { input: { target: string } }).input.target).toBe("u-ada");
  });

  it("stages nothing for an untouched reference section on a comment edit", async () => {
    server.use(
      ...threadFrom(() => detail("u2", [
            {
              id: "c1",
              body: "First!",
              authorId: "u1",
              references: [referenceClaim(userTarget("u-ada", "ada"))],
            },
          ])),
    );
    renderWithProviders(<PostView postId="p1" />, { store: storeFor("u1") });
    await openComments();
    fireEvent.click(await screen.findByTestId(byNode("postDetail.threadSheet.commentCard.actionRow.edit", "c1")));
    expect(screen.getByTestId("commentEdit.acts.line")).toHaveTextContent(
      "Nothing to sign yet",
    );
    expect(screen.getByTestId("commentEdit.references.stagedReference")).toHaveTextContent("@ada");
  });

  // The gallery on the read side: what a media post looks like when the body
  // is pictures, what happens when the bytes are gone, and what the veil
  // covers.
  describe("the gallery", () => {
    const picture = (id: string, altText: string | null, status = "NORMAL") => ({
      __typename: "MediaAttachment",
      id,
      url: `https://media.test/${id}.webp`,
      altText,
      status,
      mimeType: "image/webp",
      options: { __typename: "MediaOptions", aspectRatio: "4:5", durationMs: null },
      coverMedia: null,
    });

    const clip = (id: string, status = "NORMAL") => ({
      __typename: "MediaAttachment",
      id,
      url: `https://media.test/${id}.mp4`,
      altText: null,
      status,
      mimeType: "video/mp4",
      options: { __typename: "MediaOptions", aspectRatio: "9:16", durationMs: 41_000 },
      coverMedia: null,
    });

    const withBody = (body: Parameters<typeof detail>[6]) =>
      thread("u1", [], undefined, false, [], [], body);

    // A VIDEO POST'S DETAIL IS ITS OWN BOARD (`screens/PostDetailVideo.jsx`):
    // the clip STANDS ABOVE THE CARD, not inside it, flush on it and in the
    // page's flow (ruling 100), and it wears the full transport. A post of
    // pictures keeps the gallery in its body.
    describe("a video post", () => {
      it("stands the clip above the card, flush on it as one block, and leaves the card without it (PostDetailVideo.md:3)", async () => {
        server.use(...withBody({ content: null, attachments: [clip("m1")] }));
        renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

        const above = await screen.findByTestId("post-detail-clip");
        const card = screen.getByTestId(byNode("postDetail.card"));
        expect(card).not.toContainElement(above);
        // ABOVE it, which is the whole of why the author chip leads the card
        // rather than the screen.
        expect(above.compareDocumentPosition(card)).toBe(
          Node.DOCUMENT_POSITION_FOLLOWING,
        );
        // FLUSH ON IT: the clip and the card share one block, so the page's
        // stack gap never falls between them (`DetailClip.prompt.md:15`).
        const block = card.parentElement!;
        expect(block).toContainElement(above);
        expect(block.className).not.toMatch(/\bgap-/);
        // IN THE PAGE'S FLOW: nothing holds it on screen (PostDetailVideo.md:5).
        expect(above.className).not.toMatch(/\b(sticky|fixed)\b/);
        expect(block.className).not.toMatch(/\b(sticky|fixed)\b/);
        expect(screen.queryByTestId(byNode("postDetail.card.media"))).not.toBeInTheDocument();
        // The title still leads the card: it titles the thing.
        expect(screen.getByTestId(byNode("postDetail.card.title"))).toHaveTextContent("The title");
      });

      it("gives the detail clip the transport, not the disc", async () => {
        server.use(...withBody({ content: null, attachments: [clip("m1")] }));
        renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

        await screen.findByTestId("post-detail-clip");
        expect(screen.getByTestId("post-detail-clip-media-transport")).toBeInTheDocument();
        expect(screen.queryByTestId("post-detail-clip-media-sound")).toBeNull();
        // An unmarked post raises no veil over its clip.
        expect(screen.queryByTestId("post-detail-clip-veil")).toBeNull();
      });

      // THE DETAIL'S HEADER PINS (design/readme.md §4, "Browse collapses, task
      // pins"; restated by the clip detail rulings): the clip and the card
      // scroll under a bar that rides the page's edge.
      it("pins the detail's header above the clip that scrolls under it", async () => {
        server.use(...withBody({ content: null, attachments: [clip("m1")] }));
        renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

        const above = await screen.findByTestId("post-detail-clip");
        const bar = screen.getByTestId("post-header-bar");
        expect(bar.className).toMatch(/\bsticky\b/);
        expect(bar.className).toMatch(/\btop-0\b/);
        expect(bar).toContainElement(screen.getByTestId(byNode("postDetail.header")));
        expect(bar.compareDocumentPosition(above)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      });

      // ONE CLIP SHOWN BIGGER (PostDetailVideo.md:57–61, ViewerVideo.md:5):
      // the page hands its detail clip to the viewer and takes it back.
      it("hands the detail clip to the viewer at its frame, and takes it back at the viewer's", async () => {
        // The page's count read lands inside this test, never after it.
        let counted = false;
        server.use(
          ...withBody({ content: null, attachments: [clip("m1")] }),
          citingRecords([], () => {
            counted = true;
          }),
        );
        renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

        await screen.findByTestId("post-detail-clip");
        await waitFor(() => expect(counted).toBe(true));
        const element = screen.getByTestId("post-detail-clip-media") as HTMLVideoElement;
        // The open started it: no share of the screen was ever reported
        // (PostDetailVideo.md:7). Its registration is the open, so waiting
        // for the stage to watch it is waiting for the open.
        await whenObserved(element);
        expect(element.paused).toBe(false);
        element.currentTime = 6;

        fireEvent.click(screen.getByTestId("post-detail-clip-media-transport-fullscreen"));
        const viewer = screen.getByTestId("post-media-viewer-video") as HTMLVideoElement;
        // The clip's one element moves into the viewer, so nothing of the
        // detail clip plays behind it (PostDetailVideo.md:57); the viewer
        // stands where it stood, playing (ViewerVideo.md:5, N1).
        expect(viewer).toBe(element);
        expect(screen.queryByTestId("post-detail-clip-media")).toBeNull();
        expect(viewer.currentTime).toBe(6);
        expect(viewer.paused).toBe(false);

        viewer.currentTime = 15;
        fireEvent.click(screen.getByTestId("post-media-viewer-close"));
        // Plays on from the viewer's position (PostDetailVideo.md:59).
        expect(screen.queryByTestId("post-media-viewer")).toBeNull();
        expect(element.currentTime).toBe(15);
        expect(element.paused).toBe(false);
      });

      // THE DETAIL CLIP'S VEIL FACE (jakob 2026-09-24): a sensitive video
      // post's clip veils IN PLACE — never demoted into the card — and ONE
      // scope spans the clip and the card body, sharing the post's own
      // reveal (`reveal.ts`) the way the card's own `BodyRegion` already
      // does.
      it("veils the detail clip in place, mounted but wearing no transport or sound disc", async () => {
        server.use(
          ...withBody({
            description: "One rubbing includes a dead seabird.",
            attachments: [clip("m1")],
            attachmentsStatus: "SENSITIVE",
          }),
        );
        renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

        await screen.findByTestId("post-detail-clip-veil");
        // Still mounted under the veil, the same contract `BodyVeil` keeps
        // for every other veiled body — revealing must move nothing.
        expect(screen.getByTestId("post-detail-clip")).toBeInTheDocument();
        // Nothing plays beneath a veil (backlog item 103): no transport bar
        // to operate and no sound disc for a clip that cannot claim playback.
        expect(screen.queryByTestId("post-detail-clip-media-transport")).toBeNull();
        expect(screen.queryByTestId("post-detail-clip-media-sound")).toBeNull();
        // The card's own body veils too — the same post, one sensitive state.
        expect(screen.getByTestId("post-veil")).toBeInTheDocument();
      });

      // THE SOURCE LINE RIDES THE CLIP'S FACE, ONCE PER POST (LadderStates.md,
      // round 26): the card's words beneath blur in place with their Show and
      // leave the line to the clip.
      it("names whose mark it is on the clip's face alone, the card's words wearing only Show", async () => {
        server.use(
          ...withBody({
            description: "One rubbing includes a dead seabird.",
            attachments: [clip("m1")],
            attachmentsStatus: "SENSITIVE",
          }),
        );
        renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

        await screen.findByTestId("post-detail-clip-veil");
        expect(screen.getByTestId("post-detail-clip-veil-source")).toHaveTextContent("The platform's verdict");
        expect(screen.queryByTestId("post-veil-source")).toBeNull();
        expect(within(screen.getByTestId("post-veil")).getByRole("button", { name: "Show" })).toBeInTheDocument();
      });

      it("a sensitive comment wears the compact face, naming whose mark it is (CommentCard.jsx)", async () => {
        server.use(...thread("u1", [{ id: "c1", body: "Marked words", attachmentsStatus: "SENSITIVE" }]));
        renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
        await openComments();
        const block = await screen.findByTestId("comment-c1-veil-reveal");
        expect(block).toHaveAccessibleName("Sensitive — tap to view. The platform's verdict");
        expect(screen.getByTestId("comment-c1-veil-source")).toHaveTextContent("The platform's verdict");
      });

      it("answers one reveal for the detail clip and the card together", async () => {
        server.use(
          ...withBody({
            description: "One rubbing includes a dead seabird.",
            attachments: [clip("m1")],
            attachmentsStatus: "SENSITIVE",
          }),
        );
        renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

        const veil = await screen.findByTestId("post-detail-clip-veil");
        fireEvent.click(within(veil).getByRole("button"));

        // The one tap on the clip's own face lifted the card's veil too. The
        // reveal lands as a store update re-rendering two surfaces, which
        // under load can commit a beat after the click returns — so it is
        // waited for rather than read the instant the tap is dispatched.
        await waitFor(() => {
          expect(screen.queryByTestId("post-detail-clip-veil")).toBeNull();
          expect(screen.queryByTestId("post-veil")).toBeNull();
        });
        expect(screen.getByTestId(byNode("postDetail.card.description"))).toHaveTextContent(
          "One rubbing includes a dead seabird.",
        );
        // Revealed, the clip stands with its ladder's second rung back.
        expect(await screen.findByTestId("post-detail-clip-media-transport")).toBeInTheDocument();
      });

      it("leaves a post of pictures exactly where it was", async () => {
        server.use(...withBody({ content: null, attachments: [picture("m1", null)] }));
        renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

        expect(await screen.findByTestId(byNode("postDetail.card.media"))).toBeInTheDocument();
        expect(screen.queryByTestId("post-detail-clip")).toBeNull();
      });

      // REDACTION IS RECORD-GRANULAR: a removed clip removes the payload, so
      // the card is the skeleton and there is no clip left to stand above it.
      it("raises no clip when the clip was removed", async () => {
        server.use(
          ...withBody({
            content: null,
            attachments: [clip("m1", "REDACTED")],
          }),
        );
        renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

        expect(await screen.findByTestId(byNode("postDetail.card.removalMark"))).toBeInTheDocument();
        expect(screen.queryByTestId("post-detail-clip")).toBeNull();
      });
    });

    it("renders a media post's gallery and no words body", async () => {
      server.use(
        ...withBody({
          content: null,
          description: "Rubbings from three weekends.",
          attachments: [picture("m1", "paper against the salt crust"), picture("m2", null)],
        }),
      );
      renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

      expect(await screen.findByTestId(byNode("postDetail.card.title"))).toHaveTextContent("The title");
      expect(screen.getByTestId(byNode("postDetail.card.media"))).toBeInTheDocument();
      // The XOR: a media post has no words half at all.
      expect(screen.queryByTestId(byNode("postDetail.card.body"))).not.toBeInTheDocument();
      // The described picture reads as its description; the undescribed one is
      // decorative rather than announced as "image".
      expect(screen.getByAltText("paper against the salt crust")).toBeInTheDocument();
    });

    // REDACTION IS RECORD-GRANULAR: the payload goes at once — title, body,
    // description, media and the license together — and what is left is the
    // skeleton, which is the point.
    it("shows the Removed mark in place of the whole payload", async () => {
      server.use(
        ...withBody({
          content: null,
          attachments: [picture("m1", null, "REDACTED")],
          attachmentsStatus: "REDACTED",
        }),
      );
      renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

      const mark = await screen.findByTestId(byNode("postDetail.card.removalMark"));
      expect(mark).toHaveTextContent("Removed by its author");
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(screen.queryByTestId(byNode("postDetail.card.title"))).not.toBeInTheDocument();
      expect(screen.queryByTestId(byNode("postDetail.card.media"))).not.toBeInTheDocument();
      // The license rode the payload, so a redacted record has none to show.
      expect(screen.queryByTestId("post-license-terms")).not.toBeInTheDocument();
      // A REMOVED POST HAS NO MENU LEFT — back is the whole header
      // (`Removed.jsx:5-6`): no ⋮, and so none of its rows.
      expect(screen.queryByTestId(byNode("postDetail.header.menu"))).not.toBeInTheDocument();
      // What survives: the author, the timestamp, and the stance a reader can
      // still take, beside the count that proves nothing was quietly deleted.
      expect(screen.getByTestId(byNode("postDetail.card.authorChip"))).toBeInTheDocument();
      expect(screen.getByTestId(byNode("postDetail.card.timestamp"))).toBeInTheDocument();
      expect(screen.getByTestId(byNode("postDetail.card.actionRow.stance.anchor"))).toBeInTheDocument();
      expect(screen.getByTestId(byNode("postDetail.card.actionRow.comments"))).toBeInTheDocument();
    });

    it("names a platform removal differently from an author's own", async () => {
      server.use(
        ...withBody({
          content: null,
          attachments: [picture("m1", null, "REDACTED")],
          attachmentsStatus: "REDACTED",
          moderationStatus: "ILLEGAL",
        }),
      );
      renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

      expect(await screen.findByTestId(byNode("postDetail.card.removalMark"))).toHaveTextContent(
        "Removed under the platform's rules",
      );
    });

    it("veils the body as one and leaves the title readable", async () => {
      server.use(
        ...withBody({
          description: "Rubbings from three weekends.",
          attachments: [picture("m1", null)],
          attachmentsStatus: "SENSITIVE",
        }),
      );
      renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

      // The title is outside the veil, so the choice to look is informed.
      expect(await screen.findByTestId(byNode("postDetail.card.title"))).toHaveTextContent("The title");
      const veil = screen.getByTestId("post-veil");
      expect(veil).toBeInTheDocument();
      // One reveal answers for the whole body — the media and the words
      // beside it, which on a media post are the description (the XOR).
      fireEvent.click(within(veil).getByRole("button"));
      expect(screen.getByTestId(byNode("postDetail.card.media"))).toBeInTheDocument();
      expect(screen.getByTestId(byNode("postDetail.card.description"))).toHaveTextContent(
        "Rubbings from three weekends.",
      );
    });

    it("renders a comment's picture beside its words, which a comment keeps", async () => {
      server.use(
        ...threadFrom(() => detail("u1", [
              { id: "c1", body: "Look at this", attachments: [picture("mc", "a salt flat")] },
            ])),
      );
      renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
      await openComments();

      expect(await screen.findByTestId("post-comment-c1")).toHaveTextContent("Look at this");
      expect(screen.getByTestId("comment-media-c1")).toBeInTheDocument();
      expect(screen.getByAltText("a salt flat")).toBeInTheDocument();
    });

    // B4: design/readme.md states the rule for every comment attachment, not
    // only a video or a multi-picture set — "Square is the comment scale's
    // shape, and a comment's pictures and clips alike fill it". A single
    // picture used to keep its own (here, tall) shape and letterbox instead.
    it("fills a lone comment picture into the square frame, whatever its own shape", async () => {
      const tallPicture = {
        ...picture("mc", "a salt flat"),
        options: { __typename: "MediaOptions", aspectRatio: "9:16", durationMs: null },
      };
      server.use(
        ...threadFrom(() => detail("u1", [{ id: "c1", body: "Look at this", attachments: [tallPicture] }])),
      );
      renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
      await openComments();

      await screen.findByTestId("post-comment-c1");
      const frame = screen.getByTestId("media-gallery-lead");
      expect(frame.style.aspectRatio).toBe("1 / 1");
      // Filled (`cover`), not letterboxed (`contain`) — a 9:16 source would
      // otherwise fit whole inside the square with bars at the sides.
      expect(within(frame).getByAltText("a salt flat")).toHaveStyle({ objectFit: "cover" });
    });
  });
});

// OPENED FROM THE FEED (jakob 2026-10-09): the post the reader just tapped is
// already in the cache, so the page paints it at once and the detail read lands
// over it. A post the cache does not hold whole loads exactly as before.
describe("PostView — opened from the feed", () => {
  beforeEach(() => {
    window.localStorage.clear();
    forgetReveals();
  });

  /** The card the feed drew: the detail fixture's post with the feed's count. */
  function feedNode(data: PostPayload, totalCount: number) {
    return {
      ...data.post,
      comments: { __typename: "CommentConnection", totalCount },
    };
  }

  /** A cache holding what the feed's own read wrote. */
  function feedCache(...nodes: Record<string, unknown>[]) {
    const cache = new InMemoryCache();
    cache.writeQuery({
      query: FeedDocument,
      variables: {
        orderedIds: nodes.map((node) => String(node.id)),
        first: nodes.length,
        includePending: true,
      },
      data: {
        feed: {
          __typename: "FeedConnection",
          edges: nodes.map((node) => ({ __typename: "FeedEdge", node })),
        },
      } as unknown as FeedQuery,
    });
    return cache;
  }

  /**
   * The detail read, held until the test lets it land — so the page can be
   * measured BEFORE its read answers. Every test releases it and waits for it
   * to land inside its own body: nothing is left in flight for the next.
   */
  function heldDetail(answer: () => Response) {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let asked = 0;
    return {
      release,
      asked: () => asked,
      handler: gqlLink.query("PostDetail", async () => {
        asked += 1;
        await held;
        return answer();
      }),
    };
  }

  /** Another version of the post: an edit, which stamps a new `updatedAt`. */
  function edited(data: PostPayload, title: string, at = "2026-08-12T12:00:00Z"): PostPayload {
    return { post: { ...data.post, title: moderated(title), updatedAt: at } };
  }

  it("paints the post the feed holds at once, with no loading page", async () => {
    const data = detail("u1", [{ id: "c1", body: "First!" }]);
    // The same version, its thread grown — so the answer's landing can be seen.
    const answer = detail("u1", [
      { id: "c1", body: "First!" },
      { id: "c2", body: "Two" },
    ]);
    const read = heldDetail(() => HttpResponse.json({ data: answer }));
    server.use(read.handler);
    renderWithProviders(<PostView postId="p1" />, {
      writeSigner: fakeWriteSigner(),
      cache: feedCache(feedNode(data, 1)),
    });

    // The FIRST render is the card — no read has answered yet.
    expect(screen.queryByTestId("post-loading")).not.toBeInTheDocument();
    expect(screen.getByTestId(byNode("postDetail.card.title"))).toHaveTextContent("The title");
    expect(screen.getByTestId(byNode("postDetail.card.actionRow.comments"))).toHaveAccessibleName(
      "1 comment",
    );
    // The detail read still goes out behind the paint …
    await waitFor(() => expect(read.asked()).toBe(1));
    // … and the paint wears no refresh line while it does.
    expect(screen.queryByTestId("post-refreshing")).not.toBeInTheDocument();

    read.release();
    await waitFor(() =>
      expect(screen.getByTestId(byNode("postDetail.card.actionRow.comments"))).toHaveAccessibleName(
        "2 comments",
      ),
    );
    expect(screen.queryByTestId("post-loading")).not.toBeInTheDocument();
  });

  // CASE (a): the fresh read IS the version that was opened — same edit stamp,
  // same tags, same citations — so it is taken in silently, and what it moves
  // is the live count around the post, never the post.
  it("takes a fresh read of the same version silently, with no line", async () => {
    const fresh = detail("u1", [{ id: "c1", body: "First!" }, { id: "c2", body: "Two" }]);
    const read = heldDetail(() => HttpResponse.json({ data: fresh }));
    server.use(read.handler);
    const stale = detail("u1", [{ id: "c1", body: "First!" }]);
    renderWithProviders(<PostView postId="p1" />, {
      writeSigner: fakeWriteSigner(),
      cache: feedCache(feedNode(stale, 1)),
    });

    read.release();
    // The count the card states is the detail read's own whole-thread count now.
    await waitFor(() =>
      expect(screen.getByTestId(byNode("postDetail.card.actionRow.comments"))).toHaveAccessibleName(
        "2 comments",
      ),
    );
    expect(screen.queryByTestId(byNode("postDetail.newerVersion"))).not.toBeInTheDocument();
  });

  it("still loads a post the cache does not hold", async () => {
    const data = detail("u1", []);
    const read = heldDetail(() => HttpResponse.json({ data }));
    server.use(read.handler);
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

    expect(screen.getByTestId("post-loading")).toBeInTheDocument();
    expect(screen.queryByTestId(byNode("postDetail.card"))).not.toBeInTheDocument();
    read.release();
    expect(await screen.findByTestId(byNode("postDetail.card.title"))).toHaveTextContent("The title");
    expect(screen.queryByTestId("post-loading")).not.toBeInTheDocument();
  });

  // ALL OR NOTHING: a post the cache knows only in part — here only as a
  // citation's target, which carries its title and body and nothing else —
  // loads like an uncached one. Never a card with holes, never a crash.
  it("loads, rather than half-drawing, a post the cache holds only in part", async () => {
    const cache = new InMemoryCache();
    cache.writeFragment({
      id: "Post:p1",
      fragment: gql`
        fragment CitedPost on Post {
          id
          title {
            value
          }
          content {
            value
          }
        }
      `,
      data: {
        __typename: "Post",
        id: "p1",
        title: { __typename: "ModeratedText", value: "The title" },
        content: { __typename: "ModeratedText", value: "The body" },
      },
    });
    const data = detail("u1", []);
    const read = heldDetail(() => HttpResponse.json({ data }));
    server.use(read.handler);
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner(), cache });

    expect(screen.getByTestId("post-loading")).toBeInTheDocument();
    expect(screen.queryByTestId(byNode("postDetail.card"))).not.toBeInTheDocument();
    read.release();
    expect(await screen.findByTestId(byNode("postDetail.card.body"))).toHaveTextContent("The body");
  });

  // Over a card the reader can already see, a failed read is a failed refresh
  // (HT-10's shared rule): the card stays and the banner says so — never the
  // nothing-loaded page.
  it("keeps the cached card when its read fails, and says the refresh failed", async () => {
    const data = detail("u1", []);
    const read = heldDetail(() => HttpResponse.error());
    server.use(read.handler);
    renderWithProviders(<PostView postId="p1" />, {
      writeSigner: fakeWriteSigner(),
      cache: feedCache(feedNode(data, 0)),
    });

    read.release();
    expect(await screen.findByTestId("post-thread-transport-error")).toBeInTheDocument();
    expect(screen.getByTestId(byNode("postDetail.card.title"))).toHaveTextContent("The title");
    expect(screen.queryByTestId("post-transport-error")).not.toBeInTheDocument();
  });

  it("turns the cached card to not-found when the post no longer resolves", async () => {
    const data = detail("u1", []);
    const read = heldDetail(() => HttpResponse.json({ data: { post: null } }));
    server.use(read.handler);
    renderWithProviders(<PostView postId="p1" />, {
      writeSigner: fakeWriteSigner(),
      cache: feedCache(feedNode(data, 0)),
    });

    expect(screen.getByTestId(byNode("postDetail.card.title"))).toBeInTheDocument();
    read.release();
    expect(await screen.findByTestId("post-not-found")).toBeInTheDocument();
    expect(screen.queryByTestId(byNode("postDetail.card"))).not.toBeInTheDocument();
  });

  // THE DETAIL CLIP MOUNTS WITH THE PAINT — which is what lets the handover
  // still (#137) begin at once rather than one read later — and the fresh
  // answer landing over it keeps the same element: nothing remounts.
  it("mounts a cached video post's clip on the first render and keeps it through the fresh answer", async () => {
    const clip = {
      __typename: "MediaAttachment",
      id: "m1",
      url: "https://media.test/m1.mp4",
      altText: null,
      status: "NORMAL",
      mimeType: "video/mp4",
      options: { __typename: "MediaOptions", aspectRatio: "9:16", durationMs: 41_000 },
      coverMedia: null,
      coverTaken: false,
    };
    const data = detail("u1", [], undefined, false, [], [], { content: null, attachments: [clip] });
    const read = heldDetail(() => HttpResponse.json({ data }));
    server.use(read.handler);
    renderWithProviders(<PostView postId="p1" />, {
      writeSigner: fakeWriteSigner(),
      // The feed drew it before its thread grew, so the answer's landing shows.
      cache: feedCache(feedNode(data, 3)),
    });

    const media = screen.getByTestId("post-detail-clip-media");
    read.release();
    await waitFor(() =>
      expect(screen.getByTestId(byNode("postDetail.card.actionRow.comments"))).toHaveAccessibleName(
        "0 comments",
      ),
    );
    expect(screen.getByTestId("post-detail-clip-media")).toBe(media);
  });

  // ---- FC-7b · THE DETAIL HOLDS WHAT WAS OPENED (PostDetail.md:5-13) ---------

  const LINE = "Edited since you opened it — tap for the newest version.";
  const line = () => screen.queryByTestId(byNode("postDetail.newerVersion"));

  /** The reader's own pull, from the top (the "pulling down at the top" suite's gesture). */
  function pullDown(scroller: HTMLElement) {
    const touch = (type: string, clientY: number) => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperty(event, "touches", { value: [{ clientY }] });
      Object.defineProperty(event, "changedTouches", { value: [{ clientY }] });
      return event;
    };
    fireEvent(scroller, touch("touchstart", 100));
    fireEvent(scroller, touch("touchmove", 100 + PULL_THRESHOLD));
    fireEvent(scroller, touch("touchend", 100 + PULL_THRESHOLD));
  }

  /** Opens the detail on the feed's card and lets the fresh read land. */
  async function openOnto(painted: PostPayload, fresh: PostPayload, count = 0) {
    const read = heldDetail(() => HttpResponse.json({ data: fresh }));
    server.use(read.handler);
    const view = renderWithProviders(<PostView postId="p1" />, {
      writeSigner: fakeWriteSigner(),
      cache: feedCache(feedNode(painted, count)),
    });
    read.release();
    await waitFor(() => expect(read.asked()).toBe(1));
    return view;
  }

  it("an edit found on refresh holds the snapshot and offers the new version", async () => {
    const data = detail("u1", []);
    await openOnto(data, edited(data, "Edited title"));

    expect(await screen.findByTestId(byNode("postDetail.newerVersion"))).toBeInTheDocument();
    // AND NEVER postDetail.card changes (PostDetail.md:7).
    expect(screen.getByTestId(byNode("postDetail.card.title"))).toHaveTextContent("The title");
    expect(screen.getByTestId(byNode("postDetail.card.title"))).not.toHaveTextContent("Edited title");
  });

  it("the newer version line reads Edited since you opened it", async () => {
    const data = detail("u1", []);
    await openOnto(data, edited(data, "Edited title"));

    const shown = await screen.findByTestId(byNode("postDetail.newerVersion"));
    expect(shown).toHaveTextContent(LINE, { normalizeWhitespace: false });
    // An offer the reader acts on, announced politely — news, not a fault.
    expect(shown.tagName).toBe("BUTTON");
    expect(shown.closest('[role="status"]')).toHaveAttribute("aria-live", "polite");
  });

  it("a tag or citation change raises the same line in the same words", async () => {
    const data = detail("u1", [], undefined, false, [topicClaim("rust")]);
    // No new edit stamp: a tag is an act of its own on L1, and it still counts.
    const retagged = detail("u1", [], undefined, false, [topicClaim("rust"), topicClaim("wasm")]);
    const { unmount } = await openOnto(data, retagged);

    expect(await screen.findByTestId(byNode("postDetail.newerVersion"))).toHaveTextContent(LINE);
    expect(screen.queryByTestId(byNode("postDetail.card.tagsLine.tag", "p1/wasm"))).not.toBeInTheDocument();
    unmount();

    const cited = detail("u1", [], undefined, false, [], [referenceClaim(userTarget("u-ada", "ada"))]);
    await openOnto(detail("u1", []), cited);
    expect(await screen.findByTestId(byNode("postDetail.newerVersion"))).toHaveTextContent(LINE);
    // The opened post cited nothing, so its card still draws no line at all.
    expect(screen.queryByTestId(byNode("postDetail.card.tagsLine.counts"))).not.toBeInTheDocument();
  });

  it("the newer version line stands in flow and is never pinned", async () => {
    const data = detail("u1", []);
    await openOnto(data, edited(data, "Edited title"));

    const shown = await screen.findByTestId(byNode("postDetail.newerVersion"));
    // Not in the header that pins, and nothing between it and the page pins.
    expect(screen.getByTestId("post-header-bar")).not.toContainElement(shown);
    for (let at: HTMLElement | null = shown; at !== null; at = at.parentElement) {
      expect(at.className).not.toMatch(/\b(sticky|fixed)\b/);
    }
    // Between the header and the post, in the card's own edge-to-edge block:
    // full width, and the row itself is the 48px target.
    const card = screen.getByTestId(byNode("postDetail.card"));
    expect(shown.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The block bleeds nowhere: the page itself holds no gutter (the header
    // owns its own), so the line and the card meet the screen edge as one.
    expect(shown.parentElement?.parentElement).toContainElement(card);
    expect(shown.closest(".px-6")).toBeNull();
    expect(shown).toHaveClass("w-full");
    expect(shown.style.minHeight).toBe("var(--touch-target-min)");
  });

  it("tapping the line swaps the newest post tags and citations in place", async () => {
    const data = detail("u1", [], undefined, false, [topicClaim("rust")]);
    const newest = edited(
      detail("u1", [], undefined, false, [topicClaim("rust"), topicClaim("wasm")], [
        referenceClaim(userTarget("u-ada", "ada")),
      ]),
      "Edited title",
    );
    await openOnto(data, newest);
    const card = screen.getByTestId(byNode("postDetail.card"));

    fireEvent.click(await screen.findByTestId(byNode("postDetail.newerVersion")));

    expect(screen.getByTestId(byNode("postDetail.card.title"))).toHaveTextContent("Edited title");
    expect(screen.getByTestId(byNode("postDetail.card.tagsLine.tag", "p1/wasm"))).toBeInTheDocument();
    expect(screen.getByTestId(byNode("postDetail.card.tagsLine.counts"))).toHaveTextContent("1 reference");
    // In place: the same card, swapped, and the line gone.
    expect(screen.getByTestId(byNode("postDetail.card"))).toBe(card);
    expect(line()).not.toBeInTheDocument();
  });

  // THE THREAD IS NOT HELD: the freeze governs the post, and the thread is the
  // sheet's own read — so the count that raises it is the freshest read's.
  it("counts the thread from the freshest read while the post itself is held", async () => {
    const data = detail("u1", []);
    const fresh = edited(detail("u1", [{ id: "c1", body: "First!" }]), "Edited title");
    await openOnto(data, fresh);

    await screen.findByTestId(byNode("postDetail.newerVersion"));
    expect(screen.getByTestId(byNode("postDetail.card.actionRow.comments"))).toHaveAccessibleName(
      "1 comment",
    );
    expect(screen.getByTestId(byNode("postDetail.card.title"))).toHaveTextContent("The title");
  });

  // CASE (c): with nothing painted there is no opened version to hold.
  it("paints an edited post it never held, with no line", async () => {
    const data = detail("u1", []);
    const read = heldDetail(() => HttpResponse.json({ data: edited(data, "Edited title") }));
    server.use(read.handler);
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

    read.release();
    expect(await screen.findByTestId(byNode("postDetail.card.title"))).toHaveTextContent("Edited title");
    expect(line()).not.toBeInTheDocument();
  });

  // THE PULL IS THE READER ASKING FOR THE NEWEST (PostDetail.md:5, "until the
  // reader asks for the newest"): it lands over the opened version, line or no.
  it("lands the reader's own pull over the held version and takes the line down", async () => {
    const data = detail("u1", []);
    const first = edited(data, "Edited title");
    const second = edited(data, "Edited twice", "2026-08-12T13:00:00Z");
    let reads = 0;
    server.use(
      gqlLink.query("PostDetail", () => {
        reads += 1;
        return HttpResponse.json({ data: reads === 1 ? first : second });
      }),
    );
    const scroller = document.createElement("div");
    document.body.append(scroller);
    renderWithProviders(
      <ScrollHostProvider value={{ current: scroller }}>
        <PostView postId="p1" />
      </ScrollHostProvider>,
      { writeSigner: fakeWriteSigner(), cache: feedCache(feedNode(data, 0)) },
    );
    await screen.findByTestId(byNode("postDetail.newerVersion"));

    pullDown(scroller);

    await waitFor(() =>
      expect(screen.getByTestId(byNode("postDetail.card.title"))).toHaveTextContent("Edited twice"),
    );
    expect(line()).not.toBeInTheDocument();
    scroller.remove();
  });

  // A PULL WHILE THE OPENING READ IS OUT is the same operation with the same
  // variables, which Apollo deduplicates in flight: one answer settles both,
  // so no older answer can land second and raise a line for an older version.
  it("settles a pull made during the opening read on that one answer, with no line", async () => {
    const data = detail("u1", []);
    let releaseOpening!: () => void;
    const opening = new Promise<void>((resolve) => {
      releaseOpening = resolve;
    });
    let reads = 0;
    server.use(
      gqlLink.query("PostDetail", async () => {
        reads += 1;
        if (reads === 1) {
          await opening;
          return HttpResponse.json({ data: edited(data, "Edited once") });
        }
        return HttpResponse.json({ data: edited(data, "Edited twice", "2026-08-12T13:00:00Z") });
      }),
    );
    const scroller = document.createElement("div");
    document.body.append(scroller);
    renderWithProviders(
      <ScrollHostProvider value={{ current: scroller }}>
        <PostView postId="p1" />
      </ScrollHostProvider>,
      { writeSigner: fakeWriteSigner(), cache: feedCache(feedNode(data, 0)) },
    );
    await waitFor(() => expect(reads).toBe(1));

    pullDown(scroller);
    releaseOpening();
    // The pull is the reader asking, so the one answer lands over the opened
    // version — and nothing older is left in flight to land behind it.
    await waitFor(() =>
      expect(screen.getByTestId(byNode("postDetail.card.title"))).toHaveTextContent("Edited once"),
    );
    expect(reads).toBe(1);
    expect(line()).not.toBeInTheDocument();
    scroller.remove();
  });

  // ---- FC-7c · A REDACTION PATCHES THROUGH (PostDetail.md:15; seam 120.2) ----

  /** The record removed whole: every field and the gallery REDACTED. */
  function removed(data: PostPayload): PostPayload {
    const gone = { __typename: "ModeratedText", value: null, status: "REDACTED" };
    return {
      post: {
        ...data.post,
        title: gone,
        description: gone,
        content: gone,
        attachmentsStatus: "REDACTED",
        sensitiveSelfMark: false,
        sensitiveReason: null,
        updatedAt: "2026-08-12T12:00:00Z",
      },
    };
  }

  it("a redaction patches through the painted snapshot at once", async () => {
    const data = detail("u1", []);
    await openOnto(data, removed(data));

    expect(await screen.findByTestId(byNode("postDetail.card.removalMark"))).toBeInTheDocument();
    expect(screen.queryByTestId(byNode("postDetail.card.title"))).not.toBeInTheDocument();
    expect(line()).not.toBeInTheDocument();
  });

  it("a redaction never waits behind the newer version line", async () => {
    // ONE PART removed — a single picture of the gallery — in the same read
    // as an edit, which on its own would wait behind the line.
    const picture = (id: string, status = "NORMAL") => ({
      __typename: "MediaAttachment",
      id,
      url: `https://media.test/${id}.webp`,
      altText: null,
      status,
      mimeType: "image/webp",
      options: { __typename: "MediaOptions", aspectRatio: "1:1", durationMs: null },
      coverMedia: null,
      coverTaken: false,
    });
    const data = detail("u1", [], undefined, false, [], [], {
      content: null,
      attachments: [picture("m1"), picture("m2")],
    });
    const fresh = edited(
      detail("u1", [], undefined, false, [], [], {
        content: null,
        attachments: [picture("m1"), picture("m2", "REDACTED")],
      }),
      "Edited title",
    );
    await openOnto(data, fresh);

    expect(await screen.findByTestId(byNode("postDetail.card.removalMark"))).toBeInTheDocument();
    expect(line()).not.toBeInTheDocument();
  });

  // ---- THE CARRIED ELEMENT ACROSS THE HOLD (#146, #150) ----------------------

  function videoPost() {
    const clip = {
      __typename: "MediaAttachment",
      id: "m1",
      url: "https://media.test/m1.mp4",
      altText: null,
      status: "NORMAL",
      mimeType: "video/mp4",
      options: { __typename: "MediaOptions", aspectRatio: "9:16", durationMs: 41_000 },
      coverMedia: null,
      coverTaken: false,
    };
    return { clip, data: detail("u1", [], undefined, false, [], [], { content: null, attachments: [clip] }) };
  }

  // The line arrives ABOVE the clip, and swapping in a version whose clip is
  // the same clip keeps the one element: neither remounts the detail clip.
  it("keeps the detail clip's element through the line and through the swap", async () => {
    const { data } = videoPost();
    await openOnto(data, edited(data, "Edited title"));
    const media = screen.getByTestId("post-detail-clip-media");
    const element = media.querySelector("video");

    fireEvent.click(await screen.findByTestId(byNode("postDetail.newerVersion")));

    expect(screen.getByTestId(byNode("postDetail.card.title"))).toHaveTextContent("Edited title");
    expect(screen.getByTestId("post-detail-clip-media")).toBe(media);
    expect(screen.getByTestId("post-detail-clip-media").querySelector("video")).toBe(element);
  });

  // A removed clip patches through like any removal, and the detail clip
  // leaves: its element goes out of the page with it (`video-stage.ts`'s
  // release), never left playing above the skeleton.
  it("lets the detail clip go when a redaction removes it", async () => {
    const { clip, data } = videoPost();
    const read = heldDetail(() =>
      HttpResponse.json({
        data: edited(
          detail("u1", [], undefined, false, [], [], {
            content: null,
            attachments: [{ ...clip, status: "REDACTED" }],
          }),
          "Edited title",
        ),
      }),
    );
    server.use(read.handler);
    renderWithProviders(<PostView postId="p1" />, {
      writeSigner: fakeWriteSigner(),
      cache: feedCache(feedNode(data, 0)),
    });
    const element = screen.getByTestId("post-detail-clip-media").querySelector("video");

    read.release();
    expect(await screen.findByTestId(byNode("postDetail.card.removalMark"))).toBeInTheDocument();
    expect(screen.queryByTestId("post-detail-clip")).toBeNull();
    expect(element?.isConnected ?? false).toBe(false);
    expect(line()).not.toBeInTheDocument();
  });
});
