// The covering-layer signal (`covering-layer.tsx`): which layers are raised,
// what they cover, and that every primitive that raises one says so. Nothing
// reads the signal yet — the stage host does, in the election PR — so these
// pin the seam itself, and the stage-law packet's teardown-hygiene row for it.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JoinPrompt } from "@/lib/ui/join-prompt";
import { ReferenceFinder } from "@/lib/ui/reference-finder";
import { SeveranceConfirm } from "@/lib/ui/severance-confirm";
import { MultiActionConfirm } from "@/lib/ui/signed-actions";
import { StanceAlternates } from "@/lib/ui/stance-alternates";
import { renderWithProviders } from "@/test/providers";

import { BottomSheet } from "./bottom-sheet";
import { DiscardConfirm } from "./compose/discard-confirm";
import { ParkedPad } from "./compose/parked-pad";
import {
  coverListenersForTests,
  raisedLayersForTests,
  useCoversSurface,
  useSurfaceCover,
  type CoverKind,
} from "./covering-layer";
import { HelpDialog } from "./help-dialog";
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
