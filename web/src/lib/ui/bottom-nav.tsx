// The shell's bottom bar (design.md §6): five slots left to right —
// feed, search, create post, wallet, profile — each arriving with the
// slice that builds its surface; this slice ships feed, the compose
// action, and profile. The center slot is an action, not a
// destination — the decided deviation from M3's destinations-only
// navigation-bar guidance — and wears primary-container, the one loud
// surface per screen (design.md §2.4). Every viewer gets the same
// bar; a slot that needs an account routes a signed-out tap to the
// front door instead.

import Link from "next/link";

import { AddIcon, DynamicFeedIcon, PersonIcon } from "@/lib/ui/icons";

export function BottomNav({
  active,
  signedIn,
}: {
  active: "feed" | "profile" | null;
  signedIn: boolean;
}) {
  const item = "flex flex-1 flex-col items-center gap-1 py-2 text-label-medium";
  const tone = (selected: boolean) =>
    selected ? "text-on-surface" : "text-on-surface-variant";
  return (
    <nav
      data-testid="bottom-nav"
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-outline-variant bg-surface-container pb-[env(safe-area-inset-bottom)]"
    >
      <Link
        href="/feed"
        data-testid="nav-feed"
        aria-current={active === "feed" ? "page" : undefined}
        className={`${item} ${tone(active === "feed")}`}
      >
        <DynamicFeedIcon />
        Feed
      </Link>
      <Link
        href={signedIn ? "/compose" : "/"}
        data-testid="nav-compose"
        aria-label="New post"
        className={item}
      >
        <span
          aria-hidden
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container"
        >
          <AddIcon />
        </span>
      </Link>
      <Link
        href={signedIn ? "/profile" : "/"}
        data-testid="nav-profile"
        aria-current={active === "profile" ? "page" : undefined}
        className={`${item} ${tone(active === "profile")}`}
      >
        <PersonIcon filled={active === "profile"} />
        Profile
      </Link>
    </nav>
  );
}
