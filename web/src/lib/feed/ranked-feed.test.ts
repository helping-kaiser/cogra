// The held ranking (ranked-feed packet CD-1, CD-2, CD-9, §5.1's fill rule):
// when it ranks, what it hydrates, and what the off-feed lookup reads.

import { describe, expect, it } from "vitest";

import type { FeedItemView } from "@/lib/api/feed-api";
import { failed, success, type Outcome } from "@/lib/api/outcome";
import type { HeldAnswer, SeenLookup } from "./derive";
import { FEED_FILTER_DEFAULT, type RankArguments } from "./feed-filter";
import { FEED_WINDOW, RankedFeed, type FeedIo } from "./ranked-feed";

function answerOf(ids: string[], settling: string[] = []): HeldAnswer {
  return {
    asOfEpoch: 9,
    entries: ids.map((targetId, index) => ({
      targetId,
      kind: "POST",
      score: 1 - index / 100,
      mark: null,
      newestIndex: ids.length - 1 - index,
    })),
    settling: settling.map((targetId, index) => ({
      targetId,
      kind: "POST",
      mark: null,
      rankedPosition: index,
      newestPosition: index,
    })),
  };
}

/** The derived list top to bottom: above the seen line, then under it. */
function rowIds(feed: RankedFeed): string[] {
  return [...feed.derived.head, ...feed.derived.tail].map((row) => row.targetId);
}

function postItem(id: string): FeedItemView {
  return { __typename: "Post", id } as unknown as FeedItemView;
}

/** A fake of the feed's reads, recording every call. */
function io(answers: (HeldAnswer | "fault")[], seen: Set<string> = new Set()) {
  const ranks: RankArguments[] = [];
  const windows: string[][] = [];
  let next = 0;
  const reads: FeedIo = {
    resolveViewer: async () => success("viewer-1"),
    rank: async (_viewer, args) => {
      ranks.push(args);
      const answer = answers[Math.min(next, answers.length - 1)]!;
      next += 1;
      return answer === "fault" ? (failed(new Error("pod down")) as Outcome<never>) : success(answer);
    },
    hydrate: async (ids) => {
      windows.push([...ids]);
      // A Comment row draws no card yet; "gone" is an expired pending write.
      return success(
        ids
          .filter((id) => id !== "gone")
          .map((id) =>
            id.startsWith("c") ? ({ __typename: "Comment", id } as unknown as FeedItemView) : postItem(id),
          ),
      );
    },
    seen: async (): Promise<SeenLookup> => seen,
  };
  return { reads, ranks, windows };
}

describe("the held ranking", () => {
  it("a_local_rederive_keeps_the_pin_and_the_lookup_source", async () => {
    const fake = io([answerOf(["a", "b", "c"])]);
    const feed = new RankedFeed("reader-1");
    await feed.refresh(fake.reads);
    const held = feed.answer;

    const done = await feed.done({ ...FEED_FILTER_DEFAULT, order: "newest" }, fake.reads);
    expect(done).toEqual(success("rederive"));
    expect(fake.ranks).toHaveLength(1);
    expect(feed.answer).toBe(held);
    expect(feed.answer?.asOfEpoch).toBe(9);
    expect(rowIds(feed)).toEqual(["c", "b", "a"]);
  });

  it("an_off_feed_lookup_reads_the_uncut_held_list", async () => {
    const fake = io([answerOf(["a", "b"])]);
    const feed = new RankedFeed("reader-1", {
      ...FEED_FILTER_DEFAULT,
      people: "yourPeople",
      peopleSign: "either",
    });
    await feed.refresh(fake.reads);
    // Nothing is marked, so Your people cuts every row from the list shown…
    expect(rowIds(feed)).toEqual([]);
    // …and the lookup still hits.
    expect(feed.lookup("a")?.score).toBe(1);
  });

  it("a_seen_thing_hits_its_lookup", async () => {
    const fake = io([answerOf(["a", "b"])], new Set(["a"]));
    const feed = new RankedFeed("reader-1");
    await feed.refresh(fake.reads);
    expect(rowIds(feed)).toEqual(["b", "a"]);
    expect(feed.lookup("a")).toBeDefined();
  });

  // THE SEEN TAIL (PR-80, FeedSeenTail.md): the windows run down the unseen
  // rows, then on into the seen ones, and each says which ids stand under the
  // separator — the list it was cut from, not the record as it stands later.
  it("the_windows_run_on_into_the_seen_tail_and_name_it", async () => {
    const seen = new Set(["a"]);
    const fake = io([answerOf(["a", "b", "d"])], seen);
    const feed = new RankedFeed("reader-1");
    await feed.refresh(fake.reads);
    const first = await feed.window(0, fake.reads);
    expect(first.kind === "success" && first.value.items.map((item) => item.id)).toEqual(["b", "d", "a"]);
    expect(first.kind === "success" && [...first.value.seenTail]).toEqual(["a"]);
    seen.add("b");
    expect([...feed.seenTail]).toEqual(["a"]);
  });

  it("an_off_feed_miss_reads_the_dash", async () => {
    const feed = new RankedFeed("reader-1");
    await feed.refresh(io([answerOf(["a"])]).reads);
    expect(feed.lookup("elsewhere")).toBeUndefined();
  });

  it("a_settling_thing_is_never_looked_up", async () => {
    const feed = new RankedFeed("reader-1");
    await feed.refresh(io([answerOf(["a"], ["s"])]).reads);
    expect(rowIds(feed)).toEqual(["s", "a"]);
    expect(feed.lookup("s")).toBeUndefined();
  });

  it("the_lookup_source_is_replaced_at_every_fetch", async () => {
    const fake = io([answerOf(["a"]), answerOf(["b"])]);
    const feed = new RankedFeed("reader-1");
    await feed.refresh(fake.reads);
    expect(feed.lookup("a")).toBeDefined();
    await feed.refresh(fake.reads);
    expect(feed.lookup("a")).toBeUndefined();
    expect(feed.lookup("b")).toBeDefined();
  });

  it("a failed ranking keeps the held answer, its list and its filter", async () => {
    const fake = io([answerOf(["a"]), "fault"]);
    const feed = new RankedFeed("reader-1");
    await feed.refresh(fake.reads);
    const done = await feed.done({ ...FEED_FILTER_DEFAULT, kinds: ["comments"] }, fake.reads);
    expect(done.kind).toBe("failed");
    expect(feed.filter).toEqual(FEED_FILTER_DEFAULT);
    expect(rowIds(feed)).toEqual(["a"]);
  });

  it("a_window_of_only_filtered_rows_loads_the_next", async () => {
    const ids = [
      ...Array.from({ length: FEED_WINDOW }, (_, i) => `c${i}`),
      "p-after",
    ];
    const fake = io([answerOf(ids)]);
    const feed = new RankedFeed("reader-1");
    await feed.refresh(fake.reads);
    const first = await feed.window(0, fake.reads);
    expect(first).toEqual(
      success({ items: [postItem("p-after")], next: FEED_WINDOW + 1, hasMore: false, seenTail: new Set() }),
    );
    expect(fake.windows.map((window) => window.length)).toEqual([FEED_WINDOW, 1]);
  });

  it("a_page_of_only_hidden_posts_loads_the_next", async () => {
    const ids = [...Array.from({ length: FEED_WINDOW }, (_, i) => `h${i}`), "p-after"];
    const fake = io([answerOf(ids)]);
    const reads: FeedIo = { ...fake.reads, hides: (item) => item.id.startsWith("h") };
    const feed = new RankedFeed("reader-1");
    await feed.refresh(reads);
    const first = await feed.window(0, reads);
    expect(first.kind).toBe("success");
    if (first.kind !== "success") return;
    // The hidden rows ride along — the screen's filter drops them, and Undo
    // brings them back where they stood — but only the visible one ended the fill.
    expect(first.value.items.map((item) => item.id)).toEqual(ids);
    expect(first.value.next).toBe(FEED_WINDOW + 1);
    expect(fake.windows.map((window) => window.length)).toEqual([FEED_WINDOW, 1]);
  });

  it("skips what the server could not hydrate and never asks for it again", async () => {
    const fake = io([answerOf(["a", "gone", "b"])]);
    const feed = new RankedFeed("reader-1");
    await feed.refresh(fake.reads);
    const first = await feed.window(0, fake.reads);
    expect(first.kind === "success" && first.value.items.map((item) => item.id)).toEqual(["a", "b"]);
    await feed.done({ ...FEED_FILTER_DEFAULT, order: "newest" }, fake.reads);
    await feed.window(0, fake.reads);
    expect(fake.windows).toHaveLength(1);
  });

  it("a_mixed_done_ranks_once_then_derives", async () => {
    const fake = io([answerOf(["a", "b"]), answerOf(["c", "d"])]);
    const feed = new RankedFeed("reader-1");
    await feed.refresh(fake.reads);
    await feed.done(
      { ...FEED_FILTER_DEFAULT, kinds: ["posts", "comments"], order: "newest" },
      fake.reads,
    );
    expect(fake.ranks).toHaveLength(2);
    expect(rowIds(feed)).toEqual(["d", "c"]);
  });

  it("done_without_changes_never_ranks", async () => {
    const fake = io([answerOf(["a"])]);
    const feed = new RankedFeed("reader-1");
    await feed.refresh(fake.reads);
    expect(await feed.done({ ...FEED_FILTER_DEFAULT }, fake.reads)).toEqual(success("nothing"));
    expect(fake.ranks).toHaveLength(1);
  });

  it("never adopts a ranking that landed after its screen left", async () => {
    const fake = io([answerOf(["a"]), answerOf(["b"])]);
    const feed = new RankedFeed("reader-1");
    await feed.refresh(fake.reads);
    const late = await feed.refresh({ ...fake.reads, wanted: () => false });
    expect(late.kind).toBe("failed");
    expect(feed.lookup("a")).toBeDefined();
    expect(rowIds(feed)).toEqual(["a"]);
  });

  it("ranks nothing for a viewer that resolves to no one", async () => {
    const fake = io([answerOf(["a"])]);
    const feed = new RankedFeed(null);
    const reads: FeedIo = { ...fake.reads, resolveViewer: async () => success(null) };
    expect((await feed.refresh(reads)).kind).toBe("success");
    expect(fake.ranks).toHaveLength(0);
    expect(rowIds(feed)).toEqual([]);
  });
});
