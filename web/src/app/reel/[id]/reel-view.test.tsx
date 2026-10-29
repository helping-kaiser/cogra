// THE STREAM, compiled from its two sidecars line by line (behavior/Reel.md,
// behavior/ReelSensitive.md) and the reel packet's §Test obligations. Each
// test names the line it holds. The lines another suite holds:
//
// - Reel.md:3, :31-47 (what the stream carries, the swipe grammar's state, the
//   fill rule, the fault and its Retry, the hold across the detail, the cold
//   link): `lib/reel/stream-session.test.ts`; the tap's routing:
//   `lib/reel/stream-routing.test.tsx`.
// - Reel.md:65-69, ReelSensitive.md:25-27 (the hold's plate lines):
//   `lib/ui/stance-control.test.tsx`, "the stance control over media".
// - The stage engine's own rules the stream inherits (one stage, a sheet
//   suspending, the pad pausing, a hidden page, ruling 96): `stage.ts`'s
//   suites; here, each is pinned once on the stream itself.

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HeldAnswer } from "@/lib/feed/derive";
import { forgetStream, heldStream, openStream, type StreamOrigin } from "@/lib/reel/stream-session";
import { STILL_SETTLING } from "@/lib/ui2/media/reel-rail";
import { SHOW } from "@/lib/ui2/media/reel-caption";
import { adoptTrace, forgetStandings, holdRanking } from "@/lib/score/standing";
import { createTokenStore } from "@/lib/session/token-store";
import { setAccountFilterLevel, UNVEIL_LEVEL } from "@/lib/settings/sensitive-content";
import { writeStanceTaught } from "@/lib/stance/stance-coach";
import { createStubStanceData } from "@/lib/stance/stub-stance-data";
import { backFor } from "@/lib/ui/back-origin";
import * as clipMemory from "@/lib/ui2/media/clip-memory";
import { DetailClip } from "@/lib/ui2/media/detail-clip";
import { forgetReveals } from "@/lib/ui2/media/reveal";
import { resetMuteForTests } from "@/lib/ui2/media/mute";
import { StageHost } from "@/lib/ui2/media/stage-host";
import { VideoPlayer } from "@/lib/ui2/media/video-player";
import { resetVideoStageForTests } from "@/lib/ui2/media/video-stage";
import { byNode } from "@/test/data-node";
import { intersectEach, setsPageVisibility, suppressesAutoplay, turnsTheScreen, whenObserved } from "@/test/media-env";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { reelPost } from "@/test/reel";

import { COULDNT_LOAD_MORE, LAST_CLIP_HERE, ReelView } from "./reel-view";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push, replace, back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/reel/p1",
  useSearchParams: () => new URLSearchParams(),
}));

const server = startMswServer(
  gqlLink.query("PostComments", () =>
    HttpResponse.json({
      data: {
        post: {
          __typename: "Post",
          id: "p1",
          comments: {
            __typename: "CommentConnection",
            totalCount: 0,
            edges: [],
            pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
          },
        },
      },
    }),
  ),
  gqlLink.mutation("MarkSeen", () =>
    HttpResponse.json({ data: { markSeen: { __typename: "MarkSeenPayload", ok: true, userErrors: [] } } }),
  ),
);

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
});

afterEach(() => {
  forgetStream();
  forgetStandings();
  forgetReveals();
  clipMemory.forgetList(["p1-m", "p2-m", "p3-m", "s1-m"]);
  resetMuteForTests();
  resetVideoStageForTests();
  setAccountFilterLevel(null);
  localStorage.clear();
  sessionStorage.clear();
});

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "u1" });
  return store;
}

/**
 * An author's own mark as the read serves it: every status reads the OR of
 * the author's mark and a verdict, so `moderationStatus` reads SENSITIVE too,
 * and only `sensitiveSelfMark` says whose it is (api-spec.md, "Content
 * authoring").
 */
const SENSITIVE = { attachmentsStatus: "SENSITIVE", moderationStatus: "SENSITIVE", sensitiveSelfMark: true };
/** A moderator's verdict alone: the same statuses, the author's mark unset. */
const VERDICT = { attachmentsStatus: "SENSITIVE", moderationStatus: "SENSITIVE", sensitiveSelfMark: false };

/** Open a stream over `rows` on `startId`, then mount the screen there. */
function mountStream({
  rows = [reelPost("p1"), reelPost("p2"), reelPost("p3")],
  startId = "p1",
  origin = { kind: "feed" } as StreamOrigin,
  signedIn = false,
  stance = createStubStanceData(),
}: {
  rows?: ReturnType<typeof reelPost>[];
  startId?: string;
  origin?: StreamOrigin;
  signedIn?: boolean;
  stance?: ReturnType<typeof createStubStanceData>;
} = {}) {
  openStream({ origin, rows, startId });
  return renderWithProviders(<ReelView postId={startId} />, {
    store: signedIn ? signedInStore() : createTokenStore(),
    stanceData: stance,
  });
}

const clip = () => screen.getByTestId("reel-clip") as HTMLVideoElement;
const rail = () => screen.getByTestId(byNode("reel.rail"));
const caption = () => screen.getByTestId(byNode("reel.caption"));
const stage = () => screen.getByTestId("reel").firstElementChild as HTMLElement;

/** The clip on screen, wholly in view. */
async function onScreen() {
  await whenObserved(clip());
  act(() => intersectEach([{ target: clip(), ratio: 1 }]));
}

/** A vertical drag across the stream: negative travel is a swipe up. */
function swipe(travel: number) {
  fireEvent.pointerDown(stage(), { clientX: 200, clientY: 400 });
  fireEvent.pointerUp(stage(), { clientX: 200, clientY: 400 + travel });
}

function answerOf(scores: Record<string, number>, settling: string[] = []): HeldAnswer {
  return {
    asOfEpoch: 1,
    entries: Object.entries(scores).map(([targetId, score], index) => ({
      targetId,
      kind: "POST",
      score,
      mark: null,
      newestIndex: index,
    })),
    settling: settling.map((targetId, index) => ({
      targetId,
      kind: "POST",
      mark: null,
      rankedPosition: index,
      newestPosition: index,
    })),
  } as HeldAnswer;
}

describe("the stream's chrome (Reel.md:5-19)", () => {
  it("the_stream_draws_no_header_and_no_help (Reel.md:5)", () => {
    mountStream();
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.queryByRole("button", { name: /how|help|\?/i })).toBeNull();
  });

  it("the_streams_black_and_washes_end_below_the_status_bar (Reel.md:7-9)", () => {
    mountStream();
    const ground = screen.getByTestId("reel");
    // The black is the stream's own box, in the page's flow under whatever the
    // system draws above it — never fixed over the viewport, never a
    // theme-colour change.
    expect(ground.style.background).toBe("rgb(0, 0, 0)");
    expect(ground.className).not.toMatch(/fixed/);
    expect(ground).toHaveAttribute("data-theme", "dark");
    expect(document.querySelector('meta[name="theme-color"]')).toBeNull();
    const top = screen.getByTestId(byNode("reel.washTop"));
    expect(top.className.split(" ")).toContain("top-0");
    expect(top).toHaveStyle({ height: "140px" });
    expect(ground).toContainElement(top);
  });

  it("wears the sound control and a thin seek line, never a pause or the full transport (Reel.md:11)", async () => {
    mountStream();
    await onScreen();
    expect(screen.getByTestId(byNode("reel.soundDisc"))).toHaveAccessibleName("Turn sound on");
    expect(screen.getByRole("slider", { name: "Seek" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^(pause|play)$/i })).toBeNull();
    expect(screen.queryByTestId("reel-clip-transport")).toBeNull();
  });

  it("the seek line rides directly above the bottom bar (Reel.md:13)", () => {
    mountStream();
    expect(screen.getByTestId(byNode("reel.seekLine"))).toHaveStyle({
      bottom: "calc(var(--bottom-bar-height) + env(safe-area-inset-bottom, 0px) + 4px)",
    });
  });

  it("the_seek_target_rises_48dp_from_the_track_and_the_ink_stays_3px (Reel.md:15)", () => {
    mountStream();
    const slider = screen.getByRole("slider", { name: "Seek" });
    expect(slider).toHaveStyle({ height: "3px" });
    const target = screen.getByTestId("reel-clip-timeline-target");
    expect(target).toHaveStyle({ height: "var(--touch-target-min)" });
    expect(target.className).toMatch(/bottom-0/);
    expect(screen.queryByTestId("reel-clip-timeline-knob")).toBeNull();
  });

  it("the_seek_target_and_mores_target_never_overlap (Reel.md:15; Reel.jsx:28-31)", () => {
    mountStream();
    // The seek line's foot stands 4px above the bar and its 48px target rises
    // to 52px; the caption stands at 66, so `More`'s own 48px target — its
    // 20px ink grown 14px either side — meets the seek line's at 52 and never
    // reaches under it.
    expect(caption()).toHaveStyle({
      bottom: "calc(var(--bottom-bar-height) + env(safe-area-inset-bottom, 0px) + 66px)",
    });
    const SEEK_TOP = 4 + 48;
    const MORE_INK = 20;
    const MORE_GROWTH = (48 - MORE_INK) / 2;
    expect(66 - MORE_GROWTH).toBeGreaterThanOrEqual(SEEK_TOP);
    expect(screen.getByTestId(byNode("reel.caption.more")).className).toMatch(/cg-hit/);
  });

  it("the bottom bar stays on the stream, Feed lit (Reel.md:17)", () => {
    mountStream();
    const bar = screen.getByTestId(byNode("reel.bottomBar"));
    expect(screen.getByTestId(byNode("reel.bottomBar.feedSlot"))).toHaveAttribute("aria-current", "page");
    expect(bar).toBeInTheDocument();
  });

  it("the rail reads, top to bottom, the author, the opinion, the comments, the share and the score (Reel.md:19)", () => {
    Object.defineProperty(navigator, "share", { configurable: true, value: vi.fn(() => Promise.resolve()) });
    mountStream();
    const items = [...rail().children];
    expect(items[0]).toHaveAccessibleName("Mira Voss");
    expect(items[1]).toContainElement(screen.getByTestId(byNode("reel.rail.stance.anchor")));
    expect(items[2]).toHaveAccessibleName("2 comments");
    expect(items[3]).toHaveAccessibleName("Share this post");
    expect(items[4]).toHaveAccessibleName(/^Feed score/);
    delete (navigator as unknown as Record<string, unknown>).share;
  });

  it("the caption carries the handle, the title and the description with More (ReelCaption)", () => {
    mountStream();
    expect(screen.getByTestId(byNode("reel.caption.handle"))).toHaveTextContent("@mira");
    expect(screen.getByTestId(byNode("reel.caption.title"))).toHaveTextContent("Clip p1");
    expect(screen.getByTestId(byNode("reel.caption.description"))).toHaveTextContent("The light over the lake, p1");
    const more = screen.getByTestId(byNode("reel.caption.more"));
    fireEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
  });
});

describe("the rail's score (Reel.md:21-29)", () => {
  const value = () => screen.getByTestId(byNode("reel.rail.score.value"));
  const door = () => screen.getByTestId(byNode("reel.rail.score"));

  it("the_rail_score_is_the_snapshot_score — the same figure the card wears (Reel.md:21)", () => {
    holdRanking(null, answerOf({ p1: 7.4 }), "viewer");
    mountStream();
    expect(value()).toHaveTextContent("7.40");
  });

  it("the_rail_score_is_what_the_card_wears_its_trace_adoption_included and the_rail_adopts_a_differing_figure_its_trace_found (Reel.md:27)", () => {
    holdRanking(null, answerOf({ p1: 7.4 }), "viewer");
    mountStream();
    act(() => adoptTrace("p1", 3.1));
    expect(value()).toHaveTextContent("3.10");
  });

  it("the_rail_reads_a_dash_after_the_traces_fetch_found_no_paths, the_rail_never_shows_the_figure_it_wore_before_an_adoption", () => {
    holdRanking(null, answerOf({ p1: 7.4 }), "viewer");
    mountStream();
    act(() => adoptTrace("p1", null));
    expect(value()).toHaveTextContent("—");
    expect(rail()).not.toHaveTextContent("7.40");
  });

  it("the_next_feed_fetch_replaces_the_rails_adopted_figure and the_next_feed_fetch_dissolves_the_rail_dash (Reel.md:29)", () => {
    holdRanking(null, answerOf({ p1: 7.4 }), "viewer");
    mountStream();
    act(() => adoptTrace("p1", null));
    act(() => holdRanking(null, answerOf({ p1: 8.2 }), "viewer"));
    expect(value()).toHaveTextContent("8.20");
  });

  it("a_settling_clips_rail_score_is_the_bare_glyph_over_still_settling, inside the door (Reel.md:25; round 26)", () => {
    holdRanking(null, answerOf({}, ["p1"]), "viewer");
    mountStream();
    expect(screen.queryByTestId(byNode("reel.rail.score.value"))).toBeNull();
    const settling = screen.getByTestId(byNode("reel.rail.score.settling"));
    expect(settling).toHaveTextContent(STILL_SETTLING);
    // THE WHOLE FACE IS THE DOOR: the line is the door's own part, and the
    // door's name says it.
    expect(door()).toContainElement(settling);
    expect(door()).toHaveAccessibleName(`Feed score ${STILL_SETTLING}`);
    expect(rail()).not.toHaveTextContent(/^0$|—/);
  });

  it("the_settling_face_is_the_same_under_ranked_and_newest — a pending row is settling whatever the order", () => {
    // The face reads the row's own landing state, never the feed's order.
    mountStream({ rows: [reelPost("p1", "9:16", { landing: { __typename: "Landing", state: "PENDING" } })] });
    expect(screen.getByTestId(byNode("reel.rail.score.settling"))).toHaveTextContent(STILL_SETTLING);
  });

  it("every_rail_score_face_opens_the_detail and the_settling_rail_face_opens_the_post — never the trace (Reel.md:23)", () => {
    const detail = "/posts/p1?from=stream%3Ap1";
    holdRanking(null, answerOf({ p1: 7.4 }), "viewer");
    const { unmount } = mountStream();
    expect(door()).toHaveAttribute("href", detail);
    act(() => adoptTrace("p1", null));
    expect(door()).toHaveAttribute("href", detail);
    unmount();
    forgetStream();
    holdRanking(null, answerOf({}, ["p1"]), "viewer");
    mountStream();
    expect(door()).toHaveAttribute("href", detail);
    expect(door().getAttribute("href")).not.toMatch(/trace/);
  });

  it("the_detail_from_the_score_door_reads_back_to_the_stream", () => {
    expect(backFor("stream:p1")).toEqual({ href: "/reel/p1", label: "Back to the stream" });
  });

  it("no_stream_string_speaks_fetch (PR-41)", () => {
    for (const line of [STILL_SETTLING, LAST_CLIP_HERE, COULDNT_LOAD_MORE, "That didn't sign.", "You can't sign right now."]) {
      expect(line).not.toMatch(/fetch/i);
    }
  });
});

describe("the swipe (Reel.md:31-47)", () => {
  it("swipe up brings the next clip, swipe down the one before (Reel.md:33, :35)", () => {
    mountStream();
    swipe(-200);
    expect(screen.getByTestId(byNode("reel.caption.title"))).toHaveTextContent("Clip p2");
    swipe(200);
    expect(screen.getByTestId(byNode("reel.caption.title"))).toHaveTextContent("Clip p1");
  });

  it("a short drag or a sideways one is not a swipe", () => {
    mountStream();
    swipe(-20);
    fireEvent.pointerDown(stage(), { clientX: 0, clientY: 400 });
    fireEvent.pointerUp(stage(), { clientX: 300, clientY: 300 });
    expect(screen.getByTestId(byNode("reel.caption.title"))).toHaveTextContent("Clip p1");
  });

  it("the keys page too", () => {
    mountStream();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.getByTestId(byNode("reel.caption.title"))).toHaveTextContent("Clip p2");
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(screen.getByTestId(byNode("reel.caption.title"))).toHaveTextContent("Clip p1");
  });

  it("the_last_clip_carries_thats_the_last_clip_here_at_the_captions_head (Reel.md:41)", () => {
    mountStream({ startId: "p3" });
    const notice = screen.getByTestId(byNode("reel.caption.notice"));
    expect(notice).toHaveTextContent(LAST_CLIP_HERE);
    // At the caption's head, before the handle.
    expect(caption().firstElementChild).toBe(notice);
    // As wide as its words, never stretched across the caption (ReelRail.jsx `ReelPlate`).
    expect(notice).toHaveStyle({ alignSelf: "flex-start" });
    swipe(-200);
    expect(screen.getByTestId(byNode("reel.caption.title"))).toHaveTextContent("Clip p3");
  });

  it("a_failed_window_reads_couldnt_load_more_with_retry_on_the_plate, the clip on screen staying and playing on (Reel.md:45-47)", async () => {
    let fail = true;
    openStream({
      origin: { kind: "feed" },
      rows: [reelPost("p1")],
      startId: "p1",
      hasMore: true,
      more: async () =>
        fail
          ? { kind: "failed", cause: new Error("down") } as never
          : { kind: "success", value: { rows: [reelPost("p2")], hasMore: false } },
    });
    renderWithProviders(<ReelView postId="p1" />, { stanceData: createStubStanceData() });
    await onScreen();
    expect(clip().paused).toBe(false);
    swipe(-200);
    const notice = await screen.findByTestId(byNode("reel.caption.notice"));
    expect(notice).toHaveTextContent(COULDNT_LOAD_MORE);
    expect(screen.getByTestId(byNode("reel.caption.title"))).toHaveTextContent("Clip p1");
    expect(clip().paused).toBe(false);
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry loading more" }));
    await waitFor(() => expect(screen.queryByTestId(byNode("reel.caption.notice"))).toBeNull());
    expect(heldStream()?.snapshot.clips).toHaveLength(2);
  });
});

describe("the stage (Reel.md:49-57; the stage law)", () => {
  it("one_clip_plays_on_the_stream, unmuted by nobody but the reader", async () => {
    mountStream();
    await onScreen();
    expect(clip().paused).toBe(false);
    expect(clip().muted).toBe(true);
    expect(document.querySelectorAll("video")).toHaveLength(1);
  });

  it("the_stream_opens_the_clip_at_the_frame_the_card_reached", async () => {
    // The card's clip played to 7s and left (the route swapping it out).
    const { unmount } = renderWithProviders(
      <StageHost>
        <VideoPlayer src="https://media.test/p1.mp4" mediaId="p1-m" testId="card" />
      </StageHost>,
    );
    const card = screen.getByTestId("card") as HTMLVideoElement;
    await whenObserved(card);
    act(() => intersectEach([{ target: card, ratio: 1 }]));
    card.currentTime = 7;
    unmount();
    mountStream();
    expect(clip().currentTime).toBe(7);
  });

  it("a_swipe_freezes_the_outgoing_clip_at_its_frame", async () => {
    mountStream();
    await onScreen();
    const first = clip();
    first.currentTime = 5;
    swipe(-200);
    expect(first.paused).toBe(true);
    expect(clipMemory.read("p1-m")?.time).toBe(5);
    swipe(200);
    expect(clip().currentTime).toBe(5);
  });

  it("a_hidden_page_pauses_the_stream_clip", async () => {
    mountStream();
    await onScreen();
    act(() => setsPageVisibility("hidden"));
    expect(clip().paused).toBe(true);
    act(() => setsPageVisibility("visible"));
    expect(clip().paused).toBe(false);
  });

  it("a_suppression_flip_never_stops_the_playing_stream_clip (ruling 96)", async () => {
    suppressesAutoplay({});
    mountStream();
    await onScreen();
    expect(clip().paused).toBe(false);
    act(() => suppressesAutoplay({ reducedMotion: true }));
    expect(clip().paused).toBe(false);
  });

  it("a_suppressed_stream_opens_paused_with_the_play_disc (Reel.md:49), in the sound control's corner", async () => {
    suppressesAutoplay({ reducedMotion: true });
    mountStream();
    await onScreen();
    expect(clip().paused).toBe(true);
    const disc = screen.getByTestId(byNode("reel.playDisc"));
    expect(disc).toHaveAccessibleName("Play this video");
    expect(disc).toHaveStyle({ top: "8px", right: "8px" });
    expect(screen.queryByTestId(byNode("reel.soundDisc"))).toBeNull();
  });

  it("the_play_disc_plays_and_the_sound_disc_takes_its_corner (Reel.md:53)", async () => {
    suppressesAutoplay({ reducedMotion: true });
    mountStream();
    await onScreen();
    fireEvent.click(screen.getByTestId(byNode("reel.playDisc")));
    expect(clip().paused).toBe(false);
    expect(screen.getByTestId(byNode("reel.soundDisc"))).toHaveStyle({ top: "8px", right: "8px" });
    expect(screen.queryByTestId(byNode("reel.playDisc"))).toBeNull();
  });

  it("a_swipe_under_suppression_brings_a_paused_clip_with_the_disc (Reel.md:51)", async () => {
    suppressesAutoplay({ reducedMotion: true });
    mountStream();
    await onScreen();
    swipe(-200);
    await onScreen();
    expect(clip().paused).toBe(true);
    expect(screen.getByTestId(byNode("reel.playDisc"))).toBeInTheDocument();
  });

  it("the_stream_never_moves_on_by_itself — a clip's end loops in place (RL-G5 reading)", () => {
    mountStream();
    expect(clip()).toHaveAttribute("loop");
  });

  it("dragging_the_seek_line_moves_the_clip (Reel.md:55)", async () => {
    mountStream();
    await onScreen();
    const slider = screen.getByRole("slider", { name: "Seek" });
    slider.getBoundingClientRect = () => ({ left: 0, width: 400, top: 0, height: 3, right: 400, bottom: 3, x: 0, y: 0, toJSON: () => ({}) });
    slider.setPointerCapture = () => {};
    slider.hasPointerCapture = () => true;
    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 200 });
    fireEvent.pointerMove(slider, { pointerId: 1, clientX: 300 });
    // 41s from the record (`durationMs`), three quarters along.
    expect(clip().currentTime).toBeCloseTo(30.75);
    // The drag is the line's, never the stream's swipe.
    expect(screen.getByTestId(byNode("reel.caption.title"))).toHaveTextContent("Clip p1");
  });

  it("sound_on_the_stream_flips_the_global_mute (Reel.md:57)", async () => {
    mountStream();
    await onScreen();
    fireEvent.click(screen.getByTestId(byNode("reel.soundDisc")));
    expect(clip().muted).toBe(false);
    expect(screen.getByTestId(byNode("reel.soundDisc"))).toHaveAccessibleName("Turn sound off");
  });
});

describe("the pad, the sheet and the gates (Reel.md:61-73)", () => {
  beforeEach(() => writeStanceTaught());

  const anchor = () => screen.getByTestId(byNode("reel.rail.stance.anchor"));
  const tap = () => {
    fireEvent.pointerDown(anchor(), { pointerId: 9, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(anchor(), { pointerId: 9 });
    fireEvent.click(anchor());
  };

  it("the_pad_pauses_the_stream_clip and the_pad_closing_resumes_the_same_clip_at_its_position (Reel.md:61-63)", async () => {
    mountStream({ signedIn: true });
    await onScreen();
    clip().currentTime = 4;
    await act(async () => tap());
    await screen.findByTestId("reel-stance-scrim");
    expect(clip().paused).toBe(true);
    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    await waitFor(() => expect(screen.queryByTestId("reel-stance-scrim")).toBeNull());
    expect(clip().paused).toBe(false);
    expect(clip().currentTime).toBe(4);
  });

  it("the_pad_closing_never_starts_a_clip_that_was_not_playing", async () => {
    suppressesAutoplay({ reducedMotion: true });
    mountStream({ signedIn: true });
    await onScreen();
    await act(async () => tap());
    await screen.findByTestId("reel-stance-scrim");
    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    await waitFor(() => expect(screen.queryByTestId("reel-stance-scrim")).toBeNull());
    expect(clip().paused).toBe(true);
  });

  it("the_comments_sheet_stops_the_stream_clip (Reel.md:71)", async () => {
    mountStream();
    await onScreen();
    fireEvent.click(screen.getByTestId(byNode("reel.rail.comments")));
    await screen.findByTestId("comments-sheet");
    expect(clip().paused).toBe(true);
  });

  it("a_guests_stance_tap_opens_the_join_prompt_over_the_paused_clip (Reel.md:73)", async () => {
    mountStream({ signedIn: false });
    await onScreen();
    await act(async () => tap());
    // The bar keeps its own closed guest gate mounted; the stance opens one.
    await waitFor(() =>
      expect(screen.getAllByTestId("join-prompt").some((prompt) => prompt.hasAttribute("open"))).toBe(true),
    );
    expect(clip().paused).toBe(true);
  });

  it("a_keyless_stance_tap_opens_the_key_notice (graph.json Reel via 4)", async () => {
    mountStream({ signedIn: true, stance: createStubStanceData({ keyAbsent: true }) });
    await act(async () => tap());
    expect(await screen.findByTestId("reel-stance-key-absent")).toBeInTheDocument();
  });

  it("the rail's opinion is the system's control in its media dress", () => {
    mountStream();
    expect(anchor()).toHaveStyle({ width: "56px", height: "44px" });
  });
});

describe("the share (graph.json Reel via 6)", () => {
  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>).share;
    delete (navigator as unknown as Record<string, unknown>).clipboard;
  });

  it("share_opens_the_platform_sheet", async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    mountStream();
    fireEvent.click(screen.getByTestId(byNode("reel.rail.share")));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ url: "http://localhost:3000/posts/p1" }));
  });

  it("share_without_navigator_share_copies_the_link", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    mountStream();
    fireEvent.click(screen.getByTestId(byNode("reel.rail.share")));
    expect(await screen.findByTestId(byNode("reel.snackbar"))).toHaveTextContent("Link copied");
    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/posts/p1");
  });
});

describe("the exits (Reel.md:75-79)", () => {
  const backDisc = () => screen.getByTestId(byNode("reel.backDisc"));

  it("back_from_the_stream_closes_on_the_feed_it_narrowed", () => {
    mountStream();
    expect(backDisc()).toHaveAttribute("href", "/feed");
    expect(backDisc()).toHaveAccessibleName("Back to feed");
  });

  it("back_from_a_history_stream_reads_back_to_history", () => {
    mountStream({ origin: { kind: "history" } });
    expect(backDisc()).toHaveAttribute("href", "/history");
    expect(backDisc()).toHaveAccessibleName("Back to History");
  });

  it("the_feed_slot_leaves_the_stream_for_the_feed", () => {
    mountStream({ origin: { kind: "history" } });
    expect(screen.getByTestId(byNode("reel.bottomBar.feedSlot"))).toHaveAttribute("href", "/feed");
  });

  it("a_deep_linked_reel_back_returns_the_prior_state — a return into a held stream stands on its clip", () => {
    openStream({ origin: { kind: "history" }, rows: [reelPost("p1"), reelPost("p2")], startId: "p1" });
    renderWithProviders(<ReelView postId="p2" />, { stanceData: createStubStanceData() });
    expect(screen.getByTestId(byNode("reel.caption.title"))).toHaveTextContent("Clip p2");
    expect(backDisc()).toHaveAccessibleName("Back to History");
  });

  it("a_cold_reel_link_back_lands_on_feed", async () => {
    server.use(
      gqlLink.query("Feed", () =>
        HttpResponse.json({
          data: { feed: { __typename: "FeedConnection", edges: [{ __typename: "FeedEdge", node: reelPost("p9") }] } },
        }),
      ),
    );
    renderWithProviders(<ReelView postId="p9" />, { stanceData: createStubStanceData() });
    expect(await screen.findByTestId(byNode("reel.backDisc"))).toHaveAttribute("href", "/feed");
  });

  it("a cold link to a post that is no stream clip opens the post", async () => {
    server.use(
      gqlLink.query("Feed", () =>
        HttpResponse.json({
          data: {
            feed: { __typename: "FeedConnection", edges: [{ __typename: "FeedEdge", node: reelPost("w1", "16:9") }] },
          },
        }),
      ),
    );
    renderWithProviders(<ReelView postId="w1" />, { stanceData: createStubStanceData() });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/posts/w1"));
  });

  it("the_detail_clip_tap_returns_into_the_stream_at_the_held_clip (BD-R2; PostDetailVideo.md:33)", () => {
    const back = vi.fn();
    const viewer = vi.fn();
    renderWithProviders(
      <DetailClip
        src="https://media.test/p2.mp4"
        mimeType="video/mp4"
        mediaId="p2-m"
        onOpenViewer={viewer}
        onReturnToStream={back}
        testId="detail"
      />,
    );
    // The transport's chrome is up on arrival: the clip's tap goes back into
    // the stream, and the toggle still opens the viewer (:37).
    fireEvent.click(screen.getByTestId("detail-media"));
    expect(back).toHaveBeenCalledTimes(1);
    expect(viewer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("detail-media-transport-fullscreen"));
    expect(viewer).toHaveBeenCalledTimes(1);
  });

  it("the_score_door_keeps_the_clip_playing_from_its_frame (Reel.md:59)", async () => {
    const { unmount } = mountStream();
    await onScreen();
    clip().currentTime = 6;
    // The score door's navigation swaps the stream out for the detail.
    unmount();
    renderWithProviders(<DetailClip src="https://media.test/p1.mp4" mimeType="video/mp4" mediaId="p1-m" testId="detail" />);
    const head = screen.getByTestId("detail-media") as HTMLVideoElement;
    expect(head.currentTime).toBe(6);
  });
});

describe("the veiled stream (ReelSensitive.md)", () => {
  const sensitiveRows = () => [reelPost("s1", "9:16", SENSITIVE), reelPost("p2")];

  it("a_sensitive_clip_reached_by_swipe_stands_veiled_and_silent (ReelSensitive.md:3)", async () => {
    mountStream({ rows: [reelPost("p1"), reelPost("s1", "9:16", SENSITIVE)] });
    swipe(-200);
    await onScreen();
    expect(clip().paused).toBe(true);
    expect(screen.getByTestId(byNode("reel.stage.veil"))).toHaveAccessibleName(
      "Sensitive — tap to view. The author's warning",
    );
  });

  it("a_veiled_clip_shows_no_sound_disc_and_no_seek_line (ReelSensitive.md:5, :9)", async () => {
    mountStream({ rows: sensitiveRows(), startId: "s1" });
    await onScreen();
    expect(screen.queryByTestId(byNode("reel.soundDisc"))).toBeNull();
    expect(screen.queryByTestId(byNode("reel.playDisc"))).toBeNull();
    expect(screen.queryByRole("slider", { name: "Seek" })).toBeNull();
  });

  it("the_caption_description_veils_and_the_title_stays_readable (ReelSensitive.md:11)", () => {
    mountStream({ rows: sensitiveRows(), startId: "s1" });
    expect(screen.getByTestId(byNode("reel.caption.handle"))).toHaveTextContent("@mira");
    expect(screen.getByTestId(byNode("reel.caption.title"))).toHaveTextContent("Clip s1");
    const description = screen.getByTestId(byNode("reel.caption.description"));
    expect(description.parentElement).toHaveAttribute("aria-hidden", "true");
    expect(description.parentElement).toHaveStyle({ filter: "blur(6px)" });
    expect(screen.getByTestId(byNode("reel.caption.show"))).toHaveTextContent(SHOW);
  });

  it("the_rail_stays_live_over_the_veil, its score wearing every face (ReelSensitive.md:13, :15)", () => {
    holdRanking(null, answerOf({ s1: 2.5 }), "viewer");
    mountStream({ rows: sensitiveRows(), startId: "s1" });
    expect(screen.getByTestId(byNode("reel.rail.stance.anchor"))).toBeEnabled();
    expect(screen.getByTestId(byNode("reel.rail.comments"))).toBeEnabled();
    expect(screen.getByTestId(byNode("reel.rail.score.value"))).toHaveTextContent("2.50");
  });

  it("either_veil_face_reveals_clip_and_caption_and_it_plays (ReelSensitive.md:17, :19)", async () => {
    mountStream({ rows: sensitiveRows(), startId: "s1" });
    await onScreen();
    fireEvent.click(screen.getByTestId(byNode("reel.caption.show")));
    expect(screen.queryByTestId(byNode("reel.stage.veil"))).toBeNull();
    expect(screen.getByTestId(byNode("reel.caption.description")).parentElement).not.toHaveAttribute("aria-hidden");
    await onScreen();
    expect(clip().paused).toBe(false);
  });

  it("the veil's face reveals both too", async () => {
    mountStream({ rows: sensitiveRows(), startId: "s1" });
    await onScreen();
    fireEvent.click(screen.getByTestId(byNode("reel.stage.veil")));
    expect(screen.queryByTestId(byNode("reel.caption.show"))).toBeNull();
    await onScreen();
    expect(clip().paused).toBe(false);
  });

  it("a_suppressed_reveal_stands_paused_with_the_play_disc (ReelSensitive.md:21)", async () => {
    suppressesAutoplay({ reducedMotion: true });
    mountStream({ rows: sensitiveRows(), startId: "s1" });
    await onScreen();
    fireEvent.click(screen.getByTestId(byNode("reel.stage.veil")));
    await onScreen();
    expect(clip().paused).toBe(true);
    expect(screen.getByTestId(byNode("reel.playDisc"))).toBeInTheDocument();
  });

  it("a_swipe_past_a_veiled_clip_leaves_it_veiled (ReelSensitive.md:23)", () => {
    mountStream({ rows: sensitiveRows(), startId: "s1" });
    swipe(-200);
    swipe(200);
    expect(screen.getByTestId(byNode("reel.stage.veil"))).toBeInTheDocument();
  });

  it("a_reveal_holds_for_the_session (ReelSensitive.md:29)", () => {
    const { unmount } = mountStream({ rows: sensitiveRows(), startId: "s1" });
    fireEvent.click(screen.getByTestId(byNode("reel.stage.veil")));
    unmount();
    forgetStream();
    mountStream({ rows: sensitiveRows(), startId: "s1" });
    expect(screen.queryByTestId(byNode("reel.stage.veil"))).toBeNull();
  });

  it("the_veiled_score_door_opens_the_sensitive_detail_unrevealed (ReelSensitive.md:31)", () => {
    mountStream({ rows: sensitiveRows(), startId: "s1" });
    // The same door; the detail reads the same unrevealed state.
    expect(screen.getByTestId(byNode("reel.rail.score"))).toHaveAttribute("href", "/posts/s1?from=stream%3As1");
    expect(screen.getByTestId(byNode("reel.stage.veil"))).toBeInTheDocument();
  });

  it("unveil_preference_on_never_veils_the_stream (settings B5)", async () => {
    setAccountFilterLevel(UNVEIL_LEVEL);
    mountStream({ rows: sensitiveRows(), startId: "s1" });
    expect(screen.queryByTestId(byNode("reel.stage.veil"))).toBeNull();
    await onScreen();
    expect(clip().paused).toBe(false);
  });

  it("rotation_over_a_veiled_clip_opens_nothing_until_the_unveil (the veiled-rotation law)", async () => {
    turnsTheScreen("portrait-primary");
    mountStream({ rows: sensitiveRows(), startId: "s1" });
    await onScreen();
    act(() => turnsTheScreen("landscape-primary"));
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId(byNode("reel.stage.veil"))).toBeInTheDocument();
  });

  it("the veil's face is a leaf inside reel.stage, beside the clip it hides (nodes.json reel.stage.veil)", () => {
    mountStream({ rows: [reelPost("s1", "9:16", SENSITIVE)], startId: "s1" });
    const stageNode = screen.getByTestId(byNode("reel.stage"));
    const veil = screen.getByTestId(byNode("reel.stage.veil"));
    expect(stageNode).toContainElement(veil);
    // Only the clip beneath is hidden from assistive tech, never the veil's control.
    expect(stageNode).not.toHaveAttribute("aria-hidden");
    expect(screen.getByRole("button", { name: /^Sensitive — tap to view/ })).toBe(veil);
    expect(clip().closest("[aria-hidden=true]")).not.toBeNull();
  });

  it("the platform's verdict names its own source on the face", () => {
    mountStream({ rows: [reelPost("s1", "9:16", VERDICT)], startId: "s1" });
    expect(screen.getByTestId(byNode("reel.stage.veil"))).toHaveTextContent("The platform's verdict");
  });

  it("the stream's media face reads the source and the author's reason after it (ReelSensitive.md:9; round 26)", () => {
    mountStream({ rows: [reelPost("s1", "9:16", { ...SENSITIVE, sensitiveReason: "One rubbing includes a dead seabird." })], startId: "s1" });
    const veil = screen.getByTestId(byNode("reel.stage.veil"));
    expect(veil).toHaveTextContent("The author's warning — One rubbing includes a dead seabird.");
    expect(veil).toHaveAccessibleName("Sensitive — tap to view. The author's warning — One rubbing includes a dead seabird.");
  });

  it("an author's own mark names the author's warning, though moderationStatus reads SENSITIVE with it (#336 defect)", () => {
    mountStream({ rows: [reelPost("s1", "9:16", SENSITIVE)], startId: "s1" });
    const veil = screen.getByTestId(byNode("reel.stage.veil"));
    expect(veil).toHaveTextContent("The author's warning");
    expect(veil).not.toHaveTextContent("The platform's verdict");
  });
});

describe("the rail over History's rows (PR-40)", () => {
  it("a_rail_opened_from_history_wears_the_history_cards_looked_up_figure (Reel.md:21; History.md:29)", () => {
    // History's card looks its figure up in the reader's last feed fetch, and
    // the rail over History's rows wears that same figure.
    holdRanking(null, answerOf({ p2: 4.25 }), "viewer");
    mountStream({ origin: { kind: "history" }, startId: "p2" });
    expect(screen.getByTestId(byNode("reel.rail.score.value"))).toHaveTextContent("4.25");
  });
});
