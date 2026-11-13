// ReelCaption's handle line at the longest legal handle (NamesLong.md:5, :9):
// a caption never wraps, and a handle that ends its line is cut by the line's
// own end clip. jsdom lays nothing out; the harness measures the box.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LONG_HANDLE } from "@/test/names";
import { ReelCaption } from "./reel-caption";

describe("ReelCaption's handle line", () => {
  it("clips a long handle at the line's end, never wrapping", () => {
    render(<ReelCaption handle={LONG_HANDLE} title={null} description={null} bottom="130px" />);
    const line = screen.getByTestId("reel-caption-handle");
    expect(line).toHaveTextContent(`@${LONG_HANDLE}`);
    expect(line.className.split(" ")).toEqual(expect.arrayContaining(["min-w-0", "truncate"]));
  });
});
