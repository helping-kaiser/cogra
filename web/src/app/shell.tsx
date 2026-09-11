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

import { usePathname } from "next/navigation";
import { useRef } from "react";

import { useAuthPhase } from "@/lib/session/provider";
import { BottomNav } from "@/lib/ui/bottom-nav";
import { ScrollHostProvider } from "@/lib/ui/scroll-host";

export function AppShell({ children }: { children: React.ReactNode }) {
  const phase = useAuthPhase();
  const pathname = usePathname();
  const signedIn = phase === "signedIn";
  const readSurface =
    pathname === "/feed" ||
    pathname.startsWith("/posts/") ||
    pathname.startsWith("/u/") ||
    // The own profile is a gated read surface: its frame waits for the
    // gate, which replaces a signed-out arrival with /login.
    (signedIn && pathname === "/profile");
  const showBar = phase !== "resolving" && readSurface;
  const active =
    pathname === "/feed" ? "feed" : pathname === "/profile" ? "profile" : null;
  const scroller = useRef<HTMLDivElement>(null);
  return (
    <div className="flex h-full flex-col">
      <ScrollHostProvider value={scroller}>
        <div
          ref={scroller}
          data-testid="app-scroller"
          className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden"
        >
          {children}
        </div>
        {showBar && <BottomNav active={active} signedIn={signedIn} />}
      </ScrollHostProvider>
    </div>
  );
}
