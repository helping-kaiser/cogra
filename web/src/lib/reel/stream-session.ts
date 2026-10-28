// THE STREAM'S HELD STATE — the list it was opened from, narrowed, and where
// the reader stands in it (Reel.md:3, :31-47; the reel packet's BD-R2 hold).
//
// WHAT IT HOLDS. "ALWAYS the stream carries only clips taller than they are
// wide, from the list it was opened from narrowed to them in that list's order
// — the feed it narrowed, History's rows or the profile's posts — and by no
// ranking of its own" (Reel.md:3). So a session is that ORIGIN, the origin's
// rows narrowed by the one predicate (`stream-clip.ts`), the clip on screen,
// and the origin's own way to its next page. Nothing here ranks, sorts or
// compares: rows enter in the origin's order and stay in it.
//
// WHERE IT LIVES. Module scope, like the feed's memory (`feed-memory.ts`) and
// for the same reason: the App Router unmounts a page on navigation, and the
// stream must survive its own score door — "the stream holds its place while
// the detail is up", and the detail's clip tap "expands back into the stream,
// the reader's place held" (PostDetailVideo.md:33; graph.json PostDetailVideo
// via 3). A cold start holds nothing, so a cold link opens a stream of its
// one clip whose way back is the feed's root (readme §13, the layer law).
//
// THE SWIPE GRAMMAR (Reel.md:31-47), as state:
// - up brings the next clip of the same list; on the last clip it stays and
//   never wraps, and with no clip after it the caption's head says so;
// - down brings the one before; on the first it stays, never wraps, never
//   closes;
// - past the clips loaded, the origin's next page is asked for — and a page
//   holding no clip asks for the one after it (the shared fill rule,
//   ranked-feed-api §5.1) — while the clip on screen stays and plays on. A
//   load that fails after the reader swiped for it raises `Couldn't load
//   more` with Retry, and the line goes once the clips come;
// - nothing here moves by itself: a page that lands adds clips, never moves
//   the reader onto them (Reel.md:39).

import type { Outcome } from "@/lib/api/outcome";
import type { PostView } from "@/lib/api/content-api";

import { isStreamClip } from "./stream-clip";

/** Where the stream was opened from — what it narrows, and where back goes. */
export type StreamOrigin =
  | { readonly kind: "feed" }
  | { readonly kind: "history" }
  | { readonly kind: "profile"; readonly handle: string; readonly own: boolean };

/** The way back, by the stream's noun table (Reel.md:79; readme §13, the nav-noun sweep). */
export function streamBack(origin: StreamOrigin): { readonly href: string; readonly label: string } {
  switch (origin.kind) {
    case "feed":
      return { href: "/feed", label: "Back to feed" };
    case "history":
      return { href: "/history", label: "Back to History" };
    case "profile":
      return origin.own
        ? { href: "/profile", label: "Back to your profile" }
        : { href: `/u/${encodeURIComponent(origin.handle)}`, label: "Back to the profile" };
  }
}

/** One page of the ORIGIN's list, unnarrowed, as the origin reads it. */
export type OriginPage = { readonly rows: readonly PostView[]; readonly hasMore: boolean };

/**
 * The origin's next page. Each call continues where the last answered one
 * ended; a failed call leaves its place, so asking again asks for the same
 * page (Reel.md:47).
 */
export type LoadOrigin = () => Promise<Outcome<OriginPage>>;

/** What the stream screen reads. A new object on every change. */
export type StreamState = {
  readonly origin: StreamOrigin;
  readonly clips: readonly PostView[];
  readonly index: number;
  /** The origin holds rows past what was read. */
  readonly hasMore: boolean;
  readonly loading: boolean;
  /** `Couldn't load more` stands at the caption's head (Reel.md:45). */
  readonly fault: boolean;
};

/** The clip on screen. */
export function onScreen(state: StreamState): PostView | undefined {
  return state.clips[state.index];
}

/** "That's the last clip here." — the list holds no clip after the one on screen (Reel.md:41). */
export function atTheEnd(state: StreamState): boolean {
  return state.index === state.clips.length - 1 && !state.hasMore;
}

export class StreamSession {
  private state: StreamState;
  private readonly listeners = new Set<() => void>();
  /** The last load failed; the swipe that wanted it raises the fault. */
  private failedLoad = false;
  /** The reader swiped up past the loaded clips since the last load landed. */
  private wanted = false;

  constructor(
    origin: StreamOrigin,
    rows: readonly PostView[],
    startId: string,
    private readonly more: LoadOrigin | null,
    hasMore: boolean,
  ) {
    const clips = rows.filter(isStreamClip);
    const at = clips.findIndex((clip) => clip.id === startId);
    this.state = {
      origin,
      clips,
      index: Math.max(0, at),
      hasMore: more !== null && hasMore,
      loading: false,
      fault: false,
    };
  }

  get snapshot(): StreamState {
    return this.state;
  }

  /** Whether `postId` is one of the stream's clips — a return into it. */
  holds(postId: string): boolean {
    return this.state.clips.some((clip) => clip.id === postId);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(next: Partial<StreamState>): void {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }

  /** The reader stands on `postId` again — the detail's clip tap returning (BD-R2). */
  stand(postId: string): void {
    const at = this.state.clips.findIndex((clip) => clip.id === postId);
    if (at >= 0 && at !== this.state.index) this.set({ index: at, fault: false });
  }

  /**
   * A swipe up (Reel.md:33, :43, :45). Moves to the next loaded clip; past
   * them, asks the origin for more and stays. Returns whether it moved.
   */
  next(): boolean {
    const { index, clips, hasMore } = this.state;
    if (index < clips.length - 1) {
      // A clip leaving the screen takes its plate lines with it (Reel.md:69).
      this.set({ index: index + 1, fault: false });
      this.prefetch();
      return true;
    }
    if (!hasMore) return false;
    this.wanted = true;
    if (this.failedLoad) {
      this.set({ fault: true });
      return false;
    }
    void this.load();
    return false;
  }

  /** A swipe down (Reel.md:35, :37): the clip before, or nothing — never a close. */
  previous(): boolean {
    const { index } = this.state;
    if (index === 0) return false;
    this.set({ index: index - 1, fault: false });
    return true;
  }

  /** `Retry` on `Couldn't load more` (Reel.md:47): asks again; the line goes once clips come. */
  retry(): void {
    this.failedLoad = false;
    this.wanted = true;
    void this.load();
  }

  /**
   * The clips after the last one are asked for as soon as the reader reaches
   * it, so a swipe there finds them waiting. Its failure says nothing until a
   * swipe wants what it was fetching.
   */
  prefetch(): void {
    const { index, clips, hasMore } = this.state;
    if (index === clips.length - 1 && hasMore && !this.failedLoad) void this.load();
  }

  /**
   * The origin's pages until one brings a clip or the origin ends — a page
   * holding no clip loads the next (the fill rule).
   */
  private async load(): Promise<void> {
    if (this.more === null || this.state.loading) return;
    this.set({ loading: true });
    let found = false;
    let hasMore = this.state.hasMore;
    while (!found && hasMore) {
      const page = await this.more();
      if (page.kind !== "success") {
        this.failedLoad = true;
        this.set({ loading: false, fault: this.wanted });
        return;
      }
      hasMore = page.value.hasMore;
      const known = new Set(this.state.clips.map((clip) => clip.id));
      const arrived = page.value.rows.filter((row) => isStreamClip(row) && !known.has(row.id));
      found = arrived.length > 0;
      this.set({ clips: [...this.state.clips, ...arrived], hasMore });
    }
    this.failedLoad = false;
    this.wanted = false;
    this.set({ loading: false, fault: false });
  }
}

let current: StreamSession | null = null;

/**
 * A portrait clip's tap opens the stream on it (Reel.md:3; graph.json «post
 * media», «a portrait clip — the stream opens»): the surface hands its list
 * as it stands — its rows, the tapped clip, and its own way to the next page.
 */
export function openStream({
  origin,
  rows,
  startId,
  more = null,
  hasMore = false,
}: {
  origin: StreamOrigin;
  rows: readonly PostView[];
  startId: string;
  more?: LoadOrigin | null;
  hasMore?: boolean;
}): StreamSession {
  current = new StreamSession(origin, rows, startId, more, hasMore);
  current.prefetch();
  return current;
}

/**
 * The held stream that carries `postId`, or a cold one of that clip alone,
 * whose way back is the feed (readme §13: "a cold link's back lands on
 * Feed's root").
 */
export function streamFor(postId: string, cold: PostView | null): StreamSession | null {
  if (current !== null && current.holds(postId)) {
    current.stand(postId);
    return current;
  }
  if (cold === null || !isStreamClip(cold)) return null;
  current = new StreamSession({ kind: "feed" }, [cold], cold.id, null, false);
  return current;
}

/** The held stream, whatever it holds — for a test. */
export function heldStream(): StreamSession | null {
  return current;
}

/** Drop it — a cold start, for a test. */
export function forgetStream(): void {
  current = null;
}
