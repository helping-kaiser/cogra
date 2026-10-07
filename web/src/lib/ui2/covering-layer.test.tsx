// The covering-layer signal (`covering-layer.tsx`): which layers are raised,
// what they cover, and that every primitive that raises one says so. Nothing
// reads the signal yet — the stage host does, in the election PR — so these
// pin the seam itself, and the stage-law packet's teardown-hygiene row for it.

import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { JoinPrompt } from "@/lib/ui/join-prompt";
import { ReferenceFinder } from "@/lib/ui/reference-finder";
import { SeveranceConfirm } from "@/lib/ui/severance-confirm";
import { MultiActionConfirm } from "@/lib/ui/signed-actions";
import { StanceAlternates } from "@/lib/ui/stance-alternates";
import { intersectEach, suppressesAutoplay } from "@/test/media-env";
import { renderWithProviders } from "@/test/providers";

import { BottomSheet } from "./bottom-sheet";
import { DiscardConfirm } from "./compose/discard-confirm";
import { ParkedPad } from "./compose/parked-pad";
import {
  coverListenersForTests,
  coverOf,
  onLayersChangeForTests,
  raisedLayersForTests,
  useCoversSurface,
  useSurfaceCover,
  type CoverKind,
} from "./covering-layer";
import { HelpDialog } from "./help-dialog";
import { StageHost } from "./media/stage-host";
import { VideoPlayer } from "./media/video-player";
import { RemoveConfirm } from "./remove-confirm";

const noop = () => {};

/** What covers the surface this probe stands on, written where a test reads it. */
function Probe({ testId }: { testId: string }) {
  const cover = useSurfaceCover();
  return <span data-testid={testId} data-cover={cover ?? "none"} />;
}

const coverOn = (testId: string) => screen.getByTestId(testId).dataset.cover;

/** A bare layer, for the store's own rules. */
function Layer({ open, kind }: { open: boolean; kind: CoverKind }) {
  useCoversSurface(open, kind);
  return null;
}

describe("the store", () => {
  it("covers the page while a layer is raised, and stops when it is dropped", () => {
    const { rerender } = render(
      <>
        <Probe testId="page" />
        <Layer open kind="suspend" />
      </>,
    );
    expect(coverOn("page")).toBe("suspended");

    rerender(
      <>
        <Probe testId="page" />
        <Layer open={false} kind="suspend" />
      </>,
    );
    expect(coverOn("page")).toBe("none");
    expect(raisedLayersForTests()).toEqual([]);
  });

  it("reads a pause as a pause, and lets a suspension outrank it", () => {
    const { rerender } = render(
      <>
        <Probe testId="page" />
        <Layer open kind="pause" />
        <Layer open={false} kind="suspend" />
      </>,
    );
    expect(coverOn("page")).toBe("paused");

    rerender(
      <>
        <Probe testId="page" />
        <Layer open kind="pause" />
        <Layer open kind="suspend" />
      </>,
    );
    expect(coverOn("page")).toBe("suspended");
  });

  it("stands what a sheet draws ON the sheet: the sheet covers the page, not its own content", () => {
    render(
      <>
        <Probe testId="page" />
        <BottomSheet open onClose={noop} title="Comments">
          <Probe testId="thread" />
        </BottomSheet>
      </>,
    );
    expect(coverOn("page")).toBe("suspended");
    expect(coverOn("thread")).toBe("none");
  });

  it("lets a dialog raised over the sheet cover the sheet's own surface in turn", () => {
    function Thread({ prompting }: { prompting: boolean }) {
      return (
        <>
          <Probe testId="page" />
          <BottomSheet open onClose={noop} title="Comments">
            <Probe testId="thread" />
          </BottomSheet>
          <JoinPrompt open={prompting} onClose={noop} />
        </>
      );
    }
    const { rerender } = render(<Thread prompting={false} />);
    expect(coverOn("thread")).toBe("none");

    rerender(<Thread prompting />);
    expect(coverOn("thread")).toBe("suspended");
    expect(coverOn("page")).toBe("suspended");
    expect(raisedLayersForTests()).toEqual(["suspend", "suspend"]);
  });

  it("orders layers by when they were raised, not by where they are drawn", () => {
    // The prompt is drawn INSIDE the sheet but raised before it: the platform
    // stacks by `showModal()` order, so the sheet sits above the prompt and
    // the thread stays uncovered.
    function Raised({ sheet }: { sheet: boolean }) {
      return (
        <BottomSheet open={sheet} onClose={noop} title="Comments">
          <Probe testId="thread" />
          <JoinPrompt open onClose={noop} />
        </BottomSheet>
      );
    }
    const { rerender } = render(<Raised sheet={false} />);
    rerender(<Raised sheet />);
    expect(coverOn("thread")).toBe("none");
  });
});

describe("teardown hygiene", () => {
  it("drops a layer whose owner unmounts while it is still raised", () => {
    const { unmount } = render(<BottomSheet open onClose={noop} title="Menu"><p /></BottomSheet>);
    expect(raisedLayersForTests()).toEqual(["suspend"]);
    unmount();
    expect(raisedLayersForTests()).toEqual([]);
  });

  it("unsubscribes a reader that unmounts", () => {
    const before = coverListenersForTests();
    const { unmount } = render(<Probe testId="page" />);
    expect(coverListenersForTests()).toBeGreaterThan(before);
    unmount();
    expect(coverListenersForTests()).toBe(before);
  });
});

// Every primitive that raises a layer announces it — so a call site that
// opens one can never forget to (the packet's §3.2 rule 7, "which web layers
// count"). Sheets and dialogs suspend; the stance pads pause.
describe("the primitives announce themselves", () => {
  it("BottomSheet suspends while open", () => {
    const { rerender } = render(
      <BottomSheet open onClose={noop} title="Menu">
        <p />
      </BottomSheet>,
    );
    expect(raisedLayersForTests()).toEqual(["suspend"]);
    rerender(
      <BottomSheet open={false} onClose={noop} title="Menu">
        <p />
      </BottomSheet>,
    );
    expect(raisedLayersForTests()).toEqual([]);
  });

  it("JoinPrompt suspends while open", () => {
    const { rerender } = render(<JoinPrompt open onClose={noop} />);
    expect(raisedLayersForTests()).toEqual(["suspend"]);
    rerender(<JoinPrompt open={false} onClose={noop} />);
    expect(raisedLayersForTests()).toEqual([]);
  });

  it("HelpDialog suspends while open", () => {
    const topic = { title: "Help", paragraphs: ["Why."] };
    const { rerender } = render(<HelpDialog open onClose={noop} topic={topic} />);
    expect(raisedLayersForTests()).toEqual(["suspend"]);
    rerender(<HelpDialog open={false} onClose={noop} topic={topic} />);
    expect(raisedLayersForTests()).toEqual([]);
  });

  it("RemoveConfirm suspends while open", () => {
    render(<RemoveConfirm open onClose={noop} onRemove={noop} />);
    expect(raisedLayersForTests()).toEqual(["suspend"]);
  });

  it("DiscardConfirm suspends while open", () => {
    render(<DiscardConfirm open onKeepWriting={noop} onDiscard={noop} />);
    expect(raisedLayersForTests()).toEqual(["suspend"]);
  });

  it("the dialogs mounted only while open suspend for as long as they are mounted", () => {
    const severance = render(
      <SeveranceConfirm
        pick={null}
        targetLabel="this post"
        bundle={null}
        records={1}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(raisedLayersForTests()).toEqual(["suspend"]);
    severance.unmount();

    const multi = render(
      <MultiActionConfirm count={2} onConfirm={noop} onCancel={noop} testIdPrefix="multi" />,
    );
    expect(raisedLayersForTests()).toEqual(["suspend"]);
    multi.unmount();

    const finder = renderWithProviders(
      <ReferenceFinder onPick={noop} onClose={noop} testIdPrefix="finder" />,
    );
    expect(raisedLayersForTests()).toEqual(["suspend"]);
    finder.unmount();
    expect(raisedLayersForTests()).toEqual([]);
  });

  it("the stance pads pause rather than suspend", () => {
    const parked = render(
      <ParkedPad open onClose={noop} ariaLabel="Stance" standoff="compose" testId="parked">
        <p />
      </ParkedPad>,
    );
    expect(raisedLayersForTests()).toEqual(["pause"]);
    parked.unmount();

    render(
      <StanceAlternates
        mode="pad"
        pick={{ pDirected: 0, pInterest: 0 }}
        onPick={noop}
        onCommit={noop}
        onCancel={noop}
        onSever={noop}
      />,
    );
    expect(raisedLayersForTests()).toEqual(["pause"]);
  });
});

// WHAT A LAYER DOES TO THE STAGE BENEATH IT (the stage-law packet §6
// `covering-layer.test.tsx` row; android's `SheetOverStageTest`, widened to
// every sheet and dialog by GAP-6, with the pad carved out as a pause).

const CLIP = "https://media.example/clip.mp4";

type Raised = {
  /** The comments sheet over the feed, the thread standing on it. */
  sheet?: boolean;
  /** The sheet's handover frame (`BottomSheet`'s `coverHeld`). */
  held?: boolean;
  /** The join prompt — over the thread when the sheet is up. */
  join?: boolean;
  help?: boolean;
  /** The opinion pad. */
  pad?: boolean;
  /** A full-focus takeover: the reply wizard, the comment editor. */
  takeover?: boolean;
};

/**
 * The feed, the comments sheet over it with its own thread, and the layers
 * that can rise over either — each raised in a commit of its own, in the
 * order a reader raises them.
 */
function Page({
  raised = {},
  feed = ["a", "b"],
  thread = [],
}: {
  raised?: Raised;
  feed?: readonly string[];
  thread?: readonly string[];
}) {
  const clips = (ids: readonly string[], surface?: "reading"): ReactNode =>
    ids.map((id) => <VideoPlayer key={id} src={CLIP} surface={surface} testId={id} />);
  return (
    <>
      <StageHost>{clips(feed)}</StageHost>
      <BottomSheet
        open={raised.sheet ?? false}
        coverHeld={raised.held ?? false}
        onClose={noop}
        title="Comments"
      >
        <StageHost>{clips(thread, "reading")}</StageHost>
      </BottomSheet>
      <JoinPrompt open={raised.join ?? false} onClose={noop} />
      <HelpDialog
        open={raised.help ?? false}
        onClose={noop}
        topic={{ title: "Help", paragraphs: ["Why."] }}
      />
      <Layer open={raised.pad ?? false} kind="pause" />
      <Layer open={raised.takeover ?? false} kind="suspend" />
    </>
  );
}

const clip = (id: string) => screen.getByTestId(id) as HTMLVideoElement;
const playing = (...ids: string[]) => ids.filter((id) => !clip(id).paused);

function frame(ratios: Record<string, number>) {
  act(() =>
    intersectEach(Object.entries(ratios).map(([id, ratio]) => ({ target: clip(id), ratio }))),
  );
}

/** Every `play` event a clip receives — a start, however briefly it lasted. */
function startsOf(id: string): { count: number } {
  const seen = { count: 0 };
  clip(id).addEventListener("play", () => {
    seen.count += 1;
  });
  return seen;
}

describe("a sheet or a dialog over a surface suspends its stage (rule 7)", () => {
  it("a sheet — even one with no clips — stops the feed's incumbent, and nothing on the feed plays while it stands (F13 Feed.md:31, F14 Feed.md:33)", () => {
    const { rerender } = render(<Page />);
    frame({ a: 1, b: 1 });
    expect(playing("a", "b")).toEqual(["a"]);

    rerender(<Page raised={{ sheet: true }} />);
    expect(playing("a", "b")).toEqual([]);
    // The feed moves under the sheet; still nothing plays (W7: the top
    // layer does not occlude the observer, so the layer has to say it).
    frame({ a: 0.2, b: 1 });
    expect(playing("a", "b")).toEqual([]);
  });

  it("the thread on the sheet elects its own stage by the same law, in thread order (L04, R01 ReplyEntry.md:3)", () => {
    const { rerender } = render(<Page thread={["t1", "t2"]} />);
    frame({ a: 1 });
    rerender(<Page thread={["t1", "t2"]} raised={{ sheet: true }} />);
    frame({ t1: 1, t2: 1 });
    expect(playing("a", "t1", "t2")).toEqual(["t1"]);
  });

  it.each([
    ["the join prompt", { join: true }],
    ["the help dialog", { help: true }],
  ] as const)("%s suspends the feed the same way a sheet does (GAP-6, Feed.md:31)", (_, raised) => {
    const { rerender } = render(<Page />);
    frame({ a: 1, b: 1 });
    rerender(<Page raised={raised} />);
    expect(playing("a", "b")).toEqual([]);
    rerender(<Page />);
    expect(playing("a", "b")).toEqual(["a"]);
  });

  it("the join prompt raised over the thread suspends the thread (ReplyEntry.md:23, L04)", () => {
    const { rerender } = render(<Page thread={["t1"]} raised={{ sheet: true }} />);
    frame({ t1: 1 });
    expect(playing("t1")).toEqual(["t1"]);
    rerender(<Page thread={["t1"]} raised={{ sheet: true, join: true }} />);
    expect(playing("t1")).toEqual([]);
    rerender(<Page thread={["t1"]} raised={{ sheet: true }} />);
    expect(playing("t1")).toEqual(["t1"]);
  });

  it("dismissal decides from empty — the topmost qualifying clip, never the old incumbent handed back (F15 Feed.md:35)", () => {
    const { rerender } = render(<Page />);
    frame({ a: 0.5, b: 1 });
    expect(playing("a", "b")).toEqual(["b"]);
    rerender(<Page raised={{ sheet: true }} />);
    // The list moved under the sheet: A qualifies now too.
    frame({ a: 1, b: 1 });
    rerender(<Page />);
    expect(playing("a", "b")).toEqual(["a"]);
  });

  it("dismissal under suppression plays nothing, and the clip the reader started stands on its frame wearing its play disc again (F22 Feed.md:37, GAP-4)", () => {
    suppressesAutoplay({ reducedMotion: true });
    const { rerender } = render(<Page />);
    frame({ a: 1, b: 1 });
    fireEvent.click(screen.getByTestId("b-play"));
    act(() => {
      clip("b").currentTime = 5;
    });
    expect(playing("a", "b")).toEqual(["b"]);

    rerender(<Page raised={{ sheet: true }} />);
    rerender(<Page />);
    expect(playing("a", "b")).toEqual([]);
    expect(screen.getByTestId("b-play")).toBeInTheDocument();
    expect(clip("b").currentTime).toBe(5);
  });
});

describe("the opinion pad pauses, it does not suspend (rule 7a)", () => {
  it("pauses the playing clip on its frame, hands the stage to no one, and resumes that same clip on close (F23 Feed.md:39, F24 Feed.md:41)", () => {
    const { rerender } = render(<Page />);
    frame({ a: 1, b: 1 });
    act(() => {
      clip("a").currentTime = 3;
    });
    rerender(<Page raised={{ pad: true }} />);
    expect(playing("a", "b")).toEqual([]);
    // Whatever the surface does under the pad, the stage does not change hands.
    frame({ a: 0.6, b: 1 });
    expect(playing("a", "b")).toEqual([]);

    rerender(<Page />);
    expect(playing("a", "b")).toEqual(["a"]);
    expect(clip("a").currentTime).toBe(3);
  });

  it("resumes the clip the reader started under suppressed autoplay too (F24 Feed.md:41 'under suppressed autoplay included')", () => {
    suppressesAutoplay({ reducedMotion: true });
    const { rerender } = render(<Page />);
    frame({ a: 1, b: 1 });
    fireEvent.click(screen.getByTestId("a-play"));
    rerender(<Page raised={{ pad: true }} />);
    expect(playing("a", "b")).toEqual([]);
    rerender(<Page />);
    expect(playing("a", "b")).toEqual(["a"]);
  });

  it("closing when it paused nothing starts nothing", () => {
    const { rerender } = render(<Page />);
    frame({ a: 0.3, b: 0.3 });
    rerender(<Page raised={{ pad: true }} />);
    frame({ a: 1 });
    rerender(<Page />);
    expect(playing("a", "b")).toEqual([]);
  });

  it("a sheet lifting while the pad is still up decides from empty only once the pad closes too", () => {
    const { rerender } = render(<Page />);
    frame({ a: 1, b: 1 });
    rerender(<Page raised={{ sheet: true }} />);
    rerender(<Page raised={{ sheet: true, pad: true }} />);
    rerender(<Page raised={{ pad: true }} />);
    expect(playing("a", "b")).toEqual([]);
    rerender(<Page />);
    expect(playing("a", "b")).toEqual(["a"]);
  });
});

// THE HANDOVER FRAME (SL-1 flag c). The thread sheet steps aside for the reply
// wizard or the comment editor and comes back when it leaves. The surface
// beneath must never read the moment between the sheet dropping and the
// takeover standing as the suspension lifting.
describe("a layer handing over to the next", () => {
  /** The page's cover as the store says it, at every change — no coalescing. */
  function recordPageCover(): { seen: string[]; stop: () => void } {
    const seen: string[] = [];
    const stop = onLayersChangeForTests(() => seen.push(coverOf(null) ?? "none"));
    return { seen, stop };
  }

  it("the sheet that yields to a takeover holds its cover across the commits between — nothing on the feed starts", () => {
    const { rerender } = render(<Page />);
    frame({ a: 1, b: 1 });
    rerender(<Page raised={{ sheet: true }} />);
    const starts = startsOf("a");
    const record = recordPageCover();

    // The sheet drops, holding its cover (one commit) …
    rerender(<Page raised={{ held: true }} />);
    // … the takeover stands (another) …
    rerender(<Page raised={{ held: true, takeover: true }} />);
    // … and gives the screen back as the sheet rises again (one more).
    rerender(<Page raised={{ sheet: true }} />);

    record.stop();
    expect(record.seen.every((cover) => cover === "suspended")).toBe(true);
    expect(starts.count).toBe(0);

    // The reader then drops the sheet for real: decided from empty.
    rerender(<Page />);
    expect(playing("a", "b")).toEqual(["a"]);
  });

  it("without the frame, the same two-commit handover WOULD read as a lift — which is why the frame exists", () => {
    const { rerender } = render(<Page />);
    frame({ a: 1, b: 1 });
    rerender(<Page raised={{ sheet: true }} />);
    const starts = startsOf("a");
    rerender(<Page />);
    rerender(<Page raised={{ takeover: true }} />);
    expect(starts.count).toBe(1);
    expect(playing("a", "b")).toEqual([]);
  });

  it("a sheet dropping as the next layer rises in the same commit is never read as a lift", () => {
    const { rerender } = render(<Page />);
    frame({ a: 1, b: 1 });
    rerender(<Page raised={{ sheet: true }} />);
    const starts = startsOf("a");
    rerender(<Page raised={{ takeover: true }} />);
    expect(starts.count).toBe(0);
  });

  it("a sheet stops covering at its dismissal's start, not after its exit animation (SL-1 flag e)", () => {
    const { rerender } = render(<Page />);
    frame({ a: 1, b: 1 });
    rerender(<Page raised={{ sheet: true }} />);
    rerender(<Page />);
    // The exit animation's timer has not run; the feed is already deciding.
    expect(playing("a", "b")).toEqual(["a"]);
  });
});
