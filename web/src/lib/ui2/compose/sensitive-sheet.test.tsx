import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SENSITIVE_REASON_MAX_CHARS } from "@/lib/compose/wizard";
import { SensitiveSheet } from "./sensitive-sheet";

function open(overrides: Partial<Parameters<typeof SensitiveSheet>[0]> = {}) {
  const props = {
    open: true,
    reason: "",
    onDone: vi.fn(),
    onClose: vi.fn(),
    onHelp: vi.fn(),
    testIdPrefix: "test",
    ...overrides,
  };
  render(<SensitiveSheet {...props} />);
  return props;
}

describe("SensitiveSheet", () => {
  // THE REASON GROWS (jakob's ruling, the sheets-and-video round, 2026-09-22
  // — design/readme.md §13: "the sensitive sheet's **Why?** becomes a growing
  // one-line field"). It opens as the single line the board draws and takes a
  // second the moment the reason needs one; a reason is a sentence, and the
  // input it used to be showed the first phrase of it.
  it("gives the reason a growing one-line box, not a single line", () => {
    open();
    const reason = screen.getByTestId("test-sensitive-reason");
    expect(reason.tagName).toBe("TEXTAREA");
    expect(reason).toHaveAttribute("rows", "1");
  });

  // The sheet is content-sized and the box is the one child that yields, so
  // the growth comes out of the box rather than the sheet's Done row.
  it("lets the reason yield the room when the sheet meets its ceiling", () => {
    open();
    expect(screen.getByTestId("growing-box").className).toContain("min-h-0");
    expect(screen.getByTestId("growing-box").className).toContain("overflow-y-auto");
  });

  // The box is what carries the border now, so it is what carries the dimming
  // too — a reason the contract would refuse still reads as dead until the
  // mark is on.
  it("greys the reason's box out while the mark is off", () => {
    open();
    fireEvent.click(screen.getByTestId("test-sensitive-switch"));
    expect(screen.getByTestId("test-sensitive-reason")).toBeDisabled();
    expect(screen.getByTestId("growing-box").className).toContain("opacity-[var(--state-disabled)]");
  });

  // The server refuses past this length, so the sheet says so where the
  // reason is written rather than letting the seal carry the news — one sheet
  // for every surface that marks (the post seal, the reply seal, and the
  // comment editor all reach it).
  it("stays quiet at the cap the write side allows", () => {
    open({ reason: "x".repeat(SENSITIVE_REASON_MAX_CHARS) });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says when the reason is past that cap", () => {
    open({ reason: "x".repeat(SENSITIVE_REASON_MAX_CHARS + 1) });
    expect(screen.getByRole("alert")).toHaveTextContent(/too long/i);
  });

  // Visible but disabled over the cap, never hidden (the caps-affordance
  // round's ruling, PR #755's pattern) — Done stays on screen so the author
  // can trim back under the cap, rather than losing the way out.
  it("disables, rather than hides, Done past the cap", () => {
    open({ reason: "x".repeat(SENSITIVE_REASON_MAX_CHARS + 1) });
    expect(screen.getByTestId("test-sensitive-done")).toBeVisible();
    expect(screen.getByTestId("test-sensitive-done")).toBeDisabled();
  });

  it("leaves Done enabled at the cap the write side allows", () => {
    open({ reason: "x".repeat(SENSITIVE_REASON_MAX_CHARS) });
    expect(screen.getByTestId("test-sensitive-done")).toBeEnabled();
  });

  // An over-length leftover from a mark switched back off is never sent
  // (`sensitiveInput`), so it earns no error and never blocks Done.
  it("ignores an over-cap reason while the mark is off", () => {
    open({ reason: "x".repeat(SENSITIVE_REASON_MAX_CHARS + 1) });
    fireEvent.click(screen.getByTestId("test-sensitive-switch"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByTestId("test-sensitive-done")).toBeEnabled();
  });

  // Scalar values, not UTF-16 code units, matching every other cap in the
  // compose lanes.
  it("counts an astral character as one, not two", () => {
    open({ reason: "🧂".repeat(SENSITIVE_REASON_MAX_CHARS) });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // The "?" and the switch ride the sheet's own title row (board
  // ComposeSensitive.jsx:21-39), rather than sitting in the body below it.
  it("carries the help dot and the switch on the title row, not in the body", () => {
    open();
    const heading = screen.getByRole("heading", { name: "Mark as sensitive" });
    const titleRow = heading.parentElement;
    expect(titleRow).not.toBeNull();
    expect(titleRow).toContainElement(screen.getByTestId("test-sensitive-help"));
    expect(titleRow).toContainElement(screen.getByTestId("test-sensitive-switch"));
  });

  // `Mark` opens it with the switch ON (jakob 2026-10-01): the tap was the intent.
  it("opens marked, the switch on", () => {
    open();
    expect(screen.getByTestId("test-sensitive-switch")).toHaveAttribute("aria-checked", "true");
  });

  // The sheet law (readme §4): the switch and the reason STAGE, Done commits.
  it("commits the staged mark and reason on Done, and nothing before it", () => {
    const { onDone } = open();
    fireEvent.change(screen.getByTestId("test-sensitive-reason"), {
      target: { value: "One rubbing includes a dead seabird." },
    });
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("test-sensitive-done"));
    expect(onDone).toHaveBeenCalledWith({
      sensitive: true,
      sensitiveReason: "One rubbing includes a dead seabird.",
    });
  });

  // The "?" is the board's `Sensitive` (ComposeSensitive.jsx).
  it("names its help Sensitive", () => {
    open();
    expect(screen.getByRole("button", { name: "Sensitive" })).toBeInTheDocument();
  });
});
