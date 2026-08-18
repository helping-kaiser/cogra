import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { RootView } from "./root-view";

const { push, replace } = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

startMswServer();

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

beforeEach(() => {
  window.localStorage.clear();
  replace.mockClear();
});

describe("RootView", () => {
  it("sends a signed-out arrival to the login screen", async () => {
    renderWithProviders(<RootView />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("lands a signed-in arrival on the feed tab", async () => {
    // The shell's root is the feed (design.md §6); the account-status
    // banners ride there — "/" holds no shell of its own anymore.
    renderWithProviders(<RootView />, { store: signedInStore() });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/feed"));
    expect(replace).not.toHaveBeenCalledWith("/login");
  });
});
