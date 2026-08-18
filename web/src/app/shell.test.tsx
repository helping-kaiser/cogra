import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { AppShell } from "./shell";

let pathname = "/feed";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

startMswServer();

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

beforeEach(() => {
  window.localStorage.clear();
  pathname = "/feed";
});

describe("AppShell", () => {
  it("frames a signed-in viewer with the bottom bar", async () => {
    renderWithProviders(
      <AppShell>
        <p>content</p>
      </AppShell>,
      { store: signedInStore() },
    );
    const nav = await screen.findByTestId("bottom-nav");
    expect(nav).toBeInTheDocument();
    expect(screen.getByTestId("nav-feed")).toHaveAttribute("href", "/feed");
    expect(screen.getByTestId("nav-compose")).toHaveAttribute("href", "/compose");
    expect(screen.getByTestId("nav-profile")).toHaveAttribute("href", "/profile");
    // The active tab is marked for assistive tech.
    expect(screen.getByTestId("nav-feed")).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("nav-profile")).not.toHaveAttribute("aria-current");
  });

  it("marks the profile tab on /profile", async () => {
    pathname = "/profile";
    renderWithProviders(
      <AppShell>
        <p>content</p>
      </AppShell>,
      { store: signedInStore() },
    );
    expect(await screen.findByTestId("nav-profile")).toHaveAttribute("aria-current", "page");
  });

  it("shows no bar to an anonymous viewer", async () => {
    renderWithProviders(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    await waitFor(() =>
      expect(screen.queryByTestId("bottom-nav")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});
