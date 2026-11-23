import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeClampLayout } from "@/test/fake-clamp-layout";
import { expectLineYieldsHandle, LONG_HANDLE } from "@/test/names";
import { answersComment, answersPost, profileComment } from "@/test/profile-comment";
import { renderWithProviders } from "@/test/providers";
import { expectWrapsLongWords } from "@/test/written";
import { CommentFeedCard, type CommentFeedView } from "./comment-feed-card";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: router.push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const moderated = (value: string) => ({ __typename: "ModeratedText", value, status: "NORMAL" });

function mount(words: string, shape: "thread" | "line" = "thread") {
  const comment = profileComment("c1", { content: moderated(words) }) as unknown as CommentFeedView;
  return renderWithProviders(
    <CommentFeedCard comment={comment} shape={shape} from="feed" testId="card" onNotify={() => {}} onLinkCopied={() => {}} />,
  );
}

// FeedCommentShapes.md:29 — "a long comment folds at two lines under More";
// :31 — tapping More unfolds it in place. The fold is read off the clamped
// words' own heights (`clamp-fold.ts`); jsdom lays nothing out, so the heights
// are the stand-in layout's: 40 characters to a 20px line.
describe("CommentFeedCard's fold", () => {
  let layout: ReturnType<typeof fakeClampLayout>;
  beforeEach(() => {
    layout = fakeClampLayout(40);
  });
  afterEach(() => layout.restore());

  it("offers no More under a comment that fits its two lines", () => {
    mount("A short answer");
    expect(screen.queryByTestId("card-opener")).not.toBeInTheDocument();
  });

  it("folds a long comment at two lines under More, and unfolds it in place", () => {
    mount("x".repeat(81));
    const opener = screen.getByTestId("card-opener");
    expect(opener).toHaveTextContent("More");
    fireEvent.click(opener);
    expect(opener).toHaveTextContent("Less");
    expect(opener).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(opener);
    expect(opener).toHaveTextContent("More");
  });

  it("drops More when a wider line lets the comment fit", () => {
    mount("x".repeat(81));
    layout.resize(60);
    expect(screen.queryByTestId("card-opener")).not.toBeInTheDocument();
  });

  it("draws a profile's line shape whole, with no More", () => {
    mount("x".repeat(400), "line");
    expect(screen.queryByTestId("card-opener")).not.toBeInTheDocument();
  });

  // jakob's hand test 2026-11-19: a word longer than the line continues on the
  // next instead of running off the card — clamped (the feed's thread shape)
  // and whole (the profile's line shape) alike.
  it("breaks an over-long word onto the next line in both shapes", () => {
    for (const shape of ["thread", "line"] as const) {
      const { unmount } = mount("x".repeat(120), shape);
      expectWrapsLongWords(screen.getByText("x".repeat(120)));
      unmount();
    }
  });
});

// NamesLong.md:5-7 — the target line is one line; a long handle is the part
// cut, `'s comment` keeps its room.
describe("CommentFeedCard's target line, at the longest handle", () => {
  it("cuts the handle and keeps the words after it", () => {
    const comment = profileComment("c1", {
      target: answersComment("c0", LONG_HANDLE),
    }) as unknown as CommentFeedView;
    renderWithProviders(
      <CommentFeedCard comment={comment} shape="line" from="feed" testId="card" onNotify={() => {}} onLinkCopied={() => {}} />,
    );
    const target = screen.getByTestId("card-target");
    expect(target).toHaveTextContent(`On @${LONG_HANDLE}'s comment`);
    expectLineYieldsHandle(target, `@${LONG_HANDLE}`, "'s comment");
  });
});

// FeedCommentShapes: the card's own pictures are the registered
// `feed.commentCard.media` and each picture its `frame` (nodes.json), and the
// frame is a square at the column's width with no height cap (jakob
// 2026-11-18, W48).
describe("CommentFeedCard's media", () => {
  it("wears the registered media node, its frame a square at the column's width with no height cap", () => {
    const comment = profileComment("c1", {
      attachments: [
        { id: "m1", url: "/media/m1", altText: null, status: "NORMAL", mimeType: "image/webp", options: { aspectRatio: "1:1" } },
      ],
    }) as unknown as CommentFeedView;
    renderWithProviders(
      <CommentFeedCard
        comment={comment}
        shape="thread"
        from="feed"
        testId="card"
        node={{ path: "feed.commentCard", key: "c1" }}
        onNotify={() => {}}
        onLinkCopied={() => {}}
      />,
    );
    const media = screen.getByTestId("feed.commentCard.media");
    const frame = media.querySelector('[data-testid="feed.commentCard.media.frame"]') as HTMLElement;
    expect(frame).not.toBeNull();
    expect(frame.style.aspectRatio).toBe("1 / 1");
    expect(frame.style.maxHeight).toBe("");
    expect(frame.style.maxWidth).toBe("");
  });
});

// THE POINTER DOOR (jakob 2026-11-23, seams 405 and 417: "the one line "On
// <post name>..:" should just open the corresponding post not the comment
// section of it"; "a reply's pointer opens the thread at the comment it
// names"). FeedKinds.md:27, History.md:51, Saved.md:29, ProfileComments.md:45,
// ProfileCommentsOwn.md:15, TagPage.md:23 — in both shapes, under the host's
// registered `target` name, as a link of its own a keyboard and a screen
// reader meet by its `On …` name.
describe("CommentFeedCard's pointer door", () => {
  beforeEach(() => router.push.mockClear());

  function pointer(shape: "thread" | "line", over: Record<string, unknown> = {}) {
    const comment = profileComment("c1", over) as unknown as CommentFeedView;
    renderWithProviders(
      <CommentFeedCard
        comment={comment}
        shape={shape}
        from="u:sol"
        testId="card"
        node={{ path: "profile.comments.commentCard", key: "c1" }}
        onNotify={() => {}}
        onLinkCopied={() => {}}
      />,
    );
    return screen.getByTestId("profile.comments.commentCard.target");
  }

  for (const shape of ["line", "thread"] as const) {
    it(`opens the post itself, its comment section closed, from a pointer naming a post (${shape} shape)`, () => {
      const door = pointer(shape);
      expect(door.tagName).toBe("A");
      expect(door).toHaveAttribute("href", "/posts/p1?from=u%3Asol");
      expect(door.parentElement?.closest("a")).toBeNull();
      expect(screen.getByRole("link", { name: "On “The long way home” — @ada" })).toBe(door);
    });

    it(`opens the thread at the named comment from a reply's pointer (${shape} shape)`, () => {
      const door = pointer(shape, { target: answersComment("c0", "sol") });
      expect(door).toHaveAttribute("href", "/posts/p1?comment=c0&from=u%3Asol");
      expect(screen.getByRole("link", { name: "On @sol's comment" })).toBe(door);
    });

    it(`keeps a removed post's pointer a door to the post, its detail showing the mark (${shape} shape)`, () => {
      const door = pointer(shape, {
        target: { ...answersPost("p1", "The long way home"), removal: { __typename: "Removal", at: "2026-11-01T00:00:00Z", by: "AUTHOR" } },
      });
      expect(door).toHaveAttribute("href", "/posts/p1?from=u%3Asol");
      expect(door).toHaveAccessibleName("On @ada's removed post");
    });

    it(`never opens the card's own door from the pointer (${shape} shape)`, () => {
      fireEvent.click(pointer(shape));
      expect(router.push).not.toHaveBeenCalled();
    });
  }

  it("gives the line shape's pointer its grown hit target (CommentCard.jsx: cg-hit)", () => {
    expect(pointer("line")).toHaveClass("cg-hit");
  });
});

// THE CARD IS THE DOOR TO THE COMMENT'S PLACE (jakob, 2026-11-19: "the whole
// comment card (besides the other elements (actions and user)) should open").
// FeedKinds.md:27, History.md:53, Saved.md:31, ProfileComments.md:49,
// ProfileCommentsOwn.md:17 — "WHEN …commentCard is tapped outside
// …commentCard.target and its own controls -> the post's comment section
// opens scrolled to that comment"; ProfileComments.md:41 — the inert author
// chip on the person's own page changes nothing.
describe("CommentFeedCard's body door", () => {
  const PLACE = "/posts/p1?comment=c1&from=u%3Asol";
  beforeEach(() => router.push.mockClear());

  function card(shape: "thread" | "line", over: Record<string, unknown> = {}, authorHere = false) {
    const comment = profileComment("c1", over) as unknown as CommentFeedView;
    renderWithProviders(
      <CommentFeedCard
        comment={comment}
        shape={shape}
        from="u:sol"
        authorHere={authorHere}
        testId="card"
        node={{ path: "profile.comments.commentCard", key: "c1" }}
        onNotify={() => {}}
        onLinkCopied={() => {}}
      />,
    );
    return screen.getByTestId("profile.comments.commentCard");
  }

  for (const shape of ["line", "thread"] as const) {
    it(`opens the thread at the comment from its words (${shape} shape)`, () => {
      card(shape, { content: moderated("A plain answer") });
      expect(screen.getByTestId("card-link")).toHaveAttribute("href", PLACE);
    });

    it(`opens the thread at the comment from the card's bare ground (${shape} shape)`, () => {
      const section = card(shape, { content: moderated("A plain answer") });
      fireEvent.click(section);
      expect(router.push).toHaveBeenCalledWith(PLACE);
    });
  }

  it("opens a removed comment's thread from its mark", () => {
    card("line", {
      content: { __typename: "ModeratedText", value: null, status: "REDACTED" },
      removal: { __typename: "Removal", at: new Date(Date.now() - 3_600_000).toISOString(), by: "AUTHOR" },
    });
    fireEvent.click(screen.getByTestId("profile.comments.commentCard.removalMark"));
    expect(router.push).toHaveBeenCalledWith(PLACE);
  });

  it("keeps every control's own press: the ⋮, the opinion, Reply and the pointer never open the card", () => {
    card("line", { content: moderated("A plain answer") });
    fireEvent.click(screen.getByTestId("profile.comments.commentCard.menu"));
    fireEvent.click(screen.getByTestId("profile.comments.commentCard.target"));
    fireEvent.click(screen.getByTestId("profile.comments.commentCard.actionRow.reply"));
    expect(router.push).not.toHaveBeenCalled();
  });

  it("leaves the inert author chip inert on the person's own page (ProfileComments.md:41)", () => {
    card("line", { content: moderated("A plain answer") }, true);
    fireEvent.click(screen.getByTestId("profile.comments.commentCard.authorChip"));
    expect(router.push).not.toHaveBeenCalled();
  });

  it("opens nothing when the click ends a text selection", () => {
    const section = card("line", { content: moderated("A plain answer") });
    const words = screen.getByText("A plain answer");
    const range = document.createRange();
    range.selectNodeContents(words);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    fireEvent.click(section);
    window.getSelection()?.removeAllRanges();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("wears the door's pressed layer across the card (CommentCard.jsx: Card door)", () => {
    const section = card("line", { content: moderated("A plain answer") });
    expect(section).toHaveClass("cg-door-card");
    expect(screen.getByTestId("card-link")).toHaveClass("cg-door");
  });
});
