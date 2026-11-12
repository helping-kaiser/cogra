import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { hiddenHandlers, hiddenLog } from "@/test/hidden";
import { intersectEach, whenObserved } from "@/test/media-env";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { stanceHandlers } from "@/test/stance";
import { TopicView } from "./topic-view";

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

function moderated(value: string | null) {
  return { __typename: "ModeratedText", value, status: "NORMAL" };
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

describe("TopicView", () => {
  // "ALWAYS at most one clip plays on the tag page, by the feed's stage law"
  // (T01 TagPage.md:23): the tagged list stands on one stage, so the topmost
  // qualifying clip plays (Feed.md:17) and a second one waits.
  it("plays one clip on the tag page, the topmost that qualifies (T01 TagPage.md:23)", async () => {
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
    server.use(
      gqlLink.query("HashtagDetail", () =>
        HttpResponse.json({
          data: hashtagDetail("rust", [
            { relevance: 0.1, confidence: 1, pending: false, node: clipNode("p1") },
            { relevance: 0.1, confidence: 1, pending: false, node: clipNode("p2") },
          ]),
        }),
      ),
    );
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    await screen.findByTestId("topic-post-p2");
    const clipOf = (id: string) =>
      screen.getByTestId(`topic-post-${id}-media`).querySelector("video") as HTMLVideoElement;
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

  it("renders the canonical name and the tagged posts, reusing PostCard", async () => {
    server.use(
      gqlLink.query("HashtagDetail", () =>
        HttpResponse.json({
          data: hashtagDetail("rust", [
            { relevance: 0.1, confidence: 1, pending: false, node: postNode("p1", "About Rust") },
          ]),
        }),
      ),
    );
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("topic-name")).toHaveTextContent("#rust");
    expect(screen.getByTestId("topic-post-p1")).toHaveTextContent("About Rust");
    expect(screen.getByTestId("topic-post-p1-link")).toHaveAttribute("href", "/posts/p1?from=tag%3Arust");
    // PostCard's own inventory rides along — the stance control included.
    expect(screen.getByTestId("topic-stance-p1")).toBeInTheDocument();
  });

  // THE WORD "FOLLOW" IS NOT ON THE SCREEN, and will not be
  // (copy-voice's ban, extended to topics 2026-09-14). Taking a position
  // on a topic is the stance gesture at the stance's own price, so there
  // is no toggle and no one-tap follow to find.
  it("offers no follow gesture", async () => {
    server.use(
      gqlLink.query("HashtagDetail", () =>
        HttpResponse.json({
          data: hashtagDetail("rust", [
            { relevance: 0.1, confidence: 1, pending: false, node: postNode("p1", "About Rust") },
          ]),
        }),
      ),
    );
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    await screen.findByTestId("topic-name");
    expect(screen.queryByTestId("topic-follow")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /follow/i })).not.toBeInTheDocument();
  });

  // The row is the page's own gesture, and it names what it stances —
  // the tag itself, hash and all — because three stance controls stand
  // on this page and the accessible name is what says which is which.
  it("carries an Affinity row toward the topic, named by the tag", async () => {
    server.use(
      gqlLink.query("HashtagDetail", () =>
        HttpResponse.json({
          data: hashtagDetail("rust", [
            { relevance: 0.1, confidence: 1, pending: false, node: postNode("p1", "About Rust") },
          ]),
        }),
      ),
    );
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    await screen.findByTestId("topic-name");
    expect(await screen.findByTestId("topic-affinity")).toHaveAccessibleName(
      "Give your opinion on #rust",
    );
  });

  // THE SIX WORDS ARE THE FAMILY'S (jakob 2026-09-15). The control owns
  // the geometry; association asks how much you like it and attraction
  // how close you want to be — never the opinion's own question.
  it("asks the Affinity's own questions on the accessible route", async () => {
    server.use(
      gqlLink.query("HashtagDetail", () =>
        HttpResponse.json({
          data: hashtagDetail("rust", [
            { relevance: 0.1, confidence: 1, pending: false, node: postNode("p1", "About Rust") },
          ]),
        }),
      ),
    );
    renderWithProviders(<TopicView name="rust" />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    await screen.findByTestId("topic-affinity");
    fireEvent.click(screen.getByTestId("topic-affinity-choose"));
    expect(await screen.findByTestId("stance-alternates")).toBeInTheDocument();
    expect(screen.getByLabelText("How much you like it", { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText("How close you want to be", { exact: false })).toBeInTheDocument();
    expect(screen.queryByLabelText("For or against", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("How much reaches you", { exact: false })).not.toBeInTheDocument();
  });

  // A GUEST IS NOT SPECIAL HERE (backlog item 81, ruled 2026-09-15):
  // any reader who taps a tag reaches the page and sees what is tagged.
  // The only thing they lack is an opinion of the topic, so the face
  // wears the no-opinion 🫥 and the tap opens the join prompt — it never
  // bounces them, and the accessible route is not on the page at all.
  it("lets a guest read the page and gates the row at the join prompt", async () => {
    server.use(
      gqlLink.query("HashtagDetail", () =>
        HttpResponse.json({
          data: hashtagDetail("rust", [
            { relevance: 0.1, confidence: 1, pending: false, node: postNode("p1", "About Rust") },
          ]),
        }),
      ),
    );
    renderWithProviders(<TopicView name="rust" />, {
      store: guestStore(),
      writeSigner: fakeWriteSigner(),
    });
    expect(await screen.findByTestId("topic-post-p1")).toBeInTheDocument();
    const row = await screen.findByTestId("topic-affinity");
    expect(screen.getByTestId("topic-affinity-resting-face")).toHaveTextContent("🫥");
    expect(screen.queryByTestId("topic-affinity-choose")).not.toBeInTheDocument();
    fireEvent.click(row);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  // THE EMPTY PAGE WIRES NO FACE AT ALL (backlog item 81, ruled
  // 2026-09-15) — `TagPageEmpty` draws the header and the empty copy,
  // and nothing else.
  it("wires no stance row on the empty page", async () => {
    server.use(
      gqlLink.query("HashtagDetail", () =>
        HttpResponse.json({ data: hashtagDetail("nevertagged") }),
      ),
    );
    renderWithProviders(<TopicView name="nevertagged" />, { writeSigner: fakeWriteSigner() });
    await screen.findByTestId("topic-empty");
    expect(screen.queryByTestId("topic-affinity")).not.toBeInTheDocument();
  });

  it("shows the empty copy for a never-tagged but well-formed name (D4)", async () => {
    server.use(
      gqlLink.query("HashtagDetail", () => HttpResponse.json({ data: hashtagDetail("nevertagged") })),
    );
    renderWithProviders(<TopicView name="nevertagged" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("topic-empty")).toBeInTheDocument();
  });

  it("reports not-found for a substrate-illegal name", async () => {
    server.use(
      gqlLink.query("HashtagDetail", () => HttpResponse.json({ data: { hashtag: null } })),
    );
    renderWithProviders(<TopicView name="münchen" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("topic-not-found")).toBeInTheDocument();
  });

  it("offers a retry on the nothing-loaded transport error and heals from it", async () => {
    let calls = 0;
    server.use(
      gqlLink.query("HashtagDetail", () => {
        calls += 1;
        return calls === 1 ? HttpResponse.error() : HttpResponse.json({ data: hashtagDetail("rust") });
      }),
    );
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("topic-transport-error")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("topic-retry"));
    expect(await screen.findByTestId("topic-name")).toHaveTextContent("#rust");
    expect(screen.queryByTestId("topic-transport-error")).not.toBeInTheDocument();
  });

  // TagPage.md:37: "ALWAYS the back arrow reads Back to Explore and leads to
  // Explore GIVEN the page was entered with no history behind it".
  it("backs to Explore when entered with no origin behind it", async () => {
    server.use(
      gqlLink.query("HashtagDetail", () => HttpResponse.json({ data: hashtagDetail("rust") })),
    );
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    await screen.findByTestId("topic-name");
    const back = screen.getByTestId("topic-back");
    expect(back).toHaveAttribute("href", "/explore");
    expect(back).toHaveAttribute("aria-label", "Back to Explore");
  });

  // TagPage.md:35: "… Back to feed from the feed in any of its states".
  it("backs to the feed when opened from the feed", async () => {
    server.use(
      gqlLink.query("HashtagDetail", () => HttpResponse.json({ data: hashtagDetail("rust") })),
    );
    renderWithProviders(<TopicView name="rust" from="feed" />, { writeSigner: fakeWriteSigner() });
    await screen.findByTestId("topic-name");
    const back = screen.getByTestId("topic-back");
    expect(back).toHaveAttribute("href", "/feed");
    expect(back).toHaveAttribute("aria-label", "Back to feed");
  });

  // TagPage.md:35: "… Back to the post from a post's tags-and-references sheet".
  it("backs to the post, opened as it was, when opened from its sheet", async () => {
    server.use(
      gqlLink.query("HashtagDetail", () => HttpResponse.json({ data: hashtagDetail("rust") })),
    );
    renderWithProviders(<TopicView name="rust" from="post:p1:saved" />, { writeSigner: fakeWriteSigner() });
    await screen.findByTestId("topic-name");
    const back = screen.getByTestId("topic-back");
    expect(back).toHaveAttribute("href", "/posts/p1?from=saved");
    expect(back).toHaveAttribute("aria-label", "Back to the post");
  });

  // History.md:57: a History tag card's page reads Back to History.
  it("backs to History when opened from a History card", async () => {
    server.use(
      gqlLink.query("HashtagDetail", () => HttpResponse.json({ data: hashtagDetail("rust") })),
    );
    renderWithProviders(<TopicView name="rust" from="history" />, { writeSigner: fakeWriteSigner() });
    await screen.findByTestId("topic-name");
    const back = screen.getByTestId("topic-back");
    expect(back).toHaveAttribute("href", "/history");
    expect(back).toHaveAttribute("aria-label", "Back to History");
  });

  it("renders a tagged comment with a link to its parent post", async () => {
    server.use(
      gqlLink.query("HashtagDetail", () =>
        HttpResponse.json({
          data: hashtagDetail("rust", [
            {
              relevance: 0.1,
              confidence: 1,
              pending: false,
              node: {
                __typename: "Comment",
                id: "c1",
                content: moderated("nice crate"),
                author: {
                  __typename: "User",
                  id: "u2",
                  handle: "bob",
                  displayName: { __typename: "ModeratedText", value: "Bob" },
                  avatar: null,
                },
                createdAt: "2026-08-12T10:05:00Z",
                updatedAt: "2026-08-12T10:05:00Z",
                landing: { __typename: "Landing", state: "LANDED" },
                moderationStatus: "NORMAL",
                // No removal: the node stands (api-spec.md `Post.removal`).
                removal: null,
                genesisRecordId: "rec-genesis",
                target: { __typename: "Post", id: "p1" },
              },
            },
          ]),
        }),
      ),
    );
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("topic-comment-c1")).toHaveTextContent("nice crate");
    expect(screen.getByTestId("topic-comment-post-c1")).toHaveAttribute("href", "/posts/p1?from=tag%3Arust");
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
  const serveTag = () =>
    server.use(
      gqlLink.query("HashtagDetail", () =>
        HttpResponse.json({
          data: hashtagDetail("rust", [
            { relevance: 0.1, confidence: 1, pending: false, node: tobiasPost() },
            { relevance: 0.1, confidence: 1, pending: false, node: { ...postNode("p2", "More Rust"), id: "p2" } },
          ]),
        }),
      ),
    );
  const rows = () =>
    within(screen.getByTestId("tagPage.menuSheet"))
      .getAllByRole("button")
      .map((row) => [row.getAttribute("data-testid"), row.textContent]);
  const listed = () =>
    within(screen.getByTestId("topic-content-list"))
      .getAllByTestId(/^topic-post-p\d$/)
      .map((card) => card.getAttribute("data-testid"));

  it("the_menu_rises_over_the_tag_page_reading_save_cite_hide_license_report", async () => {
    // TagPageMenu.md:3, :5.
    serveTag();
    renderWithProviders(<TopicView name="rust" />, { store: signedInStore(), writeSigner: fakeWriteSigner() });
    fireEvent.click(await screen.findByTestId("topic-post-p1-menu"));
    expect((screen.getByTestId("tagPage.menuSheet") as HTMLDialogElement).open).toBe(true);
    expect(rows()).toEqual([
      ["tagPage.menuSheet.save", "Save"],
      ["tagPage.menuSheet.cite", "Cite in a new post"],
      ["tagPage.menuSheet.hide", "Hide @tobias"],
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
    fireEvent.click(await screen.findByTestId("topic-post-p1-menu"));
    fireEvent.click(screen.getByTestId("tagPage.menuSheet.hide"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByTestId("tagPage.snackbar.message")).toHaveTextContent(
      "@tobias is hidden — their posts stay out of your feed.",
    );
    expect(screen.getByTestId("tagPage.snackbar.action")).toHaveTextContent("Undo");
    expect(listed()).toEqual(["topic-post-p1", "topic-post-p2"]);
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
    fireEvent.click(await screen.findByTestId("topic-post-p1-menu"));
    await waitFor(() => expect(screen.getByTestId("tagPage.menuSheet.hide")).toHaveTextContent(/^Unhide @tobias$/));
    fireEvent.click(screen.getByTestId("tagPage.menuSheet.hide"));
    expect(screen.getByTestId("tagPage.snackbar.message")).toHaveTextContent(
      "@tobias is unhidden — their posts can reach your feed again.",
    );
    expect(listed()).toEqual(["topic-post-p1", "topic-post-p2"]);
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
    fireEvent.click(await screen.findByTestId("topic-post-p1-menu"));
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
    fireEvent.click(await screen.findByTestId("topic-post-p1-menu"));
    fireEvent.click(screen.getByTestId("tagPage.menuSheet.cite"));
    expect(await screen.findByTestId("join-prompt")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

// EVERY DOOR OUT OF THE TAG PAGE CARRIES IT AND THE ORIGIN IT WAS OPENED WITH
// (jakob 2026-11-10, "grandfathering style"; BottomNav.prompt.md: the
// originating root stays lit on a drill-in): the post, a comment's post, the
// author's profile and the score's trace read `Back to #rust` and keep lit the
// root the page was opened from — Explore's here, the profile's in the chain.
describe("TopicView — what it opens keeps its origin's root", () => {
  const comment = {
    relevance: 0.1,
    confidence: 1,
    pending: false,
    node: {
      __typename: "Comment",
      id: "c1",
      content: moderated("nice crate"),
      author: {
        __typename: "User",
        id: "u2",
        handle: "bob",
        displayName: { __typename: "ModeratedText", value: "Bob" },
        avatar: null,
      },
      createdAt: "2026-08-12T10:05:00Z",
      updatedAt: "2026-08-12T10:05:00Z",
      landing: { __typename: "Landing", state: "LANDED" },
      moderationStatus: "NORMAL",
      removal: null,
      genesisRecordId: "rec-genesis",
      target: { __typename: "Post", id: "p1" },
    },
  };

  it.each([
    ["search", "tag%3Arust%2Fsearch"],
    ["u:ada/saved", "tag%3Arust%2Fu%3Aada%2Fsaved"],
  ])("the_doors_out_of_a_tag_page_opened_from_%s_carry_it", async (from, token) => {
    server.use(
      gqlLink.query("HashtagDetail", () =>
        HttpResponse.json({
          data: hashtagDetail("rust", [
            { relevance: 0.1, confidence: 1, pending: false, node: postNode("p1", "About Rust") },
            comment,
          ]),
        }),
      ),
    );
    renderWithProviders(<TopicView name="rust" from={from} />, { writeSigner: fakeWriteSigner() });
    await screen.findByTestId("topic-post-p1");
    expect(screen.getByTestId("topic-post-p1-link")).toHaveAttribute("href", `/posts/p1?from=${token}`);
    expect(screen.getByTestId("topic-author-p1")).toHaveAttribute("href", `/u/alice?from=${token}`);
    expect(screen.getByTestId("topic-post-p1-score")).toHaveAttribute(
      "href",
      expect.stringContaining(`?from=${token}&`),
    );
    expect(screen.getByTestId("topic-comment-author-c1")).toHaveAttribute("href", `/u/bob?from=${token}`);
    expect(screen.getByTestId("topic-comment-post-c1")).toHaveAttribute("href", `/posts/p1?from=${token}`);
  });
});
