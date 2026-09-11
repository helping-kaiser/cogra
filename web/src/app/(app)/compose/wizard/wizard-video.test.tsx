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
import { captureFrames, probeVideo } from "@/lib/ui2/media/video";
import { fakeIdentityStore } from "@/test/identity";
import { fakeWriteSigner } from "@/test/registration";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import type { ComposeDraftStore } from "@/lib/compose/draft-store";
import type { WizardState } from "@/lib/compose/wizard";
import { ComposeWizard } from "./wizard-view";

const FRAME = new Blob([new Uint8Array([9]) as BlobPart], { type: "image/png" });

vi.mock("@/lib/ui2/media/video", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ui2/media/video")>();
  return {
    ...actual,
    // The real ones need a decoder; the container sniff and the cap check are
    // left real, because those are the rules this screen is meant to apply.
    probeVideo: vi.fn(async () => ({ durationMs: 42_000, width: 1080, height: 1920 })),
    captureFrames: vi.fn(async () => [FRAME, FRAME, FRAME]),
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
const aPicture = () =>
  new File([new Uint8Array([1, 2, 3]) as BlobPart], "shot.jpg", { type: "image/jpeg" });

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

    fireEvent.click(await screen.findByTestId("wizard-next"));

    expect(await screen.findByText("The video's face")).toBeInTheDocument();
    // The crop screen belongs to pictures and must not appear on this path.
    expect(screen.queryByTestId("wizard-shape-tall")).toBeNull();
  });

  it("offers the frames it took, with the first one already the face", async () => {
    render();
    await pickFiles([aVideo()]);
    fireEvent.click(await screen.findByTestId("wizard-next"));

    const first = await screen.findByTestId("wizard-cover-frame-0");
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("wizard-cover-frame-2")).toHaveAttribute("aria-pressed", "false");
    // The board's own escape hatch, beside the offers.
    expect(screen.getByTestId("wizard-cover-picture")).toBeInTheDocument();
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

    it("shows a vertical clip at 4:5, not as a square", async () => {
      // The harness's own clip is 1080x1920.
      render();
      await pickFiles([aVideo()]);
      fireEvent.click(await screen.findByTestId("wizard-next"));

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
      fireEvent.click(await screen.findByTestId("wizard-next"));

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
      fireEvent.click(await screen.findByTestId("wizard-next"));

      expect(await previewRatio()).toBe("1 / 1");
    });

    it("falls back to the neutral square when the decoder reported no size", async () => {
      vi.mocked(probeVideo).mockResolvedValueOnce({ durationMs: 8_000, width: 0, height: 0 });
      render();
      await pickFiles([aVideo()]);
      fireEvent.click(await screen.findByTestId("wizard-next"));

      // Shape unknown is the one case a square is the honest answer, rather
      // than a collapsed box or a shape nobody stated.
      expect(await previewRatio()).toBe("1 / 1");
    });
  });

  it("shows the clip's length where the board draws it", async () => {
    render();
    await pickFiles([aVideo()]);
    fireEvent.click(await screen.findByTestId("wizard-next"));

    expect(await screen.findByTestId("wizard-cover-duration")).toHaveTextContent("0:42");
  });

  it("moves the face to another offer when one is pressed", async () => {
    render();
    await pickFiles([aVideo()]);
    fireEvent.click(await screen.findByTestId("wizard-next"));

    fireEvent.click(await screen.findByTestId("wizard-cover-frame-2"));

    expect(screen.getByTestId("wizard-cover-frame-2")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("wizard-cover-frame-0")).toHaveAttribute("aria-pressed", "false");
  });

  it("refuses a video beside pictures, and says why", async () => {
    render();
    await pickFiles([aPicture()]);
    await pickFiles([aVideo()]);

    expect(await screen.findByTestId("wizard-refusals")).toHaveTextContent(
      "A post carries pictures or one video, not both.",
    );
    // And nothing was taken away from the author in the process: the tray is
    // still there with the picture in it.
    expect(screen.getByTestId("wizard-show-all")).toBeInTheDocument();
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

    // A second pick does not wipe the first refusal away.
    await pickFiles([aPicture()]);
    expect(screen.getByTestId("wizard-refusals").querySelectorAll("li")).toHaveLength(2);

    fireEvent.click(screen.getAllByText("Remove it")[0]!);
    expect(screen.getByTestId("wizard-refusals").querySelectorAll("li")).toHaveLength(1);
  });

  it("offers no way to add once a video is the body", async () => {
    render();
    await pickFiles([aVideo()]);

    // A video takes the body whole, so an add control could only be refused.
    expect(await screen.findByTestId("wizard-video-body")).toBeInTheDocument();
    expect(screen.queryByTestId("wizard-open-picker")).toBeNull();
  });

  it("asks for one description of the video, and none of its cover", async () => {
    render();
    await pickFiles([aVideo()]);
    fireEvent.click(await screen.findByTestId("wizard-next"));
    fireEvent.click(await screen.findByTestId("wizard-cover-frame-0"));
    fireEvent.click(screen.getByTestId("wizard-next"));

    const counter = await screen.findByTestId("wizard-describe-counter");
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
    fireEvent.click(await screen.findByTestId("wizard-next"));
    fireEvent.click(await screen.findByTestId("wizard-cover-frame-0"));
    fireEvent.click(screen.getByTestId("wizard-next"));

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
    fireEvent.click(await screen.findByTestId("wizard-next"));

    // No offers to select from once the capture failed, and no stall either —
    // the escape hatch is what the screen falls back to.
    await screen.findByTestId("wizard-cover-picture");
    expect(screen.queryByTestId("wizard-cover-frame-0")).toBeNull();
    expect(screen.queryByTestId("wizard-cover-capturing")).toBeNull();
    // Next stays open even with no face chosen — a faceless video is no
    // longer a wall (jakob, 2026-09-10, "going without a cover is always
    // possible"), so a capture failure that leaves no offers still has to
    // let the author move on rather than trap them on this screen.
    expect(screen.getByTestId("wizard-next")).not.toBeDisabled();
  });
});
