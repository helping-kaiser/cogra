// The app's frame (design.md §6; design/components/navigation/BottomNav.jsx).
// Five slots left to right — feed, search, create post, wallet, profile — and
// V1.0 carries all five (readme §13, *The V1.0 scope cut*): Explore is the
// search slot's surface, and the wallet slot opens its coming-soon door
// (`WalletComingSoon`) — a thinner bar reads wrong, and re-adding a slot later
// costs every reader the muscle memory twice.
//
// The centre slot is the compose ACTION, not a destination — a deliberate
// deviation from M3's destinations-only navigation-bar guidance, accepted for
// the reach of the one gesture the product lives on. It wears
// `primaryContainer`, the one loud surface per screen.
//
// Every viewer gets the same shell: the bar shows for signed-in, applicant and
// anonymous viewers alike, and a slot that needs an account asks on an
// anonymous tap rather than yanking the read away. Feed, Explore and the
// Wallet's door need none (Explore.md:35-37; WalletComingSoon.md:5, :15):
// only New post and Profile ask.
//
// THE SLOTS ARE RE-ENTRY POINTS (BottomNav.jsx; readme §13, the re-tap
// ladder): another tab comes back as it was left, and the active tab tapped
// at its own root is the root's to answer — `reselect` hands the tap to it
// instead of navigating to where the reader already stands.
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

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon, type GlyphName } from "@/lib/ui/icons";
import { JoinPrompt } from "@/lib/ui/join-prompt";

export type NavSlot = "feed" | "search" | "compose" | "wallet" | "profile";

/** The V1.0 bar: all five slots (BottomNav.jsx `ALL_SLOTS`). */
export const ALL_SLOTS: readonly NavSlot[] = [
  "feed",
  "search",
  "compose",
  "wallet",
  "profile",
];

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

// The glyphs (BottomNav.jsx `GLYPHS`); profile takes its two cuts below.
const GLYPHS: Partial<Record<NavSlot, GlyphName>> = {
  feed: "dynamic_feed",
  search: "search",
  wallet: "wallet",
};

/** Where each slot leads: its tab's root, or the compose action. */
const DESTINATIONS: Record<NavSlot, string> = {
  feed: "/feed",
  search: "/explore",
  compose: "/compose",
  wallet: "/wallet",
  profile: "/profile",
};

/** The slots a reader without an account may take: the reads (Feed, Explore) and the Wallet's door. */
const OPEN_TO_GUESTS: readonly NavSlot[] = ["feed", "search", "wallet"];

// TEXT SCALE IS NEVER CAPPED (`BottomNav.jsx`; readme §4 *Type*, K13.4): above
// 1.3× a label may wrap to a second line, and the bar grows past its 64px
// minimum to hold it — a label is never shortened to an ellipsis.
const ITEM =
  "cg-state cg-focus flex min-w-0 flex-1 flex-col items-center gap-1 whitespace-normal break-words rounded-medium px-0.5 py-2 text-center text-label-medium";

export function BottomNav({
  active,
  signedIn,
  slots = ALL_SLOTS,
  node,
  onReselectFeed,
  reselect = {},
}: {
  active: NavSlot | null;
  signedIn: boolean;
  /**
   * THE FEED SLOT TAPPED OVER THE FEED'S OWN ROOT (Feed.md:81-91): the tap
   * stays on the page and the feed answers it — to the top, or a refresh
   * there. Absent anywhere else, where the slot is the plain way to the feed.
   */
  onReselectFeed?: () => void;
  /**
   * THE ACTIVE TAB TAPPED AT ITS OWN ROOT (BottomNav.jsx, the ladder): the
   * root answers — scrolled, back to its top; at the top, nothing
   * (Explore.md:43; WalletComingSoon.md:19-21). Keyed by slot; absent, the
   * slot is the plain way to its root.
   */
  reselect?: Partial<Record<NavSlot, () => void>>;
  /** The V1.0 bar's five by default (BottomNav.jsx `ALL_SLOTS`). */
  slots?: readonly NavSlot[];
  /**
   * The registered bar node of the screen it rides (`feed.bottomBar`); each
   * slot is then its `<slot>Slot` part. A screen not registered yet passes
   * none and the bar keeps its own ids.
   */
  node?: DataNode;
}) {
  const [prompting, setPrompting] = useState(false);
  const tone = (selected: boolean) =>
    selected ? "text-on-surface" : "text-on-surface-variant";

  return (
    <nav
      {...testAttributes(node, "bottom-nav")}
      aria-label="Main"
      className="z-10 flex min-h-[var(--bottom-bar-height)] flex-none border-t border-outline-variant bg-surface-container pb-[env(safe-area-inset-bottom)]"
    >
      {slots.map((slot) => {
        const href = DESTINATIONS[slot];
        const onReselect = slot === "feed" ? (onReselectFeed ?? reselect.feed) : reselect[slot];
        const selected = active === slot;
        const ids = testAttributes(part(node, `${slot}Slot`), `nav-${slot}`);

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

        // A slot that needs an account asks on an anonymous tap; the reads and
        // the Wallet's door stay links for every viewer.
        if (!signedIn && !OPEN_TO_GUESTS.includes(slot)) {
          return (
            <button
              key={slot}
              type="button"
              {...ids}
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
            // itself (`feed-memory.ts`; Explore's `exploreMemory`), and Next scrolling to the first Page
            // element would land on top of the restore (Next `link.md`,
            // "scroll"). The tabs that remember nothing yet keep the default.
            scroll={slot === "feed" || slot === "search" ? false : undefined}
            onClick={
              onReselect !== undefined
                ? (event) => {
                    event.preventDefault();
                    onReselect();
                  }
                : undefined
            }
            {...ids}
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
