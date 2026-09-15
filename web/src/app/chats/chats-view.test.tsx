import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatsView } from "./chats-view";

describe("ChatsView", () => {
  // The blessed line (design/guidelines/copy-voice.md "The coming-soon
  // surfaces"; the board's own
  // `EmptyState title="Chats — coming soon. Your conversations will be
  // here."`) — verbatim, never retyped.
  it("carries the blessed coming-soon line", () => {
    render(<ChatsView />);
    expect(screen.getByTestId("chats-empty")).toHaveTextContent(
      "Chats — coming soon. Your conversations will be here.",
    );
  });

  it("names itself Chats and its back arrow returns to the feed", () => {
    render(<ChatsView />);
    expect(screen.getByRole("heading", { name: "Chats" })).toBeInTheDocument();
    const back = screen.getByTestId("chats-back");
    expect(back).toHaveAttribute("href", "/feed");
    expect(back).toHaveAttribute("aria-label", "Back to feed");
  });

  it("offers no action — nothing fills this one yet", () => {
    render(<ChatsView />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
