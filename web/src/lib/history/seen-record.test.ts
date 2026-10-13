// @vitest-environment jsdom

// The device's seen record (PR-51, PR-52, OS-22; ranked-feed packet §4.3,
// §21 RF-G10): durable per account, a cache of the server's view log kept by
// a lazy delta sync. Test names are the packet's, shared with Android.

import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { failed, success, type Outcome } from "@/lib/api/outcome";
import type { SeenEntry, SeenPage } from "@/lib/api/history-api";
import { derive, type DeviceCuts, type HeldAnswer } from "@/lib/feed/derive";
import { SeenQueue } from "./seen-queue";
import { SeenRecord } from "./seen-record";
import { claimSync, forgetSeen, resetSeenSyncForTests, syncSeenRecord, type FetchSeenPage } from "./seen-sync";

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222";

let store: IDBFactory;
const record = () => new SeenRecord(() => store);

beforeEach(() => {
  store = new IDBFactory();
});

/** Settles the write-through the queue fires and forgets. */
const writesLand = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * A server view log, newest first, served in pages of `size` — and a count of
 * the reads made, which is what "only the delta" is measured by.
 */
function viewLog(entries: SeenEntry[], size = 2) {
  const reads: (string | null)[] = [];
  const fetchPage: FetchSeenPage = async (after) => {
    reads.push(after);
    const start = after === null ? 0 : Number(after);
    const items = entries.slice(start, start + size);
    const end = start + items.length;
    const page: SeenPage = {
      items,
      endCursor: items.length === 0 ? null : String(end),
      hasNextPage: end < entries.length,
    };
    return success(page);
  };
  return { fetchPage, reads };
}

/** Entries seen one minute apart, newest first. */
function seenAt(...ids: string[]): SeenEntry[] {
  const base = Date.parse("2026-10-13T12:00:00Z");
  return ids.map((id, i) => ({ id, firstSeenAt: new Date(base - i * 60_000).toISOString() }));
}

describe("the device's seen record", () => {
  it("a_restart_keeps_the_devices_seen_record", async () => {
    const before = record();
    await before.use(ACCOUNT_A);
    const queue = new SeenQueue((account, id) => void before.add(account, [id]));
    queue.belongTo(ACCOUNT_A);
    queue.see("p1");
    queue.see("p2");
    expect(before.has("p1")).toBe(true);
    await writesLand();

    // The tab closes; a new page load opens the same store.
    const after = record();
    expect(after.has("p1")).toBe(false);
    await after.use(ACCOUNT_A);
    expect(after.has("p1")).toBe(true);
    expect(after.has("p2")).toBe(true);
  });

  it("an_account_switch_keeps_each_accounts_record_apart", async () => {
    const seen = record();
    await seen.use(ACCOUNT_A);
    await seen.add(ACCOUNT_A, ["a-post"]);
    await seen.use(ACCOUNT_B);
    expect(seen.has("a-post")).toBe(false);
    await seen.add(ACCOUNT_B, ["b-post"]);
    await seen.use(ACCOUNT_A);
    expect(seen.has("a-post")).toBe(true);
    expect(seen.has("b-post")).toBe(false);
  });

  it("holds nothing without a session", async () => {
    const seen = record();
    await seen.use(ACCOUNT_A);
    await seen.add(ACCOUNT_A, ["p1"]);
    await seen.use(null);
    expect(seen.has("p1")).toBe(false);
    expect(seen.size).toBe(0);
  });

  // PR-50: the record is History's set, and History keeps the own profile out.
  it("never takes the reader's own profile", async () => {
    const seen = record();
    await seen.use(ACCOUNT_A);
    await seen.add(ACCOUNT_A, [ACCOUNT_A, "p1"]);
    expect(seen.has(ACCOUNT_A)).toBe(false);
    expect(seen.has("p1")).toBe(true);
  });

  it("a load that lands after the next account's never fills it", async () => {
    const seen = record();
    await seen.use(ACCOUNT_A);
    await seen.add(ACCOUNT_A, ["a-post"]);
    const fresh = record();
    const loadingA = fresh.use(ACCOUNT_A);
    const loadingB = fresh.use(ACCOUNT_B);
    await Promise.all([loadingA, loadingB]);
    expect(fresh.account).toBe(ACCOUNT_B);
    expect(fresh.has("a-post")).toBe(false);
  });
});

// jakob's ruling 2026-10-13: a don't-remember sign-out clears THAT account's
// record — ids and watermark — and no other account's on the browser.
describe("a don't-remember sign-out", () => {
  const seeded = async (seen: SeenRecord, account: string) => {
    await seen.use(account);
    await syncSeenRecord(seen, account, viewLog(seenAt(`${account}-p2`, `${account}-p1`)).fetchPage);
  };

  it("a_dont_remember_sign_out_clears_only_that_accounts_record", async () => {
    const seen = record();
    await seeded(seen, ACCOUNT_B);
    await seeded(seen, ACCOUNT_A);
    expect(seen.has(`${ACCOUNT_A}-p1`)).toBe(true);
    expect(await seen.watermark(ACCOUNT_A)).not.toBeNull();

    await forgetSeen(seen, ACCOUNT_A);

    // Gone from memory and from the disk — a restart finds nothing — with its watermark.
    expect(seen.has(`${ACCOUNT_A}-p1`)).toBe(false);
    expect(await seen.watermark(ACCOUNT_A)).toBeNull();
    const restarted = record();
    await restarted.use(ACCOUNT_A);
    expect(restarted.size).toBe(0);

    // The other account's record and watermark are untouched.
    await restarted.use(ACCOUNT_B);
    expect(restarted.has(`${ACCOUNT_B}-p1`)).toBe(true);
    expect(restarted.has(`${ACCOUNT_B}-p2`)).toBe(true);
    expect(await restarted.watermark(ACCOUNT_B)).not.toBeNull();
  });

  it("a_remembered_sign_out_keeps_the_record", async () => {
    const seen = record();
    await seeded(seen, ACCOUNT_A);

    // Ending the session without forgetting: the account leaves the held slot only.
    await seen.use(null);

    const restarted = record();
    await restarted.use(ACCOUNT_A);
    expect(restarted.has(`${ACCOUNT_A}-p1`)).toBe(true);
    expect(await restarted.watermark(ACCOUNT_A)).not.toBeNull();
  });

  it("a_forgotten_account_re_seeds_from_the_view_log_at_its_next_sign_in", async () => {
    resetSeenSyncForTests();
    const seen = record();
    const log = viewLog(seenAt("p2", "p1"));
    expect(claimSync(ACCOUNT_A)).toBe(true);
    await seeded(seen, ACCOUNT_A);

    await forgetSeen(seen, ACCOUNT_A);

    // The same page load signs the account back in: the sync claim is free again,
    // and with the watermark gone it reads the whole log from the top.
    expect(claimSync(ACCOUNT_A)).toBe(true);
    await seen.use(ACCOUNT_A);
    expect(await syncSeenRecord(seen, ACCOUNT_A, log.fetchPage)).toEqual({ kind: "done", pages: 1 });
    expect(log.reads).toEqual([null]);
    expect(seen.has("p1")).toBe(true);
  });
});

describe("the seen record's sync", () => {
  it("a_fresh_sign_in_seeds_the_seen_record_from_view_history_once", async () => {
    const log = viewLog(seenAt("p5", "p4", "p3", "p2", "p1"));
    const seen = record();
    await seen.use(ACCOUNT_A);

    // The first sync on an empty record is the whole list: the seed.
    expect(await syncSeenRecord(seen, ACCOUNT_A, log.fetchPage)).toEqual({ kind: "done", pages: 3 });
    for (const id of ["p1", "p2", "p3", "p4", "p5"]) expect(seen.has(id)).toBe(true);

    // The next open pages to the watermark: the seed never runs twice.
    log.reads.length = 0;
    expect(await syncSeenRecord(seen, ACCOUNT_A, log.fetchPage)).toEqual({ kind: "done", pages: 1 });
    expect(log.reads).toEqual([null]);
  });

  it("the_sync_pulls_only_the_delta_past_the_watermark", async () => {
    const seen = record();
    await seen.use(ACCOUNT_A);
    const older = seenAt("p4", "p3", "p2", "p1");
    await syncSeenRecord(seen, ACCOUNT_A, viewLog(older).fetchPage);

    // Three things seen elsewhere since, newer than everything held.
    const newer = seenAt("n3", "n2", "n1").map((entry) => ({
      ...entry,
      firstSeenAt: new Date(Date.parse(entry.firstSeenAt) + 10 * 60_000).toISOString(),
    }));
    // Pages of three: the delta, then the page that reaches the watermark
    // (the entry AT it is re-read, never trusted; the one below it stops).
    const log = viewLog([...newer, ...older], 3);
    expect(await syncSeenRecord(seen, ACCOUNT_A, log.fetchPage)).toEqual({ kind: "done", pages: 2 });
    expect(log.reads).toEqual([null, "3"]);
    for (const id of ["n1", "n2", "n3"]) expect(seen.has(id)).toBe(true);
  });

  it("a cut-short sync keeps what it read and leaves the watermark", async () => {
    const seen = record();
    await seen.use(ACCOUNT_A);
    const entries = seenAt("p4", "p3", "p2", "p1");
    let reads = 0;
    const flaky: FetchSeenPage = async (after) => {
      reads += 1;
      if (reads === 2) return failed(new Error("offline")) as Outcome<SeenPage>;
      return viewLog(entries).fetchPage(after);
    };
    expect((await syncSeenRecord(seen, ACCOUNT_A, flaky)).kind).toBe("failed");
    expect(seen.has("p4")).toBe(true);
    expect(await seen.watermark(ACCOUNT_A)).toBeNull();

    // The next open pages the whole way down again and finishes the seed.
    expect((await syncSeenRecord(seen, ACCOUNT_A, viewLog(entries).fetchPage)).kind).toBe("done");
    for (const id of ["p1", "p2", "p3", "p4"]) expect(seen.has(id)).toBe(true);
  });

  it("syncs each account once per page load", () => {
    expect(claimSync(ACCOUNT_A)).toBe(true);
    expect(claimSync(ACCOUNT_A)).toBe(false);
    expect(claimSync(ACCOUNT_B)).toBe(true);
  });

  it("a_thing_seen_on_one_device_is_cut_on_the_other_after_its_next_open", async () => {
    const held: HeldAnswer = {
      asOfEpoch: 3,
      entries: ["p1", "p2", "p3"].map((targetId, newestIndex) => ({
        targetId,
        kind: "POST",
        score: 1,
        mark: null,
        newestIndex,
      })),
      settling: [],
    };
    const cuts: DeviceCuts = {
      order: "ranked",
      showSeen: false,
      showSettling: true,
      people: "everyone",
      peopleSign: "either",
    };
    // This device has seen nothing; the phone saw p2.
    const desktop = record();
    await desktop.use(ACCOUNT_A);
    expect(derive(held, cuts, desktop).map((row) => row.targetId)).toEqual(["p1", "p2", "p3"]);

    await syncSeenRecord(desktop, ACCOUNT_A, viewLog(seenAt("p2")).fetchPage);
    expect(derive(held, cuts, desktop).map((row) => row.targetId)).toEqual(["p1", "p3"]);
  });
});
