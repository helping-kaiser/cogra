import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShareButton } from "./share-button";

function browser(nav: Record<string, unknown>) {
  vi.stubGlobal("navigator", nav);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ShareButton", () => {
  it("names what it shares, never a bare `Share`", async () => {
    browser({ share: vi.fn().mockResolvedValue(undefined) });
    render(<ShareButton href="/posts/p1" onCopied={() => {}} testId="feed-share-p1" />);
    expect(await screen.findByLabelText("Share this post")).toBeInTheDocument();
  });

  it("resolves the post's route against the origin before handing it over", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    browser({ share });
    render(<ShareButton href="/posts/p1" title="A post" onCopied={() => {}} testId="share" />);
    fireEvent.click(await screen.findByTestId("share"));
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({
        url: `${window.location.origin}/posts/p1`,
        title: "A post",
      }),
    );
  });

  it("says the link was copied only on the branch that copied", async () => {
    const onCopied = vi.fn();
    browser({ clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<ShareButton href="/posts/p1" onCopied={onCopied} testId="share" />);
    fireEvent.click(await screen.findByTestId("share"));
    await waitFor(() => expect(onCopied).toHaveBeenCalledTimes(1));
  });

  it("stays silent when the platform sheet took it", async () => {
    const onCopied = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    browser({ share: vi.fn().mockResolvedValue(undefined), clipboard: { writeText } });
    render(<ShareButton href="/posts/p1" onCopied={onCopied} testId="share" />);
    fireEvent.click(await screen.findByTestId("share"));
    await waitFor(() => expect(writeText).not.toHaveBeenCalled());
    expect(onCopied).not.toHaveBeenCalled();
  });

  // No dead controls: a browser with neither door gets no glyph.
  it("does not render where the browser has no way to share", () => {
    browser({});
    render(<ShareButton href="/posts/p1" onCopied={() => {}} testId="share" />);
    expect(screen.queryByTestId("share")).not.toBeInTheDocument();
  });
});
