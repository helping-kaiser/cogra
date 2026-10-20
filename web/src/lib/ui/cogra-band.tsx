// The read shell's top-left identity (design/components/navigation/CograBand.jsx):
// the mark and the wordmark on a 48px band. Every TAB ROOT wears it — a tab
// root carries no back arrow, so `PageHeader` is the inner surfaces' header and
// this is the roots'. Children ride below the band inside the same
// non-shrinking block: the borrowed-view band, the APK line, a search field.
//
// THE RIGHT SIDE WORKS. A full-width band spent on identity alone is wasted
// space (ruled 2026-08-28), so `trailing` puts the tab's one working control —
// the feed's filter trigger, the profile's gear — on the band's right edge. The
// whole band scrolls away with the top region and returns with it.
//
// CHATS RIDE THE BAND (jakob 2026-09-01): messaging must be reachable from any
// major screen, so the affordance belongs to the band rather than to each tab.
// It stands between the screen's own control and the bell (ChatsComingSoon.md:3;
// Profile.md:3) — the bell keeps the corner. It renders only where it leads somewhere: a tab
// that passes no `onChats` draws no control to nowhere. Every root eventually
// wires one (`graph.json`, the `chats` edge) — today that is the feed, reaching
// the coming-soon destination (backlog item 68, ruled 2026-09-14).

//
// THE DELETION BAND RIDES HERE ON A ROOT (FeedDeleting.md:5): first in the
// block below the 48px line, so it collapses and returns with the band
// instead of scrolling out of the reader's life.

import type { ReactNode } from "react";

import { DeletionBandSlot } from "@/lib/deletion/deletion-status";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon } from "@/lib/ui/icons";

/**
 * The bell (CograBand.jsx `bell`/`unread`; FeedUnread.md): right-most on every
 * signed-in root band, a dot and never a count, and its accessible name says
 * when the dot is lit. A guest has no list, so a guest's band passes none.
 */
export type BandBell = {
  readonly lit: boolean;
  readonly onOpen: () => void;
};

/** FeedUnread.md:13, :15. */
export const BELL_LABEL = "Notifications";
export const BELL_LABEL_LIT = "Notifications — something new";

export function CograBand({
  trailing,
  onChats,
  chatsLabel = "Chats",
  bell,
  children,
  node,
  deletionBandNode,
}: {
  /** The registered deletion band on a registered root (`feed.deletionBand`). */
  deletionBandNode?: DataNode;
  trailing?: ReactNode;
  /** Omitted until the chat surface exists. */
  onChats?: () => void;
  chatsLabel?: string;
  /** Omitted for a guest, and while the phase resolves. */
  bell?: BandBell;
  children?: ReactNode;
  /**
   * The registered band node on a registered screen (`feed.band`): the 48px
   * line is the node, and its mark, wordmark and chats control are its parts.
   * The block around it — the band plus what rides below — keeps `cogra-band`.
   */
  node?: DataNode;
}) {
  return (
    <div className="flex-none" data-testid="cogra-band">
      <div className="flex h-12 items-center gap-2 px-4" {...testAttributes(node)}>
        <span aria-hidden className="inline-flex text-primary" {...testAttributes(part(node, "mark"))}>
          <Icon name="mark" pickColor="var(--primary-container)" />
        </span>
        {/* The wordmark, not a page title: §6 governs the mark, and its weight
            is the mark's own rather than a rung of the type ramp. */}
        <span className="text-title-large font-semibold" {...testAttributes(part(node, "wordmark"))}>
          cogra
        </span>
        {/* THE CLUSTER READS the screen's own control, then chats, then the
            bell (Profile.md:3; ChatsComingSoon.md:3): the bell keeps the
            band's right edge on every root. */}
        <div className="ml-auto flex min-w-0 items-center">
          {trailing}
          {onChats !== undefined && (
            <button
              type="button"
              {...testAttributes(part(node, "chats"), "band-chats")}
              aria-label={chatsLabel}
              onClick={onChats}
              className="cg-state cg-focus grid size-12 flex-none place-items-center rounded-full text-on-surface-variant"
            >
              <Icon name="forum" size={22} />
            </button>
          )}
          {bell !== undefined && <BellButton bell={bell} node={part(node, "bell")} />}
        </div>
      </div>
      <DeletionBandSlot node={deletionBandNode} />
      {children}
    </div>
  );
}

/**
 * The bell itself (`BandIcon` with `dot`): the dot is `--primary` at 8px,
 * ringed in the surface, and it is the button's name that says so — the
 * drawing is hidden from assistive tech. Exported for headers that are not a
 * band yet but are a root's (the own profile's).
 */
export function BellButton({ bell, node }: { bell: BandBell; node?: DataNode }) {
  return (
    <button
      type="button"
      {...testAttributes(node, "band-bell")}
      aria-label={bell.lit ? BELL_LABEL_LIT : BELL_LABEL}
      onClick={bell.onOpen}
      className="cg-state cg-focus grid size-12 flex-none place-items-center rounded-full text-on-surface-variant"
    >
      <span className="relative grid place-items-center">
        <Icon name="notifications" size={22} />
        {bell.lit && (
          <span
            aria-hidden
            {...testAttributes(part(node, "dot"), "band-bell-dot")}
            className="absolute -right-0.5 -top-px box-content size-2 rounded-full border-2 border-surface bg-primary"
          />
        )}
      </span>
    </button>
  );
}
