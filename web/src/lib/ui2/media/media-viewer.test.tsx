// THE FULLSCREEN VIEWER (DV-01 / H-25), against the board's own rules.
//
// The gestures are pointer events rather than clicks, because that is what a
// browser delivers for a swipe and a pinch — and the axis rules, the zoom
// bounds and the dismiss are precisely the parts a click-driven test cannot
// reach.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { intersect } from "@/test/media-env";
import { resetMuteForTests } from "./mute";
import { resetVideoStageForTests } from "./video-stage";
import { MediaViewer, type ViewerItem } from "./media-viewer";

afterEach(() => {
  resetMuteForTests();
  resetVideoStageForTests();
});

const PICTURES: ViewerItem[] = Array.from({ length: 10 }, (_, at) => ({
  src: `https://media.example/p${at}.webp`,
  mimeType: "image/webp",
  altText: `Picture ${at}`,
}));

const CLIP: ViewerItem = {
  src: "https://media.example/clip.mp4",
  mimeType: "video/mp4",
  altText: "A clip",
  durationMs: 41_000,
};

function open(props: Partial<React.ComponentProps<typeof MediaViewer>> = {}) {
  const onClose = vi.fn();
  render(<MediaViewer items={PICTURES.slice(0, 4)} onClose={onClose} {...props} />);
  return { onClose, stage: screen.getByTestId("media-viewer-stage") };
}

/** A drag, as a browser delivers one: down, a move, and up where it ended. */
function drag(on: HTMLElement, from: [number, number], to: [number, number]) {
  act(() => {
    fireEvent.pointerDown(on, { pointerId: 1, clientX: from[0], clientY: from[1] });
    fireEvent.pointerMove(on, { pointerId: 1, clientX: to[0], clientY: to[1] });
    fireEvent.pointerUp(on, { pointerId: 1, clientX: to[0], clientY: to[1] });
  });
}

/** A pinch: two fingers down, then spread or closed to a new separation. */
function pinch(on: HTMLElement, from: number, to: number) {
  act(() => {
    fireEvent.pointerDown(on, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerDown(on, { pointerId: 2, clientX: from, clientY: 0 });
    fireEvent.pointerMove(on, { pointerId: 2, clientX: to, clientY: 0 });
  });
}

function scaleOf(picture: HTMLElement): number {
  return Number(/scale\(([\d.]+)\)/.exec(picture.style.transform)?.[1] ?? "1");
}

describe("the surface", () => {
  it("is a modal dialog on black, covering the screen and nothing behind it", () => {
    open();
    const surface = screen.getByTestId("media-viewer");
    expect(surface).toHaveAttribute("role", "dialog");
    expect(surface).toHaveAttribute("aria-modal", "true");
    expect(surface.className).toContain("fixed");
    expect(surface.className).toContain("inset-0");
    expect(surface.style.background).toBe("rgb(0, 0, 0)");
  });

  it("fits the frame whole and never crops it — the surface every crop exists against", () => {
    open();
    expect(screen.getByTestId("media-viewer-picture").style.objectFit).toBe("contain");
  });

  it("grows no toolbar: no acts, no description under the frame", () => {
    open({ items: [{ ...PICTURES[0], altText: "A lake at dusk" }] });
    // The alt text is the picture's accessible name and is never printed.
    expect(screen.getByTestId("media-viewer")).not.toHaveTextContent("A lake at dusk");
    expect(screen.getByTestId("media-viewer-picture")).toHaveAttribute("alt", "A lake at dusk");
    expect(screen.queryByRole("button", { name: /share|opinion|comment/i })).toBeNull();
  });
});

describe("the ways out", () => {
  it("closes on the X", () => {
    const { onClose } = open();
    act(() => screen.getByTestId("media-viewer-close").click());
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on the backdrop, and never on the frame itself", () => {
    const { onClose, stage } = open();
    act(() => {
      stage.click();
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      screen.getByTestId("media-viewer").click();
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const { onClose } = open();
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on a swipe DOWN, and not on a swipe up", () => {
    const { onClose, stage } = open();
    drag(stage, [200, 300], [200, 200]);
    expect(onClose).not.toHaveBeenCalled();

    drag(stage, [200, 200], [200, 300]);
    expect(onClose).toHaveBeenCalled();
  });

  it("does not take a short drag for a gesture", () => {
    const { onClose, stage } = open();
    drag(stage, [200, 200], [205, 215]);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("the pager", () => {
  it("swipes through the set, and the dots say where it landed", () => {
    const { stage } = open();
    expect(screen.getByTestId("media-viewer-dots")).toHaveAttribute(
      "aria-label",
      "Picture 1 of 4",
    );

    drag(stage, [300, 200], [100, 200]);
    expect(screen.getByTestId("media-viewer-dots")).toHaveAttribute(
      "aria-label",
      "Picture 2 of 4",
    );

    drag(screen.getByTestId("media-viewer-stage"), [100, 200], [300, 200]);
    expect(screen.getByTestId("media-viewer-dots")).toHaveAttribute(
      "aria-label",
      "Picture 1 of 4",
    );
  });

  it("opens where the reader tapped, not at the top of the set", () => {
    open({ index: 2 });
    expect(screen.getByTestId("media-viewer-dots")).toHaveAttribute(
      "aria-label",
      "Picture 3 of 4",
    );
  });

  it("pages on the arrow keys too — the canvas draws no arrows to click", () => {
    open();
    act(() => {
      fireEvent.keyDown(window, { key: "ArrowRight" });
    });
    expect(screen.getByTestId("media-viewer-dots")).toHaveAttribute(
      "aria-label",
      "Picture 2 of 4",
    );
    // The set is a ring: left from the first lands on the last.
    act(() => {
      fireEvent.keyDown(window, { key: "ArrowLeft" });
      fireEvent.keyDown(window, { key: "ArrowLeft" });
    });
    expect(screen.getByTestId("media-viewer-dots")).toHaveAttribute(
      "aria-label",
      "Picture 4 of 4",
    );
  });

  it("windows the dot row at seven, in the viewer's tone", () => {
    open({ items: PICTURES, index: 0 });
    const dots = screen.getByTestId("media-viewer-dots");
    expect(dots).toHaveAttribute("aria-label", "Picture 1 of 10");
    expect(dots.style.filter).toContain("drop-shadow");
    // Seven slots for a ten-set, and the first is the active one.
    expect(screen.getAllByTestId(/media-viewer-dots-slot-\d+$/)).toHaveLength(7);
    expect(screen.getByTestId("media-viewer-dots-dot-0")).toHaveAttribute("data-active", "true");
  });

  it("marks no position for a lone picture", () => {
    open({ items: [PICTURES[0]] });
    expect(screen.queryByTestId("media-viewer-dots")).toBeNull();
  });

  it("never draws arrows — the gesture is the swipe (item 21's pager ruling)", () => {
    open();
    expect(screen.queryByRole("button", { name: /next|previous/i })).toBeNull();
    // The X is the viewer's one control.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});

describe("pinch to zoom", () => {
  it("magnifies the picture with the fingers", () => {
    const { stage } = open();
    pinch(stage, 100, 200);
    expect(scaleOf(screen.getByTestId("media-viewer-picture"))).toBe(2);
  });

  it("never shrinks below the whole frame — one is the viewer's promise", () => {
    const { stage } = open();
    pinch(stage, 200, 50);
    expect(scaleOf(screen.getByTestId("media-viewer-picture"))).toBe(1);
  });

  it("never magnifies past four, where a picture would become pixels", () => {
    const { stage } = open();
    pinch(stage, 20, 800);
    expect(scaleOf(screen.getByTestId("media-viewer-picture"))).toBe(4);
  });

  it("pans a magnified picture instead of paging it", () => {
    const { stage } = open();
    pinch(stage, 100, 300);
    act(() => {
      fireEvent.pointerUp(stage, { pointerId: 1, clientX: 0, clientY: 0 });
      fireEvent.pointerUp(stage, { pointerId: 2, clientX: 300, clientY: 0 });
    });

    drag(stage, [300, 200], [100, 200]);
    // Still on the first picture: the drag moved the picture, not the set.
    expect(screen.getByTestId("media-viewer-dots")).toHaveAttribute(
      "aria-label",
      "Picture 1 of 4",
    );
    expect(screen.getByTestId("media-viewer-picture").style.transform).toContain("translate");
  });

  it("starts each picture whole — the zoom belongs to the frame being looked at", () => {
    const { stage } = open();
    pinch(stage, 100, 300);
    act(() => {
      fireEvent.pointerUp(stage, { pointerId: 1, clientX: 0, clientY: 0 });
      fireEvent.pointerUp(stage, { pointerId: 2, clientX: 300, clientY: 0 });
    });
    act(() => {
      fireEvent.keyDown(window, { key: "ArrowRight" });
    });
    expect(scaleOf(screen.getByTestId("media-viewer-picture"))).toBe(1);
  });
});

describe("focus", () => {
  it("lands on the way out, and goes back where it came from", () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();

    const view = render(<MediaViewer items={PICTURES.slice(0, 2)} onClose={() => {}} />);
    expect(document.activeElement).toBe(screen.getByTestId("media-viewer-close"));

    view.unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("traps Tab inside the layer", () => {
    open();
    const close = screen.getByTestId("media-viewer-close");
    expect(document.activeElement).toBe(close);
    // One focusable control, so both directions wrap back onto it rather than
    // stepping out to the page behind.
    act(() => {
      fireEvent.keyDown(window, { key: "Tab" });
    });
    expect(document.activeElement).toBe(close);
    act(() => {
      fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    });
    expect(document.activeElement).toBe(close);
  });
});

describe("a clip in the viewer", () => {
  it("wears the full transport — the ladder's third rung", () => {
    render(<MediaViewer items={[CLIP]} onClose={() => {}} />);
    expect(screen.getByTestId("media-viewer-video-transport")).toBeTruthy();
    expect(screen.getByTestId("media-viewer-video-transport-timeline")).toBeTruthy();
    expect(screen.getByTestId("media-viewer-video-transport-duration").textContent).toBe("0:41");
  });

  it("draws no fullscreen toggle, because this IS the fullscreen", () => {
    render(<MediaViewer items={[CLIP]} onClose={() => {}} />);
    expect(screen.queryByTestId("media-viewer-video-transport-fullscreen")).toBeNull();
  });

  it("stops at its end rather than looping, like the detail's clip", () => {
    render(<MediaViewer items={[CLIP]} onClose={() => {}} />);
    expect(screen.getByTestId("media-viewer-video")).toHaveProperty("loop", false);
  });

  it("is never cut — the frame whole, ground at the sides", () => {
    render(<MediaViewer items={[CLIP]} onClose={() => {}} />);
    expect(screen.getByTestId("media-viewer-video").className).toContain("object-contain");
    expect(screen.getByTestId("media-viewer-video").className).not.toContain("object-cover");
  });

  it("takes the stage rather than playing a second copy of the clip", () => {
    render(<MediaViewer items={[CLIP]} onClose={() => {}} />);
    const viewer = screen.getByTestId("media-viewer-video") as HTMLVideoElement;
    act(() => intersect(true));
    // One clip plays at a time (FE-28): claiming is what pauses whatever the
    // viewer was opened over.
    expect(viewer.paused).toBe(false);
  });
});
