"use client";

// The app shell (design.md §6): one frame for every viewer — the
// bottom bar rides the read surfaces signed in or out, its
// account-needing slots prompting the anonymous reader. The task
// flows and the auth surfaces stand without it, and while the phase
// resolves it stays off so it never flashes. Rendered from the root
// layout so it wraps the public tier and the (app) group alike; the
// auth gate stays where it is.
//
// THE SHELL IS A VIEWPORT-TALL COLUMN AND THE MIDDLE OF IT SCROLLS. The bar
// used to be `position: fixed; bottom: 0` over a document that scrolled, which
// is the arrangement that pushed it off a long post detail: a fixed element is
// laid out against the LAYOUT viewport, and a mobile browser's layout viewport
// is taller than the visible one whenever its address bar is showing. Short
// pages never scroll, so they never showed it; long ones did, which is exactly
// the shape of the report. `100dvh` is the unit that tracks the address bar
// (CSS Values 4, "dynamic viewport"), and the root layout pins the BODY to it
// so the document has no scroll of its own to give; this column fills that
// body, the bar is its last child, and the content between them scrolls. The
// bar is then chrome by STRUCTURE rather than by coordinates, and no content
// length can reach it — which is how the boards draw it
// (`design/designs/canonical/screens/_shared.jsx`: a `flex: 1` scroller with
// the nav as a static sibling) and what the ruling asks for.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, type ReactNode } from "react";

import { announceFeedReselect } from "@/lib/feed/feed-reselect";
import { notificationsOrigin } from "@/lib/notifications/origin";
import type { BellRoot } from "@/lib/notifications/row-content";
import { parseOpinionsOrigin } from "@/lib/profile/opinions-route";
import { useAuthPhase } from "@/lib/session/provider";
import { KeptPicksNavigation } from "@/lib/stance/kept-picks-route";
import { BottomNav, type NavSlot } from "@/lib/ui/bottom-nav";
import { CarriedSnackbar } from "@/lib/ui/carried-snackbar";
import { scrollHostToTopAnimated, scrollOffsetOf } from "@/lib/ui/scroll-host";

/** The bar slot each bell root lights. */
const ROOT_SLOT: Record<BellRoot, NavSlot> = {
  feed: "feed",
  explore: "search",
  wallet: "wallet",
  profile: "profile",
};
import { PadParkingProvider } from "@/lib/ui/pad-parking";
import { ScrollHostProvider } from "@/lib/ui/scroll-host";

/**
 * THE ROOT A DRILL-IN KEEPS LIT (PostDetail.md:57-59; ProfileOther.md:11;
 * ProfileDeleted.md:27; `BottomNav.prompt.md`, jakob 2026-10-06): the root a
 * post or someone's profile was opened from stays lit on the drill-in. A
 * Saved row, a History card, and your own profile's chronicle, belong to the
 * Profile stack (`from=saved`, `from=history`, `from=profile`); a search
 * result belongs to Explore's (`from=search`, BottomNav.prompt.md: "opened
 * from Explore lights Explore"); anything else — the feed, a link, a
 * notification — lights the Feed, where author chips and links land. A row
 * on your own opinions page belongs to the Profile stack too
 * (`from=opinions`, ProfileStances.md:27).
 */
export function detailRoot(from: string | null): NavSlot {
  if (from === "search") return "search";
  const opinions = parseOpinionsOrigin(from);
  if (opinions !== null) return opinions.handle === null ? "profile" : "feed";
  return from === "saved" || from === "history" || from === "profile" ? "profile" : "feed";
}

/** A person's opinions page under their drill-in (`ProfileStances`; `opinions-route.ts`). */
const OPINIONS_DRILL_IN = /^\/u\/[^/]+\/opinions$/;

/** The tab roots whose own slot, tapped there, the shell answers (the ladder). */
const ROOT_OF: Partial<Record<string, NavSlot>> = {
  "/explore": "search",
  "/wallet": "wallet",
  "/profile": "profile",
};

/**
 * Reads the detail's origin off the URL. `useSearchParams` opts its subtree
 * into client rendering up to the nearest Suspense boundary
 * (node_modules/next/dist/docs/.../use-search-params.md, "Prerendering"), so
 * the caller bounds it to the bar and hands the fallback the home root.
 */
function DetailBar({ bar }: { bar: (active: NavSlot) => ReactNode }) {
  return bar(detailRoot(useSearchParams().get("from")));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const phase = useAuthPhase();
  const pathname = usePathname();
  const signedIn = phase === "signedIn";
  const readSurface =
    pathname === "/feed" ||
    // Explore and the Wallet's door read for every viewer (Explore.md:35-39;
    // WalletComingSoon.md:5).
    pathname === "/explore" ||
    pathname === "/wallet" ||
    pathname.startsWith("/posts/") ||
    pathname.startsWith("/u/") ||
    // The score's trace reads for every viewer — guests open it (Main.md:67).
    pathname.startsWith("/trace/") ||
    // The own profile is a gated read surface: its frame waits for the
    // gate, which replaces a signed-out arrival with /login.
    (signedIn && pathname === "/profile") ||
    // The own opinions page rides the same gate (`ProfileStances`).
    (signedIn && pathname === "/profile/opinions") ||
    (signedIn && pathname === "/saved") ||
    (signedIn && pathname === "/history") ||
    (signedIn && pathname === "/notifications");
  const showBar = phase !== "resolving" && readSurface;
  // THE STREAM DRAWS ITS OWN BAR (Reel.jsx:147-149): the bar is inline on the
  // stream's dark ground, over the clip's frame, so the shell's is not drawn —
  // but a bar still stands beneath, and the pad parks above it.
  const streaming = pathname.startsWith("/reel/");
  // SAVED AND HISTORY KEEP PROFILE LIT (Saved.md, design digest item 51;
  // History.md:121: the originating root stays lit on a drill-in) — their one
  // door is the reader's own profile.
  // NOTIFICATIONS KEEPS LIT THE ROOT THE BELL WAS TAPPED ON (Notifications.md:27).
  const active =
    pathname === "/feed"
      ? "feed"
      : pathname === "/explore"
        ? "search"
        : pathname === "/wallet"
          ? "wallet"
          : pathname === "/profile" ||
              pathname === "/profile/opinions" ||
              pathname === "/saved" ||
              pathname === "/history"
            ? "profile"
            : pathname === "/notifications"
              ? ROOT_SLOT[notificationsOrigin(null)]
              : null;
  // The bar is drawn once, here, but its node belongs to the SCREEN it rides
  // (`design/designs/canonical/nodes.json` registers `feed.bottomBar`,
  // `postDetail.bottomBar`, `profile.bottomBar`, `saved.bottomBar`,
  // `history.bottomBar` and `wallet.bottomBar`), so the registered screens name it by route. Your
  // own profile and someone else's are one surface (`Profile`, `ProfileOther`: the `profile` prefix).
  const screen =
    pathname === "/feed"
      ? "feed"
      : pathname === "/explore"
        ? "explore"
        : /^\/posts\/[^/]+$/.test(pathname)
          ? "postDetail"
          : /^\/trace\/[^/]+$/.test(pathname)
            ? // The score's four levels share one prefix (nodes.json, round 7).
              "feedEntry"
          : pathname === "/profile" || /^\/u\/[^/]+$/.test(pathname)
            ? "profile"
            : pathname === "/saved"
              ? "saved"
              : pathname === "/history"
                ? "history"
                : pathname === "/notifications"
                  ? "notifications"
                  : pathname === "/wallet"
                    ? "wallet"
                    : null;
  // A drill-in — a post's detail or someone's profile — reads its origin off
  // the URL and keeps that root lit.
  // The score's trace is one too: it keeps lit the root its score was
  // tapped under (History and Saved keep Profile, the rest the Feed).
  const drillIn =
    screen === "postDetail" ||
    screen === "feedEntry" ||
    (screen === "profile" && pathname !== "/profile") ||
    // Someone's opinions page keeps lit what their profile did: its `from`
    // is the profile's own (ProfileStances.md:27). Unregistered, so the bar
    // keeps its own ids.
    OPINIONS_DRILL_IN.test(pathname);
  const scroller = useRef<HTMLDivElement>(null);
  const rootSlot = ROOT_OF[pathname];
  const reselectRoot = () => {
    if (scrollOffsetOf(scroller) > 0) scrollHostToTopAnimated(scroller);
  };
  const router = useRouter();
  const bar = (lit: NavSlot | null) => (
    <BottomNav
      active={lit}
      signedIn={signedIn}
      node={screen === null ? undefined : { path: `${screen}.bottomBar` }}
      // Over the feed's own root the Feed slot is a re-tap the feed
      // answers; from anywhere deeper it is the way back to the root,
      // which comes back at the scroll it was left (Feed.md:85).
      onReselectFeed={pathname === "/feed" ? announceFeedReselect : undefined}
      // Explore, the Wallet and Profile at their own root: scrolled, back to
      // the top; at the top, nothing (BottomNav.jsx; Explore.md:43;
      // WalletComingSoon.md:19-21). A standing search is Explore's root too
      // (Explore.md:9), so the tap there goes to the top of the results.
      reselect={rootSlot === undefined ? undefined : { [rootSlot]: reselectRoot }}
    />
  );
  return (
    <div className="flex h-full flex-col">
      {/* A kept pick's anchor opens its review through the router; acts that
          end by leaving confirm on the surface they land on (`carried-snackbar`). */}
      <KeptPicksNavigation navigate={router.push}>
      <ScrollHostProvider value={scroller}>
        <PadParkingProvider value={showBar || streaming}>
        <div
          ref={scroller}
          data-testid="app-scroller"
          className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden"
        >
          {children}
        </div>
        {showBar &&
          (drillIn ? (
            <Suspense fallback={bar(detailRoot(null))}>
              <DetailBar bar={bar} />
            </Suspense>
          ) : (
            bar(active)
          ))}
        </PadParkingProvider>
      </ScrollHostProvider>
      </KeptPicksNavigation>
      <CarriedSnackbar />
    </div>
  );
}
