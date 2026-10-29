// The video path through the wizard, as a reader drives it.
//
// Its own file because of the mock below: jsdom decodes no video, so the probe
// and the frame capture — the two places this flow touches a real decoder —
// are stubbed. Everything else is the real wizard, the real reducer and the
// real gates, so what is proven here is the WIRING: that a picked video reaches
// the cover screen, that the offers appear with the first one taken, and that
// the composition rule is enforced where an author can see it.

import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { PORTRAIT_CAP } from "@/lib/ui2/media/aspect";
import { captureFrames, captureFrameZero, probeVideo } from "@/lib/ui2/media/video";
import { fakeIdentityStore } from "@/test/identity";
import { fakeWriteSigner } from "@/test/registration";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import type { ComposeDraftStore } from "@/lib/compose/draft-store";
import { emptyWizard, type WizardState } from "@/lib/compose/wizard";
import { ComposeWizard } from "./wizard-view";
import { byAnyTestId, byNode } from "@/test/data-node";

const FRAME = new Blob([new Uint8Array([9]) as BlobPart], { type: "image/png" });
// A frame distinct from `FRAME` above, so a test can tell "the tray's frames"
// and "the silent still's own extraction" apart by which blob actually rode
// the upload — proving the two are no longer the same read.
const FRAME_ZERO = new Blob([new Uint8Array([0]) as BlobPart], { type: "image/png" });

vi.mock("@/lib/ui2/media/video", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ui2/media/video")>();
  return {
    ...actual,
    // The real ones need a decoder; the container sniff and the cap check are
    // left real, because those are the rules this screen is meant to apply.
    // LANDSCAPE BY DEFAULT: the shape decides the route (`isVerticalClip`),
    // and a horizontal clip is the one that walks the cover step. The
    // vertical path mocks its own shape below.
    probeVideo: vi.fn(async () => ({ durationMs: 42_000, width: 1920, height: 1080 })),
    // FOUR, not three (CW-13): the 1s-clamped opening plus the three
    // fractional offers ("FOUR FRAMES, NOT THREE: 1s, 10%, 50%, 90%").
    captureFrames: vi.fn(async () => [FRAME, FRAME, FRAME, FRAME]),
    // The silent still's own, independent extraction (FRAME 1 MEANS FRAME 0,
    // STRICTLY, jakob 2026-09-24) — a different blob than the tray's above,
    // so nothing here can pass by coincidence.
    captureFrameZero: vi.fn(async () => FRAME_ZERO),
  };
});

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

startMswServer();

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

function fakeDrafts(initial: WizardState | null = null): ComposeDraftStore {
  let held = initial;
  return {
    save: async (state) => {
      held = state;
    },
    load: async () => held,
    clear: async () => {
      held = null;
    },
    abandonPendingSaves: () => undefined,
  };
}

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", {
    value: () => "blob:preview",
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", { value: () => {}, configurable: true });
});

/**
 * A `createObjectURL` that tells blobs apart, for the one test below that
 * needs to prove two different blobs produced two different URLs. The
 * shared mock above deliberately does not: every other test only cares that
 * SOME preview exists, and a constant string is the simplest thing that can
 * work for that.
 */
function distinctObjectUrls() {
  let next = 0;
  const known = new WeakMap<Blob, string>();
  Object.defineProperty(URL, "createObjectURL", {
    value: (blob: Blob) => {
      const existing = known.get(blob);
      if (existing !== undefined) return existing;
      const minted = `blob:${next}`;
      next += 1;
      known.set(blob, minted);
      return minted;
    },
    configurable: true,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A real MP4 header, so the container sniff passes for the right reason. */
function mp4Bytes(): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(32));
  const write = (text: string, at: number) => {
    for (let i = 0; i < 4; i += 1) bytes[at + i] = text.charCodeAt(i);
  };
  bytes[3] = 16;
  write("ftyp", 4);
  write("isom", 8);
  write("mp42", 12);
  return bytes;
}

async function pickFiles(files: readonly File[]) {
  const input = await screen.findByTestId("wizard-file-input");
  Object.defineProperty(input, "files", { value: files, configurable: true });
  fireEvent.change(input);
  // The screening reads bytes before anything joins the draft, so the pick
  // lands a microtask after the change event.
  await act(async () => {});
}

const aVideo = () => new File([mp4Bytes() as BlobPart], "clip.mp4", { type: "video/mp4" });
const aPicture = (name = "shot.jpg") =>
  new File([new Uint8Array([1, 2, 3]) as BlobPart], name, { type: "image/jpeg" });

function render() {
  return renderWithProviders(
    <ComposeWizard store={fakeIdentityStore({ keyOnDevice: true })} drafts={fakeDrafts()} />,
    { store: signedInStore(), writeSigner: fakeWriteSigner() },
  );
}

describe("picking a video", () => {
  it("goes to the cover screen instead of the crop", async () => {
    render();
    await pickFiles([aVideo()]);

    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));

    expect(await screen.findByText("The video's face")).toBeInTheDocument();
    // The crop screen belongs to pictures and must not appear on this path.
    expect(screen.queryByTestId("composeCrop.shapes.tallChip")).toBeNull();
  });

  // EXTRACTION OFFERS; IT NEVER CHOOSES (HT-COVER). The offers arriving is
  // not a decision: a cover is optional and its own standalone asset, so
  // until the author taps one nothing is the face.
  it("offers the frames it took, and none of them is the face yet", async () => {
    render();
    await pickFiles([aVideo()]);
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));

    const first = await screen.findByTestId("wizard-cover-frame-0");
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("wizard-cover-frame-2")).toHaveAttribute("aria-pressed", "false");
    // The board's own escape hatch, beside the offers.
    expect(screen.getByTestId("wizard-cover-picture")).toBeInTheDocument();
  });

  // THE JOURNEY THE OLD NET NEVER WALKED (HT-COVER): the coverless tests
  // drove the reducer, where no capture runs, so nothing asked what the
  // screen does once the frames have landed and the author simply presses
  // Next. Leaving the stage untouched leaves the clip faceless.
  it("leaves the clip faceless when the stage is walked without a tap", async () => {
    render();
    await pickFiles([aVideo()]);
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));

    // The offers are on screen — this is not the race that used to pass.
    expect(await screen.findByTestId("wizard-cover-frame-3")).toBeInTheDocument();
    expect(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next"))).not.toBeDisabled();
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));

    // Details: the clip is the body, faceless — and it carries NO door, since
    // it came through the cover step (ComposeDetailsVideo.md: "the stage
    // carries no cover section GIVEN the clip came through the cover step";
    // ComposeCover.md: "press Next GIVEN the author has picked no face -> the
    // details stage opens with the clip coverless").
    await screen.findByTestId(byNode("composeDetails.title.input"));
    expect(screen.queryByTestId("wizard-cover-door")).toBeNull();
    expect(screen.queryByTestId("wizard-cover-face")).toBeNull();
  });

  // CW-13 (CoverRow.jsx: "FOUR FRAMES, NOT THREE"): the 1s-clamped opening
  // plus the three fractional offers, wired all the way to the row.
  it("offers four frames, not three", async () => {
    render();
    await pickFiles([aVideo()]);
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));

    expect(await screen.findByTestId("wizard-cover-frame-3")).toBeInTheDocument();
  });

  // CW-14 (ComposeCover.jsx:28 stageLabel="Video only"): the header's
  // trailing note names the cover stage the way android's already does.
  it("labels the cover stage 'Video only' in the header's trailing note", async () => {
    render();
    await pickFiles([aVideo()]);
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));

    // WizardHeader's own `stageLabel` slot: the role's size and leading, the
    // ground's weight — the seal's "Last step" pair.
    const stage = await screen.findByTestId("header-stage");
    expect(stage).toHaveTextContent("Video only");
    expect(stage.className).not.toContain("text-label-small ");
  });

  // ComposeCoverPlaying: the running preview wears the post detail's
  // transport, without a fullscreen toggle, and the cover never comes back.
  it("runs the preview under the house transport, with no fullscreen", async () => {
    render();
    await pickFiles([aVideo()]);
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));

    const video = (await screen.findByTestId("wizard-cover-preview")) as HTMLVideoElement;
    expect(video).not.toHaveAttribute("controls");
    fireEvent.play(video);

    expect(screen.getByTestId("wizard-cover-transport")).toBeInTheDocument();
    expect(screen.getByLabelText("Back ten seconds")).toBeInTheDocument();
    expect(screen.getByLabelText("Forward ten seconds")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Turn sound (on|off)$/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Full screen")).toBeNull();
    // The cover's resting anatomy has given way for good.
    expect(screen.queryByTestId("wizard-cover-play")).toBeNull();
    expect(screen.queryByTestId("wizard-cover-duration")).toBeNull();
    fireEvent.pause(video);
    expect(screen.queryByTestId("wizard-cover-play")).toBeNull();
  });

  // ComposeCoverNoFrames: no frames cut, the preview is the neutral tile —
  // "No frame", the duration, and no play disc.
  it("draws the neutral tile when the clip gave no frames", async () => {
    vi.mocked(captureFrames).mockRejectedValueOnce(new Error("no decode"));
    render();
    await pickFiles([aVideo()]);
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));

    expect(await screen.findByTestId("wizard-cover-no-frame")).toHaveTextContent("No frame");
    expect(screen.getByTestId("wizard-cover-duration")).toBeInTheDocument();
    expect(screen.queryByTestId("wizard-cover-play")).toBeNull();
    expect(screen.getByTestId("wizard-cover-caption")).toHaveTextContent(
      "This clip gave no frames — choose a picture of your own, or leave it without one.",
    );
  });

  // F3-4, ruled final 2026-09-11: the preview shows the ACTUAL OUTPUT FORMAT.
  // It used to run at `w-full` under a `max-h-96` with no ratio at all, so a
  // replaced element sized itself from its own shape, the cap took the
  // difference out of the height alone, and `object-cover` cropped what was
  // left — every clip previewed as a square whatever went in.
  describe("the clip preview's shape", () => {
    /** The frame the preview reserves, once the probe has landed. */
    async function previewRatio() {
      const frame = await screen.findByTestId("wizard-cover-preview-frame");
      return frame.style.aspectRatio;
    }

    it("shows a vertical clip at 4:5, not as a square, behind the details door", async () => {
      // A vertical clip never meets the step on its own; the door opens it.
      vi.mocked(probeVideo).mockResolvedValueOnce({ durationMs: 8_000, width: 1080, height: 1920 });
      render();
      await pickFiles([aVideo()]);
      fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));
      fireEvent.click(await screen.findByTestId("wizard-cover-door"));

      // Taller than the cap, so it shows AT the cap — which is what the post
      // will be, and what the feed tile reserves for it.
      expect(await previewRatio()).toBe(`${PORTRAIT_CAP} / 1`);
    });

    it("shows a landscape clip landscape", async () => {
      vi.mocked(probeVideo).mockResolvedValueOnce({
        durationMs: 8_000,
        width: 1920,
        height: 1080,
      });
      render();
      await pickFiles([aVideo()]);
      fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));

      expect(await previewRatio()).toBe(`${1920 / 1080} / 1`);
    });

    it("shows a square clip square", async () => {
      vi.mocked(probeVideo).mockResolvedValueOnce({
        durationMs: 8_000,
        width: 720,
        height: 720,
      });
      render();
      await pickFiles([aVideo()]);
      fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));

      expect(await previewRatio()).toBe("1 / 1");
    });

    it("falls back to the neutral square when the decoder reported no size", async () => {
      vi.mocked(probeVideo).mockResolvedValueOnce({ durationMs: 8_000, width: 0, height: 0 });
      render();
      await pickFiles([aVideo()]);
      fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));

      // Shape unknown is the one case a square is the honest answer, rather
      // than a collapsed box or a shape nobody stated.
      expect(await previewRatio()).toBe("1 / 1");
    });
  });

  it("shows the clip's length where the board draws it", async () => {
    render();
    await pickFiles([aVideo()]);
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));

    expect(await screen.findByTestId("wizard-cover-duration")).toHaveTextContent("0:42");
  });

  it("moves the face to another offer when one is pressed", async () => {
    render();
    await pickFiles([aVideo()]);
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));

    fireEvent.click(await screen.findByTestId("wizard-cover-frame-2"));

    expect(screen.getByTestId("wizard-cover-frame-2")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("wizard-cover-frame-0")).toHaveAttribute("aria-pressed", "false");
  });

  it("refuses a video beside pictures, and says why", async () => {
    render();
    await pickFiles([aPicture()]);
    await pickFiles([aVideo()]);

    const list = await screen.findByTestId("wizard-refusals");
    expect(list).toHaveTextContent("A post carries pictures or one video, not both.");
    // And nothing was taken away from the author in the process: the tray is
    // still there with the picture in it.
    expect(screen.getByTestId("wizard-show-all")).toBeInTheDocument();
    // CW-09: the refused tile exists (`RefusedFile`'s failed thumb), but a
    // video gets no preview image — a browser has no cheap way to pull a
    // poster frame from a refused clip's bytes.
    expect(list.querySelector('[data-testid$="-thumb"]')).not.toBeNull();
    expect(list.querySelector('[data-testid$="-thumb-image"]')).toBeNull();
  });

  // CW-09 (ComposePickedErrors): a refused picture's own bytes preview its
  // tile, the same as an accepted one's — the board draws a real thumbnail,
  // not a bare error line.
  it("shows a real thumbnail for a refused picture", async () => {
    render();
    await pickFiles([aVideo()]);
    await pickFiles([aPicture()]);

    const list = await screen.findByTestId("wizard-refusals");
    expect(list).toHaveTextContent("A post carries pictures or one video, not both.");
    const image = list.querySelector('[data-testid$="-thumb-image"]');
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute("src", "blob:preview");
  });

  it("refuses a container the server would refuse, before it is uploaded", async () => {
    render();
    const notMp4 = new File([new Uint8Array(32) as BlobPart], "clip.mkv", {
      type: "video/x-matroska",
    });
    await pickFiles([notMp4]);

    expect(await screen.findByTestId("wizard-refusals")).toHaveTextContent(
      "That file isn't a picture or a video CoGra can read.",
    );
  });

  it("keeps the refusals until they are dismissed one by one", async () => {
    // The ComposePickedErrors shape: the lines persist beside the accepted
    // batch, each with its own way out, rather than fading like a banner.
    render();
    await pickFiles([
      new File([new Uint8Array(4) as BlobPart], "notes.txt", { type: "text/plain" }),
      new File([new Uint8Array(4) as BlobPart], "readme.md", { type: "text/markdown" }),
    ]);

    const list = await screen.findByTestId("wizard-refusals");
    expect(list.querySelectorAll("li")).toHaveLength(2);
    // Neither file is a picture CoGra can preview, so both tiles are empty —
    // the honest picture of a file nothing can read, not a broken image.
    expect(list.querySelector('[data-testid$="-thumb-image"]')).toBeNull();

    // A second pick does not wipe the first refusal away.
    await pickFiles([aPicture()]);
    expect(screen.getByTestId("wizard-refusals").querySelectorAll("li")).toHaveLength(2);

    fireEvent.click(screen.getAllByText("Remove it")[0]!);
    expect(screen.getByTestId("wizard-refusals").querySelectorAll("li")).toHaveLength(1);
  });

  // ComposePickedErrors.md: what was refused is listed UNDER THE TRAY, before
  // the step's own region, not below it.
  it("lists the refusals between the tray and the drop region", async () => {
    render();
    await pickFiles([aPicture()]);
    await pickFiles([aVideo()]);

    const list = await screen.findByTestId("wizard-refusals");
    const drop = screen.getByTestId("wizard-drop");
    expect(list.compareDocumentPosition(drop) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(drop.contains(list)).toBe(false);
  });

  // ComposePick.md: an eleventh picture is refused in words and NEVER dropped
  // in silence — and the picker stays open to say so.
  it("refuses the eleventh picture under the tray, and keeps the picker open", async () => {
    render();
    await pickFiles(Array.from({ length: 11 }, (_, i) => aPicture(`p${i}.jpg`)));

    expect(await screen.findByTestId("wizard-refusals")).toHaveTextContent(
      "That's more than a post carries — up to ten pictures.",
    );
    expect(screen.getByTestId("wizard-picked-count")).toHaveTextContent("Picked · 10");
    expect(screen.getByTestId("wizard-open-picker")).toBeEnabled();
    expect(screen.getByTestId("wizard-open-picker")).toHaveTextContent("Choose from your files");
  });

  // ComposePickVideo.jsx: the clip's tile is a 114 × 64 frame, not the
  // picture's 48px square.
  it("draws the staged clip as the 114 × 64 frame tile", async () => {
    render();
    await pickFiles([aVideo()]);
    const tile = (await screen.findByLabelText("Remove this video")).parentElement as HTMLElement;
    expect(tile.style.width).toBe("114px");
    expect(tile.style.height).toBe("64px");
  });

  it("offers no way to add once a video is the body", async () => {
    render();
    await pickFiles([aVideo()]);

    // A video takes the body whole, so an add control could only be refused.
    expect(await screen.findByTestId("wizard-video-body")).toBeInTheDocument();
    expect(screen.queryByTestId("wizard-open-picker")).toBeNull();
  });

  // ComposePickWeb.md (round 22): "ALWAYS the region stands dimmed, with no
  // Choose from your files and no drop line, GIVEN a clip is staged"; a clip
  // dropped there anyway reads "A post carries one video.".
  it("dims the drop region inert while a clip is staged and refuses a second clip in words", async () => {
    render();
    await pickFiles([aVideo()]);
    const region = await screen.findByTestId("wizard-video-body");
    expect(region.className).toContain("opacity-45");
    expect(region).toHaveAttribute("inert");
    expect(region).not.toHaveTextContent("…or drop them here.");
    expect(region).not.toHaveTextContent("A video is the whole post.");
    await pickFiles([aVideo()]);
    expect(await screen.findByTestId("wizard-refusals")).toHaveTextContent("A post carries one video.");
  });

  // CW-06 (ComposePickVideo's PickTray): one clip is not a set to reorder, so
  // the tray drops Show all and swaps the picture caption for the one this
  // state needs — it says why nothing else can join AND what happens next.
  it("swaps the tray for the clip's own caption, and drops Show all", async () => {
    render();
    await pickFiles([aVideo()]);

    expect(await screen.findByTestId("wizard-picked-count")).toHaveTextContent("Picked · 1");
    expect(
      screen.getByText("A video is the whole post. Its cover comes next."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("wizard-show-all")).toBeNull();
    // The tray's picture caption, not the closed Show-all sheet's footnote,
    // which since the K13 round reads the same words.
    expect(
      screen.queryByText("The first one is the cover.", { selector: "span" }),
    ).toBeNull();
  });

  // CW-08 (ComposePickVideo.jsx:57): the tray's own remove control names what
  // it removes — a video, not "picture 1".
  it("calls the tray's remove control 'Remove this video'", async () => {
    render();
    await pickFiles([aVideo()]);

    expect(await screen.findByLabelText("Remove this video")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Remove picture/)).toBeNull();
  });

  // W4: the pick tray used to hand `<img>` the video's own object URL —
  // undecodable, so it drew the browser's broken-image icon. Extraction now
  // starts as soon as the clip is picked, not only once the cover screen is
  // reached, so the tray always has a still to stand the clip on.
  it("shows the clip's own first frame on the pick tray, not the video's bytes", async () => {
    distinctObjectUrls();
    const clip = aVideo();
    render();
    await pickFiles([clip]);

    const thumb = await screen.findByTestId(/^wizard-unpick-.*-image$/);
    const videoUrl = URL.createObjectURL(clip);
    expect(thumb).toHaveAttribute("src");
    expect(thumb.getAttribute("src")).not.toBe(videoUrl);
    // THE PREVIEW FACE IS THE STORED FACE (jakob 2026-09-24, backlog item
    // 106): the tray's tile stands the clip on `captureFrameZero`'s own
    // frame 0, never the tray's ~1s "opening" offer — FRAME and FRAME_ZERO
    // are deliberately different blobs above, so this pins the right bytes
    // for the right reason.
    expect(thumb.getAttribute("src")).toBe(URL.createObjectURL(FRAME_ZERO));
    expect(thumb.getAttribute("src")).not.toBe(URL.createObjectURL(FRAME));
  });

  // W5: the details tile used to show the CHOSEN COVER as its face, so with
  // the inset mark the cover appeared twice. The face is always the clip's
  // own first frame; the chosen cover — a different frame here — rides only
  // the inset mark (jakob's hand-test ruling 2026-09-23). THE PREVIEW FACE
  // IS THE STORED FACE (jakob 2026-09-24, backlog item 106) sharpens "first
  // frame" to `captureFrameZero`'s own frame 0, never the tray's ~1s offer —
  // proven here by choosing a tray frame OTHER than frame 0 as cover: the
  // tile stays on FRAME_ZERO, not on `frames[0]`.
  it("keeps the details tile on frame 0 even when a different frame is chosen as cover", async () => {
    distinctObjectUrls();
    const frames = [0, 1, 2, 3].map(
      (n) => new Blob([new Uint8Array([n]) as BlobPart], { type: "image/png" }),
    );
    vi.mocked(captureFrames).mockResolvedValueOnce(frames);
    render();
    await pickFiles([aVideo()]);
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));
    // A frame OTHER than the first, so the face and the cover can never be
    // the same URL by coincidence.
    fireEvent.click(await screen.findByTestId("wizard-cover-frame-2"));
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));

    const tileImage = await screen.findByTestId("wizard-picked-row-thumb-0-image");
    const coverMarkImage = screen
      .getByTestId("wizard-picked-row-thumb-0-cover-mark")
      .querySelector("img");

    expect(tileImage).toHaveAttribute("src", URL.createObjectURL(FRAME_ZERO));
    expect(coverMarkImage).toHaveAttribute("src", URL.createObjectURL(frames[2]!));
  });

  // Same defect as W4, on the sheet the describe counter opens: it read the
  // video's own object URL too.
  it("shows the clip's own first frame in the describe sheet, not the video's bytes", async () => {
    distinctObjectUrls();
    const clip = aVideo();
    const frames = [0, 1, 2, 3].map(
      (n) => new Blob([new Uint8Array([n]) as BlobPart], { type: "image/png" }),
    );
    vi.mocked(captureFrames).mockResolvedValueOnce(frames);
    render();
    await pickFiles([clip]);
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));
    // A tray frame OTHER than frame 0, so the sheet's face and the tray's
    // opening offer can never be the same URL by coincidence (item 106).
    fireEvent.click(await screen.findByTestId("wizard-cover-frame-2"));
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));

    fireEvent.click(await screen.findByTestId(byNode("composeDetails.describeRow.describe")));

    const strip = await screen.findByTestId("wizard-describe-sheet-strip");
    const image = strip.querySelector("img");
    const videoUrl = URL.createObjectURL(clip);
    expect(image).not.toBeNull();
    expect(image!.getAttribute("src")).not.toBe(videoUrl);
    // THE PREVIEW FACE IS THE STORED FACE (jakob 2026-09-24, backlog item
    // 106): the describe sheet stands the clip on `captureFrameZero`'s own
    // frame 0, never the tray's own `frames[0]` opening offer nor the
    // chosen cover (`frames[2]` here).
    expect(image!.getAttribute("src")).toBe(URL.createObjectURL(FRAME_ZERO));
    expect(image!.getAttribute("src")).not.toBe(URL.createObjectURL(frames[2]!));
  });

  it("asks for one description of the video, and none of its cover", async () => {
    render();
    await pickFiles([aVideo()]);
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));
    fireEvent.click(await screen.findByTestId("wizard-cover-frame-0"));
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));

    const counter = await screen.findByTestId(byNode("composeDetails.describeRow.describe"));
    expect(counter).toHaveTextContent("Describe the video");
    // One, not two: the cover is the video's face, never a second attachment.
    expect(counter.parentElement).toHaveTextContent("0 of 1 described");
  });

  // W1: the details thumbnail used to render the VIDEO's own object URL in an
  // `<img>` — which cannot decode a video, so it drew a broken-image icon
  // badged "Cover". The cover's own frame is what belongs there.
  it("shows the cover's own face on the details thumbnail, never the video's bytes", async () => {
    distinctObjectUrls();
    const clip = aVideo();
    render();
    await pickFiles([clip]);
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));
    fireEvent.click(await screen.findByTestId("wizard-cover-frame-0"));
    fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));

    const thumb = await screen.findByTestId("wizard-picked-row-thumb-0-image");
    // The same clip, run through the same (now-idempotent) mock, resolves to
    // the URL the video's own preview holds — which is exactly what the
    // thumbnail must NOT be showing.
    const videoUrl = URL.createObjectURL(clip);
    expect(thumb).toHaveAttribute("src");
    expect(thumb.getAttribute("src")).not.toBe(videoUrl);
  });

  // W3: this suite's own mock had `captureFrames` succeed every time, so the
  // screen a real decode failure lands on was never exercised — exactly the
  // path that used to leave an author stuck with no offers and no way past
  // the cover screen. The escape hatch is what has to survive this, not a
  // particular frame.
  it("still lets the author choose a picture of their own when frame capture fails entirely", async () => {
    vi.mocked(captureFrames).mockRejectedValueOnce(new Error("this browser couldn't read that video"));
    render();
    await pickFiles([aVideo()]);
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));

    // No offers to select from once the capture failed, and no stall either —
    // the escape hatch is what the screen falls back to.
    await screen.findByTestId("wizard-cover-picture");
    expect(screen.queryByTestId("wizard-cover-frame-0")).toBeNull();
    expect(screen.queryByTestId("wizard-cover-capturing")).toBeNull();
    // NEW-2 (ComposeCoverNoFrames.jsx:44): the terminal caption says why the
    // choice is smaller than it was, once extraction is done and came back
    // with nothing.
    expect(
      screen.getByText(
        "This clip gave no frames — choose a picture of your own, or leave it without one.",
      ),
    ).toBeInTheDocument();
    // Next stays open even with no face chosen — a faceless video is no
    // longer a wall (jakob, 2026-09-10, "going without a cover is always
    // possible"), so a capture failure that leaves no offers still has to
    // let the author move on rather than trap them on this screen.
    expect(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next"))).not.toBeDisabled();
  });

  // ONE TILE, NEVER TWO, AND NO MANAGER (jakob's ruling mirrored from
  // Android PR #813; `ComposeDetailsVideo.jsx:15-34,22-32`,
  // `ComposePickVideoCover.jsx:12-19`, design/readme.md §13 "The cover's
  // tile"). The clip's own tile on the details stage opens no Show-all
  // sheet — its affordances are its × and the Describe entry below it.
  describe("the details stage's video tile", () => {
    async function reachDetailsWithCover() {
      render();
      await pickFiles([aVideo()]);
      fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));
      fireEvent.click(await screen.findByTestId("wizard-cover-frame-0"));
      fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));
      await screen.findByTestId(byNode("composeDetails.title.input"));
    }

    it("draws one tile, the cover riding it as the inset mark", async () => {
      await reachDetailsWithCover();

      expect(screen.getAllByTestId(/^wizard-picked-row-thumb-\d+-image$/)).toHaveLength(1);
      expect(screen.getByTestId("wizard-picked-row-thumb-0-cover-mark")).toBeInTheDocument();
      // No separate Cover field once a face is chosen.
      expect(screen.queryByTestId("wizard-cover-door")).not.toBeInTheDocument();
    });

    it("opens no manager when the tile is clicked", async () => {
      await reachDetailsWithCover();

      const row = screen.getByTestId(byNode("composeDetails.mediaRow"));
      expect(row.tagName).not.toBe("BUTTON");
      fireEvent.click(row);

      const sheet = screen.getByTestId("wizard-picked-sheet");
      expect(sheet).not.toHaveAttribute("open");
    });

    // THE × GIVES THE PICK STEP BACK (jakob's ruling, 2026-09-23; design
    // commit 27aaa1cb, `ComposeDetails.jsx`): removing the clip never
    // leaves Details standing on nothing. A landed upload (rather than the
    // real capture/upload pipeline this suite otherwise drives) keeps the
    // tile's × live rather than traded for the failed badge — the removal
    // itself, not the network, is what this test is pinning.
    it("returns the pick step, tray empty, when the × removes the clip", async () => {
      const clip = aVideo();
      const drafts = fakeDrafts({
        ...emptyWizard(),
        step: "details",
        mode: "media",
        assets: [
          {
            id: "v0",
            file: clip,
            crop: { x: 0, y: 0, zoom: 1, area: null, areaPercent: null },
            altText: "",
            upload: { kind: "done", mediaId: "m-video" },
            kind: "video",
          },
        ],
      });
      renderWithProviders(
        <ComposeWizard store={fakeIdentityStore({ keyOnDevice: true })} drafts={drafts} />,
        { store: signedInStore(), writeSigner: fakeWriteSigner() },
      );

      fireEvent.click(await screen.findByTestId("wizard-draft-continue"));
      await screen.findByTestId(byNode("composeDetails.title.input"));

      fireEvent.click(screen.getByLabelText("Remove this video"));

      expect(await screen.findByTestId("wizard-drop")).toBeInTheDocument();
      expect(screen.queryByTestId("wizard-picked-count")).toBeNull();
      expect(screen.queryByTestId(byNode("composeDetails.title.input"))).toBeNull();
    });
  });

  // The feed-video rulings, 2026-09-23, sharpened 2026-09-24 ("FRAME 1 MEANS
  // FRAME 0, STRICTLY" — design/readme.md §13, the MediaAttachment docblock):
  // a clip that reaches upload with no chosen cover gets its own frame 0
  // uploaded silently, through the same leg a chosen cover would ride.
  // Asserted here through the DRAFT the wizard keeps — it carries the whole
  // `WizardState`, including the field no screen ever draws — rather than
  // through the network, so this needs no image-encoder shim: what is under
  // test is whether the still gets MATERIALIZED at all, not whether a
  // browser can re-encode it.
  describe("the silent auto-cover", () => {
    async function settle() {
      // The 200ms coalescing window `draft-store.ts` documents, plus the
      // microtask the capture and the materializing dispatch each cost.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
      });
    }

    it("materializes the clip's own frame 0 once details is reached with nothing chosen", async () => {
      const drafts = fakeDrafts();
      renderWithProviders(
        <ComposeWizard store={fakeIdentityStore({ keyOnDevice: true })} drafts={drafts} />,
        { store: signedInStore(), writeSigner: fakeWriteSigner() },
      );
      await pickFiles([aVideo()]);
      fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));
      // Straight through the cover screen — no tap on any offer.
      fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));
      await screen.findByTestId(byNode("composeDetails.title.input"));
      await settle();

      const saved = await drafts.load();
      // The door's own state is untouched: nothing was CHOSEN.
      expect(saved?.cover).toBeNull();
      // But the still exists, silently, so a reading surface is never
      // handed a video with no face at all.
      expect(saved?.autoCover).not.toBeNull();
      expect(saved?.autoCover?.frame).toBe(0);
      // AND IT IS THE RIGHT BYTES: `captureFrameZero`'s own read of the
      // clip, never the tray's ~1s offer — `frames[0]` and `FRAME_ZERO` are
      // deliberately different blobs above, so this could only pass for the
      // right reason.
      expect(saved?.autoCover?.file).toBe(FRAME_ZERO);
    });

    it("ships the clip with no still at all when its own frame-0 extraction finds nothing", async () => {
      // The tray's own capture still succeeds — its offers are a separate
      // concern the silent still's extraction failing must not touch.
      vi.mocked(captureFrameZero).mockRejectedValueOnce(new Error("no decoder"));
      const drafts = fakeDrafts();
      renderWithProviders(
        <ComposeWizard store={fakeIdentityStore({ keyOnDevice: true })} drafts={drafts} />,
        { store: signedInStore(), writeSigner: fakeWriteSigner() },
      );
      await pickFiles([aVideo()]);
      fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));
      fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));
      await screen.findByTestId(byNode("composeDetails.title.input"));
      await settle();

      const saved = await drafts.load();
      expect(saved?.cover).toBeNull();
      // No frame ever arrived, so there was nothing to upload — the neutral
      // tile (`Cover · no frames came back`) stands for the reader, silently.
      expect(saved?.autoCover).toBeNull();
    });

    it("lets a chosen cover win: the silent path never even starts", async () => {
      const drafts = fakeDrafts();
      renderWithProviders(
        <ComposeWizard store={fakeIdentityStore({ keyOnDevice: true })} drafts={drafts} />,
        { store: signedInStore(), writeSigner: fakeWriteSigner() },
      );
      await pickFiles([aVideo()]);
      fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));
      fireEvent.click(await screen.findByTestId("wizard-cover-frame-2"));
      fireEvent.click(screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));
      await screen.findByTestId(byNode("composeDetails.title.input"));
      await settle();

      const saved = await drafts.load();
      expect(saved?.cover?.frame).toBe(2);
      // The decision only ever runs while both are still null — a chosen
      // cover already standing means it never fires at all.
      expect(saved?.autoCover).toBeNull();
    });
  });
});

// THE SHAPE-KEYED VIDEO STEPS (H1; design/readme.md, the video-cover round:
// "No-cover is first-class, and the default is shape-keyed"). Each case is a
// sidecar line: ComposePickVideo.md, ComposeDetailsVideo.md, ComposeCover.md.
describe("a vertical clip", () => {
  const VERTICAL = { durationMs: 8_000, width: 1080, height: 1920 };
  const next = () => screen.getByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next"));

  async function pickVertical(probe = VERTICAL) {
    vi.mocked(probeVideo).mockResolvedValueOnce(probe);
    await pickFiles([aVideo()]);
  }

  async function reachDetails() {
    render();
    await pickVertical();
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));
    await screen.findByTestId(byNode("composeDetails.title.input"));
  }

  it("drops the cover promise from the tray's line", async () => {
    // ComposePickVideo.md: the tray's line reads A video is the whole post.
    // GIVEN the clip is vertical.
    render();
    await pickVertical();
    expect(await screen.findByTestId("wizard-tray-caption")).toHaveTextContent(/^A video is the whole post.$/);
    expect(screen.queryByText(/Its cover comes next./)).toBeNull();
  });

  it("keeps the cover promise on a horizontal clip's tray", async () => {
    render();
    await pickFiles([aVideo()]);
    expect(await screen.findByTestId("wizard-tray-caption")).toHaveTextContent(
      "A video is the whole post. Its cover comes next.",
    );
  });

  it("opens details with the Add a cover door on Next, and never the cover step", async () => {
    await reachDetails();
    expect(screen.queryByText("The video's face")).toBeNull();
    expect(screen.getByTestId("wizard-cover-door")).toHaveTextContent("Add a cover");
  });

  it("skips the step whatever the clip's length", async () => {
    // ComposePickVideo.md: NEVER the clip's length decides whether the cover
    // step comes next — a long vertical clip skips it as a short one does.
    render();
    await pickVertical({ durationMs: 600_000, width: 720, height: 1280 });
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));
    expect(await screen.findByTestId("wizard-cover-door")).toBeInTheDocument();
  });

  it("opens the cover step from the door, and its Next comes back to details", async () => {
    await reachDetails();
    fireEvent.click(screen.getByTestId("wizard-cover-door"));
    expect(await screen.findByText("The video's face")).toBeInTheDocument();

    fireEvent.click(next());
    await screen.findByTestId(byNode("composeDetails.title.input"));
    // Still faceless, so the door still stands: nothing was chosen.
    expect(screen.getByTestId("wizard-cover-door")).toBeInTheDocument();
  });

  it("drops the door once a face is chosen through it", async () => {
    // ComposeCover.md: press Next GIVEN a cover is chosen -> the details stage
    // opens AND NEVER an Add a cover door stands there.
    await reachDetails();
    fireEvent.click(screen.getByTestId("wizard-cover-door"));
    fireEvent.click(await screen.findByTestId("wizard-cover-frame-1"));
    fireEvent.click(next());
    await screen.findByTestId(byNode("composeDetails.title.input"));
    expect(screen.queryByTestId("wizard-cover-door")).toBeNull();
    expect(screen.getByTestId("wizard-picked-row-thumb-0-cover-mark")).toBeInTheDocument();
  });

  it("goes back from the door's cover step to details", async () => {
    // ComposeCover.md: back GIVEN the step was opened by the details stage's
    // Add a cover -> the details stage comes back.
    await reachDetails();
    fireEvent.click(screen.getByTestId("wizard-cover-door"));
    await screen.findByText("The video's face");
    fireEvent.click(screen.getByTestId("header-back"));
    expect(await screen.findByTestId(byNode("composeDetails.title.input"))).toBeInTheDocument();
  });

  it("goes back from details to the pick with the clip staged", async () => {
    // ComposeDetailsVideo.md: back GIVEN the clip skipped the cover step ->
    // the pick step comes back with the clip staged.
    await reachDetails();
    fireEvent.click(screen.getByTestId(byNode("composeDetails.header.back")));
    expect(await screen.findByTestId("wizard-tray-caption")).toHaveTextContent(/^A video is the whole post.$/);
    expect(screen.getByLabelText("Remove this video")).toBeInTheDocument();
  });

  it("goes back from a horizontal clip's details to its cover step", async () => {
    // ComposeDetailsVideo.md: back GIVEN the clip came through the cover step
    // -> the cover step comes back with its choice.
    render();
    await pickFiles([aVideo()]);
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));
    fireEvent.click(await screen.findByTestId("wizard-cover-frame-2"));
    fireEvent.click(next());
    await screen.findByTestId(byNode("composeDetails.title.input"));
    fireEvent.click(screen.getByTestId(byNode("composeDetails.header.back")));
    expect(await screen.findByTestId("wizard-cover-frame-2")).toHaveAttribute("aria-pressed", "true");
  });

  it("takes its frame 0 as its still with no step", async () => {
    // ComposeDetailsVideo.md: WHEN the clip skips the cover step -> the device
    // extracts the clip's frame 0 without a step AND uploads it as the
    // clip's still.
    const drafts = fakeDrafts();
    renderWithProviders(
      <ComposeWizard store={fakeIdentityStore({ keyOnDevice: true })} drafts={drafts} />,
      { store: signedInStore(), writeSigner: fakeWriteSigner() },
    );
    await pickVertical();
    fireEvent.click(await screen.findByTestId(byAnyTestId("wizard-next", "composeDetails.next", "composeCrop.next")));
    await screen.findByTestId(byNode("composeDetails.title.input"));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    const saved = await drafts.load();
    expect(saved?.cover).toBeNull();
    expect(saved?.autoCover?.file).toBe(FRAME_ZERO);
    // The shape rides the draft, so a restored draft routes the same way.
    expect(saved?.assets[0]?.clipRatio).toBe(1080 / 1920);
  });
});
