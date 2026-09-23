// The stage history against jsdom's own session history: real entries, real
// traversals, real popstate — nothing about the browser is stubbed. The
// harness stands in for a wizard: a level, an arrow that lowers it, a forward
// action that raises it (unless its gate refuses), and a sheet.

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { historyMove, markedDepth, useStageHistory } from "./stage-history";

let surfaces = 0;
/** A surface name no earlier test has marked an entry with. */
const freshSurface = () => `test-${++surfaces}`;

/** jsdom traverses on timers, so every settle waits them out. */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));

const depth = (surface: string) => markedDepth(window.history.state, surface);

function Sheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} data-testid="sheet" onClose={onClose} />;
}

function Harness({
  surface,
  start = 0,
  gate = true,
  onBack = () => {},
  onForward = () => {},
}: {
  surface: string;
  start?: number;
  gate?: boolean;
  onBack?: () => void;
  onForward?: () => void;
}) {
  const [level, setLevel] = useState(start);
  const [sheet, setSheet] = useState(false);
  useStageHistory({
    surface,
    level,
    onBack: () => {
      onBack();
      setLevel((current) => Math.max(0, current - 1));
    },
    onForward: () => {
      onForward();
      if (gate) setLevel((current) => current + 1);
    },
  });
  return (
    <>
      <span data-testid="level">{level}</span>
      <button data-testid="next" onClick={() => setLevel((current) => current + 1)} />
      <button data-testid="arrow" onClick={() => setLevel((current) => current - 1)} />
      <button data-testid="home" onClick={() => setLevel(0)} />
      <button data-testid="open-sheet" onClick={() => setSheet(true)} />
      <Sheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}

const level = () => Number(screen.getByTestId("level").textContent);

afterEach(async () => {
  cleanup();
  // An unmount's own unwinding runs on timers too; it must finish here rather
  // than land in the next test.
  await settle();
});

describe("historyMove", () => {
  it("does nothing when the browser is where the stage is", () => {
    expect(historyMove(2, 2, false)).toBe("none");
    expect(historyMove(2, 2, true)).toBe("none");
  });

  it("steps back below the stage and forward above it", () => {
    expect(historyMove(1, 2, false)).toBe("back");
    expect(historyMove(3, 2, false)).toBe("forward");
  });

  it("gives an open sheet the step before any stage gets it", () => {
    expect(historyMove(1, 2, true)).toBe("dismiss");
    expect(historyMove(3, 2, true)).toBe("dismiss");
  });
});

describe("markedDepth", () => {
  it("reads its own surface's mark and nothing else", () => {
    expect(markedDepth({ cograStage: { surface: "a", depth: 2 } }, "a")).toBe(2);
    expect(markedDepth({ cograStage: { surface: "b", depth: 2 } }, "a")).toBe(0);
    expect(markedDepth({ __NA: true }, "a")).toBe(0);
    expect(markedDepth(null, "a")).toBe(0);
  });
});

describe("useStageHistory", () => {
  it("pushes one entry per stage reached, carrying the router's own state along", async () => {
    const surface = freshSurface();
    // The router's own fields, which a stage entry must not drop — popping an
    // entry without them would make Next reload the page.
    window.history.replaceState({ __NA: true, router: "tree" }, "");
    const before = window.history.length;
    render(<Harness surface={surface} />);
    expect(window.history.length).toBe(before);

    fireEvent.click(screen.getByTestId("next"));
    fireEvent.click(screen.getByTestId("next"));
    expect(window.history.length).toBe(before + 2);
    expect(depth(surface)).toBe(2);
    expect(window.history.state).toMatchObject({ __NA: true, router: "tree" });
  });

  it("answers Back with the arrow's own transition, one stage per press", async () => {
    const surface = freshSurface();
    const onBack = vi.fn();
    render(<Harness surface={surface} onBack={onBack} />);
    fireEvent.click(screen.getByTestId("next"));
    fireEvent.click(screen.getByTestId("next"));

    window.history.back();
    await waitFor(() => expect(level()).toBe(1));
    expect(onBack).toHaveBeenCalledOnce();
    expect(depth(surface)).toBe(1);

    window.history.back();
    await waitFor(() => expect(level()).toBe(0));
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it("leaves Back on the first stage to the browser", async () => {
    const surface = freshSurface();
    const onBack = vi.fn();
    window.history.pushState({ page: "before" }, "");
    render(<Harness surface={surface} onBack={onBack} />);
    window.history.pushState({ page: "the surface" }, "");

    window.history.back();
    await settle();
    expect(onBack).not.toHaveBeenCalled();
    expect(level()).toBe(0);
  });

  it("follows the arrow with the history, and does not answer its own traversal", async () => {
    const surface = freshSurface();
    const onBack = vi.fn();
    render(<Harness surface={surface} onBack={onBack} />);
    fireEvent.click(screen.getByTestId("next"));
    fireEvent.click(screen.getByTestId("next"));

    fireEvent.click(screen.getByTestId("arrow"));
    await waitFor(() => expect(depth(surface)).toBe(1));
    await settle();
    expect(level()).toBe(1);
    expect(onBack).not.toHaveBeenCalled();
  });

  it("follows a jump of several stages with one traversal", async () => {
    const surface = freshSurface();
    const onBack = vi.fn();
    render(<Harness surface={surface} onBack={onBack} />);
    fireEvent.click(screen.getByTestId("next"));
    fireEvent.click(screen.getByTestId("next"));
    fireEvent.click(screen.getByTestId("next"));

    fireEvent.click(screen.getByTestId("home"));
    await waitFor(() => expect(depth(surface)).toBe(0));
    await settle();
    expect(level()).toBe(0);
    expect(onBack).not.toHaveBeenCalled();
  });

  it("re-advances on Forward through the forward action", async () => {
    const surface = freshSurface();
    const onForward = vi.fn();
    render(<Harness surface={surface} onForward={onForward} />);
    fireEvent.click(screen.getByTestId("next"));
    fireEvent.click(screen.getByTestId("next"));
    window.history.back();
    await waitFor(() => expect(level()).toBe(1));

    window.history.forward();
    await waitFor(() => expect(level()).toBe(2));
    expect(onForward).toHaveBeenCalledOnce();
    expect(depth(surface)).toBe(2);
  });

  it("takes the browser back again when the gate refuses the Forward", async () => {
    const surface = freshSurface();
    const onForward = vi.fn();
    render(<Harness surface={surface} gate={false} onForward={onForward} />);
    fireEvent.click(screen.getByTestId("next"));
    window.history.back();
    await waitFor(() => expect(level()).toBe(0));

    window.history.forward();
    await waitFor(() => expect(onForward).toHaveBeenCalledOnce());
    await waitFor(() => expect(depth(surface)).toBe(0));
    await settle();
    expect(level()).toBe(0);
  });

  it("closes an open sheet on Back and keeps the stage, entry and all", async () => {
    const surface = freshSurface();
    const onBack = vi.fn();
    render(<Harness surface={surface} onBack={onBack} />);
    fireEvent.click(screen.getByTestId("next"));
    fireEvent.click(screen.getByTestId("open-sheet"));
    expect(screen.getByTestId("sheet")).toHaveAttribute("open");

    window.history.back();
    await waitFor(() => expect(screen.getByTestId("sheet")).not.toHaveAttribute("open"));
    expect(onBack).not.toHaveBeenCalled();
    expect(level()).toBe(1);
    // The entry the press used up is put back, so the next Back steps the stage.
    await waitFor(() => expect(depth(surface)).toBe(1));

    window.history.back();
    await waitFor(() => expect(level()).toBe(0));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("lets a sheet refuse the close request, as a dialog may", async () => {
    const surface = freshSurface();
    function Refusing() {
      const [level, setLevel] = useState(1);
      useStageHistory({ surface, level, onBack: () => setLevel(0), onForward: () => {} });
      const ref = useRef<HTMLDialogElement | null>(null);
      useEffect(() => ref.current?.showModal(), []);
      return (
        <>
          <span data-testid="level">{level}</span>
          <dialog ref={ref} data-testid="sheet" onCancel={(event) => event.preventDefault()} />
        </>
      );
    }
    render(<Refusing />);
    await settle();

    window.history.back();
    await settle();
    expect(screen.getByTestId("sheet")).toHaveAttribute("open");
    expect(level()).toBe(1);
    expect(depth(surface)).toBe(1);
  });

  it("rewinds entries left from an earlier visit to the stage a fresh surface is on", async () => {
    const surface = freshSurface();
    // A reload on the third stage: the entries survive, the flow does not.
    window.history.pushState({ cograStage: { surface, depth: 1 } }, "");
    window.history.pushState({ cograStage: { surface, depth: 2 } }, "");
    const onBack = vi.fn();
    render(<Harness surface={surface} onBack={onBack} />);

    await waitFor(() => expect(depth(surface)).toBe(0));
    await settle();
    expect(level()).toBe(0);
    expect(onBack).not.toHaveBeenCalled();
  });

  it("takes its entries with it when closed in place", async () => {
    const surface = freshSurface();
    const { unmount } = render(<Harness surface={surface} start={2} />);
    expect(depth(surface)).toBe(2);

    unmount();
    await waitFor(() => expect(depth(surface)).toBe(0));
  });

  it("does not answer a pop onto another page — that is the router leaving", async () => {
    const surface = freshSurface();
    const onBack = vi.fn();
    const away = new URL("/elsewhere", window.location.href).href;
    const home = window.location.href;
    window.history.pushState({ page: "elsewhere" }, "", away);
    window.history.pushState({ page: "home" }, "", home);
    render(<Harness surface={surface} start={1} onBack={onBack} />);

    window.history.go(-2);
    await waitFor(() => expect(window.location.href).toBe(away));
    await settle();
    expect(onBack).not.toHaveBeenCalled();
    expect(level()).toBe(1);
    // Put the document back where the rest of the suite expects it.
    window.history.pushState(null, "", home);
  });
});
