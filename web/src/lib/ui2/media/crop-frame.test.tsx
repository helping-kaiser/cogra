import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CENTERED, MIN_ZOOM, type Crop } from "./crop";
import type { CropFrameShape, LockedRatio } from "./crop-frame";

// THE LIBRARY IS STUBBED HERE ON PURPOSE, and the reason is the point of
// adopting it: `react-easy-crop`'s own panning, pinching, and rectangle
// arithmetic are its maintainers' to test, and jsdom reports every element as
// 0x0 so it could not measure anything here anyway. What this suite owns is
// everything on OUR side of the seam — the stage, the fixed frame and the
// zoom's bounds handed to the library, the keyboard route it does not provide,
// and the drawn chrome. The stub records those props and lets the callbacks be
// fired in the order the real component fires them; the stage's width is
// given by `withStage`.
const spy = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}));

vi.mock("react-easy-crop", () => ({
  default: (props: Record<string, unknown>) => {
    spy.props = props;
    const media = (props.mediaProps ?? {}) as { alt?: string };
    const cropper = (props.cropperProps ?? {}) as Record<string, string>;
    const classes = (props.classes ?? {}) as { cropAreaClassName?: string };
    return (
      <div data-testid="cropper" className={classes.cropAreaClassName} {...cropper}>
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

/** Lays every stage out `width` wide — the board's 390 unless a test says otherwise. */
function withStage(width = 390) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
}

/** The library's load report for a picture of `width` × `height` own pixels. */
function loads(width: number, height: number) {
  act(() => {
    (given().onMediaLoaded as (s: unknown) => void)({ width: 0, height: 0, naturalWidth: width, naturalHeight: height });
  });
}

/** A host that holds the crop, so the keyboard route runs as a reader runs it. */
function Host({
  shape = "tall",
  initial = CENTERED,
  zoomSlider = false,
}: {
  shape?: CropFrameShape | LockedRatio;
  initial?: Crop;
  zoomSlider?: boolean;
}) {
  const [crop, setCrop] = useState(initial);
  return (
    <>
      <CropFrame src="blob:local" shape={shape} crop={crop} onChange={setCrop} zoomSlider={zoomSlider} />
      <output data-testid="readout">{`${crop.zoom.toFixed(2)} ${crop.x} ${crop.y}`}</output>
    </>
  );
}

const readout = () => screen.getByTestId("readout").textContent;

beforeEach(() => {
  spy.props = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ONE STAGE PER CROP, THE SAME UNDER EVERY SHAPE (ComposeCrop.md:7,
// CoverCrop.md:11, AvatarCrop.md:7).
describe("the stage", () => {
  it("stands 390 × 488 for a post under every shape, and for a cover", () => {
    const { rerender } = render(<CropFrame src="blob:x" shape="tall" onChange={() => {}} />);
    const stage = () => screen.getByTestId("crop-frame").style.aspectRatio;
    expect(stage()).toBe("390 / 488");
    rerender(<CropFrame src="blob:x" shape="wide" onChange={() => {}} />);
    expect(stage()).toBe("390 / 488");
    rerender(<CropFrame src="blob:x" shape="square" onChange={() => {}} />);
    expect(stage()).toBe("390 / 488");
    rerender(<CropFrame src="blob:x" shape={{ ratio: 16 / 9 }} onChange={() => {}} />);
    expect(stage()).toBe("390 / 488");
  });

  it("stands 390 × 390 for the circle", () => {
    render(<CropFrame src="blob:x" shape="avatar" onChange={() => {}} />);
    expect(screen.getByTestId("crop-frame").style.aspectRatio).toBe("390 / 390");
  });

  // nodes.json ComposeCrop / CoverCrop: on a registered crop screen the stage
  // is its `viewport`, the slider's row its `zoom` and the slider `zoom.input`.
  it("wears the crop screen's viewport and zoom nodes when handed one", () => {
    render(<CropFrame src="blob:x" shape="tall" onChange={() => {}} zoomSlider node={{ path: "composeCrop" }} />);
    expect(screen.getByTestId("composeCrop.viewport").style.aspectRatio).toBe("390 / 488");
    const zoom = screen.getByTestId("composeCrop.zoom");
    expect(zoom).toContainElement(screen.getByTestId("composeCrop.zoom.input"));
    expect(screen.getByTestId("composeCrop.zoom.input")).toHaveAccessibleName("Zoom");
    expect(screen.queryByTestId("crop-frame")).toBeNull();
  });

  // Every crop board draws the stage edge to edge, out of the column's 24px
  // padding and with no corners to round.
  it("bleeds the stage out of the column, with no corners", () => {
    const { rerender } = render(<CropFrame src="blob:x" shape="avatar" onChange={() => {}} />);
    const stage = () => screen.getByTestId("crop-frame");
    expect(stage().className).toContain("-mx-6");
    expect(stage().className).not.toContain("w-full");
    expect(stage().style.borderRadius).toBe("");
    expect(given().cropShape).toBe("round");
    rerender(<CropFrame src="blob:x" shape="square" onChange={() => {}} />);
    expect(given().cropShape).toBe("rect");
  });

  it("hands its host the stage, whose width the host re-frames against", () => {
    const viewport = createRef<HTMLDivElement>();
    render(<CropFrame src="blob:original" shape="tall" onChange={() => {}} viewportRef={viewport} />);
    expect(viewport.current).toBe(screen.getByTestId("crop-frame"));
  });

  it("describes the picture with the alt text it was given", () => {
    render(<CropFrame src="blob:x" shape="tall" alt="A jar of honey" onChange={() => {}} />);
    expect(screen.getByAltText("A jar of honey")).toBeInTheDocument();
  });
});

// THE FRAME IS FIXED: handed to the library as its `cropSize`, so the window
// is the board's whatever the picture (ComposeCrop.md:9-13, CoverCrop.md:11,
// AvatarCrop.md:7; the numbers recomputed in crop.test.ts).
describe("the fixed frame", () => {
  it.each([
    ["tall", { width: 390, height: 487.5 }],
    ["square", { width: 390, height: 390 }],
    ["avatar", { width: 342, height: 342 }],
  ] as const)("stands the %s frame at the board's size", (shape, size) => {
    withStage();
    render(<CropFrame src="blob:x" shape={shape} onChange={() => {}} />);
    expect(given().cropSize).toEqual(size);
  });

  it("stands the wide frame at 390 ÷ 1.91", () => {
    withStage();
    render(<CropFrame src="blob:x" shape="wide" onChange={() => {}} />);
    const size = given().cropSize as { width: number; height: number };
    expect(size.width).toBe(390);
    expect(size.height).toBeCloseTo(204.19, 2);
  });

  it.each([
    [16 / 9, 192.375],
    [4 / 5, 427.5],
    [1, 342],
  ])("stands a cover's frame 342 wide at the clip's shape %f", (ratio, height) => {
    withStage();
    render(<CropFrame src="blob:x" shape={{ ratio }} onChange={() => {}} />);
    const size = given().cropSize as { width: number; height: number };
    expect(size.width).toBe(342);
    expect(size.height).toBeCloseTo(height, 9);
    expect(given().aspect).toBe(ratio);
  });

  it("never sizes the frame by the picture", () => {
    withStage();
    render(<CropFrame src="blob:x" shape="square" onChange={() => {}} />);
    loads(4000, 1000);
    expect(given().cropSize).toEqual({ width: 390, height: 390 });
    loads(300, 3000);
    expect(given().cropSize).toEqual({ width: 390, height: 390 });
  });

  it("leaves the frame to the library only until the stage has a width", () => {
    render(<CropFrame src="blob:x" shape="tall" onChange={() => {}} />);
    expect(given().cropSize).toBeUndefined();
  });

  it("lays the picture whole in the stage and hands the cropper the original", () => {
    render(<CropFrame src="blob:original" shape="wide" onChange={() => {}} />);
    expect(given().objectFit).toBe("contain");
    expect(given().image).toBe("blob:original");
  });

  // The library scales a kept offset by the cut's growth when its cut changes
  // (6.2.4 `recomputeCropPosition`, a window resize's rule); on a shape change
  // that would move the picture the host kept in place (`reshape`), so each
  // frame gets a fresh cropper — and anything else keeps the one it has.
  it("hands each shape a fresh cropper, and keeps it through anything else", () => {
    const { rerender } = render(<CropFrame src="blob:original" shape="tall" onChange={() => {}} />);
    const tall = screen.getByTestId("cropper");
    rerender(<CropFrame src="blob:original" shape="tall" crop={{ ...CENTERED, zoom: 2 }} onChange={() => {}} />);
    expect(screen.getByTestId("cropper")).toBe(tall);
    rerender(<CropFrame src="blob:original" shape="wide" crop={{ ...CENTERED, zoom: 2 }} onChange={() => {}} />);
    expect(screen.getByTestId("cropper")).not.toBe(tall);
  });

  // The scrim is 45 % black and the post's frame carries the thirds; the
  // cover's window and the circle the hairline (tokens-2.css, `cg-crop-frame`).
  it("marks each frame for its drawing, the thirds on a post's only", () => {
    const { rerender } = render(<CropFrame src="blob:x" shape="tall" onChange={() => {}} />);
    expect(screen.getByTestId("cropper")).toHaveClass("cg-crop-frame", "cg-crop-frame--post");
    expect(given().showGrid).toBe(true);
    rerender(<CropFrame src="blob:x" shape={{ ratio: 9 / 16 }} onChange={() => {}} />);
    expect(screen.getByTestId("cropper")).toHaveClass("cg-crop-frame--cover");
    expect(given().showGrid).toBe(false);
    rerender(<CropFrame src="blob:x" shape="avatar" onChange={() => {}} />);
    expect(screen.getByTestId("cropper")).toHaveClass("cg-crop-frame--avatar");
    expect(given().showGrid).toBe(false);
  });
});

// THE ZOOM'S FLOOR IS THE FILL AND ITS CEILING ABOUT 4× (each sidecar's "NEVER
// below the fill or past about 4×").
describe("the zoom's bounds", () => {
  // A 4000 × 3000 landscape lays 390 × 292.5 in the post's stage; Tall's
  // frame (390 × 487.5) needs 487.5 / 292.5 of it.
  const TALL_FILL = 487.5 / 292.5;

  it("raises an untouched framing to the frame's fill once the picture is measured", () => {
    withStage();
    render(<Host />);
    expect(readout()).toBe("1.00 0 0");
    loads(4000, 3000);
    expect(readout()).toBe(`${TALL_FILL.toFixed(2)} 0 0`);
    expect(given().zoom).toBeCloseTo(TALL_FILL, 9);
    expect(given().minZoom).toBeCloseTo(TALL_FILL, 9);
    expect(given().maxZoom).toBeCloseTo(4 * TALL_FILL, 9);
  });

  it("keeps a post's ceiling at its tallest frame's under every shape", () => {
    withStage();
    render(<Host shape="wide" />);
    loads(4000, 3000);
    // Wide's fill is 1 (390 across); the ceiling stays Tall's.
    expect(given().minZoom).toBe(1);
    expect(given().maxZoom).toBeCloseTo(4 * TALL_FILL, 9);
  });

  it("puts a cover's and the circle's ceiling at 4× their own fill", () => {
    withStage();
    const { unmount } = render(<Host shape={{ ratio: 16 / 9 }} />);
    loads(4000, 3000);
    // 342 × 192.375 under a 390 × 292.5 lay: the fill is 342 / 390.
    expect(given().minZoom).toBeCloseTo(342 / 390, 9);
    expect(given().maxZoom).toBeCloseTo((4 * 342) / 390, 9);
    unmount();
    render(<Host shape="avatar" />);
    loads(4000, 3000);
    expect(given().minZoom).toBeCloseTo(342 / 292.5, 9);
    expect(given().maxZoom).toBeCloseTo((4 * 342) / 292.5, 9);
  });

  it("holds a zoom the cropper reports outside the bounds", () => {
    withStage();
    const changes: Crop[] = [];
    render(<CropFrame src="blob:x" shape="tall" crop={{ ...CENTERED, zoom: 2 }} onChange={(c) => changes.push(c)} />);
    loads(4000, 3000);
    act(() => (given().onZoomChange as (z: number) => void)(99));
    expect(changes.at(-1)!.zoom).toBeCloseTo(4 * TALL_FILL, 9);
    act(() => (given().onZoomChange as (z: number) => void)(0.1));
    expect(changes.at(-1)!.zoom).toBeCloseTo(TALL_FILL, 9);
  });

  it("leaves a zoom inside the bounds exactly where it stood", () => {
    withStage();
    const changes: Crop[] = [];
    render(<CropFrame src="blob:x" shape="tall" crop={{ ...CENTERED, zoom: 2.5 }} onChange={(c) => changes.push(c)} />);
    loads(4000, 3000);
    expect(changes).toEqual([]);
    expect(given().zoom).toBe(2.5);
  });

  // A tiny picture lays at its own pixels: its fill zooms it up to cover the frame.
  it("covers the frame with a tiny picture by zooming it up", () => {
    withStage();
    render(<Host shape="square" />);
    loads(40, 30);
    expect(readout()).toBe(`${(390 / 30).toFixed(2)} 0 0`);
  });

  it("measures a new picture afresh, never by the last one's pixels", () => {
    withStage();
    const { rerender } = render(<CropFrame src="blob:a" shape="tall" crop={{ ...CENTERED, zoom: 3 }} onChange={() => {}} />);
    loads(4000, 3000);
    expect(given().minZoom).toBeCloseTo(TALL_FILL, 9);
    rerender(<CropFrame src="blob:b" shape="tall" crop={{ ...CENTERED, zoom: 3 }} onChange={() => {}} />);
    expect(given().minZoom).toBe(MIN_ZOOM);
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
      { x: 10, y: 20, width: 80, height: 100 },
      { x: 100, y: 200, width: 800, height: 1000 },
    );

    // Each callback merges into the newest value, not the one its render closed
    // over — otherwise the area would arrive carrying a stale position.
    expect(changes.at(-1)).toEqual({
      x: 12,
      y: -4,
      zoom: 1.4,
      area: { x: 100, y: 200, width: 800, height: 1000 },
      areaPercent: { x: 10, y: 20, width: 80, height: 100 },
    });
  });

  // BOTH units of the report are kept. The pixels are what the encoder bakes;
  // the percentages are what lets a thumbnail downstream draw this framing
  // without ever learning how many pixels wide the source is.
  it("keeps the percentage half of the report beside the pixel half", () => {
    const changes: Crop[] = [];
    render(<CropFrame src="blob:x" shape="tall" crop={CENTERED} onChange={(c) => changes.push(c)} />);

    (given().onCropComplete as (a: unknown, b: unknown) => void)(
      { x: 0, y: 12.5, width: 100, height: 62.5 },
      { x: 0, y: 100, width: 800, height: 500 },
    );

    const last = changes.at(-1)!;
    expect(last.area).toEqual({ x: 0, y: 100, width: 800, height: 500 });
    expect(last.areaPercent).toEqual({ x: 0, y: 12.5, width: 100, height: 62.5 });
  });

  it("drops an unusable percentage without dropping the pixels", () => {
    const changes: Crop[] = [];
    render(<CropFrame src="blob:x" shape="tall" crop={CENTERED} onChange={(c) => changes.push(c)} />);

    (given().onCropComplete as (a: unknown, b: unknown) => void)(
      { x: 0, y: 0, width: 0, height: 0 },
      { x: 0, y: 100, width: 800, height: 500 },
    );

    const last = changes.at(-1)!;
    expect(last.area).toEqual({ x: 0, y: 100, width: 800, height: 500 });
    expect(last.areaPercent).toBeNull();
  });

  // The cropper re-reports its position on every recompute, including the one
  // our own report caused. Passing an equal-but-new object through is an
  // infinite render loop — React fails it with "Maximum update depth exceeded".
  it("says nothing when the cropper re-reports the framing it already has", () => {
    const changes: Crop[] = [];
    const crop = {
      x: 5,
      y: 6,
      zoom: 1.2,
      area: { x: 1, y: 2, width: 3, height: 4 },
      areaPercent: { x: 10, y: 20, width: 30, height: 40 },
    };
    render(<CropFrame src="blob:x" shape="tall" crop={crop} onChange={(c) => changes.push(c)} />);

    const props = given();
    (props.onCropChange as (p: { x: number; y: number }) => void)({ x: 5, y: 6 });
    (props.onZoomChange as (z: number) => void)(1.2);
    (props.onCropComplete as (a: unknown, b: unknown) => void)(
      { x: 10, y: 20, width: 30, height: 40 },
      { x: 1, y: 2, width: 3, height: 4 },
    );

    expect(changes).toEqual([]);
  });

  it("drops a measurement taken before there was anything to measure", () => {
    const changes: Crop[] = [];
    const framed = {
      x: 0,
      y: 0,
      zoom: 1,
      area: { x: 1, y: 2, width: 3, height: 4 },
      areaPercent: null,
    };
    render(<CropFrame src="blob:x" shape="tall" crop={framed} onChange={(c) => changes.push(c)} />);

    const complete = given().onCropComplete as (a: unknown, b: unknown) => void;
    complete({}, { x: 0, y: 0, width: 0, height: 0 });
    complete({}, { x: Number.NaN, y: Number.NaN, width: Number.NaN, height: Number.NaN });

    // The framing the author already has is worth more than a measurement of
    // nothing, so neither report reaches the draft.
    expect(changes).toEqual([]);
  });
});

// design.md §10: every drag gesture needs a non-drag equivalent; the K13
// round drew it (CropViewport.jsx): arrows pan 1 % (10 % with Shift), the
// slider zooms, and the zoom and recentre keys stay.
describe("the keyboard route", () => {
  // An 800 × 1000 picture lays the post stage's full width at 4:5 — exactly
  // Tall's frame: its fill is 1 and its ceiling 4. (A 400 stage here, so the
  // steps are whole pixels: it lays 400 × 500.)
  it("pans by 1 % of the picture an arrow, 10 % with Shift, held at the edge", () => {
    withStage(400);
    render(<Host initial={{ ...CENTERED, zoom: 2 }} />);
    loads(800, 1000);
    const stage = screen.getByTestId("crop-frame");
    // 1 % of 400 · 2 = 8px.
    fireEvent.keyDown(screen.getByTestId("cropper"), { key: "ArrowRight" });
    expect(readout()).toBe("2.00 8 0");
    // 10 % of 500 · 2 = 100px up.
    fireEvent.keyDown(screen.getByTestId("cropper"), { key: "ArrowUp", shiftKey: true });
    expect(readout()).toBe("2.00 8 -100");
    // The edge: |400 · 2 / 2 − 400 / 2| = 200, and |500 · 2 / 2 − 500 / 2| = 250.
    for (let i = 0; i < 5; i += 1) fireEvent.keyDown(stage, { key: "ArrowRight", shiftKey: true });
    expect(readout()).toBe("2.00 200 -100");
    for (let i = 0; i < 5; i += 1) fireEvent.keyDown(stage, { key: "ArrowUp", shiftKey: true });
    expect(readout()).toBe("2.00 200 -250");
  });

  it("draws the zoom slider under the stage, its value the zoom as a share of the fill", () => {
    withStage();
    render(<Host initial={{ ...CENTERED, zoom: 2.5 }} zoomSlider />);
    loads(4000, 3000);
    const slider = screen.getByRole("slider", { name: "Zoom" });
    expect(slider).toHaveAttribute("min", "1");
    expect(Number(slider.getAttribute("max"))).toBeCloseTo(4, 9);
    expect(Number((slider as HTMLInputElement).value)).toBeCloseTo(2.5 / (487.5 / 292.5), 2);
  });

  it("zooms from the slider by shares of the fill", () => {
    withStage();
    render(<Host zoomSlider />);
    loads(4000, 3000);
    fireEvent.change(screen.getByRole("slider", { name: "Zoom" }), { target: { value: "2" } });
    expect(readout()).toBe(`${((2 * 487.5) / 292.5).toFixed(2)} 0 0`);
  });

  // CROP_ZOOM_CSS: the drawn track, its filled part read from `--cg-range-at`.
  it("draws the house track and fills it to the thumb", () => {
    withStage();
    render(<Host initial={{ ...CENTERED, zoom: 2.5 }} shape="square" zoomSlider />);
    loads(800, 1000);
    // Square under an 800 × 1000 lay of 390 × 487.5: the fill is 1, the
    // ceiling Tall's 4, so 2.5 stands half way.
    const slider = screen.getByRole("slider", { name: "Zoom" });
    expect(slider).toHaveClass("cg-range");
    expect(slider.className).not.toContain("accent-");
    expect(slider.style.getPropertyValue("--cg-range-at")).toBe("50.00%");
  });

  it("zooms in and out on plus and minus, a tenth of the fill a press", () => {
    withStage();
    render(<Host />);
    loads(800, 1000);
    const stage = screen.getByTestId("crop-frame");
    fireEvent.keyDown(stage, { key: "+" });
    fireEvent.keyDown(stage, { key: "+" });
    expect(readout()).toBe("1.20 0 0");
    fireEvent.keyDown(stage, { key: "-" });
    expect(readout()).toBe("1.10 0 0");
  });

  it("cannot zoom past either end", () => {
    withStage();
    render(<Host />);
    loads(800, 1000);
    const stage = screen.getByTestId("crop-frame");
    for (let i = 0; i < 40; i += 1) fireEvent.keyDown(stage, { key: "-" });
    expect(readout()).toBe("1.00 0 0");
    for (let i = 0; i < 60; i += 1) fireEvent.keyDown(stage, { key: "+" });
    expect(readout()).toBe("4.00 0 0");
  });

  it("recentres on Home at the fill, and drops the area so a fresh one is measured", () => {
    withStage();
    const changes: Crop[] = [];
    render(
      <CropFrame
        src="blob:x"
        shape="tall"
        crop={{
          x: 30,
          y: 40,
          zoom: 2,
          area: { x: 1, y: 2, width: 3, height: 4 },
          areaPercent: { x: 10, y: 20, width: 30, height: 40 },
        }}
        onChange={(c) => changes.push(c)}
      />,
    );
    loads(4000, 3000);
    fireEvent.keyDown(screen.getByTestId("crop-frame"), { key: "Home" });
    expect(changes.at(-1)).toEqual({
      x: 0,
      y: 0,
      zoom: 487.5 / 292.5,
      area: null,
      areaPercent: null,
    });
  });

  it("tells a reader the keys rather than painting a control", () => {
    render(<CropFrame src="blob:x" shape="tall" onChange={() => {}} />);
    const description = screen.getByText(/arrow keys/i);
    expect(description).toHaveClass("sr-only");
    expect(screen.getByTestId("cropper")).toHaveAttribute("aria-describedby", description.id);
    // CropViewport.jsx: the stage takes focus under the master's own name.
    expect(screen.getByTestId("cropper")).toHaveAttribute("aria-label", "Move the picture");
    expect(screen.getByTestId("cropper")).toHaveAttribute("role", "group");
  });
});

// jakob, round 6: "when returning to the crop section ... the crop should be
// 'remembered' so the user sees his current crop and does not need to restart".
describe("coming back to a framing already chosen", () => {
  const FRAMED: Crop = {
    x: -30,
    y: 44,
    zoom: 1.8,
    area: { x: 100, y: 0, width: 800, height: 1000 },
    areaPercent: { x: 10, y: 0, width: 80, height: 100 },
  };

  it("hands the saved framing straight back to a freshly mounted cropper", () => {
    const first = render(<CropFrame src="blob:x" shape="tall" crop={FRAMED} onChange={() => {}} />);
    first.unmount();
    render(<CropFrame src="blob:x" shape="tall" crop={FRAMED} onChange={() => {}} />);
    expect(given().crop).toEqual({ x: -30, y: 44 });
    expect(given().zoom).toBe(1.8);
  });

  it("re-seeds whichever way the reader arrives", () => {
    for (const shape of ["tall", "square"] as const) {
      const mounted = render(<CropFrame src="blob:x" shape={shape} crop={FRAMED} onChange={() => {}} />);
      expect(given().crop).toEqual({ x: -30, y: 44 });
      expect(given().zoom).toBe(1.8);
      mounted.unmount();
    }
  });

  // The README warns that `croppedAreaPixels` is rounded and "may result in a
  // slight drifting crop/zoom" when fed back for restoration.
  it("restores by driving the controlled props, never by replaying the area", () => {
    render(<CropFrame src="blob:x" shape="tall" crop={FRAMED} onChange={() => {}} />);
    expect(given().initialCroppedAreaPixels).toBeUndefined();
    expect(given().initialCroppedAreaPercentages).toBeUndefined();
  });

  it("keeps a framing the reader never touched on the way through", () => {
    withStage();
    const changes: Crop[] = [];
    render(<CropFrame src="blob:x" shape="tall" crop={FRAMED} onChange={(c) => changes.push(c)} />);
    // 800 × 1000 lays Tall's frame exactly: 1.8 is inside the bounds.
    loads(800, 1000);
    (given().onCropChange as (p: { x: number; y: number }) => void)({ x: -30, y: 44 });
    (given().onZoomChange as (z: number) => void)(1.8);
    (given().onCropComplete as (a: unknown, b: unknown) => void)(FRAMED.areaPercent, FRAMED.area);
    expect(changes).toEqual([]);
  });
});
