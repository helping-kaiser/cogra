import { afterEach, describe, expect, it, vi } from "vitest";

import { LINK_COPIED, canShare, shareLink } from "./share";

/** jsdom ships neither door, so each case declares the browser it is about. */
function browser(nav: Record<string, unknown>) {
  vi.stubGlobal("navigator", nav);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("share", () => {
  it("carries the ruled line verbatim", () => {
    expect(LINK_COPIED).toBe("Link copied");
  });

  it("hands the link to the platform sheet where there is one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    browser({ share, clipboard: { writeText: vi.fn() } });
    expect(canShare()).toBe(true);
    await expect(shareLink("https://cogra.test/posts/p1", "A post")).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ url: "https://cogra.test/posts/p1", title: "A post" });
  });

  // Presence is the switch, not success: a reader who dismissed the OS sheet
  // has answered, and copying behind their back would be a second act.
  it("says nothing when the platform sheet is dismissed", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    browser({ share: vi.fn().mockRejectedValue(new Error("AbortError")), clipboard: { writeText } });
    await expect(shareLink("https://cogra.test/posts/p1")).resolves.toBe("shared");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies the link where the platform has no sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    browser({ clipboard: { writeText } });
    expect(canShare()).toBe(true);
    await expect(shareLink("https://cogra.test/posts/p1")).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("https://cogra.test/posts/p1");
  });

  it("reports a refused clipboard rather than claiming a copy", async () => {
    browser({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    await expect(shareLink("https://cogra.test/posts/p1")).resolves.toBe("unavailable");
  });

  it("has no door at all on a browser carrying neither", async () => {
    browser({});
    expect(canShare()).toBe(false);
    await expect(shareLink("https://cogra.test/posts/p1")).resolves.toBe("unavailable");
  });
});
