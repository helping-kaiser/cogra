import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { notificationsHref } from "@/lib/notifications/origin";
import { createTokenStore } from "@/lib/session/token-store";
import { byNode } from "@/test/data-node";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { AppShell } from "./shell";

let pathname = "/feed";
let search = "";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: () => {} }),
  useSearchParams: () => new URLSearchParams(search),
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
  search = "";
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
    ["/profile", "profile.bottomBar"],
    ["/u/alice", "profile.bottomBar"],
    // History.md:121: the bar keeps lit the root History was opened from.
    ["/history", "history.bottomBar"],
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

  it.each(["/posts/post-1/edit"])(
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

  it("keeps the profile slot lit on /history (History.md:121)", async () => {
    pathname = "/history";
    renderWithProviders(
      <AppShell>
        <p>content</p>
      </AppShell>,
      { store: signedInStore() },
    );
    expect(await screen.findByTestId(byNode("history.bottomBar.profileSlot"))).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks the profile tab on /profile", async () => {
    pathname = "/profile";
    renderWithProviders(
      <AppShell>
        <p>content</p>
      </AppShell>,
      { store: signedInStore() },
    );
    expect(await screen.findByTestId(byNode("profile.bottomBar.profileSlot"))).toHaveAttribute(
      "aria-current",
      "page",
    );
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

  // A DRILL-IN KEEPS ITS ORIGIN'S ROOT LIT (PostDetail.md:57-59;
  // ProfileOther.md:11; BottomNav.prompt.md, jakob 2026-10-06): from the feed,
  // a link or a notification the Feed; from a Saved row the Profile Saved
  // hangs from. Someone's profile is a drill-in exactly as a post is.
  it.each([
    ["/posts/post-1", "", "feedSlot"],
    ["/posts/post-1", "from=notifications", "feedSlot"],
    ["/posts/post-1", "from=saved", "profileSlot"],
    // A post opened from your own profile's chronicle hangs off Profile.
    ["/posts/post-1", "from=profile", "profileSlot"],
    ["/posts/post-1", "from=u:alice", "feedSlot"],
    ["/u/alice", "", "feedSlot"],
    ["/u/alice", "from=saved", "profileSlot"],
    // A History card's doors hang off Profile, as Saved's do.
    ["/posts/post-1", "from=history", "profileSlot"],
    ["/u/alice", "from=history", "profileSlot"],
  ])("lights the drill-in's origin root (%s %s)", async (path, query, lit) => {
    pathname = path;
    search = query;
    const bar = path === "/u/alice" ? "profile.bottomBar" : "postDetail.bottomBar";
    renderWithProviders(
      <AppShell>
        <p>content</p>
      </AppShell>,
      { store: signedInStore() },
    );
    const unlit = lit === "feedSlot" ? "profileSlot" : "feedSlot";
    expect(await screen.findByTestId(byNode(`${bar}.${lit}`))).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId(byNode(`${bar}.${unlit}`))).not.toHaveAttribute("aria-current");
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

  // Notifications.md:27 — the bar keeps lit the slot of the root the bell was
  // tapped on, under the list's own registered bar node.
  it.each([
    ["feed", "notifications.bottomBar.feedSlot"],
    ["profile", "notifications.bottomBar.profileSlot"],
  ] as const)("the_originating_root_stays_lit from %s", async (root, slot) => {
    notificationsHref(root);
    pathname = "/notifications";
    renderWithProviders(
      <AppShell>
        <p>content</p>
      </AppShell>,
      { store: signedInStore() },
    );
    expect(await screen.findByTestId(byNode(slot))).toHaveAttribute("aria-current", "page");
  });
});
