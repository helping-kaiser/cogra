import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("states the fact and draws no action by default", () => {
    render(<EmptyState testId="empty" title="Nothing here yet." />);
    expect(screen.getByTestId("empty")).toHaveTextContent("Nothing here yet.");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  // The master's `actionLabel && onAction` fallback: the one action that
  // fills the list, built from the two strings rather than passed whole.
  it("builds the one action that fills it, from the two strings", () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        testId="empty"
        title="Nothing here yet."
        actionLabel="New post"
        onAction={onAction}
      />,
    );
    const action = screen.getByTestId("empty-action");
    expect(action).toHaveTextContent("New post");
    fireEvent.click(action);
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("takes a custom action whole, for a case the two strings can't express", () => {
    render(
      <EmptyState
        testId="empty"
        title="Nothing here yet."
        action={<span data-testid="custom-action">Custom</span>}
      />,
    );
    expect(screen.getByTestId("custom-action")).toBeInTheDocument();
  });

  // Never `error` colouring (the master's own register rule, §9): an empty
  // list is not a fault.
  it("never carries error colouring", () => {
    render(<EmptyState testId="empty" title="Nothing here yet." />);
    const title = screen.getByText("Nothing here yet.");
    expect(title.className).toContain("text-on-surface-variant");
    expect(title.className).not.toContain("text-error");
  });
});
