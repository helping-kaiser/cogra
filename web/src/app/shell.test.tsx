import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { byNode } from "@/test/data-node";
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
    const nav = await screen.findByTestId(byNode("feed.bottomBar"));
    expect(nav).toBeInTheDocument();
    expect(screen.getByTestId(byNode("feed.bottomBar.feedSlot"))).toHaveAttribute("href", "/feed");
    expect(screen.getByTestId(byNode("feed.bottomBar.composeSlot"))).toHaveAttribute("href", "/compose");
    expect(screen.getByTestId(byNode("feed.bottomBar.profileSlot"))).toHaveAttribute("href", "/profile");
    // The active tab is marked for assistive tech.
    expect(screen.getByTestId(byNode("feed.bottomBar.feedSlot"))).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId(byNode("feed.bottomBar.profileSlot"))).not.toHaveAttribute("aria-current");
  });

  // The bar is drawn once, by the shell, but its node is the SCREEN's
  // (`design/designs/canonical/nodes.json`): a registered screen names it by its
  // own prefix, and a screen not registered yet keeps the bar's own ids.
  it.each([
    ["/feed", "feed.bottomBar"],
    ["/posts/post-1", "postDetail.bottomBar"],
  ])("names the bar on the registered screen %s after it", async (path, bar) => {
    pathname = path;
    renderWithProviders(
      <AppShell>
        <p>content</p>
      </AppShell>,
      { store: signedInStore() },
    );
    expect(await screen.findByTestId(byNode(bar))).toBeInTheDocument();
    for (const slot of ["feedSlot", "composeSlot", "profileSlot"]) {
      expect(screen.getByTestId(byNode(`${bar}.${slot}`))).toBeInTheDocument();
    }
    expect(screen.queryByTestId("bottom-nav")).not.toBeInTheDocument();
  });

  it.each(["/posts/post-1/edit", "/u/alice"])(
    "keeps the bar's own ids on %s, whose screen is not registered",
    async (path) => {
      pathname = path;
      renderWithProviders(
        <AppShell>
          <p>content</p>
        </AppShell>,
        { store: signedInStore() },
      );
      expect(await screen.findByTestId("bottom-nav")).toBeInTheDocument();
      expect(screen.getByTestId("nav-feed")).toBeInTheDocument();
    },
  );

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
    const nav = await screen.findByTestId(byNode("feed.bottomBar"));
    expect(nav).toBeInTheDocument();
    expect(screen.getByTestId(byNode("feed.bottomBar.feedSlot"))).toHaveAttribute("href", "/feed");

    // A gated slot opens the prompt in place; the read stays behind it.
    fireEvent.click(screen.getByTestId(byNode("feed.bottomBar.composeSlot")));
    const prompt = screen.getByTestId("join-prompt") as HTMLDialogElement;
    expect(prompt.open).toBe(true);
    expect(screen.getByTestId("join-prompt-signin")).toHaveAttribute("href", "/login");
    expect(screen.getByText("content")).toBeInTheDocument();

    // Keep browsing closes it; nothing navigated.
    fireEvent.click(screen.getByTestId("join-prompt-dismiss"));
    await waitFor(() => expect(prompt.open).toBe(false));

    // The profile slot asks the same way.
    fireEvent.click(screen.getByTestId(byNode("feed.bottomBar.profileSlot")));
    expect(prompt.open).toBe(true);
  });

  it.each([
    ["/posts/post-1", "postDetail.bottomBar.feedSlot", "postDetail.bottomBar.profileSlot"],
    ["/u/alice", "nav-feed", "nav-profile"],
  ])("keeps the bar on the read drill-in %s", async (path, feedSlot, profileSlot) => {
    pathname = path;
    renderWithProviders(
      <AppShell>
        <p>content</p>
      </AppShell>,
      { store: signedInStore() },
    );
    // A drill-in selects no tab.
    expect(await screen.findByTestId(feedSlot)).not.toHaveAttribute("aria-current");
    expect(screen.getByTestId(profileSlot)).not.toHaveAttribute("aria-current");
  });

  // The bar is chrome by structure: a viewport-tall column, a scrolling
  // middle, the band as the column's last child. A `fixed` band is laid out
  // against a mobile browser's layout viewport and slides under the fold on a
  // long page — which is what a long post detail did.
  it("hangs the bar off a viewport-tall column whose middle scrolls", async () => {
    renderWithProviders(
      <AppShell>
        <p>content</p>
      </AppShell>,
      { store: signedInStore() },
    );
    const scroller = await screen.findByTestId("app-scroller");
    expect(scroller.className).toContain("overflow-y-auto");
    expect(scroller.className).toContain("flex-1");
    // The column fills a body the root layout pins to the dynamic viewport.
    expect(scroller.parentElement?.className).toContain("h-full");
    // The content scrolls INSIDE that middle; the band is its sibling, so no
    // amount of content can reach it.
    expect(scroller).toContainElement(screen.getByText("content"));
    expect(scroller).not.toContainElement(screen.getByTestId(byNode("feed.bottomBar")));
  });

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
