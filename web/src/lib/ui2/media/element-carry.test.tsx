// ONE LIVE ELEMENT PER CLIP (jakob's ruling q-fx2a; `video-stage.ts`, the
// element pool). A clip moving between its presentations — feed card ↔ the
// detail's clip ↔ the fullscreen viewer — moves its `<video>` with it: the
// next presentation shows the SAME node, at the frame it reached, in the play
// state it had, and nothing points it anywhere, so nothing re-prepares. The
// handover still (`handover-still.tsx`) stays the fallback for a presentation
// the pool has nothing for.
//
// What "nothing re-prepares" means in jsdom: no seek is issued on the carried
// element (a `currentTime` write is a seek, even to where it stands), and a
// playing element is never paused on the way across.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { intersectEach, suppressesAutoplay } from "@/test/media-env";

import * as clipMemory from "./clip-memory";
import { MediaViewer } from "./media-viewer";
import { resetMuteForTests, setMuted } from "./mute";
import { PinnedClip } from "./pinned-clip";
import { StageHost } from "./stage-host";
import { VideoPlayer } from "./video-player";
import {
  ELEMENTS_PARKED,
  carriedOver,
  holds,
  releaseElement,
  resetVideoStageForTests,
  takeElement,
} from "./video-stage";

const CLIP = "https://media.example/clip.mp4";
const COVER = "https://media.example/cover.webp";
const ID = "m1";

beforeEach(() => {
  // jsdom ships no 2D context; the goodbye's picture and the still's drawing
  // are recorded as calls, which is all a handover reads.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => ({ drawImage: () => {} }) as unknown as CanvasRenderingContext2D,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  resetMuteForTests();
  resetVideoStageForTests();
});

const video = (testId: string) => screen.getByTestId(testId) as HTMLVideoElement;
const onScreen = (testId: string, ratio = 1) =>
  act(() => intersectEach([{ target: video(testId), ratio }]));

/** The element has decoded the frame it shows. */
function decoded(element: HTMLVideoElement): void {
  Object.defineProperty(element, "readyState", { configurable: true, value: 4 });
  Object.defineProperty(element, "videoWidth", { configurable: true, value: 720 });
  Object.defineProperty(element, "videoHeight", { configurable: true, value: 1280 });
}

/**
 * Everything an element is asked to do from here on that a handover must not
 * do: seek (every `currentTime` write), pause, or play again.
 */
function watch(element: HTMLVideoElement) {
  const log = { seeks: 0, pauses: 0, plays: 0 };
  const own = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime")!;
  Object.defineProperty(element, "currentTime", {
    configurable: true,
    get() {
      return own.get!.call(this);
    },
    set(seconds: number) {
      log.seeks += 1;
      own.set!.call(this, seconds);
    },
  });
  element.addEventListener("pause", () => (log.pauses += 1));
  // A START, not a call: `play()` on an element already playing changes
  // nothing and fires nothing (html.spec.whatwg.org, the play() algorithm —
  // the `play` event is fired only "if the media element's paused attribute
  // is true"), and the stage's election may well call it on the clip it keeps.
  // The test environment's stub fires `play` either way, so the start is
  // counted where it happens.
  const play = element.play;
  element.play = function (this: HTMLVideoElement) {
    if (this.paused) log.plays += 1;
    return play.call(this);
  };
  return log;
}

function Card({ src = CLIP, testId = "card" }: { src?: string; testId?: string }) {
  return (
    <StageHost>
      <VideoPlayer src={src} poster={COVER} mediaId={ID} testId={testId} />
    </StageHost>
  );
}

function Detail({ src = CLIP }: { src?: string }) {
  const [viewer, setViewer] = useState(false);
  return (
    <>
      <PinnedClip
        src={src}
        mimeType="video/mp4"
        poster={COVER}
        mediaId={ID}
        behindViewer={viewer}
        onOpenViewer={() => setViewer(true)}
        testId="pinned"
      />
      {viewer && (
        <MediaViewer
          items={[{ src, mimeType: "video/mp4", poster: COVER, mediaId: ID }]}
          onClose={() => setViewer(false)}
          testId="viewer"
        />
      )}
    </>
  );
}

/** One route at a time, swapped in one commit as the app router does. */
function Route({ at, src }: { at: "card" | "detail"; src?: string }) {
  return at === "card" ? <Card src={src} /> : <Detail src={src} />;
}

const pinned = () => video("pinned-media");
const viewerClip = () => video("viewer-video");
const openViewer = () => fireEvent.click(screen.getByTestId("pinned-media-transport-fullscreen"));
const closeViewer = () => fireEvent.click(screen.getByTestId("viewer-close"));

/** A card whose clip is playing at `time`, with a decoded frame there. */
function playingCard(time: number) {
  const view = render(<Route at="card" />);
  onScreen("card");
  expect(video("card").paused).toBe(false);
  video("card").currentTime = time;
  decoded(video("card"));
  return view;
}

describe("the element survives the presentation swap", () => {
  it("card → detail: the pinned clip IS the card's element, playing on from its frame with no seek, no pause, no still", () => {
    const { rerender } = playingCard(5);
    const element = video("card");
    const log = watch(element);

    rerender(<Route at="detail" />);

    expect(pinned()).toBe(element);
    expect(element.isConnected).toBe(true);
    expect(carriedOver(element)).toBe(true);
    expect(element.currentTime).toBe(5);
    expect(element.paused).toBe(false);
    // The still finds nothing to cover: the element never stopped painting.
    expect(screen.queryByTestId("pinned-media-still")).toBeNull();
    // The leaving feed's stage did not freeze it on the way out.
    expect(log).toEqual({ seeks: 0, pauses: 0, plays: 0 });
    // It wears the detail's presentation: the transport's programme stops at
    // its end, and the transport reads it as playing.
    expect(element).not.toHaveAttribute("loop");
    expect(screen.getByTestId("pinned-media-transport-play")).toHaveAccessibleName(/pause/i);

    // The detail's first measurement elects it, and it simply plays on.
    onScreen("pinned-media");
    expect(element.paused).toBe(false);
    expect(log).toEqual({ seeks: 0, pauses: 0, plays: 0 });
  });

  it("detail → back: the card IS the pinned clip's element, and the feed's election keeps it playing", () => {
    const { rerender } = render(<Route at="detail" />);
    onScreen("pinned-media");
    const element = pinned();
    element.currentTime = 9;
    decoded(element);
    const log = watch(element);

    rerender(<Route at="card" />);

    expect(video("card")).toBe(element);
    expect(element).toHaveAttribute("loop");
    expect(element.currentTime).toBe(9);
    expect(screen.queryByTestId("card-still")).toBeNull();
    onScreen("card");
    expect(element.paused).toBe(false);
    expect(log).toEqual({ seeks: 0, pauses: 0, plays: 0 });
  });

  it("pinned clip → viewer → pinned clip: one element the whole way, never paused, never sought", () => {
    render(<Detail />);
    onScreen("pinned-media");
    const element = pinned();
    element.currentTime = 6;
    decoded(element);
    const log = watch(element);

    openViewer();

    expect(viewerClip()).toBe(element);
    expect(element.paused).toBe(false);
    expect(element.currentTime).toBe(6);
    // Behind the viewer the pinned clip holds no element at all, so nothing
    // of it can play there (PostDetailVideo.md:47).
    expect(screen.queryByTestId("pinned-media")).toBeNull();
    expect(screen.queryByTestId("viewer-video-still")).toBeNull();

    element.currentTime = 11;
    log.seeks = 0;
    closeViewer();

    expect(pinned()).toBe(element);
    expect(element.currentTime).toBe(11);
    expect(element.paused).toBe(false);
    expect(log).toEqual({ seeks: 0, pauses: 0, plays: 0 });
  });
});

describe("the playback state carries with the element", () => {
  it("a paused clip arrives paused at its frame, and its new surface does not start it under suppression", () => {
    suppressesAutoplay({ reducedMotion: true });
    const { rerender } = render(<Route at="card" />);
    onScreen("card");
    fireEvent.click(screen.getByTestId("card-play"));
    const element = video("card");
    element.currentTime = 3;
    element.pause();

    rerender(<Route at="detail" />);
    onScreen("pinned-media");

    expect(pinned()).toBe(element);
    expect(element.paused).toBe(true);
    expect(element.currentTime).toBe(3);
  });

  it("the sound decision rides on the one element: unmuted in the card, unmuted in the detail", () => {
    const { rerender } = playingCard(2);
    const element = video("card");
    act(() => setMuted(false));
    expect(element.muted).toBe(false);

    rerender(<Route at="detail" />);

    expect(pinned()).toBe(element);
    expect(element.muted).toBe(false);
  });

  it("an arrival its new surface does not elect freezes on the frame it reached, and the elected clip plays", () => {
    const { rerender } = render(<Route at="detail" />);
    onScreen("pinned-media");
    const element = pinned();
    element.currentTime = 4;

    rerender(
      <StageHost>
        <VideoPlayer src="https://media.example/other.mp4" mediaId="m2" testId="above" />
        <VideoPlayer src={CLIP} mediaId={ID} testId="card" />
      </StageHost>,
    );
    expect(video("card")).toBe(element);
    expect(element.paused).toBe(false);

    // The topmost qualifying clip takes the stage (Feed.md:3–55) — not the
    // arrival — and the arrival freezes where it reached.
    act(() =>
      intersectEach([
        { target: video("above"), ratio: 1 },
        { target: element, ratio: 1 },
      ]),
    );
    expect(video("above").paused).toBe(false);
    expect(element.paused).toBe(true);
    expect(element.currentTime).toBe(4);
  });
});

describe("the pool: what is parked, and what is taken", () => {
  it("leaving the last presentation parks the element for the clip, and the next presentation takes it", () => {
    const { unmount } = playingCard(5);
    const element = video("card");

    unmount();
    expect(element.isConnected).toBe(false);

    render(<Detail />);
    expect(pinned()).toBe(element);
  });

  it("a clip that never moved is not parked: its next presentation builds its own element", () => {
    suppressesAutoplay({ reducedMotion: true });
    const { rerender } = render(<Route at="card" />);
    onScreen("card");
    const element = video("card");

    rerender(<Route at="detail" />);

    expect(pinned()).not.toBe(element);
    expect(pinned()).toHaveAttribute("poster", COVER);
  });

  it("evicts the oldest parked element past the bound, and lets its media go", () => {
    const holder = {};
    const first = takeElement(holder, { mediaId: "c0", src: "s0" }).video;
    first.setAttribute("src", "s0");
    releaseElement(holder, first, { keep: true, moved: true });
    for (let n = 1; n <= ELEMENTS_PARKED; n += 1) {
      const next = takeElement(holder, { mediaId: `c${n}`, src: `s${n}` }).video;
      releaseElement(holder, next, { keep: true, moved: true });
    }

    expect(first).not.toHaveAttribute("src");
    const again = takeElement({}, { mediaId: "c0", src: "s0" });
    expect(again.carried).toBe(false);
    expect(again.video).not.toBe(first);
    // The newest are still there.
    expect(takeElement({}, { mediaId: `c${ELEMENTS_PARKED}`, src: `s${ELEMENTS_PARKED}` }).carried).toBe(
      true,
    );
  });

  it("a newer presentation that moved the clip without parking retires the older parked element", () => {
    const a = {};
    const b = {};
    const older = takeElement(a, { mediaId: ID, src: CLIP }).video;
    releaseElement(a, older, { keep: true, moved: true });
    // The pool hands the parked one to the next taker; a SECOND presentation
    // of the clip at the same time gets its own.
    const taken = takeElement(a, { mediaId: ID, src: CLIP }).video;
    expect(taken).toBe(older);
    const second = takeElement(b, { mediaId: ID, src: CLIP }).video;
    expect(second).not.toBe(older);
    releaseElement(a, older, { keep: true, moved: true });
    releaseElement(b, second, { keep: false, moved: true });

    expect(takeElement({}, { mediaId: ID, src: CLIP }).carried).toBe(false);
  });

  it("a refresh that forgets the clip refuses the element built before it (FeedCover.md:13)", () => {
    const { unmount } = playingCard(5);
    const element = video("card");
    unmount();

    clipMemory.forgetList([ID]);
    render(<Detail />);

    expect(pinned()).not.toBe(element);
    expect(pinned().currentTime).toBe(0);
    expect(pinned()).toHaveAttribute("poster", COVER);
  });

  it("a different source for the same clip is not carried", () => {
    const { rerender } = playingCard(5);
    const element = video("card");

    rerender(<Route at="detail" src="https://media.example/clip-720.mp4" />);

    expect(pinned()).not.toBe(element);
  });

  it("an element the pool never handed out is never taken — not a detached one holding the clip's opening frame (FX-7)", () => {
    // What React used to build while RENDERING a route: an element for the
    // clip, detached, with frame 0 loaded. It is no presentation's release.
    const stray = document.createElement("video");
    stray.setAttribute("src", CLIP);
    decoded(stray);

    render(<Detail />);

    expect(pinned()).not.toBe(stray);
    expect(carriedOver(pinned())).toBe(false);
    // The player builds its element in the commit, never while rendering: it
    // is in the document by the time anything asks what it can paint.
    expect(pinned().isConnected).toBe(true);
  });

  it("a surface never acts on an element another presentation holds", () => {
    const a = {};
    const b = {};
    const element = takeElement(a, { mediaId: ID, src: CLIP }).video;
    expect(holds(a, element)).toBe(true);
    releaseElement(a, element, { keep: true, moved: true });
    takeElement(b, { mediaId: ID, src: CLIP });

    expect(holds(a, element)).toBe(false);
    expect(holds(b, element)).toBe(true);
    // Elements outside the pool answer to whoever holds them.
    expect(holds(a, document.createElement("video"))).toBe(true);
  });
});

describe("the still stays the fallback where the pool has nothing", () => {
  it("a pool miss builds a new element, and the still covers it with the card's last frame", () => {
    const { rerender } = playingCard(5);
    const element = video("card");

    rerender(<Route at="detail" src="https://media.example/clip-720.mp4" />);

    expect(pinned()).not.toBe(element);
    expect(pinned().readyState).toBe(0);
    expect(screen.getByTestId("pinned-media-still")).toBeInstanceOf(HTMLCanvasElement);
    expect(pinned().currentTime).toBe(5);
  });
});
