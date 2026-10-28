import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { stanceHandlers } from "@/test/stance";
import { TagFeedCard, reachesThrough, type TagCardTopic } from "./tag-feed-card";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

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
