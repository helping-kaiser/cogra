"use client";

// The app shell (design.md §6): one frame for every viewer — the
// bottom bar shows signed in or out, its account-needing slots
// prompting at the front door. Signed out it frames the public read
// tier; the front door and auth surfaces stand alone, and while the
// phase resolves it stays off so it never flashes. Rendered from the
// root layout so it wraps the public tier and the (app) group alike;
// the auth gate stays where it is.

import { usePathname } from "next/navigation";

import { useAuthPhase } from "@/lib/session/provider";
import { BottomNav } from "@/lib/ui/bottom-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const phase = useAuthPhase();
  const pathname = usePathname();
  const signedIn = phase === "signedIn";
  const publicReadSurface =
    pathname === "/feed" ||
    pathname.startsWith("/posts/") ||
    pathname.startsWith("/u/");
  const showBar = signedIn || (phase === "signedOut" && publicReadSurface);
  const active =
    pathname === "/feed" ? "feed" : pathname === "/profile" ? "profile" : null;
  return (
    <div
      className={`flex min-h-full flex-1 flex-col ${
        showBar ? "pb-[calc(4rem+env(safe-area-inset-bottom))]" : ""
      }`}
    >
      {children}
      {showBar && <BottomNav active={active} signedIn={signedIn} />}
    </div>
  );
}
