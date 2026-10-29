// @vitest-environment node
// THE STREAM'S STATE, compiled from Reel.md's sequence lines (:3, :31-47) and
// the reel packet's narrowing obligations (BD-4: "the same snapshot, narrowed
// post-rank … No relay call is its own"; ranked-feed-api §4.12, CD-2).

import { afterEach, describe, expect, it } from "vitest";

import type { PostView } from "@/lib/api/content-api";
import type { FeedItemView } from "@/lib/api/feed-api";
import { failed, success, type Outcome } from "@/lib/api/outcome";
import type { HeldAnswer } from "@/lib/feed/derive";
import { RankedFeed, type FeedIo } from "@/lib/feed/ranked-feed";

import { feedOrigin } from "./origins";
import {
  atTheEnd,
  forgetStream,
  heldStream,
  onScreen,
  openStream,
  streamBack,
  streamFor,
  type LoadOrigin,
  type OriginPage,
} from "./stream-session";

afterEach(() => forgetStream());

/** A post whose one attachment has the shape `ratio` ("9:16"), or a picture post for "photo". */
function post(id: string, ratio: string | null | "photo" = "9:16", extra: Record<string, unknown> = {}): PostView {
  const attachment =
    ratio === "photo"
      ? { id: `${id}-m`, mimeType: "image/webp", status: "NORMAL", options: { aspectRatio: "4:5" } }
      : { id: `${id}-m`, mimeType: "video/mp4", status: "NORMAL", options: { aspectRatio: ratio } };
  return { __typename: "Post", id, attachments: [attachment], attachmentsStatus: "NORMAL", ...extra } as unknown as PostView;
}

const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id);

/** An origin whose pages are scripted; "fault" fails that ask. */
function pages(script: (OriginPage | "fault")[]): { load: LoadOrigin; asked: () => number } {

  let asked = 0;
  return {
    load: async () => {
      asked += 1;
      const step = script[Math.min(asked - 1, script.length - 1)];
      if (step === "fault") return failed(new Error("down")) as Outcome<never>;

      return success(step);
    },
    asked: () => asked,
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("what the stream carries (Reel.md:3)", () => {
  it("the_stream_is_the_derived_list_narrowed_to_portrait_clips_in_order", () => {
    const rows = [post("a"), post("wide", "16:9"), post("b", "3:4"), post("sq", "1:1"), post("ph", "photo"), post("c")];
    const stream = openStream({ origin: { kind: "feed" }, rows, startId: "b" });
    expect(ids(stream.snapshot.clips)).toEqual(["a", "b", "c"]);
    expect(onScreen(stream.snapshot)?.id).toBe("b");
  });

  it("opens on the tapped clip and keeps the clips before it reachable", () => {
    const stream = openStream({ origin: { kind: "feed" }, rows: [post("a"), post("b")], startId: "b" });
    expect(stream.previous()).toBe(true);
    expect(onScreen(stream.snapshot)?.id).toBe("a");
  });
});

describe("the swipe grammar (Reel.md:31-43)", () => {
  const three = () => openStream({ origin: { kind: "feed" }, rows: [post("a"), post("b"), post("c")], startId: "a" });

  it("swipe up brings the next clip in the same list", () => {
    const stream = three();
    expect(stream.next()).toBe(true);
    expect(onScreen(stream.snapshot)?.id).toBe("b");
  });

  it("swipe_down_brings_the_clip_before_and_never_closes", () => {
    const stream = three();
    stream.next();
    expect(stream.previous()).toBe(true);
    expect(onScreen(stream.snapshot)?.id).toBe("a");
    expect(heldStream()).toBe(stream);
  });

  it("swipe_down_on_the_first_clip_stays_and_never_wraps", () => {
    const stream = three();
    expect(stream.previous()).toBe(false);
    expect(onScreen(stream.snapshot)?.id).toBe("a");
  });

  it("swipe_up_on_the_last_clip_stays_and_never_wraps", () => {
    const stream = three();
    stream.next();
    stream.next();
    expect(stream.next()).toBe(false);
    expect(onScreen(stream.snapshot)?.id).toBe("c");
  });

  it("the_last_clip_carries_thats_the_last_clip_here_at_the_captions_head — only where the list ends", () => {
    const stream = three();
    expect(atTheEnd(stream.snapshot)).toBe(false);
    stream.next();
    stream.next();
    expect(atTheEnd(stream.snapshot)).toBe(true);
  });

  it("the_stream_never_moves_on_by_itself — a page that lands adds clips and moves nobody", async () => {
    const origin = pages([{ rows: [post("d")], hasMore: false }]);
    const stream = openStream({ origin: { kind: "feed" }, rows: [post("a")], startId: "a", more: origin.load, hasMore: true });
    await flush();
    expect(ids(stream.snapshot.clips)).toEqual(["a", "d"]);
    expect(onScreen(stream.snapshot)?.id).toBe("a");
  });
});

describe("past the clips loaded (Reel.md:45-47; the fill rule)", () => {
  it("a_window_with_no_portrait_clip_loads_the_next", async () => {
    const origin = pages([
      { rows: [post("w1", "16:9"), post("p1", "photo")], hasMore: true },
      { rows: [post("sq", "1:1")], hasMore: true },
      { rows: [post("d")], hasMore: true },
    ]);
    const stream = openStream({ origin: { kind: "feed" }, rows: [post("a")], startId: "a", more: origin.load, hasMore: true });
    await flush();
    expect(origin.asked()).toBe(3);
    expect(ids(stream.snapshot.clips)).toEqual(["a", "d"]);
    expect(stream.snapshot.hasMore).toBe(true);
  });

  it("a_failed_load_keeps_the_clip_playing_and_reads_couldnt_load_more — once the reader swiped for it", async () => {
    const origin = pages(["fault"]);
    const stream = openStream({ origin: { kind: "feed" }, rows: [post("a")], startId: "a", more: origin.load, hasMore: true });
    await flush();
    // The prefetch failed, but nobody asked yet: no line.
    expect(stream.snapshot.fault).toBe(false);
    expect(stream.next()).toBe(false);
    expect(onScreen(stream.snapshot)?.id).toBe("a");
    expect(stream.snapshot.fault).toBe(true);
    expect(atTheEnd(stream.snapshot)).toBe(false);
  });

  it("a swipe while the load is in flight raises the fault when it fails", async () => {
    const origin = pages(["fault"]);
    const stream = openStream({ origin: { kind: "feed" }, rows: [post("a")], startId: "a", more: origin.load, hasMore: true });
    stream.next();
    await flush();
    expect(stream.snapshot.fault).toBe(true);
  });

  it("retry_on_couldnt_load_more_asks_again_and_the_line_goes", async () => {
    const origin = pages(["fault", { rows: [post("d")], hasMore: false }]);
    const stream = openStream({ origin: { kind: "feed" }, rows: [post("a")], startId: "a", more: origin.load, hasMore: true });
    await flush();
    stream.next();
    expect(stream.snapshot.fault).toBe(true);
    stream.retry();
    await flush();
    expect(stream.snapshot.fault).toBe(false);
    expect(ids(stream.snapshot.clips)).toEqual(["a", "d"]);
    // The swipe onward opens, and is the reader's.
    expect(onScreen(stream.snapshot)?.id).toBe("a");
    expect(stream.next()).toBe(true);
    expect(atTheEnd(stream.snapshot)).toBe(true);
  });

  it("a clip leaving the screen takes the stream's line with it (Reel.md:69)", async () => {
    const origin = pages(["fault"]);
    const stream = openStream({ origin: { kind: "feed" }, rows: [post("a"), post("b")], startId: "b", more: origin.load, hasMore: true });
    await flush();
    stream.next();
    expect(stream.snapshot.fault).toBe(true);
    stream.previous();
    expect(stream.snapshot.fault).toBe(false);
  });
});

describe("the feed's windows (BD-4, CD-2)", () => {
  function answerOf(targets: string[]): HeldAnswer {
    return {
      asOfEpoch: 1,
      entries: targets.map((targetId, index) => ({ targetId, kind: "POST", score: 1, mark: null, newestIndex: index })),
      settling: [],
    } as HeldAnswer;
  }

  async function heldFeed(targets: string[], hydrated: string[][], ranks: { n: number }) {
    const feed = new RankedFeed(null);
    const io: FeedIo = {
      resolveViewer: async () => success("viewer"),
      rank: async () => {
        ranks.n += 1;
        return success(answerOf(targets));
      },
      hydrate: async (asked) => {
        hydrated.push([...asked]);
        return success(asked.map((id) => post(id, id.startsWith("w") ? "16:9" : "9:16") as unknown as FeedItemView));
      },
      seen: async () => ({ has: () => false }) as never,
    };
    await feed.refresh(io);
    return { feed, io };
  }

  it("the_stream_never_calls_feed_ranking and the_stream_never_asks_for_more_than_100_ids", async () => {
    // 150 landscape rows, then a portrait one: the walk crosses many windows.
    const targets = [...Array.from({ length: 150 }, (_, i) => `w${i}`), "p1"];
    const hydrated: string[][] = [];
    const ranks = { n: 0 };
    const { feed, io } = await heldFeed(targets, hydrated, ranks);
    expect(ranks.n).toBe(1);
    const stream = openStream({
      origin: { kind: "feed" },
      rows: [],
      startId: "none",
      more: feedOrigin(feed, 0, { hydrate: io.hydrate }),
      hasMore: true,
    });
    await flush();
    await flush();
    expect(ranks.n).toBe(1);
    expect(hydrated.every((window) => window.length <= 100)).toBe(true);
    expect(ids(stream.snapshot.clips)).toEqual(["p1"]);
  });

  it("hidden_authors_never_enter_the_stream", async () => {
    const hydrated: string[][] = [];
    const { feed, io } = await heldFeed(["p1", "p2"], hydrated, { n: 0 });
    const stream = openStream({
      origin: { kind: "feed" },
      rows: [],
      startId: "none",
      more: feedOrigin(feed, 0, { hydrate: io.hydrate, hides: (item) => item.id === "p1" }),
      hasMore: true,
    });
    await flush();
    expect(ids(stream.snapshot.clips)).toEqual(["p2"]);
  });
});

describe("the hold across the detail, and the cold link (BD-R2; readme §13, the layer law)", () => {
  it("the_stream_holds_its_place_while_the_detail_is_up — a return stands on the clip", () => {
    const stream = openStream({ origin: { kind: "history" }, rows: [post("a"), post("b"), post("c")], startId: "a" });
    stream.next();
    expect(streamFor("b", null)).toBe(stream);
    expect(onScreen(stream.snapshot)?.id).toBe("b");
    expect(streamFor("c", null)).toBe(stream);
    expect(onScreen(stream.snapshot)?.id).toBe("c");
  });

  it("a_cold_reel_link_back_lands_on_feed — a stream of its one clip", () => {
    const cold = streamFor("x", post("x"));
    expect(cold).not.toBeNull();
    expect(ids(cold!.snapshot.clips)).toEqual(["x"]);
    expect(streamBack(cold!.snapshot.origin)).toEqual({ href: "/feed", label: "Back to feed" });
    expect(atTheEnd(cold!.snapshot)).toBe(true);
  });

  it("a cold link to a clip that is not a stream clip opens no stream", () => {
    expect(streamFor("w", post("w", "16:9"))).toBeNull();
  });
});

describe("the way back's noun (Reel.md:79)", () => {
  it("back_from_a_history_stream_reads_back_to_history, and the profiles read theirs", () => {
    expect(streamBack({ kind: "feed" })).toEqual({ href: "/feed", label: "Back to feed" });
    expect(streamBack({ kind: "history" })).toEqual({ href: "/history", label: "Back to History" });
    expect(streamBack({ kind: "profile", handle: "ada", own: false })).toEqual({ href: "/u/ada", label: "Back to the profile" });
    expect(streamBack({ kind: "profile", handle: "me", own: true })).toEqual({ href: "/profile", label: "Back to your profile" });
  });
});
