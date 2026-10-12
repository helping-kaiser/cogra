// THE HANDOVER STILL (`handover-still.tsx`, jakob's hand-test finding 8): a
// played clip's new presentation wears the picture of the frame its last one
// stopped on until its own element can paint that moment — never the frame's
// ground, never frame 0 — and it changes nothing about which clip plays or
// when.
//
// jsdom decodes nothing, so the two facts of the element this rests on are
// stated per element: whether it has a frame to give (`readyState`, its
// decoded size) and whether a seek is in flight (`seeking`). Canvas drawing is
// recorded rather than rendered (jsdom ships no 2D context), which is all the
// handover reads: WHICH picture was drawn where.

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { intersectEach, suppressesAutoplay } from "@/test/media-env";

import * as clipMemory from "./clip-memory";
import { pictureOf } from "./handover-still";
import { MediaViewer } from "./media-viewer";
import { resetMuteForTests } from "./mute";
import { PinnedClip } from "./pinned-clip";
import { Stage } from "./stage";
import { StageHost } from "./stage-host";
import { VideoPlayer } from "./video-player";
import { resetVideoStageForTests } from "./video-stage";

const CLIP = "https://media.example/clip.mp4";
const COVER = "https://media.example/cover.webp";
const ID = "m1";

/** Every `drawImage` a 2D context received, with the canvas it drew into. */
let draws: { into: HTMLCanvasElement; source: unknown }[] = [];

beforeEach(() => {
  draws = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    return {
      drawImage: (source: unknown) => {
        draws.push({ into: this, source });
      },
    } as unknown as CanvasRenderingContext2D;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext);
});

afterEach(() => {
  // Unmounted while the 2D context is still recorded: a player's goodbye
  // pictures its frame, and the shared `cleanup` would run after the restore.
  cleanup();
  vi.restoreAllMocks();
  resetMuteForTests();
  resetVideoStageForTests();
});

const video = (testId: string) => screen.getByTestId(testId) as HTMLVideoElement;
const still = (testId: string) => screen.queryByTestId(`${testId}-still`) as HTMLCanvasElement | null;
const onScreen = (testId: string) =>
  act(() => intersectEach([{ target: video(testId), ratio: 1 }]));

/** The element has decoded the frame it shows — a `width`×`height` one. */
function decoded(element: HTMLVideoElement, width = 720, height = 1280): void {
  Object.defineProperty(element, "readyState", { configurable: true, value: 2 });
  Object.defineProperty(element, "videoWidth", { configurable: true, value: width });
  Object.defineProperty(element, "videoHeight", { configurable: true, value: height });
}

/** The element's seek has landed and it can paint where it stands, and says so. */
function seekLanded(element: HTMLVideoElement): void {
  decoded(element);
  Object.defineProperty(element, "seeking", { configurable: true, value: false });
  fireEvent(element, new Event("seeked"));
}

function Card() {
  return (
    <StageHost>
      <VideoPlayer src={CLIP} poster={COVER} mediaId={ID} testId="card" />
    </StageHost>
  );
}

function Detail() {
  const [viewer, setViewer] = useState(false);
  return (
    <>
      <PinnedClip
        src={CLIP}
        mimeType="video/mp4"
        poster={COVER}
        mediaId={ID}
        behindViewer={viewer}
        onOpenViewer={() => setViewer(true)}
        testId="pinned"
      />
      {viewer && (
        <MediaViewer
          items={[{ src: CLIP, mimeType: "video/mp4", poster: COVER, mediaId: ID }]}
          onClose={() => setViewer(false)}
          testId="viewer"
        />
      )}
    </>
  );
}

/** One route at a time, swapped in one commit as the app router does. */
function Route({ at }: { at: "card" | "detail" }) {
  return at === "card" ? <Card /> : <Detail />;
}

/** A card whose clip played to `time` and holds a decoded frame there. */
function playedCard(time: number) {
  const view = render(<Route at="card" />);
  onScreen("card");
  expect(video("card").paused).toBe(false);
  video("card").currentTime = time;
  decoded(video("card"));
  return view;
}

describe("card → detail: the pinned clip wears the card's frame while it prepares", () => {
  it("covers the new element with a picture of exactly the card's last frame (the naive remount shows the frame's ground)", () => {
    const { rerender } = playedCard(5);
    const cardElement = video("card");

    rerender(<Route at="detail" />);

    // The new element is a fresh one, with nothing decoded and no poster: on
    // its own it paints the frame's ground until its seek lands.
    expect(pinned()).not.toBe(cardElement);
    expect(pinned().readyState).toBe(0);
    expect(pinned()).not.toHaveAttribute("poster");
    // The still stands over it, drawn from the picture taken off the card's
    // element as it left — at the card's decoded size, of the card's moment.
    const over = still("pinned-media");
    expect(over).toBeInstanceOf(HTMLCanvasElement);
    expect(pinned().nextElementSibling).toBe(over);
    const taken = draws.find((d) => d.source === cardElement)?.into;
    expect(taken).toBeDefined();
    expect(draws).toContainEqual({ into: over, source: taken });
    expect(over).toHaveAttribute("width", "720");
    expect(over).toHaveAttribute("height", "1280");
    expect(clipMemory.frameOf(ID)?.time).toBe(5);
  });

  it("lays the picture exactly where the element paints, and lets every press through to it", () => {
    const { rerender } = playedCard(5);
    rerender(<Route at="detail" />);

    const over = still("pinned-media")!;
    expect(over).toHaveAttribute("aria-hidden", "true");
    expect(over.className).toContain("pointer-events-none");
    expect(over.className).toContain("absolute");
    expect(over.className).toContain("inset-0");
    expect(over.className).toContain("object-cover");
    expect(pinned().className).toContain("object-cover");
  });

  it("changes nothing about when the clip plays: the stage starts the element under the still, at the card's frame", () => {
    const { rerender } = playedCard(5);
    rerender(<Route at="detail" />);
    onScreen("pinned-media");

    expect(pinned().paused).toBe(false);
    expect(pinned().currentTime).toBe(5);
    expect(still("pinned-media")).not.toBeNull();
  });

  it("stays up while the seek is in flight, and goes two frames after the element can paint the moment", async () => {
    const { rerender } = playedCard(5);
    rerender(<Route at="detail" />);
    onScreen("pinned-media");

    // Data arrived but the seek has not landed: the element would still paint
    // the wrong frame, or none.
    Object.defineProperty(pinned(), "readyState", { configurable: true, value: 2 });
    Object.defineProperty(pinned(), "seeking", { configurable: true, value: true });
    fireEvent(pinned(), new Event("loadeddata"));
    await act(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    expect(still("pinned-media")).not.toBeNull();

    seekLanded(pinned());
    expect(still("pinned-media")).not.toBeNull();
    await waitFor(() => expect(still("pinned-media")).toBeNull());
  });

  it("gives way to the element's own face when the element cannot load", () => {
    const { rerender } = playedCard(5);
    rerender(<Route at="detail" />);

    fireEvent(pinned(), new Event("error"));

    expect(still("pinned-media")).toBeNull();
  });

  it("holds under suppressed autoplay too, where the element stands paused at the frame", async () => {
    suppressesAutoplay({ saveData: true });
    const view = render(<Route at="card" />);
    onScreen("card");
    fireEvent.click(screen.getByTestId("card-play"));
    video("card").currentTime = 3;
    decoded(video("card"));

    view.rerender(<Route at="detail" />);
    onScreen("pinned-media");

    expect(pinned().paused).toBe(true);
    expect(still("pinned-media")).not.toBeNull();
    seekLanded(pinned());
    await waitFor(() => expect(still("pinned-media")).toBeNull());
  });
});

describe("detail → back: the card wears the pinned clip's frame", () => {
  it("covers the card's new element with the pinned clip's last frame", () => {
    const view = render(<Route at="detail" />);
    onScreen("pinned-media");
    pinned().currentTime = 9;
    decoded(pinned(), 1080, 1920);
    const pinnedElement = pinned();

    view.rerender(<Route at="card" />);

    const over = still("card");
    expect(over).not.toBeNull();
    const taken = draws.find((d) => d.source === pinnedElement)?.into;
    expect(draws).toContainEqual({ into: over, source: taken });
    // Bounded: the longest side is kept at 1280.
    expect(over).toHaveAttribute("width", "720");
    expect(over).toHaveAttribute("height", "1280");
    expect(video("card").currentTime).toBe(9);
  });

  // THE WAY BACK RENDERS LONG BEFORE IT COMMITS (FX-7, jakob's hand test
  // 2026-10-09: back from the detail "reads as a fresh player reloading").
  // React creates a host element, `src` and all, while it renders; the feed's
  // render runs well ahead of its commit, so its card's element arrives having
  // loaded the clip's opening frame, detached — measured in Chromium:
  // readyState 4 at 0 s by the commit. Its still must stand anyway: the moment
  // that element can paint is not the moment the card is pointed at.
  it("covers the card's element even when it arrived having loaded the clip's opening frame while the feed rendered", async () => {
    const view = render(<Route at="detail" />);
    onScreen("pinned-media");
    pinned().currentTime = 9;
    decoded(pinned());
    const pinnedElement = pinned();

    videosArriveLoaded();
    view.rerender(<Route at="card" />);

    // The card reads the pinned clip's goodbye — the newest word on the clip.
    expect(clipMemory.read(ID)?.time).toBe(9);
    expect(video("card").currentTime).toBe(9);
    expect(video("card").readyState).toBe(2);
    const over = still("card");
    expect(over).not.toBeNull();
    const taken = draws.find((d) => d.source === pinnedElement)?.into;
    expect(draws).toContainEqual({ into: over, source: taken });

    // It goes as the forward handover's does: two frames after the seek lands.
    seekLanded(video("card"));
    expect(still("card")).not.toBeNull();
    await waitFor(() => expect(still("card")).toBeNull());
  });

  it("an element that arrives already standing at the pictured moment, with its data, wears no still", () => {
    const view = render(<Route at="detail" />);
    onScreen("pinned-media");
    pinned().currentTime = 9;
    decoded(pinned());

    videosArriveLoaded(9);
    view.rerender(<Route at="card" />);

    expect(video("card").currentTime).toBe(9);
    expect(still("card")).toBeNull();
  });
});

/**
 * Every `<video>` created from here on arrives with data — decoded, at `at` —
 * the way an element React created while rendering a route has loaded by the
 * time that route commits.
 */
function videosArriveLoaded(at = 0): void {
  const create = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((
    tag: string,
    options?: ElementCreationOptions,
  ) => {
    const element = create(tag, options);
    if (element instanceof HTMLVideoElement) {
      decoded(element);
      if (at > 0) element.currentTime = at;
    }
    return element;
  }) as typeof document.createElement);
}

describe("pinned clip → viewer: the viewer opens on the pinned clip's frame", () => {
  it("lays the handed-over frame under the viewer's own fit", () => {
    render(<Detail />);
    onScreen("pinned-media");
    pinned().currentTime = 6;
    decoded(pinned());

    fireEvent.click(screen.getByTestId("pinned-media-transport-fullscreen"));

    const over = still("viewer-video");
    expect(over).not.toBeNull();
    expect(over!.className).toContain("object-contain");
    expect(clipMemory.frameOf(ID)?.time).toBe(6);
    // The carry is unchanged: the viewer's clip plays from the pinned clip's moment.
    expect(video("viewer-video").currentTime).toBe(6);
    expect(video("viewer-video").paused).toBe(false);
  });
});

describe("the still never shows a frame the clip is not at", () => {
  it("a clip that never played wears its stored still — the poster — and no picture", () => {
    suppressesAutoplay({ reducedMotion: true });
    const view = render(<Route at="card" />);
    onScreen("card");
    decoded(video("card"));

    view.rerender(<Route at="detail" />);

    expect(still("pinned-media")).toBeNull();
    expect(pinned()).toHaveAttribute("poster", COVER);
  });

  it("an outgoing element with no decoded frame keeps no picture, and the new presentation draws none", () => {
    const view = render(<Route at="card" />);
    onScreen("card");
    video("card").currentTime = 5;

    view.rerender(<Route at="detail" />);

    expect(clipMemory.frameOf(ID)).toBeUndefined();
    expect(still("pinned-media")).toBeNull();
  });

  it("a played clip scrolled off screen pictures nothing on its way out — nobody is looking at it", () => {
    const view = render(<Route at="card" />);
    onScreen("card");
    video("card").currentTime = 5;
    decoded(video("card"));
    act(() => intersectEach([{ target: video("card"), ratio: 0 }]));

    view.rerender(<Route at="detail" />);

    expect(clipMemory.read(ID)?.time).toBe(5);
    expect(clipMemory.frameOf(ID)).toBeUndefined();
    expect(draws).toEqual([]);
    expect(still("pinned-media")).toBeNull();
  });

  it("a picture of a moment the clip has since moved from is not handed out", () => {
    const picture = document.createElement("canvas");
    clipMemory.write(ID, { time: 5, everPlayed: true });
    clipMemory.keepFrame(ID, { time: 5, picture });
    expect(clipMemory.frameOf(ID)?.picture).toBe(picture);

    clipMemory.write(ID, { time: 7, everPlayed: true });

    expect(clipMemory.frameOf(ID)).toBeUndefined();
  });

  it("a refreshed list forgets its clips' pictures with their frames (FeedCover.md:13)", () => {
    clipMemory.write(ID, { time: 5, everPlayed: true });
    clipMemory.keepFrame(ID, { time: 5, picture: document.createElement("canvas") });

    clipMemory.forgetList([ID]);
    clipMemory.write(ID, { time: 5, everPlayed: true });

    expect(clipMemory.frameOf(ID)).toBeUndefined();
  });

  it("a picture from a presentation born before its clip was forgotten is not heard", () => {
    const born = clipMemory.currentEra();
    clipMemory.forgetList([ID]);
    clipMemory.write(ID, { time: 5, everPlayed: true });

    clipMemory.keepFrame(ID, { time: 5, picture: document.createElement("canvas") }, born);

    expect(clipMemory.frameOf(ID)).toBeUndefined();
  });

  it("keeps only the most recent few pictures", () => {
    const ids = ["a", "b", "c", "d"];
    for (const id of ids) {
      clipMemory.write(id, { time: 1, everPlayed: true });
      clipMemory.keepFrame(id, { time: 1, picture: document.createElement("canvas") });
    }

    expect(clipMemory.FRAMES_KEPT).toBe(3);
    expect(clipMemory.frameOf("a")).toBeUndefined();
    expect(ids.slice(1).every((id) => clipMemory.frameOf(id) !== undefined)).toBe(true);
  });
});

describe("the stage's in-view question (`Stage.inView`)", () => {
  it("answers from the last observer batch and decides nothing", () => {
    const stage = new Stage({ visible: true, allowed: true });
    const key = {};
    const element = document.createElement("video");
    stage.register(key, element, false);
    expect(stage.inView(key)).toBe(false);

    stage.measure([{ target: element, intersectionRatio: 0.2 }]);
    expect(stage.inView(key)).toBe(true);
    stage.measure([{ target: element, intersectionRatio: 0 }]);
    expect(stage.inView(key)).toBe(false);
    expect(stage.inView({})).toBe(false);
    stage.dispose();
  });
});

describe("taking the picture", () => {
  it("takes nothing from an element with no decoded frame", () => {
    const element = document.createElement("video");
    expect(pictureOf(element)).toBeNull();
  });

  it("takes nothing where the platform refuses the draw", () => {
    const element = document.createElement("video");
    decoded(element);
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(
      () =>
        ({
          drawImage: () => {
            throw new DOMException("refused", "InvalidStateError");
          },
        }) as unknown as CanvasRenderingContext2D,
    );
    expect(pictureOf(element)).toBeNull();
  });

  it("draws the element's frame at its own size when that is within bounds", () => {
    const element = document.createElement("video");
    decoded(element, 640, 360);
    const picture = pictureOf(element);
    expect(picture?.width).toBe(640);
    expect(picture?.height).toBe(360);
    expect(draws).toContainEqual({ into: picture, source: element });
  });
});

function pinned() {
  return video("pinned-media");
}
