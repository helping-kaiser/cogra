"use client";

// Chats — coming soon (backlog item 68, ruled 2026-09-14: chats moved
// down the release order, but the band law did not move with it, so the
// chats affordance stays on every root and this is what it opens). The
// board (design/designs/canonical/screens/ChatsComingSoon.jsx): a page
// header reading "Chats", the empty-state idiom carrying the blessed line
// (design/guidelines/copy-voice.md "The coming-soon surfaces"), and no
// action — nothing fills this one, not yet anything at all.
//
// Reachable only from the feed's chats affordance today (`cogra-band.tsx`
// is the one caller that passes `onChats`), so the back arrow's one
// destination is the feed.

import { EmptyState } from "@/lib/ui/empty-state";
import { PageHeader } from "@/lib/ui/page-header";

export function ChatsView() {
  return (
    <main className="flex w-full flex-col">
      <PageHeader
        title="Chats"
        backHref="/feed"
        backScroll={false}
        backLabel="Back to feed"
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
