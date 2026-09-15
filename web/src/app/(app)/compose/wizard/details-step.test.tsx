import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DetailsStep } from "./details-step";

function renderStep(overrides: Partial<Parameters<typeof DetailsStep>[0]> = {}) {
  const props = {
    mode: "words" as const,
    assets: [],
    previews: {},
    clipFace: null,
    coverPreview: null,
    durationMs: 0,
    onCover: vi.fn(),
    title: "",
    description: "",
    tags: [],
    references: [],
    tagErrors: {},
    referenceErrors: {},
    onTitle: vi.fn(),
    onDescription: vi.fn(),
    onTags: vi.fn(),
    onReferences: vi.fn(),
    onManage: vi.fn(),
    onDescribe: vi.fn(),
    onRetry: vi.fn(),
    onRemove: vi.fn(),
    onNext: vi.fn(),
    blocked: false,
    ...overrides,
  };
  render(<DetailsStep {...props} />);
  return props;
}

describe("DetailsStep", () => {
  // Title's cap is 100, floor-driven: the window is max(20, round(100/10)) — the
  // floor of 20, not the tenth of 10 (design/readme.md's caps-affordance round).
  it("says nothing until the title is within its floor-driven window", () => {
    renderStep({ title: "a".repeat(79) }); // remaining 21 — outside the window of 20
    expect(screen.queryByText(/left$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/over$/)).not.toBeInTheDocument();
  });

  it("shows the count at the exact boundary of the title's window", () => {
    renderStep({ title: "a".repeat(80) }); // remaining 20 — exactly the floor
    expect(screen.getByText("20 left")).toBeInTheDocument();
  });

  it("flips the title's count to over past its cap, and still lets the reader type", () => {
    const onTitle = vi.fn();
    renderStep({ title: "a".repeat(105), onTitle });
    expect(screen.getByText("5 over")).toBeInTheDocument();
    // De-truncation: the field carries no native maxLength to make this state
    // unreachable, and typing further is still reported to the caller.
    const input = screen.getByTestId("wizard-title") as HTMLInputElement;
    expect(input.value).toHaveLength(105);
    expect(input).not.toHaveAttribute("maxLength");
  });

  // Description's cap is 500, tenth-driven: the window is max(20, round(500/10)) = 50.
  it("shows the count at the exact boundary of the description's tenth-driven window", () => {
    renderStep({ description: "a".repeat(450) }); // remaining 50 — exactly the tenth
    expect(screen.getByText("50 left")).toBeInTheDocument();
  });

  it("says nothing one scalar value short of the description's window", () => {
    renderStep({ description: "a".repeat(449) }); // remaining 51 — outside the window
    expect(screen.queryByText(/left$/)).not.toBeInTheDocument();
  });

  it("flips the description's count to over past 500 and reaches the drawn refusal", () => {
    // The board's own fixture: 507 of 500 reads "7 over"
    // (design/designs/canonical/screens/ComposeDetailsCaps.jsx:14-19).
    renderStep({ description: "a".repeat(507) });
    expect(screen.getByText("7 over")).toBeInTheDocument();
    expect(
      screen.getByText("Too long — at most 500 characters."),
    ).toBeInTheDocument();
  });

  // ComposeDetailsCaps.jsx:21-24 — Next goes inert while a field is over.
  it("disables Next while a field is over its cap, per the drawn board", () => {
    renderStep({ description: "a".repeat(507), blocked: true });
    expect(screen.getByTestId("wizard-next")).toBeDisabled();
  });

  it("leaves Next enabled while nothing is over its cap", () => {
    renderStep({ title: "Salt maps", description: "Three weekends of rubbings.", blocked: false });
    expect(screen.getByTestId("wizard-next")).not.toBeDisabled();
  });
});
