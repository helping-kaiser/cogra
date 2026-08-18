"use client";

// The app shell (design.md §6): the bottom bar frames the signed-in
// surfaces — anonymous viewers browse the public read pages without
// it. Rendered from the root layout so it wraps the public tier and
// the (app) group alike; the auth gate stays where it is.

import { usePathname } from "next/navigation";

import { useAuthPhase } from "@/lib/session/provider";
import { BottomNav } from "@/lib/ui/bottom-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const phase = useAuthPhase();
  const pathname = usePathname();
  const signedIn = phase === "signedIn";
  const active =
    pathname === "/feed" ? "feed" : pathname === "/profile" ? "profile" : null;
  return (
    <div
      className={`flex min-h-full flex-1 flex-col ${
        signedIn ? "pb-[calc(4rem+env(safe-area-inset-bottom))]" : ""
      }`}
    >
      {children}
      {signedIn && <BottomNav active={active} />}
    </div>
  );
}
