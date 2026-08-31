import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { CropFrame } from "./crop-frame";
import { CENTERED, type Crop } from "./crop";
import { POST_SHAPES } from "./aspect";

// A host that holds the crop, so the keyboard route can be driven in sequence
// the way a reader would use it.
function Host({
  shape = "tall" as const,
  initial = CENTERED,
}: {
  shape?: "tall" | "square" | "wide" | "avatar";
  initial?: Crop;
}) {
  const [crop, setCrop] = useState(initial);
  return (
    <>
      <CropFrame src="blob:local" shape={shape} crop={crop} onChange={setCrop} />
      <output data-testid="readout">{`${crop.zoom.toFixed(2)} ${crop.x.toFixed(2)} ${crop.y.toFixed(2)}`}</output>
    </>
  );
}

/** jsdom decodes nothing, so the picture's own shape is declared to the frame. */
function loadPicture(width: number, height: number) {
  const image = screen.getByTestId("crop-frame").querySelector("img")!;
  Object.defineProperty(image, "naturalWidth", { value: width, configurable: true });
  Object.defineProperty(image, "naturalHeight", { value: height, configurable: true });
  fireEvent.load(image);
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

  // The canvas draws no framing controls, and the fix-round-2 ruling settles it:
  // the accessibility requirement is met invisibly.
  it("draws no framing controls of its own", () => {
    render(<Host />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  // D17 and design.md §10: every drag gesture has a non-drag equivalent, and the
  // crop step must be completable without one. Here that route is the keyboard.
  it("takes focus and says how it is driven", () => {
    render(<Host />);
    const frame = screen.getByRole("group", { name: "The picture's framing" });
    expect(frame).toHaveAttribute("tabindex", "0");
    expect(frame).toHaveAccessibleDescription(/arrow keys/i);
    expect(frame).toHaveAccessibleDescription(/zoom in/i);
  });

  it("frames the picture with the keyboard alone", () => {
    render(<Host />);
    const frame = screen.getByTestId("crop-frame");
    expect(screen.getByTestId("readout")).toHaveTextContent("1.00 0.50 0.50");

    fireEvent.keyDown(frame, { key: "+" });
    fireEvent.keyDown(frame, { key: "+" });
    fireEvent.keyDown(frame, { key: "ArrowLeft" });
    fireEvent.keyDown(frame, { key: "ArrowUp" });

    expect(screen.getByTestId("readout")).toHaveTextContent("1.20 0.55 0.55");
  });

  it("zooms back out and re-centres from the keyboard", () => {
    render(<Host initial={{ zoom: 1.5, x: 0.2, y: 0.8 }} />);
    const frame = screen.getByTestId("crop-frame");

    fireEvent.keyDown(frame, { key: "-" });
    expect(screen.getByTestId("readout")).toHaveTextContent("1.40 0.20 0.80");

    fireEvent.keyDown(frame, { key: "Home" });
    expect(screen.getByTestId("readout")).toHaveTextContent("1.00 0.50 0.50");
  });

  // At zoom 1 an off-shape picture still has the cover overflow to move across,
  // which is the framing the fix-round-2 ruling requires to be reachable.
  it("moves a tall picture through a wide frame at rest", () => {
    render(<Host shape="wide" />);
    loadPicture(1000, 2000);
    fireEvent.keyDown(screen.getByTestId("crop-frame"), { key: "ArrowUp" });
    expect(screen.getByTestId("readout")).toHaveTextContent("1.00 0.50 0.55");
  });

  it("moves the picture under a pointer drag", () => {
    const onChange = vi.fn();
    render(
      <CropFrame src="blob:x" shape="square" crop={{ zoom: 2, x: 0.5, y: 0.5 }} onChange={onChange} />,
    );
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

  it("ignores a drag when the picture is already shown whole", () => {
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
