import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { writeCommittedFeedFilter } from "@/lib/feed/committed-filter";
import { FEED_FILTER_DEFAULT } from "@/lib/feed/feed-filter";
import { writeReaderDefault } from "@/lib/feed/reader-default";
import { createTokenStore } from "@/lib/session/token-store";
import { borrowedViewHandler } from "@/test/borrowed-view";
import { byNode } from "@/test/data-node";
import { fakeClampLayout } from "@/test/fake-clamp-layout";
import { fakeLineLayout } from "@/test/fake-line-layout";
import { hiddenHandlers, hiddenLog } from "@/test/hidden";
import { intersectEach, whenObserved } from "@/test/media-env";
import { gqlLink, startMswServer } from "@/test/msw";
import { answersComment, answersPost, taggedCommentWire } from "@/test/profile-comment";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { stanceHandlers } from "@/test/stance";
import { tagPageHandlers, type TaggedCommentsLog } from "@/test/tag-page";
import { TAG_EMPTY, TAG_NOT_FOUND, TAG_UNREACHABLE, TopicView } from "./topic-view";

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "u1" });
  return store;
}

/**
 * The persistent half of the store is localStorage, which outlives a
 * test — so a guest says so rather than inheriting whoever signed in
 * above it.
 */
function guestStore() {
  const store = createTokenStore();
  store.clear();
  return store;
}

// The post cards on this page carry the ⋮, whose rows navigate.
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const server = startMswServer(...stanceHandlers());

function moderated(value: string | null, status = "NORMAL") {
  return { __typename: "ModeratedText", value, status };
}

function postNode(id: string, title: string) {
  return {
    __typename: "Post",
    id,
    comments: { __typename: "CommentConnection", totalCount: 0 },
    title: moderated(title),
    description: moderated(null),
    content: moderated(`body of ${id}`),
    attachments: [],
    attachmentsStatus: "NORMAL",
    sensitiveSelfMark: false,
    sensitiveReason: null,
    author: {
      __typename: "User",
      id: "u1",
      handle: "alice",
      displayName: { __typename: "ModeratedText", value: "Alice" },
      avatar: null,
    },
    createdAt: "2026-08-12T10:00:00Z",
    updatedAt: "2026-08-12T10:00:00Z",
    landing: { __typename: "Landing", state: "LANDED" },
    moderationStatus: "NORMAL",
    // No removal: the node stands (api-spec.md `Post.removal`).
    removal: null,
    genesisRecordId: "rec-genesis",
    license: { __typename: "License", attribution: 0, provenance: 0 },
    topics: [],
    references: [],
  };
}

/**
 * A tagged comment as the tag page reads it (`topics.graphql` `TaggedComments`):
 * the comment whole, what it answers and its thread's post.
 */
function taggedComment(id: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return taggedCommentWire(id, {
    author: {
      __typename: "User",
      id: "u2",
      handle: "bob",
      displayName: { __typename: "ModeratedText", value: "Bob" },
      avatar: null,
    },
    content: moderated("nice crate"),
    target: answersPost("p1", "Salt maps of the coast road", "sol"),
    post: { __typename: "Post", id: "p1" },
    ...over,
  });
}

const REMOVED = { __typename: "Removal", at: "2026-11-18T10:00:00Z", by: "AUTHOR" };

function hashtagDetail(name: string, taggedContent: unknown[] = []) {
  return {
    hashtag: {
      __typename: "Hashtag",
      id: "ht-1",
      name: moderated(name),
      moderationStatus: "NORMAL",
      taggedContent,
    },
  };
}

const row = (node: unknown, relevance = 0.1, confidence = 1, pending = false) => ({
  relevance,
  confidence,
  pending,
  node,
});

/** The page's two reads, the comments named by the first and carried whole by the second. */
function serve(name: string, rows: unknown[], log?: TaggedCommentsLog) {
  server.use(...tagPageHandlers(hashtagDetail(name, rows).hashtag, log));
}

/** The keys of the post cards on the page, in order. */
const postCards = () =>
  screen.queryAllByTestId("tagPage.card").map((card) => card.getAttribute("data-testid-key"));

describe("TopicView", () => {
  // "ALWAYS at most one clip plays on the tag page, by the feed's stage law"
  // (TagPage.md:35): the tagged list stands on one stage, so the topmost
  // qualifying clip plays (Feed.md:17) and a second one waits.
  it("plays one clip on the tag page, the topmost that qualifies (TagPage.md:35)", async () => {
    const clipNode = (id: string) => ({
      ...postNode(id, `Clip ${id}`),
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
    serve("rust", [row(clipNode("p1")), row(clipNode("p2"))]);
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    await screen.findByTestId(byNode("tagPage.card", "p2"));
    const clipOf = (id: string) =>
      screen.getByTestId(byNode("tagPage.card.media", id)).querySelector("video") as HTMLVideoElement;
    // The stage watches its clips from a passive effect; report their places
    // only once it does (`whenObserved`).
    await whenObserved(clipOf("p1"), clipOf("p2"));
    act(() =>
      intersectEach([
        { target: clipOf("p2"), ratio: 1 },
        { target: clipOf("p1"), ratio: 1 },
      ]),
    );
    expect(clipOf("p1").paused).toBe(false);
    expect(clipOf("p2").paused).toBe(true);
  });

  // TagPage.md:3 — "ALWAYS the tag page is titled by the tag, # and all"; a
  // page title is a one-line place (NamesLong.md:3), cut with "…".
  it("the_tag_page_is_titled_by_the_tag_hash_and_all_in_its_header", async () => {
    serve("rust", [row(postNode("p1", "About Rust"))]);
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    const title = await screen.findByTestId("tagPage.header.title");
    expect(title).toHaveTextContent("#rust");
    expect(screen.getByTestId("tagPage.header")).toContainElement(title);
    expect(title).toHaveClass("truncate");
  });

  // TagPage.md:7 — the header carries no control; the topic's row stands
  // under the title, above every post.
  it("the_header_carries_no_control_and_the_topics_row_stands_under_it_above_every_post", async () => {
    serve("rust", [row(postNode("p1", "About Rust"))]);
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    const header = await screen.findByTestId("tagPage.header");
    expect(within(header).queryAllByRole("button")).toHaveLength(0);
    const actionRow = screen.getByTestId("tagPage.actionRow");
    const card = screen.getByTestId(byNode("tagPage.card", "p1"));
    expect(header.compareDocumentPosition(actionRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(actionRow.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders the tagged posts, reusing PostCard", async () => {
    serve("rust", [row(postNode("p1", "About Rust"))]);
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    const card = await screen.findByTestId(byNode("tagPage.card", "p1"));
    expect(card).toHaveTextContent("About Rust");
    expect(screen.getByTestId("topic-post-p1-link")).toHaveAttribute("href", "/posts/p1?from=tag%3Arust");
    // PostCard's own inventory rides along — the stance control included.
    expect(screen.getByTestId(byNode("tagPage.card.actionRow.stance.anchor", "p1"))).toBeInTheDocument();
  });

  // TagPage.md:45: the word "follow" appears nowhere on the tag page.
  it("offers no follow gesture", async () => {
    serve("rust", [row(postNode("p1", "About Rust"))]);
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    await screen.findByTestId("tagPage.header");
    expect(screen.queryByTestId("topic-follow")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /follow/i })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/follow/i);
  });

  // The row is the page's own gesture, and it names what it stances —
  // the tag itself, hash and all — because three stance controls stand
  // on this page and the accessible name is what says which is which.
  it("carries an Affinity row toward the topic, named by the tag, its share beside it", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } });
    serve("rust", [row(postNode("p1", "About Rust"))]);
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("tagPage.actionRow.stance.anchor")).toHaveAccessibleName(
      "Give your opinion on #rust",
    );
    expect(screen.getByTestId("tagPage.actionRow.share")).toHaveAccessibleName("Share #rust");
  });

  // THE SIX WORDS ARE THE FAMILY'S (jakob 2026-09-15). The control owns
  // the geometry; association asks how much you like it and attraction
  // how close you want to be — never the opinion's own question.
  it("asks the Affinity's own questions on the accessible route", async () => {
    serve("rust", [row(postNode("p1", "About Rust"))]);
    renderWithProviders(<TopicView name="rust" />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    await screen.findByTestId("tagPage.actionRow.stance.anchor");
    fireEvent.click(screen.getByTestId("topic-affinity-choose"));
    expect(await screen.findByTestId("stance-alternates")).toBeInTheDocument();
    expect(screen.getByLabelText("How much you like it", { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText("How close you want to be", { exact: false })).toBeInTheDocument();
    expect(screen.queryByLabelText("For or against", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("How much reaches you", { exact: false })).not.toBeInTheDocument();
  });

  // A GUEST IS NOT SPECIAL HERE (backlog item 81, ruled 2026-09-15;
  // TagPage.md:53, :59): any reader who taps a tag reaches the page and sees
  // what is tagged. The face wears the no-opinion 🫥 and the tap opens the
  // join prompt — it never bounces them.
  it("lets a guest read the page and gates the row at the join prompt", async () => {
    serve("rust", [row(postNode("p1", "About Rust"))]);
    renderWithProviders(<TopicView name="rust" />, {
      store: guestStore(),
      writeSigner: fakeWriteSigner(),
    });
    expect(await screen.findByTestId(byNode("tagPage.card", "p1"))).toBeInTheDocument();
    const anchor = await screen.findByTestId("tagPage.actionRow.stance.anchor");
    expect(screen.getByTestId("tagPage.actionRow.stance.anchor.face")).toHaveTextContent("🫥");
    expect(screen.queryByTestId("topic-affinity-choose")).not.toBeInTheDocument();
    fireEvent.click(anchor);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  // TagPage.md:55 — the topic's wide anchor's words beside the hollow face
  // name the borrowed view, its handle ellipsized before `'s opinion`.
  it("tagpage_md_55_a_guests_topic_anchor_words_name_the_borrowed_view", async () => {
    server.use(borrowedViewHandler("genesismod"));
    serve("rust", [row(postNode("p1", "About Rust"))]);
    renderWithProviders(<TopicView name="rust" />, { store: guestStore(), writeSigner: fakeWriteSigner() });
    const anchor = await screen.findByTestId("tagPage.actionRow.stance.anchor");
    const words = await within(anchor).findByTestId("topic-affinity-words");
    expect(words).toHaveTextContent("@genesismod's opinion");
    expect(anchor).not.toHaveTextContent("Your opinion");
    expect(screen.getByTestId("tagPage.actionRow.stance.anchor.face")).toHaveTextContent("🫥");
    // The handle is what gives, never `'s opinion`.
    expect(within(anchor).getByTestId("topic-affinity-words-handle").className).toContain("truncate");
    expect(within(anchor).getByTestId("topic-affinity-words-suffix").className).toContain("flex-none");
  });

  // TagPage.md:57 — the accessible name keeps the borrowed view's full handle.
  it("tagpage_md_57_a_guests_topic_anchor_name_keeps_the_full_handle", async () => {
    server.use(borrowedViewHandler("genesismod"));
    serve("rust", [row(postNode("p1", "About Rust"))]);
    renderWithProviders(<TopicView name="rust" />, { store: guestStore(), writeSigner: fakeWriteSigner() });
    const anchor = await screen.findByTestId("tagPage.actionRow.stance.anchor");
    await within(anchor).findByTestId("topic-affinity-words");
    expect(anchor).toHaveAccessibleName("@genesismod's stance on #rust");
  });

  // TagPageEmpty.md:9 — "ALWAYS the empty tag page carries the topic's own
  // stance row, holding nothing".
  it("the_empty_tag_page_carries_the_topics_own_stance_row_holding_nothing", async () => {
    serve("nevertagged", []);
    renderWithProviders(<TopicView name="nevertagged" />, { writeSigner: fakeWriteSigner() });
    await screen.findByTestId("topic-empty");
    expect(screen.getByTestId("tagPage.actionRow.stance.anchor")).toBeInTheDocument();
    expect(screen.getByTestId("tagPage.actionRow.stance.anchor.face")).toHaveTextContent("🫥");
  });

  // TagPage.md:73, TagPageEmpty.md:3-7 — a legal name nothing carries opens
  // the page empty, never "doesn't exist", no action, no error colour.
  it("a_legal_name_nothing_carries_opens_the_page_empty_never_this_tag_doesnt_exist", async () => {
    serve("nevertagged", []);
    renderWithProviders(<TopicView name="nevertagged" />, { writeSigner: fakeWriteSigner() });
    const empty = await screen.findByTestId("topic-empty");
    expect(empty).toHaveTextContent(TAG_EMPTY);
    expect(TAG_EMPTY).toBe("Nothing carries this tag right now.");
    expect(document.body).not.toHaveTextContent(TAG_NOT_FOUND);
    expect(within(empty).queryAllByRole("button")).toHaveLength(0);
    expect(empty.innerHTML).not.toContain("text-error");
  });

  // TagPage.md:69-71 — a name that cannot be a tag: the header keeps the name
  // asked for, `This tag doesn't exist.` in the page's place, the answer no —
  // never the failure voice, the error colour, a row, a card or a Retry.
  it("a_name_that_cannot_be_a_tag_reads_this_tag_doesnt_exist_under_the_name_asked_for", async () => {
    server.use(gqlLink.query("HashtagDetail", () => HttpResponse.json({ data: { hashtag: null } })));
    renderWithProviders(<TopicView name="salt maps" />, { writeSigner: fakeWriteSigner() });
    const answer = await screen.findByTestId("topic-not-found");
    expect(answer).toHaveTextContent(TAG_NOT_FOUND);
    expect(TAG_NOT_FOUND).toBe("This tag doesn't exist.");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("#salt maps");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(answer.innerHTML).not.toContain("text-error");
    expect(screen.queryByTestId("topic-retry")).toBeNull();
    expect(screen.queryByTestId("tagPage.actionRow")).toBeNull();
  });

  // THE FULL NAME (TagPage.md:5-11, round 63; jakob 2026-11-23): the header's
  // title keeps one line; where that line cuts the name, the whole name stands
  // under the header, print only, above the topic's row. The cut is the title's
  // measured overflow (`fakeLineLayout` stands in for the browser's widths).
  describe("the tag's full name", () => {
    const LONG = "salt_maps_of_the_coast_road_and_the_third_headland_light";
    let lines: ReturnType<typeof fakeLineLayout>;
    beforeEach(() => {
      lines = fakeLineLayout(332);
    });
    afterEach(() => lines.restore());

    it("a_name_the_headers_line_cuts_stands_whole_under_the_header_print_only_above_the_topics_row", async () => {
      serve(LONG, []);
      renderWithProviders(<TopicView name={LONG} />, { writeSigner: fakeWriteSigner() });
      const heading = await screen.findByTestId("tagPage.name");
      expect(heading).toHaveTextContent(`#${LONG}`);
      expect(heading).toHaveAttribute("aria-hidden", "true");
      expect(heading.className).toContain("text-title-large");
      expect(heading.className).toContain("break-words");
      // the header's title speaks the whole name; it is the page's one heading
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(`#${LONG}`);
      expect(screen.getByTestId("tagPage.header.title")).toHaveTextContent(`#${LONG}`);
      expect(screen.getAllByRole("heading")).toHaveLength(1);
      // under the header, above the topic's row
      const row = screen.getByTestId("tagPage.actionRow");
      const header = screen.getByTestId("tagPage.header");
      expect(header.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(heading.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("a_name_that_fits_the_headers_line_is_never_printed_twice", async () => {
      serve("rust", []);
      renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
      await screen.findByTestId("tagPage.actionRow");
      expect(screen.queryByTestId("tagPage.name")).toBeNull();
    });

    it("the_heading_follows_the_line_a_wider_screen_fits_the_name_and_a_narrower_cuts_it_again", async () => {
      serve(LONG, []);
      renderWithProviders(<TopicView name={LONG} />, { writeSigner: fakeWriteSigner() });
      await screen.findByTestId("tagPage.name");
      lines.resize(2000);
      expect(screen.queryByTestId("tagPage.name")).toBeNull();
      lines.resize(332);
      expect(screen.getByTestId("tagPage.name")).toBeInTheDocument();
    });

    it("the_not_found_header_cuts_and_no_full_name_stands", async () => {
      server.use(gqlLink.query("HashtagDetail", () => HttpResponse.json({ data: { hashtag: null } })));
      renderWithProviders(<TopicView name={`${LONG} x`} />, { writeSigner: fakeWriteSigner() });
      await screen.findByTestId("topic-not-found");
      expect(screen.getByRole("heading", { level: 1 }).className).toContain("truncate");
      expect(screen.queryByTestId("tagPage.name")).toBeNull();
    });
  });

  // TagPage.md:65-67 — the first read gets no answer: the header stands, the
  // house line's noun form over an outlined Retry; Retry reads again.
  it("the_first_read_getting_no_answer_stands_the_header_over_the_line_and_retry_and_heals", async () => {
    let calls = 0;
    server.use(
      gqlLink.query("HashtagDetail", () => {
        calls += 1;
        return calls === 1 ? HttpResponse.error() : HttpResponse.json({ data: hashtagDetail("rust") });
      }),
    );
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("topic-transport-error")).toHaveTextContent(TAG_UNREACHABLE);
    expect(TAG_UNREACHABLE).toBe("Can't reach the server — this tag can't load right now.");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("#rust");
    expect(screen.queryByTestId("tagPage.actionRow")).toBeNull();
    expect(screen.queryByTestId("tagPage.card")).toBeNull();
    fireEvent.click(screen.getByTestId("topic-retry"));
    expect(await screen.findByTestId("tagPage.header.title")).toHaveTextContent("#rust");
    expect(screen.queryByTestId("topic-transport-error")).not.toBeInTheDocument();
  });

  // TagPage.md:51: "ALWAYS the back arrow reads Back to Explore and leads to
  // Explore GIVEN the page was entered with no history behind it".
  it("backs to Explore when entered with no origin behind it", async () => {
    serve("rust", []);
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    const back = await screen.findByTestId("tagPage.header.back");
    expect(back).toHaveAttribute("href", "/explore");
    expect(back).toHaveAttribute("aria-label", "Back to Explore");
  });

  // TagPage.md:49: "… Back to feed from the feed in any of its states".
  it("backs to the feed when opened from the feed", async () => {
    serve("rust", []);
    renderWithProviders(<TopicView name="rust" from="feed" />, { writeSigner: fakeWriteSigner() });
    const back = await screen.findByTestId("tagPage.header.back");
    expect(back).toHaveAttribute("href", "/feed");
    expect(back).toHaveAttribute("aria-label", "Back to feed");
  });

  // TagPage.md:49: "… Back to the post from a post's tags-and-references sheet".
  it("backs to the post, opened as it was, when opened from its sheet", async () => {
    serve("rust", []);
    renderWithProviders(<TopicView name="rust" from="post:p1:saved" />, { writeSigner: fakeWriteSigner() });
    const back = await screen.findByTestId("tagPage.header.back");
    expect(back).toHaveAttribute("href", "/posts/p1?from=saved");
    expect(back).toHaveAttribute("aria-label", "Back to the post");
  });

  // History.md:57: a History tag card's page reads Back to History.
  it("backs to History when opened from a History card", async () => {
    serve("rust", []);
    renderWithProviders(<TopicView name="rust" from="history" />, { writeSigner: fakeWriteSigner() });
    const back = await screen.findByTestId("tagPage.header.back");
    expect(back).toHaveAttribute("href", "/history");
    expect(back).toHaveAttribute("aria-label", "Back to History");
  });

  // The back arrow of the two pages that answer no keeps its legacy id —
  // "The failed and not-found states stay unnamed" (TagPage.jsx).
  it("the_failed_page_wears_no_registered_header", async () => {
    server.use(gqlLink.query("HashtagDetail", () => HttpResponse.error()));
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    await screen.findByTestId("topic-transport-error");
    expect(screen.getByTestId("topic-back")).toHaveAttribute("aria-label", "Back to Explore");
    expect(screen.queryByTestId("tagPage.header")).toBeNull();
  });
});

// EVERY ROW IS ITS CLAIM, THEN ITS CARD (TagPage.md:15-27; TaggedRow.jsx).
describe("TopicView — the rows", () => {
  // TagPage.md:27 — "ALWAYS every row carries the claim above it, its exact
  // pair painting only in geek mode", keyed by the tagged thing's id.
  it("every_row_carries_the_claim_above_it_keyed_by_the_tagged_things_id", async () => {
    serve("rust", [row(postNode("p1", "About Rust"), 0.55, 1), row(taggedComment("c1"), 0.4, 0.9, true)]);
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    const postClaim = await screen.findByTestId(byNode("tagPage.claim", "p1"));
    const commentClaim = screen.getByTestId(byNode("tagPage.claim", "c1"));
    expect(postClaim.compareDocumentPosition(screen.getByTestId(byNode("tagPage.card", "p1")))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(commentClaim.compareDocumentPosition(screen.getByTestId(byNode("tagPage.commentCard", "c1")))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByTestId(byNode("tagPage.claim.glyph", "p1"))).toHaveTextContent("🔗");
    expect(screen.getByTestId(byNode("tagPage.claim.exact", "p1"))).toHaveTextContent("+0.55 / 1.00");
    expect(screen.getByTestId(byNode("tagPage.claim.exact", "p1"))).toHaveClass("cg-exact");
    expect(screen.getByTestId(byNode("tagPage.claim.pending", "c1"))).toHaveTextContent("Still settling");
    expect(screen.queryByTestId(byNode("tagPage.claim.pending", "p1"))).toBeNull();
    // The card fuses with the flag: its top-left corner squares (`attach`).
    expect(screen.getByTestId(byNode("tagPage.card", "p1"))).toHaveClass("rounded-tl-none");
    expect(screen.getByTestId(byNode("tagPage.commentCard", "c1"))).toHaveClass("rounded-tl-none");
  });

  // TagPage.md:15 — a tagged comment stands as tagPage.commentCard leading
  // with the thread it answers.
  it("a_tagged_comment_stands_as_tagPage_commentCard_leading_with_the_thread_it_answers", async () => {
    serve("rust", [row(taggedComment("c1"))]);
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    const card = await screen.findByTestId(byNode("tagPage.commentCard", "c1"));
    const target = within(card).getByTestId(byNode("tagPage.commentCard.target", "c1"));
    expect(target).toHaveTextContent("On “Salt maps of the coast road” — @sol");
    expect(card.firstElementChild).toBe(target);
    expect(card).toHaveTextContent("nice crate");
    expect(within(card).getByTestId(byNode("tagPage.commentCard.authorChip", "c1"))).toHaveTextContent("@bob");
    expect(within(card).getByTestId(byNode("tagPage.commentCard.actionRow.stance.anchor", "c1"))).toBeInTheDocument();
  });

  // Seam 411 (jakob, 2026-11-23): the tagged comment's card carries its tags
  // line, and the line does there what it does on the feed's comment card —
  // two chips, then the counts, its references included. One card, one
  // behaviour.
  it("a_tagged_comments_card_carries_its_tags_line_two_chips_then_the_counts_its_references_included", async () => {
    const tag = (name: string) => ({
      __typename: "TopicClaim",
      hashtag: { __typename: "Hashtag", id: `ht-${name}`, name: moderated(name) },
      relevance: 0.4,
      confidence: 0.9,
      pending: false,
    });
    const citation = (id: string) => ({
      __typename: "ReferenceClaim",
      targetId: id,
      relevance: 0.5,
      support: 0.5,
      withdrawalCost: 1,
      rawRelevance: 0.5,
      rawSupport: 0.5,
      pending: false,
      target: null,
    });
    const log: TaggedCommentsLog = { asked: [] };
    serve(
      "rust",
      [
        row(postNode("p1", "About Rust")),
        row(
          taggedComment("c1", {
            topics: [tag("rust"), tag("wasm"), tag("axum")],
            references: [citation("r1"), citation("r2")],
          }),
        ),
      ],
      log,
    );
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    const line = await screen.findByTestId(byNode("tagPage.commentCard.tagsLine", "c1"));
    expect(within(line).getByTestId(byNode("tagPage.commentCard.tagsLine.tag", "c1/rust"))).toBeInTheDocument();
    expect(within(line).getByTestId(byNode("tagPage.commentCard.tagsLine.tag", "c1/wasm"))).toBeInTheDocument();
    expect(within(line).queryByTestId(byNode("tagPage.commentCard.tagsLine.tag", "c1/axum"))).toBeNull();
    expect(within(line).getByTestId(byNode("tagPage.commentCard.tagsLine.counts", "c1"))).toHaveTextContent(
      "· 1 tag · 2 references",
    );
    // The comment cards are read apart, over exactly the comment ids the list named.
    expect(log.asked).toEqual([["c1"]]);
  });

  // A page that tags no comment sends no second read (`fetchHashtagDetail`).
  it("a_page_with_no_tagged_comment_sends_no_comment_read", async () => {
    const log: TaggedCommentsLog = { asked: [] };
    serve("rust", [row(postNode("p1", "About Rust"))], log);
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    await screen.findByTestId(byNode("tagPage.card", "p1"));
    expect(log.asked).toEqual([]);
  });

  // TagPage.md:65 — the page's read is both reads: the comment cards' read
  // getting no answer is the page's read getting none.
  it("the_comment_cards_read_getting_no_answer_stands_the_failure_line_and_retry", async () => {
    serve("rust", [row(taggedComment("c1"))]);
    server.use(gqlLink.query("TaggedComments", () => HttpResponse.error()));
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("topic-transport-error")).toHaveTextContent(TAG_UNREACHABLE);
    expect(screen.queryByTestId(byNode("tagPage.commentCard", "c1"))).toBeNull();
  });

  // TagPage.md:17 — no Reply and no view-replies line.
  it("a_tagged_comments_card_offers_no_reply_and_no_view_replies_line", async () => {
    serve("rust", [row(taggedComment("c1"))]);
    renderWithProviders(<TopicView name="rust" />, { store: signedInStore(), writeSigner: fakeWriteSigner() });
    const card = await screen.findByTestId(byNode("tagPage.commentCard", "c1"));
    expect(within(card).queryByRole("link", { name: /reply/i })).toBeNull();
    expect(within(card).queryByRole("button", { name: /reply/i })).toBeNull();
    expect(screen.queryByText(/view \d+ repl/i)).toBeNull();
  });

  // TagPage.md:21 — the pointer names a removed post it answers by its
  // author's handle, never by its title.
  it("a_tagged_comments_pointer_names_a_removed_post_by_its_authors_handle", async () => {
    serve("rust", [
      row(
        taggedComment("c1", {
          target: { ...answersPost("p1", "Salt maps of the coast road", "sol"), removal: REMOVED },
        }),
      ),
    ]);
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    const target = await screen.findByTestId(byNode("tagPage.commentCard.target", "c1"));
    expect(target).toHaveTextContent("On @sol's removed post");
    expect(target).not.toHaveTextContent("Salt maps");
  });

  // THE POINTER DOOR (TagPage.md:23, :25; jakob 2026-11-23, seams 405 and
  // 417): the pointer naming a post opens the post itself, no comment section
  // opened; a reply's pointer opens the thread at the comment it names; the
  // rest of the card the thread at the card's own comment; the chip the
  // author — each carrying the page and its origin.
  it("a_tagged_comments_doors_carry_the_page", async () => {
    serve("rust", [
      row(taggedComment("c1")),
      row(taggedComment("c2", { target: answersComment("c0", "sol") })),
    ]);
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    const target = await screen.findByTestId(byNode("tagPage.commentCard.target", "c1"));
    expect(target).toHaveAttribute("href", "/posts/p1?from=tag%3Arust");
    expect(screen.getByTestId(byNode("tagPage.commentCard.target", "c2"))).toHaveAttribute(
      "href",
      "/posts/p1?comment=c0&from=tag%3Arust",
    );
    expect(screen.getByTestId("topic-comment-c1-link")).toHaveAttribute("href", "/posts/p1?comment=c1&from=tag%3Arust");
    expect(screen.getByTestId(byNode("tagPage.commentCard.authorChip", "c1"))).toHaveAttribute(
      "href",
      "/u/bob?from=tag%3Arust",
    );
  });
});

// THE TAG PAGE'S CARD MENU (TagPageMenu.md, round 36 + 41): the one post menu
// every host shares, risen over the page as `tagPage.menuSheet`, its aftermath
// on `tagPage.snackbar`.
describe("TopicView — a post card's menu (TagPageMenu.md)", () => {
  const tobiasPost = () => ({
    ...postNode("p1", "About Rust"),
    viewerBookmarkedAt: null,
    author: {
      __typename: "User",
      id: "t1",
      handle: "tobias",
      displayName: { __typename: "ModeratedText", value: "Tobias" },
      avatar: null,
    },
  });
  const serveTag = () => serve("rust", [row(tobiasPost()), row({ ...postNode("p2", "More Rust"), id: "p2" })]);
  const rows = () =>
    within(screen.getByTestId("tagPage.menuSheet"))
      .getAllByRole("button")
      .map((sheetRow) => [sheetRow.getAttribute("data-testid"), sheetRow.textContent]);
  const menuOf = (id: string) => screen.findByTestId(byNode("tagPage.card.menu", id));

  it("the_menu_rises_over_the_tag_page_reading_save_cite_hide_license_report", async () => {
    // TagPageMenu.md:3, :5.
    serveTag();
    renderWithProviders(<TopicView name="rust" />, { store: signedInStore(), writeSigner: fakeWriteSigner() });
    fireEvent.click(await menuOf("p1"));
    expect((screen.getByTestId("tagPage.menuSheet") as HTMLDialogElement).open).toBe(true);
    expect(rows()).toEqual([
      ["tagPage.menuSheet.save", "Save"],
      ["tagPage.menuSheet.cite", "Cite in a new post"],
      ["tagPage.menuSheet.hide", "Hide @tobias"],
      ["tagPage.menuSheet.citedBy", "Cited by"],
      ["tagPage.menuSheet.opinions", "Opinions on this"],
      ["tagPage.menuSheet.license", "License terms"],
      ["tagPage.menuSheet.report", "Report"],
    ]);
  });

  it("the_own_posts_menu_on_the_tag_page_reads_save_cite_edit_sensitive_remove_cited_by_opinions_license", async () => {
    // TagPageMenuOwn.md:5.
    serveTag();
    renderWithProviders(<TopicView name="rust" />, { store: signedInStore(), writeSigner: fakeWriteSigner() });
    fireEvent.click(await menuOf("p2"));
    expect(rows().map(([node]) => node)).toEqual([
      "tagPage.menuSheet.save",
      "tagPage.menuSheet.cite",
      "tagPage.menuSheet.edit",
      "tagPage.menuSheet.markSensitive",
      "tagPage.menuSheet.remove",
      "tagPage.menuSheet.citedBy",
      "tagPage.menuSheet.opinions",
      "tagPage.menuSheet.license",
    ]);
  });

  it("cited_by_raises_what_cites_the_post_over_the_tag_page", async () => {
    // TagPageMenu.md:5 with CitedBy.md:5 — over the host, the list beneath.
    serveTag();
    renderWithProviders(<TopicView name="rust" />, { store: signedInStore(), writeSigner: fakeWriteSigner() });
    fireEvent.click(await menuOf("p1"));
    fireEvent.click(screen.getByTestId("tagPage.menuSheet.citedBy"));
    expect(((await screen.findByTestId("postDetail.citedBySheet")) as HTMLDialogElement).open).toBe(true);
    expect(screen.getByTestId("topic-content-list")).toBeInTheDocument();
  });

  it("a_removed_posts_menu_rises_over_the_tag_page_reading_the_readers_menu_whole", async () => {
    // TagPageRemovedMenu.md:3, :5.
    serve("rust", [
      row({
        ...tobiasPost(),
        title: moderated(null, "REDACTED"),
        content: moderated(null, "REDACTED"),
        removal: REMOVED,
      }),
    ]);
    // The removed post stands on the tag page only while the feed's stored
    // filter has Removed on (TagPage.md:23-25).
    window.localStorage.clear();
    writeCommittedFeedFilter("u1", { ...FEED_FILTER_DEFAULT, also: ["settling", "removed"] });
    onTestFinished(() => window.localStorage.clear());
    renderWithProviders(<TopicView name="rust" />, { store: signedInStore(), writeSigner: fakeWriteSigner() });
    fireEvent.click(await menuOf("p1"));
    expect(rows()).toEqual([
      ["tagPage.menuSheet.save", "Save"],
      ["tagPage.menuSheet.cite", "Cite in a new post"],
      ["tagPage.menuSheet.hide", "Hide @tobias"],
      ["tagPage.menuSheet.citedBy", "Cited by"],
      ["tagPage.menuSheet.opinions", "Opinions on this"],
      ["tagPage.menuSheet.license", "License terms"],
      ["tagPage.menuSheet.report", "Report"],
    ]);
  });

  it("hide_closes_the_sheet_leaves_every_row_in_place_and_snackbars_with_undo_and_no_confirm", async () => {
    // TagPageMenu.md:7.
    const log = hiddenLog();
    serveTag();
    server.use(...hiddenHandlers(log));
    renderWithProviders(<TopicView name="rust" />, { store: signedInStore(), writeSigner: fakeWriteSigner() });
    fireEvent.click(await menuOf("p1"));
    fireEvent.click(screen.getByTestId("tagPage.menuSheet.hide"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByTestId("tagPage.snackbar.message")).toHaveTextContent("@tobias is hidden.");
    expect(screen.getByTestId("tagPage.snackbar.action")).toHaveTextContent("Undo");
    expect(postCards()).toEqual(["p1", "p2"]);
    await waitFor(() => expect(log.hides).toEqual([{ actor: "t1", at: null }]));
  });

  it("the_hide_row_reads_unhide_with_the_handle_while_the_author_is_already_hidden", async () => {
    // TagPageMenu.md:15, and ReaderPostMenu.md:21 for the tap.
    const log = hiddenLog();
    serveTag();
    server.use(
      ...hiddenHandlers(log, {
        entries: [{ id: "t1", handle: "tobias", displayName: "Tobias", hiddenAt: "2026-10-01T00:00:00Z" }],
      }),
    );
    renderWithProviders(<TopicView name="rust" />, { store: signedInStore(), writeSigner: fakeWriteSigner() });
    await waitFor(() => expect(log.reads).toBe(1));
    fireEvent.click(await menuOf("p1"));
    await waitFor(() => expect(screen.getByTestId("tagPage.menuSheet.hide")).toHaveTextContent(/^Unhide @tobias$/));
    fireEvent.click(screen.getByTestId("tagPage.menuSheet.hide"));
    expect(screen.getByTestId("tagPage.snackbar.message")).toHaveTextContent("@tobias is unhidden.");
    expect(postCards()).toEqual(["p1", "p2"]);
    await waitFor(() => expect(log.unhides).toEqual(["t1"]));
  });

  it("report_closes_the_menu_and_raises_the_confirm_over_the_page_sending_nothing", async () => {
    // TagPageMenu.md:11.
    const reports: unknown[] = [];
    serveTag();
    server.use(
      gqlLink.mutation("SendReport", ({ variables }) => {
        reports.push(variables);
        return HttpResponse.json({ data: null });
      }),
    );
    renderWithProviders(<TopicView name="rust" />, { store: signedInStore(), writeSigner: fakeWriteSigner() });
    fireEvent.click(await menuOf("p1"));
    fireEvent.click(screen.getByTestId("tagPage.menuSheet.report"));
    const confirm = await screen.findByTestId("topic-menu-report-sheet");
    expect(confirm).toHaveAccessibleName("Report this post?");
    expect(reports).toEqual([]);
  });

  it("a_guests_cite_raises_the_join_prompt_and_opens_no_wizard", async () => {
    // FeedPostMenu.md:23 (any host), GuestGate.md:5.
    serveTag();
    push.mockClear();
    renderWithProviders(<TopicView name="rust" />, { store: guestStore(), writeSigner: fakeWriteSigner() });
    fireEvent.click(await menuOf("p1"));
    fireEvent.click(screen.getByTestId("tagPage.menuSheet.cite"));
    expect(await screen.findByTestId("join-prompt")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

// EVERY DOOR OUT OF THE TAG PAGE CARRIES IT AND THE ORIGIN IT WAS OPENED WITH
// (jakob 2026-11-10, "grandfathering style"; BottomNav.prompt.md: the
// originating root stays lit on a drill-in): the post, a comment's thread, the
// author's profile and the score's trace read `Back to #rust` and keep lit the
// root the page was opened from — Explore's here, the profile's in the chain.
describe("TopicView — what it opens keeps its origin's root", () => {
  it.each([
    ["search", "tag%3Arust%2Fsearch"],
    ["u:ada/saved", "tag%3Arust%2Fu%3Aada%2Fsaved"],
  ])("the_doors_out_of_a_tag_page_opened_from_%s_carry_it", async (from, token) => {
    serve("rust", [row(postNode("p1", "About Rust")), row(taggedComment("c1"))]);
    renderWithProviders(<TopicView name="rust" from={from} />, { writeSigner: fakeWriteSigner() });
    await screen.findByTestId(byNode("tagPage.card", "p1"));
    expect(screen.getByTestId("topic-post-p1-link")).toHaveAttribute("href", `/posts/p1?from=${token}`);
    expect(screen.getByTestId(byNode("tagPage.card.authorChip", "p1"))).toHaveAttribute("href", `/u/alice?from=${token}`);
    expect(screen.getByTestId(byNode("tagPage.card.actionRow.score", "p1"))).toHaveAttribute(
      "href",
      expect.stringContaining(`?from=${token}&`),
    );
    expect(screen.getByTestId(byNode("tagPage.commentCard.authorChip", "c1"))).toHaveAttribute(
      "href",
      `/u/bob?from=${token}`,
    );
    expect(screen.getByTestId(byNode("tagPage.commentCard.target", "c1"))).toHaveAttribute(
      "href",
      `/posts/p1?from=${token}`,
    );
  });
});

// THE TAG PAGE FOLLOWS THE FEED'S REMOVED SWITCH (design rounds 57 + 58;
// TagPage.md:23-25): a removed tagged post or comment is listed only while the
// feed's stored filter has `Also show → Removed` on — the post as the feed's
// removed card, the comment as its card with its mark in the words' place —
// and the page carries no switch of its own.
describe("TopicView — a removed tagged post or comment follows the feed's Removed switch (TagPage.md:23-25)", () => {
  const removedPost = () => ({
    ...postNode("p1", "Gone"),
    title: moderated(null, "REDACTED"),
    content: moderated(null, "REDACTED"),
    removal: REMOVED,
  });
  const removedComment = () => taggedComment("c1", { content: moderated(null, "REDACTED"), removal: REMOVED });
  const serveTag = () => serve("rust", [row(removedPost()), row(postNode("p2", "More Rust")), row(removedComment())]);

  beforeEach(() => window.localStorage.clear());

  it("with_removed_off_a_removed_tagged_post_or_comment_is_not_listed_and_the_page_carries_no_switch", async () => {
    // TagPage.md:25 — the feed's filter keeps Removed off (its default).
    serveTag();
    renderWithProviders(<TopicView name="rust" />, { store: signedInStore(), writeSigner: fakeWriteSigner() });
    await screen.findByTestId(byNode("tagPage.card", "p2"));
    expect(postCards()).toEqual(["p2"]);
    expect(screen.queryByTestId("tagPage.commentCard")).toBeNull();
    // NEVER a switch of its own: no Removed control stands on the page.
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByText(/removed/i)).toBeNull();
  });

  it("with_removed_on_a_removed_tagged_post_stands_as_the_feeds_removed_card_and_a_comment_with_its_mark", async () => {
    // TagPage.md:23 — the feed's filter, committed on this device, has Removed on.
    writeCommittedFeedFilter("u1", { ...FEED_FILTER_DEFAULT, also: ["settling", "removed"] });
    serveTag();
    renderWithProviders(<TopicView name="rust" />, { store: signedInStore(), writeSigner: fakeWriteSigner() });
    await screen.findByTestId(byNode("tagPage.card", "p2"));
    expect(postCards()).toEqual(["p1", "p2"]);
    expect(screen.getByTestId(byNode("tagPage.card.removalMark", "p1"))).toHaveTextContent("Removed by its author");
    expect(screen.getByTestId(byNode("tagPage.card", "p1"))).not.toHaveTextContent("Gone");
    // The comment under its claim, the mark in the words' place, its author,
    // its age and its pointer kept.
    const comment = screen.getByTestId(byNode("tagPage.commentCard", "c1"));
    expect(within(comment).getByTestId(byNode("tagPage.commentCard.removalMark", "c1"))).toHaveTextContent(
      "Removed by its author",
    );
    expect(comment).not.toHaveTextContent("nice crate");
    expect(within(comment).getByTestId(byNode("tagPage.commentCard.authorChip", "c1"))).toHaveTextContent("@bob");
    expect(within(comment).getByTestId(byNode("tagPage.commentCard.target", "c1"))).toBeInTheDocument();
    expect(screen.getByTestId(byNode("tagPage.claim", "c1"))).toBeInTheDocument();
  });

  it("the_readers_saved_default_with_removed_on_admits_it_where_no_filter_is_committed", async () => {
    // The feed opens with the saved default where none is committed
    // (SettingsReading.md:33), so the tag page reads the same.
    writeReaderDefault("u1", { ...FEED_FILTER_DEFAULT, also: ["settling", "removed"] });
    serveTag();
    renderWithProviders(<TopicView name="rust" />, { store: signedInStore(), writeSigner: fakeWriteSigner() });
    await screen.findByTestId(byNode("tagPage.card", "p2"));
    expect(postCards()).toEqual(["p1", "p2"]);
    expect(screen.getByTestId(byNode("tagPage.commentCard", "c1"))).toBeInTheDocument();
  });
});

// THE REGISTERED NODES (round 60, seam 380 / 381; nodes.json `TagPage`,
// `TagPageHeldPad`): a census, not a hand-picked few — every path the
// registry gives the two boards stands on the rendered page in the state the
// board draws it, the share staying round 48's `tagPage.actionRow.share`.
describe("TopicView — the tag page's registered nodes (TagPage, TagPageHeldPad)", () => {
  const CANONICAL = join(process.cwd(), "..", "design", "designs", "canonical");
  const REGISTRY = JSON.parse(readFileSync(join(CANONICAL, "nodes.json"), "utf8")) as {
    screens: Record<string, { nodes: Record<string, string[]> }>;
  };
  const registered = (board: string) => Object.keys(REGISTRY.screens[board]!.nodes).filter((path) => path !== "tagPage");

  let layout: ReturnType<typeof fakeClampLayout>;
  beforeEach(() => {
    window.localStorage.clear();
    // The share renders where this browser can share (`useShareCapable`).
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } });
    // A caption past its two lines folds under `More` (`clamp-fold.ts`).
    layout = fakeClampLayout(40);
  });
  afterEach(() => layout.restore());

  const picture = (n: number) => ({
    __typename: "MediaAttachment",
    id: `m${n}`,
    url: `https://media.test/${n}.jpg`,
    altText: null,
    status: "NORMAL",
    mimeType: "image/jpeg",
    options: { __typename: "MediaOptions", aspectRatio: "1:1", durationMs: null },
    coverMedia: null,
    coverTaken: false,
  });
  // The board's three rows: @tobias's text post under a settling claim, @sol's
  // two-picture post with its caption and tags, @ada's tagged comment.
  // The board's posts carry one and two comments, so each count is drawn.
  const textPost = () => ({
    ...postNode("p-text", "unused"),
    title: moderated(null),
    content: moderated("Low tide at six"),
    comments: { __typename: "CommentConnection", totalCount: 1 },
  });
  const galleryPost = () => ({
    ...postNode("p-gallery", "Salt maps of the coast road"),
    comments: { __typename: "CommentConnection", totalCount: 2 },
    content: moderated(null),
    description: moderated("Rubbings from three weekends at low tide — paper against the salt crust, the side of a wax stick."),
    attachments: [picture(1), picture(2)],
    topics: [
      {
        __typename: "TopicClaim",
        hashtag: { __typename: "Hashtag", id: "h1", name: moderated("fieldnotes") },
        relevance: 0.4,
        confidence: 0.9,
        pending: false,
      },
      {
        __typename: "TopicClaim",
        hashtag: { __typename: "Hashtag", id: "h2", name: moderated("rust") },
        relevance: 0.4,
        confidence: 0.9,
        pending: false,
      },
    ],
  });
  // @ada's comment carries #saltmaps and one reference, as the board's does
  // (round 63 `TAGGED_COMMENT_LINE`), so its tags line is drawn.
  const adaLine = () => ({
    topics: [
      {
        __typename: "TopicClaim",
        hashtag: { __typename: "Hashtag", id: "h3", name: moderated("saltmaps") },
        relevance: 0.4,
        confidence: 0.9,
        pending: false,
      },
    ],
    references: [
      {
        __typename: "ReferenceClaim",
        targetId: "r1",
        relevance: 0.5,
        support: 0.5,
        withdrawalCost: 1,
        rawRelevance: 0.5,
        rawSupport: 0.5,
        pending: false,
        target: null,
      },
    ],
  });
  const liveRows = () => [
    row(textPost(), 0.1, 1, true),
    row(galleryPost(), 0.55, 1),
    row(taggedComment("c1", adaLine()), 0.4, 0.9),
  ];
  const removedRows = () => [
    row({ ...textPost(), content: moderated(null, "REDACTED"), removal: REMOVED }, 0.1, 1, true),
    row(taggedComment("c1", { content: moderated(null, "REDACTED"), removal: REMOVED }), 0.4, 0.9),
  ];
  // The `comment` chip's `pictures` and `clip` (round 62, seam 403.1): @ada's
  // tagged comment carrying the thread's two pictures, and its clip.
  const clip = () => ({
    ...picture(9),
    url: "https://media.test/9.mp4",
    mimeType: "video/mp4",
    options: { __typename: "MediaOptions", aspectRatio: "9:16", durationMs: 12_000 },
  });
  const mediaRows = () => [
    row(taggedComment("c-pictures", { attachments: [picture(1), picture(2)] }), 0.4, 0.9),
    row(taggedComment("c-clip", { attachments: [clip()] }), 0.4, 0.9),
  ];
  const rendered = () =>
    new Set([...document.querySelectorAll("[data-testid^='tagPage.']")].map((element) => element.getAttribute("data-testid")));

  // The board's cards wear an opinion (`mkBundle(0.1, 0.1)`), so each anchor
  // draws its exact pair beside the face.
  const NICE = { pDirected: 0.1, pInterest: 0.1 };
  const cardStances = { "p-text": NICE, "p-gallery": NICE, c1: NICE, "c-pictures": NICE, "c-clip": NICE };

  async function census(rows: unknown[], removedOn = false, name = "rust"): Promise<Set<string | null>> {
    if (removedOn) writeCommittedFeedFilter("u1", { ...FEED_FILTER_DEFAULT, also: ["settling", "removed"] });
    server.use(...stanceHandlers(cardStances));
    serve(name, rows);
    const view = renderWithProviders(<TopicView name={name} />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    await screen.findByTestId("tagPage.header");
    await screen.findAllByTestId("tagPage.claim");
    // Each card's anchor draws its exact pair once its own stance read answers,
    // which races the page's reads: count the page only once every card's has.
    const cardAnchors = "[data-testid='tagPage.card.actionRow.stance.anchor'],[data-testid='tagPage.commentCard.actionRow.stance.anchor']";
    const cardExacts =
      "[data-testid='tagPage.card.actionRow.stance.anchor.exact'],[data-testid='tagPage.commentCard.actionRow.stance.anchor.exact']";
    await waitFor(() =>
      expect(document.querySelectorAll(cardExacts).length).toBe(document.querySelectorAll(cardAnchors).length),
    );
    const seen = rendered();
    view.unmount();
    return seen;
  }

  it("every_path_the_registry_gives_TagPage_stands_on_the_page", async () => {
    const live = await census(liveRows());
    const media = await census(mediaRows());
    const removed = await census(removedRows(), true);
    // The `name` chip's `long` (round 63): a name the header's line cuts, so
    // the full-name heading stands — measured against stand-in widths.
    const lines = fakeLineLayout(332);
    const longName = await census(liveRows(), false, "salt_maps_of_the_coast_road_and_the_third_headland_light").finally(() =>
      lines.restore(),
    );
    expect(longName.has("tagPage.name")).toBe(true);
    const missing = registered("TagPage").filter(
      (path) => !live.has(path) && !media.has(path) && !removed.has(path) && !longName.has(path),
    );
    expect(missing).toEqual([]);
  });

  // TagPage.jsx round 62: a tagged comment's media registers by the thread's
  // names — the card's `media`, each picture its `frame` keyed
  // `<comment id>/<position>`, a clip's sound its frame's `soundDisc`, a
  // gallery's `dots` — each inside its own card.
  it("a_tagged_comments_media_wears_the_threads_registered_names", async () => {
    serve("rust", mediaRows());
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    const pictures = await screen.findByTestId(byNode("tagPage.commentCard", "c-pictures"));
    const keys = (path: string) => screen.queryAllByTestId(path).map((element) => element.getAttribute("data-testid-key"));
    expect(keys("tagPage.commentCard.media")).toEqual(["c-pictures", "c-clip"]);
    expect(keys("tagPage.commentCard.media.frame")).toEqual(["c-pictures/1", "c-pictures/2", "c-clip/1"]);
    expect(keys("tagPage.commentCard.media.frame.soundDisc")).toEqual(["c-clip/1"]);
    expect(keys("tagPage.commentCard.media.dots")).toEqual(["c-pictures"]);
    expect(within(pictures).getByTestId(byNode("tagPage.commentCard.media.dots", "c-pictures"))).toBeInTheDocument();
  });

  it("every_path_the_registry_gives_TagPageHeldPad_stands_with_the_held_topics_pad_open", async () => {
    server.use(...stanceHandlers({ ...cardStances, rust: { pDirected: 0.6, pInterest: 0.35, recordCount: 2 } }));
    serve("rust", liveRows());
    renderWithProviders(<TopicView name="rust" />, { store: signedInStore(), writeSigner: fakeWriteSigner() });
    await screen.findAllByTestId("tagPage.claim");
    await waitFor(() => expect(screen.getByTestId("tagPage.actionRow.stance.anchor.exact")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("tagPage.actionRow.stance.anchor"));
    const pad = await screen.findByTestId("tagPage.actionRow.stance.pad");
    // A pick on the field, so the landing line reads what it would come to.
    const square = within(pad).getByTestId("tagPage.actionRow.stance.pad.field.square");
    fireEvent.pointerDown(square, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(square, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(square, { clientX: 20, clientY: 20, pointerId: 1 });
    const seen = rendered();
    const missing = registered("TagPageHeldPad").filter((path) => !seen.has(path));
    expect(missing).toEqual([]);
  });

  it("the_share_stays_tagPage_actionRow_share_and_the_header_stays_tagPage_header", async () => {
    serve("rust", liveRows());
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    const header = await screen.findByTestId("tagPage.header");
    expect(within(header).getByTestId("tagPage.header.back")).toBeInTheDocument();
    expect(within(header).getByTestId("tagPage.header.title")).toBeInTheDocument();
    const actionRow = screen.getByTestId("tagPage.actionRow");
    expect(within(actionRow).getByTestId("tagPage.actionRow.share")).toBeInTheDocument();
    expect(within(actionRow).getByTestId("tagPage.actionRow.stance")).toBeInTheDocument();
    expect(screen.queryByTestId("tagPage.share")).toBeNull();
    // The registry still holds both (append-only).
    expect(registered("TagPage")).toEqual(expect.arrayContaining(["tagPage.actionRow.share", "tagPage.header"]));
  });

  it("a_claim_is_keyed_by_the_tagged_things_id_and_every_card_by_its_own", async () => {
    serve("rust", liveRows());
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    await screen.findAllByTestId("tagPage.claim");
    const keys = (path: string) => screen.queryAllByTestId(path).map((element) => element.getAttribute("data-testid-key"));
    expect(keys("tagPage.claim")).toEqual(["p-text", "p-gallery", "c1"]);
    expect(keys("tagPage.card")).toEqual(["p-text", "p-gallery"]);
    expect(keys("tagPage.commentCard")).toEqual(["c1"]);
    expect(keys("tagPage.card.media.frame")).toEqual(["p-gallery/1", "p-gallery/2"]);
    expect(keys("tagPage.card.tagsLine.tag")).toEqual(["p-gallery/fieldnotes", "p-gallery/rust"]);
  });
});
