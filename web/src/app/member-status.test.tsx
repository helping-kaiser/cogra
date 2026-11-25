import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { fakeIdentityStore } from "@/test/identity";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { MemberStatus } from "./member-status";

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

describe("MemberStatus", () => {
  it("offers to resume parked handshakes", async () => {
    const store = fakeIdentityStore({ keyOnDevice: true, handshakeIds: ["w1", "w2"] });
    const writeSigner = fakeWriteSigner();
    renderWithProviders(<MemberStatus store={store} />, {
      store: signedInStore(),
      writeSigner,
    });

    expect(await screen.findByTestId("home_pending")).toHaveTextContent("2 signed act(s)");
    fireEvent.click(screen.getByTestId("home_resume"));
    await waitFor(() => expect(writeSigner.resume).toHaveBeenCalled());
  });

  // The vouch card is the feed's own first card now (`feed/vouch-card.tsx`):
  // this stack never carries it, on the feed or on the own profile.
  it("carries no vouch card, and nothing at all with no parked handshake", async () => {
    const store = fakeIdentityStore({ keyOnDevice: true });
    const { container } = renderWithProviders(<MemberStatus store={store} />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });

    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByTestId("feed.vouchCard")).not.toBeInTheDocument();
  });

  // The device's read can answer after the stack has gone — a route left
  // mid-read, a test's teardown — and React reads `window.event` to schedule
  // even an update it will drop, so a count set then throws where no window is.
  it("sets nothing once it has gone", async () => {
    let answer: (ids: string[]) => void = () => {};
    const store = {
      ...fakeIdentityStore({ keyOnDevice: true }),
      handshakeIds: () => new Promise<string[]>((resolve) => (answer = resolve)),
    };
    const { unmount } = renderWithProviders(<MemberStatus store={store} />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    unmount();
    // React's own work from the unmount runs first, with its window.
    await new Promise((resolve) => setTimeout(resolve, 10));
    const rejections: unknown[] = [];
    const caught = (reason: unknown) => void rejections.push(reason);
    process.on("unhandledRejection", caught);
    vi.stubGlobal("window", undefined);
    try {
      answer(["w1"]);
      await new Promise((resolve) => setTimeout(resolve, 10));
    } finally {
      vi.unstubAllGlobals();
      process.off("unhandledRejection", caught);
    }
    expect(rejections).toEqual([]);
  });
});
