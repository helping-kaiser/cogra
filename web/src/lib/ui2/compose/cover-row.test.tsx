// ComposeCover.md (round 22): "WHEN the step opens GIVEN the device has not
// finished cutting the clip's frames -> the strip's caption reads Reading the
// video… once the frames are 200ms late AND NEVER a spinner appears".

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CoverRow, READING_LATE_MS } from "./cover-row";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function draw(capturing: boolean, framePreviews: readonly string[] = []) {
  return render(
    <CoverRow
      framePreviews={framePreviews}
      cover={null}
      capturing={capturing}
      onPickFrame={() => {}}
      onPickPicture={() => {}}
    />,
  );
}

describe("the cover strip's reading caption", () => {
  it("stands only once the frames are 200ms late", () => {
    draw(true);
    expect(screen.queryByTestId("wizard-cover-capturing")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(READING_LATE_MS - 1);
    });
    expect(screen.queryByTestId("wizard-cover-capturing")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("wizard-cover-capturing")).toHaveTextContent("Reading the video…");
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("never stands once the frames are in", () => {
    draw(true, ["frame-1.jpg"]);
    act(() => {
      vi.advanceTimersByTime(READING_LATE_MS * 2);
    });
    expect(screen.queryByTestId("wizard-cover-capturing")).toBeNull();
  });
});
