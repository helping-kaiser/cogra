import { fireEvent, screen, waitFor } from "@testing-library/react";
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

  it("frames an anonymous reader with the same bar, gated slots asking instead of bouncing", async () => {
    renderWithProviders(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    const nav = await screen.findByTestId("bottom-nav");
    expect(nav).toBeInTheDocument();
    expect(screen.getByTestId("nav-feed")).toHaveAttribute("href", "/feed");

    // A gated slot opens the prompt in place; the read stays behind it.
    fireEvent.click(screen.getByTestId("nav-compose"));
    const prompt = screen.getByTestId("join-prompt") as HTMLDialogElement;
    expect(prompt.open).toBe(true);
    expect(screen.getByTestId("join-prompt-signin")).toHaveAttribute("href", "/login");
    expect(screen.getByText("content")).toBeInTheDocument();

    // Keep browsing closes it; nothing navigated.
    fireEvent.click(screen.getByTestId("join-prompt-dismiss"));
    await waitFor(() => expect(prompt.open).toBe(false));

    // The profile slot asks the same way.
    fireEvent.click(screen.getByTestId("nav-profile"));
    expect(prompt.open).toBe(true);
  });

  it.each(["/posts/post-1", "/u/alice"])(
    "keeps the bar on the read drill-in %s",
    async (path) => {
      pathname = path;
      renderWithProviders(
        <AppShell>
          <p>content</p>
        </AppShell>,
        { store: signedInStore() },
      );
      expect(await screen.findByTestId("bottom-nav")).toBeInTheDocument();
      // A drill-in selects no tab.
      expect(screen.getByTestId("nav-feed")).not.toHaveAttribute("aria-current");
      expect(screen.getByTestId("nav-profile")).not.toHaveAttribute("aria-current");
    },
  );

  it.each(["/compose", "/profile/edit", "/settings", "/settings/key", "/invites", "/key", "/restore"])(
    "leaves the task flow %s without the bar",
    async (path) => {
      pathname = path;
      renderWithProviders(
        <AppShell>
          <p>content</p>
        </AppShell>,
        { store: signedInStore() },
      );
      expect(await screen.findByText("content")).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.queryByTestId("bottom-nav")).not.toBeInTheDocument(),
      );
    },
  );

  it("keeps the bar off the front door", async () => {
    pathname = "/";
    renderWithProviders(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    expect(await screen.findByText("content")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId("bottom-nav")).not.toBeInTheDocument(),
    );
  });

  it("keeps the bar off the own profile until the gate passes", async () => {
    pathname = "/profile";
    renderWithProviders(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    expect(await screen.findByText("content")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId("bottom-nav")).not.toBeInTheDocument(),
    );
  });

  it("keeps the bar off the auth surfaces", async () => {
    pathname = "/login";
    renderWithProviders(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    expect(await screen.findByText("content")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId("bottom-nav")).not.toBeInTheDocument(),
    );
  });
});
