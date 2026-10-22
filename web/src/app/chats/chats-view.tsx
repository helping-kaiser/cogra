"use client";

// Chats — coming soon (backlog item 68, ruled 2026-09-14: chats moved
// down the release order, but the band law did not move with it, so the
// chats affordance stays on every root and this is what it opens). The
// board (design/designs/canonical/screens/ChatsComingSoon.jsx): a page
// header reading "Chats", the empty-state idiom carrying the blessed line
// (design/guidelines/copy-voice.md "The coming-soon surfaces"), and no
// action — nothing fills this one, not yet anything at all.
//
// Reached from a root band's chats affordance (the feed's, your own
// profile's) and from a profile's Message; the back arrow names where it was
// opened from (ChatsComingSoon.md:15-17), the feed when nothing says.

import { EmptyState } from "@/lib/ui/empty-state";
import { backFor } from "@/lib/ui/back-origin";
import { PageHeader } from "@/lib/ui/page-header";

export function ChatsView({ from = null }: { from?: string | null }) {
  const back = backFor(from);
  return (
    <main className="flex w-full flex-col">
      <PageHeader
        title="Chats"
        backHref={back.href}
        backScroll={false}
        backLabel={back.label}
        backTestId="chats-back"
      />
      <div className="flex flex-col px-6 py-2">
        <EmptyState
          testId="chats-empty"
          title="Chats — coming soon. Your conversations will be here."
        />
      </div>
    </main>
  );
}
