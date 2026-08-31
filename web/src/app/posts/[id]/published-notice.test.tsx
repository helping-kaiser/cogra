import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SNACKBAR_MS } from "@/lib/ui/snackbar";
import { PublishedNotice, justPublished } from "./published-notice";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams,
}));

beforeEach(() => {
  searchParams = new URLSearchParams();
  replace.mockClear();
});

describe("justPublished", () => {
  it("reads the one value the wizard sends and nothing else", () => {
    expect(justPublished("1")).toBe(true);
    expect(justPublished(null)).toBe(false);
    expect(justPublished("yes")).toBe(false);
  });
});

describe("PublishedNotice", () => {
  it("says nothing on an ordinary visit", () => {
    render(<PublishedNotice postId="p1" />);
    // The live region is mounted regardless, so the confirmation is announced
    // when it arrives rather than appearing together with its own region.
    expect(screen.getByTestId("post-published-region")).toBeInTheDocument();
    expect(screen.queryByTestId("post-published")).not.toBeInTheDocument();
  });

  it("confirms the post that was just signed", () => {
    searchParams = new URLSearchParams("published=1");
    render(<PublishedNotice postId="p1" />);
    expect(screen.getByTestId("post-published")).toHaveTextContent(
      "Signed — it's in the thread now, still settling.",
    );
  });

  it("drops the query value once it has been read, so a reload cannot fire it again", () => {
    vi.useFakeTimers();
    try {
      searchParams = new URLSearchParams("published=1");
      render(<PublishedNotice postId="p1" />);
      act(() => {
        vi.advanceTimersByTime(SNACKBAR_MS);
      });
      expect(replace).toHaveBeenCalledWith("/posts/p1");
    } finally {
      vi.useRealTimers();
    }
  });
});
