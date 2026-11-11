// The four masters round 28 named by their whole roles (design readme §13,
// "the masters take their whole roles"), asserted on their web twins: each line
// reads its role through the one Tailwind utility — which carries size,
// leading, tracking and weight together — and sets no part of it apart.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormPasswordField } from "@/lib/ui2/form-fields";
import { WaitingCommit } from "@/lib/ui2/waiting-commit";

import { PendingMarker } from "./pending-marker";
import { SigningPending } from "./signing-pending";
import { TransportError } from "./transport-error";

/** One part of a role set on its own: a size, leading, tracking or weight beside or instead of the utility. */
const PART = /text-\[length:|\[line-height:|\[letter-spacing:|\[font-weight:|\[font-size:|\bleading-|\btracking-|\bfont-(?:normal|medium|semibold|bold)\b/;

function expectWholeRole(element: HTMLElement, role: string) {
  const classes = element.getAttribute("class") ?? "";
  expect(classes.split(/\s+/), `${role} on ${element.outerHTML.slice(0, 120)}`).toContain(`text-${role}`);
  expect(classes).not.toMatch(PART);
  expect(element.getAttribute("style") ?? "").not.toMatch(/font|line-height|letter-spacing/);
}

describe("round 28's named masters take their whole roles", () => {
  it("the fault line is body-medium whole (TransportError.jsx)", () => {
    render(<TransportError testId="fault" />);
    expectWholeRole(screen.getByTestId("fault"), "body-medium");
  });

  it("the signing fault lines are body-medium whole (TransportError.jsx SigningPending)", () => {
    const { unmount } = render(<SigningPending needsKey testIdPrefix="s" />);
    expectWholeRole(screen.getByTestId("s-signing-needs-key"), "body-medium");
    unmount();
    render(<SigningPending needsKey={false} testIdPrefix="s" />);
    expectWholeRole(screen.getByTestId("s-signing-failed"), "body-medium");
  });

  it("the waiting reason is label-small whole, weight 500 with it (WaitingCommit)", () => {
    render(
      <WaitingCommit label="Post" busyLabel="Posting…" reason="Waiting for a title" waiting node={{ path: "x.commit" }} />,
    );
    expectWholeRole(screen.getByTestId("x.commit.reason"), "label-small");
  });

  it("the password input is body-large whole, the text field's (PasswordField.jsx)", () => {
    render(<FormPasswordField label="Password" value="" onChange={() => {}} autoComplete="current-password" testId="pw" />);
    expectWholeRole(screen.getByTestId("pw"), "body-large");
  });

  it("the pending line is label-small whole, both boxes (PendingMarker.jsx)", () => {
    const { unmount } = render(<PendingMarker testId="pending" />);
    expectWholeRole(screen.getByTestId("pending"), "label-small");
    unmount();
    render(<PendingMarker testId="pending" inline />);
    expectWholeRole(screen.getByTestId("pending"), "label-small");
  });
});
