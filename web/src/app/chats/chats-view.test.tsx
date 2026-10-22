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

  // ChatsComingSoon.md:15-17: your own profile's band, or a profile's Message.
  it.each([
    ["profile", "/profile", "Back to your profile"],
    ["u:ada", "/u/ada", "Back to the profile"],
  ])("names the origin it was opened from (%s)", (from, href, label) => {
    render(<ChatsView from={from} />);
    const back = screen.getByTestId("chats-back");
    expect(back).toHaveAttribute("href", href);
    expect(back).toHaveAttribute("aria-label", label);
  });

  it("offers no action — nothing fills this one yet", () => {
    render(<ChatsView />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
