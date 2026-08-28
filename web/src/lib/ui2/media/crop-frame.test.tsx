import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { CropFrame } from "./crop-frame";
import { CENTERED, MAX_ZOOM, type Crop } from "./crop";
import { POST_SHAPES } from "./aspect";

// A host that holds the crop, so the discrete controls can be pressed in
// sequence the way a reader would use them.
function Host({ shape = "tall" as const, initial = CENTERED }: { shape?: "tall" | "square" | "wide" | "avatar" | "cover"; initial?: Crop }) {
  const [crop, setCrop] = useState(initial);
  return (
    <>
      <CropFrame src="blob:local" shape={shape} crop={crop} onChange={setCrop} />
      <output data-testid="readout">{`${crop.zoom.toFixed(2)} ${crop.x.toFixed(2)} ${crop.y.toFixed(2)}`}</output>
    </>
  );
}

describe("CropFrame", () => {
  it("draws the frame at the shape it was given", () => {
    const { rerender } = render(<CropFrame src="blob:x" shape="tall" onChange={() => {}} />);
    expect(screen.getByTestId("crop-frame").style.aspectRatio).toBe(`${POST_SHAPES.tall.ratio} / 1`);
    rerender(<CropFrame src="blob:x" shape="wide" onChange={() => {}} />);
    expect(screen.getByTestId("crop-frame").style.aspectRatio).toBe(`${POST_SHAPES.wide.ratio} / 1`);
  });

  it("draws an avatar round and a post square-cornered", () => {
    const { rerender } = render(<CropFrame src="blob:x" shape="avatar" onChange={() => {}} />);
    expect(screen.getByTestId("crop-frame").style.borderRadius).toBe("var(--radius-full)");
    rerender(<CropFrame src="blob:x" shape="square" onChange={() => {}} />);
    expect(screen.getByTestId("crop-frame").style.borderRadius).toBe("var(--radius-medium)");
  });

  // D17 and design.md §10: every drag gesture has a non-drag equivalent, and
  // the crop step must be completable without one.
  it("offers a complete non-drag route", () => {
    render(<Host />);
    const group = screen.getByRole("group", { name: "Framing" });
    expect(group).toBeInTheDocument();
    for (const name of [
      "Move the picture left",
      "Move the picture right",
      "Move the picture up",
      "Move the picture down",
      "Zoom in",
      "Zoom out",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("frames the picture with the controls alone", () => {
    render(<Host />);
    expect(screen.getByTestId("readout")).toHaveTextContent("1.00 0.50 0.50");

    // Zoom in twice, then move.
    screen.getByRole("button", { name: "Zoom in" }).click();
    screen.getByRole("button", { name: "Zoom in" }).click();
    screen.getByRole("button", { name: "Move the picture left" }).click();
    screen.getByRole("button", { name: "Move the picture up" }).click();

    expect(screen.getByTestId("readout")).toHaveTextContent("1.20 0.55 0.55");
  });

  it("disables the nudges while there is nothing to pan", () => {
    render(<Host />);
    expect(screen.getByRole("button", { name: "Move the picture left" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();

    screen.getByRole("button", { name: "Zoom in" }).click();
    expect(screen.getByRole("button", { name: "Move the picture left" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeEnabled();
  });

  it("stops the zoom at its ceiling", () => {
    render(<Host initial={{ zoom: MAX_ZOOM, x: 0.5, y: 0.5 }} />);
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
  });

  it("moves the picture under a pointer drag", () => {
    const onChange = vi.fn();
    render(<CropFrame src="blob:x" shape="square" crop={{ zoom: 2, x: 0.5, y: 0.5 }} onChange={onChange} />);
    const frame = screen.getByTestId("crop-frame");
    // jsdom lays nothing out, so the frame's box is stubbed to a real size.
    vi.spyOn(frame, "getBoundingClientRect").mockReturnValue({
      width: 400,
      height: 400,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 400,
      bottom: 400,
      toJSON: () => ({}),
    });

    frame.dispatchEvent(
      new PointerEvent("pointerdown", { pointerId: 1, clientX: 200, clientY: 200, bubbles: true }),
    );
    frame.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 1, clientX: 300, clientY: 200, bubbles: true }),
    );

    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)![0] as Crop;
    // Dragged right, so the focal point moved left.
    expect(next.x).toBeLessThan(0.5);
  });

  it("ignores a drag when there is no slack to take up", () => {
    const onChange = vi.fn();
    render(<CropFrame src="blob:x" shape="square" crop={CENTERED} onChange={onChange} />);
    const frame = screen.getByTestId("crop-frame");
    frame.dispatchEvent(
      new PointerEvent("pointerdown", { pointerId: 1, clientX: 10, clientY: 10, bubbles: true }),
    );
    frame.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 1, clientX: 90, clientY: 10, bubbles: true }),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the framing guides out of the accessibility tree", () => {
    render(<CropFrame src="blob:x" shape="tall" onChange={() => {}} />);
    // The guides are a framing aid, not content.
    expect(screen.getByTestId("crop-frame").querySelector("[aria-hidden='true']")).not.toBeNull();
  });
});
