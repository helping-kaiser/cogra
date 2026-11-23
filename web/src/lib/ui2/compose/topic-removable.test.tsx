// A staged tag is one line (TopicRemovable.jsx, round 63: "the pill never grows
// past its row and never wraps its name; a name too long for the row … is the
// part cut, ending in "…", while the pair and the × keep their room"). jsdom
// lays nothing out: these pin the structure that makes the CSS do the cut; the
// lane's browser run measures the boxes.

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TopicRemovable } from "./topic-removable";

/** The atom's longest legal name, one unbroken run (hashtag.md §1: 128 characters). */
const LONG = "s".repeat(128);

describe("TopicRemovable — a tag is one line", () => {
  it.each([
    ["with its pair opener", true],
    ["as plain words", false],
  ])("cuts its name and never grows past its row, %s", (_, editable) => {
    render(<TopicRemovable name={LONG} onRemove={vi.fn()} onEdit={editable ? vi.fn() : undefined} testId="pill" />);
    const pill = screen.getByTestId("pill");
    // The pill yields to its row instead of overflowing it.
    expect(pill).toHaveClass("max-w-full", "min-w-0");
    const name = screen.getByText(`#${LONG}`);
    expect(name).toHaveClass("min-w-0", "overflow-hidden", "text-ellipsis", "whitespace-nowrap");
    if (editable) expect(screen.getByTestId("pill-select")).toHaveClass("min-w-0");
    // The × keeps its room.
    expect(screen.getByTestId("pill-remove")).toHaveClass("flex-none");
  });

  // The accessible names carry the whole tag, whatever the cut hides.
  it("names both controls by the whole tag", () => {
    render(<TopicRemovable name={LONG} onRemove={vi.fn()} onEdit={vi.fn()} testId="pill" />);
    expect(screen.getByRole("button", { name: `#${LONG} — set how it relates` })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Remove #${LONG}` })).toBeInTheDocument();
  });
});
