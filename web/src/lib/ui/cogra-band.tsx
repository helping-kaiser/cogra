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
// It sits LEFT of the screen's own trailing control, so the ruled corner
// occupants keep their edge. It renders only where it leads somewhere: the chat
// surface is an undesigned gap on the canvas (`graph.json`, the `chats` edge),
// so no tab passes `onChats` yet and the band draws no control to nowhere.

import type { ReactNode } from "react";

import { Icon } from "@/lib/ui/icons";

export function CograBand({
  trailing,
  onChats,
  chatsLabel = "Chats",
  children,
}: {
  trailing?: ReactNode;
  /** Omitted until the chat surface exists. */
  onChats?: () => void;
  chatsLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex-none" data-testid="cogra-band">
      <div className="flex h-12 items-center gap-2 px-4">
        <span aria-hidden className="inline-flex text-primary">
          <Icon name="mark" pickColor="var(--primary-container)" />
        </span>
        {/* The wordmark, not a page title: §6 governs the mark, and its weight
            is the mark's own rather than a rung of the type ramp. */}
        <span className="text-title-large font-semibold">cogra</span>
        <div className="ml-auto flex min-w-0 items-center">
          {onChats !== undefined && (
            <button
              type="button"
              data-testid="band-chats"
              aria-label={chatsLabel}
              onClick={onChats}
              className="cg-state cg-focus grid size-12 flex-none place-items-center rounded-full text-on-surface-variant"
            >
              <Icon name="forum" size={22} />
            </button>
          )}
          {trailing}
        </div>
      </div>
      {children}
    </div>
  );
}
