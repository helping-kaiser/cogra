// THE PINNED CLIP IS ITS DETAIL'S ONE STAGE (the stage-law packet §6
// `pinned-clip-stage.test.tsx` row; §3.2 rule 12; PostDetailVideo.md:9–41,
// PostDetailVideoSensitive.md:3–17). It stops under every sheet and dialog over
// the post and, dismissed, resumes only what it stopped; the reader's pause
// survives; the pad pauses and resumes; the unveil plays it where the device
// allows. The detail is wired as `post-view.tsx` wires it: the pinned clip and
// the card each behind a `BodyRegion` sharing the post's one reveal, the
// comments sheet with its own thread stage, and the layers that rise over the
// post. The viewer's hand-over is `continuity.test.tsx`'s; how it meets the
// dismissal rule is pinned here, under "the viewer's carry".

import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { JoinPrompt } from "@/lib/ui/join-prompt";
import { BodyRegion } from "@/lib/ui/post-media";
import {
  endsClip,
  intersectEach,
  setsPageVisibility,
  suppressesAutoplay,
} from "@/test/media-env";

import { BottomSheet } from "../bottom-sheet";
import { useCoversSurface, type CoverKind } from "../covering-layer";
import { RemoveConfirm } from "../remove-confirm";
import { MediaViewer } from "./media-viewer";
import { resetMuteForTests } from "./mute";
import { PinnedClip } from "./pinned-clip";
import { forgetReveals, sensitiveSignature } from "./reveal";
import { Stage } from "./stage";
import { StageHost } from "./stage-host";
import { VideoPlayer } from "./video-player";
import { resetVideoStageForTests } from "./video-stage";

beforeEach(forgetReveals);
afterEach(() => {
  resetMuteForTests();
  resetVideoStageForTests();
});

const CLIP = "https://media.example/clip.mp4";
const COVER = "https://media.example/cover.webp";
const SIGNATURE = sensitiveSignature({ attachmentsStatus: "SENSITIVE", moderationStatus: "NORMAL" });
const noop = () => {};

type Raised = {
  /** The comments sheet, raised by the card's comment count (PostDetailVideo.md:29). */
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
      <BodyRegion veiled={sensitive} nodeId="post-1" signature={SIGNATURE} testId="post-pinned-clip">
        <PinnedClip src={CLIP} mimeType="video/mp4" poster={COVER} mediaId="m1" testId="pinned" />
      </BodyRegion>
      <BodyRegion veiled={sensitive} nodeId="post-1" signature={SIGNATURE} testId="card">
        <p>The post&apos;s body.</p>
      </BodyRegion>
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
const pinned = () => video("pinned-media");
const onScreen = (...testIds: string[]) =>
  act(() => intersectEach(testIds.map((testId) => ({ target: video(testId), ratio: 1 }))));
/** The transport's play/pause, which is the reader's own press (PostDetailVideo.md:11). */
const pressPlayPause = () => fireEvent.click(screen.getByTestId("pinned-media-transport-play"));
const at = (seconds: number) =>
  act(() => {
    pinned().currentTime = seconds;
  });

describe("arrival (rule 12)", () => {
  it("plays where the device allows autoplay — the thing the reader came for", () => {
    render(<Detail />);
    onScreen("pinned-media");
    expect(pinned().paused).toBe(false);
  });

  it("a sensitive, unrevealed post: the clip veils in its place, wears no transport and never plays (V01 PostDetailVideoSensitive.md:3/7)", () => {
    render(<Detail sensitive />);
    onScreen("pinned-media");
    expect(pinned().paused).toBe(true);
    expect(screen.getByTestId("post-pinned-clip-veil")).toBeInTheDocument();
    expect(screen.queryByTestId("pinned-media-transport")).toBeNull();
    expect(screen.queryByTestId("pinned-media-sound")).toBeNull();
    expect(screen.queryByTestId("pinned-media-play")).toBeNull();
  });
});

describe("a sheet or a dialog over the post (PostDetailVideo.md:29–37)", () => {
  it("the comment count's sheet stops the clip where it is, while the thread on it plays by its own stage (D02 :29, L04)", () => {
    const { rerender } = render(<Detail thread={["t1", "t2"]} />);
    onScreen("pinned-media");
    at(4);

    rerender(<Detail thread={["t1", "t2"]} raised={{ comments: true }} />);
    expect(pinned().paused).toBe(true);
    expect(pinned().currentTime).toBe(4);

    onScreen("t1", "t2");
    expect(video("t1").paused).toBe(false);
    expect(video("t2").paused).toBe(true);
    // The thread playing never wakes the clip under the sheet.
    expect(pinned().paused).toBe(true);
  });

  it.each([
    ["the comments sheet", { comments: true }],
    ["another sheet (the license)", { license: true }],
    ["a dialog (the join prompt)", { join: true }],
    ["the think-twice dialog", { remove: true }],
  ] as const)(
    "%s: the clip stops where it is, and resumes where it stopped on dismissal (D05 :31, D06 :33)",
    (_, raised) => {
      const { rerender } = render(<Detail />);
      onScreen("pinned-media");
      const element = pinned();
      at(6);

      rerender(<Detail raised={raised} />);
      expect(pinned().paused).toBe(true);
      expect(pinned().currentTime).toBe(6);

      rerender(<Detail />);
      expect(pinned()).toBe(element);
      expect(pinned().paused).toBe(false);
      expect(pinned().currentTime).toBe(6);
    },
  );

  it("a dialog raised over the comments sheet keeps the clip stopped until the last layer lifts (D06 :33)", () => {
    const { rerender } = render(<Detail />);
    onScreen("pinned-media");

    rerender(<Detail raised={{ comments: true }} />);
    rerender(<Detail raised={{ comments: true, join: true }} />);
    rerender(<Detail raised={{ comments: true }} />);
    expect(pinned().paused).toBe(true);

    rerender(<Detail />);
    expect(pinned().paused).toBe(false);
  });

  it("the thread yielding to its composer and taking the screen back is one cover, not a dismissal — the clip resumes once, at the real drop (SL-1 flag c)", () => {
    const { rerender } = render(<Detail />);
    onScreen("pinned-media");
    rerender(<Detail raised={{ comments: true }} />);
    let starts = 0;
    pinned().addEventListener("play", () => {
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
    expect(pinned().paused).toBe(false);
  });

  it("a clip the reader had paused never resumes on its own on dismissal (D07 :35)", () => {
    const { rerender } = render(<Detail />);
    onScreen("pinned-media");
    pressPlayPause();
    expect(pinned().paused).toBe(true);
    let starts = 0;
    pinned().addEventListener("play", () => {
      starts += 1;
    });

    rerender(<Detail raised={{ comments: true }} />);
    rerender(<Detail />);
    onScreen("pinned-media");

    expect(starts).toBe(0);
    expect(pinned().paused).toBe(true);
  });

  it("under suppressed autoplay, a clip the reader started stops under the sheet and never starts on its own after it (D08 :37, C10)", () => {
    suppressesAutoplay({ reducedMotion: true });
    const { rerender } = render(<Detail />);
    onScreen("pinned-media");
    expect(pinned().paused).toBe(true);
    pressPlayPause();
    at(3);
    expect(pinned().paused).toBe(false);

    rerender(<Detail raised={{ license: true }} />);
    expect(pinned().paused).toBe(true);
    rerender(<Detail />);
    expect(pinned().paused).toBe(true);

    // The reader's play starts it again, from the frame it stopped on.
    pressPlayPause();
    expect(pinned().paused).toBe(false);
    expect(pinned().currentTime).toBe(3);
  });

  it("suppression arriving while the sheet stands: the dismissal resumes nothing (D08 :37 — the GIVEN reads at dismissal)", () => {
    suppressesAutoplay({});
    const { rerender } = render(<Detail />);
    onScreen("pinned-media");
    expect(pinned().paused).toBe(false);

    rerender(<Detail raised={{ comments: true }} />);
    act(() => suppressesAutoplay({ saveData: true }));
    rerender(<Detail />);

    expect(pinned().paused).toBe(true);
  });

  it("a clip that played to its end stops, offers replay and never loops — and no dismissal starts it (D15 :9)", () => {
    const { rerender } = render(<Detail />);
    onScreen("pinned-media");
    expect(pinned().loop).toBe(false);
    // A real element sets `paused` as playback ends (html.spec.whatwg.org,
    // "reaches the end"); the stub only flags `ended`, so the test says both.
    act(() => {
      pinned().pause();
      endsClip(pinned());
    });
    expect(screen.getByTestId("pinned-media-transport-play")).toHaveAccessibleName("Replay");

    rerender(<Detail raised={{ comments: true }} />);
    rerender(<Detail />);
    onScreen("pinned-media");
    expect(pinned().paused).toBe(true);
  });
});

// Page visibility is written in Feed.md and applied page-wide (the packet's
// flag §7.2-a, L09); on the pinned stage it meets the covering layers.
describe("the page hidden and shown (F25/F26 Feed.md:51/53, page-wide)", () => {
  it("hiding pauses the pinned clip on its frame; showing resumes it from there", () => {
    render(<Detail />);
    onScreen("pinned-media");
    at(8);

    act(() => setsPageVisibility("hidden"));
    expect(pinned().paused).toBe(true);
    act(() => setsPageVisibility("visible"));
    expect(pinned().paused).toBe(false);
    expect(pinned().currentTime).toBe(8);
  });

  it("hidden and shown while a sheet stands, the clip waits for the dismissal, which resumes it (D06 :33)", () => {
    const { rerender } = render(<Detail />);
    onScreen("pinned-media");

    rerender(<Detail raised={{ comments: true }} />);
    act(() => setsPageVisibility("hidden"));
    act(() => setsPageVisibility("visible"));
    expect(pinned().paused).toBe(true);

    rerender(<Detail />);
    expect(pinned().paused).toBe(false);
  });
});

describe("the transport's pause keeps the stage (D04 PostDetailVideo.md:11, D07 :35)", () => {
  it("nothing re-plays a clip the reader paused: not the observer, not autoplay coming back, not the page showing again", () => {
    suppressesAutoplay({});
    render(<Detail />);
    onScreen("pinned-media");
    at(5);
    pressPlayPause();
    expect(pinned().paused).toBe(true);

    onScreen("pinned-media");
    act(() => suppressesAutoplay({ reducedMotion: true }));
    act(() => suppressesAutoplay({ reducedMotion: false }));
    act(() => setsPageVisibility("hidden"));
    act(() => setsPageVisibility("visible"));
    expect(pinned().paused).toBe(true);

    // The reader's play starts it where it stands.
    pressPlayPause();
    expect(pinned().paused).toBe(false);
    expect(pinned().currentTime).toBe(5);
  });
});

describe("the opinion pad over the post (PostDetailVideo.md:39/41)", () => {
  it("pauses the playing clip where it is and resumes it where it paused (D09, D10)", () => {
    const { rerender } = render(<Detail />);
    onScreen("pinned-media");
    at(2);

    rerender(<Detail raised={{ pad: true }} />);
    expect(pinned().paused).toBe(true);
    onScreen("pinned-media");
    expect(pinned().paused).toBe(true);

    rerender(<Detail />);
    expect(pinned().paused).toBe(false);
    expect(pinned().currentTime).toBe(2);
  });

  it("resumes the clip it paused under suppressed autoplay too (D10 :41 'under suppressed autoplay included')", () => {
    suppressesAutoplay({ saveData: true });
    const { rerender } = render(<Detail />);
    onScreen("pinned-media");
    pressPlayPause();
    expect(pinned().paused).toBe(false);

    rerender(<Detail raised={{ pad: true }} />);
    expect(pinned().paused).toBe(true);
    rerender(<Detail />);
    expect(pinned().paused).toBe(false);
  });

  it("closing when it paused nothing starts nothing (D10 :41 'GIVEN it paused the clip')", () => {
    const { rerender } = render(<Detail />);
    onScreen("pinned-media");
    pressPlayPause();

    rerender(<Detail raised={{ pad: true }} />);
    rerender(<Detail />);
    expect(pinned().paused).toBe(true);
  });
});

describe("the unveil (PostDetailVideoSensitive.md:11–17)", () => {
  it("the pinned clip's veil face unveils it and the card together; the clip, the same element, plays and the transport comes back (V02 :11, V04 :15)", () => {
    render(<Detail sensitive />);
    onScreen("pinned-media");
    const element = pinned();

    fireEvent.click(screen.getByTestId("post-pinned-clip-veil-reveal"));

    expect(screen.queryByTestId("post-pinned-clip-veil")).toBeNull();
    expect(screen.queryByTestId("card-veil")).toBeNull();
    expect(pinned()).toBe(element);
    expect(pinned().paused).toBe(false);
    expect(screen.getByTestId("pinned-media-transport")).toBeInTheDocument();
  });

  it("Show on the card's veil unveils the pinned clip with the card, and the clip plays (V03 :13, V04 :15)", () => {
    render(<Detail sensitive />);
    onScreen("pinned-media");

    fireEvent.click(screen.getByTestId("card-veil-reveal"));

    expect(screen.queryByTestId("post-pinned-clip-veil")).toBeNull();
    expect(pinned().paused).toBe(false);
    expect(screen.getByTestId("pinned-media-transport")).toBeInTheDocument();
  });

  it("under suppressed autoplay the unveil starts nothing; the transport's play does (V05 :17)", () => {
    suppressesAutoplay({ reducedMotion: true });
    render(<Detail sensitive />);
    onScreen("pinned-media");

    fireEvent.click(screen.getByTestId("post-pinned-clip-veil-reveal"));
    expect(pinned().paused).toBe(true);

    pressPlayPause();
    expect(pinned().paused).toBe(false);
  });
});

/** The detail with its fullscreen viewer, as `post-view.tsx` raises it. */
function WithViewer({ raised = {} }: { raised?: Raised }) {
  const [viewer, setViewer] = useState(false);
  return (
    <>
      <PinnedClip
        src={CLIP}
        mimeType="video/mp4"
        poster={COVER}
        mediaId="m1"
        behindViewer={viewer}
        onOpenViewer={() => setViewer(true)}
        testId="pinned"
      />
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
const openViewer = () => fireEvent.click(screen.getByTestId("pinned-media-transport-fullscreen"));
const closeViewer = () => fireEvent.click(screen.getByTestId("viewer-close"));

// The viewer is a covering layer over the post too, but its close is an
// EXPLICIT CARRY of the viewer's own play state (PostDetailVideo.md:49/51),
// and the carry is the last word on the clip: the dismissal rule (:33/:35)
// resumes only what a layer stopped, and the clip was handed over — not
// stopped by the layer — before the viewer stood.
describe("the viewer's carry and the dismissal rule (D14/D16 over D06/D07)", () => {
  it("a viewer paused by the reader returns paused though the pinned clip was playing when it rose — and stays so through the next sheet (D16 :51, D07 :35)", () => {
    const { rerender } = render(<WithViewer />);
    onScreen("pinned-media");
    expect(pinned().paused).toBe(false);

    openViewer();
    fireEvent.click(screen.getByTestId("viewer-video-transport-play"));
    expect(viewerClip().paused).toBe(true);
    closeViewer();
    onScreen("pinned-media");
    expect(pinned().paused).toBe(true);

    // The carried pause is the reader's pause: a sheet over the post and its
    // dismissal resume nothing.
    rerender(<WithViewer raised={{ comments: true }} />);
    rerender(<WithViewer />);
    expect(pinned().paused).toBe(true);
  });

  it("a viewer the reader played returns playing though the reader had paused the pinned clip before it rose (D14 :49 over D07 :35)", () => {
    render(<WithViewer />);
    onScreen("pinned-media");
    pressPlayPause();
    expect(pinned().paused).toBe(true);

    openViewer();
    expect(viewerClip().paused).toBe(true);
    fireEvent.click(screen.getByTestId("viewer-video-transport-play"));
    act(() => {
      viewerClip().currentTime = 7;
    });
    closeViewer();

    expect(pinned().paused).toBe(false);
    expect(pinned().currentTime).toBe(7);
  });

  it("a carried playing clip stops under the next sheet and resumes on its dismissal, by the ordinary rule (D06 :33)", () => {
    const { rerender } = render(<WithViewer />);
    onScreen("pinned-media");
    openViewer();
    closeViewer();
    onScreen("pinned-media");
    expect(pinned().paused).toBe(false);

    rerender(<WithViewer raised={{ comments: true }} />);
    expect(pinned().paused).toBe(true);
    rerender(<WithViewer />);
    expect(pinned().paused).toBe(false);
  });
});

// The same, on the engine itself and in the order React never takes: the
// layer reaching the stage while the clip still stands on it. Whatever order
// the platform delivers the two in, the carry is the last word.
describe("the pinned stage's engine (rule 12)", () => {
  function pinnedStage() {
    const stage = new Stage({ visible: true, allowed: true, pinned: true });
    const element = document.createElement("video");
    const key = {};
    stage.register(key, element, false);
    stage.measure([{ target: element, intersectionRatio: 1 }]);
    return { stage, element, key };
  }

  it("a carried pause settles what the layer's lifting owed: nothing resumes (D16 :51 over D06 :33)", () => {
    const { stage, element, key } = pinnedStage();
    expect(element.paused).toBe(false);

    stage.setCover("suspended");
    expect(element.paused).toBe(true);
    stage.seat(key);
    stage.setCover(null);

    expect(element.paused).toBe(true);
    stage.dispose();
  });

  it("without a carry, the same lifting resumes the clip it stopped (D06 :33)", () => {
    const { stage, element } = pinnedStage();
    stage.setCover("suspended");
    stage.setCover(null);
    expect(element.paused).toBe(false);
    stage.dispose();
  });
});

// SF-1's flag 7: "The thread host after its sheet closes reads as page-level.
// A thread clip can keep its holder until the observer reports 0; the player
// layer pauses it when the feed's clip starts." On the detail, the clip that
// starts is the pinned clip's dismissal resume — and the thread's stage, still
// holding the clip the player layer paused, would start nothing when the sheet
// rose again. A dropped sheet's surface is not on screen (`coverOf`).
describe("the thread when its sheet drops (SF-1 flag 7)", () => {
  it("stops its clip at the drop, and decides from empty when the sheet rises again — the pinned clip stopping in turn", () => {
    const { rerender } = render(<Detail thread={["t1", "t2"]} />);
    onScreen("pinned-media");
    rerender(<Detail thread={["t1", "t2"]} raised={{ comments: true }} />);
    onScreen("t1", "t2");
    expect(video("t1").paused).toBe(false);

    // Dropped: the thread clip stops at once — no observer report needed —
    // and the pinned clip resumes (D06).
    rerender(<Detail thread={["t1", "t2"]} />);
    expect(video("t1").paused).toBe(true);
    expect(pinned().paused).toBe(false);

    // Raised again (inside the exit animation, before the dialog is gone):
    // the thread's topmost qualifying clip takes its stage again.
    rerender(<Detail thread={["t1", "t2"]} raised={{ comments: true }} />);
    expect(video("t1").paused).toBe(false);
    expect(video("t2").paused).toBe(true);
    expect(pinned().paused).toBe(true);
  });
});
