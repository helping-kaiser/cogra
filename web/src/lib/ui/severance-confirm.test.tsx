import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SeveranceConfirm } from "./severance-confirm";

function show(props: Partial<React.ComponentProps<typeof SeveranceConfirm>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <SeveranceConfirm
      kind="sever"
      targetLabel="@ada"
      records={3}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onConfirm, onCancel };
}

describe("the severance confirmation", () => {
  it("opens as a modal, so focus and Esc come from the platform", () => {
    show();
    expect(screen.getByTestId<HTMLDialogElement>("severance-confirm").open).toBe(true);
  });

  it("names what severance costs before anything is signed", () => {
    show({ records: 4 });
    expect(screen.getByTestId("severance-cost")).toHaveTextContent("4 signed steps");
  });

  it("counts a single step in the singular", () => {
    show({ records: 1 });
    expect(screen.getByTestId("severance-cost")).toHaveTextContent("1 signed step,");
  });

  it("says what reaching zero carries with it", () => {
    show();
    const consequences = screen.getByTestId("severance-consequences");
    expect(consequences).toHaveTextContent("stops reaching your feed");
    expect(consequences).toHaveTextContent("stop earning");
    expect(consequences).toHaveTextContent("nothing passes on through you");
  });

  it("asks whether an accidental landing was the intent, rather than refusing it", () => {
    show({ kind: "landsAtZero", records: 1 });
    expect(screen.getByTestId("severance-proceed")).toHaveTextContent("that was the intent");
    expect(screen.getByTestId("severance-cost")).toHaveTextContent("1 signed step");
  });

  it("keeps the standing when declined", () => {
    const { onCancel, onConfirm } = show();
    fireEvent.click(screen.getByTestId("severance-cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("proceeds only on the explicit act", () => {
    const { onConfirm } = show();
    fireEvent.click(screen.getByTestId("severance-proceed"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("cannot be signed twice while the first is in flight", () => {
    const { onConfirm } = show({ busy: true });
    fireEvent.click(screen.getByTestId("severance-proceed"));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("dresses a deliberate choice as one, never as a failure", () => {
    show();
    // `error` is for failure; a negative or ended stance is an ordinary
    // legitimate choice (design.md §2.4).
    expect(screen.getByTestId("severance-confirm").innerHTML).not.toContain("error");
  });
});
