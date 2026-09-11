import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SENSITIVE_REASON_MAX_CHARS } from "@/lib/compose/wizard";
import { SensitiveSheet } from "./sensitive-sheet";

function open(overrides: Partial<Parameters<typeof SensitiveSheet>[0]> = {}) {
  const props = {
    open: true,
    marked: true,
    reason: "",
    onMarked: vi.fn(),
    onReason: vi.fn(),
    onClose: vi.fn(),
    onHelp: vi.fn(),
    testIdPrefix: "test",
    ...overrides,
  };
  render(<SensitiveSheet {...props} />);
  return props;
}

describe("SensitiveSheet", () => {
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

  // Scalar values, not UTF-16 code units, matching every other cap in the
  // compose lanes.
  it("counts an astral character as one, not two", () => {
    open({ reason: "🧂".repeat(SENSITIVE_REASON_MAX_CHARS) });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
