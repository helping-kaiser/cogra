// THE DETAIL CLIP IS ITS DETAIL'S ONE STAGE (the stage-law packet §6 stage-test
// row; §3.2 rule 12, reworked by jakob's ruling 100 — design/readme.md §13,
// "The clip detail rulings"; PostDetailVideo.md:3–63,
// PostDetailVideoSensitive.md:3–19). One test per behavior line where the
// line is this stage's; the lines that are the transport's, the hand-over's
// or the page's are pinned where those live and named at the foot of this
// file.
//
// The open starts it, never the 70% gate; the scroll decides nothing — out of
// view it plays on, back in view a paused clip stays paused; it stops under
// every sheet and dialog over the post and, dismissed, resumes only what it
// stopped; the reader's pause survives; the pad pauses and resumes; the unveil
// plays it where the device allows. The detail is wired as `post-view.tsx`
// wires it: the detail clip and the card each behind a `BodyRegion` sharing
// the post's one reveal, the comments sheet with its own thread stage, and the
// layers that rise over the post. The viewer's hand-over is
// `continuity.test.tsx`'s; how it meets the dismissal rule is pinned here,
// under "the viewer's carry".

import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JoinPrompt } from "@/lib/ui/join-prompt";
import { BodyRegion } from "@/lib/ui/post-media";
import {
  endsClip,
  intersectEach,
  isObserved,
  setsPageVisibility,
  statesDuration,
  suppressesAutoplay,
  turnsTheScreen,
} from "@/test/media-env";

import { BottomSheet } from "../bottom-sheet";
import { useCoversSurface, type CoverKind } from "../covering-layer";
import { RemoveConfirm } from "../remove-confirm";
import { DetailClip } from "./detail-clip";
import { MediaViewer } from "./media-viewer";
import { isMuted, resetMuteForTests } from "./mute";
import { forgetReveals, sensitiveSignature } from "./reveal";
import { Stage } from "./stage";
import { GATE } from "./stage-election";
import { StageHost } from "./stage-host";
import { VideoPlayer } from "./video-player";
import { resetVideoStageForTests } from "./video-stage";
import { SKIP_SECONDS } from "./video-transport";

beforeEach(forgetReveals);
afterEach(() => {
  resetMuteForTests();
  resetVideoStageForTests();
  vi.useRealTimers();
});

const CLIP = "https://media.example/clip.mp4";
const COVER = "https://media.example/cover.webp";
const SIGNATURE = sensitiveSignature({ attachmentsStatus: "SENSITIVE", moderationStatus: "NORMAL" });
const noop = () => {};

type Raised = {
  /** The comments sheet, raised by the card's comment count (PostDetailVideo.md:39). */
  comments?: boolean;
  /** Another sheet over the post — the license the post's menu raises. */
  license?: boolean;
  /** A dialog over the post. */
  join?: boolean;
  /** The think-twice dialog behind the post's Remove row. */
  remove?: boolean;
  /** The opinion pad over the post (`StanceControl`'s own `"pause"` layer). */
  pad?: boolean;
  /** The comments sheet's handover frame (`BottomSheet`'s `coverHeld`). */
  held?: boolean;
  /** A full-focus takeover the thread yields to: the reply wizard, the comment editor. */
  takeover?: boolean;
};

/** A layer's announcement, as the pad (`"pause"`) and a takeover (`"suspend"`) make it. */
function Layer({ open, kind }: { open: boolean; kind: CoverKind }) {
  useCoversSurface(open, kind);
  return null;
}

/**
 * The detail as `post-view.tsx` wires it — every layer raised in a commit of
 * its own, in the order a reader raises them.
 */
function Detail({
  raised = {},
  sensitive = false,
  thread = [],
}: {
  raised?: Raised;
  sensitive?: boolean;
  thread?: readonly string[];
}) {
  return (
    <>
      <div data-testid="block">
        <BodyRegion veiled={sensitive} nodeId="post-1" signature={SIGNATURE} testId="post-detail-clip">
          <DetailClip src={CLIP} mimeType="video/mp4" poster={COVER} mediaId="m1" testId="detail" />
        </BodyRegion>
        <article data-testid="the-card">
          <BodyRegion veiled={sensitive} nodeId="post-1" signature={SIGNATURE} testId="card">
            <p>The post&apos;s body.</p>
          </BodyRegion>
        </article>
      </div>
      <BottomSheet
        open={raised.comments ?? false}
        coverHeld={raised.held ?? false}
        onClose={noop}
        title="Comments"
      >
        <StageHost>
          {thread.map((id) => (
            <VideoPlayer key={id} src={CLIP} surface="reading" testId={id} />
          ))}
        </StageHost>
      </BottomSheet>
      <BottomSheet open={raised.license ?? false} onClose={noop} title="License">
        <p>CC BY 4.0</p>
      </BottomSheet>
      <JoinPrompt open={raised.join ?? false} onClose={noop} />
      <RemoveConfirm open={raised.remove ?? false} onClose={noop} onRemove={noop} />
      <Layer open={raised.pad ?? false} kind="pause" />
      <Layer open={raised.takeover ?? false} kind="suspend" />
    </>
  );
}

const video = (testId: string) => screen.getByTestId(testId) as HTMLVideoElement;
const detailClip = () => video("detail-media");
/** Where the frame stands on screen, as the stage's one observer reports it. */
const showing = (ratio: number, ...testIds: string[]) =>
  act(() => intersectEach(testIds.map((testId) => ({ target: video(testId), ratio }))));
const onScreen = (...testIds: string[]) => showing(1, ...testIds);
/** The transport's play/pause, which is the reader's own press (PostDetailVideo.md:21). */
const pressPlayPause = () => fireEvent.click(screen.getByTestId("detail-media-transport-play"));
const at = (seconds: number) =>
  act(() => {
    detailClip().currentTime = seconds;
  });

describe("where it stands (PostDetailVideo.md:3/5)", () => {
  it("stands at the top of the detail above the card, flush on it as one block (:3)", () => {
    render(<Detail />);
    const clip = screen.getByTestId("detail");
    const card = screen.getByTestId("the-card");
    expect(clip.compareDocumentPosition(card)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(card).not.toContainElement(clip);
  });

  it("the_clip_scrolls_with_the_page: nothing holds it on screen while the page moves (:5)", () => {
    render(<Detail />);
    // Neither the frame nor anything between it and the page is held: no
    // sticky or fixed position on the clip's own chain.
    for (let node: HTMLElement | null = screen.getByTestId("detail"); node; node = node.parentElement) {
      expect(node.className).not.toMatch(/\b(sticky|fixed)\b/);
      expect(node.style.position).not.toMatch(/sticky|fixed/);
    }
  });
});

describe("the open (PostDetailVideo.md:7/9, ruling 100(a))", () => {
  it("opening_the_detail_starts_the_clip_without_the_70_percent_gate: it plays with no share of the screen reported (:7)", () => {
    render(<Detail />);
    // Nothing measured yet, and nothing needed: the open is the gate.
    expect(detailClip().paused).toBe(false);
  });

  it("plays on when the first report finds it below the gate — a clip taller than the screen, or opened scrolled (:7)", () => {
    render(<Detail />);
    showing(GATE / 3, "detail-media");
    expect(detailClip().paused).toBe(false);
  });

  it("under suppressed autoplay never starts on its own — not on the open, not on any report (:9)", () => {
    suppressesAutoplay({ reducedMotion: true });
    render(<Detail />);
    onScreen("detail-media");
    expect(detailClip().paused).toBe(true);
    // The transport's play is the reader's own start.
    pressPlayPause();
    expect(detailClip().paused).toBe(false);
  });

  it("the open is the only start: autoplay coming back later starts nothing (:9, readme §13 'on the detail the open is the only start')", () => {
    suppressesAutoplay({ saveData: true });
    render(<Detail />);
    act(() => suppressesAutoplay({ saveData: false }));
    onScreen("detail-media");
    expect(detailClip().paused).toBe(true);
  });

  it("a sensitive, unrevealed post: the clip veils in its place, wears no transport and never plays (PostDetailVideoSensitive.md:3/7)", () => {
    render(<Detail sensitive />);
    onScreen("detail-media");
    expect(detailClip().paused).toBe(true);
    expect(screen.getByTestId("post-detail-clip-veil")).toBeInTheDocument();
    expect(screen.queryByTestId("detail-media-transport")).toBeNull();
    expect(screen.queryByTestId("detail-media-sound")).toBeNull();
    expect(screen.queryByTestId("detail-media-play")).toBeNull();
  });

  it("a mid-play suppression flip never stops the clip (item 96)", () => {
    suppressesAutoplay({});
    render(<Detail />);
    expect(detailClip().paused).toBe(false);
    act(() => suppressesAutoplay({ reducedMotion: true }));
    expect(detailClip().paused).toBe(false);
  });
});

describe("the scroll (PostDetailVideo.md:11/13, ruling 100(c)(d))", () => {
  it("a_clip_scrolled_away_plays_on_with_no_mini_player (:11)", () => {
    render(<Detail />);
    at(3);
    showing(0, "detail-media");
    expect(detailClip().paused).toBe(false);
    // No player takes its place: the one clip is the one element on the page,
    // standing where it stood.
    expect(document.querySelectorAll("video")).toHaveLength(1);
    expect(screen.getByTestId("detail")).toContainElement(detailClip());
  });

  it("a_paused_clip_never_starts_on_scroll_back (:13)", () => {
    render(<Detail />);
    pressPlayPause();
    expect(detailClip().paused).toBe(true);
    showing(0, "detail-media");
    showing(1, "detail-media");
    expect(detailClip().paused).toBe(true);
  });

  it("a clip it never started stays still through every report — suppressed, scrolled away and back (:13)", () => {
    suppressesAutoplay({ reducedMotion: true });
    render(<Detail />);
    showing(0, "detail-media");
    showing(1, "detail-media");
    expect(detailClip().paused).toBe(true);
  });

  it("still watches its frame — the stage keeps asking where it stands — while deciding nothing from it", () => {
    render(<Detail />);
    expect(isObserved(detailClip())).toBe(true);
  });
});

describe("the transport (PostDetailVideo.md:15–27)", () => {
  it("carries play and pause between the two skips, and elapsed, the timeline, total, sound and fullscreen on its bar (:15)", () => {
    render(
      <DetailClip src={CLIP} mimeType="video/mp4" mediaId="m1" onOpenViewer={noop} testId="detail" />,
    );
    const ids = (container: HTMLElement) =>
      [...container.querySelectorAll("[data-testid]")].map((node) => node.getAttribute("data-testid"));
    const transport = screen.getByTestId("detail-media-transport");
    const centre = screen.getByTestId("detail-media-transport-play").parentElement as HTMLElement;
    expect(ids(centre)).toEqual([
      "detail-media-transport-rewind",
      "detail-media-transport-play",
      "detail-media-transport-forward",
    ]);
    const bar = screen.getByTestId("detail-media-transport-timeline").parentElement as HTMLElement;
    expect(ids(bar)).toEqual([
      "detail-media-transport-elapsed",
      "detail-media-transport-timeline",
      "detail-media-transport-timeline-target",
      "detail-media-transport-timeline-knob",
      "detail-media-transport-duration",
      "detail-media-transport-pair",
      "detail-media-transport-sound",
      "detail-media-transport-fullscreen",
    ]);
    expect(transport).toContainElement(bar);
  });

  it.each([
    ["a five-second clip", 5_000],
    ["a ten-minute clip", 600_000],
  ])("is the same for every clip whatever its length — %s (:17)", (_, durationMs) => {
    render(
      <DetailClip
        src={CLIP}
        mimeType="video/mp4"
        mediaId="m1"
        durationMs={durationMs}
        onOpenViewer={noop}
        testId="detail"
      />,
    );
    for (const control of ["rewind", "play", "forward", "timeline", "sound", "fullscreen"]) {
      expect(screen.getByTestId(`detail-media-transport-${control}`)).toBeInTheDocument();
    }
  });

  it("plays to its end, stops, offers replay and never loops — and no dismissal starts it (:19)", () => {
    const { rerender } = render(<Detail />);
    expect(detailClip().loop).toBe(false);
    // A real element sets `paused` as playback ends (html.spec.whatwg.org,
    // "reaches the end"); the stub only flags `ended`, so the test says both.
    act(() => {
      detailClip().pause();
      endsClip(detailClip());
    });
    expect(screen.getByTestId("detail-media-transport-play")).toHaveAccessibleName("Replay");

    rerender(<Detail raised={{ comments: true }} />);
    rerender(<Detail />);
    onScreen("detail-media");
    expect(detailClip().paused).toBe(true);
  });

  it("play or pause stops or starts the clip where it is (:21)", () => {
    render(<Detail />);
    at(7);
    pressPlayPause();
    expect(detailClip().paused).toBe(true);
    expect(detailClip().currentTime).toBe(7);
    pressPlayPause();
    expect(detailClip().paused).toBe(false);
    expect(detailClip().currentTime).toBe(7);
  });

  it("a skip moves the clip ten seconds back or forward (:23)", () => {
    render(<Detail />);
    act(() => statesDuration(detailClip(), 60));
    at(30);
    fireEvent.click(screen.getByTestId("detail-media-transport-forward"));
    expect(detailClip().currentTime).toBe(30 + SKIP_SECONDS);
    fireEvent.click(screen.getByTestId("detail-media-transport-rewind"));
    fireEvent.click(screen.getByTestId("detail-media-transport-rewind"));
    expect(detailClip().currentTime).toBe(30 - SKIP_SECONDS);
  });

  it("a tap or a drag on the seek line moves the clip under the finger (:25)", () => {
    render(<Detail />);
    act(() => statesDuration(detailClip(), 40));
    const timeline = screen.getByTestId("detail-media-transport-timeline");
    vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue({ left: 0, width: 200 } as DOMRect);
    timeline.setPointerCapture = () => {};
    timeline.hasPointerCapture = () => true;
    fireEvent.pointerDown(timeline, { clientX: 50, pointerId: 1 });
    expect(detailClip().currentTime).toBe(10);
    fireEvent.pointerMove(timeline, { clientX: 150, pointerId: 1 });
    expect(detailClip().currentTime).toBe(30);
  });

  it("the sound control turns sound on or off as the one sticky decision every video shares (:27)", () => {
    render(
      <>
        <Detail />
        <VideoPlayer src={CLIP} testId="elsewhere" />
      </>,
    );
    expect(isMuted()).toBe(true);
    fireEvent.click(screen.getByTestId("detail-media-transport-sound"));
    expect(isMuted()).toBe(false);
    expect(detailClip().muted).toBe(false);
    expect(video("elsewhere").muted).toBe(false);
  });
});

/** The detail with its fullscreen viewer, as `post-view.tsx` raises it. */
function WithViewer({
  raised = {},
  sourceRatio = 9 / 16,
  sensitive = false,
}: {
  raised?: Raised;
  sourceRatio?: number;
  sensitive?: boolean;
}) {
  const [viewer, setViewer] = useState(false);
  return (
    <>
      <BodyRegion veiled={sensitive} nodeId="post-1" signature={SIGNATURE} testId="post-detail-clip">
        <DetailClip
          src={CLIP}
          mimeType="video/mp4"
          poster={COVER}
          mediaId="m1"
          sourceRatio={sourceRatio}
          behindViewer={viewer}
          onOpenViewer={() => setViewer(true)}
          testId="detail"
        />
      </BodyRegion>
      <BottomSheet open={raised.comments ?? false} onClose={noop} title="Comments">
        <p>No comments yet.</p>
      </BottomSheet>
      {viewer && (
        <MediaViewer
          items={[{ src: CLIP, mimeType: "video/mp4", poster: COVER, mediaId: "m1" }]}
          onClose={() => setViewer(false)}
          testId="viewer"
        />
      )}
    </>
  );
}

const viewerClip = () => video("viewer-video");
const openViewer = () => fireEvent.click(screen.getByTestId("detail-media-transport-fullscreen"));
const closeViewer = () => fireEvent.click(screen.getByTestId("viewer-close"));

describe("the clip's own tap and the ways into the viewer (PostDetailVideo.md:29–37, :63)", () => {
  it("with the web's chrome auto-hidden, a tap brings the chrome back and never opens the viewer (:29)", () => {
    vi.useFakeTimers();
    render(<WithViewer />);
    expect(detailClip().paused).toBe(false);
    act(() => vi.advanceTimersByTime(4_000));
    expect(screen.queryByTestId("detail-media-transport")).toBeNull();

    act(() => {
      detailClip().click();
    });
    expect(screen.getByTestId("detail-media-transport")).toBeInTheDocument();
    expect(screen.queryByTestId("viewer")).toBeNull();
  });

  it("with the chrome up, a tap from anywhere but the stream opens the fullscreen viewer on the clip (:35)", () => {
    render(<WithViewer />);
    const element = detailClip();
    act(() => {
      element.click();
    });
    expect(screen.getByTestId("viewer")).toBeInTheDocument();
    expect(viewerClip()).toBe(element);
  });

  it("the fullscreen toggle opens the fullscreen viewer on the clip (:37)", () => {
    render(<WithViewer />);
    openViewer();
    expect(screen.getByTestId("viewer")).toBeInTheDocument();
  });

  it("the phone turning to landscape over a landscape clip opens the viewer on it (:63)", () => {
    turnsTheScreen("portrait-primary");
    render(<WithViewer sourceRatio={16 / 9} />);
    at(4);
    const element = detailClip();
    act(() => turnsTheScreen("landscape-primary"));
    expect(screen.getByTestId("viewer")).toBeInTheDocument();
    // The same hand-over as the toggle's: the one clip, at its frame, playing.
    expect(viewerClip()).toBe(element);
    expect(viewerClip().currentTime).toBe(4);
    expect(viewerClip().paused).toBe(false);
  });

  it("the turn opens nothing over a portrait clip, or a veiled one (:63 'GIVEN the detail holds a landscape clip')", () => {
    turnsTheScreen("portrait-primary");
    const { unmount } = render(<WithViewer sourceRatio={9 / 16} />);
    act(() => turnsTheScreen("landscape-primary"));
    expect(screen.queryByTestId("viewer")).toBeNull();
    unmount();

    act(() => turnsTheScreen("portrait-primary"));
    render(<WithViewer sourceRatio={16 / 9} sensitive />);
    act(() => turnsTheScreen("landscape-primary"));
    expect(screen.queryByTestId("viewer")).toBeNull();
  });
});

describe("a sheet or a dialog over the post (PostDetailVideo.md:39–47)", () => {
  it("the comment count's sheet stops the clip where it is, while the thread on it plays by its own stage (:39)", () => {
    const { rerender } = render(<Detail thread={["t1", "t2"]} />);
    at(4);

    rerender(<Detail thread={["t1", "t2"]} raised={{ comments: true }} />);
    expect(detailClip().paused).toBe(true);
    expect(detailClip().currentTime).toBe(4);

    onScreen("t1", "t2");
    expect(video("t1").paused).toBe(false);
    expect(video("t2").paused).toBe(true);
    // The thread playing never wakes the clip under the sheet.
    expect(detailClip().paused).toBe(true);
  });

  it.each([
    ["the comments sheet", { comments: true }],
    ["another sheet (the license)", { license: true }],
    ["a dialog (the join prompt)", { join: true }],
    ["the think-twice dialog", { remove: true }],
  ] as const)(
    "%s: the clip stops where it is, and resumes where it stopped on dismissal (:41, :43)",
    (_, raised) => {
      const { rerender } = render(<Detail />);
      const element = detailClip();
      at(6);

      rerender(<Detail raised={raised} />);
      expect(detailClip().paused).toBe(true);
      expect(detailClip().currentTime).toBe(6);

      rerender(<Detail />);
      expect(detailClip()).toBe(element);
      expect(detailClip().paused).toBe(false);
      expect(detailClip().currentTime).toBe(6);
    },
  );

  it("resumes on dismissal though the reader scrolled it out of view under the sheet — scroll stops nothing (:43, :11)", () => {
    const { rerender } = render(<Detail />);
    rerender(<Detail raised={{ comments: true }} />);
    showing(0, "detail-media");
    rerender(<Detail />);
    expect(detailClip().paused).toBe(false);
  });

  it("a dialog raised over the comments sheet keeps the clip stopped until the last layer lifts (:43)", () => {
    const { rerender } = render(<Detail />);

    rerender(<Detail raised={{ comments: true }} />);
    rerender(<Detail raised={{ comments: true, join: true }} />);
    rerender(<Detail raised={{ comments: true }} />);
    expect(detailClip().paused).toBe(true);

    rerender(<Detail />);
    expect(detailClip().paused).toBe(false);
  });

  it("the thread yielding to its composer and taking the screen back is one cover, not a dismissal — the clip resumes once, at the real drop (SL-1 flag c)", () => {
    const { rerender } = render(<Detail />);
    rerender(<Detail raised={{ comments: true }} />);
    let starts = 0;
    detailClip().addEventListener("play", () => {
      starts += 1;
    });

    // The sheet drops holding its cover, the takeover stands, the sheet rises
    // again — each in a commit of its own.
    rerender(<Detail raised={{ held: true }} />);
    rerender(<Detail raised={{ held: true, takeover: true }} />);
    rerender(<Detail raised={{ comments: true }} />);
    expect(starts).toBe(0);

    rerender(<Detail />);
    expect(starts).toBe(1);
    expect(detailClip().paused).toBe(false);
  });

  it("a clip the reader had paused never resumes on its own on dismissal (:45)", () => {
    const { rerender } = render(<Detail />);
    pressPlayPause();
    expect(detailClip().paused).toBe(true);
    let starts = 0;
    detailClip().addEventListener("play", () => {
      starts += 1;
    });

    rerender(<Detail raised={{ comments: true }} />);
    rerender(<Detail />);
    onScreen("detail-media");

    expect(starts).toBe(0);
    expect(detailClip().paused).toBe(true);
  });

  it("under suppressed autoplay, a clip the reader started stops under the sheet and never starts on its own after it (:47, C10)", () => {
    suppressesAutoplay({ reducedMotion: true });
    const { rerender } = render(<Detail />);
    expect(detailClip().paused).toBe(true);
    pressPlayPause();
    at(3);
    expect(detailClip().paused).toBe(false);

    rerender(<Detail raised={{ license: true }} />);
    expect(detailClip().paused).toBe(true);
    rerender(<Detail />);
    expect(detailClip().paused).toBe(true);

    // The reader's play starts it again, from the frame it stopped on.
    pressPlayPause();
    expect(detailClip().paused).toBe(false);
    expect(detailClip().currentTime).toBe(3);
  });

  it("suppression arriving while the sheet stands: the dismissal resumes nothing (:47 — the GIVEN reads at dismissal)", () => {
    suppressesAutoplay({});
    const { rerender } = render(<Detail />);
    expect(detailClip().paused).toBe(false);

    rerender(<Detail raised={{ comments: true }} />);
    act(() => suppressesAutoplay({ saveData: true }));
    rerender(<Detail />);

    expect(detailClip().paused).toBe(true);
  });
});

// Page visibility is written in Feed.md and applied page-wide (the packet's
// flag §7.2-a, L09); on the detail stage it meets the covering layers.
describe("the page hidden and shown (F25/F26 Feed.md:51/53, page-wide)", () => {
  it("hiding pauses the detail clip on its frame; showing resumes it from there", () => {
    render(<Detail />);
    at(8);

    act(() => setsPageVisibility("hidden"));
    expect(detailClip().paused).toBe(true);
    act(() => setsPageVisibility("visible"));
    expect(detailClip().paused).toBe(false);
    expect(detailClip().currentTime).toBe(8);
  });

  it("hidden and shown while a sheet stands, the clip waits for the dismissal, which resumes it (:43)", () => {
    const { rerender } = render(<Detail />);

    rerender(<Detail raised={{ comments: true }} />);
    act(() => setsPageVisibility("hidden"));
    act(() => setsPageVisibility("visible"));
    expect(detailClip().paused).toBe(true);

    rerender(<Detail />);
    expect(detailClip().paused).toBe(false);
  });
});

describe("the transport's pause keeps the stage (PostDetailVideo.md:21, :45)", () => {
  it("nothing re-plays a clip the reader paused: not the observer, not autoplay coming back, not the page showing again", () => {
    suppressesAutoplay({});
    render(<Detail />);
    at(5);
    pressPlayPause();
    expect(detailClip().paused).toBe(true);

    onScreen("detail-media");
    act(() => suppressesAutoplay({ reducedMotion: true }));
    act(() => suppressesAutoplay({ reducedMotion: false }));
    act(() => setsPageVisibility("hidden"));
    act(() => setsPageVisibility("visible"));
    expect(detailClip().paused).toBe(true);

    // The reader's play starts it where it stands.
    pressPlayPause();
    expect(detailClip().paused).toBe(false);
    expect(detailClip().currentTime).toBe(5);
  });
});

describe("the opinion pad over the post (PostDetailVideo.md:49/51)", () => {
  it("pauses the playing clip where it is and resumes it where it paused (:49, :51)", () => {
    const { rerender } = render(<Detail />);
    at(2);

    rerender(<Detail raised={{ pad: true }} />);
    expect(detailClip().paused).toBe(true);
    onScreen("detail-media");
    expect(detailClip().paused).toBe(true);

    rerender(<Detail />);
    expect(detailClip().paused).toBe(false);
    expect(detailClip().currentTime).toBe(2);
  });

  it("resumes the clip it paused under suppressed autoplay too (:51 'under suppressed autoplay included')", () => {
    suppressesAutoplay({ saveData: true });
    const { rerender } = render(<Detail />);
    pressPlayPause();
    expect(detailClip().paused).toBe(false);

    rerender(<Detail raised={{ pad: true }} />);
    expect(detailClip().paused).toBe(true);
    rerender(<Detail />);
    expect(detailClip().paused).toBe(false);
  });

  it("closing when it paused nothing starts nothing (:51 'GIVEN it paused the clip')", () => {
    const { rerender } = render(<Detail />);
    pressPlayPause();

    rerender(<Detail raised={{ pad: true }} />);
    rerender(<Detail />);
    expect(detailClip().paused).toBe(true);
  });
});

describe("the unveil (PostDetailVideoSensitive.md:5–19)", () => {
  it("the veiled clip stands above the card in the page's flow, never moved into the card (:5)", () => {
    render(<Detail sensitive />);
    const veil = screen.getByTestId("post-detail-clip-veil");
    const card = screen.getByTestId("the-card");
    expect(veil.compareDocumentPosition(card)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(card).not.toContainElement(screen.getByTestId("detail"));
  });

  it("the clip's veil face unveils it and the card together; the clip, the same element, plays and the transport comes back (:11, :15)", () => {
    render(<Detail sensitive />);
    const element = detailClip();

    fireEvent.click(screen.getByTestId("post-detail-clip-veil-reveal"));

    expect(screen.queryByTestId("post-detail-clip-veil")).toBeNull();
    expect(screen.queryByTestId("card-veil")).toBeNull();
    expect(detailClip()).toBe(element);
    expect(detailClip().paused).toBe(false);
    expect(screen.getByTestId("detail-media-transport")).toBeInTheDocument();
  });

  it("Show on the card's veil unveils the detail clip with the card, and the clip plays (:13, :15)", () => {
    render(<Detail sensitive />);

    fireEvent.click(screen.getByTestId("card-veil-reveal"));

    expect(screen.queryByTestId("post-detail-clip-veil")).toBeNull();
    expect(detailClip().paused).toBe(false);
    expect(screen.getByTestId("detail-media-transport")).toBeInTheDocument();
  });

  it("the unveil plays it with no share of the screen reported — it is the veiled clip's open (:15)", () => {
    render(<Detail sensitive />);
    showing(GATE / 3, "detail-media");
    fireEvent.click(screen.getByTestId("post-detail-clip-veil-reveal"));
    expect(detailClip().paused).toBe(false);
  });

  it("under suppressed autoplay the unveil starts nothing; the transport's play does (:17)", () => {
    suppressesAutoplay({ reducedMotion: true });
    render(<Detail sensitive />);

    fireEvent.click(screen.getByTestId("post-detail-clip-veil-reveal"));
    expect(detailClip().paused).toBe(true);

    pressPlayPause();
    expect(detailClip().paused).toBe(false);
  });

  it("the reveal holds for the session: the detail opened again stands unveiled and plays (:19)", () => {
    const first = render(<Detail sensitive />);
    fireEvent.click(screen.getByTestId("post-detail-clip-veil-reveal"));
    first.unmount();

    render(<Detail sensitive />);
    expect(screen.queryByTestId("post-detail-clip-veil")).toBeNull();
    expect(detailClip().paused).toBe(false);
  });
});

// The viewer is a covering layer over the post too, but its close is an
// EXPLICIT CARRY of the viewer's own play state (PostDetailVideo.md:59/61),
// and the carry is the last word on the clip: the dismissal rule (:43/:45)
// resumes only what a layer stopped, and the clip was handed over — not
// stopped by the layer — before the viewer stood.
describe("the viewer's carry and the dismissal rule (:59/:61 over :43/:45)", () => {
  it("a viewer paused by the reader returns paused though the detail clip was playing when it rose — and stays so through the next sheet (:61, :45)", () => {
    const { rerender } = render(<WithViewer />);
    expect(detailClip().paused).toBe(false);

    openViewer();
    fireEvent.click(screen.getByTestId("viewer-video-transport-play"));
    expect(viewerClip().paused).toBe(true);
    closeViewer();
    onScreen("detail-media");
    expect(detailClip().paused).toBe(true);

    // The carried pause is the reader's pause: a sheet over the post and its
    // dismissal resume nothing.
    rerender(<WithViewer raised={{ comments: true }} />);
    rerender(<WithViewer />);
    expect(detailClip().paused).toBe(true);
  });

  it("a viewer the reader played returns playing though the reader had paused the detail clip before it rose (:59 over :45)", () => {
    render(<WithViewer />);
    pressPlayPause();
    expect(detailClip().paused).toBe(true);

    openViewer();
    expect(viewerClip().paused).toBe(true);
    fireEvent.click(screen.getByTestId("viewer-video-transport-play"));
    act(() => {
      viewerClip().currentTime = 7;
    });
    closeViewer();

    expect(detailClip().paused).toBe(false);
    expect(detailClip().currentTime).toBe(7);
  });

  it("the viewer's return is no second open: a returned pause stays a pause (:61, readme §13 'the open is the only start')", () => {
    render(<WithViewer />);
    openViewer();
    fireEvent.click(screen.getByTestId("viewer-video-transport-play"));
    closeViewer();
    showing(0, "detail-media");
    showing(1, "detail-media");
    expect(detailClip().paused).toBe(true);
  });

  it("a carried playing clip stops under the next sheet and resumes on its dismissal, by the ordinary rule (:43)", () => {
    const { rerender } = render(<WithViewer />);
    openViewer();
    closeViewer();
    expect(detailClip().paused).toBe(false);

    rerender(<WithViewer raised={{ comments: true }} />);
    expect(detailClip().paused).toBe(true);
    rerender(<WithViewer />);
    expect(detailClip().paused).toBe(false);
  });
});

// The same, on the engine itself and in the order React never takes: the
// layer reaching the stage while the clip still stands on it. Whatever order
// the platform delivers the two in, the carry is the last word.
describe("the detail stage's engine (rule 12, ruling 100)", () => {
  function detailStage({ allowed = true }: { allowed?: boolean } = {}) {
    const stage = new Stage({ visible: true, allowed, detail: true });
    const element = document.createElement("video");
    const key = {};
    stage.register(key, element, false);
    stage.arrive(key, false);
    return { stage, element, key };
  }

  it("the open starts the clip with nothing measured, and only once", () => {
    const { stage, element, key } = detailStage();
    expect(element.paused).toBe(false);
    element.pause();
    stage.arrive(key, false);
    expect(element.paused).toBe(true);
    stage.dispose();
  });

  it("no measurement starts or stops it, at any ratio", () => {
    const { stage, element } = detailStage();
    for (const ratio of [0, GATE / 2, GATE, 1, 0]) {
      stage.measure([{ target: element, intersectionRatio: ratio }]);
      expect(element.paused).toBe(false);
    }
    element.pause();
    stage.measure([{ target: element, intersectionRatio: 1 }]);
    expect(element.paused).toBe(true);
    stage.dispose();
  });

  it("an open under suppression starts nothing, and allowing later starts nothing either", () => {
    const { stage, element } = detailStage({ allowed: false });
    expect(element.paused).toBe(true);
    stage.setAllowed(true);
    expect(element.paused).toBe(true);
    stage.dispose();
  });

  it("a carried pause settles what the layer's lifting owed: nothing resumes (:61 over :43)", () => {
    const { stage, element, key } = detailStage();
    expect(element.paused).toBe(false);

    stage.setCover("suspended");
    expect(element.paused).toBe(true);
    stage.seat(key);
    stage.setCover(null);

    expect(element.paused).toBe(true);
    stage.dispose();
  });

  it("without a carry, the same lifting resumes the clip it stopped (:43)", () => {
    const { stage, element } = detailStage();
    stage.setCover("suspended");
    stage.setCover(null);
    expect(element.paused).toBe(false);
    stage.dispose();
  });
});

// SF-1's flag 7: "The thread host after its sheet closes reads as page-level.
// A thread clip can keep its holder until the observer reports 0; the player
// layer pauses it when the feed's clip starts." On the detail, the clip that
// starts is the detail clip's dismissal resume — and the thread's stage, still
// holding the clip the player layer paused, would start nothing when the sheet
// rose again. A dropped sheet's surface is not on screen (`coverOf`).
describe("the thread when its sheet drops (SF-1 flag 7)", () => {
  it("stops its clip at the drop, and decides from empty when the sheet rises again — the detail clip stopping in turn", () => {
    const { rerender } = render(<Detail thread={["t1", "t2"]} />);
    rerender(<Detail thread={["t1", "t2"]} raised={{ comments: true }} />);
    onScreen("t1", "t2");
    expect(video("t1").paused).toBe(false);

    // Dropped: the thread clip stops at once — no observer report needed —
    // and the detail clip resumes (:43).
    rerender(<Detail thread={["t1", "t2"]} />);
    expect(video("t1").paused).toBe(true);
    expect(detailClip().paused).toBe(false);

    // Raised again (inside the exit animation, before the dialog is gone):
    // the thread's topmost qualifying clip takes its stage again.
    rerender(<Detail thread={["t1", "t2"]} raised={{ comments: true }} />);
    expect(video("t1").paused).toBe(false);
    expect(video("t2").paused).toBe(true);
    expect(detailClip().paused).toBe(true);
  });
});

// WHERE THE OTHER LINES ARE PINNED (one test per line, one owner):
// - :31 "the transport chrome stays up on Android" — Android's, not the web's.
// - :33 "came from the stream" — no stream exists to come from (the Reel
//   packet, feed-card-rework BX-2); every reader comes from "anywhere else".
// - :53 card → detail at the card's frame — `continuity.test.tsx` (D11) and
//   `element-carry.test.tsx` (the carried element).
// - :55 back → the card at the detail's frame — `continuity.test.tsx` (D12).
// - :57 the viewer opens and the clip stops, never playing behind it —
//   `continuity.test.tsx` (D13).
// - :59/:61 the viewer's close — `continuity.test.tsx` (D14/D16) and above.
