import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MultiActionConfirm, SignedActionsIndicator, signedActionsLine } from "./signed-actions";

describe("signedActionsLine", () => {
  it("counts in the singular, the plural, and at nothing", () => {
    expect(signedActionsLine(1)).toBe("creates 1 signed action");
    expect(signedActionsLine(4)).toBe("creates 4 signed actions");
    expect(signedActionsLine(0)).toBe("creates no signed actions");
  });
});

describe("SignedActionsIndicator", () => {
  it("states the count and announces its changes", () => {
    const { rerender } = render(<SignedActionsIndicator count={1} testId="count" />);
    expect(screen.getByTestId("count")).toHaveTextContent("creates 1 signed action");
    expect(screen.getByTestId("count")).toHaveAttribute("aria-live", "polite");
    rerender(<SignedActionsIndicator count={3} testId="count" />);
    expect(screen.getByTestId("count")).toHaveTextContent("creates 3 signed actions");
  });
});

function show(props: Partial<React.ComponentProps<typeof MultiActionConfirm>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <MultiActionConfirm
      count={3}
      onConfirm={onConfirm}
      onCancel={onCancel}
      testIdPrefix="compose"
      {...props}
    />,
  );
  return { onConfirm, onCancel };
}

describe("the multi-action confirmation", () => {
  it("opens as a modal, so focus and Esc come from the platform", () => {
    show();
    expect(
      screen.getByTestId<HTMLDialogElement>("compose-multi-action-confirm").open,
    ).toBe(true);
  });

  it("states what the submit costs before anything is signed", () => {
    show({ count: 4 });
    expect(screen.getByTestId("compose-multi-action-count")).toHaveTextContent(
      "creates 4 signed actions, each paid for separately",
    );
  });

  it("proceeds only on the explicit act, and reports the checkbox", () => {
    const { onConfirm } = show();
    fireEvent.click(screen.getByTestId("compose-multi-action-proceed"));
    expect(onConfirm).toHaveBeenCalledWith(false);
  });

  it("carries the don't-ask-again choice out to the caller", () => {
    const { onConfirm } = show();
    fireEvent.click(screen.getByTestId("compose-multi-action-remember"));
    fireEvent.click(screen.getByTestId("compose-multi-action-proceed"));
    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  it("cancels without signing", () => {
    const { onCancel, onConfirm } = show();
    fireEvent.click(screen.getByTestId("compose-multi-action-cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("cannot be signed twice while the first is in flight", () => {
    const { onConfirm } = show({ busy: true });
    fireEvent.click(screen.getByTestId("compose-multi-action-proceed"));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // F7: the confirming action sits on the RIGHT.
  it("puts the confirming action last in the DOM order", () => {
    show();
    const buttons = screen
      .getByTestId("compose-multi-action-confirm")
      .querySelectorAll("button");
    expect(buttons[buttons.length - 1]).toBe(screen.getByTestId("compose-multi-action-proceed"));
  });
});
