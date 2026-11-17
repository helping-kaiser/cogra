import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useReducer } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyWizard, wizardReducer, type PickedAsset, type WizardState } from "@/lib/compose/wizard";
import { POST_SHAPES } from "@/lib/ui2/media/aspect";
import { CENTERED, fittedPicture, frameOf, stageOf, zoomBounds, type Crop, type Size } from "@/lib/ui2/media/crop";

import { CropStep } from "./crop-step";

// THE REAL `react-easy-crop`, NOT A STUB (w-cropswap, jakob's hand test of
// 2026-11-17: "the crops [don't] actually hold when swapping between the
// images"). The defect lives in how the library's own lifecycle — its
// `componentDidUpdate` on a changed zoom, its measurement on a picture's load —
// meets the frame when the focused picture changes, so a stub that only
// records props cannot see it. jsdom lays nothing out, so the layout the
// library reads is given here: the stage 390 wide (`clientWidth`), the
// library's container 390 × 488 (`getBoundingClientRect`), every picture
// scaled down (`offsetWidth` under its own pixels) and each picture's own
// pixels by its source. A browser fires `load` on every picture it shows,
// cached or not; `loaded()` does that.

const SOURCES: Readonly<Record<string, Size>> = {
  "blob:one": { width: 1200, height: 1600 },
  "blob:two": { width: 1600, height: 1200 },
};
const STAGE_WIDTH = 390;

beforeEach(() => {
  const stage = stageOf("post", STAGE_WIDTH);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(STAGE_WIDTH);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(1);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(1);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: stage.width,
    height: stage.height,
    right: stage.width,
    bottom: stage.height,
    toJSON: () => ({}),
  } as DOMRect);
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockImplementation(function (this: HTMLImageElement) {
    return SOURCES[this.getAttribute("src") ?? ""]?.width ?? 0;
  });
  vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockImplementation(function (this: HTMLImageElement) {
    return SOURCES[this.getAttribute("src") ?? ""]?.height ?? 0;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const asset = (id: string): PickedAsset => ({
  id,
  file: new Blob(),
  crop: CENTERED,
  altText: "",
  upload: { kind: "waiting" },
  kind: "picture",
});

const PREVIEWS = { one: "blob:one", two: "blob:two" };

let state: WizardState;
/** Every framing the step wrote back, in order. */
let writes: { id: string; crop: Crop }[];

beforeEach(() => {
  writes = [];
});

/** The wizard's own reducer around the crop step, as `wizard-view.tsx` wires it. */
function Host() {
  const [current, dispatch] = useReducer(wizardReducer, undefined, () => ({
    ...emptyWizard(),
    step: "crop" as const,
    assets: [asset("one"), asset("two")],
  }));
  // Handed out after the commit, never written during render.
  useEffect(() => {
    state = current;
  });
  return (
    <CropStep
      assets={current.assets}
      previews={PREVIEWS}
      shape={current.shape}
      focused={current.focused}
      onShape={(shape, stageWidth) => dispatch({ type: "shape", shape, stageWidth })}
      onFocus={(index) => dispatch({ type: "focus", index })}
      onCrop={(id, crop) => {
        writes.push({ id, crop });
        dispatch({ type: "crop", id, crop });
      }}
      onNext={() => {}}
    />
  );
}

/** The browser's `load` on the pictures the stage shows. */
function loaded() {
  for (const picture of screen.getByTestId("wizard-crop-frame").querySelectorAll("img")) {
    act(() => {
      fireEvent.load(picture);
    });
  }
}

const crop = (id: string): Crop => state.assets.find((each) => each.id === id)!.crop;
const slider = () => screen.getByTestId("wizard-crop-frame-zoom") as HTMLInputElement;
const stage = () => screen.getByTestId("wizard-crop-frame");

/** The laid picture, its frame and its zoom's bounds under `shape`. */
function geometry(id: keyof typeof PREVIEWS, shape: keyof typeof POST_SHAPES) {
  const ratio = POST_SHAPES[shape].ratio;
  const picture = fittedPicture(SOURCES[PREVIEWS[id]]!, stageOf("post", STAGE_WIDTH));
  const frame = frameOf("post", ratio, STAGE_WIDTH);
  return { picture, frame, ...zoomBounds("post", picture, ratio, STAGE_WIDTH) };
}

/** Where the offset meets its bound — an edge of the picture on the frame's. */
function edge(laid: number, window: number, zoom: number) {
  return Math.abs((laid * zoom) / 2 - window / 2);
}

/**
 * A tap on picture `index` in the strip and the load of its picture. NOTHING is
 * written to the picture left behind, and every framing written to the one
 * that takes the stage keeps the zoom and place it was stored with — except,
 * on its first sight, the rise of the untouched zoom to its `fill`.
 */
function focusOn(index: number, fill?: number) {
  const leaving = state.assets[state.focused]!.id;
  const taking = state.assets[index]!.id;
  const stored = crop(taking);
  const from = writes.length;
  act(() => {
    fireEvent.click(screen.getByTestId(`wizard-crop-pick-${index}`));
  });
  loaded();
  const during = writes.slice(from);
  expect(during.filter((write) => write.id === leaving), `writes to ${leaving}, left behind`).toEqual([]);
  for (const write of during) {
    expect([stored.zoom, fill], `${taking}'s zoom on the swap`).toContain(write.crop.zoom);
    expect(write.crop.x, `${taking}'s x on the swap`).toBe(stored.x);
    expect(write.crop.y, `${taking}'s y on the swap`).toBe(stored.y);
  }
}

function expectFraming(id: string, zoom: number, x: number, y: number) {
  const held = crop(id);
  expect(held.zoom, `${id}'s zoom`).toBeCloseTo(zoom, 6);
  expect(held.x, `${id}'s x`).toBeCloseTo(x, 6);
  expect(held.y, `${id}'s y`).toBeCloseTo(y, 6);
}

// ComposeCrop.md: "WHEN tap a picture in the strip -> that picture takes the
// crop viewport for its own framing AND every other picture keeps the framing
// it was given"; "WHEN tap a shape chip -> each picture keeps its scale and its
// position AND the shape's frame changes around it".
describe("each picture keeps its own framing across focus changes", () => {
  it("replays the owner's sequence: zoom 1, focus 2, Square, zoom and move 2, focus 1, focus 2", () => {
    render(<Host />);
    loaded();

    // Picture 1 rests at its tall fill; zoom it to twice that.
    const oneTall = geometry("one", "tall");
    expectFraming("one", oneTall.floor, 0, 0);
    act(() => {
      fireEvent.change(slider(), { target: { value: "2" } });
    });
    const oneZoom = 2 * oneTall.floor;
    expectFraming("one", oneZoom, 0, 0);

    // Focus picture 2: it rests at its own fill, picture 1 keeps its zoom.
    const twoTall = geometry("two", "tall");
    focusOn(1, twoTall.floor);
    expectFraming("one", oneZoom, 0, 0);
    expectFraming("two", twoTall.floor, 0, 0);
    expect(Number(slider().value)).toBeCloseTo(1, 2);

    // Tall (already the shape: nothing moves), then Square: both keep their
    // zoom — each already covers the square frame — and their place.
    act(() => {
      fireEvent.click(screen.getByTestId("wizard-shape-tall"));
    });
    act(() => {
      fireEvent.click(screen.getByTestId("wizard-shape-square"));
    });
    loaded();
    expect(state.shape).toBe("square");
    const twoSquare = geometry("two", "square");
    expect(twoTall.floor).toBeGreaterThan(twoSquare.floor);
    expectFraming("one", oneZoom, 0, 0);
    expectFraming("two", twoTall.floor, 0, 0);

    // Zoom picture 2 all the way in and move the frame to the picture's top
    // right — the picture goes left and down until its edges meet the frame's.
    act(() => {
      fireEvent.change(slider(), { target: { value: slider().max } });
    });
    const twoZoom = twoSquare.ceiling;
    expectFraming("two", twoZoom, 0, 0);
    for (let press = 0; press < 20; press += 1) {
      act(() => {
        fireEvent.keyDown(stage(), { key: "ArrowLeft", shiftKey: true });
      });
      act(() => {
        fireEvent.keyDown(stage(), { key: "ArrowDown", shiftKey: true });
      });
    }
    const twoX = -edge(twoSquare.picture.width, twoSquare.frame.width, twoZoom);
    const twoY = edge(twoSquare.picture.height, twoSquare.frame.height, twoZoom);
    expectFraming("two", twoZoom, twoX, twoY);
    expectFraming("one", oneZoom, 0, 0);

    // Back to picture 1: still zoomed in, still centred.
    focusOn(0);
    expectFraming("one", oneZoom, 0, 0);
    expectFraming("two", twoZoom, twoX, twoY);
    expect(Number(slider().value)).toBeCloseTo(oneZoom / geometry("one", "square").floor, 2);

    // And back to picture 2: still all the way in, still at the top right.
    focusOn(1);
    expectFraming("two", twoZoom, twoX, twoY);
    expectFraming("one", oneZoom, 0, 0);
    expect(Number(slider().value)).toBeCloseTo(twoZoom / twoSquare.floor, 2);
  });
});
