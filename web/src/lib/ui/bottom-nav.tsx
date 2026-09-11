// The app's frame (design.md §6). Five slots left to right — feed, search,
// create post, wallet, profile — EACH ARRIVING WITH THE SLICE THAT BUILDS ITS
// SURFACE. The product ships three today: feed, the compose action, and
// profile. Explore waits for slice 2.7's search backend (readme §13, the audit
// answers: "no surface built against the exact-match lookup before it"), and
// the wallet waits for the wallet surfaces.
//
// The centre slot is the compose ACTION, not a destination — a deliberate
// deviation from M3's destinations-only navigation-bar guidance, accepted for
// the reach of the one gesture the product lives on. It wears
// `primaryContainer`, the one loud surface per screen.
//
// Every viewer gets the same shell: the bar shows for signed-in, applicant and
// anonymous viewers alike, and a slot that needs an account asks on an
// anonymous tap rather than yanking the read away.
//
// 64px band on `surfaceContainer`, hairline `outlineVariant` top border,
// safe-area padding at the bottom. Selection shows in COLOUR
// (`onSurfaceVariant` → `onSurface`) and in the filled icon cut — never an
// indicator pill.
//
// THE BAND IS IN FLOW, and the shell is what pins it: it is the last child of
// a viewport-tall column whose middle scrolls (`shell.tsx`), so it needs no
// coordinates of its own. It was `fixed bottom-0` before, which a mobile
// browser lays out against a layout viewport taller than the visible one and
// so pushed the bar under the fold on any page long enough to scroll.
// `flex-none` is the whole instruction: never give away height to the
// scroller beside it.

import Link from "next/link";
import { useState } from "react";

import { Icon, type GlyphName } from "@/lib/ui/icons";
import { JoinPrompt } from "@/lib/ui/join-prompt";

export type NavSlot = "feed" | "search" | "compose" | "wallet" | "profile";

/** Where the bar is going, once Explore and the wallet have surfaces. */
export const ALL_SLOTS: readonly NavSlot[] = [
  "feed",
  "search",
  "compose",
  "wallet",
  "profile",
];

/** The slots whose surfaces exist. A slot arrives WITH its surface. */
export const SHIPPED_SLOTS: readonly NavSlot[] = ["feed", "compose", "profile"];

// The discovery slot is keyed `search` (its route, its glyph) but READS
// "Explore": implementation vocabulary stays off the screen, and "Explore" says
// what the reader is doing — discovery through the people they're connected to,
// rather than a global index.
const LABELS: Record<NavSlot, string> = {
  feed: "Feed",
  search: "Explore",
  compose: "New post",
  wallet: "Wallet",
  profile: "Profile",
};

// A slot arrives with its surface, and so does its glyph: `search` and `wallet`
// are exported in the design's set and stay unshipped here until the surfaces
// they name exist, rather than sitting in the tree unreachable.
const GLYPHS: Partial<Record<NavSlot, GlyphName>> = {
  feed: "dynamic_feed",
};

/** A slot with no destination is one whose surface has not shipped. */
const DESTINATIONS: Partial<Record<NavSlot, string>> = {
  feed: "/feed",
  compose: "/compose",
  profile: "/profile",
};

// Five labelled slots on a narrow phone: the label shortens rather than
// wrapping to a second line, which would push the bar past 64px.
const ITEM =
  "cg-state cg-focus flex min-w-0 flex-1 flex-col items-center gap-1 truncate rounded-medium px-0.5 py-2 text-label-medium";

export function BottomNav({
  active,
  signedIn,
  slots = SHIPPED_SLOTS,
}: {
  active: NavSlot | null;
  signedIn: boolean;
  /** Defaults to the shipped three; pass more as their surfaces land. */
  slots?: readonly NavSlot[];
}) {
  const [prompting, setPrompting] = useState(false);
  const tone = (selected: boolean) =>
    selected ? "text-on-surface" : "text-on-surface-variant";

  return (
    <nav
      data-testid="bottom-nav"
      aria-label="Main"
      className="z-10 flex min-h-[var(--bottom-bar-height)] flex-none border-t border-outline-variant bg-surface-container pb-[env(safe-area-inset-bottom)]"
    >
      {slots.map((slot) => {
        const href = DESTINATIONS[slot];
        if (href === undefined) return null;
        const selected = active === slot;
        const testId = `nav-${slot}`;

        const body =
          slot === "compose" ? (
            <span
              aria-hidden
              className="flex size-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container"
            >
              <Icon name="add" />
            </span>
          ) : (
            <>
              <Icon
                name={
                  slot === "profile"
                    ? selected
                      ? "person"
                      : "person_outline"
                    : (GLYPHS[slot] ?? "person_outline")
                }
              />
              {LABELS[slot]}
            </>
          );

        // A slot that needs an account asks on an anonymous tap; the feed is
        // readable without one, so it stays a link for every viewer.
        if (!signedIn && slot !== "feed") {
          return (
            <button
              key={slot}
              type="button"
              data-testid={testId}
              aria-label={slot === "compose" ? LABELS.compose : undefined}
              onClick={() => setPrompting(true)}
              className={`${ITEM} ${slot === "compose" ? "" : tone(false)}`}
            >
              {body}
            </button>
          );
        }

        return (
          <Link
            key={slot}
            href={href}
            // A tab that remembers where its reader was restores that place
            // itself (`feed-memory.ts`), and Next scrolling to the first Page
            // element would land on top of the restore (Next `link.md`,
            // "scroll"). The tabs that remember nothing yet keep the default.
            scroll={slot === "feed" ? false : undefined}
            data-testid={testId}
            aria-label={slot === "compose" ? LABELS.compose : undefined}
            aria-current={selected ? "page" : undefined}
            className={`${ITEM} ${slot === "compose" ? "" : tone(selected)}`}
          >
            {body}
          </Link>
        );
      })}
      <JoinPrompt open={prompting} onClose={() => setPrompting(false)} />
    </nav>
  );
}
