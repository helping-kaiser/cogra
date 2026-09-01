import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { knobTravelInset } from "@/lib/stance/pad-geometry";
import { StancePad } from "./stance-pad";

/** The field is 240 square and the knob is the board's 24, so the travel is this. */
const HALF_EXTENT = 240 / 2 - knobTravelInset(undefined, 24);

function draw(overrides: Partial<Parameters<typeof StancePad>[0]> = {}) {
  const props = {
    value: { pDirected: 0.1, pInterest: 0.1 },
    onChange: vi.fn(),
    ariaLabel: 'Your stance toward "The long way home"',
    ...overrides,
  };
  render(<StancePad {...props} />);
  return props;
}

/** The board's own field: 240 x 240, laid out at the origin. */
function measureField(field: HTMLElement) {
  vi.spyOn(field, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 240,
    height: 240,
    right: 240,
    bottom: 240,
    x: 0,
    y: 0,
    toJSON: () => "",
  });
}

describe("StancePad", () => {
  it("puts the knob where the pair says, in the travel box's own percentages", () => {
    draw({ value: { pDirected: 0.1, pInterest: 0.1 } });
    // The board draws +0.10 / +0.10 at 55% / 45% — the same geometry.
    expect(screen.getByTestId("stance-pad-knob")).toHaveStyle({ left: "55%", top: "45%" });
  });

  it("puts the origin dead centre", () => {
    draw({ value: { pDirected: 0, pInterest: 0 } });
    expect(screen.getByTestId("stance-pad-knob")).toHaveStyle({ left: "50%", top: "50%" });
  });

  it("puts a corner pick in the corner of the travel box", () => {
    draw({ value: { pDirected: -1, pInterest: 1 } });
    expect(screen.getByTestId("stance-pad-knob")).toHaveStyle({ left: "0%", top: "0%" });
  });

  it("speaks the pair with its axes named, for a reader who cannot see the knob", () => {
    draw({ value: { pDirected: 0.4, pInterest: -0.2 } });
    expect(screen.getByTestId("stance-pad-field")).toHaveAttribute(
      "aria-valuetext",
      "How you stand +0.40, In your world -0.20",
    );
  });

  it("carries the label naming what the stance is toward", () => {
    draw();
    expect(screen.getByTestId("stance-pad-field")).toHaveAttribute(
      "aria-label",
      'Your stance toward "The long way home"',
    );
  });

  describe("the drag", () => {
    it("moves the pick by the travel, from where the pointer went down", () => {
      const props = draw({ value: { pDirected: 0, pInterest: 0 } });
      const field = screen.getByTestId("stance-pad-field");
      measureField(field);
      fireEvent.pointerDown(field, { clientX: 100, clientY: 100, pointerId: 1 });
      // Half the travel box's half-extent to the right is half a unit of
      // valence; the same upward is half a unit of connection.
      fireEvent.pointerMove(field, {
        clientX: 100 + HALF_EXTENT / 2,
        clientY: 100 - HALF_EXTENT / 2,
        pointerId: 1,
      });
      expect(props.onChange).toHaveBeenCalledWith({
        pDirected: expect.closeTo(0.5, 10),
        pInterest: expect.closeTo(0.5, 10),
      });
    });

    it("adjusts the pick already standing rather than starting over", () => {
      const props = draw({ value: { pDirected: 0.5, pInterest: 0 } });
      const field = screen.getByTestId("stance-pad-field");
      measureField(field);
      fireEvent.pointerDown(field, { clientX: 50, clientY: 50, pointerId: 1 });
      fireEvent.pointerMove(field, { clientX: 50 + HALF_EXTENT / 2, clientY: 50, pointerId: 1 });
      expect(props.onChange).toHaveBeenCalledWith({ pDirected: 1, pInterest: 0 });
    });

    it("ignores a move that never went down on the field", () => {
      const props = draw();
      const field = screen.getByTestId("stance-pad-field");
      measureField(field);
      fireEvent.pointerMove(field, { clientX: 200, clientY: 40, pointerId: 1 });
      expect(props.onChange).not.toHaveBeenCalled();
    });

    it("stops moving the pick once the pointer is up", () => {
      const onChange = vi.fn();
      draw({ onChange });
      const field = screen.getByTestId("stance-pad-field");
      measureField(field);
      fireEvent.pointerDown(field, { clientX: 100, clientY: 100, pointerId: 1 });
      fireEvent.pointerUp(field, { pointerId: 1 });
      onChange.mockClear();
      fireEvent.pointerMove(field, { clientX: 180, clientY: 100, pointerId: 1 });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("the keyboard", () => {
    it("walks the pick right with the right arrow", () => {
      const props = draw({ value: { pDirected: 0, pInterest: 0 } });
      fireEvent.keyDown(screen.getByTestId("stance-pad-field"), { key: "ArrowRight" });
      expect(props.onChange).toHaveBeenCalledWith({ pDirected: 0.05, pInterest: 0 });
    });

    it("walks connection upward with the up arrow — screen down is not value down", () => {
      const props = draw({ value: { pDirected: 0, pInterest: 0 } });
      fireEvent.keyDown(screen.getByTestId("stance-pad-field"), { key: "ArrowUp" });
      expect(props.onChange).toHaveBeenCalledWith({ pDirected: 0, pInterest: 0.05 });
    });

    it("takes a bigger step with shift held", () => {
      const props = draw({ value: { pDirected: 0, pInterest: 0 } });
      fireEvent.keyDown(screen.getByTestId("stance-pad-field"), {
        key: "ArrowLeft",
        shiftKey: true,
      });
      expect(props.onChange).toHaveBeenCalledWith({ pDirected: -0.2, pInterest: 0 });
    });

    it("stops at the edge of the value space rather than walking out of it", () => {
      const props = draw({ value: { pDirected: 1, pInterest: 1 } });
      fireEvent.keyDown(screen.getByTestId("stance-pad-field"), { key: "ArrowRight" });
      expect(props.onChange).toHaveBeenCalledWith({ pDirected: 1, pInterest: 1 });
    });

    it("leaves keys that are not arrows to the sheet", () => {
      const props = draw();
      fireEvent.keyDown(screen.getByTestId("stance-pad-field"), { key: "Enter" });
      expect(props.onChange).not.toHaveBeenCalled();
    });
  });
});
