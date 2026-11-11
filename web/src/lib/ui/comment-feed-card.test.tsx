import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeClampLayout } from "@/test/fake-clamp-layout";
import { profileComment } from "@/test/profile-comment";
import { renderWithProviders } from "@/test/providers";
import { CommentFeedCard, type CommentFeedView } from "./comment-feed-card";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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
});
