import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { byNode } from "@/test/data-node";
import { TabBar } from "./tab-bar";

const TABS = [
  { id: "posts", icon: "dynamic_feed", label: "Posts" },
  { id: "comments", icon: "chat_bubble", label: "Comments" },
  { id: "everything", icon: "history", label: "Everything" },
] as const;

describe("TabBar (TabBar.jsx)", () => {
  it("is a labelled group of pressed toggles, glyph cells named by their labels", () => {
    render(
      <TabBar
        tabs={TABS}
        value="everything"
        ariaLabel="What the chronicle shows"
        onSelect={() => {}}
        node={{ path: "profile.tabRow" }}
        testId="tabs"
      />,
    );
    const group = screen.getByRole("group", { name: "What the chronicle shows" });
    expect(group).toHaveAttribute("data-testid", "profile.tabRow");
    expect(screen.getByRole("button", { name: "Everything" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Posts" })).toHaveAttribute("aria-pressed", "false");
    // Each cell is the row's `<id>Tab` node.
    expect(screen.getByTestId(byNode("profile.tabRow.commentsTab"))).toHaveAccessibleName("Comments");
    // The chosen cell: primary plus the 2px inset underline; the rest secondary.
    expect(screen.getByRole("button", { name: "Everything" }).className).toContain("text-primary");
    expect(screen.getByRole("button", { name: "Everything" }).className).toContain("inset_0_-2px_0");
    expect(screen.getByRole("button", { name: "Posts" }).className).toContain("text-on-surface-variant");
  });

  it("answers a tap with the cell's id", () => {
    const onSelect = vi.fn();
    render(<TabBar tabs={TABS} value="everything" ariaLabel="x" onSelect={onSelect} testId="tabs" />);
    fireEvent.click(screen.getByRole("button", { name: "Comments" }));
    expect(onSelect).toHaveBeenCalledWith("comments");
  });

  it("shows a word cell's label as its own name, with no second one", () => {
    render(
      <TabBar
        tabs={[
          { id: "on", label: "On them" },
          { id: "taken", label: "By them" },
        ]}
        value="on"
        ariaLabel="Which direction"
        onSelect={() => {}}
        testId="tabs"
      />,
    );
    const cell = screen.getByRole("button", { name: "On them" });
    expect(cell).toHaveTextContent("On them");
    expect(cell).not.toHaveAttribute("aria-label");
  });
});
