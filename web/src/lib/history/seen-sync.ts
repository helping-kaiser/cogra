// THE SEEN RECORD'S SYNC (PR-52; OS-22's cadence): the device record is a
// cache of the server's view log, kept fresh by a LAZY DELTA SYNC.
//
// - WHAT: page the reader's own `viewHistory` newest-first until the
//   WATERMARK — the newest first-seeing this device has already taken in.
//   The first sync on an empty record has no watermark, so it pages the whole
//   list: that IS the one-time seed (OS-22), newest pages first so the first
//   feed's cut is right for recent seeing. Every later sync is typically one
//   page.
// - WHEN: at app open and at sign-in — once per account per page load — and
//   never on the feed path, never per fetch (jakob's "little refetching").
//   Seeing on another device mid-session waits for this device's next open:
//   the accepted MVP looseness.
// - HOW FAR IT TRUSTS ITSELF: the watermark moves only when a sync reaches it
//   (or the list's end). A sync cut short keeps every page it took in — the
//   ids are already written — but leaves the watermark where it was, so the
//   next open pages down to it again and nothing between is skipped.
//
// The stop compares instants as instants, never as strings: two renderings
// of one instant must not read as two. An entry exactly AT the watermark is
// taken again rather than trusted (the keyset breaks ties on the id, which
// the device does not order by); re-adding an id is a no-op.

import type { Outcome } from "@/lib/api/outcome";
import type { SeenPage } from "@/lib/api/history-api";
import type { SeenRecord } from "./seen-record";

export type FetchSeenPage = (after: string | null) => Promise<Outcome<SeenPage>>;

/** What a sync came to. `pages` is how many reads it made. */
export type SyncResult = { readonly kind: "done" | "failed"; readonly pages: number };

// The accounts this page load has already synced (or is syncing): the sync
// runs once per account per load, at its first open or sign-in.
let claimed = new Set<string>();

/** True the first time `account` asks in this page load, false after. */
export function claimSync(account: string): boolean {
  if (claimed.has(account)) return false;
  claimed.add(account);
  return true;
}

/** Forget every claim — module state, reset per test. */
export function resetSeenSyncForTests(): void {
  claimed = new Set();
}

function instant(at: string): number {
  return Date.parse(at);
}

/** Brings `account`'s record up to the server's view log. */
export async function syncSeenRecord(
  record: SeenRecord,
  account: string,
  fetchPage: FetchSeenPage,
): Promise<SyncResult> {
  const mark = await record.watermark(account);
  const floor = mark === null ? null : instant(mark);
  let newest: string | null = null;
  let after: string | null = null;
  let pages = 0;
  for (;;) {
    const page = await fetchPage(after);
    pages += 1;
    if (page.kind !== "success") return { kind: "failed", pages };
    const fresh: string[] = [];
    let reached = false;
    for (const item of page.value.items) {
      newest ??= item.firstSeenAt;
      if (floor !== null && instant(item.firstSeenAt) < floor) {
        reached = true;
        break;
      }
      fresh.push(item.id);
    }
    try {
      await record.add(account, fresh);
    } catch {
      // Not durable this time: the watermark stays, so the next open re-reads.
      return { kind: "failed", pages };
    }
    if (reached || !page.value.hasNextPage || page.value.endCursor === null) break;
    after = page.value.endCursor;
  }
  if (newest !== null && (floor === null || instant(newest) >= floor)) {
    try {
      await record.setWatermark(account, newest);
    } catch {
      return { kind: "failed", pages };
    }
  }
  return { kind: "done", pages };
}
