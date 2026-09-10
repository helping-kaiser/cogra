import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BorrowedViewBand, borrowedViewLine, SIGN_IN_OR_JOIN } from "./borrowed-view-band";

describe("BorrowedViewBand", () => {
  // The three readings are ruled copy (`design/readme.md` §13); these pin
  // them so a reworded line is a failing test rather than a quiet drift
  // away from the boards.
  it("wears the ruled readings, one per reader", () => {
    expect(borrowedViewLine.join("mira")).toBe(
      "Browsing from @mira's view — join to build your own.",
    );
    expect(borrowedViewLine.applicant("mira")).toBe(
      "Browsing from @mira's view while your application lands.",
    );
    expect(SIGN_IN_OR_JOIN).toBe("Sign in or join");
  });

  it("names the vantage and carries the one way in", () => {
    const onAction = vi.fn();
    render(
      <BorrowedViewBand
        handle="mira"
        displayName="Mira Voss"
        line={borrowedViewLine.join("mira")}
        actionLabel={SIGN_IN_OR_JOIN}
        onAction={onAction}
      />,
    );

    expect(screen.getByTestId("borrowed-view-line")).toHaveTextContent(
      "Browsing from @mira's view — join to build your own.",
    );
    fireEvent.click(screen.getByTestId("borrowed-view-action"));
    expect(onAction).toHaveBeenCalledOnce();
  });

  // The action drops for the signed-in applicant: the line changes but the
  // vantage does not, and there is nothing for them to do about it.
  it("drops the action when none is offered", () => {
    render(<BorrowedViewBand handle="mira" line={borrowedViewLine.applicant("mira")} />);

    expect(screen.getByTestId("borrowed-view")).toBeInTheDocument();
    expect(screen.queryByTestId("borrowed-view-action")).not.toBeInTheDocument();
  });

  // The monogram is the designed placeholder, not a gap: a vantage with no
  // display name is named by its handle rather than left blank.
  it("falls back to the handle for the monogram when no name is set", () => {
    render(
      <BorrowedViewBand
        handle="genesis_mod"
        displayName=" "
        line={borrowedViewLine.join("genesis_mod")}
      />,
    );

    expect(screen.getByTestId("borrowed-view")).toHaveTextContent("G");
  });
});
