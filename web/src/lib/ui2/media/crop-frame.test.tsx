import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CENTERED, MAX_ZOOM, MIN_ZOOM, type Crop } from "./crop";
import { POST_SHAPES } from "./aspect";

// THE LIBRARY IS STUBBED HERE ON PURPOSE, and the reason is the point of
// adopting it: `react-easy-crop`'s own panning, pinching, and rectangle
// arithmetic are its maintainers' to test, and jsdom reports every element as
// 0x0 so it could not measure anything here anyway. What this suite owns is
// everything on OUR side of the seam — the boarded chrome, the keyboard route
// the library does not provide, and the props that carry the two defects
// jakob reported. The stub records those props and lets the callbacks be fired
// in the order the real component fires them.
const spy = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}));

vi.mock("react-easy-crop", () => ({
  default: (props: Record<string, unknown>) => {
    spy.props = props;
    const media = (props.mediaProps ?? {}) as { alt?: string };
    const cropper = (props.cropperProps ?? {}) as Record<string, string>;
    return (
      <div data-testid="cropper" {...cropper}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={props.image as string} alt={media.alt ?? ""} />
      </div>
    );
  },
}));

// Imported after the mock so the component binds the stub.
const { CropFrame } = await import("./crop-frame");

function given() {
  const props = spy.props;
  if (props === null) throw new Error("the cropper was never rendered");
  return props;
}

/** A host that holds the crop, so the keyboard route runs as a reader runs it. */
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
      <output data-testid="readout">{`${crop.zoom.toFixed(2)} ${crop.x} ${crop.y}`}</output>
    </>
  );
}

const readout = () => screen.getByTestId("readout").textContent;

beforeEach(() => {
  spy.props = null;
});

describe("the chrome around the cropper", () => {
  it("draws the frame at the shape it was given", () => {
    const { rerender } = render(<CropFrame src="blob:x" shape="tall" onChange={() => {}} />);
    expect(screen.getByTestId("crop-frame").style.aspectRatio).toBe(`${POST_SHAPES.tall.ratio} / 1`);
    rerender(<CropFrame src="blob:x" shape="wide" onChange={() => {}} />);
    expect(screen.getByTestId("crop-frame").style.aspectRatio).toBe(`${POST_SHAPES.wide.ratio} / 1`);
  });

  it("rounds the avatar frame and squares the post frames", () => {
    const { rerender } = render(<CropFrame src="blob:x" shape="avatar" onChange={() => {}} />);
    expect(screen.getByTestId("crop-frame").style.borderRadius).toBe("var(--radius-full)");
    expect(given().cropShape).toBe("round");
    rerender(<CropFrame src="blob:x" shape="square" onChange={() => {}} />);
    expect(screen.getByTestId("crop-frame").style.borderRadius).toBe("var(--radius-medium)");
    expect(given().cropShape).toBe("rect");
  });

  it("keeps the rule-of-thirds guides the canvas draws", () => {
    render(<CropFrame src="blob:x" shape="tall" onChange={() => {}} />);
    expect(given().showGrid).toBe(true);
  });

  it("describes the picture with the alt text it was given", () => {
    render(<CropFrame src="blob:x" shape="tall" alt="A jar of honey" onChange={() => {}} />);
    expect(screen.getByAltText("A jar of honey")).toBeInTheDocument();
  });
});

// The first reported defect: "the full image doesn't render before cropping —
// cut off instantly; cannot select the wanted section". The old frame
// cover-fitted the picture, so most of it was never drawn. "contain" is the one
// prop that decides this, which is why it is asserted rather than assumed.
describe("the whole picture is on screen at rest", () => {
  it("fits the picture inside the frame instead of filling it", () => {
    render(<CropFrame src="blob:x" shape="tall" onChange={() => {}} />);
    expect(given().objectFit).toBe("contain");
  });

  it("hands the cropper the picture itself, so every section is reachable", () => {
    render(<CropFrame src="blob:original" shape="wide" onChange={() => {}} />);
    expect(given().image).toBe("blob:original");
  });
});

// The second reported defect: "shape-switch must allow re-framing any section
// at any ratio". A shape switch changes the rectangle's aspect while the media
// stays the original picture — the frame never crops a crop.
describe("switching shape re-frames against the original", () => {
  it("changes the rectangle's aspect and keeps the original as the media", () => {
    const { rerender } = render(<CropFrame src="blob:original" shape="tall" onChange={() => {}} />);
    expect(given().aspect).toBe(POST_SHAPES.tall.ratio);

    rerender(<CropFrame src="blob:original" shape="wide" onChange={() => {}} />);
    expect(given().aspect).toBe(POST_SHAPES.wide.ratio);
    expect(given().image).toBe("blob:original");
    expect(given().objectFit).toBe("contain");
  });
});

describe("what the cropper reports back", () => {
  it("keeps the position, the zoom, and the measured area from one tick", () => {
    const changes: Crop[] = [];
    render(<CropFrame src="blob:x" shape="tall" crop={CENTERED} onChange={(c) => changes.push(c)} />);

    const props = given();
    (props.onCropChange as (p: { x: number; y: number }) => void)({ x: 12, y: -4 });
    (props.onZoomChange as (z: number) => void)(1.4);
    (props.onCropComplete as (a: unknown, b: unknown) => void)(
      {},
      { x: 100, y: 200, width: 800, height: 1000 },
    );

    // Each callback merges into the newest value, not the one its render closed
    // over — otherwise the area would arrive carrying a stale position.
    expect(changes.at(-1)).toEqual({
      x: 12,
      y: -4,
      zoom: 1.4,
      area: { x: 100, y: 200, width: 800, height: 1000 },
    });
  });

  // The cropper re-reports its position on every recompute, including the one
  // our own report caused. Passing an equal-but-new object through is an
  // infinite render loop — React fails it with "Maximum update depth exceeded".
  it("says nothing when the cropper re-reports the framing it already has", () => {
    const changes: Crop[] = [];
    const crop = { x: 5, y: 6, zoom: 1.2, area: { x: 1, y: 2, width: 3, height: 4 } };
    render(<CropFrame src="blob:x" shape="tall" crop={crop} onChange={(c) => changes.push(c)} />);

    const props = given();
    (props.onCropChange as (p: { x: number; y: number }) => void)({ x: 5, y: 6 });
    (props.onZoomChange as (z: number) => void)(1.2);
    (props.onCropComplete as (a: unknown, b: unknown) => void)(
      {},
      { x: 1, y: 2, width: 3, height: 4 },
    );

    expect(changes).toEqual([]);
  });

  it("drops a measurement taken before there was anything to measure", () => {
    const changes: Crop[] = [];
    const framed = { x: 0, y: 0, zoom: 1, area: { x: 1, y: 2, width: 3, height: 4 } };
    render(<CropFrame src="blob:x" shape="tall" crop={framed} onChange={(c) => changes.push(c)} />);

    const complete = given().onCropComplete as (a: unknown, b: unknown) => void;
    complete({}, { x: 0, y: 0, width: 0, height: 0 });
    complete({}, { x: Number.NaN, y: Number.NaN, width: Number.NaN, height: Number.NaN });

    // The framing the author already has is worth more than a measurement of
    // nothing, so neither report reaches the draft.
    expect(changes).toEqual([]);
  });

  it("holds a zoom the cropper reports outside the range", () => {
    const changes: Crop[] = [];
    render(<CropFrame src="blob:x" shape="tall" crop={CENTERED} onChange={(c) => changes.push(c)} />);
    (given().onZoomChange as (z: number) => void)(99);
    expect(changes.at(-1)!.zoom).toBe(MAX_ZOOM);
  });
});

// design.md §10: every drag gesture needs a non-drag equivalent, and the
// fix-round-2 ruling forbids drawing controls for it. The library brings the
// arrow keys; zoom and recentre are ours, and they may not be dropped.
describe("the invisible keyboard route", () => {
  it("leaves the arrow keys to the library", () => {
    render(<Host />);
    expect(given().keyboardStep).toBeGreaterThan(1);
  });

  it("zooms in and out on plus and minus", () => {
    render(<Host />);
    const frame = screen.getByTestId("crop-frame");
    fireEvent.keyDown(frame, { key: "+" });
    fireEvent.keyDown(frame, { key: "+" });
    expect(readout()).toBe("1.20 0 0");
    fireEvent.keyDown(frame, { key: "-" });
    expect(readout()).toBe("1.10 0 0");
  });

  it("cannot zoom past either end", () => {
    render(<Host />);
    const frame = screen.getByTestId("crop-frame");
    for (let i = 0; i < 40; i += 1) fireEvent.keyDown(frame, { key: "-" });
    expect(readout()).toBe(`${MIN_ZOOM.toFixed(2)} 0 0`);
    for (let i = 0; i < 60; i += 1) fireEvent.keyDown(frame, { key: "+" });
    expect(readout()).toBe(`${MAX_ZOOM.toFixed(2)} 0 0`);
  });

  it("recentres on Home, and drops the area so a fresh one is measured", () => {
    const changes: Crop[] = [];
    render(
      <CropFrame
        src="blob:x"
        shape="tall"
        crop={{ x: 30, y: 40, zoom: 2, area: { x: 1, y: 2, width: 3, height: 4 } }}
        onChange={(c) => changes.push(c)}
      />,
    );
    fireEvent.keyDown(screen.getByTestId("crop-frame"), { key: "Home" });
    expect(changes.at(-1)).toEqual({ x: 0, y: 0, zoom: MIN_ZOOM, area: null });
  });

  it("tells a reader the keys rather than painting a control", () => {
    render(<CropFrame src="blob:x" shape="tall" onChange={() => {}} />);
    const description = screen.getByText(/arrow keys/i);
    expect(description).toHaveClass("sr-only");
    expect(screen.getByTestId("cropper")).toHaveAttribute("aria-describedby", description.id);
    expect(screen.getByTestId("cropper")).toHaveAttribute("aria-label", "The picture's framing");
  });
});
