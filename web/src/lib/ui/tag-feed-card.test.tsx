import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { stanceHandlers } from "@/test/stance";
import { CarriedSnackbar } from "./carried-snackbar";
import { TagFeedCard, reachesThrough, type TagCardTopic } from "./tag-feed-card";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

beforeEach(() => push.mockClear());

startMswServer(...stanceHandlers());

const TOPIC: TagCardTopic = {
  id: "t1",
  name: { value: "saltmaps", status: "NORMAL" },
  taggedContent: [
    {
      node: {
        __typename: "Post",
        id: "p1",
        title: { value: null, status: "NORMAL" },
        content: { value: "Low tide at six\nand more", status: "NORMAL" },
        attachments: [],
        author: { id: "u1", handle: "ada" },
        createdAt: new Date().toISOString(),
      },
    },
  ],
};

// `_shared.jsx` `TagFeedCard`, `reachesThrough`; History.md:59.
describe("TagFeedCard", () => {
  it("names one or two people, past two the first and a count, and compresses a long line", () => {
    expect(reachesThrough(["ada"])).toBe("Reaches you through @ada");
    expect(reachesThrough(["ada", "tobias"])).toBe("Reaches you through @ada and @tobias");
    expect(reachesThrough(["ada", "tobias", "mira", "sol"])).toBe("Reaches you through @ada and 3 others");
    expect(reachesThrough(["a-very-long-handle-indeed", "another-long-one"])).toBe(
      "Through @a-very-long-handle-indeed",
    );
  });

  it("stands the why-line only when the tag reaches the reader through someone", () => {
    const { unmount } = renderWithProviders(
      <TagFeedCard topic={TOPIC} from="history" testId="tag" node={{ path: "history.tagCard", key: "t1" }} onLinkCopied={() => {}} />,
    );
    expect(screen.queryByTestId("history.tagCard.through")).toBeNull();
    unmount();
    renderWithProviders(
      <TagFeedCard topic={TOPIC} from="history" through={["ada"]} testId="tag" node={{ path: "history.tagCard", key: "t1" }} onLinkCopied={() => {}} />,
    );
    expect(screen.getByTestId("history.tagCard.through")).toHaveTextContent("Reaches you through @ada");
  });

  it("names an untitled post in the glimpse by its first line, and carries no ⋮", () => {
    renderWithProviders(
      <TagFeedCard topic={TOPIC} from="history" testId="tag" node={{ path: "history.tagCard", key: "t1" }} onLinkCopied={() => {}} />,
    );
    expect(screen.getByTestId("history.tagCard.glimpse.newest")).toHaveTextContent("Low tide at six");
    expect(screen.getByTestId("history.tagCard.glimpse.by")).toHaveTextContent("@ada");
    expect(screen.getByTestId("history.tagCard.mark")).toHaveTextContent("#");
    expect(screen.queryByRole("button", { name: /^More/ })).toBeNull();
  });
});

// THE KIND'S OWN ACT IS A DOOR INTO THE COMPOSER (FeedKinds.md:27), and an
// applicant's every such door answers as the bar's New post does
// (ApplicantFeed.md:49: the snackbar reads You can post once you're in. AND
// NEVER the wizard opens).
describe("TagFeedCard's Tag a new post with it", () => {
  function mount(reader: "APPLICANT" | "MEMBER" | null) {
    const store = createTokenStore();
    if (reader !== null) store.save({ accessToken: "a", refreshToken: "r", accountId: "acct-1" });
    renderWithProviders(
      <>
        <TagFeedCard topic={TOPIC} from="feed" testId="tag" node={{ path: "feed.tagCard", key: "t1" }} onLinkCopied={() => {}} />
        <CarriedSnackbar />
      </>,
      { store, reader },
    );
    fireEvent.click(screen.getByTestId("feed.tagCard.actionRow.compose"));
  }

  it("an_applicants_tag_act_says_post_once_in_and_opens_no_wizard", () => {
    mount("APPLICANT");
    expect(screen.getByTestId("carried-snackbar")).toHaveTextContent("You can post once you're in.");
    expect(push).not.toHaveBeenCalled();
  });

  // FeedKinds.md:27 — a member's opens the composer with the tag staged.
  it("a_members_tag_act_opens_the_composer_with_the_tag_staged", () => {
    mount("MEMBER");
    expect(push).toHaveBeenCalledWith("/compose?tag=saltmaps");
    expect(screen.queryByTestId("carried-snackbar")).toBeNull();
  });

  // The lock is the applicant's, never the guest's.
  it("a_guests_tag_act_is_never_told_post_once_in", () => {
    mount(null);
    expect(screen.queryByTestId("carried-snackbar")).toBeNull();
  });
});
