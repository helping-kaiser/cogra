// Page visibility (`page-visibility.ts`), driven the way a browser drives it:
// the document's state flips, then `visibilitychange` fires
// (`src/test/media-env.ts`'s `setsPageVisibility`).

import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { setsPageVisibility } from "@/test/media-env";

import { isPageVisible, usePageVisible } from "./page-visibility";

function Reader() {
  const visible = usePageVisible();
  return <span data-testid="reader" data-visible={String(visible)} />;
}

const reads = () => screen.getByTestId("reader").dataset.visible;

describe("page visibility", () => {
  it("reads a page on screen as visible", () => {
    expect(isPageVisible()).toBe(true);
  });

  it("follows the page as it is hidden and shown again", () => {
    render(<Reader />);
    expect(reads()).toBe("true");

    act(() => setsPageVisibility("hidden"));
    expect(reads()).toBe("false");

    act(() => setsPageVisibility("visible"));
    expect(reads()).toBe("true");
  });

  // TEARDOWN HYGIENE (the stage-law packet's §6 row).
  it("stops listening when it unmounts", () => {
    const removed = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<Reader />);

    unmount();

    expect(removed).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    removed.mockRestore();
  });
});
